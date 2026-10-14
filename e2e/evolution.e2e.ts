import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

// Reduced motion shows each run finished, so the readouts are final.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

/** "average moth: 10.9 of 12 dark alleles" → 10.9 */
async function averageMoth(page: Page) {
	const text =
		(await stage(page)
			.getByText(/average moth:/)
			.textContent()) ?? '';
	return Number(/average moth: ([\d.]+)/.exec(text)?.[1]);
}

test('birds on sooty bark darken the moths; without birds they stay pale', async ({ page }) => {
	await open(page, './evolution/#generations');
	await expect(stage(page)).toContainText('generation 100');
	expect(await averageMoth(page)).toBeGreaterThan(9);
	await page.locator('[data-control=env][data-value=none]').click();
	await expect(stage(page)).toContainText('no birds');
	expect(await averageMoth(page)).toBeLessThan(5);
});

test('switching off unequal survival stops the adaptation', async ({ page }) => {
	await open(page, './evolution/#ingredients');
	expect(await averageMoth(page)).toBeGreaterThan(9);
	await page.locator('input[type=checkbox][data-control=selection]').uncheck({ force: true });
	await expect(stage(page)).toContainText('off: equal survival');
	expect(await averageMoth(page)).toBeLessThan(5);
});

test('a new mutation takes over about 2s of the time, a neutral one 1/2N', async ({ page }) => {
	await open(page, './evolution/#new-mutation');
	await expect(stage(page)).toContainText('rule of thumb 2s = 10.0%');
	await expect(stage(page)).toContainText(
		/took over: \d+ of 2,000 new mutations \(([789]|1[0-2])\.\d%\)/
	);
	await page.locator('input[type=range][data-control=s]').fill('0');
	await expect(stage(page)).toContainText('1/2N = 1/400 = 0.25%');
});

test('random mutation gives jackpots; resistance caused by the virus would not', async ({
	page
}) => {
	await open(page, './evolution/#blind');
	await expect(stage(page)).toContainText('jackpots');
	await page.locator('[data-control=hypothesis][data-value=induced]').click();
	await expect(stage(page)).toContainText('chance alone');
	await expect(stage(page)).not.toContainText('jackpots');
});

test('bacteria evolve 10,000-fold resistance only through intermediate doses', async ({ page }) => {
	await open(page, './evolution/#antibiotics');
	await expect(stage(page)).toContainText('most resistant: survives 10,000×');
	await page.locator('input[type=checkbox][data-control=steps]').uncheck({ force: true });
	await expect(stage(page)).toContainText('stuck in the drug-free bands');
});

test('the peppered-moth model is compared with the Cambridge measurements', async ({ page }) => {
	await open(page, './evolution/#peppered-moth');
	await expect(stage(page)).toContainText(/model: 9\d\.\d% black in 1895/);
	await page.locator('input[type=range][data-control=rise]').fill('0.05');
	await expect(stage(page)).toContainText(/model: (\d|[1-5]\d)\.\d% black in 1895/);
	await expect(stage(page)).toContainText('(measured 1%)');
});

test('Lenski’s bacteria are about 1.7 times as fit as their ancestor', async ({ page }) => {
	await open(page, './evolution/#lenski');
	await expect(stage(page)).toContainText('generation 50,000: 1.69× the ancestor');
});
