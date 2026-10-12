/**
 * From the real substance to the box.
 *
 * The box is a flat (2D) world of 80 molecules, and its own melting and boiling
 * points are not those of carbon dioxide or water: in 2D the liquid range of
 * the Lennard-Jones model is narrow (it melts near T* ≈ 0.4, and its critical
 * point, with the attraction cut off at 2.5σ, is near T* ≈ 0.46: Smit & Frenkel,
 * J. Chem. Phys. 94, 5663, 1991), and the Mercedes-Benz water melts near
 * T* ≈ 0.2. So the box does not run at the reader's temperature and pressure
 * converted to reduced units. It runs at a set point in the same state as the
 * reader's point on the real phase diagram, placed in proportion within that
 * state's range:
 *
 *   - solid: colder the further below the melting (or sublimation) point;
 *   - liquid: from just above the box's melting point to just below its
 *     boiling point, in proportion to where the real temperature sits between
 *     the real melting and boiling points at that pressure;
 *   - gas: hotter than the box's critical temperature (so it cannot condense
 *     by itself), with the piston pressure proportional to the real pressure
 *     divided by the boiling (or sublimation) pressure at that temperature:
 *     squeezing a gas towards its boiling line pushes the piston down;
 *   - supercritical: hot, under a pressure proportional to the real one.
 *
 * The set points were chosen by running the box (see the model tests, which
 * check that the box ends up ordered or disordered, dense or spread out, as
 * the real phase diagram says).
 */
import type { Model, Setpoint } from './md';
import {
	SUBSTANCES,
	phaseAt,
	solidLimit,
	sublimationPressure,
	vaporLimit,
	vaporPressure,
	type Phase,
	type Substance
} from './phase';

export const MODEL_OF: Record<Substance, Model> = { co2: 'lj', water: 'mb' };

interface Scale {
	/** Solid: T* = solid × (T / melting point), clamped to [solidMin, solid]. */
	solid: number;
	solidMin: number;
	/** Liquid: T* from liquid[0] (at melting) to liquid[1] (at boiling). */
	liquid: [number, number];
	/** Gas: T* = gas × T / boiling point, at most gasMax. */
	gas: number;
	gasMax: number;
	/** Pressure on a condensed phase. */
	condensedP: number;
	/** Gas pressure on the boiling line (scaled by P / boiling pressure). */
	gasP: number;
}

const SCALES: Record<Model, Scale> = {
	lj: {
		solid: 0.3,
		solidMin: 0.12,
		liquid: [0.42, 0.45],
		gas: 0.85,
		gasMax: 1.4,
		condensedP: 0.3,
		gasP: 0.35
	},
	mb: {
		solid: 0.1,
		solidMin: 0.05,
		liquid: [0.2, 0.23],
		gas: 0.45,
		gasMax: 0.7,
		condensedP: 0.19,
		gasP: 0.15
	}
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The box's set point for the substance at temperature T (K) and pressure P (Pa). */
export function setpointFor(sub: Substance, T: number, P: number): Setpoint & { phase: Phase } {
	const s = SCALES[MODEL_OF[sub]];
	const { triple, critical } = SUBSTANCES[sub];
	const phase = phaseAt(sub, T, P);
	switch (phase) {
		case 'solid': {
			const Tm = solidLimit(sub, P);
			return {
				phase,
				solid: true,
				T: clamp(s.solid * (T / Tm), s.solidMin, s.solid),
				P: s.condensedP
			};
		}
		case 'liquid': {
			const Tm = solidLimit(sub, P);
			const Tb = vaporLimit(sub, P);
			const u = clamp((T - Tm) / (Tb - Tm), 0, 1);
			return {
				phase,
				solid: false,
				T: s.liquid[0] + (s.liquid[1] - s.liquid[0]) * u,
				P: s.condensedP
			};
		}
		case 'gas': {
			const Tb = vaporLimit(sub, P);
			const Psat =
				T < triple.T
					? sublimationPressure(sub, T)
					: T < critical.T
						? vaporPressure(sub, T)
						: critical.P;
			return {
				phase,
				solid: false,
				T: clamp(s.gas * (T / Tb), s.gas, s.gasMax),
				P: s.gasP * clamp(P / Psat, 0, 1)
			};
		}
		case 'supercritical':
			return {
				phase,
				solid: false,
				T: clamp(s.gas * (T / critical.T), s.gas, s.gasMax),
				P: clamp(s.gasP * (P / critical.P), s.gasP, 2 * s.condensedP)
			};
	}
}
