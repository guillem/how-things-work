/**
 * Drawing helpers shared by the carbon-polymers scenes: the element colours of the
 * chemical-bonds explainer (CPK-style: white hydrogen, grey carbon, blue nitrogen, red
 * oxygen, green halogens), plus bromine (dark red, as usual), and drawn atom sizes.
 */
import { ELEMENTS } from '../atoms-periodic-table/atom';
import { ATOM as BONDS_ATOM, type AtomLook } from '../chemical-bonds/look';

export type DrawEl = 'C' | 'H' | 'O' | 'N' | 'Cl' | 'F' | 'Br';

export const ATOM: Record<DrawEl, AtomLook> = {
	C: BONDS_ATOM.C,
	H: BONDS_ATOM.H,
	O: BONDS_ATOM.O,
	N: BONDS_ATOM.N,
	Cl: BONDS_ATOM.Cl,
	F: BONDS_ATOM.F,
	Br: { fill: '#a3352b', edge: '#6e1f18', ink: '#ffffff' }
};

/** Drawn radius (px) for a ball, growing with the element's covalent radius (pm), times `k`. */
const RADIUS = new Map(ELEMENTS.map((e) => [e.symbol, e.radius ?? 70]));
export const ballRadius = (el: DrawEl, k = 1) => k * (7 + 0.13 * (RADIUS.get(el) ?? 70));

/** Text of a temperature in °C from kelvin, whole degrees. */
export function celsius(k: number | null | undefined) {
	if (k == null) return null;
	const c = Math.round(k - 273.15);
	return `${c === 0 ? 0 : c} °C`.replace('-', '−');
}
