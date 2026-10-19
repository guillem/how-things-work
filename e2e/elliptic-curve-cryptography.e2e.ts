import { expect, test, type Page } from '@playwright/test';

// The elliptic-curve-cryptography explainer: what a visitor sees when they drag points on the
// real curve, change the field, add points mod 97, multiply by k, watch Eve search, run ECDH,
// and check the real standards. Reduced motion shows each construction finished. The model
// tests check the mathematics and the standards themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
/** The point "(x, y)" printed after `prefix` on the stage. */
/** y² = x³ + 7 holds for the printed point, up to the rounding of its two decimals. */
const onCurve = (p: { x: number; y: number }) =>
	Math.abs(p.y ** 2 - p.x ** 3 - 7) / (p.y ** 2 + 1) < 0.02;
const point = async (page: Page, prefix: string) => {
	const text = ((await stage(page).textContent()) ?? '').replace(/−/g, '-');
	const m = new RegExp(`${prefix.replace(/[+()]/g, '\\$&')} = \\((-?[\\d.]+), (-?[\\d.]+)\\)`).exec(
		text
	);
	if (!m) throw new Error(`no "${prefix}" on the stage`);
	return { x: Number(m[1]), y: Number(m[2]) };
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'dragging P on the real curve moves P + Q, and the sum stays on y² = x³ + 7',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./elliptic-curve-cryptography/#chord');
		await expect(stage(page)).toContainText('P + Q = (4.31, −9.33)');
		const handle = page.getByRole('slider', { name: 'Point P on the curve' });
		await handle.focus();
		await handle.press('Shift+ArrowUp'); // y from −2.5 to −1.5
		await expect(stage(page)).toContainText('P = (−1.68, −1.50)');
		await expect(range(page, 'py')).toHaveValue('-1.5');
		const s = await point(page, 'P + Q');
		expect(s.x).not.toBeCloseTo(4.31, 1);
		expect(onCurve(s)).toBe(true);
	}
);

test('the tangent step doubles P, and P plus its twin is the point at infinity', async ({
	page
}) => {
	await page.goto('./elliptic-curve-cryptography/#tangent');
	const d = await point(page, '2P');
	expect(onCurve(d)).toBe(true);
	await page.goto('./elliptic-curve-cryptography/#infinity');
	await expect(stage(page)).toContainText('P + (−P) = O');
});

test('over F_p the point count follows p and stays inside the Hasse band', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#field');
	await expect(stage(page)).toContainText('78 dots + O = 79 points');
	await choose(page, 'prime', '13');
	await expect(stage(page)).toContainText('6 dots + O = 7 points');
	await choose(page, 'prime', '163');
	await expect(stage(page)).toContainText('138 dots + O = 139 points');
});

test('adding points mod 97: a sum, a doubling and P + (−P) = O', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#field-add');
	await expect(stage(page)).toContainText('P + Q = (68, 16)');
	// The second point in order is (1, 69), the mirror twin of P = (1, 28).
	await range(page, 'qi').press('Home');
	await expect(stage(page)).toContainText('Q = P: the tangent');
	await range(page, 'qi').press('ArrowRight');
	await expect(stage(page)).toContainText('Q = (1, 69)');
	await expect(stage(page)).toContainText('P + Q = O');
});

test('double-and-add takes a handful of steps; Eve needs k tries', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#multiply');
	await expect(stage(page)).toContainText('8 operations instead of 52 additions');
	await range(page, 'k').press('End');
	await expect(stage(page)).toContainText('in binary: 1001110');
	await expect(stage(page)).toContainText('9 operations instead of 77 additions');
	await page.goto('./elliptic-curve-cryptography/#dlog');
	await range(page, 'k').press('End');
	await expect(stage(page)).toContainText('found after 78 tries: k = 78');
});

test('Alice and Bob reach the same point whatever their secrets', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#ecdh');
	await expect(stage(page)).toContainText('both: S = 39G = (73, 32)');
	await range(page, 'a').press('End');
	await range(page, 'b').press('Home');
	await expect(stage(page)).toContainText('both: S = 78G = (1, 69)');
	await expect(stage(page)).toContainText('78 · B');
	await expect(stage(page)).toContainText('1 · A');
});

test('the browser checks secp256k1 and reproduces the RFC 7748 key exchange', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#secp256k1');
	await expect(stage(page)).toContainText('G is on the curve');
	await expect(stage(page)).toContainText('n · G = O');
	await page.goto('./elliptic-curve-cryptography/#x25519');
	await expect(stage(page).getByText('✓ matches the RFC')).toHaveCount(4);
	await expect(stage(page)).toContainText('4a5d9d5b a4ce2de1 728e3bf4 80350f25');
});

test('a curve key is 12 times shorter at 128 bits and 30 times at 256', async ({ page }) => {
	await page.goto('./elliptic-curve-cryptography/#sizes');
	await expect(stage(page)).toContainText('12× shorter on the curve');
	await choose(page, 'security', '256');
	await expect(stage(page)).toContainText('30× shorter on the curve');
});
