import { describe, expect, it } from "vitest";
import {
  MAX_NODES, addNode, cellX, cellY, cycleEdge, emptyLevel, moveNode, nearestCell, pairMirrors,
  removeEdge, removeNode, setColor, setLimit, setNodeType, setStart,
} from "./editor";
import type { LevelDef } from "./pulse-core";
import { solve, validateLevel } from "./pulse-solver";

const at = (c: number, r: number) => ({ x: cellX(c), y: cellY(r) });
function build(...cells: [number, number][]): LevelDef {
  let lv = emptyLevel();
  lv = { ...lv, nodes: [] };
  for (const [c, r] of cells) lv = addNode({ ...lv, start: lv.nodes[0]?.id ?? "a" }, at(c, r).x, at(c, r).y);
  return { ...lv, start: lv.nodes[0].id };
}

describe("Knoten", () => {
  it("setzt neue Knoten aufs Raster und vergibt Buchstaben der Reihe nach", () => {
    const lv = build([0, 0], [2, 1], [4, 2]);
    expect(lv.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(nearestCell(0.33, 0.48)).toMatchObject({ c: 2, r: 2 });
  });
  it("belegt kein Feld doppelt und kennt eine Obergrenze", () => {
    const lv = build([0, 0]);
    expect(addNode(lv, cellX(0), cellY(0))).toBe(lv);
    let big = lv;
    for (let c = 0; c < 7; c++) for (let r = 0; r < 5; r++) big = addNode(big, cellX(c), cellY(r));
    expect(big.nodes.length).toBe(MAX_NODES);
  });
  it("verschiebt aufs Raster, aber nicht auf besetzte Felder", () => {
    const lv = build([0, 0], [3, 0]);
    expect(moveNode(lv, "a", cellX(3), cellY(0))).toBe(lv);
    const moved = moveNode(lv, "a", cellX(1) + 0.01, cellY(4));
    expect(moved.nodes[0]).toMatchObject({ x: cellX(1), y: cellY(4) });
  });
  it("Löschen entfernt Kanten, wählt neuen Start und löst Spiegelpaare", () => {
    let lv = build([0, 0], [2, 0], [4, 0]);
    lv = cycleEdge(cycleEdge(lv, "a", "b"), "b", "c");
    lv = pairMirrors(lv, "b", "c");
    const del = removeNode(lv, "a");
    expect(del.start).toBe("b");
    expect(del.edges.every((e) => e.from !== "a" && e.to !== "a")).toBe(true);
    const del2 = removeNode(lv, "b");
    expect(del2.nodes.find((n) => n.id === "c")!.type).toBeUndefined();
    const single = emptyLevel();
    expect(removeNode(single, "a")).toBe(single);
  });
});

describe("Kanten", () => {
  it("wechselt reihum: beidseitig, a nach b, b nach a, keine", () => {
    let lv = build([0, 0], [2, 0]);
    lv = cycleEdge(lv, "a", "b");
    expect(lv.edges).toEqual([{ from: "a", to: "b" }]);
    lv = cycleEdge(lv, "a", "b");
    expect(lv.edges).toEqual([{ from: "a", to: "b", oneWay: true }]);
    lv = cycleEdge(lv, "a", "b");
    expect(lv.edges).toEqual([{ from: "b", to: "a", oneWay: true }]);
    lv = cycleEdge(lv, "a", "b");
    expect(lv.edges).toEqual([]);
  });
  it("verbindet nie Zwillinge und nie einen Knoten mit sich selbst", () => {
    let lv = pairMirrors(build([0, 0], [2, 0], [4, 0]), "b", "c");
    expect(cycleEdge(lv, "b", "c")).toBe(lv);
    expect(cycleEdge(lv, "a", "a")).toBe(lv);
    lv = removeEdge(cycleEdge(lv, "a", "b"), 0);
    expect(lv.edges).toEqual([]);
  });
});

describe("Knotenarten", () => {
  it("Zeitlimit wird begrenzt, Tor und Zeit sind am Start nicht erlaubt", () => {
    const lv = build([0, 0], [2, 0]);
    expect(setNodeType(lv, "a", "timer")).toBe(lv);
    expect(setNodeType(lv, "a", "gate")).toBe(lv);
    const t = setNodeType(lv, "b", "timer", { limit: 99 });
    expect(t.nodes[1].limit).toBe(20);
    expect(setLimit(t, "b", 0).nodes[1].limit).toBe(1);
  });
  it("Farbe nur bei Farbknoten und Toren; Wechsel auf normal räumt auf", () => {
    let lv = setNodeType(build([0, 0], [2, 0]), "b", "gate", { color: "blue" });
    expect(lv.nodes[1]).toMatchObject({ type: "gate", color: "blue" });
    expect(setColor(lv, "a", "blue")).toBe(lv);
    lv = setNodeType(lv, "b", "normal");
    expect(lv.nodes[1]).toEqual({ id: "b", x: cellX(2), y: cellY(0) });
  });
  it("Spiegelpaare: neues Paar löst das alte, Start ist ausgenommen", () => {
    const lv = build([0, 0], [2, 0], [4, 0], [6, 0]);
    expect(pairMirrors(lv, "a", "b")).toBe(lv);
    const p1 = pairMirrors(lv, "b", "c");
    const p2 = pairMirrors(p1, "c", "d");
    expect(p2.nodes.find((n) => n.id === "b")!.type).toBeUndefined();
    expect(p2.nodes.find((n) => n.id === "c")).toMatchObject({ type: "mirror", pair: "d" });
    expect(setStart(p2, "c")).toBe(p2);
    const once = setNodeType(p2, "c", "once");
    expect(once.nodes.find((n) => n.id === "d")!.type).toBeUndefined();
  });
});

describe("Gesamtes Level aus Bausteinen", () => {
  it("ein Level über einen Spiegel ist gültig und lösbar", () => {
    let lv = build([0, 2], [2, 2], [4, 0], [6, 0]);
    lv = cycleEdge(lv, "a", "b");
    lv = pairMirrors(lv, "b", "c");
    lv = cycleEdge(lv, "c", "d");
    expect(validateLevel(lv)).toEqual([]);
    expect(solve(lv).solution).toEqual(["a", "b", "d"]);
  });
  it("Validator meldet ungültige Startknoten", () => {
    const lv = build([0, 0], [2, 0]);
    const bad = { ...lv, nodes: lv.nodes.map((n) => (n.id === "a" ? { ...n, type: "timer" as const, limit: 3 } : n)) };
    expect(validateLevel(bad).some((i) => i.includes("Startknoten"))).toBe(true);
  });
});
