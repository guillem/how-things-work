/**
 * Hash tables and Bloom filters, simulated on real words (`words.ts`, from Tiny Shakespeare).
 *
 * - The hash is MurmurHash3 (x86, 32-bit; Austin Appleby, public domain), seeded, over the
 *   word's letters as bytes. A degraded hash reads only the word's first few letters, as Java's
 *   String.hashCode did for long strings before JDK 1.2 (it sampled at most 16 characters).
 * - A hash table of m slots, filled in order, with separate chaining (each slot holds a list;
 *   new keys go to the end) or linear probing (a taken slot sends the key to the next one, round
 *   the end). Probes are counted as Knuth counts them: key comparisons for chaining (an
 *   unsuccessful search compares with every key in the chain), slots examined for linear probing
 *   (an unsuccessful search ends at the first empty slot, which counts).
 * - A Bloom filter of m bits and k hash functions (k independent seeds of the same hash): adding a
 *   key sets its k bits; a query says "maybe present" if all k are set, "definitely absent"
 *   otherwise.
 *
 * Expected values: Knuth, The Art of Computer Programming vol. 3, §6.4 (chaining 1 + α/2 and α;
 * linear probing ½(1 + 1/(1 − α)) and ½(1 + 1/(1 − α)²)); Bloom (1970) and Broder &
 * Mitzenmacher (2004) for (1 − e^(−kn/m))^k and its optimum k = (m/n) ln 2; Bose et al. (2008)
 * for why that is an underestimate in small filters (the exact value below, by the occupancy
 * distribution, assumes fully random bit positions).
 */
import { WORDS } from './words';

// ---------------------------------------------------------------- the hash

/** MurmurHash3_x86_32 of the string's char codes (one byte each for a–z), as an unsigned int. */
export function murmur3(key: string, seed = 0): number {
	let h = seed >>> 0;
	const n = key.length;
	const c1 = 0xcc9e2d51;
	const c2 = 0x1b873593;
	let i = 0;
	for (; i + 4 <= n; i += 4) {
		let k =
			(key.charCodeAt(i) & 0xff) |
			((key.charCodeAt(i + 1) & 0xff) << 8) |
			((key.charCodeAt(i + 2) & 0xff) << 16) |
			((key.charCodeAt(i + 3) & 0xff) << 24);
		k = Math.imul(k, c1);
		k = (k << 15) | (k >>> 17);
		k = Math.imul(k, c2);
		h ^= k;
		h = (h << 13) | (h >>> 19);
		h = (Math.imul(h, 5) + 0xe6546b64) | 0;
	}
	let k = 0;
	switch (n & 3) {
		case 3:
			k ^= (key.charCodeAt(i + 2) & 0xff) << 16;
		// falls through
		case 2:
			k ^= (key.charCodeAt(i + 1) & 0xff) << 8;
		// falls through
		case 1:
			k ^= key.charCodeAt(i) & 0xff;
			k = Math.imul(k, c1);
			k = (k << 15) | (k >>> 17);
			k = Math.imul(k, c2);
			h ^= k;
	}
	h ^= n;
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return h >>> 0;
}

/** A seeded hash of a key. */
export type Hash = (key: string, seed?: number) => number;

/** How many letters the hash reads: 1–5, or `ALL` for the whole word (a good hash). */
export const ALL = 99;

/** MurmurHash3 of the first `letters` letters of the key: the full hash, or a degraded one. */
export const hashReading =
	(letters: number): Hash =>
	(key, seed = 0) =>
		murmur3(letters >= ALL ? key : key.slice(0, letters), seed);

export const goodHash = hashReading(ALL);

/** The words: the first ones are inserted, the last `QUERY_COUNT` are only ever queried. */
export const QUERY_COUNT = 2000;
export const INSERTABLE = WORDS.slice(0, WORDS.length - QUERY_COUNT);
export const QUERIES = WORDS.slice(WORDS.length - QUERY_COUNT);

/** A seed for each table or filter run: a different hash function of the same family. */
const seedOf = (salt: number, i = 0) => (Math.imul(salt + 1, 0x9e3779b1) + i * 0x85ebca6b) >>> 0;

// ---------------------------------------------------------------- hash tables

export type Scheme = 'chaining' | 'linear';

export interface Table {
	scheme: Scheme;
	m: number;
	keys: readonly string[];
	/** Home slot of each key: hash mod m. */
	home: number[];
	/** Linear probing: the key index in each slot, or −1. */
	slots: Int32Array;
	/** Chaining: the key indices in each slot's chain, in insertion order. */
	chains: number[][];
	/** Where each key ended up: its slot. */
	slotOf: number[];
	/** Probes a successful search for each key takes (equal to the probes its insertion took). */
	hitProbes: number[];
}

export interface TableOptions {
	hash?: Hash;
	salt?: number;
}

/** Inserts `keys` in order into an empty table of `m` slots (at most m keys for linear probing). */
export function buildTable(
	scheme: Scheme,
	keys: readonly string[],
	m: number,
	opts: TableOptions = {}
): Table {
	const hash = opts.hash ?? goodHash;
	const seed = seedOf(opts.salt ?? 0);
	const n = scheme === 'linear' ? Math.min(keys.length, m) : keys.length;
	const t: Table = {
		scheme,
		m,
		keys: keys.slice(0, n),
		home: [],
		slots: new Int32Array(m).fill(-1),
		chains: Array.from({ length: m }, () => []),
		slotOf: [],
		hitProbes: []
	};
	for (let i = 0; i < n; i++) {
		const h = hash(keys[i], seed) % m;
		t.home.push(h);
		if (scheme === 'chaining') {
			t.chains[h].push(i);
			t.slotOf.push(h);
			t.hitProbes.push(t.chains[h].length);
		} else {
			let s = h;
			let probes = 1;
			while (t.slots[s] >= 0) {
				s = (s + 1) % m;
				probes++;
			}
			t.slots[s] = i;
			t.slotOf.push(s);
			t.hitProbes.push(probes);
		}
	}
	return t;
}

export interface Search {
	found: boolean;
	/** Probes taken (see the file comment for how they are counted). */
	probes: number;
	/** The slots visited in order (chaining: the home slot once per comparison). */
	path: number[];
}

/** Looks a key up in a table built with the same options. */
export function search(t: Table, key: string, opts: TableOptions = {}): Search {
	const hash = opts.hash ?? goodHash;
	const h = hash(key, seedOf(opts.salt ?? 0)) % t.m;
	if (t.scheme === 'chaining') {
		const chain = t.chains[h];
		const path: number[] = [];
		for (const i of chain) {
			path.push(h);
			if (t.keys[i] === key) return { found: true, probes: path.length, path };
		}
		return { found: false, probes: path.length, path: path.length ? path : [h] };
	}
	const path: number[] = [];
	let s = h;
	for (let tries = 0; tries < t.m; tries++) {
		path.push(s);
		const i = t.slots[s];
		if (i < 0) return { found: false, probes: path.length, path };
		if (t.keys[i] === key) return { found: true, probes: path.length, path };
		s = (s + 1) % t.m;
	}
	return { found: false, probes: path.length, path };
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Mean probes of a successful search, over every key in the table. */
export const meanHit = (t: Table) => mean(t.hitProbes);

/** Mean probes of an unsuccessful search, over words that were never inserted. */
export function meanMiss(t: Table, queries: readonly string[] = QUERIES, opts: TableOptions = {}) {
	return mean(queries.map((q) => search(t, q, opts).probes));
}

/** The longest chain (chaining) or the longest run of taken slots (linear probing). */
export function longest(t: Table): number {
	if (t.scheme === 'chaining') return Math.max(0, ...t.chains.map((c) => c.length));
	if (t.keys.length >= t.m) return t.m;
	let best = 0;
	let run = 0;
	// start just after an empty slot so that a run across the end is counted whole
	const start = t.slots.findIndex((v) => v < 0);
	for (let j = 1; j <= t.m; j++) {
		const s = (start + j) % t.m;
		run = t.slots[s] >= 0 ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

/**
 * Knuth's Q function (TAOCP vol. 3, §6.4, eq. (25)–(27)):
 * Q_r(M, N) = Σ_k C(r + k, k) · N(N − 1)…(N − k + 1) / M^k.
 */
function knuthQ(r: number, M: number, N: number): number {
	let sum = 0;
	let term = 1; // N(N−1)…(N−k+1)/M^k
	for (let k = 0; k <= N; k++) {
		const binom = r === 0 ? 1 : k + 1; // C(k, k) or C(1 + k, k)
		sum += binom * term;
		term *= (N - k) / M;
		if (term < 1e-15) break;
	}
	return sum;
}

/**
 * Expected probes in a table of m slots holding n keys, under a random hash, exactly (not only
 * for large tables). Chaining: 1 + (n − 1)/2m and n/m. Linear probing (Knuth's Theorem 6.4K):
 * ½(1 + Q₀(m, n − 1)) and ½(1 + Q₁(m, n)), which tend to ½(1 + 1/(1 − α)) and
 * ½(1 + 1/(1 − α)²) as the table grows at a fixed α = n/m.
 */
export function expectedProbes(
	scheme: Scheme,
	m: number,
	n: number
): { hit: number; miss: number } {
	if (scheme === 'chaining') return { hit: 1 + (n - 1) / (2 * m), miss: n / m };
	return {
		hit: n === 0 ? 1 : 0.5 * (1 + knuthQ(0, m, n - 1)),
		miss: 0.5 * (1 + knuthQ(1, m, n))
	};
}

/** Chain lengths: how many slots hold 0, 1, 2, … keys (the last bin counts `top` or more). */
export function chainHistogram(t: Table, top = 8): number[] {
	const h = Array<number>(top + 1).fill(0);
	for (const c of t.chains) h[Math.min(top, c.length)]++;
	return h;
}

/** Share of slots expected to hold j keys under a random hash: Poisson, e^(−α) α^j / j!. */
export function poisson(alpha: number, j: number): number {
	let p = Math.exp(-alpha);
	for (let i = 1; i <= j; i++) p *= alpha / i;
	return p;
}

export interface FillCurve {
	/** Load factor α = n/m after each insertion, n = 1, 2, … */
	alpha: number[];
	hit: number[];
	miss: number[];
}

/**
 * The table filled one key at a time: mean probes of a successful and of an unsuccessful search
 * after each insertion (the unsuccessful ones over `queries`).
 */
export function fillCurve(
	scheme: Scheme,
	keys: readonly string[],
	m: number,
	opts: TableOptions = {},
	queries: readonly string[] = QUERIES.slice(0, 400)
): FillCurve {
	const full = buildTable(scheme, keys, m, opts);
	const out: FillCurve = { alpha: [], hit: [], miss: [] };
	let sum = 0;
	const hash = opts.hash ?? goodHash;
	const seed = seedOf(opts.salt ?? 0);
	const qHome = queries.map((q) => hash(q, seed) % m);
	const count = new Int32Array(m);
	const taken = new Uint8Array(m);
	for (let i = 0; i < full.keys.length; i++) {
		sum += full.hitProbes[i];
		if (scheme === 'chaining') count[full.slotOf[i]]++;
		else taken[full.slotOf[i]] = 1;
		const n = i + 1;
		out.alpha.push(n / m);
		out.hit.push(sum / n);
		let miss = 0;
		for (const h of qHome) {
			if (scheme === 'chaining') miss += count[h];
			else {
				let s = h;
				let p = 1;
				while (taken[s] && p <= m) {
					s = (s + 1) % m;
					p++;
				}
				miss += p;
			}
		}
		out.miss.push(miss / qHome.length);
	}
	return out;
}

/** `fillCurve` averaged over `runs` tables, each with a different seed of the hash. */
export function averageFillCurve(
	scheme: Scheme,
	m: number,
	n: number,
	runs: number,
	hash: Hash = goodHash
): FillCurve {
	const acc: FillCurve = {
		alpha: [],
		hit: Array<number>(n).fill(0),
		miss: Array<number>(n).fill(0)
	};
	for (let r = 0; r < runs; r++) {
		// each run takes a different stretch of the words
		const off = (r * 97) % (INSERTABLE.length - n);
		const c = fillCurve(scheme, INSERTABLE.slice(off, off + n), m, { hash, salt: 1000 + r });
		for (let i = 0; i < n; i++) {
			acc.hit[i] += c.hit[i] / runs;
			acc.miss[i] += c.miss[i] / runs;
		}
	}
	acc.alpha = Array.from({ length: n }, (_, i) => (i + 1) / m);
	return acc;
}

// ---------------------------------------------------------------- growing and rehashing

export interface GrowPoint {
	n: number;
	m: number;
	/** Mean probes of a successful search in the table as it stands. */
	hit: number;
	/** Keys moved by rehashing so far, all resizes together. */
	moved: number;
}

/**
 * Keys inserted one at a time into a table that starts with `m0` slots and doubles (rehashing
 * every key into the new table) whenever the next key would push the load factor past `maxLoad`.
 */
export function growRun(
	scheme: Scheme,
	keys: readonly string[],
	maxLoad: number,
	m0 = 8,
	opts: TableOptions = {}
): { points: GrowPoint[]; resizes: number[] } {
	const hash = opts.hash ?? goodHash;
	const seed = seedOf(opts.salt ?? 0);
	const hashes = keys.map((k) => hash(k, seed));
	let m = m0;
	let slots = new Int32Array(m).fill(-1);
	let count = new Int32Array(m);
	let probesSum = 0;
	let moved = 0;
	const points: GrowPoint[] = [];
	const resizes: number[] = [];
	const place = (i: number) => {
		const h = hashes[i] % m;
		if (scheme === 'chaining') {
			count[h]++;
			return count[h];
		}
		let s = h;
		let p = 1;
		while (slots[s] >= 0) {
			s = (s + 1) % m;
			p++;
		}
		slots[s] = i;
		return p;
	};
	for (let i = 0; i < keys.length; i++) {
		if ((i + 1) / m > maxLoad) {
			m *= 2;
			slots = new Int32Array(m).fill(-1);
			count = new Int32Array(m);
			probesSum = 0;
			for (let j = 0; j < i; j++) probesSum += place(j);
			moved += i;
			resizes.push(i + 1);
		}
		probesSum += place(i);
		points.push({ n: i + 1, m, hit: probesSum / (i + 1), moved });
	}
	return { points, resizes };
}

// ---------------------------------------------------------------- Bloom filters

/** The k bit positions of a key in a filter of m bits (k seeds of the hash). */
export function bitsOf(key: string, m: number, k: number, salt = 0, hash: Hash = goodHash) {
	const out: number[] = [];
	for (let i = 0; i < k; i++) out.push(hash(key, seedOf(salt, i + 1)) % m);
	return out;
}

export interface Bloom {
	m: number;
	k: number;
	bits: Uint8Array;
	/** Bits set to 1. */
	ones: number;
}

export function buildBloom(
	keys: readonly string[],
	m: number,
	k: number,
	salt = 0,
	hash: Hash = goodHash
): Bloom {
	const bits = new Uint8Array(m);
	let ones = 0;
	for (const key of keys)
		for (const b of bitsOf(key, m, k, salt, hash))
			if (!bits[b]) {
				bits[b] = 1;
				ones++;
			}
	return { m, k, bits, ones };
}

/** True ("maybe present") when all k bits of the key are set. */
export const maybeHas = (f: Bloom, key: string, salt = 0, hash: Hash = goodHash) =>
	bitsOf(key, f.m, f.k, salt, hash).every((b) => f.bits[b] === 1);

/** Share of `queries` (never inserted) that the filter calls "maybe present". */
export function measuredFP(
	f: Bloom,
	queries: readonly string[] = QUERIES,
	salt = 0,
	hash: Hash = goodHash
): number {
	let fp = 0;
	for (const q of queries) if (maybeHas(f, q, salt, hash)) fp++;
	return fp / queries.length;
}

/** The standard approximation of the false-positive rate, (1 − e^(−kn/m))^k. */
export const fpApprox = (n: number, m: number, k: number) => (1 - Math.exp((-k * n) / m)) ** k;

/** The number of hash functions that minimises the approximation: (m/n) ln 2. */
export const kOptimal = (n: number, m: number) => (m / n) * Math.LN2;

/**
 * The exact false-positive rate when the kn bit positions of the inserted keys and the k of the
 * query are independent and uniform: Σ_j P(j bits set) (j/m)^k, with P from the occupancy
 * distribution of kn throws into m bins (Bose et al. 2008; Christensen, Roginsky & Jimeno 2010).
 */
export function fpExact(n: number, m: number, k: number): number {
	let p = new Float64Array(m + 1);
	p[0] = 1;
	const throws = k * n;
	for (let s = 0; s < throws; s++) {
		const q = new Float64Array(m + 1);
		const top = Math.min(m, s);
		for (let j = 0; j <= top; j++) {
			const pj = p[j];
			if (pj === 0) continue;
			q[j] += pj * (j / m);
			if (j < m) q[j + 1] += pj * (1 - j / m);
		}
		p = q;
	}
	let fp = 0;
	for (let j = 0; j <= m; j++) fp += p[j] * (j / m) ** k;
	return fp;
}

/**
 * The false-positive rate measured over `trials` filters, each with its own seeds: n keys in
 * m bits, every query word asked of each filter.
 */
export function measuredFPAverage(
	n: number,
	m: number,
	k: number,
	trials: number,
	queries: readonly string[] = QUERIES.slice(0, 200),
	hash: Hash = goodHash
): number {
	let sum = 0;
	for (let r = 0; r < trials; r++) {
		const off = (r * 131) % Math.max(1, INSERTABLE.length - n);
		const f = buildBloom(INSERTABLE.slice(off, off + n), m, k, 5000 + r, hash);
		sum += measuredFP(f, queries, 5000 + r, hash);
	}
	return sum / trials;
}

/** Bits per key a filter needs for a false-positive rate p at the optimum k: −ln p / (ln 2)². */
export const bitsPerKeyFor = (p: number) => -Math.log(p) / Math.LN2 ** 2;

/** Mean length of the words, in letters. */
export const MEAN_WORD_LENGTH = mean(WORDS.map((w) => w.length));
