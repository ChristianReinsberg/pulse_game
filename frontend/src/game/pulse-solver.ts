import {
  GameState,
  LevelDef,
  createState,
  isWon,
  legalMoves,
  move,
} from "./pulse-core";

export interface SolveResult {
  solvable: boolean;
  solution: string[] | null;
  explored: number;
  truncated: boolean;
}

interface Link {
  prev: string | null;
  via: string | null;
}

function keyOf(s: GameState): string {
  return [
    s.current,
    s.color,
    [...s.activated].sort().join(","),
    [...s.consumed].sort().join(","),
  ].join("|");
}

function rebuild(parent: Map<string, Link>, endKey: string, startNode: string): string[] {
  const moves: string[] = [];
  let k: string | null = endKey;
  while (k) {
    const link: Link = parent.get(k)!;
    if (link.via) moves.push(link.via);
    k = link.prev;
  }
  return [startNode, ...moves.reverse()];
}

export function solve(
  level: LevelDef,
  from: GameState = createState(level),
  maxStates = 200_000
): SolveResult {
  const startKey = keyOf(from);
  const parent = new Map<string, Link>([[startKey, { prev: null, via: null }]]);
  const queue: GameState[] = [from];
  let head = 0;

  while (head < queue.length) {
    const s = queue[head++];
    const k = keyOf(s);

    if (isWon(level, s)) {
      return {
        solvable: true,
        solution: rebuild(parent, k, from.current),
        explored: parent.size,
        truncated: false,
      };
    }

    for (const id of legalMoves(level, s)) {
      const next = move(level, s, id)!;
      const nk = keyOf(next);
      if (parent.has(nk)) continue;
      if (parent.size >= maxStates) {
        return { solvable: false, solution: null, explored: parent.size, truncated: true };
      }
      parent.set(nk, { prev: k, via: id });
      queue.push(next);
    }
  }

  return { solvable: false, solution: null, explored: parent.size, truncated: false };
}

export function hint(level: LevelDef, state: GameState): string | null {
  const r = solve(level, state);
  return r.solution && r.solution.length > 1 ? r.solution[1] : null;
}

export function validateLevel(level: LevelDef): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const n of level.nodes) {
    if (ids.has(n.id)) issues.push(`Doppelte Knoten-ID: ${n.id}`);
    ids.add(n.id);
    if (n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) {
      issues.push(`Knoten ${n.id} liegt außerhalb von 0..1`);
    }
    if ((n.type === "color" || n.type === "gate") && !n.color) {
      issues.push(`Knoten ${n.id} (${n.type}) hat keine Farbe`);
    }
  }

  if (!ids.has(level.start)) issues.push(`Startknoten ${level.start} existiert nicht`);

  for (const e of level.edges) {
    if (!ids.has(e.from)) issues.push(`Kante verweist auf unbekannten Knoten: ${e.from}`);
    if (!ids.has(e.to)) issues.push(`Kante verweist auf unbekannten Knoten: ${e.to}`);
  }

  if (ids.has(level.start)) {
    const seen = new Set([level.start]);
    const stack = [level.start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of level.edges) {
        const next = e.from === cur ? e.to : e.to === cur && !e.oneWay ? e.from : null;
        if (next && ids.has(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    for (const id of ids) {
      if (!seen.has(id)) issues.push(`Knoten ${id} ist vom Start aus nie erreichbar`);
    }
  }

  return issues;
}