// claude 配置根解析:CLAUDE_CONFIG_DIR 优先,回退 ~/.claude。与 claude-mem 一致。
import { homedir } from "node:os";
import { join } from "node:path";

/** claude 配置根目录(~/.claude 或 $CLAUDE_CONFIG_DIR)。 */
export function claudeRoot(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

/** plugin 根目录(~/.claude/plugins)。 */
export function pluginsRoot(): string {
  return join(claudeRoot(), "plugins");
}

/** 已知 marketplace 注册表路径。 */
export function knownMarketplacesPath(): string {
  return join(pluginsRoot(), "known_marketplaces.json");
}

/** 已安装 plugin 注册表路径。 */
export function installedPluginsPath(): string {
  return join(pluginsRoot(), "installed_plugins.json");
}

/** 用户 settings.json 路径(~/.claude/settings.json)。 */
export function settingsPath(): string {
  return join(claudeRoot(), "settings.json");
}
