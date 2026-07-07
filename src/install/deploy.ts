// 部署 plugin 文件到 claude cache 目录,并跑 bun install 装运行时依赖(marked/react)。
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { pluginsRoot } from "./paths";
import { SERVICE_VERSION } from "../shared/config";

export const MARKETPLACE_NAME = "shine-code-submit";
export const PLUGIN_NAME = "shine-code-submit";

/** 部署目标版本目录:~/.claude/plugins/cache/shine-code-submit/shine-code-submit/<version>/ */
export function cacheDir(version: string = SERVICE_VERSION): string {
  return join(pluginsRoot(), "cache", MARKETPLACE_NAME, PLUGIN_NAME, version);
}

/** 找 npm 包根:从本文件(dist/install.cjs)上溯到含 package.json + .claude-plugin 的目录。 */
function findPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, ".claude-plugin"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return here;
}

/** 要部署的文件/目录白名单(plugin 运行必需;不含 dist/install.cjs——install CLI 本身不进 plugin)。 */
const WHITELIST = [".claude-plugin", "hooks", "bin", "src", "ui", "package.json", "bun.lock", "README.md"];

/**
 * 部署 plugin:清同版本目录 → 拷白名单 → bun install 装依赖 → 写版本标记。
 * 返回 cache 目录绝对路径。
 */
export function deployPlugin(bunPath: string): string {
  const target = cacheDir();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  const srcRoot = findPackageRoot();
  console.log(`[shine-code-submit] 部署源:${srcRoot}`);
  for (const item of WHITELIST) {
    const from = join(srcRoot, item);
    if (!existsSync(from)) continue; // 缺(如 bun.lock 未入库)跳过
    cpSync(from, join(target, item), { recursive: true });
  }

  // bun install 装运行时依赖
  console.log("[shine-code-submit] 安装运行时依赖(bun install)...");
  let status = spawnSync(bunPath, ["install", "--frozen-lockfile"], {
    cwd: target,
    shell: process.platform === "win32",
    encoding: "utf8",
    stdio: "inherit",
  }).status;
  if (status !== 0) {
    console.log("[shine-code-submit] --frozen-lockfile 失败,重试普通 bun install");
    status = spawnSync(bunPath, ["install"], {
      cwd: target,
      shell: process.platform === "win32",
      encoding: "utf8",
      stdio: "inherit",
    }).status;
    if (status !== 0) {
      throw new Error(`bun install 失败(exit ${status})。请手动在 ${target} 跑 bun install`);
    }
  }

  writeFileSync(
    join(target, ".install-version"),
    JSON.stringify({ version: SERVICE_VERSION, installedAt: Date.now() }),
    "utf8",
  );
  console.log(`[shine-code-submit] 已部署到 ${target}`);
  return target;
}
