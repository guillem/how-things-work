/**
 * Ants and scent trails: two agent models with the same rules.
 *
 * The field: ants leave the nest and wander at random (a small random turn every step). An ant
 * that walks into the sugar picks up a grain, turns round and heads home, and on the way home
 * marks the ground with scent (one dab on each patch of ground it enters). A searching ant sniffs
 * three spots ahead of it, left, straight on and right, and turns toward the strongest smell, so
 * scent draws searchers along it. Scent fades with a half-life when fading is on. A pebble is a
 * disc nobody can walk through: an ant that would step into it turns until its way is clear,
 * a homecoming ant toward the side nearer home. In this model a homecoming ant knows the way
 * home (real ants keep track of where the nest is with sight and memory; the page says so); it
 * is the searchers that need the scent. This follows the NetLogo Ants model (Wilensky 1997).
 *
 * The bridges: Deneubourg's double bridge (Deneubourg et al. 1990; Goss et al. 1989). Ants walk
 * from the nest along a short stem to a fork, over one of two bridges to a second fork, and along
 * a stem to the sugar, then back the same way, choosing a bridge again at each fork. A homecoming
 * ant marks each stretch of bridge it walks on. At a fork, an ant takes bridge A rather than B
 * with Deneubourg's choice rule, (k + a)² / ((k + a)² + (k + b)²), where a and b are the scent
 * where each bridge starts (in "ants' worth" of scent) and k = 20, the values fitted to Argentine
 * ants. A bridge can open late (the shortcut experiment).
 *
 * Both models run in fixed time steps from a seed, so the same start always ends the same way,
 * and the drawing only reads them.
 */
import { rng } from '#lib/draw/math.ts';

// ===================================================================================== field
export const FIELD_W = 900;
export const FIELD_H = 500;
/** Size of one patch of ground (field units). */
export const CELL = 12;
export const COLS = Math.ceil(FIELD_W / CELL);
export const ROWS = Math.ceil(FIELD_H / CELL);
export const NEST = { x: 120, y: 270, r: 22 };
export const SUGAR_R = 24;
/** Walking speed (field units per second) and the simulation's time step (s). */
export const SPEED = 70;
export const DT = 1 / 20;
/** Scent's half-life when it fades (s). */
export const FIELD_HALF_LIFE = 12;
const SNIFF = 20;
const SNIFF_ANGLE = 0.6;
const STEER = 0.32;
/** The faintest scent an ant notices (one dab, after about five half-lives). */
const SMELL = 0.05;
const WOBBLE = 0.7;
const WOBBLE_ON_TRAIL = 0.25;

export interface Pebble {
	x: number;
	y: number;
	r: number;
}

export interface FieldOptions {
	ants?: number;
	seed?: number;
	/** Homecoming ants lay scent. */
	scent?: boolean;
	fade?: boolean;
	sugar?: { x: number; y: number };
}

export interface Field {
	x: Float64Array;
	y: Float64Array;
	heading: Float64Array;
	/** 1 while an ant carries a grain of sugar home. */
	carrying: Uint8Array;
	/** When each ant leaves the nest (s). */
	start: Float64Array;
	/**
	 * Scent on each patch of ground, row by row, in units of `gain`: the patch's scent is
	 * `scentMap[i] * gain`. Fading shrinks `gain` alone, so it costs nothing per patch.
	 */
	scentMap: Float64Array;
	gain: number;
	sugar: { x: number; y: number };
	pebbles: Pebble[];
	scent: boolean;
	fade: boolean;
	/** Grains of sugar brought home. */
	home: number;
	time: number;
	rand: () => number;
}

export function field(o: FieldOptions = {}): Field {
	const n = o.ants ?? 80;
	const rand = rng(o.seed ?? 1);
	const heading = Float64Array.from({ length: n }, () => rand() * 2 * Math.PI);
	return {
		x: new Float64Array(n).fill(NEST.x),
		y: new Float64Array(n).fill(NEST.y),
		heading,
		carrying: new Uint8Array(n),
		// The ants come out one after another, over the first twenty seconds.
		start: Float64Array.from({ length: n }, (_, i) => (i * 20) / n),
		scentMap: new Float64Array(COLS * ROWS),
		gain: 1,
		sugar: { ...(o.sugar ?? { x: 740, y: 170 }) },
		pebbles: [],
		scent: o.scent ?? true,
		fade: o.fade ?? true,
		home: 0,
		time: 0,
		rand
	};
}

const cellOf = (x: number, y: number) => {
	const c = Math.floor(x / CELL);
	const r = Math.floor(y / CELL);
	return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
};

/** The scent on the patch of ground under (x, y). */
export function scentAt(f: Field, x: number, y: number) {
	const i = cellOf(x, y);
	return i < 0 ? 0 : f.scentMap[i] * f.gain;
}

/** The scent on patch `i` (row by row). */
export const scentOf = (f: Field, i: number) => f.scentMap[i] * f.gain;

const EDGE = 8;
const blocked = (f: Field, x: number, y: number) =>
	x < EDGE / 2 ||
	y < EDGE / 2 ||
	x > FIELD_W - EDGE / 2 ||
	y > FIELD_H - EDGE / 2 ||
	inPebble(f, x, y);

function inPebble(f: Field, x: number, y: number) {
	for (const p of f.pebbles) if ((x - p.x) ** 2 + (y - p.y) ** 2 < (p.r + 3) ** 2) return true;
	return false;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Advances the field by one time step. */
function tick(f: Field) {
	const n = f.x.length;
	const stepLen = SPEED * DT;
	for (let i = 0; i < n; i++) {
		if (f.time < f.start[i]) continue;
		const carrying = f.carrying[i] === 1;
		let h = f.heading[i];
		if (carrying) {
			// Home: turn toward the nest, with a little wobble.
			const want = Math.atan2(NEST.y - f.y[i], NEST.x - f.x[i]);
			const d = wrap(want - h);
			h += Math.max(-0.25, Math.min(0.25, d)) + (f.rand() - 0.5) * 0.3;
		} else {
			// Sniff ahead and turn toward the strongest smell; an ant on a trail wanders less.
			const sniff = (a: number) =>
				scentAt(f, f.x[i] + SNIFF * Math.cos(h + a), f.y[i] + SNIFF * Math.sin(h + a));
			const left = sniff(-SNIFF_ANGLE);
			const ahead = sniff(0);
			const right = sniff(SNIFF_ANGLE);
			const best = Math.max(left, ahead, right);
			const smelt = best > SMELL;
			h += (f.rand() - 0.5) * (smelt ? WOBBLE_ON_TRAIL : WOBBLE);
			if (smelt) {
				if (left === best && left > ahead) h -= STEER;
				else if (right === best && right > ahead) h += STEER;
			}
			// A searcher that walks back into the nest turns round and sets out again.
			if ((f.x[i] - NEST.x) ** 2 + (f.y[i] - NEST.y) ** 2 < NEST.r ** 2) {
				const away = Math.atan2(f.y[i] - NEST.y, f.x[i] - NEST.x);
				if (Math.cos(h - away) < 0) h = away + (f.rand() - 0.5);
			}
		}
		// The edge of the field turns an ant back in, like a ball off a wall.
		const tx = f.x[i] + stepLen * Math.cos(h);
		const ty = f.y[i] + stepLen * Math.sin(h);
		if (tx < EDGE || tx > FIELD_W - EDGE) h = Math.PI - h;
		if (ty < EDGE || ty > FIELD_H - EDGE) h = -h;
		// Step, turning round a pebble until the way is clear (toward home first for a homecoming
		// ant).
		let nx = f.x[i] + stepLen * Math.cos(h);
		let ny = f.y[i] + stepLen * Math.sin(h);
		if (blocked(f, nx, ny)) {
			const want = Math.atan2(NEST.y - f.y[i], NEST.x - f.x[i]);
			const first = carrying ? (wrap(want - h) > 0 ? 1 : -1) : f.rand() < 0.5 ? 1 : -1;
			let moved = false;
			for (let k = 1; k <= 12 && !moved; k++)
				for (const side of [first, -first]) {
					const a = h + side * k * 0.26;
					const tx = f.x[i] + stepLen * Math.cos(a);
					const ty = f.y[i] + stepLen * Math.sin(a);
					if (!blocked(f, tx, ty)) {
						h = a;
						nx = tx;
						ny = ty;
						moved = true;
						break;
					}
				}
			if (!moved) {
				h += Math.PI;
				nx = f.x[i];
				ny = f.y[i];
			}
		}
		const before = cellOf(f.x[i], f.y[i]);
		f.x[i] = nx;
		f.y[i] = ny;
		f.heading[i] = wrap(h);
		if (carrying) {
			const c = cellOf(nx, ny);
			if (f.scent && c >= 0 && c !== before) f.scentMap[c] += 1 / f.gain;
			if ((nx - NEST.x) ** 2 + (ny - NEST.y) ** 2 < NEST.r ** 2) {
				// Home: drop the grain and set out again the way it came.
				f.carrying[i] = 0;
				f.home++;
				f.heading[i] = wrap(h + Math.PI + (f.rand() - 0.5) * 0.6);
			}
		} else if ((nx - f.sugar.x) ** 2 + (ny - f.sugar.y) ** 2 < SUGAR_R ** 2) {
			f.carrying[i] = 1;
			f.heading[i] = wrap(h + Math.PI);
		}
	}
	if (f.fade) {
		f.gain *= Math.pow(0.5, DT / FIELD_HALF_LIFE);
		if (f.gain < 1e-6) {
			for (let c = 0; c < f.scentMap.length; c++) f.scentMap[c] *= f.gain;
			f.gain = 1;
		}
	}
	f.time += DT;
}

/** Runs the field on to time `until` (s), in whole time steps. */
export function runField(f: Field, until: number) {
	while (f.time + DT / 2 <= until) tick(f);
	return f;
}

/** Drops a pebble; the scent under it is gone (and any ant under it is pushed out). */
export function dropPebble(f: Field, p: Pebble) {
	f.pebbles.push(p);
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c < COLS; c++) {
			const x = (c + 0.5) * CELL;
			const y = (r + 0.5) * CELL;
			if ((x - p.x) ** 2 + (y - p.y) ** 2 < (p.r + CELL / 2) ** 2) f.scentMap[r * COLS + c] = 0;
		}
	for (let i = 0; i < f.x.length; i++) {
		const dx = f.x[i] - p.x;
		const dy = f.y[i] - p.y;
		const d = Math.hypot(dx, dy);
		if (d < p.r + 4) {
			const a = d > 0 ? Math.atan2(dy, dx) : 0;
			f.x[i] = p.x + (p.r + 5) * Math.cos(a);
			f.y[i] = p.y + (p.r + 5) * Math.sin(a);
		}
	}
}

/** Where a pebble lands "on the trail": halfway between the nest and the sugar. */
export const pebbleSpot = (f: Field): Pebble => ({
	x: (NEST.x + f.sugar.x) / 2,
	y: (NEST.y + f.sugar.y) / 2,
	r: 38
});

/** How many ants walk within `width` of the straight line from the nest to the sugar. */
export function onStraightLine(f: Field, width = 24) {
	const ax = NEST.x;
	const ay = NEST.y;
	const bx = f.sugar.x - ax;
	const by = f.sugar.y - ay;
	const len2 = bx * bx + by * by;
	let n = 0;
	for (let i = 0; i < f.x.length; i++) {
		if (f.time < f.start[i]) continue;
		const u = ((f.x[i] - ax) * bx + (f.y[i] - ay) * by) / len2;
		if (u < 0.15 || u > 0.85) continue;
		const d = Math.abs((f.x[i] - ax) * by - (f.y[i] - ay) * bx) / Math.sqrt(len2);
		if (d < width) n++;
	}
	return n;
}

/** Ants out of the nest (not waiting to leave). */
export const outside = (f: Field) => f.start.filter((s) => s <= f.time).length;

// =================================================================================== bridges
/** The stems from the nest to the first fork and from the second fork to the sugar. */
export const STEM = 100;
export const SHORT = 600;
/** Stretch of bridge one dab of scent covers. */
export const PATCH = 10;
export const BRIDGE_SPEED = 80;
export const K = 20;
/** Scent's half-life on the bridges when it fades (s). */
export const BRIDGE_HALF_LIFE = 20;

export type Side = 0 | 1;

export interface BridgeOptions {
	/** Length of each bridge (units; the short one in the experiment is `SHORT`). */
	lengths?: [number, number];
	ants?: number;
	seed?: number;
	fade?: boolean;
	/** When each bridge opens (s); 0 = open from the start. */
	opens?: [number, number];
	/** Seconds between ants leaving the nest at the start. */
	every?: number;
	halfLife?: number;
	/** Ants mark the bridge on the way out as well as on the way home. */
	both?: boolean;
}

export interface Bridges {
	lengths: [number, number];
	opens: [number, number];
	fade: boolean;
	halfLife: number;
	both: boolean;
	/** Scent on each patch of each bridge, from the nest's fork to the sugar's. */
	scent: [Float64Array, Float64Array];
	/** Per ant: distance walked along its route, direction (+1 out, -1 home), bridge. */
	s: Float64Array;
	dir: Int8Array;
	side: Uint8Array;
	start: Float64Array;
	/** Which bridge each ant leaving the nest's fork took, latest last. */
	choices: Side[];
	/** Trips to the sugar and back completed over each bridge (counted on the way home). */
	trips: [number, number];
	time: number;
	rand: () => number;
}

export function bridges(o: BridgeOptions = {}): Bridges {
	const n = o.ants ?? 80;
	const lengths = o.lengths ?? [SHORT, SHORT];
	return {
		lengths,
		opens: o.opens ?? [0, 0],
		fade: o.fade ?? false,
		halfLife: o.halfLife ?? BRIDGE_HALF_LIFE,
		both: o.both ?? true,
		scent: [
			new Float64Array(Math.ceil(lengths[0] / PATCH)),
			new Float64Array(Math.ceil(lengths[1] / PATCH))
		],
		s: new Float64Array(n),
		dir: new Int8Array(n).fill(1),
		side: new Uint8Array(n),
		// One ant leaves the nest every half second until all are out.
		start: Float64Array.from({ length: n }, (_, i) => i * (o.every ?? 0.5)),
		choices: [],
		trips: [0, 0],
		time: 0,
		rand: rng(o.seed ?? 1)
	};
}

/** The chance that an ant at a fork takes bridge 0, given the scent where each one starts. */
export function choice(a: number, b: number) {
	const A = (K + a) ** 2;
	const B = (K + b) ** 2;
	return A / (A + B);
}

const isOpen = (b: Bridges, side: Side) => b.time >= b.opens[side];

/** The scent an ant at a fork smells on each bridge: the first two patches from that fork. */
function smell(b: Bridges, side: Side, atNest: boolean) {
	const p = b.scent[side];
	return atNest ? p[0] + p[1] : p[p.length - 1] + p[p.length - 2];
}

function choose(b: Bridges, atNest: boolean): Side {
	const open0 = isOpen(b, 0);
	const open1 = isOpen(b, 1);
	if (!open0) return 1;
	if (!open1) return 0;
	return b.rand() < choice(smell(b, 0, atNest), smell(b, 1, atNest)) ? 0 : 1;
}

/** The patch of its bridge an ant at `s` is on, or -1 on a stem. */
const patchOf = (b: Bridges, side: number, s: number) =>
	s >= STEM && s < STEM + b.lengths[side] ? Math.floor((s - STEM) / PATCH) : -1;

function bridgeTick(b: Bridges) {
	const ds = BRIDGE_SPEED * DT;
	for (let i = 0; i < b.s.length; i++) {
		if (b.time < b.start[i]) continue;
		const before = b.s[i];
		let prev = patchOf(b, b.side[i], before);
		let s = before + b.dir[i] * ds;
		if (b.dir[i] > 0) {
			if (before < STEM && s >= STEM) {
				// The nest's fork.
				const side = choose(b, true);
				b.side[i] = side;
				b.choices.push(side);
				if (b.choices.length > 200) b.choices.shift();
			}
			const total = 2 * STEM + b.lengths[b.side[i]];
			if (s >= total) {
				// At the sugar: turn for home.
				s = total;
				b.dir[i] = -1;
			}
		} else {
			const L = b.lengths[b.side[i]];
			if (before >= STEM + L && s < STEM + L) {
				// The sugar's fork: choose a bridge for the way home.
				const side = choose(b, false);
				b.side[i] = side;
				s = STEM + b.lengths[side] - (STEM + L - s);
				prev = -1;
			}
			if (before >= STEM && s < STEM) b.trips[b.side[i]]++;
			if (s <= 0) {
				// Home: set out again.
				s = 0;
				b.dir[i] = 1;
			}
		}
		b.s[i] = s;
		// A dab of scent on each new patch of bridge.
		const patch = patchOf(b, b.side[i], s);
		if (patch >= 0 && patch !== prev && (b.both || b.dir[i] < 0)) b.scent[b.side[i]][patch] += 1;
	}
	if (b.fade) {
		const keep = Math.pow(0.5, DT / b.halfLife);
		for (const p of b.scent) for (let c = 0; c < p.length; c++) p[c] *= keep;
	}
	b.time += DT;
}

export function runBridges(b: Bridges, until: number) {
	while (b.time + DT / 2 <= until) bridgeTick(b);
	return b;
}

/** Of the last `n` ants to leave the nest's fork, how many took each bridge. */
export function lastChoices(b: Bridges, n = 50): [number, number] {
	const last = b.choices.slice(-n);
	const zero = last.filter((c) => c === 0).length;
	return [zero, last.length - zero];
}

/** Ants on each bridge right now. */
export function onBridge(b: Bridges): [number, number] {
	const out: [number, number] = [0, 0];
	for (let i = 0; i < b.s.length; i++) {
		if (b.time < b.start[i]) continue;
		const s = b.s[i];
		if (s > STEM && s < STEM + b.lengths[b.side[i]]) out[b.side[i]]++;
	}
	return out;
}
