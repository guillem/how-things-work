/** What the random-graph scenes share: colours, a drawing layout, circle paths and number formats. */
import { rng } from '#lib/draw/math.ts';
import { linksAt, type RandomGraph } from '../model';

/** Colours by piece: the largest, the second largest, other pieces of 3 or more, pairs, single nodes. */
export const PIECE = [
	'var(--rg-giant)',
	'var(--rg-second)',
	'var(--rg-mid)',
	'var(--rg-pair)',
	'var(--stage-ink-muted)'
];

/** One colour per graph size in the sweep, small to large. */
export const sizeColor = (k: number) => `var(--rg-n${k})`;

/** A share as a percentage with `digits` decimals, without trailing zeros. */
export const pct = (v: number, digits = 0) => `${Number((v * 100).toFixed(digits))} %`;

/** n with thousands separators. */
export const fmt = (n: number) => n.toLocaleString('en-US');

/** An SVG path of full circles of radius r centred on the points (one node per circle). */
export function circles(xs: readonly number[], ys: readonly number[], r: number): string {
	let d = '';
	for (let i = 0; i < xs.length; i++) {
		const x = xs[i];
		const y = ys[i];
		d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
	}
	return d;
}

/**
 * Positions for drawing the graph (Fruchterman & Reingold's spring layout of the graph at average
 * degree `cLayout`, from seeded starting points), scaled into the unit square. Only the drawing
 * uses them: in the model, nodes have no position.
 */
export function springLayout(g: RandomGraph, cLayout: number, seed: number): Float64Array {
	const { n } = g;
	const rand = rng(seed * 977 + n);
	const x = new Float64Array(n);
	const y = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		x[i] = rand();
		y[i] = rand();
	}
	const m = linksAt(g, cLayout);
	const k = 1 / Math.sqrt(n);
	const dx = new Float64Array(n);
	const dy = new Float64Array(n);
	const ITER = 160;
	for (let it = 0; it < ITER; it++) {
		dx.fill(0);
		dy.fill(0);
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const ex = x[i] - x[j];
				const ey = y[i] - y[j];
				const d2 = Math.max(ex * ex + ey * ey, 1e-6);
				const f = (k * k) / d2;
				dx[i] += ex * f;
				dy[i] += ey * f;
				dx[j] -= ex * f;
				dy[j] -= ey * f;
			}
		}
		for (let e = 0; e < m; e++) {
			const i = g.a[e];
			const j = g.b[e];
			const ex = x[i] - x[j];
			const ey = y[i] - y[j];
			const d = Math.sqrt(ex * ex + ey * ey) + 1e-9;
			const f = d / k;
			dx[i] -= ex * f;
			dy[i] -= ey * f;
			dx[j] += ex * f;
			dy[j] += ey * f;
		}
		const temp = 0.1 * (1 - it / ITER) + 0.002;
		for (let i = 0; i < n; i++) {
			// a weak pull to the middle keeps single nodes from drifting off
			dx[i] += (0.5 - x[i]) * 2;
			dy[i] += (0.5 - y[i]) * 2;
			const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) + 1e-9;
			const step = Math.min(len, temp);
			x[i] += (dx[i] / len) * step;
			y[i] += (dy[i] / len) * step;
		}
	}
	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (let i = 0; i < n; i++) {
		x0 = Math.min(x0, x[i]);
		x1 = Math.max(x1, x[i]);
		y0 = Math.min(y0, y[i]);
		y1 = Math.max(y1, y[i]);
	}
	const s = Math.max(x1 - x0, y1 - y0, 1e-9);
	const out = new Float64Array(2 * n);
	for (let i = 0; i < n; i++) {
		out[2 * i] = (x[i] - x0) / s + (s - (x1 - x0)) / (2 * s);
		out[2 * i + 1] = (y[i] - y0) / s + (s - (y1 - y0)) / (2 * s);
	}
	return out;
}
