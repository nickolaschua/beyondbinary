"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { VideoCall } from "@/components/VideoCall";
import { brailleCellToCharacter, textToBrailleCells, type BrailleCellPattern } from "@/braille/mapping";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { getProfile, type UserProfileId } from "@/lib/profile";
import { writeSessionSummary } from "@/lib/session";
import { speakText, pushTtsChunk, startNewTtsStream } from "@/lib/tts";
import { getToneDisplay } from "@/lib/toneDisplay";

const AUDIO_CHUNK_INTERVAL_MS = 1500;
const USE_BROWSER_WEB_SPEECH = false;
const BRAILLE_DISPLAY_CELLS = 12;
const EMPTY_BRAILLE_CELL: BrailleCellPattern = [false, false, false, false, false, false];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function rewriteRuntimeUrl(rawUrl: string, kind: "http" | "ws"): string {
  if (typeof window === "undefined") return rawUrl;
  try {
    const url = new URL(rawUrl);
    const pageHost = window.location.hostname;
    const pageIsLocal = LOCAL_HOSTS.has(pageHost);
    const targetIsLocal = LOCAL_HOSTS.has(url.hostname);

    // In non-local access, always target backend on the same host as the page.
    // This prevents stale query params (old IPs/localhost) from breaking signaling.
    if (!pageIsLocal && url.hostname !== pageHost) {
      url.hostname = pageHost;
    } else if (targetIsLocal && !pageIsLocal) {
      url.hostname = pageHost;
    }

    if (!url.port) {
      url.port = "8000";
    }

    if (window.location.protocol === "https:") {
      if (kind === "http" && url.protocol === "http:") url.protocol = "https:";
      if (kind === "ws" && url.protocol === "ws:") url.protocol = "wss:";
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
}

function shouldInitiateOffer(localClientId: string | null, remoteClientId: string): boolean {
  if (!localClientId) return false;
  // Deterministic tie-breaker: only one side starts offer.
  return localClientId > remoteClientId;
}

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

type BackendQuickReply = { label: string; spoken_text: string };
type ConversationLine = {
  text: string;
  tone?: string;
  utteranceId?: string;
  speakerClientId?: string;
  sender?: "local" | "remote";
};
const QUICK_REPLY_MIN_REFRESH_MS = 4000;
const TONE_CONFIRM_INTERVAL_MS = 2200;
const TONE_CONFIRM_WINDOW_MS = 7000;
const TONE_CONFIRM_MIN_CONFIDENCE = 0.35;
type PendingToneSample = { tone: string; confidence: number; at: number; utteranceId?: string };

const hasSpeechRecognition =
  typeof window !== "undefined" && !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
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
    `${profile.label} live workspace. Turn camera on to stream sign detection; use quick replies for faster responses.`
  );

  // When page is loaded over HTTPS, upgrade backend URLs to https/wss (mixed content rule)
  const effectiveApiUrl = useMemo(() => {
    return rewriteRuntimeUrl(apiUrl, "http");
  }, [apiUrl]);
  const effectiveWsUrl = useMemo(() => {
    return rewriteRuntimeUrl(wsUrl, "ws");
  }, [wsUrl]);

  const wsEndpoint = useMemo(() => {
    const url = new URL(`${effectiveWsUrl.replace(/\/$/, "")}/ws/sign-detection`);
    if (apiKey.trim()) url.searchParams.set("api_key", apiKey.trim());
    return url.toString();
  }, [apiKey, effectiveWsUrl]);

  const conversationWsUrl = useMemo(
    () => `${effectiveApiUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/conversation`,
    [effectiveApiUrl]
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const startSendingAudioRef = useRef<() => void>(() => {});
  const lastQuickReplyUpdateRef = useRef<number>(0);
  const pendingWebRtcOfferRef = useRef<{ fromPeerId: string; offer: RTCSessionDescriptionInit } | null>(null);
  const pendingWebRtcAnswerRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingWebRtcCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const shouldCreateOfferRef = useRef(false);
  const hasCreatedOfferForPeerRef = useRef<string | null>(null);
  const localClientIdRef = useRef<string | null>(null);
  const toneSamplesRef = useRef<PendingToneSample[]>([]);

  const [cameraOn, setCameraOn] = useState(false);
  const NO_SIGN_YET = "—";
  const [latestSign, setLatestSign] = useState(NO_SIGN_YET);
  const [confidence, setConfidence] = useState(0);
  const [hasReceivedSign, setHasReceivedSign] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [conversationTranscript, setConversationTranscript] = useState<ConversationLine[]>([]);
  const [convStatus, setConvStatus] = useState<string>("");
  const [backendQuickReplies, setBackendQuickReplies] = useState<BackendQuickReply[]>([]);
  const [simplifiedText, setSimplifiedText] = useState("");
  const [lastConvTone, setLastConvTone] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [buffering, setBuffering] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [customReply, setCustomReply] = useState("");
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(0);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [localClientId, setLocalClientId] = useState<string | null>(null);
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(null);
  const [webrtcTrigger, setWebrtcTrigger] = useState(0);

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
            const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
            const speakerClientId = msg.speaker_client_id != null ? String(msg.speaker_client_id) : undefined;
            const sender = msg.sender != null ? String(msg.sender) : "unknown";
            const normalizedSender: "local" | "remote" = sender === "remote" ? "remote" : "local";
            console.log("[ConvWS] transcript received", {
              sender,
              speakerClientId,
              localClientId: localClientIdRef.current,
              utteranceId,
              text: String(msg.text),
            });
            setConversationTranscript((prev) => {
              if (!utteranceId) {
                return [
                  ...prev,
                  {
                    text: String(msg.text),
                    tone: msg.tone != null ? String(msg.tone) : undefined,
                    utteranceId,
                    speakerClientId,
                    sender: normalizedSender,
                  },
                ];
              }

              const idx = prev.findIndex((line) => line.utteranceId === utteranceId);
              if (idx === -1) {
                return [
                  ...prev,
                  {
                    text: String(msg.text),
                    tone: msg.tone != null ? String(msg.tone) : undefined,
                    utteranceId,
                    speakerClientId,
                    sender: normalizedSender,
                  },
                ];
              }

              const next = [...prev];
              next[idx] = {
                ...next[idx],
                text: String(msg.text),
                tone: msg.tone != null ? String(msg.tone) : next[idx].tone,
                speakerClientId: speakerClientId ?? next[idx].speakerClientId,
                sender: normalizedSender,
              };
              return next;
            });
          }
          break;
        case "utterance_created":
          if (msg.text != null) {
            const tone = msg.tone as { label?: string; confidence?: number | string } | undefined;
            const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
            const speakerClientId = msg.speaker_client_id != null ? String(msg.speaker_client_id) : undefined;
            const sender = msg.sender != null ? String(msg.sender) : "unknown";
            const normalizedSender: "local" | "remote" = sender === "remote" ? "remote" : "local";
            console.log("[ConvWS] utterance_created received", {
              sender,
              speakerClientId,
              localClientId: localClientIdRef.current,
              utteranceId,
              tone: tone?.label,
              text: String(msg.text),
            });
            setConversationTranscript((prev) => {
              if (!utteranceId) {
                return [...prev, { text: String(msg.text), tone: tone?.label, utteranceId, speakerClientId, sender: normalizedSender }];
              }

              const idx = prev.findIndex((line) => line.utteranceId === utteranceId);
              if (idx === -1) {
                return [...prev, { text: String(msg.text), tone: tone?.label, utteranceId, speakerClientId, sender: normalizedSender }];
              }

              const next = [...prev];
              next[idx] = {
                ...next[idx],
                text: String(msg.text),
                tone: tone?.label ?? next[idx].tone,
                speakerClientId: speakerClientId ?? next[idx].speakerClientId,
                sender: normalizedSender,
              };
              return next;
            });
            if (tone?.label) {
              if (profileId === "deaf") {
                const toneConfidence = Number(tone.confidence ?? 0);
                const confidence = Number.isFinite(toneConfidence) ? toneConfidence : 0;
                toneSamplesRef.current.push({
                  tone: tone.label,
                  confidence,
                  at: Date.now(),
                  utteranceId,
                });
                console.log("[ToneConfirm] queued from utterance_created", {
                  tone: tone.label,
                  confidence,
                  utteranceId,
                });
              } else {
                setLastConvTone(tone.label);
              }
            }
          }
          break;
        case "tone_update": {
          const toneStr = msg.tone != null ? String(msg.tone) : null;
          const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
          if (utteranceId && toneStr) {
            setConversationTranscript((prev) =>
              prev.map((line) => (line.utteranceId === utteranceId ? { ...line, tone: toneStr } : line))
            );
          }
          if (toneStr) {
            if (profileId === "deaf") {
              const toneConfidence = Number(msg.tone_confidence ?? 0);
              const confidence = Number.isFinite(toneConfidence) ? toneConfidence : 0;
              toneSamplesRef.current.push({
                tone: toneStr,
                confidence,
                at: Date.now(),
                utteranceId,
              });
              console.log("[ToneConfirm] queued from tone_update", {
                tone: toneStr,
                confidence,
                utteranceId,
              });
            } else {
              setLastConvTone(toneStr);
            }
          }
          break;
        }
        case "simplified":
          if (msg.text != null) setSimplifiedText(String(msg.text));
          if (Array.isArray(msg.quick_replies)) {
            const sender = msg.sender != null ? String(msg.sender) : "local";
            const shouldUseReplies = remotePeerId ? sender === "remote" : sender !== "remote";
            if (!shouldUseReplies) {
              console.log("[QuickReplies] ignored", { sender, remotePeerId });
              break;
            }
            const now = Date.now();
            const nextReplies = (msg.quick_replies as BackendQuickReply[])
              .map((r) => ({
                label: String(r.label ?? "").trim(),
                spoken_text: String(r.spoken_text ?? "").trim(),
              }))
              .filter((r) => r.label.length > 0)
              .slice(0, 4);

            if (nextReplies.length > 0) {
              const shouldRefresh = now - lastQuickReplyUpdateRef.current >= QUICK_REPLY_MIN_REFRESH_MS;
              setBackendQuickReplies((prev) => {
                if (prev.length > 0 && !shouldRefresh) return prev;
                lastQuickReplyUpdateRef.current = now;
                console.log("[QuickReplies] updated", { sender, count: nextReplies.length });
                return nextReplies;
              });
            }
          }
          break;
        case "summary":
          if (msg.text != null && profileId === "blind") speakText(String(msg.text), effectiveApiUrl);
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
        case "connection_ready": {
          const clientId = msg.client_id != null ? String(msg.client_id) : "";
          if (clientId) {
            localClientIdRef.current = clientId;
            setLocalClientId(clientId);
            console.log("[ConvWS] connection_ready", { clientId });
            console.log("[WebRTC] Connection ready. Local client id:", clientId);
            if (remotePeerId) {
              shouldCreateOfferRef.current = shouldInitiateOffer(localClientIdRef.current, remotePeerId);
            }
            setWebrtcTrigger((prev) => prev + 1);
          }
          break;
        }
        case "error":
          setErrors((prev) => [...prev.slice(-5), String(msg.message ?? "Unknown error")]);
          break;
        case "peer_joined": {
          const peerId = String(msg.peer_id ?? "");
          console.log("[WebRTC] Peer joined:", peerId);
          if (peerId) {
            if (peerId === remotePeerId) {
              console.log("[WebRTC] Duplicate peer_joined ignored for:", peerId);
              break;
            }
            setRemotePeerId(peerId);
            shouldCreateOfferRef.current = shouldInitiateOffer(localClientIdRef.current, peerId);
            hasCreatedOfferForPeerRef.current = null;
            setWebrtcTrigger((prev) => prev + 1);
            // Offer will be created in useEffect
          }
          break;
        }
        case "webrtc_offer": {
          const fromPeerId = String(msg.from_peer_id ?? "");
          const offer = msg.offer as RTCSessionDescriptionInit;
          console.log("[WebRTC] Received offer from:", fromPeerId);
          if (fromPeerId && offer) {
            // Callee side: do not initiate a competing offer.
            shouldCreateOfferRef.current = false;
            hasCreatedOfferForPeerRef.current = fromPeerId;
            setRemotePeerId(fromPeerId);
            // Store for async WebRTC handling
            pendingWebRtcOfferRef.current = { fromPeerId, offer };
            setWebrtcTrigger((prev) => prev + 1);
          }
          break;
        }
        case "webrtc_answer": {
          const answer = msg.answer as RTCSessionDescriptionInit;
          console.log("[WebRTC] Received answer");
          if (answer) {
            pendingWebRtcAnswerRef.current = answer;
            setWebrtcTrigger((prev) => prev + 1);
          }
          break;
        }
        case "webrtc_ice_candidate": {
          const candidate = msg.candidate as RTCIceCandidateInit;
          console.log("[WebRTC] Received ICE candidate");
          if (candidate) {
            pendingWebRtcCandidatesRef.current.push(candidate);
            setWebrtcTrigger((prev) => prev + 1);
          }
          break;
        }
        case "peer_left": {
          const leftPeerId = String(msg.peer_id ?? "");
          if (remotePeerId && leftPeerId && leftPeerId !== remotePeerId) {
            console.log("[WebRTC] Ignoring peer_left for non-active peer:", leftPeerId);
            break;
          }
          setRemotePeerId(null);
          shouldCreateOfferRef.current = false;
          hasCreatedOfferForPeerRef.current = null;
          pendingWebRtcOfferRef.current = null;
          pendingWebRtcAnswerRef.current = null;
          pendingWebRtcCandidatesRef.current = [];
          break;
        }
        default:
          break;
      }
    },
    [effectiveApiUrl, profileId, remotePeerId]
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

      setBuffering("");
      const cleanSign = payload.sign.replace(/_/g, " ");
      setLatestSign(cleanSign);
      setConfidence(payload.confidence);
      setHasReceivedSign(true);
      if (payload.is_new_sign && !(payload as SignPrediction & { _mock?: boolean })._mock) {
        setTranscript((prev) => [...prev, cleanSign]);
        if (speakIncoming) speakText(cleanSign, effectiveApiUrl);
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

  useEffect(() => {
    if (profileId !== "deaf") {
      toneSamplesRef.current = [];
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      toneSamplesRef.current = toneSamplesRef.current.filter((sample) => now - sample.at <= TONE_CONFIRM_WINDOW_MS);
      if (toneSamplesRef.current.length === 0) return;

      const best = toneSamplesRef.current.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      if (best.confidence < TONE_CONFIRM_MIN_CONFIDENCE) {
        console.log("[ToneConfirm] waiting for stronger tone sample", {
          bestTone: best.tone,
          bestConfidence: best.confidence,
          sampleCount: toneSamplesRef.current.length,
        });
        return;
      }

      setLastConvTone((prev) => (prev === best.tone ? prev : best.tone));
      console.log("[ToneConfirm] confirmed", {
        tone: best.tone,
        confidence: best.confidence,
        sampleCount: toneSamplesRef.current.length,
      });
      toneSamplesRef.current = [];
    }, TONE_CONFIRM_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [profileId]);

  // Ref so async callbacks (MediaRecorder, Web Speech) always use current WS
  const sendConvJSONRef = useRef(sendConvJSON);
  useEffect(() => {
    sendConvJSONRef.current = sendConvJSON;
  }, [sendConvJSON]);

  // WebRTC hook - initialized after WebSocket hooks
  const {
    remoteStream,
    connectionState,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
  } = useWebRTC({
    localStream: localStreamState,
    onIceCandidate: (candidate) => {
      if (remotePeerId && sendConvJSON) {
        sendConvJSON({
          type: "webrtc_ice_candidate",
          target_peer_id: remotePeerId,
          candidate: candidate.toJSON(),
        });
      }
    },
  });

  // Store WebRTC handlers in refs
  const handleOfferRef = useRef(handleOffer);
  const handleAnswerRef = useRef(handleAnswer);
  const handleIceCandidateRef = useRef(handleIceCandidate);

  useEffect(() => {
    handleOfferRef.current = handleOffer;
  }, [handleOffer]);

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    handleIceCandidateRef.current = handleIceCandidate;
  }, [handleIceCandidate]);

  // Process pending WebRTC messages
  useEffect(() => {
    if (pendingWebRtcOfferRef.current) {
      const { fromPeerId, offer } = pendingWebRtcOfferRef.current;
      pendingWebRtcOfferRef.current = null;
      handleOfferRef.current(offer)
        .then((answer) => {
          const sendJSON = sendConvJSONRef.current;
          if (sendJSON) {
            sendJSON({
              type: "webrtc_answer",
              target_peer_id: fromPeerId,
              answer: answer,
            });
          }
        })
        .catch((err) => {
          console.error("[WebRTC] Failed to handle offer:", err);
          setErrors((prev) => [...prev.slice(-5), "Failed to handle WebRTC offer"]);
        });
    }

    if (pendingWebRtcAnswerRef.current) {
      const answer = pendingWebRtcAnswerRef.current;
      pendingWebRtcAnswerRef.current = null;
      handleAnswerRef.current(answer).catch((err) => {
        console.error("[WebRTC] Failed to handle answer:", err);
        setErrors((prev) => [...prev.slice(-5), "Failed to handle WebRTC answer"]);
      });
    }

    if (pendingWebRtcCandidatesRef.current.length > 0) {
      const candidates = [...pendingWebRtcCandidatesRef.current];
      pendingWebRtcCandidatesRef.current = [];
      candidates.forEach((candidate) => {
        handleIceCandidateRef.current(candidate).catch((err) => {
          console.error("[WebRTC] Failed to add ICE candidate:", err);
        });
      });
    }
  }, [webrtcTrigger]);

  useEffect(() => {
    if (!remotePeerId || !localStreamState) {
      console.log("[WebRTC] Not creating offer - remotePeerId:", remotePeerId, "localStream:", !!localStreamState);
      return;
    }

    if (!shouldCreateOfferRef.current) {
      console.log("[WebRTC] Skipping offer creation (not initiator)");
      return;
    }

    if (hasCreatedOfferForPeerRef.current === remotePeerId) {
      console.log("[WebRTC] Offer already created for peer:", remotePeerId);
      return;
    }

    console.log("[WebRTC] Creating offer for peer:", remotePeerId, "with stream:", !!localStreamState);
    const sendJSON = sendConvJSONRef.current;
    if (!sendJSON) return;

    hasCreatedOfferForPeerRef.current = remotePeerId;
    shouldCreateOfferRef.current = false;

    createOffer()
      .then((offer) => {
        console.log("[WebRTC] Sending offer to peer:", remotePeerId);
        sendJSON({
          type: "webrtc_offer",
          target_peer_id: remotePeerId,
          offer: offer,
        });
      })
      .catch((err) => {
        console.error("[WebRTC] Failed to create/send offer:", err);
        hasCreatedOfferForPeerRef.current = null;
        setErrors((prev) => [...prev.slice(-5), "Failed to create WebRTC offer"]);
      });
  }, [remotePeerId, localStreamState, createOffer, webrtcTrigger]);

  // Handle peer_left event
  useEffect(() => {
    if (!remotePeerId) {
      closePeerConnection();
    }
  }, [remotePeerId, closePeerConnection]);

  const backendProfileType = profileId === "blind" ? "blind" : profileId === "deaf" ? "deaf" : "deafblind";

  // 1) Send setup messages as soon as conversation WS is open (match test room order)
  // Keep STT in backend so transcript + tone both come from Python pipeline.
  useEffect(() => {
    if (!convConnected || !sendConvJSON) return;
    console.log("[ConvWS] setup", {
      sessionId,
      profileId,
      backendProfileType,
      wantsTts,
      apiUrl: effectiveApiUrl,
      wsUrl: conversationWsUrl,
    });
    sendConvJSON({ type: "set_profile", profile_type: backendProfileType });
    sendConvJSON({ type: "start_listening", use_web_speech: false });
    sendConvJSON({ type: "set_room", room: sessionId });
    sendConvJSON({ type: "set_tts_preference", value: wantsTts });
  }, [convConnected, backendProfileType, sessionId, wantsTts, sendConvJSON, profileId, effectiveApiUrl, conversationWsUrl]);

  const startSendingAudio = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      setErrors((prev) => [...prev.slice(-5), "No microphone track"]);
      return;
    }
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
    const chunkFormat = (() => {
      const type = (mimeType || "").toLowerCase();
      if (type.includes("mp4")) return "mp4";
      if (type.includes("m4a")) return "m4a";
      if (type.includes("ogg")) return "ogg";
      return "webm";
    })();

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string)?.split(",")[1];
          if (base64) {
            const send = sendConvJSONRef.current;
            if (send) send({ type: "audio_chunk", audio: base64, format: chunkFormat });
          }
        };
        reader.readAsDataURL(event.data);
      }
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      if (chunkIntervalRef.current) clearTimeout(chunkIntervalRef.current);
      chunkIntervalRef.current = setTimeout(() => {
        startSendingAudioRef.current();
      }, 0);
    };
    try {
      // Request timeslice so we get chunks every interval (like test room)
      recorder.start(AUDIO_CHUNK_INTERVAL_MS);
    } catch {
      recorder.start();
    }
    recorderRef.current = recorder;
    if (chunkIntervalRef.current) clearTimeout(chunkIntervalRef.current);
    chunkIntervalRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, AUDIO_CHUNK_INTERVAL_MS);
  }, []);

  useEffect(() => {
    startSendingAudioRef.current = startSendingAudio;
  }, [startSendingAudio]);

  // 2) Get mic and start recording only after WS is open and setup sent (match test room: stream then start in onopen)
  useEffect(() => {
    if (!convConnected) return;
    let cancelled = false;
    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (USE_BROWSER_WEB_SPEECH && hasSpeechRecognition) {
          const Recognition = (window as unknown as { SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: unknown) => void) | null; start: () => void; stop: () => void } }).SpeechRecognition
            || (window as unknown as { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: unknown) => void) | null; start: () => void; stop: () => void } }).webkitSpeechRecognition;
          if (Recognition) {
            const recognition = new Recognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            recognition.onresult = (e: unknown) => {
              const event = e as { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } };
              const last = event.results.length - 1;
              const result = event.results[last];
              const text = result?.[0]?.transcript?.trim();
              if (text) {
                const send = sendConvJSONRef.current;
                if (send) send({ type: "text_transcript", text, is_final: result?.isFinal ?? true });
              }
            };
            recognition.start();
            recognitionRef.current = recognition;
          }
        }
        startSendingAudio();
      } catch {
        if (!cancelled) setErrors((prev) => [...prev.slice(-5), "Microphone access denied"]);
      }
    };
    run();
    return () => {
      cancelled = true;
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
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErrors((prev) => [
        ...prev.slice(-5),
        "Camera requires a secure page. Use https://localhost:3000 (run: npm run dev, not dev:http).",
      ]);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      localVideoStreamRef.current = stream;
      setLocalStreamState(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera blocked. Allow camera for this site in browser settings, or use https://localhost:3000 (npm run dev)."
          : "Camera permission denied. Use https://localhost:3000 (npm run dev) for camera support.";
      setErrors((prev) => [...prev.slice(-5), msg]);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    localVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
    localVideoStreamRef.current = null;
    setLocalStreamState(null);
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  // When camera turns on, ensure sign-detection WebSocket is connected so we can stream frames
  useEffect(() => {
    if (cameraOn && !isConnected) connect();
  }, [cameraOn, isConnected, connect]);

  useEffect(() => {
    if (cameraOn && !convConnected) connectConv();
  }, [cameraOn, convConnected, connectConv]);

  // Stream sign-detection frames whenever camera is on (no separate start button)
  useEffect(() => {
    if (!cameraOn) {
      if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
      return;
    }

    frameTimerRef.current = window.setInterval(() => {
      if (!isConnected || !videoRef.current || !canvasRef.current) return;
      const width = videoRef.current.videoWidth || 640;
      const height = videoRef.current.videoHeight || 480;
      if (width === 0 || height === 0) return;
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
  }, [cameraOn, isConnected, sendJSON]);

  const quickReplies = useMemo(() => {
    if (backendQuickReplies.length > 0) return backendQuickReplies.map((r) => r.label);
    const hasDetectedInput = conversationTranscript.length > 0 || transcript.length > 0;
    if (!hasDetectedInput) {
      return ["Please continue", "Can you repeat that?", "I understand"];
    }
    const bySign = REPLIES_BY_SIGN[latestSign.replace(/\s/g, "_")] || [];
    if (bySign.length > 0) return bySign;
    return ["Please continue", "Can you repeat that?", "I understand"];
  }, [latestSign, backendQuickReplies, conversationTranscript.length, transcript.length]);

  const getSpokenTextForReply = (label: string): string => {
    const fromBackend = backendQuickReplies.find((r) => r.label === label);
    return fromBackend?.spoken_text ?? label;
  };

  const sendReply = (replyOrLabel: string) => {
    setQuickRepliesUsed((prev) => prev + 1);
    const spokenText = backendQuickReplies.length > 0 ? getSpokenTextForReply(replyOrLabel) : replyOrLabel;
    speakText(spokenText, effectiveApiUrl);
  };

  const brailleInputText = useMemo(() => {
    if (!useBraille) return "";
    const remoteSpeech = conversationTranscript
      .filter((line) => {
        if (!line.text.trim()) return false;
        if (!localClientId) return false;
        if (!line.speakerClientId) return false;
        return line.speakerClientId !== localClientId;
      })
      .map((line) => line.text);
    return remoteSpeech.join(" ");
  }, [conversationTranscript, localClientId, useBraille]);

  const brailleDisplayCells = useMemo(() => {
    if (!useBraille || !brailleInputText.trim()) return [];
    return textToBrailleCells(brailleInputText + " ").slice(-BRAILLE_DISPLAY_CELLS);
  }, [brailleInputText, useBraille]);

  useEffect(() => {
    if (!useBraille) return;
    const remoteLineCount = conversationTranscript.filter((line) => {
      if (!line.text.trim()) return false;
      if (!localClientId) return false;
      if (!line.speakerClientId) return false;
      return line.speakerClientId !== localClientId;
    }).length;
    console.log("[Braille] input update", {
      localClientId,
      remotePeerId,
      remoteLineCount,
      brailleInputPreview: brailleInputText.slice(-80),
    });
  }, [useBraille, conversationTranscript, localClientId, remotePeerId, brailleInputText]);

  const sendChatMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !sendConvJSON) return;
    sendConvJSON({ type: "chat_message", room: sessionId, sender: "local", text: trimmed, tts: false });
    setChatMessages((prev) => [...prev, { sender: "local", text: trimmed }]);
    setChatInput("");
  };

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
            onClick={endSession}
            className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-400"
          >
            End session
          </button>
        </div>
      </header>
      <p className="mb-4 text-sm text-slate-300">Voice commands: off in workspace (backend transcription active)</p>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-2xl font-semibold text-slate-100">Conversation input</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <VideoCall
              localStream={localStreamState}
              remoteStream={remoteStream}
              className="w-full"
            />
            {/* Hidden video element for sign detection */}
            <video ref={videoRef} className="hidden" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={cameraOn ? stopCamera : startCamera} className="rounded-lg border border-slate-500 px-4 py-2">
              {cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
            <button type="button" onClick={isConnected ? disconnect : connect} className="rounded-lg border border-slate-500 px-4 py-2">
              {isConnected ? "Disconnect sign socket" : "Reconnect sign socket"}
            </button>
            <button type="button" onClick={convConnected ? disconnectConv : connectConv} className="rounded-lg border border-slate-500 px-4 py-2">
              {convConnected ? "Disconnect call signaling" : "Reconnect call signaling"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Sign socket: {isConnected ? "Connected" : "Disconnected"} | Call signaling: {convConnected ? "Connected" : "Disconnected"} | WebRTC: {connectionState}
          </p>
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
            {profileId === "deaf"
              ? "Current interpretation (hand signs)"
              : profileId === "mute"
                ? "Current interpretation (tone + captions)"
              : "Current interpretation"}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className={`font-semibold ${latestSign === NO_SIGN_YET ? "text-slate-500" : "text-cyan-300"} ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>
              {latestSign === NO_SIGN_YET ? "No sign yet" : latestSign}
            </p>
            <p className="text-slate-300">
              {hasReceivedSign
                ? `Confidence: ${Math.round(confidence * 100)}%`
                : cameraOn && !isConnected
                  ? "Connecting sign detection…"
                  : "Turn camera on"}
            </p>
          </div>
        </section>

        {showCaptionFeed && (
          <section className="max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-semibold text-slate-100">
              {profileId === "deaf"
                ? "Current interpretation (tone captions)"
                : profileId === "mute"
                  ? "Current interpretation (tone + captions)"
                : "Current interpretation"}
            </h2>
            {profileId === "deaf" ? (
              <>
                {conversationTranscript.length > 0 ? (
                  <p className="mt-3 text-4xl font-semibold text-cyan-300">
                    {conversationTranscript[conversationTranscript.length - 1]?.text}
                  </p>
                ) : (
                  <p className="mt-3 text-4xl font-semibold text-slate-500">No speech yet</p>
                )}
                {convStatus && <p className="mt-1 text-sm text-slate-400">Status: {convStatus}</p>}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                    <h3 className="text-lg font-semibold text-slate-100">Confirmed tone</h3>
                    {lastConvTone ? (
                      (() => {
                        const { emoji, label } = getToneDisplay(lastConvTone);
                        return (
                          <p className="mt-2 text-amber-300">
                            {emoji} {label}
                          </p>
                        );
                      })()
                    ) : (
                      <p className="mt-2 text-slate-400">Waiting for confirmed tone...</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Tone is batched and shown only after confidence is strong enough.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                    <h3 className="text-lg font-semibold text-slate-100">Caption stream</h3>
                    {conversationTranscript.length === 0 ? (
                      <p className="mt-2 text-slate-400">No speech yet. Speak to see captions.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {conversationTranscript.map((line, i) => (
                          <li key={i} className="text-slate-200">
                            <span className={line.sender === "remote" ? "text-emerald-300" : "text-cyan-300"}>
                              {line.sender === "remote" ? "Remote" : "You"}:
                            </span>{" "}
                            {line.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {conversationTranscript.length > 0 ? (
                  <>
                    <p className={`mt-3 font-semibold text-cyan-300 ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>
                      {conversationTranscript[conversationTranscript.length - 1]?.text}
                    </p>
                    {lastConvTone && (() => {
                      const { emoji, label } = getToneDisplay(lastConvTone);
                      return (
                        <p className="mt-2 text-amber-300">
                          {emoji} {label}
                        </p>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <p className={`mt-3 font-semibold ${latestSign === NO_SIGN_YET ? "text-slate-500" : "text-cyan-300"} ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>
                      {latestSign === NO_SIGN_YET ? "No sign yet" : latestSign}
                    </p>
                    <p className="mt-2 text-slate-300">
                      {hasReceivedSign ? `Confidence: ${Math.round(confidence * 100)}%` : cameraOn && !isConnected ? "Connecting sign detection…" : "Turn camera on"}
                    </p>
                  </>
                )}
                {convStatus && <p className="mt-1 text-sm text-slate-400">Status: {convStatus}</p>}
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
                  <h3 className="text-lg font-semibold text-slate-100">Caption stream</h3>
                  <p className="mt-2 text-sm text-slate-500">Sign (from camera)</p>
                  {transcript.length > 0 ? (
                    <p className="mt-1 text-slate-400">{transcript.join(" ")}</p>
                  ) : hasReceivedSign ? (
                    <p className="mt-1 text-slate-400">Current sign: {latestSign} ({Math.round(confidence * 100)}%)</p>
                  ) : cameraOn && !isConnected ? (
                    <p className="mt-1 text-slate-400">Connecting sign detection…</p>
                  ) : (
                    <p className="mt-1 text-slate-400">No sign yet. Turn camera on.</p>
                  )}
                  <p className="mt-3 text-sm text-slate-500">Conversation (transcript + tone)</p>
                  {conversationTranscript.length === 0 ? (
                    <p className="mt-1 text-slate-400">No speech yet. Speak to see captions.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {conversationTranscript.map((line, i) => {
                        const { emoji, label } = getToneDisplay(line.tone);
                        return (
                          <li key={i} className="text-slate-200">
                            <span className={line.sender === "remote" ? "text-emerald-300" : "text-cyan-300"}>
                              {line.sender === "remote" ? "Remote" : "You"}:
                            </span>{" "}
                            <span className="text-amber-300">{emoji} {label}</span>{" "}
                            {line.text}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
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

          {useBraille && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
              <h2 className="text-2xl font-semibold text-slate-100">Braille output</h2>
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
                <div className="flex flex-nowrap items-center justify-center gap-2">
                  {Array.from({ length: BRAILLE_DISPLAY_CELLS }, (_, i) => {
                    const pattern = brailleDisplayCells[i] ?? EMPTY_BRAILLE_CELL;
                    const char = brailleCellToCharacter(pattern);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <BrailleCell pattern={pattern} />
                        <span className="min-h-[1.25rem] text-center text-sm font-mono text-slate-400" aria-hidden="true">
                          {char === " " ? "·" : char}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {brailleDisplayCells.length === 0 && (
                  <p className="mt-2 text-center text-sm text-slate-500">Conversation and sign text will appear here.</p>
                )}
              </div>
            </section>
          )}

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
