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

test('a nucleus far outside the known isotopes is called never made, not radioactive', async ({
	page
}) => {
	await page.goto('./atoms-periodic-table/#build');
	const remove = page.locator('.action button[data-control=removeNeutron]');
	await remove.click();
	await remove.click();
	await remove.click();
	await remove.click();
	await expect(stage(page)).toContainText('carbon-8');
	await expect(stage(page)).toContainText('radioactive nucleus (it will decay)');
	await remove.click();
	await expect(stage(page)).toContainText('carbon-7');
	await expect(stage(page)).toContainText('no such nucleus has ever been made');
	await expect(stage(page)).not.toContainText('radioactive');
	await expect(stage(page)).toContainText('Isotopes ever seen: mass numbers 8–22');
	await expect(stage(page)).toContainText('Nearest stable: carbon-12 (add 5 neutrons)');
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
	await expect(stage(page)).toContainText('90% of the timeinside this sphere');
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

test('an atom can hold one extra electron, but not two', async ({ page }) => {
	await page.goto('./atoms-periodic-table/#build');
	const add = page.locator('.action button[data-control=addElectron]');
	await add.click();
	await expect(stage(page)).toContainText('ion: −1');
	await expect(stage(page)).not.toContainText("can't hold");
	await add.click();
	await expect(stage(page)).toContainText('ion: −2');
	await expect(stage(page)).toContainText("An isolated atom can't hold this many extra");
});

test('the atom built in the first step is the one whose electrons fill in the next', async ({
	page
}) => {
	await page.goto('./atoms-periodic-table/#build');
	// Carbon, neutral: its shells hold 2 and 4.
	await expect(stage(page)).toContainText('Shells, if neutral: 2 · 4');
	await page.locator('.action button[data-control=addProton]').click();
	await expect(stage(page)).toContainText('Shells, if neutral: 2 · 5');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#shells$/);
	await expect(page.locator('input[type=range][data-control=fillTo]')).toHaveValue('7');
	await expect(stage(page)).toContainText('Nitrogen (N)');
});

test('the card marks predicted values, and mass numbers where there is no standard weight', async ({
	page
}) => {
	await page.goto('./atoms-periodic-table/#trends');
	await page.getByRole('slider', { name: /Periodic table/ }).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Oganesson');
	await expect(stage(page)).toContainText('[294]');
	await expect(stage(page)).toContainText('(predicted)');
});
