/**
 * Evolution by natural selection, as population-genetics simulations.
 *
 * 1. `runMoths`: an individual-based Wright–Fisher model of a sexual, diploid
 *    population of N moths whose wing shade is set by LOCI genes, each with a
 *    pale (0) and a dark (1) allele, adding up (shade = dark alleles / 2·LOCI).
 *    Every generation:
 *      a. viability selection: each moth survives the birds with probability
 *         1 − P·|shade − bark| (P: how hard the birds hunt; bark 0 = pale,
 *         1 = sooty), so a moth that matches its bark is never singled out;
 *      b. reproduction: N offspring, each from two parents drawn at random
 *         among the survivors (the population is regulated back to N). Each
 *         parent passes one allele of every gene, picked at random (the genes
 *         sit on different chromosomes: independent assortment, as in
 *         meiosis-inheritance);
 *      c. mutation: every allele of every offspring flips with probability μ.
 *         `mutate` is not told the environment: mutation is blind to need.
 *    Three switches remove one of Darwin's ingredients each: `variation`
 *    (everyone starts identical and nothing mutates), `inheritance` (each
 *    offspring's genes are drawn afresh from the founding population's allele
 *    frequency, ignoring its parents) and `selection` (everyone survives with
 *    the same, average probability).
 *
 * 2. `wfStep` / `fateOfMutation` / `driftRuns`: the classic one-gene
 *    Wright–Fisher model: 2N gene copies; each generation the next 2N copies
 *    are a binomial sample of the selected frequency p' = p(1 + s)/(1 + p·s)
 *    (genic selection: a copy of the allele leaves 1 + s times as many
 *    copies, so a heterozygote has fitness 1 + s and a homozygote ≈ 1 + 2s).
 *    Kimura's diffusion result for one new copy: u = (1 − e^(−2s))/(1 − e^(−4Ns)),
 *    ≈ 2s for a beneficial allele (Haldane 1927) and → 1/2N as s → 0.
 *
 * 3. `fluctuation`: the Luria–Delbrück (1943) fluctuation test. Cultures grow
 *    by synchronous doublings; under the random-mutation hypothesis each
 *    division mutates to resistance with probability μ and the mutant's
 *    descendants keep doubling; under the induced hypothesis each cell exposed
 *    to the virus turns resistant with a fixed probability, chosen to give the
 *    same mean (a Poisson count).
 *
 * 4. `runPlate`: the MEGA-plate of Baym et al. (2016) as a line of patches of
 *    agar, each with a carrying capacity K, in bands of antibiotic. Bacteria
 *    are haploid and clonal, in resistance classes k = 0…4 tolerating up to
 *    10^k times the wild type's MIC (each class one mutation further); a cell
 *    grows (logistically, one doubling per generation when there is room)
 *    only where the drug is below its MIC, and dies elsewhere. Cells move to
 *    neighbouring patches; each birth mutates to the next class with
 *    probability μ (a Poisson number of mutants). Below one cell a class is
 *    kept or lost at random, so a patch never holds a fraction of a cell.
 *
 * 5. `dominantSelection`: deterministic selection on one gene with a dominant
 *    allele (the peppered moth's carbonaria), one generation a year.
 */
import { rng as seeded } from '#lib/draw/math.ts';

export type Rand = () => number;
export const rng = seeded;

// ------------------------------------------------------------------ samplers

/** Poisson-distributed count with mean `lambda` (inversion; normal approximation above 40). */
export function poisson(lambda: number, rand: Rand): number {
	if (!(lambda > 0)) return 0;
	if (lambda > 40) {
		return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rand)));
	}
	const L = Math.exp(-lambda);
	let k = 0;
	let p = rand();
	while (p > L) {
		k++;
		p *= rand();
	}
	return k;
}

/** Standard normal deviate (Box–Muller). */
export function gauss(rand: Rand): number {
	const u = Math.max(rand(), 1e-12);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Binomial(n, p) count: exact (inversion of the CDF) while the expected count
 * of the rarer outcome is small, normal approximation otherwise. The fate of a
 * rare allele is decided while its count is small, where the draw is exact.
 */
export function binomial(n: number, p: number, rand: Rand): number {
	if (p <= 0 || n <= 0) return 0;
	if (p >= 1) return n;
	if (p > 0.5) return n - binomial(n, 1 - p, rand);
	const mean = n * p;
	if (mean > 30) {
		const sd = Math.sqrt(mean * (1 - p));
		return Math.min(n, Math.max(0, Math.round(mean + sd * gauss(rand))));
	}
	// Inversion: walk up the CDF from k = 0.
	const q = p / (1 - p);
	let prob = Math.pow(1 - p, n);
	let cdf = prob;
	const u = rand();
	let k = 0;
	while (u > cdf && k < n) {
		prob *= (q * (n - k)) / (k + 1);
		k++;
		cdf += prob;
	}
	return k;
}

// ------------------------------------------------------------------- moths

/** Genes adding up to the wing shade; 2 × LOCI + 1 possible shades. */
export const LOCI = 6;
export const SHADES = 2 * LOCI + 1;
/** Dark-allele frequency of the founding population (mostly pale moths). */
export const FOUNDING_DARK = 0.2;
/** How many moths of each generation the scene draws (and records in detail). */
export const SAMPLE = 100;

export interface MothSettings {
	/** Population size (constant: Wright–Fisher). */
	N: number;
	/** Chance that an allele flips in an offspring, per gene per generation. */
	mu: number;
	/** How hard the birds hunt: a moth of the opposite shade to the bark survives 1 − P as often. */
	predation: number;
	/** Bark shade in generation g (0 pale with lichen, 1 black with soot). */
	bark: (g: number) => number;
	generations: number;
	seed: number;
	variation?: boolean;
	inheritance?: boolean;
	selection?: boolean;
	/** Dark-allele frequency at the start (default FOUNDING_DARK). */
	founding?: number;
}

export interface MothGeneration {
	g: number;
	bark: number;
	/** Moths of each shade class (0 … 2·LOCI dark alleles) before the birds. */
	hist: number[];
	/** … and among the survivors. */
	survivorHist: number[];
	survivors: number;
	/** Mean shade (0–1) before the birds, and of the survivors. */
	mean: number;
	survivorMean: number;
	/** Shade class of the first SAMPLE moths, and whether each survived. */
	sample: number[];
	survived: boolean[];
	/** For the first SAMPLE moths: the shade classes of their two parents (−1 in generation 0). */
	parents: [number, number][];
	/** Dark-allele frequency (0–1). */
	darkAlleles: number;
	extinct: boolean;
}

/** Survival probability of a moth of shade z (0–1) on bark b with predation P. */
export function mothSurvival(z: number, bark: number, predation: number): number {
	return 1 - predation * Math.abs(z - bark);
}

/**
 * Mutation: each allele flips with probability μ. It is given the genome and
 * the rate only, never the environment: what a mutation does is not steered
 * by what would help. Returns how many alleles turned dark and how many pale.
 */
export function mutate(
	genome: Uint8Array,
	mu: number,
	rand: Rand
): { toDark: number; toPale: number } {
	let toDark = 0;
	let toPale = 0;
	if (mu <= 0) return { toDark, toPale };
	for (let i = 0; i < genome.length; i++) {
		if (rand() < mu) {
			genome[i] ^= 1;
			if (genome[i]) toDark++;
			else toPale++;
		}
	}
	return { toDark, toPale };
}

function shadeClass(genome: Uint8Array, i: number): number {
	let c = 0;
	const o = i * 2 * LOCI;
	for (let k = 0; k < 2 * LOCI; k++) c += genome[o + k];
	return c;
}

/** Runs the moth population for `generations` generations (record 0 is the founders). */
export function runMoths(set: MothSettings): MothGeneration[] {
	const { N, predation, generations } = set;
	const variation = set.variation ?? true;
	const inheritance = set.inheritance ?? true;
	const selection = set.selection ?? true;
	const mu = variation ? set.mu : 0;
	const founding = set.founding ?? FOUNDING_DARK;
	const rand = rng(set.seed);
	const G = 2 * LOCI;
	let genome = new Uint8Array(N * G);
	if (variation) {
		for (let i = 0; i < genome.length; i++) genome[i] = rand() < founding ? 1 : 0;
	} else {
		// Everyone identical: the shade nearest the founding mean, the same in every moth.
		const dark = Math.round(founding * G);
		for (let i = 0; i < N; i++) for (let k = 0; k < G; k++) genome[i * G + k] = k < dark ? 1 : 0;
	}
	let parentsOf: [number, number][] = Array.from({ length: Math.min(N, SAMPLE) }, () => [-1, -1]);
	const out: MothGeneration[] = [];
	const classes = new Int32Array(N);
	const alive = new Uint8Array(N);

	for (let g = 0; g <= generations; g++) {
		const bark = set.bark(g);
		const hist = new Array<number>(SHADES).fill(0);
		const survivorHist = new Array<number>(SHADES).fill(0);
		let sum = 0;
		for (let i = 0; i < N; i++) {
			classes[i] = shadeClass(genome, i);
			hist[classes[i]]++;
			sum += classes[i];
		}
		const dark = sum / (N * G);
		// a. the birds
		let meanSurvival = 0;
		if (!selection) {
			for (let i = 0; i < N; i++) meanSurvival += mothSurvival(classes[i] / G, bark, predation);
			meanSurvival /= N;
		}
		const survivors: number[] = [];
		let sSum = 0;
		for (let i = 0; i < N; i++) {
			const w = selection ? mothSurvival(classes[i] / G, bark, predation) : meanSurvival;
			alive[i] = rand() < w ? 1 : 0;
			if (alive[i]) {
				survivors.push(i);
				survivorHist[classes[i]]++;
				sSum += classes[i];
			}
		}
		const n = Math.min(N, SAMPLE);
		out.push({
			g,
			bark,
			hist,
			survivorHist,
			survivors: survivors.length,
			mean: sum / (N * G),
			survivorMean: survivors.length ? sSum / (survivors.length * G) : 0,
			sample: Array.from(classes.subarray(0, n)),
			survived: Array.from(alive.subarray(0, n), (a) => a === 1),
			parents: parentsOf,
			darkAlleles: dark,
			extinct: false
		});
		if (g === generations) break;
		if (survivors.length === 0) {
			// Nobody left to breed: the record stays empty from here on.
			for (let k = g + 1; k <= generations; k++) {
				out.push({
					g: k,
					bark: set.bark(k),
					hist: new Array<number>(SHADES).fill(0),
					survivorHist: new Array<number>(SHADES).fill(0),
					survivors: 0,
					mean: NaN,
					survivorMean: NaN,
					sample: [],
					survived: [],
					parents: [],
					darkAlleles: NaN,
					extinct: true
				});
			}
			break;
		}
		// b. the next generation
		const next = new Uint8Array(N * G);
		const nextParents: [number, number][] = [];
		for (let j = 0; j < N; j++) {
			const a = survivors[Math.floor(rand() * survivors.length)];
			const b = survivors[Math.floor(rand() * survivors.length)];
			if (j < n) nextParents.push([classes[a], classes[b]]);
			const o = j * G;
			for (let k = 0; k < LOCI; k++) {
				if (inheritance) {
					// One allele of gene k from each parent, each picked at random.
					next[o + 2 * k] = genome[a * G + 2 * k + (rand() < 0.5 ? 0 : 1)];
					next[o + 2 * k + 1] = genome[b * G + 2 * k + (rand() < 0.5 ? 0 : 1)];
				} else {
					next[o + 2 * k] = rand() < founding ? 1 : 0;
					next[o + 2 * k + 1] = rand() < founding ? 1 : 0;
				}
			}
		}
		// c. mutation
		mutate(next, mu, rand);
		genome = next;
		parentsOf = nextParents;
	}
	return out;
}

// --------------------------------------------------------- one-gene Wright–Fisher

/** One Wright–Fisher generation: the number of copies (of 2N) of an allele with advantage s. */
export function wfStep(count: number, twoN: number, s: number, rand: Rand): number {
	const p = count / twoN;
	const ps = (p * (1 + s)) / (1 + p * s);
	return binomial(twoN, ps, rand);
}

/** Kimura's probability that one new copy of an allele with advantage s fixes in a population of N. */
export function kimuraFixation(N: number, s: number): number {
	if (Math.abs(s) < 1e-9) return 1 / (2 * N);
	return (1 - Math.exp(-2 * s)) / (1 - Math.exp(-4 * N * s));
}

export interface Trajectory {
	/** Frequency of the allele in each generation, until it was lost or fixed (inclusive). */
	p: number[];
	fixed: boolean;
	lost: boolean;
}

/** Follows one allele from `count` copies until it is lost or fixed, or `maxGen` generations pass. */
export function trajectory(
	N: number,
	s: number,
	count: number,
	maxGen: number,
	rand: Rand
): Trajectory {
	const twoN = 2 * N;
	const p = [count / twoN];
	let c = count;
	for (let g = 0; g < maxGen && c > 0 && c < twoN; g++) {
		c = wfStep(c, twoN, s, rand);
		p.push(c / twoN);
	}
	return { p, fixed: c === twoN, lost: c === 0 };
}

export interface Fates {
	trials: number;
	fixed: number;
	lost: number;
	/** The first few trajectories, for drawing. */
	shown: Trajectory[];
}

/** Introduces one new copy `trials` times and counts how often it fixes. */
export function fateOfMutation(
	N: number,
	s: number,
	trials: number,
	seed: number,
	keep = 60,
	maxGen = 100000
): Fates {
	const rand = rng(seed);
	let fixed = 0;
	let lost = 0;
	const shown: Trajectory[] = [];
	for (let i = 0; i < trials; i++) {
		const tr = trajectory(N, s, 1, maxGen, rand);
		if (tr.fixed) fixed++;
		if (tr.lost) lost++;
		if (i < keep) shown.push(tr);
	}
	return { trials, fixed, lost, shown };
}

/** `runs` neutral populations from frequency p0, for `generations` generations. */
export function driftRuns(
	N: number,
	p0: number,
	runs: number,
	generations: number,
	seed: number
): Trajectory[] {
	const rand = rng(seed);
	const out: Trajectory[] = [];
	for (let r = 0; r < runs; r++) {
		const tr = trajectory(N, 0, Math.round(p0 * 2 * N), generations, rand);
		out.push(tr);
	}
	return out;
}

// --------------------------------------------------------------- Luria–Delbrück

/** Cells per culture at the end (0.2 ml at 10⁸ cells per ml, as Luria and Delbrück). */
export const LD_FINAL = 2e7;
/** Doublings from the inoculum to LD_FINAL (an inoculum of about 600 cells). */
export const LD_DOUBLINGS = 15;
/** Mutation rate to resistance per cell per division (Luria & Delbrück's order of magnitude). */
export const LD_MU = 3e-8;

export interface FluctuationResult {
	counts: number[];
	mean: number;
	variance: number;
	zeros: number;
}

export function summary(counts: number[]): FluctuationResult {
	const n = counts.length;
	const mean = counts.reduce((s, c) => s + c, 0) / n;
	const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / (n - 1);
	return { counts, mean, variance, zeros: counts.filter((c) => c === 0).length };
}

/** Resistant cells in one culture if mutations happen at random during its growth. */
export function growCulture(rand: Rand, mu = LD_MU, doublings = LD_DOUBLINGS, final = LD_FINAL) {
	const start = final / 2 ** doublings;
	let resistant = 0;
	for (let g = 0; g < doublings; g++) {
		const dividing = start * 2 ** g - resistant;
		resistant *= 2;
		// A mutation in a division makes one resistant daughter.
		resistant += poisson(mu * dividing, rand);
	}
	return resistant;
}

/** Expected resistant cells per culture under random mutation: μ · doublings · final / 2. */
export const ldMean = (mu = LD_MU, doublings = LD_DOUBLINGS, final = LD_FINAL) =>
	(mu * doublings * final) / 2;

/**
 * The fluctuation test: resistant counts in `cultures` separate cultures, under
 * random mutation during growth ('random') or resistance caused by the virus
 * itself ('induced': each cell turns resistant with the same small chance, so
 * the count is Poisson with the same mean).
 */
export function fluctuation(
	hypothesis: 'random' | 'induced',
	cultures: number,
	seed: number,
	mu = LD_MU
): FluctuationResult {
	const rand = rng(seed);
	const counts: number[] = [];
	for (let c = 0; c < cultures; c++) {
		counts.push(hypothesis === 'random' ? growCulture(rand, mu) : poisson(ldMean(mu), rand));
	}
	return summary(counts);
}

// ------------------------------------------------------------------ MEGA-plate

/** Resistance classes: class k tolerates up to 10^k times the wild type's MIC. */
export const CLASSES = 5;
/** The drug bands of Baym et al.'s trimethoprim plate, in multiples of the wild type's MIC. */
export const BANDS = [0, 3, 30, 300, 3000];
export const PATCHES_PER_BAND = 3;

export interface PlateSettings {
	/** Cells a patch holds when full. */
	K: number;
	/** Chance that a division gives a mutant one class more resistant. */
	mu: number;
	/** false: no intermediate bands, the drug jumps from 0 to the top dose. */
	intermediate: boolean;
	generations: number;
	seed: number;
	/** Share of a patch's cells moving to each neighbour per generation. */
	migration?: number;
	/** Record a snapshot every `every` generations. */
	every?: number;
}

export interface PlateRun {
	/** Drug in each patch (× MIC), left to right: 0 … top … 0. */
	drug: number[];
	/** snapshots[i][patch][class] = cells, at generation i·every. */
	snapshots: number[][][];
	every: number;
	/** Highest class present in each snapshot. */
	best: number[];
	/** Generation at which each class first appeared (−1: never). */
	firstSeen: number[];
}

/** Drug level in each patch of the symmetric plate (drug-free at both ends, top dose in the middle). */
export function plateDrug(intermediate: boolean): number[] {
	const half = intermediate ? BANDS : BANDS.map((b, i) => (i === BANDS.length - 1 ? b : 0));
	const bands = [...half, ...half.slice(0, -1).reverse()];
	return bands.flatMap((b) => Array<number>(PATCHES_PER_BAND).fill(b));
}

export const mic = (k: number) => 10 ** k;

export function runPlate(set: PlateSettings): PlateRun {
	const { K, mu, generations } = set;
	const m = set.migration ?? 0.1;
	const every = set.every ?? 4;
	const rand = rng(set.seed);
	const drug = plateDrug(set.intermediate);
	const P = drug.length;
	let n: number[][] = drug.map(() => new Array<number>(CLASSES).fill(0));
	// Inoculate the drug-free patch at each end.
	n[0][0] = K;
	n[P - 1][0] = K;
	const snapshots: number[][][] = [];
	const best: number[] = [];
	const firstSeen = new Array<number>(CLASSES).fill(-1);
	firstSeen[0] = 0;
	const record = () => {
		snapshots.push(n.map((row) => row.slice()));
		let b = 0;
		for (const row of n) for (let k = 0; k < CLASSES; k++) if (row[k] > 0) b = Math.max(b, k);
		best.push(b);
	};
	record();
	for (let g = 1; g <= generations; g++) {
		// Growth, death and mutation in each patch.
		const grown = n.map((row, i) => {
			const total = row.reduce((s, x) => s + x, 0);
			const room = Math.max(0, 1 - total / K);
			const next = row.slice();
			for (let k = 0; k < CLASSES; k++) {
				if (row[k] <= 0) continue;
				if (mic(k) > drug[i]) {
					const births = row[k] * room;
					next[k] += births;
					if (k + 1 < CLASSES && births > 0) {
						const mutants = Math.min(births, poisson(mu * births, rand));
						next[k] -= mutants;
						next[k + 1] += mutants;
					}
				} else {
					next[k] = row[k] * 0.5; // the drug kills half of them each generation
				}
			}
			return next;
		});
		// Movement to the neighbouring patches.
		n = grown.map((row, i) =>
			row.map((x, k) => {
				const left = i > 0 ? grown[i - 1][k] : 0;
				const right = i < P - 1 ? grown[i + 1][k] : 0;
				const stays = x * (1 - (i > 0 ? m : 0) - (i < P - 1 ? m : 0));
				return stays + m * (left + right);
			})
		);
		// No fraction of a cell: below one, a class is kept (as one cell) or lost at random.
		for (const row of n) {
			for (let k = 0; k < CLASSES; k++) {
				if (row[k] > 0 && row[k] < 1) row[k] = rand() < row[k] ? 1 : 0;
				if (row[k] >= 1 && firstSeen[k] < 0) firstSeen[k] = g;
			}
		}
		if (g % every === 0) record();
	}
	return { drug, snapshots, every, best, firstSeen };
}

// ------------------------------------------------------------- peppered moth

/** Dark (carbonaria) share of the moths when the dark allele has frequency q (dominant). */
export const darkShare = (q: number) => 1 - (1 - q) ** 2;
/** Dark allele frequency giving a dark share f. */
export const qFromShare = (f: number) => 1 - Math.sqrt(1 - f);

/**
 * Deterministic selection on a dominant allele: dark moths (one or two copies)
 * have fitness 1 + s relative to pale ones (s < 0: a disadvantage). Returns the
 * dark share in each generation, starting with `share0`.
 */
export function dominantSelection(share0: number, s: number, generations: number): number[] {
	let q = qFromShare(share0);
	const out = [darkShare(q)];
	for (let g = 0; g < generations; g++) {
		const p = 1 - q;
		const wd = 1 + s;
		const wbar = (1 - p * p) * wd + p * p;
		q = (q * wd) / wbar; // q² wd + pq wd = q wd
		out.push(darkShare(q));
	}
	return out;
}

/**
 * Dark share of the peppered moth near Cambridge (Madingley light-trap
 * samples), 2001–2007: Cook, Grant, Saccheri & Mallet (2012), Biology Letters
 * 8: 609–612, table 2, column 2 (interpolated by those authors from a graph of
 * M. Majerus's).
 */
export const MADINGLEY: readonly { year: number; share: number }[] = [
	{ year: 2001, share: 0.12 },
	{ year: 2002, share: 0.1 },
	{ year: 2003, share: 0.06 },
	{ year: 2004, share: 0.07 },
	{ year: 2005, share: 0.04 },
	{ year: 2006, share: 0.02 },
	{ year: 2007, share: 0.01 }
];

/** Sum of squared errors of the model decline from 2001 against the Madingley shares. */
export function madingleyError(s: number): number {
	const model = dominantSelection(MADINGLEY[0].share, -s, MADINGLEY.length - 1);
	return MADINGLEY.reduce((e, d, i) => e + (model[i] - d.share) ** 2, 0);
}

/** The selection against dark moths that best fits the Madingley decline (least squares). */
export function fitMadingley(): number {
	let best = 0;
	let err = Infinity;
	for (let s = 0; s <= 0.8; s += 0.001) {
		const e = madingleyError(s);
		if (e < err) {
			err = e;
			best = s;
		}
	}
	return best;
}

/** The advantage s that takes the dark share from `from` to `to` in `generations` (bisection). */
export function advantageFor(from: number, to: number, generations: number): number {
	let lo = 0;
	let hi = 10;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		const end = dominantSelection(from, mid, generations).at(-1) ?? 0;
		if (end < to) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}
