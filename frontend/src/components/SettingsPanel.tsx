"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_AUDIO, INSTRUMENTS, type InstrumentId } from "@/game/music";
import { PulseAudio } from "@/game/pulse-audio";
import {
  DEFAULT_PALETTE,
  DEFAULT_PULSE,
  PALETTES,
  PULSE_SWATCHES,
  buildTheme,
  isReadable,
  toHex,
  type PaletteId,
} from "@/game/theme";
import { pickAudio, resetSettings, updateSettings } from "@/lib/settings";
import { useSettings } from "@/lib/useSettings";

type Shape = "circle" | "triangle" | "diamond";

function Glyph({ shape, color }: { shape: Shape; color: string }) {
  return (
    <svg width="28" height="28" viewBox="-14 -14 28 28" aria-hidden>
      {shape === "circle" && <circle r="9" fill={color} />}
      {shape === "triangle" && <polygon points="0,-10 9.5,8 -9.5,8" fill={color} />}
      {shape === "diamond" && <polygon points="0,-10 10,0 0,10 -10,0" fill={color} />}
    </svg>
  );
}

export default function SettingsPanel() {
  const settings = useSettings();
  const [tooDark, setTooDark] = useState(false);
  const previewRef = useRef<PulseAudio | null>(null);

  useEffect(() => {
    if (settings) previewRef.current?.update(pickAudio(settings));
  }, [settings]);

  useEffect(
    () => () => {
      previewRef.current?.destroy();
      previewRef.current = null;
    },
    []
  );

  if (!settings) return <main className="screen center">Lade …</main>;

  const preview = buildTheme(settings.palette, settings.pulse);

  const playPreview = () => {
    previewRef.current ??= new PulseAudio(null, pickAudio(settings));
    previewRef.current.update(pickAudio(settings));
    previewRef.current.preview();
  };

  const isDefault =
    settings.palette === DEFAULT_PALETTE &&
    settings.pulse === DEFAULT_PULSE &&
    settings.instrument === DEFAULT_AUDIO.instrument &&
    settings.volume === DEFAULT_AUDIO.volume &&
    settings.muted === DEFAULT_AUDIO.muted &&
    settings.drone === DEFAULT_AUDIO.drone;

  return (
    <main className="screen">
      <header className="row">
        <Link className="back" href="/" aria-label="Zur Übersicht">
          ←
        </Link>
        <h1 className="h1-small">Einstellungen</h1>
      </header>

      <fieldset className="group">
        <legend>Farbpalette</legend>
        {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
          const t = buildTheme(id, settings.pulse);
          return (
            <label key={id} className={`choice ${settings.palette === id ? "on" : ""}`}>
              <input
                type="radio"
                name="palette"
                checked={settings.palette === id}
                onChange={() => updateSettings({ palette: id })}
              />
              <span className="choice-text">
                <strong>{PALETTES[id].label}</strong>
                <small>{PALETTES[id].description}</small>
              </span>
              <span className="glyphs">
                <Glyph shape="triangle" color={toHex(t.red)} />
                <Glyph shape="diamond" color={toHex(t.blue)} />
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="group">
        <legend>Pulsfarbe</legend>
        <div className="swatches">
          {PULSE_SWATCHES.map((s) => (
            <label key={s.hex} className={`swatch ${settings.pulse === s.hex ? "on" : ""}`} title={s.label}>
              <input
                type="radio"
                name="pulse"
                checked={settings.pulse === s.hex}
                onChange={() => {
                  setTooDark(false);
                  updateSettings({ pulse: s.hex });
                }}
              />
              <span style={{ background: s.hex }} />
              <small>{s.label}</small>
            </label>
          ))}
          <label className="swatch custom">
            <input
              type="color"
              value={settings.pulse}
              aria-label="Eigene Pulsfarbe"
              onChange={(e) => {
                const v = e.target.value;
                if (isReadable(v)) {
                  setTooDark(false);
                  updateSettings({ pulse: v.toLowerCase() });
                } else {
                  setTooDark(true);
                }
              }}
            />
            <small>Eigene</small>
          </label>
        </div>
        {tooDark && (
          <p className="warn" role="status">
            Diese Farbe ist auf dem dunklen Hintergrund zu schlecht zu sehen.
          </p>
        )}
      </fieldset>

      <section className="group" aria-label="Vorschau">
        <h2 className="legend">Vorschau</h2>
        <div className="preview">
          <div>
            <Glyph shape="circle" color={toHex(preview.white)} />
            <small>Impuls</small>
          </div>
          <div>
            <Glyph shape="triangle" color={toHex(preview.red)} />
            <small>Dreieck-Farbe</small>
          </div>
          <div>
            <Glyph shape="diamond" color={toHex(preview.blue)} />
            <small>Raute-Farbe</small>
          </div>
        </div>
        <p className="note">
          Im Spiel erkennst du Farbknoten und Tore an ihrer Form: Dreieck und Raute stehen für die beiden Farben,
          der Kreis für den neutralen Impuls. Die Farbe ist also nie der einzige Hinweis.
        </p>
      </section>

      <fieldset className="group">
        <legend>Klang</legend>
        {(Object.keys(INSTRUMENTS) as InstrumentId[]).map((id) => (
          <label key={id} className={`choice ${settings.instrument === id ? "on" : ""}`}>
            <input
              type="radio"
              name="instrument"
              checked={settings.instrument === id}
              onChange={() => updateSettings({ instrument: id })}
            />
            <span className="choice-text">
              <strong>{INSTRUMENTS[id].label}</strong>
              <small>{INSTRUMENTS[id].description}</small>
            </span>
          </label>
        ))}

        <label className="slider">
          <span>Lautstärke</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
          />
          <output>{Math.round(settings.volume * 100)} %</output>
        </label>

        <label className="check">
          <input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} />
          Ton aus
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.drone} onChange={(e) => updateSettings({ drone: e.target.checked })} />
          Hintergrundklang im Spiel (optional)
        </label>

        <button className="btn" onClick={playPreview} disabled={settings.muted}>
          Probe hören
        </button>
        <p className="note">Das Spiel ist auch ohne Ton vollständig spielbar.</p>
      </fieldset>

      <button
        className="link"
        onClick={() => {
          setTooDark(false);
          resetSettings();
        }}
        disabled={isDefault}
      >
        Auf Standard zurücksetzen
      </button>
    </main>
  );
}
