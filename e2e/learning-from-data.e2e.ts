import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const degree = (page: Page) => page.locator('input[type=range][data-control=degree]');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('flexible: the degree sets the model and its training error', async ({ page }) => {
	await open(page, './learning-from-data/#flexible', 'degree 3: up to 2 bends');
	await expect(stage(page)).toContainText('training error0.084');
	await degree(page).fill('1');
	await expect(stage(page)).toContainText('degree 1: a straight line');
	await expect(stage(page)).toContainText('training error0.118');
	await degree(page).fill('12');
	await expect(stage(page)).toContainText('degree 12: up to 11 bends');
	await expect(stage(page)).toContainText('training error0.0086');
	await expect(stage(page)).toContainText('the curve goes off the chart');
});

test('the degree is kept when moving to the next step and back', async ({ page }) => {
	await open(page, './learning-from-data/#flexible', 'degree 3');
	await degree(page).fill('12');
	await expect(stage(page)).toContainText('degree 12: up to 11 bends');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#overfit$/);
	await expect(degree(page)).toHaveValue('12');
	await expect(stage(page)).toContainText('swings wildly past the end dots');
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page).toHaveURL(/#flexible$/);
	await expect(degree(page)).toHaveValue('12');
	await expect(stage(page)).toContainText('degree 12: up to 11 bends');
});

test('overfit: the verdict follows the degree and the true curve can be shown', async ({
	page
}) => {
	await open(page, './learning-from-data/#overfit', 'Too stiff to follow the pattern');
	await expect(stage(page)).not.toContainText('true curve: the hidden rule');
	await degree(page).fill('12');
	await expect(stage(page)).toContainText('It bends to chase the dots');
	await expect(stage(page)).toContainText('wild swing past the last dot');
	await page.locator('input[type=checkbox][data-control=truth]').check({ force: true });
	await expect(stage(page)).toContainText('true curve: the hidden rule');
});

test('arrow keys on the degree slider change the degree, not the step', async ({ page }) => {
	await open(page, './learning-from-data/#test', 'degree 3');
	await degree(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(degree(page)).toHaveValue('4');
	await expect(stage(page)).toContainText('degree 4');
	await expect(page).toHaveURL(/#test$/);
});

test('more data: the noise floor is drawn at the noise squared and follows the noise', async ({
	page
}) => {
	await open(page, './learning-from-data/#moredata', 'With 21 examples, noise 0.15');
	await expect(stage(page)).toContainText('noise floor (noise² = 0.0225)');
	await page.locator('input[type=range][data-control=noise]').fill('0.3');
	await expect(stage(page)).toContainText('noise floor (noise² = 0.0900)');
});
