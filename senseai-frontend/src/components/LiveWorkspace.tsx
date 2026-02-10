"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { VideoCall } from "@/components/VideoCall";
import { textToBrailleCells, type BrailleCellPattern } from "@/braille/mapping";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { getProfile, type UserProfileId } from "@/lib/profile";
import { writeSessionSummary } from "@/lib/session";
import { speakText, pushTtsChunk, startNewTtsStream } from "@/lib/tts";
import { getToneDisplay } from "@/lib/toneDisplay";

const AUDIO_CHUNK_INTERVAL_MS = 1500;
const USE_BROWSER_WEB_SPEECH = false;

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
type ConversationLine = { text: string; tone?: string; utteranceId?: string };
const QUICK_REPLY_MIN_REFRESH_MS = 4000;

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
    if (typeof window === "undefined") return apiUrl;
    if (window.location.protocol !== "https:") return apiUrl;
    return apiUrl.replace(/^http:\/\//i, "https://");
  }, [apiUrl]);
  const effectiveWsUrl = useMemo(() => {
    if (typeof window === "undefined") return wsUrl;
    if (window.location.protocol !== "https:") return wsUrl;
    return wsUrl.replace(/^ws:\/\//i, "wss://");
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
  const [brailleCells, setBrailleCells] = useState<BrailleCellPattern[]>([]);
  const [buffering, setBuffering] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [customReply, setCustomReply] = useState("");
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(0);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
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
            setConversationTranscript((prev) => {
              if (!utteranceId) {
                return [
                  ...prev,
                  { text: String(msg.text), tone: msg.tone != null ? String(msg.tone) : undefined, utteranceId },
                ];
              }

              const idx = prev.findIndex((line) => line.utteranceId === utteranceId);
              if (idx === -1) {
                return [
                  ...prev,
                  { text: String(msg.text), tone: msg.tone != null ? String(msg.tone) : undefined, utteranceId },
                ];
              }

              const next = [...prev];
              next[idx] = {
                ...next[idx],
                text: String(msg.text),
                tone: msg.tone != null ? String(msg.tone) : next[idx].tone,
              };
              return next;
            });
          }
          break;
        case "utterance_created":
          if (msg.text != null) {
            const tone = msg.tone as { label?: string } | undefined;
            const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
            setConversationTranscript((prev) => {
              if (!utteranceId) {
                return [...prev, { text: String(msg.text), tone: tone?.label, utteranceId }];
              }

              const idx = prev.findIndex((line) => line.utteranceId === utteranceId);
              if (idx === -1) {
                return [...prev, { text: String(msg.text), tone: tone?.label, utteranceId }];
              }

              const next = [...prev];
              next[idx] = { ...next[idx], text: String(msg.text), tone: tone?.label ?? next[idx].tone };
              return next;
            });
            if (tone?.label) setLastConvTone(tone.label);
          }
          break;
        case "tone_update": {
          const toneStr = msg.tone != null ? String(msg.tone) : null;
          if (toneStr) setLastConvTone(toneStr);
          const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
          if (utteranceId && toneStr) {
            setConversationTranscript((prev) =>
              prev.map((line) => (line.utteranceId === utteranceId ? { ...line, tone: toneStr } : line))
            );
          }
          break;
        }
        case "simplified":
          if (msg.text != null) setSimplifiedText(String(msg.text));
          if (Array.isArray(msg.quick_replies)) {
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
        case "error":
          setErrors((prev) => [...prev.slice(-5), String(msg.message ?? "Unknown error")]);
          break;
        case "peer_joined": {
          const peerId = String(msg.peer_id ?? "");
          console.log("[WebRTC] Peer joined:", peerId);
          if (peerId) {
            setRemotePeerId(peerId);
            // Offer will be created in useEffect
          }
          break;
        }
        case "webrtc_offer": {
          const fromPeerId = String(msg.from_peer_id ?? "");
          const offer = msg.offer as RTCSessionDescriptionInit;
          console.log("[WebRTC] Received offer from:", fromPeerId);
          if (fromPeerId && offer) {
            setRemotePeerId(fromPeerId);
            // Store for async WebRTC handling
            pendingWebRtcOfferRef.current = { fromPeerId, offer };
            setWebrtcTrigger(prev => prev + 1);
          }
          break;
        }
        case "webrtc_answer": {
          const answer = msg.answer as RTCSessionDescriptionInit;
          console.log("[WebRTC] Received answer");
          if (answer) {
            pendingWebRtcAnswerRef.current = answer;
            setWebrtcTrigger(prev => prev + 1);
          }
          break;
        }
        case "webrtc_ice_candidate": {
          const candidate = msg.candidate as RTCIceCandidateInit;
          console.log("[WebRTC] Received ICE candidate");
          if (candidate) {
            pendingWebRtcCandidatesRef.current.push(candidate);
            setWebrtcTrigger(prev => prev + 1);
          }
          break;
        }
        case "peer_left": {
          setRemotePeerId(null);
          pendingWebRtcOfferRef.current = null;
          pendingWebRtcAnswerRef.current = null;
          pendingWebRtcCandidatesRef.current = [];
          break;
        }
        default:
          break;
      }
    },
    [effectiveApiUrl, profileId]
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
        if (useBraille) {
          setBrailleCells((prev) => [...prev, ...textToBrailleCells(`${cleanSign} `)]);
        }
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
      handleOfferRef.current(offer).then((answer) => {
        const sendJSON = sendConvJSONRef2.current;
        if (sendJSON) {
          sendJSON({
            type: "webrtc_answer",
            target_peer_id: fromPeerId,
            answer: answer,
          });
        }
      });
    }

    if (pendingWebRtcAnswerRef.current) {
      const answer = pendingWebRtcAnswerRef.current;
      pendingWebRtcAnswerRef.current = null;
      handleAnswerRef.current(answer);
    }

    if (pendingWebRtcCandidatesRef.current.length > 0) {
      const candidates = [...pendingWebRtcCandidatesRef.current];
      pendingWebRtcCandidatesRef.current = [];
      candidates.forEach((candidate) => {
        handleIceCandidateRef.current(candidate);
      });
    }
  }, [webrtcTrigger]);

  // Handle peer_joined event to create offer
  const createOfferRef = useRef(createOffer);
  const sendConvJSONRef2 = useRef(sendConvJSON);

  useEffect(() => {
    createOfferRef.current = createOffer;
  }, [createOffer]);

  useEffect(() => {
    sendConvJSONRef2.current = sendConvJSON;
  }, [sendConvJSON]);

  useEffect(() => {
    if (remotePeerId && localStreamState) {
      console.log("[WebRTC] Creating offer for peer:", remotePeerId, "with stream:", !!localStreamState);
      const sendJSON = sendConvJSONRef2.current;
      if (sendJSON) {
        createOfferRef.current().then((offer) => {
          console.log("[WebRTC] Sending offer to peer:", remotePeerId);
          sendJSON({
            type: "webrtc_offer",
            target_peer_id: remotePeerId,
            offer: offer,
          });
        });
      }
    } else {
      console.log("[WebRTC] Not creating offer - remotePeerId:", remotePeerId, "localStream:", !!localStreamState);
    }
  }, [remotePeerId, localStreamState]);

  // Handle peer_left event
  useEffect(() => {
    if (!remotePeerId) {
      closePeerConnection();
    }
  }, [remotePeerId, closePeerConnection]);

  const backendProfileType = profileId === "blind" ? "blind" : "deaf";

  // 1) Send setup messages as soon as conversation WS is open (match test room order)
  // Keep STT in backend so transcript + tone both come from Python pipeline.
  useEffect(() => {
    if (!convConnected || !sendConvJSON) return;
    sendConvJSON({ type: "set_profile", profile_type: backendProfileType });
    sendConvJSON({ type: "start_listening", use_web_speech: false });
    sendConvJSON({ type: "set_room", room: sessionId });
    sendConvJSON({ type: "set_tts_preference", value: wantsTts });
  }, [convConnected, backendProfileType, sessionId, wantsTts, sendConvJSON]);

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
              {profileId === "deaf" || profileId === "mute"
                ? "Current interpretation (tone + captions)"
                : "Current interpretation"}
            </h2>
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
            {showCaptionFeed && (
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
                          <span className="text-amber-300">{emoji} {label}</span> {line.text}
                        </li>
                      );
                    })}
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
