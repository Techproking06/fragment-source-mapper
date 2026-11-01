import type { ReactNode } from 'react';
import type { JaccardDetail, SourceId } from '../lib/types';

/* Small schematics for the six Method stages. Token-driven, so both themes and
   the existing source palette apply; motion always returns to the same values. */

function Viz({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="step-viz" role="img" aria-label={label} tabIndex={0}>
      <svg viewBox="0 0 240 78" focusable="false" aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

/** 01 — one document is cut into the fragments F1, F2, F3 … */
export function FragmentViz({ focus = 'F2' }: { focus?: string }) {
  const fragments = ['F1', 'F2', 'F3'];
  const shownFocus = fragments.includes(focus) ? ` Fragment ${focus} is highlighted.` : '';
  return (
    <Viz label={`A document split into fragments F1, F2 and F3.${shownFocus}`}>
      <text x="10" y="9" className="viz-label">text</text>
      <text x="230" y="9" textAnchor="end" className="viz-label">fragments</text>
      <rect x="10" y="15" width="82" height="48" rx="7" className="viz-pane" />
      <line x1="21" y1="28" x2="69" y2="28" className="viz-line" />
      <line x1="21" y1="37" x2="80" y2="37" className="viz-line" />
      <line x1="21" y1="46" x2="58" y2="46" className="viz-line" />
      <line x1="21" y1="55" x2="74" y2="55" className="viz-line" />
      <path d="M98 39h12m-4-4 4 4-4 4" className="viz-arrow" />
      {fragments.map((f, i) => (
        <g key={f}>
          <rect
            x="124"
            y={15 + i * 19}
            width="106"
            height="14"
            rx="7"
            className={`viz-frag${focus === f ? ' is-focus' : ''}`}
            style={{ animationDelay: `${i * 90}ms` }}
          />
          <text
            x="132"
            y={24.5 + i * 19}
            className={`viz-frag-text${focus === f ? ' is-focus' : ''}`}
          >
            {f}
          </text>
        </g>
      ))}
    </Viz>
  );
}

/** 02 — set overlap: the counts are the live (or fixed-example) Jaccard sets. */
export function JaccardViz({ detail }: { detail: JaccardDetail }) {
  const onlyA = Math.max(0, detail.countA - detail.countIntersection);
  const onlyB = Math.max(0, detail.countB - detail.countIntersection);
  return (
    <Viz label={`Token sets A and B: ${onlyA} only in A, ${onlyB} only in B, ${detail.countIntersection} shared, ${detail.countUnion} in the union.`}>
      <text x="66" y="20" textAnchor="middle" className="viz-set-label viz-set-a">A</text>
      <text x="174" y="20" textAnchor="middle" className="viz-set-label viz-set-b">B</text>
      <circle cx="100" cy="38" r="28" className="viz-circle viz-circle-a" />
      <circle cx="140" cy="38" r="28" className="viz-circle viz-circle-b" />
      <text x="85" y="42" textAnchor="middle" className="viz-count">{onlyA}</text>
      <text x="120" y="42" textAnchor="middle" className="viz-count viz-count-shared">
        {detail.countIntersection}
      </text>
      <text x="155" y="42" textAnchor="middle" className="viz-count">{onlyB}</text>
      <text x="120" y="75" textAnchor="middle" className="viz-label">
        A ∩ B = {detail.countIntersection} · A ∪ B = {detail.countUnion}
      </text>
    </Viz>
  );
}

const DENSE = [14, 23, 9, 29, 18, 11, 26, 16, 30, 8, 21, 13, 25, 10, 19, 15];
const SPARSE = [2, 21, 2, 2, 29, 3, 2, 15, 2, 2, 25, 3, 2, 2, 18, 2];

/** 03 — plain text becomes one fixed-width vector of numbers. */
export function VectorViz({ dims, fallback }: { dims: number | null; fallback: boolean }) {
  const bars = fallback ? SPARSE : DENSE;
  const label = fallback ? 'sparse' : `${dims ?? 384}-d`;
  return (
    <Viz label={fallback ? 'Text encoded as a sparse numeric vector.' : `Text encoded as a ${label} numeric vector.`}>
      <text x="10" y="10" className="viz-label">text</text>
      <text x="230" y="10" textAnchor="end" className="viz-label">{label}</text>
      <rect x="10" y="18" width="54" height="44" rx="6" className="viz-pane" />
      <line x1="20" y1="31" x2="52" y2="31" className="viz-line" />
      <line x1="20" y1="40" x2="58" y2="40" className="viz-line" />
      <line x1="20" y1="49" x2="44" y2="49" className="viz-line" />
      <path d="M68 40h11m-4-4 4 4-4 4" className="viz-arrow" />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={94 + i * 7.7}
          y={60 - h}
          width="5"
          height={h}
          rx="1.5"
          className="viz-vec-bar"
          style={{ animationDelay: `${i * 22}ms` }}
        />
      ))}
      <line x1="93" y1="62" x2="218" y2="62" className="viz-axis" />
      <path d="M94 67v3m124-3v3M94 68.5h124" className="viz-bracket" />
      <text x="156" y="76" textAnchor="middle" className="viz-label">one vector</text>
    </Viz>
  );
}

/** 04 — cosine is the angle between the two vectors; their lengths do not matter. */
export function CosineViz() {
  return (
    <Viz label="Cosine similarity shown as the angle theta between vectors A and B.">
      <line x1="64" y1="62" x2="224" y2="62" className="viz-axis" />
      <line x1="64" y1="62" x2="64" y2="12" className="viz-axis" />
      <path d="M64 62 138 16" className="viz-vector viz-vector-a" />
      <path d="M64 62 218 48" className="viz-vector viz-vector-b" />
      <circle cx="64" cy="62" r="2.2" className="viz-origin" />
      <path d="M97.2 40.9A40 40 0 0 1 103.2 55.9" pathLength="1" className="viz-arc" />
      <text x="109" y="53" className="viz-theta">θ</text>
      <circle cx="138" cy="16" r="2.6" className="viz-end-a" />
      <text x="134" y="11" textAnchor="middle" className="viz-set-label viz-set-a">A</text>
      <circle cx="218" cy="48" r="2.6" className="viz-end-b" />
      <text x="222" y="44" textAnchor="end" className="viz-set-label viz-set-b">B</text>
    </Viz>
  );
}

const DEFAULT_RANK: { sourceId: SourceId; cosine: number }[] = [
  { sourceId: 'A', cosine: 0.92 },
  { sourceId: 'B', cosine: 0.78 },
  { sourceId: 'C', cosine: 0.61 },
  { sourceId: 'D', cosine: 0.47 },
];

/** 05 — four source scores, sorted; bar length is proportional to cosine. */
export function RankingViz({ rows }: { rows?: { sourceId: SourceId; cosine: number }[] }) {
  const data = rows?.length ? rows : DEFAULT_RANK;
  const max = Math.max(...data.map((r) => r.cosine), 0.0001);
  return (
    <Viz label={`Four sources ranked by cosine: ${data.map((r) => `${r.sourceId} ${r.cosine.toFixed(2)}`).join(', ')}.`}>
      {data.map((r, i) => {
        const y = 10 + i * 17;
        const width = Math.max(14, (r.cosine / max) * 174);
        const id = r.sourceId.toLowerCase();
        return (
          <g key={r.sourceId}>
            <text x="8" y={y + 7} className="viz-rank">{i + 1}</text>
            <text x="24" y={y + 7} className={`viz-src viz-src-${id}`}>{r.sourceId}</text>
            <rect x="40" y={y} width="184" height="8" rx="4" className="viz-track" />
            <rect
              x="40"
              y={y}
              width={width}
              height="8"
              rx="4"
              className={`viz-bar viz-bar-${id}${i === 0 ? ' is-top' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
            />
          </g>
        );
      })}
    </Viz>
  );
}

/** 06 — the score lands in a band: below, possible, or strong. */
export function DecisionViz({
  thresholds,
  score,
}: {
  thresholds: { strong: number; possible: number };
  score: number | null;
}) {
  const X0 = 16;
  const X1 = 224;
  const span = X1 - X0;
  const pos = X0 + Math.min(Math.max(thresholds.possible, 0), 1) * span;
  const strong = X0 + Math.min(Math.max(thresholds.strong, 0), 1) * span;
  const marker = score === null ? null : X0 + Math.min(Math.max(score, 0), 1) * span;
  return (
    <Viz label={`Cosine score ${score === null ? 'not available' : score.toFixed(2)} against the possible threshold ${thresholds.possible.toFixed(2)} and strong threshold ${thresholds.strong.toFixed(2)}.`}>
      <defs>
        <clipPath id="viz-track-clip">
          <rect x={X0} y="36" width={span} height="9" rx="4.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#viz-track-clip)">
        <rect x={X0} y="36" width={span} height="9" className="viz-zone-none" />
        <rect x={pos} y="36" width={strong - pos} height="9" className="viz-zone-possible" />
        <rect x={strong} y="36" width={X1 - strong} height="9" className="viz-zone-strong" />
      </g>
      <line x1={pos} y1="31" x2={pos} y2="50" className="viz-threshold" />
      <line x1={strong} y1="31" x2={strong} y2="50" className="viz-threshold" />
      <text x={pos} y="23" textAnchor="middle" className="viz-threshold-label">
        {thresholds.possible.toFixed(2)}
      </text>
      <text x={strong} y="23" textAnchor="middle" className="viz-threshold-label">
        {thresholds.strong.toFixed(2)}
      </text>
      <text x={(X0 + pos) / 2} y="66" textAnchor="middle" className="viz-label">below</text>
      <text x={(pos + strong) / 2} y="66" textAnchor="middle" className="viz-label">possible</text>
      <text x={(strong + X1) / 2} y="66" textAnchor="middle" className="viz-label">strong</text>
      {marker !== null && (
        <g className="viz-marker-group">
          <circle cx={marker} cy="40.5" r="7" className="viz-marker-halo" />
          <line x1={marker} y1="30" x2={marker} y2="52" className="viz-marker-line" />
          <circle cx={marker} cy="40.5" r="5" className="viz-marker" />
          <circle cx={marker} cy="40.5" r="1.8" className="viz-marker-core" />
        </g>
      )}
    </Viz>
  );
}
