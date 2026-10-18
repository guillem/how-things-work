/**
 * The ECG and arrhythmias: a sheet of heart muscle as an excitable medium, with a hand-built
 * conduction system, and the pseudo-ECG read off it.
 *
 * Every cell follows the Aliev–Panfilov equations (Aliev & Panfilov, Chaos Solitons Fractals 7,
 * 293, 1996), in the variant with separate thresholds a and b used in spiral-wave studies
 * (k = 8, ε₀ = 0.01, μ₁ = 0.11, μ₂ = 0.3, b = 0.1, a = 0.15):
 *
 *     ∂u/∂t = ∇·(D∇u) − k u (u − a)(u − 1) − u v + I
 *     ∂v/∂t = r · ε(u, v) · (−v − k u (u − b − 1)),     ε = ε₀ + μ₁ v / (u + μ₂)
 *
 * u is the cell's voltage (0 at rest, about 1 when excited), v its slow recovery, I a stimulus or
 * the current from a junction. r scales how fast a cell recovers (the length of its action
 * potential); the page varies it from the apex of the ventricles to their base, and in patches.
 *
 * Units: one time unit is MS_PER_TU milliseconds, chosen so that a ventricular cell's action
 * potential lasts about 280 ms; distance is in cells of the grid. D sets the conduction speed
 * (about 1.33·√D cells per time unit): healthy ventricles conduct at about 0.6 cells/ms, so a
 * wave crosses them in about 200 ms, and with a 280 ms action potential the wave is longer than
 * the sheet, as it is in a healthy heart. Disease slows conduction (D_SLOW), which
 * shortens the wave until a loop can hold it.
 *
 * The sheet (W × H cells, x to the patient's left, y down, as the frontal plane is drawn): the
 * atria on top, an insulating ring (the fibrous skeleton), the ventricles below. The conduction
 * system is a tree of one-dimensional cables laid over the sheet: the AV node (slow, the only
 * way across the ring), the His bundle, the bundle branches and Purkinje fibres (fast). The AV
 * node takes the wave from the atrial cell under its start, and the Purkinje fibres hand it to
 * the ventricular cells under their junctions; both junctions pass it one way only. The layout
 * is hand-built, not anatomy.
 *
 * The pseudo-ECG: the sheet's net dipole p = −Σ ∇u (each face between two coupled cells adds the
 * voltage step across it), the atria weighted by ATRIAL_WEIGHT for their thinner walls. Each limb
 * lead of Einthoven's triangle reads p projected onto its axis: I at 0°, II at +60°, III at +120°
 * (clockwise from the patient's left, y down), so that II = I + III at every instant (Einthoven's
 * law). It is the far-field dipole of a flat sheet, not a body-surface 12-lead ECG.
 *
 * Numerics: reactions explicitly (Euler, time step DT), then diffusion implicitly: backward
 * Euler along the rows and then along the columns of the sheet, and exactly on the cable tree.
 * Cells outside the tissue are inert; the tissue's edges let no current through.
 */
import { rng } from '#lib/draw/math.ts';

// ------------------------------------------------------------------------------- constants
export const W = 120;
export const H = 140;
export const N = W * H;
/** Time step, model time units. */
export const DT = 0.05;
/** Milliseconds per model time unit. */
export const MS_PER_TU = 8;
/** Milliseconds per time step. */
export const STEP_MS = DT * MS_PER_TU;
const K = 8;
const A = 0.15;
const B = 0.1;
const E0 = 0.01;
const M1 = 0.11;
const M2 = 0.3;
/** Diffusion constants (cells² per time unit). Atria conduct a little faster than ventricles. */
export const D_ATRIA = 30;
export const D_VENTRICLE = 12;
/** Ventricles slowed by disease: conduction about five times slower. */
export const D_SLOW = 0.5;
/** Purkinje fibres: about four times the ventricles' speed. */
const D_FAST = 200;
/** The His bundle. */
const D_HIS = 20;
/** Coupling of a one-way relay between cables. */
const G_RELAY = 60;
/** The AV node at full conduction. */
const D_AV = 0.7;
/** Below this AV conduction the AV node passes nothing. */
export const AV_NONE = 0.1;
/** Coupling of a junction between a cable and a muscle cell. */
const G_JUNCTION = 12;
/** Thickness weight of the atria's dipole (thin walls) relative to the ventricles'. */
export const ATRIAL_WEIGHT = 0.2;
/** Thickness weight of the right ventricle's dipole relative to the left's. */
export const RV_WEIGHT = 0.4;
const smooth01 = (s: number) => {
	const c = Math.max(0, Math.min(1, s));
	return c * c * (3 - 2 * c);
};
/** One ECG sample every ECG_EVERY_MS. */
export const ECG_EVERY_MS = 2;
/** Length of the ECG record kept, ms. */
export const ECG_KEEP_MS = 12000;
/** A junctional escape pacemaker fires when the His bundle has been silent this long (40 a minute). */
export const ESCAPE_MS = 1500;
/** Ventricular firings closer than this belong to one beat. */
const BEAT_GAP_MS = 30;
/** Stimulus current and length. */
const STIM = 6;
const STIM_MS = 12;

// cell kinds
export const OUT = 0;
export const ATRIUM = 1;
export const VENTRICLE = 2;
export const SCAR = 3;

/** The sinus node: the cells within SA_R of SA. */
export const SA: [number, number] = [26, 12];
/** Probe cells: one in the atria, one in the ventricles (far from the scar). */
export const PROBE_A: [number, number] = [84, 18];
export const PROBE_V: [number, number] = [36, 70];
const SA_R = 4;
/** Where an early (ectopic) beat starts: a spot in the left ventricle's wall. */
export const ECTOPIC: [number, number] = [74, 104];
const ECTOPIC_R = 3;
/** The scar: dead, non-conducting tissue (centre, radii). */
export const SCAR_C: [number, number] = [74, 92];
export const SCAR_R: [number, number] = [8, 6];

// ------------------------------------------------------------------------------- geometry
export function inAtria(x: number, y: number) {
	return y >= 3 && y <= 32 && ((x - 60) / 50) ** 2 + ((y - 20) / 17) ** 2 <= 1;
}
export function inVentricles(x: number, y: number) {
	if (y < 38 || y > 136) return false;
	const half = y <= 60 ? 54 : 54 * Math.sqrt(Math.max(0, 1 - ((y - 60) / 77) ** 2));
	return Math.abs(x - 60) <= half;
}
export const inEllipse = (x: number, y: number, c: [number, number], r: [number, number]) =>
	((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 <= 1;

// ------------------------------------------------------------------------------- the conduction system
export interface Cable {
	name: string;
	kind: 'av' | 'his' | 'fast';
	/** Node positions (cell coordinates), about one cell apart. */
	pts: [number, number][];
	/** Index of the first node with a junction to the muscle. */
	junctionsFrom: number;
	/** The cable this one starts from, at its node `at` (−1: the last). */
	parent?: string;
	at?: number;
}

/** Points about one cell apart along a polyline. */
function polyline(pts: [number, number][]): [number, number][] {
	const out: [number, number][] = [pts[0]];
	for (let s = 1; s < pts.length; s++) {
		const [x0, y0] = pts[s - 1];
		const [x1, y1] = pts[s];
		const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
		for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
	}
	return out;
}

const fan = (
	name: string,
	parent: string,
	at: number,
	pts: [number, number][],
	junctionsFrom = 4
): Cable => ({ name, kind: 'fast', junctionsFrom, parent, at, pts: polyline(pts) });

/** The conduction system: a tree rooted at the AV node's first node. */
export const CABLES: Cable[] = [
	{
		name: 'av',
		kind: 'av',
		junctionsFrom: Infinity,
		pts: polyline([
			[53, 30],
			[56, 34],
			[58, 37],
			[60, 40]
		])
	},
	{
		name: 'his',
		kind: 'his',
		junctionsFrom: Infinity,
		parent: 'av',
		at: -1,
		pts: polyline([
			[60, 41],
			[60, 52]
		])
	},
	fan(
		'right',
		'his',
		-1,
		[
			[58, 54],
			[54, 80],
			[48, 110],
			[36, 124],
			[20, 110],
			[10, 84],
			[8, 56],
			[12, 42]
		],
		12
	),
	fan(
		'left',
		'his',
		-1,
		[
			[62, 54],
			[66, 80],
			[72, 110],
			[84, 124],
			[100, 110],
			[110, 84],
			[112, 56],
			[108, 42]
		],
		12
	),
	fan('septal', 'his', -1, [
		[60, 54],
		[60, 72],
		[59, 100],
		[60, 128]
	]),
	fan('r1', 'right', 26, [
		[54, 80],
		[38, 70],
		[28, 56],
		[26, 42]
	]),
	fan('r2', 'right', 75, [
		[36, 124],
		[30, 100],
		[30, 84]
	]),
	fan('r3', 'right', 120, [
		[10, 84],
		[24, 92],
		[42, 96]
	]),
	fan('r4', 'right', 12, [
		[56, 66],
		[44, 52],
		[40, 42]
	]),
	fan('l1', 'left', 26, [
		[66, 80],
		[82, 70],
		[92, 56],
		[94, 42]
	]),
	fan('l2', 'left', 75, [
		[84, 124],
		[90, 100],
		[90, 84]
	]),
	fan('l3', 'left', 120, [
		[110, 84],
		[96, 92],
		[78, 96]
	]),
	fan('l4', 'left', 12, [
		[64, 66],
		[76, 52],
		[80, 42]
	])
];
/** Nodes between junctions on a fast cable. */
const JUNCTION_EVERY = 6;

// ------------------------------------------------------------------------------- options
export interface Options {
	/** Sinus node rate, beats a minute; 0 stops it. */
	rate: number;
	/** AV node conduction: 1 normal, lower is weaker, below AV_NONE none (complete block). */
	av: number;
	/** The junctional escape pacemaker is there to take over. */
	escape: boolean;
	/**
	 * Cells towards the lower left of the ventricles (activated last) have shorter action
	 * potentials, so they recover first (see `Heart`).
	 */
	gradient: boolean;
	/** The ventricles conduct slowly (D_SLOW), as in diseased muscle. */
	slow: boolean;
	/** Patchy recovery: half of the ventricles' 10 × 10 patches recover at half speed. */
	patchy: boolean;
	/** A scar: a patch of dead, non-conducting muscle. */
	scar: boolean;
	/** Seed of the patch map. */
	seed: number;
}
export const DEFAULTS: Options = {
	rate: 75,
	av: 1,
	escape: true,
	gradient: true,
	slow: false,
	patchy: false,
	scar: false,
	seed: 3
};

// ------------------------------------------------------------------------------- the heart
interface Stim {
	cells: number[];
	nodes: number[];
	until: number;
}

export interface Beat {
	/** When the ventricles' first cell fired, ms. */
	onset: number;
	/** When their last cell fired, ms (the activation's length, about the QRS's). */
	end: number;
}

const isTissue = (k: number) => k === ATRIUM || k === VENTRICLE;

/** Factors of a tridiagonal (Thomas) solve along lines of the grid, precomputed. */
interface Lines {
	/** Modified upper coefficients c′ and inverse pivots, per cell. */
	cp: Float32Array;
	inv: Float32Array;
	/** The lower coefficient a, per cell. */
	lo: Float32Array;
}

export class Heart {
	readonly o: Options;
	readonly kind = new Uint8Array(N);
	readonly u = new Float32Array(N);
	readonly v = new Float32Array(N);
	private src = new Float32Array(N);
	private gx = new Float32Array(N);
	private gy = new Float32Array(N);
	private rec = new Float32Array(N);
	/** Each cell's share of the dipole: the thickness of its wall. */
	private weight = new Float32Array(N);
	private tissue: Int32Array;
	private rows: Lines;
	private cols: Lines;
	private tmp = new Float32Array(Math.max(W, H));
	/** Time each cell last fired, ms. */
	readonly fired = new Float32Array(N).fill(-1e9);
	/** Whether each cell is above threshold. */
	private up = new Uint8Array(N);
	// cables
	readonly cu: Float32Array;
	readonly cv: Float32Array;
	private csrc: Float32Array;
	private crec: Float32Array;
	/** Parent of each cable node (−1 for the root) and the coupling to it; nodes in tree order. */
	private parent: Int32Array;
	private cg: Float32Array;
	private cdiag: Float32Array;
	private crhs: Float32Array;
	/** [node, cell, direction]: +1 cable → muscle, −1 muscle → cable. */
	readonly junctions: [number, number, number][] = [];
	/** [from node, to node]: one-way relays between cables. */
	private relays: [number, number][] = [];
	/** Index of each cable's first node in the cable arrays. */
	readonly cableStart: number[] = [];
	readonly cfired: Float32Array;
	private hisNode = 0;
	private probeA = PROBE_A[1] * W + PROBE_A[0];
	private probeV = PROBE_V[1] * W + PROBE_V[0];
	private saCells: number[];
	// clock and records
	steps = 0;
	private stims: Stim[] = [];
	private nextSinus = 100;
	/** Sinus node firings, ms. */
	readonly sinus: number[] = [];
	/** Escape firings, ms. */
	readonly escapes: number[] = [];
	/** Early beats delivered, ms. */
	readonly ectopics: number[] = [];
	/** Shocks delivered, ms. */
	readonly shocks: number[] = [];
	/** Ventricular beats: onset and end of activation. */
	readonly beats: Beat[] = [];
	/** The dipole's x and y, one sample every ECG_EVERY_MS. */
	readonly px: Float32Array;
	/** The voltage of the ventricular probe cell, sampled with the ECG. */
	readonly pu: Float32Array;
	/** Firing times of the probe cells: [atrial, ventricular]. */
	readonly probeFires: [number[], number[]] = [[], []];
	readonly py: Float32Array;
	samples = 0;
	readonly ventricleCount: number;
	private activeV = 0;

	constructor(o: Partial<Options> = {}) {
		this.o = { ...DEFAULTS, ...o };
		const opt = this.o;
		const rand = rng(opt.seed);
		const PATCH = 10;
		const pw = Math.ceil(W / PATCH);
		const patchSlow = Array.from({ length: pw * Math.ceil(H / PATCH) }, () => rand() < 0.5);
		const list: number[] = [];
		let nv = 0;
		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++) {
				const i = y * W + x;
				let k = inAtria(x, y) ? ATRIUM : inVentricles(x, y) ? VENTRICLE : OUT;
				if (k === VENTRICLE && opt.scar && inEllipse(x, y, SCAR_C, SCAR_R)) k = SCAR;
				this.kind[i] = k;
				if (isTissue(k)) list.push(i);
				let r = 1;
				if (k === VENTRICLE) {
					nv++;
					// recovery speeds up along the +60° axis (towards the patient's lower left)
					const along = (0.5 * (x - 60) + 0.866 * (y - 85)) / 55;
					if (opt.gradient) r = 1.12 + 0.25 * Math.max(-1, Math.min(1, along));
					if (opt.patchy && patchSlow[Math.floor(y / PATCH) * pw + Math.floor(x / PATCH)]) r *= 0.5;
				}
				this.rec[i] = r;
				// walls: the atria thin, the left ventricle (patient's left, x > 60) thicker than the right
				this.weight[i] =
					k === ATRIUM ? ATRIAL_WEIGHT : RV_WEIGHT + (1 - RV_WEIGHT) * smooth01((x - 52) / 16);
			}
		this.ventricleCount = nv;
		this.tissue = Int32Array.from(list);
		const D = (i: number) => {
			const k = this.kind[i];
			if (k === ATRIUM) return D_ATRIA;
			if (k === VENTRICLE) return opt.slow ? D_SLOW : D_VENTRICLE;
			return 0;
		};
		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++) {
				const i = y * W + x;
				const d = D(i);
				if (!d) continue;
				if (x < W - 1 && D(i + 1)) this.gx[i] = (2 * d * D(i + 1)) / (d + D(i + 1));
				if (y < H - 1 && D(i + W)) this.gy[i] = (2 * d * D(i + W)) / (d + D(i + W));
			}
		this.rows = this.factor(this.gx, 1, W, H, W);
		this.cols = this.factor(this.gy, W, H, W, 1);

		// the cable tree
		let n = 0;
		for (const c of CABLES) {
			this.cableStart.push(n);
			n += c.pts.length;
		}
		this.cu = new Float32Array(n);
		this.cv = new Float32Array(n);
		this.csrc = new Float32Array(n);
		this.crec = new Float32Array(n).fill(1);
		this.cfired = new Float32Array(n).fill(-1e9);
		this.parent = new Int32Array(n).fill(-1);
		this.cg = new Float32Array(n);
		const cellAt = (p: [number, number]) => Math.round(p[1]) * W + Math.round(p[0]);
		CABLES.forEach((c, ci) => {
			const s = this.cableStart[ci];
			const g = c.kind === 'av' ? D_AV * opt.av : c.kind === 'his' ? D_HIS : D_FAST;
			for (let k = 1; k < c.pts.length; k++) {
				this.parent[s + k] = s + k - 1;
				this.cg[s + k] = g;
			}
			if (c.parent) {
				const pi = CABLES.findIndex((p) => p.name === c.parent);
				const at = c.at === undefined || c.at < 0 ? CABLES[pi].pts.length - 1 : c.at;
				const from = this.cableStart[pi] + at;
				// from the AV node into the His bundle, and from the His bundle into the branches,
				// the wave is relayed one way (a slow, thin source could not drive a fast cable)
				if (c.kind === 'his' || c.parent === 'his') this.relays.push([from, s]);
				else {
					this.parent[s] = from;
					this.cg[s] = g;
				}
			}
			if (c.kind === 'av') {
				for (let k = 0; k < c.pts.length; k++) this.crec[s + k] = 0.6 * opt.av;
				// below AV_NONE the node conducts nothing at all: complete block
				if (opt.av >= AV_NONE) this.junctions.push([s, cellAt(c.pts[0]), -1]);
			}
			if (c.kind === 'his') this.hisNode = s;
			for (let k = c.junctionsFrom; k < c.pts.length; k += JUNCTION_EVERY) {
				const cell = cellAt(c.pts[k]);
				if (isTissue(this.kind[cell])) this.junctions.push([s + k, cell, 1]);
			}
			if (c.junctionsFrom < c.pts.length) {
				const cell = cellAt(c.pts[c.pts.length - 1]);
				if (isTissue(this.kind[cell])) this.junctions.push([s + c.pts.length - 1, cell, 1]);
			}
		});
		// the tree's diagonal after eliminating the leaves (nodes are numbered parents first)
		this.cdiag = new Float32Array(n).fill(1);
		for (let k = 0; k < n; k++)
			if (this.parent[k] >= 0) {
				this.cdiag[k] += DT * this.cg[k];
				this.cdiag[this.parent[k]] += DT * this.cg[k];
			}
		for (let k = n - 1; k >= 0; k--) {
			const p = this.parent[k];
			if (p >= 0) this.cdiag[p] -= (DT * this.cg[k]) ** 2 / this.cdiag[k];
		}
		this.crhs = new Float32Array(n);
		this.saCells = this.cellsAround(SA, SA_R);
		this.px = new Float32Array(Math.ceil(ECG_KEEP_MS / ECG_EVERY_MS));
		this.py = new Float32Array(this.px.length);
		this.pu = new Float32Array(this.px.length);
	}

	/**
	 * Thomas factors for backward-Euler diffusion along `count` lines of `len` cells (cell
	 * index = line·lineStride + k·stride), with face conductances g (g[i] couples i and i+stride).
	 */
	private factor(g: Float32Array, stride: number, len: number, count: number, lineStride: number) {
		const cp = new Float32Array(N);
		const inv = new Float32Array(N);
		const lo = new Float32Array(N);
		for (let l = 0; l < count; l++) {
			let prevCp = 0;
			for (let k = 0; k < len; k++) {
				const i = l * lineStride + k * stride;
				const gl = k > 0 ? g[i - stride] : 0;
				const gr = k < len - 1 ? g[i] : 0;
				const a = -DT * gl;
				const b = 1 + DT * (gl + gr);
				const c = -DT * gr;
				const m = 1 / (b - a * prevCp);
				cp[i] = c * m;
				inv[i] = m;
				lo[i] = a;
				prevCp = cp[i];
			}
		}
		return { cp, inv, lo };
	}

	private solveLines(f: Lines, stride: number, len: number, count: number, lineStride: number) {
		const { u, tmp } = this;
		const { cp, inv, lo } = f;
		for (let l = 0; l < count; l++) {
			const base = l * lineStride;
			let prev = 0;
			for (let k = 0; k < len; k++) {
				const i = base + k * stride;
				prev = (u[i] - lo[i] * prev) * inv[i];
				tmp[k] = prev;
			}
			let next = tmp[len - 1];
			u[base + (len - 1) * stride] = next;
			for (let k = len - 2; k >= 0; k--) {
				const i = base + k * stride;
				next = tmp[k] - cp[i] * next;
				u[i] = next;
			}
		}
	}

	/** Model time, ms. */
	get time() {
		return this.steps * STEP_MS;
	}

	private cellsAround(c: [number, number], r: number) {
		const out: number[] = [];
		for (let y = Math.floor(c[1] - r); y <= c[1] + r; y++)
			for (let x = Math.floor(c[0] - r); x <= c[0] + r; x++)
				if ((x - c[0]) ** 2 + (y - c[1]) ** 2 <= r * r && isTissue(this.kind[y * W + x]))
					out.push(y * W + x);
		return out;
	}

	/** Fires an early beat from a spot of the ventricles now. */
	ectopic(at: [number, number] = ECTOPIC) {
		this.stims.push({
			cells: this.cellsAround(at, ECTOPIC_R),
			nodes: [],
			until: this.time + STIM_MS
		});
		this.ectopics.push(this.time);
	}

	/**
	 * A defibrillating shock: every cell of the sheet and the cables is excited at once (u = 1).
	 * Cells already excited or still refractory are pushed further into refractoriness.
	 */
	shock() {
		for (const i of this.tissue) this.u[i] = Math.max(this.u[i], 1);
		for (let k = 0; k < this.cu.length; k++) this.cu[k] = Math.max(this.cu[k], 1);
		this.shocks.push(this.time);
	}

	/** Advances n time steps. */
	step(n = 1) {
		const { u, v, src, rec, tissue, cu, cv, csrc, crec, kind, parent, cg, cdiag, crhs, up } = this;
		const every = Math.round(ECG_EVERY_MS / STEP_MS);
		for (let s = 0; s < n; s++) {
			const now = this.time;
			// pacemakers
			if (this.o.rate > 0 && now >= this.nextSinus - 1e-6) {
				this.stims.push({ cells: this.saCells, nodes: [], until: now + STIM_MS });
				this.sinus.push(now);
				this.nextSinus += 60000 / this.o.rate;
			}
			if (this.o.escape && now - Math.max(this.cfired[this.hisNode], 0) > ESCAPE_MS) {
				const h = this.hisNode;
				this.stims.push({ cells: [], nodes: [h, h + 1, h + 2], until: now + STIM_MS });
				this.escapes.push(now);
				this.cfired[h] = now;
			}
			// sources: stimuli and junctions (one way)
			src.fill(0);
			csrc.fill(0);
			if (this.stims.length) {
				this.stims = this.stims.filter((st) => st.until > now);
				for (const st of this.stims) {
					for (const i of st.cells) src[i] += STIM;
					for (const k of st.nodes) csrc[k] += STIM;
				}
			}
			for (const [a, b] of this.relays) csrc[b] += G_RELAY * Math.max(0, cu[a] - cu[b]);
			for (const [node, cell, dir] of this.junctions) {
				if (dir > 0) src[cell] += G_JUNCTION * Math.max(0, cu[node] - u[cell]);
				else csrc[node] += G_JUNCTION * Math.max(0, u[cell] - cu[node]);
			}
			// reactions in the sheet
			let active = 0;
			let newV = 0;
			for (let t = 0; t < tissue.length; t++) {
				const i = tissue[t];
				const U = u[i];
				const V = v[i];
				const eps = E0 + (M1 * V) / (U + M2);
				u[i] = U + DT * (src[i] - K * U * (U - A) * (U - 1) - U * V);
				v[i] = V + DT * rec[i] * eps * (-V - K * U * (U - B - 1));
			}
			// diffusion in the sheet: rows, then columns
			this.solveLines(this.rows, 1, W, H, W);
			this.solveLines(this.cols, W, H, W, 1);
			for (let t = 0; t < tissue.length; t++) {
				const i = tissue[t];
				if (u[i] > 0.5) {
					const first = up[i] === 0;
					up[i] = 1;
					if (first) {
						this.fired[i] = now;
						if (i === this.probeA) this.probeFires[0].push(now);
						else if (i === this.probeV) this.probeFires[1].push(now);
					}
					if (kind[i] !== ATRIUM) {
						active++;
						if (first) newV++;
					}
				} else up[i] = 0;
			}
			// the cables: reactions, then diffusion on the tree
			for (let k = 0; k < cu.length; k++) {
				const U = cu[k];
				const V = cv[k];
				const eps = E0 + (M1 * V) / (U + M2);
				crhs[k] = U + DT * (csrc[k] - K * U * (U - A) * (U - 1) - U * V);
				cv[k] = V + DT * crec[k] * eps * (-V - K * U * (U - B - 1));
			}
			for (let k = cu.length - 1; k >= 0; k--) {
				const p = parent[k];
				if (p >= 0) crhs[p] += (DT * cg[k] * crhs[k]) / cdiag[k];
			}
			for (let k = 0; k < cu.length; k++) {
				const p = parent[k];
				const x = (crhs[k] + (p >= 0 ? DT * cg[k] * cu[p] : 0)) / cdiag[k];
				if (x > 0.5 && cu[k] <= 0.5) this.cfired[k] = now;
				cu[k] = x;
			}
			this.activeV = active;
			if (newV > 0) {
				const last = this.beats[this.beats.length - 1];
				if (!last || now - last.end > BEAT_GAP_MS) this.beats.push({ onset: now, end: now });
				else last.end = now;
			}
			this.steps++;
			if (this.steps % every === 0) {
				const [x, y] = this.dipole();
				const k = this.samples % this.px.length;
				this.px[k] = x;
				this.py[k] = y;
				this.pu[k] = u[PROBE_V[1] * W + PROBE_V[0]];
				this.samples++;
			}
		}
	}

	/** Advances to model time `ms`. */
	runTo(ms: number) {
		const target = Math.round(ms / STEP_MS);
		if (target > this.steps) this.step(target - this.steps);
	}

	/** The sheet's dipole now: −Σ ∇u, each cell weighted by its wall's thickness. */
	dipole(): [number, number] {
		const { u, gx, gy, tissue } = this;
		let x = 0;
		let y = 0;
		for (let t = 0; t < tissue.length; t++) {
			const i = tissue[t];
			const w = this.weight[i];
			if (gx[i] > 0) x -= w * (u[i + 1] - u[i]);
			if (gy[i] > 0) y -= w * (u[i + W] - u[i]);
		}
		return [x, y];
	}

	/** A lead's value at sample k (counted from the start), in the page's millivolt scale. */
	lead(which: Lead, k: number) {
		const i = k % this.px.length;
		return leadOf(which, this.px[i], this.py[i]);
	}

	/** The last `ms` milliseconds of a lead: [time ms, value][]. */
	trace(which: Lead, ms: number): [number, number][] {
		const n = Math.min(this.samples, Math.floor(ms / ECG_EVERY_MS), this.px.length);
		const out: [number, number][] = [];
		for (let k = this.samples - n; k < this.samples; k++)
			out.push([(k + 1) * ECG_EVERY_MS, this.lead(which, k)]);
		return out;
	}

	/** Share of the ventricles' cells excited now. */
	get excited() {
		return this.activeV / this.ventricleCount;
	}
}

export type Lead = 'I' | 'II' | 'III';
/** Lead axes (unit vectors, y down). */
export const LEAD_AXES: Record<Lead, [number, number]> = {
	I: [1, 0],
	II: [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)],
	III: [Math.cos((2 * Math.PI) / 3), Math.sin((2 * Math.PI) / 3)]
};
/** Scale from the dipole to the page's millivolts (an arbitrary choice: QRS about 1 mV in II). */
export const MV_PER_UNIT = 1 / 60;
export function leadOf(which: Lead, x: number, y: number) {
	const [ax, ay] = LEAD_AXES[which];
	return (x * ax + y * ay) * MV_PER_UNIT;
}
