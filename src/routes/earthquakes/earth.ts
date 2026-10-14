/**
 * Seismic rays through the Earth, traced in the ak135 model (Kennett, Engdahl & Buland 1995; see
 * `data/ak135.ts`).
 *
 * The model is cut into thin concentric shells, each with a constant speed (the model's value at
 * its middle, from linear interpolation in radius between the model's rows), with the shell
 * boundaries falling exactly on every discontinuity of the model. Inside a shell a ray is a
 * straight line; at each boundary it bends by Snell's law. In a sphere Snell's law keeps the
 * ray parameter p = r·sin(i)/v the same all along the ray (r the radius, i the angle from the
 * vertical, v the speed). A straight line passes the centre at the distance b = r·sin(i), so in a
 * shell of speed v the ray is the line that passes the centre at b = p·v. Where b exceeds the
 * shell's inner radius the ray turns back up inside that shell (or, if b exceeds even its outer
 * radius, it is totally reflected at the shell's top). Everything below follows from that.
 *
 * Simplifications: only the waves that travel down from the earthquake and come back up are
 * traced (not those reflected at the surface or partly reflected at the boundaries); an S wave
 * that reaches the liquid outer core stops there (in reality part of it turns into a P wave);
 * waves diffracted round the core are left out; the model is spherically symmetric.
 */
import { AK135 } from './data/ak135';

export const EARTH_R = 6371;
export const MOHO_DEPTH = 35;
export const CMB_DEPTH = 2891.5;
export const ICB_DEPTH = 5153.5;
export const R_CMB = EARTH_R - CMB_DEPTH;
export const R_ICB = EARTH_R - ICB_DEPTH;
export const KM_PER_DEG = (Math.PI / 180) * EARTH_R;
export const DEG = 180 / Math.PI;

export type Wave = 'P' | 'S';
/** Which Earth: the real one (ak135), one made of the same rock all through (the speeds where the
 * earthquake starts), or one whose core is liquid to the centre (no solid inner core). */
export type EarthModel = 'ak135' | 'uniform' | 'liquid-core';

/** ak135 rows as [depth, vp, vs]: a depth listed twice is a discontinuity, upper side first. */
const ROWS = AK135;

/**
 * Speed (km/s) of a P or S wave at `depth` km in ak135, linearly interpolated in radius between
 * rows. At a discontinuity, `below` picks the deeper side.
 */
export function speed(wave: Wave, depth: number, below = false): number {
	const col = wave === 'P' ? 1 : 2;
	const d = Math.min(EARTH_R, Math.max(0, depth));
	for (let i = 0; i < ROWS.length - 1; i++) {
		const [d0] = ROWS[i];
		const [d1] = ROWS[i + 1];
		if (d1 === d0) {
			if (d === d0) return ROWS[below ? i + 1 : i][col];
			continue;
		}
		if (d >= d0 && d <= d1) {
			// At a discontinuity the next pair (a repeated depth) gives the side below.
			if (d === d1 && below && ROWS[i + 2]?.[0] === d1) continue;
			const u = (d - d0) / (d1 - d0);
			return ROWS[i][col] + (ROWS[i + 1][col] - ROWS[i][col]) * u;
		}
	}
	return ROWS[ROWS.length - 1][col];
}

interface Shell {
	rTop: number;
	rBot: number;
	vp: number;
	vs: number;
}

/** Shell thickness, km: thin enough that the stair-steps change no time by more than ~0.1 s. */
const thickness = (depth: number) => (depth < 800 ? 2.5 : depth < ICB_DEPTH ? 5 : 10);

function buildShells(model: EarthModel, sourceDepth = 0): Shell[] {
	if (model === 'uniform') {
		const vp = speed('P', sourceDepth, true);
		const vs = speed('S', sourceDepth, true);
		return [{ rTop: EARTH_R, rBot: 0, vp, vs }];
	}
	const shells: Shell[] = [];
	for (let i = 0; i < ROWS.length - 1; i++) {
		const [d0, p0, s0] = ROWS[i];
		const [d1, p1, s1] = ROWS[i + 1];
		if (d1 === d0) continue;
		const n = Math.ceil((d1 - d0) / thickness(d0) - 1e-9);
		for (let k = 0; k < n; k++) {
			const top = d0 + ((d1 - d0) * k) / n;
			const bot = d0 + ((d1 - d0) * (k + 1)) / n;
			const u = (k + 0.5) / n;
			let vp = p0 + (p1 - p0) * u;
			let vs = s0 + (s1 - s0) * u;
			if (model === 'liquid-core' && top >= ICB_DEPTH) {
				// The outer core's liquid, at its deepest speed, all the way to the centre.
				vp = speed('P', ICB_DEPTH);
				vs = 0;
			}
			shells.push({ rTop: EARTH_R - top, rBot: EARTH_R - bot, vp, vs });
		}
	}
	return shells;
}

const shellCache = new Map<string, Shell[]>();
function shellsFor(model: EarthModel, sourceDepth: number) {
	const key = model === 'uniform' ? `${model}|${sourceDepth}` : model;
	let s = shellCache.get(key);
	if (!s) shellCache.set(key, (s = buildShells(model, sourceDepth)));
	return s;
}

export interface RayPoint {
	/** Radius, km. */
	r: number;
	/** Angle from the earthquake round the centre, radians (it can exceed π: past the far side). */
	th: number;
	/** Seconds since the earthquake. */
	t: number;
}

/**
 * The path taken by a wave: `P` turns back up in the mantle, `PKP` through the outer core,
 * `PKiKP` through the outer core and bounced off the inner core, `PKIKP` through the inner core,
 * `S` in the mantle; `blocked` is an S wave stopped at the liquid core.
 */
export type RayKind = 'P' | 'PKP' | 'PKiKP' | 'PKIKP' | 'S' | 'blocked';

export interface Ray {
	wave: Wave;
	/** Ray parameter p = r·sin(i)/v, s/rad. */
	p: number;
	kind: RayKind;
	/** Where it comes back up, as an angle round the Earth from the earthquake, radians. */
	angle: number;
	/** Arrival time at the surface, s (or, for a blocked S wave, when it reaches the core). */
	time: number;
	/** Deepest radius reached, km. */
	deepest: number;
	/** The path, from the earthquake (only when asked for). */
	points: RayPoint[];
}

/**
 * Traces the ray of parameter `p` (s/rad) for a wave starting `sourceDepth` km down and leaving
 * downwards. Returns null for a ray that cannot reach the surface (trapped in a slow layer).
 */
export function trace(
	wave: Wave,
	p: number,
	sourceDepth: number,
	model: EarthModel = 'ak135',
	withPoints = false
): Ray | null {
	const shells = shellsFor(model, sourceDepth);
	const rs = EARTH_R - sourceDepth;
	let k0 = shells.findIndex((s) => s.rBot < rs);
	if (k0 < 0) k0 = shells.length - 1;
	const v = (s: Shell) => (wave === 'P' ? s.vp : s.vs);
	const pts: RayPoint[] = [{ r: rs, th: 0, t: 0 }];
	let th = 0;
	let t = 0;
	let turn = -1;
	let bounced = false;
	// ---- down from the source
	for (let k = k0; k < shells.length; k++) {
		const sh = shells[k];
		const top = k === k0 ? rs : sh.rTop;
		const vk = v(sh);
		if (vk === 0) {
			// An S wave meets the liquid core.
			return {
				wave,
				p,
				kind: 'blocked',
				angle: th,
				time: t,
				deepest: top,
				points: withPoints ? pts : []
			};
		}
		const b = p * vk;
		if (b >= top) {
			turn = top; // totally reflected at this shell's top
			bounced = true;
			break;
		}
		if (b > sh.rBot) {
			const L = Math.sqrt(top * top - b * b);
			th += Math.acos(b / top);
			t += L / vk;
			turn = b;
			if (withPoints) pts.push({ r: b, th, t });
			break;
		}
		const L = Math.sqrt(top * top - b * b) - Math.sqrt(sh.rBot * sh.rBot - b * b);
		th += Math.acos(b / top) - Math.acos(b / sh.rBot);
		t += L / vk;
		if (withPoints) pts.push({ r: sh.rBot, th, t });
	}
	if (turn < 0) turn = 0;
	// ---- back up to the source's depth: the mirror image of the way down
	const thTurn = th;
	const tTurn = t;
	if (withPoints) {
		const turnIndex = pts.length - 1;
		for (let i = turnIndex - 1; i >= 0; i--)
			pts.push({ r: pts[i].r, th: 2 * thTurn - pts[i].th, t: 2 * tTurn - pts[i].t });
	}
	th = 2 * thTurn;
	t = 2 * tTurn;
	// ---- and on up to the surface
	for (let k = k0; k >= 0; k--) {
		const sh = shells[k];
		const bot = k === k0 ? rs : sh.rBot;
		const vk = v(sh);
		const b = p * vk;
		if (vk === 0 || b >= bot) return null;
		const L = Math.sqrt(sh.rTop * sh.rTop - b * b) - Math.sqrt(bot * bot - b * b);
		th += Math.acos(b / sh.rTop) - Math.acos(b / bot);
		t += L / vk;
		if (withPoints && sh.rTop !== bot) pts.push({ r: sh.rTop, th, t });
	}
	let kind: RayKind;
	if (wave === 'S' || model === 'uniform') kind = wave;
	else if (turn > R_CMB) kind = 'P';
	else if (bounced && Math.abs(turn - R_ICB) < 1e-6) kind = 'PKiKP';
	else if (turn >= R_ICB - 1e-9) kind = 'PKP';
	else kind = 'PKIKP';
	// Without a solid inner core every wave into the core is just a wave through the liquid.
	if (model === 'liquid-core' && (kind === 'PKiKP' || kind === 'PKIKP')) kind = 'PKP';
	return { wave, p, kind, angle: th, time: t, deepest: turn, points: withPoints ? pts : [] };
}

/** Speed of a wave right at the earthquake (the side below, at a boundary). */
export const sourceSpeed = (wave: Wave, depth: number, model: EarthModel = 'ak135') => {
	const sh = shellsFor(model, depth);
	const rs = EARTH_R - depth;
	const s = sh.find((x) => x.rBot < rs) ?? sh[sh.length - 1];
	return wave === 'P' ? s.vp : s.vs;
};

/** The ray leaving the earthquake at `takeoff` radians from straight down. */
export function rayAt(
	wave: Wave,
	takeoff: number,
	sourceDepth: number,
	model: EarthModel = 'ak135',
	withPoints = true
) {
	const p = ((EARTH_R - sourceDepth) * Math.sin(takeoff)) / sourceSpeed(wave, sourceDepth, model);
	return trace(wave, p, sourceDepth, model, withPoints);
}

/** Distance along the surface, in degrees, for an angle round the Earth (past 180°: the other way). */
export const surfaceDistance = (angle: number) => {
	const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	return (a > Math.PI ? 2 * Math.PI - a : a) * DEG;
};

// ---------------------------------------------------------------- travel times

interface Sample {
	dist: number; // degrees
	time: number;
	kind: RayKind;
}

const tableCache = new Map<string, Sample[][]>();
/**
 * A dense fan of rays for one wave, model and depth, in order of ray parameter, split into
 * branches of one kind each. Where neighbouring rays land more than 0.2° apart, or take different
 * paths, the fan is refined between them (near grazing rays the distance changes fast with p).
 */
function table(wave: Wave, depth: number, model: EarthModel): Sample[][] {
	const key = `${wave}|${depth}|${model}`;
	const hit = tableCache.get(key);
	if (hit) return hit;
	const pMax = ((EARTH_R - depth) / sourceSpeed(wave, depth, model)) * (1 - 1e-9);
	const sample = (p: number) => {
		const ray = trace(wave, p, depth, model);
		return ray && ray.kind !== 'blocked'
			? { p, dist: surfaceDistance(ray.angle), time: ray.time, kind: ray.kind }
			: { p, dist: NaN, time: NaN, kind: 'blocked' as RayKind };
	};
	const N = 1000;
	const coarse = Array.from({ length: N + 1 }, (_, i) => sample(1e-6 + (pMax * i) / N));
	const fine: (Sample & { p: number })[] = [coarse[0]];
	const refine = (a: Sample & { p: number }, b: Sample & { p: number }, level: number) => {
		const split =
			a.kind !== b.kind
				? b.p - a.p > 1e-7
				: a.kind !== 'blocked' && Math.abs(a.dist - b.dist) > 0.2;
		if (level < 24 && split) {
			const m = sample((a.p + b.p) / 2);
			refine(a, m, level + 1);
			refine(m, b, level + 1);
		} else fine.push(b);
	};
	for (let i = 1; i < coarse.length; i++) refine(coarse[i - 1], coarse[i], 0);
	const branches: Sample[][] = [];
	let cur: Sample[] = [];
	for (const s of fine) {
		const last = cur[cur.length - 1];
		if (s.kind === 'blocked' || (last && last.kind !== s.kind)) {
			if (cur.length) branches.push(cur);
			cur = [];
		}
		if (s.kind !== 'blocked') cur.push({ dist: s.dist, time: s.time, kind: s.kind });
	}
	if (cur.length) branches.push(cur);
	tableCache.set(key, branches);
	return branches;
}

export interface Arrival {
	kind: Exclude<RayKind, 'blocked'>;
	/** Seconds after the earthquake. */
	time: number;
}

/**
 * The first arrival of each kind of wave at a station `distDeg` degrees from an earthquake
 * `depth` km down (kinds that never get there are missing), earliest first.
 */
export function arrivals(
	distDeg: number,
	depth: number,
	model: EarthModel = 'ak135',
	waves: Wave[] = ['P', 'S']
): Arrival[] {
	const best = new Map<Arrival['kind'], number>();
	distDeg = Math.min(179.999, Math.max(0.001, distDeg));
	for (const wave of waves)
		for (const branch of table(wave, depth, model))
			for (let i = 1; i < branch.length; i++) {
				const a = branch[i - 1];
				const b = branch[i];
				const lo = Math.min(a.dist, b.dist);
				const hi = Math.max(a.dist, b.dist);
				if (distDeg < lo || distDeg > hi || hi - lo > 5) continue;
				const u = hi === lo ? 0 : (distDeg - a.dist) / (b.dist - a.dist);
				const time = a.time + (b.time - a.time) * u;
				const kind = a.kind as Arrival['kind'];
				if (time < (best.get(kind) ?? Infinity)) best.set(kind, time);
			}
	return [...best.entries()]
		.map(([kind, time]) => ({ kind, time }))
		.sort((x, y) => x.time - y.time);
}

/** First arrival time of a kind at a distance, or null if none arrives there. */
export const arrivalOf = (
	kind: Arrival['kind'],
	distDeg: number,
	depth: number,
	model: EarthModel = 'ak135'
) => arrivals(distDeg, depth, model).find((a) => a.kind === kind)?.time ?? null;

/** Range of distances (degrees) reached by a kind of wave, as [from, to] intervals. */
export function reach(
	kind: Arrival['kind'],
	depth: number,
	model: EarthModel = 'ak135'
): [number, number][] {
	const wave: Wave = kind === 'S' ? 'S' : 'P';
	const out: [number, number][] = [];
	for (const branch of table(wave, depth, model)) {
		if (branch[0].kind !== kind) continue;
		const ds = branch.map((s) => s.dist);
		out.push([Math.min(...ds), Math.max(...ds)]);
	}
	// Merge overlapping intervals.
	out.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const iv of out) {
		const last = merged[merged.length - 1];
		if (last && iv[0] <= last[1] + 0.05) last[1] = Math.max(last[1], iv[1]);
		else merged.push([...iv]);
	}
	return merged;
}

/** The farthest a direct (mantle) P or S wave gets, degrees: the start of the shadow zone. */
export const shadowStart = (wave: Wave, depth: number) =>
	Math.max(...reach(wave === 'P' ? 'P' : 'S', depth).map((iv) => iv[1]));

/** Where waves through the outer core (PKP) reach, degrees: [nearest, farthest]. */
export const pkpRange = (depth: number, model: EarthModel = 'ak135'): [number, number] => {
	const iv = reach('PKP', depth, model);
	return [Math.min(...iv.map((x) => x[0])), Math.max(...iv.map((x) => x[1]))];
};

// ---------------------------------------------------------------- S − P

/**
 * The time between the first P and first S wave at a distance (degrees), for the direct waves
 * through the mantle, or null where one of them doesn't arrive.
 */
export function sMinusP(distDeg: number, depth: number) {
	const tp = arrivalOf('P', distDeg, depth);
	const ts = arrivalOf('S', distDeg, depth);
	return tp === null || ts === null ? null : ts - tp;
}

/**
 * The distance (degrees) at which S arrives `lag` seconds after P, by bisection between 1° and
 * 95° (S − P grows steadily with distance).
 */
export function distanceFromSMinusP(lag: number, depth: number) {
	let lo = 1;
	let hi = 95;
	if (lag <= (sMinusP(lo, depth) ?? 0)) return lo;
	if (lag >= (sMinusP(hi, depth) ?? Infinity)) return hi;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if ((sMinusP(mid, depth) ?? 0) < lag) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ---------------------------------------------------------------- drawing helpers

/**
 * A ray's path thinned for drawing: points at least `step` km apart along the path (the turning
 * point and the ends kept), as [x, y, t] with x, y in km from the Earth's centre, the earthquake
 * straight up (on the +y axis, y pointing up) and the ray going round clockwise (`side` = +1) or
 * anticlockwise (−1).
 */
export function pathXY(ray: Ray, side: 1 | -1 = 1, step = 60): [number, number, number][] {
	const out: [number, number, number][] = [];
	let lx = Infinity;
	let ly = Infinity;
	const pts = ray.points;
	for (let i = 0; i < pts.length; i++) {
		const { r, th, t } = pts[i];
		const x = side * r * Math.sin(th);
		const y = r * Math.cos(th);
		const last = i === pts.length - 1;
		if (i === 0 || last || Math.hypot(x - lx, y - ly) >= step || r === ray.deepest) {
			out.push([x, y, t]);
			lx = x;
			ly = y;
		}
	}
	return out;
}

/** The ray parameter at which a P wave just grazes the core (larger p: it turns in the mantle). */
export const grazingCore = (wave: Wave) => R_CMB / speed(wave, CMB_DEPTH);

/**
 * A fan of rays for drawing, in order of take-off angle from straight down, chosen so that they
 * come back up evenly spaced round the surface (about every `spacing` degrees, with the first
 * and last ray of each kind of path kept); S rays stopped at the core are kept every 3° of
 * take-off angle. An even fan of take-off angles would bunch them near the earthquake.
 */
export function fan(wave: Wave, depth: number, model: EarthModel = 'ak135', spacing = 6): Ray[] {
	const step = 0.05;
	const all: { a: number; kind: RayKind; land: number }[] = [];
	for (let a = step; a < 89.9; a += step) {
		const r = rayAt(wave, a / DEG, depth, model, false);
		if (r) all.push({ a, kind: r.kind, land: surfaceDistance(r.angle) });
	}
	const keep: number[] = [];
	let last: (typeof all)[number] | null = null;
	for (let i = 0; i < all.length; i++) {
		const c = all[i];
		const next = all[i + 1];
		// Keep the first ray of each kind of path and the last one through the mantle (the
		// grazing ray at the edge of the shadow), and otherwise every `spacing` degrees.
		const edge =
			!last ||
			last.kind !== c.kind ||
			((c.kind === 'P' || c.kind === 'S') && (!next || next.kind !== c.kind));
		const far =
			last &&
			c.a - last.a >= 0.3 &&
			(c.kind === 'blocked'
				? c.a - last.a >= 3
				: Math.abs(c.land - last.land) >=
					(c.kind === 'P' || c.kind === 'S' ? spacing : spacing * 0.6));
		if (edge || far) {
			keep.push(c.a);
			last = c;
		}
	}
	return keep
		.map((a) => rayAt(wave, a / DEG, depth, model, true))
		.filter((r): r is Ray => r !== null);
}
