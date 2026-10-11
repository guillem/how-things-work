import { defineConfig } from '@playwright/test';

// The model tests: plain Node, no browser and no build (part of `make check`).
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*-model.e2e.ts',
	reporter: process.env.CI ? 'list' : 'dot'
});
