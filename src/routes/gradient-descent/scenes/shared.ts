/**
 * What the descent scene draws for a step, the layout of its panels, and the
 * geometry that only depends on the landscape (contours, surface mesh), cached
 * per landscape.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import {
	LANDSCAPE_IDS,
	descend,
	examples,
	landscapes,
	type Landscape,
	type LandscapeId,
	type Run
} from '../descent';

// ---------------------------------------------------------------------- layout

/** The contour map: a square on the right. */
export const MAP = { x: 548, y: 30, size: 372 };
/** The surface (or the data plot) on the left. */
export const LEFT = { x: 24, y: 16, w: 480, h: 384 };
/** The loss-per-step plot, bottom left. */
export const LOSS = { x: 78, y: 446, w: 410, h: 112 };

export type Phase = 'explore' | 'gradient' | 'run' | 'compare';

/** The three learning rates of the "compare" step, with their colours and verdicts. */
export const COMPARE = [
	{ lr: 0.05, color: 'var(--gd-run1)', verdict: 'too small: crawls' },
	{ lr: 0.6, color: 'var(--gd-run2)', verdict: 'about right: converges' },
	{ lr: 2.05, color: 'var(--gd-run3)', verdict: 'too big: diverges' }
];

export const STEPS = 300;

const num = (v: unknown, fallback: number) => {
	const n = Number(v);
	return v === undefined || v === '' || !Number.isFinite(n) ? fallback : n;
};

function parsePoint(raw: unknown): [number, number] | null {
	if (typeof raw !== 'string') return null;
	const [x, y] = raw.split(',').map(Number);
	return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/**
 * The step's landscape, starting point and descent settings: the reader's
 * control values where the step offers the control, the step's hints (or the
 * defaults) otherwise. The ball's starting point lives in `params[startKey]`
 * ("x,y"), written by the map's handle.
 */
export function setup(step: Step, params: Params) {
	const offered = new Map((step.controls ?? []).map((c) => [c.id.split('-')[0], c.id]));
	const hint = (id: string) => step.hints?.[id];
	const value = (id: string, fallback: number) => {
		const cid = offered.get(id);
		return cid ? num(params[cid], fallback) : num(hint(id), fallback);
	};
	const phase = String(hint('phase') ?? 'run') as Phase;
	const left = String(hint('left') ?? 'surface') as 'surface' | 'data';
	const landId = (
		offered.has('land') && LANDSCAPE_IDS.includes(params.land as LandscapeId)
			? params.land
			: (hint('land') ?? 'wells')
	) as LandscapeId;
	const land = landscapes[landId];
	// The two "explore" steps share their point, so dragging it on one carries to the other.
	const startKey = `start:${phase === 'explore' ? 'explore' : step.id}:${landId}`;
	const fallback = parsePoint(hint('start')) ?? land.start;
	const start = clampToMap(land, parsePoint(params[startKey]) ?? fallback);
	const lr = value('lr', 0.3);
	const momentum = value('momentum', 0);
	const noise = value('noise', 0);
	const batch = offered.has('batch') ? num(params.batch, examples.length) : examples.length;
	const seed = 1 + num(params.again, 0);
	const key = [step.id, landId, start.join(','), lr, momentum, noise, batch, seed].join('|');
	return { phase, left, land, start, startKey, lr, momentum, noise, batch, seed, key, offered };
}

export type Setup = ReturnType<typeof setup>;

export function clampToMap(land: Landscape, [x, y]: readonly [number, number]): [number, number] {
	return [Math.min(land.x[1], Math.max(land.x[0], x)), Math.min(land.y[1], Math.max(land.y[0], y))];
}

/** The runs the step shows: one, or the three of the comparison. */
export function runsFor(s: Setup): { run: Run; color: string; lr: number; label?: string }[] {
	if (s.phase === 'explore' || s.phase === 'gradient') return [];
	if (s.phase === 'compare') {
		return COMPARE.map((c) => ({
			run: descend(s.land, s.start, { lr: c.lr, steps: STEPS }),
			color: c.color,
			lr: c.lr,
			label: c.verdict
		}));
	}
	const run = descend(s.land, s.start, {
		lr: s.lr,
		momentum: s.momentum,
		noise: s.noise,
		batch: s.batch,
		seed: s.seed,
		steps: STEPS
	});
	return [{ run, color: 'var(--gd-ball)', lr: s.lr }];
}

// ---------------------------------------------------------------------- time

/**
 * How many steps have been taken τ seconds after a run started: after a short
 * pause, two steps a second for the first twelve (so each one can be followed),
 * then faster and faster.
 */
export function stepsAt(tau: number): number {
	const s = tau - 0.6;
	if (s <= 0) return 0;
	if (s < 6) return 2 * s;
	return 12 + 2 * (s - 6) + 1.5 * (s - 6) ** 2;
}

/**
 * Seconds since the run last changed (a new start, a new setting) or the step
 * restarted. It keeps a little state between frames: the documented exception
 * in docs/scene-guide.md for quantities that depend on when a control changed.
 */
export function createSince() {
	let key = '';
	let startedAt = 0;
	let lastT = 0;
	return (t: number, k: string) => {
		if (k !== key || t < lastT) {
			key = k;
			startedAt = t;
		}
		lastT = t;
		return t - startedAt;
	};
}

/** The ball's position at fractional step `kf`: a quick hop from one step to the next, then a rest. */
export function ballAt(run: Run, kf: number) {
	const last = run.path.length - 1;
	const k = Math.min(last, Math.floor(kf));
	const p = run.path[k];
	if (k >= last) return { x: p.x, y: p.y, loss: p.loss, k };
	const q = run.path[k + 1];
	const f = kf - k;
	const u = f >= 0.45 ? 1 : f / 0.45;
	const e = u * u * (3 - 2 * u);
	return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, loss: p.loss, k };
}

// ---------------------------------------------------------------------- map geometry

export const mapX = (land: Landscape, x: number) =>
	MAP.x + ((x - land.x[0]) / (land.x[1] - land.x[0])) * MAP.size;
export const mapY = (land: Landscape, y: number) =>
	MAP.y + MAP.size - ((y - land.y[0]) / (land.y[1] - land.y[0])) * MAP.size;
export const fromMap = (land: Landscape, px: number, py: number): [number, number] => [
	land.x[0] + ((px - MAP.x) / MAP.size) * (land.x[1] - land.x[0]),
	land.y[0] + ((MAP.y + MAP.size - py) / MAP.size) * (land.y[1] - land.y[0])
];

/** Colour of a loss level on the contour map: 0 at the bottom, 1 at the top. */
export const contourColor = (u: number) =>
	`color-mix(in oklab, var(--gd-c-high) ${Math.round(100 * Math.min(1, Math.max(0, u)))}%, var(--gd-c-low))`;
/** Colour of the surface at height u (0–1). */
export const surfaceColor = (u: number) =>
	`color-mix(in oklab, var(--gd-high) ${Math.round(100 * Math.min(1, Math.max(0, u)))}%, var(--gd-low))`;

const contourCache = new Map<LandscapeId, { level: number; u: number; d: string }[]>();

/** Contour lines of the landscape (marching squares), one SVG path per level, in map coordinates. */
export function contours(land: Landscape) {
	const cached = contourCache.get(land.id);
	if (cached) return cached;
	const N = 96;
	const xs = Array.from({ length: N + 1 }, (_, i) => land.x[0] + ((land.x[1] - land.x[0]) * i) / N);
	const ys = Array.from({ length: N + 1 }, (_, j) => land.y[0] + ((land.y[1] - land.y[0]) * j) / N);
	const F = ys.map((y) => xs.map((x) => land.f(x, y)));
	const top = land.levels[land.levels.length - 1];
	const out = land.levels.map((level) => {
		let d = '';
		const P = (i: number, j: number) => [mapX(land, xs[i]), mapY(land, ys[j])];
		for (let j = 0; j < N; j++) {
			for (let i = 0; i < N; i++) {
				const v = [F[j][i], F[j][i + 1], F[j + 1][i + 1], F[j + 1][i]];
				const corners = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
				const pts: number[][] = [];
				for (let e = 0; e < 4; e++) {
					const a = v[e];
					const b = v[(e + 1) % 4];
					if (a < level !== b < level) {
						const f = (level - a) / (b - a);
						const A = corners[e];
						const B = corners[(e + 1) % 4];
						pts.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]);
					}
				}
				for (let s = 0; s + 1 < pts.length; s += 2) {
					d += `M${pts[s][0].toFixed(1)} ${pts[s][1].toFixed(1)}L${pts[s + 1][0].toFixed(1)} ${pts[s + 1][1].toFixed(1)}`;
				}
			}
		}
		return { level, u: Math.sqrt(level / top), d };
	});
	contourCache.set(land.id, out);
	return out;
}

// ---------------------------------------------------------------------- surface geometry

const AZ = -0.45;
const SIN_EL = 0.5;
const SURF = { ox: 264, oy: 282, scale: 150, height: 150 };

/** Height of the drawn surface for a loss (0 at the lowest minimum, 1 at the cap). */
export const heightOf = (land: Landscape, loss: number) => {
	const lo = land.minima[0].value;
	return Math.min(1, Math.max(0, (loss - lo) / (land.cap - lo)));
};

/** Screen position of the surface point above (x, y) at height z (0–1). */
export function project(land: Landscape, x: number, y: number, z: number) {
	const X = (2 * (x - land.x[0])) / (land.x[1] - land.x[0]) - 1;
	const Y = (2 * (y - land.y[0])) / (land.y[1] - land.y[0]) - 1;
	const u = X * Math.cos(AZ) - Y * Math.sin(AZ);
	const d = X * Math.sin(AZ) + Y * Math.cos(AZ);
	return { x: SURF.ox + SURF.scale * u, y: SURF.oy - SURF.scale * SIN_EL * d - SURF.height * z };
}

export interface Mesh {
	/** Rows of the grid, back to front: their filled patches (one per colour band), then their lines. */
	rows: { key: string; patches: { key: string; d: string; fill: string }[]; line: string }[];
}

const meshCache = new Map<LandscapeId, Mesh>();

/**
 * The surface as a grid of quadrilaterals drawn back to front. With this view
 * every row of constant w₂ lies entirely behind the rows of smaller w₂ that it
 * can overlap on screen, so drawing the rows from the back is enough to hide
 * what is behind (the painter's algorithm).
 */
export function mesh(land: Landscape): Mesh {
	const cached = meshCache.get(land.id);
	if (cached) return cached;
	const N = 36;
	const BANDS = 12;
	const xs = Array.from({ length: N + 1 }, (_, i) => land.x[0] + ((land.x[1] - land.x[0]) * i) / N);
	const ys = Array.from({ length: N + 1 }, (_, j) => land.y[0] + ((land.y[1] - land.y[0]) * j) / N);
	const Z = ys.map((y) => xs.map((x) => heightOf(land, land.f(x, y))));
	const P = ys.map((y, j) => xs.map((x, i) => project(land, x, y, Z[j][i])));
	const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
	const rows: Mesh['rows'] = [];
	for (let j = N - 1; j >= 0; j--) {
		const patches: Mesh['rows'][number]['patches'] = [];
		const byBand = new Map<number, string>();
		for (let i = 0; i < N; i++) {
			const z = (Z[j][i] + Z[j][i + 1] + Z[j + 1][i] + Z[j + 1][i + 1]) / 4;
			const band = Math.min(BANDS - 1, Math.floor(Math.sqrt(z) * BANDS));
			const quad = `M${pt(P[j][i])}L${pt(P[j][i + 1])}L${pt(P[j + 1][i + 1])}L${pt(P[j + 1][i])}Z`;
			byBand.set(band, (byBand.get(band) ?? '') + quad);
		}
		for (const [band, d] of byBand) {
			patches.push({ key: `${j}-${band}`, d, fill: surfaceColor((band + 0.5) / BANDS) });
		}
		let d = `M${pt(P[j][0])}`;
		for (let i = 1; i <= N; i++) d += `L${pt(P[j][i])}`;
		if (j === N - 1) {
			d += `M${pt(P[N][0])}`;
			for (let i = 1; i <= N; i++) d += `L${pt(P[N][i])}`;
		}
		for (let i = 0; i <= N; i += 2) d += `M${pt(P[j][i])}L${pt(P[j + 1][i])}`;
		rows.push({ key: String(j), patches, line: d });
	}
	const m = { rows };
	meshCache.set(land.id, m);
	return m;
}

/** A compact number for readouts: 3 significant figures, no exponent below 10⁶. */
export function fmt(v: number) {
	return fmtRaw(v).replaceAll('-', '−');
}
function fmtRaw(v: number) {
	if (!Number.isFinite(v) || Math.abs(v) >= 1e6) return v > 0 ? 'huge' : '−huge';
	if (v === 0) return '0';
	const a = Math.abs(v);
	if (a < 5e-7) return '0';
	if (a >= 100) return v.toFixed(0);
	if (a >= 10) return v.toFixed(1);
	if (a >= 0.001) return Number(v.toPrecision(3)).toString();
	return v.toExponential(1);
}

/** Text width estimate for the sans-serif stage font. */
export const textWidth = (text: string, size: number) => text.length * size * 0.56;
