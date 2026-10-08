export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Map `v` from [a, b] to [0, 1], clamped. */
export const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number) => {
	const u = norm(v, a, b);
	return u * u * (3 - 2 * u);
};
export const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
export const easeIn = (u: number) => u * u * u;

/** Phase in [0, 1) of a repeating cycle of `period` seconds. */
export const cycle = (t: number, period: number, offset = 0) => {
	const p = (t / period + offset) % 1;
	return p < 0 ? p + 1 : p;
};
/** Triangle wave in [0, 1]: 0 → 1 → 0 over one period. */
export const pingpong = (t: number, period: number, offset = 0) => {
	const p = cycle(t, period, offset);
	return p < 0.5 ? p * 2 : 2 - p * 2;
};
/** Sine wave in [0, 1]. */
export const wave = (t: number, period: number, offset = 0) =>
	0.5 + 0.5 * Math.sin(TAU * cycle(t, period, offset));

export interface Point {
	x: number;
	y: number;
}

export const polar = (cx: number, cy: number, r: number, angle: number): Point => ({
	x: cx + r * Math.cos(angle),
	y: cy + r * Math.sin(angle)
});

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Total length of a polyline. */
export function polylineLength(points: Point[]) {
	let total = 0;
	for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
	return total;
}

/**
 * Point at fraction `u` (0–1) along a polyline, by arc length. Also returns
 * the direction angle (radians) at that point.
 */
export function along(points: Point[], u: number): Point & { angle: number } {
	if (points.length === 0) return { x: 0, y: 0, angle: 0 };
	if (points.length === 1) return { ...points[0], angle: 0 };
	const total = polylineLength(points);
	let target = clamp(u) * total;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const d = dist(a, b);
		if (target <= d || i === points.length - 1) {
			const f = d === 0 ? 0 : clamp(target / d);
			return {
				x: lerp(a.x, b.x, f),
				y: lerp(a.y, b.y, f),
				angle: Math.atan2(b.y - a.y, b.x - a.x)
			};
		}
		target -= d;
	}
	const last = points[points.length - 1];
	return { ...last, angle: 0 };
}

/** Catmull-Rom spline through `points`, sampled into a smooth polyline. */
export function smooth(points: Point[], samplesPerSegment = 8): Point[] {
	if (points.length < 3) return points.slice();
	const out: Point[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];
		for (let s = 0; s < samplesPerSegment; s++) {
			const u = s / samplesPerSegment;
			const u2 = u * u;
			const u3 = u2 * u;
			out.push({
				x:
					0.5 *
					(2 * p1.x +
						(-p0.x + p2.x) * u +
						(2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
						(-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
				y:
					0.5 *
					(2 * p1.y +
						(-p0.y + p2.y) * u +
						(2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
						(-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3)
			});
		}
	}
	out.push(points[points.length - 1]);
	return out;
}

/** SVG path `d` string for a polyline. */
export const pathFrom = (points: Point[]) =>
	points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** Deterministic pseudo-random number in [0, 1) for seed `i` (and optional salt). */
export function hash(i: number, salt = 0) {
	let x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	x -= Math.floor(x);
	return x;
}

/** A sine wave path along the x axis, for drawing photons. */
export function wavePath(length: number, amplitude: number, wavelength: number) {
	const steps = Math.max(8, Math.round(length / 2));
	let d = '';
	for (let i = 0; i <= steps; i++) {
		const x = (i / steps) * length;
		const y = amplitude * Math.sin((x / wavelength) * TAU);
		d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
	}
	return d;
}

/**
 * Seedable pseudo-random generator (mulberry32): returns a function giving
 * numbers in [0, 1). Same seed, same sequence — for models that must replay
 * identically (deep links, screenshots, tests).
 */
export function rng(seed: number) {
	let a = seed >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
