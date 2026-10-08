/**
 * Population models for the ecosystems explainer.
 *
 * 1. Prey alone: logistic growth, dN/dt = a·N·(1 − N/K) — fast growth while
 *    there is room, levelling off at the carrying capacity K.
 * 2. Predator and prey: the Lotka–Volterra equations (Lotka 1925, Volterra
 *    1926),
 *        dH/dt = a·H − b·H·P          (prey: born at rate a, eaten at rate b·P)
 *        dP/dt = c·b·H·P − d·P        (predators: grow from what they eat, die at rate d)
 *    whose populations cycle for ever, the predators' peak lagging the prey's.
 * 3. A small food web: generalised Lotka–Volterra equations,
 *        dNᵢ/dt = Nᵢ·(rᵢ + Σⱼ Aᵢⱼ·Nⱼ),
 *    for a made-up web of five species loosely inspired by Yellowstone
 *    (willow, elk, beaver, wolf and, when added, deer). The numbers are chosen
 *    to give a stable community and plausible directions of change, not
 *    measured values; this is stated on the page.
 *
 * All integrated with fourth-order Runge–Kutta. Time is in years.
 */

export type State = number[];

/** One RK4 step for dy/dt = f(y). */
export function rk4(f: (y: State) => State, y: State, h: number): State {
	const k1 = f(y);
	const k2 = f(y.map((v, i) => v + (h / 2) * k1[i]));
	const k3 = f(y.map((v, i) => v + (h / 2) * k2[i]));
	const k4 = f(y.map((v, i) => v + h * k3[i]));
	return y.map((v, i) => Math.max(0, v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])));
}

/** Integrates for `years`, returning the state every `sample` years (sub-steps of ≤ 0.01 yr). */
export function run(f: (y: State) => State, y0: State, years: number, sample = 0.05): State[] {
	const sub = Math.max(1, Math.ceil(sample / 0.01));
	const h = sample / sub;
	const out = [y0];
	let y = y0;
	for (let s = 0; s < Math.round(years / sample); s++) {
		for (let k = 0; k < sub; k++) y = rk4(f, y, h);
		out.push(y);
	}
	return out;
}

// ------------------------------------------------------------ 1. prey alone

/** Logistic growth: births at rate `a` per year, held back as N approaches K. */
export const logisticGrowth = (a: number, K: number) => (y: State) => [a * y[0] * (1 - y[0] / K)];

/** Exact logistic solution, for checking. */
export const logisticExact = (N0: number, a: number, K: number, t: number) =>
	K / (1 + ((K - N0) / N0) * Math.exp(-a * t));

// ------------------------------------------------------------ 2. predator and prey

export interface LV {
	/** Prey birth rate (per year). */
	a: number;
	/** Predation rate (per predator per year). */
	b: number;
	/** How efficiently eaten prey become new predators. */
	c: number;
	/** Predator death rate (per year). */
	d: number;
}

/** The default hares and lynx-like parameters: a cycle of about 10 years. */
export const LV_DEFAULT: LV = { a: 1, b: 0.02, c: 0.1, d: 0.6 };

export const lotkaVolterra =
	({ a, b, c, d }: LV) =>
	(y: State) => [a * y[0] - b * y[0] * y[1], c * b * y[0] * y[1] - d * y[1]];

/** Where the predator–prey steps start: prey and predators away from the balance point. */
export const LV_START: State = [200, 30];

/** The balance point: prey d/(c·b), predators a/b. Starting there, nothing changes. */
export const lvEquilibrium = ({ a, b, c, d }: LV) => ({ prey: d / (c * b), predators: a / b });

/**
 * The quantity the Lotka–Volterra equations keep constant (so the cycles
 * close on themselves): V = c·b·H − d·ln H + b·P − a·ln P.
 */
export const lvInvariant = ({ a, b, c, d }: LV, H: number, P: number) =>
	c * b * H - d * Math.log(H) + b * P - a * Math.log(P);

/** Period of small cycles around the balance point: 2π / √(a·d) years. */
export const lvSmallPeriod = ({ a, d }: LV) => (2 * Math.PI) / Math.sqrt(a * d);

// ------------------------------------------------------------ 3. food web

export const SPECIES = ['willow', 'elk', 'beaver', 'wolf', 'deer'] as const;
export type Species = (typeof SPECIES)[number];

/**
 * Interaction strengths Aᵢⱼ: the effect of one unit of species j on the
 * growth rate of species i (per year). Rows: willow, elk, beaver, wolf, deer.
 */
const A: number[][] = [
	// willow  elk     beaver  wolf    deer
	[-0.01, -0.02, -0.015, 0, -0.02], // willow: crowded, browsed by elk, beavers and deer
	[0.012, -0.004, 0, -0.06, -0.004], // elk: eat willow, crowded, eaten by wolves, compete with deer
	[0.006, 0, -0.02, 0, 0], // beaver: need willow
	[0, 0.012, 0, -0.04, 0.012], // wolf: eat elk (and deer)
	[0.012, -0.004, 0, -0.06, -0.004] // deer: like elk
];

/**
 * The community the web starts from (willow, elk, beaver, wolf; no deer):
 * growth rates rᵢ are set so that these numbers are a balance point.
 */
export const WEB_START: State = [100, 40, 25, 6, 0];

const r: number[] = (() => {
	const n = WEB_START.slice(0, 4);
	const rr = [0, 1, 2, 3].map((i) => -n.reduce((s, Nj, j) => s + A[i][j] * Nj, 0));
	// Deer eat and are eaten like elk, but breed a little faster (an adaptable newcomer).
	return [...rr, rr[1] + 0.15];
})();

export const webRates = () => [...r];
export const webMatrix = () => A.map((row) => [...row]);

/** The food web with some species absent (forced to zero). */
export const foodWeb =
	(present: boolean[]) =>
	(y: State): State =>
		y.map((Ni, i) =>
			present[i]
				? Ni * (r[i] + A[i].reduce((s, Aij, j) => s + Aij * (present[j] ? y[j] : 0), 0))
				: 0
		);

/** Who eats whom (consumer → resource), for drawing the web's arrows (energy flows resource → consumer). */
export const EATS: [Species, Species][] = [
	['elk', 'willow'],
	['beaver', 'willow'],
	['deer', 'willow'],
	['wolf', 'elk'],
	['wolf', 'deer']
];

/**
 * Runs the web for `years` from `start`, with the given species present;
 * a species removed has its population set to 0, one added starts at `seed`.
 */
export function webRun(
	present: boolean[],
	start: State = WEB_START,
	years = 60,
	sample = 0.25,
	seed = 5
) {
	const y0 = start.map((v, i) => (present[i] ? (v > 0 ? v : seed) : 0));
	return run(foodWeb(present), y0, years, sample);
}
