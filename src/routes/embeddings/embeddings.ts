/**
 * The model behind the embeddings explainer: real GloVe word vectors (see the header of
 * `glove-data.ts` for the source, licence and subset) and the arithmetic done on them.
 *
 * Every similarity, neighbour list and analogy is computed in the full 100-dimensional space with
 * cosine similarity, never on the 2-D maps (which are projections and distort distances).
 * Vectors are kept at unit length, so the cosine of two words is just their dot product.
 * Analogies follow the usual "3CosAdd" recipe (Mikolov et al. 2013): b − a + c with the three
 * unit vectors, then the word whose direction is closest, optionally leaving out the three
 * input words.
 *
 * The data is ~500 KB, so scenes load it with `import('./glove-data')` (see `load()`); nothing
 * else on the site imports it.
 */

import { rng } from '#lib/draw/math.ts';

interface GloveData {
	DIMS: number;
	WORDS: string;
	VECTORS: string;
	TSNE: string;
	PCA: string;
	CLUSTERS: string;
}

type MapKind = 'tsne' | 'pca';

export interface Neighbour {
	word: string;
	/** Cosine similarity with the query, −1 to 1. */
	cos: number;
}

function bytes(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}

function length(a: ArrayLike<number>): number {
	return Math.sqrt(dot(a, a));
}

/** cos θ = a·b / (|a| |b|); 0 when either vector is zero. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
	const n = length(a) * length(b);
	return n > 0 ? dot(a, b) / n : 0;
}

/** The angle between two vectors in degrees, 0–180. */
export function angleDeg(a: ArrayLike<number>, b: ArrayLike<number>): number {
	return (Math.acos(Math.max(-1, Math.min(1, cosine(a, b)))) * 180) / Math.PI;
}

export function unit(a: ArrayLike<number>): Float32Array {
	const n = length(a);
	return Float32Array.from(a, (x) => (n > 0 ? x / n : 0));
}

/** A word list's words, lower-cased: letters only, so "King's" → "king", "s". */
export function tokens(text: string): string[] {
	return text.toLowerCase().match(/[a-z]+/g) ?? [];
}

export class Embeddings {
	readonly dims: number;
	readonly words: string[];
	/** Unit vectors, row by row (`words.length × dims`). */
	readonly vectors: Float32Array;
	/** Cluster (0–11) of each word, from k-means in the full space. */
	readonly clusters: Uint8Array;
	readonly clusterCount: number;
	/** Map positions, x then y per word, scaled to −1…1. */
	readonly maps: Record<MapKind, Float32Array>;
	private readonly index: Map<string, number>;

	constructor(data: GloveData) {
		this.dims = data.DIMS;
		this.words = data.WORDS.split(' ');
		this.index = new Map(this.words.map((w, i) => [w, i]));
		const q = new Int8Array(bytes(data.VECTORS).buffer);
		const D = this.dims;
		this.vectors = new Float32Array(q.length);
		for (let i = 0; i < this.words.length; i++) {
			const row = q.subarray(i * D, (i + 1) * D);
			const n = length(row) || 1;
			for (let j = 0; j < D; j++) this.vectors[i * D + j] = row[j] / n;
		}
		const map = (b64: string) =>
			Float32Array.from(new Int16Array(bytes(b64).buffer), (v) => v / 32767);
		this.maps = { tsne: map(data.TSNE), pca: map(data.PCA) };
		this.clusters = Uint8Array.from(data.CLUSTERS, (c) => parseInt(c, 36));
		this.clusterCount = Math.max(...this.clusters) + 1;
	}

	get size(): number {
		return this.words.length;
	}

	has(word: string): boolean {
		return this.index.has(word);
	}

	indexOf(word: string): number {
		return this.index.get(word) ?? -1;
	}

	/** The unit vector of a word (a view into the table), or null if it is not in the list. */
	vector(word: string): Float32Array | null {
		const i = this.index.get(word);
		return i === undefined ? null : this.vectors.subarray(i * this.dims, (i + 1) * this.dims);
	}

	/** Cosine similarity of two words in the full space (null if either is missing). */
	similarity(a: string, b: string): number | null {
		const va = this.vector(a);
		const vb = this.vector(b);
		return va && vb ? dot(va, vb) : null;
	}

	/** The k words whose directions are closest to `query`, best first. */
	nearest(query: ArrayLike<number>, k = 10, exclude: Iterable<string> = []): Neighbour[] {
		const skip = new Set(exclude);
		const n = length(query);
		if (!(n > 0)) return [];
		const D = this.dims;
		const best: Neighbour[] = [];
		for (let i = 0; i < this.words.length; i++) {
			const w = this.words[i];
			if (skip.has(w)) continue;
			let s = 0;
			for (let j = 0; j < D; j++) s += this.vectors[i * D + j] * query[j];
			s /= n;
			if (best.length < k || s > best[best.length - 1].cos) {
				best.push({ word: w, cos: s });
				best.sort((x, y) => y.cos - x.cos);
				if (best.length > k) best.pop();
			}
		}
		return best;
	}

	/** A word's nearest neighbours (the word itself left out). */
	neighbours(word: string, k = 10): Neighbour[] {
		const v = this.vector(word);
		return v ? this.nearest(v, k, [word]) : [];
	}

	/**
	 * The analogy a : b :: c : ? computed as b − a + c (e.g. king − man + woman is
	 * a = man, b = king, c = woman), and the words closest to it. With `excludeInputs` the three
	 * input words are left out of the answers, as is usual (and as the page says).
	 */
	analogy(
		minus: string,
		plus: string,
		add: string,
		{ k = 5, excludeInputs = true } = {}
	): { vector: Float32Array; results: Neighbour[] } | null {
		const a = this.vector(minus);
		const b = this.vector(plus);
		const c = this.vector(add);
		if (!a || !b || !c) return null;
		const vector = Float32Array.from(b, (x, j) => x - a[j] + c[j]);
		const results = this.nearest(vector, k, excludeInputs ? [minus, plus, add] : []);
		return { vector, results };
	}

	/**
	 * A sentence as the average of the unit vectors of its known words. Words that are not in
	 * the list (including the short "stop words" such as "the", left out of the subset) are
	 * ignored and returned in `unknown`.
	 */
	sentence(text: string): { known: string[]; unknown: string[]; vector: Float32Array | null } {
		const known: string[] = [];
		const unknown: string[] = [];
		const sum = new Float32Array(this.dims);
		for (const w of tokens(text)) {
			const v = this.vector(w);
			if (!v) {
				unknown.push(w);
				continue;
			}
			known.push(w);
			for (let j = 0; j < this.dims; j++) sum[j] += v[j];
		}
		return {
			known,
			unknown,
			vector: known.length ? sum.map((x) => x / known.length) : null
		};
	}

	/** Cosine of two sentences' average vectors (null if either has no known word). */
	sentenceSimilarity(a: string, b: string): number | null {
		const va = this.sentence(a).vector;
		const vb = this.sentence(b).vector;
		return va && vb ? cosine(va, vb) : null;
	}

	/** Map position of a word, −1…1 on both axes. */
	position(kind: MapKind, i: number): [number, number] {
		const m = this.maps[kind];
		return [m[2 * i], m[2 * i + 1]];
	}

	/** The k words whose dots are closest to a word's dot on a map (2-D distance). */
	mapNeighbours(kind: MapKind, word: string, k = 10): string[] {
		const i = this.indexOf(word);
		if (i < 0) return [];
		const m = this.maps[kind];
		const x = m[2 * i];
		const y = m[2 * i + 1];
		const best: [number, number][] = [];
		for (let j = 0; j < this.words.length; j++) {
			if (j === i) continue;
			const d = (m[2 * j] - x) ** 2 + (m[2 * j + 1] - y) ** 2;
			if (best.length < k || d < best[best.length - 1][0]) {
				best.push([d, j]);
				best.sort((a, b) => a[0] - b[0]);
				if (best.length > k) best.pop();
			}
		}
		return best.map(([, j]) => this.words[j]);
	}

	/**
	 * How many of a word's k true nearest neighbours (100-D) are also among its k closest dots on
	 * a map: 1 means the map keeps that neighbourhood, 0 that it scatters it.
	 */
	kept(kind: MapKind, word: string, k = 10): number {
		const truth = new Set(this.neighbours(word, k).map((n) => n.word));
		return this.mapNeighbours(kind, word, k).filter((w) => truth.has(w)).length / k;
	}

	/** For each cluster, the `k` member words closest to its centre (its mean direction). */
	clusterNames(k = 3): string[][] {
		const D = this.dims;
		const sums = Array.from({ length: this.clusterCount }, () => new Float32Array(D));
		this.clusters.forEach((c, i) => {
			for (let j = 0; j < D; j++) sums[c][j] += this.vectors[i * D + j];
		});
		return sums.map((s, c) => {
			const members = this.words.filter((_, i) => this.clusters[i] === c);
			return members
				.map((w) => ({ w, s: dot(this.vector(w)!, s) }))
				.sort((x, y) => y.s - x.s)
				.slice(0, k)
				.map((m) => m.w);
		});
	}

	/**
	 * The average cosine between the steps of random word pairs (b − a against d − c, four words
	 * drawn with a fixed seed): the baseline the man → woman arrows are compared with.
	 */
	randomStepCosine(samples = 200, seed = 7): number {
		const r = rng(seed);
		const pick = () => this.vector(this.words[Math.floor(r() * this.words.length)])!;
		const step = () => {
			const a = pick();
			const b = pick();
			return Float32Array.from(b, (v, j) => v - a[j]);
		};
		let sum = 0;
		for (let i = 0; i < samples; i++) sum += cosine(step(), step());
		return sum / samples;
	}

	/**
	 * A linear view for word pairs (man → woman, king → queen…): the x axis is the average
	 * direction of the pairs' differences, the y axis the main direction along which the pairs
	 * themselves differ (first principal component of the pair midpoints, made perpendicular to
	 * x). Returns the two axes; project a vector v with (v·x, v·y). It is a 2 × 100 matrix, a
	 * linear map like those in the linear-transformations explainer, so arrows stay arrows.
	 */
	pairAxes(pairs: [string, string][]): { x: Float32Array; y: Float32Array } | null {
		const D = this.dims;
		const diffs: Float32Array[] = [];
		const mids: Float32Array[] = [];
		for (const [p, q] of pairs) {
			const a = this.vector(p);
			const b = this.vector(q);
			if (!a || !b) return null;
			diffs.push(Float32Array.from(b, (v, j) => v - a[j]));
			mids.push(Float32Array.from(b, (v, j) => (v + a[j]) / 2));
		}
		const x = unit(Float32Array.from({ length: D }, (_, j) => diffs.reduce((s, d) => s + d[j], 0)));
		// Midpoints with the x part removed, centred.
		const flat = mids.map((m) => {
			const k = dot(m, x);
			return Float32Array.from(m, (v, j) => v - k * x[j]);
		});
		const mean = Float32Array.from(
			{ length: D },
			(_, j) => flat.reduce((s, m) => s + m[j], 0) / flat.length
		);
		const centred = flat.map((m) => Float32Array.from(m, (v, j) => v - mean[j]));
		// Power iteration for the first principal component.
		let y = unit(Float32Array.from({ length: D }, (_, j) => 1 + j / D));
		for (let it = 0; it < 200; it++) {
			const next = new Float32Array(D);
			for (const c of centred) {
				const k = dot(c, y);
				for (let j = 0; j < D; j++) next[j] += k * c[j];
			}
			const k = dot(next, x);
			y = unit(next.map((v, j) => v - k * x[j]));
		}
		// A fixed orientation: the first pair's midpoint has a positive y.
		if (dot(centred[0], y) < 0) y = y.map((v) => -v);
		return { x, y };
	}
}

let loading: Promise<Embeddings> | null = null;

/** Loads (once) and decodes the word vectors. */
export function load(): Promise<Embeddings> {
	loading ??= import('./glove-data').then((m) => new Embeddings(m));
	return loading;
}
