/** Drawing helpers shared by the Standard Model scenes. */
import type { Colour, Family, Force, Token } from '../particles';
import { isAnti } from '../particles';

/** Colour-charge colour of a quark (or the anticolour of an antiquark). */
export function chargeColour(c: Colour, anti = false): string {
	const name = { r: 'red', g: 'green', b: 'blue' }[c];
	return `var(--sm-${anti ? 'anti' : ''}${name})`;
}
export const colourName = (c: Colour, anti = false) =>
	`${anti ? 'anti' : ''}${{ r: 'red', g: 'green', b: 'blue' }[c]}`;

export const tokenColour = (t: Token, c: Colour) => chargeColour(c, isAnti(t));

export const familyColour = (f: Family) =>
	f === 'quark'
		? 'var(--sm-quark)'
		: f === 'lepton'
			? 'var(--sm-lepton)'
			: f === 'gauge'
				? 'var(--sm-boson)'
				: 'var(--sm-higgs)';

export const forceColour = (f: Force | 'gravity') => `var(--sm-${f})`;
export const FORCE_NAME: Record<Force | 'gravity', string> = {
	strong: 'strong',
	em: 'electromagnetic',
	weak: 'weak',
	gravity: 'gravity'
};

/** A wavy path from (x1, y1) to (x2, y2): `waves` full periods of amplitude `a`. */
export function wavy(x1: number, y1: number, x2: number, y2: number, waves: number, a = 7): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const n = Math.max(8, Math.round(waves * 16));
	let d = '';
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const s = Math.sin(u * waves * 2 * Math.PI) * a;
		d += `${i ? 'L' : 'M'}${(x1 + dx * u + nx * s).toFixed(1)} ${(y1 + dy * u + ny * s).toFixed(1)}`;
	}
	return d;
}

/** A coiled (gluon) path from (x1, y1) to (x2, y2). */
export function coil(x1: number, y1: number, x2: number, y2: number, loops: number, r = 7): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const n = Math.max(12, Math.round(loops * 18));
	let d = '';
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const ph = u * loops * 2 * Math.PI;
		const along = len * u - r * 0.8 * Math.sin(ph);
		const side = r * (1 - Math.cos(ph)) * 0.9 - r * 0.9;
		const x = x1 + ux * along - uy * side;
		const y = y1 + uy * along + ux * side;
		d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
	}
	return d;
}
