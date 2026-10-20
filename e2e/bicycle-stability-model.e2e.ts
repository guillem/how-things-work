// The bicycle model: the linearised Whipple bicycle against the published benchmark values.
import { expect, test } from '@playwright/test';
import {
	BENCHMARK,
	eigenvalues,
	matrices,
	roots,
	simulate,
	stableBand,
	TWO_MASS_SKATE
} from '../src/routes/bicycle-stability/model';

const close = (a: number[][], b: number[][], digits = 10) =>
	a.forEach((row, i) => row.forEach((x, j) => expect(x).toBeCloseTo(b[i][j], digits)));

test('the benchmark bicycle’s matrices match Meijaard et al. (2007), table 2', () => {
	const m = matrices(BENCHMARK);
	close(m.M, [
		[80.81722, 2.31941332208709],
		[2.31941332208709, 0.29784188199686]
	]);
	close(m.C1, [
		[0, 33.86641391492494],
		[-0.85035641456978, 1.6854039739756]
	]);
	close(m.K0, [
		[-80.95, -2.59951685249872],
		[-2.59951685249872, -0.80329488458618]
	]);
	close(m.K2, [
		[0, 76.59734589573222],
		[0, 2.65431523794604]
	]);
});

test('the benchmark bicycle is self-stable between the weave speed 4.29 m/s and the capsize speed 6.02 m/s', () => {
	const band = stableBand(matrices(BENCHMARK))!;
	expect(band.from).toBeCloseTo(4.2924, 3);
	expect(band.to).toBeCloseTo(6.0243, 3);
});

test('the roots of a known polynomial', () => {
	// (s + 1)(s + 2)(s² + 2s + 5): roots −1, −2, −1 ± 2i.
	const r = roots([1, 5, 13, 19, 10]);
	const sorted = r
		.map((z) => [+z.re.toFixed(9), +Math.abs(z.im).toFixed(9)])
		.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
	expect(sorted).toEqual([
		[-2, 0],
		[-1, 0],
		[-1, 2],
		[-1, 2]
	]);
});

test('below the band the weave grows, above it the capsize mode grows slowly', () => {
	const m = matrices(BENCHMARK);
	const slow = eigenvalues(m, 3);
	// An oscillating mode (complex pair) with a positive real part.
	expect(slow.some((e) => e.re > 0 && e.im !== 0)).toBe(true);
	const fast = eigenvalues(m, 8);
	// A single real eigenvalue just above zero: a slow, non-oscillating fall.
	const unstable = fast.filter((e) => e.re > 0);
	expect(unstable).toHaveLength(1);
	expect(unstable[0].im).toBe(0);
	expect(unstable[0].re).toBeLessThan(0.2);
});

test('without the wheels’ gyroscopic effect the benchmark bicycle is not self-stable at any speed up to 15 m/s', () => {
	expect(stableBand(matrices(BENCHMARK, { gyro: false }))).toBeNull();
});

test('without trail the benchmark bicycle keeps only a sliver of a band, near 3 m/s', () => {
	const band = stableBand(matrices({ ...BENCHMARK, c: 0 }))!;
	expect(band.to - band.from).toBeLessThan(0.3);
	expect(band.from).toBeGreaterThan(2.8);
	expect(band.to).toBeLessThan(3.2);
});

test('the two-mass-skate bicycle, with no gyroscopic effect and no trail, is self-stable above a speed', () => {
	const band = stableBand(matrices(TWO_MASS_SKATE), 30)!;
	expect(band).not.toBeNull();
	expect(band.to).toBe(Infinity);
});

test('pushed sideways in the band, the bicycle recovers; below it, it falls', () => {
	const m = matrices(BENCHMARK);
	const ok = simulate(BENCHMARK, m, 5, { duration: 8 });
	expect(Math.abs(ok[ok.length - 1].phi)).toBeLessThan(0.01);
	const slow = simulate(BENCHMARK, m, 2, { duration: 4 });
	expect(Math.abs(slow[slow.length - 1].phi)).toBeGreaterThan(0.5);
});

test('countersteering: a steer torque to the left first steers left, which leans the bicycle right', () => {
	const m = matrices(BENCHMARK);
	// Positive steer torque steers right in the benchmark's axes; use a negative (left) one.
	const run = simulate(BENCHMARK, m, 5, { push: 0, torque: -0.3, duration: 3 });
	const early = run.find((s) => s.t >= 0.3)!;
	expect(early.delta).toBeLessThan(0);
	expect(early.phi).toBeGreaterThan(0);
	// ...and then it turns right, the other way to the twist.
	expect(run[run.length - 1].psi).toBeGreaterThan(0.2);
});

test('steering axes closer to vertical than 10° have no self-stable band', () => {
	expect(stableBand(matrices({ ...BENCHMARK, lambda: (9 * Math.PI) / 180 }))).toBeNull();
	expect(stableBand(matrices({ ...BENCHMARK, lambda: (10 * Math.PI) / 180 }))).not.toBeNull();
});
