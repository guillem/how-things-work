/**
 * The elbow as a lever with two pullers: an adult's arm seen from the side, the upper arm hanging
 * straight down from the shoulder and the forearm hinged at the elbow.
 *
 * Lengths are in centimetres, with the elbow's hinge at (0, 0), x forward and y down (the way the
 * stage draws it). The elbow angle is how far the forearm has swung up from hanging straight down:
 * 0° straight, 90° level; the page bends it up to 130° (a real elbow goes a little further).
 *
 * - The biceps runs from the shoulder blade, just in front of the top of the upper arm, to a bump
 *   on the forearm about 4.5 cm from the hinge, on the side towards which it bends. Its pull is
 *   along the straight line between the two, so how far that line passes from the hinge (its
 *   lever) grows from about 1.5 cm with the arm straight to about 4.6 cm near a right angle, as
 *   measured on real arms (Murray, Delp & Buchanan 1995, J. Biomech. 28:513; Pigeon et al. 1996).
 * - The triceps pulls on the point of the elbow (the olecranon), its tendon wrapped round the back
 *   of the joint, so its lever stays near 2 cm at every angle (Murray et al. 1995).
 * - The forearm and hand weigh 2.2 % of the body, 1.5 kg for a 70 kg adult, with their centre of
 *   weight 17 cm from the elbow (Winter, Biomechanics and Motor Control of Human Movement, table
 *   4.1, with a 26 cm forearm). A bag hangs from the hand, 35 cm from the elbow.
 *
 * Forces are in kilograms' weight (what a bathroom scale would read), and the arm moves slowly,
 * so the turning effects about the elbow balance: pull × its lever = weight × its sideways
 * distance from the elbow, summed.
 */

/** Shoulder to elbow, cm. */
export const UPPER_ARM = 30;
/** Elbow to the middle of the hand (where a bag's handles hang), cm. */
export const HAND = 35;
/** Where the biceps grips the forearm: distance along it from the elbow, cm. */
export const BICEPS_GRIP = 4.5;
/** How far that bump stands out from the forearm's middle line, on the bending side, cm. */
const BICEPS_STANDOFF = 1.5;
/** The biceps' upper end, on the shoulder blade, cm from the elbow. */
const BICEPS_TOP = { x: 1.5, y: -UPPER_ARM };
/** The triceps' lever about the elbow, cm (its tendon wraps round the point of the elbow). */
export const TRICEPS_LEVER = 2;
/** Forearm and hand, kg, and the distance of their centre of weight from the elbow, cm. */
export const FOREARM_MASS = 1.5;
export const FOREARM_CENTRE = 17;
/** How far the elbow goes, degrees. */
export const STRAIGHT = 0;
export const FULLY_BENT = 130;

export interface Point {
	x: number;
	y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Unit vector along the forearm, from the elbow towards the hand. */
export function along(angle: number): Point {
	const a = rad(angle);
	return { x: Math.sin(a), y: Math.cos(a) };
}

/** Unit vector across the forearm, towards the side it bends to (the palm side). */
export function across(angle: number): Point {
	const a = rad(angle);
	return { x: Math.cos(a), y: -Math.sin(a) };
}

/** A point on the forearm: `d` cm along it from the elbow and `s` cm out towards the bending side. */
export function onForearm(angle: number, d: number, s = 0): Point {
	const u = along(angle);
	const n = across(angle);
	return { x: d * u.x + s * n.x, y: d * u.y + s * n.y };
}

/** The middle of the hand. */
export const hand = (angle: number) => onForearm(angle, HAND);

/** The biceps' two ends: on the shoulder blade, and on the forearm `grip` cm from the elbow. */
export function bicepsEnds(angle: number, grip = BICEPS_GRIP): [Point, Point] {
	return [BICEPS_TOP, onForearm(angle, grip, BICEPS_STANDOFF)];
}

/** Length of the biceps (with its tendons), end to end, cm. */
export function bicepsLength(angle: number, grip = BICEPS_GRIP): number {
	const [a, b] = bicepsEnds(angle, grip);
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/** How far the biceps' line of pull passes from the elbow's hinge: its lever, cm. */
export function bicepsLever(angle: number, grip = BICEPS_GRIP): number {
	const [a, b] = bicepsEnds(angle, grip);
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.abs(a.x * dy - a.y * dx) / Math.hypot(dx, dy);
}

/**
 * How much longer the triceps is than with the arm straight, cm: its tendon wraps round the point
 * of the elbow, so it pays out its lever's length for every radian the elbow bends.
 */
export function tricepsStretch(angle: number): number {
	return TRICEPS_LEVER * rad(angle - STRAIGHT);
}

/** Sideways (horizontal) distance of a point on the forearm from the elbow, cm. */
const reach = (angle: number, d: number) => d * Math.sin(rad(angle));

/**
 * The turning effect of the forearm's weight and a bag in the hand about the elbow, in kg × cm:
 * it tries to straighten the elbow.
 */
export function load(angle: number, bag: number): number {
	return bag * reach(angle, HAND) + FOREARM_MASS * reach(angle, FOREARM_CENTRE);
}

/** How hard the biceps must pull to hold the forearm and a bag still (or move them slowly), kg. */
export function bicepsPull(angle: number, bag: number, grip = BICEPS_GRIP): number {
	return Math.max(0, load(angle, bag)) / bicepsLever(angle, grip);
}

/**
 * Pressing the hand down on a table (or a bathroom scale on it) with the elbow at `angle`: the
 * table pushes up on the hand with `press` kg. The forearm's own weight helps press; the triceps
 * pulls the rest. Below the forearm's own share, the hand just rests there and nothing pulls.
 */
export function tricepsPull(press: number, angle = 90): number {
	return (
		Math.max(0, press * reach(angle, HAND) - FOREARM_MASS * reach(angle, FOREARM_CENTRE)) /
		TRICEPS_LEVER
	);
}

/** What a hand resting limp on a table presses with, kg: the forearm's share of its own weight. */
export const restingPress = (FOREARM_MASS * FOREARM_CENTRE) / HAND;

/** How much the biceps shortens as the elbow goes from `from` to `to` degrees, cm. */
export function bicepsShortening(from: number, to: number, grip = BICEPS_GRIP): number {
	return bicepsLength(from, grip) - bicepsLength(to, grip);
}

/** The angle (degrees) a hand at `p` (cm from the elbow) asks for, kept to the elbow's range. */
export function angleOf(p: Point, min = STRAIGHT, max = FULLY_BENT): number {
	// Forearm along (sin a, cos a): a = atan2(x, y).
	let a = (Math.atan2(p.x, p.y) * 180) / Math.PI;
	// Behind the arm, above the shoulder: whichever end is nearer.
	if (a < -90) a = max;
	return Math.max(min, Math.min(max, a));
}
