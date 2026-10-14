// Checks the orbital model behind the ice-ages explainer (sunlight from the La2004
// orbit) against published tables and known results, and the ice-core record
// against the numbers the narrative quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	CO2,
	CO2_NOW,
	SOLAR,
	TEMPERATURE,
	TODAY,
	climaticPrecession,
	co2Forcing,
	correlation,
	dailyInsolation,
	globalMean,
	orbitAt,
	orbitSeries,
	peaks,
	periForDay,
	perihelionDay,
	resample,
	spectrum,
	spectrumPeriods,
	summerSunshine,
	terminations,
	valueAt
} from '../src/routes/ice-ages/milankovitch';

const PAST = orbitSeries(800, 0);
const PERIODS = spectrumPeriods(400, 10, 500);
const topPeriods = (series: number[], n: number) =>
	peaks(PERIODS, spectrum(series, PERIODS))
		.slice(0, n)
		.map((p) => p.period);

test('today the Earth is closest to the Sun in early January, during the northern winter', () => {
	expect(TODAY.e).toBeCloseTo(0.0167, 4);
	expect(TODAY.tilt).toBeCloseTo(23.44, 2);
	const day = perihelionDay(TODAY); // 0 = 1 January
	expect(day).toBeGreaterThan(1);
	expect(day).toBeLessThan(4);
	// so the June solstice falls near the far point, and northern summer sunshine is weaker
	expect(dailyInsolation(TODAY, 65, 90)).toBeLessThan(dailyInsolation({ ...TODAY, e: 0 }, 65, 90));
});

test('insolation agrees with Berger & Loutre (1991) at 60° N in June over 800,000 years', () => {
	// insol91.jun (NOAA NCEI paleo archive), 60° N, June mid-month, S₀ = 1360 W/m².
	// Ours: June solstice, S₀ = 1361 and the La2004 orbit, so agreement within ~1.5%.
	const berger: [number, number][] = [
		[0, 475.95],
		[11, 523.16],
		[21, 469.28],
		[50, 494.82],
		[116, 440.2],
		[127, 544.69],
		[200, 527.54],
		[300, 470.57],
		[400, 467.02],
		[500, 485.8],
		[600, 529.85],
		[700, 483.81],
		[800, 476.56]
	];
	for (const [ka, q] of berger) {
		const ours = dailyInsolation(orbitAt(-ka), 60, 90);
		expect(Math.abs(ours - q) / q, `${ka} ka: ${ours.toFixed(1)} vs ${q}`).toBeLessThan(0.015);
	}
});

test('limiting cases of the daily-insolation formula', () => {
	// Equator at an equinox on a circular orbit: S₀/π.
	expect(dailyInsolation({ e: 0, tilt: 23.4, peri: 0 }, 0, 0)).toBeCloseTo(SOLAR / Math.PI, 6);
	// North Pole at the June solstice: the Sun circles at height ε all day, S₀ sin ε / r².
	const o = { e: 0, tilt: 24, peri: 0 };
	expect(dailyInsolation(o, 90, 90)).toBeCloseTo(SOLAR * Math.sin((24 * Math.PI) / 180), 6);
	// No tilt: the pole gets nothing, and there are no seasons.
	expect(dailyInsolation({ e: 0, tilt: 0, peri: 0 }, 90, 90)).toBeCloseTo(0, 9);
	expect(dailyInsolation({ e: 0, tilt: 0, peri: 0 }, 65, 90)).toBeCloseTo(
		dailyInsolation({ e: 0, tilt: 0, peri: 0 }, 65, 270),
		9
	);
	// Distance: the inverse-square law.
	const near = dailyInsolation({ e: 0.05, tilt: 23.4, peri: 270 }, 65, 90);
	const far = dailyInsolation({ e: 0.05, tilt: 23.4, peri: 90 }, 65, 90);
	expect(near / far).toBeCloseTo((1.05 / 0.95) ** 2, 6);
});

test('northern summer sunshine peaked about 11,000 years ago and was low when the last glacial began', () => {
	const recent = PAST.filter((p) => p.ka <= 30);
	const best = recent.reduce((a, b) => (b.summer > a.summer ? b : a));
	expect(best.ka).toBeGreaterThanOrEqual(9);
	expect(best.ka).toBeLessThanOrEqual(12);
	expect(best.summer - summerSunshine(TODAY)).toBeGreaterThan(40);
	// 116 ka (start of the last glacial) vs 127 ka (the last interglacial)
	expect(summerSunshine(orbitAt(-116))).toBeLessThan(445);
	expect(summerSunshine(orbitAt(-127))).toBeGreaterThan(540);
});

test('over 800,000 years the tilt stays within 22.1–24.5° and the orbit never stretches past e = 0.05', () => {
	const tilts = PAST.map((p) => p.o.tilt);
	const es = PAST.map((p) => p.o.e);
	expect(Math.min(...tilts)).toBeCloseTo(22.1, 1);
	expect(Math.max(...tilts)).toBeCloseTo(24.5, 1);
	expect(Math.max(...es)).toBeLessThan(0.051);
	expect(Math.min(...es)).toBeLessThan(0.005);
});

test('the cycles hardly change the sunlight the whole Earth gets, but change summer in the north by a quarter', () => {
	const g = PAST.map((p) => globalMean(p.o));
	expect((Math.max(...g) - Math.min(...g)) / Math.min(...g)).toBeLessThan(0.002);
	const s = PAST.map((p) => p.summer);
	expect(Math.min(...s)).toBeLessThan(435);
	expect(Math.max(...s)).toBeGreaterThan(545);
	expect((Math.max(...s) - Math.min(...s)) / Math.min(...s)).toBeGreaterThan(0.25);
});

test('the three cycles have their textbook periods: 41, 23 and 19, 100 and 405 thousand years', () => {
	const near = (ps: number[], p: number, tol: number) => ps.some((x) => Math.abs(x - p) <= tol);
	const tilt = topPeriods(
		PAST.map((p) => p.o.tilt),
		1
	);
	expect(near(tilt, 41, 1.5)).toBe(true);
	const prec = topPeriods(
		PAST.map((p) => climaticPrecession(p.o)),
		3
	);
	expect(near(prec, 23.5, 1.5) && near(prec, 19, 1)).toBe(true);
	const e = topPeriods(
		PAST.map((p) => p.o.e),
		3
	);
	expect(near(e, 405, 15) && near(e, 100, 10)).toBe(true);
});

test('the spectrum recovers a sine: period and amplitude', () => {
	const s = Array.from({ length: 801 }, (_, i) => 2 * Math.sin((2 * Math.PI * i) / 41));
	const [top] = peaks(PERIODS, spectrum(s, PERIODS));
	expect(top.period).toBeCloseTo(41, 0);
	expect(top.amp).toBeCloseTo(2, 1);
});

test('the Antarctic temperature record beats mostly at about 100,000 years, then at 41,000', () => {
	const temp = resample(TEMPERATURE, 800, 0);
	const [first, second] = topPeriods(temp, 2);
	expect(first).toBeGreaterThan(85);
	expect(first).toBeLessThan(115);
	expect(second).toBeCloseTo(41, -0.5);
	// and a weaker precession beat
	const amps = spectrum(temp, PERIODS);
	const at = (p: number) => amps[PERIODS.findIndex((x) => x <= p)];
	expect(at(23.4)).toBeGreaterThan(0.5);
	expect(at(23.4)).toBeLessThan(at(41));
});

test('the last glacial maximum: Antarctica about 9 °C colder, CO₂ about 190 ppm', () => {
	expect(valueAt(TEMPERATURE, 21)).toBeLessThan(-8.5);
	expect(valueAt(TEMPERATURE, 21)).toBeGreaterThan(-10);
	expect(valueAt(CO2, 21)).toBeGreaterThan(180);
	expect(valueAt(CO2, 21)).toBeLessThan(200);
	// CO₂ alone: about −2.2 W/m² relative to 278 ppm
	expect(co2Forcing(valueAt(CO2, 21))).toBeCloseTo(-2.2, 1);
	// The last interglacial, about 129,000 years ago, was warmer than today in Antarctica.
	expect(valueAt(TEMPERATURE, 129)).toBeGreaterThan(3);
});

test('CO₂ rose and fell with Antarctic temperature, between about 175 and 300 ppm; today it is far above', () => {
	const temp = resample(TEMPERATURE, 800, 0);
	const co2 = resample(CO2, 800, 0);
	expect(correlation(temp, co2)).toBeGreaterThan(0.85);
	expect(Math.min(...co2)).toBeGreaterThan(170);
	expect(Math.max(...co2)).toBeLessThan(300);
	expect(CO2_NOW.ppm).toBeGreaterThan(420);
	expect(CO2_NOW.ppm / Math.max(...co2)).toBeGreaterThan(1.4);
});

test('the date of closest approach and the perihelion longitude invert each other', () => {
	for (const day of [3, 100, 172, 250, 355]) {
		for (const e of [0.005, 0.0167, 0.05]) {
			const peri = periForDay(day, e);
			expect(perihelionDay({ e, tilt: 23.4, peri })).toBeCloseTo(day, 6);
		}
	}
});

test('the next 100,000 years: the orbit grows rounder, so northern summers swing about two-thirds as much', () => {
	const next = orbitSeries(0, -100);
	expect(Math.min(...next.map((p) => p.o.e))).toBeLessThan(0.004);
	const range = (a: number[]) => Math.max(...a) - Math.min(...a);
	const ratio =
		range(next.map((p) => p.summer)) / range(PAST.filter((p) => p.ka <= 100).map((p) => p.summer));
	expect(ratio).toBeGreaterThan(0.6);
	expect(ratio).toBeLessThan(0.75);
});

test('nine terminations in 800,000 years; eight began while northern summer sunshine was rising', () => {
	const ends = terminations();
	expect(ends).toHaveLength(9);
	const sun = (ka: number) => summerSunshine(orbitAt(-ka));
	const rising = ends.filter((tr) => sun(tr.from - 1) > sun(tr.from + 1));
	expect(rising).toHaveLength(8);
	// the last one: from about 17,000 to 12,000 years ago
	expect(ends[0].from).toBeGreaterThan(15);
	expect(ends[0].from).toBeLessThan(19);
	expect(ends[0].to).toBeGreaterThan(10);
	expect(ends[0].to).toBeLessThan(13);
	// but summer sunshine peaked 37 times
	const s = PAST.map((p) => p.summer);
	let peaksCount = 0;
	for (let i = 1; i < s.length - 1; i++) if (s[i] > s[i - 1] && s[i] >= s[i + 1]) peaksCount++;
	expect(peaksCount).toBe(37);
});

test('the summer-sunshine spectrum has almost nothing at 100,000 years', () => {
	const s = PAST.map((p) => p.summer);
	const amps = spectrum(s, PERIODS);
	const at = (p: number) => amps[PERIODS.findIndex((x) => x <= p)];
	expect(at(95)).toBeLessThan(0.1 * Math.max(...amps));
});
