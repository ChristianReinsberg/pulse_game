import type { EdgeDef, LevelDef, NodeDef, PulseColor } from "./pulse-core";
import { MAX_NODES } from "./codec";

export { MAX_NODES };

export const COLS = 7;
export const ROWS = 5;
export const MAX_LIMIT = 20;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const cellX = (c: number) => round3(0.1 + (0.8 * c) / (COLS - 1));
export const cellY = (r: number) => round3(0.15 + (0.7 * r) / (ROWS - 1));

export function nearestCell(x: number, y: number) {
  const c = clamp(Math.round(((x - 0.1) / 0.8) * (COLS - 1)), 0, COLS - 1);
  const r = clamp(Math.round(((y - 0.15) / 0.7) * (ROWS - 1)), 0, ROWS - 1);
  return { c, r, x: cellX(c), y: cellY(r) };
}

export function emptyLevel(): LevelDef {
  return { id: 0, name: "Neues Level", start: "a", nodes: [{ id: "a", x: cellX(1), y: cellY(2) }], edges: [] };
}

function nextId(level: LevelDef): string | null {
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!level.nodes.some((n) => n.id === id)) return id;
  }
  return null;
}

function cellOccupied(level: LevelDef, c: number, r: number, ignoreId?: string): boolean {
  return level.nodes.some((n) => {
    if (n.id === ignoreId) return false;
    const cell = nearestCell(n.x, n.y);
    return cell.c === c && cell.r === r;
  });
}

const replaceNode = (level: LevelDef, id: string, f: (n: NodeDef) => NodeDef): LevelDef => ({
  ...level,
  nodes: level.nodes.map((n) => (n.id === id ? f(n) : n)),
});

function plain(n: NodeDef): NodeDef {
  return { id: n.id, x: n.x, y: n.y };
}

export function addNode(level: LevelDef, x: number, y: number): LevelDef {
  const cell = nearestCell(x, y);
  const id = nextId(level);
  if (!id || level.nodes.length >= MAX_NODES || cellOccupied(level, cell.c, cell.r)) return level;
  return { ...level, nodes: [...level.nodes, { id, x: cell.x, y: cell.y }] };
}

export function moveNode(level: LevelDef, id: string, x: number, y: number): LevelDef {
  const cell = nearestCell(x, y);
  const node = level.nodes.find((n) => n.id === id);
  if (!node || cellOccupied(level, cell.c, cell.r, id)) return level;
  if (node.x === cell.x && node.y === cell.y) return level;
  return replaceNode(level, id, (n) => ({ ...n, x: cell.x, y: cell.y }));
}

function unpair(level: LevelDef, id: string): LevelDef {
  const node = level.nodes.find((n) => n.id === id);
  if (node?.type !== "mirror" || !node.pair) return level;
  return replaceNode(level, node.pair, plain);
}

export function removeNode(level: LevelDef, id: string): LevelDef {
  if (level.nodes.length <= 1 || !level.nodes.some((n) => n.id === id)) return level;
  const base = unpair(level, id);
  const nodes = base.nodes.filter((n) => n.id !== id);
  return {
    ...base,
    nodes,
    edges: base.edges.filter((e) => e.from !== id && e.to !== id),
    start: base.start === id ? nodes[0].id : base.start,
  };
}

export function setStart(level: LevelDef, id: string): LevelDef {
  const node = level.nodes.find((n) => n.id === id);
  if (!node || level.start === id) return level;
  if (node.type === "mirror" || node.type === "gate" || node.type === "timer") return level;
  return { ...level, start: id };
}

export function cycleEdge(level: LevelDef, a: string, b: string): LevelDef {
  if (a === b) return level;
  const na = level.nodes.find((n) => n.id === a);
  const nb = level.nodes.find((n) => n.id === b);
  if (!na || !nb) return level;
  if ((na.type === "mirror" && na.pair === b) || (nb.type === "mirror" && nb.pair === a)) return level;

  const idx = level.edges.findIndex((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  const without = idx < 0 ? level.edges : level.edges.filter((_, i) => i !== idx);
  const cur = idx < 0 ? null : level.edges[idx];

  let next: EdgeDef | null;
  if (!cur) next = { from: a, to: b };
  else if (!cur.oneWay) next = { from: a, to: b, oneWay: true };
  else if (cur.from === a) next = { from: b, to: a, oneWay: true };
  else next = null;

  return { ...level, edges: next ? [...without, next] : without };
}

export function removeEdge(level: LevelDef, index: number): LevelDef {
  if (index < 0 || index >= level.edges.length) return level;
  return { ...level, edges: level.edges.filter((_, i) => i !== index) };
}

export type PlainType = "normal" | "once" | "color" | "gate" | "timer";

export function setNodeType(
  level: LevelDef,
  id: string,
  type: PlainType,
  opts: { color?: PulseColor; limit?: number } = {}
): LevelDef {
  const node = level.nodes.find((n) => n.id === id);
  if (!node) return level;
  if (id === level.start && (type === "gate" || type === "timer")) return level;

  const base = unpair(level, id);
  return replaceNode(base, id, (n) => {
    const p = plain(n);
    switch (type) {
      case "normal":
        return p;
      case "once":
        return { ...p, type: "once" };
      case "color":
      case "gate":
        return { ...p, type, color: opts.color ?? (n.type === type ? n.color : undefined) ?? "red" };
      case "timer":
        return { ...p, type: "timer", limit: clamp(Math.round(opts.limit ?? (n.type === "timer" ? n.limit! : 5)), 1, MAX_LIMIT) };
    }
  });
}

export function setColor(level: LevelDef, id: string, color: PulseColor): LevelDef {
  const node = level.nodes.find((n) => n.id === id);
  if (!node || (node.type !== "color" && node.type !== "gate") || node.color === color) return level;
  return replaceNode(level, id, (n) => ({ ...n, color }));
}

export function setLimit(level: LevelDef, id: string, limit: number): LevelDef {
  const node = level.nodes.find((n) => n.id === id);
  const next = clamp(Math.round(limit), 1, MAX_LIMIT);
  if (!node || node.type !== "timer" || node.limit === next) return level;
  return replaceNode(level, id, (n) => ({ ...n, limit: next }));
}

export function pairMirrors(level: LevelDef, a: string, b: string): LevelDef {
  if (a === b || a === level.start || b === level.start) return level;
  const na = level.nodes.find((n) => n.id === a);
  const nb = level.nodes.find((n) => n.id === b);
  if (!na || !nb) return level;
  const edges = level.edges.filter((e) => !((e.from === a && e.to === b) || (e.from === b && e.to === a)));
  let next = unpair(unpair({ ...level, edges }, a), b);
  next = replaceNode(next, a, (n) => ({ ...plain(n), type: "mirror", pair: b }));
  next = replaceNode(next, b, (n) => ({ ...plain(n), type: "mirror", pair: a }));
  return next;
}

export function renameLevel(level: LevelDef, name: string): LevelDef {
  return name === level.name ? level : { ...level, name };
}
