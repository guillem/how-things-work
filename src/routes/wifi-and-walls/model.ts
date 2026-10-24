/**
 * Wi-Fi in a house, as a multi-wall path-loss model (the COST 231 multi-wall model without its
 * floor term): the router's signal weakens with distance as in free space, and loses a fixed
 * number of decibels at every wall or object the straight line from the router crosses. The
 * laptop then picks the fastest way of sending (modulation and coding scheme, MCS) whose minimum
 * signal strength it still has, from the IEEE 802.11 tables.
 *
 * Lengths are in metres, signal strengths in dBm (decibels above a milliwatt), losses in dB,
 * speeds in Mbit/s.
 *
 * What the model leaves out, as the page says: reflections and diffraction (a real house's
 * shadows fill in with signal bouncing off the other walls), furniture and people, and the
 * laptop's own, weaker, transmissions back to the router.
 */

export interface Point {
	x: number;
	y: number;
}

// ---- Bands --------------------------------------------------------------------------------------

export type Band = '2.4' | '5';

/**
 * The router's transmit power, dBm (EIRP): 100 mW, the European limit for 2.4 GHz Wi-Fi (ETSI EN
 * 300 328), used for both bands so that they compare fairly.
 */
export const TX_DBM = 20;

/** Centre frequency, GHz: channel 6 at 2.4 GHz; an 80 MHz channel over channels 36–48 at 5 GHz. */
export const FREQ_GHZ: Record<Band, number> = { '2.4': 2.437, '5': 5.21 };

const C = 299_792_458;

/**
 * Free-space path loss, dB, over `d` metres (Friis): 20 log₁₀(4π d f / c). Within half a metre of
 * the antenna the formula's far-field assumption fails; the model holds it at its 0.5 m value.
 */
export function freeSpaceLossDb(d: number, band: Band) {
	const f = FREQ_GHZ[band] * 1e9;
	return 20 * Math.log10((4 * Math.PI * Math.max(d, 0.5) * f) / C);
}

// ---- Materials ----------------------------------------------------------------------------------

export type Material = 'brick' | 'glass' | 'concrete' | 'water' | 'metal';

/**
 * Loss through a wall of NIST IR 6055 (W. C. Stone, "Electromagnetic Signal Attenuation in
 * Construction Materials", NIST, 1997), from its fitted curves of the mean received signal
 * relative to free space (`scripts/data/wifi-and-walls/nist-ir-6055.mjs` evaluates them). The
 * report measured 0.5–2 GHz and 3–8 GHz; at 2.44 GHz the page interpolates linearly between its
 * 2.0 and 3.0 GHz values. Brick: one 89 mm leaf (B1), 5.4 dB at 2 GHz and 15.1 dB at 3 GHz; glass:
 * a 6 mm pane (G25), 1.4 and 1.9 dB; concrete: 102 mm of plain concrete (C14), 14.9 and 23.5 dB.
 * At 5.2 GHz: 15.3, 1.0 and 23.4 dB.
 */
const NIST: Record<'brick' | 'glass' | 'concrete', { at2: number; at3: number; at52: number }> = {
	brick: { at2: 5.4, at3: 15.1, at52: 15.3 },
	glass: { at2: 1.4, at3: 1.9, at52: 1.0 },
	concrete: { at2: 14.9, at3: 23.5, at52: 23.4 }
};

/**
 * Water's relative permittivity at 25 °C as a Debye relaxation (U. Kaatze, J. Chem. Eng. Data 34,
 * 371, 1989: static 78.36, high-frequency 5.2, relaxation time 8.27 ps).
 */
export function waterPermittivity(fGHz: number) {
	const wt = 2 * Math.PI * fGHz * 1e9 * 8.27e-12;
	const de = (78.36 - 5.2) / (1 + wt * wt);
	return { real: 5.2 + de, imag: de * wt };
}

/** Absorption of a radio wave in water, dB per centimetre, from its permittivity. */
export function waterLossDbPerCm(fGHz: number) {
	const { real, imag } = waterPermittivity(fGHz);
	// Imaginary part of the complex refractive index √(ε' − jε'').
	const mod = Math.hypot(real, imag);
	const kappa = Math.sqrt((mod - real) / 2);
	const alpha = ((2 * Math.PI * fGHz * 1e9) / C) * kappa; // field, nepers per metre
	return (20 / Math.LN10) * alpha * 0.01;
}

/** Depth of water a ray crosses in the fish tank, cm. */
export const TANK_DEPTH_CM = 30;

/** Loss through one crossing of a material, dB. */
export function materialLossDb(material: Material, band: Band) {
	const f = FREQ_GHZ[band];
	switch (material) {
		case 'water':
			// Absorption only; the reflections at the glass and the water's surface add more.
			return waterLossDbPerCm(f) * TANK_DEPTH_CM;
		case 'metal':
			// A steel sheet reflects practically everything: its skin depth at these frequencies is
			// a few micrometres, so half a millimetre of it absorbs hundreds of decibels of what is
			// left. The model lets nothing through.
			return Infinity;
		default: {
			const m = NIST[material];
			return band === '5' ? m.at52 : m.at2 + (f - 2) * (m.at3 - m.at2);
		}
	}
}

// ---- Geometry -----------------------------------------------------------------------------------

export interface Wall {
	a: Point;
	b: Point;
	material: Material;
}

const P = (x: number, y: number): Point => ({ x, y });
const brick = (ax: number, ay: number, bx: number, by: number): Wall => ({
	a: P(ax, ay),
	b: P(bx, by),
	material: 'brick'
});

/** The house: 20 m by 12 m, its outside walls. */
export const HOUSE = { width: 20, height: 12 };

/**
 * The outside walls, one brick leaf each in the model (they only stand between the router and
 * next door's).
 */
export const OUTER_WALLS: Wall[] = [
	brick(0, 0, 20, 0),
	brick(20, 0, 20, 12),
	brick(20, 12, 0, 12),
	brick(0, 12, 0, 0)
];

/**
 * The inner walls, brick, as in many European homes, with open doorways. Six rooms in two rows of
 * three: the living room, the kitchen and the study at the front (top), the playroom, a bedroom
 * and the back bedroom behind them.
 */
export const INNER_WALLS: Wall[] = [
	// Between the rows: doors living room–playroom (6.5–7.5) and kitchen–bedroom (12.5–13.5).
	brick(0, 6, 6.5, 6),
	brick(7.5, 6, 12.5, 6),
	brick(13.5, 6, 20, 6),
	// Living room | kitchen, door 1–2; playroom | bedroom, door 10.5–11.5.
	brick(8, 0, 8, 1),
	brick(8, 2, 8, 10.5),
	brick(8, 11.5, 8, 12),
	// Kitchen | study, door 4.5–5.5; bedroom | back bedroom, door 7–8.
	brick(14, 0, 14, 4.5),
	brick(14, 5.5, 14, 7),
	brick(14, 8, 14, 12)
];

export const ROUTER: Point = P(1.2, 3);

/** Next door's router, just past the right-hand wall. */
export const NEIGHBOUR: Point = P(21.2, 9);

/**
 * The laptop's walk: from the sofa, through the kitchen and the bedroom, to the far corner of the
 * back bedroom.
 */
export const WALK: Point[] = [P(3.5, 4), P(8, 1.5), P(13, 4.5), P(13, 7.5), P(14, 7.5), P(19, 11)];

const walkLengths = WALK.slice(1).map((p, i) => Math.hypot(p.x - WALK[i].x, p.y - WALK[i].y));
const walkTotal = walkLengths.reduce((a, b) => a + b, 0);

/** Where the laptop is, `spot` from 0 (the sofa) to 100 (the far corner of the back bedroom). */
export function walkPoint(spot: number): Point {
	let s = (Math.min(100, Math.max(0, spot)) / 100) * walkTotal;
	for (let i = 0; i < walkLengths.length; i++) {
		if (s <= walkLengths[i] || i === walkLengths.length - 1) {
			const u = walkLengths[i] === 0 ? 0 : Math.min(1, s / walkLengths[i]);
			return {
				x: WALK[i].x + u * (WALK[i + 1].x - WALK[i].x),
				y: WALK[i].y + u * (WALK[i + 1].y - WALK[i].y)
			};
		}
		s -= walkLengths[i];
	}
	return WALK[WALK.length - 1];
}

/** The `spot` of the walk nearest to a point (for dragging the laptop). */
export function nearestSpot(p: Point): number {
	let best = 0;
	let bestD = Infinity;
	for (let spot = 0; spot <= 100; spot += 0.5) {
		const q = walkPoint(spot);
		const d = Math.hypot(q.x - p.x, q.y - p.y);
		if (d < bestD) {
			bestD = d;
			best = spot;
		}
	}
	return best;
}

// ---- Things to put in the way ------------------------------------------------------------------

export type Obstacle = 'none' | 'glass' | 'brick' | 'concrete' | 'tank' | 'fridge';

/** Where the laptop sits while things are put in the way: on the bed in the bedroom. */
export const BED_SPOT = 80;

/**
 * Centre of the spot in the living room where the obstacle goes: 3.3 m from the router, on the
 * straight line to the bed.
 */
export const OBSTACLE_AT: Point = (() => {
	const bed = walkPoint(BED_SPOT);
	const dx = bed.x - ROUTER.x;
	const dy = bed.y - ROUTER.y;
	const n = Math.hypot(dx, dy);
	return P(ROUTER.x + (3.3 * dx) / n, ROUTER.y + (3.3 * dy) / n);
})();

/** Unit vector along the obstacle: across the line from the router towards the hall. */
const ACROSS = (() => {
	const dx = OBSTACLE_AT.x - ROUTER.x;
	const dy = OBSTACLE_AT.y - ROUTER.y;
	const n = Math.hypot(dx, dy);
	return P(-dy / n, dx / n);
})();

/** Length of each obstacle, m: walls 2.4 m, a 1.2 m fish tank, a 70 cm fridge. */
export const OBSTACLE_LENGTH: Record<Exclude<Obstacle, 'none'>, number> = {
	glass: 2.4,
	brick: 2.4,
	concrete: 2.4,
	tank: 1.2,
	fridge: 0.7
};

const OBSTACLE_MATERIAL: Record<Exclude<Obstacle, 'none'>, Material> = {
	glass: 'glass',
	brick: 'brick',
	concrete: 'concrete',
	tank: 'water',
	fridge: 'metal'
};

/** The obstacle as a wall segment (none for 'none'). */
export function obstacleWall(o: Obstacle): Wall | null {
	if (o === 'none') return null;
	const h = OBSTACLE_LENGTH[o] / 2;
	return {
		a: P(OBSTACLE_AT.x - ACROSS.x * h, OBSTACLE_AT.y - ACROSS.y * h),
		b: P(OBSTACLE_AT.x + ACROSS.x * h, OBSTACLE_AT.y + ACROSS.y * h),
		material: OBSTACLE_MATERIAL[o]
	};
}

// ---- Signal -------------------------------------------------------------------------------------

/** Whether the segments pq and ab cross (touching at an end counts). */
function crosses(p: Point, q: Point, a: Point, b: Point) {
	const d = (q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x);
	if (d === 0) return false;
	const u = ((a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)) / d;
	const v = ((a.x - p.x) * (q.y - p.y) - (a.y - p.y) * (q.x - p.x)) / d;
	return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

/** The walls the straight line from `from` to `to` crosses. */
export function wallsCrossed(from: Point, to: Point, walls: readonly Wall[]) {
	return walls.filter((w) => crosses(from, to, w.a, w.b));
}

/** Signal strength, dBm, at `to` from a router at `from`: free space, less every wall crossed. */
export function signalDbm(from: Point, to: Point, band: Band, walls: readonly Wall[]) {
	const d = Math.hypot(to.x - from.x, to.y - from.y);
	let loss = freeSpaceLossDb(d, band);
	for (const w of walls) if (crosses(from, to, w.a, w.b)) loss += materialLossDb(w.material, band);
	return TX_DBM - loss;
}

// ---- Ways of sending ----------------------------------------------------------------------------

/**
 * The ways of sending (MCS) of 802.11n (2.4 GHz, 20 MHz channel) and 802.11ac (5 GHz, 80 MHz
 * channel), with two antennas sending two streams at once and the normal 800 ns guard interval.
 * `minDbm` is the standard's receiver minimum input sensitivity for each modulation and code rate
 * (IEEE Std 802.11-2020, the HT and VHT PHY receiver specifications): the weakest signal at which
 * a receiver must still read 90% of 4096-byte packets (HT) or 99% of them (VHT, which gives the
 * same levels for 20 MHz). Rates follow from the OFDM numbers: data subcarriers × bits per
 * subcarrier × code rate × streams, every 4 µs.
 */
interface Mode {
	name: string;
	bits: number;
	codeRate: number;
	/** Minimum signal for a 20 MHz channel, dBm; each doubling of the width adds 3 dB. */
	min20: number;
}
const MODES: Mode[] = [
	{ name: 'BPSK 1/2', bits: 1, codeRate: 1 / 2, min20: -82 },
	{ name: 'QPSK 1/2', bits: 2, codeRate: 1 / 2, min20: -79 },
	{ name: 'QPSK 3/4', bits: 2, codeRate: 3 / 4, min20: -77 },
	{ name: '16-QAM 1/2', bits: 4, codeRate: 1 / 2, min20: -74 },
	{ name: '16-QAM 3/4', bits: 4, codeRate: 3 / 4, min20: -70 },
	{ name: '64-QAM 2/3', bits: 6, codeRate: 2 / 3, min20: -66 },
	{ name: '64-QAM 3/4', bits: 6, codeRate: 3 / 4, min20: -65 },
	{ name: '64-QAM 5/6', bits: 6, codeRate: 5 / 6, min20: -64 },
	{ name: '256-QAM 3/4', bits: 8, codeRate: 3 / 4, min20: -59 },
	{ name: '256-QAM 5/6', bits: 8, codeRate: 5 / 6, min20: -57 }
];

/** Streams sent at once (a laptop with two antennas, the usual kind). */
export const STREAMS = 2;

const CHANNEL: Record<Band, { width: number; subcarriers: number; modes: number }> = {
	// 802.11n stops at 64-QAM 5/6.
	'2.4': { width: 20, subcarriers: 52, modes: 8 },
	'5': { width: 80, subcarriers: 234, modes: 10 }
};

export interface Rung {
	/** MCS index (per stream). */
	mcs: number;
	name: string;
	/** Weakest signal it works with, dBm. */
	minDbm: number;
	/** Link speed, Mbit/s. */
	mbit: number;
}

/** The ladder of ways of sending for a band, slowest first. */
export function ladder(band: Band): Rung[] {
	const ch = CHANNEL[band];
	const widen = 10 * Math.log10(ch.width / 20);
	return MODES.slice(0, ch.modes).map((m, mcs) => ({
		mcs,
		name: m.name,
		minDbm: Math.round(m.min20 + widen),
		mbit: (ch.subcarriers * m.bits * m.codeRate * STREAMS) / 4
	}));
}

/** The fastest rung a signal of `dbm` still allows, or null: no link at all. */
export function linkRung(dbm: number, band: Band): Rung | null {
	let best: Rung | null = null;
	for (const r of ladder(band)) if (dbm >= r.minDbm) best = r;
	return best;
}

// ---- Taking turns -------------------------------------------------------------------------------

/**
 * A Wi-Fi radio waits while it hears another one sending on its channel: 802.11 requires it to
 * treat the channel as busy for any Wi-Fi signal it receives at −82 dBm or more (the clear
 * channel assessment for a 20 MHz channel).
 */
export const HEAR_DBM = -82;

export type Neighbour = 'off' | 'same' | 'other';

/**
 * Next door's router's strength at our router and at the laptop, and whether the two networks
 * must take turns: they share the channel if either of ours hears it. With both networks busy,
 * each gets the air half the time.
 */
export function sharing(laptop: Point, band: Band, neighbour: Neighbour, walls: readonly Wall[]) {
	const atRouter = signalDbm(NEIGHBOUR, ROUTER, band, walls);
	const atLaptop = signalDbm(NEIGHBOUR, laptop, band, walls);
	const heard = Math.max(atRouter, atLaptop) >= HEAR_DBM;
	const share = neighbour === 'same' && heard ? 0.5 : 1;
	return { atRouter, atLaptop, heard, share };
}

// ---- The whole picture --------------------------------------------------------------------------

export interface Setup {
	band: Band;
	walls: boolean;
	obstacle: Obstacle;
	neighbour: Neighbour;
}

export const DEFAULT_SETUP: Setup = {
	band: '2.4',
	walls: true,
	obstacle: 'none',
	neighbour: 'off'
};

/** Every wall in the house for a setup (the outside ones always; the inner ones if built). */
export function wallsOf(s: Setup): Wall[] {
	const ob = obstacleWall(s.obstacle);
	return [...OUTER_WALLS, ...(s.walls ? INNER_WALLS : []), ...(ob ? [ob] : [])];
}

/** What the laptop at `spot` gets: signal, way of sending, link speed and its share of the air. */
export function link(spot: number, s: Setup) {
	const at = walkPoint(spot);
	const walls = wallsOf(s);
	const dbm = signalDbm(ROUTER, at, s.band, walls);
	const rung = linkRung(dbm, s.band);
	const turns = sharing(at, s.band, s.neighbour, walls);
	return {
		at,
		dbm,
		rung,
		/** Link speed, Mbit/s, before sharing. */
		mbit: rung?.mbit ?? 0,
		/** What the laptop gets of it once the networks take turns, Mbit/s. */
		yours: (rung?.mbit ?? 0) * turns.share,
		crossed: wallsCrossed(ROUTER, at, walls),
		turns
	};
}

/** What a download gets: the slower of the Wi-Fi link and the line out of the house, Mbit/s. */
export const downloadMbit = (wifiMbit: number, lineMbit: number) => Math.min(wifiMbit, lineMbit);

/** Speeds of the line into the house the page offers, Mbit/s: from old copper to fast fibre. */
export const LINE_SPEEDS = [10, 30, 100, 300, 1000];

/** The signal map: signal strength, dBm, at the centre of each cell of a `cols` × `rows` grid. */
export function signalMap(s: Setup, cols: number, rows: number) {
	const walls = wallsOf(s);
	const out = new Float32Array(cols * rows);
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			const p = P(((i + 0.5) / cols) * HOUSE.width, ((j + 0.5) / rows) * HOUSE.height);
			out[j * cols + i] = signalDbm(ROUTER, p, s.band, walls);
		}
	}
	return out;
}
