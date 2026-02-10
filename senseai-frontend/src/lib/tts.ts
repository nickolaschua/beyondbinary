/**
 * Backend TTS (ElevenLabs) for live session; Web Speech for accessibility guidance only.
 */

import { postTts } from "./api";

/**
 * Speak short guidance/hints using the browser's Web Speech API.
 * Use for "Play audio guidance" and page-load hints so they work without the backend.
 */
export function speakGuidance(text: string): void {
  if (typeof window === "undefined") return;
  if (!text.trim()) return;
  if (!("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  const voices = synth.getVoices();
  const preferred =
    voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  if (preferred) utterance.voice = preferred;
  synth.cancel();
  synth.resume();
  synth.speak(utterance);
  window.setTimeout(() => {
    if (!synth.speaking) synth.speak(utterance);
  }, 180);
}

export function speakText(text: string, baseUrl?: string): void {
  if (typeof window === "undefined") return;
  if (!text.trim()) return;

  postTts(text.trim(), null, baseUrl)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    })
    .catch(() => {
      // Backend TTS failed; no fallback
    });
}

/**
 * Play a single base64-encoded MP3 chunk (e.g. from WS tts_audio_chunk).
 * Returns the Audio element so caller can chain or wait for 'ended'.
 */
export function playTtsChunk(audioBase64: string): HTMLAudioElement | null {
  if (typeof window === "undefined" || !audioBase64) return null;
  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

/** Queue and play TTS chunks from WS (tts_audio_chunk / tts_audio_end). */
const ttsQueue: string[] = [];
let ttsPlaying = false;

function drainTtsQueue() {
  if (ttsPlaying || ttsQueue.length === 0) return;
  const chunk = ttsQueue.shift();
  if (!chunk) {
    drainTtsQueue();
    return;
  }
  ttsPlaying = true;
  const audio = playTtsChunk(chunk);
  if (audio) {
    audio.onended = () => {
      ttsPlaying = false;
      drainTtsQueue();
    };
    audio.onerror = () => {
      ttsPlaying = false;
      drainTtsQueue();
    };
  } else {
    ttsPlaying = false;
    drainTtsQueue();
  }
}

export function pushTtsChunk(audioBase64: string): void {
  ttsQueue.push(audioBase64);
  drainTtsQueue();
}

export function startNewTtsStream(): void {
  ttsQueue.length = 0;
  ttsPlaying = false;
}
