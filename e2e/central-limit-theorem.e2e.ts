import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

test('the Galton board counts the paths into the end and middle bins', async ({ page }) => {
	await page.goto('./central-limit-theorem/#why');
	await expect(stage(page)).toContainText('924 paths');
	await expect(stage(page)).toContainText('1 path out of 4,096');
	await page.locator('input[type=range][data-control=rows]').fill('16');
	await expect(stage(page)).toContainText('12,870 paths');
});

test('on a small board, landed balls stay where they fell as the bins fill', async ({ page }) => {
	await page.clock.install();
	await page.goto('./central-limit-theorem/#board');
	await page.locator('input[type=range][data-control=rows]').fill('4');
	const landed = () =>
		stage(page)
			.locator('circle[fill="var(--clt-bin)"]')
			.evaluateAll((cs) => cs.map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`));
	await page.clock.runFor(3000);
	const before = await landed();
	expect(before.length).toBeGreaterThan(5);
	await page.clock.runFor(3000);
	const after = new Set(await landed());
	for (const p of before) expect(after.has(p), `ball at ${p}`).toBe(true);
});

test('at the slowest pace every sample can be followed: one every four seconds', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./central-limit-theorem/#samples');
	await page.locator('input[type=range][data-control=samplePace]').fill('0.25');
	await page.clock.runFor(8500);
	// samples 0, 4 s and 8 s
	await expect(stage(page).locator('text', { hasText: /^3$/ })).toHaveCount(1);
});

test('drawing the starting shape and averaging bigger samples', async ({ page }) => {
	await page.goto('./central-limit-theorem/#clt');
	await expect(stage(page)).toContainText('Two humps');
	// The clt step's sample-size control starts at n = 30 (n = 1 shows no bell).
	await expect(stage(page)).toContainText('√30');
	await page.locator('input[type=range][data-control="sampleSize:clt"]').fill('10');
	await expect(stage(page)).toContainText('√10');

	// Dragging over the top chart reshapes it: tall bars on the left move the mean down.
	const chart = stage(page).locator('[role=slider]');
	await chart.scrollIntoViewIfNeeded();
	// The page may still be smooth-scrolling to the step: measure once it holds still.
	await page.waitForFunction(
		() =>
			new Promise((done) => {
				const y = scrollY;
				requestAnimationFrame(() => requestAnimationFrame(() => done(scrollY === y)));
			})
	);
	const box = (await chart.boundingBox())!;
	await page.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.2, { steps: 8 });
	await page.mouse.up();
	await expect(stage(page)).toContainText('Your own');
	await expect(stage(page)).toContainText(/mean 0\.[0-4]\d/);

	// Keyboard: focus the chart, pick a bar and raise it, without leaving the step.
	await chart.focus();
	await page.keyboard.press('ArrowRight');
	const before = Number(await chart.getAttribute('aria-valuenow'));
	await page.keyboard.press('ArrowUp');
	await expect(chart).toHaveAttribute('aria-valuenow', String(before + 5));
	await expect(page).toHaveURL(/#clt$/);
});

test('lowering every bar leaves one value with no spread, its averages in one tall bar', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); // every sample already taken
	await page.goto('./central-limit-theorem/#clt');
	const chart = stage(page).locator('[role=slider]');
	await chart.focus();
	await page.keyboard.press('Home');
	for (let i = 0; i < 20; i++) {
		for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowDown');
		if (i < 19) await page.keyboard.press('ArrowRight');
	}
	// An empty chart can't be drawn from: the last bar keeps a little height.
	await expect(chart).toHaveAttribute('aria-valuenow', '5');
	await expect(stage(page)).toContainText('spread σ = 0.00');
	await expect(stage(page)).toContainText('every value the same: no spread');
	// Every average is the same value, so one bar holds them all and stands tall.
	const tall = await stage(page)
		.locator('rect[fill="var(--clt-means)"]')
		.evaluateAll((rs) => Math.max(...rs.map((r) => r.getBoundingClientRect().height)));
	const box = (await stage(page).boundingBox())!;
	expect(tall).toBeGreaterThan(box.height * 0.2);
});
