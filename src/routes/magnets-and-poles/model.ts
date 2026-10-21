/**
 * Bar magnets on a board, in the pole (Gilbert) picture: a slender, evenly magnetised bar acts
 * like a north pole at one end and an equal south pole at the other. Like poles push, unlike
 * poles pull, each with a force that falls with the square of the distance between them; the
 * field at a point (which a compass needle and iron filings line up with) points away from north
 * poles and towards south poles. Positions are in centimetres on the board, y down the screen.
 *
 * The magnets are school ferrite bars 6 cm long with a 1 cm square end. Ferrite's remanence is
 * about 0.39 T, so each end carries a pole strength of Br·A/μ0 ≈ 31 A·m. The Earth adds a weak
 * field of about 20 µT pointing north (up the board), as at mid-latitudes in Europe.
 */

export interface Vec {
	x: number;
	y: number;
}

export interface Magnet {
	/** Centre, cm. */
	x: number;
	y: number;
	/** Direction from the south end to the north end, radians (0: north end to the right). */
	angle: number;
	/** Length, cm. */
	length: number;
}

/** A point pole: strength in A·m, positive for north. */
export interface Pole extends Vec {
	q: number;
}

export const magnitude = (v: Vec) => Math.hypot(v.x, v.y);

const MU0 = 4e-7 * Math.PI;
/** Ferrite remanence, T, and the bar's end area, m². */
const BR = 0.39;
const AREA = 1e-4;
/** Pole strength of one end of the page's magnets, A·m. */
export const POLE = (BR * AREA) / MU0;
/** The Earth's horizontal field, T, pointing up the board (north). */
export const EARTH = 20e-6;

export const MAGNET_LENGTH = 6;

/**
 * The two poles of a magnet: north first. Each sits half a centimetre in from its end (or a sixth
 * of the length in, for a piece shorter than 3 cm).
 */
export function poles(m: Magnet, strength = POLE): [Pole, Pole] {
	const h = m.length / 2 - Math.min(0.5, m.length / 6);
	const c = Math.cos(m.angle);
	const s = Math.sin(m.angle);
	return [
		{ x: m.x + h * c, y: m.y + h * s, q: strength },
		{ x: m.x - h * c, y: m.y - h * s, q: -strength }
	];
}

/** The ends of a magnet (north end first), cm. */
export function ends(m: Magnet): [Vec, Vec] {
	const h = m.length / 2;
	const c = Math.cos(m.angle);
	const s = Math.sin(m.angle);
	return [
		{ x: m.x + h * c, y: m.y + h * s },
		{ x: m.x - h * c, y: m.y - h * s }
	];
}

/** Magnetic field at a point from some poles, T (vector). With `earth`, the Earth's adds in. */
export function field(p: Vec, ps: Pole[], earth = false): Vec {
	let bx = 0;
	let by = earth ? -EARTH : 0;
	for (const q of ps) {
		const dx = (p.x - q.x) / 100;
		const dy = (p.y - q.y) / 100;
		const r2 = dx * dx + dy * dy;
		if (r2 < 1e-10) continue;
		const k = (MU0 / (4 * Math.PI)) * (q.q / (r2 * Math.sqrt(r2)));
		bx += k * dx;
		by += k * dy;
	}
	return { x: bx, y: by };
}

/**
 * Which way a compass needle at `p` points (radians, 0: to the right, y down the screen), from the
 * magnets' poles and the Earth's field, and how many times stronger the magnets' field is there
 * than the Earth's.
 */
export function compass(p: Vec, ps: Pole[]): { angle: number; vsEarth: number } {
	const B = field(p, ps, true);
	return { angle: Math.atan2(B.y, B.x), vsEarth: magnitude(field(p, ps)) / EARTH };
}

/** Force on magnet `b` from magnet `a`, newtons (vector). */
export function force(a: Magnet, b: Magnet): Vec {
	let fx = 0;
	let fy = 0;
	for (const pb of poles(b)) {
		const B = field(pb, poles(a));
		fx += pb.q * B.x;
		fy += pb.q * B.y;
	}
	return { x: fx, y: fy };
}

/** Whether `a` pulls `b` towards itself (true) or pushes it away. */
export function pulls(a: Magnet, b: Magnet): boolean {
	const f = force(a, b);
	return f.x * (a.x - b.x) + f.y * (a.y - b.y) > 0;
}

/**
 * Two magnets end to end along a line, with `gap` cm between their facing ends. With `flip`,
 * the right one is turned round so that like ends face each other.
 */
export function inLine(gap: number, flip = false, y = 7.5, left = 4): [Magnet, Magnet] {
	const a: Magnet = { x: left + MAGNET_LENGTH / 2, y, angle: 0, length: MAGNET_LENGTH };
	const b: Magnet = {
		x: left + MAGNET_LENGTH + gap + MAGNET_LENGTH / 2,
		y,
		angle: flip ? Math.PI : 0,
		length: MAGNET_LENGTH
	};
	return [a, b];
}

/** How many times weaker the force gets when the gap between facing ends doubles. */
export function doublingRatio(gap: number): number {
	const [a, b] = inLine(gap);
	const [c, d] = inLine(2 * gap);
	return magnitude(force(a, b)) / magnitude(force(c, d));
}

/** Weight equivalent of a force, grams (what it could hold up against gravity). */
export const grams = (newtons: number) => (newtons / 9.81) * 1000;

/**
 * Materials a magnet pulls: the ferromagnetic metals (iron, nickel, cobalt) and most steels,
 * which are mostly iron. Austenitic stainless steel (the common 18/8 kind of spoons and sinks)
 * is not ferromagnetic; aluminium, copper and gold are not either.
 */
export const MATERIALS = {
	nail: { name: 'iron nail', magnetic: true },
	clip: { name: 'steel paper clip', magnetic: true },
	nickel: { name: 'nickel strip', magnetic: true },
	spoon: { name: 'stainless-steel spoon', magnetic: false },
	foil: { name: 'aluminium foil', magnetic: false },
	copper: { name: 'copper wire', magnetic: false },
	gold: { name: 'gold ring', magnetic: false }
} as const;

export type Material = keyof typeof MATERIALS;

/**
 * A magnet cut into `pieces` equal pieces along its length: every piece is a magnet with its
 * own north and south end, pointing the same way. (Its tiny magnetic regions all still point
 * one way, so new poles appear at each cut.)
 */
export function cut(m: Magnet, pieces: number, spacing = 0.6): Magnet[] {
	const len = m.length / pieces;
	const total = m.length + spacing * (pieces - 1);
	const c = Math.cos(m.angle);
	const s = Math.sin(m.angle);
	return Array.from({ length: pieces }, (_, i) => {
		const along = -total / 2 + len / 2 + i * (len + spacing);
		return { x: m.x + along * c, y: m.y + along * s, angle: m.angle, length: len };
	});
}

/**
 * How close (cm) the end of the page's magnets must come before a steel paper clip lying below
 * jumps up to it. Illustrative: it depends on the clip's weight and steel; with school ferrite
 * bars it is about a centimetre or two.
 */
export const CLIP_JUMP = 1.5;

/**
 * A steel clip near a magnet becomes a magnet itself: the magnet's field lines up the clip's tiny
 * magnetic regions along it, so the clip's north end is the one the field points towards. Returns
 * which pole the clip's end nearest the magnet becomes.
 */
export function inducedNearPole(m: Magnet, near: Vec, far: Vec): 'N' | 'S' {
	const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 };
	const B = field(mid, poles(m));
	return B.x * (far.x - near.x) + B.y * (far.y - near.y) > 0 ? 'S' : 'N';
}
