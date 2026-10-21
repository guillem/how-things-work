// A bubble of air lifted from the ground: dry cooling, the cloud base, cooling in cloud, and the
// trip over a mountain, checked against textbook values.
import { expect, test } from '@playwright/test';
import {
	DAY,
	DROPLET_RADIUS,
	MOUNTAIN,
	THERMAL_SPEED,
	climb,
	at,
	cloudBase,
	dewPoint,
	fallSpeed,
	moistLapse,
	moveTo,
	overMountain,
	pressure,
	saturationPressure,
	start
} from '../src/routes/cloud-base/model';

test('saturation vapour pressure matches the tables: 6.11 hPa at 0 °C, 23.4 at 20 °C, 42.4 at 30 °C', () => {
	expect(saturationPressure(0)).toBeCloseTo(6.11, 2);
	expect(saturationPressure(20)).toBeCloseTo(23.39, 1);
	expect(saturationPressure(30)).toBeCloseTo(42.45, 0);
});

test('air pressure halves about 5.5 km up, and is about 795 hPa at 2 km', () => {
	expect(pressure(2000, 15)).toBeGreaterThan(790);
	expect(pressure(2000, 15)).toBeLessThan(800);
	expect(pressure(5500, 15) / pressure(0, 15)).toBeCloseTo(0.5, 1);
});

test('a dry bubble cools about 1 °C for every 100 m it rises (9.8 °C per km)', () => {
	const b = moveTo(start(25, 0.3), 1000, 25);
	expect(25 - b.t).toBeGreaterThan(9.4);
	expect(25 - b.t).toBeLessThan(10.0);
	expect(b.droplets).toBe(0);
});

test('a rising bubble swells: about a fifth bigger 2 km up', () => {
	const b = moveTo(start(25, 0.3), 2000, 25);
	expect(b.swell).toBeGreaterThan(1.17);
	expect(b.swell).toBeLessThan(1.23);
});

test('brought back down without making cloud, a bubble is exactly as it started', () => {
	const up = moveTo(start(20, 0.4), 1500, 20);
	const down = moveTo(up, 0, 20);
	expect(down.t).toBeCloseTo(20, 2);
	expect(down.rh).toBeCloseTo(0.4, 3);
	expect(down.swell).toBeCloseTo(1, 3);
});

test('the cloud base is about 125 m above the ground for each degree between temperature and dew point', () => {
	for (const rh of [0.4, 0.55, 0.7, 0.9]) {
		const spread = 25 - dewPoint(25, rh);
		const base = cloudBase(25, rh);
		expect(base / (125 * spread)).toBeGreaterThan(0.97);
		expect(base / (125 * spread)).toBeLessThan(1.04);
	}
});

test('the page’s day: clouds start about 1,200 m up, where the bubble has cooled to 13 °C', () => {
	const base = cloudBase(DAY.groundC, DAY.rh);
	expect(Math.round(base / 100) * 100).toBe(1200);
	const samples = climb(DAY.groundC, DAY.rh, DAY.thermalTop, 10);
	expect(Math.round(at(samples, 1200).t)).toBe(13);
	expect(at(samples, 1200).droplets).toBe(0);
	expect(at(samples, 1250).droplets).toBeGreaterThan(0);
});

test('damper air makes a lower cloud base; air too dry makes none below the thermals’ 2 km', () => {
	const bases = [0.3, 0.4, 0.55, 0.7, 0.9].map((rh) => cloudBase(DAY.groundC, rh));
	for (let i = 1; i < bases.length; i++) expect(bases[i]).toBeLessThan(bases[i - 1]);
	expect(cloudBase(DAY.groundC, 0.3)).toBeGreaterThan(DAY.thermalTop);
	expect(cloudBase(DAY.groundC, 0.35)).toBeGreaterThan(DAY.thermalTop);
	expect(cloudBase(DAY.groundC, 0.4)).toBeLessThan(DAY.thermalTop);
	expect(cloudBase(DAY.groundC, 1)).toBe(0);
});

test('saturated air cools more slowly: about 4.3 °C per km at 20 °C and 6.5 at 0 °C (1000 hPa)', () => {
	expect(moistLapse(20, 1000) * 1000).toBeCloseTo(4.3, 0);
	expect(moistLapse(0, 1000) * 1000).toBeCloseTo(6.5, 0);
});

test('inside the cloud the bubble stays saturated and its water turns to droplets as it rises', () => {
	const samples = climb(DAY.groundC, DAY.rh, 2000, 10);
	const a = at(samples, 1500);
	const b = at(samples, 2000);
	expect(a.rh).toBeCloseTo(1, 3);
	expect(b.droplets).toBeGreaterThan(a.droplets);
	// Water is neither made nor lost.
	expect(b.vapour + b.droplets).toBeCloseTo(samples[0].vapour, 6);
	// Cooling slows: well under 1 °C per 100 m between 1,500 and 2,000 m.
	expect((a.t - b.t) / 5).toBeLessThan(0.6);
});

test('over the mountain the bubble rains on the windy side and arrives warmer and drier', () => {
	const trip = overMountain();
	const first = trip.at(0);
	expect(first.t).toBe(MOUNTAIN.groundC);
	// The page quotes: cloud from about 700 m, 26 °C and 36 % on the far plain.
	expect(Math.round(cloudBase(MOUNTAIN.groundC, MOUNTAIN.rh) / 50) * 50).toBe(700);
	expect(Math.round(trip.end.t)).toBe(26);
	expect(Math.round(trip.end.rh * 100)).toBe(36);
	expect(trip.cloudFrom).not.toBeNull();
	expect(trip.top.rained).toBeGreaterThan(0);
	// Nothing more falls on the far side.
	expect(trip.end.rained).toBe(trip.top.rained);
	expect(trip.end.t - first.t).toBeGreaterThan(5);
	expect(trip.end.rh).toBeLessThan(first.rh / 1.5);
	// About a quarter of its water fell as rain.
	expect(trip.end.rained / first.vapour).toBeGreaterThan(0.2);
	expect(trip.end.rained / first.vapour).toBeLessThan(0.3);
});

test('a bubble too dry to make cloud on the mountain comes down the far side unchanged', () => {
	const trip = overMountain(20, 0.3, 2000);
	expect(trip.cloudFrom).toBeNull();
	expect(trip.end.t).toBeCloseTo(20, 2);
	expect(trip.end.rained).toBe(0);
});

test('a cloud droplet falls about a centimetre a second, far slower than a thermal rises', () => {
	expect(fallSpeed(DROPLET_RADIUS)).toBeGreaterThan(0.01);
	expect(fallSpeed(DROPLET_RADIUS)).toBeLessThan(0.015);
	expect(THERMAL_SPEED / fallSpeed(DROPLET_RADIUS)).toBeGreaterThan(100);
	// A 1 mm raindrop is far too big for this law; drizzle (0.1 mm across) falls about 30 cm/s.
	expect(fallSpeed(50e-6)).toBeGreaterThan(0.25);
	expect(fallSpeed(50e-6)).toBeLessThan(0.35);
});
