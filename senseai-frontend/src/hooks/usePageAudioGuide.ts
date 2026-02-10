"use client";

import { useEffect, useRef } from "react";
import { readUserConfig } from "@/lib/profile";
import { speakGuidance } from "@/lib/tts";

export function usePageAudioGuide(message: string) {
  const announcedRef = useRef(false);

  useEffect(() => {
    if (announcedRef.current) return;
    const config = readUserConfig();
    if (config?.settings.audioPrompts) {
      speakGuidance(message);
      announcedRef.current = true;
    }
  }, [message]);
}
