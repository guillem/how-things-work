/** Colour of gas at temperature T (K): cold blue at 250 K through to hot red at 2,500 K (log scale). */
export function tempMix(T: number) {
	const u = Math.min(1, Math.max(0, Math.log(T / 250) / Math.log(10)));
	return `color-mix(in srgb, var(--he-hot) ${Math.round(u * 100)}%, var(--he-cold))`;
}

export const fmt = (v: number, d = 0) =>
	v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`;
export const bar = (pa: number) => pa / 1e5;
