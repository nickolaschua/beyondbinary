"use client";

import { useEffect, useRef, useState } from "react";

interface VideoCallProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  className?: string;
}

export function VideoCall({ localStream, remoteStream, className = "" }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);

  // Attach local stream
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;

    if (localStream) {
      console.log("[VideoCall] Attaching local stream, tracks:", localStream.getTracks().length);
      videoEl.srcObject = localStream;
    } else {
      videoEl.srcObject = null;
    }
  }, [localStream]);

  // Check if remote video track is active
  const checkRemoteVideoActive = (stream: MediaStream | null) => {
    if (!stream) {
      setRemoteVideoActive(false);
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const isActive = videoTrack && videoTrack.enabled && videoTrack.readyState === "live";
    console.log("[VideoCall] Remote video active:", isActive, "track:", videoTrack?.kind, "enabled:", videoTrack?.enabled, "readyState:", videoTrack?.readyState);
    setRemoteVideoActive(isActive);
  };

  // Attach remote stream
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;

    if (remoteStream) {
      console.log("[VideoCall] Attaching remote stream, tracks:", remoteStream.getTracks().length);
      videoEl.srcObject = remoteStream;

      // Check initial video state
      checkRemoteVideoActive(remoteStream);

      // Listen for track state changes
      const handleTrackChange = () => {
        console.log("[VideoCall] Track state changed");
        checkRemoteVideoActive(remoteStream);
      };

      const videoTracks = remoteStream.getVideoTracks();
      videoTracks.forEach(track => {
        console.log("[VideoCall] Remote track:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
        track.addEventListener("ended", handleTrackChange);
        track.addEventListener("mute", handleTrackChange);
        track.addEventListener("unmute", handleTrackChange);
      });

      // Listen for new tracks being added
      const handleAddTrack = () => {
        console.log("[VideoCall] New track added to remote stream");
        checkRemoteVideoActive(remoteStream);
        videoEl.load();
        videoEl.play().catch(err => console.warn("[VideoCall] Play after track add failed:", err));
      };

      const handleRemoveTrack = () => {
        console.log("[VideoCall] Track removed from remote stream");
        checkRemoteVideoActive(remoteStream);
      };

      remoteStream.addEventListener("addtrack", handleAddTrack);
      remoteStream.addEventListener("removetrack", handleRemoveTrack);

      // Force play after a short delay to ensure stream is ready
      const playTimer = setTimeout(() => {
        videoEl.play().catch(err => {
          console.warn("[VideoCall] Remote video autoplay failed:", err);
        });
      }, 100);

      return () => {
        clearTimeout(playTimer);
        videoTracks.forEach(track => {
          track.removeEventListener("ended", handleTrackChange);
          track.removeEventListener("mute", handleTrackChange);
          track.removeEventListener("unmute", handleTrackChange);
        });
        remoteStream.removeEventListener("addtrack", handleAddTrack);
        remoteStream.removeEventListener("removetrack", handleRemoveTrack);
      };
    } else {
      console.log("[VideoCall] Clearing remote stream");
      videoEl.srcObject = null;
      setRemoteVideoActive(false);
    }
  }, [remoteStream]);

  return (
    <div className={`relative ${className}`}>
      {/* Remote video - main view (always rendered, hidden when no stream) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`aspect-[16/9] w-full rounded-xl object-cover ${!remoteStream ? "hidden" : ""}`}
      />

      {/* "Camera is off" overlay when connected but no video */}
      {remoteStream && !remoteVideoActive && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3l18 18"
              />
            </svg>
            <p className="mt-4 text-lg font-medium text-slate-300">Camera is off</p>
            <p className="mt-1 text-sm text-slate-400">Waiting for video...</p>
          </div>
        </div>
      )}

      {/* Local video - full view when alone, PiP when peer connected */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className={
          remoteStream
            ? "absolute bottom-4 right-4 w-48 rounded-lg border-2 border-slate-600 object-cover shadow-lg"
            : "aspect-[16/9] w-full rounded-xl object-cover"
        }
      />

      {/* Connection indicator */}
      {remoteStream && (
        <div className="absolute left-4 top-4 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
          Connected
        </div>
      )}
    </div>
  );
}
