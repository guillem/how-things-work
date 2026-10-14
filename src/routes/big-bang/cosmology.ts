/**
 * The model behind the big-bang explainer: a flat ΛCDM universe with the Planck 2018 parameters,
 * expanding according to the Friedmann equation
 *
 *   H(a)² = H0² × (Ω_r(a) + Ω_m a⁻³ + Ω_Λ),
 *
 * where a is the scale factor (1 today). From it come the age of the universe at any moment, its
 * temperature, the redshift of light, and distances (comoving, light-travel, then), all by
 * integrating the equation numerically once at load time into tables.
 *
 * Parameters: Planck Collaboration (2020), "Planck 2018 results. VI. Cosmological parameters",
 * A&A 641, A6, table 2, column TT,TE,EE+lowE+lensing: H0 = 67.36 km/s/Mpc, Ω_m = 0.3153
 * (Ω_Λ = 0.6847). That fit also gives the age (13.797 Gyr), z* = 1089.92, r* = 144.43 Mpc,
 * 100θ* = 1.04110 and z_eq = 3402, which the model tests check against.
 *
 * Radiation: the CMB temperature today, T0 = 2.7255 K (Fixsen 2009, ApJ 707, 916), sets the
 * photons' density; neutrinos add N_eff = 3.046 species at (4/11)^⅓ of the photon temperature.
 * In the first seconds electrons and positrons are still abundant: they add to the density, and
 * when they annihilate (around 10⁹–10¹⁰ K) they heat the photons. That is included exactly, by
 * conserving the entropy of photons + e± (the neutrinos having already decoupled).
 *
 * Simplifications: the universe is exactly flat; the three neutrinos are massless (Planck counts
 * one of 0.06 eV inside Ω_m); nothing before 0.01 s (T ≈ 10¹¹ K), when other particles (muons,
 * pions, and earlier still quarks) would change the radiation content.
 *
 * Units: time in Gyr (or seconds where stated), distances in billions of light years (Gly).
 * Since light covers one light year per year, a light-travel time in Gyr is a distance in Gly.
 */

// ------------------------------------------------------------------ constants

/** Planck 2018 VI, table 2, TT,TE,EE+lowE+lensing (68% intervals). */
export const PLANCK = {
	H0: 67.36, // km/s/Mpc
	omegaM: 0.3153,
	omegaL: 0.6847,
	age: 13.797, // Gyr
	zStar: 1089.92, // last scattering
	rStar: 144.43, // Mpc, sound horizon at z*
	thetaStar: 1.0411e-2, // angular size of r* on the sky, radians
	zEq: 3402,
	zRe: 7.67 // mid-point of reionization
} as const;

/** CMB temperature today, K (Fixsen 2009). */
export const T0 = 2.7255;
export const N_EFF = 3.046;

const MPC_KM = 3.085677581491367e19;
/** Seconds in a gigayear (Julian years). */
export const GYR_S = 3.15576e16;
/** Light years in a megaparsec. */
export const LY_PER_MPC = 3.261563777e6;
const G = 6.6743e-11; // m³ kg⁻¹ s⁻²
const SIGMA_SB = 5.670374419e-8; // W m⁻² K⁻⁴
const C_MS = 299792458;
/** Electron rest energy over Boltzmann's constant, K (0.51099895 MeV / 8.617333262e-11 MeV/K). */
const ME_K = 0.51099895 / 8.617333262e-11;
/** Boltzmann's constant, MeV per kelvin. */
export const K_MEV = 8.617333262e-11;

/** H0 in 1/s and in 1/Gyr. */
const H0_S = PLANCK.H0 / MPC_KM;
const H0_GYR = H0_S * GYR_S;

/** Photon density today over the critical density. Ω_γ h² ≈ 2.47 × 10⁻⁵. */
export const OMEGA_GAMMA = (() => {
	const aRad = (4 * SIGMA_SB) / C_MS; // J m⁻³ K⁻⁴
	const rhoGamma = (aRad * T0 ** 4) / C_MS ** 2; // kg/m³
	const rhoCrit = (3 * H0_S ** 2) / (8 * Math.PI * G);
	return rhoGamma / rhoCrit;
})();
/** Neutrinos today (massless): N_eff × 7/8 × (4/11)^{4/3} of the photons. */
export const OMEGA_NU = OMEGA_GAMMA * N_EFF * (7 / 8) * (4 / 11) ** (4 / 3);
export const OMEGA_R = OMEGA_GAMMA + OMEGA_NU;
export const OMEGA_M = PLANCK.omegaM;
/** Flat: dark energy takes what matter and radiation leave. */
export const OMEGA_L = 1 - OMEGA_M - OMEGA_R;

// ------------------------------------------------------------------ the first seconds: e± pairs

/** ∫₀^∞ f(y) dy by Simpson's rule on [0, ymax]. */
function integrate(f: (y: number) => number, ymax: number, n = 400) {
	const h = ymax / n;
	let s = f(0) + f(ymax);
	for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
	return (s * h) / 3;
}

/**
 * Electrons + positrons (4 states) at photon temperature T, with x = mₑc²/kT: their energy density
 * over the photons' (7/4 when x → 0), and their entropy in units of one boson state (7/2 at x → 0).
 */
function pairs(x: number) {
	if (x > 60) return { rho: 0, entropy: 0 };
	const ymax = Math.max(30, x + 40);
	const fd = (E: number) => 1 / (Math.exp(E) + 1);
	const rho = integrate((y) => {
		const E = Math.hypot(y, x);
		return y * y * E * fd(E);
	}, ymax);
	const sp = integrate((y) => {
		const E = Math.hypot(y, x);
		return E === 0 ? 0 : y * y * (E + (y * y) / (3 * E)) * fd(E);
	}, ymax);
	const g = 4;
	return {
		rho: ((g * 15) / (2 * Math.PI ** 4)) * rho,
		entropy: ((45 * g) / (4 * Math.PI ** 4)) * sp
	};
}

/**
 * Early table, by photon temperature from 10¹¹ K down to 10⁸ K: the scale factor (from entropy
 * conservation, (2 + s_e)(aT)³ = 2 T0³) and the radiation density over today's critical density.
 */
const EARLY = (() => {
	const n = 240;
	const lnA: number[] = [];
	const lnRad: number[] = [];
	for (let i = 0; i <= n; i++) {
		const T = 10 ** (11 - (3 * i) / n);
		const p = pairs(ME_K / T);
		const a = (T0 / T) * (2 / (2 + p.entropy)) ** (1 / 3);
		const rad = OMEGA_GAMMA * (T / T0) ** 4 * (1 + p.rho) + OMEGA_NU * a ** -4;
		lnA.push(Math.log(a));
		lnRad.push(Math.log(rad));
	}
	return { lnA, lnRad, lnT: lnA.map((_, i) => Math.log(10 ** (11 - (3 * i) / n))) };
})();
const A_EARLY_MIN = Math.exp(EARLY.lnA[0]);
const A_EARLY_MAX = Math.exp(EARLY.lnA[EARLY.lnA.length - 1]);

/** Linear interpolation of ys over ascending xs. */
function interp(xs: readonly number[], ys: readonly number[], x: number) {
	const n = xs.length;
	if (x <= xs[0]) return ys[0] + ((ys[1] - ys[0]) * (x - xs[0])) / (xs[1] - xs[0]);
	if (x >= xs[n - 1])
		return ys[n - 1] + ((ys[n - 1] - ys[n - 2]) * (x - xs[n - 1])) / (xs[n - 1] - xs[n - 2]);
	let lo = 0;
	let hi = n - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (xs[mid] <= x) lo = mid;
		else hi = mid;
	}
	return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}

/** Radiation density over today's critical density at scale factor a. */
function radiation(a: number) {
	if (a >= A_EARLY_MAX) return OMEGA_R * a ** -4;
	return Math.exp(interp(EARLY.lnA, EARLY.lnRad, Math.log(a)));
}

/**
 * Electron–positron pairs left at photon temperature T (K), as a fraction of their number when
 * the universe was much hotter than mₑc²/k = 5.9 × 10⁹ K (measured by their energy density
 * relative to the photons').
 */
export const pairsLeft = (T: number) => pairs(ME_K / T).rho / 1.75;

/** Photon temperature at scale factor a, K: T0/a after the e± annihilation, hotter before. */
export function temperature(a: number) {
	if (a >= A_EARLY_MAX) return T0 / a;
	return Math.exp(interp(EARLY.lnA, EARLY.lnT, Math.log(a)));
}

// ------------------------------------------------------------------ the Friedmann equation

/** E(a) = H(a)/H0. */
export const hubbleRatio = (a: number) => Math.sqrt(radiation(a) + OMEGA_M * a ** -3 + OMEGA_L);
/** Hubble parameter at scale factor a, km/s per megaparsec. */
export const hubble = (a: number) => PLANCK.H0 * hubbleRatio(a);
/** Hubble parameter in 1/Gyr: the fractional growth of distances per billion years. */
export const hubblePerGyr = (a: number) => H0_GYR * hubbleRatio(a);

/** Share of the energy density in radiation, matter and dark energy at scale factor a. */
export function composition(a: number) {
	const r = radiation(a);
	const m = OMEGA_M * a ** -3;
	const total = r + m + OMEGA_L;
	return { radiation: r / total, matter: m / total, darkEnergy: OMEGA_L / total };
}

/**
 * Acceleration of the expansion, ä/a over H0² (positive: speeding up). From the second
 * Friedmann equation: ä/a = −(H0²/2) × (2Ω_r a⁻⁴ + Ω_m a⁻³ − 2Ω_Λ).
 */
export const acceleration = (a: number) =>
	-(2 * radiation(a) + OMEGA_M * a ** -3 - 2 * OMEGA_L) / 2;

/**
 * Master table on a log grid of the scale factor, from 10⁻¹¹ (T ≈ 10¹¹ K, 0.01 s) to 10:
 * cosmic time t(a), Gyr, and conformal time η(a) = ∫ c dt / a, Gly.
 */
const TABLE = (() => {
	const aMin = Math.min(1e-11, A_EARLY_MIN);
	const lnMin = Math.log(aMin);
	const lnMax = Math.log(10);
	const n = 6000;
	const lnA: number[] = [];
	const t: number[] = [];
	const eta: number[] = [];
	// Before the first point the radiation is taken as a fixed mix (a ∝ 1/T, ρ ∝ a⁻⁴):
	// t = 1/(2H), η = c/(aH).
	const H1 = hubblePerGyr(aMin);
	let tt = 1 / (2 * H1);
	let ee = 1 / (aMin * H1);
	let prevT = 1 / H1;
	let prevE = 1 / (aMin * H1);
	for (let i = 0; i <= n; i++) {
		const la = lnMin + ((lnMax - lnMin) * i) / n;
		const a = Math.exp(la);
		const H = hubblePerGyr(a);
		const ft = 1 / H; // dt / dln a
		const fe = 1 / (a * H); // dη / dln a
		if (i > 0) {
			const h = (lnMax - lnMin) / n;
			tt += ((prevT + ft) * h) / 2;
			ee += ((prevE + fe) * h) / 2;
		}
		prevT = ft;
		prevE = fe;
		lnA.push(la);
		t.push(tt);
		eta.push(ee);
	}
	return { lnA, lnT: t.map(Math.log), lnEta: eta.map(Math.log), t, eta };
})();

/** Earliest time the model covers, s. */
export const T_MIN_S = TABLE.t[0] * GYR_S;

/** Cosmic time (since the Big Bang) at scale factor a, Gyr. */
export const timeAt = (a: number) => Math.exp(interp(TABLE.lnA, TABLE.lnT, Math.log(a)));
/** Scale factor at cosmic time t, Gyr. */
export const scaleAt = (t: number) => Math.exp(interp(TABLE.lnT, TABLE.lnA, Math.log(t)));
/** Conformal time at a: the comoving distance light has covered since the start, Gly. */
export const conformalAt = (a: number) => Math.exp(interp(TABLE.lnA, TABLE.lnEta, Math.log(a)));
const scaleAtConformal = (eta: number) => Math.exp(interp(TABLE.lnEta, TABLE.lnA, Math.log(eta)));

/** Age of the universe today, Gyr. */
export const AGE = timeAt(1);
/** Hubble distance today, c/H0, Gly. */
export const HUBBLE_DISTANCE = 1 / H0_GYR;

// ------------------------------------------------------------------ redshift and distances

/** Redshift of light emitted at scale factor a and seen today. */
export const redshiftOf = (a: number) => 1 / a - 1;
export const scaleOfRedshift = (z: number) => 1 / (1 + z);

/**
 * Comoving distance today to light emitted at scale factor a: ∫ c da / (a² H), Gly, integrated
 * directly (Simpson in ln a) so that small distances keep their precision.
 */
function comovingTo(a: number) {
	const n = 600;
	const la = Math.log(a);
	const h = -la / n;
	const f = (x: number) => {
		const b = Math.exp(x);
		return 1 / (b * hubblePerGyr(b));
	};
	let s = f(la) + f(0);
	for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(la + i * h);
	return (s * h) / 3;
}

/** Distances to a source seen today at redshift z, Gly (and the light's travel time, Gyr). */
export function distances(z: number) {
	const a = scaleOfRedshift(z);
	const comoving = comovingTo(a);
	return {
		/** Where the source is now. */
		comoving,
		/** How far the light travelled: c × its travel time. */
		lightTravel: AGE - timeAt(a),
		/** How far the source was when the light left it. */
		then: comoving * a,
		/** Time of emission since the Big Bang, Gyr. */
		emitted: timeAt(a)
	};
}

/** Comoving distance to redshift z in megaparsecs (for comparison with Planck). */
export const comovingMpc = (z: number) => (distances(z).comoving * 1e9) / LY_PER_MPC;

/** Radius of the observable universe today (the particle horizon), Gly. */
export const HORIZON = conformalAt(1);

/**
 * Redshift of the light an observer at scale factor aObs receives from a galaxy at comoving
 * distance chi (Gly, measured today). Infinity when its light has not reached them yet.
 */
export function redshiftSeen(chi: number, aObs: number) {
	const etaE = conformalAt(aObs) - chi;
	if (etaE <= TABLE.eta[0]) return Infinity;
	return aObs / scaleAtConformal(etaE) - 1;
}

/** Recession speed now of something at proper distance d (Gly) at scale factor a, in units of c. */
export const recession = (d: number, a: number) => hubblePerGyr(a) * d;

// ------------------------------------------------------------------ the first three minutes

/** Neutron minus proton rest energy, MeV. */
export const Q_NP = 1.29333236;
/** Neutron lifetime, s (Particle Data Group 2024: 878.4 ± 0.5 s). */
export const TAU_N = 878.4;
/**
 * Textbook temperatures (e.g. B. Ryden, Introduction to Cosmology, 2nd ed., 2017, ch. 10): weak
 * reactions stop turning protons and neutrons into each other at kT ≈ 0.8 MeV; deuterium
 * survives, and nearly every neutron ends up in helium, below kT ≈ 0.07 MeV.
 */
export const KT_FREEZE = 0.8;
export const KT_NUC = 0.07;

/** Cosmic time when the photon temperature is T (K), seconds. */
export function timeAtTemperature(T: number) {
	// temperature(a) falls monotonically: bisect in ln a.
	let lo = Math.log(1e-12);
	let hi = Math.log(1e-3);
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (temperature(Math.exp(mid)) > T) lo = mid;
		else hi = mid;
	}
	return timeAt(Math.exp((lo + hi) / 2)) * GYR_S;
}

export const T_FREEZE_S = timeAtTemperature(KT_FREEZE / K_MEV);
export const T_NUC_S = timeAtTemperature(KT_NUC / K_MEV);
/** Neutrons per proton when the weak reactions stop: the Boltzmann factor e^(−Q/kT). */
export const NP_FREEZE = Math.exp(-Q_NP / KT_FREEZE);

/**
 * Neutrons per proton (free and bound) at time t, s: in balance with the temperature before the
 * freeze-out, then decaying freely, then locked into helium nuclei, where they no longer decay.
 */
export function neutronsPerProton(tS: number) {
	if (tS <= T_FREEZE_S) {
		const a = scaleAt(tS / GYR_S);
		return Math.exp(-Q_NP / (K_MEV * temperature(a)));
	}
	const tFree = Math.min(tS, T_NUC_S) - T_FREEZE_S;
	// a decaying neutron becomes a proton: n falls, p rises
	const total = 1 + NP_FREEZE;
	const n = (NP_FREEZE / total) * Math.exp(-tFree / TAU_N);
	return n / (1 - n);
}

/** Helium's share of the mass of ordinary matter: every neutron pairs with a proton in ⁴He. */
export function heliumMassFraction() {
	const x = neutronsPerProton(T_NUC_S);
	return (2 * x) / (1 + x);
}

// ------------------------------------------------------------------ light

/** Wien's displacement constant, m·K. */
const WIEN = 2.897771955e-3;
/** Wavelength at which a blackbody at T (K) is brightest, metres. */
export const peakWavelength = (T: number) => WIEN / T;

/**
 * Planck's law per unit wavelength, B_λ(T), divided by its value at the peak (so the peak is 1).
 * λ in metres.
 */
export function planckShape(lambda: number, T: number) {
	const c2 = 1.438776877e-2; // hc/k, m·K
	const b = (l: number) => 1 / (l ** 5 * (Math.exp(c2 / (l * T)) - 1));
	return b(lambda) / b(peakWavelength(T));
}

/**
 * Wavelengths of the hydrogen Balmer lines in air, nm (NIST Atomic Spectra Database): the
 * fingerprint used to measure a galaxy's redshift.
 */
export const BALMER = [
	{ name: 'Hα', nm: 656.28 },
	{ name: 'Hβ', nm: 486.13 },
	{ name: 'Hγ', nm: 434.05 },
	{ name: 'Hδ', nm: 410.17 }
] as const;

// ------------------------------------------------------------------ reionization

/**
 * Fraction of hydrogen ionized again by the first stars and galaxies, at redshift z: the tanh
 * model Planck fits (Planck 2018 VI, §3.3: x_e ∝ 1 + tanh((y_re − y)/Δy), y = (1 + z)^{3/2},
 * Δy = 1.5 √(1 + z_re) Δz, Δz = 0.5), with its midpoint z_re = 7.67.
 */
export function reionized(z: number) {
	const y = (1 + z) ** 1.5;
	const yRe = (1 + PLANCK.zRe) ** 1.5;
	const dy = 1.5 * Math.sqrt(1 + PLANCK.zRe) * 0.5;
	return 0.5 * (1 + Math.tanh((yRe - y) / dy));
}
