// Checks the DHT model against what consistent hashing and Chord are known to do: adding a
// server to a ring moves only the new server's share of the keys, about K/(N+1), all of them to
// the new server (Karger et al. 1997), while hash-mod-N moves almost all of them; with one
// point per server the largest share is about ln N times the mean, and virtual nodes even the
// load out as 1/√v; a Chord lookup takes about ½ log₂ N hops (Stoica et al. 2001, §6.3), a
// walk along successors about N/2; successor lists of length O(log N) keep the ring whole when
// half the nodes fail at once, and a key kept in c copies is lost with probability about fᶜ.
// The hash is seeded, so every number here replays exactly. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	SPACE,
	assign,
	chord,
	churn,
	hash32,
	hopStats,
	imbalance,
	keyNames,
	lookup,
	moved,
	responsible,
	serverNames,
	shares,
	spread
} from '../src/routes/distributed-hash-tables/model';

const keys = keyNames(10_000);

test('the hash spreads names evenly over the ring', () => {
	const bins = new Array<number>(16).fill(0);
	for (const k of keys) bins[Math.floor((hash32(k) / SPACE) * 16)]++;
	for (const b of bins) expect(Math.abs(b - 625)).toBeLessThan(100); // ~4 standard deviations
});

test('hash mod N: adding an eleventh server moves about 10 keys in 11', () => {
	const before = assign(keys, serverNames(10), 'modulo');
	const after = assign(keys, serverNames(11), 'modulo');
	expect(moved(before, after) / keys.length).toBeCloseTo(10 / 11, 1);
});

test('consistent hashing: a new server takes keys only for itself, about K/(N+1) on average', () => {
	let total = 0;
	const trials = 40;
	for (let t = 0; t < trials; t++) {
		const old = serverNames(10).map((s) => `${s}/${t}`);
		const before = assign(keys, old, 'ring');
		const after = assign(keys, [...old, `new-${t}`], 'ring');
		after.forEach((s, i) => {
			if (s !== before[i]) expect(s).toBe(10); // nothing moves between old servers
		});
		total += moved(before, after);
	}
	// one point per server: a single join moves anything from almost nothing to several times
	// the share, but on average it is the new server's fair share, 1/11 of the keys
	expect(total / trials / keys.length).toBeGreaterThan(0.07);
	expect(total / trials / keys.length).toBeLessThan(0.115);
});

test('with 100 virtual nodes each, a single join moves close to 1/(N+1) of the keys', () => {
	const old = serverNames(10);
	const before = assign(keys, old, 'ring', 100);
	const after = assign(keys, [...old, 'K'], 'ring', 100);
	expect(moved(before, after) / keys.length).toBeGreaterThan(0.07);
	expect(moved(before, after) / keys.length).toBeLessThan(0.115);
});

test('removing a server hands its keys to its successors and moves nothing else', () => {
	const servers = serverNames(8);
	const before = assign(keys, servers, 'ring');
	const after = assign(keys, servers.slice(0, 7), 'ring');
	before.forEach((s, i) => {
		if (s !== 7) expect(after[i]).toBe(s);
	});
	expect(moved(before, after)).toBe(before.filter((s) => s === 7).length);
});

test('one point per server: the biggest share is about ln N times the mean', () => {
	// the largest of N random gaps on a circle is H_N ≈ ln N + 0.58 times the mean on average
	let sum = 0;
	const runs = 40;
	for (let r = 0; r < runs; r++)
		sum += imbalance(shares(serverNames(1000).map((s) => `${s}/${r}`)));
	const hN = Array.from({ length: 1000 }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b);
	expect(sum / runs).toBeGreaterThan(hN - 1);
	expect(sum / runs).toBeLessThan(hN + 1);
});

test('virtual nodes even out the load: the spread of the shares falls as 1/√v', () => {
	const servers = serverNames(100);
	expect(spread(shares(servers, 1))).toBeGreaterThan(0.8);
	expect(spread(shares(servers, 1))).toBeLessThan(1.2);
	expect(spread(shares(servers, 100))).toBeGreaterThan(0.07);
	expect(spread(shares(servers, 100))).toBeLessThan(0.13);
	expect(imbalance(shares(servers, 1))).toBeGreaterThan(3);
	expect(imbalance(shares(servers, 100))).toBeLessThan(1.5);
});

test('every Chord lookup ends at the key’s successor, with fingers or without', () => {
	const c = chord(300);
	for (let q = 0; q < 300; q++) {
		const k = hash32(`probe-${q}`);
		const start = (q * 37) % 300;
		expect(lookup(c, start, k).holder).toBe(responsible(c, k));
		expect(lookup(c, start, k, false).holder).toBe(responsible(c, k));
	}
});

test('Chord lookups take about ½ log₂ N hops, from 8 to 16,384 nodes', () => {
	for (const n of [8, 64, 1024, 4096, 16_384]) {
		const s = hopStats(n);
		expect(Math.abs(s.mean - 0.5 * Math.log2(n))).toBeLessThan(0.4);
	}
	// thousands of machines, a dozen hops at most
	expect(hopStats(16_384).p99).toBeLessThanOrEqual(12);
});

test('without fingers a lookup walks about half way round: N/2 hops', () => {
	const s = hopStats(512, 1000, false);
	expect(s.mean / 256).toBeGreaterThan(0.9);
	expect(s.mean / 256).toBeLessThan(1.1);
});

test('half the nodes fail at once: one successor each cuts the ring, 2 log₂ N keep it whole', () => {
	const run = (successors: number) =>
		churn({ nodes: 1000, keys: 1000, fail: 0.5, successors, copies: 1, rounds: 1 })[0];
	const one = run(1);
	// a survivor is cut off when its only successor failed: about half of the 500 survivors
	expect(one.cut.length).toBeGreaterThan(200);
	expect(one.cut.length).toBeLessThan(300);
	expect(run(20).cut.length).toBe(0);
});

test('a key kept on c successors is lost when all c fail: about fᶜ of the keys', () => {
	const lost = (copies: number) =>
		churn({ nodes: 1000, keys: 10_000, fail: 0.25, successors: 3, copies, rounds: 1 })[0].lost
			.length / 10_000;
	expect(lost(1)).toBeGreaterThan(0.2);
	expect(lost(1)).toBeLessThan(0.3);
	expect(lost(3)).toBeLessThan(0.03);
	expect(lost(3)).toBeGreaterThan(0.005);
});

test('repaired between rounds, three copies survive churn that one copy does not', () => {
	const opts = { nodes: 1000, keys: 10_000, fail: 0.1, successors: 4, rounds: 10 };
	const one = churn({ ...opts, copies: 1 });
	const three = churn({ ...opts, copies: 3 });
	// one copy: each round loses about a tenth of what is left
	expect(one[9].lostTotal / 10_000).toBeGreaterThan(0.5);
	expect(three[9].lostTotal / 10_000).toBeLessThan(0.03);
	// the ring keeps its size: as many join as fail
	expect(three[9].before.length).toBe(1000);
});
