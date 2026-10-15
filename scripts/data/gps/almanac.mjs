// Builds src/routes/gps/almanac.ts from a GPS almanac in YUMA format.
// Usage: node scripts/data/gps/almanac.mjs <path to current_yuma.alm> <retrieval date YYYY-MM-DD>
// Source: U.S. Coast Guard Navigation Center, current GPS almanac (YUMA format),
// https://www.navcen.uscg.gov/sites/default/files/gps/almanac/current_yuma.alm — a work of the
// U.S. Government, in the public domain. The script keeps every satellite whose health word is
// 000 (healthy), copies its orbital elements and clock terms unchanged, and turns the 10-bit
// week number of the file into the full GPS week (the count rolled over in 1999 and 2019, so
// full week = file week + 2048) and the calendar time of applicability.
import fs from 'node:fs';

const [src, retrieved] = process.argv.slice(2);
if (!src || !retrieved) throw new Error('usage: almanac.mjs <current_yuma.alm> <YYYY-MM-DD>');
const blocks = fs
	.readFileSync(src, 'utf8')
	.split(/\*{8} Week/)
	.slice(1);
const field = (block, name) => {
	const line = block.split('\n').find((l) => l.startsWith(name));
	if (!line) throw new Error(`missing ${name}`);
	return Number(line.slice(line.indexOf(':') + 1).trim());
};
const all = blocks.map((b) => ({
	prn: field(b, 'ID'),
	health: field(b, 'Health'),
	e: field(b, 'Eccentricity'),
	toa: field(b, 'Time of Applicability'),
	i0: field(b, 'Orbital Inclination'),
	omegaDot: field(b, 'Rate of Right Ascen'),
	sqrtA: field(b, 'SQRT(A)'),
	omega0: field(b, 'Right Ascen at Week'),
	w: field(b, 'Argument of Perigee'),
	m0: field(b, 'Mean Anom'),
	af0: field(b, 'Af0'),
	af1: field(b, 'Af1'),
	week: field(b, 'week')
}));
const sats = all.filter((s) => s.health === 0);
const weeks = new Set(sats.map((s) => s.week));
const toas = new Set(sats.map((s) => s.toa));
if (weeks.size !== 1 || toas.size !== 1) throw new Error('mixed weeks or times of applicability');
const week = sats[0].week + 2048;
const toa = sats[0].toa;
// GPS time started at 1980-01-06 00:00:00 UTC; GPS time is ahead of UTC by the leap seconds
// since then (18 s since 2017), which this calendar date leaves out (it is GPS time).
const epoch = new Date(Date.UTC(1980, 0, 6) + (week * 7 * 86400 + toa) * 1000);
const row = (s) =>
	`\t{ prn: ${s.prn}, e: ${s.e}, i0: ${s.i0}, omegaDot: ${s.omegaDot}, sqrtA: ${s.sqrtA}, omega0: ${s.omega0}, w: ${s.w}, m0: ${s.m0}, af0: ${s.af0}, af1: ${s.af1} }`;
const out = `/**
 * The GPS constellation: the current almanac of the U.S. Coast Guard Navigation Center
 * (https://www.navcen.uscg.gov/sites/default/files/gps/almanac/current_yuma.alm, YUMA format,
 * retrieved ${retrieved}), a work of the U.S. Government in the public domain. Kept: the
 * ${sats.length} satellites marked healthy (of ${all.length} in the file), with their elements copied
 * unchanged (scripts/data/gps/almanac.mjs). Units as in the file: radians, radians per second,
 * √metres, seconds. The almanac week ${sats[0].week} is a 10-bit count; the full GPS week is ${week}.
 */
export interface AlmanacEntry {
	/** Pseudo-random noise code number: the satellite's identity in the signal. */
	prn: number;
	/** Eccentricity. */
	e: number;
	/** Inclination of the orbit (rad). */
	i0: number;
	/** Rate of change of the right ascension of the ascending node (rad/s). */
	omegaDot: number;
	/** Square root of the semi-major axis (m^½). */
	sqrtA: number;
	/** Longitude of the ascending node at the start of the GPS week (rad). */
	omega0: number;
	/** Argument of perigee (rad). */
	w: number;
	/** Mean anomaly at the time of applicability (rad). */
	m0: number;
	/** Clock offset (s) and drift (s/s) broadcast for the satellite clock. */
	af0: number;
	af1: number;
}

/** Full GPS week of the almanac. */
export const ALMANAC_WEEK = ${week};
/** Time of applicability, seconds into the GPS week. */
export const ALMANAC_TOA = ${toa};
/** Time of applicability as a calendar date (GPS time). */
export const ALMANAC_DATE = '${epoch.toISOString().replace('.000Z', 'Z')}';
/** Date the file was downloaded. */
export const ALMANAC_RETRIEVED = '${retrieved}';

export const ALMANAC: readonly AlmanacEntry[] = [
${sats.map(row).join(',\n')}
];
`;
fs.writeFileSync('src/routes/gps/almanac.ts', out);
console.log(sats.length, 'satellites, week', week, epoch.toISOString());
