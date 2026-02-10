"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { textToBrailleCells, type BrailleCellPattern } from "@/braille/mapping";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { useVoiceCommands, type VoiceCommand } from "@/hooks/useVoiceCommands";
import { getProfile, type UserProfileId } from "@/lib/profile";
import { writeSessionSummary } from "@/lib/session";
import { speakText, pushTtsChunk, startNewTtsStream } from "@/lib/tts";

const AUDIO_CHUNK_INTERVAL_MS = 1500;
const hasSpeechRecognition =
  typeof window !== "undefined" && !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

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
  | { type: "error"; message: string }
  | { type: "sentence_complete"; sentence: string; word_count?: number };

type BackendQuickReply = { label: string; spoken_text: string };
type ConversationLine = { text: string; tone?: string };
type ChatMessage = { sender: "local" | "remote"; text: string; tts?: boolean };

const REPLIES_BY_SIGN: Record<string, string[]> = {
  Hello: ["Hello everyone", "Thanks for waiting", "Ready to continue"],
  Thank_You: ["Thank you", "Appreciated", "Understood, thank you"],
  Help: ["Please clarify that", "Can you repeat more slowly?", "I need assistance with this point"],
  Yes: ["Yes", "Confirmed", "That works"],
  No: ["No", "That does not work", "Please adjust this"],
};

export function LiveWorkspace({
  profileId,
  apiUrl,
  wsUrl,
  apiKey,
  sessionId,
}: {
  profileId: UserProfileId;
  apiUrl: string;
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

  const conversationWsUrl = useMemo(
    () => `${apiUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/conversation`,
    [apiUrl]
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [latestSign, setLatestSign] = useState("Sign (stub)");
  const [confidence, setConfidence] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [conversationTranscript, setConversationTranscript] = useState<ConversationLine[]>([]);
  const [convStatus, setConvStatus] = useState<string>("");
  const [backendQuickReplies, setBackendQuickReplies] = useState<BackendQuickReply[]>([]);
  const [simplifiedText, setSimplifiedText] = useState("");
  const [lastConvTone, setLastConvTone] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
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
  const wantsTts = profileId === "blind";

  const handleConvMessage = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== "object" || !("type" in data)) return;
      const msg = data as Record<string, unknown>;
      const type = String(msg.type);

      switch (type) {
        case "transcript":
          if (msg.text != null) {
            setConversationTranscript((prev) => [...prev, { text: String(msg.text), tone: msg.tone != null ? String(msg.tone) : undefined }]);
          }
          break;
        case "utterance_created":
          if (msg.text != null) {
            const tone = msg.tone as { label?: string } | undefined;
            setConversationTranscript((prev) => [...prev, { text: String(msg.text), tone: tone?.label }]);
            if (tone?.label) setLastConvTone(tone.label);
          }
          break;
        case "tone_update":
          if (msg.tone != null) setLastConvTone(String(msg.tone));
          break;
        case "simplified":
          if (msg.text != null) setSimplifiedText(String(msg.text));
          if (Array.isArray(msg.quick_replies)) setBackendQuickReplies(msg.quick_replies as BackendQuickReply[]);
          break;
        case "summary":
          if (msg.text != null && profileId === "blind") speakText(String(msg.text), apiUrl);
          break;
        case "chat_message":
          setChatMessages((prev) => [...prev, { sender: (msg.sender as "local" | "remote") ?? "remote", text: String(msg.text ?? ""), tts: Boolean(msg.tts) }]);
          if (msg.sender === "remote" && msg.tts) startNewTtsStream();
          break;
        case "tts_audio_chunk":
          if (msg.audio_base64) pushTtsChunk(String(msg.audio_base64));
          break;
        case "tts_audio_end":
          break;
        case "status":
          setConvStatus(String(msg.message ?? ""));
          break;
        case "error":
          setErrors((prev) => [...prev.slice(-5), String(msg.message ?? "Unknown error")]);
          break;
        default:
          break;
      }
    },
    [apiUrl, profileId]
  );

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

      if (payload.type === "sentence_complete") {
        // Handled in Task 2
        return;
      }

      setBuffering("");
      const cleanSign = payload.sign.replace(/_/g, " ");
      setLatestSign(cleanSign);
      setConfidence(payload.confidence);
      if (payload.is_new_sign && !(payload as SignPrediction & { _mock?: boolean })._mock) {
        setTranscript((prev) => [...prev, cleanSign]);
        if (useBraille) {
          setBrailleCells((prev) => [...prev, ...textToBrailleCells(`${cleanSign} `)]);
        }
        if (speakIncoming) speakText(cleanSign, apiUrl);
      }
    },
  });

  const {
    isConnected: convConnected,
    connect: connectConv,
    disconnect: disconnectConv,
    sendJSON: sendConvJSON,
  } = useWebSocket({
    url: conversationWsUrl,
    autoConnect: true,
    onMessage: handleConvMessage,
  });

  const backendProfileType = profileId === "blind" ? "blind" : "deaf";

  useEffect(() => {
    if (!convConnected || !sendConvJSON) return;
    sendConvJSON({ type: "set_profile", profile_type: backendProfileType });
    sendConvJSON({ type: "set_room", room: sessionId });
    sendConvJSON({ type: "set_tts_preference", value: wantsTts });
    sendConvJSON({ type: "start_listening", use_web_speech: hasSpeechRecognition });
  }, [convConnected, backendProfileType, sessionId, wantsTts, sendConvJSON]);

  const startSendingAudio = useCallback(() => {
    if (!mediaStreamRef.current || !sendConvJSON) return;
    const stream = mediaStreamRef.current;
    const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const options = mimeType ? { mimeType, audioBitsPerSecond: 128000 } : {};
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch {
        recorder = new MediaRecorder(stream);
      }
    }
    recorder.ondataavailable = (event) => {
      if (event.data?.size && sendConvJSON) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string)?.split(",")[1];
          if (base64) sendConvJSON({ type: "audio_chunk", audio: base64, format: "webm" });
        };
        reader.readAsDataURL(event.data);
      }
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      if (chunkIntervalRef.current) clearTimeout(chunkIntervalRef.current);
      chunkIntervalRef.current = setTimeout(startSendingAudio, 0);
    };
    recorder.start();
    recorderRef.current = recorder;
    if (chunkIntervalRef.current) clearTimeout(chunkIntervalRef.current);
    chunkIntervalRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, AUDIO_CHUNK_INTERVAL_MS);
  }, [sendConvJSON]);

  useEffect(() => {
    if (!convConnected) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (hasSpeechRecognition && typeof (window as unknown as { SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null; start: () => void; stop: () => void } }).SpeechRecognition !== "undefined") {
          const Recognition = (window as unknown as { SpeechRecognition: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null; start: () => void; stop: () => void } }).SpeechRecognition;
          const recognition = new Recognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          recognition.onresult = (event: { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => {
            const last = event.results.length - 1;
            const result = event.results[last];
            const text = result?.[0]?.transcript?.trim();
            if (text && sendConvJSON) sendConvJSON({ type: "text_transcript", text, is_final: result?.isFinal ?? true });
          };
          recognition.start();
          recognitionRef.current = recognition;
        }
        startSendingAudio();
      })
      .catch(() => setErrors((prev) => [...prev.slice(-5), "Microphone access denied"]));
    return () => {
      if (chunkIntervalRef.current) clearTimeout(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      recorderRef.current = null;
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    };
  }, [convConnected, startSendingAudio]);

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
    if (backendQuickReplies.length > 0) return backendQuickReplies.map((r) => r.label);
    const bySign = REPLIES_BY_SIGN[latestSign.replace(/\s/g, "_")] || [];
    if (bySign.length > 0) return bySign;
    return ["Please continue", "Can you repeat that?", "I understand"];
  }, [latestSign, backendQuickReplies]);

  const getSpokenTextForReply = (label: string): string => {
    const fromBackend = backendQuickReplies.find((r) => r.label === label);
    return fromBackend?.spoken_text ?? label;
  };

  const sendReply = (replyOrLabel: string) => {
    setQuickRepliesUsed((prev) => prev + 1);
    const spokenText = backendQuickReplies.length > 0 ? getSpokenTextForReply(replyOrLabel) : replyOrLabel;
    speakText(spokenText, apiUrl);
  };

  const combinedTranscriptText = useMemo(
    () => [...conversationTranscript.map((l) => l.text), ...transcript].join(" "),
    [conversationTranscript, transcript]
  );

  useEffect(() => {
    if (!useBraille) return;
    if (!combinedTranscriptText.trim()) {
      setBrailleCells([]);
      return;
    }
    setBrailleCells(textToBrailleCells(combinedTranscriptText + " "));
  }, [combinedTranscriptText, useBraille]);

  const sendChatMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !sendConvJSON) return;
    sendConvJSON({ type: "chat_message", room: sessionId, sender: "local", text: trimmed, tts: false });
    setChatMessages((prev) => [...prev, { sender: "local", text: trimmed }]);
    setChatInput("");
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
    disconnectConv();
    const fullTranscript = [...conversationTranscript.map((l) => l.text), ...transcript];
    writeSessionSummary({
      sessionId,
      profileId,
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      transcript: fullTranscript,
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
            <h2 className="text-2xl font-semibold text-slate-100">
              {profileId === "deaf" || profileId === "mute"
                ? "Current interpretation (tone + captions)"
                : "Current interpretation"}
            </h2>
            {conversationTranscript.length > 0 ? (
              <>
                <p className={`mt-3 font-semibold text-cyan-300 ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>
                  {conversationTranscript[conversationTranscript.length - 1]?.text}
                </p>
                {lastConvTone && <p className="mt-2 text-amber-300">Tone: {lastConvTone}</p>}
              </>
            ) : (
              <>
                <p className={`mt-3 font-semibold text-cyan-300 ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>{latestSign}</p>
                <p className="mt-2 text-slate-300">Confidence: {Math.round(confidence * 100)}%</p>
              </>
            )}
            {convStatus && <p className="mt-1 text-sm text-slate-400">Status: {convStatus}</p>}
            {showCaptionFeed && (
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
                <h3 className="text-lg font-semibold text-slate-100">Caption stream</h3>
                <p className="mt-2 text-sm text-slate-500">Sign (stub)</p>
                {transcript.length > 0 && <p className="mt-1 text-slate-400">{transcript.join(" ")}</p>}
                <p className="mt-3 text-sm text-slate-500">Conversation (transcript + tone)</p>
                {conversationTranscript.length === 0 ? (
                  <p className="mt-1 text-slate-400">No speech yet. Speak to see captions.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {conversationTranscript.map((line, i) => (
                      <li key={i} className="text-slate-200">
                        {line.tone ? <span className="text-amber-300">[{line.tone}] </span> : null}
                        {line.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-semibold text-slate-100">Chat</h2>
            <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-3">
              {chatMessages.length === 0 ? (
                <p className="text-slate-400">No messages yet.</p>
              ) : (
                <ul className="space-y-2">
                  {chatMessages.map((m, i) => (
                    <li key={i} className={m.sender === "local" ? "text-right text-cyan-200" : "text-left text-slate-200"}>
                      {m.sender === "remote" ? "Remote: " : "You: "}
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="Type a message..."
              />
              <button type="button" onClick={sendChatMessage} className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
                Send
              </button>
            </div>
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
          </section>

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
