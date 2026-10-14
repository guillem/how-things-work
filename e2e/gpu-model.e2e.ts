// Checks the GPU explainer's model: the published chip figures rebuild from their parts,
// warps pay for divergence the way NVIDIA's guide describes, measured speed-ups follow
// Amdahl's law, and the roofline verdicts the page quotes. Node only.
import { expect, test } from '@playwright/test';
import {
	CHIPS,
	FAST_IPC,
	MATRIX_N,
	amdahl,
	attainable,
	contest,
	cpuFp64FromParts,
	cpuLanesPerCore,
	efficiency,
	exampleProduct,
	gpuPeakGFLOPS,
	matmulIntensity,
	matrixJob,
	measuredSpeedup,
	memoryBound,
	pixelJob,
	ridge,
	runFast,
	runLanes,
	shade,
	shaderIntensity,
	VECTOR_ADD_INTENSITY,
	PIXEL_COST,
	IMAGE
} from '../src/routes/gpu/gpu';
import { I9_14900K, RTX_4090 } from '../src/routes/gpu/specs';

const [cpu, gpu] = CHIPS;

test('the published peak rates follow from the chips’ parts', () => {
	// NVIDIA: 16,384 lanes × one multiply-add (2 operations) per tick × 2.52 GHz = 82.6 TFLOPS.
	expect(gpuPeakGFLOPS / 1000).toBeCloseTo(RTX_4090.fp32TFLOPS, 1);
	// …and those lanes are 128 SMs × 4 schedulers × one warp of 32.
	expect(RTX_4090.sms * RTX_4090.schedulersPerSm * RTX_4090.lanesPerScheduler).toBe(
		RTX_4090.cudaCores
	);
	// Intel's export figure: 24 cores × 3.2 GHz × 16 double-precision operations per tick.
	expect(cpuFp64FromParts).toBeCloseTo(I9_14900K.fp64GFLOPS, 6);
	// In 32-bit numbers that is 16 lanes per core (two 8-wide multiply-add units).
	expect(cpuLanesPerCore).toBeCloseTo(16, 9);
	// The page: about 34× the arithmetic but only about 11× the memory bandwidth.
	expect(gpu.peak / cpu.peak).toBeGreaterThan(33);
	expect(gpu.peak / cpu.peak).toBeLessThan(34);
	expect(gpu.bandwidth / cpu.bandwidth).toBeCloseTo(11.25, 2);
	// In 64-bit numbers (1/64 of the FP32 rate) the GPU is no faster than the CPU.
	expect((gpu.peak * RTX_4090.fp64Fraction) / I9_14900K.fp64GFLOPS).toBeCloseTo(1.05, 2);
});

test('the shader lights the ball and paints a sky that pales towards the horizon', () => {
	const lit = shade(80, 50); // upper left of the ball, facing the light
	const shadow = shade(140, 110); // lower right of the ball
	expect(lit.on && shadow.on).toBe(true);
	const brightness = (c: number[]) => c[0] + c[1] + c[2];
	expect(brightness(lit.rgb)).toBeGreaterThan(brightness(shadow.rgb) + 0.5);
	const top = shade(250, 2);
	const bottom = shade(250, IMAGE.h - 2);
	expect(top.on || bottom.on).toBe(false);
	expect(brightness(bottom.rgb)).toBeGreaterThan(brightness(top.rgb));
	// A pixel on the ball needs more instructions than one in the sky.
	expect(PIXEL_COST.sphere).toBeGreaterThan(PIXEL_COST.sky);
});

test('a warp that straddles the edge of the ball runs both sides of the branch', () => {
	const job = pixelJob();
	const costs = new Set(job.warpCost);
	// Three kinds of warp: all sky, all ball, and mixed.
	expect(costs.size).toBe(3);
	const [sky, ball, mixed] = [...costs].sort((a, b) => a - b);
	expect(sky).toBe(PIXEL_COST.sky);
	expect(ball).toBe(PIXEL_COST.sphere);
	// Mixed: the shared start and end once, plus both branches one after the other.
	expect(mixed).toBeGreaterThan(ball);
	expect(mixed).toBeLessThan(PIXEL_COST.sky + PIXEL_COST.sphere);
	// The edge of the ball crosses a few hundred of the 1,280 warps.
	const nMixed = job.warpCost.filter((c) => c === mixed).length;
	expect(nMixed).toBeGreaterThan(100);
	expect(nMixed).toBeLessThan(400);
});

test('many slow lanes shade the image far faster than one fast core', () => {
	const job = pixelJob();
	const fast = runFast(job);
	let last = Infinity;
	for (const lanes of [32, 256, 1024, 4096, 16384]) {
		const r = runLanes(job, lanes);
		const speedup = fast.cycles / r.cycles;
		expect(r.cycles).toBeLessThan(last); // more lanes, fewer cycles
		last = r.cycles;
		// Each lane is FAST_IPC times slower, and divergence wastes some ticks:
		expect(speedup).toBeLessThan(lanes / FAST_IPC);
		expect(speedup).toBeGreaterThan(lanes / FAST_IPC / 2);
	}
	expect(fast.cycles / runLanes(job, 1024).cycles).toBeGreaterThan(200);
	// With 512 warps and only 1,280 groups of pixels, many warps sit idle at the end.
	expect(efficiency(runLanes(job, 1024))).toBeGreaterThan(0.85);
	expect(efficiency(runLanes(job, 16384))).toBeLessThan(0.75);
});

test('a matrix product keeps every lane busy: speed-up is exactly lanes ÷ 4', () => {
	const job = matrixJob();
	expect(job.tasks).toBe(MATRIX_N * MATRIX_N);
	const fast = runFast(job);
	for (const lanes of [32, 1024, 16384]) {
		const r = runLanes(job, lanes);
		expect(efficiency(r)).toBe(1);
		expect(fast.cycles / r.cycles).toBeCloseTo(lanes / FAST_IPC, 9);
	}
	// 16,384 lanes, 16,384 elements: all of them at once, in one element's time.
	expect(runLanes(job, 16384).cycles).toBe(job.cost[0]);
	// The product itself is right: an element is the dot product of a row and a column.
	const { n, A, B, C } = exampleProduct(16);
	let dot = 0;
	for (let k = 0; k < n; k++) dot += A[3 * n + k] * B[k * n + 5];
	expect(C[3 * n + 5]).toBe(dot);
});

test('measured speed-ups follow Amdahl’s law and never pass 1 ÷ serial share', () => {
	for (const s of [0, 0.01, 0.05, 0.2, 0.5]) {
		for (const n of [1, 4, 32, 1024, 16384]) {
			const m = measuredSpeedup(s, n);
			expect(m.speedup).toBeCloseTo(amdahl(s, n), 6);
			if (s > 0) expect(m.speedup).toBeLessThan(1 / s);
		}
	}
	// 5 % in sequence: 16,384 workers give only about 20×.
	expect(measuredSpeedup(0.05, 16384).speedup).toBeGreaterThan(19.9);
	expect(measuredSpeedup(0.05, 16384).speedup).toBeLessThan(20);
	// Work that doesn't split evenly leaves workers idle at the end: a bit below the law.
	expect(measuredSpeedup(0, 1000).speedup).toBeLessThan(amdahl(0, 1000));
});

test('with enough work in sequence the single fast core wins, unless it takes the serial part', () => {
	expect(contest(0.05, 16384).winner).toBe('lanes');
	expect(contest(0.3, 16384).winner).toBe('fast');
	expect(contest(0.5, 16384).winner).toBe('fast');
	// The fast core does the sequential part and the lanes the rest: best of both.
	for (const s of [0.05, 0.3, 0.5]) {
		const both = contest(s, 16384, true);
		expect(both.winner).toBe('lanes');
		expect(both.lanes).toBeLessThan(contest(s, 16384).lanes);
	}
});

test('roofline: adding lists waits for memory; tiled matrix multiply reaches the GPU’s peak', () => {
	expect(ridge(gpu)).toBeCloseTo(82, 0);
	expect(ridge(cpu)).toBeCloseTo(27.4, 1);
	// Adding two lists: about 84 GFLOP/s on the GPU, 0.1 % of its peak.
	expect(memoryBound(gpu, VECTOR_ADD_INTENSITY) && memoryBound(cpu, VECTOR_ADD_INTENSITY)).toBe(
		true
	);
	expect(attainable(gpu, VECTOR_ADD_INTENSITY)).toBeCloseTo(84, 0);
	expect(attainable(gpu, VECTOR_ADD_INTENSITY) / gpu.peak).toBeLessThan(0.002);
	// The pixel shader: about 4 operations per byte, still waiting for memory on both chips.
	expect(shaderIntensity()).toBeGreaterThan(3);
	expect(shaderIntensity()).toBeLessThan(6);
	expect(memoryBound(gpu, shaderIntensity())).toBe(true);
	// Matrix multiply without tiles (b = 1) is memory-bound; tiles of 512 are not.
	expect(memoryBound(gpu, matmulIntensity(1))).toBe(true);
	expect(memoryBound(gpu, matmulIntensity(512))).toBe(false);
	expect(attainable(gpu, matmulIntensity(512))).toBe(gpu.peak);
});
