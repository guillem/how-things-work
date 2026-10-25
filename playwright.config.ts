import { defineConfig, devices } from '@playwright/test';

// The browser tests run against the production build served the way GitHub
// Pages serves it: under the /how-things-work/ sub-path, with 404.html for
// unknown URLs (scripts/serve-pages.mjs). Tests navigate with relative URLs
// (`page.goto('./sorting/')`) so they resolve under the sub-path.
// PW_PORT picks the port (4173 is often taken by another app on this machine).
// Production validation always exercises every topic. Only the dev config enables filtering.
process.env.PW_DEV_TOPICS = '0';
const BASE = '/how-things-work';
const PORT = Number(process.env.PW_PORT ?? 4180);

export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results/browser',
	testMatch: '**/*.e2e.{ts,js}',
	// The model tests run in Node without a browser: playwright.models.config.ts.
	testIgnore: '**/*-model.e2e.ts',
	fullyParallel: true,
	// CI's runner is slower than the laptop, and some steps compute for seconds as they open (a
	// sheet of heart tissue, 9,999 shuffles): give assertions longer to come true there.
	expect: { timeout: process.env.CI ? 15_000 : 5_000 },
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}${BASE}/`,
		// Recording a trace costs about a quarter of the suite's time, so only CI keeps one for each
		// failure (locally, rerun a failing test with `--trace on` to get one).
		trace: process.env.CI ? 'retain-on-failure' : 'off'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Lets a pre-installed Chromium be used instead of the bundled download.
				launchOptions: process.env.PW_CHROMIUM_PATH
					? { executablePath: process.env.PW_CHROMIUM_PATH }
					: undefined
			}
		}
	],
	webServer: {
		command: `BASE_PATH=${BASE} npm run build && node scripts/serve-pages.mjs build ${BASE} ${PORT}`,
		url: `http://localhost:${PORT}${BASE}/`,
		reuseExistingServer: false,
		// The build alone takes over a minute on a cloud session's VM (Playwright waits 60 s by default).
		timeout: 180_000
	}
});
