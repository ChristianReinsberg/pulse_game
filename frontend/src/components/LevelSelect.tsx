"use client";

import Link from "next/link";
import { LEVELS, PAR } from "@/lib/levels";
import { isUnlocked, resetProgress, type Progress } from "@/lib/progress";
import { useProgress } from "@/lib/useProgress";
import "@/i18n";
import { useTranslation } from 'react-i18next'
import LanguageSelector from "./LanguageSelector";

type Status = "loading" | "locked" | "open" | "done" | "perfect";

function statusOf(progress: Progress | null, id: number): Status {
  if (!progress) return "loading";
  const best = progress.best[id];
  if (best !== undefined) return best <= PAR[id] ? "perfect" : "done";
  return isUnlocked(LEVELS, progress, id) ? "open" : "locked";
}

export default function LevelSelect() {
  const { t } = useTranslation()
  const progress = useProgress();
  const solved = progress ? LEVELS.filter((l) => progress.best[l.id] !== undefined).length : 0;
  const resume = progress
    ? (LEVELS.find((l) => progress.best[l.id] === undefined) ?? LEVELS[LEVELS.length - 1]).id
    : LEVELS[0].id;
  

  return (
    <main className="screen">
      <header className="hero">
        <h1>{t('pulse')}</h1>
        <p>{t('leiteDenImpulsDurchDasNetzUndAktiviere')}</p>
        <LanguageSelector />
      </header>

      <div className="progress" aria-live="polite">
        <span>{progress ? t('solvedVonLengthGelst', { solved: solved, length: LEVELS.length }) : "\u00a0"}</span>
        <div className="bar" aria-hidden>
          <div className="fill" style={{ width: `${(solved / LEVELS.length) * 100}%` }} />
        </div>
      </div>

      <Link className="btn primary" href={`/play/${resume}`} aria-disabled={!progress}>
        {solved === 0 ? t('spielStarten') : solved === LEVELS.length ? t('nochEinmalSpielen') : t('weiterspielen')}
      </Link>

      <ul className="grid">
        {LEVELS.map((l) => {
          const s = statusOf(progress, l.id);
          const best = progress?.best[l.id];
          const inner = (
            <>
              <span className="num">{s === "locked" ? "🔒" : l.id}</span>
              <span className="meta">
                {s === "perfect" && t('perfekt2')}
                {s === "done" && t('bestZge', { best })}
                {s === "open" && t('offen')}
                {s === "locked" && t('gesperrt')}
              </span>
            </>
          );
          return (
            <li key={l.id}>
              {s === "locked" || s === "loading" ? (
                <div className={`tile ${s}`} aria-disabled="true" aria-label={t('levelIdVal', { id: l.id, val: s === "locked" ? "gesperrt" : "lädt" })}>
                  {inner}
                </div>
              ) : (
                <Link className={`tile ${s}`} href={`/play/${l.id}`} aria-label={t('levelIdName', { id: l.id, name: l.name })}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <Link className="btn" href="/editor">
        {t('eigeneLevelBauen')}
      </Link>

      <Link className="link" href="/settings">
        {t('einstellungen')}
      </Link>

      <p className="teaser">{t('weitereLevelMitTimerUndSpiegelknoten')}</p>

      {progress && solved > 0 && (
        <button
          className="link"
          onClick={() => {
            if (window.confirm(t('fortschrittWirklichZurcksetzen'))) resetProgress();
          }}
        >
          {t('fortschrittZurcksetzen')}
        </button>
      )}
    </main>
  );
}
