import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const pages = (page: Page) => page.getByRole('button', { name: /^Page [A-J],/ });
const pageButton = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^Page ${name},`) });
const action = (page: Page, id: string) => page.locator(`.action button[data-control="${id}"]`);

async function open(page: Page, hash: string) {
	await page.goto(`/pagerank/#${hash}`);
	await expect(pages(page).first()).toBeAttached({ timeout: 15_000 });
}

/** Keyboard link: Enter on the source page, then Enter on the target page. */
async function link(page: Page, from: string, to: string) {
	await pageButton(page, from).focus();
	await page.keyboard.press('Enter');
	await pageButton(page, to).focus();
	await page.keyboard.press('Enter');
}

test('"Add a page" adds a page, and "Start again" restores the web', async ({ page }) => {
	await open(page, 'build');
	await expect(pages(page)).toHaveCount(5);
	await action(page, 'addPage').click();
	await expect(pages(page)).toHaveCount(6);
	await expect(pageButton(page, 'F')).toHaveAccessibleName(/links nowhere/);
	await action(page, 'resetWeb').click();
	await expect(pages(page)).toHaveCount(5);
});

test('a link made with the keyboard changes the ranks, and toggles off again', async ({ page }) => {
	await open(page, 'build');
	const before = await pageButton(page, 'B').getAttribute('aria-label');
	await link(page, 'E', 'B');
	await expect(pageButton(page, 'E')).toHaveAccessibleName(/links to A, B$/);
	await expect(pageButton(page, 'B')).not.toHaveAccessibleName(before ?? '');
	await link(page, 'E', 'B');
	await expect(pageButton(page, 'E')).toHaveAccessibleName(/links to A$/);
	// Still on the same step: the keys belonged to the pages.
	await expect(page).toHaveURL(/#build$/);
});

test('boost: links from E change nothing for E, a link from A lifts it six-fold', async ({
	page
}) => {
	await open(page, 'boost');
	await expect(stage(page)).toContainText('E’s rank now 3.0%');
	await link(page, 'E', 'B');
	await link(page, 'E', 'C');
	await expect(pageButton(page, 'E')).toHaveAccessibleName(/links to A, B, C$/);
	await expect(stage(page)).toContainText('E’s rank now 3.0%');
	await expect(stage(page)).toContainText('×1.0');
	await action(page, 'resetWeb').click();
	await link(page, 'A', 'E');
	await expect(stage(page)).toContainText('×6.0');
});

test('boost: a three-page link farm roughly doubles E', async ({ page }) => {
	await open(page, 'boost');
	await action(page, 'addPage').click();
	await action(page, 'addPage').click();
	await action(page, 'addPage').click();
	await expect(pages(page)).toHaveCount(8);
	for (const p of ['F', 'G', 'H']) await link(page, p, 'E');
	await expect(stage(page)).toContainText('×2.2');
});

test('dragging from one page to another adds a link', async ({ page }) => {
	await open(page, 'build');
	const a = await pageButton(page, 'A').locator('circle').last().boundingBox();
	const e = await pageButton(page, 'E').locator('circle').last().boundingBox();
	if (!a || !e) throw new Error('pages not drawn');
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await page.mouse.down();
	await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(pageButton(page, 'A')).toHaveAccessibleName(/links to B, E$/);
});

test('the erase tool removes a page; Delete removes the focused page', async ({ page }) => {
	await open(page, 'build');
	await page.locator('button[data-control="tool"][data-value="erase"]').click();
	await pageButton(page, 'E').click();
	await expect(pages(page)).toHaveCount(4);
	await pageButton(page, 'D').focus();
	await page.keyboard.press('Delete');
	await expect(pages(page)).toHaveCount(3);
	await page.locator('button[data-control="tool"][data-value="link"]').click();
	await action(page, 'resetWeb').click();
	await expect(pages(page)).toHaveCount(5);
});

test('build and boost keep their own webs', async ({ page }) => {
	await open(page, 'build');
	await action(page, 'addPage').click();
	await expect(pages(page)).toHaveCount(6);
	await page.goto('/pagerank/#boost');
	await expect(pages(page)).toHaveCount(5);
	await expect(stage(page)).toContainText('×1.0');
});

test('boost: removing an earlier page keeps E as the target; removing E hides the readout', async ({
	page
}) => {
	await open(page, 'boost');
	await pageButton(page, 'D').focus();
	await page.keyboard.press('Delete');
	// E is now called D, and is still the page to boost.
	await expect(stage(page)).toContainText('D’s rank now');
	await pageButton(page, 'D').focus();
	await page.keyboard.press('Delete');
	await expect(stage(page)).toContainText('The page to boost is gone.');
	await action(page, 'resetWeb').click();
	await expect(stage(page)).toContainText('E’s rank now 3.0%');
});

test('the move tool: arrow keys move the focused page and stay on the step', async ({ page }) => {
	await open(page, 'build');
	await page.locator('button[data-control="tool"][data-value="move"]').click();
	const circle = pageButton(page, 'A').locator('circle').last();
	const x0 = Number(await circle.getAttribute('cx'));
	await pageButton(page, 'A').focus();
	await page.keyboard.press('ArrowRight');
	await expect(circle).toHaveAttribute('cx', String(x0 + 10));
	await expect(page).toHaveURL(/#build$/);
	// Dragging far to the right stays inside the web area, clear of the panel.
	const box = await circle.boundingBox();
	if (!box) throw new Error('page not drawn');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 2000, box.y, { steps: 6 });
	await page.mouse.up();
	expect(Number(await circle.getAttribute('cx'))).toBeLessThanOrEqual(610);
});
