import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const hunt = (page: Page) =>
	page.getByRole('button', { name: 'Hunt / next generation', exact: true });

async function open(page: Page, hash = 'hunt') {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./be-the-bird-camouflage/#${hash}`);
	await expect(stage(page)).toContainText('24 of 24 still alive');
}

test('the reader catches a moth; only the survivors can produce the next generation', async ({
	page
}) => {
	await open(page);
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunting · untimed');
	const moth = stage(page).getByRole('button', { name: 'Catch moth 1', exact: true });
	await moth.focus();
	await moth.press('Enter');
	await expect(moth).toHaveCount(0);
	await expect(stage(page)).toContainText('23 of 24 still alive');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunt over · the survivors can breed');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Generation 2');
	await expect(stage(page)).toContainText('24 of 24 still alive');
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
	await hunt(page).click();
	await expect(stage(page)).toContainText('Generation 1');
	await expect(stage(page)).toContainText('24 of 24 still alive');
});

test('the twelve-second hunt expires on the pausable stage clock', async ({ page }) => {
	await page.clock.install();
	await page.goto('./be-the-bird-camouflage/#hunt');
	await expect(stage(page)).toContainText('24 of 24 still alive');
	await hunt(page).click();
	await expect(stage(page)).toContainText('Hunting');
	await page.clock.runFor(12_500);
	await expect(stage(page)).toContainText('Hunt over · the survivors can breed');
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
	await expect(stage(page)).toContainText('Press the button for their offspring');
});
