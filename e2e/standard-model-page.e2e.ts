import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

// Reduced motion: the quarks in the bag and the decay products hold still to be tapped.
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}
const pad = (page: Page, name: string) => stage(page).getByRole('button', { name, exact: true });

test('building a proton, then a neutron, from quarks', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './standard-model/#proton');
	await expect(stage(page)).toContainText('proton');
	await expect(stage(page)).toContainText('+⅔ +⅔ −⅓ = +1');
	// Swap one up quark for a down quark: a neutron, charge 0.
	await stage(page)
		.getByRole('button', { name: /^u \(.*\): take it out/ })
		.first()
		.click();
	await pad(page, 'Add quark d').click();
	await expect(stage(page)).toContainText('neutron');
	await expect(stage(page)).toContainText('= 0');
	// The preset control now reads "your own".
	await expect(page.getByRole('radio', { name: 'your own' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('two quarks are not colourless; a quark and an antiquark are', async ({ page }) => {
	await open(page, './standard-model/#colour');
	await pad(page, 'Empty the bag').click();
	await pad(page, 'Add quark u').click();
	await pad(page, 'Add quark d').click();
	await expect(stage(page)).toContainText('Not colourless: cannot exist alone');
	await expect(stage(page)).toContainText('not colourless ✗');
	await stage(page)
		.getByRole('button', { name: /^d \(.*\): take it out/ })
		.click();
	await pad(page, 'Add antiquark d').click();
	await expect(stage(page)).toContainText('π⁺');
	await expect(stage(page)).toContainText('colour + anticolour ✓');
});

test('presets name real hadrons with PDG masses, and the top quark never binds', async ({
	page
}) => {
	await open(page, './standard-model/#zoo');
	await page.getByRole('radio', { name: 'Ω⁻' }).click();
	await expect(stage(page)).toContainText('1.672 GeV');
	await page.getByRole('radio', { name: 'antiproton' }).click();
	await expect(stage(page)).toContainText('antiproton');
	await expect(stage(page)).toContainText('= −1');
	await pad(page, 'Empty the bag').click();
	await pad(page, 'Add quark u').click();
	await pad(page, 'Add antiquark t').click();
	await expect(stage(page)).toContainText('No hadron (top quark)');
});

test('the proton’s quarks are about 1% of its mass', async ({ page }) => {
	await open(page, './standard-model/#mass');
	await expect(stage(page)).toContainText('proton: 938.3 MeV · quarks 1.0%');
});

test('beta decay: the ledger stays the same at every moment', async ({ page }) => {
	await open(page, './standard-model/#beta');
	await page.getByRole('radio', { name: '2 · exchange' }).click();
	await expect(stage(page)).toContainText('the W⁻ is virtual');
	await expect(stage(page)).toContainText('0.78 MeV');
	await page.getByRole('radio', { name: '3 · after' }).click();
	await expect(stage(page)).toContainText('u d u e⁻ ν̄e');
});

test('the process control switches the diagram', async ({ page }) => {
	await open(page, './standard-model/#processes');
	await page.getByRole('radio', { name: 'Quarks swap colour' }).click();
	await expect(stage(page)).toContainText('strong force · carrier g');
	await expect(stage(page)).toContainText('1 red + 1 green');
	await page.getByRole('radio', { name: 'Pion decay' }).click();
	await expect(stage(page)).toContainText('W⁺ → μ⁺ + νμ');
});

test('removing the antineutrino from neutron decay breaks lepton number', async ({ page }) => {
	await open(page, './standard-model/#conserve');
	await expect(stage(page)).toContainText('Not forbidden by these laws');
	await expect(stage(page)).toContainText('essentially every decay');
	await stage(page).getByRole('button', { name: 'ν̄e: take it out' }).click();
	await expect(stage(page)).toContainText('Forbidden');
	await expect(stage(page)).toContainText('breaks: electron number, spin');
	await page.getByRole('button', { name: 'Back to the real decay' }).click();
	await expect(stage(page)).toContainText('Not forbidden by these laws');
});

test('proton decay is forbidden, and the search limit is shown', async ({ page }) => {
	await open(page, './standard-model/#forbidden');
	await page.getByRole('radio', { name: 'p', exact: true }).click();
	await expect(stage(page)).toContainText('breaks: baryon number, electron number');
	await expect(stage(page)).toContainText('2.4 × 10³⁴ years');
	// A free proton has too little mass to become a neutron.
	await page.getByRole('button', { name: 'e⁺: take it out' }).click();
	await stage(page).getByRole('button', { name: 'π⁰: take it out' }).click();
	await pad(page, 'Add n').click();
	await pad(page, 'Add e⁺').click();
	await pad(page, 'Add νe').click();
	await expect(stage(page)).toContainText('breaks: energy');
});

test('the particle table shows a particle’s PDG data when tapped', async ({ page }) => {
	await open(page, './standard-model/#seventeen');
	await stage(page).getByRole('button', { name: 'muon: show details' }).click();
	await expect(stage(page)).toContainText('105.7 MeV');
	await expect(stage(page)).toContainText('2.2 μs');
	await stage(page).getByRole('button', { name: 'W boson: show details' }).press('Enter');
	await expect(stage(page)).toContainText('80.36 GeV');
});

test('gravity has no carrier in the Standard Model', async ({ page }) => {
	await open(page, './standard-model/#four-forces');
	await expect(stage(page)).toContainText('Three of the four forces come');
	await page.getByRole('radio', { name: 'Gravity' }).click();
	await expect(stage(page)).toContainText('none in the Standard Model');
});
