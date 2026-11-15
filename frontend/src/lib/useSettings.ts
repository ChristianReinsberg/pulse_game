"use client";

import { useSyncExternalStore } from "react";
import { getSettings, subscribeSettings, type Settings } from "./settings";

export function useSettings(): Settings | null {
  return useSyncExternalStore<Settings | null>(subscribeSettings, getSettings, () => null);
}
