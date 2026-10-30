/**
 * A forest fire on a square grid, the model of the NetLogo "Fire" library model (Wilensky 1997).
 * Every square holds a tree with the same chance, the density, independently of the others. The
 * trees of the left-hand column are lit; at every tick, each burning tree lights the trees that
 * touch its four sides and then burns out to ash. The fire has crossed the forest when it reaches
 * the right-hand column.
 *
 * Whether it gets there is site percolation: the fire crosses exactly when a chain of trees, each
 * touching the next along a side, runs from the left edge to the right edge. In a big forest the
 * chance of that jumps from almost 0 to almost 1 over a narrow band of density around the
 * site-percolation threshold of the square grid, 0.592746 (Newman & Ziff 2000, Phys. Rev. Lett.
 * 85:4104); with the corner trees counted as touching too, the threshold is 1 − 0.592746 = 0.407254, the
 * matching lattice's (Malarz & Galam 2005 measured 0.407, Phys. Rev. E 71:016125).
 *
 * Two additions from the topic's entry: a firebreak (a band of columns with no trees) and wind,
 * which also lets a burning tree light the trees up to `jump` squares beyond its downwind
 * (right-hand) neighbour, so the fire can leap a gap that narrow.
 */
import { rng } from '#lib/draw/math.ts';

export interface Forest {
	w: number;
	h: number;
	/** 1 where a square holds a tree, row by row from the top-left. */
	trees: Uint8Array;
}

export interface Firebreak {
	/** First cleared column. */
	from: number;
	/** How many columns are cleared. */
	width: number;
}

/**
 * Each square's own random number, the same for a given grid size and seed: a square holds a tree
 * when its number is below the density. So a denser forest of the same seed is the same forest with
 * trees added, never a reshuffled one.
 */
export function chances(w: number, h: number, seed: number) {
	const rand = rng(seed);
	return Float64Array.from({ length: w * h }, () => rand());
}

/** A forest of w × h squares, each holding a tree with chance `density`, minus a firebreak. */
export function plant(
	w: number,
	h: number,
	density: number,
	seed: number,
	firebreak?: Firebreak
): Forest {
	const u = chances(w, h, seed);
	const trees = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		const x = i % w;
		const cleared = firebreak && x >= firebreak.from && x < firebreak.from + firebreak.width;
		trees[i] = !cleared && u[i] < density ? 1 : 0;
	}
	return { w, h, trees };
}

export interface Rule {
	/** Corner trees count as touching too (eight neighbours instead of four). */
	corners?: boolean;
	/** Wind from the left: a burning tree also lights the trees up to this many squares past its right-hand neighbour. */
	jump?: number;
}

export interface Fire {
	/** The tick at which each square's tree caught fire (it burns during that tick), or -1. */
	lit: Int32Array;
	/**
	 * The square whose fire lit each tree: a touching one whenever one was burning, otherwise the
	 * one the wind carried it from (-1 for the left column and for trees that never burnt).
	 */
	from: Int32Array;
	/** The last tick at which a tree caught fire. */
	ticks: number;
	/** The right-most column the fire reached (-1 if the left column had no tree). */
	reach: number;
	/** The fire reached the right-hand column. */
	crossed: boolean;
	/** Trees that burnt, and trees in the forest. */
	burnt: number;
	trees: number;
}

/** Lights every tree of the left-hand column and lets the fire run until it goes out. */
export function burn(f: Forest, rule: Rule = {}): Fire {
	const { w, h, trees } = f;
	const lit = new Int32Array(w * h).fill(-1);
	const from = new Int32Array(w * h).fill(-1);
	const steps: [number, number][] = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	];
	if (rule.corners) steps.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
	for (let j = 1; j <= (rule.jump ?? 0); j++) steps.push([1 + j, 0]);

	let front: number[] = [];
	for (let y = 0; y < h; y++)
		if (trees[y * w]) {
			lit[y * w] = 0;
			front.push(y * w);
		}
	let tick = 0;
	let reach = front.length ? 0 : -1;
	let burnt = front.length;
	while (front.length) {
		const next: number[] = [];
		for (const i of front) {
			const x = i % w;
			const y = (i - x) / w;
			for (const [dx, dy] of steps) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
				const k = ny * w + nx;
				if (!trees[k]) continue;
				const touching = Math.abs(dx) <= 1;
				// Lit at this tick by the wind already: credit a touching tree instead.
				if (lit[k] === tick + 1 && touching && Math.abs((from[k] % w) - nx) > 1) from[k] = i;
				if (lit[k] >= 0) continue;
				lit[k] = tick + 1;
				from[k] = i;
				next.push(k);
				if (nx > reach) reach = nx;
			}
		}
		if (!next.length) break;
		tick++;
		burnt += next.length;
		front = next;
	}
	let count = 0;
	for (const t of trees) count += t;
	return { lit, from, ticks: tick, reach, crossed: reach === w - 1, burnt, trees: count };
}

/** The wind carried the fire to tree k: no tree touching it was burning the tick before. */
export const carried = (fire: Fire, w: number, k: number) =>
	fire.from[k] >= 0 && Math.abs((fire.from[k] % w) - (k % w)) > 1;

/** The fires of `forests` forests of size × size squares (seeds 1, 2, …), for a tally of how far each got. */
export function tally(size: number, density: number, forests: number, rule: Rule = {}) {
	return Array.from({ length: forests }, (_, k) => burn(plant(size, size, density, k + 1), rule));
}

// ---- the tipping density, forest by forest --------------------------------------------------------

/**
 * The density above which the fire crosses this forest (size × size squares, seed): the forest
 * grows tree by tree in the order of the squares' random numbers, and the threshold is the number
 * of the tree that first joins the left edge to the right edge. Union-find over the squares, with
 * two extra nodes for the edges. Wind isn't covered (it only carries the fire one way).
 */
export function threshold(size: number, seed: number, corners = false) {
	const n = size * size;
	const u = chances(size, size, seed);
	// The squares in order of their numbers: a numeric sort of (number, square) packed into one
	// float (the number's top 34 bits, then the square's 18; grids up to 512 × 512), far faster
	// than a sort with a comparator. Squares whose numbers agree to 34 bits come in index order.
	const keys = new Float64Array(n);
	for (let i = 0; i < n; i++) keys[i] = Math.floor(u[i] * 2 ** 34) * 2 ** 18 + i;
	keys.sort();
	const parent = new Int32Array(n + 2);
	for (let i = 0; i < n + 2; i++) parent[i] = i;
	const LEFT = n;
	const RIGHT = n + 1;
	const find = (a: number) => {
		while (parent[a] !== a) {
			parent[a] = parent[parent[a]];
			a = parent[a];
		}
		return a;
	};
	const join = (a: number, b: number) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent[ra] = rb;
	};
	const present = new Uint8Array(n);
	const near = (i: number, nx: number, ny: number) => {
		if (nx >= 0 && nx < size && ny >= 0 && ny < size && present[ny * size + nx])
			join(i, ny * size + nx);
	};
	for (let k = 0; k < n; k++) {
		const i = keys[k] % 2 ** 18;
		present[i] = 1;
		const x = i % size;
		const y = (i - x) / size;
		if (x === 0) join(i, LEFT);
		if (x === size - 1) join(i, RIGHT);
		near(i, x + 1, y);
		near(i, x - 1, y);
		near(i, x, y + 1);
		near(i, x, y - 1);
		if (corners) {
			near(i, x + 1, y + 1);
			near(i, x + 1, y - 1);
			near(i, x - 1, y + 1);
			near(i, x - 1, y - 1);
		}
		if (find(LEFT) === find(RIGHT)) return u[i];
	}
	return 1;
}

/** The tipping densities of `forests` forests (seeds 1, 2, …), sorted. */
export function thresholds(size: number, forests: number, corners = false) {
	return Float64Array.from({ length: forests }, (_, k) => threshold(size, k + 1, corners)).sort();
}

/** Share of forests the fire crosses at this density, from their sorted tipping densities. */
export function chanceToCross(sorted: Float64Array, density: number) {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid] < density) lo = mid + 1;
		else hi = mid;
	}
	return lo / sorted.length;
}

/** The density at which half the forests are crossed (the coin toss). */
export const coinToss = (sorted: Float64Array) => {
	const m = sorted.length >> 1;
	return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

/**
 * The density at which a share q of the forests are crossed (the smallest density at which at
 * least that share are), from their sorted tipping densities.
 */
export const atShare = (sorted: Float64Array, q: number) =>
	sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];

/** How many forests the page's chart plants at each size: fewer of the big ones, which take longer. */
export const CHART_FORESTS: Readonly<Record<number, number>> = {
	10: 400,
	20: 400,
	50: 400,
	100: 100,
	200: 40
};

/** For the reach bars: the right-most column the fire had reached by each tick. */
export function reachByTick(fire: Fire, w: number) {
	const out = new Int16Array(fire.ticks + 1).fill(-1);
	fire.lit.forEach((k, i) => {
		if (k >= 0) out[k] = Math.max(out[k], i % w);
	});
	for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1]);
	return out;
}

/**
 * Trees the fire never reached although a burnt tree touched them at a corner: the trees the
 * four-neighbour rule keeps safe (the close-up marks them).
 */
export function cornerSafe(f: Forest, fire: Fire) {
	const { w, h, trees } = f;
	const out: number[] = [];
	for (let i = 0; i < w * h; i++) {
		if (!trees[i] || fire.lit[i] >= 0) continue;
		const x = i % w;
		const y = (i - x) / w;
		const burnt = [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		].some(([dx, dy]) => {
			const nx = x + dx;
			const ny = y + dy;
			return nx >= 0 && nx < w && ny >= 0 && ny < h && fire.lit[ny * w + nx] >= 0;
		});
		if (burnt) out.push(i);
	}
	return out;
}

/** The page's forest: 50 × 50 squares, seed 1 (also the first of the tally's 30). */
export const PAGE = { size: 50, seed: 1, firebreakFrom: 24 } as const;
/** The close-up's forest. */
export const CLOSE = { w: 12, h: 8, density: 0.62, seed: 16 } as const;
