/**
 * A box of gas particles, and the counting behind entropy.
 *
 * 1. The gas. N round particles of equal mass bounce around a 2 × 1 box
 *    (2D), obeying Newton's laws: they move in straight lines and push each
 *    other apart when they touch. Optionally a wall splits the box in two
 *    until a given time. The "temperature" of a region is the average kinetic
 *    energy of the particles in it (in 2D, ⟨½mv²⟩ = k_B·T), on an arbitrary
 *    scale: one temperature unit is an average kinetic energy of E0.
 *
 *    Simplifications, stated on the page: 2D instead of 3D; a few dozen
 *    particles instead of ~10²³; the particles are slightly soft disks (a
 *    stiff spring force while they overlap) instead of perfectly hard ones, so
 *    that an ordinary step-by-step integrator can be used.
 *
 *    The integrator is the "bit-reversible" leapfrog of Levesque & Verlet
 *    (J. Stat. Phys. 72, 519, 1993): positions are whole numbers of tiny units
 *    (SCALE per box height) and each step is
 *        X(n+1) = 2·X(n) − X(n−1) + round(a(X(n))·dt²·SCALE).
 *    The rounded force term depends only on X(n), so the same rule run with
 *    X(n+1) and X(n) swapped retraces the past exactly, bit for bit. That is
 *    what reversing every velocity means, and the only way a computer can do
 *    it without rounding errors creeping in. A "nudge" moves one particle by a
 *    tiny distance at the moment of reversal.
 *
 * 2. Counting. A macrostate (what we can measure: how many particles are in
 *    the left half, how much energy each half holds) is consistent with many
 *    microstates (exactly where every particle is and how it moves).
 *      - Positions: the number of ways to have k of N particles in the left
 *        half is C(N, k).
 *      - Energy: split the energy into q tiny equal packets; the number of
 *        ways to share q packets among n particles is C(q + n − 1, q). For a
 *        2D particle each way corresponds to an equal slice of possible
 *        velocities (a ring of equal area in the velocity plane), so this
 *        counting is exact in the limit of tiny packets: Ω ∝ E^(n−1).
 *    Entropy is S = k_B · ln Ω.
 */
import { rng } from '#lib/draw/math.ts';

// ------------------------------------------------------------------ constants

/** Box size (length units). The middle wall sits at x = W / 2. */
export const W = 2;
export const H = 1;
/** Particle radius. */
export const R = 0.022;
/** Half-thickness of the middle wall. */
export const WALL = 0.012;
/** Stiffness of the contact force (mass 1). */
export const KAPPA = 3e4;
/** Integrator time step (s) and recorded frames per second. */
export const FPS = 60;
const STEPS_PER_FRAME = 16;
export const DT = 1 / (FPS * STEPS_PER_FRAME);
/** Integer units per length unit. */
export const SCALE = 1e12;
/** Kinetic energy (mass 1) of one temperature unit. */
export const E0 = 0.048;
/** Packets of energy per particle when counting ways to share energy. */
export const PACKETS_PER_PARTICLE = 50;

// ------------------------------------------------------------------ the gas

export interface GasConfig {
	/** Number of particles. */
	n: number;
	/** Starting temperatures of the left and right halves. */
	tLeft: number;
	tRight: number;
	/** 'split': half the particles in each half; 'left': all in the left half. */
	layout: 'split' | 'left';
	/** The middle wall stands until this time (s); 0 = no wall, Infinity = always. */
	wallUntil: number;
	/** Times (s) at which every velocity is reversed. */
	reversals: number[];
	/** Distance (box heights) one particle is moved at each reversal; 0 = none. */
	nudge: number;
	seed: number;
}

export const DEFAULT_GAS: GasConfig = {
	n: 80,
	tLeft: 4,
	tRight: 1,
	layout: 'split',
	wallUntil: 0,
	reversals: [],
	nudge: 0,
	seed: 1
};

/** What is measured in one recorded frame. */
export interface FrameStats {
	/** Particles in the left half (x < W/2). */
	nLeft: number;
	/** Total kinetic energy in each half. */
	eLeft: number;
	eRight: number;
}

/**
 * One run of the gas, computed lazily: `frame(i)` integrates as far as
 * needed and caches every recorded frame, so a scene can ask for the frame
 * at any time and replays are identical.
 */
export class GasRun {
	readonly config: GasConfig;
	readonly n: number;
	/** Recorded frames: x, y, kinetic energy of each particle. */
	private xs: Float32Array[] = [];
	private ys: Float32Array[] = [];
	private kes: Float32Array[] = [];
	private stats: FrameStats[] = [];
	// integer state: previous and current positions
	private px: Float64Array;
	private py: Float64Array;
	private cx: Float64Array;
	private cy: Float64Array;
	private ax: Float64Array;
	private ay: Float64Array;
	private step = 0;
	private reverseSteps: Set<number>;
	private wallSteps: number;

	constructor(config: GasConfig) {
		this.config = config;
		const n = (this.n = Math.max(1, Math.round(config.n)));
		this.px = new Float64Array(n);
		this.py = new Float64Array(n);
		this.cx = new Float64Array(n);
		this.cy = new Float64Array(n);
		this.ax = new Float64Array(n);
		this.ay = new Float64Array(n);
		// reversals happen on frame boundaries
		this.reverseSteps = new Set(
			config.reversals.map((t) => Math.round(t * FPS) * STEPS_PER_FRAME)
		);
		this.wallSteps = config.wallUntil === Infinity ? Infinity : Math.round(config.wallUntil / DT);
		this.init();
		this.record();
	}

	/** Places the particles on a jittered grid and gives them random velocities. */
	private init() {
		const { n, config } = this;
		const rand = rng(config.seed * 7919 + n);
		const gauss = () => {
			const u = Math.max(1e-12, rand());
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
		};
		const groups: { idx: number[]; x0: number; x1: number; temp: number }[] =
			config.layout === 'left'
				? [{ idx: range(0, n), x0: 0, x1: W / 2 - WALL, temp: config.tLeft }]
				: [
						{ idx: range(0, Math.ceil(n / 2)), x0: 0, x1: W / 2 - WALL, temp: config.tLeft },
						{ idx: range(Math.ceil(n / 2), n), x0: W / 2 + WALL, x1: W, temp: config.tRight }
					];
		const x = new Float64Array(n);
		const y = new Float64Array(n);
		const vx = new Float64Array(n);
		const vy = new Float64Array(n);
		for (const g of groups) {
			const m = g.idx.length;
			if (m === 0) continue;
			const w = g.x1 - g.x0;
			const cols = Math.max(1, Math.round(Math.sqrt((m * w) / H)));
			const rows = Math.ceil(m / cols);
			const cw = w / cols;
			const ch = H / rows;
			// shuffle the grid cells so particle order does not follow position
			const cells = range(0, cols * rows);
			for (let i = cells.length - 1; i > 0; i--) {
				const j = Math.floor(rand() * (i + 1));
				[cells[i], cells[j]] = [cells[j], cells[i]];
			}
			const jx = Math.max(0, cw / 2 - R * 1.2);
			const jy = Math.max(0, ch / 2 - R * 1.2);
			g.idx.forEach((p, k) => {
				const c = cells[k];
				x[p] = g.x0 + ((c % cols) + 0.5) * cw + (rand() * 2 - 1) * jx;
				y[p] = ((Math.floor(c / cols) + 0.5) * ch + (rand() * 2 - 1) * jy) * 1;
				vx[p] = gauss();
				vy[p] = gauss();
			});
			// no net drift, and exactly the requested average kinetic energy
			let mx = 0;
			let my = 0;
			for (const p of g.idx) {
				mx += vx[p] / m;
				my += vy[p] / m;
			}
			let ke = 0;
			for (const p of g.idx) {
				if (m > 1) {
					vx[p] -= mx;
					vy[p] -= my;
				}
				ke += 0.5 * (vx[p] ** 2 + vy[p] ** 2);
			}
			const f = ke > 0 ? Math.sqrt((g.temp * E0 * m) / ke) : 0;
			for (const p of g.idx) {
				vx[p] *= f;
				vy[p] *= f;
			}
		}
		for (let p = 0; p < n; p++) {
			this.cx[p] = Math.round(x[p] * SCALE);
			this.cy[p] = Math.round(y[p] * SCALE);
			this.px[p] = this.cx[p] - Math.round(vx[p] * DT * SCALE);
			this.py[p] = this.cy[p] - Math.round(vy[p] * DT * SCALE);
		}
	}

	/** Accelerations (mass 1) for the current positions, in length units per s². */
	private forces() {
		const { n, cx, cy, ax, ay } = this;
		ax.fill(0);
		ay.fill(0);
		const sigma = 2 * R;
		const wall = this.step < this.wallSteps;
		for (let i = 0; i < n; i++) {
			const xi = cx[i] / SCALE;
			const yi = cy[i] / SCALE;
			// outer walls
			if (xi < R) ax[i] += KAPPA * (R - xi);
			else if (xi > W - R) ax[i] -= KAPPA * (xi - (W - R));
			if (yi < R) ay[i] += KAPPA * (R - yi);
			else if (yi > H - R) ay[i] -= KAPPA * (yi - (H - R));
			// middle wall
			if (wall) {
				if (xi < W / 2) {
					const lim = W / 2 - WALL - R;
					if (xi > lim) ax[i] -= KAPPA * (xi - lim);
				} else {
					const lim = W / 2 + WALL + R;
					if (xi < lim) ax[i] += KAPPA * (lim - xi);
				}
			}
			for (let j = i + 1; j < n; j++) {
				const dx = cx[j] / SCALE - xi;
				if (dx >= sigma || dx <= -sigma) continue;
				const dy = cy[j] / SCALE - yi;
				if (dy >= sigma || dy <= -sigma) continue;
				const d2 = dx * dx + dy * dy;
				if (d2 >= sigma * sigma || d2 === 0) continue;
				const d = Math.sqrt(d2);
				const f = (KAPPA * (sigma - d)) / d;
				ax[i] -= f * dx;
				ay[i] -= f * dy;
				ax[j] += f * dx;
				ay[j] += f * dy;
			}
		}
	}

	/** One leapfrog step, then any reversal due. */
	private advance() {
		this.leap();
		this.step++;
		if (this.reverseSteps.has(this.step)) this.reverse();
	}

	/** One leapfrog step: (prev, cur) → (cur, next). */
	private leap() {
		this.forces();
		const { n, px, py, cx, cy, ax, ay } = this;
		const k = DT * DT * SCALE;
		for (let i = 0; i < n; i++) {
			const nx = 2 * cx[i] - px[i] + Math.round(ax[i] * k);
			const ny = 2 * cy[i] - py[i] + Math.round(ay[i] * k);
			px[i] = cx[i];
			py[i] = cy[i];
			cx[i] = nx;
			cy[i] = ny;
		}
	}

	/**
	 * Reverses every velocity, exactly: from (X(n−1), X(n)) take one more step
	 * to (X(n), X(n+1)), then swap to (X(n+1), X(n)), whose next step is X(n−1).
	 */
	private reverse() {
		this.leap();
		const { px, py, cx, cy } = this;
		for (let i = 0; i < this.n; i++) {
			const tx = px[i];
			const ty = py[i];
			px[i] = cx[i];
			py[i] = cy[i];
			cx[i] = tx;
			cy[i] = ty;
		}
		const d = Math.round(this.config.nudge * SCALE);
		if (d !== 0) {
			px[0] += d;
			cx[0] += d;
		}
	}

	/** Records the current frame (velocity from the last step's displacement). */
	private record() {
		const { n, px, py, cx, cy } = this;
		const x = new Float32Array(n);
		const y = new Float32Array(n);
		const ke = new Float32Array(n);
		const s: FrameStats = { nLeft: 0, eLeft: 0, eRight: 0 };
		for (let i = 0; i < n; i++) {
			x[i] = cx[i] / SCALE;
			y[i] = cy[i] / SCALE;
			const vx = (cx[i] - px[i]) / (DT * SCALE);
			const vy = (cy[i] - py[i]) / (DT * SCALE);
			ke[i] = 0.5 * (vx * vx + vy * vy);
			if (x[i] < W / 2) {
				s.nLeft++;
				s.eLeft += ke[i];
			} else s.eRight += ke[i];
		}
		this.xs.push(x);
		this.ys.push(y);
		this.kes.push(ke);
		this.stats.push(s);
	}

	private ensure(i: number) {
		while (this.xs.length <= i) {
			for (let s = 0; s < STEPS_PER_FRAME; s++) this.advance();
			this.record();
		}
	}

	/** Frame index for a time in seconds (frames are 1/FPS apart). */
	static index(t: number) {
		return Math.max(0, Math.round(t * FPS));
	}

	/** Positions and kinetic energies at frame i. */
	frame(i: number) {
		this.ensure(i);
		return { x: this.xs[i], y: this.ys[i], ke: this.kes[i], stats: this.stats[i] };
	}

	/** Measured quantities at frame i. */
	statsAt(i: number): FrameStats {
		this.ensure(i);
		return this.stats[i];
	}

	/**
	 * ln Ω of the macrostate at frame i (see `lnWaysGas`). The energy is the
	 * run's starting total shared out in the measured proportions: kinetic
	 * energy dips by a percent or two while particles overlap (it is stored in
	 * the squashed discs), and that artefact of soft discs should not count.
	 */
	lnWays(i: number) {
		const s = this.statsAt(i);
		const s0 = this.stats[0];
		const total = s0.eLeft + s0.eRight;
		const f = s.eLeft + s.eRight > 0 ? s.eLeft / (s.eLeft + s.eRight) : 0.5;
		return lnWaysGas(this.n, s.nLeft, total * f, total * (1 - f));
	}

	/** Total energy of the run (its starting kinetic energy). */
	get energy() {
		return this.stats[0].eLeft + this.stats[0].eRight;
	}

	/** Frames computed so far. */
	get computed() {
		return this.xs.length;
	}
}

/** Temperature (temperature units) of `count` particles holding `energy`. */
export const temperature = (energy: number, count: number) =>
	count > 0 ? energy / count / E0 : NaN;

// ------------------------------------------------------------------ counting

const LANCZOS = [
	0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
	-176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
	1.5056327351493116e-7
];

/** ln Γ(x) for x > 0 (Lanczos approximation, ~15 digits). */
export function lnGamma(x: number): number {
	if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
	x -= 1;
	let a = LANCZOS[0];
	const t = x + 7.5;
	for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
	return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln C(n, k), the natural log of "n choose k". */
export const lnChoose = (n: number, k: number) =>
	k < 0 || k > n ? -Infinity : lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);

/** C(n, k) exactly, as a BigInt. */
export function choose(n: number, k: number): bigint {
	if (k < 0 || k > n) return 0n;
	k = Math.min(k, n - k);
	let c = 1n;
	for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
	return c;
}

/** Ways to have k of n particles in the left half: C(n, k). */
export const positionWays = (n: number, k: number) => choose(n, k);

/** Ways to share q packets of energy among n particles: C(q + n − 1, q). */
export const energyWays = (q: number, n: number) => (n <= 0 ? (q === 0 ? 1n : 0n) : choose(q + n - 1, q));

/** ln of `energyWays`, for big numbers. */
export const lnEnergyWays = (q: number, n: number) =>
	n <= 0 ? (q === 0 ? 0 : -Infinity) : lnChoose(q + n - 1, q);

/**
 * ln of the number of ways to share Q packets between a left group of nL and
 * a right group of nR particles, for every split qL = 0 … Q.
 */
export function shareCurve(nL: number, nR: number, Q: number) {
	return Array.from({ length: Q + 1 }, (_, qL) => lnEnergyWays(qL, nL) + lnEnergyWays(Q - qL, nR));
}

/** The split qL with the most ways (the most likely share). */
export function mostLikelyShare(nL: number, nR: number, Q: number) {
	const c = shareCurve(nL, nR, Q);
	let best = 0;
	for (let q = 1; q <= Q; q++) if (c[q] > c[best]) best = q;
	return best;
}

/**
 * ln Ω of the gas's macrostate (k particles in the left half holding energy
 * eL, the rest holding eR), up to a constant that is the same for every
 * macrostate of the same gas: which particles are on the left, C(N, k), times
 * the ways to share each half's energy, ∝ E^(n−1) / (n−1)!.
 */
export function lnWaysGas(N: number, k: number, eL: number, eR: number) {
	const part = (e: number, m: number) =>
		m === 0 ? 0 : (m - 1) * Math.log(Math.max(e, 1e-300) / E0) - lnGamma(m);
	return lnChoose(N, k) + part(eL, k) + part(eR, N - k);
}

/** The largest ln Ω for a gas of N particles with total energy E (even split, equal temperatures). */
export function lnWaysGasMax(N: number, E: number) {
	let best = -Infinity;
	for (let k = 0; k <= N; k++) {
		// for a given k the best energy split is eL / eR = (k − 1) / (N − k − 1)
		const kl = Math.max(k - 1, 0);
		const kr = Math.max(N - k - 1, 0);
		const eL = kl + kr > 0 ? (E * kl) / (kl + kr) : E / 2;
		best = Math.max(best, lnWaysGas(N, k, eL, E - eL));
	}
	return best;
}

/** Natural log to base-10 exponent. */
export const toLog10 = (ln: number) => ln / Math.LN10;

/** Formats a big count (BigInt or a log10) as "1.2 × 10²³" or an exact integer when small. */
export function formatCount(v: bigint | { log10: number }): string {
	if (typeof v === 'bigint') {
		if (v < 1000000n) return v.toLocaleString('en-US');
		const s = v.toString();
		return sci(s.length - 1 + Math.log10(Number(s.slice(0, 15)) / 10 ** Math.min(14, s.length - 1)));
	}
	if (v.log10 < 6) return Math.round(10 ** v.log10).toLocaleString('en-US');
	return sci(v.log10);
}

/** "m.m × 10ᵉ" for a base-10 logarithm. */
function sci(log10: number) {
	let e = Math.floor(log10);
	let m = Number((10 ** (log10 - e)).toFixed(1));
	if (m >= 10) {
		m = 1;
		e++;
	}
	return `${m.toFixed(1)} × 10${sup(e)}`;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number) =>
	(n < 0 ? '⁻' : '') +
	String(Math.abs(n))
		.split('')
		.map((d) => SUP[Number(d)])
		.join('');

function range(a: number, b: number) {
	return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}
