// tokenserver 入口:启动 HTTP 服务,监听 36667。
import { startServer } from "./server";

const server = startServer();
console.log(`[tokenserver] listening http://${server.hostname}:${server.port}`);
