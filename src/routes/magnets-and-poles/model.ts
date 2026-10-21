/**
 * Bar magnets on a board, in the pole (Gilbert) picture. An evenly magnetised bar acts like a
 * sheet of "north" magnetic charge spread over one end face and an equal sheet of "south" charge
 * over the other (each with Br/μ0 per square metre). Like charges push, unlike ones pull, each
 * with a force that falls with the square of the distance; the field at a point (which a compass
 * needle and iron filings line up with) points away from north ends and towards south ends.
 * Each end face is integrated with a 3 × 3 Gauss rule. Positions are in centimetres on the
 * board, y down the screen, z out of the board (the bars lie with their middle at z = 0).
 *
 * The magnets are school ferrite bars 6 cm long with a 1 cm square end. Ferrite's remanence is
 * about 0.39 T, so each end carries a total pole strength of Br·A/μ0 ≈ 31 A·m. The Earth adds a
 * weak field of about 20 µT pointing north (up the board), as at mid-latitudes in Europe.
 */

export interface Vec {
	x: number;
	y: number;
	/** Height above the board's middle plane, cm (0 when left out). */
	z?: number;
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
/** Ferrite remanence, T. */
export const BR = 0.39;
/** Side of the bars' square end, cm. */
export const SIDE = 1;
/** Total pole strength of one end of the page's magnets, A·m. */
export const POLE = (BR * (SIDE / 100) ** 2) / MU0;
/** The Earth's horizontal field, T, pointing up the board (north). */
export const EARTH = 20e-6;

export const MAGNET_LENGTH = 6;

/** 3-point Gauss rule on [-1/2, 1/2]: offsets and weights (summing to 1). */
const GAUSS = [
	[-Math.sqrt(3 / 5) / 2, 5 / 18],
	[0, 8 / 18],
	[Math.sqrt(3 / 5) / 2, 5 / 18]
] as const;

/**
 * The magnetic charges of a magnet: its north end face first (nine points carrying +POLE in
 * all), then its south end face (−POLE).
 */
export function poles(m: Magnet, strength = POLE): Pole[] {
	const h = m.length / 2;
	const c = Math.cos(m.angle);
	const s = Math.sin(m.angle);
	const out: Pole[] = [];
	for (const sign of [1, -1]) {
		for (const [u, wu] of GAUSS) {
			for (const [v, wv] of GAUSS) {
				// u runs across the face in the board's plane, v up out of it.
				out.push({
					x: m.x + sign * h * c - u * SIDE * s,
					y: m.y + sign * h * s + u * SIDE * c,
					z: v * SIDE,
					q: sign * strength * wu * wv
				});
			}
		}
	}
	return out;
}

/** Magnetic moment of a magnet, A·m² (pole strength times length): it adds up over pieces. */
export const moment = (m: Magnet) => (POLE * m.length) / 100;

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
		const dz = ((p.z ?? 0) - (q.z ?? 0)) / 100;
		const r2 = dx * dx + dy * dy + dz * dz;
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
 * which are mostly iron. Austenitic stainless steel (the 18/8 kind of many spoons and sinks)
 * is hardly magnetic; aluminium, copper and gold are not either.
 */
export const MATERIALS = {
	nail: { name: 'iron nail', magnetic: true },
	clip: { name: 'steel paper clip', magnetic: true },
	nickel: { name: 'nickel strip', magnetic: true },
	spoon: { name: '18/8 stainless-steel spoon', magnetic: false },
	foil: { name: 'aluminium foil', magnetic: false },
	copper: { name: 'copper wire', magnetic: false },
	gold: { name: 'gold ring', magnetic: false }
} as const;

export type Material = keyof typeof MATERIALS;

/** The things the page puts under the magnet, in turn: pulled ones and ignored ones mixed. */
export const MATERIAL_ORDER: Material[] = [
	'nail',
	'spoon',
	'clip',
	'foil',
	'nickel',
	'copper',
	'gold'
];

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
 * A steel paper clip (a standard 28 mm one) hanging straight below a magnet's end. Soft steel in
 * a field becomes a magnet whose strength is limited by its own shape: for a long, thin object
 * magnetised along its length the apparent susceptibility is about 1/N, with N the
 * demagnetising factor of a prolate ellipsoid of the same proportions. The clip's three legs of
 * wire side by side make it about 8 times longer than it is thick.
 */
export const CLIP = { length: 2.8, aspect: 8, density: 7850 };

/** Apparent susceptibility of a soft-iron rod `aspect` times longer than thick (1/N). */
export function rodSusceptibility(aspect: number): number {
	const N = (Math.log(2 * aspect) - 1) / (aspect * aspect);
	return 1 / N;
}

/**
 * How many times its own weight a magnet pulls up on a clip hanging below its north end, with
 * the clip's top `gap` cm below it. For a thin induced magnet along the field, the pull per unit
 * cross-section is χ(B_top² − B_bottom²)/(2μ0), the weight ρ g ℓ: the clip's thickness cancels.
 */
export function clipLift(gap: number): number {
	const m: Magnet = { x: 0, y: 0, angle: Math.PI / 2, length: MAGNET_LENGTH };
	const ps = poles(m);
	const top = magnitude(field({ x: 0, y: MAGNET_LENGTH / 2 + gap }, ps));
	const bottom = magnitude(field({ x: 0, y: MAGNET_LENGTH / 2 + gap + CLIP.length }, ps));
	const chi = rodSusceptibility(CLIP.aspect);
	const pull = (chi * (top * top - bottom * bottom)) / (2 * MU0);
	return pull / (CLIP.density * 9.81 * (CLIP.length / 100));
}

/** The gap, cm, from which a clip below the magnet's end jumps up to it (its pull beats its weight). */
export function clipJumpGap(): number {
	let lo = 0;
	let hi = 10;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (clipLift(mid) > 1) lo = mid;
		else hi = mid;
	}
	return lo;
}

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
