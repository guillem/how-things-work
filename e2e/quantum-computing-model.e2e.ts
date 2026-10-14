// Checks the state-vector simulator behind the quantum-computing explainer against textbook
// identities and closed-form results (definition of done #5 in docs/TOPICS.md). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	GATES,
	GATE_TURNS,
	anglesOf,
	apply,
	basis,
	bellPair,
	bestIterations,
	bloch,
	chsh,
	classicalTries,
	cnot,
	correlation,
	diffuse,
	fidelity,
	fromAngles,
	grover,
	groverSuccess,
	meanAmplitude,
	norm,
	oracle,
	pairOutcomes,
	pairRuns,
	phaseGate,
	probabilities,
	rotation,
	tally,
	turn,
	uniform,
	type GateName,
	type Matrix,
	type State
} from '../src/routes/quantum-computing/qubits';

const names = ['X', 'Y', 'Z', 'H', 'S', 'T'] as const;
const close = (a: State, b: State) => expect(fidelity(a, b)).toBeCloseTo(1, 12);
const seq = (s: State, ...gs: GateName[]) => gs.reduce((v, g) => apply(v, GATES[g], 0), s);
const some = [fromAngles(0.3, 1.1), fromAngles(2.1, 4), fromAngles(Math.PI / 2, 0.7)];

test('every gate keeps the total probability at 1', () => {
	for (const s of some)
		for (const g of names) expect(norm(apply(s, GATES[g], 0))).toBeCloseTo(1, 14);
	const two = apply(cnot(apply(basis(2), GATES.H, 0), 0, 1), GATES.T, 1);
	expect(norm(two)).toBeCloseTo(1, 14);
});

test('gate identities: HH = 1, HZH = X, S² = Z, T² = S, X² = 1', () => {
	for (const s of some) {
		close(seq(s, 'H', 'H'), s);
		close(seq(s, 'H', 'Z', 'H'), seq(s, 'X'));
		close(seq(s, 'S', 'S'), seq(s, 'Z'));
		close(seq(s, 'T', 'T'), seq(s, 'S'));
		close(seq(s, 'X', 'X'), s);
	}
	// the phase gate family: Z, S and T are P(π), P(π/2), P(π/4)
	const same = (g: Matrix, h: Matrix) =>
		g.forEach((z, i) => {
			expect(z.re).toBeCloseTo(h[i].re, 14);
			expect(z.im).toBeCloseTo(h[i].im, 14);
		});
	same(phaseGate(Math.PI), GATES.Z);
	same(phaseGate(Math.PI / 2), GATES.S);
	same(phaseGate(Math.PI / 4), GATES.T);
});

test('each gate is a turn of the Bloch sphere, up to an overall phase', () => {
	for (const g of names) {
		const { axis, angle, phase } = GATE_TURNS[g];
		const R = rotation(axis, angle);
		GATES[g].forEach((z, i) => {
			// G = e^{iγ} R
			const re = Math.cos(phase) * R[i].re - Math.sin(phase) * R[i].im;
			const im = Math.cos(phase) * R[i].im + Math.sin(phase) * R[i].re;
			expect(z.re).toBeCloseTo(re, 14);
			expect(z.im).toBeCloseTo(im, 14);
		});
		// and the Bloch vector turns by that angle about that axis
		for (const s of some) {
			const after = bloch(apply(s, GATES[g], 0));
			const turned = turn(bloch(s), axis, angle);
			after.forEach((v, i) => expect(v).toBeCloseTo(turned[i], 12));
		}
	}
});

test('the Bloch sphere: poles are 0 and 1, the equator is an even mix', () => {
	expect(bloch(basis(1, 0))).toEqual([0, 0, 1]);
	expect(bloch(basis(1, 1))).toEqual([0, 0, -1]);
	const plus = bloch(seq(basis(1), 'H'));
	expect(plus[0]).toBeCloseTo(1, 14);
	const plusI = bloch(seq(basis(1), 'H', 'S'));
	expect(plusI[1]).toBeCloseTo(1, 14);
	// P(0) = cos²(θ/2), whatever φ
	for (const phi of [0, 1, 3]) {
		const p = probabilities(fromAngles(Math.PI / 3, phi));
		expect(p[0]).toBeCloseTo(0.75, 14);
	}
	// angles round-trip, and H·H|0⟩ reads exactly |0⟩
	const a = anglesOf(fromAngles(2.2, 5.1));
	expect(a.theta).toBeCloseTo(2.2, 12);
	expect(a.phi).toBeCloseTo(5.1, 12);
	expect(anglesOf(seq(basis(1), 'H', 'H'), 1.5)).toEqual({ theta: 0, phi: 1.5 });
	expect(anglesOf(seq(basis(1), 'H', 'Z', 'H'), 0.4)).toEqual({ theta: Math.PI, phi: 0.4 });
});

test("Born's rule: measured frequencies settle on |amplitude|²", () => {
	const s = fromAngles((2 * Math.PI) / 3, 0); // P(0) = cos²60° = 0.25
	const counts = tally(s, 100_000, 7);
	expect(counts[0] / 100_000).toBeCloseTo(0.25, 2);
	// a basis state always gives the same answer
	expect(tally(basis(1, 1), 1000, 3)).toEqual([0, 1000]);
});

test('interference on one qubit: H, a phase φ, H gives 1 with probability sin²(φ/2)', () => {
	for (const phi of [0, 0.5, Math.PI / 2, 2, Math.PI]) {
		const s = apply(apply(apply(basis(1), GATES.H, 0), phaseGate(phi), 0), GATES.H, 0);
		expect(probabilities(s)[1]).toBeCloseTo(Math.sin(phi / 2) ** 2, 14);
	}
});

test('CNOT is the reversible XOR of the logic-gates page', () => {
	for (let a = 0; a < 2; a++)
		for (let b = 0; b < 2; b++) {
			const out = cnot(basis(2, a * 2 + b), 0, 1);
			const k = probabilities(out).findIndex((p) => p > 0.5);
			expect(k).toBe(a * 2 + (a ^ b));
		}
});

test('the Bell pair: each result alone is a coin toss, together they always agree', () => {
	const s = bellPair();
	const p = probabilities(s);
	[0.5, 0, 0, 0.5].forEach((v, k) => expect(p[k]).toBeCloseTo(v, 14));
	// each qubit on its own has no direction at all: its Bloch vector is at the centre
	for (const q of [0, 1]) for (const v of bloch(s, q)) expect(Math.abs(v)).toBeLessThan(1e-15);
	// a product state keeps full-length Bloch vectors
	const product = apply(apply(basis(2), GATES.H, 0), GATES.H, 1);
	expect(Math.hypot(...bloch(product, 0))).toBeCloseTo(1, 14);
	const r = pairRuns(s, 0, 0, 10_000, 5);
	expect(r.agree).toBe(10_000);
	expect(r.aliceZero / 10_000).toBeCloseTo(0.5, 1);
});

test('turning one axis: agreement cos²((a−b)/2), and no message gets through', () => {
	const s = bellPair();
	for (const b of [0, 0.4, 1, Math.PI / 2, 2.5, Math.PI]) {
		expect(correlation(s, 0, b)).toBeCloseTo(Math.cos(b), 12);
		// Alice's own results stay 50/50 whatever Bob does
		const p = pairOutcomes(s, 0, b);
		expect(p[0] + p[1]).toBeCloseTo(0.5, 12);
	}
});

test("Bell's test: the entangled pair reaches 2√2, beyond the limit of 2 for pre-agreed answers", () => {
	const s = bellPair();
	expect(chsh(s).S).toBeCloseTo(2 * Math.SQRT2, 12);
	const sampled = chsh(s, 20_000, 11).S;
	expect(sampled).toBeGreaterThan(2.7);
	expect(sampled).toBeLessThan(2.95);
	// a product state (no entanglement) stays within the classical bound
	const product = apply(apply(basis(2), GATES.H, 0), GATES.H, 1);
	expect(Math.abs(chsh(product).S)).toBeLessThanOrEqual(2 + 1e-12);
});

test('the oracle flips one sign and changes no probability', () => {
	const s = uniform(3);
	const o = oracle(s, 5);
	expect(o.re[5]).toBeCloseTo(-1 / Math.sqrt(8), 14);
	expect(Array.from(probabilities(o))).toEqual(Array.from(probabilities(s)));
});

test('the diffusion circuit reflects every amplitude about the mean', () => {
	const o = oracle(uniform(3), 2);
	const m = meanAmplitude(o);
	const d = diffuse(o);
	for (let k = 0; k < 8; k++) expect(d.re[k]).toBeCloseTo(2 * m - o.re[k], 14);
	expect(norm(d)).toBeCloseTo(1, 14);
});

test("Grover's search: the simulation follows sin²((2k+1)θ), and overshoots", () => {
	for (const n of [2, 3, 4, 6, 8]) {
		const N = 2 ** n;
		const theta = Math.asin(1 / Math.sqrt(N));
		for (let k = 0; k <= 2 * bestIterations(N) + 1; k++)
			expect(groverSuccess(n, k, 1)).toBeCloseTo(Math.sin((2 * k + 1) * theta) ** 2, 10);
	}
	// four items: one iteration finds it for sure; eight: two iterations, 94.5%
	expect(groverSuccess(2, 1)).toBeCloseTo(1, 14);
	expect(bestIterations(8)).toBe(2);
	expect(groverSuccess(3, 2)).toBeCloseTo(0.9453, 4);
	// one more iteration and the chance falls again
	expect(groverSuccess(3, 3)).toBeLessThan(0.4);
	// a million items (2²⁰): about 804 iterations against 500 000 tries on average
	expect(bestIterations(2 ** 20)).toBe(804);
	expect(classicalTries(2 ** 20)).toBeCloseTo(524_288.5, 6);
	// the marked string after the best number of iterations, by sampling
	const counts = tally(grover(4, 9, 2 * bestIterations(16)), 10_000, 2);
	expect(counts[9] / 10_000).toBeGreaterThan(0.95);
	expect(Math.abs(grover(4, 9, 1).re[9])).toBeCloseTo(0.25, 14);
});
