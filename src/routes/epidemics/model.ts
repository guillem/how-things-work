/**
 * The epidemic models behind the explainer.
 *
 * 1. `Crowd`: an agent-based SIR model. Each infectious person meets other
 *    people at random, at `CONTACTS_PER_DAY`, and each meeting with a
 *    susceptible person passes the infection on with probability
 *    R0 / (contacts per day × mean infectious period). In a fully susceptible
 *    crowd one case therefore infects `r0` others on average: the slider value
 *    *is* the basic reproduction number. Infectious periods are exponential
 *    with mean `days`. Both are the assumptions of the classic SIR equations
 *    ("well mixed": anyone can meet anyone), so the crowd and the equations
 *    can be compared directly.
 *
 *    Simplification, stated on the page: people wander over a field that
 *    wraps around at the edges, but who meets whom does not depend on where
 *    they are. Tying meetings to distance makes a case meet the same few
 *    neighbours for days, which lowers the real reproduction number well
 *    below the slider value unless people move implausibly fast.
 *
 * 2. The deterministic SIR equations (Kermack & McKendrick, 1927) and their
 *    closed-form results: the peak at S/N = 1/R0, the final-size equation and
 *    the herd-immunity threshold 1 − 1/R0.
 *
 * Everything is deterministic for a given seed, so a frame is a function of
 * (parameters, seed, simulated day) and can be recomputed at will.
 */

export const State = {
	Susceptible: 0,
	Infectious: 1,
	Recovered: 2,
	Vaccinated: 3
} as const;

export interface CrowdOptions {
	/** Basic reproduction number: secondary cases per case in a fully susceptible crowd. */
	r0: number;
	/** Mean infectious period, in days. */
	days: number;
	/** Share of the crowd immune from the start (vaccinated), 0–1. */
	vaccinated: number;
	/** Number of people. */
	population: number;
	/** Number of infectious people at day 0 (chosen among the unvaccinated). */
	initial: number;
	seed: number;
	/** Size of the square field, in drawing units. */
	size: number;
	/** Walking speed, in drawing units per day. */
	speed: number;
}

/** A meeting between an infectious person and someone else. */
export interface Contact {
	from: number;
	to: number;
	day: number;
	/** Whether the meeting passed the infection on. */
	infected: boolean;
}

export interface Sample {
	day: number;
	s: number;
	i: number;
	r: number;
	v: number;
}

export interface Infection {
	/** Index of the person infected. */
	who: number;
	/** Index of the person who infected them (−1 for the initial cases). */
	by: number;
	day: number;
}

/** Simulation time step, in days. */
export const DT = 0.1;

/**
 * Meetings per day of each infectious person. Must be at least the largest
 * R0 / D the controls allow, so that the transmission probability stays ≤ 1.
 */
export const CONTACTS_PER_DAY = 4;

/** Probability that one meeting with a susceptible person passes the infection on. */
export const transmissionChance = (o: Pick<CrowdOptions, 'r0' | 'days'>) =>
	Math.min(1, o.r0 / (CONTACTS_PER_DAY * o.days));

/** Small, fast, seedable PRNG (mulberry32). Returns numbers in [0, 1). */
export function rng(seed: number) {
	let a = seed >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const wrap = (v: number, size: number) => ((v % size) + size) % size;

export class Crowd {
	readonly o: CrowdOptions;
	readonly n: number;
	/** Current state of each person. */
	readonly state: Uint8Array;
	/** Day each person was infected (NaN if never). */
	readonly infectedAt: Float64Array;
	/** Day each person recovers / recovered (NaN if never infected). */
	readonly recoversAt: Float64Array;
	/** Index of the infector (−1 for initial cases and the never infected). */
	readonly infectedBy: Int32Array;
	/** Number of people each person has infected so far. */
	readonly secondary: Uint16Array;
	readonly infections: Infection[] = [];
	/** Every meeting of an infectious person, in order. */
	readonly contacts: Contact[] = [];
	readonly history: Sample[] = [];
	/** Simulated day the state corresponds to. */
	day = 0;

	// Motion: a straight drift plus a slow sideways wobble, so that people keep
	// drifting about. Position is a pure function of the day; it is only drawn.
	readonly #x0: Float64Array;
	readonly #y0: Float64Array;
	readonly #vx: Float64Array;
	readonly #vy: Float64Array;
	readonly #wobble: Float64Array;
	readonly #phase: Float64Array;
	readonly #rand: () => number;
	readonly #chance: number;
	readonly #counts = { s: 0, i: 0, r: 0, v: 0 };

	constructor(options: CrowdOptions) {
		this.o = options;
		const n = (this.n = options.population);
		this.state = new Uint8Array(n);
		this.infectedAt = new Float64Array(n).fill(NaN);
		this.recoversAt = new Float64Array(n).fill(NaN);
		this.infectedBy = new Int32Array(n).fill(-1);
		this.secondary = new Uint16Array(n);
		this.#x0 = new Float64Array(n);
		this.#y0 = new Float64Array(n);
		this.#vx = new Float64Array(n);
		this.#vy = new Float64Array(n);
		this.#wobble = new Float64Array(n);
		this.#phase = new Float64Array(n);
		this.#chance = transmissionChance(options);

		// Layout and motion use their own stream so that changing R0 or the
		// vaccination share does not rearrange the crowd.
		const place = rng(options.seed * 7919 + 17);
		for (let k = 0; k < n; k++) {
			this.#x0[k] = place() * options.size;
			this.#y0[k] = place() * options.size;
			const heading = place() * Math.PI * 2;
			const speed = options.speed * (0.6 + 0.8 * place());
			this.#vx[k] = Math.cos(heading) * speed;
			this.#vy[k] = Math.sin(heading) * speed;
			this.#wobble[k] = 0.15 + 0.25 * place();
			this.#phase[k] = place() * Math.PI * 2;
		}

		this.#rand = rng(options.seed);
		// Vaccinate a random share, then seed the first cases among the rest.
		const order = shuffle(n, rng(options.seed * 31 + 7));
		const vaccinated = Math.round(options.vaccinated * n);
		for (let k = 0; k < vaccinated; k++) this.state[order[k]] = State.Vaccinated;
		const initial = Math.min(options.initial, n - vaccinated);
		for (let k = 0; k < initial; k++) this.#infect(order[vaccinated + k], -1);
		this.#counts.v = vaccinated;
		this.#counts.i = initial;
		this.#counts.s = n - vaccinated - initial;
		this.#record();
	}

	/** Position of person `k` on the given day. */
	x(k: number, day = this.day) {
		const sway = this.o.speed * 3 * this.#wobble[k];
		const w = Math.sin(day * this.#wobble[k] + this.#phase[k]) * sway;
		return wrap(this.#x0[k] + this.#vx[k] * day - (this.#vy[k] / this.o.speed) * w, this.o.size);
	}
	y(k: number, day = this.day) {
		const sway = this.o.speed * 3 * this.#wobble[k];
		const w = Math.sin(day * this.#wobble[k] + this.#phase[k]) * sway;
		return wrap(this.#y0[k] + this.#vy[k] * day + (this.#vx[k] / this.o.speed) * w, this.o.size);
	}

	get counts(): Readonly<{ s: number; i: number; r: number; v: number }> {
		return this.#counts;
	}
	get over() {
		return this.#counts.i === 0;
	}

	/** Advances the simulation until `day` (in steps of `DT`), or until it is over. */
	advanceTo(day: number) {
		while (this.day + DT <= day + 1e-9 && !this.over) this.#tick();
		// Once over, time still passes (people keep walking) but nothing changes.
		if (this.over && day > this.day) this.day = day;
	}

	#infect(k: number, by: number) {
		this.state[k] = State.Infectious;
		this.infectedAt[k] = this.day;
		// Exponentially distributed infectious period with mean `days`.
		this.recoversAt[k] = this.day - Math.log(1 - this.#rand()) * this.o.days;
		this.infectedBy[k] = by;
		if (by >= 0) this.secondary[by]++;
		this.infections.push({ who: k, by, day: this.day });
	}

	#tick() {
		const n = this.n;
		const day = this.day;
		const meetings = CONTACTS_PER_DAY * DT;
		const newly: [number, number][] = [];
		for (let k = 0; k < n; k++) {
			if (this.state[k] !== State.Infectious) continue;
			// Meetings in this time step: Poisson-distributed, mean CONTACTS_PER_DAY × DT.
			for (let m = poisson(meetings, this.#rand); m > 0; m--) {
				// Anyone else, chosen at random ("well mixed").
				let j = Math.floor(this.#rand() * (n - 1));
				if (j >= k) j++;
				const infected =
					this.state[j] === State.Susceptible &&
					this.#rand() < this.#chance &&
					!newly.some(([w]) => w === j);
				if (infected) newly.push([j, k]);
				this.contacts.push({ from: k, to: j, day: day + this.#rand() * DT, infected });
			}
		}

		this.day = day + DT;
		for (const [j, k] of newly) {
			this.#infect(j, k);
			this.#counts.s--;
			this.#counts.i++;
		}
		for (let k = 0; k < n; k++) {
			if (this.state[k] === State.Infectious && this.recoversAt[k] <= this.day) {
				this.state[k] = State.Recovered;
				this.#counts.i--;
				this.#counts.r++;
			}
		}
		this.#record();
	}

	#record() {
		const { s, i, r, v } = this.#counts;
		this.history.push({ day: this.day, s, i, r, v });
	}
}

/** Poisson-distributed random integer with the given (small) mean (Knuth's method). */
function poisson(mean: number, rand: () => number) {
	const limit = Math.exp(-mean);
	let k = 0;
	let p = rand();
	while (p > limit) {
		k++;
		p *= rand();
	}
	return k;
}

function shuffle(n: number, rand: () => number) {
	const a = Array.from({ length: n }, (_, k) => k);
	for (let k = n - 1; k > 0; k--) {
		const j = Math.floor(rand() * (k + 1));
		[a[k], a[j]] = [a[j], a[k]];
	}
	return a;
}

// ---------------------------------------------------------------- SIR theory

export interface SirOptions {
	r0: number;
	days: number;
	vaccinated: number;
	population: number;
	initial: number;
}

/**
 * Integrates the SIR equations with fourth-order Runge–Kutta:
 *   dS/dt = −β S I / N,  dI/dt = β S I / N − γ I,  dR/dt = γ I,
 * with β = R0 / D and γ = 1 / D. Vaccinated people are immune from day 0.
 */
export function solveSir(o: SirOptions, until: number, dt = 0.1): Sample[] {
	const n = o.population;
	const v = o.vaccinated * n;
	const beta = o.r0 / o.days;
	const gamma = 1 / o.days;
	let s = n - v - o.initial;
	let i = o.initial;
	let r = 0;
	const out: Sample[] = [{ day: 0, s, i, r, v }];
	const f = (s: number, i: number) => [-(beta * s * i) / n, (beta * s * i) / n - gamma * i];
	for (let day = dt; day <= until + 1e-9; day += dt) {
		const [a1, b1] = f(s, i);
		const [a2, b2] = f(s + (dt / 2) * a1, i + (dt / 2) * b1);
		const [a3, b3] = f(s + (dt / 2) * a2, i + (dt / 2) * b2);
		const [a4, b4] = f(s + dt * a3, i + dt * b3);
		s += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
		i += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
		r = n - v - s - i;
		out.push({ day, s, i, r, v });
	}
	return out;
}

/**
 * Share of the whole population that is ever infected, from the final-size
 * equation of the SIR model: with s₀ the susceptible share at the start and
 * an outbreak that starts from a vanishingly small number of cases, the share
 * still susceptible at the end, s∞, solves  s∞ = s₀ · exp(−R0 · (s₀ − s∞)).
 * Returns 0 when the outbreak cannot grow (R0 · s₀ ≤ 1).
 */
export function finalSize(r0: number, vaccinated = 0) {
	const s0 = 1 - vaccinated;
	if (r0 * s0 <= 1) return 0;
	// Bisection on g(x) = x − s0·exp(−R0(s0 − x)) over (0, 1/R0): g < 0 near 0
	// and g > 0 at x = 1/R0 (the threshold), which brackets the epidemic root.
	let lo = 0;
	let hi = 1 / r0;
	for (let k = 0; k < 80; k++) {
		const mid = (lo + hi) / 2;
		if (mid - s0 * Math.exp(-r0 * (s0 - mid)) < 0) lo = mid;
		else hi = mid;
	}
	return s0 - (lo + hi) / 2;
}

/** Share of the population that must be immune for an outbreak to shrink: 1 − 1/R0. */
export const herdThreshold = (r0: number) => Math.max(0, 1 - 1 / r0);

/** Effective reproduction number when a share `immune` of people cannot be infected. */
export const effectiveR = (r0: number, susceptibleShare: number) => r0 * susceptibleShare;

/**
 * Early growth rate per day of the SIR model, r = (R0 − 1) / D, and the
 * corresponding doubling time ln 2 / r (Infinity when the outbreak shrinks).
 */
export const growthRate = (r0: number, days: number) => (r0 - 1) / days;
export const doublingTime = (r0: number, days: number) =>
	r0 > 1 ? Math.LN2 / growthRate(r0, days) : Infinity;

/**
 * Probability that a single case leads to no large outbreak, for the SIR model
 * (exponential infectious period ⇒ geometric number of secondary cases):
 * 1/R0 when R0 > 1, otherwise 1. With k independent initial cases, raise it to
 * the k-th power.
 */
export const fizzleChance = (r0: number, initial = 1) => (r0 <= 1 ? 1 : Math.pow(1 / r0, initial));
