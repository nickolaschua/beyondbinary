"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheckBig,
  EarOff,
  EyeOff,
  MapPinned,
  MicOff,
  SlidersHorizontal,
  SquareUserRound,
  UserRound,
  Wrench,
} from "lucide-react";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { textToBrailleCells } from "@/braille/mapping";
import { useVoiceCommands, type VoiceCommand } from "@/hooks/useVoiceCommands";
import { applyUserSettings, clampTextScale } from "@/lib/accessibility";
import {
  DEFAULT_SETTINGS,
  PROFILES,
  type UserProfileId,
  type UserSettings,
  writeUserConfig,
} from "@/lib/profile";
import { API_URL } from "@/lib/constants";
import { speakGuidance } from "@/lib/tts";

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

const STEP_TITLES = ["Profile", "Accessibility", "Checks", "Finish"];
const STEP_HINTS = [
  "Choose your profile and review the live preview.",
  "Set text size and guidance options.",
  "Run quick device and backend checks.",
  "Confirm and finish setup.",
];
const STEP_ICONS = [UserRound, SlidersHorizontal, Wrench, MapPinned];
const INTRO_MESSAGE = "Hey there! I am SenseAI. I am here to help you with our onboarding process!";
const TEXT_SIZE_STEPS = [90, 100, 110, 120, 130, 140];
const TEXT_SIZE_LABELS = ["Compact", "Default", "Large", "X-Large", "XX-Large", "Max"];

const PROFILE_ICON: Record<UserProfileId, typeof EyeOff> = {
  blind: EyeOff,
  deaf: EarOff,
  mute: MicOff,
  deafblind: SquareUserRound,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [profileId, setProfileId] = useState<UserProfileId>("deafblind");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [voiceStatus, setVoiceStatus] = useState("Voice commands ready");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [checking, setChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState("Not checked");
  const [deviceStatus, setDeviceStatus] = useState("Not checked");
  const [ttsStatus, setTtsStatus] = useState("Not checked");

  const introAudioQueuedRef = useRef(false);
  const recognitionRef = useRef<BasicSpeechRecognition | null>(null);
  const stepRef = useRef(step);
  const profileRef = useRef(profileId);
  const settingsRef = useRef(settings);
  const showIntroRef = useRef(showIntro);

  const selectedProfile = useMemo(
    () => PROFILES.find((profile) => profile.id === profileId) ?? PROFILES[0],
    [profileId]
  );

  const selectedScaleIndex = Math.max(
    0,
    TEXT_SIZE_STEPS.findIndex((size) => size === settings.textScale)
  );

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    profileRef.current = profileId;
  }, [profileId]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    showIntroRef.current = showIntro;
  }, [showIntro]);

  const speakGuide = (message: string) => {
    if (!settings.audioPrompts) return;
    speakGuidance(message);
  };

  const applySettings = (next: UserSettings) => {
    setSettings(next);
    applyUserSettings(next);
  };

  const pickProfileFromSpeech = (spoken: string): UserProfileId | null => {
    const text = spoken.toLowerCase();
    if (text.includes("deaf blind") || text.includes("deafblind")) return "deafblind";
    if (text.includes("blind")) return "blind";
    if (text.includes("deaf")) return "deaf";
    if (text.includes("mute")) return "mute";
    return null;
  };

  const chooseProfile = (id: UserProfileId) => {
    setProfileId(id);
  };

  const startVoiceSelection = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("Voice selection is not supported in this browser.");
      speakGuidance("Voice selection is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    setVoiceStatus("Listening... Say: I am blind, I am deaf, I am mute, or I am deafblind.");

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      const picked = pickProfileFromSpeech(transcript);
      if (picked) {
        chooseProfile(picked);
        setVoiceStatus(`Selected profile: ${picked}`);
        speakGuidance(`Profile selected: ${picked}`);
      } else {
        setVoiceStatus(`No match from: ${transcript}`);
      }
    };

    recognition.onerror = () => {
      setVoiceStatus("Voice selection failed. Please choose manually.");
    };

    recognition.onend = () => {
      // Voice recognition ended
    };

    recognition.start();
  };

  const runChecks = async () => {
    setChecking(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      stream.getTracks().forEach((track) => track.stop());
      setDeviceStatus(hasVideo && hasAudio ? "Ready" : "Missing camera or microphone");
    } catch {
      setDeviceStatus("Permission required");
    }

    try {
      const base = API_URL.replace(/\/$/, "");
      const response = await fetch(`${base}/health`, { cache: "no-store" });
      if (!response.ok) {
        setHealthStatus(`Health check failed (${response.status})`);
      } else {
        const payload = (await response.json()) as { status?: string };
        setHealthStatus(payload.status === "ok" ? "Backend ready" : "Backend up, status not ok");
      }
    } catch {
      setHealthStatus("Backend unavailable");
    }

    setTtsStatus("Backend TTS (check backend)");

    setChecking(false);
  };

  const goNext = useCallback(() => {
    if (stepRef.current < STEP_TITLES.length - 1) {
      const nextStep = stepRef.current + 1;
      setStep(nextStep);
      speakGuide(STEP_HINTS[nextStep]);
      return;
    }

    writeUserConfig({ profileId: profileRef.current, settings: settingsRef.current });
    router.push("/start");
  }, [router]);

  const goBack = useCallback(() => {
    const nextStep = Math.max(0, stepRef.current - 1);
    setStep(nextStep);
    speakGuide(STEP_HINTS[nextStep]);
  }, []);

  useEffect(() => {
    if (!showIntro || introAudioQueuedRef.current || !settings.audioPrompts) return;
    introAudioQueuedRef.current = true;
    speakGuidance(INTRO_MESSAGE);

    const replayOnFirstInteraction = () => {
      speakGuidance(INTRO_MESSAGE);
      window.removeEventListener("pointerdown", replayOnFirstInteraction);
      window.removeEventListener("keydown", replayOnFirstInteraction);
    };

    window.addEventListener("pointerdown", replayOnFirstInteraction, { once: true });
    window.addEventListener("keydown", replayOnFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", replayOnFirstInteraction);
      window.removeEventListener("keydown", replayOnFirstInteraction);
    };
  }, [settings.audioPrompts, showIntro]);

  const introVoiceCommands: VoiceCommand[] = [
    {
      phrases: ["continue", "start", "next"],
      action: () => {
        setShowIntro(false);
        speakGuide(STEP_HINTS[0]);
      },
    },
  ];

  useVoiceCommands({
    enabled: showIntro && voiceEnabled && settings.audioPrompts,
    commands: introVoiceCommands,
    onHeard: (transcript) => setVoiceStatus(`Heard: ${transcript}`),
  });

  useEffect(() => {
    if (showIntro || !voiceEnabled) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    let active = true;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    const handleCommand = (transcript: string) => {
      const text = transcript.toLowerCase();
      const profile = pickProfileFromSpeech(text);
      if (profile) {
        chooseProfile(profile);
        return;
      }

      if (text.includes("continue") || text.includes("next")) {
        goNext();
        return;
      }

      if (text.includes("back") || text.includes("previous")) {
        goBack();
        return;
      }

      if (text.includes("run check") || text.includes("check now")) {
        if (stepRef.current === 2) runChecks();
        return;
      }

      if (text.includes("finish setup") || text.includes("finish")) {
        if (stepRef.current === 3) goNext();
      }
    };

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      if (lastIndex < 0) return;
      const transcript = event.results[lastIndex]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setVoiceStatus(`Heard: ${transcript}`);
      handleCommand(transcript);
    };

    recognition.onerror = () => {
      setVoiceStatus("Voice commands paused. Click to re-enable if needed.");
    };

    recognition.onend = () => {
      if (!active || !voiceEnabled || showIntroRef.current) return;
      try {
        recognition.start();
      } catch {
        setVoiceStatus("Voice commands paused. Click to re-enable if needed.");
      }
    };

    try {
      recognition.start();
    } catch {
      // Browser blocked auto-start; user can retry with the voice toggle.
    }

    return () => {
      active = false;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    };
  }, [goBack, goNext, showIntro, voiceEnabled]);

  if (showIntro) {
    return (
      <main className="mx-auto flex min-h-[85vh] w-full max-w-6xl flex-col justify-between px-6 py-8">
        <div className="mx-auto w-full max-w-3xl pt-6">
          <div className="h-2 rounded-full bg-slate-300/30">
            <div className="h-2 w-[18%] rounded-full bg-emerald-400" />
          </div>
        </div>

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
          <div
            className="rounded-2xl px-8 py-6 text-center text-xl font-semibold"
            style={{ border: "2px solid #F24B59", backgroundColor: "#FFFFFF", color: "#D96666" }}
          >
            Hey there! I am SenseAI.
            <br />
            I am here to help you with our onboarding process!
          </div>
          <div
            className="mt-4 h-0 w-0 border-l-[14px] border-r-[14px] border-t-[16px] border-l-transparent border-r-transparent"
            style={{ borderTopColor: "#F2C7AE" }}
          />
          <div className="mt-4 flex items-center justify-center">
            <div className="senseai-blob relative flex h-36 w-36 items-center justify-center bg-emerald-500 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <div className="senseai-core h-14 w-14 rounded-xl border-4 border-slate-900 bg-white" />
              <span className="senseai-orb senseai-orb-a absolute h-3 w-3 rounded-full bg-lime-300/90" />
              <span className="senseai-orb senseai-orb-b absolute h-2.5 w-2.5 rounded-full bg-cyan-200/90" />
            </div>
          </div>
        </section>

        <div className="mx-auto mb-2 flex w-full max-w-4xl items-center justify-between">
          <AudioAssistButton text={INTRO_MESSAGE} />
          <button
            type="button"
            onClick={() => {
              setShowIntro(false);
              speakGuide(STEP_HINTS[0]);
            }}
            className="rounded-full bg-slate-900 px-8 py-3 text-lg font-semibold text-slate-100 shadow-[0_4px_0_0_rgba(0,0,0,0.35)] hover:bg-slate-800"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-4 py-8 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Setup</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Onboarding</h1>
          <p className="mt-3 text-slate-300">
            Step {step + 1} of {STEP_TITLES.length}
          </p>
          <div className="mt-4 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-cyan-400 transition-all"
              style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
            />
          </div>

          <ul className="m-0 mt-6 list-none p-0">
            {STEP_TITLES.map((title, index) => {
              const Icon = STEP_ICONS[index];
              const complete = index < step;
              const current = index === step;
              const topActive = index <= step;
              const bottomActive = index < step;
              return (
                <li key={title} className="grid h-24 grid-cols-[1fr_40px] items-center gap-3">
                  <div className="flex items-center gap-3 pr-2">
                    <Icon className={`h-5 w-5 ${current || complete ? "text-sky-300" : "text-slate-500"}`} />
                    <div>
                      <p className={`text-sm ${current || complete ? "text-sky-200" : "text-slate-400"}`}>
                        Step {index + 1}
                      </p>
                      <p className={`font-semibold ${current || complete ? "text-slate-100" : "text-slate-400"}`}>
                        {title}
                      </p>
                    </div>
                  </div>
                  <div className="relative flex h-24 w-10 items-center justify-center">
                    {index > 0 && (
                      <span
                        className="absolute left-1/2 top-0 w-0.5 -translate-x-1/2"
                        style={{ height: "50%", backgroundColor: topActive ? "#F24B59" : "#94A3B8" }}
                      />
                    )}
                    {index < STEP_TITLES.length - 1 && (
                      <span
                        className="absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2"
                        style={{ height: "50%", backgroundColor: bottomActive ? "#F24B59" : "#94A3B8" }}
                      />
                    )}
                    {complete ? (
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-sky-400 text-slate-950">
                        <CircleCheckBig className="h-4 w-4" />
                      </span>
                    ) : current ? (
                      <span className="relative z-10 block h-8 w-8 rounded-full border-2 border-sky-300 bg-slate-900" />
                    ) : (
                      <span className="relative z-10 block h-8 w-8 rounded-full bg-slate-500/70" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-sm text-slate-300">{STEP_HINTS[step]}</p>
          <p className="mt-2 text-xs text-slate-400">{voiceStatus}</p>
          <div className="mt-3 flex items-center gap-3">
            <AudioAssistButton text={STEP_HINTS[step]} />
            <button
              type="button"
              onClick={() => setVoiceEnabled((prev) => !prev)}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
            >
              Voice commands: {voiceEnabled ? "On" : "Off"}
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="text-3xl font-semibold text-slate-50">{STEP_TITLES[step]}</h2>

          {step === 0 && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {PROFILES.map((profile) => {
                  const Icon = PROFILE_ICON[profile.id];
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => chooseProfile(profile.id)}
                      className={`rounded-xl border p-4 text-left ${
                        profileId === profile.id
                          ? "border-cyan-400 bg-slate-800"
                          : "border-slate-700 bg-slate-950 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-6 w-6 text-slate-100" />
                        <h3 className="text-xl font-medium text-slate-100">{profile.label}</h3>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-slate-100">Support preview: {selectedProfile.label}</p>
                <div className="mt-3">
                  <ProfilePreview profileId={profileId} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="mb-3 text-base font-medium text-slate-200">
                  Text Size: {settings.textScale}% ({TEXT_SIZE_LABELS[selectedScaleIndex]})
                </p>
                <input
                  type="range"
                  min={0}
                  max={TEXT_SIZE_STEPS.length - 1}
                  step={1}
                  value={selectedScaleIndex}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    const nextScale = clampTextScale(TEXT_SIZE_STEPS[index] ?? 100);
                    applySettings({ ...settings, textScale: nextScale });
                  }}
                  className="w-full accent-slate-300"
                />
                <div className="mt-3 grid grid-cols-6 text-center text-sm text-slate-400">
                  {TEXT_SIZE_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const nextScale = clampTextScale(TEXT_SIZE_STEPS[index] ?? 100);
                        applySettings({ ...settings, textScale: nextScale });
                      }}
                      className={selectedScaleIndex === index ? "font-semibold text-slate-100" : ""}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleSwitch
                label="High-contrast visuals"
                checked={settings.highContrast}
                onChange={(checked) => applySettings({ ...settings, highContrast: checked })}
              />
              <ToggleSwitch
                label="Audio prompts enabled"
                checked={settings.audioPrompts}
                onChange={(checked) => applySettings({ ...settings, audioPrompts: checked })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={runChecks}
                disabled={checking}
                className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-70"
              >
                {checking ? "Checking..." : "Run checks"}
              </button>
              <div className="grid gap-3 md:grid-cols-3">
                <StatusCard label="Camera / Mic" value={deviceStatus} />
                <StatusCard label="Backend" value={healthStatus} />
                <StatusCard label="Speech Output" value={ttsStatus} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-4">
              <SummaryRow label="Profile" value={selectedProfile.label} />
              <SummaryRow label="Support" value={`${selectedProfile.incoming[0]} + ${selectedProfile.outgoing[0]}`} />
              <SummaryRow label="Text Size" value={`${settings.textScale}%`} />
              <SummaryRow label="High Contrast" value={settings.highContrast ? "Enabled" : "Disabled"} />
              <SummaryRow label="Audio Prompts" value={settings.audioPrompts ? "Enabled" : "Disabled"} />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-cyan-400 px-5 py-2 text-lg font-semibold text-slate-950 hover:bg-cyan-300"
            >
              {step === STEP_TITLES.length - 1 ? "Finish setup" : "Continue"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-100">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  );
}

function ProfilePreview({ profileId }: { profileId: UserProfileId }) {
  if (profileId === "blind") {
    const preview = textToBrailleCells("You can now read braille!").slice(0, 8);
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="mb-2 text-sm text-slate-300">Braille display</p>
          <div className="overflow-x-auto whitespace-nowrap">
            {preview.map((cell, index) => (
              <BrailleCell key={`blind-preview-${index}`} pattern={cell} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <span className="h-2 w-2 rounded-full bg-cyan-300" />
          <span className="h-3 w-1 rounded bg-cyan-300/80" />
          <span className="h-5 w-1 rounded bg-cyan-300/80" />
          <span className="h-4 w-1 rounded bg-cyan-300/80" />
          <p className="ml-2 text-sm text-slate-300">Audio cue active</p>
        </div>
      </div>
    );
  }

  if (profileId === "deaf") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Caption preview</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">Please open the document on page five.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-sm text-slate-200">
          Tone: Calm / Informative
        </div>
      </div>
    );
  }

  if (profileId === "mute") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Quick response preview</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-200">Please repeat slowly</span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-200">I agree</span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-200">One moment</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
          Speech output: &quot;Hello everyone, I can hear you clearly.&quot;
        </div>
      </div>
    );
  }

  const preview = textToBrailleCells("You can now read braille!").slice(0, 10);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-cyan-400 bg-slate-900/70 p-3">
        <p className="mb-2 text-sm text-slate-300">Braille output</p>
        <div className="overflow-x-auto whitespace-nowrap">
          {preview.map((cell, index) => (
            <BrailleCell key={`deafblind-preview-${index}`} pattern={cell} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
        Caption line: &quot;Meeting starts in 2 minutes.&quot;
      </div>
    </div>
  );
}
