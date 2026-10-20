import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

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
	await page.getByRole('switch', { name: 'Charge map' }).uncheck();
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

test('the bond angle is drawn on the molecule in the still frame', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	// The arc's own label, not the readout (which quotes the same angle).
	const arc = stage(page).getByTestId('angle-arc');
	await page.goto('./chemical-bonds/#lonepairs');
	await expect(arc).toHaveText('104.5°');
	await page.locator('button[data-control=lpMol][data-value=NH3]').click();
	await expect(arc).toHaveText('106.7°');
	await page.locator('button[data-control=lpMol][data-value=CH4]').click();
	await expect(arc).toHaveText('109.5°');
	await page.goto('./chemical-bonds/#shapes');
	await expect(arc).toHaveText('106.7°');
	await stage(page).getByRole('button', { name: 'Build CH₂O' }).click();
	await expect(arc).toHaveText('116.1°');
});

test('the still frame draws the angle arc wide open, on the clearest pair of atoms', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const arc = stage(page).getByTestId('angle-arc');
	/** The arc's chord, in scene units (the stage is 960 × 600). */
	const chord = () =>
		arc.locator('path').evaluate((p: SVGPathElement) => {
			const a = p.getPointAtLength(0);
			const b = p.getPointAtLength(p.getTotalLength());
			return Math.hypot(a.x - b.x, a.y - b.y);
		});
	await page.goto('./chemical-bonds/#lonepairs');
	for (const [mol, angle] of [
		['NH3', '106.7°'],
		['CH4', '109.5°'],
		['H2O', '104.5°']
	]) {
		await page.locator(`button[data-control=lpMol][data-value=${mol}]`).click();
		await expect(arc).toHaveText(angle);
		expect(await chord()).toBeGreaterThan(60);
	}
});

test('hovering an atom holds the turning molecule still to be clicked', async ({ page }) => {
	await page.clock.install();
	await page.goto('./chemical-bonds/#build');
	const turn = stage(page).getByRole('slider', { name: /Turn the molecule/ });
	await page.clock.runFor(1000);
	// Across the empty pad, then onto an atom drawn over it (mouse moves rather than
	// hover(), which would wait for animation frames the fake clock holds back).
	const pad = await turn.boundingBox();
	const atom = await stage(page)
		.getByRole('button', { name: 'Remove this H atom' })
		.first()
		.boundingBox();
	if (!pad || !atom) throw new Error('molecule not drawn');
	await page.mouse.move(pad.x + 40, pad.y + pad.height - 40);
	await page.mouse.move(atom.x + atom.width / 2, atom.y + atom.height / 2);
	const held = await turn.getAttribute('aria-valuenow');
	await page.clock.runFor(5000);
	await expect(turn).toHaveAttribute('aria-valuenow', held ?? '');
});

// Phone readouts (as in phone-readouts.e2e.ts): on a narrow screen the readouts leave the
// drawing and are listed as text under the stage.
test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
	const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });

	test('the bond tug-of-war is text under the stage and follows the pair', async ({ page }) => {
		await page.goto('./chemical-bonds/#tug');
		const panel = readouts(page);
		await expect(panel).toContainText(/Chlorine\s*electronegativity 3\.16/);
		await expect(panel).toContainText(/H–Cl bond\s*ΔEN = 3\.16 − 2\.20 = 0\.96/);
		await expect(panel).toContainText('a polar covalent bond');
		await expect(stage(page)).not.toContainText('a polar covalent bond');
		await page.locator('button[data-control=pair][data-value=NaCl]').click();
		await expect(panel).toContainText('the electron is handed over (ionic)');
	});

	test('the molecule readout is text under the stage and follows the molecule', async ({
		page
	}) => {
		await page.goto('./chemical-bonds/#lonepairs');
		const panel = readouts(page);
		await expect(panel).toContainText(/Shape\s*bent/);
		await expect(panel).toContainText('H–O–H angle: 104.5°');
		await expect(stage(page)).not.toContainText('H–O–H angle');
		await page.locator('button[data-control=lpMol][data-value=NH3]').click();
		await expect(panel).toContainText(/Shape\s*trigonal pyramidal/);
		await expect(panel).toContainText(/Bond angles\s*CH₄ 109\.5° · NH₃ 106\.7° · H₂O 104\.5°/);
	});
});
