/**
 * From the surface to a rate: the path of least energy over the pass, the zero-point energies
 * at the start and at the pass, the effective barrier they make, and Eyring's rate.
 */
import {
	H_PLANCK,
	HBAR,
	KB,
	energy,
	energyGrad,
	saddleModes,
	saddleOf,
	type Surface
} from './leps';
import { barrier, masses, reactantBond, vibEnergy, type Reaction } from './trajectory';

/**
 * The minimum-energy path: steepest descent from the pass down both valleys, in steps of
 * `ds` Å, as points (r₁, r₂, V) ordered from the X + YZ valley to the XY + Z valley.
 */
export function minimumPath(
	s: Surface,
	ds = 0.01,
	reach = 3.2
): { r1: number; r2: number; v: number }[] {
	const sd = saddleOf(s);
	// the downhill directions at the pass: the eigenvector of the negative curvature
	const h = 1e-4;
	const g = (a: number, b: number) => energyGrad(s, a, b);
	const p1 = g(sd.r1 + h, sd.r2),
		m1 = g(sd.r1 - h, sd.r2),
		p2 = g(sd.r1, sd.r2 + h),
		m2 = g(sd.r1, sd.r2 - h);
	const a = (p1[1] - m1[1]) / (2 * h),
		c = (p2[2] - m2[2]) / (2 * h),
		b = ((p1[2] - m1[2]) / (2 * h) + (p2[1] - m2[1]) / (2 * h)) / 2;
	const lam = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
	let ex = b,
		ey = lam - a;
	if (Math.abs(ex) + Math.abs(ey) < 1e-12) {
		ex = 1;
		ey = 0;
	}
	const n = Math.hypot(ex, ey);
	ex /= n;
	ey /= n;
	const descend = (sign: number) => {
		const out: { r1: number; r2: number; v: number }[] = [];
		let r1 = sd.r1 + sign * ex * ds,
			r2 = sd.r2 + sign * ey * ds;
		let dx = sign * ex,
			dy = sign * ey;
		for (let i = 0; i < 2000; i++) {
			// settle on the valley floor across the direction of travel (a few Newton steps)
			const nx = -dy,
				ny = dx;
			for (let k = 0; k < 4; k++) {
				const vp = energy(s, r1 + nx * h, r2 + ny * h),
					v0 = energy(s, r1, r2),
					vm = energy(s, r1 - nx * h, r2 - ny * h);
				const curv = (vp - 2 * v0 + vm) / (h * h);
				if (curv <= 0) break;
				const step = Math.max(-0.02, Math.min(0.02, (vp - vm) / (2 * h) / curv));
				r1 -= nx * step;
				r2 -= ny * step;
			}
			const [v, d1, d2] = g(r1, r2);
			const last = out[out.length - 1];
			if (last) {
				const l = Math.hypot(r1 - last.r1, r2 - last.r2) || 1;
				dx = (r1 - last.r1) / l;
				dy = (r2 - last.r2) / l;
			}
			out.push({ r1, r2, v });
			if (Math.max(r1, r2) > reach) break;
			// downhill, but turning gently: keep most of the direction of travel
			const gn = Math.hypot(d1, d2) || 1;
			const tx = dx - (0.5 * d1) / gn,
				ty = dy - (0.5 * d2) / gn;
			const tn = Math.hypot(tx, ty) || 1;
			r1 += (tx / tn) * ds;
			r2 += (ty / tn) * ds;
		}
		return out;
	};
	const one = descend(1),
		two = descend(-1);
	// one of them goes to long r₁ (the X + YZ valley): put that one first
	const firstLongR1 = one[one.length - 1].r1 > one[one.length - 1].r2;
	const toX = firstLongR1 ? one : two,
		toZ = firstLongR1 ? two : one;
	return [...toX.reverse(), { r1: sd.r1, r2: sd.r2, v: energy(s, sd.r1, sd.r2) }, ...toZ];
}

/** Zero-point energy (eV) of the pass's bound vibration, the symmetric stretch, for these masses. */
export function passZeroPoint(r: Reaction, heavy = false): number {
	return (HBAR * saddleModes(r.surface, masses(r, heavy)).stretch) / 2;
}

/**
 * The effective barrier E₀ (eV): the pass's height above the bottom of the reactants' valley,
 * plus the zero-point energy kept at the pass, minus the reactant molecule's.
 */
export function effectiveBarrier(r: Reaction, heavy = false): number {
	return barrier(r) + passZeroPoint(r, heavy) - vibEnergy(r, 0, heavy);
}

/** k_BT/h (1/s): how often, per second, a state at the top of the pass is crossed. */
export const crossingFrequency = (T: number) => (KB * T) / H_PLANCK;

/**
 * Eyring's rate with the partition-function factor left out: (k_BT/h)·e^{−E₀/k_BT}, in 1/s.
 */
export function eyring(r: Reaction, T: number, heavy = false): number {
	return crossingFrequency(T) * Math.exp(-effectiveBarrier(r, heavy) / (KB * T));
}

/** The kinetic isotope effect from the effective barriers alone: k(H)/k(D). */
export function isotopeRatio(r: Reaction, T: number): number {
	return eyring(r, T) / eyring(r, T, true);
}

/** Ground-state vibrational energy of the reactant molecule (eV), H or D. */
export function reactantZeroPoint(r: Reaction, heavy = false): number {
	return vibEnergy(r, 0, heavy);
}

export { reactantBond };
