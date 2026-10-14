/**
 * A small box model of the global carbon cycle, in gigatonnes of carbon (GtC).
 *
 * Boxes: the atmosphere; plants and soils (two pools); the ocean in three
 * layers (the sunlit mixed layer, the thermocline below it and the deep
 * ocean); fossil fuels. Rock is drawn but held fixed: its flows (volcanoes,
 * weathering, burial) are tenths of a gigatonne a year and only matter over
 * tens of thousands of years.
 *
 * The model follows only the carbon that people add (the perturbation): the
 * natural flows are in balance before 1750 and stay so, apart from two
 * responses to extra CO₂ in the air:
 *
 * - The ocean: CO₂ dissolves across the sea surface at a rate set by the
 *   difference in CO₂ pressure between air and water. The water's CO₂ pressure
 *   comes from real seawater carbonate chemistry (dissolved inorganic carbon,
 *   fixed alkalinity, borate and water; equilibrium constants of Lueker et al.
 *   2000, Weiss 1974, Dickson 1990 and Millero 1995 at 18 °C and salinity 35),
 *   so the surface water's capacity to take more falls as it fills up
 *   (the Revelle buffer factor). Water carries the extra carbon down to the
 *   thermocline and, much more slowly, to the deep.
 * - Plants: extra CO₂ makes photosynthesis a little faster (CO₂ fertilisation,
 *   net primary production × (1 + β ln(C/C₀))). The extra carbon passes from
 *   plants to soils and back to the air through decay.
 *
 * Land-use change (mainly deforestation) is prescribed as a flow from plants to
 * the air, kept in its own account the way the Global Carbon Budget does: its
 * figure already includes regrowth, so the cleared carbon does not grow back
 * here. Warming's effect on the sinks is left out.
 *
 * Sources of the numbers: see `data.ts`.
 */
import { AIR_2024, PRE, NATURAL } from './data';
import * as gcb from './gcb2025';

export const GTC_PER_PPM = 2.124;
export const GTCO2_PER_GTC = 3.664;

// ------------------------------------------------------------------ seawater chemistry

const TEMP_C = 18;
const SALINITY = 35;

interface Constants {
	K0: number;
	K1: number;
	K2: number;
	KB: number;
	KW: number;
	BT: number;
}

function constants(tc: number, S: number): Constants {
	const T = tc + 273.15;
	const sq = Math.sqrt(S);
	// Lueker, Dickson & Keeling (2000), total pH scale
	const pK1 = 3633.86 / T - 61.2172 + 9.6777 * Math.log(T) - 0.011555 * S + 0.0001152 * S * S;
	const pK2 = 471.78 / T + 25.929 - 3.16967 * Math.log(T) - 0.01781 * S + 0.0001122 * S * S;
	// Weiss (1974), mol kg⁻¹ atm⁻¹
	const lnK0 =
		-60.2409 +
		93.4517 * (100 / T) +
		23.3585 * Math.log(T / 100) +
		S * (0.023517 - 0.023656 * (T / 100) + 0.0047036 * (T / 100) ** 2);
	// Dickson (1990)
	const lnKB =
		(-8966.9 - 2890.53 * sq - 77.942 * S + 1.728 * S * sq - 0.0996 * S * S) / T +
		(148.0248 + 137.1942 * sq + 1.62142 * S) +
		(-24.4344 - 25.085 * sq - 0.2474 * S) * Math.log(T) +
		0.053105 * sq * T;
	// Millero (1995)
	const lnKW =
		148.9652 -
		13847.26 / T -
		23.6521 * Math.log(T) +
		(118.67 / T - 5.977 + 1.0495 * Math.log(T)) * sq -
		0.01615 * S;
	return {
		K0: Math.exp(lnK0),
		K1: 10 ** -pK1,
		K2: 10 ** -pK2,
		KB: Math.exp(lnKB),
		KW: Math.exp(lnKW),
		// total boron, Uppström (1974)
		BT: 0.000416 * (S / 35)
	};
}

const K = constants(TEMP_C, SALINITY);

/** Surface seawater's alkalinity, mol/kg: a typical value (GLODAP), held fixed. */
export const ALKALINITY = 2300e-6;

/** Hydrogen ion concentration (mol/kg) of seawater with dissolved inorganic carbon `dic` (mol/kg). */
function hydrogen(dic: number): number {
	const { K1, K2, KB, KW, BT } = K;
	// Alkalinity as a function of [H⁺] falls monotonically: bisect on log10[H⁺].
	let lo = -10;
	let hi = -6;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		const h = 10 ** mid;
		const carb = (dic * (K1 * h + 2 * K1 * K2)) / (h * h + K1 * h + K1 * K2);
		const alk = carb + (BT * KB) / (KB + h) + KW / h - h;
		// Too much alkalinity at this [H⁺] → the water is more acidic (larger [H⁺]).
		if (alk > ALKALINITY) lo = mid;
		else hi = mid;
	}
	return 10 ** ((lo + hi) / 2);
}

/** CO₂ partial pressure (µatm ≈ ppm) of seawater with `dic` mol/kg. */
export function seawaterPCO2(dic: number): number {
	const h = hydrogen(dic);
	const { K0, K1, K2 } = K;
	const co2 = (dic * h * h) / (h * h + K1 * h + K1 * K2);
	return (co2 / K0) * 1e6;
}

/** pH (total scale) of seawater with `dic` mol/kg. */
export function seawaterPH(dic: number): number {
	return -Math.log10(hydrogen(dic));
}

/** Surface DIC (mol/kg) in equilibrium with `ppm` of CO₂ in the air. */
export function dicFor(ppm: number): number {
	let lo = 1500e-6;
	let hi = 2600e-6;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (seawaterPCO2(mid) < ppm) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/**
 * Revelle buffer factor: the relative change in seawater CO₂ pressure per
 * relative change in its dissolved carbon. About 10: the water's CO₂ pressure
 * rises ten times faster than its carbon content.
 */
export function revelle(dic: number): number {
	const d = dic * 1e-4;
	const p = seawaterPCO2(dic);
	return (seawaterPCO2(dic + d) - p) / p / (d / dic);
}

// ------------------------------------------------------------------ the boxes

/** Pre-industrial CO₂ (ppm) and the matching surface-water carbon. */
export const PPM0 = PRE.atmosphere / GTC_PER_PPM;
const DIC0 = dicFor(PPM0);

/** Water masses (kg): the mixed layer holds `PRE.surfaceOcean` GtC at DIC0. */
const MOL_PER_GTC = 1e15 / 12.011;
const M_SURF = (PRE.surfaceOcean * MOL_PER_GTC) / DIC0;
/** The rest of the ocean (1.37 × 10²¹ kg in all), split into thermocline and deep. */
const OCEAN_MASS = 1.37e21;
export const THERMOCLINE_SHARE = 0.25;
const M_THERMO = (OCEAN_MASS - M_SURF) * THERMOCLINE_SHARE;
const M_DEEP = OCEAN_MASS - M_SURF - M_THERMO;

export interface Params {
	/** CO₂ fertilisation: fractional rise in plant growth per e-fold of CO₂. */
	beta: number;
	/** Air–sea gas exchange, GtC/yr per ppm of pressure difference. */
	gasExchange: number;
	/** Water exchanged between mixed layer and thermocline, kg/yr. */
	mixUpper: number;
	/** Water exchanged between thermocline and deep ocean, kg/yr. */
	mixDeep: number;
}

/** Water carried down out of the mixed layer by subduction (AR6 Fig. 5.12: 275 GtC/yr), kg/yr. */
export const SUBDUCTION_WATER = (NATURAL.subduction * MOL_PER_GTC) / DIC0;

/**
 * Default parameters. Gas exchange comes straight from the natural flows (IPCC
 * AR6 Fig. 5.12: 54 GtC/yr enters the ocean from 278 ppm of air). The rest are
 * calibrated so that the model's concentration-driven history (see `history`)
 * takes up what the Global Carbon Budget 2025 says the land and ocean took up
 * in 2015–2024 (2.4 and 3.2 GtC/yr), and keeps a pulse of CO₂ in the air about
 * as long as the multi-model mean of Joos et al. (2013, Atmos. Chem. Phys. 13,
 * 2793): β = 0.27 is within the range simple models use (0.2–0.6); the upper
 * mixing is 55% of the water AR6's subduction flux carries (about 200
 * sverdrups: not all subducted water reaches the thermocline box); the deep
 * mixing, 8 × 10¹⁷ kg/yr, is about 25 sverdrups, the strength of the deep
 * overturning circulation.
 */
export const DEFAULTS: Params = {
	beta: 0.27,
	gasExchange: NATURAL.oceanIn / PPM0,
	mixUpper: 0.55 * SUBDUCTION_WATER,
	mixDeep: 8e17
};

/** The carbon people have added to each box since 1750, GtC. */
export interface State {
	atmosphere: number;
	plants: number;
	soils: number;
	surface: number;
	thermocline: number;
	deep: number;
	/** Carbon cleared from plants by land-use change (counted negative on land). */
	cleared: number;
	/** Fossil carbon burnt so far. */
	burnt: number;
}

export const ZERO: State = {
	atmosphere: 0,
	plants: 0,
	soils: 0,
	surface: 0,
	thermocline: 0,
	deep: 0,
	cleared: 0,
	burnt: 0
};

export interface Fluxes {
	/** Net flow air → ocean surface. */
	ocean: number;
	/** Net flow air → plants and soils from the environment (the "land sink"). */
	land: number;
	/** CO₂ partial pressure of the air and of the surface water, ppm. */
	ppm: number;
	waterPPM: number;
}

export const surfaceDIC = (s: State) => DIC0 + (s.surface * MOL_PER_GTC) / M_SURF;

/** The perturbation fluxes, GtC/yr, at state `s` (emissions not included). */
function fluxes(s: State, p: Params) {
	const ppm = (PRE.atmosphere + s.atmosphere) / GTC_PER_PPM;
	const waterPPM = seawaterPCO2(surfaceDIC(s));
	const airSea = p.gasExchange * (ppm - waterPPM);
	const cS = (s.surface * MOL_PER_GTC) / M_SURF;
	const cT = (s.thermocline * MOL_PER_GTC) / M_THERMO;
	const cD = (s.deep * MOL_PER_GTC) / M_DEEP;
	const down1 = (p.mixUpper * (cS - cT)) / MOL_PER_GTC;
	const down2 = (p.mixDeep * (cT - cD)) / MOL_PER_GTC;
	const growth = NATURAL.npp * p.beta * Math.log(ppm / PPM0);
	const litter = (NATURAL.npp * s.plants) / PRE.plants;
	const decay = (NATURAL.npp * s.soils) / PRE.soils;
	return { ppm, waterPPM, airSea, down1, down2, growth, litter, decay };
}

/**
 * Rates of change of every box. With `forcedAir` set, the atmosphere follows
 * that rate (GtC/yr) instead of the emissions: a concentration-driven run.
 */
function derivative(
	s: State,
	p: Params,
	fossil: number,
	luc: number,
	forcedAir: number | null = null
): State {
	const f = fluxes(s, p);
	return {
		atmosphere: forcedAir ?? fossil + luc - f.airSea - f.growth + f.decay,
		plants: f.growth - f.litter,
		soils: f.litter - f.decay,
		surface: f.airSea - f.down1,
		thermocline: f.down1 - f.down2,
		deep: f.down2,
		cleared: luc,
		burnt: fossil
	};
}

const KEYS = Object.keys(ZERO) as (keyof State)[];
function add(a: State, b: State, k: number): State {
	const out = { ...a };
	for (const key of KEYS) out[key] = a[key] + b[key] * k;
	return out;
}

const SUBSTEPS = 4;

/**
 * Advance one year with constant emissions (RK4, quarter-year steps). With
 * `forcedAir`, the atmosphere changes at that rate whatever the emissions.
 */
export function stepYear(
	s: State,
	fossil: number,
	luc: number,
	p: Params = DEFAULTS,
	forcedAir: number | null = null
): State {
	const h = 1 / SUBSTEPS;
	let x = s;
	for (let i = 0; i < SUBSTEPS; i++) {
		const k1 = derivative(x, p, fossil, luc, forcedAir);
		const k2 = derivative(add(x, k1, h / 2), p, fossil, luc, forcedAir);
		const k3 = derivative(add(x, k2, h / 2), p, fossil, luc, forcedAir);
		const k4 = derivative(add(x, k3, h), p, fossil, luc, forcedAir);
		const next = { ...x };
		for (const key of KEYS)
			next[key] = x[key] + (h / 6) * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]);
		x = next;
	}
	return x;
}

/** The sinks at state `s`: net ocean and land uptake, GtC/yr. */
export function sinks(s: State, p: Params = DEFAULTS): Fluxes {
	const f = fluxes(s, p);
	return { ocean: f.airSea, land: f.growth - f.decay, ppm: f.ppm, waterPPM: f.waterPPM };
}

/** Totals people would see: extra carbon in air, ocean and land (land net of clearing). */
export function totals(s: State) {
	return {
		air: s.atmosphere,
		ocean: s.surface + s.thermocline + s.deep,
		land: s.plants + s.soils - s.cleared,
		/** The land's response to extra CO₂ alone (the budget's cumulative land sink). */
		landSink: s.plants + s.soils,
		burnt: s.burnt
	};
}

export const ppmOf = (s: State) => (PRE.atmosphere + s.atmosphere) / GTC_PER_PPM;
export const pHOf = (s: State) => seawaterPH(surfaceDIC(s));

// ------------------------------------------------------------------ history, 1750–2024

export interface Year {
	year: number;
	/** The state at the end of the year. */
	state: State;
	/** Ocean and land uptake during the year, GtC. */
	ocean: number;
	land: number;
	/** The observed atmospheric growth during the year, GtC. */
	air: number;
}

/**
 * The observed atmosphere year by year, GtC above 1750. GCB 2025 gives 590 GtC
 * in 1750 and 898 in 2024, but the sum of its annual growth series over
 * 1751–2024 is 312 GtC (ice cores before 1959, air samples after). The air
 * samples are precise, so only the ice-core years are scaled to make the two
 * agree.
 */
const AIR_SAMPLES_FROM = 1959;
function observedAir(): number[] {
	const growth = gcb.atm.map((g) => g ?? 0);
	const sampled = (i: number) => gcb.FIRST_YEAR + i >= AIR_SAMPLES_FROM;
	let pre = 0;
	let post = 0;
	growth.forEach((g, i) => (sampled(i) ? (post += g) : (pre += g)));
	const k = (AIR_2024 - PRE.atmosphere - post) / pre;
	let sum = 0;
	return growth.map((g, i) => (sum += sampled(i) ? g : g * k));
}

/**
 * The model's history, 1750–2024: concentration-driven, the way climate
 * models are checked against the past. The atmosphere follows the observed
 * record; the model works out what the ocean and plants took up. Fossil
 * burning and land clearing follow the Global Carbon Budget's emissions.
 */
export function history(p: Params = DEFAULTS): Year[] {
	const air = observedAir();
	const out: Year[] = [];
	let s: State = ZERO;
	for (let i = 0; i < air.length; i++) {
		const before = totals(s);
		const target = air[i];
		const next = stepYear(s, gcb.fossil[i], gcb.luc[i], p, target - s.atmosphere);
		// Pin the atmosphere exactly on the record (RK4 already lands on it).
		next.atmosphere = target;
		const after = totals(next);
		out.push({
			year: gcb.FIRST_YEAR + i,
			state: next,
			ocean: after.ocean - before.ocean,
			land: after.landSink - before.landSink,
			air: after.air - before.air
		});
		s = next;
	}
	return out;
}

let cached: Year[] | null = null;
/** The model's state at the end of 2024 (default parameters). */
export function today(): State {
	cached ??= history();
	return cached[cached.length - 1].state;
}
export function historyDefault(): Year[] {
	cached ??= history();
	return cached;
}

// ------------------------------------------------------------------ experiments

/**
 * Sustained emissions from the end of 2024: `fossil` and `luc` GtC/yr for
 * `years` years, then nothing, followed to `horizon` years. Returns the state
 * at the end of each year (index 0 = end of 2024).
 */
export function future(
	fossil: number,
	luc: number,
	years: number,
	horizon: number,
	p: Params = DEFAULTS,
	start: State = today()
): State[] {
	const out = [start];
	let s = start;
	for (let y = 1; y <= horizon; y++) {
		const on = y <= years;
		s = stepYear(s, on ? fossil : 0, on ? luc : 0, p);
		out.push(s);
	}
	return out;
}

export interface PulseShare {
	air: number;
	ocean: number;
	land: number;
}

/**
 * Where a pulse of `size` GtC is after each year, up to `horizon`, as shares
 * of the pulse, measured the way Joos et al. (2013) do: added on top of
 * today's air, held steady otherwise (a control run whose emissions just
 * match the sinks), and read as the difference between the two runs.
 */
export function pulseShares(size: number, horizon: number, p: Params = DEFAULTS): PulseShare[] {
	const base = today();
	let control = base;
	let run: State = { ...base, atmosphere: base.atmosphere + size };
	const out: PulseShare[] = [{ air: 1, ocean: 0, land: 0 }];
	for (let y = 1; y <= horizon; y++) {
		const k = sinks(control, p);
		const e = k.ocean + k.land;
		control = stepYear(control, e, 0, p);
		run = stepYear(run, e, 0, p);
		const a = totals(run);
		const c = totals(control);
		out.push({
			air: (a.air - c.air) / size,
			ocean: (a.ocean - c.ocean) / size,
			land: (a.landSink - c.landSink) / size
		});
	}
	return out;
}

/** The share of a pulse still in the air after each year (see `pulseShares`). */
export const pulse = (size: number, horizon: number, p: Params = DEFAULTS): number[] =>
	pulseShares(size, horizon, p).map((s) => s.air);
