import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const handle = (page: Page, name: 'î' | 'ĵ') =>
	page.getByRole('slider', { name: `Where ${name} lands` });

test(
	'moving ĵ with the keyboard changes the matrix and its determinant',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./linear-transformations/#takeaway');
		await expect(stage(page)).toContainText('det = 1.75');
		await handle(page, 'ĵ').focus();
		// Shift + → moves ĵ half a unit right: from (−0.5, 1) to (0, 1).
		await page.keyboard.press('Shift+ArrowRight');
		await expect(handle(page, 'ĵ')).toHaveAttribute('aria-valuetext', 'ĵ lands on (0, 1)');
		// det = 1.5 × 1 − 0 × 0.5
		await expect(stage(page)).toContainText(/det = 1\.5(?![\d])/);
		// The step did not change.
		await expect(page).toHaveURL(/#takeaway$/);
	}
);

test('the matrix sliders follow the arrows, and the arrows follow the sliders', async ({
	page
}) => {
	await page.goto('./linear-transformations/#matrix');
	await expect(stage(page)).toContainText('top: 1.5 × 2 + (−0.5) × 1 = 2.5');
	await handle(page, 'î').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await expect(slider(page, 'a')).toHaveValue('1.6');
	await expect(slider(page, 'c')).toHaveValue('0.4');
	await expect(stage(page)).toContainText('top: 1.6 × 2 + (−0.5) × 1 = 2.7');
	await slider(page, 'd').fill('2');
	await expect(handle(page, 'ĵ')).toHaveAttribute('aria-valuetext', 'ĵ lands on (−0.5, 2)');
	await expect(stage(page)).toContainText('bottom: 0.4 × 2 + 2 × 1 = 2.8');
});

test('dragging î reshapes the unit square, and the area readout follows', async ({ page }) => {
	await page.goto('./linear-transformations/#determinant');
	// The step's example: î on (2, 0), ĵ on (1, 1.5), area 3.
	await expect(stage(page)).toContainText(/unit square: area 1 → 3(?![\d.])/);
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	// The plane: origin at (300, 300), 56 stage units per unit.
	const at = (x: number, y: number) => ({ x: ox + (300 + 56 * x) * k, y: oy + (300 - 56 * y) * k });
	const from = at(2, 0);
	const to = at(1, 1);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await expect(handle(page, 'î')).toHaveAttribute('aria-valuetext', 'î lands on (1, 1)');
	// det = 1 × 1.5 − 1 × 1 = 0.5
	await expect(stage(page)).toContainText(/unit square: area 1 → 0\.5(?!\d)/);
	// Every area shrinks by the same factor: the F's too.
	await expect(stage(page)).toContainText('(× 0.5)');
});

test('with the zero matrix both handles overlap at the origin; the split î handle drags without a jump', async ({
	page
}) => {
	// Reduced motion: the shown matrix snaps to the sliders, no easing.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./linear-transformations/#matrix');
	for (const id of ['a', 'b', 'c', 'd']) await slider(page, id).fill('0');
	await expect(handle(page, 'î')).toHaveAttribute('aria-valuetext', 'î lands on (0, 0)');
	await expect(handle(page, 'ĵ')).toHaveAttribute('aria-valuetext', 'ĵ lands on (0, 0)');
	// The handles are drawn a little apart: î's floats up-left of the origin
	// (300, 300), 56 stage units per unit.
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	const at = (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
	// Grab the floated handle and drag it one unit (56 stage units) right: the
	// tip moves by the drag, from (0, 0) to (1, 0), and doesn't jump to the pointer.
	const from = at(291, 291);
	const to = at(291 + 56, 291);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await expect(handle(page, 'î')).toHaveAttribute('aria-valuetext', 'î lands on (1, 0)');
	// ĵ never moved.
	await expect(handle(page, 'ĵ')).toHaveAttribute('aria-valuetext', 'ĵ lands on (0, 0)');
});

test('a negative determinant flips the plane over', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./linear-transformations/#flip');
	await expect(stage(page)).toContainText('= −2');
	await expect(stage(page)).toContainText('flipped over');
});

test('eigenvectors: two, one or none, depending on the matrix', async ({ page }) => {
	await page.goto('./linear-transformations/#eigenvectors');
	await expect(stage(page)).toContainText('λ = 2.5 along (2, 1)');
	await expect(stage(page)).toContainText('λ = 1 along (1, −1)');
	await page.goto('./linear-transformations/#no-eigen');
	await expect(stage(page)).toContainText('no eigenvectors');
	await page.locator('button[data-control=special][data-value=shear]').click();
	await expect(stage(page)).toContainText('λ = 1 along (1, 0)');
	await expect(stage(page)).toContainText('only one eigen-direction');
	await page.locator('button[data-control=special][data-value=scale]').click();
	await expect(stage(page)).toContainText('every direction: λ = 1.5');
});

test('composing: the order of two transformations matters', async ({ page }) => {
	await page.goto('./linear-transformations/#compose');
	await expect(stage(page)).toContainText('î ends on (1, 1)');
	await page.locator('button[data-control=order][data-value=sr]').click();
	await expect(stage(page)).toContainText('î ends on (0, 1)');
	await expect(stage(page)).toContainText('ĵ ends on (−1, 1)');
});

test('where v lands: a negative step reads as a subtraction', async ({ page }) => {
	await page.goto('./linear-transformations/#follow');
	await slider(page, 'vy').fill('-1');
	await expect(stage(page)).toContainText('= 2·î − 1·ĵ');
	await expect(stage(page)).not.toContainText('+ −');
});

test('repeating the matrix: the verdict names the limit direction as the table does', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./linear-transformations/#repeat');
	// (2, 1) points 26.6° above the x-axis: the angle the last rows of the table approach.
	await expect(stage(page)).toContainText('heading for (2, 1) (26.6°)');
});

test('a right-click on an arrow tip does not leave it held', async ({ page }) => {
	await page.goto('./linear-transformations/#matrix');
	const tip = handle(page, 'î');
	await tip.click({ button: 'right' });
	await page.mouse.move(5, 5);
	// A held tip shows the closed-hand cursor; a released one the open hand.
	await expect(tip).toHaveCSS('cursor', 'grab');
});
