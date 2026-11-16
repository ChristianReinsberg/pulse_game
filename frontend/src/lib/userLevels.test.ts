import { beforeEach, describe, expect, it } from "vitest";
import { encodeLevel } from "@/game/codec";
import { emptyLevel } from "@/game/editor";
import { MAX_SAVED, USER_LEVELS_KEY, deleteUserLevel, getUserLevels, parseUserLevels, resetUserLevels, saveUserLevel, setDraft } from "./userLevels";

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const code = encodeLevel(emptyLevel());

beforeEach(() => {
  store.clear();
  resetUserLevels();
});

describe("parseUserLevels", () => {
  it("fällt bei Müll auf leer zurück und filtert ungültige Einträge", () => {
    expect(parseUserLevels("kaputt").levels).toEqual([]);
    const good = { key: "k1", name: "A", code, par: 3, savedAt: 1 };
    const raw = JSON.stringify({ version: 1, levels: [good, { ...good, key: 5 }, { ...good, code: "evil" }, { ...good, par: "x" }], draft: "nope" });
    const p = parseUserLevels(raw);
    expect(p.levels).toHaveLength(1);
    expect(p.draft).toBeNull();
  });
});

describe("Speichern", () => {
  it("legt an, überschreibt unter gleichem Schlüssel, löscht und begrenzt", () => {
    const k = saveUserLevel({ name: "Eins", code, par: 4 })!;
    expect(getUserLevels().levels.map((l) => l.name)).toEqual(["Eins"]);
    saveUserLevel({ name: "Eins neu", code, par: 5 }, k);
    expect(getUserLevels().levels).toHaveLength(1);
    expect(getUserLevels().levels[0].name).toBe("Eins neu");
    deleteUserLevel(k);
    expect(getUserLevels().levels).toHaveLength(0);
    for (let i = 0; i < MAX_SAVED; i++) expect(saveUserLevel({ name: "x", code, par: null }, "k" + i)).not.toBeNull();
    expect(saveUserLevel({ name: "zu viel", code, par: null }, "neu")).toBeNull();
  });
  it("sichert den Entwurf", () => {
    setDraft(code);
    expect(getUserLevels().draft).toBe(code);
    expect(JSON.parse(store.get(USER_LEVELS_KEY)!).draft).toBe(code);
  });
});
