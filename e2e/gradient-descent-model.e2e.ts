// Checks the gradient-descent model against known results: the stability limit
// η < 2/λ on a quadratic, convergence to the least-squares line, the gradients
// against finite differences, momentum in a ravine and the minima of the
// landscapes. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	LANDSCAPE_IDS,
	curvatures,
	descend,
	examples,
	landscapes,
	leastSquares,
	lineLoss,
	nearestMinimum
} from '../src/routes/gradient-descent/descent';

const { bowl, line, ravine, plateau, wells } = landscapes;
const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
	Math.hypot(p.x - q.x, p.y - q.y);

test('every landscape has the gradient it claims (finite differences)', () => {
	const h = 1e-6;
	for (const id of LANDSCAPE_IDS) {
		const L = landscapes[id];
		for (const [u, v] of [
			[0.1, 0.2],
			[0.7, 0.35],
			[0.3, 0.9],
			[0.85, 0.6]
		]) {
			const x = L.x[0] + u * (L.x[1] - L.x[0]);
			const y = L.y[0] + v * (L.y[1] - L.y[0]);
			const [gx, gy] = L.grad(x, y);
			expect(gx, `${id} ∂/∂w₁`).toBeCloseTo((L.f(x + h, y) - L.f(x - h, y)) / (2 * h), 5);
			expect(gy, `${id} ∂/∂w₂`).toBeCloseTo((L.f(x, y + h) - L.f(x, y - h)) / (2 * h), 5);
		}
	}
});

test('every listed minimum is a minimum: zero gradient, curving up both ways, inside the map', () => {
	for (const id of LANDSCAPE_IDS) {
		const L = landscapes[id];
		for (const m of L.minima) {
			const [gx, gy] = L.grad(m.x, m.y);
			expect(Math.hypot(gx, gy), `${id} ${m.name}`).toBeLessThan(1e-9);
			expect(curvatures(L, m.x, m.y)[1]).toBeGreaterThan(0);
			expect(m.x).toBeGreaterThan(L.x[0]);
			expect(m.x).toBeLessThan(L.x[1]);
			expect(m.y).toBeGreaterThan(L.y[0]);
			expect(m.y).toBeLessThan(L.y[1]);
			expect(L.f(m.x, m.y)).toBeCloseTo(m.value, 12);
		}
		// Lowest first.
		for (let i = 1; i < L.minima.length; i++) {
			expect(L.minima[i].value).toBeGreaterThan(L.minima[i - 1].value);
		}
	}
});

test('on the round bowl a step multiplies the distance to the bottom by 1 − η', () => {
	for (const lr of [0.05, 0.6, 1.5, 1.9]) {
		const run = descend(bowl, [-2.1, 1.5], { lr, steps: 5 });
		for (let k = 1; k < run.path.length; k++) {
			const ratio =
				Math.hypot(run.path[k].x, run.path[k].y) / Math.hypot(run.path[k - 1].x, run.path[k - 1].y);
			expect(ratio).toBeCloseTo(Math.abs(1 - lr), 12);
			// Past η = 1 every step overshoots to the other side of the bottom.
			expect(Math.sign(run.path[k].x)).toBe(
				lr > 1 ? -Math.sign(run.path[k - 1].x) : Math.sign(run.path[k - 1].x)
			);
		}
	}
	// η = 1 lands on the bottom in a single step.
	expect(dist(descend(bowl, [-2.1, 1.5], { lr: 1, steps: 1 }).path[1], { x: 0, y: 0 })).toBe(0);
});

test('it converges exactly when η < 2/λ: crawl, converge, diverge', () => {
	// Curvature λ = 1 on the bowl, so the limit is η = 2.
	const crawl = descend(bowl, bowl.start, { lr: 0.05 });
	const good = descend(bowl, bowl.start, { lr: 0.6 });
	const tooBig = descend(bowl, bowl.start, { lr: 2.05 });
	expect(good.settledAt).toBeGreaterThan(0);
	expect(crawl.settledAt).toBeGreaterThan(10 * good.settledAt);
	expect(tooBig.diverged).toBe(true);
	expect(descend(bowl, bowl.start, { lr: 1.99, steps: 3000 }).diverged).toBe(false);
	// Too small and too big (but stable) are mirror images: 1 − η = ±0.9 both take as long.
	expect(descend(bowl, bowl.start, { lr: 0.1 }).settledAt).toBe(
		descend(bowl, bowl.start, { lr: 1.9 }).settledAt
	);
	// The loss falls at every step below the limit and rises at every step above it.
	const losses = (lr: number) =>
		descend(bowl, bowl.start, { lr, steps: 20 }).path.map((p) => p.loss);
	const below = losses(1.9);
	const above = losses(2.1);
	for (let k = 1; k < 20; k++) {
		expect(below[k]).toBeLessThan(below[k - 1]);
		expect(above[k]).toBeGreaterThan(above[k - 1]);
	}
});

test('the limit 2/λ is set by the steepest curvature: the line fit diverges past η = 1', () => {
	// Mean squared error of a line: curvatures 2·mean(x²) along the slope and 2 along the height.
	const meanX2 = examples.reduce((s, p) => s + p.x * p.x, 0) / examples.length;
	const [big, small] = curvatures(line, 0, 0);
	expect(big).toBeCloseTo(2, 4);
	expect(small).toBeCloseTo(2 * meanX2, 2);
	expect(descend(line, line.start, { lr: 0.95, steps: 2000 }).diverged).toBe(false);
	expect(descend(line, line.start, { lr: 1.05 }).diverged).toBe(true);
	// The ravine: curvatures 1 across and 0.02 along the floor, so the limit is 2.
	const [across, along] = curvatures(ravine, 0, 0);
	expect(across).toBeCloseTo(1, 5);
	expect(along).toBeCloseTo(0.02, 5);
	expect(descend(ravine, ravine.start, { lr: 1.95, steps: 3000 }).diverged).toBe(false);
	expect(descend(ravine, ravine.start, { lr: 2.05 }).diverged).toBe(true);
});

test('descent on the line-fit loss finds the least-squares line', () => {
	const ls = leastSquares(examples);
	// The same best line as the learning-from-data page: its training error is 0.118.
	expect(lineLoss(ls.a, ls.b, examples)).toBeCloseTo(0.1183, 4);
	const run = descend(line, line.start, { lr: 0.5 });
	const end = run.path.at(-1)!;
	expect(end.x).toBeCloseTo(ls.a, 6);
	expect(end.y).toBeCloseTo(ls.b, 6);
	expect(run.settledAt).toBeGreaterThan(0);
	expect(run.settledAt).toBeLessThan(20);
});

test('mini-batches make the descent noisy: it wanders around the best line instead of settling', () => {
	const ls = leastSquares(examples);
	const full = descend(line, line.start, { lr: 0.3, batch: examples.length });
	const one = descend(line, line.start, { lr: 0.3, batch: 1, seed: 3 });
	expect(full.settledAt).toBeGreaterThan(0);
	expect(one.settledAt).toBe(-1);
	// Still close to the best line on average over its last 100 steps…
	const tail = one.path.slice(-100);
	const mean = {
		x: tail.reduce((s, p) => s + p.x, 0) / tail.length,
		y: tail.reduce((s, p) => s + p.y, 0) / tail.length
	};
	expect(dist(mean, { x: ls.a, y: ls.b })).toBeLessThan(0.15);
	// …but its loss is above the minimum.
	expect(tail.reduce((s, p) => s + p.loss, 0) / tail.length).toBeGreaterThan(0.12);
	// Same seed, same run: the page can replay it.
	expect(descend(line, line.start, { lr: 0.3, batch: 1, seed: 3 }).path).toEqual(one.path);
});

test('in the ravine momentum reaches the bottom in far fewer steps', () => {
	const plain = descend(ravine, ravine.start, { lr: 0.9 });
	const heavy = descend(ravine, ravine.start, { lr: 0.9, momentum: 0.8 });
	expect(plain.settledAt).toBeGreaterThan(150);
	expect(heavy.settledAt).toBeLessThan(plain.settledAt / 4);
	// A bigger η without momentum zigzags across the floor: successive steps point opposite ways across.
	const zig = descend(ravine, ravine.start, { lr: 1.8, steps: 10 }).path;
	const across = (k: number) => {
		const dx = zig[k + 1].x - zig[k].x;
		const dy = zig[k + 1].y - zig[k].y;
		// The across-the-floor direction is the floor direction (30°) turned by 90°.
		return -dx * Math.sin(Math.PI / 6) + dy * Math.cos(Math.PI / 6);
	};
	for (let k = 0; k < 8; k++) expect(Math.sign(across(k + 1))).toBe(-Math.sign(across(k)));
});

test('on the plateau plain descent crawls; momentum gets off it sooner', () => {
	const leaves = (momentum: number) =>
		descend(plateau, plateau.start, { lr: 1, momentum }).path.findIndex((p) => p.loss < 0.45);
	const plain = leaves(0);
	expect(plain).toBeGreaterThan(80);
	expect(leaves(0.8)).toBeLessThan(plain / 2);
	// The plain is nearly flat: at the start the slope is tiny compared with the well's walls.
	const [gx, gy] = plateau.grad(...plateau.start);
	const wall = plateau.grad(plateau.minima[0].x + 0.9, plateau.minima[0].y);
	expect(Math.hypot(gx, gy)).toBeLessThan(Math.hypot(...wall) / 20);
});

test('several valleys: where the ball starts decides where it ends, not which valley is deepest', () => {
	expect(wells.minima.map((m) => m.name)).toEqual([
		'the deepest valley',
		'a shallower valley',
		'the shallowest valley'
	]);
	expect(wells.minima[0].value).toBe(0);
	const endIn = (start: [number, number], o = {}) => {
		const run = descend(wells, start, { lr: 0.3, ...o });
		const e = run.path.at(-1)!;
		return nearestMinimum(wells, e.x, e.y).name;
	};
	expect(endIn(wells.start)).toBe('a shallower valley');
	expect(endIn([2, 1])).toBe('the deepest valley');
	expect(endIn([-1.2, -2.4])).toBe('the shallowest valley');
	// Noise in the gradient can shake it out of the narrow, shallow valley.
	expect(endIn([-1.2, -2.4], { noise: 1, seed: 1 })).toBe('the deepest valley');
});

test('a diverging run stops cleanly with finite numbers', () => {
	const run = descend(bowl, bowl.start, { lr: 2.5 });
	expect(run.diverged).toBe(true);
	expect(run.path.length).toBeLessThan(300);
	for (const p of run.path) {
		expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.loss)).toBe(true);
	}
});
