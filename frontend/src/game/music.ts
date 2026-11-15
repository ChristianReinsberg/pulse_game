import type { LevelDef } from "./pulse-core";

export type InstrumentId = "synth" | "piano" | "guitar" | "drums";

export const INSTRUMENTS: Record<InstrumentId, { label: string; description: string }> = {
  synth: { label: "Synthesizer", description: "Weicher, klarer Ton" },
  piano: { label: "Klavier", description: "Angeschlagene Töne, die ausklingen" },
  guitar: { label: "E-Gitarre", description: "Gezupfte Saite mit leichter Verzerrung" },
  drums: { label: "Schlagzeug", description: "Jeder Knoten ein Drum-Sound, der Weg wird zum Rhythmus" },
};

export interface AudioSettings {
  instrument: InstrumentId;
  volume: number;
  muted: boolean;
  drone: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { instrument: "synth", volume: 0.7, muted: false, drone: false };

export type Mode = "major" | "minor";

export interface LevelKey {
  root: number;
  mode: Mode;
}

const SCALES: Record<Mode, number[]> = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };

export const LEVELS_PER_WORLD = 5;
const WORLDS: LevelKey[] = [
  { root: 48, mode: "major" }, // C-Dur: Level 1 to 5, lighter
  { root: 45, mode: "minor" }, // a-Moll: Level 6 to 10, darker
  { root: 43, mode: "major" }, // G-Dur
  { root: 40, mode: "minor" }, // e-Moll
];

export function keyForLevel(levelId: number): LevelKey {
  return WORLDS[Math.floor((levelId - 1) / LEVELS_PER_WORLD) % WORLDS.length];
}

export function degreeToMidi(key: LevelKey, degree: number): number {
  const scale = SCALES[key.mode];
  return key.root + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
}

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const DEGREES = 12;

export function nodeRanks(level: LevelDef): Map<string, number> {
  const sorted = [...level.nodes].sort((a, b) => b.y - a.y || a.x - b.x);
  return new Map(sorted.map((n, i) => [n.id, i]));
}

export function degreeFor(rank: number, count: number): number {
  if (count <= 1) return 0;
  const step = Math.min(2, (DEGREES - 1) / (count - 1));
  return Math.round(rank * step);
}

export type DrumVoice = "kick" | "tom" | "snare" | "hat" | "openhat";
const DRUM_ORDER: DrumVoice[] = ["kick", "tom", "snare", "hat", "openhat"];

export function drumVoiceFor(rank: number, count: number): DrumVoice {
  if (count <= 1) return "kick";
  return DRUM_ORDER[Math.min(DRUM_ORDER.length - 1, Math.floor((rank * DRUM_ORDER.length) / count))];
}
