"use client";

import { useEffect } from "react";
import { applyUserSettings } from "@/lib/accessibility";
import { DEFAULT_SETTINGS, readUserConfig } from "@/lib/profile";

export function AccessibilityBoot() {
  useEffect(() => {
    const config = readUserConfig();
    applyUserSettings(config?.settings ?? DEFAULT_SETTINGS);
  }, []);

  return null;
}
