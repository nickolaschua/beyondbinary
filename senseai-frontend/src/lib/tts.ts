/**
 * Simple TTS helper using the browser Web Speech API.
 * This keeps things fully frontend-only for now so you can test easily.
 */

export function speakText(text: string) {
  if (typeof window === "undefined") return;
  if (!text.trim()) return;
  if (!("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;

  const run = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    const voices = synth.getVoices();
    const preferredVoice =
      voices.find((voice) => voice.lang === "en-US") ??
      voices.find((voice) => voice.lang.startsWith("en")) ??
      null;
    if (preferredVoice) utterance.voice = preferredVoice;
    synth.cancel();
    synth.resume();
    synth.speak(utterance);
  };

  run();

  // Some browsers initialize voices late; retry once for reliability.
  window.setTimeout(() => {
    if (!synth.speaking) run();
  }, 180);
}
