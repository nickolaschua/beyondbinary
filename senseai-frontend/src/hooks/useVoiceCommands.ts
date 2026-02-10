"use client";

import { useEffect, useRef } from "react";

interface BasicSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BasicSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface VoiceCommand {
  phrases: string[];
  action: (transcript: string) => void;
}

export function useVoiceCommands({
  enabled,
  commands,
  onHeard,
}: {
  enabled: boolean;
  commands: VoiceCommand[];
  onHeard?: (transcript: string) => void;
}) {
  const commandsRef = useRef(commands);
  const onHeardRef = useRef(onHeard);

  useEffect(() => {
    commandsRef.current = commands;
    onHeardRef.current = onHeard;
  }, [commands, onHeard]);

  useEffect(() => {
    if (!enabled) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    let active = true;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      if (lastIndex < 0) return;
      const transcript = event.results[lastIndex]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      const lowered = transcript.toLowerCase();
      onHeardRef.current?.(transcript);

      for (const command of commandsRef.current) {
        if (command.phrases.some((phrase) => lowered.includes(phrase))) {
          command.action(transcript);
          break;
        }
      }
    };

    recognition.onerror = () => {
      // Browser speech recognition can fail intermittently; onend restart handles recovery.
    };

    recognition.onend = () => {
      if (!active) return;
      try {
        recognition.start();
      } catch {
        // Ignore repeated start errors; user can toggle voice controls.
      }
    };

    try {
      recognition.start();
    } catch {
      // Ignore startup failures (permissions/unsupported runtime).
    }

    return () => {
      active = false;
      try {
        recognition.stop();
      } catch {
        // No-op on teardown.
      }
    };
  }, [enabled]);
}

