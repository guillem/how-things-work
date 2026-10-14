// Checks the rocket model behind the explainer against known results: the rocket equation,
// Apollo 11's Saturn V from its flight evaluation report, Hohmann transfers, real Mars launch
// windows and a flyby of Jupiter. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	atmosphere,
	deltaV,
	designRocket,
	flyBest,
	massRatio,
	propellantShare,
	saturnV,
	singleStageLimit,
	SPIN
} from '../src/routes/rockets/rockets';
import {
	at,
	daysFromDate,
	flyby,
	hohmann,
	J2000,
	JUPITER,
	lambert,
	marsHohmann,
	marsTrip,
	MU_EARTH,
	MU_SUN,
	R_GEO,
	R_LEO,
	conic,
	twoBurns
} from '../src/routes/rockets/space';
import { AS506_INSERTION } from '../src/routes/rockets/vehicles';

const DAY = 86400;

test('rocket equation: each extra exhaust speed of Δv multiplies the starting mass by e', () => {
	expect(deltaV(3000, Math.E, 1)).toBeCloseTo(3000, 6);
	// 9.4 km/s to orbit with a 3 km/s exhaust: start 23 times heavier, 96% of it propellant.
	expect(massRatio(9400, 3000)).toBeCloseTo(23, 0);
	expect(propellantShare(9400, 3000)).toBeCloseTo(0.956, 3);
	// Twice the speed needs the square of the mass ratio.
	expect(massRatio(2 * 4000, 3000)).toBeCloseTo(massRatio(4000, 3000) ** 2, 9);
});

test('US Standard Atmosphere 1976: pressure halves about every 5.5 km near the ground', () => {
	expect(atmosphere(0).rho).toBeCloseTo(1.225, 3);
	expect(atmosphere(5500).p / atmosphere(0).p).toBeCloseTo(0.5, 1);
	// At 100 km, about two millionths of the sea-level density is left.
	expect(atmosphere(100e3).rho / atmosphere(0).rho).toBeGreaterThan(1e-7);
	expect(atmosphere(100e3).rho / atmosphere(0).rho).toBeLessThan(1e-6);
});

test("Apollo 11's Saturn V: the rocket equation on the report's masses gives about 9.4 km/s", () => {
	const [s1, s2, s3] = saturnV.stages;
	// S-IVB first burn: 4,202 N·s/kg × ln(166,571 / 135,182) ≈ 0.88 km/s.
	expect(deltaV(s3.veVac, s3.m0, s3.mf) / 1000).toBeCloseTo(0.88, 2);
	expect(deltaV(s2.veVac, s2.m0, s2.mf) / 1000).toBeCloseTo(4.62, 2);
	// The first stage in a vacuum would give 3.9 km/s; at sea level only 3.3.
	expect(deltaV(s1.veVac, s1.m0, s1.mf) / 1000).toBeCloseTo(3.9, 1);
	expect(deltaV(s1.veSea, s1.m0, s1.mf) / 1000).toBeCloseTo(3.26, 2);
});

test('the simulated Saturn V reaches the parking orbit Apollo 11 reached', () => {
	const f = flyBest(saturnV);
	expect(f.outcome).toBe('orbit');
	// Report: 7,793.1 m/s space-fixed at 191.1 km, 709 s after liftoff.
	expect(Math.abs(f.cutoff.v - AS506_INSERTION.speed)).toBeLessThan(0.01 * AS506_INSERTION.speed);
	expect(Math.abs(f.cutoff.h - AS506_INSERTION.altitude)).toBeLessThan(10e3);
	expect(Math.abs(f.cutoff.t - AS506_INSERTION.time)).toBeLessThan(0.15 * AS506_INSERTION.time);
	// The engines gave about 9 km/s; gravity, drag and steering took about 1.6 of it.
	const losses = f.gravity + f.drag + f.steering;
	expect(losses / 1000).toBeGreaterThan(1.2);
	expect(losses / 1000).toBeLessThan(2.2);
	// Speed at cutoff = what the engines gave − the losses + the Earth's spin.
	expect(Math.abs(f.burned - losses + SPIN - f.cutoff.v)).toBeLessThan(30);
	// The Earth's spin at Cape Canaveral: about 0.41 km/s.
	expect(SPIN / 1000).toBeCloseTo(0.41, 2);
});

test('one stage cannot reach orbit on kerosene however much it carries; two stages can', () => {
	// The tanks cap a single stage's mass ratio at 11: 3 km/s × ln 11 ≈ 7.2 km/s.
	expect(singleStageLimit(3000) / 1000).toBeCloseTo(7.19, 2);
	expect(flyBest(designRocket(1000e3, 3000, 1)).outcome).toBe('falls');
	expect(flyBest(designRocket(500e3, 3000, 2)).outcome).toBe('orbit');
	expect(flyBest(designRocket(500e3, 3000, 1)).outcome).toBe('falls');
});

test('more fuel never turns an orbit into a failure', () => {
	for (const [n, ve] of [
		[2, 3000],
		[3, 2500]
	]) {
		const verdicts = [];
		for (let fuel = 50e3; fuel <= 1000e3; fuel += 50e3)
			verdicts.push(flyBest(designRocket(fuel, ve, n)).outcome);
		const first = verdicts.indexOf('orbit');
		expect(first).toBeGreaterThan(0);
		expect(verdicts.slice(first).every((v) => v === 'orbit')).toBe(true);
	}
});

test('Hohmann transfer from a 200 km orbit to geostationary orbit: 2.45 + 1.48 km/s, 5.3 hours', () => {
	expect(R_GEO / 1000).toBeCloseTo(42164, 0);
	const h = hohmann(MU_EARTH, R_LEO, R_GEO);
	expect(h.dv1 / 1000).toBeCloseTo(2.45, 2);
	expect(h.dv2 / 1000).toBeCloseTo(1.48, 2);
	expect(h.time / 3600).toBeCloseTo(5.26, 2);
	// Flying those two burns ends on a round orbit at geostationary height...
	const b = twoBurns(h.dv1, h.dv2);
	expect(b.third?.e).toBeLessThan(1e-6);
	expect((b.third?.apo ?? 0) / 1000).toBeCloseTo(42164, 0);
	// ... which is slower than the orbit it started from, though both burns pushed forwards.
	expect(Math.sqrt(MU_EARTH / R_GEO)).toBeLessThan(Math.sqrt(MU_EARTH / R_LEO) / 2);
});

test('Hohmann trip to Mars: 259 days, Mars 44° ahead at departure, a window every 780 days', () => {
	const m = marsHohmann();
	expect(m.time / DAY).toBeCloseTo(259, 0);
	expect(m.dv1 / 1000).toBeCloseTo(2.94, 1);
	expect(m.dv2 / 1000).toBeCloseTo(2.65, 2);
	expect((m.lead * 180) / Math.PI).toBeCloseTo(44, 0);
	// The NASA Mars fact sheet's synodic period: 779.94 days.
	expect(m.synodic / DAY).toBeCloseTo(779.9, 0);
	// From a 200 km Earth orbit, the departure burn is about 3.6 km/s.
	expect(m.burnDepart / 1000).toBeCloseTo(3.61, 1);
});

test('Lambert solver: the 180° transfer is the Hohmann ellipse, and other transfers hit their target', () => {
	const m = marsHohmann();
	const sol = lambert(MU_SUN, { x: m.r1, y: 0 }, { x: -m.r2, y: 0 }, m.time);
	expect(sol).not.toBeNull();
	expect((Math.hypot(sol!.v1.x, sol!.v1.y) - Math.sqrt(MU_SUN / m.r1)) / 1000).toBeCloseTo(2.94, 1);
	for (const deg of [100, 179.9, 180.1, 250]) {
		const a = (deg * Math.PI) / 180;
		const r2 = { x: m.r2 * Math.cos(a), y: m.r2 * Math.sin(a) };
		const s = lambert(MU_SUN, { x: m.r1, y: 0 }, r2, 200 * DAY)!;
		const end = at(conic(MU_SUN, { x: m.r1, y: 0 }, s.v1), 200 * DAY).r;
		expect(Math.hypot(end.x - r2.x, end.y - r2.y)).toBeLessThan(1e3);
	}
});

test('real planet positions put the Mars launch windows 26 months apart, with one in late 2026', () => {
	const cheapest = (d: number) => {
		let best = Infinity;
		for (let f = 150; f <= 400; f += 10) best = Math.min(best, marsTrip(d, f)?.total ?? Infinity);
		return best;
	};
	const start = daysFromDate(2020, 1, 1);
	const totals: number[] = [];
	for (let d = start; d < start + 3700; d += 5) totals.push(cheapest(d));
	const minima: number[] = [];
	for (let i = 1; i < totals.length - 1; i++)
		if (totals[i] < totals[i - 1] && totals[i] <= totals[i + 1] && totals[i] < 7000)
			minima.push(start + i * 5);
	expect(minima.length).toBe(5);
	for (let i = 1; i < minima.length; i++)
		expect(Math.abs(minima[i] - minima[i - 1] - 780)).toBeLessThan(60);
	// Perseverance launched on 30 July 2020: within three weeks of the 2020 minimum.
	expect(Math.abs(minima[0] - daysFromDate(2020, 7, 30))).toBeLessThan(21);
	const in2026 = minima
		.map((d) => new Date(J2000 + d * DAY * 1000))
		.find((d) => d.getUTCFullYear() === 2026);
	expect(in2026?.getUTCMonth()).toBeGreaterThanOrEqual(9); // October or later
	// Between windows, the same trip costs several times more.
	expect(cheapest(daysFromDate(2021, 9, 1))).toBeGreaterThan(2 * cheapest(minima[0]));
});

test('a Jupiter flyby: the same speed relative to Jupiter in and out, but faster round the Sun', () => {
	const near = flyby(1.1 * JUPITER.radius);
	const far = flyby(30 * JUPITER.radius);
	expect(Math.hypot(near.infOut.x, near.infOut.y)).toBeCloseTo(near.vInf, 6);
	// Arriving from the Earth on a Hohmann ellipse: 7.4 km/s, Jupiter catching up at 5.6 km/s.
	expect(near.speedIn / 1000).toBeCloseTo(7.41, 1);
	expect(near.vInf / 1000).toBeCloseTo(5.6, 1);
	// A close pass turns the craft through ~157° and nearly doubles its speed, to just under
	// the 18.5 km/s that would carry it out of the Solar System.
	expect((near.turn * 180) / Math.PI).toBeGreaterThan(150);
	expect(near.speedOut / 1000).toBeCloseTo(18.4, 1);
	expect(near.speedOut).toBeLessThan(near.escape);
	expect(far.turn).toBeLessThan(near.turn);
	expect(far.gain).toBeLessThan(near.gain);
});
