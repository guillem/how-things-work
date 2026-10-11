import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('adding a proton turns carbon into nitrogen, and the readout follows', async ({ page }) => {
	await page.goto('./atoms-periodic-table/#build');
	await expect(stage(page)).toContainText('carbon-12');
	await expect(stage(page)).toContainText('stable nucleus');
	await page.locator('.action button[data-control=addProton]').click();
	await expect(stage(page)).toContainText('Nitrogen');
	await expect(stage(page)).toContainText('nitrogen-13');
	await expect(stage(page)).toContainText('ion: +1');
	await expect(stage(page)).toContainText('Nearest stable: nitrogen-14');
});

test('filling 24 electrons shows chromium and its exception to the filling rule', async ({
	page
}) => {
	await page.goto('./atoms-periodic-table/#shells');
	await expect(stage(page)).toContainText('Sodium (Na)');
	await page.locator('input[type=range][data-control=fillTo]').fill('24');
	await expect(stage(page)).toContainText('Chromium (Cr)');
	await expect(stage(page)).toContainText('differs from the rule: 3d⁵ 4s¹, not 3d⁴ 4s²');
	await page.locator('input[type=range][data-control=fillTo]').fill('25');
	await expect(stage(page)).not.toContainText('differs from the rule');
});

test('the orbital cloud turns with the arrow keys without leaving the step', async ({ page }) => {
	await page.goto('./atoms-periodic-table/#orbitals');
	await expect(stage(page)).toContainText('90% of the time inside here');
	const turn = stage(page).locator('[role=slider]');
	await turn.focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowUp');
	await expect(page).toHaveURL(/#orbitals$/);
	await page.locator('button[data-control=orbital][data-value="2p"]').click();
	await expect(stage(page)).toContainText('ψ negative');
});

test('colouring the table by another property changes the legend and its unit', async ({
	page
}) => {
	await page.goto('./atoms-periodic-table/#trends');
	const stage = page.locator('.stage svg > g');
	await expect(stage).toContainText('Atomic radius (covalent, pm)');
	await page.locator('button[data-control=colourBy][data-value=ionization]').click();
	await expect(stage).toContainText('First ionization energy (eV)');
	await expect(stage).not.toContainText('Atomic radius (covalent, pm)');

	// The keyboard cursor shows an element's card (sodium first), and arrows move it.
	await page.getByRole('slider', { name: /Periodic table/ }).focus();
	await expect(stage).toContainText('Sodium');
	await page.keyboard.press('ArrowRight');
	await expect(stage).toContainText('Magnesium');
	await expect(page).toHaveURL(/#trends$/);
});
