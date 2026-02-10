// client/ui/chat.js
// Chat log and input; role="log" + aria-live="polite" for accessibility. Blind mode hides UI visually.

const messages = [];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderLog() {
  const el = document.getElementById('chat-log-inner');
  if (!el) return;
  el.innerHTML = messages
    .map(
      (m) =>
        `<div class="chat-msg" data-sender="${escapeHtml(m.sender)}">${escapeHtml(m.text)}</div>`
    )
    .join('');
  el.scrollTop = el.scrollHeight;
}

/**
 * Append a message to the chat log and re-render.
 * @param {string} sender - "local" | "remote"
 * @param {string} text - Message text
 */
function appendMessage(sender, text) {
  if (!text || !sender) return;
  messages.push({ sender, text });
  renderLog();
}

function getMessages() {
  return messages.slice();
}

/**
 * Set blind mode: visually hide the chat panel but keep the live region in DOM for AT + TTS.
 * @param {boolean} blind - If true, hide chat UI
 */
function setBlindMode(blind) {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  if (blind) {
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.add('chat-panel-blind');
  } else {
    panel.removeAttribute('aria-hidden');
    panel.classList.remove('chat-panel-blind');
  }
}

/**
 * Initialize chat UI: bind form submit and Enter key to onSend.
 * @param {{ onSend: (text: string) => void }} opts - onSend(text) called when user sends
 */
function initChat(opts) {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) return;
    if (opts.onSend) opts.onSend(text);
    input.value = '';
  });
}

export {
  appendMessage,
  getMessages,
  setBlindMode,
  initChat,
};
