import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

// The web scene runs about one simulated year per second; the deer take ~40 years to push
// the elk out. The tests play at 2× on Playwright's fake clock, which drives the animation
// frames, so simulated time doesn't depend on how busy the machine is.

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.clock.install();
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
	await page
		.getByRole('radiogroup', { name: 'Playback speed' })
		.getByRole('radio', { name: '2×' })
		.click();
}

test('without wolves the elk multiply', async ({ page }) => {
	await open(page, './ecosystems/#web');
	// The web arrives off balance and settles in the first few seconds.
	await expect(stage(page)).toContainText('Finding its balance');
	await playUntil(page, stage(page), /In balance/, 15_000);
	await page.getByRole('switch', { name: 'Wolves' }).uncheck({ force: true });
	await expect(stage(page)).toContainText('Following the ripples');
	await playUntil(page, stage(page), /Without wolves: .*elk \+\d+%/, 20_000);
	await expect(stage(page)).toContainText(/beavers −\d+%/);
});

test('deer arriving push the elk out', async ({ page }) => {
	await open(page, './ecosystems/#newcomer');
	await expect(stage(page)).toContainText('not here yet');
	await page.getByRole('switch', { name: 'Deer (newcomers)' }).check({ force: true });
	await playUntil(page, stage(page), /With deer: .*elk gone/, 60_000);
});

test('cycles: the chart scales tick at round numbers, aligned on both sides', async ({ page }) => {
	await page.clock.install();
	await page.goto('./ecosystems/#cycles');
	await expect(stage(page)).toContainText('foxes (right scale)');
	// Stop the clock: from here the animation moves only with runFor.
	await page.clock.pauseAt(Date.now() + 1000);
	// The y-axis tick labels: rabbits on the left of the chart, foxes on the right
	// (read in one go, so that the animation can't move on between the two).
	const ticks = () =>
		stage(page)
			.locator('text[font-size="11"]:not([text-anchor="middle"])')
			.evaluateAll((els) =>
				els
					.filter((e) => e.textContent?.trim() !== 'years')
					.map((e) => ({
						side: e.getAttribute('text-anchor'),
						text: e.textContent?.trim() ?? '',
						y: Number(e.getAttribute('y'))
					}))
			);
	async function check() {
		const all = await ticks();
		expect(all.filter((t) => !/^\d{1,3}(,\d{3})*$/.test(t.text))).toEqual([]);
		const l = all.filter((t) => t.side === 'end').map((t) => t.y);
		const r = all.filter((t) => t.side === 'start').map((t) => t.y);
		expect(r.length).toBe(l.length);
		r.forEach((y, i) => expect(y).toBeCloseTo(l[i], 1));
	}
	const slider = page.locator('input[type=range][data-control=death]');
	await slider.focus();
	// Foxes die faster: fewer of them for each rabbit, so the two scales change by different factors.
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
	// Mid-way through the rescaling, and once it has settled.
	await page.clock.runFor(250);
	await check();
	await page.clock.runFor(1000);
	await check();
});

test('cycles: rabbits hunted below one animal die out instead of rebounding', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ecosystems/#cycles');
	await expect(stage(page)).toContainText(/One cycle ≈/);
	// Fast-breeding rabbits, poor hunters, long-lived foxes: the first crash takes the
	// rabbits far below one animal, where a real population is gone.
	await page.locator('input[type=range][data-control=birth]').press('End');
	await page.locator('input[type=range][data-control=predation]').press('Home');
	await page.locator('input[type=range][data-control=death]').press('Home');
	await expect(stage(page)).toContainText('Rabbits died out');
	await expect(stage(page)).not.toContainText(/One cycle ≈/);
});

test('loop: the settings the text gives start the run at the balance point', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ecosystems/#loop');
	await expect(stage(page)).toContainText(/One cycle ≈/);
	// "birth rate 0.60, each fox catching 2.0% of the rabbits a year, and fox death rate 0.40"
	// (the catch is the default).
	const birth = page.locator('input[type=range][data-control=birth]');
	await birth.press('Home'); // 0.30
	for (let i = 0; i < 6; i++) await birth.press('ArrowRight');
	const death = page.locator('input[type=range][data-control=death]');
	await death.press('Home'); // 0.20
	for (let i = 0; i < 4; i++) await death.press('ArrowRight');
	await expect(page.locator('body')).toContainText('0.60 per year');
	await expect(page.locator('body')).toContainText('2.0% a year');
	await expect(page.locator('body')).toContainText('0.40 per year');
	await expect(stage(page)).toContainText('No cycle: the run starts at the balance point');
});
