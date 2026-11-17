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
import { useTranslation, Trans } from 'react-i18next'

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
  const { t } = useTranslation()
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

  if (!settings) return <main className="screen center">{t('lade')}</main>;

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
        <Link className="back" href="/" aria-label={t('zurBersicht')}>
          ←
        </Link>
        <h1 className="h1-small">{t('einstellungen')}</h1>
      </header>

      <fieldset className="group">
        <legend>{t('farbpalette')}</legend>
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
        <legend>{t('pulsfarbe', 'Pulsfarbe')}</legend>
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
              aria-label={t('eigenePulsfarbe')}
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
            <small>{t('eigene')}</small>
          </label>
        </div>
        {tooDark && (
          <p className="warn" role="status">
            {t('dieseFarbeIstAufDemDunklenHintergrundZu')}
          </p>
        )}
      </fieldset>

      <section className="group" aria-label={t('vorschau')}>
        <h2 className="legend">{t('vorschau')}</h2>
        <div className="preview">
          <div>
            <Glyph shape="circle" color={toHex(preview.white)} />
            <small>{t('impuls')}</small>
          </div>
          <div>
            <Glyph shape="triangle" color={toHex(preview.red)} />
            <small>{t('dreieckfarbe')}</small>
          </div>
          <div>
            <Glyph shape="diamond" color={toHex(preview.blue)} />
            <small>{t('rautefarbe')}</small>
          </div>
        </div>
        <p className="note">
          {t('imSpielErkennstDuFarbknotenUndToreAn')}
        </p>
      </section>

      <fieldset className="group">
        <legend>{t('klang')}</legend>
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
          <span>{t('lautstrke')}</span>
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
          <Trans i18nKey="tonAus"><input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} />
          Ton aus</Trans>
        </label>
        <label className="check">
          <Trans i18nKey="hintergrundklangImSpielOptional"><input type="checkbox" checked={settings.drone} onChange={(e) => updateSettings({ drone: e.target.checked })} />
          Hintergrundklang im Spiel (optional)</Trans>
        </label>

        <button className="btn" onClick={playPreview} disabled={settings.muted}>
          {t('probeHren')}
        </button>
        <p className="note">{t('dasSpielIstAuchOhneTonVollstndigSpielbar')}</p>
      </fieldset>

      <button
        className="link"
        onClick={() => {
          setTooDark(false);
          resetSettings();
        }}
        disabled={isDefault}
      >
        {t('aufStandardZurcksetzen')}
      </button>
    </main>
  );
}
