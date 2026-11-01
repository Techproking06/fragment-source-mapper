/* ------------------------------------------------------------------ *
 * Trace This Result.
 *
 * Builds the full computational journey of ONE submitted fragment from the
 * intermediates the engine already stored (tokens, vectors, offsets,
 * thresholds). Every number here comes from the same functions the engine
 * used — `jaccardDetail` calls the engine's `jaccard()`, and the cosine
 * details sum the very same vectors in the same order. Nothing is invented.
 * ------------------------------------------------------------------ */

import { SOURCE_MAP } from '../data/sources';
import { cosineDenseDetail, cosineSparseDetail, topTerms } from './similarity';
import type { Vector } from './similarity';
import { fragmentize, jaccardDetail } from './text';
import type {
  AnalysisResult,
  CosineDetail,
  EngineInfo,
  Fragment,
  JaccardDetail,
  MatchResult,
  MatchStatus,
  SourceId,
  SourceScore,
  SourceDoc,
} from './types';

const PREVIEW = 8;
const TOP_TERMS = 6;

export interface TraceSourceRow {
  sourceId: SourceId;
  /** 1 = highest cosine */
  rank: number;
  cosine: number;
  jaccard: number;
  /** index of the winning sub-fragment inside that source (-1 = none) */
  subIndex: number;
  /** identifier such as "C2"; "" when there is no sub-fragment */
  subId: string;
  subText: string;
  /** how many sub-fragments this source was reduced to (the cosine is the max over them) */
  subCount: number;
  winner: boolean;
}

export type SemanticPreview =
  | {
      kind: 'sbert';
      model: string;
      dims: number;
      valuesA: number[];
      valuesB: number[];
      note: string;
    }
  | {
      kind: 'tfidf';
      termsA: { term: string; weight: number }[];
      termsB: { term: string; weight: number }[];
      note: string;
    };

export interface TraceCosine extends CosineDetail {
  method: string;
  formula: string;
  substituted: string;
}

export interface TraceDecision {
  score: number;
  status: MatchStatus;
  thresholds: { strong: number; possible: number };
  /** plain-text decision rule for the engine actually used */
  rule: string;
  /** generated from this fragment's real numbers — never canned prose */
  summary: string;
  statusLabel: 'strong match' | 'possible match' | 'below threshold';
}

export interface TraceData {
  fragment: Fragment;
  fragmentId: string;
  fragmentIndex: number;
  /** how many fragments this submission was split into */
  fragmentCount: number;
  match: MatchResult;
  engine: EngineInfo;
  winner: SourceScore | null;
  winnerSource: SourceDoc | null;
  winnerSub: { index: number; id: string; text: string } | null;
  fragmentTokens: string[];
  jaccard: JaccardDetail | null;
  semantic: SemanticPreview | null;
  cosine: TraceCosine | null;
  ranking: TraceSourceRow[];
  decision: TraceDecision;
}

export function sourceSubFragments(sourceId: SourceId): Fragment[] {
  const doc = SOURCE_MAP[sourceId];
  if (!doc) return [];
  return fragmentize(doc.text).map((text, index) => ({
    id: `${sourceId}${index + 1}`,
    index,
    text,
  }));
}

const round = (n: number, d = 4) => n.toFixed(d);

function decisionRule(engine: EngineInfo): string {
  const name = engine.mode === 'sbert' ? 'Sentence-BERT' : 'illustrative TF-IDF';
  const { strong, possible } = engine.thresholds;
  return (
    `${name} engine — cosine ≥ ${strong.toFixed(2)} → strong match · ` +
    `${possible.toFixed(2)} ≤ cosine < ${strong.toFixed(2)} → possible match · ` +
    `cosine < ${possible.toFixed(2)} → below threshold (no source assigned)`
  );
}

function statusLabelOf(status: MatchStatus): TraceDecision['statusLabel'] {
  return status === 'strong' ? 'strong match' : status === 'possible' ? 'possible match' : 'below threshold';
}

function buildSummary(
  trace: Omit<TraceData, 'decision'>,
  status: MatchStatus,
): string {
  const { engine, match, winner, winnerSource, winnerSub } = trace;
  const fid = trace.fragment.id.toUpperCase().replace(/^S/, 'F');
  const engineName = engine.genuine
    ? `Sentence-BERT (${engine.model})`
    : engine.requested === 'illustrative'
      ? `the illustrative TF-IDF engine (${engine.model}), selected in the engine switch`
      : 'the illustrative TF-IDF engine (Sentence-BERT weights unavailable)';

  const fallbackNote =
    engine.requested === 'sbert' && !engine.genuine
      ? ' Sentence-BERT was requested but its weights were unavailable, so these scores come from the labelled fallback.'
      : '';

  if (status !== 'none' && winner && winnerSource && winnerSub) {
    const t = engine.thresholds;
    const band =
      status === 'strong'
        ? `at or above the strong threshold ${t.strong.toFixed(2)}`
        : `between ${t.possible.toFixed(2)} and ${t.strong.toFixed(2)}`;
    return (
      `${fid} was compared with all four sources using ${engineName}. Its highest cosine is ` +
      `${round(match.similarity, 2)} against ${winnerSource.label} (${winnerSub.id}), which is ${band}, ` +
      `so the fragment is labelled “${statusLabelOf(status)}”. Word overlap with that same sub-fragment ` +
      `is Jaccard ${round(winner.jaccard, 2)} — lexical evidence reported alongside, never used to rank.` +
      fallbackNote
    );
  }

  const best = match.scores[0];
  const where = best
    ? `${round(match.similarity, 2)} against Source ${best.sourceId}`
    : 'nothing to compare';
  return (
    `${fid} produced its highest cosine of ${where}, below the possible-match threshold ` +
    `${engine.thresholds.possible.toFixed(2)}, so it is labelled “below threshold” and counted as ` +
    `original writing. This decision uses cosine only — Jaccard is shown as supporting lexical evidence.` +
    fallbackNote
  );
}

/** Full journey of one fragment. Returns null for an out-of-range index. */
export function buildTrace(result: AnalysisResult, fragmentIndex: number): TraceData | null {
  const match = result.matches[fragmentIndex];
  if (!match) return null;

  const engine = result.engine;
  const winner = match.best;
  const winnerSource = winner ? SOURCE_MAP[winner.sourceId] ?? null : null;

  let winnerSub: TraceData['winnerSub'] = null;
  if (winner && winner.bestSourceFragment >= 0 && winnerSource) {
    const subs = sourceSubFragments(winner.sourceId);
    const sub = subs[winner.bestSourceFragment];
    winnerSub = sub
      ? { index: sub.index, id: sub.id, text: sub.text }
      : null;
  }

  const fragmentTokens = result.tokens[fragmentIndex] ?? [];

  /* B — lexical: the same pair of texts the cosine winner selected --------- */
  let jaccard: JaccardDetail | null = null;
  if (winner && winner.bestSourceFragment >= 0) {
    const abs = result.sourceOffsets[winner.sourceId] + winner.bestSourceFragment;
    const srcTokens = result.tokens[abs];
    if (srcTokens) jaccard = jaccardDetail(fragmentTokens, srcTokens);
  }

  /* C — semantic representation of that same pair -------------------------- */
  let semantic: SemanticPreview | null = null;
  let cosine: TraceCosine | null = null;

  if (winner && winner.bestSourceFragment >= 0) {
    const abs = result.sourceOffsets[winner.sourceId] + winner.bestSourceFragment;

    if (result.dense && result.dense[fragmentIndex] && result.dense[abs]) {
      const a = result.dense[fragmentIndex];
      const b = result.dense[abs];
      const detail = cosineDenseDetail(a, b);
      semantic = {
        kind: 'sbert',
        model: engine.model,
        dims: a.length,
        valuesA: Array.from(a.slice(0, PREVIEW)),
        valuesB: Array.from(b.slice(0, PREVIEW)),
        note:
          'Sentence-BERT encodes each text as one vector of meaning. These are the first ' +
          `${PREVIEW} of ${a.length} real values, mean-pooled and L2-normalised by the model.`,
      };
      cosine = {
        ...detail,
        method: `Sentence-BERT · ${engine.model} · ${a.length}-dimensional, L2-normalised`,
        formula: 'cos θ = (A · B) / (‖A‖ · ‖B‖)',
        substituted:
          `(A · B) = ${round(detail.dot)}  ·  ‖A‖ = ${round(detail.normA)}  ·  ` +
          `‖B‖ = ${round(detail.normB)}  →  ${round(detail.raw)}` +
          (detail.clamped ? `  →  clamped to ${round(detail.score, 2)}` : `  =  ${round(detail.score)}`),
      };
    } else if (result.sparse && result.sparse[fragmentIndex] && result.sparse[abs]) {
      const a: Vector = result.sparse[fragmentIndex];
      const b: Vector = result.sparse[abs];
      const detail = cosineSparseDetail(a, b);
      semantic = {
        kind: 'tfidf',
        termsA: topTerms(a, TOP_TERMS),
        termsB: topTerms(b, TOP_TERMS),
        note:
          engine.requested === 'illustrative'
            ? 'The illustrative engine represents each text as a TF-IDF vector, so the highest-weighted ' +
              'stemmed terms of each vector are shown instead of an embedding. This engine was selected ' +
              'in the engine switch — no model failed.'
            : 'Sentence-BERT weights were unavailable, so this run used TF-IDF: the highest-weighted ' +
              'stemmed terms of each vector are shown instead of an embedding.',
      };
      cosine = {
        ...detail,
        method: 'Illustrative engine · TF-IDF (log-tf × idf, L2-normalised) with synonym expansion',
        formula: 'cos θ = (A · B) / (‖A‖ · ‖B‖)',
        substituted:
          `(A · B) = ${round(detail.dot)}  ·  ‖A‖ = ${round(detail.normA)}  ·  ` +
          `‖B‖ = ${round(detail.normB)}  →  ${round(detail.raw)}` +
          (detail.clamped ? `  →  clamped to ${round(detail.score, 2)}` : `  =  ${round(detail.score)}`),
      };
    }
  }

  /* E — ranking of all four sources --------------------------------------- */
  const ranking: TraceSourceRow[] = match.scores.map((s, i) => {
    const subs = sourceSubFragments(s.sourceId);
    const sub = s.bestSourceFragment >= 0 ? subs[s.bestSourceFragment] : undefined;
    return {
      sourceId: s.sourceId,
      rank: i + 1,
      cosine: s.similarity,
      jaccard: s.jaccard,
      subIndex: s.bestSourceFragment,
      subId: sub ? sub.id : '',
      subText: sub ? sub.text : '',
      subCount: subs.length,
      winner: winner ? s.sourceId === winner.sourceId : false,
    };
  });

  const base: Omit<TraceData, 'decision'> = {
    fragment: match.fragment,
    fragmentId: `F${match.fragment.index + 1}`,
    fragmentIndex,
    fragmentCount: result.matches.length,
    match,
    engine,
    winner,
    winnerSource,
    winnerSub,
    fragmentTokens,
    jaccard,
    semantic,
    cosine,
    ranking,
  };

  return {
    ...base,
    decision: {
      score: match.similarity,
      status: match.status,
      thresholds: engine.thresholds,
      rule: decisionRule(engine),
      summary: buildSummary(base, match.status),
      statusLabel: statusLabelOf(match.status),
    },
  };
}
