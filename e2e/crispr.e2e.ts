import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('finished pictures (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test('Cas9 lets go of two near misses and cuts the phage where all 20 letters pair', async ({
		page
	}) => {
		await open(page, './crispr/#scan');
		await expect(stage(page)).toContainText(
			'PAM 1: letter 1 next to the PAM does not pair → let go'
		);
		await expect(stage(page)).toContainText('PAM 2: letters 1–3 pair, letter 4 does not → let go');
		await expect(stage(page)).toContainText('PAM 3: all 20 letters pair → cut both strands');
		await expect(stage(page)).toContainText('phage DNA cut: the cell survives');
	});

	test('the PAM check spares the bacterium’s own array; without it the cell cuts itself', async ({
		page
	}) => {
		await open(page, './crispr/#self');
		await expect(stage(page)).toContainText('no PAM next to the spacer: Cas9 never opens it');
		await page.locator('input[type=checkbox][data-control=pam]').uncheck({ force: true });
		await expect(stage(page)).toContainText('its own chromosome cut: the cell dies');
	});

	test('one changed letter in the seed or PAM lets the phage escape; far from the PAM it does not', async ({
		page
	}) => {
		await open(page, './crispr/#escape');
		await expect(stage(page)).toContainText('letters 1–3 pair, letter 4 does not → let go');
		await expect(stage(page)).toContainText('the phage escapes: the cell dies');
		await page.locator('[data-control=mutation][data-value=distal]').click();
		await expect(stage(page)).toContainText(
			'one mismatch far from the PAM (letter 18), tolerated → cut'
		);
		await expect(stage(page)).toContainText('phage DNA cut: the cell survives');
		await page.locator('[data-control=mutation][data-value=pam]').click();
		await expect(stage(page)).toContainText('the PAM is gone: Cas9 never reads these letters');
		await expect(stage(page)).toContainText('the phage escapes: the cell dies');
	});

	test('another infection adds a spacer from the next phage at the front of the array', async ({
		page
	}) => {
		await open(page, './crispr/#adapt');
		await expect(stage(page)).toContainText('DNA of phage C');
		await page.locator('button[data-control=infect]').click();
		await expect(stage(page)).toContainText('DNA of phage D');
		await expect(stage(page).locator('text', { hasText: /^D$/ })).toHaveCount(1);
	});

	test('in the yogurt experiment, resistance follows the new spacers', async ({ page }) => {
		await open(page, './crispr/#yogurt');
		await expect(stage(page)).toContainText('lawn intact: phage 858 cannot multiply here');
		await page.locator('[data-control=strain][data-value=removed]').click();
		await expect(stage(page)).toContainText('clear holes: phage 858 kills these bacteria');
		await page.locator('[data-control=strain][data-value=added]').click();
		await expect(stage(page)).toContainText('lawn intact');
	});

	test('with CRISPR the flask recovers and the phages die out; without it the bacteria are gone', async ({
		page
	}) => {
		await open(page, './crispr/#flask');
		await expect(stage(page)).toContainText('phages 0');
		await expect(stage(page)).toContainText(/bacteria 1\.0×10⁷/);
		await page.locator('input[type=checkbox][data-control=crispr]').uncheck({ force: true });
		await expect(stage(page)).toContainText('bacteria 0');
		await expect(stage(page)).toContainText('no CRISPR system');
	});

	test('in the arms race the phages keep changing letters; without mutations they do not', async ({
		page
	}) => {
		await open(page, './crispr/#arms');
		await expect(stage(page)).toContainText(/changed letters, on average: [1-9]\.\d per phage/);
		await page.locator('input[type=checkbox][data-control=mutate]').uncheck({ force: true });
		await expect(stage(page)).toContainText('changed letters, on average: 0.0 per phage');
	});
});

test('the search plays out: two misses, then the cut', async ({ page }) => {
	await page.clock.install();
	await open(page, './crispr/#scan');
	await expect(stage(page)).not.toContainText('cut both strands');
	await playUntil(page, stage(page), 'phage DNA cut: the cell survives', 20_000);
});

test('the page says it covers CRISPR as it works in bacteria', async ({ page }) => {
	await page.goto('./crispr/#phage');
	await expect(page.locator('main')).toContainText(
		'This page is about that defence, CRISPR, as it works in bacteria'
	);
});
