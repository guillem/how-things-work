// Checks the language-model explainer's model: GPT-2's tokenizer redone in TypeScript (against
// the Python one), and GPT-2 small's real next-token distributions with temperature, top-k,
// top-p and sampling computed from the stored logits. The numbers asserted are the ones the
// page quotes.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { Bpe } from '../src/routes/language-models/bpe';
import { data } from '../src/routes/language-models/gpt2-lm-data';
import { crossEntropy, drawIndex, Lm } from '../src/routes/language-models/lm';
import { PROMPTS } from '../src/routes/language-models/steps';
import { cases } from '../src/routes/language-models/tokenizer-cases';

const lm = new Lm(data);
const bpe = new Bpe(
	new Uint8Array(
		readFileSync(new URL('../src/routes/language-models/gpt2-merges.bin', import.meta.url))
	)
);
const top = (id: string, T = 1) => lm.dist(lm.node(lm.prompt(id).node), T);
const tok = (s: string) => {
	const ids = bpe.encode(s);
	expect(ids).toHaveLength(1);
	return ids[0];
};

test.describe('the tokenizer', () => {
	test('GPT-2 has 50,257 tokens: 256 bytes, 50,000 merges and <|endoftext|>', () => {
		expect(bpe.size).toBe(50_257);
		expect(lm.vocab).toBe(50_257);
		expect(bpe.text(50_256)).toBe('<|endoftext|>');
	});

	test('cuts text exactly like GPT-2’s own Python tokenizer', () => {
		for (const [text, ids] of cases) expect(bpe.encode(text), JSON.stringify(text)).toEqual(ids);
		for (const [text] of cases) expect(bpe.decode(bpe.encode(text))).toBe(text);
	});

	test('the examples on the page', () => {
		expect(bpe.encode(' Tower')).toEqual([8765]);
		expect(bpe.encode('The Eiffel').map((i) => bpe.text(i))).toEqual(['The', ' E', 'iff', 'el']);
		expect(bpe.encode('Paris')).toEqual([40313]);
		expect(bpe.encode(' Paris')).toEqual([6342]);
		expect(bpe.encode(' paris').map((i) => bpe.text(i))).toEqual([' par', 'is']);
		// ␣t + he → ␣the is the 7th merge (rank 6), so ␣the is token 256 + 6
		const [p] = bpe.pieces(' the');
		expect(p.merges.at(-1)!.rank).toBe(6);
		expect(p.ids).toEqual([262]);
		// 🙂 is not one token: it is cut into two pieces of its four UTF-8 bytes, shown in hexadecimal
		expect(bpe.encode('🙂').map((i) => bpe.text(i))).toEqual(['⟨F0 9F⟩', '⟨99 82⟩']);
	});

	test('merges are applied in the order they were learned', () => {
		for (const p of bpe.pieces('Tokenization of antidisestablishmentarianism')) {
			const ranks = p.merges.map((m) => m.rank);
			expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
			expect(p.merges.length === 0 ? p.bytes : p.merges.at(-1)!.tokens).toEqual(p.ids);
		}
	});
});

test.describe('next-token probabilities', () => {
	test('the page’s prompts are the stored ones, tokenized as GPT-2 does', () => {
		for (const [id, text] of Object.entries(PROMPTS)) {
			const p = lm.prompt(id);
			expect(p.text).toBe(text);
			expect(p.ids).toEqual([50_256, ...bpe.encode(text)]);
		}
	});

	test('… Rome is the capital of → Italy 35%, the same as on the transformers page', () => {
		const d = top('capital');
		expect(d.ids.slice(0, 3).map((i) => lm.token(i))).toEqual([' Italy', ' Rome', ' the']);
		expect(d.p[0]).toBeCloseTo(0.3543, 3);
		expect(d.p[1]).toBeCloseTo(0.2675, 3);
		expect(d.p[2]).toBeCloseTo(0.2121, 3);
		// only differences of scores matter: Rome is 0.28 below Italy, e^−0.28 ≈ 0.75
		expect(d.p[1] / d.p[0]).toBeCloseTo(Math.exp(lm.node(lm.prompt('capital').node).l[1]), 3);
	});

	test('what the page quotes for the other prompts', () => {
		const story = top('story');
		expect(lm.token(story.ids[0])).toBe(' time');
		expect(story.p[0]).toBeCloseTo(0.078, 3);
		expect(story.rest).toBeGreaterThan(0.7);
		const eiffel = top('eiffel');
		expect(eiffel.ids.slice(0, 2).map((i) => lm.token(i))).toEqual([' London', ' Paris']);
		expect(eiffel.p[0]).toBeCloseTo(0.081, 3);
		expect(eiffel.p[1]).toBeCloseTo(0.069, 3);
		const q = top('question');
		expect(lm.token(q.ids[0])).toBe('\n');
		expect(q.p[0]).toBeCloseTo(0.533, 3);
	});

	test('every distribution is a probability distribution at every temperature', () => {
		const bad: string[] = [];
		data.nodes.forEach((node, n) => {
			for (const T of data.tgrid) {
				const d = lm.dist(node, T);
				const sum = d.p.reduce((x, y) => x + y, 0);
				if (sum > 1 + 2e-3 || d.rest < 0) bad.push(`node ${n} T ${T}: ${sum}`);
				// sorted: temperature never changes the order
				for (let i = 1; i < d.p.length; i++)
					if (d.p[i] > d.p[i - 1] + 1e-9) bad.push(`node ${n} T ${T}: order at ${i}`);
			}
		});
		expect(bad).toEqual([]);
	});

	test('temperature: low T sharpens, high T flattens, T = 0 is greedy', () => {
		const p = (T: number) => top('story', T);
		expect(p(0).p[0]).toBe(1);
		expect(p(0.1).p[0]).toBeGreaterThan(0.9);
		expect(p(0.5).p[0]).toBeGreaterThan(p(1).p[0]);
		expect(p(2).p[0]).toBeLessThan(p(1).p[0]);
		expect(1 - p(2).rest).toBeLessThan(0.02);
		// T = 1 is the model's own distribution (as stored by the greedy run)
		const g = lm.run('story', 0, 1, 0).steps[0].d;
		g.forEach(([id, q], i) => {
			expect(p(1).ids[i]).toBe(id);
			expect(p(1).p[i]).toBeCloseTo(q, 3);
		});
	});

	test('top-k and top-p keep the most likely tokens and rescale them to 100%', () => {
		const node = lm.node(lm.prompt('capital').node);
		const k = lm.topK(lm.dist(node, 1), 3);
		expect(k.kept.filter(Boolean)).toHaveLength(3);
		expect(k.p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
		expect(lm.topP(node, 1, 0.9).size).toBe(14);
		expect(lm.topP(node, 0.5, 0.9).size).toBe(3);
		const cut = lm.topP(node, 0.5, 0.9);
		expect(cut.mass!).toBeGreaterThanOrEqual(0.9);
		expect(lm.topP(lm.node(lm.prompt('story').node), 1, 0.9).size).toBe(3167);
		// a smaller p never keeps more tokens
		let last = Infinity;
		for (const p of [0.95, 0.9, 0.5, 0.1]) {
			const s = lm.topP(lm.node(lm.prompt('story').node), 1, p).size!;
			expect(s).toBeLessThanOrEqual(last);
			last = s;
		}
	});
});

test.describe('writing', () => {
	test('every sampled token is the one whose stretch of the strip contains the random number', () => {
		const bad: string[] = [];
		for (const run of data.runs)
			run.steps.forEach((s, k) => {
				const where = `${run.prompt} T ${run.T} p ${run.p} seed ${run.seed} step ${k}`;
				if (run.T === 0) {
					if (s.pick !== s.d[0][0]) bad.push(where);
					return;
				}
				const i = drawIndex(
					s.d.map((x) => x[1]),
					s.r!
				);
				if (i >= 0 ? s.d[i][0] !== s.pick : s.d.some(([id]) => id === s.pick)) bad.push(where);
			});
		expect(bad).toEqual([]);
	});

	test('greedy decoding is the same text whichever way it is computed', () => {
		for (const id of ['story', 'eiffel']) {
			const g = lm.run(id, 0, 1, 0).steps.map((s) => s.pick);
			expect(lm.node(lm.prompt(id).node).g).toEqual(g.slice(0, 12));
		}
		expect(lm.text(lm.run('story', 0, 1, 0).steps.map((s) => s.pick))).toContain(
			'a place of chaos and chaos'
		);
	});

	test('the tree of choices: each child is the context with that token appended', () => {
		for (const id of ['story', 'eiffel']) {
			let n = 0;
			const walk = (i: number, depth: number) => {
				n++;
				const node = lm.node(i);
				if (depth === 3) return expect(node.ch).toBeUndefined();
				expect(node.ch).toHaveLength(4);
				node.ch!.forEach((c, j) => {
					// the greedy continuation of a child starts with its own top token
					expect(lm.node(c).g![0]).toBe(lm.node(c).k[0]);
					if (j === 0) expect(node.g!.slice(1, 12)).toEqual(lm.node(c).g!.slice(0, 11));
					walk(c, depth + 1);
				});
			};
			walk(lm.prompt(id).node, 0);
			expect(n).toBe(85);
		}
	});

	test('the base model answers the framed question, wrongly, and asks the next one', () => {
		const t = lm.text(lm.run('qa', 0, 1, 0).steps.map((s) => s.pick));
		expect(t).toContain('about 1.5 degrees Fahrenheit');
		expect(t).toContain('Q: What is the temperature of water in a glass of water?');
		expect(lm.text(lm.run('question', 0, 1, 0).steps.map((s) => s.pick)).startsWith('\n')).toBe(
			true
		);
	});
});

test('training: the probability GPT-2 gave each real next token', () => {
	const tr = data.training;
	const at = (t: string) => tr.steps[tr.ids.indexOf(tok(t)) - 1].p;
	expect(at(' Tower')).toBeCloseTo(0.98, 2);
	expect(at(' 1889')).toBeCloseTo(0.011, 3);
	expect(at(' 330')).toBeLessThan(0.0001);
	expect(tr.steps).toHaveLength(20);
	expect(crossEntropy(tr.steps.map((s) => s.p))).toBeCloseTo(2.78, 2);
	expect(crossEntropy([0.5, 0.5])).toBeCloseTo(Math.LN2, 12);
});
