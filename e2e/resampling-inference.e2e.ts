import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const pick = (page: Page, control: string, value: string) =>
	page.locator(`button[data-control="${control}"][data-value="${value}"]`).click();

test('the shuffles pile up into a histogram of what chance alone produces', async ({ page }) => {
	await page.clock.install();
	await page.goto('./resampling-inference/#shuffle');
	await expect(stage(page)).toContainText('+5.87 mm');
	await playUntil(page, stage(page), '9,999 of 9,999', 30_000);
	// a shuffle deals the labels out again: the rows' averages are the shuffled ones
	await expect(stage(page)).toContainText('shuffled label “Adelie”');
});

test('the p-value counts the shuffles as far from 0 as the real gap, plus one', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); // every shuffle already counted
	await page.goto('./resampling-inference/#p-value');
	// all the penguins: no shuffle gets there, and p is 1 / (9,999 + 1), not 0
	await expect(stage(page)).toContainText('p = (0 + 1) / (9,999 + 1)');
	await expect(stage(page)).toContainText('p = 0.0001');
	// five per group: the same species difference, but the data can no longer tell
	await pick(page, 'perGroup', '5');
	await expect(stage(page)).toContainText('5 penguins');
	await expect(stage(page)).toContainText('p = 0.053');
	// two islands' Adelie penguins: a gap chance produces about one time in 14
	await pick(page, 'perGroup', 'all');
	await pick(page, 'comparison', 'torgersen');
	await expect(stage(page)).toContainText('+2.40 mm');
	await expect(stage(page)).toContainText('p = 0.072');
});

test('the bootstrap puts a percentile interval on the difference', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./resampling-inference/#bootstrap');
	await expect(stage(page)).toContainText('2,000 of 2,000');
	await expect(stage(page)).toContainText('3.8 to 7.8 mm');
	// fewer penguins, a wider interval
	await pick(page, 'perGroup', '10');
	await expect(stage(page)).toContainText(/\d+\.\d to 1\d\.\d mm/);
});

test('the slope of mass on flipper length, with its interval, for each species', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./resampling-inference/#slope');
	await expect(stage(page)).toContainText('32.8 g per mm');
	await pick(page, 'species', 'Gentoo');
	await expect(stage(page)).toContainText('54.6 g per mm');
	await expect(stage(page)).toContainText('1,000 of 1,000');
});

test('the coverage counter shows the shortfall, and the maximum’s collapse', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); // all 300 repeats done
	await page.goto('./resampling-inference/#coverage');
	await expect(stage(page)).toContainText('within chance of 95%');

	// ten values from a skewed population: well short of the 95% claimed
	await page.goto('./resampling-inference/#shortfall');
	await expect(stage(page)).toContainText('of 300');
	await expect(stage(page)).toContainText('short of 95% by more than chance');
	await expect(stage(page)).toContainText('84.0%');
	// a large sample brings it back
	await page.locator('input[type=range][data-control="n:shortfall"]').fill('200');
	await expect(stage(page)).toContainText('within chance of 95%');

	// the maximum: the intervals never reach it
	await page.goto('./resampling-inference/#maximum');
	await expect(stage(page)).toContainText('true maximum');
	await expect(stage(page)).toContainText(/\b[0-3]\.\d%/);
	await expect(stage(page)).toContainText('short of 95% by more than chance');
});
