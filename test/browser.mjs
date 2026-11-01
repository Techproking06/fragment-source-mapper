import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = 'artifacts';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warning') {
    problems.push(`[console.${t}] ${m.text()}`);
  }
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!u.includes('favicon')) problems.push(`[requestfailed] ${u} :: ${r.failure()?.errorText}`);
});

/* 'load', not 'networkidle': the app deliberately starts the 23 MB Sentence-BERT
   download in the background, which can keep the network busy past any timeout.
   Every step below waits for the condition it actually needs. */
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-hero.png` });

/** A demo/engine change clears the table and re-runs; wait until it settles. */
const waitRows = async () => {
  await page.waitForTimeout(250); // let React render the new "analyzing" state
  await page.waitForFunction(
    () =>
      !document.querySelector('.runbar .btn-primary .spinner') &&
      document.querySelectorAll('#demo .map-table tbody tr').length > 0,
    { timeout: 90000, polling: 200 },
  );
};

// ---- engine status -------------------------------------------------------
const pill = await page.locator('.notice, .foot-engine').first().innerText().catch(() => '');
log('engine text:', pill.trim().slice(0, 140));

// ---- run the patchwork demo ---------------------------------------------
await page.getByRole('button', { name: /Run the patchwork demo/i }).click();
await waitRows();
await page.waitForTimeout(1500);

const rows = await page.$$eval('#demo .map-table tbody tr', (trs) =>
  trs.map((tr) => ({
    src: tr.querySelector('.src-pill')?.textContent?.trim(),
    status: tr.querySelector('.status')?.textContent?.trim(),
    bars: [...tr.querySelectorAll('.bar-num')].map((b) => b.textContent.trim()),
    all: [...tr.querySelectorAll('.cell-all span')].map((s) => s.textContent.trim()),
  })),
);
log('PATCHWORK rows:', JSON.stringify(rows, null, 1));

const connectors = await page.$$eval('.connector', (p) => p.length);
log('connector paths:', connectors);
await page.locator('#demo').screenshot({ path: `${OUT}/02-patchwork.png` });

// ---- hero summary mirrors the live analysis -----------------------------
await page.locator('#top').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const heroStats = await page.$$eval('.hl-stat b', (b) => b.map((x) => x.textContent.trim()));
assert.deepEqual(heroStats, ['6', '6', '4'], `hero live summary must show fragments/matched/sources: ${heroStats}`);
const heroEngineText = await page.locator('.hl-engine').innerText();
assert.match(heroEngineText, /SBERT/, `hero must name the active engine: ${heroEngineText}`);
const heroChips = await page.$$eval('.hl-chip', (c) => c.map((x) => x.textContent.trim()));
assert.deepEqual(
  heroChips,
  ['F1→A', 'F2→C', 'F3→A', 'F4→B', 'F5→D', 'F6→C'],
  `hero fragment→source chips: ${heroChips}`,
);

// ---- left pane truncates; reference cards collapse to the matches -------
const clamp = await page.$eval('#demo .frag .frag-body p', (el) => getComputedStyle(el).webkitLineClamp);
assert.equal(clamp, '2', `left-pane fragment text must be truncated to 2 lines, got ${clamp}`);
const shownFrags = await page.$$eval('.sources .source-card .src-frags li', (n) => n.length);
const hitFrags = await page.$$eval('.sources .source-card .src-frags li.is-hit', (n) => n.length);
assert.ok(shownFrags < 16, `reference cards must hide non-matching sub-fragments by default: ${shownFrags}`);
assert.ok(hitFrags > 0, 'matched sub-fragments must stay visible');
const firstCard = page.locator('.sources .source-card').first();
await firstCard.getByRole('button', { name: /Show all/i }).click();
await page.waitForTimeout(250);
assert.equal(
  await firstCard.locator('.src-frags li').count(),
  4,
  'Show all must reveal every sub-fragment of the card',
);
await firstCard.getByRole('button', { name: /Show less/i }).click();
await page.waitForTimeout(250);

// ---- results must be the real engine output ----------------------------
const mapping = rows.map((r) => (r.src || '').replace('Source ', '') || '-');
assert.deepEqual(mapping, ['A', 'C', 'A', 'B', 'D', 'C'], `patchwork mapping was ${mapping}`);
for (const r of rows) {
  assert.ok(
    ['strong match', 'possible match', 'below threshold'].includes(r.status),
    `unexpected status label: ${r.status}`,
  );
}
const noteText = await page.locator('.results-note').first().innerText();
assert.match(noteText, /Cosine similarity ranks the sources/, `footnote must explain ranking: ${noteText}`);
assert.match(noteText, /Jaccard word overlap is reported as lexical evidence/, `footnote must explain Jaccard: ${noteText}`);
assert.match(noteText, /Trace This Result/, `footnote must point to the trace: ${noteText}`);
const chipText = await page.locator('.engine-chip').first().innerText();
assert.match(chipText, /SBERT/, `engine chip must name the engine: ${chipText}`);
assert.match(chipText, /strong ≥ 0\.70/, `threshold chip must show SBERT thresholds: ${chipText}`);
assert.match(chipText, /possible ≥ 0\.52/, `threshold chip must show SBERT thresholds: ${chipText}`);

// ---- trace panel vs results table (same numbers, both views) -----------
const openTrace = async (rowIndex) => {
  await page
    .locator('#demo .map-table tbody tr')
    .nth(rowIndex)
    .getByRole('button', { name: /Trace this result/i })
    .click();
  await page.waitForSelector('.trace', { timeout: 5000 });
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const qa = (s) => [...document.querySelectorAll(s)];
    const calc = qa('.trace .calc-line').map((e) => e.textContent.trim());
    const res = qa('.trace .ps-res').map((e) => e.textContent.trim());
    return {
      head: document.querySelector('.trace-head h3')?.textContent.trim() ?? '',
      status: document.querySelector('.trace-head .status')?.textContent.trim() ?? '',
      engine: document.querySelector('.trace .fact-v')?.textContent.trim() ?? '',
      jaccardLine: calc.find((c) => c.includes('|A ∩ B|')) ?? '',
      cosineLine: calc.find((c) => c.startsWith('cos θ')) ?? '',
      finalLine: calc.find((c) => c.includes('score used by the engine')) ?? '',
      ruleLine: calc.find((c) => c.includes('→ strong match')) ?? '',
      tokens: qa('.trace .tok').length,
      vectors: qa('.trace .vec').length,
      flow: qa('.trace .fs-step').map((e) => e.textContent.trim().replace(/^\d+/, '')),
      conns: qa('.trace .pconn').length,
      feeds: qa('.trace .ps-feeds').length,
      outcome: res[res.length - 1] ?? '',
      rank: qa('.trace .rank-tbl tbody tr').map((tr) => ({
        src: tr.querySelector('.src-pill')?.textContent.trim() ?? '',
        cos: tr.querySelectorAll('.rk-num')[0]?.textContent.trim() ?? '',
        jac: tr.querySelectorAll('.rk-num')[1]?.textContent.trim() ?? '',
        sub: tr.querySelector('.rk-sub')?.textContent.trim() ?? '',
        win: tr.classList.contains('is-winner'),
      })),
      summary: document.querySelector('.trace-summary')?.textContent.trim() ?? '',
    };
  });
};

const t0 = await openTrace(0);
log('TRACE F1:', JSON.stringify(t0));
assert.match(t0.head, /F1/, `trace head: ${t0.head}`);
assert.ok(t0.head.includes(rows[0].src), `trace head must name the table winner: ${t0.head}`);
assert.equal(t0.status, rows[0].status, 'trace status === table status');
assert.match(t0.engine, /Sentence-BERT/, `trace must name the engine: ${t0.engine}`);

const jacM = t0.jaccardLine.match(/= (\d+) \/ (\d+) = ([\d.]+)/);
assert.ok(jacM, `jaccard formula unreadable: ${t0.jaccardLine}`);
assert.equal(jacM[3], rows[0].bars[1], `trace Jaccard ${jacM[3]} !== table ${rows[0].bars[1]}`);
assert.ok(
  Math.abs(Number(jacM[1]) / Number(jacM[2]) - Number(jacM[3])) < 0.01,
  `${jacM[1]}/${jacM[2]} must equal ${jacM[3]}`,
);

assert.ok(t0.finalLine.includes(rows[0].bars[0]), `cosine score must match the table: ${t0.finalLine}`);
assert.match(t0.cosineLine, /A · B/, `cosine formula shown: ${t0.cosineLine}`);
assert.ok(t0.ruleLine.includes('0.70') && t0.ruleLine.includes('0.52'), `rule shows real thresholds: ${t0.ruleLine}`);
assert.ok(t0.tokens > 0, 'trace shows real token chips');
assert.equal(t0.vectors, 2, 'trace shows both vector previews');
assert.equal(t0.rank.length, 4, 'all four sources ranked');
assert.equal(t0.rank[0].win, true, 'rank 1 highlighted');
assert.equal(t0.rank[0].src, rows[0].src, 'ranking winner === table winner');
assert.equal(t0.rank[0].cos, rows[0].bars[0], 'ranking cosine === table cosine');
assert.equal(t0.rank[0].jac, rows[0].bars[1], 'ranking Jaccard === table Jaccard');
assert.match(t0.rank[0].sub, /^[A-D]\d+$/, `winning sub-fragment id: ${t0.rank[0].sub}`);
assert.ok(t0.head.includes(t0.rank[0].sub), 'head names the same sub-fragment as the ranking');
for (let i = 1; i < t0.rank.length; i++) {
  assert.ok(
    Number(t0.rank[i - 1].cos) >= Number(t0.rank[i].cos),
    'ranking is sorted by cosine',
  );
}
assert.ok(t0.summary.includes(rows[0].bars[0]), 'generated summary quotes the real score');
assert.deepEqual(
  t0.flow,
  ['Submitted fragment', 'Jaccard', 'Sentence-BERT', 'Cosine similarity', 'Source ranking', 'Final decision'],
  `trace must show the pipeline in one continuous order: ${t0.flow}`,
);
assert.equal(t0.conns, 5, `every stage must be joined to the next by a connector, got ${t0.conns}`);
assert.equal(t0.feeds, 6, `every stage must say what it feeds next, got ${t0.feeds}`);
assert.ok(t0.outcome.includes('Source'), `matched fragment decision must name the assigned source: ${t0.outcome}`);
assert.ok(t0.outcome.includes(rows[0].src), `decision must quote the table source: ${t0.outcome}`);
await page.screenshot({ path: `${OUT}/11-trace.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.trace', { state: 'detached', timeout: 3000 });

// second row, different source — panel must follow the row it was opened from
const t3 = await openTrace(3);
assert.match(t3.head, /F4/, `trace head for row 4: ${t3.head}`);
assert.ok(t3.head.includes(rows[3].src), `trace head must name F4 winner: ${t3.head}`);
assert.equal(t3.status, rows[3].status);
assert.equal(t3.rank[0].cos, rows[3].bars[0]);
await page.keyboard.press('Escape');
await page.waitForSelector('.trace', { state: 'detached', timeout: 3000 });

// ---- validation view: live PASS/FAIL against the declared ground truth -
await page.locator('#validation').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: /Run validation/i }).click();
await page.waitForSelector('.val-pill', { timeout: 90000 });
await page.waitForTimeout(400);
const valRows = await page.$$eval('.val-table tbody tr', (trs) =>
  trs.map((tr) => ({
    name: tr.querySelector('.val-name')?.textContent?.trim() ?? '',
    expected: tr.querySelectorAll('.val-cells')[0]?.textContent?.trim() ?? '',
    actual: tr.querySelectorAll('.val-cells')[1]?.textContent?.trim() ?? '',
    scores: tr.querySelectorAll('.val-cells')[2]?.textContent?.trim() ?? '',
    result: tr.querySelector('.val-pill')?.textContent?.trim() ?? '',
  })),
);
log('VALIDATION:', JSON.stringify(valRows, null, 1));
assert.equal(valRows.length, 4, 'one row per demo');
const passed = valRows.filter((v) => /PASS/.test(v.result)).length;
assert.equal(
  passed,
  4,
  `expected 4/4 PASS under the real Sentence-BERT engine, got ${passed}: ${JSON.stringify(valRows)}`,
);
const valScore = await page.locator('.val-score').innerText();
assert.match(valScore, /4 \/ 4/, `summary badge: ${valScore}`);
const valNote = await page.locator('#validation .results-note').innerText();
assert.match(valNote, /genuine inference/, `validation must name the engine it used: ${valNote}`);
await page.locator('#validation').screenshot({ path: `${OUT}/12-validation.png` });

// ---- paraphrased patchwork ----------------------------------------------
await page.getByRole('tab', { name: /Paraphrased patchwork/i }).click();
await waitRows();
await page.waitForTimeout(600);
const rows2 = await page.$$eval('#demo .map-table tbody tr', (trs) =>
  trs.map((tr) => ({
    src: tr.querySelector('.src-pill')?.textContent?.trim(),
    bars: [...tr.querySelectorAll('.bar-num')].map((b) => b.textContent.trim()),
    all: [...tr.querySelectorAll('.cell-all span')].map((s) => s.textContent.trim()),
  })),
);
log('PARAPHRASED rows:', JSON.stringify(rows2, null, 1));
await page.locator('#demo').screenshot({ path: `${OUT}/03-paraphrased.png` });

// ---- mostly original ----------------------------------------------------
await page.getByRole('tab', { name: /Mostly original/i }).click();
await waitRows();
await page.waitForTimeout(400);
const rows3 = await page.$$eval('#demo .map-table tbody tr', (trs) =>
  trs.map((tr) => ({
    src: tr.querySelector('.src-pill')?.textContent?.trim(),
    status: tr.querySelector('.status')?.textContent?.trim(),
  })),
);
log('ORIGINAL rows:', JSON.stringify(rows3, null, 1));
await page.locator('#demo').screenshot({ path: `${OUT}/04-original.png` });

// ---- below-threshold trace must never name a confirmed winning source ----
const tOrig = await openTrace(1);
assert.ok(
  !/Source [A-D]/.test(tOrig.head),
  `a below-threshold fragment must not name a confirmed source: ${tOrig.head}`,
);
assert.match(tOrig.head, /no source assigned/, `expected the no-source wording: ${tOrig.head}`);
assert.match(tOrig.status, /below threshold/, `expected a below-threshold status: ${tOrig.status}`);
assert.ok(
  !tOrig.rank.some((r) => r.win),
  'no ranking row may be marked as the winner when nothing was accepted',
);
assert.match(
  tOrig.summary,
  /below the possible-match threshold/,
  `the panel must give the reason no match was accepted: ${tOrig.summary}`,
);
assert.equal(
  tOrig.outcome,
  'Below threshold — no source assigned.',
  `a below-threshold fragment must end in an explicit no-source decision: ${tOrig.outcome}`,
);
assert.ok(
  !/Source [A-D]/.test(tOrig.outcome),
  `the decision must not name a confirmed source: ${tOrig.outcome}`,
);
await page.screenshot({ path: `${OUT}/11b-trace-unmatched.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.trace', { state: 'detached', timeout: 3000 });

// ---- compare panel, left half of "mostly original" must stay unmatched -
await page.locator('.cmpv-live .lv-chip').nth(1).click();
await page.waitForTimeout(200);
assert.equal(
  (await page.locator('.cmpv-live .lv-none').innerText()).trim(),
  'Below threshold — no source assigned.',
  'live compare panel must show the below-threshold decision for an unmatched fragment',
);
const cmpNoneBars = await page.locator('.cmpv-live .rank-fill').count();
assert.equal(cmpNoneBars, 4, 'live compare panel ranks all four sources even when nothing is accepted');
const cmpNoneColored = await page.$$eval('.cmpv-live .rank-fill', (els) =>
  els.filter((e) => e.style.background.includes('src-') && !e.style.background.includes('src-n')).length,
);
assert.equal(cmpNoneColored, 0, 'no source colour may be shown as accepted below the threshold');

// ---- single source ------------------------------------------------------
await page.getByRole('tab', { name: /Single source/i }).click();
await waitRows();
await page.waitForTimeout(400);
const rows4 = await page.$$eval('#demo .map-table tbody .src-pill', (els) => els.map((e) => e.textContent.trim()));
log('SINGLE rows:', JSON.stringify(rows4));
await page.locator('#demo').screenshot({ path: `${OUT}/05-single.png` });

// ---- illustrative mode --------------------------------------------------
await page.getByRole('button', { name: /^Illustrative$/i }).click();
await waitRows(); // switching engines re-runs immediately — never stale
await page.getByRole('tab', { name: /Paraphrased patchwork/i }).click();
await waitRows();
await page.waitForTimeout(500);
const rows5 = await page.$$eval('#demo .map-table tbody tr', (trs) =>
  trs.map((tr) => ({
    src: tr.querySelector('.src-pill')?.textContent?.trim(),
    bars: [...tr.querySelectorAll('.bar-num')].map((b) => b.textContent.trim()),
    all: [...tr.querySelectorAll('.cell-all span')].map((s) => s.textContent.trim()),
  })),
);
log('ILLUSTRATIVE paraphrased:', JSON.stringify(rows5, null, 1));
await page.locator('#demo').screenshot({ path: `${OUT}/06-illustrative.png` });

const oldNote = await page.locator('.results-note').first().innerText();
assert.match(
  oldNote,
  /The illustrative TF-IDF engine was selected deliberately/,
  `footnote must not call a deliberately chosen engine a fallback: ${oldNote}`,
);
const oldChip = await page.locator('.engine-chip').first().innerText();
assert.match(oldChip, /Illustrative TF-IDF/, `chip must name the fallback: ${oldChip}`);
assert.match(oldChip, /strong ≥ 0\.60/, `chip must show fallback thresholds: ${oldChip}`);
assert.match(
  await page.locator('.cmpv-live .cmpv-tag').innerText(),
  /Illustrative TF-IDF · selected/,
  'the live compare panel must label the engine that produced its numbers',
);

// ---- engine selector: results are re-run, never left stale --------------
await page.getByRole('button', { name: /^Sentence-BERT$/i }).click();
await page.waitForFunction(
  () => {
    const chip = document.querySelector('.engine-chip')?.textContent ?? '';
    return /SBERT/.test(chip) && /strong ≥ 0\.70/.test(chip);
  },
  { timeout: 90000 },
);
const newNote = await page.locator('.results-note').first().innerText();
assert.match(newNote, /Cosine similarity ranks the sources/, `stale fallback numbers remained: ${newNote}`);
const newChip = await page.locator('.engine-chip').first().innerText();
assert.match(newChip, /strong ≥ 0\.70/, `chip must show SBERT thresholds again: ${newChip}`);
log('engine switch: stale results cleared and re-run OK');

// ---- theme --------------------------------------------------------------
const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(800);
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
log('theme:', themeBefore, '->', themeAfter);
await page.screenshot({ path: `${OUT}/07-${themeAfter}.png`, fullPage: false });
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(500);
log('theme restored:', await page.evaluate(() => document.documentElement.dataset.theme));

// ---- method section (live values from the current run) ------------------
await page.locator('#method').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('#method').screenshot({ path: `${OUT}/08-method.png` });
const formulas = await page.$$eval('.formula', (e) => e.map((x) => x.textContent.trim()));
log('method formulas:', JSON.stringify(formulas));
assert.ok(
  formulas.some((f) => /\|A ∩ B\| \/ \|A ∪ B\| = \d+ \/ \d+ = 0\.\d+/.test(f)),
  `method must show a real substituted Jaccard calculation: ${JSON.stringify(formulas)}`,
);
assert.ok(
  formulas.some((f) => /live · F\d/.test(f)),
  `method steps must be labelled with the live fragment: ${JSON.stringify(formulas)}`,
);
assert.ok(
  formulas.some((f) => /cos θ = \(A · B\)/.test(f) && /\d+\.\d{4} \/ \(\d+\.\d{4} × \d+\.\d{4}\)/.test(f)),
  `method must show real cosine arithmetic: ${JSON.stringify(formulas)}`,
);
assert.ok(
  formulas.some((f) => /→ (strong|possible) match|→ below threshold/.test(f)),
  `method must show the live threshold decision: ${JSON.stringify(formulas)}`,
);
const methodSteps = await page.$$eval('#method .steps-6 .step h3', (els) => els.map((e) => e.textContent.trim()));
assert.deepEqual(
  methodSteps,
  ['Submitted fragment', 'Jaccard', 'SBERT', 'Cosine', 'Source ranking', 'Source mapping'],
  `the Method section must walk the same six stages as the trace panel: ${methodSteps}`,
);
const methodFlow = await page.$$eval('#method .flow-strip .fs-step', (els) =>
  els.map((e) => e.textContent.trim().replace(/^\d+/, '')),
);
assert.deepEqual(
  methodFlow,
  ['Submitted fragment', 'Jaccard', 'Sentence-BERT', 'Cosine similarity', 'Source ranking', 'Final decision'],
  `method pipeline strip: ${methodFlow}`,
);

// ---- comparison + limitations sections exist and are honest -------------
assert.ok(await page.locator('#compare').isVisible(), 'comparison section missing');
const cmpRows = await page.$$eval('.cmp-table tbody tr', (r) => r.length);
assert.equal(cmpRows, 5, `comparison table must keep five meaningful rows: ${cmpRows}`);
assert.match(await page.locator('.cmp-note').innerText(), /proprietary/, 'comparison must disclaim proprietary algorithms');
assert.match(
  await page.locator('.cmp-note').innerText(),
  /Qualitative workflow comparison only—not a performance benchmark/,
  'the required comparison note must be present verbatim',
);
assert.equal(
  await page.locator('.cmp-slot').count(),
  0,
  'the author-only "authorized report" slot must not be visible to visitors',
);

/* ---- the two panels: illustrative reference vs this build's live numbers ---- */
assert.match(
  await page.locator('.cmpv-disclaim').innerText(),
  /Illustrative reference · Not an actual Turnitin report\./,
  'the left panel must state exactly what it is',
);
assert.equal(await page.locator('.rv-src').count(), 3, 'left panel placeholder source list');

// passage → source (left panel is independent of the right one)
const liveBefore = await page.locator('.lv-chip.is-on').innerText();
await page.locator('.rv-pass').nth(1).click();
await page.waitForTimeout(150);
assert.equal(await page.locator('.rv-pass.is-on').count(), 1, 'exactly one passage selected');
assert.ok(
  (await page.locator('.rv-pass.is-on').innerText()).includes('Sample passage two'),
  'clicking a passage must select that passage',
);
assert.ok(
  (await page.locator('.rv-src.is-on').innerText()).includes('Placeholder source 2'),
  'clicking a passage must select its placeholder source',
);
// source → passage
await page.locator('.rv-src').nth(2).click();
await page.waitForTimeout(150);
assert.ok(
  (await page.locator('.rv-pass.is-on').innerText()).includes('Sample passage three'),
  'clicking a source must highlight its passage',
);
assert.equal(
  await page.locator('.lv-chip.is-on').innerText(),
  liveBefore,
  'interactions in the left panel must not move the right panel',
);

// right panel mirrors the results table of the current run
const cmpRowsNow = await page.$$eval('#demo .map-table tbody tr', (trs) =>
  trs.map((tr) => ({
    src: tr.querySelector('.src-pill')?.textContent?.trim() ?? '',
    bars: [...tr.querySelectorAll('.bar-num')].map((b) => b.textContent.trim()),
  })),
);
const pickIdx = cmpRowsNow.findIndex((r, i) => i > 0 && r.src.startsWith('Source'));
assert.ok(pickIdx > 0, `expected a matched row after the first one: ${JSON.stringify(cmpRowsNow)}`);
const pick = cmpRowsNow[pickIdx];
await page.locator('.cmpv-live .lv-chip').nth(pickIdx).click();
await page.waitForTimeout(200);
const lv = await page.$$eval('.cmpv-live .lv-v, .cmpv-live .lv-frag', (els) =>
  els.map((e) => e.textContent.trim()),
);
log(`live panel F${pickIdx + 1}:`, JSON.stringify(lv));
assert.equal(await page.$$eval('.cmpv-live .rank-bar', (b) => b.length), 4, 'live panel ranks four sources');
assert.ok(lv.some((t) => t.includes(pick.bars[1])), `live Jaccard must match the table: ${JSON.stringify(lv)}`);
assert.ok(lv.some((t) => t.includes(pick.bars[0])), `live cosine must match the table: ${JSON.stringify(lv)}`);
assert.ok(
  lv.some((t) => t.includes(pick.src) && t.includes(`F${pickIdx + 1}`)),
  `live decision must name the same source as the table: ${JSON.stringify(lv)}`,
);
assert.match(await page.locator('.cmpv-live .cmpv-tag').innerText(), /Sentence-BERT/, 'live panel labels the engine: Sentence-BERT');
await page.locator('#compare').screenshot({ path: `${OUT}/14-compare.png` });

assert.ok(await page.locator('#limits').isVisible(), 'limitations section missing');
const limitCards = await page.$$eval('.limit', (n) => n.length);
assert.equal(limitCards, 4, `limitation cards: ${limitCards}`);
assert.equal(
  await page.locator('details.future').evaluate((d) => d.open),
  false,
  'future work must be collapsed by default',
);

// ---- header navigation links --------------------------------------------
for (const id of ['#demo', '#method', '#validation', '#compare']) {
  assert.equal(await page.locator(`.head-nav a[href="${id}"]`).count(), 1, `header link for ${id} missing`);
}
await page.locator('.head-nav a[href="#validation"]').click();
await page.waitForTimeout(1200);
const valBox = await page.locator('#validation .results-head').boundingBox();
const headBox = await page.locator('.site-head').boundingBox();
assert.ok(
  valBox && headBox && valBox.y >= headBox.height - 2,
  `anchor target must not hide under the sticky header (${JSON.stringify(valBox)} vs ${JSON.stringify(headBox)})`,
);

// ---- presentation -------------------------------------------------------
await page.locator('.head-actions .btn').click();
await page.waitForSelector('.pres', { timeout: 5000 });
await page.waitForTimeout(1200);
for (let i = 0; i < 5; i++) {
  await page.screenshot({ path: `${OUT}/pres-${i + 1}.png` });
  const title = await page.locator('.slide h2').innerText();
  log(`slide ${i + 1}:`, title.replace(/\n/g, ' / '));
  if (i <= 2) {
    const note = await page.locator('.slide .slide-note').innerText();
    log(`  note: ${note}`);
    assert.match(note, /live/, `slide ${i + 1} must use live data when a result exists: ${note}`);
  }
  if (i === 2) {
    const bars = await page.$$eval('.sem-bar b', (b) => b.map((x) => x.textContent.trim()));
    log(`  slide 3 bars: ${bars.join(' / ')}`);
    assert.equal(bars.length, 2, 'two bars on the semantic slide');
    for (const b of bars) assert.match(b, /^0\.\d{2}$/, `bar value must be a real score: ${b}`);
  }
  if (i < 4) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1100);
  }
}
const fmRows = await page.$$eval('.fm-row', (r) => r.length);
log('final map rows:', fmRows);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
log('presentation closed:', (await page.$('.pres')) === null);

// ---- responsive ---------------------------------------------------------
await page.setViewportSize({ width: 900, height: 900 });
await page.waitForTimeout(700);
await page.locator('#demo').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/09-tablet.png` });
await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/10-mobile.png` });

// ---- empty input: Analyze is disabled, no bogus run ---------------------
await page.setViewportSize({ width: 1440, height: 950 });
await page.waitForTimeout(500);
await page.locator('#demo').scrollIntoViewIfNeeded();
const editBtn = page.getByRole('button', { name: /Edit text/i });
if (await editBtn.isVisible().catch(() => false)) await editBtn.click();
await page.waitForSelector('textarea.doc-edit', { timeout: 5000 });
await page.locator('textarea.doc-edit').fill('');
await page.waitForTimeout(300);
assert.equal(
  await page.locator('.runbar button.btn-primary').isDisabled(),
  true,
  'Analyze must be disabled for an empty submission',
);
assert.match(
  await page.locator('.workbench .notice').first().innerText(),
  /submission is empty/i,
  'empty-input notice missing',
);
await page.locator('#demo').screenshot({ path: `${OUT}/13-empty.png` });
await page.getByRole('tab', { name: /Patchwork · multiple sources/i }).click();
await waitRows();
log('empty input handled and demo restored');

// ---- optional .txt loader (submission text, read locally) ----------------
const sample = `${OUT}/_sample.txt`;
fs.writeFileSync(
  sample,
  'Wind turbines and solar arrays both feed electricity into the shared grid without burning any fuel at all. ' +
    'A second sentence that is long enough to remain its own fragment for this assertion here.',
);
await page.locator('#demo .file-btn input[type="file"]').setInputFiles(sample);
await page.waitForFunction(
  () => (document.querySelector('textarea.doc-edit')?.value ?? '').includes('shared grid'),
  { timeout: 10000 },
);
log('.txt loaded into the editor');
await page.getByRole('button', { name: /^Analyze$/ }).click();
await waitRows();
const txtFrags = await page.$$eval('#demo .frag', (n) => n.length);
assert.ok(txtFrags >= 2, `uploaded text must fragment into at least 2 pieces, got ${txtFrags}`);
log('.txt analyzed into', txtFrags, 'fragments');
fs.unlinkSync(sample);

await browser.close();

const realProblems = problems.filter(
  (p) => !/favicon|Download the React DevTools/i.test(p),
);
fs.writeFileSync(`${OUT}/problems.txt`, realProblems.join('\n') || 'none');
log('\n=== PROBLEMS (' + realProblems.length + ') ===');
log(realProblems.slice(0, 40).join('\n') || 'none');
