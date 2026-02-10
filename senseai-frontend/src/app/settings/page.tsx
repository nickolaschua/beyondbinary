"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { applyUserSettings, clampTextScale } from "@/lib/accessibility";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { useVoiceCommands, type VoiceCommand } from "@/hooks/useVoiceCommands";
import {
  DEFAULT_SETTINGS,
  PROFILES,
  readUserConfig,
  writeUserConfig,
  type UserProfileId,
  type UserSettings,
} from "@/lib/profile";

const TEXT_SIZE_STEPS = [90, 100, 110, 120, 130, 140];
const TEXT_SIZE_LABELS = ["Compact", "Default", "Large", "X-Large", "XX-Large", "Max"];

export default function SettingsPage() {
  const initialConfig = readUserConfig();
  const [profileId, setProfileId] = useState<UserProfileId>(initialConfig?.profileId ?? "deafblind");
  const [settings, setSettings] = useState<UserSettings>(initialConfig?.settings ?? DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState("Voice commands live");

  usePageAudioGuide("Settings page. Choose user profile and accessibility options.");

  const selectedScaleIndex = Math.max(
    0,
    TEXT_SIZE_STEPS.findIndex((size) => size === settings.textScale)
  );

  const onSave = () => {
    writeUserConfig({ profileId, settings });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const updateSettings = (next: UserSettings) => {
    setSettings(next);
    applyUserSettings(next);
  };

  const voiceCommands: VoiceCommand[] = [
    { phrases: ["save", "save settings"], action: () => onSave() },
    { phrases: ["back", "go back", "start"], action: () => window.location.assign("/start") },
    { phrases: ["blind"], action: () => setProfileId("blind") },
    { phrases: ["deafblind", "deaf blind"], action: () => setProfileId("deafblind") },
    { phrases: ["deaf"], action: () => setProfileId("deaf") },
    { phrases: ["mute"], action: () => setProfileId("mute") },
    {
      phrases: ["contrast on", "enable contrast"],
      action: () => updateSettings({ ...settings, highContrast: true }),
    },
    {
      phrases: ["contrast off", "disable contrast"],
      action: () => updateSettings({ ...settings, highContrast: false }),
    },
    {
      phrases: ["audio on", "enable audio prompts"],
      action: () => updateSettings({ ...settings, audioPrompts: true }),
    },
    {
      phrases: ["audio off", "disable audio prompts"],
      action: () => updateSettings({ ...settings, audioPrompts: false }),
    },
    {
      phrases: ["large text", "text large"],
      action: () => updateSettings({ ...settings, textScale: clampTextScale(120) }),
    },
    {
      phrases: ["default text", "text default"],
      action: () => updateSettings({ ...settings, textScale: clampTextScale(100) }),
    },
  ];

  useVoiceCommands({
    enabled: voiceEnabled && settings.audioPrompts,
    commands: voiceCommands,
    onHeard: (transcript) => setVoiceStatus(`Heard: ${transcript}`),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Accessibility</p>
          <h1 className="mt-1 text-4xl font-semibold text-slate-50">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <AudioAssistButton text="Settings page. Adjust profile and accessibility, then save." />
          <Link href="/start" className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200">
            Back
          </Link>
          <button
            type="button"
            onClick={() => setVoiceEnabled((prev) => !prev)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200"
          >
            Voice: {voiceEnabled ? "On" : "Off"}
          </button>
        </div>
      </header>
      <p className="mb-4 text-sm text-slate-300">{voiceStatus}</p>

      <section className="space-y-4">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-slate-100">User profile</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setProfileId(profile.id)}
                className={`rounded-lg border p-3 text-left ${
                  profile.id === profileId ? "border-cyan-400 bg-slate-800" : "border-slate-700 bg-slate-950"
                }`}
              >
                <p className="font-semibold text-slate-100">{profile.label}</p>
                <p className="text-sm text-slate-300">{profile.description}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Display and guidance</h2>
          <div className="mt-4 space-y-5">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-200">
                Text size: {settings.textScale}% ({TEXT_SIZE_LABELS[selectedScaleIndex]})
              </p>
              <input
                type="range"
                min={0}
                max={TEXT_SIZE_STEPS.length - 1}
                step={1}
                value={selectedScaleIndex}
                onChange={(event) => {
                  const index = Number(event.target.value);
                  updateSettings({
                    ...settings,
                    textScale: clampTextScale(TEXT_SIZE_STEPS[index] ?? 100),
                  });
                }}
                className="w-full accent-slate-300"
              />
              <div className="mt-3 grid grid-cols-6 text-center text-sm text-slate-400">
                {TEXT_SIZE_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        ...settings,
                        textScale: clampTextScale(TEXT_SIZE_STEPS[index] ?? 100),
                      })
                    }
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
              onChange={(checked) => updateSettings({ ...settings, highContrast: checked })}
            />
            <ToggleSwitch
              label="Audio prompts enabled"
              checked={settings.audioPrompts}
              onChange={(checked) => updateSettings({ ...settings, audioPrompts: checked })}
            />
          </div>
        </article>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-cyan-400 px-5 py-2 text-lg font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Save settings
        </button>
        {saved && <p className="text-emerald-300">Saved</p>}
      </div>
    </main>
  );
}
