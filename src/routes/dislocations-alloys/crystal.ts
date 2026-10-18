/**
 * A flat crystal of simulated atoms, sheared between two grips: 2D molecular
 * dynamics of a Lennard-Jones solid with or without edge dislocations.
 *
 * Reduced units: the depth ε of the pair energy, the atom size σ and the mass
 * are 1. Atoms interact with the Lennard-Jones energy
 *   U(r) = 4ε[(σ/r)¹² − (σ/r)⁶], cut off at 2.5σ,
 * the classic model of a simple solid (in 2D it crystallises in a triangular
 * lattice, nearest neighbours a ≈ 1.11σ apart). Foreign atoms (solutes) have a
 * different size σ_s, and a pair uses the mean of the two sizes
 * (Lorentz–Berthelot). The hard particle (the obstacle) is a cluster of atoms
 * that moves as one rigid body: it can be pushed and turned, but not sheared,
 * so a dislocation cannot cut through it.
 *
 * The box is periodic left to right, with close-packed rows horizontal, so
 * the slip plane is the horizontal line between the two middle rows. The
 * bottom two rows are held still and the top two rows are a rigid grip that
 * moves sideways at a steady rate: the crystal is sheared at a set rate
 * (displacement control, like a testing machine). The stress is the sideways
 * force the atoms exert on the top grip divided by the box's width (in 2D a
 * stress is a force per length). The shear strain is the grip's displacement
 * divided by the height between the grips.
 *
 * An edge dislocation is an extra half-plane of atoms: the rows above the slip
 * plane hold one atom more than those below (N + 1 against N), the way
 * Osetsky & Bacon (Model. Simul. Mater. Sci. Eng. 11, 427, 2003) build a
 * periodic box with one dislocation; the halves are squeezed and stretched by
 * ±b/2W to share the width W, and the misfit gathers into one core, set where
 * the page wants it by the starting positions and a relaxation.
 *
 * The run is at zero temperature: velocity Verlet with a viscous damping
 * that removes the heat of slip, so it is deterministic and every jump of the
 * stress is a mechanical event, not a thermal fluctuation. A crystal that
 * holds nothing back (no dislocation) holds to its ideal shear strength and
 * then slips a whole plane at once.
 */
import { rng } from '#lib/draw/math.ts';

/** Nearest-neighbour distance of the relaxed 2D crystal (LJ cut at 2.5σ, zero stress). */
export const A0 = 1.1115;
const SQRT3 = Math.sqrt(3);
const RC = 2.5;
/** Neighbour-list skin. */
const SKIN = 0.35;
export const FPS = 60;
const DT = 0.01;
/** Time over which the grip speeds up to its rate. */
const START = 5;

/** What fills a crystal. */
export interface CrystalSpec {
	/** Atoms per row below the slip plane. */
	cols: number;
	/** Rows of atoms, including two grip rows at the bottom and two at the top. */
	rows: number;
	/** Edge dislocations on the slip plane (extra half-planes), 0 to 3. */
	dislocations: number;
	/**
	 * Shifts the whole crystal sideways by this fraction of the width. The grips set
	 * where the cores sit (one at the middle, or several evenly spaced); this moves them.
	 */
	offset?: number;
	/** Viscous damping rate of the atoms (per time unit). */
	damping?: number;
	/** Size of the foreign atoms relative to the host (1: none). */
	soluteSize?: number;
	/** Fraction of the mobile atoms within `soluteBand` rows of the slip plane that are foreign. */
	soluteFraction?: number;
	soluteBand?: number;
	/** A hard particle across the slip plane, at this fraction of the width. */
	obstacle?: number;
	/** Shear strain per unit time of the grip. */
	rate: number;
	/** Integration steps per recorded frame. */
	stepsPerFrame?: number;
	seed?: number;
}

/** Atom roles. */
export const BOTTOM = 0;
export const MOBILE = 1;
export const TOP = 2;

/** One recorded frame. */
export interface Frame {
	x: Float32Array;
	y: Float32Array;
	/** Shear stress on the grip (reduced units, ε/σ²). */
	stress: number;
	/** Shear strain (grip displacement ÷ height between the grips). */
	strain: number;
}

export class Crystal {
	readonly spec: Required<CrystalSpec>;
	readonly n: number;
	/** Box width (periodic). */
	readonly width: number;
	/** Height of the slip plane (between rows `slipRow − 1` and `slipRow`). */
	readonly slipY: number;
	readonly slipRow: number;
	/** Height between the grips (centre of the top grip rows' lowest row minus bottom's highest). */
	readonly gauge: number;
	readonly role: Uint8Array;
	readonly row: Uint8Array;
	/** Atom size σ_i. */
	readonly sigma: Float64Array;
	/** 1 for an atom of the hard particle. */
	readonly hard: Uint8Array;
	readonly x: Float64Array;
	readonly y: Float64Array;
	private readonly vx: Float64Array;
	private readonly vy: Float64Array;
	private readonly fx: Float64Array;
	private readonly fy: Float64Array;
	/** Top grip atoms' positions at zero displacement. */
	private readonly x0: Float64Array;
	private grip = 0;
	/** The hard particle as a rigid body: its atoms, their offsets from its centre, its motion. */
	private readonly body = {
		atoms: [] as number[],
		ox: [] as number[],
		oy: [] as number[],
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		th: 0,
		om: 0,
		fx: 0,
		fy: 0,
		torque: 0,
		inertia: 1
	};
	private gripForce = 0;
	/** Grip force summed over the steps of the frame being computed (the gauge averages it). */
	private forceSum = 0;
	private forceCount = 0;
	private time = 0;
	private nbr: Int32Array = new Int32Array(0);
	private nbrStart: Int32Array;
	private xList: Float64Array;
	private yList: Float64Array;
	private frames: Frame[] = [];
	private first = 0;
	/** Stress and strain of every frame (kept for the whole run: the curve). */
	readonly curve: { stress: number[]; strain: number[] } = { stress: [], strain: [] };

	constructor(spec: CrystalSpec) {
		this.spec = {
			offset: 0,
			damping: 0.5,
			soluteSize: 1,
			soluteFraction: 0,
			soluteBand: 3,
			obstacle: -1,
			stepsPerFrame: 20,
			seed: 1,
			...spec
		};
		const { cols, rows, dislocations } = this.spec;
		const h = (A0 * SQRT3) / 2;
		this.slipRow = rows / 2;
		// lower half N atoms per row, upper half N + d; the width splits the misfit
		this.width = (cols + dislocations / 2) * A0;
		const W = this.width;
		const aL = W / cols;
		const aU = W / (cols + dislocations);
		this.slipY = (this.slipRow - 0.5) * h;
		const xs: number[] = [];
		const ys: number[] = [];
		const roles: number[] = [];
		const rowOf: number[] = [];
		const cores = Array.from({ length: dislocations }, (_, k) => ((k + 0.5) * W) / dislocations);
		for (let j = 0; j < rows; j++) {
			const y = j * h;
			const upper = j >= this.slipRow;
			const role = j < 2 ? BOTTOM : j >= rows - 2 ? TOP : MOBILE;
			const shift = j % 2 ? 0.5 : 0;
			if (!upper || dislocations === 0) {
				for (let k = 0; k < cols; k++) {
					xs.push((k + shift) * aL);
					ys.push(y);
					roles.push(role);
					rowOf.push(j);
				}
				continue;
			}
			// Upper rows: N + d atoms. Far from the slip plane (and in the grip) they are
			// evenly spaced; near it the extra half-planes gather at the cores, so the
			// lattice coordinate ξ(x) climbs by one extra atom across each core.
			const dist = (y - this.slipY) / ((rows - 2 - this.slipRow) * h);
			const blend = role === TOP ? 1 : Math.min(1, Math.max(0, dist));
			const w = 1.5 + 4 * dist;
			const xi = (x: number) => {
				let s = x / aL;
				for (const c of cores) {
					const dxu = x - c;
					const dxw = dxu - W * Math.round(dxu / W);
					// a smooth step of one extra atom at the core, continued periodically
					s += 0.5 + Math.atan(dxw / w) / Math.PI + (dxu - dxw) / W;
				}
				return (1 - blend) * s + blend * (x / aU);
			};
			// place atom k where ξ − ξ(0) reaches k + shift (ξ climbs by N + d over the width)
			const samples = 4000;
			const base = xi(0);
			let k = 0;
			let prev = 0;
			for (let s = 1; s <= samples && k < cols + dislocations; s++) {
				const v = xi((s / samples) * W) - base;
				while (k < cols + dislocations && v >= k + shift) {
					const u = (k + shift - prev) / Math.max(1e-12, v - prev);
					xs.push(((s - 1 + Math.min(1, Math.max(0, u))) / samples) * W);
					ys.push(y);
					roles.push(role);
					rowOf.push(j);
					k++;
				}
				prev = v;
			}
		}
		const n = xs.length;
		this.n = n;
		this.x = Float64Array.from(xs);
		this.y = Float64Array.from(ys);
		this.role = Uint8Array.from(roles);
		this.row = Uint8Array.from(rowOf);
		this.vx = new Float64Array(n);
		this.vy = new Float64Array(n);
		this.fx = new Float64Array(n);
		this.fy = new Float64Array(n);
		this.sigma = new Float64Array(n).fill(1);
		this.hard = new Uint8Array(n);
		this.nbrStart = new Int32Array(n + 1);
		this.xList = new Float64Array(n);
		this.yList = new Float64Array(n);
		this.gauge = (rows - 3) * h;

		if (this.spec.offset) {
			for (let i = 0; i < n; i++) {
				const nx = this.x[i] + this.spec.offset * W;
				this.x[i] = nx - W * Math.floor(nx / W);
			}
		}

		// foreign atoms, near the slip plane
		const rand = rng(this.spec.seed * 7919 + 13);
		if (this.spec.soluteFraction > 0 && this.spec.soluteSize !== 1) {
			const band = this.spec.soluteBand;
			for (let i = 0; i < n; i++) {
				if (this.role[i] !== MOBILE) continue;
				const r = this.row[i];
				const inBand = r >= this.slipRow - band && r < this.slipRow + band;
				if (inBand && rand() < this.spec.soluteFraction) this.sigma[i] = this.spec.soluteSize;
			}
		}
		// the hard particle: atoms within a few rows of the slip plane near x_obs
		if (this.spec.obstacle >= 0) {
			const xo = this.spec.obstacle * W;
			for (let i = 0; i < n; i++) {
				if (this.role[i] !== MOBILE) continue;
				let dx = this.x[i] - xo;
				dx -= W * Math.round(dx / W);
				if (Math.abs(dx) < 1.3 * A0 && Math.abs(this.y[i] - this.slipY) < 2.6 * h) this.hard[i] = 1;
			}
			const b = this.body;
			for (let i = 0; i < n; i++) if (this.hard[i]) b.atoms.push(i);
			// centre (unwrapped round x_o) and offsets
			const rel = b.atoms.map((i) => {
				const d = this.x[i] - xo;
				return d - W * Math.round(d / W);
			});
			b.x = xo + rel.reduce((sum, d) => sum + d, 0) / rel.length;
			b.y = b.atoms.reduce((sum, i) => sum + this.y[i], 0) / b.atoms.length;
			b.ox = rel.map((d) => xo + d - b.x);
			b.oy = b.atoms.map((i) => this.y[i] - b.y);
			b.inertia = b.ox.reduce((sum, ox, k) => sum + ox * ox + b.oy[k] * b.oy[k], 0);
		}
		this.x0 = Float64Array.from(this.x);
		this.buildList();
		this.forces();
		this.relax(1500);
		this.time = 0;
		this.forceSum = this.gripForce;
		this.forceCount = 1;
		this.record();
	}

	// ---------------------------------------------------------------- neighbours and forces

	private buildList() {
		const { x, y, n, width: W } = this;
		const cut = RC * 1.15 + SKIN;
		const cut2 = cut * cut;
		const list: number[] = [];
		for (let i = 0; i < n; i++) {
			this.nbrStart[i] = list.length;
			for (let j = i + 1; j < n; j++) {
				if (this.role[i] !== MOBILE && this.role[j] !== MOBILE) continue;
				const dy = y[j] - y[i];
				if (dy * dy > cut2) continue;
				let dx = x[j] - x[i];
				dx -= W * Math.round(dx / W);
				if (dx * dx + dy * dy < cut2) list.push(j);
			}
		}
		this.nbrStart[n] = list.length;
		this.nbr = Int32Array.from(list);
		this.xList.set(x);
		this.yList.set(y);
	}

	private maybeRebuild() {
		let m = 0;
		for (let i = 0; i < this.n; i++) {
			// how far each atom moved since the list was built (nearest periodic image)
			const dx0 = this.x[i] - this.xList[i];
			const dx = dx0 - this.width * Math.round(dx0 / this.width);
			const dy = this.y[i] - this.yList[i];
			m = Math.max(m, dx * dx + dy * dy);
		}
		if (m > (SKIN / 2) ** 2) this.buildList();
	}

	private forces() {
		const { x, y, fx, fy, n, sigma, role, nbr, nbrStart, width: W } = this;
		fx.fill(0);
		fy.fill(0);
		let onGrip = 0;
		for (let i = 0; i < n; i++) {
			for (let p = nbrStart[i]; p < nbrStart[i + 1]; p++) {
				const j = nbr[p];
				let dx = x[j] - x[i];
				if (dx > W / 2) dx -= W;
				else if (dx < -W / 2) dx += W;
				const dy = y[j] - y[i];
				const r2 = dx * dx + dy * dy;
				const s = (sigma[i] + sigma[j]) / 2;
				const s2 = s * s;
				if (r2 > RC * RC * s2) continue;
				const q = s2 / r2;
				const q6 = q * q * q;
				// force on j along (dx, dy), divided by r: 24ε(2q¹² − q⁶)/r²
				const f = (24 * (2 * q6 * q6 - q6)) / r2;
				fx[j] += f * dx;
				fy[j] += f * dy;
				fx[i] -= f * dx;
				fy[i] -= f * dy;
				if (role[j] === TOP && role[i] === MOBILE) onGrip += f * dx;
				else if (role[i] === TOP && role[j] === MOBILE) onGrip -= f * dx;
			}
		}
		this.gripForce = onGrip;
		const b = this.body;
		if (b.atoms.length) {
			// forces between the particle's own atoms cancel in the sum and the torque
			b.fx = 0;
			b.fy = 0;
			b.torque = 0;
			const c = Math.cos(b.th);
			const sn = Math.sin(b.th);
			b.atoms.forEach((i, k) => {
				b.fx += fx[i];
				b.fy += fy[i];
				const rx = c * b.ox[k] - sn * b.oy[k];
				const ry = sn * b.ox[k] + c * b.oy[k];
				b.torque += rx * fy[i] - ry * fx[i];
			});
		}
	}

	/** Puts the particle's atoms where the rigid body is. */
	private placeBody() {
		const b = this.body;
		const W = this.width;
		const c = Math.cos(b.th);
		const sn = Math.sin(b.th);
		b.atoms.forEach((i, k) => {
			let nx = b.x + c * b.ox[k] - sn * b.oy[k];
			nx -= W * Math.floor(nx / W);
			this.x[i] = nx;
			this.y[i] = b.y + sn * b.ox[k] + c * b.oy[k];
		});
	}

	/** Damped dynamics at zero load until the forces settle. */
	private relax(steps: number) {
		for (let s = 0; s < steps; s++) this.advance(0, 2);
	}

	/** One velocity-Verlet step with the grip moving at speed v (x per time unit). */
	private advance(v: number, damp = this.spec.damping) {
		const { x, y, vx, vy, fx, fy, role, n, width: W } = this;
		const h = DT / 2;
		const b = this.body;
		const m = b.atoms.length;
		if (m) {
			b.vx += h * (b.fx / m - damp * b.vx);
			b.vy += h * (b.fy / m - damp * b.vy);
			b.om += h * (b.torque / b.inertia - damp * b.om);
			b.x += DT * b.vx;
			b.y += DT * b.vy;
			b.th += DT * b.om;
			this.placeBody();
		}
		for (let i = 0; i < n; i++) {
			if (role[i] !== MOBILE || this.hard[i]) continue;
			vx[i] += h * (fx[i] - damp * vx[i]);
			vy[i] += h * (fy[i] - damp * vy[i]);
			x[i] += DT * vx[i];
			y[i] += DT * vy[i];
			if (x[i] >= W) x[i] -= W;
			else if (x[i] < 0) x[i] += W;
		}
		this.grip += v * DT;
		for (let i = 0; i < n; i++) {
			if (role[i] !== TOP) continue;
			let nx = this.x0[i] + this.grip;
			nx -= W * Math.floor(nx / W);
			x[i] = nx;
		}
		this.maybeRebuild();
		this.forces();
		if (m) {
			b.vx = (b.vx + (h * b.fx) / m) / (1 + h * damp);
			b.vy = (b.vy + (h * b.fy) / m) / (1 + h * damp);
			b.om = (b.om + (h * b.torque) / b.inertia) / (1 + h * damp);
		}
		for (let i = 0; i < n; i++) {
			if (role[i] !== MOBILE || this.hard[i]) continue;
			vx[i] = (vx[i] + h * fx[i]) / (1 + h * damp);
			vy[i] = (vy[i] + h * fy[i]) / (1 + h * damp);
		}
		this.time += DT;
	}

	private record() {
		const f: Frame = {
			x: Float32Array.from(this.x),
			y: Float32Array.from(this.y),
			// the atoms push the grip back: the stress is the reaction per width
			stress: -this.forceSum / Math.max(1, this.forceCount) / this.width,
			strain: this.grip / this.gauge
		};
		this.frames.push(f);
		this.curve.stress.push(f.stress);
		this.curve.strain.push(f.strain);
		if (this.frames.length > 4 * FPS) {
			this.frames.splice(0, FPS);
			this.first += FPS;
		}
	}

	get computed() {
		return this.first + this.frames.length;
	}

	/** The frame at index i (frames 1/FPS apart); integrates as needed. */
	frame(i: number): Frame {
		i = Math.max(0, Math.floor(i));
		const v = this.spec.rate * this.gauge;
		while (this.computed <= i) {
			this.forceSum = 0;
			this.forceCount = 0;
			for (let s = 0; s < this.spec.stepsPerFrame; s++) {
				// the grip speeds up gently (a jolt would send a stress wave through the crystal)
				this.advance(v * Math.min(1, this.time / START));
				this.forceSum += this.gripForce;
				this.forceCount++;
			}
			this.record();
		}
		return this.frames[Math.max(0, i - this.first)];
	}

	/** Time per frame, reduced units. */
	get frameTime() {
		return this.spec.stepsPerFrame * DT;
	}
}

// ------------------------------------------------------------------ reading a frame

/**
 * Atoms by count of nearest neighbours (closer than 1.3 host spacings, the gap
 * between the first and second shells). In the triangular crystal every atom
 * has six; the core of an edge dislocation is a pair with five and seven.
 */
export function coordination(c: Crystal, f: Frame): Uint8Array {
	const out = new Uint8Array(c.n);
	const W = c.width;
	for (let i = 0; i < c.n; i++) {
		for (let j = i + 1; j < c.n; j++) {
			const dy = f.y[j] - f.y[i];
			if (dy > 1.6 || dy < -1.6) continue;
			let dx = f.x[j] - f.x[i];
			dx -= W * Math.round(dx / W);
			const lim = 1.3 * A0 * ((c.sigma[i] + c.sigma[j]) / 2);
			if (dx * dx + dy * dy < lim * lim) {
				out[i]++;
				out[j]++;
			}
		}
	}
	return out;
}

/**
 * The disregistry across the slip plane: for each atom of the row just above
 * it, how many host spacings it has slipped relative to the row just below,
 * counted from the start of the row. In the perfect stacking every upper atom
 * sits midway between two lower ones and the count is a whole number; an extra
 * half-plane adds one across its core, so the count climbs by one there, and
 * passes a half (an atom sitting right on top of one below) at the core's
 * centre. Returns the upper atoms' x positions (sorted) and their counts.
 */
export function disregistry(c: Crystal, f: Frame): { x: number[]; d: number[] } {
	const W = c.width;
	const lower: number[] = [];
	const upper: number[] = [];
	for (let i = 0; i < c.n; i++) {
		if (c.row[i] === c.slipRow - 1) lower.push(f.x[i]);
		else if (c.row[i] === c.slipRow) upper.push(f.x[i]);
	}
	lower.sort((a, b) => a - b);
	upper.sort((a, b) => a - b);
	const nl = lower.length;
	// the lower row's lattice coordinate at x (periodic)
	const xiLower = (x: number) => {
		let j = 0;
		while (j < nl && lower[j] <= x) j++;
		const left = j === 0 ? lower[nl - 1] - W : lower[j - 1];
		const right = j === nl ? lower[0] + W : lower[j];
		return j - 1 + (x - left) / (right - left);
	};
	// an upper atom midway between two lower ones (the perfect stacking) counts a whole number
	const d = upper.map((x, k) => k + 0.5 - xiLower(x));
	// unwrap jumps of the count (an upper atom passing the row's start)
	for (let k = 1; k < d.length; k++) d[k] -= Math.round(d[k] - d[k - 1]);
	return { x: upper, d };
}

/**
 * Positions (x) of the dislocation cores on the slip plane: where the
 * disregistry passes a half-integer (an upper atom right above a lower one).
 */
export function cores(c: Crystal, f: Frame): number[] {
	const W = c.width;
	const { x, d } = disregistry(c, f);
	const n = x.length;
	if (n < 2) return [];
	// from the last atom the row wraps round to the first, whose count is higher by
	// the number of extra half-planes
	const extra = n - c.spec.cols;
	const out: number[] = [];
	for (let k = 0; k < n; k++) {
		const last = k === n - 1;
		const a = d[k];
		const b = last ? d[0] + extra : d[k + 1];
		const xa = x[k];
		const xb = last ? x[0] + W : x[k + 1];
		const level = Math.floor(b - 0.5) + 0.5;
		if (Math.floor(a - 0.5) < Math.floor(b - 0.5)) {
			const u = (level - a) / (b - a);
			const xc = xa + u * (xb - xa);
			out.push(((xc % W) + W) % W);
		}
	}
	return out.sort((p, q) => p - q);
}

/** Atom indices by row (atoms never leave their row: glide is sideways). */
const rowsOf = new WeakMap<Crystal, number[][]>();
function rowIndex(c: Crystal): number[][] {
	let r = rowsOf.get(c);
	if (!r) {
		r = Array.from({ length: c.spec.rows }, () => [] as number[]);
		for (let i = 0; i < c.n; i++) r[c.row[i]].push(i);
		rowsOf.set(c, r);
	}
	return r;
}

/**
 * How squeezed or stretched the crystal is around each atom: the mean distance
 * to its nearest neighbours (within 1.3 spacings, in its own and the two
 * adjacent rows) relative to the pair's relaxed spacing, minus one. Negative:
 * squeezed (above the core of an edge dislocation, where the extra half-plane
 * is pushed in); positive: stretched (below it).
 */
export function localStrain(c: Crystal, f: Frame): Float32Array {
	const rows = rowIndex(c);
	const out = new Float32Array(c.n);
	const W = c.width;
	for (let i = 0; i < c.n; i++) {
		const r = c.row[i];
		let sum = 0;
		let k = 0;
		for (let rr = Math.max(0, r - 1); rr <= Math.min(c.spec.rows - 1, r + 1); rr++) {
			for (const j of rows[rr]) {
				if (j === i) continue;
				let dx = f.x[j] - f.x[i];
				dx -= W * Math.round(dx / W);
				const dy = f.y[j] - f.y[i];
				const a = A0 * ((c.sigma[i] + c.sigma[j]) / 2);
				const d = Math.sqrt(dx * dx + dy * dy);
				if (d < 1.3 * a) {
					sum += d / a;
					k++;
				}
			}
		}
		out[i] = k ? sum / k - 1 : 0;
	}
	return out;
}

/**
 * The bonds across the slip plane: each atom of the row just above it with the
 * atoms of the row just below that are within 1.45 spacings, and each bond's
 * length in spacings. In the perfect stacking every upper atom has two bonds
 * of length 1; at a core one is stretched towards breaking.
 */
export function slipBonds(c: Crystal, f: Frame): { i: number; j: number; length: number }[] {
	const rows = rowIndex(c);
	const out: { i: number; j: number; length: number }[] = [];
	const W = c.width;
	for (const i of rows[c.slipRow]) {
		for (const j of rows[c.slipRow - 1]) {
			let dx = f.x[j] - f.x[i];
			dx -= W * Math.round(dx / W);
			if (dx > 2 || dx < -2) continue;
			const dy = f.y[j] - f.y[i];
			const a = A0 * ((c.sigma[i] + c.sigma[j]) / 2);
			const length = Math.sqrt(dx * dx + dy * dy) / a;
			if (length < 1.45) out.push({ i, j, length });
		}
	}
	return out;
}
