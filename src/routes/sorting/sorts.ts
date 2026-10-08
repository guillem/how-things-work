/**
 * The four sorting algorithms of the explainer, written so that every
 * comparison and every move is recorded. The scenes replay the recording; the
 * charts count the same operations on larger inputs. Nothing is simulated or
 * estimated: the counts are what these implementations actually do.
 *
 * Conventions (stated on the page where they matter):
 * - bubble sort stops early after a pass with no swaps;
 * - quick sort uses the last element of each range as the pivot (Lomuto
 *   partition), the textbook version — which is why already-sorted input is its
 *   worst case; library versions pick pivots more cleverly;
 * - merge sort is the top-down version. Its merge is shown as the sorted
 *   output growing from the left: when the right half's head is smaller it
 *   moves in front of the remaining left half (a "move"); the comparisons are
 *   exactly those of the usual merge through a temporary copy.
 */

export type Algorithm = 'bubble' | 'insertion' | 'merge' | 'quick';
export type Order = 'shuffled' | 'sorted' | 'reversed' | 'nearly';

export const ALGORITHMS: Algorithm[] = ['bubble', 'insertion', 'merge', 'quick'];
export const NAMES: Record<Algorithm, string> = {
	bubble: 'Bubble sort',
	insertion: 'Insertion sort',
	merge: 'Merge sort',
	quick: 'Quick sort'
};

export type Op =
	/** Compare the values at positions i and j. */
	| { kind: 'compare'; i: number; j: number }
	/** Swap the values at positions i and j. */
	| { kind: 'swap'; i: number; j: number }
	/** Take the bar at `from` out and insert it at `to` (< from); the bars between shift right. */
	| { kind: 'move'; from: number; to: number }
	/** Positions that are now in their final place. */
	| { kind: 'done'; from: number; to: number }
	/** The part of the array being worked on (merge, quick) and an optional pivot. */
	| { kind: 'focus'; lo: number; hi: number; pivot?: number };

export interface Counts {
	comparisons: number;
	/** Bars moved: one per swap, one per merge "move". */
	moves: number;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
	let a = seed >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The values 1…n in the requested order. "nearly": sorted, with a few neighbours swapped. */
export function makeInput(n: number, order: Order, seed = 1): number[] {
	const a = Array.from({ length: n }, (_, k) => k + 1);
	if (order === 'reversed') return a.reverse();
	const rand = rng(seed);
	if (order === 'shuffled') {
		for (let k = n - 1; k > 0; k--) {
			const j = Math.floor(rand() * (k + 1));
			[a[k], a[j]] = [a[j], a[k]];
		}
	} else if (order === 'nearly' && n > 1) {
		for (let s = 0; s < Math.max(1, Math.round(n / 10)); s++) {
			const k = Math.floor(rand() * (n - 1));
			[a[k], a[k + 1]] = [a[k + 1], a[k]];
		}
	}
	return a;
}

/**
 * Runs an algorithm on a copy of `input`. With `record` it returns every
 * operation; without, only the counts (fast, for the charts).
 */
export function run(algorithm: Algorithm, input: readonly number[], record = true) {
	const a = input.slice();
	const ops: Op[] = [];
	const counts: Counts = { comparisons: 0, moves: 0 };
	const emit = record ? (op: Op) => ops.push(op) : () => {};
	const less = (i: number, j: number) => {
		counts.comparisons++;
		emit({ kind: 'compare', i, j });
		return a[i] < a[j];
	};
	const swap = (i: number, j: number) => {
		counts.moves++;
		emit({ kind: 'swap', i, j });
		[a[i], a[j]] = [a[j], a[i]];
	};
	const n = a.length;

	if (algorithm === 'bubble') {
		for (let end = n - 1; end > 0; end--) {
			let swapped = false;
			for (let i = 0; i < end; i++) {
				if (less(i + 1, i)) {
					swap(i, i + 1);
					swapped = true;
				}
			}
			emit({ kind: 'done', from: end, to: end });
			if (!swapped) {
				emit({ kind: 'done', from: 0, to: end });
				break;
			}
		}
		emit({ kind: 'done', from: 0, to: n - 1 });
	} else if (algorithm === 'insertion') {
		for (let k = 1; k < n; k++) {
			emit({ kind: 'focus', lo: 0, hi: k });
			for (let i = k; i > 0 && less(i, i - 1); i--) swap(i, i - 1);
		}
		emit({ kind: 'done', from: 0, to: n - 1 });
	} else if (algorithm === 'merge') {
		const sort = (lo: number, hi: number) => {
			if (hi - lo < 1) return;
			const mid = (lo + hi) >> 1;
			sort(lo, mid);
			sort(mid + 1, hi);
			emit({ kind: 'focus', lo, hi });
			// The array holds: [merged so far][rest of left half][rest of right half].
			let k = lo;
			let leftLeft = mid - lo + 1;
			let r = mid + 1;
			while (leftLeft > 0 && r <= hi) {
				if (less(r, k)) {
					counts.moves++;
					emit({ kind: 'move', from: r, to: k });
					const v = a[r];
					a.copyWithin(k + 1, k, r);
					a[k] = v;
					r++;
				} else {
					leftLeft--;
				}
				k++;
			}
		};
		sort(0, n - 1);
		emit({ kind: 'done', from: 0, to: n - 1 });
	} else {
		const sort = (lo: number, hi: number) => {
			if (lo >= hi) {
				if (lo === hi) emit({ kind: 'done', from: lo, to: lo });
				return;
			}
			emit({ kind: 'focus', lo, hi, pivot: hi });
			let store = lo;
			for (let i = lo; i < hi; i++) {
				if (less(i, hi)) {
					if (i !== store) swap(i, store);
					store++;
				}
			}
			if (store !== hi) swap(store, hi);
			emit({ kind: 'done', from: store, to: store });
			sort(lo, store - 1);
			sort(store + 1, hi);
		};
		sort(0, n - 1);
		emit({ kind: 'done', from: 0, to: n - 1 });
	}
	return { sorted: a, ops, counts };
}

/** Applies one operation to the array in place. */
export function applyOp(a: number[], op: Op) {
	if (op.kind === 'swap') [a[op.i], a[op.j]] = [a[op.j], a[op.i]];
	else if (op.kind === 'move') {
		const v = a[op.from];
		a.copyWithin(op.to + 1, op.to, op.from);
		a[op.to] = v;
	}
}

/** The array after replaying the first `k` operations on `input`. */
export function replay(input: readonly number[], ops: readonly Op[], k: number): number[] {
	const a = input.slice();
	for (let s = 0; s < Math.min(k, ops.length); s++) {
		const op = ops[s];
		applyOp(a, op);
	}
	return a;
}

/**
 * A recorded run with a snapshot of the array every `every` operations, so
 * that any point of the replay costs at most `every` steps to rebuild.
 */
export function recording(algorithm: Algorithm, input: readonly number[], every = 32) {
	const { ops, counts } = run(algorithm, input, true);
	const snapshots: number[][] = [];
	const a = input.slice();
	for (let s = 0; s <= ops.length; s++) {
		if (s % every === 0) snapshots.push(a.slice());
		if (s === ops.length) break;
		applyOp(a, ops[s]);
	}
	const at = (k: number) => {
		const s = Math.max(0, Math.min(ops.length, Math.floor(k)));
		const base = Math.floor(s / every);
		return replay(snapshots[base], ops.slice(base * every, s), s - base * every);
	};
	/** Comparisons and writes among the first `k` operations. */
	const countAt = (k: number): Counts => {
		let comparisons = 0;
		let moves = 0;
		for (let s = 0; s < Math.min(k, ops.length); s++) {
			const op = ops[s];
			if (op.kind === 'compare') comparisons++;
			else if (op.kind === 'swap' || op.kind === 'move') moves++;
		}
		return { comparisons, moves };
	};
	return { input: input.slice(), ops, counts, at, countAt };
}

/** Comparisons needed to sort `n` items, averaged over `trials` shuffles (one run for fixed orders). */
export function comparisonsFor(algorithm: Algorithm, n: number, order: Order, trials = 5) {
	const runs = order === 'shuffled' || order === 'nearly' ? trials : 1;
	let total = 0;
	for (let s = 1; s <= runs; s++)
		total += run(algorithm, makeInput(n, order, s * 7919 + n), false).counts.comparisons;
	return total / runs;
}

/** Textbook growth of each algorithm's comparisons for shuffled input (for reference curves). */
export const growth = {
	quadratic: (n: number) => (n * (n - 1)) / 2,
	nlogn: (n: number) => (n > 1 ? n * Math.log2(n) : 0)
};
