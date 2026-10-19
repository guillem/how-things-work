import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const pick = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

/** Reduced motion: a network step shows its run after 500 epochs, so the readouts are fixed. */
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

const numbers = (s: string) =>
	[...s.replaceAll('−', '-').matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));

test('a hand-set neuron: weights and the dragged input change its sum and its line', async ({
	page
}) => {
	await open(page, './neural-networks/#neuron', 'z = 2.0 × 0.35 + 1.5 × (−0.20) − 0.5 = −0.10');
	await expect(stage(page)).toContainText('2.0 x₁ + 1.5 x₂ − 0.5 = 0');
	await slider(page, 'w2').fill('-1');
	await expect(stage(page)).toContainText('2.0 x₁ − 1.0 x₂ − 0.5 = 0');
	const handle = page.getByRole('slider', { name: 'Input point (x₁, x₂)' });
	await handle.focus();
	await page.keyboard.press('ArrowUp');
	await expect(stage(page)).toContainText('× (−0.15)');
	await page.keyboard.press('Shift+ArrowRight');
	await expect(stage(page)).toContainText('2.0 × 0.85');
});

test('a single neuron splits the clusters but not the corners', async ({ page }) => {
	await open(page, './neural-networks/#train-neuron', 'first got every point right at epoch 2');
	await pick(page, 'data-neuron', 'xor');
	await expect(stage(page)).toContainText('after 500 epochs: still');
	await expect(stage(page)).toContainText('network 2 → 1');
});

test('a hidden layer of three traps the circle; two cannot', async ({ page }) => {
	await open(page, './neural-networks/#hidden', 'first got every point right at epoch 64');
	await expect(stage(page)).toContainText('network 2 → 3 → 1');
	await slider(page, 'neurons-hidden').fill('2');
	await expect(stage(page)).toContainText('after 500 epochs: still');
	await expect(stage(page)).toContainText('network 2 → 2 → 1');
});

test('without an activation the layers collapse; tanh and ReLU solve the circle', async ({
	page
}) => {
	await open(page, './neural-networks/#activation', 'no activation: the layers act as one neuron');
	await expect(stage(page)).toContainText('after 500 epochs: still');
	await pick(page, 'act-activation', 'tanh');
	await expect(stage(page)).toContainText('first got every point right at epoch 40');
	await expect(stage(page)).not.toContainText('act as one neuron');
	await pick(page, 'act-activation', 'relu');
	await expect(stage(page)).toContainText('first got every point right at epoch 9');
});

test('the spirals need depth', async ({ page }) => {
	await open(page, './neural-networks/#depth', 'after 500 epochs: still');
	await slider(page, 'layers-depth').fill('3');
	await expect(stage(page)).toContainText('first got every point right at epoch 231');
	await expect(stage(page)).toContainText('network 2 → 8 → 8 → 8 → 1 · ReLU');
});

test('the learning rate sets how fast training gets there', async ({ page }) => {
	await open(page, './neural-networks/#train', 'first got every point right at epoch 45');
	await pick(page, 'lr-train', '0.03');
	await expect(stage(page)).toContainText('first got every point right at epoch 387');
	await pick(page, 'lr-train', '0.01');
	await expect(stage(page)).toContainText('after 500 epochs: still');
});

test('stepping through: the update lowers the loss, matches the nudge, and moves on', async ({
	page
}) => {
	await open(page, './neural-networks/#update', 'example #1');
	await expect(stage(page)).toContainText('after 0 examples');
	const check = async () => {
		const text = (await stage(page).textContent()) ?? '';
		// "nudge that weight by +0.001 → the loss changes by C; slope × 0.001 = P"
		const [, change, , product] = numbers(text.split('check:')[1].split('after every')[0]);
		expect(Math.abs(change - product)).toBeLessThan(0.02 * Math.abs(product));
		const [before, after] = numbers(text.split('on this example goes')[1]).slice(0, 2);
		expect(after).toBeLessThan(before);
	};
	await check();
	await page.locator('button[data-control=example]').click();
	await expect(stage(page)).toContainText('example #2');
	await expect(stage(page)).toContainText('after 1 example');
	await check();
	// The count carries back to the forward pass.
	await page.getByRole('button', { name: 'Previous step' }).click();
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page).toHaveURL(/#forward$/);
	await expect(stage(page)).toContainText('example #2');
});

test('the playground: an unlucky start stalls on the corners; too big a step diverges', async ({
	page
}) => {
	await open(page, './neural-networks/#playground', 'first got every point right at epoch 49');
	// The recipe the training step gives: four corners, one layer of 2, Train again once.
	await pick(page, 'data-play', 'xor');
	await slider(page, 'layers-play').fill('1');
	await slider(page, 'neurons-play').fill('2');
	await expect(stage(page)).toContainText('first got every point right at epoch 17');
	await page.locator('.action button[data-control=again-play]').click();
	await expect(stage(page)).toContainText('after 500 epochs: still 50 wrong (best 75%)');
	// No activation and η = 3: the weights stop being numbers, and the verdict says so.
	await pick(page, 'data-play', 'moons');
	await slider(page, 'layers-play').fill('2');
	await slider(page, 'neurons-play').fill('4');
	await pick(page, 'act-play', 'linear');
	await pick(page, 'lr-play', '3');
	await expect(stage(page)).toContainText('diverged: the steps were too big');
	await expect(stage(page)).toContainText('right: none');
});

test('the bending step ends on the bent plane', async ({ page }) => {
	await open(page, './neural-networks/#bend', 'the bent plane: each point at (h₁, h₂)');
});

test('training runs live: the epochs count up until every point is right', async ({ page }) => {
	await page.clock.install();
	await page.goto('./neural-networks/#train');
	await expect(stage(page)).toContainText('epoch 0');
	await playUntil(page, stage(page), 'first got every point right at epoch 45', 20000);
});
