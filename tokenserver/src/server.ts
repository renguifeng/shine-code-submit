// HTTP 路由:API(health/report/reports) + 静态资源(index.html/app.js/style.css)。
// 静态资源每次请求读文件,改前端(HTML/CSS)无需重启;改 tsx 需重跑 build:ui。
import { join } from "node:path";
import { aggregate, saveReport, type UserAgg } from "./store";
import type { ReportResponse } from "./types";

const PORT = 36667;
const HOST = "0.0.0.0";

const UI_DIR = join(import.meta.dir, "..", "ui");
const ASSETS: Record<string, { path: string; type: string }> = {
  "/": { path: join(UI_DIR, "index.html"), type: "text/html; charset=utf-8" },
  "/index.html": { path: join(UI_DIR, "index.html"), type: "text/html; charset=utf-8" },
  "/ui/app.js": { path: join(UI_DIR, ".build", "app.js"), type: "application/javascript; charset=utf-8" },
  "/ui/style.css": { path: join(UI_DIR, "style.css"), type: "text/css; charset=utf-8" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function startServer() {
  return Bun.serve({
    hostname: HOST,
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/api/health" && req.method === "GET") {
        return json({ service: "tokenserver", ok: true, ts: Date.now() });
      }

      // 接收上报（daemon POST ReportResponse）
      if (path === "/api/report" && req.method === "POST") {
        let body: ReportResponse;
        try {
          body = await req.json();
        } catch {
          return json({ error: "bad json" }, 400);
        }
        if (!body || !Array.isArray(body.projects)) {
          return json({ error: "invalid report: projects missing" }, 400);
        }
        saveReport(body);
        return json({ status: "ok" });
      }

      // 聚合返回三级结构
      if (path === "/api/reports" && req.method === "GET") {
        const users: UserAgg[] = aggregate();
        return json({ users });
      }

      // 静态资源
      const asset = ASSETS[path];
      if (asset) {
        const f = Bun.file(asset.path);
        if (!f.exists()) return json({ error: "asset not found: " + path }, 404);
        return new Response(f, {
          headers: { "content-type": asset.type, "cache-control": "no-store" },
        });
      }

      return json({ error: "not found" }, 404);
    },
  });
}
