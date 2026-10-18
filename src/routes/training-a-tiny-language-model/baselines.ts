/**
 * The n-gram baselines the loss curve is drawn against: character n-gram models counted from
 * the same training text as the transformer and smoothed by interpolated Kneser–Ney (Chen and
 * Goodman 1998, with one discount per order, D = n₁ / (n₁ + 2 n₂)), so every character of the
 * alphabet keeps a probability above zero and the validation cross-entropy is finite. The
 * counting machine of the n-gram page, unsmoothed, gives an unseen character probability 0 and
 * an infinite cross-entropy; smoothing is what makes it a fair baseline.
 *
 * The lowest order is interpolated with the uniform distribution over the alphabet.
 */

/** Key of the k characters of `codes` ending before position `end` (codes < 128). */
function key(codes: ArrayLike<number>, end: number, k: number) {
	let h = 0;
	for (let i = end - k; i < end; i++) h = h * 128 + codes[i] + 1;
	return h;
}

interface Order {
	/** count of each k-gram (raw at the top order, continuation counts below) */
	gram: Map<number, number>;
	/** sum of those counts over the k-gram's last character, per (k − 1)-character context */
	total: Map<number, number>;
	/** distinct characters seen after each context */
	types: Map<number, number>;
	/** the discount */
	D: number;
}

export class KneserNey {
	readonly n: number;
	readonly vocab: number;
	private readonly orders: Order[] = [];

	/** An `n`-gram model (n = 2: bigram) of `codes`, characters coded 0 … vocab − 1. */
	constructor(codes: ArrayLike<number>, n: number, vocab: number) {
		this.n = n;
		this.vocab = vocab;
		// raw counts of every k-gram, k = 1 … n
		const raw = [new Map<number, number>()];
		for (let k = 1; k <= n; k++) {
			const m = new Map<number, number>();
			for (let p = k; p <= codes.length; p++) {
				const h = key(codes, p, k);
				m.set(h, (m.get(h) ?? 0) + 1);
			}
			raw.push(m);
		}
		for (let k = 1; k <= n; k++) {
			let gram: Map<number, number>;
			if (k === n) gram = raw[k];
			else {
				// continuation count: how many distinct characters come before the k-gram
				gram = new Map();
				for (const h of raw[k + 1].keys()) {
					const tail = h % 128 ** k;
					gram.set(tail, (gram.get(tail) ?? 0) + 1);
				}
			}
			const total = new Map<number, number>();
			const types = new Map<number, number>();
			let n1 = 0;
			let n2 = 0;
			for (const [h, c] of gram) {
				const ctx = Math.floor(h / 128);
				total.set(ctx, (total.get(ctx) ?? 0) + c);
				types.set(ctx, (types.get(ctx) ?? 0) + 1);
				if (c === 1) n1++;
				else if (c === 2) n2++;
			}
			// Ney's estimate; with no k-gram seen exactly once it would be 0 and leave the lower
			// orders no probability, so a fixed 0.5 stands in
			const D = n1 > 0 ? n1 / (n1 + 2 * n2) : 0.5;
			this.orders.push({ gram, total, types, D });
		}
	}

	/** Probability of character `c` after the context ending before `end` in `codes`. */
	prob(codes: ArrayLike<number>, end: number, c: number): number {
		let p = 1 / this.vocab;
		const kmax = Math.min(this.n, end + 1);
		for (let k = 1; k <= kmax; k++) {
			const o = this.orders[k - 1];
			const ctx = key(codes, end, k - 1);
			const total = o.total.get(ctx) ?? 0;
			if (total === 0) continue; // context never seen: keep the lower order
			const g = o.gram.get(ctx * 128 + c + 1) ?? 0;
			const types = o.types.get(ctx) ?? 0;
			p = Math.max(g - o.D, 0) / total + ((o.D * types) / total) * p;
		}
		return p;
	}

	/**
	 * Mean cross-entropy (nats per character) of the characters of `codes` at `positions`, each
	 * predicted from the characters before it.
	 */
	crossEntropy(codes: ArrayLike<number>, positions: Iterable<number>): number {
		let s = 0;
		let n = 0;
		for (const p of positions) {
			s -= Math.log(this.prob(codes, p, codes[p]));
			n++;
		}
		return s / n;
	}
}
