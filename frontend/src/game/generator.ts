import { analyzeLevel, type Difficulty, type LevelStats } from "./analysis";
import { cellX, cellY } from "./editor";
import type { EdgeDef, LevelDef, NodeDef } from "./pulse-core";
import { validateLevel } from "./pulse-solver";
import i18next from 'i18next'

export interface GenOptions {
  nodes: number;
  oneWay: boolean;
  once: boolean;
  colors: boolean;
  timers: boolean;
  mirror: boolean;
  difficulty: Difficulty;
  seed?: number;
  budgetMs?: number;
  maxTries?: number;
}

export interface GenResult {
  level: LevelDef;
  stats: LevelStats;
}

export const GEN_MIN_NODES = 4;
export const GEN_MAX_NODES = 12;

const TARGETS: Record<Difficulty, { trap: number; moves: (n: number) => [number, number] }> = {
  leicht: { trap: 20, moves: (n) => [n - 1, n + 2] },
  mittel: { trap: 45, moves: (n) => [n + 1, n + 5] },
  schwer: { trap: 70, moves: (n) => [n + 2, n + 8] },
  knifflig: { trap: 88, moves: (n) => [n + 4, n + 14] },
};

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function layout(n: number) {
  return n <= 6
    ? { cols: [0, 3, 6], rows: [0, 2, 4] } // 3 x 3
    : { cols: [0, 2, 4, 6], rows: [0, 2, 4] }; // 4 x 3
}

function build(opts: GenOptions, r: () => number): LevelDef | null {
  const n = opts.nodes;
  const { cols, rows } = layout(n);
  const key = (c: number, rr: number) => `${c},${rr}`;

  const first: [number, number] = [Math.floor(r() * cols.length), Math.floor(r() * rows.length)];
  const cells: [number, number][] = [first];
  const taken = new Set([key(...first)]);
  const tree: [number, number][][] = [];
  let guard = 0;
  while (cells.length < n && guard++ < 500) {
    const base = cells[Math.floor(r() * cells.length)];
    for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], r)) {
      const c = base[0] + dx;
      const rr = base[1] + dy;
      if (c < 0 || rr < 0 || c >= cols.length || rr >= rows.length || taken.has(key(c, rr))) continue;
      taken.add(key(c, rr));
      cells.push([c, rr]);
      tree.push([base, [c, rr]]);
      break;
    }
  }
  if (cells.length < n) return null;

  const ids = new Map(cells.map((cell, i) => [key(...cell), String.fromCharCode(97 + i)]));
  const edgeMap = new Map<string, EdgeDef>();
  const pOne = opts.oneWay ? 0.3 : 0;
  const addEdge = (a: [number, number], b: [number, number]) => {
    const ea = ids.get(key(...a))!;
    const eb = ids.get(key(...b))!;
    const k = [ea, eb].sort().join("-");
    if (edgeMap.has(k)) return;
    const one = r() < pOne;
    const flip = r() < 0.5;
    edgeMap.set(k, one ? (flip ? { from: ea, to: eb, oneWay: true } : { from: eb, to: ea, oneWay: true }) : { from: ea, to: eb });
  };
  tree.forEach(([a, b]) => addEdge(a, b));
  for (const cell of cells) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nb: [number, number] = [cell[0] + dx, cell[1] + dy];
      if (taken.has(key(...nb)) && r() < 0.6) addEdge(cell, nb);
    }
  }

  const nodes: NodeDef[] = cells.map((cell) => ({ id: ids.get(key(...cell))!, x: cellX(cols[cell[0]]), y: cellY(rows[cell[1]]) }));
  const free = shuffle(nodes.slice(1), r);

  if (opts.colors) {
    const colorNodes = opts.difficulty === "knifflig" && n >= 9 ? 2 : 1;
    const gates = n >= 7 ? 2 : 1;
    for (let i = 0; i < colorNodes && free.length; i++) {
      const node = free.pop()!;
      node.type = "color";
      node.color = i === 0 ? "red" : "blue";
    }
    for (let i = 0; i < gates && free.length; i++) {
      const node = free.pop()!;
      node.type = "gate";
      node.color = colorNodes === 2 && r() < 0.5 ? "blue" : "red";
    }
  }
  if (opts.timers) {
    const count = n >= 8 && opts.difficulty !== "leicht" ? 2 : 1;
    for (let i = 0; i < count && free.length; i++) {
      const node = free.pop()!;
      node.type = "timer";
      node.limit = 2 + Math.floor(r() * (n + 2));
    }
  }
  if (opts.mirror) {
    const linked = (a: string, b: string) => edgeMap.has([a, b].sort().join("-"));
    const pairs: [NodeDef, NodeDef][] = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) if (!linked(free[i].id, free[j].id)) pairs.push([free[i], free[j]]);
    }
    if (!pairs.length) return null;
    const [m1, m2] = pairs[Math.floor(r() * pairs.length)];
    m1.type = "mirror";
    m1.pair = m2.id;
    m2.type = "mirror";
    m2.pair = m1.id;
    free.splice(free.indexOf(m1), 1);
    free.splice(free.indexOf(m2), 1);
  }
  const pOnce = opts.once ? 0.25 : 0;
  for (const node of free) if (r() < pOnce) node.type = "once";

  return { id: 0, name: i18next.t('zufallslevel', 'Zufallslevel'), start: nodes[0].id, nodes, edges: [...edgeMap.values()] };
}

const stripped = (lv: LevelDef, type: "timer" | "mirror"): LevelDef => ({
  ...lv,
  nodes: lv.nodes.map((n) => (n.type === type ? { id: n.id, x: n.x, y: n.y } : n)),
});

export function generateLevel(opts: GenOptions, now: () => number = () => performance.now()): GenResult | null {
  const n = Math.min(GEN_MAX_NODES, Math.max(GEN_MIN_NODES, Math.round(opts.nodes)));
  const o = { ...opts, nodes: n };
  const r = rng(opts.seed ?? 12345);
  const target = TARGETS[opts.difficulty];
  const [lo, hi] = target.moves(n);
  const deadline = now() + (opts.budgetMs ?? 2000);
  const maxTries = opts.maxTries ?? 20000;

  let best: (GenResult & { score: number }) | null = null;

  for (let t = 0; t < maxTries && now() < deadline; t++) {
    const level = build(o, r);
    if (!level || validateLevel(level).length) continue;

    const ones = level.edges.filter((e) => e.oneWay).length;
    const onces = level.nodes.filter((x) => x.type === "once").length;
    if ((o.oneWay && !ones) || (o.once && !onces)) continue;

    const stats = analyzeLevel(level, 20000);
    if (stats.truncated || !stats.solvable || stats.moves === null) continue;

    if (o.timers) {
      const free = analyzeLevel(stripped(level, "timer"), 20000);
      if (free.solvable && free.moves !== null && free.moves >= stats.moves && free.shortestSolutions <= stats.shortestSolutions) continue;
    }
    if (o.mirror) {
      const plain = analyzeLevel(stripped(level, "mirror"), 20000);
      if (plain.solvable && plain.moves !== null && plain.moves <= stats.moves) continue;
    }

    const inRange = stats.moves >= lo && stats.moves <= hi;
    const score =
      Math.abs(stats.trapPct - target.trap) +
      (inRange ? 0 : 3 * Math.min(Math.abs(stats.moves - lo), Math.abs(stats.moves - hi))) +
      Math.max(0, stats.shortestSolutions - 3) * 5;
    if (!best || score < best.score) best = { level, stats, score };
    if (inRange && Math.abs(stats.trapPct - target.trap) <= 8 && stats.shortestSolutions <= 3) break;
  }

  return best ? { level: best.level, stats: best.stats } : null;
}
