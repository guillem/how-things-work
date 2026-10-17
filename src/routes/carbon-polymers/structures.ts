/**
 * Flat (2D) drawings of molecules: the builder's chains and rings laid out as chemists draw
 * them, and a few hand-drawn molecules (isomer partners, a drug, a sugar, an amino acid).
 *
 * A `Structure` lists the heavy atoms with drawing coordinates (one unit = one C–C bond) and
 * their bonds; hydrogens on carbon are implicit and filled in by valence (`withHydrogens`),
 * so the formula of every drawing is counted, never typed in. Hydrogens are drawn at the
 * measured C–H / O–H / N–H length relative to C–C (CCCBDB values in `geometry.ts`), the
 * skeleton with equal bonds: a flat drawing of a 3D molecule.
 */
import {
	VALENCE,
	formulaOf,
	graph,
	isBondFeature,
	massOf,
	type Build,
	type El
} from './molecule.ts';

export interface SAtom {
	el: El;
	x: number;
	y: number;
	/** Skeleton carbon number (builder layouts). */
	carbon?: number;
	/** Part of the functional group. */
	group?: boolean;
}
export interface SBond {
	a: number;
	b: number;
	order: number;
}
export interface Structure {
	atoms: SAtom[];
	bonds: SBond[];
	/** Draw an aromatic ring as a circle inside these atoms. */
	aromatic?: number[];
}

/** Drawn length of a bond to hydrogen, relative to C–C: ≈ 1.09 Å / 1.53 Å. */
const H_LENGTH = 0.72;

const used = (s: Structure, i: number) =>
	s.bonds.filter((b) => b.a === i || b.b === i).reduce((t, b) => t + b.order, 0);

const angleOf = (dx: number, dy: number) => Math.atan2(dy, dx);
const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/** Directions (radians) for `k` new bonds round an atom whose bonds point along `taken`. */
export function freeDirections(taken: number[], k: number): number[] {
	if (k <= 0) return [];
	if (!taken.length) return Array.from({ length: k }, (_, i) => (i * TAU) / k);
	const sorted = [...taken].map(wrap).sort((a, b) => a - b);
	// Largest gap between neighbours, filled evenly.
	let best = 0;
	let width = -1;
	for (let i = 0; i < sorted.length; i++) {
		const a = sorted[i];
		const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU;
		if (b - a > width) {
			width = b - a;
			best = a;
		}
	}
	return Array.from({ length: k }, (_, i) => best + ((i + 1) * width) / (k + 1));
}

/** The structure with every hydrogen drawn, carbon's and the groups'. */
export function withHydrogens(s: Structure): Structure {
	const atoms = s.atoms.map((a) => ({ ...a }));
	const bonds = s.bonds.map((b) => ({ ...b }));
	const n = s.atoms.length;
	for (let i = 0; i < n; i++) {
		const a = atoms[i];
		if (a.el === 'H') continue;
		const free = VALENCE[a.el] - used(s, i);
		if (free <= 0) continue;
		const dirs = bonds
			.filter((b) => b.a === i || b.b === i)
			.map((b) => {
				const o = atoms[b.a === i ? b.b : b.a];
				return angleOf(o.x - a.x, o.y - a.y);
			});
		// Inside an aromatic ring the hydrogen points straight out.
		for (const th of freeDirections(dirs, free)) {
			atoms.push({
				el: 'H',
				x: a.x + H_LENGTH * Math.cos(th),
				y: a.y + H_LENGTH * Math.sin(th),
				carbon: a.carbon,
				group: a.el !== 'C' ? a.group : undefined
			});
			bonds.push({ a: i, b: atoms.length - 1, order: 1 });
		}
	}
	return { atoms, bonds, aromatic: s.aromatic };
}

function countsOf(s: Structure) {
	const full = withHydrogens(s);
	const c: Record<El, number> = { C: 0, H: 0, O: 0, N: 0, Cl: 0 };
	for (const a of full.atoms) c[a.el]++;
	return c;
}
export const structureFormula = (s: Structure, plain = false) => formulaOf(countsOf(s), plain);
export const structureMass = (s: Structure) => massOf(countsOf(s));

// ------------------------------------------------------------------ builder layouts

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * The builder's molecule laid out flat, heavy atoms only (y down, as on screen): a zigzag
 * chain (120° turns, straight through the two carbons of a triple bond, which is linear) or
 * a regular ring with carbon 1 at the top, and the group pointing away from its carbon.
 */
export function layout(b: Build): Structure {
	const g = graph(b);
	const atoms: SAtom[] = [];
	const n = b.n;
	const sp = (i: number) => b.feature === 'triple' && (i === b.at || i === b.at + 1);
	if (b.ring) {
		const r = 1 / (2 * Math.sin(Math.PI / n));
		for (let i = 1; i <= n; i++) {
			const th = deg(-90) + ((i - 1) * TAU) / n;
			atoms.push({ el: 'C', x: r * Math.cos(th), y: r * Math.sin(th), carbon: i });
		}
	} else {
		let x = 0;
		let y = 0;
		let dir = deg(-30);
		let sign = 1;
		atoms.push({ el: 'C', x, y, carbon: 1 });
		for (let i = 2; i <= n; i++) {
			x += Math.cos(dir);
			y += Math.sin(dir);
			atoms.push({ el: 'C', x, y, carbon: i });
			if (!sp(i)) {
				dir += sign * deg(60);
				sign = -sign;
			}
		}
		// Centre the chain on the origin.
		const cx = (Math.min(...atoms.map((a) => a.x)) + Math.max(...atoms.map((a) => a.x))) / 2;
		const cy = (Math.min(...atoms.map((a) => a.y)) + Math.max(...atoms.map((a) => a.y))) / 2;
		for (const a of atoms) {
			a.x -= cx;
			a.y -= cy;
		}
	}
	if (isBondFeature(b.feature)) {
		atoms[b.at - 1].group = true;
		atoms[b.at % n].group = true;
	}
	const bonds: SBond[] = g.bonds
		.filter((bd) => bd.a < n && bd.b < n)
		.map((bd) => ({ a: bd.a, b: bd.b, order: bd.order }));
	// The group, pointing away from its carbon's neighbours.
	if (b.feature && !isBondFeature(b.feature)) {
		const c = b.at - 1;
		const here = atoms[c];
		const nb = bonds
			.filter((bd) => bd.a === c || bd.b === c)
			.map((bd) => atoms[bd.a === c ? bd.b : bd.a]);
		// The two directions at 120° from the neighbours (end of a chain), or straight out.
		let out: number;
		let other: number;
		if (nb.length === 0) {
			out = deg(30);
			other = deg(-30);
		} else if (nb.length === 1) {
			// End of a chain: carry on the zigzag (down after an upper atom, up after a lower).
			const back = angleOf(nb[0].x - here.x, nb[0].y - here.y);
			const p = back + deg(120);
			const q = back - deg(120);
			const goDown = here.y < nb[0].y;
			[out, other] = Math.sin(p) > Math.sin(q) === goDown ? [p, q] : [q, p];
		} else {
			const sx = nb.reduce((t, a) => t + (a.x - here.x), 0);
			const sy = nb.reduce((t, a) => t + (a.y - here.y), 0);
			out = Math.hypot(sx, sy) < 1e-6 ? deg(-90) : angleOf(-sx, -sy);
			other = out;
		}
		const put = (el: El, th: number, order = 1, len = 1) => {
			atoms.push({
				el,
				x: here.x + len * Math.cos(th),
				y: here.y + len * Math.sin(th),
				group: true
			});
			bonds.push({ a: c, b: atoms.length - 1, order });
		};
		// Lengths relative to C–C (1.53 Å), from CCCBDB: C=O 1.205 Å (formaldehyde), C–O 1.343 Å
		// (formic acid) and 1.427 Å (methanol), C–N 1.471 Å, C–Cl 1.785 Å.
		if (b.feature === 'CO') put('O', out, 2, 0.79);
		else if (b.feature === 'COOH') {
			put('O', other, 2, 0.79);
			put('O', out, 1, 0.88);
		} else if (b.feature === 'OH') put('O', out, 1, 0.93);
		else if (b.feature === 'NH2') put('N', out, 1, 0.96);
		else if (b.feature === 'Cl') put('Cl', out, 1, 1.17);
	}
	return { atoms, bonds, aromatic: b.aromatic ? atoms.slice(0, 6).map((_, i) => i) : undefined };
}

// ------------------------------------------------------------------ hand-drawn molecules

const Y = Math.sqrt(3) / 2; // 0.866: zigzag step
type Spec = [El, number, number][];
const make = (atoms: Spec, bonds: [number, number, number?][], aromatic?: number[]): Structure => ({
	atoms: atoms.map(([el, x, y]) => ({ el, x, y })),
	bonds: bonds.map(([a, b, order]) => ({ a, b, order: order ?? 1 })),
	aromatic
});

export const DRAWN: Record<string, Structure> = {
	ethanol: make(
		[
			['C', -Y, 0.25],
			['C', 0, -0.25],
			['O', Y, 0.25]
		],
		[
			[0, 1],
			[1, 2]
		]
	),
	'dimethyl ether': make(
		[
			['C', -Y, 0.25],
			['O', 0, -0.25],
			['C', Y, 0.25]
		],
		[
			[0, 1],
			[1, 2]
		]
	),
	butane: make(
		[
			['C', -1.5 * Y, 0.25],
			['C', -0.5 * Y, -0.25],
			['C', 0.5 * Y, 0.25],
			['C', 1.5 * Y, -0.25]
		],
		[
			[0, 1],
			[1, 2],
			[2, 3]
		]
	),
	isobutane: make(
		[
			['C', 0, 0],
			['C', 0, -1],
			['C', -Y, 0.5],
			['C', Y, 0.5]
		],
		[
			[0, 1],
			[0, 2],
			[0, 3]
		]
	),
	// Ibuprofen: a benzene ring with an isobutyl group and a propanoic acid at opposite corners.
	ibuprofen: make(
		[
			['C', 1, 0],
			['C', 0.5, -Y],
			['C', -0.5, -Y],
			['C', -1, 0],
			['C', -0.5, Y],
			['C', 0.5, Y],
			['C', 1 + Y, 0.5], // 6: CH(CH₃)
			['C', 1 + Y, 1.5], // 7: its CH₃
			['C', 1 + 2 * Y, 0], // 8: COOH carbon
			['O', 1 + 2 * Y, -1], // 9: =O
			['O', 1 + 3 * Y, 0.5], // 10: –OH
			['C', -1 - Y, 0.5], // 11: CH₂
			['C', -1 - 2 * Y, 0], // 12: CH
			['C', -1 - 2 * Y, -1], // 13: CH₃
			['C', -1 - 3 * Y, 0.5] // 14: CH₃
		],
		[
			[0, 1, 2],
			[1, 2],
			[2, 3, 2],
			[3, 4],
			[4, 5, 2],
			[5, 0],
			[0, 6],
			[6, 7],
			[6, 8],
			[8, 9, 2],
			[8, 10],
			[3, 11],
			[11, 12],
			[12, 13],
			[12, 14]
		]
	),
	// Glucose as a ring (pyranose), drawn flat: which side each –OH sits on is not shown.
	glucose: make(
		[
			['O', Y, -0.5], // 0: ring O
			['C', Y, 0.5], // 1: C1
			['C', 0, 1], // 2: C2
			['C', -Y, 0.5], // 3: C3
			['C', -Y, -0.5], // 4: C4
			['C', 0, -1], // 5: C5
			['O', 2 * Y, 1], // 6: OH on C1
			['O', 0, 2], // 7: OH on C2
			['O', -2 * Y, 1], // 8: OH on C3
			['O', -2 * Y, -1], // 9: OH on C4
			['C', 0, -2], // 10: C6
			['O', Y, -2.5] // 11: OH on C6
		],
		[
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 0],
			[1, 6],
			[2, 7],
			[3, 8],
			[4, 9],
			[5, 10],
			[10, 11]
		]
	),
	alanine: make(
		[
			['C', -Y, -0.5], // CH₃
			['C', 0, 0], // the chiral carbon
			['N', 0, 1], // NH₂
			['C', Y, -0.5], // COOH carbon
			['O', Y, -1.5], // =O
			['O', 2 * Y, 0] // –OH
		],
		[
			[0, 1],
			[1, 2],
			[1, 3],
			[3, 4, 2],
			[3, 5]
		]
	),
	// A stretch of a polyethylene chain: eight CH₂ units of a very long zigzag.
	polyethylene: make(
		Array.from(
			{ length: 8 },
			(_, i) => ['C', (i - 3.5) * Y, i % 2 ? -0.25 : 0.25] as [El, number, number]
		),
		Array.from({ length: 7 }, (_, i) => [i, i + 1] as [number, number])
	),
	octane: make(
		Array.from(
			{ length: 8 },
			(_, i) => ['C', (i - 3.5) * Y, i % 2 ? -0.25 : 0.25] as [El, number, number]
		),
		Array.from({ length: 7 }, (_, i) => [i, i + 1] as [number, number])
	)
};
