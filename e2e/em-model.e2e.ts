// Checks the electromagnetism model behind the electromagnetism explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	C,
	EARTH_H,
	MAGNET,
	PICKUP,
	R_PICKUP,
	coilLoops,
	compassField,
	ellipticKE,
	fieldAt,
	fieldLines,
	forceOn,
	linkageTable,
	loopAxisField,
	loopField,
	loopFlux,
	loopsField,
	magnetEmf,
	magnetLinkage,
	magnetLoops,
	magnetMoment,
	MU0,
	neighbour,
	potentialAt,
	swing,
	waveAt,
	wavelength,
	wireField,
	type Charge
} from '../src/routes/electromagnetism/em';

const nC = 1e-9;

test('Coulomb: 10 nC at 10 cm makes 9.0 kN/C and pushes 1 nC with 9.0 µN', () => {
	const src: Charge[] = [{ x: 0, y: 0, q: 10 * nC }];
	const e = fieldAt(src, 0.1, 0);
	expect(e.x).toBeCloseTo(8988, 0);
	expect(e.y).toBe(0);
	const f = forceOn(src, { x: 0.1, y: 0, q: nC });
	expect(f.x * 1e6).toBeCloseTo(8.99, 2);
	// Twice as far: a quarter of the force (2.25 µN).
	const f2 = forceOn(src, { x: 0.2, y: 0, q: nC });
	expect(f.x / f2.x).toBeCloseTo(4, 10);
	expect(f2.x * 1e6).toBeCloseTo(2.25, 2);
	// Unlike charges attract: a negative test charge is pulled towards the source.
	expect(forceOn(src, { x: 0.1, y: 0, q: -nC }).x).toBeLessThan(0);
	// Force grows with both charges.
	const big = forceOn([{ x: 0, y: 0, q: 20 * nC }], { x: 0.1, y: 0, q: nC });
	expect(big.x / f.x).toBeCloseTo(2, 10);
});

test('superposition: the null point of +q and +4q is a third of the way', () => {
	const d = 0.3;
	const cs: Charge[] = [
		{ x: 0, y: 0, q: nC },
		{ x: d, y: 0, q: 4 * nC }
	];
	const e = fieldAt(cs, d / 3, 0);
	expect(Math.abs(e.x)).toBeLessThan(1e-9);
	// A dipole's far field falls as 1/r³ (and its potential as 1/r²).
	const dip: Charge[] = [
		{ x: -0.005, y: 0, q: nC },
		{ x: 0.005, y: 0, q: -nC }
	];
	const e1 = Math.hypot(...Object.values(fieldAt(dip, 0, 1)));
	const e2 = Math.hypot(...Object.values(fieldAt(dip, 0, 2)));
	expect(e1 / e2).toBeCloseTo(8, 3);
	expect(potentialAt(dip, 0, 0.5)).toBeCloseTo(0, 12);
});

test('field lines run from + to − and their numbers follow the charges', () => {
	const cs: Charge[] = [
		{ x: -0.05, y: 0, q: 10 * nC },
		{ x: 0.05, y: 0, q: -10 * nC }
	];
	const bounds = { x0: -0.24, y0: -0.15, x1: 0.24, y1: 0.15 };
	const lines = fieldLines(cs, {
		linesPerUnit: 12,
		unit: 10 * nC,
		bounds,
		step: 0.002,
		radius: 0.004
	});
	const fromPlus = lines.filter((l) => l.from === 0);
	expect(fromPlus.length).toBe(12);
	// Most lines of an equal and opposite pair end on the other charge…
	expect(fromPlus.filter((l) => l.to === 1).length).toBeGreaterThanOrEqual(8);
	// …and every line follows the field: E points along the line from its + end.
	for (const l of lines) {
		const p = l.points[Math.floor(l.points.length / 2)];
		const q = l.points[Math.floor(l.points.length / 2) + 1];
		const e = fieldAt(cs, p.x, p.y);
		expect((q.x - p.x) * e.x + (q.y - p.y) * e.y).toBeGreaterThan(0);
	}
	// Twice the charge sends out twice the lines; a lone − charge gets its lines from the edge.
	const two = fieldLines([{ x: 0, y: 0, q: 20 * nC }], {
		linesPerUnit: 12,
		unit: 10 * nC,
		bounds,
		step: 0.002,
		radius: 0.004
	});
	expect(two.length).toBe(24);
	const neg = fieldLines([{ x: 0, y: 0, q: -10 * nC }], {
		linesPerUnit: 12,
		unit: 10 * nC,
		bounds,
		step: 0.002,
		radius: 0.004
	});
	expect(neg.length).toBe(12);
	expect(neg.every((l) => l.from === -1 && l.to === 0)).toBe(true);
});

test('a wire: 5 A gives 50 µT at 2 cm, and a compass turns towards the circle', () => {
	expect(wireField(5, 0.02) * 1e6).toBeCloseTo(50, 6);
	expect(wireField(10, 0.01) * 1e6).toBeCloseTo(200, 6);
	expect(EARTH_H * 1e6).toBe(20);
	// No current: every compass points north.
	const n = compassField(0, 0.03, 0.01);
	expect(n.x).toBeCloseTo(0, 15);
	expect(n.y).toBeGreaterThan(0);
	// Current out of the page: east of the wire the field points north, north of it west.
	const east = compassField(5, 0.02, 0, 0);
	expect(east.y).toBeGreaterThan(0);
	const north = compassField(5, 0, 0.02, 0);
	expect(north.x).toBeLessThan(0);
	// Reversing the current reverses the wire's field.
	expect(compassField(-5, 0.02, 0, 0).y).toBeCloseTo(-east.y, 12);
});

test('elliptic integrals and the loop formulas agree with the textbook limits', () => {
	const { K, E } = ellipticKE(0);
	expect(K).toBeCloseTo(Math.PI / 2, 12);
	expect(E).toBeCloseTo(Math.PI / 2, 12);
	// K(0.5) = 1.854074677, E(0.5) = 1.350643881 (Abramowitz & Stegun table 17.1).
	const h = ellipticKE(0.5);
	expect(h.K).toBeCloseTo(1.854074677, 8);
	expect(h.E).toBeCloseTo(1.350643881, 8);
	const loop = { a: 0.02, z: 0, I: 1 };
	// Centre of a loop: μ₀ I / 2a; on the axis, the closed form.
	expect(loopField(loop, 0, 0).z).toBeCloseTo(MU0 / 0.04, 12);
	for (const z of [0.01, 0.03, 0.1]) {
		expect(loopField(loop, 1e-7, z).z / loopAxisField(loop, z)).toBeCloseTo(1, 6);
		expect(loopField(loop, 0, z).rho).toBe(0);
	}
	// Flux through a tiny circle is B·area; far away the loop is a dipole (μ₀ m a² ... ).
	const b = 1e-4;
	expect(loopFlux(loop, b, 0.03) / (Math.PI * b * b * loopAxisField(loop, 0.03))).toBeCloseTo(1, 4);
	const m = Math.PI * 0.02 ** 2;
	const z = 1;
	expect(
		loopFlux(loop, 0.02, z) / ((MU0 * m * 0.02 ** 2) / (2 * (0.02 ** 2 + z * z) ** 1.5))
	).toBeCloseTo(1, 2);
	// No magnetic charges: the field has zero divergence, so its lines close on themselves.
	const d = 1e-5;
	for (const [r, zz] of [
		[0.01, 0.015],
		[0.03, -0.01],
		[0.015, 0.002]
	]) {
		const div =
			((1 / r) *
				((r + d) * loopField(loop, r + d, zz).rho - (r - d) * loopField(loop, r - d, zz).rho)) /
				(2 * d) +
			(loopField(loop, r, zz + d).z - loopField(loop, r, zz - d).z) / (2 * d);
		expect(Math.abs(div) / Math.abs(loopField(loop, r, zz).z / r)).toBeLessThan(1e-4);
	}
});

test('a long coil has μ₀ n I inside; a bar magnet is the same as a coil', () => {
	const coil = coilLoops({ a: 0.01, length: 0.4, z: 0, turns: 400, I: 1 }, 400);
	// Long solenoid: B = μ₀ n I with n = 1000 turns per metre.
	expect(loopsField(coil, 0, 0).z / (MU0 * 1000)).toBeCloseTo(1, 2);
	// Magnet: moment M·V; far along the axis, B = μ₀ m / (2π z³).
	const m = magnetMoment(MAGNET);
	expect(m).toBeCloseTo((1.2 / MU0) * Math.PI * 0.005 ** 2 * 0.04, 10);
	const loops = magnetLoops(MAGNET);
	const far = loopsField(loops, 0, 0.5).z;
	expect(far / ((MU0 * m) / (2 * Math.PI * 0.5 ** 3))).toBeCloseTo(1, 2);
	// Inside a long magnet the field is close to B_r (less near its ends).
	expect(loopsField(loops, 0, 0).z).toBeGreaterThan(0.9);
	expect(loopsField(loops, 0, 0).z).toBeLessThan(1.2);
});

test('Faraday: a moving magnet induces an emf; a still one does nothing', () => {
	// Still magnet: no emf, wherever it is.
	for (const z of [-0.05, 0, 0.03]) expect(magnetEmf(z, 0)).toBeCloseTo(0, 15);
	// Flux peaks with the magnet in the middle of the coil.
	expect(magnetLinkage(0)).toBeGreaterThan(magnetLinkage(0.02));
	expect(magnetLinkage(0)).toBeGreaterThan(magnetLinkage(-0.02));
	// Coming in and going out give opposite pulses.
	const inPulse = magnetEmf(-0.02, 0.5);
	const outPulse = magnetEmf(0.02, 0.5);
	expect(Math.sign(inPulse)).toBe(-Math.sign(outPulse));
	// Twice as fast, twice the emf; twice the turns, twice the emf.
	expect(magnetEmf(-0.02, 1) / inPulse).toBeCloseTo(2, 10);
	expect(magnetEmf(-0.02, 0.5, 400) / inPulse).toBeCloseTo(2, 10);
	// Whole pass, from far on one side to far on the other: Σ emf dt = −ΔΦ ≈ 0.
	const { period } = swing(0, 0.5);
	let integral = 0;
	const dt = period / 4000;
	let peak = 0;
	for (let t = 0; t < period / 2; t += dt) {
		const s = swing(t, 0.5);
		const e = magnetEmf(s.z, s.v);
		integral += e * dt;
		peak = Math.max(peak, Math.abs(e));
	}
	expect(Math.abs(integral)).toBeLessThan(0.01 * peak * period);
	// The peak at 0.5 m/s is a few tenths of a volt: tens of mA through 10 Ω.
	expect(peak).toBeGreaterThan(0.1);
	expect(peak).toBeLessThan(1);
	expect(peak / R_PICKUP).toBeGreaterThan(0.01);
	// The lookup table matches the direct calculation.
	const tab = linkageTable();
	expect(tab.at(-0.013) / magnetLinkage(-0.013)).toBeCloseTo(1, 3);
	expect(
		tab.slope(-0.013) / ((magnetLinkage(-0.0128) - magnetLinkage(-0.0132)) / 0.0004)
	).toBeCloseTo(1, 2);
});

test('Lenz: the approaching north pole makes the near face of the coil a north pole', () => {
	// Magnet to the left (−z) with its north pole towards the coil, moving right.
	const emf = magnetEmf(-0.03, 0.5);
	// Flux along +z rising → induced current circulates to make a −z field inside:
	// a negative emf in the right-hand sense about +z.
	expect(emf).toBeLessThan(0);
	// Field of that induced current at the near (left) face points −z, out of the coil
	// towards the magnet: a north face, which repels the approaching north pole.
	const induced = coilLoops({ ...PICKUP, I: emf / R_PICKUP }, 6);
	expect(loopsField(induced, 0, -0.03).z).toBeLessThan(0);
});

test('a changing current next door induces one; a steady one does not', () => {
	const steady = neighbour(1.3, 0, 0.04);
	expect(steady.emf).toBeCloseTo(0, 15);
	expect(steady.I1).toBe(2);
	const slow = neighbour(0.25, 0.5, 0.04);
	const fast = neighbour(0.25, 1, 0.04);
	expect(fast.emfPeak / slow.emfPeak).toBeCloseTo(2, 10);
	// Closer coils share more flux.
	expect(neighbour(0, 1, 0.03).M).toBeGreaterThan(neighbour(0, 1, 0.06).M);
	// The induced emf peaks when the current is changing fastest (crossing zero).
	expect(Math.abs(fast.I1)).toBeCloseTo(0, 12);
	expect(Math.abs(fast.emf)).toBeCloseTo(fast.emfPeak, 12);
	// The numbers in the notes: 500 turns with 2 A at 1 Hz, 4 cm from the 200-turn pickup.
	const quoted = neighbour(0, 1, 0.04, 2).emfPeak;
	expect(quoted).toBeGreaterThan(0.003);
	expect(quoted).toBeLessThan(0.004);
});

test('light: c = 1/√(μ₀ε₀), and the wavelengths quoted', () => {
	expect(C / 299792458).toBeCloseTo(1, 8);
	expect(wavelength(100e6)).toBeCloseTo(3.0, 2);
	expect(wavelength(2.45e9) * 100).toBeCloseTo(12.2, 1);
	expect(wavelength(540e12) * 1e9).toBeCloseTo(555, 0);
	// E and B in phase, B = E/c, nothing ahead of the front.
	const f = 1e8;
	const p = waveAt(1, 2e-8, f);
	expect(p.B * C).toBeCloseTo(p.E, 12);
	expect(waveAt(10, 2e-8, f).E).toBe(0);
	// Faraday and Ampère–Maxwell hold: ∂E/∂x = −∂B/∂t and −∂B/∂x = μ₀ε₀ ∂E/∂t.
	const x = 1.1;
	const t = 3e-8;
	const dx = 1e-4;
	const dt = dx / C;
	const dEdx = (waveAt(x + dx, t, f).E - waveAt(x - dx, t, f).E) / (2 * dx);
	const dBdt = (waveAt(x, t + dt, f).B - waveAt(x, t - dt, f).B) / (2 * dt);
	expect(dEdx / -dBdt).toBeCloseTo(1, 4);
	const dBdx = (waveAt(x + dx, t, f).B - waveAt(x - dx, t, f).B) / (2 * dx);
	const dEdt = (waveAt(x, t + dt, f).E - waveAt(x, t - dt, f).E) / (2 * dt);
	expect(-dBdx / (MU0 * 8.8541878128e-12 * dEdt)).toBeCloseTo(1, 4);
});
