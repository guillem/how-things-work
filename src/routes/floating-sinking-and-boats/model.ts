/**
 * Archimedes' principle for whole objects in a brim-full tank, in kitchen units: centimetres,
 * grams and grams per cubic centimetre (so a cubic centimetre of water weighs a gram).
 *
 * A body pushes aside (displaces) the liquid below the surface; the liquid pushes it up with the
 * weight of that liquid. In a brim-full tank the displaced liquid is exactly what spills over.
 * A body hanging from a spring balance and lowered in "loses" that much weight; a body let go
 * floats if it can displace its own weight before it is completely under, and otherwise sinks.
 *
 * Densities are handbook values (see DENSITY); the bodies are sized to be ordinary kitchen
 * things. The hot-air balloon uses the same rule in air, with air's density from the ideal gas
 * law at sea-level pressure.
 */

/** Handbook densities, g/cm³ (room temperature). Sources in docs/DATA-SOURCES.md. */
export const DENSITY = {
	water: 1.0, // fresh water, 0.998 at 20 °C
	saltyWater: 1.2, // water with as much salt as it will take (saturated brine, 1.197 at 20 °C)
	oil: 0.92, // sunflower or other vegetable cooking oil
	granite: 2.7,
	steel: 7.85,
	pine: 0.5,
	apple: 0.8, // apples are about a quarter air
	egg: 1.08, // a fresh hen's egg; it gets lighter as it ages
	clay: 1.5, // oil-based modelling clay (plasticine)
	glass: 2.5
} as const;

export type Liquid = 'water' | 'saltyWater' | 'oil';

/** Shapes, in cm. A spheroid lies on its side: `a` is the long half-axis, `b` the upright one. */
export type Shape =
	| { kind: 'box'; w: number; d: number; h: number }
	| { kind: 'spheroid'; a: number; b: number }
	/** An open-topped box (a bowl, a pan, a boat) with walls and floor `t` thick. */
	| { kind: 'hull'; w: number; d: number; h: number; t: number };

export interface Body {
	name: string;
	shape: Shape;
	/** Grams, including any load (marbles in a bowl). */
	mass: number;
}

/** Height of the shape, cm. */
export function height(s: Shape): number {
	return s.kind === 'spheroid' ? 2 * s.b : s.h;
}

/** Volume of the material itself, cm³. */
export function solidVolume(s: Shape): number {
	if (s.kind === 'box') return s.w * s.d * s.h;
	if (s.kind === 'spheroid') return (4 / 3) * Math.PI * s.a * s.b * s.b;
	return s.w * s.d * s.h - (s.w - 2 * s.t) * (s.d - 2 * s.t) * (s.h - s.t);
}

/**
 * Volume below the surface when the bottom of the shape is `depth` cm under it, cm³. A hull
 * that is not flooded displaces its whole outside shape up to the waterline (the air inside
 * counts), which is why a bowl can float when a ball of the same clay cannot.
 */
export function submerged(s: Shape, depth: number): number {
	const h = Math.max(0, Math.min(depth, height(s)));
	if (s.kind === 'box' || s.kind === 'hull') return s.w * s.d * h;
	// A sphere cap of radius b, stretched by a/b along the long axis.
	return (s.a / s.b) * ((Math.PI * h * h * (3 * s.b - h)) / 3);
}

/** The most liquid the shape can push aside before it is completely under, cm³. */
export function maxDisplaced(s: Shape): number {
	return submerged(s, height(s));
}

export interface Settled {
	floats: boolean;
	/** How deep the bottom sits under the surface, cm (the full height when it sinks). */
	depth: number;
	/** Liquid pushed aside, g: its own mass when it floats, less when it sinks. */
	displaced: number;
}

/** Where a body comes to rest in a liquid of density `rho` (g/cm³). */
export function settle(body: Body, rho: number): Settled {
	const s = body.shape;
	if (body.mass >= rho * maxDisplaced(s)) {
		// It goes under. A hull floods, so only its walls push liquid aside.
		const v = s.kind === 'hull' ? solidVolume(s) : maxDisplaced(s);
		return { floats: false, depth: height(s), displaced: rho * v };
	}
	let lo = 0;
	let hi = height(s);
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (rho * submerged(s, mid) < body.mass) lo = mid;
		else hi = mid;
	}
	return { floats: true, depth: (lo + hi) / 2, displaced: body.mass };
}

/**
 * Lowering a body on a spring balance: the bottom `depth` cm under the surface (it never goes
 * deeper than where it would float, because then the string goes slack). Returns what the
 * balance reads and what has spilled into the cup, both in grams.
 */
export function lowered(body: Body, rho: number, depth: number) {
	const rest = settle(body, rho);
	const d = Math.max(0, Math.min(depth, rest.floats ? rest.depth : height(body.shape)));
	const spilled = rho * submerged(body.shape, d);
	return {
		depth: d,
		balance: Math.max(0, body.mass - spilled),
		spilled,
		slack: rest.floats && depth >= rest.depth
	};
}

// ---- the page's objects ---------------------------------------------------------------------

function made(name: string, shape: Shape, density: number): Body {
	return { name, shape, mass: density * solidVolume(shape) };
}

export const stone = made('stone', { kind: 'box', w: 6, d: 5, h: 4 }, DENSITY.granite);
export const apple = made('apple', { kind: 'spheroid', a: 3.8, b: 3.8 }, DENSITY.apple);
export const woodBlock = made('wooden block', { kind: 'box', w: 8, d: 5, h: 5 }, DENSITY.pine);
export const steelBall = made('steel ball', { kind: 'spheroid', a: 1.5, b: 1.5 }, DENSITY.steel);
export const clayBall = made('clay ball', { kind: 'spheroid', a: 2.5, b: 2.5 }, DENSITY.clay);
/** An egg lying on its side. */
export const egg = made('egg', { kind: 'spheroid', a: 2.8, b: 2.2 }, DENSITY.egg);
/** A small steel marble-sized ball, and a steel pan 16 cm across with 1 mm walls. */
export const smallSteelBall = made('steel ball', { kind: 'spheroid', a: 1, b: 1 }, DENSITY.steel);
export const steelPan = made(
	'steel pan',
	{ kind: 'hull', w: 16, d: 16, h: 8, t: 0.1 },
	DENSITY.steel
);

/** A glass marble 16 mm across, g. */
export const MARBLE = DENSITY.glass * (4 / 3) * Math.PI * 0.8 ** 3;

/**
 * The clay ball's lump pressed into an open bowl 8 cm square and 3 cm tall: the wall thickness
 * that uses exactly the same clay, found by bisection.
 */
export function clayBowl(marbles = 0): Body {
	const v = solidVolume(clayBall.shape);
	const w = 8;
	const h = 3;
	let lo = 0;
	let hi = 1.5;
	for (let i = 0; i < 60; i++) {
		const t = (lo + hi) / 2;
		if (solidVolume({ kind: 'hull', w, d: w, h, t }) < v) lo = t;
		else hi = t;
	}
	return {
		name: 'clay bowl',
		shape: { kind: 'hull', w, d: w, h, t: (lo + hi) / 2 },
		mass: clayBall.mass + marbles * MARBLE
	};
}

/** The first number of marbles that sinks the clay bowl. */
export function marblesToSink(): number {
	let n = 0;
	while (settle(clayBowl(n), DENSITY.water).floats) n++;
	return n;
}

// ---- the hot-air balloon --------------------------------------------------------------------

/** Air at sea-level pressure, kg/m³, from the ideal gas law. */
export function airDensity(celsius: number): number {
	const p = 101325;
	const M = 0.0289652; // kg/mol, dry air
	const R = 8.314462618;
	return (p * M) / (R * (celsius + 273.15));
}

/** A typical hot-air balloon: envelope volume (m³) and everything but its air (kg). */
export const BALLOON = { volume: 2500, load: 600, outside: 15 };

/** The balloon with its inside air at `inside` °C: what it weighs and the air it pushes aside, kg. */
export function balloon(inside: number) {
	const air = airDensity(inside) * BALLOON.volume;
	const weight = BALLOON.load + air;
	const pushed = airDensity(BALLOON.outside) * BALLOON.volume;
	return { insideAir: air, weight, pushed, rises: pushed > weight };
}

/** The lowest inside temperature, °C (to 0.1), at which the balloon rises. */
export function liftOffTemperature(): number {
	let lo = BALLOON.outside;
	let hi = 400;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (balloon(mid).rises) hi = mid;
		else lo = mid;
	}
	return hi;
}
