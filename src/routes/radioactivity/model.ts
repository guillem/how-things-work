/**
 * Radioactive decay: a sample of unstable nuclei, each decaying at a random
 * moment, and what that means for the count of survivors, for the three
 * common kinds of decay and for radiocarbon dating.
 *
 * - Every nucleus has the same chance of decaying in any instant, whatever its
 *   age, so its lifetime is drawn from an exponential distribution. With
 *   T½ = 1, a lifetime is −log₂(1 − u) half-lives for a uniform u in [0, 1).
 *   Lifetimes are stored in half-lives: a real time is that number × T½, so
 *   changing the half-life rescales time while the same nuclei decay in the
 *   same order.
 * - The number left after t is binomial: each of N₀ nuclei survives with
 *   p = 2^(−t/T½), so the expected count is N₀·2^(−t/T½) with a spread of
 *   σ = √(N₀ p (1 − p)).
 *
 * Half-lives are from NNDC NuDat 3 (ENSDF evaluations), https://www.nndc.bnl.gov/nudat3/,
 * accessed 2026-10-12. Element names and numbers come from the mendeleev data
 * of the atoms explainer.
 */
import { rng } from '#lib/draw/math.ts';
import { element } from '../atoms-periodic-table/atom';

// ------------------------------------------------------------ isotopes

export interface Isotope {
	/** Atomic number (protons). */
	z: number;
	/** Mass number (protons + neutrons). */
	a: number;
	/** Metastable (excited, long-lived) nuclear state, written "m". */
	meta?: boolean;
	/** Half-life and its uncertainty, in `unit`. */
	halfLife: number;
	uncertainty: number;
	unit: 'y' | 'h';
	/** Where the value comes from. */
	source: string;
}

/** Carbon-14: β⁻, 100 %; 5,700 ± 30 y (NuDat 3 / ENSDF; β⁻ endpoint 156.475 ± 0.004 keV). */
export const C14: Isotope = {
	z: 6,
	a: 14,
	halfLife: 5700,
	uncertainty: 30,
	unit: 'y',
	source: 'NNDC NuDat 3 (ENSDF), accessed 2026-10-12'
};

/** Uranium-238: α, 100 %; (4.468 ± 0.003) × 10⁹ y (NuDat 3 / ENSDF). */
export const U238: Isotope = {
	z: 92,
	a: 238,
	halfLife: 4.468e9,
	uncertainty: 0.003e9,
	unit: 'y',
	source: 'NNDC NuDat 3 (ENSDF), accessed 2026-10-12'
};

/** Americium-241: α, 100 %; 432.6 ± 0.6 y (NuDat 3 / ENSDF; main α 5,485.56 keV, 84.8 %). */
export const Am241: Isotope = {
	z: 95,
	a: 241,
	halfLife: 432.6,
	uncertainty: 0.6,
	unit: 'y',
	source: 'NNDC NuDat 3 (ENSDF), accessed 2026-10-12'
};

/**
 * Technetium-99m, the isomer at 142.68 keV: decays by isomeric transition,
 * mostly emitting a 140.511 keV γ ray; 6.0072 ± 0.0009 h (NuDat 3 / ENSDF).
 * Its product, ground-state Tc-99, is itself radioactive: 2.111 × 10⁵ y, β⁻.
 */
export const Tc99m: Isotope = {
	z: 43,
	a: 99,
	meta: true,
	halfLife: 6.0072,
	uncertainty: 0.0009,
	unit: 'h',
	source: 'NNDC NuDat 3 (ENSDF), accessed 2026-10-12'
};

/** Element symbol and name for an atomic number (mendeleev data). */
export const symbolOf = (z: number) => element(z).symbol;
export const nameOf = (z: number) => element(z).name;

/** "C-14", "Tc-99m". */
export const label = (n: { z: number; a: number; meta?: boolean }) =>
	`${symbolOf(n.z)}-${n.a}${n.meta ? 'm' : ''}`;

// ------------------------------------------------------------ decay modes

export type Mode = 'alpha' | 'beta' | 'gamma';

export interface Nuclide {
	z: number;
	a: number;
	meta?: boolean;
}

/**
 * The nucleus left after one decay.
 * - α: emits a helium-4 nucleus (2 protons, 2 neutrons): Z − 2, A − 4.
 * - β⁻: a neutron turns into a proton, emitting an electron and an
 *   antineutrino: Z + 1, A unchanged.
 * - γ: an excited nucleus sheds energy as a photon: Z and A unchanged.
 */
export function decay(parent: Nuclide, mode: Mode): Nuclide {
	switch (mode) {
		case 'alpha':
			return { z: parent.z - 2, a: parent.a - 4 };
		case 'beta':
			return { z: parent.z + 1, a: parent.a };
		case 'gamma':
			return { z: parent.z, a: parent.a };
	}
}

/** The example isotope used for each decay mode on the page. */
export const EXAMPLE: Record<Mode, Isotope> = { alpha: Am241, beta: C14, gamma: Tc99m };

// ------------------------------------------------------------ the sample

/** Fraction expected to survive after `t` (same units as `halfLife`). */
export const surviving = (t: number, halfLife: number) => Math.pow(2, -t / halfLife);

/** Expected survivors of `n0` nuclei after `t`: N₀·2^(−t/T½). */
export const expected = (n0: number, t: number, halfLife: number) => n0 * surviving(t, halfLife);

/** Standard deviation of the survivor count (binomial). */
export function spread(n0: number, t: number, halfLife: number) {
	const p = surviving(t, halfLife);
	return Math.sqrt(n0 * p * (1 - p));
}

export interface Sample {
	/** Number of nuclei at the start. */
	n0: number;
	/** Lifetime of each nucleus, in half-lives, in grid order. */
	life: Float64Array;
	/** The same lifetimes, sorted (for counting survivors quickly). */
	sorted: Float64Array;
}

/** `n0` nuclei with random lifetimes, reproducible from `seed`. */
export function makeSample(n0: number, seed: number): Sample {
	const random = rng(seed);
	const life = new Float64Array(n0);
	for (let k = 0; k < n0; k++) life[k] = -Math.log2(1 - random());
	const sorted = Float64Array.from(life).sort();
	return { n0, life, sorted };
}

/** Nuclei still intact after `halves` half-lives. */
export function survivors(sample: Sample, halves: number): number {
	const s = sample.sorted;
	let lo = 0;
	let hi = s.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (s[mid] <= halves) lo = mid + 1;
		else hi = mid;
	}
	return s.length - lo;
}

/** Whether nucleus `k` is still intact after `halves` half-lives. */
export const intact = (sample: Sample, k: number, halves: number) => sample.life[k] > halves;

/** Half-lives until the last nucleus decays. */
export const lastDecay = (sample: Sample) => sample.sorted[sample.sorted.length - 1] ?? 0;

// ------------------------------------------------------------ radiocarbon dating

/**
 * Age of a sample from the fraction of its carbon-14 left: t = T½ · log₂(1 / f).
 * Assumes the sample started with the same share of carbon-14 as the living
 * things of its time, and that this share was the same as today's (real
 * dating corrects for its changes with a calibration curve).
 */
export const radiocarbonAge = (fraction: number, halfLife = C14.halfLife) =>
	halfLife * Math.log2(1 / fraction);

/** Uncertainty of that age from the half-life's own uncertainty alone. */
export const ageUncertainty = (fraction: number) =>
	radiocarbonAge(fraction, C14.halfLife + C14.uncertainty) - radiocarbonAge(fraction);
