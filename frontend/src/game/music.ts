import type { LevelDef } from "./pulse-core";
import i18next from 'i18next';

export type InstrumentId = "synth" | "piano" | "guitar" | "drums";

export const INSTRUMENTS: Record<InstrumentId, { label: string; description: string }> = {
  synth: { label: i18next.t('synth'), description: i18next.t('synthDesc') },
  piano: { label: i18next.t('piano'), description: i18next.t('pianoDesc') },
  guitar: { label: i18next.t('guitar'), description: i18next.t('guitarDesc') },
  drums: { label: i18next.t('drums'), description: i18next.t('drumsDesc') },
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

const WORLDS: (LevelKey & { from: number })[] = [
  { from: 1, root: 48, mode: "major" }, // C-Dur: basics
  { from: 6, root: 43, mode: "major" }, // G-Dur: learn oneway nodes
  { from: 10, root: 45, mode: "minor" }, // a-Moll: harder basics and oneway levels
  { from: 15, root: 38, mode: "major" }, // D-Dur: time and mirror nodes
  { from: 20, root: 40, mode: "minor" }, // e-Moll: may add some more levels later
];

export function keyForLevel(levelId: number): LevelKey {
  const w = [...WORLDS].reverse().find((x) => levelId >= x.from) ?? WORLDS[0];
  return { root: w.root, mode: w.mode };
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
