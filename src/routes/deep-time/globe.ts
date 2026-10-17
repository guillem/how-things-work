/**
 * The drifting continents of the deep-time explainer: today's coastline polygons of Merdith et al.
 * (2021), carried back in time by the model's plate rotations (see `data/continents.ts` and
 * `scripts/data/deep-time/build.mjs`), and drawn on an orthographic globe.
 *
 * A rotation is a unit quaternion [w, x, y, z] acting on unit vectors with x towards (0° N,
 * 0° E), y towards (0° N, 90° E) and z towards the North Pole. The data holds each plate's total
 * rotation every 10 Myr; between samples it is interpolated by spherical linear interpolation,
 * which is how GPlates interpolates the model's own finite rotations.
 */
import { MAX_MA, RINGS, RING_PLATES, ROTATIONS, STEP_MA } from './data/continents';

export { MAX_MA, RING_PLATES };

type Quat = [number, number, number, number];
type Vec = [number, number, number];
export type LonLat = [number, number];

const D2R = Math.PI / 180;

const toVec = ([lon, lat]: LonLat): Vec => {
	const la = lat * D2R;
	const lo = lon * D2R;
	return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};
const toLonLat = ([x, y, z]: Vec): LonLat => [
	Math.atan2(y, x) / D2R,
	Math.asin(Math.max(-1, Math.min(1, z))) / D2R
];

/** Rotates vector `v` by unit quaternion `q`. */
function rotate(q: Quat, v: Vec): Vec {
	const [w, x, y, z] = q;
	// v' = v + 2w (u × v) + 2 u × (u × v), u = (x, y, z)
	const cx = y * v[2] - z * v[1];
	const cy = z * v[0] - x * v[2];
	const cz = x * v[1] - y * v[0];
	return [
		v[0] + 2 * (w * cx + y * cz - z * cy),
		v[1] + 2 * (w * cy + z * cx - x * cz),
		v[2] + 2 * (w * cz + x * cy - y * cx)
	];
}

function slerp(a: Quat, b: Quat, u: number): Quat {
	let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	let bb = b;
	if (d < 0) {
		bb = [-b[0], -b[1], -b[2], -b[3]];
		d = -d;
	}
	let ka = 1 - u;
	let kb = u;
	if (d < 0.9999995) {
		const th = Math.acos(d);
		const s = Math.sin(th);
		ka = Math.sin((1 - u) * th) / s;
		kb = Math.sin(u * th) / s;
	}
	const q: Quat = [
		a[0] * ka + bb[0] * kb,
		a[1] * ka + bb[1] * kb,
		a[2] * ka + bb[2] * kb,
		a[3] * ka + bb[3] * kb
	];
	const n = Math.hypot(...q);
	return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

const sample = (s: number[], i: number): Quat => [
	s[i * 4] / 1e3,
	s[i * 4 + 1] / 1e3,
	s[i * 4 + 2] / 1e3,
	s[i * 4 + 3] / 1e3
];

/** Total rotation of rotation series `series` at `age` Ma (null beyond its samples). */
function rotationAt(series: number, age: number): Quat | null {
	const s = ROTATIONS[series];
	const n = s.length / 4;
	const f = Math.max(0, age) / STEP_MA;
	const i = Math.floor(f);
	if (i >= n - 1) return i === n - 1 && f === i ? sample(s, i) : null;
	return slerp(sample(s, i), sample(s, i + 1), f - i);
}

interface Ring {
	/** Rotation series of the ring's plate. */
	series: number;
	/** Age (Ma) at which the ring's crust first exists in the model (9999: before the model). */
	from: number;
	/** Present-day vertices as unit vectors. */
	pts: Vec[];
	/** Present-day vertices, degrees. */
	lonlat: LonLat[];
}

const rings: Ring[] = RINGS.map(([series, from, flat]) => {
	const lonlat: LonLat[] = [];
	for (let i = 0; i < flat.length; i += 2) lonlat.push([flat[i] / 10, flat[i + 1] / 10]);
	return { series, from, pts: lonlat.map(toVec), lonlat };
});

/** Point-in-polygon test in longitude/latitude (fine away from the poles and the date line). */
function inside([x, y]: LonLat, poly: LonLat[]): boolean {
	let c = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
	}
	return c;
}

/** Area of a ring on the unit sphere (steradians; the formula of the build script). */
function ringArea(ring: LonLat[]): number {
	const D2R = Math.PI / 180;
	let s = 0;
	for (let i = 0; i < ring.length; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[(i + 1) % ring.length];
		let dx = x2 - x1;
		if (dx > 180) dx -= 360;
		if (dx < -180) dx += 360;
		s += dx * D2R * (Math.sin(y1 * D2R) + Math.sin(y2 * D2R));
	}
	return Math.abs(s / 2);
}
let areas: number[] | undefined;

/** Index of a ring that contains a present-day point (the smallest by area, if several), or −1. */
function ringAt(p: LonLat): number {
	areas ??= rings.map((r) => ringArea(r.lonlat));
	let best = -1;
	rings.forEach((r, i) => {
		if ((best < 0 || areas![i] < areas![best]) && inside(p, r.lonlat)) best = i;
	});
	return best;
}

/**
 * Where a place that is at `p` today was `age` Ma ago, carried by the plate under it (null if
 * the point is not on a mapped continent, or the age is beyond the model).
 */
export function reconstruct(p: LonLat, age: number): LonLat | null {
	const k = ringAt(p);
	if (k < 0 || age > MAX_MA || age > rings[k].from) return null;
	const q = rotationAt(rings[k].series, age);
	return q ? toLonLat(rotate(q, toVec(p))) : null;
}

/** Great-circle distance between two points, km. */
export function distanceKm(a: LonLat, b: LonLat): number {
	const [x1, y1, z1] = toVec(a);
	const [x2, y2, z2] = toVec(b);
	return 6371 * Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2)));
}

/** How visible a ring is at `age`: it fades in over the 20 Myr after its crust appears. */
const ringOpacity = (r: Ring, age: number) =>
	age > MAX_MA ? 0 : Math.max(0, Math.min(1, (r.from - age) / 20));

/** The continents at `age` Ma: each visible ring's vertices as unit vectors, with its opacity. */
export function landAt(age: number): { pts: Vec[]; opacity: number; id: number }[] {
	const out: { pts: Vec[]; opacity: number; id: number }[] = [];
	if (age > MAX_MA) return out;
	const qs = new Map<number, Quat | null>();
	rings.forEach((r, id) => {
		const opacity = ringOpacity(r, age);
		if (opacity <= 0) return;
		if (!qs.has(r.series)) qs.set(r.series, rotationAt(r.series, age));
		const q = qs.get(r.series);
		if (!q) return;
		out.push({ pts: r.pts.map((v) => rotate(q, v)), opacity, id });
	});
	return out;
}

/** Mean direction of the land at `age` (an area-blind vertex average, for centring the view). */
export function landCentre(land: { pts: Vec[] }[]): LonLat {
	let x = 0;
	let y = 0;
	let z = 0;
	for (const r of land)
		for (const p of r.pts) {
			x += p[0];
			y += p[1];
			z += p[2];
		}
	const n = Math.hypot(x, y, z);
	return n ? toLonLat([x / n, y / n, z / n]) : [0, 0];
}

// ------------------------------------------------------------------ orthographic projection

export interface View {
	/** Longitude and latitude at the centre of the disc, degrees. */
	lon: number;
	lat: number;
	cx: number;
	cy: number;
	r: number;
}

/** Vector in view coordinates: x right, y up, z towards the viewer. */
function toView(v: Vec, lon: number, lat: number): Vec {
	const lo = lon * D2R;
	const la = lat * D2R;
	// turn the centre longitude to 0, then tilt the centre latitude to the equator
	const x1 = v[0] * Math.cos(lo) + v[1] * Math.sin(lo);
	const y1 = -v[0] * Math.sin(lo) + v[1] * Math.cos(lo);
	const z1 = v[2];
	const x2 = x1 * Math.cos(la) + z1 * Math.sin(la);
	const z2 = -x1 * Math.sin(la) + z1 * Math.cos(la);
	return [y1, z2, x2];
}

const f1 = (v: number) => v.toFixed(1);

/**
 * SVG path of closed rings (unit vectors) on the globe, clipped to the visible hemisphere: where a
 * ring passes behind the limb, the path follows the limb to where it comes back.
 */
export function ringsPath(ringsV: Vec[][], view: View): string {
	const { lon, lat, cx, cy, r } = view;
	let d = '';
	for (const ring of ringsV) {
		const vs = ring.map((p) => toView(p, lon, lat));
		const n = vs.length;
		if (n < 3) continue;
		if (vs.every((v) => v[2] < 0)) continue;
		const out: [number, number][] = [];
		let exitAngle: number | null = null;
		const limb = (a: Vec, b: Vec): number => {
			const u = a[2] / (a[2] - b[2]);
			return Math.atan2(a[1] + (b[1] - a[1]) * u, a[0] + (b[0] - a[0]) * u);
		};
		const arc = (from: number, to: number) => {
			let dA = to - from;
			while (dA > Math.PI) dA -= 2 * Math.PI;
			while (dA < -Math.PI) dA += 2 * Math.PI;
			const steps = Math.max(1, Math.ceil(Math.abs(dA) / 0.12));
			for (let k = 0; k <= steps; k++) {
				const a = from + (dA * k) / steps;
				out.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
			}
		};
		// start from a visible vertex so that every exit is followed by an entry
		const s0 = vs.findIndex((v) => v[2] >= 0);
		for (let k = 0; k <= n; k++) {
			const a = vs[(s0 + k - 1 + n) % n];
			const b = vs[(s0 + k) % n];
			const aIn = a[2] >= 0;
			const bIn = b[2] >= 0;
			if (k > 0 && aIn && !bIn) exitAngle = limb(a, b);
			else if (k > 0 && !aIn && bIn) {
				const enter = limb(a, b);
				if (exitAngle !== null) arc(exitAngle, enter);
				exitAngle = null;
			}
			if (bIn && k < n) out.push([cx + r * b[0], cy - r * b[1]]);
		}
		if (out.length < 3) continue;
		d += 'M' + out.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L') + 'Z';
	}
	return d;
}

/** SVG path of lines of latitude every `step`° (the equator separately via `equator`). */
export function graticulePath(view: View, step = 30): string {
	const lines: Vec[][] = [];
	for (let la = -90 + step; la < 90; la += step) {
		if (la === 0) continue;
		const ring: Vec[] = [];
		for (let lo = -180; lo < 180; lo += 6) ring.push(toVec([lo, la]));
		lines.push(ring);
	}
	for (let lo = -180; lo < 180; lo += step) {
		const ring: Vec[] = [];
		for (let la = -84; la <= 84; la += 6) ring.push(toVec([lo, la]));
		lines.push(ring);
	}
	return openLinesPath(lines, view);
}

/** SVG path of the equator. */
export function equatorPath(view: View): string {
	const ring: Vec[] = [];
	for (let lo = -180; lo <= 180; lo += 4) ring.push(toVec([lo, 0]));
	return openLinesPath([ring], view);
}

function openLinesPath(lines: Vec[][], view: View): string {
	const { lon, lat, cx, cy, r } = view;
	let d = '';
	for (const line of lines) {
		let pen = false;
		for (const p of line) {
			const v = toView(p, lon, lat);
			if (v[2] < 0) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${f1(cx + r * v[0])} ${f1(cy - r * v[1])}`;
			pen = true;
		}
	}
	return d;
}

/** Screen position of a point on the globe, and whether it is on the visible side. */
export function projectPoint(p: LonLat, view: View): { x: number; y: number; visible: boolean } {
	const v = toView(toVec(p), view.lon, view.lat);
	return { x: view.cx + view.r * v[0], y: view.cy - view.r * v[1], visible: v[2] > 0.05 };
}
