/**
 * Cancer as evolution among the cells of a tissue: the models behind the page.
 *
 * 1. `simulate`: a stochastic, spatial model of a patch of self-renewing tissue (a lattice of
 *    W × H sites, eight neighbours each). It is a lattice birth–death process of the kind used
 *    for clonal competition in tissues and tumours (e.g. Williams & Bjerknes, Nature 1972, for
 *    a fitter clone spreading in a sheet of cells; Waclaw et al., Nature 2015, for tumours).
 *    Every generation, in random order, each cell
 *      a. dies with probability d (an empty site is left), else
 *      b. tries to divide with probability b: it picks a neighbour at random; if that site is
 *         empty, a daughter fills it. A normal cell divides only into free space (contact
 *         inhibition), so a healthy tissue stays in balance: divisions replace losses.
 *      c. each of the two cells after a division may pick up mutations: every gene not yet hit
 *         is hit with probability μ (× REPAIR_FACTOR once the repair gene is broken), plus a
 *         Poisson number of harmless "passenger" mutations.
 *    The genes, at textbook level:
 *      - KRAS, an oncogene (the accelerator): one hit switches it on; the cell tries to divide
 *        more often (b = B_KRAS = 0.7 instead of 0.5);
 *      - TP53, a tumour-suppressor gene (a brake), two copies, each hit a plain loss of that
 *        copy: a cell with one copy hit is unchanged; with both hit it escapes programmed death
 *        (d × P53_DEATH). (Some real TP53 missense mutations are dominant-negative, so one hit
 *        already weakens the brake; the model leaves that kind out.)
 *      - a mismatch-repair gene (MLH1 stands for it): once broken, the cell and its descendants
 *        mutate REPAIR_FACTOR times as often;
 *      - two genes of resistance to two drugs, A and B, which do nothing unless the drug is
 *        given (they are hit at random like any other gene, at a fixed rate: in this model
 *        the drug does not cause them).
 *    A cell with both KRAS on and TP53 lost is a cancer cell: in this model it also stops
 *    respecting its neighbours, and a daughter can take the site of a non-cancer neighbour
 *    (crowding it out). That rule stands for the several further changes real tumours need.
 *    Treatment (from the generation the tumour is found, when the reader applies it) kills
 *    each cancer cell that is not resistant with probability KILL per generation. One drug
 *    needs resistance to A; two drugs at once need resistance to both.
 *    The whole run is computed once and stored as one snapshot per generation.
 *
 * 2. `multistage*`: the Armitage–Doll (1954) multistage model. If a cell must pass k rare,
 *    random steps, each at a constant small rate u per year, the chance that it has passed all
 *    of them by age t is the Erlang distribution's, and its density, ≈ u^k t^(k−1)/(k−1)! while
 *    ut ≪ 1: incidence rises as the (k−1)th power of age, a straight line of slope k−1 on
 *    log–log axes. `fitStages` fits that line to real incidence by age.
 *
 * 3. `knudson*`: Knudson's (1971) two-hit model of retinoblastoma. A child who inherits one
 *    broken RB1 gene needs a single further hit in any retinal cell; the number of tumours is
 *    Poisson with mean KNUDSON_MEAN = 3, shared between the two eyes.
 */
import { poisson, rng as seeded } from '../evolution/model';
import { translate } from '../dna-to-protein/genetics';
import { KRAS_START } from './data';

export type Rand = () => number;
export const rng = seeded;

// ------------------------------------------------------------------ tissue model

/** Lattice size: W × H sites. */
export const W = 38;
export const H = 26;
export const SITES = W * H;

/** Per-generation probabilities of a normal cell. */
export const D0 = 0.08;
export const B0 = 0.5;
/** KRAS on: tries to divide every generation. */
export const B_KRAS = 0.7;
/** TP53 lost: dies this many times less often. */
export const P53_DEATH = 0.25;
/** Broken mismatch repair: this many times more mutations. */
export const REPAIR_FACTOR = 20;
/** Cancer cells killed per generation by a drug they don't resist. */
export const KILL = 0.6;
/**
 * Chance per division of a cancer cell that a resistance gene is hit. Real resistance often
 * needs one particular change (of the order of 1 in 10 million divisions), but a real tumour
 * is found at about a billion cells, so it already holds resistant cells (Goldie & Coldman,
 * Cancer Treatment Reports, 1979). A model tumour of a hundred cells needs a much higher rate
 * to match. Only cancer cells are followed for it: in other cells the change does nothing.
 */
export const RES_MU = 0.003;
/** Harmless (passenger) mutations per cell per division. */
export const PASSENGERS = 0.5;
/** Chance that a cancer cell's division into an occupied site crowds the occupant out. */
export const INVADE = 0.2;
/** The tumour is "found" when it has this many cells. */
export const DETECT = 120;

/** Gene bits. */
export const KRAS = 1;
export const P53A = 2;
export const P53B = 4;
export const MMR = 8;
export const RES_A = 16;
export const RES_B = 32;
const P53 = P53A | P53B;

/** What a site shows. */
export const Kind = {
	Empty: 0,
	Normal: 1,
	/** One TP53 copy hit: no visible effect. */
	OneHit: 2,
	/** KRAS on (accelerator stuck). */
	Kras: 3,
	/** Both TP53 copies lost (brake gone). */
	P53: 4,
	/** KRAS on and TP53 lost. */
	Cancer: 5,
	/** A cancer cell that resists the treatment on offer. */
	Resistant: 6
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];
export const KINDS = 7;
/** Flag added to a snapshot cell whose repair gene is broken. */
export const MUTATOR = 8;
/** Flag added to a cancer cell that resists one of two drugs given together (not enough). */
export const PARTIAL = 16;
/** The Kind of a snapshot cell (without its flags). */
export const KIND_MASK = 7;

export type Therapy = 'one' | 'two';

export interface Scenario {
	seed: number;
	gens: number;
	/** Probability per gene per division that it is hit. */
	mu: number;
	/** Which genes can be hit at all (the page switches some off to show one thing at a time). */
	genes: number;
	/** Apply the treatment once the tumour is found. */
	treat: boolean;
	therapy: Therapy;
	/** Harmless mutations per division (only drawn on one step). */
	passengers: number;
}

export const DEFAULT: Scenario = {
	seed: 1,
	gens: 700,
	mu: 1e-3,
	genes: KRAS | P53 | MMR | RES_A | RES_B,
	treat: false,
	therapy: 'one',
	passengers: 0
};

export interface Run {
	scenario: Scenario;
	/** Snapshot per generation: Kind (+ MUTATOR) per site, gens + 1 snapshots. */
	cells: Uint8Array;
	/** Passenger mutations per site (capped at 255), per generation. */
	passengers: Uint8Array;
	/** Count of each Kind per generation: counts[g * KINDS + kind]. */
	counts: Int32Array;
	/** Cells with broken repair, per generation. */
	mutators: Int32Array;
	/** Mean passenger mutations per living cell, per generation. */
	meanPassengers: Float32Array;
	/** Divisions in each generation. */
	divisions: Int32Array;
	/** Generation of the first cell of each Kind (null: never). */
	first: (number | null)[];
	/** The first cancer cell whose lineage went on to be found (null: none). */
	firstCancer: number | null;
	/** Generation the tumour reached DETECT cells (null: never). */
	found: number | null;
	/** Generation treatment started (null: not treated). */
	treatedAt: number | null;
	/** Resistant cancer cells already present when treatment started. */
	resistantAtStart: number;
	/** Fewest cancer cells after treatment started. */
	lowest: number | null;
	/** Generation the tumour was back at DETECT cells under treatment (null: no relapse). */
	relapse: number | null;
	/** Generation the last cancer cell died under treatment (null: never). */
	cleared: number | null;
}

const isCancer = (g: number) => g >= 0 && (g & KRAS) !== 0 && (g & P53) === P53;

function kindOf(g: number, therapy: Therapy): Kind {
	const cancer = isCancer(g);
	if (cancer) {
		const need = therapy === 'two' ? RES_A | RES_B : RES_A;
		return (g & need) === need ? Kind.Resistant : Kind.Cancer;
	}
	if (g & KRAS) return Kind.Kras;
	if ((g & P53) === P53) return Kind.P53;
	if (g & P53) return Kind.OneHit;
	return Kind.Normal;
}

/** The genes, in the order they are drawn (resistance last). */
const GENES = [KRAS, P53A, P53B, MMR, RES_A, RES_B] as const;

/** Generations of turnover before generation 0. */
const WARMUP = 30;

/** Neighbour offsets (eight neighbours). */
const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];

export function simulate(partial: Partial<Scenario> = {}): Run {
	const sc: Scenario = { ...DEFAULT, ...partial };
	const rand = rng(sc.seed * 7919 + 17);
	const G = sc.gens;
	const geno = new Int16Array(SITES).fill(0); // -1: empty
	const pass = new Uint16Array(SITES);
	const cells = new Uint8Array((G + 1) * SITES);
	const passengers = new Uint8Array((G + 1) * SITES);
	const counts = new Int32Array((G + 1) * KINDS);
	const mutators = new Int32Array(G + 1);
	const meanPassengers = new Float32Array(G + 1);
	const divisions = new Int32Array(G + 1);
	const first: (number | null)[] = Array.from({ length: KINDS }, () => null);
	const order = new Int32Array(SITES);
	for (let i = 0; i < SITES; i++) order[i] = i;
	// Start with a young tissue: every cell carries a few passengers already, as from the
	// divisions that built it (so the step about them starts from realistic variety: none).
	let found: number | null = null;
	let treatedAt: number | null = null;
	let resistantAtStart = 0;
	let lowest: number | null = null;
	let relapse: number | null = null;
	let cleared: number | null = null;
	let firstCancer: number | null = null;
	let cancerSince: number | null = null;

	const mutate = (i: number) => {
		const g = geno[i];
		const factor = g & MMR ? REPAIR_FACTOR : 1;
		const p = Math.min(0.5, sc.mu * factor);
		let ng = g;
		// Resistance last, so that a cell that has just become cancerous can already pick it up.
		for (const bit of GENES) {
			if (bit >= RES_A && !isCancer(ng)) continue;
			const q = bit >= RES_A ? Math.min(0.5, RES_MU * factor) : p;
			if (sc.genes & bit && !(g & bit) && rand() < q) ng |= bit;
		}
		geno[i] = ng;
		if (sc.passengers > 0)
			pass[i] = Math.min(65535, pass[i] + poisson(sc.passengers * factor, rand));
	};

	const record = (gen: number) => {
		const base = gen * SITES;
		let sumPass = 0;
		let alive = 0;
		for (let i = 0; i < SITES; i++) {
			const g = geno[i];
			if (g < 0) {
				cells[base + i] = Kind.Empty;
				passengers[base + i] = 0;
				counts[gen * KINDS + Kind.Empty]++;
				continue;
			}
			const k = kindOf(g, sc.therapy);
			const partial = k === Kind.Cancer && sc.therapy === 'two' && (g & (RES_A | RES_B)) !== 0;
			cells[base + i] = k | (g & MMR ? MUTATOR : 0) | (partial ? PARTIAL : 0);
			passengers[base + i] = Math.min(255, pass[i]);
			counts[gen * KINDS + k]++;
			if (g & MMR) mutators[gen]++;
			if (first[k] === null) first[k] = gen;
			sumPass += pass[i];
			alive++;
		}
		meanPassengers[gen] = alive ? sumPass / alive : 0;
	};

	/** One generation of the rules above; returns the number of divisions. */
	const generation = (mutating: boolean) => {
		const treating = treatedAt !== null;
		const need = sc.therapy === 'two' ? RES_A | RES_B : RES_A;
		// Random order (Fisher–Yates).
		for (let i = SITES - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			const tmp = order[i];
			order[i] = order[j];
			order[j] = tmp;
		}
		let divs = 0;
		for (let n = 0; n < SITES; n++) {
			const i = order[n];
			const g = geno[i];
			if (g < 0) continue;
			const cancer = isCancer(g);
			let d = D0 * ((g & P53) === P53 ? P53_DEATH : 1);
			if (treating && cancer && (g & need) !== need) d = 1 - (1 - d) * (1 - KILL);
			if (rand() < d) {
				geno[i] = -1;
				pass[i] = 0;
				continue;
			}
			const b = g & KRAS ? B_KRAS : B0;
			if (rand() >= b) continue;
			// A free neighbour if there is one (picked at random); otherwise a cancer cell may
			// crowd out a random non-cancer neighbour.
			const x = i % W;
			const y = (i - x) / W;
			let free = 0;
			let j = -1;
			for (let k = 0; k < 8; k++) {
				const nx = x + DX[k];
				const ny = y + DY[k];
				if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
				const m = ny * W + nx;
				if (geno[m] < 0 && rand() * ++free < 1) j = m;
			}
			if (j < 0) {
				if (!cancer || rand() >= INVADE) continue;
				const k = Math.floor(rand() * 8);
				const nx = x + DX[k];
				const ny = y + DY[k];
				if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
				j = ny * W + nx;
				if (isCancer(geno[j])) continue;
			}
			geno[j] = g;
			pass[j] = pass[i];
			if (mutating) {
				mutate(i);
				mutate(j);
			}
			divs++;
		}
		return divs;
	};

	// Settle the tissue first (turnover only, nothing recorded or mutated), so that
	// generation 0 already shows a tissue in its steady state, gaps and all.
	for (let w = 0; w < WARMUP; w++) generation(false);
	record(0);
	for (let gen = 1; gen <= G; gen++) {
		const divs = generation(true);
		divisions[gen] = divs;
		record(gen);
		const c = counts[gen * KINDS + Kind.Cancer] + counts[gen * KINDS + Kind.Resistant];
		if (c > 0 && cancerSince === null) cancerSince = gen;
		if (c === 0 && found === null) cancerSince = null;
		if (found === null && c >= DETECT) {
			found = gen;
			firstCancer = cancerSince;
			if (sc.treat) {
				treatedAt = gen;
				resistantAtStart = counts[gen * KINDS + Kind.Resistant];
			}
		}
		if (treatedAt !== null && gen > treatedAt) {
			if (lowest === null || c < lowest) lowest = c;
			if (c === 0 && cleared === null) cleared = gen;
			if (relapse === null && c >= DETECT && lowest !== null && lowest < DETECT / 2) relapse = gen;
		}
	}
	return {
		scenario: sc,
		cells,
		passengers,
		counts,
		mutators,
		meanPassengers,
		divisions,
		first,
		firstCancer,
		found,
		treatedAt,
		resistantAtStart,
		lowest,
		relapse,
		cleared
	};
}

/** Count of a kind at a generation. */
export const count = (run: Run, gen: number, kind: Kind) =>
	run.counts[Math.max(0, Math.min(run.scenario.gens, Math.round(gen))) * KINDS + kind];

/** Cancer cells (resistant or not) at a generation. */
export const tumour = (run: Run, gen: number) =>
	count(run, gen, Kind.Cancer) + count(run, gen, Kind.Resistant);

/** Living cells at a generation. */
export const living = (run: Run, gen: number) => SITES - count(run, gen, Kind.Empty);

// ------------------------------------------------------------------ Armitage–Doll

/**
 * Density of the time to pass k steps, each at rate u per year (Erlang): the incidence of
 * the multistage model per cell at risk, per year, at age t.
 */
export function multistageDensity(t: number, k: number, u: number): number {
	let logF = k * Math.log(u) + (k - 1) * Math.log(t) - u * t;
	for (let j = 2; j < k; j++) logF -= Math.log(j);
	return Math.exp(logF);
}

export interface PowerFit {
	/** Number of steps k = slope + 1. */
	k: number;
	slope: number;
	/** ln(rate) = intercept + slope · ln(age). */
	intercept: number;
	r2: number;
}

/** Least-squares line through (ln age, ln rate). */
export function fitStages(points: readonly { age: number; rate: number }[]): PowerFit {
	const xs = points.map((p) => Math.log(p.age));
	const ys = points.map((p) => Math.log(p.rate));
	const n = xs.length;
	const mx = xs.reduce((a, b) => a + b, 0) / n;
	const my = ys.reduce((a, b) => a + b, 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (let i = 0; i < n; i++) {
		sxy += (xs[i] - mx) * (ys[i] - my);
		sxx += (xs[i] - mx) ** 2;
		syy += (ys[i] - my) ** 2;
	}
	const slope = sxy / sxx;
	return { k: slope + 1, slope, intercept: my - slope * mx, r2: (sxy * sxy) / (sxx * syy) };
}

/** Best intercept for a line of a given slope (least squares in log–log). */
export function interceptFor(
	points: readonly { age: number; rate: number }[],
	slope: number
): number {
	const r = points.map((p) => Math.log(p.rate) - slope * Math.log(p.age));
	return r.reduce((a, b) => a + b, 0) / r.length;
}

// ------------------------------------------------------------------ Knudson

/** Knudson (1971): mean number of retinoblastomas in a child who inherits one broken RB1. */
export const KNUDSON_MEAN = 3;

/** Chances, under Knudson's Poisson model, that a carrier has no tumour, one eye, both eyes. */
export function knudsonOdds(mean = KNUDSON_MEAN) {
	const none = Math.exp(-mean / 2);
	return { none: none * none, oneEye: 2 * none * (1 - none), bothEyes: (1 - none) ** 2 };
}

export interface Child {
	carrier: boolean;
	/** Tumours in the left and right eye. */
	left: number;
	right: number;
}

/**
 * A group of children. Carriers get Poisson(mean/2) tumours per eye. In a child without the
 * inherited hit both hits must strike the same cell, which is so rare that in a small group
 * almost nobody gets one (`sporadicPerEye` is the per-eye chance used).
 */
export function knudsonChildren(
	n: number,
	carrier: boolean,
	seed: number,
	sporadicPerEye = 1e-5
): Child[] {
	const rand = rng(seed * 104729 + 3);
	return Array.from({ length: n }, () => {
		const eye = () => (carrier ? poisson(KNUDSON_MEAN / 2, rand) : rand() < sporadicPerEye ? 1 : 0);
		const left = eye();
		return { carrier, left, right: eye() };
	});
}

// ------------------------------------------------------------------ KRAS codon 12

/** The single-letter changes of KRAS codon 12 (GGT, glycine) found most often in cancers. */
export const KRAS_CHANGES = [
	{ id: 'G12D', codon: 'GAT' },
	{ id: 'G12V', codon: 'GTT' },
	{ id: 'G12C', codon: 'TGT' }
] as const;
export type KrasChange = (typeof KRAS_CHANGES)[number]['id'] | 'none';

/** Index of codon 12's first letter in KRAS_START. */
export const KRAS_CODON12 = 33;

/** The start of KRAS with codon 12 changed (or not), read by the genetic code. */
export function krasWith(change: KrasChange) {
	const codon = KRAS_CHANGES.find((c) => c.id === change)?.codon;
	const dna = codon
		? KRAS_START.slice(0, KRAS_CODON12) + codon + KRAS_START.slice(KRAS_CODON12 + 3)
		: KRAS_START;
	const t = translate(dna);
	return { dna, protein: t.protein, codon12: dna.slice(KRAS_CODON12, KRAS_CODON12 + 3) };
}
