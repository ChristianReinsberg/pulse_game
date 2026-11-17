"use client";

import { useEffect, useRef, useState } from "react";
import { PulseAudio } from "@/game/pulse-audio";
import type { PulseGame } from "@/game/pulse-renderer";
import type { LevelDef } from "@/game/pulse-core";
import { BACKGROUND, buildTheme } from "@/game/theme";
import { getSettings, pickAudio } from "@/lib/settings";
import { useSettings } from "@/lib/useSettings";
import { ActionLink, type Action } from "./ActionLink";
import { useTranslation } from 'react-i18next'
import '@/i18n';

export interface WinInfo {
  best: number;
  firstClear: boolean;
  improved: boolean;
}

interface Props {
  level: LevelDef;
  par: number;
  heading: string;
  back: Action;
  onWin: (moves: number) => WinInfo | null;
  primary: Action;
  secondary?: Action;
}

interface Result {
  moves: number;
  info: WinInfo | null;
}

const STUCK_TEXT = 'stuckText';
const UNSOLVABLE_TEXT = 'unsolvableText';

export default function Playfield({ level, par, heading, back, onWin, primary, secondary }: Props) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PulseGame | null>(null);
  const audioRef = useRef<PulseAudio | null>(null);
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;
  const settings = useSettings();
  const [moves, setMoves] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let app: import("pixi.js").Application | null = null;
    let game: PulseGame | null = null;
    let audio: PulseAudio | null = null;

    (async () => {
      try {
        const [{ Application }, { PulseGame }] = await Promise.all([
          import("pixi.js"),
          import("@/game/pulse-renderer"),
        ]);
        const a = new Application();
        await a.init({
          resizeTo: host,
          background: BACKGROUND,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio,
        });
        if (disposed) {
          a.destroy(true, { children: true });
          return;
        }
        app = a;
        host.appendChild(a.canvas);

        const s = getSettings();
        audio = new PulseAudio(level, pickAudio(s));
        audioRef.current = audio;
        game = new PulseGame(a, level, {
          theme: buildTheme(s.palette, s.pulse),
          audio,
          onMove: (m) => {
            setMoves(m);
            setNotice(null);
            setResult(null);
          },
          onWin: (m) => {
            setResult({ moves: m, info: onWinRef.current(m) });
            audio?.win();
          },
          onStuck: () => setNotice(t(STUCK_TEXT)),
        });
        gameRef.current = game;
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      gameRef.current = null;
      audioRef.current = null;
      game?.destroy();
      audio?.destroy();
      app?.destroy(true, { children: true });
    };
  }, [level]);

  useEffect(() => {
    if (!settings) return;
    gameRef.current?.setTheme(buildTheme(settings.palette, settings.pulse));
    audioRef.current?.update(pickAudio(settings));
  }, [settings]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const showHint = () => {
    if (gameRef.current?.hint() === "unsolvable") setNotice(t(UNSOLVABLE_TEXT));
  };

  return (
    <main className="play">
      <header className="bar-top">
        <ActionLink className="back" action={back} ariaLabel={back.label}>
          ←
        </ActionLink>
        <div className="title">
          <strong>{heading}</strong>
          <span>{level.name}</span>
        </div>
        <div className="count" aria-live="polite">
          {moves} <small>/ Par {par}</small>
        </div>
      </header>

      {level.tip && <p className="tip">{level.tip}</p>}

      <div className="stage" ref={hostRef}>
        {failed && (
          <div className="overlay">
            <p>{t('dieGrafikKonnteNichtGestartetWerdenBitte')}</p>
          </div>
        )}
        {notice && !result && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        {result && (
          <div className="overlay" role="dialog" aria-label={t('levelGelst')}>
            <div className="card">
              <h2>{t('gelst')}</h2>
              <p>
                {t('movesZge', { moves: result.moves })}
                {result.moves <= par ? t('perfekt') : t('parPar', { par })}
              </p>
              {result.info && !result.info.firstClear && (
                <p className="sub">{result.info.improved ? t('neuerBestwert') : t('bestwertBest', { best: result.info.best })}</p>
              )}
              <ActionLink className="btn primary" action={primary}>
                {primary.label}
              </ActionLink>
              <button className="btn" onClick={() => gameRef.current?.reset()}>
                {t('nochEinmal')}
              </button>
              {secondary && (
                <ActionLink className="btn" action={secondary}>
                  {secondary.label}
                </ActionLink>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="bar-bottom">
        <button className="btn" onClick={() => gameRef.current?.undo()} disabled={moves === 0}>
          {t('zurck')}
        </button>
        <button className="btn" onClick={showHint} disabled={!!result}>
          {t('hinweis')}
        </button>
        <button className="btn" onClick={() => gameRef.current?.reset()} disabled={moves === 0}>
          {t('neustart')}
        </button>
      </footer>
    </main>
  );
}
