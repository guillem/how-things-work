// Halley's comet on its JPL orbit, how fast its ice turns to gas, and where its two tails point,
// checked against orbital mechanics, the 1986 apparition and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	BETAS,
	HALLEY,
	angleBetween,
	antiSun,
	darkTemperature,
	dateOf,
	daysWithin,
	dustTail,
	gasTailDirection,
	grainAt,
	heading,
	iceRate,
	speed,
	stateAt,
	sunlight,
	tailBend,
	tailToHeading,
	yearOf
} from '../src/routes/comet-tails/model';

const YEAR = 365.25;

test('Halley swings inside Venus’s path, 0.59 times Earth’s distance, on 9 February 1986', () => {
	const s = stateAt(0);
	expect(s.r).toBeCloseTo(0.587, 3);
	expect(s.r).toBeLessThan(0.723); // Venus
	expect(dateOf(0)).toBe('9 Feb 1986');
});

test('it goes round in 76 years and turns back beyond Neptune, 35 times Earth’s distance out', () => {
	expect(HALLEY.period / YEAR).toBeCloseTo(76, 0);
	const far = stateAt(HALLEY.period / 2);
	expect(far.r).toBeCloseTo(35.3, 1);
	expect(far.r).toBeGreaterThan(30.1); // Neptune
	// It was farthest out in late 2023 (the page's single 1986 ellipse puts it in early 2024).
	expect(yearOf(HALLEY.period / 2)).toBeGreaterThan(2023.8);
	expect(yearOf(HALLEY.period / 2)).toBeLessThan(2024.3);
	// The orbit closes: one period later it is back at the same place.
	const again = stateAt(HALLEY.period);
	expect(again.r).toBeCloseTo(stateAt(0).r, 6);
});

test('Kepler’s laws hold along the orbit: the same energy and the same sweep everywhere', () => {
	const mu = 0.01720209895 ** 2;
	const energy = (d: number) => {
		const s = stateAt(d);
		return (s.vx ** 2 + s.vy ** 2) / 2 - mu / s.r;
	};
	const sweep = (d: number) => {
		const s = stateAt(d);
		return s.x * s.vy - s.y * s.vx;
	};
	for (const d of [-9000, -300, -40, 0, 25, 700, 12000]) {
		expect(energy(d) / energy(0)).toBeCloseTo(1, 9);
		expect(sweep(d) / sweep(0)).toBeCloseTo(1, 9);
	}
	// Moving the way the position says it moves: a day later it is where the velocity pointed.
	const s = stateAt(10);
	const next = stateAt(10.001);
	expect((next.x - s.x) / 0.001).toBeCloseTo(s.vx, 5);
});

test('it races past the Sun at 54 km/s and crawls at under 1 km/s far out, 60 times slower', () => {
	expect(speed(stateAt(0))).toBeCloseTo(54.5, 0);
	const far = speed(stateAt(HALLEY.period / 2));
	expect(far).toBeLessThan(1);
	expect(speed(stateAt(0)) / far).toBeGreaterThan(55);
	expect(speed(stateAt(0)) / far).toBeLessThan(65);
});

test('it spends about a year closer than 3 times Earth’s distance, and 36 of its 76 years beyond Neptune', () => {
	expect(daysWithin(3) / YEAR).toBeGreaterThan(0.95);
	expect(daysWithin(3) / YEAR).toBeLessThan(1.05);
	expect((HALLEY.period - daysWithin(30.07)) / YEAR).toBeCloseTo(36, 0);
	expect((HALLEY.period - daysWithin(5.2)) / YEAR).toBeGreaterThan(73); // beyond Jupiter
});

test('far out the sunlight is 1,250 times weaker than at Earth; at its closest 3 times stronger', () => {
	expect(1 / sunlight(HALLEY.Q)).toBeGreaterThan(1200);
	expect(1 / sunlight(HALLEY.Q)).toBeLessThan(1300);
	expect(sunlight(HALLEY.q)).toBeCloseTo(2.9, 1);
});

test('a dark ball warms to about 5 °C at Earth’s distance, but stays below −220 °C far out', () => {
	// 278 K is the textbook temperature of a black body at 1 au.
	expect(darkTemperature(1)).toBeCloseTo(5, 0);
	expect(darkTemperature(HALLEY.Q)).toBeLessThan(-220);
	expect(darkTemperature(HALLEY.q)).toBeGreaterThan(80);
});

test('ice turns to gas fast near the Sun and almost stops beyond 3 times Earth’s distance', () => {
	expect(iceRate(1)).toBeCloseTo(1, 2);
	expect(iceRate(HALLEY.q)).toBeGreaterThan(3);
	expect(iceRate(3)).toBeLessThan(0.01);
	expect(iceRate(5.2)).toBeLessThan(1e-6);
	// Always weaker farther out.
	for (let r = 0.5; r < 10; r += 0.25) expect(iceRate(r + 0.25)).toBeLessThan(iceRate(r));
});

test('the gas tail points within 8 degrees of straight away from the Sun, bent back a little', () => {
	for (let d = -200; d <= 200; d += 10) {
		const s = stateAt(d);
		expect(tailBend(s)).toBeLessThan(8);
		// Bent back: the tail leans away from the way the comet is going.
		expect(angleBetween(gasTailDirection(s), heading(s))).toBeGreaterThan(
			angleBetween(antiSun(s), heading(s))
		);
	}
	expect(tailBend(stateAt(0))).toBeCloseTo(7.8, 0);
});

test('coming in the tail trails behind; going out the comet flies tail-first', () => {
	for (const d of [-150, -60, -30]) expect(tailToHeading(stateAt(d))).toBeGreaterThan(120);
	for (const d of [30, 60, 150]) expect(tailToHeading(stateAt(d))).toBeLessThan(65);
	// At its closest the tail sticks out sideways.
	expect(tailToHeading(stateAt(0))).toBeGreaterThan(80);
	expect(tailToHeading(stateAt(0))).toBeLessThan(100);
});

test('a grain the sunlight cannot push rides along with the nucleus; one pushed as hard as gravity pulls flies straight', () => {
	const g = grainAt(-30, 0, 0);
	const s = stateAt(0);
	expect(Math.hypot(g.x - s.x, g.y - s.y)).toBeLessThan(1e-6);
	const from = stateAt(-30);
	const free = grainAt(-30, 1, 0);
	expect(free.x).toBeCloseTo(from.x + 30 * from.vx, 9);
	expect(free.y).toBeCloseTo(from.y + 30 * from.vy, 9);
});

test('the dust tail starts straight away from the Sun and bends back along the path, behind the gas tail', () => {
	for (const now of [-60, 0, 30, 60]) {
		const s = stateAt(now);
		for (const g of dustTail(now)) {
			const off = { x: g.x - s.x, y: g.y - s.y };
			const len = Math.hypot(off.x, off.y);
			const lean = angleBetween({ x: off.x / len, y: off.y / len }, heading(s));
			// Never ahead of the line straight away from the Sun...
			expect(lean).toBeGreaterThan(angleBetween(antiSun(s), heading(s)) - 0.01);
			// ...and grains out for more than a week lean back further than the gas tail.
			if (g.age > 8) expect(lean).toBeGreaterThan(angleBetween(gasTailDirection(s), heading(s)));
		}
	}
	const now = 30;
	const s = stateAt(now);
	const dust = dustTail(now);
	// Released at the same moment, the finest grains are pushed farthest.
	const at20 = BETAS.map((b) => dust.find((g) => g.beta === b && g.age === 20)!);
	const reach = at20.map((g) => Math.hypot(g.x - s.x, g.y - s.y));
	for (let i = 1; i < reach.length; i++) expect(reach[i]).toBeGreaterThan(reach[i - 1]);
});
