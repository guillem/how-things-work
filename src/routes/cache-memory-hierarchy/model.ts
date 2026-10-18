/**
 * A cache simulator and the programs fed through it.
 *
 * A cache holds `size / line` lines in `sets` sets of `ways` lines each. An address belongs to
 * line `floor(address / line)`; that line may live only in set `line mod sets`, under the tag
 * `floor(line / sets)`. A hit finds the line in its set; a miss fetches the whole line from the
 * next level and, if the set is full, evicts one chosen by the replacement policy (least recently
 * used, first in first out, or random from a seeded generator, so every run replays exactly).
 *
 * Misses are sorted into the three Cs (Hill 1987): compulsory (the first touch of a line ever),
 * capacity (a fully associative LRU cache of the same size would miss too) and conflict (it would
 * have hit: the line was thrown out only because its set was full). Under FIFO or random
 * replacement a few accesses can miss in the fully associative LRU cache and hit here; such a
 * "negative conflict" is counted as a hit, as everyone does.
 *
 * Latencies (load-to-use, in processor cycles) are those measured on an Intel Core i7-6700
 * (Skylake, 4.0 GHz) by 7-cpu.com: L1 4 cycles, L2 12, L3 42, main memory 42 cycles + 51 ns,
 * about 250 cycles. Its caches: L1 data 32 KB 8-way, L2 256 KB 4-way, L3 8 MB 16-way, all with
 * 64-byte lines. The model has no L3 and no prefetcher (see the step notes).
 */
import { rng } from '#lib/draw/math.ts';

export type Policy = 'lru' | 'fifo' | 'random';

export interface CacheConfig {
	/** Capacity in bytes (a power of two). */
	size: number;
	/** Line length in bytes (a power of two). */
	line: number;
	/** Lines per set; 0 means fully associative (one set). */
	ways: number;
	policy: Policy;
}

/** Load-to-use latencies in cycles, 7-cpu.com's Skylake measurements (see the file header). */
export const LATENCY = { l1: 4, l2: 12, l3: 42, mem: 250 } as const;

/** The measured chip's caches (7-cpu.com, Intel Core i7-6700). */
export const SKYLAKE = {
	l1: { size: 32 * 1024, line: 64, ways: 8, policy: 'lru' },
	l2: { size: 256 * 1024, line: 64, ways: 4, policy: 'lru' },
	l3: { size: 8 * 1024 * 1024, line: 64, ways: 16 }
} as const satisfies Record<string, Partial<CacheConfig>>;

export const L1: CacheConfig = { ...SKYLAKE.l1 };
export const L2: CacheConfig = { ...SKYLAKE.l2 };

export type MissKind = 'hit' | 'compulsory' | 'capacity' | 'conflict';

/** One set-associative cache. */
export class Cache {
	readonly sets: number;
	readonly ways: number;
	readonly lineBits: number;
	/** Line number held in each slot (set * ways + way), -1 when empty. */
	readonly slots: Int32Array;
	private readonly stamp: Float64Array;
	private clock = 0;
	private readonly random: () => number;
	readonly config: CacheConfig;
	constructor(config: CacheConfig, seed = 1) {
		this.config = config;
		const lines = Math.max(1, Math.floor(config.size / config.line));
		this.ways = config.ways <= 0 || config.ways > lines ? lines : config.ways;
		this.sets = Math.max(1, Math.floor(lines / this.ways));
		this.lineBits = Math.log2(config.line);
		this.slots = new Int32Array(this.sets * this.ways).fill(-1);
		this.stamp = new Float64Array(this.sets * this.ways);
		this.random = rng(seed);
	}
	/** Looks up line `ln`; on a miss fetches it. Returns the slot and whether it hit. */
	touch(ln: number): { hit: boolean; slot: number; evicted: number } {
		const set = ln % this.sets;
		const base = set * this.ways;
		const now = ++this.clock;
		let empty = -1;
		for (let w = 0; w < this.ways; w++) {
			const s = base + w;
			const held = this.slots[s];
			if (held === ln) {
				if (this.config.policy === 'lru') this.stamp[s] = now;
				return { hit: true, slot: s, evicted: -1 };
			}
			if (held < 0 && empty < 0) empty = s;
		}
		let victim = empty;
		if (victim < 0) {
			if (this.config.policy === 'random') {
				victim = base + Math.floor(this.random() * this.ways);
			} else {
				victim = base;
				for (let w = 1; w < this.ways; w++)
					if (this.stamp[base + w] < this.stamp[victim]) victim = base + w;
			}
		}
		const evicted = this.slots[victim];
		this.slots[victim] = ln;
		this.stamp[victim] = now;
		return { hit: false, slot: victim, evicted };
	}
	access(address: number) {
		return this.touch(Math.floor(address / this.config.line));
	}
}

/** A fully associative LRU cache of `lines` lines, for the three-C classification. */
class Shadow {
	private readonly held = new Map<number, true>();
	private readonly lines: number;
	constructor(lines: number) {
		this.lines = lines;
	}
	touch(ln: number): boolean {
		if (this.held.delete(ln)) {
			this.held.set(ln, true);
			return true;
		}
		this.held.set(ln, true);
		if (this.held.size > this.lines) this.held.delete(this.held.keys().next().value!);
		return false;
	}
}

// ---- programs ---------------------------------------------------------------------------------

/** A block of memory the scene draws as a grid of elements, row by row. */
export interface Region {
	name: string;
	base: number;
	rows: number;
	cols: number;
	/** Bytes per element. */
	elem: number;
}

export interface Trace {
	/** Byte address of every load and store, in program order. */
	addrs: Int32Array;
	regions: Region[];
	/** The arithmetic done: additions, or multiply-adds for the matrix product. */
	ops: number;
}

/** Builds a trace from a generator of addresses. */
function collect(regions: Region[], ops: number, each: (push: (a: number) => void) => void): Trace {
	let buf = new Int32Array(1024);
	let n = 0;
	each((a) => {
		if (n === buf.length) {
			const next = new Int32Array(buf.length * 2);
			next.set(buf);
			buf = next;
		}
		buf[n++] = a;
	});
	return { addrs: buf.slice(0, n), regions, ops };
}

/** Sum an n × n matrix of 8-byte numbers stored row by row, in row or column order. */
export function matrixSum(n: number, order: 'row' | 'col'): Trace {
	const A: Region = { name: 'A', base: 0, rows: n, cols: n, elem: 8 };
	return collect([A], n * n, (push) => {
		for (let p = 0; p < n; p++)
			for (let q = 0; q < n; q++) push(8 * (order === 'row' ? p * n + q : q * n + p));
	});
}

/** A seeded shuffle of 0 … n − 1. */
function shuffled(n: number, seed: number): number[] {
	const r = rng(seed);
	const a = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/**
 * Walk a linked list of `n` nodes of `node` bytes (a value and a pointer to the next node),
 * reading each node once. Allocated in order, node k sits at slot k; scattered, the nodes sit in
 * a shuffled order across the same block, as after many allocations and frees.
 */
export function listWalk(n: number, scattered: boolean, node = 16, seed = 7): Trace {
	const cols = Math.min(n, Math.max(1, Math.floor(128 / node)));
	const R: Region = { name: 'list', base: 0, rows: Math.ceil(n / cols), cols, elem: node };
	const where = scattered ? shuffled(n, seed) : Array.from({ length: n }, (_, i) => i);
	return collect([R], n, (push) => {
		for (let k = 0; k < n; k++) push(where[k] * node);
	});
}

/**
 * C = A × B for n × n matrices of 8-byte numbers, stored one after the other, row by row. The
 * inner loop loads A[i][k] and B[k][j]; C[i][j] stays in a register and is stored once per pass
 * over k. Blocked, the k and j loops are cut into b × b tiles of B (Lam, Rothberg & Wolf 1991),
 * so a tile is reused by every row i before the next is loaded. Same n³ multiply-adds either way.
 */
export function matmul(n: number, block = 0, gap = 0): Trace {
	const bytes = n * n * 8 + gap;
	const A: Region = { name: 'A', base: 0, rows: n, cols: n, elem: 8 };
	const B: Region = { name: 'B', base: bytes, rows: n, cols: n, elem: 8 };
	const C: Region = { name: 'C', base: 2 * bytes, rows: n, cols: n, elem: 8 };
	const a = (i: number, k: number) => A.base + 8 * (i * n + k);
	const b = (k: number, j: number) => B.base + 8 * (k * n + j);
	const c = (i: number, j: number) => C.base + 8 * (i * n + j);
	return collect([A, B, C], n * n * n, (push) => {
		if (block <= 0 || block >= n) {
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++) {
					for (let k = 0; k < n; k++) {
						push(a(i, k));
						push(b(k, j));
					}
					push(c(i, j));
				}
			return;
		}
		for (let kk = 0; kk < n; kk += block)
			for (let jj = 0; jj < n; jj += block)
				for (let i = 0; i < n; i++)
					for (let j = jj; j < Math.min(n, jj + block); j++) {
						for (let k = kk; k < Math.min(n, kk + block); k++) {
							push(a(i, k));
							push(b(k, j));
						}
						push(c(i, j));
					}
	});
}

/**
 * The dot product of two arrays of `n` 8-byte numbers, a[i] × b[i], where b starts `offset`
 * bytes after a. With the offset a multiple of a direct-mapped cache's size, a[i] and b[i] land
 * in the same set, and each load throws out the line the next one needs.
 */
export function dotProduct(n: number, offset: number): Trace {
	const a: Region = { name: 'a', base: 0, rows: Math.ceil(n / 16), cols: Math.min(n, 16), elem: 8 };
	const b: Region = { ...a, name: 'b', base: offset };
	return collect([a, b], n, (push) => {
		for (let i = 0; i < n; i++) {
			push(8 * i);
			push(offset + 8 * i);
		}
	});
}

/**
 * Loop `laps` times over `lines` consecutive lines, reading one 8-byte number from each (a
 * stride of one line), as a program does that keeps re-reading a table slightly too big for
 * its cache.
 */
export function loop(lines: number, line: number, laps: number): Trace {
	const per = line / 8;
	const cols = Math.max(1, Math.floor(128 / 8));
	const R: Region = {
		name: 'table',
		base: 0,
		rows: Math.ceil((lines * per) / cols),
		cols,
		elem: 8
	};
	return collect([R], lines * laps, (push) => {
		for (let l = 0; l < laps; l++) for (let k = 0; k < lines; k++) push(k * line);
	});
}

/**
 * Pointer chasing over a working set of `bytes`: one load per line, the lines visited in a
 * seeded random cycle, `laps` times; the way memory latency is measured (lmbench's lat_mem_rd,
 * 7-cpu.com), because no load can start before the previous one has returned its pointer.
 */
export function chase(bytes: number, laps: number, line = 64, seed = 11): Trace {
	const lines = Math.max(1, Math.floor(bytes / line));
	const order = shuffled(lines, seed);
	const R: Region = { name: 'set', base: 0, rows: 1, cols: lines, elem: line };
	return collect([R], lines * laps, (push) => {
		for (let l = 0; l < laps; l++) for (const k of order) push(k * line);
	});
}

/** Sum an array of `bytes` in order, 8 bytes at a time, `laps` times. */
export function sweepSum(bytes: number, laps: number): Trace {
	const n = Math.floor(bytes / 8);
	const R: Region = { name: 'array', base: 0, rows: 1, cols: n, elem: 8 };
	return collect([R], n * laps, (push) => {
		for (let l = 0; l < laps; l++) for (let k = 0; k < n; k++) push(8 * k);
	});
}

// ---- running a trace --------------------------------------------------------------------------

export interface Tally {
	accesses: number;
	hits: number;
	misses: number;
	/** The misses sorted into the three Cs (all 0 when the run did not classify them). */
	compulsory: number;
	capacity: number;
	conflict: number;
	/** Accesses served by L2 and by memory (with one level, every miss goes to memory). */
	l2Hits: number;
	memory: number;
}

export const missRate = (t: Tally) => (t.accesses ? t.misses / t.accesses : 0);

/** Mean cycles per access: each access costs the latency of the level that served it. */
export function amat(t: Tally): number {
	if (!t.accesses) return 0;
	return (t.hits * LATENCY.l1 + t.l2Hits * LATENCY.l2 + t.memory * LATENCY.mem) / t.accesses;
}

export interface RunOptions {
	l2?: CacheConfig | null;
	/** Count only accesses from this index on (to measure a warmed-up cache). */
	from?: number;
	/** Classify misses into the three Cs (costs a fully associative shadow cache). */
	classify?: boolean;
	seed?: number;
}

/** Runs a trace through L1 (and an optional L2) and counts what happened. */
export function run(trace: Trace, l1: CacheConfig, opts: RunOptions = {}): Tally {
	const c1 = new Cache(l1, opts.seed ?? 1);
	const c2 = opts.l2 ? new Cache(opts.l2, (opts.seed ?? 1) + 1) : null;
	const classify = opts.classify ?? true;
	const shadow = classify ? new Shadow(c1.sets * c1.ways) : null;
	const seen = classify ? new Set<number>() : null;
	const from = opts.from ?? 0;
	const t: Tally = {
		accesses: 0,
		hits: 0,
		misses: 0,
		compulsory: 0,
		capacity: 0,
		conflict: 0,
		l2Hits: 0,
		memory: 0
	};
	const { addrs } = trace;
	const bits = c1.lineBits;
	for (let i = 0; i < addrs.length; i++) {
		const ln = addrs[i] >>> bits;
		const r = c1.touch(ln);
		const fa = shadow ? shadow.touch(ln) : false;
		let first = false;
		if (seen && !seen.has(ln)) {
			seen.add(ln);
			first = true;
		}
		let l2hit = false;
		if (!r.hit && c2) l2hit = c2.access(addrs[i]).hit;
		if (i < from) continue;
		t.accesses++;
		if (r.hit) t.hits++;
		else {
			t.misses++;
			if (classify) {
				if (first) t.compulsory++;
				else if (fa) t.conflict++;
				else t.capacity++;
			}
			if (l2hit) t.l2Hits++;
			else t.memory++;
		}
	}
	return t;
}

/** What one access did, for the animated lab. */
export interface Event {
	address: number;
	line: number;
	set: number;
	slot: number;
	kind: MissKind;
	/** The line thrown out to make room, or -1. */
	evicted: number;
}

export interface Replay {
	events: Event[];
	/** The line in every slot after each access: frame i is `slots.subarray(i * n, (i + 1) * n)`. */
	slots: Int32Array;
	sets: number;
	ways: number;
	/** Running totals after each access. */
	totals: Tally[];
}

/** Runs a short trace keeping every step, so the lab can draw the cache at any moment. */
export function replay(trace: Trace, config: CacheConfig, seed = 1): Replay {
	const c = new Cache(config, seed);
	const shadow = new Shadow(c.sets * c.ways);
	const seen = new Set<number>();
	const n = c.slots.length;
	const slots = new Int32Array(n * trace.addrs.length);
	const events: Event[] = [];
	const totals: Tally[] = [];
	const t: Tally = {
		accesses: 0,
		hits: 0,
		misses: 0,
		compulsory: 0,
		capacity: 0,
		conflict: 0,
		l2Hits: 0,
		memory: 0
	};
	trace.addrs.forEach((address, i) => {
		const line = address >>> c.lineBits;
		const r = c.touch(line);
		const fa = shadow.touch(line);
		const first = !seen.has(line);
		seen.add(line);
		const kind: MissKind = r.hit ? 'hit' : first ? 'compulsory' : fa ? 'conflict' : 'capacity';
		t.accesses++;
		if (kind === 'hit') t.hits++;
		else {
			t.misses++;
			t[kind]++;
			t.memory++;
		}
		totals.push({ ...t });
		events.push({ address, line, set: line % c.sets, slot: r.slot, kind, evicted: r.evicted });
		slots.set(c.slots, i * n);
	});
	return { events, slots, sets: c.sets, ways: c.ways, totals };
}

// ---- the page's experiments -------------------------------------------------------------------

const memo = new Map<string, unknown>();
function cached<T>(key: string, f: () => T): T {
	if (!memo.has(key)) memo.set(key, f());
	return memo.get(key) as T;
}

/** The toy lab: small enough to draw every element and every line of the cache. */
export const LAB = {
	sizes: [256, 512, 1024],
	lines: [16, 32, 64],
	ways: [1, 2, 4, 0]
} as const;

export type Pattern = 'row' | 'col' | 'list' | 'scattered' | 'matmul' | 'blocked' | 'dot' | 'loop';

export const PATTERNS: { value: Pattern; label: string }[] = [
	{ value: 'row', label: 'Sum a matrix row by row' },
	{ value: 'col', label: 'Sum it column by column' },
	{ value: 'list', label: 'Walk a list, nodes in order' },
	{ value: 'scattered', label: 'Walk a list, nodes scattered' },
	{ value: 'matmul', label: 'Multiply matrices' },
	{ value: 'blocked', label: 'Multiply matrices in tiles' },
	{ value: 'dot', label: 'a · b, b one cache size after a' },
	{ value: 'loop', label: 'Loop over one line too many' }
];

/** The lab's program for a pattern, sized for the lab's cache. */
export function labTrace(p: Pattern, config: CacheConfig): Trace {
	switch (p) {
		case 'row':
		case 'col':
			return matrixSum(16, p);
		case 'list':
		case 'scattered':
			return listWalk(128, p === 'scattered');
		case 'matmul':
			return matmul(8);
		case 'blocked':
			return matmul(8, 4);
		case 'dot':
			return dotProduct(32, config.size);
		case 'loop':
			return loop(config.size / config.line + 1, config.line, 4);
	}
}

export function labRun(p: Pattern, config: CacheConfig): { trace: Trace; replay: Replay } {
	const key = `lab:${p}:${config.size}:${config.line}:${config.ways}:${config.policy}`;
	return cached(key, () => {
		const trace = labTrace(p, config);
		return { trace, replay: replay(trace, config) };
	});
}

/** Programs at full size on the measured chip's L1 and L2 (the "same sums, different bills"). */
export const PROGRAMS = [
	{ id: 'row', label: 'sum, row by row', trace: () => matrixSum(1024, 'row') },
	{ id: 'col', label: 'sum, column by column', trace: () => matrixSum(1024, 'col') },
	{ id: 'list', label: 'list, nodes in order', trace: () => listWalk(1 << 18, false) },
	{ id: 'scattered', label: 'list, nodes scattered', trace: () => listWalk(1 << 18, true) }
] as const;

export function program(id: (typeof PROGRAMS)[number]['id'], withL2 = true) {
	return cached(`program:${id}:${withL2}`, () => {
		const p = PROGRAMS.find((q) => q.id === id)!;
		const trace = p.trace();
		const t = run(trace, L1, { l2: withL2 ? L2 : null, classify: false });
		return { tally: t, ops: trace.ops, amat: amat(t), cycles: amat(t) * t.accesses };
	});
}

/**
 * The matrix product: n = 120 on an L1 cut to 4 KB (8-way, 64-byte lines), an eighth of the
 * real one, so the run stays small enough to compute in a browser; misses go to memory. The
 * same happens with the real 32 KB L1 for matrices about 2.8 times wider.
 */
export const MATMUL = {
	n: 120,
	l1: { size: 4096, line: 64, ways: 8, policy: 'lru' } satisfies CacheConfig,
	blocks: [4, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60]
} as const;

export function matmulRun(block: number) {
	return cached(`matmul:${block}`, () => {
		const trace = matmul(MATMUL.n, block);
		const t = run(trace, MATMUL.l1, { classify: false });
		return { tally: t, ops: trace.ops, amat: amat(t), cycles: amat(t) * t.accesses };
	});
}

/** Working-set sizes for the latency curve: 1 KB to 8 MB in steps of √2. */
export const WORKING_SETS = Array.from(
	{ length: 27 },
	(_, k) => Math.round((1024 * Math.pow(2, k / 2)) / 64) * 64
);

/**
 * Mean cycles per load over a working set, second lap only (the first fills the caches), for
 * pointer chasing in a random cycle ('chase') or summing in order ('sum').
 */
export function workingSet(bytes: number, kind: 'chase' | 'sum', l2: CacheConfig | null) {
	const key = `ws:${bytes}:${kind}:${l2 ? l2.size : 0}`;
	return cached(key, () => {
		const trace = kind === 'chase' ? chase(bytes, 2) : sweepSum(bytes, 2);
		const t = run(trace, L1, { l2, from: trace.addrs.length / 2, classify: false });
		return amat(t);
	});
}

/** L2 sizes offered on the curve. */
export const L2_SIZES = [128, 256, 512, 1024, 2048].map((k) => k * 1024);
export const l2Config = (size: number): CacheConfig => ({ ...L2, size });

/** "32 KB", "1 MB", "256 B". */
export function bytes(n: number): string {
	if (n >= 1024 * 1024) return `${Number((n / 1024 / 1024).toPrecision(3))} MB`;
	if (n >= 1024) return `${Number((n / 1024).toPrecision(3))} KB`;
	return `${n} B`;
}
