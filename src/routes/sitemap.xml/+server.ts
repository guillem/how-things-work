import type { RequestHandler } from './$types';
import { site } from '#lib/site.ts';
import { topics } from '#lib/topics.ts';

// Written to build/sitemap.xml at build time (the site is static); static/robots.txt
// points crawlers at it. The index and every built explainer, under the live URL.
export const prerender = true;

export const GET: RequestHandler = () => {
	const urls = [site.url, ...topics.map((t) => `${site.url}${t.slug}/`)];
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map((loc) => `\t<url><loc>${loc}</loc></url>`),
		'</urlset>',
		''
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
