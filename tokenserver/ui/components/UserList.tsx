// 一级导航:用户列表。每项 用户名 + token 总数。
import type { UserAgg } from "../types";
import { fmtLabeled, fmtTotal } from "../lib/util";

export function UserList({
  users,
  selUser,
  onSelect,
}: {
  users: UserAgg[];
  selUser: string | null;
  onSelect: (gitUser: string) => void;
}) {
  return (
    <aside className="nav-users">
      <div className="nav-head">用户 · {users.length}</div>
      <ul className="nav-list">
        {users.map((u) => (
          <li
            key={u.gitUser}
            className={"nav-item" + (u.gitUser === selUser ? " active" : "")}
            title={fmtLabeled(u.totalTokens)}
            onClick={() => onSelect(u.gitUser)}
          >
            <span className="ni-name">👤 {u.gitUser || "未知"}</span>
            <span className="ni-tok">{fmtTotal(u.totalTokens)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
