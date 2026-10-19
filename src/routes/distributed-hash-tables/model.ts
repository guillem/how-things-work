/**
 * Distributed hash tables: consistent hashing (Karger et al., STOC 1997) and Chord (Stoica et
 * al., SIGCOMM 2001) on a 32-bit identifier ring.
 *
 * Everything is placed on the ring by one seeded 32-bit hash (MurmurHash3's mixer over the
 * characters of a name), so a run replays exactly: same names, same ring, same lookups. Real
 * systems use SHA-1 (Chord, BitTorrent) or MD5 (Dynamo, Cassandra's older partitioner) over 128
 * or 160 bits; any hash that spreads names evenly behaves the same for what this page shows.
 */
import { rng } from '#lib/draw/math.ts';

/** Size of the identifier space: positions are integers in [0, 2³²). */
export const SPACE = 2 ** 32;
/** Bits of an identifier, so the number of fingers a Chord node keeps. */
export const BITS = 32;
export const SEED = 0x5eed;

/** A 32-bit hash of a string (MurmurHash3 x86_32 over its UTF-16 code units), seeded. */
export function hash32(s: string, seed = SEED): number {
	let h = seed >>> 0;
	for (let i = 0; i < s.length; i++) {
		let k = s.charCodeAt(i);
		k = Math.imul(k, 0xcc9e2d51);
		k = (k << 15) | (k >>> 17);
		k = Math.imul(k, 0x1b873593);
		h ^= k;
		h = (h << 13) | (h >>> 19);
		h = (Math.imul(h, 5) + 0xe6546b64) | 0;
	}
	h ^= s.length;
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return h >>> 0;
}

/** Position of an identifier as a fraction of a turn, 0 at the top, clockwise. */
export const turn = (id: number) => id / SPACE;

/** Clockwise distance from a to b on the ring, in [0, 2³²). */
export const gap = (a: number, b: number) => (b - a + SPACE) % SPACE;

/** Index of the first id ≥ x in a sorted array, wrapping to 0 past the end: x's successor. */
export function successorIndex(ids: ArrayLike<number>, x: number): number {
	let lo = 0;
	let hi = ids.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (ids[mid] < x) lo = mid + 1;
		else hi = mid;
	}
	return lo === ids.length ? 0 : lo;
}

// ------------------------------------------------------------------ consistent hashing

export interface RingPoint {
	id: number;
	/** Index of the server this point belongs to. */
	server: number;
}

/** The names a server's virtual nodes are hashed from: "B#0", "B#1", ... */
export const pointName = (server: string, v: number) => `${server}#${v}`;

/** Every server hashed onto the ring `vnodes` times, sorted clockwise. */
export function buildRing(servers: readonly string[], vnodes = 1): RingPoint[] {
	const pts: RingPoint[] = [];
	servers.forEach((s, server) => {
		for (let v = 0; v < vnodes; v++) pts.push({ id: hash32(pointName(s, v)), server });
	});
	return pts.sort((a, b) => a.id - b.id);
}

export type Rule = 'ring' | 'modulo';

/**
 * Which server holds each key. `ring`: the server of the first point clockwise from the key's
 * hash (consistent hashing). `modulo`: hash mod the number of servers, the naive rule.
 */
export function assign(
	keys: readonly string[],
	servers: readonly string[],
	rule: Rule,
	vnodes = 1
): number[] {
	if (rule === 'modulo') return keys.map((k) => hash32(k) % servers.length);
	const ring = buildRing(servers, vnodes);
	const ids = ring.map((p) => p.id);
	return keys.map((k) => ring[successorIndex(ids, hash32(k))].server);
}

/** Number of keys whose server differs between two assignments. */
export const moved = (a: readonly number[], b: readonly number[]) =>
	a.reduce((n, s, i) => n + (s === b[i] ? 0 : 1), 0);

/** Each server's share of the ring (the fraction of all possible keys it holds), summing to 1. */
export function shares(servers: readonly string[], vnodes = 1): number[] {
	const ring = buildRing(servers, vnodes);
	const out = servers.map(() => 0);
	ring.forEach((p, i) => {
		const prev = ring[(i - 1 + ring.length) % ring.length].id;
		out[p.server] += (ring.length === 1 ? SPACE : gap(prev, p.id)) / SPACE;
	});
	return out;
}

/** Largest share over the mean share (1 is perfectly even). */
export function imbalance(s: readonly number[]) {
	return Math.max(...s) * s.length;
}

/** Standard deviation of the shares over their mean. */
export function spread(s: readonly number[]) {
	const mean = 1 / s.length;
	const v = s.reduce((a, x) => a + (x - mean) ** 2, 0) / s.length;
	return Math.sqrt(v) / mean;
}

/** Server names: A, B, ... Z, then S27, S28, ... */
export const serverName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `S${i + 1}`);
export const serverNames = (n: number) => Array.from({ length: n }, (_, i) => serverName(i));
/** Key names, like the files or user ids a real store would hold. */
export const keyNames = (n: number, prefix = 'key') =>
	Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

// ------------------------------------------------------------------ Chord

export interface Chord {
	/** Node identifiers, sorted clockwise, all distinct. */
	ids: Float64Array;
	/** fingers[i * BITS + j]: index of the node succeeding ids[i] + 2^j. */
	fingers: Int32Array;
}

/** A Chord ring of n nodes named node-0 ... (colliding hashes are skipped), with finger tables. */
export function chord(n: number, prefix = 'node'): Chord {
	const set = new Set<number>();
	for (let i = 0; set.size < n; i++) set.add(hash32(`${prefix}-${i}`));
	const ids = Float64Array.from([...set].sort((a, b) => a - b));
	const fingers = new Int32Array(n * BITS);
	for (let i = 0; i < n; i++)
		for (let j = 0; j < BITS; j++)
			fingers[i * BITS + j] = successorIndex(ids, (ids[i] + 2 ** j) % SPACE);
	return { ids, fingers };
}

/** Index of the node responsible for key id k: its successor on the ring. */
export const responsible = (c: Chord, k: number) => successorIndex(c.ids, k);

/** True when x lies in the clockwise interval (a, b]. */
const inHalfOpen = (x: number, a: number, b: number) =>
	a === b ? true : gap(a, x) > 0 && gap(a, x) <= gap(a, b);

export interface Lookup {
	/** Node indexes the query visits, from the start to the key's predecessor, which answers. */
	path: number[];
	/** The node that holds the key: the successor of the last node on `path`. */
	holder: number;
	/** Messages forwarding the query: one per step along `path` (Chord's path length). */
	hops: number;
}

/**
 * Looks up key id k from node `start`, as Chord's find_successor does. While the key is not
 * between the current node and its successor, the node forwards the query to the farthest node
 * it knows that does not overshoot the key (with fingers: the closest preceding finger;
 * without: its successor). The node the key follows answers with its successor, the holder.
 */
export function lookup(c: Chord, start: number, k: number, useFingers = true): Lookup {
	const n = c.ids.length;
	const path = [start];
	let node = start;
	while (n > 1 && !inHalfOpen(k, c.ids[node], c.ids[(node + 1) % n])) {
		let next = (node + 1) % n;
		if (useFingers)
			for (let j = BITS - 1; j >= 0; j--) {
				const f = c.fingers[node * BITS + j];
				// the closest preceding finger: strictly between this node and the key
				if (f !== node && gap(c.ids[node], c.ids[f]) < gap(c.ids[node], k)) {
					next = f;
					break;
				}
			}
		node = next;
		path.push(node);
	}
	return { path, holder: (node + 1) % n, hops: path.length - 1 };
}

export interface HopStats {
	n: number;
	mean: number;
	/** 1st and 99th percentiles of the hop count. */
	p1: number;
	p99: number;
	/** hist[h]: fraction of lookups that took h hops. */
	hist: number[];
}

/** Hop counts of `count` lookups of random keys from random nodes (seeded). */
export function hopStats(n: number, count = 2000, useFingers = true, seed = 7): HopStats {
	const c = chord(n);
	const r = rng(seed + n);
	const hops: number[] = [];
	for (let q = 0; q < count; q++) {
		const start = Math.floor(r() * n);
		const k = Math.floor(r() * SPACE);
		hops.push(lookup(c, start, k, useFingers).hops);
	}
	hops.sort((a, b) => a - b);
	const hist: number[] = [];
	for (const h of hops) hist[h] = (hist[h] ?? 0) + 1 / count;
	for (let h = 0; h < hist.length; h++) hist[h] ??= 0;
	return {
		n,
		mean: hops.reduce((a, b) => a + b, 0) / count,
		p1: hops[Math.floor(0.01 * count)],
		p99: hops[Math.min(count - 1, Math.floor(0.99 * count))],
		hist
	};
}

/** Network sizes the scaling chart measures: 8 to 16,384 nodes, powers of two. */
export const SIZES = Array.from({ length: 12 }, (_, i) => 2 ** (i + 3));

// ------------------------------------------------------------------ churn and replication

export interface ChurnOptions {
	/** Nodes in the ring (kept constant: as many join each round as fail). */
	nodes: number;
	keys: number;
	/** Fraction of the live nodes that fail at once in each round. */
	fail: number;
	/** Length of each node's successor list. */
	successors: number;
	/** Copies of each key, on the key's successor and the nodes after it. */
	copies: number;
	rounds: number;
	seed?: number;
}

export interface ChurnRound {
	/** Live node ids before the failures, sorted. */
	before: number[];
	/** Ids that failed this round. */
	failed: number[];
	/** Ids that joined after the repair. */
	joined: number[];
	/** Ids of surviving nodes whose whole successor list failed: the ring is cut after each. */
	cut: number[];
	/** Indexes of keys lost this round (every copy failed). */
	lost: number[];
	/** Keys lost in this round and all the earlier ones. */
	lostTotal: number;
}

/**
 * Rounds of churn on a ring whose state is fully repaired between rounds (Chord's
 * stabilisation: successor lists rebuilt, each surviving key copied again onto its `copies`
 * successors). In each round a random `fail` fraction of the nodes fails at once, before any
 * repair. A surviving node keeps its place in the ring if any node in its successor list
 * survived; a key survives if any of its copies did. Then as many fresh nodes join, taking over
 * their share of the keys. Deterministic for a given seed.
 */
export function churn(o: ChurnOptions): ChurnRound[] {
	const r = rng(o.seed ?? 11);
	const keyIds = keyNames(o.keys).map((k) => hash32(k));
	const alive = new Set<number>();
	let named = 0;
	const fresh = () => {
		for (;;) {
			const id = hash32(`node-${named++}`);
			if (!alive.has(id)) return id;
		}
	};
	for (let i = 0; i < o.nodes; i++) alive.add(fresh());
	const lostKeys = new Set<number>();
	const out: ChurnRound[] = [];
	for (let round = 0; round < o.rounds; round++) {
		const before = [...alive].sort((a, b) => a - b);
		const n = before.length;
		const dead = new Set<number>();
		const want = Math.round(o.fail * n);
		while (dead.size < want) dead.add(before[Math.floor(r() * n)]);
		const cut = before.filter((id, i) => {
			if (dead.has(id)) return false;
			for (let s = 1; s <= Math.min(o.successors, n - 1); s++)
				if (!dead.has(before[(i + s) % n])) return false;
			return true;
		});
		const lost: number[] = [];
		keyIds.forEach((k, ki) => {
			if (lostKeys.has(ki)) return;
			const first = successorIndex(before, k);
			for (let c = 0; c < Math.min(o.copies, n); c++)
				if (!dead.has(before[(first + c) % n])) return;
			lost.push(ki);
			lostKeys.add(ki);
		});
		for (const id of dead) alive.delete(id);
		const joined: number[] = [];
		for (let j = 0; j < want; j++) {
			const id = fresh();
			alive.add(id);
			joined.push(id);
		}
		out.push({
			before,
			failed: [...dead].sort((a, b) => a - b),
			joined: joined.sort((a, b) => a - b),
			cut,
			lost,
			lostTotal: lostKeys.size
		});
	}
	return out;
}
