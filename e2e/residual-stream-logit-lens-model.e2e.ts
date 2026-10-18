// Checks the residual-stream explainer's data against what is known of GPT-2 small: the lens after
// the last block is the model's own output (and agrees with the transformers page's independent
// run), the indirect-object sentence is answered " Mary" with block 10's attention (the layer of
// Wang et al. 2022's name-mover heads, their layer 9) pushing hardest towards it, the repeated word
// is copied from earlier in the prompt, the early lens is a poor reader, and zero-ablating block 1
// wrecks every prompt while later blocks matter prompt by prompt. The numbers the narrative quotes
// are checked here too.
import { expect, test } from '@playwright/test';
import {
	answerAt,
	BLOCKS,
	effects,
	finalAt,
	lensAt,
	nextTokens,
	path,
	pAnswer,
	prompt,
	PROMPTS,
	settlesAt,
	sizes,
	words
} from '../src/routes/residual-stream-logit-lens/lens';
import { data as attentionData } from '../src/routes/transformers/gpt2-data';
import { PROMPT_MENU } from '../src/routes/residual-stream-logit-lens/steps';

const last = (id: string) => words(prompt(id)).length - 1;

test('the narrative’s prompt menu matches the data', () => {
	expect(PROMPT_MENU.map((m) => [m.id, m.n])).toEqual(
		PROMPTS.map(({ id }) => [id, words(prompt(id)).length])
	);
});

test.describe('the logit lens', () => {
	test('after the last block, the lens is the model’s own prediction', () => {
		for (const { id } of PROMPTS) {
			const p = prompt(id);
			const read = lensAt(p, BLOCKS, last(id));
			const out = nextTokens(p);
			expect(read.map((g) => g.token)).toEqual(out.slice(0, 3).map((g) => g.token));
			for (const [k, g] of read.entries()) expect(g.p).toBeCloseTo(out[k].p, 3);
		}
	});

	test('the same model run independently for the transformers page gives the same output', () => {
		for (const id of ['mary', 'count']) {
			const other = attentionData.sentences.find((s) => s.id === id);
			expect(other?.text).toBe(prompt(id).text);
			expect(nextTokens(prompt(id)).map((g) => [g.token, g.p])).toEqual(other?.next);
		}
	});

	test('the prompts’ answers: Mary, 7, fox, light, Paris', () => {
		const answers = PROMPTS.map(({ id }) => finalAt(prompt(id), last(id)));
		expect(answers).toEqual([' Mary', ' 7', ' fox', ' light', ' Paris']);
		expect(pAnswer(prompt('mary'))).toBeCloseTo(0.677, 3);
	});

	test('the early lens is a poor reader: the answer is nowhere in the first rows', () => {
		for (const { id } of PROMPTS) {
			const p = prompt(id);
			const ans = finalAt(p, last(id));
			expect(lensAt(p, 0, last(id))[0].token).not.toBe(ans);
			for (let r = 0; r <= 5; r++) expect(answerAt(p, r, last(id))).toBeLessThan(0.01);
		}
	});

	test('the answers settle late; the repeated word is copied from earlier in the prompt', () => {
		// After the first "brown" the model does not predict "fox"; after the second it does.
		const fox = prompt('fox');
		expect(finalAt(fox, 2)).not.toBe(' fox');
		expect(finalAt(fox, last('fox'))).toBe(' fox');
		expect(settlesAt(fox, last('fox'))).toBe(8);
		expect(settlesAt(prompt('mary'), last('mary'))).toBe(10);
		expect(settlesAt(prompt('count'), last('count'))).toBe(10);
		expect(settlesAt(prompt('france'), last('france'))).toBe(12);
	});

	test('the answer is most probable before the end, and the last blocks hedge', () => {
		const p = prompt('mary');
		expect(answerAt(p, 10, last('mary'))).toBeGreaterThan(0.99);
		expect(answerAt(p, 12, last('mary'))).toBeLessThan(0.7);
		// For Paris the lens's top guess after blocks 10 and 11 is " Marse", not the answer.
		const f = prompt('france');
		expect(lensAt(f, 10, last('france'))[0].token).toBe(' Marse');
		expect(lensAt(f, 11, last('france'))[0].token).toBe(' Marse');
	});
});

test.describe('the running vector', () => {
	test('the arrows add up to the final vector', () => {
		for (const { id } of PROMPTS) {
			const p = prompt(id);
			const pts = path(p);
			expect(pts).toHaveLength(25);
			const end = pts[pts.length - 1];
			expect(end.x).toBeCloseTo(p.last.plane.final[0], 1);
			expect(end.y).toBeCloseTo(p.last.plane.final[1], 1);
			// it ends far on the answer's side
			expect(end.x).toBeGreaterThan(40);
		}
	});

	test('block 10’s attention pushes hardest towards Mary (the name movers, layer 9)', () => {
		const pts = path(prompt('mary'));
		const steps = pts.slice(1).map((q, i) => ({ ...q, dx: q.x - pts[i].x }));
		const best = steps.reduce((a, b) => (b.dx > a.dx ? b : a));
		expect([best.part, best.block]).toEqual(['attn', 10]);
		expect(best.dx).toBeGreaterThan(25);
	});

	test('the stream grows a hundredfold; the layer norm scales it back down to read it', () => {
		const s = sizes(prompt('mary'));
		expect(s.stream[0]).toBeLessThan(5);
		expect(s.stream[BLOCKS]).toBeGreaterThan(450);
		expect(s.ln1[0]).toBeGreaterThan(5);
		expect(s.ln1[BLOCKS - 1]).toBeLessThan(0.15);
	});
});

test.describe('switching a component off', () => {
	test('switching off block 1’s attention wrecks every prompt, whatever the task', () => {
		for (const { id } of PROMPTS) {
			const p = prompt(id);
			expect(pAnswer(p, { block: 1, part: 'attn' })).toBeLessThan(0.05);
		}
	});

	test('the numbers the page quotes for Mary', () => {
		const p = prompt('mary');
		const off = { block: 11, part: 'mlp' } as const;
		expect(pAnswer(p, off)).toBeCloseTo(0.258, 3);
		expect(nextTokens(p, off)[0].token).toBe(' them');
		// Past block 1, the largest single drop is block 11's MLP.
		const worst = effects(p)
			.filter((e) => e.block > 1)
			.reduce((a, b) => (b.change < a.change ? b : a));
		expect([worst.block, worst.part]).toEqual([11, 'mlp']);
	});

	test('the count: block 12’s attention matters most after the first block', () => {
		const p = prompt('count');
		const worst = effects(p)
			.filter((e) => e.block > 1)
			.reduce((a, b) => (b.change < a.change ? b : a));
		expect([worst.block, worst.part]).toEqual([12, 'attn']);
		expect(worst.p).toBeCloseTo(0.661, 3);
	});
});
