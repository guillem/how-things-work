#!/usr/bin/env node
// Builds the plate-tectonics map data (src/routes/plate-tectonics/data/*.ts) from raw downloads.
// No dependencies. Usage:
//
//   node scripts/data/plate-tectonics/build.mjs <raw-dir>
//
// <raw-dir> must contain (download them there first, outside the repository):
//
//   PB2002_steps.json, PB2002_plates.json
//     https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/<name>
//     Bird (2003), An updated digital model of plate boundaries, G³ 4(3), 1027,
//     doi:10.1029/2001GC000252; GeoJSON conversion by Hugo Ahlenius (Nordpil), ODC-BY 1.0.
//   ne_110m_land.geojson
//     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
//     Natural Earth 1:110m land, public domain.
//   usgs_m55_2015_2024.csv
//     https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=2015-01-01&endtime=2025-01-01&minmagnitude=5.5&eventtype=earthquake&orderby=time-asc
//     USGS ANSS Comprehensive Catalog (ComCat), public domain.
//   gvp_holocene.json
//     https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json
//     Smithsonian Global Volcanism Program, Volcanoes of the World (5.4 series, as cited on GVP's
//     site), doi:10.5479/si.GVP.VOTW5-2026.5.4; terms of use not retrievable (403), cited as asked.
//
// What the script does (all coordinates are degrees, rounded to 0.1°, i.e. ≈ 11 km):
// - boundaries: PB2002's 5,819 digitisation steps, chained into polylines wherever consecutive
//   steps continue each other with the same class (OSR, OTF, CRB, CTF, OCB, CCB, SUB) and the
//   same plate pair, split where they cross the ±180° meridian, then simplified with
//   Douglas–Peucker (tolerance 0.15°). Each polyline keeps its class, its plate pair, its
//   length-weighted mean relative speed and divergent component (mm/yr, from Bird's Euler poles)
//   and, for subduction zones, which side the overriding plate is on (Bird's "/" or "\").
// - plates: for each of the 52 plates, its name, area (km²) and a label point (the planar
//   centroid, in longitude/latitude, of its largest piece).
// - land: Natural Earth's 110 m land polygons, simplified with Douglas–Peucker (0.2°); rings
//   with fewer than 4 points left are dropped.
// - quakes: every M ≥ 5.5 earthquake of 2015–2024 in ComCat (longitude, latitude, depth in km,
//   magnitude ×10, day since 1 January 2015).
// - volcanoes: every Holocene volcano in VOTW (longitude, latitude, tectonic setting:
//   0 subduction zone, 1 rift zone, 2 intraplate, 3 not given), plus a few named ones the page
//   points at.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raw = process.argv[2];
if (!raw) {
	console.error('usage: node scripts/data/plate-tectonics/build.mjs <raw-dir>');
	process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../src/routes/plate-tectonics/data');
mkdirSync(out, { recursive: true });
const read = (name) => JSON.parse(readFileSync(join(raw, name), 'utf8'));
const r1 = (v) => Math.round(v * 10);

// ---------------------------------------------------------------- Douglas–Peucker
function simplify(pts, tol) {
	if (pts.length <= 2) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		let best = -1;
		let bestD = tol;
		for (let i = a + 1; i < b; i++) {
			const [px, py] = pts[i];
			let d;
			if (len2 === 0) d = Math.hypot(px - ax, py - ay);
			else {
				const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
				d = Math.hypot(px - ax - u * dx, py - ay - u * dy);
			}
			if (d > bestD) {
				bestD = d;
				best = i;
			}
		}
		if (best > 0) {
			keep[best] = 1;
			stack.push([a, best], [best, b]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}

const flat = (pts) => pts.flatMap(([x, y]) => [r1(x), r1(y)]);
const dedupe = (arr) => {
	// drop consecutive duplicate points after rounding
	const o = [];
	for (let i = 0; i < arr.length; i += 2) {
		const n = o.length;
		if (n >= 2 && o[n - 2] === arr[i] && o[n - 1] === arr[i + 1]) continue;
		o.push(arr[i], arr[i + 1]);
	}
	return o;
};

// ---------------------------------------------------------------- boundaries
const steps = read('PB2002_steps.json')
	.features.map((f) => f.properties)
	.sort((a, b) => a.SEQNUM - b.SEQNUM);
const lines = [];
let cur = null;
for (const s of steps) {
	const a = [s.STARTLONG, s.STARTLAT];
	const b = [s.FINALLONG, s.FINALLAT];
	const crosses = Math.abs(b[0] - a[0]) > 180;
	const cont =
		cur &&
		cur.name === s.PLATEBOUND &&
		cur.group === group(s.STEPCLASS) &&
		Math.abs(cur.pts.at(-1)[0] - a[0]) < 1e-6 &&
		Math.abs(cur.pts.at(-1)[1] - a[1]) < 1e-6 &&
		!crosses;
	if (crosses) {
		// Split at the antimeridian: interpolate the crossing latitude.
		const bx = b[0] + (b[0] < a[0] ? 360 : -360);
		const edge = a[0] > 0 ? 180 : -180;
		const u = (edge - a[0]) / (bx - a[0]);
		const lat = a[1] + u * (b[1] - a[1]);
		const joins =
			cur &&
			cur.name === s.PLATEBOUND &&
			cur.group === group(s.STEPCLASS) &&
			Math.abs(cur.pts.at(-1)[0] - a[0]) < 1e-6 &&
			Math.abs(cur.pts.at(-1)[1] - a[1]) < 1e-6;
		if (joins) cur.pts.push([edge, lat]);
		else {
			cur = newLine(s, [a, [edge, lat]]);
			lines.push(cur);
		}
		accumulate(cur, s, 0.5);
		cur = newLine(s, [[-edge, lat], b]);
		lines.push(cur);
		accumulate(cur, s, 0.5);
		continue;
	}
	if (cont) cur.pts.push(b);
	else {
		cur = newLine(s, [a, b]);
		lines.push(cur);
	}
	accumulate(cur, s, 1);
}
// Ridge-transform zigzags alternate classes every few steps; chain by group, and keep each
// line's class as the one covering most of its length.
function group(cls) {
	return { OSR: 'R', CRB: 'R', OTF: 'T', CTF: 'T', SUB: 'S', OCB: 'C', CCB: 'C' }[cls];
}
function newLine(s, pts) {
	const name = s.PLATEBOUND;
	// Bird: "/" the right-hand plate subducts under the left-hand plate (overriding plate on the
	// left of the direction of travel), "\" the opposite.
	const side = name[2] === '/' ? 1 : name[2] === '\\' ? -1 : 0;
	return { name, group: group(s.STEPCLASS), byCls: {}, side, pts, len: 0, v: 0, div: 0 };
}
function accumulate(line, s, f) {
	const l = s.STEPLENGTH * f;
	line.len += l;
	line.byCls[s.STEPCLASS] = (line.byCls[s.STEPCLASS] ?? 0) + l;
	line.v += s.VELOCITYLE * l;
	line.div += s.VELOCITYDI * l;
}
const boundaries = lines.map((l) => [
	l.name,
	Object.entries(l.byCls).sort((a, b) => b[1] - a[1])[0][0],
	l.side,
	Math.round(l.len),
	Math.round((l.v / l.len) * 10) / 10,
	Math.round((l.div / l.len) * 10) / 10,
	dedupe(flat(simplify(l.pts, 0.15)))
]);

// ---------------------------------------------------------------- plates
const R = 6371;
const rad = Math.PI / 180;
function ringArea(ring) {
	let s = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [l1, p1] = ring[i];
		const [l2, p2] = ring[i + 1];
		s += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad));
	}
	return Math.abs((s * R * R) / 2);
}
function centroid(ring) {
	let a = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[i + 1];
		const c = x1 * y2 - x2 * y1;
		a += c;
		cx += (x1 + x2) * c;
		cy += (y1 + y2) * c;
	}
	return [cx / (3 * a), cy / (3 * a)];
}
const plateMap = new Map();
for (const f of read('PB2002_plates.json').features) {
	const { Code: code, PlateName: name } = f.properties;
	const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
	for (const poly of polys) {
		const ring = poly[0];
		const area = ringArea(ring);
		const p = plateMap.get(code) ?? { code, name, area: 0, best: 0, at: [0, 0] };
		p.area += area;
		if (area > p.best) {
			p.best = area;
			p.at = centroid(ring);
		}
		plateMap.set(code, p);
	}
}
const plates = [...plateMap.values()]
	.sort((a, b) => b.area - a.area)
	.map((p) => ({
		code: p.code,
		name: p.name,
		km2: Math.round(p.area / 1000) * 1000,
		at: p.at.map(r1)
	}));

// ---------------------------------------------------------------- land
const land = [];
for (const f of read('ne_110m_land.geojson').features) {
	const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
	for (const poly of polys) {
		const ring = dedupe(flat(simplify(poly[0], 0.2)));
		if (ring.length >= 8) land.push(ring);
	}
}

// ---------------------------------------------------------------- quakes
function parseCsv(text) {
	const rows = [];
	for (const line of text.trim().split('\n')) {
		const cells = [];
		let cell = '';
		let q = false;
		for (const ch of line) {
			if (ch === '"') q = !q;
			else if (ch === ',' && !q) {
				cells.push(cell);
				cell = '';
			} else cell += ch;
		}
		cells.push(cell);
		rows.push(cells);
	}
	return rows;
}
const [head, ...rows] = parseCsv(readFileSync(join(raw, 'usgs_m55_2015_2024.csv'), 'utf8'));
const col = (n) => head.indexOf(n);
const t0 = Date.UTC(2015, 0, 1);
const quakes = [];
for (const r of rows) {
	const day = Math.floor((Date.parse(r[col('time')]) - t0) / 86400000);
	quakes.push(
		r1(+r[col('longitude')]),
		r1(+r[col('latitude')]),
		Math.round(+r[col('depth')]),
		Math.round(+r[col('mag')] * 10),
		day
	);
}

// ---------------------------------------------------------------- volcanoes
const settingCode = (s) =>
	!s
		? 3
		: s.startsWith('Subduction')
			? 0
			: s.startsWith('Rift')
				? 1
				: s.startsWith('Intraplate')
					? 2
					: 3;
const volcanoes = [];
const named = [];
const wanted = [
	'Kilauea',
	'Mauna Loa',
	'Fournaise, Piton de la',
	'Erebus',
	'Fujisan',
	'St. Helens',
	'Lengai, Ol Doinyo',
	'Hekla',
	'Etna'
];
for (const f of read('gvp_holocene.json').features.sort(
	(a, b) => a.properties.Volcano_Number - b.properties.Volcano_Number
)) {
	const p = f.properties;
	volcanoes.push(r1(p.Longitude), r1(p.Latitude), settingCode(p.Tectonic_Setting));
	if (wanted.includes(p.Volcano_Name))
		named.push({
			name: p.Volcano_Name,
			at: [r1(p.Longitude), r1(p.Latitude)],
			setting: p.Tectonic_Setting
		});
}

// ---------------------------------------------------------------- write
const header = (
	what
) => `// Generated by scripts/data/plate-tectonics/build.mjs — do not edit by hand.
// ${what}
// Coordinates are in tenths of a degree (longitude, latitude).
`;
const json = (v) => JSON.stringify(v);
writeFileSync(
	join(out, 'world.ts'),
	header(
		`Plate boundaries and plates: Bird (2003), An updated digital model of plate boundaries,
// Geochemistry, Geophysics, Geosystems 4(3), 1027, doi:10.1029/2001GC000252, model PB2002, via the
// GeoJSON of https://github.com/fraxen/tectonicplates (Hugo Ahlenius, Nordpil, and Peter Bird;
// Open Data Commons Attribution License 1.0). Land: Natural Earth 1:110m land (public domain),
// https://www.naturalearthdata.com. Simplified with Douglas–Peucker (boundaries 0.15°, land 0.2°);
// see the script for the details.`
	) +
		`
/** Bird's step classes: OSR oceanic spreading ridge, CRB continental rift, OTF/CTF oceanic and
 * continental transform faults, SUB subduction zone, OCB/CCB oceanic and continental convergent
 * boundaries (no subduction). */
export type BoundaryClass = 'OSR' | 'CRB' | 'OTF' | 'CTF' | 'SUB' | 'OCB' | 'CCB';

/**
 * One boundary polyline: [plate pair (Bird's identifiers, e.g. "NZ\\\\SA"), class, overriding
 * side (subduction zones: +1 the overriding plate is on the left of the line's direction, -1 on
 * the right; 0 otherwise), length km, mean relative speed of the two plates mm/yr, its divergent
 * component mm/yr (negative: converging), flat [lon, lat, …] in tenths of a degree].
 */
export type Boundary = [string, BoundaryClass, number, number, number, number, number[]];

export interface Plate {
	code: string;
	name: string;
	km2: number;
	/** Label point, tenths of a degree. */
	at: [number, number];
}

export const BOUNDARIES: Boundary[] = ${json(boundaries)};

/** The 52 plates of PB2002, largest first. */
export const PLATES: Plate[] = ${json(plates)};

/** Land polygons (outer rings), flat [lon, lat, …] in tenths of a degree. */
export const LAND: number[][] = ${json(land)};
`
);
writeFileSync(
	join(out, 'quakes.ts'),
	header(
		`Earthquakes: every M ≥ 5.5 earthquake from 1 January 2015 to 31 December 2024 in the USGS ANSS
// Comprehensive Catalog (ComCat), public domain. Query:
// https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=2015-01-01&endtime=2025-01-01&minmagnitude=5.5&eventtype=earthquake&orderby=time-asc
// Downloaded 14 October 2026.`
	) +
		`
/** Flat records of 5: [lon ×10, lat ×10, depth km, magnitude ×10, day since 2015-01-01], in time order. */
export const QUAKES: number[] = ${json(quakes)};
`
);
writeFileSync(
	join(out, 'volcanoes.ts'),
	header(
		`Volcanoes: every Holocene volcano (active in the last ~11,700 years) in the Smithsonian Global
// Volcanism Program's Volcanoes of the World database, the release served by the GVP GeoServer on
// 14 October 2026 (GVP's site cites the 5.4 series, doi:10.5479/si.GVP.VOTW5-2026.5.4; the exact
// patch version could not be read). Licence: GVP's terms of use could not be retrieved (the site
// returns 403 to scripted requests); the data are cited as GVP asks. Downloaded from:
// https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json
// Only position and VOTW's tectonic setting are kept.`
	) +
		`
/** Flat records of 3: [lon ×10, lat ×10, setting], setting 0 subduction zone, 1 rift zone, 2 intraplate, 3 not given. */
export const VOLCANOES: number[] = ${json(volcanoes)};

/** A few volcanoes the page names, with VOTW's tectonic setting. */
export const NAMED_VOLCANOES: { name: string; at: [number, number]; setting: string }[] = ${json(named)};
`
);
console.log(
	`boundaries ${boundaries.length} lines, ${boundaries.reduce((s, b) => s + b[6].length / 2, 0)} pts; plates ${plates.length}; land ${land.length} rings, ${land.reduce((s, r) => s + r.length / 2, 0)} pts; quakes ${quakes.length / 5}; volcanoes ${volcanoes.length / 3}; named ${named.map((n) => n.name)}`
);
