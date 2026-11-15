export type NodeType = "normal" | "once" | "color" | "gate" | "timer" | "mirror";
export type PulseColor = "white" | "red" | "blue";

export interface NodeDef {
  id: string;
  x: number;
  y: number;
  type?: NodeType;
  color?: PulseColor;
  limit?: number;
  pair?: string;
}

export interface EdgeDef {
  from: string;
  to: string;
  oneWay?: boolean;
}

export interface LevelDef {
  id: number;
  name: string;
  start: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
  tip?: string;
}

export interface GameState {
  current: string;
  color: PulseColor;
  activated: Set<string>;
  consumed: Set<string>;
  path: string[];
  positions: string[];
}

export function createState(level: LevelDef): GameState {
  return {
    current: level.start,
    color: "white",
    activated: new Set([level.start]),
    consumed: new Set(),
    path: [level.start],
    positions: [level.start],
  };
}

function nodeById(level: LevelDef, id: string): NodeDef | undefined {
  return level.nodes.find((n) => n.id === id);
}

export const movesOf = (state: GameState): number => state.path.length - 1;

export function legalMoves(level: LevelDef, state: GameState): string[] {
  const moves = movesOf(state);
  const targets: string[] = [];
  for (const e of level.edges) {
    if (e.from === state.current) targets.push(e.to);
    else if (e.to === state.current && !e.oneWay) targets.push(e.from);
  }
  return targets.filter((id) => {
    if (state.consumed.has(id)) return false;
    const n = nodeById(level, id);
    if (!n) return false;
    if (n.type === "gate" && n.color !== state.color) return false;
    if (n.type === "timer" && n.limit !== undefined && moves >= n.limit) return false;
    if (n.type === "mirror" && (!n.pair || n.pair === state.current)) return false;
    return true;
  });
}

export function move(
  level: LevelDef,
  state: GameState,
  targetId: string
): GameState | null {
  if (!legalMoves(level, state).includes(targetId)) return null;

  const from = nodeById(level, state.current)!;
  const target = nodeById(level, targetId)!;
  const landing = target.type === "mirror" && target.pair ? nodeById(level, target.pair)! : target;

  const consumed = new Set(state.consumed);
  if (from.type === "once") consumed.add(from.id);

  const activated = new Set(state.activated);
  activated.add(target.id);
  activated.add(landing.id);

  return {
    current: landing.id,
    color: target.type === "color" && target.color ? target.color : state.color,
    activated,
    consumed,
    path: [...state.path, targetId],
    positions: [...state.positions, landing.id],
  };
}

export function isWon(level: LevelDef, state: GameState): boolean {
  return level.nodes.every((n) => state.activated.has(n.id));
}

export function isStuck(level: LevelDef, state: GameState): boolean {
  return !isWon(level, state) && legalMoves(level, state).length === 0;
}
