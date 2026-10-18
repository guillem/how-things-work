import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import {
	byDigits,
	learning,
	ninesShare,
	ninesTotal,
	ninesWorst,
	oneBlockOf,
	pct,
	results,
	weightCount
} from './results';
import { NINES, PRESETS, RANDOM } from './scenes/shared';

const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
const D = results.direct;
const W = fmt(weightCount);
const STEPS = fmt(D.steps);
const BLOCKS = D.config.layers === 1 ? 'one block' : `${D.config.layers} blocks`;

const sum: Control = {
	type: 'select',
	id: 'sum',
	label: 'The sum (random ones: 8 digits)',
	default: PRESETS[0].value,
	options: [
		...PRESETS,
		{ value: RANDOM, label: 'random' },
		{ value: NINES, label: 'random, with a run of nines' }
	]
};

const another: Control = {
	type: 'action',
	id: 'another',
	label: 'For the random sums',
	action: 'Draw another',
	disabled: (p) => p.sum !== RANDOM && p.sum !== NINES
};

const PASS = `<dfn data-def="One run of the model from the bottom of its stack to the top: the characters so far go in, and out comes a probability for each possible next character. Writing one character takes one forward pass.">forward pass</dfn>`;
const GREEDY = `<dfn data-def="Writing the likeliest character every time instead of drawing one at random. The same model and the same question then always give the same text.">greedy decoding</dfn>`;
const HELD = `<dfn data-def="Problems kept aside and never used in training, so a model's score on them measures what it learnt, not what it memorised.">held-out</dfn>`;
const NINE_RUN = `<dfn data-def="Consecutive columns whose two digits add up to exactly 9, like the 9 + 0 and 4 + 5 of 49 + 50. Such a column passes on whatever carry it receives, so the digits above it depend on the columns below it.">run of nines</dfn>`;

type Mode = 'direct' | 'scratchpad';
const n = (mode: Mode, r: number, c: boolean) => pct(ninesShare(mode, r, c));
const curve = (mode: Mode) => learning(mode);
const at = (mode: Mode, step: number) => curve(mode).find((p) => p.step === step)?.share ?? 0;
const end = (mode: Mode) => curve(mode)[curve(mode).length - 1].share;
const one = (mode: Mode) => oneBlockOf(mode);
const errors = D.errors;
const flips = results.scratchpad.flipped ?? { sums: 0, nextFollows: 0, answerFollows: 0 };

export const spec: ExplainerSpec = {
	slug: 'chain-of-thought-scratchpad',
	title: 'Why thinking out loud helps a model',
	summary:
		'Two tiny transformers of the same size, trained by the page on addition and run in it: one writes the answer straight away, the other writes each column’s digit and carry first. Step through both, character by character, see where the direct one goes wrong, and why writing the working gives the same model more computation.',
	chapters: [
		{ id: 'task', title: 'Two ways to write a sum' },
		{ id: 'measure', title: 'Measured on sums neither has seen' },
		{ id: 'meaning', title: 'What the written steps are' }
	],
	steps: [
		// ------------------------------------------------------------------ task
		{
			id: 'two-models',
			chapter: 'task',
			title: 'Two models, one sum',
			scene: 'race',
			hints: { phase: 'both' },
			duration: 30,
			controls: [sum, another],
			body: `
<p>The <a href="../training-a-tiny-language-model/">training page</a> taught a tiny <a href="../transformers/">transformer</a> to continue Shakespeare one character at a time. This page trained two more with the same code, on sums instead of plays. They are the same size, ${BLOCKS} and ${W} weights each, and were trained for the same ${STEPS} steps on the same randomly drawn sums of numbers with 1 to 8 digits.</p>
<p>Each reads a question such as <code>0000000457+0000000068=</code> (both numbers padded with zeros to ten digits) and writes the answer most significant digit first, the way people write it. The <b>direct</b> model writes the eleven digits of the answer straight away. The <b>scratchpad</b> model first writes its working: for each column, from the units up, the digit it puts down and the carry it passes on; then a <code>&gt;</code> and the same eleven digits.</p>
<p>Both run here, in your browser, one ${PASS} per character, with ${GREEDY}. Green characters are right, red ones wrong. On the first sum the direct model writes 74,995,824; the answer is 73,995,824. Pick other sums and watch them write.</p>`,
			notes: `<p>The two models differ only in what they were trained to write: the same width (${D.config.width} numbers per character), the same ${D.config.heads} attention heads, the same context of ${D.config.context} characters, the same seed for the starting weights and the same stream of training sums. Over the question, the training target at each position is a constant filler symbol instead of the next digit: the question's digits are random, so there is nothing to predict there, and the models learn the filler almost at once. From the <code>=</code> on, the target is the completion. Every padded zero is a character the model really writes; the stage greys the leading ones out.</p>`
		},
		{
			id: 'first-digit',
			chapter: 'task',
			title: 'A digit can depend on every column below it',
			scene: 'depth',
			hints: { phase: 'direct' },
			duration: 26,
			controls: [sum, another],
			body: `
<p>A transformer runs the same fixed stack for every character it writes: the characters so far go up through the same ${BLOCKS}, once each, and a probability for the next character comes out. A harder character gets no more steps. (Each pass does a little more arithmetic as the text grows, since attention looks back at every earlier character, but the number of steps one after another stays the same.)</p>
<p>The direct model writes the top digits first, and they can depend on the units: 4,999 + 5,000 is 9,999, but 4,999 + 5,001 is 10,000. A column whose digits add up to exactly 9 passes on whatever carry it gets, so the digit above a ${NINE_RUN} depends on the column below the run, however long it is. In 34,681,209 + 39,314,615 the millions digit is 3, not 4, only because the two columns below it, which add up to 9 (8 + 1 and 6 + 3), get no carry from the thousands (1 + 4 = 5). The direct model has to settle that inside the one pass that writes the digit, from the question alone: nothing it has written so far says anything about the lower columns.</p>`,
			notes: `<p>The order of the answer matters. Written units first, each digit needs only its own column and the carry of the column just written, and small transformers learn addition that way well (Lee et al. 2023, <i>Teaching Arithmetic to Small Transformers</i>). Written most significant digit first, as here and as people write, the dependence on far-away columns comes first. A transformer can in principle work carries out in parallel within a pass, as the carry-lookahead adders in chips do, so this is about what a small model learns from its training, not about what it could never do.</p>`
		},
		{
			id: 'working',
			chapter: 'task',
			title: 'Writing the working',
			scene: 'race',
			hints: { phase: 'working' },
			duration: 30,
			controls: [sum, another],
			body: `
<p>The working the scratchpad model was trained to write follows the schoolbook rule, one small job per column: add the column's two digits and the incoming carry, write the digit, then write the carry. The two digits are in the question; the carry is the character the model wrote one pass before. That carry goes back in at the bottom of the stack as input (the pink arrows), so no pass ever has to look further than one column down.</p>
<p>Once the ten columns are written, the answer is the working read backwards: the last carry, then each column's digit from the top down. Whether a carry ripples up through a run of nines is no longer decided in one pass; it is written down a column at a time.</p>`
		},
		{
			id: 'passes',
			chapter: 'task',
			title: 'More passes, more computation',
			scene: 'depth',
			hints: { phase: 'scratch' },
			duration: 26,
			controls: [sum, another],
			body: `
<p>Counted in forward passes, the direct model spends 12 on a sum: eleven digits and the end mark. The scratchpad model spends 33: twenty for the working, the <code>&gt;</code>, and the same twelve. It is the same kind of network, the same size, run nearly three times as often, and each pass can read what the earlier ones wrote.</p>
<p>That is what the written steps give it: more computation, and a place to keep partial results (the carries) where the next pass reads them back in. Nothing else about the model changed.</p>`,
			notes: `<p>The passes are not sealed off from each other: each pass also attends to the internal states that earlier passes left at every position, which is how the direct model's later digits use work done in earlier passes. What a written character adds is a result squeezed into one symbol that re-enters at the bottom of the stack, so the next pass starts from it with its full depth.</p>`
		},
		// ------------------------------------------------------------------ measure
		{
			id: 'nines',
			chapter: 'measure',
			title: 'Where the direct model goes wrong',
			scene: 'chart',
			hints: { phase: 'nines' },
			duration: 26,
			body: `
<p>Both models were tested on ${HELD} 8-digit sums, 200 for each point: sums with no column adding up to 9; sums whose longest run of nines is 1 to 7 columns, separately with and without a carry coming into the run; and sums of eight nines, where no carry can come in.</p>
<p>The scratchpad model gets all of them right. The direct model gets ${n('direct', 0, false)} of the sums without nines, but only about two in three when a run of two to four nines gets no carry from below (${n('direct', 2, false)}, ${n('direct', 3, false)}, ${n('direct', 4, false)}): mostly it writes a carry that never comes, as in the first sum of this page. When a carry does come into a short run it sometimes misses it (${n('direct', 2, true)} right for a run of two), while long runs with a carry it gets right. Of its ${fmt(errors.wrongDigits)} wrong digits on these sums, ${fmt(errors.wrongFar)} sit just above a column adding up to 9, where the carry has to be found further down; of all the digits of these sums, ${pct(errors.far / errors.digits)} do.</p>`,
			notes: `<p>Runs of nines are rare in random numbers: in two random 8-digit numbers a run of three or more turns up about once in 200 sums. So a quarter of the training sums had one planted, of random length, with a carry coming into it half the time; both models saw the same sums. With ${BLOCKS === 'one block' ? 'two blocks' : 'one block'} instead of ${BLOCKS}, trained the same way, the gap is wider: the direct model gets ${pct(byDigits('direct', one('direct'))[7])} of random 8-digit sums and ${pct(ninesTotal('direct', one('direct')))} of the runs-of-nines ones (as few as ${pct(ninesWorst('direct', one('direct')))} in one cell), while the scratchpad model still gets ${pct(ninesTotal('scratchpad', one('scratchpad')))}. Fewer blocks per pass hurt the model that has to settle the most within one pass.</p>`
		},
		{
			id: 'digits',
			chapter: 'measure',
			title: 'Longer numbers than in training',
			scene: 'chart',
			hints: { phase: 'digits' },
			duration: 24,
			body: `
<p>By the length of the numbers, on random sums, both models are nearly perfect up to 8 digits: the direct model gets ${pct(byDigits('direct')[7])} of 8-digit sums right, the scratchpad model ${pct(byDigits('scratchpad')[7])}. Random sums seldom have long runs of nines, so the direct model's weakness hardly shows here.</p>
<p>The two top columns were always zero in training. With 9- or 10-digit numbers both models fail completely: ${pct(byDigits('direct')[8])} and ${pct(byDigits('scratchpad')[8])} right at 9 digits. Writing the working does not teach a model to use columns it never saw used: a scratchpad is not a cure for inputs longer than the training ones.</p>`,
			notes: `<p>Nye et al. (2021), who introduced scratchpads, trained on 1 to 8 digits and tested on 9 and 10: their scratchpad models did better than direct ones beyond the training lengths, but they degraded too. How well a model carries a skill to longer inputs depends a lot on how positions are represented; these models learn one vector per position, and a column that was always zero is one they learnt nothing about.</p>`
		},
		{
			id: 'learning',
			chapter: 'measure',
			title: 'Easier to learn',
			scene: 'chart',
			hints: { phase: 'learning' },
			duration: 24,
			body: `
<p>Through training, every 500 steps, the share of the 3,400 held-out 8-digit sums of the last two steps that each model wrote exactly right, every character: after 1,000 steps the scratchpad model was at ${pct(at('scratchpad', 1000))} and the direct model at ${pct(at('direct', 1000))}; at the end, ${pct(end('scratchpad'))} and ${pct(end('direct'))}.</p>
<p>Each step of the working is a short rule, the same for every column, and it is learnt quickly. The direct model has to find, from examples alone, a way to settle carries across many columns within one pass, and after ${STEPS} steps it still has not quite.</p>`,
			notes: `<p>These are single runs from one seed each, so the wiggles between neighbouring points are noise. This share is strict (one wrong character of the working counts as a miss), so it can sit below the share of right answers; for the shipped models the two are the same.</p>`
		},
		// ------------------------------------------------------------------ meaning
		{
			id: 'meaning',
			chapter: 'meaning',
			title: 'Computation, not a confession',
			scene: 'race',
			hints: { phase: 'both' },
			duration: 30,
			controls: [sum, another],
			body: `
<p>Choose a preset or draw random sums, with or without a run of nines, and watch where the two models part. The chart two steps back shows which runs trip this direct model up most.</p>
<p>The written steps help because they are computation the model conditions on: every character it writes goes back in, and the next pass builds on it. Change one carry in the scratchpad model's working and let it go on: the next column and the answer follow the changed carry (see “Go deeper”). The steps are not the model narrating a thought it had anyway. Writing out reasoning before an answer (a <i>chain of thought</i>) can also improve the answers of large language models, though how much they rely on what they wrote varies from task to task: there the written reasoning is not guaranteed to be how the answer was reached. It can leave out what really swayed the answer (Turpin et al. 2023), and cutting it short or slipping a mistake into it sometimes changes the answer and sometimes does not (Lanham et al. 2023).</p>
<p>More characters means more computation, not thinking in a human sense. That is the takeaway: a transformer runs the same fixed stack for every character, so writing intermediate steps gives the same model more passes and a place to keep partial results, and with them it gets right the sums the direct model gets wrong.</p>`,
			notes: `<p>The test: in ${flips.sums} random 8-digit sums, the scratchpad model was given its correct working up to one column's digit, then the wrong carry for that column (a 0 instead of a 1, or the other way round), and left to write the rest. In ${flips.nextFollows} of them the next column's digit followed the wrong carry, and in ${flips.answerFollows} the final answer was off from the true sum by exactly that carry. So this model's answer does depend on the carries it wrote, as the format intends; that is one check of one kind of step in one tiny model, not a property of written reasoning in general. Chain-of-thought prompting (Wei et al. 2022) asks a large model to write steps nobody specified; models trained by reinforcement learning to reason at length write steps of their own, and whether those steps are faithful has to be checked, not assumed.</p>`
		}
	]
};
