import { useEffect, useState } from 'react';
import { SOURCE_COLOR } from '../data/sources';
import { useKeydown } from '../hooks';
import { buildTrace } from '../lib/trace';
import type { AnalysisResult } from '../lib/types';
import { ArrowLeft, ArrowRight, Close } from './Icons';

interface Props {
  open: boolean;
  result: AnalysisResult | null;
  onClose: () => void;
}

const SLIDES = ['Patchwork plagiarism', 'Fragmentation', 'Semantic matching', 'Source mapping', 'Source map'];

/** Scores are quoted as 0.93 everywhere, same as the results table. */
const score = (n: number) => n.toFixed(2);

export default function Presentation({ open, result, onClose }: Props) {
  const [i, setI] = useSlideIndex(open, onClose);

  if (!open) return null;

  return (
    <div className="pres" role="dialog" aria-modal="true" aria-label="Presentation mode">
      <div className="pres-top">
        <span className="eyebrow">
          {String(i + 1).padStart(2, '0')} / 05 · {SLIDES[i]}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close presentation">
          <Close />
        </button>
      </div>

      <div className="pres-stage" key={i}>
        {i === 0 && <SlideWhat result={result} />}
        {i === 1 && <SlideFragment result={result} />}
        {i === 2 && <SlideSemantic result={result} />}
        {i === 3 && <SlideMapping result={result} />}
        {i === 4 && <SlideMap result={result} />}
      </div>

      <div className="pres-bottom">
        <div className="dots">
          {SLIDES.map((s, k) => (
            <button
              key={s}
              className={`dot-btn ${k === i ? 'is-on' : ''}`}
              onClick={() => setI(k)}
              aria-label={`Go to slide ${k + 1}`}
            />
          ))}
        </div>
        <div className="pres-nav">
          <button className="icon-btn" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Previous slide">
            <ArrowLeft />
          </button>
          <button className="icon-btn" onClick={() => setI(i + 1)} disabled={i === SLIDES.length - 1} aria-label="Next slide">
            <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function useSlideIndex(open: boolean, onClose: () => void): [number, (n: number) => void] {
  const [i, setRaw] = useState(0);

  const setI = (n: number) => setRaw(Math.max(0, Math.min(SLIDES.length - 1, n)));

  useEffect(() => {
    if (open) setRaw(0);
  }, [open]);

  useKeydown(
    (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setI(i + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setI(i - 1);
      }
    },
    open,
  );

  return [i, setI];
}

/* -------------------------------- 01 -------------------------------- */

function SlideWhat({ result }: { result: AnalysisResult | null }) {
  const liveSeq = (result?.matches ?? []).map((m) =>
    m.status !== 'none' && m.best ? m.best.sourceId : null,
  );
  const seq: (string | null)[] = liveSeq.length ? liveSeq : ['A', 'C', 'A', 'B', 'D', 'C'];
  return (
    <div className="slide">
      <h2>
        One document.
        <br />
        <em>Four different sources.</em>
      </h2>
      <p className="slide-lede">
        Patchwork plagiarism stitches fragments from several documents into one submission. No single
        whole-document check can see it.
      </p>
      <div className="patchwork-demo">
        <div className="pw-sheet">
          {seq.map((s, k) => (
            <span key={k} className="pw-band" data-src={s ?? 'none'} style={{ animationDelay: `${k * 90}ms` }}>
              <b>{s ?? 'orig'}</b>
            </span>
          ))}
        </div>
        <div className="pw-sources">
          {['A', 'B', 'C', 'D'].map((s) => (
            <span key={s} className="pw-src" data-src={s} style={{ animationDelay: `${400 + Number(s.charCodeAt(0) - 65) * 90}ms` }}>
              Source {s}
            </span>
          ))}
        </div>
        <small className="slide-note">
          {liveSeq.length
            ? 'live · the actual mapping of your current run'
            : 'concept illustration — run a demo and this slide mirrors the real mapping'}
        </small>
      </div>
    </div>
  );
}

/* -------------------------------- 02 -------------------------------- */

function SlideFragment({ result }: { result: AnalysisResult | null }) {
  const ids = (result?.matches ?? []).map((m) => `F${m.fragment.index + 1}`);
  const chips = ids.length ? ids : ['F1', 'F2', 'F3', 'F4', 'F5'];
  return (
    <div className="slide">
      <h2>
        Split it into <em>fragments.</em>
      </h2>
      <p className="slide-lede">
        Sentences become the unit of comparison. Every fragment is then checked on its own.
      </p>
      <div className="frag-demo">
        <div className="fd-doc">
          {(ids.length ? ['92%', '78%', '86%', '64%', '90%', '74%'] : ['92%', '78%', '86%', '64%', '90%']).map((w, k) => (
            <span key={k} className="fd-line" style={{ width: w, animationDelay: `${k * 80}ms` }} />
          ))}
        </div>
        <div className="fd-arrow"><ArrowRight width={22} height={22} /></div>
        <div className="fd-frags">
          {chips.map((f, k) => (
            <span key={f} className="fd-chip" style={{ animationDelay: `${280 + k * 90}ms` }}>{f}</span>
          ))}
        </div>
      </div>
      <small className="slide-note">
        {ids.length
          ? `live · ${ids.length} fragments produced from your submitted document`
          : 'concept illustration — run a demo and this slide shows your real fragments'}
      </small>
    </div>
  );
}

/* -------------------------------- 03 -------------------------------- */

function SlideSemantic({ result }: { result: AnalysisResult | null }) {
  const matched = (result?.matches ?? []).findIndex((m) => m.status !== 'none');
  const trace = result && matched >= 0 ? buildTrace(result, matched) : null;
  const jac = trace?.jaccard?.score ?? 0.11;
  const cos = trace?.cosine?.score ?? 0.84;
  const live = trace !== null;
  const cosLabel = live ? (trace!.engine.genuine ? 'SBERT cosine' : 'TF-IDF cosine') : 'SBERT cosine';

  return (
    <div className="slide">
      <h2>
        Match on <em>meaning.</em>
      </h2>
      <p className="slide-lede">
        Sentence-BERT turns a sentence into a vector. Cosine similarity compares the vectors — so a
        paraphrase still scores high while word overlap collapses.
      </p>
      <div className="sem-demo">
        <div className="sem-col">
          <span className="sem-label">Submitted fragment{live ? ` · ${trace!.fragmentId}` : ''}</span>
          <p>{live ? `“${trace!.fragment.text}”` : '“cut pollution from energy use”'}</p>
        </div>
        <div className="sem-col">
          <span className="sem-label">Winning source{live && trace!.winnerSub ? ` · ${trace!.winnerSub.id}` : ' A'}</span>
          <p>
            {live && trace!.winnerSub
              ? `“${trace!.winnerSub.text}”`
              : '“reduce emissions produced by energy sources”'}
          </p>
        </div>
        <div className="sem-bars">
          <div className="sem-bar">
            <span>word overlap · Jaccard</span>
            <span className="sem-track"><span className="sem-fill is-ghost" style={{ width: `${jac * 100}%` }} /></span>
            <b>{jac.toFixed(2)}</b>
          </div>
          <div className="sem-bar">
            <span>{cosLabel}</span>
            <span className="sem-track"><span className="sem-fill" style={{ width: `${cos * 100}%` }} /></span>
            <b>{cos.toFixed(2)}</b>
          </div>
        </div>
      </div>
      <small className="slide-note">
        {live
          ? `live values · ${trace!.fragmentId} vs ${trace!.winnerSub?.id ?? '—'} from your current run — ` +
            (trace!.engine.genuine
              ? trace!.engine.model
              : `illustrative TF-IDF engine (${trace!.engine.requested === 'illustrative' ? 'selected' : 'fallback'})`)
          : 'Illustrative values used to explain the concept.'}
      </small>
    </div>
  );
}

/* -------------------------------- 04 -------------------------------- */

function SlideMapping({ result }: { result: AnalysisResult | null }) {
  return (
    <div className="slide">
      <h2>
        Rank every <em>source.</em>
      </h2>
      <p className="slide-lede">
        Each fragment is scored against all four references. The highest score becomes its best
        candidate source.
      </p>
      <div className="rank-demo">
        {(result?.matches ?? []).map((m, k) => (
          <div className="rank-row" key={m.fragment.id} style={{ animationDelay: `${k * 80}ms` }}>
            <span className="rank-id">F{m.fragment.index + 1}</span>
            <div className="rank-bars">
              {[...m.scores].reverse().map((s) => (
                <div className="rank-bar" key={s.sourceId}>
                  <span className="rank-src" data-src={s.sourceId}>{s.sourceId}</span>
                  <span className="rank-track">
                    <span
                      className="rank-fill"
                      style={{
                        width: `${Math.max(3, s.similarity * 100)}%`,
                        background: s.sourceId === m.best?.sourceId ? SOURCE_COLOR[s.sourceId] : 'var(--src-n)',
                      }}
                    />
                  </span>
                  <span className="rank-num">{s.similarity.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!result && <p className="slide-empty">Run a demo first — this slide mirrors your live analysis.</p>}
      </div>
    </div>
  );
}

/* -------------------------------- 05 -------------------------------- */

function SlideMap({ result }: { result: AnalysisResult | null }) {
  const counts = new Map<string, number>();
  for (const m of result?.matches ?? []) {
    if (m.status === 'none' || !m.best) continue;
    counts.set(m.best.sourceId, (counts.get(m.best.sourceId) ?? 0) + 1);
  }

  return (
    <div className="slide">
      <h2>
        The <em>source map.</em>
      </h2>
      <p className="slide-lede">One page, one glance: where every fragment most likely came from.</p>
      <div className="finalmap">
        {(result?.matches ?? []).map((m, k) => {
          const sid = m.best?.sourceId;
          const matched = m.status !== 'none';
          return (
            <div className={`fm-row ${matched ? '' : 'is-plain'}`} key={m.fragment.id} style={{ animationDelay: `${k * 80}ms` }}>
              <span className="fm-id">F{m.fragment.index + 1}</span>
              <span className="fm-text">{m.fragment.text}</span>
              <span className="fm-wire" style={{ background: matched ? SOURCE_COLOR[sid!] : 'var(--src-n)' }} />
              <span className="fm-target" data-src={matched ? sid : 'none'}>
                {matched ? `Source ${sid}` : 'original'}
              </span>
              <span className="fm-pct">{matched ? score(m.similarity) : '—'}</span>
            </div>
          );
        })}
        {!result && <p className="slide-empty">Run a demo first — this slide mirrors your live analysis.</p>}
      </div>
      {result && (
        <p className="fm-summary">
          {[...counts.entries()].map(([s, n]) => (
            <span key={s} data-src={s}>
              <i className="dot" /> {s} ×{n}
            </span>
          ))}
          <span className="fm-summary-none">
            <i className="dot" /> {result.originalFragments} unmatched
          </span>
        </p>
      )}
    </div>
  );
}
