import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test(
	'snapping atoms onto carbon builds methane, and atoms that do not fit are refused',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./chemical-bonds/#build');
		await expect(stage(page)).toContainText('2 more bonds to fill C');
		const addH = stage(page).getByRole('button', { name: 'Add H' });
		await addH.click();
		await addH.click();
		await expect(stage(page)).toContainText('CH₄');
		await expect(stage(page)).toContainText('methane');
		await expect(stage(page)).toContainText('tetrahedral');
		await expect(stage(page)).toContainText('109.5°');
		// Carbon is full: oxygen is refused.
		await stage(page).getByRole('button', { name: 'Add O' }).press('Enter');
		await expect(stage(page)).toContainText('C has no unpaired electrons left');
		// Taking a hydrogen off opens a place again (the molecule turns slowly, so use the keyboard).
		await stage(page).getByRole('button', { name: 'Remove this H atom' }).first().press('Enter');
		await expect(stage(page)).toContainText('CH₃');
		await expect(stage(page)).toContainText('1 more bond to fill C');
		await expect(page).toHaveURL(/#build$/);
	}
);

test('dragging an atom from the palette onto the molecule bonds it', async ({ page }) => {
	await page.goto('./chemical-bonds/#build');
	const token = stage(page).getByRole('button', { name: 'Add O' });
	const target = stage(page).getByRole('slider', { name: /Turn the molecule/ });
	await token.dragTo(target);
	await expect(stage(page)).toContainText('CH₂O');
	await expect(stage(page)).toContainText('formaldehyde');
	await expect(stage(page)).toContainText('trigonal planar');
});

test('the charge map shows water is polar and carbon dioxide is not', async ({ page }) => {
	await page.goto('./chemical-bonds/#polar');
	await expect(stage(page)).toContainText('H₂O');
	await expect(stage(page)).toContainText('Polar');
	await expect(stage(page)).toContainText('δ− electrons pulled here');
	await stage(page).getByRole('button', { name: 'Build CO₂' }).click();
	await expect(stage(page)).toContainText('Not polar');
	await expect(stage(page)).toContainText('cancel out by symmetry');
	await page.getByRole('switch', { name: 'Charge map' }).uncheck({ force: true });
	await expect(stage(page)).not.toContainText('δ− electrons pulled here');
});

test('lone pairs close the bond angle: methane, ammonia, water', async ({ page }) => {
	await page.goto('./chemical-bonds/#lonepairs');
	await expect(stage(page)).toContainText('bent');
	await page.locator('button[data-control=lpMol][data-value=NH3]').click();
	await expect(stage(page)).toContainText('trigonal pyramidal');
	await expect(stage(page)).toContainText('H–N–H angle: 106.7°');
	await page.locator('button[data-control=lpMol][data-value=CH4]').click();
	await expect(stage(page)).toContainText('tetrahedral');
});

test('a big electronegativity difference hands the electron over', async ({ page }) => {
	await page.goto('./chemical-bonds/#tug');
	await expect(stage(page)).toContainText('a polar covalent bond');
	await page.locator('button[data-control=pair][data-value=NaCl]').click();
	await expect(stage(page)).toContainText('the electron is handed over (ionic)');
	await page.locator('button[data-control=pair][data-value=HH]').click();
	await expect(stage(page)).toContainText('identical atoms share equally');
});

test('two to six electron pairs settle into the VSEPR arrangements', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./chemical-bonds/#repel');
	await expect(stage(page)).toContainText('tetrahedral');
	await expect(stage(page)).toContainText('109.5°');
	const pairs = page.locator('input[type=range][data-control=pairs]');
	await pairs.fill('2');
	await expect(stage(page)).toContainText('linear');
	await expect(stage(page)).toContainText('180°');
	await pairs.fill('6');
	await expect(stage(page)).toContainText('octahedral');
	await expect(stage(page)).toContainText('90°, 180°');
});
