// 「设置」模块:上报地址 + 自动上报间隔(分钟)。
// GET /api/settings 读、PUT /api/settings 写。daemon 侧按间隔定时 POST 报表到上报地址。
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { useApp } from "../state/AppContext";

interface Settings {
  reportUrl?: string | null;
  reportIntervalMin?: number | null;
}

export function SettingsModule() {
  const { token } = useApp();
  const api = useApi(token);
  const base = location.origin;
  const [url, setUrl] = useState("");
  const [intervalStr, setIntervalStr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((s) => {
        setUrl(s.reportUrl ?? "");
        setIntervalStr(s.reportIntervalMin != null ? String(s.reportIntervalMin) : "");
        setLoading(false);
      })
      .catch(() => {
        setMsg({ kind: "err", text: "读取设置失败" });
        setLoading(false);
      });
  }, [api]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const iv = parseInt(intervalStr, 10);
    const body = {
      reportUrl: url.trim() || null,
      reportIntervalMin: Number.isFinite(iv) && iv > 0 ? iv : null,
    };
    try {
      const res = await fetch(base + "/api/settings", {
        method: "PUT",
        headers: { Authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const s = (await res.json()) as Settings;
      setUrl(s.reportUrl ?? "");
      setIntervalStr(s.reportIntervalMin != null ? String(s.reportIntervalMin) : "");
      setMsg({ kind: "ok", text: "已保存" });
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg({ kind: "err", text: "保存失败,请重试" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stats-view">
      <div className="panel-header">
        <h2>设置</h2>
      </div>
      <div className="stats-body">
        {loading ? (
          <div className="sum-empty">加载中…</div>
        ) : (
          <>
            <section className="sum-section">
              <div className="sum-head">
                <h3>上报</h3>
              </div>
              <div className="field-row">
                <label>上报地址</label>
                <input
                  className="field-input"
                  type="url"
                  placeholder="https://your-server/api/report"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="field-row">
                <label>上报间隔</label>
                <input
                  className="field-input"
                  type="number"
                  min={1}
                  placeholder="0 = 不自动上报"
                  value={intervalStr}
                  onChange={(e) => setIntervalStr(e.target.value)}
                  spellCheck={false}
                  style={{ flex: "0 0 120px" }}
                />
                <span className="field-hint" style={{ padding: 0 }}>
                  分钟(填了地址且间隔大于 0 才会自动上报)
                </span>
              </div>
              <div className="field-row">
                <label /> {/* 占位对齐 */}
                <button
                  type="button"
                  className="tab"
                  onClick={save}
                  disabled={saving}
                  title="保存设置"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
                {msg && (
                  <span className={msg.kind === "ok" ? "field-ok" : "field-err"}>{msg.text}</span>
                )}
              </div>
              <div className="field-hint">
                daemon 每分钟检查一次:地址 + 间隔都配了,就把「报表」数据 POST 到该地址;留空 / 间隔 0 = 不上报。改完无需重启。
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
