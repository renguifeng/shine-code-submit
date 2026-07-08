// 「数据上报」模块:顶部汇总标题 + 左侧项目导航(仅项目名) + 右侧 session 表格。
// 表格列:Session / 时间 / 输入 token / 输出 token;表格标题显示该项目的输入/输出 token 汇总。
// 数据来自 GET /api/report?since=0(全部)。后期真·上报服务器时,把顶部占位按钮接上即可。
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { useApp } from "../state/AppContext";
import { Icon } from "./Icon";
import { Splitter } from "./Splitter";
import type { ReportProject, ReportResponse } from "../types";
import { fmtDateTime, fmtTokens, fmtUsageFull, shortDir } from "../lib/util";

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
            <span title={fmtUsageFull(data.totals.tokens)}>token {fmtTokens(data.totals.tokens.input + data.totals.tokens.output)}</span>
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

      {/* 项目导航 | 详情表格 */}
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
                  <span className="group-cwd">{shortDir(p.cwd) || p.cwd}</span>
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

/** 右侧详情:标题(项目输入/输出 token 汇总 + 提交汇总) + session 表格(时间/输入/输出)。 */
function ProjectDetail({ p }: { p: ReportProject }) {
  return (
    <>
      <div className="report-title">
        <h2 title={p.cwd}>{shortDir(p.cwd) || p.cwd}</h2>
        <span className="rt-sum" title={fmtUsageFull(p.totalTokens)}>
          输入 token <b>{fmtTokens(p.totalTokens.input)}</b>
        </span>
        <span className="rt-sum" title={fmtUsageFull(p.totalTokens)}>
          输出 token <b>{fmtTokens(p.totalTokens.output)}</b>
        </span>
        <span className="rt-sum" style={{ marginLeft: "auto" }}>
          {p.commits.count} 提交 · +{fmtTokens(p.commits.added)}/-{fmtTokens(p.commits.deleted)}
          {p.commits.lastTime ? ` · 最近 ${fmtDateTime(p.commits.lastTime)}` : ""}
        </span>
      </div>

      <div style={{ overflow: "auto", flex: "1 1 0", minHeight: 0 }}>
        <table className="report-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>时间</th>
              <th className="rt-num">输入 token</th>
              <th className="rt-num">输出 token</th>
            </tr>
          </thead>
          <tbody>
            {p.sessions.map((s) => (
              <tr key={s.sessionId}>
                <td className="rt-sid" title={s.sessionId}>
                  {s.sessionId.slice(0, 8)}
                </td>
                <td>{fmtDateTime(s.lastActive)}</td>
                <td className="rt-num">{s.tokenTotal ? fmtTokens(s.tokenTotal.input) : "—"}</td>
                <td className="rt-num">{s.tokenTotal ? fmtTokens(s.tokenTotal.output) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.sessions.length === 0 && <div className="sum-empty">无会话</div>}
      </div>
    </>
  );
}
