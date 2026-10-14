/**
 * A model of parallel execution: one fast core against many slow lanes that
 * run in lockstep, in warps of 32, on two real jobs (shading every pixel of an
 * image, multiplying two matrices), plus Amdahl's law and the roofline model
 * with the published figures of a real CPU and GPU (`specs.ts`).
 *
 * The machines (stated on the page; toy parameters, not real-chip timings):
 * - both run on the same clock, so their cycle counts compare directly;
 * - the fast core finishes up to FAST_IPC instructions per tick (like a
 *   superscalar CPU core) and, working on one pixel at a time, only runs the
 *   side of a branch that its pixel takes;
 * - a slow lane finishes one instruction per tick. Lanes are grouped in warps
 *   of 32 that share one instruction stream: each tick, a warp executes one
 *   instruction for all 32 of its lanes. When the lanes of a warp disagree on
 *   a branch, the warp runs both sides one after the other, with the lanes
 *   that did not take a side switched off (NVIDIA, CUDA Programming Guide,
 *   "Warps and SIMT");
 * - a job is a list of independent tasks (one per pixel, or one per element
 *   of the product matrix). Tasks are handed out in order, 32 at a time, to
 *   whichever warp becomes free first;
 * - memory is free: no task ever waits for data. The roofline steps deal with
 *   memory separately.
 */
import { I9_14900K, RTX_4090, WARP } from './specs';

export { WARP };

/** Instructions the fast core finishes per tick (a toy figure for a superscalar core). */
export const FAST_IPC = 4;

// ---------------------------------------------------------------- the shader

export type Path = 'all' | 'sphere' | 'sky' | 'end';

export interface Instruction {
	path: Path;
	/** The instruction, written for the listing. */
	text: string;
	/** Floating-point operations it does (a multiply-add counts as 2). */
	flops: number;
}

/**
 * The per-pixel program: work out whether the pixel is on the ball; if it is,
 * light it (a diffuse term and a shiny highlight); if not, paint the sky; then
 * store the colour. One line per instruction of a simple GPU-like instruction
 * set; `shade()` below computes exactly what these lines compute.
 */
export const SHADER: Instruction[] = [
	{ path: 'all', text: 'dx = x − cx', flops: 1 },
	{ path: 'all', text: 'dy = y − cy', flops: 1 },
	{ path: 'all', text: 'd² = dx·dx', flops: 1 },
	{ path: 'all', text: 'd² = dy·dy + d²', flops: 2 },
	{ path: 'all', text: 'on = d² < r²', flops: 1 },
	{ path: 'all', text: 'if not on: go to sky', flops: 0 },
	{ path: 'sphere', text: 'z² = r² − d²', flops: 1 },
	{ path: 'sphere', text: 'z = √z²', flops: 1 },
	{ path: 'sphere', text: 'l = dx·Lx', flops: 1 },
	{ path: 'sphere', text: 'l = dy·Ly + l', flops: 2 },
	{ path: 'sphere', text: 'l = z·Lz + l', flops: 2 },
	{ path: 'sphere', text: 'l = max(l / r, 0.25)', flops: 2 },
	{ path: 'sphere', text: 's = l·l', flops: 1 },
	{ path: 'sphere', text: 's = s·s', flops: 1 },
	{ path: 'sphere', text: 's = s·s', flops: 1 },
	{ path: 'sphere', text: 's = s·s', flops: 1 },
	{ path: 'sphere', text: 'red = l·Br + s', flops: 2 },
	{ path: 'sphere', text: 'green = l·Bg + s', flops: 2 },
	{ path: 'sphere', text: 'blue = l·Bb + s', flops: 2 },
	{ path: 'sphere', text: 'go to store', flops: 0 },
	{ path: 'sky', text: 'h = y / H', flops: 1 },
	{ path: 'sky', text: 'red = h·Sr + Tr', flops: 2 },
	{ path: 'sky', text: 'green = h·Sg + Tg', flops: 2 },
	{ path: 'sky', text: 'blue = h·Sb + Tb', flops: 2 },
	{ path: 'end', text: 'store colour → pixel', flops: 0 }
];

export const count = (path: Path) => SHADER.filter((i) => i.path === path).length;
const flopsOf = (path: Path) =>
	SHADER.filter((i) => i.path === path).reduce((sum, i) => sum + i.flops, 0);

/** Instructions one pixel runs on its own, on the ball or on the sky. */
export const PIXEL_COST = {
	sphere: count('all') + count('sphere') + count('end'),
	sky: count('all') + count('sky') + count('end')
} as const;

/** The image: small enough to draw, big enough to keep many warps busy. */
export const IMAGE = { w: 256, h: 160 } as const;
const BALL = { cx: 104, cy: 78, r: 60 };
// Storing a colour clips each channel to 0–1, as a GPU's store to an 8-bit image does.
// Light from the upper left, towards the viewer (a unit vector).
const LIGHT = (() => {
	const v = [-0.5, -0.6, 0.62];
	const n = Math.hypot(...v);
	return v.map((c) => c / n);
})();
const BASE = [0.95, 0.42, 0.12]; // the ball's colour
const SKY_TOP = [0.2, 0.42, 0.78];
const SKY_BOTTOM = [0.72, 0.84, 0.96];

export interface Shaded {
	on: boolean;
	rgb: [number, number, number];
}

/** What the shader computes for pixel (x, y): colour channels 0–1. */
export function shade(x: number, y: number): Shaded {
	const dx = x + 0.5 - BALL.cx;
	const dy = y + 0.5 - BALL.cy;
	const d2 = dx * dx + dy * dy;
	const r2 = BALL.r * BALL.r;
	if (d2 < r2) {
		const z = Math.sqrt(r2 - d2);
		const l = Math.max((dx * LIGHT[0] + dy * LIGHT[1] + z * LIGHT[2]) / BALL.r, 0.25);
		const s = l ** 16;
		const c = BASE.map((b) => Math.min(1, l * b + s)) as [number, number, number];
		return { on: true, rgb: c };
	}
	const h = y / IMAGE.h;
	const c = SKY_TOP.map((t, k) => t + h * (SKY_BOTTOM[k] - t)) as [number, number, number];
	return { on: false, rgb: c };
}

// ---------------------------------------------------------------- jobs

export interface Job {
	kind: 'pixels' | 'matrix';
	/** Number of independent tasks (pixels, or elements of the product). */
	tasks: number;
	/** Tasks per row of the picture of the job (image width or matrix size). */
	perRow: number;
	/** Instructions each task needs when it runs alone. */
	cost: Int32Array;
	/** Instructions a warp of 32 consecutive tasks needs (both sides of a branch if they disagree). */
	warpCost: Int32Array;
	/** For pixels: which tasks take the ball's side of the branch. */
	on?: Uint8Array;
}

function warpCosts(cost: Int32Array, on: Uint8Array | null, tasks: number): Int32Array {
	const warps = Math.ceil(tasks / WARP);
	const out = new Int32Array(warps);
	for (let w = 0; w < warps; w++) {
		if (!on) {
			let max = 0;
			for (let k = w * WARP; k < Math.min(tasks, (w + 1) * WARP); k++) max = Math.max(max, cost[k]);
			out[w] = max;
			continue;
		}
		let anyOn = false;
		let anyOff = false;
		for (let k = w * WARP; k < Math.min(tasks, (w + 1) * WARP); k++) {
			if (on[k]) anyOn = true;
			else anyOff = true;
		}
		out[w] =
			count('all') + (anyOn ? count('sphere') : 0) + (anyOff ? count('sky') : 0) + count('end');
	}
	return out;
}

let pixelCache: Job | null = null;
/** Shading every pixel of the image: one task per pixel, in reading order. */
export function pixelJob(): Job {
	if (pixelCache) return pixelCache;
	const tasks = IMAGE.w * IMAGE.h;
	const cost = new Int32Array(tasks);
	const on = new Uint8Array(tasks);
	for (let y = 0; y < IMAGE.h; y++)
		for (let x = 0; x < IMAGE.w; x++) {
			const k = y * IMAGE.w + x;
			on[k] = shade(x, y).on ? 1 : 0;
			cost[k] = on[k] ? PIXEL_COST.sphere : PIXEL_COST.sky;
		}
	pixelCache = {
		kind: 'pixels',
		tasks,
		perRow: IMAGE.w,
		cost,
		on,
		warpCost: warpCosts(cost, on, tasks)
	};
	return pixelCache;
}

/** Size of the matrices in the matrix job (n × n). */
export const MATRIX_N = 128;
/**
 * Instructions for one element of C = A·B: for each of the n terms, load a
 * number of A, load a number of B and multiply-add them; plus clearing the
 * total at the start and storing it at the end.
 */
export const elementCost = (n: number) => 3 * n + 2;

const matrixCache = new Map<number, Job>();
/** Multiplying two n × n matrices: one task per element of the product. */
export function matrixJob(n = MATRIX_N): Job {
	const hit = matrixCache.get(n);
	if (hit) return hit;
	const tasks = n * n;
	const cost = new Int32Array(tasks).fill(elementCost(n));
	const job: Job = {
		kind: 'matrix',
		tasks,
		perRow: n,
		cost,
		warpCost: warpCosts(cost, null, tasks)
	};
	matrixCache.set(n, job);
	return job;
}

/** A small deterministic pseudo-random generator (for the example matrices). */
function lcg(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

/** Two example matrices with entries 0–9 and their product, row by row. */
export function exampleProduct(n = MATRIX_N) {
	const rnd = lcg(7);
	const A = Float64Array.from({ length: n * n }, () => Math.floor(rnd() * 10));
	const B = Float64Array.from({ length: n * n }, () => Math.floor(rnd() * 10));
	const C = new Float64Array(n * n);
	for (let i = 0; i < n; i++)
		for (let k = 0; k < n; k++) {
			const a = A[i * n + k];
			for (let j = 0; j < n; j++) C[i * n + j] += a * B[k * n + j];
		}
	return { n, A, B, C };
}

// ---------------------------------------------------------------- running a job

export interface Run {
	/** Cycles until the last task is done. */
	cycles: number;
	/** Lane-instructions that did useful work. */
	useful: number;
	/** Lane-ticks the machine had available while the job ran. */
	capacity: number;
}

export interface FastRun extends Run {
	/** done[k] = cycle at which task k is finished (tasks run in order). */
	done: Float64Array;
}

/** The fast core does the tasks one after another, FAST_IPC instructions per tick. */
export function runFast(job: Job, serial = 0): FastRun {
	const done = new Float64Array(job.tasks);
	let instr = serial;
	for (let k = 0; k < job.tasks; k++) {
		instr += job.cost[k];
		done[k] = instr / FAST_IPC;
	}
	return { cycles: instr / FAST_IPC, useful: instr, capacity: instr, done };
}

export interface LanesRun extends Run {
	lanes: number;
	/** Warps of 32 lanes. */
	warps: number;
	/** start[w], end[w]: cycles at which task group w (tasks 32w … 32w + 31) starts and ends. */
	start: Float64Array;
	end: Float64Array;
	/** Cycles spent on the serial part, before the parallel part starts. */
	serial: number;
}

/**
 * Many slow lanes in warps of 32: each free warp takes the next 32 tasks and
 * needs `warpCost` ticks for them. `serial` instructions run first on one lane.
 * `lanes` must be a multiple of 32.
 */
export function runLanes(job: Job, lanes: number, serial = 0): LanesRun {
	const warps = Math.max(1, Math.floor(lanes / WARP));
	const groups = job.warpCost.length;
	const start = new Float64Array(groups);
	const end = new Float64Array(groups);
	const free = new Float64Array(warps).fill(serial);
	for (let g = 0; g < groups; g++) {
		// The warp that becomes free first (lowest index on ties).
		let best = 0;
		for (let w = 1; w < warps; w++) if (free[w] < free[best]) best = w;
		start[g] = free[best];
		end[g] = free[best] + job.warpCost[g];
		free[best] = end[g];
	}
	let cycles = serial;
	for (let g = 0; g < groups; g++) cycles = Math.max(cycles, end[g]);
	let useful = serial;
	for (let k = 0; k < job.tasks; k++) useful += job.cost[k];
	return {
		cycles,
		useful,
		capacity: cycles * warps * WARP,
		lanes: warps * WARP,
		warps,
		start,
		end,
		serial
	};
}

/** Share of the lanes' ticks that did useful work (1 = no lane ever idle). */
export const efficiency = (r: Run) => r.useful / r.capacity;

// ---------------------------------------------------------------- Amdahl's law

/**
 * Amdahl's law: the speed-up on N workers of a job whose share s must run in
 * sequence (G. M. Amdahl, "Validity of the single processor approach to
 * achieving large scale computing capabilities", AFIPS 1967).
 */
export const amdahl = (s: number, n: number) => 1 / (s + (1 - s) / n);

export interface Measured {
	/** Cycles on one lane, and on n lanes. */
	one: number;
	many: number;
	speedup: number;
}

/**
 * Measured speed-up of the matrix job with a serial part that takes share s
 * of the one-lane time, on n workers (any n ≥ 1, not just whole warps):
 * the serial part runs on one worker, then the tasks are shared out.
 */
export function measuredSpeedup(s: number, n: number, job: Job = matrixJob()): Measured {
	const parallel = job.tasks * job.cost[0];
	const serial = s >= 1 ? parallel : (s / (1 - s)) * parallel;
	const one = serial + parallel;
	const many = serial + Math.ceil(job.tasks / n) * job.cost[0];
	return { one, many, speedup: one / many };
}

/** Cycles for the fast core and for n slow lanes, on the matrix job with serial share s. */
export function contest(s: number, n: number, serialOnFast = false) {
	const m = measuredSpeedup(s, n);
	const serial = m.one * s;
	const fast = m.one / FAST_IPC;
	const lanes = serialOnFast ? serial / FAST_IPC + (m.many - serial) : m.many;
	return { fast, lanes, serial, winner: lanes < fast ? ('lanes' as const) : ('fast' as const) };
}

// ---------------------------------------------------------------- the real chips

/** Peak FP32 rate of the RTX 4090 from its parts: every lane, a multiply-add per tick. */
export const gpuPeakGFLOPS = RTX_4090.cudaCores * 2 * RTX_4090.boostGHz;
/** Intel's 64-bit figure rebuilt: cores × base clock × 16 operations per tick. */
export const cpuFp64FromParts = I9_14900K.cores * I9_14900K.baseGHz * 16;
/** 32-bit numbers: an AVX2 register holds 8 floats instead of 4 doubles, so twice the rate. */
export const cpuPeakGFLOPS = 2 * I9_14900K.fp64GFLOPS;
/**
 * FP32 multiply-adds per core per tick implied by Intel's figure, which applies one
 * formula to all 24 cores (big and small alike): an average, not a per-core spec.
 */
export const cpuLanesPerCore = cpuPeakGFLOPS / (I9_14900K.cores * I9_14900K.baseGHz * 2);

export interface Chip {
	id: 'cpu' | 'gpu';
	name: string;
	/** Peak FP32 rate, GFLOP/s, and memory bandwidth, GB/s. */
	peak: number;
	bandwidth: number;
}

export const CHIPS: Chip[] = [
	{ id: 'cpu', name: I9_14900K.name, peak: cpuPeakGFLOPS, bandwidth: I9_14900K.bandwidthGBs },
	{
		id: 'gpu',
		name: RTX_4090.name,
		peak: RTX_4090.fp32TFLOPS * 1000,
		bandwidth: RTX_4090.bandwidthGBs
	}
];

/**
 * The roofline model (S. Williams, A. Waterman, D. Patterson, "Roofline: an
 * insightful visual performance model for multicore architectures", CACM
 * 52(4), 2009): a job that does I floating-point operations per byte it moves
 * to or from memory runs at most at min(peak, bandwidth × I).
 */
export const attainable = (c: Chip, intensity: number) => Math.min(c.peak, c.bandwidth * intensity);
/** Intensity at which a chip stops waiting for memory (FLOP per byte). */
export const ridge = (c: Chip) => c.peak / c.bandwidth;
export const memoryBound = (c: Chip, intensity: number) => intensity < ridge(c);

/** Adding two lists of 32-bit numbers: 1 addition per 12 bytes (read 2 numbers, write 1). */
export const VECTOR_ADD_INTENSITY = 1 / 12;

/** The pixel shader: its floating-point operations per pixel over the 4 bytes of colour it writes. */
export function shaderIntensity(): number {
	const job = pixelJob();
	let flops = 0;
	for (let k = 0; k < job.tasks; k++)
		flops += flopsOf('all') + (job.on![k] ? flopsOf('sphere') : flopsOf('sky'));
	return flops / job.tasks / 4;
}

/**
 * Matrix multiply in tiles of b × b: every number fetched from memory is used
 * b times before it is dropped, so 2b²n operations per 2·b·n·4 bytes moved:
 * b / 4 FLOP per byte (for large n; writing C is neglected).
 */
export const matmulIntensity = (b: number) => b / 4;
