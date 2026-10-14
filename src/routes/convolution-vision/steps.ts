import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { PARAMS, SHAPES } from './cnn';
import { PRESETS, PRESET_IDS } from './filters';
import { CONFUSION, SAMPLES, TEST_ACCURACY, TEST_COUNT, TEST_ERRORS } from './mnist-cnn';

const pct = (TEST_ACCURACY * 100).toFixed(1);
const int = (n: number) => n.toLocaleString('en-US');
const size = (name: string) => SHAPES.find(([n]) => n === name)?.[1] ?? 0;
const DENSE = size('dw') + size('db');
const CONV = PARAMS - DENSE;

/** The test set's commonest confusions: [count, true digit, read as], most frequent first. */
const CONFUSIONS = CONFUSION.flatMap((row, d) =>
	row.flatMap((n, p) => (p !== d && n > 0 ? [[n, d, p] as const] : []))
).sort((a, b) => b[0] - a[0]);
const [c1, c2] = CONFUSIONS;

// NOTE: the descriptions of second-layer filters 13, 5, 11 and 14 (step "layer2"), and the filters
// shown in DeeperScene, are our reading of PARTS from this training run: re-read them after any
// retraining (scripts/data/convolution-vision/train.mjs).

/** One real MNIST test digit of each class (the first of each in the test set). */
const FIRST = Array.from({ length: 10 }, (_, d) => SAMPLES.findIndex((s) => s.label === d));
/** The four test digits the network gets wrong. */
const WRONG = SAMPLES.flatMap((s, i) => (s.label !== s.predicted ? [i] : []));

const digit: Control = {
	type: 'select',
	id: 'digit',
	label: 'Digit',
	default: String(FIRST[2]),
	options: [
		...FIRST.map((i, d) => ({ value: String(i), label: String(d) })),
		{ value: 'drawn', label: 'Your drawing' }
	],
	help: 'Handwritten digits from the MNIST test set, or the one you draw on the “Draw a digit” step.'
};

const preset: Control = {
	type: 'select',
	id: 'preset',
	label: 'Filter',
	default: 'vertical',
	options: PRESET_IDS.map((id) => ({ value: id, label: PRESETS[id].name }))
};

const reset: Control = {
	type: 'action',
	id: 'reset',
	label: 'Your edits',
	action: 'Reset the filter',
	help: 'Click the ▲ ▼ on a cell, or focus it and use the arrow keys.'
};

const shift: Control = {
	type: 'range',
	id: 'shift',
	label: 'Move the digit',
	min: -6,
	max: 6,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'not moved' : `${Math.abs(v)} px ${v < 0 ? 'left' : 'right'}`)
};

const f1: Control = {
	type: 'range',
	id: 'f1',
	label: 'First-layer filter',
	min: 1,
	max: 8,
	step: 1,
	default: 1,
	help: 'Or click a map on the stage.'
};

const f2: Control = {
	type: 'range',
	id: 'f2',
	label: 'Second-layer filter',
	min: 1,
	max: 16,
	step: 1,
	default: 13,
	help: 'Or click a map on the stage.'
};

const clear: Control = {
	type: 'action',
	id: 'clear',
	label: 'Drawing',
	action: 'Clear',
	help: 'Draw with the mouse or a finger in the box on the stage.'
};

const wrong: Control = {
	type: 'select',
	id: 'wrong',
	label: 'Digit',
	default: String(WRONG[0]),
	options: [
		...WRONG.map((i) => ({
			value: String(i),
			label: `${SAMPLES[i].label} read as ${SAMPLES[i].predicted}`
		})),
		{ value: 'drawn', label: 'Your drawing' }
	],
	help: 'The first four test digits the network gets wrong, or your own.'
};

const centre: Control = {
	type: 'toggle',
	id: 'centre',
	label: 'Centre and scale the drawing like MNIST',
	default: true
};

export const spec: ExplainerSpec = {
	slug: 'convolution-vision',
	title: 'Convolution and computer vision',
	summary:
		'Slide a small filter across a picture and watch it blur, sharpen or find edges. Then open up a network trained on handwritten digits: the same small detectors used everywhere, stacked layer on layer, read the digit you draw.',
	chapters: [
		{ id: 'filters', title: 'Filters' },
		{ id: 'network', title: 'A trained network' },
		{ id: 'reading', title: 'Reading digits' }
	],
	steps: [
		// ------------------------------------------------------------------ filters
		{
			id: 'grid',
			chapter: 'filters',
			title: 'A picture is a grid of numbers',
			scene: 'conv',
			hints: { mode: 'grid' },
			duration: 20,
			controls: [digit],
			body: `
<p>To a computer a grey picture is a grid of numbers, one per <dfn data-def="Picture element: one cell of the grid that makes up a digital image, with one number for its brightness (three for colour).">pixel</dfn>. This one is a handwritten digit from <dfn data-def="A collection of 70,000 handwritten digits, 28 × 28 pixels each, gathered by the US National Institute of Standards and Technology and prepared by Yann LeCun, Corinna Cortes and Christopher Burges. The standard first test of image recognition.">MNIST</dfn>, the classic collection of 70,000 of them: 28 × 28 = 784 numbers, 0 for paper and 1 for ink. The magnifier shows the numbers under it.</p>
<p>Could a <a href="../neural-networks/#hidden">neural network</a> read it? Feed the 784 numbers to a layer of neurons, and each neuron has 784 weights, one per pixel. A neuron that learns to spot a stroke in the top-left corner knows nothing about the same stroke one pixel lower: it has to be learnt again at every position.</p>
<p>A <dfn data-def="A neural network whose first layers apply small filters (convolutions) across the whole image, the same filter at every position.">convolutional network</dfn> starts from the opposite idea: one small detector, a few weights, used at every position of the picture. That operation is a convolution.</p>`,
			notes: `<p>MNIST was built in the 1990s from forms filled in by American high-school students and Census Bureau employees: 60,000 digits for training and 10,000 for testing, each scaled to fit a 20 × 20 box and centred in the 28 × 28 image. Colour pictures are three such grids: red, green and blue.</p>`
		},
		{
			id: 'slide',
			chapter: 'filters',
			title: 'Slide, multiply, add',
			scene: 'conv',
			hints: { mode: 'slide' },
			duration: 26,
			controls: [digit],
			body: `
<p>A <dfn data-def="A small grid of weights (here 3 × 3) slid across an image; at each position the pixels under it are multiplied by the weights and added up. Also called a kernel.">filter</dfn> is a small grid of weights, here 3 × 3. Put it over the picture, multiply each of the 9 pixels under it by the weight on top, and add the 9 products: that sum is one pixel of the output. Then slide the filter one pixel along and do it again, row by row, until it has visited every position.</p>
<p class="formula"><strong>out(<i>x</i>, <i>y</i>) = Σ <i>w</i>(<i>i</i>, <i>j</i>) × in(<i>x</i> + <i>i</i>, <i>y</i> + <i>j</i>)</strong>, for <i>i</i>, <i>j</i> = −1, 0, 1</p>
<p>That is a <dfn data-def="Sliding a filter across an image and taking, at each position, the sum of the pixels times the filter's weights. (Strictly, deep-learning libraries compute a cross-correlation: the filter is not flipped.)">convolution</dfn>. The output, a <dfn data-def="The image of a filter's responses at every position: how strongly the feature it detects is present at each place.">feature map</dfn>, is the same size as the input: off the edges the missing pixels count as 0. Blue is a positive sum, orange a negative one.</p>
<p>This filter has −1, −2, −1 on its left, +1, +2, +1 on its right. On blank paper or in solid ink the two sides cancel: 0. Where ink starts on the right of the window the sum is positive, where it stops, negative. It is a detector of vertical edges, the <dfn data-def="The 3 × 3 kernel [−1 0 1; −2 0 2; −1 0 1] (and its transpose), which measures how fast the pixel values change from left to right (top to bottom). Irwin Sobel and Gary Feldman, 1968.">Sobel filter</dfn>.</p>`,
			notes: `<p>Mathematicians flip the filter before sliding it (that is a true convolution, as in the <a href="../fourier-transform/">Fourier transform</a>'s convolution theorem); neural-network libraries do not, and compute what is strictly a cross-correlation. For a filter that is learnt the difference does not matter, and everyone calls it convolution.</p>`
		},
		{
			id: 'filters',
			chapter: 'filters',
			title: 'Blur, sharpen, find edges',
			scene: 'conv',
			hints: { mode: 'edit' },
			duration: 26,
			controls: [preset, reset, digit],
			body: `
<p>Change the nine weights and the same sliding operation does something else. Pick a filter, or edit the cells yourself:</p>
<ul>
<li><strong>Blur</strong>: nine 1s, divided by 9. Each output pixel is the average of its neighbourhood, so sharp edges are smeared out.</li>
<li><strong>Sharpen</strong>: 5 in the middle, −1 on each side: the pixel plus how much it stands out from its four neighbours, so edges get a bright rim and a dark rim.</li>
<li><strong>Vertical</strong> and <strong>horizontal edges</strong>: the Sobel pair. Each sees only the edges that run its way.</li>
<li><strong>Outline</strong>: 8 in the middle, −1 all round. It answers 0 wherever the picture is flat, and lights up every edge whatever its direction.</li>
</ul>
<p>When the weights add up to more than 0 the sum is divided by their total (the "÷" next to the filter), so that a blur keeps the picture's brightness. Edge filters add up to 0: flat areas give 0.</p>`,
			notes: `<p>Photo editors are full of these: blur, sharpen, emboss and edge detection are all small convolutions, usually 3 × 3 to 7 × 7. The division by the total is like the Normalise option of GIMP's "convolution matrix" filter.</p>`
		},
		{
			id: 'shared',
			chapter: 'filters',
			title: 'One small detector, used everywhere',
			scene: 'conv',
			hints: { mode: 'shift' },
			duration: 24,
			controls: [shift, preset, digit],
			body: `
<p>Move the digit. The feature map moves with it, by exactly the same amount, and keeps its shape: the filter finds an edge wherever it is, because the <strong>same 9 weights</strong> are used at all 784 positions. This is called <dfn data-def="Using the same weights at every position of the image, so that a feature is detected wherever it appears.">weight sharing</dfn>.</p>
<p>It is also why convolution is cheap. A layer of 784 neurons that each looked at all 784 pixels would need 784 × 784 = <strong>614,656 weights</strong> to produce a map like this, and would have to learn every edge at every place separately. The filter needs <strong>9</strong>.</p>
<p>So a convolutional network learns small detectors, a few dozen to a few hundred weights each, and the convolution applies them across the whole picture.</p>`
		},
		// ------------------------------------------------------------------ network
		{
			id: 'layer1',
			chapter: 'network',
			title: 'The first layer: filters learnt from examples',
			scene: 'layers',
			hints: { mode: 'l1' },
			duration: 26,
			controls: [f1, digit],
			body: `
<p>Here is a real convolutional network, small enough to run in your browser. Its first layer has <strong>8 filters</strong> of 5 × 5 weights, plus a bias each. Nobody chose their weights: they started random and were trained on MNIST's 60,000 training digits with <a href="../neural-networks/#backward">backpropagation</a> and <a href="../neural-networks/#train">gradient descent</a>, the same way as any network. The error flows back through the convolutions too, and every weight of a filter collects the slopes from all the positions where it was used.</p>
<p>Each filter is drawn with its weights, blue positive and orange negative, and next to it its feature map on the digit. Look at the filters: many are bands of blue beside bands of orange at some angle, and their maps light up along strokes that run that way, on one side of the stroke. Training has found rough edge detectors, much like Sobel's, at several orientations.</p>`,
			notes: `<p>The maps are shown before the ReLU of the next step, on one colour scale for all 8, so a weak response looks weak. The network was trained for this page by a plain Node script (no machine-learning library): 4 passes through the 60,000 training digits, each shifted at random by up to 2 pixels.</p>`
		},
		{
			id: 'pool',
			chapter: 'network',
			title: 'Keep the positives, keep the strongest',
			scene: 'layers',
			hints: { mode: 'pool' },
			duration: 24,
			controls: [f1, digit],
			body: `
<p>Two simple operations follow each convolution. First the <a href="../neural-networks/#activation">ReLU</a> activation: negative sums become 0, so a map keeps only "edge found here", not "the opposite of an edge". Without it, two convolutions in a row would amount to a single larger one, just as stacked layers on the neural-networks page would collapse into one.</p>
<p>Then <dfn data-def="Shrinking a feature map by keeping only the largest value of each small block (here 2 × 2).">max pooling</dfn>: the map is cut into 2 × 2 blocks and each block keeps only its largest value. The 28 × 28 map becomes 14 × 14. It keeps <em>whether</em> the feature was found in each little region and forgets exactly where, so a stroke one pixel further along changes little.</p>
<p>After the first layer the digit has become 8 maps of 14 × 14: where edges of each orientation are.</p>`
		},
		{
			id: 'layer2',
			chapter: 'network',
			title: 'The second layer: edges combine into parts',
			scene: 'layers',
			hints: { mode: 'l2' },
			duration: 30,
			controls: [f2, digit],
			body: `
<p>The second layer runs <strong>16 filters</strong> over those 8 maps. Each filter is 5 × 5 × 8 = 200 weights: it looks at all 8 edge maps at once, so it can respond to a particular <em>combination</em> of edges, such as a vertical stroke ending under a horizontal one.</p>
<p>What does each one respond to? The strip shows, for the selected filter, the six patches of the 10,000 test digits that excite it most. Each patch is the 14 × 14 window of the picture that one unit of this layer (one pixel of one of its maps) sees, its <dfn data-def="The part of the input image that can affect one unit of a layer. It grows with every convolution and pooling layer.">receptive field</dfn>: bigger than the 5 × 5 of the first layer, because the pooling halved the maps in between.</p>
<p>The patches are parts of strokes. Filter 13, for example, fires on a single upright stroke, filter 5 on the corner at the top right of a 7, filter 11 on the closed loop of a 6, filter 14 on a curve shaped like a closing bracket. The first layer found edges; the second combines them into <strong>parts of digits</strong>.</p>`,
			notes: `<p>Showing the inputs that excite a unit most is one of the standard ways to look inside a trained network; the descriptions above are our reading of those patches. The maps of this layer are 14 × 14 before pooling, and shown after the ReLU.</p>`
		},
		// ------------------------------------------------------------------ reading
		{
			id: 'predict',
			chapter: 'reading',
			title: 'Draw a digit',
			scene: 'predict',
			hints: { select: 'digit' },
			duration: 30,
			controls: [digit, clear],
			body: `
<p>Draw a digit in the box. Your drawing is prepared the way the MNIST digits were: scaled to fit a 20 × 20 box and centred in the 28 × 28 grid. Then it flows through the network: 8 edge maps, pooled to 14 × 14, 16 part maps, pooled to 7 × 7.</p>
<p>The last step is an ordinary layer of the <a href="../neural-networks/#hidden">neural-networks</a> kind: the 16 × 7 × 7 = 784 numbers go to 10 output neurons, one per digit, and a <dfn data-def="The function that turns a list of scores into probabilities: e to the power of each score, divided by the sum of them all. The probabilities are positive and add up to 1.">softmax</dfn> turns their 10 sums into probabilities that add up to 1. Each output neuron weighs evidence like "loop at the top" and "upright stroke on the right" from every region.</p>
<p>The whole network has ${int(PARAMS)} weights and biases, and on the ${int(TEST_COUNT)} MNIST test digits, which it never saw during training, it is right <strong>${pct}%</strong> of the time (${TEST_ERRORS} wrong).</p>`,
			notes: `<p>The architecture follows Yann LeCun's LeNet, which read the amounts on bank cheques in the 1990s (LeCun, Bottou, Bengio and Haffner, 1998). Most of the weights and biases, ${int(DENSE)}, are in the last layer; the two convolutional layers together have ${int(CONV)}.</p>`
		},
		{
			id: 'mistakes',
			chapter: 'reading',
			title: 'Where it goes wrong',
			scene: 'predict',
			hints: { select: 'wrong' },
			duration: 30,
			controls: [wrong, centre, clear],
			body: `
<p>${TEST_ERRORS} test digits out of ${int(TEST_COUNT)} fool it. These are the first four. Some are hard for people too; others show the network has not seen enough of that way of writing. The commonest confusion is a ${c1[1]} read as a ${c1[2]} (${c1[0]} times), then a ${c2[1]} read as a ${c2[2]} (${c2[0]} times).</p>
<p>It also has no way to say "this is not a digit". Draw a letter, a face or a scribble: the softmax shares the probability out among the ten digits all the same, and often one of them gets most of it.</p>
<p>And it relies on the digits being prepared like MNIST's. Switch off the centring and draw a small digit in a corner of the box: the filters still find its edges (they work everywhere), but the last layer learnt where parts of a digit sit in a centred digit, and the answer goes wrong.</p>`,
			notes: `<p>The network was trained only on centred digits shifted by up to 2 pixels. Training on digits moved further, scaled and rotated (data augmentation), or adding more pooling, makes a network more tolerant of such changes.</p>`
		},
		{
			id: 'deeper',
			chapter: 'reading',
			title: 'Deeper networks see bigger things',
			scene: 'deeper',
			duration: 30,
			body: `
<p>Each layer's units see a bigger window of the picture than the last: 5 × 5 pixels for the first layer, 14 × 14 for the second, the whole digit for the output. Small detectors stacked layer on layer build up from <strong>edges to parts to whole digits</strong>.</p>
<p>Networks that recognise photographs do the same with more layers. AlexNet (Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton, 2012) had 5 convolutional layers and 60 million weights, trained on 1.2 million photos of 1000 kinds of objects; its win in the ImageNet competition started the deep-learning boom. Looking inside such a network, Matthew Zeiler and Rob Fergus (2014) found the same ladder, longer: edges and colour blobs in the first layer, corners and other combinations of edges in the second, textures such as mesh patterns in the third, parts such as dogs' faces or birds' legs in the fourth, and whole objects in the fifth.</p>
<p>That is a convolutional network: <strong>the same small detectors used across the whole image, stacked so that simple features combine into complex ones</strong>. Our two-layer network climbs the first rungs of that ladder; the textures and object parts take deeper networks and photographs.</p>`,
			notes: `<p>Modern image networks have from dozens to over a hundred layers (ResNet, 2015, added shortcuts that make very deep networks trainable). Convolution is also used on sound, on text and on the 3D structure of proteins: anywhere the same pattern can turn up in many places.</p>`
		}
	]
};
