import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

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
	// The slider reaches the "too little to measure" region: 0.1% left is ten halvings.
	await slider.fill('0.1');
	await expect(stage(page)).toContainText('≈ 56,805 years old');
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

test('while the half-life eases to a new value, the header reads whole seconds', async ({
	page
}) => {
	await page.clock.install({ time: 0 });
	await open(page, './radioactivity/#halflife');
	await page.clock.pauseAt(20_000); // time moves only when the test says so
	const header = stage(page)
		.locator('text')
		.filter({ hasText: /^half-life / });
	await expect(header).toHaveText('half-life 8 s');
	await page.locator('input[type=range][data-control=halflife]').fill('20');
	await page.clock.runFor(150); // part-way through the easing
	expect(await header.textContent()).toMatch(/^half-life \d+ s$/);
	await page.clock.runFor(1000);
	await expect(header).toHaveText('half-life 20 s');
});

test('at a short half-life the plot keeps the quarter mark, the cards all three', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page, './radioactivity/#halflife');
	await page.locator('input[type=range][data-control=halflife]').fill('2');
	await expect(stage(page)).toContainText('1 half-life · 2 s');
	await expect(stage(page)).toContainText('2 half-lives · 4 s');
	await expect(stage(page)).toContainText('3 half-lives · 6 s');
	// The labels on the plot itself (right of its y axis, at x = 600 of 960):
	// 2, 4 and 6 s are a few pixels apart there, so only one is labelled —
	// the quarter left after two half-lives.
	const svg = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(svg.width / 960, svg.height / 600);
	const left = svg.x + (svg.width - 960 * k) / 2 + 600 * k;
	const onPlot = async (text: string) => {
		const found = stage(page)
			.locator('text')
			.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
		for (const box of await Promise.all((await found.all()).map((t) => t.boundingBox())))
			if (box && box.x > left) return true;
		return false;
	};
	expect(await onPlot('250')).toBe(true);
	expect(await onPlot('500')).toBe(false);
	expect(await onPlot('125')).toBe(false);
});
