// Checks the epidemic models against SIR theory (definition of done #5 in
// docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	Crowd,
	finalSize,
	fizzleChance,
	herdThreshold,
	solveSir,
	type CrowdOptions
} from '../src/routes/epidemics/model';

const crowd = (o: Partial<CrowdOptions>) =>
	new Crowd({
		r0: 3,
		days: 7,
		vaccinated: 0,
		population: 300,
		initial: 1,
		seed: 1,
		size: 460,
		speed: 8,
		...o
	});

test('the final-size equation matches known values', () => {
	// Classic values of z = 1 − exp(−R0·z).
	expect(finalSize(2)).toBeCloseTo(0.7968, 3);
	expect(finalSize(3)).toBeCloseTo(0.9405, 3);
	expect(finalSize(1)).toBe(0);
	expect(finalSize(0.8)).toBe(0);
	// Vaccinating the threshold share stops growth; above it nothing happens.
	expect(finalSize(4, herdThreshold(4))).toBe(0);
	expect(finalSize(4, 0.8)).toBe(0);
	// Below the threshold, vaccination still shrinks the outbreak.
	expect(finalSize(4, 0.5)).toBeLessThan(finalSize(4, 0.2));
	expect(herdThreshold(4)).toBeCloseTo(0.75, 10);
});

test('the SIR equations peak when S/N = 1/R0 and end at the final size', () => {
	for (const r0 of [1.5, 2.5, 4]) {
		const run = solveSir({ r0, days: 5, vaccinated: 0, population: 1e6, initial: 1 }, 600, 0.05);
		const peak = run.reduce((a, b) => (b.i > a.i ? b : a));
		expect(peak.s / 1e6).toBeCloseTo(1 / r0, 2);
		expect(run.at(-1)!.r / 1e6).toBeCloseTo(finalSize(r0), 3);
		// Conservation.
		const drift = Math.max(...run.map((p) => Math.abs(p.s + p.i + p.r + p.v - 1e6)));
		expect(drift).toBeLessThan(1e-3);
	}
});

test('in a susceptible crowd, cases infect R0/D people per day', () => {
	// Transmissions per infectious person-day while almost everyone is still
	// susceptible: should be β = R0 / D.
	for (const [r0, days] of [
		[1.5, 7],
		[3, 7],
		[5, 2]
	]) {
		let infections = 0;
		let personDays = 0;
		for (let seed = 1; seed <= 60; seed++) {
			const c = crowd({ r0, days, population: 5000, initial: 5, seed });
			while (c.counts.s > 0.97 * c.n && !c.over) {
				personDays += c.counts.i * 0.1;
				const before = c.infections.length;
				c.advanceTo(c.day + 0.1);
				infections += c.infections.length - before;
			}
		}
		const beta = infections / personDays;
		expect(beta, `R0=${r0}, D=${days}`).toBeGreaterThan((r0 / days) * 0.92);
		expect(beta, `R0=${r0}, D=${days}`).toBeLessThan((r0 / days) * 1.08);
	}
});

test('the crowd reproduces the final size and the chance of fizzling out', () => {
	for (const r0 of [2, 3]) {
		let fizzled = 0;
		const sizes: number[] = [];
		const runs = 300;
		for (let seed = 1; seed <= runs; seed++) {
			const c = crowd({ r0, seed });
			c.advanceTo(1000);
			expect(c.over).toBe(true);
			const attack = c.counts.r / c.n;
			if (attack < 0.1) fizzled++;
			else sizes.push(attack);
		}
		const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
		expect(mean, `final size, R0=${r0}`).toBeCloseTo(finalSize(r0), 1);
		expect(Math.abs(fizzled / runs - fizzleChance(r0)), `fizzle, R0=${r0}`).toBeLessThan(0.07);
	}
});

test('vaccinating above the threshold protects the unvaccinated', () => {
	let total = 0;
	for (let seed = 1; seed <= 100; seed++) {
		const c = crowd({ r0: 3, vaccinated: 0.8, initial: 3, seed });
		c.advanceTo(1000);
		total += c.counts.r;
	}
	// Above the 67% threshold each chain dies out after a handful of cases.
	expect(total / 100).toBeLessThan(15);
});

test('a run is deterministic for a given seed', () => {
	const a = crowd({ seed: 42 });
	const b = crowd({ seed: 42 });
	a.advanceTo(80);
	b.advanceTo(40);
	b.advanceTo(80);
	expect(a.history.map((h) => h.i)).toEqual(b.history.map((h) => h.i));
	expect(a.x(7)).toBe(b.x(7));
});
