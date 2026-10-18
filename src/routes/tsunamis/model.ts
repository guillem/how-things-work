/**
 * The tsunami model: the linear shallow-water equations in one dimension, run on the real sea
 * floor along the great circle from the Japanese coast through the 2011 Tōhoku epicentre to
 * Crescent City, California (ETOPO 2022, see `data.ts`).
 *
 *   ∂η/∂t + ∂(h u)/∂x = 0        (water piles up where the flow converges)
 *   ∂u/∂t + g ∂η/∂x = 0          (a slope of the surface pushes the water downhill)
 *
 * η is the height of the sea surface above its rest level, u the current (the same from the
 * surface to the floor: that is what "shallow water" means), h the depth. On a staggered grid
 * (η at cell centres, u at the faces between them) with forward-backward time steps, which is
 * stable while √(g h) dt < dx. The coasts are walls (no flow through them): the shallowest wet
 * cell is MIN_DEPTH deep, and the wave reflects there. What the model leaves out, and the page
 * says: the wave's spreading sideways (one slice of the ocean: far-away heights are an upper
 * bound), the slight dispersion of the shortest parts, friction, breaking and run-up on land.
 */
import { DEPTH, DX_KM, GAUGE_KM, START_KM, STATIONS, type Station } from './data';

export { DEPTH, DX_KM, GAUGE_KM, START_KM, STATIONS, type Station };

/** Gravity, m/s². */
export const G = 9.81;
/** Shallowest wet cell, m: the coast is a wall here. */
export const MIN_DEPTH = 10;
/** Time step, s (stable for depths up to 9 km on 2 km cells). */
export const DT = 6;
/** Cells. */
export const N = DEPTH.length;
/** Distance along the track of the centre of cell i, km from the epicentre. */
export const kmOf = (i: number) => START_KM + i * DX_KM;
/** The cell whose centre is nearest `km`. */
export const cellAt = (km: number) =>
	Math.max(0, Math.min(N - 1, Math.round((km - START_KM) / DX_KM)));
/** The Japanese and the Californian coast, km along the track. */
export const JAPAN_KM = kmOf(0);
export const COAST_KM = kmOf(N - 1);

/** Speed of a shallow-water wave over depth h (m), m/s. */
export const shallowSpeed = (h: number) => Math.sqrt(G * Math.max(0, h));
/** m/s → km/h. */
export const kmh = (v: number) => v * 3.6;

/**
 * Speed of the crests of a water wave of the given period (s) over depth h (m), m/s, from the
 * full dispersion relation ω² = g k tanh(k h). Long waves (a tsunami) get √(g h); short ones
 * over deep water (a wind wave) get g T / 2π, whatever the depth.
 */
export function waveSpeed(period: number, h: number): number {
	const w = (2 * Math.PI) / period;
	// Newton on f(k) = g k tanh(k h) − ω², from the deep-water k
	let k = Math.max((w * w) / G, w / Math.sqrt(G * Math.max(h, 1e-3)));
	for (let it = 0; it < 50; it++) {
		const th = Math.tanh(k * h);
		const f = G * k * th - w * w;
		const df = G * th + G * k * h * (1 - th * th);
		const dk = f / df;
		k -= dk;
		if (Math.abs(dk) < 1e-12 * k) break;
	}
	return w / k;
}

// ---- the sea floor ---------------------------------------------------------------------------

/** The reader's changes to the sea floor. */
export interface FloorEdit {
	/**
	 * Replace the Californian continental slope and shelf by a straight ramp this many km long,
	 * from the floor at its foot up to the coast. Null keeps the real floor.
	 */
	rampKm?: number | null;
	/** A ridge rising to `top` m below the surface (0: an island) at `km` along the track. */
	ridge?: { km: number; top: number } | null;
}
/** Half-width of the ridge, km. */
export const RIDGE_KM = 40;

/** Depth of each cell, m; 0 marks land (an island). */
export function floorDepths(edit: FloorEdit = {}): Float64Array {
	const h = Float64Array.from(DEPTH, (d) => Math.max(MIN_DEPTH, d));
	if (edit.rampKm) {
		const foot = cellAt(COAST_KM - edit.rampKm);
		// the foot sits on the abyssal plain: the deepest floor within 100 km seaward of it
		let footDepth = h[foot];
		for (let i = Math.max(0, foot - 50); i <= foot; i++) footDepth = Math.max(footDepth, h[i]);
		for (let i = foot; i < N; i++) {
			const f = (i - foot) / (N - 1 - foot);
			h[i] = footDepth + (MIN_DEPTH - footDepth) * f;
		}
	}
	if (edit.ridge) {
		const { km, top } = edit.ridge;
		for (let i = 0; i < N; i++) {
			const bump = Math.exp(-(((kmOf(i) - km) / RIDGE_KM) ** 2));
			if (bump < 1e-3 || h[i] <= top) continue;
			h[i] = h[i] - (h[i] - top) * bump;
			if (h[i] < MIN_DEPTH) h[i] = 0;
		}
	}
	return h;
}

// ---- the earthquake --------------------------------------------------------------------------

/** Where the floor rises most, km along the track from the epicentre (between it and the trench). */
export const UPLIFT_KM = 110;
/** Width (1/e half-width) of the uplift, km. */
export const UPLIFT_WIDTH_KM = 45;
/** Where the floor sinks (under the coast side), km, its half-width, and its depth relative to the uplift. */
export const SINK_KM = -45;
export const SINK_WIDTH_KM = 40;
export const SINK_RATIO = 0.3;

/** The sea floor's sudden rise, m, at km along the track, for a peak uplift of `uplift` m. */
export function floorJump(km: number, uplift: number): number {
	return (
		uplift *
		(Math.exp(-(((km - UPLIFT_KM) / UPLIFT_WIDTH_KM) ** 2)) -
			SINK_RATIO * Math.exp(-(((km - SINK_KM) / SINK_WIDTH_KM) ** 2)))
	);
}

// ---- the run ---------------------------------------------------------------------------------

/** One record a minute at each watched cell. */
export const RECORD_S = 60;

export class Ocean {
	readonly h: Float64Array;
	/** Face depths (the shallower neighbour; 0 where one side is land, or at the coasts). */
	readonly hf: Float64Array;
	readonly eta: Float64Array;
	readonly u: Float64Array;
	/** Highest the surface has been at each cell, m. */
	readonly peak: Float64Array;
	/** Model time, s. */
	time = 0;
	readonly watched: number[];
	/** η at each watched cell, once a minute (index = minute). */
	readonly records: number[][];

	constructor(h: Float64Array, uplift: number, watchKm: number[] = []) {
		this.h = h;
		this.eta = new Float64Array(N);
		this.u = new Float64Array(N + 1);
		this.hf = new Float64Array(N + 1);
		for (let f = 1; f < N; f++) {
			const a = h[f - 1];
			const b = h[f];
			this.hf[f] = a > 0 && b > 0 ? Math.min(a, b) : 0;
		}
		for (let i = 0; i < N; i++) if (h[i] > 0) this.eta[i] = floorJump(kmOf(i), uplift);
		this.peak = Float64Array.from(this.eta, (v) => Math.max(0, v));
		this.watched = watchKm.map(cellAt);
		this.records = this.watched.map((i) => [this.eta[i]]);
	}

	step() {
		const { eta, u, hf, h, peak } = this;
		const a = (G * DT) / (DX_KM * 1000);
		for (let f = 1; f < N; f++) if (hf[f] > 0) u[f] -= a * (eta[f] - eta[f - 1]);
		const b = DT / (DX_KM * 1000);
		for (let i = 0; i < N; i++) {
			if (h[i] <= 0) continue;
			eta[i] -= b * (hf[i + 1] * u[i + 1] - hf[i] * u[i]);
			if (eta[i] > peak[i]) peak[i] = eta[i];
		}
		this.time += DT;
		if (this.time % RECORD_S === 0)
			this.watched.forEach((c, k) => this.records[k].push(this.eta[c]));
	}

	/** Runs to `seconds` of model time, at most `cap` steps (a slow frame falls behind). */
	advanceTo(seconds: number, cap = Infinity) {
		let n = 0;
		while (this.time + DT <= seconds + 1e-9 && n < cap) {
			this.step();
			n++;
		}
	}

	/** The furthest cell east of the source that the wave has reached (|η| over `level` m). */
	frontEast(level: number): number {
		const from = cellAt(UPLIFT_KM + 2 * UPLIFT_WIDTH_KM);
		let front = -1;
		for (let i = N - 1; i >= from; i--) {
			if (Math.abs(this.eta[i]) > level) {
				front = i;
				break;
			}
		}
		return front;
	}
}

/** The first crest of a record (one value a minute): the first local maximum above `level`. */
export function firstCrest(record: readonly number[], level: number) {
	for (let m = 1; m + 1 < record.length; m++) {
		const v = record[m];
		if (v > level && v >= record[m - 1] && v > record[m + 1]) return { minute: m, height: v };
	}
	return null;
}

/**
 * Travel time of a long wave from km `a` to km `b` along the profile, s: the sum of each cell's
 * width over its speed √(g h). What tsunami warning centres compute (on the whole ocean).
 */
export function travelTime(h: Float64Array, a: number, b: number): number {
	let s = 0;
	for (let i = cellAt(Math.min(a, b)); i < cellAt(Math.max(a, b)); i++)
		s += (DX_KM * 1000) / shallowSpeed(Math.max(h[i], MIN_DEPTH));
	return s;
}
