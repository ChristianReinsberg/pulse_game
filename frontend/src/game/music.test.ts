import { describe, expect, it } from "vitest";
import type { LevelDef } from "./pulse-core";
import { degreeFor, degreeToMidi, drumVoiceFor, keyForLevel, midiToFreq, nodeRanks } from "./music";

const level = {
  id: 1,
  name: "t",
  start: "a",
  nodes: [
    { id: "a", x: 0.2, y: 0.85 },
    { id: "b", x: 0.8, y: 0.85 },
    { id: "c", x: 0.5, y: 0.15 },
  ],
  edges: [],
} as LevelDef;

describe("Tonarten", () => {
  it("Level 1 bis 5 in C-Dur, ab Level 6 in a-Moll", () => {
    expect(keyForLevel(1)).toEqual({ root: 48, mode: "major" });
    expect(keyForLevel(5)).toEqual({ root: 48, mode: "major" });
    expect(keyForLevel(6)).toEqual({ root: 45, mode: "minor" });
    expect(keyForLevel(10)).toEqual({ root: 45, mode: "minor" });
  });
  it("Tonstufen folgen der Pentatonik über Oktaven hinweg", () => {
    const c = keyForLevel(1);
    expect([0, 1, 2, 3, 4, 5].map((d) => degreeToMidi(c, d))).toEqual([48, 50, 52, 55, 57, 60]);
    expect(degreeToMidi(keyForLevel(6), 1)).toBe(48);
  });
  it("A4 hat 440 Hz", () => expect(midiToFreq(69)).toBeCloseTo(440, 5));
});

describe("Knotentöne", () => {
  it("unten tief, oben hoch, bei gleicher Höhe links vor rechts", () => {
    const r = nodeRanks(level);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(1);
    expect(r.get("c")).toBe(2);
  });
  it("jeder Knoten bekommt einen eigenen Ton, solange der Vorrat reicht", () => {
    const degrees = [0, 1, 2].map((r) => degreeFor(r, 3));
    expect(new Set(degrees).size).toBe(3);
    const big = Array.from({ length: 12 }, (_, r) => degreeFor(r, 12));
    expect(new Set(big).size).toBe(12);
    expect(Math.max(...big)).toBeLessThanOrEqual(11);
  });
  it("Schlagzeug: unten Kick, oben Becken", () => {
    expect(drumVoiceFor(0, 10)).toBe("kick");
    expect(drumVoiceFor(9, 10)).toBe("openhat");
  });
});
