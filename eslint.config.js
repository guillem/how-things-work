import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Research scripts for the topic proposal: workflow scripts (top-level return) and one-off tools.
	{ ignores: ['docs/proposals/**'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Type-aware rules (typescript-eslint's recommendedTypeChecked) for our
		// TypeScript and the script blocks of .svelte files. Only the rules are
		// taken: the parsers set above stay in charge.
		files: ['src/**/*.ts', 'src/**/*.svelte', 'e2e/**/*.ts'],
		languageOptions: {
			parserOptions: { projectService: true, extraFileExtensions: ['.svelte'] }
		},
		rules: ts.configs.recommendedTypeChecked.find(
			(c) => c.name === 'typescript-eslint/recommended-type-checked'
		)?.rules
	},
	{
		// Scene code fires tweens and shallow navigations without awaiting them
		// (`tween.set(...)`, `goto(hash, { shallow: true })`) on purpose. In the
		// tests a missing `await` is a real bug, so the rule stays on there.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		rules: { '@typescript-eslint/no-floating-promises': 'off' }
	},
	{
		// Baseline: files that had these findings when the type-aware rules were
		// turned on (2026-10-11). Remove a file from the list once it is clean;
		// never add one — new code must pass.
		files: [
			'e2e/circuit-model.e2e.ts',
			'e2e/em-model.e2e.ts',
			'e2e/fit-model.e2e.ts',
			'e2e/scenes.e2e.ts',
			'e2e/search-model.e2e.ts',
			'src/lib/components/TopicArt.svelte',
			'src/lib/explainer/Explainer.svelte',
			'src/routes/atmosphere-weather/atmosphere.ts',
			'src/routes/atmosphere-weather/scenes/MapScene.svelte',
			'src/routes/bayes-theorem/bayes.ts',
			'src/routes/binary/binary.ts',
			'src/routes/central-limit-theorem/clt.ts',
			'src/routes/central-limit-theorem/scenes/GaltonScene.svelte',
			'src/routes/central-limit-theorem/scenes/MeansScene.svelte',
			'src/routes/chaos-fractals/scenes/LogisticScene.svelte',
			'src/routes/complex-numbers/scenes/ProductScene.svelte',
			'src/routes/electric-circuits/circuit.ts',
			'src/routes/entropy/scenes/CountScene.svelte',
			'src/routes/epidemics/scenes/ThresholdScene.svelte',
			'src/routes/graph-search/scenes/RoadsScene.svelte',
			'src/routes/graph-search/search.ts',
			'src/routes/learning-from-data/fit.ts',
			'src/routes/learning-from-data/scenes/CurveScene.svelte',
			'src/routes/learning-from-data/scenes/FitScene.svelte',
			'src/routes/ocean-currents/scenes/GyreScene.svelte',
			'src/routes/ocean-currents/scenes/OverturnScene.svelte',
			'src/routes/oscillations-resonance/scenes/PendulumScene.svelte',
			'src/routes/pagerank/pagerank.ts',
			'src/routes/reinforcement-learning/scenes/CurveScene.svelte'
		],
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/unbound-method': 'off'
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
