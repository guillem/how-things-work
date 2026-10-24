import { expect, test } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test('shortening the ruler quadruples its note, and the handle keeps the slider in step', async ({
	page
}) => {
	await page.goto('./vibrations-and-sound/#pitch');
	const handle = page.getByRole('slider', { name: 'Length of free ruler' });
	await expect(page.locator('.stage')).toContainText('10 cm: 82 wobbles each second');
	await handle.focus();
	await handle.press('Home');
	await expect(page.locator('input[data-control=length]')).toHaveValue('5');
	await expect(page.locator('.stage')).toContainText('5 cm: 326 wobbles each second');
});
test('moving the ear away reduces arriving energy without changing the ruler', async ({ page }) => {
	await page.goto('./vibrations-and-sound/#distance');
	await expect(page.locator('.stage')).toContainText('2 metres away: 25%');
	await page.locator('input[data-control=distance]').fill('8');
	await expect(page.locator('.stage')).toContainText('8 metres away: 2%');
});
test('pumping all the air out keeps the bell but stops its airborne sound', async ({ page }) => {
	await page.goto('./vibrations-and-sound/#jar');
	await expect(page.locator('.stage')).toContainText('100% of the air remains');
	await page.locator('input[data-control=air]').fill('0');
	await expect(page.locator('.stage')).toContainText('No air: no airborne sound');
	await expect(page.locator('.stage')).toContainText('The bell still vibrates');
	await page.getByRole('button', { name: 'Ring and hear' }).click();
	await expect(page.locator('.stage')).toContainText('No airborne sound reaches the ear');
});

test('the speakers stay silent until asked, then play the shortened ruler’s computed note', async ({
	page
}) => {
	await page.addInitScript(() => {
		const trace: number[] = [];
		(window as unknown as Window & { soundFrequencies: number[] }).soundFrequencies = trace;
		const NativeAudioContext = AudioContext;
		window.AudioContext = class extends NativeAudioContext {
			override createOscillator(): OscillatorNode {
				const oscillator = super.createOscillator(),
					start = oscillator.start.bind(oscillator);
				oscillator.start = (when?: number) => {
					trace.push(oscillator.frequency.value);
					start(when);
				};
				return oscillator;
			}
		};
	});
	await page.goto('./vibrations-and-sound/#pitch');
	await expect(page.getByRole('button', { name: 'Twang and hear' })).toBeVisible();
	expect(
		await page.evaluate(
			() => (window as unknown as Window & { soundFrequencies: number[] }).soundFrequencies
		)
	).toEqual([]);
	await page.locator('input[data-control=length]').fill('5');
	await page.getByRole('button', { name: 'Twang and hear' }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as unknown as Window & { soundFrequencies: number[] }).soundFrequencies[0]
			)
		)
		.toBeGreaterThan(325);
	const frequencies = await page.evaluate(
		() => (window as unknown as Window & { soundFrequencies: number[] }).soundFrequencies
	);
	expect(frequencies).toHaveLength(1);
	expect(frequencies[0]).toBeLessThan(327);
	await expect(page.locator('.stage')).toContainText('Playing the model’s note');
});
