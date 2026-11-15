"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PulseAudio } from "@/game/pulse-audio";
import type { PulseGame } from "@/game/pulse-renderer";
import { BACKGROUND, buildTheme } from "@/game/theme";
import { LEVELS, PAR, getLevel, nextLevelId } from "@/lib/levels";
import { isUnlocked, recordWin } from "@/lib/progress";
import { getSettings, pickAudio } from "@/lib/settings";
import { useProgress } from "@/lib/useProgress";
import { useSettings } from "@/lib/useSettings";

export default function GameScreen({ levelId }: { levelId: number }) {
  const progress = useProgress();

  if (!progress) return <main className="screen center">Lade …</main>;

  if (!isUnlocked(LEVELS, progress, levelId)) {
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    const prev = LEVELS[Math.max(0, idx - 1)].id;
    return (
      <main className="screen center">
        <h1>Level {levelId} ist noch gesperrt</h1>
        <p>Löse zuerst Level {prev}.</p>
        <Link className="btn primary" href={`/play/${prev}`}>
          Zu Level {prev}
        </Link>
        <Link className="btn" href="/">
          Übersicht
        </Link>
      </main>
    );
  }

  return <Playfield key={levelId} levelId={levelId} />;
}

interface Result {
  moves: number;
  best: number;
  firstClear: boolean;
  improved: boolean;
}

const STUCK_TEXT = "Sackgasse. Mach einen Zug rückgängig oder starte neu.";
const UNSOLVABLE_TEXT = "Von hier aus ist das Level nicht mehr lösbar. Mach einen Zug rückgängig.";

function Playfield({ levelId }: { levelId: number }) {
  const level = getLevel(levelId)!;
  const par = PAR[levelId];
  const next = nextLevelId(levelId);

  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PulseGame | null>(null);
  const audioRef = useRef<PulseAudio | null>(null);
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
            setResult({ moves: m, ...recordWin(level.id, m) });
            audio?.win();
          },
          onStuck: () => setNotice(STUCK_TEXT),
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
    if (gameRef.current?.hint() === "unsolvable") setNotice(UNSOLVABLE_TEXT);
  };

  return (
    <main className="play">
      <header className="bar-top">
        <Link className="back" href="/" aria-label="Zur Übersicht">
          ←
        </Link>
        <div className="title">
          <strong>Level {level.id}</strong>
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
            <p>Die Grafik konnte nicht gestartet werden. Bitte WebGL im Browser aktivieren.</p>
          </div>
        )}
        {notice && !result && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        {result && (
          <div className="overlay" role="dialog" aria-label="Level gelöst">
            <div className="card">
              <h2>Gelöst!</h2>
              <p>
                {result.moves} Züge
                {result.moves <= par ? " · ★ perfekt" : ` · Par ${par}`}
              </p>
              {!result.firstClear && (
                <p className="sub">{result.improved ? "Neuer Bestwert!" : `Bestwert: ${result.best}`}</p>
              )}
              {next ? (
                <Link className="btn primary" href={`/play/${next}`}>
                  Nächstes Level
                </Link>
              ) : (
                <Link className="btn primary" href="/">
                  Zur Übersicht
                </Link>
              )}
              <button className="btn" onClick={() => gameRef.current?.reset()}>
                Noch einmal
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="bar-bottom">
        <button className="btn" onClick={() => gameRef.current?.undo()} disabled={moves === 0}>
          Zurück
        </button>
        <button className="btn" onClick={showHint} disabled={!!result}>
          Hinweis
        </button>
        <button className="btn" onClick={() => gameRef.current?.reset()} disabled={moves === 0}>
          Neustart
        </button>
      </footer>
    </main>
  );
}
