import type { LevelDef } from "@/game/pulse-core";
import { solve } from "@/game/pulse-solver";
import l01 from "@/levels/level-01.json";
import l02 from "@/levels/level-02.json";
import l03 from "@/levels/level-03.json";
import l04 from "@/levels/level-04.json";
import l05 from "@/levels/level-05.json";
import l06 from "@/levels/level-06.json";
import l07 from "@/levels/level-07.json";
import l08 from "@/levels/level-08.json";
import l09 from "@/levels/level-09.json";
import l10 from "@/levels/level-10.json";
import l11 from "@/levels/level-11.json";
import l12 from "@/levels/level-12.json";
import l13 from "@/levels/level-13.json";
import l14 from "@/levels/level-14.json";
import l15 from "@/levels/level-15.json";
import l16 from "@/levels/level-16.json";
import l17 from "@/levels/level-17.json";
import l18 from "@/levels/level-18.json";
import l19 from "@/levels/level-19.json";

export const LEVELS = [l01, l02, l03, l04, l05, l06, l07, l08, l09, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19] as unknown as LevelDef[];

export const PAR: Record<number, number> = Object.fromEntries(
  LEVELS.map((l) => [l.id, Math.max(0, (solve(l).solution?.length ?? 1) - 1)])
);

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevelId(id: number): number | null {
  const idx = LEVELS.findIndex((l) => l.id === id);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1].id : null;
}
