/** Shared constants of the chain scenes. */

/** What the blocks of the chain carry. */
export const CHAIN_DATA = ['Genesis', 'Ana pays Ben 5', 'Ben pays Cai 2', 'Cai pays Dee 1'];

/** Difficulty of the proof-of-work chain (the `rework` step): 12 zero bits, "000" in hex. */
export const CHAIN_BITS = 12;

/** Contents for the mining step, one per press of "New block contents". */
export const MINE_DATA = [
	'Ana pays Ben 5',
	'Dee pays Eva 3',
	'Eva pays Ana 4',
	'Cai pays Ben 7',
	'Ben pays Dee 1'
];

export const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

/** "0000 0000 0001 0110 …": the first `n` bits of a digest, in groups of four. */
export function bitString(d: Uint8Array, n: number) {
	let s = '';
	for (let i = 0; i < n; i++) {
		const bit = (d[i >> 3] >> (7 - (i & 7))) & 1;
		s += (i > 0 && i % 4 === 0 ? ' ' : '') + bit;
	}
	return s;
}

export const fmt = (n: number) => n.toLocaleString('en-US');
