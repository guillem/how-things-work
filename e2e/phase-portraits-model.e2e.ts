// Checks the mathematics behind the phase-portraits explainer against known results: the
// trace–determinant classification agrees with the eigenvalues and with how orbits actually
// move; near a hyperbolic fixed point the nonlinear flow tracks its linearisation (Hartman–
// Grobman), ever more closely nearer the point; the frictionless pendulum's centre is a true
// centre (energy conserved, the textbook period), while two systems with the same centre-type
// linearisation spiral in and out; Lotka–Volterra's invariant and Volterra's law of averages;
// the Hopf normal form's cycle of radius √μ; van der Pol's cycle of amplitude ≈ 2 and period
// 6.663 at μ = 1. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	classify,
	det,
	eigenvalues,
	eigenvector,
	fixedPoints,
	flow,
	fromEigenvalues,
	linearField,
	linearOverlay,
	lvInvariant,
	orbit,
	overlayStarts,
	pendulumEnergy,
	period,
	rk4,
	settledAmplitude,
	systems,
	trace,
	type Mat
} from '../src/routes/phase-portraits/phase';

const P = { gamma: 0.3, mu: 0.5 };

/** Matrices on a grid, entries −2 … 2 in steps of 0.5. */
const grid: Mat[] = [];
const vals = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
for (const a of vals)
	for (const b of vals) for (const c of vals) for (const d of vals) grid.push([a, b, c, d]);

test('the eigenvalues are the roots of det(A − λI) = 0', () => {
	for (const m of grid) {
		const e = eigenvalues(m);
		for (const k of [0, 1]) {
			// det(A − λI) for complex λ = re + i·im
			const [re, im] = [e.re[k], e.im[k]];
			// (a − λ)(d − λ) − bc with λ = re + i·im
			const A = m[0] - re;
			const D = m[3] - re;
			expect(Math.abs(A * D - im * im - m[1] * m[2])).toBeLessThan(1e-9);
			expect(Math.abs(im * (A + D))).toBeLessThan(1e-9);
		}
	}
});

test('the classification from trace and determinant matches the eigenvalues', () => {
	for (const m of grid) {
		const { kind } = classify(trace(m), det(m));
		const e = eigenvalues(m);
		const complex = e.im[0] !== 0;
		const [l1, l2] = e.re;
		if (Math.abs(l1 * l2) < 1e-12 && !complex) {
			expect(kind).toBe('non-isolated');
		} else if (!complex && l1 > 0 && l2 < 0) {
			expect(kind).toBe('saddle');
		} else if (complex && l1 === 0) {
			expect(kind).toBe('centre');
		} else if (complex) {
			expect(kind).toBe(l1 < 0 ? 'stable spiral' : 'unstable spiral');
		} else if (l1 === l2) {
			expect(kind).toBe(l1 < 0 ? 'stable degenerate node' : 'unstable degenerate node');
		} else {
			// real, same sign
			expect(Math.sign(l1)).toBe(Math.sign(l2));
			expect(kind).toBe(l1 < 0 ? 'stable node' : 'unstable node');
		}
	}
});

test('orbits behave as the classification says', () => {
	const box = { x: [-3, 3] as [number, number], y: [-3, 3] as [number, number] };
	const turns = (m: Mat) => {
		// total angle swept by a forward orbit from (1, 0.5), in turns
		const o = orbit(linearField(m), 1, 0.5, { box, tMax: 12, back: false, gap: 0 });
		let ang = 0;
		for (let i = 1; i < o.x.length; i++) {
			const a0 = Math.atan2(o.y[i - 1], o.x[i - 1]);
			const a1 = Math.atan2(o.y[i], o.x[i]);
			let d = a1 - a0;
			if (d > Math.PI) d -= 2 * Math.PI;
			if (d < -Math.PI) d += 2 * Math.PI;
			ang += d;
		}
		return Math.abs(ang) / (2 * Math.PI);
	};
	const end = (m: Mat, T: number) => Math.hypot(...flow(linearField(m), 1, 0.5, T));
	const r0 = Math.hypot(1, 0.5);
	// stable node: falls in without circling the origin
	const node: Mat = [-1, 0.2, 0.3, -2];
	expect(classify(trace(node), det(node)).kind).toBe('stable node');
	expect(end(node, 8)).toBeLessThan(0.01 * r0);
	expect(turns(node)).toBeLessThan(0.5);
	// stable spiral: falls in, circling several times
	const spiral: Mat = [-0.2, -2, 2, -0.2];
	expect(classify(trace(spiral), det(spiral)).kind).toBe('stable spiral');
	expect(end(spiral, 12)).toBeLessThan(0.15 * r0);
	expect(turns(spiral)).toBeGreaterThan(2);
	// centre: back where it started after one period 2π/ω, the same distance out
	const centre: Mat = [0, -2, 2, 0];
	const back = flow(linearField(centre), 1, 0.5, Math.PI);
	expect(back[0]).toBeCloseTo(1, 8);
	expect(back[1]).toBeCloseTo(0.5, 8);
	// saddle: almost every start is thrown out, along the unstable eigenvector
	const saddle: Mat = [1, 1, 1, -1];
	expect(classify(trace(saddle), det(saddle)).kind).toBe('saddle');
	const out = flow(linearField(saddle), 1, 0.5, 6);
	const v = eigenvector(saddle, eigenvalues(saddle).re[0]);
	if (!v) throw new Error('no eigenvector');
	const n = Math.hypot(...out);
	expect(n).toBeGreaterThan(50);
	expect(Math.abs(out[0] * v[1] - out[1] * v[0]) / n).toBeLessThan(1e-4);
});

test('a matrix rebuilt from eigenvalues has those eigenvalues, continuously across the real axis', () => {
	for (const [l1, l2] of [
		[1, -0.5],
		[-0.3, -2],
		[1.5, 0.4]
	]) {
		const e = eigenvalues(fromEigenvalues(l1, l2, 0));
		expect(e.re[0]).toBeCloseTo(Math.max(l1, l2), 9);
		expect(e.re[1]).toBeCloseTo(Math.min(l1, l2), 9);
		expect(e.im[0]).toBe(0);
	}
	const c = eigenvalues(fromEigenvalues(-0.4, 0, 1.2));
	expect(c.re[0]).toBeCloseTo(-0.4, 12);
	expect(c.im[0]).toBeCloseTo(1.2, 12);
	// a complex pair closing on the real axis meets the double real root: the same matrix
	const a = fromEigenvalues(0.7, 0.7, 1e-9);
	const b = fromEigenvalues(0.7, 0.7, 0);
	for (let i = 0; i < 4; i++) expect(a[i]).toBeCloseTo(b[i], 8);
});

test('the damped pendulum: fixed points found at kπ, spirals at the bottom, saddles at the top', () => {
	const fps = fixedPoints(systems.pendulum, P);
	expect(fps.map((f) => f.x / Math.PI)).toEqual(
		[-2, -1, 0, 1, 2].map((k) => expect.closeTo(k, 9) as unknown as number)
	);
	for (const f of fps) {
		expect(f.y).toBeCloseTo(0, 12);
		const even = Math.round(f.x / Math.PI) % 2 === 0;
		expect(f.kind).toBe(even ? 'stable spiral' : 'saddle');
		expect(f.hyperbolic).toBe(true);
	}
	// heavy friction (γ > 2) turns the bottom into a node: no more swinging through
	const heavy = fixedPoints(systems.pendulum, { ...P, gamma: 2.5 });
	expect(heavy.find((f) => Math.abs(f.x) < 1e-9)?.kind).toBe('stable node');
});

test('Hartman–Grobman: near a hyperbolic point the flow tracks its linearisation, more closely nearer', () => {
	const f = systems.pendulum.field(P);
	for (const fp of fixedPoints(systems.pendulum, P).filter((q) => Math.abs(q.x) < 4)) {
		const lin = linearField(fp.jacobian);
		const T = fp.kind === 'saddle' ? 1.5 : 3;
		/** Distance between the nonlinear and linear orbits after T, relative to the start ε. */
		const rel = (eps: number) => {
			const [x, y] = flow(f, fp.x + eps * 0.8, fp.y + eps * 0.6, T);
			const [u, v] = flow(lin, eps * 0.8, eps * 0.6, T);
			return Math.hypot(x - fp.x - u, y - fp.y - v) / eps;
		};
		expect(rel(0.1)).toBeLessThan(0.05);
		// sin θ − θ is cubic, so halving the distance cuts the relative gap about fourfold
		expect(rel(0.05)).toBeLessThan(rel(0.1) / 3.5);
		expect(rel(0.0125)).toBeLessThan(1e-3);
	}
});

test('the frictionless pendulum is a true centre: energy conserved, closed orbits, the textbook period', () => {
	const p0 = { gamma: 0, mu: 0 };
	const f = systems.pendulum.field(p0);
	const bottom = fixedPoints(systems.pendulum, p0).find((q) => Math.abs(q.x) < 1e-9);
	expect(bottom?.kind).toBe('centre');
	expect(bottom?.hyperbolic).toBe(false);
	const theta0 = 2; // a big swing, about 115°
	const E0 = pendulumEnergy(theta0, 0);
	let s: [number, number] = [theta0, 0];
	let drift = 0;
	for (let i = 0; i < 20000; i++) {
		s = rk4(f, s[0], s[1], 0.005);
		drift = Math.max(drift, Math.abs(pendulumEnergy(s[0], s[1]) - E0));
	}
	expect(drift).toBeLessThan(1e-9);
	// T = 4 K(sin(θ₀/2)), with K from the arithmetic–geometric mean: K(k) = π / (2 AGM(1, √(1 − k²)))
	const k = Math.sin(theta0 / 2);
	let [a, b] = [1, Math.sqrt(1 - k * k)];
	for (let i = 0; i < 30; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
	const K = Math.PI / (2 * a);
	expect(period(f, [theta0, 0], 0)).toBeCloseTo(4 * K, 5);
	// with friction the same swing loses energy for good
	const damped = systems.pendulum.field({ gamma: 0.3, mu: 0 });
	const end = flow(damped, theta0, 0, 30);
	expect(pendulumEnergy(...end)).toBeLessThan(-0.99);
});

test('a centre in the linearisation is not conclusive: the same linearisation, opposite fates', () => {
	const p0 = { gamma: 0, mu: 0 };
	for (const id of ['hopf', 'subcritical'] as const) {
		const fp = fixedPoints(systems[id], p0).find((q) => Math.hypot(q.x, q.y) < 1e-9);
		expect(fp?.kind).toBe('centre');
		expect(fp?.eigen.im[0]).toBeCloseTo(1, 12);
		// not just the same eigenvalues: the same matrix as the frictionless pendulum's
		expect(fp?.jacobian).toEqual(
			systems.pendulum.jacobian(p0, 0, 0).map((v) => expect.closeTo(v, 12))
		);
	}
	// r′ = −r³: from r = 0.5 it is down to 1/√(4 + 2t) after time t, spiralling in
	const inward = flow(systems.hopf.field(p0), 0.5, 0, 20);
	expect(Math.hypot(...inward)).toBeCloseTo(1 / Math.sqrt(4 + 40), 6);
	// r′ = +r³: from r = 0.5 it grows, and would run off to infinity at t = 2
	const outward = flow(systems.subcritical.field(p0), 0.5, 0, 1.5);
	expect(Math.hypot(...outward)).toBeCloseTo(1 / Math.sqrt(4 - 3), 6);
});

test('Lotka–Volterra: a centre kept by an invariant, and orbit averages at the equilibrium', () => {
	const f = systems.predator.field(P);
	const fps = fixedPoints(systems.predator, P);
	expect(fps).toHaveLength(2);
	expect(fps[0].kind).toBe('saddle');
	expect([fps[1].x, fps[1].y]).toEqual([expect.closeTo(3, 9), expect.closeTo(2, 9)]);
	expect(fps[1].kind).toBe('centre');
	// small oscillations: period 2π/√(αγ)
	expect(period(f, [3.05, 2], 0, 2, 0.002, 2)).toBeCloseTo((2 * Math.PI) / Math.sqrt(0.75), 2);
	// a big cycle: the invariant stays put, and the averages over one turn are (γ/δ, α/β) = (3, 2)
	const H0 = lvInvariant(6, 2);
	const T = period(f, [6, 2], 0, 1, 0.001, 2);
	let s: [number, number] = [6, 2];
	// start on y = 2 going up, so whole turns are counted from here
	let sx = 0;
	let sy = 0;
	let drift = 0;
	const h = T / 40000;
	for (let i = 0; i < 40000; i++) {
		const n = rk4(f, s[0], s[1], h);
		sx += ((s[0] + n[0]) / 2) * h;
		sy += ((s[1] + n[1]) / 2) * h;
		s = n;
		drift = Math.max(drift, Math.abs(lvInvariant(...s) - H0));
	}
	expect(drift).toBeLessThan(1e-9);
	expect(sx / T).toBeCloseTo(3, 3);
	expect(sy / T).toBeCloseTo(2, 3);
});

test('the Hopf normal form: past μ = 0 a cycle of radius √μ is born', () => {
	const id = 'hopf';
	for (const mu of [0.01, 0.04, 0.16, 0.64]) {
		const f = systems[id].field({ gamma: 0, mu });
		const r = settledAmplitude(f, [0.05, 0], 30 / mu, 7);
		expect(r / Math.sqrt(mu)).toBeCloseTo(1, 3);
		// the origin is now an unstable spiral, eigenvalues μ ± i
		const o = fixedPoints(systems[id], { gamma: 0, mu }).find((q) => Math.hypot(q.x, q.y) < 1e-9);
		expect(o?.kind).toBe('unstable spiral');
		expect(o?.eigen.re[0]).toBeCloseTo(mu, 12);
	}
	// before it, every orbit spirals into the origin
	const before = systems[id].field({ gamma: 0, mu: -0.2 });
	expect(settledAmplitude(before, [1, 0], 60, 7)).toBeLessThan(1e-4);
});

test('van der Pol: a cycle of amplitude about 2 for any μ > 0, period 6.663 at μ = 1', () => {
	const absX = (x: number) => Math.abs(x);
	for (const mu of [0.1, 0.5, 2, 3]) {
		const f = systems.vanderpol.field({ gamma: 0, mu });
		expect(Math.abs(settledAmplitude(f, [0.1, 0], 300, 20, 0.005, absX) - 2)).toBeLessThan(0.03);
	}
	// the published amplitude at μ = 1 is 2.00862
	const amp1 = settledAmplitude(
		systems.vanderpol.field({ gamma: 0, mu: 1 }),
		[0.1, 0],
		200,
		20,
		0.005,
		absX
	);
	expect(amp1).toBeCloseTo(2.0086, 3);
	const f1 = systems.vanderpol.field({ gamma: 0, mu: 1 });
	expect(period(f1, [0.1, 0], 100)).toBeCloseTo(6.6633, 3);
	// the step is small enough: halving it changes the amplitude by less than 10⁻⁶
	const f3 = systems.vanderpol.field({ gamma: 0, mu: 3 });
	const a = settledAmplitude(f3, [0.1, 0], 100, 20, 0.01, absX);
	const b = settledAmplitude(f3, [0.1, 0], 100, 20, 0.005, absX);
	expect(Math.abs(a - b)).toBeLessThan(1e-6);
});

test('the magnifier: in a shrinking circle the real and linear orbits close up like its radius squared', () => {
	const f = systems.pendulum.field(P);
	const top = fixedPoints(systems.pendulum, P).find((q) => Math.abs(q.x - Math.PI) < 1e-9);
	if (!top) throw new Error('no saddle at π');
	const gap = (R: number) => linearOverlay(f, top, overlayStarts(R), R, 2 * Math.PI).gap;
	expect(gap(1)).toBeGreaterThan(0.03);
	// sin θ differs from its tangent by about θ³/6, so the gap relative to R falls like R²
	expect(gap(1) / gap(0.25)).toBeGreaterThan(12);
	expect(gap(1) / gap(0.25)).toBeLessThan(20);
	expect(gap(0.1)).toBeLessThan(0.002);
});
