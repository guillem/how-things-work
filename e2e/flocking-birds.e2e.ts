import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
async function open(page: Page, step: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./flocking-birds/#${step}`);
	await expect(stage(page)).toContainText('100 birds · no leader');
}

test('matching neighbours changes a milling group into a flock', async ({ page }) => {
	await open(page, 'direction');
	await expect(stage(page)).toContainText('Mostly the same way');
	await page.locator('input[data-control=alignment]').uncheck();
	await expect(stage(page)).toContainText('Same way · off');
	await expect(stage(page)).toContainText('Many different directions');
});

/** The number in the stage's result line, e.g. 12 in "12 very close pairs". */
async function result(page: Page, pattern: RegExp) {
	const text = await stage(page).getByText(pattern).textContent();
	return Number(pattern.exec(text ?? '')?.[1]);
}
const closePairs = /(\d+) very close pairs/;
const spread = /about ([\d.]+) bird lengths away/;

test('turning spacing off produces crowded clumps', async ({ page }) => {
	await open(page, 'space');
	const spaced = await result(page, closePairs);
	await page.locator('input[data-control=spacing]').uncheck();
	await expect(stage(page)).toContainText('Space · off');
	const clumped = await result(page, closePairs);
	expect(clumped).toBeGreaterThan(10 * (spaced + 1));
});

test('without gathering the neighbours are farther apart', async ({ page }) => {
	await open(page, 'together');
	const gathered = await result(page, spread);
	await page.locator('input[data-control=cohesion]').uncheck();
	await expect(stage(page)).toContainText('Stay near · off');
	expect(await result(page, spread)).toBeGreaterThan(gathered);
});

test('try: leaving out each rule shows what that rule was doing', async ({ page }) => {
	await open(page, 'try');
	await expect(stage(page)).toContainText('Mostly the same way');
	const radio = (name: string) => page.getByRole('radio', { name, exact: true });
	await radio('Space off').click();
	await expect(stage(page)).toContainText('Space · off');
	expect(await result(page, closePairs)).toBeGreaterThan(10);
	await radio('Same way off').click();
	await expect(stage(page)).toContainText('Space · on');
	await expect(stage(page)).toContainText('Same way · off');
	await expect(stage(page)).toContainText('Many different directions');
	await radio('Stay near off').click();
	await expect(stage(page)).toContainText('Stay near · off');
	await expect(stage(page)).toContainText('Farthest of seven neighbours');
	await radio('All three').click();
	await expect(stage(page)).toContainText('Mostly the same way');
});

test('a passing hawk adds a local danger without changing bird count', async ({ page }) => {
	await open(page, 'hawk');
	const birds = stage(page).getByTestId('bird');
	await expect(birds).toHaveCount(100);
	await page.locator('input[data-control=hawk]').check();
	// The calm frame is after the pass: the hawk has gone and the flock has closed up again.
	await expect(stage(page)).toContainText('The hawk has passed · neighbours gather again');
	await expect(stage(page)).toContainText('Mostly the same way');
	await expect(birds).toHaveCount(100);
});

test('following another bird changes the watched neighbourhood', async ({ page }) => {
	await open(page, 'direction');
	const ring = stage(page).getByTestId('ringed-bird');
	const x = await ring.getAttribute('cx');
	// The same bird stays ringed when the step changes; only the button moves the ring.
	for (const next of ['together', 'try', 'hawk', 'follow']) {
		await page.getByRole('button', { name: 'Next step' }).click();
		await expect(page).toHaveURL(new RegExp(`#${next}$`));
	}
	await expect(ring).toHaveAttribute('cx', x!);
	await page.getByRole('button', { name: 'Follow another bird', exact: true }).click();
	await expect(ring).not.toHaveAttribute('cx', x!);
});

test('the animated hawk crosses, then the flock regains a shared direction', async ({ page }) => {
	await page.clock.install();
	await page.goto('./flocking-birds/#hawk');
	await expect(stage(page)).toContainText('100 birds · no leader');
	await page.locator('input[data-control=hawk]').check();
	await playUntil(page, stage(page), 'Nearby birds turn away from the hawk', 10_000);
	await expect(stage(page).getByText('hawk', { exact: true })).toBeVisible();
	await playUntil(page, stage(page), 'The hawk has passed · neighbours gather again', 26_000);
	await expect(stage(page)).toContainText('Mostly the same way');
	await expect(stage(page).getByText('hawk', { exact: true })).toHaveCount(0);
});
