/** Number formats shared by the wind-turbine scenes (a true minus sign, fixed decimals). */
export const num = (v: number, digits = 2) =>
	`${v < 0 && Math.abs(v) >= 0.5 * 10 ** -digits ? '−' : ''}${Math.abs(v).toFixed(digits)}`;

export const deg = (v: number, digits = 1) => `${num(v, digits)}°`;

/** Watts as W, kW or MW. */
export function watts(w: number): string {
	if (w >= 1e6) return `${(w / 1e6).toFixed(w >= 1e7 ? 1 : 2)} MW`;
	if (w >= 1e3) return `${(w / 1e3).toFixed(w >= 1e5 ? 0 : 1)} kW`;
	return `${w.toFixed(0)} W`;
}

/** Newtons as kN. */
export const newtons = (n: number) => `${Math.round(n / 1e3).toLocaleString('en-US')} kN`;
