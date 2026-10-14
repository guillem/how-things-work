#!/usr/bin/env node
/**
 * Builds `src/routes/protein-folding/proteins-data.ts`: the Cα traces of three real
 * proteins, measured (RCSB Protein Data Bank) and predicted (AlphaFold Protein Structure
 * Database, with its per-residue confidence), superposed, for the "Protein folding" page.
 *
 *   node scripts/data/protein-folding/build-proteins.mjs <download-dir>
 *
 * <download-dir> holds the downloaded files (not committed):
 *   <ID>.cif.gz                    https://files.rcsb.org/download/<ID>.cif.gz
 *   AF-<UniProt>-F1-model_v6.cif   https://alphafold.ebi.ac.uk/files/AF-<UniProt>-F1-model_v6.cif
 *   AF-<UniProt>-conf.json         https://alphafold.ebi.ac.uk/files/AF-<UniProt>-F1-confidence_v6.json
 * (the AlphaFold server answers 403 without a User-Agent header: `curl -A "Mozilla/5.0"`).
 *
 * Method. From the experimental entry, the Cα atoms of one chain (first model, alternate
 * location "." or "A"), the secondary structure annotated in the entry (`_struct_conf`
 * helices, `_struct_sheet_range` strands) and, for haemoglobin, the haem's iron, four
 * nitrogens and four bridging carbons. The chain is matched to the UniProt sequence of the
 * AlphaFold model by the offset that makes their residues identical (checked residue by
 * residue). From the AlphaFold model, every Cα and its pLDDT (from the confidence file,
 * checked against the model's B-factor column). The predicted trace is superposed on the
 * measured one over all matched residues (least squares, `structure.ts`), both are turned
 * to the measured structure's principal axes and centred on it, and written in ångströms
 * to 0.1 Å.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
	apply,
	centroid,
	place,
	principalAxes,
	sub,
	superpose
} from '../../../src/routes/protein-folding/structure.ts';

const RAW = process.argv[2];
if (!RAW) {
	console.error('usage: build-proteins.mjs <download-dir>');
	process.exit(1);
}
const OUT = resolve(import.meta.dirname, '../../../src/routes/protein-folding/proteins-data.ts');

const PROTEINS = [
	{
		id: 'globin',
		name: 'β-globin (human haemoglobin)',
		uniprot: 'P68871',
		pdb: '2DN2',
		// chain B is a β chain (entity 2, UniProt P68871 in _struct_ref_seq)
		chain: 'B',
		haem: true
	},
	{
		id: 'lysozyme',
		name: 'Lysozyme (hen egg white)',
		uniprot: 'P00698',
		pdb: '2VB1',
		chain: 'A'
	},
	{
		id: 'p53',
		name: 'p53 tumour suppressor (human)',
		uniprot: 'P04637',
		pdb: '2OCJ',
		chain: 'A'
	}
];

const THREE = {
	ALA: 'A',
	ARG: 'R',
	ASN: 'N',
	ASP: 'D',
	CYS: 'C',
	GLN: 'Q',
	GLU: 'E',
	GLY: 'G',
	HIS: 'H',
	ILE: 'I',
	LEU: 'L',
	LYS: 'K',
	MET: 'M',
	PHE: 'F',
	PRO: 'P',
	SER: 'S',
	THR: 'T',
	TRP: 'W',
	TYR: 'Y',
	VAL: 'V'
};

function text(path) {
	const buf = readFileSync(path);
	return path.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}

/** Splits an mmCIF data line into tokens, honouring single and double quotes. */
function tokens(line) {
	const out = [];
	let i = 0;
	while (i < line.length) {
		while (line[i] === ' ' || line[i] === '\t') i++;
		if (i >= line.length) break;
		const q = line[i];
		if (q === "'" || q === '"') {
			let j = i + 1;
			while (j < line.length && !(line[j] === q && (j + 1 >= line.length || line[j + 1] === ' ')))
				j++;
			out.push(line.slice(i + 1, j));
			i = j + 1;
		} else {
			let j = i;
			while (j < line.length && line[j] !== ' ' && line[j] !== '\t') j++;
			out.push(line.slice(i, j));
			i = j;
		}
	}
	return out;
}

/**
 * The rows of an mmCIF category, as objects keyed by item name, whether the category is
 * written as a loop or as key/value pairs. Multi-line (;) values are skipped as empty.
 */
function category(cif, name) {
	const lines = cif.split('\n');
	const prefix = `_${name}.`;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i] === 'loop_' && lines[i + 1]?.startsWith(prefix)) {
			const cols = [];
			let j = i + 1;
			while (lines[j]?.startsWith('_')) cols.push(lines[j++].trim().slice(prefix.length));
			const rows = [];
			let buf = [];
			for (; j < lines.length && !lines[j].startsWith('#') && !lines[j].startsWith('loop_'); j++) {
				if (lines[j].startsWith(';')) {
					// a multi-line value runs to a line holding only ';'
					buf.push('');
					while (lines[++j].trim() !== ';');
				} else buf = buf.concat(tokens(lines[j]));
				while (buf.length >= cols.length) {
					rows.push(Object.fromEntries(cols.map((c, k) => [c, buf[k]])));
					buf = buf.slice(cols.length);
				}
			}
			return rows;
		}
		if (lines[i].startsWith(prefix)) {
			const row = {};
			for (let j = i; lines[j]?.startsWith(prefix); j++) {
				const t = tokens(lines[j]);
				row[t[0].slice(prefix.length)] = t[1] ?? '';
				// a value on the next line(s): quoted, or a ';' block
				if (t.length === 1 && lines[j + 1]?.startsWith(';')) {
					j++;
					while (lines[j + 1]?.trim() !== ';') j++;
					j++;
				} else if (t.length === 1) j++;
			}
			return [row];
		}
	}
	return [];
}

/** "Authors, Journal volume, first page (year)" of the entry's primary citation. */
function citationOf(cif) {
	const c = category(cif, 'citation').find((r) => r.id === 'primary');
	const names = category(cif, 'citation_author')
		.filter((r) => r.citation_id === 'primary')
		.map((r) => r.name.split(',')[0]);
	const who = names.length > 2 ? `${names[0]} et al.` : names.join(' & ');
	const journal = c.journal_abbrev.replace('Acta Crystallogr.,Sect.D', 'Acta Cryst. D');
	return `${who}, ${journal} ${c.journal_volume}, ${c.page_first} (${c.year})`;
}

/**
 * Maximum solvent-accessible surface of each amino acid in a protein, Å² (Tien, Meyer,
 * Sydykova, Spielman & Wilke, PLoS ONE 8, e80635, 2013, theoretical values).
 */
const MAX_ASA = {
	A: 129,
	R: 274,
	N: 195,
	D: 193,
	C: 167,
	Q: 225,
	E: 223,
	G: 104,
	H: 224,
	I: 197,
	L: 201,
	K: 236,
	M: 224,
	F: 240,
	P: 159,
	S: 155,
	T: 172,
	W: 285,
	Y: 263,
	V: 174
};
/** Van der Waals radii, Å (Bondi, J. Phys. Chem. 68, 441, 1964; Fe as in common SASA tools). */
const RADIUS = { C: 1.7, N: 1.55, O: 1.52, S: 1.8, FE: 1.4 };

/**
 * Solvent-accessible surface per atom (Shrake & Rupley, J. Mol. Biol. 79, 351, 1973): a
 * probe of radius 1.4 Å (a water molecule) rolled over the atoms, sampled with 400 points
 * per atom spread over a sphere by the golden-angle spiral.
 */
function sasa(atoms) {
	const N = 400;
	const probe = 1.4;
	const sphere = [];
	for (let k = 0; k < N; k++) {
		const z = 1 - (2 * k + 1) / N;
		const r = Math.sqrt(1 - z * z);
		const phi = k * Math.PI * (3 - Math.sqrt(5));
		sphere.push([r * Math.cos(phi), r * Math.sin(phi), z]);
	}
	const R = atoms.map((a) => (RADIUS[a.el] ?? 1.7) + probe);
	return atoms.map((a, i) => {
		const near = [];
		for (let j = 0; j < atoms.length; j++) {
			if (j === i) continue;
			const d = Math.hypot(a.p[0] - atoms[j].p[0], a.p[1] - atoms[j].p[1], a.p[2] - atoms[j].p[2]);
			if (d < R[i] + R[j]) near.push(j);
		}
		let open = 0;
		for (const u of sphere) {
			const x = a.p[0] + R[i] * u[0];
			const y = a.p[1] + R[i] * u[1];
			const z = a.p[2] + R[i] * u[2];
			if (
				near.every(
					(j) =>
						(x - atoms[j].p[0]) ** 2 + (y - atoms[j].p[1]) ** 2 + (z - atoms[j].p[2]) ** 2 >=
						R[j] * R[j]
				)
			)
				open++;
		}
		return (4 * Math.PI * R[i] * R[i] * open) / N;
	});
}

const round = (v) => Math.round(v * 10) / 10;

const out = [];
for (const p of PROTEINS) {
	// ---- predicted model ----------------------------------------------------------------
	const afCif = text(join(RAW, `AF-${p.uniprot}-F1-model_v6.cif`));
	const conf = JSON.parse(text(join(RAW, `AF-${p.uniprot}-conf.json`)));
	const afAtoms = category(afCif, 'atom_site').filter((a) => a.label_atom_id === 'CA');
	const sequence = afAtoms.map((a) => THREE[a.label_comp_id]).join('');
	const plddt = afAtoms.map((a, i) => {
		const v = conf.confidenceScore[i];
		if (conf.residueNumber[i] !== Number(a.label_seq_id)) throw new Error('pLDDT numbering');
		if (Math.abs(v - Number(a.B_iso_or_equiv)) > 0.01) throw new Error('pLDDT mismatch');
		return v;
	});
	const af = afAtoms.map((a) => [Number(a.Cartn_x), Number(a.Cartn_y), Number(a.Cartn_z)]);

	// ---- measured structure -------------------------------------------------------------
	const cif = text(join(RAW, `${p.pdb}.cif.gz`));
	const atoms = category(cif, 'atom_site').filter(
		(a) =>
			a.auth_asym_id === p.chain &&
			(a.pdbx_PDB_model_num ?? '1') === '1' &&
			(a.label_alt_id === '.' || a.label_alt_id === 'A')
	);
	const ca = atoms.filter((a) => a.group_PDB === 'ATOM' && a.label_atom_id === 'CA');
	const authSeq = ca.map((a) => Number(a.auth_seq_id));
	const letters = ca.map((a) => THREE[a.label_comp_id] ?? 'X');
	// offset from author numbering to UniProt position (1-based), chosen to match residues
	let offset = null;
	for (let o = -30; o <= 30 && offset === null; o++) {
		const same = authSeq.filter((n, k) => sequence[n + o - 1] === letters[k]).length;
		if (same === ca.length) offset = o;
	}
	if (offset === null) throw new Error(`${p.pdb}: no offset matches UniProt ${p.uniprot}`);
	const ss = Array.from({ length: sequence.length }, () => '-');
	for (const h of category(cif, 'struct_conf')) {
		if (h.beg_auth_asym_id !== p.chain || !h.conf_type_id.startsWith('HELX')) continue;
		for (let n = Number(h.beg_auth_seq_id); n <= Number(h.end_auth_seq_id); n++)
			ss[n + offset - 1] = 'H';
	}
	for (const s of category(cif, 'struct_sheet_range')) {
		if (s.beg_auth_asym_id !== p.chain) continue;
		for (let n = Number(s.beg_auth_seq_id); n <= Number(s.end_auth_seq_id); n++)
			ss[n + offset - 1] = 'E';
	}
	const exp = Array.from({ length: sequence.length }, () => null);
	ca.forEach((a, k) => {
		exp[authSeq[k] + offset - 1] = [Number(a.Cartn_x), Number(a.Cartn_y), Number(a.Cartn_z)];
	});
	const haem = p.haem
		? ['FE', 'NA', 'NB', 'NC', 'ND', 'CHA', 'CHB', 'CHC', 'CHD'].map((name) => {
				const a = atoms.find((x) => x.label_comp_id === 'HEM' && x.label_atom_id === name);
				if (!a) throw new Error(`haem atom ${name}`);
				return [Number(a.Cartn_x), Number(a.Cartn_y), Number(a.Cartn_z)];
			})
		: null;

	// ---- superpose, orient, centre ------------------------------------------------------
	// relative solvent accessibility of each measured residue, in the isolated chain (with
	// its haem, for haemoglobin), from every heavy atom
	const heavy = atoms
		.filter(
			(a) =>
				a.type_symbol !== 'H' &&
				a.type_symbol !== 'D' &&
				(a.group_PDB === 'ATOM' || (p.haem && a.label_comp_id === 'HEM'))
		)
		.map((a) => ({
			el: a.type_symbol.toUpperCase(),
			p: [Number(a.Cartn_x), Number(a.Cartn_y), Number(a.Cartn_z)],
			res: a.group_PDB === 'ATOM' ? Number(a.auth_seq_id) + offset - 1 : -1
		}));
	const area = sasa(heavy);
	const rsa = Array.from({ length: sequence.length }, () => null);
	heavy.forEach((a, k) => {
		if (a.res < 0 || !exp[a.res]) return;
		rsa[a.res] = (rsa[a.res] ?? 0) + area[k];
	});
	for (let i = 0; i < rsa.length; i++)
		if (rsa[i] !== null)
			rsa[i] = Math.round(Math.min(1, rsa[i] / MAX_ASA[sequence[i]]) * 100) / 100;

	const matched = exp.map((v, i) => i).filter((i) => exp[i]);
	const fit = superpose(
		matched.map((i) => af[i]),
		matched.map((i) => exp[i])
	);
	const expPts = matched.map((i) => exp[i]);
	const axes = principalAxes(expPts);
	const c = centroid(expPts);
	const frame = (v) => apply(axes, sub(v, c)).map(round);
	const meta = category(cif, 'refine')[0] ?? {};
	const status = category(cif, 'pdbx_database_status')[0] ?? {};
	const method = category(cif, 'exptl')[0]?.method ?? '';
	out.push({
		id: p.id,
		name: p.name,
		uniprot: p.uniprot,
		sequence,
		pdb: {
			id: p.pdb,
			chain: p.chain,
			method: method.toLowerCase(),
			resolution: Number(meta.ls_d_res_high),
			deposited: status.recvd_initial_deposition_date,
			citation: citationOf(cif),
			numbering: offset
		},
		af: {
			id: `AF-${p.uniprot}-F1`,
			version: 6,
			meanPlddt: Math.round((plddt.reduce((s, v) => s + v, 0) / plddt.length) * 100) / 100
		},
		ss: ss.join(''),
		rsa,
		plddt: plddt.map((v) => Math.round(v * 10) / 10),
		exp: exp.map((v) => (v ? frame(v) : null)),
		pred: af.map((v) => frame(place(fit, v))),
		haem: haem ? haem.map(frame) : null,
		rmsd: Math.round(fit.rmsd * 100) / 100
	});
	console.log(
		`${p.id}: ${sequence.length} residues, ${matched.length} measured (UniProt = author + ${offset}), RMSD ${fit.rmsd.toFixed(2)} Å, mean pLDDT ${out.at(-1).af.meanPlddt}`
	);
}

const header = `/**
 * GENERATED by scripts/data/protein-folding/build-proteins.mjs — do not edit by hand.
 *
 * Cα traces (one point per amino acid, in ångströms, to 0.1 Å) of three proteins, as
 * measured and as predicted, superposed and turned to the measured structure's principal
 * axes (longest along x).
 *
 * Measured structures: RCSB Protein Data Bank (https://www.rcsb.org; Berman et al., Nucleic
 * Acids Res. 28, 235, 2000), data under CC0 1.0. Entries 2DN2 (chain B), 2VB1 (chain A) and
 * 2OCJ (chain A); each protein's \`pdb.citation\` gives the primary publication. Secondary
 * structure as annotated in each entry (H helix, E strand, - other).
 *
 * Predicted structures and per-residue confidence (pLDDT): AlphaFold Protein Structure
 * Database (https://alphafold.ebi.ac.uk), model version 6, "AlphaFold Monomer v2.0
 * pipeline"; Jumper et al., Nature 596, 583 (2021); Varadi et al., Nucleic Acids Res. 52,
 * D368 (2024). AlphaFold DB data are made available under the Creative Commons Attribution
 * 4.0 (CC BY 4.0) licence; only the Cα coordinates and pLDDT values are kept here.
 *
 * Arrays are indexed by UniProt position − 1. \`exp\` is null where the measured structure
 * has no residue (not part of the crystallised fragment, or not seen). \`rmsd\` is the Cα
 * RMSD of the superposition over every measured residue.
 */
`;
const body = `export interface ProteinRecord {
	id: string;
	name: string;
	uniprot: string;
	/** UniProt sequence, one letter per amino acid. */
	sequence: string;
	pdb: {
		id: string;
		chain: string;
		method: string;
		/** Å */
		resolution: number;
		deposited: string;
		citation: string;
		/** UniProt position = author residue number + this. */
		numbering: number;
	};
	af: { id: string; version: number; meanPlddt: number };
	ss: string;
	/**
	 * Relative solvent accessibility of each measured residue (0 buried … 1 fully exposed):
	 * its solvent-accessible surface in the isolated chain (Shrake–Rupley, 1.4 Å probe, Bondi
	 * radii, all heavy atoms, with the haem for β-globin) over the amino acid's maximum
	 * (Tien et al., PLoS ONE 2013). Null where the residue was not measured.
	 */
	rsa: (number | null)[];
	plddt: number[];
	exp: ([number, number, number] | null)[];
	pred: [number, number, number][];
	/** Haem: Fe, NA, NB, NC, ND, CHA, CHB, CHC, CHD. */
	haem: [number, number, number][] | null;
	rmsd: number;
}

export const PROTEINS: ProteinRecord[] = ${JSON.stringify(out)};
`;
writeFileSync(OUT, header + body);
// formatted as `make check` expects
execFileSync(resolve(import.meta.dirname, '../../../node_modules/.bin/prettier'), ['--write', OUT]);
console.log(`wrote ${OUT}`);
