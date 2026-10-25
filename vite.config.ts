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
		{
			name: 'validation-workspace',
			apply: 'serve',
			configureServer(server) {
				// A persistent test server must belong to this checkout, not a sibling worktree.
				server.middlewares.use((req, res, next) => {
					if (req.url !== `${base}/__validation_workspace`) return next();
					res.setHeader('content-type', 'text/plain');
					res.setHeader('cache-control', 'no-store');
					res.end(process.cwd());
				});
			}
		},
		sveltekit({
			adapter: adapter({
				// Every route is prerendered to plain HTML + assets in ./build
				pages: 'build',
				assets: 'build',
				strict: true
			}),
			// The static 404 page can be served at any depth, so its assets and
			// navigation must resolve from the site root rather than the missing URL.
			paths: { base: base as '' | `/${string}`, relative: false },
			prerender: {
				handleHttpError: 'fail',
				// Step links (`../topic/#step`) point at ids the explainer renders at runtime.
				handleMissingId: 'ignore'
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	]
});
