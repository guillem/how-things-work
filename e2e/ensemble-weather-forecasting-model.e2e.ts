// Checks the forecasting model against the published results it should reproduce: the
// largest Lyapunov exponents of Lorenz 63 (≈ 0.906) and Lorenz 96 at F = 8 (errors doubling in
// about 0.42 time units, Lorenz's 2.1 days), the levels a single forecast and an ensemble mean
// saturate at, spread that matches the error in a perfect model and falls short of it in a
// wrong one, reliable probabilities, and an ensemble Kalman filter whose analysis beats the
// observations. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	CLIMATE,
	DT,
	DT63,
	PER_DAY,
	STEPS_PER_DAY,
	climate,
	cycle,
	forecast,
	horizon,
	l63Step,
	l96Step,
	lyapunov,
	reliability,
	verify,
	weather
} from '../src/routes/ensemble-weather-forecasting/model';

test("Lorenz 63's largest Lyapunov exponent is about 0.906", () => {
	const s = Float64Array.from([1, 1, 1]);
	for (let i = 0; i < 2000; i++) l63Step(s);
	const lam = lyapunov((x) => l63Step(x), s, { dt: DT63, steps: 400_000 });
	expect(lam).toBeGreaterThan(0.886);
	expect(lam).toBeLessThan(0.926);
});

test("Lorenz 96 at F = 8: small errors double in about 0.42 time units, Lorenz's 2.1 days", () => {
	const lam = lyapunov((x) => l96Step(x), weather(3), { dt: DT, steps: 40_000 });
	const doubling = Math.LN2 / lam;
	expect(doubling).toBeGreaterThan(0.38);
	expect(doubling).toBeLessThan(0.46);
	expect(doubling / PER_DAY).toBeGreaterThan(1.9);
	expect(doubling / PER_DAY).toBeLessThan(2.3);
	// and a 6-hour step is 0.05 units
	expect(STEPS_PER_DAY).toBe(4);
});

test('the climate the page quotes is the long-run climate of the model', () => {
	const c = climate(2000, 7);
	expect(Math.abs(c.mean - CLIMATE.mean)).toBeLessThan(0.05);
	expect(Math.abs(c.sd - CLIMATE.sd)).toBeLessThan(0.05);
});

test('a tenfold better measurement buys about three doublings, a week, not ten times the range', () => {
	const at = (obsErr: number) => horizon(verify({ obsErr, members: 1, F: 8, days: 30 }, 30).err);
	const coarse = at(0.3);
	const fine = at(0.03);
	// the default measurement gives about the useful range of today's global forecasts
	expect(coarse).toBeGreaterThan(8);
	expect(coarse).toBeLessThan(11);
	expect(fine - coarse).toBeGreaterThan(5.5);
	expect(fine - coarse).toBeLessThan(9);
});

test('at long range the ensemble mean beats a single forecast: σ against √2·σ', () => {
	const v = verify({ obsErr: 0.3, members: 51, F: 8, days: 30 }, 40);
	const late = (c: number[]) =>
		Math.sqrt(c.slice(-10 * STEPS_PER_DAY).reduce((a, e) => a + e * e, 0) / (10 * STEPS_PER_DAY));
	const single = late(v.err);
	const mean = late(v.meanErr);
	// a single run ends up as far from the truth as two random days are: √2 × the climate's spread
	expect(single / (Math.SQRT2 * CLIMATE.sd)).toBeGreaterThan(0.93);
	expect(single / (Math.SQRT2 * CLIMATE.sd)).toBeLessThan(1.07);
	// the mean of the members tends to the climate's average, whose error is the climate's spread
	expect(mean / CLIMATE.sd).toBeGreaterThan(0.93);
	expect(mean / CLIMATE.sd).toBeLessThan(1.07);
	expect(single / mean).toBeGreaterThan(1.3);
});

test("in a perfect model the spread matches the mean's error; a wrong model's fan is too narrow", () => {
	const day = (d: number) => d * STEPS_PER_DAY;
	const perfect = verify({ obsErr: 0.3, members: 51, F: 8, days: 8 }, 40);
	for (const d of [2, 4, 6, 8]) {
		const ratio = perfect.spread[day(d)] / perfect.meanErr[day(d)];
		expect(ratio, `day ${d}`).toBeGreaterThan(0.85);
		expect(ratio, `day ${d}`).toBeLessThan(1.15);
	}
	const wrong = verify({ obsErr: 0.3, members: 51, F: 6.4, days: 8 }, 40);
	for (const d of [4, 6, 8]) {
		const ratio = wrong.spread[day(d)] / wrong.meanErr[day(d)];
		expect(ratio, `day ${d}`).toBeLessThan(0.75);
	}
});

test('perfect-model probabilities come true as often as they say, within sampling error', () => {
	const bins = reliability({ obsErr: 0.3, members: 51, F: 8 }, 5, 300, 6);
	let checked = 0;
	for (const b of bins) {
		if (b.count < 30) continue;
		const se = Math.sqrt((b.p * (1 - b.p)) / b.count);
		expect(Math.abs(b.observed - b.p), `bin at ${b.p.toFixed(2)}`).toBeLessThan(3 * se + 0.02);
		checked++;
	}
	expect(checked).toBeGreaterThanOrEqual(5);
});

test("a wrong model's probabilities are overconfident: when it says 0 %, rain still comes", () => {
	const bins = reliability({ obsErr: 0.3, members: 51, F: 6.4 }, 5, 300, 6);
	const low = bins[0];
	// when the wrong model says 0 %, rain (x above the threshold) still happens often
	expect(low.observed - low.p).toBeGreaterThan(0.04);
});

test('the forecast–observe–correct cycle keeps the analysis closer than the observations', () => {
	let ana = 0;
	let free = 0;
	let spread = 0;
	let n = 0;
	for (let seed = 1; seed <= 4; seed++) {
		const c = cycle({ seed, obsErr: 1, spacing: 2, every: 0.5, members: 51, days: 30 });
		for (let s = 10 * STEPS_PER_DAY; s < c.anaErr.length; s++) {
			ana += c.anaErr[s] ** 2;
			free += c.freeErr[s] ** 2;
			spread += c.spread[s] ** 2;
			n++;
		}
	}
	ana = Math.sqrt(ana / n);
	// half the cells are observed, each with error 1, yet every cell is known better than that
	expect(ana).toBeLessThan(0.7);
	// the forecast without corrections is as wrong as two random days
	expect(Math.sqrt(free / n)).toBeGreaterThan(4.5);
	// and the filter's own spread is an honest estimate of its error
	const ratio = Math.sqrt(spread / n) / ana;
	expect(ratio).toBeGreaterThan(0.8);
	expect(ratio).toBeLessThan(1.4);
});

test('the same seed gives the same weather and the same forecast', () => {
	const a = forecast({ seed: 5, obsErr: 0.3, members: 3, F: 8, days: 2 });
	const b = forecast({ seed: 5, obsErr: 0.3, members: 3, F: 8, days: 2 });
	expect(Array.from(a.members[1][8])).toEqual(Array.from(b.members[1][8]));
	expect(Array.from(a.truth[8])).toEqual(Array.from(b.truth[8]));
});
