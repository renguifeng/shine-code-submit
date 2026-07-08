import type { ReportsResponse } from "../types";

export async function fetchReports(): Promise<ReportsResponse> {
  const r = await fetch("/api/reports");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
