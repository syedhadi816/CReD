/**
 * Structured logs for operator review (e.g. Render dashboard → Logs).
 * Search for prefix `[AUDIT]`; each line is one JSON object after the prefix.
 */
const MAX_AUDIT_STRING = 500;

export function truncateForAudit(s: string, max = MAX_AUDIT_STRING): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

export function auditLog(event: string, payload: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...payload,
  });
  console.log(`[AUDIT] ${line}`);
}

export function clientIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]?.trim() ?? null;
  if (Array.isArray(xff)) return xff[0]?.split(",")[0]?.trim() ?? null;
  return req.socket.remoteAddress ?? null;
}
