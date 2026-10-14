import { expect, test, type Page } from '@playwright/test';

// The attention explainer: what a visitor sees when they step through one attention operation of
// GPT-2 small, point at tokens in the explorer, pick named heads and look at the whole stack.
// Reduced motion freezes the scenes on a complete frame (t = 2.5 s, tweens instant).
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const token = (page: Page, name: RegExp) => stage(page).getByRole('button', { name });

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('one attention operation: scores, softmax weights and the mixed value', async ({ page }) => {
	await page.goto('./transformers/#scores');
	await expect(stage(page)).toContainText('8.5 ⁄ 8 = 1.06');
	await expect(stage(page)).toContainText('masked: later than “it”');
	await page.goto('./transformers/#weights');
	await expect(stage(page)).toContainText('0.922');
	await expect(stage(page)).toContainText('Σ weights = 1.000');
	await page.goto('./transformers/#mix');
	await expect(stage(page)).toContainText('value of “animal”, for comparison');
	await expect(stage(page)).toContainText('cosine between the two: 1.00');
});

test('clicking a token makes it the query; the slider follows', async ({ page }) => {
	await page.goto('./transformers/#weights');
	await token(page, /^Token street,/).click();
	await expect(range(page, 'fq')).toHaveValue('7');
	await expect(stage(page)).toContainText('masked: later than “street”');
	// The keyboard works too, without triggering the page's shortcuts.
	await token(page, /^Token was,/).focus();
	await page.keyboard.press('Enter');
	await expect(range(page, 'fq')).toHaveValue('10');
	await expect(page).toHaveURL(/#weights$/);
});

test('the explorer: point at a token, then pick a head in the 144-head grid', async ({ page }) => {
	await page.goto('./transformers/#explore');
	await expect(stage(page)).toContainText('“it” in layer 5, head 4');
	await expect(stage(page)).toContainText('0.92');
	await token(page, /^Token animal,/).hover();
	await expect(stage(page)).toContainText('“animal” in layer 5, head 4');
	await expect(range(page, 'tok')).toHaveValue('2');
	// The grid: 12 × 12 cells of 38 units from (482, 112); click layer 5, head 12.
	const box = (await stage(page).locator('rect.hit').boundingBox())!;
	await page.mouse.click(box.x + box.width * (11.5 / 12), box.y + box.height * (4.5 / 12));
	await expect(stage(page)).toContainText('“animal” in layer 5, head 12');
	await expect(range(page, 'head')).toHaveValue('12');
	await expect(stage(page)).toContainText('1.00');
});

test('changing the sentence keeps the token within it', async ({ page }) => {
	await page.goto('./transformers/#explore');
	await page.locator('button[data-control=s][data-value=tom]').click();
	await expect(stage(page)).toContainText('“he” in layer 5, head 4');
});

test('heads with a job: induction and the name mover', async ({ page }) => {
	await page.goto('./transformers/#patterns');
	await expect(stage(page)).toContainText('“6” in layer 5, head 12');
	await page.locator('button[data-control=pattern][data-value=induction]').click();
	await expect(stage(page)).toContainText('“fox” in layer 6, head 6');
	await expect(stage(page)).toContainText('0.96');
	await page.locator('button[data-control=pattern][data-value=names]').click();
	await expect(stage(page)).toContainText('“to” in layer 10, head 10');
	await expect(stage(page)).toContainText('0.67');
});

test('twelve heads of a layer, each with its own pattern', async ({ page }) => {
	await page.goto('./transformers/#heads');
	await expect(stage(page)).toContainText('Layer 5: its 12 heads');
	await expect(stage(page)).toContainText('previous token');
	await expect(stage(page)).toContainText('looks at “animal”');
	// the layer readout: how much rests on ⟨start⟩ and how far back the rest reaches
	await expect(stage(page)).toContainText('this layer: 58% of all attention on ⟨start⟩');
	await expect(stage(page)).toContainText('on average 2.3 tokens back');
	await range(page, 'layer').fill('11');
	await expect(stage(page)).toContainText('this layer: 84% of all attention on ⟨start⟩');
	await expect(stage(page)).toContainText('on average 3.9 tokens back');
	await range(page, 'layer').fill('1');
	await expect(stage(page)).toContainText('Layer 1: its 12 heads');
	await expect(stage(page)).toContainText('itself');
});

test('learned positions: the slider picks the row compared', async ({ page }) => {
	await page.goto('./transformers/#positions');
	await expect(stage(page)).toContainText('next door, 11: 0.998');
	await range(page, 'pos').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Position 63 compared with every other');
});

test('the stack ends in a next-token prediction', async ({ page }) => {
	await page.goto('./transformers/#stack');
	await expect(stage(page)).toContainText('Italy');
	await expect(stage(page)).toContainText('35.4%');
	await expect(stage(page)).toContainText('124,439,808 learned numbers in all');
	await page.locator('button[data-control=stackS][data-value=count]').click();
	await expect(stage(page)).toContainText('96.3%');
});
