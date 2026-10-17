import { expect, test } from '@playwright/test';

test('index lists the built explainers under their catalogue category', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
	const biology = page.getByRole('region', { name: 'Biology' });
	await expect(biology.getByRole('link', { name: /how photosynthesis works/i })).toBeVisible();
	// Categories without a built topic are not shown.
	await expect(page.getByRole('heading', { level: 2, name: 'Reserve' })).toHaveCount(0);
	const card = page.getByRole('link', { name: /how photosynthesis works/i });
	await expect(card).toBeVisible();
	await card.click();
	await expect(page).toHaveURL(/\/photosynthesis\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/photosynthesis/i);
});

test('theme toggle switches and persists the theme', { tag: '@smoke' }, async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('./');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'light');
	await page.getByRole('button', { name: /toggle dark mode/i }).click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
});

test('the 404 page is built and links back home', async ({ page }) => {
	await page.goto('./404.html');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/nothing here/i);
	await page.getByRole('link', { name: /back to all explainers/i }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
});

test('an explainer links to its built catalogue neighbours', async ({ page }) => {
	await page.goto('./photosynthesis/');
	await expect(page.locator('header.title .eyebrow')).toContainText('Biology');
	const links = page.getByRole('navigation', { name: 'Related topics' });
	await expect(links.getByRole('heading', { name: 'Read first' })).toBeVisible();
	// the-cell is a built prerequisite: linked under its explainer title.
	await expect(links.getByRole('link', { name: 'Inside a cell' })).toBeVisible();
});

test('the index tracks reading progress in this browser and can clear it', async ({ page }) => {
	await page.goto('./');
	const tally = page.getByRole('region', { name: 'Your progress' });
	const total = Number((await tally.getByText(/^Total:/).textContent())!.replace(/\D/g, ''));
	expect(total).toBeGreaterThan(1);
	await expect(tally.getByText(/^New:/)).toHaveText(`New: ${total}`);
	const clear = tally.getByRole('button', { name: 'Clear all progress' });
	await expect(clear).toBeDisabled();
	const card = () => page.getByRole('link', { name: /how photosynthesis works/i });
	await expect(card()).toContainText('Start');

	// Opening an explainer and moving on a step: started, and the card continues there.
	await card().click();
	await expect(page).toHaveURL(/\/photosynthesis\/$/);
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#.+$/);
	const step = new URL(page.url()).hash;
	await page.goto('./');
	await expect(tally.getByText(/^Started:/)).toHaveText('Started: 1');
	await expect(tally.getByText(/^New:/)).toHaveText(`New: ${total - 1}`);
	await expect(card()).toContainText('Continue');
	await expect(card()).toHaveAttribute('href', new RegExp(`photosynthesis/${step}$`));

	// Reaching the last step: done.
	await card().click();
	await expect(page).toHaveURL(new RegExp(`${step}$`));
	await page.keyboard.press('End');
	await page.goto('./');
	await expect(tally.getByText(/^Done:/)).toHaveText('Done: 1');
	await expect(tally.getByText(/^Started:/)).toHaveText('Started: 0');
	await expect(card()).toContainText('Done');

	// Survives a reload; clearing (after confirming) resets everything.
	await page.reload();
	await expect(tally.getByText(/^Done:/)).toHaveText('Done: 1');
	page.once('dialog', (dialog) => dialog.accept());
	await clear.click();
	await expect(tally.getByText(/^New:/)).toHaveText(`New: ${total}`);
	await expect(card()).toContainText('Start');
	expect(await page.evaluate(() => localStorage.getItem('progress'))).toBeNull();
});

test(
	'search and filters narrow the index, and the address keeps them',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./');
		const cards = page.locator('main .grid > *');
		const total = await cards.count();
		const result = page.getByText(/^(All|Showing) \d+/);
		await expect(result).toHaveText(`All ${total} explainers`);

		// "/" jumps to the search box; words match titles regardless of case and apostrophes.
		await page.keyboard.press('/');
		const search = page.getByRole('searchbox', { name: 'Search the explainers' });
		await expect(search).toBeFocused();
		await page.keyboard.type('Photosynth');
		await expect(cards).toHaveCount(1);
		await expect(page.getByRole('link', { name: /how photosynthesis works/i })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Physics' })).toHaveCount(0);
		await expect(result).toContainText(`Showing 1 of ${total} explainers`);
		await search.fill('newtons laws');
		await expect(page.getByRole('link', { name: /newton's laws/i })).toBeVisible();
		await search.fill('');
		await expect(cards).toHaveCount(total);

		// Areas: any of the chosen ones.
		const area = page.getByRole('group', { name: 'Area' });
		await area.getByRole('button', { name: /^Physics/ }).click();
		await expect(page.getByRole('region', { name: 'Biology' })).toHaveCount(0);
		await area.getByRole('button', { name: /^Biology/ }).click();
		await expect(page.getByRole('region', { name: 'Physics' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Biology' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Space' })).toHaveCount(0);

		// Levels: only cards of the chosen level are left.
		const level = page.getByRole('group', { name: 'Level' });
		await level.getByRole('button', { name: /^Level 1/ }).click();
		const grid = page.locator('main .grid');
		await expect(grid.getByText(/^Level [23]$/)).toHaveCount(0);
		const shown = await cards.count();
		expect(shown).toBeGreaterThan(0);
		await expect(result).toContainText(`Showing ${shown} of ${total}`);

		// The filters live in the address: they survive a reload and coming back from a topic.
		await expect(page).toHaveURL(/\/\?area=physics,biology&level=1$/);
		await page.reload();
		await expect(cards).toHaveCount(shown);
		await expect(level.getByRole('button', { name: /^Level 1/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await cards.first().click();
		await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/how things work/i);
		await page.goBack();
		await expect(cards).toHaveCount(shown);

		// Nothing matches: say so, and clearing brings every topic back.
		await search.fill('zzzz');
		await expect(cards).toHaveCount(0);
		await expect(page.getByText('No explainer matches “zzzz” with these filters.')).toBeVisible();
		await page.getByRole('button', { name: 'Clear filters' }).last().click();
		await expect(cards).toHaveCount(total);
		await expect(search).toHaveValue('');
		await expect(page).toHaveURL(/\/how-things-work\/$/);
	}
);

test('on a phone the filters fold into Area and Level buttons', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./');
	const area = page.getByRole('group', { name: 'Area' });
	const physics = area.getByRole('button', { name: /^Physics/ });
	await expect(physics).toBeHidden();
	const toggle = page.getByRole('button', { name: 'Area', exact: true });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await physics.click();
	await expect(page.getByRole('region', { name: 'Biology' })).toHaveCount(0);
	// The button keeps saying how many areas are chosen once it is closed again.
	await page.getByRole('button', { name: /^Area/ }).click();
	await expect(physics).toBeHidden();
	await expect(page.getByRole('button', { name: /^Area/ })).toHaveAccessibleName('Area, 1 chosen');
});
