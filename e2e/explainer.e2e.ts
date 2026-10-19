import { expect, test, type Page } from '@playwright/test';

const stepTitle = (page: Page) => page.locator('aside h2');

/** Navigate and wait until the page is hydrated (the scene is rendered client-side only). */
async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.locator('.stage svg > g:not([data-leaving])')).toBeAttached();
}

test(
	'steps through the explainer with buttons and keyboard',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './photosynthesis/');
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);

		await page.getByRole('button', { name: 'Next step' }).click();
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);
		await expect(page).toHaveURL(/#leaf$/);

		await page.keyboard.press('ArrowRight');
		await expect(stepTitle(page)).toHaveText(/chloroplast/i);
		await page.keyboard.press('ArrowLeft');
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);

		await page.keyboard.press('End');
		await expect(stepTitle(page)).toHaveText(/why it matters/i);
		await expect(page.getByRole('button', { name: 'Next step' })).toBeDisabled();
		await page.keyboard.press('Home');
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
	}
);

test('after opening a deep link, the step buttons still move between steps', async ({ page }) => {
	await open(page, './photosynthesis/#pigments');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(stepTitle(page)).toHaveText(/catching a photon/i);
	await expect(page).toHaveURL(/#antenna$/);
	await page.getByRole('button', { name: 'Previous step' }).click();
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(stepTitle(page)).toHaveText(/chloroplast/i);
	await expect(page.locator('.counter .current')).toHaveText('3');
});

test('contents list jumps to a step', async ({ page }) => {
	await open(page, './photosynthesis/');
	await page.getByRole('navigation', { name: 'Steps' }).locator('summary').click();
	await page.getByRole('button', { name: /ATP synthase/ }).click();
	await expect(stepTitle(page)).toHaveText(/ATP synthase/);
	await expect(page).toHaveURL(/#atp$/);
});

test('play / pause and interactive controls', async ({ page }) => {
	await open(page, './photosynthesis/#pigments');
	const toggle = page.getByRole('button', { name: /pause animation/i });
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.click();
	await expect(page.getByRole('button', { name: /play animation/i })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	const slider = page.locator('input[type=range][data-control=wavelength]');
	await expect(slider).toBeVisible();
	await slider.fill('430');
	await expect(page.locator('output')).toHaveText(/430 nm/);
});

test('keyboard help overlay', async ({ page }) => {
	await open(page, './photosynthesis/');
	await page.keyboard.press('?');
	await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toHaveCount(0);
});

test.describe('keyboard shortcuts', () => {
	test('J / K and PageDown / PageUp move between steps', async ({ page }) => {
		await open(page, './photosynthesis/');
		await page.keyboard.press('j');
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);
		await page.keyboard.press('PageDown');
		await expect(stepTitle(page)).toHaveText(/chloroplast/i);
		await page.keyboard.press('k');
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);
		await page.keyboard.press('PageUp');
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
	});

	test('Space pauses and resumes the animation', async ({ page }) => {
		await open(page, './photosynthesis/');
		const play = page.locator('.controls .play');
		await expect(play).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press(' ');
		await expect(play).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press(' ');
		await expect(play).toHaveAttribute('aria-pressed', 'true');
	});

	test('R goes back to the first step and plays', async ({ page }) => {
		await open(page, './photosynthesis/#chloroplast');
		await page.keyboard.press(' ');
		await expect(page.locator('.controls .play')).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('r');
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
		await expect(page).toHaveURL(/#equation$/);
		await expect(page.locator('.controls .play')).toHaveAttribute('aria-pressed', 'true');
	});

	test('A toggles auto-advance and F toggles full screen', async ({ page }) => {
		await open(page, './photosynthesis/');
		const auto = page.getByRole('button', { name: 'Auto-advance steps' });
		await expect(auto).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('a');
		await expect(auto).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('a');
		await expect(auto).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('f');
		await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
		expect(await page.evaluate(() => document.fullscreenElement?.className)).toContain('explainer');
		await page.keyboard.press('f');
		await expect(page.getByRole('button', { name: 'Full screen', exact: true })).toBeVisible();
	});

	test('the help overlay closes on a click outside it', async ({ page }) => {
		await open(page, './photosynthesis/');
		await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
		await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
		await page.locator('.help-backdrop').click({ position: { x: 5, y: 5 } });
		await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toHaveCount(0);
	});
});

// The animation clock runs on requestAnimationFrame; Playwright's fake clock
// drives it deterministically. The first photosynthesis step lasts 16 s.
test.describe('auto-advance and speed', () => {
	test('auto-advance moves on when the step has played for its duration', async ({ page }) => {
		await page.clock.install();
		await open(page, './photosynthesis/');
		await page.keyboard.press('a');
		await page.clock.runFor(15_000);
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
		await page.clock.runFor(2_000);
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);
		await expect(page).toHaveURL(/#leaf$/);
	});

	test('at 2× a step plays out in half the time; the speed choice is a radio group', async ({
		page
	}) => {
		await page.clock.install();
		await open(page, './photosynthesis/');
		const speed = page.getByRole('radiogroup', { name: 'Playback speed' });
		await expect(speed.getByRole('radio', { name: '1×' })).toHaveAttribute('aria-checked', 'true');
		await speed.getByRole('radio', { name: '2×' }).click();
		await expect(speed.getByRole('radio', { name: '2×' })).toHaveAttribute('aria-checked', 'true');
		await expect(speed.getByRole('radio', { name: '1×' })).toHaveAttribute('aria-checked', 'false');
		await page.getByRole('button', { name: 'Auto-advance steps' }).click();
		await page.clock.runFor(7_000);
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
		await page.clock.runFor(2_000);
		await expect(stepTitle(page)).toHaveText(/inside the leaf/i);
	});

	test('auto-advance waits while paused', async ({ page }) => {
		await page.clock.install();
		await open(page, './photosynthesis/');
		await page.keyboard.press('a');
		await page.keyboard.press(' ');
		await page.clock.runFor(30_000);
		await expect(stepTitle(page)).toHaveText(/sunlight, water and air/i);
	});
});

test('glossary terms are focusable and show their definition on hover', async ({ page }) => {
	await open(page, './photosynthesis/#leaf');
	const term = page.locator('aside .body dfn[data-def]').first();
	await expect(term).toHaveText('epidermis');
	await expect(term).toHaveAttribute('tabindex', '0');
	await expect(term).toHaveAttribute('role', 'note');
	await expect(term).toHaveAttribute('aria-description', /outermost layer of cells of a leaf/);
	const tooltip = () =>
		term.evaluate((el) => {
			const s = getComputedStyle(el, '::after');
			return { display: s.display, content: s.content };
		});
	expect((await tooltip()).display).toBe('none');
	await term.hover();
	await expect.poll(async () => (await tooltip()).display).toBe('block');
	expect((await tooltip()).content).toContain('outermost layer of cells of a leaf');
});

test('"Go deeper" notes open on demand', async ({ page }) => {
	await open(page, './photosynthesis/');
	const notes = page.locator('aside details.notes');
	await expect(notes.getByText(/dozens of enzymes/)).toBeHidden();
	await notes.locator('summary').click();
	await expect(notes.getByText(/dozens of enzymes/)).toBeVisible();
});
