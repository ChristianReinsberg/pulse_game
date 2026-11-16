import { CODE_PREFIX, MAX_CODE_LENGTH } from "@/game/codec";
import { createStore } from "./store";

export const USER_LEVELS_KEY = "pulse:userlevels:v1";
export const MAX_SAVED = 50;

export interface SavedLevel {
  key: string;
  name: string;
  code: string;
  par: number | null;
  savedAt: number;
}

export interface UserLevels {
  version: 1;
  levels: SavedLevel[];
  draft: string | null;
}

const empty = (): UserLevels => ({ version: 1, levels: [], draft: null });

const validCode = (c: unknown): c is string =>
  typeof c === "string" && c.startsWith(CODE_PREFIX) && c.length <= MAX_CODE_LENGTH;

export function parseUserLevels(raw: string | null): UserLevels {
  if (!raw) return empty();
  try {
    const d = JSON.parse(raw);
    if (d?.version !== 1 || !Array.isArray(d.levels)) return empty();
    const levels: SavedLevel[] = [];
    for (const l of d.levels) {
      if (
        typeof l?.key === "string" && l.key.length <= 40 &&
        typeof l.name === "string" && validCode(l.code) &&
        typeof l.savedAt === "number" && (l.par === null || Number.isInteger(l.par))
      ) {
        levels.push({ key: l.key, name: l.name.slice(0, 40), code: l.code, par: l.par, savedAt: l.savedAt });
      }
    }
    return { version: 1, levels: levels.slice(0, MAX_SAVED), draft: validCode(d.draft) ? d.draft : null };
  } catch {
    return empty();
  }
}

const store = createStore<UserLevels>(USER_LEVELS_KEY, parseUserLevels, empty);

export const getUserLevels = store.getSnapshot;
export const subscribeUserLevels = store.subscribe;
export const resetUserLevels = store.reset;

export function saveUserLevel(entry: Omit<SavedLevel, "key" | "savedAt">, key?: string): string | null {
  const cur = getUserLevels();
  const k = key ?? `u${Date.now().toString(36)}`;
  const exists = cur.levels.some((l) => l.key === k);
  if (!exists && cur.levels.length >= MAX_SAVED) return null;
  const item: SavedLevel = { ...entry, key: k, savedAt: Date.now() };
  store.set({ ...cur, levels: exists ? cur.levels.map((l) => (l.key === k ? item : l)) : [item, ...cur.levels] });
  return k;
}

export function deleteUserLevel(key: string): void {
  const cur = getUserLevels();
  store.set({ ...cur, levels: cur.levels.filter((l) => l.key !== key) });
}

export function setDraft(code: string | null): void {
  const cur = getUserLevels();
  if (cur.draft !== code) store.set({ ...cur, draft: code });
}
