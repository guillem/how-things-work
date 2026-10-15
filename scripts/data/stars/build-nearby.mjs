#!/usr/bin/env node
/**
 * Builds `src/routes/stars/nearby.ts`: temperature and luminosity of a sample of real stars
 * within 50 parsecs (163 light years) of the Sun, for the Hertzsprung–Russell diagram.
 *
 *   node scripts/data/stars/build-nearby.mjs gcns.csv wd.csv EEM_dwarf_UBVIJHK_colors_Teff.txt
 *
 * Sources:
 * - Gaia Catalogue of Nearby Stars (GCNS; Gaia Collaboration, Smart et al. 2021, A&A 649, A6),
 *   VizieR J/A+A/649/A6/table1c, from Gaia EDR3 photometry and parallaxes (ESA/Gaia/DPAC,
 *   CC BY-SA 3.0 IGO). Query (VizieR TAP): GaiaEDR3, Plx, Gmag, BPmag, RPmag, WDprob, GCNSprob
 *   WHERE Plx > 20 AND MOD(GaiaEDR3, 5) = 0 — every star within 50 pc whose Gaia source id is
 *   a multiple of 5, an unbiased one-in-five sample (8 162 rows).
 * - Gaia EDR3 white dwarfs (Gentile Fusillo et al. 2021, MNRAS 508, 3877), VizieR
 *   J/MNRAS/508/3877/maincat: GaiaEDR3, Plx, Pwd, TeffH, loggH, MassH WHERE Plx > 20 AND
 *   Pwd > 0.9 (fits with hydrogen atmospheres).
 * - E. Mamajek, "A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence",
 *   version 2022.04.16, https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt
 *   (Pecaut & Mamajek 2013, ApJS 208, 9).
 *
 * Method: for stars that are not white dwarfs (GCNS WDprob < 0.5, GCNSprob > 0.9), the
 * temperature and the bolometric correction BC_G = M_bol − M_G are interpolated in Mamajek's
 * table against the Gaia colour BP − RP, and L/L☉ = 10^((4.74 − M_G − BC_G)/2.5) with
 * M_G = G + 5 log₁₀(ϖ/100 mas). The table is a sequence of dwarfs, so the few giants get a
 * dwarf's colour–temperature relation (off by a couple of hundred kelvin); reddening is
 * neglected within 50 pc. Stars redder or bluer than the table (from B9V to M8V, where BP − RP stops increasing) are
 * left out. For white dwarfs
 * of the same one-in-five sample, R = √(GM/g) from the fitted mass and gravity, and
 * L = 4πR²σT⁴. Every third star of each list (in catalogue order) is kept, so the sample is
 * one star in fifteen within 50 pc. Of those, ordinary stars more than 1 dex (ten times) fainter
 * than the MIST zero-age main sequence at their temperature (from `tracks.ts`, held flat below
 * its coolest point, 0.1 M☉) are dropped: no star that is not a white dwarf can sit there, so
 * they are white dwarfs that missed the WDprob cut or faint sources with spurious BP − RP
 * colours, to which the dwarf colour–temperature relation does not apply (about 60 stars).
 * Values: log₁₀ Teff and log₁₀ L/L☉, rounded to 3 decimals.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { grid } from '../../../src/routes/stars/tracks.ts';

const [gcnsFile, wdFile, eemFile] = process.argv.slice(2);
if (!eemFile) throw new Error('usage: build-nearby.mjs gcns.csv wd.csv eem.txt');
const OUT = path.resolve(import.meta.dirname, '../../../src/routes/stars/nearby.ts');

function csv(file) {
	const [head, ...rows] = readFileSync(file, 'utf8').trim().split('\n');
	const keys = head.split(',');
	return rows.map((r) => {
		const v = r.split(',');
		return Object.fromEntries(
			keys.map((k, i) => [k, k === 'GaiaEDR3' ? v[i] : v[i] === '' ? NaN : Number(v[i])])
		);
	});
}

// Mamajek's table: the first block of rows, up to the line that closes it.
const eemLines = readFileSync(eemFile, 'utf8').split('\n');
const start = eemLines.findIndex((l) => l.startsWith('#SpT'));
const keys = eemLines[start].replace('#', '').trim().split(/\s+/);
const table = [];
for (let i = start + 1; i < eemLines.length && !eemLines[i].startsWith('#'); i++) {
	const v = eemLines[i].trim().split(/\s+/);
	if (v.length < keys.length - 1) continue;
	const row = Object.fromEntries(keys.map((k, j) => [k, Number(v[j])]));
	if (Number.isFinite(row['Bp-Rp']) && Number.isFinite(row.Mbol) && Number.isFinite(row.M_G))
		table.push({ c: row['Bp-Rp'], logT: Math.log10(row.Teff), bc: row.Mbol - row.M_G });
}
// The rows run from hot to cool; BP − RP stops increasing among the coolest M dwarfs (M8.5V),
// so the table is cut where it does.
const cut = table.findIndex((r, i) => i > 0 && !(r.c > table[i - 1].c));
if (cut > 0) table.length = cut;

function interp(c) {
	if (c < table[0].c || c > table[table.length - 1].c) return null;
	let i = 1;
	while (table[i].c < c) i++;
	const a = table[i - 1];
	const b = table[i];
	const u = (c - a.c) / (b.c - a.c);
	return { logT: a.logT + u * (b.logT - a.logT), bc: a.bc + u * (b.bc - a.bc) };
}

const stars = [];
for (const s of csv(gcnsFile)) {
	if (!(s.WDprob < 0.5) || !(s.GCNSprob > 0.9)) continue;
	const r = interp(s.BPmag - s.RPmag);
	if (!r || !Number.isFinite(s.Gmag)) continue;
	const MG = s.Gmag + 5 * Math.log10(s.Plx / 100);
	stars.push([Number(r.logT.toFixed(3)), Number(((4.74 - MG - r.bc) / 2.5).toFixed(3))]);
}
const third = (list) => list.filter((_, i) => i % 3 === 0);

// The zero-age main sequence as log L against log Teff, and the cut below it.
const ZAMS = grid.map((g) => [g.zams[2], g.zams[1]]).sort((a, b) => a[0] - b[0]);
function zamsLogL(logT) {
	if (logT <= ZAMS[0][0]) return ZAMS[0][1];
	for (let i = 1; i < ZAMS.length; i++) {
		const [t1, l1] = ZAMS[i];
		if (t1 >= logT) {
			const [t0, l0] = ZAMS[i - 1];
			return l0 + ((logT - t0) / (t1 - t0)) * (l1 - l0);
		}
	}
	return ZAMS[ZAMS.length - 1][1];
}
const plausible = ([logT, logL]) => logL >= zamsLogL(logT) - 1;

const G = 6.674e-11;
const MSUN = 1.98841e30;
const RSUN = 6.957e8;
const dwarfs = [];
for (const w of csv(wdFile)) {
	if (BigInt(w.GaiaEDR3) % 5n !== 0n) continue;
	if (!Number.isFinite(w.TeffH) || !Number.isFinite(w.MassH)) continue;
	const g = Math.pow(10, w.loggH) / 100; // cgs → m s⁻²
	const R = Math.sqrt((G * w.MassH * MSUN) / g) / RSUN;
	const logL = 2 * Math.log10(R) + 4 * Math.log10(w.TeffH / 5772);
	dwarfs.push([Number(Math.log10(w.TeffH).toFixed(3)), Number(logL.toFixed(3))]);
}

const header = readFileSync(import.meta.filename, 'utf8').match(/\/\*\*[\s\S]*?\*\//)[0];
writeFileSync(
	OUT,
	`${header.replace('Builds `src/routes/stars/nearby.ts`', 'Generated by `scripts/data/stars/build-nearby.mjs`')}
// Generated file: do not edit by hand.

/** [log₁₀ Teff (K), log₁₀ L/L☉] of stars that are not white dwarfs. */
export const NEARBY: readonly (readonly [number, number])[] = ${JSON.stringify(third(stars).filter(plausible))};

/** [log₁₀ Teff (K), log₁₀ L/L☉] of white dwarfs. */
export const NEARBY_WHITE_DWARFS: readonly (readonly [number, number])[] = ${JSON.stringify(third(dwarfs))};
`
);
console.log(
	'wrote',
	OUT,
	third(stars).filter(plausible).length,
	'stars,',
	third(dwarfs).length,
	'white dwarfs'
);
