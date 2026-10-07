import { expect, test, type Page } from '@playwright/test';
import { spec } from '../src/routes/photosynthesis/steps';

/** Collects runtime errors so a test can assert that a scene rendered cleanly. */
function watchErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`console: ${m.text()}`);
	});
	return errors;
}

const stage = (page: Page) => page.locator('.stage svg > g');

test.describe('every step renders its scene', () => {
	for (const step of spec.steps) {
		test(`#${step.id} (${step.scene} scene) renders without errors`, async ({ page }) => {
			const errors = watchErrors(page);
			await page.goto(`/photosynthesis/#${step.id}`);
			await expect(page.locator('aside h2')).toHaveText(step.title);
			// The scene is lazy-loaded: wait until it has drawn something.
			await expect(stage(page).locator('g').first()).toBeAttached();
			await expect(stage(page).locator('text').first()).toBeAttached();
			// Let a couple of animation frames run before checking the console.
			await page.waitForTimeout(500);
			expect(errors).toEqual([]);
		});
	}
});

test('walking through all steps in dark mode stays error-free', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	const errors = watchErrors(page);
	await page.goto('/photosynthesis/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(stage(page).locator('g').first()).toBeAttached();
	for (let i = 1; i < spec.steps.length; i++) {
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('aside h2')).toHaveText(spec.steps[i].title);
		await expect(page).toHaveURL(new RegExp(`#${spec.steps[i].id}$`));
		await page.waitForTimeout(150);
	}
	await expect(page.getByRole('button', { name: 'Next step' })).toBeDisabled();
	expect(errors).toEqual([]);
});

test('reduced motion starts paused and still shows a complete frame', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const errors = watchErrors(page);
	await page.goto('/photosynthesis/#etc');
	await expect(stage(page).locator('text').first()).toBeAttached();
	await expect(page.getByRole('button', { name: /play animation/i })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	// Changing a control while frozen must not throw either.
	await page.locator('input[type=range][data-control=light]').fill('0');
	await page.waitForTimeout(300);
	expect(errors).toEqual([]);
});
