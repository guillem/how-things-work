/**
 * Quasiclassical trajectories of A + BC → AB + C on a line, over a LEPS surface (./leps.ts).
 *
 * The molecule starts in a quantised vibrational level v (never below its zero-point energy):
 * its bond is given exactly the energy of that level and swings classically, caught at a chosen
 * phase of its swing. The attacker comes in with the chosen translational energy. Newton's laws
 * then move the three atoms (velocity Verlet), and the trajectory ends when one atom has flown
 * off: the products, or the reactants again.
 */
import {
	ACC,
	MASS,
	SURFACES,
	energyGrad,
	morseLevel,
	saddleOf,
	type Atom,
	type Pair,
	type Surface
} from './leps';

export type ReactionId = 'h-h2' | 'f-h2' | 'h-hf';

/** A reaction on one surface. The three atoms are X–Y–Z; r₁ = X–Y, r₂ = Y–Z. */
export interface Reaction {
	id: ReactionId;
	surface: Surface;
	/** The atoms X, Y, Z (light isotope). */
	atoms: [Atom, Atom, Atom];
	/** Which end comes in: X (r₁ starts long, the molecule is Y–Z) or Z (r₂ long, X–Y). */
	attacker: 'x' | 'z';
}

export const REACTIONS: Record<ReactionId, Reaction> = {
	'h-h2': { id: 'h-h2', surface: SURFACES.h3, atoms: ['H', 'H', 'H'], attacker: 'x' },
	'f-h2': { id: 'f-h2', surface: SURFACES.fh2, atoms: ['F', 'H', 'H'], attacker: 'x' },
	/** The reverse of F + H₂ on the same surface: an H atom hits the H end of H–F. */
	'h-hf': { id: 'h-hf', surface: SURFACES.fh2, atoms: ['F', 'H', 'H'], attacker: 'z' }
};

/** The masses X, Y, Z, with every H replaced by D when `heavy`. */
export function masses(r: Reaction, heavy = false): [number, number, number] {
	const m = (a: Atom) => MASS[heavy && a === 'H' ? 'D' : a];
	return [m(r.atoms[0]), m(r.atoms[1]), m(r.atoms[2])];
}

/** The reactant molecule's bond, and its reduced mass. */
export function reactantBond(r: Reaction, heavy = false): { pair: Pair; mu: number } {
	const [mx, my, mz] = masses(r, heavy);
	return r.attacker === 'x'
		? { pair: r.surface.yz, mu: (my * mz) / (my + mz) }
		: { pair: r.surface.xy, mu: (mx * my) / (mx + my) };
}

/** Energy (eV) of the reactants' vibrational level v, above the bottom of the molecule's well. */
export function vibEnergy(r: Reaction, v: number, heavy = false): number {
	const { pair, mu } = reactantBond(r, heavy);
	return morseLevel(pair, mu, v);
}

/** Height of the pass above the bottom of the reactants' valley (eV). */
export function barrier(r: Reaction): number {
	const { pair } = reactantBond(r);
	return saddleOf(r.surface).v + pair.D;
}

export interface Launch {
	/** Translational energy of the collision (eV), in the centre-of-mass frame. */
	trans: number;
	/** Vibrational quantum number of the molecule. */
	v: number;
	/** Where the molecule is in its swing when the attacker sets off, 0–1. */
	phase: number;
	heavy?: boolean;
}

export interface Trajectory {
	/** Bond lengths every `DT_SAMPLE` fs. */
	r1: Float64Array;
	r2: Float64Array;
	/** Positions of X, Y, Z on the line (Å), every `DT_SAMPLE` fs. */
	x: [Float64Array, Float64Array, Float64Array];
	/** Potential energy (eV) at each sample, from the bottom of the reactants' valley. */
	pot: Float64Array;
	/** Number of samples. */
	n: number;
	/** The atoms ended as products. */
	reacted: boolean;
	/** Largest drift of the total energy during the run (eV): a check of the integration. */
	drift: number;
	/** Total energy above the bottom of the reactants' valley (eV). */
	total: number;
	/** Femtoseconds spent within `NEAR_PASS` Å of the pass. */
	nearPass: number;
}

/** Time step of the integration and of the stored samples (fs). */
export const DT = 0.02;
export const DT_SAMPLE = 0.5;
/** Distance of the attacker at the start, from the nearer atom of the molecule (Å). */
export const START = 4.2;
/** The run ends when one atom is this far from the other two (Å) and flying away. */
const END = 4.4;
/** Longest run (fs). */
const MAX_TIME = 1200;
/** Radius of the region around the pass whose crossing time is measured (Å, in r₁, r₂). */
export const NEAR_PASS = 0.2;

/**
 * The molecule's bond at a phase of its swing: (r, dr/dt) for a Morse oscillator with energy
 * E above its well bottom, by integrating one period from the inner turning point.
 */
function bondAt(pair: Pair, mu: number, e: number, phase: number): [number, number] {
	// inner turning point: D(1 − e^{−β(r−rₑ)})² = E
	const rIn = pair.re - Math.log(1 + Math.sqrt(e / pair.D)) / pair.beta;
	const force = (r: number) => {
		const q = Math.exp(-pair.beta * (r - pair.re));
		return -2 * pair.D * pair.beta * (q - q * q);
	};
	// one period: integrate until the velocity turns from positive back to ≤ 0 at the inner side
	const dt = DT / 4;
	let r = rIn,
		v = 0;
	const rs: number[] = [r],
		vs: number[] = [v];
	let a = (force(r) / mu) * ACC;
	let wentOut = false;
	for (let i = 0; i < 400000; i++) {
		v += 0.5 * a * dt;
		r += v * dt;
		a = (force(r) / mu) * ACC;
		v += 0.5 * a * dt;
		rs.push(r);
		vs.push(v);
		if (v < 0) wentOut = true;
		if (wentOut && v >= 0) break;
	}
	const k = Math.min(rs.length - 1, Math.round(phase * (rs.length - 1)));
	return [rs[k], vs[k]];
}

/** Runs one trajectory. */
export function fire(reaction: Reaction, launch: Launch): Trajectory {
	const s = reaction.surface;
	const heavy = launch.heavy ?? false;
	const m = masses(reaction, heavy);
	const { pair, mu } = reactantBond(reaction, heavy);
	const ev = morseLevel(pair, mu, launch.v);
	const [rb, vb] = bondAt(pair, mu, ev, ((launch.phase % 1) + 1) % 1);
	const zero = -pair.D; // bottom of the reactants' valley, from separate atoms

	// positions on the line, X at the left; velocities in the centre-of-mass frame
	const x = [0, 0, 0];
	const u = [0, 0, 0];
	const M = m[0] + m[1] + m[2];
	if (reaction.attacker === 'x') {
		x[1] = 0;
		x[2] = rb;
		x[0] = -START;
		// bond: Y and Z move apart at dr/dt = vb, keeping their centre still
		u[1] = (-vb * m[2]) / (m[1] + m[2]);
		u[2] = (vb * m[1]) / (m[1] + m[2]);
		const mb = m[1] + m[2];
		const vrel = Math.sqrt(((2 * launch.trans) / ((m[0] * mb) / M)) * ACC);
		u[0] += (vrel * mb) / M;
		u[1] -= (vrel * m[0]) / M;
		u[2] -= (vrel * m[0]) / M;
	} else {
		x[0] = 0;
		x[1] = rb;
		x[2] = rb + START;
		u[0] = (-vb * m[1]) / (m[0] + m[1]);
		u[1] = (vb * m[0]) / (m[0] + m[1]);
		const mb = m[0] + m[1];
		const vrel = Math.sqrt(((2 * launch.trans) / ((m[2] * mb) / M)) * ACC);
		u[2] -= (vrel * mb) / M;
		u[0] += (vrel * m[2]) / M;
		u[1] += (vrel * m[2]) / M;
	}

	const acc = (out: number[]): number => {
		const [v, d1, d2] = energyGrad(s, x[1] - x[0], x[2] - x[1]);
		// r₁ = x₁ − x₀, r₂ = x₂ − x₁
		out[0] = (d1 / m[0]) * ACC;
		out[1] = ((-d1 + d2) / m[1]) * ACC;
		out[2] = (-d2 / m[2]) * ACC;
		return v;
	};
	const kinetic = () =>
		(0.5 * (m[0] * u[0] * u[0] + m[1] * u[1] * u[1] + m[2] * u[2] * u[2])) / ACC;

	const a = [0, 0, 0];
	let pot = acc(a);
	const e0 = pot + kinetic();
	let drift = 0;

	const every = Math.round(DT_SAMPLE / DT);
	const maxSamples = Math.ceil(MAX_TIME / DT_SAMPLE) + 1;
	const R1 = new Float64Array(maxSamples),
		R2 = new Float64Array(maxSamples),
		P = new Float64Array(maxSamples);
	const X = [0, 1, 2].map(() => new Float64Array(maxSamples)) as [
		Float64Array,
		Float64Array,
		Float64Array
	];
	const sd = saddleOf(s);
	let n = 0;
	let nearSteps = 0;
	let reacted = false;
	const steps = Math.round(MAX_TIME / DT);
	for (let i = 0; i <= steps; i++) {
		const r1 = x[1] - x[0],
			r2 = x[2] - x[1];
		if (i % every === 0) {
			R1[n] = r1;
			R2[n] = r2;
			P[n] = pot - zero;
			for (let k = 0; k < 3; k++) X[k][n] = x[k] - (x[0] * m[0] + x[1] * m[1] + x[2] * m[2]) / M;
			n++;
		}
		if (Math.hypot(r1 - sd.r1, r2 - sd.r2) < NEAR_PASS) nearSteps++;
		// finished: X far from Y–Z and leaving, or Z far from X–Y and leaving
		if (r1 > END + 0.3 && u[0] < u[1] && r2 < 2) {
			reacted = reaction.attacker === 'z';
			break;
		}
		if (r2 > END + 0.3 && u[2] > u[1] && r1 < 2) {
			reacted = reaction.attacker === 'x';
			break;
		}
		for (let k = 0; k < 3; k++) {
			u[k] += 0.5 * a[k] * DT;
			x[k] += u[k] * DT;
		}
		pot = acc(a);
		for (let k = 0; k < 3; k++) u[k] += 0.5 * a[k] * DT;
		drift = Math.max(drift, Math.abs(pot + kinetic() - e0));
	}
	return {
		r1: R1.subarray(0, n),
		r2: R2.subarray(0, n),
		x: [X[0].subarray(0, n), X[1].subarray(0, n), X[2].subarray(0, n)],
		pot: P.subarray(0, n),
		n,
		reacted,
		drift,
		total: e0 - zero,
		nearPass: nearSteps * DT
	};
}

/** Phases of the fan of trajectories that gives a reaction probability. */
export const FAN = 24;

/** The fraction of `FAN` evenly spread phases that react. */
export function probability(reaction: Reaction, launch: Omit<Launch, 'phase'>): number {
	let hits = 0;
	for (let i = 0; i < FAN; i++)
		if (fire(reaction, { ...launch, phase: (i + 0.5) / FAN }).reacted) hits++;
	return hits / FAN;
}
