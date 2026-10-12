import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('carbon-14 dating reads the age off the amount left', async ({ page }) => {
	await open(page, './radioactivity/#dating');
	// The default sample has 25% left: two half-lives of 5,700 years.
	await expect(stage(page)).toContainText('≈ 11,400 years old');
	await expect(stage(page)).toContainText('± 60 years');
	const slider = page.locator('input[type=range][data-control=fraction]');
	await slider.fill('50');
	await expect(stage(page)).toContainText('≈ 5,700 years old');
	await slider.fill('100');
	await expect(stage(page)).toContainText('Alive, or only just dead');
});

test('a shorter half-life makes the same sample decay sooner', async ({ page }) => {
	await page.clock.install();
	await open(page, './radioactivity/#halflife');
	const slider = page.locator('input[type=range][data-control=halflife]');
	await slider.fill('2');
	await playUntil(page, stage(page), 'All decayed', 45_000);
	// Same moment, a 30 s half-life: less than one half-life has gone by.
	await slider.fill('30');
	await expect(stage(page)).not.toContainText('All decayed');
	await expect(stage(page)).toContainText(/0\.\d half-lives: \d{3} left/);
});

test('after two half-lives about a quarter is left, not none', async ({ page }) => {
	await page.clock.install();
	await open(page, './radioactivity/#quarter');
	await playUntil(page, stage(page), 'Stopped at 2 half-lives', 30_000);
	await expect(stage(page)).toContainText('a quarter, not zero');
	const left = await stage(page)
		.getByText(/Stopped at 2 half-lives: \d+ left/)
		.textContent();
	const n = Number(/(\d+) left/.exec(left ?? '')?.[1]);
	// Expected 250; a binomial sample of 1,000 stays well within ±60 of it.
	expect(n).toBeGreaterThan(190);
	expect(n).toBeLessThan(310);
});

test('the decay switch changes the element as each kind of decay should', async ({ page }) => {
	await open(page, './radioactivity/#compare');
	const kind = (name: string) => page.getByRole('radio', { name });
	await expect(stage(page)).toContainText('Neptunium-237');
	await kind('Beta').click();
	await expect(stage(page)).toContainText('Nitrogen-14');
	await kind('Gamma').click();
	await expect(stage(page)).toContainText('Technetium-99');
	await expect(stage(page)).toContainText('Z, A same');
});
