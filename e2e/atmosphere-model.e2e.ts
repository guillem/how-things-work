// Checks the models behind the atmosphere-weather explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	D_EARTH,
	advectedTemperature,
	canForm,
	category,
	cells,
	climate,
	coriolis,
	hadleyEdge,
	insolation,
	maxIntensity,
	parcel,
	pressure,
	rossby,
	stormEvolve,
	stormIntensity,
	stormWindIntegral,
	tempAt,
	wind,
	type System
} from '../src/routes/atmosphere-weather/atmosphere';

test('sunlight: more at the equator, 340 W/m² on average', () => {
	expect(insolation(0)).toBeGreaterThan(410);
	expect(insolation(0)).toBeLessThan(430);
	expect(insolation(90)).toBeGreaterThan(170);
	expect(insolation(90)).toBeLessThan(180);
	// Average over the sphere (uniform in sin φ).
	let s = 0;
	for (let i = 0; i < 1000; i++)
		s += insolation((Math.asin(-1 + (2 * (i + 0.5)) / 1000) * 180) / Math.PI);
	expect(s / 1000).toBeCloseTo(1361 / 4, 0);
});

test('energy balance: today’s climate, and what it would be without heat transport', () => {
	const now = climate(D_EARTH);
	expect(tempAt(now, 0)).toBeGreaterThan(24);
	expect(tempAt(now, 0)).toBeLessThan(31);
	expect(tempAt(now, 89)).toBeLessThan(-5);
	const peak = Math.max(...now.northward) / 1e15;
	expect(peak).toBeGreaterThan(4.5); // observed ~5–6 PW near 35°
	expect(peak).toBeLessThan(7);
	const peakLat = now.edges[now.northward.indexOf(Math.max(...now.northward))];
	expect(peakLat).toBeGreaterThan(25);
	expect(peakLat).toBeLessThan(45);
	const none = climate(0);
	expect(tempAt(none, 0) - tempAt(none, 89)).toBeGreaterThan(tempAt(now, 0) - tempAt(now, 89) + 40);
	// Without transport each band balances on its own: absorbed = emitted.
	none.absorbed.forEach((a, i) => expect(a).toBeCloseTo(none.emitted[i], 6));
	// With transport, the tropics absorb more than they emit, the poles emit more.
	expect(now.absorbed[45]).toBeGreaterThan(now.emitted[45]);
	expect(now.absorbed[0]).toBeLessThan(now.emitted[0]);
	// The global mean doesn't depend on transport (it only moves heat around).
	const mean = (c: ReturnType<typeof climate>) => c.T.reduce((a, b) => a + b, 0) / c.T.length;
	expect(mean(none)).toBeCloseTo(mean(now), 6);
});

test('Hadley cell: about 30–35° on Earth, narrower on a faster planet, three cells', () => {
	expect(hadleyEdge(1)).toBeGreaterThan(28);
	expect(hadleyEdge(1)).toBeLessThan(38);
	expect(hadleyEdge(2)).toBeCloseTo(hadleyEdge(1) / 2, 6);
	expect(hadleyEdge(0)).toBe(90);
	const earth = cells(1);
	expect(earth.map((c) => c.surface)).toEqual(['easterly', 'westerly', 'easterly']);
	expect(cells(0)).toHaveLength(1);
	expect(cells(0)[0].surface).toBe('none');
	expect(cells(3).length).toBeGreaterThan(3);
});

test('Coriolis: deflected right in the north, left in the south, not on the equator', () => {
	expect(coriolis(0)).toBe(0);
	expect(coriolis(45)).toBeCloseTo(1.03e-4, 6);
	// Pushed north: in the north it veers east (to its right), in the south west (to its left).
	const n = parcel(40, 0, 10, 1, 30, 300);
	expect(n.x[10]).toBeGreaterThan(0);
	const s = parcel(-40, 0, 10, 1, 30, 300);
	expect(s.x[10]).toBeLessThan(0);
	// Moving east along the equator: no turn at all.
	const e = parcel(0, 90, 10, 1, 100, 300);
	expect(Math.abs(e.y[100])).toBeLessThan(1e-9);
	// No spin, no turn.
	const still = parcel(40, 0, 10, 0, 50, 300);
	expect(Math.abs(still.x[50])).toBeLessThan(1e-9);
	// Inertial circle: back near the start after one period 2π/f.
	const period = (2 * Math.PI) / coriolis(45);
	const steps = Math.round(period / 60);
	const c = parcel(45, 0, 5, 1, steps, 60);
	expect(Math.hypot(c.x[steps], c.y[steps])).toBeLessThan(15); // km, after a ~70 km wide loop
});

test('Rossby number: a sink is far too small and quick for the Coriolis effect', () => {
	expect(rossby(0.1, 0.3)).toBeGreaterThan(1000);
	expect(rossby(10, 1e6)).toBeLessThan(0.2);
});

test('winds go round lows: anticlockwise in the north, clockwise in the south, and inward near the ground', () => {
	const low: System[] = [{ kind: 'low', x: 0, y: 0, dp: -20, r: 400 }];
	const [u, v] = wind(low, 400, 0, 45, false); // east of the centre
	expect(v).toBeGreaterThan(5); // blowing north: anticlockwise
	expect(Math.abs(u)).toBeLessThan(1e-6);
	const [, vs] = wind(low, 400, 0, -45, false);
	expect(vs).toBeLessThan(-5); // clockwise in the south
	const [us] = wind(low, 400, 0, 45, true);
	expect(us).toBeLessThan(0); // near the ground it also blows in towards the low
	const high: System[] = [{ kind: 'high', x: 0, y: 0, dp: 20, r: 400 }];
	expect(wind(high, 400, 0, 45, false)[1]).toBeLessThan(-5); // clockwise round a northern high
	expect(pressure(low, 0, 0)).toBeCloseTo(993, 6);
});

test('a low wraps warm and cold air into fronts: the temperature contrast sharpens', () => {
	const low: System[] = [{ kind: 'low', x: 0, y: 0, dp: -25, r: 500 }];
	const maxGradient = (hours: number) => {
		let g = 0;
		for (let x = -1000; x <= 1000; x += 50)
			for (let y = -1000; y <= 1000; y += 50) {
				const a = advectedTemperature(low, x, y, hours);
				const b = advectedTemperature(low, x + 25, y, hours);
				const c = advectedTemperature(low, x, y + 25, hours);
				g = Math.max(g, Math.hypot(b - a, c - a) / 25);
			}
		return g;
	};
	expect(maxGradient(36)).toBeGreaterThan(2 * maxGradient(0));
	// No systems: nothing moves.
	expect(advectedTemperature([], 0, 300, 48)).toBeCloseTo(advectedTemperature([], 0, 300, 0), 9);
});

test('hurricanes: warmer seas allow stronger storms; none over cool water or at the equator', () => {
	expect(maxIntensity(30)).toBeCloseTo(84, 0);
	expect(maxIntensity(28)).toBeGreaterThan(maxIntensity(27));
	expect(canForm(26, 15)).toBe(false);
	expect(canForm(28, 2)).toBe(false);
	expect(canForm(28, 15)).toBe(true);
	expect(category(32)).toBe(0);
	expect(category(33)).toBe(1);
	expect(category(75)).toBe(5);
	expect(stormIntensity(29, 15, 120)).toBeGreaterThan(70);
	expect(stormIntensity(25, 15, 48)).toBeLessThan(15);
	expect(category(stormIntensity(29, 15, 120))).toBeGreaterThanOrEqual(4);
});

test('hurricanes: a running storm decays over cool water and regrows over warm water', () => {
	// Moved over cool water at 70 m/s: one e-folding in a day, never below zero.
	expect(stormEvolve(70, 25, 15, 0)).toBeCloseTo(70, 9);
	expect(stormEvolve(70, 25, 15, 24)).toBeCloseTo(70 / Math.E, 6);
	expect(stormEvolve(70, 29, 2, 48)).toBeLessThan(10);
	// Over warm water it grows from its current wind towards the ceiling…
	expect(stormEvolve(20, 30, 15, 0)).toBeCloseTo(20, 9);
	expect(stormEvolve(20, 30, 15, 12)).toBeGreaterThan(20);
	expect(stormEvolve(20, 30, 15, 200)).toBeCloseTo(maxIntensity(30), 3);
	// …and eases down to a lower ceiling without overshooting it.
	const v = stormEvolve(80, 27, 15, 48);
	expect(v).toBeLessThan(80);
	expect(v).toBeGreaterThan(maxIntensity(27));
	// The seed storm is the same curve as before.
	expect(stormIntensity(29, 15, 30)).toBeCloseTo(stormEvolve(15, 29, 15, 30), 9);
	// The integral matches a numerical one, growing and decaying.
	for (const [v0, sst, lat] of [
		[15, 29, 15],
		[80, 27, 15],
		[60, 24, 15]
	]) {
		let num = 0;
		const n = 4000;
		const h = 60;
		for (let k = 0; k < n; k++) num += stormEvolve(v0, sst, lat, ((k + 0.5) * h) / n) * (h / n);
		expect(stormWindIntegral(v0, sst, lat, h)).toBeCloseTo(num, 2);
	}
});
