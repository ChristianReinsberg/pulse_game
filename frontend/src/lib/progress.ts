import type { LevelDef } from "@/game/pulse-core";
import { createStore } from "./store";

export const STORAGE_KEY = "pulse:progress:v1";

export interface Progress {
  version: 1;
  best: Record<number, number>;
}

const empty = (): Progress => ({ version: 1, best: {} });

export function parse(raw: string | null): Progress {
  if (!raw) return empty();
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || typeof data.best !== "object" || data.best === null) return empty();
    const best: Record<number, number> = {};
    for (const [k, v] of Object.entries(data.best)) {
      const id = Number(k);
      if (Number.isInteger(id) && id > 0 && Number.isInteger(v) && (v as number) > 0) best[id] = v as number;
    }
    return { version: 1, best };
  } catch {
    return empty();
  }
}

const store = createStore<Progress>(STORAGE_KEY, parse, empty);

export const getSnapshot = store.getSnapshot;
export const subscribe = store.subscribe;
export const resetProgress = store.reset;

export interface WinResult {
  best: number;
  firstClear: boolean;
  improved: boolean;
}

export function recordWin(levelId: number, moves: number): WinResult {
  const current = getSnapshot();
  const prev = current.best[levelId];
  const firstClear = prev === undefined;
  const improved = !firstClear && moves < prev;

  if (firstClear || improved) store.set({ version: 1, best: { ...current.best, [levelId]: moves } });
  return { best: Math.min(prev ?? moves, moves), firstClear, improved };
}

export function isUnlocked(levels: LevelDef[], progress: Progress, levelId: number): boolean {
  const idx = levels.findIndex((l) => l.id === levelId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return progress.best[levels[idx - 1].id] !== undefined;
}
