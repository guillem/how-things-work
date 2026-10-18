import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const square = (page: Page, row: number, col: number) =>
	page.getByRole('button', { name: new RegExp(`^Square ${row}, ${col}:`) });

// Reduced motion: every scene shows its finished frame, so nothing waits on the animation.
test.use({ reducedMotion: 'reduce' });

test('noughts and crosses: the computer answers a corner with the centre, after a full search', async ({
	page
}) => {
	await page.goto('./game-tree-search/#play');
	await square(page, 1, 1).focus();
	await page.keyboard.press('Enter');
	await expect(square(page, 1, 1)).toHaveAttribute('aria-label', /: X$/);
	// Every other reply loses; the centre is the only draw.
	await expect(square(page, 2, 2)).toHaveAttribute('aria-label', /: O$/);
	await expect(stage(page)).toContainText('Your turn: you play X');
	await expect(stage(page)).toContainText('a full search examines 59,705 positions');
	await expect(page).toHaveURL(/#play$/);
});

test('noughts and crosses: when the computer starts, it searches the whole game tree', async ({
	page
}) => {
	await page.goto('./game-tree-search/#play');
	await page.getByRole('radio', { name: 'The computer (X)' }).click();
	await expect(square(page, 1, 1)).toHaveAttribute('aria-label', /: X$/);
	await expect(stage(page)).toContainText('549,946 positions');
	await expect(stage(page)).toContainText('Your turn: you play O');
});

test('the tree: minimax picks the only move that does not lose', async ({ page }) => {
	await page.goto('./game-tree-search/#minimax');
	await expect(stage(page)).toContainText("The only move that doesn't lose: a draw");
});

test('pruning skips positions of the tree', async ({ page }) => {
	await page.goto('./game-tree-search/#pruning');
	await expect(stage(page)).toContainText('Positions examined: 53 of 53');
	await toggle(page, 'prune').check({ force: true });
	await expect(stage(page)).toContainText('Positions examined: 33 of 53');
});

test('Connect Four puzzle: two moves ahead the computer takes the centre; four ahead it blocks', async ({
	page
}) => {
	await page.goto('./game-tree-search/#depth');
	await expect(stage(page)).toContainText('The computer would play column 6');
	await slider(page, 'depth').fill('2');
	await expect(stage(page)).toContainText('The computer would play column 4');
	// Red answers in column 6: three in a row with both ends open. Now every move loses.
	await page.getByRole('button', { name: 'Column 6', exact: true }).focus();
	await page.keyboard.press('Enter');
	await slider(page, 'depth').fill('4');
	const panel = stage(page);
	await expect(panel).toContainText('loses');
	await expect(panel).not.toContainText('−');
	// Back to the puzzle.
	await page.locator('button[data-control=c4Reset]').click();
	await expect(stage(page)).toContainText('The computer would play column 6');
});

test('Connect Four: pruning cuts the positions examined, and the move stays the same', async ({
	page
}) => {
	await page.goto('./game-tree-search/#c4-pruning');
	await slider(page, 'depth').fill('6');
	await expect(stage(page)).toContainText('Positions examined: 123,449');
	await expect(stage(page)).toContainText('The computer would play column 6');
	await toggle(page, 'prune').check({ force: true });
	await expect(stage(page)).toContainText('Positions examined: 5,867');
	await expect(stage(page)).toContainText('The computer would play column 6');
});

test('Connect Four: the computer replies to the reader’s move', async ({ page }) => {
	await page.goto('./game-tree-search/#connect-four');
	await page.getByRole('button', { name: 'Column 4', exact: true }).click();
	await expect(stage(page)).toContainText('Your turn: you play red');
	await expect(stage(page)).toContainText('Its seven moves, looking 4 moves ahead');
	await expect(stage(page)).toContainText('Positions examined:');
});

test('the growth chart: pruning adds the pruned counts', async ({ page }) => {
	await page.goto('./game-tree-search/#growth');
	await expect(stage(page)).toContainText('6,634,027');
	await expect(stage(page)).not.toContainText('9,793');
	await toggle(page, 'prune').check({ force: true });
	await expect(stage(page)).toContainText('9,793');
});

test('the rule of thumb: the page’s rule wins its match, and a changed rule asks to play again', async ({
	page
}) => {
	await page.goto('./game-tree-search/#rule');
	await slider(page, 'wCentre').fill('3');
	await slider(page, 'wTwo').fill('2');
	await slider(page, 'wThree').fill('5');
	await page.locator('button[data-control=runMatch]').click();
	await expect(stage(page)).toContainText('68 wins · 14 draws · 16 losses');
	await slider(page, 'wThree').fill('4');
	await expect(stage(page)).toContainText('changed: play again');
});
