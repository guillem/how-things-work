import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
async function press(page: Page, id: string, times = 1) {
	for (let i = 0; i < times; i++) await page.locator(`button[data-control=${id}]`).click();
}

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

// Reduced motion: gates and measurements land at once, and the Bell step shows 1000 pairs.
test.use({ reducedMotion: 'reduce' });

test('gates turn the qubit, and every gate can be undone', async ({ page }) => {
	await open(page, './quantum-computing/#gates');
	await press(page, 'reset');
	await expect(stage(page)).toContainText('P(0) = |α|² = 100%');
	await press(page, 'gateH');
	await expect(stage(page)).toContainText('P(0) = |α|² = 50%');
	await press(page, 'gateH');
	await expect(stage(page)).toContainText('P(0) = |α|² = 100%');
	await press(page, 'gateX');
	await expect(stage(page)).toContainText('P(1) = |β|² = 100%');
	// Z changes the phase, not the odds
	await press(page, 'gateH');
	await press(page, 'gateZ');
	await expect(stage(page)).toContainText('P(1) = |β|² = 50%');
	await expect(stage(page)).toContainText('180° about z');
});

test('dragging the state by keyboard: End takes it to |1⟩', async ({ page }) => {
	await open(page, './quantum-computing/#qubit');
	await expect(stage(page)).toContainText('P(0) = |α|² = 75%');
	await page.getByRole('slider', { name: 'Tip of the state arrow' }).press('End');
	await expect(stage(page)).toContainText('P(1) = |β|² = 100%');
	await expect(range(page, 'theta')).toHaveValue('180');
});

test('a measurement gives one bit and leaves the qubit in it', async ({ page }) => {
	await open(page, './quantum-computing/#measure');
	await range(page, 'theta').fill('90');
	await press(page, 'measureOnce');
	const got =
		(await stage(page)
			.locator('text', { hasText: /^got [01]$/ })
			.textContent()) ?? '';
	const bit = got.endsWith('1') ? '1' : '0';
	await expect(stage(page)).toContainText(`now the state is |${bit}⟩`);
	await expect(range(page, 'theta')).toHaveValue(bit === '1' ? '180' : '0');
	// measuring again gives the same answer, every time
	await press(page, 'measureOnce', 3);
	await expect(stage(page)).toContainText(`got ${bit}`);
	await expect(stage(page)).toContainText(`now the state is |${bit}⟩`);
});

test('the measurement is blind to the phase: round a latitude the odds stay the same', async ({
	page
}) => {
	await open(page, './quantum-computing/#measure');
	await range(page, 'theta').fill('120');
	await expect(stage(page)).toContainText('P(0) = |α|² = 25%');
	await range(page, 'phi').fill('200');
	await expect(range(page, 'phi')).toHaveValue('200');
	await expect(stage(page)).toContainText('P(0) = |α|² = 25%');
});

test('fresh copies settle on Born’s odds', async ({ page }) => {
	await open(page, './quantum-computing/#measure');
	await range(page, 'theta').fill('120'); // P(0) = cos²60° = 25%
	await press(page, 'measureMany', 5);
	await expect(stage(page)).toContainText('fresh copies of this state, measured: 500');
	const zero = await stage(page)
		.locator('text', { hasText: /^0: \d+$/ })
		.textContent();
	const n0 = Number(zero?.split(': ')[1]);
	expect(n0).toBeGreaterThan(90);
	expect(n0).toBeLessThan(160);
});

test('two paths cancel, a phase steers them, and a measurement between them spoils it', async ({
	page
}) => {
	await open(page, './quantum-computing/#interfere');
	await expect(stage(page)).toContainText('P(1) = 0%');
	await range(page, 'shift').fill('180');
	await expect(stage(page)).toContainText('P(1) = 100%');
	await range(page, 'shift').fill('90');
	await expect(stage(page)).toContainText('P(1) = 50%');
	await range(page, 'shift').fill('0');
	await page.locator('input[type=checkbox][data-control=peek]').check({ force: true });
	await expect(stage(page)).toContainText('P(1) = 50%');
	await expect(stage(page)).toContainText('probabilities add');
});

test('n qubits need 2ⁿ amplitudes', async ({ page }) => {
	await open(page, './quantum-computing/#register');
	await press(page, 'hA');
	await press(page, 'hB');
	await expect(stage(page)).toContainText('a product state');
	await range(page, 'qubits').fill('50');
	await expect(stage(page)).toContainText('1.1 × 10¹⁵ amplitudes');
	await expect(stage(page)).toContainText('18 PB');
});

test('H then CNOT entangles: each qubit loses its own state, and the results always agree', async ({
	page
}) => {
	await open(page, './quantum-computing/#entangle');
	await press(page, 'hA');
	await press(page, 'cnotAB');
	await expect(stage(page)).toContainText('entangled: neither qubit has a state of its own');
	await expect(stage(page).getByText('arrow length 0', { exact: true })).toHaveCount(2);
	await press(page, 'pairRuns', 3);
	await expect(stage(page)).toContainText('fresh pairs measured: 300');
	const counts = await stage(page).locator('text').allTextContents();
	const at = (lbl: string) => Number(counts[counts.indexOf(lbl) + 1]);
	expect(at('01')).toBe(0);
	expect(at('10')).toBe(0);
	expect(at('00') + at('11')).toBe(300);
	expect(at('00')).toBeGreaterThan(110);
});

test("Bell's test: agreement follows the angle, and S beats the limit of 2", async ({ page }) => {
	await open(page, './quantum-computing/#bell');
	await expect(stage(page)).toContainText('results agreed: 100%');
	await range(page, 'bobAxis').fill('180');
	await expect(stage(page)).toContainText('results agreed: 0%');
	await range(page, 'bobAxis').fill('90');
	await expect(stage(page)).toContainText('cos²(90°/2) = 50%');
	const s = await stage(page).locator('text', { hasText: /^S = / }).textContent();
	const S = Number(s?.slice(4));
	expect(S).toBeGreaterThan(2.6);
	expect(S).toBeLessThan(3);
});

test('the oracle changes no probability; diffusion grows the right answer, then overshoots', async ({
	page
}) => {
	await open(page, './quantum-computing/#oracle');
	await expect(stage(page)).toContainText('12.5%');
	await expect(stage(page)).toContainText('no probability changed');
	await open(page, './quantum-computing/#amplify');
	await expect(stage(page)).toContainText('12.5%');
	await range(page, 'ops').fill('2');
	await expect(stage(page)).toContainText('78.1%');
	await range(page, 'ops').fill('4');
	await expect(stage(page)).toContainText('94.5%');
	await press(page, 'groverMeasure');
	await expect(stage(page)).toContainText(/101 [✓✗] (right|wrong)/);
	await range(page, 'ops').fill('6');
	await expect(stage(page)).toContainText('33.0%');
});

test('Grover rounds: stop at about π/4 √N', async ({ page }) => {
	await open(page, './quantum-computing/#rotation');
	await range(page, 'gn').fill('4');
	await range(page, 'iters').fill('3');
	await expect(stage(page)).toContainText('P = 96.1%');
	await expect(stage(page)).toContainText('stop here and measure');
	await range(page, 'iters').fill('5');
	await expect(stage(page)).toContainText('overshot');
});

test('the speed-up is a square root', async ({ page }) => {
	await open(page, './quantum-computing/#speedup');
	await expect(stage(page)).toContainText('n = 20: 524,289 against 804');
	await expect(stage(page)).toContainText('Sorting');
});
