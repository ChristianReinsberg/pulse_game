"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { analyzeLevel, difficultyOf, type Difficulty } from "@/game/analysis";
import { MAX_NAME, decodeLevel, encodeLevel } from "@/game/codec";
import {
  MAX_LIMIT, MAX_NODES, addNode, cycleEdge, emptyLevel, moveNode, pairMirrors, removeEdge, removeNode,
  renameLevel, setColor, setLimit, setNodeType, setStart, type PlainType,
} from "@/game/editor";
import { GEN_MAX_NODES, GEN_MIN_NODES, generateLevel } from "@/game/generator";
import type { LevelDef, PulseColor } from "@/game/pulse-core";
import { solve, validateLevel } from "@/game/pulse-solver";
import { DEFAULT_THEME, buildTheme } from "@/game/theme";
import { deleteUserLevel, getUserLevels, saveUserLevel, setDraft } from "@/lib/userLevels";
import { useSettings } from "@/lib/useSettings";
import { useUserLevels } from "@/lib/useUserLevels";
import EditorBoard, { type Tool } from "./EditorBoard";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "add", label: "Knoten", hint: "Tippe auf ein freies Feld, um einen Knoten zu setzen. Tippe einen Knoten an, um ihn zu bearbeiten." },
  { id: "edge", label: "Kante", hint: "Tippe zwei Knoten nacheinander an. Jeder weitere Tipp auf dasselbe Paar wechselt: beidseitig, nur in die eine Richtung, nur in die andere, keine." },
  { id: "move", label: "Bewegen", hint: "Ziehe einen Knoten an eine neue Stelle. Tippe einen Knoten an, um ihn zu bearbeiten." },
  { id: "delete", label: "Löschen", hint: "Tippe einen Knoten oder eine Kante an, um sie zu löschen." },
];

const KINDS: { id: PlainType | "mirror"; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "once", label: "Einmal" },
  { id: "color", label: "Farbknoten" },
  { id: "gate", label: "Tor" },
  { id: "timer", label: "Zeit" },
  { id: "mirror", label: "Spiegel" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "schwer", label: "Schwer" },
  { id: "knifflig", label: "Knifflig" },
];

interface GenSettings {
  nodes: number;
  oneWay: boolean;
  once: boolean;
  colors: boolean;
  timers: boolean;
  mirror: boolean;
  difficulty: Difficulty;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function LevelEditor() {
  const settings = useSettings();
  const theme = useMemo(() => (settings ? buildTheme(settings.palette, settings.pulse) : DEFAULT_THEME), [settings]);
  const saved = useUserLevels();

  const [level, setLevel] = useState<LevelDef>(emptyLevel);
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState("");
  const [tool, setTool] = useState<Tool>("add");
  const [selected, setSelected] = useState<string | null>(null);
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null);
  const [pairFrom, setPairFrom] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [gen, setGen] = useState<GenSettings>({ nodes: 7, oneWay: true, once: false, colors: false, timers: false, mirror: false, difficulty: "mittel" });
  const history = useRef<LevelDef[]>([]);

  // Start: Code aus dem Link, sonst der zuletzt gesicherte Entwurf
  useEffect(() => {
    setOrigin(window.location.origin);
    let start: LevelDef | null = null;
    const hash = window.location.hash.slice(1);
    if (hash) {
      const d = decodeLevel(hash, false);
      if ("level" in d) start = d.level;
      else setNotice(d.error);
    }
    if (!start) {
      const draft = getUserLevels().draft;
      if (draft) {
        const d = decodeLevel(draft, false);
        if ("level" in d) start = d.level;
      }
    }
    if (start) setLevel(start);
    setLoaded(true);
  }, []);

  // Entwurf automatisch sichern
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setDraft(encodeLevel(level)), 400);
    return () => clearTimeout(t);
  }, [level, loaded]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------- Änderungen mit Rückgängig ----------

  const commit = (next: LevelDef) => {
    if (next === level) return;
    history.current.push(level);
    if (history.current.length > 50) history.current.shift();
    setLevel(next);
    setCanUndo(true);
    setShowSolution(false);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setLevel(prev);
    setCanUndo(history.current.length > 0);
    setSelected((s) => (s && prev.nodes.some((n) => n.id === s) ? s : null));
    setEdgeFrom(null);
    setPairFrom(null);
    setShowSolution(false);
  };

  const replaceAll = (next: LevelDef, key: string | null = null) => {
    history.current = [];
    setCanUndo(false);
    setLevel(next);
    setSelected(null);
    setEdgeFrom(null);
    setPairFrom(null);
    setShowSolution(false);
    setSavedKey(key);
  };

  const chooseTool = (t: Tool) => {
    setTool(t);
    setEdgeFrom(null);
    setPairFrom(null);
  };

  // ---------- Eingaben auf dem Spielfeld ----------

  const onNode = (id: string) => {
    if (pairFrom) {
      if (id !== pairFrom) {
        const next = pairMirrors(level, pairFrom, id);
        if (next === level) setNotice("Diese beiden Knoten lassen sich nicht zu einem Spiegelpaar machen (der Startknoten ist ausgenommen).");
        commit(next);
        setSelected(id);
      }
      setPairFrom(null);
      return;
    }
    switch (tool) {
      case "add":
      case "move":
        setSelected(id);
        break;
      case "edge":
        if (edgeFrom && edgeFrom !== id) {
          const next = cycleEdge(level, edgeFrom, id);
          if (next === level) setNotice("Spiegel-Zwillinge lassen sich nicht verbinden.");
          commit(next);
        }
        setEdgeFrom(id);
        break;
      case "delete":
        commit(removeNode(level, id));
        setSelected(null);
        break;
    }
  };

  const onEmpty = (x: number, y: number) => {
    if (pairFrom) {
      setPairFrom(null);
      return;
    }
    if (tool === "add") {
      const next = addNode(level, x, y);
      if (next === level) {
        if (level.nodes.length >= MAX_NODES) setNotice(`Mehr als ${MAX_NODES} Knoten sind nicht möglich.`);
        return;
      }
      commit(next);
      setSelected(next.nodes[next.nodes.length - 1].id);
    } else if (tool === "edge") setEdgeFrom(null);
    else setSelected(null);
  };

  const onEdge = (index: number) => {
    if (tool === "delete") commit(removeEdge(level, index));
  };

  const onMove = (id: string, x: number, y: number) => {
    commit(moveNode(level, id, x, y));
    setSelected(id);
  };

  // ---------- Prüfung ----------

  const deferred = useDeferredValue(level);
  const issues = useMemo(() => validateLevel(deferred), [deferred]);
  const stats = useMemo(() => (issues.length ? null : analyzeLevel(deferred)), [deferred, issues]);
  const solution = useMemo(
    () => (showSolution && stats?.solvable ? solve(deferred).solution : null),
    [showSolution, stats, deferred]
  );
  const settled = deferred === level;
  const canShare = settled && issues.length === 0 && !!stats?.solvable && !stats.truncated && level.nodes.length >= 3;
  const code = useMemo(() => encodeLevel(level), [level]);
  const shareUrl = origin ? `${origin}/play/custom#${code}` : "";
  const difficulty = stats ? difficultyOf(stats) : null;
  const selectedNode = level.nodes.find((n) => n.id === selected) ?? null;

  // ---------- Aktionen ----------

  const share = async () => {
    if (!canShare) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: level.name, text: `Probier mein Pulse-Level „${level.name}“`, url: shareUrl });
      } catch {
        /* abgebrochen */
      }
      return;
    }
    setNotice((await copyText(shareUrl)) ? "Link kopiert." : "Kopieren war nicht möglich. Markiere den Link unten und kopiere ihn von Hand.");
  };

  const save = () => {
    const key = saveUserLevel({ name: level.name, code, par: stats?.moves ?? null }, savedKey ?? undefined);
    if (key) {
      setSavedKey(key);
      setNotice("Gespeichert.");
    } else setNotice("Du kannst höchstens 50 Level speichern. Lösche zuerst eines.");
  };

  const importCode = () => {
    const d = decodeLevel(importText, false);
    if ("error" in d) {
      setNotice(d.error);
      return;
    }
    replaceAll(d.level);
    setImportText("");
    setNotice("Level geladen.");
  };

  const newLevel = () => {
    if (level.nodes.length > 1 && !window.confirm("Das aktuelle Level verwerfen? Nicht gespeicherte Änderungen gehen verloren.")) return;
    replaceAll(emptyLevel());
  };

  const generate = () => {
    setBusy(true);
    setNotice(null);
    // kurz warten, damit die Anzeige "Suche läuft" erscheint, bevor die Suche den Browser beschäftigt
    setTimeout(() => {
      const res = generateLevel({ ...gen, seed: Math.floor(Math.random() * 1e9), budgetMs: 2000 });
      setBusy(false);
      if (!res) {
        setNotice("Dazu habe ich in 2 Sekunden nichts Passendes gefunden. Wähle weniger Mechaniken, mehr Knoten oder eine andere Stufe.");
        return;
      }
      commit({ ...res.level, name: level.name });
      setSelected(null);
      setEdgeFrom(null);
      setPairFrom(null);
      setNotice(`Zufallslevel erzeugt: ${res.stats.moves} Züge.`);
    }, 30);
  };

  const chooseKind = (kind: PlainType | "mirror") => {
    if (!selectedNode) return;
    if (kind === "mirror") {
      setPairFrom(selectedNode.id);
      setNotice(`Tippe jetzt den Zwilling von Knoten ${selectedNode.id} an.`);
      return;
    }
    commit(setNodeType(level, selectedNode.id, kind));
  };

  if (!loaded) return <main className="screen center">Lade …</main>;

  const isStart = selectedNode?.id === level.start;
  const hint = pairFrom ? `Tippe den Zwilling von Knoten ${pairFrom} an (oder ins Leere zum Abbrechen).` : TOOLS.find((t) => t.id === tool)!.hint;

  return (
    <main className="editor">
      <header className="row">
        <Link className="back" href="/" aria-label="Zur Übersicht">
          ←
        </Link>
        <h1 className="h1-small">Level-Editor</h1>
      </header>

      <input
        className="field"
        aria-label="Name des Levels"
        value={level.name}
        maxLength={MAX_NAME}
        onChange={(e) => setLevel(renameLevel(level, e.target.value))}
      />

      <EditorBoard
        level={level}
        theme={theme}
        tool={tool}
        selected={selected}
        edgeFrom={edgeFrom}
        pairFrom={pairFrom}
        onNode={onNode}
        onEmpty={onEmpty}
        onEdge={onEdge}
        onMove={onMove}
      />

      <div className="toolbar" role="toolbar" aria-label="Werkzeuge">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool ${tool === t.id ? "on" : ""}`} aria-pressed={tool === t.id} onClick={() => chooseTool(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="tool" onClick={undo} disabled={!canUndo}>
          Rückgängig
        </button>
      </div>
      <p className="note" role="status">
        {hint}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {selectedNode && (
        <section className="group" aria-label={`Knoten ${selectedNode.id} bearbeiten`}>
          <h2 className="legend">Knoten {selectedNode.id}{isStart ? " (Start)" : ""}</h2>
          <div className="kinds">
            {KINDS.map((k) => {
              const current = (selectedNode.type ?? "normal") === k.id;
              const blocked = isStart && (k.id === "gate" || k.id === "timer" || k.id === "mirror");
              return (
                <button
                  key={k.id}
                  className={`tool ${current ? "on" : ""}`}
                  aria-pressed={current}
                  disabled={blocked}
                  title={blocked ? "Der Startknoten kann das nicht sein" : undefined}
                  onClick={() => chooseKind(k.id)}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          {(selectedNode.type === "color" || selectedNode.type === "gate") && (
            <div className="kinds" role="group" aria-label="Farbe">
              {(["red", "blue"] as PulseColor[]).map((c) => (
                <button
                  key={c}
                  className={`tool ${selectedNode.color === c ? "on" : ""}`}
                  aria-pressed={selectedNode.color === c}
                  onClick={() => commit(setColor(level, selectedNode.id, c))}
                >
                  {c === "red" ? "▲ Dreieck-Farbe" : "◆ Raute-Farbe"}
                </button>
              ))}
            </div>
          )}

          {selectedNode.type === "timer" && (
            <div className="stepper">
              <span>Zerfällt nach</span>
              <button className="tool" aria-label="Limit verringern" onClick={() => commit(setLimit(level, selectedNode.id, (selectedNode.limit ?? 1) - 1))}>
                −
              </button>
              <output>{selectedNode.limit} Zügen</output>
              <button className="tool" aria-label="Limit erhöhen" disabled={(selectedNode.limit ?? 1) >= MAX_LIMIT} onClick={() => commit(setLimit(level, selectedNode.id, (selectedNode.limit ?? 1) + 1))}>
                +
              </button>
            </div>
          )}

          {selectedNode.type === "mirror" && <p className="note">Zwilling: Knoten {selectedNode.pair}. Zum Ändern „Spiegel“ erneut wählen.</p>}

          <div className="kinds">
            <button className="tool" disabled={isStart || selectedNode.type === "mirror" || selectedNode.type === "gate" || selectedNode.type === "timer"} onClick={() => commit(setStart(level, selectedNode.id))}>
              Als Start setzen
            </button>
            <button
              className="tool danger"
              onClick={() => {
                commit(removeNode(level, selectedNode.id));
                setSelected(null);
              }}
              disabled={level.nodes.length <= 1}
            >
              Knoten löschen
            </button>
          </div>
        </section>
      )}

      <details className="group" open>
        <summary>Prüfung</summary>
        {issues.length > 0 ? (
          <ul className="issues">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : !stats ? null : stats.truncated ? (
          <p className="warn">Das Level ist zu komplex zum Prüfen. Mit weniger Knoten oder Zeitknoten geht es.</p>
        ) : !stats.solvable ? (
          <p className="warn">Dieses Level ist nicht lösbar. Prüfe Einbahnkanten, Tore, Einmal-Knoten und Zeitlimits.</p>
        ) : (
          <>
            <dl className="stats">
              <div><dt>Kürzeste Lösung</dt><dd>{stats.moves} Züge</dd></div>
              <div><dt>Lösungswege</dt><dd>{stats.shortestSolutions}</dd></div>
              <div><dt>Sackgassen</dt><dd>{stats.trapPct} %</dd></div>
              <div><dt>Schwierigkeit</dt><dd>{difficulty} (Schätzung)</dd></div>
            </dl>
            <button className="link" onClick={() => setShowSolution((s) => !s)}>
              {showSolution ? "Lösungsweg verbergen" : "Lösungsweg anzeigen"}
            </button>
            {solution && <p className="note">{solution.join(" → ")}</p>}
          </>
        )}
        <p className="note">{level.nodes.length} von {MAX_NODES} Knoten</p>
      </details>

      <details className="group">
        <summary>Zufallslevel</summary>
        <label className="slider">
          <span>Knoten</span>
          <input type="range" min={GEN_MIN_NODES} max={GEN_MAX_NODES} value={gen.nodes} onChange={(e) => setGen({ ...gen, nodes: Number(e.target.value) })} />
          <output>{gen.nodes}</output>
        </label>
        <div className="kinds" role="group" aria-label="Schwierigkeit">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`tool ${gen.difficulty === d.id ? "on" : ""}`} aria-pressed={gen.difficulty === d.id} onClick={() => setGen({ ...gen, difficulty: d.id })}>
              {d.label}
            </button>
          ))}
        </div>
        {(
          [
            ["oneWay", "Einbahnkanten"],
            ["once", "Einmal-Knoten"],
            ["colors", "Farben und Tore"],
            ["timers", "Zeitknoten"],
            ["mirror", "Spiegelpaar"],
          ] as [keyof GenSettings, string][]
        ).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={gen[k] as boolean} onChange={(e) => setGen({ ...gen, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
        <button className="btn primary" onClick={generate} disabled={busy}>
          {busy ? "Suche läuft …" : "Zufallslevel erzeugen"}
        </button>
        <p className="note">Ersetzt das aktuelle Level, mit „Rückgängig“ holst du es zurück. Bearbeiten kannst du das Ergebnis danach wie jedes andere.</p>
      </details>

      <details className="group" open>
        <summary>Testen, speichern und teilen</summary>
        <div className="actions">
          {canShare ? (
            <a className="btn primary" href={`/play/custom#${code}`}>
              Testen
            </a>
          ) : (
            <span className="btn disabled" aria-disabled="true">Testen</span>
          )}
          <button className="btn" onClick={share} disabled={!canShare}>
            Link teilen
          </button>
          <button className="btn" onClick={save}>
            Speichern
          </button>
          <button className="btn" onClick={newLevel}>
            Neues Level
          </button>
        </div>
        {!canShare && <p className="note">Zum Testen und Teilen muss das Level fehlerfrei und lösbar sein und mindestens 3 Knoten haben.</p>}
        {canShare && <input className="field mono" readOnly value={shareUrl} aria-label="Link zum Level" onFocus={(e) => e.currentTarget.select()} />}

        <label className="field-label" htmlFor="import">Level-Code oder Link einfügen</label>
        <div className="row-gap">
          <input id="import" className="field mono" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="P1.…" />
          <button className="btn" onClick={importCode} disabled={!importText.trim()}>
            Laden
          </button>
        </div>

        <details>
          <summary>Für Entwickler</summary>
          <button
            className="btn"
            onClick={async () => setNotice((await copyText(JSON.stringify(level, null, 2))) ? "JSON kopiert." : "Kopieren war nicht möglich.")}
          >
            Level als JSON kopieren
          </button>
          <p className="note">Zum Aufnehmen in die Kampagne: als <code>src/levels/level-NN.json</code> ablegen, id setzen und in <code>levels.ts</code> eintragen.</p>
        </details>
      </details>

      {saved && saved.levels.length > 0 && (
        <details className="group" open>
          <summary>Meine Level ({saved.levels.length})</summary>
          <ul className="mylevels">
            {saved.levels.map((l) => (
              <li key={l.key}>
                <span className="mylevel-name">
                  {l.name}
                  {l.par !== null && <small> · {l.par} Züge</small>}
                </span>
                <span className="mylevel-actions">
                  <button
                    className="tool"
                    onClick={() => {
                      const d = decodeLevel(l.code, false);
                      if ("level" in d) replaceAll(d.level, l.key);
                      else setNotice(d.error);
                    }}
                  >
                    Bearbeiten
                  </button>
                  <a className="tool" href={`/play/custom#${l.code}`}>
                    Spielen
                  </a>
                  <button
                    className="tool danger"
                    onClick={() => {
                      if (window.confirm(`„${l.name}“ löschen?`)) {
                        deleteUserLevel(l.key);
                        if (savedKey === l.key) setSavedKey(null);
                      }
                    }}
                  >
                    Löschen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
