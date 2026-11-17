import type { PulseColor } from "./pulse-core";
import i18next from "@/i18n";

export type Theme = Record<PulseColor, number> & { dim: number };
export type PaletteId = "standard" | "colorblind";

export const BACKGROUND = "#0b0f1a";

export const PALETTES: Record<PaletteId, { label: string; description: string; red: number; blue: number }> = {
  standard: { label: i18next.t('standard'), description: i18next.t('rotUndBlau'), red: 0xff5d73, blue: 0x4da3ff },
  colorblind: { label: i18next.t('farbenblindFreundlich'), description: i18next.t('orangeUndHimmelblau'), red: 0xe69f00, blue: 0x56b4e9 },
};

export const PULSE_SWATCHES = [
  { label: i18next.t('weiss'), hex: "#e8f1ff" },
  { label: i18next.t('violett'), hex: "#b794ff" },
  { label: i18next.t('mint'), hex: "#6ee7b7" },
];

export const DEFAULT_PALETTE: PaletteId = "standard";
export const DEFAULT_PULSE = "#e8f1ff";

export const toNumber = (hex: string): number => parseInt(hex.slice(1), 16);
export const toHex = (n: number): string => "#" + n.toString(16).padStart(6, "0");

function luminance(hex: string): number {
  const n = toNumber(hex);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastToBackground(hex: string): number {
  const a = luminance(hex);
  const b = luminance(BACKGROUND);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const isReadable = (hex: string): boolean => /^#[0-9a-f]{6}$/i.test(hex) && contrastToBackground(hex) >= 3;

export function buildTheme(palette: PaletteId, pulseHex: string): Theme {
  const p = PALETTES[palette];
  return { white: toNumber(pulseHex), red: p.red, blue: p.blue, dim: 0x3a4560 };
}

export const DEFAULT_THEME: Theme = buildTheme(DEFAULT_PALETTE, DEFAULT_PULSE);
