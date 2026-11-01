const LIMITS: { t: string; d: string }[] = [
  {
    t: 'Reference corpus',
    d: 'Four short synthetic reference documents are bundled. The demo proves the mapping, not detection at scale.',
  },
  {
    t: 'Semantic false positives',
    d: 'Documents on the same topic share meaning, so SBERT can score them high with no copying. Proper quotation and citation also score high — intent is not modelled.',
  },
  {
    t: 'Similarity is evidence',
    d: 'Every score on screen is a lead for a human reviewer. Nothing here is, or should be read as, a plagiarism verdict.',
  },
  {
    t: 'Language & evaluation scope',
    d: 'Fragments are English sentences; tokenisation, the Porter stemmer and the SBERT model are English-only. There is no evaluation on a real student corpus.',
  },
];

const FUTURE: string[] = [
  'Upload a larger or real reference corpus (.txt), instead of only the bundled four.',
  'Sub-sentence (clause) fragments for finer mapping inside long sentences.',
  'Cross-check the same submission against an authorized similarity report, side by side.',
  'Calibrate the 0.70 / 0.52 thresholds on real student submissions instead of demo texts.',
  'Quotation and citation awareness to reduce legitimate-quotation false positives.',
  'Multilingual embeddings (e.g. a multilingual SBERT) and language detection.',
];

export default function Limitations() {
  return (
    <section className="limits wrap" id="limits" aria-label="Limitations and future work">
      <header className="sec-head reveal">
        <span className="eyebrow">Honest scope</span>
        <h2>
          What this prototype <em>does not</em> do.
        </h2>
      </header>

      <div className="limit-grid">
        {LIMITS.map((l) => (
          <article className="limit reveal" key={l.t}>
            <h3>{l.t}</h3>
            <p>{l.d}</p>
          </article>
        ))}
      </div>

      <details className="future reveal">
        <summary>
          <span className="eyebrow">Future work</span>
        </summary>
        <ul>
          {FUTURE.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
