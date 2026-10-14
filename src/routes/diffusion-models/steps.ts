import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { T } from './ddpm';

// ---- controls ------------------------------------------------------------------------------

/** "Run by itself": the scene plays the process; moving the slider of the step turns it off. */
const auto = (id: string): Control => ({
	type: 'toggle',
	id,
	label: 'Run by itself',
	default: true,
	help: 'Off: the slider below sets the moment shown. Moving the slider turns this off.'
});

const noiseStep = (id: string, def: number): Control => ({
	type: 'range',
	id,
	label: 'Noising step t',
	min: 0,
	max: T,
	step: 1,
	default: def,
	format: (v) => `${v} of ${T}`
});

const progress = (id: string): Control => ({
	type: 'range',
	id,
	label: 'Denoising progress',
	min: 0,
	max: 100,
	step: 1,
	default: 100,
	unit: '%',
	help: 'From pure noise (0%) to the finished sample (100%).'
});

const STEP_CHOICES = [1, 2, 5, 10, 20, 50, 100, 250, 1000];
const steps = (id: string, def: number): Control => ({
	type: 'select',
	id,
	label: 'Sampling steps',
	default: String(def),
	options: STEP_CHOICES.map((v) => ({
		value: String(v),
		label: v === T ? `${v} (every step, as trained)` : String(v)
	})),
	help: 'How many denoising steps the sampler takes from noise to data.'
});

const seed = (id: string): Control => ({
	type: 'range',
	id,
	label: 'Random seed',
	min: 1,
	max: 20,
	step: 1,
	default: 1,
	help: 'Picks the starting noise and the noise added at every step.'
});

const prompt2d = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Prompt',
	default: def,
	options: [
		{ value: 'none', label: 'none' },
		{ value: '0', label: '“upper moon”' },
		{ value: '1', label: '“lower moon”' }
	]
});

const guidance = (id: string, def: number): Control => ({
	type: 'range',
	id,
	label: 'Guidance scale s',
	min: 0,
	max: 7,
	step: 0.5,
	default: def,
	format: (v) => v.toFixed(1),
	help: '0: ignore the prompt. 1: follow it as trained. Above 1: exaggerate it.'
});

const digitPrompt = (id: string, def: number): Control => ({
	type: 'select',
	id,
	label: 'Prompt',
	default: String(def),
	options: Array.from({ length: 10 }, (_, d) => ({ value: String(d), label: `“${d}”` }))
});

const digitSeed = (id: string): Control => ({
	type: 'select',
	id,
	label: 'Random seed',
	default: '1',
	options: ['1', '2', '3'].map((v) => ({ value: v, label: v })),
	help: 'Three precomputed runs per digit, each from different noise.'
});

const realDigit: Control = {
	type: 'select',
	id: 'real',
	label: 'MNIST test digit',
	default: '0',
	options: [
		{ value: '0', label: 'a 2' },
		{ value: '1', label: 'a 7' },
		{ value: '2', label: 'a 5' }
	]
};

const guidedDigit: Control = {
	type: 'select',
	id: 'gdigit',
	label: 'Prompt',
	default: '4',
	options: [
		{ value: '4', label: '“4”' },
		{ value: '7', label: '“7”' }
	]
};

// ---- the narrative -------------------------------------------------------------------------

export const spec: ExplainerSpec = {
	slug: 'diffusion-models',
	title: 'Diffusion models',
	summary:
		'Dissolve a cloud of points, then a handwritten digit, into pure static, one small step of noise at a time. Then run two small trained networks backwards: from noise to data, a little at a time, steered by a prompt.',
	chapters: [
		{ id: 'forward', title: 'Adding noise' },
		{ id: 'learn', title: 'Learning to denoise' },
		{ id: 'generate', title: 'Generating' },
		{ id: 'guide', title: 'Prompts and guidance' }
	],
	steps: [
		// ------------------------------------------------------------------ forward
		{
			id: 'noise-cloud',
			chapter: 'forward',
			title: 'Destroying data is easy',
			scene: 'plane',
			hints: { mode: 'forward' },
			duration: 22,
			controls: [auto('auto-cloud'), noiseStep('t-cloud', 300)],
			body: `
<p>A <dfn data-def="A model that generates new data (images, sounds, points) by starting from random noise and removing it step by step, having learnt how from examples.">diffusion model</dfn> generates images by learning to undo a process that is easy to run forwards: drowning data in noise. Start with something where the whole process fits on screen: 400 points in a plane, in the shape of two interlocking half-moons (made up by the computer, like the datasets on the <a href="../neural-networks/#train-neuron">neural-networks</a> page).</p>
<p>At every one of <i>T</i> = 1,000 steps, each point is shrunk a tiny bit towards the centre and given a small random kick:</p>
<p class="formula"><strong><i>x</i><sub><i>t</i></sub> = √(1 − β<sub><i>t</i></sub>) · <i>x</i><sub><i>t</i>−1</sub> + √β<sub><i>t</i></sub> · ε, &nbsp; ε a fresh <dfn data-def="Random numbers following the bell curve: mostly near 0, rarely beyond ±2 or ±3. “Standard” means average 0 and spread (standard deviation) 1.">standard normal</dfn> kick</strong></p>
<p>The kicks are tiny: β grows from 0.0001 at the first step to 0.02 at the last. Watch the moons blur, lose their shape and, long before step 1,000, become a round, featureless blob: the bell curve in two dimensions. Every trace of the data is gone, and nothing had to be learnt to get there.</p>`,
			notes: `<p>The name comes from physics: the points spread out like ink diffusing in water. The shrinking keeps the cloud from growing without bound: the shrink and the kick are balanced so that a cloud of spread 1 keeps spread 1, and any starting cloud ends up as the standard normal distribution. This schedule (β from 10⁻⁴ to 0.02 over 1,000 steps, rising in a straight line) is the one of Jonathan Ho, Ajay Jain and Pieter Abbeel's “Denoising Diffusion Probabilistic Models” (2020), the paper that made the method work on images.</p>`
		},
		{
			id: 'schedule',
			chapter: 'forward',
			title: 'Jumping straight to any step',
			scene: 'schedule',
			duration: 22,
			controls: [auto('auto-schedule'), noiseStep('t-schedule', 300)],
			body: `
<p>Adding up many small normal kicks gives one bigger normal kick, so there is no need to run the steps one by one. Multiply all the shrink factors and write ᾱ<sub><i>t</i></sub> = (1 − β<sub>1</sub>)(1 − β<sub>2</sub>)…(1 − β<sub><i>t</i></sub>); then, in one go,</p>
<p class="formula"><strong><i>x</i><sub><i>t</i></sub> = √ᾱ<sub><i>t</i></sub> · <i>x</i><sub>0</sub> + √(1 − ᾱ<sub><i>t</i></sub>) · ε</strong></p>
<p>The noisy point is a blend: a fraction √ᾱ<sub><i>t</i></sub> of the clean point plus a fraction √(1 − ᾱ<sub><i>t</i></sub>) of pure noise. The curves show the two fractions. At step 100 the data still dominates (0.95 against 0.32); they cross around step 260; by step 500 only 0.28 of the signal is left, and at step 1,000 just 0.006, far below the noise.</p>
<p>On the right, one clean point (the ring) is noised 40 times over, each time with different kicks: the dots are where the 40 chains are at step <i>t</i>, and the line is the whole path of one of them. The disc is what the one-go formula predicts, without running any chain: centred on √ᾱ<sub><i>t</i></sub> times the point, with a radius of two noise units. The chains stay inside it (about 86% of them should). This shortcut is what makes training fast: to make an example for any step, one line of arithmetic is enough.</p>`,
			notes: `<p>Why it works: the variances of independent normal kicks add, and each kick is shrunk by the later shrink factors. Working it through gives exactly 1 − ᾱ<sub><i>t</i></sub> for the total variance of the noise. With ᾱ<sub>1000</sub> ≈ 0.00004, <i>x</i><sub>1000</sub> is a standard normal sample for every practical purpose, whatever the data were.</p>`
		},
		{
			id: 'noise-digit',
			chapter: 'forward',
			title: 'An image is a point too',
			scene: 'digit',
			hints: { mode: 'forward' },
			duration: 22,
			controls: [realDigit, auto('auto-digit'), noiseStep('t-digit', 300)],
			body: `
<p>An image is the same thing in many more dimensions. A 28 × 28 grey picture is a list of 784 numbers, one per pixel (here from −1 for black to +1 for white), so it is one point in a space of 784 dimensions, and noising it means doing to all 784 coordinates what was done to the 2 of each point in the plane.</p>
<p>This is a real handwritten digit from <dfn data-def="A collection of 70,000 handwritten digits, 28 × 28 pixels each, gathered by the US National Institute of Standards and Technology and prepared by Yann LeCun, Corinna Cortes and Christopher Burges; the classic test set of machine learning.">MNIST</dfn>, the collection used on the <a href="../convolution-vision/#predict">convolution and computer vision</a> page. Each pixel gets its own normal kick. At step 100 the digit is grainy but plain; around step 300 it is barely there; by step 600 a person sees only static, and at step 1,000 it is static, with nothing of the digit left (√ᾱ = 0.006).</p>
<p>The strip shows the same digit at steps 0, 50, 100, 200, 300, 500 and 1,000.</p>`,
			notes: `<p>The pixels outside the noise's reach are clipped to the range from black to white for display; the numbers themselves can go well beyond ±1. Real image models work with colour images of 512 × 512 pixels or more, or (as Stable Diffusion does) with a compressed version of them, but the process is exactly this one.</p>`
		},
		// ------------------------------------------------------------------ learn
		{
			id: 'denoise',
			chapter: 'learn',
			title: 'The network’s one job: guess the clean point',
			scene: 'plane',
			hints: { mode: 'denoise' },
			duration: 24,
			controls: [noiseStep('t-denoise', 500)],
			body: `
<p>To run the film backwards we need, at every step, an idea of where a noisy point came from. That is a job for a <a href="../neural-networks/#neuron">neural network</a>. It is given a noisy point <i>x</i><sub><i>t</i></sub> and the step <i>t</i>, and asked for its best guess <i>x̂</i><sub>0</sub> of the clean point. Training is endless practice: take a real point, pick a step at random, noise it with the one-go formula, ask for a guess, and nudge the weights by <a href="../neural-networks/#backward">backpropagation</a> to make the guess less wrong.</p>
<p>A noisy point could have come from many clean ones, so the best possible guess is their average. Each arrow goes from a noisy point to the trained network's guess. Slide <i>t</i>. At step 1,000 the arrows all point to nearly the same place, near the middle of the data: the noise has erased everything, and the average of all the data is the best one can say. As <i>t</i> falls, the guesses spread out towards the moons; by step 50, nine in ten of them lie on a moon, next to the noisy point.</p>
<p>Many papers phrase the job as guessing the <em>noise</em> ε that was added instead. It is the same guess: given <i>x</i><sub><i>t</i></sub> and <i>t</i>, the clean point and the noise determine each other through the one-go formula.</p>`,
			notes: `<p>Ho and colleagues trained their network to predict the noise, with the loss ‖ε − ε̂‖². The networks here output the clean guess, and are trained with that same loss weighted to count the low-noise steps a little less (the “min-SNR” weighting of Hang and colleagues, 2023). Guessing the clean image suits a small network: a digit is described by far fewer than 784 numbers, while the noise needs all of them.</p>`
		},
		{
			id: 'network',
			chapter: 'learn',
			title: 'Inside the denoiser',
			scene: 'network',
			duration: 22,
			body: `
<p>The denoiser is an ordinary network of the kind on the neural-networks page, with three inputs:</p>
<ul>
<li>the noisy data: 2 numbers for a point, 784 for a digit;</li>
<li>the step <i>t</i>, written as sines and cosines of <i>t</i> at many frequencies, like the position codes of the original <a href="../transformers/#positions">transformer</a>, so the network can tell step 40 from step 400;</li>
<li>a label saying what is wanted (“upper moon”, “a 7”), turned into a learned vector, an <a href="../embeddings/#numbers">embedding</a>, or a “no label” vector (more on that later).</li>
</ul>
<p>They go into a stack of layers that each add a correction to a running sum (a residual design), and out comes the guess. The plane's network has 5,394 weights and trained in about two minutes on one processor core; the digit network has 1.7 million. Both were trained for this page in plain JavaScript, and the plane's runs live in your browser.</p>
<p>Real image models use the same recipe with a much larger network, a <dfn data-def="A convolutional network shaped like a U: it shrinks the image step by step to see its overall layout, then grows it back, with shortcuts that carry the fine detail across.">U-Net</dfn> or a transformer, with hundreds of millions to billions of weights.</p>`,
			notes: `<p>The networks: an input layer, then residual blocks <i>h</i> ← <i>h</i> + SiLU(<i>W h</i> + <i>U c</i> + <i>b</i>), where <i>c</i> joins the step code and the label embedding, then an output layer. The plane's has 2 blocks of 32 units, the digit's 3 blocks of 512. Both were trained with the Adam optimiser, and the weights used are a running average of the trained ones (an “exponential moving average”), which gives cleaner samples, as in Ho and colleagues' paper. The training scripts are in the site's repository (scripts/data/diffusion-models).</p>`
		},
		// ------------------------------------------------------------------ generate
		{
			id: 'reverse-cloud',
			chapter: 'generate',
			title: 'From noise to data, a little at a time',
			scene: 'plane',
			hints: { mode: 'reverse' },
			duration: 26,
			controls: [
				auto('auto-reverse'),
				progress('k-reverse'),
				steps('steps-reverse', 1000),
				seed('seed-reverse')
			],
			body: `
<p>Now generate. Draw 400 points of pure noise, a standard normal cloud like the end of the noising. Then, for <i>t</i> = 1,000, 999, …, 1:</p>
<ol>
<li>ask the network for its guess <i>x̂</i><sub>0</sub>;</li>
<li>move each point a little of the way towards its guess, the amount set by the schedule;</li>
<li>add back a little fresh noise, less at each step.</li>
</ol>
<p>Steps 2 and 3 draw <i>x</i><sub><i>t</i>−1</sub> from the exact distribution of one step earlier given the clean point (Ho and colleagues' equations), using the network's guess in place of the unknown clean point. Early guesses are poor, which is why each step moves so little; as the noise falls, the guesses sharpen, and the cloud condenses onto the moons. Points are coloured by the moon they end up on: the starting noise already decides it.</p>
<p>The readout counts the points that land on a moon. Change the seed for other noise, and other points, from the same model.</p>`,
			notes: `<p>The fresh noise of step 3 matters: without it every point would slide to the average of what it could become, and the samples would bunch up. Each step's random kick is what lets different points end up at different places of the data. A deterministic variant exists (DDIM, Song, Meng and Ermon 2021): it removes the noise but changes the way each step is taken to keep the samples spread out.</p>`
		},
		{
			id: 'few-steps',
			chapter: 'generate',
			title: 'Why not jump in one step?',
			scene: 'plane',
			hints: { mode: 'reverse' },
			duration: 26,
			controls: [steps('steps-few', 1), auto('auto-few'), progress('k-few'), seed('seed-few')],
			body: `
<p>A thousand network evaluations for one sample is slow. Why not one big step? Choose 1: from pure noise the best guess is the average of all the data, so every point lands in a smear near the middle, between the moons. The network did its job: it gave the <em>average</em> answer, and an average of many possible data points is not itself one of them. For images this is the blurry, washed-out mean of all faces or all digits.</p>
<p>Now try more steps. The sampler takes evenly spaced steps through the 1,000, recomputing the schedule over them, so each step removes more noise. With 10 steps 62% of the points reach a moon, with 100 steps 87%, and with all 1,000, 92%. Each small step commits to a little more detail, and the next guess builds on it.</p>
<p>That is the trade-off of diffusion models: quality against the number of steps, each one a full run of the network. Much research goes into needing fewer.</p>`,
			notes: `<p>Taking a subsequence of the steps and recomputing β over it is from Alex Nichol and Prafulla Dhariwal's “Improved Denoising Diffusion Probabilistic Models” (2021). Modern samplers (DDIM, higher-order solvers, “distilled” models trained to take big steps) make good images in 20 to 50 steps, some in 1 to 4.</p>`
		},
		{
			id: 'reverse-digit',
			chapter: 'generate',
			title: 'Generating a digit',
			scene: 'digit',
			hints: { mode: 'reverse' },
			duration: 26,
			controls: [
				digitPrompt('digit', 3),
				digitSeed('dseed'),
				auto('auto-rdigit'),
				progress('k-rdigit')
			],
			body: `
<p>The same process with the 784-dimensional model, trained on MNIST's 60,000 training digits. It starts from 784 numbers of pure static and takes all 1,000 steps. These runs were computed in advance by the same code (the network is too big to ship to your browser) and stored as 9 snapshots each, 3 runs per digit.</p>
<p>Left, the image <i>x</i><sub><i>t</i></sub> as it is denoised; right, the network's guess <i>x̂</i><sub>0</sub> of the finished digit at that moment. The two tell different stories. The guess takes shape early: by step 300 (<i>t</i> = 700) it is already a blurry version of the final digit, because the prompt and the faint signal left in the noise narrow down the possibilities fast. The image itself stays static for much longer and only emerges in the last few hundred steps, as the noise is taken away and the guess's details are settled.</p>
<p>The digit is generated, not retrieved: it is not one of the training digits, and a different seed gives a different hand.</p>`,
			notes: `<p>Here the network is told which digit to make (a <em>prompt</em>, see the next chapter), with guidance scale 3. The images are stored with 16 grey levels to keep the page small. The guess is clipped to the black-to-white range at every step, as in Ho and colleagues' sampler.</p>`
		},
		{
			id: 'steps-digit',
			chapter: 'generate',
			title: 'Fewer steps, more average digits',
			scene: 'digit',
			hints: { mode: 'steps' },
			duration: 24,
			body: `
<p>The same prompt (“2”) and the same starting noise, sampled with 1, 5, 20, 100 and 1,000 steps. One step gives a blurred 2: the average of all the 2s this noise could become, as in the plane (guidance makes it the average 2 rather than the average of every digit). Five steps already give a smooth but generic 2. With 100 and 1,000 steps the strokes get the wobbles, loops and uneven thickness of a real hand: more steps make the sample less average, more like one particular piece of data.</p>
<p>Below each digit is what the digit-reading network of the <a href="../convolution-vision/#predict">computer vision</a> page reads in it: a quick, independent check that a person would read it too.</p>`
		},
		// ------------------------------------------------------------------ guide
		{
			id: 'guidance-cloud',
			chapter: 'guide',
			title: 'Asking for something',
			scene: 'plane',
			hints: { mode: 'reverse' },
			duration: 26,
			controls: [
				prompt2d('prompt-guide', '0'),
				guidance('g-guide', 3),
				seed('seed-guide'),
				auto('auto-guide'),
				progress('k-guide')
			],
			body: `
<p>The models here were trained with a <dfn data-def="Extra information given to a generative model about what to produce: a class label, a sentence, an image to imitate.">condition</dfn>: each training point came with its label (“upper moon” or “lower moon”), except for 15% of them, where the label was replaced by “no label”. So one network learnt both to denoise <em>towards a moon you name</em> and to denoise <em>towards any data</em>.</p>
<p><dfn data-def="Classifier-free guidance (Ho and Salimans, 2021): run the network with and without the condition and push the guess past the conditioned one, away from the unconditioned one, by the guidance scale.">Classifier-free guidance</dfn> uses both at every step:</p>
<p class="formula"><strong>guess = guess<sub>no label</sub> + <i>s</i> · (guess<sub>label</sub> − guess<sub>no label</sub>)</strong></p>
<p>With <i>s</i> = 0 the prompt is ignored and both moons fill up. With <i>s</i> = 1 the network follows the label as trained: asked for the upper moon, all 400 points end on it. Above 1 the difference is exaggerated, and the points are pushed past the moon: at <i>s</i> = 3, 92% are still on it; at <i>s</i> = 7, only 60%, the rest overshoot off the data. Guidance buys obedience with variety, and too much of it distorts.</p>`,
			notes: `<p>Jonathan Ho and Tim Salimans's paper (2021) writes the formula with <i>w</i> = <i>s</i> − 1. Image generators expose the scale as a setting (“CFG scale”, often 5 to 8 by default) because a little exaggeration makes images match the prompt better and look sharper, at the cost of variety; too much gives over-saturated, distorted images. This page uses 100 sampling steps for the guided runs.</p>`
		},
		{
			id: 'guidance-digit',
			chapter: 'guide',
			title: 'Guidance on digits',
			scene: 'digit',
			hints: { mode: 'guidance' },
			duration: 24,
			controls: [guidedDigit],
			body: `
<p>The digit model was trained the same way, with its label dropped 15% of the time. Here are the prompts “4” and “7” at guidance 0, 1, 3 and 7, all from the same starting noise.</p>
<p>At 0 the prompt is ignored and the model makes whatever digit the noise leads to: here a 7, for both prompts (for “7” that is luck). At 1 it tries for the digit, and the result can be shaky: asked for a 4, it draws something the digit reader takes for a 9. Around 3 the strokes are confident; at 7 they are exaggerated, thick and broken: too much guidance distorts, as it pushed points off the moons.</p>
<p>The bars measure it on 200 digits per scale (20 of each): how many the digit-reading network of the computer vision page reads as the digit asked for.</p>`
		},
		{
			id: 'text',
			chapter: 'guide',
			title: 'From a label to a sentence',
			scene: 'prompt',
			duration: 26,
			body: `
<p>Image generators that follow a written prompt use the same machinery with a richer condition. The label becomes a sentence; the sentence is split into tokens and read by a <a href="../transformers/#tokens">transformer</a> text encoder, which turns it into a list of <a href="../embeddings/#numbers">embedding</a> vectors, one per token. At every denoising step the image network looks at those vectors through <dfn data-def="Attention in which the queries come from one thing (the image's positions) and the keys and values from another (the prompt's tokens), so each part of the image can draw on the words relevant to it.">cross-attention</dfn>: each region of the image asks which words concern it.</p>
<p>The text encoder is trained so that sentences and images about the same thing get similar vectors (as in OpenAI's CLIP), or is a large language model's encoder. Training needs hundreds of millions of image–caption pairs; with the caption dropped some of the time, classifier-free guidance works exactly as with the moons.</p>
<p>The diagram is a sketch of that design, not a model running here: this page's “prompts” are only the labels of the earlier steps.</p>`,
			notes: `<p>Stable Diffusion (Rombach and colleagues, “High-Resolution Image Synthesis with Latent Diffusion Models”, 2022) also does its denoising on a compressed version of the image: a separate network squeezes a 512 × 512 colour image into a 64 × 64 grid of 4 numbers per cell, diffusion runs there, and the same network expands the result back into pixels. Its first versions read the prompt with CLIP's text encoder, as tokens of 768 numbers each.</p>`
		},
		{
			id: 'playground',
			chapter: 'guide',
			title: 'The whole process',
			scene: 'plane',
			hints: { mode: 'reverse' },
			duration: 30,
			controls: [
				prompt2d('prompt-play', 'none'),
				guidance('g-play', 1),
				steps('steps-play', 100),
				seed('seed-play'),
				auto('auto-play'),
				progress('k-play')
			],
			body: `
<p>All the controls together. Pick a prompt, a guidance scale, a number of steps and a seed, and watch the reverse process run.</p>
<p>That is how a diffusion model works: <strong>noising data is easy and needs no learning; a network learns to guess, from a noisy version and the noise level, what the clean data were; and generating means starting from pure noise and repeatedly removing a little of it with those guesses</strong>, steered towards a prompt by guidance. Many small steps, each easy, together do what one step cannot.</p>`,
			notes: `<p>The simplifications on this page: the 2-D data and both networks are tiny, the digit runs are precomputed and stored at 16 grey levels, and the prompts are class labels rather than sentences. The schedule, the training loss, the sampler and the guidance are the real ones, as published.</p>`
		}
	]
};
