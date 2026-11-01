import { SOURCES } from '../data/sources';
import { TfIdf, cosineDense, cosineSparse } from './similarity';
import type { Vector } from './similarity';
import { embed, isReady, modelLabel } from './sbert';
import { fragmentize, jaccard, tokenize } from './text';
import type {
  AnalysisResult,
  EngineInfo,
  EngineMode,
  Fragment,
  MatchResult,
  MatchStatus,
  SourceId,
  SourceScore,
} from './types';

export type Stage = 'fragment' | 'jaccard' | 'sbert' | 'cosine' | 'map';

/**
 * The real order of computation, one node per rail step:
 * tokenisation + Jaccard happen BEFORE embeddings, cosine scoring decides the
 * ranking, and the map is the aggregation of those decisions.
 * Jaccard and SBERT are parallel evidence streams — cosine is what ranks and
 * classifies. Nothing here claims Jaccard feeds into SBERT or cosine.
 */
export const STAGES: { id: Stage; label: string }[] = [
  { id: 'fragment', label: 'Fragmentation' },
  { id: 'jaccard', label: 'Jaccard' },
  { id: 'sbert', label: 'SBERT' },
  { id: 'cosine', label: 'Cosine Similarity' },
  { id: 'map', label: 'Source Mapping' },
];

/**
 * Decision thresholds differ per engine because the two engines produce
 * differently calibrated cosine scores. Both are documented in the UI.
 */
export const THRESHOLDS: Record<EngineMode, { strong: number; possible: number }> = {
  sbert: { strong: 0.7, possible: 0.52 },
  illustrative: { strong: 0.6, possible: 0.4 },
};

export function statusFor(mode: EngineMode, sim: number): MatchStatus {
  const t = THRESHOLDS[mode];
  if (sim >= t.strong) return 'strong';
  if (sim >= t.possible) return 'possible';
  return 'none';
}

/**
 * Let React paint the stage we just announced. This is a frame yield, not a
 * fake delay: no computation is ever padded to look longer than it is.
 */
const yieldToPaint = (): Promise<void> =>
  typeof requestAnimationFrame === 'function'
    ? new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    : Promise.resolve();

function toFragments(prefix: string, texts: string[]): Fragment[] {
  return texts.map((text, index) => ({ id: `${prefix}${index + 1}`, index, text }));
}

export interface AnalyzeOptions {
  submittedText: string;
  mode: EngineMode;
  onStage?: (stage: Stage) => void;
  /** skip the frame yields (used by tests / re-runs) */
  instant?: boolean;
}

export async function analyze({
  submittedText,
  mode,
  onStage,
  instant,
}: AnalyzeOptions): Promise<AnalysisResult> {
  const step = async (stage: Stage) => {
    onStage?.(stage);
    if (!instant) await yieldToPaint();
  };

  /* 1 — fragmentation -------------------------------------------------- */
  await step('fragment');
  const submitted = toFragments('s', fragmentize(submittedText));
  const sourceFragments = new Map<SourceId, Fragment[]>();
  for (const src of SOURCES) {
    sourceFragments.set(src.id, toFragments(src.id, fragmentize(src.text)));
  }
  const allSourceFragments = SOURCES.flatMap((s) => sourceFragments.get(s.id)!);
  const docs = [
    ...submitted.map((f) => f.text),
    ...allSourceFragments.map((f) => f.text),
  ];
  const nSubmitted = submitted.length;

  const sourceOffsets = {} as Record<SourceId, number>;
  {
    let cursor = nSubmitted;
    for (const src of SOURCES) {
      sourceOffsets[src.id] = cursor;
      cursor += sourceFragments.get(src.id)!.length;
    }
  }

  /* 2 — tokenisation + the Jaccard matrix --------------------------------
   * Every submitted fragment is tokenised once and compared lexically with
   * every source sub-fragment: stopwords removed, Porter stemming applied.
   * The scores are later read at the sub-fragment cosine selected, so the
   * lexical and the semantic evidence always describe the same text pair. */
  await step('jaccard');
  const tokens = docs.map(tokenize);
  const tokenSets = tokens.map((t) => new Set(t));
  const nDocs = docs.length;
  const jaccardMatrix: number[][] = [];
  for (let i = 0; i < nSubmitted; i++) {
    const row = new Array<number>(nDocs).fill(0);
    for (let d = nSubmitted; d < nDocs; d++) row[d] = jaccard(tokenSets[i], tokenSets[d]);
    jaccardMatrix.push(row);
  }

  /* 3 — embeddings ------------------------------------------------------ */
  await step('sbert');
  const useSbert = mode === 'sbert' && isReady();
  const engineMode: EngineMode = useSbert ? 'sbert' : 'illustrative';

  let dense: Float32Array[] | null = null;
  let sparse: Vector[] | null = null;
  let sim: (qi: number, di: number) => number;

  if (nDocs === 0) {
    dense = [];
    sparse = [];
    sim = () => 0;
  } else if (useSbert) {
    dense = await embed(docs);
    sim = (qi, di) => cosineDense(dense![qi], dense![di]);
  } else {
    const tfidf = new TfIdf(tokens);
    sparse = tokens.map((t) => tfidf.vector(t));
    sim = (qi, di) => cosineSparse(sparse![qi], sparse![di]);
  }

  const engine: EngineInfo = {
    mode: engineMode,
    requested: mode,
    genuine: useSbert,
    model: useSbert ? modelLabel || 'all-MiniLM-L6-v2' : 'TF-IDF + Porter stemmer (local heuristic)',
    dims: dense && dense.length > 0 && useSbert ? dense[0].length : null,
    thresholds: THRESHOLDS[engineMode],
  };

  /* 4 — per-fragment cosine against every source -------------------------- */
  await step('cosine');
  const matches: MatchResult[] = [];
  let maxSimilarity = 0;

  for (let i = 0; i < nSubmitted; i++) {
    const scores: SourceScore[] = [];

    SOURCES.forEach((src) => {
      const frags = sourceFragments.get(src.id)!;
      const base = sourceOffsets[src.id];
      let bestSim = -1;
      let bestIdx = -1;
      for (let k = 0; k < frags.length; k++) {
        const s = sim(i, base + k);
        if (s > bestSim) {
          bestSim = s;
          bestIdx = k;
        }
      }
      if (bestIdx < 0) {
        scores.push({ sourceId: src.id, similarity: 0, jaccard: 0, bestSourceFragment: -1 });
        return;
      }
      scores.push({
        sourceId: src.id,
        similarity: Math.max(0, bestSim),
        // same sub-fragment that won on cosine — never a different one
        jaccard: jaccardMatrix[i][base + bestIdx],
        bestSourceFragment: bestIdx,
      });
    });

    const ranked = [...scores].sort((a, b) => b.similarity - a.similarity);
    const best = ranked[0] ?? null;
    const similarity = best ? best.similarity : 0;
    if (similarity > maxSimilarity) maxSimilarity = similarity;

    matches.push({
      fragment: submitted[i],
      best,
      scores: ranked,
      similarity,
      jaccard: best ? best.jaccard : 0,
      status: statusFor(engineMode, similarity),
    });
  }

  /* 5 — aggregate into the source map ----------------------------------- */
  await step('map');
  const matched = matches.filter((m) => m.status !== 'none');
  const distinctSources = new Set(matched.map((m) => m.best!.sourceId)).size;

  return {
    mode: engineMode,
    engine,
    submitted,
    matches,
    distinctSources,
    matchedFragments: matched.length,
    originalFragments: matches.length - matched.length,
    maxSimilarity,
    tokens,
    sourceOffsets,
    dense,
    sparse,
  };
}

/** Fragments that belong to a given source, for source-card highlighting. */
export function fragmentsForSource(
  result: AnalysisResult,
  sourceId: SourceId,
): MatchResult[] {
  return result.matches.filter((m) => m.status !== 'none' && m.best?.sourceId === sourceId);
}
