// Checks the exoplanet model behind the explainer against known results: the
// Solar System seen from afar, and real planets' measured transit depths and
// wobbles from the NASA Exoplanet Archive. Runs in Node.
import { expect, test } from '@playwright/test';
import { BY_METHOD, TOTAL } from '../src/routes/exoplanets/archive';
import {
	A_JUPITER,
	JUPITER_MASSES,
	JUPITER_RADII,
	STARS,
	SUN,
	archivePlanet,
	archiveStar,
	blocked,
	density,
	dopplerShift,
	flux,
	habitableZone,
	insolation,
	interceptedFraction,
	massFromWobble,
	maxTiltDeg,
	modelPlanet,
	orbitAU,
	periodDays,
	radialVelocity,
	radiusFromDepth,
	rvAmplitude,
	starOrbitAU,
	transitChance,
	transitDepth,
	transitHours,
	transits,
	zoneOf,
	type Planet
} from '../src/routes/exoplanets/exoplanets';

const earth: Planet = { radius: 1, mass: 1, a: 1, incl: 90 };
const jupiter: Planet = { radius: JUPITER_RADII, mass: JUPITER_MASSES, a: A_JUPITER, incl: 90 };

test("Kepler's third law: 1 AU round the Sun is a year, Jupiter's orbit 11.9 years", () => {
	expect(periodDays(SUN, earth)).toBeCloseTo(365.25, 0);
	expect(periodDays(SUN, jupiter) / 365.25).toBeCloseTo(11.86, 1);
	// A real planet: Kepler-22 b's 289.9-day year round its 0.857-solar-mass star puts it at 0.81 AU.
	const k22 = archivePlanet('Kepler-22 b');
	expect(orbitAU(k22.period, k22.star.mass)).toBeCloseTo(k22.a, 2);
});

test('a transit dims the star by (Rp/R★)²: 84 ppm for the Earth, 1% for Jupiter', () => {
	expect(transitDepth(SUN, earth) * 1e6).toBeCloseTo(84, 0);
	expect(transitDepth(SUN, jupiter) * 100).toBeCloseTo(1.06, 2);
	// Mid-transit the light really is down by that much, and far from transit it is not.
	expect(1 - flux(SUN, earth, 0)).toBeCloseTo(transitDepth(SUN, earth), 9);
	expect(flux(SUN, earth, 0.25)).toBe(1);
	expect(flux(SUN, earth, 0.5)).toBe(1); // behind the star: nothing blocked
});

test('the overlap of two discs: none apart, k² inside, half at the edge for a tiny planet', () => {
	expect(blocked(1.2, 0.1)).toBe(0);
	expect(blocked(0.3, 0.1)).toBeCloseTo(0.01, 12);
	// A small planet centred on the edge covers (almost exactly) half its own area.
	expect(blocked(1, 0.001) / 1e-6).toBeCloseTo(0.5, 3);
	// Ingress is continuous: no jump at first or second contact.
	expect(blocked(1.1 - 1e-9, 0.1)).toBeLessThan(1e-6);
	expect(blocked(0.9 + 1e-9, 0.1)).toBeCloseTo(0.01, 6);
});

test('real transits: the model reproduces measured depths from the archive radii', () => {
	for (const name of ['HD 209458 b', 'HD 189733 b', 'TRAPPIST-1 e']) {
		const p = archivePlanet(name);
		const depth = transitDepth(archiveStar(p.star), modelPlanet(p)) * 100;
		expect(p.depthPercent).not.toBeNull();
		// Measured depths include limb darkening, which the model leaves out: within 15%.
		expect(Math.abs(depth / p.depthPercent! - 1)).toBeLessThan(0.15);
	}
});

test('an Earth transit lasts 13 hours; one random tilt in 200 shows it', () => {
	expect(transitHours(SUN, earth)).toBeCloseTo(13.1, 0);
	expect(transitChance(SUN, earth) * 100).toBeCloseTo(0.47, 2);
	// Tilted by more than 0.27° from edge-on, the Earth misses the Sun's disc.
	expect(maxTiltDeg(SUN, earth)).toBeCloseTo(0.27, 2);
	expect(transits(SUN, { ...earth, incl: 90 - 0.26 })).toBe(true);
	expect(transits(SUN, { ...earth, incl: 90 - 0.28 })).toBe(false);
	expect(transitHours(SUN, { ...earth, incl: 89 })).toBe(0);
	// A hot Jupiter at 0.05 AU transits for one random tilt in 10.
	expect(1 / transitChance(SUN, { ...jupiter, a: 0.05 })).toBeCloseTo(9.7, 0);
});

test('the Sun wobbles at 12.5 m/s because of Jupiter and 9 cm/s because of the Earth', () => {
	expect(rvAmplitude(SUN, jupiter)).toBeCloseTo(12.5, 1);
	expect(rvAmplitude(SUN, earth) * 100).toBeCloseTo(8.9, 1);
	// The centre of mass of the Sun and Jupiter lies just outside the Sun's surface.
	expect((starOrbitAU(SUN, jupiter) * 1.495978707e11) / 6.957e8).toBeCloseTo(1.07, 2);
	// Face-on, the star still moves but none of it is towards us.
	expect(rvAmplitude(SUN, { ...jupiter, incl: 0 })).toBe(0);
	expect(rvAmplitude(SUN, { ...jupiter, incl: 30 })).toBeCloseTo(12.5 / 2, 1);
});

test('real wobbles: the model reproduces the measured amplitudes from the archive masses', () => {
	for (const name of ['51 Peg b', 'HD 209458 b', 'HD 189733 b', 'Proxima Cen b']) {
		const p = archivePlanet(name);
		// Proxima b's archive mass is the minimum mass, M sin i: seen edge-on it gives K directly.
		const incl = p.massKind === 'Msini' ? 90 : p.incl!;
		const K = rvAmplitude(archiveStar(p.star), { ...modelPlanet(p, incl), a: p.a });
		expect(p.rvAmp).not.toBeNull();
		expect(Math.abs(K / p.rvAmp! - 1)).toBeLessThan(0.03);
	}
});

test('the velocity curve: zero at mid-transit, then the star comes towards us (blueshift)', () => {
	const hot: Planet = { ...jupiter, a: 0.05 };
	expect(radialVelocity(SUN, hot, 0)).toBeCloseTo(0, 9);
	expect(radialVelocity(SUN, hot, 0.25)).toBeCloseTo(-rvAmplitude(SUN, hot), 9);
	expect(radialVelocity(SUN, hot, 0.75)).toBeCloseTo(rvAmplitude(SUN, hot), 9);
	// 12.5 m/s shifts the hydrogen-alpha line by 27 millionths of a nanometre.
	expect(dopplerShift(656.281, 12.5) * 1e6).toBeCloseTo(27.4, 1);
});

test('reading the planet back: depth gives the size, wobble and period give the mass', () => {
	const p = archivePlanet('HD 209458 b');
	const st = archiveStar(p.star);
	const pl = modelPlanet(p);
	const depth = transitDepth(st, pl);
	expect(radiusFromDepth(depth, st.radius)).toBeCloseTo(p.radius, 6);
	const K = rvAmplitude(st, pl);
	const P = periodDays(st, pl);
	const sinI = Math.sin((pl.incl * Math.PI) / 180);
	expect(massFromWobble(K, P, st.mass, sinI)).toBeCloseTo(p.mass, 3);
	// Without the transit only the minimum mass is known: a little less.
	expect(massFromWobble(K, P, st.mass)).toBeLessThan(p.mass);
	// From the archive's own measured K: 51 Peg b is at least 150 Earth masses.
	const peg = archivePlanet('51 Peg b');
	expect(massFromWobble(peg.rvAmp!, peg.period, peg.star.mass)).toBeCloseTo(148, -1);
});

test('density tells rock from gas: Earth 5.5 g/cm³, Jupiter 1.2, an inflated hot Jupiter less', () => {
	expect(density(1, 1)).toBeCloseTo(5.5, 1);
	// Jupiter: 1.24 with its equatorial radius (1.33 with its mean radius: its spin flattens it).
	expect(density(JUPITER_RADII, JUPITER_MASSES)).toBeCloseTo(1.24, 2);
	const p = archivePlanet('HD 209458 b');
	expect(density(p.radius, p.mass)).toBeLessThan(0.5);
});

test("the Sun's habitable zone runs from 0.95 to 1.68 AU (Kopparapu et al. 2014)", () => {
	const hz = habitableZone(SUN);
	expect(hz.inner).toBeCloseTo(0.95, 2);
	expect(hz.outer).toBeCloseTo(1.68, 2);
	expect(hz.optimisticInner).toBeCloseTo(0.75, 2);
	expect(hz.optimisticOuter).toBeCloseTo(1.77, 2);
	expect(zoneOf(insolation(SUN, earth), SUN.teff)).toBe('habitable zone');
	expect(zoneOf(insolation(SUN, { ...earth, a: 0.723 }), SUN.teff)).toBe('too hot'); // Venus
	expect(zoneOf(insolation(SUN, { ...earth, a: 1.524 }), SUN.teff)).toBe('habitable zone'); // Mars
	// A red dwarf's zone is tiny and close in: Proxima b, at 0.049 AU, lies inside it.
	const prox = STARS.proxima.star;
	expect(habitableZone(prox).outer).toBeLessThan(0.1);
	expect(zoneOf(archivePlanet('Proxima Cen b').insolation!, prox.teff)).toBe('habitable zone');
});

test('the Earth intercepts less than a billionth of the Sun’s light', () => {
	expect(interceptedFraction(earth)).toBeCloseTo(4.5e-10, 11);
	expect(interceptedFraction(jupiter)).toBeCloseTo(2.1e-9, 10);
});

test('the census: most known planets were found by transits, then by the wobble', () => {
	expect(TOTAL).toBeGreaterThan(6000);
	const seen = BY_METHOD['Imaging'];
	expect(seen / TOTAL).toBeLessThan(0.02);
	expect((BY_METHOD['Transit'] + BY_METHOD['Radial Velocity']) / TOTAL).toBeGreaterThan(0.9);
});
