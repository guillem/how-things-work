import { expect, test, type Page } from '@playwright/test';

// The kalman-filter explainer: what a visitor sees when two guesses are blended, when the buoy's
// drift is switched off, when the GPS gets noisier, when an accelerometer joins the GPS, when a
// filter that expects straight lines meets a corner, and when its process noise is mis-set.
// Reduced motion shows each run finished. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('two guesses blend into an estimate surer than either, pulled towards the surer one', async ({
	page
}) => {
	await page.goto('./kalman-filter/#blend');
	await expect(stage(page)).toContainText('estimate 14.2 m, σ 1.66 m');
	await range(page, 'measSigma').press('End');
	await expect(stage(page)).toContainText('measurement 16 m, σ 8.0 m');
	// a poor sensor: the estimate stays near the prediction, and is still narrower than it
	expect(await read(page, 'estimate')).toBeLessThan(11);
	expect(await read(page, 'gain K = σp² ÷ (σp² + σm²) =')).toBeLessThan(0.15);
	expect(await read(page, 'estimate 10.7 m, σ')).toBeLessThan(3);
});

test('with no drift the filter is the running mean; with drift it beats every average', async ({
	page
}) => {
	await page.goto('./kalman-filter/#forget');
	await expect(stage(page)).toContainText('typical error');
	const kf = await read(page, 'Kalman');
	expect(kf).toBeLessThan(await read(page, 'readings'));
	expect(kf).toBeLessThan(await read(page, 'mean of the last 10'));
	expect(kf).toBeLessThan(await read(page, '· of all'));
	await range(page, 'walkQ').press('Home');
	await expect(stage(page)).toContainText('drifting not at all');
	await expect(stage(page)).toContainText('no drift: K = 1/k');
});

test(
	'noisier GPS lowers the gain; the filter stays more certain, and more accurate, than its fixes',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./kalman-filter/#noise');
		await expect(stage(page)).toContainText('GPS fixes (σ 8 m per axis)');
		const gain = await read(page, 'gain on position K =');
		expect(await read(page, 'the filter claims σ')).toBeLessThan(8);
		expect(await read(page, 'filter')).toBeLessThan(await read(page, 'rms per axis: GPS'));
		await range(page, 'gps').press('End');
		await expect(stage(page)).toContainText('GPS fixes (σ 40 m per axis)');
		expect(await read(page, 'gain on position K =')).toBeLessThan(gain);
		await expect(stage(page)).toContainText('the filter leans on its model');
	}
);

test('an accelerometer fused with GPS beats either sensor alone', async ({ page }) => {
	await page.goto('./kalman-filter/#fuse');
	const miss = async () => {
		const text = (await stage(page).textContent()) ?? '';
		const m = (label: string) =>
			Number(new RegExp(`${label}\\s*([\\d.]+) m`).exec(text)?.[1] ?? NaN);
		return { dead: m('accelerometer only'), gps: m('GPS only'), fused: m('both, fused') };
	};
	await expect(stage(page)).toContainText('a fix every second');
	const one = await miss();
	expect(one.fused).toBeLessThan(one.gps);
	expect(one.gps).toBeLessThan(one.dead);
	await range(page, 'every').press('End');
	await expect(stage(page)).toContainText('a fix every 10 seconds');
	const rare = await miss();
	expect(rare.gps).toBeGreaterThan(one.gps);
	expect(rare.fused).toBeLessThan(rare.gps);
	expect(rare.dead).toBe(one.dead); // dead reckoning never sees a fix
});

test('round a corner a stiff filter misses by far more than it claims; allowing for turns fixes it', async ({
	page
}) => {
	await page.goto('./kalman-filter/#swerve');
	await expect(stage(page)).toContainText('allows for σ 0.03 m/s²');
	const worst = await read(page, 'worst miss');
	expect(worst).toBeGreaterThan(5 * (await read(page, 'while claiming 95 % within')));
	expect(await read(page, 'truth outside its 95 % ellipse:')).toBeGreaterThan(15);
	await range(page, 'allowance').press('End');
	await expect(stage(page)).toContainText('allows for σ 3 m/s²');
	expect(await read(page, 'worst miss')).toBeLessThan(worst / 3);
	expect(await read(page, 'truth outside its 95 % ellipse:')).toBeLessThanOrEqual(3);
});

test('the innovations are white only when the process noise is right', async ({ page }) => {
	await page.goto('./kalman-filter/#check');
	await expect(stage(page)).toContainText('the model fits');
	await range(page, 'ratio').press('Home');
	await expect(stage(page)).toContainText('the filter lags');
	await range(page, 'ratio').press('End');
	await expect(stage(page)).toContainText('chases the noise');
});
