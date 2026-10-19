// Browser tests of the ising-model page (named ising.e2e.ts: a name ending in -model.e2e.ts
// would be taken for a Node model test).
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);

test('the energy counts broken bonds: random, two domains, all up', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ising-model/#spins');
	await expect(stage(page)).toContainText('E = −J × (258 − 254) = −4 J');
	await pick(page, 'arrangement', 'domains');
	// two straight walls across a 16-spin torus: 32 broken bonds
	await expect(stage(page)).toContainText('E = −J × (480 − 32) = −448 J');
	await pick(page, 'arrangement', 'aligned');
	await expect(stage(page)).toContainText('E = −J × (512 − 0) = −512 J');
	await expect(stage(page)).toContainText('only 2 arrangements');
});

test('the Metropolis rule: flips that cost energy are accepted with e^(−ΔE/kT)', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ising-model/#metropolis');
	await expect(stage(page)).toContainText('the whole rule at kT = 2.50 J');
	await expect(stage(page)).toContainText('0.202'); // e^(−4/2.5)
	await expect(stage(page)).toContainText('0.041'); // e^(−8/2.5)
	await range(page, 'T_metro').fill('1');
	await expect(stage(page)).toContainText('the whole rule at kT = 1.00 J');
	await expect(stage(page)).toContainText('0.018'); // e^(−4)
});

test('domains grow out of noise below T_c: the energy falls towards −2 J per spin', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./ising-model/#quench');
	await playUntil(page, stage(page), /update [3-9]\d\d(?![\d,])/, 30_000);
	const text = (await stage(page).textContent()) ?? '';
	const e = Number(/energy per spin, E\/N \(J\)\s*−(\d\.\d\d)/.exec(text)?.[1]);
	expect(e).toBeGreaterThan(1.75);
});

test('the magnetisation curve: Onsager’s value at 64 × 64, a blurred one at 8 × 8', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ising-model/#order');
	await expect(stage(page)).toContainText('⟨|m|⟩ = 0.91');
	await expect(stage(page)).toContainText('Onsager: 0.91');
	await range(page, 'T_order').fill('3');
	await expect(stage(page)).toContainText('Onsager: 0.00');
	await pick(page, 'size_order', '8');
	await expect(stage(page)).toContainText('8 × 8 spins');
	await expect(stage(page)).toContainText('⟨|m|⟩ = 0.35');
});

test('the susceptibility peak grows and moves towards T_c with the lattice', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ising-model/#peaks');
	await range(page, 'T_peaks').fill('2.3');
	await expect(stage(page)).toContainText('χ′ = 69.4');
	await pick(page, 'size_peaks', '8');
	await range(page, 'T_peaks').fill('2.52');
	await expect(stage(page)).toContainText('χ′ = 1.77');
});

test('a swept field traces an open loop below T_c', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); // two whole loops
	await page.goto('./ising-model/#hysteresis');
	await expect(stage(page)).toContainText('below T꜀');
	await expect(stage(page)).toContainText('sweep 800');
	await range(page, 'T_hyst').fill('3');
	await expect(stage(page)).toContainText('above T꜀');
});

test('a ring never orders: |m| falls with its length at the same temperature', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ising-model/#chain');
	await expect(stage(page)).toContainText('ring of 1,024: ⟨|m|⟩ = 0.07');
	await expect(stage(page)).toContainText('correlation length ξ = 3.7 spins');
	await pick(page, 'size_chain', '64');
	await expect(stage(page)).toContainText('ring of 64: ⟨|m|⟩ = 0.28');
});
