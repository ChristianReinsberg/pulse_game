"use client";

import Link from "next/link";
import { LEVELS, PAR, getLevel, nextLevelId } from "@/lib/levels";
import { isUnlocked, recordWin } from "@/lib/progress";
import { useProgress } from "@/lib/useProgress";
import Playfield from "./Playfield";

export default function GameScreen({ levelId }: { levelId: number }) {
  const progress = useProgress();
  const level = getLevel(levelId);

  if (!progress || !level) return <main className="screen center">Lade …</main>;

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

  const next = nextLevelId(levelId);
  return (
    <Playfield
      key={levelId}
      level={level}
      par={PAR[levelId]}
      heading={`Level ${level.id}`}
      back={{ href: "/", label: "Zur Übersicht" }}
      onWin={(moves) => recordWin(level.id, moves)}
      primary={next ? { href: `/play/${next}`, label: "Nächstes Level" } : { href: "/", label: "Zur Übersicht" }}
    />
  );
}
