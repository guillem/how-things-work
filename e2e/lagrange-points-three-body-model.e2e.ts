// Checks the circular restricted three-body model against known results (Szebehely 1967; Murray &
// Dermott, Solar System Dynamics, ch. 3): where the Lagrange points of real pairs lie (Sun–Earth L1
// and L2 about 1.5 million km from Earth, Earth–Moon L1 and L2 58,000 and 64,500 km from the Moon),
// that a probe at rest at each point feels no net force in the turning frame, that seen from the
// stars the pulls at L1 and L2 equal what a one-period circle needs (and that gravity cancels much
// closer to Earth), the order of the critical Jacobi constants with C = 3 at L4 and L5, the
// Jacobi constant conserved by the integrator, the exponential drift from L1 (an e-folding of
// about 23 days at Sun–Earth), L4 stable only below Routh's ratio 0.0385, the Sun–Jupiter tadpole
// period of about 148 years, and two Earth–Moon probes a nudge apart splitting. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ROUTH,
	SYSTEMS,
	accelUnit,
	angleFromBig,
	criticalC,
	daysPerUnit,
	equalPullFromSmall,
	gradOmega,
	growthRate,
	integrate,
	jacobi,
	lagrangePoints,
	maxDistance,
	omega,
	onOrbit,
	pullsOnAxis,
	restingAt,
	separation,
	type State
} from '../src/routes/lagrange-points-three-body/model';
import { gatesOf, jacobiOfLevel } from '../src/routes/lagrange-points-three-body/scenes/shared';

const SE = SYSTEMS['sun-earth'];
const EM = SYSTEMS['earth-moon'];
const SJ = SYSTEMS['sun-jupiter'];

test('the mass ratios of the real pairs', () => {
	expect(SE.mu).toBeCloseTo(3.04e-6, 8);
	expect(EM.mu).toBeCloseTo(0.01215, 5);
	expect(1 / SJ.mu).toBeCloseTo(1048, 0);
	expect(SYSTEMS['pluto-charon'].mu).toBeGreaterThan(0.1);
});

test('Sun–Earth L1 and L2 lie about 1.5 million km from Earth, L2 slightly farther', () => {
	const L = lagrangePoints(SE.mu);
	const earth = 1 - SE.mu;
	const l1 = (earth - L.L1.x) * SE.a;
	const l2 = (L.L2.x - earth) * SE.a;
	expect(l1).toBeGreaterThan(1.49e6);
	expect(l1).toBeLessThan(1.505e6);
	expect(l2).toBeGreaterThan(1.5e6);
	expect(l2).toBeLessThan(1.515e6);
	expect(l2).toBeGreaterThan(l1);
	// L3: on the far side of the Sun, almost exactly at Earth's distance
	expect(Math.abs(-SE.mu - L.L3.x - 1)).toBeLessThan(1e-5);
});

test('Earth–Moon L1 and L2: 58,000 and 64,500 km from the Moon (Szebehely: γ₁ = 0.1509, γ₂ = 0.1678)', () => {
	const L = lagrangePoints(EM.mu);
	const moon = 1 - EM.mu;
	expect(moon - L.L1.x).toBeCloseTo(0.1509, 3);
	expect(L.L2.x - moon).toBeCloseTo(0.1678, 3);
	expect((moon - L.L1.x) * EM.a).toBeGreaterThan(57_500);
	expect((moon - L.L1.x) * EM.a).toBeLessThan(58_500);
	expect((L.L2.x - moon) * EM.a).toBeGreaterThan(64_000);
	expect((L.L2.x - moon) * EM.a).toBeLessThan(65_000);
});

test('L1 and L2 sit about (μ/3)^⅓ of the separation from the small body (the Hill radius)', () => {
	for (const mu of [1e-6, 1e-4, 1e-3]) {
		const L = lagrangePoints(mu);
		const rH = Math.cbrt(mu / 3);
		expect((1 - mu - L.L1.x) / rH).toBeCloseTo(1, 1);
		expect((L.L2.x - 1 + mu) / rH).toBeCloseTo(1, 1);
	}
});

test('at all five points a probe at rest feels no net force in the turning frame', () => {
	for (const mu of [3e-6, 0.001, 0.01215, 0.1, 0.5]) {
		const L = lagrangePoints(mu);
		for (const p of Object.values(L)) {
			const g = gradOmega(mu, p.x, p.y);
			expect(Math.hypot(g.x, g.y)).toBeLessThan(1e-9);
		}
		// L4 and L5 form equilateral triangles with the two bodies
		const r1 = Math.hypot(L.L4.x + mu, L.L4.y);
		const r2 = Math.hypot(L.L4.x - 1 + mu, L.L4.y);
		expect(r1).toBeCloseTo(1, 12);
		expect(r2).toBeCloseTo(1, 12);
	}
});

test('seen from the stars, the pulls at L1 and L2 are exactly what a one-year circle needs', () => {
	const L = lagrangePoints(SE.mu);
	const u = accelUnit(SE) * 1000; // mm/s²
	// the Sun's pull at 1 AU: GM/r² = 5.93 mm/s²
	expect(-pullsOnAxis(SE.mu, 1 - SE.mu).big * u).toBeCloseTo(5.93, 2);
	for (const id of ['L1', 'L2'] as const) {
		const p = pullsOnAxis(SE.mu, L[id].x);
		expect(p.big + p.small).toBeCloseTo(p.needed, 9);
	}
	// at L1 Earth's pull offsets part of the Sun's; at L2 it adds to it
	const p1 = pullsOnAxis(SE.mu, L.L1.x);
	const p2 = pullsOnAxis(SE.mu, L.L2.x);
	expect(Math.sign(p1.small)).toBe(-Math.sign(p1.big));
	expect(Math.sign(p2.small)).toBe(Math.sign(p2.big));
	expect(-p1.big * u).toBeCloseTo(6.05, 2);
	expect(p1.small * u).toBeCloseTo(0.18, 2);
	expect(-p1.needed * u).toBeCloseTo(5.87, 2);
	// alone, the Sun would take a body at L1's distance round in 0.985 yr (Kepler's third law)
	const r = L.L1.x + SE.mu;
	expect(Math.pow(r, 1.5)).toBeCloseTo(0.985, 3);
	// the pulls cancel about 260,000 km from Earth, nowhere near L1
	expect(equalPullFromSmall(SE.mu) * SE.a).toBeGreaterThan(255_000);
	expect(equalPullFromSmall(SE.mu) * SE.a).toBeLessThan(265_000);
});

test('critical Jacobi constants: C1 > C2 > C3 > C4 = C5 = 3', () => {
	for (const mu of [3e-6, 0.001, 0.01215, 0.3]) {
		const c = criticalC(mu);
		expect(c.L1).toBeGreaterThan(c.L2);
		expect(c.L2).toBeGreaterThan(c.L3);
		expect(c.L3).toBeGreaterThan(c.L4);
		expect(c.L4).toBeCloseTo(3, 12);
		expect(c.L5).toBeCloseTo(3, 12);
	}
	// Earth–Moon C1 ≈ 3.2003 (Koon, Lo, Marsden & Ross, Dynamical Systems, the Three-Body Problem and Space Mission Design, with E = −C/2)
	expect(criticalC(EM.mu).L1).toBeCloseTo(3.2003, 3);
	// equal masses: C2 = C3, so the two outer gates open together
	const half = criticalC(0.5);
	expect(half.L2).toBeCloseTo(half.L3, 10);
	expect(gatesOf(0.5, half.L2 - 1e-6)).toBe('gates at L1, L2 and L3 open');
	// the gate summary follows the real C: exactly at C1 the gate is still shut
	expect(gatesOf(EM.mu, criticalC(EM.mu).L1)).toBe('every gate shut');
	expect(gatesOf(EM.mu, criticalC(EM.mu).L1 - 1e-9)).toBe('gate at L1 open');
	// the energy slider's marks fall on the critical values
	const c = criticalC(EM.mu);
	expect(jacobiOfLevel(EM.mu, 1)).toBeCloseTo(c.L1, 12);
	expect(jacobiOfLevel(EM.mu, 2)).toBeCloseTo(c.L2, 12);
	expect(jacobiOfLevel(EM.mu, 3)).toBeCloseTo(c.L3, 12);
	expect(jacobiOfLevel(EM.mu, 4)).toBeCloseTo(3, 12);
});

test('the integrator keeps the Jacobi constant through a year of close passes', () => {
	const mu = EM.mu;
	const c = criticalC(mu);
	const x = 0.8;
	const v = Math.sqrt(2 * omega(mu, x, 0) - (c.L1 + c.L2) / 2);
	const s0: State = [x, 0, 0, v];
	const p = integrate(mu, s0, 365 / daysPerUnit(EM), 366);
	expect(p.end).toBeNull();
	expect(Math.abs(jacobi(mu, p.last) - jacobi(mu, s0))).toBeLessThan(1e-9);
	// it really went somewhere: it visited both the Earth's and the Moon's regions
	let nearMoon = false;
	let nearEarth = false;
	for (let i = 0; i < p.n; i++) {
		const X = p.xy[2 * i];
		if (X > 1 - mu - 0.1) nearMoon = true;
		if (X < 0.3) nearEarth = true;
	}
	expect(nearMoon && nearEarth).toBe(true);
});

test('L1 is unstable: an offset grows by e every 23 days at Sun–Earth, 1.5 and 2.0 days at Earth–Moon L1 and L2', () => {
	const L = lagrangePoints(SE.mu);
	expect(daysPerUnit(SE) / growthRate(SE.mu, L.L1)).toBeCloseTo(23, 0);
	expect(daysPerUnit(SE) / growthRate(SE.mu, L.L2)).toBeCloseTo(23, 0);
	expect(daysPerUnit(EM) / growthRate(EM.mu, lagrangePoints(EM.mu).L1)).toBeCloseTo(1.5, 1);
	expect(daysPerUnit(EM) / growthRate(EM.mu, lagrangePoints(EM.mu).L2)).toBeCloseTo(2.0, 1);
	// integrated: 1,000 km off Sun–Earth L1, more than 100,000 km off after four months
	const p = integrate(SE.mu, restingAt(L.L1, 1000 / SE.a), 120 / daysPerUnit(SE), 121);
	const i = p.n - 1;
	const off = Math.hypot(p.xy[2 * i] - L.L1.x, p.xy[2 * i + 1]) * SE.a;
	expect(off).toBeGreaterThan(100_000);
	expect(off).toBeLessThan(300_000);
	// and within a week near the Moon, tens of thousands of km
	const LM = lagrangePoints(EM.mu);
	const q = integrate(EM.mu, restingAt(LM.L1, 1000 / EM.a), 7 / daysPerUnit(EM), 8);
	const j = q.n - 1;
	expect(Math.hypot(q.xy[2 * j] - LM.L1.x, q.xy[2 * j + 1]) * EM.a).toBeGreaterThan(20_000);
});

test('L4 and L5 are linearly stable only below Routh’s ratio, about 1 in 26', () => {
	expect(ROUTH).toBeCloseTo(0.0385, 4);
	expect(1 / ROUTH).toBeCloseTo(26, 0);
	for (const mu of [3e-6, 9.5e-4, 0.01215, 0.03, 0.038])
		expect(growthRate(mu, lagrangePoints(mu).L4)).toBeLessThan(1e-6);
	for (const mu of [0.039, 0.05, 0.109, 0.5])
		expect(growthRate(mu, lagrangePoints(mu).L4)).toBeGreaterThan(1e-3);
	// the collinear points are unstable for every mass ratio
	for (const mu of [3e-6, 0.01215, 0.5]) {
		const L = lagrangePoints(mu);
		for (const id of ['L1', 'L2', 'L3'] as const) expect(growthRate(mu, L[id])).toBeGreaterThan(0);
	}
});

test('integrated: a probe 1° ahead of L4 stays below the limit and escapes above it', () => {
	const run = (mu: number) => integrate(mu, onOrbit(mu, 61), 2 * Math.PI * 120, 2401);
	for (const mu of [0.005, 0.01, 0.02, 0.03, 0.035, 0.038]) {
		const p = run(mu);
		expect(p.end).toBeNull();
		expect(maxDistance(p, lagrangePoints(mu).L4)).toBeLessThan(0.3);
	}
	for (const mu of [0.045, 0.05, 0.06, 0.109])
		expect(maxDistance(run(mu), lagrangePoints(mu).L4)).toBeGreaterThan(1);
	// inside the limit but at the 2:1 resonance of the two oscillations (μ ≈ 0.0243, Deprit &
	// Deprit-Bartholomé 1967) the same probe escapes too
	expect(maxDistance(run(0.0245), lagrangePoints(0.0245).L4)).toBeGreaterThan(1);
});

test('a Sun–Jupiter tadpole: bounded for centuries, one swing about every 148 years', () => {
	const mu = SJ.mu;
	const p = integrate(mu, onOrbit(mu, 62), 2 * Math.PI * 80, 8001, { k: 0.02 });
	const ang = (i: number) => angleFromBig(mu, p.xy[2 * i], p.xy[2 * i + 1]);
	const peaks: number[] = [];
	let lo = 180;
	let hi = 0;
	for (let i = 1; i < p.n - 1; i++) {
		lo = Math.min(lo, ang(i));
		hi = Math.max(hi, ang(i));
		if (ang(i) > ang(i - 1) && ang(i) >= ang(i + 1) && ang(i) > 61) peaks.push(p.t[i]);
	}
	expect(hi).toBeLessThan(62.5);
	expect(lo).toBeGreaterThan(57);
	const years = ((peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1)) * daysPerUnit(SJ);
	expect(years / 365.25).toBeGreaterThan(140);
	expect(years / 365.25).toBeLessThan(156);
	// a wide tadpole, dropped 100° ahead, still never reaches Jupiter or L3
	const w = integrate(mu, onOrbit(mu, 100), 2 * Math.PI * 300, 6001, { k: 0.02 });
	let wlo = 180;
	let whi = 0;
	for (let i = 0; i < w.n; i++) {
		wlo = Math.min(wlo, angleFromBig(mu, w.xy[2 * i], w.xy[2 * i + 1]));
		whi = Math.max(whi, angleFromBig(mu, w.xy[2 * i], w.xy[2 * i + 1]));
	}
	expect(w.end).toBeNull();
	expect(wlo).toBeGreaterThan(20);
	expect(whi).toBeLessThan(110);
});

test('two Earth–Moon probes a nudge apart split; a smaller nudge only delays it', () => {
	const mu = EM.mu;
	const c = criticalC(mu);
	const x = 0.8;
	const v = Math.sqrt(2 * omega(mu, x, 0) - (c.L1 + c.L2) / 2);
	const T = 365 / daysPerUnit(EM);
	const opts = { rBig: EM.rBig / EM.a, rSmall: EM.rSmall / EM.a };
	const a = integrate(mu, [x, 0, 0, v], T, 366, opts);
	const splitDay = (km: number) => {
		const b = integrate(mu, [x + km / EM.a, 0, 0, v], T, 366, opts);
		const d = separation(a, b);
		for (let i = 0; i < d.length; i++) if (d[i] * EM.a > 10_000) return i;
		return Infinity;
	};
	const km = splitDay(1);
	const m = splitDay(0.001);
	// together for months, then apart
	expect(km).toBeGreaterThan(150);
	expect(km).toBeLessThan(300);
	// a thousand times smaller nudge: later, but within the year
	expect(m).toBeGreaterThan(km);
	expect(m).toBeLessThan(365);
	expect(m - km).toBeLessThan(200);
});
