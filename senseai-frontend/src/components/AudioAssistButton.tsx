"use client";

import { speakGuidance } from "@/lib/tts";

export function AudioAssistButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => speakGuidance(text)}
      className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300"
      aria-label="Play audio guidance"
    >
      Play audio guidance
    </button>
  );
}
