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
import { LABEL_GAP, placeLabel } from '../src/routes/orbits-kepler/labels';

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

// ---- placing the second law's area labels ----------------------------------------

const panel = { x0: 16, y0: 16, x1: 640, y1: 584 };
const sun = { x: 300, y: 300 };
const crowds = (p: { x: number; y: number }, q: { x: number; y: number }) =>
	Math.abs(p.x - q.x) < LABEL_GAP.x && Math.abs(p.y - q.y) < LABEL_GAP.y;
const around = (p: { x: number; y: number }) => Math.atan2(p.y - sun.y, p.x - sun.x);
const polar = (r: number, a: number) => ({
	x: sun.x + r * Math.cos(a),
	y: sun.y + r * Math.sin(a)
});

test('an area label goes just outside its point of the orbit when there is room', () => {
	const top = placeLabel(sun, -Math.PI / 2, 150, [], panel);
	// Straight out from the Sun, a little beyond the orbit.
	expect(top.x).toBeCloseTo(300, 6);
	expect(300 - top.y).toBeGreaterThan(150);
	expect(300 - top.y).toBeLessThan(150 + 40);
});

test('a crowded area label moves out, but stays by its own point of the orbit', () => {
	// Straight above the Sun, 150 below the orbit point: the first spot and the
	// slides round the Sun near it are all taken, and so is the first spot on the
	// next two rings out.
	const phi = -Math.PI / 2;
	const placed = [-0.6, -0.3, 0, 0.3, 0.6].map((d) => polar(172, phi + d));
	placed.push(polar(192, phi), polar(212, phi));
	const p = placeLabel(sun, phi, 150, placed, panel);
	for (const q of placed) expect(crowds(p, q)).toBe(false);
	// Within 20° of the orbit point, seen from the Sun: still reads as this wedge's.
	expect(Math.abs(around(p) - phi)).toBeLessThan((20 * Math.PI) / 180);
});

test('an area label near the edge of the panel stays inside it', () => {
	// The orbit point is 10 short of the right edge: the label, 22 further out, is pulled in.
	const p = placeLabel(sun, 0, 330, [], panel);
	expect(p.x + 29).toBeLessThanOrEqual(panel.x1);
	const q = placeLabel(sun, Math.PI / 2, 270, [], panel);
	expect(q.y + 7).toBeLessThanOrEqual(panel.y1);
});
