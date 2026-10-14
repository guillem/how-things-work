/**
 * Shared pieces of the neural-network scenes: the network scene's setup (which run a step
 * shows), its clock, the layout, and the shading of the plane (banded cells merged into one
 * path per band, and the 50/50 boundary by marching squares).
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import {
	ACTIVATIONS,
	DATASET_IDS,
	forward,
	runKey,
	type Activation,
	type DatasetId,
	type Net,
	type RunSpec
} from '../network';

// ---------------------------------------------------------------------- the network scene's run

export const MAX_EPOCHS = 500;

const num = (v: unknown, fallback: number) => {
	const n = Number(v);
	return v === undefined || v === '' || !Number.isFinite(n) ? fallback : n;
};

/**
 * The run a network step shows: the reader's control values where the step offers the
 * control (control ids are `<setting>-<step>`), the step's hints (or defaults) otherwise.
 */
export function setup(step: Step, params: Params) {
	const offered = new Map((step.controls ?? []).map((c) => [c.id.split('-')[0], c.id]));
	const hint = (id: string) => step.hints?.[id];
	const raw = (id: string) => {
		const cid = offered.get(id);
		return cid ? params[cid] : hint(id);
	};
	const dataRaw = String(raw('data') ?? 'circle');
	const data: DatasetId = DATASET_IDS.includes(dataRaw as DatasetId)
		? (dataRaw as DatasetId)
		: 'circle';
	const actRaw = String(raw('act') ?? 'tanh');
	const act: Activation = ACTIVATIONS.includes(actRaw as Activation)
		? (actRaw as Activation)
		: 'tanh';
	const layers = Math.round(Math.min(3, Math.max(0, num(raw('layers'), 1))));
	const neurons = Math.round(Math.min(8, Math.max(1, num(raw('neurons'), 4))));
	const lr = num(raw('lr'), 0.3);
	const seed = num(hint('seed'), 1) + num(raw('again'), 0);
	const spec: RunSpec = { data, hidden: Array<number>(layers).fill(neurons), act, lr, seed };
	return { spec, curve: hint('curve') === true, key: `${step.id}|${runKey(spec)}` };
}

// ---------------------------------------------------------------------- time

/**
 * Epochs trained τ seconds after a run started: after a short pause, three a second for the
 * first four seconds (so the first changes can be followed), then faster and faster, up to
 * MAX_EPOCHS after about 18 s.
 */
export function epochsAt(tau: number): number {
	const s = tau - 0.6;
	if (s <= 0) return 0;
	const e = s < 4 ? 3 * s : 12 + 3 * (s - 4) + 2 * (s - 4) ** 2;
	return Math.min(MAX_EPOCHS, Math.floor(e));
}

/**
 * Seconds since the run last changed (a new setting) or the step restarted. It keeps a
 * little state between frames: the documented exception in docs/scene-guide.md for
 * quantities that depend on when a control changed.
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

// ---------------------------------------------------------------------- shading

/**
 * Fill for a value u in [−1, 1]: orange (class 0) below 0, blue (class 1) above, fading to
 * the neutral middle at 0. `strength` caps how saturated the far ends get.
 */
export function shade(u: number, strength: number) {
	const k = Math.round(100 * strength * Math.min(1, Math.abs(u)));
	return `color-mix(in oklab, var(${u < 0 ? '--nn-a-fill' : '--nn-b-fill'}) ${k}%, var(--nn-mid))`;
}

export interface Band {
	key: string;
	d: string;
	fill: string;
}

/**
 * A grid of values (rows from the top, u in [−1, 1]) drawn as rectangles at (x, y, size), one
 * path per colour band: runs of equal band along a row become one rectangle.
 */
export function bands(
	grid: number[][],
	x: number,
	y: number,
	size: number,
	levels: number,
	strength: number
): Band[] {
	const n = grid.length;
	const c = size / n;
	const paths = new Map<number, string>();
	const bandOf = (u: number) =>
		Math.max(-levels, Math.min(levels, Math.round(Math.max(-1, Math.min(1, u)) * levels)));
	for (let j = 0; j < n; j++) {
		let i = 0;
		while (i < n) {
			const b = bandOf(grid[j][i]);
			let k = i + 1;
			while (k < n && bandOf(grid[j][k]) === b) k++;
			const r = `M${(x + i * c).toFixed(1)} ${(y + j * c).toFixed(1)}h${((k - i) * c + 0.4).toFixed(1)}v${(c + 0.4).toFixed(1)}h${(-(k - i) * c - 0.4).toFixed(1)}z`;
			paths.set(b, (paths.get(b) ?? '') + r);
			i = k;
		}
	}
	return [...paths].map(([b, d]) => ({ key: String(b), d, fill: shade(b / levels, strength) }));
}

/** The zero line of a grid of values (at cell centres), as one SVG path (marching squares). */
export function zeroLine(grid: number[][], x: number, y: number, size: number) {
	const n = grid.length;
	const c = size / n;
	const P = (i: number, j: number) => [x + (i + 0.5) * c, y + (j + 0.5) * c];
	let d = '';
	for (let j = 0; j + 1 < n; j++) {
		for (let i = 0; i + 1 < n; i++) {
			const v = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
			const corners = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
			const pts: number[][] = [];
			for (let e = 0; e < 4; e++) {
				const a = v[e];
				const b = v[(e + 1) % 4];
				if (a < 0 !== b < 0) {
					const f = a / (a - b);
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
	return d;
}

/** Plane coordinate (−1 … 1) of cell i of an n-cell grid, at its centre. */
export const cellCoord = (i: number, n: number) => -1 + (2 * (i + 0.5)) / n;

/**
 * Every neuron's output over the plane, on an n × n grid (rows from the top: x₂ = +1 first),
 * scaled to [−1, 1]: tanh as it is, the output's probability p as 2p − 1, ReLU and linear
 * outputs by the largest size on the grid. result[l][j] is neuron j of layer l (0 = inputs).
 */
export function neuronGrids(net: Net, n: number): number[][][][] {
	const L = net.sizes.length;
	const out: number[][][][] = net.sizes.map((m) =>
		Array.from({ length: m }, () => Array.from({ length: n }, () => new Array<number>(n)))
	);
	for (let j = 0; j < n; j++) {
		const x2 = -cellCoord(j, n);
		for (let i = 0; i < n; i++) {
			const x1 = cellCoord(i, n);
			const { a } = forward(net, [x1, x2]);
			for (let l = 0; l < L; l++) for (let k = 0; k < a[l].length; k++) out[l][k][j][i] = a[l][k];
		}
	}
	for (let l = 1; l < L; l++) {
		const f = l === L - 1 ? 'sigmoid' : net.act;
		for (const g of out[l]) {
			if (f === 'sigmoid') {
				for (const row of g) for (let i = 0; i < n; i++) row[i] = 2 * row[i] - 1;
			} else if (f !== 'tanh') {
				let m = 1e-9;
				for (const row of g) for (const v of row) m = Math.max(m, Math.abs(v));
				for (const row of g) for (let i = 0; i < n; i++) row[i] /= m;
			}
		}
	}
	return out;
}

/** The output's 2p − 1 over the plane on an n × n grid (rows from the top). */
export function outputGrid(net: Net, n: number): number[][] {
	const g: number[][] = [];
	for (let j = 0; j < n; j++) {
		const x2 = -cellCoord(j, n);
		const row: number[] = [];
		for (let i = 0; i < n; i++) {
			const { a } = forward(net, [cellCoord(i, n), x2]);
			row.push(2 * a[a.length - 1][0] - 1);
		}
		g.push(row);
	}
	return g;
}

// ---------------------------------------------------------------------- points

/** All the examples of one class as one path of small discs. */
export function dots(pts: readonly { px: number; py: number }[], r: number) {
	let d = '';
	for (const p of pts) {
		d += `M${(p.px - r).toFixed(1)} ${p.py.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	}
	return d;
}

// ---------------------------------------------------------------------- text

/** A compact number for readouts: 3 significant figures, a proper minus sign. */
export function fmt(v: number, digits = 3) {
	if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
	if (v === 0) return '0';
	const a = Math.abs(v);
	const s =
		a >= 100
			? v.toFixed(0)
			: a >= 0.001
				? String(Number(v.toPrecision(digits)))
				: v.toExponential(1);
	return s.replace('-', '−');
}

/** A number with a fixed number of decimals and a proper minus sign. */
export const fix = (v: number, d = 2) =>
	(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d).replace('-', '−');

/** Text width estimate for the sans-serif stage font. */
export const textWidth = (text: string, size: number) => text.length * size * 0.56;

export const ACT_NAMES: Record<Activation, string> = {
	tanh: 'tanh',
	relu: 'ReLU',
	linear: 'none',
	sigmoid: 'sigmoid'
};
