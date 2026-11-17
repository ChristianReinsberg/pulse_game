import { GameState, LevelDef, createState, isWon, legalMoves, move } from "./pulse-core";
import { timerCap } from "./pulse-solver";
import i18next from "@/i18n";

export interface LevelStats {
  solvable: boolean;
  truncated: boolean;
  moves: number | null;
  shortestSolutions: number;
  states: number;
 trapPct: number;
  firstMoves: number;
  badFirst: number;
}

export type Difficulty = "leicht" | "mittel" | "schwer" | "knifflig";

export function analyzeLevel(level: LevelDef, cap = 60000): LevelStats {
  const timers = timerCap(level);
  const keyOf = (s: GameState) =>
    [
      s.current,
      s.color,
      [...s.activated].sort().join(","),
      [...s.consumed].sort().join(","),
      timers ? Math.min(s.path.length - 1, timers) : 0,
    ].join("|");

  const start = createState(level);
  const states = new Map<string, GameState>();
  const edges = new Map<string, string[]>();
  const dist = new Map<string, number>();
  const cnt = new Map<string, number>();
  const sk = keyOf(start);
  states.set(sk, start);
  dist.set(sk, 0);
  cnt.set(sk, 1);
  const queue = [sk];

  for (let head = 0; head < queue.length; head++) {
    const k = queue[head];
    const s = states.get(k)!;
    const outs: string[] = [];
    if (!isWon(level, s)) {
      for (const id of legalMoves(level, s)) {
        const n = move(level, s, id)!;
        const nk = keyOf(n);
        outs.push(nk);
        if (!states.has(nk)) {
          if (states.size >= cap) {
            return { solvable: false, truncated: true, moves: null, shortestSolutions: 0, states: states.size, trapPct: 0, firstMoves: 0, badFirst: 0 };
          }
          states.set(nk, n);
          dist.set(nk, dist.get(k)! + 1);
          cnt.set(nk, 0);
          queue.push(nk);
        }
        if (dist.get(nk) === dist.get(k)! + 1) cnt.set(nk, cnt.get(nk)! + cnt.get(k)!);
      }
    }
    edges.set(k, outs);
  }

  const wins = [...states.keys()].filter((k) => isWon(level, states.get(k)!));
  const reverse = new Map<string, string[]>();
  for (const [k, outs] of edges) {
    for (const o of outs) {
      if (!reverse.has(o)) reverse.set(o, []);
      reverse.get(o)!.push(k);
    }
  }
  const good = new Set(wins);
  const stack = [...wins];
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of reverse.get(k) ?? []) {
      if (!good.has(p)) {
        good.add(p);
        stack.push(p);
      }
    }
  }

  let best = Infinity;
  let ways = 0;
  for (const k of wins) {
    const d = dist.get(k)!;
    if (d < best) {
      best = d;
      ways = cnt.get(k)!;
    } else if (d === best) ways += cnt.get(k)!;
  }
  const trap = [...states.keys()].filter((k) => !good.has(k)).length;
  const first = edges.get(sk) ?? [];

  return {
    solvable: good.has(sk),
    truncated: false,
    moves: wins.length ? best : null,
    shortestSolutions: ways,
    states: states.size,
    trapPct: Math.round((100 * trap) / states.size),
    firstMoves: first.length,
    badFirst: first.filter((k) => !good.has(k)).length,
  };
}

export function difficultyOf(s: LevelStats): Difficulty | null {
  if (!s.solvable || s.moves === null) return null;
  const score = (s.trapPct / 100) * 0.6 + (Math.min(s.moves, 20) / 20) * 0.4;
  return score < 0.35 ? i18next.t('leicht') : score < 0.55 ? i18next.t('mittel') : score < 0.75 ? i18next.t('schwer') : i18next.t('knifflig');
}
