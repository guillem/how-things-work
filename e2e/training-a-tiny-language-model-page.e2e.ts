import { expect, test, type Page } from '@playwright/test';
// (Named "-page": a name ending in "-model.e2e.ts" would be taken for a Node model test.)

// The training explainer: what a visitor sees when they read a line with the model before and
// after training, scrub the stored loss curve, compare runs, shrink the training text, and train
// the model in the page. The numbers are the stored runs' (the model tests check them against
// the page's code). Reduced motion freezes every scene on its complete frame, and stops "play".
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('training lowers the surprise along a held-out line', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#surprise');
	// untrained: every character close to 1/65, an average surprise near ln 65
	await expect(stage(page)).toContainText('average surprise on this line: 4.1');
	await expect(stage(page)).toContainText('perplexity');
	await range(page, 'ckpt').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('read by the model after 3,000 steps');
	await expect(stage(page)).toContainText('average surprise on this line: 2.17');
	// after "BAPTISTA:" the trained model expects the line break
	await expect(stage(page)).toContainText('the real next character, “↵”');
});

test('clicking a character reads the guesses there', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#predict');
	await range(page, 'ckpt').focus();
	await page.keyboard.press('End');
	await stage(page).getByRole('button', { name: 'character 16' }).click();
	await expect(range(page, 'pos')).toHaveValue('16');
	await expect(stage(page)).toContainText('after “PTISTA:↵Good m” the model');
});

test('the stored run ends below the bigram and trigram lines', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#curve');
	await expect(stage(page)).toContainText('smoothed bigram, 2.49');
	await expect(stage(page)).toContainText('smoothed trigram, 2.09');
	await expect(stage(page)).toContainText('held-out text: 1.93 · perplexity 6.9');
	await range(page, 'at').focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('held-out text: 4.1');
	await expect(stage(page)).toContainText('Sample before training');
});

test('a wider model ends lower, and its weights are counted', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#compare');
	await expect(stage(page)).toContainText('30,721 weights');
	await choose(page, 'width', '64');
	await expect(stage(page)).toContainText('width 64 · context 32 · all 1,003,854 characters');
	await expect(stage(page)).toContainText('110,529 weights');
	await expect(stage(page)).toContainText('held-out text: 1.85');
});

test('the chart grows to fit the most overfitted run', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#compare');
	await choose(page, 'width', '64');
	await choose(page, 'context', '64');
	await choose(page, 'data', '10k');
	await expect(stage(page)).toContainText('held-out text: 7.37');
	// every point of both curves lies inside the stage
	const box = await page.locator('.stage svg').boundingBox();
	const paths = stage(page).locator('path[stroke-width="2.5"]');
	await expect(paths).toHaveCount(2);
	for (const b of await paths.evaluateAll((els) =>
		els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom }))
	)) {
		expect(b.top).toBeGreaterThanOrEqual(box?.y ?? 0);
	}
});

test('with 10,000 characters the model memorises', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#overfit');
	await expect(stage(page)).toContainText('10,000 characters');
	await expect(stage(page)).toContainText('lowest held-out, step');
	await expect(stage(page)).toContainText('training text: 0.62');
	// the sample's longest stretch found word for word in those 10,000 characters
	await expect(stage(page)).toContainText(/bold: \d+ characters copied from its training text/);
	await choose(page, 'odata', 'all');
	await expect(stage(page)).not.toContainText('lowest held-out, step');
});

test('training in the page retraces the stored run', async ({ page }) => {
	await page.goto('./training-a-tiny-language-model/#live');
	await expect(stage(page)).toContainText('press Train');
	await expect(page.locator('button[data-control=stop]')).toBeDisabled();
	await page.locator('button[data-control=train]').click();
	// past the measurements at steps 10 and 20, which match the stored ones
	await expect(stage(page)).toContainText(/step (2[1-9]|[3-9]\d|\d{3,}) of 3,000/, {
		timeout: 30_000
	});
	await expect(stage(page)).toContainText('largest gap from the stored run: 0.0000 nats', {
		timeout: 30_000
	});
	await expect(page.locator('button[data-control=stop]')).toBeEnabled();
	await page.locator('button[data-control=stop]').click();
	await expect(stage(page)).toContainText(/stopped at step \d+/);
});
