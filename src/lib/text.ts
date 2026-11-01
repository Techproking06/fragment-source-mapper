/* ------------------------------------------------------------------ *
 * Text utilities: normalisation, sentence fragmentation, stop-words,
 * and a compact Porter stemmer (used only by the illustrative engine).
 * ------------------------------------------------------------------ */

import type { JaccardDetail } from './types';

const STOPWORD_LIST = `
a about above after again against all am an and any are aren't as at be because been before being
below between both but by can cannot could couldn't did didn't do does doesn't doing don't down during
each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's
hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself
let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves
out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their
theirs them themselves then there there's these they they'd they'll they're they've this those through
to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's
where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're
you've your yours yourself yourselves also such as per via within without
`.trim().split(/\s+/);

export const STOPWORDS: Set<string> = new Set(STOPWORD_LIST);

/** "1 fragment" / "4 fragments" — counts in the UI must agree with their noun. */
export const plural = (n: number, word: string, suffix = 's'): string =>
  `${n} ${word}${n === 1 ? '' : suffix}`;

/* ---------------------------- stemming ---------------------------- */

const VOWEL = 'aeiou';

function isConsonant(w: string, i: number): boolean {
  const c = w[i];
  if (c === undefined) return false;
  if (VOWEL.includes(c)) return false;
  if (c === 'y') return i === 0 ? true : !isConsonant(w, i - 1);
  return true;
}

/** Porter measure: number of VC sequences in the stem. */
function measure(stem: string): number {
  const n = stem.length;
  let i = 0;
  while (i < n && isConsonant(stem, i)) i++;
  let m = 0;
  for (;;) {
    while (i < n && !isConsonant(stem, i)) i++;
    if (i >= n) break;
    while (i < n && isConsonant(stem, i)) i++;
    if (i >= n) break;
    m++;
  }
  return m;
}

function hasVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) if (!isConsonant(stem, i)) return true;
  return false;
}

function consDouble(w: string): boolean {
  const n = w.length;
  if (n < 2) return false;
  if (!isConsonant(w, n - 1)) return false;
  return w[n - 1] === w[n - 2];
}

function cvc(w: string): boolean {
  const n = w.length;
  if (n < 3) return false;
  const a = n - 3, b = n - 2, c = n - 1;
  if (!isConsonant(w, a)) return false;
  if (isConsonant(w, b)) return false;
  if (isConsonant(w, c)) return false;
  const last = w[c];
  if (last === 'w' || last === 'x' || last === 'y') return false;
  return true;
}

const STEP2: [string, string][] = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
  ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
  ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
  ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
  ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ['logi', 'log'],
];

const STEP3: [string, string][] = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
  ['ical', 'ic'], ['ful', ''], ['ness', ''],
];

const STEP4 = [
  'ement', 'ance', 'ence', 'able', 'ible', 'ment', 'ant', 'ent', 'ism',
  'ate', 'iti', 'ous', 'ive', 'ize', 'al', 'er', 'ic', 'ou', 'ion',
];

const stemCache = new Map<string, string>();

/** Compact Porter stemmer (steps 1–5). Deterministic, no dependencies. */
export function stem(word: string): string {
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;
  const original = word;
  let w = word;
  if (w.length < 4) {
    stemCache.set(original, w);
    return w;
  }

  // step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -3) + 'i';
  else if (w.endsWith('ss')) w = w;
  else if (w.endsWith('s') && w.length > 1) w = w.slice(0, -1);

  // step 1b
  if (w.endsWith('eed')) {
    const st = w.slice(0, -1);
    if (measure(st) > 0) w = st;
  } else if (w.endsWith('ed')) {
    const st = w.slice(0, -2);
    if (hasVowel(st)) {
      w = st;
      if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
      else if (consDouble(w) && !/(l|s|z)$/.test(w)) w = w.slice(0, -1);
    }
  } else if (w.endsWith('ing')) {
    const st = w.slice(0, -3);
    if (hasVowel(st)) {
      w = st;
      if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
      else if (consDouble(w) && !/(l|s|z)$/.test(w)) w = w.slice(0, -1);
    }
  }

  // step 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

  // step 2
  for (const [suf, rep] of STEP2) {
    if (w.endsWith(suf) && measure(w.slice(0, w.length - suf.length)) > 0) {
      w = w.slice(0, w.length - suf.length) + rep;
      break;
    }
  }

  // step 3
  for (const [suf, rep] of STEP3) {
    if (w.endsWith(suf) && measure(w.slice(0, w.length - suf.length)) > 0) {
      w = w.slice(0, w.length - suf.length) + rep;
      break;
    }
  }

  // step 4
  if (w.length > 2) {
    for (const suf of STEP4) {
      if (w.endsWith(suf)) {
        const st = w.slice(0, w.length - suf.length);
        if (measure(st) > 1 && (suf !== 'ion' || /[st]$/.test(st))) {
          w = st;
        }
        break;
      }
    }
  }

  // step 5
  if (w.endsWith('e')) {
    const st = w.slice(0, -1);
    const m = measure(st);
    if (m > 1 || (m === 1 && !/(at|bl|iz)$/.test(st))) w = st;
  } else if (w.endsWith('l') && w.length > 2) {
    const m = measure(w);
    if (m > 1 && cvc(w)) w = w.slice(0, -1);
  }

  stemCache.set(original, w);
  return w;
}

/* --------------------------- tokenisation --------------------------- */

/** Lower-case, strip punctuation/digits, drop stop-words, stem. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Jaccard index over stemmed token sets: |A ∩ B| / |A ∪ B|. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  small.forEach((t) => {
    if (large.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * The same computation as `jaccard()`, plus the actual sets behind it, so the
 * UI can show the intersection/union it is quoting. The score is produced by
 * the single `jaccard()` implementation — display and engine cannot diverge.
 */
export function jaccardDetail(tokensA: string[], tokensB: string[]): JaccardDetail {
  const a = new Set(tokensA);
  const b = new Set(tokensB);
  const intersection = [...a].filter((t) => b.has(t)).sort();
  const union = [...new Set([...a, ...b])].sort();
  const score = jaccard(a, b);

  const empty: JaccardDetail['empty'] =
    a.size === 0 && b.size === 0 ? 'both' : a.size === 0 ? 'a' : b.size === 0 ? 'b' : null;

  const note =
    empty === 'both'
      ? 'Both fragments reduced to no tokens after stop-word removal and stemming — the index is defined as 0.'
      : empty === 'a'
        ? 'The submitted fragment reduced to no tokens after stop-word removal and stemming — the index is defined as 0.'
        : empty === 'b'
          ? 'The source sub-fragment reduced to no tokens after stop-word removal and stemming — the index is defined as 0.'
          : null;

  return {
    tokensA: [...a].sort(),
    tokensB: [...b].sort(),
    intersection,
    union,
    countA: a.size,
    countB: b.size,
    countIntersection: intersection.length,
    countUnion: union.length,
    score,
    empty,
    note,
  };
}

/* -------------------------- fragmentation --------------------------- */

const MIN_FRAGMENT_CHARS = 34;

/**
 * Split a document into analysis fragments.
 * Sentences are the unit; a runt sentence is merged into the previous one so
 * every fragment is a meaningful piece of text.
 */
export function fragmentize(text: string): string[] {
  const paragraphs = text
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const para of paragraphs) {
    const parts = para
      .split(/(?<=[.!?])\s+(?=[“("'A-Z0-9])/g)
      .map((s) => s.trim())
      .filter(Boolean);
    sentences.push(...parts);
  }

  const merged: string[] = [];
  for (const s of sentences) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && s.length < MIN_FRAGMENT_CHARS && prev.length < 260) {
      merged[merged.length - 1] = `${prev} ${s}`;
    } else {
      merged.push(s);
    }
  }
  return merged.filter(Boolean);
}
