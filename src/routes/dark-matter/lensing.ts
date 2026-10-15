/**
 * Weak gravitational lensing by the Bullet Cluster (1E 0657−558, z = 0.296):
 * a schematic mass model built from the published masses and positions, and
 * the distortion it imprints on the images of galaxies behind it.
 *
 * Data:
 * - Positions of the two brightest cluster galaxies and of the two X-ray gas
 *   peaks, and the stellar and gas masses within 100 kpc of them: Clowe et al.
 *   (2006), "A direct empirical proof of the existence of dark matter",
 *   ApJ 648, L109, Table 2 (arXiv:astro-ph/0608407).
 * - Gas mass and total (lensing) mass inside the 1300 × 830 kpc field of the
 *   Hubble ACS images, 13 ± 1 and 91 ± 10 × 10¹³ M☉, and the lensing masses
 *   within 250 kpc of the main cluster (2.8 ± 0.2 × 10¹⁴ M☉) and of the
 *   subcluster (2.3 ± 0.2 × 10¹⁴ M☉): Bradač et al. (2006), "Strong and weak
 *   lensing united. III", ApJ 652, 937, Table 3 and §IV (arXiv:astro-ph/0608408).
 * - Stars are ~1–2% of a cluster's mass (Clowe et al. 2006, citing Kochanek
 *   et al. 2003); the model takes 1.5% of the measured total.
 *
 * Simplifications (stated on the page): every component is a round, smooth
 * blob (a projected Plummer profile) instead of the real lumpy, elongated
 * shapes; the gas is split between the two clouds in the ratio of Clowe's
 * aperture masses (6.6 : 5.8), the stars and the dark matter between the two
 * clusters in the ratio of Clowe's stellar masses (0.54 : 0.58) and of
 * Bradač's lensing masses (2.8 : 2.3). The blob sizes are drawing choices; the
 * dark blobs' size is the one that puts 2.8 × 10¹⁴ M☉ within 250 kpc of the
 * main cluster when the dark matter makes up the measured total.
 * Cosmology as in both papers: flat, Ω_m = 0.3, Ω_Λ = 0.7, H₀ = 70 km/s/Mpc.
 * The background galaxies are taken at redshift 1.
 */

/** Speed of light, km/s; Newton's constant, kpc (km/s)² / M☉. */
const C_KMS = 299792.458;
const G = 4.30091727e-6;
const H0 = 70;
const OM = 0.3;
const OL = 0.7;

/** Comoving distance (Mpc) to redshift z, flat ΛCDM, by Simpson's rule. */
export function comovingMpc(z1: number, z2 = 0): number {
	const [a, b] = z1 < z2 ? [z1, z2] : [z2, z1];
	const n = 400;
	const h = (b - a) / n;
	const f = (z: number) => 1 / Math.sqrt(OM * (1 + z) ** 3 + OL);
	let s = f(a) + f(b);
	for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
	return ((C_KMS / H0) * s * h) / 3;
}

/** Lookback time (Gyr) to redshift z: how long ago the light set out. */
export function lookbackGyr(z: number): number {
	const n = 400;
	const h = z / n;
	const f = (x: number) => 1 / ((1 + x) * Math.sqrt(OM * (1 + x) ** 3 + OL));
	let s = f(0) + f(z);
	for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
	const hubbleGyr = 977.792 / H0; // 1/H₀ in Gyr for H₀ in km/s/Mpc
	return (hubbleGyr * s * h) / 3;
}

/** Angular-diameter distance (Mpc) from redshift zl to zs (flat universe). */
export const angularMpc = (zs: number, zl = 0) => comovingMpc(zs, zl) / (1 + zs);

export const Z_CLUSTER = 0.296;
export const Z_SOURCE = 1;

/** kpc per arcsecond at the cluster. */
export const kpcPerArcsec = (z = Z_CLUSTER) => (angularMpc(z) * 1000 * Math.PI) / (180 * 3600);

/** Critical surface density c²/(4πG) · D_s/(D_l D_ls), M☉/kpc². */
export function sigmaCrit(zl = Z_CLUSTER, zs = Z_SOURCE) {
	const dl = angularMpc(zl) * 1000;
	const ds = angularMpc(zs) * 1000;
	const dls = angularMpc(zs, zl) * 1000;
	return ((C_KMS * C_KMS) / (4 * Math.PI * G)) * (ds / (dl * dls));
}

// ---- the cluster ----------------------------------------------------------------

/** Right ascension "hh:mm:ss.s" and declination "−dd:mm:ss.s" → degrees. */
function sexagesimal(s: string, hours: boolean) {
	const sign = s.trim().startsWith('-') ? -1 : 1;
	const [d, m, sec] = s.replace('-', '').split(':').map(Number);
	return sign * (d + m / 60 + sec / 3600) * (hours ? 15 : 1);
}

/** Clowe et al. (2006) Table 2: positions, gas and stellar masses within 100 kpc. */
export const CLOWE = {
	mainBCG: { ra: '06:58:35.3', dec: '-55:56:56.3', gas: 5.5e12, stars: 0.54e12 },
	mainGas: { ra: '06:58:30.2', dec: '-55:56:35.9', gas: 6.6e12, stars: 0.23e12 },
	subBCG: { ra: '06:58:16.0', dec: '-55:56:35.1', gas: 2.7e12, stars: 0.58e12 },
	subGas: { ra: '06:58:21.2', dec: '-55:56:30.0', gas: 5.8e12, stars: 0.12e12 }
} as const;

/** Bradač et al. (2006): masses in the ACS field and within 250 kpc. */
export const BRADAC = {
	fieldGas: 13e13,
	fieldGasErr: 1e13,
	fieldTotal: 91e13,
	fieldTotalErr: 10e13,
	fieldKpc: [1300, 830] as const,
	main250: 2.8e14,
	sub250: 2.3e14,
	err250: 0.2e14
} as const;

export const STAR_FRACTION = 0.015;
export const FIELD_STARS = STAR_FRACTION * BRADAC.fieldTotal;
export const FIELD_VISIBLE = BRADAC.fieldGas + FIELD_STARS;
/** The dark matter the lensing total asks for: 91 − 13 − 1.4 ≈ 77 × 10¹³ M☉. */
export const DARK_NEEDED = BRADAC.fieldTotal - FIELD_VISIBLE;

export interface XY {
	x: number;
	y: number;
}

/**
 * Sky position in kpc relative to the midpoint of the two big galaxies:
 * x towards the west (to the right, with north up as on sky maps), y north.
 */
const POS = (() => {
	const scale = kpcPerArcsec();
	const raw = Object.fromEntries(
		Object.entries(CLOWE).map(([k, v]) => [
			k,
			{ ra: sexagesimal(v.ra, true), dec: sexagesimal(v.dec, false) }
		])
	) as Record<keyof typeof CLOWE, { ra: number; dec: number }>;
	const ra0 = (raw.mainBCG.ra + raw.subBCG.ra) / 2;
	const dec0 = (raw.mainBCG.dec + raw.subBCG.dec) / 2;
	const cosd = Math.cos((dec0 * Math.PI) / 180);
	const to = (p: { ra: number; dec: number }): XY => ({
		x: -(p.ra - ra0) * cosd * 3600 * scale,
		y: (p.dec - dec0) * 3600 * scale
	});
	return {
		mainBCG: to(raw.mainBCG),
		mainGas: to(raw.mainGas),
		subBCG: to(raw.subBCG),
		subGas: to(raw.subGas)
	};
})();
export const POSITIONS: Readonly<Record<keyof typeof CLOWE, XY>> = POS;

export type Kind = 'gas' | 'stars' | 'dark';

const GAS_MAIN_A = 552;
const GAS_SUB_A = 656;
const STARS_MAIN_A = 554;
const STARS_SUB_A = 544;
const DARK_MAIN_A = 312;
const DARK_SUB_A = 326;

export interface Blob extends XY {
	id: string;
	kind: Kind;
	/** Total mass, M☉. */
	mass: number;
	/** Plummer radius, kpc. */
	a: number;
}

/**
 * Blob sizes (Plummer radii, kpc). Not measured shapes: each is the size that
 * makes the round blob hold the published mass inside the published aperture
 * (checked in e2e/dark-matter-model.e2e.ts): the gas and stars put Clowe's
 * Table 2 masses within 100 kpc of their peaks, and the dark blobs put
 * Bradač's 2.8 and 2.3 × 10¹⁴ M☉ within 250 kpc of the two clusters (with
 * everything else) when the field holds its measured 91 × 10¹³ M☉.
 */
export const SIZE = {
	gasMain: GAS_MAIN_A,
	gasSub: GAS_SUB_A,
	starsMain: STARS_MAIN_A,
	starsSub: STARS_SUB_A,
	darkMain: DARK_MAIN_A,
	darkSub: DARK_SUB_A
};

const share = (a: number, b: number) => [a / (a + b), b / (a + b)] as const;

/** Fraction of a unit Plummer blob's mass that falls inside the ACS field. */
function fieldFraction(p: XY, a: number) {
	return massInField([{ id: '', kind: 'gas', ...p, mass: 1, a }]);
}

const FRACTIONS = (() => {
	const p = POSITIONS;
	return {
		gasMain: fieldFraction(p.mainGas, SIZE.gasMain),
		gasSub: fieldFraction(p.subGas, SIZE.gasSub),
		starsMain: fieldFraction(p.mainBCG, SIZE.starsMain),
		starsSub: fieldFraction(p.subBCG, SIZE.starsSub),
		darkMain: fieldFraction(p.mainBCG, SIZE.darkMain),
		darkSub: fieldFraction(p.subBCG, SIZE.darkSub)
	};
})();

/**
 * The cluster's mass model with `dark` M☉ of dark matter inside the ACS field.
 * The gas inside the field adds up to Bradač's 13 × 10¹³ M☉ and the stars to
 * 1.5% of the measured total, whatever the dark matter.
 */
export function blobs(dark: number): Blob[] {
	const [gm, gs] = share(CLOWE.mainGas.gas, CLOWE.subGas.gas);
	const [sm, ss] = share(CLOWE.mainBCG.stars, CLOWE.subBCG.stars);
	const [dm, ds] = share(BRADAC.main250, BRADAC.sub250);
	const p = POSITIONS;
	const f = FRACTIONS;
	const s = SIZE;
	return [
		{
			id: 'gas-main',
			kind: 'gas',
			...p.mainGas,
			mass: (gm * BRADAC.fieldGas) / f.gasMain,
			a: s.gasMain
		},
		{
			id: 'gas-sub',
			kind: 'gas',
			...p.subGas,
			mass: (gs * BRADAC.fieldGas) / f.gasSub,
			a: s.gasSub
		},
		{
			id: 'stars-main',
			kind: 'stars',
			...p.mainBCG,
			mass: (sm * FIELD_STARS) / f.starsMain,
			a: s.starsMain
		},
		{
			id: 'stars-sub',
			kind: 'stars',
			...p.subBCG,
			mass: (ss * FIELD_STARS) / f.starsSub,
			a: s.starsSub
		},
		{ id: 'dark-main', kind: 'dark', ...p.mainBCG, mass: (dm * dark) / f.darkMain, a: s.darkMain },
		{ id: 'dark-sub', kind: 'dark', ...p.subBCG, mass: (ds * dark) / f.darkSub, a: s.darkSub }
	];
}

// ---- lensing --------------------------------------------------------------------

export interface Lensing {
	/** Convergence: surface density ÷ the critical one. */
	kappa: number;
	/** Shear components. */
	g1: number;
	g2: number;
}

/** κ and shear γ at a point, summed over the blobs. */
export function lensAt(bs: readonly Blob[], x: number, y: number, sc = sigmaCrit()): Lensing {
	let kappa = 0;
	let g1 = 0;
	let g2 = 0;
	for (const b of bs) {
		if (b.mass <= 0) continue;
		const dx = x - b.x;
		const dy = y - b.y;
		const r2 = dx * dx + dy * dy;
		const s = r2 + b.a * b.a;
		const k0 = b.mass / (Math.PI * sc);
		kappa += (k0 * b.a * b.a) / (s * s);
		// Tangential shear of a Plummer lens: mean κ inside R minus κ at R.
		const gt = (k0 * r2) / (s * s);
		if (r2 > 0) {
			const c2 = (dx * dx - dy * dy) / r2;
			const s2 = (2 * dx * dy) / r2;
			g1 -= gt * c2;
			g2 -= gt * s2;
		}
	}
	return { kappa, g1, g2 };
}

/** Projected surface density (M☉/kpc²) at a point. */
export function sigmaAt(bs: readonly Blob[], x: number, y: number) {
	let s = 0;
	for (const b of bs) {
		const q = (x - b.x) ** 2 + (y - b.y) ** 2 + b.a * b.a;
		s += (b.mass * b.a * b.a) / (Math.PI * q * q);
	}
	return s;
}

/** Projected mass (M☉) inside a circle of radius R round (x, y), numerically. */
export function massInCircle(bs: readonly Blob[], x: number, y: number, R: number) {
	const nr = 48;
	const nt = 64;
	let m = 0;
	for (let i = 0; i < nr; i++) {
		const r = ((i + 0.5) * R) / nr;
		for (let j = 0; j < nt; j++) {
			const t = (2 * Math.PI * (j + 0.5)) / nt;
			m += sigmaAt(bs, x + r * Math.cos(t), y + r * Math.sin(t)) * r;
		}
	}
	return (m * (R / nr) * (2 * Math.PI)) / nt;
}

/** Projected mass (M☉) inside the ACS field (a rectangle centred on the midpoint). */
export function massInField(bs: readonly Blob[]) {
	const [w, h] = BRADAC.fieldKpc;
	const n = 80;
	let m = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			m += sigmaAt(bs, -w / 2 + ((i + 0.5) * w) / n, -h / 2 + ((j + 0.5) * h) / n);
		}
	}
	return (m * w * h) / (n * n);
}

/**
 * The image of a background galaxy of intrinsic complex ellipticity ε_s
 * (|ε| = (a − b)/(a + b)) seen through reduced shear g = γ/(1 − κ):
 * ε = (ε_s + g)/(1 + g* ε_s) for |g| ≤ 1, (1 + g ε_s*)/(ε_s* + g*) beyond.
 * Returns the axis ratio b/a and the angle of the long axis (radians).
 */
export function lensedShape(es: XY, l: Lensing): { q: number; angle: number } {
	const d = 1 - l.kappa;
	const gx = l.g1 / d;
	const gy = l.g2 / d;
	const mul = (a: XY, b: XY): XY => ({ x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x });
	const div = (a: XY, b: XY): XY => {
		const n = b.x * b.x + b.y * b.y || 1e-12;
		return { x: (a.x * b.x + a.y * b.y) / n, y: (a.y * b.x - a.x * b.y) / n };
	};
	const g = { x: gx, y: gy };
	const gc = { x: gx, y: -gy };
	const esc = { x: es.x, y: -es.y };
	const e =
		gx * gx + gy * gy <= 1
			? div({ x: es.x + g.x, y: es.y + g.y }, { x: 1 + mul(gc, es).x, y: mul(gc, es).y })
			: div({ x: 1 + mul(g, esc).x, y: mul(g, esc).y }, { x: esc.x + gc.x, y: esc.y + gc.y });
	const m = Math.min(0.95, Math.hypot(e.x, e.y));
	return { q: (1 - m) / (1 + m), angle: 0.5 * Math.atan2(e.y, e.x) };
}

/** Grid of κ over a box, for contours and for finding the peak. */
export interface Grid {
	x0: number;
	y0: number;
	dx: number;
	dy: number;
	nx: number;
	ny: number;
	v: Float64Array;
}

export function kappaGrid(
	bs: readonly Blob[],
	box: { x0: number; x1: number; y0: number; y1: number },
	nx = 64,
	ny = 40
): Grid {
	const sc = sigmaCrit();
	const dx = (box.x1 - box.x0) / (nx - 1);
	const dy = (box.y1 - box.y0) / (ny - 1);
	const v = new Float64Array(nx * ny);
	for (let j = 0; j < ny; j++) {
		for (let i = 0; i < nx; i++) {
			v[j * nx + i] = (sigmaAt(bs, box.x0 + i * dx, box.y0 + j * dy) * 1) / sc;
		}
	}
	return { x0: box.x0, y0: box.y0, dx, dy, nx, ny, v };
}

/** The grid point with the highest κ. */
export function peak(grid: Grid): XY & { kappa: number } {
	let k = 0;
	for (let i = 1; i < grid.v.length; i++) if (grid.v[i] > grid.v[k]) k = i;
	const i = k % grid.nx;
	const j = Math.floor(k / grid.nx);
	return { x: grid.x0 + i * grid.dx, y: grid.y0 + j * grid.dy, kappa: grid.v[k] };
}

/**
 * Contour line segments of the grid at `level` (marching squares), as pairs of
 * points in the grid's own coordinates (kpc).
 */
export function contour(grid: Grid, level: number): [XY, XY][] {
	const { nx, ny, v, x0, y0, dx, dy } = grid;
	const out: [XY, XY][] = [];
	const at = (i: number, j: number) => v[j * nx + i];
	const lerpPt = (i1: number, j1: number, i2: number, j2: number): XY => {
		const a = at(i1, j1);
		const b = at(i2, j2);
		const u = b === a ? 0.5 : (level - a) / (b - a);
		return { x: x0 + (i1 + (i2 - i1) * u) * dx, y: y0 + (j1 + (j2 - j1) * u) * dy };
	};
	for (let j = 0; j < ny - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const c =
				(at(i, j) > level ? 1 : 0) |
				(at(i + 1, j) > level ? 2 : 0) |
				(at(i + 1, j + 1) > level ? 4 : 0) |
				(at(i, j + 1) > level ? 8 : 0);
			if (c === 0 || c === 15) continue;
			const e = {
				b: () => lerpPt(i, j, i + 1, j),
				r: () => lerpPt(i + 1, j, i + 1, j + 1),
				t: () => lerpPt(i, j + 1, i + 1, j + 1),
				l: () => lerpPt(i, j, i, j + 1)
			};
			const pairs: Record<number, (keyof typeof e)[][]> = {
				1: [['l', 'b']],
				2: [['b', 'r']],
				3: [['l', 'r']],
				4: [['r', 't']],
				5: [
					['l', 't'],
					['b', 'r']
				],
				6: [['b', 't']],
				7: [['l', 't']],
				8: [['t', 'l']],
				9: [['t', 'b']],
				10: [
					['l', 'b'],
					['r', 't']
				],
				11: [['t', 'r']],
				12: [['r', 'l']],
				13: [['r', 'b']],
				14: [['b', 'l']]
			};
			for (const [p, q] of pairs[c]) out.push([e[p](), e[q]()]);
		}
	}
	return out;
}

/** A small deterministic random generator (mulberry32), for the background galaxies. */
export function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
