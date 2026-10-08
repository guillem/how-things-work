import { expect, test } from '@playwright/test';

test('colouring the table by another property changes the legend and its unit', async ({
	page
}) => {
	await page.goto('/atoms-periodic-table/#trends');
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
