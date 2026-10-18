/**
 * Turing patterns: the Gierer–Meinhardt activator–inhibitor model, its linear stability, and
 * simulations on a square dish, a tapering tail and a growing strip.
 *
 * The model (Gierer & Meinhardt 1972, Kybernetik 12:30; with Meinhardt's saturation κ). Time is
 * measured in lifetimes of the activator, distance in cells of the grid.
 *
 *     ∂a/∂t = Dₐ ∇²a + ρ a² / (h (1 + κ a²)) − μ a + s
 *     ∂h/∂t = Dₕ ∇²h + ρ a² − ν h
 *
 * The activator a makes more of itself (a²) and makes the inhibitor h (a²); the inhibitor
 * suppresses the activator's self-making (the 1/h). s is a small basal production of the
 * activator; κ saturates its self-making, which turns spots into stripes.
 *
 * Linear stability (Turing 1952; Murray, Mathematical Biology II, ch. 2). With J the Jacobian of
 * the reaction terms at the uniform steady state, a small ripple of wavenumber k grows at the
 * larger eigenvalue of J − k²·diag(Dₐ, Dₕ). Without diffusion the steady state is stable
 * (tr J < 0, det J > 0); a band of ripples grows when
 *
 *     d·fₐ + gₕ > 2 √(d · det J),     d = Dₕ / Dₐ,
 *
 * which needs d above a critical ratio d_c (the larger root of the equality, a quadratic in d).
 * The fastest-growing ripple sets the pattern's spacing. For s = 0 and κ = 0 the uniform state is
 * a = ν/μ, h = ρν/μ², and d_c = (3 + 2√2)·ν/μ.
 *
 * Numerics: cell-centred finite differences with no-flux walls (also around a masked shape);
 * each time step takes the reaction explicitly, then diffusion implicitly along rows and then
 * along columns (locally one-dimensional backward Euler, stable for any diffusion constant).
 */
import { rng } from '#lib/draw/math.ts';

// ------------------------------------------------------------------------------- parameters
export interface Rates {
	/** Activator removal rate (1 = one lifetime per time unit). */
	mu: number;
	/** Inhibitor removal rate. */
	nu: number;
	/** Production coefficient (sets the concentrations' scale only). */
	rho: number;
	/** Basal activator production. */
	s: number;
	/** Saturation of the activator's self-making. */
	kappa: number;
}

export interface Params extends Rates {
	/** Activator diffusion constant, cells² per lifetime. */
	Da: number;
	/** Diffusion ratio Dₕ / Dₐ. */
	d: number;
}

/** The page's reaction rates: the inhibitor is removed twice as fast as the activator. */
export const RATES: Rates = { mu: 1, nu: 2, rho: 1, s: 0.1, kappa: 0.04 };
/** The page's default parameters. */
export const DEFAULTS: Params = { ...RATES, Da: 1, d: 40 };
/** The diffusion ratio of the step that varies the saturation (above d_c for every κ ≤ 0.15). */
export const SHAPE_RATIO = 120;
/** The growing strip's parameters: no saturation, so new peaks are inserted between old ones. */
export const GROWTH: Params = { ...DEFAULTS, kappa: 0, d: 20 };
/** The tail's parameters. */
export const TAIL_PARAMS: Params = { ...DEFAULTS, d: 60 };

/**
 * The widest strip in which no ripple across it can grow (cells): its first transverse mode,
 * k = π / width, lies beyond the unstable band. Narrower than this, only bands across it form.
 */
export function bandWidth(p: Params) {
	const band = unstableBand(p);
	return band ? Math.PI / band[1] : Infinity;
}

/** Time step, activator lifetimes. */
export const DT = 0.1;
/** Size of the initial noise: each cell starts within ± this share of the uniform level. */
export const NOISE = 0.05;

// ------------------------------------------------------------------------------- linear theory
/** The uniform steady state (the only one: the activator's balance has a single root). */
export function uniformState(p: Rates) {
	// h = ρa²/ν, so the activator balances when ν/(1 + κa²) − μa + s = 0 (decreasing in a)
	let lo = 0;
	let hi = (p.nu + p.s) / p.mu + 1;
	for (let i = 0; i < 100; i++) {
		const m = (lo + hi) / 2;
		if (p.nu / (1 + p.kappa * m * m) - p.mu * m + p.s > 0) lo = m;
		else hi = m;
	}
	const a = (lo + hi) / 2;
	return { a, h: (p.rho * a * a) / p.nu };
}

/** The reaction terms' Jacobian at the uniform state: ∂f/∂a, ∂f/∂h, ∂g/∂a, ∂g/∂h. */
export function jacobian(p: Rates) {
	const { a, h } = uniformState(p);
	const q = 1 + p.kappa * a * a;
	return {
		fa: (2 * p.rho * a) / (h * q * q) - p.mu,
		fh: -(p.rho * a * a) / (h * h * q),
		ga: 2 * p.rho * a,
		gh: -p.nu
	};
}

/** Growth rate (per lifetime) of a ripple of wavenumber k (radians per cell); < 0 means it fades. */
export function growthRate(p: Params, k: number) {
	const J = jacobian(p);
	const k2 = k * k;
	const A = J.fa - p.Da * k2;
	const B = J.gh - p.Da * p.d * k2;
	const tr = A + B;
	const det = A * B - J.fh * J.ga;
	const disc = tr * tr - 4 * det;
	return disc >= 0 ? (tr + Math.sqrt(disc)) / 2 : tr / 2;
}

/** The fastest-growing ripple: its wavenumber, growth rate and wavelength (cells). */
export function fastestMode(p: Params) {
	// the largest unstable k is below √(fₐ/Dₐ); search a fine grid, then refine
	const J = jacobian(p);
	const kTop = Math.sqrt(Math.max(J.fa, 1e-6) / p.Da) * 1.5 + 0.05;
	let best = -Infinity;
	let bk = 0;
	const n = 400;
	for (let i = 1; i <= n; i++) {
		const k = (kTop * i) / n;
		const r = growthRate(p, k);
		if (r > best) {
			best = r;
			bk = k;
		}
	}
	let lo = Math.max(1e-6, bk - kTop / n);
	let hi = bk + kTop / n;
	for (let i = 0; i < 60; i++) {
		const m1 = lo + (hi - lo) / 3;
		const m2 = hi - (hi - lo) / 3;
		if (growthRate(p, m1) < growthRate(p, m2)) lo = m1;
		else hi = m2;
	}
	const k = (lo + hi) / 2;
	return { k, rate: growthRate(p, k), wavelength: (2 * Math.PI) / k };
}

/** The band of growing wavenumbers [k₁, k₂], or null when no ripple grows. */
export function unstableBand(p: Params): [number, number] | null {
	const J = jacobian(p);
	const det = J.fa * J.gh - J.fh * J.ga;
	// det(J − k²D) = Dₐ Dₕ k⁴ − (Dₕ fₐ + Dₐ gₕ) k² + det J < 0 between its two roots in k²
	const Dh = p.Da * p.d;
	const b = Dh * J.fa + p.Da * J.gh;
	const disc = b * b - 4 * p.Da * Dh * det;
	if (b <= 0 || disc <= 0) return null;
	const r = Math.sqrt(disc);
	return [Math.sqrt((b - r) / (2 * p.Da * Dh)), Math.sqrt((b + r) / (2 * p.Da * Dh))];
}

/**
 * The critical diffusion ratio d_c: patterns form only for Dₕ/Dₐ above it. It does not depend
 * on Dₐ itself, only on the reaction rates.
 */
export function criticalRatio(p: Rates) {
	const J = jacobian(p);
	const det = J.fa * J.gh - J.fh * J.ga;
	// (d fₐ + gₕ)² = 4 d det  ⇔  fₐ² d² + (2 fₐ gₕ − 4 det) d + gₕ² = 0
	const A = J.fa * J.fa;
	const B = 2 * J.fa * J.gh - 4 * det;
	const C = J.gh * J.gh;
	if (J.fa <= 0) return Infinity;
	return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}

// ------------------------------------------------------------------------------- simulation
/** Solves (1 − r·Δ) x = b in place along one run of n cells (stride apart) with no-flux ends. */
function solveRun(
	x: Float32Array,
	r: number,
	n: number,
	off: number,
	stride: number,
	cp: Float64Array,
	dp: Float64Array
) {
	if (n === 1) return;
	for (let i = 0; i < n; i++) {
		const diag = 1 + (i === 0 || i === n - 1 ? r : 2 * r);
		const bi = x[off + i * stride];
		if (i === 0) {
			cp[0] = -r / diag;
			dp[0] = bi / diag;
		} else {
			const m = diag + r * cp[i - 1];
			cp[i] = i === n - 1 ? 0 : -r / m;
			dp[i] = (bi + r * dp[i - 1]) / m;
		}
	}
	x[off + (n - 1) * stride] = dp[n - 1];
	for (let i = n - 2; i >= 0; i--) {
		x[off + i * stride] = dp[i] - cp[i] * x[off + (i + 1) * stride];
	}
}

/**
 * A two-dimensional field of activator and inhibitor on a w × h grid, optionally inside a mask
 * (1 = tissue; cells outside take no part and their walls are no-flux). Starts at the uniform
 * state with seeded noise in the activator.
 */
export class Field {
	readonly w: number;
	readonly h: number;
	readonly mask: Uint8Array | null;
	readonly a: Float32Array;
	readonly inh: Float32Array;
	p: Params;
	/** Steps taken. */
	steps = 0;
	/** Runs of tissue along each row and each column: [offset, length, stride]. */
	private runs: [number, number, number][] = [];
	private cp: Float64Array;
	private dp: Float64Array;

	constructor(w: number, h: number, p: Params, seed: number, mask: Uint8Array | null = null) {
		this.w = w;
		this.h = h;
		this.mask = mask;
		this.p = p;
		const n = w * h;
		this.a = new Float32Array(n);
		this.inh = new Float32Array(n);
		const st = uniformState(p);
		const r = rng(seed);
		for (let i = 0; i < n; i++) {
			this.a[i] = st.a * (1 + NOISE * (2 * r() - 1));
			this.inh[i] = st.h;
		}
		this.cp = new Float64Array(Math.max(w, h));
		this.dp = new Float64Array(Math.max(w, h));
		const inside = (i: number) => !mask || mask[i] === 1;
		for (let y = 0; y < h; y++) {
			let x = 0;
			while (x < w) {
				if (!inside(y * w + x)) {
					x++;
					continue;
				}
				const start = x;
				while (x < w && inside(y * w + x)) x++;
				this.runs.push([y * w + start, x - start, 1]);
			}
		}
		const rows = this.runs.length;
		for (let x = 0; x < w; x++) {
			let y = 0;
			while (y < h) {
				if (!inside(y * w + x)) {
					y++;
					continue;
				}
				const start = y;
				while (y < h && inside(y * w + x)) y++;
				this.runs.push([start * w + x, y - start, w]);
			}
		}
		this.rowRuns = rows;
	}
	private rowRuns: number;

	/** Simulated time, activator lifetimes. */
	get time() {
		return this.steps * DT;
	}

	/** Takes n time steps. */
	step(n = 1) {
		const { a, inh, mask } = this;
		const { mu, nu, rho, s, kappa, Da, d } = this.p;
		const N = a.length;
		const ra = DT * Da;
		const rh = DT * Da * d;
		for (let k = 0; k < n; k++) {
			for (let i = 0; i < N; i++) {
				if (mask && mask[i] === 0) continue;
				const ai = a[i];
				const hi = inh[i];
				const a2 = ai * ai;
				a[i] = ai + DT * ((rho * a2) / (hi * (1 + kappa * a2)) - mu * ai + s);
				inh[i] = hi + DT * (rho * a2 - nu * hi);
			}
			// rows first, then columns
			for (const [off, len, stride] of this.runs) {
				solveRun(a, ra, len, off, stride, this.cp, this.dp);
				solveRun(inh, rh, len, off, stride, this.cp, this.dp);
			}
			this.steps++;
		}
	}

	/** Takes steps until `time` (activator lifetimes) is reached. */
	runTo(time: number) {
		const target = Math.round(time / DT);
		if (target > this.steps) this.step(target - this.steps);
	}

	/** Mean and standard deviation of the activator over the tissue. */
	stats() {
		let n = 0;
		let sum = 0;
		let sq = 0;
		let max = -Infinity;
		let min = Infinity;
		for (let i = 0; i < this.a.length; i++) {
			if (this.mask && this.mask[i] === 0) continue;
			const v = this.a[i];
			n++;
			sum += v;
			sq += v * v;
			if (v > max) max = v;
			if (v < min) min = v;
		}
		const mean = sum / n;
		return { mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), min, max };
	}

	/**
	 * The ripple's relative size: the activator's standard deviation over the uniform level
	 * (about 0.029 for the starting noise).
	 */
	contrast() {
		return this.stats().sd / uniformState(this.p).a;
	}

	/** Used by tests: the number of row runs (rows of tissue). */
	get rowCount() {
		return this.rowRuns;
	}
}

// ------------------------------------------------------------------------------- measuring
/** In-place radix-2 FFT of (re, im) of length n (a power of two). */
function fft(re: Float64Array, im: Float64Array) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}
	for (let len = 2; len <= n; len <<= 1) {
		const ang = (-2 * Math.PI) / len;
		const wr = Math.cos(ang);
		const wi = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let cr = 1;
			let ci = 0;
			for (let j = 0; j < len / 2; j++) {
				const ur = re[i + j];
				const ui = im[i + j];
				const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
				const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
				re[i + j] = ur + vr;
				im[i + j] = ui + vi;
				re[i + j + len / 2] = ur - vr;
				im[i + j + len / 2] = ui - vi;
				const t = cr * wr - ci * wi;
				ci = cr * wi + ci * wr;
				cr = t;
			}
		}
	}
}

/**
 * The pattern's dominant wavelength (cells) on a square grid whose side is a power of two: the
 * peak of the radially averaged power spectrum of the activator (mean removed), refined by a
 * parabola through the neighbouring rings.
 */
export function dominantWavelength(values: Float32Array, n: number) {
	let mean = 0;
	for (let i = 0; i < n * n; i++) mean += values[i];
	mean /= n * n;
	const re = new Float64Array(n * n);
	const im = new Float64Array(n * n);
	for (let i = 0; i < n * n; i++) re[i] = values[i] - mean;
	const rr = new Float64Array(n);
	const ri = new Float64Array(n);
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			rr[x] = re[y * n + x];
			ri[x] = im[y * n + x];
		}
		fft(rr, ri);
		for (let x = 0; x < n; x++) {
			re[y * n + x] = rr[x];
			im[y * n + x] = ri[x];
		}
	}
	for (let x = 0; x < n; x++) {
		for (let y = 0; y < n; y++) {
			rr[y] = re[y * n + x];
			ri[y] = im[y * n + x];
		}
		fft(rr, ri);
		for (let y = 0; y < n; y++) {
			re[y * n + x] = rr[y];
			im[y * n + x] = ri[y];
		}
	}
	const rings = new Float64Array(n);
	const counts = new Float64Array(n);
	for (let y = 0; y < n; y++) {
		const ky = y <= n / 2 ? y : y - n;
		for (let x = 0; x < n; x++) {
			const kx = x <= n / 2 ? x : x - n;
			const r = Math.round(Math.hypot(kx, ky));
			if (r === 0 || r >= n / 2) continue;
			const pw = re[y * n + x] ** 2 + im[y * n + x] ** 2;
			rings[r] += pw;
			counts[r]++;
		}
	}
	let best = 1;
	for (let r = 2; r < n / 2; r++) {
		if (rings[r] / counts[r] > rings[best] / counts[best]) best = r;
	}
	const p = (r: number) => (r > 0 && r < n / 2 ? rings[r] / counts[r] : 0);
	const y0 = p(best - 1);
	const y1 = p(best);
	const y2 = p(best + 1);
	const den = y0 - 2 * y1 + y2;
	const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
	return n / (best + shift);
}

/**
 * The high-activator patches of a field (cells above the midpoint between its lowest and highest
 * activator), sorted into spots (no wider than `spotSize` cells in either direction) and stripes
 * (longer patches). `stripeShare` is the share of the high cells that lie in stripes.
 */
export function patches(f: Field, spotSize: number) {
	const { w, h, a, mask } = f;
	const st = f.stats();
	const cut = (st.min + st.max) / 2;
	const seen = new Uint8Array(w * h);
	const stack: number[] = [];
	let spots = 0;
	let stripes = 0;
	let high = 0;
	let inStripes = 0;
	if (st.max - st.min < 0.2 * st.mean) return { spots: 0, stripes: 0, stripeShare: 0 };
	const visit = (k: number) => {
		if (seen[k] || a[k] <= cut || (mask && mask[k] === 0)) return;
		seen[k] = 1;
		stack.push(k);
	};
	for (let i = 0; i < w * h; i++) {
		if ((mask && mask[i] === 0) || a[i] <= cut || seen[i]) continue;
		let x0 = w;
		let x1 = -1;
		let y0 = h;
		let y1 = -1;
		let size = 0;
		visit(i);
		while (stack.length) {
			const j = stack.pop()!;
			size++;
			const x = j % w;
			const y = (j - x) / w;
			x0 = Math.min(x0, x);
			x1 = Math.max(x1, x);
			y0 = Math.min(y0, y);
			y1 = Math.max(y1, y);
			if (x > 0) visit(j - 1);
			if (x < w - 1) visit(j + 1);
			if (y > 0) visit(j - w);
			if (y < h - 1) visit(j + w);
		}
		high += size;
		if (x1 - x0 + 1 <= spotSize && y1 - y0 + 1 <= spotSize) spots++;
		else {
			stripes++;
			inStripes += size;
		}
	}
	return { spots, stripes, stripeShare: high ? inStripes / high : 0 };
}

// ------------------------------------------------------------------------------- the dish
/** Side of the square dish, cells. */
export const DISH = 128;

/** A fresh dish at parameters p (seeded noise). */
export function dish(p: Params, seed = 1) {
	return new Field(DISH, DISH, p, seed);
}

// ------------------------------------------------------------------------------- the tail
/**
 * The tail domain, w × h cells: a body of full height up to column `body`, a taper to column
 * `taper`, then a tail of constant width to the end.
 */
export const TAIL = { w: 240, h: 64, body: 64, taper: 136 };

/** The animal's half-width (cells) at column x, for a tail `tip` cells wide. */
export function tailHalfWidth(x: number, tip: number) {
	const { h, body, taper } = TAIL;
	if (x < body) return h / 2;
	const u = Math.min(1, (x - body) / (taper - body));
	// a smooth taper from the body to the tail
	const s = u * u * (3 - 2 * u);
	return h / 2 + (tip / 2 - h / 2) * s;
}

/** The tail's mask: 1 inside the animal. */
export function tailMask(tip: number) {
	const { w, h } = TAIL;
	const m = new Uint8Array(w * h);
	for (let x = 0; x < w; x++) {
		const hw = tailHalfWidth(x, tip);
		for (let y = 0; y < h; y++) {
			if (Math.abs(y + 0.5 - h / 2) <= hw) m[y * w + x] = 1;
		}
	}
	return m;
}

/** A fresh tail domain with tip width `tip` (cells). */
export function tail(p: Params, tip: number, seed = 1) {
	return new Field(TAIL.w, TAIL.h, p, seed, tailMask(tip));
}

/**
 * For each column of the tail: whether its high-activator cells span the column's whole width (a
 * band across the tail) rather than part of it (spots). Columns with no high cells are null.
 */
export function bandColumns(f: Field) {
	const { w, h, a, mask } = f;
	const st = f.stats();
	const cut = (st.min + st.max) / 2;
	const out: (boolean | null)[] = [];
	for (let x = 0; x < w; x++) {
		let inside = 0;
		let high = 0;
		for (let y = 0; y < h; y++) {
			const i = y * w + x;
			if (mask && mask[i] === 0) continue;
			inside++;
			if (a[i] > cut) high++;
		}
		out.push(high === 0 ? null : high === inside);
	}
	return out;
}

// ------------------------------------------------------------------------------- the growing strip
/** The growing strip: its length grows from L0 to L1 cells, drawn with N points. */
export const STRIP = { N: 256, L0: 40, L1: 200, grow: 600, rows: 240 };

/**
 * A one-dimensional strip that grows uniformly (exponentially) from L0 to L1 cells over `grow`
 * lifetimes after a first `settle` lifetimes at L0, as a fish's skin grows with it. The points
 * move apart as it grows, so the diffusion between neighbours weakens; growth also dilutes both
 * chemicals (the −(L′/L)·c term of uniform growth).
 */
export class Strip {
	readonly N: number;
	readonly a: Float32Array;
	readonly inh: Float32Array;
	readonly p: Params;
	readonly settle: number;
	readonly L0: number;
	readonly L1: number;
	readonly growTime: number;
	steps = 0;
	private cp: Float64Array;
	private dp: Float64Array;

	constructor(p: Params, seed = 1, opts: Partial<typeof STRIP> & { settle?: number } = {}) {
		const o = { ...STRIP, ...opts };
		this.N = o.N;
		this.p = p;
		this.L0 = o.L0;
		this.L1 = o.L1;
		this.growTime = o.grow;
		this.settle = opts.settle ?? 60;
		this.a = new Float32Array(this.N);
		this.inh = new Float32Array(this.N);
		const st = uniformState(p);
		const r = rng(seed);
		for (let i = 0; i < this.N; i++) {
			this.a[i] = st.a * (1 + NOISE * (2 * r() - 1));
			this.inh[i] = st.h;
		}
		this.cp = new Float64Array(this.N);
		this.dp = new Float64Array(this.N);
	}

	get time() {
		return this.steps * DT;
	}

	/** Length (cells) at time t. */
	length(t = this.time) {
		const u = Math.max(0, Math.min(1, (t - this.settle) / this.growTime));
		return this.L0 * (this.L1 / this.L0) ** u;
	}

	/** The relative growth rate L′/L at time t. */
	private rate(t: number) {
		if (t < this.settle || t > this.settle + this.growTime) return 0;
		return Math.log(this.L1 / this.L0) / this.growTime;
	}

	step(n = 1) {
		const { a, inh, N } = this;
		const { mu, nu, rho, s, kappa, Da, d } = this.p;
		for (let k = 0; k < n; k++) {
			const t = this.time;
			const g = this.rate(t);
			const dx = this.length(t) / N;
			for (let i = 0; i < N; i++) {
				const ai = a[i];
				const hi = inh[i];
				const a2 = ai * ai;
				a[i] = ai + DT * ((rho * a2) / (hi * (1 + kappa * a2)) - mu * ai + s - g * ai);
				inh[i] = hi + DT * (rho * a2 - nu * hi - g * hi);
			}
			solveRun(a, (DT * Da) / (dx * dx), N, 0, 1, this.cp, this.dp);
			solveRun(inh, (DT * Da * d) / (dx * dx), N, 0, 1, this.cp, this.dp);
			this.steps++;
		}
	}

	runTo(time: number) {
		const target = Math.round(time / DT);
		if (target > this.steps) this.step(target - this.steps);
	}

	/** Positions (0–1 along the strip) of the activator's peaks. */
	peaks() {
		const { a, N } = this;
		let max = -Infinity;
		let min = Infinity;
		for (const v of a) {
			max = Math.max(max, v);
			min = Math.min(min, v);
		}
		const cut = (max + min) / 2;
		const out: number[] = [];
		if (max - min < 0.2 * max) return out;
		let i = 0;
		while (i < N) {
			if (a[i] > cut) {
				let top = i;
				while (i < N && a[i] > cut) {
					if (a[i] > a[top]) top = i;
					i++;
				}
				out.push((top + 0.5) / N);
			} else i++;
		}
		return out;
	}

	/** Total simulated time of a run: settling, growing, and a little after. */
	get total() {
		return this.settle + this.growTime + 40;
	}
}
