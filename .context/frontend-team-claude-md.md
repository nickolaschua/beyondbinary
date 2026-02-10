# CLAUDE.md — Frontend Team: App Shell, Video Call, and Conversation Intelligence
## SenseAI | Beyond Binary Hackathon | 48 Hours
## Shared Guide for Frontend Engineers 1, 2, and 3

---

## ⚠️ DESIGN PHILOSOPHY: THIS IS A PHONE APP

**SenseAI is a mobile-first phone application.** Every design decision flows from this:

- **Target device:** Phone held in one hand (portrait orientation)
- **Screen size:** 375×812 baseline (iPhone SE to iPhone 15 Pro Max range, plus Android equivalents)
- **No desktop layout.** Do not add responsive breakpoints for tablets or desktops. The app is a phone app shown inside a max-w-[430px] centered container.
- **PWA (Progressive Web App):** Users open the Vercel URL on their phone browser and "Add to Home Screen." The app launches fullscreen without browser chrome.
- **Touch-first:** Every interactive element must be ≥44×44px (Apple HIG minimum). Prefer 48px+. No hover-only interactions.
- **One-handed operation:** Primary actions at the bottom of the screen within thumb reach. Never place critical buttons at the top.
- **Dynamic viewport:** Use `dvh` (dynamic viewport height), never `vh`. Mobile browsers have collapsible URL bars that make `100vh` taller than the visible screen.
- **Safe areas:** Account for the notch (top) and home indicator (bottom) on modern phones using `env(safe-area-inset-*)`.

---

## TEAM OVERVIEW

Three frontend engineers share a single Next.js codebase. Each owns specific pages/features but shares components, hooks, and the global state layer.

| Role | Engineer | Owns | Pages |
|------|----------|------|-------|
| **Frontend 1 — App Shell** | TBD | PWA setup, onboarding, layout, profile context, haptic feedback, navigation, mobile CSS foundation | `/`, `/onboarding`, layout.tsx |
| **Frontend 2 — Video Call** | TBD | PeerJS WebRTC video call, sign detection frame capture, sign overlay, facial emotion badges | `/video-call` |
| **Frontend 3 — Conversation** | TBD | Listen mode, audio recording/streaming, caption display, tone badges, quick-reply buttons, TTS playback | `/conversation` |

**CRITICAL RULE: Work on separate files. Do NOT edit each other's page files. Shared code goes in `/components`, `/hooks`, `/lib`, `/context`.**

---

## TECH STACK

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14+ (App Router) | Industry standard, Vercel deployment in 1 click |
| Styling | Tailwind CSS | Utility-first, no separate CSS files, great for prototyping fast |
| State | React Context + useReducer | Simple, no extra library. Zustand as backup if context gets messy |
| Video Call | PeerJS | WebRTC in ~20 lines, free cloud signaling server |
| Sign Detection | WebSocket to backend `/ws/sign-detection` | Sends video frames, receives predictions |
| Conversation | WebSocket to backend `/ws/conversation` | Sends audio chunks, receives transcripts + quick-replies |
| TTS | ElevenLabs via backend `/api/tts` + Web Speech API fallback | Natural voice for quick-replies |
| PWA | Next.js + manifest.json + service worker | Installable on home screen, fullscreen, offline shell |
| Deployment | Vercel | Zero-config Next.js deployment, free tier, automatic HTTPS (required for camera/mic on phones) |

---

## ENVIRONMENT SETUP (macOS AND Windows)

### Prerequisites

- Node.js 18+ (LTS). Download from https://nodejs.org
- npm (comes with Node.js) or yarn or pnpm
- Git
- VS Code recommended (with Tailwind CSS IntelliSense extension)
- **A physical phone** (or Chrome DevTools mobile emulator) for testing

### Create Project

```bash
# One person creates the project, pushes to GitHub, others clone
npx create-next-app@latest senseai-frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd senseai-frontend
```

When prompted:
- Would you like to use TypeScript? → **Yes**
- Would you like to use ESLint? → **Yes**
- Would you like to use Tailwind CSS? → **Yes**
- Would you like to use `src/` directory? → **Yes**
- Would you like to use App Router? → **Yes**
- Would you like to customize the default import alias? → **Yes** (keep `@/*`)

### Install Additional Dependencies

```bash
# PeerJS for WebRTC video call
npm install peerjs

# face-api.js for facial emotion detection (vladmandic's maintained fork)
npm install @vladmandic/face-api

# Audio utilities
npm install lamejs  # MP3 encoding if needed

# Icons
npm install lucide-react

# Utility
npm install clsx  # Conditional class names
```

### Environment Variables

Create `.env.local` at the project root:

```env
# Backend API URL (Railway deployment)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# PeerJS (using free cloud server — no config needed for dev)
NEXT_PUBLIC_PEER_HOST=0.peerjs.com
NEXT_PUBLIC_PEER_PORT=443
NEXT_PUBLIC_PEER_SECURE=true
```

**When the backend lead deploys to Railway, update both to the Railway URL (use `https://` and `wss://`).**

### Run Dev Server

```bash
npm run dev
# → http://localhost:3000
```

### Testing On Your Actual Phone

**This is critical.** Chrome DevTools mobile emulator does NOT test real camera, microphone, haptics, or touch properly.

**Option A — Same WiFi (easiest at hackathon):**
```bash
# Find your computer's local IP
# macOS:
ipconfig getifaddr en0
# Windows:
ipconfig | findstr IPv4

# Start Next.js on all interfaces
npm run dev -- -H 0.0.0.0

# On your phone browser, go to:
# http://192.168.x.x:3000
```
⚠️ Camera/mic will NOT work over plain HTTP on a phone (except localhost). You need HTTPS. Use Option B or deploy to Vercel early.

**Option B — Deploy to Vercel early (recommended):**
Deploy as soon as you have a basic page working. Vercel gives you HTTPS automatically, which is REQUIRED for `getUserMedia()` (camera/mic) on mobile browsers.

**Option C — ngrok tunnel:**
```bash
npx ngrok http 3000
# Gives you a https://xxxx.ngrok.io URL you can open on your phone
```

### Directory Structure

```
src/
├── app/
│   ├── layout.tsx              ← [FE1] Root layout, providers, nav, PWA meta
│   ├── page.tsx                ← [FE1] Landing/home page
│   ├── onboarding/
│   │   └── page.tsx            ← [FE1] Onboarding flow
│   ├── video-call/
│   │   └── page.tsx            ← [FE2] Video call + sign detection
│   ├── conversation/
│   │   └── page.tsx            ← [FE3] Conversation intelligence
│   └── globals.css             ← [FE1] Tailwind base styles + mobile CSS reset
├── components/
│   ├── ui/                     ← Shared UI components (buttons, cards, badges)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── LoadingSpinner.tsx
│   ├── layout/
│   │   ├── Header.tsx          ← [FE1] Top bar with mode indicator
│   │   ├── ModeNav.tsx         ← [FE1] Bottom navigation (above home indicator)
│   │   └── ProfileBadge.tsx    ← [FE1] Shows current profile (deaf/blind)
│   ├── video-call/             ← [FE2] All video call components
│   │   ├── VideoGrid.tsx       ← Local + remote video display
│   │   ├── SignOverlay.tsx     ← Detected sign text overlay on video
│   │   ├── EmotionBadge.tsx    ← Facial emotion badge
│   │   ├── RoomControls.tsx    ← Create/join room, mute, end call
│   │   └── HandGuide.tsx       ← "Position hands in frame" hint
│   └── conversation/           ← [FE3] All conversation components
│       ├── CaptionFeed.tsx     ← Scrolling captions with tone badges
│       ├── ToneBadge.tsx       ← Emoji/color indicator for detected tone
│       ├── QuickReplies.tsx    ← Contextual reply buttons
│       ├── ListenButton.tsx    ← Big "Listen" activation button
│       ├── AudioPlayer.tsx     ← Plays TTS audio from backend
│       └── ConversationSummary.tsx  ← Post-conversation summary card
├── context/
│   └── ProfileContext.tsx      ← [FE1] Global profile state (deaf/blind/channels)
├── hooks/
│   ├── useWebSocket.ts         ← [SHARED] Reusable WebSocket hook with reconnection
│   ├── useProfile.ts           ← [FE1] Access profile context
│   ├── usePeerJS.ts            ← [FE2] PeerJS connection management
│   ├── useSignDetection.ts     ← [FE2] Sign detection WebSocket + frame capture
│   ├── useFaceEmotion.ts       ← [FE2] face-api.js emotion detection
│   ├── useConversation.ts      ← [FE3] Conversation WebSocket management
│   ├── useAudioRecorder.ts     ← [FE3] MediaRecorder for audio chunks
│   └── useTTS.ts               ← [FE3] TTS playback (ElevenLabs + fallback)
├── lib/
│   ├── api.ts                  ← [SHARED] REST API client (fetch wrapper)
│   ├── constants.ts            ← [SHARED] Shared constants
│   └── haptics.ts              ← [FE1] Haptic vibration patterns
└── public/
    ├── manifest.json           ← [FE1] PWA manifest
    ├── icons/                  ← [FE1] PWA icons (192px, 512px)
    │   ├── icon-192.png
    │   └── icon-512.png
    └── models/                 ← [FE2] face-api.js model weights
        ├── tiny_face_detector_model-weights_manifest.json
        ├── tiny_face_detector_model-shard1
        ├── face_expression_net-weights_manifest.json
        └── face_expression_net-shard1
```

---

## PWA SETUP (Frontend 1 — Do This First)

The app MUST be a PWA. Without this, the user sees browser chrome (URL bar, tabs) which wastes screen space and looks unprofessional on a phone.

### `public/manifest.json`

```json
{
  "name": "SenseAI",
  "short_name": "SenseAI",
  "description": "Adaptive accessibility companion",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

Key properties:
- `"display": "standalone"` — removes browser chrome, app feels native
- `"orientation": "portrait"` — locks to portrait (phone in hand)
- `"theme_color": "#0f172a"` — status bar blends with the app's dark background

### PWA Icons

Create simple placeholder icons for the hackathon:
- `public/icons/icon-192.png` (192×192px)
- `public/icons/icon-512.png` (512×512px)

Use any tool (Figma, Canva, or even a solid-color square with "S" on it). These are required for "Add to Home Screen" to work.

---

## MOBILE CSS FOUNDATION (Frontend 1 — Do This First)

### `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
 * MOBILE-FIRST CSS RESET
 * These rules fix common phone browser issues.
 * [FE1 OWNS THIS FILE]
 */

@layer base {
  /* === VIEWPORT & OVERFLOW === */

  /*
   * Use dvh (dynamic viewport height) everywhere.
   * On phones, 100vh includes the space behind the URL bar, which means
   * your layout will be taller than the visible screen. 100dvh fixes this
   * by updating when the URL bar collapses/expands.
   */
  :root {
    --app-height: 100dvh;
  }

  html, body {
    height: var(--app-height);
    overflow: hidden;              /* Prevent pull-to-refresh and bounce scroll on iOS */
    overscroll-behavior: none;     /* Prevent overscroll rubber-band on Android */
  }

  /* === TOUCH BEHAVIOR === */

  /* Remove the 300ms tap delay on older mobile browsers */
  html {
    touch-action: manipulation;
  }

  /* Remove the blue/gray highlight flash when tapping on iOS/Android */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  /* Prevent text selection on UI elements (buttons, nav) but allow on content */
  button, nav, [role="button"] {
    -webkit-user-select: none;
    user-select: none;
  }

  /* === SAFE AREAS (Notch + Home Indicator) === */

  /*
   * Modern phones have:
   * - Top: notch/Dynamic Island (safe-area-inset-top)
   * - Bottom: home indicator bar (safe-area-inset-bottom)
   *
   * In standalone PWA mode, the status bar overlaps the top of your app.
   * You MUST pad for these or UI will be hidden behind the notch/home bar.
   */

  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  /* === SCROLLABLE AREAS === */

  /* Smooth momentum scrolling for any scrollable container */
  .scroll-container {
    -webkit-overflow-scrolling: touch;
    overflow-y: auto;
    overscroll-behavior-y: contain; /* Prevent scroll chaining to parent */
  }

  /* Hide scrollbar but keep scrollable (for horizontal quick-reply scroll) */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* === IOS INPUT FIX === */

  /*
   * iOS Safari zooms in on inputs with font-size < 16px.
   * Force all inputs to 16px minimum to prevent auto-zoom.
   */
  input, textarea, select {
    font-size: 16px !important;
  }

  /* === PREVENT LANDSCAPE === */

  /*
   * Our app is portrait-only. The manifest locks orientation on installed PWAs,
   * but in-browser we show a rotate hint via CSS.
   */
  @media (orientation: landscape) and (max-height: 500px) {
    body::after {
      content: "Please rotate your phone to portrait mode";
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: white;
      font-size: 1.25rem;
      text-align: center;
      padding: 2rem;
      z-index: 99999;
    }
  }
}

/* === UTILITY CLASSES === */

@layer utilities {
  /* Full screen height accounting for mobile browser chrome */
  .h-screen-safe {
    height: 100dvh;
  }

  /* Min-height version */
  .min-h-screen-safe {
    min-height: 100dvh;
  }

  /* Bottom padding that accounts for home indicator + bottom nav */
  .pb-nav-safe {
    padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  }

  /* Top padding that accounts for notch/status bar */
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }

  /* Video element mirrored (for self-view camera) */
  .mirror {
    transform: scaleX(-1);
  }
}
```

### Tailwind Config Update

Update `tailwind.config.ts` to add mobile-specific values:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Min touch target size (Apple HIG: 44px)
      minHeight: {
        "touch": "44px",
      },
      minWidth: {
        "touch": "44px",
      },
      // Safe max-width for phone form factor
      maxWidth: {
        "phone": "430px",
      },
    },
  },
  plugins: [],
};
export default config;
```

---

## SHARED CODE (Build First — All Three Engineers Depend On This)

**Frontend 1 builds these first. Frontend 2 and 3 cannot start their pages until these exist.**

### `src/lib/constants.ts`

```typescript
/**
 * Shared constants across the entire frontend.
 * Backend URLs, WebSocket endpoints, and configuration.
 */

// Backend URLs — reads from env, falls back to localhost for dev
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

// WebSocket endpoints
export const WS_CONVERSATION = `${WS_URL}/ws/conversation`;
export const WS_SIGN_DETECTION = `${WS_URL}/ws/sign-detection`;

// REST endpoints
export const API_PROFILE = `${API_URL}/api/profile`;
export const API_TTS = `${API_URL}/api/tts`;
export const API_TTS_STREAM = `${API_URL}/api/tts/stream`;
export const API_HEALTH = `${API_URL}/health`;

// PeerJS config (WebRTC signaling)
export const PEER_CONFIG = {
  host: process.env.NEXT_PUBLIC_PEER_HOST || "0.peerjs.com",
  port: Number(process.env.NEXT_PUBLIC_PEER_PORT || 443),
  secure: process.env.NEXT_PUBLIC_PEER_SECURE === "true",
  path: "/",
};

// Sign detection config
export const SIGN_DETECTION = {
  FRAME_RATE: 10,               // Frames per second sent to backend
  FRAME_INTERVAL: 100,          // ms between frames (1000 / FRAME_RATE)
  JPEG_QUALITY: 0.6,            // JPEG compression (lower = smaller = faster over mobile data)
  CANVAS_WIDTH: 480,            // Reduced from 640 for mobile performance
  CANVAS_HEIGHT: 360,           // Reduced from 480 for mobile performance
};

// Conversation config
export const CONVERSATION = {
  AUDIO_CHUNK_INTERVAL: 3000,   // ms between audio chunk sends
  // IMPORTANT: Safari on iOS does NOT support "audio/webm".
  // We detect the supported format at runtime in useAudioRecorder.
  PREFERRED_MIME_TYPES: [
    "audio/webm;codecs=opus",  // Chrome, Firefox, Android
    "audio/webm",              // Fallback webm without codec spec
    "audio/mp4",               // Safari iOS
    "audio/aac",               // Safari iOS fallback
  ],
};

// Profile types
export type ProfileType = "deaf" | "blind";

// Channel configuration per profile
export const CHANNEL_CONFIG: Record<ProfileType, ChannelConfig> = {
  deaf: {
    audioOutput: false,
    visualOutput: true,
    hapticOutput: true,
    captions: true,
    toneBadges: true,
    quickReplies: true,
    ttsForReplies: true,
  },
  blind: {
    audioOutput: true,
    visualOutput: false,
    hapticOutput: true,
    captions: false,
    toneBadges: false,
    quickReplies: false,
    ttsForReplies: false,
    audioSummaries: true,
  },
};

export interface ChannelConfig {
  audioOutput: boolean;
  visualOutput: boolean;
  hapticOutput: boolean;
  captions: boolean;
  toneBadges: boolean;
  quickReplies: boolean;
  ttsForReplies: boolean;
  audioSummaries?: boolean;
}

/**
 * Detect the best supported audio MIME type for MediaRecorder on this device.
 * MUST be called at runtime (not at import time) because MediaRecorder is a browser API.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";

  for (const mimeType of CONVERSATION.PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`[Audio] Using MIME type: ${mimeType}`);
      return mimeType;
    }
  }
  console.warn("[Audio] No preferred MIME type supported, using default");
  return "";  // Let MediaRecorder choose its default
}

/**
 * Extract the format string (e.g., "webm", "mp4") from a MIME type.
 * The backend needs this to know how to decode the audio.
 */
export function getFormatFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm"; // Default fallback
}
```

### `src/lib/api.ts`

```typescript
/**
 * REST API client for the backend.
 * Thin wrapper around fetch with error handling.
 */

import { API_PROFILE, API_TTS } from "./constants";

export async function createProfile(profileType: string, userName: string = "User") {
  const res = await fetch(API_PROFILE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_type: profileType, user_name: userName }),
  });
  if (!res.ok) throw new Error(`Profile creation failed: ${res.status}`);
  return res.json();
}

export async function getProfile(userName: string) {
  const res = await fetch(`${API_PROFILE}/${userName}`);
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json();
}

export async function textToSpeech(text: string, voiceId?: string): Promise<ArrayBuffer> {
  const res = await fetch(API_TTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId || null }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_PROFILE.replace("/api/profile", "/health")}`);
    return res.ok;
  } catch {
    return false;
  }
}
```

### `src/hooks/useWebSocket.ts`

```typescript
/**
 * Reusable WebSocket hook with automatic reconnection.
 * Used by both the conversation and sign detection features.
 *
 * MOBILE: Phones aggressively kill background WebSocket connections.
 * This hook auto-reconnects when the app returns to foreground using visibilitychange.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  send: (data: any) => void;
  sendJSON: (data: any) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 2000,
  autoConnect = false,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const intentionalDisconnectRef = useRef(false);

  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    intentionalDisconnectRef.current = false;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`[WS] Connected to ${url}`);
        setIsConnected(true);
        reconnectCountRef.current = 0;
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          onMessageRef.current?.(event.data);
        }
      };

      ws.onclose = () => {
        console.log(`[WS] Disconnected from ${url}`);
        setIsConnected(false);
        onCloseRef.current?.();

        if (!intentionalDisconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`[WS] Reconnecting (${reconnectCountRef.current}/${reconnectAttempts})...`);
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error(`[WS] Error on ${url}:`, error);
        onErrorRef.current?.(error);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error(`[WS] Failed to connect to ${url}:`, err);
    }
  }, [url, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    reconnectCountRef.current = reconnectAttempts;
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [reconnectAttempts]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    } else {
      console.warn("[WS] Cannot send — not connected");
    }
  }, []);

  const sendJSON = useCallback((data: any) => {
    send(JSON.stringify(data));
  }, [send]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  // MOBILE: Reconnect when app returns to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (wsRef.current?.readyState !== WebSocket.OPEN && !intentionalDisconnectRef.current) {
          console.log("[WS] App foregrounded — reconnecting");
          reconnectCountRef.current = 0;
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [connect]);

  return { send, sendJSON, isConnected, connect, disconnect };
}
```

### `src/context/ProfileContext.tsx`

```typescript
/**
 * Global profile context.
 * Stores the user's profile type (deaf/blind) and channel configuration.
 * Persists to localStorage so the PWA remembers the profile across opens.
 *
 * [FE1 OWNS THIS FILE]
 */

"use client";

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from "react";
import { ProfileType, ChannelConfig, CHANNEL_CONFIG } from "@/lib/constants";

interface ProfileState {
  profileType: ProfileType | null;
  userName: string;
  channels: ChannelConfig | null;
  isOnboarded: boolean;
}

type ProfileAction =
  | { type: "SET_PROFILE"; profileType: ProfileType; userName?: string }
  | { type: "HYDRATE"; state: ProfileState }
  | { type: "RESET" };

const initialState: ProfileState = {
  profileType: null,
  userName: "User",
  channels: null,
  isOnboarded: false,
};

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case "SET_PROFILE":
      return {
        ...state,
        profileType: action.profileType,
        userName: action.userName || state.userName,
        channels: CHANNEL_CONFIG[action.profileType],
        isOnboarded: true,
      };
    case "HYDRATE":
      return action.state;
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface ProfileContextValue extends ProfileState {
  setProfile: (profileType: ProfileType, userName?: string) => void;
  reset: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const STORAGE_KEY = "senseai-profile";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(profileReducer, initialState);

  // Hydrate from localStorage on mount (PWA remembers profile across opens)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.profileType) {
          dispatch({
            type: "HYDRATE",
            state: {
              profileType: parsed.profileType,
              userName: parsed.userName || "User",
              channels: CHANNEL_CONFIG[parsed.profileType as ProfileType],
              isOnboarded: true,
            },
          });
        }
      }
    } catch {
      // localStorage unavailable — continue with default
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (state.isOnboarded) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ profileType: state.profileType, userName: state.userName })
        );
      } catch {}
    }
  }, [state.profileType, state.userName, state.isOnboarded]);

  const setProfile = (profileType: ProfileType, userName?: string) => {
    dispatch({ type: "SET_PROFILE", profileType, userName });
  };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    dispatch({ type: "RESET" });
  };

  return (
    <ProfileContext.Provider value={{ ...state, setProfile, reset }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within a ProfileProvider");
  return context;
}
```

---

## FRONTEND 1 — APP SHELL (Onboarding, Layout, Navigation, PWA)

You are the foundation. Frontend 2 and 3 depend on your layout, profile context, and navigation being ready.

**Priority order:**
1. PWA manifest + globals.css mobile reset (do this FIRST)
2. `ProfileContext.tsx` (shared — FE2/FE3 are blocked without it)
3. `layout.tsx` with the ProfileProvider wrapping the app
4. Onboarding page (2 screens: profile type selection + confirmation)
5. Navigation between modes (bottom nav with safe area for home indicator)
6. Haptic feedback utility
7. Deploy to Vercel EARLY (share HTTPS URL with team for phone testing)
8. Polish: loading states, error boundaries, "connecting to server" indicator

### `src/app/layout.tsx`

```tsx
/**
 * Root layout. Wraps app with ProfileProvider.
 * Sets PWA meta tags and mobile viewport.
 *
 * MOBILE CRITICAL:
 * - viewport-fit=cover: extends app behind notch/home indicator
 * - apple-mobile-web-app-capable: enables PWA on iOS Safari
 * - apple-mobile-web-app-status-bar-style: dark status bar blends with app
 *
 * [FE1 OWNS THIS FILE]
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProfileProvider } from "@/context/ProfileContext";
import { ModeNav } from "@/components/layout/ModeNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SenseAI — Your World, Accessible",
  description: "Adaptive accessibility companion that adapts to how you experience the world.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SenseAI",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-white h-screen-safe overflow-hidden`}>
        <ProfileProvider>
          <div className="max-w-phone mx-auto h-screen-safe overflow-hidden relative flex flex-col">
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
            <ModeNav />
          </div>
        </ProfileProvider>
      </body>
    </html>
  );
}
```

### `src/app/page.tsx`

```tsx
"use client";

import { useProfile } from "@/context/ProfileContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { isOnboarded } = useProfile();
  const router = useRouter();

  useEffect(() => {
    router.push(isOnboarded ? "/conversation" : "/onboarding");
  }, [isOnboarded, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SenseAI</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}
```

### `src/app/onboarding/page.tsx`

```tsx
/**
 * Onboarding flow — 2 screens.
 *
 * MOBILE DESIGN:
 * - Buttons full-width, 80px+ tall, in bottom half (thumb zone)
 * - High contrast white on dark
 * - No small text (min 16px)
 * - active:scale-[0.98] for tap feedback
 *
 * [FE1 OWNS THIS FILE]
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
import { createProfile } from "@/lib/api";
import { triggerHaptic } from "@/lib/haptics";
import type { ProfileType } from "@/lib/constants";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setProfile } = useProfile();
  const router = useRouter();

  const handleSelectProfile = async (profileType: ProfileType) => {
    setSelectedProfile(profileType);
    triggerHaptic("confirm");

    setIsLoading(true);
    try { await createProfile(profileType, "User"); } catch {}
    setProfile(profileType);
    setIsLoading(false);
    setStep(2);
  };

  const handleContinue = () => {
    triggerHaptic("confirm");
    router.push("/conversation");
  };

  if (step === 1) {
    return (
      <div className="flex flex-col justify-between h-full px-6 py-8">
        <div className="text-center pt-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to SenseAI</h1>
          <p className="text-slate-400 text-lg">How would you like to follow conversations?</p>
        </div>

        <div className="flex flex-col gap-4 pb-8">
          <button
            onClick={() => handleSelectProfile("deaf")}
            disabled={isLoading}
            className="w-full min-h-[80px] p-5 rounded-2xl bg-blue-600
                       active:scale-[0.98] active:bg-blue-700 transition-all text-left
                       disabled:opacity-50"
            aria-label="Show me text on screen. Best for deaf or hard of hearing users."
          >
            <span className="text-2xl mb-1 block">👁️</span>
            <span className="text-xl font-semibold block">Show me text on screen</span>
            <span className="text-blue-200 text-sm block mt-1">
              Captions, emotion context, quick-reply buttons
            </span>
          </button>

          <button
            onClick={() => handleSelectProfile("blind")}
            disabled={isLoading}
            className="w-full min-h-[80px] p-5 rounded-2xl bg-purple-600
                       active:scale-[0.98] active:bg-purple-700 transition-all text-left
                       disabled:opacity-50"
            aria-label="Read everything aloud to me. Best for visually impaired users."
          >
            <span className="text-2xl mb-1 block">🔊</span>
            <span className="text-xl font-semibold block">Read everything aloud to me</span>
            <span className="text-purple-200 text-sm block mt-1">
              Audio descriptions, spoken summaries, haptic alerts
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="text-6xl mb-6">{selectedProfile === "deaf" ? "✅" : "🎧"}</span>
        <h1 className="text-3xl font-bold text-center mb-4">You&apos;re all set!</h1>
        <p className="text-slate-300 text-center text-lg">
          {selectedProfile === "deaf"
            ? "Captions with tone context and quick-reply buttons are active."
            : "Audio summaries and spoken guidance are active."}
        </p>
      </div>
      <div className="pb-8">
        <button
          onClick={handleContinue}
          className="w-full min-h-[56px] p-4 rounded-2xl bg-green-600
                     active:scale-[0.98] active:bg-green-700 transition-all text-xl font-semibold"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
```

### `src/lib/haptics.ts`

```typescript
/**
 * Haptic feedback via Vibration API.
 *
 * MOBILE NOTE:
 * - Android Chrome: Full support ✅
 * - iOS Safari: NO support ❌ (Apple blocks Vibration API entirely)
 * - ALWAYS pair haptics with visual/audio feedback. Never rely on haptics alone.
 *
 * [FE1 OWNS THIS FILE]
 */

const PATTERNS = {
  tap: [50],
  confirm: [100],
  error: [100, 50, 100],
  newCaption: [80],
  speakerActive: [80, 60, 80, 60, 80],
  timeSensitive: [300],
  hazard: [150, 50, 150, 50, 150, 50, 150],
  signDetected: [80, 40, 80],
  newSign: [120],
} as const;

type HapticPattern = keyof typeof PATTERNS;

export function triggerHaptic(pattern: HapticPattern): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(PATTERNS[pattern]); } catch {}
  }
}

export function stopHaptic(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(0); } catch {}
  }
}
```

### `src/components/layout/ModeNav.tsx`

```tsx
/**
 * Bottom navigation. Sits above the home indicator safe area.
 * Touch targets 48px+ tall. Only visible after onboarding.
 *
 * [FE1 OWNS THIS FILE]
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
import { MessageSquare, Video } from "lucide-react";
import clsx from "clsx";

export function ModeNav() {
  const pathname = usePathname();
  const { isOnboarded } = useProfile();

  if (!isOnboarded || pathname === "/" || pathname === "/onboarding") return null;

  const tabs = [
    { href: "/conversation", label: "Listen", icon: MessageSquare },
    { href: "/video-call", label: "Video Call", icon: Video },
  ];

  return (
    <nav
      className="bg-slate-900 border-t border-slate-800 flex-shrink-0"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex-1 flex flex-col items-center py-3 min-h-touch transition-colors",
                isActive ? "text-blue-400 bg-slate-800/50" : "text-slate-500 active:text-slate-300"
              )}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## FRONTEND 2 — VIDEO CALL + SIGN DETECTION

### `src/hooks/usePeerJS.ts`

```typescript
/**
 * PeerJS WebRTC hook for 1-on-1 video calls.
 *
 * MOBILE CAMERA:
 * - facingMode: "user" = front (selfie) camera
 * - Resolution capped at 640×480 to save battery
 * - Frame rate capped at 24fps
 * - getUserMedia REQUIRES HTTPS on phones (localhost exempt for dev)
 * - iOS: video elements MUST have playsInline or they go fullscreen
 *
 * [FE2 OWNS THIS FILE]
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer, { MediaConnection } from "peerjs";
import { PEER_CONFIG } from "@/lib/constants";

export function usePeerJS() {
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
            facingMode: "user",
            frameRate: { ideal: 24, max: 30 },
          },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!mounted) return;
        setLocalStream(stream);

        const peer = new Peer({
          host: PEER_CONFIG.host, port: PEER_CONFIG.port,
          secure: PEER_CONFIG.secure, path: PEER_CONFIG.path,
        });

        peer.on("open", (id) => { if (mounted) { setPeerId(id); setIsConnected(true); } });

        peer.on("call", (incomingCall) => {
          incomingCall.answer(stream);
          incomingCall.on("stream", (remote) => { if (mounted) { setRemoteStream(remote); setIsCallActive(true); } });
          incomingCall.on("close", () => { if (mounted) { setRemoteStream(null); setIsCallActive(false); } });
          callRef.current = incomingCall;
        });

        peer.on("error", (err) => setError(err.message));
        peerRef.current = peer;
      } catch (err: any) {
        if (err.name === "NotAllowedError") setError("Camera/mic permission denied. Allow access in phone settings.");
        else if (err.name === "NotFoundError") setError("No camera or microphone found.");
        else setError(err.message || "Failed to access camera/microphone");
      }
    }

    init();
    return () => { mounted = false; callRef.current?.close(); peerRef.current?.destroy(); };
  }, []);

  // Release camera on unmount (saves battery)
  useEffect(() => { return () => { localStream?.getTracks().forEach((t) => t.stop()); }; }, [localStream]);

  const call = useCallback((remotePeerId: string) => {
    if (!peerRef.current || !localStream) { setError("Peer not ready"); return; }
    const outgoing = peerRef.current.call(remotePeerId, localStream);
    outgoing.on("stream", (r) => { setRemoteStream(r); setIsCallActive(true); });
    outgoing.on("close", () => { setRemoteStream(null); setIsCallActive(false); });
    callRef.current = outgoing;
  }, [localStream]);

  const endCall = useCallback(() => { callRef.current?.close(); callRef.current = null; setRemoteStream(null); setIsCallActive(false); }, []);

  const toggleMute = useCallback(() => {
    const t = localStream?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    const t = localStream?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsVideoOff(!t.enabled); }
  }, [localStream]);

  return { peerId, localStream, remoteStream, isConnected, isCallActive, error, call, endCall, toggleMute, toggleVideo, isMuted, isVideoOff };
}
```

### `src/hooks/useSignDetection.ts`

```typescript
/**
 * Sign detection: captures frames → WebSocket → predictions.
 * Canvas 480×360 at 0.6 JPEG quality for mobile network performance.
 *
 * Protocol (matches backend /ws/sign-detection):
 *   Send:    { type: "frame", frame: "<base64 jpeg>" }
 *   Receive: { type: "sign_prediction", sign, confidence, is_stable, is_new_sign, hands_detected }
 *   Receive: { type: "buffering", frames_collected, frames_needed, hands_detected }
 *
 * [FE2 OWNS THIS FILE]
 */

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { WS_SIGN_DETECTION, SIGN_DETECTION } from "@/lib/constants";

interface SignPrediction { sign: string; confidence: number; isStable: boolean; isNewSign: boolean; handsDetected: boolean; }

export function useSignDetection() {
  const [currentSign, setCurrentSign] = useState<SignPrediction | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((data: any) => {
    if (data.type === "sign_prediction") {
      setCurrentSign({ sign: data.sign, confidence: data.confidence, isStable: data.is_stable, isNewSign: data.is_new_sign, handsDetected: data.hands_detected });
      setHandsDetected(data.hands_detected);
      setBufferProgress(1);
    } else if (data.type === "buffering") {
      setHandsDetected(data.hands_detected);
      setBufferProgress(data.frames_collected / data.frames_needed);
    }
  }, []);

  const { send, isConnected, connect, disconnect } = useWebSocket({ url: WS_SIGN_DETECTION, onMessage: handleMessage });

  const startDetection = useCallback((videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = SIGN_DETECTION.CANVAS_WIDTH;
      canvasRef.current.height = SIGN_DETECTION.CANVAS_HEIGHT;
    }
    connect();
    setIsDetecting(true);
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, SIGN_DETECTION.CANVAS_WIDTH, SIGN_DETECTION.CANVAS_HEIGHT);
      const base64 = canvasRef.current.toDataURL("image/jpeg", SIGN_DETECTION.JPEG_QUALITY).split(",")[1];
      send({ type: "frame", frame: base64 });
    }, SIGN_DETECTION.FRAME_INTERVAL);
  }, [connect, send]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsDetecting(false);
    disconnect();
  }, [disconnect]);

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  return { currentSign, isDetecting, handsDetected, bufferProgress, startDetection, stopDetection, isConnected };
}
```

### `src/hooks/useFaceEmotion.ts`

```typescript
/**
 * Face emotion detection via face-api.js.
 * 1 FPS on mobile (CPU-only, battery conscious). Skips if previous frame still processing.
 * Returns: angry, disgusted, fearful, happy, neutral, sad, surprised
 *
 * [FE2 OWNS THIS FILE]
 */

"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface FaceEmotion { dominant: string; confidence: number; all: Record<string, number>; }

export function useFaceEmotion() {
  const [emotion, setEmotion] = useState<FaceEmotion | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceapiRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    async function loadModels() {
      try {
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        setIsLoaded(true);
      } catch (err) { console.error("[FaceEmotion] Load failed:", err); }
    }
    loadModels();
  }, []);

  const startDetection = useCallback((videoElement: HTMLVideoElement) => {
    if (!isLoaded || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    intervalRef.current = setInterval(async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        const det = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (det.length > 0) {
          const entries = Object.entries(det[0].expressions) as [string, number][];
          const sorted = entries.sort((a, b) => b[1] - a[1]);
          setEmotion({ dominant: sorted[0][0], confidence: sorted[0][1], all: Object.fromEntries(entries) });
        }
      } catch {} finally { isProcessingRef.current = false; }
    }, 1000); // 1 FPS on mobile
  }, [isLoaded]);

  const stopDetection = useCallback(() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }, []);
  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  return { emotion, isLoaded, startDetection, stopDetection };
}
```

### `src/app/video-call/page.tsx`

```tsx
/**
 * Video Call page.
 *
 * MOBILE LAYOUT (portrait):
 *   ┌────────────────────────┐  ← behind notch
 *   │  ┌──────┐              │  ← Self-view PiP (100×75, top-right)
 *   │  │ Self │              │
 *   │  └──────┘              │
 *   │                        │
 *   │   Remote video (60%)   │
 *   │                        │
 *   │  ╔══════════════════╗  │  ← Sign overlay
 *   │  ║   "Hello" 95%    ║  │
 *   │  ╚══════════════════╝  │
 *   ├────────────────────────┤
 *   │ [🎤] [📹] [📞 End]   │  ← Controls (48×48 touch targets)
 *   ├────────────────────────┤
 *   │ Room: abc123 [Copy]    │
 *   │ [Enter code] [Join]    │
 *   ├────────────────────────┤
 *   │ [Listen]  [Video Call] │  ← Bottom nav + safe area
 *   └────────────────────────┘
 *
 * ALL <video> elements MUST have playsInline (iOS fullscreen prevention).
 *
 * [FE2 OWNS THIS FILE]
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { usePeerJS } from "@/hooks/usePeerJS";
import { useSignDetection } from "@/hooks/useSignDetection";
import { useProfile } from "@/context/ProfileContext";
import { triggerHaptic } from "@/lib/haptics";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Hand } from "lucide-react";
import clsx from "clsx";

export default function VideoCallPage() {
  const { peerId, localStream, remoteStream, isConnected, isCallActive, error, call, endCall, toggleMute, toggleVideo, isMuted, isVideoOff } = usePeerJS();
  const { currentSign, isDetecting, handsDetected, bufferProgress, startDetection, stopDetection, isConnected: signWsConnected } = useSignDetection();
  const { channels, profileType } = useProfile();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [joinId, setJoinId] = useState("");
  const [recentSigns, setRecentSigns] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { if (localVideoRef.current && localStream && !isDetecting) startDetection(localVideoRef.current); return () => stopDetection(); }, [localStream]);

  useEffect(() => {
    if (currentSign?.isNewSign && currentSign.isStable) {
      setRecentSigns((prev) => [currentSign.sign, ...prev].slice(0, 10));
      triggerHaptic("signDetected");
      if (profileType === "blind" && currentSign.sign) {
        const u = new SpeechSynthesisUtterance(currentSign.sign); u.rate = 0.9; window.speechSynthesis.speak(u);
      }
    }
  }, [currentSign, profileType]);

  const handleCopyId = () => { if (peerId) { navigator.clipboard.writeText(peerId); setCopied(true); triggerHaptic("confirm"); setTimeout(() => setCopied(false), 2000); } };
  const handleJoin = () => { if (joinId.trim()) { call(joinId.trim()); triggerHaptic("confirm"); } };

  return (
    <div className="flex flex-col h-full">
      {/* Video area */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {isCallActive ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center px-8">
              <Video size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg">Share your room code</p>
              <p className="text-sm mt-1 text-slate-600">Your partner enters it on their phone</p>
            </div>
          </div>
        )}

        {/* Self-view PiP */}
        <div className="absolute top-3 right-3 w-[100px] h-[75px] rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
        </div>

        {/* Sign overlay */}
        {currentSign?.isStable && currentSign.sign && channels?.visualOutput && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold">{currentSign.sign}</p>
              <p className="text-xs text-slate-400 mt-1">{Math.round(currentSign.confidence * 100)}%</p>
            </div>
          </div>
        )}

        {/* Hand hint */}
        {isDetecting && !handsDetected && (
          <div className="absolute top-3 left-3 right-[120px]">
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-2 flex items-center gap-2 text-yellow-300 text-sm">
              <Hand size={16} /> Show your hands
            </div>
          </div>
        )}

        {/* Buffer */}
        {isDetecting && bufferProgress > 0 && bufferProgress < 1 && (
          <div className="absolute top-3 left-3">
            <div className="bg-slate-800/80 rounded-full px-3 py-1 text-xs text-slate-300">{Math.round(bufferProgress * 100)}%</div>
          </div>
        )}

        {/* Recent signs */}
        {recentSigns.length > 0 && channels?.visualOutput && (
          <div className="absolute bottom-16 left-3 right-3 flex gap-1 overflow-x-auto no-scrollbar">
            {recentSigns.slice(0, 5).map((sign, i) => (
              <span key={`${sign}-${i}`} className={clsx("px-2 py-1 rounded-full text-xs flex-shrink-0", i === 0 ? "bg-blue-500 text-white" : "bg-slate-700/80 text-slate-300")}>{sign}</span>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border-t border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-center gap-4 p-3">
          <button onClick={toggleMute} className={clsx("w-12 h-12 rounded-full flex items-center justify-center", isMuted ? "bg-red-600" : "bg-slate-700 active:bg-slate-600")} aria-label={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button onClick={toggleVideo} className={clsx("w-12 h-12 rounded-full flex items-center justify-center", isVideoOff ? "bg-red-600" : "bg-slate-700 active:bg-slate-600")} aria-label={isVideoOff ? "Camera on" : "Camera off"}>
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          {isCallActive && (
            <button onClick={endCall} className="w-12 h-12 rounded-full bg-red-600 active:bg-red-500 flex items-center justify-center" aria-label="End call">
              <PhoneOff size={20} />
            </button>
          )}
        </div>

        {!isCallActive && (
          <div className="px-4 pb-3 space-y-2">
            {peerId && (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-800 rounded-lg px-3 py-2.5 font-mono text-slate-300 truncate text-sm">{peerId}</div>
                <button onClick={handleCopyId} className="w-11 h-11 bg-slate-700 rounded-lg active:bg-slate-600 flex items-center justify-center flex-shrink-0" aria-label="Copy">
                  <Copy size={18} />
                </button>
              </div>
            )}
            {copied && <p className="text-green-400 text-xs text-center">Copied! Share with your partner.</p>}
            <div className="flex items-center gap-2">
              <input type="text" value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Partner's room code"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
              <button onClick={handleJoin} disabled={!joinId.trim()}
                className="h-11 px-5 bg-blue-600 rounded-lg font-medium active:bg-blue-500 disabled:opacity-50 flex-shrink-0">Join</button>
            </div>
          </div>
        )}
        {error && <div className="px-4 pb-2"><p className="text-red-400 text-xs">{error}</p></div>}
      </div>
    </div>
  );
}
```

### Face-API.js Models

Download into `public/models/`:
- `tiny_face_detector_model-weights_manifest.json` + shard1
- `face_expression_net-weights_manifest.json` + shard1

Source: https://github.com/niconielsen32/ComputerVision/tree/master/facedetection/models

---

## FRONTEND 3 — CONVERSATION INTELLIGENCE

### `src/hooks/useAudioRecorder.ts`

```typescript
/**
 * Audio recording via MediaRecorder.
 *
 * MOBILE/iOS CRITICAL:
 * - Safari iOS does NOT support audio/webm → auto-detects mp4/aac via getSupportedAudioMimeType()
 * - Sends format string alongside audio so backend knows the codec
 * - echoCancellation + noiseSuppression essential for phone speakers
 * - getUserMedia REQUIRES HTTPS
 *
 * [FE3 OWNS THIS FILE]
 */

"use client";

import { useRef, useState, useCallback } from "react";
import { CONVERSATION, getSupportedAudioMimeType, getFormatFromMime } from "@/lib/constants";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const callbackRef = useRef<((b64: string, fmt: string) => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef("");

  const onChunkReady = useCallback((cb: (b64: string, fmt: string) => void) => { callbackRef.current = cb; }, []);

  const sendChunks = useCallback(() => {
    if (chunksRef.current.length === 0 || !callbackRef.current) return;
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    chunksRef.current = [];
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && callbackRef.current) {
        callbackRef.current((reader.result as string).split(",")[1], getFormatFromMime(mimeTypeRef.current));
      }
    };
    reader.readAsDataURL(blob);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = getSupportedAudioMimeType();
      mimeTypeRef.current = mimeType;
      const opts: MediaRecorderOptions = {};
      if (mimeType) opts.mimeType = mimeType;
      const mr = new MediaRecorder(stream, opts);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(500);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setError(null);
      intervalRef.current = setInterval(sendChunks, CONVERSATION.AUDIO_CHUNK_INTERVAL);
    } catch (err: any) {
      setError(err.name === "NotAllowedError" ? "Microphone permission denied. Allow in phone settings." : err.message || "Mic access failed");
    }
  }, [sendChunks]);

  const stopRecording = useCallback(() => {
    sendChunks();
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop()); mediaRecorderRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsRecording(false);
  }, [sendChunks]);

  return { isRecording, startRecording, stopRecording, onChunkReady, error };
}
```

### `src/hooks/useConversation.ts`

```typescript
/**
 * Conversation WebSocket hook.
 *
 * Protocol (matches backend /ws/conversation exactly):
 *   Send:    { type: "start_listening" }
 *   Send:    { type: "stop_listening" }
 *   Send:    { type: "set_profile", profile_type: "deaf" | "blind" }
 *   Send:    { type: "audio_chunk", audio: "<base64>", format: "webm" | "mp4" }
 *   Receive: { type: "transcript", text, tone, tone_category, tone_confidence, top_emotions }
 *   Receive: { type: "simplified", text, quick_replies: [{label, spoken_text}] }
 *   Receive: { type: "summary", text }
 *   Receive: { type: "status", message }
 *   Receive: { type: "error", message }
 *
 * [FE3 OWNS THIS FILE]
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { WS_CONVERSATION } from "@/lib/constants";
import type { ProfileType } from "@/lib/constants";

export interface TranscriptEntry {
  id: string; text: string; simplifiedText?: string; tone: string;
  toneCategory: string; toneConfidence: number;
  quickReplies: { label: string; spoken_text: string }[];
  timestamp: Date;
}

export function useConversation() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState("idle");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countRef = useRef(0);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case "transcript":
        setEntries((prev) => [...prev, { id: `e-${countRef.current++}`, text: data.text, tone: data.tone || "speaking", toneCategory: data.tone_category || "neutral", toneConfidence: data.tone_confidence || 0, quickReplies: [], timestamp: new Date() }]);
        break;
      case "simplified":
        setEntries((prev) => { const u = [...prev]; if (u.length) u[u.length - 1] = { ...u[u.length - 1], simplifiedText: data.text, quickReplies: data.quick_replies || [] }; return u; });
        break;
      case "summary":
        if (data.text && typeof window !== "undefined") { const u = new SpeechSynthesisUtterance(data.text); u.rate = 0.95; window.speechSynthesis.speak(u); }
        break;
      case "status": setStatus(data.message); break;
      case "error": setError(data.message); break;
    }
  }, []);

  const { send, isConnected, connect, disconnect } = useWebSocket({ url: WS_CONVERSATION, onMessage: handleMessage });

  const startListening = useCallback((profileType: ProfileType) => {
    connect();
    setTimeout(() => { send({ type: "set_profile", profile_type: profileType }); send({ type: "start_listening" }); setIsListening(true); setError(null); }, 500);
  }, [connect, send]);

  const stopListening = useCallback(() => { send({ type: "stop_listening" }); setIsListening(false); }, [send]);
  const sendAudioChunk = useCallback((b64: string, fmt: string) => { send({ type: "audio_chunk", audio: b64, format: fmt }); }, [send]);
  const clearEntries = useCallback(() => { setEntries([]); countRef.current = 0; }, []);

  return { entries, latestEntry: entries[entries.length - 1] || null, status, isListening, isConnected, startListening, stopListening, sendAudioChunk, clearEntries, error };
}
```

### `src/hooks/useTTS.ts`

```typescript
/**
 * TTS playback. Backend ElevenLabs + Web Speech API fallback.
 *
 * MOBILE: iOS blocks audio unless triggered by user gesture (tap).
 * speak() MUST be called from a click handler, NOT from useEffect/WebSocket.
 *
 * [FE3 OWNS THIS FILE]
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { textToSpeech } from "@/lib/api";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fallbackSpeak = useCallback((text: string) => {
    if (typeof window === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      const buf = await textToSpeech(text);
      if (buf.byteLength > 0) {
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        const audio = new Audio(url);
        audio.setAttribute("playsinline", "true");
        audioRef.current = audio;
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { fallbackSpeak(text); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch { /* fall through */ }
    fallbackSpeak(text);
  }, [fallbackSpeak]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, isSpeaking, stop };
}
```

### `src/app/conversation/page.tsx`

```tsx
/**
 * Conversation Intelligence — the core experience.
 *
 * MOBILE LAYOUT:
 *   ┌────────────────────────┐
 *   │ ● Listening...         │  ← Status (compact)
 *   ├────────────────────────┤
 *   │ 😊 carefully           │  ← Caption feed (momentum scroll)
 *   │ "Your results look     │
 *   │  really good overall"  │
 *   │ 😐 speaking            │
 *   │ "Hemoglobin A1C is     │
 *   │  slightly elevated"    │
 *   │  → "Blood sugar is     │  ← Simplified (blue bar)
 *   │    a bit high"         │
 *   ├────────────────────────┤
 *   │ [How serious?] [I see] │  ← Quick replies (horizontal scroll)
 *   ├────────────────────────┤
 *   │ [One moment] [Repeat]  │  ← Persistent replies
 *   ├────────────────────────┤
 *   │    🎙️ LISTEN           │  ← Primary action (56px, full width)
 *   ├────────────────────────┤
 *   │ [Listen]  [Video Call] │  ← Bottom nav + safe area
 *   └────────────────────────┘
 *
 * TTS triggered from tap handlers (iOS audio policy).
 *
 * [FE3 OWNS THIS FILE]
 */

"use client";

import { useEffect, useRef } from "react";
import { useConversation } from "@/hooks/useConversation";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTTS } from "@/hooks/useTTS";
import { useProfile } from "@/context/ProfileContext";
import { triggerHaptic } from "@/lib/haptics";
import { Mic, MicOff, Volume2 } from "lucide-react";
import clsx from "clsx";

const TONE_EMOJI: Record<string, string> = { positive: "😊", neutral: "😐", negative: "😟", concern: "🤔" };
const TONE_COLOR: Record<string, string> = {
  positive: "text-green-400 bg-green-400/10 border-green-400/30",
  neutral: "text-slate-400 bg-slate-400/10 border-slate-400/30",
  negative: "text-red-400 bg-red-400/10 border-red-400/30",
  concern: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

export default function ConversationPage() {
  const { profileType, channels } = useProfile();
  const { entries, status, isListening, isConnected, startListening, stopListening, sendAudioChunk, error } = useConversation();
  const { isRecording, startRecording, stopRecording, onChunkReady } = useAudioRecorder();
  const { speak, isSpeaking } = useTTS();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onChunkReady((b64, fmt) => sendAudioChunk(b64, fmt)); }, [onChunkReady, sendAudioChunk]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [entries]);
  useEffect(() => { if (entries.length > 0) triggerHaptic("newCaption"); }, [entries.length]);

  const handleToggle = async () => {
    if (isListening) { stopRecording(); stopListening(); }
    else { startListening(profileType || "deaf"); await startRecording(); }
  };

  const handleQuickReply = async (spoken: string) => { triggerHaptic("confirm"); await speak(spoken); };

  const latest = entries[entries.length - 1];

  return (
    <div className="flex flex-col h-full">
      {/* Status */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
        <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", isListening ? "bg-green-500 animate-pulse" : "bg-slate-600")} />
        <span className="text-sm text-slate-400 truncate">
          {isListening ? (status === "processing" ? "Processing..." : "Listening...") : "Tap Listen to start"}
        </span>
        {!isConnected && isListening && <span className="text-xs text-yellow-500 ml-auto flex-shrink-0">Connecting...</span>}
      </div>

      {/* Caption feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-container">
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-600">
            <div className="text-center px-4">
              <Mic size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-base">Tap <strong>Listen</strong> below</p>
              <p className="text-sm mt-1">Captions with tone will appear here</p>
            </div>
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="space-y-1">
            <div className="flex items-start gap-2">
              {channels?.toneBadges && (
                <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border flex-shrink-0 mt-0.5", TONE_COLOR[e.toneCategory] || TONE_COLOR.neutral)}>
                  {TONE_EMOJI[e.toneCategory] || "😐"} <span>{e.tone}</span>
                </span>
              )}
              <p className="text-slate-300 text-[15px] leading-relaxed">{e.text}</p>
            </div>
            {e.simplifiedText && e.simplifiedText !== e.text && (
              <p className="text-white text-[15px] pl-3 border-l-2 border-blue-500/50">{e.simplifiedText}</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick replies */}
      {channels?.quickReplies && latest?.quickReplies.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-900/80 border-t border-slate-800 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {latest.quickReplies.map((r, i) => (
              <button key={i} onClick={() => handleQuickReply(r.spoken_text)} disabled={isSpeaking}
                className="min-h-touch px-4 py-2.5 bg-blue-600 active:bg-blue-700 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Volume2 size={14} /> {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persistent replies */}
      {channels?.quickReplies && isListening && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/50 flex-shrink-0">
          <div className="flex gap-2">
            <button onClick={() => handleQuickReply("One moment please.")} disabled={isSpeaking}
              className="min-h-[36px] px-3 py-1.5 bg-slate-700 active:bg-slate-600 rounded-lg text-xs text-slate-300">One moment</button>
            <button onClick={() => handleQuickReply("Could you repeat that please?")} disabled={isSpeaking}
              className="min-h-[36px] px-3 py-1.5 bg-slate-700 active:bg-slate-600 rounded-lg text-xs text-slate-300">Repeat that</button>
          </div>
        </div>
      )}

      {/* Listen button */}
      <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex-shrink-0">
        <button onClick={handleToggle}
          className={clsx("w-full min-h-[56px] py-4 rounded-2xl text-lg font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98]",
            isListening ? "bg-red-600 active:bg-red-700" : "bg-blue-600 active:bg-blue-700")}
          aria-label={isListening ? "Stop listening" : "Start listening"}>
          {isListening ? <><MicOff size={24} /> Stop Listening</> : <><Mic size={24} /> Listen</>}
        </button>
        {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
      </div>
    </div>
  );
}
```

---

## DEPLOYMENT TO VERCEL

### Deploy Early (Hour 4-6) — Team Needs HTTPS for Phone Testing

1. Push to GitHub
2. https://vercel.com → New Project → Import repo
3. Framework: Next.js (auto-detected)
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://senseai-backend-production.up.railway.app
   NEXT_PUBLIC_WS_URL=wss://senseai-backend-production.up.railway.app
   ```
5. Deploy

Tell the backend lead: `"My Vercel URL is https://senseai-frontend.vercel.app — add to CORS."`

### Test PWA Install on Phone

1. Open the Vercel URL in Chrome (Android) or Safari (iOS)
2. **Android:** ⋮ → "Add to Home Screen"
3. **iOS:** Share → "Add to Home Screen"
4. Open from home screen — should launch fullscreen, no browser chrome

---

## iOS vs ANDROID COMPATIBILITY

| Feature | Android Chrome ✅ | iOS Safari ⚠️ | Workaround |
|---------|-------------------|---------------|------------|
| MediaRecorder (webm) | ✅ | ❌ Not supported | Auto-detects mp4/aac |
| Vibration API | ✅ | ❌ Not supported | Pair with visual/audio |
| getUserMedia | ✅ (HTTPS) | ✅ (HTTPS) | Deploy to Vercel |
| WebSocket | ✅ | ✅ | Reconnect on foreground |
| PeerJS WebRTC | ✅ | ✅ | playsInline on videos |
| Web Speech TTS | ✅ | ✅ | — |
| Audio autoplay | ⚠️ User gesture | ⚠️ User gesture | Call from tap handler |
| PWA standalone | ✅ Full | ⚠️ Limited | No push notifs on iOS |
| playsInline video | ✅ Default | ❌ Must set | Always add attribute |
| face-api.js | ✅ | ✅ (slow) | 1 FPS, TinyFaceDetector |

---

## COMMON ISSUES AND FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| Camera/mic blocked on phone | No HTTPS | Deploy to Vercel or use ngrok |
| iOS video goes fullscreen | No `playsInline` | Add to ALL `<video>` elements |
| iOS zooms on input tap | Font < 16px | globals.css forces 16px on inputs |
| `100vh` too tall on phone | Browser chrome | Use `h-screen-safe` (100dvh) |
| Content behind notch | No safe area | body padding in globals.css |
| Content behind home bar | No bottom safe area | ModeNav pads for it |
| Audio won't play on phone | Autoplay policy | Call from onClick handler |
| MediaRecorder fails Safari | No webm support | `getSupportedAudioMimeType()` handles it |
| WebSocket dies on lock screen | OS kills background | Reconnects on `visibilitychange` |
| Pull-to-refresh scrolls app | iOS default | `overscroll-behavior: none` on body |
| Buttons hard to tap | Target < 44px | Use `min-h-touch` (44px minimum) |
| PeerJS fails | NAT/firewall | Same WiFi at hackathon works |
| `window is not defined` | SSR + browser API | `"use client"` directive |

---

## TIMELINE BY ENGINEER

### Frontend 1 — App Shell
```
HOUR 0-2:   Create project, install deps, push to GitHub
HOUR 2-4:   globals.css mobile reset, ProfileContext, constants, useWebSocket, manifest.json
            ⚡ TEAM IS BLOCKED UNTIL THESE SHIP
HOUR 4-6:   layout.tsx, onboarding page, ModeNav, haptics
            🚀 DEPLOY TO VERCEL — share URL
HOUR 6-8:   Test PWA install on Android + iOS, share URL with backend for CORS
HOUR 8-12:  Connection status indicator, loading states, error boundaries
HOUR 12+:   Polish, accessibility audit (VoiceOver/TalkBack), landscape blocker
```

### Frontend 2 — Video Call
```
HOUR 0-4:   Wait for FE1 shared code. Read PeerJS docs. Download face-api models.
HOUR 4-8:   usePeerJS, basic video page with local camera working
HOUR 8-12:  Room code (copy/join), test 2-phone call via Vercel
HOUR 12-16: useSignDetection, sign overlay on video
HOUR 16-20: useFaceEmotion (1 FPS), emotion badges, sign history
HOUR 20-24: Polish controls (48×48), hand guide, blind profile TTS
HOUR 24+:   Test with ML lead's model, test on iOS Safari
```

### Frontend 3 — Conversation
```
HOUR 0-4:   Wait for FE1 shared code. Read MediaRecorder + iOS audio docs.
HOUR 4-8:   useAudioRecorder (with iOS mp4 fallback), test on phone
HOUR 8-12:  useConversation, send audio chunks, verify transcripts
HOUR 12-16: conversation page with caption feed, tone badges, quick-replies
HOUR 16-20: useTTS, quick-reply → TTS → audio plays (TEST ON iOS!)
HOUR 20-24: Persistent replies, simplified text, blind profile audio summaries
HOUR 24+:   Smooth scroll, long conversation perf, edge cases, iOS Safari test
```

---

## GIT WORKFLOW

```bash
git checkout -b fe1/app-shell    # Frontend 1
git checkout -b fe2/video-call   # Frontend 2
git checkout -b fe3/conversation # Frontend 3
```

**File ownership is strict:**
- **FE1:** layout, page, onboarding/, context/, lib/, components/layout/, components/ui/, globals.css, manifest.json, tailwind.config
- **FE2:** video-call/, usePeerJS, useSignDetection, useFaceEmotion, components/video-call/, public/models/
- **FE3:** conversation/, useConversation, useAudioRecorder, useTTS, components/conversation/

**Shared files** (useWebSocket, constants, api, ProfileContext): Only FE1 edits. FE2/FE3 request changes.

---

## MOBILE DESIGN CHECKLIST (All Engineers — Verify Before "Done")

- [ ] Touch targets ≥44×44px on every button/link
- [ ] `active:` states (not hover-only) for tap feedback
- [ ] Text ≥14px body, ≥12px labels
- [ ] No horizontal overflow / side-scroll
- [ ] Scrollable areas use `scroll-container` class
- [ ] ALL `<video>` tags have `playsInline`
- [ ] Audio playback called from tap handler (not useEffect)
- [ ] Content not behind notch or home indicator
- [ ] Layout survives keyboard open (inputs don't push off screen)
- [ ] Works at 375px width minimum
- [ ] App shell loads when backend is down (shows "connecting")
- [ ] Tested on actual phone (not just Chrome DevTools)
