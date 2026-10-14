#!/usr/bin/env node
/**
 * Builds the measured data behind the carbon-polymers explainer:
 *
 *   node scripts/data/carbon-polymers/build.mjs <cache dir>
 *
 * 1. compounds.ts — for every molecule the builder can make (`allBuilds()` in
 *    src/routes/carbon-polymers/molecule.ts) plus a few extra molecules the page shows
 *    (isomer pairs, the n-alkanes C1–C44, a drug, a sugar, an amino acid):
 *    - PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug), SMILES → CID, InChI,
 *      InChIKey, molecular formula and computed IUPAC name (public domain, NCBI);
 *    - the NIST Chemistry WebBook (https://webbook.nist.gov, SRD 69, Linstrom & Mallard eds.,
 *      © U.S. Secretary of Commerce), looked up BY InChI, phase-change data in SI units: the
 *      normal boiling point Tboil and the melting point Tfus (K). The WebBook's critically
 *      evaluated average (AVG row, compiled by NIST/TRC) is used where there is one; otherwise
 *      the median of the individual measurements, but only if there are at least two and they
 *      agree within SPREAD = 3 K (single or scattered old values, such as the boiling points
 *      of long alkanes that decompose first, are left out). Where there is no Tfus, Ttriple is
 *      used (it lies within a fraction of
 *      a kelvin of the normal melting point), flagged `tmTriple`. A value is accepted only if
 *      the page's own IUPAC Standard InChIKey equals PubChem's, so isomers (same formula) can't
 *      be mixed up. No value is interpolated: a molecule without one shows none.
 * 2. geometry.ts — experimental geometries from NIST CCCBDB (Computational Chemistry
 *    Comparison and Benchmark DataBase, SRD 101, Release 22, May 2022,
 *    https://cccbdb.nist.gov/expgeom2x.asp): the internal coordinates (bond lengths in Å,
 *    angles in degrees) of small parent molecules, and the Cartesian coordinates of
 *    bromochlorofluoromethane (CHFClBr).
 *
 * Downloads are cached in the given directory (outside the repository).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { allBuilds, key, smiles } from '../../../src/routes/carbon-polymers/molecule.ts';

const cache = process.argv[2];
if (!cache) {
	console.error('usage: node scripts/data/carbon-polymers/build.mjs <cache dir>');
	process.exit(1);
}
fs.mkdirSync(cache, { recursive: true });
const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'src/routes/carbon-polymers');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cached(name, fetcher) {
	// Hashed: SMILES differ only in case or punctuation (C=C, C#C; c1ccccc1, C1CCCCC1).
	const file = path.join(cache, createHash('sha1').update(name).digest('hex'));
	if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
	const text = await fetcher();
	fs.writeFileSync(file, text);
	await sleep(350);
	return text;
}

// ---------------------------------------------------------------- PubChem

async function pubchem(smi) {
	const text = await cached(`pc-${smi}.json`, async () => {
		for (let attempt = 0; ; attempt++) {
			const res = await fetch(
				'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/IUPACName,InChIKey,InChI,MolecularFormula/JSON',
				{ method: 'POST', body: new URLSearchParams({ smiles: smi }) }
			);
			if (res.ok) return res.text();
			// PubChem asks clients to back off when busy (503/502): retry a few times.
			if (res.status < 500 || attempt >= 4) throw new Error(`PubChem ${res.status} for ${smi}`);
			await sleep(2000 * (attempt + 1));
		}
	});
	const p = JSON.parse(text).PropertyTable.Properties[0];
	return {
		cid: p.CID,
		inchi: p.InChI,
		inchikey: p.InChIKey,
		formula: p.MolecularFormula,
		iupac: p.IUPACName
	};
}

// ---------------------------------------------------------------- NIST WebBook

const strip = (s) =>
	s
		.replace(/<[^>]+>/g, '')
		.replace(/&plusmn;/g, '±')
		.replace(/\s+/g, ' ')
		.trim();

/** Largest disagreement (K) between individual NIST values that are still used (median). */
const SPREAD = 3;

function median(xs) {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const KEY = /IUPAC Standard InChIKey:<\/strong>\s*<span class="inchi-text">([A-Z-]+)</;

async function nist(inchi, inchikey, iupac) {
	const get = (name, query) =>
		cached(name, async () => {
			const res = await fetch(`https://webbook.nist.gov/cgi/cbook.cgi?${query}&Units=SI&cTP=on`);
			return res.text();
		});
	let html = await get(`nist-${inchikey}.html`, `InChI=${encodeURIComponent(inchi)}`);
	// An InChI that matches several entries gives a list: try PubChem's name instead (the
	// InChIKey check below still decides whether the entry is the right molecule).
	if (!KEY.test(html))
		html = await get(`nist-name-${inchikey}.html`, `Name=${encodeURIComponent(iupac)}`);
	const key = KEY.exec(html);
	if (!key) return null; // not in the WebBook
	if (key[1] !== inchikey) throw new Error(`NIST InChIKey ${key[1]} ≠ PubChem ${inchikey}`);
	const title = strip(/<title>([^<]*)/.exec(html)?.[1] ?? '');
	const rows = {};
	for (const r of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
		const cells = [...r[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => strip(c[1]));
		if (!['Tboil', 'Tfus', 'Ttriple'].includes(cells[0]) || cells[2] !== 'K') continue;
		const v = parseFloat(cells[1]);
		if (!Number.isFinite(v)) continue;
		(rows[cells[0]] ??= []).push({ v, avg: cells[3] === 'AVG' });
	}
	const pick = (q) => {
		const list = rows[q];
		if (!list?.length) return null;
		const avg = list.find((x) => x.avg);
		if (avg) return avg.v;
		// No average: only when two or more measurements agree within SPREAD kelvin.
		const vs = list.map((x) => x.v);
		if (vs.length < 2 || Math.max(...vs) - Math.min(...vs) > SPREAD) return null;
		return Math.round(median(vs) * 100) / 100;
	};
	const tfus = pick('Tfus');
	const ttriple = pick('Ttriple');
	return {
		title,
		tb: pick('Tboil'),
		tm: tfus ?? ttriple,
		tmTriple: tfus == null && ttriple != null
	};
}

// ---------------------------------------------------------------- compounds

/** Molecules shown on the page that the builder can't make. */
const EXTRA = {
	'dimethyl ether': 'COC',
	ethanol: 'CCO',
	isobutane: 'CC(C)C',
	butane: 'CCCC',
	ibuprofen: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O',
	glucose: 'C(C1C(C(C(C(O1)O)O)O)O)O',
	alanine: 'CC(C(=O)O)N',
	isoprene: 'CC(=C)C=C',
	bromochlorofluoromethane: 'FC(Cl)Br'
};
const ALKANE_MAX = 44;

const compounds = {};
const builds = {};
const extras = {};
const alkanes = [];

async function record(smi) {
	const pc = await pubchem(smi);
	if (!compounds[pc.inchikey]) {
		const n = await nist(pc.inchi, pc.inchikey, pc.iupac);
		compounds[pc.inchikey] = {
			cid: pc.cid,
			iupac: pc.iupac,
			formula: pc.formula,
			...(n?.tb != null ? { tb: n.tb } : {}),
			...(n?.tm != null ? { tm: n.tm } : {}),
			...(n?.tmTriple ? { tmTriple: true } : {}),
			...(n ? { nist: n.title } : {})
		};
	}
	return pc.inchikey;
}

for (const b of allBuilds()) builds[key(b)] = await record(smiles(b));
for (const [label, smi] of Object.entries(EXTRA)) extras[label] = await record(smi);
for (let n = 1; n <= ALKANE_MAX; n++) {
	const k = await record('C'.repeat(n));
	const c = compounds[k];
	alkanes.push({ n, ...(c.tb != null ? { tb: c.tb } : {}), ...(c.tm != null ? { tm: c.tm } : {}) });
}

const header = `/**
 * GENERATED by scripts/data/carbon-polymers/build.mjs — do not edit by hand.
 *
 * Names, formulas and identifiers: PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov),
 * NCBI, public domain. Boiling (tb) and melting (tm) points in kelvin, at 1 atm: NIST
 * Chemistry WebBook, SRD 69 (https://webbook.nist.gov, phase-change data, retrieved
 * ${new Date().toISOString().slice(0, 10)}), looked up by InChI and accepted only when NIST's
 * InChIKey matches PubChem's. tm is NIST's Tfus, or its triple-point temperature where it
 * lists no Tfus (tmTriple). NIST/TRC averages (AVG rows) where given; otherwise the median of at
 * least two individual values that agree within 3 K; otherwise no value.
 */
`;
const lines = [
	header,
	'export interface Compound {',
	'\tcid: number;',
	'\t/** PubChem computed IUPAC name. */',
	'\tiupac: string;',
	'\tformula: string;',
	'\ttb?: number;',
	'\ttm?: number;',
	'\ttmTriple?: true;',
	'\t/** Title of the NIST WebBook entry the values come from. */',
	'\tnist?: string;',
	'}',
	'',
	'/** By InChIKey. */',
	`export const COMPOUNDS: Record<string, Compound> = ${JSON.stringify(compounds, null, '\t')};`,
	'',
	'/** Builder state (`key()` in molecule.ts) → InChIKey. */',
	`export const BUILDS: Record<string, string> = ${JSON.stringify(builds, null, '\t')};`,
	'',
	'/** Other molecules on the page → InChIKey. */',
	`export const EXTRAS: Record<string, string> = ${JSON.stringify(extras, null, '\t')};`,
	'',
	`/** The n-alkanes CₙH₂ₙ₊₂, n = 1–${ALKANE_MAX}: NIST boiling and melting points (K). */`,
	`export const ALKANES: { n: number; tb?: number; tm?: number }[] = ${JSON.stringify(alkanes)};`,
	''
];
fs.writeFileSync(path.join(OUT, 'compounds.ts'), lines.join('\n'));

// ---------------------------------------------------------------- CCCBDB geometries

const GEOMETRY = {
	methane: 74828,
	ethane: 74840,
	ethylene: 74851,
	acetylene: 74862,
	propane: 74986,
	benzene: 71432,
	methanol: 67561,
	formaldehyde: 50000,
	'formic acid': 64186,
	methylamine: 74895,
	'methyl chloride': 74873,
	bromochlorofluoromethane: 593986,
	chlorofluoromethane: 593704
};
const geometry = {};
const cartesian = {};
for (const [label, cas] of Object.entries(GEOMETRY)) {
	const html = await cached(`cccbdb-${cas}.html`, async () => {
		const res = await fetch(`https://cccbdb.nist.gov/expgeom2x.asp?casno=${cas}&charge=0`);
		return res.text();
	});
	const text = strip(html);
	const i = text.indexOf('Internal coordinates');
	const j = text.indexOf('Bond descriptions');
	if (i < 0 || j < 0) throw new Error(`CCCBDB: no geometry for ${label}`);
	const coords = [];
	for (const m of text.slice(i, j).matchAll(/\b([ra])([A-Z][a-z]?(?:[A-Z][a-z]?){1,2}) ([\d.]+) /g))
		coords.push({ kind: m[1] === 'r' ? 'length' : 'angle', atoms: m[2], value: +m[3] });
	geometry[label] = { cas, coords };
	if (label === 'bromochlorofluoromethane' || label === 'chlorofluoromethane') {
		const k = text.indexOf('Atom x');
		const seg = text.slice(k, text.indexOf('Atom - Atom', k));
		cartesian[label] = [
			...seg.matchAll(/\b([A-Z][a-z]?)\d+ (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g)
		].map((m) => ({ el: m[1], xyz: [+m[2], +m[3], +m[4]] }));
	}
}
const geo = [
	`/**
 * GENERATED by scripts/data/carbon-polymers/build.mjs — do not edit by hand.
 *
 * Experimental geometries from NIST CCCBDB (Computational Chemistry Comparison and Benchmark
 * DataBase, NIST SRD 101, Release 22, May 2022, https://cccbdb.nist.gov/expgeom2x.asp,
 * retrieved ${new Date().toISOString().slice(0, 10)}). Lengths in ångström (1 Å = 100 pm),
 * angles in degrees; each molecule by CAS number. CCCBDB cites the original measurements
 * (mostly microwave spectroscopy and electron diffraction) for every value.
 */
`,
	'export interface Coord {',
	"\tkind: 'length' | 'angle';",
	'\t/** The atoms, e.g. "CC", "HCH". */',
	'\tatoms: string;',
	'\tvalue: number;',
	'}',
	`export const GEOMETRY: Record<string, { cas: number; coords: Coord[] }> = ${JSON.stringify(geometry, null, '\t')};`,
	'',
	'/** Bromochlorofluoromethane, Cartesian coordinates (Å). */',
	`export const CHFCLBR: { el: string; xyz: [number, number, number] }[] = ${JSON.stringify(cartesian.bromochlorofluoromethane)};`,
	'/** Chlorofluoromethane, Cartesian coordinates (Å). */',
	`export const CH2FCL: { el: string; xyz: [number, number, number] }[] = ${JSON.stringify(cartesian.chlorofluoromethane)};`,
	''
];
fs.writeFileSync(path.join(OUT, 'geometry.ts'), geo.join('\n'));
console.log(
	`${Object.keys(compounds).length} compounds, ${Object.values(compounds).filter((c) => c.tb).length} with a boiling point`
);
