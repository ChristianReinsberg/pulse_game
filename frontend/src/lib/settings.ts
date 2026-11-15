import { DEFAULT_AUDIO, INSTRUMENTS, type AudioSettings } from "@/game/music";
import { DEFAULT_PALETTE, DEFAULT_PULSE, PALETTES, isReadable, type PaletteId } from "@/game/theme";
import { createStore } from "./store";

export const SETTINGS_KEY = "pulse:settings:v1";

export interface Settings extends AudioSettings {
  version: 1;
  palette: PaletteId;
  pulse: string;
}

const defaults = (): Settings => ({ version: 1, palette: DEFAULT_PALETTE, pulse: DEFAULT_PULSE, ...DEFAULT_AUDIO });

export function parseSettings(raw: string | null): Settings {
  if (!raw) return defaults();
  try {
    const d = JSON.parse(raw);
    if (d?.version !== 1) return defaults();
    return {
      version: 1,
      palette: d.palette in PALETTES ? d.palette : DEFAULT_PALETTE,
      pulse: typeof d.pulse === "string" && isReadable(d.pulse) ? d.pulse.toLowerCase() : DEFAULT_PULSE,
      instrument: d.instrument in INSTRUMENTS ? d.instrument : DEFAULT_AUDIO.instrument,
      volume: typeof d.volume === "number" && d.volume >= 0 && d.volume <= 1 ? d.volume : DEFAULT_AUDIO.volume,
      muted: typeof d.muted === "boolean" ? d.muted : DEFAULT_AUDIO.muted,
      drone: typeof d.drone === "boolean" ? d.drone : DEFAULT_AUDIO.drone,
    };
  } catch {
    return defaults();
  }
}

const store = createStore<Settings>(SETTINGS_KEY, parseSettings, defaults);

export const getSettings = store.getSnapshot;
export const subscribeSettings = store.subscribe;
export const resetSettings = store.reset;

export function updateSettings(patch: Partial<Omit<Settings, "version">>): void {
  store.set({ ...getSettings(), ...patch });
}

export const pickAudio = (s: Settings): AudioSettings => ({
  instrument: s.instrument,
  volume: s.volume,
  muted: s.muted,
  drone: s.drone,
});
