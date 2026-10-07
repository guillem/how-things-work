// Screenshot helper for visual checks against the dev server.
//
// Usage: node scripts/shot.mjs <outdir> <url> [theme=light|dark] [width] [height] [fullPage=0|1] [name]
// Env:   WAIT=ms        wait after load before the shot (≈ animation time t); default 900
//        CLIP=stage     screenshot only the animation stage card
//        SET=id:value,… set explainer controls first, e.g. SET=wavelength:430,light:0
//        PW_CHROMIUM_PATH=/path/to/chrome   use a specific Chromium binary
// Example: WAIT=3000 CLIP=stage node scripts/shot.mjs shots "http://localhost:5173/photosynthesis/#atp" dark 1280 800 0 atp
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const [outdir, url, theme = 'light', w = '1280', h = '800', full = '0', name = ''] =
	process.argv.slice(2);
if (!outdir || !url) {
	console.error(
		'usage: node scripts/shot.mjs <outdir> <url> [theme] [width] [height] [fullPage] [name]'
	);
	process.exit(1);
}
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch(
	process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
);
const context = await browser.newContext({
	viewport: { width: Number(w), height: Number(h) },
	deviceScaleFactor: 1,
	colorScheme: theme === 'dark' ? 'dark' : 'light'
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
	if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.addInitScript((t) => {
	try {
		localStorage.setItem('theme', t);
	} catch {
		/* ignore */
	}
}, theme);
await page.goto(url, { waitUntil: 'networkidle' });
if (process.env.SET) {
	await page.waitForTimeout(300);
	for (const pair of process.env.SET.split(',')) {
		const [id, value] = pair.split(':');
		await page.evaluate(
			([id, value]) => {
				const range = document.querySelector(`input[type=range][data-control="${id}"]`);
				const toggle = document.querySelector(`input[type=checkbox][data-control="${id}"]`);
				const option = document.querySelector(
					`button[data-control="${id}"][data-value="${value}"]`
				);
				if (range) {
					range.value = value;
					range.dispatchEvent(new Event('input', { bubbles: true }));
				} else if (toggle) {
					toggle.checked = value === 'true';
					toggle.dispatchEvent(new Event('change', { bubbles: true }));
				} else if (option) option.click();
				else console.warn(`SET: no control with id "${id}" on this step`);
			},
			[id, value]
		);
	}
}
await page.waitForTimeout(Number(process.env.WAIT || 900));
const file = path.join(
	outdir,
	(name || url.replace(/[^a-z0-9]+/gi, '_').slice(-60)) + `_${theme}_${w}.png`
);
if (process.env.CLIP === 'stage') await page.locator('.stage-card').screenshot({ path: file });
else await page.screenshot({ path: file, fullPage: full === '1' });
console.log(file);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
