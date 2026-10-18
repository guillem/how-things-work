// Checks the morphogen-gradient models against their analytic limits and against what is
// measured in the fly embryo: the synthesis–diffusion–degradation (SDD) model's steady state is
// the exponential (cosh) profile with λ = √(D/k); Bicoid's fitted constants (Durrieu et al. 2018)
// give their reported decay length of 89 µm, about a fifth of a 490 µm egg (Gregor et al. 2007:
// λ ~ 100 µm); λ grows as the square root of diffusion and of lifetime while production only
// scales the height; threshold boundaries stay put in µm when the tissue is doubled, but keep
// their share of the tissue with Ben-Zvi and Barkai's expansion–repression circuit; and a cell's
// error in reading its position, σ/|slope|, grows into the gradient's flat tail. Runs in Node.
import { expect, test } from '@playwright/test';
import { rng } from '../src/lib/draw/math';
import {
	BICOID,
	BICOID_LAMBDA,
	DX,
	EGG_LENGTH,
	Tissue,
	crossing,
	decayLength,
	positionalError,
	settled,
	steadySDD
} from '../src/routes/morphogen-gradients/model';

const bicoid = { D: BICOID.D, halfLife: BICOID.halfLife, prod: 1, expander: false };

test('the steady state is the analytic SDD profile, an exponential with λ = √(D/k)', () => {
	for (const L of [300, 500, 1000]) {
		const s = settled(L, bicoid);
		for (let i = 0; i < s.M.length; i += 10) {
			const x = (i + 0.5) * DX;
			const exact = steadySDD(x, { ...bicoid, L });
			expect(Math.abs(s.M[i] - exact) / exact).toBeLessThan(0.01);
		}
	}
	// far from the far end it falls by e every λ
	const lam = decayLength(BICOID.D, BICOID.halfLife);
	const t = new Tissue(1000, bicoid);
	t.settle();
	const at = (x: number) => t.value(x);
	expect(at(100) / at(100 + lam)).toBeCloseTo(Math.E, 1);
	expect(at(100) / at(100 + 2 * lam)).toBeCloseTo(Math.E ** 2, 0);
});

test("Bicoid's fitted D and half-life give its 89 µm decay length, about a fifth of the egg", () => {
	// Durrieu et al. 2018: D = 3.6 µm²/s, half-life 26 min, decay length 89 ± 7 µm
	const lam = decayLength(3.6, 26);
	expect(lam).toBeGreaterThan(85);
	expect(lam).toBeLessThan(97);
	const t = new Tissue(500, bicoid);
	t.settle();
	expect(Math.abs(t.fitLength() - lam)).toBeLessThan(3);
	// the measured gradient: λ ~ 100 µm in an egg of ~490 µm (Gregor et al. 2007)
	expect(BICOID_LAMBDA / EGG_LENGTH).toBeGreaterThan(0.18);
	expect(BICOID_LAMBDA / EGG_LENGTH).toBeLessThan(0.22);
	// the FRAP value D = 0.3 µm²/s (Gregor et al. 2007) gives far too short a gradient
	expect(decayLength(0.3, 26)).toBeLessThan(BICOID_LAMBDA / 3);
});

test('λ grows as √D and √lifetime; production changes the height, not the shape', () => {
	const fit = (p: typeof bicoid) => {
		const t = new Tissue(1000, p);
		t.settle();
		return t.fitLength();
	};
	const base = fit(bicoid);
	expect(fit({ ...bicoid, D: BICOID.D * 4 }) / base).toBeCloseTo(2, 1);
	expect(fit({ ...bicoid, halfLife: BICOID.halfLife * 4 }) / base).toBeCloseTo(2, 1);
	expect(fit({ ...bicoid, prod: 2 }) / base).toBeCloseTo(1, 2);
	// twice the production moves a threshold's boundary out by λ·ln 2
	const one = settled(1000, bicoid);
	const two = settled(1000, { ...bicoid, prod: 2 });
	const shift = crossing(two.M, 20)! - crossing(one.M, 20)!;
	expect(shift).toBeCloseTo(decayLength(BICOID.D, BICOID.halfLife) * Math.LN2, -1);
});

test('the gradient forms in about an hour and is settled within a few lifetimes', () => {
	const t = new Tissue(500, bicoid);
	const final = settled(500, bicoid).M[0];
	expect(t.at(15 * 60).M[0]).toBeLessThan(0.8 * final);
	expect(t.at(60 * 60).M[0]).toBeGreaterThan(0.85 * final);
	expect(t.at(3 * 60 * 60).M[0]).toBeGreaterThan(0.99 * final);
});

test('doubling the tissue leaves the boundaries where they were in µm: the pattern does not scale', () => {
	const short = settled(500, bicoid);
	const long = settled(1000, bicoid);
	for (const T of [35, 10]) {
		const a = crossing(short.M, T)!;
		const b = crossing(long.M, T)!;
		expect(Math.abs(a - b)).toBeLessThan(2);
		expect(b / 1000).toBeCloseTo(a / 500 / 2, 2);
	}
});

test('with the expansion–repression circuit the boundaries keep their share of the tissue', () => {
	const on = { ...bicoid, expander: true };
	const share = (L: number, T: number) => crossing(settled(L, on).M, T)! / L;
	for (const T of [35, 10]) {
		const a = share(500, T);
		for (const L of [750, 1000, 1250]) expect(Math.abs(share(L, T) - a)).toBeLessThan(0.05);
	}
	// the expander widens the gradient: the far end is pinned near the repression threshold
	const long = settled(1000, on);
	expect(long.M[long.M.length - 1]).toBeGreaterThan(1.5);
	expect(long.M[long.M.length - 1]).toBeLessThan(4);
});

test('a reading error blurs a boundary by σ/|slope|: sharp where steep, blurred in the tail', () => {
	const s = settled(500, bicoid);
	const sigma = 2;
	const near = positionalError(s.M, 35, sigma)!;
	const far = positionalError(s.M, 5, sigma)!;
	expect(far).toBeGreaterThan(5 * near);
	// in an exponential, σ_x = λ·σ/T
	const lam = decayLength(BICOID.D, BICOID.halfLife);
	expect(near).toBeCloseTo((lam * sigma) / 35, 0);
	// check it by simulation for a small error: each cell reads M plus Gaussian noise; the share of
	// readings above T falls from 1 to 0 across the boundary, and the width of that fall (the
	// standard deviation of its slope) is the positional error
	const rand = rng(7);
	const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
	const width = (T: number, sd: number) => {
		const trials = 4000;
		const above = Array.from(s.M, (m) => {
			let n = 0;
			for (let k = 0; k < trials; k++) if (m + sd * gauss() >= T) n++;
			return n / trials;
		});
		let w = 0;
		let mean = 0;
		let sq = 0;
		for (let i = 1; i < above.length; i++) {
			const drop = above[i - 1] - above[i];
			const x = i * DX;
			w += drop;
			mean += drop * x;
			sq += drop * x * x;
		}
		mean /= w;
		return Math.sqrt(sq / w - mean * mean);
	};
	for (const T of [20, 10]) {
		const sd = T / 10;
		const predicted = positionalError(s.M, T, sd)!;
		expect(Math.abs(width(T, sd) - predicted) / predicted).toBeLessThan(0.15);
	}
});

test('a long jump in time is caught up over later calls, not skipped', () => {
	const capped = new Tissue(500, bicoid);
	const first = capped.at(86400, 1000);
	expect(first.t).toBeLessThan(86400);
	while (capped.at(86400, 1000).t < 86400);
	const direct = new Tissue(500, bicoid).at(86400, 1e6);
	expect(capped.at(86400).M[10]).toBeCloseTo(direct.M[10], 6);
});
