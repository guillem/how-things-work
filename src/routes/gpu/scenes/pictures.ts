/**
 * The jobs' pictures, painted once into a canvas and returned as data URLs for
 * an SVG `<image>` (as in waves-interference and black-holes): the shaded
 * image, the product matrix, and the map of what each warp costs.
 * Empty strings outside the browser (prerendering).
 */
import { IMAGE, MATRIX_N, PIXEL_COST, exampleProduct, pixelJob, shade, WARP } from '../gpu';

const cache = new Map<string, string>();

function paint(
	key: string,
	w: number,
	h: number,
	pixel: (x: number, y: number) => readonly [number, number, number]
): string {
	if (typeof document === 'undefined') return '';
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	const cv = document.createElement('canvas');
	cv.width = w;
	cv.height = h;
	const ctx = cv.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(w, h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const [r, g, b] = pixel(x, y);
			const k = 4 * (y * w + x);
			img.data[k] = Math.round(255 * r);
			img.data[k + 1] = Math.round(255 * g);
			img.data[k + 2] = Math.round(255 * b);
			img.data[k + 3] = 255;
		}
	ctx.putImageData(img, 0, 0);
	const url = cv.toDataURL();
	cache.set(key, url);
	return url;
}

/** What the shader draws. */
export const shadedImage = () => paint('shaded', IMAGE.w, IMAGE.h, (x, y) => shade(x, y).rgb);

/** A ramp from deep blue through teal to pale yellow (readable as "low → high"). */
function ramp(u: number): [number, number, number] {
	const stops: [number, number, number][] = [
		[0.13, 0.18, 0.42],
		[0.1, 0.5, 0.55],
		[0.45, 0.75, 0.35],
		[0.98, 0.92, 0.55]
	];
	const x = Math.max(0, Math.min(1, u)) * (stops.length - 1);
	const k = Math.min(stops.length - 2, Math.floor(x));
	const f = x - k;
	return stops[k].map((c, i) => c + f * (stops[k + 1][i] - c)) as [number, number, number];
}

/** The product C = A·B of the example matrices, one pixel per element. */
export const productImage = () => {
	if (typeof document === 'undefined') return '';
	if (cache.has('product')) return cache.get('product') ?? '';
	const { C } = exampleProduct(MATRIX_N);
	let lo = Infinity;
	let hi = -Infinity;
	for (const v of C) {
		lo = Math.min(lo, v);
		hi = Math.max(hi, v);
	}
	return paint('product', MATRIX_N, MATRIX_N, (x, y) =>
		ramp((C[y * MATRIX_N + x] - lo) / (hi - lo))
	);
};

/**
 * Each warp's 32 pixels coloured by what the warp costs: sky warps pale, ball
 * warps mid, warps across the edge (both branches) strong. `dark` picks the
 * theme's background tones.
 */
export const warpMap = (dark: boolean) => {
	const job = pixelJob();
	const tone = (c: number): [number, number, number] =>
		c === PIXEL_COST.sky
			? dark
				? [0.16, 0.2, 0.26]
				: [0.86, 0.9, 0.95]
			: c === PIXEL_COST.sphere
				? dark
					? [0.45, 0.3, 0.16]
					: [0.98, 0.78, 0.55]
				: dark
					? [0.98, 0.42, 0.42]
					: [0.85, 0.15, 0.2];
	return paint(`warps-${dark}`, IMAGE.w, IMAGE.h, (x, y) =>
		tone(job.warpCost[Math.floor((y * IMAGE.w + x) / WARP)])
	);
};
