/**
 * A state-vector simulator for a few qubits, behind the quantum-computing explainer.
 *
 * The state of n qubits is a vector of 2ⁿ complex amplitudes, one per string of n bits.
 * Gates are unitary matrices applied to that vector; a measurement picks one bit string at
 * random with probability |amplitude|² (Born's rule) and leaves the state in that string.
 * Everything the page draws (the Bloch sphere, the amplitude bars, the counts, Grover's
 * search) comes from these vectors, never from the closed-form results, which the tests use
 * as the reference instead.
 *
 * Conventions: qubit 0 is the leftmost bit of a ket, |q₀q₁…⟩, so it is the most significant
 * bit of the basis index. The Bloch vector of a qubit with density matrix ρ is
 * r = (2 Re ρ₀₁, −2 Im ρ₀₁, ρ₀₀ − ρ₁₁): |0⟩ at the north pole, |1⟩ at the south, |+⟩ on +x,
 * |+i⟩ on +y. A rotation by angle a about a unit axis n is R_n(a) = cos(a/2) I − i sin(a/2) n·σ.
 */
import { rng } from '#lib/draw/math.ts';

export interface C {
	re: number;
	im: number;
}
/** A 2 × 2 complex matrix, row by row: [[a, b], [c, d]]. */
export type Matrix = readonly [C, C, C, C];

export interface State {
	n: number;
	re: Float64Array;
	im: Float64Array;
}

export const cx = (re: number, im = 0): C => ({ re, im });
const S2 = Math.SQRT1_2;

// ---- states -----------------------------------------------------------------------------

/** |k⟩ on n qubits (|0…0⟩ by default). */
export function basis(n: number, k = 0): State {
	const re = new Float64Array(1 << n);
	const im = new Float64Array(1 << n);
	re[k] = 1;
	return { n, re, im };
}

export const copy = (s: State): State => ({ n: s.n, re: s.re.slice(), im: s.im.slice() });

/** A state from its amplitudes, e.g. fromAmplitudes([cx(S2), cx(S2)]). */
export function fromAmplitudes(a: C[]): State {
	const n = Math.round(Math.log2(a.length));
	const s = basis(n);
	a.forEach((z, k) => {
		s.re[k] = z.re;
		s.im[k] = z.im;
	});
	return s;
}

export const amplitude = (s: State, k: number): C => ({ re: s.re[k], im: s.im[k] });

/** Σ |amplitude|²: 1 for every state, kept by every gate. */
export function norm(s: State) {
	let p = 0;
	for (let k = 0; k < s.re.length; k++) p += s.re[k] * s.re[k] + s.im[k] * s.im[k];
	return p;
}

/** Born's rule: the probability of each bit string. */
export function probabilities(s: State) {
	const p = new Float64Array(s.re.length);
	for (let k = 0; k < p.length; k++) p[k] = s.re[k] * s.re[k] + s.im[k] * s.im[k];
	return p;
}

/** The ket label of basis index k on n qubits: label(2, 3) = "11". */
export const label = (n: number, k: number) => k.toString(2).padStart(n, '0');

/** |⟨a|b⟩|²: 1 when two states are the same up to an overall phase. */
export function fidelity(a: State, b: State) {
	let re = 0;
	let im = 0;
	for (let k = 0; k < a.re.length; k++) {
		re += a.re[k] * b.re[k] + a.im[k] * b.im[k];
		im += a.re[k] * b.im[k] - a.im[k] * b.re[k];
	}
	return re * re + im * im;
}

// ---- one-qubit gates ---------------------------------------------------------------------

export const GATES = {
	I: [cx(1), cx(0), cx(0), cx(1)],
	X: [cx(0), cx(1), cx(1), cx(0)],
	Y: [cx(0), cx(0, -1), cx(0, 1), cx(0)],
	Z: [cx(1), cx(0), cx(0), cx(-1)],
	H: [cx(S2), cx(S2), cx(S2), cx(-S2)],
	S: [cx(1), cx(0), cx(0), cx(0, 1)],
	T: [cx(1), cx(0), cx(0), cx(S2, S2)]
} as const satisfies Record<string, Matrix>;
export type GateName = keyof typeof GATES;

/** The phase gate P(φ) = diag(1, e^{iφ}): Z is P(π), S is P(π/2), T is P(π/4). */
export const phaseGate = (phi: number): Matrix => [
	cx(1),
	cx(0),
	cx(0),
	cx(Math.cos(phi), Math.sin(phi))
];

/** R_n(a) = cos(a/2) I − i sin(a/2) (n·σ), for a unit axis n = [x, y, z]. */
export function rotation(axis: readonly [number, number, number], a: number): Matrix {
	const [x, y, z] = axis;
	const c = Math.cos(a / 2);
	const s = Math.sin(a / 2);
	// n·σ = [[z, x − iy], [x + iy, −z]]
	return [cx(c, -s * z), cx(-s * y, -s * x), cx(s * y, -s * x), cx(c, s * z)];
}

/** Ry(a): turns the Bloch vector by a about the y axis (|0⟩ towards |+⟩ for a = 90°). */
export const ry = (a: number) => rotation([0, 1, 0], a);

/**
 * Each named gate as a turn of the Bloch sphere: G = e^{iγ} R_axis(angle). The overall phase
 * γ is unobservable; the axis and angle are what the gate does.
 */
export const GATE_TURNS: Record<
	Exclude<GateName, 'I'>,
	{ axis: Vec3; angle: number; phase: number }
> = {
	X: { axis: [1, 0, 0], angle: Math.PI, phase: Math.PI / 2 },
	Y: { axis: [0, 1, 0], angle: Math.PI, phase: Math.PI / 2 },
	Z: { axis: [0, 0, 1], angle: Math.PI, phase: Math.PI / 2 },
	H: { axis: [S2, 0, S2], angle: Math.PI, phase: Math.PI / 2 },
	S: { axis: [0, 0, 1], angle: Math.PI / 2, phase: Math.PI / 4 },
	T: { axis: [0, 0, 1], angle: Math.PI / 4, phase: Math.PI / 8 }
};

/** Applies a 2 × 2 gate to qubit q of the state (a new state). */
export function apply(s: State, g: Matrix, q: number): State {
	const out = copy(s);
	const bit = 1 << (s.n - 1 - q);
	const [a, b, c, d] = g;
	for (let k = 0; k < s.re.length; k++) {
		if (k & bit) continue;
		const j = k | bit;
		const r0 = s.re[k];
		const i0 = s.im[k];
		const r1 = s.re[j];
		const i1 = s.im[j];
		out.re[k] = a.re * r0 - a.im * i0 + b.re * r1 - b.im * i1;
		out.im[k] = a.re * i0 + a.im * r0 + b.re * i1 + b.im * r1;
		out.re[j] = c.re * r0 - c.im * i0 + d.re * r1 - d.im * i1;
		out.im[j] = c.re * i0 + c.im * r0 + d.re * i1 + d.im * r1;
	}
	return out;
}

/** A gate on every qubit (H on all of them makes the uniform superposition). */
export function applyAll(s: State, g: Matrix) {
	let out = s;
	for (let q = 0; q < s.n; q++) out = apply(out, g, q);
	return out;
}

/** Controlled-NOT: flips the target where the control is 1, so target ← target XOR control. */
export function cnot(s: State, control: number, target: number): State {
	const out = copy(s);
	const cb = 1 << (s.n - 1 - control);
	const tb = 1 << (s.n - 1 - target);
	for (let k = 0; k < s.re.length; k++) {
		if (!(k & cb)) continue;
		out.re[k] = s.re[k ^ tb];
		out.im[k] = s.im[k ^ tb];
	}
	return out;
}

// ---- one qubit on the Bloch sphere -------------------------------------------------------

export type Vec3 = [number, number, number];

/** cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩: the point (θ, φ) of the Bloch sphere. */
export function fromAngles(theta: number, phi: number): State {
	return fromAmplitudes([
		cx(Math.cos(theta / 2)),
		cx(Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi))
	]);
}

/**
 * The Bloch angles of a one-qubit state, after removing the overall phase. At a pole φ means
 * nothing: `keepPhi` is returned there, so a slider for φ does not jump. Values within 1e-9 of
 * a pole snap to it, so H·H|0⟩ reads exactly |0⟩.
 */
export function anglesOf(s: State, keepPhi = 0): { theta: number; phi: number } {
	const a = Math.hypot(s.re[0], s.im[0]);
	const b = Math.hypot(s.re[1], s.im[1]);
	let theta = 2 * Math.atan2(b, a);
	if (theta < 1e-9) return { theta: 0, phi: keepPhi };
	if (Math.PI - theta < 1e-9) return { theta: Math.PI, phi: keepPhi };
	// φ = arg(β) − arg(α)
	let phi = Math.atan2(s.im[1], s.re[1]) - Math.atan2(s.im[0], s.re[0]);
	phi = ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	if (2 * Math.PI - phi < 1e-9) phi = 0;
	theta = Math.abs(theta - Math.PI / 2) < 1e-9 ? Math.PI / 2 : theta;
	return { theta, phi };
}

/**
 * The Bloch vector of qubit q, from its reduced density matrix (the partial trace over the
 * other qubits). Length 1 for a qubit in a state of its own; shorter, down to 0, when it is
 * entangled with the others.
 */
export function bloch(s: State, q = 0): Vec3 {
	const bit = 1 << (s.n - 1 - q);
	let r00 = 0;
	let r11 = 0;
	let re01 = 0;
	let im01 = 0;
	for (let k = 0; k < s.re.length; k++) {
		if (k & bit) {
			r11 += s.re[k] * s.re[k] + s.im[k] * s.im[k];
			continue;
		}
		const j = k | bit;
		r00 += s.re[k] * s.re[k] + s.im[k] * s.im[k];
		// ρ₀₁ = Σ ψ(…0…) ψ(…1…)*
		re01 += s.re[k] * s.re[j] + s.im[k] * s.im[j];
		im01 += s.im[k] * s.re[j] - s.re[k] * s.im[j];
	}
	return [2 * re01, 0 - 2 * im01, r00 - r11]; // (0 − …: no −0 for real states)
}

/** Rodrigues: v turned by angle a about the unit axis n (right-handed). */
export function turn(v: Vec3, n: Vec3, a: number): Vec3 {
	const c = Math.cos(a);
	const s = Math.sin(a);
	const d = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
	const x = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]];
	return [0, 1, 2].map((i) => v[i] * c + x[i] * s + n[i] * d * (1 - c)) as Vec3;
}

// ---- measurement -------------------------------------------------------------------------

/** Picks a bit string with Born's probabilities, given a uniform number u in [0, 1). */
export function pick(p: ArrayLike<number>, u: number) {
	let acc = 0;
	for (let k = 0; k < p.length; k++) {
		acc += p[k];
		if (u < acc) return k;
	}
	// rounding: the last string with any probability
	for (let k = p.length - 1; k >= 0; k--) if (p[k] > 0) return k;
	return 0;
}

/** Measures every qubit: one bit string, and the state it leaves (that basis state). */
export function measure(s: State, u: number) {
	const k = pick(probabilities(s), u);
	return { outcome: k, after: basis(s.n, k) };
}

/** Prepares the same state `runs` times and measures each copy: counts per bit string. */
export function tally(s: State, runs: number, seed = 1) {
	const p = probabilities(s);
	const r = rng(seed);
	const counts = new Array<number>(p.length).fill(0);
	for (let i = 0; i < runs; i++) counts[pick(p, r())]++;
	return counts;
}

// ---- two qubits: entanglement and Bell's test ---------------------------------------------

/** (|00⟩ + |11⟩)/√2, made by H on qubit 0 and then CNOT 0 → 1, as on the page. */
export const bellPair = () => cnot(apply(basis(2), GATES.H, 0), 0, 1);

/**
 * Measures qubit 0 along the axis at angle a and qubit 1 along the axis at angle b, both in
 * the x–z plane of the Bloch sphere (angle from |0⟩ towards |+⟩): each qubit is turned by
 * Ry(−angle), which brings its axis to z, and then read in the 0/1 basis.
 * Returns the probabilities of 00, 01, 10, 11 (0 = along the axis, 1 = against it).
 */
export function pairOutcomes(s: State, a: number, b: number) {
	return probabilities(apply(apply(s, ry(-a), 0), ry(-b), 1));
}

/** ⟨A·B⟩ with A, B = ±1: P(agree) − P(disagree). */
export function correlation(s: State, a: number, b: number) {
	const p = pairOutcomes(s, a, b);
	return p[0] + p[3] - p[1] - p[2];
}

/** Simulated runs at fixed axes: how often the two results agreed, and Alice's own 0s. */
export function pairRuns(s: State, a: number, b: number, runs: number, seed = 1) {
	const p = pairOutcomes(s, a, b);
	const r = rng(seed);
	let agree = 0;
	let aliceZero = 0;
	const counts = [0, 0, 0, 0];
	for (let i = 0; i < runs; i++) {
		const k = pick(p, r());
		counts[k]++;
		if (k === 0 || k === 3) agree++;
		if (k < 2) aliceZero++;
	}
	return { agree, aliceZero, counts, runs };
}

/** The four CHSH settings (Bloch angles): Alice 0° or 90°, Bob 45° or −45°. */
export const CHSH = {
	a: [0, Math.PI / 2],
	b: [Math.PI / 4, -Math.PI / 4]
} as const;

/** The CHSH combination of the four correlations, in the order (a,b), (a,b′), (a′,b), (a′,b′). */
export const chshValue = (e: readonly number[]) => e[0] + e[1] + e[2] - e[3];

/**
 * Bell's test in the CHSH form: S = E(a,b) + E(a,b′) + E(a′,b) − E(a′,b′), each correlation
 * estimated from `runs` simulated pairs (or exact with runs = 0). Any pre-agreed answers give
 * |S| ≤ 2; the entangled pair gives 2√2.
 */
export function chsh(s: State, runs = 0, seed = 1) {
	const E = (a: number, b: number, k: number) => {
		if (runs === 0) return correlation(s, a, b);
		const r = pairRuns(s, a, b, runs, seed + k);
		return (2 * r.agree - r.runs) / r.runs;
	};
	const [a, a2] = CHSH.a;
	const [b, b2] = CHSH.b;
	const e = [E(a, b, 0), E(a, b2, 1), E(a2, b, 2), E(a2, b2, 3)];
	return { S: chshValue(e), E: e };
}

// ---- Grover's search ---------------------------------------------------------------------

/** H on every qubit of |0…0⟩: every one of the 2ⁿ strings with amplitude 1/√2ⁿ. */
export const uniform = (n: number) => applyAll(basis(n), GATES.H);

/** The oracle: flips the sign of the marked string's amplitude, leaves the rest alone. */
export function oracle(s: State, marked: number): State {
	const out = copy(s);
	out.re[marked] = -out.re[marked];
	out.im[marked] = -out.im[marked];
	return out;
}

/**
 * Grover's diffusion step as a circuit: H on every qubit, flip the sign of every string except
 * 0…0, H on every qubit again. It reflects every amplitude about their mean, a → 2⟨a⟩ − a.
 */
export function diffuse(s: State): State {
	const out = applyAll(s, GATES.H);
	for (let k = 1; k < out.re.length; k++) {
		out.re[k] = -out.re[k];
		out.im[k] = -out.im[k];
	}
	return applyAll(out, GATES.H);
}

/** The mean of the amplitudes (they stay real in Grover's search). */
export function meanAmplitude(s: State) {
	let m = 0;
	for (let k = 0; k < s.re.length; k++) m += s.re[k];
	return m / s.re.length;
}

/**
 * The state after `ops` operations of Grover's search on n qubits, starting from the uniform
 * superposition: oracle, diffusion, oracle, diffusion…
 */
export function grover(n: number, marked: number, ops: number): State {
	let s = uniform(n);
	for (let i = 0; i < ops; i++) s = i % 2 === 0 ? oracle(s, marked) : diffuse(s);
	return s;
}

/** The chance that measuring after k full Grover iterations finds the marked string. */
export const groverSuccess = (n: number, k: number, marked = 0) =>
	probabilities(grover(n, marked, 2 * k))[marked];

/** The best number of iterations for N = 2ⁿ strings and one marked: the nearest to π/4θ − ½. */
export function bestIterations(N: number) {
	const theta = Math.asin(1 / Math.sqrt(N));
	return Math.max(0, Math.round(Math.PI / (4 * theta) - 0.5));
}

/** Average number of tries to find one marked item among N, checking them in random order. */
export const classicalTries = (N: number) => (N + 1) / 2;
