/** Geometry and words shared by the Hückel scenes. */
import type { Molecule, Solution } from '../huckel';

export interface Pt {
	x: number;
	y: number;
}

/**
 * Atom positions of a chain (a zigzag with 120° angles) or a ring (a regular polygon with atom 1
 * at the top), fitted into a box around (cx, cy). Returns the bond length too.
 */
export function layout(
	n: number,
	ring: boolean,
	cx: number,
	cy: number,
	maxW: number,
	maxH: number,
	maxL = 100
): { pts: Pt[]; L: number } {
	if (ring && n >= 3) {
		const s = 2 * Math.sin(Math.PI / n);
		const L = Math.min(maxL, (Math.min(maxW, maxH) / 2) * s);
		const R = L / s;
		const pts = Array.from({ length: n }, (_, j) => {
			const a = -Math.PI / 2 + (2 * Math.PI * j) / n;
			return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
		});
		return { pts, L };
	}
	const dx = Math.cos(Math.PI / 6);
	const L = Math.min(maxL, n > 1 ? maxW / (dx * (n - 1)) : maxL, maxH * 2);
	const w = (n - 1) * dx * L;
	const pts = Array.from({ length: n }, (_, i) => ({
		x: cx - w / 2 + i * dx * L,
		y: cy + (i % 2 === 0 ? L / 4 : -L / 4)
	}));
	return { pts, L };
}

/** "α + 1.618β", "α − 0.618β", "α". */
export function levelText(x: number, digits = 3): string {
	const v = Math.abs(x) < 5e-4 ? 0 : x;
	if (v === 0) return 'α';
	return `α ${v > 0 ? '+' : '−'} ${Math.abs(v).toFixed(digits)}β`;
}

/** "6α + 8.000β". */
export function energyText(electrons: number, x: number): string {
	const a = electrons === 0 ? '' : electrons === 1 ? 'α' : `${electrons}α`;
	const v = Math.abs(x) < 5e-4 ? 0 : x;
	if (!a) return v === 0 ? '0' : `${v.toFixed(3)}β`;
	return v === 0 ? a : `${a} ${v > 0 ? '+' : '−'} ${Math.abs(v).toFixed(3)}β`;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n: number) =>
	String(n)
		.split('')
		.map((d) => SUB[+d])
		.join('');
const SUP: Record<string, string> = { '1': '', '2': '²', '3': '³' };

/** The all-carbon formula: CₙHₘ with its charge (one H per carbon, two at a chain's ends). */
export function formula(mol: Molecule): string {
	const h = mol.ring && mol.n >= 3 ? mol.n : mol.n + 2;
	const q = mol.n - mol.electrons;
	const charge = q === 0 ? '' : `${SUP[String(Math.abs(q))] ?? Math.abs(q)}${q > 0 ? '⁺' : '⁻'}`;
	return `C${sub(mol.n)}H${sub(h)}${charge}`;
}

/** What the shell looks like, in words. */
export function shellText(s: Solution): { text: string; good: boolean } {
	if (s.mol.electrons === 0) return { text: 'no π electrons', good: false };
	if (s.closedShell) return { text: 'closed shell: every electron paired', good: true };
	if (
		s.unpaired === 2 &&
		s.orbitals.filter((o) => o.occ === 1).every((o, _, a) => o.level === a[0].level)
	)
		return { text: 'two electrons alone in a degenerate pair', good: false };
	if (s.unpaired === 1) return { text: 'one unpaired electron: a radical', good: false };
	return { text: `${s.unpaired} unpaired electrons`, good: false };
}

/** Name of a colour of light. */
export function colourName(nm: number): string {
	if (nm < 380) return 'ultraviolet';
	if (nm < 450) return 'violet';
	if (nm < 495) return 'blue';
	if (nm < 570) return 'green';
	if (nm < 590) return 'yellow';
	if (nm < 620) return 'orange';
	if (nm < 750) return 'red';
	return 'near infrared';
}

export const onKey = (e: KeyboardEvent, act: () => void) => {
	if (e.key !== 'Enter' && e.key !== ' ') return;
	e.preventDefault();
	act();
};
