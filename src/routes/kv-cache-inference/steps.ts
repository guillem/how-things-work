import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { GPUS, MODELS } from './specs';

const rewrite: Control = {
	type: 'action',
	id: 'seed',
	label: 'Draw other random numbers for the characters',
	action: 'Write another'
};

const model: Control = {
	type: 'select',
	id: 'model',
	label: 'Model',
	default: 'llama2-7b',
	options: MODELS.map((m) => ({
		value: m.id,
		label: `${m.name} (${m.kvHeads} KV heads)`
	}))
};

const gpu: Control = {
	type: 'select',
	id: 'gpu',
	label: 'GPU',
	default: 'h100',
	options: GPUS.map((g) => ({ value: g.id, label: g.name.replace('NVIDIA ', '') }))
};

const tokens = (v: number) => (2 ** v).toLocaleString('en-US');

/** Context length on a log scale: the slider holds log₂ of the tokens. */
const context = (label = 'Context length'): Control => ({
	type: 'range',
	id: 'context',
	label,
	min: 6,
	max: 12,
	step: 1,
	default: 10,
	format: (v) => `${tokens(v)} tokens`
});

/** Batch size on a log scale: the slider holds log₂ of the sequences. */
const batch: Control = {
	type: 'range',
	id: 'batch',
	label: 'Batch (conversations served together)',
	min: 0,
	max: 10,
	step: 1,
	default: 0,
	format: tokens
};

const KV = `<dfn data-def="In each attention layer every token is turned into a query (what it is looking for), a key (what it offers to be found by) and a value (what it passes on when found). See the transformers page.">keys and values</dfn>`;
const CAUSAL = `<dfn data-def="Each position may only look at itself and earlier positions, never later ones: the model is trained to predict what comes next, so it must not see it.">causal</dfn>`;
const FLOP = `<dfn data-def="Floating-point operation: one addition or one multiplication of two real numbers. A multiply-add counts as 2.">FLOP</dfn>`;
const BF16 = `<dfn data-def="Brain floating point: a 16-bit number format (2 bytes) with float32's range and less precision. Models are usually served in BF16 or FP16, 2 bytes per weight.">BF16</dfn>`;
const HBM = `<dfn data-def="High-bandwidth memory: the GPU's main memory, stacked beside the chip. The H100 SXM has 80 GB of it, read at up to 3.35 terabytes a second, about 20 times slower per operation than its arithmetic.">HBM</dfn>`;
const RIDGE = `<dfn data-def="The operations per byte at which the time spent waiting for memory equals the time spent computing: peak FLOP/s ÷ bandwidth. Below it a job is memory-bound, above it compute-bound.">ridge point</dfn>`;
const GQA = `<dfn data-def="Grouped-query attention (Ainslie et al. 2023): the attention heads are split into groups, and each group shares one key head and one value head. Multi-query attention is the extreme case of one shared pair.">grouped-query attention</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'kv-cache-inference',
	title: 'Serving a language model: the KV cache',
	summary:
		'Generate text with a tiny transformer, first recomputing every earlier character and then keeping each layer’s keys and values, and count the arithmetic and the bytes; then put Llama 2 7B and Mistral 7B on an H100’s roofline to see why the prompt is compute-bound, each new token memory-bound, and batching what makes serving cheap.',
	chapters: [
		{ id: 'write', title: 'One token at a time' },
		{ id: 'memory', title: 'The cache in memory' },
		{ id: 'roofline', title: 'Where the time goes' }
	],
	steps: [
		// ------------------------------------------------------------------ write
		{
			id: 'one-at-a-time',
			chapter: 'write',
			title: 'A model writes one token at a time',
			scene: 'generate',
			hints: { mode: 'recompute' },
			duration: 30,
			controls: [rewrite],
			body: `
<p>A <a href="../transformers/">transformer</a> language model produces text one token at a time: it reads everything written so far, gives a probability to every possible next token, one is drawn, it is added to the text, and the model runs again. Here the model is the tiny GPT of <a href="../training-a-tiny-language-model/">training a tiny language model</a>: 2 layers, 4 heads, 32 numbers wide, trained on Shakespeare, reading up to 64 characters. It is writing after the prompt “ROMEO:”.</p>
<p>The simplest way to run it is the way it was trained: give it the whole window every time. To write the 8th character it runs 7 positions through both layers; to write the 65th, all 64, although 63 of them were already run for the 64th. The bars count the arithmetic (in ${FLOP}s, counted inside the model's loops as it runs) for each new character: they grow with the text, from 380 thousand to 3.9 million.</p>`,
			notes: `<p>Counted: the multiply-adds of every matrix product and of attention, each 2 FLOPs (layer norms, the softmax and GELU add a few percent and are left out). The model on this page is a run of the training page's own code (3,000 steps on all of Tiny Shakespeare, a held-out loss of 1.94 nats per character), with its weights stored as float32. Its positions are learnt, one vector per position from 0 to 63, so a window of 64 cannot slide along without recomputing everything: generation here stops when the window is full.</p>`
		},
		{
			id: 'keep',
			chapter: 'write',
			title: 'Earlier keys and values never change: keep them',
			scene: 'generate',
			hints: { mode: 'cache' },
			duration: 30,
			controls: [rewrite],
			body: `
<p>Attention is ${CAUSAL}: a position only looks back. So when a new character arrives, nothing about the earlier positions changes: their ${KV}, in every layer, are exactly what they were one step ago. Only the new position needs computing: its query is compared with all the stored keys, and it mixes the stored values.</p>
<p>A <strong>KV cache</strong> keeps them. Each step runs one position through the model, adds its key and value in each layer to the cache (the grid filling up), and reads the rest. The arithmetic per character now hardly grows: 55 thousand FLOPs at the start, 70 thousand at the end, the growth being attention over a longer cache. Over the 58 characters, recomputing does 34 times the arithmetic.</p>`,
			notes: `<p>Queries are not kept: a query is only needed by its own position, once. Nor is anything after attention: the MLP and the read-out work on one position at a time. The cache is the only memory a transformer has of the text between steps, which is why it is also called the model's state; a recurrent network keeps a fixed-size state instead, and the cache grows by one entry per token per layer.</p>`
		},
		{
			id: 'same',
			chapter: 'write',
			title: 'The cache changes nothing in the output',
			scene: 'generate',
			hints: { mode: 'compare' },
			duration: 26,
			controls: [rewrite],
			body: `
<p>The cache is not an approximation. The page has just run the same generation twice, in your browser: once with the training page's model, recomputing the whole window for every character, and once with the cache. The two texts are the same character for character, and the largest difference between their probabilities, over every character and every one of the 65 possible next characters, is shown under them: zero, to the last bit of a 64-bit number, since both do the same arithmetic in the same order.</p>
<p>What the cache saves is arithmetic, not memory traffic. Each step still reads every weight it multiplies by (27,617 numbers here, 8 bytes each), and now also the cache, which grows with the text: by the end of the window it is 64 kB beside 221 kB of weights. In a real model this is the part that matters.</p>`,
			notes: `<p>Bit-for-bit equality depends on doing the sums in the same order. Real serving systems compute a batch of positions with different matrix kernels than one position at a time, and floating-point addition is not associative, so their cached and uncached outputs can differ in the last digits, and very occasionally pick a different token. Mathematically the two are the same function.</p>`
		},
		// ------------------------------------------------------------------ memory
		{
			id: 'cache-size',
			chapter: 'memory',
			title: 'How big the cache gets',
			scene: 'memory',
			hints: { focus: 'size' },
			duration: 34,
			controls: [model, context(), batch, gpu],
			body: `
<p>Scale up to a published model: Llama 2 7B (Meta, 2023), 32 layers, 32 heads of 128 numbers (4,096 wide), 6.74 billion weights. Served in ${BF16}, 2 bytes a number, the weights take 13.5 GB.</p>
<p>Its cache keeps, for every token, a key and a value in every layer and every head: 2 × 32 layers × 32 heads × 128 × 2 bytes = 512 KiB per token. A full 4,096-token context is 2.1 GB (2 GiB); a server holding 8 such conversations keeps 17 GB of cache, more than the weights. Drag the context and the batch: the cache grows with both, and the GPU's memory (80 GB on an H100, 24 GB on an RTX 4090) sets how many conversations can be served at once: 30 full ones on an H100.</p>`,
			notes: `<p>The shapes are from the models' published config.json files, and they add up exactly to the published weight counts. Real servers also need room for activations and allocate the cache in blocks (vLLM's PagedAttention, Kwon et al. 2023, which quotes 800 KB per token for OPT-13B); the page counts the weights and the cache only.</p>`
		},
		{
			id: 'gqa',
			chapter: 'memory',
			title: 'Sharing keys and values between heads',
			scene: 'memory',
			hints: { focus: 'gqa' },
			duration: 30,
			controls: [model, context(), batch],
			body: `
<p>The cache is so large that newer models shrink it by design. Mistral 7B (Mistral AI, 2023) has the same 32 layers and 32 query heads, but uses ${GQA}: the 32 heads form 8 groups of 4, and each group shares one key head and one value head. Its cache is 2 × 32 × 8 × 128 × 2 bytes = 128 KiB per token, a quarter of Llama 2 7B's, for a model of about the same size.</p>
<p>Switch the model: at 4,096 tokens, an H100 now fits 122 conversations instead of 30. The quality cost is small: the heads still ask different questions (queries), they just look them up in shared keys and values.</p>`,
			notes: `<p>Llama 2 used grouped-query attention only in its 34B and 70B models (Touvron et al. 2023); Llama 3 uses it at every size. The parameters saved are few (Mistral spends them on a wider MLP); the cache saved is large. Other ways to shrink it: storing keys and values in 8 bits, keeping only a recent window (Mistral's sliding window of 4,096 tokens), or compressing them into a smaller latent (DeepSeek's multi-head latent attention).</p>`
		},
		// ------------------------------------------------------------------ roofline
		{
			id: 'prefill',
			chapter: 'roofline',
			title: 'The prompt goes in all at once: compute-bound',
			scene: 'roofline',
			hints: { focus: 'prefill' },
			duration: 32,
			controls: [model, gpu, context('Prompt length')],
			body: `
<p>The <a href="../gpu/">GPU page</a>'s roofline says how fast a job can run: a GPU does at most its peak arithmetic (989 TFLOP/s dense BF16 on an H100 SXM) and reads at most its memory bandwidth (3.35 TB/s of ${HBM}). Which limit bites depends on the job's operations per byte: below the ${RIDGE}, 295 FLOPs per byte for the H100, the job waits for memory.</p>
<p>Serving starts with <strong>prefill</strong>: the whole prompt goes through the model in one pass, every position at once, filling the cache. Each weight read from memory is used once per prompt token, so a 1,024-token prompt does about 1,000 FLOPs per byte, far right of the ridge, on the compute roof: 13.7 ms for Llama 2 7B, some 75,000 tokens a second. Shorten the prompt and the dot slides left along the roof.</p>`,
			notes: `<p>FLOPs here: 2 per weight per token for the matrix products, plus attention over the earlier tokens (each of the 1,024 positions scores all the keys before it). Bytes: every weight but the embedding table, once, plus the keys and values written to the cache. The times are the roofline's bounds; good kernels reach perhaps 50–80% of them.</p>`
		},
		{
			id: 'decode',
			chapter: 'roofline',
			title: 'Each new token: memory-bound',
			scene: 'roofline',
			hints: { focus: 'decode' },
			duration: 34,
			controls: [model, gpu, context()],
			body: `
<p>Then <strong>decode</strong>: one new token per step, as in the first chapter. With the cache, the step does 2 FLOPs per weight, about 13.5 billion for Llama 2 7B, but it must still read every weight from memory, 13.2 GB, and the cache with them. That is about 1 FLOP per byte, far left of the ridge.</p>
<p>So the GPU waits. On an H100 the arithmetic of a token would take 0.014 ms; reading the weights takes 4 ms. That sets the ceiling of one conversation, about 250 tokens a second, and it is set by bandwidth: a GPU with twice the arithmetic and the same memory would write no faster. On the RTX 4090 (1,008 GB/s) it is 14 ms a token. Lengthen the context: the cache read grows and the step slows further.</p>`,
			notes: `<p>This is why decoding speed follows memory bandwidth, and why smaller numbers help: weights in 8 or 4 bits (quantization) are fewer bytes to read per token. Without the cache, each step would be a whole prefill of the context: nearly 4,000 times the arithmetic at 4,096 tokens, and compute-bound for the wrong reason.</p>`
		},
		{
			id: 'batch',
			chapter: 'roofline',
			title: 'Batching shares the weight reads',
			scene: 'roofline',
			hints: { focus: 'batch' },
			duration: 36,
			controls: [model, gpu, context(), batch],
			body: `
<p>The way out is to serve many conversations at once. In one decode step, the GPU reads each weight once and uses it for every sequence in the batch: 32 sequences do 32 times the arithmetic for almost the same weight traffic. At 512 tokens of context, a step of 32 takes 6.5 ms instead of 4.0, and writes 4,900 tokens a second instead of 250. That is what makes a served model cheap per token.</p>
<p>But the cache is not shared: each sequence reads its own. Drag the batch and watch the dot climb and then level off, and drag the context to see the level drop. For Llama 2 7B at 4,096 tokens, no batch gets past about 7 FLOPs per byte, and only 30 such sequences fit. Mistral 7B's smaller cache goes further; at 128 tokens, a batch of about 450 reaches the compute roof.</p>`,
			notes: `<p>Real servers batch continuously: sequences join and leave the batch at every step (Orca, Yu et al. 2022), and prefill chunks are mixed in with decode steps so the GPU always has both kinds of work. The level the dot tends to is (FLOPs per sequence) ÷ (cache bytes per sequence), since the weights' bytes are shared by an ever larger batch.</p>`
		},
		{
			id: 'two-speeds',
			chapter: 'roofline',
			title: 'Two speeds, not one',
			scene: 'roofline',
			hints: { focus: 'both' },
			duration: 30,
			controls: [model, gpu, context(), batch],
			body: `
<p>So a served model has two speeds. Reading the prompt is compute-bound and fast: tens of thousands of tokens a second, set by the GPU's arithmetic. Writing the answer is memory-bound: a few hundred tokens a second for one conversation, set by how fast the weights and the cache can be read, and thousands in total when many are batched. A single “tokens per second” hides which one it is.</p>
<p>The KV cache is what makes the second speed tolerable: without it every new token would cost a whole prefill. It does not change what the model writes, and it does not make decoding cheap by itself: the cache grows with the context and the batch, takes memory that limits the batch, and at long contexts reading it, not the weights, is most of the traffic.</p>`,
			notes: `<p>Speculative decoding exploits the slack in the other direction: since a decode step is memory-bound, checking several drafted tokens in one pass costs about as much as one, so a small model can propose and the large one verify (Leviathan et al. 2023).</p>`
		}
	]
};
