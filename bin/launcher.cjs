#!/usr/bin/env node
// shine-code-submit hook 平台分发器（.cjs 强制 CommonJS，兼容所有 node，不依赖 package.json）。
// Claude Code 经 hooks.json 以 `node launcher.cjs <Event>` 调用（exec form，不经 shell）。
// 优先 spawn 同目录 bin/<plat>-<arch>/hook[.exe]（二进制模式，已 build）；
// 不存在则 bun run src/hook/main.ts（源码模式）。
// 源码模式需要 Bun——若没装，首次自动安装（npm i -g bun → 失败回退官方脚本），装完再跑。
// 退出码恒 0——绝不影响 Claude Code 主进程。
const { spawn, spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, appendFileSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

const here = __dirname; // .../bin/
const plat = process.platform === "win32" ? "windows" : process.platform; // darwin | linux | windows
const arch = process.arch; // x64 | arm64
const ext = process.platform === "win32" ? ".exe" : "";
const hookBin = join(here, `${plat}-${arch}`, `hook${ext}`);
const hookSrc = join(here, "..", "src", "hook", "main.ts"); // 源码模式入口

const argv = process.argv.slice(2);
const event = argv[0];
const SHELL = process.platform === "win32";

/** 找 bun：先 PATH，再常见安装位置（官方脚本装到 ~/.bun/bin，npm -g 装到全局 bin）。 */
function findBun() {
  // shell 模式用单字符串（避免 Node 的 "args + shell:true" 弃用警告污染 hook stderr）
  const r = SHELL
    ? spawnSync("bun --version", { shell: true, encoding: "utf8" })
    : spawnSync("bun", ["--version"], { encoding: "utf8" });
  if (r.status === 0 && (r.stdout || "").trim()) return "bun";
  const home = homedir();
  const cands = process.platform === "win32"
    ? [join(home, ".bun", "bin", "bun.exe"), join(home, ".bun", "bin", "bun")]
    : [join(home, ".bun", "bin", "bun"), "/usr/local/bin/bun", "/opt/homebrew/bin/bun"];
  for (const c of cands) if (existsSync(c)) return c;
  return null;
}

/** 装 bun：npm i -g bun（走已配 registry/镜像，最快）→ 失败回退官方脚本。
 *  输出写日志文件，不污染 hook 的 stdout（避免被 Claude Code 当 context/error）。 */
function installBun() {
  const logDir = join(homedir(), ".local", "share", "shine-code-submit", "log");
  try { mkdirSync(logDir, { recursive: true }); } catch {}
  const logFile = join(logDir, "bun-install.log");
  const log = (s) => { try { appendFileSync(logFile, `[${new Date().toISOString()}] ${s}\n`); } catch {} };
  const opts = { shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 };

  log("bun 未检测到，开始自动安装");
  let r = spawnSync("npm install -g bun", opts);
  log(`npm i -g bun exit=${r.status}\n${(r.stdout || "") + (r.stderr || "")}`);
  let b = findBun();
  if (b) { log("OK via npm"); return b; }

  if (process.platform === "win32") {
    r = spawnSync('powershell -c "irm bun.sh/install.ps1 | iex"', opts);
  } else {
    r = spawnSync("curl -fsSL https://bun.sh/install | bash", opts);
  }
  log(`official script exit=${r.status}\n${(r.stdout || "") + (r.stderr || "")}`);
  b = findBun();
  if (b) log("OK via official script");
  return b;
}

try {
  let child;
  if (existsSync(hookBin)) {
    // 二进制模式：spawn 本地已 build 的 hook
    child = spawn(hookBin, argv, { stdio: "inherit" });
  } else {
    // 源码模式：bun run src/hook/main.ts（Windows 需 shell 找 bun.exe）
    let bun = findBun();
    if (!bun) {
      // 只在 SessionStart 打印进度（其它 hook 的 stdout 可能被 Claude Code 按 JSON 解析）
      if (event === "SessionStart") console.log("[shine-code-submit] 未检测到 Bun，首次自动安装中（约 10-30s，装完即跑，事件不丢）...");
      bun = installBun();
    }
    if (!bun) {
      if (event === "SessionStart") console.log("[shine-code-submit] Bun 自动安装失败。请手动装 Bun（https://bun.sh）后重开会话；事件不丢。");
      process.exit(0);
    }
    child = spawn(bun, ["run", hookSrc, ...argv], { stdio: "inherit", shell: SHELL });
  }
  child.on("error", () => process.exit(0));
  child.on("exit", () => process.exit(0));
} catch {
  process.exit(0);
}
