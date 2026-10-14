import { expect, test, type Page } from '@playwright/test';

// The embeddings explainer: what a visitor sees when they pick words, search the map, do word
// arithmetic and compare sentences. Reduced motion freezes the scenes on a complete frame
// (t = 2.5 s, tweens instant), so every number is on the stage at once.
const stage = (page: Page) => page.locator('.stage svg > g');

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('two words: their cosine and the angle between them', async ({ page }) => {
	await page.goto('./embeddings/#angle');
	await expect(stage(page)).toContainText('sum of the 100 products = 0.75');
	await expect(stage(page)).toContainText('θ = 41°');
	await page.locator('button[data-control=b][data-value=banana]').click();
	await expect(stage(page)).toContainText('sum of the 100 products = 0.16');
	await expect(stage(page)).toContainText('θ = 81°');
});

test('searching a word lists its nearest neighbours, and typing never triggers shortcuts', async ({
	page
}) => {
	await page.goto('./embeddings/#search');
	await expect(stage(page)).toContainText('prince');
	const box = page.getByRole('textbox', { name: 'Word to search' });
	await box.fill('');
	// "r", "a", "f" and "k" are shortcuts elsewhere on the page.
	await box.pressSequentially('rafk');
	await expect(page).toHaveURL(/#search$/);
	await expect(stage(page)).toContainText('“rafk” is not among');
	await box.fill('cat');
	await expect(stage(page).locator('text', { hasText: /^dog$/ }).first()).toBeAttached();
	await expect(stage(page)).toContainText('0.88');
	await expect(box).toHaveAttribute('aria-invalid', 'false');
});

test('the PCA map keeps fewer true neighbours close than the t-SNE map', async ({ page }) => {
	await page.goto('./embeddings/#distort');
	const kept = async () =>
		Number(
			(
				await stage(page)
					.locator('text', { hasText: /among its 10 closest dots: \d+ of 10/ })
					.textContent()
			)?.match(/(\d+) of 10/)?.[1]
		);
	await expect(stage(page)).toContainText('t-SNE map');
	const tsne = await kept();
	await page.locator('button[data-control=proj][data-value=pca]').click();
	await expect(stage(page)).toContainText('PCA map');
	await expect(stage(page)).toContainText('among its 10 closest dots: 0 of 10');
	expect(tsne).toBeGreaterThan(0);
});

test('the map zooms with the buttons and the keyboard', async ({ page }) => {
	await page.goto('./embeddings/#map');
	await expect(stage(page)).toContainText('zoom × 1.0');
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(stage(page)).toContainText('zoom × 1.6');
	await page.getByRole('application', { name: /Map of 3292 words/ }).press('+');
	await expect(stage(page)).toContainText('zoom × 2.6');
	await page.getByRole('button', { name: 'Show the whole map' }).click();
	await expect(stage(page)).toContainText('zoom × 1.0');
});

test('king − man + woman: queen, unless the input words are allowed', async ({ page }) => {
	await page.goto('./embeddings/#analogy');
	await expect(stage(page)).toContainText('1. queen');
	const toggle = page.locator('label.toggle', { hasText: 'Leave out the three input words' });
	await toggle.click();
	await expect(stage(page)).toContainText('The closest word is king itself');
	await toggle.click();
	await expect(stage(page)).toContainText('1. queen');
	await page.getByRole('button', { name: 'Use paris minus france plus italy' }).click();
	await expect(page.getByRole('textbox', { name: 'First word' })).toHaveValue('paris');
	await expect(stage(page)).toContainText('1. rome');
	await page.getByRole('textbox', { name: 'Word to add' }).fill('spain');
	await expect(stage(page)).toContainText('1. madrid');
});

test('relationships: each set of pairs points one way', async ({ page }) => {
	await page.goto('./embeddings/#directions');
	await expect(stage(page)).toContainText('king → queen');
	await page.locator('button[data-control=rel][data-value=capital]').click();
	await expect(stage(page)).toContainText('france → paris');
	await expect(stage(page)).toContainText('france → paris0.89');
});

test('a failed analogy shows where the expected word ranks', async ({ page }) => {
	await page.goto('./embeddings/#failures');
	await expect(stage(page)).toContainText('1. daughter');
	await expect(stage(page)).toContainText('Expected: sister');
	await page.locator('button[data-control=fail][data-value=doctor]').click();
	await expect(stage(page)).toContainText('1. nurse');
});

test('sentences: no shared word but a small angle; same words in another order: 1.00', async ({
	page
}) => {
	await page.goto('./embeddings/#sentences');
	await expect(stage(page)).toContainText('cos θ = 0.89');
	await page.getByRole('textbox', { name: 'Sentence 2' }).fill('my cat sat in the garden');
	await expect(stage(page)).toContainText('cos θ = 0.');
	await expect(stage(page)).not.toContainText('cos θ = 0.89');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(stage(page)).toContainText('the dog bit the man');
	await expect(stage(page)).toContainText('cos θ = 1.00');
});
