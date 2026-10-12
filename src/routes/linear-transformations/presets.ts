/**
 * The example matrices the narrative quotes. Steps load them through
 * `hints.load` (and the two "Example" menus); the scene names a matrix when
 * it is exactly one of these.
 */
import { fromColumns, mat, rotation, shear, vec, type Mat } from './matrix';

export interface Preset {
	name: string;
	/** One line on what the columns do. */
	about: string;
	m: Mat;
}

/** The "Example" menu of the gallery step. */
export const examples: Record<string, Preset> = {
	rotate: {
		name: 'Rotate by 30°',
		about: 'î and ĵ both turn 30°: lengths and angles kept',
		m: rotation(30)
	},
	stretch: {
		name: 'Stretch sideways',
		about: 'î doubles, ĵ stays: horizontal distances double',
		m: mat(2, 0, 0, 1)
	},
	shear: {
		name: 'Shear',
		about: 'î stays, ĵ slides over to (1, 1)',
		m: shear(1)
	},
	mirror: {
		name: 'Mirror',
		about: 'î flips to (−1, 0): the F is back to front',
		m: mat(-1, 0, 0, 1)
	},
	flatten: {
		name: 'Flatten onto a line',
		about: 'î and ĵ land on the same line',
		m: fromColumns(vec(1, 0.5), vec(2, 1))
	},
	identity: {
		name: 'Do nothing (identity)',
		about: 'î and ĵ stay where they are',
		m: mat(1, 0, 0, 1)
	}
};

/** The "Example" menu of the step on rotations, shears and scalings. */
export const specials: Record<string, Preset> = {
	rotate: {
		name: 'Rotate by 30°',
		about: 'every arrow is turned 30°',
		m: rotation(30)
	},
	shear: { name: 'Shear', about: 'only arrows along the x-axis stay on their line', m: shear(1) },
	scale: {
		name: 'Scale everything by 1.5',
		about: 'every arrow is stretched 1.5 times',
		m: mat(1.5, 0, 0, 1.5)
	},
	diagonal: {
		name: 'Mirror in the diagonal',
		about: 'kept along the mirror, reversed across it',
		m: mat(0, 1, 1, 0)
	}
};

/** Matrices loaded by single steps. */
export const loads: Record<string, Mat> = {
	/** "î landing on (2, 0) and ĵ on (1, 1.5)": det 3. */
	area: fromColumns(vec(2, 0), vec(1, 1.5)),
	/** "î landing on (0.5, 1.5) and ĵ on (1.5, 0.5)": det −2. */
	flip: fromColumns(vec(0.5, 1.5), vec(1.5, 0.5)),
	/** (2 1; 0.5 1.5): λ = 2.5 along (2, 1) and λ = 1 along (1, −1). */
	eigen: mat(2, 1, 0.5, 1.5)
};

/** The two transformations composed in the "compose" step. */
export const R = rotation(90);
export const S = shear(1);
