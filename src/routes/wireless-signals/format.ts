/** Number formatting shared by the narrative's controls and the scenes. */

/** A distance in metres, from its base-10 logarithm: "3.2 m", "316 m", "3.2 km". */
export function distanceText(logd: number) {
	const d = 10 ** logd;
	if (d < 10) return `${d.toFixed(1)} m`;
	if (d < 1000) return `${Math.round(d)} m`;
	if (d < 10_000) return `${(d / 1000).toFixed(1)} km`;
	return `${Math.round(d / 1000)} km`;
}

/** Signed dB with one decimal: "+3.0 dB", "−12.5 dB" (true minus sign). */
export const db = (v: number, digits = 1) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)} dB`;

/** Unsigned decimal with a true minus sign. */
export const num = (v: number, digits = 1) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;

/** An error rate: "0", "3.1 × 10⁻⁴", "12%", "1 in 3". */
export function rate(v: number) {
	if (v <= 0) return '0';
	if (v >= 0.01) return `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;
	const e = Math.floor(Math.log10(v));
	const m = v / 10 ** e;
	return `${m.toFixed(1)} × 10${sup(e)}`;
}

/** An integer as superscript digits: −4 → ⁻⁴. */
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]))
		.join('');

/** Thousands with thin spaces: 200000 → "200,000". */
export const count = (n: number) => n.toLocaleString('en-GB');

/** Bit rate in bits per second: "166 Mbit/s", "1.2 Gbit/s". */
export function bitRate(bps: number) {
	if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbit/s`;
	if (bps >= 1e8) return `${Math.round(bps / 1e6)} Mbit/s`;
	if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbit/s`;
	return `${Math.round(bps / 1e3)} kbit/s`;
}
