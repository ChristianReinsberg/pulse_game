import { beforeEach, describe, expect, it } from "vitest";
import type { LevelDef } from "@/game/pulse-core";
import { STORAGE_KEY, getSnapshot, isUnlocked, parse, recordWin, resetProgress } from "./progress";

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const levels = [{ id: 1 }, { id: 2 }, { id: 3 }] as LevelDef[];

beforeEach(() => {
  store.clear();
  resetProgress();
});

describe("parse", () => {
  it("liefert bei kaputten Daten einen leeren Stand", () => {
    expect(parse("nope").best).toEqual({});
    expect(parse('{"version":2,"best":{}}').best).toEqual({});
    expect(parse(null).best).toEqual({});
  });
  it("verwirft ungültige Einträge, behält gültige", () => {
    const p = parse('{"version":1,"best":{"1":4,"2":-3,"x":5,"3":"7"}}');
    expect(p.best).toEqual({ 1: 4 });
  });
});

describe("recordWin", () => {
  it("speichert den ersten Abschluss", () => {
    const r = recordWin(1, 8);
    expect(r).toEqual({ best: 8, firstClear: true, improved: false });
    expect(JSON.parse(store.get(STORAGE_KEY)!).best).toEqual({ 1: 8 });
  });
  it("übernimmt nur bessere Ergebnisse", () => {
    recordWin(1, 8);
    expect(recordWin(1, 10)).toEqual({ best: 8, firstClear: false, improved: false });
    expect(recordWin(1, 6)).toEqual({ best: 6, firstClear: false, improved: true });
    expect(getSnapshot().best[1]).toBe(6);
  });
});

describe("isUnlocked", () => {
  it("schaltet Level der Reihe nach frei", () => {
    expect(isUnlocked(levels, getSnapshot(), 1)).toBe(true);
    expect(isUnlocked(levels, getSnapshot(), 2)).toBe(false);
    recordWin(1, 3);
    expect(isUnlocked(levels, getSnapshot(), 2)).toBe(true);
    expect(isUnlocked(levels, getSnapshot(), 3)).toBe(false);
  });
  it("lehnt unbekannte Level ab", () => {
    expect(isUnlocked(levels, getSnapshot(), 99)).toBe(false);
  });
});
