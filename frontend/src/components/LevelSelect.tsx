"use client";

import Link from "next/link";
import { LEVELS, PAR } from "@/lib/levels";
import { isUnlocked, resetProgress, type Progress } from "@/lib/progress";
import { useProgress } from "@/lib/useProgress";

type Status = "loading" | "locked" | "open" | "done" | "perfect";

function statusOf(progress: Progress | null, id: number): Status {
  if (!progress) return "loading";
  const best = progress.best[id];
  if (best !== undefined) return best <= PAR[id] ? "perfect" : "done";
  return isUnlocked(LEVELS, progress, id) ? "open" : "locked";
}

export default function LevelSelect() {
  const progress = useProgress();
  const solved = progress ? LEVELS.filter((l) => progress.best[l.id] !== undefined).length : 0;
  const resume = progress
    ? (LEVELS.find((l) => progress.best[l.id] === undefined) ?? LEVELS[LEVELS.length - 1]).id
    : LEVELS[0].id;

  return (
    <main className="screen">
      <header className="hero">
        <h1>Pulse</h1>
        <p>Leite den Impuls durch das Netz und aktiviere jeden Knoten.</p>
      </header>

      <div className="progress" aria-live="polite">
        <span>{progress ? `${solved} von ${LEVELS.length} gelöst` : "\u00a0"}</span>
        <div className="bar" aria-hidden>
          <div className="fill" style={{ width: `${(solved / LEVELS.length) * 100}%` }} />
        </div>
      </div>

      <Link className="btn primary" href={`/play/${resume}`} aria-disabled={!progress}>
        {solved === 0 ? "Spiel starten" : solved === LEVELS.length ? "Noch einmal spielen" : "Weiterspielen"}
      </Link>

      <ul className="grid">
        {LEVELS.map((l) => {
          const s = statusOf(progress, l.id);
          const best = progress?.best[l.id];
          const inner = (
            <>
              <span className="num">{s === "locked" ? "🔒" : l.id}</span>
              <span className="meta">
                {s === "perfect" && "★ perfekt"}
                {s === "done" && `${best} Züge`}
                {s === "open" && "offen"}
                {s === "locked" && "gesperrt"}
              </span>
            </>
          );
          return (
            <li key={l.id}>
              {s === "locked" || s === "loading" ? (
                <div className={`tile ${s}`} aria-disabled="true" aria-label={`Level ${l.id}, ${s === "locked" ? "gesperrt" : "lädt"}`}>
                  {inner}
                </div>
              ) : (
                <Link className={`tile ${s}`} href={`/play/${l.id}`} aria-label={`Level ${l.id}: ${l.name}`}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <Link className="btn" href="/editor">
        Eigene Level bauen
      </Link>

      <Link className="link" href="/settings">
        Einstellungen
      </Link>

      <p className="teaser">Weitere Level mit Timer- und Spiegelknoten folgen in der Vollversion.</p>

      {progress && solved > 0 && (
        <button
          className="link"
          onClick={() => {
            if (window.confirm("Fortschritt wirklich zurücksetzen?")) resetProgress();
          }}
        >
          Fortschritt zurücksetzen
        </button>
      )}
    </main>
  );
}
