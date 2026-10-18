// Checks the mathematics behind the brachistochrone explainer against known results: free fall
// and the incline, the cycloid's closed-form time, the optimiser finding the cycloid, the dip
// below the end point beyond L/h = π/2, Beltrami's (Snell's) constant along the optimum, and the
// hanging chain: the catenary, its Lagrange multiplier, and a stationary shape that is a maximum.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	G,
	arcPoints,
	arrivalTimes,
	cycloid,
	cycloidDepthAt,
	cycloidPoints,
	descentTime,
	grid,
	gridTime,
	linePoints,
	lineTime,
	optimise,
	positionAt,
	snell,
	speedAt,
	spline,
	splinePoints,
	turningPoint
} from '../src/routes/calculus-of-variations/brachistochrone';
import {
	G as CG,
	RHO,
	catenary,
	energyOf,
	hangingChain,
	nudged,
	parabolaPoints
} from '../src/routes/calculus-of-variations/chain';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

test('an incline: the time is that of uniform acceleration g·sin α, and free fall when vertical', () => {
	// Along a line of length ℓ at angle α below the horizontal, ℓ = ½ g sin α · T².
	for (const [L, h] of [
		[4, 2],
		[1, 3],
		[10, 0.5]
	]) {
		const len = Math.hypot(L, h);
		const T = Math.sqrt((2 * len) / (G * (h / len)));
		expect(descentTime(linePoints(L, h))).toBeCloseTo(T, 12);
		expect(lineTime(L, h)).toBeCloseTo(T, 12);
		// Halfway in time the bead has covered a quarter of the way.
		const pts = linePoints(L, h);
		const p = positionAt(pts, arrivalTimes(pts), T / 2);
		expect(p.x).toBeCloseTo(L / 4, 9);
	}
	// A drop of 2 m straight down takes √(2h/g) = 0.639 s.
	expect(descentTime(linePoints(1e-9, 2))).toBeCloseTo(Math.sqrt(4 / G), 9);
});

test("the cycloid's time, integrated along it, equals the closed form θ·√(r/g)", () => {
	// The integrand 1/√(2gy) is infinite at the start; the integration must still converge.
	for (const [L, h] of [
		[4, 2],
		[1, 2],
		[Math.PI, 2],
		[8, 2]
	]) {
		const c = cycloid(L, h);
		// The cycloid really passes through the end point.
		const end = c.at(c.theta);
		expect(end.x).toBeCloseTo(L, 9);
		expect(end.y).toBeCloseTo(h, 9);
		const coarse = descentTime(cycloidPoints(c, 100));
		const fine = descentTime(cycloidPoints(c, 1600));
		expect(rel(fine, c.T)).toBeLessThan(1e-6);
		expect(Math.abs(fine - c.T)).toBeLessThan(Math.abs(coarse - c.T));
	}
	// Half an arch (L = πr, h = 2r) takes π·√(r/g): 1.003 s for r = 1 m.
	const half = cycloid(Math.PI, 2);
	expect(half.r).toBeCloseTo(1, 9);
	expect(half.T).toBeCloseTo(Math.PI / Math.sqrt(G), 9);
});

test('the race the page quotes: 4 m across and 2 m down', () => {
	const c = cycloid(4, 2);
	const line = lineTime(4, 2);
	const arc = descentTime(arcPoints(4, 2));
	expect(line).toBeCloseTo(1.428, 3);
	expect(arc).toBeCloseTo(1.174, 3);
	expect(c.T).toBeCloseTo(1.139, 3);
	// The straight line, the shortest path, loses by 0.29 s: a quarter more time.
	expect(line - c.T).toBeCloseTo(0.289, 3);
	expect(line / c.T - 1).toBeCloseTo(0.253, 3);
	// A reader's guess, the default curve, sits in between.
	const yours = descentTime(splinePoints(4, 2, [0.9, 1.45, 1.8, 2]));
	expect(yours).toBeGreaterThan(c.T);
	expect(yours).toBeLessThan(line);
	// A curve that climbs back to the start's height stops the bead: it never arrives.
	expect(descentTime(splinePoints(4, 2, [1, 0.5, -0.2, 1]))).toBe(Infinity);
});

test('gradient descent from the line, the arc or a guess converges on the cycloid', () => {
	for (const [L, h] of [
		[4, 2],
		[1, 2],
		[8, 2]
	]) {
		const c = cycloid(L, h);
		const xs = grid(L);
		const arc = arcPoints(L, h, 2000);
		const arcAt = (x: number) => arc.find((p) => p.x >= x)?.y ?? h;
		const starts = [xs.map((x) => (h * x) / L), xs.map(arcAt), xs.map((x) => h * Math.sqrt(x / L))];
		for (const start of starts) {
			const run = optimise(xs, start, 300);
			// Every step makes the slide faster.
			for (let k = 1; k < run.length; k++) expect(run[k].T).toBeLessThanOrEqual(run[k - 1].T);
			const best = run[run.length - 1];
			expect(rel(best.T, c.T)).toBeLessThan(1e-3);
			expect(best.T).toBeLessThan(lineTime(L, h));
			expect(best.T).toBeLessThan(descentTime(arcPoints(L, h)));
			// The curve itself lies on the cycloid, to within 1 % of the drop…
			xs.forEach((x, i) =>
				expect(Math.abs(best.ys[i] - cycloidDepthAt(c, x))).toBeLessThan(0.01 * Math.max(h, L))
			);
			// …and the Euler–Lagrange residual has gone to zero all along it.
			expect(best.worst).toBeLessThan(1e-3);
			expect(run[0].worst).toBeGreaterThan(1000 * best.worst);
		}
		// The polyline cannot beat the true optimum.
		expect(
			gridTime(
				xs,
				optimise(
					xs,
					xs.map((x) => (h * x) / L),
					300
				).at(-1)!.ys
			)
		).toBeGreaterThan(c.T);
	}
});

test('a track that climbs back to the start: the bead stops at that height and slides back', () => {
	const pts = [
		{ x: 0, y: 0 },
		{ x: 1, y: 1 },
		{ x: 2, y: -0.2 },
		{ x: 4, y: 2 }
	];
	const times = arrivalTimes(pts);
	expect(descentTime(pts)).toBe(Infinity);
	const turn = turningPoint(pts, times);
	// It turns back where the track crosses the start's height, with no speed left.
	expect(turn.at.y).toBeCloseTo(0, 12);
	expect(speedAt(positionAt(pts, times, turn.time).y)).toBeCloseTo(0, 9);
	// The way back retraces the way out, and it is back at A after twice the time.
	for (const dt of [0.1, 0.5, 1]) {
		const out = positionAt(pts, times, turn.time - dt);
		const back = positionAt(pts, times, turn.time + dt);
		expect(back.x).toBeCloseTo(out.x, 9);
		expect(back.y).toBeCloseTo(out.y, 9);
	}
	expect(positionAt(pts, times, 2 * turn.time).x).toBeCloseTo(0, 9);
});

test('the optimiser converges from any start the handles allow', () => {
	// The page runs 400 steps from the reader's curve (4 m across), whatever its handles.
	const L = 4;
	const h = 2;
	const c = cycloid(L, h);
	const xs = grid(L);
	for (const d of [
		[-0.4, -0.4, -0.4, -0.4],
		[0.05, 0.05, 0.05, 0.05],
		[2.8, 2.8, 2.8, 2.8],
		[-0.4, 2.8, -0.4, 2.8]
	]) {
		const f = spline(L, h, d);
		const best = optimise(
			xs,
			xs.map((x) => f(x)),
			400
		).at(-1)!;
		expect(rel(best.T, c.T)).toBeLessThan(1e-3);
		expect(best.worst).toBeLessThan(1e-4);
	}
});

test('the optimum dips below the end point exactly when L/h exceeds π/2', () => {
	const h = 2;
	for (const ratio of [1, 1.5, 1.65, 2, 3]) {
		const L = ratio * h;
		const xs = grid(L);
		const best = optimise(
			xs,
			xs.map((x) => (h * x) / L),
			300
		).at(-1)!;
		const deepest = Math.max(...best.ys);
		if (ratio < Math.PI / 2) expect(deepest, `L/h = ${ratio}`).toBeLessThanOrEqual(h + 1e-9);
		else {
			expect(deepest, `L/h = ${ratio}`).toBeGreaterThan(h);
			expect(Math.abs(deepest - cycloid(L, h).lowest)).toBeLessThan(0.002);
		}
		expect(cycloid(L, h).lowest > h).toBe(ratio > Math.PI / 2);
	}
	// Right at the threshold the cycloid arrives travelling horizontally: half an arch.
	expect(cycloid(Math.PI / 2 - 1e-6, 1).theta).toBeLessThan(Math.PI);
	expect(cycloid(Math.PI / 2 + 1e-6, 1).theta).toBeGreaterThan(Math.PI);
});

test("Beltrami's quantity, sin φ / v (Snell's law), is the same all along the optimum", () => {
	for (const [L, h] of [
		[4, 2],
		[1, 2],
		[8, 2]
	]) {
		const c = cycloid(L, h);
		const expected = 1 / Math.sqrt(4 * G * c.r);
		const xs = grid(L);
		const best = optimise(
			xs,
			xs.map((x) => (h * x) / L),
			300
		).at(-1)!;
		// Skip the first two segments, where the curve is still nearly vertical and the
		// mid-segment speed is a coarse estimate.
		const values = snell(xs.map((x, i) => ({ x, y: best.ys[i] })))
			.slice(2)
			.map((s) => s.value);
		for (const v of values) expect(rel(v, expected)).toBeLessThan(0.01);
		// On the straight line it is not constant: it falls as the bead speeds up.
		const lineValues = snell(
			Array.from({ length: 11 }, (_, i) => ({ x: (L * i) / 10, y: (h * i) / 10 }))
		).map((s) => s.value);
		expect(lineValues[1] / lineValues[9]).toBeGreaterThan(2);
	}
});

test('the hanging chain: links in balance make a catenary, lower than a parabola', () => {
	const span = 4;
	const length = 6;
	const cat = catenary(span, length);
	const devs = [10, 40, 160].map((N) => {
		const ch = hangingChain(span, length, N);
		// The horizontal pull is ρg·a, the catenary's parameter.
		expect(rel(ch.H, RHO * CG * cat.a)).toBeLessThan(0.02);
		return Math.max(...ch.pts.map((p) => Math.abs(p.y - cat.y(p.x))));
	});
	expect(devs[1]).toBeLessThan(devs[0] / 10);
	expect(devs[2]).toBeLessThan(1e-4);
	// Of all curves this long, the catenary has the least potential energy: less than the
	// parabola through the same supports with the same length.
	const ch = hangingChain(span, length, 160);
	expect(ch.energy).toBeLessThan(energyOf(parabolaPoints(span, length, 2000)));
});

test('the Lagrange multiplier is the price of length: the tension at the supports', () => {
	// Lengthening the chain by δL lowers the least energy by (tension at the supports)·δL.
	for (const [span, length] of [
		[4, 5],
		[4, 8],
		[2, 2.2]
	]) {
		const d = 1e-4;
		const slope =
			(hangingChain(span, length + d, 400).energy - hangingChain(span, length - d, 400).energy) /
			(2 * d);
		expect(rel(-slope, hangingChain(span, length, 400).support)).toBeLessThan(2e-3);
	}
});

test('stationary is not the same as least: the chain is a minimum, the arch a maximum', () => {
	const span = 4;
	const ch = hangingChain(span, 6);
	for (const eps of [-0.1, -0.02, 0.02, 0.1]) {
		const hanging = nudged(ch, span, eps);
		const arch = nudged(ch, span, eps, true);
		// Every link keeps its length and the chain still ends on the right support.
		const end = hanging.pts[hanging.pts.length - 1];
		expect(end.x).toBeCloseTo(span / 2, 9);
		expect(end.y).toBeCloseTo(0, 9);
		// Either way, the nudge raises the hanging chain and lowers the arch…
		expect(hanging.energy).toBeGreaterThan(ch.energy);
		expect(arch.energy).toBeLessThan(-ch.energy);
		// …by an amount that grows as ε²: the first-order change is zero for both.
		const twice = nudged(ch, span, 2 * eps).energy - ch.energy;
		expect(twice / (hanging.energy - ch.energy)).toBeCloseTo(4, 0);
	}
});
