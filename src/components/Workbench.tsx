import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { SOURCES, SOURCE_COLOR } from '../data/sources';
import { DEMOS } from '../data/demos';
import { fragmentize, plural } from '../lib/text';
import { buildTrace } from '../lib/trace';
import type { AnalysisResult, EngineMode, EngineState, SourceId } from '../lib/types';
import type { Stage } from '../lib/engine';
import { Pencil, Play } from './Icons';
import TracePanel from './TracePanel';

interface Props {
  text: string;
  onTextChange: (t: string) => void;
  activeDemo: string;
  onDemo: (id: string) => void;
  engineMode: EngineMode;
  onEngineMode: (m: EngineMode) => void;
  engineState: EngineState;
  engineLabel: string;
  loadProgress: number;
  result: AnalysisResult | null;
  analyzing: boolean;
  stage: Stage | null;
  onAnalyze: () => void;
}

interface Path {
  id: string;
  d: string;
  color: string;
}

/** Scores are always quoted as 0.93 — one format, everywhere. */
const score = (n: number) => n.toFixed(2);

export default function Workbench(p: Props) {
  const [editing, setEditing] = useState(false);
  const [traceIndex, setTraceIndex] = useState<number | null>(null);
  const [openSources, setOpenSources] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const fragRefs = useRef(new Map<string, HTMLElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<Path[]>([]);

  const hasResult = p.result !== null;
  const showFragments = hasResult && !editing;
  const canRun = p.text.trim().length > 0;
  const trace = p.result && traceIndex !== null ? buildTrace(p.result, traceIndex) : null;
  const demo = DEMOS.find((d) => d.id === p.activeDemo) ?? DEMOS[0];

  const computePaths = useCallback(() => {
    const grid = gridRef.current;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;
    if (!grid || !left || !right || !p.result || window.innerWidth < 1040) {
      setPaths((prev) => (prev.length ? [] : prev));
      return;
    }
    const gr = grid.getBoundingClientRect();

    const next: Path[] = [];
    for (const m of p.result.matches) {
      if (m.status === 'none' || !m.best) continue;
      const el = fragRefs.current.get(m.fragment.id);
      const src = cardRefs.current.get(m.best.sourceId);
      if (!el || !src) continue;
      const er = el.getBoundingClientRect();
      const sr = src.getBoundingClientRect();
      const x1 = er.right - gr.left + 3;
      const x2 = sr.left - gr.left - 3;
      const y1 = er.top + er.height / 2 - gr.top;
      const y2 = sr.top + 30 - gr.top;
      const dx = Math.max(22, (x2 - x1) * 0.55);
      next.push({
        id: m.fragment.id,
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        color: `var(--src-${m.best.sourceId.toLowerCase()})`,
      });
    }
    setPaths(next);
  }, [p.result]);

  useLayoutEffect(() => {
    computePaths();
    const grid = gridRef.current;
    if (!grid) return;
    const ro = new ResizeObserver(() => computePaths());
    ro.observe(grid);
    window.addEventListener('resize', computePaths);
    document.fonts?.ready.then(() => computePaths()).catch(() => undefined);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computePaths);
    };
  }, [computePaths, showFragments]);

  useEffect(() => {
    if (hasResult) setEditing(false);
  }, [hasResult, p.activeDemo]);

  // a new result invalidates any open trace
  useEffect(() => {
    setTraceIndex(null);
  }, [p.result]);

  const fragmentCount = fragmentize(p.text).length;
  const incomingBySource = new Map<SourceId, AnalysisResult['matches']>();
  if (p.result) {
    for (const m of p.result.matches) {
      if (m.status === 'none' || !m.best) continue;
      const list = incomingBySource.get(m.best.sourceId) ?? [];
      list.push(m);
      incomingBySource.set(m.best.sourceId, list);
    }
  }

  const stageLabel: Record<string, string> = {
    fragment: 'Splitting into fragments…',
    jaccard: 'Tokenising & computing Jaccard…',
    sbert: 'Building SBERT embeddings…',
    cosine: 'Computing cosine similarity…',
    map: 'Drawing source map…',
  };

  /* Optional: load a plain-text submission. Text in, textarea out — no parsing,
     no upload, nothing leaves the machine. */
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file
      .text()
      .then((t) => p.onTextChange(t))
      .catch(() => undefined);
  };

  return (
    <section className="workbench wrap" id="demo">
      {/* ------------------------------ run bar ------------------------------ */}
      <div className="runbar reveal">
        <div className="run-lead">
          <div className="demo-set" role="tablist" aria-label="Demo modes">
            {DEMOS.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={p.activeDemo === d.id}
                className={`chip ${p.activeDemo === d.id ? 'is-on' : ''}`}
                onClick={() => p.onDemo(d.id)}
                title={d.expected}
              >
                {d.label}
              </button>
            ))}
          </div>
          {/* The caption for the selected demo belongs with the selector. */}
          <p className="run-cap">
            <span className="caption-tag">Demo · {demo.label}</span>
            {demo.caption} <em>{demo.expected}</em>
          </p>
        </div>

        <div className="run-side">
          <div className="segmented" role="group" aria-label="Similarity engine">
            <button
              className={p.engineMode === 'sbert' ? 'is-on' : ''}
              onClick={() => p.onEngineMode('sbert')}
              disabled={p.engineState === 'loading'}
            >
              Sentence-BERT
            </button>
            <button
              className={p.engineMode === 'illustrative' ? 'is-on' : ''}
              onClick={() => p.onEngineMode('illustrative')}
            >
              Illustrative
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={p.onAnalyze}
            disabled={p.analyzing || !canRun}
            title={canRun ? undefined : 'The submission is empty — paste text or pick a demo first'}
          >
            {p.analyzing ? (
              <>
                <span className="spinner" /> {stageLabel[p.stage ?? 'fragment']}
              </>
            ) : (
              <>
                <Play /> Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {!canRun && (
        <div className="notice">
          The submission is empty — paste a document in the left pane, or pick one of the demos above.
        </div>
      )}

      {p.engineState === 'loading' && p.engineMode === 'sbert' && (
        <div className="notice">
          <span className="meter" style={{ width: `${Math.max(6, p.loadProgress)}%` }} />
          Loading the local Sentence-BERT model ({Math.round(p.loadProgress)}%) — first run only,
          cached afterwards.
        </div>
      )}

      {hasResult && p.engineMode === 'sbert' && p.result!.mode === 'illustrative' && (
        <div className="notice notice-warn">
          The Sentence-BERT weights were unavailable, so this run used the labelled
          <strong> illustrative</strong> engine instead. Scores below are heuristics, not ML results.
        </div>
      )}

      {/* ------------------------------- panes ------------------------------- */}
      <div className="bench" ref={gridRef}>
        <div className={`pane ${showFragments ? 'is-mapped' : ''}`} ref={leftPaneRef}>
          <div className="pane-head">
            <h3>Submitted document</h3>
            <div className="pane-meta">
              <span>{plural(showFragments ? p.result!.matches.length : fragmentCount, 'fragment')}</span>
              <label className="mini-btn file-btn" title="Load a plain-text (.txt) document">
                Open .txt
                <input type="file" accept=".txt,text/plain" hidden onChange={onFile} />
              </label>
              {hasResult && (
                <button className="mini-btn" onClick={() => setEditing((e) => !e)}>
                  {showFragments ? <><Pencil /> Edit text</> : 'Back to map'}
                </button>
              )}
            </div>
          </div>

          {showFragments ? (
            <ol className="frags">
              {p.result!.matches.map((m) => {
                const matched = m.status !== 'none';
                const srcId = m.best?.sourceId;
                return (
                  <li
                    key={m.fragment.id}
                    className={`frag ${matched ? 'is-matched' : 'is-plain'}`}
                    data-src={matched ? srcId : 'none'}
                    ref={(el) => {
                      if (el) fragRefs.current.set(m.fragment.id, el);
                      else fragRefs.current.delete(m.fragment.id);
                    }}
                  >
                    <span className="frag-rail" />
                    <div className="frag-body">
                      <div className="frag-top">
                        <span className="frag-id">F{m.fragment.index + 1}</span>
                        {matched ? (
                          <span className="frag-tag" style={{ color: SOURCE_COLOR[srcId!] }}>
                            <i className="dot" /> {srcId} · {score(m.similarity)}
                          </span>
                        ) : (
                          <span className="frag-tag frag-tag-none">
                            <i className="dot" /> no strong match
                          </span>
                        )}
                      </div>
                      <p title={m.fragment.text}>{m.fragment.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <textarea
              className="doc-edit"
              value={p.text}
              spellCheck={false}
              onChange={(e) => p.onTextChange(e.target.value)}
              placeholder="Paste the document you want to analyse…"
              aria-label="Submitted document"
            />
          )}
        </div>

        <div className="pane" ref={rightPaneRef}>
          <div className="pane-head">
            <h3>Source documents</h3>
            <div className="pane-meta">
              <span>4 references</span>
            </div>
          </div>

          <div className="sources">
            {SOURCES.map((src) => {
              const incoming = incomingBySource.get(src.id) ?? [];
              const subs = fragmentize(src.text);
              const hitIdx = new Set(incoming.map((m) => m.best!.bestSourceFragment));
              /* Matching sub-fragments show by default; the rest hide behind
                 a small "Show all" control until the analysis exists. */
              const expanded = !p.result || openSources.has(src.id);
              const rows = subs
                .map((text, i) => ({ text, i }))
                .filter(({ i }) => expanded || hitIdx.has(i));
              const hiddenCount = subs.length - hitIdx.size;
              const canToggle = p.result && hiddenCount > 0;
              return (
                <article
                  key={src.id}
                  data-src={src.id}
                  className={`source-card ${incoming.length ? 'has-match' : ''}`}
                  ref={(el) => {
                    if (el) cardRefs.current.set(src.id, el);
                    else cardRefs.current.delete(src.id);
                  }}
                >
                  <header className="src-head">
                    <span className="src-dot" data-src={src.id} />
                    <strong>{src.label}</strong>
                    <span className="src-kind">{src.kind}</span>
                    {incoming.length > 0 && (
                      <span className="src-count" data-src={src.id}>
                        {incoming.length} in
                      </span>
                    )}
                  </header>
                  <h4>{src.title}</h4>
                  <ul className="src-frags">
                    {rows.map(({ text, i }) => (
                      <li key={i} className={hitIdx.has(i) ? 'is-hit' : ''} data-src={src.id}>
                        <span className="src-idx">{src.id}{i + 1}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                    {p.result && !expanded && rows.length === 0 && (
                      <li className="src-none" data-src={src.id}>
                        no matching fragment in this run
                      </li>
                    )}
                  </ul>
                  {canToggle && (
                    <div className="src-actions">
                      <button
                        className="mini-btn"
                        onClick={() =>
                          setOpenSources((s) => {
                            const next = new Set(s);
                            if (next.has(src.id)) next.delete(src.id);
                            else next.add(src.id);
                            return next;
                          })
                        }
                      >
                        {expanded ? 'Show less' : `Show all ${subs.length}`}
                      </button>
                    </div>
                  )}
                  <footer className="src-foot">{src.meta}</footer>
                </article>
              );
            })}
          </div>
        </div>

        <svg className="connectors" aria-hidden>
          {paths.map((pth) => (
            <path
              key={pth.id}
              d={pth.d}
              pathLength={1}
              style={{ stroke: pth.color }}
              className="connector"
            />
          ))}
        </svg>
      </div>

      {/* ------------------------------ results ------------------------------ */}
      {p.result && <Results result={p.result} onTrace={(i) => setTraceIndex(i)} />}

      <TracePanel trace={trace} onClose={() => setTraceIndex(null)} />
    </section>
  );
}

/* ------------------------------ results ------------------------------ */

function Results({ result, onTrace }: { result: AnalysisResult; onTrace: (index: number) => void }) {
  const order: SourceId[] = ['A', 'B', 'C', 'D'];
  const eng = result.engine;
  return (
    <div className="results reveal is-in">
      <div className="results-head">
        <div>
          <span className="eyebrow">Fragment-level source map</span>
          <h3>
            {result.matchedFragments} of {plural(result.matches.length, 'fragment')} matched ·{' '}
            <em>{plural(result.distinctSources, 'distinct source')}</em>
          </h3>
        </div>
        <div className="head-right">
          <span className="engine-chip">
            {eng.genuine
              ? `SBERT · ${eng.model}`
              : `Illustrative TF-IDF${eng.requested === 'illustrative' ? '' : ' (fallback)'}`}{' '}
            · strong ≥ {eng.thresholds.strong.toFixed(2)} · possible ≥{' '}
            {eng.thresholds.possible.toFixed(2)}
          </span>
          <div className="legend">
            {order.map((id) => (
              <span key={id} className="legend-item" data-src={id}>
                <i className="dot" style={{ background: SOURCE_COLOR[id] }} /> {id}
              </span>
            ))}
            <span className="legend-item legend-none">
              <i className="dot" /> unmatched
            </span>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="map-table">
          <thead>
            <tr>
              <th className="col-n">#</th>
              <th>Submitted fragment</th>
              <th>Best source</th>
              <th className="col-score">Similarity</th>
              <th className="col-trace">Trace</th>
            </tr>
          </thead>
          <tbody>
            {result.matches.map((m, i) => {
              const matched = m.status !== 'none';
              const sid = m.best?.sourceId;
              const lead = m.similarity - (m.scores[1]?.similarity ?? 0);
              return (
                <tr key={m.fragment.id} className={matched ? '' : 'row-none'}>
                  <td className="col-n">
                    <span className="row-idx" data-src={matched ? sid : 'none'}>
                      {i + 1}
                    </span>
                  </td>
                  <td>
                    <p className="cell-frag">{m.fragment.text}</p>
                  </td>
                  <td>
                    {matched ? (
                      <>
                        <span className="src-pill" data-src={sid}>
                          <i className="dot" /> Source {sid}
                        </span>
                        <span className="cell-sub">
                          best sub-fragment {sid}
                          {m.best!.bestSourceFragment + 1} ·{' '}
                          {lead > 0.02
                            ? `${score(lead)} ahead of next`
                            : 'ambiguous — close second place'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="src-pill src-pill-none">
                          <i className="dot" /> no strong match
                        </span>
                        <span className="cell-sub">original writing / below threshold</span>
                      </>
                    )}
                    <span className="cell-all">
                      {m.scores.map((s) => (
                        <span key={s.sourceId} className={matched && s.sourceId === sid ? 'best' : ''}>
                          {s.sourceId} {score(s.similarity)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="col-score">
                    <div className="bars">
                      <div className="bar-row">
                        <span className="bar-label">Cosine</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${m.similarity * 100}%`,
                              background: matched ? SOURCE_COLOR[sid!] : 'var(--src-n)',
                            }}
                          />
                        </span>
                        <span className="bar-num">{score(m.similarity)}</span>
                      </div>
                      <div className="bar-row bar-row-2">
                        <span className="bar-label">Jaccard</span>
                        <span className="bar-track">
                          <span className="bar-fill bar-fill-ghost" style={{ width: `${m.jaccard * 100}%` }} />
                        </span>
                        <span className="bar-num">{score(m.jaccard)}</span>
                      </div>
                    </div>
                    <span className={`status status-${m.status}`}>
                      {m.status === 'strong' ? 'strong match' : m.status === 'possible' ? 'possible match' : 'below threshold'}
                    </span>
                  </td>
                  <td className="col-trace">
                    <button
                      className="mini-btn trace-btn"
                      onClick={() => onTrace(i)}
                      aria-label={`Trace this result for fragment F${i + 1}`}
                    >
                      Trace This Result
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.matches.length === 0 && (
        <p className="results-note">
          Nothing to compare — the submission contained no complete sentences after fragmentation.
        </p>
      )}

      <p className="results-note">
        {eng.genuine
          ? 'Cosine similarity ranks the sources and applies the thresholds'
          : eng.requested === 'sbert'
            ? 'Sentence-BERT was requested but its weights were unavailable, so the illustrative TF-IDF fallback produced these scores'
            : 'The illustrative TF-IDF engine was selected deliberately, and produced these scores by design — not because a model failed'}
        ; Jaccard word overlap is reported as lexical evidence on the same winning sub-fragment — press{' '}
        <strong>Trace This Result</strong> for the token sets, vectors, dot product, norms and decision
        rule.
      </p>
    </div>
  );
}
