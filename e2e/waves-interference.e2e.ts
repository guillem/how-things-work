import { expect, test, type Locator, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** A text of the stage that reads exactly `text`. */
const reading = (page: Page, text: string) =>
	stage(page)
		.locator('text')
		.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

/** Scene coordinates (960 × 600, letterboxed) → screen. */
async function scene(page: Page) {
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	return (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
}

test('more half-wavelengths between the sources give more calm lines', async ({ page }) => {
	await page.goto('./waves-interference/#ripple-tank');
	// 6 cm apart, 2 cm wavelength: 3 wavelengths, 6 calm lines.
	await expect(stage(page)).toContainText('= 3.00 wavelengths apart');
	await expect(reading(page, '6')).toBeVisible();
	await slider(page, 'spacing').fill('12');
	await slider(page, 'lambda').fill('1');
	await expect(stage(page)).toContainText('= 12.00 wavelengths apart');
	await expect(reading(page, '24')).toBeVisible();
	// Closer than half a wavelength: no calm line at all.
	await slider(page, 'spacing').fill('1');
	await slider(page, 'lambda').fill('4');
	await expect(reading(page, '0')).toBeVisible();
});

test('a source can be dragged with the keyboard, and the spacing slider follows', async ({
	page
}) => {
	await page.goto('./waves-interference/#ripple-tank');
	const source = page.getByRole('slider', { name: 'Source 1 (drag it anywhere in the tank)' });
	await source.focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page, 'spacing')).toHaveValue('6.5');
	await page.keyboard.press('End');
	await expect(slider(page, 'spacing')).toHaveValue('12');
	await expect(stage(page)).toContainText('12.0 cm');
});

test('a source can be dragged anywhere in the tank, the spacing following', async ({ page }) => {
	await page.goto('./waves-interference/#ripple-tank');
	const source = page.getByRole('slider', { name: 'Source 2 (drag it anywhere in the tank)' });
	const at = await scene(page);
	// Drag source 2 up and to the right (source 1 stays put): the pair is no
	// longer vertical, and the spacing reads their true distance — source 1 is
	// at (100, 240), so (325, 200) is 11.4 cm from it.
	const box = (await source.boundingBox())!;
	const to = at(325, 200);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await expect(stage(page)).toContainText('11.4 cm');
	await expect(slider(page, 'spacing')).toHaveValue('11.5');
});

test('the moving source is a handle: its speed follows the drag', async ({ page }) => {
	await page.goto('./waves-interference/#doppler');
	const src = page.getByRole('slider', { name: /The source \(drag it/ });
	await expect(stage(page)).toContainText('Heard ahead');
	// A quick rightward drag is far faster than the control's 240 m/s: the
	// release clamps there.
	const at = await scene(page);
	const box = (await src.boundingBox())!;
	const to = at(700, 360);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 6 });
	await page.mouse.up();
	await expect(slider(page, 'speed')).toHaveValue('240');
	// Home stops the source; an arrow key steps its speed.
	await src.focus();
	await page.keyboard.press('Home');
	await expect(slider(page, 'speed')).toHaveValue('0');
	await page.keyboard.press('ArrowRight');
	await expect(slider(page, 'speed')).toHaveValue('5');
});

test('the probe reads cancellation on a calm line and reinforcement on the centre line', async ({
	page
}) => {
	await page.goto('./waves-interference/#path-difference');
	const probe = page.getByRole('slider', { name: 'Probe' });
	await expect(probe).toBeAttached();
	// It starts on the first calm line: half a wavelength of path difference.
	await expect(stage(page)).toContainText('0.50 λ');
	await expect(stage(page)).toContainText('crest meets trough');
	// Drag it onto the line straight ahead, level with the midpoint of the sources (y = 300).
	const at = await scene(page);
	const box = (await probe.boundingBox())!;
	const to = at(480, 300);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await expect(stage(page)).toContainText('0.00 λ');
	await expect(stage(page)).toContainText('crest meets crest');
});

test('the n-th harmonic of the A string is n × 110 Hz', async ({ page }) => {
	await page.goto('./waves-interference/#harmonics');
	await expect(stage(page)).toContainText('330 Hz');
	await slider(page, 'harmonic').fill('5');
	await expect(stage(page)).toContainText('550 Hz');
	await expect(stage(page)).toContainText('26.0 cm'); // λ = 2 × 65 cm ÷ 5
	await expect(page.getByRole('button', { name: '▶ Hear this note' })).toBeVisible();
});

test('a string plucked in the middle has no even harmonics', async ({ page }) => {
	await page.goto('./waves-interference/#pluck');
	await expect(stage(page)).toContainText('5th, 10th'); // plucked at 20%
	await slider(page, 'pluckAt').fill('50');
	await expect(stage(page)).toContainText('2nd, 4th, 6th, 8th, 10th, 12th');
});

test('a source moving at 30 m/s is heard higher ahead and lower behind', async ({ page }) => {
	await page.goto('./waves-interference/#doppler');
	await expect(stage(page)).toContainText('482 Hz');
	await expect(stage(page)).toContainText('405 Hz');
	await slider(page, 'speed').fill('0');
	await expect(stage(page)).not.toContainText('482 Hz');
	await expect(stage(page)).not.toContainText('405 Hz');
	await expect(stage(page)).toContainText('no shift when still');
});

/** Where a handle's centre is, in scene coordinates. */
async function sceneCentre(handle: Locator) {
	// Both boxes in one go: measured separately, a scroll in between skews them.
	return handle.evaluate((h) => {
		const box = h.closest('svg')!.getBoundingClientRect();
		const r = h.getBoundingClientRect();
		const k = Math.min(box.width / 960, box.height / 600);
		const ox = box.x + (box.width - 960 * k) / 2;
		const oy = box.y + (box.height - 600 * k) / 2;
		return { x: (r.x + r.width / 2 - ox) / k, y: (r.y + r.height / 2 - oy) / k };
	});
}

async function drag(page: Page, handle: Locator, x: number, y: number) {
	const at = await scene(page);
	const box = (await handle.boundingBox())!;
	const to = at(x, y);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
}

test('widening the spacing keeps both sources in the tank', async ({ page }) => {
	await page.goto('./waves-interference/#ripple-tank');
	const one = page.getByRole('slider', { name: 'Source 1 (drag it anywhere in the tank)' });
	const two = page.getByRole('slider', { name: 'Source 2 (drag it anywhere in the tank)' });
	// Both sources into the top-left corner, close together…
	await drag(page, two, 30, 30);
	await drag(page, one, 40, 60);
	await expect(slider(page, 'spacing')).toHaveValue('1.5');
	// …then the widest spacing: there is no room for it about their midpoint.
	await slider(page, 'spacing').fill('12');
	await expect(stage(page)).toContainText('12.0 cm');
	for (const s of [one, two]) {
		const c = await sceneCentre(s);
		// the tank spans x 16…656, y 16…584
		expect(c.x).toBeGreaterThanOrEqual(16);
		expect(c.x).toBeLessThanOrEqual(656);
		expect(c.y).toBeGreaterThanOrEqual(16);
		expect(c.y).toBeLessThanOrEqual(584);
	}
});

test('a released source carries on from where it was let go, at the speed of the hand', async ({
	page
}) => {
	await page.clock.install({ time: 0 });
	await page.goto('./waves-interference/#doppler');
	const src = page.getByRole('slider', { name: /The source \(drag it/ });
	await expect(stage(page)).toContainText('Heard ahead');
	await page.clock.pauseAt(20_000); // time moves only when the test says so
	const at = await scene(page);
	const from = await sceneCentre(src);
	// Carry it to x = 700, then move it 5 px every quarter second: 20 px/s on
	// the stage, where sound's 343 m/s is drawn at 110 px/s — about 60 m/s.
	let x = 700;
	const a = at(from.x, from.y);
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	const b = at(x, from.y);
	await page.mouse.move(b.x, b.y, { steps: 4 });
	for (let i = 0; i < 4; i++) {
		await page.clock.runFor(250);
		x += 5;
		const p = at(x, from.y);
		await page.mouse.move(p.x, p.y);
	}
	await page.mouse.up();
	await expect(slider(page, 'speed')).toHaveValue('60');
	// It is where the hand let it go, not back in the middle of the stage…
	expect(Math.abs((await sceneCentre(src)).x - x)).toBeLessThan(3);
	// …and goes on from there: 60 m/s is 19 px of stage a second.
	await page.clock.runFor(1000);
	expect(Math.abs((await sceneCentre(src)).x - (x + 19.2))).toBeLessThan(3);
});

test('a tap on the source leaves its speed alone', async ({ page }) => {
	await page.clock.install({ time: 0 });
	await page.goto('./waves-interference/#doppler');
	const src = page.getByRole('slider', { name: /The source \(drag it/ });
	await expect(src).toBeAttached();
	await page.clock.pauseAt(20_000); // a still source, to click on
	await expect(slider(page, 'speed')).toHaveValue('30');
	await src.click();
	await expect(src).toHaveAttribute('aria-valuetext', 'moving at 30 m/s');
	await expect(slider(page, 'speed')).toHaveValue('30');
});

test('a right-click on the source does not leave it held', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./waves-interference/#doppler');
	const src = page.getByRole('slider', { name: /The source \(drag it/ });
	// The brackets of squeezed and stretched crests show while the source moves
	// on its own, and hide while it is held.
	await expect(reading(page, 'squeezed')).toBeVisible();
	await src.click({ button: 'right' });
	await expect(reading(page, 'squeezed')).toBeVisible();
});

test('at the end of a crossing the source fades out before it starts again', async ({ page }) => {
	await page.clock.install({ time: 0 });
	await page.goto('./waves-interference/#doppler');
	await slider(page, 'speed').fill('240'); // a crossing of about 9 s
	await page.clock.pauseAt(20_000); // time moves only when the test says so
	const src = page.getByRole('slider', { name: /The source \(drag it/ });
	/** The source's x on the stage, and how opaque it is drawn. */
	const look = () =>
		src.evaluate((el) => {
			let o = 1;
			for (let n: Element | null = el; n && n.tagName !== 'svg'; n = n.parentElement)
				o *= Number(n.getAttribute('opacity') ?? 1) * Number(getComputedStyle(n).opacity);
			const box = el.getBoundingClientRect();
			return { x: box.x + box.width / 2, o };
		});
	let prev = await look();
	let jumps = 0;
	for (let i = 0; i < 120; i++) {
		await page.clock.runFor(100);
		const now = await look();
		if (now.x < prev.x - 100) {
			jumps++;
			expect(prev.o).toBeLessThan(0.5);
			expect(now.o).toBeLessThan(0.5);
		}
		prev = now;
	}
	expect(jumps).toBeGreaterThan(0);
});
