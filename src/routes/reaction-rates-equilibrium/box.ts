/**
 * The box of molecules drawn beside the plots: an illustration driven by the model.
 *
 * Each of SLOTS molecules flies in a straight line and bounces off the walls, a
 * pure function of the animation time (molecules pass through each other; only
 * their meetings matter). When two of them touch, that is a collision. Which
 * collisions react is decided by the model: the run says how many forward and
 * reverse reactions (in molecules) have happened by each moment, and a collision
 * between H₂ and I₂ (or between two HI) reacts when the box is behind that count.
 * So the box follows the model's numbers to within a molecule or so, while every
 * reaction it shows happens at a real meeting of two molecules. Almost all
 * collisions in a real gas bounce off without reacting (1 in 10¹³ reacts at
 * 700 K); the box doesn't draw the bounces.
 *
 * The collision list depends only on the slots' paths, so it is computed once,
 * lazily, and shared by every run.
 */
import { rng } from '#lib/draw/math.ts';

/** Inside of the box, in drawing units. */
export const BOX_W = 404;
export const BOX_H = 380;
/** Molecule slots (the most molecules the box can hold). */
export const SLOTS = 96;
/** Centre distance at which two molecules touch. */
export const CONTACT = 19;
/** Margin from the walls for a molecule's centre. */
const PAD = 11;
/** Collision detection step (animation seconds). */
const DT = 1 / 60;

export type Species = 'h2' | 'i2' | 'hi' | 'none';

interface Path {
	x0: number;
	y0: number;
	vx: number;
	vy: number;
	spin: number;
	angle0: number;
}

const paths: Path[] = (() => {
	const r = rng(20261014);
	const out: Path[] = [];
	for (let i = 0; i < SLOTS; i++) {
		const a = r() * Math.PI * 2;
		const speed = 95 + 45 * r();
		out.push({
			x0: PAD + r() * (BOX_W - 2 * PAD),
			y0: PAD + r() * (BOX_H - 2 * PAD),
			vx: speed * Math.cos(a),
			vy: speed * Math.sin(a),
			spin: (r() - 0.5) * 3,
			angle0: r() * 360
		});
	}
	return out;
})();

/** Reflects a free coordinate into [lo, hi] (a bounce off each wall). */
function fold(v: number, lo: number, hi: number): number {
	const span = hi - lo;
	let u = (v - lo) % (2 * span);
	if (u < 0) u += 2 * span;
	return lo + (u <= span ? u : 2 * span - u);
}

/** Position of slot `i` at animation time `t` (s), inside the box. */
export function position(i: number, t: number): { x: number; y: number; angle: number } {
	const p = paths[i];
	return {
		x: fold(p.x0 + p.vx * t, PAD, BOX_W - PAD),
		y: fold(p.y0 + p.vy * t, PAD, BOX_H - PAD),
		angle: p.angle0 + p.spin * t * 57.3
	};
}

// ------------------------------------------------------------------ collisions

export interface Collision {
	t: number;
	i: number;
	j: number;
	x: number;
	y: number;
}

const collisions: Collision[] = [];
let scanned = 0; // number of DT steps scanned
let prevTouch = new Uint8Array((SLOTS * (SLOTS - 1)) / 2);

/** Every collision up to animation time `t` (computed on demand, cached). */
function collisionsUntil(t: number): readonly Collision[] {
	const steps = Math.ceil(t / DT);
	const xs = new Float64Array(SLOTS);
	const ys = new Float64Array(SLOTS);
	while (scanned < steps) {
		scanned++;
		const tt = scanned * DT;
		for (let i = 0; i < SLOTS; i++) {
			const p = position(i, tt);
			xs[i] = p.x;
			ys[i] = p.y;
		}
		const touch = new Uint8Array(prevTouch.length);
		let k = 0;
		for (let i = 0; i < SLOTS; i++) {
			for (let j = i + 1; j < SLOTS; j++, k++) {
				const dx = xs[i] - xs[j];
				const dy = ys[i] - ys[j];
				if (dx * dx + dy * dy < CONTACT * CONTACT) {
					touch[k] = 1;
					if (!prevTouch[k])
						collisions.push({ t: tt, i, j, x: (xs[i] + xs[j]) / 2, y: (ys[i] + ys[j]) / 2 });
				}
			}
		}
		prevTouch = touch;
	}
	return collisions;
}

// ------------------------------------------------------------------ a run

/** Reactions the model has done by animation time t, in molecules. */
export interface Targets {
	forward: number;
	reverse: number;
}

/** Molecules added (positive) or taken out (negative) of hydrogen at time `t`. */
export interface Dose {
	t: number;
	n: number;
}

export interface Flash {
	t: number;
	x: number;
	y: number;
	/** 'forward': H₂ + I₂ → 2 HI; 'reverse': 2 HI → H₂ + I₂. */
	kind: 'forward' | 'reverse';
}

export interface BoxState {
	species: Species[];
	/** When each slot last changed (for fades), and what it was before. */
	since: number[];
	before: Species[];
	flashes: Flash[];
	counts: Record<Exclude<Species, 'none'>, number>;
	forward: number;
	reverse: number;
}

/** Species of the slots for `h2`, `i2` and `hi` starting molecules, well mixed. */
export function startSpecies(h2: number, i2: number, hi: number): Species[] {
	const out: Species[] = Array.from({ length: SLOTS }, () => 'none');
	const order = Array.from({ length: SLOTS }, (_, i) => i);
	const r = rng(7);
	for (let i = SLOTS - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	let k = 0;
	const put = (n: number, s: Species) => {
		for (let c = 0; c < n && k < SLOTS; c++) out[order[k++]] = s;
	};
	put(Math.round(h2), 'h2');
	put(Math.round(i2), 'i2');
	put(Math.round(hi), 'hi');
	return out;
}

/** How many flashes stay drawn, and for how long (s). */
export const FLASH_FOR = 0.6;

/**
 * Replays a run from its start to animation time t. Incremental: asking for a
 * later time continues where the last call stopped; an earlier time starts over.
 */
export class BoxRun {
	private state!: BoxState;
	private at = 0;
	private next = 0;
	private doseNext = 0;
	private net = 0;

	private readonly start: readonly Species[];
	private readonly targets: (t: number) => Targets;
	private readonly doses: readonly Dose[];

	constructor(
		start: readonly Species[],
		targets: (t: number) => Targets,
		doses: readonly Dose[] = []
	) {
		this.start = start;
		this.targets = targets;
		this.doses = [...doses].sort((a, b) => a.t - b.t);
		this.reset();
	}

	private reset() {
		const species = [...this.start];
		const counts = { h2: 0, i2: 0, hi: 0 };
		for (const s of species) if (s !== 'none') counts[s]++;
		this.state = {
			species,
			since: species.map(() => -10),
			before: [...species],
			flashes: [],
			counts,
			forward: 0,
			reverse: 0
		};
		this.at = 0;
		this.next = 0;
		this.doseNext = 0;
		this.net = 0;
	}

	private set(i: number, s: Species, t: number) {
		const st = this.state;
		const old = st.species[i];
		if (old !== 'none') st.counts[old]--;
		if (s !== 'none') st.counts[s]++;
		st.before[i] = old;
		st.species[i] = s;
		st.since[i] = t;
	}

	private dose(d: Dose) {
		const st = this.state;
		let n = Math.round(d.n);
		for (let i = 0; i < SLOTS && n !== 0; i++) {
			if (n > 0 && st.species[i] === 'none') {
				this.set(i, 'h2', d.t);
				n--;
			} else if (n < 0 && st.species[i] === 'h2') {
				this.set(i, 'none', d.t);
				n++;
			}
		}
	}

	stateAt(t: number): BoxState {
		if (t < this.at) this.reset();
		const list = collisionsUntil(t);
		const st = this.state;
		const doses = this.doses;
		while (this.next < list.length && list[this.next].t <= t) {
			const c = list[this.next++];
			while (this.doseNext < doses.length && doses[this.doseNext].t <= c.t)
				this.dose(doses[this.doseNext++]);
			const a = st.species[c.i];
			const b = st.species[c.j];
			const goal = this.targets(c.t);
			const netGoal = goal.forward - goal.reverse;
			if ((a === 'h2' && b === 'i2') || (a === 'i2' && b === 'h2')) {
				const behindGross = st.forward < goal.forward && this.net + 1 <= netGoal + 1;
				if (behindGross || this.net + 1 <= netGoal) {
					this.set(c.i, 'hi', c.t);
					this.set(c.j, 'hi', c.t);
					st.forward++;
					this.net++;
					st.flashes.push({ t: c.t, x: c.x, y: c.y, kind: 'forward' });
				}
			} else if (a === 'hi' && b === 'hi') {
				const behindGross = st.reverse < goal.reverse && this.net - 1 >= netGoal - 1;
				if (behindGross || this.net - 1 >= netGoal) {
					this.set(c.i, 'h2', c.t);
					this.set(c.j, 'i2', c.t);
					st.reverse++;
					this.net--;
					st.flashes.push({ t: c.t, x: c.x, y: c.y, kind: 'reverse' });
				}
			}
		}
		while (this.doseNext < doses.length && doses[this.doseNext].t <= t)
			this.dose(doses[this.doseNext++]);
		// Keep only the recent flashes.
		let k = 0;
		while (k < st.flashes.length && st.flashes[k].t < t - FLASH_FOR) k++;
		if (k > 0) st.flashes.splice(0, k);
		this.at = t;
		return st;
	}
}
