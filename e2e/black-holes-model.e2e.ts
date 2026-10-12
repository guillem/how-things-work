// Checks the black-hole model behind the explainer: real paths of light and
// matter round a Schwarzschild black hole, against known results. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ARCSEC,
	B_CRIT,
	C,
	ECLIPSE_1919,
	GM_EARTH,
	GM_SUN,
	M87,
	MERCURY,
	R_EARTH,
	R_GPS,
	R_SUN,
	SGR_A,
	circularL,
	clockRate,
	criticalImpact,
	deflection,
	deflectionTable,
	einsteinAngle,
	escapeCone,
	flashRay,
	images,
	newtonCircularL,
	newtonU,
	perihelionAdvance,
	periapses,
	probe,
	ray,
	schwarzschildRadius,
	shadowAngle,
	shadowMicroarcsec,
	skyAngle,
	trace
} from '../src/routes/black-holes/blackhole';

test('Schwarzschild radius: about 3 km for the Sun, 9 mm for the Earth, 0.08 AU for Sgr A*', () => {
	expect(schwarzschildRadius(GM_SUN) / 1000).toBeCloseTo(2.95, 2);
	expect(schwarzschildRadius(GM_EARTH) * 1000).toBeCloseTo(8.87, 2);
	const sgr = schwarzschildRadius(SGR_A.mass * GM_SUN);
	expect(sgr / 1e9).toBeCloseTo(12.26, 1); // 12 million km
	expect(sgr / R_SUN).toBeCloseTo(17.6, 0);
});

test('light passing closer than √27 GM/c² (2.6 r_s) is captured; farther, it escapes', () => {
	expect(criticalImpact(1e-6)).toBeCloseTo(B_CRIT, 4);
	expect(ray(B_CRIT - 0.01).fate).toBe('captured');
	expect(ray(B_CRIT + 0.01).fate).toBe('escaped');
	expect(ray(2).fate).toBe('captured');
	expect(ray(10).fate).toBe('escaped');
});

test('just outside the critical value, light loops round the hole, more times the closer it is', () => {
	const sweep = (db: number) => ray(B_CRIT + db, { maxSweep: 60 * Math.PI }).sweep;
	const loops = (db: number) => (sweep(db) - Math.PI) / (2 * Math.PI);
	expect(loops(1e-1)).toBeLessThan(1);
	expect(loops(1e-3)).toBeGreaterThan(1);
	expect(loops(1e-6)).toBeGreaterThan(loops(1e-3) + 0.9);
});

test('the photon sphere: light can circle at r = 1.5 r_s, but the orbit is unstable', () => {
	// Sideways at r = 3: stays there for four turns.
	const circle = trace(1 / 3, 0, 0, { maxSweep: 8 * Math.PI });
	expect(circle.fate).toBe('orbiting');
	for (let i = 0; i < circle.n; i += 200) expect(1 / circle.u[i]).toBeCloseTo(3, 4);
	// A nudge of one part in a million grows: in or out.
	expect(trace(1 / 3.000003, 0, 0, { maxSweep: 40 * Math.PI }).fate).toBe('escaped');
	expect(trace(1 / 2.999997, 0, 0, { maxSweep: 40 * Math.PI }).fate).toBe('captured');
});

test('far from the hole, light bends by 4GM/(c²b), as Einstein predicted', () => {
	for (const b of [2000, 10000]) {
		expect(deflection(b) / (4 / b)).toBeCloseTo(1, 2);
	}
	// Closer in it bends more than that formula says.
	expect(deflection(12)).toBeGreaterThan(1.3 * (4 / 12));
});

test('starlight grazing the Sun bends 1.75″: what the 1919 eclipse measured', () => {
	const bendSun = (4 * GM_SUN) / (C * C * R_SUN) / ARCSEC;
	expect(bendSun).toBeCloseTo(1.75, 2);
	// Within the measurement errors of both 1919 expeditions (2σ for Sobral).
	expect(Math.abs(bendSun - ECLIPSE_1919.sobral)).toBeLessThan(2 * ECLIPSE_1919.sobralError);
	expect(Math.abs(bendSun - ECLIPSE_1919.principe)).toBeLessThan(ECLIPSE_1919.principeError);
});

test('a lamp lowered towards the horizon: less and less of its light gets out', () => {
	// Fire rays in every direction and count those that escape.
	const fraction = (r0: number) => {
		const N = 360;
		let out = 0;
		for (let k = 0; k < N; k++) {
			const psi = ((k + 0.5) / N) * Math.PI;
			if (flashRay(r0, psi, { maxSweep: 6 * Math.PI }).fate === 'escaped') out++;
		}
		return out / N;
	};
	for (const r0 of [2.2, 2.6, 3, 4, 8]) {
		expect(fraction(r0)).toBeCloseTo(escapeCone(r0) / Math.PI, 1);
	}
	expect(escapeCone(3)).toBeCloseTo(Math.PI / 2, 10); // the photon sphere: half the sky
	expect(fraction(2.02)).toBeLessThan(0.1);
	expect(escapeCone(2)).toBe(0); // at the horizon, nothing
});

test('a clock held near the hole ticks slower: √(1 − r_s/r) of a distant one', () => {
	expect(clockRate(4)).toBeCloseTo(Math.SQRT1_2, 10); // at 2 r_s
	expect(clockRate(2 * 1.1)).toBeCloseTo(0.3015, 4);
	expect(clockRate(2)).toBe(0);
	expect(clockRate(2e6)).toBeCloseTo(1, 5);
});

test('GPS: clocks in orbit gain about 45 µs a day on the ground from gravity alone', () => {
	const rate = (gm: number, r: number) => Math.sqrt(1 - (2 * gm) / (C * C * r));
	const gain = (rate(GM_EARTH, R_GPS) - rate(GM_EARTH, R_EARTH)) * 86400 * 1e6;
	// Ashby 2003: 45.7 µs per day.
	expect(gain).toBeCloseTo(45.7, 0);
});

test('far from the hole an orbit is Newton’s: Kepler’s third law and a closed ellipse', () => {
	// A circular orbit at r = 10⁴ GM/c² (5000 r_s) takes 2π√(r³/GM) of distant time.
	const r = 1e4;
	const p = probe(r, circularL(r), { maxSweep: 2 * Math.PI });
	expect(p.fate).toBe('orbiting');
	expect(p.time[p.n - 1] / (2 * Math.PI * Math.sqrt(r ** 3))).toBeCloseTo(1, 3);
	// Launched slower than circular, it stays within 0.1% of Newton's ellipse.
	const L = 0.9 * newtonCircularL(r);
	const q = probe(r, L, { maxSweep: 2 * Math.PI });
	for (let i = 0; i < q.n; i += 100) {
		expect(Math.abs(q.u[i] / newtonU(r, L, q.phi[i]) - 1)).toBeLessThan(0.001);
	}
});

test('closer in, the orbit’s closest point turns: 6πGM/(c²a(1 − e²)) per orbit', () => {
	// Measured from the traced orbit, compared with the weak-field formula.
	const r0 = 300;
	const L = 1.1 * newtonCircularL(r0);
	const p = probe(r0, L, { maxSweep: 6 * Math.PI, dphi: 0.001 });
	const peri = periapses(p);
	expect(peri.length).toBeGreaterThanOrEqual(2);
	const shift = peri[1] - peri[0] - 2 * Math.PI;
	// The same launch under Newton: rp = r0, e = L²/r0 − 1, a = rp/(1 − e).
	const e = (L * L) / r0 - 1;
	const a = r0 / (1 - e);
	expect(shift / perihelionAdvance(a, e)).toBeCloseTo(1, 1);
});

test('Mercury: general relativity’s extra 43″ per century', () => {
	const m = GM_SUN / (C * C);
	const perOrbit = perihelionAdvance(MERCURY.a / m, MERCURY.e);
	const perCentury = (perOrbit * 36525) / MERCURY.periodDays / ARCSEC;
	expect(perCentury).toBeCloseTo(43, 0);
});

test('the innermost stable circular orbit is at 3 r_s', () => {
	// Circular orbits nudged a little slower: they stay near their circle outside
	// r = 6 GM/c² and plunge into the hole inside it.
	const nudged = (r: number) => probe(r, circularL(r) * 0.997, { maxSweep: 12 * Math.PI });
	const outside = nudged(7);
	expect(outside.fate).toBe('orbiting');
	expect(Math.min(...Array.from(outside.u, (u) => 1 / u))).toBeGreaterThan(5.5);
	expect(nudged(5.5).fate).toBe('captured');
	expect(nudged(4).fate).toBe('captured');
	// No circular orbit at all inside 1.5 r_s.
	expect(circularL(3)).toBeNaN();
});

test('the shadow is 2.6 r_s in radius, not the horizon’s 1 r_s', () => {
	// Seen from far away (D = 10⁶ GM/c²) the shadow's radius is √27 GM/c² ≈ 2.6 r_s.
	const D = 1e6;
	expect((D * Math.sin(shadowAngle(D))) / 2).toBeCloseTo(2.598, 2);
	const tab = deflectionTable();
	expect(Number.isNaN(skyAngle(tab, D, (0.99 * B_CRIT) / D))).toBe(true);
	expect(Number.isNaN(skyAngle(tab, D, (1.01 * B_CRIT) / D))).toBe(false);
});

test('the shadows of Sgr A* and M87* match the rings the Event Horizon Telescope imaged', () => {
	const sgr = shadowMicroarcsec(SGR_A.mass, SGR_A.distance);
	expect(sgr).toBeCloseTo(52, 0);
	expect(Math.abs(sgr - SGR_A.ring)).toBeLessThan(SGR_A.ringError);
	const m87 = shadowMicroarcsec(M87.mass, M87.distance);
	expect(m87).toBeCloseTo(40, 0);
	// The mass is only known to ±11%; the prediction sits within that of the ring.
	expect(Math.abs(m87 / M87.ring - 1)).toBeLessThan(0.11);
});

test('a star exactly behind the hole becomes a ring at θ_E ≈ 2√(GM/(c²D))', () => {
	const tab = deflectionTable();
	const D = 1e6;
	const thE = einsteinAngle(tab, D);
	expect(thE / (2 * Math.sqrt(1 / D))).toBeCloseTo(1, 2);
	// A star slightly off to one side gives two images straddling the ring,
	// each at a place where the lens equation holds.
	const beta = 0.2 * thE;
	const im = images(tab, D, beta);
	expect(im.outer).toBeGreaterThan(thE);
	expect(im.inner).toBeLessThan(thE);
	expect(skyAngle(tab, D, im.outer)).toBeCloseTo(beta, 8);
	expect(skyAngle(tab, D, im.inner)).toBeCloseTo(-beta, 8);
});
