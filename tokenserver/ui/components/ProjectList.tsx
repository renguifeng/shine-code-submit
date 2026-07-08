// 二级导航:选中用户的项目列表。每项 项目名 + token 总数。
import type { ProjectAgg } from "../types";
import { fmtLabeled, fmtTotal } from "../lib/util";

export function ProjectList({
  projects,
  selectedCwd,
  onSelect,
}: {
  projects: ProjectAgg[];
  selectedCwd: string | null;
  onSelect: (cwd: string) => void;
}) {
  return (
    <aside className="nav-projects">
      <div className="nav-head">项目 · {projects.length}</div>
      <ul className="nav-list">
        {projects.map((p) => (
          <li
            key={p.cwd}
            className={"nav-item" + (p.cwd === selectedCwd ? " active" : "")}
            title={fmtLabeled(p.totalTokens)}
            onClick={() => onSelect(p.cwd)}
          >
            <span className="ni-name">{p.name || p.cwd}</span>
            <span className="ni-tok">{fmtTotal(p.totalTokens)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
