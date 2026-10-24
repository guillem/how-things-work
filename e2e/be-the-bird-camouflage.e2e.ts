import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });
/** The one hunt button; its text says what the next press does. */
const hunt = (page: Page) => page.locator('.action button[data-control=hunt]');

async function open(page: Page, hash = 'hunt') {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./be-the-bird-camouflage/#${hash}`);
	await expect(stage(page)).toContainText('24 of 24 still alive');
}

test('the reader catches a moth; only the survivors can produce the next generation', async ({
	page
}) => {
	await open(page);
	await expect(hunt(page)).toHaveText('Start the hunt');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunting · untimed');
	await expect(hunt(page)).toHaveText('End the hunt now');
	const moth = stage(page).getByRole('button', { name: 'Catch moth 1', exact: true });
	await moth.focus();
	await moth.press('Enter');
	await expect(moth).toHaveCount(0);
	await expect(stage(page)).toContainText('23 of 24 still alive');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunt over · the survivors can breed');
	await expect(hunt(page)).toHaveText('Let the survivors breed');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Generation 2');
	await expect(stage(page)).toContainText('24 of 24 still alive');
});

test('breeding and hunting are separate presses, so the bars can be read first', async ({
	page
}) => {
	await open(page, 'survive');
	await hunt(page).click();
	await hunt(page).click();
	await expect(hunt(page)).toHaveText('Let the survivors breed');
	await hunt(page).click();
	// The new generation waits: no hunt (and no timer) until the reader starts one.
	await expect(stage(page)).toContainText('Generation 2 · Look closely');
	await expect(stage(page)).not.toContainText('Hunting');
	await expect(
		stage(page).getByRole('button', { name: 'Catch moth 1', exact: true })
	).toHaveAttribute('aria-disabled', 'true');
	await expect(hunt(page)).toHaveText('Start the hunt');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Generation 2 · Hunting');
});

test('changing bark changes the background, never an adult moth’s shade', async ({ page }) => {
	await open(page, 'soot');
	const wings = stage(page)
		.getByRole('button', { name: 'Catch moth 1', exact: true })
		.locator('path')
		.first();
	const colour = await wings.getAttribute('fill');
	await page.locator('input[data-control=soot]').check();
	await expect(stage(page)).toContainText('Sooty bark');
	await expect(wings).toHaveAttribute('fill', colour!);
	await page.getByRole('button', { name: 'Next step' }).click();
	await hunt(page).click();
	await expect(stage(page)).toContainText('Sooty bark');
});

test('catching all moths ends this population rather than silently rescuing a parent', async ({
	page
}) => {
	await open(page);
	await hunt(page).click();
	for (let i = 1; i <= 24; i++) {
		const moth = stage(page).getByRole('button', { name: `Catch moth ${i}`, exact: true });
		await moth.focus();
		await moth.press('Space');
	}
	await hunt(page).click();
	await expect(stage(page)).toContainText('No survivors · these moths died out');
	await expect(hunt(page)).toHaveText('Start a new group of moths');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Generation 1');
	await expect(stage(page)).toContainText('24 of 24 still alive');
});

test('the twelve-second hunt expires on the pausable stage clock', async ({ page }) => {
	await page.clock.install();
	await page.goto('./be-the-bird-camouflage/#hunt');
	await expect(stage(page)).toContainText('24 of 24 still alive');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunting · 12 seconds left');
	await playUntil(page, stage(page), 'Hunting · 1 second left', 12_000);
	await playUntil(page, stage(page), 'Hunt over · the survivors can breed', 2_000);
	await expect(
		stage(page).getByRole('button', { name: 'Catch moth 1', exact: true })
	).toHaveAttribute('aria-disabled', 'true');
});

test('hovering over a hidden moth does not reveal it with a different cursor', async ({ page }) => {
	await open(page);
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunting · untimed');
	const mothCursor = await stage(page)
		.getByRole('button', { name: 'Catch moth 1', exact: true })
		.evaluate((moth) => getComputedStyle(moth).cursor);
	const barkCursor = await stage(page)
		.locator('rect')
		.first()
		.evaluate((bark) => getComputedStyle(bark).cursor);
	expect(mothCursor).toBe(barkCursor);
	expect(barkCursor).toBe('crosshair');
});

test('steps without a hunting button give instructions that can actually be followed', async ({
	page
}) => {
	await open(page, 'generations');
	await hunt(page).click();
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#soot$/);
	await expect(stage(page)).toContainText('Each adult keeps its own shade');
	await expect(stage(page)).not.toContainText('Press the button');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#reverse$/);
	await expect(stage(page)).toContainText('Press “Let the survivors breed”');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('a tap just beside a moth still catches it', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./be-the-bird-camouflage/#hunt');
		await expect(readouts(page)).toContainText('24 of 24');
		await hunt(page).click();
		const box = await stage(page)
			.getByRole('button', { name: 'Catch moth 1', exact: true })
			.boundingBox();
		// Beyond the moth's own drawn tap circle, within a fingertip's reach of it.
		await page.touchscreen.tap(box!.x + box!.width + 3, box!.y + box!.height / 2);
		await expect(readouts(page)).toContainText('23 of 24');
	});
});
