import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slide = (page: Page, control: string, value: string) =>
	page.locator(`input[type=range][data-control="${control}"]`).fill(value);

test('pumping two levels harder never inverts them; four levels invert at any pump', async ({
	page
}) => {
	await page.goto('./lasers/#two-level');
	await slide(page, 'rate', '3'); // W·τ = 1,000
	await expect(stage(page)).toContainText('0.4998'); // upper level, just under half
	await expect(stage(page)).toContainText('(N₂ − N₁)/N = −');
	await expect(stage(page)).toContainText('never, at any pump');

	await page.goto('./lasers/#three-level');
	await expect(stage(page)).toContainText('2,900 W of pump');

	await page.goto('./lasers/#four-level');
	await slide(page, 'rate', '-4'); // one ion in ten thousand
	await expect(stage(page)).toContainText('out: ×1.02');
	await expect(stage(page)).toContainText('1.07 W of pump');
});

test('below threshold a few photons; above it the inversion clamps and the output is a line', async ({
	page
}) => {
	await page.goto('./lasers/#cavity');
	await expect(stage(page)).toContainText('photons in the mode: 2.97');
	await expect(stage(page)).toContainText('threshold 1.07 W');

	await page.goto('./lasers/#threshold');
	await slide(page, 'pump', '5');
	await expect(stage(page)).toContainText('photons in the mode: 1.5·10¹¹');
	await expect(stage(page)).toContainText('inversion: 1.0000 × Nₜₕ');
	await slide(page, 'pump', '10');
	await expect(stage(page)).toContainText('inversion: 1.0000 × Nₜₕ');

	await page.goto('./lasers/#output');
	await slide(page, 'pump', '2');
	await expect(stage(page)).toContainText('output 509 mW');
	await slide(page, 'pump', '5');
	await expect(stage(page)).toContainText('output 2.15 W');
	await expect(stage(page)).toContainText('slope 55%');
});

test('the output mirror has an optimum, and a leakier one raises the threshold', async ({
	page
}) => {
	await page.goto('./lasers/#mirror');
	await expect(stage(page)).toContainText('best ≈ 94.0%');
	await slide(page, 'R', '0.8');
	await expect(stage(page)).toContainText('threshold 3.65 W');
	await slide(page, 'R', '0.999');
	await expect(stage(page)).toContainText('threshold 0.31 W');
	await expect(stage(page)).toContainText('output 169 mW');
});

test('switched on, the laser spikes at the relaxation frequency', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); // the whole trace at once
	await page.goto('./lasers/#spiking');
	await expect(stage(page)).toContainText('first spike 22.3 W');
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(/late spikes every ([\d.]+) µs · formula 2π\/ω = ([\d.]+) µs/);
	expect(m).not.toBeNull();
	const [measured, formula] = [Number(m?.[1]), Number(m?.[2])];
	expect(Math.abs(measured / formula - 1)).toBeLessThan(0.03);
});

test('a closed shutter stores the inversion, and opening it gives a giant pulse', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./lasers/#q-switch');
	await expect(stage(page)).toContainText('peak 21.6 kW');
	await expect(stage(page)).toContainText('20 ns wide');
	await expect(stage(page)).toContainText('energy 0.51 mJ');
	await expect(stage(page)).toContainText('Wagner–Lengyel predicts 0.089 Nₜₕ');
	await slide(page, 'hold', '0');
	await expect(stage(page)).toContainText('no shutter: the laser only spikes');
});
