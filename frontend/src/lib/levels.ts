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
import l20 from "@/levels/level-20.json";
import l21 from "@/levels/level-21.json";
import l22 from "@/levels/level-22.json";
import l23 from "@/levels/level-23.json";
import l24 from "@/levels/level-24.json";
import l25 from "@/levels/level-25.json";
import l26 from "@/levels/level-26.json";
import l27 from "@/levels/level-27.json";
import l28 from "@/levels/level-28.json";
import l29 from "@/levels/level-29.json";
import l30 from "@/levels/level-30.json";
import l31 from "@/levels/level-31.json";
import l32 from "@/levels/level-32.json";
import l33 from "@/levels/level-33.json";
import l34 from "@/levels/level-34.json";
import l35 from "@/levels/level-35.json";
import l36 from "@/levels/level-36.json";
import l37 from "@/levels/level-37.json";
import l38 from "@/levels/level-38.json";
import l39 from "@/levels/level-39.json";
import l40 from "@/levels/level-40.json";

export const LEVELS = [l01, l02, l03, l04, l05, l06, l07, l08, l09, l10, l11, l12, l13, l14, l15, l16, l17, l18, l19, l20, l21, l22, l23, l24, l25, l26, l27, l28, l29, l30, l31, l32, l33, l34, l35, l36, l37, l38, l39, l40] as unknown as LevelDef[];

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
