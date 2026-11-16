import { describe, expect, it } from "vitest";
import { analyzeLevel, difficultyOf } from "./analysis";
import type { LevelDef } from "./pulse-core";
import { LEVELS } from "@/lib/levels";

const lv = (id: number) => LEVELS.find((l) => l.id === id)!;

describe("analyzeLevel", () => {
  it("liefert die bekannten Kennzahlen der Kampagnen-Level", () => {
    expect(analyzeLevel(lv(14))).toMatchObject({ solvable: true, moves: 20, shortestSolutions: 2, states: 650, trapPct: 84 });
    expect(analyzeLevel(lv(13))).toMatchObject({ moves: 16, shortestSolutions: 1, states: 165, trapPct: 87 });
    expect(analyzeLevel(lv(17))).toMatchObject({ moves: 5, shortestSolutions: 1, states: 21, trapPct: 0 });
  });
  it("erkennt unlösbare Level", () => {
    const bad: LevelDef = {
      id: 0, name: "x", start: "a",
      nodes: [{ id: "a", x: 0.1, y: 0.5 }, { id: "g", x: 0.9, y: 0.5, type: "gate", color: "red" }],
      edges: [{ from: "a", to: "g" }],
    };
    const s = analyzeLevel(bad);
    expect(s.solvable).toBe(false);
    expect(s.moves).toBeNull();
  });
  it("meldet Abbruch bei zu kleinem Limit", () => {
    const s = analyzeLevel(lv(14), 50);
    expect(s.truncated).toBe(true);
    expect(s.solvable).toBe(false);
  });
});

describe("difficultyOf", () => {
  it("ordnet die Kampagne grob aufsteigend ein", () => {
    const rank = { leicht: 0, mittel: 1, schwer: 2, knifflig: 3 } as const;
    const d = (id: number) => rank[difficultyOf(analyzeLevel(lv(id)))!];
    expect(d(1)).toBe(0);
    expect(d(5)).toBeGreaterThanOrEqual(1);
    expect(d(14)).toBe(3);
    expect(d(1)).toBeLessThanOrEqual(d(5));
    expect(d(5)).toBeLessThanOrEqual(d(14));
  });
  it("kein Urteil für unlösbare Level", () => {
    expect(difficultyOf({ solvable: false, truncated: false, moves: null, shortestSolutions: 0, states: 1, trapPct: 100, firstMoves: 0, badFirst: 0 })).toBeNull();
  });
});
