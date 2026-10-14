#!/usr/bin/env node
/**
 * Builds `src/routes/greenhouse-effect/scenarios-data.ts`: the five illustrative
 * SSP scenarios of the IPCC's Sixth Assessment Report (AR6 WG1), 1750–2100,
 * and the observed global surface temperature, 1850–2020.
 *
 *   node scripts/data/greenhouse-effect/build-scenarios.mjs <dir with the downloads>
 *
 * Downloads (put them in one directory, outside the repository):
 *
 * 1. CO₂ emissions and concentrations, as used by CMIP6 and AR6, from the RCMIP
 *    protocol v5.1.0 (Nicholls et al. 2020, Geosci. Model Dev. 13, 5175,
 *    https://doi.org/10.5194/gmd-13-5175-2020):
 *    https://rcmip-protocols-au.s3-ap-southeast-2.amazonaws.com/v5.1.0/rcmip-emissions-annual-means-v5-1-0.csv
 *    https://rcmip-protocols-au.s3-ap-southeast-2.amazonaws.com/v5.1.0/rcmip-concentrations-annual-means-v5-1-0.csv
 *    They collect the CMIP6 input4MIPs datasets: harmonised SSP emissions
 *    (Gidden et al. 2019, GMD 12, 1443, https://doi.org/10.5194/gmd-12-1443-2019),
 *    historical emissions (CEDS / Global Carbon Project) and the SSP greenhouse-gas
 *    concentrations (Meinshausen et al. 2020, GMD 13, 3571,
 *    https://doi.org/10.5194/gmd-13-3571-2020), published under CC BY 4.0.
 *    The marker scenarios: SSP1-1.9 and SSP1-2.6 (IMAGE), SSP2-4.5
 *    (MESSAGE-GLOBIOM), SSP3-7.0 (AIM/CGE), SSP5-8.5 (REMIND-MAGPIE).
 * 2. Effective radiative forcing (ERF) of every agent, AR6 WG1 Chapter 7
 *    (Forster et al. 2021; data: C. Smith, IPCC-WG1/Chapter-7 repository,
 *    https://doi.org/10.5281/zenodo.5211357, MIT licence), best estimates:
 *    https://raw.githubusercontent.com/IPCC-WG1/Chapter-7/main/data_output/SSPs/ERF_ssp119_1750-2500.csv
 *    (and ssp126, ssp245, ssp370, ssp585)
 * 3. Observed global mean surface temperature (GMST), AR6 assessment, the
 *    consolidated 4-dataset mean relative to 1850–1900 (HadCRUT5, NOAAGlobalTemp,
 *    Berkeley Earth, Kadow et al.; AR6 WG1 Ch. 2, Cross-Chapter Box 2.3), from
 *    the same repository:
 *    https://raw.githubusercontent.com/IPCC-WG1/Chapter-7/main/data_input/observations/AR6%20FGD%20assessment%20time%20series%20-%20GMST%20and%20GSAT.xlsx
 *    Unzip the xlsx into a folder `gmst/` beside the other files (an xlsx is a
 *    zip archive; the script reads its XML directly, sheet "Consolidated time series").
 *
 * Subset: World totals only. Per year: CO₂ concentration (ppm, 1 decimal); total
 * CO₂ emissions, fossil + land use (GtCO₂/yr, 2 decimals; the scenarios give
 * values at 2015, 2020 and every ten years after, linearly interpolated here as
 * RCMIP's own annual means do); ERF of CO₂ and of everything else, total
 * natural + anthropogenic (W/m², 3 decimals). 1750–2014 is history, shared by
 * all scenarios (the files are identical there); 2015–2100 per scenario.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: build-scenarios.mjs <dir with the downloads>');
	process.exit(1);
}
const OUT = path.resolve(
	import.meta.dirname,
	'../../../src/routes/greenhouse-effect/scenarios-data.ts'
);
const SCENARIOS = ['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'];
const MARKERS = {
	ssp119: 'IMAGE',
	ssp126: 'IMAGE',
	ssp245: 'MESSAGE-GLOBIOM',
	ssp370: 'AIM/CGE',
	ssp585: 'REMIND-MAGPIE'
};
const Y0 = 1750;
const Y1 = 2100;
const SPLIT = 2015;

/** Rows of an RCMIP csv: (model, scenario, variable) → values by year, linearly interpolated. */
function rcmip(file, variable, unitScale) {
	const lines = readFileSync(path.join(dir, file), 'utf8').split('\n');
	const header = lines[0].split(',');
	const out = {};
	for (const line of lines.slice(1)) {
		const c = line.split(',');
		if (c[2] !== 'World' || c[3] !== variable) continue;
		const key = c[1] === 'historical' ? 'historical' : c[1];
		// the concentration file names AIM/CGE just "AIM"
		if (key !== 'historical' && MARKERS[key]?.split('/')[0] !== c[0].split('/')[0]) continue;
		const known = [];
		for (let y = Y0; y <= Y1; y++) {
			const s = c[header.indexOf(String(y))];
			if (s !== undefined && s !== '') known.push([y, Number(s) * unitScale]);
		}
		const values = [];
		for (let y = Y0; y <= Y1; y++) {
			const i = known.findIndex(([k]) => k >= y);
			if (i < 0) {
				values.push(NaN);
				continue;
			}
			const [ya, va] = known[Math.max(0, i - 1)];
			const [yb, vb] = known[i];
			values.push(yb === y || yb === ya ? vb : va + ((vb - va) * (y - ya)) / (yb - ya));
		}
		out[key] = values;
	}
	return out;
}

function erf(scenario) {
	const lines = readFileSync(path.join(dir, `ERF_${scenario}_1750-2500.csv`), 'utf8')
		.trim()
		.split('\n');
	const h = lines[0].split(',');
	const co2 = [];
	const other = [];
	for (const line of lines.slice(1)) {
		const c = line.split(',').map(Number);
		if (c[0] > Y1) break;
		co2.push(c[h.indexOf('co2')]);
		other.push(c[h.indexOf('total')] - c[h.indexOf('co2')]);
	}
	return { co2, other };
}

function gmst() {
	const g = path.join(dir, 'gmst/xl');
	const strings = [
		...readFileSync(path.join(g, 'sharedStrings.xml'), 'utf8').matchAll(/<si>(?:<t[^>]*>)([^<]*)/g)
	].map((m) => m[1]);
	// workbook order: sheet1 "GMST data sets and changes", sheet2 "Consolidated time series"
	const wb = readFileSync(path.join(g, 'workbook.xml'), 'utf8');
	if (!/<sheet name="Consolidated time series" sheetId="3" r:id="rId2"/.test(wb))
		throw new Error('unexpected workbook layout');
	const xml = readFileSync(path.join(g, 'worksheets/sheet2.xml'), 'utf8');
	const out = [];
	for (const row of xml.matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
		const cells = [
			...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v>/g)
		].map((m) => (/t="s"/.test(m[2]) ? strings[Number(m[3])] : Number(m[3])));
		if (typeof cells[0] === 'number' && typeof cells[1] === 'number')
			out.push([cells[0], cells[1]]);
	}
	return out;
}

const emissions = rcmip('rcmip-emissions-annual-means-v5-1-0.csv', 'Emissions|CO2', 1e-3);
const conc = rcmip(
	'rcmip-concentrations-annual-means-v5-1-0.csv',
	'Atmospheric Concentrations|CO2',
	1
);
const forcing = Object.fromEntries(SCENARIOS.map((s) => [s, erf(s)]));
const temps = gmst();

// ---- checks against published numbers
const n = SPLIT - Y0;
for (const s of SCENARIOS) {
	for (let i = 0; i < n; i++) {
		if (Math.abs(forcing[s].co2[i] - forcing.ssp245.co2[i]) > 1e-9)
			throw new Error('ERF history differs');
	}
}
const histEm = emissions.historical.slice(0, n);
const cum1850to2019 =
	histEm.slice(1850 - Y0).reduce((a, b) => a + b, 0) +
	emissions.ssp245.slice(n, 2019 - Y0 + 1).reduce((a, b) => a + b, 0);
// AR6 WG1 SPM D.1.2: 2390 ± 240 GtCO₂ emitted 1850–2019.
if (Math.abs(cum1850to2019 - 2390) > 240) throw new Error(`cumulative ${cum1850to2019}`);
const mean = (rows, a, b) => {
	const s = rows.filter(([y]) => y >= a && y <= b);
	return s.reduce((x, [, v]) => x + v, 0) / s.length;
};
// AR6 WG1 SPM A.1.2: 1.09 °C in 2011–2020 above 1850–1900.
if (Math.abs(mean(temps, 2011, 2020) - 1.09) > 0.01) throw new Error('GMST');
console.log(
	`cumulative CO₂ 1850–2019: ${cum1850to2019.toFixed(0)} GtCO₂; GMST 2011–2020: ${mean(temps, 2011, 2020).toFixed(3)} °C`
);

const fmt = (arr, d) => {
	const parts = arr.map((v) => {
		const r = Number(v.toFixed(d));
		return Object.is(r, -0) ? '0' : String(r);
	});
	const lines = [];
	for (let i = 0; i < parts.length; i += 14)
		lines.push('\t\t' + parts.slice(i, i + 14).join(', ') + ',');
	return '[\n' + lines.join('\n') + '\n\t]';
};

let ts = `/**
 * The five illustrative SSP scenarios of IPCC AR6 WG1, and the observed
 * temperature. GENERATED by scripts/data/greenhouse-effect/build-scenarios.mjs:
 * do not edit by hand. Sources, licences and how the subset was made: see
 * that script's header.
 *
 * - CO₂ concentrations: Meinshausen et al. (2020), GMD 13, 3571 (CMIP6 input4MIPs)
 * - CO₂ emissions (fossil + land use): Gidden et al. (2019), GMD 12, 1443 (SSP
 *   markers harmonised for CMIP6), historical CEDS / Global Carbon Project; both
 *   read from the RCMIP protocol v5.1.0 (Nicholls et al. 2020, GMD 13, 5175)
 * - Effective radiative forcing: AR6 WG1 Chapter 7 (Forster et al. 2021),
 *   best estimates, C. Smith, https://doi.org/10.5281/zenodo.5211357 (MIT licence)
 * - GMST: AR6 WG1 assessed 4-dataset mean, relative to 1850–1900
 */
export const FIRST_YEAR = ${Y0};
export const SPLIT_YEAR = ${SPLIT};
export const LAST_YEAR = ${Y1};

export interface SeriesData {
\t/** CO₂ in the air, ppm. */
\tppm: readonly number[];
\t/** CO₂ emissions from fossil fuels, industry and land use, GtCO₂ per year. */
\temissions: readonly number[];
\t/** Effective radiative forcing of CO₂, W/m² relative to 1750. */
\tco2: readonly number[];
\t/** ERF of everything else (other gases, aerosols, land use, the Sun, volcanoes), W/m². */
\tother: readonly number[];
}

/** ${Y0}–${SPLIT - 1}, shared by all scenarios. */
export const HISTORY: SeriesData = {
\tppm: ${fmt(conc.historical.slice(0, n), 1)},
\temissions: ${fmt(histEm, 2)},
\tco2: ${fmt(forcing.ssp245.co2.slice(0, n), 3)},
\tother: ${fmt(forcing.ssp245.other.slice(0, n), 3)}
};

/** ${SPLIT}–${Y1}, per scenario. */
export const FUTURE: Record<'${SCENARIOS.join("' | '")}', SeriesData> = {
`;
for (const s of SCENARIOS) {
	ts += `\t${s}: {
\t\tppm: ${fmt(conc[s].slice(n), 1).replaceAll('\n\t', '\n\t\t')},
\t\temissions: ${fmt(emissions[s].slice(n), 2).replaceAll('\n\t', '\n\t\t')},
\t\tco2: ${fmt(forcing[s].co2.slice(n), 3).replaceAll('\n\t', '\n\t\t')},
\t\tother: ${fmt(forcing[s].other.slice(n), 3).replaceAll('\n\t', '\n\t\t')}
\t},
`;
}
ts += `};

/** Observed global mean surface temperature, °C above 1850–1900, from ${temps[0][0]}. */
export const GMST_FIRST_YEAR = ${temps[0][0]};
export const GMST: readonly number[] = ${fmt(
	temps.map(([, v]) => v),
	3
)};
`;
writeFileSync(OUT, ts);
console.log(`wrote ${OUT} (${(ts.length / 1024).toFixed(0)} KB)`);
