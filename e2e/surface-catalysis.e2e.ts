// Browser tests of the surface-catalysis page: the moves, a surface that keeps working, the two
// dead ends, the window against the mean field, desorption and a poisoned surface that recovers.
// The runs are seeded, so the reduced-motion frames (a fixed number of MCS per step) are exact.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);

test('the moves: a CO lands next to an O and they leave as CO₂', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./surface-catalysis/#moves');
	await expect(stage(page)).toContainText('CO landed next to an O: they reacted into CO₂');
	await expect(stage(page)).toContainText('CO₂ made');
});

test('a working surface turns over again and again: tens of CO₂ per site', async ({ page }) => {
	await page.clock.install();
	await page.goto('./surface-catalysis/#turnover');
	await playUntil(page, stage(page), /MCS [3-9]\d\d(?![\d,])/, 30_000);
	const text = (await stage(page).textContent()) ?? '';
	const perSite = Number(/CO₂ made per site so far: (\d+\.\d)/.exec(text)?.[1]);
	// about 0.15 per site per MCS, after 300 MCS or more
	expect(perSite).toBeGreaterThan(40);
	await expect(stage(page)).not.toContainText('Dead');
});

test('too little CO kills the surface with oxygen, too much with CO', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./surface-catalysis/#oxygen');
	await expect(stage(page)).toContainText('Dead: oxygen on every site');
	// a dead surface stays dead when the gas changes
	await range(page, 'y_ox').fill('0.45');
	await expect(stage(page)).toContainText('y = 0.450');
	await expect(stage(page)).toContainText('Dead: oxygen on every site');
	await page.goto('./surface-catalysis/#collapse');
	await expect(stage(page)).toContainText('Dead: CO on every site');
});

test(
	'the window: the lattice dies where the mean field still works',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./surface-catalysis/#window');
		await range(page, 'y_win').fill('0.3');
		await expect(stage(page)).toContainText('lattice 0.000 · mean field 0.064');
		await range(page, 'y_win').fill('0.5');
		await expect(stage(page)).toContainText('lattice 0.205 · mean field 0.250');
		// past y₂ both are dead on the lattice; the mean field only near 0.56
		await range(page, 'y_win').fill('0.55');
		await expect(stage(page)).toContainText('lattice 0.000 · mean field 0.336');
	}
);

test('desorption turns the cliff into a hill', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./surface-catalysis/#desorption');
	await pick(page, 'k_hot', '0.2');
	await range(page, 'y_hot').fill('0.645');
	await expect(stage(page)).toContainText('desorption k = 0.2');
	await expect(stage(page)).toContainText('lattice 0.129');
});

test('a CO-covered surface recovers only if CO can leave', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./surface-catalysis/#recover');
	await expect(stage(page)).toContainText('desorption k = 0.05');
	await expect(stage(page)).not.toContainText('Dead');
	await expect(stage(page)).toContainText(/θ_CO = 0\.0\d/);
	// without desorption the working surface carries on at y = 0.5, but a CO-covered one is dead
	await pick(page, 'k_rec', '0');
	await expect(stage(page)).toContainText('desorption k = 0');
	await expect(stage(page)).not.toContainText('Dead');
	await page.locator('button[data-control="restart_rec"]').click();
	await expect(stage(page)).toContainText('Dead: CO on every site');
});
