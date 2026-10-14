// Checks the meiosis model against the laws of genetics and real measurements
// (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { rng } from '../src/lib/draw/math';
import { HUMAN_AUTOSOMES } from '../src/routes/meiosis-inheritance/human-map';
import {
	COLOUR,
	MENDEL,
	PEA_CHROMOSOMES,
	PEA_GENES,
	SHAPE,
	breed,
	chiSquare,
	expected,
	gameteKinds,
	genotype,
	haldane,
	human,
	meiosisOfPair,
	originAt,
	recombinants,
	shared,
	tally,
	tetrad
} from '../src/routes/meiosis-inheritance/model';

const hybrid = genotype({ R: 'Rr', Y: 'Yy', A: 'Aa' });
// χ² critical values at p = 0.001 (1 and 3 degrees of freedom).
const CHI2_1 = 10.83;
const CHI2_3 = 16.27;

test('Haldane: close genes recombine at about their distance, far ones at most half the time', () => {
	expect(haldane(0.01)).toBeCloseTo(0.0099, 4);
	expect(haldane(0.5)).toBeCloseTo(0.316, 3);
	expect(haldane(5)).toBeCloseTo(0.5, 4);
	expect(haldane(0)).toBe(0);
});

test('simulated crossing over reproduces Haldane’s recombination fraction', () => {
	for (const d of [0.05, 0.2, 0.5, 1.5]) {
		const { fraction } = recombinants(d, 20000, 7);
		expect(Math.abs(fraction - haldane(d))).toBeLessThan(0.012);
	}
});

test('one crossover between two genes makes two parental and two recombinant chromatids', () => {
	const kind = { id: 'L', length: 1, centromere: 0.1 };
	const p = meiosisOfPair(kind, rng(1), { crossovers: [0.5], flipped: false });
	const rec = p.chromatids.filter((c) => originAt(c, 0.3) !== originAt(c, 0.8)).length;
	expect(rec).toBe(2);
	// A crossover outside the interval changes nothing between the genes.
	const q = meiosisOfPair(kind, rng(1), { crossovers: [0.9], flipped: false });
	expect(q.chromatids.filter((c) => originAt(c, 0.3) !== originAt(c, 0.8)).length).toBe(0);
});

test('a crossover moves the genes beyond it (from the centromere) and leaves the ones before it', () => {
	// Long pair: centromere at 0.5 M, seed-shape gene at 1.0 M; crossover between them.
	const p = meiosisOfPair(PEA_CHROMOSOMES[0], rng(1), { crossovers: [0.806], flipped: false });
	expect(originAt(p.chromatids[1], SHAPE.at)).toBe(1);
	expect(originAt(p.chromatids[2], SHAPE.at)).toBe(0);
	// On the other side of the centromere nothing moved.
	expect(originAt(p.chromatids[1], 0.2)).toBe(0);
	expect(originAt(p.chromatids[2], 0.2)).toBe(1);
});

test('meiosis halves the chromosomes and each pair lines up independently', () => {
	const rand = rng(3);
	// Fixed line-ups: flipping one pair changes which allele travels with which.
	const plain = tetrad(
		PEA_CHROMOSOMES.map((k) => meiosisOfPair(k, rand, { crossovers: [], flipped: false }))
	);
	expect(plain).toHaveLength(4);
	for (const g of plain) expect(g).toHaveLength(PEA_CHROMOSOMES.length);
	// With no crossovers, the first two cells carry the mother's copies of all three.
	expect(plain[0].map((c) => originAt(c, 0.1))).toEqual([0, 0, 0]);
	expect(plain[3].map((c) => originAt(c, 0.1))).toEqual([1, 1, 1]);
	// 3 pairs, 2 ways each: 8 different gametes, all equally likely.
	const kinds = gameteKinds(hybrid, PEA_GENES);
	expect(kinds.size).toBe(8);
	for (const p of kinds.values()) expect(p).toBeCloseTo(1 / 8, 10);
});

test('Yy × Yy gives 3 yellow to 1 green, like Mendel’s 6022 : 2001', () => {
	const mother = genotype({ Y: 'Yy' });
	const exp = expected([COLOUR], mother, mother);
	expect(exp.get('yellow')).toBeCloseTo(0.75, 10);
	const kids = breed(PEA_CHROMOSOMES, [COLOUR], mother, mother, 4000, 11);
	const t = tally(kids);
	expect(chiSquare(t, exp)).toBeLessThan(CHI2_1);
	// Mendel’s own counts fit 3 : 1 too.
	const m = new Map(Object.entries(MENDEL.colour));
	expect(chiSquare(m, exp)).toBeLessThan(CHI2_1);
});

test('two genes on different chromosomes give 9 : 3 : 3 : 1, like Mendel’s 315 : 108 : 101 : 32', () => {
	const f1 = genotype({ R: 'Rr', Y: 'Yy' });
	const exp = expected([SHAPE, COLOUR], f1, f1);
	expect(exp.get('round, yellow')).toBeCloseTo(9 / 16, 10);
	expect(exp.get('wrinkled, green')).toBeCloseTo(1 / 16, 10);
	const kids = breed(PEA_CHROMOSOMES, [SHAPE, COLOUR], f1, f1, 4000, 5);
	expect(chiSquare(tally(kids), exp)).toBeLessThan(CHI2_3);
	expect(chiSquare(new Map(Object.entries(MENDEL.dihybrid)), exp)).toBeLessThan(CHI2_3);
});

test('a recessive trait skips a generation: YY × yy gives no green seeds, their children ¼', () => {
	const f1 = breed(PEA_CHROMOSOMES, [COLOUR], genotype({ Y: 'YY' }), genotype({ Y: 'yy' }), 500, 2);
	expect(f1.every((k) => k.traits === 'yellow')).toBe(true);
	const exp = expected([COLOUR], genotype({ Y: 'Yy' }), genotype({ Y: 'Yy' }));
	expect(exp.get('green')).toBeCloseTo(0.25, 10);
});

test('genes on one chromosome: parental gametes outnumber recombinants', () => {
	const near = { ...COLOUR, id: 'B', chromosome: 1, at: COLOUR.at + 0.1 };
	const parent = { Y: ['Y', 'y'], B: ['B', 'b'] } as Record<string, [string, string]>;
	const kinds = gameteKinds(parent, [COLOUR, near]);
	const r = haldane(0.1);
	expect(kinds.get('YB')).toBeCloseTo((1 - r) / 2, 10);
	expect(kinds.get('Yb')).toBeCloseTo(r / 2, 10);
});

test('human map: about 35 crossovers per gamete, as the 3,500 cM map implies', () => {
	const total = HUMAN_AUTOSOMES.reduce((s, c) => s + c.cM, 0);
	expect(total).toBeGreaterThan(3400);
	expect(total).toBeLessThan(3700);
	const rand = rng(9);
	let crossings = 0;
	const n = 200;
	for (let i = 0; i < n; i++) {
		// Each switch of grandparent along a child's chromosome is a crossover in the parent.
		crossings += human(rand).fromMother.reduce((s, c) => s + c.length - 1, 0);
	}
	// 3,544 cM: about 35 crossovers on the chromosomes a child receives from one parent.
	expect(crossings / n).toBeGreaterThan(32);
	expect(crossings / n).toBeLessThan(39);
});

test('full siblings share about half their genome, and it varies (Visscher et al. 2006)', () => {
	const rand = rng(21);
	const s: number[] = [];
	for (let i = 0; i < 400; i++) s.push(shared(human(rand), human(rand)));
	const mean = s.reduce((a, b) => a + b, 0) / s.length;
	const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1));
	// Measured in 4,401 sibling pairs: mean 0.498, SD 0.036, range 0.374–0.617.
	expect(mean).toBeGreaterThan(0.48);
	expect(mean).toBeLessThan(0.52);
	expect(sd).toBeGreaterThan(0.028);
	expect(sd).toBeLessThan(0.046);
});
