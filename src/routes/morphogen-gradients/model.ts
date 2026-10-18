/**
 * Morphogen gradients: the synthesis–diffusion–degradation (SDD) model and Ben-Zvi and Barkai's
 * expansion–repression circuit, in one dimension.
 *
 * 1. SDD. A row of tissue 0 ≤ x ≤ L (µm). The morphogen M is made at the end x = 0 (a constant
 *    flux j into the tissue), spreads by diffusion (D, µm²/s) and is removed everywhere at a rate
 *    k = 1/τ (τ the mean lifetime; the half-life is τ·ln 2). Nothing leaves at x = L.
 *
 *        ∂M/∂t = D ∂²M/∂x² − k M,    −D ∂M/∂x = j at x = 0,    ∂M/∂x = 0 at x = L
 *
 *    Its steady state is M(x) = (jλ/D) · cosh((L − x)/λ) / sinh(L/λ), with λ = √(D/k): an
 *    exponential e^(−x/λ) when L ≫ λ.
 *
 * 2. Expansion–repression (Ben-Zvi & Barkai 2010, PNAS 107:6924). A second substance, the
 *    expander E, is made wherever the morphogen is below a repression threshold T_rep, spreads
 *    fast and is very stable; it widens the morphogen's gradient. The paper allows E to raise the
 *    morphogen's diffusion or lower its degradation; here it does both by the same factor, so
 *    λ grows as (1 + E) while the amount at the source end (j/√(Dk)) stays the same:
 *
 *        D_M = D·(1 + E),   k_M = k/(1 + E)
 *        ∂E/∂t = D_E ∂²E/∂x² − k_E E + β / (1 + (M/T_rep)^h)
 *
 *    E keeps accumulating until the morphogen at the far end has risen to T_rep and switched
 *    its own production off (integral feedback), so the gradient's length is pinned to the
 *    tissue's.
 *
 * Numerics: finite volumes of width DX, backward Euler in time (unconditionally stable), with
 * the reaction terms taken from the previous step. Concentrations are in the page's relative
 * units: 100 is the source end's level at the default settings.
 */

// ------------------------------------------------------------------------------- constants
/** Width of one grid cell, µm. */
export const DX = 4;
/** Time step, s. */
export const DT = 10;
/** Simulated seconds per second of the page's clock. */
export const SIM_RATE = 360;

/**
 * Default morphogen: D = 3.6 µm²/s and a half-life of 26 min, Bicoid's best fit from its
 * protein age along the embryo (Durrieu et al. 2018, Mol Syst Biol 14:e8355), which gives
 * λ ≈ 89 µm.
 */
export const BICOID = { D: 3.6, halfLife: 26, length: 500 };
/** Length of a fly egg, µm (Gregor et al. 2007, Cell 130:141, Methods: L ≈ 490 µm). */
export const EGG_LENGTH = 490;
/** Measured length constant of the Bicoid gradient, µm (Gregor et al. 2007: λ ~ 100 µm). */
export const BICOID_LAMBDA = 100;
/** Distance between neighbouring nuclei in the fly embryo, µm (Gregor et al. 2007b). */
export const NUCLEUS_SPACING = 8;

/** Production that makes the source end's level 100 at the default D and half-life. */
export const J0 = 100 * Math.sqrt(BICOID.D * (Math.LN2 / (BICOID.halfLife * 60)));

/** The expansion–repression circuit's constants (the page's own choice; see the notes). */
export const EXPANDER = {
	/** Repression threshold: the morphogen level that switches the expander's production off. */
	Trep: 2,
	/** Hill coefficient of the repression. */
	h: 6,
	/** Expander production, per second. */
	beta: 1e-4,
	/** Expander removal, per second: a lifetime of about 12 days, long against everything else. */
	kE: 1e-6,
	/** Expander diffusion, µm²/s: fast, so E is nearly uniform across the tissue. */
	DE: 60
};

// ------------------------------------------------------------------------------- helpers
/** k (per second) from a half-life in minutes. */
export const rateFromHalfLife = (minutes: number) => Math.LN2 / (minutes * 60);

/** The SDD length scale λ = √(D/k) = √(D·τ), µm. */
export const decayLength = (D: number, halfLife: number) =>
	Math.sqrt(D / rateFromHalfLife(halfLife));

/** Steady state of the plain SDD model at x (µm) in a tissue of length L. */
export function steadySDD(x: number, p: { D: number; halfLife: number; prod: number; L: number }) {
	const lam = decayLength(p.D, p.halfLife);
	const j = p.prod * J0;
	return ((j * lam) / p.D) * (Math.cosh((p.L - x) / lam) / Math.sinh(p.L / lam));
}

/**
 * Where a monotone decreasing profile (values at the cell centres (i + ½)·DX) first falls below
 * `threshold`, µm, by linear interpolation; null if it never reaches it, 0 if it starts below.
 */
export function crossing(profile: ArrayLike<number>, threshold: number, dx = DX): number | null {
	if (profile.length === 0) return null;
	if (profile[0] < threshold) return 0;
	for (let i = 1; i < profile.length; i++) {
		if (profile[i] < threshold) {
			const a = profile[i - 1];
			const b = profile[i];
			return (i - 0.5 + (a - threshold) / (a - b)) * dx;
		}
	}
	return null;
}

/**
 * Positional error of a boundary set by `threshold` when each cell reads the concentration with
 * an error of standard deviation `sigma`: σ_x = σ / |dM/dx| at the crossing, µm.
 */
export function positionalError(profile: ArrayLike<number>, threshold: number, sigma: number) {
	const x = crossing(profile, threshold);
	if (x === null || x === 0) return null;
	const i = Math.min(profile.length - 1, Math.max(1, Math.round(x / DX)));
	const slope = Math.abs(profile[i] - profile[i - 1]) / DX;
	return slope > 0 ? sigma / slope : Infinity;
}

// ------------------------------------------------------------------------------- the tissue
export interface TissueParams {
	/** Diffusion constant, µm²/s. */
	D: number;
	/** Half-life, minutes. */
	halfLife: number;
	/** Production, as a multiple of the default. */
	prod: number;
	/** Whether the expansion–repression circuit runs. */
	expander: boolean;
}

export interface TissueState {
	/** Simulated time, s. */
	t: number;
	/** Morphogen at the cell centres (i + ½)·DX. */
	M: Float64Array;
	/** Expander at the cell centres (all zero when it is off). */
	E: Float64Array;
}

/** Solves a tridiagonal system in place (Thomas algorithm): a x[i-1] + b x[i] + c x[i+1] = d. */
function thomas(
	a: Float64Array,
	b: Float64Array,
	c: Float64Array,
	d: Float64Array,
	x: Float64Array
) {
	const n = d.length;
	const cp = new Float64Array(n);
	const dp = new Float64Array(n);
	cp[0] = c[0] / b[0];
	dp[0] = d[0] / b[0];
	for (let i = 1; i < n; i++) {
		const m = b[i] - a[i] * cp[i - 1];
		cp[i] = c[i] / m;
		dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
	}
	x[n - 1] = dp[n - 1];
	for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
}

/** A row of tissue of length `L` µm, starting with no morphogen. */
export class Tissue {
	readonly L: number;
	readonly n: number;
	private p: TissueParams;
	private s: TissueState;
	private readonly a: Float64Array;
	private readonly b: Float64Array;
	private readonly c: Float64Array;
	private readonly d: Float64Array;

	constructor(L: number, p: TissueParams) {
		this.L = L;
		this.n = Math.max(2, Math.round(L / DX));
		this.p = { ...p };
		this.s = { t: 0, M: new Float64Array(this.n), E: new Float64Array(this.n) };
		this.a = new Float64Array(this.n);
		this.b = new Float64Array(this.n);
		this.c = new Float64Array(this.n);
		this.d = new Float64Array(this.n);
	}

	/** Change the parameters from now on; the morphogen already there stays. */
	set(p: TissueParams) {
		if (this.p.expander && !p.expander) this.s.E.fill(0);
		this.p = { ...p };
	}

	/** Restart the tissue's clock at 0, keeping its contents. */
	resetClock() {
		this.s.t = 0;
	}

	get params(): TissueParams {
		return this.p;
	}

	/** The cell centre of grid cell i, µm. */
	x(i: number) {
		return (i + 0.5) * DX;
	}

	/** One backward-Euler step of `dt` seconds. */
	private step(dt: number) {
		const { n, a, b, c, d } = this;
		const { M, E } = this.s;
		const k = rateFromHalfLife(this.p.halfLife);
		const j = this.p.prod * J0;
		const on = this.p.expander;
		const r = dt / (DX * DX);
		// morphogen: D and k scaled by (1 + E); interface diffusion from the mean of the two cells
		const f = (i: number) => (on ? 1 + E[i] : 1);
		for (let i = 0; i < n; i++) {
			const dl = i > 0 ? this.p.D * 0.5 * (f(i) + f(i - 1)) : 0;
			const dr = i < n - 1 ? this.p.D * 0.5 * (f(i) + f(i + 1)) : 0;
			a[i] = -r * dl;
			c[i] = -r * dr;
			b[i] = 1 + r * (dl + dr) + (dt * k) / f(i);
			d[i] = M[i] + (i === 0 ? (dt * j) / DX : 0);
		}
		const Mold = Float64Array.from(M);
		thomas(a, b, c, d, M);
		if (!on) return;
		// expander: made where the (previous) morphogen is below T_rep
		const { Trep, h, beta, kE, DE } = EXPANDER;
		for (let i = 0; i < n; i++) {
			const dl = i > 0 ? DE : 0;
			const dr = i < n - 1 ? DE : 0;
			a[i] = -r * dl;
			c[i] = -r * dr;
			b[i] = 1 + r * (dl + dr) + dt * kE;
			d[i] = E[i] + (dt * beta) / (1 + (Math.max(0, Mold[i]) / Trep) ** h);
		}
		thomas(a, b, c, d, E);
	}

	/** The state at simulated time t (s); t never runs backwards within one tissue. */
	at(t: number, maxSteps = 4000): TissueState {
		let steps = 0;
		while (this.s.t < t - 1e-9 && steps < maxSteps) {
			const h = Math.min(DT, t - this.s.t);
			this.step(h);
			this.s.t += h;
			steps++;
		}
		// a long jump (a hidden tab) is cut short: the tissue just lags behind the clock
		if (this.s.t < t - 1e-9) this.s.t = t;
		return this.s;
	}

	/** Run until the profile stops changing (or `limit` simulated seconds), and return it. */
	settle(limit = 6e5): TissueState {
		let prev = Float64Array.from(this.s.M);
		const t0 = this.s.t;
		while (this.s.t - t0 < limit) {
			this.at(this.s.t + 600);
			let change = 0;
			for (let i = 0; i < this.n; i++)
				change = Math.max(change, Math.abs(this.s.M[i] - prev[i]) / (prev[i] + 1e-3));
			if (change < 1e-5 && this.s.t - t0 > 3600) break;
			prev = Float64Array.from(this.s.M);
		}
		return this.s;
	}

	/** The morphogen's apparent length scale: −1/slope of ln M over the first 40 % of the row. */
	fitLength(): number {
		const { M } = this.s;
		const m = Math.max(3, Math.floor(this.n * 0.4));
		let sx = 0;
		let sy = 0;
		let sxx = 0;
		let sxy = 0;
		for (let i = 0; i < m; i++) {
			const x = this.x(i);
			const y = Math.log(Math.max(M[i], 1e-12));
			sx += x;
			sy += y;
			sxx += x * x;
			sxy += x * y;
		}
		const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
		return -1 / slope;
	}

	/** The morphogen at x µm, interpolated between cell centres. */
	value(x: number): number {
		const { M } = this.s;
		const u = x / DX - 0.5;
		if (u <= 0) return M[0];
		if (u >= this.n - 1) return M[this.n - 1];
		const i = Math.floor(u);
		return M[i] + (M[i + 1] - M[i]) * (u - i);
	}
}

/** Mean of the expander over the tissue. */
export const meanOf = (v: ArrayLike<number>) => {
	let s = 0;
	for (let i = 0; i < v.length; i++) s += v[i];
	return s / v.length;
};

/** How long the expander runs before the reduced-motion frame, s (a day of simulated time). */
export const EXPANDER_RUN = 24 * 3600;

/**
 * The settled tissue for these parameters: the plain gradient run until it stops changing, and
 * with the expander, that gradient after the circuit has run for EXPANDER_RUN (as the scene does:
 * it switches the circuit on in a tissue whose gradient has formed). Cached: the scenes ask for
 * it under reduced motion.
 */
const settledCache = new Map<string, TissueState>();
export function settled(L: number, p: TissueParams): TissueState {
	const key = `${L}|${p.D}|${p.halfLife}|${p.prod}|${p.expander}`;
	let s = settledCache.get(key);
	if (!s) {
		const tissue = new Tissue(L, { ...p, expander: false });
		let st = tissue.settle();
		if (p.expander) {
			tissue.set(p);
			st = tissue.at(st.t + EXPANDER_RUN, 1e6);
		}
		s = { t: st.t, M: Float64Array.from(st.M), E: Float64Array.from(st.E) };
		if (settledCache.size > 64) settledCache.clear();
		settledCache.set(key, s);
	}
	return s;
}
