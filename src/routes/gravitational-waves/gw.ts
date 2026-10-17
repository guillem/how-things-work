/**
 * The physics behind the gravitational-waves explainer, in SI units with masses
 * in solar masses.
 *
 * - Quadrupole radiation from a binary (Peters & Mathews 1963; Peters 1964): the
 *   power of a Keplerian orbit, with the eccentricity factor, and the shrinking
 *   period of the Hulse–Taylor pulsar.
 * - The inspiral at leading (Newtonian, quadrupole) order: chirp mass, the
 *   frequency and phase against time to coalescence, df/dt ∝ M_c^(5/3) f^(11/3),
 *   the number of cycles, and the strain amplitude at a distance for a source
 *   seen face-on and overhead. The model chirp stops at the innermost stable
 *   circular orbit (ISCO) of the total mass, where this approximation fails.
 * - The remnant, from fits to numerical-relativity simulations of non-spinning
 *   black holes: final mass (Barausse, Morozova & Rezzolla 2012), final spin
 *   (Barausse & Rezzolla 2009) and the ringing frequency and damping of its
 *   l = m = 2 mode (Berti, Cardoso & Will 2006).
 * - A Michelson interferometer's differential arm length, ΔL = h·L.
 * - Reading the chirp mass off measured data: the frequency from the spacing of
 *   zero crossings, and the leading-order f(t) fitted to it.
 */

export const G = 6.6743e-11; // m³ kg⁻¹ s⁻²
export const C = 299_792_458; // m/s
export const GM_SUN = 1.32712440041e20; // m³/s² (IAU 2015 nominal)
export const M_SUN = GM_SUN / G; // kg
export const GM_EARTH = 3.986004418e14; // m³/s²
/** G M☉ / c³: the Sun's mass as a time, 4.93 µs. */
const T_SUN = GM_SUN / C ** 3;
/** G M☉ / c²: the Sun's mass as a length, 1.48 km. */
export const L_SUN = GM_SUN / C ** 2;
export const AU = 1.495978707e11; // m
const PC = 3.0856775814913e16; // m
export const MPC = 1e6 * PC;
const DAY = 86_400;
export const YEAR = 365.25 * DAY;
/** c⁵/G, the natural unit of gravitational-wave power: 3.6 × 10⁵² W. */
export const PLANCK_POWER = C ** 5 / G;
/** Proton charge radius (CODATA 2018), m. Its diameter is about 1.7 fm. */
export const PROTON_RADIUS = 0.8414e-15;
/** Length of a LIGO arm, m. */
export const LIGO_ARM = 3995;
/** Distance between the two LIGO sites, m (light takes 10 ms). */
export const LIGO_BASELINE = 3.002e6;

// ---------------------------------------------------------------- masses

/** Chirp mass (m₁m₂)^(3/5)/(m₁+m₂)^(1/5), the one combination the inspiral depends on. */
export const chirpMass = (m1: number, m2: number) => (m1 * m2) ** 0.6 / (m1 + m2) ** 0.2;
/** Symmetric mass ratio η = m₁m₂/(m₁+m₂)², ¼ for equal masses. */
const eta = (m1: number, m2: number) => (m1 * m2) / (m1 + m2) ** 2;
/** Smallest total mass for a given chirp mass (equal masses): 2^(6/5) M_c. */
export const minTotalMass = (mc: number) => 2 ** 1.2 * mc;
/** Masses m₁ ≥ m₂ with chirp mass `mc` and ratio q = m₂/m₁ ≤ 1. */
export function massesFor(mc: number, q: number): [number, number] {
	const m1 = (mc * (1 + q) ** 0.2) / q ** 0.6;
	return [m1, q * m1];
}

/** Schwarzschild radius 2Gm/c² of a mass in suns, m. */
export const horizonRadius = (m: number) => 2 * m * L_SUN;

// ---------------------------------------------------------------- orbits

/** Separation of a circular orbit (Kepler) emitting at gravitational-wave frequency f, m. */
export const separation = (M: number, fgw: number) =>
	Math.cbrt((M * GM_SUN) / (Math.PI * fgw) ** 2);
/** Gravitational-wave frequency of a circular orbit of separation a (twice the orbital one), Hz. */
export const gwFrequency = (M: number, a: number) => Math.sqrt((M * GM_SUN) / a ** 3) / Math.PI;
/** Relative orbital speed at separation a, m/s. */
export const orbitalSpeed = (M: number, a: number) => Math.sqrt((M * GM_SUN) / a);
/** Gravitational-wave frequency at the ISCO, 6GM/c² (Schwarzschild), Hz: ≈ 4400 Hz/(M/M☉). */
export const iscoFrequency = (M: number) => 1 / (6 ** 1.5 * Math.PI * M * T_SUN);

/** Peters' eccentricity enhancement of the radiated power, f(e). */
export const eccentricityFactor = (e: number) =>
	(1 + (73 / 24) * e ** 2 + (37 / 96) * e ** 4) / (1 - e ** 2) ** 3.5;

/**
 * Power radiated in gravitational waves by two masses (kg) in a Keplerian orbit of
 * semi-major axis a and eccentricity e, averaged over an orbit (quadrupole formula), W.
 */
export function radiatedPower(m1kg: number, m2kg: number, a: number, e = 0) {
	return (
		((32 / 5) * G ** 4 * (m1kg * m2kg) ** 2 * (m1kg + m2kg) * eccentricityFactor(e)) /
		(C ** 5 * a ** 5)
	);
}

/** Rate at which the orbital period shrinks (dimensionless dP/dt), for masses in suns. */
export function periodDecay(m1: number, m2: number, period: number, e: number) {
	const mc = chirpMass(m1, m2) * T_SUN; // s
	return -((192 * Math.PI) / 5) * ((2 * Math.PI * mc) / period) ** (5 / 3) * eccentricityFactor(e);
}

/** Semi-major axis from the period (Kepler's third law), m. */
export const semiMajorAxis = (M: number, period: number) =>
	Math.cbrt((M * GM_SUN * period ** 2) / (4 * Math.PI ** 2));

/** The Hulse–Taylor binary pulsar PSR B1913+16 (Weisberg & Huang 2016, ApJ 829, 55). */
export const HULSE_TAYLOR = {
	pulsar: 1.438, // M☉
	companion: 1.39, // M☉
	period: 0.322997448918 * DAY, // s
	e: 0.617134,
	/** The rate general relativity predicts, as they give it. */
	predicted: -2.40263e-12,
	/** Measured (corrected for the Galaxy's acceleration) ÷ predicted. */
	ratio: 0.9983
};

// ---------------------------------------------------------------- the inspiral

/** Gravitational-wave frequency τ seconds before coalescence (leading order), Hz. */
export function frequencyAt(tau: number, mc: number) {
	return ((5 / 256 / tau) ** (3 / 8) * (mc * T_SUN) ** (-5 / 8)) / Math.PI;
}
/** Time left to coalescence once the frequency is f (leading order), s. */
export function timeToMerger(f: number, mc: number) {
	return (5 / 256) * (mc * T_SUN) ** (-5 / 3) * (Math.PI * f) ** (-8 / 3);
}
/** df/dt = (96/5) π^(8/3) (G M_c/c³)^(5/3) f^(11/3), Hz/s. */
export function chirpRate(f: number, mc: number) {
	return (96 / 5) * Math.PI ** (8 / 3) * (mc * T_SUN) ** (5 / 3) * f ** (11 / 3);
}
/** Chirp mass (suns) from a frequency and its rate of change: the inverse of `chirpRate`. */
export function chirpMassFrom(f: number, fdot: number) {
	return ((5 / 96) * Math.PI ** (-8 / 3) * f ** (-11 / 3) * fdot) ** 0.6 / T_SUN;
}
/** Gravitational-wave cycles between frequencies f1 < f2 (leading order). */
export function cycles(f1: number, f2: number, mc: number) {
	const k = (96 / 5) * Math.PI ** (8 / 3) * (mc * T_SUN) ** (5 / 3);
	return ((3 / 5) * (f1 ** (-5 / 3) - f2 ** (-5 / 3))) / k;
}
/** Phase of the wave (radians) τ seconds before coalescence, up to a constant. */
function phaseAt(tau: number, mc: number) {
	return -2 * (tau / (5 * mc * T_SUN)) ** (5 / 8);
}

/**
 * Strain amplitude at frequency f from a binary of chirp mass M_c at distance d (m),
 * for a source seen face-on and a detector right underneath it (the largest it can be):
 * h = (4/d) (G M_c/c²)^(5/3) (π f/c)^(2/3).
 */
export function strain(f: number, mc: number, d: number) {
	return (4 / d) * (mc * L_SUN) ** (5 / 3) * ((Math.PI * f) / C) ** (2 / 3);
}

/** Power radiated by a circular binary at gravitational-wave frequency f, W. */
export function powerAt(m1: number, m2: number, f: number) {
	return radiatedPower(m1 * M_SUN, m2 * M_SUN, separation(m1 + m2, f));
}

/**
 * The inspiral of masses m1, m2 (suns) up to the ISCO, as functions of t, the time
 * in seconds relative to reaching the ISCO (t ≤ 0). The phase is 0 at the ISCO.
 */
export function inspiral(m1: number, m2: number) {
	const M = m1 + m2;
	const mc = chirpMass(m1, m2);
	const fIsco = iscoFrequency(M);
	const tauIsco = timeToMerger(fIsco, mc);
	const phIsco = phaseAt(tauIsco, mc);
	const tau = (t: number) => tauIsco - Math.min(0, t);
	return {
		M,
		mc,
		fIsco,
		/** Leading-order coalescence comes this long after the ISCO, s. */
		tauIsco,
		frequency: (t: number) => frequencyAt(tau(t), mc),
		phase: (t: number) => phaseAt(tau(t), mc) - phIsco,
		separation: (t: number) => separation(M, frequencyAt(tau(t), mc)),
		/** When (t ≤ 0) the frequency is f. */
		timeOf: (f: number) => tauIsco - timeToMerger(Math.min(f, fIsco), mc)
	};
}

/** Waveform samples h(t)/h(ISCO) from t0 to 0 (the ISCO) at `rate` samples a second. */
export function chirpSamples(m1: number, m2: number, t0: number, rate: number, pitch = 1) {
	const ins = inspiral(m1, m2);
	const n = Math.max(2, Math.round(-t0 * rate));
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const t = t0 + i / rate;
		const amp = (ins.frequency(t) / ins.fIsco) ** (2 / 3);
		out[i] = amp * Math.cos(pitch * ins.phase(t));
	}
	return out;
}

// ---------------------------------------------------------------- the remnant

/** Mass of the merged black hole (suns), non-spinning progenitors (Barausse et al. 2012). */
export function finalMass(m1: number, m2: number) {
	const n = eta(m1, m2);
	const eIsco = Math.sqrt(8 / 9);
	return (m1 + m2) * (1 - n * (1 - 4 * n) * (1 - eIsco) - 16 * n * n * 0.04827);
}
/** Dimensionless spin of the merged black hole, non-spinning progenitors (Barausse & Rezzolla 2009). */
export function finalSpin(m1: number, m2: number) {
	const n = eta(m1, m2);
	return 2 * Math.sqrt(3) * n - 3.5171 * n ** 2 + 2.5763 * n ** 3;
}
/** Ringing (l = m = 2 mode) of a black hole of mass Mf (suns) and spin j: frequency (Hz), damping time (s). */
export function ringdown(Mf: number, j: number) {
	const w = 1.5251 - 1.1568 * (1 - j) ** 0.1292; // M ω
	const q = 0.7 + 1.4187 * (1 - j) ** -0.499; // quality factor
	const f = w / (2 * Math.PI * Mf * T_SUN);
	return { f, tau: q / (Math.PI * f) };
}
/** Energy radiated in a merger, in solar masses × c². */
export const radiatedMass = (m1: number, m2: number) => m1 + m2 - finalMass(m1, m2);

// ---------------------------------------------------------------- detection

/** Difference between a detector's two arm lengths when a wave of strain h passes: ΔL = h·L. */
export const armDifference = (h: number, L = LIGO_ARM) => h * L;

/** Redshift of a nearby source from its distance (Hubble's law, H₀ = 67.7 km/s/Mpc). */
export const nearbyRedshift = (dMpc: number) => (67.7e3 * dMpc) / C;

/** GW150914 as the discovery paper gives it (Abbott et al. 2016, PRL 116, 061102). */
export const GW150914 = {
	m1: 36, // source frame, M☉ (+5 −4)
	m2: 29, // ±4
	final: 62, // ±4
	radiated: 3.0, // ±0.5 M☉c²
	distance: 410, // Mpc (+160 −180)
	z: 0.09,
	peakStrain: 1.0e-21,
	peakPower: 3.6e49, // W
	delay: 6.9e-3, // s, Livingston first (+0.5 −0.4 ms)
	chirpMassDetector: 30 // "≈ 30 M☉" from f and df/dt, in the detector frame
};

// ---------------------------------------------------------------- reading the data

/** Interpolated times where the series crosses zero. */
function zeroCrossings(y: readonly number[], t0: number, rate: number) {
	const out: number[] = [];
	for (let i = 1; i < y.length; i++) {
		const a = y[i - 1];
		const b = y[i];
		if (a < 0 !== b < 0 && a !== b) out.push(t0 + (i - 1 + a / (a - b)) / rate);
	}
	return out;
}
/** One frequency estimate per half cycle: (time, frequency) from neighbouring crossings. */
export function crossingFrequencies(y: readonly number[], t0: number, rate: number) {
	const z = zeroCrossings(y, t0, rate);
	return z.slice(1).map((t, i) => ({ t: (t + z[i]) / 2, f: 1 / (2 * (t - z[i])) }));
}

/**
 * Best coalescence time for a chirp mass, and the misfit (rms of ln f), fitting the
 * leading-order f(t) to measured (t, f) points. The time is searched on a 0.1 ms grid.
 */
export function fitCoalescence(points: readonly { t: number; f: number }[], mc: number) {
	const last = Math.max(...points.map((p) => p.t));
	let best = { tc: last, rms: Infinity };
	for (let tc = last + 1e-4; tc < last + 0.05; tc += 1e-4) {
		let s = 0;
		for (const p of points) s += Math.log(p.f / frequencyAt(tc - p.t, mc)) ** 2;
		const rms = Math.sqrt(s / points.length);
		if (rms < best.rms) best = { tc, rms };
	}
	return best;
}
/** The chirp mass (0.1 M☉ grid in [lo, hi]) whose leading-order track best fits the points. */
export function fitChirpMass(points: readonly { t: number; f: number }[], lo = 10, hi = 80) {
	let best = { mc: lo, tc: 0, rms: Infinity };
	for (let mc = lo; mc <= hi; mc += 0.1) {
		const r = fitCoalescence(points, mc);
		if (r.rms < best.rms) best = { mc: Math.round(mc * 10) / 10, ...r };
	}
	return best;
}
