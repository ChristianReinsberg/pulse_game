import {
  GameState,
  LevelDef,
  createState,
  isWon,
  legalMoves,
  move,
} from "./pulse-core";
import i18next from 'i18next'

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

export function timerCap(level: LevelDef): number {
  return Math.max(0, ...level.nodes.map((n) => (n.type === "timer" ? (n.limit ?? 0) : 0)));
}

function keyOf(s: GameState, cap: number): string {
  return [
    s.current,
    s.color,
    [...s.activated].sort().join(","),
    [...s.consumed].sort().join(","),
    cap ? Math.min(s.path.length - 1, cap) : 0,
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
  const cap = timerCap(level);
  const startKey = keyOf(from, cap);
  const parent = new Map<string, Link>([[startKey, { prev: null, via: null }]]);
  const queue: GameState[] = [from];
  let head = 0;

  while (head < queue.length) {
    const s = queue[head++];
    const k = keyOf(s, cap);

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
      const nk = keyOf(next, cap);
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
    if (ids.has(n.id)) issues.push(i18next.t('doppelteKnotenidId', { id: n.id }));
    ids.add(n.id);
    if (n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) {
      issues.push(i18next.t('knotenIdLiegtAuerhalbVon01', { id: n.id }));
    }
    if ((n.type === "color" || n.type === "gate") && !n.color) {
      issues.push(i18next.t('knotenIdTypeHatKeineFarbe', { id: n.id, type: n.type }));
    }
    if (n.type === "timer" && !(Number.isInteger(n.limit) && n.limit! >= 1)) {
      issues.push(i18next.t('zeitknotenIdBrauchtEinGanzzahligesLimit', { id: n.id }));
    }
    if (n.type === "mirror") {
      const twin = level.nodes.find((x) => x.id === n.pair);
      if (!twin || twin.type !== "mirror" || twin.pair !== n.id || twin.id === n.id) {
        issues.push(i18next.t('spiegelknotenIdBrauchtEinenZwillingDer', { id: n.id }));
      }
    }
  }

  if (!ids.has(level.start)) issues.push(i18next.t('startknotenStartExistiertNicht', { start: level.start }));
  const startNode = level.nodes.find((n) => n.id === level.start);
  if (startNode && (startNode.type === "mirror" || startNode.type === "gate" || startNode.type === "timer")) {
    issues.push(i18next.t('derStartknotenDarfKeinSpiegelTorOder'));
  }

  const byId = new Map(level.nodes.map((n) => [n.id, n]));
  for (const e of level.edges) {
    const a = byId.get(e.from);
    if (a?.type === "mirror" && a.pair === e.to) issues.push(i18next.t('zwillingeFromUndToDrfenKeineKanteTeilen', { from: e.from, to: e.to }));
    if (!ids.has(e.from)) issues.push(i18next.t('kanteVerweistAufUnbekanntenKnotenFrom', { from: e.from }));
    if (!ids.has(e.to)) issues.push(i18next.t('kanteVerweistAufUnbekanntenKnotenTo', { to: e.to }));
  }

  if (ids.has(level.start)) {
    const seen = new Set([level.start]);
    const stack = [level.start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of level.edges) {
        const next = e.from === cur ? e.to : e.to === cur && !e.oneWay ? e.from : null;
        if (!next || !ids.has(next) || seen.has(next)) continue;
        const nd = byId.get(next)!;
        if (nd.type === "mirror" && nd.pair && ids.has(nd.pair)) {
          seen.add(next);
          if (!seen.has(nd.pair)) {
            seen.add(nd.pair);
            stack.push(nd.pair);
          }
        } else {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    for (const id of ids) {
      if (!seen.has(id)) issues.push(i18next.t('knotenIdIstVomStartAusNieErreichbar', { id }));
    }
  }

  return issues;
}
