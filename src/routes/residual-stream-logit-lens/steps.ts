import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';

/**
 * The prompts on the page, in the order of the menu, with the number of words read out (tokens
 * after the start token). Ids match `lens-data.ts`; a model test checks. Kept here, without the
 * data, so the narrative does not load it.
 */
export const PROMPT_MENU = [
	{ id: 'mary', label: 'Mary', n: 14 },
	{ id: 'count', label: '1, 2, 3…', n: 12 },
	{ id: 'fox', label: 'fox', n: 9 },
	{ id: 'light', label: 'light', n: 8 },
	{ id: 'france', label: 'Paris', n: 8 }
] as const;

const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
/** The number of words of the chosen prompt. */
export const wordsOf = (p: Params) => (PROMPT_MENU.find((m) => m.id === p.s) ?? PROMPT_MENU[0]).n;
/** The word whose next-token guesses are read out (1-based), kept inside the prompt. */
export const colOf = (p: Params) => Math.max(1, Math.min(wordsOf(p), Math.round(n(p.col, 99))));
/** The row read out: 0 the embedding, L after block L. */
export const rowOf = (p: Params) => Math.max(0, Math.min(12, Math.round(n(p.row, 12))));
export const depthOf = (p: Params) => Math.max(0, Math.min(12, Math.round(n(p.depth, 12))));
export const blockOf = (p: Params) => Math.max(1, Math.min(12, Math.round(n(p.block, 11))));
export const partOf = (p: Params) => (p.part === 'attn' ? 'attn' : 'mlp');

const promptControl: Control = {
	type: 'select',
	id: 's',
	label: 'Prompt',
	default: 'mary',
	options: PROMPT_MENU.map((m) => ({ value: m.id, label: m.label })),
	help: 'Five fixed prompts, named by the word GPT-2 small predicts next; they were run through the model when the page was made.'
};

const depth: Control = {
	type: 'range',
	id: 'depth',
	label: 'Running vector after block',
	min: 0,
	max: 12,
	step: 1,
	default: 12,
	format: (v) => (Math.round(v) === 0 ? 'the embedding alone' : `block ${Math.round(v)}`)
};

const row: Control = {
	type: 'range',
	id: 'row',
	label: 'Read the stream after block',
	min: 0,
	max: 12,
	step: 1,
	default: 12,
	format: (v) => (Math.round(v) === 0 ? 'the embedding (row 0)' : `block ${Math.round(v)}`),
	help: 'Or click a cell of the grid.'
};

const col: Control = {
	type: 'range',
	id: 'col',
	label: 'Token',
	min: 1,
	max: 14,
	bounds: (p) => [1, wordsOf(p)],
	step: 1,
	default: 14
};

const block: Control = {
	type: 'range',
	id: 'block',
	label: 'Block',
	min: 1,
	max: 12,
	step: 1,
	default: 11
};

const part: Control = {
	type: 'select',
	id: 'part',
	label: 'Component',
	default: 'mlp',
	options: [
		{ value: 'attn', label: 'its attention' },
		{ value: 'mlp', label: 'its MLP' }
	]
};

const off: Control = {
	type: 'toggle',
	id: 'off',
	label: 'Switch it off (replace its output with zeros)',
	default: true
};

const LN = `<dfn data-def="Layer normalization: subtract the vector's mean, divide by its standard deviation (with a tiny ε = 10⁻⁵ added to the variance), then multiply by a learned gain and add a learned bias, number by number. Before the gain and bias, the output has the same spread whatever the size of the input.">layer norm</dfn>`;
const UNEMBED = `<dfn data-def="The last matrix of the model: one row per token of the vocabulary, 50,257 rows of 768 numbers. Its dot product with the final vector gives each token a score (a logit); a softmax turns the scores into probabilities. GPT-2 reuses its embedding matrix here (tied weights).">unembedding</dfn>`;
const ABLATE = `<dfn data-def="Removing a part of a model to see what changes. Zero-ablation replaces the part's output by zeros; mean-ablation replaces it by its average output over many texts, which disturbs the rest of the network less.">ablation</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'residual-stream-logit-lens',
	title: 'Inside a transformer block: the residual stream',
	summary:
		'Follow one word’s vector down GPT-2 small’s twelve blocks: each attention and each MLP adds a correction to one running vector. Read that vector after every block with the logit lens and watch the next word appear and sharpen; switch off any block’s attention or MLP and see which guesses change.',
	chapters: [
		{ id: 'stream', title: 'One running vector' },
		{ id: 'lens', title: 'The logit lens' },
		{ id: 'ablate', title: 'Switching parts off' }
	],
	steps: [
		// ------------------------------------------------------------------ stream
		{
			id: 'stream',
			chapter: 'stream',
			title: 'A block reads a copy and adds',
			scene: 'stream',
			hints: { phase: 'block' },
			duration: 30,
			controls: [promptControl],
			body: `
<p>The <a href="../transformers/">transformers</a> page looked at what attention attends to. This page follows the vector it works on. GPT-2 small gives every token a vector of 768 numbers: its token embedding plus its position embedding. Then twelve blocks run in turn, and each one does the same two things to every token's vector x.</p>
<p>First it takes a copy of x, rescales it with a ${LN}, runs attention on those copies across the earlier tokens, and adds the result back: x ← x + attention(LN(x)). Then it takes a new copy, layer-norms it, runs it through the MLP (a two-layer network applied to each token on its own) and adds that too: x ← x + MLP(LN(x)).</p>
<p>The stage draws this for the last word of the prompt, “to” in the sentence about Mary and John. Down the left, the stream: one vector carried from the embedding to the output, with each block's attention and MLP branching off it and adding back in at ⊕. Nothing replaces x; every block only adds to it. That running vector is called the <dfn data-def="The vector x of one token as it passes through the blocks: the embedding plus everything every block has added so far. The name comes from the residual (skip) connection that carries x past each block.">residual stream</dfn>.</p>`,
			notes: `<p>“Residual” comes from residual networks (He and colleagues, 2015): each layer learns a correction to its input rather than a whole new representation, which is what lets very deep networks train. GPT-2 puts the layer norm at the start of each branch (“pre-LN”), so the stream itself is never normalized until the very end, where a final layer norm comes before the unembedding.</p>`
		},
		{
			id: 'arrows',
			chapter: 'stream',
			title: 'Twenty-four corrections, one sum',
			scene: 'stream',
			hints: { phase: 'arrows' },
			duration: 34,
			controls: [promptControl, depth],
			body: `
<p>Because every block adds, the final vector is a plain sum: the embedding plus twelve attention outputs plus twelve MLP outputs. The plane on the right draws that sum as arrows laid head to tail, attention in orange, MLP in green, for the last word. Across: the direction that raises the final answer (“Mary”) above the average token, as the output reads it; up: the same for the runner-up (“them”), set at right angles. The projection is linear, so the arrows really add up to the dot at the end. They are projections, not changes in probability: the lens still divides by the stream's spread before it scores the tokens.</p>
<p>Move the slider through the blocks. For eight blocks the vector barely moves in these two directions; block 9 starts to move it, then block 10's attention throws it far towards “Mary”, and the later blocks add more. The bars beside each block in the tower say the early blocks are not idle: their outputs have lengths of 6 to 30, against 35 to 58 for blocks 9 and 10. They point elsewhere, in the other 766 directions. (Block 12's attention is longer still, 292, but 86% of that sits in five of the 768 coordinates, and its effect on the scores is to lower every token's by nearly the same amount.)</p>
<p>The stream also grows: from a length of 4.5 at the embedding to 478 after block 12. Each block reads it through a layer norm, which divides by its spread, so block 1 sees it scaled up about six times and block 12 scaled down about nine times; each branch reads a copy normalized to the same spread, before its own learned gain and bias, and adds its output at full size.</p>`,
			notes: `<p>Two directions out of 768 show little of a vector, and they are chosen with hindsight, from the answer the model finally gives. The direction for a token t is what the lens reads of it: the final layer norm's gain times t's row of the unembedding minus the average row, with the mean taken out (the layer norm subtracts it). Adding the same amount to every token's score changes no probability, and GPT-2's last blocks shift all the scores by a large shared amount, which would swamp the picture; taking out the average row leaves only what tells the answer apart from other tokens.</p>`
		},
		// ------------------------------------------------------------------ lens
		{
			id: 'lens',
			chapter: 'lens',
			title: 'Reading the stream early: the logit lens',
			scene: 'grid',
			hints: { phase: 'lens' },
			duration: 34,
			controls: [promptControl, row, col],
			body: `
<p>After block 12, GPT-2 turns the last vector into a prediction: a final layer norm, then the ${UNEMBED}, which scores every token in its vocabulary, then a softmax. The <dfn data-def="Reading an intermediate residual vector with the model's own final layer norm and unembedding, as if it were the last one. Named by nostalgebraist (2020).">logit lens</dfn> (nostalgebraist, 2020) applies the same two steps to the stream after any block, as if the model stopped there. Since the stream is one vector that every block adds to, the same reader fits it at every depth, at least roughly.</p>
<p>The grid does that for every token of the prompt (punctuation included) and every depth. Row 0 is the embedding alone, row 12 the model's real output; each cell is the lens's best guess for the token after the word above it, shaded by its probability. The last column is the prediction the page followed: for the Mary sentence, the lens guesses tokens such as “destro”, “get”, “drink” and “them” for ten rows, then “Mary” at 99.8% after block 10.</p>
<p>Click a cell, or move the sliders, to see the lens's three best guesses there.</p>`,
			notes: `<p>The lens is defined with the final layer norm, not just the unembedding: without it, the stream's growing length and its few very large coordinates would swamp the scores. In row 12 the lens is not an approximation; it is the model's output, and the page's tests check it against the run on the transformers page.</p>`
		},
		{
			id: 'grid',
			chapter: 'lens',
			title: 'The answer appears, then sharpens',
			scene: 'grid',
			hints: { phase: 'grid' },
			duration: 34,
			controls: [promptControl, row, col],
			body: `
<p>Down each column, the guess is refined. In the count “1, 2, 3, 4, 5, 6,” the last column reads “etc” for several rows, then “6” after block 9 and “7” after block 10, which it keeps. In the repeated phrase “The quick brown fox jumps. The quick brown”, “fox” becomes the top guess after block 8. After the first “brown” the model's own guess is not “fox”; after the second it is, at 98%, so it has copied it from earlier in the prompt, the behaviour of the <a href="../transformers/">induction heads</a>. The lens shows when the guess appears, not which heads produced it.</p>
<p>Sharpening is not the whole story. The Mary column reaches 99.8% after block 10 and then the last two blocks pull it back to 68%: GPT-2's final blocks hedge. In “The capital of France is the city of”, the lens says “Marse” (the start of Marseille) after blocks 10 and 11, and only the last block puts “Paris” ahead, at 10%.</p>
<p>Look along a row, too: every block works on every word at once. After block 10, the commas after 2 to 6 each predict the next number, “3” to “7”, all at 99% or more (the first comma still guesses “000”).</p>`,
			notes: `<p>GPT-2's top guess is a token, not a word: “Marse” is a token of its own, and the model would write “ille” next. The grid's colour is the probability of each cell's guess; a pale cell is a guess the lens makes with little confidence, which for the early rows is most of them.</p>`
		},
		{
			id: 'caveat',
			chapter: 'lens',
			title: 'What the lens cannot tell you',
			scene: 'grid',
			hints: { phase: 'caveat' },
			duration: 34,
			controls: [promptControl, row, col],
			body: `
<p>The early rows are where the lens is least trustworthy, and the page dims them. Training never asked blocks 1 to 11 to leave the stream in a form the final layer norm and unembedding can read; only the last vector was ever read that way. Row 0 often guesses the word itself (GPT-2 uses the same matrix to embed and to unembed) or odd tokens such as “destro” and “mathemat”, and it can be confidently wrong: “destro” at 74% after the last “to”. Row 1 reads like a <a href="../ngram-text-models/">bigram model</a>: “nd” after “2”, “rd” after “3”.</p>
<p>So an early guess is not what the model “thinks” at that depth. The stream can already hold what the answer needs, in directions this reader ignores. The <dfn data-def="A logit lens with a small learned correction: for each block, an affine map trained so that reading the stream after that block through the final layer norm and unembedding matches the model's final output as closely as possible.">tuned lens</dfn> (Belrose and colleagues, 2023) trains one small correction per block before reading, and its early predictions are much better. On GPT-2 the plain lens works roughly; on some other models, such as GPT-Neo, it fails at most depths.</p>
<p>Nor do blocks hand a message down the line. Block 10 does not receive block 9's output: it reads the whole sum, the embedding plus every earlier output, and adds its own. Any block can read what any earlier block wrote, as long as no later one has written over it.</p>`,
			notes: `<p>Even a good lens shows what a fixed reader can decode, not what the network uses: a feature can be present and ignored, or used by a later block without ever showing up as a token score. Interpretability work on the residual stream (Elhage and colleagues, 2021) treats it as a shared workspace, a sum that each component reads from and writes to through its own projections.</p>`
		},
		// ------------------------------------------------------------------ ablate
		{
			id: 'ablate',
			chapter: 'ablate',
			title: 'Switch one component off',
			scene: 'ablate',
			hints: { phase: 'grid' },
			duration: 34,
			controls: [promptControl, block, part, off],
			body: `
<p>If a block only adds a correction, removing one should leave the rest of the sum in place. The page tried it: for each prompt, 24 more runs of GPT-2, each with one block's attention or MLP output replaced by zeros, a zero-${ABLATE}. Everything downstream was recomputed, since later blocks read the changed stream.</p>
<p>The grid shows the run with the chosen component switched off; cells whose guess changed are outlined in red. The rows above the block cannot change, since nothing before it saw it. Switch off block 11's MLP in the Mary sentence: the rows from 11 change, and the answer flips from “Mary” at 68% to “them”, with “Mary” at 26%.</p>
<p>Try block 1's MLP: most of the grid changes, at every token. GPT-2 small's first MLP is often described as part of the embedding, something every later block reads; this page does not isolate why removing it does so much, and replacing its output with zeros, a value it never produces, may add to the damage.</p>`,
			notes: `<p>Zeros are not what a component normally outputs, so a zero-ablation also tests how the network copes with an input it never saw. Mean-ablation, replacing the output with its average over many texts, disturbs the network less; activation patching swaps in the output from a different prompt. This page uses zeros because they need no other data, and says which effects are artefacts of it.</p>`
		},
		{
			id: 'effects',
			chapter: 'ablate',
			title: 'Which components matter',
			scene: 'ablate',
			hints: { phase: 'effects' },
			duration: 34,
			controls: [promptControl, block, part],
			body: `
<p>The chart lists all 24 runs at once: how much each switched-off component changes the probability of the prompt's answer. Block 1 is grey: switching off its attention wrecks every prompt, and switching off its MLP hurts all five. An effect that large on every prompt, whatever the task, tells us little about the task; its cause is not isolated here.</p>
<p>Past block 1, each prompt has its own few: block 11's MLP for “Mary”, block 12's attention for “7” (96% falls to 66%), block 12's attention and block 11's MLP for “fox”. Most components, switched off alone, change little: the corrections of the others are still in the sum.</p>
<p>And the arrow that pointed hardest at “Mary”, block 10's attention, is not the one the model cannot do without: switch it off and “Mary” rises to 78%. When Wang and colleagues (2022) knocked out the heads that copy the name, they found “backup” heads that took over; switching off a whole block's attention, as here, cannot tell which mechanism is at work, but it shows that a big arrow is not the same as an indispensable one. That is the takeaway: every block adds a correction to one shared running vector, the prediction is refined as those corrections pile up, and no single block passes the answer to the next.</p>`,
			notes: `<p>In the indirect-object sentence, the heads that copy “Mary” (Wang and colleagues' name movers, 9.9 and 9.6 counting from 0) sit in block 10 here; when they are knocked out, “backup” heads in the same and later blocks do a similar job. Switching off a whole block's attention also removes heads that push against the answer, so a single number per component mixes several effects. Finding which components matter for a behaviour, and how they connect, is the work of circuit analysis.</p>`
		}
	]
};
