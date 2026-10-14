// Checks the Schrödinger-equation solver behind the quantum-mechanics explainer against exact
// solutions and textbook results (definition of done #5 in docs/TOPICS.md). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ELECTRON,
	NATURAL,
	PLANCK,
	barrierT,
	boxEnergy,
	boxState,
	copyWave,
	deBroglie,
	decayConstant,
	energy,
	evolver,
	fraunhofer,
	freeEvolve,
	freeSpread,
	gaussian,
	grid,
	moments,
	norm,
	oscillatorState,
	outcomes,
	overlap,
	packetT,
	pattern,
	sample,
	slits,
	speed,
	tunnel,
	visibility,
	waveNumber
} from '../src/routes/quantum-mechanics/quantum';

test('the evolution is unitary: total probability stays 1', () => {
	const r = tunnel({ E: 1, V0: 2, a: 0.25 });
	for (const f of r.frames) expect(Math.abs(norm(r.g, f) - 1)).toBeLessThan(1e-10);
	expect(r.transmitted + r.reflected).toBeCloseTo(1, 6);
});

test('energy eigenstates of a harmonic oscillator only turn their phase, at E = (n + ½)ħω', () => {
	const g = grid(512, 20 / 512);
	const V = new Float64Array(g.n);
	for (let j = 0; j < g.n; j++) V[j] = 0.5 * g.x[j] * g.x[j]; // ½mω²x², ħ = m = ω = 1
	const dt = 0.002;
	const T = 3;
	for (const n of [0, 1, 2]) {
		const psi0 = oscillatorState(g, n);
		expect(norm(g, psi0)).toBeCloseTo(1, 10);
		expect(energy(g, psi0, V, NATURAL)).toBeCloseTo(n + 0.5, 6);
		const psi = copyWave(psi0);
		evolver(g, V, dt, NATURAL).run(psi, T / dt);
		// ψ(t) = e^(−iEt/ħ) ψ(0): the overlap has length 1 and angle −Et.
		const o = overlap(g, psi0, psi);
		expect(Math.hypot(o.re, o.im)).toBeCloseTo(1, 6);
		const expected = -(n + 0.5) * T;
		const angle = Math.atan2(o.im, o.re);
		const diff = Math.atan2(Math.sin(angle - expected), Math.cos(angle - expected));
		expect(Math.abs(diff)).toBeLessThan(1e-4);
	}
});

test('a displaced packet in the oscillator swings like the classical mass (Ehrenfest)', () => {
	const g = grid(512, 20 / 512);
	const V = new Float64Array(g.n);
	for (let j = 0; j < g.n; j++) V[j] = 0.5 * g.x[j] * g.x[j];
	const psi = gaussian(g, 2, Math.SQRT1_2, 0); // the ground-state width, moved to x = 2
	const ev = evolver(g, V, 0.005, NATURAL);
	for (let s = 1; s <= 8; s++) {
		ev.run(psi, 100); // 0.5 time units
		expect(moments(g, psi).mean).toBeCloseTo(2 * Math.cos(0.5 * s), 4);
		expect(moments(g, psi).spread).toBeCloseTo(Math.SQRT1_2, 4); // a coherent state keeps its shape
	}
});

test('a free electron packet moves at ħk/m and spreads as σ√(1 + (ħt/2mσ²)²)', () => {
	const g = grid(2048, 0.05);
	const E = 1;
	const psi0 = gaussian(g, -20, 1, waveNumber(E));
	for (const t of [10, 30, 60]) {
		const psi = freeEvolve(g, psi0, t, ELECTRON);
		const m = moments(g, psi);
		expect(m.mean).toBeCloseTo(-20 + speed(E) * t, 3);
		expect(m.spread).toBeCloseTo(freeSpread(1, t), 3);
		expect(norm(g, psi)).toBeCloseTo(1, 10);
	}
	// The narrative's numbers: a 1 eV electron moves at about 590 km/s (0.59 nm/fs).
	expect(speed(1)).toBeCloseTo(0.593, 3);
});

test('de Broglie wavelengths and box energies quoted in the text', () => {
	expect(deBroglie(1)).toBeCloseTo(1.226, 3); // nm, 1 eV electron
	expect(deBroglie(600) * 1000).toBeCloseTo(50.07, 1); // pm, 600 eV
	// An electron in a 1 nm box: E₁ ≈ 0.376 eV, and Eₙ = n²E₁.
	expect(boxEnergy(1, 1)).toBeCloseTo(0.376, 3);
	// The box's standing waves have exactly those energies under the solver's own kinetic operator.
	const L = 1;
	const g = grid(4096, 8 / 4096);
	const V = new Float64Array(g.n);
	for (const n of [1, 2, 3]) {
		const re = new Float64Array(g.n);
		for (let j = 0; j < g.n; j++) re[j] = boxState(n, L, g.x[j]);
		const psi = { re, im: new Float64Array(g.n) };
		expect(norm(g, psi)).toBeCloseTo(1, 4);
		expect(energy(g, psi, V, ELECTRON) / boxEnergy(n, L)).toBeCloseTo(1, 2);
	}
});

test('the simulated packet tunnels as much as its plane waves do on average', () => {
	for (const [V0, a] of [
		[2, 0.25],
		[2, 0.5],
		[1.5, 1],
		[3, 0.3],
		[5.5, 0.3]
	]) {
		const r = tunnel({ E: 1, V0, a });
		const expected = packetT(1, 1.5, V0, a);
		expect(Math.abs(r.transmitted / expected - 1)).toBeLessThan(0.03);
	}
});

test('a barrier lower than the energy still reflects part of the wave', () => {
	const r = tunnel({ E: 1, V0: 0.5, a: 0.5 });
	expect(r.reflected).toBeGreaterThan(0.08);
	expect(r.reflected).toBeLessThan(0.15);
	// No barrier: everything goes through.
	expect(tunnel({ E: 1, V0: 0, a: 0.5 }).transmitted).toBeCloseTo(1, 6);
});

test('tunnelling falls off exponentially with width, as e^(−2κa)', () => {
	const kappa = decayConstant(1); // V0 − E = 1 eV
	const ratio = barrierT(1, 2, 1.1) / barrierT(1, 2, 1.0);
	expect(ratio).toBeCloseTo(Math.exp(-2 * kappa * 0.1), 3);
	// The simulation agrees with the thick-barrier law.
	const sim =
		tunnel({ E: 1, V0: 2, a: 0.7 }).transmitted / tunnel({ E: 1, V0: 2, a: 0.6 }).transmitted;
	expect(sim / Math.exp(-2 * kappa * 0.1)).toBeGreaterThan(0.95);
	expect(sim / Math.exp(-2 * kappa * 0.1)).toBeLessThan(1.05);
	// Scanning tunnelling microscope: with a 4.5 eV work function, 0.1 nm more gap cuts the
	// current about ninefold, and 0.1 nm less raises it as much.
	const stm = barrierT(0.5, 5, 0.5) / barrierT(0.5, 5, 0.6);
	expect(stm).toBeGreaterThan(8.5);
	expect(stm).toBeLessThan(9.5);
});

test('far from the slits the wave makes the two-slit pattern cos² × sinc²', () => {
	const s = slits({ w: 0.25, lambdaL: 1 });
	const P = pattern(s.a, s.b);
	const j = (y: number) => Math.round(y / s.g.dx) + s.g.n / 2;
	const peak = P[j(0)];
	for (const y of [0.25, 1, 2, 3]) expect(P[j(y)] / peak).toBeCloseTo(fraunhofer(y, 0.25, 1), 1);
	// Bright fringes λL/d apart: the first one beside the centre is at y = 1.
	let best = j(0.6);
	for (let k = j(0.6); k <= j(1.4); k++) if (P[k] > P[best]) best = k;
	expect(s.g.x[best]).toBeCloseTo(1, 1);
	// Dark between: almost nothing at y = ½.
	expect(P[j(0.5)] / peak).toBeLessThan(0.01);
});

test('a which-slit record removes the fringes, in proportion to how well it tells the slits apart', () => {
	const s = slits({ w: 0.25, lambdaL: 1 });
	const c = s.g.n / 2;
	const half = Math.round(0.5 / s.g.dx); // one fringe either side of the centre
	for (const gamma of [1, 0.6, 0.3, 0]) {
		const v = visibility(pattern(s.a, s.b, gamma), c - half, c + half);
		expect(v).toBeCloseTo(gamma, 1);
	}
	// With a perfect record the pattern is the sum of the two single-slit patterns.
	const inc = pattern(s.a, s.b, 0);
	const top = pattern(s.a, { re: s.b.re.map(() => 0), im: s.b.im.map(() => 0) }, 0);
	const bot = pattern({ re: s.a.re.map(() => 0), im: s.a.im.map(() => 0) }, s.b, 0);
	for (const k of [c, c + 37, c - 90]) expect(inc[k]).toBeCloseTo(top[k] + bot[k], 12);
});

test('single random hits pile up into the probability pattern', () => {
	const s = slits({ w: 0.25, lambdaL: 1 });
	const P = pattern(s.a, s.b);
	const hits = sample(P, 20000, 7);
	// Fraction of hits within the central bright fringe, |y| < 0.5, vs the predicted probability.
	const c = s.g.n / 2;
	const half = Math.round(0.5 / s.g.dx);
	let inside = 0;
	for (const h of hits) if (Math.abs(h - c) < half) inside++;
	let p = 0;
	let total = 0;
	for (let k = 0; k < P.length; k++) {
		total += P[k];
		if (Math.abs(k - c) < half) p += P[k];
	}
	expect(inside / hits.length).toBeCloseTo(p / total, 2);
	// No hits where the probability is zero: the dark fringe at y = ½.
	const dark = hits.filter((h) => Math.abs(s.g.x[h] - 0.5) < 0.02).length;
	expect(dark / hits.length).toBeLessThan(0.0005);
	// Yes/no outcomes come up in proportion to their probability.
	const yes = outcomes(0.27, 10000, 3).filter(Boolean).length;
	expect(yes / 10000).toBeCloseTo(0.27, 1);
});

test('the other numbers the narrative quotes', () => {
	// Tunnelling at the default barrier (1 eV electron, 2 eV barrier): ~27% at 0.25 nm, ~2.5% at 0.5 nm.
	expect(tunnel({ E: 1, V0: 2, a: 0.25 }).transmitted).toBeCloseTo(0.27, 2);
	expect(tunnel({ E: 1, V0: 2, a: 0.5 }).transmitted).toBeCloseTo(0.025, 3);
	// Each extra 0.1 nm of that barrier divides the chance by about 2.8; κ = 5.1 per nm.
	expect(decayConstant(1)).toBeCloseTo(5.1, 1);
	expect(barrierT(1, 2, 0.8) / barrierT(1, 2, 0.9)).toBeCloseTo(2.8, 1);
	// The 1 nm box sloshes back and forth every h/(E₂ − E₁) ≈ 3.7 fs.
	expect(PLANCK / (boxEnergy(2, 1) - boxEnergy(1, 1))).toBeCloseTo(3.7, 1);
	// STM: κ = 10.9 per nm for a 4.5 eV work function.
	expect(decayConstant(4.5)).toBeCloseTo(10.9, 1);
});
