/**
 * Minimal readers for the structure files used by `build-shapes.mjs`: PDB
 * (fixed columns, as served by the OPM database), mmCIF (the `_atom_site` loop,
 * as served by the RCSB PDB) and SDF/MOL (RCSB ligand "ideal" coordinates).
 * No dependencies; gzip is read with Node's zlib.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

/** @typedef {{ el: string, x: number, y: number, z: number, chain: string, res: string, name?: string, entity?: string, seq?: number, het: boolean }} Atom */

function text(path) {
	const buf = readFileSync(path);
	return path.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}

/** Atoms of a PDB file (ATOM and HETATM records; OPM's DUM membrane markers excluded). */
export function readPdb(path) {
	/** @type {Atom[]} */
	const atoms = [];
	for (const line of text(path).split('\n')) {
		const rec = line.slice(0, 6);
		if (rec !== 'ATOM  ' && rec !== 'HETATM') continue;
		const res = line.slice(17, 20).trim();
		if (res === 'DUM') continue;
		let el = line.slice(76, 78).trim();
		if (!el) el = line.slice(12, 16).trim().replace(/[0-9]/g, '').slice(0, 1);
		atoms.push({
			el: el.toUpperCase(),
			x: Number(line.slice(30, 38)),
			y: Number(line.slice(38, 46)),
			z: Number(line.slice(46, 54)),
			chain: line.slice(21, 22),
			res,
			het: rec === 'HETATM'
		});
	}
	return atoms;
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

/** Atoms of the first model of an mmCIF file, with author chain ids and entity ids. */
export function readCif(path) {
	const lines = text(path).split('\n');
	/** @type {Atom[]} */
	const atoms = [];
	/** @type {Map<string, string>} entity id → description */
	const entities = new Map();
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith('_entity.id')) {
			// a single entity, written as key/value pairs
			const id = lines[i].split(/\s+/)[1];
			for (let j = i; j < i + 12; j++)
				if (lines[j].startsWith('_entity.pdbx_description'))
					entities.set(id, tokens(lines[j]).slice(1).join(' '));
		}
		if (lines[i] !== 'loop_') continue;
		const cols = [];
		let j = i + 1;
		while (lines[j]?.startsWith('_')) cols.push(lines[j++].trim());
		if (cols[0]?.startsWith('_entity.')) {
			const id = cols.indexOf('_entity.id');
			const desc = cols.indexOf('_entity.pdbx_description');
			let buf = [];
			for (; j < lines.length && !lines[j].startsWith('#'); j++) {
				if (lines[j].startsWith(';')) continue;
				buf = buf.concat(tokens(lines[j]));
				if (buf.length >= cols.length) {
					entities.set(buf[id], buf[desc]);
					buf = [];
				}
			}
		}
		if (!cols[0]?.startsWith('_atom_site.')) continue;
		const c = (name) => cols.indexOf(`_atom_site.${name}`);
		const iGroup = c('group_PDB');
		const iEl = c('type_symbol');
		const iX = c('Cartn_x');
		const iY = c('Cartn_y');
		const iZ = c('Cartn_z');
		const iChain = c('auth_asym_id');
		const iRes = c('label_comp_id');
		const iName = c('label_atom_id');
		const iEnt = c('label_entity_id');
		const iModel = c('pdbx_PDB_model_num');
		const iSeq = c('auth_seq_id');
		for (; j < lines.length && !lines[j].startsWith('#'); j++) {
			const t = tokens(lines[j]);
			if (t.length < cols.length) continue;
			if (iModel >= 0 && t[iModel] !== '1') continue;
			atoms.push({
				el: t[iEl].toUpperCase(),
				x: Number(t[iX]),
				y: Number(t[iY]),
				z: Number(t[iZ]),
				chain: t[iChain],
				res: t[iRes],
				name: t[iName]?.replace(/"/g, ''),
				entity: t[iEnt],
				seq: iSeq >= 0 ? Number(t[iSeq]) : undefined,
				het: t[iGroup] === 'HETATM'
			});
		}
		break;
	}
	return { atoms, entities };
}

/** Atoms of an SDF/MOL file (first record). */
export function readSdf(path) {
	const lines = text(path).split('\n');
	const n = Number(lines[3].slice(0, 3));
	/** @type {Atom[]} */
	const atoms = [];
	for (let i = 4; i < 4 + n; i++) {
		const l = lines[i];
		atoms.push({
			el: l.slice(31, 34).trim().toUpperCase(),
			x: Number(l.slice(0, 10)),
			y: Number(l.slice(10, 20)),
			z: Number(l.slice(20, 30)),
			chain: 'A',
			res: 'LIG',
			het: true
		});
	}
	return atoms;
}
