// Checks the acid–base model against textbook equilibrium results (definition of
// done #5 in docs/TOPICS.md) and the numbers the narrative quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ACIDS,
	DROP,
	INDICATORS,
	acidPH,
	dissociated,
	equivalenceVolume,
	indicatorBase,
	ionsInCube,
	solvePH,
	standard,
	titrationCurve,
	titrationPH,
	WATER_IN_CUBE
} from '../src/routes/acids-bases/model';
import { LIQUIDS } from '../src/routes/acids-bases/liquids';

const strong = standard(ACIDS.hcl);
const weak = standard(ACIDS.acetic);

test('pure water at 25 °C is neutral, with pH + pOH = pKw', () => {
	const ph = solvePH({});
	expect(ph).toBeCloseTo(7, 6);
	const n = ionsInCube(ph);
	expect(n.h).toBeCloseTo(n.oh, 6);
	// About 60 of each in a 1 µm cube, among some 33 billion water molecules.
	expect(Math.round(n.h)).toBe(60);
	expect(WATER_IN_CUBE / 1e9).toBeCloseTo(33.3, 0);
});

test('each pH step is a tenfold change in hydrogen ions', () => {
	expect(acidPH(ACIDS.hcl, 0.1)).toBeCloseTo(1.0, 3);
	expect(acidPH(ACIDS.hcl, 0.01)).toBeCloseTo(2.0, 3);
	expect(ionsInCube(5).h / ionsInCube(6).h).toBeCloseTo(10, 9);
	// Very dilute acid cannot go above pH 7: water's own ions take over.
	const dilute = acidPH(ACIDS.hcl, 1e-8);
	expect(dilute).toBeGreaterThan(6.9);
	expect(dilute).toBeLessThan(7);
});

test('a weak acid gives away only a small share of its protons', () => {
	// 0.100 mol/L acetic acid: pH 2.88, about 1.3 % dissociated.
	expect(acidPH(ACIDS.acetic, 0.1)).toBeCloseTo(2.88, 2);
	expect(dissociated(ACIDS.acetic, 0.1)).toBeCloseTo(0.013, 3);
	expect(dissociated(ACIDS.hcl, 0.1)).toBe(1);
	// Diluting a weak acid makes a larger share dissociate.
	expect(dissociated(ACIDS.acetic, 0.001)).toBeGreaterThan(0.1);
});

test('strong acid with strong base: the jump at equivalence, pH 7 there', () => {
	expect(equivalenceVolume(strong)).toBeCloseTo(25, 9);
	expect(titrationPH(strong, 0)).toBeCloseTo(1.0, 3);
	expect(titrationPH(strong, 25 - DROP)).toBeCloseTo(4.0, 1);
	expect(titrationPH(strong, 25)).toBeCloseTo(7.0, 2);
	expect(titrationPH(strong, 25 + DROP)).toBeCloseTo(10.0, 1);
	// Half the acid neutralised barely moves the pH: 1.48.
	expect(titrationPH(strong, 12.5)).toBeCloseTo(1.48, 2);
	// Far past equivalence the pH heads towards that of the NaOH itself (13).
	expect(titrationPH(strong, 50)).toBeCloseTo(12.52, 2);
});

test('weak acid with strong base: half-way pH = pKa, equivalence above 7', () => {
	expect(titrationPH(weak, 0)).toBeCloseTo(2.88, 2);
	expect(Math.abs(titrationPH(weak, 12.5) - 4.756)).toBeLessThan(0.01);
	const eq = titrationPH(weak, equivalenceVolume(weak));
	expect(eq).toBeGreaterThan(8.7);
	expect(eq).toBeLessThan(8.75);
	expect(eq).toBeGreaterThan(7.5);
	// The hypochlorous acid is weaker still: a higher equivalence pH.
	expect(titrationPH(standard(ACIDS.hocl), 25)).toBeGreaterThan(eq);
});

test('the steepest point of each curve is the equivalence point', () => {
	for (const T of [strong, weak]) {
		const c = titrationCurve(T, 50);
		let best = 1;
		let slope = 0;
		for (let k = 1; k < c.length; k++) {
			const s = (c[k].ph - c[k - 1].ph) / (c[k].v - c[k - 1].v);
			if (s > slope) {
				slope = s;
				best = k;
			}
		}
		const mid = (c[best].v + c[best - 1].v) / 2;
		expect(Math.abs(mid - equivalenceVolume(T))).toBeLessThan(DROP);
	}
});

test('indicators change colour across their stated ranges', () => {
	for (const ind of Object.values(INDICATORS)) {
		expect(indicatorBase(ind, ind.pKIn)).toBeCloseTo(0.5, 9);
		expect(indicatorBase(ind, ind.range[0])).toBeLessThan(0.25);
		expect(indicatorBase(ind, ind.range[1])).toBeGreaterThan(0.75);
	}
	// Methyl orange has finished turning yellow long before acetic acid's equivalence
	// point (pH 8.7); phenolphthalein turns pink right at it.
	const veq = equivalenceVolume(weak);
	const mo = INDICATORS.methylOrange;
	const vMO = titrationCurve(weak, 50, 0.05).find((p) => p.ph >= mo.range[1])!.v;
	expect(vMO).toBeLessThan(veq / 2);
	const pp = INDICATORS.phenolphthalein;
	const vPP = titrationCurve(weak, 50, 0.05).find((p) => p.ph >= pp.range[0])!.v;
	expect(Math.abs(vPP - veq)).toBeLessThan(0.1);
});

test('everyday liquids: computed ones match textbook values', () => {
	const ph = (id: string) => LIQUIDS.find((l) => l.id === id)!.lo;
	// Rain in equilibrium with today's CO₂: about 5.6.
	expect(ph('rain')).toBeCloseTo(5.6, 1);
	// Sodium bicarbonate sits near (pKa₁ + pKa₂)/2 = 8.34.
	expect(ph('soda')).toBeCloseTo(8.3, 1);
	expect(ph('ammonia')).toBeCloseTo(11.1, 1);
	expect(ph('naoh')).toBeCloseTo(13.0, 1);
	// Sorted from acidic to basic.
	const mids = LIQUIDS.map((l) => (l.lo + l.hi) / 2);
	expect([...mids].sort((a, b) => a - b)).toEqual(mids);
});
