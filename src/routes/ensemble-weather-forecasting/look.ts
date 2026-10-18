/**
 * What the scenes share: the settings a step gives the model (a control's value on the steps
 * that offer it, the default elsewhere), cached model runs, and the painting of Hovmöller strips.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { CLIMATE, cycle, forecast, reliabilityByDay, verify, type Forecast } from './model';

/** The forcing of each forecast model the reader can pick. */
export const MODEL_F: Record<string, number> = { perfect: 8, weak10: 7.2, weak20: 6.4 };
/** The cell followed as "your town". */
export const TOWN = 20;
/** Members of every ensemble on the page, as at ECMWF. */
export const MEMBERS = 51;
/** Start days averaged for the statistics. */
export const CASES = 40;
/** Start days of the reliability diagram (× 40 cells). */
export const REL_CASES = 100;

const offers = (step: Step, id: string) => step.controls?.some((c) => c.id === id) ?? false;

/** The model settings on this step. */
export function settings(step: Step, params: Params) {
	const obsErr = offers(step, 'obsErr') ? Number(params.obsErr) : 0.3;
	const model = offers(step, 'model') ? String(params.model) : 'perfect';
	const lead = offers(step, 'lead') ? Number(params.lead) : 3;
	const seed = Number(step.hints?.seed ?? 3) + (offers(step, 'day') ? Number(params.day) : 0);
	return { obsErr, model, F: MODEL_F[model] ?? 8, lead, seed };
}

/** A tiny memo: the last `max` results by key. */
function memo<T>(max: number) {
	// a plain cache of model runs, not reactive state
	const m = new Map<string, T>();
	return (key: string, make: () => T) => {
		let hit = m.get(key);
		if (hit === undefined) {
			hit = make();
			if (m.size >= max) m.delete(m.keys().next().value as string);
			m.set(key, hit);
		}
		return hit;
	};
}

const forecasts = memo<Forecast>(12);
/** A forecast (cached): the truth of `seed`'s day, a control and `members − 1` members. */
export const cachedForecast = (
	seed: number,
	obsErr: number,
	members: number,
	F: number,
	days: number
) =>
	forecasts(`${seed}|${obsErr}|${members}|${F}|${days}`, () =>
		forecast({ seed, obsErr, members, F, days })
	);

const stats = memo<ReturnType<typeof verify>>(12);
/** Error and spread averaged over CASES start days (cached). */
export const cachedVerify = (obsErr: number, members: number, F: number, days: number) =>
	stats(`${obsErr}|${members}|${F}|${days}`, () =>
		verify({ obsErr, members, F, days }, members > 1 ? CASES : 30)
	);

const rel = memo<ReturnType<typeof reliabilityByDay>>(4);
/** Reliability at every lead from 1 to 30 days (cached per model). */
export const cachedReliability = (F: number) =>
	rel(`${F}`, () => reliabilityByDay({ obsErr: 0.3, members: MEMBERS, F }, 30, REL_CASES));

const cycles = memo<ReturnType<typeof cycle>>(6);
/** The forecast–observe–correct cycle on `seed`'s day (cached). */
export const cachedCycle = (seed: number, days: number) =>
	cycles(`${seed}|${days}`, () =>
		cycle({ seed, obsErr: 1, spacing: 2, every: 0.5, members: MEMBERS, days })
	);

// ---- colours ---------------------------------------------------------------------------------

export type RGB = [number, number, number];

/** Reads CSS colours (custom properties of the document) as RGB. */
export function cssColours(names: readonly string[]): RGB[] {
	if (typeof document === 'undefined') return names.map(() => [128, 128, 128]);
	const c = document.createElement('canvas');
	c.width = c.height = 1;
	const ctx = c.getContext('2d', { willReadFrequently: true });
	const cs = getComputedStyle(document.documentElement);
	return names.map((n) => {
		if (!ctx) return [128, 128, 128];
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = cs.getPropertyValue(n).trim() || '#000';
		ctx.fillRect(0, 0, 1, 1);
		const px = ctx.getImageData(0, 0, 1, 1).data;
		return [px[0], px[1], px[2]];
	});
}

const mix = (a: RGB, b: RGB, f: number): RGB => [
	a[0] + (b[0] - a[0]) * f,
	a[1] + (b[1] - a[1]) * f,
	a[2] + (b[2] - a[2]) * f
];

/** Colour of a weather value: cold below the climate's mean, warm above. */
export function valueColour(v: number, cold: RGB, mid: RGB, warm: RGB): RGB {
	const u = Math.max(-1, Math.min(1, (v - CLIMATE.mean) / (2.5 * CLIMATE.sd)));
	return u < 0 ? mix(mid, cold, -u) : mix(mid, warm, u);
}

/** Colour of an error: from the background to `hot` as |e| goes from 0 to 6. */
export function errorColour(e: number, bg: RGB, hot: RGB): RGB {
	return mix(bg, hot, Math.min(1, Math.abs(e) / 6) ** 0.7);
}

/**
 * Paints rows of cells (one pixel per cell and row) into a PNG data URL, for an SVG `<image>`
 * drawn with `image-rendering: pixelated`.
 */
export function paintRows(rows: readonly ArrayLike<number>[], colour: (v: number) => RGB) {
	if (typeof document === 'undefined' || rows.length === 0) return '';
	const w = rows[0].length;
	const h = rows.length;
	const cv = document.createElement('canvas');
	cv.width = w;
	cv.height = h;
	const ctx = cv.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(w, h);
	for (let r = 0; r < h; r++)
		for (let k = 0; k < w; k++) {
			const c = colour(rows[r][k]);
			const i = 4 * (r * w + k);
			img.data[i] = c[0];
			img.data[i + 1] = c[1];
			img.data[i + 2] = c[2];
			img.data[i + 3] = 255;
		}
	ctx.putImageData(img, 0, 0);
	return cv.toDataURL();
}

/** One number with a fixed count of significant digits, without trailing zeros. */
export const sig = (v: number, digits = 2) => String(Number(v.toPrecision(digits)));
