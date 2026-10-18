import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { TRAIN } from './position';

/** The position slider's range in the sinusoid chapter. */
export const MAX_POS = 127;
/** The longest text of the last step. */
export const MAX_LEN = 1024;
/** The longest distance between the query and the key. */
export const MAX_DIST = 40;

const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
/** The key's position and the distance query − key, kept inside the trained positions. */
export const distOf = (p: Params) => Math.max(0, Math.min(MAX_DIST, Math.round(n(p.dist, 5))));
export const atOf = (p: Params) =>
	Math.max(0, Math.min(TRAIN - 1 - distOf(p), Math.round(n(p.at, 10))));

const shuffle: Control = {
	type: 'action',
	id: 'shuffle',
	label: 'Order of the words',
	action: 'Shuffle the words',
	help: 'The first press swaps dog and man; later presses shuffle at random.'
};

const mask: Control = {
	type: 'toggle',
	id: 'mask',
	label: 'Causal mask (each word sees only itself and the words before it)',
	default: true
};

const pos: Control = {
	type: 'range',
	id: 'pos',
	label: 'Position',
	min: 0,
	max: MAX_POS,
	step: 1,
	default: 10,
	disabled: (p) => p.play === true
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Count the positions up',
	default: false,
	help: 'Moves along the text, two positions a second; the slider follows.'
};

const offset: Control = {
	type: 'range',
	id: 'k',
	label: 'Offset k',
	min: 0,
	max: 40,
	step: 1,
	default: 5,
	format: (v) => `${Math.round(v)} positions on`
};

const at: Control = {
	type: 'range',
	id: 'at',
	label: 'Where the pair stands (the key’s position)',
	min: 0,
	max: TRAIN - 1,
	bounds: (p) => [0, TRAIN - 1 - distOf(p)],
	step: 1,
	default: 10,
	help: 'Drag the key token on the stage to move both tokens together.'
};

const dist: Control = {
	type: 'range',
	id: 'dist',
	label: 'Distance, query − key',
	min: 0,
	max: MAX_DIST,
	bounds: (p) => [0, Math.min(MAX_DIST, TRAIN - 1 - Math.round(n(p.at, 10)))],
	step: 1,
	default: 5,
	help: 'Drag the query token on the stage to change it.'
};

const len: Control = {
	type: 'range',
	id: 'len',
	label: 'Text length',
	min: TRAIN,
	max: MAX_LEN,
	step: 1,
	default: 256,
	format: (v) => `${Math.round(v)} positions`
};

const EQUIVARIANT = `<dfn data-def="A function of a list is permutation-equivariant if shuffling its input shuffles its output in the same way and changes nothing else. Attention without a mask is: each output depends on its own token and on the set of all tokens, not on their order.">permutation-equivariant</dfn>`;
const LINEAR = `<dfn data-def="A map M with M(a + b) = M(a) + M(b) and M(c·a) = c·M(a): it can be written as a matrix. A rotation is one.">linear map</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'positional-encoding',
	title: 'Position in a transformer: sinusoids & RoPE',
	summary:
		'Shuffle a sentence and watch attention fail to notice, then give each position a set of clock hands turning at different speeds: added to the embedding as sinusoids, or turning the queries and keys themselves, as in RoPE, so that an attention score depends only on how far apart two tokens are.',
	chapters: [
		{ id: 'order', title: 'Attention cannot see order' },
		{ id: 'sinusoids', title: 'Sinusoids, added' },
		{ id: 'rope', title: 'RoPE: rotate the query and the key' }
	],
	steps: [
		// ------------------------------------------------------------------ order
		{
			id: 'shuffle',
			chapter: 'order',
			title: 'Shuffle the words, nothing changes',
			scene: 'shuffle',
			hints: { mask: false },
			duration: 26,
			controls: [shuffle],
			body: `
<p>The <a href="../transformers/">transformers</a> page showed GPT-2's learned position vectors: one per position, set by training. This page is about two schemes that are designed instead, and about the algebra that makes them work. First, why a transformer needs one at all.</p>
<p>An attention head turns each token into a query, a key and a value, and gives each token the average of all the values, weighted by softmax(q·k / √d). Nothing in that formula says where a token stands. The stage runs one head over “the dog bit the man”, without a mask, so every word sees every word. Below each word, the six bars are its output.</p>
<p>Shuffle the words. Every output is exactly the same as before, only moved along with its word: <em>dog</em> gets the same vector in “the man bit the dog”. Attention is ${EQUIVARIANT}: on its own it treats a sentence as a bag of words.</p>`,
			notes: `<p>The vectors here are a toy: six numbers per word and one head's three weight matrices, drawn at random once from a fixed seed. Nothing depends on them: for any vectors and any weights, the softmax of a shuffled list of scores is the same shuffle of the softmax, and so is the weighted average. The two <em>the</em> are the same word, so they get the same vector and the same output.</p>`
		},
		{
			id: 'mask',
			chapter: 'order',
			title: 'A causal mask leaks some order',
			scene: 'shuffle',
			hints: { mask: true },
			duration: 26,
			controls: [shuffle, mask],
			body: `
<p>A language model writes left to right, so each token may only attend to itself and the tokens before it: the <dfn data-def="Scores for tokens after the current one are set to minus infinity before the softmax, so they get weight 0.">causal mask</dfn>. Now order is not entirely invisible. In “the dog bit the man”, <em>dog</em> sees two words; in “the man bit the dog” it sees all five, and its output changes.</p>
<p>But what the mask reveals is only which words came before, not in what order. The last word sees the whole sentence, so its output is the same in every order the stage tries; a word whose set of predecessors is unchanged keeps its output too. “Dog bites man” and “man bites dog” would still be the same story to a word that comes after both.</p>
<p>So a transformer adds position explicitly. Switch the mask off to go back to the bag of words.</p>`,
			notes: `<p>That leak is enough for something: Haviv and colleagues (2022) trained causal language models with no position information at all and found that they still learned where tokens stand, roughly, and reached perplexities close to those of models that had it. Without the mask (an encoder, such as BERT) there is no such leak.</p>`
		},
		// ------------------------------------------------------------------ sinusoids
		{
			id: 'clocks',
			chapter: 'sinusoids',
			title: 'Clock hands at different speeds',
			scene: 'clocks',
			hints: { phase: 'clocks' },
			duration: 30,
			controls: [pos, play],
			body: `
<p>The original transformer (Vaswani and colleagues, 2017) gives each position a fixed vector of d numbers and adds it to the token's embedding before the first layer. The numbers come in pairs. Pair i holds sin(pos·ω<sub>i</sub>) and cos(pos·ω<sub>i</sub>): a point on the <a href="../unit-circle/">unit circle</a> at the angle pos·ω<sub>i</sub>, a clock hand that turns by ω<sub>i</sub> radians from one position to the next.</p>
<p>The speeds are ω<sub>i</sub> = 10000<sup>−2i/d</sup>, a geometric sequence. The stage shows d = 16, eight pairs: the first hand turns 1 radian per position, a full turn every 6.3 positions; each next one is √10 ≈ 3.16 times slower, down to one turn every 19,869 positions. To the right of each hand, its sine over the positions 0 to 127.</p>
<p>Drag the position. From 10 to 11 the first hand moves 57°, the last 0.02°: fast hands tell neighbours apart. But fast hands come round again: at 0 and 44 the first hand points within about 1° of the same direction, while the fifth differs by 25°. Slow hands tell far positions apart. Together, no two positions in a text share all eight angles.</p>`,
			notes: `<p>The paper used d = 512, so 256 pairs, with wavelengths from 2π to 10000·2π positions; with fewer dimensions the same range is covered in fewer, bigger steps (here the slowest wavelength is 10000<sup>14/16</sup>·2π). The paper writes the sine in the even dimensions and the cosine in the odd ones, as here; some code puts all the sines first. Like the binary digits of a counter, which flip faster or slower by powers of two, the pairs read a position at several scales at once.</p>`
		},
		{
			id: 'offset',
			chapter: 'sinusoids',
			title: 'A fixed offset is a rotation',
			scene: 'clocks',
			hints: { phase: 'offset' },
			duration: 30,
			controls: [pos, offset],
			body: `
<p>Why sines and cosines? Moving k positions on turns every hand by k·ω<sub>i</sub>, wherever it starts. Turning is a ${LINEAR}: the encoding of pos + k is a matrix times the encoding of pos, PE(pos + k) = R(k)·PE(pos), where R(k) turns pair i by k·ω<sub>i</sub>. That matrix is built from k alone.</p>
<p>The stage shows both positions: the solid hands at pos, the hollow ones at pos + k, and the arc each hand turns. Drag the position: every arc keeps its angle. The same holds for the dot product of two encodings, PE(m)·PE(n) = Σ cos((m − n)·ω<sub>i</sub>), which depends only on the distance m − n.</p>
<p>Vaswani and colleagues hoped this would let the model learn to attend by relative position. But the encoding is <em>added</em> to the token's embedding, x + PE(pos), and then multiplied by the query and key weights. The score then contains terms that mix one token's content with the other's position, and those depend on where the tokens stand, not only on their distance. The next chapter measures that.</p>`,
			notes: `<p>Written out, with q = W<sub>q</sub>(x<sub>m</sub> + p<sub>m</sub>) and k = W<sub>k</sub>(x<sub>n</sub> + p<sub>n</sub>), the score q·k has four parts: content with content, content with position (twice) and position with position. Even the last one, p<sub>m</sub>ᵀW<sub>q</sub>ᵀW<sub>k</sub>p<sub>n</sub>, depends only on m − n only for weights that do not mix the pairs. In their experiments, learned position vectors gave nearly the same results as the sinusoids; the sinusoids need no training and give a vector for any position.</p>`
		},
		// ------------------------------------------------------------------ rope
		{
			id: 'rotate',
			chapter: 'rope',
			title: 'Turn the query and the key',
			scene: 'rope',
			hints: { phase: 'rotate' },
			duration: 30,
			controls: [at, dist],
			body: `
<p>Rotary position embedding, RoPE (Su and colleagues, 2021), puts the clock hands somewhere else. Nothing is added to the embedding. Instead, in every attention layer, once a token's query and key have been computed, each pair of their dimensions is turned: by m·θ<sub>i</sub> for a token at position m, with the same speeds θ<sub>i</sub> = 10000<sup>−2i/d</sup>. The values are not turned.</p>
<p>The stage shows one query token and one key token, 16 dimensions, eight pairs. In each dial, the query's pair (orange) is turned by m·θ<sub>i</sub> and the key's pair (blue) by n·θ<sub>i</sub>; the faint arrows are where they were before turning. A pair's share of the score is the dot product of the two arrows: their lengths times the cosine of the angle between them. The bars add up the eight shares.</p>
<p>Turning both arrows of a pair by the same amount leaves the angle between them alone. So only the difference counts: the angle between them grows by (m − n)·θ<sub>i</sub>, the turn of the distance.</p>`,
			notes: `<p>The query and key here are a toy, the weights times two token vectors drawn at random from a fixed seed; the score is q·k/√16, as on the transformers page. The RoFormer paper pairs neighbouring dimensions (2i, 2i + 1), as here; many implementations, including Llama's, pair dimension i with i + d/2 instead. That only reorders the dimensions, and everything on this page holds either way.</p>`
		},
		{
			id: 'relative',
			chapter: 'rope',
			title: 'The score depends only on the distance',
			scene: 'rope',
			hints: { phase: 'relative' },
			duration: 32,
			controls: [at, dist],
			body: `
<p>Drag the key token: both tokens move along the text together, five positions apart. All the arrows turn, but the angle between each query and key pair does not, and the RoPE score stays 1.57 wherever the pair stands. In the formula, (R(m)q)·(R(n)k) = q·R(n − m)k: the rotations meet in the middle and only the distance is left.</p>
<p>The chart compares the same two tokens, same weights, with the sinusoids of the last chapter added to their embeddings instead. That score drifts as the pair moves, from −1.76 to 1.31 at the same distance of five, because of the terms that mix content and position.</p>
<p>Drag the query token to change the distance, and the RoPE score changes: the model can still tell a neighbour from a word far back, and how much attention each distance gets is up to the learned queries and keys. That is the takeaway: turning each query and key by an angle proportional to its position makes their score depend on how far apart the two tokens are, not on where they stand.</p>`,
			notes: `<p>The identity holds to rounding: the page's tests move pairs of tokens by up to 100,000 positions and the score changes by less than 10<sup>−9</sup>. RoPE is used in GPT-J, GPT-NeoX, PaLM, Llama and many later models. Su and colleagues also show a bound on the score that tends to fall as the distance grows, with these frequencies.</p>`
		},
		{
			id: 'beyond',
			chapter: 'rope',
			title: 'Past the training length',
			scene: 'clocks',
			hints: { phase: 'beyond' },
			duration: 30,
			controls: [len],
			body: `
<p>Suppose the model was trained on texts of 64 tokens, positions 0 to 63. During training each hand swept the arc shaded on its dial. The fast hands went round many times and met every angle. The slow ones did not: the fifth turned 36°, the eighth just over 1°. Five of the eight pairs never completed a turn.</p>
<p>Make the text longer. Past position 63 the slow hands move into angles that never occurred in training (red). For RoPE the same goes for distances: a query and key more than 63 positions apart meet at relative angles the weights were never trained on. “Depends only on the distance” is a fact about one score; it says nothing about how the rest of the network copes with distances it never saw.</p>
<p>In practice, models trained with RoPE degrade past their training length unless they are adapted. In a real head of 128 dimensions with base 10,000, trained on 4,096 tokens (the sizes of Llama 2), 18 of the 64 pairs never complete a turn.</p>`,
			notes: `<p>Ways to extend a RoPE model's context work on these angles. Position interpolation (Chen and colleagues, 2023) divides the positions so a longer text stays inside the trained angles, then fine-tunes briefly; others raise the base so the slow hands turn even more slowly (Code Llama uses 1,000,000, Llama 3 500,000), again with training on longer texts. The sinusoids of the first chapter meet the same problem, as do learned position vectors, which have no vector at all past the last trained position.</p>`
		}
	]
};
