/** Helpers the Ising scenes share: reading the step's controls, formats and colours. */
import type { Params, Step } from '#lib/explainer/index.ts';

/** A number set either by the control the hint `<key>Param` names or by the hint `<key>`. */
export function numberFrom(step: Step, params: Params, key: string, fallback: number) {
	const h = step.hints ?? {};
	const p = h[`${key}Param`];
	const v = p !== undefined ? params[String(p)] : h[key];
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

/** A string set either by the control the hint `<key>Param` names or by the hint `<key>`. */
export function stringFrom(step: Step, params: Params, key: string, fallback: string) {
	const h = step.hints ?? {};
	const p = h[`${key}Param`];
	const v = p !== undefined ? params[String(p)] : h[key];
	return v === undefined ? fallback : String(v);
}

/** A signed number with a real minus sign. */
export const signed = (v: number, digits = 2) => {
	const s = Math.abs(v).toFixed(digits);
	return Number(s) === 0 ? s : v < 0 ? `−${s}` : `+${s}`;
};

/** A number with a real minus sign (no plus). */
export const num = (v: number, digits = 2) => {
	const s = Math.abs(v).toFixed(digits);
	return v < 0 && Number(s) !== 0 ? `−${s}` : s;
};

/** Colour of each lattice or ring size in the plots, smallest to largest (a sequential ramp). */
export const sizeColour = (k: number) => `var(--im-s${k})`;
