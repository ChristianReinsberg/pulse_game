import { describe, expect, it } from "vitest";
import { LevelDef, createState } from "./pulse-core";
import { hint, solve, validateLevel } from "./pulse-solver";

const level04: LevelDef = {
  id: 4,
  name: "Kein Zurück",
  start: "a",
  nodes: [
    { id: "a", x: 0.15, y: 0.5 },
    { id: "b", x: 0.35, y: 0.5, type: "once" },
    { id: "c", x: 0.55, y: 0.25 },
    { id: "d", x: 0.55, y: 0.75 },
    { id: "e", x: 0.85, y: 0.5 },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "b", to: "d" },
    { from: "c", to: "e" },
    { from: "d", to: "e" },
    { from: "c", to: "d" },
  ],
};

const colorLevel: LevelDef = {
  id: 8,
  name: "Farbtor",
  start: "a",
  nodes: [
    { id: "a", x: 0.1, y: 0.5 },
    { id: "r", x: 0.5, y: 0.5, type: "color", color: "red" },
    { id: "g", x: 0.9, y: 0.5, type: "gate", color: "red" },
  ],
  edges: [
    { from: "a", to: "r" },
    { from: "r", to: "g" },
  ],
};

const unsolvable: LevelDef = {
  id: 99,
  name: "Unlösbar",
  start: "a",
  nodes: [
    { id: "a", x: 0.2, y: 0.5 },
    { id: "g", x: 0.8, y: 0.5, type: "gate", color: "red" },
  ],
  edges: [{ from: "a", to: "g" }],
};

describe("solve", () => {
  it("findet den kürzesten Weg in Level 4", () => {
    const r = solve(level04);
    expect(r.solvable).toBe(true);
    expect(r.solution).toHaveLength(5);
    expect(r.solution![0]).toBe("a");
    expect(r.solution![1]).toBe("b");
  });

  it("löst das Farbtor-Level", () => {
    expect(solve(colorLevel).solution).toEqual(["a", "r", "g"]);
  });

  it("erkennt unlösbare Level", () => {
    const r = solve(unsolvable);
    expect(r.solvable).toBe(false);
    expect(r.truncated).toBe(false);
  });
});

describe("hint", () => {
  it("liefert den nächsten Knoten auf dem Lösungsweg", () => {
    expect(hint(level04, createState(level04))).toBe("b");
  });
});

describe("validateLevel", () => {
  it("akzeptiert gültige Level", () => {
    expect(validateLevel(level04)).toEqual([]);
  });

  it("meldet kaputte Level", () => {
    const broken: LevelDef = {
      ...level04,
      start: "x",
      edges: [{ from: "a", to: "zzz" }],
    };
    expect(validateLevel(broken).length).toBeGreaterThan(0);
  });
});