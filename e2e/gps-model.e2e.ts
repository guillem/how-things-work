// Checks the GPS model behind the explainer: satellite orbits from the real almanac, position
// fixes by least squares, dilution of precision and the relativistic clock rates, against
// the GPS specification (IS-GPS-200) and N. Ashby, Living Reviews in Relativity 6, 1 (2003).
// Runs in Node.
import { expect, test } from '@playwright/test';
import { ALMANAC, ALMANAC_DATE, ALMANAC_WEEK } from '../src/routes/gps/almanac';
import { PLACES } from '../src/routes/gps/places';
import {
	A_GPS,
	C,
	MU,
	PHI0_C2,
	R_EARTH,
	DAY,
	clockRate,
	constellation,
	crossoverRadius,
	dop,
	eccentricityTerm,
	geodeticToEcef,
	microsPerDay,
	norm,
	period,
	pseudoranges,
	scenario,
	solve,
	sub,
	visible
} from '../src/routes/gps/model';

const PALMA = [39.57, 2.65] as const;

test('the almanac is current: GPS week 2440 (after two rollovers of the 10-bit count), 32 healthy satellites', () => {
	expect(ALMANAC_WEEK).toBe(2440);
	expect(ALMANAC_DATE.slice(0, 10)).toBe('2026-10-16');
	expect(ALMANAC.length).toBe(32);
});

test('GPS orbits: 26 560 km from the centre (20 200 km up), 55°, once every 11 h 58 min', () => {
	const sats = constellation(0);
	for (const s of sats) {
		const r = norm(s.ecef);
		expect(r / 1e3).toBeGreaterThan(25_900);
		expect(r / 1e3).toBeLessThan(27_200);
	}
	const a = ALMANAC.reduce((s, x) => s + x.sqrtA ** 2, 0) / ALMANAC.length;
	expect(a / 1e3).toBeCloseTo(26_560, -2);
	expect((a - R_EARTH) / 1e3).toBeCloseTo(20_200, -2);
	for (const s of ALMANAC) expect((s.i0 * 180) / Math.PI).toBeGreaterThan(53);
	for (const s of ALMANAC) expect((s.i0 * 180) / Math.PI).toBeLessThan(58);
	// Half a sidereal day (23 h 56 min): the same sky every day, 4 minutes earlier.
	expect(period(A_GPS) / 60).toBeCloseTo(718, 0);
	// Speed in orbit: about 3.9 km/s.
	expect(Math.sqrt(MU / A_GPS) / 1e3).toBeCloseTo(3.87, 2);
});

test('the satellites share six orbital planes, about 60° apart', () => {
	const nodes = ALMANAC.map((s) => ((((s.omega0 * 180) / Math.PI) % 360) + 360) % 360).sort(
		(x, y) => x - y
	);
	// Gaps between neighbouring nodes, round the circle: six wide ones separate six planes.
	const gaps = nodes.map((n, i) => (i ? n - nodes[i - 1] : n + 360 - nodes[nodes.length - 1]));
	expect(gaps.filter((g) => g > 30).length).toBe(6);
	expect(Math.max(...gaps.filter((g) => g <= 30))).toBeLessThan(10);
});

test('a satellite flies round the Earth twice a day: back where it was after one period', () => {
	const s = ALMANAC[0];
	const T = period(s.sqrtA ** 2);
	const a = constellation(0)[0].eci;
	const b = constellation(T)[0].eci;
	// The orbit's plane turns slowly (precession), so only within a few km.
	expect(norm(sub(a, b)) / 1e3).toBeLessThan(10);
});

test('from the ground, 8 to 12 satellites are usually above the horizon (10° mask)', () => {
	for (const tk of [0, 3 * 3600, 7 * 3600, 15 * 3600]) {
		for (const [lat, lon] of [PALMA, [51.5, -0.13], [-33.87, 151.21], [0, -78]] as const) {
			const n = visible(constellation(tk), lat, lon).length;
			expect(n).toBeGreaterThanOrEqual(6);
			expect(n).toBeLessThanOrEqual(13);
		}
	}
	expect(visible(constellation(0), ...PALMA).length).toBe(8);
	// Over the whole Earth and a whole day: usually 8 to 12, rarely fewer than 7 (but at
	// times only 6, as at 25° S, 110° W at the almanac's epoch).
	const counts: number[] = [];
	for (let lat = -80; lat <= 80; lat += 10)
		for (let lon = -180; lon < 180; lon += 30)
			for (let tk = 0; tk < DAY; tk += 3 * 3600)
				counts.push(visible(constellation(tk), lat, lon).length);
	expect(Math.min(...counts)).toBeGreaterThanOrEqual(6);
	expect(counts.filter((n) => n < 7).length / counts.length).toBeLessThan(0.01);
	const usual = counts.filter((n) => n >= 8 && n <= 12).length / counts.length;
	expect(usual).toBeGreaterThan(0.9);
	expect(visible(constellation(0), -25, -110).length).toBe(6);
});

test('signals take 67 ms to come down from overhead, up to 86 ms from the horizon', () => {
	const up = A_GPS - R_EARTH;
	expect((up / C) * 1e3).toBeCloseTo(67, 0);
	expect((Math.sqrt(A_GPS ** 2 - R_EARTH ** 2) / C) * 1e3).toBeCloseTo(86, 0);
	// While the signal comes down, the satellite moves about 300 m (260 to 330 m).
	const v = Math.sqrt(MU / A_GPS);
	expect(v * (up / C)).toBeCloseTo(260, -1);
	expect((v * Math.sqrt(A_GPS ** 2 - R_EARTH ** 2)) / C).toBeCloseTo(330, -1);
});

test('ranges with a clock error: least squares from the centre of the Earth recovers position and clock', () => {
	const sats = visible(constellation(0), ...PALMA).map((s) => s.ecef);
	const rx = geodeticToEcef(...PALMA);
	const clock = 1e-3 * C; // the receiver's clock is a millisecond fast: 300 km on every range
	const fix = solve(sats, pseudoranges(sats, rx, clock))!;
	expect(fix.converged).toBe(true);
	expect(norm(sub(fix.pos, rx))).toBeLessThan(1e-3);
	expect(fix.clock / C).toBeCloseTo(1e-3, 12);
	// With only four satellites it still works: four unknowns, four ranges.
	const four = solve(sats.slice(0, 4), pseudoranges(sats.slice(0, 4), rx, clock))!;
	expect(norm(sub(four.pos, rx))).toBeLessThan(1e-3);
	// With three it cannot.
	expect(solve(sats.slice(0, 3), pseudoranges(sats.slice(0, 3), rx, clock))).toBeNull();
});

test('a timing error is a distance error: 1 ms is 300 km, 1 µs is 300 m, 1 ns is 30 cm', () => {
	expect((1e-3 * C) / 1e3).toBeCloseTo(300, 0);
	expect(1e-6 * C).toBeCloseTo(300, 0);
	expect(1e-9 * C).toBeCloseTo(0.3, 2);
});

test('on a flat map: two unknowns plus the clock need three satellites', () => {
	const sats = [
		[2.2e6, 1.8e6],
		[11.2e6, 2.4e6],
		[6.6e6, 10.8e6]
	];
	const rx = [6.6e6, 6e6];
	const clock = -4e-3 * C;
	const r = pseudoranges(sats, rx, clock);
	const centre = [6.67e6, 5e6];
	// Trusting its clock, the receiver sees three circles that do not meet: a best guess, off.
	const trusting = solve(sats, r, { solveClock: false, start: centre })!;
	expect(norm(sub(trusting.pos, rx)) / 1e3).toBeGreaterThan(100);
	expect(Math.max(...trusting.residuals.map(Math.abs)) / 1e3).toBeGreaterThan(100);
	// Solving for the clock as well, all three circles meet at the right place.
	const fix = solve(sats, r, { start: centre })!;
	expect(norm(sub(fix.pos, rx))).toBeLessThan(1e-3);
	expect(fix.clock / C).toBeCloseTo(-4e-3, 12);
	expect(solve(sats.slice(0, 2), r.slice(0, 2), { start: centre })).toBeNull();
});

test('GDOP: satellites spread over the sky give a small dilution; bunched together, a large one', () => {
	const spread = dop([
		{ elevation: 90, azimuth: 0 },
		{ elevation: 10, azimuth: 0 },
		{ elevation: 10, azimuth: 120 },
		{ elevation: 10, azimuth: 240 }
	])!;
	const bunched = dop([
		{ elevation: 60, azimuth: 30 },
		{ elevation: 70, azimuth: 50 },
		{ elevation: 55, azimuth: 60 },
		{ elevation: 65, azimuth: 80 }
	])!;
	expect(spread.gdop).toBeLessThan(2);
	expect(bunched.gdop).toBeGreaterThan(10);
	// The real sky over Palma at the almanac's epoch.
	const sky = dop(visible(constellation(0), ...PALMA))!;
	expect(sky.gdop).toBeGreaterThan(1.5);
	expect(sky.gdop).toBeLessThan(3);
	// The position spread uses PDOP, which leaves out the clock: one satellite overhead and
	// three on the horizon give PDOP √(8/3) ≈ 1.633 against GDOP √3 ≈ 1.732.
	const best = dop([
		{ elevation: 90, azimuth: 0 },
		{ elevation: 0, azimuth: 0 },
		{ elevation: 0, azimuth: 120 },
		{ elevation: 0, azimuth: 240 }
	])!;
	expect(best.pdop).toBeCloseTo(Math.sqrt(8 / 3), 6);
	expect(best.gdop).toBeCloseTo(Math.sqrt(3), 6);
	// Height is less certain than the horizontal position: every satellite is above you.
	expect(sky.vdop).toBeGreaterThan(sky.hdop);
});

test('relativity: the ground clock rate matches Ashby’s Φ₀/c² = −6.96927 × 10⁻¹⁰', () => {
	expect(PHI0_C2 / 1e-10).toBeCloseTo(-6.96927, 3);
});

test('GPS clocks gain 45.8 µs a day from weaker gravity and lose 7.2 from their speed: net 38.6', () => {
	const r = microsPerDay(A_GPS);
	expect(r.gravity).toBeCloseTo(45.8, 1);
	expect(r.speed).toBeCloseTo(-7.2, 1);
	expect(r.net).toBeCloseTo(38.6, 1);
	// Ashby's fractional offset, built into the satellite clocks before launch.
	expect(clockRate(A_GPS).net / 1e-10).toBeCloseTo(4.4647, 3);
	// 10.23 MHz on the ground means 10.229 999 995 43 MHz set in the factory.
	expect(10.23e6 * (1 - clockRate(A_GPS).net)).toBeCloseTo(10_229_999.995_43, 4);
	// Uncorrected, about 11.6 km of range a day.
	expect((r.net * 1e-6 * C) / 1e3).toBeCloseTo(11.6, 1);
});

test('the two effects cancel for an orbit 1.5 Earth radii from the centre (about 3 200 km up)', () => {
	expect(crossoverRadius / R_EARTH).toBeCloseTo(1.5, 1);
	expect((crossoverRadius - R_EARTH) / 1e3).toBeCloseTo(3170, -1);
	expect(microsPerDay(crossoverRadius).net).toBeCloseTo(0, 9);
	// Below it the speed wins and orbiting clocks run slow; above it gravity wins.
	expect(microsPerDay(R_EARTH + 400e3).net).toBeLessThan(-20);
	expect(microsPerDay(42_164e3).net).toBeGreaterThan(40);
});

test('without the rate correction, a receiver that solves for its clock stays put, its time off by 38.6 µs a day', () => {
	for (const tk of [0, 5 * 3600]) {
		const s = scenario(...PALMA, tk, { days: 1 });
		expect(norm(s.solvedErr!)).toBeLessThan(1e-3);
		expect((s.solved!.clock / C) * 1e6).toBeCloseTo(-38.6, 1);
		// A receiver that trusts its own (perfect) clock is thrown off by kilometres, mostly up.
		const [e, n, u] = s.trustingErr!;
		expect(norm(s.trustingErr!) / 1e3).toBeGreaterThan(10);
		expect(Math.abs(u)).toBeGreaterThan(Math.hypot(e, n));
	}
	// After one day, 16 to 20 km for every place on the page.
	for (const p of PLACES) {
		const err = norm(scenario(p.lat, p.lon, 0, { days: 1 }).trustingErr!) / 1e3;
		expect(err).toBeGreaterThan(16);
		expect(err).toBeLessThan(20);
	}
	// It grows day by day.
	const err = (days: number) => norm(scenario(...PALMA, 0, { days }).trustingErr!) / 1e3;
	expect(err(2)).toBeCloseTo(2 * err(1), 0);
});

test('the eccentricity term differs from satellite to satellite: up to 48 ns (14 m), and it is not absorbed', () => {
	const worst = Math.max(...ALMANAC.map((s) => Math.abs(eccentricityTerm(s, Math.PI / 2))));
	expect(worst * 1e9).toBeCloseTo(48, 0);
	expect(worst * C).toBeCloseTo(14.4, 0);
	const s = scenario(...PALMA, 0, { days: 0, eccentricity: true });
	expect(norm(s.solvedErr!)).toBeGreaterThan(0.5);
	expect(norm(s.solvedErr!)).toBeLessThan(30);
});
