import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

/** Reduced motion: the stage shows each run complete, so its final readouts are deterministic. */
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

/** Clicks the contour map at a point given in stage units (960 × 600). */
async function clickStage(page: Page, x: number, y: number) {
	const box = (await page.locator('.stage svg').first().boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	await page.mouse.click(ox + x * k, oy + y * k);
}

test('settings: moving the point on the map changes the line and its error', async ({ page }) => {
	await open(page, './gradient-descent/#settings', 'loss (mean squared error) = 3.35');
	await expect(stage(page)).toContainText('y = −1.50 · x + 1.50');
	const handle = page.getByRole('slider', { name: 'Starting point on the map' });
	await handle.focus();
	await page.keyboard.press('Shift+ArrowRight');
	await expect(stage(page)).toContainText('slope a = −1.17');
	await expect(stage(page)).not.toContainText('loss (mean squared error) = 3.35');
	// The point is kept on the next step, which shows the same settings as a landscape.
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#landscape$/);
	await expect(stage(page)).toContainText('slope a = −1.17');
	await expect(stage(page)).toContainText('lowest possible loss, at the ×: 0.118');
});

test('compare: too small crawls, about right converges, too big diverges', async ({ page }) => {
	await open(page, './gradient-descent/#compare', 'η = 0.05: too small: crawls');
	await expect(stage(page)).toContainText('reached the bottom at step 74');
	await expect(stage(page)).toContainText('reached the bottom at step 5');
	await expect(stage(page)).toContainText('diverged: flew off the map');
	await expect(stage(page)).toContainText('↑ off the top');
});

test('learning rate: the bowl converges below η = 2 and diverges above it', async ({ page }) => {
	await open(page, './gradient-descent/#learning-rate', 'reached the bottom at step 5');
	await expect(stage(page)).toContainText('× (1 − η) = × 0.4');
	await slider(page, 'lr').fill('1');
	await expect(stage(page)).toContainText('reached the bottom at step 1');
	await slider(page, 'lr').fill('1.9');
	await expect(stage(page)).toContainText('× (1 − η) = × −0.9');
	await expect(stage(page)).toContainText('reached the bottom at step 36');
	await slider(page, 'lr').fill('2.1');
	await expect(stage(page)).toContainText('diverged: flew off the map');
});

test('momentum gets down the ravine in far fewer steps', async ({ page }) => {
	await open(page, './gradient-descent/#momentum', 'reached the bottom at step 190');
	await slider(page, 'momentum').fill('0.8');
	await expect(stage(page)).toContainText('reached the bottom at step 28');
	await expect(stage(page)).toContainText('momentum β = 0.8');
});

test('valleys: clicking the map drops the ball, and the start decides the valley', async ({
	page
}) => {
	await open(page, './gradient-descent/#valleys', 'reached a shallower valley');
	// Near the deepest valley, at (1.6, −0.5) on the map.
	await clickStage(page, 548 + (4.6 / 6) * 372, 402 - (2.5 / 6) * 372);
	await expect(stage(page)).toContainText('reached the deepest valley');
});

test('noise can shake the ball out of the shallowest valley', async ({ page }) => {
	await open(page, './gradient-descent/#noise', 'reached the shallowest valley');
	await slider(page, 'noise').fill('1');
	await expect(stage(page)).toContainText('wandering around the deepest valley');
	await expect(stage(page)).toContainText('noise 1');
});

test('training the line: full batches settle on least squares, single examples wander', async ({
	page
}) => {
	await open(page, './gradient-descent/#train', 'reached the bottom at step 19');
	await expect(stage(page)).toContainText('loss = 0.118');
	await expect(stage(page)).toContainText('y = 0.20 · x − 0.04');
	await page.locator('button[data-control=batch][data-value="1"]').click();
	await expect(stage(page)).toContainText('wandering around the bottom');
	await expect(stage(page)).toContainText('1 example per step');
});

test('the ball steps downhill as the animation plays', async ({ page }) => {
	await page.clock.install();
	await page.goto('./gradient-descent/#descend');
	await expect(stage(page)).toContainText('step 0');
	await playUntil(page, stage(page), 'reached the bottom at step 19', 20000);
	await expect(stage(page)).toContainText('loss = 0.118');
});
