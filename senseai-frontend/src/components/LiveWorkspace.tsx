"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { textToBrailleCells, type BrailleCellPattern } from "@/braille/mapping";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { useVoiceCommands, type VoiceCommand } from "@/hooks/useVoiceCommands";
import { getProfile, type UserProfileId } from "@/lib/profile";
import { writeSessionSummary } from "@/lib/session";
import { speakText } from "@/lib/tts";

type SignPrediction = {
  type: "sign_prediction";
  sign: string;
  confidence: number;
  is_new_sign: boolean;
  sentence_in_progress?: string;
};

type WsPayload =
  | SignPrediction
  | { type: "buffering"; frames_collected: number; frames_needed: number }
  | { type: "error"; message: string };

const REPLIES_BY_SIGN: Record<string, string[]> = {
  Hello: ["Hello everyone", "Thanks for waiting", "Ready to continue"],
  Thank_You: ["Thank you", "Appreciated", "Understood, thank you"],
  Help: ["Please clarify that", "Can you repeat more slowly?", "I need assistance with this point"],
  Yes: ["Yes", "Confirmed", "That works"],
  No: ["No", "That does not work", "Please adjust this"],
};

export function LiveWorkspace({
  profileId,
  wsUrl,
  apiKey,
  sessionId,
}: {
  profileId: UserProfileId;
  wsUrl: string;
  apiKey: string;
  sessionId: string;
}) {
  const profile = getProfile(profileId);
  const router = useRouter();
  usePageAudioGuide(
    `${profile.label} live workspace. Turn camera on, start streaming, and use quick replies for faster responses.`
  );

  const wsEndpoint = useMemo(() => {
    const url = new URL(`${wsUrl.replace(/\/$/, "")}/ws/sign-detection`);
    if (apiKey.trim()) url.searchParams.set("api_key", apiKey.trim());
    return url.toString();
  }, [apiKey, wsUrl]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());

  const [cameraOn, setCameraOn] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [latestSign, setLatestSign] = useState("Waiting for prediction...");
  const [confidence, setConfidence] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [brailleCells, setBrailleCells] = useState<BrailleCellPattern[]>([]);
  const [buffering, setBuffering] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [customReply, setCustomReply] = useState("");
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState("Voice commands live");

  const useBraille = profileId === "blind" || profileId === "deafblind";
  const speakIncoming = profileId === "blind";
  const showCaptionFeed = profileId === "deaf" || profileId === "mute" || profileId === "deafblind";

  const { isConnected, connect, disconnect, sendJSON } = useWebSocket({
    url: wsEndpoint,
    autoConnect: true,
    onMessage: (data) => {
      if (!data || typeof data !== "object" || !("type" in data)) return;
      const payload = data as WsPayload;

      if (payload.type === "buffering") {
        setBuffering(`Buffering ${payload.frames_collected}/${payload.frames_needed}`);
        return;
      }

      if (payload.type === "error") {
        setErrors((prev) => [...prev.slice(-5), payload.message]);
        return;
      }

      setBuffering("");
      const cleanSign = payload.sign.replace(/_/g, " ");
      setLatestSign(cleanSign);
      setConfidence(payload.confidence);
      if (payload.is_new_sign) {
        setTranscript((prev) => [...prev, cleanSign]);
        if (useBraille) {
          setBrailleCells((prev) => [...prev, ...textToBrailleCells(`${cleanSign} `)]);
        }
        if (speakIncoming) speakText(cleanSign);
      }
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch {
      setErrors((prev) => [...prev.slice(-5), "Camera permission denied"]);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setStreaming(false);
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!streaming) {
      if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
      return;
    }

    frameTimerRef.current = window.setInterval(() => {
      if (!isConnected || !videoRef.current || !canvasRef.current) return;
      const width = videoRef.current.videoWidth || 640;
      const height = videoRef.current.videoHeight || 480;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      const frame = canvasRef.current.toDataURL("image/jpeg", 0.7).split(",", 2)[1];
      sendJSON({ type: "frame", frame });
    }, 120);

    return () => {
      if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    };
  }, [isConnected, sendJSON, streaming]);

  const quickReplies = useMemo(() => {
    const bySign = REPLIES_BY_SIGN[latestSign.replace(/\s/g, "_")] || [];
    if (bySign.length > 0) return bySign;
    return ["Please continue", "Can you repeat that?", "I understand"];
  }, [latestSign]);

  const sendReply = (reply: string) => {
    setQuickRepliesUsed((prev) => prev + 1);
    if (useBraille) {
      setBrailleCells((prev) => [...prev, ...textToBrailleCells(`${reply} `)]);
    }
    speakText(reply);
  };

  const voiceCommands: VoiceCommand[] = [
    { phrases: ["camera on", "turn camera on"], action: () => startCamera() },
    { phrases: ["camera off", "turn camera off"], action: () => stopCamera() },
    { phrases: ["start streaming", "stream on"], action: () => setStreaming(true) },
    { phrases: ["pause streaming", "stop streaming", "stream off"], action: () => setStreaming(false) },
    { phrases: ["reconnect", "connect socket"], action: () => connect() },
    { phrases: ["disconnect", "disconnect socket"], action: () => disconnect() },
    { phrases: ["end session", "finish session"], action: () => endSession() },
    { phrases: ["reply one", "first reply"], action: () => quickReplies[0] && sendReply(quickReplies[0]) },
    { phrases: ["reply two", "second reply"], action: () => quickReplies[1] && sendReply(quickReplies[1]) },
    { phrases: ["reply three", "third reply"], action: () => quickReplies[2] && sendReply(quickReplies[2]) },
  ];

  useVoiceCommands({
    enabled: voiceEnabled,
    commands: voiceCommands,
    onHeard: (transcript) => setVoiceStatus(`Heard: ${transcript}`),
  });

  const endSession = () => {
    stopCamera();
    disconnect();
    writeSessionSummary({
      sessionId,
      profileId,
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      transcript,
      lastSign: latestSign,
      quickRepliesUsed,
    });
    router.push(`/session/${sessionId}/summary`);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Live Session</p>
          <h1 className="mt-1 text-4xl font-semibold text-slate-50">{profile.label} workspace</h1>
          <p className="mt-2 max-w-2xl text-slate-300">{profile.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <AudioAssistButton text={`${profile.label} live workspace. Use conversation input controls and predictive quick replies.`} />
          <Link href="/settings" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200">
            Settings
          </Link>
          <button
            type="button"
            onClick={() => setVoiceEnabled((prev) => !prev)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
          >
            Voice: {voiceEnabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={endSession}
            className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-400"
          >
            End session
          </button>
        </div>
      </header>
      <p className="mb-4 text-sm text-slate-300">{voiceStatus}</p>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-2xl font-semibold text-slate-100">Conversation input</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <video ref={videoRef} className="aspect-[16/9] w-full object-cover" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={cameraOn ? stopCamera : startCamera} className="rounded-lg border border-slate-500 px-4 py-2">
              {cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
            <button
              type="button"
              disabled={!cameraOn}
              onClick={() => setStreaming((prev) => !prev)}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-70"
            >
              {streaming ? "Pause streaming" : "Start streaming"}
            </button>
            <button type="button" onClick={isConnected ? disconnect : connect} className="rounded-lg border border-slate-500 px-4 py-2">
              {isConnected ? "Disconnect socket" : "Reconnect socket"}
            </button>
          </div>
          {buffering && <p className="mt-3 text-sm text-amber-300">{buffering}</p>}
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-2xl font-semibold text-slate-100">Predictive quick replies</h2>
          <div className="mt-4 grid gap-2">
            {quickReplies.map((reply) => (
              <button key={reply} type="button" onClick={() => sendReply(reply)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-left hover:border-cyan-300">
                {reply}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm text-slate-300">
            Custom reply
            <input value={customReply} onChange={(event) => setCustomReply(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" />
          </label>
          <button
            type="button"
            onClick={() => {
              const trimmed = customReply.trim();
              if (!trimmed) return;
              sendReply(trimmed);
              setCustomReply("");
            }}
            className="mt-2 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
          >
            Send custom reply
          </button>
        </section>
      </section>

      <section className="mt-6 space-y-4">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-2xl font-semibold text-slate-100">
            {profileId === "deaf" || profileId === "mute"
              ? "Current interpretation (tone + captions)"
              : "Current interpretation"}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className={`font-semibold text-cyan-300 ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>{latestSign}</p>
            <p className="text-slate-300">Confidence: {Math.round(confidence * 100)}%</p>
          </div>
        </section>

        {showCaptionFeed && (
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-semibold text-slate-100">Caption output</h2>
            {transcript.length === 0 ? (
              <p className="mt-2 text-slate-400">No stable signs yet.</p>
            ) : (
              <p className="mt-2 text-slate-200">{transcript.join(" ")}</p>
            )}
          </section>
        )}

        {useBraille && (
          <section className="rounded-2xl border border-cyan-500 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-semibold text-slate-100">Braille output</h2>
            <div className="mt-3 overflow-x-auto whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 p-3">
              {brailleCells.length === 0 ? (
                <span className="text-slate-400">Waiting for conversation...</span>
              ) : (
                brailleCells.map((cell, index) => <BrailleCell key={`braille-${index}`} pattern={cell} />)
              )}
            </div>
          </section>
        )}

        {errors.length > 0 && (
          <section className="rounded-2xl border border-rose-700 bg-rose-950/40 p-5">
            <h2 className="text-xl font-semibold text-rose-100">Recent errors</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100">
              {errors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
