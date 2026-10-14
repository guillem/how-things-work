#!/usr/bin/env node
/**
 * Builds `src/routes/the-cell/shapes.ts`: the outlines of real molecular
 * machines and the atoms of a few small molecules, traced from their measured
 * 3D structures, for the molecule-scale views of "The cell".
 *
 *   node scripts/data/the-cell/build-shapes.mjs <download-dir>
 *
 * <download-dir> holds the downloaded structure files (not committed):
 *   opm/<id>.pdb      membrane proteins, pre-oriented by the OPM database
 *                     (https://opm-assets.storage.googleapis.com/pdb/<id>.pdb),
 *                     membrane normal along z, membrane centre at z = 0
 *   pdb/<ID>.cif.gz   other structures from the RCSB PDB
 *                     (https://files.rcsb.org/download/<ID>.cif.gz, or
 *                     <ID>-assembly1.cif.gz for the biological assembly)
 *   lig/<ID>.sdf      small molecules, RCSB ideal coordinates
 *                     (https://files.rcsb.org/ligands/download/<ID>_ideal.sdf)
 *
 * Method. Hydrogens, waters and OPM's dummy membrane atoms are dropped. A
 * soluble structure is turned so that its longest axis lies across the page and
 * its shortest points at the viewer (principal axes); a membrane protein keeps
 * OPM's orientation (membrane plane horizontal, the cytoplasmic/matrix/stromal
 * side down, y = −z) and is only turned about the membrane normal so that its
 * widest profile faces the viewer. Every heavy atom is then drawn as a disc of
 * radius 0.25 nm (about its van der Waals radius plus a little, so that the
 * projection is solid) on a 0.2 nm grid, and the outline of each group of
 * chains is traced with marching squares and simplified to within 0.12 nm.
 * The result is the shape a space-filling model casts, in nanometres, at its
 * true size. Small molecules keep every atom (with hydrogens).
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCif, readPdb, readSdf } from './structure-io.mjs';

const RAW = process.argv[2];
if (!RAW) {
	console.error('usage: build-shapes.mjs <download-dir>');
	process.exit(1);
}
const OUT = resolve(import.meta.dirname, '../../../src/routes/the-cell/shapes.ts');

const RNA = new Set(['A', 'C', 'G', 'U', 'PSU', '5MC', 'OMG', 'OMC', 'OMU', '2MG', '7MG', 'M2G']);
const DNA = new Set(['DA', 'DC', 'DG', 'DT']);
const SKIP = new Set([
	'HOH',
	'DUM',
	'SO4',
	'GOL',
	'EDO',
	'PEG',
	'CL',
	'NA',
	'K',
	'MG',
	'ZN',
	'ACT'
]);

/**
 * The machines. `groups`: ordered; an atom joins the first group whose test
 * matches (`chains` by author chain id, `rna`/`dna` by residue name, or `rest`).
 */
const MACHINES = [
	{
		id: 'atpSynthase',
		name: 'ATP synthase (cow heart mitochondria)',
		source: 'PDB 6ZPO (Spikes et al. 2020), oriented by OPM',
		file: 'opm/6zpo.pdb',
		membrane: true,
		groups: [
			{ name: 'head', chains: 'ABCDEFGHIJ' },
			{ name: 'ring', chains: 'KLMNOPQR' },
			{ name: 'stalk', chains: 'Sbdh' },
			{ name: 'base', rest: true }
		]
	},
	{
		id: 'ribosome80S',
		name: 'Ribosome on the Sec61 channel (mammalian)',
		source: 'PDB 3J7R (Voorhees et al. 2014), oriented by OPM',
		file: 'pdb/3J7R.cif.gz',
		// OPM's PDB-format copy of this large entry has re-lettered chains, so the
		// deposited coordinates are used and OPM's orientation is transferred by
		// superposing the Sec61α channel (OPM chain l = PDB chain 1).
		orientFrom: { file: 'opm/3j7r.pdb', opmChain: 'l', chain: '1' },
		membrane: true,
		groups: [
			{ name: 'sec61', chains: ['1', '2', '3'] },
			{ name: 'rna', rna: true },
			{ name: 'protein', rest: true }
		]
	},
	{
		id: 'ribosome70S',
		name: 'Ribosome (E. coli)',
		source: 'PDB 7K00 (Watson et al. 2020)',
		file: 'pdb/7K00.cif.gz',
		groups: [
			{ name: 'rna', rna: true },
			{ name: 'protein', rest: true }
		]
	},
	{
		id: 'nucleosome',
		name: 'Nucleosome',
		source: 'PDB 1KX5 (Davey et al. 2002)',
		file: 'pdb/1KX5.cif.gz',
		// seen down its shortest axis (the DNA superhelix axis): the disc face on
		groups: [
			{ name: 'histones', chains: 'ABCDEFGH' },
			{ name: 'dna', rest: true }
		],
		order: 'given'
	},
	{
		id: 'kChannel',
		name: 'Potassium channel Kv1.2 (rat)',
		source: 'PDB 2R9R (Long et al. 2007), oriented by OPM',
		file: 'opm/2r9r.pdb',
		membrane: true,
		groups: [{ name: 'channel', rest: true }]
	},
	{
		id: 'naKPump',
		name: 'Sodium–potassium pump (pig kidney)',
		source: 'PDB 3WGU (Kanai et al. 2013), oriented by OPM',
		file: 'opm/3wgu.pdb',
		membrane: true,
		groups: [{ name: 'pump', rest: true }]
	},
	{
		id: 'glut1',
		name: 'Glucose transporter GLUT1 (human)',
		source: 'PDB 4PYP (Deng et al. 2014), oriented by OPM',
		file: 'opm/4pyp.pdb',
		membrane: true,
		groups: [{ name: 'transporter', rest: true }]
	},
	{
		id: 'psii',
		name: 'Photosystem II with its light-harvesting antennae (pea)',
		source: 'PDB 5XNM (Su et al. 2017), oriented by OPM',
		file: 'opm/5xnm.pdb',
		membrane: true,
		groups: [{ name: 'psii', rest: true }]
	},
	{
		id: 'b6f',
		name: 'Cytochrome b₆f (spinach)',
		source: 'PDB 6RQF (Malone et al. 2019), oriented by OPM',
		file: 'opm/6rqf.pdb',
		membrane: true,
		groups: [{ name: 'b6f', rest: true }]
	},
	{
		id: 'psi',
		name: 'Photosystem I with its antennae (pea)',
		source: 'PDB 5L8R (Mazor et al. 2017), oriented by OPM',
		file: 'opm/5l8r.pdb',
		membrane: true,
		groups: [{ name: 'psi', rest: true }]
	},
	{
		id: 'cfAtpSynthase',
		name: 'Chloroplast ATP synthase (spinach)',
		source: 'PDB 6FKF (Hahn et al. 2018), oriented by OPM',
		file: 'opm/6fkf.pdb',
		membrane: true,
		groups: [{ name: 'atp', rest: true }]
	},
	{
		id: 'rubisco',
		name: 'Rubisco (spinach)',
		source: 'PDB 8RUC (Andersson 1996), biological assembly',
		file: 'pdb/8RUC-assembly1.cif.gz',
		groups: [{ name: 'rubisco', rest: true }]
	},
	{
		id: 'groEL',
		name: 'GroEL–GroES chaperone (E. coli)',
		source: 'PDB 1AON (Xu et al. 1997)',
		file: 'pdb/1AON.cif.gz',
		axis: 'longest-y',
		groups: [
			{ name: 'groES', chains: 'OPQRSTU' },
			{ name: 'groEL', rest: true }
		]
	},
	{
		id: 'rnaPolymerase',
		name: 'RNA polymerase (E. coli)',
		source: 'PDB 4YG2 (Murakami 2015), one of two copies',
		file: 'pdb/4YG2.cif.gz',
		only: 'ABCDEF',
		groups: [{ name: 'rnap', rest: true }]
	},
	{
		id: 'efTuTrna',
		name: 'EF-Tu carrying a tRNA',
		source: 'PDB 1OB2 (Nissen et al. 1999)',
		file: 'pdb/1OB2.cif.gz',
		groups: [
			{ name: 'trna', chains: 'B' },
			{ name: 'eftu', rest: true }
		]
	},
	{
		id: 'trna',
		name: 'Transfer RNA',
		source: 'PDB 1EHZ (Shi & Moore 2000)',
		file: 'pdb/1EHZ.cif.gz',
		groups: [{ name: 'trna', rest: true }]
	},
	{
		id: 'adk',
		name: 'Adenylate kinase (E. coli)',
		source: 'PDB 4AKE (Müller et al. 1996), chain A',
		file: 'pdb/4AKE.cif.gz',
		only: 'A',
		groups: [{ name: 'adk', rest: true }]
	},
	{
		id: 'citrateSynthase',
		name: 'Citrate synthase (pig heart)',
		source: 'PDB 1CTS (Remington et al. 1982), biological assembly',
		file: 'pdb/1CTS-assembly1.cif.gz',
		groups: [{ name: 'cs', rest: true }]
	},
	{
		id: 'ompF',
		name: 'Porin OmpF (E. coli outer membrane)',
		source: 'PDB 2OMF (Cowan et al. 1995), oriented by OPM',
		file: 'opm/2omf.pdb',
		membrane: true,
		groups: [{ name: 'porin', rest: true }]
	},
	{
		id: 'lacY',
		name: 'Lactose permease LacY (E. coli inner membrane)',
		source: 'PDB 1PV6 (Abramson et al. 2003), oriented by OPM',
		file: 'opm/1pv6.pdb',
		membrane: true,
		groups: [{ name: 'lacy', rest: true }]
	}
];

const SMALL = [
	{
		id: 'atp',
		name: 'ATP',
		source: 'RCSB ligand ATP, ideal coordinates',
		file: 'lig/ATP.sdf'
	},
	{
		id: 'glucose',
		name: 'Glucose (α-D-glucopyranose)',
		source: 'RCSB ligand GLC, ideal coordinates',
		file: 'lig/GLC.sdf'
	},
	{
		id: 'chlorophyll',
		name: 'Chlorophyll a',
		source: 'RCSB ligand CLA, ideal coordinates',
		file: 'lig/CLA.sdf'
	},
	{
		id: 'dna',
		name: 'B-DNA, 12 base pairs',
		source: 'PDB 1BNA (Drew et al. 1981)',
		file: 'pdb/1BNA.cif.gz',
		axis: 'longest-y'
	},
	{
		id: 'water',
		name: 'Water',
		source: 'RCSB ligand HOH, ideal coordinates',
		file: 'lig/HOH.sdf'
	}
];

// ---- geometry -------------------------------------------------------------------

/** Eigen-decomposition of a symmetric 3 × 3 matrix (Jacobi rotations). */
function eigen3(m) {
	const a = m.map((r) => r.slice());
	const v = [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1]
	];
	for (let sweep = 0; sweep < 50; sweep++) {
		for (const [p, q] of [
			[0, 1],
			[0, 2],
			[1, 2]
		]) {
			if (Math.abs(a[p][q]) < 1e-12) continue;
			const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
			const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
			const c = 1 / Math.sqrt(t * t + 1);
			const s = t * c;
			for (let k = 0; k < 3; k++) {
				const akp = a[k][p];
				const akq = a[k][q];
				a[k][p] = c * akp - s * akq;
				a[k][q] = s * akp + c * akq;
			}
			for (let k = 0; k < 3; k++) {
				const apk = a[p][k];
				const aqk = a[q][k];
				a[p][k] = c * apk - s * aqk;
				a[q][k] = s * apk + c * aqk;
			}
			for (let k = 0; k < 3; k++) {
				const vkp = v[k][p];
				const vkq = v[k][q];
				v[k][p] = c * vkp - s * vkq;
				v[k][q] = s * vkp + c * vkq;
			}
		}
	}
	const vals = [a[0][0], a[1][1], a[2][2]];
	const vecs = [0, 1, 2].map((i) => [v[0][i], v[1][i], v[2][i]]);
	return [0, 1, 2].sort((i, j) => vals[j] - vals[i]).map((i) => ({ val: vals[i], vec: vecs[i] }));
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Projects atoms (Å) to {x, y, d} in nm: page x, page y (down), depth (towards viewer). */
function project(atoms, spec) {
	const n = atoms.length;
	const cx = atoms.reduce((s, a) => s + a.x, 0) / n;
	const cy = atoms.reduce((s, a) => s + a.y, 0) / n;
	const cz = atoms.reduce((s, a) => s + a.z, 0) / n;
	if (spec.membrane) {
		// keep z (membrane normal); choose the turn about z with the widest profile
		let best = 0;
		let bestW = -1;
		for (let k = 0; k < 180; k += 2) {
			const f = (k * Math.PI) / 180;
			let lo = Infinity;
			let hi = -Infinity;
			for (const a of atoms) {
				const u = (a.x - cx) * Math.cos(f) + (a.y - cy) * Math.sin(f);
				if (u < lo) lo = u;
				if (u > hi) hi = u;
			}
			if (hi - lo > bestW) {
				bestW = hi - lo;
				best = f;
			}
		}
		const c = Math.cos(best);
		const s = Math.sin(best);
		return atoms.map((a) => ({
			...a,
			px: ((a.x - cx) * c + (a.y - cy) * s) / 10,
			py: -a.z / 10,
			pd: (-(a.x - cx) * s + (a.y - cy) * c) / 10
		}));
	}
	const cov = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for (const a of atoms) {
		const r = [a.x - cx, a.y - cy, a.z - cz];
		for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += r[i] * r[j];
	}
	const [e1, e2, e3] = eigen3(cov).map((e) => e.vec);
	// default: longest axis across, shortest towards the viewer
	let ax = e1;
	let ay = e2;
	let ad = e3;
	if (spec.axis === 'longest-y') [ax, ay, ad] = [e2, e1, e3];
	return atoms.map((a) => {
		const r = [a.x - cx, a.y - cy, a.z - cz];
		return { ...a, px: dot(r, ax) / 10, py: dot(r, ay) / 10, pd: dot(r, ad) / 10 };
	});
}

/**
 * Moves `atoms` onto OPM's frame: the rotation and shift that superpose
 * `ref` (same atoms, deposited frame) onto `target` (OPM frame), from the polar
 * decomposition of their covariance (Kabsch).
 */
function superpose(atoms, ref, target) {
	const n = ref.length;
	const mean = (l) => ['x', 'y', 'z'].map((k) => l.reduce((s, a) => s + a[k], 0) / n);
	const cr = mean(ref);
	const ct = mean(target);
	const H = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for (let i = 0; i < n; i++) {
		const a = [ref[i].x - cr[0], ref[i].y - cr[1], ref[i].z - cr[2]];
		const b = [target[i].x - ct[0], target[i].y - ct[1], target[i].z - ct[2]];
		for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) H[r][c] += b[r] * a[c];
	}
	// R = H (HᵀH)^(-1/2)
	const HtH = [0, 1, 2].map((r) =>
		[0, 1, 2].map((c) => H[0][r] * H[0][c] + H[1][r] * H[1][c] + H[2][r] * H[2][c])
	);
	const eig = eigen3(HtH);
	const inv = [0, 1, 2].map((r) =>
		[0, 1, 2].map((c) => eig.reduce((s, e) => s + (e.vec[r] * e.vec[c]) / Math.sqrt(e.val), 0))
	);
	const R = [0, 1, 2].map((r) =>
		[0, 1, 2].map((c) => H[r][0] * inv[0][c] + H[r][1] * inv[1][c] + H[r][2] * inv[2][c])
	);
	let rms = 0;
	const move = (a) => {
		const v = [a.x - cr[0], a.y - cr[1], a.z - cr[2]];
		return {
			...a,
			x: dot(R[0], v) + ct[0],
			y: dot(R[1], v) + ct[1],
			z: dot(R[2], v) + ct[2]
		};
	};
	for (let i = 0; i < n; i++) {
		const m = move(ref[i]);
		rms += (m.x - target[i].x) ** 2 + (m.y - target[i].y) ** 2 + (m.z - target[i].z) ** 2;
	}
	console.log('  superposed on OPM, rmsd', Math.sqrt(rms / n).toFixed(2), 'Å');
	return atoms.map(move);
}

// ---- outlines ---------------------------------------------------------------------

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
	// directed boundary edges between grid points, filled region on the left;
	// a corner where two regions touch diagonally has two outgoing edges
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
			// cell (i, j) spans corners (i, j)…(i+1, j+1); emit edges where the neighbour is empty
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
				// at a corner where two regions touch diagonally, turn so as to keep them apart
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

/** Douglas–Peucker for a closed loop: split at the point farthest from the first. */
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

/** Smooths a closed polygon a little (Chaikin, one pass) to soften the grid steps. */
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

function load(spec) {
	const path = join(RAW, spec.file);
	let atoms;
	if (spec.file.endsWith('.sdf')) atoms = readSdf(path);
	else if (spec.file.endsWith('.pdb')) atoms = readPdb(path);
	else atoms = readCif(path).atoms;
	if (spec.orientFrom) {
		const o = spec.orientFrom;
		const target = readPdb(join(RAW, o.file)).filter((a) => a.chain === o.opmChain);
		const ref = atoms.filter((a) => a.chain === o.chain && a.el !== 'H');
		if (ref.length !== target.length)
			throw new Error(`${spec.id}: ${ref.length} vs ${target.length} atoms`);
		atoms = superpose(atoms, ref, target);
	}
	return atoms.filter(
		(a) =>
			a.el !== 'H' &&
			a.el !== 'D' &&
			!SKIP.has(a.res) &&
			(!spec.only || spec.only.includes(a.chain)) &&
			Number.isFinite(a.x)
	);
}

function groupOf(spec, a) {
	for (const g of spec.groups) {
		if (g.chains && (Array.isArray(g.chains) ? g.chains : [...g.chains]).includes(a.chain))
			return g.name;
		if (g.rna && RNA.has(a.res)) return g.name;
		if (g.dna && DNA.has(a.res)) return g.name;
		if (g.rest) return g.name;
	}
	return spec.groups.at(-1).name;
}

const min = (xs) => xs.reduce((m, v) => (v < m ? v : m), Infinity);
const max = (xs) => xs.reduce((m, v) => (v > m ? v : m), -Infinity);

const machines = {};
for (const spec of MACHINES) {
	const atoms = project(load(spec), spec);
	const box = {
		x0: min(atoms.map((a) => a.px)) - 0.5,
		x1: max(atoms.map((a) => a.px)) + 0.5,
		y0: min(atoms.map((a) => a.py)) - 0.5,
		y1: max(atoms.map((a) => a.py)) + 0.5
	};
	const by = new Map(spec.groups.map((g) => [g.name, []]));
	for (const a of atoms) by.get(groupOf(spec, a)).push(a);
	let groups = [...by]
		.filter(([, list]) => list.length)
		.map(([name, list]) => ({
			name,
			depth: list.reduce((s, a) => s + a.pd, 0) / list.length,
			d: outline(list, box)
		}));
	// far groups first, so nearer ones are painted over them
	if (spec.order !== 'given') groups.sort((a, b) => a.depth - b.depth);
	const xs = atoms.map((a) => a.px);
	const ys = atoms.map((a) => a.py);
	machines[spec.id] = {
		name: spec.name,
		source: spec.source,
		membrane: Boolean(spec.membrane),
		atoms: atoms.length,
		width: +(max(xs) - min(xs) + 2 * R_ATOM).toFixed(1),
		height: +(max(ys) - min(ys) + 2 * R_ATOM).toFixed(1),
		top: +(min(ys) - R_ATOM).toFixed(1),
		bottom: +(max(ys) + R_ATOM).toFixed(1),
		groups: groups.map(({ name, d }) => ({ name, d }))
	};
	console.log(spec.id, atoms.length, machines[spec.id].width, machines[spec.id].height);
}

const small = {};
for (const spec of SMALL) {
	const path = join(RAW, spec.file);
	let atoms = spec.file.endsWith('.sdf') ? readSdf(path) : readCif(path).atoms;
	atoms = atoms.filter((a) => a.res !== 'HOH' && Number.isFinite(a.x));
	const p = project(atoms, spec).sort((a, b) => a.pd - b.pd);
	small[spec.id] = {
		name: spec.name,
		source: spec.source,
		atoms: p.map((a) => [a.el, +a.px.toFixed(3), +a.py.toFixed(3), +a.pd.toFixed(3)])
	};
	console.log(spec.id, p.length);
}

const header = `/**
 * GENERATED by scripts/data/the-cell/build-shapes.mjs — do not edit by hand.
 *
 * Outlines of real molecular machines and the atoms of small molecules, traced
 * from their measured 3D structures, in nanometres at true size.
 *
 * Sources (each entry names its own): structures from the RCSB Protein Data
 * Bank (https://www.rcsb.org, data under CC0 1.0) — membrane proteins in the
 * orientation computed by the OPM database (Lomize et al., Nucleic Acids Res.
 * 2012; https://opm.phar.umich.edu, membrane normal vertical, membrane centre
 * at y = 0, the cytoplasmic / matrix / stromal side at positive y) — and small
 * molecules from the RCSB ligand dictionary's ideal coordinates.
 *
 * How the outlines were made: hydrogens and waters dropped; each heavy atom a
 * disc of radius 0.25 nm on a 0.2 nm grid; the outline of each group of
 * chains traced and simplified to within 0.12 nm; groups listed back to front.
 * Soluble structures are turned to their principal axes (longest across);
 * membrane proteins are turned about the membrane normal to their widest side.
 */

export interface MachineShape {
	name: string;
	source: string;
	/** Oriented in a membrane: y = 0 is the membrane centre. */
	membrane: boolean;
	/** Heavy atoms traced. */
	atoms: number;
	/** Extent of the outline, nm. */
	width: number;
	height: number;
	top: number;
	bottom: number;
	/** Outlines (SVG path data in nm, centred on the structure), back to front. */
	groups: { name: string; d: string }[];
}

export interface SmallMolecule {
	name: string;
	source: string;
	/** [element, x, y, depth] in nm, back to front. */
	atoms: [string, number, number, number][];
}
`;

const body =
	header +
	`\nexport const MACHINES = ${JSON.stringify(machines, null, '\t')} satisfies Record<string, MachineShape>;\n` +
	`\nexport const SMALL_MOLECULES = ${JSON.stringify(small)} satisfies Record<string, SmallMolecule>;\n`;
writeFileSync(OUT, body.replace(/"(\w+)":/g, '$1:'));
console.log('wrote', OUT, (body.length / 1024).toFixed(0), 'KB');
