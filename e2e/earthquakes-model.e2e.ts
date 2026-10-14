// Checks the models behind the earthquakes explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	EARTH_R,
	arrivalOf,
	arrivals,
	pkpRange,
	rayAt,
	reach,
	sMinusP,
	shadowStart,
	speed,
	surfaceDistance
} from '../src/routes/earthquakes/earth';
import { ORIGIN, bestFit, distanceFor, stations } from '../src/routes/earthquakes/locate';
import {
	TNT_TONNE,
	amplitudeRatio,
	bValue,
	catalogueEnergy,
	energyShare,
	energy,
	energyRatio,
	magnitudeOf,
	moment,
	perYearAtLeast
} from '../src/routes/earthquakes/magnitude';

// The published ak135 travel-time tables for an earthquake at the surface (Kennett 1997,
// "AK135 travel time tables", http://rses.anu.edu.au/seismology/ak135/intro.html, pages 2 and 4
// of the body-wave tables and page 3 of the core phases). Seconds.
const TABLE = [
	{ kind: 'P', dist: 30, time: 6 * 60 + 10.27 },
	{ kind: 'S', dist: 30, time: 11 * 60 + 9.14 },
	{ kind: 'P', dist: 50, time: 8 * 60 + 56.0 },
	{ kind: 'S', dist: 50, time: 16 * 60 + 7.73 },
	{ kind: 'P', dist: 90, time: 13 * 60 + 1.4 },
	{ kind: 'S', dist: 90, time: 23 * 60 + 55.44 },
	{ kind: 'PKIKP', dist: 150, time: 19 * 60 + 47.48 },
	{ kind: 'PKIKP', dist: 180, time: 20 * 60 + 12.53 }
] as const;

test('rays traced through ak135 arrive when the published ak135 tables say', () => {
	for (const row of TABLE) {
		const t = arrivalOf(row.kind, row.dist, 0);
		expect(t, `${row.kind} at ${row.dist}°`).not.toBeNull();
		expect(Math.abs(t! - row.time), `${row.kind} at ${row.dist}°`).toBeLessThan(0.5);
	}
});

test('the model: S waves are slower than P, and there are none in the liquid outer core', () => {
	expect(speed('P', 10)).toBeCloseTo(5.8, 6);
	expect(speed('S', 10)).toBeCloseTo(3.46, 6);
	expect(speed('S', 2891.5)).toBeGreaterThan(7); // bottom of the mantle
	expect(speed('S', 2891.5, true)).toBe(0); // top of the outer core
	expect(speed('P', 2891.5, true)).toBeCloseTo(8.0, 6); // P slows down sharply into the core
	expect(speed('S', 5500)).toBeGreaterThan(3); // the solid inner core carries S again
	for (const d of [100, 1000, 2500]) expect(speed('P', d) / speed('S', d)).toBeGreaterThan(1.6);
});

test('the shadow zones come out of the rays: no direct P or S beyond about 100°', () => {
	for (const wave of ['P', 'S'] as const) {
		expect(shadowStart(wave, 0)).toBeGreaterThan(98);
		expect(shadowStart(wave, 0)).toBeLessThan(102);
	}
	expect(arrivals(120, 0).some((a) => a.kind === 'S')).toBe(false);
	// Waves through the outer core come back up only beyond about 143°.
	const [near] = pkpRange(0);
	expect(near).toBeGreaterThan(141);
	expect(near).toBeLessThan(146);
	// Between them: nothing, except the waves that went through or bounced off the inner core
	// (Lehmann 1936), which reach from about 115°.
	expect(arrivals(105, 0)).toEqual([]);
	expect(arrivals(125, 0).map((a) => a.kind)).toEqual(['PKIKP', 'PKiKP']);
	const inner = reach('PKIKP', 0);
	expect(inner[0][0]).toBeGreaterThan(113);
	expect(inner[0][0]).toBeLessThan(117);
	// The same edges, 143° and 115°, for the earthquake drawn on the page, 10 km down.
	expect(Math.round(pkpRange(10)[0])).toBe(143);
	expect(Math.round(reach('PKIKP', 10)[0][0])).toBe(115);
	// If the core were liquid all the way down, the whole zone would stay silent.
	for (const d of [105, 115, 125, 135, 140]) expect(arrivals(d, 0, 'liquid-core')).toEqual([]);
	expect(arrivals(150, 0, 'liquid-core').length).toBeGreaterThan(0);
});

test('a planet of the same rock all through: straight rays, everywhere reached, much later', () => {
	for (const d of [30, 90, 120, 179]) {
		const chord = 2 * EARTH_R * Math.sin((d * Math.PI) / 360);
		expect(arrivalOf('P', d, 0, 'uniform')).toBeCloseTo(chord / 5.8, 3);
		expect(arrivalOf('S', d, 0, 'uniform')).toBeCloseTo(chord / 3.46, 3);
	}
	// The real Earth gets the P wave to 90° in half the time: deep rock is faster.
	expect(arrivalOf('P', 90, 0)! / arrivalOf('P', 90, 0, 'uniform')!).toBeLessThan(0.55);
	// For the earthquake drawn (10 km down): 13 minutes in the real Earth, 26 in the uniform one.
	expect(arrivalOf('P', 90, 10)! / 60).toBeCloseTo(13, 0);
	expect(arrivalOf('P', 90, 10, 'uniform')! / 60).toBeCloseTo(26, 0);
});

test('rays curve back up: the path to 30° dives far deeper than the straight line', () => {
	// Find the P ray that lands at 30° and compare its deepest point with the chord's.
	let lo = 0.1;
	let hi = 1.5;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		const d = surfaceDistance(rayAt('P', mid, 0)!.angle);
		if (d > 30) lo = mid;
		else hi = mid;
	}
	const ray = rayAt('P', lo, 0)!;
	const chordDepth = EARTH_R * (1 - Math.cos((15 * Math.PI) / 180));
	expect(EARTH_R - ray.deepest).toBeGreaterThan(2.5 * chordDepth);
	expect(ray.kind).toBe('P');
});

test('S − P grows with distance, and turns back into the distance', () => {
	let last = 0;
	for (let d = 2; d <= 95; d += 3) {
		const lag = sMinusP(d, ORIGIN.depth)!;
		expect(lag).toBeGreaterThan(last);
		last = lag;
		expect(distanceFor(lag)).toBeCloseTo(d, 2);
	}
	// About 25 s at 2°, the nearest the seismometer goes.
	expect(Math.round(sMinusP(2, 10)!)).toBe(25);
	// 6½ minutes of gap: about 44°, 4,900 km.
	expect(distanceFor(390)).toBeCloseTo(44, 0);
	expect(Math.round((distanceFor(390) * Math.PI * EARTH_R) / 180 / 100) * 100).toBe(4900);
	// In an Earth of the same rock all through, S falls behind P much faster: the same gap would
	// mean a much shorter distance (556 s at 44° there, against 392 s in ak135).
	const uniformLag = (d: number) =>
		arrivalOf('S', d, ORIGIN.depth, 'uniform')! - arrivalOf('P', d, ORIGIN.depth, 'uniform')!;
	expect(uniformLag(44) / sMinusP(44, ORIGIN.depth)!).toBeGreaterThan(1.3);
	// About 8 minutes at 60°.
	expect(sMinusP(60, 0)! / 60).toBeGreaterThan(7.8);
	expect(sMinusP(60, 0)! / 60).toBeLessThan(8.6);
});

test('three S − P times put the Gorkha epicentre back where the USGS located it', () => {
	const fit = bestFit(
		stations.map((s) => s.rec),
		stations.map((s) => distanceFor(s.lag))
	);
	const km = (Math.PI / 180) * EARTH_R;
	const coslat = Math.cos((ORIGIN.lat * Math.PI) / 180);
	expect(Math.hypot(fit.lat - ORIGIN.lat, (fit.lon - ORIGIN.lon) * coslat) * km).toBeLessThan(15);
	// The same from S − P read by eye off the real recordings (S onsets at about 884, 716 and
	// 784 s on the side-to-side traces, less the automatic P picks): within 100 km.
	const read = [395, 318, 347];
	const byEye = bestFit(
		stations.map((s) => s.rec),
		read.map(distanceFor)
	);
	const coslat2 = Math.cos((ORIGIN.lat * Math.PI) / 180);
	expect(Math.hypot(byEye.lat - ORIGIN.lat, (byEye.lon - ORIGIN.lon) * coslat2) * km).toBeLessThan(
		100
	);
	for (const [i, s] of stations.entries()) expect(Math.abs(read[i] - s.lag)).toBeLessThan(15);
	// And the real seismograms agree with the model: the P waves picked on them arrive within
	// a few seconds of the ak135 times.
	for (const s of stations) expect(Math.abs(s.rec.pPick - s.pModel)).toBeLessThan(5);
	// At Ankara, the step's example, 2 s after ak135.
	const ankara = stations.find((s) => s.rec.sta === 'ANTO')!;
	expect(Math.round(ankara.rec.pPick - ankara.pModel)).toBe(2);
});

test('magnitude: ten times the wiggles and about 32 times the energy per step', () => {
	expect(amplitudeRatio(6, 5)).toBeCloseTo(10, 9);
	expect(energyRatio(6, 5)).toBeCloseTo(31.62, 2);
	expect(energyRatio(7, 5)).toBeCloseTo(1000, 6);
	// Hanks & Kanamori: Mw 7.8 is a moment of about 6 × 10²⁰ N·m, and the inverse holds.
	expect(moment(7.8)).toBeGreaterThan(5e20);
	expect(moment(7.8)).toBeLessThan(7e20);
	expect(magnitudeOf(moment(9.1))).toBeCloseTo(9.1, 9);
	// Gorkha released about as much energy in seismic waves as 7.6 million tonnes of TNT;
	// Tōhoku (9.1) about 90 times more.
	expect(energy(7.8) / TNT_TONNE / 1e6).toBeCloseTo(7.6, 1);
	expect(energyRatio(9.1, 7.8)).toBeCloseTo(89, 0);
});

test('Gutenberg–Richter: each step up in magnitude is about ten times rarer', () => {
	expect(perYearAtLeast(7)).toBeCloseTo(13.7, 1);
	// About 130 a year of magnitude 6 or more, fewer than one of 8 or more; 4,516 in all.
	expect(Math.round(perYearAtLeast(6) / 10) * 10).toBe(130);
	expect(perYearAtLeast(8)).toBeLessThan(1);
	expect(Math.round(perYearAtLeast(5.5) * 10)).toBe(4516);
	expect(perYearAtLeast(6) / perYearAtLeast(7)).toBeGreaterThan(8);
	expect(perYearAtLeast(6) / perYearAtLeast(7)).toBeLessThan(12);
	expect(bValue()).toBeGreaterThan(0.9);
	expect(bValue()).toBeLessThan(1.1);
	// The few biggest dominate the energy: 3% of the earthquakes (M ≥ 7) release 84% of it, and
	// one magnitude 9 nearly as much as the whole decade.
	expect(perYearAtLeast(7) * 10).toBe(137);
	expect(energyShare(7)).toBeCloseTo(0.84, 2);
	expect(energy(9) / catalogueEnergy()).toBeGreaterThan(0.8);
	expect(energy(9) / catalogueEnergy()).toBeLessThan(1);
});
