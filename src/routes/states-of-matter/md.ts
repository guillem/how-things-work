/**
 * A box of simulated molecules: 2D molecular dynamics under a piston.
 *
 * Two kinds of molecule, in reduced units (energy, length and mass of the
 * model set to 1; temperature T* = k_B·T / ε, pressure P* = P·σ² / ε, since in
 * 2D a pressure is a force per length):
 *
 *   - 'lj' — round molecules with the Lennard-Jones pair energy
 *     U(r) = 4ε[(σ/r)¹² − (σ/r)⁶]: a steep repulsion when they overlap, a weak
 *     attraction a little further out (cut off at 2.5σ). The classic model of
 *     a simple substance (Rahman 1964, Verlet 1967). Here it stands in for
 *     carbon dioxide, drawn as round molecules.
 *   - 'mb' — the "Mercedes-Benz" model of water (Ben-Naim, J. Chem. Phys. 54,
 *     3682, 1971; Silverstein, Haymet & Dill, J. Am. Chem. Soc. 120, 3166,
 *     1998): discs with a weak Lennard-Jones attraction (ε_LJ = 0.1, σ_LJ = 0.7)
 *     and three hydrogen-bonding arms 120° apart. Two molecules form a
 *     hydrogen bond (energy ε_HB = −1) when they are r_HB = 1 apart and an arm
 *     of each points at the other:
 *       U_HB = ε_HB G(r − r_HB) Σ_k,l G(i_k·u − 1) G(j_l·u + 1),
 *       G(x) = exp(−x² / 2σ²), σ = 0.085.
 *     The bonds hold the molecules in an open honeycomb (2D ice) that takes
 *     more room than the liquid, like real ice. Units: ε = |ε_HB|, σ = r_HB.
 *
 * The box: hard side walls and floor, and a piston on top pushed down by the
 * set pressure (a force P*·width) and carrying a small weight. The piston
 * rests against a stop at the top of the box, so a gas at low pressure fills
 * the box. A weak gravity pulls the molecules down, so a liquid collects at
 * the bottom instead of floating as a drop. Walls repel with the repulsive
 * part of the Lennard-Jones energy (the WCA wall).
 *
 * Temperature is held by a Berendsen thermostat (velocities rescaled a little
 * at each step towards the set temperature, separately for spinning in 'mb'),
 * which keeps the run deterministic: the same start and the same history of
 * set points give the same frames. Integration is velocity Verlet with
 * 16 steps of 0.005 time units per recorded frame (60 frames per second of
 * animation).
 *
 * Freezing water takes a long time in a computer: a liquid has to wait for a
 * small crystal to form by chance (real water usually starts on a speck of dust
 * or a scratch). The 'mb' liquid cools into a disordered glass instead. So when
 * water is set to a solid state while it is still disordered, the run takes a
 * shortcut, stated on the page: over two seconds the molecules glide to the
 * nearest sites of the ice lattice, and the simulation carries on from there.
 */
import { rng } from '#lib/draw/math.ts';

export type Model = 'lj' | 'mb';
export type Start = 'solid' | 'liquid' | 'gas';

export interface Setpoint {
	/** Temperature, reduced units. */
	T: number;
	/** Pressure on the piston, reduced units. */
	P: number;
	/** The set state is solid (water freezes by the lattice shortcut). */
	solid: boolean;
}

interface ModelSpec {
	/** Box width and the piston's highest position. */
	width: number;
	height: number;
	/** Gravity (acceleration). */
	g: number;
	/** Columns × rows of the starting lattice. */
	cols: number;
	rows: number;
	/** Distance at which the walls stop pushing (2^(1/6) σ). */
	wallRange: number;
	/** Neighbours closer than this count for the order parameter. */
	neighbour: number;
}

const SQRT3 = Math.sqrt(3);
/** Nearest-neighbour distance in the LJ starting lattice (close to the 2D crystal's). */
const LJ_A = 1.1;

export const MODELS: Record<Model, ModelSpec> = {
	lj: {
		width: 14.9,
		height: 22,
		g: 0.01,
		cols: 12,
		rows: 7,
		wallRange: 2 ** (1 / 6),
		neighbour: 1.45
	},
	mb: {
		width: 8 * SQRT3 + 1,
		height: 22,
		g: 0.002,
		cols: 8,
		rows: 5,
		wallRange: 0.7 * 2 ** (1 / 6),
		neighbour: 1.25
	}
};

/** Number of molecules (80 in both models; the LJ lattice is 12 × 7 with the last row short). */
const N = 80;

export const FPS = 60;
const STEPS_PER_FRAME = 16;
const DT = 0.005;
/** Piston mass and the fraction of its speed kept per step (damps its bouncing). */
const PISTON_MASS = 4;
const PISTON_KEEP = 0.998;
/** Thermostat time constant (reduced time units). */
const TAU_T = 0.5;
/** Frames the freezing shortcut takes. */
export const FREEZE_FRAMES = 2 * FPS;

// Mercedes-Benz parameters (Silverstein, Haymet & Dill 1998)
const EPS_HB = -1;
const R_HB = 1;
const SIG_HB = 0.085;
const EPS_LJ_MB = 0.1;
const SIG_LJ_MB = 0.7;
/** Moment of inertia of a water disc (mass 1): spinning sets the arms' directions. */
const INERTIA = 0.1;
const ARMS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
/** Pairs further apart than this have no hydrogen bond (G(0.45) ≈ 10⁻⁶). */
const HB_CUT = 1.45;
/** A hydrogen bond counts as formed when its energy is below this (ε_HB / 2). */
const HB_FORMED = -0.5;
const gauss = (x: number) => Math.exp(-(x * x) / (2 * SIG_HB * SIG_HB));

/** One recorded frame. */
export interface Frame {
	x: Float32Array;
	y: Float32Array;
	/** Direction of the first arm (water only). */
	phi: Float32Array;
	/** Piston height (its lower face). */
	piston: number;
	/** Mean kinetic energy per molecule (translation), reduced units. */
	kinetic: number;
	/** 0–1 progress of the freezing shortcut, or -1 when not freezing. */
	freezing: number;
}

/** Measured quantities of a frame. */
interface FrameStats {
	/** Fraction of molecules sitting in an ordered, crystal-like neighbourhood. */
	order: number;
	/** Fraction of molecules with at most one neighbour (flying free). */
	free: number;
	/** Area per molecule of the condensed part (box area below the highest bonded molecule ÷ count). */
	areaPerMolecule: number;
	/** Hydrogen bonds per molecule (water). */
	bonds: number;
}

/** Starting positions on the model's lattice: triangular (LJ) or honeycomb (water). */
export function lattice(model: Model) {
	const m = MODELS[model];
	const x: number[] = [];
	const y: number[] = [];
	const phi: number[] = [];
	if (model === 'lj') {
		const h = (LJ_A * SQRT3) / 2;
		for (let i = 0; i < N; i++) {
			const row = Math.floor(i / m.cols);
			const c = i % m.cols;
			x.push(1.15 + c * LJ_A + (row % 2) * (LJ_A / 2));
			y.push(1.12 + row * h);
			phi.push(0);
		}
	} else {
		// Honeycomb with bond length r_HB: molecule A at the bottom of a vertical
		// bond with an arm pointing up, B at its top with an arm pointing down;
		// alternate rows shifted by half a cell.
		for (let row = 0; row < m.rows; row++)
			for (let c = 0; c < m.cols; c++) {
				const x0 = 0.8 + c * SQRT3 + (row % 2) * (SQRT3 / 2);
				const y0 = 0.79 + row * 1.5;
				x.push(x0, x0);
				y.push(y0, y0 + R_HB);
				phi.push(Math.PI / 2, -Math.PI / 2);
			}
	}
	return { x, y, phi };
}

/**
 * One run of the box, computed lazily: `frame(i)` integrates as far as needed.
 * `set()` changes the set point from the next frame to be computed on.
 */
export class BoxRun {
	readonly model: Model;
	readonly spec: ModelSpec;
	private sp: Setpoint;
	private readonly x = new Float64Array(N);
	private readonly y = new Float64Array(N);
	private readonly vx = new Float64Array(N);
	private readonly vy = new Float64Array(N);
	private readonly phi = new Float64Array(N);
	private readonly om = new Float64Array(N);
	private readonly ax = new Float64Array(N);
	private readonly ay = new Float64Array(N);
	private readonly al = new Float64Array(N);
	private yp: number;
	private vp = 0;
	private ap = 0;
	private frames: Frame[] = [];
	/** Index of frames[0] (old frames are dropped to save memory). */
	private first = 0;
	private freezeFrom: { x: number[]; y: number[]; phi: number[]; yp: number } | null = null;
	private freezeTo: { x: number[]; y: number[]; phi: number[]; yp: number } | null = null;
	private freezeStep = -1;

	constructor(model: Model, start: Start, sp: Setpoint, seed = 1) {
		this.model = model;
		this.spec = MODELS[model];
		this.sp = { ...sp };
		const rand = rng(seed * 7919 + (model === 'mb' ? 17 : 3));
		const L = lattice(model);
		const T0 =
			start === 'solid'
				? sp.T
				: start === 'gas'
					? model === 'mb'
						? 0.45
						: 1
					: model === 'mb'
						? 0.24
						: 0.45;
		for (let i = 0; i < N; i++) {
			this.x[i] = L.x[i];
			this.y[i] = L.y[i];
			this.phi[i] = L.phi[i];
			if (start === 'gas') {
				// spread over the whole box on a coarse grid
				const cols = 8;
				this.x[i] = 0.9 + (i % cols) * ((this.spec.width - 1.8) / (cols - 1));
				this.y[i] = 0.9 + Math.floor(i / cols) * ((this.spec.height - 2) / (N / cols));
				this.phi[i] = rand() * 2 * Math.PI;
			}
		}
		for (let i = 0; i < N; i++) {
			const s = Math.sqrt(T0);
			this.vx[i] = (rand() * 2 - 1) * s * 1.2;
			this.vy[i] = (rand() * 2 - 1) * s * 1.2;
			this.om[i] = (rand() * 2 - 1) * s * 1.2 * Math.sqrt(1 / INERTIA);
		}
		this.yp = start === 'gas' ? this.spec.height : this.latticeTop();
		this.forces();
		// Pre-equilibrate: a liquid start melts the lattice hot, then settles at the
		// set point; every start then runs a moment at the set point.
		if (start === 'liquid') {
			const hot = { ...sp, T: T0, P: Math.max(sp.P, model === 'mb' ? 0.19 : 0.3) };
			this.sp = hot;
			for (let s = 0; s < (model === 'mb' ? 5000 : 3000); s++) this.advance();
			this.sp = { ...sp };
		}
		for (let s = 0; s < 600; s++) this.advance();
		this.record();
	}

	/** Height of the piston resting on the starting lattice. */
	private latticeTop() {
		const L = lattice(this.model);
		return Math.max(...L.y) + this.spec.wallRange;
	}

	/** Changes the set point from the next frame to be computed. */
	set(sp: Setpoint) {
		const wasSolid = this.sp.solid;
		this.sp = { ...sp };
		if (this.model === 'mb' && sp.solid && !wasSolid && this.freezeStep < 0) {
			if (stats(this, this.last).order < 0.6) this.startFreeze();
		}
	}

	get setpoint(): Setpoint {
		return this.sp;
	}

	/** Frames computed so far. */
	get computed() {
		return this.first + this.frames.length;
	}

	private get last() {
		return this.frames[this.frames.length - 1];
	}

	/** The frame at index i (frames are 1/FPS apart); integrates as needed. */
	frame(i: number): Frame {
		i = Math.max(0, Math.floor(i));
		while (this.computed <= i) {
			if (this.freezeStep >= 0) this.freezeFrame();
			else for (let s = 0; s < STEPS_PER_FRAME; s++) this.advance();
			this.record();
		}
		return this.frames[Math.max(0, i - this.first)];
	}

	private record() {
		let ke = 0;
		for (let i = 0; i < N; i++) ke += 0.5 * (this.vx[i] ** 2 + this.vy[i] ** 2);
		this.frames.push({
			x: Float32Array.from(this.x),
			y: Float32Array.from(this.y),
			phi: Float32Array.from(this.phi),
			piston: this.yp,
			kinetic: ke / N,
			freezing: this.freezeStep >= 0 ? this.freezeStep / FREEZE_FRAMES : -1
		});
		// keep the last few seconds only
		if (this.frames.length > 8 * FPS) {
			this.frames.splice(0, FPS);
			this.first += FPS;
		}
	}

	// ---------------------------------------------------------------- freezing shortcut

	private startFreeze() {
		const L = lattice(this.model);
		// Assign molecules to lattice sites, lowest molecules first, each to the
		// nearest free site: the bottom of the liquid becomes the bottom of the ice.
		const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => this.y[a] - this.y[b]);
		const taken = new Array<boolean>(N).fill(false);
		const to = { x: new Array<number>(N), y: new Array<number>(N), phi: new Array<number>(N) };
		for (const i of order) {
			let best = -1;
			let bd = Infinity;
			for (let s = 0; s < N; s++) {
				if (taken[s]) continue;
				const d = (L.x[s] - this.x[i]) ** 2 + (L.y[s] - this.y[i]) ** 2;
				if (d < bd) {
					bd = d;
					best = s;
				}
			}
			taken[best] = true;
			to.x[i] = L.x[best];
			to.y[i] = L.y[best];
			// arms repeat every 120°: turn the shortest way
			const third = (2 * Math.PI) / 3;
			let d = (L.phi[best] - this.phi[i]) % third;
			if (d > third / 2) d -= third;
			if (d < -third / 2) d += third;
			to.phi[i] = this.phi[i] + d;
		}
		this.freezeFrom = { x: [...this.x], y: [...this.y], phi: [...this.phi], yp: this.yp };
		this.freezeTo = { ...to, yp: this.latticeTop() };
		this.freezeStep = 0;
	}

	private freezeFrame() {
		const from = this.freezeFrom!;
		const to = this.freezeTo!;
		this.freezeStep++;
		const u = this.freezeStep / FREEZE_FRAMES;
		const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
		for (let i = 0; i < N; i++) {
			this.x[i] = from.x[i] + (to.x[i] - from.x[i]) * e;
			this.y[i] = from.y[i] + (to.y[i] - from.y[i]) * e;
			this.phi[i] = from.phi[i] + (to.phi[i] - from.phi[i]) * e;
		}
		this.yp = from.yp + (to.yp - from.yp) * e;
		if (this.freezeStep >= FREEZE_FRAMES) {
			// carry on from the lattice, with thermal velocities at the set temperature
			const rand = rng(7 + this.computed);
			const s = Math.sqrt(this.sp.T);
			for (let i = 0; i < N; i++) {
				this.vx[i] = (rand() * 2 - 1) * s;
				this.vy[i] = (rand() * 2 - 1) * s;
				this.om[i] = (rand() * 2 - 1) * s * Math.sqrt(1 / INERTIA);
			}
			this.vp = 0;
			this.freezeStep = -1;
			this.freezeFrom = this.freezeTo = null;
			this.forces();
		}
	}

	// ---------------------------------------------------------------- dynamics

	/** Repulsive wall force at distance d (WCA), with the model's σ and an ε of 1. */
	private wall(d: number) {
		const range = this.spec.wallRange;
		if (d >= range) return 0;
		const sig = this.model === 'mb' ? SIG_LJ_MB : 1;
		d = Math.max(d, 0.8 * sig);
		const s6 = (sig / d) ** 6;
		return (24 * (2 * s6 * s6 - s6)) / d;
	}

	private forces() {
		const { x, y, ax, ay, al, phi } = this;
		const { width, g } = this.spec;
		const mb = this.model === 'mb';
		const sig2 = mb ? SIG_LJ_MB * SIG_LJ_MB : 1;
		const eps = mb ? EPS_LJ_MB : 1;
		const rc = 2.5 * (mb ? SIG_LJ_MB : 1);
		const cut2 = Math.max(rc, mb ? HB_CUT : 0) ** 2;
		ax.fill(0);
		ay.fill(-g);
		al.fill(0);
		let onPiston = 0;
		for (let i = 0; i < N; i++) {
			ax[i] += this.wall(x[i]) - this.wall(width - x[i]);
			ay[i] += this.wall(y[i]);
			const fp = this.wall(this.yp - y[i]);
			ay[i] -= fp;
			onPiston += fp;
			for (let j = i + 1; j < N; j++) {
				const dx = x[j] - x[i];
				if (dx * dx > cut2) continue;
				const dy = y[j] - y[i];
				const d2 = dx * dx + dy * dy;
				if (d2 > cut2) continue;
				const d = Math.sqrt(d2);
				const ux = dx / d;
				const uy = dy / d;
				// radial force on j (−dU/dr), the same and opposite on i
				let fr = 0;
				if (d < rc) {
					const s2 = sig2 / d2;
					const s6 = s2 * s2 * s2;
					fr += (24 * eps * (2 * s6 * s6 - s6)) / d;
				}
				if (mb && d < HB_CUT) {
					const th = Math.atan2(dy, dx);
					let S = 0;
					let dSi = 0;
					let dSj = 0;
					for (let a = 0; a < 3; a++) {
						const ci = Math.cos(phi[i] + ARMS[a] - th);
						const gi = gauss(ci - 1);
						if (gi < 1e-9) continue;
						const si = Math.sin(phi[i] + ARMS[a] - th);
						for (let b = 0; b < 3; b++) {
							const cj = Math.cos(phi[j] + ARMS[b] - th);
							const gj = gauss(cj + 1);
							if (gj < 1e-9) continue;
							const sj = Math.sin(phi[j] + ARMS[b] - th);
							const k = 1 / (SIG_HB * SIG_HB);
							S += gi * gj;
							dSi += gi * gj * (ci - 1) * k * si;
							dSj += gi * gj * (cj + 1) * k * sj;
						}
					}
					if (S > 0) {
						const gr = gauss(d - R_HB);
						const dUdr = EPS_HB * (-(d - R_HB) / (SIG_HB * SIG_HB)) * gr * S;
						const dUdi = EPS_HB * gr * dSi;
						const dUdj = EPS_HB * gr * dSj;
						fr -= dUdr;
						// U depends on the bond direction θ through φ − θ: ∂U/∂θ = −(∂U/∂φi + ∂U/∂φj)
						const ft = (dUdi + dUdj) / d;
						ax[j] -= ft * uy;
						ay[j] += ft * ux;
						ax[i] += ft * uy;
						ay[i] -= ft * ux;
						al[i] -= dUdi / INERTIA;
						al[j] -= dUdj / INERTIA;
					}
				}
				ax[j] += fr * ux;
				ay[j] += fr * uy;
				ax[i] -= fr * ux;
				ay[i] -= fr * uy;
			}
		}
		this.ap = (onPiston - this.sp.P * width) / PISTON_MASS - g;
	}

	private advance() {
		const { x, y, vx, vy, ax, ay, phi, om, al } = this;
		const h = DT / 2;
		for (let i = 0; i < N; i++) {
			vx[i] += h * ax[i];
			vy[i] += h * ay[i];
			om[i] += h * al[i];
			x[i] += DT * vx[i];
			y[i] += DT * vy[i];
			phi[i] += DT * om[i];
		}
		this.vp += h * this.ap;
		this.yp += DT * this.vp;
		if (this.yp > this.spec.height) {
			this.yp = this.spec.height;
			this.vp = Math.min(0, this.vp);
		}
		this.forces();
		let ke = 0;
		let kr = 0;
		for (let i = 0; i < N; i++) {
			vx[i] += h * ax[i];
			vy[i] += h * ay[i];
			om[i] += h * al[i];
			ke += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
			kr += 0.5 * INERTIA * om[i] * om[i];
		}
		this.vp = (this.vp + h * this.ap) * PISTON_KEEP;
		// Berendsen thermostat: in 2D the mean translational kinetic energy is k_B·T
		const T = this.sp.T;
		const lt = Math.sqrt(Math.max(0.5, 1 + (DT / TAU_T) * (T / Math.max(ke / N, 1e-9) - 1)));
		const lr =
			this.model === 'mb'
				? Math.sqrt(Math.max(0.5, 1 + (DT / TAU_T) * (T / Math.max((2 * kr) / N, 1e-9) - 1)))
				: 1;
		for (let i = 0; i < N; i++) {
			vx[i] *= lt;
			vy[i] *= lt;
			om[i] *= lr;
		}
	}
}

// ------------------------------------------------------------------ measuring a frame

/** Hydrogen-bond energy between molecules i and j of a water frame. */
function bondEnergy(f: Frame, i: number, j: number): number {
	const dx = f.x[j] - f.x[i];
	const dy = f.y[j] - f.y[i];
	const d = Math.hypot(dx, dy);
	if (d >= HB_CUT) return 0;
	const th = Math.atan2(dy, dx);
	let S = 0;
	for (let a = 0; a < 3; a++)
		for (let b = 0; b < 3; b++)
			S +=
				gauss(Math.cos(f.phi[i] + ARMS[a] - th) - 1) * gauss(Math.cos(f.phi[j] + ARMS[b] - th) + 1);
	return EPS_HB * gauss(d - R_HB) * S;
}

/** Pairs (i, j) of a water frame joined by a hydrogen bond. */
export function bondPairs(f: Frame): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < N; i++)
		for (let j = i + 1; j < N; j++) {
			const dx = f.x[j] - f.x[i];
			if (dx > HB_CUT || dx < -HB_CUT) continue;
			if (bondEnergy(f, i, j) < HB_FORMED) out.push([i, j]);
		}
	return out;
}

/**
 * The order parameter and density of a frame. A molecule is "ordered" when
 * its neighbours sit at the angles of the crystal: six at 60° steps for the
 * round molecules (bond-orientational order |ψ₆| > 0.7 with at least four
 * neighbours), three at 120° steps for water (|ψ₃| > 0.8 with exactly three).
 */
export function stats(run: { model: Model; spec: ModelSpec }, f: Frame): FrameStats {
	const { model, spec } = run;
	const nOrder = model === 'mb' ? 3 : 6;
	let ordered = 0;
	let free = 0;
	let top = 0;
	let inCondensed = 0;
	for (let i = 0; i < N; i++) {
		let re = 0;
		let im = 0;
		let k = 0;
		for (let j = 0; j < N; j++) {
			if (j === i) continue;
			const dx = f.x[j] - f.x[i];
			const dy = f.y[j] - f.y[i];
			if (dx * dx + dy * dy >= spec.neighbour * spec.neighbour) continue;
			const th = Math.atan2(dy, dx);
			re += Math.cos(nOrder * th);
			im += Math.sin(nOrder * th);
			k++;
		}
		const psi = k ? Math.hypot(re, im) / k : 0;
		if (model === 'mb' ? k === 3 && psi > 0.8 : k >= 4 && psi > 0.7) ordered++;
		if (k <= 1) free++;
		else {
			inCondensed++;
			top = Math.max(top, f.y[i]);
		}
	}
	const bonds = model === 'mb' ? (2 * bondPairs(f).length) / N : 0;
	return {
		order: ordered / N,
		free: free / N,
		areaPerMolecule: inCondensed ? (spec.width * (top + 0.5)) / inCondensed : Infinity,
		bonds
	};
}
