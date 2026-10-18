/**
 * E. coli chemotaxis: a seeded agent simulation of run-and-tumble swimmers, each with its own
 * receptor cluster whose activity sets the tumble rate.
 *
 * Swimming (Berg & Brown 1972, Nature 239:500, three-dimensional tracking of wild-type cells):
 * runs last 0.86 s on average and tumbles 0.14 s; a tumble turns the cell by 68° on average
 * (mean cosine 0.33). We draw the new heading from p(cos θ) = (1 + cos θ)/2, which has exactly
 * that mean cosine (1/3) and a mean angle of 67.5°. During a run the heading wanders by
 * rotational diffusion, D_r = 0.062 rad²/s (Berg, Random Walks in Biology, 1993: a cell loses
 * its heading in about 10 s). Swimming speed is a parameter, 20 µm/s by default (Berg & Brown
 * measured 14 µm/s; other strains and media give up to ~30 µm/s, Maeda et al. 1976).
 * Cells swim in three dimensions in a liquid layer deep enough that only x and y matter for
 * the attractant; we show x and y.
 *
 * Receptors (the MWC model of Tu, Shimizu & Berg 2008, PNAS 105:14855, for the attractant MeAsp
 * on Tar: K_I and m0 from that paper; N, α and K_I/K_A = 0.0062 as measured by Shimizu, Tu &
 * Berg 2010, Mol Syst Biol 6:382, whose fit uses m0 ≈ 0.5, a shift of the methylation scale only):
 * a cluster of N = 6 receptors is all-active or all-inactive; its free energy is
 *   F = N [α (m0 − m) + ln((1 + c/K_I) / (1 + c/K_A))],
 * with α = 2 (kT per methyl group), m0 = 1, K_I = 18.2 µM, K_A = K_I/0.0062 ≈ 2.9 mM, and the
 * activity is a = 1/(1 + e^F). Attractant (c) lowers the activity; methylation (m, 0–4 methyl
 * groups per receptor) raises it.
 *
 * Adaptation: CheR adds methyl groups to inactive receptors and CheB removes them from active
 * ones; linearised around the adapted activity a0 = 1/3 (Shimizu et al. 2010, 22 °C),
 *   dm/dt = k (a0 − a),  k = 1 / (τ N α a0 (1 − a0)),
 * so that a small disturbance of the activity relaxes with the adaptation time τ. Because the
 * rate depends on a only, the steady state is a = a0 whatever the concentration: precise
 * adaptation, the integral feedback of Barkai & Leibler (1997) and Yi et al. (2000). The
 * methylation rate saturates at k·a0 when the activity is zero (a big step takes longer).
 *
 * Motor: CheY-P follows the activity, and the motors switch with a Hill coefficient of about
 * 10 (Cluzel, Surette & Leibler 2000, Science 287:1652); we take the run → tumble rate as
 * λ = λ0 (a/a0)^H with H = 10, λ0 = 1/0.86 s, capped at 10 per second (as in the agent models
 * of Jiang, Ouyang & Tu 2010, PLoS Comput Biol 6:e1000735). Tumbles end at a fixed rate.
 */
import { rng } from '#lib/draw/math.ts';

export const SWIM = {
	/** Swimming speed, µm/s. */
	v: 20,
	/** Mean run at the adapted activity, s. */
	run: 0.86,
	/** Mean tumble, s. */
	tumble: 0.14,
	/** Rotational diffusion coefficient, rad²/s. */
	Dr: 0.062,
	/** Motor steepness (Hill coefficient). */
	H: 10,
	/** Highest tumble rate, 1/s. */
	lambdaMax: 10
} as const;

export const MWC = {
	N: 6,
	alpha: 2,
	m0: 1,
	/** Dissociation constant of MeAsp for inactive receptors, µM. */
	KI: 18.2,
	/** ... and for active receptors, µM. */
	KA: 18.2 / 0.0062,
	a0: 1 / 3,
	mMax: 4
} as const;

/** The adaptation time, s (Shimizu et al. 2010: about 11 s at 32 °C, 29 s at 22 °C). */
export const TAU = 10;

/** Ligand part of the free energy, per receptor. */
export const ligandEnergy = (c: number) => Math.log((1 + c / MWC.KI) / (1 + c / MWC.KA));

/** Receptor-cluster activity for methylation m at attractant concentration c (µM). */
export function activity(m: number, c: number) {
	const F = MWC.N * (MWC.alpha * (MWC.m0 - m) + ligandEnergy(c));
	return 1 / (1 + Math.exp(F));
}

/** The methylation level at which a cell is adapted (a = a0) to concentration c. */
export function adaptedM(c: number) {
	const m = MWC.m0 + (ligandEnergy(c) - Math.log(1 / MWC.a0 - 1) / MWC.N) / MWC.alpha;
	return Math.min(MWC.mMax, Math.max(0, m));
}

/** dm/dt at activity a, for adaptation time tau (s). */
export const methylationRate = (a: number, tau: number) =>
	(MWC.a0 - a) / (tau * MWC.N * MWC.alpha * MWC.a0 * (1 - MWC.a0));

/** Run → tumble rate (1/s) at activity a. */
export const tumbleRate = (a: number) =>
	Math.min(SWIM.lambdaMax, (1 / SWIM.run) * (a / MWC.a0) ** SWIM.H);

/** Attractant concentration (µM) at a position (µm) and time (s). */
export type Field = (x: number, y: number, t: number) => number;

export interface SwarmOptions {
	n: number;
	seed: number;
	field: Field;
	/** Swimming speed, µm/s. */
	v?: number;
	/** Adaptation time, s. */
	tau?: number;
	/** Methylation on (true) or frozen at the start (false). */
	adapt?: boolean;
	/** Reflecting walls at 0 ≤ x ≤ w, 0 ≤ y ≤ h (µm); none if absent. */
	box?: { w: number; h: number };
	/** Starting positions; by default all at the origin. */
	start?: (rand: () => number) => { x: number; y: number };
	/** Methylation the cells start with; by default adapted to where they start. */
	startM?: (c: number) => number;
}

/** A completed run: duration (s) and whether it pointed up (+1) or down (−1) the gradient. */
export interface RunTally {
	upTime: number;
	upCount: number;
	downTime: number;
	downCount: number;
}

/** A population of swimmers, advanced in fixed time steps. */
export class Swarm {
	readonly n: number;
	t = 0;
	readonly x: Float64Array;
	readonly y: Float64Array;
	readonly z: Float64Array;
	readonly ex: Float64Array;
	readonly ey: Float64Array;
	readonly ez: Float64Array;
	readonly m: Float64Array;
	readonly a: Float64Array;
	/** Time left in the current tumble (0 while running). */
	readonly tumbleLeft: Float64Array;
	/** Time spent in the current run, and the gradient's sign along its heading at its start. */
	readonly runAge: Float64Array;
	readonly runDir: Int8Array;
	/** Tumbles started since the counter was last reset. */
	tumbles = 0;
	readonly runs: RunTally = { upTime: 0, upCount: 0, downTime: 0, downCount: 0 };
	/** Tumble angles (rad) of every tumble so far, for the statistics. */
	readonly angles: number[] = [];
	keepAngles = false;
	private readonly rand: () => number;
	private readonly opts: Required<Omit<SwarmOptions, 'box' | 'start' | 'startM'>> &
		Pick<SwarmOptions, 'box'>;
	private spare: number | null = null;

	constructor(o: SwarmOptions) {
		this.n = o.n;
		this.rand = rng(o.seed);
		this.opts = {
			n: o.n,
			seed: o.seed,
			field: o.field,
			v: o.v ?? SWIM.v,
			tau: o.tau ?? TAU,
			adapt: o.adapt ?? true,
			box: o.box
		};
		const mk = () => new Float64Array(o.n);
		this.x = mk();
		this.y = mk();
		this.z = mk();
		this.ex = mk();
		this.ey = mk();
		this.ez = mk();
		this.m = mk();
		this.a = mk();
		this.tumbleLeft = mk();
		this.runAge = mk();
		this.runDir = new Int8Array(o.n);
		for (let i = 0; i < o.n; i++) {
			const p = o.start ? o.start(this.rand) : { x: 0, y: 0 };
			this.x[i] = p.x;
			this.y[i] = p.y;
			const c = o.field(p.x, p.y, 0);
			this.m[i] = o.startM ? o.startM(c) : adaptedM(c);
			this.a[i] = activity(this.m[i], c);
			// a random heading, uniform on the sphere
			const u = 2 * this.rand() - 1;
			const phi = 2 * Math.PI * this.rand();
			const s = Math.sqrt(1 - u * u);
			this.ex[i] = s * Math.cos(phi);
			this.ey[i] = s * Math.sin(phi);
			this.ez[i] = u;
			this.runAge[i] = 0;
			this.runDir[i] = this.gradientSign(i);
		}
	}

	private gauss() {
		if (this.spare !== null) {
			const s = this.spare;
			this.spare = null;
			return s;
		}
		let u = 0;
		while (u === 0) u = this.rand();
		const r = Math.sqrt(-2 * Math.log(u));
		const th = 2 * Math.PI * this.rand();
		this.spare = r * Math.sin(th);
		return r * Math.cos(th);
	}

	/** Sign of the concentration change along cell i's heading (0 if flat). */
	private gradientSign(i: number) {
		const h = 2;
		const f = this.opts.field;
		const d =
			f(this.x[i] + h * this.ex[i], this.y[i] + h * this.ey[i], this.t) -
			f(this.x[i] - h * this.ex[i], this.y[i] - h * this.ey[i], this.t);
		return d > 0 ? 1 : d < 0 ? -1 : 0;
	}

	/** Rotates cell i's heading by polar angle θ (cos θ given) around a random axis. */
	private turn(i: number, cos: number) {
		const ex = this.ex[i];
		const ey = this.ey[i];
		const ez = this.ez[i];
		// a unit vector perpendicular to e
		let px: number, py: number, pz: number;
		if (Math.abs(ez) < 0.9) {
			px = -ey;
			py = ex;
			pz = 0;
		} else {
			px = 0;
			py = -ez;
			pz = ey;
		}
		const pl = Math.sqrt(px * px + py * py + pz * pz);
		px /= pl;
		py /= pl;
		pz /= pl;
		// q = e × p
		const qx = ey * pz - ez * py;
		const qy = ez * px - ex * pz;
		const qz = ex * py - ey * px;
		const phi = 2 * Math.PI * this.rand();
		const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
		const c1 = sin * Math.cos(phi);
		const c2 = sin * Math.sin(phi);
		let nx = cos * ex + c1 * px + c2 * qx;
		let ny = cos * ey + c1 * py + c2 * qy;
		let nz = cos * ez + c1 * pz + c2 * qz;
		const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
		nx /= l;
		ny /= l;
		nz /= l;
		this.ex[i] = nx;
		this.ey[i] = ny;
		this.ez[i] = nz;
	}

	/**
	 * Rotational diffusion: a random kick of standard deviation `sd` (rad) perpendicular to the
	 * heading, in each of the two perpendicular directions.
	 */
	private wander(i: number, sd: number) {
		const ex = this.ex[i];
		const ey = this.ey[i];
		const ez = this.ez[i];
		let kx = sd * this.gauss();
		let ky = sd * this.gauss();
		let kz = sd * this.gauss();
		const along = kx * ex + ky * ey + kz * ez;
		kx -= along * ex;
		ky -= along * ey;
		kz -= along * ez;
		const nx = ex + kx;
		const ny = ey + ky;
		const nz = ez + kz;
		const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
		this.ex[i] = nx / l;
		this.ey[i] = ny / l;
		this.ez[i] = nz / l;
	}

	/** Advances every cell by dt seconds. */
	step(dt: number) {
		const { field, v, tau, adapt, box } = this.opts;
		const t = this.t;
		const rotSd = Math.sqrt(2 * SWIM.Dr * dt);
		for (let i = 0; i < this.n; i++) {
			const c = field(this.x[i], this.y[i], t);
			let a = activity(this.m[i], c);
			if (adapt) {
				let m = this.m[i] + dt * methylationRate(a, tau);
				m = Math.min(MWC.mMax, Math.max(0, m));
				this.m[i] = m;
				a = activity(m, c);
			}
			this.a[i] = a;
			if (this.tumbleLeft[i] > 0) {
				this.tumbleLeft[i] -= dt;
				if (this.tumbleLeft[i] <= 0) {
					this.tumbleLeft[i] = 0;
					// the new heading: p(cos θ) = (1 + cos θ)/2, inverse CDF
					const cos = 2 * Math.sqrt(this.rand()) - 1;
					if (this.keepAngles) this.angles.push(Math.acos(cos));
					this.turn(i, cos);
					this.runAge[i] = 0;
					this.runDir[i] = this.gradientSign(i);
				}
				continue;
			}
			// run: swim, wander by rotational diffusion
			this.x[i] += v * this.ex[i] * dt;
			this.y[i] += v * this.ey[i] * dt;
			this.z[i] += v * this.ez[i] * dt;
			if (box) {
				if (this.x[i] < 0) {
					this.x[i] = -this.x[i];
					this.ex[i] = Math.abs(this.ex[i]);
				} else if (this.x[i] > box.w) {
					this.x[i] = 2 * box.w - this.x[i];
					this.ex[i] = -Math.abs(this.ex[i]);
				}
				if (this.y[i] < 0) {
					this.y[i] = -this.y[i];
					this.ey[i] = Math.abs(this.ey[i]);
				} else if (this.y[i] > box.h) {
					this.y[i] = 2 * box.h - this.y[i];
					this.ey[i] = -Math.abs(this.ey[i]);
				}
			}
			this.wander(i, rotSd);
			this.runAge[i] += dt;
			const p = 1 - Math.exp(-tumbleRate(a) * dt);
			if (this.rand() < p) {
				this.tumbles++;
				const d = this.runDir[i];
				if (d > 0) {
					this.runs.upTime += this.runAge[i];
					this.runs.upCount++;
				} else if (d < 0) {
					this.runs.downTime += this.runAge[i];
					this.runs.downCount++;
				}
				this.tumbleLeft[i] = -Math.log(1 - this.rand()) * SWIM.tumble;
				if (this.tumbleLeft[i] < dt) this.tumbleLeft[i] = dt;
			}
		}
		this.t = t + dt;
	}

	/** Advances to time `until` in steps of dt. */
	run(until: number, dt = DT) {
		while (this.t < until - 1e-9) this.step(Math.min(dt, until - this.t));
	}

	/** Number of cells currently tumbling. */
	tumbling() {
		let k = 0;
		for (let i = 0; i < this.n; i++) if (this.tumbleLeft[i] > 0) k++;
		return k;
	}
}

/** The simulation's time step, s. */
export const DT = 0.02;

// ---- a uniform field: the whole dish flooded at once ----------------------------------------

/**
 * In a uniform field every cell has the same methylation and activity (the methylation follows
 * an ordinary differential equation), and only the moments of the tumbles differ. This computes
 * that shared state, and the tumbles of n cells (the same run → tumble and tumble → run rates as
 * `Swarm`, without positions), for a concentration c(t), recording every `every` seconds.
 */
export function uniformResponse(o: {
	c: (t: number) => number;
	until: number;
	tau?: number;
	adapt?: boolean;
	n?: number;
	seed?: number;
	every?: number;
}) {
	const { c, until, tau = TAU, adapt = true, n = 1000, seed = 7, every = 1 } = o;
	const rand = rng(seed);
	let m = adaptedM(c(0));
	const tumbling = new Uint8Array(n);
	const out: { t: number; c: number; a: number; m: number; rate: number; expected: number }[] = [];
	let count = 0;
	let expectedCount = 0;
	const dt = DT;
	const steps = Math.round(until / dt);
	const per = Math.round(every / dt);
	const pEnd = 1 - Math.exp(-dt / SWIM.tumble);
	// start with the cells' run/tumble states at their steady proportions
	for (let i = 0; i < n; i++) tumbling[i] = rand() < SWIM.tumble / (SWIM.run + SWIM.tumble) ? 1 : 0;
	for (let k = 0; k < steps; k++) {
		const t = k * dt;
		const ct = c(t);
		let a = activity(m, ct);
		if (adapt) {
			m = Math.min(MWC.mMax, Math.max(0, m + dt * methylationRate(a, tau)));
			a = activity(m, ct);
		}
		const lam = tumbleRate(a);
		const pStart = 1 - Math.exp(-lam * dt);
		let running = 0;
		for (let i = 0; i < n; i++) {
			if (tumbling[i]) {
				if (rand() < pEnd) tumbling[i] = 0;
			} else {
				running++;
				if (rand() < pStart) {
					tumbling[i] = 1;
					count++;
				}
			}
		}
		expectedCount += pStart * (running / n);
		if ((k + 1) % per === 0) {
			out.push({
				t: t + dt,
				c: ct,
				a,
				m,
				/** Tumbles per cell per second in this interval. */
				rate: count / n / every,
				/** The same, expected from the tumble rate (no counting noise). */
				expected: expectedCount / every
			});
			count = 0;
			expectedCount = 0;
		}
	}
	return out;
}

// ---- the dish ---------------------------------------------------------------------------------

/** The chamber, µm. */
export const DISH = { w: 1800, h: 880 } as const;
/** The drop: peak concentration (µM) and width (µm) of its Gaussian spread. */
export const DROP = { peak: 1000, width: 500 } as const;

export interface DishOptions {
	dropX: number;
	dropY: number;
	v?: number;
	tau?: number;
	adapt?: boolean;
	n?: number;
	seed?: number;
}

/** Frames of the dish recorded every FRAME seconds: positions, heading to the drop, tumbling. */
export const FRAME = 0.25;

/**
 * A dish released with n cells spread evenly over it, each adapted to where it starts, recorded
 * lazily: `at(t)` simulates as far as t (once) and returns the frame index there.
 */
export function dish(o: DishOptions) {
	const n = o.n ?? 300;
	/** Where the drop is now: the reader can move it while the cells swim. */
	const drop = { x: o.dropX, y: o.dropY };
	const field: Field = (x, y) =>
		DROP.peak * Math.exp(-((x - drop.x) ** 2 + (y - drop.y) ** 2) / (2 * DROP.width ** 2));
	const swarm = new Swarm({
		n,
		seed: o.seed ?? 11,
		field,
		v: o.v,
		tau: o.tau,
		adapt: o.adapt,
		box: DISH,
		start: (r) => ({ x: r() * DISH.w, y: r() * DISH.h }),
		startM: o.adapt === false ? () => adaptedM(FROZEN_C) : undefined
	});
	const xs: Float32Array[] = [];
	const ys: Float32Array[] = [];
	/** 1 while tumbling, 2 while running toward the drop, 0 while running away. */
	const states: Uint8Array[] = [];
	const near: number[] = [];
	const runs: RunTally[] = [];
	const record = () => {
		const x = new Float32Array(n);
		const y = new Float32Array(n);
		const s = new Uint8Array(n);
		let k = 0;
		for (let i = 0; i < n; i++) {
			x[i] = swarm.x[i];
			y[i] = swarm.y[i];
			const toward = (drop.x - swarm.x[i]) * swarm.ex[i] + (drop.y - swarm.y[i]) * swarm.ey[i] > 0;
			s[i] = swarm.tumbleLeft[i] > 0 ? 1 : toward ? 2 : 0;
			if (Math.hypot(swarm.x[i] - drop.x, swarm.y[i] - drop.y) < NEAR) k++;
		}
		xs.push(x);
		ys.push(y);
		states.push(s);
		near.push(k / n);
		runs.push({ ...swarm.runs });
		// keep only the recent frames' positions (enough for trails)
		const old = xs.length - 1 - KEEP;
		if (old >= 0) {
			xs[old] = EMPTY;
			ys[old] = EMPTY;
			states[old] = EMPTY_STATES;
		}
	};
	record();
	return {
		n,
		field,
		xs,
		ys,
		states,
		/** Share of the cells within NEAR of the drop, per frame. */
		near,
		/** Runs completed by each frame, toward and away from the drop. */
		runs,
		/** Moves the drop from now on; the cells keep swimming (and remembering) as they were. */
		moveDrop(x: number, y: number) {
			drop.x = x;
			drop.y = y;
			this.movedAt = near.length - 1;
		},
		/** The frame at which the drop was last moved (−1: never). */
		movedAt: -1,
		/**
		 * Simulates up to time t (s) and returns the index of the frame at or before it. Positions
		 * are kept for the last KEEP frames only.
		 */
		at(t: number) {
			const k = Math.max(0, Math.floor(t / FRAME + 1e-9));
			while (xs.length <= k) {
				swarm.run(xs.length * FRAME);
				record();
			}
			return k;
		}
	};
}

/**
 * Without adaptation every cell's methylation stays at the level adapted to this concentration
 * (µM), found about 770 µm from the drop: like a mutant lacking both CheR and CheB, whose
 * receptors keep one methylation level. Each cell's tumble rate then depends only on where it is.
 */
export const FROZEN_C = 300;

/** Frames whose positions the dish keeps. */
export const KEEP = 16;
const EMPTY = new Float32Array(0);
const EMPTY_STATES = new Uint8Array(0);

/** "Near the drop": within this distance of its centre, µm. */
export const NEAR = 300;

// ---- the Berg–Purcell argument ---------------------------------------------------------------

/** Molecules per µm³ in 1 µM. */
export const PER_UM3_PER_UM = 602.2;

/**
 * Berg & Purcell (1977, Biophys J 20:193): a cell of radius a that counts molecules for a time T
 * measures a concentration c with a relative error of about 1/√(D a c T) (up to a factor of
 * order one), D being the molecules' diffusion coefficient (about 1000 µm²/s for a small
 * molecule such as an amino acid in water). To compare two ends of its body, each end gets half
 * the counting (a = 1 µm, half the time each: √2 more noise per end) and the difference of two
 * readings adds another √2. Comparing now with a moment ago, the whole cell counts for T at
 * each end of a run of length v·T.
 *
 * Returns the relative change to detect and the relative noise, for both schemes.
 */
export function bergPurcell(o: {
	/** Concentration, µM. */
	c: number;
	/** Gradient length c/|∇c|, µm. */
	length: number;
	/** Swimming speed, µm/s. */
	v?: number;
	/** Counting time, s. */
	T?: number;
	/** Cell length, µm. */
	body?: number;
	/** Diffusion coefficient, µm²/s. */
	D?: number;
	/** Cell radius, µm. */
	a?: number;
}) {
	const { c, length, v = SWIM.v, T = 1, body = 2, D = 1000, a = 1 } = o;
	const err = 1 / Math.sqrt(D * a * c * PER_UM3_PER_UM * T);
	const spatial = { signal: body / length, noise: Math.SQRT2 * Math.SQRT2 * err };
	const temporal = { signal: (v * T) / length, noise: Math.SQRT2 * err };
	return { err, spatial, temporal };
}
