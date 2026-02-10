import type { UserSettings } from "./profile";

export function clampTextScale(value: number): number {
  if (Number.isNaN(value)) return 100;
  return Math.max(90, Math.min(140, Math.round(value)));
}

export function applyTextScale(scale: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${clampTextScale(scale)}%`;
}

export function applyHighContrast(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("high-contrast", enabled);
}

export function applyUserSettings(settings: UserSettings): void {
  applyTextScale(settings.textScale);
  applyHighContrast(settings.highContrast);
}

export function mergeSettings(settings?: Partial<UserSettings>): UserSettings {
  return {
    textScale: clampTextScale(settings?.textScale ?? 100),
    highContrast: settings?.highContrast ?? true,
    audioPrompts: settings?.audioPrompts ?? true,
  };
}
