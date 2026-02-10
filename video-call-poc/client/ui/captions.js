// client/ui/captions.js
// Display captions on UI - Live Captions with per-utterance tone

import { textToBrailleDisplay } from '../ai/braille.js';
import { getToneDisplay } from './toneDisplay.js';

let captionsMode = 'demo';
let isListening = false;

/** @type {Map<string, { id: string, text: string, tone?: { label: string, confidence: number } }>} */
const utterances = new Map();
const MAX_UTTERANCES_DISPLAY = 20;

function addUtterance(utteranceId, text, tone) {
  const existing = utterances.get(utteranceId);
  const mergedTone = tone ?? existing?.tone;
  utterances.set(utteranceId, { id: utteranceId, text, tone: mergedTone });
  renderUtterancesList();
}

function updateUtteranceTone(utteranceId, tone) {
  const u = utterances.get(utteranceId);
  if (!u) return;
  const currentConf = u.tone?.confidence ?? 0;
  const newConf = tone?.confidence ?? 0;
  if (!u.tone || currentConf < 0.3 || newConf > currentConf) {
    u.tone = tone;
    renderUtterancesList();
  }
}

function getUtterances() {
  return Array.from(utterances.values());
}

function clearUtterances() {
  utterances.clear();
  renderUtterancesList();
}

function setListeningState(listening) {
  isListening = listening;
  const el = document.getElementById('listening-indicator');
  if (el) el.classList.toggle('hidden', !listening);
}

function renderUtterancesList() {
  const container = document.getElementById('utterances-list');
  if (!container) return;

  const list = getUtterances();
  container.innerHTML = list.slice(-MAX_UTTERANCES_DISPLAY).map((u) => {
    const { label, emoji } = getToneDisplay(u.tone?.label);
    return `
      <div class="utterance-block" data-utterance-id="${u.id}">
        <div class="utterance-tone">${emoji} ${label}</div>
        <div class="utterance-text">${escapeHtml(u.text)}</div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setCaptionsMode(mode) {
  captionsMode = mode;
  const area = document.querySelector('.captions-area');
  if (area) {
    area.dataset.mode = mode;
  }
  const badge = document.getElementById('captions-mode-badge');
  if (badge) {
    badge.textContent = mode === 'live' ? 'Live' : mode === 'offline' ? 'Offline' : 'Demo';
  }
}

function updateBrailleDisplay(text) {
  const brailleEl = document.getElementById('braille-display');
  if (!brailleEl) return;
  brailleEl.textContent = text ? textToBrailleDisplay(text) : '';
}

function displayCaption(text, speaker = 'neutral') {
  updateBrailleDisplay(text);
}

function displayLiveCaption(text, isFinal) {
  const liveEl = document.getElementById('live-caption');
  if (!liveEl) return;
  liveEl.textContent = text || '';
  liveEl.classList.toggle('interim', !isFinal && !!text);
  liveEl.classList.toggle('hidden', !text);
}

function updateToneIndicator(tone) {
  const toneEl = document.getElementById('tone-indicator');
  if (!toneEl) return;
  const value = (tone != null && String(tone).trim()) ? String(tone).trim() : 'neutral';
  toneEl.textContent = `Tone: ${value}`;
  const slug = value.replace(/[.\s]+/g, '-').slice(0, 30);
  toneEl.className = `tone-${slug}`;
}

export {
  displayCaption,
  displayLiveCaption,
  updateToneIndicator,
  setCaptionsMode,
  setListeningState,
  addUtterance,
  updateUtteranceTone,
  getUtterances,
  clearUtterances,
  updateBrailleDisplay,
};
