"use client";

import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe, type Progress } from "./progress";

export function useProgress(): Progress | null {
  return useSyncExternalStore<Progress | null>(subscribe, getSnapshot, () => null);
}
