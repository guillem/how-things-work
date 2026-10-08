import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string, text: string) {
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('compare: choosing a design shows it and its readout', async ({ page }) => {
	await open(page, '/bridges-structures/#compare', 'Beam bridge');
	await expect(stage(page)).toContainText('Busiest member over a crossing');
	await page.locator('button[data-control=design][data-value=truss]').click();
	await expect(stage(page)).toContainText('Truss bridge');
	await expect(stage(page)).toContainText('29 members');
	await expect(stage(page)).not.toContainText('Beam bridge');
	// The chart's bars choose a design too.
	await page.getByRole('button', { name: /Show the suspension bridge/ }).click();
	await expect(stage(page)).toContainText('Suspension bridge');
	await expect(page.locator('button[data-control=design][data-value=suspension]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('build: the keyboard adds a pier and the readout follows', async ({ page }) => {
	await open(page, '/bridges-structures/#build', 'shared by 8 members');
	await page.getByRole('button', { name: 'Joint at 20 m, 0 m', exact: true }).focus();
	await page.keyboard.press('Enter');
	for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('shared by 9 members');
	// The keys belonged to the scene: still on the same step.
	await expect(page).toHaveURL(/#build$/);
	// The pier's foot is a new joint on the floor of the gap.
	await expect(
		page.getByRole('button', { name: 'Joint at 20 m, −12.5 m', exact: true })
	).toBeAttached();
});

test('build: Delete erases a member, and Start again restores the road', async ({ page }) => {
	await open(page, '/bridges-structures/#build', 'shared by 8 members');
	await page.locator('button[data-control=tool][data-value=erase]').click();
	await page
		.getByRole('button', { name: /^Beam,/ })
		.first()
		.focus();
	await page.keyboard.press('Delete');
	await expect(stage(page)).toContainText('shared by 7 members');
	// A road cut in two cannot stand on its own.
	await expect(stage(page)).toContainText("can't hold itself up");
	await page.locator('.action button[data-control=resetBridge]').click();
	await expect(stage(page)).toContainText('shared by 8 members');
	await expect(stage(page)).not.toContainText("can't hold itself up");
});
