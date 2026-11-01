import type { Vector } from './similarity';

export type SourceId = 'A' | 'B' | 'C' | 'D';

export interface SourceDoc {
  id: SourceId;
  label: string;
  title: string;
  kind: string;
  meta: string;
  text: string;
}

export interface Fragment {
  /** stable id, e.g. "s2" for submitted, "A1" for source A fragment 1 */
  id: string;
  index: number;
  text: string;
}

/** A single candidate scoring between one submitted fragment and one source. */
export interface SourceScore {
  sourceId: SourceId;
  /** cosine similarity against this source's winning sub-fragment */
  similarity: number;
  /**
   * Jaccard word-overlap against the SAME sub-fragment that won on cosine,
   * so the lexical and semantic evidence always describe one pair of texts.
   */
  jaccard: number;
  /** index of the source sub-fragment that produced the best cosine */
  bestSourceFragment: number;
}

export type MatchStatus = 'strong' | 'possible' | 'none';

export interface MatchResult {
  fragment: Fragment;
  best: SourceScore | null;
  /** every source ranked by cosine, best first */
  scores: SourceScore[];
  similarity: number;
  jaccard: number;
  status: MatchStatus;
}

export type EngineMode = 'sbert' | 'illustrative';

/** Which engine actually produced a result, and the thresholds it used. */
export interface EngineInfo {
  /** engine that produced the scores */
  mode: EngineMode;
  /** engine the user selected */
  requested: EngineMode;
  /** true when genuine Sentence-BERT inference ran (false = TF-IDF fallback) */
  genuine: boolean;
  /** model label, e.g. "Xenova/all-MiniLM-L6-v2 · q8"; "" for the fallback */
  model: string;
  /** embedding dimensionality; null for the TF-IDF fallback */
  dims: number | null;
  thresholds: { strong: number; possible: number };
}

/** Full lexical detail of one Jaccard computation — real sets, no placeholders. */
export interface JaccardDetail {
  tokensA: string[];
  tokensB: string[];
  intersection: string[];
  union: string[];
  countA: number;
  countB: number;
  countIntersection: number;
  countUnion: number;
  score: number;
  /** which side has no tokens left after stop-word removal / stemming */
  empty: 'both' | 'a' | 'b' | null;
  note: string | null;
}

/** Full arithmetic of one cosine computation. */
export interface CosineDetail {
  /** raw dot product a · b */
  dot: number;
  /** ‖a‖ */
  normA: number;
  /** ‖b‖ */
  normB: number;
  /** unclamped dot / (‖a‖·‖b‖) */
  raw: number;
  /** value the engine reports (clamped to [0, 1]) */
  score: number;
  clamped: boolean;
}

export interface AnalysisResult {
  mode: EngineMode;
  engine: EngineInfo;
  submitted: Fragment[];
  matches: MatchResult[];
  /** distinct sources that appear as a best match (unmatched fragments excluded) */
  distinctSources: number;
  matchedFragments: number;
  originalFragments: number;
  /** highest cosine observed across the whole run */
  maxSimilarity: number;
  /**
   * Tokenised documents in one flat array: submitted fragments first (index
   * 0…n-1), then every source sub-fragment in SOURCES order. Offsets below.
   */
  tokens: string[][];
  /** index in `tokens` of the first sub-fragment of each source */
  sourceOffsets: Record<SourceId, number>;
  /** mean-pooled L2-normalised SBERT vectors, one per document (null on fallback) */
  dense: Float32Array[] | null;
  /** L2-normalised TF-IDF vectors, one per document (null when SBERT ran) */
  sparse: Vector[] | null;
}

export type EngineState = 'illustrative' | 'loading' | 'ready' | 'error';

export const SOURCE_ORDER: SourceId[] = ['A', 'B', 'C', 'D'];
