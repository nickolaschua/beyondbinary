"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { readSessionSummary, type SessionSummaryData } from "@/lib/session";

export default function SessionSummaryPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [data, setData] = useState<SessionSummaryData | null>(null);
  usePageAudioGuide("Session summary page. Review session details and transcript, then start a new session.");

  useEffect(() => {
    setData(readSessionSummary(sessionId));
  }, [sessionId]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Session</p>
          <h1 className="mt-1 text-4xl font-semibold text-slate-50">Summary</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/start" className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200">
            New session
          </Link>
          <Link href="/settings" className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200">
            Settings
          </Link>
        </div>
      </header>
      <div className="mb-4">
        <AudioAssistButton text="Session summary page. Review transcript and session details." />
      </div>

      {!data ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-slate-300">No summary data found for session {sessionId}.</p>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Session details</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 text-slate-200">
              <p>Session ID: {data.sessionId}</p>
              <p>Profile: {data.profileId}</p>
              <p>Started: {new Date(data.startedAt).toLocaleString()}</p>
              <p>Ended: {new Date(data.endedAt).toLocaleString()}</p>
              <p>Quick replies used: {data.quickRepliesUsed}</p>
              <p>Last sign: {data.lastSign}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Transcript</h2>
            {data.transcript.length === 0 ? (
              <p className="mt-3 text-slate-300">No transcript captured.</p>
            ) : (
              <p className="mt-3 text-slate-200">{data.transcript.join(" ")}</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
