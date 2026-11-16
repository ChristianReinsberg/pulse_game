import { describe, expect, it } from "vitest";
import { MAX_NAME, decodeLevel, encodeLevel } from "./codec";
import type { LevelDef } from "./pulse-core";
import { LEVELS } from "@/lib/levels";

const wire = (o: unknown) => "P1." + Buffer.from(JSON.stringify(o)).toString("base64url");
const ok = { n: "Test", s: "a", v: ["a:0.1,0.5", "b:0.5,0.5", "c:0.9,0.5"], e: ["a-b", "b-c"] };

describe("Level-Code", () => {
  it("alle Kampagnen-Level überstehen Hin- und Rückweg unverändert", () => {
    for (const l of LEVELS) {
      const r = decodeLevel(encodeLevel(l), true);
      expect("error" in r).toBe(false);
      const got = (r as { level: LevelDef }).level;
      expect(got.nodes).toEqual(l.nodes);
      expect(got.edges).toEqual(l.edges);
      expect(got.start).toBe(l.start);
      expect(got.name).toBe(l.name.slice(0, MAX_NAME));
    }
  });

  it("akzeptiert auch einen ganzen Link", () => {
    const code = encodeLevel(LEVELS[3]);
    expect("level" in decodeLevel(`https://example.com/play/custom#${code}`)).toBe(true);
  });

  it("lehnt fremde, kaputte und überlange Eingaben ab", () => {
    for (const bad of ["", "hallo", "P1.", "P1.***", "P1.AAAA", "P2." + "A".repeat(10), "P1." + "A".repeat(5000)]) {
      expect("error" in decodeLevel(bad)).toBe(true);
    }
  });

  it("prüft Inhalt: Typen, Koordinaten, Größe, Referenzen, Duplikate", () => {
    const cases: unknown[] = [
      { ...ok, v: ["a:0.1,0.5:bomb"] },
      { ...ok, v: ["a:1.5,0.5", "b:0.5,0.5"] },
      { ...ok, v: Array.from({ length: 17 }, (_, i) => `${String.fromCharCode(97 + i)}:0.5,0.5`) },
      { ...ok, e: ["a-zzz"] },
      { ...ok, e: ["a-a"] },
      { ...ok, v: ["a:0.1,0.5", "a:0.2,0.5"] },
      { ...ok, s: "x" },
      { ...ok, v: ["a:0.1,0.5:timer:0"] },
      { ...ok, v: ["a:0.1,0.5:color:green"] },
      { ...ok, v: ["a:0.1,0.5:once:2"] },
      { ...ok, n: 5 },
      [1, 2, 3],
      null,
    ];
    for (const c of cases) expect("error" in decodeLevel(wire(c), false)).toBe(true);
  });

  it("streng: Spielregeln werden geprüft, locker: nur der Aufbau", () => {
    const orphanMirror = { ...ok, v: ["a:0.1,0.5", "b:0.5,0.5:mirror:z"], e: ["a-b"] };
    expect("error" in decodeLevel(wire(orphanMirror), true)).toBe(true);
    expect("level" in decodeLevel(wire(orphanMirror), false)).toBe(true);
  });

  it("bereinigt Namen", () => {
    const r = decodeLevel(wire({ ...ok, n: "<b>Hallo</b>" + "x".repeat(100) })) as { level: LevelDef };
    expect(r.level.name.includes("<")).toBe(false);
    expect(r.level.name.length).toBeLessThanOrEqual(MAX_NAME);
    const empty = decodeLevel(wire({ ...ok, n: "   " })) as { level: LevelDef };
    expect(empty.level.name).toBe("Eigenes Level");
  });

  it("wirft bei zufälligem Müll nie", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 300; i++) {
      const s = Array.from({ length: Math.floor(rnd() * 60) }, () => String.fromCharCode(32 + Math.floor(rnd() * 95))).join("");
      decodeLevel(s);
      decodeLevel("P1." + s);
    }
  });
});
