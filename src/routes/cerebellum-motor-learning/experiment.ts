/**
 * The reader's own experiment: which rotation each reach gets, by step, and the record of the
 * reaches. Angles are in degrees, counter-clockwise positive; the cursor moves in the hand's
 * direction turned by `rotation`, so a hand that turns by −rotation puts the cursor on target.
 */
import { ROTATION, stepTwoRate, type Trial, type TwoRateState } from './model';

export interface Reach extends Trial {
	/** The step the reach was made on. */
	step: string;
	/** Direction of the target. */
	target: number;
	/** Direction of the hand's path, relative to the target. */
	hand: number;
}

/** How far the hand turned against the rotation (the correction the models predict). */
export const correctionOf = (r: Reach) => -r.hand;
/** Where the cursor went, relative to the target. */
export const errorOf = (r: Reach) => r.hand + r.rotation;

/** Target directions, cycled reach after reach. */
export const TARGETS = [90, 60, 120, 75, 105, 50, 130];
export const targetOf = (n: number) => TARGETS[n % TARGETS.length];

export interface Phase extends Trial {
	/** Short name shown on the stage. */
	name: string;
	/** Reaches left in this phase, when it has a fixed length. */
	left?: number;
}

const hidden: Phase = { name: 'cursor hidden', rotation: 0, feedback: false };
const limit: Phase = {
	name: 'cursor hidden (reversal limit reached, not back to straight)',
	rotation: 0,
	feedback: false
};

/** Reaches at the start of the recovery step with the rotation back on. */
export const READAPT = 30;
/** Bounds of the reverse block: it lasts until the hand is back to straight. */
export const REVERSE_MIN = 2;
export const REVERSE_MAX = 15;

/** Steps on which the reader reaches, and what the cursor does there. */
export function phaseOf(step: string, done: readonly Reach[]): Phase {
	switch (step) {
		case 'rotate':
			return { name: 'cursor rotated 30°', rotation: ROTATION, feedback: true };
		case 'aftereffect':
			return { name: 'rotation off, cursor hidden: aim straight', rotation: 0, feedback: false };
		case 'recover': {
			const mine = done.filter((r) => r.step === 'recover');
			if (mine.length < READAPT)
				return {
					name: 'rotated 30° again',
					rotation: ROTATION,
					feedback: true,
					left: READAPT - mine.length
				};
			const rev = mine.slice(READAPT);
			let n = 0;
			while (n < rev.length && rev[n].rotation < 0) {
				n++;
				const back = n >= REVERSE_MIN && correctionOf(rev[n - 1]) <= 0;
				if (back) return hidden;
				if (n >= REVERSE_MAX) return limit;
			}
			if (n < rev.length) return hidden;
			return { name: 'rotated 30° the other way', rotation: -ROTATION, feedback: true };
		}
		default:
			return { name: 'no rotation', rotation: 0, feedback: true };
	}
}
/**
 * What the model predicts for the next `n` reaches of this step, if it did them itself from
 * `from` (its state after the reader's reaches so far): its own corrections decide when the
 * recovery step's reverse block ends, as the reader's do. Returns the state before each.
 */
export function forecast(
	step: string,
	done: readonly Reach[],
	from: TwoRateState,
	n: number
): TwoRateState[] {
	const reaches = [...done];
	const out: TwoRateState[] = [];
	let st = from;
	for (let i = 0; i < n; i++) {
		out.push(st);
		const p = phaseOf(step, reaches);
		reaches.push({ step, target: 90, hand: -st.total, rotation: p.rotation, feedback: p.feedback });
		st = stepTwoRate(st, p);
	}
	return out;
}
