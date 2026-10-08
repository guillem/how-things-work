/**
 * Direct-current circuits on a pegboard: parts sit on the edges between
 * neighbouring pegs, and the circuit is solved by nodal analysis
 * (Kirchhoff's current law at every peg, Ohm's law in every part).
 *
 * Simplifications, stated on the page where they matter:
 * - a bulb is a fixed resistance (a real filament's resistance rises several
 *   times as it heats up);
 * - a battery is a fixed voltage with a small internal resistance, 0.02 Ω (real ones
 *   have more, and it grows as they run down);
 * - wires and ammeters have a tiny resistance, voltmeters draw no current;
 * - everything is direct current and settles instantly.
 *
 * Signs: a part runs from peg `a` to peg `b`. Its current is positive when
 * conventional current (the direction positive charge would move; electrons
 * drift the other way) flows from a to b through it. A battery's positive
 * terminal is `b`: it lifts the potential from a to b by its voltage.
 */

export type PartKind = 'wire' | 'battery' | 'bulb' | 'resistor' | 'switch' | 'ammeter' | 'voltmeter';

export interface Part {
	kind: PartKind;
	a: number;
	b: number;
	/** Battery voltage (V) or resistance (Ω) for bulbs and resistors; defaults below. */
	value?: number;
	/** Switches: true when closed (conducting). */
	closed?: boolean;
}

export interface Board {
	cols: number;
	rows: number;
	parts: Part[];
}

export const WIRE_R = 1e-5;
export const BATTERY_R = 0.02;
export const BATTERY_V = 6;
export const BULB_R = 12;
export const RESISTOR_R = 12;
/** Above this current (A) anywhere, the circuit is treated as a short circuit. */
export const SHORT_CURRENT = 10;
/** A bulb at its rated power (6 V across 12 Ω = 3 W) glows at full brightness. */
export const BULB_RATED_W = (BATTERY_V * BATTERY_V) / BULB_R;
const GMIN = 1e-9;

export const defaultValue = (kind: PartKind) =>
	kind === 'battery' ? BATTERY_V : kind === 'bulb' ? BULB_R : kind === 'resistor' ? RESISTOR_R : 0;

export const valueOf = (p: Part) => p.value ?? defaultValue(p.kind);

/** Does this part let current through? */
export const conducts = (p: Part) =>
	p.kind === 'voltmeter' ? false : p.kind === 'switch' ? !!p.closed : true;

/** Resistance of a conducting part (Ω). */
export function resistance(p: Part) {
	switch (p.kind) {
		case 'bulb':
		case 'resistor':
			return Math.max(1e-3, valueOf(p));
		case 'battery':
			return BATTERY_R;
		default:
			return WIRE_R;
	}
}

// ------------------------------------------------------------ pegboard geometry

export const peg = (b: Pick<Board, 'cols'>, col: number, row: number) => row * b.cols + col;
export const pegCol = (b: Pick<Board, 'cols'>, id: number) => id % b.cols;
export const pegRow = (b: Pick<Board, 'cols'>, id: number) => Math.floor(id / b.cols);

/** Are two pegs neighbours (one step left/right/up/down)? */
export function adjacent(b: Pick<Board, 'cols' | 'rows'>, p: number, q: number) {
	const dc = Math.abs(pegCol(b, p) - pegCol(b, q));
	const dr = Math.abs(pegRow(b, p) - pegRow(b, q));
	return dc + dr === 1;
}

/** Index of the part on the edge between pegs p and q, or −1. */
export const partAt = (b: Board, p: number, q: number) =>
	b.parts.findIndex((x) => (x.a === p && x.b === q) || (x.a === q && x.b === p));

/** Places a part on an edge, replacing whatever was there. */
export function place(b: Board, part: Part): Board {
	if (!adjacent(b, part.a, part.b)) return b;
	const parts = b.parts.filter((x, i) => i !== partAt(b, part.a, part.b));
	return { ...b, parts: [...parts, part] };
}

export function removeAt(b: Board, p: number, q: number): Board {
	const i = partAt(b, p, q);
	return i < 0 ? b : { ...b, parts: b.parts.filter((_, k) => k !== i) };
}

/** Changes the part at index i (e.g. flip a switch or a battery). */
export function update(b: Board, i: number, change: Partial<Part>): Board {
	return { ...b, parts: b.parts.map((x, k) => (k === i ? { ...x, ...change } : x)) };
}

// ------------------------------------------------------------ text form (for params)

const CODES: Record<PartKind, string> = {
	wire: 'w',
	battery: 'B',
	bulb: 'L',
	resistor: 'R',
	switch: 'S',
	ammeter: 'A',
	voltmeter: 'V'
};
const KINDS = Object.fromEntries(Object.entries(CODES).map(([k, c]) => [c, k])) as Record<
	string,
	PartKind
>;

/** `cols x rows|code a b [value] [1 = closed];…`, e.g. `8x5|B 0 1;L 1 2 12;S 2 3 1`. */
export function serializeBoard(b: Board): string {
	const parts = b.parts.map((p) => {
		const bits = [CODES[p.kind], p.a, p.b];
		if (p.value !== undefined) bits.push(+p.value.toFixed(3));
		else if (p.kind === 'switch') bits.push(0);
		if (p.kind === 'switch') bits.push(p.closed ? 1 : 0);
		return bits.join(' ');
	});
	return `${b.cols}x${b.rows}|${parts.join(';')}`;
}

export function parseBoard(s: unknown): Board | null {
	if (typeof s !== 'string') return null;
	const m = /^(\d+)x(\d+)\|(.*)$/.exec(s);
	if (!m) return null;
	let b: Board = { cols: +m[1], rows: +m[2], parts: [] };
	for (const item of m[3] ? m[3].split(';') : []) {
		const [code, a, bb, value, closed] = item.split(' ');
		const kind = KINDS[code];
		if (!kind) return null;
		const part: Part = { kind, a: +a, b: +bb };
		if (kind === 'switch') part.closed = closed === '1';
		else if (value !== undefined) part.value = +value;
		if (![part.a, part.b].every((x) => Number.isInteger(x) && x >= 0 && x < b.cols * b.rows))
			return null;
		b = place(b, part);
	}
	return b;
}

// ------------------------------------------------------------ solving

export interface Solution {
	/** Potential of every peg (V), 0 at the negative terminal of a battery in its circuit. */
	v: number[];
	/** Current through every part (A), positive from a to b (conventional current). */
	current: number[];
	/** Voltage across every part, v[b] − v[a] (V). */
	voltage: number[];
	/** Power taken by every part (W); negative for a battery that delivers energy. */
	power: number[];
	/** Some current is above SHORT_CURRENT: a short circuit. */
	short: boolean;
	/** For each peg, the id of its group of pegs connected by conducting parts. */
	group: number[];
}

/** Solves A·x = b in place (Gaussian elimination, partial pivoting). */
function solveLinear(A: number[][], rhs: number[]): number[] {
	const n = rhs.length;
	for (let c = 0; c < n; c++) {
		let piv = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
		[A[c], A[piv]] = [A[piv], A[c]];
		[rhs[c], rhs[piv]] = [rhs[piv], rhs[c]];
		const d = A[c][c];
		if (Math.abs(d) < 1e-300) continue;
		for (let r = c + 1; r < n; r++) {
			const f = A[r][c] / d;
			if (f === 0) continue;
			for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
			rhs[r] -= f * rhs[c];
		}
	}
	const x = new Array(n).fill(0);
	for (let r = n - 1; r >= 0; r--) {
		let s = rhs[r];
		for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
		x[r] = Math.abs(A[r][r]) < 1e-300 ? 0 : s / A[r][r];
	}
	return x;
}

/**
 * Solves the circuit. Each conducting part is a conductance 1/R between its
 * pegs; a battery is its voltage in series with its internal resistance
 * (written as the equivalent current source in parallel with it). A tiny
 * leak from every peg to a common reference keeps unconnected pegs defined.
 */
export function solve(b: Board): Solution {
	const n = b.cols * b.rows;
	const G = Array.from({ length: n }, () => new Array(n).fill(0));
	const I = new Array(n).fill(0);
	for (let i = 0; i < n; i++) G[i][i] += GMIN;
	for (const p of b.parts) {
		if (!conducts(p)) continue;
		const g = 1 / resistance(p);
		G[p.a][p.a] += g;
		G[p.b][p.b] += g;
		G[p.a][p.b] -= g;
		G[p.b][p.a] -= g;
		if (p.kind === 'battery') {
			// Pushes current E/r out of the + terminal (b) into the circuit.
			const j = valueOf(p) * g;
			I[p.b] += j;
			I[p.a] -= j;
		}
	}
	const v = solveLinear(G, I);

	// Groups of pegs joined by conducting parts (union–find).
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	for (const p of b.parts) if (conducts(p)) parent[find(p.a)] = find(p.b);
	const group = Array.from({ length: n }, (_, i) => find(i));

	// Reference: 0 V at the negative terminal of the first battery in each group, else the
	// lowest potential in the group (an unpowered group sits at 0 V).
	const offset = new Map<number, number>();
	for (const p of b.parts)
		if (p.kind === 'battery' && !offset.has(group[p.a])) offset.set(group[p.a], v[p.a]);
	const lowest = new Map<number, number>();
	for (let i = 0; i < n; i++) lowest.set(group[i], Math.min(lowest.get(group[i]) ?? Infinity, v[i]));
	const vv = v.map((x, i) => {
		const g = group[i];
		const val = x - (offset.get(g) ?? lowest.get(g)!);
		return Math.abs(val) < 1e-9 ? 0 : val;
	});

	const current: number[] = [];
	const voltage: number[] = [];
	const power: number[] = [];
	for (const p of b.parts) {
		const u = vv[p.b] - vv[p.a];
		let i = 0;
		if (conducts(p)) {
			const r = resistance(p);
			i = p.kind === 'battery' ? (valueOf(p) - u) / r : -u / r;
		}
		if (Math.abs(i) < 1e-6) i = 0; // leaks through the tiny reference conductance
		current.push(i);
		voltage.push(Math.abs(u) < 1e-6 ? 0 : u);
		// Power taken from the circuit: for a resistor/bulb I²R; a battery delivers (negative).
		power.push(p.kind === 'battery' ? -i * u : i * i * (conducts(p) ? resistance(p) : 0));
	}
	return {
		v: vv,
		current,
		voltage,
		power,
		short: current.some((i) => Math.abs(i) > SHORT_CURRENT),
		group
	};
}

/** Bulb brightness from 0 to 1 (1 at the rated 3 W; capped). */
export const brightness = (watts: number) => Math.max(0, Math.min(1, watts / BULB_RATED_W));

// ------------------------------------------------------------ physical scale

/**
 * Electron drift speed in a copper wire for a current: v = I / (n·e·A), with
 * n = 8.5 × 10²⁸ free electrons per m³ and a 1 mm² cross-section. About
 * 0.04 mm/s at 0.5 A — the page's point is that this is very slow.
 */
export const driftSpeed = (amps: number, areaMm2 = 1) => amps / (8.5e28 * 1.602e-19 * areaMm2 * 1e-6);

// ------------------------------------------------------------ the circuits the page starts from

export const COLS = 7;
export const ROWS = 5;

type Spec = [PartKind, [number, number], [number, number], number?];

/** A board from parts given as [kind, [col, row] of a, [col, row] of b, value?]; switches start closed. */
function board(...specs: Spec[]): Board {
	let b: Board = { cols: COLS, rows: ROWS, parts: [] };
	for (const [kind, [ca, ra], [cb, rb], value] of specs) {
		const part: Part = { kind, a: peg(b, ca, ra), b: peg(b, cb, rb) };
		if (value !== undefined) part.value = value;
		if (kind === 'switch') part.closed = true;
		b = place(b, part);
	}
	return b;
}

/** Wires along a path of pegs. */
const wires = (...pts: [number, number][]): Spec[] =>
	pts.slice(1).map((p, i) => ['wire', pts[i], p] as Spec);

// Loops run round the rectangle with corners (1, 1) and (5, 3); the battery sits on the left
// side with its + terminal at the top, so conventional current goes clockwise.

/** One battery, one switch, one bulb in a single loop. */
export const SIMPLE = board(
	['battery', [1, 2], [1, 1]],
	['switch', [2, 1], [3, 1]],
	['bulb', [5, 1], [5, 2]],
	...wires([1, 1], [2, 1]),
	...wires([3, 1], [4, 1], [5, 1]),
	...wires([5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2])
);

/** The same loop with an ammeter on every side. */
export const AMMETERS = board(
	['battery', [1, 2], [1, 1]],
	['switch', [2, 1], [3, 1]],
	['ammeter', [3, 1], [4, 1]],
	['bulb', [5, 1], [5, 2]],
	['ammeter', [5, 2], [5, 3]],
	['ammeter', [3, 3], [2, 3]],
	...wires([1, 1], [2, 1]),
	...wires([4, 1], [5, 1]),
	...wires([5, 3], [4, 3], [3, 3]),
	...wires([2, 3], [1, 3], [1, 2])
);

/** The loop with a voltmeter across the battery and one across the bulb. */
export const VOLTMETERS = board(
	['battery', [1, 2], [1, 1]],
	['switch', [2, 1], [3, 1]],
	['bulb', [5, 1], [5, 2]],
	['voltmeter', [0, 2], [0, 1]],
	['voltmeter', [6, 2], [6, 1]],
	...wires([1, 1], [2, 1]),
	...wires([3, 1], [4, 1], [5, 1]),
	...wires([5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2]),
	...wires([1, 1], [0, 1]),
	...wires([1, 2], [0, 2]),
	...wires([5, 1], [6, 1]),
	...wires([5, 2], [6, 2])
);

/** A battery, a resistor and an ammeter: Ohm's law. */
export const OHM = board(
	['battery', [1, 2], [1, 1]],
	['ammeter', [2, 1], [3, 1]],
	['resistor', [5, 1], [5, 2]],
	['voltmeter', [6, 2], [6, 1]],
	...wires([1, 1], [2, 1]),
	...wires([3, 1], [4, 1], [5, 1]),
	...wires([5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2]),
	...wires([5, 1], [6, 1]),
	...wires([5, 2], [6, 2])
);

/** Two bulbs one after the other. */
export const SERIES = board(
	['battery', [1, 2], [1, 1]],
	['ammeter', [2, 1], [3, 1]],
	['bulb', [5, 1], [5, 2]],
	['bulb', [4, 3], [3, 3]],
	...wires([1, 1], [2, 1]),
	...wires([3, 1], [4, 1], [5, 1]),
	...wires([5, 2], [5, 3], [4, 3]),
	...wires([3, 3], [2, 3], [1, 3], [1, 2])
);

/** Two bulbs side by side, each on its own branch, with an ammeter on each branch and one by the battery. */
export const PARALLEL = board(
	['battery', [1, 2], [1, 1]],
	['ammeter', [1, 1], [2, 1]],
	['bulb', [3, 1], [3, 2]],
	['bulb', [5, 1], [5, 2]],
	['ammeter', [3, 2], [3, 3]],
	['ammeter', [5, 2], [5, 3]],
	...wires([2, 1], [3, 1], [4, 1], [5, 1]),
	...wires([5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2])
);

/** Parallel bulbs, each with its own switch, like the lights in a house. */
export const SWITCHES = board(
	['battery', [1, 2], [1, 1]],
	['switch', [3, 1], [3, 2]],
	['bulb', [3, 2], [3, 3]],
	['switch', [5, 1], [5, 2]],
	['bulb', [5, 2], [5, 3]],
	...wires([1, 1], [2, 1], [3, 1], [4, 1], [5, 1]),
	...wires([5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2])
);

/** Where the reader's own board starts: a battery and a bulb in a loop. */
export const STARTER = board(
	['battery', [1, 2], [1, 1]],
	['bulb', [5, 1], [5, 2]],
	...wires([1, 1], [2, 1], [3, 1], [4, 1], [5, 1]),
	...wires([5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2])
);

export const PRESETS: Record<string, Board> = {
	simple: SIMPLE,
	ammeters: AMMETERS,
	voltmeters: VOLTMETERS,
	ohm: OHM,
	series: SERIES,
	parallel: PARALLEL,
	switches: SWITCHES,
	starter: STARTER
};
