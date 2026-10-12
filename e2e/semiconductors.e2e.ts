import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test(
	'doping: phosphorus adds free electrons, boron adds holes, and the two cancel',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./semiconductors/#donor');
		await expect(stage(page)).toContainText(/Free electrons: 1\s+·\s+Holes: 0/);
		await stage(page)
			.getByRole('button', { name: 'Silicon atom, row 1, column 1: replace with phosphorus' })
			.click();
		await expect(stage(page)).toContainText(/Free electrons: 2\s+·\s+Holes: 0/);
		await expect(stage(page)).toContainText('n-type');
		// Two boron atoms take both spare electrons: compensation.
		await stage(page).getByRole('button', { name: 'Choose boron' }).click();
		await stage(page)
			.getByRole('button', { name: 'Silicon atom, row 5, column 7: replace with boron' })
			.click();
		await stage(page)
			.getByRole('button', { name: 'Silicon atom, row 5, column 1: replace with boron' })
			.press('Enter');
		await expect(stage(page)).toContainText(/Free electrons: 0\s+·\s+Holes: 0/);
		await expect(stage(page)).toContainText('donors and acceptors cancel');
		// Putting silicon back where a boron was leaves one electron free again.
		await stage(page)
			.getByRole('button', { name: /Boron atom, row 5, column 1/ })
			.click();
		await expect(stage(page)).toContainText(/Free electrons: 1\s+·\s+Holes: 0/);
		await expect(page).toHaveURL(/#donor$/);
	}
);

test('boron makes p-type silicon with a hole', async ({ page }) => {
	await page.goto('./semiconductors/#acceptor');
	await expect(stage(page)).toContainText(/Free electrons: 0\s+·\s+Holes: 1/);
	await expect(stage(page)).toContainText('p-type');
	await expect(stage(page)).toContainText('acceptor level (B): 45 meV above the band');
});

test('a phosphorus added later hands its electron to the boron over time, not instantly', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./semiconductors/#acceptor');
	await expect(stage(page)).toContainText(/Free electrons: 0\s+·\s+Holes: 1/);
	await page.clock.runFor(5000); // the starting boron has long since become a B⁻ ion
	const plus = stage(page).getByText('+', { exact: true }); // ions and the battery's + plate
	const before = await plus.count();
	await stage(page).getByRole('button', { name: 'Choose phosphorus' }).click();
	await stage(page)
		.getByRole('button', { name: 'Silicon atom, row 1, column 1: replace with phosphorus' })
		.click();
	await expect(stage(page)).toContainText('donors and acceptors cancel');
	// The electron is still on its way: the phosphorus is not yet a P⁺ ion.
	await expect(plus).toHaveCount(before);
	await page.clock.runFor(2000);
	await expect(plus).toHaveCount(before + 2); // P⁺ in the crystal and on the donor level
});

test('the doping slider sets the resistivity, and boron conducts less than phosphorus', async ({
	page
}) => {
	await page.goto('./semiconductors/#amount');
	await page.locator('input[type=range][data-control=conc]').fill('16');
	await expect(stage(page)).toContainText('0.53 Ω·cm');
	await page.locator('button[data-control=kind][data-value=p]').click();
	await expect(stage(page)).toContainText('1.5 Ω·cm');
	await expect(stage(page)).toContainText('Boron-doped');
});

test('joining the two pieces opens a depletion zone and bends the bands', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./semiconductors/#pn');
	await expect(stage(page)).toContainText('Two separate pieces');
	await page.getByRole('switch', { name: 'Join the two pieces' }).check({ force: true });
	await expect(stage(page)).toContainText('Joined: a depletion zone has formed');
	await expect(stage(page)).toContainText('depletion zone 0.15 µm');
	await expect(stage(page)).toContainText('hill for electrons: 0.84 eV');
});

test('forward voltage drives a current that grows tenfold per 60 mV; reverse blocks it', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./semiconductors/#forward');
	await expect(stage(page)).toContainText('current: 575 µA');
	await page.locator('input[type=range][data-control=vf]').fill('0.76');
	await expect(stage(page)).toContainText('current: 5.85 mA');
	await page.goto('./semiconductors/#reverse');
	await expect(stage(page)).toContainText('current: −1.00 fA: practically none');
	await page.locator('input[type=range][data-control=vr]').fill('-0.5');
	await expect(stage(page)).toContainText('current: −1.00 fA: practically none');
	// Reverse voltage widens the depletion zone.
	await expect(stage(page)).toContainText('depletion zone 0.19 µm');
});

test('the dot on the I–V curve moves by keyboard', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./semiconductors/#curve');
	await expect(stage(page)).toContainText('0.70 V → 575 µA');
	const dot = stage(page).getByRole('slider', { name: 'Voltage across the diode' });
	await dot.press('End');
	await expect(stage(page)).toContainText('0.80 V → 27.5 mA');
	await dot.press('Home');
	await expect(stage(page)).toContainText('-2.00 V → −1.00 fA');
	await expect(page.locator('input[type=range][data-control=v]')).toHaveValue('-2');
});
