/**
 * The published scaling laws the page draws, with their constants as their papers give them.
 *
 * - Kaplan et al. 2020, "Scaling Laws for Neural Language Models" (arXiv:2001.08361), eqs.
 *   1.1–1.3: L(N) = (N_c/N)^α_N, L(D) = (D_c/D)^α_D, L(C_min) = (C_c/C_min)^α_C, with N the
 *   non-embedding parameters, D tokens, C in PF-days and L in nats per token on WebText2.
 * - Hoffmann et al. 2022, "Training Compute-Optimal Large Language Models" (arXiv:2203.15556),
 *   eqs. 2 and 10: L(N, D) = E + A/N^α + B/D^β, with N parameters, D training tokens and L in
 *   nats per token on MassiveText, and training compute C ≈ 6ND floating-point operations.
 * - Besiroglu et al. 2024, "Chinchilla Scaling: A replication attempt" (Epoch AI,
 *   arXiv:2404.10102), Table 1 and eq. 3: the same form refitted to data reconstructed from
 *   Hoffmann et al.'s Figure 4, and (eq. 4) Hoffmann et al.'s constants to more digits, from
 *   comments in the paper's TeX source.
 *
 * These are fits over the ranges their authors trained, not laws of nature.
 */

export interface ParametricFit {
	id: FitId;
	/** Short name for a control or a legend. */
	name: string;
	source: string;
	E: number;
	A: number;
	B: number;
	alpha: number;
	beta: number;
}

export type FitId = 'hoffmann' | 'hoffmann-tex' | 'besiroglu';

/** Hoffmann et al. 2022, eq. 10, as printed in the paper. */
export const HOFFMANN: ParametricFit = {
	id: 'hoffmann',
	name: 'Hoffmann et al. 2022, as printed',
	source: 'Hoffmann et al. 2022, eq. 10',
	E: 1.69,
	A: 406.4,
	B: 410.7,
	alpha: 0.34,
	beta: 0.28
};

/** Hoffmann et al.'s fit to more digits (TeX source), as Besiroglu et al. 2024 give it (eq. 4). */
export const HOFFMANN_TEX: ParametricFit = {
	id: 'hoffmann-tex',
	name: 'Hoffmann et al. 2022, unrounded',
	source: 'Besiroglu et al. 2024, eq. 4 (from the TeX source of Hoffmann et al.)',
	E: 1.6934,
	A: 406.4,
	B: 410.7,
	alpha: 0.3392,
	beta: 0.2849
};

/** Besiroglu et al. 2024 (Epoch AI), Table 1 and eq. 3: the replication's refit. */
export const BESIROGLU: ParametricFit = {
	id: 'besiroglu',
	name: 'Besiroglu et al. 2024 refit',
	source: 'Besiroglu et al. 2024, eq. 3',
	E: 1.8172,
	A: 482.01,
	B: 2085.43,
	alpha: 0.3478,
	beta: 0.3658
};

export const FITS: readonly ParametricFit[] = [HOFFMANN, HOFFMANN_TEX, BESIROGLU];
export const fitById = (id: string): ParametricFit => FITS.find((f) => f.id === id) ?? HOFFMANN;

/** Fitted loss, in nats per token, of N parameters trained on D tokens. */
export const lossOf = (f: ParametricFit, N: number, D: number) =>
	f.E + f.A / Math.pow(N, f.alpha) + f.B / Math.pow(D, f.beta);

/** Training compute in floating-point operations: about 6 per parameter per token. */
export const computeOf = (N: number, D: number) => 6 * N * D;
/** Tokens a budget of C operations buys for a model of N parameters. */
export const tokensFor = (C: number, N: number) => C / (6 * N);

export interface Optimum {
	N: number;
	D: number;
	loss: number;
	tokensPerParameter: number;
}

/**
 * The split of a compute budget C (with C = 6ND) that minimises the fitted loss. Setting the
 * derivative of E + A/N^α + B/(C/6N)^β to zero gives N = G (C/6)^(β/(α+β)) with
 * G = (αA / βB)^(1/(α+β)), and D = C/(6N).
 */
export function optimum(f: ParametricFit, C: number): Optimum {
	const s = f.alpha + f.beta;
	const G = Math.pow((f.alpha * f.A) / (f.beta * f.B), 1 / s);
	const N = G * Math.pow(C / 6, f.beta / s);
	const D = tokensFor(C, N);
	return { N, D, loss: lossOf(f, N, D), tokensPerParameter: D / N };
}

/** How the optimal model size grows with compute: N_opt ∝ C^a. */
export const sizeExponent = (f: ParametricFit) => f.beta / (f.alpha + f.beta);

/** The fitted loss along one budget (an IsoFLOP slice): models of every size, each on C/6N tokens. */
export function isoFlop(f: ParametricFit, C: number, logNs: readonly number[]) {
	return logNs.map((lg) => {
		const N = Math.pow(10, lg);
		return { N, D: tokensFor(C, N), loss: lossOf(f, N, tokensFor(C, N)) };
	});
}

/** Kaplan et al. 2020, eqs. 1.1–1.3 and section 3: the single-variable laws and their ranges. */
export const KAPLAN = {
	alphaN: 0.076,
	/** non-embedding parameters */
	Nc: 8.8e13,
	alphaD: 0.095,
	/** tokens */
	Dc: 5.4e13,
	alphaC: 0.05,
	/** PF-days */
	Cc: 3.1e8,
	/** Model sizes trained: 768 to 1.5 billion non-embedding parameters. */
	rangeN: [768, 1.5e9] as const,
	/** Dataset sizes: 22 million to 23 billion tokens. */
	rangeD: [22e6, 23e9] as const,
	/** Compute-efficient model size grows as C^0.73 (eq. 6.1). */
	sizeExponent: 0.73
};
export const kaplanLossN = (N: number) => Math.pow(KAPLAN.Nc / N, KAPLAN.alphaN);
export const kaplanLossD = (D: number) => Math.pow(KAPLAN.Dc / D, KAPLAN.alphaD);

/** Hoffmann et al. 2022 trained over 400 models of 70M to over 16B parameters on 5B to 500B tokens. */
export const CHINCHILLA_RANGE = { N: [70e6, 16e9] as const, D: [5e9, 500e9] as const };

/** Gopher's training budget, which Chinchilla matched (Hoffmann et al. 2022). */
export const GOPHER_BUDGET = 5.76e23;

/** Published sizes and training tokens of a few well-known models. */
export interface KnownModel {
	id: string;
	name: string;
	N: number;
	D: number;
	source: string;
}
export const MODELS: readonly KnownModel[] = [
	{ id: 'gpt3', name: 'GPT-3', N: 175e9, D: 300e9, source: 'Hoffmann et al. 2022, Table 1' },
	{ id: 'gopher', name: 'Gopher', N: 280e9, D: 300e9, source: 'Hoffmann et al. 2022, Table 1' },
	{
		id: 'chinchilla',
		name: 'Chinchilla',
		N: 70e9,
		D: 1.4e12,
		source: 'Hoffmann et al. 2022, Table 1'
	},
	{
		id: 'llama3-8b',
		name: 'Llama 3 8B',
		N: 8e9,
		D: 15e12,
		source: 'Meta, Llama 3 model card (2024): over 15T tokens'
	},
	{
		id: 'llama3-70b',
		name: 'Llama 3 70B',
		N: 70e9,
		D: 15e12,
		source: 'Meta, Llama 3 model card (2024): over 15T tokens'
	}
];
