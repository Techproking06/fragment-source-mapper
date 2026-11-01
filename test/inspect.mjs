import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = 'artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(
  () => !document.querySelector('.runbar .btn-primary .spinner') && document.querySelectorAll('#demo .map-table tbody tr').length > 0,
  { timeout: 90000, polling: 200 },
);
await page.waitForTimeout(1200);

/* --- method, both themes --- */
await page.locator('#method').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('#method').screenshot({ path: `${OUT}/art-method-new.png` });

/* --- compare dark + light --- */
await page.locator('#compare').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/art-compare-dark.png` });
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/art-compare-light.png` });
await page.locator('.head-actions .icon-btn').click();
await page.waitForTimeout(600);

/* --- trace: top and bottom --- */
await page.locator('#demo .map-table tbody tr').nth(1).getByRole('button', { name: /Trace this result/i }).click();
await page.waitForSelector('.trace');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/art-trace2-mid.png` });
await page.locator('.trace-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/art-trace2-bottom.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

/* --- mobile: compare stacked, trace --- */
await page.setViewportSize({ width: 430, height: 920 });
await page.waitForTimeout(600);
await page.locator('#compare').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/art-compare-mobile.png` });
await page.locator('#demo .map-table tbody tr').first().getByRole('button', { name: /Trace this result/i }).click();
await page.waitForSelector('.trace');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/art-trace-mobile.png` });
await page.keyboard.press('Escape');

/* --- keyboard access to the compare panels --- */
await page.waitForSelector('.trace', { state: 'detached' });
await page.locator('.rv-src').first().focus();
await page.keyboard.press('Enter');
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
const kbPass = await page.locator('.rv-pass.is-on').count();
await page.locator('.lv-chip').nth(2).focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
const kbChip = await page.locator('.lv-chip.is-on').innerText();

await browser.close();
console.log('keyboard: left panel selection via Enter ->', kbPass, '| right panel chip ->', kbChip);
console.log('problems:', problems.filter((p) => !/favicon|React DevTools/i.test(p)).join('\n') || 'none');
