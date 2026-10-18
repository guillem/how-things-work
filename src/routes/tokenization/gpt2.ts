/**
 * GPT-2's real tokenizer for the second chapter of the tokenization explainer. The tokenizer
 * itself (byte-level BPE with GPT-2's 50,000 merges, applied in rank order after the pattern's
 * pre-split) lives in `language-models/bpe.ts` and is tested there against GPT-2's Python
 * tokenizer; this file adds what this page compares it with.
 */
import { Bpe } from '../language-models/bpe';

/** Sentences of the "other scripts" step: one request, the same in eleven languages. */
export const LANGUAGES = [
	{ lang: 'English', text: 'I would like a cup of coffee, please.' },
	{ lang: 'Spanish', text: 'Quisiera una taza de café, por favor.' },
	{ lang: 'German', text: 'Ich hätte gern eine Tasse Kaffee, bitte.' },
	{ lang: 'French', text: "Je voudrais une tasse de café, s'il vous plaît." },
	{ lang: 'Japanese', text: 'コーヒーを一杯ください。' },
	{ lang: 'Chinese', text: '请给我一杯咖啡。' },
	{ lang: 'Korean', text: '커피 한 잔 주세요.' },
	{ lang: 'Arabic', text: 'أريد فنجان قهوة من فضلك.' },
	{ lang: 'Russian', text: 'Я хотел бы чашку кофе, пожалуйста.' },
	{ lang: 'Greek', text: 'Θα ήθελα ένα φλιτζάνι καφέ, παρακαλώ.' },
	{ lang: 'Hindi', text: 'कृपया मुझे एक कप कॉफ़ी दीजिए।' }
] as const;

const key = (b: ArrayLike<number>) => String.fromCharCode(...Array.from(b));

/** GPT-2's tokenizer plus a lookup of its vocabulary by bytes (for the longest-match foil). */
export class Gpt2 {
	readonly bpe: Bpe;
	private vocab: Map<string, number> | null = null;
	private longestToken = 0;

	constructor(merges: Uint8Array) {
		this.bpe = new Bpe(merges);
	}

	private lookup(): Map<string, number> {
		if (!this.vocab) {
			this.vocab = new Map();
			for (let id = 0; id < this.bpe.size - 1; id++) {
				const b = this.bpe.bytes(id);
				this.longestToken = Math.max(this.longestToken, b.length);
				this.vocab.set(key(b), id);
			}
		}
		return this.vocab;
	}

	/**
	 * What a different rule would give, for comparison: inside each piece, take the longest token
	 * of GPT-2's vocabulary that the text starts with, then repeat from where it ends. This is
	 * NOT how GPT-2 cuts text (it applies merges in the order learned); the page shows where the
	 * two differ.
	 */
	longestMatch(text: string): number[] {
		const vocab = this.lookup();
		const enc = new TextEncoder();
		return this.bpe.pieces(text).flatMap((p) => {
			const b = enc.encode(p.text);
			const out: number[] = [];
			let i = 0;
			while (i < b.length) {
				let id = -1;
				let len = 1;
				for (let j = i + 1; j <= Math.min(b.length, i + this.longestToken); j++) {
					const t = vocab.get(key(b.subarray(i, j)));
					if (t !== undefined) {
						id = t;
						len = j - i;
					}
				}
				out.push(id);
				i += len;
			}
			return out;
		});
	}

	/** Number of GPT-2 tokens of " n" (a number after a space), for n = 0 … count − 1. */
	numberTokens(count = 1000): number[] {
		return Array.from({ length: count }, (_, n) => this.bpe.encode(' ' + n).length);
	}
}

let loading: Promise<Gpt2> | null = null;

/** GPT-2's tokenizer; its 200 KB of merges (shared with language-models) are fetched once. */
export function gpt2(url: string): Promise<Gpt2> {
	loading ??= fetch(url)
		.then((r) => {
			if (!r.ok) throw new Error(`merges: HTTP ${r.status}`);
			return r.arrayBuffer();
		})
		.then((b) => new Gpt2(new Uint8Array(b)));
	loading.catch(() => (loading = null));
	return loading;
}
