#!/usr/bin/env node
/**
 * Builds `src/routes/mrna-vaccines/data.ts`: the outlines of the SARS-CoV-2
 * spike protein before and after it springs into its fusion shape, and short
 * excerpts of the spike's genetic message as the virus spells it and as the
 * BioNTech/Pfizer vaccine spells it.
 *
 *   node scripts/data/mrna-vaccines/build-data.mjs <download-dir>
 *
 * <download-dir> holds (not committed):
 *   pdb/6VSB-assembly1.cif.gz  https://files.rcsb.org/download/6VSB-assembly1.cif.gz
 *       the prefusion spike, stabilised by two prolines (Wrapp et al., Science 2020)
 *   pdb/6XRA-assembly1.cif.gz  https://files.rcsb.org/download/6XRA-assembly1.cif.gz
 *       the postfusion S2 trimer (Cai et al., Science 2020)
 *   Figure1Figure2_032321.fasta
 *       https://github.com/NAalytics/Assemblies-of-putative-SARS-CoV2-spike-encoding-mRNA-sequences-for-vaccines-BNT-162b2-and-mRNA-1273
 *       (Jeong et al., Stanford, 2021: the vaccine RNA sequenced from vial
 *       remnants; the first record is BNT162b2)
 *   spike-virus.fasta
 *       https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_045512.2&rettype=fasta&seq_start=21563&seq_stop=25384
 *       (the spike gene of the reference genome, Wuhan-Hu-1)
 *
 * Outlines: the method of `scripts/data/immune-system/build-shapes.mjs`
 * (helpers copied below). Protein atoms only (the sugars on the spike are
 * left out); every heavy atom a disc of radius 0.25 nm on a 0.2 nm grid,
 * outlines simplified to within 0.12 nm. Each trimer stands upright with its
 * membrane end down. S1 is residues 1–685, S2 686 on (the furin cleavage site
 * is after residue 685).
 *
 * Sequences: only short excerpts and counts are written (the start of the
 * message and the two codons changed to prolines), not the whole message.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCif } from '../the-cell/structure-io.mjs';

const RAW = process.argv[2];
if (!RAW) {
	console.error('usage: build-data.mjs <download-dir>');
	process.exit(1);
}
const OUT = resolve(import.meta.dirname, '../../../src/routes/mrna-vaccines/data.ts');

// ---- vectors -----------------------------------------------------------------------

const centroid = (l) => ['x', 'y', 'z'].map((k) => l.reduce((s, a) => s + a[k], 0) / l.length);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => a.map((v) => v / Math.hypot(...a));
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];

/** Longest axis of a set of atoms (power iteration on the covariance), pointing along `hint`. */
function axis(atoms, hint) {
	const c = centroid(atoms);
	const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	for (const a of atoms) {
		const r = [a.x - c[0], a.y - c[1], a.z - c[2]];
		for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] += r[i] * r[j];
	}
	let v = norm(hint);
	for (let k = 0; k < 100; k++)
		v = norm([0, 1, 2].map((i) => m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2]));
	return dot(v, hint) < 0 ? v.map((x) => -x) : v;
}

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

// ---- outlines (copied from scripts/data/immune-system/build-shapes.mjs) -----------------------

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

// ---- main: outlines ----------------------------------------------------------------

const min = (xs) => xs.reduce((m, v) => (v < m ? v : m), Infinity);
const max = (xs) => xs.reduce((m, v) => (v > m ? v : m), -Infinity);
const isS1 = (a) => a.seq <= 685;

const SPECS = [
	{
		id: 'prefusion',
		name: 'Spike before fusion, held by two prolines (S-2P)',
		source: 'PDB 6VSB (Wrapp et al., Science 2020), biological assembly 1',
		file: 'pdb/6VSB-assembly1.cif.gz',
		groups: [
			{ name: 'S2', keep: (a) => !isS1(a) },
			{ name: 'S1', keep: isS1 }
		],
		// down: from the S1 heads to the S2 stalk, along the trimer's long axis
		down: (atoms) => sub(centroid(atoms.filter((a) => !isS1(a))), centroid(atoms.filter(isS1)))
	},
	{
		id: 'postfusion',
		name: 'Spike after fusion (S2 only: S1 has fallen off)',
		source: 'PDB 6XRA (Cai et al., Science 2020), biological assembly 1',
		file: 'pdb/6XRA-assembly1.cif.gz',
		groups: [{ name: 'S2', keep: () => true }],
		// down: towards the end nearest the membrane (the last residues, before the anchor)
		down: (atoms) => {
			const last = max(atoms.map((a) => a.seq));
			return sub(centroid(atoms.filter((a) => a.seq > last - 60)), centroid(atoms));
		}
	}
];

const shapes = {};
for (const spec of SPECS) {
	const all = readCif(join(RAW, spec.file)).atoms.filter(
		(a) => !a.het && a.el !== 'H' && a.el !== 'D' && Number.isFinite(a.x)
	);
	const down = axis(all, spec.down(all));
	const atoms = project(all, { down, across: cross(down, [0, 0, 1]) });
	const box = {
		x0: min(atoms.map((a) => a.px)) - 0.5,
		x1: max(atoms.map((a) => a.px)) + 0.5,
		y0: min(atoms.map((a) => a.py)) - 0.5,
		y1: max(atoms.map((a) => a.py)) + 0.5
	};
	const groups = spec.groups.map((g) => ({ name: g.name, d: outline(atoms.filter(g.keep), box) }));
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

// ---- main: sequences ---------------------------------------------------------------

const fasta = (text) =>
	text
		.split('>')
		.filter(Boolean)
		.map((r) => r.split('\n').slice(1).join('').replace(/\s/g, '').toUpperCase());
const vaccine = fasta(readFileSync(join(RAW, 'Figure1Figure2_032321.fasta'), 'utf8'))[0];
const virus = fasta(readFileSync(join(RAW, 'spike-virus.fasta'), 'utf8'))[0];
const start = vaccine.indexOf('ATG');
const CODONS = 1273;
const cds = vaccine.slice(start, start + 3 * CODONS);
const gene = virus.slice(0, 3 * CODONS);
if (virus.length !== 3 * CODONS + 3) throw new Error('unexpected spike gene length');
const toRna = (s) => s.replace(/T/g, 'U');
const codons = (s, from, to) =>
	Array.from({ length: to - from + 1 }, (_, i) =>
		toRna(s.slice(3 * (from - 1 + i), 3 * (from + i)))
	);
const gc = (s) => +([...s].filter((b) => b === 'G' || b === 'C').length / s.length).toFixed(3);
let same = 0;
for (let i = 0; i < CODONS; i++)
	if (cds.slice(3 * i, 3 * i + 3) === gene.slice(3 * i, 3 * i + 3)) same++;

const sequence = {
	source:
		'Vaccine: BNT162b2, sequenced by Jeong et al. (Stanford, 2021); virus: spike gene of SARS-CoV-2 Wuhan-Hu-1, GenBank NC_045512.2',
	codons: CODONS,
	/** Letters before the start codon in the sequenced vaccine RNA (5′ untranslated region, without the cap). */
	utr5: start,
	/** Letters after the coding sequence's last codon in the sequenced RNA (stop codons and 3′ UTR; the poly(A) tail was not sequenced). */
	utr3: vaccine.length - start - 3 * CODONS,
	/** Codons identical in the vaccine and the virus. */
	sameCodons: same,
	gcVirus: gc(gene),
	gcVaccine: gc(cds),
	/** Codons 1–13 (the signal peptide), as the virus and the vaccine spell them. */
	startVirus: codons(gene, 1, 13),
	startVaccine: codons(cds, 1, 13),
	/** Codons 983–990, around the two changed to prolines (986, 987). */
	windowFrom: 983,
	windowVirus: codons(gene, 983, 990),
	windowVaccine: codons(cds, 983, 990)
};
console.log(sequence);

const header = `/**
 * GENERATED by scripts/data/mrna-vaccines/build-data.mjs — do not edit by hand.
 *
 * SHAPES: outlines of the SARS-CoV-2 spike protein traced from structures in
 * the RCSB Protein Data Bank (https://www.rcsb.org, data under CC0 1.0), in
 * nanometres at true size, centred, y pointing down the page, membrane end
 * down: before fusion (PDB 6VSB, the two-proline spike of the vaccines;
 * Wrapp et al., Science 367:1260, 2020) and after (PDB 6XRA, the postfusion
 * S2; Cai et al., Science 369:1586, 2020). Protein atoms only.
 *
 * SEQUENCE: short excerpts of the spike's message (as RNA letters) in the
 * virus (GenBank NC_045512.2, Wuhan-Hu-1) and in the BioNTech/Pfizer vaccine
 * BNT162b2 as sequenced from vial remnants by Jeong, McCoy, … Fire & Shoura,
 * "Assemblies of putative SARS-CoV2-spike-encoding mRNA sequences for
 * vaccines BNT-162b2 and mRNA-1273" (Stanford, 2021,
 * github.com/NAalytics), plus counts over the whole coding sequence. The
 * sequencing cannot see modified letters: every U of the vaccine is in fact
 * N1-methylpseudouridine.
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
const body =
	`export const SHAPES = ${JSON.stringify(shapes, null, '\t')} satisfies Record<string, Shape>;\n\n` +
	`export const SEQUENCE = ${JSON.stringify(sequence, null, '\t')} as const;\n`;
writeFileSync(OUT, header + body);
console.log('wrote', OUT);
