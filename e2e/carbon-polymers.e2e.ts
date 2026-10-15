import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const action = (page: Page, id: string) => page.locator(`.action button[data-control=${id}]`);

test(
	'building a chain: adding a carbon, an –OH and moving it renames the molecule',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./carbon-polymers/#names');
		await expect(stage(page)).toContainText('butane');
		await expect(stage(page)).toContainText('C₄H₁₀');
		await stage(page).getByRole('button', { name: 'Add a carbon' }).click();
		await expect(stage(page)).toContainText('pentane');
		await expect(stage(page)).toContainText('36 °C');
		await stage(page)
			.getByRole('button', { name: /Add –OH/ })
			.press('Enter');
		await expect(stage(page)).toContainText('pentan-1-ol');
		await expect(stage(page)).toContainText('alcohol');
		await stage(page).getByRole('button', { name: 'Move the –OH to carbon 3' }).press('Enter');
		await expect(stage(page)).toContainText('pentan-3-ol');
		// Back to the far end: the same molecule as on carbon 1.
		await stage(page).getByRole('button', { name: 'Move the –OH to carbon 5' }).press('Enter');
		await expect(stage(page)).toContainText('pentan-1-ol');
		await expect(page).toHaveURL(/#names$/);
	}
);

test('dragging a group from the palette onto a carbon bonds it there', async ({ page }) => {
	await page.goto('./carbon-polymers/#names');
	const token = stage(page).getByRole('button', { name: /Add –Cl/ });
	const box = await stage(page).getByTestId('molecule').boundingBox();
	const from = await token.boundingBox();
	if (!box || !from) throw new Error('not drawn');
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	// Onto carbon 2 of the four: just left of the middle of the drawing.
	await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 8 });
	await page.mouse.up();
	await expect(stage(page)).toContainText('2-chlorobutane');
});

test('impossible molecules are refused with the reason', async ({ page }) => {
	await page.goto('./carbon-polymers/#rings');
	await expect(stage(page)).toContainText('cyclohexane');
	await stage(page)
		.getByRole('button', { name: /Add –COOH/ })
		.press('Enter');
	await expect(stage(page)).toContainText('The –COOH carbon has to be at the end');
	await stage(page).getByRole('button', { name: 'Make a benzene ring' }).click();
	await expect(stage(page)).toContainText('benzene');
	await expect(stage(page)).toContainText('C₆H₆');
	await stage(page)
		.getByRole('button', { name: /Add –OH/ })
		.press('Enter');
	await expect(stage(page)).toContainText('phenol');
});

test('isomers: ethanol and dimethyl ether share a formula but not a boiling point', async ({
	page
}) => {
	await page.goto('./carbon-polymers/#isomers');
	await expect(stage(page)).toContainText('C₂H₆O');
	await expect(stage(page)).toContainText('boils at 78 °C: a liquid at 25 °C');
	await expect(stage(page)).toContainText('boils at −25 °C: a gas at 25 °C');
	await page.locator('button[data-control=pair][data-value=butane]').click();
	await expect(stage(page)).toContainText('C₄H₁₀');
	await expect(stage(page)).toContainText('2-methylpropane');
});

test('a chiral molecule never lines up with its mirror image; an achiral one does', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./carbon-polymers/#mirror');
	await expect(stage(page)).toContainText('bromochlorofluoromethane');
	await action(page, 'lineup').click();
	await expect(stage(page)).toContainText('2 of 4 line up, and that is the best you can do');
	await page.goto('./carbon-polymers/#handed');
	await expect(stage(page)).toContainText('L-alanine (S)');
	await page.locator('button[data-control=centre][data-value=CH2FCl]').click();
	await expect(stage(page)).toContainText('chlorofluoromethane');
	await action(page, 'lineup').click();
	await expect(stage(page)).toContainText('All four line up: the same molecule');
});

test('turning the mirror image with the keyboard changes what lines up', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./carbon-polymers/#mirror');
	const turn = stage(page).getByRole('slider', { name: /Turn the mirror image/ });
	// The scene is drawn (and listening) before the button is pressed.
	await expect(turn).toHaveAttribute('aria-valuenow', '0');
	await action(page, 'lineup').click();
	await expect(turn).toHaveAttribute('aria-valuenow', '2');
	await turn.press('Shift+ArrowLeft');
	await turn.press('Shift+ArrowLeft');
	await expect(turn).not.toHaveAttribute('aria-valuenow', '2');
});

test('longer alkane chains go from gas to liquid to a solid: polyethylene', async ({ page }) => {
	await page.goto('./carbon-polymers/#series');
	await expect(stage(page)).toContainText('C₈H₁₈');
	await expect(stage(page)).toContainText('a liquid at 25 °C');
	await range(page, 'chainLog').fill('0');
	await expect(stage(page)).toContainText('a gas at 25 °C');
	await range(page, 'chainLog').fill('4.5');
	await expect(stage(page)).toContainText('a solid at 25 °C');
	await expect(stage(page)).toContainText('polyethylene');
	await expect(stage(page)).toContainText('141 °C');
});

test('rubber: cross-links make a network, and its stiffness follows them', async ({ page }) => {
	await page.goto('./carbon-polymers/#stretch');
	await expect(stage(page)).toContainText('a network: it springs back');
	await range(page, 'xlinks').fill('0');
	await expect(stage(page)).toContainText('0: it flows');
	await range(page, 'xlinks').fill('1');
	await expect(stage(page)).toContainText('1.90 MPa');
	await range(page, 'xlinks').fill('2');
	await expect(stage(page)).toContainText('3.87 MPa');
	// Short chains: too few cross-links per chain to bear a load (ideal-network model).
	await range(page, 'units').fill('1.5');
	await range(page, 'xlinks').fill('0.5');
	await expect(stage(page)).toContainText('too few cross-links to bear a load');
	await expect(stage(page)).toContainText('stiffness from');
});

test('linking monomers: each press adds one ethylene to the chain', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./carbon-polymers/#link');
	await expect(stage(page)).toContainText('3 ethylene units (6 carbons), 84 g/mol');
	await action(page, 'addMono').click();
	await expect(stage(page)).toContainText('4 ethylene units (8 carbons), 112 g/mol');
	await action(page, 'addMono').click();
	await expect(stage(page)).toContainText('5 ethylene units (10 carbons), 140 g/mol');
});

test('the 3D chain follows the slider: octane zigzags at 112°', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./carbon-polymers/#chain');
	await range(page, 'carbons').fill('8');
	await expect(stage(page)).toContainText('C₈H₁₈');
	await expect(stage(page)).toContainText('octane');
	await expect(stage(page)).toContainText('112.4°');
});
