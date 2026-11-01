/* ------------------------------------------------------------------ *
 * Calculation & ranking assertions for the real engine modules.
 *
 *   node --test test/calc.test.mjs      (or: npm run test:calc)
 *
 * The TypeScript sources are loaded through Vite's SSR loader, so these
 * tests exercise the exact code the browser runs — no duplicated logic.
 * The SBERT path cannot run in Node (ONNX/WASM), so it is covered by the
 * Playwright test in browser.mjs; everything here uses the illustrative
 * engine plus the pure maths functions.
 * ------------------------------------------------------------------ */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server;
const load = (p) => server.ssrLoadModule(p);

before(async () => {
  server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
});

after(async () => {
  await server?.close();
});

/* ------------------------------ text ------------------------------ */

describe('tokenisation, fragmentation, Jaccard', () => {
  test('tokenize strips stopwords, lower-cases and stems', async () => {
    const { tokenize, STOPWORDS } = await load('/src/lib/text.ts');
    const toks = tokenize('The grids are running, and the batteries were running!');
    assert.ok(toks.length > 0, 'expected tokens');
    for (const t of toks) {
      assert.equal(t, t.toLowerCase(), 'tokens are lower-case');
      assert.ok(!STOPWORDS.has(t), `stopword survived: ${t}`);
    }
    assert.ok(toks.includes('grid'), `expected stem "grid", got ${JSON.stringify(toks)}`);
    assert.ok(toks.every((t) => t === 'run' || t.length > 1), 'runn/run retained');
  });

  test('fragmentize splits sentences and merges runt sentences', async () => {
    const { fragmentize } = await load('/src/lib/text.ts');
    const frags = fragmentize('One full sentence goes here with enough characters to stand alone. Short. Another sentence long enough to stand on its own is here.');
    assert.equal(frags.length, 2, `expected 2 fragments, got ${frags.length}: ${JSON.stringify(frags)}`);
    assert.ok(frags[0].includes('Short.'), 'runt sentence merged into the previous fragment');
  });

  test('jaccard matches the textbook definition', async () => {
    const { jaccard } = await load('/src/lib/text.ts');
    assert.equal(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])), 0.5);
    assert.equal(jaccard(new Set(['a']), new Set(['a'])), 1);
    assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0);
    assert.equal(jaccard(new Set(), new Set()), 0, 'both empty → 0');
  });

  test('jaccardDetail uses the same score and reports its real sets', async () => {
    const { jaccard, jaccardDetail, tokenize } = await load('/src/lib/text.ts');
    const a = tokenize('renewable energy sources reduce emissions');
    const b = tokenize('clean energy sources reduce pollution');
    const d = jaccardDetail(a, b);
    assert.equal(d.score, jaccard(new Set(a), new Set(b)), 'detail score === engine score');
    assert.equal(d.countIntersection, d.intersection.length);
    assert.equal(d.countUnion, new Set([...a, ...b]).size);
    assert.equal(d.countA + d.countB - d.countIntersection, d.countUnion);
    assert.ok(d.score >= 0 && d.score <= 1);
  });

  test('jaccardDetail handles empty sets safely', async () => {
    const { jaccardDetail } = await load('/src/lib/text.ts');
    const both = jaccardDetail([], []);
    assert.equal(both.score, 0);
    assert.equal(both.empty, 'both');
    assert.match(both.note, /Both fragments/);

    const one = jaccardDetail([], ['grid']);
    assert.equal(one.score, 0);
    assert.equal(one.empty, 'a');
    assert.equal(one.countUnion, 1);
  });

  test('Porter step 2 removes the suffix instead of truncating the word', async () => {
    const { stem } = await load('/src/lib/text.ts');
    // Regression, verified against the pre-fix snapshot: step 2 used to slice
    // from the FRONT of the word, so organization -> "orgaize",
    // organizational -> "orgaate", relational -> "relaate", evaluation ->
    // "evaluat". (generation/regulation/calibration were already correct
    // because their truncated prefix had measure 0 and step 4 caught them.)
    // ("calibrat" rather than classic Porter's "calibr": step 4 then step 5 run
    //  with this project's compact measure(), which undercounts by one on
    //  consonant-final stems — conservative, documented in problems.txt.)
    assert.equal(stem('generation'), 'generat');
    assert.equal(stem('organization'), 'organiz');
    assert.equal(stem('organizational'), 'organiz');
    assert.equal(stem('regulation'), 'regulat');
    assert.equal(stem('calibration'), 'calibrat');
    assert.equal(stem('evaluation'), 'evalu');
    assert.equal(stem('electrical'), 'electric');
  });

  test('Porter step 2 merges the word families it is meant to merge', async () => {
    const { stem } = await load('/src/lib/text.ts');
    assert.equal(stem('generate'), stem('generation'), 'generate / generation');
    assert.equal(stem('organize'), stem('organization'), 'organize / organization');
    assert.equal(stem('organize'), stem('organizational'), 'organize / organizational');
    assert.equal(stem('evaluate'), stem('evaluation'), 'evaluate / evaluation');
    assert.equal(stem('calibrate'), stem('calibration'), 'calibrate / calibration');
    assert.equal(stem('electricity'), stem('electrical'), 'electricity / electrical');
  });

  test('Porter step 2 keeps its measure guard', async () => {
    const { stem } = await load('/src/lib/text.ts');
    // "st" before "ation" has measure 0, so the classic rule must not fire.
    assert.equal(stem('station'), 'station');
  });
});

/* ------------------------------ cosine ---------------------------- */

describe('cosine similarity', () => {
  test('cosineDense: identical, orthogonal, and manual arithmetic', async () => {
    const { cosineDense, cosineDenseDetail } = await load('/src/lib/similarity.ts');
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    assert.equal(cosineDense(a, a), 1);
    assert.equal(cosineDense(a, b), 0);

    const u = new Float32Array([1, 2, 3]);
    const v = new Float32Array([4, 5, 6]);
    const manual = (1 * 4 + 2 * 5 + 3 * 6) / (Math.hypot(1, 2, 3) * Math.hypot(4, 5, 6));
    assert.ok(Math.abs(cosineDense(u, v) - manual) < 1e-6, 'matches manual dot/(‖a‖‖b‖)');

    const d = cosineDenseDetail(u, v);
    assert.ok(Math.abs(d.raw - d.dot / (d.normA * d.normB)) < 1e-9, 'detail arithmetic is consistent');
    assert.equal(d.score, Math.max(0, Math.min(1, d.raw)));
    assert.ok(Math.abs(cosineDense(u, v) - cosineDense(v, u)) < 1e-9, 'symmetric');
  });

  test('TF-IDF cosine stays in [0,1] and is symmetric', async () => {
    const { TfIdf } = await load('/src/lib/similarity.ts');
    const { tokenize } = await load('/src/lib/text.ts');
    const docs = [tokenize('wind and solar power'), tokenize('solar panels produce power'), tokenize('urban air sensors')];
    const tf = new TfIdf(docs);
    const vecs = docs.map((t) => tf.vector(t));
    for (const x of vecs) {
      for (const y of vecs) {
        const c = TfIdf.cosine(x, y);
        assert.ok(c >= 0 && c <= 1, `out of range: ${c}`);
        assert.equal(c, TfIdf.cosine(y, x), 'symmetric');
      }
    }
    assert.ok(TfIdf.cosine(vecs[0], vecs[0]) > 0.99, 'self-similarity ≈ 1');
  });
});

/* ------------------------- synonym expansion ---------------------- */

describe('illustrative engine — synonym expansion after the normalisation fix', () => {
  let tokenize, stem, TfIdf, PARAPHRASE_GROUPS, STOPWORDS, tf, canonicalSpace;

  before(async () => {
    ({ tokenize, stem, STOPWORDS } = await load('/src/lib/text.ts'));
    ({ TfIdf } = await load('/src/lib/similarity.ts'));
    ({ PARAPHRASE_GROUPS } = await load('/src/lib/lexicon.ts'));
    tf = new TfIdf([tokenize('renewable energy urban air machine learning carbon price grid storage')]);
    canonicalSpace = new Set();
    for (const g of PARAPHRASE_GROUPS) for (const w of g) for (const t of tokenize(w)) canonicalSpace.add(t);
  });

  test('entries that were dead before the fix now expand', async () => {
    // Surface form ≠ stem, so the old punctuation-only keys never matched.
    for (const [word, sibling] of [
      ['renewable', 'clean'],
      ['city', 'urban'],
      ['electricity', 'power'],
      ['greenhouse', 'carbon'],
      ['emission', 'pollute'],
    ]) {
      const keys = [...tf.vector(tokenize(word)).m.keys()];
      const target = stem(sibling);
      assert.ok(keys.includes(target), `"${word}" must expand to "${sibling}" (${target}); got ${keys.join(', ')}`);
    }
  });

  test('every lexicon member activates at least one sibling', async () => {
    let members = 0;
    for (const group of PARAPHRASE_GROUPS) {
      const distinct = [...new Set(group.flatMap((w) => tokenize(w)))];
      for (const w of group) {
        members++;
        const own = tokenize(w);
        assert.ok(own.length > 0, `member "${w}" must tokenise to something`);
        const aliases = [...tf.vector(own).m.keys()].filter((k) => !own.includes(k));
        if (distinct.length > 1) {
          assert.ok(aliases.length > 0, `member "${w}" expanded to no sibling`);
        }
      }
    }
    assert.ok(members >= 200, `expected the full lexicon, saw ${members} members`);
  });

  test('expansion only ever injects canonical tokens, never stop-words', async () => {
    for (const w of ['renewable', 'city', 'urban', 'carbon', 'price']) {
      const vec = tf.vector(tokenize(w));
      for (const k of vec.m.keys()) {
        assert.ok(canonicalSpace.has(k), `alias outside the lexicon's canonical space: ${k}`);
        assert.ok(!STOPWORDS.has(k), `stop-word injected: ${k}`);
      }
    }
  });

  test('unrelated words gain nothing and nothing self-expands', async () => {
    const vec = tf.vector(['zzznotaword']);
    assert.deepEqual([...vec.m.keys()], ['zzznotaword']);
    for (const w of ['wind', 'solar', 'grid', 'carbon']) {
      const own = tokenize(w);
      const keys = [...tf.vector(own).m.keys()];
      assert.equal(new Set(keys).size, keys.length, 'no duplicate keys');
      for (const k of own) assert.ok(keys.includes(k), 'own term retained');
    }
  });
});

/* ---------------------------- thresholds -------------------------- */

describe('threshold classification', () => {
  test('statusFor uses the documented per-engine thresholds', async () => {
    const { statusFor, THRESHOLDS } = await load('/src/lib/engine.ts');
    assert.deepEqual(THRESHOLDS.sbert, { strong: 0.7, possible: 0.52 });
    assert.deepEqual(THRESHOLDS.illustrative, { strong: 0.6, possible: 0.4 });

    assert.equal(statusFor('sbert', 0.9), 'strong');
    assert.equal(statusFor('sbert', 0.7), 'strong');
    assert.equal(statusFor('sbert', 0.6999), 'possible');
    assert.equal(statusFor('sbert', 0.52), 'possible');
    assert.equal(statusFor('sbert', 0.5199), 'none');

    assert.equal(statusFor('illustrative', 0.6), 'strong');
    assert.equal(statusFor('illustrative', 0.5999), 'possible');
    assert.equal(statusFor('illustrative', 0.4), 'possible');
    assert.equal(statusFor('illustrative', 0.3999), 'none');
  });
});

/* ------------------------------ engine ---------------------------- */

describe('analyze() — real pipeline', () => {
  let DEMOS, analyze, THRESHOLDS, jaccardDetail, buildTrace, SOURCES;

  before(async () => {
    ({ DEMOS } = await load('/src/data/demos.ts'));
    ({ SOURCES } = await load('/src/data/sources.ts'));
    ({ analyze, THRESHOLDS } = await load('/src/lib/engine.ts'));
    ({ jaccardDetail } = await load('/src/lib/text.ts'));
    ({ buildTrace } = await load('/src/lib/trace.ts'));
  });

  const results = new Map();
  const run = async (id) => {
    if (!results.has(id)) {
      const d = DEMOS.find((x) => x.id === id);
      results.set(id, await analyze({ submittedText: d.text, mode: 'illustrative', instant: true }));
    }
    return results.get(id);
  };

  test('empty input produces an empty, valid result', async () => {
    const r = await analyze({ submittedText: '', mode: 'illustrative', instant: true });
    assert.equal(r.matches.length, 0);
    assert.equal(r.matchedFragments, 0);
    assert.equal(r.engine.mode, 'illustrative');
    assert.equal(buildTrace(r, 0), null);
  });

  test('whitespace-only input is handled', async () => {
    const r = await analyze({ submittedText: '   \n\n  ', mode: 'illustrative', instant: true });
    assert.equal(r.matches.length, 0);
  });

  test('ranking is sorted and the winner is the top cosine', async () => {
    for (const d of DEMOS) {
      const r = await run(d.id);
      assert.equal(r.matches.length, 6, `${d.id}: expected 6 fragments`);
      for (const m of r.matches) {
        assert.equal(m.scores.length, SOURCES.length, `${d.id}: one score per source`);
        for (let i = 1; i < m.scores.length; i++) {
          assert.ok(
            m.scores[i - 1].similarity >= m.scores[i].similarity,
            `${d.id}: scores must be sorted descending`,
          );
        }
        assert.equal(m.best.sourceId, m.scores[0].sourceId, 'best === top-ranked source');
        assert.equal(m.similarity, m.best.similarity, 'fragment score === winning source score');
        assert.equal(m.status !== 'none', m.similarity >= THRESHOLDS.illustrative.possible);
        assert.equal(
          m.status === 'strong',
          m.similarity >= THRESHOLDS.illustrative.strong,
        );
      }
    }
  });

  test('Jaccard is computed on the cosine-winning sub-fragment', async () => {
    for (const d of DEMOS) {
      const r = await run(d.id);
      r.matches.forEach((m, i) => {
        for (const s of m.scores) {
          assert.ok(s.bestSourceFragment >= 0, `${d.id}: sub-fragment index recorded`);
          const abs = r.sourceOffsets[s.sourceId] + s.bestSourceFragment;
          const expected = jaccardDetail(r.tokens[i], r.tokens[abs]).score;
          assert.equal(
            s.jaccard,
            expected,
            `${d.id}: F${i + 1} vs ${s.sourceId}${s.bestSourceFragment + 1} — Jaccard must belong to the same sub-fragment as the cosine`,
          );
        }
        assert.equal(m.jaccard, m.best.jaccard, 'fragment Jaccard === winning source Jaccard');
      });
    }
  });

  test('trace panel numbers agree with the results table', async () => {
    for (const d of DEMOS) {
      const r = await run(d.id);
      r.matches.forEach((_, i) => {
        const t = buildTrace(r, i);
        const m = r.matches[i];
        assert.ok(t, `${d.id}: trace built`);
        assert.equal(t.decision.score, m.similarity, 'decision score === table score');
        assert.equal(t.decision.status, m.status, 'decision status === table status');
        assert.equal(t.winner?.sourceId ?? null, m.best?.sourceId ?? null, 'winner matches');
        if (m.best && m.best.bestSourceFragment >= 0) {
          assert.equal(t.jaccard?.score, m.jaccard, 'trace Jaccard === table Jaccard');
          assert.equal(t.cosine?.score, m.similarity, 'trace cosine === table cosine');
          assert.equal(t.winnerSub?.index, m.best.bestSourceFragment, 'trace § index === table § index');
        }
        assert.equal(t.ranking.length, SOURCES.length);
        t.ranking.forEach((row, k) => {
          assert.equal(row.rank, k + 1, 'ranks are 1..n in cosine order');
          assert.equal(row.cosine, m.scores[k].similarity, 'ranking cosine === engine cosine');
          assert.equal(row.jaccard, m.scores[k].jaccard, 'ranking Jaccard === engine Jaccard');
        });
        assert.equal(t.ranking[0].winner, true, 'rank 1 is highlighted');
        assert.equal(t.ranking.filter((x) => x.winner).length, m.best ? 1 : 0);
        assert.match(t.decision.rule, /cosine ≥/, 'rule states the real thresholds');
        assert.ok(t.decision.summary.length > 40, 'summary is generated');
        assert.ok(
          t.decision.summary.includes(t.decision.score.toFixed(2)),
          'summary quotes this fragment’s real score',
        );
        assert.ok(
          t.decision.summary.includes(t.decision.thresholds.strong.toFixed(2)) ||
            t.decision.summary.includes(t.decision.thresholds.possible.toFixed(2)),
          'summary quotes this engine’s real threshold',
        );
      });
    }
  });

  test('declared demo expectations vs actual mapping (live PASS/FAIL)', async () => {
    const report = [];
    const passById = {};
    for (const d of DEMOS) {
      const r = await run(d.id);
      const actual = r.matches.map((m) => (m.status !== 'none' && m.best ? m.best.sourceId : null));
      const pass = actual.length === d.expectation.length && actual.every((v, i) => v === d.expectation[i]);
      passById[d.id] = pass;
      report.push(
        `  ${d.id.padEnd(10)} expected=${d.expectation.map((c) => c ?? '-').join(',')}` +
          ` actual=${actual.map((c) => c ?? '-').join(',')} ${pass ? 'PASS' : 'FAIL'}`,
      );
    }
    console.log(`\n  illustrative (fallback) engine:\n${report.join('\n')}\n`);

    // Flagship case: the whole project is about this mapping, so it must hold.
    assert.equal(passById.patchwork, true, `patchwork must map A,C,A,B,D,C — ${report.join(' | ')}`);

    // Threshold behaviour: original writing must stay unmatched (no false hits).
    const orig = await run('original');
    assert.equal(orig.matches[1].status, 'none', 'original fragment 2 stays unmatched');
    assert.equal(orig.matches[2].status, 'none', 'original fragment 3 stays unmatched');
    assert.equal(orig.matches[4].status, 'none', 'original fragment 5 stays unmatched');
    assert.equal(orig.matches[5].status, 'none', 'original fragment 6 stays unmatched');
    assert.equal(orig.matches[0].best.sourceId, 'B');
    assert.equal(orig.matches[3].best.sourceId, 'D');

    // The two fallback misses (`single` F5, `paraphrased` F5) are the known
    // TF-IDF limitation documented in the README, reported honestly by the
    // validation panel — not silently patched. The SBERT engine covers them
    // and is asserted in test/browser.mjs against the real model.
  });

  test('validation runner reports honest results for every demo', async () => {
    const { runValidation, cellsEqual } = await load('/src/lib/validate.ts');
    const v = await runValidation('illustrative');
    assert.equal(v.total, DEMOS.length, 'one case per demo');
    assert.equal(v.cases.length, DEMOS.length);
    for (const c of v.cases) {
      assert.equal(c.pass, cellsEqual(c.actual, c.expected), `${c.id}: pass flag reflects reality`);
      assert.equal(c.error, undefined, `${c.id}: no engine error`);
      assert.equal(c.engine.mode, 'illustrative');
      assert.equal(c.scores.length, c.expected.length, 'one score per fragment');
    }
    assert.equal(v.allPassed, v.cases.every((c) => c.pass));
  });
});
