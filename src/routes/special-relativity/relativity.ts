/**
 * The special relativity behind the explainer. Every scene draws these results.
 *
 * Conventions: one dimension of space along the track. The platform frame S has
 * coordinates (t, x); the train frame S′ moves at velocity v = β·c along +x and
 * has coordinates (t′, x′). Both frames agree on the origin event. Most
 * functions work in "light units", where c = 1: times are given as c·t (in the
 * same unit as x), so light rays run at 45° on a spacetime diagram. Quantities in
 * SI are converted with `C` explicitly.
 *
 * Simplifications, stated on the page: no gravity and no acceleration (both
 * frames are inertial: the train coasts at a steady speed); motion along one
 * line only.
 */

/** Speed of light in vacuum, m/s. Exact by definition of the metre (SI Brochure, 9th ed., BIPM 2019). */
export const C = 299_792_458;

/**
 * Mean lifetime of the muon at rest, in seconds: 2.1969811(22) µs.
 * Source: Particle Data Group, Review of Particle Physics (2024), muon summary table.
 */
export const MUON_LIFETIME = 2.1969811e-6;

/**
 * Illustrative sizes used on the page (not data): the light clock's mirrors are
 * 1.5 m apart and the train and the platform are each 200 m long at rest.
 */
export const MIRROR_GAP = 1.5;
export const TRAIN_LENGTH = 200;

/** The Lorentz factor γ = 1 / √(1 − β²) for a speed β = v / c (0 ≤ |β| < 1). */
export function gamma(beta: number) {
	if (Math.abs(beta) >= 1) return Infinity;
	return 1 / Math.sqrt(1 - beta * beta);
}

/** An event: a time (as c·t, in light units) and a position on the track. */
export interface Event {
	ct: number;
	x: number;
}

/**
 * The Lorentz transformation: the coordinates in the train frame S′ (moving at
 * β along +x) of an event with coordinates `e` in the platform frame S.
 *   c·t′ = γ (c·t − β x),   x′ = γ (x − β c·t)
 */
export function toTrain(e: Event, beta: number): Event {
	const g = gamma(beta);
	return { ct: g * (e.ct - beta * e.x), x: g * (e.x - beta * e.ct) };
}

/** The inverse transformation: platform coordinates of an event given in the train frame. */
export function toPlatform(e: Event, beta: number): Event {
	return toTrain(e, -beta);
}

/**
 * The spacetime interval s² = (c·Δt)² − Δx² between the origin and `e` (or
 * between two events). Positive: timelike (one event can cause the other);
 * negative: spacelike (no signal can link them); zero: lightlike.
 */
export function interval(e: Event, from: Event = { ct: 0, x: 0 }) {
	const dt = e.ct - from.ct;
	const dx = e.x - from.x;
	return dt * dt - dx * dx;
}

export type IntervalKind = 'timelike' | 'spacelike' | 'lightlike';
export function intervalKind(s2: number, eps = 1e-9): IntervalKind {
	return Math.abs(s2) <= eps ? 'lightlike' : s2 > 0 ? 'timelike' : 'spacelike';
}

/**
 * Relativistic addition of velocities: an object moving at `u` (in units of c)
 * inside the train has velocity (u + β) / (1 + u·β) relative to the platform.
 * Everyday arithmetic would say u + β.
 */
export function addVelocities(u: number, beta: number) {
	return (u + beta) / (1 + u * beta);
}

/** Velocity between two events (Δx / Δt, in units of c). */
export function velocity(a: Event, b: Event) {
	return (b.x - a.x) / (b.ct - a.ct);
}

// ------------------------------------------------------------------ light clock

/**
 * One tick of a light clock (light going from one mirror to the other and
 * back), in seconds, for mirrors `gap` metres apart, in the clock's own frame.
 */
export function tickAtRest(gap = MIRROR_GAP) {
	return (2 * gap) / C;
}

/**
 * The same tick timed from a frame in which the clock moves at β sideways: the
 * light runs along a zig-zag, so each tick lasts γ times longer.
 */
export function tickMoving(beta: number, gap = MIRROR_GAP) {
	// Half a tick: the light covers the hypotenuse c·T/2 of a triangle whose sides are
	// the gap and the distance v·T/2 the clock moves: (cT/2)² = gap² + (βcT/2)².
	return (2 * gap) / (C * Math.sqrt(1 - beta * beta));
}

/**
 * The light clock as a sequence of events in the train frame: the k-th tick
 * happens at c·t′ = k × 2·gap at the clock (x′ = 0). Returns them in platform
 * coordinates, so the platform's timing of the moving clock can be read off.
 */
export function clockTicks(beta: number, count: number, gap = 1): Event[] {
	return Array.from({ length: count }, (_, k) => toPlatform({ ct: k * 2 * gap, x: 0 }, beta));
}

// ------------------------------------------------------------------ lengths

/**
 * The length of the train as measured on the platform: where both ends are at
 * the same platform time. The train's ends move along x′ = ±L0/2.
 */
export function measuredLength(beta: number, restLength = TRAIN_LENGTH, atCt = 0) {
	const g = gamma(beta);
	// End at x′ = a moves along x = a/γ + β·c·t.
	const end = (a: number) => a / g + beta * atCt;
	return end(restLength / 2) - end(-restLength / 2);
}

// ------------------------------------------------------------------ Einstein's train

export interface Lightning {
	/** Strike at the back (left) end of the train, at the front (right) end. */
	back: Event;
	front: Event;
	/** The platform observer, standing midway between the scorch marks (x = 0). */
	platformMeets: Event;
	/** The passenger in the middle of the train meets the front flash, then the back one. */
	passengerFront: Event;
	passengerBack: Event;
}

/**
 * Einstein's train: lightning strikes both ends of a train of rest length L0
 * at the moment (platform time 0) its ends pass two marks on the platform.
 * Everything in platform coordinates, light units; the passenger sits in the
 * middle of the train (x′ = 0), the platform observer at x = 0.
 */
export function lightning(beta: number, restLength = TRAIN_LENGTH): Lightning {
	const half = restLength / (2 * gamma(beta));
	const back = { ct: 0, x: -half };
	const front = { ct: 0, x: half };
	// The passenger moves along x = β·ct; the front flash along x = half − ct.
	const tf = half / (1 + beta);
	const tb = half / (1 - beta);
	return {
		back,
		front,
		platformMeets: { ct: half, x: 0 },
		passengerFront: { ct: tf, x: beta * tf },
		passengerBack: { ct: tb, x: beta * tb }
	};
}

/**
 * How much earlier the front strike happens than the back strike, in the
 * train frame, in seconds: β·L0 / c.
 */
export function strikeGap(beta: number, restLength = TRAIN_LENGTH) {
	const l = lightning(beta, restLength);
	const dct = toTrain(l.back, beta).ct - toTrain(l.front, beta).ct;
	return dct / C;
}

// ------------------------------------------------------------------ muons

/**
 * How far a muon moving at β travels during one mean lifetime, in metres:
 * naively β·c·τ; with time dilation its lifetime on Earth's clocks is γ·τ.
 */
export function muonRange(beta: number) {
	return {
		naive: beta * C * MUON_LIFETIME,
		dilated: gamma(beta) * beta * C * MUON_LIFETIME,
		lifetime: gamma(beta) * MUON_LIFETIME
	};
}

// ------------------------------------------------------------------ formatting

/** A number for the stage: unicode minus, `d` decimals with trailing zeros cut. */
export function num(v: number, d = 2) {
	const r = Number(v.toFixed(d));
	const s = (Object.is(r, -0) ? 0 : r).toString();
	return s.replace('-', '−');
}
