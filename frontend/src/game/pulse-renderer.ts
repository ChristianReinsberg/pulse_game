import { Application, BlurFilter, Container, Graphics, Ticker } from "pixi.js";
import {
  GameState,
  LevelDef,
  NodeDef,
  PulseColor,
  createState,
  isStuck,
  isWon,
  legalMoves,
  move,
  noteFor,
  playNote,
} from "./pulse-core";

const COLORS: Record<PulseColor, number> = {
  white: 0xe8f1ff,
  red: 0xff5d73,
  blue: 0x4da3ff,
};
const DIM = 0x3a4560;
const PADDING = 56;
const TAP_RADIUS = 44;
const STEP_MS = 220;

interface Point {
  x: number;
  y: number;
}

export interface PulseGameOptions {
  onWin?: () => void;
  onStuck?: () => void;
}

export class PulseGame {
  private state: GameState;
  private busy = false;
  private audio?: AudioContext;

  private edgesG = new Graphics();
  private nodesG = new Graphics();
  private pulseG = new Graphics();
  private glowLayer = new Container();
  private glowG = new Graphics();

  constructor(
    private app: Application,
    private level: LevelDef,
    private opts: PulseGameOptions = {}
  ) {
    this.state = createState(level);

    this.glowG.filters = [new BlurFilter({ strength: 12 })];
    this.glowLayer.addChild(this.glowG);

    app.stage.addChild(this.glowLayer, this.edgesG, this.nodesG, this.pulseG);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointertap", (e) => this.onTap({ x: e.global.x, y: e.global.y }));

    app.renderer.on("resize", () => this.draw());
    this.draw();
  }

  reset(): void {
    if (this.busy) return;
    this.state = createState(this.level);
    this.draw();
  }

  undo(): void {
    if (this.busy || this.state.path.length < 2) return;
    // Zustand neu aufbauen, weil move() immutable ist
    const steps = this.state.path.slice(1, -1);
    let s = createState(this.level);
    for (const id of steps) s = move(this.level, s, id) ?? s;
    this.state = s;
    this.draw();
  }

  private onTap(p: Point): void {
    if (this.busy) return;
    this.audio ??= new AudioContext();

    const target = this.nearestLegalNode(p);
    if (!target) return;

    const next = move(this.level, this.state, target.id);
    if (!next) return;

    const from = this.toScreen(this.nodeById(this.state.current));
    const to = this.toScreen(target);

    this.busy = true;
    this.animatePulse(from, to, () => {
      this.state = next;
      playNote(this.audio!, noteFor(next.path.length - 2));
      this.busy = false;
      this.draw();

      if (isWon(this.level, next)) this.opts.onWin?.();
      else if (isStuck(this.level, next)) this.opts.onStuck?.();
    });
  }

  private nearestLegalNode(p: Point): NodeDef | undefined {
    let best: NodeDef | undefined;
    let bestDist = TAP_RADIUS;
    for (const id of legalMoves(this.level, this.state)) {
      const n = this.nodeById(id);
      const s = this.toScreen(n);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  }

  private draw(): void {
    const { edgesG, nodesG, glowG, pulseG } = this;
    edgesG.clear();
    nodesG.clear();
    glowG.clear();
    pulseG.clear();

    for (const e of this.level.edges) {
      const a = this.toScreen(this.nodeById(e.from));
      const b = this.toScreen(this.nodeById(e.to));
      const used = this.isEdgeUsed(e.from, e.to);
      const color = used ? COLORS[this.state.color] : DIM;

      edgesG.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color, alpha: used ? 0.9 : 0.6 });

      if (e.oneWay) this.drawArrow(edgesG, a, b, color);
    }

    const legal = new Set(legalMoves(this.level, this.state));
    for (const n of this.level.nodes) {
      if (this.state.consumed.has(n.id)) continue;

      const p = this.toScreen(n);
      const active = this.state.activated.has(n.id);
      const isCurrent = n.id === this.state.current;
      const base = n.color ? COLORS[n.color] : COLORS.white;
      const fill = isCurrent ? COLORS[this.state.color] : active ? base : DIM;

      switch (n.type) {
        case "once":
          nodesG.circle(p.x, p.y, 16).fill({ color: fill }).stroke({ width: 2, color: base });
          nodesG.circle(p.x, p.y, 23).stroke({ width: 2, color: base, alpha: 0.7 });
          break;
        case "color":
          nodesG.circle(p.x, p.y, 16).fill({ color: base });
          break;
        case "gate":
          nodesG.circle(p.x, p.y, 18).stroke({ width: 4, color: base });
          nodesG.circle(p.x, p.y, 7).fill({ color: fill });
          break;
        default:
          nodesG.circle(p.x, p.y, 14).fill({ color: fill });
      }

      if (legal.has(n.id)) nodesG.circle(p.x, p.y, 28).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });

      if (isCurrent || active) glowG.circle(p.x, p.y, 26).fill({ color: fill, alpha: 0.7 });
    }

    const cur = this.toScreen(this.nodeById(this.state.current));
    pulseG.circle(cur.x, cur.y, 7).fill({ color: 0xffffff });
  }

  private drawArrow(g: Graphics, a: Point, b: Point, color: number): void {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const s = 9;
    g.poly([
      mx + Math.cos(ang) * s, my + Math.sin(ang) * s,
      mx + Math.cos(ang + 2.5) * s, my + Math.sin(ang + 2.5) * s,
      mx + Math.cos(ang - 2.5) * s, my + Math.sin(ang - 2.5) * s,
    ]).fill({ color });
  }

  private animatePulse(from: Point, to: Point, done: () => void): void {
    let t = 0;
    const tick = (tk: Ticker) => {
      t += tk.elapsedMS;
      const k = Math.min(t / STEP_MS, 1);
      const ease = 1 - (1 - k) ** 3; // ease-out
      this.pulseG.clear();
      this.pulseG
        .circle(from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease, 7)
        .fill({ color: 0xffffff });
      if (k >= 1) {
        this.app.ticker.remove(tick);
        done();
      }
    };
    this.app.ticker.add(tick);
  }

  private isEdgeUsed(a: string, b: string): boolean {
    const p = this.state.path;
    for (let i = 0; i < p.length - 1; i++) {
      if ((p[i] === a && p[i + 1] === b) || (p[i] === b && p[i + 1] === a)) return true;
    }
    return false;
  }

  private nodeById(id: string): NodeDef {
    return this.level.nodes.find((n) => n.id === id)!;
  }

  private toScreen(n: NodeDef): Point {
    const w = this.app.screen.width - PADDING * 2;
    const h = this.app.screen.height - PADDING * 2;
    return { x: PADDING + n.x * w, y: PADDING + n.y * h };
  }
}
