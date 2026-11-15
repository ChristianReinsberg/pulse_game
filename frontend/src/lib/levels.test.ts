import { describe, expect, it } from "vitest";
import { validateLevel, solve } from "@/game/pulse-solver";
import { LEVELS, PAR } from "./levels";

describe("Level-Daten", () => {
  it("IDs laufen lückenlos von 1 aufwärts", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(LEVELS.map((_, i) => i + 1));
  });
  for (const level of LEVELS) {
    it(`Level ${level.id} (${level.name}) ist gültig und lösbar`, () => {
      expect(validateLevel(level)).toEqual([]);
      const r = solve(level);
      expect(r.truncated).toBe(false);
      expect(r.solvable).toBe(true);
      expect(PAR[level.id]).toBe(r.solution!.length - 1);
    });
  }
});
