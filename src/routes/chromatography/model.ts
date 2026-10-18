/**
 * The chromatography column: the Giddings–Eyring stochastic model, plus axial diffusion and
 * multipath (eddy) dispersion, run as a seeded particle simulation.
 *
 * Each molecule alternates between the mobile phase (where it is carried along at the flow
 * speed u) and the stationary phase (where it does not move). Its stays in each phase are
 * exponentially distributed: it sticks at a rate k_a while moving and comes unstuck at a rate
 * k_d while stuck, and the retention factor k′ = k_a / k_d is the ratio of the time it spends
 * stuck to the time it spends moving. While it moves, its position also spreads by diffusion
 * along the column (variance 2·γ·D_m per second of moving) and by the uneven paths through the
 * packing (variance 2·λ·d_p per millimetre travelled: a spread set by the distance, not the
 * time, which is why it does not depend on the flow).
 *
 * A real molecule sticks tens of thousands of times on its way through a column. Simulating
 * that one hop at a time would be slow, so the simulation takes the hops in blocks: the moving
 * time before the K-th sticking is a Gamma(K, k_a) variable, the K stays on the surface add up
 * to a Gamma(K, k_d) variable, and the Gaussian spreads of the moving parts add up to one
 * Gaussian; these sums are exact. Blocks shrink as the molecule nears the outlet, down to
 * single hops. The one approximation is the moment it leaves: it is interpolated linearly
 * within the last moving stretch (a molecule that wanders past the outlet and back within one
 * stretch is not caught), an error of about one hop, milliseconds against peak widths of
 * seconds. The model tests check it against the exact first-passage times of a molecule that
 * never sticks, and against much finer blocks.
 *
 * Units: millimetres, seconds; the particle size d_p in micrometres.
 */
import { rng } from '#lib/draw/math.ts';

/** Diffusion coefficient of a small molecule in a liquid, mm²/s (10⁻⁹ m²/s). */
export const DM = 1e-3;
/** Obstruction factor: the packing slows diffusion along the column. B = 2γD_m. */
export const GAMMA = 0.7;
/** Packing factor of the multipath term: A = 2λd_p. */
export const LAMBDA = 0.5;
/**
 * Exchange rate k_d = κ·D_m/d_p²: the stationary phase lines the pores of the particles, and
 * a molecule's time to diffuse in and out of a pore grows as the square of the particle size.
 */
export const KAPPA = 8;

export interface Conditions {
	/** Column length, mm. */
	L: number;
	/** Linear flow speed of the mobile phase, mm/s. */
	u: number;
	/** Particle size, µm. */
	dp: number;
}

export interface Compound {
	/** Retention factor k′: time stuck / time moving. */
	k: number;
	/** Multiplies the exchange rate k_d (1 = the column's own; small = slow exchange). */
	exchange?: number;
	/**
	 * A few much stickier sites: the share of stickings that land on one, and the mean time a
	 * molecule stays there, s.
	 */
	sticky?: { share: number; hold: number };
}

/** Each block of hops takes about 1/BLOCKS of the hops still ahead. */
const BLOCKS = 8;

export const DEFAULT: Conditions = { L: 50, u: 1, dp: 5 };

/** Time an unretained molecule takes to cross the column, s. */
export const tM = (c: Conditions) => c.L / c.u;

/** Rates of the model, per second, and the axial diffusion coefficient and A, in mm units. */
export function rates(c: Conditions, cmp: Compound) {
	const dpMm = c.dp / 1000;
	const kd = ((KAPPA * DM) / (dpMm * dpMm)) * (cmp.exchange ?? 1);
	const share = cmp.sticky?.share ?? 0;
	const ka = cmp.k * kd;
	return {
		kd,
		/** Stickings on ordinary sites, per second of moving. */
		kaWeak: ka * (1 - share),
		/** Stickings on the very sticky sites, per second of moving. */
		kaStrong: ka * share,
		kdStrong: cmp.sticky ? 1 / cmp.sticky.hold : 0,
		/** Axial diffusion coefficient, mm²/s. */
		D: GAMMA * DM,
		/** Multipath term, mm. */
		A: 2 * LAMBDA * dpMm
	};
}

/**
 * The van Deemter terms the model should produce, mm units: H = A + B/u + C·u, with
 * A = 2λd_p, B = 2γD_m and the Giddings–Eyring exchange term C = 2k′ / ((1 + k′)² k_d).
 * Only for a compound without sticky sites.
 */
export function theory(c: Conditions, cmp: Compound) {
	const r = rates(c, cmp);
	const B = 2 * r.D;
	const C = (2 * cmp.k) / ((1 + cmp.k) ** 2 * r.kd);
	return { A: r.A, B, C, H: r.A + B / c.u + C * c.u };
}

// ---- random variables --------------------------------------------------------------------

type Rand = () => number;

function normal(rand: Rand) {
	let u = 0;
	while (u <= 1e-300) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gamma(shape, rate) for shape ≥ 1 (Marsaglia and Tsang, 2000). */
function gamma(rand: Rand, shape: number, rate: number) {
	if (shape === 1) return -Math.log(1 - rand()) / rate;
	const d = shape - 1 / 3;
	const c = 1 / Math.sqrt(9 * d);
	for (;;) {
		let x: number;
		let v: number;
		do {
			x = normal(rand);
			v = 1 + c * x;
		} while (v <= 0);
		v = v * v * v;
		const u = rand();
		if (u < 1 - 0.0331 * x ** 4) return (d * v) / rate;
		if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return (d * v) / rate;
	}
}

function poisson(rand: Rand, mean: number) {
	if (mean <= 0) return 0;
	if (mean > 50) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal(rand)));
	const L = Math.exp(-mean);
	let k = 0;
	let p = rand();
	while (p > L) {
		k++;
		p *= rand();
	}
	return k;
}

function binomial(rand: Rand, n: number, p: number) {
	if (n <= 0 || p <= 0) return 0;
	if (p >= 1) return n;
	if (n > 60) {
		const v = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * normal(rand));
		return Math.min(n, Math.max(0, v));
	}
	let k = 0;
	for (let i = 0; i < n; i++) if (rand() < p) k++;
	return k;
}

// ---- one molecule ------------------------------------------------------------------------

/**
 * A molecule's way through the column as breakpoints (time s, position mm), from the
 * injection at (0, 0) to its exit at x = L. Between breakpoints it moves in a straight line.
 * `moving[i]` tells whether the segment ending at breakpoint i was spent moving (1), stuck (0)
 * or a block of many hops (2).
 */
export interface Track {
	t: number[];
	x: number[];
	moving: number[];
	/** Exit time, s. */
	exit: number;
	/** Number of times it stuck. */
	hops: number;
}

/**
 * Runs one molecule. With `dt` (s), blocks are kept shorter than dt and every breakpoint is
 * recorded, for drawing; without it only the exit time and the hop count are kept.
 */
function runMolecule(
	c: Conditions,
	cmp: Compound,
	rand: Rand,
	dt?: number,
	blocks = BLOCKS
): Track {
	const r = rates(c, cmp);
	const { u, L } = c;
	const spread = 2 * r.D; // per second of moving
	const track: Track = { t: [0], x: [0], moving: [1], exit: 0, hops: 0 };
	let t = 0;
	let x = 0;
	const record = (time: number, pos: number, kind: number) => {
		if (!dt) return;
		track.t.push(time);
		track.x.push(pos);
		track.moving.push(kind);
	};
	for (let guard = 0; guard < 1e6; guard++) {
		const rest = L - x;
		// Moving time of this block, and the stickings at its end.
		let K: number;
		let Tm: number;
		if (r.kaWeak > 0) {
			const expected = (r.kaWeak * rest) / u;
			K = Math.max(1, Math.floor(expected / blocks));
			if (dt) K = Math.max(1, Math.min(K, Math.floor((r.kaWeak * dt) / (1 + cmp.k))));
			Tm = gamma(rand, K, r.kaWeak);
		} else {
			// Never sticks (or only on the sticky sites): move in chunks of time.
			K = 0;
			Tm = Math.max(rest / u / blocks, (1e-5 * L) / u);
			if (dt) Tm = Math.min(Tm, dt);
		}
		const strong = poisson(rand, r.kaStrong * Tm);
		const dx = u * Tm + Math.sqrt(spread * Tm + r.A * u * Tm) * normal(rand);
		if (x + dx >= L) {
			// It leaves during this moving stretch, at a fraction f of it (interpolated). The
			// stickings before that moment are kept: given the block's moving time, the first
			// K − 1 of them fall at uniformly random moments in it (and so do the sticky ones).
			const f = (L - x) / dx;
			const before = binomial(rand, Math.max(0, K - 1), f);
			const strongBefore = binomial(rand, strong, f);
			t +=
				f * Tm +
				(before > 0 ? gamma(rand, before, r.kd) : 0) +
				(strongBefore > 0 ? gamma(rand, strongBefore, r.kdStrong) : 0);
			track.hops += before + strongBefore;
			record(t, L, K > 1 ? 2 : 1);
			track.exit = t;
			return track;
		}
		t += Tm;
		x += dx;
		const Ts =
			(K > 0 ? gamma(rand, K, r.kd) : 0) + (strong > 0 ? gamma(rand, strong, r.kdStrong) : 0);
		track.hops += K + strong;
		if (K > 1 || strong > 1) {
			t += Ts;
			record(t, x, 2);
		} else {
			record(t, x, 1);
			if (Ts > 0) {
				t += Ts;
				record(t, x, 0);
			}
		}
	}
	track.exit = t;
	return track;
}

/**
 * Exit times of n molecules, s (and their mean number of stickings). `blocks`: each block takes
 * about 1/blocks of the hops still ahead (larger is finer and slower).
 */
export function elute(c: Conditions, cmp: Compound, n: number, seed: number, blocks = BLOCKS) {
	const rand = rng(seed);
	const times = new Float64Array(n);
	let hops = 0;
	for (let i = 0; i < n; i++) {
		const tr = runMolecule(c, cmp, rand, undefined, blocks);
		times[i] = tr.exit;
		hops += tr.hops;
	}
	return { times, hops: hops / n };
}

/** Breakpoint tracks of n molecules, for drawing; blocks no longer than dt seconds. */
export function tracks(c: Conditions, cmp: Compound, n: number, seed: number, dt: number) {
	const rand = rng(seed);
	return Array.from({ length: n }, () => runMolecule(c, cmp, rand, dt));
}

/** Position of a molecule at `time` (mm), or null once it has left the column. */
export function positionAt(tr: Track, time: number): number | null {
	if (time >= tr.exit) return null;
	const { t, x } = tr;
	let lo = 0;
	let hi = t.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (t[mid] <= time) lo = mid;
		else hi = mid;
	}
	const span = t[hi] - t[lo];
	return span > 0 ? x[lo] + ((x[hi] - x[lo]) * (time - t[lo])) / span : x[lo];
}

// ---- peaks -------------------------------------------------------------------------------

export interface Peak {
	/** Mean retention time, s. */
	mean: number;
	/** Standard deviation, s. */
	sd: number;
	/** Skewness (0 for a symmetric peak, positive for a tail on the late side). */
	skew: number;
	/** Plate count N = (t_R / σ)². */
	N: number;
	/** Plate height H = L / N, mm. */
	H: number;
}

export function peak(times: ArrayLike<number>, L: number): Peak {
	const n = times.length;
	let s = 0;
	for (let i = 0; i < n; i++) s += times[i];
	const mean = s / n;
	let m2 = 0;
	let m3 = 0;
	for (let i = 0; i < n; i++) {
		const d = times[i] - mean;
		m2 += d * d;
		m3 += d * d * d;
	}
	m2 /= n - 1;
	m3 /= n;
	const sd = Math.sqrt(m2);
	const N = (mean * mean) / m2;
	return { mean, sd, skew: m3 / sd ** 3, N, H: L / N };
}

/** Resolution of two peaks: the gap between them over the sum of their half-widths (2σ). */
export const resolution = (a: Peak, b: Peak) => Math.abs(b.mean - a.mean) / (2 * (a.sd + b.sd));

// ---- the van Deemter curve ---------------------------------------------------------------

/** Flow speeds of the sweep, mm/s (evenly spaced on a log scale, 0.1 to 10). */
export const SWEEP = [0.1, 0.16, 0.25, 0.4, 0.63, 1, 1.6, 2.5, 4, 6.3, 10];

/** Plate height measured from the simulated peak at each flow speed, mm. */
export function sweep(
	cmp: Compound,
	dp: number,
	L: number,
	n: number,
	seed: number,
	speeds: readonly number[] = SWEEP
) {
	return speeds.map((u, i) => {
		const { times } = elute({ L, u, dp }, cmp, n, seed + 7919 * i);
		return { u, H: peak(times, L).H };
	});
}

/**
 * Least-squares fit of H = A + B/u + C·u to measured points; also the flow speed of the
 * minimum, √(B/C), and the plate height there, A + 2√(BC).
 */
export function fitVanDeemter(points: readonly { u: number; H: number }[]) {
	// Normal equations for the basis (1, 1/u, u).
	const M = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	const v = [0, 0, 0];
	for (const { u, H } of points) {
		const f = [1, 1 / u, u];
		for (let i = 0; i < 3; i++) {
			v[i] += f[i] * H;
			for (let j = 0; j < 3; j++) M[i][j] += f[i] * f[j];
		}
	}
	// Gaussian elimination.
	for (let i = 0; i < 3; i++) {
		let p = i;
		for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
		[M[i], M[p]] = [M[p], M[i]];
		[v[i], v[p]] = [v[p], v[i]];
		for (let r = i + 1; r < 3; r++) {
			const f = M[r][i] / M[i][i];
			for (let j = i; j < 3; j++) M[r][j] -= f * M[i][j];
			v[r] -= f * v[i];
		}
	}
	const x = [0, 0, 0];
	for (let i = 2; i >= 0; i--) {
		let s = v[i];
		for (let j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
		x[i] = s / M[i][i];
	}
	const [A, B, C] = x;
	const uOpt = B > 0 && C > 0 ? Math.sqrt(B / C) : NaN;
	return { A, B, C, uOpt, Hmin: A + 2 * Math.sqrt(Math.max(0, B * C)) };
}

// ---- a close-up of the hops --------------------------------------------------------------

/**
 * One molecule's hops in the close-up, in slowed-down time: alternating stays, moving first,
 * with mean stuck time `stuck` and mean moving time stuck / k′. Returns the times at which it
 * switches phase, up to `duration`.
 */
export function hopTimes(k: number, stuck: number, duration: number, seed: number) {
	const rand = rng(seed);
	const out: number[] = [];
	if (k <= 0) return out;
	let t = 0;
	let moving = true;
	while (t < duration) {
		const mean = moving ? stuck / k : stuck;
		t += -Math.log(1 - rand()) * mean;
		out.push(t);
		moving = !moving;
	}
	return out;
}

/** Time spent moving up to `time`, from the switch times of `hopTimes`. */
export function movingTime(switches: readonly number[], time: number) {
	let moving = true;
	let last = 0;
	let total = 0;
	for (const s of switches) {
		if (s >= time) break;
		if (moving) total += s - last;
		last = s;
		moving = !moving;
	}
	if (moving) total += time - last;
	return total;
}
