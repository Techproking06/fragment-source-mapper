/* ------------------------------------------------------------------ *
 * Illustrative similarity engine.
 *
 * TF-IDF vectors over stemmed tokens, plus reduced-weight synonym
 * expansion from ./lexicon.ts. Everything here is arithmetic the UI can
 * explain line by line — it is a transparent stand-in, not a language model.
 * ------------------------------------------------------------------ */

import { PARAPHRASE_GROUPS } from './lexicon';
import { tokenize } from './text';
import type { CosineDetail } from './types';

export interface Vector {
  /** term -> weight, L2-normalised */
  m: Map<string, number>;
}

/** term -> sibling terms from the paraphrase lexicon */
const EXPANSION = new Map<string, string[]>();
for (const group of PARAPHRASE_GROUPS) {
  /* Members are canonicalised with the same tokenizer every document goes
     through (lower-case → punctuation strip → stop-words → Porter stem), so a
     key can only ever be a token the engine actually produces, and the alias
     terms it injects live in that same stem space. */
  const canonical: string[] = [];
  for (const w of group) {
    for (const k of tokenize(w)) if (!canonical.includes(k)) canonical.push(k);
  }
  for (const w of canonical) {
    const existing = EXPANSION.get(w) ?? [];
    for (const s of canonical) if (s !== w && !existing.includes(s)) existing.push(s);
    EXPANSION.set(w, existing);
  }
}

const EXPANSION_WEIGHT = 0.55;

export class TfIdf {
  private df = new Map<string, number>();
  constructor(private docs: string[][]) {
    for (const doc of docs) {
      for (const t of new Set(doc)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
  }

  idf(term: string): number {
    const n = this.docs.length || 1;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + n / (1 + df));
  }

  /** Weighted, L2-normalised TF-IDF vector with synonym expansion applied. */
  vector(tokens: string[], expand = true): Vector {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    const w = new Map<string, number>();
    const add = (term: string, weight: number) =>
      w.set(term, (w.get(term) ?? 0) + weight);

    for (const [term, count] of tf) {
      const tfw = 1 + Math.log(count);
      add(term, tfw * this.idf(term));
      if (!expand) continue;
      for (const sib of EXPANSION.get(term) ?? []) {
        add(sib, tfw * this.idf(sib) * EXPANSION_WEIGHT);
      }
    }

    let norm = 0;
    for (const v of w.values()) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (const [k, v] of w) w.set(k, v / norm);
    return { m: w };
  }

  /** Cosine between two normalised sparse vectors. */
  static cosine(a: Vector, b: Vector): number {
    return cosineSparseDetail(a, b).score;
  }
}

export function cosineDense(a: Float32Array, b: Float32Array): number {
  return cosineDenseDetail(a, b).score;
}

/**
 * Cosine between two dense vectors plus the arithmetic behind it.
 * Uses exactly the same summation order as `cosineDense`, so the number shown
 * in the UI is the number the engine used.
 */
export function cosineDenseDetail(a: Float32Array, b: Float32Array): CosineDetail {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) {
    return { dot, normA: 0, normB: 0, raw: 0, score: 0, clamped: false };
  }
  const normA = Math.sqrt(na);
  const normB = Math.sqrt(nb);
  const raw = dot / (normA * normB);
  const score = Math.max(0, Math.min(1, raw));
  return { dot, normA, normB, raw, score, clamped: score !== raw };
}

/** Cosine between two normalised sparse vectors. */
export function cosineSparse(a: Vector, b: Vector): number {
  return cosineSparseDetail(a, b).score;
}

/** Sparse cosine plus the dot product and both L2 norms, for the trace panel. */
export function cosineSparseDetail(a: Vector, b: Vector): CosineDetail {
  const normOf = (v: Vector) => {
    let s = 0;
    for (const w of v.m.values()) s += w * w;
    return Math.sqrt(s);
  };
  const [small, large] = a.m.size <= b.m.size ? [a.m, b.m] : [b.m, a.m];
  let dot = 0;
  for (const [k, v] of small) {
    const other = large.get(k);
    if (other !== undefined) dot += v * other;
  }
  const normA = normOf(a);
  const normB = normOf(b);
  const raw = normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
  const score = Math.max(0, Math.min(1, raw));
  return { dot, normA, normB, raw, score, clamped: score !== raw };
}

/** Highest-weighted terms of a TF-IDF vector — the fallback engine's "preview". */
export function topTerms(v: Vector, n: number): { term: string; weight: number }[] {
  return [...v.m.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([term, weight]) => ({ term, weight }));
}

export { tokenize };
