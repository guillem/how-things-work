/**
 * The arithmetic behind the exponentials-and-logarithms explainer: growing by a fixed amount
 * against growing by a fixed factor, counting doublings, the straight line on a log axis, the
 * doubling time against the rules of 70 and 72, and a slide rule that multiplies by adding
 * lengths. Plain repeated addition and multiplication, so the page shows exactly what it says.
 */

/** Start, start + add, start + 2·add, …: `steps + 1` values, by repeated addition. */
export function arithmetic(start: number, add: number, steps: number): number[] {
	const out = [start];
	for (let k = 1; k <= steps; k++) out.push(out[k - 1] + add);
	return out;
}

/** Start, start·f, start·f², …: `steps + 1` values, by repeated multiplication. */
export function geometric(start: number, factor: number, steps: number): number[] {
	const out = [start];
	for (let k = 1; k <= steps; k++) out.push(out[k - 1] * factor);
	return out;
}

/** The value after a whole or fractional number of steps: start × factor^steps. */
export const grow = (start: number, factor: number, steps: number) =>
	start * Math.pow(factor, steps);

/**
 * How many whole doublings take `start` to at least `target` (counted one doubling at a time),
 * and the exact count with its fractional part: the logarithm base 2 of target ÷ start.
 */
export function doublings(start: number, target: number): { whole: number; exact: number } {
	let v = start;
	let whole = 0;
	while (v * 2 <= target) {
		v *= 2;
		whole++;
	}
	return { whole, exact: Math.log2(target / start) };
}

/** The logarithm of `x` in base `b`: how many steps of ×b take 1 to x (fractions included). */
export const logBase = (b: number, x: number) => Math.log(x) / Math.log(b);

/**
 * The first step at which multiplying by `factor` overtakes adding `add`, both from `start`
 * (null if it never does within `limit` steps, e.g. a factor of 1 or less).
 */
export function crossover(start: number, add: number, factor: number, limit = 100000) {
	let lin = start;
	let geo = start;
	for (let k = 1; k <= limit; k++) {
		lin += add;
		geo *= factor;
		if (geo > lin) return k;
	}
	return null;
}

/** Least-squares straight line through the points: slope, intercept and the worst residual. */
export function fitLine(xs: readonly number[], ys: readonly number[]) {
	const n = xs.length;
	const mx = xs.reduce((s, v) => s + v, 0) / n;
	const my = ys.reduce((s, v) => s + v, 0) / n;
	let sxy = 0;
	let sxx = 0;
	for (let i = 0; i < n; i++) {
		sxy += (xs[i] - mx) * (ys[i] - my);
		sxx += (xs[i] - mx) ** 2;
	}
	const slope = sxy / sxx;
	const intercept = my - slope * mx;
	const residual = Math.max(...xs.map((x, i) => Math.abs(ys[i] - (intercept + slope * x))));
	return { slope, intercept, residual };
}

/** Exact number of steps to double at `percent` growth per step (compounded once per step). */
export const doublingTime = (percent: number) => Math.log(2) / Math.log(1 + percent / 100);

/** The rule of thumb: doubling time ≈ rule ÷ percent (rule = 70 or 72). */
export const ruleOf = (rule: number, percent: number) => rule / percent;

/** A logistic curve: the same factor at first, slowing as it nears `cap` (a culture running out of food). */
export function logistic(start: number, factor: number, cap: number, steps: number): number[] {
	const r = factor - 1;
	const out = [start];
	for (let k = 1; k <= steps; k++) {
		const v = out[k - 1];
		out.push(v + r * v * (1 - v / cap));
	}
	return out;
}

// ---- the slide rule ---------------------------------------------------------------------------

/** Position of a number from 1 to 10 on a slide-rule scale, as a fraction of the scale's length. */
export const position = (x: number) => Math.log10(x);

/** The number at a position (fraction of the scale) on a 1–10 scale. */
export const valueAt = (p: number) => Math.pow(10, p);

/**
 * Spacing of the graduations of a 25 cm (10-inch) rule's D scale around x: every 0.01 from 1
 * to 2, every 0.02 from 2 to 4, every 0.05 from 4 to 10.
 */
export const graduation = (x: number) => (x < 2 ? 0.01 : x < 4 ? 0.02 : 0.05);

/** The ticks of the scale from 1 to 10, flagged major (whole numbers) or mid (halves). */
export function scaleTicks(): { x: number; kind: 'major' | 'mid' | 'minor' }[] {
	const out: { x: number; kind: 'major' | 'mid' | 'minor' }[] = [];
	let x = 1;
	while (x <= 10 + 1e-9) {
		const r = Math.round(x * 100) / 100;
		const kind =
			Math.abs(r - Math.round(r)) < 1e-9
				? 'major'
				: Math.abs(r * 2 - Math.round(r * 2)) < 1e-9 ||
					  (r < 2 && Math.abs(r * 10 - Math.round(r * 10)) < 1e-9)
					? 'mid'
					: 'minor';
		out.push({ x: r, kind });
		x = r + graduation(r);
	}
	return out;
}

/**
 * Multiplies a × b (each from 1 to 10) the way a slide rule does: slide the C scale so its index
 * sits over a on the D scale, and read D under b on C. The lengths add: log a + log b. When the
 * sum passes the end of the rule, the slide's other index (its 10) goes over a instead, which
 * takes one whole scale length off: the reading is then a × b ÷ 10, and the user adds the zero.
 *
 * Returns where the slide's left end sits (as a fraction of the scale; negative when the right
 * index is used), the cursor's position on D, the exact product, and the reading rounded to half
 * a graduation of the scale (what a careful eye reads off a 25 cm rule: about 3 figures).
 */
export function slideRule(a: number, b: number) {
	const sum = position(a) + position(b);
	const wrapped = sum > 1;
	const slide = wrapped ? position(a) - 1 : position(a);
	const cursor = wrapped ? sum - 1 : sum;
	const onD = valueAt(cursor);
	const step = graduation(onD) / 2;
	const reading = Math.round(onD / step) * step;
	const shift = wrapped ? 10 : 1;
	return {
		slide,
		cursor,
		wrapped,
		exact: a * b,
		reading: Number((reading * shift).toPrecision(6)),
		precision: step * shift
	};
}
