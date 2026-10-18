#!/usr/bin/env node
// Builds the tsunamis explainer's data (src/routes/tsunamis/data.ts) from the raw downloads of
// fetch.mjs (see there for the sources and licences). No dependencies. Usage:
//
//   node scripts/data/tsunamis/build.mjs <raw-dir>
//
// What the script does:
// - profile: the sea floor along the great circle through the Tōhoku epicentre and Crescent
//   City (track.mjs), every 2 km, bilinear in ETOPO 2022 (60″ surface elevation, metres,
//   relative to mean sea level). The profile is cut at the first land cell on each side of the
//   ocean (the Japanese coast near Oshika and the Californian coast at Crescent City), and the
//   depths are rounded to the metre. Mid-ocean, the track passes south of the Aleutians; any
//   cell above sea level there is reported (there is none).
// - DART records: for each buoy, the water-column height (m) from 05:46 to 16:00 GMT on
//   11 March 2011, every minute (the 15 s event-mode samples averaged into minutes where there
//   are any, the 1-minute samples otherwise), with the tide removed (a quadratic fitted to the
//   hour before the tsunami's expected arrival, extended forwards; good for a few hours) and the
//   first arrival picked as the first minute after the seismic shaking (05:46–06:20 masked)
//   where the detided height leaves the noise band (four times the standard deviation of the
//   fitting hour, and at least 2 cm) and keeps going for 3 more minutes.
// - Crescent City: the observed one-minute water level minus the predicted tide (CO-OPS), from
//   05:46 GMT for 24 h, and the first arrival picked the same way (noise band from the two hours
//   before 14:30, at least 5 cm).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CC_KM, CRESCENT_CITY, DX_KM, FROM_KM, TO_KM, at, project } from './track.mjs';

const raw = process.argv[2];
if (!raw) {
	console.error('usage: node scripts/data/tsunamis/build.mjs <raw-dir>');
	process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '../../../src/routes/tsunamis/data.ts');

// ---------------------------------------------------------------- the profile
const cells = new Map();
for (const f of readdirSync(raw).filter((n) => n.startsWith('etopo-'))) {
	const [, i0, j0] = f.match(/etopo-(\d+)-(\d+)\.txt/).map(Number);
	const text = readFileSync(join(raw, f), 'utf8');
	const body = text.split('z.z[')[1].split('z.lat')[0];
	for (const line of body.split('\n').slice(1)) {
		const m = line.match(/^\[(\d+)\],(.*)$/);
		if (!m) continue;
		const vals = m[2].split(',').map(Number);
		vals.forEach((v, k) => cells.set((i0 + Number(m[1])) * 21600 + j0 + k, v));
	}
}
const cell = (i, j) => {
	const v = cells.get(i * 21600 + ((j + 21600) % 21600));
	if (v === undefined) throw new Error(`missing cell ${i} ${j}`);
	return v;
};
function elevation({ lat, lon }) {
	const y = (lat + 90) * 60 - 0.5;
	const x = (lon + 180) * 60 - 0.5;
	const i = Math.floor(y);
	const j = Math.floor(x);
	const fy = y - i;
	const fx = x - j;
	return (
		cell(i, j) * (1 - fx) * (1 - fy) +
		cell(i, j + 1) * fx * (1 - fy) +
		cell(i + 1, j) * (1 - fx) * fy +
		cell(i + 1, j + 1) * fx * fy
	);
}
const samples = [];
for (let km = FROM_KM; km <= TO_KM; km += DX_KM) samples.push({ km, z: elevation(at(km)) });
// the ocean: from the last land sample west of the epicentre to the first one east of it
const e0 = samples.findIndex((s) => s.km === 0);
let w = e0;
while (w > 0 && samples[w - 1].z < 0) w--;
let east = e0;
while (east < samples.length - 1 && samples[east + 1].z < 0) east++;
const ocean = samples.slice(w, east + 1);
const depth = ocean.map((s) => Math.max(0, Math.round(-s.z)));
const startKm = ocean[0].km;
console.log(
	`profile: ${depth.length} samples from ${startKm} km to ${ocean.at(-1).km} km (coast ${at(startKm).lat.toFixed(3)}, ${at(startKm).lon.toFixed(3)} to ${at(ocean.at(-1).km).lat.toFixed(3)}, ${at(ocean.at(-1).km).lon.toFixed(3)}); Crescent City gauge at ${CC_KM.toFixed(1)} km`
);
const deepest = depth.reduce((b, d, i) => (d > depth[b] ? i : b), 0);
console.log(`deepest ${depth[deepest]} m at ${startKm + deepest * DX_KM} km`);
const shallowMid = depth
	.map((d, i) => ({ d, km: startKm + i * DX_KM }))
	.filter((s) => s.d < 1000 && s.km > 200 && s.km < 7300);
console.log(
	'shallower than 1000 m mid-ocean:',
	shallowMid.length
		? `${shallowMid.length} samples, min ${Math.min(...shallowMid.map((s) => s.d))}`
		: 'none'
);
const mean = depth.reduce((a, b) => a + b, 0) / depth.length;
console.log(`mean depth ${mean.toFixed(0)} m`);

// ---------------------------------------------------------------- tide-gauge picking
const ORIGIN = Date.UTC(2011, 2, 11, 5, 46, 24);
const minutesAfter = (ms) => (ms - ORIGIN) / 60000;

/** Least-squares quadratic through (x, y). */
function quadFit(xs, ys) {
	const n = xs.length;
	const x0 = xs.reduce((a, b) => a + b, 0) / n;
	let s = [0, 0, 0, 0, 0];
	let t = [0, 0, 0];
	for (let k = 0; k < n; k++) {
		const x = xs[k] - x0;
		for (let p = 0; p < 5; p++) s[p] += x ** p;
		for (let p = 0; p < 3; p++) t[p] += ys[k] * x ** p;
	}
	const A = [
		[s[0], s[1], s[2], t[0]],
		[s[1], s[2], s[3], t[1]],
		[s[2], s[3], s[4], t[2]]
	];
	for (let c = 0; c < 3; c++) {
		for (let r = c + 1; r < 3; r++) {
			const f = A[r][c] / A[c][c];
			for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
		}
	}
	const b = [0, 0, 0];
	for (let r = 2; r >= 0; r--) {
		let v = A[r][3];
		for (let k = r + 1; k < 3; k++) v -= A[r][k] * b[k];
		b[r] = v / A[r][r];
	}
	return (x) => b[0] + b[1] * (x - x0) + b[2] * (x - x0) ** 2;
}

/** First arrival in a detided minute series: [minute, value][]; noise from the fit window. */
function pick(series, from, minBand) {
	const noise = series.filter(([m]) => m >= from - 60 && m < from).map(([, v]) => v);
	const sd = Math.sqrt(noise.reduce((a, v) => a + v * v, 0) / noise.length);
	const band = Math.max(4 * sd, minBand);
	for (let k = 0; k + 3 < series.length; k++) {
		const [m, v] = series[k];
		if (m < from) continue;
		if (
			series.slice(k, k + 4).every(([, u]) => Math.sign(u) === Math.sign(v) && Math.abs(u) > band)
		)
			return { minute: m, sign: Math.sign(v), band };
	}
	return null;
}

function dart(id, window) {
	const text = gunzipSync(readFileSync(join(raw, `dart-${id}.txt.gz`))).toString('utf8');
	const byMinute = new Map();
	for (const line of text.split('\n')) {
		const f = line.trim().split(/\s+/);
		if (f.length < 8 || line.startsWith('#')) continue;
		const [y, mo, d, h, mi, s, type, height] = f.map(Number);
		if (height > 9000) continue;
		const ms = Date.UTC(y, mo - 1, d, h, mi, s);
		const m = Math.floor(minutesAfter(ms));
		if (m < -10 || m > 620) continue;
		const e = byMinute.get(m) ?? { one: null, fast: [] };
		if (type === 2) e.one = height;
		if (type === 3) e.fast.push(height);
		byMinute.set(m, e);
	}
	const series = [...byMinute]
		.map(([m, e]) => [m, e.fast.length ? e.fast.reduce((a, b) => a + b, 0) / e.fast.length : e.one])
		.filter(([, v]) => v !== null)
		.sort((a, b) => a[0] - b[0]);
	// fit the hour before the window opens, outside the seismic shaking
	const fitPts = series.filter(([m]) => m >= window - 60 && m < window && (m < 0 || m > 34));
	const tide = quadFit(
		fitPts.map(([m]) => m),
		fitPts.map(([, v]) => v)
	);
	const detided = series.map(([m, v]) => [m, v - tide(m)]);
	return { detided, arrival: pick(detided, window, 0.02) };
}

function crescentCity() {
	const rows = (f) =>
		readFileSync(join(raw, f), 'utf8')
			.trim()
			.split('\n')
			.slice(1)
			.map((l) => {
				const [d, v] = l.split(',');
				return [minutesAfter(Date.parse(d.replace(' ', 'T') + ':00Z')), Number(v)];
			});
	const tide = new Map(rows('cc-tide.csv').map(([m, v]) => [Math.round(m * 60), v]));
	const series = rows('cc-water.csv')
		.filter(([, v]) => Number.isFinite(v))
		.map(([m, v]) => [m, v - tide.get(Math.round(m * 60))])
		.filter(([, v]) => Number.isFinite(v));
	return { series, arrival: pick(series, 520, 0.05) };
}

// ---------------------------------------------------------------- the stations
const BUOYS = [
	{
		id: '21401',
		name: 'DART 21401',
		place: 'off the Kuril Islands',
		lat: 42.617,
		lon: 152.583,
		window: 50
	},
	{
		id: '21419',
		name: 'DART 21419',
		place: 'off the Kuril Islands',
		lat: 44.455,
		lon: 155.736,
		window: 75
	},
	{
		id: '46402',
		name: 'DART 46402',
		place: 'south of the Aleutians',
		lat: 51.067,
		lon: -164.0,
		window: 290
	}
];
const cm = (v) => Math.round(v * 100);
const stations = [];
for (const b of BUOYS) {
	const { detided, arrival } = dart(b.id, b.window);
	if (!arrival) throw new Error(`no arrival at ${b.id}`);
	const crest = detided
		.filter(([m]) => m >= arrival.minute && m <= arrival.minute + 30)
		.reduce((best, p) => (p[1] > best[1] ? p : best));
	const { along, off } = project(b);
	const from = arrival.minute - 20;
	const rec = detided.filter(([m]) => m >= from && m < from + 120);
	stations.push({
		id: b.id,
		name: b.name,
		place: b.place,
		kind: 'buoy',
		km: Math.round(along),
		offKm: Math.round(Math.abs(off)),
		onsetMin: arrival.minute,
		crestMin: crest[0],
		crestCm: cm(crest[1]),
		from,
		record: rec.map(([, v]) => cm(v))
	});
	console.log(b.id, Math.round(along), Math.round(off), arrival.minute, crest[0], cm(crest[1]));
}
{
	const { series, arrival } = crescentCity();
	if (!arrival) throw new Error('no arrival at Crescent City');
	const crest = series
		.filter(([m]) => m >= arrival.minute && m <= arrival.minute + 20)
		.reduce((best, p) => (p[1] > best[1] ? p : best));
	const biggest = series.reduce((best, p) => (p[1] > best[1] ? p : best));
	const from = 540;
	const rec = series.filter(([m]) => m >= from && m < from + 420);
	const { along, off } = project(CRESCENT_CITY);
	stations.push({
		id: '9419750',
		name: 'Crescent City',
		place: 'tide gauge, California',
		kind: 'gauge',
		km: Math.round(along),
		offKm: Math.round(Math.abs(off)),
		onsetMin: Math.round(arrival.minute),
		crestMin: Math.round(crest[0]),
		crestCm: cm(crest[1]),
		biggestMin: Math.round(biggest[0]),
		biggestCm: cm(biggest[1]),
		from,
		record: rec.map(([, v]) => cm(v))
	});
	console.log('CC', arrival.minute, crest, biggest);
}

// ---------------------------------------------------------------- write
const wrap = (arr, per = 24) => {
	const out = [];
	for (let k = 0; k < arr.length; k += per) out.push('\t' + arr.slice(k, k + per).join(', ') + ',');
	return out.join('\n');
};
const ts = `// Generated by scripts/data/tsunamis/build.mjs from ETOPO 2022 (NOAA NCEI, public domain), NDBC's
// DART records and NOAA CO-OPS's Crescent City tide gauge (public domain). Do not edit by hand.

/** Distance along the track of the first depth sample, km from the Tōhoku epicentre. */
export const START_KM = ${startKm};
/** Spacing of the depth samples, km. */
export const DX_KM = ${DX_KM};
/** Great-circle distance from the epicentre to the Crescent City tide gauge, km. */
export const GAUGE_KM = ${CC_KM.toFixed(1)};

/**
 * Depth of the sea floor below mean sea level, m, every DX_KM along the great circle through the
 * 2011 Tōhoku epicentre (38.297° N, 142.373° E) and Crescent City (41.745° N, 124.184° W), from the
 * Japanese coast (${at(startKm).lat.toFixed(2)}° N, ${at(startKm).lon.toFixed(2)}° E) to the Californian one. ETOPO 2022 v1, 60″.
 */
export const DEPTH: readonly number[] = [
${wrap(depth)}
];

export interface Station {
	id: string;
	name: string;
	place: string;
	kind: 'buoy' | 'gauge';
	/** Distance along the track from the epicentre, and from the track, km. */
	km: number;
	offKm: number;
	/** Observed first arrival and first crest, minutes after the earthquake (05:46:24 GMT). */
	onsetMin: number;
	crestMin: number;
	/** Height of the first crest, cm (detided). */
	crestCm: number;
	/** The largest wave of the record (the gauge only). */
	biggestMin?: number;
	biggestCm?: number;
	/** The record, one value a minute from minute \`from\`, cm, with the tide removed. */
	from: number;
	record: readonly number[];
}

/** Real recordings of the 2011 tsunami along the track, in order of distance. */
export const STATIONS: readonly Station[] = ${JSON.stringify(stations, null, '\t')};
`;
writeFileSync(outFile, ts);
console.log('wrote', outFile);
