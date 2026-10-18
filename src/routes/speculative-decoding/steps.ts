import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { DRAFTS, type DraftId } from './models';
import { K_MAX, runOf } from './results';

/** The runs the "Write another" button steps through (the first is the one the text describes). */
export const RUN_SEEDS = [4, 1, 5, 2, 3, 6];
export const seedOf = (p: Params) =>
	RUN_SEEDS[Math.abs(Math.round(Number(p.seed ?? 0))) % RUN_SEEDS.length];
export const draftOf = (p: Params) => String(p.draft ?? 'small') as DraftId;
export const kOf = (p: Params) => Math.round(Number(p.k ?? 4));

const draft: Control = {
	type: 'select',
	id: 'draft',
	label: 'Draft model',
	default: 'small',
	options: DRAFTS.map((d) => ({ value: d.id, label: d.name }))
};

const k: Control = {
	type: 'range',
	id: 'k',
	label: 'Guesses per round (k)',
	min: 1,
	max: K_MAX,
	step: 1,
	default: 4
};

const round: Control = {
	type: 'range',
	id: 'round',
	label: 'Round',
	min: 1,
	max: 58,
	step: 1,
	default: 1,
	bounds: (p) => [1, runOf(draftOf(p), kOf(p), seedOf(p)).rounds.length]
};

const rewrite: Control = {
	type: 'action',
	id: 'seed',
	label: 'Draw other random numbers',
	action: 'Write another'
};

const resample: Control = {
	type: 'action',
	id: 'resample',
	label: 'Draw other random numbers',
	action: 'Draw 10,000 again'
};

const TARGET = `<dfn data-def="The large model whose writing we want: here the tiny GPT of the KV-cache page, 2 layers, 4 heads, 32 numbers wide, trained on Tiny Shakespeare.">target</dfn>`;
const DRAFT = `<dfn data-def="A cheaper model over the same characters that guesses ahead: here a smaller tiny GPT (16 numbers wide, trained the same way), or counts of characters (bigram, unigram) from the same text.">draft</dfn>`;
const RESIDUAL = `<dfn data-def="max(0, p − q), divided by its sum: the part of the target's probabilities that the draft's do not cover. Its sum is exactly the chance of a rejection.">leftover distribution</dfn>`;
const TV = `<dfn data-def="Total-variation distance: half the sum of the absolute differences between two distributions, the largest difference in probability they give to any set of outcomes. 1 − Σ min(p, q) is the total-variation distance between p and q.">distance</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'speculative-decoding',
	title: 'Speculative decoding',
	summary:
		'A small model guesses the next few characters and the tiny GPT checks them all in one pass, keeping each guess with probability min(1, p/q) and redrawing the first one it turns down from the leftover; ten thousand samples show the output is exactly the big model’s, and the counted passes and bytes show when the guessing pays.',
	chapters: [
		{ id: 'guess', title: 'Guess, then check' },
		{ id: 'exact', title: 'Exactly the target’s writing' },
		{ id: 'speed', title: 'How much faster' }
	],
	steps: [
		// ------------------------------------------------------------------ guess
		{
			id: 'one-pass',
			chapter: 'guess',
			title: 'Every character costs a pass of the big model',
			scene: 'round',
			hints: { mode: 'plain' },
			duration: 28,
			controls: [rewrite],
			body: `
<p>A <a href="../language-models/">language model</a> writes one token at a time: one pass through the whole model gives the probabilities of the next token, one is drawn, and the model runs again. Here the model, the ${TARGET}, is the tiny GPT of <a href="../kv-cache-inference/">the KV-cache page</a>, writing characters after “ROMEO:” with its cache. Filling its 64-character window takes 58 characters, so 58 passes.</p>
<p>That page showed why a pass is slow on a real model: at small batch, a decode step is <em>memory-bound</em>. Reading every weight from memory takes far longer than the arithmetic done with it. And a pass over 5 positions reads the weights once, just like a pass over 1. So if someone handed the model the next few characters, checking all of them would cost about as much as writing one.</p>`,
			notes: `<p>The tiny GPT itself is not memory-bound when it runs in your browser: it is far too small. So this page never times anything. It counts what a real deployment pays for: passes of the target model, and the bytes each pass and each guess read, as the KV-cache page counted them (8 bytes per number, since these models compute in float64).</p>`
		},
		{
			id: 'draft',
			chapter: 'guess',
			title: 'A small model guesses; the big one checks in one pass',
			scene: 'round',
			hints: { mode: 'round', focus: 'draft', round: 1 },
			duration: 30,
			controls: [draft, k, rewrite],
			body: `
<p>Speculative decoding (Leviathan, Kalman and Matias 2023; Chen et al. 2023) gets those guesses from a ${DRAFT}: a cheaper model with the same alphabet. Here it is a smaller tiny GPT, 16 numbers wide instead of 32, trained the same way on the same text. One of its steps reads 28% of the bytes of a target step.</p>
<p>Each round, the draft writes k guesses, one after another, each drawn from its own probabilities <em>q</em>: after “ROMEO:↵” it guesses “Whag”. Then the target runs <strong>one pass</strong> over 5 positions: the last character already written and the 4 guesses. That gives its own probabilities <em>p</em> at every guess, plus one more set after the last. The bars compare the two at the first guess.</p>`,
			notes: `<p>The draft must share the target's vocabulary: the check compares the two models' probabilities for the same token. In practice the draft is a much smaller model of the same family (the papers drafted T5-XXL, 11 billion parameters, with T5-small, and Chinchilla 70B with a 4-billion-parameter model). Other drafts exist: extra prediction heads on the target itself (Medusa), or the prompt's own text (lookup decoding).</p>`
		},
		{
			id: 'keep',
			chapter: 'guess',
			title: 'Keep each guess with probability min(1, p/q)',
			scene: 'round',
			hints: { mode: 'round', focus: 'accept', round: 1 },
			duration: 30,
			controls: [draft, k, round, rewrite],
			body: `
<p>The guesses are checked in order. Guess <em>x</em> is kept with probability min(1, <em>p</em>(<em>x</em>)/<em>q</em>(<em>x</em>)): a uniform random number <em>u</em> is drawn, and the guess stays if <em>u</em> &lt; <em>p</em>/<em>q</em>.</p>
<p>When the target likes a character at least as much as the draft did (<em>p</em> ≥ <em>q</em>), it is always kept: “W” had <em>q</em> = 0.066 and <em>p</em> = 0.097. When the draft overrated it, the guess survives only in the ratio: “a” had <em>q</em> = 0.284 and <em>p</em> = 0.252, so it was kept with chance 0.89 (here <em>u</em> = 0.08). Overrated guesses are thinned out by exactly the amount the draft overrated them. Move the round to watch others.</p>`
		},
		{
			id: 'reject',
			chapter: 'guess',
			title: 'Turned down: draw from what the draft left out',
			scene: 'round',
			hints: { mode: 'round', focus: 'reject', round: 1 },
			duration: 30,
			controls: [draft, k, round, rewrite],
			body: `
<p>The fourth guess, “g”, had <em>q</em> = 0.005 and a target probability of almost zero: turned down. The round stops at the first rejection, and every guess after it is thrown away, as are their keys and values in both caches (the next pass simply writes over them).</p>
<p>In its place the target draws one character from the ${RESIDUAL}: max(0, <em>p</em> − <em>q</em>), normalised, the part of the target's bars that sticks out above the draft's. After “Wha” almost all of it is on “t”, so the round wrote “What”: 4 characters for one pass of the target.</p>`,
			notes: `<p>Drawing from <em>p</em> itself after a rejection would be wrong: the characters the draft overrates have already had their chance through the kept guesses, so the replacement must favour exactly those the draft underrates. The next chapter shows that the two parts add up to <em>p</em>.</p>`
		},
		{
			id: 'bonus',
			chapter: 'guess',
			title: 'All kept: one more character for free',
			scene: 'round',
			hints: { mode: 'round', focus: 'bonus', round: 2 },
			duration: 30,
			controls: [draft, k, round, rewrite],
			body: `
<p>In the second round the draft guessed “ thi” and all four were kept. The target's pass has already computed <em>p</em> after the last guess, so one more character is drawn from it for free: “s”. Five characters for one pass.</p>
<p>So a round writes between 1 and k + 1 characters, and it always writes at least the one plain decoding would have. With this draft and k = 4 the whole window took 20 passes instead of 58: 2.9 characters per pass. Change the draft or k, or write another text, and watch the count of passes.</p>`
		},
		// ------------------------------------------------------------------ exact
		{
			id: 'exact',
			chapter: 'exact',
			title: 'The output is the target’s, exactly',
			scene: 'hist',
			hints: { mode: 'exact' },
			duration: 30,
			controls: [draft, resample],
			body: `
<p>Is the text still the target's own, or the draft's? Take one context, “ROMEO:↵Wh”, and run the first step of a round 10,000 times: a guess from <em>q</em>, the check, and a draw from the leftover if it is turned down. The target's probabilities <em>p</em> are the marks: “e” 0.27, “a” 0.25, “o” 0.18, “y” 0.16, “i” 0.14.</p>
<p>The histogram of what was written lands on <em>p</em>, not on <em>q</em>, whichever draft guesses, even the character counts that would put 15% on a space. The blue bands show the spread that sampling noise alone gives 10,000 draws (two standard errors): the bars land in or near them, and the histogram's ${TV} from <em>p</em> is about what noise alone gives. Press the button for other random numbers, or watch the first hundred draws wander: the noise shrinks as the draws grow, and no bias remains. Speculative decoding is not an approximation of the target: it changes how fast the text is written, not what is written.</p>`
		},
		{
			id: 'why',
			chapter: 'exact',
			title: 'Why: the kept guesses plus the leftover make p',
			scene: 'hist',
			hints: { mode: 'why' },
			duration: 30,
			controls: [draft, resample],
			body: `
<p>A character <em>x</em> can be written two ways. As a kept guess: drawn with chance <em>q</em>(<em>x</em>) and kept with chance min(1, <em>p</em>/<em>q</em>), together min(<em>p</em>(<em>x</em>), <em>q</em>(<em>x</em>)). Or from the leftover, after a rejection. A rejection happens with chance 1 − Σ min(<em>p</em>, <em>q</em>) = Σ max(0, <em>p</em> − <em>q</em>), which is exactly the sum that normalises the leftover, so this way writes <em>x</em> with chance max(0, <em>p</em>(<em>x</em>) − <em>q</em>(<em>x</em>)).</p>
<p>The two add up: min(<em>p</em>, <em>q</em>) + max(0, <em>p</em> − <em>q</em>) = <em>p</em>. The bars split each count into its two parts. The kept share is the overlap of the two distributions, Σ min(<em>p</em>, <em>q</em>): 0.88 for the small GPT here, 0.73 for the bigram, 0.26 for the character counts. A worse draft is rejected more often, never wrong.</p>`,
			notes: `<p>The same argument holds at every later guess, given the characters before it: the target's <em>p</em> there is computed on the kept text, so each written character has the target's distribution given everything before it, and the whole text is distributed as the target's own (Leviathan et al. 2023, Appendix A.1; Chen et al. 2023, Theorem 1). The page's model tests check it on the second character of whole runs too. In real systems floating-point differences between a pass over many positions and one over a single position can change the last digits, as on the KV-cache page.</p>`
		},
		{
			id: 'greedy',
			chapter: 'exact',
			title: 'Greedy decoding, and a shortcut that breaks sampling',
			scene: 'hist',
			hints: { mode: 'wrong' },
			duration: 30,
			controls: [draft, resample],
			body: `
<p>With <em>greedy</em> decoding both models always take their most likely character, so <em>p</em> and <em>q</em> are all-or-nothing and the rule becomes simple: keep a guess if it is the target's top choice, otherwise write the target's top choice. The output is then the target's greedy text character for character, whatever the draft.</p>
<p>That shortcut is wrong when sampling. Keeping a sampled guess only when it is the target's top choice, and drawing from <em>p</em> otherwise, writes “e” about half the time instead of 27%: every kept guess is an “e”, and the redraws add more. The right panel runs that rule on the same 10,000 draws.</p>`,
			notes: `<p>Many serving systems offer both: greedy speculative decoding for deterministic output, and the rejection rule of this page for sampling with a temperature. With a temperature, top-k or top-p, both <em>p</em> and <em>q</em> must be the adjusted distributions actually sampled from, or the output follows the wrong one.</p>`
		},
		// ------------------------------------------------------------------ speed
		{
			id: 'per-pass',
			chapter: 'speed',
			title: 'Characters per pass: how often the draft agrees',
			scene: 'speed',
			hints: { focus: 'passes' },
			duration: 30,
			controls: [draft, k],
			body: `
<p>The dots are measured: characters written per target pass, over six generations for each k. They depend on the <em>keep rate</em> α, the share of guesses kept: 0.33 for character counts, 0.55 for the bigram, 0.76 for the small GPT.</p>
<p>If each guess were kept independently with chance α, a round would write on average (1 − α<sup>k+1</sup>) / (1 − α) characters (the curves), never more than 1/(1 − α) however many guesses: 4.2 for the small GPT, 2.2 for the bigram. More guesses help less and less, because a round stops at the first rejection. With the target itself as the draft every guess is kept, and a round writes k + 1.</p>`,
			notes: `<p>The keep rate is not really constant: it is Σ min(<em>p</em>, <em>q</em>) at each position, high where the text is predictable (the rest of a word, a speaker's name) and low at the start of a word. The formula, from Leviathan et al., uses the average; on these runs it agrees with the measured counts to within a few per cent.</p>`
		},
		{
			id: 'cost',
			chapter: 'speed',
			title: 'The draft is not free',
			scene: 'speed',
			hints: { focus: 'cost' },
			duration: 32,
			controls: [draft, k],
			body: `
<p>Characters per pass is not the speed-up: the draft's own steps cost something too. When the target's pass is memory-bound, time follows the bytes read, so the chart counts the bytes read per character, target and draft together, against plain decoding.</p>
<p>The small GPT is the better guesser, but each of its steps reads 28% of what a target step reads: at k = 4 it reads 1.25 times fewer bytes per character, not 3. The bigram reads one row of 65 numbers per guess, almost nothing, and comes out ahead at about 2 times fewer. The target as its own draft keeps every guess and is slower than plain decoding. Meanwhile the arithmetic per character goes <em>up</em> (2.1 times for the small GPT at k = 4): rejected guesses are computed and thrown away. Speculative decoding trades spare arithmetic for fewer trips to memory, so it pays at small batches, where decoding is memory-bound, and less in large batches that already keep the GPU busy.</p>`,
			notes: `<p>Leviathan et al. report 2 to 3 times faster decoding for T5-XXL, and Chen et al. 2 to 2.5 times for Chinchilla 70B, with drafts whose steps cost a few per cent of the target's. Their improvement factor, (1 − α<sup>k+1</sup>) / ((1 − α)(<em>k c</em> + 1)) with <em>c</em> the cost of a draft step relative to a target pass, is what the bytes here measure. The tiny models on this page are not memory-bound in a browser, so its ratios are what a memory-bound deployment would see, not timings.</p>`
		}
	]
};
