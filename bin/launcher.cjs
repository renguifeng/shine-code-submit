#!/usr/bin/env node
// shine-code-submit hook 平台分发器（.cjs 强制 CommonJS，兼容所有 node，不依赖 package.json）。
// Claude Code 经 hooks.json 以 `node launcher.cjs <Event>` 调用（exec form，不经 shell）。
// 优先 spawn 同目录 bin/<plat>-<arch>/hook[.exe]（二进制模式，已 build）；
// 不存在则 bun run src/hook/main.ts（源码模式，需用户装 Bun）。
// 退出码恒 0——绝不影响 Claude Code 主进程。
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join, dirname } = require("node:path");

const here = __dirname; // .../bin/
const plat = process.platform === "win32" ? "windows" : process.platform; // darwin | linux | windows
const arch = process.arch; // x64 | arm64
const ext = process.platform === "win32" ? ".exe" : "";
const hookBin = join(here, `${plat}-${arch}`, `hook${ext}`);
const hookSrc = join(here, "..", "src", "hook", "main.ts"); // 源码模式入口

const argv = process.argv.slice(2);
try {
  let child;
  if (existsSync(hookBin)) {
    // 二进制模式：spawn 本地已 build 的 hook
    child = spawn(hookBin, argv, { stdio: "inherit" });
  } else {
    // 源码模式：bun run src/hook/main.ts（Windows 需 shell 找 bun.exe）
    child = spawn("bun", ["run", hookSrc, ...argv], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }
  child.on("error", () => process.exit(0));
  child.on("exit", () => process.exit(0));
} catch {
  process.exit(0);
}
