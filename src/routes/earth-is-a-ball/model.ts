/**
 * Earth is a ball: a ship sailing away over a flat sea and over the real, round one, seen from the
 * shore or a cliff, and the pull of a ball-shaped Earth on a person standing anywhere on it.
 *
 * Geometry: a sphere of the mean Earth radius (6,371 km, IUGG). Heights are measured straight up
 * from the sea. Without air the line of sight is straight; with air it bends gently downwards over
 * the sea, which the standard surveyors' allowance (refraction coefficient k = 0.13) models as a
 * straight line over a bigger Earth of radius R / (1 − k). Real refraction varies with the weather.
 *
 * Gravity: Newton's law summed over a ball of small pieces of equal density holding Earth's mass
 * (5.972 × 10²⁴ kg), so the direction of 'down' comes out of the sum rather than being assumed.
 */

/** Mean radius of the Earth, m (IUGG). */
export const R_EARTH = 6_371_000;
/** Standard refraction coefficient over land and sea (surveying; Gauss's value was 0.13). */
export const K_REFRACTION = 0.13;
/** Newton's gravitational constant, m³ kg⁻¹ s⁻² (CODATA 2018). */
export const G = 6.6743e-11;
/** Mass of the Earth, kg. */
export const M_EARTH = 5.972e24;

/** Height of a standing adult's eyes above the beach at the water's edge, m. */
export const EYE = 1.7;

/**
 * A tall sailing ship, heights above the water, m: the hull up to the deck rail, the sails, the
 * top of the tallest mast (about as tall as a twelve-storey building). Length 60 m.
 */
export const SHIP = { hull: 7, sailFoot: 9, top: 36, length: 60 } as const;

export type World = 'flat' | 'round';

/** The radius light behaves as if it travels over: the real one, or bigger with refraction. */
export const effectiveRadius = (refraction = false) =>
	refraction ? R_EARTH / (1 - K_REFRACTION) : R_EARTH;

/** Angle at the Earth's middle between the eye and its horizon, radians. */
const horizonAngle = (eye: number, R: number) => Math.acos(R / (R + eye));

/** Distance over the sea to the horizon from eyes `eye` metres up, m. */
export function horizonDistance(eye: number, refraction = false): number {
	const R = effectiveRadius(refraction);
	return R * horizonAngle(eye, R);
}

/**
 * How much of something at sea `d` metres away (measured along the sea) is hidden behind the
 * bulge of the sea, from eyes `eye` metres up, m: everything below this height is out of sight.
 */
export function hiddenHeight(d: number, eye: number, refraction = false): number {
	const R = effectiveRadius(refraction);
	const beyond = d / R - horizonAngle(eye, R);
	return beyond <= 0 ? 0 : R / Math.cos(beyond) - R;
}

/** How far the sea rises above a straight line drawn between two points of it `span` m apart, m. */
export function bulge(span: number): number {
	return R_EARTH * (1 - Math.cos(span / (2 * R_EARTH)));
}

/** How far the sea at distance `x` along it lies below the level surface at the shore, m. */
export function seaDrop(x: number): number {
	return R_EARTH * (1 - Math.cos(x / R_EARTH));
}

/**
 * The angle above (positive) or below (negative) eye level at which a point `y` m above the sea,
 * `d` m away along it, is seen, degrees. On a flat world the sea stays level for ever.
 */
export function elevation(y: number, d: number, eye: number, world: World): number {
	if (world === 'flat') return (Math.atan2(y - eye, d) * 180) / Math.PI;
	const R = R_EARTH;
	const th = d / R;
	const px = (R + y) * Math.sin(th);
	const py = (R + y) * Math.cos(th) - (R + eye);
	return (Math.atan2(py, px) * 180) / Math.PI;
}

/** The angle of the horizon below eye level, degrees (0 on a flat world: the sea's far edge). */
export function horizonDip(eye: number, world: World): number {
	return world === 'flat' ? 0 : (-horizonAngle(eye, R_EARTH) * 180) / Math.PI;
}

export interface ShipView {
	/** Height hidden behind the sea, m. */
	hidden: number;
	/** Share of the hull out of sight, 0 to 1. */
	hullHidden: number;
	/** Share of the whole ship out of sight, 0 to 1. */
	shipHidden: number;
	/** Angle from the waterline to the masthead as seen, degrees. */
	size: number;
}

/** What the watcher sees of the ship `d` m away. */
export function shipView(d: number, eye: number, world: World, refraction = false): ShipView {
	const hidden = world === 'flat' ? 0 : hiddenHeight(d, eye, refraction);
	return {
		hidden,
		hullHidden: Math.min(1, hidden / SHIP.hull),
		shipHidden: Math.min(1, hidden / SHIP.top),
		size: elevation(SHIP.top, d, eye, world) - elevation(0, d, eye, world)
	};
}

/** The distance at which the ship's part `height` m up sinks out of sight, m. */
export function sinksAt(height: number, eye: number, refraction = false): number {
	const R = effectiveRadius(refraction);
	return R * (horizonAngle(eye, R) + Math.acos(R / (R + height)));
}

/** The lowest eye height from which nothing of a ship `d` m away is hidden, m. */
export function eyeToSeeAll(d: number, refraction = false): number {
	const R = effectiveRadius(refraction);
	return d / R >= Math.PI / 2 ? Infinity : R / Math.cos(d / R) - R;
}

export interface Pull {
	/** Components of the pull, m/s²: x along the ground towards angle +90°, y up the Earth's axis. */
	x: number;
	y: number;
	z: number;
	/** Strength, m/s². */
	g: number;
	/** Angle between the pull and the direction to the Earth's middle, degrees. */
	offCentre: number;
}

/**
 * The pull of gravity on someone standing on the surface at `angle` degrees round a great circle
 * (0 = top of the drawing), summed over a ball of equal density cut into `shells` thin shells, each
 * cut into small pieces along a fixed grid of latitudes and longitudes (tilted against the circle
 * the person walks, so no piece is lined up with them on purpose).
 */
export function pullAt(angle: number, shells = 20, bands = 60): Pull {
	const a = (angle * Math.PI) / 180;
	const sx = R_EARTH * Math.sin(a);
	const sy = R_EARTH * Math.cos(a);
	const tilt = 0.4;
	const [ct, st] = [Math.cos(tilt), Math.sin(tilt)];
	const pieces: [number, number, number, number][] = [];
	let total = 0;
	for (let s = 0; s < shells; s++) {
		const r = ((s + 0.5) / shells) * R_EARTH;
		for (let i = 0; i < bands; i++) {
			const lat = -Math.PI / 2 + ((i + 0.5) * Math.PI) / bands;
			for (let j = 0; j < 2 * bands; j++) {
				const lon = ((j + 0.5) * Math.PI) / bands;
				const w = r * r * Math.cos(lat);
				const x = r * Math.cos(lat) * Math.cos(lon);
				const y0 = r * Math.sin(lat);
				const z0 = r * Math.cos(lat) * Math.sin(lon);
				pieces.push([x, y0 * ct - z0 * st, y0 * st + z0 * ct, w]);
				total += w;
			}
		}
	}
	let gx = 0;
	let gy = 0;
	let gz = 0;
	for (const [x, y, z, w] of pieces) {
		const dx = x - sx;
		const dy = y - sy;
		const r2 = dx * dx + dy * dy + z * z;
		const f = (G * M_EARTH * (w / total)) / (r2 * Math.sqrt(r2));
		gx += f * dx;
		gy += f * dy;
		gz += f * z;
	}
	const g = Math.hypot(gx, gy, gz);
	// The direction to the middle is (−sx, −sy, 0) / R.
	const cos = (-gx * sx - gy * sy) / (g * R_EARTH);
	return { x: gx, y: gy, z: gz, g, offCentre: (Math.acos(Math.min(1, cos)) * 180) / Math.PI };
}

/** Gravity at the surface of a ball with all of Earth's mass, m/s². */
export const surfaceGravity = () => (G * M_EARTH) / (R_EARTH * R_EARTH);

/** Seconds a dropped ball takes to fall `h` metres (no air resistance worth counting). */
export const fallTime = (h: number) => Math.sqrt((2 * h) / surfaceGravity());
