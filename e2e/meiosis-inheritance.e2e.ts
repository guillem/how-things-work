import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

// Reduced motion shows each step's finished picture, so the counts are final.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('where the chromosomes cross over decides which gametes meiosis makes', async ({ page }) => {
	await open(page, './meiosis-inheritance/#crossover');
	// Move the long pair's crossover beyond the seed-shape gene.
	await page.locator('input[type=range][data-control=xo0]').fill('0.96');
	for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page.locator('aside h2')).toHaveText('Division two: four different cells');
	// R and r no longer split within a cell: the cells come in two identical pairs.
	await expect(stage(page)).toContainText('R y A');
	await expect(stage(page)).toContainText('r Y a');
	await expect(stage(page)).not.toContainText('r y A');
});

test('clicking a pair at the equator turns it round', async ({ page }) => {
	await open(page, './meiosis-inheritance/#lineup');
	const toggle = page.locator('input[type=checkbox][data-control=flip0]');
	await expect(toggle).not.toBeChecked();
	await expect(stage(page)).toContainText('mother’s copy on the left');
	await page.getByRole('button', { name: 'Turn the long pair round' }).click();
	await expect(toggle).toBeChecked();
	await page.getByRole('button', { name: 'Turn the short pair round' }).click();
	// All three pairs now have the father's copy on the left.
	await expect(stage(page)).not.toContainText('mother’s copy on the left');
});

test('a Punnett square of two green plants gives only green seeds', async ({ page }) => {
	await open(page, './meiosis-inheritance/#punnett');
	await expect(stage(page)).toContainText('expected 3 : 1');
	await page.locator('[data-control=mom][data-value=yy]').click();
	await page.locator('[data-control=dad][data-value=yy]').click();
	await expect(stage(page)).toContainText('expected all green');
});

test('breeding thousands of hybrids gives close to 3 : 1', async ({ page }) => {
	await open(page, './meiosis-inheritance/#breed');
	await page.locator('input[type=range][data-control=count]').fill('4000');
	await expect(stage(page)).toContainText('Bred: 4,000 seeds');
	await expect(stage(page)).toContainText(/bred (2\.[89]\d|3\.[01]\d) : 1/);
	await expect(stage(page)).toContainText('Mendel: 6,022 : 2,001');
});

test('linked genes: close ones never separate, distant ones at most half the time', async ({
	page
}) => {
	await open(page, './meiosis-inheritance/#linked');
	const dist = page.locator('input[type=range][data-control=dist]');
	await dist.fill('0');
	await expect(stage(page)).toContainText('0.0% of 2,000');
	await dist.fill('200');
	await expect(stage(page)).toContainText(/(4\d|50)\.\d% of 2,000/);
});

test('two more siblings share a different part of their genome', async ({ page }) => {
	await open(page, './meiosis-inheritance/#siblings');
	const share = stage(page).getByText(/These two share/);
	const first = await share.textContent();
	expect(first).toMatch(/These two share (3\d|4\d|5\d|6\d)\.\d%/);
	await page.locator('[data-control=again]').click();
	await expect(share).not.toHaveText(first ?? '');
});
