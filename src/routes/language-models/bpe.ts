/**
 * GPT-2's tokenizer, byte-level byte-pair encoding (BPE), in plain TypeScript.
 *
 * The text is first split into pieces by GPT-2's pattern (a word with its leading space, a run
 * of digits, a run of punctuation, whitespace, and the endings 's 't 're 've 'm 'll 'd). Each
 * piece becomes its UTF-8 bytes, one token per byte (tokens 0–255). Then the 50,000 merges GPT-2
 * learned are applied: repeatedly, the neighbouring pair with the lowest merge rank (the merge
 * learned earliest) is joined into one token, until no neighbouring pair has a merge. Merge r
 * makes token 256 + r.
 *
 * The merges come from `gpt2-merges.bin` (written by `scripts/data/language-models/build.py`
 * from GPT-2's own merges.txt): 50,000 pairs of token ids, uint16 little-endian. A model test
 * checks this tokenizer against the Python one on tricky strings.
 */

/** GPT-2's split pattern (from its encoder.py), with the `u` flag for \p{L} and \p{N}. */
const PATTERN = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

/** The byte value of tokens 0–255, in GPT-2's vocabulary order (bytes_to_unicode). */
function byteOrder(): number[] {
	const bs: number[] = [];
	const add = (a: number, b: number) => {
		for (let c = a; c <= b; c++) bs.push(c);
	};
	add(0x21, 0x7e);
	add(0xa1, 0xac);
	add(0xae, 0xff);
	for (let b = 0; b < 256; b++) if (!bs.includes(b)) bs.push(b);
	return bs;
}

export const END_OF_TEXT = 50256;

/** One merge applied while encoding a piece, for showing the process. */
export interface Merge {
	/** The merge's rank (0 = learned first). */
	rank: number;
	/** The piece's tokens after this merge. */
	tokens: number[];
}

export interface Piece {
	/** The piece of text, as split by the pattern. */
	text: string;
	/** Its tokens at the start: one per UTF-8 byte. */
	bytes: number[];
	/** The merges applied, in order. */
	merges: Merge[];
	/** The final tokens. */
	ids: number[];
}

export class Bpe {
	readonly size: number;
	private readonly bytesOf: Uint8Array[];
	private readonly rank = new Map<number, number>();
	private readonly byteToken = new Array<number>(256);
	private readonly decoder = new TextDecoder('utf-8', { fatal: true });
	private readonly lenient = new TextDecoder('utf-8');

	constructor(merges: Uint8Array) {
		const n = merges.length / 4;
		const view = new DataView(merges.buffer, merges.byteOffset, merges.byteLength);
		const order = byteOrder();
		this.bytesOf = order.map((b) => Uint8Array.of(b));
		order.forEach((b, id) => (this.byteToken[b] = id));
		for (let r = 0; r < n; r++) {
			const a = view.getUint16(4 * r, true);
			const b = view.getUint16(4 * r + 2, true);
			this.rank.set(a * 65536 + b, r);
			const x = this.bytesOf[a];
			const y = this.bytesOf[b];
			const joined = new Uint8Array(x.length + y.length);
			joined.set(x);
			joined.set(y, x.length);
			this.bytesOf.push(joined);
		}
		this.size = this.bytesOf.length + 1; // + <|endoftext|>
	}

	/** The pieces of `text` and how each was merged. */
	pieces(text: string): Piece[] {
		const enc = new TextEncoder();
		return (text.match(PATTERN) ?? []).map((p) => {
			const bytes = [...enc.encode(p)].map((b) => this.byteToken[b]);
			let word = bytes;
			const merges: Merge[] = [];
			while (word.length > 1) {
				let best = Infinity;
				for (let i = 0; i < word.length - 1; i++) {
					const r = this.rank.get(word[i] * 65536 + word[i + 1]);
					if (r !== undefined && r < best) best = r;
				}
				if (best === Infinity) break;
				const merged: number[] = [];
				const made = 256 + best;
				for (let j = 0; j < word.length; j++) {
					if (j < word.length - 1 && this.rank.get(word[j] * 65536 + word[j + 1]) === best) {
						merged.push(made);
						j++;
					} else merged.push(word[j]);
				}
				word = merged;
				merges.push({ rank: best, tokens: word });
			}
			return { text: p, bytes, merges, ids: word };
		});
	}

	encode(text: string): number[] {
		return this.pieces(text).flatMap((p) => p.ids);
	}

	/** The bytes of a token. */
	bytes(id: number): Uint8Array {
		if (id === END_OF_TEXT) return new TextEncoder().encode('<|endoftext|>');
		return this.bytesOf[id];
	}

	/**
	 * A token as text. A token that is only part of a character (a piece of an emoji, say) is
	 * not valid UTF-8 on its own: it is shown as its bytes in hexadecimal, ⟨F0 9F⟩.
	 */
	text(id: number): string {
		const b = this.bytes(id);
		try {
			return this.decoder.decode(b);
		} catch {
			return '⟨' + [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '⟩';
		}
	}

	decode(ids: number[]): string {
		const parts = ids.map((i) => this.bytes(i));
		const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
		let o = 0;
		for (const p of parts) {
			all.set(p, o);
			o += p.length;
		}
		return this.lenient.decode(all);
	}
}
