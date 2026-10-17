/**
 * The 2-D data of the diffusion-models explainer: the "two moons", two interleaved half circles
 * (as scikit-learn's make_moons), points made up by the computer with a Gaussian jitter of sd
 * 0.05, moved and scaled to sit around the origin. Label 0 = the upper moon, 1 = the lower one.
 * The training script (scripts/data/diffusion-models/train.mjs) draws its points with `moon`.
 * Erasable TypeScript only, no imports: Node runs this file as-is.
 */

export const LABELS = ['upper moon', 'lower moon'] as const;
const JITTER = 0.05;
const SCALE = 1.2;

/** One point of moon `label`, from a uniform and a normal generator. */
export function moon(rand: () => number, gauss: () => number, label: number): [number, number] {
	const th = Math.PI * rand();
	let x = label === 0 ? Math.cos(th) : 1 - Math.cos(th);
	let y = label === 0 ? Math.sin(th) : 0.5 - Math.sin(th);
	x += JITTER * gauss();
	y += JITTER * gauss();
	return [(x - 0.5) * SCALE, (y - 0.25) * SCALE];
}

/** The centre line of moon `label` (no jitter), as `n` points in the page's coordinates. */
export function moonCurve(label: number, n = 60): [number, number][] {
	return Array.from({ length: n }, (_, i) => {
		const th = (Math.PI * i) / (n - 1);
		const x = label === 0 ? Math.cos(th) : 1 - Math.cos(th);
		const y = label === 0 ? Math.sin(th) : 0.5 - Math.sin(th);
		return [(x - 0.5) * SCALE, (y - 0.25) * SCALE];
	});
}

/** Distance from (px, py) to the centre line of moon `label`, in the page's coordinates. */
function distanceToMoon(px: number, py: number, label: number): number {
	// back to make_moons coordinates, where the moon is a half circle of radius 1
	const x = px / SCALE + 0.5;
	const y = py / SCALE + 0.25;
	const cx = label === 0 ? 0 : 1;
	const cy = label === 0 ? 0 : 0.5;
	const dx = x - cx;
	const dy = y - cy;
	// the upper moon is the half with y ≥ 0 around its centre, the lower one the half below
	const onArc = label === 0 ? dy >= 0 : dy <= 0;
	let d: number;
	if (onArc) d = Math.abs(Math.hypot(dx, dy) - 1);
	else d = Math.min(Math.hypot(dx - 1, dy), Math.hypot(dx + 1, dy));
	return d * SCALE;
}

/** Which moon a point is nearest to, and how far from it (page coordinates). */
export function nearestMoon(px: number, py: number): { label: number; d: number } {
	const d0 = distanceToMoon(px, py, 0);
	const d1 = distanceToMoon(px, py, 1);
	return d0 <= d1 ? { label: 0, d: d0 } : { label: 1, d: d1 };
}

/**
 * A point counts as "on the data" when it is within 3 jitter widths of a moon's centre line
 * (3 × 0.05 in make_moons units): 99.7% of the jitter of a real moon point along the normal.
 */
export const ON_DATA = 3 * JITTER * SCALE;

/** Fractions of points (flat [x, y, x, y, …]) on either moon, and on each moon. */
export function onMoons(xy: ArrayLike<number>): { any: number; upper: number; lower: number } {
	const n = xy.length / 2;
	let any = 0;
	let upper = 0;
	let lower = 0;
	for (let i = 0; i < n; i++) {
		const m = nearestMoon(xy[2 * i], xy[2 * i + 1]);
		if (m.d <= ON_DATA) {
			any++;
			if (m.label === 0) upper++;
			else lower++;
		}
	}
	return { any: any / n, upper: upper / n, lower: lower / n };
}
