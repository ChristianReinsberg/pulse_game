"use client";

import Link from "next/link";
import { LEVELS, PAR, getLevel, nextLevelId } from "@/lib/levels";
import { isUnlocked, recordWin } from "@/lib/progress";
import { useProgress } from "@/lib/useProgress";
import Playfield from "./Playfield";
import { useTranslation } from 'react-i18next'

export default function GameScreen({ levelId }: { levelId: number }) {
  const { t } = useTranslation()
  const progress = useProgress();
  const level = getLevel(levelId);

  if (!progress || !level) return <main className="screen center">{t('lade')}</main>;

  if (!isUnlocked(LEVELS, progress, levelId)) {
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    const prev = LEVELS[Math.max(0, idx - 1)].id;
    return (
      <main className="screen center">
        <h1>{t('levelLevelIdIstNochGesperrt', { levelId })}</h1>
        <p>{t('lseZuerstLevelPrev', { prev })}</p>
        <Link className="btn primary" href={`/play/${prev}`}>
          {t('zuLevelPrev', { prev })}
        </Link>
        <Link className="btn" href="/">
          {t('bersicht')}
        </Link>
      </main>
    );
  }

  const next = nextLevelId(levelId);
  return (
    <Playfield
      key={levelId}
      level={level}
      par={PAR[levelId]}
      heading={t('levelId', { id: level.id })}
      back={{ href: "/", label: t('zurBersicht') }}
      onWin={(moves) => recordWin(level.id, moves)}
      primary={next ? { href: `/play/${next}`, label: t('nchstesLevel') } : { href: "/", label: t('zurBersicht') }}
    />
  );
}
