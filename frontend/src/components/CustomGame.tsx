"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decodeLevel } from "@/game/codec";
import { solve } from "@/game/pulse-solver";
import Playfield from "./Playfield";
import { useTranslation } from 'react-i18next'

export default function CustomGame() {
  const { t } = useTranslation()
  const [code, setCode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const read = () => setCode(window.location.hash.slice(1) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const parsed = useMemo(() => {
    if (!code) return null;
    const d = decodeLevel(code, true);
    if ("error" in d) return { error: d.error };
    const r = solve(d.level);
    if (r.truncated) return { error: t('dasLevelIstZuKomplexZumPrfen') };
    if (!r.solvable || !r.solution) return { error: t('diesesLevelIstNichtLsbar') };
    return { level: d.level, par: r.solution.length - 1 };
  }, [code, t]);

  if (code === undefined) return <main className="screen center">{t('lade')}</main>;

  if (!parsed || "error" in parsed) {
    return (
      <main className="screen center">
        <h1>{t('levelNichtGefunden')}</h1>
        <p>{parsed && "error" in parsed ? parsed.error : t('derLinkEnthltKeinLevel')}</p>
        <a className="btn primary" href="/editor">
          {t('eigenesLevelBauen')}
        </a>
        <Link className="btn" href="/">
          {t('zurBersicht')}
        </Link>
      </main>
    );
  }

  return (
    <Playfield
      key={code}
      level={parsed.level}
      par={parsed.par}
      heading="Eigenes Level"
      back={{ href: `/editor#${code}`, label: t('zurckZumEditor'), external: true }}
      onWin={() => null}
      primary={{ href: `/editor#${code}`, label: t('imEditorFfnen'), external: true }}
      secondary={{ href: "/", label: t('zurBersicht') }}
    />
  );
}
