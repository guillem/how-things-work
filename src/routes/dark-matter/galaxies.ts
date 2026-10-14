/**
 * Rotation curves of real galaxies (SPARC, `sparc.ts`) and the mass model the
 * reader fits to them: stars + gas (the visible matter, measured) + an
 * invisible halo (the reader's guess).
 *
 * Units: kpc, km/s, solar masses. A circular orbit at radius r round a mass
 * distribution has v² = G·M(<r)/r for a sphere; a flat disc is not a sphere,
 * which is why SPARC gives each component's speed (worked out from the real
 * shape of the disc) rather than its mass. The speeds add in quadrature:
 *
 *   v² = Vgas·|Vgas| + Υ_disc·Vdisk·|Vdisk| + Υ_bulge·Vbul·|Vbul| + V_halo²
 *
 * where Υ is the stellar mass-to-light ratio at 3.6 µm (SPARC's Vdisk and Vbul
 * are for Υ = 1) and V·|V| keeps the sign of a component that pulls outwards.
 *
 * The halo is a pseudo-isothermal sphere (Begeman, Broeils & Sanders 1991;
 * used for SPARC by Li et al. 2020, ApJS 247, 31): density ρ₀ / (1 + (r/r_c)²),
 * so M(<r) = 4π ρ₀ r_c³ (r/r_c − arctan(r/r_c)). Its total mass grows without
 * limit, so the reader sets the mass it holds inside the last measured radius
 * (as a multiple of the galaxy's whole visible mass) and its core radius r_c.
 */
import { SPARC, type SparcGalaxy } from './sparc';

/** Newton's constant in kpc (km/s)² / M☉. */
export const G = 4.30091727e-6;
/** One kpc in km, and one gigayear in seconds. */
export const KPC_KM = 3.0856775814913e16;
export const GYR_S = 3.15576e16;

/** SPARC's standard mass-to-light ratios at 3.6 µm (Lelli et al. 2016, §5). */
export const ML_DISK_DEFAULT = 0.5;
export const ML_BULGE_DEFAULT = 0.7;
/** The bulge ratio follows the disc one in SPARC's proportion (0.7 / 0.5). */
export const BULGE_OVER_DISK = ML_BULGE_DEFAULT / ML_DISK_DEFAULT;
/** Helium and metals: gas mass = 1.33 × hydrogen (SPARC Table 2 note). */
export const HELIUM = 1.33;

export type GalaxyId = keyof typeof SPARC;

export interface GalaxyInfo {
	id: GalaxyId;
	/** Display name, e.g. "NGC 3198". */
	name: string;
	/** What kind of galaxy it is, in a few words. */
	kind: string;
}

export const GALAXIES: readonly GalaxyInfo[] = [
	{ id: 'NGC3198', name: 'NGC 3198', kind: 'spiral, the classic case' },
	{ id: 'NGC2403', name: 'NGC 2403', kind: 'smaller spiral' },
	{ id: 'DDO154', name: 'DDO 154', kind: 'dwarf, mostly gas, few stars' },
	{ id: 'NGC2841', name: 'NGC 2841', kind: 'giant spiral with a central bulge' }
];

export const galaxyInfo = (id: string): GalaxyInfo =>
	GALAXIES.find((g) => g.id === id) ?? GALAXIES[0];

export interface Point {
	r: number;
	v: number;
	e: number;
	gas: number;
	disk: number;
	bulge: number;
}

export interface Galaxy extends Omit<SparcGalaxy, 'points'> {
	id: GalaxyId;
	name: string;
	kind: string;
	points: Point[];
	/** Last measured radius, kpc. */
	rLast: number;
}

const cache = new Map<string, Galaxy>();

export function galaxy(id: string): Galaxy {
	const info = galaxyInfo(id);
	let g = cache.get(info.id);
	if (!g) {
		const src: SparcGalaxy = SPARC[info.id];
		const points = src.points.map(([r, v, e, gas, disk, bulge]) => ({ r, v, e, gas, disk, bulge }));
		g = { ...src, ...info, points, rLast: points[points.length - 1].r };
		cache.set(info.id, g);
	}
	return g;
}

const sq = (v: number) => v * Math.abs(v);
/** √ that keeps the sign: the inverse of V·|V|. */
export const signedSqrt = (v2: number) => Math.sign(v2) * Math.sqrt(Math.abs(v2));

// ---- the visible matter ----------------------------------------------------------

export interface Visible {
	/** Signed speeds (km/s) each component alone would give. */
	gas: number;
	stars: number;
	/** All the visible matter together. */
	total: number;
}

/** Speeds from the visible matter at a measured point, for a disc ratio Υ. */
export function visibleAt(p: Point, mlDisk: number): Visible {
	const gas2 = sq(p.gas);
	const stars2 = mlDisk * sq(p.disk) + mlDisk * BULGE_OVER_DISK * sq(p.bulge);
	return { gas: p.gas, stars: signedSqrt(stars2), total: signedSqrt(gas2 + stars2) };
}

/**
 * The galaxy's whole visible mass (M☉), from its measured light and hydrogen
 * (SPARC Table 1): Υ × the disc's 3.6 µm light + Υ_bulge × the bulge's +
 * 1.33 × the atomic hydrogen.
 */
export function visibleMass(g: Galaxy, mlDisk: number) {
	const stars = 1e9 * (mlDisk * (g.lum36 - g.lumBulge) + mlDisk * BULGE_OVER_DISK * g.lumBulge);
	const gas = 1e9 * HELIUM * g.mHI;
	return { stars, gas, total: stars + gas };
}

/**
 * Kepler's expectation: the speed of an orbit at radius r if all the visible
 * mass sat at the centre, v = √(G M / r) — falling as r^(−1/2), like the planets.
 */
export const keplerSpeed = (mass: number, r: number) => Math.sqrt((G * mass) / r);

// ---- the dark halo ---------------------------------------------------------------

export interface Halo {
	/** Halo mass inside the last measured radius ÷ the galaxy's visible mass. */
	ratio: number;
	/** Core radius, kpc. */
	core: number;
}

/** M(<r) of a pseudo-isothermal sphere, up to the factor 4πρ₀r_c³. */
const isoShape = (x: number) => x - Math.atan(x);

/** Mass (M☉) of the halo inside radius r. */
export function haloMass(g: Galaxy, h: Halo, mlDisk: number, r: number) {
	if (h.ratio <= 0 || r <= 0) return 0;
	const mLast = h.ratio * visibleMass(g, mlDisk).total;
	const c = Math.max(h.core, 1e-3);
	return (mLast * isoShape(r / c)) / isoShape(g.rLast / c);
}

/** Circular speed (km/s) the halo alone would give at radius r. */
export const haloSpeed = (g: Galaxy, h: Halo, mlDisk: number, r: number) =>
	r > 0 ? Math.sqrt((G * haloMass(g, h, mlDisk, r)) / r) : 0;

/** Central density of the halo, M☉/pc³ (for the "Go deeper" comparisons). */
export function haloDensity(g: Galaxy, h: Halo, mlDisk: number) {
	const c = Math.max(h.core, 1e-3);
	const mLast = h.ratio * visibleMass(g, mlDisk).total;
	return mLast / (4 * Math.PI * c ** 3 * isoShape(g.rLast / c)) / 1e9;
}

// ---- the whole model against the data --------------------------------------------

export interface ModelPoint extends Visible {
	r: number;
	halo: number;
	/** Visible + halo. */
	model: number;
}

/** The model at every measured radius. */
export function curve(g: Galaxy, mlDisk: number, h: Halo | null): ModelPoint[] {
	return g.points.map((p) => {
		const vis = visibleAt(p, mlDisk);
		const halo = h ? haloSpeed(g, h, mlDisk, p.r) : 0;
		const model = signedSqrt(sq(vis.total) + halo * halo);
		return { r: p.r, ...vis, halo, model };
	});
}

export interface Fit {
	/** Σ ((v_measured − v_model) / error)². */
	chi2: number;
	/** χ² per degree of freedom (number of points − number of adjusted values). */
	reduced: number;
	/** Root-mean-square miss in error bars: √(χ²/N). */
	rmsSigma: number;
	/** Root-mean-square miss in km/s. */
	rmsKms: number;
	/** Number of measured points. */
	n: number;
}

export function fit(g: Galaxy, mlDisk: number, h: Halo | null): Fit {
	const m = curve(g, mlDisk, h);
	let chi2 = 0;
	let sse = 0;
	g.points.forEach((p, i) => {
		const d = p.v - m[i].model;
		chi2 += (d / p.e) ** 2;
		sse += d * d;
	});
	const n = g.points.length;
	const k = h ? 3 : 1;
	return {
		chi2,
		reduced: chi2 / Math.max(1, n - k),
		rmsSigma: Math.sqrt(chi2 / n),
		rmsKms: Math.sqrt(sse / n),
		n
	};
}

/** Ranges of the reader's controls (also the search box of `bestHalo`). */
export const RATIO_MAX = 40;
export const CORE_MIN = 0.1;
export const CORE_MAX = 20;
export const ML_MIN = 0.1;
export const ML_MAX = 1.2;

/**
 * The halo that best fits the data for a given stellar Υ: a coarse grid over
 * mass ratio and log core radius, then two rounds of finer grids round the best.
 */
export function bestHalo(g: Galaxy, mlDisk: number): Halo & { chi2: number } {
	let best = { ratio: 1, core: 1, chi2: Infinity };
	const tryAt = (ratio: number, core: number) => {
		if (ratio < 0 || ratio > RATIO_MAX || core < CORE_MIN || core > CORE_MAX) return;
		const c = fit(g, mlDisk, { ratio, core }).chi2;
		if (c < best.chi2) best = { ratio, core, chi2: c };
	};
	const lc0 = Math.log(CORE_MIN);
	const lc1 = Math.log(CORE_MAX);
	for (let i = 0; i <= 40; i++) {
		for (let j = 0; j <= 30; j++)
			tryAt((RATIO_MAX * i) / 40, Math.exp(lc0 + ((lc1 - lc0) * j) / 30));
	}
	let dr = RATIO_MAX / 40;
	let dl = (lc1 - lc0) / 30;
	for (let round = 0; round < 3; round++) {
		const { ratio, core } = best;
		for (let i = -5; i <= 5; i++) {
			for (let j = -5; j <= 5; j++) tryAt(ratio + (dr * i) / 5, core * Math.exp((dl * j) / 5));
		}
		dr /= 5;
		dl /= 5;
	}
	return best;
}

/** The best χ² the visible matter alone can reach, and the Υ that reaches it. */
export function bestVisibleOnly(g: Galaxy) {
	let best = { ml: ML_MIN, chi2: Infinity };
	for (let ml = ML_MIN; ml <= ML_MAX + 1e-9; ml += 0.005) {
		const c = fit(g, ml, null).chi2;
		if (c < best.chi2) best = { ml, chi2: c };
	}
	return best;
}

/** Orbital period (Gyr) at radius r (kpc) for speed v (km/s). */
export const periodGyr = (r: number, v: number) => (2 * Math.PI * r * KPC_KM) / v / GYR_S;

/** Enclosed mass (M☉) a sphere would need for speed v at radius r: v²r/G. */
export const massForSpeed = (v: number, r: number) => (v * v * r) / G;

// ---- the cosmic budget (Planck 2018) ---------------------------------------------

/**
 * Planck Collaboration (2020), "Planck 2018 results. VI. Cosmological parameters",
 * A&A 641, A6, Table 2 (TT,TE,EE+lowE+lensing): Ω_b h² = 0.02237 ± 0.00015,
 * Ω_c h² = 0.1200 ± 0.0012, h = 0.6736, Ω_Λ = 0.6847.
 */
export const PLANCK = {
	ombh2: 0.02237,
	omch2: 0.12,
	h: 0.6736,
	omL: 0.6847
} as const;

export const cosmicBudget = () => {
	const h2 = PLANCK.h * PLANCK.h;
	const ordinary = PLANCK.ombh2 / h2;
	const dark = PLANCK.omch2 / h2;
	return { ordinary, dark, darkEnergy: PLANCK.omL, ratio: PLANCK.omch2 / PLANCK.ombh2 };
};

/** Eilers et al. (2019), ApJ 871, 120: the Milky Way's circular speed at the Sun. */
export const MILKY_WAY = { vSun: 229.0, slope: -1.7, mVir: 7.25e11 } as const;

/**
 * Speed (km/s) at any radius inside the measured range, interpolated linearly
 * between measured points: the measured speed, or the visible matter's.
 * Inside the first point it falls linearly to 0 at the centre; beyond the last
 * it keeps the last value.
 */
export function speedAt(
	g: Galaxy,
	r: number,
	which: 'measured' | 'visible',
	mlDisk = ML_DISK_DEFAULT
) {
	const pts = g.points;
	const val = (i: number) =>
		which === 'measured' ? pts[i].v : Math.max(0, visibleAt(pts[i], mlDisk).total);
	if (r <= pts[0].r) return (val(0) * Math.max(0, r)) / pts[0].r;
	for (let i = 1; i < pts.length; i++) {
		if (r <= pts[i].r) {
			const u = (r - pts[i - 1].r) / (pts[i].r - pts[i - 1].r);
			return val(i - 1) + (val(i) - val(i - 1)) * u;
		}
	}
	return val(pts.length - 1);
}
