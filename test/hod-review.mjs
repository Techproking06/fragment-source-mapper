/* HOD review capture — read-only. Writes screenshots and machine-readable
 * evidence into artifacts/hod-review/.
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort
 *   node test/hod-review.mjs
 *
 * Captures: homepage (full page), every demo result, the Trace dialog stage
 * by stage (real Jaccard / SBERT / cosine / ranking / decision), validation
 * under both engines, the comparison section (dark + light), and the mobile
 * layout. Also cross-checks that the numbers on screen equal the numbers in
 * the results table, and saves the raw evidence to numbers.txt.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = 'artifacts/hod-review';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const evidence = [];
const say = (line) => {
  console.log(line);
  evidence.push(line);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await ctx.newPage();

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => {
  if (!r.url().includes('favicon')) problems.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`);
});

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });

/* Wait for the Sentence-BERT weights so every captured score is genuine
   inference (the segmented control disables itself while loading). */
await page.waitForFunction(
  () => {
    const btn = document.querySelector('.segmented button');
    return btn && !btn.hasAttribute('disabled');
  },
  { timeout: 240000, polling: 500 },
);
say(`engine control ready · notice = "${(await page.locator('.notice, .foot-engine').first().innerText()).trim().slice(0, 120)}"`);

const waitRows = async () => {
  await page.waitForTimeout(250);
  await page.waitForFunction(
    () =>
      !document.querySelector('.runbar .btn-primary .spinner') &&
      document.querySelectorAll('#demo .map-table tbody tr').length > 0,
    { timeout: 120000, polling: 200 },
  );
  await page.waitForTimeout(600);
};
await waitRows();

const readTable = () =>
  page.$$eval('#demo .map-table tbody tr', (trs) =>
    trs.map((tr, i) => ({
      f: i + 1,
      src: tr.querySelector('.src-pill')?.textContent?.trim() ?? '',
      sub: tr.querySelector('.cell-sub')?.textContent?.trim() ?? '',
      cos: parseFloat(tr.querySelectorAll('.bar-num')[0]?.textContent ?? 'NaN'),
      jac: parseFloat(tr.querySelectorAll('.bar-num')[1]?.textContent ?? 'NaN'),
      all: [...tr.querySelectorAll('.cell-all span')].map((s) => s.textContent.trim()),
      status: tr.querySelector('.status')?.textContent?.trim() ?? '',
    })),
  );

/* The sticky site header floats over the top of any element screenshot of a
   section, so it is hidden while section-level evidence is captured. */
let headerStyle = null;
const hideHeader = async () => {
  if (!headerStyle) headerStyle = await page.addStyleTag({ content: '.site-head{display:none !important}' });
};
const showHeader = async () => {
  if (headerStyle) {
    await headerStyle.evaluate((el) => el.remove());
    headerStyle = null;
  }
};

/* ---------------------------------------------------------------- homepage */
await page.evaluate(async () => {
  const step = window.innerHeight / 2;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 90));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/01-homepage-full.png`, fullPage: true });
say(`01-homepage-full.png · engine chip on results = "${(await page.locator('.engine-chip').first().innerText()).trim()}"`);
await hideHeader();

/* ----------------------------------------------------------------- demos */
const DEMO_SHOTS = [
  ['Patchwork · multiple sources', '02-demo-patchwork.png'],
  ['Single source', '03-demo-single.png'],
  ['Paraphrased patchwork', '04-demo-paraphrased.png'],
  ['Mostly original', '05-demo-original.png'],
];
for (const [label, file] of DEMO_SHOTS) {
  await page.getByRole('tab', { name: label }).click();
  await waitRows();
  await page.locator('#demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#demo').screenshot({ path: `${OUT}/${file}` });
  const rows = await readTable();
  say(`${file} · ${label}`);
  for (const r of rows) {
    say(`    F${r.f} ${r.src} · cos ${r.cos.toFixed(2)} · jac ${r.jac.toFixed(2)} · ${r.status} · [${r.all.join(' | ')}]`);
  }
}

/* --------------------------- trace: genuine SBERT fragment, all 6 stages */
await page.getByRole('tab', { name: 'Patchwork · multiple sources' }).click();
await waitRows();
const table = await readTable();
await page.locator('#demo .map-table tbody tr').first().getByRole('button', { name: /Trace this result/i }).click();
await page.waitForSelector('.trace');
await page.waitForTimeout(600);

await page.screenshot({ path: `${OUT}/06-trace-top.png` });
const stageCount = await page.locator('.trace .fs-step').count();
const connCount = await page.locator('.trace .pconn').count();
const titles = await page.$$eval('.trace .tsec-h', (hs) => hs.map((h) => h.textContent.replace(/\s+/g, ' ').trim()));
say(`06-trace-top.png · flow strip ${stageCount} stages · ${connCount} connectors`);
say(`    stage cards: ${titles.map((t) => `"${t}"`).join(' | ')}`);

const tsec = (n) => page.locator('.trace .tsec').nth(n);
await tsec(0).screenshot({ path: `${OUT}/07-trace-fragment.png` });
const jacLine = (await tsec(1).locator('.calc-line').first().innerText()).trim();
await tsec(1).screenshot({ path: `${OUT}/08-trace-jaccard.png` });
const sbertText = (await tsec(2).innerText()).replace(/\s+/g, ' ');
await tsec(2).screenshot({ path: `${OUT}/09-trace-sbert.png` });
const cosLines = await tsec(3).locator('.calc-line').allInnerTexts();
await tsec(3).screenshot({ path: `${OUT}/10-trace-cosine.png` });
const rankRows = await page.$$eval('.trace .rank-tbl tbody tr', (trs) =>
  trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim())),
);
await tsec(4).screenshot({ path: `${OUT}/11-trace-ranking.png` });
const decisionRule = (await tsec(5).locator('.calc-line').last().innerText()).trim();
const summary = (await page.locator('.trace-summary').innerText()).replace(/\s+/g, ' ').trim();
await tsec(5).screenshot({ path: `${OUT}/12-trace-decision.png` });

say(`    Jaccard line: ${jacLine}`);
say(`    SBERT card: ${sbertText.slice(0, 260)}`);
cosLines.forEach((l, i) => say(`    cosine line ${i + 1}: ${l}`));
say(`    ranking rows: ${rankRows.map((r) => r.join(' · ')).join('  ||  ')}`);
say(`    decision rule: ${decisionRule}`);
say(`    generated summary: ${summary}`);

/* the screenshots must agree with the table row the dialog was opened from */
const usedScore = parseFloat((cosLines.find((l) => /score used by the engine/.test(l)) ?? '').match(/([\d.]+)/g)?.pop() ?? 'NaN');
const jacShown = parseFloat((jacLine.match(/=\s*([\d.]+)$/) ?? [])[1] ?? 'NaN');
const rank1Cos = parseFloat(rankRows[0]?.[2] ?? 'NaN');
const checks = [
  ['trace "score used by the engine" === table cosine F1', Math.abs(usedScore - table[0].cos) < 0.005, `${usedScore} vs ${table[0].cos}`],
  ['trace Jaccard === table Jaccard F1', Math.abs(jacShown - table[0].jac) < 0.005, `${jacShown} vs ${table[0].jac}`],
  ['ranking #1 cosine === table cosine F1', Math.abs(rank1Cos - table[0].cos) < 0.005, `${rank1Cos} vs ${table[0].cos}`],
];
for (const [name, ok, detail] of checks) {
  say(`    CHECK ${ok ? 'PASS' : 'FAIL'} · ${name} (${detail})`);
  if (!ok) problems.push(`trace/table mismatch: ${name} (${detail})`);
}

await page.keyboard.press('Escape');
await page.waitForTimeout(300);

/* ------------------------------- trace below threshold (no source assigned) */
await page.getByRole('tab', { name: 'Mostly original' }).click();
await waitRows();
await page.locator('#demo .map-table tbody tr').nth(1).getByRole('button', { name: /Trace this result/i }).click();
await page.waitForSelector('.trace');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/13-trace-below-threshold.png` });
const btHead = (await page.locator('.trace-head h3').innerText()).replace(/\s+/g, ' ').trim();
const btRule = (await page.locator('.trace .tsec').nth(5).locator('.calc-line').last().innerText()).trim();
say(`13-trace-below-threshold.png · head "${btHead}" · rule "${btRule}"`);
if (/Source [A-D]/.test(btHead)) problems.push(`below-threshold trace claims a source: ${btHead}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

/* ------------------------------------------------------------- validation */
await page.getByRole('tab', { name: 'Patchwork · multiple sources' }).click();
await waitRows();

const runValidation = async () => {
  await page.locator('#validation .btn-primary').click();
  await page.waitForSelector('#validation .val-score', { timeout: 180000 });
  await page.waitForTimeout(400);
};
const readValidation = async () =>
  page.$$eval('#validation .val-table tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim())),
  );

await runValidation();
await page.locator('#validation').screenshot({ path: `${OUT}/14-validation-sbert.png` });
const sbertPill = (await page.locator('#validation .val-score').innerText()).trim();
const sbertCases = await readValidation();
say(`14-validation-sbert.png · ${sbertPill}`);
sbertCases.forEach((c) => say(`    ${c[0].slice(0, 40)} | expected ${c[1]} | actual ${c[2]} | ${c[4]}`));
if (!/4\s*\/\s*4/.test(sbertPill)) problems.push(`SBERT validation expected 4/4, got "${sbertPill}"`);

/* illustrative engine — the honest failure mode must be shown, not hidden */
await page.locator('.segmented button').nth(1).click();
await waitRows();
await runValidation();
await page.locator('#validation').screenshot({ path: `${OUT}/15-validation-illustrative.png` });
const illPill = (await page.locator('#validation .val-score').innerText()).trim();
const illCases = await readValidation();
say(`15-validation-illustrative.png · ${illPill}`);
illCases.forEach((c) => say(`    ${c[0].slice(0, 40)} | expected ${c[1]} | actual ${c[2]} | ${c[4]}`));

await page.locator('.segmented button').nth(0).click();
await waitRows();

/* --------------------------------------------------------------- compare */
await page.locator('#compare').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.locator('#compare').screenshot({ path: `${OUT}/16-compare-section.png` });
await page.locator('.cmpv').screenshot({ path: `${OUT}/17-compare-panels.png` });
const disclaim = (await page.locator('.cmpv-ref .cmpv-disclaim').innerText()).replace(/\s+/g, ' ');
const liveTag = (await page.locator('.cmpv-live .cmpv-tag').innerText()).trim();
const liveCos = (await page.locator('.cmpv-live .lv-row').nth(3).innerText()).replace(/\s+/g, ' ');
const liveDec = (await page.locator('.cmpv-live .lv-row').nth(5).innerText()).replace(/\s+/g, ' ');
const note = (await page.locator('.cmp-note').innerText()).replace(/\s+/g, ' ');
const cmpRows = await page.locator('.cmp-table tbody tr').count();
say(`16-compare-section.png · ${cmpRows} comparison rows`);
say(`    reference disclaim: ${disclaim.slice(0, 180)}`);
say(`    live panel tag: ${liveTag}`);
say(`    live cosine row: ${liveCos}`);
say(`    live decision row: ${liveDec}`);
say(`    note: ${note.slice(0, 260)}`);
if (cmpRows !== 5) problems.push(`expected 5 comparison rows, found ${cmpRows}`);
if (!/Not an actual Turnitin report/.test(disclaim)) problems.push('reference disclaim missing');
if (!/No claim of superior accuracy is made/.test(note)) problems.push('no-benchmark note missing');

/* light theme shot of the same panels (header shown only while clicking) */
await showHeader();
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(700);
await hideHeader();
await page.locator('.cmpv').screenshot({ path: `${OUT}/18-compare-panels-light.png` });
await showHeader();
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(500);
await hideHeader();

/* ---------------------------------------------------------------- mobile */
await showHeader();
await page.setViewportSize({ width: 430, height: 920 });
await page.waitForTimeout(600);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/19-mobile-home.png` });

await hideHeader();
await page.locator('#compare').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.locator('.cmpv').screenshot({ path: `${OUT}/20-mobile-compare.png` });

await page.locator('#demo .map-table tbody tr').first().getByRole('button', { name: /Trace this result/i }).click();
await page.waitForSelector('.trace');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/21-mobile-trace.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.trace', { state: 'detached' });

await page.locator('#demo .results').screenshot({ path: `${OUT}/22-mobile-results.png` });
await showHeader();
say('19-22 · mobile layout captured at 430×920 (home, compare, trace, results)');

/* ------------------------------------------------------------------ done */
await browser.close();
fs.writeFileSync(`${OUT}/numbers.txt`, evidence.join('\n') + '\n');

/* Known issues that are documented and deliberately left unfixed in this
   read-only review. Machine-detected problems from this run come first. */
const UNRESOLVED = [
  'thresholds (SBERT 0.70/0.52, illustrative 0.60/0.40) are hand-set, not calibrated on labelled data',
  'ground truth in src/data/demos.ts is self-authored - validation is an internal consistency check, not external accuracy',
  'the reference corpus is four short synthetic documents; no real-world submission corpus was evaluated',
  'this project\'s Porter measure() undercounts by one on consonant-final stems, so some step-4 removals never fire (e.g. calibrate -> calibrat; classic Porter gives calibr) - conservative, left alone to avoid re-tuning every score',
  'fragmentize() merges a runt sentence into the previous fragment and the merge can cross a paragraph boundary',
  'Workbench "Show all N" can be off by one when two fragments share a sub-fragment',
  'AnalysisResult.originalFragments is consumed only by the presentation slide',
  'PROJECT_VERIFICATION_REPORT.txt in the project root is a stale 13 Oct 2026 report of an earlier build - do not quote it',
  'no git repository in this working copy, so no commit history can be cited',
];
fs.writeFileSync(
  `${OUT}/problems.txt`,
  [
    ...(problems.length ? problems : ['none (browser run clean)']),
    '',
    'UNRESOLVED (documented, not fixed in this review):',
    ...UNRESOLVED.map((u) => `- ${u}`),
  ].join('\n') + '\n',
);

console.log('\n=== PROBLEMS (' + problems.length + ') ===');
console.log(problems.length ? problems.join('\n') : 'none');
console.log(`(problems.txt also lists ${UNRESOLVED.length} documented, unresolved items)`);
