"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decodeLevel } from "@/game/codec";
import { solve } from "@/game/pulse-solver";
import Playfield from "./Playfield";

/** Spielt ein Level aus dem Code im Link (#P1.…). Der Code wird streng geprüft, auch auf Lösbarkeit. */
export default function CustomGame() {
  const [code, setCode] = useState<string | null | undefined>(undefined); // undefined = noch nicht gelesen

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
    if (r.truncated) return { error: "Das Level ist zu komplex zum Prüfen." };
    if (!r.solvable || !r.solution) return { error: "Dieses Level ist nicht lösbar." };
    return { level: d.level, par: r.solution.length - 1 };
  }, [code]);

  if (code === undefined) return <main className="screen center">Lade …</main>;

  if (!parsed || "error" in parsed) {
    return (
      <main className="screen center">
        <h1>Level nicht gefunden</h1>
        <p>{parsed && "error" in parsed ? parsed.error : "Der Link enthält kein Level."}</p>
        <a className="btn primary" href="/editor">
          Eigenes Level bauen
        </a>
        <Link className="btn" href="/">
          Zur Übersicht
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
      back={{ href: `/editor#${code}`, label: "Zurück zum Editor", external: true }}
      onWin={() => null}
      primary={{ href: `/editor#${code}`, label: "Im Editor öffnen", external: true }}
      secondary={{ href: "/", label: "Zur Übersicht" }}
    />
  );
}
