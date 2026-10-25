import { expect, test, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import type { ExplainerSpec } from '../src/lib/explainer/types';

// Every explainer is a directory under src/routes with a steps.ts narrative.
const specs: ExplainerSpec[] = [];
// Only the development configuration may narrow this exhaustive production suite.
const requested = process.env.PW_TOPICS?.split(',').filter(Boolean) ?? [];
const selected = process.env.PW_DEV_TOPICS === '1' ? new Set(requested) : new Set<string>();
for (const dir of fs.readdirSync('src/routes')) {
	if (!fs.existsSync(`src/routes/${dir}/steps.ts`)) continue;
	if (selected.size && !selected.has(dir)) continue;
	const mod: { spec: ExplainerSpec } = await import(`../src/routes/${dir}/steps.ts`);
	specs.push(mod.spec);
}

/** Collects runtime errors so a test can assert that a scene rendered cleanly. */
function watchErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`console: ${m.text()}`);
	});
	return errors;
}

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** The page's requests still in flight (a scene may fetch its data after it first draws). */
function watchRequests(page: Page) {
	const pending = new Set<Request>();
	page.on('request', (r) => pending.add(r));
	page.on('requestfinished', (r) => pending.delete(r));
	page.on('requestfailed', (r) => pending.delete(r));
	return pending;
}

/**
 * Lets a scene's deferred work run before the console is checked: `ms` of its timers and
 * animation frames on Playwright's fake clock (installed before `goto`, so this takes far less
 * than `ms`), then any requests it started, then two more frames.
 */
async function settle(page: Page, pending: Set<Request>, ms: number) {
	await page.clock.runFor(ms);
	await expect.poll(() => pending.size).toBe(0);
	await page.evaluate(async () => {
		for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
	});
}

for (const spec of specs) {
	test.describe(spec.slug, () => {
		test.describe('every step renders its scene', () => {
			for (const step of spec.steps) {
				test(`#${step.id} (${step.scene} scene) renders without errors`, async ({ page }) => {
					const errors = watchErrors(page);
					const pending = watchRequests(page);
					const wait = { timeout: 5_000 };
					await page.clock.install();
					await page.goto(`./${spec.slug}/#${step.id}`);
					await expect(page.locator('aside h2')).toHaveText(step.title, wait);
					// The scene is lazy-loaded: wait until it has drawn something.
					await expect(stage(page).locator('g').first()).toBeAttached(wait);
					await expect(stage(page).locator('text').first()).toBeAttached();
					await settle(page, pending, 500);
					expect(errors).toEqual([]);
				});
			}
		});

		test('walking through all steps in dark mode stays error-free', async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'dark' });
			const errors = watchErrors(page);
			const pending = watchRequests(page);
			await page.clock.install();
			await page.goto(`./${spec.slug}/`);
			await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
			await expect(stage(page).locator('g').first()).toBeAttached();
			for (let i = 1; i < spec.steps.length; i++) {
				await page.keyboard.press('ArrowRight');
				await expect(page.locator('aside h2')).toHaveText(spec.steps[i].title);
				await expect(page).toHaveURL(new RegExp(`#${spec.steps[i].id}$`));
				await settle(page, pending, 150);
			}
			await expect(page.getByRole('button', { name: 'Next step' })).toBeDisabled();
			expect(errors).toEqual([]);
		});
	});
}

test('reduced motion starts paused and still shows a complete frame', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const errors = watchErrors(page);
	const pending = watchRequests(page);
	await page.clock.install();
	await page.goto('./photosynthesis/#etc');
	await expect(stage(page).locator('text').first()).toBeAttached();
	await expect(page.getByRole('button', { name: /play animation/i })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	// Changing a control while frozen must not throw either.
	await page.locator('input[type=range][data-control=light]').fill('0');
	await settle(page, pending, 300);
	expect(errors).toEqual([]);
});
