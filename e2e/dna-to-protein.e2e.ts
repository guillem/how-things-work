import { expect, test, type Page } from '@playwright/test';

// Reduced motion: the translation and mutation scenes show their finished frames.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

test('the letters-copied slider steps the polymerase along β-globin, letter by letter', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#transcribe');
	// reduced motion: the copy runs by itself, frozen 46 letters in
	await expect(stage(page)).toContainText('shown at 1,200 letters a minute');
	await expect(stage(page)).toContainText('Letter 46 of 1,608 copied · now in exon 1');
	const auto = page.locator('input[type=checkbox][data-control=copy-auto]');
	const slider = page.locator('input[type=range][data-control=copied]');
	// moving the slider takes over: exon 1 of HBB is 142 letters long, then intron 1 begins
	await slider.fill('142');
	await expect(auto).not.toBeChecked();
	await expect(stage(page)).toContainText('stepped with the slider');
	await expect(stage(page)).toContainText('Letter 142 of 1,608 copied · now in exon 1');
	await slider.focus();
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('Letter 143 of 1,608 copied · now in intron 1');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText(
		'Copy finished: an RNA of 1,608 letters, introns and all'
	);
	// a shorter gene keeps the slider inside it
	await choose(page, 'gene', 'trpl');
	await expect(stage(page)).toContainText('Copy finished: an RNA of 45 letters');
	await expect(slider).toHaveValue('45');
	await slider.focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('No letters copied yet');
});

test('switching “Copy by itself” off leaves the polymerase where the animation was', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#transcribe');
	await expect(stage(page)).toContainText('Letter 46 of 1,608 copied');
	await page.locator('input[type=checkbox][data-control=copy-auto]').uncheck({ force: true });
	await expect(page.locator('input[type=range][data-control=copied]')).toHaveValue('46');
	await expect(stage(page)).toContainText('stepped with the slider');
	await expect(stage(page)).toContainText('Letter 46 of 1,608 copied · now in exon 1');
});

test('the codon slider steps the ribosome along β-globin, codon by codon', async ({ page }) => {
	await page.goto('./dna-to-protein/#ribosome');
	await expect(stage(page)).toContainText('Codon 1 of 148: AUG → Met (methionine)');
	const slider = page.locator('input[type=range][data-control=codon]');
	await slider.fill('7');
	// Codon 7 is the GAG that the sickle-cell mutation changes.
	await expect(stage(page)).toContainText('Codon 7 of 148: GAG → Glu (glutamic acid)');
	await expect(stage(page)).toContainText('its tRNA’s anticodon CUC (3′→5′) pairs with GAG');
	await expect(stage(page)).toContainText('β-globin protein: 7 of 147 amino acids');
	await slider.focus();
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('Codon 8 of 148: GAG → Glu');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText(
		'Stop codon UAA: a release factor frees the chain of 147 amino acids'
	);
});

test('the bacterial gene and a typed sequence are translated to their own ends', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#protein');
	await expect(stage(page)).toContainText('frees the chain of 147 amino acids');
	await choose(page, 'gene', 'trpl');
	await expect(stage(page)).toContainText('Stop codon UGA: a release factor frees the chain of 14');
	await choose(page, 'gene', 'own');
	const box = page.getByRole('textbox', { name: 'Your DNA sequence' });
	await box.fill('');
	// Letters that are shortcuts elsewhere are dropped, not obeyed; u counts as T.
	await box.pressSequentially('gg aug ttt aaa rf ccc');
	await expect(box).toHaveValue('GGATGTTTAAACCC');
	await expect(page).toHaveURL(/#protein$/);
	await expect(stage(page)).toContainText(
		'No stop codon: the ribosome ran off the end after 4 amino acids'
	);
	await box.fill('CCCGGG');
	await expect(stage(page)).toContainText('No AUG in this sequence');
});

test('the four real β-globin variants: nothing, one amino acid, an early stop, a frameshift', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#silent');
	await expect(stage(page)).toContainText('Same protein: CAU and CAC both mean His');
	await page.goto('./dna-to-protein/#missense');
	await expect(stage(page)).toContainText('One amino acid changed: Glu7 → Val');
	await page.goto('./dna-to-protein/#nonsense');
	await expect(stage(page)).toContainText('A stop codon early: 39 amino acids instead of 147');
	await page.goto('./dna-to-protein/#frameshift');
	await expect(stage(page)).toContainText(
		'From amino acid 7 on, 12 wrong, then a stop: 18 instead of 147'
	);
});

test('in the lab, a clicked letter can be changed, deleted or left alone', async ({ page }) => {
	await page.goto('./dna-to-protein/#lab');
	// Letter 71 is the last G of codon 7 (GAG): any change there keeps glutamic acid.
	await expect(stage(page)).toContainText('c.21G>A');
	await expect(stage(page)).toContainText('Same protein: GAG and GAA both mean Glu');
	// The middle letter of the same codon.
	await page.getByRole('button', { name: 'Edit letter 70' }).click();
	await choose(page, 'base', 'T');
	await expect(stage(page)).toContainText('c.20A>T');
	await expect(stage(page)).toContainText('Glu7 → Val');
	await choose(page, 'edit', 'del');
	await expect(stage(page)).toContainText('From amino acid 7 on, 12 wrong');
	await choose(page, 'edit', 'ins');
	await expect(stage(page)).toContainText('Frameshift');
	await page.locator('input[type=range][data-control=at]').fill('10');
	await choose(page, 'edit', 'sub');
	await expect(stage(page)).toContainText('not part of the instructions');
	await choose(page, 'edit', 'none');
	await expect(stage(page)).toContainText('Pick an edit');
});

test('in the lab, an own sequence with no AUG: an edit can create one, or leave none', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#lab');
	await choose(page, 'gene', 'own');
	const box = page.getByRole('textbox', { name: 'Your DNA sequence' });
	await box.fill('CCTGGGC');
	await choose(page, 'edit', 'sub');
	await page.locator('input[type=range][data-control=at]').fill('2');
	await choose(page, 'base', 'A');
	// CATGGGC: the new ATG starts at letter 2, and there was none to break before.
	await expect(stage(page)).toContainText('New start');
	await expect(stage(page)).toContainText('A new AUG at letter 2: 2 amino acids');
	await choose(page, 'base', 'G');
	await expect(stage(page)).toContainText('Still no AUG: no protein');
});

test('clicking a codon in the table names its amino acid and its other codons', async ({
	page
}) => {
	await page.goto('./dna-to-protein/#code-table');
	await page.getByRole('button', { name: 'UGG: tryptophan' }).click();
	await expect(stage(page)).toContainText('Trp · tryptophan');
	await expect(stage(page)).toContainText('its only codon');
	await page.getByRole('button', { name: 'CUA: leucine' }).click();
	await expect(stage(page)).toContainText('6 codons for it:');
	await expect(stage(page)).toContainText('UUA UUG CUU CUC CUA CUG');
});
