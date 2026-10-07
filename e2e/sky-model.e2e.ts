// Checks the Sun–Earth–Moon geometry against known values. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	LUNAR_LIMIT,
	SOLAR_LIMIT,
	dailySunshine,
	dayLength,
	declination,
	eclipseAt,
	litFraction,
	nodeWindow,
	noonAltitude,
	phaseName,
	sunDistance,
	tidalRange
} from '../src/routes/sun-earth-moon/sky';

test('seasons: declination, day length and noon altitude', () => {
	expect(declination(90)).toBeCloseTo(23.44, 2); // June solstice
	expect(declination(0)).toBeCloseTo(0, 10);
	expect(dayLength(0, 23.44)).toBeCloseTo(12, 6); // equator: always 12 h
	expect(dayLength(40, 0)).toBeCloseTo(12, 6); // equinox: 12 h everywhere
	// Madrid (40.4° N) at the June solstice: about 15 h of geometric daylight.
	expect(dayLength(40.4, 23.44)).toBeGreaterThan(14.8);
	expect(dayLength(40.4, 23.44)).toBeLessThan(15.2);
	expect(dayLength(70, 23.44)).toBe(24); // midnight Sun
	expect(dayLength(70, -23.44)).toBe(0); // polar night
	expect(dayLength(66.56, 23.44)).toBeCloseTo(24, 0); // Arctic circle
	expect(noonAltitude(40, 23.44)).toBeCloseTo(73.44, 6);
	expect(noonAltitude(40, -23.44)).toBeCloseTo(26.56, 6);
	expect(dailySunshine(0, 0)).toBeCloseTo(1, 6);
	// No tilt: no seasons.
	expect(dayLength(50, declination(90, 0))).toBeCloseTo(12, 6);
});

test('distance: perihelion in January, and only a ~3% change', () => {
	expect(sunDistance(3)).toBeCloseTo(0.9833, 4);
	expect(sunDistance(3 + 365.2422 / 2)).toBeCloseTo(1.0167, 4);
	const ratio = (1.0167 / 0.9833) ** 2; // sunlight goes as 1/distance²
	expect(ratio).toBeGreaterThan(1.06);
	expect(ratio).toBeLessThan(1.08);
});

test('Moon: phases and eclipse limits', () => {
	expect(litFraction(0)).toBe(0);
	expect(litFraction(90)).toBeCloseTo(0.5, 10);
	expect(litFraction(180)).toBe(1);
	expect(phaseName(0)).toBe('new Moon');
	expect(phaseName(90)).toBe('first quarter');
	expect(phaseName(185)).toBe('full Moon');
	expect(phaseName(200)).toBe('waning gibbous');
	// Textbook limits: solar ~1.5°, lunar (umbral) ~1.0° from the ecliptic.
	expect(SOLAR_LIMIT).toBeGreaterThan(1.4);
	expect(SOLAR_LIMIT).toBeLessThan(1.6);
	expect(LUNAR_LIMIT).toBeGreaterThan(0.9);
	expect(LUNAR_LIMIT).toBeLessThan(1.05);
	// Eclipse windows around a node: ~16–18° solar, ~10–12° lunar.
	expect(nodeWindow(SOLAR_LIMIT)).toBeGreaterThan(15);
	expect(nodeWindow(SOLAR_LIMIT)).toBeLessThan(19);
	expect(nodeWindow(LUNAR_LIMIT)).toBeGreaterThan(9);
	expect(nodeWindow(LUNAR_LIMIT)).toBeLessThan(12.5);
	expect(eclipseAt(0, 3)).toBe('solar');
	expect(eclipseAt(180, 3)).toBe('lunar');
	expect(eclipseAt(0, 90)).toBe(null); // far from a node: the Moon passes above/below
	expect(eclipseAt(90, 0)).toBe(null); // not new or full
});

test('tides: spring tides about 2.7× neap tides', () => {
	const spring = tidalRange(0);
	const neap = tidalRange(90);
	expect(spring / neap).toBeCloseTo(1.46 / 0.54, 6);
	expect(tidalRange(180)).toBeCloseTo(spring, 10); // full Moon too
});
