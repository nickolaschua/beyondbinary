// client/config.js
// Backend URL for STT/tone (Beyond Binary FastAPI). Override with ?backend=ws://host:port
export function getBackendWsUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('backend');
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  return (typeof window !== 'undefined' && window.BACKEND_WS_URL) || 'http://localhost:8000';
}

// Chunk interval for sending audio to backend (ms). Shorter = lower latency, more requests. 1.5–2s is a good balance.
export const AUDIO_CHUNK_INTERVAL_MS = 1500;
