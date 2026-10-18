import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { SAMPLE_STEPS, STEPS } from './train';

const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

const ckpt: Control = {
	type: 'range',
	id: 'ckpt',
	label: 'Model after training step',
	min: 0,
	max: STEPS,
	step: 1,
	default: 0,
	values: () => SAMPLE_STEPS,
	format: (v) => (Math.round(v) === 0 ? '0 (random weights)' : fmt(v))
};

const pos: Control = {
	type: 'range',
	id: 'pos',
	label: 'Character',
	min: 1,
	max: 32,
	step: 1,
	default: 9,
	help: 'Or click a character on the stage.'
};

const at: Control = {
	type: 'range',
	id: 'at',
	label: 'Training step',
	min: 0,
	max: STEPS,
	step: 10,
	default: STEPS,
	format: fmt,
	// the scene sets `playing` while it plays the run (not under reduced motion)
	disabled: (p) => p.playing === true
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Play the run',
	default: true
};

const train: Control = {
	type: 'action',
	id: 'train',
	label: 'Train the default model here',
	action: 'Train from scratch'
};

const stop: Control = {
	type: 'action',
	id: 'stop',
	label: 'Stop it where it is',
	action: 'Stop',
	disabled: (p) => p.liveRunning !== true
};

const width: Control = {
	type: 'select',
	id: 'width',
	label: 'Width (numbers per character)',
	default: '32',
	options: [
		{ value: '16', label: '16 (9,249 weights)' },
		{ value: '32', label: '32 (30,721 weights)' },
		{ value: '64', label: '64 (110,529 weights)' }
	]
};

const context: Control = {
	type: 'select',
	id: 'context',
	label: 'Context (characters it can look back over)',
	default: '32',
	options: [
		{ value: '8', label: '8' },
		{ value: '32', label: '32' },
		{ value: '64', label: '64' }
	]
};

const DATA_OPTIONS = [
	{ value: '10k', label: '10,000 characters' },
	{ value: '100k', label: '100,000' },
	{ value: 'all', label: 'all 1,003,854' }
];
const data: Control = {
	type: 'select',
	id: 'data',
	label: 'Training text',
	default: 'all',
	options: DATA_OPTIONS,
	help: 'Every combination was trained when the page was made, by the same code.'
};
const odata: Control = {
	type: 'select',
	id: 'odata',
	label: 'Training text',
	default: '10k',
	options: DATA_OPTIONS
};

const TINY = `<dfn data-def="1,115,394 characters of speeches from Shakespeare’s plays, put together by Andrej Karpathy in 2015 to train small text models. The first 90% is used for training here, the last 10% (mostly The Taming of the Shrew) is held out.">Tiny Shakespeare</dfn>`;
const HELD_OUT = `<dfn data-def="Text kept aside while the model learns and used only to measure it, so the measurement shows how the model does on text it has never seen: here, the last tenth of Tiny Shakespeare.">held-out</dfn>`;
const CE = `<dfn data-def="The average, over many characters, of −ln p, where p is the probability the model gave to the character that really came next. Measured in nats per character (in bits if the logarithm is base 2).">cross-entropy</dfn>`;
const PPL = `<dfn data-def="e to the power of the cross-entropy (in nats): the number of equally likely choices that would be just as surprising on average. A uniform guess among 65 characters has perplexity 65.">perplexity</dfn>`;
const KN = `<dfn data-def="Kneser–Ney smoothing (1995; interpolated form as in Chen and Goodman, 1998): it takes a little probability from every count and hands it to shorter windows, weighted by how many different contexts each character follows, so a character never seen after a window still gets a probability above zero.">smoothed</dfn>`;
const ADAMW = `<dfn data-def="Adam with decoupled weight decay (Loshchilov and Hutter, 2019): gradient descent where each weight's step is scaled by running averages of its own gradient and squared gradient, plus a small pull of every matrix weight towards zero.">AdamW</dfn>`;
const BACKPROP = `<dfn data-def="Computing the gradient of the loss with respect to every weight by the chain rule, from the loss back through the layers to the input, reusing the numbers saved on the way up. It costs about twice a forward pass.">backpropagation</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'training-a-tiny-language-model',
	title: 'Training a tiny language model',
	summary:
		'Train a two-layer character-level transformer on Shakespeare, in the page or from stored runs made by the same code: watch the average surprise at the next character fall below the bigram and trigram lines, the samples turn from random letters into words and speeches, and, with too little text, the model start to memorise.',
	chapters: [
		{ id: 'task', title: 'One number to lower' },
		{ id: 'train', title: 'Training' },
		{ id: 'scale', title: 'Size, context and data' }
	],
	steps: [
		// ------------------------------------------------------------------ task
		{
			id: 'predict',
			chapter: 'task',
			title: 'A model that guesses the next character',
			scene: 'predict',
			hints: { phase: 'predict' },
			duration: 30,
			controls: [ckpt, pos],
			body: `
<p>The <a href="../ngram-text-models/">n-gram page</a> counted which character followed the last few in ${TINY}. This page trains a model to make the same guess: a small <a href="../transformers/">transformer</a> with two blocks and 30,721 weights, which reads up to 32 characters and gives each of the 65 characters of the text a probability of coming next.</p>
<p>The stage shows a ${HELD_OUT} line, one the model never trains on, read the way the model reads it: at each character, the probability the model had given it before seeing it, from the characters before it. Before training the weights are small random numbers, and every guess is close to 1/65, about 1.5%.</p>
<p>Move the slider to see the same model after 100 to 3,000 steps of training, and click a character to see its four best guesses there. After “BAPTISTA:” the trained model is sure a line break comes next: names of speakers end that way.</p>`,
			notes: `<p>Characters, not words or <a href="../tokenization/">tokens</a>, keep the vocabulary at 65 symbols (upper- and lower-case letters, punctuation, the space, the line break, and a stray 3, $ and &), so the read-out layer stays small. Real language models predict tokens of a few characters each, from a vocabulary of 50,000 or more; the training is the same.</p>`
		},
		{
			id: 'surprise',
			chapter: 'task',
			title: 'One number: the average surprise',
			scene: 'predict',
			hints: { phase: 'average' },
			duration: 30,
			controls: [ckpt, pos],
			body: `
<p>Score each guess by its surprise, −ln p, where p is the probability the model gave to the character that really came: 0 if it was certain and right, ln 65 = 4.17 nats for a uniform guess, more for a character it thought unlikely. The bars are the surprises along the line. Their mean is the line's ${CE}, in nats per character, and it is the one number training lowers, averaged over the training text instead of one line.</p>
<p>The ${PPL} is e to that mean: untrained it is 65, as if the model picked among 65 equally likely characters; trained, it is down to a handful. It is only comparable between models that cut text into the same symbols and are measured on the same text: a character's perplexity and a word's or a token's are in different units, since a token holds several characters.</p>`,
			notes: `<p>Divide nats by ln 2 = 0.693 to get bits: an average surprise of 1.9 nats is 2.7 bits per character, a figure that compression programs can be compared with. The <a href="../compression/">compression</a> page explains why the average surprise is a bound on the bits a coder needs.</p>`
		},
		// ------------------------------------------------------------------ train
		{
			id: 'loop',
			chapter: 'train',
			title: 'One step of gradient descent',
			scene: 'loop',
			duration: 30,
			body: `
<p>A training step takes 32 windows of 32 characters at random from the training part of the text (the first 90%). The windows go up the stack: each character becomes a vector of 32 numbers (its embedding plus one for its position), the two blocks mix in what came before it (attention looks only backwards), and the read-out turns each vector into 65 probabilities. Every position predicts the character after it, so one step makes 1,024 guesses, and the loss is their average surprise.</p>
<p>Then the step goes back down. ${BACKPROP} gives the gradient: for each of the 30,721 weights, how much the loss would change if that weight changed a little. ${ADAMW}, a refinement of <a href="../gradient-descent/">gradient descent</a>, moves every weight a little downhill. The page does this 3,000 times: 3.1 million guesses, about three passes over the training text.</p>`,
			notes: `<p>The model is nanoGPT's (Karpathy, 2022) shrunk from 10.7 million weights to 30,721: pre-layer-norm blocks, 4 attention heads of 8 numbers, an MLP 128 wide with a GELU, a final layer norm and a read-out of its own (not tied to the embedding), no dropout. AdamW's learning rate warms up over 100 steps to 0.006, then falls along a cosine to 0.0006; the gradient is clipped to length 1. The forward and backward passes are written out in TypeScript on this page, in 64-bit floats, and the page's tests check the backward pass against finite differences.</p>`
		},
		{
			id: 'curve',
			chapter: 'train',
			title: 'The loss curve',
			scene: 'curve',
			hints: { phase: 'curve' },
			duration: 32,
			controls: [at, play],
			body: `
<p>Every 100 steps the run measured its average surprise on fixed stretches of text: 8,192 characters of the training text (orange) and 8,192 held-out ones (blue). Both start at 4.17, the uniform guess. In the first hundred steps they fall fast, as the model learns how common each character is and which tends to follow which; then slower, as it starts to use the characters further back.</p>
<p>The dashed lines are what counting gets: ${KN} bigram and trigram models counted from the same training text and scored on the same held-out characters, 2.49 and 2.09 nats. The model passes the bigram at about step 150 and the trigram at about step 1,000, and ends at 1.93 nats, a perplexity of 6.9: on average, as unsure as a choice among seven characters. It is not the end of the road: a smoothed 5-gram scores 1.66 on the same characters, and nanoGPT's 10.7-million-weight character model reaches about 1.47 on this split.</p>`,
			notes: `<p>The orange and blue curves stay close here because the model has far fewer weights than the training text has characters, and it sees each stretch only about three times; the last chapter breaks that. The model's first characters in each window have little to go on (the first has none), which costs it a little against the n-grams, which always see their full window. The training loss of each batch is noisier than these curves, which are measured on the same stretches every time.</p>`
		},
		{
			id: 'samples',
			chapter: 'train',
			title: 'From random letters to speeches',
			scene: 'curve',
			hints: { phase: 'samples' },
			duration: 32,
			controls: [at, play],
			body: `
<p>At the dots, the model wrote a sample: starting after a blank line, each character drawn at random in proportion to the model's probabilities and fed back in. The random draws are the same each time; only the model changes.</p>
<p>Before training the sample is noise: capitals, punctuation and rare letters as often as common ones. By step 100 it is mostly lower-case letters and spaces, with a few short words (“the”, “yours”) among made-up ones. By step 200 the lines are short and some begin with a name in capitals and a colon. By step 1,000 many words are real ones, and the text is laid out like the plays: a speaker's name, a colon, a line break, lines of verse that start with a capital. By 3,000 it invents speakers such as “QUEEN MARD OF SI”. It never makes sense: the model has learned spelling and layout, not meaning.</p>
<p>This order (spelling, then words, then the layout of speeches) is typical of runs like this one, not a law: what comes first depends on what lowers the average surprise most at each stage.</p>`
		},
		{
			id: 'live',
			chapter: 'train',
			title: 'Train it yourself',
			scene: 'curve',
			hints: { phase: 'live' },
			duration: 40,
			controls: [train, stop],
			body: `
<p>Press the button and this tab trains the same model from scratch, off the main thread in a Web Worker, with the same code and the same seeds as the stored run, which is drawn faintly behind it. The read-out gives the time per step; on the laptop the page was made on it was about 50 ms, so the 3,000 steps and their measurements take about three minutes.</p>
<p>The new curve lands on the stored one: the run is deterministic, from the random starting weights to the order of the windows, and the read-out shows the largest gap so far. A browser with a different JavaScript engine may round some functions differently in the last digit, and then the two runs drift slightly apart without changing shape.</p>`,
			notes: `<p>Training in a browser tab is slow by the standards of real models: about 200 million multiplications and additions per step here, done by plain JavaScript on one core. Real training spreads trillions of times more arithmetic over thousands of graphics processors, but every step is this one: a batch forward, the average surprise, its gradient, an update.</p>`
		},
		// ------------------------------------------------------------------ scale
		{
			id: 'compare',
			chapter: 'scale',
			title: 'Wider, longer, more',
			scene: 'curve',
			hints: { phase: 'compare' },
			duration: 36,
			controls: [width, context, data],
			body: `
<p>The page trained every combination of three widths, three context lengths and three amounts of training text, 27 runs, with the same 3,000 steps of 1,024 characters each. The grey curve is the default run.</p>
<p>Wider ends lower: 16 numbers per character (9,249 weights) ends at 2.08 nats, 32 at 1.93, and 64 (110,529 weights) at 1.85. A longer context helps up to a point: with 8 characters the default width ends at 2.02, with 32 at 1.93, and with 64 at 1.94, no better; in 3,000 steps a model this small learns little that needs more than a few dozen characters. Less text hurts everything: on 100,000 characters the default model ends at 2.32. The dashed lines move too, since the n-grams are counted from the same text: their trigram scores 2.45.</p>`,
			notes: `<p>Each step guesses 1,024 characters whatever the context: 128 windows of 8, 32 of 32 or 16 of 64, so every run sees the same amount of text. Wider models cost more per step (the 64-wide one about three times the 32-wide one), so a fair comparison at a fixed budget of computation, which is how scaling laws are measured, would give it fewer steps.</p>`
		},
		{
			id: 'overfit',
			chapter: 'scale',
			title: 'Too little text: memorising',
			scene: 'curve',
			hints: { phase: 'overfit' },
			duration: 36,
			controls: [odata],
			body: `
<p>Now the model learns from the first 10,000 characters only, a few speeches of <i>Coriolanus</i>, for the same 3,000 steps: it reads each of them about 300 times. For a hundred steps both curves fall together. Then they split. The held-out loss is lowest at step 100, at 2.76, and climbs to 5.30, worse than a uniform guess, while the training loss keeps falling, to 0.62. The model is memorising the text instead of learning what text like it looks like: in its sample, the bold run is the longest stretch found word for word in those 10,000 characters. The 64-wide model, with more weights to memorise with, goes further: 0.27 on its training text, 6.57 on held-out text.</p>
<p>A training loss near zero is not success: the held-out curve is the one that measures the model. That is the takeaway of the page. Training a language model is gradient descent on one number, the average surprise at the next character; as it falls on text the model has never read, the samples go from random letters to spelling to words and the shape of a play.</p>`,
			notes: `<p>The usual remedies: more text, a smaller model, stopping at the lowest held-out loss, dropout (switching off random parts of the network during training) or stronger weight decay. Large language models are trained on so much text that they see most of it once or a few times, and their training and held-out curves stay together.</p>`
		}
	]
};
