"use client";

import { speakGuidance } from "@/lib/tts";
import { postTts } from "@/lib/api";

// Rachel's voice ID - calm, gentle female voice
const GUIDE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export function AudioAssistButton({ text }: { text: string }) {
  const handleClick = () => {
    // Use ElevenLabs with Rachel's gentle voice, fallback to Web Speech
    postTts(text, GUIDE_VOICE_ID)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.onerror = () => URL.revokeObjectURL(url);
        audio.play().catch(() => {});
      })
      .catch(() => {
        // Fallback to browser Web Speech API if backend unavailable
        speakGuidance(text);
      });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300"
      aria-label="Play audio guidance"
    >
      Play audio guidance
    </button>
  );
}
