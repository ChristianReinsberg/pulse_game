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
} from "./pulse-core";
import { hint as solverHint } from "./pulse-solver";
import { DEFAULT_THEME, type Theme } from "./theme";

type Shape = "circle" | "triangle" | "diamond";
const SHAPE: Record<PulseColor, Shape> = { white: "circle", red: "triangle", blue: "diamond" };

const BG = 0x0b0f1a;
const HINT_COLOR = 0xffd166;
const HINT_MS = 2500;
const FLASH_MS = 450;
const PADDING = 56;
const TAP_RADIUS = 44;
const STEP_MS = 220;

interface Point {
  x: number;
  y: number;
}

export type HintResult = "shown" | "unsolvable" | "done";

export interface PulseGameOptions {
  theme?: Theme;
  audio?: { resume(): void; step(nodeId: string, delaySec?: number): void };
  onMove?: (moves: number) => void;
  onWin?: (moves: number) => void;
  onStuck?: () => void;
}

function glyph(g: Graphics, shape: Shape, x: number, y: number, r: number): Graphics {
  switch (shape) {
    case "triangle":
      return g.poly([x, y - r, x + r * 0.95, y + r * 0.8, x - r * 0.95, y + r * 0.8]);
    case "diamond":
      return g.poly([x, y - r, x + r, y, x, y + r, x - r, y]);
    default:
      return g.circle(x, y, r);
  }
}

export class PulseGame {
  private state: GameState;
  private theme: Theme;
  private busy = false;

  private legal: string[] = [];
  private hintNode: string | null = null;
  private hintUntil = 0;
  private flash: { id: string; until: number } | null = null;
  private time = 0;
  private readonly reduceMotion: boolean;

  private edgesG = new Graphics();
  private nodesG = new Graphics();
  private ringsG = new Graphics();
  private pulseG = new Graphics();
  private glowLayer = new Container();
  private glowG = new Graphics();

  private readonly tick = (tk: Ticker) => {
    this.time += tk.elapsedMS;
    const hintExpired = this.hintNode !== null && this.time > this.hintUntil;
    if (hintExpired) this.hintNode = null;
    const flashExpired = this.flash !== null && this.time > this.flash.until;
    if (flashExpired) this.flash = null;
    if (this.reduceMotion && !hintExpired && !flashExpired) return;
    this.drawRings();
  };

  constructor(
    private app: Application,
    private level: LevelDef,
    private opts: PulseGameOptions = {}
  ) {
    this.state = createState(level);
    this.theme = opts.theme ?? DEFAULT_THEME;
    this.reduceMotion =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.glowG.filters = [new BlurFilter({ strength: 12 })];
    this.glowLayer.addChild(this.glowG);

    app.stage.addChild(this.glowLayer, this.edgesG, this.nodesG, this.ringsG, this.pulseG);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointertap", (e) => this.onTap({ x: e.global.x, y: e.global.y }));

    app.renderer.on("resize", () => this.draw());
    app.ticker.add(this.tick);
    this.draw();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.draw();
  }

  reset(): void {
    if (this.busy) return;
    this.state = createState(this.level);
    this.hintNode = null;
    this.draw();
    this.opts.onMove?.(0);
  }

  undo(): void {
    if (this.busy || this.state.path.length < 2) return;
    const steps = this.state.path.slice(1, -1);
    let s = createState(this.level);
    for (const id of steps) s = move(this.level, s, id) ?? s;
    this.state = s;
    this.hintNode = null;
    this.draw();
    this.opts.onMove?.(this.state.path.length - 1);
  }

  hint(): HintResult {
    if (this.busy) return "shown";
    if (isWon(this.level, this.state)) return "done";
    const target = solverHint(this.level, this.state);
    if (!target) return "unsolvable";
    this.hintNode = target;
    this.hintUntil = this.time + HINT_MS;
    this.drawRings();
    return "shown";
  }

  destroy(): void {
    this.app.ticker.remove(this.tick);
  }

  private onTap(p: Point): void {
    if (this.busy) return;
    this.opts.audio?.resume();

    const target = this.nearestLegalNode(p);
    if (!target) return;

    const next = move(this.level, this.state, target.id);
    if (!next) return;

    const from = this.toScreen(this.nodeById(this.state.current));
    const to = this.toScreen(target);
    const color = this.state.color;

    this.busy = true;
    this.hintNode = null;
    this.drawRings();
    this.animatePulse(from, to, color, () => {
      this.state = next;
      this.opts.audio?.step(target.id);
      if (next.current !== target.id) {
        this.opts.audio?.step(next.current, 0.12);
        if (!this.reduceMotion) this.flash = { id: next.current, until: this.time + FLASH_MS };
      }
      this.busy = false;
      this.draw();

      const moves = next.path.length - 1;
      this.opts.onMove?.(moves);
      if (isWon(this.level, next)) this.opts.onWin?.(moves);
      else if (isStuck(this.level, next)) this.opts.onStuck?.();
    });
  }

  private nearestLegalNode(p: Point): NodeDef | undefined {
    let best: NodeDef | undefined;
    let bestDist = TAP_RADIUS;
    for (const id of this.legal) {
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
    const { edgesG, nodesG, glowG, pulseG, theme } = this;
    edgesG.clear();
    nodesG.clear();
    glowG.clear();
    pulseG.clear();

    this.legal = legalMoves(this.level, this.state);
    const moves = this.state.path.length - 1;

    for (const e of this.level.edges) {
      const a = this.toScreen(this.nodeById(e.from));
      const b = this.toScreen(this.nodeById(e.to));
      const used = this.isEdgeUsed(e.from, e.to);
      const color = used ? theme[this.state.color] : theme.dim;

      edgesG.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color, alpha: used ? 0.9 : 0.6 });

      if (e.oneWay) this.drawArrow(edgesG, a, b, color);
    }

    for (const n of this.level.nodes) {
      if (n.type !== "mirror" || !n.pair || n.id > n.pair) continue;
      const twin = this.nodeById(n.pair);
      if (twin) this.drawDashed(edgesG, this.toScreen(n), this.toScreen(twin), theme.white, 0.45);
    }

    for (const n of this.level.nodes) {
      if (this.state.consumed.has(n.id)) continue;

      const p = this.toScreen(n);

      if (n.type === "timer" && (n.limit ?? 0) - moves <= 0) {
        nodesG.circle(p.x, p.y, 14).stroke({ width: 2, color: theme.dim, alpha: 0.5 });
        continue;
      }

      const active = this.state.activated.has(n.id);
      const isCurrent = n.id === this.state.current;
      const base = theme[n.color ?? "white"];
      const fill = isCurrent ? theme[this.state.color] : active ? base : theme.dim;

      switch (n.type) {
        case "once":
          nodesG.circle(p.x, p.y, 16).fill({ color: fill }).stroke({ width: 2, color: base });
          nodesG.circle(p.x, p.y, 23).stroke({ width: 2, color: base, alpha: 0.7 });
          break;
        case "color":
          nodesG.circle(p.x, p.y, 18).fill({ color: base });
          glyph(nodesG, SHAPE[n.color ?? "white"], p.x, p.y, 8).fill({ color: BG });
          break;
        case "gate":
          nodesG.circle(p.x, p.y, 20).stroke({ width: 4, color: base });
          glyph(nodesG, SHAPE[n.color ?? "white"], p.x, p.y, 8).fill({ color: base });
          break;
        case "timer": {
          const limit = n.limit ?? 0;
          nodesG.circle(p.x, p.y, 14).fill({ color: fill });
          this.drawSegments(nodesG, p, 23, limit, Math.max(0, limit - moves), theme.white, theme.dim);
          break;
        }
        case "mirror":
          nodesG.rect(p.x - 15, p.y - 15, 30, 30).fill({ color: fill }).stroke({ width: 2, color: theme.white });
          nodesG.moveTo(p.x - 7, p.y + 7).lineTo(p.x + 7, p.y - 7).stroke({ width: 3, color: BG });
          break;
        default:
          nodesG.circle(p.x, p.y, 14).fill({ color: fill });
      }

      if (isCurrent || active) glowG.circle(p.x, p.y, 26).fill({ color: fill, alpha: 0.7 });
    }

    const cur = this.toScreen(this.nodeById(this.state.current));
    this.drawPulse(cur, this.state.color);
    this.drawRings();
  }

  private drawRings(): void {
    const g = this.ringsG;
    g.clear();
    if (this.busy) return;

    const k = this.reduceMotion ? 0 : (Math.sin(this.time / 450) + 1) / 2;
    for (const id of this.legal) {
      const p = this.toScreen(this.nodeById(id));
      g.circle(p.x, p.y, 28 + 4 * k).stroke({ width: 2, color: 0xffffff, alpha: 0.25 + 0.3 * k });
    }
    if (this.flash) {
      const prog = 1 - (this.flash.until - this.time) / FLASH_MS;
      const p = this.toScreen(this.nodeById(this.flash.id));
      g.circle(p.x, p.y, 16 + 34 * prog).stroke({ width: 3, color: 0xffffff, alpha: Math.max(0, 0.8 * (1 - prog)) });
    }
    if (this.hintNode) {
      const p = this.toScreen(this.nodeById(this.hintNode));
      g.circle(p.x, p.y, 36 + 6 * k).stroke({ width: 4, color: HINT_COLOR, alpha: 0.95 });
    }
  }

  private drawPulse(p: Point, color: PulseColor): void {
    glyph(this.pulseG, SHAPE[color], p.x, p.y, 9)
      .fill({ color: 0xffffff })
      .stroke({ width: 2, color: this.theme[color] });
  }

  private drawDashed(g: Graphics, a: Point, b: Point, color: number, alpha: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    for (let d = 0; d < len; d += 16) {
      const e = Math.min(d + 8, len);
      g.moveTo(a.x + (dx * d) / len, a.y + (dy * d) / len).lineTo(a.x + (dx * e) / len, a.y + (dy * e) / len);
    }
    g.stroke({ width: 2, color, alpha });
  }

  private drawSegments(g: Graphics, c: Point, r: number, total: number, lit: number, on: number, off: number): void {
    if (total <= 0) return;
    const step = (Math.PI * 2) / total;
    const gap = Math.min(0.14, step * 0.4);
    for (let i = 0; i < total; i++) {
      const a0 = -Math.PI / 2 + i * step + gap / 2;
      const a1 = -Math.PI / 2 + (i + 1) * step - gap / 2;
      g.moveTo(c.x + Math.cos(a0) * r, c.y + Math.sin(a0) * r)
        .arc(c.x, c.y, r, a0, a1)
        .stroke({ width: 4, color: i < lit ? on : off, alpha: i < lit ? 1 : 0.35 });
    }
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

  private animatePulse(from: Point, to: Point, color: PulseColor, done: () => void): void {
    let t = 0;
    const step = (tk: Ticker) => {
      t += tk.elapsedMS;
      const k = Math.min(t / STEP_MS, 1);
      const ease = 1 - (1 - k) ** 3;
      this.pulseG.clear();
      this.drawPulse({ x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease }, color);
      if (k >= 1) {
        this.app.ticker.remove(step);
        done();
      }
    };
    this.app.ticker.add(step);
  }


  private isEdgeUsed(a: string, b: string): boolean {
    const { positions, path } = this.state;
    for (let i = 0; i < path.length - 1; i++) {
      const from = positions[i];
      const to = path[i + 1];
      if ((from === a && to === b) || (from === b && to === a)) return true;
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
