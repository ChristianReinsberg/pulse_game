"use client";

import { useRef, useState } from "react";
import { COLS, ROWS, cellX, cellY } from "@/game/editor";
import type { LevelDef, NodeDef, PulseColor } from "@/game/pulse-core";
import { BACKGROUND, toHex, type Theme } from "@/game/theme";

export type Tool = "add" | "edge" | "move" | "delete";

const W = 700;
const H = 500;

interface Props {
  level: LevelDef;
  theme: Theme;
  tool: Tool;
  selected: string | null;
  edgeFrom: string | null;
  pairFrom: string | null;
  onNode: (id: string) => void;
  onEmpty: (x: number, y: number) => void;
  onEdge: (index: number) => void;
  onMove: (id: string, x: number, y: number) => void;
}

type Shape = "circle" | "triangle" | "diamond";
const SHAPE: Record<PulseColor, Shape> = { white: "circle", red: "triangle", blue: "diamond" };

function Glyph({ shape, r, fill }: { shape: Shape; r: number; fill: string }) {
  if (shape === "triangle") return <polygon points={`0,${-r} ${r * 0.95},${r * 0.8} ${-r * 0.95},${r * 0.8}`} fill={fill} />;
  if (shape === "diamond") return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} />;
  return <circle r={r} fill={fill} />;
}

function arcPath(r: number, a0: number, a1: number): string {
  const p = (a: number) => `${Math.cos(a) * r} ${Math.sin(a) * r}`;
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}

/** Gleiche Formen wie im Spiel, damit der Editor zeigt, was der Spieler sieht. */
function NodeShape({ node, theme }: { node: NodeDef; theme: Theme }) {
  const white = toHex(theme.white);
  const base = toHex(theme[node.color ?? "white"]);

  switch (node.type) {
    case "once":
      return (
        <>
          <circle r={14} fill={white} />
          <circle r={21} fill="none" stroke={white} strokeWidth={2} opacity={0.7} />
        </>
      );
    case "color":
      return (
        <>
          <circle r={18} fill={base} />
          <Glyph shape={SHAPE[node.color ?? "white"]} r={8} fill={BACKGROUND} />
        </>
      );
    case "gate":
      return (
        <>
          <circle r={20} fill="none" stroke={base} strokeWidth={4} />
          <Glyph shape={SHAPE[node.color ?? "white"]} r={8} fill={base} />
        </>
      );
    case "timer": {
      const limit = Math.max(1, node.limit ?? 1);
      const step = (Math.PI * 2) / limit;
      const gap = Math.min(0.14, step * 0.4);
      return (
        <>
          <circle r={14} fill={white} />
          {limit === 1 ? (
            <circle r={23} fill="none" stroke={white} strokeWidth={4} />
          ) : (
            Array.from({ length: limit }, (_, i) => (
              <path
                key={i}
                d={arcPath(23, -Math.PI / 2 + i * step + gap / 2, -Math.PI / 2 + (i + 1) * step - gap / 2)}
                fill="none"
                stroke={white}
                strokeWidth={4}
              />
            ))
          )}
        </>
      );
    }
    case "mirror":
      return (
        <>
          <rect x={-15} y={-15} width={30} height={30} fill={white} stroke={white} strokeWidth={2} />
          <line x1={-7} y1={7} x2={7} y2={-7} stroke={BACKGROUND} strokeWidth={3} />
        </>
      );
    default:
      return <circle r={14} fill={white} />;
  }
}

function nodeLabel(n: NodeDef): string {
  const kind: Record<string, string> = {
    once: "Einmal-Knoten",
    color: `Farbknoten ${n.color === "blue" ? "Raute" : "Dreieck"}`,
    gate: `Tor ${n.color === "blue" ? "Raute" : "Dreieck"}`,
    timer: `Zeitknoten, Limit ${n.limit}`,
    mirror: `Spiegel, Zwilling ${n.pair}`,
  };
  return `Knoten ${n.id}, ${kind[n.type ?? ""] ?? "normal"}`;
}

export default function EditorBoard({ level, theme, tool, selected, edgeFrom, pairFrom, onNode, onEmpty, onEdge, onMove }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; moved: boolean; sx: number; sy: number } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);

  const toLevel = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x / W, y: p.y / H };
  };

  const pos = (n: NodeDef) => (ghost?.id === n.id ? { x: ghost.x * W, y: ghost.y * H } : { x: n.x * W, y: n.y * H });
  const byId = new Map(level.nodes.map((n) => [n.id, n]));

  const down = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (tool !== "move") return;
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = { id, moved: false, sx: e.clientX, sy: e.clientY };
  };
  const moveEvt = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
    d.moved = true;
    setGhost({ id: d.id, ...toLevel(e) });
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    if (d.moved) {
      const p = toLevel(e);
      onMove(d.id, p.x, p.y);
    } else onNode(d.id);
  };

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`0 0 ${W} ${H}`}
      role="application"
      aria-label="Spielfeld des Level-Editors"
      onPointerMove={moveEvt}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null;
        setGhost(null);
      }}
    >
      <rect
        width={W}
        height={H}
        fill="transparent"
        onClick={(e) => {
          const p = toLevel(e);
          onEmpty(p.x, p.y);
        }}
      />

      {Array.from({ length: COLS }, (_, c) =>
        Array.from({ length: ROWS }, (_, r) => (
          <circle key={`${c}-${r}`} cx={cellX(c) * W} cy={cellY(r) * H} r={2.5} fill="#243049" pointerEvents="none" />
        ))
      )}

      {level.nodes.map((n) => {
        if (n.type !== "mirror" || !n.pair || n.id > n.pair) return null;
        const t = byId.get(n.pair);
        if (!t) return null;
        const a = pos(n);
        const b = pos(t);
        return <line key={`m-${n.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e8f1ff" strokeWidth={2} strokeDasharray="8 8" opacity={0.45} pointerEvents="none" />;
      })}

      {level.edges.map((e, i) => {
        const na = byId.get(e.from);
        const nb = byId.get(e.to);
        if (!na || !nb) return null;
        const a = pos(na);
        const b = pos(nb);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const s = 10;
        const arrow = [
          [mx + ux * s, my + uy * s],
          [mx + Math.cos(Math.atan2(uy, ux) + 2.5) * s, my + Math.sin(Math.atan2(uy, ux) + 2.5) * s],
          [mx + Math.cos(Math.atan2(uy, ux) - 2.5) * s, my + Math.sin(Math.atan2(uy, ux) - 2.5) * s],
        ]
          .map((p) => p.join(","))
          .join(" ");
        return (
          <g key={i} onClick={() => onEdge(i)} style={{ cursor: tool === "delete" ? "pointer" : "default" }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8a97b3" strokeWidth={3} />
            {e.oneWay && <polygon points={arrow} fill="#8a97b3" />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={26} />
          </g>
        );
      })}

      {level.nodes.map((n) => {
        const p = pos(n);
        const isStart = n.id === level.start;
        return (
          <g
            key={n.id}
            transform={`translate(${p.x} ${p.y})`}
            role="button"
            tabIndex={0}
            aria-label={nodeLabel(n) + (isStart ? ", Start" : "")}
            style={{ cursor: "pointer" }}
            onPointerDown={(e) => down(e, n.id)}
            onClick={() => tool !== "move" && onNode(n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNode(n.id);
              }
            }}
          >
            <circle r={30} fill="transparent" />
            {isStart && <circle r={29} fill="none" stroke="#ffd166" strokeWidth={2} strokeDasharray="5 4" />}
            {selected === n.id && <circle r={33} fill="none" stroke="#4da3ff" strokeWidth={3} />}
            {(edgeFrom === n.id || pairFrom === n.id) && <circle r={37} fill="none" stroke="#4da3ff" strokeWidth={2} strokeDasharray="4 4" />}
            <NodeShape node={n} theme={theme} />
            <text x={16} y={32} fontSize={14} fill="#8a97b3" pointerEvents="none">
              {n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
