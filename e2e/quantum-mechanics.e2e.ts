import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

/** The number shown under a panel caption, e.g. "fringe visibility" → 0.02. */
async function readout(page: Page, caption: string) {
	const texts = await stage(page).locator('text').allTextContents();
	const i = texts.findIndex((s) => s.trim() === caption);
	expect(i, caption).toBeGreaterThanOrEqual(0);
	return parseFloat(texts[i + 1].replace(/[,≈\s]/g, ''));
}

test('electrons arrive one at a time, each as one dot', async ({ page }) => {
	await page.clock.install();
	await open(page, './quantum-mechanics/#dots');
	await page.clock.runFor(2500);
	const early = await readout(page, 'electrons landed');
	expect(early).toBeGreaterThan(0);
	expect(early).toBeLessThan(15);
	await page.clock.runFor(2500);
	expect(await readout(page, 'electrons landed')).toBeGreaterThan(early);
});

test.describe('finished pictures', () => {
	// Reduced motion shows each step's finished run.
	test.use({ reducedMotion: 'reduce' });

	test('two amplitudes cancel at a dark fringe and add at a bright one', async ({ page }) => {
		await open(page, './quantum-mechanics/#amplitudes');
		await expect(stage(page)).toContainText('0% of the brightest');
		await range(page, 'probe').fill('0');
		await expect(stage(page)).toContainText('100% of the brightest');
	});

	test('a which-slit record removes the fringes, whether or not anyone reads it', async ({
		page
	}) => {
		await open(page, './quantum-mechanics/#detector');
		// No detector: fringes.
		await expect(stage(page)).toContainText('none: the detector is off');
		expect(await readout(page, 'fringe visibility')).toBeGreaterThan(0.95);
		// Switch it on: the fringes go.
		await toggle(page, 'detector').check();
		await expect(stage(page)).toContainText('made, but nobody reads it');
		expect(await readout(page, 'fringe visibility')).toBeLessThan(0.05);
		// Reading the record changes nothing about the pattern.
		await toggle(page, 'reading').check();
		await expect(stage(page)).toContainText('T top · B bottom');
		expect(await readout(page, 'fringe visibility')).toBeLessThan(0.05);
	});

	test('a partial record leaves partial fringes', async ({ page }) => {
		await open(page, './quantum-mechanics/#partial');
		await range(page, 'record').fill('0');
		expect(await readout(page, 'fringe visibility')).toBeGreaterThan(0.95);
		await range(page, 'record').fill('60');
		// γ = √(1 − 0.6²) = 0.8
		expect(await readout(page, 'fringe visibility')).toBeCloseTo(0.8, 1);
		await range(page, 'record').fill('100');
		expect(await readout(page, 'fringe visibility')).toBeLessThan(0.05);
	});

	test('a packet spreads while its total probability stays 1', async ({ page }) => {
		await open(page, './quantum-mechanics/#packet');
		await expect(stage(page)).toContainText('1.0000');
		expect(await readout(page, 'spread σ')).toBeGreaterThan(1);
		await expect(stage(page)).toContainText('1.23 nm');
	});

	test('a smaller box has higher energy levels', async ({ page }) => {
		await open(page, './quantum-mechanics/#box');
		await expect(stage(page)).toContainText('0.38 eV');
		await range(page, 'boxL').fill('0.5');
		// Half the width, four times the energies: E₁ = 1.50 eV, E₂ = 6.02 eV.
		await expect(stage(page)).toContainText('6.02 eV');
		await expect(stage(page)).not.toContainText('0.38 eV');
	});

	test('part of the packet tunnels, less through a wider or higher barrier', async ({ page }) => {
		await open(page, './quantum-mechanics/#barrier');
		await expect(stage(page)).toContainText('always bounce back');
		const start = await readout(page, 'probability through');
		expect(start).toBeCloseTo(27, 0);
		await range(page, 'width').fill('0.5');
		expect(await readout(page, 'probability through')).toBeCloseTo(2.5, 0);
		await range(page, 'height').fill('3');
		expect(await readout(page, 'probability through')).toBeLessThan(1);
		// Below the electron's energy it rolls over — mostly.
		await range(page, 'height').fill('0.5');
		await expect(stage(page)).toContainText('always roll over');
		const through = await readout(page, 'probability through');
		expect(through).toBeGreaterThan(80);
		expect(through).toBeLessThan(100);
	});

	test('counts of single detections match the share of the wave that tunnelled', async ({
		page
	}) => {
		await open(page, './quantum-mechanics/#measure');
		expect(await readout(page, 'electrons sent')).toBe(400);
		const texts = await stage(page).locator('text').allTextContents();
		const found = texts.find((s) => /^\d+\s+\(/.test(s.trim())) ?? '';
		const share = parseFloat(found.split('(')[1]);
		expect(share).toBeGreaterThan(22);
		expect(share).toBeLessThan(32);
	});

	test('the tunnelling microscope current falls about ninefold per 0.1 nm', async ({ page }) => {
		await open(page, './quantum-mechanics/#stm');
		await expect(stage(page)).toContainText('current ÷ 8.8');
		await range(page, 'gap').fill('0.6');
		await expect(stage(page)).toContainText('0.11×');
	});
});

test('each run ends with exactly one detector clicking', async ({ page }) => {
	await page.clock.install();
	await open(page, './quantum-mechanics/#measure');
	await playUntil(page, stage(page), /click: found on the (left|right)/, 10_000);
	const clicks = await stage(page)
		.locator('text', { hasText: /^click: found/ })
		.count();
	expect(clicks).toBe(1);
	expect(await readout(page, 'electrons sent')).toBe(1);
});
