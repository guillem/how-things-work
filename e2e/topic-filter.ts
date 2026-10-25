import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type Page } from '@playwright/test';

// Targeted runs (`make changed`, playwright.changed.config.ts) narrow test files that cover many
// topics to the selected ones (PW_TOPICS). A test file that itself changed (PW_FULL_FILES) runs
// in full. Release validation (playwright.config.ts) always runs every topic.
const topics = new Set(process.env.PW_TOPICS?.split(',').filter(Boolean));
const full = new Set(process.env.PW_FULL_FILES?.split(',').filter(Boolean));
const narrowing = () => process.env.PW_NARROW_TOPICS === '1' && topics.size > 0;

/** Whether the test file at `fileUrl` (its `import.meta.url`) runs the tests of topic `slug`. */
export function runsTopic(fileUrl: string, slug: string) {
	if (!narrowing()) return true;
	return topics.has(slug) || full.has(path.relative(process.cwd(), fileURLToPath(fileUrl)));
}

/** Skips a test as soon as it opens a topic that this run does not select. */
export function skipUnselectedTopics(page: Page, fileUrl: string) {
	if (!narrowing()) return;
	const goto = page.goto.bind(page);
	page.goto = (url, options) => {
		const slug = /^\.\/([a-z0-9-]+)\//.exec(url)?.[1];
		if (slug && fs.existsSync(`src/routes/${slug}/steps.ts`))
			test.skip(!runsTopic(fileUrl, slug), `${slug} is not selected in this targeted run`);
		return goto(url, options);
	};
}
