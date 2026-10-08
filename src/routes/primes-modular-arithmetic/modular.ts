/**
 * Primes and clock (modular) arithmetic: the sieve of Eratosthenes, divisors
 * and prime factorisations, arithmetic on a clock of m hours, and powers on
 * that clock — computed fast by square-and-multiply, and reversed only by
 * search (the discrete logarithm).
 *
 * Everything here is exact integer arithmetic. Simplifications, stated on the
 * page:
 * - The clock's top hour is written 0 (where a wall clock writes 12), so the
 *   hours of an m-hour clock are 0, 1, …, m − 1.
 * - The sieve strikes every multiple 2p, 3p, … of each prime p (already-struck
 *   numbers are struck again but keep their first colour); the faster textbook
 *   version starts at p², which the page mentions.
 * - Reversing a power is shown by plain trial (x = 0, 1, 2, …). Cleverer
 *   algorithms exist (baby-step giant-step, index calculus, the number field
 *   sieve) and are far faster than trial, but none known is fast enough for the
 *   2048-bit primes used in practice; the page says so rather than implying
 *   trial is the best attack.
 * - Numbers on the page are small (clocks up to 31 hours, the prime 101), so
 *   plain JavaScript numbers are exact here (products stay below 2⁵³).
 */

/** a mod m in 0 … m − 1, also for negative a. */
export const mod = (a: number, m: number) => ((a % m) + m) % m;

export function gcd(a: number, b: number): number {
	a = Math.abs(a);
	b = Math.abs(b);
	while (b) [a, b] = [b, a % b];
	return a;
}

/** All divisors of n ≥ 1, in increasing order. */
export function divisors(n: number): number[] {
	const small: number[] = [];
	const large: number[] = [];
	for (let d = 1; d * d <= n; d++) {
		if (n % d === 0) {
			small.push(d);
			if (d * d !== n) large.unshift(n / d);
		}
	}
	return [...small, ...large];
}

/** A whole number above 1 whose only divisors are 1 and itself. */
export const isPrime = (n: number) => n > 1 && divisors(n).length === 2;

/** Prime factorisation of n ≥ 2 as [prime, exponent] pairs, smallest prime first. */
export function factorize(n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let p = 2; p * p <= n; p++) {
		let e = 0;
		while (n % p === 0) {
			n /= p;
			e++;
		}
		if (e) out.push([p, e]);
	}
	if (n > 1) out.push([n, 1]);
	return out;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** Unicode superscript of a non-negative integer. */
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((d) => SUP[+d])
		.join('');

/** "2² × 3 × 5" for 60; "7" for 7. */
export const factorText = (n: number) =>
	factorize(n)
		.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : `${p}`))
		.join(' × ');

// ---------------------------------------------------------------- the sieve

export interface SieveStage {
	/** The prime whose multiples are struck at this stage. */
	prime: number;
	/** All its multiples 2p, 3p, … ≤ n. */
	multiples: number[];
	/** The multiples not struck by an earlier stage. */
	fresh: number[];
}

export interface Sieve {
	n: number;
	/** The stages, one per prime p with p² ≤ n. */
	stages: SieveStage[];
	/**
	 * The next prime after the last stage. Its first multiple not already struck
	 * would be its own square, which is above n — so the sieve can stop.
	 */
	stopPrime: number;
	/** For each k ≤ n, the prime whose stage struck it first (0 if never struck). */
	struckBy: number[];
	/** The numbers left unstruck, other than 1: the primes ≤ n. */
	primes: number[];
}

/**
 * The sieve of Eratosthenes up to n: take the smallest number not yet struck
 * (it is prime), strike all its multiples, repeat. Once the next prime p has
 * p² > n, every number still standing is prime.
 */
export function sieve(n: number): Sieve {
	const struckBy = new Array<number>(n + 1).fill(0);
	const stages: SieveStage[] = [];
	let p = 2;
	for (; p * p <= n; p++) {
		if (struckBy[p]) continue;
		const multiples: number[] = [];
		const fresh: number[] = [];
		for (let k = 2 * p; k <= n; k += p) {
			multiples.push(k);
			if (!struckBy[k]) {
				struckBy[k] = p;
				fresh.push(k);
			}
		}
		stages.push({ prime: p, multiples, fresh });
	}
	while (struckBy[p] || !isPrime(p)) p++;
	const primes: number[] = [];
	for (let k = 2; k <= n; k++) if (!struckBy[k]) primes.push(k);
	return { n, stages, stopPrime: p, struckBy, primes };
}

/**
 * The state of the grid after the first `done` stages: for each k, the prime
 * that struck it (0 if still standing).
 */
export function struckAfter(s: Sieve, done: number): number[] {
	const out = new Array<number>(s.n + 1).fill(0);
	for (const st of s.stages.slice(0, done)) for (const k of st.fresh) out[k] = st.prime;
	return out;
}

// ---------------------------------------------------------------- the clock

/** Positions passed when adding a + b on an m-hour clock, starting from 0. */
export function addOnClock(a: number, b: number, m: number) {
	const total = a + b;
	return { total, laps: Math.floor(total / m), result: mod(total, m) };
}

/**
 * a × b as b hops of a hours each, from 0: the hours landed on after each hop
 * (b + 1 entries, starting with 0).
 */
export function multiplyHops(a: number, b: number, m: number): number[] {
	const out = [0];
	for (let i = 1; i <= b; i++) out.push(mod(out[i - 1] + a, m));
	return out;
}

export interface TimesMap {
	/** image[k] = a·k mod m for every hour k. */
	image: number[];
	/** Hours that some k lands on, in increasing order. */
	reached: number[];
	/** True if ×a lands on every hour exactly once (a shuffle), so it can be undone. */
	shuffles: boolean;
	/** The b with a·b ≡ 1 (mod m), if any: dividing by a is multiplying by it. */
	inverse: number | null;
	/** The smallest k ≠ 0 with a·k ≡ 0 although neither is 0 (mod m), if any. */
	zeroPartner: number | null;
}

/** Multiplying every hour of an m-hour clock by a. */
export function timesMap(a: number, m: number): TimesMap {
	const image = Array.from({ length: m }, (_, k) => mod(a * k, m));
	const reached = [...new Set(image)].sort((x, y) => x - y);
	let inverse: number | null = null;
	for (let b = 1; b < m && inverse === null; b++) if (mod(a * b, m) === 1 % m) inverse = b;
	let zeroPartner: number | null = null;
	if (mod(a, m) !== 0)
		for (let k = 1; k < m && zeroPartner === null; k++) if (mod(a * k, m) === 0) zeroPartner = k;
	return { image, reached, shuffles: reached.length === m, inverse, zeroPartner };
}

/** Multipliers 1 … m − 1 that shuffle the clock (exactly those with gcd(a, m) = 1). */
export const shufflers = (m: number) =>
	Array.from({ length: m - 1 }, (_, i) => i + 1).filter((a) => timesMap(a, m).shuffles);

export interface PowerWalk {
	/** g⁰, g¹, g², … mod m, up to and including the first repeated value. */
	seq: number[];
	/** Index in `seq` where the repeat cycle starts (seq[last] === seq[cycleStart]). */
	cycleStart: number;
	/** Length of the repeating cycle. */
	cycleLength: number;
	/** True if the powers come back to 1 (always when gcd(g, m) = 1). */
	returnsToOne: boolean;
	/** Distinct hours visited. */
	visited: number;
}

/** The powers of g on an m-hour clock, from g⁰ = 1, until they repeat. */
export function powerWalk(g: number, m: number): PowerWalk {
	const seq: number[] = [mod(1, m)];
	const seen = new Map<number, number>([[seq[0], 0]]);
	for (;;) {
		const next = mod(seq[seq.length - 1] * g, m);
		seq.push(next);
		const at = seen.get(next);
		if (at !== undefined) {
			return {
				seq,
				cycleStart: at,
				cycleLength: seq.length - 1 - at,
				returnsToOne: at === 0,
				visited: seen.size
			};
		}
		seen.set(next, seq.length - 1);
	}
}

/** Multiplicative order of g mod m (smallest k ≥ 1 with gᵏ ≡ 1), or null if none. */
export function order(g: number, m: number): number | null {
	const w = powerWalk(g, m);
	return w.returnsToOne ? w.cycleLength : null;
}

/** g is a primitive root mod a prime p if its powers visit all p − 1 nonzero hours. */
export const isPrimitiveRoot = (g: number, p: number) => order(g, p) === p - 1;

// ---------------------------------------------------------------- fast powers

export interface LadderRung {
	/** k: this rung holds g^(2^k). */
	k: number;
	/** 2^k. */
	power: number;
	/** g^(2^k) mod m, found by squaring the rung below. */
	value: number;
	/** The square before reducing (rung below squared), or g on rung 0. */
	raw: number;
	/** True if bit k of the exponent is 1, so this rung is multiplied in. */
	used: boolean;
	/** The running product after this rung, mod m. */
	running: number;
}

export interface FastPower {
	result: number;
	rungs: LadderRung[];
	squarings: number;
	multiplications: number;
	/** squarings + multiplications. */
	total: number;
	/** Multiplications needed by multiplying g in one at a time (x − 1). */
	naive: number;
}

/**
 * gˣ mod m by square-and-multiply: square repeatedly to get g, g², g⁴, g⁸, …
 * (each reduced mod m), then multiply together the rungs whose bit is set in
 * the binary form of x. Counts: (bits − 1) squarings, (ones − 1)
 * multiplications.
 */
export function fastPower(g: number, x: number, m: number): FastPower {
	const rungs: LadderRung[] = [];
	const bits = x.toString(2).length;
	let running = -1;
	let multiplications = 0;
	for (let k = 0; k < bits; k++) {
		const raw = k === 0 ? g : rungs[k - 1].value * rungs[k - 1].value;
		const value = mod(raw, m);
		const used = ((x >> k) & 1) === 1;
		if (used) {
			if (running < 0) running = value;
			else {
				running = mod(running * value, m);
				multiplications++;
			}
		}
		rungs.push({ k, power: 2 ** k, value, raw, used, running: running < 0 ? 1 : running });
	}
	const squarings = bits - 1;
	return {
		result: x === 0 ? mod(1, m) : running,
		rungs,
		squarings,
		multiplications,
		total: squarings + multiplications,
		naive: Math.max(0, x - 1)
	};
}

/** gˣ mod m the slow way, one multiplication at a time (for checking). */
export function slowPower(g: number, x: number, m: number) {
	let r = mod(1, m);
	for (let i = 0; i < x; i++) r = mod(r * g, m);
	return r;
}

/** Most multiplications square-and-multiply needs for an exponent of `bits` bits. */
export const fastCostMax = (bits: number) => 2 * (bits - 1);

/**
 * Reversing a power by trial: x = 0, 1, 2, … until gˣ ≡ y (mod m). Returns the
 * x found (or null) and the number of exponents tried.
 */
export function discreteLog(g: number, y: number, m: number) {
	let v = mod(1, m);
	for (let x = 0; x < m; x++) {
		if (v === mod(y, m)) return { x, tries: x + 1 };
		v = mod(v * g, m);
	}
	return { x: null, tries: m };
}

/** Number of decimal digits of 2^bits (exactly, via log10). */
export const digitsOfPowerOfTwo = (bits: number) => Math.floor(bits * Math.log10(2)) + 1;
