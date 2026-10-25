import { defineConfig } from '@playwright/test';
import production from './playwright.config';

// `make changed`: the same production build and server as release validation (the build takes
// seconds), with test files that cover many topics narrowed to the selected ones
// (e2e/topic-filter.ts). Release validation uses playwright.config.ts and runs every topic.
process.env.PW_NARROW_TOPICS = '1';

export default defineConfig({ ...production, outputDir: 'test-results/changed' });
