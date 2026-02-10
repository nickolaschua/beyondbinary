"use client";

import { useEffect, useRef } from "react";

interface VideoCallProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  className?: string;
}

export function VideoCall({ localStream, remoteStream, className = "" }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className={`relative ${className}`}>
      {/* Remote video - main view */}
      {remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="aspect-[16/9] w-full rounded-xl object-cover"
        />
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
