/** What the scenes share: the system the controls pick, views, cached paths, contours, colours. */
import type { Params } from '#lib/explainer/index.ts';
import {
	SYSTEMS,
	criticalC,
	integrate,
	omega,
	type Path,
	type RunOptions,
	type State,
	type System
} from '../model';

export const LOGMU_MIN = -6;
export const LOGMU_MAX = Math.log10(0.5);

const num = (v: unknown, fallback: number) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : fallback;
};

/** A body's name as it reads after "from": "the Sun", "the Moon", "Earth", "Jupiter". */
export const the = (name: string) =>
	name === 'Sun' || name === 'Moon' || name.endsWith('body') ? `the ${name}` : name;

export interface Picked {
	/** The real pair, or null for a mass ratio set on the slider. */
	sys: System | null;
	mu: number;
	name: string;
	big: string;
	small: string;
}

/** The pair the `system` select (and, for "custom", the `logmu` slider) picks. */
export function pick(p: Params, forced?: string): Picked {
	const id = forced ?? String(p.system ?? 'earth-moon');
	const sys = SYSTEMS[id] ?? null;
	if (sys) return { sys, mu: sys.mu, name: sys.name, big: sys.big, small: sys.small };
	const lm = Math.min(LOGMU_MAX, Math.max(LOGMU_MIN, num(p.logmu, Math.log10(0.01215))));
	return { sys: null, mu: 10 ** lm, name: 'your pair', big: 'large body', small: 'small body' };
}

/** log₁₀ μ of a preset, rounded to the slider's step, for `setParam('logmu', …)`. */
export const presetLogMu = (mu: number) => Math.round(Math.log10(mu) * 100) / 100;

// ---------------------------------------------------------------- energy

/**
 * The energy slider runs from 0 to 4.5: 1, 2 and 3 are the Jacobi constants of L1, L2 and L3,
 * 4 is that of L4 and L5 (C = 3), linear in between; 0 is as far above C1 as C3 is below it,
 * 4.5 as far below 3 as C3 is above it. (The critical values crowd close to 3 when μ is small.)
 */
export function jacobiOfLevel(mu: number, e: number): number {
	const c = criticalC(mu);
	const knots = [c.L1 + 0.5 * (c.L1 - c.L3), c.L1, c.L2, c.L3, 3, 3 - 0.5 * (c.L3 - 3)];
	const x = Math.min(4.5, Math.max(0, e));
	const i = Math.min(4, Math.floor(x));
	const u = x - i;
	const lo = knots[i];
	const hi = i === 4 ? knots[5] : knots[i + 1];
	const span = i === 4 ? 2 * u : u; // the last segment is half as long
	return lo + (hi - lo) * Math.min(1, span);
}

/** Which gates a probe of this energy level can pass. */
export function gatesOf(e: number): string {
	if (e < 1) return 'every gate shut';
	if (e < 2) return 'gate at L1 open';
	if (e < 3) return 'gates at L1 and L2 open';
	if (e < 4) return 'gates at L1, L2 and L3 open';
	return 'no forbidden region left';
}

// ---------------------------------------------------------------- views

/** A view of the rotating frame: frame units → stage coordinates. */
export interface View {
	cx: number;
	cy: number;
	/** Frame point at the view's centre. */
	ox: number;
	oy: number;
	/** Pixels per frame unit. */
	k: number;
	/** Clip rectangle on the stage. */
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export const sx = (v: View, x: number) => v.cx + (x - v.ox) * v.k;
export const sy = (v: View, y: number) => v.cy - (y - v.oy) * v.k;

/** The whole system: the centre of mass at (320, 300), 230 px per separation. */
export const MAIN: View = {
	cx: 322,
	cy: 300,
	ox: 0,
	oy: 0,
	k: 228,
	x0: 24,
	y0: 24,
	x1: 620,
	y1: 576
};

/** A window around the small body, wide enough for L1 and L2. */
export function insetView(mu: number, gamma: number, box = INSET_BOX): View {
	const half = Math.max(gamma * 1.75, 1e-9);
	const k = (box.x1 - box.x0) / (2 * half);
	return {
		cx: (box.x0 + box.x1) / 2,
		cy: (box.y0 + box.y1) / 2,
		ox: 1 - mu,
		oy: 0,
		k,
		...box
	};
}
export const INSET_BOX = { x0: 652, y0: 70, x1: 940, y1: 322 };

/** Polyline of a path's samples [from, to) as an SVG path, in a view, broken where it jumps. */
export function pathD(v: View, p: Path, from: number, to: number, stride = 1): string {
	let d = '';
	let pen = false;
	const end = Math.min(to, p.n);
	for (let i = Math.max(0, from); i < end; i += stride) {
		const X = sx(v, p.xy[2 * i]);
		const Y = sy(v, p.xy[2 * i + 1]);
		if (!Number.isFinite(X) || !Number.isFinite(Y) || Math.abs(X) > 5000 || Math.abs(Y) > 5000) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`;
		pen = true;
	}
	if (end > 0 && (end - 1 - Math.max(0, from)) % stride !== 0) {
		const i = end - 1;
		d += `${pen ? 'L' : 'M'}${sx(v, p.xy[2 * i]).toFixed(1)} ${sy(v, p.xy[2 * i + 1]).toFixed(1)}`;
	}
	return d;
}

// ---------------------------------------------------------------- forbidden regions

/**
 * The forbidden region 2Ω < C of a view, as one filled path (each grid cell clipped to the region
 * by linear interpolation along its edges) and its boundary, the zero-velocity curve, as line
 * segments (marching squares).
 */
export function forbidden(
	mu: number,
	C: number,
	v: View,
	cell = 5
): { fill: string; edge: string } {
	const nx = Math.ceil((v.x1 - v.x0) / cell);
	const ny = Math.ceil((v.y1 - v.y0) / cell);
	const f = new Float64Array((nx + 1) * (ny + 1));
	for (let j = 0; j <= ny; j++)
		for (let i = 0; i <= nx; i++) {
			const X = Math.min(v.x1, v.x0 + i * cell);
			const Y = Math.min(v.y1, v.y0 + j * cell);
			const x = v.ox + (X - v.cx) / v.k;
			const y = v.oy - (Y - v.cy) / v.k;
			const val = 2 * omega(mu, x, y) - C;
			f[j * (nx + 1) + i] = Number.isFinite(val) ? val : 1e9;
		}
	const P = (i: number, j: number): [number, number] => [
		Math.min(v.x1, v.x0 + i * cell),
		Math.min(v.y1, v.y0 + j * cell)
	];
	const r = (n: number) => n.toFixed(1);
	let fill = '';
	let edge = '';
	for (let j = 0; j < ny; j++) {
		let runStart = -1;
		const flush = (iEnd: number) => {
			if (runStart < 0) return;
			const [ax, ay] = P(runStart, j);
			const [bx, by] = P(iEnd, j + 1);
			fill += `M${r(ax)} ${r(ay)}H${r(bx)}V${r(by)}H${r(ax)}Z`;
			runStart = -1;
		};
		for (let i = 0; i < nx; i++) {
			const corners: [number, number, number][] = [
				[...P(i, j), f[j * (nx + 1) + i]],
				[...P(i + 1, j), f[j * (nx + 1) + i + 1]],
				[...P(i + 1, j + 1), f[(j + 1) * (nx + 1) + i + 1]],
				[...P(i, j + 1), f[(j + 1) * (nx + 1) + i]]
			];
			const inside = corners.map((c) => c[2] < 0);
			if (inside.every(Boolean)) {
				if (runStart < 0) runStart = i;
				continue;
			}
			flush(i);
			if (!inside.some(Boolean)) continue;
			// clip the cell to f < 0
			const poly: [number, number][] = [];
			const cross: [number, number][] = [];
			for (let k = 0; k < 4; k++) {
				const a = corners[k];
				const b = corners[(k + 1) % 4];
				if (a[2] < 0) poly.push([a[0], a[1]]);
				if (a[2] < 0 !== b[2] < 0) {
					const u = a[2] / (a[2] - b[2]);
					const pt: [number, number] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
					poly.push(pt);
					cross.push(pt);
				}
			}
			fill += `M${poly.map((q) => `${r(q[0])} ${r(q[1])}`).join('L')}Z`;
			for (let k = 0; k + 1 < cross.length; k += 2)
				edge += `M${r(cross[k][0])} ${r(cross[k][1])}L${r(cross[k + 1][0])} ${r(cross[k + 1][1])}`;
		}
		flush(nx);
	}
	return { fill, edge };
}

const zvcCache = new Map<string, { fill: string; edge: string }>();
export function forbiddenCached(mu: number, C: number, v: View, cell = 5) {
	const key = `${mu}|${C}|${v.ox}|${v.k}|${v.x0}|${v.y0}|${cell}`;
	let hit = zvcCache.get(key);
	if (!hit) {
		hit = forbidden(mu, C, v, cell);
		if (zvcCache.size > 200) zvcCache.clear();
		zvcCache.set(key, hit);
	}
	return hit;
}

// ---------------------------------------------------------------- cached runs

const runs = new Map<string, Path>();
/** A probe's path, integrated once per start and setting. */
export function runCached(
	mu: number,
	s0: State,
	tEnd: number,
	samples: number,
	opts: RunOptions = {}
): Path {
	const key = `${mu}|${s0.join(',')}|${tEnd}|${samples}|${JSON.stringify(opts)}`;
	let hit = runs.get(key);
	if (!hit) {
		hit = integrate(mu, s0, tEnd, samples, opts);
		if (runs.size > 60) runs.clear();
		runs.set(key, hit);
	}
	return hit;
}

/** Collision radii of a picked pair in frame units (none for a pair set on the slider). */
export const radii = (p: Picked): RunOptions =>
	p.sys ? { rBig: p.sys.rBig / p.sys.a, rSmall: p.sys.rSmall / p.sys.a } : {};

// ---------------------------------------------------------------- bodies and colours

/** Fixed colours of the bodies (their real hues, the same in both themes). */
export const BODY: Record<string, string> = {
	Sun: '#f59f00',
	Earth: '#228be6',
	Moon: '#adb5bd',
	Jupiter: '#d9a066',
	Pluto: '#c8a27a',
	Charon: '#9aa0a6',
	'large body': '#f59f00',
	'small body': '#7c8fa6'
};

/** Theme colours (app.css, `--lg-*`). */
export const C = {
	point: 'var(--lg-point)',
	pointText: 'var(--lg-point-text)',
	stable: 'var(--lg-stable)',
	stableText: 'var(--lg-stable-text)',
	forbidden: 'var(--lg-forbidden)',
	forbiddenEdge: 'var(--lg-forbidden-edge)',
	probe: 'var(--lg-probe)',
	probeText: 'var(--lg-probe-text)',
	probeB: 'var(--lg-probe-b)',
	probeBText: 'var(--lg-probe-b-text)',
	orbit: 'var(--lg-orbit)',
	big: 'var(--lg-pull-big)',
	bigText: 'var(--lg-pull-big-text)',
	small: 'var(--lg-pull-small)',
	smallText: 'var(--lg-pull-small-text)',
	needed: 'var(--lg-needed)',
	neededText: 'var(--lg-needed-text)',
	star: 'var(--lg-star)'
};

// ---------------------------------------------------------------- formatting

const group = (n: number) => Math.round(n).toLocaleString('en-US');
/** A distance in km, "1.50 million km" or "58,000 km" (to the nearest 100). */
export function fmtKm(km: number): string {
	if (km >= 1e6) return `${(km / 1e6).toFixed(km >= 1e7 ? 1 : 2)} million km`;
	if (km >= 10_000) return `${group(Math.round(km / 100) * 100)} km`;
	return `${group(km)} km`;
}
/** A distance in frame units for a pair with real units, or in separations otherwise. */
export function fmtDist(p: Picked, d: number): string {
	return p.sys ? fmtKm(d * p.sys.a) : `${d.toFixed(d < 0.1 ? 4 : 3)} separations`;
}
/** A duration in frame time units as days, months or years (or turns of the frame). */
export function fmtTime(p: Picked, t: number): string {
	if (!p.sys) return `${(t / (2 * Math.PI)).toFixed(1)} turns`;
	const days = (t * p.sys.period) / (2 * Math.PI);
	if (days < 60) return `${days.toFixed(1)} days`;
	if (days < 730) return `${(days / 30.44).toFixed(1)} months`;
	return `${group(days / 365.25)} years`;
}
const SUP: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹'
};
/** "10⁻⁶" for an integer power. */
export const pow10 = (n: number) => `10${String(n).replace(/./g, (c) => SUP[c] ?? c)}`;
export function fmtMu(mu: number): string {
	if (mu >= 0.01) return mu.toFixed(4);
	if (mu >= 1e-4) return mu.toPrecision(3);
	const e = Math.floor(Math.log10(mu));
	return `${(mu / 10 ** e).toFixed(2)} × ${pow10(e)}`;
}
/** μ as "1 in N" (the small body's share of the total mass). */
export const oneIn = (mu: number) => `1 in ${group(1 / mu)}`;
