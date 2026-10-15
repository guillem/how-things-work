import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'the Otto efficiency follows the compression ratio, not the flame temperature',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './heat-engines/#otto');
		await expect(stage(page)).toContainText(/Efficiency\s*60%/);
		await expect(stage(page)).toContainText(/Work out \(the area\)\s*493 J/);
		await range(page, 'tHot').fill('3000');
		await expect(stage(page)).toContainText(/Efficiency\s*60%/);
		await expect(stage(page)).not.toContainText(/Work out \(the area\)\s*493 J/);
		await range(page, 'ratio').fill('13');
		await expect(stage(page)).toContainText(/Efficiency\s*64%/);
	}
);

test('turning more than 1 − Tc/Th of the heat into work would lower the total entropy', async ({
	page
}) => {
	await open(page, './heat-engines/#ceiling');
	await expect(stage(page)).toContainText('Allowed: total entropy rises by 0.67 J/K');
	await expect(stage(page)).toContainText('Carnot limit 50.0%');
	await range(page, 'share').fill('50');
	await expect(stage(page)).toContainText('At the limit');
	await range(page, 'share').fill('60');
	await expect(stage(page)).toContainText('Impossible: total entropy would fall');
	// A hotter hot side raises the ceiling: 60% is allowed between 900 K and 300 K.
	await range(page, 'ledgerHot').fill('900');
	await expect(stage(page)).toContainText('Allowed');
	await expect(stage(page)).toContainText('Carnot limit 66.7%');
});

test('stopped, the crank turned by hand walks through the four strokes', async ({ page }) => {
	await open(page, './heat-engines/#strokes');
	// A key press is queued even while the scene redraws every frame (a click waits for stability).
	const run = page.locator('input[type=checkbox][data-control=run]');
	await run.focus();
	await page.keyboard.press('Space');
	await expect(run).not.toBeChecked();
	const crank = range(page, 'crank');
	for (const [deg, stroke] of [
		['90', '1 · Intake'],
		['270', '2 · Compression'],
		['450', '3 · Power'],
		['630', '4 · Exhaust']
	]) {
		await crank.fill(deg);
		await expect(stage(page)).toContainText(stroke);
	}
	await crank.fill('360');
	await expect(stage(page)).toContainText(/Pressure\s*84\.4 bar/);
});

test('pushing the gas back the way it came leaves no net work', async ({ page }) => {
	await open(page, './heat-engines/#loop');
	await expect(stage(page)).toContainText(/Net work per cycle\s*51 J/);
	await page.locator('[data-control=back][data-value=same]').click();
	await expect(stage(page)).toContainText(/Net work per cycle\s*0 J/);
	await expect(stage(page)).toContainText('no area: no net work');
});

test('heating at constant pressure: 2/7 of the heat becomes work', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page, './heat-engines/#push');
	await expect(stage(page)).toContainText(/Work: pushing the piston\s*29 J/);
	await range(page, 'heatQ').fill('200');
	await expect(stage(page)).toContainText(/Work: pushing the piston\s*57 J/);
});

test('the Otto cycle stays below the Carnot limit between the same temperatures', async ({
	page
}) => {
	await open(page, './heat-engines/#compare');
	await expect(stage(page)).toContainText(/60\.2%\s*Otto cycle/);
	await expect(stage(page)).toContainText(/88\.0%\s*Carnot limit/);
	await range(page, 'ratio').fill('14');
	await range(page, 'tHot').fill('1500');
	await range(page, 'tCold').fill('400');
	await expect(stage(page)).toContainText('65.2%');
	await expect(stage(page)).toContainText('73.3%');
});

test('the steam plant: 43% against a Carnot limit of 63%, better with hotter steam and colder water', async ({
	page
}) => {
	await open(page, './heat-engines/#steam');
	await expect(stage(page)).toContainText(/Efficiency \(ideal cycle\)\s*43\.0%/);
	await expect(stage(page)).toContainText(/Carnot limit\s*63\.4%/);
	await range(page, 'steamT').fill('650');
	await range(page, 'condT').fill('15');
	await expect(stage(page)).toContainText(/Efficiency \(ideal cycle\)\s*47\.7%/);
	await expect(stage(page)).toContainText(/Carnot limit\s*68\.8%/);
});
