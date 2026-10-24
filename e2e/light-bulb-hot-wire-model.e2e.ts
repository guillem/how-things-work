// An old 60 W bulb's tungsten wire and an LED bulb: checked against physical laws, the CIE's own
// colour standards, the ratings of real bulbs and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	DRAPER,
	FULL,
	VOLTS,
	WATTS,
	WIRE_DIAMETER,
	WIRE_LENGTH,
	bulb,
	celsius,
	chromaticity,
	glow,
	glowName,
	glowRGB,
	infraredShare,
	led,
	planck,
	resistivity
} from '../src/routes/light-bulb-hot-wire/model';

test('the glow’s spectrum obeys the laws of a glowing body: Stefan-Boltzmann for the total, Wien for the peak', () => {
	for (const kelvin of [1500, 2700, 5800]) {
		let sum = 0;
		for (let nm = 50; nm < 100000; nm += 1) sum += planck(nm + 0.5, kelvin);
		expect(sum / ((5.670374e-8 * kelvin ** 4) / Math.PI)).toBeCloseTo(1, 3);
		let peak = 0;
		for (let nm = 200; nm < 4000; nm++) if (planck(nm, kelvin) > planck(peak, kelvin)) peak = nm;
		expect(peak).toBeCloseTo(2.8978e6 / kelvin, -1);
	}
});

test('a glower at 2856 K has the colour of the CIE’s standard light-bulb light, illuminant A', () => {
	// CIE 015:2018: illuminant A has chromaticity x = 0.44758, y = 0.40745.
	const [x, y] = chromaticity(2856);
	expect(x).toBeCloseTo(0.4476, 3);
	expect(y).toBeCloseTo(0.4074, 3);
});

test('the wire is thinner than half a hair and about 70 cm long uncoiled; hot, it resists about 14 times as much as cold', () => {
	expect(WIRE_DIAMETER * 1000).toBeGreaterThan(0.02);
	expect(WIRE_DIAMETER * 1000).toBeLessThan(0.035);
	expect(WIRE_LENGTH).toBeGreaterThan(0.6);
	expect(WIRE_LENGTH).toBeLessThan(0.8);
	expect(resistivity(2700) / resistivity(300)).toBeGreaterThan(13);
	expect(resistivity(2700) / resistivity(300)).toBeLessThan(15);
});

test('at full the bulb takes 60 W from 230 V, its wire at about 2,450 °C, and gives about 740 lumens, like a real 60 W bulb', () => {
	expect(VOLTS).toBe(230);
	expect(FULL.watts).toBeCloseTo(WATTS, 6);
	expect(celsius(FULL.kelvin)).toBe(2450);
	// Real 60 W bulbs: 710 lumens (EU rating) to about 800.
	expect(FULL.lumens).toBeGreaterThan(700);
	expect(FULL.lumens).toBeLessThan(800);
	expect(FULL.lumens / FULL.watts).toBeGreaterThan(11);
	expect(FULL.lumens / FULL.watts).toBeLessThan(14);
});

test('at full the heat is dozens of times the light, and nine tenths of the electricity leaves as infrared', () => {
	expect(FULL.light / FULL.watts).toBeGreaterThan(0.015);
	expect(FULL.light / FULL.watts).toBeLessThan(0.025);
	expect(FULL.heat / FULL.light).toBeGreaterThan(40);
	expect(FULL.heat / FULL.light).toBeLessThan(70);
	expect(infraredShare(FULL.kelvin)).toBeGreaterThan(0.89);
	expect(infraredShare(FULL.kelvin)).toBeLessThan(0.94);
});

test('brightness does not follow the dimmer: half way takes a third of the electricity and gives a fourteenth of the light', () => {
	const half = bulb(0.5);
	expect(half.watts / FULL.watts).toBeGreaterThan(0.3);
	expect(half.watts / FULL.watts).toBeLessThan(0.36);
	expect(FULL.lumens / half.lumens).toBeGreaterThan(12);
	expect(FULL.lumens / half.lumens).toBeLessThan(16);
	expect(celsius(half.kelvin)).toBe(1850);
	// The last tenth of the dimmer adds nearly a third of the light.
	const nine = bulb(0.9);
	expect(1 - nine.lumens / FULL.lumens).toBeGreaterThan(0.28);
	expect(1 - nine.lumens / FULL.lumens).toBeLessThan(0.34);
	// More push, hotter wire, every time.
	for (let d = 0.01; d < 1; d += 0.01)
		expect(bulb(d + 0.01).kelvin).toBeGreaterThan(bulb(d).kelvin);
});

test('the wire goes from no glow to dull red, orange, yellow and white as the dimmer turns up', () => {
	expect(glow(DRAPER - 1)).toBe(0);
	expect(glowName(700)).toBe('no glow');
	expect(glowName(950)).toBe('dull red');
	expect(glowName(bulb(0.2).kelvin)).toBe('orange');
	expect(glowName(bulb(0.4).kelvin)).toBe('yellow');
	expect(glowName(FULL.kelvin)).toBe('white');
	expect(glow(FULL.kelvin)).toBe(1);
	// Whiter and brighter all the way up: the blue rises, the glow grows.
	let last = -1;
	let lastGlow = -1;
	for (let k = 900; k <= 2700; k += 100) {
		expect(glowRGB(k)[2]).toBeGreaterThanOrEqual(last);
		expect(glow(k)).toBeGreaterThan(lastGlow);
		last = glowRGB(k)[2];
		lastGlow = glow(k);
	}
});

test('an LED bulb gives the same light from about an eighth of the electricity, a tenth of the heat, and still more heat than light', () => {
	const l = led(FULL.lumens);
	expect(l.lumens).toBe(FULL.lumens);
	expect(FULL.watts / l.watts).toBeGreaterThan(7.5);
	expect(FULL.watts / l.watts).toBeLessThan(8.5);
	expect(FULL.heat / l.heat).toBeGreaterThan(9);
	expect(FULL.heat / l.heat).toBeLessThan(10);
	expect(l.heat).toBeGreaterThan(l.light);
	expect(l.heat / l.watts).toBeGreaterThan(0.5);
});
