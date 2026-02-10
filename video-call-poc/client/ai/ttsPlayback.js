// client/ai/ttsPlayback.js
// Web Audio API TTS playback: interruptible, mute toggle. No <audio> elements.

let audioContext = null;
let currentSource = null;
let muted = false;
/** Active stream id; chunks with different id are ignored after interrupt */
let activeStreamId = 0;
/** Scheduled end time for the current stream so we can queue chunks */
let nextStartTime = 0;

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Resume context on user gesture (e.g. first play or mute toggle).
 * @returns {Promise<boolean>} true if resumed
 */
async function resumeContext() {
  const ctx = getContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx.state === 'running';
}

/**
 * Stop any current TTS playback (interrupt).
 */
function stopCurrentPlayback() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (_) {}
    currentSource = null;
  }
}

/**
 * Set muted state. When true, incoming chunks are not played and current playback is stopped.
 * @param {boolean} value
 */
function setMuted(value) {
  muted = !!value;
  if (muted) stopCurrentPlayback();
}

/**
 * Push a base64 TTS chunk for the current stream. Call startNewStream() when a new message begins.
 * Chunks are queued to play back-to-back.
 * @param {string} audioBase64
 */
async function pushChunk(audioBase64) {
  if (muted) return;
  const myStreamId = activeStreamId;
  const ctx = getContext();
  await resumeContext();
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  try {
    const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0, bytes.byteLength));
    if (myStreamId !== activeStreamId) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = nextStartTime;
    nextStartTime = Math.max(ctx.currentTime, startAt) + buffer.duration;
    source.start(startAt);
    currentSource = source;
    source.onended = () => {
      if (currentSource === source) currentSource = null;
    };
  } catch (e) {
    console.warn('[TTS] Decode/play error', e);
  }
}

/**
 * Start a new TTS stream (interrupts any current playback).
 */
function startNewStream() {
  activeStreamId += 1;
  stopCurrentPlayback();
  const ctx = getContext();
  nextStartTime = ctx.currentTime;
}

export {
  pushChunk,
  startNewStream,
  setMuted,
  resumeContext,
};
