/**
 * The energy balance of the Earth, in three levels of detail:
 *
 * 1. A bare planet: absorbed sunlight = σT⁴ (Stefan–Boltzmann).
 * 2. A one-layer atmosphere that absorbs a fraction ε of the surface's infrared
 *    and emits as much as it absorbs, half up and half down (the textbook
 *    "leaky greenhouse" layer model).
 * 3. The climate's response to a change in CO₂, as in IPCC AR6 WG1 Chapter 7:
 *    a forcing F (W/m²) upsets the balance, the imbalance N = F + λΔT warms the
 *    ocean, and warming reduces the imbalance at a rate set by the feedback
 *    parameter λ (W/m² per °C), the sum of the Planck response and the
 *    feedbacks. The ocean is the two-layer energy-balance model AR6 uses to
 *    emulate its projections (Ch. 7, Box 7.1, Supplementary Material 7.SM.2):
 *    a mixed layer over a deep ocean.
 *
 * Sources of the numbers are given where they are defined. Units: W/m², K or °C,
 * years, ppm, GtCO₂.
 */
import { FIRST_YEAR, FUTURE, HISTORY, LAST_YEAR, SPLIT_YEAR } from './scenarios-data';

// ------------------------------------------------------------------ radiation

/** Stefan–Boltzmann constant, W m⁻² K⁻⁴ (CODATA 2018, exact). */
export const SIGMA = 5.670374419e-8;
/** Total solar irradiance, W/m² (AR6 WG1 §7.2.2; Kopp & Lean 2011). */
export const SOLAR = 1361;
/** Sunlight averaged over the whole sphere: a disc catches it, a sphere four times larger shares it. */
export const INCOMING = SOLAR / 4;
/** Earth's albedo: 100 of the 340 W/m² are reflected (AR6 WG1 Fig. 7.2, after Wild et al. 2015, 2019). */
export const ALBEDO = 100 / 340;
/** Earth's average surface temperature, K (about 15 °C). */
export const T_SURFACE = 288;

export const toCelsius = (k: number) => k - 273.15;

/** Thermal radiation of a black body at temperature `k` kelvin, W/m². */
export const emission = (k: number) => SIGMA * k ** 4;

/** Sunlight absorbed per square metre, averaged over the globe. */
export const absorbedSunlight = (albedo = ALBEDO, solar = SOLAR) => (solar / 4) * (1 - albedo);

/** Temperature of a bare planet at which its infrared balances the absorbed sunlight, K. */
export const bareTemperature = (albedo = ALBEDO, solar = SOLAR) =>
	(absorbedSunlight(albedo, solar) / SIGMA) ** 0.25;

/**
 * Surface temperature under one atmospheric layer that absorbs a fraction `eps`
 * of the surface's infrared. Balance of the layer: ε σTs⁴ = 2 ε σTa⁴. Balance at
 * the top: absorbed sunlight = (1 − ε) σTs⁴ + ε σTa⁴ = (1 − ε/2) σTs⁴.
 */
export const layerSurfaceTemperature = (eps: number, albedo = ALBEDO) =>
	bareTemperature(albedo) / (1 - eps / 2) ** 0.25;

/** The fraction ε for which the layer model gives surface temperature `k`. */
export const absorptionFor = (k: number, albedo = ALBEDO) =>
	2 * (1 - absorbedSunlight(albedo) / emission(k));

/** All the flows of the layer model in balance, W/m². */
export function layerFlows(eps: number, albedo = ALBEDO) {
	const ts = layerSurfaceTemperature(eps, albedo);
	const surface = emission(ts);
	const absorbed = eps * surface;
	return {
		/** Surface temperature, K. */
		ts,
		/** Temperature of the layer, K (Ts / 2^¼, whatever ε). */
		ta: ts / 2 ** 0.25,
		sunlight: absorbedSunlight(albedo),
		reflected: INCOMING - absorbedSunlight(albedo),
		/** Infrared given off by the surface. */
		surface,
		/** The part the layer absorbs. */
		absorbed,
		/** The part that goes straight through to space (the "window"). */
		window: surface - absorbed,
		/** The layer's emission, in each direction: half of what it absorbs. */
		up: absorbed / 2,
		down: absorbed / 2,
		/** Infrared leaving to space: window + layer's upward half. */
		out: surface - absorbed / 2
	};
}

// ------------------------------------------------------------------ forcing

/** CO₂ in 1750, ppm (AR6 WG1 §2.2.3.3: 278.3 ± 2.9). */
export const PPM_PRE = 278;
/**
 * Effective radiative forcing of doubled CO₂, W/m² (AR6 WG1 §7.3.2.1: 3.93 ± 0.47).
 * The older formula of Myhre et al. (1998), 5.35 ln(C/C₀), gives 3.71: the
 * difference is the fast adjustments of the atmosphere that ERF includes.
 */
export const F2X = 3.93;
/** CO₂ forcing, W/m²: logarithmic in the concentration, so each doubling adds the same. */
export const co2Forcing = (ppm: number, ref = PPM_PRE) => (F2X * Math.log(ppm / ref)) / Math.LN2;

// ------------------------------------------------------------------ feedbacks

/**
 * Feedback parameters, W/m² per °C of warming (AR6 WG1 Table 7.10, central
 * estimates). Negative: more energy escapes as the planet warms (stabilising).
 * Water vapour is assessed together with the lapse rate (the change in how fast
 * the air cools with height), which partly offsets it.
 */
export const FEEDBACK = {
	planck: -3.22,
	water: 1.3,
	ice: 0.35,
	clouds: 0.42
} as const;
/** AR6's best estimate of equilibrium climate sensitivity, °C per CO₂ doubling (SPM A.4). */
export const ECS_BEST = 3;
export const ECS_LIKELY: [number, number] = [2.5, 4];
export const ECS_VERY_LIKELY: [number, number] = [2, 5];
/**
 * The net feedback that gives AR6's best-estimate sensitivity: −3.93 / 3 = −1.31.
 * The central values of Table 7.10 add up to −1.16 (a sensitivity of 3.4 °C):
 * AR6's 3 °C combines that process-based estimate with the historical record and
 * past climates. The difference, −0.15, is kept with the Planck response, so that
 * every feedback switched off removes exactly its Table 7.10 value.
 */
export const LAMBDA_ALL = -F2X / ECS_BEST;

export interface Feedbacks {
	water: boolean;
	ice: boolean;
	clouds: boolean;
}
export const ALL_FEEDBACKS: Feedbacks = { water: true, ice: true, clouds: true };
export const NO_FEEDBACKS: Feedbacks = { water: false, ice: false, clouds: false };

/** Net feedback parameter λ, W/m² per °C, with the chosen feedbacks on. */
export function lambda(f: Feedbacks): number {
	return (
		LAMBDA_ALL -
		(f.water ? 0 : FEEDBACK.water) -
		(f.ice ? 0 : FEEDBACK.ice) -
		(f.clouds ? 0 : FEEDBACK.clouds)
	);
}

/** Warming once the planet has caught up with forcing F, °C. */
export const equilibriumWarming = (forcing: number, f: Feedbacks) => -forcing / lambda(f);

/** Equilibrium warming for doubled CO₂, °C. */
export const sensitivity = (f: Feedbacks) => equilibriumWarming(F2X, f);

/**
 * Where the extra energy goes at warming ΔT, W/m²: the sunlight absorbed grows
 * with the ice feedback (melting ice reflects less), the infrared escaping
 * grows with the rest of λ and shrinks with the forcing.
 */
export function budget(forcing: number, dT: number, f: Feedbacks) {
	const lam = lambda(f);
	const sw = f.ice ? FEEDBACK.ice * dT : 0;
	const sunlight = absorbedSunlight() + sw;
	const infrared = absorbedSunlight() - forcing - (lam - (f.ice ? FEEDBACK.ice : 0)) * dT;
	return { sunlight, infrared, imbalance: sunlight - infrared };
}

// ------------------------------------------------------------------ ocean

/**
 * Two-layer ocean: heat capacities in W yr m⁻² K⁻¹, exchange γ in W m⁻² K⁻¹ and
 * the deep-ocean efficacy ε. Medians of the constrained ensemble that AR6 WG1
 * Chapter 7 calibrated to its assessment (file geoff_sample_constrained.csv,
 * C. Smith, https://doi.org/10.5281/zenodo.5211357): 2,237 members, each a
 * CMIP6-like two-layer model (Geoffroy et al. 2013).
 */
export const OCEAN = { mixed: 8.3, deep: 122, exchange: 0.655, efficacy: 1.29 };

export interface OceanState {
	/** Warming of the surface and mixed layer, °C. */
	T: number;
	/** Warming of the deep ocean, °C. */
	Td: number;
}

/** Advances the two-layer model by `years` under forcing F and feedback λ. */
export function stepOcean(s: OceanState, forcing: number, lam: number, years: number): OceanState {
	const n = Math.max(1, Math.ceil(years / 0.1));
	const h = years / n;
	let { T, Td } = s;
	const { mixed, deep, exchange, efficacy } = OCEAN;
	for (let i = 0; i < n; i++) {
		const toDeep = exchange * (T - Td);
		const dT = (forcing + lam * T - efficacy * toDeep) / mixed;
		const dTd = toDeep / deep;
		T += dT * h;
		Td += dTd * h;
	}
	return { T, Td };
}

/** The mixed layer alone: warming after `years` of constant forcing from rest, °C. */
export function mixedLayerWarming(forcing: number, lam: number, years: number, from = 0) {
	const eq = -forcing / lam;
	return eq + (from - eq) * Math.exp((lam * years) / OCEAN.mixed);
}

/**
 * Transient climate response: warming when CO₂ has doubled after rising 1% a
 * year for 70 years, °C (AR6: 1.8, likely 1.4–2.2).
 */
export function transientResponse(f: Feedbacks = ALL_FEEDBACKS): number {
	let s: OceanState = { T: 0, Td: 0 };
	for (let y = 1; y <= 70; y++)
		s = stepOcean(s, co2Forcing(PPM_PRE * 1.01 ** (y - 0.5)), lambda(f), 1);
	return s.T;
}

// ------------------------------------------------------------------ scenarios

export type ScenarioId = keyof typeof FUTURE;
export const SCENARIOS: { id: ScenarioId; name: string; label: string }[] = [
	{ id: 'ssp119', name: 'SSP1-1.9', label: 'very low emissions' },
	{ id: 'ssp126', name: 'SSP1-2.6', label: 'low' },
	{ id: 'ssp245', name: 'SSP2-4.5', label: 'intermediate' },
	{ id: 'ssp370', name: 'SSP3-7.0', label: 'high' },
	{ id: 'ssp585', name: 'SSP5-8.5', label: 'very high' }
];

export interface Year {
	year: number;
	ppm: number;
	/** CO₂ emissions, GtCO₂/yr. */
	emissions: number;
	/** CO₂ emitted since 1850, GtCO₂. */
	cumulative: number;
	/** Forcing of CO₂ and of everything else, W/m². */
	co2: number;
	other: number;
	/** Warming above 1850–1900, °C. */
	T: number;
}

/**
 * A scenario run, 1750–2100: AR6's forcing (CO₂ from the SSP concentrations,
 * plus every other agent: methane, nitrous oxide, aerosols, ozone, land use, the
 * Sun, volcanoes) through the two-layer model. With `co2Only`, only CO₂'s forcing.
 * Temperatures are relative to the model's own 1850–1900 mean, as AR6 reports.
 */
export function scenarioRun(id: ScenarioId, f: Feedbacks = ALL_FEEDBACKS, co2Only = false): Year[] {
	const fut = FUTURE[id];
	const lam = lambda(f);
	const n = SPLIT_YEAR - FIRST_YEAR;
	const out: Year[] = [];
	let s: OceanState = { T: 0, Td: 0 };
	let cumulative = 0;
	for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
		const i = year - FIRST_YEAR;
		const src = i < n ? HISTORY : fut;
		const j = i < n ? i : i - n;
		const co2 = src.co2[j];
		const other = co2Only ? 0 : src.other[j];
		s = stepOcean(s, co2 + other, lam, 1);
		if (year >= 1850) cumulative += src.emissions[j];
		out.push({
			year,
			ppm: src.ppm[j],
			emissions: src.emissions[j],
			cumulative,
			co2,
			other,
			T: s.T
		});
	}
	const base = periodMean(out, 1850, 1900);
	for (const y of out) y.T -= base;
	return out;
}

/** Mean warming over the years a–b inclusive. */
export function periodMean(run: readonly Year[], a: number, b: number): number {
	const s = run.filter((y) => y.year >= a && y.year <= b);
	return s.reduce((x, y) => x + y.T, 0) / s.length;
}

/**
 * IPCC AR6 WG1 SPM Table SPM.1: warming above 1850–1900 assessed from multiple
 * lines of evidence, °C: best estimate and very likely (5–95%) range.
 */
export const SPM1: Record<
	ScenarioId,
	{ near: [number, number, number]; mid: [number, number, number]; long: [number, number, number] }
> = {
	ssp119: { near: [1.5, 1.2, 1.7], mid: [1.6, 1.2, 2.0], long: [1.4, 1.0, 1.8] },
	ssp126: { near: [1.5, 1.2, 1.8], mid: [1.7, 1.3, 2.2], long: [1.8, 1.3, 2.4] },
	ssp245: { near: [1.5, 1.2, 1.8], mid: [2.0, 1.6, 2.5], long: [2.7, 2.1, 3.5] },
	ssp370: { near: [1.5, 1.2, 1.8], mid: [2.1, 1.7, 2.6], long: [3.6, 2.8, 4.6] },
	ssp585: { near: [1.6, 1.3, 1.9], mid: [2.4, 1.9, 3.0], long: [4.4, 3.3, 5.7] }
};
export const PERIODS = {
	near: [2021, 2040],
	mid: [2041, 2060],
	long: [2081, 2100]
} as const;

/** Observed warming 2011–2020 above 1850–1900, °C: best estimate and very likely range (SPM A.1.2). */
export const OBSERVED_2011_2020: [number, number, number] = [1.09, 0.95, 1.2];

/**
 * Transient climate response to cumulative CO₂ emissions, °C per 1000 GtCO₂:
 * best estimate and likely range (SPM D.1.1).
 */
export const TCRE: [number, number, number] = [0.45, 0.27, 0.63];
