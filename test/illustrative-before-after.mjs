/* Illustrative-engine before/after — evidence for the HOD review.
 *
 *   node test/illustrative-before-after.mjs
 *
 * Recomputes all four demos twice:
 *   "before" — the pre-fix snapshot in backups/20261018-010802 (its src/lib
 *              text.ts + similarity.ts differ from the current tree only by
 *              the two fixes: Porter step-2 slice, lexicon canonicalisation);
 *   "after"  — the current tree.
 * Read-only. The snapshot is not part of the shipped review package.
 */

import { createServer } from 'vite';

const TREES = [
  ['before', 'backups/20261018-010802'],
  ['after', '.'],
];

const runs = {};
for (const [label, root] of TREES) {
  const server = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { analyze } = await server.ssrLoadModule('/src/lib/engine.ts');
    const { DEMOS } = await server.ssrLoadModule('/src/data/demos.ts');
    runs[label] = [];
    for (const d of DEMOS) {
      const r = await analyze({ submittedText: d.text, mode: 'illustrative', instant: true });
      runs[label].push({
        id: d.id,
        frags: r.matches.map((m) => ({
          cos: m.best?.similarity ?? 0,
          src: m.status !== 'none' && m.best ? m.best.sourceId : null,
        })),
      });
    }
  } finally {
    await server.close();
  }
}

const fmt = (x) => x.toFixed(3);
let cosChanged = 0;
let cosSame = 0;
let decisionChanged = 0;
const rows = [];

for (let i = 0; i < runs.before.length; i++) {
  const b = runs.before[i];
  const a = runs.after[i];
  for (let j = 0; j < b.frags.length; j++) {
    const bf = b.frags[j];
    const af = a.frags[j];
    const same = Math.abs(bf.cos - af.cos) < 5e-4;
    if (same) cosSame++;
    else cosChanged++;
    if (bf.src !== af.src) decisionChanged++;
    rows.push(
      `  ${b.id.padEnd(11)} F${j + 1}  ${fmt(bf.cos)} ${(bf.src ?? '-').padEnd(2)}` +
        ` ->  ${fmt(af.cos)} ${(af.src ?? '-').padEnd(2)}   ${same ? '' : 'cosine changed'}`,
    );
  }
}

console.log('--- illustrative engine, all 4 demos x fragments ------------------');
console.log('  demo        frag  before      ->  after');
console.log(rows.join('\n'));
console.log(`\n  fragments: ${rows.length}`);
console.log(`  cosines changed after the fixes: ${cosChanged} (unchanged: ${cosSame})`);
console.log(`  mapping decisions changed: ${decisionChanged}`);
