// Checks the chromatography column (a Giddings–Eyring particle simulation with diffusion and
// multipath dispersion) against the textbook results it should reproduce: retention times
// t_R = t_M(1 + k′), plate heights that trace the van Deemter curve with a best flow speed,
// a reduced plate height of about 2 at that speed, resolution growing as √L, and peaks that are
// near-Gaussian with many hops but tail with few. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DEFAULT,
	elute,
	fitVanDeemter,
	hopTimes,
	movingTime,
	peak,
	resolution,
	sweep,
	theory
} from '../src/routes/chromatography/model';

test('a compound comes out at t_R = t_M(1 + k′): it moves only 1/(1 + k′) of the time', () => {
	for (const u of [0.3, 1, 4]) {
		const c = { ...DEFAULT, u };
		const tM = c.L / u;
		for (const k of [0, 0.5, 2, 5]) {
			const { mean } = peak(elute(c, { k }, 1500, 11).times, c.L);
			expect(mean / (tM * (1 + k)), `u ${u}, k′ ${k}`).toBeCloseTo(1, 2);
		}
	}
	// The same fraction, molecule by molecule, in the close-up's hops.
	for (const k of [1, 3]) {
		let moving = 0;
		for (let s = 0; s < 200; s++) moving += movingTime(hopTimes(k, 1, 400, s), 400) / 400;
		expect(moving / 200).toBeCloseTo(1 / (1 + k), 2);
	}
});

test('the measured plate height traces the van Deemter curve, with a best flow speed inside', () => {
	const points = sweep({ k: 2 }, 5, DEFAULT.L, 2000, 101);
	const fit = fitVanDeemter(points);
	const th = theory(DEFAULT, { k: 2 });
	// The three terms the random walk produces are the textbook ones: A = 2λd_p (flow plays no
	// part), B = 2γD_m and the Giddings–Eyring exchange term C = 2k′/((1 + k′)² k_d).
	expect(fit.A / th.A).toBeGreaterThan(0.8);
	expect(fit.A / th.A).toBeLessThan(1.2);
	expect(fit.B / th.B).toBeGreaterThan(0.85);
	expect(fit.B / th.B).toBeLessThan(1.15);
	expect(fit.C / th.C).toBeGreaterThan(0.85);
	expect(fit.C / th.C).toBeLessThan(1.15);
	// An interior minimum: slow and fast flow both give clearly taller plates.
	const Hs = points.map((p) => p.H);
	const best = Math.min(...Hs);
	expect(fit.uOpt).toBeGreaterThan(0.5);
	expect(fit.uOpt).toBeLessThan(2);
	expect(Hs[0]).toBeGreaterThan(1.8 * best);
	expect(Hs[Hs.length - 1]).toBeGreaterThan(1.8 * best);
	// A well-packed column: the best plate is about two particle diameters (h ≈ 2).
	expect(fit.Hmin / 0.005).toBeGreaterThan(1.2);
	expect(fit.Hmin / 0.005).toBeLessThan(2.5);
});

test('finer packing lowers the best plate height and moves the best flow speed up', () => {
	const coarse = fitVanDeemter(sweep({ k: 2 }, 10, DEFAULT.L, 1500, 7));
	const fine = fitVanDeemter(sweep({ k: 2 }, 2, DEFAULT.L, 1500, 7));
	expect(fine.Hmin).toBeLessThan(coarse.Hmin / 3);
	expect(fine.uOpt).toBeGreaterThan(3 * coarse.uOpt);
});

test('resolution grows as the square root of the column length', () => {
	const rs = (L: number) => {
		const c = { ...DEFAULT, L };
		const a = peak(elute(c, { k: 1.8 }, 3000, 21).times, L);
		const b = peak(elute(c, { k: 2 }, 3000, 22).times, L);
		return resolution(a, b);
	};
	const ratio = rs(100) / rs(25);
	expect(ratio).toBeGreaterThan(1.8);
	expect(ratio).toBeLessThan(2.2);
	// Fixed retention factors: the peaks stay just as far apart in units of t_M, so the gain is
	// the plate count, N = L/H, under a square root.
});

test('many hops give a near-Gaussian peak; few hops or a few very sticky sites make it tail', () => {
	const even = elute(DEFAULT, { k: 2 }, 4000, 31);
	expect(even.hops).toBeGreaterThan(10000);
	expect(Math.abs(peak(even.times, DEFAULT.L).skew)).toBeLessThan(0.15);
	const slow = elute(DEFAULT, { k: 2, exchange: 1 / 2000 }, 4000, 32);
	expect(slow.hops).toBeLessThan(30);
	expect(peak(slow.times, DEFAULT.L).skew).toBeGreaterThan(0.3);
	const sticky = elute(DEFAULT, { k: 2, sticky: { share: 1e-4, hold: 2 } }, 4000, 33);
	expect(peak(sticky.times, DEFAULT.L).skew).toBeGreaterThan(0.6);
});
