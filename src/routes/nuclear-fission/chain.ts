/**
 * The chain reaction scene's two pictures, built from the branching process
 * in `model.ts`: a family tree of a few generations (who split whom, and
 * where the other neutrons went) and the long run of neutron counts.
 */
import { hash } from '#lib/draw/math.ts';
import { P_THREE, U235 } from './model';

/** The long run: 1,000 neutrons followed for 40 generations. */
export const CHAIN_N0 = 1000;
export const CHAIN_GENERATIONS = 40;
/**
 * The page's seed. Chosen so that the critical run (k = 1) stays within ±10%
 * of its start: a critical chain of only 1,000 neutrons wanders (by about
 * ±20% over 40 generations for a typical seed), which a real core, with
 * billions of billions of neutrons, does not.
 */
export const CHAIN_SEED = 227;

export type Fate = 'fission' | 'captured' | 'escaped';

export interface TreeNeutron {
	id: string;
	/** Generation of the fission that released it. */
	g: number;
	parent: number;
	fate: Fate;
	/** Index of the fission it causes in generation g + 1, when fate = fission. */
	child: number;
}

export interface TreeFission {
	g: number;
	/** Index in its generation. */
	i: number;
	/** Index of the parent fission in generation g − 1 (−1 for the first). */
	parent: number;
}

export interface Tree {
	fissions: TreeFission[][];
	neutrons: TreeNeutron[][];
	/** Fissions dropped from the drawing because a column was full. */
	hidden: number[];
}

/**
 * A family tree of `generations` generations. The random draws are fixed per
 * neutron (by its place in the tree), so raising k only turns some losses
 * into fissions.
 */
export function buildTree(k: number, generations: number, maxPerColumn: number, salt = 0): Tree {
	const q = Math.min(1, k / U235.nu);
	const fissions: TreeFission[][] = [[{ g: 0, i: 0, parent: -1 }]];
	const neutrons: TreeNeutron[][] = [];
	const hidden: number[] = [0];
	for (let g = 0; g < generations; g++) {
		const out: TreeNeutron[] = [];
		const next: TreeFission[] = [];
		let counted = 0;
		for (const f of fissions[g]) {
			const key = g * 1009 + f.i * 37 + 1;
			const n = hash(key, salt + 1) < P_THREE ? 3 : 2;
			for (let j = 0; j < n; j++) {
				const u = hash(key * 7 + j, salt + 2);
				const fate: Fate =
					u < q ? 'fission' : hash(key * 7 + j, salt + 3) < 0.6 ? 'captured' : 'escaped';
				let child = -1;
				if (fate === 'fission') {
					counted++;
					if (next.length < maxPerColumn) {
						child = next.length;
						next.push({ g: g + 1, i: child, parent: f.i });
					}
				}
				out.push({ id: `${g}-${f.i}-${j}`, g, parent: f.i, fate, child });
			}
		}
		// Fissions in hidden branches of the previous generation also multiply.
		const hiddenNext = Math.round(hidden[g] * k) + Math.max(0, counted - next.length);
		neutrons.push(out);
		fissions.push(next);
		hidden.push(hiddenNext);
	}
	return { fissions, neutrons, hidden };
}
