// 主组件:state(users/selUser/selProj) + 三栏布局(用户导航 | 项目导航 | 表格)。
// 每 10s 轮询 /api/reports。默认选第一个用户;项目用 fallback(未选或失效取第一个)。
import { useEffect, useState } from "react";
import type { UserAgg } from "../types";
import { fetchReports } from "../lib/api";
import { fmtDate } from "../lib/util";
import { UserList } from "./UserList";
import { ProjectList } from "./ProjectList";
import { SessionTable } from "./SessionTable";

export function App() {
  const [users, setUsers] = useState<UserAgg[]>([]);
  const [selUser, setSelUser] = useState<string | null>(null);
  const [selProj, setSelProj] = useState<string | null>(null);
  const [meta, setMeta] = useState("加载中…");

  const load = async () => {
    try {
      const d = await fetchReports();
      setUsers(d.users);
      setSelUser((cur) => cur ?? d.users[0]?.gitUser ?? null);
      const totalSessions = d.users.reduce((a, u) => a + u.sessionCount, 0);
      setMeta(`${d.users.length} 用户 · ${totalSessions} 会话 · 更新于 ${fmtDate(Date.now())}`);
    } catch (e) {
      setMeta("加载失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const currentUser = users.find((u) => u.gitUser === selUser) ?? null;
  const projects = currentUser?.projects ?? [];
  // selProj 失效(切用户后旧 cwd)时 fallback 到第一个,避免 useEffect 选默认导致渲染循环
  const currentProject = projects.find((p) => p.cwd === selProj) ?? projects[0] ?? null;

  return (
    <>
      <div className="header">
        <h1>Token 上报</h1>
        <span className="hint">{meta}</span>
        <button style={{ marginLeft: "auto" }} onClick={load}>刷新</button>
      </div>
      <div className="layout">
        <UserList
          users={users}
          selUser={selUser}
          onSelect={(u) => {
            setSelUser(u);
            setSelProj(null);
          }}
        />
        <ProjectList
          projects={projects}
          selectedCwd={currentProject?.cwd ?? null}
          onSelect={setSelProj}
        />
        <SessionTable project={currentProject} />
      </div>
    </>
  );
}
