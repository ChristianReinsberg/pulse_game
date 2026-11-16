import type { LevelDef, NodeDef, NodeType, PulseColor, EdgeDef } from "./pulse-core";
import { validateLevel } from "./pulse-solver";

export const CODE_PREFIX = "P1.";
export const MAX_NODES = 16;
export const MAX_EDGES = 60;
export const MAX_NAME = 40;
export const MAX_CODE_LENGTH = 4000;

export type DecodeResult = { level: LevelDef } | { error: string };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function nodeToString(n: NodeDef): string {
  let s = `${n.id}:${round3(n.x)},${round3(n.y)}`;
  if (n.type && n.type !== "normal") {
    s += ":" + n.type;
    if (n.type === "timer") s += ":" + n.limit;
    else if (n.type === "mirror") s += ":" + n.pair;
    else if (n.type === "color" || n.type === "gate") s += ":" + n.color;
  }
  return s;
}

const edgeToString = (e: EdgeDef) => `${e.from}${e.oneWay ? ">" : "-"}${e.to}`;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function sanitizeName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, MAX_NAME);
}

export function encodeLevel(level: LevelDef): string {
  const wire = {
    n: sanitizeName(level.name),
    s: level.start,
    v: level.nodes.map(nodeToString),
    e: level.edges.map(edgeToString),
  };
  return CODE_PREFIX + toBase64Url(JSON.stringify(wire));
}

const NODE_RE = /^([a-z0-9]{1,3}):(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?::([a-z]+)(?::([a-z0-9]+))?)?$/;
const EDGE_RE = /^([a-z0-9]{1,3})([->])([a-z0-9]{1,3})$/;
const ID_RE = /^[a-z0-9]{1,3}$/;
const TYPES = new Set<string>(["once", "color", "gate", "timer", "mirror"]);

function parseNode(s: unknown): NodeDef | string {
  if (typeof s !== "string") return "Knoten ungültig";
  const m = NODE_RE.exec(s);
  if (!m) return `Knoten „${s.slice(0, 20)}“ ungültig`;
  const [, id, xs, ys, type, extra] = m;
  const x = Number(xs);
  const y = Number(ys);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return "Koordinaten außerhalb des Spielfelds";
  const node: NodeDef = { id, x, y };
  if (!type) {
    if (extra) return "Knoten ungültig";
    return node;
  }
  if (!TYPES.has(type)) return `Unbekannte Knotenart „${type.slice(0, 12)}“`;
  node.type = type as NodeType;
  if (type === "once") {
    if (extra) return "Einmal-Knoten ohne Zusatz erwartet";
  } else if (type === "color" || type === "gate") {
    if (extra !== "red" && extra !== "blue") return "Farbe ungültig";
    node.color = extra as PulseColor;
  } else if (type === "timer") {
    if (!extra || !/^\d{1,2}$/.test(extra) || Number(extra) < 1) return "Zeitlimit ungültig";
    node.limit = Number(extra);
  } else if (type === "mirror") {
    if (!extra || !ID_RE.test(extra)) return "Spiegelzwilling ungültig";
    node.pair = extra;
  }
  return node;
}

export function decodeLevel(input: string, strict = true): DecodeResult {
  const code = input.trim().split("#").pop() ?? "";
  if (!code.startsWith(CODE_PREFIX)) return { error: "Das ist kein Pulse-Level-Code." };
  if (code.length > MAX_CODE_LENGTH) return { error: "Der Code ist zu lang." };
  const body = code.slice(CODE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return { error: "Der Code enthält ungültige Zeichen." };

  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(body));
  } catch {
    return { error: "Der Code ist beschädigt." };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { error: "Der Code ist beschädigt." };
  const w = data as Record<string, unknown>;
  if (typeof w.n !== "string" || typeof w.s !== "string" || !Array.isArray(w.v) || !Array.isArray(w.e)) {
    return { error: "Der Code ist unvollständig." };
  }
  if (w.v.length < 1 || w.v.length > MAX_NODES) return { error: `Ein Level hat 1 bis ${MAX_NODES} Knoten.` };
  if (w.e.length > MAX_EDGES) return { error: "Zu viele Kanten." };

  const nodes: NodeDef[] = [];
  for (const raw of w.v) {
    const n = parseNode(raw);
    if (typeof n === "string") return { error: n };
    if (nodes.some((x) => x.id === n.id)) return { error: `Doppelte Knoten-ID ${n.id}` };
    nodes.push(n);
  }
  if (!ID_RE.test(w.s) || !nodes.some((n) => n.id === w.s)) return { error: "Startknoten fehlt." };

  const edges: EdgeDef[] = [];
  for (const raw of w.e) {
    const m = typeof raw === "string" ? EDGE_RE.exec(raw) : null;
    if (!m) return { error: "Kante ungültig." };
    const [, from, op, to] = m;
    if (!nodes.some((n) => n.id === from) || !nodes.some((n) => n.id === to) || from === to) {
      return { error: "Kante verweist auf einen unbekannten Knoten." };
    }
    edges.push(op === ">" ? { from, to, oneWay: true } : { from, to });
  }

  const level: LevelDef = { id: 0, name: sanitizeName(w.n) || "Eigenes Level", start: w.s, nodes, edges };
  if (strict) {
    const issues = validateLevel(level);
    if (issues.length) return { error: issues[0] };
  }
  return { level };
}
