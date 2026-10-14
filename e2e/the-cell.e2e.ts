import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const zoom = (page: Page, id: string) => page.locator(`input[type=range][data-control=zoom-${id}]`);
const part = (page: Page, id: string) =>
	stage(page).locator(`[role=button][data-part="${id}"]`).first();

// Reduced motion: the camera jumps straight to each view, so what is read is final.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page)).toContainText('width of the view');
}

test(
	'the zoom slider sets the width of the view, and the scale bar follows',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './the-cell/#cell');
		await expect(stage(page)).toContainText('width of the view: 40 µm');
		await expect(stage(page)).toContainText('5 µm');
		// The slider's value is −log₁₀(width in metres): 6 is a view one micrometre wide.
		await zoom(page, 'cell').fill('6');
		await expect(stage(page)).toContainText('width of the view: 1 µm');
		await expect(stage(page)).toContainText('100 nm');
		await expect(page.locator('output').first()).toContainText('1 µm');
	}
);

test('zooming far enough into a mitochondrion reaches a single ATP molecule', async ({ page }) => {
	await open(page, './the-cell/#mitochondria');
	await expect(stage(page)).toContainText('Mitochondrion');
	await zoom(page, 'mitochondria').fill('7');
	await expect(stage(page)).toContainText('ATP synthase');
	await zoom(page, 'mitochondria').press('End');
	await expect(stage(page)).toContainText('≈ 1.4 nm');
});

test('picking a part shows what it is, how big it is and what it does', async ({ page }) => {
	await open(page, './the-cell/#cell');
	await part(page, 'nucleus').focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('≈ 8 µm across');
	await expect(stage(page)).toContainText('Holds the cell’s DNA');
	await part(page, 'mitochondrion').focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('≈ 1 µm wide, 2 µm long');
});

test('the structures the views label each open their own card', async ({ page }) => {
	// what only the info card says (the callouts on the picture use shorter names)
	const pick = async (id: string, says: string) => {
		await part(page, id).focus();
		await page.keyboard.press('Enter');
		await expect(stage(page)).toContainText(says);
	};
	await open(page, './the-cell/#crowded');
	await pick('groEL', 'GroEL chaperone');
	await pick('rnaPolymerase', 'Copies a gene');
	await pick('trna', 'Transfer RNA');
	await open(page, './the-cell/#ribosomes');
	await pick('sec61', 'a pore through the ER membrane');
	await open(page, './the-cell/#cell');
	await pick('smoothER', 'Smooth endoplasmic reticulum');
	await pick('golgi', 'Golgi apparatus');
});

test('+ and − over the picture zoom without changing the step', async ({ page }) => {
	await open(page, './the-cell/#cell');
	await page.getByRole('application', { name: /Zoomable picture/ }).focus();
	await page.keyboard.press('+');
	await expect(stage(page)).toContainText('width of the view: 32 µm');
	await page.keyboard.press('-');
	await expect(stage(page)).toContainText('width of the view: 40 µm');
	await expect(page).toHaveURL(/#cell$/);
});

test('the explorer switches between an animal, a plant and a bacterial cell', async ({ page }) => {
	await open(page, './the-cell/#explore');
	await expect(stage(page)).toContainText('Liver cell (hepatocyte)');
	await page.locator('button[data-control=cell][data-value=plant]').click();
	await expect(stage(page)).toContainText('Leaf cell (palisade mesophyll)');
	await page.locator('button[data-control=cell][data-value=bacterium]').click();
	await expect(stage(page)).toContainText('Bacteria (E. coli)');
	// a bacterium is much smaller: the deepest view of its branch is a glucose molecule
	await zoom(page, 'explore').press('End');
	await expect(stage(page)).toContainText('Glucose');
});

test('picking the nucleus in the explorer sends the zoom into the DNA', async ({ page }) => {
	await open(page, './the-cell/#explore');
	await part(page, 'nucleus').focus();
	await page.keyboard.press('Enter');
	await zoom(page, 'explore').press('End');
	await expect(stage(page)).toContainText('2 nm wide; 0.34 nm per letter');
	await expect(stage(page)).toContainText('A adenine');
});

test('on an ordinary ruler everything small piles up at zero', async ({ page }) => {
	await page.goto('./the-cell/#sizes');
	await expect(stage(page)).toContainText('Powers of ten');
	await expect(stage(page)).toContainText('0.3 nm');
	await page.locator('label.toggle', { hasText: 'Ordinary (linear) ruler' }).click();
	await expect(stage(page)).toContainText('An ordinary ruler');
	await expect(stage(page)).toContainText(
		'everything smaller than 1 µm is within 3 pixels of zero'
	);
});
