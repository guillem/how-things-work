/** The plasma controls as numbers, with the defaults of `steps.ts`. */
import type { Params } from '#lib/explainer/index.ts';
import { KELVIN_PER_KEV, type Plasma } from '../model';

export function plasmaOf(params: Params): Plasma {
	const num = (id: string, fallback: number) => {
		const v = Number(params[id]);
		return Number.isFinite(v) ? v : fallback;
	};
	return { t: num('temp', 10), n: 10 ** num('logN', 20), tau: 10 ** num('logTau', 0) };
}

/** "116 million K" / "1.2 billion K". */
export function kelvinText(keV: number): string {
	const mk = (keV * KELVIN_PER_KEV) / 1e6;
	if (mk >= 1000) return `${(mk / 1000).toFixed(1)} billion K`;
	return `${mk < 9.95 ? mk.toFixed(1) : Math.round(mk)} million K`;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => (c === '-' ? '⁻' : SUP[Number(c)]))
		.join('');
/** 2.5 × 10²⁰, with two significant figures. */
export function sci(v: number, digits = 2): string {
	if (!(v > 0) || !Number.isFinite(v)) return '—';
	let e = Math.floor(Math.log10(v));
	let m = v / 10 ** e;
	if (Number(m.toFixed(digits - 1)) >= 10) {
		e += 1;
		m /= 10;
	}
	return `${m.toFixed(digits - 1)} × 10${sup(e)}`;
}
/** 10ⁿ for an axis tick. */
export const pow10 = (e: number) => `10${sup(e)}`;

/** A power density in W/m³ as readable text. */
export function powerText(w: number): string {
	const a = Math.abs(w);
	const n = (v: number) => Number(v.toPrecision(2)).toLocaleString('en-US');
	if (a >= 1e6) return `${n(w / 1e6)} MW/m³`;
	if (a >= 1e3) return `${n(w / 1e3)} kW/m³`;
	return `${n(w)} W/m³`;
}

/** A gain Q as text. */
export function qText(q: number): string {
	if (!Number.isFinite(q)) return '∞ (ignited)';
	if (q >= 100) return String(Math.round(q));
	if (q >= 10) return q.toFixed(0);
	if (q >= 1) return q.toFixed(1);
	if (q >= 0.01) return q.toFixed(2);
	return sci(q, 1);
}
