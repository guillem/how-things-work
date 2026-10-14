#!/usr/bin/env node
/**
 * Builds `src/routes/immune-system/shapes.ts`: the outlines of an antibody and
 * of the flu virus's spike, traced from their measured 3D structures, for the
 * "two weapons" scene of the immune-system explainer.
 *
 *   node scripts/data/immune-system/build-shapes.mjs <download-dir>
 *
 * <download-dir>/pdb holds (not committed):
 *   1IGT.cif.gz             https://files.rcsb.org/download/1IGT.cif.gz
 *   1RU7-assembly1.cif.gz   https://files.rcsb.org/download/1RU7-assembly1.cif.gz
 *
 * Method: the same as `scripts/data/the-cell/build-shapes.mjs` (the raster,
 * contour and simplification helpers below are copied from it). Hydrogens and
 * waters dropped; every heavy atom a disc of radius 0.25 nm on a 0.2 nm grid;
 * the outline of each group of chains traced with marching squares and
 * simplified to within 0.12 nm. The result is the shape a space-filling model
 * casts, in nanometres, at true size. Instead of principal axes, each
 * structure is turned the way it sits in the drawing:
 *   - the antibody with its stem (Fc) down and its two arms (Fab) spread
 *     across the page, seen face on;
 *   - the haemagglutinin trimer standing on the viral membrane: its long axis
 *     vertical, the HA1 heads up, the HA2 stalk down.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCif } from '../the-cell/structure-io.mjs';

const RAW = process.argv[2];
if (!RAW) {
	console.error('usage: build-shapes.mjs <download-dir>');
	process.exit(1);
}
const OUT = resolve(import.meta.dirname, '../../../src/routes/immune-system/shapes.ts');

const SPECS = [
	{
		id: 'antibody',
		name: 'Antibody (IgG2a, mouse)',
		source: 'PDB 1IGT (Harris et al., Biochemistry 1997)',
		file: 'pdb/1IGT.cif.gz',
		// light chains A, C; heavy chains B, D; E, F are the sugars on the stem
		groups: [
			{ name: 'heavy', chains: 'BDEF' },
			{ name: 'light', chains: 'AC' }
		],
		// down: from the middle of the two arms to the stem
		frame: (atoms) => {
			const heavyC = atoms.filter((a) => 'BD'.includes(a.chain));
			// the stem is the half of the heavy chains farthest from the light chains
			const light = atoms.filter((a) => 'AC'.includes(a.chain));
			const lc = centroid(light);
			const far = heavyC
				.map((a) => ({ a, d: dist(a, lc) }))
				.sort((p, q) => q.d - p.d)
				.slice(0, Math.floor(heavyC.length / 3))
				.map((p) => p.a);
			const down = sub(centroid(far), lc);
			const across = sub(
				centroid(light.filter((a) => a.chain === 'A')),
				centroid(light.filter((a) => a.chain === 'C'))
			);
			return { down, across };
		}
	},
	{
		id: 'haemagglutinin',
		name: 'Haemagglutinin, the flu virus spike (H1, 1934 human virus)',
		source: 'PDB 1RU7 (Gamblin et al., Science 2004), biological assembly 1',
		file: 'pdb/1RU7-assembly1.cif.gz',
		// HA1 (the head, which binds the cell) A, C, E; HA2 (the stalk) B, D, F
		groups: [
			{ name: 'stalk', chains: 'BDF' },
			{ name: 'head', chains: 'ACE' }
		],
		frame: (atoms) => {
			const head = centroid(atoms.filter((a) => 'ACE'.includes(a.chain)));
			const stalk = centroid(atoms.filter((a) => 'BDF'.includes(a.chain)));
			const down = sub(stalk, head);
			// any direction across; the trimer looks much the same from all sides
			const across = cross(down, [0, 0, 1]);
			return { down, across };
		}
	}
];

// ---- vectors -----------------------------------------------------------------------

const centroid = (l) => ['x', 'y', 'z'].map((k) => l.reduce((s, a) => s + a[k], 0) / l.length);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dist = (a, c) => Math.hypot(a.x - c[0], a.y - c[1], a.z - c[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => a.map((v) => v / Math.hypot(...a));
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];

/** Projects atoms (Å) to page nm: y along `down`, x along `across` made perpendicular to it. */
function project(atoms, { down, across }) {
	const c = centroid(atoms);
	const ey = norm(down);
	const ex = norm(
		sub(
			across,
			ey.map((v) => v * dot(across, ey))
		)
	);
	const ez = cross(ex, ey);
	return atoms.map((a) => {
		const r = [a.x - c[0], a.y - c[1], a.z - c[2]];
		return { ...a, px: dot(r, ex) / 10, py: dot(r, ey) / 10, pd: dot(r, ez) / 10 };
	});
}

// ---- outlines (copied from scripts/data/the-cell/build-shapes.mjs) -----------------------

const GRID = 0.2; // nm
const R_ATOM = 0.25; // nm
const SIMPLIFY = 0.12; // nm

function rasterize(points, box) {
	const w = Math.ceil((box.x1 - box.x0) / GRID) + 3;
	const h = Math.ceil((box.y1 - box.y0) / GRID) + 3;
	const g = new Uint8Array(w * h);
	const r = R_ATOM / GRID;
	for (const p of points) {
		const gx = (p.px - box.x0) / GRID + 1;
		const gy = (p.py - box.y0) / GRID + 1;
		for (let j = Math.floor(gy - r); j <= Math.ceil(gy + r); j++)
			for (let i = Math.floor(gx - r); i <= Math.ceil(gx + r); i++)
				if ((i - gx) ** 2 + (j - gy) ** 2 <= r * r && i >= 0 && j >= 0 && i < w && j < h)
					g[j * w + i] = 1;
	}
	return { g, w, h };
}

/** Closed outlines of the filled cells (marching squares on cell corners). */
function contours({ g, w, h }) {
	const at = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? g[j * w + i] : 0);
	const out = new Map();
	const key = (x, y) => `${x},${y}`;
	const add = (x0, y0, x1, y1) => {
		const k = key(x0, y0);
		if (!out.has(k)) out.set(k, []);
		out.get(k).push([x1, y1]);
	};
	for (let j = -1; j <= h; j++)
		for (let i = -1; i <= w; i++) {
			if (!at(i, j)) continue;
			if (!at(i, j - 1)) add(i + 1, j, i, j);
			if (!at(i + 1, j)) add(i + 1, j + 1, i + 1, j);
			if (!at(i, j + 1)) add(i, j + 1, i + 1, j + 1);
			if (!at(i - 1, j)) add(i, j, i, j + 1);
		}
	const loops = [];
	for (const [start, list] of out) {
		while (list.length) {
			let [x, y] = start.split(',').map(Number);
			let [nx, ny] = list.pop();
			const loop = [[x, y]];
			for (let guard = 0; guard < 1e6; guard++) {
				const dx = nx - x;
				const dy = ny - y;
				x = nx;
				y = ny;
				const k = key(x, y);
				if (k === start) break;
				loop.push([x, y]);
				const opts = out.get(k);
				if (!opts?.length) break;
				let pick =
					opts.length > 1 ? opts.findIndex(([ax, ay]) => (ax - x) * dy - (ay - y) * dx < 0) : 0;
				if (pick < 0) pick = 0;
				[nx, ny] = opts.splice(pick, 1)[0];
			}
			if (loop.length > 3) loops.push(loop);
		}
	}
	return loops;
}

function area(loop) {
	let s = 0;
	for (let i = 0; i < loop.length; i++) {
		const [x0, y0] = loop[i];
		const [x1, y1] = loop[(i + 1) % loop.length];
		s += x0 * y1 - x1 * y0;
	}
	return s / 2;
}

function simplify(pts, tol) {
	if (pts.length < 3) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a];
		const [bx, by] = pts[b];
		const L = Math.hypot(bx - ax, by - ay) || 1e-9;
		let best = -1;
		let bi = -1;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
			if (d > best) {
				best = d;
				bi = i;
			}
		}
		if (best > tol) {
			keep[bi] = 1;
			stack.push([a, bi], [bi, b]);
		}
	}
	return pts.filter((_, i) => keep[i]);
}

function simplifyClosed(pts, tol) {
	let k = 0;
	let far = -1;
	pts.forEach(([x, y], i) => {
		const d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2;
		if (d > far) {
			far = d;
			k = i;
		}
	});
	const a = simplify(pts.slice(0, k + 1), tol);
	const b = simplify([...pts.slice(k), pts[0]], tol);
	return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function chaikin(pts) {
	const out = [];
	for (let i = 0; i < pts.length; i++) {
		const [x0, y0] = pts[i];
		const [x1, y1] = pts[(i + 1) % pts.length];
		out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
		out.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
	}
	return out;
}

const fmt = (v) => (Math.round(v * 10) / 10).toString().replace(/^-0$/, '0');

function outline(points, box) {
	const ras = rasterize(points, box);
	const loops = contours(ras)
		.map((l) => l.map(([x, y]) => [(x - 1) * GRID + box.x0, (y - 1) * GRID + box.y0]))
		.filter((l) => Math.abs(area(l)) > 0.6);
	let d = '';
	for (const l of loops) {
		const s = simplifyClosed(chaikin(simplifyClosed(l, SIMPLIFY / 2)), SIMPLIFY);
		if (s.length < 3) continue;
		d += 'M' + s.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + 'Z';
	}
	return d;
}

// ---- main -------------------------------------------------------------------------

const min = (xs) => xs.reduce((m, v) => (v < m ? v : m), Infinity);
const max = (xs) => xs.reduce((m, v) => (v > m ? v : m), -Infinity);

const shapes = {};
for (const spec of SPECS) {
	const all = readCif(join(RAW, spec.file)).atoms.filter(
		(a) => a.el !== 'H' && a.el !== 'D' && a.res !== 'HOH' && Number.isFinite(a.x)
	);
	const atoms = project(all, spec.frame(all));
	const box = {
		x0: min(atoms.map((a) => a.px)) - 0.5,
		x1: max(atoms.map((a) => a.px)) + 0.5,
		y0: min(atoms.map((a) => a.py)) - 0.5,
		y1: max(atoms.map((a) => a.py)) + 0.5
	};
	const groups = spec.groups.map((g) => ({
		name: g.name,
		d: outline(
			atoms.filter((a) => g.chains.includes(a.chain)),
			box
		)
	}));
	const xs = atoms.map((a) => a.px);
	const ys = atoms.map((a) => a.py);
	shapes[spec.id] = {
		name: spec.name,
		source: spec.source,
		atoms: atoms.length,
		width: +(max(xs) - min(xs) + 2 * R_ATOM).toFixed(1),
		height: +(max(ys) - min(ys) + 2 * R_ATOM).toFixed(1),
		top: +(min(ys) - R_ATOM).toFixed(1),
		bottom: +(max(ys) + R_ATOM).toFixed(1),
		groups
	};
	console.log(spec.id, atoms.length, shapes[spec.id].width, shapes[spec.id].height);
}

const header = `/**
 * GENERATED by scripts/data/immune-system/build-shapes.mjs — do not edit by hand.
 *
 * Outlines of an antibody and of the flu virus's spike protein, traced from
 * their measured 3D structures in the RCSB Protein Data Bank
 * (https://www.rcsb.org, data under CC0 1.0), in nanometres at true size,
 * centred on each structure, y pointing down the page.
 *
 * How the outlines were made: hydrogens and waters dropped; each heavy atom a
 * disc of radius 0.25 nm on a 0.2 nm grid; the outline of each group of
 * chains traced and simplified to within 0.12 nm (the method of the-cell's
 * shapes). The antibody is seen face on, stem down; the spike stands upright,
 * heads up.
 */

export interface Shape {
	name: string;
	source: string;
	/** Heavy atoms traced. */
	atoms: number;
	/** Extent of the outline, nm. */
	width: number;
	height: number;
	top: number;
	bottom: number;
	/** Outlines (SVG path data in nm), back to front. */
	groups: { name: string; d: string }[];
}

`;
const body = `export const SHAPES = ${JSON.stringify(shapes, null, '\t')} satisfies Record<string, Shape>;\n`;
writeFileSync(OUT, header + body);
console.log('wrote', OUT);
