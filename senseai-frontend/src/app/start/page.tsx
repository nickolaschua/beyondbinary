"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { API_URL, WS_URL } from "@/lib/constants";
import { getProfile, readUserConfig, writeUserConfig } from "@/lib/profile";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";

type MeetingSource = "local" | "zoom" | "meet" | "teams";

interface HealthPayload {
  status: string;
  model_loaded: boolean;
  avg_inference_ms: number;
}

export default function StartMeetingPage() {
  const router = useRouter();
  const [source, setSource] = useState<MeetingSource>("local");
  const apiUrl = API_URL;
  const wsUrl = WS_URL;
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [cameraReady, setCameraReady] = useState<boolean | null>(null);
  const [microphoneReady, setMicrophoneReady] = useState<boolean | null>(null);

  const config = useMemo(() => readUserConfig(), []);
  const profile = config ? getProfile(config.profileId) : null;

  usePageAudioGuide("Start page. Choose input source, confirm readiness, and start your meeting.");

  useEffect(() => {
    if (!config) router.replace("/onboarding");
  }, [config, router]);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setHealthError(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/health`, { cache: "no-store" });
      if (!response.ok) {
        setHealthError(`Health endpoint returned ${response.status}`);
      } else {
        setHealth((await response.json()) as HealthPayload);
      }
    } catch {
      setHealthError("Backend is not reachable.");
      setHealth(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraReady(stream.getVideoTracks().length > 0);
      setMicrophoneReady(stream.getAudioTracks().length > 0);
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setCameraReady(false);
      setMicrophoneReady(false);
    } finally {
      setChecking(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  if (!profile || !config) return null;

  const startMeeting = () => {
    writeUserConfig(config);
    const sessionId = `${Date.now()}`;
    const query = new URLSearchParams({
      api: apiUrl,
      ws: wsUrl,
      source,
      sid: sessionId,
    });
    router.push(`/live/${profile.id}?${query.toString()}`);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Meeting Setup</p>
          <h1 className="mt-1 text-4xl font-semibold text-slate-50">Start Session</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            Profile: <span className="font-semibold text-slate-100">{profile.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AudioAssistButton text="Start session page. Check status and press start session." />
          <Link href="/settings" className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200">
            Settings
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Input source</h2>
          <div className="mt-4 space-y-2">
            <SourceOption
              selected={source === "local"}
              onSelect={() => setSource("local")}
              title="Local webcam + microphone"
              description="Active in this release"
            />
            <SourceOption
              selected={source === "zoom"}
              onSelect={() => setSource("zoom")}
              title="Zoom"
              description="Planned"
              disabled
            />
            <SourceOption
              selected={source === "meet"}
              onSelect={() => setSource("meet")}
              title="Google Meet"
              description="Planned"
              disabled
            />
            <SourceOption
              selected={source === "teams"}
              onSelect={() => setSource("teams")}
              title="Microsoft Teams"
              description="Planned"
              disabled
            />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Readiness</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ReadinessCard
              title="Backend"
              status={health?.status === "ok" && health.model_loaded}
              detail={health ? `${health.avg_inference_ms ?? 0} ms` : healthError || "Unavailable"}
            />
            <ReadinessCard
              title="Camera"
              status={cameraReady === true}
              detail={cameraReady === true ? "Ready" : cameraReady === false ? "Needs access" : "Checking"}
            />
            <ReadinessCard
              title="Microphone"
              status={microphoneReady === true}
              detail={
                microphoneReady === true ? "Ready" : microphoneReady === false ? "Needs access" : "Checking"
              }
            />
            <ReadinessCard title="Profile Output" status detail={profile.incoming[0]} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runChecks}
              disabled={checking}
              className="rounded-lg border border-slate-500 px-4 py-2 text-slate-100 hover:border-slate-300 disabled:opacity-70"
            >
              {checking ? "Checking..." : "Run checks"}
            </button>
            <button
              type="button"
              onClick={startMeeting}
              className="rounded-lg bg-cyan-400 px-5 py-2 text-lg font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Start session
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

function SourceOption({
  selected,
  onSelect,
  title,
  description,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full rounded-lg border p-3 text-left ${
        selected ? "border-cyan-400 bg-slate-800" : "border-slate-700 bg-slate-950"
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="text-sm text-slate-300">{description}</p>
    </button>
  );
}

function ReadinessCard({ title, status, detail }: { title: string; status: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
      <p className="text-sm uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <p className={`mt-1 text-base font-semibold ${status ? "text-emerald-300" : "text-amber-300"}`}>
        {status ? "Ready" : "Needs attention"}
      </p>
      <p className="mt-1 text-sm text-slate-300">{detail}</p>
    </div>
  );
}
