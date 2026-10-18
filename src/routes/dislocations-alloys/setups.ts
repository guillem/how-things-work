/**
 * The crystals the page shears, and the model's own measured numbers that the
 * scenes draw as reference marks (each checked against a fresh run by
 * e2e/dislocations-alloys-model.e2e.ts).
 */
import type { CrystalSpec } from './crystal';

export type Setup = 'perfect' | 'one' | 'solutes' | 'pileup';

/** Box size: 36 atoms per row, 16 rows (584 to 598 atoms). */
const BOX = { cols: 36, rows: 16, damping: 0.3 } as const;

/** Shear rate of the dislocation runs (strain per time unit): slow enough to watch a core hop. */
export const SLOW = 0.0005;
/** The perfect crystal is loaded four times faster (its peak does not depend on the rate). */
export const FAST = 0.002;

/** Shear modulus of the model crystal, ε/σ² (the slope of the perfect crystal's elastic loading). */
export const SHEAR_MODULUS = 29.5;
/** Peak stress of the perfect crystal, ε/σ²: its ideal shear strength (about G/6.6). */
export const IDEAL_STRENGTH = 4.4;
/** Mean stress at which one dislocation glides through the pure crystal at the slow rate, ε/σ². */
export const GLIDE_STRESS = 0.017;

/** Position of the hard particle, as a fraction of the box width. */
export const OBSTACLE_AT = 0.85;

export interface SetupParams {
	/** Fraction of foreign atoms (solutes). */
	fraction?: number;
	/** Their size relative to the host atoms. */
	size?: number;
	/** Dislocations driven against the particle. */
	count?: number;
}

/** The crystal of a setup. */
export function specFor(setup: Setup, p: SetupParams = {}): CrystalSpec {
	switch (setup) {
		case 'perfect':
			return { ...BOX, dislocations: 0, rate: FAST };
		case 'one':
			// the core starts a quarter of the way across
			return { ...BOX, dislocations: 1, rate: SLOW, offset: -0.25 };
		case 'solutes':
			return {
				...BOX,
				dislocations: 1,
				rate: SLOW,
				offset: -0.25,
				soluteSize: p.size ?? 1.12,
				soluteFraction: p.fraction ?? 0.05,
				soluteBand: BOX.rows,
				seed: 3
			};
		case 'pileup': {
			const count = Math.max(1, Math.min(3, Math.round(p.count ?? 3)));
			return {
				...BOX,
				dislocations: count,
				rate: 2 * SLOW,
				// cores start evenly spaced; shift them so that none sits on the particle
				offset: count === 1 ? -0.3 : count === 2 ? -0.05 : -0.08,
				obstacle: OBSTACLE_AT
			};
		}
	}
}
