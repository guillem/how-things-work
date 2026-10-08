// Checks the PageRank model behind the pagerank explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	EXAMPLE,
	STARTER,
	TRAPS,
	addLink,
	addPage,
	inCount,
	pagerank,
	parseWeb,
	removePage,
	rounds,
	serializeWeb,
	visitsAt,
	walk,
	type Web
} from '../src/routes/pagerank/pagerank';

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const blank = (n: number): Web => ({
	pages: Array.from({ length: n }, (_, i) => ({ x: i, y: 0 })),
	links: []
});
const make = (n: number, links: string) =>
	links
		.split(' ')
		.reduce((w, p) => addLink(w, p.charCodeAt(0) - 65, p.charCodeAt(1) - 65), blank(n));

test('ranks sum to 1, and a ring gives every page the same rank', () => {
	for (const w of [EXAMPLE, TRAPS, STARTER]) expect(sum(pagerank(w).rank)).toBeCloseTo(1, 10);
	const ring = make(4, 'AB BC CD DA');
	for (const r of pagerank(ring).rank) expect(r).toBeCloseTo(0.25, 10);
});

test('matches a hand-solved web', () => {
	// A → B, A → C, B → C, C → A with d = 0.85. Solving the three equations
	// a = 0.05 + 0.85c, b = 0.05 + 0.425a, c = 0.05 + 0.425a + 0.85b by hand:
	const w = make(3, 'AB AC BC CA');
	const [a, b, c] = pagerank(w).rank;
	const A = (0.05 + 0.85 * (0.05 + 0.85 * 0.05)) / (1 - 0.85 * (0.425 + 0.85 * 0.425));
	expect(a).toBeCloseTo(A, 9);
	expect(b).toBeCloseTo(0.05 + 0.425 * A, 9);
	expect(c).toBeCloseTo(0.05 + 0.425 * A + 0.85 * (0.05 + 0.425 * A), 9);
});

test('dead ends hand their rank to everyone, and with no links all pages are equal', () => {
	for (const r of pagerank(blank(5)).rank) expect(r).toBeCloseTo(0.2, 12);
	// F in TRAPS has no links: the ranks still sum to 1.
	expect(sum(pagerank(TRAPS).rank)).toBeCloseTo(1, 10);
});

test('without random jumps the surfer ends up stuck in the trap', () => {
	const r = pagerank(TRAPS, 1).rank;
	expect(r[3] + r[4]).toBeCloseTo(1, 6); // D and E only link to each other
	const r85 = pagerank(TRAPS).rank;
	expect(r85[3] + r85[4]).toBeLessThan(0.8);
	expect(Math.min(...r85)).toBeGreaterThan(0.15 / 6 - 1e-12); // every page keeps its jumps
});

test('the random surfer’s share of visits converges to the ranks', () => {
	for (const w of [EXAMPLE, TRAPS, STARTER]) {
		const hops = 200_000;
		const v = visitsAt(walk(w, hops, 0.85, 7), hops);
		const r = pagerank(w).rank;
		v.forEach((c, i) => expect(Math.abs(c / (hops + 1) - r[i])).toBeLessThan(0.01));
	}
});

test('the update converges from equal ranks', () => {
	const h = rounds(EXAMPLE, 60);
	expect(h[0].every((v) => Math.abs(v - 1 / 6) < 1e-12)).toBe(true);
	const r = pagerank(EXAMPLE).rank;
	h[60].forEach((v, i) => expect(v).toBeCloseTo(r[i], 4));
	for (const row of h) expect(sum(row)).toBeCloseTo(1, 10);
});

test('example web: a link from an important page beats many links from unimportant ones', () => {
	const r = pagerank(EXAMPLE).rank;
	const c = inCount(EXAMPLE);
	expect(c[0]).toBe(1); // A: one incoming link (from C)
	expect(c[1]).toBe(4); // B: four
	expect(r[0]).toBeGreaterThan(1.5 * r[1]);
});

test('starter web: what lifts E, and what does not', () => {
	const E = 4;
	const base = pagerank(STARTER).rank[E];
	expect(base).toBeCloseTo(0.15 / 5, 10); // nobody links to E: only its share of jumps
	// E's own links change nothing for E.
	for (let j = 0; j < 4; j++)
		expect(pagerank(addLink(STARTER, E, j)).rank[E]).toBeCloseTo(base, 10);
	// A link from A (the top page) lifts it about six-fold.
	const fromA = pagerank(addLink(STARTER, 0, E)).rank[E];
	expect(fromA / base).toBeGreaterThan(5);
	// Three new pages that link to E barely do better than double it.
	let farm = STARTER;
	for (let k = 0; k < 3; k++) {
		farm = addPage(farm, { x: 0, y: 0 });
		farm = addLink(farm, farm.pages.length - 1, E);
	}
	const farmed = pagerank(farm).rank[E];
	expect(farmed).toBeGreaterThan(base);
	expect(farmed).toBeLessThan(fromA / 2);
});

test('the text form round-trips, and removing a page renames the rest', () => {
	const s = serializeWeb(EXAMPLE);
	expect(serializeWeb(parseWeb(s)!)).toBe(s);
	expect(parseWeb('nonsense')).toBeNull();
	const w = removePage(make(3, 'AB BC CA'), 0);
	expect(w.links).toEqual([[0, 1]]); // only B → C is left, now A → B
});
