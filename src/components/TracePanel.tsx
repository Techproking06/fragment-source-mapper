import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useKeydown } from '../hooks';
import type { TraceData, TraceSourceRow } from '../lib/trace';
import { Close } from './Icons';

interface Props {
  trace: TraceData | null;
  onClose: () => void;
}

const s2 = (n: number) => n.toFixed(2);
const s4 = (n: number) => n.toFixed(4);
const num = (n: number) => n.toFixed(3);

/** 0.93-style score everywhere numbers are quoted as results. */
export const scoreText = (n: number) => n.toFixed(2);

/* ------------------------------- pieces ------------------------------- */

function Sec({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="tsec">
      <header className="tsec-h">
        <span className="tsec-n">{n}</span>
        <h4>{title}</h4>
        <span className="tsec-hint">{hint}</span>
      </header>
      <div className="tsec-b">{children}</div>
    </section>
  );
}

function Fact({ k, v, mono = false }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="fact">
      <span className="fact-k">{k}</span>
      <span className={`fact-v ${mono ? 'is-mono' : ''}`}>{v}</span>
    </div>
  );
}

/** One labelled line of a stage: what goes in, what comes out, what it feeds. */
function Line({ k, children }: { k: 'input' | 'feeds'; children: ReactNode }) {
  return (
    <p className={`ps-line ps-${k}`}>
      <span className="ps-k">{k}</span>
      <span className="ps-v">{children}</span>
    </p>
  );
}

/** The calculated result of a stage — always a real number from the run. */
function Res({ children }: { children: ReactNode }) {
  return <p className="ps-res is-mono">{children}</p>;
}

/** The edge between two stages: carried value and why it matters. */
function Conn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pconn">
      <span className="pconn-arw" aria-hidden>
        ↓
      </span>
      <p className="pconn-txt">
        <b>{title}</b> {children}
      </p>
    </div>
  );
}

function TokenList({
  label,
  tokens,
  mark,
}: {
  label: string;
  tokens: string[];
  mark?: 'in' | 'only-a' | 'only-b';
}) {
  const shown = tokens.slice(0, 26);
  const rest = tokens.length - shown.length;
  return (
    <div className="toklist">
      <span className="toklist-k">{label}</span>
      <div className="toklist-row">
        {shown.map((t, i) => (
          <span key={`${t}-${i}`} className={`tok ${mark === 'in' ? 'tok-shared' : mark ? 'tok-new' : ''}`}>
            {t}
          </span>
        ))}
        {rest > 0 && <span className="tok tok-more">+{rest}</span>}
        {tokens.length === 0 && <span className="tok tok-empty">∅ empty set</span>}
      </div>
    </div>
  );
}

function RankTable({ rows, accepted }: { rows: TraceSourceRow[]; accepted: boolean }) {
  return (
    <table className="rank-tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>Source</th>
          <th>Cosine (semantic)</th>
          <th>Jaccard (lexical)</th>
          <th>Best sub-fragment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.sourceId} className={r.winner && accepted ? 'is-winner' : ''}>
            <td className="rk-n">{r.rank}</td>
            <td>
              <span className="src-pill" data-src={r.sourceId}>
                <i className="dot" /> Source {r.sourceId}
              </span>
            </td>
            <td className="rk-num is-mono">{scoreText(r.cosine)}</td>
            <td className="rk-num is-mono rk-jac">{scoreText(r.jaccard)}</td>
            <td className="is-mono rk-sub" title={`highest cosine of ${r.subCount} sub-fragments`}>
              {r.subId || '—'}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="rk-empty">
              No sources to rank.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** The pipeline at a glance — the same six stages the cards below walk through. */
function StageFlow({ genuine }: { genuine: boolean }) {
  const names = [
    'Submitted fragment',
    'Jaccard',
    genuine ? 'Sentence-BERT' : 'TF-IDF vector',
    'Cosine similarity',
    'Source ranking',
    'Final decision',
  ];
  return (
    <div className="flow-strip" aria-label="Calculation pipeline: fragment, Jaccard, vectors, cosine, ranking, decision">
      {names.flatMap((n, i) => {
        const step = (
          <span className="fs-step" key={n}>
            <b>{i + 1}</b>
            {n}
          </span>
        );
        return i === 0
          ? [step]
          : [<span className="fs-arw" key={`a${i}`} aria-hidden>→</span>, step];
      })}
    </div>
  );
}

/* -------------------------------- panel -------------------------------- */

export default function TracePanel({ trace, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const open = trace !== null;

  useKeydown((e) => {
    if (e.key === 'Escape') onClose();
  }, open);

  /* Focus enters the dialog, stays inside it while it is open, and returns to
     the button that opened it on close. */
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => returnTo.current?.focus?.();
  }, [open]);

  /* Tab cycles inside the panel instead of walking into the page behind it. */
  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = ref.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])'),
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!trace) return null;

  const {
    fragmentId,
    fragment,
    fragmentCount,
    engine,
    winner,
    winnerSource,
    winnerSub,
    fragmentTokens,
    jaccard,
    semantic,
    cosine,
    ranking,
    decision,
    match,
  } = trace;

  /* A source is only "the" source when the threshold rule accepted it. Below
     that, the top-ranked source is a candidate — never a confirmed match. */
  const accepted = match.status !== 'none';
  const candidate = winnerSource;
  const role = accepted ? 'confirmed' : 'closest candidate';
  const pairId = winnerSub?.id ?? 'no source sub-fragment';
  const uniqueTokens = new Set(fragmentTokens).size;
  const vectorName = engine.dims ? `${engine.dims}-d vector` : 'TF-IDF vector';
  const engineText = engine.genuine
    ? `Sentence-BERT (genuine inference) · ${engine.model}`
    : engine.requested === 'illustrative'
      ? `Illustrative TF-IDF engine, selected deliberately · ${engine.model}`
      : `Illustrative TF-IDF (fallback) · ${engine.model}`;

  return (
    <div
      className="trace-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="trace"
        role="dialog"
        aria-modal="true"
        aria-label={`Trace this result — ${fragmentId}`}
        tabIndex={-1}
        ref={ref}
        onKeyDown={trapFocus}
      >
        {/* ------------------------------ head ------------------------------ */}
        <header className="trace-head">
          <div>
            <span className="eyebrow">Trace This Result · stage by stage</span>
            <h3>
              {fragmentId} →{' '}
              {accepted && winnerSource ? (
                <em data-src={winnerSource.id}>
                  {winnerSource.label}
                  {winnerSub ? ` · ${winnerSub.id}` : ''}
                </em>
              ) : (
                <em className="trace-no-src">below threshold · no source assigned</em>
              )}
            </h3>
          </div>
          <div className="trace-head-right">
            <span className={`status status-${match.status}`}>{decision.statusLabel}</span>
            <button className="icon-btn" onClick={onClose} aria-label="Close trace panel">
              <Close />
            </button>
          </div>
        </header>

        <div className="trace-body">
          <StageFlow genuine={engine.genuine} />

          {/* --------------------- 1 · submitted fragment ------------------- */}
          <Sec n="1" title="Submitted fragment" hint="the input">
            <div className="quote quote-frag">
              <span className="quote-k">{fragmentId} · submitted fragment</span>
              <p>{fragment.text}</p>
            </div>
            <div className="fact-grid">
              <Fact k="Engine used" v={engineText} />
              <Fact
                k="Embedding"
                v={engine.dims ? `${engine.dims} dimensions` : 'no SBERT vector — TF-IDF terms'}
                mono
              />
              <Fact k="Tokens after stop-words & stemming" v={`${fragmentTokens.length} (${uniqueTokens} unique)`} mono />
              <Fact k="Position" v={`${fragmentId} of ${fragmentCount} fragments in this submission`} mono />
            </div>
            <Res>
              {fragmentTokens.length} tokens · {vectorName}
            </Res>
            <Line k="feeds">
              the same fragment text now takes two paths: tokenised for Jaccard below, and encoded as a
              {' '}{vectorName} for the similarity stage.
            </Line>
          </Sec>

          <Conn title={`${fragmentId} → token set`}>
            tokenize() lower-cases, strips punctuation, removes stop-words and applies Porter stemming.
          </Conn>

          {/* -------------------------- 2 · Jaccard ------------------------- */}
          <Sec n="2" title="Jaccard word overlap" hint={jaccard ? 'lexical evidence · does not rank' : 'no pair to compare'}>
            {jaccard ? (
              <>
                <Line k="input">
                  A = token set of {fragmentId} ({jaccard.countA} unique tokens) · B = token set of{' '}
                  <strong>{pairId}</strong> ({jaccard.countB} unique tokens)
                </Line>
                <TokenList label={`A ∩ B · shared by both texts · ${jaccard.countIntersection}`} tokens={jaccard.intersection} mark="in" />
                <TokenList label={`A ∪ B · every token of both texts · ${jaccard.countUnion}`} tokens={jaccard.union} />
                <code className="calc-line">
                  |A ∩ B| / |A ∪ B| = {jaccard.countIntersection} / {jaccard.countUnion} ={' '}
                  <b>{scoreText(jaccard.score)}</b>
                </code>
                {jaccard.note && <p className="tsec-note tsec-warn">{jaccard.note}</p>}
                <Res>
                  {scoreText(jaccard.score)} · {jaccard.countIntersection} shared word
                  {jaccard.countIntersection === 1 ? '' : 's'}
                </Res>
                <Line k="feeds">
                  reported as lexical evidence next to the semantic score — it never ranks a source and
                  never decides the status.
                </Line>
              </>
            ) : (
              <>
                <Line k="input">no candidate sub-fragment was selected for {fragmentId}.</Line>
                <Res>—</Res>
                <Line k="feeds">nothing to record for this stage; the semantic stages decide the outcome.</Line>
              </>
            )}
          </Sec>

          <Conn title="Jaccard → report">
            a parallel evidence stream: its score is written into the results, but it is not an input to
            the vectors, the cosine or the ranking.
          </Conn>

          {/* ------------------- 3 · semantic representation ---------------- */}
          <Sec
            n="3"
            title={engine.genuine ? 'Sentence-BERT embedding' : 'TF-IDF vector'}
            hint="semantic representation"
          >
            {semantic && semantic.kind === 'sbert' ? (
              <>
                <Line k="input">
                  {fragmentId} text → vector A · {pairId} text → vector B ({role})
                </Line>
                <div className="fact-grid">
                  <Fact k="Model" v={semantic.model} mono />
                  <Fact k="Inference" v="genuine · ran in this browser (ONNX / WebAssembly)" />
                  <Fact k="Pipeline" v="tokenise → transformer → mean pooling → L2 normalise" />
                  <Fact k="Dimensions" v={`${semantic.dims}`} mono />
                </div>
                <div className="vec-pair">
                  <div className="vec">
                    <span className="vec-k">{fragmentId} · first {semantic.valuesA.length} of {semantic.dims}</span>
                    <code>
                      {semantic.valuesA.map((v, i) => (
                        <span key={i}>{num(v)}{i < semantic.valuesA.length - 1 ? ', ' : ''}</span>
                      ))}
                      <span className="vec-more"> … {semantic.dims - semantic.valuesA.length} more</span>
                    </code>
                  </div>
                  <div className="vec">
                    <span className="vec-k">{pairId} · first {semantic.valuesB.length} of {semantic.dims}</span>
                    <code>
                      {semantic.valuesB.map((v, i) => (
                        <span key={i}>{num(v)}{i < semantic.valuesB.length - 1 ? ', ' : ''}</span>
                      ))}
                      <span className="vec-more"> … {semantic.dims - semantic.valuesB.length} more</span>
                    </code>
                  </div>
                </div>
                <Res>2 × {semantic.dims} real values (preview above)</Res>
                <Line k="feeds">
                  both vectors go into the cosine comparison below; meaning is compared, so a paraphrase
                  can still score high while the shared-word list collapses.
                </Line>
              </>
            ) : semantic && semantic.kind === 'tfidf' ? (
              <>
                <Line k="input">
                  {fragmentId} text → vector A · {pairId} text → vector B ({role})
                </Line>
                <div className="fact-grid">
                  <Fact k="Representation" v="TF-IDF vector — the illustrative engine" />
                  <Fact k="Weights" v="log(1 + tf) × idf, synonym-expanded, L2-normalised" />
                </div>
                <div className="vec-pair">
                  <div className="vec">
                    <span className="vec-k">top terms · {fragmentId}</span>
                    <code>
                      {semantic.termsA.map((t) => (
                        <span key={t.term}>
                          {t.term}={s4(t.weight)}{' '}
                        </span>
                      ))}
                    </code>
                  </div>
                  <div className="vec">
                    <span className="vec-k">top terms · {pairId}</span>
                    <code>
                      {semantic.termsB.map((t) => (
                        <span key={t.term}>
                          {t.term}={s4(t.weight)}{' '}
                        </span>
                      ))}
                    </code>
                  </div>
                </div>
                <Res>2 TF-IDF vectors · weighted term lists above</Res>
                <Line k="feeds">both vectors go into the cosine comparison below.</Line>
              </>
            ) : (
              <>
                <Line k="input">no vector pair was produced for {fragmentId}.</Line>
                <Res>—</Res>
                <Line k="feeds">nothing to compare; the ranking below still lists every source.</Line>
              </>
            )}
            {semantic && <p className="tsec-note">{semantic.note}</p>}
            {engine.requested === 'sbert' && !engine.genuine && (
              <p className="trace-warn">
                Sentence-BERT was requested but its weights were unavailable, so the labelled fallback
                engine produced every number in this panel.
              </p>
            )}
          </Sec>

          <Conn title="vector pair → cosine">
            each vector is one list of numbers; cosine compares their direction, so text length does not
            distort the score.
          </Conn>

          {/* -------------------- 4 · cosine similarity --------------------- */}
          <Sec n="4" title="Cosine similarity" hint="the score that ranks and decides">
            {cosine ? (
              <>
                <Line k="input">
                  vector A = {fragmentId} · vector B = {pairId} ({cosine.method})
                </Line>
                <code className="calc-line">{cosine.formula}</code>
                <code className="calc-line calc-sub">{cosine.substituted}</code>
                <code className="calc-line calc-final">
                  score used by the engine = <b>{scoreText(cosine.score)}</b>
                  {cosine.clamped && <span className="calc-clamp"> (clamped into [0, 1])</span>}
                </code>
                <Res>
                  cos θ = {s4(cosine.raw)}
                  {cosine.clamped ? ` → ${scoreText(cosine.score)}` : ''}
                </Res>
                <Line k="feeds">
                  one cosine per source: {fragmentId} is scored against every sub-fragment of every
                  source, and the ranking below keeps each source's best.
                </Line>
              </>
            ) : (
              <>
                <Line k="input">no vector pair for {fragmentId}.</Line>
                <Res>—</Res>
                <Line k="feeds">the ranking below still orders the sources.</Line>
              </>
            )}
          </Sec>

          <Conn title="cosine per source → ranking">
            four similarity scores sorted descending — cosine alone sets this order.
          </Conn>

          {/* ---------------------- 5 · source ranking ---------------------- */}
          <Sec n="5" title="Source ranking" hint="cosine order, best first">
            <Line k="input">
              for each source, the sub-fragment with the highest cosine is kept — A: best of{' '}
              {ranking[0]?.subCount ?? 0}, B: best of {ranking[1]?.subCount ?? 0}, C: best of{' '}
              {ranking[2]?.subCount ?? 0}, D: best of {ranking[3]?.subCount ?? 0}.
            </Line>
            <RankTable rows={ranking} accepted={accepted} />
            <Res>
              rank 1 = {ranking[0] ? `Source ${ranking[0].sourceId} · ${scoreText(ranking[0].cosine)}` : '—'}
              {ranking[1] ? ` · rank 2 = ${scoreText(ranking[1].cosine)}` : ''}
            </Res>
            <Line k="feeds">
              the top score goes to the threshold rule below. Jaccard is the lexical cross-check against
              the same sub-fragment and never moves a source up or down.
            </Line>
          </Sec>

          <Conn title="top cosine → decision">
            the engine's thresholds turn the highest score into a status — or into no match at all.
          </Conn>

          {/* ---------------------- 6 · final decision --------------------- */}
          <Sec n="6" title="Final decision" hint="threshold rule applied to this fragment">
            <Line k="input">
              highest cosine {scoreText(decision.score)}
              {candidate ? ` against ${candidate.label}` : ''}
              {winnerSub ? ` · closest sub-fragment ${winnerSub.id}` : ''} · strong ≥{' '}
              {s2(decision.thresholds.strong)} · possible ≥ {s2(decision.thresholds.possible)}
            </Line>
            <code className="calc-line">{decision.rule}</code>
            <Res>
              {accepted && winnerSource ? (
                <>
                  {fragmentId} → {winnerSource.label}
                  {winnerSub ? ` · ${winnerSub.id}` : ''}
                </>
              ) : (
                'Below threshold — no source assigned.'
              )}
            </Res>
            <Line k="feeds">
              this is the row the fragment→source map, the results table and the presentation show for{' '}
              {fragmentId}.
            </Line>
            <p className="trace-summary">{decision.summary}</p>
            <p className="tsec-note">
              A match is a lead for a human reviewer — similarity is evidence, never proof of plagiarism.
            </p>
          </Sec>
        </div>
      </div>
    </div>
  );
}
