"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioAssistButton } from "@/components/AudioAssistButton";
import { BrailleCell } from "@/components/BrailleCell";
import { VideoCall } from "@/components/VideoCall";
import { textToBrailleCells, brailleCellToCharacter, type BrailleCellPattern } from "@/braille/mapping";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePageAudioGuide } from "@/hooks/usePageAudioGuide";
import { getProfile, type UserProfileId } from "@/lib/profile";
import { writeSessionSummary } from "@/lib/session";
import { speakText, speakGuidance, pushTtsChunk, startNewTtsStream } from "@/lib/tts";
import { getToneDisplay } from "@/lib/toneDisplay";

const AUDIO_CHUNK_INTERVAL_MS = 1500;
const USE_BROWSER_WEB_SPEECH = false;
const BRAILLE_DISPLAY_CELLS = 12;

const EMPTY_BRAILLE_CELL: BrailleCellPattern = [false, false, false, false, false, false];

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

/** Ensures the value is a valid WebSocket base URL (has ws:// or wss://). */
function ensureWsBase(urlOrHost: string): string {
  const s = urlOrHost.trim().replace(/\/$/, "");
  if (/^wss?:\/\//i.test(s)) return s;
  if (/^https:\/\//i.test(s)) return s.replace(/^https:\/\//i, "wss://");
  if (/^http:\/\//i.test(s)) return s.replace(/^http:\/\//i, "ws://");
  const protocol = typeof window !== "undefined" && window.location?.protocol === "https:" ? "wss://" : "ws://";
  return `${protocol}${s}`;
}

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

  const wsEndpoint = useMemo(() => {
    const base = ensureWsBase(wsUrl);
    const url = new URL(`${base}/ws/sign-detection`);
    if (apiKey.trim()) url.searchParams.set("api_key", apiKey.trim());
    return url.toString();
  }, [apiKey, wsUrl]);

  const conversationWsUrl = useMemo(
    () => `${ensureWsBase(apiUrl)}/ws/conversation`,
    [apiUrl]
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
  const webrtcDrainLockRef = useRef(false);

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
  const [shouldCreateOffer, setShouldCreateOffer] = useState(false);
  const [isOfferer, setIsOfferer] = useState(false); // Track if we're the offerer
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(null);
  const [webrtcTrigger, setWebrtcTrigger] = useState(0);
  const [signInterpretation, setSignInterpretation] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conversationStep, setConversationStep] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phaseLabel, setPhaseLabel] = useState<"" | "15s" | "10s">("");
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(0);

  // Countdown display: tick every second while demo timer is active
  useEffect(() => {
    if (!timerActive) return;
    setTimerSecondsLeft(10);
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  // Phase countdown (15s then 10s after first response)
  useEffect(() => {
    if (!phaseLabel) return;
    const interval = setInterval(() => {
      setPhaseSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phaseLabel]);

  // Conversation script (Blind → Deaf sign); after first response we run 15s then 10s before next line
  const conversationScript = [
    {
      winstonPatterns: ["hi harshith", "how has your day been", "how's your day"],
      harshithResponse: "Good, how about you?"
    },
    {
      winstonPatterns: ["i'm good", "i am good", "thanks harshith", "love you harshith", "you are so handsome", "you're so handsome"],
      harshithResponse: "thank you. I love you more."
    },
    {
      winstonPatterns: ["thank you harshith", "thanks harshith", "nice meeting you"],
      harshithResponse: "thank you"
    }
  ];

  const useBraille = profileId === "blind" || profileId === "deafblind";
  const speakIncoming = profileId === "blind";
  const showCaptionFeed = profileId === "deaf" || profileId === "mute" || profileId === "deafblind" || profileId === "blind";
  const wantsTts = profileId === "blind";

  const handleConvMessage = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== "object" || !("type" in data)) return;
      const msg = data as Record<string, unknown>;
      const type = String(msg.type);

      console.log("[WS Message]", type, msg); // Debug all websocket messages

      switch (type) {
        case "transcript":
          if (msg.text != null) {
            const utteranceId = msg.utterance_id != null ? String(msg.utterance_id) : undefined;
            const transcriptText = String(msg.text);

            // Only trigger conversation demo on "blind" profile
            if (profileId === "blind") {
              // Loose matching for conversation demo
              const lowerText = transcriptText.toLowerCase();

              // Find matching conversation step
              let matchedStep = -1;
              for (let i = 0; i < conversationScript.length; i++) {
                const script = conversationScript[i];
                if (script.winstonPatterns.some(pattern => lowerText.includes(pattern))) {
                  matchedStep = i;
                  break;
                }
              }

              if (matchedStep !== -1) {
                const response = conversationScript[matchedStep].harshithResponse;

                // Clear any existing timers (main + phase 15s/10s)
                if (timerRef.current) {
                  clearTimeout(timerRef.current);
                  timerRef.current = null;
                }
                if (phaseTimerRef.current) {
                  clearTimeout(phaseTimerRef.current);
                  phaseTimerRef.current = null;
                }
                setPhaseLabel("");
                setPhaseSecondsLeft(0);

                // Set timer status and 10s countdown
                setTimerActive(true);
                setPendingResponse(response);

                // Start 10-second timer (response after 10s for every phrase)
                console.log("[Demo] Winston phrase detected, starting 10-second timer for:", response);
                timerRef.current = setTimeout(() => {
                  setSignInterpretation(response);
                  setConversationStep(matchedStep + 1);
                  setTimerActive(false);
                  setPendingResponse("");
                  setTimerSecondsLeft(0);

                  // Speak the sign interpretation (blind demo): use browser TTS so it always works without backend
                  speakGuidance(response);
                  console.log("[Demo] Sign interpretation updated and spoken:", response);

                  // After first response ("Good, how about you?"), run 15s then 10s before next line
                  if (matchedStep === 0) {
                    setPhaseLabel("15s");
                    setPhaseSecondsLeft(15);
                    phaseTimerRef.current = setTimeout(() => {
                      setPhaseLabel("10s");
                      setPhaseSecondsLeft(10);
                      phaseTimerRef.current = setTimeout(() => {
                        setPhaseLabel("");
                        setPhaseSecondsLeft(0);
                        phaseTimerRef.current = null;
                      }, 10000);
                    }, 15000);
                  }
                }, 10000);
              }
            }

            setConversationTranscript((prev) => {
              if (!utteranceId) {
                return [
                  ...prev,
                  { text: transcriptText, tone: msg.tone != null ? String(msg.tone) : undefined, utteranceId },
                ];
              }

              const idx = prev.findIndex((line) => line.utteranceId === utteranceId);
              if (idx === -1) {
                return [
                  ...prev,
                  { text: transcriptText, tone: msg.tone != null ? String(msg.tone) : undefined, utteranceId },
                ];
              }

              const next = [...prev];
              next[idx] = {
                ...next[idx],
                text: transcriptText,
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
        case "peer_joined": {
          const peerId = String(msg.peer_id ?? "");
          const createOffer = Boolean(msg.create_offer);
          console.log("[WebRTC] Peer joined:", peerId, "create_offer:", createOffer);
          if (peerId) {
            setRemotePeerId(peerId);
            setShouldCreateOffer(createOffer);
            setIsOfferer(createOffer); // Remember our role
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
          setShouldCreateOffer(false);
          pendingWebRtcOfferRef.current = null;
          pendingWebRtcAnswerRef.current = null;
          pendingWebRtcCandidatesRef.current = [];
          break;
        }
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

      setBuffering("");
      const cleanSign = payload.sign.replace(/_/g, " ");
      setLatestSign(cleanSign);
      setConfidence(payload.confidence);
      setHasReceivedSign(true);
      if (payload.is_new_sign && !(payload as SignPrediction & { _mock?: boolean })._mock) {
        setTranscript((prev) => [...prev, cleanSign]);
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
    ensurePeerConnection,
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
    onNeedRenegotiation: () => {
      // Only the original offerer can renegotiate to avoid role conflicts
      if (remotePeerId && sendConvJSON && connectionState === "connected" && isOfferer) {
        console.log("[WebRTC] Renegotiation needed (as offerer), creating new offer");
        createOffer().then((offer) => {
          sendConvJSON({
            type: "webrtc_offer",
            target_peer_id: remotePeerId,
            offer: offer,
          });
        }).catch(err => {
          console.error("[WebRTC] Renegotiation failed:", err);
        });
      } else if (!isOfferer) {
        console.log("[WebRTC] Renegotiation needed but we're the answerer, skipping to avoid role conflict");
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

  // Process pending WebRTC messages (offer first so remote description is set before answer/ICE)
  useEffect(() => {
    if (webrtcDrainLockRef.current) return;
    webrtcDrainLockRef.current = true;
    let cancelled = false;

    async function drain() {
      // 1) Handle offer first and wait so remote description is set before we add ICE
      if (pendingWebRtcOfferRef.current) {
        const { fromPeerId, offer } = pendingWebRtcOfferRef.current;
        pendingWebRtcOfferRef.current = null;
        try {
          const answer = await handleOfferRef.current(offer);
          if (cancelled) return;
          const sendJSON = sendConvJSONRef2.current;
          if (sendJSON) {
            sendJSON({
              type: "webrtc_answer",
              target_peer_id: fromPeerId,
              answer: answer,
            });
          }
        } catch (err) {
          console.error("[WebRTC] Failed to handle offer:", err);
        }
      }

      if (cancelled) return;

      // 2) Then handle answer
      if (pendingWebRtcAnswerRef.current) {
        const answer = pendingWebRtcAnswerRef.current;
        pendingWebRtcAnswerRef.current = null;
        try {
          handleAnswerRef.current(answer);
        } catch (err) {
          console.error("[WebRTC] Failed to handle answer:", err);
        }
      }

      if (cancelled) return;

      // 3) Then ICE candidates (only after remote description is set)
      if (pendingWebRtcCandidatesRef.current.length > 0) {
        const candidates = [...pendingWebRtcCandidatesRef.current];
        pendingWebRtcCandidatesRef.current = [];
        for (const candidate of candidates) {
          if (cancelled) return;
          try {
            await handleIceCandidateRef.current(candidate);
          } catch (err) {
            console.warn("[WebRTC] Failed to add ICE candidate:", err);
          }
        }
      }
    }

    drain()
      .then(() => {
        if (
          !cancelled &&
          (pendingWebRtcOfferRef.current ||
            pendingWebRtcAnswerRef.current ||
            pendingWebRtcCandidatesRef.current.length > 0)
        ) {
          setWebrtcTrigger((prev) => prev + 1);
        }
      })
      .finally(() => {
        webrtcDrainLockRef.current = false;
      });

    return () => {
      cancelled = true;
    };
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

  // Create peer connection eagerly when peer joins
  useEffect(() => {
    if (remotePeerId) {
      console.log("[WebRTC] Peer joined, ensuring peer connection exists");
      ensurePeerConnection();
    }
  }, [remotePeerId, ensurePeerConnection]);

  // Create offer when we're the offerer
  useEffect(() => {
    if (shouldCreateOffer && remotePeerId) {
      console.log("[WebRTC] Creating offer for peer:", remotePeerId);
      const sendJSON = sendConvJSONRef2.current;
      if (sendJSON) {
        createOfferRef.current().then((offer) => {
          console.log("[WebRTC] Sending offer to peer:", remotePeerId);
          sendJSON({
            type: "webrtc_offer",
            target_peer_id: remotePeerId,
            offer: offer,
          });
        }).catch(err => {
          console.error("[WebRTC] Failed to create offer:", err);
        });
      }
    }
  }, [shouldCreateOffer, remotePeerId]);

  // Handle peer_left event
  useEffect(() => {
    if (!remotePeerId) {
      closePeerConnection();
    }
  }, [remotePeerId, closePeerConnection]);

  const backendProfileType = profileId === "blind" ? "blind" : "deaf";

  // 1) Send setup messages as soon as conversation WS is open (match test room order)
  // Keep STT in backend so transcript + tone both come from Python pipeline.
  // Use a single static room for all users (max 2 people)
  useEffect(() => {
    if (!convConnected || !sendConvJSON) return;
    const STATIC_ROOM = "global-video-room"; // Everyone joins this room
    console.log("[LiveWorkspace] Joining global video room");
    sendConvJSON({ type: "set_profile", profile_type: backendProfileType });
    sendConvJSON({ type: "start_listening", use_web_speech: false });
    sendConvJSON({ type: "set_room", room: STATIC_ROOM });
    sendConvJSON({ type: "set_tts_preference", value: wantsTts });
  }, [convConnected, backendProfileType, wantsTts, sendConvJSON]);

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
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("MediaDevices API not available. Please access via https:// or http://localhost");
        }
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
      } catch (err) {
        if (!cancelled) {
          const e = err as Error;
          const msg = e.message || "Microphone access denied";
          setErrors((prev) => [...prev.slice(-5), msg]);
        }
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
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrors((prev) => [...prev.slice(-5), "Camera/microphone require HTTPS or http://localhost. Your current URL doesn't support media access."]);
      return;
    }

    const tryGetMedia = (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    let stream: MediaStream | null = null;
    try {
      try {
        stream = await tryGetMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: true,
        });
      } catch {
        stream = await tryGetMedia({ video: true, audio: true });
      }
      if (!stream) return;
      localVideoStreamRef.current = stream;
      setLocalStreamState(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch (err) {
      const e = err as DOMException & { name?: string; message?: string };
      const name = e?.name ?? "Unknown";
      let msg = "Camera permission denied";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Camera blocked. Allow camera access in your browser or system settings and try again.";
      } else if (name === "NotFoundError") {
        msg = "No camera or microphone found.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        msg = "Camera in use by another app or could not be started.";
      } else if (name === "SecurityError") {
        msg = "Camera requires HTTPS or localhost. Open this page via https:// or http://localhost.";
      } else if (e?.message) {
        msg = `Camera error: ${e.message}`;
      }
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

  useEffect(() => () => {
    stopCamera();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
    }
  }, []);

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
    speakText(spokenText, apiUrl);
  };

  const combinedTranscriptText = useMemo(
    () => [...conversationTranscript.map((l) => l.text), ...transcript].join(" "),
    [conversationTranscript, transcript]
  );

  const brailleDisplayCells = useMemo(() => {
    if (!combinedTranscriptText.trim()) return [];
    return textToBrailleCells(combinedTranscriptText + " ").slice(-BRAILLE_DISPLAY_CELLS);
  }, [combinedTranscriptText]);

  const sendChatMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !sendConvJSON) return;
    const STATIC_ROOM = "global-video-room"; // Same room as video
    sendConvJSON({ type: "chat_message", room: STATIC_ROOM, sender: "local", text: trimmed, tts: false });
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
          <h2 className="text-2xl font-semibold text-slate-100">Sign interpretation</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className={`font-semibold ${signInterpretation ? "text-cyan-300" : "text-slate-500"} ${profileId === "deafblind" ? "text-5xl" : "text-4xl"}`}>
              {signInterpretation || (timerActive ? "—" : "")}
            </p>
          </div>
        </section>

        {showCaptionFeed && (
          <section className="max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-2xl font-semibold text-slate-100">Tone + captions interpretation</h2>
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
