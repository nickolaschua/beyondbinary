"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseWebRTCOptions {
  localStream: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

export function useWebRTC({ localStream, onRemoteStream, onIceCandidate }: UseWebRTCOptions) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");

  const onRemoteStreamRef = useRef(onRemoteStream);
  const onIceCandidateRef = useRef(onIceCandidate);

  useEffect(() => {
    onRemoteStreamRef.current = onRemoteStream;
  }, [onRemoteStream]);

  useEffect(() => {
    onIceCandidateRef.current = onIceCandidate;
  }, [onIceCandidate]);

  const flushPendingIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    if (pendingIceCandidatesRef.current.length === 0) return;
    const candidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Failed to apply queued ICE candidate:", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // TURN relay for when direct connection fails (e.g. different networks)
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    // Add local tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind);
      const [stream] = event.streams;
      console.log("[WebRTC] Remote stream received:", stream?.id, "tracks:", stream?.getTracks().length);
      setRemoteStream(stream);
      onRemoteStreamRef.current?.(stream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidateRef.current?.(event.candidate);
      }
    };

    // Track connection state
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state changed:", pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [localStream]);

  const createOffer = useCallback(async () => {
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }, [createPeerConnection]);

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    },
    [createPeerConnection, flushPendingIceCandidates]
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingIceCandidates();
  }, [flushPendingIceCandidates]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    if (!pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  // If local stream starts after peer connection is created, attach/replace tracks.
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc || !localStream) return;

    const senders = pc.getSenders();
    for (const track of localStream.getTracks()) {
      const existing = senders.find((s) => s.track?.kind === track.kind);
      if (existing) {
        existing.replaceTrack(track).catch((err) => {
          console.warn("[WebRTC] Failed to replace local track:", err);
        });
      } else {
        pc.addTrack(track, localStream);
      }
    }
  }, [localStream]);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      pendingIceCandidatesRef.current = [];
      setRemoteStream(null);
      setConnectionState("closed");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closePeerConnection();
    };
  }, [closePeerConnection]);

  return {
    remoteStream,
    connectionState,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
  };
}
