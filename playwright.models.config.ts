import { defineConfig } from '@playwright/test';

// The model tests: plain Node, no browser and no build (part of `make check`).
export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results/models',
	testMatch: '**/*-model.e2e.ts',
	// Plain Node and CPU-bound: CI's 8-vCPU runner gets 6 workers rather than the default 4.
	workers: process.env.CI ? 6 : undefined,
	reporter: process.env.CI ? 'list' : 'dot'
});
