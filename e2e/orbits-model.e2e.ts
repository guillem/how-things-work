// Checks the gravity model behind the orbits-kepler explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	EARTH_MASS,
	JUPITER_MASS,
	PLANETS,
	cannon,
	circularSpeed,
	elements,
	escapeSpeed,
	integrate,
	lowOrbitSpeed,
	sweptArea
} from '../src/routes/orbits-kepler/orbits';

const at1 = { x: 1, y: 0 };
const launch = (f: number) => ({ x: 0, y: f * circularSpeed(1) });

test('the Earth: 1 AU at 2π AU/yr is a circle taking one year (≈ 29.8 km/s)', () => {
	expect(circularSpeed(1)).toBeCloseTo(2 * Math.PI, 10);
	expect(circularSpeed(1) * 4.74).toBeCloseTo(29.8, 1);
	const e = elements(at1, launch(1));
	expect(e.kind).toBe('circle');
	expect(e.period).toBeCloseTo(1, 10);
});

test('slower: an ellipse inside; faster: an ellipse outside; √2 × faster: escape', () => {
	expect(elements(at1, launch(0.8)).kind).toBe('ellipse');
	expect(elements(at1, launch(0.8)).aphelion).toBeCloseTo(1, 10);
	expect(elements(at1, launch(1.2)).perihelion).toBeCloseTo(1, 10);
	expect(escapeSpeed(1) / circularSpeed(1)).toBeCloseTo(Math.SQRT2, 12);
	expect(elements(at1, launch(1.6)).kind).toBe('hyperbola');
	expect(elements(at1, launch(1.6)).energy).toBeGreaterThan(0);
});

test('first law: the simulated path is the predicted ellipse, the Sun at a focus', () => {
	const v = launch(0.8);
	const el = elements(at1, v);
	const tr = integrate([{ r: at1, v, m: 0 }], el.period, 0.002);
	const n = tr.x[0].length;
	let minD = Infinity;
	let maxD = 0;
	for (let s = 0; s < n; s++) {
		const d = Math.hypot(tr.x[0][s], tr.y[0][s]);
		minD = Math.min(minD, d);
		maxD = Math.max(maxD, d);
	}
	expect(minD).toBeCloseTo(el.perihelion, 3);
	expect(maxD).toBeCloseTo(el.aphelion, 3);
	// Back where it started after one period (third law).
	expect(Math.hypot(tr.x[0][n - 1] - 1, tr.y[0][n - 1])).toBeLessThan(0.01);
});

test('second law: equal areas in equal times', () => {
	const v = launch(0.7);
	const el = elements(at1, v);
	const tr = integrate([{ r: at1, v, m: 0 }], el.period, 0.001);
	const n = Math.round(el.period / 0.001);
	const q = Math.floor(n / 6);
	const areas = [0, 1, 2, 3, 4, 5].map((k) => sweptArea(tr, 0, k * q, (k + 1) * q));
	for (const A of areas) expect(A / areas[0]).toBeCloseTo(1, 3);
	// …and the total is the ellipse's area π a b.
	const b = el.a * Math.sqrt(1 - el.e ** 2);
	expect(sweptArea(tr, 0, 0, n)).toBeCloseTo(Math.PI * el.a * b, 2);
});

test('third law: T² / a³ = 1 (in years and AU) for every planet', () => {
	for (const p of PLANETS) expect(p.period ** 2 / p.a ** 3).toBeCloseTo(1, 1);
	for (const f of [0.6, 0.9, 1.1, 1.3]) {
		const el = elements(at1, launch(f));
		expect(el.period ** 2 / el.a ** 3).toBeCloseTo(1, 10);
	}
});

test('two planets: a heavy neighbour disturbs the orbit; an Earth-mass one barely does', () => {
	const run = (m: number) =>
		integrate(
			[
				{ r: at1, v: launch(1), m: EARTH_MASS },
				{ r: { x: -1.6, y: 0 }, v: { x: 0, y: -circularSpeed(1.6) }, m }
			],
			20,
			0.01
		);
	const spread = (m: number) => {
		const t = run(m);
		let lo = Infinity;
		let hi = 0;
		for (let s = 0; s < t.x[0].length; s++) {
			const d = Math.hypot(t.x[0][s], t.y[0][s]);
			lo = Math.min(lo, d);
			hi = Math.max(hi, d);
		}
		return hi - lo;
	};
	expect(spread(EARTH_MASS)).toBeLessThan(0.001);
	expect(spread(10 * JUPITER_MASS)).toBeGreaterThan(0.02);
});

test('Newton’s cannon: too slow falls back, about 8 km/s goes all the way round', () => {
	expect(lowOrbitSpeed()).toBeCloseTo(7.9, 1);
	expect(cannon(6).hit).toBe(true);
	expect(cannon(7.9).hit).toBe(false);
});
