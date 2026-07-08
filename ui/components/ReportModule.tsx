// 「数据上报」模块:顶部汇总标题 + 左侧项目导航 + 右侧选中项目的会话详情(时间/token)。
// 数据来自 GET /api/report?since=0(全部)。后期真·上报服务器时,把顶部占位按钮接上即可。
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { useApp } from "../state/AppContext";
import { Icon } from "./Icon";
import { Splitter } from "./Splitter";
import type { ReportProject, ReportResponse } from "../types";
import { fmtDateTime, fmtTokens, fmtUsage, fmtUsageFull, shortDir } from "../lib/util";

export function ReportModule() {
  const { token } = useApp();
  const api = useApi(token);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selCwd, setSelCwd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    api<ReportResponse>(`/api/report?since=0`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [api]);

  // 默认选中第一个项目
  useEffect(() => {
    if (data && !selCwd && data.projects[0]) setSelCwd(data.projects[0].cwd);
  }, [data, selCwd]);

  const sel = data?.projects.find((p) => p.cwd === selCwd) ?? null;

  return (
    <div className="stats-view">
      {/* 顶部汇总标题 */}
      <div
        className="panel-header"
        style={{ display: "flex", gap: "1.1rem", alignItems: "baseline", flexWrap: "wrap" }}
      >
        {data ? (
          <>
            <b>数据上报</b>
            <span title="软件版本">v{data.version}</span>
            <span title="git 用户">👤 {data.gitUser ?? "—"}</span>
            <span>{data.totals.projects} 项目</span>
            <span>{data.totals.sessions} 会话</span>
            <span title={fmtUsageFull(data.totals.tokens)}>token {fmtUsage(data.totals.tokens) || "—"}</span>
            <span>
              {data.totals.commitCount} 提交 · +{fmtTokens(data.totals.added)}/-{fmtTokens(data.totals.deleted)}
            </span>
            {/* 占位:后期接「上报到服务器」(POST 本报告到远端)。现在禁用。 */}
            <button
              type="button"
              className="tab"
              disabled
              title="后期接入:把本报告上报到服务器(占位)"
              style={{ marginLeft: "auto" }}
            >
              ☁ 上报(敬请期待)
            </button>
          </>
        ) : (
          <span>{err ? `加载失败:${err}` : "加载中…"}</span>
        )}
      </div>

      {/* 项目导航 | 详情 */}
      <div className="sessions-with-tree">
        <aside className="sessions-tree-panel panel">
          <div className="panel-header">
            <h2>项目 · {data?.projects.length ?? 0}</h2>
          </div>
          {!data || data.projects.length === 0 ? (
            <ul className="session-tree">
              <li className="empty-state">
                <span className="es-hint">暂无项目</span>
                <span className="es-sub">启动 Claude Code 后会出现</span>
              </li>
            </ul>
          ) : (
            <ul className="session-tree">
              {data.projects.map((p) => (
                <li
                  key={p.cwd}
                  className={p.cwd === selCwd ? "active" : undefined}
                  title={p.cwd}
                  onClick={() => setSelCwd(p.cwd)}
                >
                  <div className="sess-row">
                    <span className="group-cwd">{shortDir(p.cwd) || p.cwd}</span>
                    <span className="sess-tokens" title={fmtUsageFull(p.totalTokens)}>
                      {fmtUsage(p.totalTokens) || "—"}
                    </span>
                  </div>
                  <div className="sess-sub">
                    {p.sessionCount} 会话 · {p.commits.count} 提交
                    {p.gitUser ? ` · @${p.gitUser}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <Splitter orient="v" varName="--tree-w" />

        <div className="sessions-main">
          {sel ? (
            <ProjectDetail p={sel} />
          ) : (
            <div className="empty-state">
              <Icon name="log" size={30} />
              <span className="es-hint">选左侧项目查看详情</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 右侧详情:项目头部(提交汇总) + 会话明细(时间/token) + 最近提交。 */
function ProjectDetail({ p }: { p: ReportProject }) {
  return (
    <>
      <div
        className="panel-header"
        style={{ display: "flex", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}
      >
        <h2 title={p.cwd}>{shortDir(p.cwd) || p.cwd}</h2>
        <span style={{ opacity: 0.7 }}>{p.gitUser ? `@${p.gitUser}` : "@—"}</span>
        <span style={{ marginLeft: "auto", opacity: 0.7 }}>
          {p.commits.count} 提交 · +{fmtTokens(p.commits.added)}/-{fmtTokens(p.commits.deleted)}
          {p.commits.lastTime ? ` · 最近 ${fmtDateTime(p.commits.lastTime)}` : ""}
        </span>
      </div>

      <div style={{ overflow: "auto", padding: "0.5rem 0.8rem" }}>
        <div className="bar-list">
          <div className="bar-row">
            <span className="bar-label">会话数</span>
            <span className="bar-val">{p.sessionCount}</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">token</span>
            <span className="bar-val" title={fmtUsageFull(p.totalTokens)}>
              {fmtUsage(p.totalTokens) || "—"}
            </span>
          </div>
        </div>

        <div className="sum-head" style={{ marginTop: "0.8rem" }}>
          <h3>会话明细 · 时间 / token · {p.sessions.length}</h3>
        </div>
        {p.sessions.length === 0 ? (
          <div className="sum-empty">无会话</div>
        ) : (
          <div className="bar-list">
            {p.sessions.map((s) => (
              <div className="sess-row" key={s.sessionId}>
                <span className="sess-time">{fmtDateTime(s.lastActive)}</span>
                <span className="sess-sid" title={s.sessionId}>
                  {s.sessionId.slice(0, 8)}
                </span>
                <span className="sess-tokens" title={fmtUsageFull(s.tokenTotal)}>
                  {fmtUsage(s.tokenTotal) || "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="sum-head" style={{ marginTop: "0.8rem" }}>
          <h3>最近提交 · {p.recentCommits.length}</h3>
        </div>
        {p.recentCommits.length === 0 ? (
          <div className="sum-empty">无提交</div>
        ) : (
          <div className="bar-list">
            {p.recentCommits.map((c) => (
              <div className="sess-row" key={c.hash}>
                <span className="sess-time">{fmtDateTime(c.time)}</span>
                <span className="sess-sid" title={c.subject}>
                  {(c.subject || c.hash).slice(0, 26)}
                </span>
                <span className="sess-tokens">
                  +{c.added}/-{c.deleted}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
