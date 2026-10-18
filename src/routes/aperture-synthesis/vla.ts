// The 27 pads of the Very Large Array's D configuration, in metres east, north and up of the
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
	{ name: 'W01', e: 0, n: 0, u: 0 },
	{ name: 'W02', e: -40.6, n: 14.8, u: 0.1 },
	{ name: 'W03', e: -78, n: -10.4, u: 0.1 },
	{ name: 'W04', e: -125.5, n: -42.5, u: 0.1 },
	{ name: 'W05', e: -182.7, n: -81.1, u: 0.2 },
	{ name: 'W06', e: -248.5, n: -125.4, u: 0.3 },
	{ name: 'W07', e: -322.6, n: -175.4, u: 0.4 },
	{ name: 'W08', e: -404.8, n: -230.8, u: 0.5 },
	{ name: 'W09', e: -494.6, n: -291.5, u: 0.6 },
	{ name: 'E01', e: 3.5, n: -39.9, u: 0 },
	{ name: 'E02', e: 37.2, n: 20.9, u: 0 },
	{ name: 'E03', e: 78, n: 1.8, u: 0 },
	{ name: 'E04', e: 130.1, n: -22.5, u: 0 },
	{ name: 'E05', e: 192.3, n: -51.5, u: 0 },
	{ name: 'E06', e: 264.3, n: -85, u: 0 },
	{ name: 'E07', e: 345.4, n: -122.8, u: -0.4 },
	{ name: 'E08', e: 435.2, n: -164.7, u: -1 },
	{ name: 'E09', e: 533.4, n: -210.5, u: -1.6 },
	{ name: 'N01', e: -3.5, n: 39.8, u: 0 },
	{ name: 'N02', e: -8.3, n: 94.5, u: -0.1 },
	{ name: 'N03', e: -11.8, n: 134.3, u: -0.2 },
	{ name: 'N04', e: -15.2, n: 174.2, u: -0.3 },
	{ name: 'N05', e: -20.5, n: 233.9, u: -0.4 },
	{ name: 'N06', e: -26.7, n: 305.2, u: -0.6 },
	{ name: 'N07', e: -33.7, n: 385.5, u: -0.7 },
	{ name: 'N08', e: -41.5, n: 474.5, u: -0.9 },
	{ name: 'N09', e: -50.1, n: 571.9, u: -1.1 }
];
