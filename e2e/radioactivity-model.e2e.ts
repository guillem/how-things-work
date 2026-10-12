// Checks the radioactive-decay model against the decay law and real nuclear
// data (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	C14,
	Am241,
	Tc99m,
	U238,
	ageUncertainty,
	decay,
	expected,
	label,
	makeSample,
	nameOf,
	radiocarbonAge,
	spread,
	survivors
} from '../src/routes/radioactivity/model';

test('after two half-lives a quarter of the nuclei remain, not none', () => {
	expect(expected(1000, 2, 1)).toBeCloseTo(250, 9);
	expect(expected(1000, 2 * C14.halfLife, C14.halfLife)).toBeCloseTo(250, 9);
	expect(expected(1000, 3, 1)).toBeCloseTo(125, 9);
	// A simulated sample of 1,000 is close to that too (well within 4σ ≈ 55).
	const left = survivors(makeSample(1000, 7), 2);
	expect(Math.abs(left - 250)).toBeLessThan(4 * spread(1000, 2, 1));
	expect(left).toBeGreaterThan(0);
});

test('a simulated sample follows the exponential curve within a few σ', () => {
	for (const seed of [1, 2, 3, 42]) {
		const sample = makeSample(1000, seed);
		for (const halves of [0.25, 0.5, 1, 1.5, 2, 3, 4, 6]) {
			const n = survivors(sample, halves);
			const sigma = spread(1000, halves, 1);
			expect(Math.abs(n - expected(1000, halves, 1))).toBeLessThan(4 * sigma);
		}
		expect(survivors(sample, 0)).toBe(1000);
		// The count never follows the curve to zero on a fixed date, but after 40 half-lives all are gone.
		expect(survivors(sample, 40)).toBe(0);
	}
});

test('a nucleus lives 1 / ln 2 ≈ 1.44 half-lives on average', () => {
	// Exponential lifetimes: the mean lifetime is T½ / ln 2, and its spread equals its mean.
	const life = makeSample(200_000, 9).life;
	const mean = life.reduce((sum, x) => sum + x, 0) / life.length;
	const tau = 1 / Math.LN2;
	expect(Math.abs(mean - tau)).toBeLessThan((4 * tau) / Math.sqrt(life.length));
});

test('the same seed gives the same sample, a different seed a different one', () => {
	const a = makeSample(1000, 5);
	expect(Array.from(makeSample(1000, 5).life)).toEqual(Array.from(a.life));
	expect(Array.from(makeSample(1000, 6).life)).not.toEqual(Array.from(a.life));
});

test('the survivors of a large sample halve every half-life, whatever its age', () => {
	const sample = makeSample(200_000, 11);
	for (const start of [0, 1, 3]) {
		const before = survivors(sample, start);
		const after = survivors(sample, start + 1);
		expect(after / before).toBeCloseTo(0.5, 1);
	}
});

test('radiocarbon dating: 25 % of the carbon-14 left means about 11,400 years', () => {
	expect(C14.halfLife).toBe(5700);
	expect(radiocarbonAge(0.25)).toBeCloseTo(11_400, 6);
	expect(radiocarbonAge(0.5)).toBeCloseTo(5700, 6);
	expect(radiocarbonAge(1)).toBe(0);
	// 10 % left: about 18,900 years.
	expect(radiocarbonAge(0.1)).toBeGreaterThan(18_900);
	expect(radiocarbonAge(0.1)).toBeLessThan(19_000);
	// The ± 30 y on the half-life alone moves two half-lives by ± 60 y.
	expect(ageUncertainty(0.25)).toBeCloseTo(60, 6);
});

test('alpha decay lowers Z by 2 and A by 4: americium-241 becomes neptunium-237', () => {
	const d = decay(Am241, 'alpha');
	expect(label(d)).toBe('Np-237');
	expect(nameOf(d.z)).toBe('Neptunium');
	expect(label(decay(U238, 'alpha'))).toBe('Th-234');
});

test('beta-minus decay raises Z by 1 and keeps A: carbon-14 becomes nitrogen-14', () => {
	const d = decay(C14, 'beta');
	expect(label(d)).toBe('N-14');
	expect(nameOf(d.z)).toBe('Nitrogen');
});

test('gamma decay changes neither Z nor A: technetium-99m becomes technetium-99', () => {
	expect(label(Tc99m)).toBe('Tc-99m');
	const d = decay(Tc99m, 'gamma');
	expect(label(d)).toBe('Tc-99');
	expect(nameOf(d.z)).toBe('Technetium');
});
