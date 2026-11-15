import { describe, expect, it } from "vitest";
import { buildTheme, contrastToBackground, isReadable } from "@/game/theme";
import { parseSettings } from "./settings";

describe("parseSettings", () => {
  it("liefert Standardwerte bei fehlenden oder kaputten Daten", () => {
    expect(parseSettings(null).palette).toBe("standard");
    expect(parseSettings("kaputt").pulse).toBe("#e8f1ff");
  });
  it("übernimmt gültige Werte und ersetzt ungültige einzeln", () => {
    const s = parseSettings('{"version":1,"palette":"colorblind","pulse":"#b794ff"}');
    expect(s).toEqual({
      version: 1,
      palette: "colorblind",
      pulse: "#b794ff",
      instrument: "synth",
      volume: 0.7,
      muted: false,
      drone: true,
    });
    const t = parseSettings('{"version":1,"palette":"gibtsnicht","pulse":"#000000"}');
    expect(t.palette).toBe("standard");
    expect(t.pulse).toBe("#e8f1ff");
  });
});

describe("parseSettings (Klang)", () => {
  it("übernimmt gültige Klangwerte", () => {
    const s = parseSettings('{"version":1,"instrument":"guitar","volume":0.3,"muted":true,"drone":false}');
    expect([s.instrument, s.volume, s.muted, s.drone]).toEqual(["guitar", 0.3, true, false]);
  });
  it("ersetzt ungültige Klangwerte einzeln", () => {
    const s = parseSettings('{"version":1,"instrument":"banjo","volume":7,"muted":"ja","drone":1}');
    expect([s.instrument, s.volume, s.muted, s.drone]).toEqual(["synth", 0.7, false, true]);
  });
});

describe("Theme", () => {
  it("lehnt zu dunkle Pulsfarben ab", () => {
    expect(isReadable("#101010")).toBe(false);
    expect(isReadable("#e8f1ff")).toBe(true);
    expect(isReadable("rot")).toBe(false);
  });
  it("alle Paletten- und Swatch-Farben sind auf dem Hintergrund lesbar", () => {
    for (const p of ["standard", "colorblind"] as const) {
      const t = buildTheme(p, "#e8f1ff");
      for (const c of [t.white, t.red, t.blue]) {
        expect(contrastToBackground("#" + c.toString(16).padStart(6, "0"))).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
