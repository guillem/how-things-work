import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);
/** The thick rebuilt signal on the spectrum steps. */
const rebuiltPath = (page: Page) => stage(page).locator('path[stroke="var(--ft-sum)"]').first();

async function open(page: Page, url: string, text: string) {
	// Reduced motion freezes the scenes on one complete frame.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

/** Drags the mouse through scene points (the stage is 960 × 600 units, letterboxed). */
async function drag(page: Page, points: { x: number; y: number }[]) {
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	const at = (p: { x: number; y: number }) => [ox + p.x * k, oy + p.y * k] as const;
	await page.mouse.move(...at(points[0]));
	await page.mouse.down();
	for (const p of points) await page.mouse.move(...at(p));
	await page.mouse.up();
}

test(
	'square: adding frequencies one at a time shrinks the gap; even ones add nothing',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './fourier-transform/#square', 'The sum so far: 1 Hz to 5 Hz');
		await expect(stage(page)).toContainText('average gap from the square wave: 0.257');
		await range(page, 'terms').fill('1');
		await expect(stage(page)).toContainText('The sum so far: 1 Hz only');
		await expect(stage(page)).toContainText('average gap from the square wave: 0.434');
		await range(page, 'terms').fill('2');
		await expect(stage(page)).toContainText('2 Hz added nothing');
		await expect(stage(page)).toContainText('average gap from the square wave: 0.434');
		await range(page, 'terms').fill('3');
		await expect(stage(page)).toContainText('newest: 3 Hz with amplitude ⅓ × 4/π = 0.424');
		await range(page, 'terms').fill('49');
		await expect(stage(page)).toContainText('25 sine waves that count');
		await expect(stage(page)).toContainText('average gap from the square wave: 0.085');
	}
);

test('gibbs: the overshoot stays near 9% of the jump as frequencies are added', async ({
	page
}) => {
	await open(page, './fourier-transform/#gibbs', 'The jump: from +1 down to −1');
	await range(page, 'terms').fill('11');
	await expect(stage(page)).toContainText('= 9.1% of the jump');
	await range(page, 'terms').fill('49');
	await expect(stage(page)).toContainText('= 8.9% of the jump');
	await expect(stage(page)).toContainText('The peak is 10 ms before the jump');
});

test('edit: lowering a bar reshapes the signal, and reset brings it back', async ({ page }) => {
	await open(page, './fourier-transform/#edit', 'The signal rebuilt from these bars');
	const bar3 = page.getByRole('slider', { name: 'Amount of 3 Hz' });
	await expect(bar3).toHaveAttribute('aria-valuetext', '3 hertz: 0.42');
	const before = await rebuiltPath(page).getAttribute('d');
	await bar3.focus();
	await page.keyboard.press('Home');
	await expect(bar3).toHaveAttribute('aria-valuetext', '3 hertz: 0.00');
	await expect(stage(page)).toContainText('The signal rebuilt from these bars (edited)');
	await expect(page).toHaveURL(/#edit$/);
	expect(await rebuiltPath(page).getAttribute('d')).not.toBe(before);
	// Arrow keys nudge a bar up.
	const bar2 = page.getByRole('slider', { name: 'Amount of 2 Hz' });
	await bar2.focus();
	await page.keyboard.press('Shift+ArrowUp');
	await expect(bar2).toHaveAttribute('aria-valuetext', '2 hertz: 0.20');
	await page.locator('button[data-control=resetBars]').click();
	await expect(bar3).toHaveAttribute('aria-valuetext', '3 hertz: 0.42');
	await expect(bar2).toHaveAttribute('aria-valuetext', '2 hertz: 0.00');
	expect(await rebuiltPath(page).getAttribute('d')).toBe(before);
	// Edits belong to their waveform: changing it on another step drops them.
	await bar3.focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('(edited)');
	await page.goto('./fourier-transform/#wind');
	await option(page, 'shape', 'sawtooth').click();
	await expect(stage(page)).toContainText('8 seconds of the sawtooth');
	await page.goto('./fourier-transform/#edit');
	await expect(bar3).toHaveAttribute('aria-valuetext', '3 hertz: 0.21');
	await expect(stage(page)).not.toContainText('(edited)');
});

test('the spectrum names what each waveform is missing', async ({ page }) => {
	await open(page, './fourier-transform/#spectrum', 'only odd frequencies');
	await option(page, 'shape', 'pulse').click();
	await expect(stage(page)).toContainText('none of 5, 10, 15 Hz');
	await option(page, 'shape', 'sawtooth').click();
	await expect(stage(page)).toContainText('every frequency from 1 Hz up');
});

test('a drawn waveform is transformed, rebuilt, and carried to the circles', async ({ page }) => {
	await open(page, './fourier-transform/#draw-wave', 'The square wave rebuilt from 1 to 5 Hz');
	await option(page, 'shape', 'drawn').click();
	await expect(stage(page)).toContainText('Drag across this graph to draw a waveform');
	// A stroke across the top graph (x 110 → 910, middle line at y 170).
	await drag(
		page,
		Array.from({ length: 41 }, (_, i) => ({
			x: 120 + i * 19.5,
			y: 170 - 70 * Math.sin((i / 40) * 2 * Math.PI) - (i > 30 ? 40 : 0)
		}))
	);
	await expect(stage(page)).toContainText('Your drawing rebuilt from 1 to 5 Hz');
	await expect(option(page, 'shape', 'drawn')).toHaveAttribute('aria-checked', 'true');
	const five = await rebuiltPath(page).getAttribute('d');
	await range(page, 'terms').fill('1');
	await expect(stage(page)).toContainText('Your drawing rebuilt from 1 Hz only');
	expect(await rebuiltPath(page).getAttribute('d')).not.toBe(five);
	// The drawing is still chosen on the turning-circles step.
	await page.goto('./fourier-transform/#circles');
	await expect(stage(page)).toContainText('rebuilding your drawing from 1 Hz to 1 Hz');
});

test('winding: the centre of mass measures a frequency', async ({ page }) => {
	await open(page, './fourier-transform/#wind', 'strength of 1 Hz = 2 × 0.637 = 1.273');
	await range(page, 'windK').fill('3');
	await expect(stage(page)).toContainText('strength of 3 Hz = 2 × 0.212 = 0.424');
	await range(page, 'windK').fill('2');
	await expect(stage(page)).toContainText('strength of 2 Hz = 2 × 0.000 = 0.000');
});

test('epicycles: the circles slider and a drawn loop', async ({ page }) => {
	await open(page, './fourier-transform/#draw-curve', '12 circles drawing the heart');
	await range(page, 'circles').fill('3');
	await expect(stage(page)).toContainText('3 circles drawing the heart');
	// A loop drawn clockwise on screen: its biggest circle turns clockwise.
	await drag(
		page,
		Array.from({ length: 61 }, (_, i) => {
			const a = (i / 60) * 2 * Math.PI;
			return { x: 318 + 170 * Math.cos(a), y: 318 + 120 * Math.sin(a) };
		})
	);
	await expect(stage(page)).toContainText('3 circles drawing your drawing');
	await expect(stage(page)).toContainText('1 turn clockwise per trip');
	await expect(option(page, 'curve', 'drawn')).toHaveAttribute('aria-checked', 'true');
});
