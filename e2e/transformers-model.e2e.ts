// Checks the attention explainer's model: GPT-2 small's real attention weights for the page's
// sentences, and the attention operation redone in TypeScript from the model's own q, k and v.
// The results asserted are the ones the page quotes and ones published for GPT-2 small.
import { expect, test } from '@playwright/test';
import { attend, parameterCount, softmax } from '../src/routes/transformers/attention';
import { gpt2 } from '../src/routes/transformers/gpt2';

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
		for (const s of gpt2.sentences)
			for (let i = 1; i < s.n; i++) expect(s.row(4, 11, i)[i - 1]).toBeGreaterThan(0.6);
		const fox = gpt2.sentence('fox');
		expect(fox.row(4, 11, fox.n - 1)[fox.n - 2]).toBeGreaterThan(0.99);
	});

	test('induction: at the second “fox”, layer 6, head 6 looks at what followed the first one', () => {
		const fox = gpt2.sentence('fox');
		const second = at('fox', ' fox', at('fox', ' fox') + 1);
		expect(argmax(fox.row(5, 5, second))).toBe(at('fox', ' jumps'));
		expect(fox.row(5, 5, second)[at('fox', ' jumps')]).toBeGreaterThan(0.9);
		expect(fox.next[0]).toEqual({ token: ' over', p: expect.closeTo(0.98, 2) as number });
	});

	test('the final “to” attends to Mary in layer 10, heads 7 and 10, and GPT-2 predicts Mary', () => {
		const m = gpt2.sentence('mary');
		for (const h of [6, 9]) expect(argmax(m.row(9, h, m.n - 1))).toBe(at('mary', ' Mary'));
		expect(m.next[0].token).toBe(' Mary');
		expect(m.next[0].p).toBeCloseTo(0.68, 2);
	});

	test('most heads park most of their attention on the start token', () => {
		const s = gpt2.sentence('animal');
		let sum = 0;
		let count = 0;
		let heads = 0;
		for (let l = 0; l < 12; l++)
			for (let h = 0; h < 12; h++) {
				let hs = 0;
				for (let i = 1; i < s.n; i++) hs += s.row(l, h, i)[0];
				sum += hs;
				count += s.n - 1;
				if (hs / (s.n - 1) > 0.5) heads++;
			}
		expect(sum / count).toBeGreaterThan(0.55);
		expect(heads).toBeGreaterThan(90);
	});

	test('learned positions: neighbours are alike, distant positions are not', () => {
		const c = gpt2.positions.cos;
		expect(c[10][10]).toBeCloseTo(1, 2);
		expect(c[10][11]).toBeGreaterThan(0.95);
		expect(c[10][60]).toBeLessThan(0.6);
		// position 0 is special: its vector is about twice as long as the others
		expect(gpt2.positions.norms[0]).toBeGreaterThan(1.8 * gpt2.positions.norms[5]);
	});
});
