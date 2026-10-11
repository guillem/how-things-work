// Smoke test of the live site, run by the release workflow after each deploy.
// With a build version (from build/_app/version.json) it first waits, up to six
// minutes, until the site serves that build (GitHub Pages caches for up to ten).
// Then it checks that the home page, every topic page linked from it, and every
// script, stylesheet and font they reference all answer 200.
//
// Usage: node scripts/verify-live.mjs [build-version]
//        SITE_URL=https://… overrides the site (default: the GitHub Pages URL).
const SITE = new URL(process.env.SITE_URL ?? 'https://guillem.github.io/how-things-work/');
if (!SITE.pathname.endsWith('/')) SITE.pathname += '/';
const expected = process.argv[2];
const get = (url) => fetch(url, { cache: 'no-store' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (expected) {
	const deadline = Date.now() + 6 * 60_000;
	for (;;) {
		const res = await get(new URL(`_app/version.json?t=${Date.now()}`, SITE));
		const live = res.ok ? (await res.json()).version : `HTTP ${res.status}`;
		if (live === expected) break;
		if (Date.now() > deadline) {
			console.error(`The live site still serves build ${live}, not ${expected}.`);
			process.exit(1);
		}
		console.log(`Live build is ${live}; waiting for ${expected}…`);
		await sleep(15_000);
	}
	console.log(`The live site serves build ${expected}.`);
}

const ASSET = /(?:href|src)="([^"]+\.(?:js|css|woff2?))"/g;
const LINK = /href="([^"#]+\/)"/g;
const assets = new Set();
let failures = 0;

async function page(url) {
	const res = await get(url);
	console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${res.status} ${url.pathname}`);
	if (!res.ok) {
		failures++;
		return '';
	}
	const html = await res.text();
	for (const [, href] of html.matchAll(ASSET)) assets.add(new URL(href, url).href);
	return html;
}

const home = await page(SITE);
const topics = [
	...new Set(
		[...home.matchAll(LINK)]
			.map(([, href]) => new URL(href, SITE))
			.filter((u) => u.origin === SITE.origin && u.pathname.startsWith(SITE.pathname))
			.map((u) => u.pathname.slice(SITE.pathname.length))
			.filter((rest) => /^[a-z0-9-]+\/$/.test(rest))
	)
];
if (topics.length === 0) {
	console.error('No topic links found on the home page.');
	failures++;
}
for (const rest of topics) await page(new URL(rest, SITE));

for (const href of assets) {
	const res = await get(href);
	if (!res.ok) {
		failures++;
		console.log(`FAIL ${res.status} ${new URL(href).pathname}`);
	}
}
console.log(
	failures
		? `${failures} failure(s).`
		: `Live site OK: home page, ${topics.length} topics, ${assets.size} assets.`
);
process.exit(failures ? 1 : 0);
