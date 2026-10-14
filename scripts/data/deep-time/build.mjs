#!/usr/bin/env node
// Builds the continents of the deep-time explainer (src/routes/deep-time/data/continents.ts) from
// the Merdith et al. (2021) plate model. No dependencies. Usage:
//
//   node scripts/data/deep-time/build.mjs <raw-dir>
//
// <raw-dir> must contain, unzipped (download them there first, outside the repository):
//
//   Coastlines/shapes_coastlines_Merdith_et_al_v2.gpmlz
//     https://repo.gplates.org/webdav/pmm/merdith2021/Coastlines.zip
//   Rotations/1000_0_rotfile_Merdith_etal.rot
//     https://repo.gplates.org/webdav/pmm/merdith2021/Rotations.zip
//
//   Merdith, A.S., Williams, S.E., Collins, A.S., et al. (2021), Extending full-plate tectonic
//   models into deep time: Linking the Neoproterozoic and the Phanerozoic, Earth-Science Reviews
//   214, 103477, doi:10.1016/j.earscirev.2020.103477. Model files: Zenodo record 12525525
//   (version 2024-07-18, as served by the GPlates Web Service), CC BY 4.0.
//
// What the script does:
// - coastlines: the exterior ring of every polygon in the coastline file, with its plate id and
//   its valid time (the feature exists from FROMAGE until TOAGE, in Ma). Rings are simplified
//   with Douglas–Peucker (tolerance TOL degrees, in present-day coordinates) and rings smaller
//   than MIN_AREA km² are dropped. Coordinates are kept in present-day position, in tenths of a
//   degree.
// - rotations: the reconstruction tree of the rotation file, evaluated the way GPlates does it:
//   for a plate at time t, the first sequence of the plate (in file order) whose time range
//   contains t gives its finite rotation relative to its fixed plate, interpolated between the
//   two samples around t by spherical linear interpolation of unit quaternions; the plate's total
//   rotation is the fixed plate's total rotation composed with it, down to the anchor plate 000.
//   The total rotation of every plate that carries a kept ring is written, as a unit quaternion
//   ×10³, every STEP Myr from 0 to 1000 Ma. The page interpolates between those samples.
// Checked against the GPlates Web Service (gws.gplates.org/reconstruct/coastlines, model
// MERDITH2021) at 100, 300, 600 and 900 Ma: see e2e/deep-time-model.e2e.ts for the checks that
// run on the committed data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const raw = process.argv[2];
if (!raw) {
	console.error('usage: node scripts/data/deep-time/build.mjs <raw-dir>');
	process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../../src/routes/deep-time/data');
mkdirSync(out, { recursive: true });

const TOL = 0.45;
const MIN_AREA = 100000;
const STEP = 10;
const MAX_AGE = 1000;

// ---------------------------------------------------------------- quaternions [w, x, y, z]
const D2R = Math.PI / 180;
export function fromPole(lat, lon, angle) {
	const la = lat * D2R;
	const lo = lon * D2R;
	const h = (angle * D2R) / 2;
	const s = Math.sin(h);
	return [
		Math.cos(h),
		Math.cos(la) * Math.cos(lo) * s,
		Math.cos(la) * Math.sin(lo) * s,
		Math.sin(la) * s
	];
}
const mul = (a, b) => [
	a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
	a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
	a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
	a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
];
function slerp(a, b, u) {
	let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	if (d < 0) {
		b = b.map((v) => -v);
		d = -d;
	}
	if (d > 0.9999995) return a.map((v, i) => v + (b[i] - v) * u);
	const th = Math.acos(Math.min(1, d));
	const s = Math.sin(th);
	const ka = Math.sin((1 - u) * th) / s;
	const kb = Math.sin(u * th) / s;
	return a.map((v, i) => v * ka + b[i] * kb);
}
const norm = (q) => {
	const n = Math.hypot(...q);
	return q.map((v) => v / n);
};

// ---------------------------------------------------------------- rotation file
const rotText = readFileSync(join(raw, 'Rotations/1000_0_rotfile_Merdith_etal.rot'), 'utf8');
/** moving plate → list of sequences { fixed, samples: [time, q][] } in file order */
const sequences = new Map();
let last = null;
for (const line of rotText.split('\n')) {
	const m = line.trim().split(/\s+/);
	if (m.length < 6) continue;
	const [moving, time, lat, lon, angle, fixed] = m.slice(0, 6).map(Number);
	if (![moving, time, lat, lon, angle, fixed].every(Number.isFinite)) continue;
	if (moving === 999) continue; // comment lines
	if (!last || last.moving !== moving || last.fixed !== fixed) {
		last = { moving, fixed, samples: [] };
		if (!sequences.has(moving)) sequences.set(moving, []);
		sequences.get(moving).push(last);
	}
	last.samples.push([time, fromPole(lat, lon, angle)]);
}

const memo = new Map();
export function totalRotation(plate, t, depth = 0) {
	if (plate === 0 || depth > 40) return [1, 0, 0, 0];
	const key = `${plate}@${t}`;
	if (memo.has(key)) return memo.get(key);
	let q = null;
	for (const s of sequences.get(plate) ?? []) {
		const ss = s.samples;
		if (t < ss[0][0] || t > ss[ss.length - 1][0]) continue;
		let i = 1;
		while (i < ss.length - 1 && ss[i][0] < t) i++;
		const [t0, q0] = ss[i - 1];
		const [t1, q1] = ss[i];
		const rel = t1 === t0 ? q1 : slerp(q0, q1, (t - t0) / (t1 - t0));
		q = norm(mul(totalRotation(s.fixed, t, depth + 1), rel));
		break;
	}
	q ??= [1, 0, 0, 0];
	memo.set(key, q);
	return q;
}

export function rotatePoint(q, lon, lat) {
	const la = lat * D2R;
	const lo = lon * D2R;
	const p = [0, Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
	const r = mul(mul(q, p), [q[0], -q[1], -q[2], -q[3]]);
	return [Math.atan2(r[2], r[1]) / D2R, Math.asin(Math.max(-1, Math.min(1, r[3]))) / D2R];
}

// ---------------------------------------------------------------- coastlines
const gpml = gunzipSync(
	readFileSync(join(raw, 'Coastlines/shapes_coastlines_Merdith_et_al_v2.gpmlz'))
).toString('utf8');
const features = [];
for (const chunk of gpml.split('<gml:featureMember>').slice(1)) {
	const pid = Number(
		/<gpml:reconstructionPlateId>[\s\S]*?<gpml:value>(\d+)<\/gpml:value>/.exec(chunk)?.[1]
	);
	const valid = /<gml:validTime>([\s\S]*?)<\/gml:validTime>/.exec(chunk)?.[1] ?? '';
	const times = [...valid.matchAll(/<gml:timePosition[^>]*>([^<]+)<\/gml:timePosition>/g)].map(
		(m) =>
			/distantPast/i.test(m[1]) ? Infinity : /distantFuture/i.test(m[1]) ? -Infinity : Number(m[1])
	);
	const from = times[0] ?? Infinity;
	const to = times[1] ?? 0;
	// exterior rings only (holes are lakes and inland seas, too small to matter at this scale)
	for (const ext of chunk.matchAll(
		/<gml:exterior>[\s\S]*?<gml:posList[^>]*>([^<]+)<\/gml:posList>/g
	)) {
		const v = ext[1].trim().split(/\s+/).map(Number);
		const ring = [];
		for (let i = 0; i + 1 < v.length; i += 2) ring.push([v[i + 1], v[i]]); // GML is lat lon
		features.push({ pid, from, to, ring });
	}
}

function simplify(pts, tol) {
	if (pts.length <= 3) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 1e-12;
		let best = -1;
		let bi = -1;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
			if (d > best) {
				best = d;
				bi = i;
			}
		}
		if (best > tol) {
			keep[bi] = 1;
			stack.push([a, bi], [bi, b]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}

/** Area of a ring on the sphere, km² (planar shoelace in a cos(lat)-scaled frame). */
export function ringArea(ring) {
	const R = 6371;
	let s = 0;
	for (let i = 0; i < ring.length; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[(i + 1) % ring.length];
		let dx = x2 - x1;
		if (dx > 180) dx -= 360;
		if (dx < -180) dx += 360;
		s += dx * D2R * (Math.sin(y1 * D2R) + Math.sin(y2 * D2R));
	}
	return Math.abs((s / 2) * R * R);
}

const kept = [];
let totalArea = 0;
for (const f of features) {
	const area = ringArea(f.ring);
	totalArea += area;
	if (area < MIN_AREA) continue;
	if (f.to > 0) continue; // only rings that survive to the present (none end earlier here)
	// a closed ring: simplify its two halves, split at the vertex farthest from the first
	const r = f.ring;
	let far = 1;
	for (let i = 1; i < r.length; i++)
		if (
			Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]) >
			Math.hypot(r[far][0] - r[0][0], r[far][1] - r[0][1])
		)
			far = i;
	const s = [
		...simplify(r.slice(0, far + 1), TOL).slice(0, -1),
		...simplify(r.slice(far), TOL)
	].slice(0, -1);
	if (s.length < 4) continue;
	kept.push({ ...f, area, ring: s });
}
const plates = [...new Set(kept.map((f) => f.pid))].sort((a, b) => a - b);
const times = [];
for (let t = 0; t <= MAX_AGE; t += STEP) times.push(t);

const r1 = (v) => Math.round(v * 10);
// each plate's samples stop at the first one at or beyond the age of its oldest ring
const oldest = plates.map((p) => Math.max(...kept.filter((f) => f.pid === p).map((f) => f.from)));
const quats = plates.map((p, k) =>
	times
		.filter((t) => t - STEP < oldest[k])
		.flatMap((t) => {
			const q = totalRotation(p, t);
			const s = q[0] < 0 ? -1 : 1; // keep w ≥ 0 so that neighbouring samples interpolate the short way
			return q.map((v) => Math.round(v * s * 1e3));
		})
);
// plates that move together share one series (a shorter series that starts a longer one too)
const order = quats.map((_, k) => k).sort((a, b) => quats[b].length - quats[a].length);
const series = [];
const seriesOf = new Array(plates.length);
for (const k of order) {
	const q = quats[k];
	let j = series.findIndex((s) => q.every((v, i) => s[i] === v));
	if (j < 0) j = series.push(q) - 1;
	seriesOf[k] = j;
}
const rings = kept.map((f) => [
	seriesOf[plates.indexOf(f.pid)],
	Number.isFinite(f.from) ? Math.min(f.from, 9999) : 9999,
	f.ring.flatMap(([lon, lat]) => [r1(lon), r1(lat)])
]);

const header = `// Generated by scripts/data/deep-time/build.mjs — do not edit by hand.
// Continents: the coastline polygons and rotation model of Merdith et al. (2021), Extending
// full-plate tectonic models into deep time: Linking the Neoproterozoic and the Phanerozoic,
// Earth-Science Reviews 214, 103477, doi:10.1016/j.earscirev.2020.103477; model files from
// https://repo.gplates.org/webdav/pmm/merdith2021/ (Zenodo record 12525525, version 2024-07-18),
// CC BY 4.0. The model covers 1000 Ma to the present, in a palaeomagnetic reference frame: the
// longitudes of the continents are not constrained by palaeomagnetism.
// Reduced: polygons of at least ${MIN_AREA.toLocaleString('en-GB')} km², simplified with
// Douglas–Peucker (${TOL}°); plate rotations sampled every ${STEP} Myr. See the script.
`;
const body = `${header}
/** Present-day positions of the coastline polygons: [rotation series, appears at (Ma; 9999: before the
 * model starts), flat [lon, lat, …] in tenths of a degree]. */
export const RINGS: [number, number, number[]][] = ${JSON.stringify(rings)};

/** Ages (Ma) of the rotation samples. */
export const STEP_MA = ${STEP};
export const MAX_MA = ${MAX_AGE};

/** The model's plate id of each ring. */
export const RING_PLATES = ${JSON.stringify(kept.map((f) => f.pid))};

/** Total rotations (the plates' series, shared by plates that move together) at 0, ${STEP}, …
 * ${MAX_AGE} Ma: unit quaternions [w, x, y, z] ×10³, flattened; a series stops at the first sample
 * older than its rings. */
export const ROTATIONS: number[][] = ${JSON.stringify(series)};
`;
writeFileSync(join(out, 'continents.ts'), body);
console.log(
	`features ${features.length}, kept rings ${kept.length}, points ${kept.reduce((s, f) => s + f.ring.length, 0)}, plates ${plates.length}, series ${series.length}, kept area ${(kept.reduce((s, f) => s + f.area, 0) / 1e6).toFixed(1)} of ${(totalArea / 1e6).toFixed(1)} Mkm², bytes ${body.length}`
);

// ---------------------------------------------------------------- self-check (optional)
// node build.mjs <raw> --check <gws.json> <age>: (1) share of our reconstructed (unsimplified)
// vertices within 0.3° of a vertex of the Web Service's reconstruction at that age; (2) how far
// (km) the page's interpolation between the samples puts the vertices from that exact position.
const ci = process.argv.indexOf('--check');
if (ci > 0) {
	const ref = JSON.parse(readFileSync(process.argv[ci + 1], 'utf8'));
	const age = Number(process.argv[ci + 2]);
	const grid = new Map();
	const cell = (lon, lat) => `${Math.floor(lon * 2)},${Math.floor(lat * 2)}`;
	for (const f of ref.features)
		for (const ring of f.geometry.type === 'Polygon'
			? f.geometry.coordinates
			: f.geometry.coordinates.flat())
			for (const [lon, lat] of ring) {
				const k = cell(lon, lat);
				if (!grid.has(k)) grid.set(k, []);
				grid.get(k).push([lon, lat]);
			}
	const gc = ([a, b], [c, d]) =>
		6371 *
		Math.acos(
			Math.min(
				1,
				Math.sin(b * D2R) * Math.sin(d * D2R) +
					Math.cos(b * D2R) * Math.cos(d * D2R) * Math.cos((a - c) * D2R)
			)
		);
	let n = 0;
	let ok = 0;
	const dist = [];
	const t0 = Math.floor(age / STEP) * STEP;
	for (const f of features) {
		if (!(f.from >= age) || f.to > age) continue;
		const q = totalRotation(f.pid, age);
		const qi = norm(
			slerp(
				totalRotation(f.pid, t0),
				totalRotation(f.pid, Math.min(MAX_AGE, t0 + STEP)),
				(age - t0) / STEP
			)
		);
		for (let i = 0; i < f.ring.length; i += 7) {
			const [lon, lat] = rotatePoint(q, ...f.ring[i]);
			dist.push(gc([lon, lat], rotatePoint(qi, ...f.ring[i])));
			n++;
			let hit = false;
			for (let a = -1; a <= 1 && !hit; a++)
				for (let b = -1; b <= 1 && !hit; b++) {
					const c = grid.get(`${Math.floor(lon * 2) + a},${Math.floor(lat * 2) + b}`) ?? [];
					hit = c.some(([x, y]) => Math.hypot(x - lon, y - lat) < 0.3);
				}
			if (hit) ok++;
		}
	}
	dist.sort((a, b) => a - b);
	const pc = (p) => Math.round(dist[Math.floor(p * (dist.length - 1))]);
	console.log(
		`check ${age} Ma: ${ok}/${n} vertices match the Web Service (${((100 * ok) / n).toFixed(1)}%); interpolation off by median ${pc(0.5)} km, 95% ${pc(0.95)} km, max ${pc(1)} km`
	);
}
