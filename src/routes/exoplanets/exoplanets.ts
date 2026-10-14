/**
 * The model behind the exoplanets explainer: a planet on a circular orbit round
 * its star, and the two signals it leaves in the star's light.
 *
 * - Orbit: Kepler's third law with Newton's constant, a³ = G(M★ + Mp)P² / 4π².
 *   Star and planet both circle their common centre of mass.
 * - Transit: the fraction of the star's disc the planet's disc covers, from the
 *   exact area of overlap of two circles. The star's disc is taken as uniformly
 *   bright (no limb darkening: a real star is dimmer near its edge, which rounds
 *   the bottom of the dip), and the planet as a dark disc with no atmosphere.
 * - Radial velocity: the star's speed along our line of sight,
 *   v = −K sin(2π·phase), with K = (2πG/P)^⅓ · Mp sin i / (M★ + Mp)^⅔
 *   (circular orbit). Positive = moving away (redshift). Phase 0 is mid-transit,
 *   when the planet is between the star and us.
 * - Doppler shift of a spectral line: Δλ = λ·v/c (v ≪ c).
 * - Habitable zone: the stellar flux limits of Kopparapu et al. (2014), ApJL 787,
 *   L29, Table 1, for a planet of 1 Earth mass, valid for stars of 2600–7200 K.
 *
 * Orbits are circular throughout (most planets found close to their stars have
 * nearly circular orbits); an eccentric orbit changes the shape of the velocity
 * curve and the length of the transit, not the ideas.
 */

import { ARCHIVE_PLANETS, type ArchivePlanet, type ArchiveStar } from './archive';

// ---- constants -----------------------------------------------------------------------

/** Newton's gravitational constant, m³ kg⁻¹ s⁻² (CODATA 2018). */
export const G = 6.6743e-11;
/** Speed of light, m/s (exact, SI). */
export const C = 299_792_458;
/** The astronomical unit, m (IAU 2012 Resolution B2, exact). */
export const AU = 1.495978707e11;
export const DAY = 86_400;
/** The Sun's GM, m³/s² (IAU 2015 Resolution B3, nominal). */
export const GM_SUN = 1.3271244e20;
/** The Sun's radius, m (IAU 2015 Resolution B3, nominal). */
export const R_SUN = 6.957e8;
/** The Sun's effective temperature, K (IAU 2015 Resolution B3, nominal). */
export const TEFF_SUN = 5772;
/** The Earth's GM, m³/s² (IAU 2015 Resolution B3, nominal). */
export const GM_EARTH = 3.986004e14;
/** The Earth's equatorial radius, m (IAU 2015 Resolution B3, nominal). */
export const R_EARTH = 6.3781e6;
/** Jupiter's GM, m³/s² (IAU 2015 Resolution B3, nominal). */
export const GM_JUPITER = 1.2668653e17;
/** Jupiter's equatorial radius, m (IAU 2015 Resolution B3, nominal). */
export const R_JUPITER = 7.1492e7;
/** Jupiter's orbit: semi-major axis 5.2038 AU (NASA Jupiter fact sheet). */
export const A_JUPITER = 5.2038;

export const M_SUN = GM_SUN / G;
export const M_EARTH = GM_EARTH / G;
/** Jupiter's mass in Earth masses (≈ 317.8). */
export const JUPITER_MASSES = GM_JUPITER / GM_EARTH;
/** Jupiter's radius in Earth radii (≈ 11.2). */
export const JUPITER_RADII = R_JUPITER / R_EARTH;
/** The Sun's radius in Earth radii (≈ 109). */
export const SUN_RADII = R_SUN / R_EARTH;

/**
 * Lines in the visible spectrum of a Sun-like star (air wavelengths, nm, NIST
 * Atomic Spectra Database; Fraunhofer's letters in brackets).
 */
export const SPECTRAL_LINES = [
	{ id: 'CaK', label: 'Ca K', nm: 393.366 },
	{ id: 'CaH', label: 'Ca H', nm: 396.847 },
	{ id: 'Hd', label: 'Hδ', nm: 410.174 },
	{ id: 'Hg', label: 'Hγ', nm: 434.047 },
	{ id: 'Hb', label: 'Hβ (F)', nm: 486.135 },
	{ id: 'Mgb', label: 'Mg (b)', nm: 518.362 },
	{ id: 'Fe', label: 'Fe (E)', nm: 527.039 },
	{ id: 'NaD', label: 'Na (D)', nm: 589.0 },
	{ id: 'Ha', label: 'Hα (C)', nm: 656.281 }
] as const;

// ---- systems ---------------------------------------------------------------------------

export interface Star {
	/** Radius, solar radii. */
	radius: number;
	/** Mass, solar masses. */
	mass: number;
	/** Effective (surface) temperature, K. */
	teff: number;
	/** Luminosity, solar luminosities. */
	lum: number;
}

export interface Planet {
	/** Radius, Earth radii. */
	radius: number;
	/** Mass, Earth masses. */
	mass: number;
	/** Orbit radius (semi-major axis), AU. */
	a: number;
	/** Inclination of the orbit to the sky, degrees: 90 = seen edge-on, 0 = face-on. */
	incl: number;
}

export const SUN: Star = { radius: 1, mass: 1, teff: TEFF_SUN, lum: 1 };

/** Radius ratio k = Rp / R★. */
export const radiusRatio = (s: Star, p: Planet) => p.radius / (s.radius * SUN_RADII);
/** Orbit radius in stellar radii, a / R★. */
export const aOverR = (s: Star, p: Planet) => (p.a * AU) / (s.radius * R_SUN);

/** Orbital period in days from Kepler's third law (star and planet masses both count). */
export function periodDays(s: Star, p: Planet): number {
	const gm = G * (s.mass * M_SUN + p.mass * M_EARTH);
	return (2 * Math.PI * Math.sqrt((p.a * AU) ** 3 / gm)) / DAY;
}

/** Orbit radius in AU for a period in days (Kepler's third law, inverted). */
export function orbitAU(periodD: number, starMass: number, planetMass = 0): number {
	const gm = G * (starMass * M_SUN + planetMass * M_EARTH);
	const P = periodD * DAY;
	return Math.cbrt((gm * P * P) / (4 * Math.PI * Math.PI)) / AU;
}

// ---- transit ---------------------------------------------------------------------------

/**
 * Fraction of a uniformly bright star's light blocked by a dark planet whose
 * centre is `z` stellar radii from the star's centre (in the sky), for a radius
 * ratio `k`. Exact two-circle overlap area divided by the star's area.
 */
export function blocked(z: number, k: number): number {
	if (k <= 0 || z >= 1 + k) return 0;
	if (z <= k - 1) return 1; // planet larger than the star covers it all
	if (z <= 1 - k) return k * k; // planet wholly inside the disc
	const k0 = Math.acos(Math.min(1, Math.max(-1, (z * z + k * k - 1) / (2 * z * k))));
	const k1 = Math.acos(Math.min(1, Math.max(-1, (z * z + 1 - k * k) / (2 * z))));
	const root = Math.sqrt(Math.max(0, 4 * z * z - (1 + z * z - k * k) ** 2));
	return (k * k * k0 + k1 - 0.5 * root) / Math.PI;
}

/** Depth of a full transit: the fraction of light blocked, (Rp / R★)². */
export const transitDepth = (s: Star, p: Planet) => Math.min(1, radiusRatio(s, p) ** 2);

/**
 * The planet's position in the sky relative to the star, in stellar radii, at
 * `phase` (orbits since mid-transit): x across the sky in the direction of
 * motion, y up, and whether it is on the near side (in front of the star).
 */
export function skyPosition(s: Star, p: Planet, phase: number) {
	const A = aOverR(s, p);
	const th = 2 * Math.PI * phase;
	const ci = Math.cos((p.incl * Math.PI) / 180);
	return { x: A * Math.sin(th), y: -A * ci * Math.cos(th), front: Math.cos(th) > 0 };
}

/** The star's brightness (1 = unblocked) at `phase`. */
export function flux(s: Star, p: Planet, phase: number): number {
	const { x, y, front } = skyPosition(s, p, phase);
	return front ? 1 - blocked(Math.hypot(x, y), radiusRatio(s, p)) : 1;
}

/** Impact parameter: how far from the star's centre the planet's track passes, in stellar radii. */
export const impactParameter = (s: Star, p: Planet) =>
	aOverR(s, p) * Math.cos((p.incl * Math.PI) / 180);

/** Whether the planet passes in front of the star at all (even grazing). */
export const transits = (s: Star, p: Planet) => impactParameter(s, p) < 1 + radiusRatio(s, p);

/** Total transit duration (first to last contact), hours; 0 if it doesn't transit. */
export function transitHours(s: Star, p: Planet): number {
	const k = radiusRatio(s, p);
	const b = impactParameter(s, p);
	if (b >= 1 + k) return 0;
	const A = aOverR(s, p);
	const si = Math.sin((p.incl * Math.PI) / 180);
	const arg = Math.sqrt((1 + k) ** 2 - b * b) / (A * si);
	return ((periodDays(s, p) * 24) / Math.PI) * Math.asin(Math.min(1, arg));
}

/** Chance that a randomly tilted orbit transits: (R★ + Rp) / a. */
export const transitChance = (s: Star, p: Planet) => (1 + radiusRatio(s, p)) / aOverR(s, p);

/** Largest tilt from edge-on (degrees) that still gives a transit (even grazing). */
export function maxTiltDeg(s: Star, p: Planet): number {
	return (Math.asin(Math.min(1, transitChance(s, p))) * 180) / Math.PI;
}

// ---- radial velocity ---------------------------------------------------------------------

/** Semi-amplitude K of the star's line-of-sight velocity, m/s (circular orbit). */
export function rvAmplitude(s: Star, p: Planet): number {
	const P = periodDays(s, p) * DAY;
	const ms = s.mass * M_SUN;
	const mp = p.mass * M_EARTH;
	const si = Math.sin((p.incl * Math.PI) / 180);
	return Math.cbrt((2 * Math.PI * G) / P) * ((mp * si) / Math.pow(ms + mp, 2 / 3));
}

/** The star's true orbital speed round the centre of mass, m/s. */
export function starSpeed(s: Star, p: Planet): number {
	const P = periodDays(s, p) * DAY;
	return (2 * Math.PI * starOrbitAU(s, p) * AU) / P;
}

/** Radius of the star's own small orbit round the centre of mass, AU. */
export function starOrbitAU(s: Star, p: Planet): number {
	const ms = s.mass * M_SUN;
	const mp = p.mass * M_EARTH;
	return (p.a * mp) / (ms + mp);
}

/** The star's line-of-sight velocity at `phase`, m/s; positive = away from us. */
export const radialVelocity = (s: Star, p: Planet, phase: number) =>
	-rvAmplitude(s, p) * Math.sin(2 * Math.PI * phase);

/** Doppler shift of a line of rest wavelength `nm` for a speed `v` m/s away from us, in nm. */
export const dopplerShift = (nm: number, v: number) => (nm * v) / C;

// ---- reading the planet back ----------------------------------------------------------

/** Planet radius (Earth radii) from a transit depth (fraction) and the star's radius. */
export const radiusFromDepth = (depth: number, starRadius: number) =>
	Math.sqrt(Math.max(0, depth)) * starRadius * SUN_RADII;

/**
 * The planet's mass (Earth masses) from the star's wobble K (m/s), the period
 * (days), the star's mass (solar masses) and sin i. Solves
 * Mp sin i = K (P / 2πG)^⅓ (M★ + Mp)^⅔ by iteration. With sin i unknown (no
 * transit), leave it at 1: the result is then the minimum mass, Mp sin i.
 */
export function massFromWobble(K: number, periodD: number, starMass: number, sinI = 1): number {
	const ms = starMass * M_SUN;
	const f = K * Math.cbrt((periodD * DAY) / (2 * Math.PI * G));
	let mpSinI = 0;
	for (let i = 0; i < 60; i++) mpSinI = f * Math.pow(ms + mpSinI / sinI, 2 / 3);
	return mpSinI / sinI / M_EARTH;
}

/** Mean density, g/cm³, from radius (Earth radii) and mass (Earth masses). */
export function density(radius: number, mass: number): number {
	const r = radius * R_EARTH;
	return (mass * M_EARTH) / ((4 / 3) * Math.PI * r ** 3) / 1000;
}

// ---- light and the habitable zone ---------------------------------------------------------

/** Luminosity (solar units) from radius (solar radii) and temperature: L = R² (T / T☉)⁴. */
export const luminosity = (radius: number, teff: number) =>
	radius * radius * (teff / TEFF_SUN) ** 4;

/** Starlight reaching the planet, in units of what the Earth gets from the Sun: L / a². */
export const insolation = (s: Star, p: Planet) => s.lum / (p.a * p.a);

/**
 * Fraction of the star's light that falls on the planet at all (its disc,
 * πRp², over the sphere 4πa²): (Rp / 2a)². It reflects at most this much.
 */
export const interceptedFraction = (p: Planet) => ((p.radius * R_EARTH) / (2 * p.a * AU)) ** 2;

/**
 * Kopparapu et al. (2014), ApJL 787, L29, Table 1, 1 Earth mass:
 * S_eff = S☉ + aT + bT² + cT³ + dT⁴ with T = T_eff − 5780 K.
 */
const HZ = {
	recentVenus: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
	runawayGreenhouse: [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15],
	maximumGreenhouse: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
	earlyMars: [0.32, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16]
} as const;
export type HzLimit = keyof typeof HZ;
/** Range of star temperatures the fits cover, K. */
export const HZ_TEFF_RANGE = [2600, 7200] as const;

/** The stellar flux (Earth = 1) at a habitable-zone limit, for a star of `teff` K. */
export function hzFlux(limit: HzLimit, teff: number): number {
	const [s, a, b, c, d] = HZ[limit];
	const T = teff - 5780;
	return s + a * T + b * T * T + c * T ** 3 + d * T ** 4;
}

/**
 * Habitable-zone distances, AU: the conservative zone (runaway greenhouse to
 * maximum greenhouse) and the optimistic one (recent Venus to early Mars).
 */
export function habitableZone(s: Star) {
	const d = (limit: HzLimit) => Math.sqrt(s.lum / hzFlux(limit, s.teff));
	return {
		optimisticInner: d('recentVenus'),
		inner: d('runawayGreenhouse'),
		outer: d('maximumGreenhouse'),
		optimisticOuter: d('earlyMars')
	};
}

export type Zone = 'too hot' | 'optimistic' | 'habitable zone' | 'too cold';

/** Where a planet getting `flux` (Earth = 1) sits relative to the zone of a star of `teff`. */
export function zoneOf(flux: number, teff: number): Zone {
	if (flux > hzFlux('recentVenus', teff)) return 'too hot';
	if (flux < hzFlux('earlyMars', teff)) return 'too cold';
	if (flux > hzFlux('runawayGreenhouse', teff) || flux < hzFlux('maximumGreenhouse', teff))
		return 'optimistic';
	return 'habitable zone';
}

// ---- the stars and planets of the explainer ---------------------------------------------

/** A star from the archive's table, in the model's units. */
export function archiveStar(st: ArchiveStar): Star {
	return { radius: st.radius, mass: st.mass, teff: st.teff, lum: 10 ** st.logLum };
}

const host = (name: string) => {
	const p = ARCHIVE_PLANETS.find((q) => q.name === name);
	if (!p) throw new Error(`no archive planet ${name}`);
	return p;
};
export const archivePlanet = host;

/** The stars a reader can choose: the Sun (IAU nominal values) and two real hosts. */
export const STARS = {
	sun: { name: 'the Sun', type: 'G2 V, yellow', star: SUN },
	hd189733: {
		name: 'HD 189733',
		type: 'K2 V, orange',
		star: archiveStar(host('HD 189733 b').star)
	},
	proxima: {
		name: 'Proxima Centauri',
		type: 'M5.5 V, red dwarf',
		star: archiveStar(host('Proxima Cen b').star)
	}
} as const satisfies Record<string, { name: string; type: string; star: Star }>;
export type StarId = keyof typeof STARS;
export const starOf = (id: unknown): Star =>
	STARS[(id as StarId) in STARS ? (id as StarId) : 'sun'].star;

/** An archive planet as a model planet (circular orbit; edge-on, 90°, if no inclination is known). */
export function modelPlanet(p: ArchivePlanet, incl = p.incl ?? 90): Planet {
	return { radius: p.radius, mass: p.mass, a: p.a, incl };
}
