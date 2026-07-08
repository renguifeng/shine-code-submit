// 规范化存储:projects + sessions 两表,upsert 去重(行数稳定,不随上报次数增长)。
// 上报时拆分逐条 upsert;查询走 SQL 组装三级。aggregate 结果内存缓存,写时失效。
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ReportResponse, TokenUsage } from "./types";

const DATA_DIR = join(import.meta.dir, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(join(DATA_DIR, "tokens.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS projects (
    gitUser TEXT NOT NULL,
    cwd TEXT NOT NULL,
    name TEXT,
    gitRemote TEXT,
    lastActive INTEGER DEFAULT 0,
    updatedAt INTEGER DEFAULT 0,
    PRIMARY KEY (gitUser, cwd)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sessionId TEXT PRIMARY KEY,
    gitUser TEXT NOT NULL,
    cwd TEXT NOT NULL,
    lastActive INTEGER DEFAULT 0,
    input INTEGER DEFAULT 0,
    output INTEGER DEFAULT 0,
    cacheCreation INTEGER DEFAULT 0,
    cacheRead INTEGER DEFAULT 0,
    updatedAt INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_cwd ON sessions(gitUser, cwd);
  CREATE INDEX IF NOT EXISTS idx_projects_gitUser ON projects(gitUser);
`);

export interface SessionAgg {
  sessionId: string;
  lastActive: number;
  tokenTotal: TokenUsage | null;
}
export interface ProjectAgg {
  cwd: string;
  name: string;
  gitRemote: string | null;
  lastActive: number;
  sessionCount: number;
  totalTokens: TokenUsage;
  sessions: SessionAgg[];
}
export interface UserAgg {
  gitUser: string;
  lastActive: number;
  projectCount: number;
  sessionCount: number;
  totalTokens: TokenUsage;
  projects: ProjectAgg[];
}

const ZERO: TokenUsage = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };

function realInput(u: TokenUsage): number {
  return u.input + u.cacheCreation + u.cacheRead;
}
function sumTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheCreation: a.cacheCreation + b.cacheCreation,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

interface ProjectRow {
  gitUser: string;
  cwd: string;
  name: string | null;
  gitRemote: string | null;
  lastActive: number;
}
interface SessionRow {
  sessionId: string;
  gitUser: string;
  cwd: string;
  lastActive: number;
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

// 预编译 upsert(事务内复用)
const upsertProject = db.query(`
  INSERT INTO projects (gitUser, cwd, name, gitRemote, lastActive, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(gitUser, cwd) DO UPDATE SET
    name = excluded.name,
    gitRemote = excluded.gitRemote,
    lastActive = MAX(projects.lastActive, excluded.lastActive),
    updatedAt = excluded.updatedAt
`);
const upsertSession = db.query(`
  INSERT INTO sessions (sessionId, gitUser, cwd, lastActive, input, output, cacheCreation, cacheRead, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(sessionId) DO UPDATE SET
    gitUser = excluded.gitUser,
    cwd = excluded.cwd,
    lastActive = excluded.lastActive,
    input = excluded.input,
    output = excluded.output,
    cacheCreation = excluded.cacheCreation,
    cacheRead = excluded.cacheRead,
    updatedAt = excluded.updatedAt
  WHERE excluded.lastActive >= sessions.lastActive
`);

/**
 * 存储一次上报:拆分逐条 upsert。
 * - 项目 按 (gitUser, cwd) 去重,最新覆盖 name/gitRemote;lastActive 取 max。
 * - 会话 按 sessionId 去重,仅在 lastActive >= 旧 时覆盖 token(取最新快照)。
 */
export function saveReport(raw: ReportResponse): void {
  const gitUser =
    raw.gitUser ?? raw.projects.find((p) => p.gitUser)?.gitUser ?? "未知用户";
  const now = Date.now();
  const tx = db.transaction(() => {
    for (const p of raw.projects ?? []) {
      const projLastActive = (p.sessions ?? []).reduce(
        (m, s) => Math.max(m, s.lastActive),
        0,
      );
      upsertProject.run(gitUser, p.cwd, p.name ?? null, p.gitRemote ?? null, projLastActive, now);
      for (const s of p.sessions ?? []) {
        const t = s.tokenTotal ?? ZERO;
        upsertSession.run(
          s.sessionId, gitUser, p.cwd, s.lastActive,
          t.input, t.output, t.cacheCreation, t.cacheRead, now,
        );
      }
    }
  });
  tx();
  cachedUsers = null; // 失效缓存
}

let cachedUsers: UserAgg[] | null = null;

/** 查询三级聚合(有内存缓存,saveReport 时失效)。 */
export function aggregate(): UserAgg[] {
  if (cachedUsers) return cachedUsers;

  const projs = db
    .query<ProjectRow>("SELECT gitUser, cwd, name, gitRemote, lastActive FROM projects")
    .all();
  const sess = db
    .query<SessionRow>(
      "SELECT sessionId, gitUser, cwd, lastActive, input, output, cacheCreation, cacheRead FROM sessions",
    )
    .all();

  // 按 (gitUser, cwd) 分组 sessions
  const sessByProj = new Map<string, SessionAgg[]>();
  for (const s of sess) {
    const key = s.gitUser + "\0" + s.cwd;
    let arr = sessByProj.get(key);
    if (!arr) {
      arr = [];
      sessByProj.set(key, arr);
    }
    arr.push({
      sessionId: s.sessionId,
      lastActive: s.lastActive,
      tokenTotal: {
        input: s.input,
        output: s.output,
        cacheCreation: s.cacheCreation,
        cacheRead: s.cacheRead,
      },
    });
  }
  for (const arr of sessByProj.values()) arr.sort((a, b) => b.lastActive - a.lastActive);

  // 按 gitUser 分组 projects
  const projByUser = new Map<string, ProjectAgg[]>();
  for (const p of projs) {
    let arr = projByUser.get(p.gitUser);
    if (!arr) {
      arr = [];
      projByUser.set(p.gitUser, arr);
    }
    const sessions = sessByProj.get(p.gitUser + "\0" + p.cwd) ?? [];
    const totalTokens = sessions.reduce(
      (acc, s) => sumTokens(acc, s.tokenTotal ?? ZERO),
      { ...ZERO },
    );
    arr.push({
      cwd: p.cwd,
      name: p.name ?? p.cwd,
      gitRemote: p.gitRemote,
      lastActive: p.lastActive,
      sessionCount: sessions.length,
      totalTokens,
      sessions,
    });
  }
  for (const arr of projByUser.values()) {
    arr.sort(
      (a, b) =>
        realInput(b.totalTokens) + b.totalTokens.output - (realInput(a.totalTokens) + a.totalTokens.output),
    );
  }

  const users: UserAgg[] = [];
  for (const [gitUser, projects] of projByUser) {
    const totalTokens = projects.reduce(
      (acc, p) => sumTokens(acc, p.totalTokens),
      { ...ZERO },
    );
    const sessionCount = projects.reduce((a, p) => a + p.sessionCount, 0);
    const lastActive = projects.reduce((a, p) => Math.max(a, p.lastActive), 0);
    users.push({
      gitUser,
      lastActive,
      projectCount: projects.length,
      sessionCount,
      totalTokens,
      projects,
    });
  }
  users.sort(
    (a, b) =>
      realInput(b.totalTokens) + b.totalTokens.output - (realInput(a.totalTokens) + a.totalTokens.output),
  );
  cachedUsers = users;
  return users;
}
