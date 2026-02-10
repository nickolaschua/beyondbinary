import { mergeSettings } from "./accessibility";

export type UserProfileId = "blind" | "deaf" | "mute" | "deafblind";

export interface UserProfile {
  id: UserProfileId;
  label: string;
  description: string;
  incoming: string[];
  outgoing: string[];
  braillePriority: boolean;
}

export interface UserSettings {
  textScale: number;
  highContrast: boolean;
  audioPrompts: boolean;
}

export interface UserConfig {
  profileId: UserProfileId;
  settings: UserSettings;
}

export const PROFILES: UserProfile[] = [
  {
    id: "blind",
    label: "Blind",
    description: "Audio and braille first. Tone labels stay enabled.",
    incoming: ["Braille output", "Speech narration", "Tone identification"],
    outgoing: ["Text-to-speech", "Message cards"],
    braillePriority: true,
  },
  {
    id: "deaf",
    label: "Deaf",
    description: "Large captions and sign support, no dependency on audio output.",
    incoming: ["Captions", "Sign interpretation", "Tone identification"],
    outgoing: ["Text output", "Message cards"],
    braillePriority: false,
  },
  {
    id: "mute",
    label: "Mute",
    description: "Read and understand incoming conversation, respond via text/speech tools.",
    incoming: ["Captions", "Sign interpretation", "Audio/tone context"],
    outgoing: ["Text-to-speech", "Text output"],
    braillePriority: false,
  },
  {
    id: "deafblind",
    label: "Deafblind",
    description: "Braille always-on with optional audio cues and simplified visuals.",
    incoming: ["Braille output", "Optional audio prompts", "Tone labels"],
    outgoing: ["Text-to-speech", "Message cards"],
    braillePriority: true,
  },
];

export const DEFAULT_SETTINGS: UserSettings = {
  textScale: 100,
  highContrast: true,
  audioPrompts: true,
};

const STORAGE_KEY = "senseai-user-config";

export function getProfile(profileId: UserProfileId): UserProfile {
  return PROFILES.find((profile) => profile.id === profileId) ?? PROFILES[0];
}

export function readUserConfig(): UserConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<UserConfig>;
    if (!parsed || !parsed.profileId) return null;
    if (!PROFILES.some((profile) => profile.id === parsed.profileId)) return null;
    return {
      profileId: parsed.profileId,
      settings: mergeSettings(parsed.settings),
    };
  } catch {
    return null;
  }
}

export function writeUserConfig(config: UserConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profileId: config.profileId,
      settings: mergeSettings(config.settings),
    })
  );
}
