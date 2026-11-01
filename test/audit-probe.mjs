/* Audit probe for the HOD review — read-only inspection of engine internals.
 *
 *   node test/audit-probe.mjs
 *
 * Verifies the two fixes made after the first audit:
 *   1. lexicon entries are canonicalised with the same tokenizer the documents
 *      use, so every synonym entry activates;
 *   2. the Porter stemmer's step 2 removes the suffix instead of truncating
 *      from the front of the word (verified pre-fix: organization -> "orgaize",
 *      organizational -> "orgaate", relational -> "relaate"; post-fix they are
 *      organiz / organiz / relation).
 * Also reports the sparse-vector norms the cosine denominator uses.
 * Loads the real TypeScript via Vite SSR, same as calc.test.mjs.
 */

import { createServer } from 'vite';

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'silent',
});

let failures = 0;
const check = (ok, line) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${line}`);
};

try {
  const { stem, tokenize, STOPWORDS } = await server.ssrLoadModule('/src/lib/text.ts');
  const { TfIdf } = await server.ssrLoadModule('/src/lib/similarity.ts');
  const { PARAPHRASE_GROUPS } = await server.ssrLoadModule('/src/lib/lexicon.ts');

  console.log('--- stemmer: step-2 suffix removal ----------------------------');
  const STEMS = [
    ['generation', 'generat'],
    ['generate', 'generat'],
    ['organization', 'organiz'],
    ['organizational', 'organiz'],
    ['calibration', 'calibrat'], // classic Porter: "calibr" — this project's measure() undercounts (documented)
    ['calibrate', 'calibrat'],
    ['evaluation', 'evalu'],
    ['relational', 'relation'], // pre-fix: "relaate"
    ['electrical', 'electric'],
    ['electricity', 'electric'],
    ['station', 'station'], // measure guard: pre-suffix stem "st" has measure 0
  ];
  for (const [word, expected] of STEMS) {
    const got = stem(word);
    check(got === expected, `${word.padEnd(16)} -> ${got.padEnd(12)} (expected ${expected})`);
  }

  console.log('--- synonym expansion: every lexicon entry activates ----------');
  const tf = new TfIdf([tokenize('renewable energy urban air machine learning carbon price grid storage')]);
  const canonicalSpace = new Set();
  for (const g of PARAPHRASE_GROUPS) for (const w of g) for (const t of tokenize(w)) canonicalSpace.add(t);

  let members = 0;
  let dead = 0;
  let nonCanonical = 0;
  for (const group of PARAPHRASE_GROUPS) {
    const distinct = [...new Set(group.flatMap((w) => tokenize(w)))];
    for (const w of group) {
      members++;
      const own = tokenize(w);
      if (own.length === 0) {
        dead++;
        console.log(`  dead entry (tokenises to nothing): ${w}`);
        continue;
      }
      const keys = [...tf.vector(own).m.keys()];
      const aliases = keys.filter((k) => !own.includes(k));
      for (const k of keys) if (!canonicalSpace.has(k)) nonCanonical++;
      if (distinct.length > 1 && aliases.length === 0) {
        dead++;
        console.log(`  entry with no siblings firing: ${w}`);
      }
    }
  }
  check(dead === 0, `${members - dead}/${members} lexicon members activate at least one sibling`);
  check(nonCanonical === 0, `no vector key outside the canonical token space (${nonCanonical} leaks)`);

  console.log('--- previously dead entries, spot-checked ---------------------');
  for (const [word, sibling] of [
    ['renewable', 'clean'],
    ['city', 'urban'],
    ['electricity', 'power'],
    ['greenhouse', 'carbon'],
  ]) {
    const keys = [...tf.vector(tokenize(word)).m.keys()];
    const target = tokenize(sibling)[0];
    check(keys.includes(target), `"${word}" expands to "${sibling}" (${target})`);
  }

  console.log('--- unaffected cases ------------------------------------------');
  const plain = [...tf.vector(['zzznotaword']).m.keys()];
  check(plain.length === 1 && plain[0] === 'zzznotaword', 'a word outside the lexicon gains no aliases');
  const stop = new Set([...STOPWORDS]);
  const leaked = [...tf.vector(tokenize('renewable')).m.keys()].filter((k) => stop.has(k));
  check(leaked.length === 0, 'expansion never injects a stop-word');

  console.log('--- sparse vector norms (cosine denominator) ------------------');
  const v = tf.vector(tokenize('renewable energy'));
  let s = 0;
  for (const x of v.m.values()) s += x * x;
  check(Math.abs(Math.sqrt(s) - 1) < 1e-9, `||v|| = ${Math.sqrt(s).toFixed(6)} (vectors are L2-normalised at build time)`);

  console.log(`\n${failures === 0 ? 'ALL PROBES PASS' : `${failures} PROBE(S) FAILED`}`);
} finally {
  await server.close();
}
