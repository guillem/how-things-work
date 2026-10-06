import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// When deploying to GitHub Pages at https://<user>.github.io/<repo>/ the site
// lives under a sub-path. The deploy workflow sets BASE_PATH to "/<repo>".
// Leave it unset (or set it to "") for local development, user/organisation
// pages (<user>.github.io) or a custom domain.
const base = process.env.BASE_PATH ?? '';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				// Every route is prerendered to plain HTML + assets in ./build
				pages: 'build',
				assets: 'build',
				strict: true
			}),
			paths: { base: base as '' | `/${string}` },
			prerender: {
				handleHttpError: 'fail',
				handleMissingId: 'warn'
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	]
});
