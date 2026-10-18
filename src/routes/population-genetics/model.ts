/**
 * Population genetics of one gene with two alleles, A and a, in a diploid population of N
 * individuals (2N gene copies): the Wright–Fisher model with selection and dominance.
 *
 * Each generation:
 *   1. the newborns' genotypes AA, Aa and aa are counted (the simulated ones, not Hardy–Weinberg's);
 *   2. selection: each genotype leaves gametes in proportion to its count times its fitness,
 *        aa: 1      Aa: 1 + 2hs      AA: 1 + 2s
 *      so s is the advantage of one copy of A (the page's convention, as on the evolution page:
 *      a carrier of one copy has s more offspring, a carrier of two copies 2s more, when the
 *      effects add, h = ½); h is the dominance of A (0: recessive, ½: additive, 1: dominant);
 *   3. the next generation's N newborns each draw two gametes at random from that pool. This is
 *      random mating, and it makes the number of A copies exactly binomial, Bin(2N, p*), with p*
 *      the share of A among the gametes: the Wright–Fisher sampling that is genetic drift.
 *
 * With no selection (s = 0) step 2 changes nothing, and the only force left is the sampling of
 * step 3. With an infinite population step 3 changes nothing either, and the genotypes stay at
 * the Hardy–Weinberg proportions p², 2pq, q² with p fixed: the baseline.
 *
 * Every random draw comes from a seeded generator, so a run replays identically.
 */
import { rng } from '#lib/draw/math.ts';

export type Rand = () => number;

/**
 * A binomial draw Bin(n, p). Exact (inversion) whenever the expected count, or its complement, is
 * below 40, which covers every draw near loss or fixation; the normal approximation in the bulk,
 * where it is accurate to far better than the page can show.
 */
export function binomial(n: number, p: number, rand: Rand): number {
	if (n <= 0 || p <= 0) return 0;
	if (p >= 1) return n;
	if (p > 0.5) return n - binomial(n, 1 - p, rand);
	const mean = n * p;
	if (mean < 40) {
		// inversion: walk up the cumulative distribution from k = 0
		const q = 1 - p;
		const r = p / q;
		let prob = Math.pow(q, n);
		let cum = prob;
		const u = rand();
		let k = 0;
		while (u > cum && k < n) {
			prob *= (r * (n - k)) / (k + 1);
			cum += prob;
			k++;
		}
		return k;
	}
	// Box–Muller
	const u1 = Math.max(rand(), 1e-300);
	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
	const k = Math.round(mean + z * Math.sqrt(mean * (1 - p)));
	return Math.max(0, Math.min(n, k));
}

/** Fitness of the three genotypes for a per-copy advantage `s` and dominance `h`. */
export function fitness(s: number, h: number) {
	return { AA: 1 + 2 * s, Aa: 1 + 2 * h * s, aa: 1 };
}

export interface Genotypes {
	AA: number;
	Aa: number;
	aa: number;
}

/** Share of A among the gametes the genotypes leave after selection. */
export function gameteShare(g: Genotypes, s: number, h: number): number {
	const w = fitness(s, h);
	const a = g.AA * w.AA + 0.5 * g.Aa * w.Aa;
	const total = g.AA * w.AA + g.Aa * w.Aa + g.aa * w.aa;
	return total > 0 ? a / total : 0;
}

/** Hardy–Weinberg: the genotype shares that random mating makes from an allele share `p`. */
export function hardyWeinberg(p: number): Genotypes {
	const q = 1 - p;
	return { AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** The share of A among the gene copies of a set of genotypes (counts or shares). */
export function alleleShare(g: Genotypes): number {
	const total = g.AA + g.Aa + g.aa;
	return total > 0 ? (2 * g.AA + g.Aa) / (2 * total) : 0;
}

/** N newborns from a gamete pool with a share `p` of A: each draws two gametes at random. */
export function newborns(N: number, p: number, rand: Rand): Genotypes {
	const q = 1 - p;
	const AA = binomial(N, p * p, rand);
	const rest = 1 - p * p;
	const Aa = rest > 0 ? binomial(N - AA, (2 * p * q) / rest, rand) : 0;
	return { AA, Aa, aa: N - AA - Aa };
}

/** One generation: selection on the newborns `g`, then the next N newborns. */
export function nextGeneration(N: number, g: Genotypes, s: number, h: number, rand: Rand) {
	return newborns(N, gameteShare(g, s, h), rand);
}

/** One population followed generation by generation. */
export interface Trajectory {
	/** Share of A among the newborns of each generation, from generation 0. */
	p: number[];
	/** The newborns' genotype counts of each generation (only when asked for). */
	genotypes?: Genotypes[];
	/** The generation at which A was fixed (p = 1) or lost (p = 0), if it was. */
	fixedAt: number | null;
	lostAt: number | null;
}

export interface RunSettings {
	/** Individuals (2N gene copies). */
	N: number;
	/** Share of A in the first generation (rounded to whole copies). */
	p0: number;
	/** Advantage of one copy of A (negative: harmful). */
	s: number;
	/** Dominance of A: 0 recessive, ½ additive, 1 dominant. */
	h: number;
	generations: number;
	seed: number;
}

/**
 * Generation 0: newborns with ⌊2N·p0⌉ copies of A, in Hardy–Weinberg proportions as far as whole
 * individuals allow (a single copy sits in one heterozygote).
 */
export function founders(N: number, p0: number): Genotypes {
	const copies = Math.max(0, Math.min(2 * N, Math.round(2 * N * p0)));
	const AA = Math.min(Math.floor(copies / 2), Math.round(N * (copies / (2 * N)) ** 2));
	const Aa = copies - 2 * AA;
	return { AA, Aa, aa: N - AA - Aa };
}

function follow(o: RunSettings, rand: Rand, keepGenotypes: boolean): Trajectory {
	let g = founders(o.N, o.p0);
	const p = [alleleShare(g)];
	const genotypes = keepGenotypes ? [g] : undefined;
	let fixedAt: number | null = p[0] === 1 ? 0 : null;
	let lostAt: number | null = p[0] === 0 ? 0 : null;
	for (let t = 1; t <= o.generations; t++) {
		if (fixedAt === null && lostAt === null) {
			g = nextGeneration(o.N, g, o.s, o.h, rand);
			const share = alleleShare(g);
			if (share === 1) fixedAt = t;
			if (share === 0) lostAt = t;
		}
		p.push(alleleShare(g));
		genotypes?.push(g);
	}
	return { p, genotypes, fixedAt, lostAt };
}

/** One population, with its genotype counts each generation. */
export function runOne(o: RunSettings): Trajectory {
	return follow(o, rng(o.seed), true);
}

/** `count` independent populations with the same settings, from one seed. */
export function runMany(o: RunSettings, count: number): Trajectory[] {
	const rand = rng(o.seed);
	return Array.from({ length: count }, () => follow(o, rand, false));
}

/** Infinite population: selection alone, generation by generation (Hardy–Weinberg newborns). */
export function deterministic(p0: number, s: number, h: number, generations: number): number[] {
	const out = [p0];
	let p = p0;
	for (let t = 0; t < generations; t++) {
		p = gameteShare(hardyWeinberg(p), s, h);
		out.push(p);
	}
	return out;
}

/** Heterozygosity of a population: the chance that two gene copies drawn from it differ, 2pq. */
export const heterozygosity = (p: number) => 2 * p * (1 - p);

export interface MutationFates {
	trials: number;
	fixed: number;
	lost: number;
	/** Still present, at neither 0 nor 2N, after `maxGenerations`. */
	drifting: number;
	/** Copies of A each generation, for the first `keep` new mutations, until fixed or lost. */
	shown: { copies: number[]; fate: 'fixed' | 'lost' | 'drifting' }[];
}

/**
 * The fate of `trials` new mutations: each starts as one copy in one heterozygote, in a population
 * of N, and is followed until it is fixed or lost (or `maxGenerations` pass).
 */
export function mutationFates(
	N: number,
	s: number,
	h: number,
	trials: number,
	seed: number,
	keep = 100,
	maxGenerations = 6000
): MutationFates {
	const rand = rng(seed);
	const out: MutationFates = { trials, fixed: 0, lost: 0, drifting: 0, shown: [] };
	for (let i = 0; i < trials; i++) {
		let g: Genotypes = { AA: 0, Aa: 1, aa: N - 1 };
		const copies = i < keep ? [1] : null;
		let fate: 'fixed' | 'lost' | 'drifting' = 'drifting';
		for (let t = 1; t <= maxGenerations; t++) {
			g = nextGeneration(N, g, s, h, rand);
			const c = 2 * g.AA + g.Aa;
			copies?.push(c);
			if (c === 0) {
				fate = 'lost';
				break;
			}
			if (c === 2 * N) {
				fate = 'fixed';
				break;
			}
		}
		out[fate]++;
		if (copies) out.shown.push({ copies, fate });
	}
	return out;
}

/**
 * Kimura's diffusion result for the chance that A, at share `p`, is eventually fixed:
 *   u(p) = ∫₀ᵖ G / ∫₀¹ G,  G(x) = exp(−∫₀ˣ 2M/V),
 * with the mean change per generation M(x) = x(1−x)·2s·(h + (1−2h)x) of the fitnesses above and the
 * drift variance V(x) = x(1−x)/2N, so G(x) = exp(−8Nhs·x − 4Ns(1−2h)·x²). For h = ½ it is the
 * closed form (1 − e^(−4Nsp)) / (1 − e^(−4Ns)); for s = 0 it is p. Integrated numerically on a grid
 * that is fine near both ends, where G can change over a few hundred-thousandths.
 */
export function fixationChance(N: number, s: number, h: number, p: number): number {
	if (p <= 0) return 0;
	if (p >= 1) return 1;
	if (s === 0) return p;
	const a = 8 * N * h * s;
	const b = 4 * N * s * (1 - 2 * h);
	const f = (x: number) => -(a * x + b * x * x);
	// breakpoints: geometric towards 0 and towards 1, plus p itself
	const pts = new Set<number>([0, 1, p]);
	for (let d = 1e-8; d < 0.5; d *= 1.08) {
		pts.add(d);
		pts.add(1 - d);
	}
	pts.add(0.5);
	const xs = [...pts].sort((x, y) => x - y);
	const SUB = 8;
	// log-scale shift so the exponentials cannot overflow
	let top = -Infinity;
	for (const x of xs) top = Math.max(top, f(x));
	const vertex = b !== 0 ? -a / (2 * b) : NaN;
	if (vertex > 0 && vertex < 1) top = Math.max(top, f(vertex));
	const G = (x: number) => Math.exp(f(x) - top);
	let below = 0;
	let total = 0;
	for (let i = 0; i + 1 < xs.length; i++) {
		const x0 = xs[i];
		const x1 = xs[i + 1];
		const step = (x1 - x0) / SUB;
		let sum = G(x0) + G(x1);
		for (let k = 1; k < SUB; k++) sum += (k % 2 === 1 ? 4 : 2) * G(x0 + k * step);
		const part = (sum * step) / 3;
		total += part;
		if (x1 <= p) below += part;
	}
	return total > 0 ? below / total : p;
}

/** The chance that one new copy of A (share 1/2N) is eventually fixed. */
export const newMutationFixes = (N: number, s: number, h: number) =>
	fixationChance(N, s, h, 1 / (2 * N));
