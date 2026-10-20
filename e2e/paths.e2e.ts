import { expect, test } from '@playwright/test';

const title = 'How a language model works';

test(
	'a reader can follow the language-model path and return to searching',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./');
		const button = page.getByRole('button', { name: title, exact: true });
		await button.click();
		await expect(page).toHaveURL(/\/\?path=language-models$/);
		await expect(button).toHaveAttribute('aria-pressed', 'true');
		const reading = page.getByRole('region', { name: title, exact: true });
		await expect(reading).toContainText(
			'From a model that only counts the next word to one that is trained, aligned and served.'
		);
		for (const chapter of ['Counting', 'The network', 'The model', 'Training and serving']) {
			await expect(reading.getByRole('heading', { name: chapter, exact: true })).toBeVisible();
		}
		await expect(page.getByRole('region', { name: 'Biology', exact: true })).toHaveCount(0);
		const cards = reading.getByRole('link');
		await expect(cards).toHaveCount(16);
		await expect(cards.first()).toContainText('How machines learn from examples');
		await expect(cards.last()).toContainText('Speculative decoding');
		const titles = await cards.allTextContents();
		expect(titles.findIndex((text) => text.includes('How language models write'))).toBeLessThan(
			titles.findIndex((text) => text.includes('Tokenization & byte-pair encoding'))
		);
		await expect(reading.getByText('0 of 16 done', { exact: true })).toBeVisible();
		await expect(page.getByText(/^Showing \d+/)).toHaveCount(0);
		await page.reload();
		await expect(cards).toHaveCount(16);
		await expect(button).toHaveAttribute('aria-pressed', 'true');
		await button.click();
		await expect(page).toHaveURL(/\/how-things-work\/$/);
		await expect(page.getByRole('region', { name: 'Biology', exact: true })).toBeVisible();
		await button.click();
		await page.getByRole('searchbox', { name: 'Search the explainers' }).fill('Photosynth');
		await expect(page).toHaveURL(/\/\?q=Photosynth$/);
		await expect(reading).toHaveCount(0);
		await expect(button).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByRole('link', { name: /how photosynthesis works/i })).toBeVisible();
	}
);

test('the wide sidebar puts Path above Area', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('./');
	const path = page.getByRole('group', { name: 'Path', exact: true });
	const area = page.getByRole('group', { name: 'Area', exact: true });
	await expect(path).toBeVisible();
	await expect(area).toBeVisible();
	const pathBox = (await path.boundingBox())!;
	const areaBox = (await area.boundingBox())!;
	expect(pathBox.y + pathBox.height).toBeLessThanOrEqual(areaBox.y);
});

test('explainer paths give chapter, position, neighbours and shared progress', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./gradient-descent/');
	const nav = page.getByRole('navigation', { name: 'Path', exact: true });
	await expect(nav.getByRole('link', { name: title, exact: true })).toBeVisible();
	await expect(nav).toContainText('The network');
	await expect(nav).toContainText('Stop 3 of 16');
	await expect(
		nav.getByRole('link', { name: 'Next: Neural networks and backpropagation', exact: true })
	).toHaveAttribute('href', /\/neural-networks\/$/);
	await nav
		.getByRole('link', { name: 'Previous: Counting machines that write', exact: true })
		.click();
	await expect(page).toHaveURL(/\/ngram-text-models\/$/);
	await expect(nav).toContainText('Stop 2 of 16');
	await page.goto('./learning-from-data/');
	await expect(nav).toContainText('Stop 1 of 16');
	await expect(nav.getByRole('link', { name: /^Previous:/ })).toHaveCount(0);
	await expect(
		nav.getByRole('link', { name: 'Next: Counting machines that write', exact: true })
	).toBeVisible();
	await page.goto('./speculative-decoding/');
	await expect(nav).toContainText('Stop 16 of 16');
	await expect(nav.getByRole('link', { name: /^Next:/ })).toHaveCount(0);
	await expect(nav.getByRole('link', { name: /^Previous:/ })).toHaveAttribute(
		'href',
		/\/kv-cache-inference\/$/
	);
	await nav.getByRole('link', { name: title, exact: true }).click();
	await expect(page).toHaveURL(/\/\?path=language-models$/);
	const reading = page.getByRole('region', { name: title, exact: true });
	const first = reading.getByRole('link').first();
	await first.click();
	await expect(page).toHaveURL(/\/learning-from-data\/(#.*)?$/);
	// Wait for the interactive explainer to mount before using its keyboard shortcut.
	await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled();
	await page.keyboard.press('End');
	await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
	await nav.getByRole('link', { name: title, exact: true }).click();
	await expect(reading.getByText('1 of 16 done', { exact: true })).toBeVisible();
	await expect(first).toContainText('Done');
	await page.goto('./photosynthesis/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('photosynthesis');
	await expect(nav).toHaveCount(0);
});

test('direct path queries override shelf filters and unknown paths are dropped', async ({
	page
}) => {
	await page.goto('./?path=language-models&q=Photosynth&area=biology&level=1');
	await expect(page).toHaveURL(/\/\?path=language-models$/);
	await expect(
		page.getByRole('region', { name: title, exact: true }).getByRole('link')
	).toHaveCount(16);
	await page
		.getByRole('group', { name: 'Area', exact: true })
		.getByRole('button', { name: /^Biology/ })
		.click();
	await expect(page).toHaveURL(/\/\?area=biology$/);
	await expect(page.getByRole('region', { name: title, exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: title, exact: true }).click();
	await expect(page).toHaveURL(/\/\?path=language-models$/);
	await page
		.getByRole('group', { name: 'Level', exact: true })
		.getByRole('button', { name: /^Level 3/ })
		.click();
	await expect(page).toHaveURL(/\/\?level=3$/);
	await expect(page.getByRole('region', { name: title, exact: true })).toHaveCount(0);
	await page.goto('./?path=unknown-path');
	await expect(page).toHaveURL(/\/how-things-work\/$/);
	await expect(page.getByRole('region', { name: 'Biology', exact: true })).toBeVisible();
});

test('the path stays available on a phone while shelf filters are folded', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./?path=language-models');
	const button = page.getByRole('button', { name: title, exact: true });
	await expect(button).toBeVisible();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page.getByRole('group', { name: 'Area', exact: true }).getByRole('button').first()
	).toBeHidden();
	await expect(
		page.getByRole('group', { name: 'Level', exact: true }).getByRole('button').first()
	).toBeHidden();
});
