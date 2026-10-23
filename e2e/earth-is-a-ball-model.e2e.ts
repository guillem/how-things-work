// Earth is a ball: the horizon, a ship sinking hull first, and the pull of a ball of rock.
import { expect, test } from '@playwright/test';
import {
	bulge,
	EYE,
	eyeToSeeAll,
	fallTime,
	hiddenHeight,
	horizonDistance,
	pullAt,
	SHIP,
	shipView,
	sinksAt
} from '../src/routes/earth-is-a-ball/model';

test('the horizon from a beach is about 5 km away, a little farther with air', () => {
	// Published rule of thumb: 3.57 √h km without refraction, about 3.86 √h km with it.
	expect(horizonDistance(EYE) / 1000).toBeCloseTo(3.57 * Math.sqrt(EYE), 1);
	expect(horizonDistance(EYE, true) / 1000).toBeCloseTo(3.86 * Math.sqrt(EYE), 1);
	// Refraction stretches the horizon by about 8 %.
	expect(horizonDistance(EYE, true) / horizonDistance(EYE)).toBeCloseTo(1.07, 1);
	// From the top of a 30 m cliff it is about 20 km away.
	expect(horizonDistance(30) / 1000).toBeCloseTo(19.6, 1);
});

test('nothing nearer than the horizon is hidden; beyond it the hidden part grows fast', () => {
	expect(hiddenHeight(3000, EYE)).toBe(0);
	// Published curvature calculators: about 31 m hidden from sea level at 20 km, about 27 m with
	// standard refraction; from 1.7 m, about 18 m.
	expect(hiddenHeight(20_000, 0)).toBeCloseTo(31.4, 0);
	expect(hiddenHeight(20_000, 0, true)).toBeCloseTo(27.3, 0);
	expect(hiddenHeight(20_000, EYE)).toBeCloseTo(18.5, 0);
	// Refraction always hides less.
	expect(hiddenHeight(15_000, EYE, true)).toBeLessThan(hiddenHeight(15_000, EYE));
});

test('a ship sinks hull first: the hull is gone at about 14 km, the masthead at about 26 km', () => {
	expect(sinksAt(SHIP.hull, EYE) / 1000).toBeCloseTo(14.1, 1);
	expect(sinksAt(SHIP.top, EYE) / 1000).toBeCloseTo(26.1, 1);
	const v = shipView(14_500, EYE, 'round');
	expect(v.hullHidden).toBe(1);
	expect(v.shipHidden).toBeLessThan(0.3);
	// On the flat world nothing is ever hidden, only smaller.
	const far = shipView(29_000, EYE, 'flat');
	expect(far.hidden).toBe(0);
	expect(far.size).toBeLessThan(shipView(3000, EYE, 'flat').size / 9);
});

test('climbing about 31 m brings back the whole ship at 20 km', () => {
	expect(eyeToSeeAll(20_000)).toBeCloseTo(31.4, 0);
	expect(shipView(20_000, 32, 'round').hidden).toBe(0);
	expect(shipView(20_000, EYE, 'round').hullHidden).toBe(1);
});

test('the sea rises about 2 m between two boats 10 km apart', () => {
	expect(bulge(10_000)).toBeCloseTo(1.96, 1);
});

test('a ball of rock pulls towards its middle, about 9.8 m/s², wherever you stand', () => {
	for (const angle of [0, 37, 90, 180, 251]) {
		const p = pullAt(angle);
		expect(p.offCentre).toBeLessThan(0.5);
		expect(p.g).toBeGreaterThan(9.6);
		expect(p.g).toBeLessThan(10.0);
	}
	// At the bottom of the drawing the pull points up the page: towards the middle.
	expect(pullAt(180).y).toBeGreaterThan(0);
	expect(pullAt(0).y).toBeLessThan(0);
});

test('a ball dropped from a raised hand, 2 m up, lands in about two thirds of a second', () => {
	expect(fallTime(2)).toBeCloseTo(0.64, 2);
});
