import { expect, test, type Page } from '@playwright/test';

const stepTitle = (page: Page) => page.locator('aside h2');

/** Navigate and wait until the page is hydrated (the scene is rendered client-side only). */
async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.locator('.stage svg > g')).toBeAttached();
}

test('steps through the explainer with buttons and keyboard', async ({ page }) => {
	await open(page, '/photosynthesis/');
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
});

test('deep links open the right step', async ({ page }) => {
	await open(page, '/photosynthesis/#rubisco');
	await expect(stepTitle(page)).toHaveText(/carbon fixation/i);
	await expect(page.locator('.counter .current')).toHaveText('11');
});

test('after opening a deep link, the step buttons still move between steps', async ({ page }) => {
	await open(page, '/photosynthesis/#pigments');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(stepTitle(page)).toHaveText(/catching a photon/i);
	await expect(page).toHaveURL(/#antenna$/);
	await page.getByRole('button', { name: 'Previous step' }).click();
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(stepTitle(page)).toHaveText(/chloroplast/i);
	await expect(page.locator('.counter .current')).toHaveText('3');
});

test('contents list jumps to a step', async ({ page }) => {
	await open(page, '/photosynthesis/');
	await page.getByRole('navigation', { name: 'Steps' }).locator('summary').click();
	await page.getByRole('button', { name: /ATP synthase/ }).click();
	await expect(stepTitle(page)).toHaveText(/ATP synthase/);
	await expect(page).toHaveURL(/#atp$/);
});

test('play / pause and interactive controls', async ({ page }) => {
	await open(page, '/photosynthesis/#pigments');
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
	await open(page, '/photosynthesis/');
	await page.keyboard.press('?');
	await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toHaveCount(0);
});
