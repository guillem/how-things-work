import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const scrubber = (page: Page, name = 'Machine position') => page.getByRole('slider', { name });
const editor = (page: Page) => page.getByRole('textbox', { name: 'Rule table' });
const tape = (page: Page) => page.getByRole('textbox', { name: 'Starting tape' });

async function toEnd(page: Page, name?: string) {
	await scrubber(page, name).focus();
	await page.keyboard.press('End');
}

test(
	'the add-one machine runs at speed and halts with 1011 + 1 = 1100',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.clock.install();
		await page.goto('./turing-machines/#increment');
		await expect(scrubber(page)).toBeAttached();
		await page.locator('input[type=range][data-control=pace]').fill('30');
		await playUntil(page, stage(page), 'Halted in done after 8 steps: 1011 + 1 = 1100', 10_000);
	}
);

test('a carry off the left end grows the number', async ({ page }) => {
	await page.goto('./turing-machines/#increment');
	await page.locator('button[data-control=incInput][data-value="1111"]').click();
	await toEnd(page);
	await expect(stage(page)).toContainText('1111 + 1 = 10000');
});

test('Step applies one rule at a time, lighting it in the table', async ({ page }) => {
	await page.goto('./turing-machines/#increment');
	await expect(scrubber(page)).toBeAttached();
	await page.locator('input[type=checkbox][data-control=play]').uncheck({ force: true });
	await scrubber(page).focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('After 0 steps: in right, reading 1');
	await page.getByRole('button', { name: 'Step once' }).click();
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '1');
	await expect(stage(page)).toContainText('After 1 step: in right, reading 0');
	await expect(page).toHaveURL(/#increment$/);
});

test('the palindrome checker says yes and no', async ({ page }) => {
	await page.goto('./turing-machines/#palindrome');
	await toEnd(page);
	await expect(stage(page)).toContainText('Halted in yes after 15 steps: 0110 is a palindrome');
	await page.locator('button[data-control=palInput][data-value="10011"]').click();
	await toEnd(page);
	await expect(stage(page)).toContainText('10011 is not a palindrome');
});

test('the reader’s table runs: subtract one, errors by line, and the step limit', async ({
	page
}) => {
	await page.goto('./turing-machines/#program');
	await editor(page).fill(
		'# subtract one\nright 0 -> 0 R right\nright 1 -> 1 R right\nright _ -> _ L borrow\nborrow 0 -> 1 L borrow\nborrow 1 -> 0 L done'
	);
	await tape(page).fill('1100');
	await toEnd(page);
	await expect(stage(page)).toContainText('Halted in done after 8 steps');
	await expect(stage(page)).toContainText('Tape: 1011');
	await editor(page).fill('a 0 -> 1 X b');
	await expect(stage(page)).toContainText('Line 1: move “X” must be L or R');
	await editor(page).fill('a _ -> _ R a');
	await tape(page).fill('');
	await toEnd(page);
	await expect(stage(page)).toContainText('Stopped by this page after 500 steps');
});

test('typing in the editor never triggers the explainer shortcuts', async ({ page }) => {
	await page.goto('./turing-machines/#program');
	await editor(page).click();
	const title = await page.locator('aside h2').textContent();
	await page.keyboard.type('\n# r f a ? j k');
	for (const key of ['Space', 'ArrowRight', 'ArrowLeft', 'Home', 'End'])
		await page.keyboard.press(key);
	await expect(page).toHaveURL(/#program$/);
	await expect(page.locator('aside h2')).toHaveText(title ?? '');
	await expect(editor(page)).toHaveValue(/# r f a \? j k/);
});

test('loading an example replaces the table and the tape', async ({ page }) => {
	await page.goto('./turing-machines/#program');
	await page.locator('button[data-control=example][data-value=beaver]').click();
	await expect(editor(page)).toHaveValue(/two-state busy beaver/);
	await expect(tape(page)).toHaveValue('');
	await toEnd(page);
	await expect(stage(page)).toContainText('Halted in H after 6 steps');
	await expect(stage(page)).toContainText('Tape: 1111');
});

test('the diagonal argument moves step by step to the contradiction', async ({ page }) => {
	await page.goto('./turing-machines/#diagonal');
	const slider = page.locator('input[type=range][data-control=argument]');
	await slider.fill('3');
	await expect(stage(page)).toContainText('if H(M, M) = halts: loop forever');
	await slider.fill('5');
	await expect(stage(page)).toContainText('So no such H exists.');
});

test('the busy beavers halt after 6 and 107 steps', async ({ page }) => {
	await page.goto('./turing-machines/#beaver');
	await page.locator('button[data-control=beaver][data-value="4"]').click();
	await toEnd(page, 'Busy beaver position');
	await expect(stage(page)).toContainText('Halted after 107 steps with 13 ones: S(4) = 107');
	await page.locator('button[data-control=beaver][data-value="2"]').click();
	await toEnd(page, 'Busy beaver position');
	await expect(stage(page)).toContainText('Halted after 6 steps with 4 ones: S(2) = 6');
});

test('reduced motion shows the five-state run as far as it is drawn', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./turing-machines/#bb5');
	await expect(stage(page)).toContainText('Step 10,000 of 47,176,870');
	await expect(stage(page)).toContainText('47,176,870');
});

test('brute force tries all (n − 1)!/2 tours and keeps the shortest', async ({ page }) => {
	await page.goto('./turing-machines/#tsp');
	await page.locator('input[type=range][data-control=cities]').fill('5');
	await toEnd(page, 'Tours tried');
	await expect(stage(page)).toContainText('All 12 tours tried: the green one is the shortest');
	await page.locator('input[type=range][data-control=cities]').fill('9');
	await expect(stage(page)).toContainText('20,160');
});

test('the growth chart reads off brute-force and Held–Karp times', async ({ page }) => {
	await page.goto('./turing-machines/#explosion');
	await expect(stage(page)).toContainText('1.9 years');
	await page.locator('input[type=range][data-control=growthN]').fill('25');
	await expect(stage(page)).toContainText('9.8 million years');
	await expect(stage(page)).toContainText('21 seconds');
});
