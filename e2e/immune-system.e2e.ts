import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('finished pictures (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('innate immunity alone holds the virus but never clears it', async ({ page }) => {
		await open(page, './immune-system/#standoff');
		await expect(stage(page)).toContainText('Virus not cleared after 30 days');
		await toggle(page, 'adaptive1').check({ force: true });
		await expect(stage(page)).toContainText('Virus gone on day 9');
	});

	test('the full response clears a first infection on day 9; without B and T cells it never ends', async ({
		page
	}) => {
		await open(page, './immune-system/#course');
		await expect(stage(page)).toContainText('Virus gone on day 9');
		await toggle(page, 'adaptive').uncheck({ force: true });
		await expect(stage(page)).toContainText('Virus not cleared after 30 days');
		// The full response stays visible, faint, for comparison.
		await expect(stage(page)).toContainText('with both responses');
	});

	test('a second infection is cleared faster, or stopped at once by leftover antibodies', async ({
		page
	}) => {
		await open(page, './immune-system/#second');
		await expect(stage(page)).toContainText(/Virus gone after 5\.\d days/);
		await expect(stage(page)).toContainText('first time: 9 days');
		await page.locator('input[type=range][data-control=reinfect]').fill('30');
		await expect(stage(page)).toContainText('Leftover antibodies stopped the virus at once');
	});

	test('memory leaves thirty times more matching T cells than there were naive ones', async ({
		page
	}) => {
		await open(page, './immune-system/#memory');
		await expect(stage(page)).toContainText('31 times the 100 naive cells');
	});
});

test('in the tissue the virus is gone on day 9, and "Release the virus" starts again', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./immune-system/#battle');
	await playUntil(page, stage(page), 'the virus is gone', 20000);
	await expect(stage(page)).toContainText('Day 9');
	await page.locator('.action button[data-control=release]').click();
	await page.clock.runFor(500);
	await expect(stage(page)).toContainText('Day 0.0');
	await expect(stage(page)).not.toContainText('the virus is gone');
});

test('infected again six months later, the tissue is clear of virus sooner than the first time', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./immune-system/#battle');
	await page.locator('.action button[data-control=again]').click();
	await playUntil(page, stage(page), 'of the second infection: the virus is gone', 20000);
	await expect(stage(page)).toContainText('Day 5 of the second infection');
	await expect(stage(page)).toContainText('the first time it took 9 days');
	await expect(stage(page)).toContainText('memory T cells switched on');
});
