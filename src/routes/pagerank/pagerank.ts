/**
 * PageRank on a small web: the random surfer and the exact ranks.
 *
 * Conventions (the "normalised" PageRank, ranks sum to 1):
 * - at each hop the surfer follows one of the current page's links, chosen
 *   at random, with probability `d` (the damping factor, 0.85 in the original
 *   paper); otherwise it jumps to any page at random (all pages equally
 *   likely, including the one it is on);
 * - a page with no links (a dead end, or "dangling" page) always jumps;
 * - several links from one page to the same page count once (a web page
 *   either links to another or it does not).
 *
 * The rank of a page is the long-run share of the surfer's time spent on it,
 * which is also the solution of
 *   PR(p) = (1 − d)/N + d · Σ_{q → p} PR(q)/out(q) + d · Σ_{q dead end} PR(q)/N,
 * found here by repeating that update (power iteration).
 */
import { rng } from '#lib/draw/math.ts';

export interface Page {
	x: number;
	y: number;
}

export interface Web {
	pages: Page[];
	/** Directed links [from, to], no duplicates, no self-links. */
	links: [number, number][];
}

export const MAX_PAGES = 10;
export const DAMPING = 0.85;

/** Page names: A, B, C… */
export const pageName = (i: number) => String.fromCharCode(65 + i);

// ------------------------------------------------------------ structure

/** Out-links of every page (targets, in insertion order). */
export function outLinks(web: Web): number[][] {
	const out: number[][] = web.pages.map(() => []);
	for (const [a, b] of web.links) out[a].push(b);
	return out;
}

/** Number of links pointing to each page. */
export function inCount(web: Web): number[] {
	const c = web.pages.map(() => 0);
	for (const [, b] of web.links) c[b]++;
	return c;
}

export const hasLink = (web: Web, a: number, b: number) =>
	web.links.some(([x, y]) => x === a && y === b);

/** Adds a link a → b (ignored if it exists, is a self-link or names a missing page). */
export function addLink(web: Web, a: number, b: number): Web {
	const n = web.pages.length;
	if (a === b || a < 0 || b < 0 || a >= n || b >= n || hasLink(web, a, b)) return web;
	return { pages: web.pages, links: [...web.links, [a, b]] };
}

export function removeLink(web: Web, a: number, b: number): Web {
	return { pages: web.pages, links: web.links.filter(([x, y]) => !(x === a && y === b)) };
}

/** Adds a page at a position (ignored beyond MAX_PAGES). */
export function addPage(web: Web, p: Page): Web {
	if (web.pages.length >= MAX_PAGES) return web;
	return { pages: [...web.pages, p], links: web.links };
}

/** Removes page i and its links; later pages shift down by one (and are renamed). */
export function removePage(web: Web, i: number): Web {
	return {
		pages: web.pages.filter((_, k) => k !== i),
		links: web.links
			.filter(([a, b]) => a !== i && b !== i)
			.map(([a, b]) => [a > i ? a - 1 : a, b > i ? b - 1 : b] as [number, number])
	};
}

export function movePage(web: Web, i: number, p: Page): Web {
	return { pages: web.pages.map((q, k) => (k === i ? p : q)), links: web.links };
}

// ------------------------------------------------------------ text form (for params)

/**
 * A web as a short string, so it can live in the explainer's params (and so
 * survive moving between steps): `x,y;x,y;…|a>b,a>b,…` with whole-number
 * positions in scene coordinates.
 */
export function serializeWeb(web: Web): string {
	const pages = web.pages.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
	const links = web.links.map(([a, b]) => `${a}>${b}`).join(',');
	return `${pages}|${links}`;
}

/** Parses `serializeWeb` output; returns null if it is not a valid web. */
export function parseWeb(s: unknown): Web | null {
	if (typeof s !== 'string' || !s.includes('|')) return null;
	const [ps, ls] = s.split('|');
	const pages: Page[] = [];
	for (const item of ps ? ps.split(';') : []) {
		const [x, y] = item.split(',').map(Number);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		pages.push({ x, y });
	}
	if (pages.length > MAX_PAGES) return null;
	let web: Web = { pages, links: [] };
	for (const item of ls ? ls.split(',') : []) {
		const [a, b] = item.split('>').map(Number);
		if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
		web = addLink(web, a, b);
	}
	return web;
}

// ------------------------------------------------------------ ranks

/** One round of the update: the share of rank each page holds after one more hop. */
export function step(web: Web, rank: readonly number[], d = DAMPING, out = outLinks(web)): number[] {
	const n = rank.length;
	const next = new Array(n).fill(0);
	let spread = 0; // rank handed out evenly to every page: random jumps and dead ends
	for (let q = 0; q < n; q++) {
		const targets = out[q];
		if (targets.length === 0) {
			spread += rank[q];
			continue;
		}
		spread += (1 - d) * rank[q];
		const share = (d * rank[q]) / targets.length;
		for (const p of targets) next[p] += share;
	}
	for (let p = 0; p < n; p++) next[p] += spread / n;
	return next;
}

/**
 * Ranks after each round of the update, starting from equal ranks (round 0)
 * — what the "compute" scene animates.
 */
export function rounds(web: Web, count: number, d = DAMPING): number[][] {
	const n = web.pages.length;
	const out = outLinks(web);
	const history = [new Array(n).fill(n ? 1 / n : 0)];
	for (let k = 0; k < count; k++) history.push(step(web, history[k], d, out));
	return history;
}

/**
 * The PageRank of every page (sums to 1), by repeating the update until it
 * stops changing. With d = 1 (no random jumps) the surfer can be trapped and
 * the plain update can oscillate for ever between the pages of a loop, so the
 * "lazy" update (half old, half new) is used, which has the same answer.
 */
export function pagerank(web: Web, d = DAMPING, tol = 1e-12, maxRounds = 10_000) {
	const n = web.pages.length;
	if (!n) return { rank: [] as number[], rounds: 0 };
	const out = outLinks(web);
	const lazy = d > 0.999;
	let r: number[] = new Array(n).fill(1 / n);
	for (let k = 1; k <= maxRounds; k++) {
		const s = step(web, r, d, out);
		const next = lazy ? s.map((v, i) => (v + r[i]) / 2) : s;
		const change = next.reduce((m, v, i) => m + Math.abs(v - r[i]), 0);
		r = next;
		if (change < tol) return { rank: r, rounds: k };
	}
	return { rank: r, rounds: maxRounds };
}

// ------------------------------------------------------------ the random surfer

export interface Walk {
	/** path[k] = the page the surfer is on after k hops (path[0] is the start). */
	path: Uint8Array;
	/** jumped[k] = 1 if hop k (from path[k−1] to path[k]) was a random jump rather than a link. */
	jumped: Uint8Array;
	/** Visit counts of every page over path[0..k], stored every CHECKPOINT hops. */
	checkpoints: Uint32Array[];
	n: number;
}

const CHECKPOINT = 64;

/** A random surfer's first `hops` hops on `web`, reproducible from `seed`. */
export function walk(web: Web, hops: number, d = DAMPING, seed = 1, start = 0): Walk {
	const n = web.pages.length;
	const out = outLinks(web);
	const rand = rng(seed);
	const path = new Uint8Array(hops + 1);
	const jumped = new Uint8Array(hops + 1);
	const checkpoints: Uint32Array[] = [];
	const counts = new Uint32Array(n);
	path[0] = Math.min(start, Math.max(0, n - 1));
	if (n) counts[path[0]]++;
	checkpoints.push(counts.slice());
	for (let k = 1; k <= hops; k++) {
		const here = path[k - 1];
		const targets = out[here] ?? [];
		if (n && targets.length && rand() < d) {
			path[k] = targets[Math.floor(rand() * targets.length)];
		} else {
			path[k] = Math.floor(rand() * n);
			jumped[k] = 1;
		}
		if (n) counts[path[k]]++;
		if (k % CHECKPOINT === 0) checkpoints.push(counts.slice());
	}
	return { path, jumped, checkpoints, n };
}

/** How many times the surfer has been on each page after `k` hops (counting the start). */
export function visitsAt(w: Walk, k: number): number[] {
	const last = w.path.length - 1;
	const kk = Math.max(0, Math.min(last, Math.floor(k)));
	const c = Math.floor(kk / CHECKPOINT);
	const counts = Array.from(w.checkpoints[c] ?? new Uint32Array(w.n));
	for (let j = c * CHECKPOINT + 1; j <= kk; j++) counts[w.path[j]]++;
	return counts;
}

// ------------------------------------------------------------ the webs the page starts from

const web = (pages: [number, number][], links: string): Web => {
	let w: Web = { pages: pages.map(([x, y]) => ({ x, y })), links: [] };
	for (const pair of links.split(' ')) {
		const [a, b] = pair.split('').map((ch) => ch.charCodeAt(0) - 65);
		w = addLink(w, a, b);
	}
	return w;
};

/**
 * The example web for the first chapters. B has more incoming links than
 * anyone but C; A has only one, from C — yet A outranks B, because C is
 * important and links to almost nothing else.
 */
export const EXAMPLE = web(
	[
		[300, 140],
		[190, 330],
		[420, 300],
		[560, 150],
		[580, 440],
		[300, 480]
	],
	'AB AC BC CA DB DC EB ED EC FB FE'
);

/** A web with a dead end (F links nowhere) and a trap (D and E only link to each other). */
export const TRAPS = web(
	[
		[220, 160],
		[180, 380],
		[400, 290],
		[590, 170],
		[610, 420],
		[380, 500]
	],
	'AB AC BC BF CA CD DE ED'
);

/**
 * Where the reader's own web starts. E is a new page that links to A but that
 * nobody links to yet: its own links cannot lift it (no surfer arrives by a
 * link, so it keeps only its share of random jumps); a link from A, the top
 * page, lifts it about six-fold, while three new pages linking to it barely
 * double it.
 */
export const STARTER = web(
	[
		[250, 150],
		[180, 380],
		[420, 280],
		[260, 520],
		[600, 400]
	],
	'AB BC CA CD DA EA'
);

export const PRESETS: Record<string, Web> = { example: EXAMPLE, traps: TRAPS, starter: STARTER };
