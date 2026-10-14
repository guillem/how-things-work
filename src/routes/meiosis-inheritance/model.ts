/**
 * Meiosis and Mendelian inheritance, as a simulation.
 *
 * A chromosome is a line of genetic length L (in Morgans: 1 M = 100 cM, the
 * length along which one crossover happens on average per meiosis). Each
 * chromatid is stored as a list of segments, each remembering which of the
 * parent's two homologues (0: the copy inherited from its mother, 1: from its
 * father) it was copied from, so the same model gives the alleles at any gene
 * and the coloured mosaic the scenes draw.
 *
 * One meiosis, per chromosome pair:
 *  1. replication: each homologue becomes two identical sister chromatids;
 *  2. crossing over: crossovers fall at random along the genetic length, as a
 *     Poisson process of rate 2 per Morgan per pair, so 1 per Morgan on each
 *     chromatid (no interference: Haldane's assumption). Each joins one random chromatid of each homologue and swaps
 *     the stretches beyond it, on the side away from the centromere;
 *  3. meiosis I: each pair lines up with either homologue facing either pole,
 *     independently of the other pairs (independent assortment), and the
 *     homologues separate;
 *  4. meiosis II: the sister chromatids separate, giving four haploid cells.
 * Steps 2 and 3 can be fixed by the caller, to replay the reader's choices.
 */
import { rng as seeded } from '#lib/draw/math.ts';
import { HUMAN_AUTOSOMES, type HumanChromosome } from './human-map';

export type Rand = () => number;
/** Which homologue of the parent a stretch of chromatid was copied from. */
export type Origin = 0 | 1;

/** A stretch of chromatid ending at `to` (Morgans), starting where the previous one ended. */
export interface Segment {
	to: number;
	origin: Origin;
}
export type Chromatid = Segment[];

export interface ChromosomeKind {
	id: string;
	/** Genetic length, Morgans. */
	length: number;
	/** Position of the centromere along the chromosome, Morgans. */
	centromere: number;
}

/** Haldane's map function: recombination fraction between two genes `d` Morgans apart. */
export const haldane = (d: number) => 0.5 * (1 - Math.exp(-2 * Math.max(0, d)));
/** Its inverse: the map distance (Morgans) for a recombination fraction r < ½. */
export const haldaneInverse = (r: number) => -0.5 * Math.log(1 - 2 * Math.min(r, 0.4999999));

/** The homologue a chromatid carries at position x. */
export function originAt(c: Chromatid, x: number): Origin {
	for (const s of c) if (x < s.to) return s.origin;
	return c[c.length - 1].origin;
}

/**
 * While crossing over, a chromatid is tracked as the path it takes through the
 * four strand positions of the paired chromosomes ("slots" 0 and 1: homologue
 * 0's sisters, 2 and 3: homologue 1's), stretch by stretch.
 */
interface Path {
	to: number;
	slot: number;
}

const slotAt = (c: Path[], x: number) => (c.find((s) => x < s.to) ?? c[c.length - 1]).slot;

/** Cuts a path into its parts before and after x. */
function cut(c: Path[], x: number): [Path[], Path[]] {
	const before: Path[] = [];
	const after: Path[] = [];
	let from = 0;
	for (const s of c) {
		if (s.to <= x) before.push({ ...s });
		else if (from >= x) after.push({ ...s });
		else {
			before.push({ to: x, slot: s.slot });
			after.push({ ...s });
		}
		from = s.to;
	}
	return [before, after];
}

/** The chromatid's stretches by origin, neighbours of the same origin joined. */
function toChromatid(c: Path[]): Chromatid {
	const out: Chromatid = [];
	for (const s of c) {
		const origin: Origin = s.slot < 2 ? 0 : 1;
		const last = out[out.length - 1];
		if (last && last.origin === origin) last.to = s.to;
		else out.push({ to: s.to, origin });
	}
	return out;
}

/** Poisson-distributed count with mean `m` (Knuth; m is small here). */
function poisson(m: number, rand: Rand) {
	const limit = Math.exp(-m);
	let k = 0;
	let p = rand();
	while (p > limit) {
		k++;
		p *= rand();
	}
	return k;
}

export interface Crossover {
	/** Position along the chromosome, Morgans. */
	at: number;
	/** Which sister of homologue 0 (0 or 1) and of homologue 1 take part. */
	sisters: [number, number];
}

export interface PairMeiosis {
	/** The chiasmata of this pair. */
	crossovers: Crossover[];
	/**
	 * The four chromatids after crossing over: [homologue 0 sister 0, sister 1,
	 * homologue 1 sister 0, sister 1].
	 */
	chromatids: [Chromatid, Chromatid, Chromatid, Chromatid];
	/** Meiosis I orientation: true when homologue 1 goes to the first cell. */
	flipped: boolean;
}

export interface MeiosisChoice {
	/** Crossover positions (Morgans). Omitted: drawn at random (Poisson). */
	crossovers?: number[];
	/** Meiosis I orientation. Omitted: a coin toss. */
	flipped?: boolean;
}

/** Crossing over and line-up of one chromosome pair. Chosen crossovers join the inner chromatids. */
export function meiosisOfPair(
	kind: ChromosomeKind,
	rand: Rand,
	choice: MeiosisChoice = {}
): PairMeiosis {
	const paths: Path[][] = [0, 1, 2, 3].map((slot) => [{ to: kind.length, slot }]);
	let crossovers: Crossover[];
	if (choice.crossovers) {
		crossovers = choice.crossovers.map((at) => ({ at, sisters: [1, 0] as [number, number] }));
	} else {
		// Map length L means L crossovers per chromatid on average; each chiasma
		// involves two of the four chromatids, so a pair has 2L of them.
		const n = poisson(2 * kind.length, rand);
		crossovers = Array.from({ length: n }, () => ({
			at: rand() * kind.length,
			sisters: [rand() < 0.5 ? 0 : 1, rand() < 0.5 ? 0 : 1] as [number, number]
		})).sort((a, b) => a.at - b.at);
	}
	// From the centromere outwards: at each chiasma, the two chromatids that
	// pass through its two strand positions swap everything beyond it.
	const outward = [...crossovers].sort(
		(a, b) => Math.abs(a.at - kind.centromere) - Math.abs(b.at - kind.centromere)
	);
	for (const c of outward) {
		const i = paths.findIndex((p) => slotAt(p, c.at) === c.sisters[0]);
		const j = paths.findIndex((p) => slotAt(p, c.at) === 2 + c.sisters[1]);
		const [a0, a1] = cut(paths[i], c.at);
		const [b0, b1] = cut(paths[j], c.at);
		if (c.at > kind.centromere) {
			paths[i] = [...a0, ...b1];
			paths[j] = [...b0, ...a1];
		} else {
			paths[i] = [...b0, ...a1];
			paths[j] = [...a0, ...b1];
		}
	}
	const ch = paths.map(toChromatid) as [Chromatid, Chromatid, Chromatid, Chromatid];
	const flipped = choice.flipped ?? rand() < 0.5;
	return { crossovers, chromatids: ch, flipped };
}

/**
 * The four haploid cells of one meiosis: for each, one chromatid per pair.
 * Cells 0 and 1 come from the first cell of meiosis I, 2 and 3 from the
 * second; within a cell, sister 0 goes to the first daughter.
 */
export function tetrad(pairs: PairMeiosis[]): Chromatid[][] {
	return [0, 1, 2, 3].map((g) =>
		pairs.map((p) => {
			const firstCell = g < 2;
			const homologue = firstCell !== p.flipped ? 0 : 1;
			return p.chromatids[homologue * 2 + (g % 2)];
		})
	);
}

/** One random gamete: one meiosis, then one of its four products. */
export function gamete(kinds: ChromosomeKind[], rand: Rand): Chromatid[] {
	return kinds.map((k) => meiosisOfPair(k, rand).chromatids[Math.floor(rand() * 4)]);
}

// ---------------------------------------------------------------------------
// Genes and crosses

export interface Gene {
	id: string;
	/** Chromosome (index into the organism's kinds) and position on it, Morgans. */
	chromosome: number;
	at: number;
	dominant: string;
	recessive: string;
	trait: string;
	dominantTrait: string;
	recessiveTrait: string;
}

/** A parent's two homologues, as the allele each carries at every gene. */
export type Genotype = Record<string, [string, string]>;

/** The alleles a gamete carries, from the parent's genotype and the gamete's chromatids. */
export function allelesOf(g: Chromatid[], genes: Gene[], parent: Genotype): Record<string, string> {
	const out: Record<string, string> = {};
	for (const gene of genes) out[gene.id] = parent[gene.id][originAt(g[gene.chromosome], gene.at)];
	return out;
}

/** Orders a pair of alleles the way genetics writes them: the dominant one first. */
export function pairName(a: string, b: string) {
	return a < b ? a + b : b + a;
}

/** The trait shown by a pair of alleles (complete dominance). */
export function phenotype(gene: Gene, a: string, b: string) {
	return a === gene.dominant || b === gene.dominant ? gene.dominantTrait : gene.recessiveTrait;
}

/**
 * Gamete kinds of a parent, with their exact probabilities, for genes on
 * different chromosomes or on the same one (via Haldane). Keys are the allele
 * strings in gene order, e.g. "RY".
 */
export function gameteKinds(parent: Genotype, genes: Gene[]): Map<string, number> {
	let kinds = new Map<string, number>([['', 1]]);
	const byChromosome = new Map<number, Gene[]>();
	for (const g of genes)
		byChromosome.set(g.chromosome, [...(byChromosome.get(g.chromosome) ?? []), g]);
	// Per chromosome: walk its genes in order, switching homologue with probability r.
	const parts = new Map<number, Map<string, number>>();
	for (const [c, gs] of byChromosome) {
		const sorted = [...gs].sort((a, b) => a.at - b.at);
		let states = new Map<string, number>(); // key "origin|alleles"
		states.set('0|', 0.5);
		states.set('1|', 0.5);
		let prev: Gene | null = null;
		for (const g of sorted) {
			const r = prev ? haldane(g.at - prev.at) : 0;
			const next = new Map<string, number>();
			for (const [key, p] of states) {
				const [o, alleles] = key.split('|');
				for (const [to, q] of [
					[o, 1 - r],
					[o === '0' ? '1' : '0', r]
				] as const) {
					if (q === 0) continue;
					const k = `${to}|${alleles}${g.id}=${parent[g.id][Number(to)]};`;
					next.set(k, (next.get(k) ?? 0) + p * q);
				}
			}
			states = next;
			prev = g;
		}
		const m = new Map<string, number>();
		for (const [key, p] of states) {
			const alleles = key.split('|')[1];
			m.set(alleles, (m.get(alleles) ?? 0) + p);
		}
		parts.set(c, m);
	}
	for (const m of parts.values()) {
		const next = new Map<string, number>();
		for (const [a, p] of kinds)
			for (const [b, q] of m) next.set(a + b, (next.get(a + b) ?? 0) + p * q);
		kinds = next;
	}
	// Re-express "R=R;Y=y;" as "Ry" in gene order.
	const out = new Map<string, number>();
	for (const [key, p] of kinds) {
		const map = Object.fromEntries(
			key
				.split(';')
				.filter(Boolean)
				.map((kv) => kv.split('='))
		) as Record<string, string>;
		const name = genes.map((g) => map[g.id]).join('');
		out.set(name, (out.get(name) ?? 0) + p);
	}
	return out;
}

/** The trait combination of an offspring, e.g. "round, yellow". */
export function traitsOf(genes: Gene[], a: Record<string, string>, b: Record<string, string>) {
	return genes.map((g) => phenotype(g, a[g.id], b[g.id])).join(', ');
}

/** Exact offspring trait proportions of a cross (the Punnett square, summed). */
export function expected(genes: Gene[], mother: Genotype, father: Genotype): Map<string, number> {
	const out = new Map<string, number>();
	const split = (s: string) => Object.fromEntries(genes.map((g, i) => [g.id, s[i]]));
	for (const [a, p] of gameteKinds(mother, genes))
		for (const [b, q] of gameteKinds(father, genes)) {
			const k = traitsOf(genes, split(a), split(b));
			out.set(k, (out.get(k) ?? 0) + p * q);
		}
	return out;
}

export interface Offspring {
	/** Alleles received from each parent. */
	fromMother: Record<string, string>;
	fromFather: Record<string, string>;
	traits: string;
}

/** Breeds `n` offspring by simulating a meiosis in each parent for every one. */
export function breed(
	kinds: ChromosomeKind[],
	genes: Gene[],
	mother: Genotype,
	father: Genotype,
	n: number,
	seed: number
): Offspring[] {
	const rand = seeded(seed);
	const out: Offspring[] = [];
	for (let i = 0; i < n; i++) {
		const fromMother = allelesOf(gamete(kinds, rand), genes, mother);
		const fromFather = allelesOf(gamete(kinds, rand), genes, father);
		out.push({ fromMother, fromFather, traits: traitsOf(genes, fromMother, fromFather) });
	}
	return out;
}

/** Counts of each trait combination among offspring. */
export function tally(off: Offspring[], upTo = off.length): Map<string, number> {
	const m = new Map<string, number>();
	for (let i = 0; i < Math.min(upTo, off.length); i++)
		m.set(off[i].traits, (m.get(off[i].traits) ?? 0) + 1);
	return m;
}

/** Pearson's χ² statistic of observed counts against expected proportions. */
export function chiSquare(observed: Map<string, number>, proportions: Map<string, number>) {
	const n = [...observed.values()].reduce((s, v) => s + v, 0);
	let x = 0;
	for (const [k, p] of proportions) {
		const e = p * n;
		const o = observed.get(k) ?? 0;
		if (e > 0) x += ((o - e) * (o - e)) / e;
	}
	return x;
}

// ---------------------------------------------------------------------------
// Mendel's peas, simplified: three of the pea's seven chromosome pairs, each
// with one of Mendel's genes. Linkage groups from Reid & Ross 2011 (R on V,
// I on I) and Hellens et al. 2010 (A on II). The lengths and positions are
// illustrative: they do not change any result for genes on different
// chromosomes.

export const PEA_CHROMOSOMES: ChromosomeKind[] = [
	{ id: 'V', length: 1.3, centromere: 0.5 },
	{ id: 'I', length: 1.0, centromere: 0.42 },
	{ id: 'II', length: 0.75, centromere: 0.3 }
];

export const SHAPE: Gene = {
	id: 'R',
	chromosome: 0,
	at: 1.0,
	dominant: 'R',
	recessive: 'r',
	trait: 'seed shape',
	dominantTrait: 'round',
	recessiveTrait: 'wrinkled'
};
export const COLOUR: Gene = {
	id: 'Y',
	chromosome: 1,
	at: 0.2,
	dominant: 'Y',
	recessive: 'y',
	trait: 'seed colour',
	dominantTrait: 'yellow',
	recessiveTrait: 'green'
};
export const FLOWER: Gene = {
	id: 'A',
	chromosome: 2,
	at: 0.6,
	dominant: 'A',
	recessive: 'a',
	trait: 'flower colour',
	dominantTrait: 'purple',
	recessiveTrait: 'white'
};
export const PEA_GENES = [SHAPE, COLOUR, FLOWER];

/** Mendel's F₂ counts (Mendel 1866, Druery & Bateson's translation). */
export const MENDEL = {
	shape: { round: 5474, wrinkled: 1850 },
	colour: { yellow: 6022, green: 2001 },
	flower: { purple: 705, white: 224 },
	/** Round yellow × wrinkled green, F₂ from 15 plants. */
	dihybrid: {
		'round, yellow': 315,
		'wrinkled, yellow': 101,
		'round, green': 108,
		'wrinkled, green': 32
	}
} as const;

/** A genotype from allele-pair names, e.g. { R: 'Rr', Y: 'yy' }: first letter on homologue 0. */
export function genotype(pairs: Record<string, string>): Genotype {
	return Object.fromEntries(
		Object.entries(pairs).map(([k, v]): [string, [string, string]] => [k, [v[0], v[1]]])
	);
}

// ---------------------------------------------------------------------------
// Two linked genes (the linkage step): gene 1 at 0, gene 2 at d Morgans, on a
// chromosome long enough for both, in a parent that got 1+2 from one parent
// and 1−2− from the other.

/**
 * Simulated gametes for two genes `d` Morgans apart: for each, the homologue
 * it carries at gene 1 and at gene 2 (different: a recombinant), and the
 * recombinant fraction.
 */
export function recombinants(d: number, n: number, seed: number) {
	const kind: ChromosomeKind = { id: 'L', length: d + 0.4, centromere: 0.1 };
	const rand = seeded(seed);
	let rec = 0;
	const gametes: [Origin, Origin][] = [];
	for (let i = 0; i < n; i++) {
		const g = gamete([kind], rand)[0];
		const pair: [Origin, Origin] = [originAt(g, 0.2), originAt(g, 0.2 + d)];
		gametes.push(pair);
		if (pair[0] !== pair[1]) rec++;
	}
	return { fraction: rec / n, gametes };
}

// ---------------------------------------------------------------------------
// Human siblings: the 22 autosomes with their real genetic lengths.

/** Physical position (Mb) of genetic position x (Morgans) on a human chromosome. */
export function physical(c: HumanChromosome, x: number) {
	const u = Math.min(1, Math.max(0, x / (c.cM / 100))) * (c.knots.length - 1);
	const i = Math.min(c.knots.length - 2, Math.floor(u));
	return c.knots[i] + (u - i) * (c.knots[i + 1] - c.knots[i]);
}

/** A human chromosome as a meiosis sees it (centromere position does not matter for the mosaic). */
export const humanKind = (c: HumanChromosome): ChromosomeKind => ({
	id: String(c.n),
	length: c.cM / 100,
	centromere: 0
});

/** One child's genome: for each autosome, the chromatid received from each parent. */
export interface Child {
	fromMother: Chromatid[];
	fromFather: Chromatid[];
}

export function human(rand: Rand): Child {
	const kinds = HUMAN_AUTOSOMES.map(humanKind);
	return { fromMother: gamete(kinds, rand), fromFather: gamete(kinds, rand) };
}

/** Physical stretches (Mb) of a chromatid: [from, to, origin]. */
export function stretches(c: HumanChromosome, ch: Chromatid): [number, number, Origin][] {
	let from = 0;
	return ch.map((s, i) => {
		const to = i === ch.length - 1 ? c.mb : physical(c, s.to);
		const out: [number, number, Origin] = [from, to, s.origin];
		from = to;
		return out;
	});
}

/** Fraction of the autosomes (by Mb) where two chromatids from the same parent came from the same grandparent. */
function sameOrigin(a: Chromatid[], b: Chromatid[]) {
	let same = 0;
	let total = 0;
	HUMAN_AUTOSOMES.forEach((c, i) => {
		const sa = stretches(c, a[i]);
		const sb = stretches(c, b[i]);
		// Walk the union of breakpoints.
		const cuts = [...new Set([0, c.mb, ...sa.map((s) => s[1]), ...sb.map((s) => s[1])])].sort(
			(x, y) => x - y
		);
		for (let k = 1; k < cuts.length; k++) {
			const mid = (cuts[k - 1] + cuts[k]) / 2;
			const oa = sa.find((s) => mid < s[1])?.[2] ?? 0;
			const ob = sb.find((s) => mid < s[1])?.[2] ?? 0;
			if (oa === ob) same += cuts[k] - cuts[k - 1];
		}
		total += c.mb;
	});
	return same / total;
}

/**
 * Share of the genome two siblings inherited identically (identity by descent,
 * IBD): the average of the share they got from the same maternal grandparent
 * and the share they got from the same paternal grandparent.
 */
export function shared(a: Child, b: Child) {
	return (sameOrigin(a.fromMother, b.fromMother) + sameOrigin(a.fromFather, b.fromFather)) / 2;
}
