import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Plays the animation on Playwright's fake clock until `target` contains
 * `text`, for at most `maxMs` of animation time, then asserts it. Call
 * `page.clock.install()` before `page.goto`. The fake clock drives the
 * animation frames, so how far a scene gets doesn't depend on how busy the
 * machine is, and the test only plays for as long as the scene needs.
 */
export async function playUntil(page: Page, target: Locator, text: string | RegExp, maxMs: number) {
	const found = (s: string | null) =>
		s !== null && (typeof text === 'string' ? s.includes(text) : text.test(s));
	for (let t = 0; t < maxMs && !found(await target.textContent()); t += 1000) {
		await page.clock.runFor(1000);
	}
	await expect(target).toContainText(text);
}
