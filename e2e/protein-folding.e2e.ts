import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
/** Clicks bead `n` (1-based, as in its accessible name) `times` times. */
async function bend(page: Page, n: number, times: number) {
	const bead = page.getByRole('button', { name: new RegExp(`^Bead ${n} \\(`) });
	for (let k = 0; k < times; k++) await bead.click();
}

test.describe('reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('folding chain A by hand reaches its one best fold, and the landscape marks it', async ({
		page
	}) => {
		await page.goto('./protein-folding/#fold');
		await expect(stage(page)).toContainText('65,610 of the 110,188');
		// beads cross: three left turns in a row close a square onto the first bead
		await bend(page, 2, 1);
		await bend(page, 3, 1);
		await bend(page, 4, 1);
		await expect(stage(page)).toContainText('not a');
		await page.getByRole('button', { name: 'Straighten the chain' }).click();
		await expect(stage(page)).toContainText('65,610 of the 110,188');
		// the best fold, turn by turn: S L L S R L L R L L R L (clicks: L = 1, R = 2)
		const turns = 'SLLSRLLRLLRL';
		for (let i = 0; i < turns.length; i++)
			await bend(page, i + 2, turns[i] === 'L' ? 1 : turns[i] === 'R' ? 2 : 0);
		await expect(stage(page)).toContainText('You found the best fold');
		await expect(stage(page)).toContainText('the only one of 110,188');
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#landscape$/);
		await expect(stage(page)).toContainText('← your fold');
		await expect(stage(page)).toContainText('1 shape');
	});

	test('buried amino acids of β-globin are mostly water-repelling', async ({ page }) => {
		await page.goto('./protein-folding/#inside-out');
		await expect(stage(page)).toContainText('56 of 82 buried (68%)');
		await expect(stage(page)).toContainText('4 of 38 buried (11%)');
		await choose(page, 'show', 'buried');
		await expect(stage(page)).toContainText('67 buried amino acids');
	});

	test('Levinthal: a 100-amino-acid chain would take 10²⁷ years to search', async ({ page }) => {
		await page.goto('./protein-folding/#levinthal');
		await expect(stage(page)).toContainText('110,188 shapes');
		await page.locator('input[type=range][data-control=length]').fill('100');
		await expect(stage(page)).toContainText('3¹⁰⁰ ≈ 5.2 × 10⁴⁷ shapes');
		await expect(stage(page)).toContainText('1.6 × 10²⁷ years');
	});

	test('AlphaFold matches each measured structure to about half an ångström', async ({ page }) => {
		await page.goto('./protein-folding/#compare');
		await expect(stage(page)).toContainText('Measured: PDB 2DN2');
		await expect(stage(page)).toContainText('difference: 0.47 Å');
		await choose(page, 'protein', 'p53');
		await expect(stage(page)).toContainText('Measured: PDB 2OCJ');
		await expect(stage(page)).toContainText('measured: 96–289');
		await page.goto('./protein-folding/#function');
		await expect(stage(page)).toContainText('Glu35–Asp52: 10 Å apart in the fold');
	});
});

test('the chain folds itself when cool, and stays floppy when hot', async ({ page }) => {
	await page.clock.install();
	await page.goto('./protein-folding/#self-fold');
	await playUntil(page, stage(page), 'Found its one best fold.', 30_000);
	await page.locator('input[type=range][data-control=temp]').fill('2');
	await page.getByRole('button', { name: 'Unfold and run again' }).click();
	await page.clock.runFor(10_000);
	await expect(stage(page)).toContainText('Not yet in its best fold');
	await expect(stage(page)).toContainText('temperature 2.00');
});
