import { expect, type Locator, type Page } from '@playwright/test';

/** Freeze animation time before navigation so host load cannot advance the scene. */
export async function installPausedClock(page: Page) {
	await page.clock.install({ time: new Date(0) });
	await page.clock.pauseAt(new Date(1000));
}

/**
 * Plays the animation on Playwright's fake clock until `target` contains
 * `text`, for at most `maxMs` of animation time, then asserts it. Call
 * `installPausedClock(page)` before `page.goto` for deterministic timing.
 * Use a smaller `stepMs` when a state lasts less than one second. The fake clock drives the
 * animation frames, so how far a scene gets doesn't depend on how busy the
 * machine is, and the test only plays for as long as the scene needs.
 */
export async function playUntil(
	page: Page,
	target: Locator,
	text: string | RegExp,
	maxMs: number,
	stepMs = 1000
) {
	const found = (s: string | null) =>
		s !== null && (typeof text === 'string' ? s.includes(text) : text.test(s));
	for (let t = 0; t < maxMs && !found(await target.textContent()); t += stepMs) {
		await page.clock.runFor(Math.min(stepMs, maxMs - t));
	}
	await expect(target).toContainText(text);
}
