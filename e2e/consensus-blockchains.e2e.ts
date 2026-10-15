import { expect, test, type Page } from '@playwright/test';

// Reduced motion shows each scene's finished frame (a moment of the run for the cluster).
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('three generals fail with one traitor; four succeed', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./consensus-blockchains/#generals');
	// The one loyal lieutenant follows the liar (the verdict was reworded to name him).
	await expect(stage(page)).toContainText('L1 disobeys his loyal commander');
	await expect(stage(page)).toContainText('L1 hears the same whether C or L2 is the liar');
	await slider(page, 'n').fill('4');
	await expect(stage(page)).toContainText('All loyal generals agree and obey');
	// Two traitors among four: the rule 3f + 1 = 7 is broken again.
	await slider(page, 'traitors').fill('2');
	await expect(stage(page)).toContainText(
		'2 traitors need at least 3 × 2 + 1 = 7 generals; here 4'
	);
});

test('a lying commander alone fails against three generals, by luck', async ({ page }) => {
	await page.goto('./consensus-blockchains/#generals');
	await page.locator('button[data-control=role][data-value=commander]').click();
	await expect(stage(page)).toContainText('The loyal lieutenants agree');
	await expect(stage(page)).toContainText('This lie happened to fail, but another could succeed');
});

test('two crashed servers of five still commit; three stall the cluster', async ({ page }) => {
	await page.goto('./consensus-blockchains/#replication');
	await expect(stage(page)).toContainText('3 of 5 servers up: a majority, so entries can commit');
	await slider(page, 'down').fill('3');
	await expect(stage(page)).toContainText('2 of 5 servers up: no majority, nothing can commit');
	await expect(stage(page)).toContainText('Leader S');
});

test('a cut network elects a second leader on its majority side', async ({ page }) => {
	await page.goto('./consensus-blockchains/#partition');
	await expect(stage(page)).toContainText(
		'Cut: 3 servers on one side (a majority), 2 on the other'
	);
	await expect(stage(page).getByText('leader', { exact: true })).toHaveCount(2);
});

test('editing an old block breaks every later one, and typing never changes the step', async ({
	page
}) => {
	await page.goto('./consensus-blockchains/#hash-chain');
	await expect(stage(page)).toContainText('All 4 blocks valid');
	const box = page.getByRole('textbox', { name: 'Data of block 1' });
	await box.fill('');
	await box.pressSequentially('Ana pays Ben 500 jk ');
	await expect(page).toHaveURL(/#hash-chain$/);
	await expect(stage(page)).toContainText('Block 1 edited: blocks 2 and 3 no longer valid');
	await expect(stage(page).getByText('broken link')).toHaveCount(1);
	await page.getByRole('button', { name: 'Recompute the later blocks' }).click();
	await expect(stage(page)).toContainText('Recomputed 3 hashes: the chain looks valid again');
	// Edit again: the cover-up was for the old text.
	await box.fill('Ana pays Ben 50');
	await expect(stage(page)).toContainText('no longer valid');
});

test('with proof-of-work, covering up an edit means re-mining every later block', async ({
	page
}) => {
	await page.goto('./consensus-blockchains/#rework');
	await page.getByRole('textbox', { name: 'Data of block 1' }).fill('Ana pays Ben 500');
	await expect(stage(page)).toContainText('Block 1 edited: blocks 1, 2 and 3 no longer valid');
	await expect(stage(page)).toContainText('not enough zeros');
	await page.getByRole('button', { name: 'Re-mine the later blocks' }).click();
	await expect(stage(page)).toContainText(/Re-mined 3 blocks: [\d,]+ tries/);
	await expect(stage(page).getByText('valid', { exact: true })).toHaveCount(4);
});

test('mining finds a hash with the required zero bits', async ({ page }) => {
	await page.goto('./consensus-blockchains/#mining');
	await expect(stage(page)).toContainText('found');
	await expect(stage(page)).toContainText('12 zero bits: enough!');
	await slider(page, 'bits').fill('4');
	await expect(stage(page)).toContainText('2^4 = 16');
	await expect(stage(page)).toContainText(/\d+ zero bits?: enough!/);
});

test('the retarget absorbs an eightfold jump in two periods', async ({ page }) => {
	await page.goto('./consensus-blockchains/#retarget');
	await expect(stage(page)).toContainText('One period later the difficulty has followed');
	await page.locator('button[data-control=jump][data-value="8"]').click();
	await expect(stage(page)).toContainText('it takes two periods to reach × 8');
});

test('no delay, no orphans', async ({ page }) => {
	await page.goto('./consensus-blockchains/#forks');
	await slider(page, 'delay').fill('0');
	await expect(stage(page)).toContainText(
		'Orphaned so far: 0 · over 4,000 simulated blocks at this delay: 0.0 %'
	);
});

test('the double-spend odds follow Nakamoto’s table; the threshold follows the exact race', async ({
	page
}) => {
	await page.goto('./consensus-blockchains/#double-spend');
	await slider(page, 'q').fill('10');
	await slider(page, 'z').fill('5');
	// Nakamoto 2008, §11: q = 0.1, z = 5 gives P = 0.0009137.
	await expect(stage(page)).toContainText('At z = 5: 0.091 %');
	// The threshold follows the exact race, which needs one block more than Nakamoto's 5.
	await expect(stage(page)).toContainText('Risk below 0.1 % after 6 blocks (exact).');
	await slider(page, 'q').fill('30');
	await expect(stage(page)).toContainText('Risk below 0.1 % after 32 blocks (exact).');
	await slider(page, 'q').fill('45');
	await expect(stage(page)).toContainText(/Risk below 0\.1 % after \d+ blocks \(exact\)\./);
	await slider(page, 'q').fill('50');
	await expect(stage(page)).toContainText('With half the power or more, he always catches up.');
});
