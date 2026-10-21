import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });

// With reduced motion each step shows the colony after a fixed stretch of simulated time.
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
}

/** The grains of sugar carried home, as the stage shows them. */
async function grains(page: Page) {
	const text = await stage(page)
		.getByText(/sugar carried home: \d+ grains/)
		.textContent();
	return Number(/(\d+) grains/.exec(text ?? '')?.[1]);
}

/** The phone panel's tally of the last ants to set out: [first bridge, second bridge]. */
async function tally(page: Page, names: [string, string]) {
	const value = readouts(page).getByText(new RegExp(`${names[0]} bridge \\d+`));
	await expect(value).toBeVisible();
	const text = (await value.textContent()) ?? '';
	return names.map((n) => Number(new RegExp(`${n} bridge (\\d+)`).exec(text)?.[1]));
}

test('a trail carries far more sugar home than ants searching with no scent', async ({ page }) => {
	await open(page, './ant-trails/#scent');
	await expect(stage(page)).toContainText('scent left by ants carrying sugar');
	const withScent = await grains(page);
	await page.getByRole('switch', { name: 'Ants carrying sugar leave a scent' }).uncheck();
	await expect(stage(page)).toContainText('no scent at all');
	const without = await grains(page);
	expect(withScent).toBeGreaterThan(2 * without);
});

test('move: the sugar can be moved with the keyboard', async ({ page }) => {
	await open(page, './ant-trails/#move');
	const sugar = page.getByRole('slider', { name: 'The sugar' });
	const before = Number(await sugar.getAttribute('aria-valuenow'));
	await sugar.focus();
	await page.keyboard.press('Home');
	await expect
		.poll(async () => Number(await sugar.getAttribute('aria-valuenow')))
		.toBeLessThan(before);
});

test('pebble: the button drops a pebble on the trail and sugar still comes home', async ({
	page
}) => {
	await open(page, './ant-trails/#pebble');
	const pebble = stage(page).locator('circle[fill="var(--at-pebble)"]');
	await expect(pebble).toHaveCount(0);
	await page.getByRole('button', { name: 'Drop a pebble on the trail' }).click();
	await expect(pebble).toHaveCount(1);
	expect(await grains(page)).toBeGreaterThan(100);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('two bridges the same length: the colony crowds onto one', async ({ page }) => {
		await open(page, './ant-trails/#bridges');
		const [top, bottom] = await tally(page, ['top', 'bottom']);
		expect(Math.max(top, bottom)).toBeGreaterThanOrEqual(40);
	});

	test('a short bridge and a long one: the short one wins', async ({ page }) => {
		await open(page, './ant-trails/#shortcut');
		const [short, long] = await tally(page, ['short', 'long']);
		expect(short).toBeGreaterThan(40);
		expect(long).toBeLessThan(10);
	});

	test('a short bridge opened late stays almost empty, with fading or without', async ({
		page
	}) => {
		await open(page, './ant-trails/#late');
		await expect(readouts(page)).toContainText('never fades');
		expect((await tally(page, ['short', 'long']))[0]).toBeLessThan(10);
		await page.getByRole('switch', { name: 'The scent fades' }).check();
		await expect(readouts(page)).not.toContainText('never fades');
		expect((await tally(page, ['short', 'long']))[0]).toBeLessThan(10);
	});
});
