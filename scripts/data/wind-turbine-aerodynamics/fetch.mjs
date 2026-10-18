// Downloads the NREL 5-MW reference turbine's AeroDyn blade table and airfoil polars from the
// OpenFAST r-test repository (Apache-2.0) into a directory given on the command line:
//   node scripts/data/wind-turbine-aerodynamics/fetch.mjs <raw-dir>
// Then build the model's data file with build.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: fetch.mjs <raw-dir>');
mkdirSync(dir, { recursive: true });

const BASE =
	'https://raw.githubusercontent.com/OpenFAST/r-test/main/glue-codes/openfast/5MW_Baseline/';
const files = [
	'NRELOffshrBsline5MW_AeroDyn_blade.dat',
	'README.rst',
	...['Cylinder1', 'Cylinder2', 'DU40_A17', 'DU35_A17', 'DU30_A17', 'DU25_A17', 'DU21_A17'].map(
		(f) => `Airfoils/${f}.dat`
	),
	'Airfoils/NACA64_A17.dat'
];
for (const f of files) {
	const res = await fetch(BASE + f);
	if (!res.ok) throw new Error(`${f}: ${res.status}`);
	writeFileSync(join(dir, f.split('/').pop() ?? f), await res.text());
	console.log('fetched', f);
}
const lic = await fetch('https://raw.githubusercontent.com/OpenFAST/r-test/main/LICENSE');
writeFileSync(join(dir, 'LICENSE'), await lic.text());
