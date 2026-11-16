"use client";

import { useSyncExternalStore } from "react";
import { getUserLevels, subscribeUserLevels, type UserLevels } from "./userLevels";

export function useUserLevels(): UserLevels | null {
  return useSyncExternalStore<UserLevels | null>(subscribeUserLevels, getUserLevels, () => null);
}
