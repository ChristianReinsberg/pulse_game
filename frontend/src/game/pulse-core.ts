export type NodeType = "normal" | "once" | "color" | "gate";
export type PulseColor = "white" | "red" | "blue";

export interface NodeDef {
  id: string;
  x: number;
  y: number;
  type?: NodeType;
  color?: PulseColor;
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
}

export interface GameState {
  current: string;
  color: PulseColor;
  activated: Set<string>;
  consumed: Set<string>;
  path: string[];
}

export function createState(level: LevelDef): GameState {
  return {
    current: level.start,
    color: "white",
    activated: new Set([level.start]),
    consumed: new Set(),
    path: [level.start],
  };
}

function nodeById(level: LevelDef, id: string): NodeDef | undefined {
  return level.nodes.find((n) => n.id === id);
}

export function legalMoves(level: LevelDef, state: GameState): string[] {
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

  const consumed = new Set(state.consumed);
  if (from.type === "once") consumed.add(from.id);

  const activated = new Set(state.activated);
  activated.add(targetId);

  return {
    current: targetId,
    color: target.type === "color" && target.color ? target.color : state.color,
    activated,
    consumed,
    path: [...state.path, targetId],
  };
}

export function isWon(level: LevelDef, state: GameState): boolean {
  return level.nodes.every((n) => state.activated.has(n.id));
}

export function isStuck(level: LevelDef, state: GameState): boolean {
  return !isWon(level, state) && legalMoves(level, state).length === 0;
}

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0]; // C D E G A

export function noteFor(stepIndex: number): number {
  const octave = Math.floor(stepIndex / PENTATONIC.length);
  return PENTATONIC[stepIndex % PENTATONIC.length] * 2 ** (octave % 3);
}

export function playNote(ctx: AudioContext, freq: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}
