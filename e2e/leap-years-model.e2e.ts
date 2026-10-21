// Leap years: calendar rules against the mean tropical year.
import { expect, test } from '@playwright/test';
import {
	drift,
	driftSeries,
	formatDate,
	isLeap,
	leapReason,
	shortfallKm,
	solsticeDate,
	solsticeSeries,
	weekday
} from '../src/routes/leap-years/model';

test('the real rule: 1900 and 2100 are not leap years, 2000 and 2024 are', () => {
	expect(isLeap(1900, 'gregorian')).toBe(false);
	expect(isLeap(2000, 'gregorian')).toBe(true);
	expect(isLeap(2024, 'gregorian')).toBe(true);
	expect(isLeap(2023, 'gregorian')).toBe(false);
	expect(isLeap(2100, 'gregorian')).toBe(false);
	expect(leapReason(1900).leap).toBe(false);
	expect(leapReason(2000).leap).toBe(true);
	// 97 leap years in every 400.
	let n = 0;
	for (let y = 2001; y <= 2400; y++) if (isLeap(y, 'gregorian')) n++;
	expect(n).toBe(97);
});

// The model repeats the mean tropical year, so its solstice dates are approximate: they can be a
// day off when the real instant is near midnight (2008: June 20, 23:59 UT; the model says June 21).
test('this century the model puts the June solstice on June 20 or 21, as almanacs do', () => {
	// Published UTC dates (e.g. US Naval Observatory): 2001 June 21, 2004 June 21, 2020 June 20,
	// 2024 June 20.
	expect(formatDate(solsticeDate(0, 'gregorian'))).toBe('June 21');
	expect(formatDate(solsticeDate(3, 'gregorian'))).toBe('June 21');
	expect(formatDate(solsticeDate(19, 'gregorian'))).toBe('June 20');
	expect(formatDate(solsticeDate(23, 'gregorian'))).toBe('June 20');
	for (let n = 0; n < 99; n++)
		expect(['June 20', 'June 21']).toContain(formatDate(solsticeDate(n, 'gregorian')));
});

test('with no leap days the solstice slides about a month a century and into winter by ~750 years', () => {
	// A quarter of a day a year.
	expect(drift(4, 'none')).toBeCloseTo(0.97, 2);
	// About 24 days after a century; a full month (30 days) after about 125 years.
	expect(drift(100, 'none')).toBeGreaterThan(23);
	expect(drift(100, 'none')).toBeLessThan(25);
	expect(drift(125, 'none')).toBeGreaterThan(30);
	expect(formatDate(solsticeDate(100, 'none'))).toBe('July 15');
	// Half a year off: the longest day lands in December.
	expect(solsticeDate(750, 'none').month).toBe(11);
	expect(solsticeDate(650, 'none').month).toBe(10);
});

test('every four years leaves about a day every 128 years: ten days by 1582', () => {
	// The Julian year is 11 minutes too long.
	const perYear = -drift(1000, 'julian') / 1000;
	expect(1 / perYear).toBeGreaterThan(125);
	expect(1 / perYear).toBeLessThan(131);
	// From the Council of Nicaea (325) to the reform of 1582: about ten days.
	expect(-drift(1582 - 325, 'julian')).toBeGreaterThan(9);
	expect(-drift(1582 - 325, 'julian')).toBeLessThan(10.5);
	// Within each four years it wobbles by under a day.
	const s = driftSeries(40, 'julian');
	expect(Math.max(...s) - Math.min(...s)).toBeLessThan(1.1);
});

test('the skip-centuries rule keeps it within a day for thousands of years', () => {
	const s = driftSeries(3000, 'gregorian');
	expect(Math.max(...s.map(Math.abs))).toBeLessThan(2);
	// About one day in 3,200 years.
	const perYear = -drift(2000, 'gregorian') / 2000;
	expect(1 / perYear).toBeGreaterThan(2800);
	expect(1 / perYear).toBeLessThan(3600);
});

test('at the end of 365 days Earth is still about 600,000 km short of a full lap', () => {
	expect(shortfallKm()).toBeGreaterThan(600_000);
	expect(shortfallKm()).toBeLessThan(650_000);
});

test('weekdays: 1 January 2000 was a Saturday, 1 February 2024 a Thursday', () => {
	expect(weekday(2000, 0, 1)).toBe(6);
	expect(weekday(2024, 1, 1)).toBe(4);
	expect(weekday(1900, 0, 1)).toBe(1);
	expect(weekday(2001, 0, 1)).toBe(1);
});

test('the chart series names the same dates as the calendar', () => {
	const s = solsticeSeries(2000, 'gregorian');
	for (const n of [0, 3, 19, 23, 99, 1999]) {
		const d = solsticeDate(n, 'gregorian');
		// Day of an ordinary year: June 20 is 170, June 21 is 171.
		expect(Math.floor(s[n])).toBe(
			d.day === 20 ? 170 : d.day === 21 ? 171 : d.day === 22 ? 172 : -1
		);
	}
	expect(Math.floor(solsticeSeries(100, 'none')[100])).toBe(195); // July 15
});
