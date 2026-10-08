import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the Galton board counts the paths into the end and middle bins', async ({ page }) => {
	await page.goto('/central-limit-theorem/#why');
	await expect(stage(page)).toContainText('924 paths');
	await expect(stage(page)).toContainText('1 path out of 4,096');
	await page.locator('input[type=range][data-control=rows]').fill('16');
	await expect(stage(page)).toContainText('12,870 paths');
});

test('drawing the starting shape and averaging bigger samples', async ({ page }) => {
	await page.goto('/central-limit-theorem/#clt');
	await expect(stage(page)).toContainText('Two humps');
	await page.locator('input[type=range][data-control=sampleSize]').fill('30');
	await expect(stage(page)).toContainText('√30');

	// Dragging over the top chart reshapes it: tall bars on the left move the mean down.
	const chart = stage(page).locator('[role=slider]');
	await chart.scrollIntoViewIfNeeded();
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
