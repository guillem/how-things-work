/**
 * Geometry of the flat "bond picture" of a crystal shared by the crystal and doping
 * scenes: atoms on a square grid (the usual 2D sketch of silicon's four bonds per atom),
 * bonds between neighbours with two shared electrons each, free electrons that wander,
 * and holes that hop from bond to bond. Everything is a pure function of time and a seed.
 */
import { hash, type Point } from '#lib/draw/index.ts';

export interface Atom {
	i: number;
	r: number;
	c: number;
	x: number;
	y: number;
}

export interface Bond {
	i: number;
	a: number;
	b: number;
	x: number;
	y: number;
	horizontal: boolean;
}

export interface Lattice {
	cols: number;
	rows: number;
	gap: number;
	atoms: Atom[];
	bonds: Bond[];
	/** Bonds that share an atom with each bond. */
	neighbours: number[][];
	box: { x0: number; y0: number; x1: number; y1: number };
}

export function makeLattice(cols: number, rows: number, x0: number, y0: number, gap: number) {
	const atoms: Atom[] = [];
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++)
			atoms.push({ i: r * cols + c, r, c, x: x0 + c * gap, y: y0 + r * gap });
	const bonds: Bond[] = [];
	for (const a of atoms) {
		if (a.c < cols - 1) {
			const b = atoms[a.i + 1];
			bonds.push({ i: bonds.length, a: a.i, b: b.i, x: (a.x + b.x) / 2, y: a.y, horizontal: true });
		}
		if (a.r < rows - 1) {
			const b = atoms[a.i + cols];
			bonds.push({
				i: bonds.length,
				a: a.i,
				b: b.i,
				x: a.x,
				y: (a.y + b.y) / 2,
				horizontal: false
			});
		}
	}
	const neighbours = bonds.map((b) =>
		bonds
			.filter((o) => o.i !== b.i && (o.a === b.a || o.a === b.b || o.b === b.a || o.b === b.b))
			.map((o) => o.i)
	);
	const half = gap / 2;
	return {
		cols,
		rows,
		gap,
		atoms,
		bonds,
		neighbours,
		box: {
			x0: x0 - half,
			y0: y0 - half,
			x1: x0 + (cols - 1) * gap + half,
			y1: y0 + (rows - 1) * gap + half
		}
	} satisfies Lattice;
}

/** Bonds that touch an atom. */
export const bondsOf = (L: Lattice, atom: number) =>
	L.bonds.filter((b) => b.a === atom || b.b === atom).map((b) => b.i);

/** Two parallel strokes per bond (a shared pair is a double line in the 2D sketch), as one path. */
export function bondPath(L: Lattice, atomR: number, skip: Set<number> = new Set()) {
	let d = '';
	for (const b of L.bonds) {
		if (skip.has(b.i)) continue;
		const A = L.atoms[b.a];
		const B = L.atoms[b.b];
		if (b.horizontal) {
			for (const o of [-3, 3]) d += `M${A.x + atomR} ${A.y + o}H${B.x - atomR}`;
		} else {
			for (const o of [-3, 3]) d += `M${A.x + o} ${A.y + atomR}V${B.y - atomR}`;
		}
	}
	return d;
}

/** Where a bond's two electrons sit (k = 0 or 1). */
export function bondDot(L: Lattice, bond: number, k: 0 | 1): Point {
	const b = L.bonds[bond];
	const off = k === 0 ? -7 : 7;
	return b.horizontal ? { x: b.x + off, y: b.y } : { x: b.x, y: b.y + off };
}

const circle = (p: Point, r: number) =>
	`M${(p.x - r).toFixed(1)} ${p.y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** All bond electrons as one path, leaving out `missing` (keys "bond:k"). */
export function dotsPath(L: Lattice, r: number, missing: Set<string> = new Set()) {
	let d = '';
	for (const b of L.bonds)
		for (const k of [0, 1] as const)
			if (!missing.has(`${b.i}:${k}`)) d += circle(bondDot(L, b.i, k), r);
	return d;
}

const wrap = (v: number, lo: number, hi: number) =>
	lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));

/**
 * A free electron wandering through the crystal from `start`, `s` seconds after it was
 * freed: thermal wandering (a sum of slow sines with seeded phases) plus a drift of
 * `drift` px/s to the right, wrapping round the box (a carrier that leaves through one
 * side is replaced at the other, as in a circuit). `opacity` fades it near the wrap edges.
 */
export function wander(L: Lattice, start: Point, s: number, seed: number, drift: number) {
	const ph = (k: number) => hash(seed, k) * 6.283;
	const nx = (u: number) => 26 * Math.sin(0.9 * u + ph(1)) + 14 * Math.sin(2.1 * u + ph(2));
	const ny = (u: number) => 22 * Math.sin(0.7 * u + ph(3)) + 12 * Math.sin(1.9 * u + ph(4));
	const { x0, x1, y0, y1 } = L.box;
	const x = wrap(start.x + drift * s + nx(s) - nx(0), x0, x1);
	const y = wrap(start.y + ny(s) - ny(0), y0, y1);
	const edge = Math.min(x - x0, x1 - x);
	return { x, y, opacity: Math.min(1, edge / 14) };
}

/**
 * The bonds a hole visits: `hops` hops from `start`, each to a neighbouring bond picked
 * by the seed. With `dir` = −1 (or +1) it prefers bonds further left (right), as when a
 * voltage pulls electrons the other way; at the box edge it re-enters at the other side.
 */
export function holeWalk(L: Lattice, start: number, seed: number, hops: number, dir: number) {
	const path = [start];
	let cur = start;
	for (let h = 0; h < hops; h++) {
		const ns = L.neighbours[cur];
		let options = ns;
		if (dir !== 0 && hash(seed * 31 + h, 7) < 0.8) {
			const ahead = ns.filter((n) => (L.bonds[n].x - L.bonds[cur].x) * dir > 1);
			if (ahead.length) options = ahead;
			else {
				// At the edge: re-enter on the far side, in the same row.
				const far = L.bonds.filter(
					(b) => Math.abs(b.y - L.bonds[cur].y) < 1 && b.horizontal === L.bonds[cur].horizontal
				);
				const pick = dir < 0 ? far[far.length - 1] : far[0];
				if (pick && pick.i !== cur) options = [pick.i];
			}
		}
		cur = options[Math.floor(hash(seed * 17 + h, 3) * options.length) % options.length];
		path.push(cur);
	}
	return path;
}

/**
 * Where a hole is `s` seconds after it appeared on bond `start`: it sits on `cur`, and
 * during the last part of each `period` the electron of the next bond (`next`) hops
 * into it (`p` from 0 to 1), which moves the hole to `next`.
 */
export function holeAt(
	L: Lattice,
	start: number,
	seed: number,
	s: number,
	period: number,
	dir: number
) {
	const hops = Math.max(0, Math.floor(s / period));
	const path = holeWalk(L, start, seed, hops + 1, dir);
	const f = Math.max(0, s / period - hops);
	const u = Math.min(1, Math.max(0, (f - 0.6) / 0.4));
	return { cur: path[hops], next: path[hops + 1], p: u * u * (3 - 2 * u) };
}

/** The bond electrons missing around a hole: its own bond's first electron, and the next bond's while it hops in. */
export function missingDots(cur: number, next: number | null): Set<string> {
	return new Set(next === null ? [`${cur}:0`] : [`${cur}:0`, `${next}:0`]);
}
