/** Small helpers shared by the exoplanet scenes: colours, number formats, ticks. */
import { ticks } from '#lib/draw/index.ts';

/** Colour of a star of temperature `teff` (K): red dwarf, orange, yellow. */
export function starColor(teff: number): string {
	if (teff < 4000) return 'var(--ex-star-m)';
	if (teff < 5400) return 'var(--ex-star-k)';
	return 'var(--ex-star-g)';
}

/** A number with about three significant figures, thin-space thousands. */
export function sig(v: number, digits = 3): string {
	if (!isFinite(v)) return '–';
	if (Math.abs(v) < 1e-9) return '0';
	const a = Math.abs(v);
	if (a >= 10 ** digits) return Math.round(v).toLocaleString('en-US');
	const d = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
	return v.toFixed(Math.min(d, 6));
}

/** A speed in m/s, switching to cm/s or km/s where that reads better. */
export function speed(ms: number): string {
	if (ms < 1) return `${sig(ms * 100, 2)} cm/s`;
	if (ms >= 1000) return `${sig(ms / 1000)} km/s`;
	return `${sig(ms)} m/s`;
}

/** A time in days, or hours when shorter than two days. */
export function duration(days: number): string {
	if (days < 2) return `${sig(days * 24, 2)} hours`;
	if (days > 730) return `${sig(days / 365.25)} years`;
	return `${sig(days)} days`;
}

/** A fraction of the star's light as a percentage, with ppm for tiny ones. */
export function dimming(frac: number): string {
	if (frac <= 0) return 'none';
	if (frac < 1e-3) return `${sig(frac * 100, 2)}% (${sig(frac * 1e6, 2)} ppm)`;
	return `${sig(frac * 100, 2)}%`;
}

/** Ticks over [lo, hi] and the decimals their labels need. */
export function ticksWithDecimals(lo: number, hi: number, count = 4) {
	const tk = ticks(lo, hi, count);
	const stepV = tk.length > 1 ? tk[1] - tk[0] : Math.abs(hi - lo) || 1;
	const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(stepV) + 1e-9)));
	return { ticks: tk, decimals };
}

/** "1 in 213" for a probability. */
export function oneIn(p: number): string {
	if (p >= 0.5) return `${Math.round(p * 100)}%`;
	return `1 in ${sig(1 / p, 2)}`;
}
