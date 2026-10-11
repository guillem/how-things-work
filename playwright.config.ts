import { defineConfig, devices } from '@playwright/test';

// The browser tests run against the production build served the way GitHub
// Pages serves it: under the /how-things-work/ sub-path, with 404.html for
// unknown URLs (scripts/serve-pages.mjs). Tests navigate with relative URLs
// (`page.goto('./sorting/')`) so they resolve under the sub-path.
// PW_PORT picks the port (4173 is often taken by another app on this machine).
const BASE = '/how-things-work';
const PORT = Number(process.env.PW_PORT ?? 4180);

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: true,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}${BASE}/`,
		trace: 'retain-on-failure'
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
		reuseExistingServer: false
	}
});
