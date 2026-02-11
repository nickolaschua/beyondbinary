"use client";

import { useEffect, useRef } from "react";
import { readUserConfig } from "@/lib/profile";
import { speakGuidance } from "@/lib/tts";
import { postTts } from "@/lib/api";

// Rachel's voice ID - calm, gentle female voice
const GUIDE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export function usePageAudioGuide(message: string) {
  const announcedRef = useRef(false);

  useEffect(() => {
    if (announcedRef.current) return;
    const config = readUserConfig();
    if (config?.settings.audioPrompts) {
      // Use ElevenLabs with Rachel's gentle voice, fallback to Web Speech
      postTts(message, GUIDE_VOICE_ID)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.onerror = () => URL.revokeObjectURL(url);
          audio.play().catch(() => {});
        })
        .catch(() => {
          // Fallback to browser Web Speech API if backend unavailable
          speakGuidance(message);
        });
      announcedRef.current = true;
    }
  }, [message]);
}
