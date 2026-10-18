/**
 * The Ziff–Gulari–Barshad (ZGB) model of CO oxidation on a catalyst surface (Ziff, Gulari and
 * Barshad, Phys. Rev. Lett. 56, 2553, 1986), with the CO desorption of Tomé and Dickman
 * (Phys. Rev. E 47, 948, 1993).
 *
 * The surface is a square lattice of sites, wrapped round at the edges (periodic), each empty,
 * holding one CO or holding one O atom. Every trial picks what arrives from the gas:
 *
 *   - with probability k: a desorption attempt. A random site is picked; a CO on it leaves.
 *   - otherwise, with probability y (the CO fraction of the gas): a CO molecule hits a random
 *     site and sticks if the site is empty;
 *   - otherwise an O₂ molecule hits a random site and one of its four neighbours, and splits
 *     onto them as two O atoms if both are empty.
 *
 * A newly adsorbed particle reacts at once with a neighbour of the other kind, if it has one
 * (one chosen at random if it has several): CO + O → CO₂, which leaves, freeing both sites. The
 * reaction is instantaneous, as in the original model. Time is counted in Monte Carlo steps
 * (MCS): N trials on a lattice of N sites.
 *
 * With k = 0 the surface has two dead (absorbing) states: all O, below y₁ ≈ 0.3874 (a continuous
 * transition; Voigt and Ziff 1997), and all CO, above y₂ ≈ 0.5256 (an abrupt, first-order one;
 * Ziff and Brosilow 1992). Between them the surface keeps turning CO and O₂ into CO₂.
 *
 * Every random number comes from a seeded generator, so a run replays exactly.
 */
import { rng } from '#lib/draw/math.ts';

export const EMPTY = 0;
export const CO = 1;
export const O = 2;

/** The published transition points of the model without desorption. */
export const Y1 = 0.3874;
export const Y2 = 0.5256;

/** What the last trial did, for the scene that shows the moves one at a time. */
export interface Event {
	kind: 'co' | 'o2' | 'desorb';
	/** The site (and for O₂ its neighbour) the molecule hit. */
	site: number;
	site2: number;
	/** Whether it stuck (or, for desorption, whether a CO left). */
	stuck: boolean;
	/** The pairs (adsorbate, partner) that reacted into CO₂ and left. */
	reacted: [number, number][];
}

export class Surface {
	readonly w: number;
	readonly h: number;
	readonly n: number;
	/** EMPTY, CO or O per site, row by row. */
	readonly s: Uint8Array;
	/** The four neighbours of each site (right, left, down, up). */
	private readonly nb: Int32Array;
	private readonly rand: () => number;
	/** Counts since the start: CO₂ made, CO and O₂ adsorbed, CO desorbed, trials. */
	co2 = 0;
	coIn = 0;
	o2In = 0;
	coOut = 0;
	trials = 0;
	readonly last: Event = { kind: 'co', site: 0, site2: 0, stuck: false, reacted: [] };

	constructor(w: number, h: number, seed: number) {
		this.w = w;
		this.h = h;
		this.n = w * h;
		this.s = new Uint8Array(this.n);
		this.nb = new Int32Array(this.n * 4);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const i = y * w + x;
				this.nb[i * 4] = y * w + ((x + 1) % w);
				this.nb[i * 4 + 1] = y * w + ((x + w - 1) % w);
				this.nb[i * 4 + 2] = ((y + 1) % h) * w + x;
				this.nb[i * 4 + 3] = ((y + h - 1) % h) * w + x;
			}
		this.rand = rng(seed);
	}

	/** Covers every site with one species (a poisoned start), or empties it. */
	fill(species: number) {
		this.s.fill(species);
	}

	/** Neighbour `d` (0–3) of site i. */
	neighbour(i: number, d: number) {
		return this.nb[i * 4 + d];
	}

	/**
	 * Site i has just received a particle: if any neighbours hold the other kind, one of them,
	 * chosen uniformly at random, reacts with it and both sites are freed. Returns the partner's
	 * site, or −1 if there was none.
	 */
	react(i: number, partner: number, record = false) {
		let count = 0;
		let chosen = -1;
		// reservoir sampling: each eligible neighbour ends up chosen with probability 1 / count
		for (let d = 0; d < 4; d++) {
			const j = this.nb[i * 4 + d];
			if (this.s[j] === partner && this.rand() * ++count < 1) chosen = j;
		}
		if (chosen < 0) return -1;
		this.s[i] = EMPTY;
		this.s[chosen] = EMPTY;
		this.co2++;
		if (record) this.last.reacted.push([i, chosen]);
		return chosen;
	}

	/** One trial at CO fraction y and desorption probability k. */
	trial(y: number, k: number, record = false) {
		const rand = this.rand;
		this.trials++;
		if (record) this.last.reacted.length = 0;
		if (k > 0 && rand() < k) {
			const i = Math.floor(rand() * this.n);
			const left = this.s[i] === CO;
			if (left) {
				this.s[i] = EMPTY;
				this.coOut++;
			}
			if (record) Object.assign(this.last, { kind: 'desorb', site: i, site2: i, stuck: left });
			return;
		}
		const i = Math.floor(rand() * this.n);
		if (rand() < y) {
			const ok = this.s[i] === EMPTY;
			if (record) Object.assign(this.last, { kind: 'co', site: i, site2: i, stuck: ok });
			if (!ok) return;
			this.s[i] = CO;
			this.coIn++;
			this.react(i, O, record);
		} else {
			const j = this.nb[i * 4 + Math.floor(rand() * 4)];
			const ok = this.s[i] === EMPTY && this.s[j] === EMPTY;
			if (record) Object.assign(this.last, { kind: 'o2', site: i, site2: j, stuck: ok });
			if (!ok) return;
			this.s[i] = O;
			this.s[j] = O;
			this.o2In++;
			this.react(i, CO, record);
			this.react(j, CO, record);
		}
	}

	/** One Monte Carlo step: N trials. */
	mcs(y: number, k: number) {
		for (let t = 0; t < this.n; t++) this.trial(y, k);
	}

	/** Fractions of the sites holding CO, holding O, and empty. */
	coverage() {
		let c = 0;
		let o = 0;
		for (let i = 0; i < this.n; i++) {
			if (this.s[i] === CO) c++;
			else if (this.s[i] === O) o++;
		}
		return { co: c / this.n, o: o / this.n, empty: (this.n - c - o) / this.n };
	}

	/**
	 * Whether no further CO₂ can ever form: the surface is full (no empty site) with no CO next
	 * to an O. Without desorption such a surface never changes again.
	 */
	dead() {
		for (let i = 0; i < this.n; i++) {
			const v = this.s[i];
			if (v === EMPTY) return false;
			for (let d = 0; d < 2; d++) {
				const u = this.s[this.nb[i * 4 + d * 2]];
				if (u !== v) return false;
			}
		}
		return true;
	}
}

export interface SteadyState {
	/** CO₂ made per site per MCS. */
	rate: number;
	co: number;
	o: number;
}

/**
 * The steady state of a lattice at (y, k) started from an empty surface: `settle` MCS to forget
 * the start, then the averages over the next `meas` MCS (coverages sampled once per MCS).
 */
export function steady(
	L: number,
	y: number,
	k: number,
	seed: number,
	settle = 1000,
	meas = 2000
): SteadyState {
	const s = new Surface(L, L, seed);
	for (let t = 0; t < settle; t++) s.mcs(y, k);
	const before = s.co2;
	let co = 0;
	let o = 0;
	for (let t = 0; t < meas; t++) {
		s.mcs(y, k);
		const c = s.coverage();
		co += c.co;
		o += c.o;
	}
	return { rate: (s.co2 - before) / (s.n * meas), co: co / meas, o: o / meas };
}

/**
 * The mean-field (random mixing) rate equations of the same moves: every site's neighbours are
 * taken to be a random sample of the surface, with coverages θ_CO, θ_O and θ_E = 1 − θ_CO − θ_O.
 * Per MCS and per site:
 *
 *   CO lands on an empty site at (1 − k) y θ_E and reacts at once if one of its four neighbours
 *   holds O, with probability P_O = 1 − (1 − θ_O)⁴;
 *   O₂ lands on an empty pair at (1 − k)(1 − y) θ_E², and each atom reacts if one of its three
 *   other neighbours holds CO, P_C = 1 − (1 − θ_CO)³;
 *   CO desorbs at k θ_CO.
 *
 * Integrated from an empty surface until it stops changing (or for `tMax` MCS). This is the
 * "site approximation" of Dickman (Phys. Rev. A 34, 4246, 1986).
 */
export function meanField(y: number, k: number, tMax = 20000): SteadyState {
	let c = 0;
	let o = 0;
	const dt = 0.05;
	let rate = 0;
	for (let step = 0; step * dt < tMax; step++) {
		const e = Math.max(0, 1 - c - o);
		const pO = 1 - (1 - o) ** 4;
		const pC = 1 - (1 - c) ** 3;
		const coIn = (1 - k) * y * e;
		const o2In = (1 - k) * (1 - y) * e * e;
		const dc = coIn * (1 - pO) - 2 * o2In * pC - k * c;
		const dO = 2 * o2In * (1 - pC) - coIn * pO;
		rate = coIn * pO + 2 * o2In * pC;
		c = Math.min(1, Math.max(0, c + dt * dc));
		o = Math.min(1 - c, Math.max(0, o + dt * dO));
		if (step > 200 && Math.abs(dc) + Math.abs(dO) < 1e-10) break;
	}
	return { rate, co: c, o };
}
