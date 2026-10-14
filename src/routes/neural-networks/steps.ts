import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { DATASET_IDS, DATASET_NAMES } from './network';

// ---- the single neuron, set by hand ------------------------------------------------------
const weight = (id: string, label: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: -4,
	max: 4,
	step: 0.1,
	default: def,
	format: (v) => v.toFixed(1).replace('-', '−'),
	help
});

// ---- the network ---------------------------------------------------------------------------
const data = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Dataset',
	default: def,
	options: DATASET_IDS.map((d) => ({ value: d, label: DATASET_NAMES[d] })),
	help: '200 points made up by the computer, 100 of each colour.'
});

const layers = (id: string, def: number, min = 0): Control => ({
	type: 'range',
	id,
	label: 'Hidden layers',
	min,
	max: 3,
	step: 1,
	default: def,
	format: (v) => (v === 0 ? 'none: a single neuron' : String(v)),
	help: 'Layers of neurons between the inputs and the output.'
});

const neurons = (id: string, def: number): Control => ({
	type: 'range',
	id,
	label: 'Neurons per hidden layer',
	min: 1,
	max: 8,
	step: 1,
	default: def
});

const activation = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Activation',
	default: def,
	options: [
		{ value: 'tanh', label: 'tanh' },
		{ value: 'relu', label: 'ReLU' },
		{ value: 'linear', label: 'None' }
	],
	help: 'What every hidden neuron does to its sum: squash it (tanh), cut off the negatives (ReLU), or nothing.'
});

const LR_OPTIONS = ['0.01', '0.03', '0.1', '0.3', '1', '3'];
const learningRate = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Learning rate η',
	default: def,
	options: LR_OPTIONS.map((v) => ({ value: v, label: v })),
	help: 'The step size of gradient descent: every weight moves by η × its slope.'
});

const again = (id: string): Control => ({
	type: 'action',
	id,
	label: 'New random weights',
	action: 'Train again',
	help: 'Start again from a different random set of weights.'
});

const nextExample: Control = {
	type: 'action',
	id: 'example',
	label: 'Step through',
	action: 'Next example',
	help: 'Apply this update and move on to the next example.'
};

export const spec: ExplainerSpec = {
	slug: 'neural-networks',
	title: 'Neural networks and backpropagation',
	summary:
		'Build a network out of simple neurons, train it live and watch it bend a straight line into circles and spirals. Then follow one example forward through the network and its error backward, adjusting every weight.',
	chapters: [
		{ id: 'neuron', title: 'One neuron' },
		{ id: 'layers', title: 'Layers' },
		{ id: 'backprop', title: 'Backpropagation' },
		{ id: 'training', title: 'Training' }
	],
	steps: [
		// ------------------------------------------------------------------ neuron
		{
			id: 'neuron',
			chapter: 'neuron',
			title: 'A neuron: weigh, add, squash',
			scene: 'neuron',
			duration: 22,
			controls: [
				weight('w1', 'Weight w₁', 2),
				weight('w2', 'Weight w₂', 1.5),
				weight(
					'b',
					'Bias b',
					-0.5,
					'Or drag the point on the plane to feed the neuron other inputs.'
				)
			],
			body: `
<p>The task on this page: points in a plane, each one orange or blue, and a model that should tell from a point's two coordinates, <i>x</i>₁ and <i>x</i>₂, which colour it is.</p>
<p>The building block is the artificial <dfn data-def="A unit that multiplies each input by a weight, adds them up with a bias, and passes the sum through an activation function.">neuron</dfn>. It does three things: it multiplies each input by a <dfn data-def="A number that sets how strongly one input pushes on a neuron's sum; positive pushes up, negative pushes down. Training adjusts the weights.">weight</dfn>, adds the results and a <dfn data-def="A number added to a neuron's sum, whatever the inputs: it shifts where the neuron switches on.">bias</dfn>, and squashes the sum <i>z</i> into an output between 0 and 1:</p>
<p class="formula"><strong><i>z</i> = <i>w</i>₁<i>x</i>₁ + <i>w</i>₂<i>x</i>₂ + <i>b</i> &nbsp;→&nbsp; output = σ(<i>z</i>)</strong></p>
<p>The squashing curve σ, the <dfn data-def="The S-shaped curve σ(z) = 1/(1 + e^−z): near 0 for very negative z, 0.5 at z = 0, near 1 for very positive z.">sigmoid</dfn>, turns the sum into a probability that the point is blue. Drag the point to feed the neuron different inputs and follow the numbers through it.</p>
<p>The plane is shaded by the neuron's answer everywhere. Where <i>z</i> = 0 the answer is 50/50, and the points with <i>z</i> = 0 always form a <strong>straight line</strong>. Move the sliders: the weights turn the line, the bias slides it, but it never bends.</p>`,
			notes: `<p>The name comes from a loose analogy with brain cells, which add up signals from other cells and fire when the total passes a threshold. Real neurons are far more complicated; an artificial neuron is just this formula. A single neuron with a sigmoid is also known to statisticians as <em>logistic regression</em>.</p>`
		},
		{
			id: 'train-neuron',
			chapter: 'neuron',
			title: 'Letting gradient descent set the weights',
			scene: 'network',
			hints: { layers: 0, act: 'tanh', lr: 0.3 },
			duration: 22,
			controls: [data('data-neuron', 'clusters')],
			body: `
<p>Instead of moving sliders by hand, let the computer find the weights. It needs a <a href="../gradient-descent/#settings">loss</a>: a number that says how wrong the neuron is. For an answer given as a probability the usual choice is the <dfn data-def="The loss −log(probability given to the right answer), averaged over the examples. 0 for a confident right answer, ln 2 ≈ 0.693 for a 50/50 guess, large for a confident wrong one.">cross-entropy</dfn>: minus the logarithm of the probability the neuron gave to the right colour. A sure, right answer costs 0; a 50/50 guess costs 0.693; a sure, wrong answer costs a lot.</p>
<p>The neuron has three parameters, <i>w</i>₁, <i>w</i>₂ and <i>b</i>, and they are trained by <a href="../gradient-descent/#descend">gradient descent</a>, exactly as the line was: measure which way the loss falls, step that way, repeat.</p>
<p>On the two clusters it works at once: within a couple of passes through the data every point is on the right side. Now pick <strong>Four corners</strong> or <strong>Circle in a ring</strong>. The line turns and shifts, but no straight line can split these: the loss stays near 0.693, no better than guessing.</p>`,
			notes: `<p>The four corners are the classic <em>XOR</em> problem: blue where <i>x</i>₁ and <i>x</i>₂ have the same sign, orange where they differ. Marvin Minsky and Seymour Papert's book <em>Perceptrons</em> (1969) made the limitation of single neurons famous; at best a line gets three corners of the four right.</p>`
		},
		// ------------------------------------------------------------------ layers
		{
			id: 'hidden',
			chapter: 'layers',
			title: 'A hidden layer: several lines, combined',
			scene: 'network',
			hints: { data: 'circle', layers: 1, act: 'tanh', lr: 0.3 },
			duration: 24,
			controls: [neurons('neurons-hidden', 3)],
			body: `
<p>Put several neurons side by side, each one looking at the two inputs, and feed their outputs to a final neuron. The middle neurons form a <dfn data-def="A row of neurons that all take the same inputs. In a hidden layer the neurons feed the next layer instead of giving the final answer.">hidden layer</dfn>: hidden because we never see their outputs as the answer, only the final <dfn data-def="The last neuron (or neurons) of a network, whose output is its answer.">output neuron</dfn>'s.</p>
<p>Each square in the diagram is one neuron, shaded by its output over the whole plane. Every hidden neuron still draws a straight edge, but at its own angle and place. The output neuron weighs and adds <em>their</em> outputs, and the sum of a few soft edges can be a closed shape.</p>
<p>Three neurons are enough to trap the circle, at epoch 64. Slide down to two and the best they manage is a band, with some ring points always wrong. One is back to a single line. More than three gets there faster.</p>`,
			notes: `<p>The lines between the squares are the weights: blue for positive, orange for negative, thicker for larger. In these hidden layers the squashing is done by tanh, the sigmoid stretched to run from −1 to 1, which suits neurons whose outputs feed other neurons.</p>`
		},
		{
			id: 'bend',
			chapter: 'layers',
			title: 'What a layer does to the plane',
			scene: 'bend',
			duration: 24,
			body: `
<p>Another way to see it: a hidden layer moves every point of the plane. Here a network with two hidden neurons has learnt the four corners. For each point, the two hidden outputs are its new coordinates. Watch the grid and the points move there, in three moves:</p>
<ol>
<li>multiply by the layer's <dfn data-def="The table of a layer's weights: one row per neuron, one column per input. Multiplying a point by it is a linear transformation of the plane.">weight matrix</dfn> <i>W</i>: a <a href="../linear-transformations/#matrix">linear transformation</a> that turns, stretches and shears the grid but keeps its lines straight and parallel;</li>
<li>add the biases: shift everything;</li>
<li>squash both coordinates with tanh: the plane is <strong>bent</strong>, folded into a square from −1 to 1.</li>
</ol>
<p>In the bent plane the blue corners have been pulled to one side and the orange to the other, and a straight line, the output neuron's, splits them. Drawn back on the original plane, that line is the bent boundary. A network classifies by bending space until a straight cut works.</p>`,
			notes: `<p>The view of layers as transformations of space is beautifully explained in Chris Olah's essay "Neural Networks, Manifolds, and Topology" (2014). The squash at step 3 is what makes the difference: without it, steps 1 and 2 would only move lines into other straight lines.</p>`
		},
		{
			id: 'activation',
			chapter: 'layers',
			title: 'Without the bend, layers add nothing',
			scene: 'network',
			hints: { data: 'circle', layers: 2, neurons: 8, lr: 0.1, curve: true },
			duration: 24,
			controls: [activation('act-activation', 'linear')],
			body: `
<p>The squashing curve of a hidden neuron is its <dfn data-def="The function a neuron applies to its weighted sum, such as the sigmoid, tanh or ReLU. Without it, a network of any depth is equivalent to a single neuron.">activation function</dfn>. This network has two hidden layers of 8 neurons, and it starts with <strong>no activation</strong>: each neuron passes its sum on unchanged.</p>
<p>It fails like a single neuron, with a straight boundary. Each layer is then a linear transformation plus a shift, and <a href="../linear-transformations/#compose">a chain of linear transformations is one linear transformation</a>: the 2 × 8, 8 × 8 and 8 × 1 weight tables multiply out to a single row of two weights. Sixteen neurons collapse into one.</p>
<p>Switch to <strong>tanh</strong> and the same network traps the circle by epoch 40. <strong>ReLU</strong>, the <dfn data-def="Rectified linear unit: output = z when z is positive, 0 otherwise. The most common activation in modern networks.">rectified linear unit</dfn>, simply cuts the negative sums to 0; it is the commonest choice today, and here gets there by epoch 9. With ReLU the boundary is made of straight pieces joined at corners.</p>`,
			notes: `<p>Any curve that is not a straight line will do in principle. ReLU is popular because it is cheap and its slope (1 for every positive sum) does not fade as the error is passed back through many layers, which tanh's and the sigmoid's slopes do.</p>`
		},
		{
			id: 'depth',
			chapter: 'layers',
			title: 'Deeper networks, more intricate shapes',
			scene: 'network',
			hints: { data: 'spiral', neurons: 8, act: 'relu', lr: 0.1 },
			duration: 26,
			controls: [layers('layers-depth', 1, 1)],
			body: `
<p>Two spirals wound round each other are much harder. One hidden layer of 8 ReLU neurons gets about two thirds of the points right, then stalls: 8 straight cuts are not enough to follow the arms.</p>
<p>Add layers. Each layer works on the outputs of the one before, so it can fold the already bent plane again. Look at the squares: in the first hidden layer every neuron is a single straight edge; in the second, combinations of edges; in the third, pieces of the spiral itself. With two layers the network separates the spirals by epoch 457, with three by epoch 231.</p>
<p>This is the "deep" in <dfn data-def="Machine learning with neural networks of many layers.">deep learning</dfn>: stacking layers builds complicated shapes out of simple ones.</p>`,
			notes: `<p>A single hidden layer can in theory draw any boundary if it is wide enough (the universal approximation theorem, George Cybenko 1989 and Kurt Hornik 1991), but it may need a great many neurons. Deep networks tend to get the same shapes with far fewer. Here the width is capped at 8 so that the diagram stays readable.</p>`
		},
		// ------------------------------------------------------------------ backprop
		{
			id: 'forward',
			chapter: 'backprop',
			title: 'One example, forward',
			scene: 'backprop',
			hints: { phase: 'forward' },
			duration: 22,
			controls: [nextExample],
			body: `
<p>How does training find so many weights at once? Slow everything down to one example and a small network: 2 inputs, 2 hidden tanh neurons, 1 output.</p>
<p>First the <dfn data-def="Computing a network's output for one input, layer by layer from the inputs to the output, keeping every neuron's sum and output.">forward pass</dfn>: the example's coordinates enter on the left. Each hidden neuron computes its sum <i>z</i> and its output <i>a</i> = tanh(<i>z</i>); the output neuron does the same with the hidden outputs, and gives the probability <i>p</i> that the point is blue.</p>
<p>The example's true colour is <i>y</i> (1 for blue, 0 for orange), and the cross-entropy says how wrong <i>p</i> was. The network keeps every <i>z</i> and <i>a</i> it computed: the backward pass needs them.</p>`
		},
		{
			id: 'backward',
			chapter: 'backprop',
			title: 'The error flows backward',
			scene: 'backprop',
			hints: { phase: 'backward' },
			duration: 24,
			controls: [nextExample],
			body: `
<p>Now the question is: for each neuron, how much would the loss change if its sum <i>z</i> were a little bigger? That slope, ∂L/∂<i>z</i>, is the neuron's <dfn data-def="The slope ∂L/∂z of the loss with respect to a neuron's sum, written δ. Backpropagation computes it layer by layer, from the output back.">error signal</dfn> δ.</p>
<p>For the output neuron, with the sigmoid and the cross-entropy, it comes out remarkably simple: <strong>δ = <i>p</i> − <i>y</i></strong>. Too high an answer gives a positive δ, too low a negative one.</p>
<p>A hidden neuron affects the loss only through the output neuron, along its weight <i>w</i>, and slopes along a chain multiply (the <dfn data-def="The rule of calculus for a chain of effects: if a changes b at rate r and b changes c at rate s, then a changes c at rate r × s.">chain rule</dfn>): a nudge to its sum changes its output by tanh′(<i>z</i>) per unit, the output neuron's sum by <i>w</i> times that, and the loss by δ<sub>output</sub> times that again. So:</p>
<p class="formula"><strong>δ<sub>hidden</sub> = <i>w</i> × δ<sub>output</sub> × tanh′(<i>z</i>)</strong></p>
<p>With more layers the same rule repeats, layer by layer, from the output back to the inputs: that is <dfn data-def="Computing the slope of the loss for every weight of a network by passing error signals backward from the output, layer by layer, with the chain rule.">backpropagation</dfn>.</p>`,
			notes: `<p>tanh′(<i>z</i>) = 1 − tanh²(<i>z</i>) = 1 − <i>a</i>²: the network already has <i>a</i> from the forward pass. A neuron whose output is pinned near −1 or 1 has a slope near 0 and passes almost no error back. With several neurons in the next layer, a neuron adds up the signals from all of them: δ = (Σ <i>w</i> δ<sub>next</sub>) × f′(<i>z</i>).</p>`
		},
		{
			id: 'update',
			chapter: 'backprop',
			title: 'Every weight takes a step downhill',
			scene: 'backprop',
			hints: { phase: 'update' },
			duration: 24,
			controls: [nextExample],
			body: `
<p>A weight multiplies the input <i>a</i> that flows into it, and it feeds a neuron with error signal δ. So the slope of the loss for that weight is just</p>
<p class="formula"><strong>∂L/∂<i>w</i> = <i>a</i><sub>in</sub> × δ<sub>out</sub></strong></p>
<p>(and for a bias, just δ). One forward pass and one backward pass give the slope for <em>every</em> weight at once. Then each weight takes the <a href="../gradient-descent/#descend">gradient-descent step</a>, <i>w</i> ← <i>w</i> − η × ∂L/∂<i>w</i>, here with η = 0.5. The diagram shows each weight's old value, its slope and its new value. Run the example forward again and its loss is lower.</p>
<p>Check that the slopes are right: nudge one weight by 0.001 and the loss changes by the slope × 0.001 (the readout does it). Press <em>Next example</em> to make the update and move on to the next point; after enough of them the network solves the corners.</p>`,
			notes: `<p>Computing every slope by nudging, as the check does, would need one extra forward pass per weight: billions for a large model. Backpropagation gets all of them for about the cost of two passes. It was popularised for neural networks by David Rumelhart, Geoffrey Hinton and Ronald Williams in 1986.</p>`
		},
		// ------------------------------------------------------------------ training
		{
			id: 'train',
			chapter: 'training',
			title: 'Training: every example, many times over',
			scene: 'network',
			hints: { data: 'circle', layers: 1, neurons: 4, act: 'tanh' },
			duration: 26,
			controls: [learningRate('lr-train', '0.3'), again('again-train')],
			body: `
<p>Real training does those three moves — forward, backward, step — over and over. Here, as in <a href="../gradient-descent/#train">stochastic gradient descent</a>, the 200 points are shuffled and taken in mini-batches of 10: the slopes are averaged over the batch, then every weight steps. One pass through all the examples is an <dfn data-def="One pass of training through all the examples. Training usually takes many epochs.">epoch</dfn>.</p>
<p>Watch the loss fall and the boundary take shape, with each neuron's square changing as its weights move. With η = 0.3 this network gets every point right at epoch 45; with η = 0.03 it takes 387, and with η = 0.01 it has not got there after 500.</p>
<p>Press <em>Train again</em> to start from other random weights: the network ends at the same answer by a different route, and its hidden neurons may share out the work differently. Sometimes a start is unlucky and training gets stuck in a <a href="../gradient-descent/#valleys">local minimum</a>.</p>`,
			notes: `<p>The weights start random on purpose: if every neuron of a layer started with the same weights, they would all get the same error signals and stay identical forever. Their spread is scaled to the number of inputs (Glorot and He initialisation), so that sums stay a sensible size.</p>`
		},
		{
			id: 'playground',
			chapter: 'training',
			title: 'Build your own network',
			scene: 'network',
			hints: {},
			duration: 30,
			controls: [
				data('data-play', 'spiral'),
				layers('layers-play', 2),
				neurons('neurons-play', 6),
				activation('act-play', 'tanh'),
				learningRate('lr-play', '0.3'),
				again('again-play')
			],
			body: `
<p>Everything together. Pick a dataset, build the network layer by layer, and train it. Can you solve the spirals with the fewest neurons? What happens to the four corners with a single hidden neuron? Can you find a learning rate that is too big?</p>
<p>That is a neural network: <strong>layers of simple units, each weighing, adding and squashing; a loss that says how wrong the output is; backpropagation to pass the error back to every weight; and gradient descent to nudge them all, over and over.</strong> Stacking layers is what lets it bend a straight line into almost any shape.</p>
<p>Networks that recognise images, translate text or generate pictures are built from exactly these parts — with millions or billions of weights, inputs made of pixels or words instead of two coordinates, and many layers arranged in cleverer ways.</p>`,
			notes: `<p>The simplifications here: the data are 200 points made up by the computer, the networks are tiny (at most 3 hidden layers of 8), and training is plain mini-batch gradient descent with no tricks. Real training also holds back examples the network never trains on, to check that it has learnt the pattern rather than memorised the points.</p>`
		}
	]
};
