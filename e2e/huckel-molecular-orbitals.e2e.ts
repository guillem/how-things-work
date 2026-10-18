import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slide = (page: Page, control: string, value: string) =>
	page.locator(`input[type=range][data-control="${control}"]`).fill(value);
const level = (page: Page, k: number) => page.locator(`.stage [data-level="${k}"]`);
/** Presses a stage button from the keyboard (the arcs and bonds are thin to aim at). */
const press = async (page: Page, name: string) => {
	await page.getByRole('button', { name }).focus();
	await page.keyboard.press('Enter');
};

test('butadiene: the matrix, a level clicked draws its orbital, bond orders unequal', async ({
	page
}) => {
	await page.goto('./huckel-molecular-orbitals/#butadiene');
	await expect(stage(page)).toContainText('butadiene · C₄H₆');
	// The HOMO is shown first, with its eigenvector beside the matrix.
	await expect(stage(page)).toContainText('orbital 2: α + 0.618β · 1 nodal plane · 2 electrons');
	await expect(stage(page)).toContainText('0.602');
	await expect(stage(page)).toContainText('delocalisation 0.472|β|');
	await expect(stage(page)).toContainText('0.447');
	await level(page, 4).click();
	await expect(stage(page)).toContainText('orbital 4: α − 1.618β · 3 nodal planes · empty');
	await level(page, 1).focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('orbital 1: α + 1.618β · 0 nodal planes');
});

test('a longer chain has a smaller HOMO-LUMO gap', async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#chains');
	await slide(page, 'chainN', '2');
	await expect(stage(page)).toContainText('ethene');
	await expect(stage(page)).toContainText('orbital 1: α + 1.000β');
	await slide(page, 'chainN', '14');
	await expect(stage(page)).toContainText('14-carbon chain');
	await expect(stage(page)).toContainText('orbital 7: α + 0.209β');
});

test('a longer cyanine absorbs redder light, beside the measured maxima', async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#cyanine');
	await slide(page, 'dyeC', '3');
	await expect(stage(page)).toContainText('model 309 nm');
	await expect(stage(page)).toContainText('measured 309 nm');
	await expect(stage(page)).toContainText('absorbs ultraviolet light');
	await slide(page, 'dyeC', '5');
	await expect(stage(page)).toContainText('model 404 nm');
	await expect(stage(page)).toContainText('measured 409 nm');
	await slide(page, 'dyeC', '7');
	await expect(stage(page)).toContainText('model 500 nm');
	await expect(stage(page)).toContainText('measured 512 nm');
	await expect(stage(page)).toContainText('absorbs green light');
	await slide(page, 'dyeC', '11');
	await expect(stage(page)).toContainText('model 694 nm');
	await expect(stage(page)).toContainText('no measured value');
	await expect(stage(page)).toContainText('absorbs red light');
});

test('benzene: a closed shell with six equal bonds and 2β of delocalisation', async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#benzene');
	await expect(stage(page)).toContainText('delocalisation 2.000|β|');
	await expect(stage(page)).toContainText('closed shell');
	const orders = await stage(page).getByText('0.667', { exact: true }).count();
	expect(orders).toBe(6);
});

test('cyclobutadiene: two electrons alone, and closing the ring costs energy', async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#cyclobutadiene');
	await expect(stage(page)).toContainText('two electrons alone in a degenerate pair');
	await expect(stage(page)).toContainText('closing the ring raises the π energy by 0.472|β|');
});

test("Hückel's rule: the electron count, not the ring size, closes the shell", async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#rule');
	await slide(page, 'ringN', '5');
	await slide(page, 'ringCharge', '-1');
	await expect(stage(page)).toContainText('cyclopentadienyl anion');
	await expect(stage(page)).toContainText('closed shell');
	await slide(page, 'ringCharge', '1');
	await expect(stage(page)).toContainText('cyclopentadienyl cation');
	await expect(stage(page)).toContainText('two electrons alone in a degenerate pair');
	// The chips build named molecules.
	await page.getByRole('button', { name: 'Build cyclooctatetraene dianion' }).click();
	await expect(stage(page)).toContainText('C₈H₈²⁻');
	await expect(stage(page)).toContainText('closed shell');
	await expect(page.locator('input[data-control="ringN"]')).toHaveValue('8');
});

test('the builder opens a ring into a chain', async ({ page }) => {
	await page.goto('./huckel-molecular-orbitals/#build');
	await expect(stage(page)).toContainText('benzene');
	const ring = page.locator('input[data-control="closed"]');
	await ring.focus();
	await page.keyboard.press('Space');
	await expect(ring).not.toBeChecked();
	await expect(stage(page)).toContainText('hexatriene');
	await expect(stage(page)).toContainText('delocalisation 0.988|β|');
});

test('the builder snaps carbons on and closes the chain by clicks on the molecule', async ({
	page
}) => {
	await page.goto('./huckel-molecular-orbitals/#build');
	await page.getByRole('button', { name: 'Build butadiene' }).click();
	await expect(stage(page)).toContainText('butadiene · C₄H₆');
	await page.getByRole('button', { name: 'Add a carbon at the end of the chain' }).click();
	await expect(stage(page)).toContainText('5-carbon chain · C₅H₇');
	await expect(stage(page)).toContainText('one unpaired electron: a radical');
	await press(page, 'Take the end carbon off');
	await press(page, 'Close the chain into a ring');
	await expect(stage(page)).toContainText('cyclobutadiene');
	await expect(stage(page)).toContainText('π energy vs the open chain: higher by 0.472|β|');
	await press(page, 'Open the ring at bond 1');
	await expect(stage(page)).toContainText('butadiene · C₄H₆');
});
