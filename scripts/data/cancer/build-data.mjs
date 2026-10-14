#!/usr/bin/env node
/**
 * Builds `src/routes/cancer/data.ts`: the real data the "Cancer" explainer draws.
 *
 *   node scripts/data/cancer/build-data.mjs <download-dir>
 *
 * <download-dir> holds these downloads (not committed):
 *
 *   "Incidence Rates by Age at Diagnosis, November 2024.xlsx"
 *       SEER*Explorer data archive, November 2024 SEER submission (April 2025 release), from
 *       https://seer.cancer.gov/statistics-network/explorer/archive.html
 *       (https://seer.cancer.gov/archive/seer_explorer/Nov2024/Incidence%20Rates%20by%20Age%20at%20Diagnosis,%20November%202024.xlsx).
 *       One sheet per cancer site. We keep the rows with
 *         Years of Diagnosis = 2018-2022, Rate Type = Observed SEER Incidence Rate,
 *         Sex = Both Sexes, Race/Ethnicity = All Races / Ethnicities, Stage = All Stages
 *       and take, per five-year age band, the rate per 100,000 people per year and the number of
 *       cases. Bands SEER suppresses ('-', too few cases) are dropped. The open band "90+" is
 *       kept in the file but has no midpoint, so the page does not plot or fit it.
 *       SEER data are produced by the US National Cancer Institute and are in the public
 *       domain; SEER asks to be cited: SEER*Explorer, Surveillance Research Program, National
 *       Cancer Institute, 2025, https://seer.cancer.gov/statistics-network/explorer/.
 *       Things to know when reading them (written on the page): rates for 50–54 are pushed up
 *       by screening, which in the US starts at 45–50 and finds tumours earlier; 2020 had fewer
 *       diagnoses (COVID-19); above about 85 rates flatten, partly because fewer old people are
 *       examined. The fit on the page uses the bands 30–34 to 75–79.
 *
 *   NM_004985.5.gb
 *       NCBI RefSeq record of the human KRAS mRNA (transcript variant b), GenBank format:
 *       https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NM_004985.5&rettype=gb&retmode=text
 *       We keep the first 20 codons of the coding sequence (CDS 191..757) and check them
 *       against the record's /translation. NCBI sequence records are in the public domain.
 *
 * Only Node built-ins: the .xlsx (a zip of XML files) is read with zlib.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const RAW = process.argv[2];
if (!RAW) {
	console.error('usage: build-data.mjs <download-dir>');
	process.exit(1);
}
const OUT = resolve(import.meta.dirname, '../../../src/routes/cancer/data.ts');

// ------------------------------------------------------------------ a minimal .xlsx reader

/** The files of a zip archive (stored or deflated entries), by name. */
function unzip(buf) {
	// End of central directory record: the last 0x06054b50 signature.
	let eocd = buf.length - 22;
	while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
	if (eocd < 0) throw new Error('not a zip file');
	const count = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	const files = new Map();
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
		const method = buf.readUInt16LE(p + 10);
		const size = buf.readUInt32LE(p + 20);
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		const local = buf.readUInt32LE(p + 42);
		const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
		const lNameLen = buf.readUInt16LE(local + 26);
		const lExtraLen = buf.readUInt16LE(local + 28);
		const start = local + 30 + lNameLen + lExtraLen;
		const data = buf.subarray(start, start + size);
		files.set(name, () => (method === 0 ? data : inflateRawSync(data)).toString('utf8'));
		p += 46 + nameLen + extraLen + commentLen;
	}
	return files;
}

const unescape = (s) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');

/** Sheet name → rows (column letter → cell text). */
function readXlsx(path) {
	const zip = unzip(readFileSync(path));
	const shared = [];
	const ssx = zip.get('xl/sharedStrings.xml')?.() ?? '';
	for (const si of ssx.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
		shared.push(unescape([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('')));
	}
	const wb = zip.get('xl/workbook.xml')();
	const names = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => unescape(m[1]));
	const sheets = new Map();
	names.forEach((name, i) => {
		const xml = zip.get(`xl/worksheets/sheet${i + 1}.xml`)?.();
		if (!xml) return;
		const rows = [];
		for (const r of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
			const row = {};
			for (const c of r.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
				const [, col, attrs, inner = ''] = c;
				const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
				const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
				row[col] = / t="s"/.test(attrs) ? shared[Number(v)] : unescape(v ?? t ?? '');
			}
			rows.push(row);
		}
		sheets.set(name, rows);
	});
	return sheets;
}

// ------------------------------------------------------------------ SEER, incidence by age

const SITES = [
	{ id: 'colorectal', sheet: 'Colon & Rectum (incl Appendix)', label: 'Colon and rectum' },
	{ id: 'pancreas', sheet: 'Pancreas', label: 'Pancreas' },
	{ id: 'all', sheet: 'All Cancer Sites Combined', label: 'All cancers combined' },
	{
		id: 'all-leukaemia',
		sheet: 'Acute Lymphocytic Leuk (ALL)',
		label: 'Acute lymphoblastic leukaemia'
	}
];
const sheets = readXlsx(join(RAW, 'Incidence Rates by Age at Diagnosis, November 2024.xlsx'));
const seer = [];
for (const site of SITES) {
	const rows = sheets.get(site.sheet);
	if (!rows) throw new Error(`no sheet ${site.sheet}`);
	const header = rows.findIndex((r) => r.A === 'Cancer Site');
	const keep = rows
		.slice(header + 1)
		.filter(
			(r) =>
				r.B === '2018-2022' &&
				r.C === 'Observed SEER Incidence Rate' &&
				r.D === 'Both Sexes' &&
				r.E === 'All Races / Ethnicities' &&
				r.F === 'All Stages'
		);
	if (keep.length !== 20) throw new Error(`${site.sheet}: ${keep.length} age bands, expected 20`);
	const bands = [];
	for (const r of keep) {
		if (r.H === '-' || r.H === undefined) continue;
		const age = r.G.replace(/\s/g, '');
		const m = age.match(/^(\d+)-(\d+)$/);
		bands.push({
			age,
			// Midpoint of the band in years (a 5-year band a–b covers ages a to b + 1).
			mid: m ? (Number(m[1]) + Number(m[2]) + 1) / 2 : null,
			rate: Number(Number(r.H).toPrecision(4)),
			cases: Number(r.L)
		});
	}
	seer.push({ id: site.id, label: site.label, bands });
}

// ------------------------------------------------------------------ KRAS

const gb = readFileSync(join(RAW, 'NM_004985.5.gb'), 'utf8');
const cds = gb.match(/^\s+CDS\s+(\d+)\.\.(\d+)/m);
if (!cds) throw new Error('no CDS in the KRAS record');
const translation = (gb.match(/\/translation="([^"]+)"/)?.[1] ?? '').replace(/\s+/g, '');
const mrna = gb
	.slice(gb.indexOf('\nORIGIN'))
	.replace(/[^acgt]/g, '')
	.toUpperCase();
const coding = mrna.slice(Number(cds[1]) - 1, Number(cds[2]));
if (coding.length / 3 !== translation.length + 1) throw new Error('KRAS CDS length mismatch');
const KRAS_CODONS = 20;
const krasStart = coding.slice(0, 3 * KRAS_CODONS);
const krasProtein = translation.slice(0, KRAS_CODONS);
if (krasStart.slice(33, 36) !== 'GGT' || krasProtein[11] !== 'G') {
	throw new Error('KRAS codon 12 is not GGT (Gly)');
}

// ------------------------------------------------------------------ write

const out = `/**
 * GENERATED by scripts/data/cancer/build-data.mjs — do not edit by hand.
 *
 * SEER incidence rates by age at diagnosis: SEER*Explorer data archive, November 2024 SEER
 * submission (April 2025 release), https://seer.cancer.gov/statistics-network/explorer/ —
 * diagnoses 2018–2022, observed rates per 100,000 people per year, both sexes, all races and
 * ethnicities, all stages. US National Cancer Institute data, public domain. Bands that SEER
 * suppresses (too few cases) are left out; \`mid\` is the middle of the band in years (null for
 * the open band 90+).
 *
 * KRAS: the first ${KRAS_CODONS} codons of the coding sequence of NCBI RefSeq NM_004985.5 (CDS
 * 191..757), which translate to ${krasProtein} (NP_004976.2). Public domain.
 *
 * Retrieved ${new Date().toISOString().slice(0, 10)}.
 */

export interface AgeBand {
	age: string;
	mid: number | null;
	/** New cases per 100,000 people per year. */
	rate: number;
	cases: number;
}

export interface SeerSite {
	id: string;
	label: string;
	bands: AgeBand[];
}

export const SEER_AGE: SeerSite[] = ${JSON.stringify(seer, null, '\t')};

/** KRAS coding strand, 5′→3′, codons 1–${KRAS_CODONS}. */
export const KRAS_START = '${krasStart}';
/** Its protein, one letter per amino acid. */
export const KRAS_PROTEIN = '${krasProtein}';
`;
writeFileSync(OUT, out);
console.log(`wrote ${OUT}`);
