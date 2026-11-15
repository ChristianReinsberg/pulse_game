import { describe, expect, it } from "vitest";
import { LevelDef, createState, isWon, legalMoves, move } from "./pulse-core";
import { hint, solve, validateLevel } from "./pulse-solver";

const mk = (nodes: LevelDef["nodes"], edges: LevelDef["edges"]): LevelDef => ({
  id: 1,
  name: "t",
  start: nodes[0].id,
  nodes,
  edges,
});

const timerUnsolvable = mk(
  [{ id: "a", x: 0, y: 0 }, { id: "b", x: 0.5, y: 0 }, { id: "c", x: 1, y: 0, type: "timer", limit: 1 }],
  [{ from: "a", to: "b" }, { from: "b", to: "c" }]
);
const timerSolvable = mk(
  [{ id: "a", x: 0, y: 0 }, { id: "b", x: 0.5, y: 0 }, { id: "c", x: 1, y: 0, type: "timer", limit: 1 }],
  [{ from: "a", to: "c" }, { from: "c", to: "b" }]
);
const mirror = mk(
  [
    { id: "a", x: 0, y: 0 },
    { id: "m1", x: 0.3, y: 0, type: "mirror", pair: "m2" },
    { id: "m2", x: 0.7, y: 0, type: "mirror", pair: "m1" },
    { id: "c", x: 1, y: 0 },
  ],
  [{ from: "a", to: "m1" }, { from: "m2", to: "c" }]
);

describe("Zeitknoten", () => {
  it("sind nur betretbar, solange die Zugzahl unter dem Limit liegt", () => {
    expect(legalMoves(timerUnsolvable, createState(timerUnsolvable))).toEqual(["b"]);
    const s1 = move(timerUnsolvable, createState(timerUnsolvable), "b")!;
    expect(legalMoves(timerUnsolvable, s1)).toEqual(["a"]);
  });
  it("Solver berücksichtigt das Limit", () => {
    expect(solve(timerUnsolvable).solvable).toBe(false);
    expect(solve(timerSolvable).solution).toEqual(["a", "c", "b"]);
  });
});

describe("Spiegelknoten", () => {
  it("setzen den Impuls an den Zwilling und aktivieren beide", () => {
    const s = move(mirror, createState(mirror), "m1")!;
    expect(s.current).toBe("m2");
    expect(s.path).toEqual(["a", "m1"]);
    expect(s.positions).toEqual(["a", "m2"]);
    expect([...s.activated].sort()).toEqual(["a", "m1", "m2"]);
  });
  it("lassen sich vom Zwilling aus nicht wieder betreten", () => {
    const s = move(mirror, createState(mirror), "m1")!;
    expect(legalMoves(mirror, s)).toEqual(["c"]);
  });
  it("Solver und Hinweis führen über den Spiegel", () => {
    expect(solve(mirror).solution).toEqual(["a", "m1", "c"]);
    expect(hint(mirror, createState(mirror))).toBe("m1");
    const end = move(mirror, move(mirror, createState(mirror), "m1")!, "c")!;
    expect(isWon(mirror, end)).toBe(true);
  });
});

describe("validateLevel (neue Knoten)", () => {
  it("akzeptiert gültige Level, auch wenn Knoten nur über Spiegel erreichbar sind", () => {
    expect(validateLevel(mirror)).toEqual([]);
    expect(validateLevel(timerSolvable)).toEqual([]);
  });
  it("meldet fehlenden Zwilling, Kante zwischen Zwillingen und ungültiges Limit", () => {
    const broken = mk(
      [{ id: "a", x: 0, y: 0 }, { id: "m1", x: 1, y: 0, type: "mirror", pair: "zzz" }],
      [{ from: "a", to: "m1" }]
    );
    expect(validateLevel(broken).length).toBeGreaterThan(0);
    const twins = { ...mirror, edges: [...mirror.edges, { from: "m1", to: "m2" }] };
    expect(validateLevel(twins).some((i) => i.includes("Zwillinge"))).toBe(true);
    const badTimer = mk([{ id: "a", x: 0, y: 0 }, { id: "t", x: 1, y: 0, type: "timer", limit: 0 }], [{ from: "a", to: "t" }]);
    expect(validateLevel(badTimer).some((i) => i.includes("limit"))).toBe(true);
  });
});
