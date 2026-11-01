import { useEffect, useState } from 'react';
import { cellsToString, runValidation, type ValidationRun } from '../lib/validate';
import type { EngineMode } from '../lib/types';
import { Check, Close, Play } from './Icons';

interface Props {
  engineMode: EngineMode;
  /** true while the model is still downloading */
  modelLoading: boolean;
}

const fmt = (scores: number[]) => scores.map((n) => n.toFixed(2)).join('  ·  ');

export default function Validation({ engineMode, modelLoading }: Props) {
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  /* Switching the engine invalidates an old run — never show a stale pass count. */
  useEffect(() => {
    setRun(null);
  }, [engineMode]);

  const start = async () => {
    if (busy) return;
    setOpen(true);
    setBusy(true);
    setRun(null);
    try {
      const r = await runValidation(engineMode, setCurrent);
      setRun(r);
    } finally {
      setBusy(false);
      setCurrent(null);
    }
  };

  const engineNote = run
    ? run.cases[0]?.engine.genuine
      ? `Sentence-BERT · ${run.cases[0].engine.model} · genuine inference`
      : run.requested === 'sbert'
        ? 'Sentence-BERT requested — weights unavailable, so the illustrative TF-IDF fallback was used and labelled'
        : `Illustrative TF-IDF · ${run.cases[0]?.engine.model}`
    : 'not run yet';

  return (
    <section className="validation wrap" id="validation" aria-label="Validation">
      <div className="results validation-card">
        <div className="results-head">
          <div>
            <span className="eyebrow">Validation</span>
            <h3>
              Expected mapping <em>vs</em> what the engine actually produced
            </h3>
            <p className="val-sum">
              {run
                ? `Last run: ${run.passed} / ${run.total} passed${
                    run.cases[0]?.engine.genuine
                      ? ' under genuine Sentence-BERT inference'
                      : run.requested === 'sbert'
                        ? ' — the labelled illustrative fallback produced the numbers'
                        : ' under the illustrative engine'
                  }.`
                : 'Runs all four demo submissions through the real engine and compares the result with the declared ground truth. Nothing is pre-computed.'}
            </p>
          </div>
          <div className="val-side">
            {run && (
              <span className={`val-score ${run.allPassed ? 'is-pass' : 'is-fail'}`}>
                {run.passed} / {run.total} passed
              </span>
            )}
            <button className="btn btn-primary" onClick={() => void start()} disabled={busy || modelLoading}>
              {busy ? (
                <>
                  <span className="spinner" />
                  {current ? `Running ${current}…` : 'Running…'}
                </>
              ) : (
                <>
                  <Play /> Run validation
                </>
              )}
            </button>
            <button className="mini-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Hide table' : 'Show table'}
            </button>
          </div>
        </div>

        {open && (
          <>
            <div className="table-wrap">
              <table className="map-table val-table">
                <thead>
                  <tr>
                    <th>Test case</th>
                    <th>Expected mapping</th>
                    <th>Actual mapping</th>
                    <th className="col-val-score">Cosine per fragment</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(run?.cases ?? []).map((c) => (
                    <tr key={c.id} className={c.pass ? '' : 'row-none'}>
                      <td>
                        <p className="cell-frag val-name">{c.label}</p>
                        <span className="cell-sub">{c.caption}</span>
                      </td>
                      <td className="is-mono val-cells">{cellsToString(c.expected)}</td>
                      <td className={`is-mono val-cells ${c.pass ? '' : 'val-cells-bad'}`}>
                        {c.error ? `error: ${c.error}` : cellsToString(c.actual)}
                      </td>
                      <td className="is-mono val-cells col-val-score">{c.scores.length ? fmt(c.scores) : '—'}</td>
                      <td>
                        <span className={`val-pill ${c.pass ? 'is-pass' : 'is-fail'}`}>
                          {c.pass ? <Check /> : <Close />} {c.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!run && !busy && (
                    <tr>
                      <td colSpan={5} className="val-empty">
                        Press <strong>Run validation</strong> to execute all four demos through the real
                        engine. A genuine failure is reported as FAIL.
                      </td>
                    </tr>
                  )}
                  {busy && !run && (
                    <tr>
                      <td colSpan={5} className="val-empty">
                        Running the demo submissions through the engine…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="results-note">
              Engine for this run: <strong>{engineNote}</strong>. Ground truth comes from{' '}
              <code>src/data/demos.ts</code>; thresholds are the engine's own (
              {engineMode === 'sbert' ? '0.70 / 0.52' : '0.60 / 0.40'}) and are never adjusted to make a
              case pass.
              {run && !run.cases[0]?.engine.genuine && run.requested === 'illustrative' && (
                <>
                  {' '}
                  The illustrative engine has no semantic representation, so a paraphrased fragment can
                  legitimately map to a different source than the declared expectation. Those FAILs are
                  reported exactly as produced.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
