"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseWebRTCOptions {
  localStream: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onNeedRenegotiation?: () => void;
}

export function useWebRTC({
  localStream,
  onRemoteStream,
  onIceCandidate,
  onNeedRenegotiation
}: UseWebRTCOptions) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const currentTracksRef = useRef<Set<string>>(new Set());
  const isNegotiatingRef = useRef(false);

  const onRemoteStreamRef = useRef(onRemoteStream);
  const onIceCandidateRef = useRef(onIceCandidate);
  const onNeedRenegotiationRef = useRef(onNeedRenegotiation);

  useEffect(() => {
    onRemoteStreamRef.current = onRemoteStream;
  }, [onRemoteStream]);

  useEffect(() => {
    onIceCandidateRef.current = onIceCandidate;
  }, [onIceCandidate]);

  useEffect(() => {
    onNeedRenegotiationRef.current = onNeedRenegotiation;
  }, [onNeedRenegotiation]);

  // Create peer connection once (not per offer/answer)
  const ensurePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("[WebRTC] Creating new peer connection");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind, "readyState:", event.track.readyState);
      const [stream] = event.streams;
      if (stream) {
        console.log("[WebRTC] Remote stream received:", stream.id, "tracks:", stream.getTracks().length);
        console.log("[WebRTC] Stream tracks:", stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(", "));

        setRemoteStream(stream);
        onRemoteStreamRef.current?.(stream);
      } else {
        console.warn("[WebRTC] Received track but no stream!");
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Generated ICE candidate");
        onIceCandidateRef.current?.(event.candidate);
      } else {
        console.log("[WebRTC] ICE gathering completed");
      }
    };

    // Track connection state
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state changed:", pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    // Handle negotiation needed (when tracks are added/removed)
    pc.onnegotiationneeded = async () => {
      console.log("[WebRTC] Negotiation needed");

      // Prevent multiple simultaneous negotiations
      if (isNegotiatingRef.current) {
        console.log("[WebRTC] Already negotiating, skipping");
        return;
      }

      // Only trigger renegotiation if we're already connected
      if (pc.signalingState !== "stable") {
        console.log("[WebRTC] Not in stable state, skipping renegotiation");
        return;
      }

      isNegotiatingRef.current = true;
      onNeedRenegotiationRef.current?.();
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  // Update local tracks dynamically
  const updateTracks = useCallback((stream: MediaStream | null) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log("[WebRTC] No peer connection yet, can't update tracks");
      return;
    }

    const newTrackIds = new Set(stream?.getTracks().map(t => t.id) || []);
    const currentTrackIds = currentTracksRef.current;

    console.log("[WebRTC] Updating tracks. Current:", Array.from(currentTrackIds), "New:", Array.from(newTrackIds));

    // Remove tracks that are no longer in the stream
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track && !newTrackIds.has(sender.track.id)) {
        console.log("[WebRTC] Removing track:", sender.track.kind, sender.track.id);
        pc.removeTrack(sender);
      }
    }

    // Add new tracks
    if (stream) {
      for (const track of stream.getTracks()) {
        if (!currentTrackIds.has(track.id)) {
          console.log("[WebRTC] Adding track:", track.kind, track.id);
          pc.addTrack(track, stream);
        }
      }
    }

    currentTracksRef.current = newTrackIds;
  }, []);

  // Watch for local stream changes and update tracks
  useEffect(() => {
    if (!peerConnectionRef.current) {
      // Don't add tracks until peer connection exists
      return;
    }

    updateTracks(localStream);
  }, [localStream, updateTracks]);

  const createOffer = useCallback(async () => {
    const pc = ensurePeerConnection();

    // Add tracks before creating offer
    if (localStream) {
      updateTracks(localStream);
    }

    isNegotiatingRef.current = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("[WebRTC] Created and set offer");

    return offer;
  }, [ensurePeerConnection, localStream, updateTracks]);

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = ensurePeerConnection();

      // Add tracks before handling offer
      if (localStream) {
        updateTracks(localStream);
      }

      console.log("[WebRTC] Setting remote description (offer)");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[WebRTC] Created and set answer");

      return answer;
    },
    [ensurePeerConnection, localStream, updateTracks]
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.warn("[WebRTC] No peer connection for answer");
      return;
    }

    console.log("[WebRTC] Setting remote description (answer)");
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    isNegotiatingRef.current = false;
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.warn("[WebRTC] No peer connection for ICE candidate");
      return;
    }

    console.log("[WebRTC] Adding ICE candidate");
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log("[WebRTC] Closing peer connection");
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setRemoteStream(null);
      setConnectionState("closed");
      currentTracksRef.current.clear();
      isNegotiatingRef.current = false;
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
    ensurePeerConnection,
  };
}
