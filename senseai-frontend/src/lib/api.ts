import { API_HEALTH, API_URL } from "./constants";

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

function getBase(url?: string) {
  return (url ?? API_URL).replace(/\/$/, "");
}

export async function postTts(text: string, voiceId?: string | null, baseUrl?: string): Promise<Blob> {
  const res = await fetch(`${getBase(baseUrl)}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId ?? null }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  return res.blob();
}

export interface ProfileChannels {
  audio_output?: boolean;
  visual_output?: boolean;
  haptic_output?: boolean;
  captions?: boolean;
  tone_badges?: boolean;
  quick_replies?: boolean;
  tts_for_replies?: boolean;
  audio_summaries?: boolean;
}

export interface ProfileResponse {
  profile_type: string;
  user_name: string;
  channels: ProfileChannels;
}

export async function createProfile(profileType: string, userName?: string): Promise<ProfileResponse> {
  const res = await fetch(`${getBase()}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_type: profileType, user_name: userName ?? "User" }),
  });
  if (!res.ok) throw new Error(`Create profile failed: ${res.status}`);
  return res.json();
}

export async function getProfile(userName: string): Promise<ProfileResponse> {
  const res = await fetch(`${getBase()}/api/profile/${encodeURIComponent(userName)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Get profile failed: ${res.status}`);
  return res.json();
}
