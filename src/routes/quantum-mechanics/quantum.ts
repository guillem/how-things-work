/**
 * The time-dependent Schrödinger equation in one dimension, solved for real.
 *
 *   iħ ∂ψ/∂t = −(ħ²/2m) ∂²ψ/∂x² + V(x) ψ
 *
 * ψ lives on a uniform grid of n points (n a power of two, periodic). The
 * integrator is the split-step Fourier method (Strang splitting): half a step
 * of the potential, a full step of the kinetic energy (exact in momentum
 * space, reached with an FFT), another half step of the potential. Every
 * factor has modulus one, so the evolution is unitary: the total probability
 * stays 1 to rounding error, at any step size. The error per step is O(dt³)
 * from the splitting, O(dt²) over a fixed time.
 *
 * Units: for electrons, x in nm, t in fs and energies in eV, with
 *   ħ = 0.658 211 957 eV·fs and ħ²/2mₑ = 0.038 099 82 eV·nm²
 * (CODATA 2018: ħc = 197.326 980 eV·nm, mₑc² = 510 998.950 eV). Other unit
 * systems pass their own { hbar, h2m } (h2m = ħ²/2m); the tests use ħ = m = 1.
 *
 * Used by the page for
 *   - the free wave packet: the kinetic step alone is the exact solution, so
 *     any time is one FFT pair away from the start (`freeEvolve`);
 *   - tunnelling: a Gaussian electron packet sent at a rectangular barrier
 *     (`tunnel`), compared with the plane-wave transmission T(E) of textbook
 *     quantum mechanics and its average over the packet's spread of energies;
 *   - the double slit: past the slits the sideways part of the wave obeys the
 *     same equation with the distance travelled in place of time (the
 *     paraxial approximation), so `slits` propagates the wave leaving each
 *     slit and adds the two amplitudes (`pattern`), or their probabilities
 *     when a which-slit record exists.
 *
 * Simplifications: one dimension (or one sideways dimension for the slits),
 * no spin, no magnetic fields, a sharp-edged barrier; the slit geometry is
 * dimensionless (lengths in units of the slit separation).
 */
import { rng } from '#lib/draw/math.ts';

// ---------------------------------------------------------------- constants

/** Reduced Planck constant, eV·fs. */
export const HBAR = 0.6582119569;
/** ħ²/2mₑ for the electron, eV·nm². */
export const H2M = 0.0380998212;
/** Planck constant, eV·fs. */
export const PLANCK = 2 * Math.PI * HBAR;

export interface Units {
	/** ħ in the unit system. */
	hbar: number;
	/** ħ²/2m in the unit system. */
	h2m: number;
}
export const ELECTRON: Units = { hbar: HBAR, h2m: H2M };
export const NATURAL: Units = { hbar: 1, h2m: 0.5 };

/** Wavenumber (nm⁻¹) of an electron of kinetic energy E (eV): E = ħ²k²/2m. */
export const waveNumber = (E: number) => Math.sqrt(Math.max(0, E) / H2M);
/** de Broglie wavelength λ = h/p (nm) of an electron of kinetic energy E (eV). */
export const deBroglie = (E: number) => (2 * Math.PI) / waveNumber(E);
/** Group (classical) speed ħk/m of an electron of kinetic energy E, in nm/fs. */
export const speed = (E: number) => (2 * H2M * waveNumber(E)) / HBAR;
/** Decay constant κ = √(2m(V − E))/ħ (nm⁻¹) of the wave inside a barrier V > E. */
export const decayConstant = (gap: number) => Math.sqrt(Math.max(0, gap) / H2M);

// ---------------------------------------------------------------- FFT

const plans = new Map<number, { rev: Uint32Array; cos: Float64Array; sin: Float64Array }>();
function plan(n: number) {
	let p = plans.get(n);
	if (p) return p;
	if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`FFT size ${n} is not a power of two`);
	const bits = Math.log2(n);
	const rev = new Uint32Array(n);
	for (let i = 0; i < n; i++) {
		let r = 0;
		for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
		rev[i] = r;
	}
	const cos = new Float64Array(n / 2);
	const sin = new Float64Array(n / 2);
	for (let i = 0; i < n / 2; i++) {
		cos[i] = Math.cos((2 * Math.PI * i) / n);
		sin[i] = Math.sin((2 * Math.PI * i) / n);
	}
	p = { rev, cos, sin };
	plans.set(n, p);
	return p;
}

/**
 * In-place radix-2 FFT: X[k] = Σ x[j] e^(∓2πijk/n) (− forward, + inverse);
 * the inverse also divides by n, so fft(fft(x), inverse) = x.
 */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
	const n = re.length;
	const { rev, cos, sin } = plan(n);
	for (let i = 0; i < n; i++) {
		const j = rev[i];
		if (j > i) {
			let t = re[i];
			re[i] = re[j];
			re[j] = t;
			t = im[i];
			im[i] = im[j];
			im[j] = t;
		}
	}
	const sgn = inverse ? 1 : -1;
	for (let size = 2; size <= n; size *= 2) {
		const half = size / 2;
		const stride = n / size;
		for (let start = 0; start < n; start += size) {
			for (let k = 0; k < half; k++) {
				const wr = cos[k * stride];
				const wi = sgn * sin[k * stride];
				const a = start + k;
				const b = a + half;
				const xr = re[b] * wr - im[b] * wi;
				const xi = re[b] * wi + im[b] * wr;
				re[b] = re[a] - xr;
				im[b] = im[a] - xi;
				re[a] += xr;
				im[a] += xi;
			}
		}
	}
	if (inverse) {
		for (let i = 0; i < n; i++) {
			re[i] /= n;
			im[i] /= n;
		}
	}
}

// ---------------------------------------------------------------- grid and waves

export interface Grid {
	n: number;
	dx: number;
	/** Positions x_j = (j − n/2)·dx: the grid is centred on 0. */
	x: Float64Array;
	/** Wavenumbers in FFT order: 0, Δk, …, (n/2 − 1)Δk, −n/2·Δk, …, −Δk. */
	k: Float64Array;
}

export function grid(n: number, dx: number): Grid {
	const x = new Float64Array(n);
	const k = new Float64Array(n);
	const dk = (2 * Math.PI) / (n * dx);
	for (let j = 0; j < n; j++) {
		x[j] = (j - n / 2) * dx;
		k[j] = (j < n / 2 ? j : j - n) * dk;
	}
	return { n, dx, x, k };
}

export interface Wave {
	re: Float64Array;
	im: Float64Array;
}

export const copyWave = (w: Wave): Wave => ({ re: w.re.slice(), im: w.im.slice() });

/** ∫|ψ|² dx: the total probability. */
export function norm(g: Grid, w: Wave) {
	let s = 0;
	for (let j = 0; j < g.n; j++) s += w.re[j] * w.re[j] + w.im[j] * w.im[j];
	return s * g.dx;
}

/** Probability of finding the particle with a ≤ x < b. */
export function probabilityBetween(g: Grid, w: Wave, a: number, b: number) {
	let s = 0;
	for (let j = 0; j < g.n; j++) {
		const x = g.x[j];
		if (x >= a && x < b) s += w.re[j] * w.re[j] + w.im[j] * w.im[j];
	}
	return s * g.dx;
}

/** Mean position ⟨x⟩ and spread √(⟨x²⟩ − ⟨x⟩²). */
export function moments(g: Grid, w: Wave) {
	let s = 0;
	let sx = 0;
	let sxx = 0;
	for (let j = 0; j < g.n; j++) {
		const p = w.re[j] * w.re[j] + w.im[j] * w.im[j];
		s += p;
		sx += p * g.x[j];
		sxx += p * g.x[j] * g.x[j];
	}
	const mean = sx / s;
	return { mean, spread: Math.sqrt(Math.max(0, sxx / s - mean * mean)) };
}

/** ⟨a|b⟩ = ∫ a* b dx. */
export function overlap(g: Grid, a: Wave, b: Wave) {
	let re = 0;
	let im = 0;
	for (let j = 0; j < g.n; j++) {
		re += a.re[j] * b.re[j] + a.im[j] * b.im[j];
		im += a.re[j] * b.im[j] - a.im[j] * b.re[j];
	}
	return { re: re * g.dx, im: im * g.dx };
}

/**
 * A normalised Gaussian wave packet centred on x0 with position spread σ and
 * mean wavenumber k0: ψ = (2πσ²)^(−1/4) e^(−(x − x0)²/4σ²) e^(ik0x).
 * Its momentum spread is ħ/2σ (the minimum the uncertainty principle allows).
 */
export function gaussian(g: Grid, x0: number, sigma: number, k0: number): Wave {
	const re = new Float64Array(g.n);
	const im = new Float64Array(g.n);
	const a = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
	for (let j = 0; j < g.n; j++) {
		const u = g.x[j] - x0;
		const env = a * Math.exp((-u * u) / (4 * sigma * sigma));
		re[j] = env * Math.cos(k0 * g.x[j]);
		im[j] = env * Math.sin(k0 * g.x[j]);
	}
	return { re, im };
}

/** Spread of a free Gaussian packet after time t: σ(t) = σ₀ √(1 + (ħt / 2mσ₀²)²). */
export const freeSpread = (sigma0: number, t: number, u: Units = ELECTRON) => {
	const hOver2m = u.h2m / u.hbar; // ħ/2m
	return sigma0 * Math.sqrt(1 + ((hOver2m * t) / (sigma0 * sigma0)) ** 2);
};

// ---------------------------------------------------------------- evolution

function multiply(w: Wave, cr: Float64Array, ci: Float64Array) {
	for (let j = 0; j < w.re.length; j++) {
		const r = w.re[j];
		const i = w.im[j];
		w.re[j] = r * cr[j] - i * ci[j];
		w.im[j] = r * ci[j] + i * cr[j];
	}
}

/** Phase factors e^(−iθ_j). */
function phases(theta: (j: number) => number, n: number) {
	const cr = new Float64Array(n);
	const ci = new Float64Array(n);
	for (let j = 0; j < n; j++) {
		const th = theta(j);
		cr[j] = Math.cos(th);
		ci[j] = -Math.sin(th);
	}
	return { cr, ci };
}

/** The exact free evolution: ψ̂(k) picks up e^(−iħk²t/2m). Returns a new wave. */
export function freeEvolve(g: Grid, w: Wave, t: number, u: Units = ELECTRON): Wave {
	const out = copyWave(w);
	fft(out.re, out.im);
	const { cr, ci } = phases((j) => (u.h2m * g.k[j] * g.k[j] * t) / u.hbar, g.n);
	multiply(out, cr, ci);
	fft(out.re, out.im, true);
	return out;
}

/**
 * A split-step integrator for potential V (same units as h2m·k²) and step dt.
 * `run(w, steps)` advances w in place. `absorb`, if given, multiplies ψ by
 * that mask after every step (an absorbing edge; it removes probability).
 */
export function evolver(
	g: Grid,
	V: Float64Array,
	dt: number,
	u: Units = ELECTRON,
	absorb?: Float64Array
) {
	const half = phases((j) => (V[j] * dt) / (2 * u.hbar), g.n);
	const kin = phases((j) => (u.h2m * g.k[j] * g.k[j] * dt) / u.hbar, g.n);
	return {
		run(w: Wave, steps: number) {
			for (let s = 0; s < steps; s++) {
				multiply(w, half.cr, half.ci);
				fft(w.re, w.im);
				multiply(w, kin.cr, kin.ci);
				fft(w.re, w.im, true);
				multiply(w, half.cr, half.ci);
				if (absorb)
					for (let j = 0; j < g.n; j++) {
						w.re[j] *= absorb[j];
						w.im[j] *= absorb[j];
					}
			}
		}
	};
}

/** ⟨H⟩ = ⟨T⟩ + ⟨V⟩, with T evaluated exactly in momentum space. */
export function energy(g: Grid, w: Wave, V: Float64Array, u: Units = ELECTRON) {
	const f = copyWave(w);
	fft(f.re, f.im);
	let kin = 0;
	let pk = 0;
	for (let j = 0; j < g.n; j++) {
		const p = f.re[j] * f.re[j] + f.im[j] * f.im[j];
		kin += p * u.h2m * g.k[j] * g.k[j];
		pk += p;
	}
	let pot = 0;
	let px = 0;
	for (let j = 0; j < g.n; j++) {
		const p = w.re[j] * w.re[j] + w.im[j] * w.im[j];
		pot += p * V[j];
		px += p;
	}
	return kin / pk + pot / px;
}

// ---------------------------------------------------------------- bound states

/**
 * Harmonic oscillator eigenfunctions ψₙ for V = ½mω²x² (natural units ħ = m = 1):
 * ψₙ = (2ⁿ n!)^(−1/2) π^(−1/4) Hₙ(x) e^(−x²/2) at ω = 1, energy (n + ½)ħω.
 */
export function oscillatorState(g: Grid, n: number): Wave {
	const re = new Float64Array(g.n);
	const im = new Float64Array(g.n);
	let fact = 1;
	for (let i = 2; i <= n; i++) fact *= i;
	const c = 1 / Math.sqrt(2 ** n * fact * Math.sqrt(Math.PI));
	for (let j = 0; j < g.n; j++) {
		const x = g.x[j];
		// Hermite polynomials by recurrence: H₀ = 1, H₁ = 2x, Hₖ₊₁ = 2xHₖ − 2kHₖ₋₁.
		let h0 = 1;
		let h1 = 2 * x;
		let h = n === 0 ? h0 : h1;
		for (let k = 1; k < n; k++) {
			h = 2 * x * h1 - 2 * k * h0;
			h0 = h1;
			h1 = h;
		}
		re[j] = c * h * Math.exp((-x * x) / 2);
	}
	return { re, im };
}

/** Energy (eV) of level n of an electron in an infinite square well of width L (nm). */
export const boxEnergy = (n: number, L: number) => (H2M * (n * Math.PI) ** 2) / (L * L);

/** Standing wave n of a box [0, L]: ψₙ = √(2/L) sin(nπx/L) (0 outside). */
export const boxState = (n: number, L: number, x: number) =>
	x <= 0 || x >= L ? 0 : Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);

// ---------------------------------------------------------------- tunnelling

/**
 * Transmission probability of a plane wave of energy E through a rectangular
 * barrier of height V0 and width a (electron units). For E < V0 the wave
 * inside decays with κ = √(2m(V0 − E))/ħ:
 *   T = 1 / (1 + V0² sinh²(κa) / (4E(V0 − E)));
 * above the barrier the sinh becomes a sin of the inside wavenumber.
 */
export function barrierT(E: number, V0: number, a: number) {
	if (E <= 0) return 0;
	if (V0 === 0 || a === 0) return 1;
	const gap = V0 - E;
	if (Math.abs(gap) < 1e-9) return 1 / (1 + (V0 * a * a) / (4 * H2M)); // limit E → V0
	if (gap > 0) {
		const s = Math.sinh(decayConstant(gap) * a);
		return 1 / (1 + (V0 * V0 * s * s) / (4 * E * gap));
	}
	const s = Math.sin(waveNumber(-gap) * a);
	return 1 / (1 + (V0 * V0 * s * s) / (4 * E * -gap));
}

/**
 * The transmission of a Gaussian packet of mean energy E0 and position spread
 * σ: each plane wave in it gets through with its own T, weighted by the
 * packet's momentum distribution |φ(k)|² ∝ e^(−2σ²(k − k0)²).
 */
export function packetT(E0: number, sigma: number, V0: number, a: number) {
	const k0 = waveNumber(E0);
	const sk = 1 / (2 * sigma);
	let s = 0;
	let w = 0;
	const N = 400;
	for (let i = 0; i <= N; i++) {
		const k = k0 + (-6 + (12 * i) / N) * sk;
		if (k <= 0) continue;
		const p = Math.exp((-(k - k0) * (k - k0)) / (2 * sk * sk));
		s += p * barrierT(H2M * k * k, V0, a);
		w += p;
	}
	return s / w;
}

export const TUNNEL_GRID = { n: 1024, dx: 0.05 }; // 51.2 nm wide, k up to 63 nm⁻¹
export const TUNNEL_DT = 0.02; // fs

export interface TunnelSetup {
	/** Mean kinetic energy of the electron, eV. */
	E: number;
	/** Barrier height, eV. */
	V0: number;
	/** Barrier width, nm (rounded to whole grid cells, 0.05 nm). */
	a: number;
	/** Position spread of the packet, nm. */
	sigma?: number;
	/** Where the packet starts, nm (the barrier starts at 0). */
	x0?: number;
	/** How long to run, fs; default: until the packet has moved 2·|x0| past its start. */
	duration?: number;
	/** Snapshot every this many fs. */
	every?: number;
}

/** Barrier width actually used: a whole number of 0.05 nm cells. */
export const snapWidth = (a: number) => Math.round(a / TUNNEL_GRID.dx) * TUNNEL_GRID.dx;

/**
 * Sends a Gaussian electron packet at a barrier V0 on 0 ≤ x < a and records
 * snapshots of ψ. `transmitted` is the probability found beyond the barrier at
 * the end, `reflected` the probability before it; they add up to 1 (the run
 * ends before any of the wave can wrap round the periodic grid).
 */
export function tunnel(setup: TunnelSetup) {
	const { E, V0 } = setup;
	const a = snapWidth(setup.a);
	const sigma = setup.sigma ?? 1.5;
	const x0 = setup.x0 ?? -11;
	const g = grid(TUNNEL_GRID.n, TUNNEL_GRID.dx);
	const V = new Float64Array(g.n);
	// Cell j covers [x_j − dx/2, x_j + dx/2): the barrier is cells 0 … a/dx − 1 past x = 0.
	const cells = Math.round(a / g.dx);
	const j0 = g.n / 2;
	for (let j = j0; j < j0 + cells; j++) V[j] = V0;
	const shift = g.dx / 2; // so the barrier spans exactly [−dx/2, a − dx/2)
	const left = -shift;
	const right = a - shift;
	const v = speed(E);
	const duration = setup.duration ?? (2 * Math.abs(x0)) / v;
	const every = setup.every ?? 0.25;
	const w = gaussian(g, x0 - shift, sigma, waveNumber(E));
	const ev = evolver(g, V, TUNNEL_DT);
	const perShot = Math.max(1, Math.round(every / TUNNEL_DT));
	const shots = Math.ceil(duration / (perShot * TUNNEL_DT));
	const frames: Wave[] = [copyWave(w)];
	for (let s = 0; s < shots; s++) {
		ev.run(w, perShot);
		frames.push(copyWave(w));
	}
	const transmitted = probabilityBetween(g, w, right, Infinity);
	const reflected = probabilityBetween(g, w, -Infinity, left);
	return {
		g,
		V,
		a,
		left,
		right,
		frames,
		dt: perShot * TUNNEL_DT,
		transmitted,
		reflected,
		inside: 1 - transmitted - reflected
	};
}

// ---------------------------------------------------------------- the double slit

/**
 * Two slits of width w, centres ±d/2 apart (d = 1: lengths in units of the
 * slit separation), lit by a wave of wavelength λ coming straight at them.
 * Past the slits the sideways profile ψ(y) evolves by the free Schrödinger
 * equation with "time" z/v; with ħ = m = 1 that is a free evolution for
 * τ = z/k, k = 2π/λ. Each slit's own wave is propagated separately so that
 * they can be added coherently (no record of the slit) or not.
 */
export interface SlitSetup {
	/** Slit width (separation = 1). */
	w: number;
	/** λ × distance to the screen (separation² units): sets the fringe spacing λL/d. */
	lambdaL: number;
	/** Half-height of the window recorded in the columns (default 6). */
	window?: number;
	/** Number of columns recorded between the slits and the screen. */
	columns?: number;
}

export const SLIT_GRID = { n: 2048, dx: 1 / 64 }; // ±16 separations sideways

/** Antialiased slit aperture centred on yc: the fraction of each cell inside the slit. */
function aperture(g: Grid, yc: number, width: number): Wave {
	const re = new Float64Array(g.n);
	const im = new Float64Array(g.n);
	for (let j = 0; j < g.n; j++) {
		const cover = (width / 2 - Math.abs(g.x[j] - yc)) / g.dx + 0.5;
		re[j] = Math.min(1, Math.max(0, cover));
	}
	return { re, im };
}

/**
 * The waves from the two slits between the slits (z = 0) and the screen
 * (z = L), sampled in `columns` columns. a and b are the amplitudes at the
 * screen from the top (y = +½) and bottom (y = −½) slit, scaled so that
 * ∫|a|² + |b|² dy = 1 with both open. Waves that run out sideways past
 * |y| = 12 are absorbed (they would leave the apparatus).
 */
export function slits(setup: SlitSetup) {
	const g = grid(SLIT_GRID.n, SLIT_GRID.dx);
	const columns = setup.columns ?? 120;
	const top = aperture(g, 0.5, setup.w);
	const bot = aperture(g, -0.5, setup.w);
	const scale = 1 / Math.sqrt(norm(g, top) + norm(g, bot));
	for (const s of [top, bot]) for (let j = 0; j < g.n; j++) s.re[j] *= scale;
	// Free evolution for the whole distance: τ = L/k with k = 2π/λ, ħ = m = 1,
	// so ħτ/2m · k² = λL · k_y² / 4π. Steps of L/columns, with an absorbing edge.
	const absorb = new Float64Array(g.n);
	for (let j = 0; j < g.n; j++) {
		const e = Math.abs(g.x[j]) - 12;
		absorb[j] = e <= 0 ? 1 : Math.cos(Math.min(1, e / 3.5) * (Math.PI / 2)) ** 0.25;
	}
	const tau = setup.lambdaL / (2 * Math.PI) / columns; // per column, in units with h2m = ½
	const V = new Float64Array(g.n);
	const evA = evolver(g, V, tau, NATURAL, absorb);
	const half = Math.round((setup.window ?? 6) / g.dx);
	const j0 = g.n / 2 - half;
	const rows = 2 * half;
	const colsTop: Float32Array[] = [];
	const colsBot: Float32Array[] = [];
	/** Re and Im of the wave on the window's cells (j0 … j0 + rows − 1), interleaved. */
	const snap = (s: Wave) => {
		const out = new Float32Array(2 * rows);
		for (let r = 0; r < rows; r++) {
			out[2 * r] = s.re[j0 + r];
			out[2 * r + 1] = s.im[j0 + r];
		}
		return out;
	};
	colsTop.push(snap(top));
	colsBot.push(snap(bot));
	for (let c = 0; c < columns; c++) {
		evA.run(top, 1);
		evA.run(bot, 1);
		colsTop.push(snap(top));
		colsBot.push(snap(bot));
	}
	return { g, a: top, b: bot, colsTop, colsBot, j0, rows };
}

/**
 * Probability density on the screen: P = |a|² + |b|² + 2γ Re(a* b).
 * γ = ⟨d_top|d_bottom⟩ is the overlap of the two states a which-slit detector
 * is left in: γ = 1 when nothing records the slit (the amplitudes add), 0 for
 * a perfect record (the probabilities add, no fringes).
 */
export function pattern(a: Wave, b: Wave, gamma = 1) {
	const n = a.re.length;
	const P = new Float64Array(n);
	for (let j = 0; j < n; j++) {
		const aa = a.re[j] * a.re[j] + a.im[j] * a.im[j];
		const bb = b.re[j] * b.re[j] + b.im[j] * b.im[j];
		const ab = a.re[j] * b.re[j] + a.im[j] * b.im[j];
		P[j] = aa + bb + 2 * gamma * ab;
	}
	return P;
}

/** Fringe visibility (Pmax − Pmin)/(Pmax + Pmin) of P over the cells j0 … j1. */
export function visibility(P: Float64Array, j0: number, j1: number) {
	let hi = -Infinity;
	let lo = Infinity;
	for (let j = j0; j <= j1; j++) {
		hi = Math.max(hi, P[j]);
		lo = Math.min(lo, P[j]);
	}
	return (hi - lo) / (hi + lo);
}

/**
 * The Fraunhofer (far-field) two-slit pattern for slits of width w at
 * separation d, at sideways distance y on a screen at distance L:
 * cos²(πdy/λL) · sinc²(πwy/λL), with 1 at the centre.
 */
export function fraunhofer(y: number, w: number, lambdaL: number, d = 1) {
	const u = (Math.PI * w * y) / lambdaL;
	const s = u === 0 ? 1 : Math.sin(u) / u;
	return Math.cos((Math.PI * d * y) / lambdaL) ** 2 * s * s;
}

// ---------------------------------------------------------------- measurement

/**
 * Draws `count` outcomes from a probability density given on cells (it need
 * not be normalised), by inverting its cumulative sum. Seeded: the same seed
 * gives the same outcomes.
 */
export function sample(P: ArrayLike<number>, count: number, seed = 1) {
	const n = P.length;
	const cdf = new Float64Array(n);
	let s = 0;
	for (let j = 0; j < n; j++) {
		s += Math.max(0, P[j]);
		cdf[j] = s;
	}
	const rand = rng(seed);
	const out = new Uint32Array(count);
	for (let i = 0; i < count; i++) {
		const u = rand() * s;
		let lo = 0;
		let hi = n - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (cdf[mid] < u) lo = mid + 1;
			else hi = mid;
		}
		out[i] = lo;
	}
	return out;
}

/** `count` yes/no outcomes, each yes with probability p (seeded). */
export function outcomes(p: number, count: number, seed = 1) {
	const rand = rng(seed);
	return Array.from({ length: count }, () => rand() < p);
}
