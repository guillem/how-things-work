// A summer day on a coast: the Sun's path, land and sea heating, and the breeze the difference
// drives, checked against astronomy, textbook values and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	LAND,
	SEA,
	airDensity,
	at,
	day,
	extremes,
	kmh,
	push,
	steadyBreeze,
	sunHeight,
	sunlight,
	sunrise,
	turns
} from '../src/routes/sea-breeze/model';

test('at 40° N near midsummer the Sun rises about 4:35, sets about 19:25 (sun time) and stands 73° high at noon', () => {
	expect(sunrise()).toBeGreaterThan(4.5);
	expect(sunrise()).toBeLessThan(4.7);
	expect(sunHeight(12)).toBeCloseTo(73, 5);
	expect(sunHeight(sunrise())).toBeCloseTo(0, 5);
	expect(sunHeight(24 - sunrise())).toBeCloseTo(0, 5);
	expect(sunlight(2)).toBe(0);
});

test('clear-sky direct sunlight at noon is about 900 W per square metre, and weaker when the Sun is low', () => {
	expect(sunlight(12)).toBeGreaterThan(850);
	expect(sunlight(12)).toBeLessThan(950);
	expect(sunlight(7)).toBeLessThan(sunlight(12) / 2);
});

test('the land’s air swings about 14 °C over the day, warmest in mid-afternoon and coolest around dawn', () => {
	const land = extremes('land');
	expect(land.max - land.min).toBeGreaterThan(12);
	expect(land.max - land.min).toBeLessThan(16);
	expect(land.maxHour).toBeGreaterThan(14);
	expect(land.maxHour).toBeLessThan(16);
	expect(land.minHour).toBeGreaterThan(4);
	expect(land.minHour).toBeLessThan(6.5);
});

test('the sea warms by less than half a degree all day, though it soaks up more sunlight than the land', () => {
	const sea = extremes('sea');
	expect(sea.max - sea.min).toBeLessThan(0.5);
	expect(1 - SEA.albedo).toBeGreaterThan(1 - LAND.albedo);
	// It takes about 80 times as much warmth to warm the sea’s stirred layer as the land’s.
	expect(SEA.capacity / LAND.capacity).toBeGreaterThan(70);
	expect(SEA.capacity / LAND.capacity).toBeLessThan(90);
});

test('the page’s afternoon: at 3 pm the land is about 31 °C, the sea 22 °C, the breeze about 23 km/h off the sea', () => {
	const m = at(15);
	expect(Math.round(m.land)).toBe(31);
	expect(Math.round(m.sea)).toBe(22);
	expect(m.breeze).toBeGreaterThan(0);
	expect(kmh(m.breeze)).toBe(23);
});

test('the page’s night: at 3 am the land is about 18 °C, the sea 22 °C, and the breeze blows out to sea at about 11 km/h', () => {
	const m = at(3);
	expect(Math.round(m.land)).toBe(18);
	expect(Math.round(m.sea)).toBe(22);
	expect(m.breeze).toBeLessThan(0);
	expect(kmh(m.breeze)).toBe(11);
});

test('the breeze turns onto the land mid-morning and back out to sea in the evening, shortly after the land drops below the sea', () => {
	const { onshore, offshore } = turns();
	expect(onshore).toBeGreaterThan(8.5);
	expect(onshore).toBeLessThan(10);
	expect(offshore).toBeGreaterThan(20);
	expect(offshore).toBeLessThan(21.5);
	// Wherever the land is clearly warmer the breeze is onshore, and clearly cooler, offshore.
	for (const m of day) {
		if (m.land - m.sea > 2) expect(m.breeze).toBeGreaterThan(0);
		if (m.land - m.sea < -2) expect(m.breeze).toBeLessThan(0);
	}
});

test('the night’s land breeze is weaker than the afternoon’s sea breeze', () => {
	const b = extremes('breeze');
	expect(-b.min).toBeLessThan(b.max / 1.5);
	// A typical sea breeze: about 15 to 30 km/h.
	expect(b.max * 3.6).toBeGreaterThan(15);
	expect(b.max * 3.6).toBeLessThan(30);
});

test('Holton’s sea-breeze example: 10 °C across a 20 km loop 1 km high pushes the air about 7 mm/s faster every second', () => {
	expect(push(10) * 1000).toBeCloseTo(7.2, 0);
	// No temperature difference, no breeze; twice the difference, twice the breeze.
	expect(push(0)).toBe(0);
	expect(steadyBreeze(8)).toBeCloseTo(2 * steadyBreeze(4), 10);
	expect(steadyBreeze(-4)).toBeLessThan(0);
});

test('a cubic metre of air weighs about 1.2 kg; over the 31 °C land it is about 35 g lighter than over the 22 °C sea', () => {
	expect(airDensity(22)).toBeCloseTo(1.2, 1);
	const lighter = (airDensity(at(15).sea) - airDensity(at(15).land)) * 1000;
	expect(Math.round(lighter / 5) * 5).toBe(35);
	// At night it is the other way round: the air over the land is the heavier.
	expect(airDensity(at(3).land)).toBeGreaterThan(airDensity(at(3).sea));
});
