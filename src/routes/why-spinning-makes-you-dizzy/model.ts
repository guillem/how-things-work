/**
 * Why spinning makes you dizzy, at level 0: the semicircular canal as a torsion pendulum, and
 * the brain's velocity storage, driven by a chair that spins up, keeps turning and stops.
 *
 * The canal (Steinhausen 1931; van Egmond, Groen & Jongkees 1949): the ring of fluid
 * (endolymph) inside the canal is a heavily damped torsion pendulum. With x the angle the fluid
 * has slipped behind the canal's walls, which the jelly flap (the cupula) bends with,
 *
 *     x'' + x' / τ₂ + x / (τ₁ τ₂) = α(t)          (α: the head's angular acceleration)
 *
 * where τ₂ = inertia / viscous drag is a few milliseconds and τ₁ = drag / the cupula's
 * springiness is several seconds. Between those two times the flap's bend is proportional to the
 * head's turning speed, so the hair cells report the speed; for longer than τ₁ the springy flap
 * pushes the fluid back into step and the report fades. We call c = x / τ₂ the speed the flap
 * reports (in °/s: it equals the head's speed in the middle of the range).
 *
 * The brain (Raphan, Matsuo & Cohen 1979, velocity storage): the feeling of turning is the
 * canal's signal plus a store that the signal fills and that leaks slowly,
 *
 *     S' = k c − S / τ_vs,     feeling = c + S,
 *
 * so after a sudden change of speed the feeling decays as the sum of two exponentials, a fast
 * one (the canal's τ₁) and a slow one (the store's τ_vs). The parameters are the fits to
 * healthy people's perceived rotation after a sudden stop from 90 °/s in yaw (Bertolini et al.
 * 2012, PLoS ONE 7:e36763, tables 2 and 3, the eye-and-perception constrained fit): τ₁ = 5.1 s,
 * τ_vs = 15.3 s, and the slow part 0.30 times the fast one. τ₂ is the textbook few milliseconds
 * (Rabbitt, Damiano & Grant 2004, in "The Vestibular System", Springer Handbook of Auditory
 * Research 19); it only matters in the first hundredth of a second.
 *
 * The model is linear: twice the speed, twice the bend and twice the feeling. Real canals and
 * real feelings saturate for very fast spins, and very slow turns fall below what a person can
 * feel; the page stays in between.
 *
 * Every response is exact, not stepped: the chair's speed is piecewise linear in time (spin up,
 * keep turning, stop), its acceleration piecewise constant, and the response of this linear
 * system to an acceleration step is a sum of exponentials (residues at its poles). So the scene
 * can ask for any moment, as a pure function of time.
 */

/** The canal's long time constant (the flap springing back), s: Bertolini et al. 2012. */
export const TAU_CANAL = 5.1;
/** The canal's short time constant (the fluid's inertia against its drag), s. */
export const TAU_FLUID = 0.004;
/** The brain's store's leak time, s: Bertolini et al. 2012. */
export const TAU_STORE = 15.3;
/** The slow part of the feeling's decay over the fast part (R_perc, Bertolini et al. 2012). */
export const STORE_RATIO = 0.3;

/** Seconds to spin the chair up from rest (a push with the feet). */
export const SPIN_UP = 1;
/** Seconds to stop it (a hand on the desk, a foot on the floor). */
export const STOP = 0.5;

// ------------------------------------------------------------------------------- poles
const disc = Math.sqrt(1 / TAU_FLUID ** 2 - 4 / (TAU_CANAL * TAU_FLUID));
/** The canal's two poles: slow (about −1/τ₁) and fast (about −1/τ₂). */
const P1 = (-1 / TAU_FLUID + disc) / 2;
const P2 = (-1 / TAU_FLUID - disc) / 2;
const P3 = -1 / TAU_STORE;
/** The store's fill rate, chosen so that the slow part is STORE_RATIO times the fast part. */
const STORE_FRACTION = STORE_RATIO / (1 + STORE_RATIO);
const K_STORE = STORE_FRACTION * (1 / TAU_CANAL - 1 / TAU_STORE);

/**
 * The response at time t ≥ 0 of `gain / ∏(s − q)` to a unit step at time 0 (a pole at 0 is
 * added for the step): the sum of the residues at the poles.
 */
function stepResponse(poles: readonly number[], gain: number, t: number): number {
	if (t <= 0) return 0;
	const all = [0, ...poles];
	let sum = 0;
	for (let i = 0; i < all.length; i++) {
		let den = 1;
		for (let j = 0; j < all.length; j++) if (j !== i) den *= all[i] - all[j];
		sum += (gain / den) * Math.exp(all[i] * t);
	}
	return sum;
}

/** The flap's report (°/s) after the head's acceleration steps up by 1 °/s² at time 0. */
const flapAfterAccel = (t: number) => stepResponse([P1, P2], 1 / TAU_FLUID, t);
/** The store's part of the feeling after the same step. */
const storeAfterAccel = (t: number) => stepResponse([P1, P2, P3], K_STORE / TAU_FLUID, t);

// ------------------------------------------------------------------------------- the chair
/** A moment of the chair's turning speed (°/s, positive = to the right); linear in between. */
export interface Knot {
	t: number;
	speed: number;
}

/** A chair's turning speed over time: piecewise linear through its knots, held after the last. */
export type Spin = readonly Knot[];

/**
 * The chair spins up from rest at `start` to `speed` (°/s), keeps turning and, if `stopAt` is
 * given, stops then.
 */
export function spin(speed: number, start = 0, stopAt?: number): Spin {
	const knots: Knot[] = [
		{ t: start, speed: 0 },
		{ t: start + SPIN_UP, speed }
	];
	if (stopAt !== undefined && stopAt > start + SPIN_UP) {
		knots.push({ t: stopAt, speed }, { t: stopAt + STOP, speed: 0 });
	}
	return knots;
}

/** The chair's turning speed at time t, °/s. */
export function chairSpeed(s: Spin, t: number): number {
	if (t <= s[0].t) return s[0].speed;
	for (let i = 1; i < s.length; i++) {
		if (t <= s[i].t) {
			const u = (t - s[i - 1].t) / (s[i].t - s[i - 1].t);
			return s[i - 1].speed + u * (s[i].speed - s[i - 1].speed);
		}
	}
	return s[s.length - 1].speed;
}

/** How far the chair has turned by time t, degrees (from where it started). */
export function chairAngle(s: Spin, t: number): number {
	let a = 0;
	for (let i = 1; i < s.length; i++) {
		const t0 = s[i - 1].t;
		const t1 = Math.min(s[i].t, t);
		if (t1 <= t0) break;
		const v0 = s[i - 1].speed;
		const v1 = chairSpeed(s, t1);
		a += ((v0 + v1) / 2) * (t1 - t0);
	}
	const last = s[s.length - 1];
	if (t > last.t) a += last.speed * (t - last.t);
	return a;
}

/** The chair's acceleration steps: at each knot, the change of slope. */
function accelSteps(s: Spin): { t: number; da: number }[] {
	const out: { t: number; da: number }[] = [];
	let prev = 0;
	for (let i = 0; i < s.length; i++) {
		const next = i + 1 < s.length ? (s[i + 1].speed - s[i].speed) / (s[i + 1].t - s[i].t) : 0;
		if (next !== prev) out.push({ t: s[i].t, da: next - prev });
		prev = next;
	}
	return out;
}

// ------------------------------------------------------------------------------- the ear
/**
 * What the flap reports at time t, °/s: how fast the fluid's lag says the head is turning
 * (positive = to the right). Its bend is proportional to this.
 */
export function flap(s: Spin, t: number): number {
	let c = 0;
	for (const a of accelSteps(s)) c += a.da * flapAfterAccel(t - a.t);
	return c;
}

/** How fast you feel you are turning at time t, °/s (positive = to the right). */
export function feeling(s: Spin, t: number): number {
	let p = 0;
	for (const a of accelSteps(s)) p += a.da * (flapAfterAccel(t - a.t) + storeAfterAccel(t - a.t));
	return p;
}

// ------------------------------------------------------------------------------- words
/** The chair's speed slider counts turns in 10 seconds; 1 turn = 360°. */
export const speedOf = (turnsIn10s: number) => turnsIn10s * 36;

/** "5 turns in 10 seconds". */
export function turnsWords(turnsIn10s: number): string {
	if (turnsIn10s <= 0) return 'not turning';
	const n = Math.round(turnsIn10s);
	return `${n} ${n === 1 ? 'turn' : 'turns'} in 10 seconds`;
}

/**
 * How strong a feeling is compared with the chair's speed `ref`, in words a reader says aloud:
 * "as fast as", "about half as fast as", "hardly".
 */
export function howMuch(v: number, ref: number): string {
	const r = Math.abs(v) / Math.max(ref, 1e-9);
	if (r >= 0.85) return 'as fast as';
	if (r >= 0.65) return 'nearly as fast as';
	if (r >= 0.4) return 'about half as fast as';
	if (r >= 0.2) return 'about a quarter as fast as';
	return 'much slower than';
}

/** A feeling below this share of the spin's speed is "not turning" on the page. */
export const UNFELT = 0.08;

/** "turning right, about half as fast as the chair", or "not turning". */
export function feelWords(v: number, ref: number): string {
	if (ref <= 0 || Math.abs(v) < UNFELT * ref) return 'not turning';
	const dir = v > 0 ? 'right' : 'left';
	return `turning ${dir}, ${howMuch(v, ref)} the chair spun`;
}
