/**
 * Gradient descent on two-parameter loss landscapes.
 *
 * Every landscape is a function L(w₁, w₂) with its exact (analytic) gradient,
 * so the page runs the real algorithm:
 *
 *   plain:     w ← w − η ∇L(w)
 *   momentum:  v ← β v − η ∇L(w);  w ← w + v        (Polyak's "heavy ball")
 *   noise:     ∇L is replaced by ∇L + σ ξ, ξ a standard normal vector, as a
 *              stand-in for the noise of mini-batch gradients. On the line-fit
 *              landscape a mini-batch is the real thing instead: each step uses the
 *              gradient of a random mini-batch of the examples, and the added
 *              noise applies only when a step uses all of them.
 *
 * Landscapes:
 *   line     the mean squared error of a straight line y = a·x + b on the 21
 *            examples of the learning-from-data page (`makeData(21, 0.15, 1)`),
 *            a real loss whose minimum is the least-squares line;
 *   bowl     L = (w₁² + w₂²)/2: curvature 1 in every direction, so a step
 *            multiplies the distance to the bottom by exactly |1 − η|;
 *   ravine   a long, narrow valley: a quadratic with curvatures 0.02 along the
 *            floor and 1 across it, turned by 30°;
 *   plateau  a wide, almost flat plain (curvature 0.004) around a well of
 *            depth 0.9 and width 0.9;
 *   wells    a gentle bowl with three Gaussian wells of different depths: three
 *            minima, only one of them the lowest.
 *
 * The 2D landscapes are a simplification: a real model has thousands to
 * billions of parameters, and the page says so.
 */

import { rng } from '#lib/draw/math.ts';
import { makeData } from '../learning-from-data/fit.ts';

export type LandscapeId = 'line' | 'bowl' | 'ravine' | 'plateau' | 'wells';

export interface Minimum {
	x: number;
	y: number;
	value: number;
	/** Short name used by the readouts ("the deepest valley"). */
	name: string;
}

export interface Landscape {
	id: LandscapeId;
	/** Name in the landscape picker. */
	title: string;
	/** Parameter ranges shown on the map: w₁ across, w₂ up. */
	x: [number, number];
	y: [number, number];
	/** Axis names of the two parameters. */
	xName: string;
	yName: string;
	f: (x: number, y: number) => number;
	grad: (x: number, y: number) => [number, number];
	/** Every minimum inside the map, lowest first. */
	minima: Minimum[];
	/** Contour levels drawn on the map (ascending). */
	levels: number[];
	/** Loss at which the drawn surface is cut off (the top of the picture). */
	cap: number;
	/** Where the ball is dropped unless the reader drops it elsewhere. */
	start: [number, number];
}

// ---------------------------------------------------------------------- line fit

/** The examples of the learning-from-data page: its first set of 21. */
export const examples = makeData(21, 0.15, 1).map(({ x, y }) => ({ x, y }));

/** Mean squared error of the line y = a·x + b on a set of examples. */
export function lineLoss(a: number, b: number, pts: readonly { x: number; y: number }[]) {
	let s = 0;
	for (const p of pts) s += (a * p.x + b - p.y) ** 2;
	return s / pts.length;
}

/** Its gradient: (2/n) Σ (a·x + b − y)·(x, 1). */
export function lineGrad(
	a: number,
	b: number,
	pts: readonly { x: number; y: number }[]
): [number, number] {
	let ga = 0;
	let gb = 0;
	for (const p of pts) {
		const r = a * p.x + b - p.y;
		ga += r * p.x;
		gb += r;
	}
	return [(2 * ga) / pts.length, (2 * gb) / pts.length];
}

/** The least-squares line, from the closed-form formula (the answer descent should find). */
export function leastSquares(pts: readonly { x: number; y: number }[]) {
	const n = pts.length;
	let sx = 0;
	let sy = 0;
	let sxx = 0;
	let sxy = 0;
	for (const p of pts) {
		sx += p.x;
		sy += p.y;
		sxx += p.x * p.x;
		sxy += p.x * p.y;
	}
	const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
	return { a, b: (sy - a * sx) / n };
}

const best = leastSquares(examples);

// ---------------------------------------------------------------------- shapes

const quadratic = (l1: number, l2: number, angle: number, cx = 0, cy = 0) => {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return {
		f: (x: number, y: number) => {
			const u = (x - cx) * c + (y - cy) * s;
			const v = -(x - cx) * s + (y - cy) * c;
			return 0.5 * (l1 * u * u + l2 * v * v);
		},
		grad: (x: number, y: number): [number, number] => {
			const u = (x - cx) * c + (y - cy) * s;
			const v = -(x - cx) * s + (y - cy) * c;
			return [l1 * u * c - l2 * v * s, l1 * u * s + l2 * v * c];
		}
	};
};

const BOWL = quadratic(1, 1, 0);
/** Curvature along the ravine's floor and across it. */
export const RAVINE_CURVATURES = [0.02, 1] as const;
const RAVINE = quadratic(RAVINE_CURVATURES[0], RAVINE_CURVATURES[1], Math.PI / 6);

/** The plateau: depth, width and centre of the well, and the plain's gentle slope. */
const PL = { depth: 0.9, width: 0.9, cx: 1.2, cy: 0.9, tilt: 0.002 };
const plateauF = (x: number, y: number) => {
	const r2 = (x - PL.cx) ** 2 + (y - PL.cy) ** 2;
	return PL.depth * (1 - Math.exp(-r2 / (2 * PL.width ** 2))) + PL.tilt * r2;
};
const plateauGrad = (x: number, y: number): [number, number] => {
	const dx = x - PL.cx;
	const dy = y - PL.cy;
	const r2 = dx * dx + dy * dy;
	const k = (PL.depth / PL.width ** 2) * Math.exp(-r2 / (2 * PL.width ** 2)) + 2 * PL.tilt;
	return [k * dx, k * dy];
};

/** The three wells: centre, depth and width. The first is the deepest. */
const WELLS = [
	{ x: 1.5, y: -1.0, a: 1.2, s: 0.7 },
	{ x: -1.6, y: 1.3, a: 0.8, s: 0.8 },
	{ x: -1.2, y: -1.7, a: 0.5, s: 0.5 }
];
const WELL_BOWL = 0.03;
const wellsRaw = (x: number, y: number) => {
	let v = WELL_BOWL * (x * x + y * y);
	for (const w of WELLS) v -= w.a * Math.exp(-((x - w.x) ** 2 + (y - w.y) ** 2) / (2 * w.s ** 2));
	return v;
};
const wellsGrad = (x: number, y: number): [number, number] => {
	let gx = 2 * WELL_BOWL * x;
	let gy = 2 * WELL_BOWL * y;
	for (const w of WELLS) {
		const e = (w.a / w.s ** 2) * Math.exp(-((x - w.x) ** 2 + (y - w.y) ** 2) / (2 * w.s ** 2));
		gx += e * (x - w.x);
		gy += e * (y - w.y);
	}
	return [gx, gy];
};

/** Newton's method on the gradient, from a guess, to pin a minimum down exactly. */
export function refineMinimum(
	grad: (x: number, y: number) => [number, number],
	x: number,
	y: number
): [number, number] {
	const h = 1e-5;
	for (let i = 0; i < 50; i++) {
		const [gx, gy] = grad(x, y);
		const [ax, ay] = grad(x + h, y);
		const [bx, by] = grad(x, y + h);
		const hxx = (ax - gx) / h;
		const hxy = (bx - gx) / h;
		const hyx = (ay - gy) / h;
		const hyy = (by - gy) / h;
		const det = hxx * hyy - hxy * hyx;
		if (Math.abs(det) < 1e-14) break;
		const dx = (hyy * gx - hxy * gy) / det;
		const dy = (-hyx * gx + hxx * gy) / det;
		x -= dx;
		y -= dy;
		if (Math.hypot(dx, dy) < 1e-13) break;
	}
	return [x, y];
}

const wellMinima = WELLS.map((w) => refineMinimum(wellsGrad, w.x, w.y));
/** Shift so that the lowest point of the wells landscape has loss 0. */
const WELLS_FLOOR = Math.min(...wellMinima.map(([x, y]) => wellsRaw(x, y)));
const wellsF = (x: number, y: number) => wellsRaw(x, y) - WELLS_FLOOR;
const WELL_NAMES = ['the deepest valley', 'a shallower valley', 'the shallowest valley'];

const range = (from: number, to: number, n: number) =>
	Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
/** Levels k² · c: on a quadratic bowl these are evenly spaced rings. */
const squares = (c: number, n: number) => Array.from({ length: n }, (_, i) => c * (i + 1) ** 2);

export const landscapes: Record<LandscapeId, Landscape> = {
	line: {
		id: 'line',
		title: 'Fitting a line (21 examples)',
		x: [-2, 2],
		y: [-2, 2],
		xName: 'slope a',
		yName: 'height b',
		f: (a, b) => lineLoss(a, b, examples),
		grad: (a, b) => lineGrad(a, b, examples),
		minima: [
			{ x: best.a, y: best.b, value: lineLoss(best.a, best.b, examples), name: 'the bottom' }
		],
		levels: [0.13, 0.17, 0.25, 0.4, 0.6, 0.9, 1.3, 1.8, 2.4, 3.1, 3.9, 4.8],
		cap: 5.5,
		start: [-1.5, 1.5]
	},
	bowl: {
		id: 'bowl',
		title: 'A round bowl',
		x: [-3, 3],
		y: [-3, 3],
		xName: 'w₁',
		yName: 'w₂',
		...BOWL,
		minima: [{ x: 0, y: 0, value: 0, name: 'the bottom' }],
		levels: squares(0.08, 11),
		cap: 9,
		start: [-2.1, 1.5]
	},
	ravine: {
		id: 'ravine',
		title: 'A narrow ravine',
		x: [-3, 3],
		y: [-3, 3],
		xName: 'w₁',
		yName: 'w₂',
		...RAVINE,
		minima: [{ x: 0, y: 0, value: 0, name: 'the bottom' }],
		levels: squares(0.03, 12),
		cap: 6,
		start: [-2.6, 0.2]
	},
	plateau: {
		id: 'plateau',
		title: 'A plateau around a well',
		x: [-3, 3],
		y: [-3, 3],
		xName: 'w₁',
		yName: 'w₂',
		f: plateauF,
		grad: plateauGrad,
		minima: [{ x: PL.cx, y: PL.cy, value: 0, name: 'the bottom of the well' }],
		levels: [...range(0.05, 0.85, 9), 0.905, 0.93, 0.96, 1.0, 1.05],
		cap: 1.15,
		start: [-2.4, -2.2]
	},
	wells: {
		id: 'wells',
		title: 'Several valleys',
		x: [-3, 3],
		y: [-3, 3],
		xName: 'w₁',
		yName: 'w₂',
		f: wellsF,
		grad: wellsGrad,
		minima: wellMinima
			.map(([x, y], i) => ({ x, y, value: wellsF(x, y), name: WELL_NAMES[i] }))
			.sort((p, q) => p.value - q.value),
		levels: range(0.08, 1.28, 16),
		cap: 1.35,
		start: [-0.3, 2.4]
	}
};

export const LANDSCAPE_IDS = Object.keys(landscapes) as LandscapeId[];

// ---------------------------------------------------------------------- descent

export interface RunOptions {
	/** Learning rate η. */
	lr: number;
	/** Momentum β (0: plain gradient descent). */
	momentum?: number;
	/** Standard deviation σ of the noise added to the gradient (not used on `line`). */
	noise?: number;
	/** On `line`: examples per mini-batch (all of them by default: no noise). */
	batch?: number;
	seed?: number;
	/** Number of steps to take. */
	steps?: number;
}

export interface Run {
	/** Parameters and loss after each step (index 0: the starting point). */
	path: { x: number; y: number; loss: number }[];
	/** The run blew up: its last point is the first one far off the map. */
	diverged: boolean;
	/** First step from which the run stays within reach of where it ends (−1: never). */
	settledAt: number;
}

/** Standard normal pair (Box–Muller). */
function gaussian2(rand: () => number): [number, number] {
	const r = Math.sqrt(-2 * Math.log(1 - rand()));
	const a = 2 * Math.PI * rand();
	return [r * Math.cos(a), r * Math.sin(a)];
}

/** The examples of one mini-batch: `size` of them picked at random, without repeats. */
function miniBatch(rand: () => number, size: number) {
	const idx = examples.map((_, i) => i);
	for (let i = 0; i < size; i++) {
		const j = i + Math.floor(rand() * (idx.length - i));
		[idx[i], idx[j]] = [idx[j], idx[i]];
	}
	return idx.slice(0, size).map((i) => examples[i]);
}

/** Runs gradient descent from `start` and records every step. */
export function descend(land: Landscape, start: readonly [number, number], o: RunOptions): Run {
	const steps = o.steps ?? 300;
	const beta = o.momentum ?? 0;
	const batch = land.id === 'line' ? Math.round(o.batch ?? examples.length) : examples.length;
	const sigma = batch < examples.length ? 0 : (o.noise ?? 0);
	const rand = rng(o.seed ?? 1);
	// Far enough off the map that the run has clearly blown up.
	const span = Math.max(land.x[1] - land.x[0], land.y[1] - land.y[0]);
	const limit = 50 * span;

	let [x, y] = start;
	let vx = 0;
	let vy = 0;
	const path = [{ x, y, loss: land.f(x, y) }];
	let diverged = false;
	for (let k = 0; k < steps; k++) {
		let [gx, gy] =
			batch < examples.length ? lineGrad(x, y, miniBatch(rand, batch)) : land.grad(x, y);
		if (sigma > 0) {
			const [nx, ny] = gaussian2(rand);
			gx += sigma * nx;
			gy += sigma * ny;
		}
		vx = beta * vx - o.lr * gx;
		vy = beta * vy - o.lr * gy;
		x += vx;
		y += vy;
		const loss = land.f(x, y);
		if (!Number.isFinite(loss) || Math.abs(x) > limit || Math.abs(y) > limit) {
			diverged = true;
			// Keep the blown-up point finite, so it can still be drawn (off the map).
			const k2 = limit / Math.max(Math.abs(x), Math.abs(y), limit);
			x = Number.isFinite(x) ? x * k2 : limit;
			y = Number.isFinite(y) ? y * k2 : limit;
			path.push({ x, y, loss: Number.isFinite(loss) ? loss : Number.MAX_VALUE });
			break;
		}
		path.push({ x, y, loss });
	}

	let settledAt = -1;
	if (!diverged) {
		const end = path[path.length - 1];
		const tol = 0.01 * span;
		const [gx, gy] = land.grad(end.x, end.y);
		const still = Math.hypot(gx, gy) < 1e-3;
		if (still) {
			settledAt = path.length - 1;
			while (settledAt > 0) {
				const p = path[settledAt - 1];
				if (Math.hypot(p.x - end.x, p.y - end.y) > tol) break;
				settledAt--;
			}
		}
	}
	return { path, diverged, settledAt };
}

/** The minimum of the landscape nearest to a point. */
export function nearestMinimum(land: Landscape, x: number, y: number): Minimum {
	let bestM = land.minima[0];
	let bestD = Infinity;
	for (const m of land.minima) {
		const d = Math.hypot(m.x - x, m.y - y);
		if (d < bestD) {
			bestD = d;
			bestM = m;
		}
	}
	return bestM;
}

/**
 * Curvatures of the landscape at a point: the eigenvalues of its Hessian
 * (second derivatives), by finite differences of the gradient, largest first.
 * Plain descent near a minimum is stable only while η < 2 / (largest curvature).
 */
export function curvatures(land: Landscape, x: number, y: number): [number, number] {
	const h = 1e-5;
	const [gx, gy] = land.grad(x, y);
	const [ax, ay] = land.grad(x + h, y);
	const [bx, by] = land.grad(x, y + h);
	const hxx = (ax - gx) / h;
	const hyy = (by - gy) / h;
	const hxy = ((bx - gx) / h + (ay - gy) / h) / 2;
	const mean = (hxx + hyy) / 2;
	const r = Math.sqrt(((hxx - hyy) / 2) ** 2 + hxy * hxy);
	return [mean + r, mean - r];
}
