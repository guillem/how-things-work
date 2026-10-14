import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const select = (page: Page, id: string) => page.locator(`select[data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('finished pictures (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('a broken repair gene brings the tumour sooner', async ({ page }) => {
		await open(page, './cancer/#repair');
		await expect(stage(page)).toContainText('tumour found at generation 239');
		await toggle(page, 'repair').uncheck({ force: true });
		await expect(stage(page)).toContainText('tumour found at generation 329');
	});

	test('one drug shrinks the tumour, then it comes back resistant; untreated it just grows', async ({
		page
	}) => {
		await open(page, './cancer/#treat');
		await expect(stage(page)).toContainText('back, resistant to the drug');
		await expect(stage(page)).toContainText('drug given');
		await toggle(page, 'treat').uncheck({ force: true });
		await expect(stage(page)).toContainText('untreated');
		await expect(stage(page)).not.toContainText('drug given');
	});

	test('two drugs at once clear the tumour that one drug could not', async ({ page }) => {
		await open(page, './cancer/#combo');
		await expect(stage(page)).toContainText('back, resistant to the drug');
		await select(page, 'therapy').selectOption('two');
		await expect(stage(page)).toContainText('tumour cleared');
		await expect(stage(page)).toContainText('drugs A + B given');
	});

	test('SEER incidence by age: about five steps for colorectal cancer, more for pancreas', async ({
		page
	}) => {
		await open(page, './cancer/#age');
		await expect(stage(page)).toContainText('k ≈ 4.7');
		await expect(stage(page)).toContainText('132 per 100,000 a year');
		await select(page, 'site').selectOption('pancreas');
		await expect(stage(page)).toContainText('k ≈ 6.6');
		await page.locator('input[type=range][data-control=hits]').fill('7');
		await expect(stage(page)).toContainText('×64 the yearly risk');
	});

	test('children who inherit one broken RB1 get tumours, the others almost never', async ({
		page
	}) => {
		await open(page, './cancer/#knudson');
		await expect(stage(page)).toContainText('120 expected');
		await toggle(page, 'inherited').uncheck({ force: true });
		await expect(stage(page)).toContainText(/(^|\D)0 tumours in all/);
	});

	test('a one-letter change in KRAS codon 12 swaps one amino acid', async ({ page }) => {
		await open(page, './cancer/#genes');
		await expect(stage(page)).toContainText('GGT → GAT · glycine → aspartic acid');
		await select(page, 'kras').selectOption('G12V');
		await expect(stage(page)).toContainText('GGT → GTT · glycine → valine');
	});
});

test('the tissue grows a tumour over the generations, and "Run again" starts over', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./cancer/#hits');
	await playUntil(page, stage(page), 'tumour found at generation 329', 30000);
	await page.locator('.action button[data-control=again]').click();
	await page.clock.runFor(300);
	await expect(stage(page)).toContainText('no tumour yet');
	await expect(stage(page)).not.toContainText('tumour found');
});
