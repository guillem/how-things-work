import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const pick = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

/** Reduced motion: the scenes show the moment the slider sets. */
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

test('noising the cloud: the slider sets the step and the signal left', async ({ page }) => {
	await open(page, './diffusion-models/#noise-cloud', 'step t = 300 of 1000');
	await range(page, 't-cloud').fill('1000');
	await expect(stage(page)).toContainText('signal left √ᾱₜ = 0.006');
	await range(page, 't-cloud').fill('0');
	await expect(stage(page)).toContainText('signal left √ᾱₜ = 1.000');
});

test('the animation plays the noising, and moving the slider takes over', async ({ page }) => {
	await page.clock.install();
	await page.goto('./diffusion-models/#noise-cloud');
	await playUntil(page, stage(page), 'step t = 1000 of 1000', 12000);
	await expect(toggle(page, 'auto-cloud')).toBeChecked();
	await range(page, 't-cloud').fill('100');
	await expect(toggle(page, 'auto-cloud')).not.toBeChecked();
	await expect(stage(page)).toContainText('step t = 100 of 1000');
});

test('the 2-D model samples in the browser: more steps, more points on the moons', async ({
	page
}) => {
	await open(page, './diffusion-models/#few-steps', 'step 1 of 1');
	await pick(page, 'steps-few', '100');
	// the run is computed in a worker; the finished frame then shows its score
	await expect(stage(page)).toContainText('step 100 of 100', { timeout: 20000 });
	await expect(stage(page)).toContainText('points on a moon now: 87%');
	await pick(page, 'steps-few', '10');
	await expect(stage(page)).toContainText('points on a moon now: 62%', { timeout: 20000 });
});

test('guidance sends the points to the moon asked for', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './diffusion-models/#guidance-cloud', 'end on the upper moon: 92%');
	await range(page, 'g-guide').fill('1');
	await expect(stage(page)).toContainText('end on the upper moon: 100%', { timeout: 20000 });
	await range(page, 'g-guide').fill('7');
	await expect(stage(page)).toContainText('end on the upper moon: 60%', { timeout: 20000 });
	await pick(page, 'prompt-guide', 'none');
	await expect(stage(page)).toContainText('prompt none', { timeout: 20000 });
});

test('a generated digit: the prompt picks the run, the slider scrubs it', async ({ page }) => {
	await open(page, './diffusion-models/#reverse-digit', 'step 1000 of 1000 · t = 0');
	await expect(stage(page)).toContainText('the vision network reads it as a 3');
	await pick(page, 'digit', '8');
	await expect(stage(page)).toContainText('prompt “8” · guidance 3 · seed 1');
	await range(page, 'k-rdigit').fill('0');
	await expect(stage(page)).toContainText('step 0 of 1000 · t = 1000');
	await expect(stage(page)).toContainText('no guess yet');
});
