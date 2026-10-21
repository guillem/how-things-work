/**
 * Leap years: the calendar against the seasons.
 *
 * The seasons repeat every tropical year, about 365.2422 days (the mean tropical year,
 * 365 d 5 h 48 min 45 s; Explanatory Supplement to the Astronomical Almanac). A calendar year is a
 * whole number of days, 365 or 366, chosen by a rule. The model counts calendar days and season
 * days side by side and says on which calendar date a fixed point of the seasons (the June
 * solstice, the longest day in the northern half of the world) falls, year after year.
 *
 * Simplifications, said on the page: the year's length is the mean value (the real interval
 * between two June solstices wobbles by minutes and changes very slowly over millennia), and the
 * drawing's orbit is a circle travelled at an even pace.
 */

/** Mean tropical year in days: one lap of the Sun, season to season. */
export const TROPICAL_YEAR = 365.24219;

/** Earth's mean orbital speed, km/s (NASA Earth fact sheet: 29.78). */
export const ORBIT_SPEED_KM_S = 29.78;
/** Earth's mean diameter, km (NASA Earth fact sheet: 12,742). */
export const EARTH_DIAMETER_KM = 12742;

export type Rule = 'none' | 'julian' | 'gregorian';

/** Is `year` a leap year (366 days) under the rule? */
export function isLeap(year: number, rule: Rule): boolean {
	if (rule === 'none') return false;
	if (rule === 'julian') return year % 4 === 0;
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Why `year` is or isn't a leap year under the real (Gregorian) rule, in plain words. */
export function leapReason(year: number): { leap: boolean; checks: string[] } {
	const by4 = year % 4 === 0;
	const by100 = year % 100 === 0;
	const by400 = year % 400 === 0;
	const checks = [`${year} ${by4 ? 'can' : 'can’t'} be shared out exactly into fours`];
	if (!by4) return { leap: false, checks };
	checks.push(by100 ? `it ends in 00, a hundreds year` : `it isn’t a hundreds year`);
	if (!by100) return { leap: true, checks };
	checks.push(
		by400 ? `and it can be shared into four-hundreds` : `and it can’t be shared into four-hundreds`
	);
	return { leap: by400, checks };
}

/** The first year the model counts from. Its June solstice was on 21 June 2001, 07:38 UTC. */
export const START_YEAR = 2001;
/** Days from 1 January 2001, 00:00 UTC, to the June solstice of 2001. */
const FIRST_SOLSTICE = 171 + (7 + 38 / 60) / 24;

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Lengths of the months of `year` under the rule. */
export function monthLengths(year: number, rule: Rule): number[] {
	return [31, isLeap(year, rule) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

export interface CalendarDate {
	year: number;
	/** 0 = January. */
	month: number;
	/** 1-based day of the month. */
	day: number;
	/** Days since 1 January of that year, with the fraction of the day. */
	dayOfYear: number;
}

/**
 * The calendar date, under the rule, of a moment `days` after 1 January 2001, 00:00 UTC.
 * Works forwards only (days ≥ 0).
 */
export function dateAt(days: number, rule: Rule): CalendarDate {
	let year = START_YEAR;
	let left = days;
	for (;;) {
		const len = isLeap(year, rule) ? 366 : 365;
		if (left < len) break;
		left -= len;
		year++;
	}
	const dayOfYear = left;
	const lengths = monthLengths(year, rule);
	let month = 0;
	while (left >= lengths[month]) {
		left -= lengths[month];
		month++;
	}
	return { year, month, day: Math.floor(left) + 1, dayOfYear };
}

/** The date of the June solstice `n` years after 2001's, as the calendar under the rule names it. */
export function solsticeDate(n: number, rule: Rule): CalendarDate {
	return dateAt(FIRST_SOLSTICE + n * TROPICAL_YEAR, rule);
}

/**
 * How many days later in the calendar the solstice falls `n` years on than it did in 2001
 * (negative: earlier). Counted across year ends, so it keeps growing past 31 December.
 */
export function drift(n: number, rule: Rule): number {
	let calendarDays = 0;
	for (let y = START_YEAR; y < START_YEAR + n; y++) calendarDays += isLeap(y, rule) ? 366 : 365;
	return n * TROPICAL_YEAR - calendarDays;
}

/** Drift for every year 0..n, computed in one pass (for charts). */
export function driftSeries(n: number, rule: Rule): number[] {
	const out = [0];
	let calendarDays = 0;
	for (let k = 1; k <= n; k++) {
		calendarDays += isLeap(START_YEAR + k - 1, rule) ? 366 : 365;
		out.push(k * TROPICAL_YEAR - calendarDays);
	}
	return out;
}

/** How far Earth still has to go, in km, when a 365-day year ends: the missing part of a lap. */
export function shortfallKm(): number {
	return (TROPICAL_YEAR - 365) * 86400 * ORBIT_SPEED_KM_S;
}

export const formatDate = (d: CalendarDate) => `${MONTHS[d.month]} ${d.day}`;

/** Day of the week (0 = Sunday) of a Gregorian date: Zeller-style count from a known Monday. */
export function weekday(year: number, month: number, day: number): number {
	// Days from 1 January 2001 (a Monday) to the date, under the Gregorian rule.
	let n = 0;
	if (year >= START_YEAR) {
		for (let y = START_YEAR; y < year; y++) n += isLeap(y, 'gregorian') ? 366 : 365;
	} else {
		for (let y = year; y < START_YEAR; y++) n -= isLeap(y, 'gregorian') ? 366 : 365;
	}
	const lengths = monthLengths(year, 'gregorian');
	for (let m = 0; m < month; m++) n += lengths[m];
	n += day - 1;
	return (((1 + n) % 7) + 7) % 7;
}

/**
 * For years 0..n, the solstice's date as a day of an ordinary 365-day year (0 = 1 January,
 * 171 = 21 June), with the fraction of the day; a leap year's 29 February is left out of the count
 * so that the same number is the same date every year. Not wrapped at the year's end: 365 is the
 * next 1 January.
 */
export function solsticeSeries(n: number, rule: Rule): number[] {
	return driftSeries(n, rule).map((d, k) => {
		const leapShift = isLeap(START_YEAR + k, rule) ? 1 : 0;
		return FIRST_SOLSTICE + d - leapShift;
	});
}
