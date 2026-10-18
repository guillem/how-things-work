// Checks the Ising page's model against exact results: Onsager's critical temperature, energy
// and spontaneous magnetisation of the square lattice; an exact enumeration of every state of a
// 4 × 4 lattice; the transfer-matrix solution of the ring; and, in the curves the page ships,
// the finite-size behaviour of the peaks (towards T_c in two dimensions, no transition in one).
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	FieldSweep,
	Lattice,
	TC,
	chainExact,
	loopArea,
	measure,
	onsagerEnergy,
	onsagerHeatCapacity,
	onsagerM
} from '../src/routes/ising-model/ising';
import { at, curve, peak } from '../src/routes/ising-model/curves';

test('Onsager: T_c = 2 / ln(1 + √2) ≈ 2.269, where the energy per spin is −√2', () => {
	expect(TC).toBeCloseTo(2.269185, 6);
	expect(onsagerEnergy(TC)).toBeCloseTo(-Math.SQRT2, 6);
	// the ground state (all aligned, two bonds per spin) and the hot limit
	expect(onsagerEnergy(0.2)).toBeCloseTo(-2, 6);
	expect(onsagerEnergy(1000)).toBeGreaterThan(-0.01);
	// the heat capacity's logarithmic divergence: it keeps growing as T approaches T_c
	expect(onsagerHeatCapacity(TC - 0.01)).toBeGreaterThan(onsagerHeatCapacity(TC - 0.1) + 1);
	// and it is the slope of the energy
	const d = 1e-4;
	expect(onsagerHeatCapacity(2)).toBeCloseTo(
		(onsagerEnergy(2 + d) - onsagerEnergy(2 - d)) / (2 * d),
		4
	);
});

test('the spontaneous magnetisation rises continuously from zero below T_c, as (T_c − T)^(1/8)', () => {
	expect(onsagerM(TC)).toBe(0);
	expect(onsagerM(3)).toBe(0);
	expect(onsagerM(1)).toBeCloseTo(0.9993, 4);
	// continuous: tiny just below T_c, but rising steeply
	expect(onsagerM(TC - 1e-6)).toBeLessThan(0.25);
	const ratio = onsagerM(TC - 1e-4) / onsagerM(TC - 1e-6);
	expect(ratio).toBeCloseTo(100 ** (1 / 8), 2);
});

/** Exact averages of a 4 × 4 torus by summing over all 2¹⁶ states. */
function exact4x4(T: number) {
	const L = 4;
	let Z = 0;
	let sm = 0;
	let se = 0;
	for (let c = 0; c < 1 << 16; c++) {
		const s = (i: number) => ((c >> i) & 1 ? 1 : -1);
		let E = 0;
		let M = 0;
		for (let y = 0; y < L; y++)
			for (let x = 0; x < L; x++) {
				const i = y * L + x;
				M += s(i);
				E -= s(i) * (s(y * L + ((x + 1) % L)) + s(((y + 1) % L) * L + x));
			}
		const w = Math.exp(-E / T);
		Z += w;
		sm += w * Math.abs(M / 16);
		se += w * (E / 16);
	}
	return { m: sm / Z, e: se / Z };
}

test('Metropolis and Wolff sample the Boltzmann distribution: a 4 × 4 lattice against all 65,536 states', () => {
	for (const T of [1.8, 2.5]) {
		const ex = exact4x4(T);
		const metro = new Lattice(4, 4, 11);
		const wolff = new Lattice(4, 4, 12);
		let mm = 0;
		let em = 0;
		let mw = 0;
		let ew = 0;
		const n = 60000;
		for (let k = 0; k < n; k++) {
			metro.metropolis(T);
			wolff.wolff(T);
			mm += Math.abs(metro.magnetisation());
			em += metro.energy();
			mw += Math.abs(wolff.magnetisation());
			ew += wolff.energy();
		}
		expect(Math.abs(mm / n - ex.m)).toBeLessThan(0.01);
		expect(Math.abs(em / n - ex.e)).toBeLessThan(0.02);
		expect(Math.abs(mw / n - ex.m)).toBeLessThan(0.01);
		expect(Math.abs(ew / n - ex.e)).toBeLessThan(0.02);
	}
});

test('a 32 × 32 lattice follows Onsager’s magnetisation and energy away from T_c', () => {
	for (const T of [1.8, 2.1]) {
		const a = measure(new Lattice(32, 32, 5), T, 200, 1500);
		expect(Math.abs(a.m - onsagerM(T))).toBeLessThan(0.01);
		expect(Math.abs(a.e - onsagerEnergy(T))).toBeLessThan(0.01);
	}
	// above T_c the infinite lattice has no magnetisation; 1,024 spins keep a little, ~1/32
	const hot = measure(new Lattice(32, 32, 6), 3, 200, 1500);
	expect(hot.m).toBeLessThan(0.12);
	expect(Math.abs(hot.e - onsagerEnergy(3))).toBeLessThan(0.015);
});

test('the ring matches its exact transfer-matrix solution', () => {
	for (const T of [1, 2]) {
		const N = 64;
		const a = measure(new Lattice(N, 1, 9), T, 200, 6000);
		const ex = chainExact(T, N);
		expect(Math.abs(a.e - ex.e)).toBeLessThan(0.01);
		expect(a.m2 / ex.m2).toBeGreaterThan(0.85);
		expect(a.m2 / ex.m2).toBeLessThan(1.15);
	}
	// the infinite chain's energy per spin is −tanh(1/T)
	expect(chainExact(1.5, 4096).e).toBeCloseTo(-Math.tanh(1 / 1.5), 6);
});

test('square lattices: the susceptibility peaks just above T_c, closer and taller as they grow', () => {
	const sizes = [8, 16, 32, 64];
	const peaks = sizes.map((L) => peak(curve(2, L), 'chi'));
	for (let k = 0; k < sizes.length; k++) {
		expect(peaks[k].T).toBeGreaterThan(TC - 0.02);
		if (k > 0) {
			expect(peaks[k].T).toBeLessThanOrEqual(peaks[k - 1].T);
			// χ_max ∝ L^(7/4): doubling L multiplies it by 2^1.75 ≈ 3.4
			expect(peaks[k].value / peaks[k - 1].value).toBeGreaterThan(2.8);
			expect(peaks[k].value / peaks[k - 1].value).toBeLessThan(4);
		}
	}
	expect(peaks[3].T - TC).toBeLessThan(0.08);
	// the heat capacity peak grows too, but only like ln L
	const c = sizes.map((L) => peak(curve(2, L), 'c').value);
	expect(c[3]).toBeGreaterThan(c[0] + 0.5);
	expect(c[3]).toBeLessThan(c[0] + 1.5);
	// below T_c the 64 × 64 lattice is on Onsager's curve
	for (const T of [1.6, 2.0, 2.2]) {
		expect(Math.abs(at(curve(2, 64), 'm', T) - onsagerM(T))).toBeLessThan(0.02);
	}
});

test('rings never order: the magnetisation at any fixed temperature falls as they grow', () => {
	for (const T of [0.5, 1, 2]) {
		const m = [16, 64, 256, 1024].map((N) => at(curve(1, N), 'm', T));
		for (let k = 1; k < m.length; k++) expect(m[k]).toBeLessThan(m[k - 1]);
	}
	expect(at(curve(1, 1024), 'm', 1)).toBeLessThan(0.15);
	// the heat capacity is a broad bump near T ≈ 0.83 (the infinite chain's (1/T²) sech²(1/T))
	// that doesn't sharpen with size
	const big = peak(curve(1, 1024), 'c');
	expect(Math.abs(big.T - 0.83)).toBeLessThan(0.1);
	expect(Math.abs(big.value - 0.44)).toBeLessThan(0.04);
});

test('hysteresis: below T_c a swept field traces an open loop; above, it nearly closes', () => {
	const run = (T: number, per: number) => {
		const f = new FieldSweep(32, 1.5, per, 3);
		f.advance(2 * per, T);
		return { area: loopArea(f.hs, f.ms, per), f };
	};
	const cold = run(1.5, 200);
	expect(cold.area).toBeGreaterThan(3);
	// the magnet remembers: where the field crosses zero on the way down, m is still near +1
	expect(cold.f.ms[200 + 49]).toBeGreaterThan(0.9);
	const hot = run(3, 200);
	expect(hot.area).toBeLessThan(cold.area / 3);
	// above T_c the remaining width is lag: a slower sweep shrinks it
	expect(run(3, 800).area).toBeLessThan(hot.area * 0.6);
});
