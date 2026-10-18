#!/usr/bin/env node
// Builds the aperture-synthesis explainer's array layout (src/routes/aperture-synthesis/vla.ts)
// from the VLA D-configuration antenna file of the CASA simulator. No dependencies. Usage:
//
//   curl -sSL -o <raw-dir>/vla.d.cfg \
//     https://open-bitbucket.nrao.edu/projects/CASA/repos/casa-data/raw/alma/simmos/vla.d.cfg
//   node scripts/data/aperture-synthesis/build.mjs <raw-dir>/vla.d.cfg
//
// The file lists the 27 pads of the D configuration as geocentric (ITRF) X, Y, Z in metres, a
// dish diameter (25 m) and a pad name (W01…W09, E01…E09, N01…N09). The script turns each into
// local east, north and up, in metres, about the centroid of the three innermost pads (W01,
// E01, N01, where the arms meet), rotating by the VLA's geodetic latitude and longitude as NRAO
// publishes them (34°04′43.497″ N, 107°37′03.819″ W). Kept: east, north, up rounded to 0.1 m.
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
	console.error('usage: build.mjs <vla.d.cfg>');
	process.exit(1);
}

const pads = readFileSync(path, 'utf8')
	.split('\n')
	.filter((l) => l.trim() && !l.startsWith('#'))
	.map((l) => {
		const [x, y, z, d, name] = l.trim().split(/\s+/);
		return { name, x: Number(x), y: Number(y), z: Number(z), d: Number(d) };
	});
if (pads.length !== 27) throw new Error(`expected 27 pads, found ${pads.length}`);

const deg = Math.PI / 180;
const lat = (34 + 4 / 60 + 43.497 / 3600) * deg;
const lon = -(107 + 37 / 60 + 3.819 / 3600) * deg;
const inner = pads.filter((p) => ['W01', 'E01', 'N01'].includes(p.name));
const o = ['x', 'y', 'z'].map((k) => inner.reduce((s, p) => s + p[k], 0) / inner.length);

const sl = Math.sin(lat);
const cl = Math.cos(lat);
const so = Math.sin(lon);
const co = Math.cos(lon);
const r1 = (v) => Math.round(v * 10) / 10;
const enu = pads.map((p) => {
	const dx = p.x - o[0];
	const dy = p.y - o[1];
	const dz = p.z - o[2];
	return {
		name: p.name,
		e: r1(-so * dx + co * dy),
		n: r1(-sl * co * dx - sl * so * dy + cl * dz),
		u: r1(cl * co * dx + cl * so * dy + sl * dz)
	};
});

const out = `// The 27 pads of the Very Large Array's D configuration, in metres east, north and up of the
// point where the arms meet. Built by scripts/data/aperture-synthesis/build.mjs from vla.d.cfg of
// the CASA simulator's antenna configurations (NRAO casa-data repository, alma/simmos/vla.d.cfg,
// downloaded 2026-10-19; CASA is distributed under the GNU GPL). Pads W01–W09, E01–E09 and
// N01–N09 from the centre outwards; every dish is 25 m across.
export interface Pad {
	name: string;
	e: number;
	n: number;
	u: number;
}

export const VLA_D: readonly Pad[] = [
${enu.map((p) => `\t{ name: '${p.name}', e: ${p.e}, n: ${p.n}, u: ${p.u} }`).join(',\n')}
];
`;
writeFileSync(new URL('../../../src/routes/aperture-synthesis/vla.ts', import.meta.url), out);
console.log(`wrote ${enu.length} pads`);
