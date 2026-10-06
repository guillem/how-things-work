// The whole site is prerendered to static HTML (see vite.config.ts).
export const prerender = true;
// Emit `photosynthesis/index.html` rather than `photosynthesis.html`, which
// every static host (including GitHub Pages) serves reliably.
export const trailingSlash = 'always';
