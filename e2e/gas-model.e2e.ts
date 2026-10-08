// Checks the gas and counting model behind the entropy explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEFAULT_GAS,
	E0,
	FPS,
	GasRun,
	H,
	PACKETS_PER_PARTICLE,
	W,
	choose,
	energyWays,
	formatCount,
	lnChoose,
	lnGamma,
	lnWaysGas,
	lnWaysGasMax,
	mostLikelyShare,
	shareCurve,
	temperature,
	toLog10
} from '../src/routes/entropy/gas';

const at = (s: number) => Math.round(s * FPS);
const temps = (run: GasRun, s: number) => {
	const st = run.statsAt(at(s));
	return {
		left: temperature(st.eLeft, st.nLeft),
		right: temperature(st.eRight, run.n - st.nLeft),
		total: (st.eLeft + st.eRight) / run.n / E0
	};
};
/** Average of f over [a, b] seconds, sampled every 0.1 s. */
const mean = (a: number, b: number, f: (s: number) => number) => {
	let sum = 0;
	let n = 0;
	for (let s = a; s <= b + 1e-9; s += 0.1, n++) sum += f(s);
	return sum / n;
};

test('counting: binomial coefficients and the numbers quoted in the text', () => {
	expect(lnGamma(1)).toBeCloseTo(0, 12);
	expect(lnGamma(11)).toBeCloseTo(Math.log(3628800), 10);
	expect([0, 1, 2, 3, 4].map((k) => choose(4, k))).toEqual([1n, 4n, 6n, 4n, 1n]);
	expect(choose(40, 20)).toBe(137846528820n); // "Twenty on each side … 137,846,528,820 ways"
	expect(lnChoose(40, 20)).toBeCloseTo(Math.log(137846528820), 8);
	expect(formatCount(2n ** 80n)).toBe('1.2 × 10²⁴'); // 2⁸⁰ ≈ 1.2 × 10²⁴
	expect(formatCount(choose(80, 40))).toBe('1.1 × 10²³');
	expect(formatCount({ log10: toLog10(lnChoose(80, 40)) })).toBe('1.1 × 10²³');
	expect(formatCount(16n)).toBe('16');
	// "all of them on the left is one arrangement out of 16"
	expect(choose(4, 4)).toBe(1n);
	expect(2 ** 4).toBe(16);
	// A litre of air (≈ 2.5 × 10²² molecules): all in one half ≈ 1 in 10^(7.5 × 10²¹).
	expect(2.5e22 * Math.log10(2)).toBeCloseTo(7.5e21, -20);
});

test('sharing energy: C(q + n − 1, q) ways, the peak at equal temperatures', () => {
	expect(energyWays(3, 2)).toBe(4n); // 3+0, 2+1, 1+2, 0+3
	expect(energyWays(2, 3)).toBe(6n);
	expect(energyWays(0, 5)).toBe(1n);
	// Equal halves: the most likely share is half the energy.
	const Q = PACKETS_PER_PARTICLE * 80;
	expect(mostLikelyShare(40, 40, Q)).toBe(Q / 2);
	// Unequal halves: the peak sits at (very nearly) equal energy per particle; exactly at
	// q / (n − 1) equal on both sides, the counts' E^(n−1) growth.
	const q = mostLikelyShare(20, 60, Q);
	expect(Math.abs(q / 20 - (Q - q) / 60) / PACKETS_PER_PARTICLE).toBeLessThan(0.05);
	expect(q / 19).toBeCloseTo((Q - q) / 59, 0);
	// "more than ten million times as many" as the start (80% of the energy on the left).
	const c = shareCurve(40, 40, Q);
	const ratio = toLog10(c[Q / 2] - c[0.8 * Q]);
	expect(ratio).toBeGreaterThan(7);
	expect(ratio).toBeLessThan(7.6);
	// With tiny packets it approaches the continuous count E^(n−1) used for the gas.
	const fine = shareCurve(40, 40, 40000);
	const gas = toLog10(lnWaysGas(80, 40, 40 * E0, 40 * E0) - lnWaysGas(80, 40, 64 * E0, 16 * E0));
	expect(toLog10(fine[20000] - fine[32000])).toBeCloseTo(gas, 1);
});

test('the gas: energy is conserved and the particles stay in the box', () => {
	const run = new GasRun({ ...DEFAULT_GAS, wallUntil: 1 });
	expect(temps(run, 0).left).toBeCloseTo(4, 6);
	expect(temps(run, 0).right).toBeCloseTo(1, 6);
	// Kinetic energy dips slightly while particles overlap (soft discs) but does not drift.
	const total = mean(15, 25, (s) => temps(run, s).total);
	expect(total).toBeGreaterThan(2.4);
	expect(total).toBeLessThan(2.5);
	for (const s of [5, 10, 20]) {
		const f = run.frame(at(s));
		for (let i = 0; i < run.n; i++) {
			expect(f.x[i]).toBeGreaterThan(0);
			expect(f.x[i]).toBeLessThan(W);
			expect(f.y[i]).toBeGreaterThan(0);
			expect(f.y[i]).toBeLessThan(H);
		}
	}
});

test('with the wall in place the temperatures stay apart; without it they equalise at the average', () => {
	const walled = new GasRun({ ...DEFAULT_GAS, wallUntil: Infinity });
	expect(mean(10, 20, (s) => temps(walled, s).left)).toBeGreaterThan(3.7);
	expect(mean(10, 20, (s) => temps(walled, s).right)).toBeLessThan(1.1);
	expect(walled.statsAt(at(20)).nLeft).toBe(40);

	for (const seed of [1, 2, 3]) {
		const run = new GasRun({ ...DEFAULT_GAS, wallUntil: 1.5, seed });
		// "both halves reach the same temperature, 2.5"
		const l = mean(10, 24, (s) => temps(run, s).left);
		const r = mean(10, 24, (s) => temps(run, s).right);
		expect(Math.abs(l - r)).toBeLessThan(0.35);
		expect((l + r) / 2).toBeCloseTo(2.45, 0);
	}
});

test('released from the left half, the particles spread to about half on each side', () => {
	const run = new GasRun({ ...DEFAULT_GAS, n: 40, layout: 'left', tLeft: 3, wallUntil: 0.8 });
	expect(run.statsAt(0).nLeft).toBe(40);
	const k = mean(10, 30, (s) => run.statsAt(at(s)).nLeft);
	expect(k).toBeGreaterThan(16);
	expect(k).toBeLessThan(24);
});

test('entropy rises to near its maximum, about ten million times the start', () => {
	const run = new GasRun({ ...DEFAULT_GAS, wallUntil: 1 });
	const lnW = (s: number) => run.lnWays(at(s));
	const start = lnW(0);
	const E = 80 * 2.5 * E0;
	const max = lnWaysGasMax(80, E);
	expect(toLog10(max - start)).toBeCloseTo(7.56, 1);
	expect(start).toBeCloseTo(lnWaysGas(80, 40, 40 * 4 * E0, 40 * E0), 6);
	// "hovers just below its highest possible value, at about 10 million times the start"
	const late = mean(10, 25, lnW);
	expect(toLog10(late - start)).toBeGreaterThan(6.8);
	expect(late).toBeLessThan(max);
});

test('reversing every velocity retraces the past exactly; a tiny nudge spoils it', () => {
	const cfg = { ...DEFAULT_GAS, wallUntil: 1, reversals: [9] };
	const forward = new GasRun({ ...DEFAULT_GAS, wallUntil: 1 });
	const back = new GasRun(cfg);
	// Frame 9 s + m after the reversal = frame 9 s − m before it, bit for bit.
	for (const m of [0, 1, 60, 240, 480]) {
		const a = forward.frame(at(9) - m);
		const b = back.frame(at(9) + m);
		expect(Array.from(b.x)).toEqual(Array.from(a.x));
		expect(Array.from(b.y)).toEqual(Array.from(a.y));
	}
	// 8 s after the reversal: hot left, cold right again (the wall lifted at 1 s).
	// (Kinetic energy is measured from the last step's displacement, one step apart here.)
	expect(temps(back, 17).left).toBeCloseTo(temps(forward, 1).left, 1);
	expect(temps(back, 17).left).toBeGreaterThan(3.8);

	for (const nudge of [1e-12, 1e-9, 1e-6]) {
		const nudged = new GasRun({ ...cfg, nudge });
		const t = temps(nudged, 17);
		expect(t.left).toBeLessThan(3.4);
		expect(t.right).toBeGreaterThan(1.6);
	}
});
