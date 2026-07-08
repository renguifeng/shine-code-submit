#!/usr/bin/env bun
// 把 ui/app.tsx 打包成 ui/.build/app.js（browser esm, minify, production）。
// React 一并打入 app.js,运行时无需前端 node_modules。改 UI 后重新跑此脚本。
// 用 import.meta.dir 定位,不依赖 cwd。
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const UI_DIR = join(import.meta.dir, "..", "ui");
const OUT_DIR = join(UI_DIR, ".build");
mkdirSync(OUT_DIR, { recursive: true });

const uiBuild = await Bun.build({
  entrypoints: [join(UI_DIR, "app.tsx")],
  outdir: OUT_DIR,
  target: "browser",
  format: "esm",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!uiBuild.success) {
  throw new Error("ui bundle failed:\n" + uiBuild.logs.join("\n"));
}
console.log("ui bundled -> " + join(OUT_DIR, "app.js"));
