/**
 * The Ising model: spins sᵢ = ±1 on a square lattice (or a ring, a one-dimensional chain),
 * with energy
 *
 *   E = −J Σ⟨ij⟩ sᵢ sⱼ − h Σᵢ sᵢ
 *
 * (the first sum over nearest-neighbour pairs, each once), in units where the coupling J and
 * Boltzmann's constant k are 1: temperatures are k·T / J and fields h / J. Boundaries are
 * periodic (the lattice is a torus, the chain a ring), so every spin has the same neighbours.
 *
 * Two Monte Carlo updates, both sampling the Boltzmann distribution e^(−E/T) / Z:
 *
 *   - Metropolis (Metropolis et al. 1953): pick a spin at random and flip it with probability
 *     min(1, e^(−ΔE/T)); ΔE = 2 sᵢ (Σ neighbours + h). One sweep = N attempts.
 *   - Wolff (1989): grow a cluster from a random spin, adding each aligned neighbour with
 *     probability 1 − e^(−2/T), and flip the whole cluster. Valid only without a field.
 *
 * Every random number comes from a seeded generator, so a run replays exactly (deep links,
 * screenshots, tests).
 *
 * Exact results used as references: Onsager's critical temperature (1944)
 * T_c = 2 / ln(1 + √2) ≈ 2.269, his energy and heat capacity of the infinite square lattice,
 * the spontaneous magnetisation M(T) = (1 − sinh⁻⁴(2/T))^(1/8) below T_c (Onsager 1948,
 * Yang 1952), and the transfer-matrix solution of the ring (Ising 1925).
 */
import { rng } from '#lib/draw/math.ts';

/** Onsager's critical temperature of the square lattice, k·T_c / J = 2 / ln(1 + √2). */
export const TC = 2 / Math.log(1 + Math.SQRT2);

/** Spontaneous magnetisation per spin of the infinite square lattice (Onsager, Yang). */
export function onsagerM(T: number) {
	if (T >= TC) return 0;
	return Math.pow(1 - Math.pow(Math.sinh(2 / T), -4), 1 / 8);
}

/** Complete elliptic integrals K(k) and E(k) by the arithmetic–geometric mean. */
function elliptic(k: number) {
	let a = 1;
	let b = Math.sqrt(1 - k * k);
	let c = k;
	let sum = (c * c) / 2;
	let pow = 0.5;
	for (let i = 0; i < 40 && Math.abs(c) > 1e-15; i++) {
		const an = (a + b) / 2;
		c = (a - b) / 2;
		b = Math.sqrt(a * b);
		a = an;
		pow *= 2;
		sum += pow * c * c;
	}
	const K = Math.PI / (2 * a);
	return { K, E: K * (1 - sum) };
}

/**
 * Energy per spin of the infinite square lattice at temperature T (Onsager 1944):
 * u = −coth 2β [1 + (2/π)(2 tanh² 2β − 1) K(κ)], κ = 2 sinh 2β / cosh² 2β, β = 1/T.
 */
export function onsagerEnergy(T: number) {
	const b = 1 / T;
	const k = Math.min((2 * Math.sinh(2 * b)) / Math.cosh(2 * b) ** 2, 1 - 1e-16);
	const t2 = Math.tanh(2 * b) ** 2;
	const { K } = elliptic(k);
	return (-1 / Math.tanh(2 * b)) * (1 + (2 / Math.PI) * (2 * t2 - 1) * K);
}

/**
 * Heat capacity per spin of the infinite square lattice (Onsager 1944), in units of k:
 * c = (4/π)(β coth 2β)² {K(κ) − E(κ) − (1 − tanh² 2β)[π/2 + (2 tanh² 2β − 1) K(κ)]}.
 * It diverges logarithmically at T_c.
 */
export function onsagerHeatCapacity(T: number) {
	const b = 1 / T;
	const k = Math.min((2 * Math.sinh(2 * b)) / Math.cosh(2 * b) ** 2, 1 - 1e-16);
	const t2 = Math.tanh(2 * b) ** 2;
	const { K, E } = elliptic(k);
	const pre = (4 / Math.PI) * (b / Math.tanh(2 * b)) ** 2;
	return pre * (K - E - (1 - t2) * (Math.PI / 2 + (2 * t2 - 1) * K));
}

/**
 * The ring of N spins without a field, exactly (transfer matrix, eigenvalues 2 cosh β and
 * 2 sinh β): the correlation ⟨s₀ s_r⟩ of two spins r apart.
 */
export function chainCorrelation(T: number, N: number, r: number) {
	const x = Math.tanh(1 / T);
	// (λ₁^(N−r) λ₂^r + λ₂^(N−r) λ₁^r) / (λ₁^N + λ₂^N), divided through by λ₁^N
	return (x ** r + x ** (N - r)) / (1 + x ** N);
}

/** The ring exactly: energy per spin and ⟨m²⟩ (m the magnetisation per spin). */
export function chainExact(T: number, N: number) {
	let s = 0;
	for (let r = 0; r < N; r++) s += chainCorrelation(T, N, r);
	return { e: -chainCorrelation(T, N, 1), m2: s / N };
}

/** Correlation length of the infinite chain, in spacings: ξ = −1 / ln tanh(1/T). */
export const chainXi = (T: number) => -1 / Math.log(Math.tanh(1 / T));

/** A lattice of spins: `w` × `h` on a torus, or a ring of `w` spins when `h` is 1. */
export class Lattice {
	readonly w: number;
	readonly h: number;
	readonly n: number;
	readonly s: Int8Array;
	/** The four (or two) neighbours of each site, flattened. */
	private readonly nb: Int32Array;
	private readonly deg: number;
	private readonly rand: () => number;
	private readonly stack: Int32Array;
	private readonly members: Int32Array;
	private readonly inCluster: Uint8Array;
	/** Attempts made by the current Metropolis sweeps, for callers that want single flips. */
	sweeps = 0;

	constructor(w: number, h: number, seed: number, start: 'random' | 'up' = 'random') {
		this.w = w;
		this.h = h;
		this.n = w * h;
		this.rand = rng(seed);
		this.s = new Int8Array(this.n);
		this.deg = h === 1 ? 2 : 4;
		this.nb = new Int32Array(this.n * this.deg);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = y * w + x;
				const o = i * this.deg;
				this.nb[o] = y * w + ((x + 1) % w);
				this.nb[o + 1] = y * w + ((x + w - 1) % w);
				if (this.deg === 4) {
					this.nb[o + 2] = ((y + 1) % h) * w + x;
					this.nb[o + 3] = ((y + h - 1) % h) * w + x;
				}
			}
		}
		for (let i = 0; i < this.n; i++) {
			this.s[i] = start === 'up' ? 1 : this.rand() < 0.5 ? 1 : -1;
		}
		this.stack = new Int32Array(this.n);
		this.members = new Int32Array(this.n);
		this.inCluster = new Uint8Array(this.n);
	}

	get dim() {
		return this.h === 1 ? 1 : 2;
	}

	/** Sum of the neighbours of site i. */
	neighbourSum(i: number) {
		let sum = 0;
		const o = i * this.deg;
		for (let k = 0; k < this.deg; k++) sum += this.s[this.nb[o + k]];
		return sum;
	}

	/** Neighbour sites of i. */
	neighbours(i: number) {
		return Array.from(this.nb.subarray(i * this.deg, (i + 1) * this.deg));
	}

	/** Energy cost of flipping spin i in field h. */
	deltaE(i: number, field = 0) {
		return 2 * this.s[i] * (this.neighbourSum(i) + field);
	}

	/**
	 * One Metropolis attempt: a random site, flipped with probability min(1, e^(−ΔE/T)).
	 * Returns what happened, for drawing the algorithm one step at a time.
	 */
	attempt(T: number, field = 0) {
		const i = Math.floor(this.rand() * this.n);
		const dE = this.deltaE(i, field);
		const u = this.rand();
		const p = dE <= 0 ? 1 : Math.exp(-dE / T);
		const flipped = u < p;
		if (flipped) this.s[i] = -this.s[i];
		return { i, dE, p, u, flipped };
	}

	/** One Metropolis sweep: N attempts. */
	metropolis(T: number, field = 0) {
		const n = this.n;
		const s = this.s;
		const nb = this.nb;
		const deg = this.deg;
		const rand = this.rand;
		// acceptance probabilities for the neighbour sums −deg … deg and both signs of the spin
		const acc = new Float64Array(2 * (2 * deg + 1));
		for (let k = -deg; k <= deg; k++) {
			for (const sp of [-1, 1]) {
				const dE = 2 * sp * (k + field);
				acc[(sp > 0 ? 1 : 0) * (2 * deg + 1) + k + deg] = dE <= 0 ? 1 : Math.exp(-dE / T);
			}
		}
		for (let a = 0; a < n; a++) {
			const i = Math.floor(rand() * n);
			const o = i * deg;
			let sum = 0;
			for (let k = 0; k < deg; k++) sum += s[nb[o + k]];
			const p = acc[(s[i] > 0 ? 1 : 0) * (2 * deg + 1) + sum + deg];
			if (p >= 1 || rand() < p) s[i] = -s[i];
		}
		this.sweeps++;
	}

	/** One Wolff cluster flip (no field). Returns the cluster's size. */
	wolff(T: number) {
		const s = this.s;
		const nb = this.nb;
		const deg = this.deg;
		const rand = this.rand;
		const pAdd = 1 - Math.exp(-2 / T);
		const seed = Math.floor(rand() * this.n);
		const sign = s[seed];
		const stack = this.stack;
		const mark = this.inCluster;
		let top = 0;
		let size = 0;
		stack[top++] = seed;
		mark[seed] = 1;
		const members = this.members;
		while (top > 0) {
			const i = stack[--top];
			members[size++] = i;
			const o = i * deg;
			for (let k = 0; k < deg; k++) {
				const j = nb[o + k];
				if (!mark[j] && s[j] === sign && rand() < pAdd) {
					mark[j] = 1;
					stack[top++] = j;
				}
			}
		}
		// flip the cluster and clear the marks
		for (let k = 0; k < size; k++) {
			const i = members[k];
			s[i] = -sign;
			mark[i] = 0;
		}
		return size;
	}

	/**
	 * A fixed number of Wolff clusters; returns the spins flipped. The count must not depend on
	 * the run itself: stopping once the clusters add up to N spins, say, would favour states
	 * whose clusters are small and bias every average.
	 */
	wolffClusters(T: number, count: number) {
		let flipped = 0;
		for (let k = 0; k < count; k++) flipped += this.wolff(T);
		return flipped;
	}

	/** Flips every spin: an exact symmetry without a field (the energy does not change). */
	flipAll() {
		for (let i = 0; i < this.n; i++) this.s[i] = -this.s[i];
	}

	/** Magnetisation per spin, m = Σ sᵢ / N. */
	magnetisation() {
		let m = 0;
		for (let i = 0; i < this.n; i++) m += this.s[i];
		return m / this.n;
	}

	/** Number of unlike neighbour pairs (broken bonds). */
	brokenBonds() {
		let b = 0;
		for (let i = 0; i < this.n; i++) {
			// count each pair once: the +x neighbour, and the +y neighbour in 2D
			if (this.s[i] !== this.s[this.nb[i * this.deg]]) b++;
			if (this.deg === 4 && this.s[i] !== this.s[this.nb[i * this.deg + 2]]) b++;
		}
		return b;
	}

	/** Energy per spin, E / N, in field h. */
	energy(field = 0) {
		const bonds = this.n * (this.deg / 2);
		const broken = this.brokenBonds();
		return (-(bonds - 2 * broken) - field * this.magnetisation() * this.n) / this.n;
	}
}

/** Thermal averages from a run at one temperature (no field). */
export interface Averages {
	T: number;
	/** ⟨|m|⟩ */
	m: number;
	/** ⟨m²⟩ */
	m2: number;
	/** ⟨E⟩ / N */
	e: number;
	/** Susceptibility per spin, χ = N (⟨m²⟩ − ⟨|m|⟩²) / T. */
	chi: number;
	/** Heat capacity per spin, c = N (⟨e²⟩ − ⟨e⟩²) / T². */
	c: number;
}

/**
 * Equilibrates `lat` at T (no field) for `eq` updates, then averages over `meas` updates. One
 * update is a Metropolis sweep followed by a fixed number of Wolff clusters, chosen during the
 * settling so that they flip about N spins on average; so it stays fast near T_c (where
 * Metropolis alone slows down) and far from it.
 */
export function measure(lat: Lattice, T: number, eq: number, meas: number): Averages {
	// settle, learning the average cluster size (the count is then fixed for the measurement)
	let clusters = 0;
	let flipped = 0;
	for (let k = 0; k < eq; k++) {
		lat.metropolis(T);
		flipped += lat.wolffClusters(T, 1);
		clusters++;
		while (flipped < (k + 1) * lat.n && clusters < (k + 1) * lat.n) {
			flipped += lat.wolffClusters(T, 1);
			clusters++;
		}
	}
	const count = Math.max(1, Math.round(clusters / Math.max(1, eq)));
	const step = () => {
		lat.metropolis(T);
		lat.wolffClusters(T, count);
	};
	let sm = 0;
	let sm2 = 0;
	let se = 0;
	let se2 = 0;
	for (let k = 0; k < meas; k++) {
		step();
		const m = Math.abs(lat.magnetisation());
		const e = lat.energy();
		sm += m;
		sm2 += m * m;
		se += e;
		se2 += e * e;
	}
	const m = sm / meas;
	const m2 = sm2 / meas;
	const e = se / meas;
	const e2 = se2 / meas;
	return {
		T,
		m,
		m2,
		e,
		chi: (lat.n * Math.max(0, m2 - m * m)) / T,
		c: (lat.n * Math.max(0, e2 - e * e)) / (T * T)
	};
}

/**
 * Hysteresis: the field swept as a triangle wave between −h₀ and +h₀, one Metropolis sweep per
 * field value, starting at +h₀ from all spins up. Returns (h, m) after each sweep for `periods`
 * full periods of `perPeriod` sweeps.
 */
export class FieldSweep {
	readonly lat: Lattice;
	readonly h0: number;
	readonly perPeriod: number;
	readonly hs: number[] = [];
	readonly ms: number[] = [];

	constructor(L: number, h0: number, perPeriod: number, seed: number) {
		this.lat = new Lattice(L, L, seed, 'up');
		this.h0 = h0;
		this.perPeriod = perPeriod;
	}

	/** The field at sweep k: starts at +h₀, falls to −h₀ in half a period, and rises again. */
	field(k: number) {
		const u = (k % this.perPeriod) / this.perPeriod;
		return this.h0 * (u < 0.5 ? 1 - 4 * u : -3 + 4 * u);
	}

	/** Runs until `k` sweeps have been made, at temperature T. */
	advance(k: number, T: number) {
		while (this.hs.length < k) {
			const h = this.field(this.hs.length);
			this.lat.metropolis(T, h);
			this.hs.push(h);
			this.ms.push(this.lat.magnetisation());
		}
	}
}

/** Area of the loop traced by the last full period of a sweep, ∮ m dh (positive when it opens). */
export function loopArea(hs: number[], ms: number[], perPeriod: number) {
	const n = hs.length;
	let a = 0;
	for (let k = n - perPeriod + 1; k < n; k++) {
		// −∮ m dh, so that a loop traversed down-then-up (m lagging the field) is positive
		a -= ((ms[k] + ms[k - 1]) / 2) * (hs[k] - hs[k - 1]);
	}
	return a;
}
