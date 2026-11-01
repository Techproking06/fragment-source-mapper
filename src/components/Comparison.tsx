import { useEffect, useState } from 'react';
import { SOURCE_COLOR } from '../data/sources';
import { buildTrace } from '../lib/trace';
import type { AnalysisResult } from '../lib/types';

interface Props {
  result: AnalysisResult | null;
}

const score = (n: number) => n.toFixed(2);

/* ------------------------------------------------------------------ *
 * LEFT PANEL — an ORIGINAL illustrative reference.
 *
 * No real similarity report exists in this project and none was
 * obtained, so this panel is a hand-built mock: placeholder passages,
 * placeholder sources and made-up percentages, labelled as illustrative
 * everywhere. It imitates no vendor's report and states no result of
 * any commercial service.
 * ------------------------------------------------------------------ */

const REF_PASSAGES = [
  {
    id: 1,
    src: 1,
    text: 'Sample passage one: a highlighted sentence standing for a match in a real report.',
  },
  {
    id: 2,
    src: 2,
    text: 'Sample passage two: highlighted to demonstrate selecting a passage.',
  },
  {
    id: 3,
    src: 3,
    text: 'Sample passage three: shown so the source list has something to point at.',
  },
];

const REF_SOURCES = [
  { id: 1, pct: 20, note: 'placeholder source · journal article' },
  { id: 2, pct: 9, note: 'placeholder source · web page' },
  { id: 3, pct: 5, note: 'placeholder source · student paper' },
];

function ReferencePanel() {
  const [sel, setSel] = useState<number | null>(1);

  return (
    <article className="cmpv-panel cmpv-ref" aria-label="Illustrative reference panel">
      <header className="cmpv-head">
        <div>
          <span className="eyebrow">Reference panel · illustrative</span>
          <h3>Established similarity report</h3>
        </div>
        <span className="cmpv-tag">Interactive demo reference</span>
      </header>

      <p className="cmpv-disclaim">
        <strong>Illustrative reference · Not an actual Turnitin report.</strong> Nothing here was
        produced by, obtained from or endorsed by any similarity service; the text, percentages and
        sources below are placeholders written for this demo.
      </p>

      {/* illustrative overall indicator */}
      <div className="rv-gauge">
        <span className="rv-gauge-num">34%</span>
        <div>
          <span className="rv-gauge-label">Overall similarity · illustrative value</span>
          <div className="rv-gauge-track" role="img" aria-label="Illustrative similarity indicator, 34 percent">
            <span className="rv-gauge-fill" style={{ width: '34%' }} />
          </div>
        </div>
      </div>

      {/* sample document with highlighted passages */}
      <div className="rv-sheet">
        <span className="rv-sheet-k">Sample document · demo only</span>
        <p>
          The surrounding text of the demonstration document is shown so the highlighted passages have
          context.{' '}
          {REF_PASSAGES.slice(0, 1).map((p) => (
            <button
              key={p.id}
              className={`rv-pass ${sel === p.src ? 'is-on' : ''}`}
              data-src={p.src}
              onClick={() => setSel((s) => (s === p.src ? null : p.src))}
              aria-pressed={sel === p.src}
            >
              {p.text}
            </button>
          ))}{' '}
          The rest of the paragraph carries on in plain text to make the layout realistic.{' '}
          {REF_PASSAGES.slice(1, 2).map((p) => (
            <button
              key={p.id}
              className={`rv-pass ${sel === p.src ? 'is-on' : ''}`}
              data-src={p.src}
              onClick={() => setSel((s) => (s === p.src ? null : p.src))}
              aria-pressed={sel === p.src}
            >
              {p.text}
            </button>
          ))}{' '}
          A closing line of ordinary text follows.{' '}
          {REF_PASSAGES.slice(2).map((p) => (
            <button
              key={p.id}
              className={`rv-pass ${sel === p.src ? 'is-on' : ''}`}
              data-src={p.src}
              onClick={() => setSel((s) => (s === p.src ? null : p.src))}
              aria-pressed={sel === p.src}
            >
              {p.text}
            </button>
          ))}{' '}
          And the document ends here.
        </p>
      </div>

      {/* placeholder source list */}
      <ul className="rv-sources">
        {REF_SOURCES.map((s) => (
          <li key={s.id}>
            <button
              className={`rv-src ${sel === s.id ? 'is-on' : ''}`}
              onClick={() => setSel((v) => (v === s.id ? null : s.id))}
              aria-pressed={sel === s.id}
            >
              <span className="rv-src-pct">{s.pct}%</span>
              <span className="rv-src-name">Placeholder source {s.id}</span>
              <span className="rv-src-note">{s.note}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="cmpv-foot">
        Select a highlighted passage to select its placeholder source — or select a source to light up
        its passage. Demo interaction only.
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * RIGHT PANEL — this build's own numbers, from the current run.
 * ------------------------------------------------------------------ */

function LivePanel({ result }: { result: AnalysisResult | null }) {
  const [sel, setSel] = useState(0);

  /* A new run (demo switch, engine switch, Analyze) resets the selection. */
  useEffect(() => setSel(0), [result]);

  const index = result ? Math.min(sel, Math.max(0, result.matches.length - 1)) : 0;
  const trace = result && result.matches.length ? buildTrace(result, index) : null;
  const eng = result?.engine ?? null;

  const engineLabel = eng
    ? eng.genuine
      ? `Sentence-BERT · ${eng.model}`
      : eng.requested === 'illustrative'
        ? 'Illustrative TF-IDF · selected'
        : 'Illustrative TF-IDF · fallback'
    : 'illustrative';

  return (
    <article className="cmpv-panel cmpv-live" aria-label="Live prototype panel">
      <header className="cmpv-head">
        <div>
          <span className="eyebrow">This prototype · live</span>
          <h3>Fragment source mapper</h3>
        </div>
        <span className="cmpv-tag">{engineLabel}</span>
      </header>

      {!trace || !eng ? (
        <p className="cmpv-empty">
          Run a demo above — this panel then shows the fragment, scores and decision this build actually
          computed. Nothing here is pre-filled.
        </p>
      ) : (
        <>
          <div className="lv-pick" role="group" aria-label="Trace a fragment in this panel">
            {result!.matches.map((m, i) => (
              <button
                key={m.fragment.id}
                className={`lv-chip ${i === index ? 'is-on' : ''}`}
                onClick={() => setSel(i)}
                aria-pressed={i === index}
              >
                F{i + 1}
              </button>
            ))}
          </div>

          <div className="lv-body">
            <div className="lv-row">
              <span className="lv-k">Submitted fragment</span>
              <p className="lv-frag">{trace.fragment.text}</p>
            </div>

            <div className="lv-row">
              <span className="lv-k">Lexical overlap · Jaccard</span>
              {trace.jaccard ? (
                <p className="lv-v">
                  <b>{score(trace.jaccard.score)}</b> · {trace.jaccard.countIntersection} shared word
                  {trace.jaccard.countIntersection === 1 ? '' : 's'} of {trace.jaccard.countUnion} in{' '}
                  {trace.fragmentId} ∪ {trace.winnerSub?.id ?? '—'}
                  <span className="lv-toks">
                    {trace.jaccard.intersection.slice(0, 8).map((t) => (
                      <span key={t} className="tok tok-shared">
                        {t}
                      </span>
                    ))}
                    {trace.jaccard.intersection.length === 0 && <span className="tok tok-empty">∅ none</span>}
                  </span>
                </p>
              ) : (
                <p className="lv-v">no candidate sub-fragment to compare</p>
              )}
            </div>

            <div className="lv-row">
              <span className="lv-k">Embedding · semantic</span>
              {trace.semantic?.kind === 'sbert' ? (
                <p className="lv-v">
                  <b>{trace.semantic.model}</b> · {trace.semantic.dims}-d vectors, mean-pooled and
                  L2-normalised in this browser
                </p>
              ) : trace.semantic?.kind === 'tfidf' ? (
                <p className="lv-v">
                  <b>TF-IDF vector</b> · top terms{' '}
                  {trace.semantic.termsA.map((t) => `${t.term} ${t.weight.toFixed(3)}`).join(' · ')}
                </p>
              ) : (
                <p className="lv-v">no vector for this fragment</p>
              )}
            </div>

            <div className="lv-row">
              <span className="lv-k">Cosine similarity</span>
              {trace.cosine ? (
                <p className="lv-v">
                  <b>{score(trace.cosine.score)}</b> = {trace.cosine.dot.toFixed(4)} / ({trace.cosine.normA.toFixed(4)} ×{' '}
                  {trace.cosine.normB.toFixed(4)})
                </p>
              ) : (
                <p className="lv-v">no vector pair to combine</p>
              )}
            </div>

            <div className="lv-row">
              <span className="lv-k">Source ranking · cosine</span>
              <div className="lv-rank">
                {trace.ranking.map((r) => (
                  <div className="rank-bar" key={r.sourceId}>
                    <span className="rank-src" data-src={r.sourceId}>
                      {r.sourceId}
                    </span>
                    <span className="rank-track">
                      <span
                        className="rank-fill"
                        style={{
                          width: `${Math.max(3, r.cosine * 100)}%`,
                          background:
                            r.winner && trace.decision.status !== 'none'
                              ? SOURCE_COLOR[r.sourceId]
                              : 'var(--src-n)',
                        }}
                      />
                    </span>
                    <span className="rank-num">{score(r.cosine)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lv-row">
              <span className="lv-k">Final decision · thresholds</span>
              <p className="lv-v">
                <span className={`status status-${trace.decision.status} is-inline`}>
                  {trace.decision.statusLabel}
                </span>{' '}
                {trace.decision.status === 'none' ? (
                  <span className="lv-none">Below threshold — no source assigned.</span>
                ) : (
                  <span>
                    {trace.fragmentId} →{' '}
                    <span className="src-pill" data-src={trace.winner!.sourceId}>
                      <i className="dot" /> {trace.winnerSource!.label}
                    </span>
                    {trace.winnerSub ? ` · ${trace.winnerSub.id}` : ''}
                  </span>
                )}{' '}
                <span className="lv-note">
                  (strong ≥ {score(trace.decision.thresholds.strong)}, possible ≥{' '}
                  {score(trace.decision.thresholds.possible)})
                </span>
              </p>
            </div>
          </div>
          <p className="cmpv-foot">
            Live numbers from the current run, computed by the {engineLabel} engine — switching the demo
            or the engine above recomputes them.
          </p>
        </>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * What's different? — compact, two-sided, no benchmark claim.
 * ------------------------------------------------------------------ */

interface Row {
  feature: string;
  report: string;
  ours: string;
}

const ROWS: Row[] = [
  {
    feature: 'What the score describes',
    report: 'One overall similarity percentage for the whole submission.',
    ours: 'No whole-document number: every fragment keeps its own score and its own best source.',
  },
  {
    feature: 'Evidence a reviewer can see',
    report: 'Highlighted passages to inspect, plus the list of matching sources.',
    ours: 'The token sets behind the word overlap, and the embedding vectors behind the semantic score.',
  },
  {
    feature: 'How similarity is computed',
    report: 'Not exposed — the service reports a result, not a method.',
    ours: 'Jaccard word overlap as evidence, plus Sentence-BERT embeddings compared by cosine similarity.',
  },
  {
    feature: 'How a source is assigned',
    report: 'Sources are listed and the reviewer interprets the percentages.',
    ours: 'A documented threshold rule accepts or refuses a source per fragment, from the cosine to its closest sub-fragment.',
  },
  {
    feature: 'Where the analysis runs',
    report: 'A hosted submission pipeline; the report is generated by the service.',
    ours: 'Entirely in this browser — no upload, no server, no API key; every number is computed locally.',
  },
];

export default function Comparison({ result }: Props) {
  return (
    <section className="comparison wrap" id="compare" aria-label="Comparison with similarity reports">
      <header className="sec-head reveal">
        <span className="eyebrow">Real-world comparison</span>
        <h2>
          Two reports side by side. <em>Only one of them is live.</em>
        </h2>
        <p className="lede">
          Left: an illustrative stand-in for the kind of similarity report a reviewer already knows.
          Right: this prototype, showing the numbers it just computed. The panels are independent and
          share no calculation.
        </p>
      </header>

      <div className="cmpv reveal">
        <ReferencePanel />
        <LivePanel result={result} />
      </div>

      <div className="cmp-card reveal">
        <h3 className="cmp-title">What’s different?</h3>
        <div className="table-wrap">
          <table className="map-table cmp-table">
            <thead>
              <tr>
                <th>Aspect</th>
                <th>
                  Turnitin reference
                  <br />
                  <span className="th-sub">illustrative panel · described from public documentation, not tested here</span>
                </th>
                <th>
                  Our prototype
                  <br />
                  <span className="th-sub">this running build · its own computed results</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.feature}>
                  <td className="cmp-feature">{r.feature}</td>
                  <td className="cmp-report">{r.report}</td>
                  <td className="cmp-ours">{r.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cmp-note">
          <p>
            <strong>Qualitative workflow comparison only—not a performance benchmark.</strong> The
            Turnitin side is illustrative; our prototype side uses its own computed results. No claim of
            superior accuracy is made.
          </p>
          <p>
            The internal algorithms of commercial services are proprietary: no vendor report, score or
            percentage was obtained, reproduced or measured here, and neither tool proves plagiarism — a
            similarity report and this source map are both <em>evidence for a human reviewer</em>.
          </p>
        </div>
      </div>
    </section>
  );
}
