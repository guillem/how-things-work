/**
 * Hearing and the cochlea: a one-dimensional transmission-line model of the basilar membrane,
 * its active amplifier, the audiogram it implies, and the place map of the cochlea.
 *
 * The place map (Greenwood 1990, J. Acoust. Soc. Am. 87:2592): the place along a human basilar
 * membrane of length 35 mm, at a fraction x of the length from the apex, is tuned to
 *
 *     F(x) = 165.4 · (10^(2.1 x) − 0.88) Hz,
 *
 * from about 20 Hz at the apex to about 20.7 kHz at the base.
 *
 * The mechanics (the long-wave "transmission line" of Zweig, Lipes & Pierce 1976, Neely 1981,
 * de Boer 1996): the fluid above and below the membrane carries a pressure difference P(x); the
 * membrane, a row of independent mass–spring–damper sections of impedance
 *
 *     Z(x, ω) = r(x) + i (ω m − k(x)/ω),
 *
 * moves at the velocity v = P/Z, and the fluid's momentum and continuity give
 *
 *     d²P/dx² = (2 i ω ρ / H) · P / Z,
 *
 * with the stapes pushing at the base (dP/dx = −2 i ω ρ u_stapes) and the two scalae joined at
 * the apex (P = 0, the helicotrema). The stiffness k(x) = m ω_c(x)² falls along the membrane so
 * that each section resonates at Greenwood's frequency ω_c(x) = 2π F(x); below its resonance a
 * section is a spring, and the wave slows and grows as it travels towards the place where
 * k(x) = m ω², where it peaks and dies within a few millimetres. Solved in the frequency domain
 * with second-order finite differences (a tridiagonal system, Thomas algorithm).
 *
 * The amplifier is phenomenological: the outer hair cells push in step with the membrane's
 * velocity, a negative damping −γ(x) r₀(x) that cancels most of the passive damping r₀. The
 * fraction γ saturates as the local velocity grows (γ₀ / (1 + (|v| / v_sat)²)), which makes
 * the response compressive and, at high levels, passive, and it is solved for a steady tone by a damped fixed-point iteration (a
 * "quasi-linear" model, as in Kanis & de Boer 1993). Real outer hair cells act through the
 * organ of Corti's micromechanics, which a one-dimensional model cannot hold.
 *
 * Calibration: the middle ear is taken as flat: 0 dB SPL moves the stapes at U_REF. A place
 * "hears" a tone when its membrane moves faster than V_THRESHOLD, about 100 µm/s, the membrane's
 * velocity at the threshold of the nerve fibres tuned to that place (Robles & Ruggero 2001,
 * Physiol. Rev. 81:1305, Table 1). The healthy model's gain, compression and level-dependent
 * shift of the peak are checked against the same review in `e2e/cochlea-hearing-model.e2e.ts`.
 *
 * Provenance of the parameters. Published: Greenwood's map and length; the fluid density; the
 * threshold velocity. Typical modelling values (as in Neely 1981 and later one-dimensional
 * models): the membrane's mass per area and the channels' height. Illustrative values fitted for
 * this page, not taken from a publication: the passive damping (Q_PASSIVE, chosen so that the
 * passive peak sits about 0.6–0.7 octave basal of the live one), the amplifier's residual damping
 * (chosen for a soft-tone Q₁₀ of about 4–15, as measured), its saturation (V_SAT, chosen so that
 * compression starts at about 30 dB SPL and the live and passive peaks meet near 100 dB SPL), and
 * the input calibration (U_REF, chosen so that the healthy thresholds fall at about 0–15 dB SPL).
 */

// ------------------------------------------------------------------------------- the place map
/** Length of the modelled basilar membrane, mm (Greenwood's human value). */
export const LENGTH_MM = 35;

/** Greenwood's place map: the frequency (Hz) a place `mm` millimetres from the base is tuned to. */
export function cfAt(mm: number): number {
	const fromApex = 1 - mm / LENGTH_MM;
	return 165.4 * (Math.pow(10, 2.1 * fromApex) - 0.88);
}

/** The inverse of `cfAt`: the place (mm from the base) tuned to `f` Hz. */
export function placeOf(f: number): number {
	return LENGTH_MM * (1 - Math.log10(f / 165.4 + 0.88) / 2.1);
}

// ------------------------------------------------------------------------------- parameters
/** Fluid density, kg/m³. */
const RHO = 1000;
/** Effective height of each scala, m. */
const H = 1e-3;
/** Membrane mass per unit area, kg/m². */
const MASS = 0.015;
/** Quality factor of the passive membrane sections (sets the passive damping). */
const Q_PASSIVE = 12;
/**
 * The fraction of the passive damping the healthy amplifier leaves at low levels: 1 − γ₀. Small
 * at the base (a large gain), larger at the apex (a smaller gain), as measured.
 */
const RESIDUAL_BASE = 0.04;
const RESIDUAL_APEX = 0.15;
/** Velocity at which the amplifier's push has halved, m/s (it starts to tell well below). */
const V_SAT = 0.01;
/** Stapes velocity at 0 dB SPL, m/s (a flat middle ear). */
const U_REF = 2e-7;
/** Membrane velocity at the threshold of hearing, m/s (≈ 100 µm/s). */
export const V_THRESHOLD = 1e-4;
/** Number of membrane sections (converged: doubling it changes no peak by more than 0.1 dB). */
export const SECTIONS = 4800;

const DX = LENGTH_MM / 1000 / SECTIONS;
/** Centre of each section, mm from the base. */
export const PLACES: Float64Array = Float64Array.from(
	{ length: SECTIONS },
	(_, j) => (j + 0.5) * DX * 1000
);
const OMEGA_C = Float64Array.from(PLACES, (mm) => 2 * Math.PI * cfAt(mm));
const GAMMA_PLACE = Float64Array.from(PLACES, (mm) => {
	const u = mm / LENGTH_MM;
	return 1 - RESIDUAL_BASE * Math.pow(RESIDUAL_APEX / RESIDUAL_BASE, u);
});

// ------------------------------------------------------------------------------- the ear
/** The state of an ear: amplifier on or off, and a stretch of lost outer hair cells. */
export interface Ear {
	/** The outer hair cells' amplifier works (false: a passive, post-mortem cochlea). */
	active: boolean;
	/** Fraction of outer hair cells lost in the damaged stretch, 0–1. */
	loss?: number;
	/** Centre of the damaged stretch, as the frequency tuned there (Hz). Default 5 kHz. */
	lossAt?: number;
	/** Half-width of the damaged stretch, mm. */
	lossHalfWidth?: number;
}

export const HEALTHY: Ear = { active: true };
export const PASSIVE: Ear = { active: false };
/**
 * Where noise damage sits on the page: a 4 mm stretch centred on the 5 kHz place, just basal of
 * the 4 kHz place (the damage from a loud sound lies about half an octave above its frequency,
 * and the ear canal's resonance makes everyday noise strongest at 2–4 kHz).
 */
export const LOSS_AT = 5000;
export const LOSS_HALF_WIDTH = 2;
/** The noise-damaged ear of the page: every outer hair cell lost in that stretch. */
export const NOISE_DAMAGED: Ear = {
	active: true,
	loss: 1,
	lossAt: LOSS_AT,
	lossHalfWidth: LOSS_HALF_WIDTH
};

/** How much of the amplifier is missing at each place, 0–1 (smooth edges, 0.6 mm). */
export function lossProfile(ear: Ear): Float64Array {
	const out = new Float64Array(SECTIONS);
	const loss = ear.loss ?? 0;
	if (loss <= 0) return out;
	const c = placeOf(ear.lossAt ?? LOSS_AT);
	const w = ear.lossHalfWidth ?? LOSS_HALF_WIDTH;
	for (let j = 0; j < SECTIONS; j++) {
		const d = Math.abs(PLACES[j] - c) - w;
		out[j] = loss / (1 + Math.exp(d / 0.3));
	}
	return out;
}

/** The steady response of the membrane to one tone. */
export interface Response {
	f: number;
	level: number;
	/** Membrane velocity at each section (complex, m/s; peak amplitude). */
	re: Float64Array;
	im: Float64Array;
	/** |v| at each section, m/s. */
	mag: Float64Array;
	/** The amplifier's push at each section, as a fraction γ of the passive damping cancelled. */
	gamma: Float64Array;
	/** Index of the section that moves most. */
	peak: number;
	/** Iterations used, and whether the nonlinear iteration converged. */
	iterations: number;
	converged: boolean;
}

// complex tridiagonal solve, reused buffers
const cpr = new Float64Array(SECTIONS);
const cpi = new Float64Array(SECTIONS);
const dpr = new Float64Array(SECTIONS);
const dpi = new Float64Array(SECTIONS);
const Pr = new Float64Array(SECTIONS);
const Pi = new Float64Array(SECTIONS);

/** Solves the linear line for one tone with a given amplifier profile γ; writes v into re/im. */
function solveLinear(
	f: number,
	u0: number,
	gamma: Float64Array,
	re: Float64Array,
	im: Float64Array
): void {
	const w = 2 * Math.PI * f;
	const s = (2 * RHO * w) / H;
	const d2 = DX * DX;
	// rows: P_{j-1} + B_j P_j + P_{j+1} = R_j, with B_j = −2 − Δ² q_j, q = s·i/Z.
	// Base: ghost P_{-1} = P_1 + 2Δ·2iωρu₀ → row 0 is B_0 P_0 + 2 P_1 = −2Δ·2iωρu₀.
	// Apex: P_N = 0.
	for (let j = 0; j < SECTIONS; j++) {
		const wc = OMEGA_C[j];
		const zr = ((MASS * wc) / Q_PASSIVE) * (1 - gamma[j]);
		const zi = w * MASS - (MASS * wc * wc) / w;
		const den = zr * zr + zi * zi;
		// q = i s / Z = i s (zr − i zi)/den = s (zi + i zr)/den
		const qr = (s * zi) / den;
		const qi = (s * zr) / den;
		let br = -2 - d2 * qr;
		let bi = -d2 * qi;
		let rr = 0;
		let ri = j === 0 ? -2 * DX * 2 * RHO * w * u0 : 0;
		const up = j === 0 ? 2 : 1;
		if (j > 0) {
			br -= cpr[j - 1];
			bi -= cpi[j - 1];
			rr -= dpr[j - 1];
			ri -= dpi[j - 1];
		}
		const bd = br * br + bi * bi;
		cpr[j] = (up * br) / bd;
		cpi[j] = (-up * bi) / bd;
		dpr[j] = (rr * br + ri * bi) / bd;
		dpi[j] = (ri * br - rr * bi) / bd;
	}
	const n = SECTIONS - 1;
	Pr[n] = dpr[n];
	Pi[n] = dpi[n];
	for (let j = n - 1; j >= 0; j--) {
		Pr[j] = dpr[j] - (cpr[j] * Pr[j + 1] - cpi[j] * Pi[j + 1]);
		Pi[j] = dpi[j] - (cpr[j] * Pi[j + 1] + cpi[j] * Pr[j + 1]);
	}
	for (let j = 0; j < SECTIONS; j++) {
		const wc = OMEGA_C[j];
		const zr = ((MASS * wc) / Q_PASSIVE) * (1 - gamma[j]);
		const zi = w * MASS - (MASS * wc * wc) / w;
		const den = zr * zr + zi * zi;
		re[j] = (Pr[j] * zr + Pi[j] * zi) / den;
		im[j] = (Pi[j] * zr - Pr[j] * zi) / den;
	}
}

/** Stapes velocity for a tone of `level` dB SPL. */
export function stapes(level: number): number {
	return U_REF * Math.pow(10, level / 20);
}

/**
 * The membrane's steady response to a tone of `f` Hz at `level` dB SPL. The amplifier's
 * saturation is found by a damped fixed-point iteration, stopped when γ changes by less than
 * 1e-4 anywhere (or after `maxIter`). `start` warm-starts it from an earlier response's γ.
 */
export function respond(
	f: number,
	level: number,
	ear: Ear = HEALTHY,
	start?: Float64Array,
	maxIter = 200
): Response {
	const u0 = stapes(level);
	const loss = lossProfile(ear);
	const g0 = new Float64Array(SECTIONS);
	if (ear.active) {
		for (let j = 0; j < SECTIONS; j++) g0[j] = GAMMA_PLACE[j] * (1 - loss[j]);
	}
	const gamma = ear.active && start ? Float64Array.from(start) : Float64Array.from(g0);
	const re = new Float64Array(SECTIONS);
	const im = new Float64Array(SECTIONS);
	let iterations = 0;
	let converged = !ear.active;
	solveLinear(f, u0, gamma, re, im);
	if (ear.active) {
		for (; iterations < maxIter; iterations++) {
			let change = 0;
			for (let j = 0; j < SECTIONS; j++) {
				const a = Math.hypot(re[j], im[j]) / V_SAT;
				const target = g0[j] / (1 + a * a);
				const next = gamma[j] + 0.5 * (target - gamma[j]);
				change = Math.max(change, Math.abs(next - gamma[j]));
				gamma[j] = next;
			}
			solveLinear(f, u0, gamma, re, im);
			if (change < 1e-4) {
				converged = true;
				iterations++;
				break;
			}
		}
	}
	const mag = new Float64Array(SECTIONS);
	let peak = 0;
	for (let j = 0; j < SECTIONS; j++) {
		mag[j] = Math.hypot(re[j], im[j]);
		if (mag[j] > mag[peak]) peak = j;
	}
	return { f, level, re, im, mag, gamma, peak, iterations, converged };
}

/** Velocity in dB re the threshold velocity (0 dB: just heard). */
export function dbRe(v: number): number {
	return 20 * Math.log10(Math.max(v, 1e-30) / V_THRESHOLD);
}

/** Index of the section nearest to a place (mm from the base). */
export function sectionAt(mm: number): number {
	return Math.max(0, Math.min(SECTIONS - 1, Math.round(mm / (DX * 1000) - 0.5)));
}

/**
 * The quietest level (dB SPL) at which a tone of `f` Hz moves some place of the membrane at the
 * threshold velocity: the ear's threshold for that tone. Secant iteration on the level.
 */
export function threshold(f: number, ear: Ear = HEALTHY): number {
	let level = 0;
	let r = respond(f, level, ear);
	for (let i = 0; i < 12; i++) {
		const err = dbRe(r.mag[r.peak]);
		if (Math.abs(err) < 0.05) break;
		// near threshold the growth is nearly linear (1 dB per dB), a little less when compressed
		level -= err;
		r = respond(f, level, ear, r.gamma);
	}
	return level;
}

/** The audiometric frequencies, Hz. */
export const AUDIOGRAM_FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const;

/**
 * An audiogram: the ear's threshold at each audiometric frequency in dB HL, that is, relative to
 * the healthy model's threshold at that frequency (0 dB HL is normal hearing).
 */
export function audiogram(ear: Ear, freqs: readonly number[] = AUDIOGRAM_FREQS) {
	return freqs.map((f) => ({ f, hl: threshold(f, ear) - healthyThreshold(f) }));
}

const healthyCache = new Map<number, number>();
/** The healthy model's threshold at `f` (cached). */
export function healthyThreshold(f: number): number {
	let v = healthyCache.get(f);
	if (v === undefined) {
		v = threshold(f, HEALTHY);
		healthyCache.set(f, v);
	}
	return v;
}

const bestCache = new Map<number, number>();
/**
 * The section a tone of `f` Hz moves most in the healthy ear at a low level (10 dB SPL): its
 * best place, where the healthy amplifier sits on the tone's characteristic frequency.
 */
export function bestPlace(f: number): number {
	let j = bestCache.get(f);
	if (j === undefined) {
		j = respond(f, 10, HEALTHY).peak;
		bestCache.set(f, j);
	}
	return j;
}

/**
 * Input–output curve at one place: the velocity (dB re threshold) at the place tuned to `f`
 * for a tone of `f` Hz at each level. Warm-started from level to level.
 */
export function ioCurve(f: number, ear: Ear, levels: readonly number[]) {
	const j = bestPlace(f);
	let prev: Float64Array | undefined;
	return levels.map((level) => {
		const r = respond(f, level, ear, prev);
		prev = r.gamma;
		return { level, db: dbRe(r.mag[j]) };
	});
}

/**
 * Sharpness of tuning of the response along the membrane: the width (mm) of the region within
 * 10 dB of the peak, and that width in octaves of the place map.
 */
export function peakWidth(r: Response): { mm: number; octaves: number } {
	const top = r.mag[r.peak] / Math.pow(10, 10 / 20);
	let a = r.peak;
	let b = r.peak;
	while (a > 0 && r.mag[a - 1] >= top) a--;
	while (b < SECTIONS - 1 && r.mag[b + 1] >= top) b++;
	const mm = PLACES[b] - PLACES[a] + DX * 1000;
	return { mm, octaves: Math.log2(cfAt(PLACES[a]) / cfAt(PLACES[b])) };
}

/**
 * The best frequency of one place: the tone frequency (on a 1/24-octave grid within ±1.5 octaves
 * of its characteristic frequency) that moves it most at a given level.
 */
export function bestFrequency(mm: number, level: number, ear: Ear = HEALTHY): number {
	const j = sectionAt(mm);
	const cf = cfAt(mm);
	let best = cf;
	let top = -Infinity;
	for (let k = -36; k <= 24; k++) {
		const f = cf * Math.pow(2, k / 24);
		const v = respond(f, level, ear).mag[j];
		if (v > top) {
			top = v;
			best = f;
		}
	}
	return best;
}

/** A tone: frequency (Hz) and level (dB SPL). */
export interface Tone {
	f: number;
	level: number;
}

/**
 * The membrane's response to several tones at once, each solved as if it were alone (the real
 * cochlea's nonlinearity makes simultaneous tones suppress each other and adds distortion
 * tones; the page leaves both out). Returns each tone's response.
 */
export function respondAll(tones: readonly Tone[], ear: Ear = HEALTHY): Response[] {
	return tones.map((t) => respond(t.f, t.level, ear));
}

/**
 * The excitation pattern of several tones: the root-sum-square of their velocities at each
 * section, in dB re the threshold velocity.
 */
export function excitation(responses: readonly Response[]): Float64Array {
	const out = new Float64Array(SECTIONS);
	for (let j = 0; j < SECTIONS; j++) {
		let s = 0;
		for (const r of responses) s += r.mag[j] * r.mag[j];
		out[j] = dbRe(Math.sqrt(s));
	}
	return out;
}
