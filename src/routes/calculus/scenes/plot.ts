/**
 * Shared geometry for the calculus scenes: where the plots sit on the stage,
 * the x scale they share (so a point on one plot lines up with the same x on
 * the plot below), "nice" ranges for the lower plot, SVG paths of functions
 * and of signed areas, and how numbers are written.
 */
import { scale, type Scale } from '#lib/draw/index.ts';
import type { Params, Step } from '#lib/explainer/index.ts';
import { X0, X1, curveFor, parseKnots, type Curve, type Fn } from '../calculus';

/** Left and right edges of the plots; the readout panel starts at PANEL. */
export const LEFT = 84;
export const RIGHT = 676;
export const PANEL = 716;

/** The x scale every plot shares. */
export const sx = scale([X0, X1], [LEFT, RIGHT]);

/** The curve's plot always shows this range of heights (the knots stay inside it). */
export const F_RANGE: [number, number] = [-4, 12];

interface Box {
	top: number;
	bottom: number;
}

/**
 * The plot boxes: with `split` 0 the upper plot fills the stage; with 1 it
 * shares it with a lower plot. Tween `split` to move between the two layouts.
 */
export function layout(split: number): { upper: Box; lower: Box } {
	return {
		upper: { top: 56, bottom: 540 - (540 - 262) * split },
		lower: { top: 346, bottom: 540 }
	};
}

/** Range [lo, hi] including 0 and the values, rounded out to readable limits. */
export function niceRange(lo: number, hi: number): [number, number] {
	const nice = (v: number) => {
		if (!(v > 1e-9)) return 0;
		const mag = Math.pow(10, Math.floor(Math.log10(v)));
		return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * mag >= v - 1e-9) ?? 10) * mag;
	};
	let a = -nice(-Math.min(0, lo));
	let b = nice(Math.max(0, hi));
	if (a === 0 && b === 0) b = 1;
	// Keep a sliver of room on a side that is (almost) empty, so 0 is not on the frame.
	if (a === 0 && lo < -1e-9) a = -b / 10;
	if (b === 0 && hi > 1e-9) b = -a / 10;
	return [a, b];
}

/** About `count` round tick values over [lo, hi], always including 0. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
	const raw = (hi - lo) / count;
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const stepSize = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	const out: number[] = [];
	for (let v = Math.ceil(lo / stepSize - 1e-9) * stepSize; v <= hi + 1e-9; v += stepSize)
		out.push(Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(10)));
	return out;
}

/** SVG path of y = f(x) from `from` to `to`. */
export function fnPath(f: Fn, sy: Scale, from = X0, to = X1, samples = 160): string {
	if (to <= from) return '';
	let d = '';
	for (let i = 0; i <= samples; i++) {
		const x = from + ((to - from) * i) / samples;
		d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(f(x)).toFixed(1)}`;
	}
	return d;
}

/**
 * Closed paths of the area between y = f(x) and the axis from `from` to `to`:
 * the part above the axis and the part below it, drawn in different colours.
 */
export function signedAreaPaths(
	f: Fn,
	sy: Scale,
	from: number,
	to: number,
	samples = 160
): { above: string; below: string } {
	if (to - from < 1e-9) return { above: '', below: '' };
	const part = (g: (v: number) => number) => {
		const y0 = sy(0).toFixed(1);
		let d = `M${sx(from).toFixed(1)} ${y0}`;
		for (let i = 0; i <= samples; i++) {
			const x = from + ((to - from) * i) / samples;
			d += `L${sx(x).toFixed(1)} ${sy(g(f(x))).toFixed(1)}`;
		}
		return `${d}L${sx(to).toFixed(1)} ${y0}Z`;
	};
	return { above: part((v) => Math.max(0, v)), below: part((v) => Math.min(0, v)) };
}

/** A number with a real minus sign and fixed decimals: −0.50 (never −0.00). */
export function num(v: number, decimals = 2): string {
	const s = Math.abs(v).toFixed(decimals);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** The curve a step shows: forced by the step (`hints.curve`), or the reader's choice. */
export function stepCurve(step: Step, params: Params): Curve {
	const forced = step.hints?.curve;
	return curveFor(String(forced ?? params.curve ?? 'parabola'), parseKnots(params.knots));
}

/** The point's x from the `x` control, kept inside the plot. */
export function pointX(params: Params): number {
	const v = Number(params.x);
	return Number.isFinite(v) ? Math.min(X1, Math.max(X0, v)) : 1;
}

/** Rounded to hundredths, inside the plot: what the handles write to `x`. */
export const toX = (v: number) => Math.round(Math.min(X1, Math.max(X0, v)) * 100) / 100;

/** Approximate width of a line of text, for laying out pills and labels. */
export const textWidth = (text: string, size: number) => text.length * size * 0.55;
