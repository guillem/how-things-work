/**
 * A bubble (parcel) of air lifted from the ground: the textbook parcel model.
 *
 * - Air pressure falls with height as in a standard atmosphere (hydrostatic balance, the air
 *   around cooling 6.5 °C per km from the ground's temperature).
 * - Unsaturated, the bubble rises without exchanging heat with its surroundings, so its
 *   temperature follows the dry adiabat T ∝ p^(R/cp): about 9.8 °C colder per kilometre.
 * - The water it carries (its mixing ratio, grams of vapour per kilogram of dry air) stays the
 *   same until the bubble is cold enough for it to be saturated (the Magnus formula, Bolton's
 *   constants). That height is the cloud base, the lifting condensation level.
 * - Above it the bubble stays saturated: vapour turns into droplets, which releases heat, so the
 *   bubble cools more slowly (the pseudo-adiabatic lapse rate of the AMS Glossary).
 * - Sinking, the bubble warms on the dry adiabat again; droplets it still carries evaporate first.
 *   Over the mountain the droplets fall out as rain, so the far side is pure dry warming.
 *
 * Temperatures in °C, heights in m, pressures in hPa, water in g per kg of dry air.
 */

export const G = 9.80665;
/** Gas constant of dry air, J/(kg·K). */
export const RD = 287.04;
/** Specific heat of dry air at constant pressure, J/(kg·K). */
export const CP = 1004.7;
/** Latent heat of vaporisation of water near 0–20 °C, J/kg. */
export const LV = 2.501e6;
/** Ratio of the molar masses of water and dry air. */
export const EPS = 0.622;
export const K0 = 273.15;
/** Sea-level pressure, hPa. */
export const P0 = 1013.25;
/** Lapse rate of the surrounding air (standard atmosphere), °C per m. */
export const ENV_LAPSE = 0.0065;

/** Saturation vapour pressure over liquid water, hPa (Magnus formula, Bolton 1980). */
export function saturationPressure(tC: number): number {
	return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
}

/** Dew point, °C, of air at `tC` with relative humidity `rh` (0–1). */
export function dewPoint(tC: number, rh: number): number {
	const l = Math.log((rh * saturationPressure(tC)) / 6.112);
	return (243.5 * l) / (17.67 - l);
}

/** Water vapour, g per kg of dry air, for a vapour pressure `e` at pressure `p` (hPa). */
export function mixingRatio(e: number, p: number): number {
	return (1000 * EPS * e) / (p - e);
}

/** The vapour pressure, hPa, of air carrying `w` g/kg at pressure `p`. */
function vapourPressure(w: number, p: number): number {
	const r = w / 1000;
	return (r * p) / (EPS + r);
}

/** The most water vapour air at `tC` and `p` can carry, g/kg. */
export function saturationMixingRatio(tC: number, p: number): number {
	return mixingRatio(saturationPressure(tC), p);
}

/** Relative humidity (0–1) of air at `tC` and `p` carrying `w` g/kg of vapour. */
export function relativeHumidity(tC: number, p: number, w: number): number {
	return vapourPressure(w, p) / saturationPressure(tC);
}

/** Air pressure at height `z` m above sea level, on a day whose ground (at sea level) is `groundC`. */
export function pressure(z: number, groundC: number): number {
	const t0 = groundC + K0;
	return P0 * Math.pow(1 - (ENV_LAPSE * z) / t0, G / (RD * ENV_LAPSE));
}

/** Pseudo-adiabatic (saturated) lapse rate, °C per m, at `tC` and `p` (AMS Glossary). */
export function moistLapse(tC: number, p: number): number {
	const T = tC + K0;
	const r = saturationMixingRatio(tC, p) / 1000;
	return (G * (1 + (LV * r) / (RD * T))) / (CP + (LV * LV * r * EPS) / (RD * T * T));
}

/** One moment of the bubble's trip. */
export interface Bubble {
	/** Height above sea level, m. */
	z: number;
	/** Pressure around it, hPa. */
	p: number;
	/** Its temperature, °C. */
	t: number;
	/** Water it carries as invisible vapour, g/kg. */
	vapour: number;
	/** Water it carries as droplets (cloud), g/kg. */
	droplets: number;
	/** Water it has lost as rain so far, g/kg. */
	rained: number;
	/** Its relative humidity (0–1). */
	rh: number;
	/** Its volume compared with what it took up at the start. */
	swell: number;
}

/** A bubble leaving the ground (at sea level) at `groundC` with relative humidity `rh0`. */
export function start(groundC: number, rh0: number): Bubble {
	const p = P0;
	const vapour = mixingRatio(rh0 * saturationPressure(groundC), p);
	return { z: 0, p, t: groundC, vapour, droplets: 0, rained: 0, rh: rh0, swell: 1 };
}

/** Volume per kilogram of dry air, from the gas law with the vapour's own share (virtual temperature). */
function volume(b: Bubble): number {
	const r = b.vapour / 1000;
	return ((b.t + K0) * (1 + r / EPS)) / (1 + r) / b.p;
}

const DZ = 2;

/**
 * Moves the bubble from its height to `z` (up or down), in small steps. Rising saturated, the new
 * droplets stay in the bubble, or fall out as rain if `rain` is set. Sinking, it warms on the dry
 * adiabat, its droplets evaporating first.
 */
export function moveTo(b0: Bubble, z: number, groundC: number, rain = false): Bubble {
	const v0 = volume(b0) / b0.swell;
	let { z: zc, t, vapour, droplets, rained } = b0;
	const dir = Math.sign(z - zc);
	while (dir !== 0 && (z - zc) * dir > 1e-9) {
		const dz = Math.min(DZ, Math.abs(z - zc)) * dir;
		const p = pressure(zc, groundC);
		const p1 = pressure(zc + dz, groundC);
		const ws = saturationMixingRatio(t, p);
		const saturated = vapour >= ws - 1e-9;
		if (dir > 0 && saturated) {
			// Rising and saturated: cool on the moist adiabat (midpoint step) and condense.
			const tm = t - (moistLapse(t, p) * dz) / 2;
			t -= moistLapse(tm, (p + p1) / 2) * dz;
			const ws1 = saturationMixingRatio(t, p1);
			const condensed = Math.max(0, vapour - ws1);
			vapour -= condensed;
			if (rain) rained += condensed + droplets;
			droplets = rain ? 0 : droplets + condensed;
		} else {
			// Dry adiabat: potential temperature conserved.
			const tDry = (t + K0) * Math.pow(p1 / p, RD / CP) - K0;
			if (dir < 0 && droplets > 0) {
				// Sinking with droplets: they evaporate and keep it on the moist adiabat.
				const tm = t + (moistLapse(t, p) * -dz) / 2;
				const tMoist = t + moistLapse(tm, (p + p1) / 2) * -dz;
				const room = saturationMixingRatio(tMoist, p1) - vapour;
				if (room < droplets) {
					droplets -= Math.max(0, room);
					vapour += Math.max(0, room);
					t = tMoist;
				} else {
					vapour += droplets;
					droplets = 0;
					t = tDry;
				}
			} else {
				t = tDry;
				// A dry step can just reach saturation: keep the vapour at most saturated.
				const ws1 = saturationMixingRatio(t, p1);
				if (dir > 0 && vapour > ws1) {
					const condensed = vapour - ws1;
					vapour = ws1;
					if (rain) rained += condensed;
					else droplets += condensed;
				}
			}
		}
		zc += dz;
	}
	const p = pressure(zc, groundC);
	const b = { z: zc, p, t, vapour, droplets, rained, rh: 0, swell: 1 };
	b.rh = Math.min(1, relativeHumidity(t, p, vapour));
	b.swell = volume(b) / v0;
	return b;
}

/** Height, m, at which a bubble from the ground turns into cloud (the lifting condensation level). */
export function cloudBase(groundC: number, rh0: number): number {
	if (rh0 >= 1) return 0;
	const b = start(groundC, rh0);
	// Dry ascent keeps the vapour fixed: find where it becomes saturated, by bisection.
	const sat = (z: number) => {
		const p = pressure(z, groundC);
		const t = (groundC + K0) * Math.pow(p / P0, RD / CP) - K0;
		return saturationMixingRatio(t, p) - b.vapour;
	};
	let lo = 0;
	let hi = 8000;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (sat(mid) > 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Samples of a bubble rising from the ground to `top`, every `step` m (for drawing and readouts). */
export function climb(groundC: number, rh0: number, top: number, step = 10): Bubble[] {
	const out: Bubble[] = [start(groundC, rh0)];
	for (let z = step; z <= top + 1e-9; z += step) {
		out.push(moveTo(out[out.length - 1], z, groundC));
	}
	return out;
}

/** The sample of `climb` at height `z` (nearest). */
export function at(samples: Bubble[], z: number): Bubble {
	if (samples.length < 2) return samples[0];
	const step = samples[1].z - samples[0].z;
	const i = Math.max(0, Math.min(samples.length - 1, Math.round(z / step)));
	return samples[i];
}

// ---- the mountain ---------------------------------------------------------------------------

/** The mountain's height, m, and its ground's temperature and humidity. */
export const MOUNTAIN = { height: 2000, groundC: 20, rh: 0.7 };

/**
 * The bubble's trip over the mountain, `u` from 0 (the plain on the windy side) to 1 (the plain on
 * the far side). It follows the ground: flat to u = 0.2, up to the top at u = 0.5, down to the far
 * plain at u = 0.8. Its droplets fall out as rain on the way up.
 */
export function groundHeight(u: number, height = MOUNTAIN.height): number {
	if (u <= 0.2 || u >= 0.8) return 0;
	const s = u < 0.5 ? (u - 0.2) / 0.3 : (0.8 - u) / 0.3;
	// A smooth hill: steepest halfway up.
	return height * (s * s * (3 - 2 * s));
}

export interface Trip {
	at: (u: number) => Bubble;
	/** Where (u) the bubble turns into cloud on the way up, or null if it never does. */
	cloudFrom: number | null;
	top: Bubble;
	end: Bubble;
}

export function overMountain(
	groundC = MOUNTAIN.groundC,
	rh0 = MOUNTAIN.rh,
	height = MOUNTAIN.height
): Trip {
	const N = 400;
	const samples: Bubble[] = [start(groundC, rh0)];
	for (let i = 1; i <= N; i++) {
		samples.push(moveTo(samples[i - 1], groundHeight(i / N, height), groundC, true));
	}
	const base = cloudBase(groundC, rh0);
	let cloudFrom: number | null = null;
	if (base < height) {
		for (let i = 0; i <= N / 2; i++) {
			if (groundHeight(i / N, height) >= base) {
				cloudFrom = i / N;
				break;
			}
		}
	}
	return {
		at: (u) => samples[Math.max(0, Math.min(N, Math.round(u * N)))],
		cloudFrom,
		top: samples[N / 2],
		end: samples[N]
	};
}

// ---- droplets ---------------------------------------------------------------------------------

/** Viscosity of air near 10 °C, Pa·s. */
const MU_AIR = 1.77e-5;

/** Fall speed, m/s, of a water droplet of radius `r` m in still air (Stokes' law, small drops). */
export function fallSpeed(r: number): number {
	const rhoWater = 1000;
	const rhoAir = 1.2;
	return ((2 / 9) * (rhoWater - rhoAir) * G * r * r) / MU_AIR;
}

/** A typical cloud droplet's radius, m (a fiftieth of a millimetre across). */
export const DROPLET_RADIUS = 10e-6;

/** How fast the air in a fair-weather thermal rises, m/s (typically 1 to 3). */
export const THERMAL_SPEED = 2;

// ---- the day on the cloud steps ------------------------------------------------------------------

/** The sunny day of the cloud steps: ground temperature, humidity, and how high the thermals reach. */
export const DAY = { groundC: 25, rh: 0.55, thermalTop: 2000 };
