#!/usr/bin/env node
// Downloads the raw data of the tsunamis explainer into <raw-dir> (outside the repository).
// No dependencies (Node 18+ fetch). Usage:
//
//   node scripts/data/tsunamis/fetch.mjs <raw-dir>
//   node scripts/data/tsunamis/build.mjs <raw-dir>
//
// What it downloads:
// - etopo-<i0>-<j0>.txt: strips of ETOPO 2022 v1, 60 arc-second surface elevation
//   (NOAA NCEI, doi:10.25921/fd45-gt74; US government work, public domain), through NCEI's
//   OPeNDAP server, covering the great circle of track.mjs (each 1° of longitude, the rows
//   within 0.1° of the track, one extra column each side):
//   https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc
// - dart-<station>.txt.gz: NDBC's historical DART files for 2011 (water-column height, m;
//   public domain): https://www.ndbc.noaa.gov/data/historical/dart/<station>t2011.txt.gz
// - cc-water.csv, cc-tide.csv: NOAA CO-OPS station 9419750 (Crescent City, CA), the observed
//   one-minute water level and the predicted tide, 11–12 March 2011, GMT, metres above MLLW
//   (public domain): https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DX_KM, FROM_KM, TO_KM, at } from './track.mjs';

const raw = process.argv[2];
if (!raw) {
	console.error('usage: node scripts/data/tsunamis/fetch.mjs <raw-dir>');
	process.exit(1);
}
mkdirSync(raw, { recursive: true });

async function get(url, file, binary = false) {
	const path = join(raw, file);
	if (existsSync(path)) return;
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status} ${url}`);
			const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
			writeFileSync(path, body);
			console.log('saved', file);
			return;
		} catch (e) {
			console.warn('retry', file, String(e));
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
	throw new Error(`could not download ${url}`);
}

// ---------------------------------------------------------------- ETOPO 2022 strips
const ETOPO =
	'https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc';
/** Row and column of the cell whose centre is just below/left of (lat, lon). */
const row = (lat) => Math.floor((lat + 90) * 60 - 0.5);
const col = (lon) => Math.floor((lon + 180) * 60 - 0.5);
const bins = new Map();
for (let km = FROM_KM; km <= TO_KM; km += DX_KM / 4) {
	const p = at(km);
	const b = Math.floor(p.lon);
	const e = bins.get(b) ?? { lo: 90, hi: -90 };
	e.lo = Math.min(e.lo, p.lat);
	e.hi = Math.max(e.hi, p.lat);
	bins.set(b, e);
}
for (const [b, e] of [...bins].sort((x, y) => x[0] - y[0])) {
	const i0 = row(e.lo - 0.1);
	const i1 = row(e.hi + 0.1) + 1;
	const j0 = Math.max(0, col(b) - 1);
	const j1 = Math.min(21599, col(b + 1) + 1);
	await get(`${ETOPO}.ascii?z[${i0}:1:${i1}][${j0}:1:${j1}]`, `etopo-${i0}-${j0}.txt`);
}

// ---------------------------------------------------------------- DART buoys
for (const s of ['21401', '21419', '46402']) {
	await get(
		`https://www.ndbc.noaa.gov/data/historical/dart/${s}t2011.txt.gz`,
		`dart-${s}.txt.gz`,
		true
	);
}

// ---------------------------------------------------------------- Crescent City
const coops = (product, extra) =>
	`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=${product}&station=9419750&begin_date=20110311%2005:00&end_date=20110312%2005:00&datum=MLLW&units=metric&time_zone=gmt&format=csv&application=how-things-work${extra}`;
await get(coops('one_minute_water_level', ''), 'cc-water.csv');
await get(coops('predictions', '&interval=1'), 'cc-tide.csv');
