import { defineConfig } from '@playwright/test';
import production from './playwright.config';

// Separate from production validation: Vite updates this checkout through HMR.
// Start `make test-server` to reuse it across runs; the managed server exits after a run.
process.env.PW_DEV_TOPICS = '1';
const BASE = '/how-things-work';
const PORT = Number(process.env.PW_DEV_PORT ?? 4181);

export default defineConfig({
	...production,
	outputDir: 'test-results/dev',
	globalSetup: './e2e/dev-server.setup.ts',
	use: { ...production.use, baseURL: `http://localhost:${PORT}${BASE}/` },
	webServer: {
		command: `BASE_PATH=${BASE} npm run dev -- --host localhost --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}${BASE}/`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	}
});
