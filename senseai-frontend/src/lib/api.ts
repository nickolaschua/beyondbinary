import { API_HEALTH } from "./constants";

export async function checkBackendHealth(): Promise<{
  ok: boolean;
  details?: unknown;
}> {
  try {
    const res = await fetch(API_HEALTH, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    const details = await res.json().catch(() => undefined);
    return { ok: true, details };
  } catch {
    return { ok: false };
  }
}
