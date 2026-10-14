// Checks the attention explainer's model: GPT-2 small's real attention weights for the page's
// sentences, and the attention operation redone in TypeScript from the model's own q, k and v.
// The results asserted are the ones the page quotes and ones published for GPT-2 small.
import { expect, test } from '@playwright/test';
import { attend, parameterCount, softmax, tokenLabel } from '../src/routes/transformers/attention';
import { gpt2 } from '../src/routes/transformers/gpt2';
import { FEATURED_TOKENS, PATTERNS, SENTENCES } from '../src/routes/transformers/steps';

const at = (s: string, tok: string, from = 0) => gpt2.sentence(s).tokens.indexOf(tok, from);
const argmax = (r: number[]) => r.indexOf(Math.max(...r));

test.describe('the model', () => {
	test('GPT-2 small: 12 layers of 12 heads, 124,439,808 parameters', () => {
		const c = gpt2.config;
		expect([c.layers, c.heads, c.dHead, c.dModel]).toEqual([12, 12, 64, 768]);
		expect(c.heads * c.dHead).toBe(c.dModel);
		expect(c.params).toBe(124_439_808);
		expect(parameterCount(c).total).toBe(c.params);
		expect(parameterCount(c).perBlock).toBe(7_087_872);
		expect(gpt2.source.licence).toBe('MIT');
	});

	test('every attention row is a set of weights over the tokens so far', () => {
		const bad: string[] = [];
		for (const s of gpt2.sentences) {
			expect(s.tokens[0]).toBe('<|endoftext|>');
			expect(s.n).toBeLessThanOrEqual(16);
			for (let l = 0; l < 12; l++)
				for (let h = 0; h < 12; h++)
					for (let i = 0; i < s.n; i++) {
						const r = s.row(l, h, i);
						const sum = r.reduce((a, b) => a + b, 0);
						// 8-bit storage: each weight is within 1/510 of the model's
						if (Math.abs(sum - 1) > (i + 1) / 510 + 1e-9)
							bad.push(`${s.id} ${l}.${h} row ${i}: ${sum}`);
						// GPT-2 never looks ahead
						if (r.slice(i + 1).some((w) => w !== 0))
							bad.push(`${s.id} ${l}.${h} row ${i} looks ahead`);
					}
		}
		expect(bad).toEqual([]);
	});

	test('softmax turns any scores into positive weights that add up to 1', () => {
		const w = softmax([2, 1, 0, -1000]);
		expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
		expect(w[0] / w[1]).toBeCloseTo(Math.E, 10);
		expect(w[3]).toBeCloseTo(0, 12);
		expect(softmax([5, 5])).toEqual([0.5, 0.5]);
	});
});

test.describe('one attention operation, redone by hand', () => {
	const f = gpt2.featured;
	const s = gpt2.sentence(f.sentence);
	const it = at('animal', ' it');

	test('q·k/√64 and a softmax give the model’s own weights, for every token', () => {
		for (let i = 0; i < s.n; i++) {
			const mine = attend(f.q, f.k, f.v, i).weights;
			const model = s.row(f.layer, f.head, i);
			mine.forEach((w, j) => expect(Math.abs(w - model[j])).toBeLessThan(0.003));
		}
	});

	test('the mixed values are the head’s real output', () => {
		for (let i = 0; i < s.n; i++) {
			const out = attend(f.q, f.k, f.v, i).out;
			out.forEach((x, c) => expect(Math.abs(x - f.out[i][c])).toBeLessThan(0.002));
		}
	});

	test('layer 5, head 4: “it” puts 0.92 of its attention on “animal”', () => {
		expect([f.layer, f.head]).toEqual([4, 3]);
		const step = gpt2.featuredStep(it);
		expect(step.weights).toHaveLength(it + 1);
		expect(argmax(step.weights)).toBe(at('animal', ' animal'));
		expect(step.weights[at('animal', ' animal')]).toBeCloseTo(0.92, 2);
		// the score is the dot product divided by √64 = 8
		step.scores.forEach((x, j) => expect(x).toBeCloseTo(step.dots[j] / 8, 10));
	});
});

test.describe('what heads of GPT-2 small are known to do', () => {
	test('layer 5, head 12 looks at the previous token', () => {
		// the patterns step: “a weight of at least 0.89 on every token of the eight sentences”
		for (const s of gpt2.sentences)
			for (let i = 1; i < s.n; i++) expect(s.row(4, 11, i)[i - 1]).toBeGreaterThan(0.89);
		const fox = gpt2.sentence('fox');
		expect(fox.row(4, 11, fox.n - 1)[fox.n - 2]).toBeGreaterThan(0.99);
	});

	test('induction: at the second “fox”, layer 6, head 6 looks at what followed the first one', () => {
		const fox = gpt2.sentence('fox');
		const second = at('fox', ' fox', at('fox', ' fox') + 1);
		expect(argmax(fox.row(5, 5, second))).toBe(at('fox', ' jumps'));
		expect(fox.row(5, 5, second)[at('fox', ' jumps')]).toBeGreaterThan(0.9);
		expect(fox.next[0].token).toBe(' over');
		expect(fox.next[0].p).toBeCloseTo(0.98, 2);
	});

	test('the final “to” attends to Mary in layer 10, heads 7 and 10, and GPT-2 predicts Mary', () => {
		const m = gpt2.sentence('mary');
		for (const h of [6, 9]) expect(argmax(m.row(9, h, m.n - 1))).toBe(at('mary', ' Mary'));
		expect(m.next[0].token).toBe(' Mary');
		expect(m.next[0].p).toBeCloseTo(0.68, 2);
	});

	test('most heads park most of their attention on the start token', () => {
		// the heads step: “across all 144 heads, averaged over the eight sentences, about 60%”
		let sum = 0;
		let count = 0;
		for (const s of gpt2.sentences)
			for (let l = 0; l < 12; l++)
				for (let h = 0; h < 12; h++)
					for (let i = 1; i < s.n; i++) {
						sum += s.row(l, h, i)[0];
						count++;
					}
		expect(sum / count).toBeCloseTo(0.6, 1);
		const s = gpt2.sentence('animal');
		let heads = 0;
		for (let l = 0; l < 12; l++)
			for (let h = 0; h < 12; h++) {
				let hs = 0;
				for (let i = 1; i < s.n; i++) hs += s.row(l, h, i)[0];
				if (hs / (s.n - 1) > 0.5) heads++;
			}
		expect(heads).toBeGreaterThan(90);
	});

	test('learned positions: neighbours are alike, distant positions are not', () => {
		const c = gpt2.positions.cos;
		expect(c[10][10]).toBeCloseTo(1, 2);
		expect(c[10][11]).toBeGreaterThan(0.95);
		expect(c[10][60]).toBeLessThan(0.6);
		// position 0 is special: “two to three times as long as the others (9.9, against 3.4 to 5.2)”
		const [first, ...rest] = gpt2.positions.norms;
		expect(first).toBeCloseTo(9.9, 1);
		expect(Math.min(...rest)).toBeCloseTo(3.4, 1);
		expect(Math.max(...rest)).toBeCloseTo(5.2, 1);
		expect(first / Math.max(...rest)).toBeGreaterThan(1.8);
		expect(first / Math.min(...rest)).toBeLessThan(3);
	});
});

test.describe('what the page says', () => {
	test('the menus match the data: sentences, token counts and the featured tokens', () => {
		expect(SENTENCES.map((x) => x.id)).toEqual(gpt2.sentences.map((x) => x.id));
		for (const x of SENTENCES) expect(gpt2.sentence(x.id).n).toBe(x.n);
		expect(gpt2.sentence('animal').tokens.map((x) => tokenLabel(x))).toEqual(FEATURED_TOKENS);
	});

	test('the named heads do what the patterns step says', () => {
		const w = (p: (typeof PATTERNS)[keyof typeof PATTERNS], tok: string) => {
			const s = gpt2.sentence(p.s);
			return s.row(p.layer, p.head, p.tok)[s.tokens.indexOf(tok)];
		};
		const P = PATTERNS;
		expect(
			gpt2.sentence(P.previous.s).row(P.previous.layer, P.previous.head, P.previous.tok)[
				P.previous.tok - 1
			]
		).toBeGreaterThan(0.95);
		expect(gpt2.sentence(P.subject.s).tokens[P.subject.tok]).toBe(' are');
		expect(w(P.subject, ' keys')).toBeCloseTo(0.85, 2);
		expect(gpt2.sentence(P.induction.s).tokens[P.induction.tok]).toBe(' fox');
		expect(w(P.induction, ' jumps')).toBeCloseTo(0.96, 2);
		expect(w(P.names, ' Mary')).toBeCloseTo(0.67, 2);
		expect(w(P.start, '<|endoftext|>')).toBeCloseTo(0.98, 2);
		// the resting head is an induction head on the fox sentence
		const fox = gpt2.sentence('fox');
		expect(
			fox.row(P.start.layer, P.start.head, P.induction.tok)[fox.tokens.indexOf(' jumps')]
		).toBeCloseTo(0.8, 2);
	});

	test('the mix step: “animal” is seven tokens back from “it”', () => {
		expect(at('animal', ' it') - at('animal', ' animal')).toBe(7);
	});

	test('the featured head: a lead of 3.2 in score is 24 times the weight', () => {
		const st = gpt2.featuredStep(at('animal', ' it'));
		const sorted = [...st.scores].sort((a, b) => b - a);
		expect(sorted[0]).toBeCloseTo(1.06, 2);
		expect(sorted[1]).toBeLessThan(-2);
		expect(sorted[0] - sorted[1]).toBeCloseTo(3.2, 1);
		expect(st.weights[0]).toBeCloseTo(0.04, 2);
		// "didn", "cross" and "was" also look at "animal"; "The" and "street" at ⟨start⟩
		for (const tk of [' didn', ' cross', ' was'])
			expect(argmax(gpt2.featuredStep(at('animal', tk)).weights)).toBe(at('animal', ' animal'));
		for (const tk of ['The', ' street'])
			expect(gpt2.featuredStep(at('animal', tk)).weights[0]).toBeGreaterThan(0.5);
	});

	test('position 10 against 11, 30 and 63', () => {
		const c = gpt2.positions.cos[10];
		expect(c[11]).toBeCloseTo(0.998, 3);
		expect(c[30]).toBeCloseTo(0.78, 2);
		expect(c[63]).toBeCloseTo(0.4, 2);
	});

	test('later layers reach further back than the first five', () => {
		const reach = (layers: number[]) => {
			let d = 0;
			let w = 0;
			for (const s of gpt2.sentences)
				for (const l of layers)
					for (let h = 0; h < 12; h++)
						for (let i = 2; i < s.n; i++)
							s.row(l, h, i).forEach((x, j) => {
								if (j >= 1 && j <= i) {
									d += x * (i - j);
									w += x;
								}
							});
			return d / w;
		};
		const early = reach([0, 1, 2, 3, 4]);
		const late = reach([9, 10, 11]);
		expect(early).toBeGreaterThan(2);
		expect(early).toBeLessThan(3);
		expect(late).toBeGreaterThan(3.5);
		expect(late).toBeLessThan(4);
	});

	test('the stack step: Italy after “Rome is the capital of”, and the parameter split', () => {
		const c = gpt2.sentence('capital');
		expect(c.next[0].token).toBe(' Italy');
		expect(c.next[0].p).toBeCloseTo(0.35, 2);
		const p = parameterCount(gpt2.config);
		expect(gpt2.config.vocab * gpt2.config.dModel).toBe(38_597_376);
		expect(p.attention).toBe(2_362_368);
		expect(p.mlp).toBe(4_722_432);
	});
});
