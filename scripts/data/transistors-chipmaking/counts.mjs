// Builds src/routes/transistors-chipmaking/counts.ts from Karl Rupp's microprocessor trend data.
// Usage: node scripts/data/transistors-chipmaking/counts.mjs <path to 50yrs/transistors.dat>
// Source: https://github.com/karlrupp/microprocessor-trend-data (file 50yrs/transistors.dat),
// CC BY 4.0. Values there are in thousands of transistors; this script multiplies by 1000,
// rounds the year to 0.01 and keeps 3 significant figures.
import fs from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('usage: counts.mjs <transistors.dat>');
const rows = fs
	.readFileSync(src, 'utf8')
	.split('\n')
	.map((l) => l.trim().split(/\s+/))
	.filter((p) => p.length === 2 && !p[0].startsWith('#'))
	.map(([y, k]) => [Math.round(Number(y) * 100) / 100, Number((Number(k) * 1000).toPrecision(3))]);
const body = rows.map(([y, n]) => `\t[${y}, ${n.toExponential(2).replace('+', '')}]`).join(',\n');
const out = `/**
 * Transistors per microprocessor, 1971–2021: Karl Rupp, "Microprocessor Trend Data"
 * (https://github.com/karlrupp/microprocessor-trend-data, file 50yrs/transistors.dat),
 * licensed CC BY 4.0. Data up to 2010 collected by M. Horowitz, F. Labonte, O. Shacham,
 * K. Olukotun, L. Hammond and C. Batten; data for 2010–2021 collected by K. Rupp (the
 * credits on Rupp's chart). Years are fractional, as in the file. The file gives thousands
 * of transistors (the chart's axis label); here they are multiplied by 1000, the year is
 * rounded to 0.01 and the count to 3 significant figures
 * (scripts/data/transistors-chipmaking/counts.mjs). Each entry: [year, transistors].
 */
export const COUNTS: readonly (readonly [number, number])[] = [
${body}
];
`;
fs.writeFileSync('src/routes/transistors-chipmaking/counts.ts', out);
console.log(rows.length, 'rows');
