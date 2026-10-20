import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('finished pictures (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('two doses give two and a half times an infection’s antibodies; one dose a seventh', async ({
		page
	}) => {
		await open(page, './mrna-vaccines/#doses');
		await expect(stage(page)).toContainText('2.5× an infection’s');
		await expect(stage(page)).toContainText('18 times the first dose’s peak');
		await expect(stage(page)).toContainText('0.14× an infection’s');
		await page.locator('[data-control=doses][data-value="1"]').click();
		await expect(stage(page)).toContainText('faint: two doses');
	});

	test('a later infection is stopped at once, or cleared in five days instead of nine', async ({
		page
	}) => {
		await open(page, './mrna-vaccines/#infection');
		await expect(stage(page)).toContainText(/Virus gone after 5\.\d days/);
		await expect(stage(page)).toContainText('not vaccinated: 9 days');
		await page.locator('input[type=range][data-control=months]').fill('3');
		await expect(stage(page)).toContainText('Leftover antibodies stopped the virus at once');
		await page.locator('[data-control=vaccine][data-value="0"]').click();
		await expect(stage(page)).toContainText('Not vaccinated: virus gone on day 9');
	});

	test('the message fades within days: under a tenth after three, nothing after two weeks', async ({
		page
	}) => {
		await open(page, './mrna-vaccines/#fading');
		await expect(stage(page)).toContainText('day 1: 45% of the mRNA still read');
		const slider = page.locator('input[type=range][data-control=day]');
		await slider.fill('3');
		await expect(stage(page)).toContainText('day 3: 8.9% of the mRNA still read');
		await slider.press('End');
		await expect(stage(page)).toContainText('day 14: under 0.1% of the mRNA still read');
	});

	test('without the two prolines the spike springs into its after shape', async ({ page }) => {
		await open(page, './mrna-vaccines/#prolines');
		await expect(stage(page)).toContainText('before shape, held');
		await page.locator('input[type=checkbox][data-control=prolines]').uncheck();
		await expect(stage(page)).toContainText('after shape: a long needle');
	});

	test('with ordinary U the RNA sensors raise the alarm', async ({ page }) => {
		await open(page, './mrna-vaccines/#modified');
		await expect(stage(page)).toContainText('RNA sensors idle: no alarm');
		await page.locator('input[type=checkbox][data-control=modified]').uncheck();
		await expect(stage(page)).toContainText('RNA sensors bound: the alarm is raised');
	});

	test('the vaccine’s message stays outside the nucleus', async ({ page }) => {
		await open(page, './mrna-vaccines/#nucleus');
		await expect(stage(page)).toContainText('vaccine mRNA: stays in the cytoplasm');
	});
});

test('the immune-system page links to this one', async ({ page }) => {
	await page.goto('./immune-system/#second');
	await expect(page.locator('a[href="../mrna-vaccines/"]').first()).toBeAttached();
});
