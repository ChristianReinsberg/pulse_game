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
import { useTranslation, Trans } from 'react-i18next';
import "@/i18n";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "add", label: 'knoten', hint: 'knotenHinweis' },
  { id: "edge", label: 'kante', hint: 'kanteHinweis' },
  { id: "move", label: 'bewegen', hint: 'bewegenHinweis' },
  { id: "delete", label: 'lschen', hint: 'lschenHinweis' },
];

const KINDS: { id: PlainType | "mirror"; label: string }[] = [
  { id: "normal", label: 'normal' },
  { id: "once", label: 'einmal' },
  { id: "color", label: 'farbknoten' },
  { id: "gate", label: 'tor' },
  { id: "timer", label: 'zeit' },
  { id: "mirror", label: 'spiegel' },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "leicht", label: 'leicht' },
  { id: "mittel", label: 'mittel' },
  { id: "schwer", label: 'schwer' },
  { id: "knifflig", label: 'knifflig' },
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
  const { t } = useTranslation();
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
  const [gen, setGen] = useState<GenSettings>({ nodes: 7, oneWay: true, once: false, colors: false, timers: false, mirror: false, difficulty: 'Mittel' });
  const history = useRef<LevelDef[]>([]);

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

  const onNode = (id: string) => {
    if (pairFrom) {
      if (id !== pairFrom) {
        const next = pairMirrors(level, pairFrom, id);
        if (next === level) setNotice(t('dieseBeidenKnotenLassenSichNichtZuEinem'));
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
          if (next === level) setNotice(t('spiegelzwillingeLassenSichNichtVerbinden'));
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
        if (level.nodes.length >= MAX_NODES) setNotice(t('mehrAlsMaxNodesKnotenSindNichtMglich', { MAX_NODES }));
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

  const share = async () => {
    if (!canShare) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: level.name, text: t('probierMeinPulselevelName', { name: level.name }), url: shareUrl });
      } catch {}
      return;
    }
    setNotice((await copyText(shareUrl)) ? t('linkKopiert') : t('kopierenWarNichtMglichMarkiereDenLink'));
  };

  const save = () => {
    const key = saveUserLevel({ name: level.name, code, par: stats?.moves ?? null }, savedKey ?? undefined);
    if (key) {
      setSavedKey(key);
      setNotice("Gespeichert.");
    } else setNotice(t('duKannstHchstens50LevelSpeichernLsche'));
  };

  const importCode = () => {
    const d = decodeLevel(importText, false);
    if ("error" in d) {
      setNotice(d.error);
      return;
    }
    replaceAll(d.level);
    setImportText("");
    setNotice(t('levelGeladen'));
  };

  const newLevel = () => {
    if (level.nodes.length > 1 && !window.confirm(t('dasAktuelleLevelVerwerfenNicht'))) return;
    replaceAll(emptyLevel());
  };

  const generate = () => {
    setBusy(true);
    setNotice(null);
    setTimeout(() => {
      const res = generateLevel({ ...gen, seed: Math.floor(Math.random() * 1e9), budgetMs: 2000 });
      setBusy(false);
      if (!res) {
        setNotice(t('dazuHabeIchIn2SekundenNichtsPassendes'));
        return;
      }
      commit({ ...res.level, name: level.name });
      setSelected(null);
      setEdgeFrom(null);
      setPairFrom(null);
      setNotice(t('zufallslevelErzeugtMovesZge', { moves: res.stats.moves }));
    }, 30);
  };

  const chooseKind = (kind: PlainType | "mirror") => {
    if (!selectedNode) return;
    if (kind === "mirror") {
      setPairFrom(selectedNode.id);
      setNotice(t('tippeJetztDenZwillingVonKnotenIdAn', { id: selectedNode.id }));
      return;
    }
    commit(setNodeType(level, selectedNode.id, kind));
  };

  if (!loaded) return <main className="screen center">{t('lade')}</main>;

  const isStart = selectedNode?.id === level.start;
  const hint = pairFrom ? t('tippeDenZwillingVonKnotenPairFromAnOder', { pairFrom }) : t(TOOLS.find((t) => t.id === tool)!.hint);

  return (
    <main className="editor">
      <header className="row">
        <Link className="back" href="/" aria-label={t('zurBersicht')}>
          ←
        </Link>
        <h1 className="h1-small">{t('leveleditor')}</h1>
      </header>

      <input
        className="field"
        aria-label={t('nameDesLevels')}
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

      <div className="toolbar" role="toolbar" aria-label={t('werkzeuge')}>
        {TOOLS.map((to) => (
          <button key={to.id} className={`tool ${tool === to.id ? "on" : ""}`} aria-pressed={tool === to.id} onClick={() => chooseTool(to.id)}>
            {t(to.label)}
          </button>
        ))}
        <button className="tool" onClick={undo} disabled={!canUndo}>
          {t('rckgngig')}
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
        <section className="group" aria-label={t('knotenIdBearbeiten', { id: selectedNode.id })}>
          <h2 className="legend">{t('knotenId', { id: selectedNode.id })}{isStart ? t('start') : ""}</h2>
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
                  title={blocked ? t('derStartknotenKannDasNichtSein') : undefined}
                  onClick={() => chooseKind(k.id)}
                >
                  {t(k.label)}
                </button>
              );
            })}
          </div>

          {(selectedNode.type === "color" || selectedNode.type === "gate") && (
            <div className="kinds" role="group" aria-label={t('farbe', 'Farbe')}>
              {(["red", "blue"] as PulseColor[]).map((c) => (
                <button
                  key={c}
                  className={`tool ${selectedNode.color === c ? "on" : ""}`}
                  aria-pressed={selectedNode.color === c}
                  onClick={() => commit(setColor(level, selectedNode.id, c))}
                >
                  {c === "red" ? t('dreieckfarbe2') : t('rautefarbe2')}
                </button>
              ))}
            </div>
          )}

          {selectedNode.type === "timer" && (
            <div className="stepper">
              <span>{t('zerflltNach')}</span>
              <button className="tool" aria-label={t('limitVerringern')} onClick={() => commit(setLimit(level, selectedNode.id, (selectedNode.limit ?? 1) - 1))}>
                −
              </button>
              <output>{t('limitZgen', { limit: selectedNode.limit })}</output>
              <button className="tool" aria-label={t('limitErhhen')} disabled={(selectedNode.limit ?? 1) >= MAX_LIMIT} onClick={() => commit(setLimit(level, selectedNode.id, (selectedNode.limit ?? 1) + 1))}>
                +
              </button>
            </div>
          )}

          {selectedNode.type === "mirror" && <p className="note">{t('zwillingKnotenPairZumNdernSpiegelErneut', { pair: selectedNode.pair })}</p>}

          <div className="kinds">
            <button className="tool" disabled={isStart || selectedNode.type === "mirror" || selectedNode.type === "gate" || selectedNode.type === "timer"} onClick={() => commit(setStart(level, selectedNode.id))}>
              {t('alsStartSetzen')}
            </button>
            <button
              className="tool danger"
              onClick={() => {
                commit(removeNode(level, selectedNode.id));
                setSelected(null);
              }}
              disabled={level.nodes.length <= 1}
            >
              {t('knotenLschen')}
            </button>
          </div>
        </section>
      )}

      <details className="group" open>
        <summary>{t('prfung')}</summary>
        {issues.length > 0 ? (
          <ul className="issues">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : !stats ? null : stats.truncated ? (
          <p className="warn">{t('dasLevelIstZuKomplexZumPrfenMitWeniger')}</p>
        ) : !stats.solvable ? (
          <p className="warn">{t('diesesLevelIstNichtLsbarPrfe')}</p>
        ) : (
          <>
            <dl className="stats">
              <div><dt>{t('krzesteLsung')}</dt><dd>{t('movesZge', { moves: stats.moves })}</dd></div>
              <div><dt>{t('lsungswege')}</dt><dd>{stats.shortestSolutions}</dd></div>
              <div><dt>{t('sackgassen')}</dt><dd>{stats.trapPct} %</dd></div>
              <div><dt>{t('schwierigkeit')}</dt><dd>{t('difficultySchtzung', { difficulty })}</dd></div>
            </dl>
            <button className="link" onClick={() => setShowSolution((s) => !s)}>
              {showSolution ? t('lsungswegVerbergen') : t('lsungswegAnzeigen')}
            </button>
            {solution && <p className="note">{solution.join(" → ")}</p>}
          </>
        )}
        <p className="note">{t('lengthVonMaxNodesKnoten', { length: level.nodes.length, MAX_NODES })}</p>
      </details>

      <details className="group">
        <summary>{t('zufallslevel')}</summary>
        <label className="slider">
          <span>{t('knoten', 'Knoten')}</span>
          <input type="range" min={GEN_MIN_NODES} max={GEN_MAX_NODES} value={gen.nodes} onChange={(e) => setGen({ ...gen, nodes: Number(e.target.value) })} />
          <output>{gen.nodes}</output>
        </label>
        <div className="kinds" role="group" aria-label={t('schwierigkeit')}>
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`tool ${gen.difficulty === d.id ? "on" : ""}`} aria-pressed={gen.difficulty === d.id} onClick={() => setGen({ ...gen, difficulty: d.id })}>
              {t(d.label)}
            </button>
          ))}
        </div>
        {(
          [
            ["oneWay", t('einbahnkanten')],
            ["once", t('einmalKnoten')],
            ["colors", t('farbenUndTore', 'Farben und Tore')],
            ["timers", t('zeitknoten')],
            ["mirror", t('spiegelpaar')],
          ] as [keyof GenSettings, string][]
        ).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={gen[k] as boolean} onChange={(e) => setGen({ ...gen, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
        <button className="btn primary" onClick={generate} disabled={busy}>
          {busy ? t('sucheLuft') : t('zufallslevelErzeugen')}
        </button>
        <p className="note">{t('ersetztDasAktuelleLevelMitRckgngigHolst')}</p>
      </details>

      <details className="group" open>
        <summary>{t('testenSpeichernUndTeilen')}</summary>
        <div className="actions">
          {canShare ? (
            <a className="btn primary" href={`/play/custom#${code}`}>
              {t('testen')}
            </a>
          ) : (
            <span className="btn disabled" aria-disabled="true">{t('testen')}</span>
          )}
          <button className="btn" onClick={share} disabled={!canShare}>
            {t('linkTeilen')}
          </button>
          <button className="btn" onClick={save}>
            {t('speichern')}
          </button>
          <button className="btn" onClick={newLevel}>
            {t('neuesLevel')}
          </button>
        </div>
        {!canShare && <p className="note">{t('zumTestenUndTeilenMussDasLevelFehlerfrei')}</p>}
        {canShare && <input className="field mono" readOnly value={shareUrl} aria-label={t('linkZumLevel')} onFocus={(e) => e.currentTarget.select()} />}

        <label className="field-label" htmlFor="import">{t('levelcodeOderLinkEinfgen')}</label>
        <div className="row-gap">
          <input id="import" className="field mono" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={t('p1')} />
          <button className="btn" onClick={importCode} disabled={!importText.trim()}>
            {t('laden')}
          </button>
        </div>

        <details>
          <summary>{t('frEntwickler')}</summary>
          <button
            className="btn"
            onClick={async () => setNotice((await copyText(JSON.stringify(level, null, 2))) ? t('jsonKopiert') : t('kopierenWarNichtMglich'))}
          >
            {t('levelAlsJsonKopieren')}
          </button>
          <p className="note"><Trans i18nKey="zumAufnehmenInDieKampagneAls">Zum Aufnehmen in die Kampagne: als <code>src/levels/level-NN.json</code> ablegen, id setzen und in <code>levels.ts</code> eintragen.</Trans></p>
        </details>
      </details>

      {saved && saved.levels.length > 0 && (
        <details className="group" open>
          <summary>{t('meineLevelLength', { length: saved.levels.length })}</summary>
          <ul className="mylevels">
            {saved.levels.map((l) => (
              <li key={l.key}>
                <span className="mylevel-name">
                  {l.name}
                  {l.par !== null && <small> {t('parZge', { par: l.par })}</small>}
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
                    {t('bearbeiten')}
                  </button>
                  <a className="tool" href={`/play/custom#${l.code}`}>
                    {t('spielen')}
                  </a>
                  <button
                    className="tool danger"
                    onClick={() => {
                      if (window.confirm(t('nameLschen', { name: l.name }))) {
                        deleteUserLevel(l.key);
                        if (savedKey === l.key) setSavedKey(null);
                      }
                    }}
                  >
                    {t('lschen')}
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
