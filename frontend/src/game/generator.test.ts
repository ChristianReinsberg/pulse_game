import { describe, expect, it } from "vitest";
import { analyzeLevel, type Difficulty } from "./analysis";
import { GenOptions, generateLevel } from "./generator";
import { solve, validateLevel } from "./pulse-solver";

const base: GenOptions = {
  nodes: 7, oneWay: false, once: false, colors: false, timers: false, mirror: false,
  difficulty: "mittel", seed: 1, budgetMs: 60000, maxTries: 6000,
};

function check(opts: GenOptions) {
  const r = generateLevel(opts);
  expect(r).not.toBeNull();
  const { level, stats } = r!;
  expect(validateLevel(level)).toEqual([]);
  expect(level.nodes.length).toBe(opts.nodes);
  expect(solve(level).solvable).toBe(true);
  expect(analyzeLevel(level).moves).toBe(stats.moves);
  return level;
}

describe("generateLevel", () => {
  it("liefert für jede Stufe ein gültiges, lösbares Level", () => {
    for (const difficulty of ["leicht", "mittel", "schwer", "knifflig"] as Difficulty[]) check({ ...base, difficulty });
  });
  it("benutzt die gewählten Mechaniken wirklich", () => {
    const a = check({ ...base, nodes: 8, oneWay: true, once: true, difficulty: "schwer" });
    expect(a.edges.some((e) => e.oneWay)).toBe(true);
    expect(a.nodes.some((n) => n.type === "once")).toBe(true);
    const t = check({ ...base, timers: true });
    expect(t.nodes.some((n) => n.type === "timer")).toBe(true);
    const m = check({ ...base, mirror: true });
    expect(m.nodes.filter((n) => n.type === "mirror").length).toBe(2);
    const c = check({ ...base, nodes: 8, colors: true, difficulty: "schwer" });
    expect(c.nodes.some((n) => n.type === "gate")).toBe(true);
    expect(c.nodes.some((n) => n.type === "color")).toBe(true);
  });
  it("gleicher Seed, gleiches Level; anderer Seed, anderes Level", () => {
    const a = generateLevel({ ...base, seed: 5 })!.level;
    const b = generateLevel({ ...base, seed: 5 })!.level;
    const c = generateLevel({ ...base, seed: 6 })!.level;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
  it("hält Grenzen ein und gibt bei Unmöglichem null zurück", () => {
    expect(generateLevel({ ...base, nodes: 99, maxTries: 50 })?.level.nodes.length ?? 12).toBeLessThanOrEqual(12);
    expect(generateLevel({ ...base, nodes: 4, mirror: true, timers: true, oneWay: true, once: true, colors: true, maxTries: 30 })).toBeNull();
  });
});
