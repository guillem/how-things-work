import { expect, test, type Page } from '@playwright/test';

// The phase-portraits explainer: what a visitor sees when they drag the entries or the
// eigenvalues of a linear system, pick a fixed point of the pendulum to linearise, shrink the
// magnifier, compare the frictionless pendulum with a twin of the same linearisation, and push μ
// through the Hopf bifurcation. The model tests check the numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choice = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'dragging the entries moves the system across the trace–determinant chart',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./phase-portraits/#plane');
		await expect(stage(page)).toContainText('origin: stable spiral');
		await expect(stage(page)).toContainText('λ = −0.25 ± 0.97i');
		// no friction: a centre
		await range(page, 'd').fill('0');
		await expect(stage(page)).toContainText('origin: centre');
		await expect(stage(page)).toContainText('period 2π/ω = 6.28');
		// friction that pushes: an unstable spiral
		await range(page, 'd').fill('0.5');
		await expect(stage(page)).toContainText('origin: unstable spiral');
		// a negative determinant: a saddle
		await range(page, 'c').fill('1');
		await expect(stage(page)).toContainText('origin: saddle');
		await expect(stage(page)).toContainText('det Δ = −1.00');
	}
);

test('the eigenvectors of a saddle are its straight-line orbits', async ({ page }) => {
	await page.goto('./phase-portraits/#eigen');
	await expect(stage(page)).toContainText('λ₁ = 1.00: out');
	await expect(stage(page)).toContainText('λ₂ = −1.50: in');
});

test('eigenvalues dragged with the keyboard: meet on the axis, then leave it as a pair', async ({
	page
}) => {
	await page.goto('./phase-portraits/#kinds');
	await expect(stage(page)).toContainText('origin: stable node');
	// the imaginary part can't be raised while the two real eigenvalues differ
	await expect(range(page, 'w')).toBeDisabled();
	const l1 = page.getByRole('slider', { name: 'Eigenvalue λ₁' });
	const l2 = page.getByRole('slider', { name: 'Eigenvalue λ₂' });
	// lifting λ₁ alone does nothing
	await l1.focus();
	await page.keyboard.press('ArrowUp');
	await expect(stage(page)).toContainText('λ = −0.50, −2.00');
	// slide λ₂ (−2) up to λ₁ (−0.5): a double root
	await l2.focus();
	for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('origin: stable star');
	// now the pair can leave the axis: a stable spiral
	await l1.focus();
	for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
	await expect(stage(page)).toContainText('λ = −0.50 ± 0.50i');
	await expect(stage(page)).toContainText('origin: stable spiral');
	// and across the imaginary axis: unstable
	for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('origin: unstable spiral');
	// back to the real axis, and the double root splits again with one key press
	for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
	for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
	await expect(stage(page)).toContainText('origin: stable star');
	await page.keyboard.press('ArrowLeft');
	await expect(stage(page)).toContainText('λ = −1.00, −1.05');
});

test('pointing at a fixed point of the pendulum linearises there', async ({ page }) => {
	await page.goto('./phase-portraits/#pendulum');
	await expect(stage(page)).toContainText('5 fixed points');
	await page.getByRole('button', { name: /Linearise at \(π, 0\)/ }).hover();
	await expect(stage(page)).toContainText('(π, 0): saddle');
	await expect(stage(page)).toContainText('hyperbolic: the linearisation decides');
	await page.getByRole('button', { name: /Linearise at \(0, 0\)/ }).focus();
	await expect(stage(page)).toContainText('(0, 0): stable spiral');
	await expect(choice(page, 'at', 'bottom')).toHaveAttribute('aria-checked', 'true');
});

test('a smaller circle: the real flow and its linearisation close up', async ({ page }) => {
	await page.goto('./phase-portraits/#linearise');
	await expect(stage(page)).toContainText(/largest gap: 2\d\.\d % of the radius 2\.00/);
	await range(page, 'zoom').fill('0.25');
	await expect(stage(page)).toContainText(/largest gap: 0\.\d % of the radius 0\.25/);
});

test('predators and prey: a centre the linearisation can’t confirm', async ({ page }) => {
	await page.goto('./phase-portraits/#predator');
	await expect(stage(page)).toContainText('(3, 2): linearisation says centre');
	await expect(stage(page)).toContainText('linearisation can’t decide');
	await choice(page, 'atP', 'origin').click();
	await expect(stage(page)).toContainText('(0, 0): saddle');
});

test('one linearisation, three fates', async ({ page }) => {
	await page.goto('./phase-portraits/#pitfall');
	await expect(stage(page)).toContainText('0.416147 to 0.416147');
	await expect(stage(page)).toContainText('truth: a centre (energy conserved)');
	await expect(stage(page)).toContainText('truth: spirals in, as predicted');
	await choice(page, 'twin', 'inward').click();
	await expect(stage(page)).toContainText('truth: spirals in');
	await expect(stage(page)).toContainText('r: 0.90 → 0.16 after 20 time units');
	await choice(page, 'twin', 'outward').click();
	await expect(stage(page)).toContainText('truth: spirals out');
	// both panels: the same Jacobian at the origin
	await expect(stage(page).getByText('J at 0 = [[0.0, 1.0], [−1.0, 0.0]]')).toHaveCount(2);
});

test('past the Hopf bifurcation a cycle of radius √μ is born', async ({ page }) => {
	await page.goto('./phase-portraits/#hopf');
	await expect(stage(page)).toContainText('orbits settle at r = 0.500; √μ = 0.500');
	await range(page, 'muH').fill('0.64');
	await expect(stage(page)).toContainText('orbits settle at r = 0.800; √μ = 0.800');
	// at μ = 0 the linearisation says centre, but the orbits spiral in
	await range(page, 'muH').fill('0');
	await expect(stage(page)).toContainText('origin: linearisation says centre');
	await expect(stage(page)).toContainText('no cycle: orbits spiral in, slowly');
	await range(page, 'muH').fill('-0.2');
	await expect(stage(page)).toContainText('origin: stable spiral');
	await expect(stage(page)).toContainText('no cycle');
});

test('van der Pol: a cycle of amplitude about 2', async ({ page }) => {
	await page.goto('./phase-portraits/#vanderpol');
	await expect(stage(page)).toContainText('limit cycle: amplitude 2.01, period 6.66');
	await range(page, 'muV').fill('0');
	await expect(stage(page)).toContainText('origin: linearisation says centre');
});
