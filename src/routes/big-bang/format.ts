/** Text for the big-bang explainer's controls and readouts. */
import { GYR_S } from './cosmology';

const n0 = (v: number) => Math.round(v).toLocaleString('en-GB');
/** Superscript digits for powers of ten: −3 → ⁻³. */
const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]))
		.join('');

/** A number in scientific notation with `digits` significant figures: 1.3 × 10¹⁰. */
export function sci(v: number, digits = 2) {
	if (v === 0) return '0';
	const e = Math.floor(Math.log10(Math.abs(v)));
	if (e >= -2 && e < 5) return v.toLocaleString('en-GB', { maximumSignificantDigits: digits });
	const m = v / 10 ** e;
	return `${m.toFixed(digits - 1)} × 10${sup(e)}`;
}

/** A time since the Big Bang, given in seconds. */
export function timeText(s: number) {
	if (s < 1) return `${s.toPrecision(2)} s`;
	if (s < 100) return `${s.toPrecision(2)} seconds`;
	if (s < 3600 * 1.5) return `${(s / 60).toPrecision(2)} minutes`;
	if (s < 86400 * 2) return `${(s / 3600).toPrecision(2)} hours`;
	const yr = s / (GYR_S / 1e9);
	if (yr < 2) return `${(s / 86400).toPrecision(2)} days`;
	if (yr < 1e4) return `${n0(Number(yr.toPrecision(2)))} years`;
	if (yr < 1e6) return `${n0(Number(yr.toPrecision(3)))} years`;
	if (yr < 1e9) return `${n0(Number((yr / 1e6).toPrecision(3)))} million years`;
	return `${(yr / 1e9).toFixed(2)} billion years`;
}

/** A time in Gyr, as text. */
export const gyrText = (t: number) =>
	t < 1 ? `${n0(t * 1000)} million years` : `${t.toFixed(t < 10 ? 2 : 1)} billion years`;

/** A temperature in kelvin. */
export function tempText(T: number) {
	if (T >= 1e5) return `${sci(T, 2)} K`;
	if (T >= 100) return `${n0(Number(T.toPrecision(3)))} K`;
	return `${T.toFixed(T < 10 ? 2 : 1)} K`;
}

/** A redshift. */
export function zText(z: number) {
	if (z < 0.1) return z.toFixed(3);
	if (z < 10) return z.toFixed(2);
	return n0(z);
}

/** A distance in billions of light years. */
export function glyText(d: number) {
	if (d < 0.01) return `${n0(d * 1000)} million light years`;
	if (d < 1) return `${(d * 1000).toPrecision(2)} million light years`;
	return `${d.toFixed(d < 10 ? 2 : 1)} billion light years`;
}

/** A wavelength in metres, in the most readable unit. */
export function lambdaText(m: number) {
	if (m < 1e-9) return `${sci(m * 1e12, 2)} pm`;
	if (m < 1e-6) return `${n0(m * 1e9)} nm`;
	if (m < 1e-3) return `${(m * 1e6).toPrecision(2)} µm`;
	if (m < 1e-2) return `${(m * 1e3).toPrecision(3)} mm`;
	return `${(m * 100).toPrecision(2)} cm`;
}
