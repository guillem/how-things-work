/**
 * Diffusion, osmosis and active transport: four small models behind one page.
 *
 * 1. Diffusion: dye molecules take independent Brownian steps (a Gaussian step of variance
 *    2·D·Δt along each axis every Δt) in a box with reflecting walls. Nothing pushes them: the
 *    spreading, the crossings of a line and the flattening profile are counts of random steps.
 *    The diffusion coefficient follows the Stokes–Einstein relation D = kT / (6πηr): at a
 *    fixed molecular size, D ∝ T/η(T). Water's viscosity η(T) is the Vogel fit
 *    η = A·10^(B/(T − C)), A = 2.414·10⁻⁵ Pa·s, B = 247.8 K, C = 140 K, within 2–3 % of the
 *    tabulated values from 0 to 100 °C. The dye is fluorescein, D = 4.25·10⁻¹⁰ m²/s in water at
 *    25 °C (Culbertson, Jacobson & Ramsey 2002, Talanta 56:365).
 *
 * 2. Osmosis: two columns of water joined by a membrane that passes water but not sugar. The
 *    trapped sugar pushes on the membrane with van 't Hoff's osmotic pressure Π = cRT (ideal,
 *    dilute solutions), and water flows through the pores at a rate proportional to the net
 *    push: dV/dt ∝ ΔΠ − ρgΔh − P_applied (the Starling / Kedem–Katchalsky law for a membrane
 *    that holds the solute back completely). The sugar is diluted as water comes in. The rate
 *    constant only sets how fast the levels move and is the page's own choice.
 *
 * 3. Cells in a solution: a red blood cell is an osmometer with no wall (Boyle–van 't Hoff:
 *    the water in it adjusts until the inside's dissolved particles match the outside's), with
 *    an osmotically inactive fraction of 0.4 (LeFevre 1964, J Gen Physiol 47:585: about 0.6 of
 *    the volume is water that takes part). It bursts when it has swollen into a sphere: a
 *    membrane of 140 µm² cannot hold more than 156 fL, and the normal cell holds 90 fL
 *    (BioNumbers 101711). A plant cell adds a wall: once the protoplast presses on it, the wall
 *    pushes back with a turgor pressure that rises steeply with volume (an elastic modulus), so
 *    in pure water the cell stops swelling and becomes firm. The potato cell's numbers are
 *    illustrative (see POTATO).
 *
 * 4. Active transport: the same random walkers in a box split by a membrane with one leak
 *    channel and one pump. A particle that wanders into the pump from outside is carried in at
 *    the cost of one ATP; the leak lets particles through both ways at random.
 */
import { rng } from '#lib/draw/math.ts';

// ------------------------------------------------------------------------------- constants
/** Gas constant, J/(mol·K). */
export const R = 8.314;
/** Boltzmann constant, J/K. */
export const KB = 1.380649e-23;
/** Water's density × g, Pa per metre of height. */
export const RHO_G = 998 * 9.81;
/** 0 °C in kelvin. */
export const K0 = 273.15;

// ------------------------------------------------------------------------------- diffusion
/** Water's dynamic viscosity at `celsius`, Pa·s (Vogel fit). */
export function waterViscosity(celsius: number) {
	return 2.414e-5 * 10 ** (247.8 / (celsius + K0 - 140));
}

/** Fluorescein's diffusion coefficient in water at 25 °C, m²/s (Culbertson et al. 2002). */
export const D_DYE_25 = 4.25e-10;

/** The dye's hydrodynamic radius from Stokes–Einstein, m (about 0.6 nm). */
export const DYE_RADIUS = (KB * (25 + K0)) / (6 * Math.PI * waterViscosity(25) * D_DYE_25);

/** Stokes–Einstein: the dye's diffusion coefficient at `celsius`, in µm²/s. */
export function dyeD(celsius: number) {
	return ((KB * (celsius + K0)) / (6 * Math.PI * waterViscosity(celsius) * DYE_RADIUS)) * 1e12;
}

/** Time for a typical 1D spread √(2Dt) to reach `x` µm, s. */
export const spreadTime = (x: number, D: number) => (x * x) / (2 * D);

export interface Membrane {
	/** Position of the membrane (or a counting line, when `open`), µm. */
	x: number;
	/** A line that blocks nothing: only crossings are counted. */
	open?: boolean;
	/** Gaps through which particles pass freely, as [y0, y1]. */
	pores?: [number, number][];
	/** A pump: carries a particle from the left (x < membrane) to the right, one ATP each. */
	pump?: [number, number];
}

export interface WalkOptions {
	n: number;
	/** Box size, µm. */
	w: number;
	h: number;
	/** Diffusion coefficient, µm²/s. */
	D: number;
	/** Frames per second of simulated time. */
	fps?: number;
	seed?: number;
	/** Starting positions. */
	start: (i: number, rand: () => number) => [number, number];
	membrane?: Membrane;
	/** ATP at the start, and the most the store holds. */
	atp?: number;
}

/**
 * Brownian walkers, computed lazily one frame at a time. Settings marked mutable (`pumpOn`,
 * `refill`) apply from the next frame computed, so a scene can switch them mid-run.
 */
export class Walkers {
	readonly n: number;
	readonly w: number;
	readonly h: number;
	readonly fps: number;
	readonly D: number;
	readonly membrane?: Membrane;
	readonly xs: Float32Array[] = [];
	readonly ys: Float32Array[] = [];
	/** Per frame: cumulative crossings of the membrane line, left → right and right → left. */
	readonly toRight: number[] = [0];
	readonly toLeft: number[] = [0];
	/** Per frame: particles right of the membrane line. */
	readonly right: number[] = [];
	/** Per frame: cumulative particles pumped, and the ATP left. */
	readonly pumped: number[] = [0];
	readonly atp: number[] = [];
	readonly atpMax: number;
	pumpOn = true;
	/** ATP made per second (respiration), up to `atpMax`. */
	refill = 0;
	private rand: () => number;
	private sigma: number;
	private atpNow: number;

	constructor(o: WalkOptions) {
		this.n = o.n;
		this.w = o.w;
		this.h = o.h;
		this.D = o.D;
		this.fps = o.fps ?? 10;
		this.membrane = o.membrane;
		this.rand = rng(o.seed ?? 1);
		this.sigma = Math.sqrt((2 * o.D) / this.fps);
		this.atpMax = o.atp ?? 0;
		this.atpNow = this.atpMax;
		const x = new Float32Array(o.n);
		const y = new Float32Array(o.n);
		for (let i = 0; i < o.n; i++) [x[i], y[i]] = o.start(i, this.rand);
		this.xs.push(x);
		this.ys.push(y);
		this.right.push(this.countRight(x));
		this.atp.push(this.atpNow);
	}

	get frames() {
		return this.xs.length;
	}

	private countRight(x: Float32Array) {
		const m = this.membrane;
		if (!m) return 0;
		let c = 0;
		for (let i = 0; i < this.n; i++) if (x[i] > m.x) c++;
		return c;
	}

	private gauss() {
		const u = Math.max(1e-12, this.rand());
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand());
	}

	private reflect(v: number, hi: number) {
		for (let k = 0; k < 4 && (v < 0 || v > hi); k++) v = v < 0 ? -v : 2 * hi - v;
		return Math.min(hi, Math.max(0, v));
	}

	/** Computes frames up to index `k` and returns the last available index (≤ k). */
	at(k: number) {
		const m = this.membrane;
		const inside = (y: number, r?: [number, number]) => !!r && y >= r[0] && y <= r[1];
		while (this.xs.length <= k) {
			const px = this.xs[this.xs.length - 1];
			const py = this.ys[this.ys.length - 1];
			const x = new Float32Array(this.n);
			const y = new Float32Array(this.n);
			let toR = this.toRight[this.toRight.length - 1];
			let toL = this.toLeft[this.toLeft.length - 1];
			let pumped = this.pumped[this.pumped.length - 1];
			for (let i = 0; i < this.n; i++) {
				let nx = this.reflect(px[i] + this.sigma * this.gauss(), this.w);
				const ny = this.reflect(py[i] + this.sigma * this.gauss(), this.h);
				if (m) {
					const was = px[i] > m.x;
					const is = nx > m.x;
					if (was !== is) {
						const yc = (py[i] + ny) / 2;
						let pass = m.open === true || (m.pores ?? []).some((r) => inside(yc, r));
						if (!pass && !was && inside(yc, m.pump) && this.pumpOn && this.atpNow >= 1) {
							pass = true;
							this.atpNow -= 1;
							pumped++;
						}
						if (pass) {
							if (is) toR++;
							else toL++;
						} else nx = 2 * m.x - nx;
					}
				}
				x[i] = nx;
				y[i] = ny;
			}
			this.atpNow = Math.min(this.atpMax, this.atpNow + this.refill / this.fps);
			this.xs.push(x);
			this.ys.push(y);
			this.toRight.push(toR);
			this.toLeft.push(toL);
			this.pumped.push(pumped);
			this.right.push(this.countRight(x));
			this.atp.push(this.atpNow);
		}
		return Math.min(k, this.xs.length - 1);
	}
}

/** The diffusion box of the page: 200 µm × 120 µm. */
export const BOX = { w: 200, h: 120 } as const;
/** The dye drop: radius, µm, and the number of drawn dye particles. */
export const DROP = { r: 10, n: 300 } as const;

/** Dye dropped into the top-left corner of the box at `celsius`. */
export function dyeBox(celsius: number, seed = 7, line = false) {
	return new Walkers({
		n: DROP.n,
		w: BOX.w,
		h: BOX.h,
		D: dyeD(celsius),
		seed,
		membrane: line ? { x: BOX.w / 2, open: true } : undefined,
		start: (_, r) => {
			// uniformly over a quarter disc of radius DROP.r in the corner
			const rad = DROP.r * Math.sqrt(r());
			const a = (Math.PI / 2) * r();
			return [rad * Math.cos(a), rad * Math.sin(a)];
		}
	});
}

/** Root-mean-square distance of the walkers from the corner (0, 0) in frame k, µm. */
export function rmsFromCorner(s: Walkers, k: number) {
	const x = s.xs[k];
	const y = s.ys[k];
	let sum = 0;
	for (let i = 0; i < s.n; i++) sum += x[i] * x[i] + y[i] * y[i];
	return Math.sqrt(sum / s.n);
}

/** Expected rms distance from the corner while the far walls don't matter: √(r₀²/2 + 4Dt). */
export const rmsTheory = (D: number, t: number) => Math.sqrt((DROP.r * DROP.r) / 2 + 4 * D * t);

/** Share of the walkers in each of `bins` vertical slices of the box, frame k. */
export function profile(s: Walkers, k: number, bins: number) {
	const out = new Array<number>(bins).fill(0);
	const x = s.xs[k];
	for (let i = 0; i < s.n; i++) out[Math.min(bins - 1, Math.floor((x[i] / s.w) * bins))]++;
	return out.map((c) => c / s.n);
}

// ------------------------------------------------------------------------------- osmosis
/** Temperature of the osmosis and cell experiments, K (20 °C). */
export const T_LAB = 20 + K0;

/** Van 't Hoff: osmotic pressure of `mM` millimoles of dissolved particles per litre, Pa. */
export const vantHoff = (mM: number, T = T_LAB) => mM * R * T;

/** The height of water whose weight presses as hard as `pa` pascals, m. */
export const waterColumn = (pa: number) => pa / RHO_G;

/** The tank: two columns of equal width, each filled to H0 at the start. */
export const TANK = {
	/** Starting height of each column, m. */
	h0: 0.3,
	/** Height of the tank's walls, m. */
	top: 0.75,
	/** Water flow per pascal of net push, m/s per Pa (the page's choice: levels settle in ~10 s). */
	lp: 1 / (2 * 4 * RHO_G)
} as const;

export interface TankState {
	t: number;
	/** Water heights of the left and right columns, m. */
	hL: number;
	hR: number;
	/** Sugar concentrations now, mM. */
	cL: number;
	cR: number;
	/** Water flow from right to left, m/s (negative: left to right). */
	flow: number;
	/** The push of the trapped sugar (ΠL − ΠR), the weight of the extra height, and the press, Pa. */
	osmotic: number;
	hydro: number;
	press: number;
}

/**
 * Two columns joined by a membrane at the bottom that passes water only. `cL`, `cR`: sugar at
 * the start, mM; `press`: an extra pressure on the left column (a piston), Pa, which may change
 * mid-run (`setPress`). Integrated lazily with small time steps.
 */
export class Tank {
	private nL: number;
	private nR: number;
	private states: TankState[] = [];
	private press: number;
	private readonly dt = 0.01;

	constructor(cL: number, cR: number, press = 0) {
		this.nL = cL * TANK.h0;
		this.nR = cR * TANK.h0;
		this.press = press;
		this.states.push(this.state(0, TANK.h0, TANK.h0));
	}

	private state(t: number, hL: number, hR: number): TankState {
		const cL = this.nL / hL;
		const cR = this.nR / hR;
		const osmotic = vantHoff(cL) - vantHoff(cR);
		const hydro = RHO_G * (hL - hR);
		const flow = TANK.lp * (osmotic - hydro - this.press);
		return { t, hL, hR, cL, cR, flow, osmotic, hydro, press: this.press };
	}

	setPress(p: number) {
		this.press = p;
	}

	/** The state at time t (s); t never runs backwards within one tank. */
	at(t: number): TankState {
		let s = this.states[this.states.length - 1];
		while (s.t < t - 1e-9) {
			const h = Math.min(this.dt, t - s.t);
			// midpoint step
			const mid = this.state(s.t, s.hL + (s.flow * h) / 2, s.hR - (s.flow * h) / 2);
			const hL = Math.max(0.01, s.hL + mid.flow * h);
			const hR = Math.max(0.01, 2 * TANK.h0 - hL);
			s = this.state(s.t + h, hL, hR);
		}
		this.states = [s];
		return s;
	}

	/** The settled state: run until the flow stops. */
	settled(): TankState {
		let s = this.at(0);
		for (let i = 0; i < 2000 && (i < 5 || Math.abs(s.flow) > 1e-9); i++) s = this.at(s.t + 1);
		return s;
	}
}

// ------------------------------------------------------------------------------- cells
/** Osmolality of blood plasma and of the inside of a red blood cell, mOsm per kg of water. */
export const PLASMA_OSM = 290;

/**
 * Dissolved particles in a salt solution of `percent` g NaCl per 100 mL, mOsm: two ions per
 * NaCl, with an osmotic coefficient of 0.93 (0.9 % saline → 286 mOsm, isotonic with blood).
 */
export const saltOsm = (percent: number) => ((percent * 10) / 58.44) * 2 * 0.93 * 1000;

/** Dissolved particles in `molar` mol/L of sucrose, mOsm (ideal). */
export const sugarOsm = (molar: number) => molar * 1000;

export const RBC = {
	/** Normal volume, fL (BioNumbers 101711). */
	v0: 90,
	/** Membrane area, µm²: the membrane hardly stretches (BioNumbers 101711). */
	area: 140,
	/** Osmotically inactive fraction of the normal volume (LeFevre 1964). */
	b: 0.4
} as const;

/** The largest volume a membrane of RBC.area can enclose (a sphere), fL. */
export const RBC_MAX = RBC.area ** 1.5 / (6 * Math.sqrt(Math.PI));

/** A red blood cell's volume relative to normal in a solution of `osm` mOsm (no wall). */
export const rbcVolume = (osm: number) => RBC.b + ((1 - RBC.b) * PLASMA_OSM) / Math.max(osm, 1e-6);

/** Whether the cell bursts: it would need more volume than a sphere of its membrane holds. */
export const rbcBursts = (osm: number) => rbcVolume(osm) * RBC.v0 > RBC_MAX;

/**
 * An illustrative potato cell (the page's own numbers, not a measurement): in its fresh state
 * (volume 1) its sap holds PI0 of dissolved particles and its wall presses back with P0, so it is
 * in balance with a solution of PI0 − P0 ≈ 0.74 MPa, which sucrose gives at about 0.3 mol/L, the
 * middle of the zero-change points that classroom potato experiments find (about 0.2–0.4 mol/L).
 * The wall's elastic modulus EPS sets how steeply turgor rises once the protoplast presses on
 * it; B is the volume that takes no part (starch, cytoplasm solids, the wall).
 */
export const POTATO = {
	/** Osmotic pressure of the sap in the fresh cell, MPa. */
	pi0: 1.0,
	/** Turgor pressure of the fresh cell, MPa. */
	p0: 0.26,
	/** Volumetric elastic modulus of the wall, MPa. */
	eps: 5,
	/** Osmotically inactive fraction. */
	b: 0.4
} as const;

/** Osmotic pressure of a solution of `osm` mOsm at 20 °C, MPa. */
export const osmMPa = (osm: number) => vantHoff(osm) / 1e6;

/** The volume at which the protoplast just touches the wall (zero turgor). */
export const POTATO_TOUCH = 1 - POTATO.p0 / POTATO.eps;

export interface PlantCell {
	/** Volume relative to the fresh cell. */
	v: number;
	/** Turgor pressure, MPa (0: plasmolysed or limp). */
	turgor: number;
	/** Osmotic pressure of the sap, MPa. */
	sap: number;
}

/** The potato cell's balance in a solution of `osm` mOsm: sap − turgor = outside. */
export function potatoCell(osm: number): PlantCell {
	const out = osmMPa(osm);
	const sap = (v: number) => (POTATO.pi0 * (1 - POTATO.b)) / (v - POTATO.b);
	const turgor = (v: number) => Math.max(0, (POTATO.eps * (v - POTATO_TOUCH)) / POTATO_TOUCH);
	let lo = POTATO.b + 1e-6;
	let hi = 3;
	for (let i = 0; i < 80; i++) {
		const v = (lo + hi) / 2;
		if (sap(v) - turgor(v) > out) lo = v;
		else hi = v;
	}
	const v = (lo + hi) / 2;
	return { v, turgor: turgor(v), sap: sap(v) };
}

// ------------------------------------------------------------------------------- the pump
/** The pump box: a membrane down the middle, outside on the left, inside the cell on the right. */
export const PUMP_BOX = {
	w: 100,
	h: 60,
	n: 120,
	D: 300,
	/** The leak channel and the pump's mouth along the membrane, µm. */
	pore: [12, 15] as [number, number],
	pump: [36, 48] as [number, number],
	/** ATP in the store when full. */
	atp: 160
};

/** Particles spread evenly over both sides, and a pump with a full ATP store. */
export function pumpBox(seed = 3) {
	const b = PUMP_BOX;
	return new Walkers({
		n: b.n,
		w: b.w,
		h: b.h,
		D: b.D,
		seed,
		atp: b.atp,
		membrane: { x: b.w / 2, pores: [b.pore], pump: b.pump },
		start: (_, r) => [r() * b.w, r() * b.h]
	});
}

/** Free energy released by one mole of ATP splitting in a cell, J/mol (about 50 kJ). */
export const ATP_ENERGY = 50e3;

/** Least work to move one mole of particles from `cLow` up to `cHigh`, J/mol, at 37 °C. */
export const gradientWork = (cLow: number, cHigh: number, T = 37 + K0) =>
	R * T * Math.log(cHigh / cLow);
