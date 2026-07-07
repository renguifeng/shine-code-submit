// 全局常量：端口、超时、扫描间隔、服务标识。
// 集中于此，便于 Hook / Daemon / CLI 三端一致。
import pkg from "../../package.json";

export const SERVICE_NAME = "shine-code-submit";
export const SERVICE_VERSION = pkg.version; // 单一来源：package.json，避免三处手动同步漏改

/**
 * daemon 监听地址。默认仅本机回环（本服务的 /api/health 与 /ui 无鉴权，绑回环最安全）。
 * 需要局域网/其他设备访问时，设环境变量 SHINE_CODE_SUBMIT_HOST=0.0.0.0（或指定网卡 IP）
 * 再 restart daemon。绑非回环后 token 成为数据接口唯一防线，勿在不可信网络下使用。
 */
export const LISTEN_HOST = process.env.SHINE_CODE_SUBMIT_HOST ?? "127.0.0.1";

export const HOST = "127.0.0.1"; // hook/cli/daemonctl 连接 daemon 用，固定回环（daemon 即使绑 0.0.0.0 也含 127.0.0.1）
export const PORT = 36666;
export const BASE_URL = `http://${HOST}:${PORT}`; // 内部访问（hook POST、cli、探活）走 127.0.0.1
export const PUBLIC_BASE_URL = `http://localhost:${PORT}`; // 给用户看的链接（localhost 友好，WSL2 转发可用）

// Hook 热转发超时：localhost 上 500ms 足够；超时即放弃热路径，靠 spool 兜底。
export const HOOK_POST_TIMEOUT_MS = 500;

// 故障路径：detached 拉起 Daemon 后轮询 /api/health 的总预算与间隔。
export const HEALTH_POLL_TIMEOUT_MS = 5000;
export const HEALTH_POLL_INTERVAL_MS = 100;

// Daemon 回捞 spool 的扫描间隔。
export const SPOOL_SCAN_INTERVAL_MS = 1000;

// 运行指标窗口（用于计算 events/sec）。
export const STATS_WINDOW_MS = 10_000;

// /api/stats 附带的日志尾行数。
export const LOG_TAIL_LINES = 200;

// 日志按天轮转：超过此大小（字节）也触发轮转。
export const LOG_ROTATE_BYTES = 5 * 1024 * 1024;

// git log 子进程超时（提交视图 /api/commits）；超时返回空 + error，不阻塞查看页。
export const GIT_TIMEOUT_MS = 5000;

// /api/sessions enrich tokenTotal 时，最多对最近多少个 session 读 transcript 汇总（控 2s 轮询成本）。
export const SESSION_TOKEN_ENRICH_LIMIT = 50;
