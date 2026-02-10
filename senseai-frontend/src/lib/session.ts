export interface SessionSummaryData {
  sessionId: string;
  profileId: string;
  startedAt: string;
  endedAt: string;
  transcript: string[];
  lastSign: string;
  quickRepliesUsed: number;
}

const SESSION_PREFIX = "senseai-session-";

export function writeSessionSummary(data: SessionSummaryData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${SESSION_PREFIX}${data.sessionId}`, JSON.stringify(data));
}

export function readSessionSummary(sessionId: string): SessionSummaryData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSummaryData;
  } catch {
    return null;
  }
}
