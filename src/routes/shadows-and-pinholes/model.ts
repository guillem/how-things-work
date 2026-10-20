/**
 * Shadows and the pinhole camera, seen from the side: light travels in straight lines from a lamp,
 * a toy (a vertical bar) blocks some of the lines, and the wall shows where they arrive.
 *
 * Distances in metres along the floor (x) and up (y). The lamp is a vertical strip of light,
 * centred at height `y`, `size` tall (0 for a tiny bulb). The light reaching a point of the wall
 * is the share of the lamp's strip that the point can see past the toy.
 */

export interface Lamp {
	x: number;
	y: number;
	/** Height of the glowing part (m): 0 for a point-like bulb, larger for a lampshade. */
	size: number;
}

export interface Toy {
	x: number;
	/** Bottom and top of the toy (m). */
	bottom: number;
	top: number;
}

/**
 * The share (0-1) of the lamp a point (wallX, y) on the wall can see: the lamp's strip minus the
 * part hidden behind the toy, found by following the straight lines from the point past the toy's
 * two ends back to the lamp's plane.
 */
export function lit(lamp: Lamp, toy: Toy, wallX: number, y: number): number {
	// Where the line from the wall point through each end of the toy meets the lamp's plane.
	const k = (lamp.x - wallX) / (toy.x - wallX);
	const hideLow = y + (toy.bottom - y) * k;
	const hideHigh = y + (toy.top - y) * k;
	const lo = Math.min(hideLow, hideHigh);
	const hi = Math.max(hideLow, hideHigh);
	if (lamp.size <= 0) return lamp.y > lo && lamp.y < hi ? 0 : 1;
	const a = lamp.y - lamp.size / 2;
	const b = lamp.y + lamp.size / 2;
	const hidden = Math.max(0, Math.min(b, hi) - Math.max(a, lo));
	return 1 - hidden / (b - a);
}

/** The shadow a point-like lamp casts on the wall: its bottom, top and height (m). */
export function shadow(lamp: Lamp, toy: Toy, wallX: number) {
	const k = (wallX - lamp.x) / (toy.x - lamp.x);
	const bottom = lamp.y + (toy.bottom - lamp.y) * k;
	const top = lamp.y + (toy.top - lamp.y) * k;
	return { bottom, top, height: top - bottom };
}

/** How many times taller than the toy its shadow is. */
export const enlargement = (lamp: Lamp, toy: Toy, wallX: number) =>
	(wallX - lamp.x) / (toy.x - lamp.x);

/**
 * The soft edge of a wide lamp's shadow: the width (m) over which the wall goes from fully dark
 * to fully lit, at each end of the shadow.
 */
export const softEdge = (lamp: Lamp, toy: Toy, wallX: number) =>
	(lamp.size * (wallX - toy.x)) / (toy.x - lamp.x);

/** Light along the wall from y0 to y1, as [y, lit] samples (one lamp, or several added). */
export function wallLight(lamps: Lamp[], toy: Toy, wallX: number, y0: number, y1: number, n = 200) {
	return Array.from({ length: n + 1 }, (_, i) => {
		const y = y0 + ((y1 - y0) * i) / n;
		return [y, lamps.reduce((a, l) => a + lit(l, toy, wallX, y), 0)] as const;
	});
}

// ---- the pinhole camera ---------------------------------------------------------------------

export interface Pinhole {
	/** The pinhole's distance from the object, and the screen's distance behind the pinhole (m). */
	front: number;
	back: number;
	/** Diameter of the hole (m). */
	hole: number;
}

/**
 * Where a point of the object at height h (measured from the hole's height) lands on the box's
 * back wall: through the hole and on in a straight line, so upside down and scaled by back/front.
 */
export const imageOf = (p: Pinhole, h: number) => (-h * p.back) / p.front;

/** The geometric blur: each point of the object makes a spot this wide (m) on the back wall (diffraction ignored). */
export const blur = (p: Pinhole) => (p.hole * (p.front + p.back)) / p.front;

/** How bright the picture is, relative to a 1 mm hole: proportional to the hole's area. */
export const brightness = (p: Pinhole) => (p.hole / 0.001) ** 2;
