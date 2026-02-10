"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, MapPinned, SlidersHorizontal, UserRound, Wrench } from "lucide-react";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { ToggleSwitch } from "@/components/ToggleSwitch";
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
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
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
  "Choose your profile and preview support.",
  "Set text size and guidance options.",
  "Run quick device and backend checks.",
  "Confirm and finish setup.",
];

const STEP_ICONS = [UserRound, SlidersHorizontal, Wrench, MapPinned];
const INTRO_MESSAGE = "Hey there! I am SenseAI. I am here to help you with our onboarding process!";

const TEXT_SIZE_STEPS = [90, 100, 110, 120, 130, 140];
const TEXT_SIZE_LABELS = ["Compact", "Default", "Large", "X-Large", "XX-Large", "Max"];

export default function OnboardingPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [profileId, setProfileId] = useState<UserProfileId>("deafblind");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [checking, setChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState("Not checked");
  const [deviceStatus, setDeviceStatus] = useState("Not checked");
  const [ttsStatus, setTtsStatus] = useState("Not checked");
  const introAudioQueuedRef = useRef(false);

  const selectedProfile = useMemo(
    () => PROFILES.find((profile) => profile.id === profileId) ?? PROFILES[0],
    [profileId]
  );

  const selectedScaleIndex = Math.max(
    0,
    TEXT_SIZE_STEPS.findIndex((size) => size === settings.textScale)
  );

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

    setListening(true);
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
      setListening(false);
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

  const goNext = () => {
    if (step < STEP_TITLES.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      speakGuide(STEP_HINTS[nextStep]);
      return;
    }

    writeUserConfig({ profileId, settings });
    router.push("/start");
  };

  const goBack = () => {
    const nextStep = Math.max(0, step - 1);
    setStep(nextStep);
    speakGuide(STEP_HINTS[nextStep]);
  };

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
            style={{
              border: "2px solid #F24B59",
              backgroundColor: "#FFFFFF",
              color: "#D96666",
            }}
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
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
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

          <div className="relative mt-6">
            <div className="pointer-events-none absolute right-0 top-12 bottom-12 w-10">
              <div
                className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-slate-400/60"
              />
              <div
                className="absolute left-1/2 top-0 w-0.5 -translate-x-1/2 bg-cyan-400 transition-all duration-300"
                style={{
                  height:
                    STEP_TITLES.length > 1
                      ? `${(step / (STEP_TITLES.length - 1)) * 100}%`
                      : "0%",
                }}
              />
            </div>
            <ul className="m-0 list-none p-0">
              {STEP_TITLES.map((title, index) => {
                const Icon = STEP_ICONS[index];
                const complete = index < step;
                const current = index === step;
                return (
                  <li key={title} className="grid h-24 grid-cols-[1fr_40px] items-center gap-3">
                    <div className="flex items-center gap-3 pr-2">
                      <Icon
                        className={`h-5 w-5 ${
                          current || complete ? "text-sky-300" : "text-slate-500"
                        }`}
                      />
                      <div>
                        <p className={`text-sm ${current || complete ? "text-sky-200" : "text-slate-400"}`}>
                          Step {index + 1}
                        </p>
                        <p
                          className={`font-semibold ${
                            current ? "text-slate-100" : complete ? "text-slate-200" : "text-slate-400"
                          }`}
                        >
                          {title}
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10 flex h-24 w-10 items-center justify-center">
                      {complete ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400 text-slate-950">
                          <CircleCheckBig className="h-4 w-4" />
                        </span>
                      ) : current ? (
                        <span className="block h-8 w-8 rounded-full border-2 border-sky-300 bg-slate-900" />
                      ) : (
                        <span className="block h-8 w-8 rounded-full bg-slate-500/70" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-4 text-sm text-slate-300">{STEP_HINTS[step]}</p>
          <div className="mt-3">
            <AudioAssistButton text={STEP_HINTS[step]} />
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="text-3xl font-semibold text-slate-50">{STEP_TITLES[step]}</h2>

          {step === 0 && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {PROFILES.map((profile) => (
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
                    <h3 className="text-lg font-medium text-slate-100">{profile.label}</h3>
                    <p className="mt-1 text-sm text-slate-300">{profile.description}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={startVoiceSelection}
                  disabled={listening}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300 disabled:opacity-70"
                >
                  {listening ? "Listening..." : "Select profile with mic"}
                </button>
                {voiceStatus && <p className="text-sm text-slate-300">{voiceStatus}</p>}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-slate-100">Support preview: {selectedProfile.label}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Receive</p>
                    <TagList items={selectedProfile.incoming} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-slate-400">Send</p>
                    <TagList items={selectedProfile.outgoing} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-3 text-sm font-medium text-slate-200">
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
              <SummaryRow
                label="Support Preview"
                value={`${selectedProfile.incoming[0]} + ${selectedProfile.outgoing[0]}`}
              />
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

function TagList({ items }: { items: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-sm text-slate-200">
          {item}
        </span>
      ))}
    </div>
  );
}
