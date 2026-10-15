#!/usr/bin/env node
/**
 * Builds `src/routes/stars/tracks.ts`: stellar evolution tracks at solar metallicity from MIST.
 *
 *   node scripts/data/stars/build-tracks.mjs path/to/MIST_v1.2_feh_p0.00_afe_p0.0_vvcrit0.4_EEPS
 *
 * Source: MIST (MESA Isochrones & Stellar Tracks) v1.2, Choi et al. 2016, ApJ 823, 102;
 * Dotter 2016, ApJS 222, 8; computed with MESA (Paxton et al. 2011–2015). Grid
 * [Fe/H] = 0, [α/Fe] = 0, rotating at v/v_crit = 0.4 (the MIST default), EEP tracks:
 * https://mist.science/data/tarballs_v1.2/MIST_v1.2_feh_p0.00_afe_p0.0_vvcrit0.4_EEPS.txz
 * (112 MB; not kept in the repository). MIST is released for free use with citation
 * (https://mist.science/).
 *
 * Subset:
 * - `tracks`: nine initial masses (0.5, 1, 2, 3, 5, 12, 15, 20, 30 M☉), each from the zero-age
 *   main sequence (EEP 202) to the end of the track: the white-dwarf cooling track for ≤ 5 M☉
 *   (EEP 1710), the end of core carbon burning for the massive ones (EEP 808), the terminal-age
 *   main sequence for 0.5 M☉ (EEP 454, at 96 Gyr, where its core hydrogen runs out). Between consecutive primary EEPs the
 *   points are thinned evenly to the counts in SEGMENTS (always keeping the primary EEPs), so
 *   the thermal pulses on the AGB are smoothed away. Columns, rounded to 4 significant
 *   figures (age to 7): age (yr), current mass `M` (M☉), log L, log Teff, log R, helium- and carbon-core masses
 *   (M☉), central mass fractions of H, He, C, O and Ne, log central temperature and density,
 *   log of the luminosity from hydrogen burning, helium burning and heavier burning (L☉),
 *   and the MIST phase code (0 MS, 2 giant branch, 3 core He burning, 4 early AGB,
 *   5 thermally pulsing AGB, 6 post-AGB / white dwarf, 9 Wolf–Rayet).
 * - `grid`: for every track of 0.1–100 M☉ in the grid, the zero-age (EEP 202) and terminal-age
 *   (EEP 454) main-sequence points (age, log L, log Teff, log R) and the log luminosities of
 *   the pp chain and the CNO cycle halfway through the main sequence (EEP 353).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: build-tracks.mjs <MIST EEPS directory>');
const OUT = path.resolve(import.meta.dirname, '../../../src/routes/stars/tracks.ts');

const MASSES = [0.5, 1, 2, 3, 5, 12, 15, 20, 30];
/** Primary EEPs (1-based row numbers) and how many points to keep between each pair. */
const SEGMENTS = [
	[202, 353, 40], // first half of the main sequence
	[353, 454, 40], // second half, to hydrogen exhaustion
	[454, 605, 45], // subgiant and red giant branch, to the tip
	[605, 631, 12], // helium ignition, to the zero-age core-helium-burning point
	[631, 707, 40], // core helium burning
	[707, 808, 30], // early AGB (massive stars: carbon burning)
	[808, 1409, 20], // thermally pulsing AGB (pulses smoothed away)
	[1409, 1710, 30] // post-AGB and white-dwarf cooling
];

function read(file) {
	const lines = readFileSync(file, 'utf8').split('\n');
	const head = lines
		.find((l) => l.includes('star_age'))
		.replace('#', '')
		.trim()
		.split(/\s+/);
	const rows = lines.filter((l) => l.trim() && !l.startsWith('#'));
	return rows.map((l) => {
		const v = l.trim().split(/\s+/).map(Number);
		return Object.fromEntries(head.map((h, i) => [h, v[i]]));
	});
}
const fileFor = (m) => path.join(dir, `${String(Math.round(m * 100)).padStart(5, '0')}M.track.eep`);
const sig = (v, n = 4) => (v === 0 ? 0 : Number(v.toPrecision(n)));
/** Log luminosities below 10⁻⁹⁹ come out as −99 in MIST: keep them as −99. */
const lg = (v) => (v < -90 ? -99 : sig(v));

const COLUMNS = {
	age: (r) => sig(r.star_age, 7),
	M: (r) => sig(r.star_mass),
	logL: (r) => sig(r.log_L),
	logT: (r) => sig(r.log_Teff),
	logR: (r) => sig(r.log_R),
	heCore: (r) => sig(r.he_core_mass),
	cCore: (r) => sig(r.c_core_mass),
	xH: (r) => sig(Math.max(0, r.center_h1)),
	xHe: (r) => sig(Math.max(0, r.center_he4)),
	xC: (r) => sig(Math.max(0, r.center_c12)),
	xO: (r) => sig(Math.max(0, r.center_o16)),
	xNe: (r) => sig(Math.max(0, r.center_ne20)),
	logTc: (r) => sig(r.log_center_T),
	logRhoc: (r) => sig(r.log_center_Rho),
	logLH: (r) => lg(r.log_LH),
	logLHe: (r) => lg(r.log_LHe),
	logLZ: (r) => lg(r.log_LZ),
	phase: (r) => r.phase
};

function pick(rows) {
	const keep = new Set();
	for (const [a, b, n] of SEGMENTS) {
		if (a > rows.length) break;
		const end = Math.min(b, rows.length);
		for (let k = 0; k <= n; k++) keep.add(Math.round(a + ((end - a) * k) / n));
	}
	return [...keep].sort((x, y) => x - y).map((eep) => rows[eep - 1]);
}

const tracks = MASSES.map((m) => {
	const rows = read(fileFor(m));
	const kept = pick(rows);
	const cols = Object.fromEntries(
		Object.entries(COLUMNS).map(([k, f]) => [k, kept.map((r) => f(r))])
	);
	return { initial: m, eeps: rows.length, ...cols };
});

const names = ['zams', 'midMS', 'tams', 'rgbTip', 'zachb', 'tachb', 'tpagb', 'postAgb', 'end'];
const stages = {};
let at = 0;
SEGMENTS.forEach(([, , n], k) => {
	stages[names[k]] = at;
	at += n;
});
stages[names[SEGMENTS.length]] = at;

const files = readdirSync(dir).filter((f) => f.endsWith('.track.eep'));
const grid = files
	.map((f) => Number(f.slice(0, 5)) / 100)
	.filter((m) => m <= 100)
	.sort((a, b) => a - b)
	.flatMap((m) => {
		const rows = read(fileFor(m));
		if (rows.length < 454) return [];
		const z = rows[201];
		const mid = rows[352];
		const t = rows[453];
		return [
			{
				mass: m,
				zams: [sig(z.star_age, 7), sig(z.log_L), sig(z.log_Teff), sig(z.log_R)],
				tams: [sig(t.star_age, 7), sig(t.log_L), sig(t.log_Teff), sig(t.log_R)],
				midPp: lg(mid.pp),
				midCno: lg(mid.cno)
			}
		];
	});

const header = readFileSync(import.meta.filename, 'utf8').match(/\/\*\*[\s\S]*?\*\//)[0];
const body = `${header.replace('Builds `src/routes/stars/tracks.ts`', 'Generated by `scripts/data/stars/build-tracks.mjs`')}
// Generated file: do not edit by hand.

export const tracks = ${JSON.stringify(tracks)} as const;

export const grid = ${JSON.stringify(grid)} as const;

/** Row index of each primary EEP in the thinned tracks (the same in every track that reaches it). */
export const stages = ${JSON.stringify(stages)} as const;
`;
writeFileSync(OUT, body);
console.log(
	'wrote',
	OUT,
	tracks.map((t) => `${t.initial}: ${t.age.length}`).join(', '),
	'grid',
	grid.length,
	`${(body.length / 1024).toFixed(0)} KB`
);
