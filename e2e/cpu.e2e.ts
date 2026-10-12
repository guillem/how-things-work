import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const scrubber = (page: Page) => page.getByRole('slider', { name: 'Program position' });
const editor = (page: Page) => page.getByRole('textbox', { name: 'Assembly program' });

test('the sum of 1 to 10 runs at speed and halts with 55 in memory', async ({ page }) => {
	await page.clock.install();
	await page.goto('./cpu/#sum');
	await expect(scrubber(page)).toBeAttached();
	await page.locator('input[type=range][data-control=pace]').fill('60');
	await playUntil(page, stage(page), 'Halted after 44 instructions, 132 ticks', 10_000);
	await expect(stage(page)).toContainText('55');
});

test('Step does one phase at a time: fetch, then decode, then execute', async ({ page }) => {
	await page.goto('./cpu/#cycle');
	await expect(scrubber(page)).toBeAttached();
	await page.locator('input[type=checkbox][data-control=play]').uncheck({ force: true });
	await scrubber(page).focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('Ready: the PC is 0');
	const step = page.locator('button[data-control=tick]');
	await step.click();
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '1');
	await expect(stage(page)).toContainText('Fetch: the PC sends address 0 to memory');
	await step.click();
	await expect(stage(page)).toContainText('Decode: opcode 0001 is LDI: put the number 7 into R0');
	await step.click();
	await expect(stage(page)).toContainText('Execute: 7 goes into R0');
	await step.click();
	await expect(stage(page)).toContainText('Fetch: the PC sends address 2 to memory');
	// The keys belong to the scrubber: the step does not change.
	await scrubber(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Halted after 5 instructions');
	await expect(page).toHaveURL(/#cycle$/);
});

test('the conditional jump follows the data', async ({ page }) => {
	await page.goto('./cpu/#branch');
	await expect(scrubber(page)).toBeAttached();
	await page.locator('input[type=range][data-control=a]').fill('200');
	await page.locator('input[type=range][data-control=b]').fill('7');
	await scrubber(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Halted after 7 instructions');
	await page.locator('input[type=range][data-control=a]').fill('3');
	await scrubber(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Halted after 6 instructions');
});

test('typing in the editor never triggers the explainer shortcuts', async ({ page }) => {
	await page.goto('./cpu/#editor');
	const title = await page.locator('aside h2').textContent();
	await editor(page).click();
	await page.keyboard.type('\n; r f a ? j k');
	for (const key of ['Space', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageDown'])
		await page.keyboard.press(key);
	await expect(page).toHaveURL(/#editor$/);
	await expect(page.locator('aside h2')).toHaveText(title ?? '');
	await expect(editor(page)).toHaveValue(/; r f a \? j k/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	// The caret stays where the reader types: the text is not re-rendered under it.
	await editor(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
	await page.keyboard.type('AB');
	await expect(editor(page)).toHaveValue(/^AB/);
});

test('a mistake in the editor shows an error with its line, and fixing it runs again', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('./cpu/#editor');
	await editor(page).fill('LDI R0, 7\nADDD R0, R0\nHALT');
	await expect(stage(page)).toContainText('Line 2: Unknown instruction "ADDD"');
	await expect(stage(page)).toContainText('Fix the program to run it');
	await editor(page).fill('LDI R0, 7\nADD R0, R0\nSTORE R0, [9]\nHALT');
	await expect(stage(page)).toContainText('Assembled: 8 of 32 bytes');
	await scrubber(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Halted after 4 instructions');
	expect(errors).toEqual([]);
});

test('an endless loop is stopped instead of hanging the page', async ({ page }) => {
	await page.goto('./cpu/#editor');
	await editor(page).fill('loop: JMP loop');
	await scrubber(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Stopped after 1,000 instructions');
});

test('loading an example replaces the program', async ({ page }) => {
	await page.goto('./cpu/#editor');
	await page.locator('button[data-control=example][data-value=countdown]').click();
	await expect(editor(page)).toHaveValue(/Count down from 5 to 0/);
	// The text survives a trip to another step and back.
	await editor(page).fill('HALT');
	await page.getByRole('button', { name: 'Previous step' }).click();
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(editor(page)).toHaveValue('HALT');
});
