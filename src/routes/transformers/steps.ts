import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * The sentences on the page, in the order of the menu (ids match `gpt2-data.ts`; a model test
 * checks). Kept here, without the attention data, so the narrative does not load the weights.
 */
export const SENTENCES = [
	{ id: 'animal', label: 'it', n: 14 },
	{ id: 'mary', label: 'Mary', n: 15 },
	{ id: 'fox', label: 'fox', n: 15 },
	{ id: 'keys', label: 'keys', n: 12 },
	{ id: 'dog', label: 'dog', n: 15 },
	{ id: 'capital', label: 'Rome', n: 14 },
	{ id: 'count', label: 'count', n: 13 },
	{ id: 'tom', label: 'he', n: 8 }
] as const;

/** GPT-2's tokens for the featured sentence, as the stage writes them (a model test checks). */
export const FEATURED_TOKENS = [
	'⟨start⟩',
	'The',
	'animal',
	'didn',
	"'t",
	'cross',
	'the',
	'street',
	'because',
	'it',
	'was',
	'too',
	'tired',
	'.'
];

/** Head presets for the "heads with a job" step: sentence, layer, head and token (from 0). */
export const PATTERNS = {
	previous: { s: 'count', layer: 4, head: 11, tok: 11 },
	subject: { s: 'keys', layer: 4, head: 3, tok: 7 },
	induction: { s: 'fox', layer: 5, head: 5, tok: 13 },
	names: { s: 'mary', layer: 9, head: 9, tok: 14 },
	start: { s: 'animal', layer: 5, head: 1, tok: 9 }
} as const;
export type PatternId = keyof typeof PATTERNS;

/** Controls that share an id share their value (and must share their default). */
const sentence = (id = 's', def = 'animal'): Control => ({
	type: 'select',
	id,
	label: 'Sentence',
	default: def,
	options: SENTENCES.map((s) => ({ value: s.id, label: s.label })),
	help: 'Eight fixed sentences, each named by a key word, run through GPT-2 small when the page was made.'
});

const layer: Control = {
	type: 'range',
	id: 'layer',
	label: 'Layer',
	min: 1,
	max: 12,
	step: 1,
	default: 5
};

const head: Control = {
	type: 'range',
	id: 'head',
	label: 'Head',
	min: 1,
	max: 12,
	step: 1,
	default: 4
};

const token: Control = {
	type: 'range',
	id: 'tok',
	label: 'Token',
	min: 1,
	max: 15,
	bounds: (p) => [1, (SENTENCES.find((x) => x.id === p.s) ?? SENTENCES[0]).n - 1],
	step: 1,
	default: 9,
	format: (v) => `no. ${Math.round(v)}`,
	help: 'Which token is looking: point at one on the stage, tap it, or use this slider.'
};

const query: Control = {
	type: 'range',
	id: 'fq',
	label: 'Token asking (the query)',
	min: 1,
	max: FEATURED_TOKENS.length - 1,
	step: 1,
	default: 9,
	format: (v) => `“${FEATURED_TOKENS[Math.round(v)] ?? ''}”`,
	help: 'Or click a token on the stage.'
};

const position: Control = {
	type: 'range',
	id: 'pos',
	label: 'Compare with position',
	min: 0,
	max: 63,
	step: 1,
	default: 10
};

const pattern: Control = {
	type: 'select',
	id: 'pattern',
	label: 'Head',
	default: 'previous',
	options: [
		{ value: 'previous', label: 'Previous token' },
		{ value: 'subject', label: 'The noun' },
		{ value: 'induction', label: 'Induction' },
		{ value: 'names', label: 'Name mover' },
		{ value: 'start', label: 'Resting' }
	]
};

const MODEL = `<dfn data-def="A transformer language model published by OpenAI in 2019: 12 layers, 12 attention heads per layer, 768 numbers per token, 124 million learned numbers in all. Its weights are public under the MIT licence.">GPT-2 small</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'transformers',
	title: 'Attention and transformers',
	summary:
		'Look inside GPT-2: see which earlier words each word attends to, layer by layer and head by head, then work through one attention operation with the model’s real numbers, from queries and keys to the weighted mix of values.',
	chapters: [
		{ id: 'context', title: 'Words need context' },
		{ id: 'operation', title: 'One attention operation' },
		{ id: 'heads', title: 'Heads and layers' },
		{ id: 'stack', title: 'A transformer' }
	],
	steps: [
		// ------------------------------------------------------------------ context
		{
			id: 'tokens',
			chapter: 'context',
			title: 'One vector per word is not enough',
			scene: 'tokens',
			hints: { phase: 'tokens' },
			duration: 24,
			controls: [sentence()],
			body: `
<p>On the <a href="../embeddings/">embeddings</a> page every word had one vector, whatever sentence it was in. That cannot be the whole story. In “the animal didn’t cross the street because <em>it</em> was too tired”, the vector of <em>it</em> is the same as in any other sentence, yet a reader knows it means the animal. And the average of the word vectors could not tell “the dog bit the man” from “the man bit the dog”.</p>
<p>A <dfn data-def="A neural network that updates every token's vector using the other tokens of the text, through attention, many times over.">transformer</dfn> fixes this by letting every word's vector take in information from the other words. This page looks inside a real one, ${MODEL}. Every number on the stage was computed by running it.</p>
<p>First it cuts the text into <dfn data-def="A piece of text from a fixed vocabulary: a common word with its leading space, a part of a rarer word, a digit or a punctuation mark. GPT-2 has 50,257 of them.">tokens</dfn> (“didn’t” becomes “␣didn” and “’t”; ␣ marks a space) and puts a special ⟨start⟩ token in front. Each token becomes a list of 768 numbers, its embedding, plus a second list that says where in the text it stands.</p>`,
			notes: `<p><strong>The tokens.</strong> GPT-2 uses <dfn data-def="Byte-pair encoding: start from single bytes and repeatedly merge the most frequent neighbouring pair into a new token, until the vocabulary has the size wanted.">byte-pair encoding</dfn>: 50,257 tokens learned from how often pieces of text occur, so common words are one token and rare words are several. The ⟨start⟩ token is GPT-2's <code>&lt;|endoftext|&gt;</code>, which separated documents in its training text; we put it first, as is usual when studying GPT-2.</p>
<p><strong>The model.</strong> GPT-2 small: Radford, Wu, Child, Luan, Amodei &amp; Sutskever, “Language Models are Unsupervised Multitask Learners”, OpenAI 2019. The weights come from Hugging Face (<code>openai-community/gpt2</code>, MIT licence). A script in this site's repository (<code>scripts/data/transformers/</code>) runs the model's forward pass in plain numpy on eight fixed sentences and stores every attention weight (to within 0.002) and, for one head, the query, key and value vectors.</p>`
		},
		{
			id: 'positions',
			chapter: 'context',
			title: 'Where a token stands',
			scene: 'positions',
			hints: { phase: 'positions' },
			duration: 24,
			controls: [position],
			body: `
<p>Attention, as you will see, makes each token a weighted average of the others. An average does not care about order: shuffle the tokens and every token gets the same mix as before. So the order has to be written into the vectors themselves.</p>
<p>GPT-2 has a learned <dfn data-def="A vector added to each token's embedding that depends only on the token's place in the text: one for position 0, one for position 1, and so on.">position embedding</dfn> for each of its 1,024 positions: 768 more numbers, added to the token's embedding. Nobody designed them: training set them, like every other weight. The stage compares the first 64 of them by cosine similarity, as on the embeddings page: bright where two positions point the same way.</p>
<p>The bright band along the diagonal says that neighbouring positions get similar vectors, and the similarity fades with distance: position 10 has a cosine of 0.998 with 11, 0.78 with 30 and 0.40 with 63. A token can therefore tell “the word just before me” from “a word far back”. Position 0 is the odd one out: its vector is twice as long as the others.</p>`,
			notes: `<p>The original transformer paper (Vaswani and colleagues, “Attention is all you need”, 2017) did not learn its positions: it used fixed sine and cosine waves of different wavelengths. GPT-2 learned them instead, and they came out smooth and wave-like anyway. Many newer models rotate the queries and keys by an angle that depends on the position instead (“rotary” embeddings).</p>`
		},
		// ------------------------------------------------------------------ operation
		{
			id: 'qkv',
			chapter: 'operation',
			title: 'Query, key and value',
			scene: 'attention',
			hints: { phase: 'qkv' },
			duration: 26,
			controls: [query],
			body: `
<p>Here is one attention operation, from <strong>layer 5, head 4</strong> of GPT-2, on our sentence. In it, each token's 768 numbers are multiplied by three learned matrices, each 768 × 64, giving three shorter vectors of 64 numbers:</p>
<ul>
<li>a <dfn data-def="The vector a token uses to ask: what am I looking for? It is matched against the keys of the other tokens.">query</dfn> <strong class="tf-q">q</strong>: what this token is looking for;</li>
<li>a <dfn data-def="The vector a token shows to the others: what do I contain? Queries are compared with it.">key</dfn> <strong class="tf-k">k</strong>: what this token offers, to be matched against queries;</li>
<li>a <dfn data-def="The vector a token hands over when another token attends to it.">value</dfn> <strong class="tf-v">v</strong>: what this token passes on to whoever attends to it.</li>
</ul>
<p>The stage shows the real 64 numbers of each, as bars. The query of <strong>it</strong> is on top; every token has a key and a value. Click another token, or use the slider, to make it the one asking.</p>`,
			notes: `<p>“Multiplied by a matrix” is a <a href="../linear-transformations/">linear transformation</a>: q = x W<sub>Q</sub> + b<sub>Q</sub>, where x is the token's current 768-number vector (normalised first by a LayerNorm, which rescales it to mean 0 and spread 1). Like the weights of the <a href="../neural-networks/">neural networks</a> page, W<sub>Q</sub>, W<sub>K</sub> and W<sub>V</sub> were set by gradient descent during training, here to make GPT-2 good at predicting the next token of web text.</p>`
		},
		{
			id: 'scores',
			chapter: 'operation',
			title: 'Match the query against every key',
			scene: 'attention',
			hints: { phase: 'scores' },
			duration: 26,
			controls: [query],
			body: `
<p>The query is compared with each key by a dot product, the same multiply-and-add as on the embeddings page, and divided by √64 = 8. The result is a <strong>score</strong>: large when query and key point the same way.</p>
<p>For <strong>it</strong>, the key of <strong>animal</strong> scores 1.06. Everything else scores below −2, most of it far below. Nothing tells the head to look for the noun: it is a pattern its three matrices learned.</p>
<p>The tokens after <strong>it</strong> get no score at all. GPT-2 learns by predicting each next token, so a token may only look back, never ahead; the later tokens are <dfn data-def="Hidden from the attention by setting their scores to minus infinity before the softmax, so their weights are exactly 0. GPT-2 masks every token that comes later in the text.">masked</dfn>. That is why the model, at <em>it</em>, has not yet seen “tired”.</p>`,
			notes: `<p><strong>Why divide by √d?</strong> The dot product of two vectors of 64 random numbers grows like √64. Without the division, scores in a big model would be so large that the softmax of the next step would give all the weight to one token and learning would stall. Dividing by √d keeps the scores of order 1.</p>
<p>Models that read a whole text at once rather than writing it, such as BERT, do not mask: there every token attends to all the others, before and after it.</p>`
		},
		{
			id: 'weights',
			chapter: 'operation',
			title: 'Softmax: scores become weights',
			scene: 'attention',
			hints: { phase: 'weights' },
			duration: 24,
			controls: [query],
			body: `
<p>A <dfn data-def="The function that turns a list of scores s into weights e^s / Σ e^s: all positive, adding up to 1, with the largest score getting the largest share.">softmax</dfn> turns the scores into weights: raise e to the power of each score and divide by the total. All weights are positive and they add up to 1.</p>
<p>The exponential exaggerates differences. <strong>animal</strong> leads the next score by 3.2, and e<sup>3.2</sup> ≈ 24, so it takes 0.92 of the attention. ⟨start⟩ gets 0.04 and the rest share the remaining 0.04. These are the model's own weights: recomputed here from its q and k, they agree with the stored ones to within 0.003.</p>
<p>Try other tokens: <strong>didn</strong>, <strong>cross</strong> and <strong>was</strong> also look at <strong>animal</strong>; <strong>The</strong> and <strong>street</strong> mostly at ⟨start⟩. This head picks out the subject from many places in the sentence, not only from the pronoun.</p>`
		},
		{
			id: 'mix',
			chapter: 'operation',
			title: 'Mix the values',
			scene: 'attention',
			hints: { phase: 'mix' },
			duration: 26,
			controls: [query],
			body: `
<p>Finally, each value is scaled by its weight and they are added up: 0.92 × v(animal) + 0.04 × v(⟨start⟩) + … The result is the head's output for <strong>it</strong>: 64 numbers, here pointing almost exactly the way of the value of <strong>animal</strong>.</p>
<p>Joined with the outputs of the layer's other heads, it is added back into the vector of <strong>it</strong>. From then on, the vector at the position of <em>it</em> carries information that came from <em>animal</em>, four tokens away, in a single operation. No word-by-word passing along the sentence was needed.</p>
<p>So the whole operation is: match queries with keys, softmax the scores, mix the values. Written for all tokens at once, with Q, K and V the matrices whose rows are the tokens' vectors and M the mask:</p>
<p class="formula">Attention(Q, K, V) = softmax(Q Kᵀ / √d + M) V</p>`,
			notes: `<p>In GPT-2 the outputs of all 12 heads of a layer (12 × 64 = 768 numbers) are put side by side and multiplied by one more learned 768 × 768 matrix, W<sub>O</sub>, before being added to the token's vector. That addition is the <dfn data-def="The connection that adds a layer's output to its input instead of replacing it, so that information can pass through many layers unchanged.">residual connection</dfn>: each layer adds to the token's vector rather than replacing it.</p>`
		},
		{
			id: 'matrix',
			chapter: 'operation',
			title: 'Every token at once',
			scene: 'attention',
			hints: { phase: 'matrix' },
			duration: 24,
			controls: [query],
			body: `
<p>Every token does the same thing at the same time, each with its own query. Stack the weights row by row and you get the head's <dfn data-def="The table of attention weights of one head: one row per token doing the looking, one column per token looked at. Each row adds up to 1.">attention pattern</dfn>: one row for each token asking, one column for each token looked at. The row of <strong>it</strong> is the one you just computed.</p>
<p>Everything above the diagonal is empty: the mask. The column on the left is ⟨start⟩, and it is often bright: when a head has nothing useful to look at, it parks its attention on the first token (more on that soon).</p>
<p>Because the whole table is one matrix product, Q Kᵀ, a computer can do it for every token in parallel. That, more than anything, is why transformers replaced older networks that read a sentence one word after another.</p>`
		},
		// ------------------------------------------------------------------ heads
		{
			id: 'heads',
			chapter: 'heads',
			title: 'Twelve heads look for different things',
			scene: 'heads',
			hints: { phase: 'heads' },
			duration: 26,
			controls: [sentence(), layer],
			body: `
<p>One head can only look for one kind of thing. So each layer of GPT-2 has 12 heads side by side, each with its own query, key and value matrices, all working on the same tokens at once: <dfn data-def="Several attention operations run in parallel on the same tokens, each with its own learned matrices; their outputs are joined and mixed by one more matrix.">multi-head attention</dfn>. Here are the 12 patterns of one layer.</p>
<p>They differ. In layer 5, head 12 is a sharp line just below the diagonal: every token looks at the token right before it. Head 4 is the subject-finder of the last steps. Many others are a bright first column: they rest on ⟨start⟩. Across all 144 heads, about 60% of all attention goes to that one token.</p>
<p>Move through the layers. Leaving ⟨start⟩ aside, attention in the first five layers lands on average 2 to 3 tokens back, in the last three about 4: the later layers reach further.</p>`,
			notes: `<p>Why so much attention on ⟨start⟩? The weights must add up to 1, so a head that finds nothing relevant has to put them somewhere. GPT-2 learned to put them on the first token, whose value adds almost nothing to the output: an “attention sink” (Xiao and colleagues, 2023). Keep this in mind when reading the patterns: a bright first column means “nothing here”, not “the start matters”.</p>`
		},
		{
			id: 'explore',
			chapter: 'heads',
			title: 'Explore all 144 heads',
			scene: 'explore',
			hints: { phase: 'explore' },
			duration: 30,
			controls: [sentence(), layer, head, token],
			body: `
<p>Point at a token (or tap it, or Tab to it) to see which earlier tokens it attends to in the chosen layer and head: the thicker the line, the larger the weight. The grid on the right shows the same token in all 144 heads at once, each cell a tiny bar chart of its weights; click a cell to pick that layer and head.</p>
<p>Try the sentence <strong>fox</strong> (“the quick brown fox …” twice) at the second <em>fox</em>, or <strong>Mary</strong> at the last <em>to</em>, and look for the cells that light up away from ⟨start⟩.</p>
<p>The sentences are fixed. Typing your own would mean running GPT-2 in your browser, and downloading its 550 MB of weights; instead, these eight were run through it when the page was made.</p>`,
			notes: `<p>Attention weights show where a head looks, not what the model does with what it finds. A head can attend strongly to a token whose value it then mostly ignores, and the same information can arrive by other paths. Researchers who want to know what a head is for switch it off or swap its output and watch what changes in the prediction.</p>`
		},
		{
			id: 'patterns',
			chapter: 'heads',
			title: 'Heads with a job',
			scene: 'explore',
			hints: { phase: 'patterns' },
			duration: 30,
			controls: [pattern],
			body: `
<p>Some heads of GPT-2 small do one job so consistently that researchers have named them. Pick one:</p>
<ul>
<li><strong>Previous token</strong> (layer 5, head 12): every token looks at the one before it, with a weight near 1.</li>
<li><strong>The noun</strong> (layer 5, head 4): <em>are</em> looks at <em>keys</em> (0.85), not at the nearer <em>cabinet</em>; the verb has to agree with the keys.</li>
<li><strong>Induction</strong> (layer 6, head 6): the second <em>fox</em> looks at <em>jumps</em> (0.96), the token that came after the first <em>fox</em>. This head finds “what came next last time”, and GPT-2 then predicts <em>over</em> with 98% confidence.</li>
<li><strong>Name mover</strong> (layer 10, head 10): at the final <em>to</em> it looks at <em>Mary</em> (0.67), the name that has not yet been given anything, and GPT-2 predicts <em>Mary</em> with 68%.</li>
<li><strong>Resting</strong> (layer 6, head 2, on the animal sentence): 0.98 of the attention of <em>it</em> goes to ⟨start⟩. On the fox sentence the same head is an induction head (0.80 from the second <em>fox</em> to <em>jumps</em>): it rests until there is something to copy.</li>
</ul>`,
			notes: `<p>The induction head works together with a previous-token head in an earlier layer: that head copies “the token before me was <em>fox</em>” into the vector of <em>jumps</em>, so that the induction head's query, at the second <em>fox</em>, can match it (Olsson and colleagues, “In-context learning and induction heads”, 2022). The name movers belong to a circuit of about 26 heads that GPT-2 small uses to complete such sentences (Wang and colleagues, “Interpretability in the wild”, 2022). Both papers count layers and heads from 0: our layer 6, head 6 is their head 5.5.</p>`
		},
		// ------------------------------------------------------------------ stack
		{
			id: 'stack',
			chapter: 'stack',
			title: 'A transformer is attention, stacked',
			scene: 'stack',
			hints: { phase: 'stack' },
			duration: 28,
			controls: [sentence('stackS', 'capital')],
			body: `
<p>A layer of GPT-2, a <dfn data-def="One layer of a transformer: an attention step (tokens exchange information) followed by an MLP (each token processed on its own), each added back to the token's vector.">transformer block</dfn>, is two parts. First the 12 attention heads, where the tokens exchange information. Then a small <a href="../neural-networks/">neural network</a> (an MLP, 768 → 3,072 → 768 neurons) that works on each token's vector on its own. Both add their result to the token's vector.</p>
<p>GPT-2 small stacks 12 such blocks. Each token's vector flows up through all of them, picking up a little more context at every layer. At the top, the vector of the last token is compared with all 50,257 token embeddings to give a probability for each possible next token: for “… Rome is the capital of”, GPT-2 says <em>Italy</em> (35%).</p>
<p>All of it is 124,439,808 learned numbers: 38.6 million in the token embeddings, 0.8 million in the positions, and 7.1 million in each block, of which 2.4 million are attention.</p>`,
			notes: `<p>Bigger language models are the same design with more of everything: GPT-3 has 96 blocks of 96 heads and 12,288 numbers per token. How such a model turns next-token probabilities into text is the subject of the topic on large language models.</p>`
		},
		{
			id: 'summary',
			chapter: 'stack',
			title: 'Attention, stacked many times',
			scene: 'explore',
			hints: { phase: 'summary' },
			duration: 24,
			controls: [sentence('sumS', 'mary')],
			body: `
<p>Attention lets every token gather information from every earlier token in one step:</p>
<ul>
<li>its <strong>query</strong> is matched against every <strong>key</strong>, the scores are scaled by √d and turned into weights by a softmax, and the <strong>values</strong> are mixed with those weights;</li>
<li>the matrices that make q, k and v are learned, so training decides what is relevant;</li>
<li>position embeddings tell it where each token stands;</li>
<li>a transformer runs many heads side by side and stacks the whole thing many times: 144 heads in GPT-2 small.</li>
</ul>
<p>The grid shows the last token of the sentence in all 144 heads: each head of each layer finds its own earlier tokens to listen to.</p>`
		}
	]
};
