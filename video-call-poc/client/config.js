// client/config.js
// Backend URL for STT/tone (Beyond Binary FastAPI). Override with ?backend=ws://host:port
export function getBackendWsUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('backend');
  if (fromQuery) return fromQuery.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.BACKEND_WS_URL) {
    return String(window.BACKEND_WS_URL).replace(/\/$/, '');
  }

  // If app is opened over HTTPS on LAN/device, default backend must also be HTTPS.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `https://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

// Chunk interval for sending audio to backend (ms). Shorter = lower latency, more requests. 1.5–2s is a good balance.
export const AUDIO_CHUNK_INTERVAL_MS = 1500;
