/** Colour of gas at temperature T (K): cold blue at 250 K through to hot red at 2,500 K (log scale). */
export function tempMix(T: number) {
	const u = Math.min(1, Math.max(0, Math.log(T / 250) / Math.log(10)));
	return `color-mix(in srgb, var(--he-hot) ${Math.round(u * 100)}%, var(--he-cold))`;
}

export const fmt = (v: number, d = 0) =>
	v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`;
export const bar = (pa: number) => pa / 1e5;

/** A round axis maximum ≥ v from a finer ladder than `niceMax` (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ). */
export function niceUp(v: number) {
	if (!(v > 0)) return 1;
	const mag = Math.pow(10, Math.floor(Math.log10(v)));
	const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * mag >= v - 1e-12) ?? 10;
	return m * mag;
}

/** A row of a readout card (`Card.svelte`). */
export interface Row {
	id: string;
	label: string;
	value: string;
	color?: string;
	strong?: boolean;
	note?: string;
}
