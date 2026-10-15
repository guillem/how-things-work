/**
 * The HP lattice model of protein folding (Dill, Biochemistry 24, 1501, 1985; Lau & Dill,
 * Macromolecules 22, 3986, 1989), in two dimensions.
 *
 * A protein is a chain of beads on a square grid, one bead per amino acid, each either
 * H (hydrophobic, water-repelling) or P (polar, water-attracting). Consecutive beads sit on
 * neighbouring grid points and no two beads share a point: a conformation is a
 * self-avoiding walk. The energy counts −1 ε for every pair of H beads that are grid
 * neighbours without being neighbours along the chain (a "topological contact"), the
 * model's stand-in for the hydrophobic effect: water-repelling side chains gain by
 * huddling together away from water. P beads score nothing.
 *
 * It is a toy, coarse-grained model: one bead per residue, two letters for twenty amino
 * acids, a flat grid for space, and no hydrogen bonds, charges or side-chain shapes. It is
 * kept because it is small enough to enumerate every shape exactly, and it reproduces the
 * qualitative facts the page needs: a unique compact fold with a hydrophobic core,
 * determined by the sequence, out of an exponential number of possible shapes.
 *
 * Self-folding uses Metropolis Monte Carlo (Metropolis et al., J. Chem. Phys. 21, 1087,
 * 1953) at a temperature T in units of ε/k_B, with the local moves of Lau & Dill (end
 * moves, corner flips, crankshafts) plus pivot moves (Lal 1969; Madras & Sokal, J. Stat.
 * Phys. 50, 109, 1988), which together reach every conformation.
 */
import { rng } from '#lib/draw/math.ts';

export type Residue = 'H' | 'P';
/** A grid point [x, y]; y increases upwards. */
export type Cell = readonly [number, number];
export type Fold = Cell[];

const key = (x: number, y: number) => `${x},${y}`;
const DIRS: Cell[] = [
	[1, 0],
	[0, 1],
	[-1, 0],
	[0, -1]
];

/**
 * Coordinates of a chain given by its turns: one letter per inner bead, L (left),
 * S (straight) or R (right). The first bond points along +x from the origin. A chain of n
 * beads has n − 2 turns. May overlap itself: see `selfAvoiding`.
 */
export function fromTurns(turns: string): Fold {
	const out: Fold = [
		[0, 0],
		[1, 0]
	];
	let d = 0;
	for (const c of turns) {
		d = (d + (c === 'L' ? 1 : c === 'R' ? 3 : 0)) % 4;
		const [x, y] = out[out.length - 1];
		out.push([x + DIRS[d][0], y + DIRS[d][1]]);
	}
	return out;
}

/** Turns of a chain (inverse of `fromTurns`, whatever the chain's position and orientation). */
export function toTurns(fold: Fold): string {
	let s = '';
	for (let i = 1; i < fold.length - 1; i++) {
		const ax = fold[i][0] - fold[i - 1][0];
		const ay = fold[i][1] - fold[i - 1][1];
		const bx = fold[i + 1][0] - fold[i][0];
		const by = fold[i + 1][1] - fold[i][1];
		const cross = ax * by - ay * bx;
		s += cross > 0 ? 'L' : cross < 0 ? 'R' : 'S';
	}
	return s;
}

/** The same shape seen in a mirror (L and R swapped). */
export const mirror = (turns: string) => turns.replace(/[LR]/g, (c) => (c === 'L' ? 'R' : 'L'));

/**
 * The canonical form of a shape up to rotation, translation and reflection: its first
 * turn away from straight is a left turn.
 */
export const canonical = (turns: string) => {
	const first = turns.replace(/S/g, '')[0];
	return first === 'R' ? mirror(turns) : turns;
};

/** Pairs of beads (i < j) that sit on the same grid point. */
export function clashes(fold: Fold): [number, number][] {
	const seen = new Map<string, number>();
	const out: [number, number][] = [];
	fold.forEach(([x, y], i) => {
		const k = key(x, y);
		const j = seen.get(k);
		if (j !== undefined) out.push([j, i]);
		else seen.set(k, i);
	});
	return out;
}

export const selfAvoiding = (fold: Fold) => clashes(fold).length === 0;

/** H–H topological contacts: H beads on neighbouring grid points that are not chain neighbours. */
export function contacts(seq: string, fold: Fold): [number, number][] {
	const at = new Map<string, number>();
	fold.forEach(([x, y], i) => at.set(key(x, y), i));
	const out: [number, number][] = [];
	fold.forEach(([x, y], i) => {
		if (seq[i] !== 'H') return;
		for (const [dx, dy] of [
			[1, 0],
			[0, 1]
		]) {
			const j = at.get(key(x + dx, y + dy));
			if (j !== undefined && seq[j] === 'H' && Math.abs(i - j) > 1)
				out.push(i < j ? [i, j] : [j, i]);
		}
	});
	return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Energy in units of ε: −1 per H–H contact. */
export const energy = (seq: string, fold: Fold) => 0 - contacts(seq, fold).length || 0;

/**
 * Calls `visit` with every self-avoiding walk of `steps` steps that starts at the origin
 * with a step along +x and whose first turn away from straight is to the left: every
 * shape exactly once up to rotation, translation and reflection. The walk array is
 * reused between calls.
 */
export function eachShape(steps: number, visit: (walk: Int8Array) => void): void {
	const n = steps + 1;
	const walk = new Int8Array(2 * n);
	const occupied = new Set<number>();
	const code = (x: number, y: number) => (x + 64) * 256 + (y + 64);
	walk[2] = 1;
	occupied.add(code(0, 0));
	if (n === 1) return visit(walk);
	occupied.add(code(1, 0));
	const grow = (i: number, d: number, turned: boolean) => {
		if (i === n) return visit(walk);
		const x = walk[2 * i - 2];
		const y = walk[2 * i - 1];
		// straight, left, then right (right only once the walk has turned left)
		for (const turn of turned ? [0, 1, 3] : [0, 1]) {
			const nd = (d + turn) % 4;
			const nx = x + DIRS[nd][0];
			const ny = y + DIRS[nd][1];
			const c = code(nx, ny);
			if (occupied.has(c)) continue;
			occupied.add(c);
			walk[2 * i] = nx;
			walk[2 * i + 1] = ny;
			grow(i + 1, nd, turned || turn === 1);
			occupied.delete(c);
		}
	};
	grow(2, 0, false);
}

/**
 * Number of self-avoiding walks of `steps` steps on the square lattice, counted from one
 * starting point in every direction (OEIS A001411), by exact enumeration.
 */
export function walkCount(steps: number): number {
	if (steps === 0) return 1;
	let shapes = 0;
	let straight = 0;
	eachShape(steps, (w) => {
		shapes++;
		if (w[2 * steps + 1] === 0 && w[2 * steps] === steps) straight++;
	});
	// Each bent shape stands for 4 rotations × 2 mirror images; the straight one for 4.
	return 8 * (shapes - straight) + 4 * straight;
}

/** Connective constant of the square lattice (Clisby & Jensen, J. Phys. A 45, 115202, 2012). */
export const MU = 2.6381585303279;
/** Critical exponent γ = 43/32 of 2D self-avoiding walks (Nienhuis, PRL 49, 1062, 1982). */
export const GAMMA = 43 / 32;

/**
 * Number of self-avoiding walks of `steps` steps for long chains, from the asymptotic law
 * c_n ≈ A μⁿ n^(γ−1), with A fixed by the exact count at `ref` steps (`exact`).
 */
export function walkCountEstimate(steps: number, ref: number, exact: number): number {
	return exact * Math.pow(MU, steps - ref) * Math.pow(steps / ref, GAMMA - 1);
}

export interface Landscape {
	/** Number of distinct shapes (up to rotation and reflection). */
	shapes: number;
	/** Number of shapes at each energy, from 0 down to `best`. */
	byEnergy: { energy: number; shapes: number }[];
	best: number;
	/** The lowest-energy shapes, as turn strings. */
	bestFolds: string[];
	/** One shape at each energy, picked at random (seeded), as turn strings, by energy. */
	examples: Map<number, string>;
}

/** Every shape of the chain, sorted by energy: the model's whole energy landscape. */
export function landscape(seq: string): Landscape {
	const n = seq.length;
	const h = [...seq].map((c) => c === 'H');
	const count = new Map<number, number>();
	let best = 0;
	let bestWalks: Int8Array[] = [];
	const exampleWalks = new Map<number, Int8Array>();
	const pick = rng(7);
	let shapes = 0;
	const at = new Map<number, number>();
	eachShape(n - 1, (w) => {
		shapes++;
		at.clear();
		for (let i = 0; i < n; i++) at.set((w[2 * i] + 64) * 256 + w[2 * i + 1] + 64, i);
		let e = 0;
		for (let i = 0; i < n; i++) {
			if (!h[i]) continue;
			const c = (w[2 * i] + 64) * 256 + w[2 * i + 1] + 64;
			for (const d of [256, 1]) {
				const j = at.get(c + d);
				if (j !== undefined && h[j] && Math.abs(i - j) > 1) e--;
			}
		}
		count.set(e, (count.get(e) ?? 0) + 1);
		// reservoir sampling: each shape at this energy is equally likely to be the example
		if (pick() * (count.get(e) ?? 1) < 1) exampleWalks.set(e, w.slice());
		if (e < best) {
			best = e;
			bestWalks = [];
		}
		if (e === best && bestWalks.length < 50) bestWalks.push(w.slice());
	});
	const byEnergy = [];
	for (let e = 0; e >= best; e--) byEnergy.push({ energy: e, shapes: count.get(e) ?? 0 });
	const turnsOf = (w: Int8Array) => {
		const fold: Fold = [];
		for (let i = 0; i < n; i++) fold.push([w[2 * i], w[2 * i + 1]]);
		return toTurns(fold);
	};
	const bestFolds = bestWalks.map(turnsOf);
	const examples = new Map([...exampleWalks].map(([e, w]) => [e, turnsOf(w)]));
	return { shapes, byEnergy, best, bestFolds, examples };
}

// ---- Monte Carlo ------------------------------------------------------------------------

export interface Frame {
	fold: Fold;
	energy: number;
	/** Lowest energy reached so far in the run. */
	best: number;
}

export interface RunOptions {
	/** Temperature in units of ε/k_B. */
	T: number;
	/** Monte Carlo move attempts between recorded frames. */
	movesPerFrame: number;
	frames: number;
	seed: number;
	/** Starting conformation (default: a straight chain). */
	start?: Fold;
	/** Fraction of attempts that are pivot moves (the rest are local moves). */
	pivot?: number;
}

/** The 7 non-identity symmetries of the square grid, as (x, y) → (ax + by, cx + dy). */
const SYMMETRIES: [number, number, number, number][] = [
	[0, -1, 1, 0],
	[-1, 0, 0, -1],
	[0, 1, -1, 0],
	[1, 0, 0, -1],
	[-1, 0, 0, 1],
	[0, 1, 1, 0],
	[0, -1, -1, 0]
];

/**
 * A Metropolis Monte Carlo run of the HP model at constant temperature, recorded every
 * `movesPerFrame` attempted moves. Deterministic for a given seed.
 */
export function run(seq: string, opts: RunOptions): Frame[] {
	const n = seq.length;
	const random = rng(opts.seed);
	const pivotShare = opts.pivot ?? 0.25;
	const start = opts.start ?? fromTurns('S'.repeat(n - 2));
	const xs = start.map((c) => c[0]);
	const ys = start.map((c) => c[1]);
	const occ = new Map<number, number>();
	const code = (x: number, y: number) => (x + 512) * 2048 + (y + 512);
	const rebuild = () => {
		occ.clear();
		for (let i = 0; i < n; i++) occ.set(code(xs[i], ys[i]), i);
	};
	rebuild();
	const isH = [...seq].map((c) => c === 'H');
	/** Contacts of bead i at (x, y), ignoring bead `skip` (its partner in a two-bead move). */
	const local = (i: number, x: number, y: number, skip = -1) => {
		if (!isH[i]) return 0;
		let e = 0;
		for (const [dx, dy] of DIRS) {
			const j = occ.get(code(x + dx, y + dy));
			if (j !== undefined && j !== i && j !== skip && isH[j] && Math.abs(i - j) > 1) e--;
		}
		return e;
	};
	const total = () => {
		let e = 0;
		for (let i = 0; i < n; i++) e += local(i, xs[i], ys[i]);
		return e / 2;
	};
	let E = total();
	let best = E;
	const accept = (dE: number) => dE <= 0 || random() < Math.exp(-dE / opts.T);
	const free = (x: number, y: number) => !occ.has(code(x, y));
	/** Moves bead i to (x, y) (the grid point is known to be free). */
	const place = (i: number, x: number, y: number) => {
		occ.delete(code(xs[i], ys[i]));
		xs[i] = x;
		ys[i] = y;
		occ.set(code(x, y), i);
	};

	/**
	 * Crankshaft: beads i and i + 1 form a U with i − 1 and i + 2 (a hairpin end); the pair
	 * swings over to the other side.
	 */
	const crankshaft = (i: number) => {
		if (i < 1 || i + 2 >= n) return;
		const ax = xs[i - 1];
		const ay = ys[i - 1];
		const cx = xs[i + 2];
		const cy = ys[i + 2];
		if (Math.abs(ax - cx) + Math.abs(ay - cy) !== 1) return;
		const dx = xs[i] - ax;
		const dy = ys[i] - ay;
		if (xs[i + 1] - cx !== dx || ys[i + 1] - cy !== dy) return;
		const x1 = ax - dx;
		const y1 = ay - dy;
		const x2 = cx - dx;
		const y2 = cy - dy;
		if (!free(x1, y1) || !free(x2, y2)) return;
		const before = local(i, xs[i], ys[i], i + 1) + local(i + 1, xs[i + 1], ys[i + 1], i);
		const after = local(i, x1, y1, i + 1) + local(i + 1, x2, y2, i);
		// the pair's contact with each other cannot change (they stay chain neighbours)
		const dE = after - before;
		if (accept(dE)) {
			place(i, x1, y1);
			place(i + 1, x2, y2);
			E += dE;
		}
	};

	const localMove = () => {
		const i = Math.floor(random() * n);
		if (i === 0 || i === n - 1) {
			// end move: the end bead swings to a free neighbour of its partner
			const p = i === 0 ? 1 : n - 2;
			const [dx, dy] = DIRS[Math.floor(random() * 4)];
			const x = xs[p] + dx;
			const y = ys[p] + dy;
			if (!free(x, y)) return;
			const dE = local(i, x, y) - local(i, xs[i], ys[i]);
			if (accept(dE)) {
				place(i, x, y);
				E += dE;
			}
			return;
		}
		const ax = xs[i - 1];
		const ay = ys[i - 1];
		const bx = xs[i + 1];
		const by = ys[i + 1];
		if (ax === bx || ay === by) return; // a straight stretch: no local move bends it
		// bead i sits at a corner: flip it across the corner's diagonal
		const x = ax + bx - xs[i];
		const y = ay + by - ys[i];
		const j = occ.get(code(x, y));
		// the far point is taken by the chain itself when i is one side of a U: swing the U
		// (picking either bead of the U proposes the same crankshaft, in both directions)
		if (j === i + 2) return crankshaft(i);
		if (j === i - 2) return crankshaft(i - 1);
		if (j !== undefined) return;
		const dE = local(i, x, y) - local(i, xs[i], ys[i]);
		if (accept(dE)) {
			place(i, x, y);
			E += dE;
		}
	};

	const pivotMove = () => {
		const k = 1 + Math.floor(random() * (n - 2));
		const [a, b, c, d] = SYMMETRIES[Math.floor(random() * SYMMETRIES.length)];
		// turn the shorter side of the chain about bead k
		const tail = k >= n / 2;
		const lo = tail ? k + 1 : 0;
		const hi = tail ? n : k;
		const nx: number[] = [];
		const ny: number[] = [];
		for (let i = lo; i < hi; i++) {
			const rx = xs[i] - xs[k];
			const ry = ys[i] - ys[k];
			const x = xs[k] + a * rx + b * ry;
			const y = ys[k] + c * rx + d * ry;
			const j = occ.get(code(x, y));
			if (j !== undefined && (j < lo || j >= hi)) return;
			nx.push(x);
			ny.push(y);
		}
		const ox = xs.slice();
		const oy = ys.slice();
		for (let i = lo; i < hi; i++) {
			xs[i] = nx[i - lo];
			ys[i] = ny[i - lo];
		}
		rebuild();
		const e = total();
		if (accept(e - E)) {
			E = e;
		} else {
			for (let i = 0; i < n; i++) {
				xs[i] = ox[i];
				ys[i] = oy[i];
			}
			rebuild();
		}
	};

	const frames: Frame[] = [];
	const snap = () => frames.push({ fold: xs.map((x, i) => [x, ys[i]] as Cell), energy: E, best });
	snap();
	for (let f = 1; f < opts.frames; f++) {
		for (let m = 0; m < opts.movesPerFrame; m++) {
			if (random() < pivotShare) pivotMove();
			else localMove();
			if (E < best) best = E;
		}
		snap();
	}
	return frames;
}

/** Fold translated so that its bounding box is centred on the origin. */
export function centred(fold: Fold): { x: number; y: number }[] {
	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (const [x, y] of fold) {
		x0 = Math.min(x0, x);
		x1 = Math.max(x1, x);
		y0 = Math.min(y0, y);
		y1 = Math.max(y1, y);
	}
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	return fold.map(([x, y]) => ({ x: x - cx, y: y - cy }));
}
