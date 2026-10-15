import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[role=radio][data-control="${id}"][data-value="${value}"]`);

test('AM and FM widen the spectrum: 1 MHz for AM, about 4 MHz for FM', async ({ page }) => {
	await page.goto('./wireless-signals/#carrier');
	await expect(stage(page)).toContainText('99% of the power within a single frequency');
	await page.goto('./wireless-signals/#am');
	await expect(stage(page)).toContainText('99% of the power within 1.0 MHz');
	await page.goto('./wireless-signals/#fm');
	await expect(stage(page)).toContainText('99% of the power within 4.0 MHz');
});

test('smoothing the switches shrinks the bandwidth; faster symbols widen it', async ({ page }) => {
	await page.goto('./wireless-signals/#bandwidth');
	await expect(stage(page)).toContainText('99% of the power within 18 MHz (wider than shown)');
	await page.getByRole('switch', { name: 'Smooth the switches' }).check({ force: true });
	await expect(stage(page)).toContainText('99% of the power within 1.1 MHz');
	await range(page, 'rate').fill('2');
	await expect(stage(page)).toContainText('99% of the power within 2.2 MHz');
	await expect(stage(page)).toContainText('2 million symbols per second');
});

test('the bits change what the wave does', async ({ page }) => {
	await page.goto('./wireless-signals/#keying');
	await expect(stage(page)).toContainText('Phase keying');
	await option(page, 'keyMode', 'fsk').click();
	await expect(stage(page)).toContainText('Frequency keying: 6 MHz = 1, 4 MHz = 0');
	await expect(stage(page)).toContainText('spins one way for 1');
	// "H" = 01001000, one bit per symbol
	await expect(stage(page)).toContainText('01001000');
});

test('more signal, fewer misread bits: the measured BER follows the cliff', async ({ page }) => {
	await page.goto('./wireless-signals/#ber');
	await expect(stage(page)).toContainText('QPSK at 8.0 dB SNR');
	await expect(stage(page)).toContainText('wrong of 200,000 bits');
	await range(page, 'snr').fill('35');
	await expect(stage(page)).toContainText('At 35.0 dB: 0 errors in 200,000 bits');
	await range(page, 'snr').fill('-5');
	await expect(stage(page)).toContainText('theory: 29%');
});

test('distance lowers the SNR by 20 dB per tenfold step; 5 GHz loses 6.5 dB more', async ({
	page
}) => {
	await page.goto('./wireless-signals/#distance');
	await expect(stage(page)).toContainText('signal-to-noise ratio: 20.8 dB');
	await expect(stage(page)).toContainText('0 wrong in 200,000 bits');
	await range(page, 'logd').fill('4');
	await expect(stage(page)).toContainText('signal-to-noise ratio: 0.8 dB');
	await expect(stage(page)).toContainText('of bits wrong');
	await range(page, 'logd').fill('3');
	await option(page, 'band', '5').click();
	await expect(stage(page)).toContainText('signal-to-noise ratio: 14.2 dB');
});

test('a neighbour hurts on overlapping channels, not on 1 or 11', async ({ page }) => {
	await page.goto('./wireless-signals/#neighbour');
	await expect(stage(page)).toContainText('50% of the neighbour’s signal falls in your channel');
	await option(page, 'nbCh', '6').click();
	await range(page, 'nbDb').fill('0');
	await expect(stage(page)).toContainText('100% of the neighbour’s signal');
	await expect(stage(page)).toContainText('of bits wrong');
	await option(page, 'nbCh', '11').click();
	await expect(stage(page)).toContainText('0% of the neighbour’s signal');
	await expect(stage(page)).toContainText('0 wrong in 200,000 bits');
});

test('denser constellations need more SNR for the same errors', async ({ page }) => {
	await page.goto('./wireless-signals/#qam');
	await range(page, 'snr').fill('20');
	await option(page, 'scheme', 'qpsk').click();
	await expect(stage(page)).toContainText('At 20.0 dB: 0 errors');
	await option(page, 'scheme', 'qam64').click();
	await expect(stage(page)).toContainText('64-QAM at 20.0 dB SNR');
	await expect(stage(page)).toContainText('theory: 8.5 × 10⁻³');
});

test('wider channels: more rate, but less than in proportion', async ({ page }) => {
	await page.goto('./wireless-signals/#width');
	await expect(stage(page)).toContainText('95.6 Mbit/s');
	await option(page, 'width', '160').click();
	await expect(stage(page)).toContainText('8× the width → 3.5× the rate');
});

test('Shannon’s limit at the chosen SNR', async ({ page }) => {
	await page.goto('./wireless-signals/#shannon');
	await expect(stage(page)).toContainText('at most 2.9 bits per second per hertz');
	// Wi-Fi 5 sits right of the curve: 4.9 bit/s/Hz needs at least 20 dB, not 14.5
	await expect(stage(page)).toContainText('Wi-Fi 5 with its code: 4.9, needs at least 20 dB');
	await range(page, 'snr').fill('30');
	await expect(stage(page)).toContainText('at most 10.0 bits per second per hertz, 199 Mbit/s');
	await expect(stage(page)).toContainText('without a code: BPSK, QPSK, 16-QAM, 64-QAM');
});
