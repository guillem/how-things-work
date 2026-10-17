/**
 * The air a plane flies in, and a real light aircraft flying in it.
 *
 * Atmosphere: the lowest layer (troposphere, below 11 km) of the U.S. Standard
 * Atmosphere, 1976 (NOAA-S/T 76-1562), from its defining constants: sea-level 288.15 K
 * and 101 325 Pa, temperature falling 6.5 K per geopotential kilometre. The rockets
 * explainer uses the same standard's tables (src/routes/rockets/us76.ts); the model test
 * checks one against the other.
 *
 * Aircraft: the Cessna 172S Skyhawk SP, from its Pilot's Operating Handbook (Cessna
 * Aircraft Company, Model 172S, original issue 8 July 1998, revision 5, 19 July 2004):
 * maximum weight 2550 lb; wing area 174 sq ft; span 36 ft 1 in (with strobe lights);
 * stall speed flaps up, power off, 53 KCAS at 2550 lb; maximum glide 68 KIAS with the
 * propeller windmilling, flaps up (Fig. 3-1: about 1.49 nautical miles per 1000 ft of
 * height, read off the chart); airspeed calibration 60 → 62 and 70 → 70 KCAS (flaps up).
 * Its wing section is the NACA 2412 (D. Lednicer, The Incomplete Guide to Airfoil Usage,
 * m-selig.ae.illinois.edu/ads/aircraft.html).
 *
 * Model: lift L = ½ρV²·S·C_L; a parabolic drag polar C_D = C_D0 + k·C_L², with C_D0 and
 * k fitted to the handbook's best glide (where C_D0 = k·C_L² and L/D is largest); steady
 * flight along a straight path with thrust along it, so L = W cos γ and
 * T − D = W sin γ for a climb angle γ. Calibrated airspeed is taken equal to equivalent
 * airspeed (V·√(ρ/ρ₀)), fine below about 150 kt.
 */
import { naca4ZeroLift } from './aero.ts';

const G0 = 9.80665;
const LB = 0.45359237;
export const FT = 0.3048;
const NM = 1852;
export const KT = NM / 3600;

// ---- standard atmosphere ---------------------------------------------------------------

const T0 = 288.15;
const P0 = 101325;
const LAPSE = 0.0065;
const R_AIR = 287.05287;
const R_EARTH = 6356766;
const EXPONENT = G0 / (R_AIR * LAPSE);
export const RHO0 = P0 / (R_AIR * T0);

/** Temperature (K), pressure (Pa) and density (kg/m³) at a height h (m) below 11 km. */
export function atmosphere(h: number) {
	const H = (R_EARTH * h) / (R_EARTH + h);
	const T = T0 - LAPSE * H;
	const p = P0 * (T / T0) ** EXPONENT;
	return { T, p, rho: p / (R_AIR * T) };
}
export const density = (h: number) => atmosphere(h).rho;

// ---- the Cessna 172S ---------------------------------------------------------------------

export const C172 = {
	mass: 2550 * LB,
	area: 174 * FT * FT,
	span: (36 + 1 / 12) * FT,
	/** Stall, flaps up, power off, calibrated airspeed (kt). */
	stallKcas: 53,
	/** Best glide, indicated (kt) and calibrated by the handbook's table (kt). */
	glideKias: 68,
	glideKcas: 62 + ((70 - 62) * (68 - 60)) / (70 - 60),
	/** Glide distance per height, nautical miles per 1000 ft (Fig. 3-1). */
	glideNmPer1000ft: 1.49
};
export const WEIGHT = C172.mass * G0;
export const ASPECT = C172.span ** 2 / C172.area;
/** Mean chord: wing area over span. */
export const CHORD = C172.area / C172.span;

/** Dynamic pressure ½ρV² (Pa). */
export const dynamicPressure = (rho: number, v: number) => 0.5 * rho * v * v;

/** Lift (N) of a wing of area S at true airspeed v (m/s) and lift coefficient C_L. */
export const lift = (rho: number, v: number, area: number, cl: number) =>
	dynamicPressure(rho, v) * area * cl;

/** The lift coefficient the 172 needs to carry a force `load` (N) at speed v. */
export const clNeeded = (rho: number, v: number, load = WEIGHT) =>
	load / (dynamicPressure(rho, v) * C172.area);

/** The largest lift coefficient of the whole aircraft, from its stall speed. */
export const CL_MAX = clNeeded(RHO0, C172.stallKcas * KT);

/** True airspeed (m/s) for a calibrated (≈ equivalent) airspeed at height h. */
const trueFromCalibrated = (vc: number, h: number) => vc * Math.sqrt(RHO0 / density(h));
export const calibratedFromTrue = (v: number, h: number) => v * Math.sqrt(density(h) / RHO0);

/** True stall speed (m/s) at height h. */
export const stallSpeed = (h: number) => trueFromCalibrated(C172.stallKcas * KT, h);

// drag polar fitted to the best glide
export const GLIDE_RATIO = (C172.glideNmPer1000ft * NM) / (1000 * FT);
export const CL_GLIDE = clNeeded(RHO0, C172.glideKcas * KT);
/** Zero-lift drag coefficient: at best glide it is half the total. */
export const CD0 = CL_GLIDE / (2 * GLIDE_RATIO);
/** Induced-drag factor k in C_D = C_D0 + k·C_L². */
export const K_INDUCED = CD0 / CL_GLIDE ** 2;
/** Oswald efficiency: k = 1/(π e A). */
export const OSWALD = 1 / (Math.PI * ASPECT * K_INDUCED);

export const dragCoefficient = (cl: number) => CD0 + K_INDUCED * cl * cl;

/** Drag of the 172 in level flight at true airspeed v (m/s) and density ρ, split in two. */
export function drag(rho: number, v: number, load = WEIGHT) {
	const qS = dynamicPressure(rho, v) * C172.area;
	const cl = load / qS;
	const parasite = qS * CD0;
	const induced = qS * K_INDUCED * cl * cl;
	return { cl, parasite, induced, total: parasite + induced };
}

/** Calibrated airspeed (m/s) of least drag: where the two parts of the drag are equal. */
export const MIN_DRAG_SPEED = Math.sqrt(
	(2 * WEIGHT) / (RHO0 * C172.area * Math.sqrt(CD0 / K_INDUCED))
);

// ---- the wing's angle of attack ---------------------------------------------------------

/** Zero-lift angle of the NACA 2412 (rad), thin-airfoil theory. */
export const ALPHA_L0 = naca4ZeroLift(0.02, 0.4);
/**
 * Lift slope of a wing of finite span (per rad), from Prandtl's lifting-line theory for an
 * elliptical wing: 2π/(1 + 2/A). Air spilling round the tips makes it shallower than a
 * section's 2π.
 */
export const WING_SLOPE = (2 * Math.PI) / (1 + 2 / ASPECT);
/** Angle of attack (rad) for a lift coefficient. */
export const angleFor = (cl: number) => ALPHA_L0 + cl / WING_SLOPE;

// ---- steady flight -------------------------------------------------------------------

interface FlightState {
	/** Lift coefficient needed, and whether that is beyond the stall. */
	cl: number;
	stalled: boolean;
	alpha: number;
	lift: number;
	drag: number;
	thrust: number;
	/** Climb angle (rad) and rate of climb (m/s). */
	gamma: number;
	climb: number;
}

/**
 * Steady flight at true airspeed v (m/s), height h (m) and thrust T (N): the climb angle
 * with T − D = W sin γ and L = W cos γ. Below the stall speed there is no steady state:
 * the wing cannot carry the weight and `stalled` is set.
 */
export function steady(v: number, h: number, thrust: number): FlightState {
	const rho = density(h);
	let gamma = 0;
	let d = drag(rho, v);
	for (let i = 0; i < 8; i++) {
		d = drag(rho, v, WEIGHT * Math.cos(gamma));
		gamma = Math.asin(Math.max(-1, Math.min(1, (thrust - d.total) / WEIGHT)));
	}
	const cl = d.cl;
	return {
		cl,
		stalled: cl > CL_MAX,
		alpha: angleFor(Math.min(cl, CL_MAX)),
		lift: WEIGHT * Math.cos(gamma),
		drag: d.total,
		thrust,
		gamma,
		climb: v * Math.sin(gamma)
	};
}
