import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { bestIterations } from './qubits';

// ---- one qubit -------------------------------------------------------------------------
// The single qubit's state is its two Bloch angles, in degrees (the overall phase of the
// amplitudes is unobservable). Gates and measurements write the new angles back.

const theta: Control = {
	type: 'range',
	id: 'theta',
	label: 'θ: from |0⟩ (top) to |1⟩ (bottom)',
	min: 0,
	max: 180,
	step: 1,
	default: 60,
	format: (v) => `${Math.round(v)}°`,
	help: 'Or drag the tip of the arrow on the sphere.'
};
const phi: Control = {
	type: 'range',
	id: 'phi',
	label: 'φ: the relative phase, round the equator',
	min: 0,
	max: 359,
	step: 1,
	default: 0,
	format: (v) => `${Math.round(v)}°`
};
const measureOnce: Control = {
	type: 'action',
	id: 'measureOnce',
	label: 'This qubit',
	action: 'Measure it'
};
const measureMany: Control = {
	type: 'action',
	id: 'measureMany',
	label: 'Fresh copies',
	action: 'Prepare and measure 100 copies'
};
const gate = (g: string, help: string): Control => ({
	type: 'action',
	id: `gate${g}`,
	label: `${g} gate`,
	action: g,
	help
});
const gateX = gate('X', '180° about x: the NOT gate.');
const gateH = gate('H', '180° about the axis halfway between x and z.');
const gateZ = gate('Z', '180° about z.');
const gateS = gate('S', '90° about z.');
const gateT = gate('T', '45° about z.');
const reset: Control = {
	type: 'action',
	id: 'reset',
	label: 'Start again',
	action: 'Back to |0⟩'
};

// ---- interference ------------------------------------------------------------------------

const shift: Control = {
	type: 'range',
	id: 'shift',
	label: 'Phase φ between the two H gates',
	min: 0,
	max: 360,
	step: 5,
	default: 0,
	format: (v) => `${Math.round(v)}°`,
	help: 'A phase gate P(φ): Z is 180°, S 90°, T 45°.'
};
const peek: Control = {
	type: 'toggle',
	id: 'peek',
	label: 'Measure in the middle',
	default: false,
	help: 'Records whether the qubit is 0 or 1 between the two gates.'
};

// ---- two qubits --------------------------------------------------------------------------

const pairGate = (id: string, label: string, action: string, help?: string): Control => ({
	type: 'action',
	id,
	label,
	action,
	help
});
const hA = pairGate('hA', 'Qubit A', 'H on A');
const hB = pairGate('hB', 'Qubit B', 'H on B');
const xA = pairGate('xA', 'Qubit A', 'X on A');
const xB = pairGate('xB', 'Qubit B', 'X on B');
const cnotAB = pairGate('cnotAB', 'Both', 'CNOT: A controls B', 'Flips B wherever A is 1.');
const pairReset = pairGate('pairReset', 'Start again', 'Back to |00⟩');
const pairRuns = pairGate('pairRuns', 'Fresh pairs', 'Prepare and measure 100 pairs');
const qubits: Control = {
	type: 'range',
	id: 'qubits',
	label: 'Number of qubits',
	min: 1,
	max: 60,
	step: 1,
	default: 2,
	help: 'How many amplitudes a classical computer must store to simulate them.'
};
const bobAxis: Control = {
	type: 'range',
	id: 'bobAxis',
	label: "Angle of B's measuring axis",
	min: 0,
	max: 180,
	step: 5,
	default: 0,
	format: (v) => `${Math.round(v)}° from A's`,
	help: 'Both axes lie in the x–z plane of the Bloch sphere; A measures along z.'
};

// ---- Grover ------------------------------------------------------------------------------

const marked: Control = {
	type: 'select',
	id: 'marked',
	label: 'The marked string (the answer)',
	default: '5',
	options: Array.from({ length: 8 }, (_, k) => ({
		value: String(k),
		label: k.toString(2).padStart(3, '0')
	}))
};
const OPS = ['the uniform superposition', 'oracle', 'diffusion'];
const ops: Control = {
	type: 'range',
	id: 'ops',
	label: 'Operations applied',
	min: 0,
	max: 6,
	step: 1,
	default: 0,
	format: (v) =>
		v === 0
			? '0: H on every qubit'
			: `${v}: ${OPS[v % 2 === 1 ? 1 : 2]} (iteration ${Math.ceil(v / 2)})`
};
const groverMeasure: Control = {
	type: 'action',
	id: 'groverMeasure',
	label: 'Read the answer',
	action: 'Measure'
};
const gn: Control = {
	type: 'range',
	id: 'gn',
	label: 'Qubits',
	min: 2,
	max: 10,
	step: 1,
	default: 4,
	format: (v) => `${v} (N = ${2 ** v})`
};
const iters: Control = {
	type: 'range',
	id: 'iters',
	label: 'Grover iterations',
	min: 0,
	max: 2 * bestIterations(2 ** 10) + 2,
	bounds: (p) => [0, 2 * bestIterations(2 ** Number(p.gn ?? 4)) + 2],
	step: 1,
	default: 1
};
const bits: Control = {
	type: 'range',
	id: 'bits',
	label: 'Size of the search: N = 2ⁿ items',
	min: 4,
	max: 64,
	step: 1,
	default: 20,
	format: (v) => `n = ${v}`
};

export const spec: ExplainerSpec = {
	slug: 'quantum-computing',
	title: 'Quantum computing',
	summary:
		"Turn a qubit round the Bloch sphere with gates and measure it again and again, entangle two qubits and compare what they say, then step through Grover's search and watch interference pile the probability onto the right answer.",
	chapters: [
		{ id: 'qubit', title: 'One qubit' },
		{ id: 'two', title: 'Two qubits' },
		{ id: 'grover', title: "Grover's search" }
	],
	steps: [
		// ------------------------------------------------------------------ one qubit
		{
			id: 'qubit',
			chapter: 'qubit',
			title: 'A bit with two amplitudes',
			scene: 'bloch',
			hints: { phase: 'state' },
			duration: 22,
			controls: [theta, phi],
			body: `
<p>A bit is 0 or 1. A <dfn data-def="A quantum system with two basis states, |0⟩ and |1⟩, used to store information: an electron's spin, two levels of an ion, a current in a superconducting loop.">qubit</dfn> is a quantum object with two basic states, written |0⟩ and |1⟩, and like every quantum object it is described by <a href="../quantum-mechanics/#amplitudes">probability amplitudes</a>: one complex number for each:</p>
<p class="formula"><strong>|ψ⟩ = α|0⟩ + β|1⟩</strong>, &nbsp; with |α|² + |β|² = 1</p>
<p>Two complex numbers are four real ones, but the constraint removes one, and the overall phase (turning α and β together) changes nothing you can ever observe, so a second goes too. Two angles are left: α = cos(θ/2) and β = e<sup>iφ</sup> sin(θ/2). They place the state on the <dfn data-def="A sphere whose points are the states of one qubit: |0⟩ at the north pole, |1⟩ at the south, the even mixtures round the equator, with the relative phase φ as the longitude.">Bloch sphere</dfn>: |0⟩ at the north pole, |1⟩ at the south, and round the equator the even mixtures, which differ only in their relative phase φ.</p>
<p>Drag the arrow. The dials beside the sphere show α and β as arrows, the way the double-slit page drew amplitudes; the page always draws α with zero phase, since only the difference matters.</p>`,
			notes: `<p>Opposite points of the sphere are <em>orthogonal</em> states, not opposite amplitudes: |0⟩ and |1⟩ are at the poles, 180° apart, though as vectors they are 90° apart. That is why the angles are halved, θ/2. The equator points along +x, −x, +y and −y are called |+⟩, |−⟩, |+i⟩ and |−i⟩: (|0⟩ ± |1⟩)/√2 and (|0⟩ ± i|1⟩)/√2.</p>
<p>Real qubits are, for example, two energy levels of a trapped ion, the spin of an electron, the polarisation of a photon, or the direction of a current in a superconducting loop.</p>`
		},
		{
			id: 'measure',
			chapter: 'qubit',
			title: 'A measurement returns one bit',
			scene: 'bloch',
			hints: { phase: 'measure' },
			duration: 24,
			controls: [theta, measureOnce, measureMany],
			body: `
<p>Measure the qubit and you get <strong>one bit</strong>: 0 with probability |α|² = cos²(θ/2), 1 with probability |β|² — <a href="../quantum-mechanics/#measure">Born's rule</a> again. The state then <em>is</em> the answer: the arrow jumps to the pole you found. Measure it again and you get the same bit every time.</p>
<p>So a single qubit never tells you its amplitudes. To see them you need many qubits prepared the same way: <em>Prepare and measure 100 copies</em> builds the statistics, and the counts settle on cos²(θ/2) only slowly, with the scatter of coin tosses.</p>
<p>And this measurement says nothing at all about φ: every point on a circle of latitude gives the same odds. The phase is real — the next steps turn it into odds you can see — but reading 0 or 1 is blind to it.</p>`,
			notes: `<p>“Measuring in the 0/1 basis” means asking whether the arrow points up or down. You can ask along any other axis by turning the sphere first with a gate and then measuring: that is how the phase is read, and how the Bell test below reads its qubits.</p>
<p>The 100 copies are drawn with Born's probabilities by a seeded random generator, so the page gives the same counts each time it is shown; the spread of the counts, about √(100 p(1 − p)), is that of 100 coin tosses.</p>`
		},
		{
			id: 'gates',
			chapter: 'qubit',
			title: 'Gates turn the sphere',
			scene: 'bloch',
			hints: { phase: 'gates' },
			duration: 26,
			controls: [gateX, gateH, gateZ, gateS, gateT, reset],
			body: `
<p>A quantum <dfn data-def="An operation on qubits: a unitary matrix acting on their amplitudes. On one qubit it is a 2 × 2 complex matrix, which turns the Bloch sphere about some axis.">gate</dfn> is a 2 × 2 complex matrix that multiplies the column (α, β). To keep |α|² + |β|² = 1 for every state it must be <dfn data-def="A matrix U with U†U = 1: it keeps the lengths of vectors and so the total probability. Its inverse is its conjugate transpose.">unitary</dfn>, and on the Bloch sphere every such matrix is a <strong>rotation</strong>. Press the buttons and watch the arrow turn about each gate's axis:</p>
<ul>
<li><strong>X</strong>: 180° about x. It swaps |0⟩ and |1⟩: the <a href="../logic-gates/#gates">NOT gate</a>.</li>
<li><strong>Z</strong>: 180° about z. It flips the sign of β. The odds of 0 and 1 don't change; the phase does.</li>
<li><strong>H</strong> (Hadamard): 180° about the axis halfway between x and z. It takes |0⟩ to the equator, (|0⟩ + |1⟩)/√2: an even mixture.</li>
<li><strong>S</strong> and <strong>T</strong>: 90° and 45° about z.</li>
</ul>
<p>Unlike AND or OR, every gate can be undone: a rotation can always be turned back, so no information is ever lost. Press H twice.</p>`,
			notes: `<p>The matrices: X = [[0, 1], [1, 0]], Z = [[1, 0], [0, −1]], H = (1/√2)[[1, 1], [1, −1]], S = [[1, 0], [0, i]], T = [[1, 0], [0, e<sup>iπ/4</sup>]]. Each is e<sup>iγ</sup> R<sub>n</sub>(a), a rotation by a about the axis n times an overall phase γ that has no effect; the tests check every one. A few rotations go a long way: H and T together, repeated, come as close as you like to any rotation of one qubit, and with CNOT (next chapter) they make a <em>universal</em> set for any number of qubits.</p>`
		},
		{
			id: 'interfere',
			chapter: 'qubit',
			title: 'Paths that cancel',
			scene: 'paths',
			hints: { phase: 'paths' },
			duration: 26,
			controls: [shift, peek],
			body: `
<p>Start at |0⟩ and apply H twice. You end at |0⟩, every time. But after the first H the qubit was an even mixture, and the second H turns <em>each</em> of |0⟩ and |1⟩ into an even mixture again. Why does 1 never come out?</p>
<p>Follow the amplitudes along the paths, as on the drawing. There are two ways to end at |1⟩: through |0⟩, with amplitude ½, and through |1⟩, with −½ (H puts a minus sign on |1⟩ → |1⟩). They add to <strong>zero</strong>: the paths to 1 cancel, and the two paths to 0 add to 1. It is the <a href="../quantum-mechanics/#amplitudes">double slit</a> with two gates for slits.</p>
<p>Now put a phase φ on the |1⟩ path, between the gates. The arrows of the paths turn against each other and the odds follow, P(1) = sin²(φ/2): Z (180°) sends the answer to 1 for certain. The phase that no measurement could see has become the answer.</p>
<p>Switch <em>Measure in the middle</em> on: the paths are now told apart, as by the <a href="../quantum-mechanics/#detector">which-slit detector</a>, their probabilities add instead of their amplitudes, and it is 50/50 whatever φ is.</p>`,
			notes: `<p>This is the whole trick of quantum algorithms in miniature: arrange the gates so that the amplitudes of the paths to wrong answers cancel and those to the right answer add. In matrices, H P(φ) H = e<sup>iφ/2</sup>[[cos(φ/2), −i sin(φ/2)], [−i sin(φ/2), cos(φ/2)]]: a rotation about x by φ. The same circuit is a Mach–Zehnder interferometer for photons, with beam splitters for the H gates.</p>`
		},
		// ------------------------------------------------------------------ two qubits
		{
			id: 'register',
			chapter: 'two',
			title: 'Two qubits, four amplitudes',
			scene: 'pair',
			hints: { phase: 'register' },
			duration: 24,
			controls: [hA, hB, xA, xB, pairReset, qubits],
			body: `
<p>Two bits have four values, 00, 01, 10 and 11, and two qubits have <strong>one amplitude for each</strong>: four complex numbers. Three qubits have eight; n qubits have 2ⁿ. A gate on one qubit is still a 2 × 2 matrix, but it mixes the amplitudes in pairs: H on A combines 00 with 10 and 01 with 11.</p>
<p>Apply H to both: all four amplitudes become ½. This state is just “A in an even mixture” and “B in an even mixture” side by side, and each qubit's Bloch arrow is still a full-length arrow of its own: a <dfn data-def="A state of several qubits that is one state for each qubit: its amplitudes are products, a(xy) = a(x)·b(y).">product state</dfn>.</p>
<p>Slide the number of qubits. To simulate them a classical computer has to store all 2ⁿ amplitudes: at 16 bytes each, 30 qubits need 17 GB and 50 qubits 18 petabytes. That is the room a quantum computer works in — but a measurement of n qubits still returns only <strong>n bits</strong>.</p>`,
			notes: `<p>The amplitudes are listed in the order 00, 01, 10, 11, with A the left digit. Where the amplitudes are products, a(xy) = a(x)·b(y), the qubits are independent; with four numbers there is room for states that are not products, which is the next step. Large classical simulations use tricks (tensor networks, sampling) that work for some circuits, but none is known that handles every circuit without the exponential cost.</p>`
		},
		{
			id: 'entangle',
			chapter: 'two',
			title: 'Entanglement: H, then CNOT',
			scene: 'pair',
			hints: { phase: 'entangle' },
			duration: 26,
			controls: [hA, cnotAB, xB, pairReset, pairRuns],
			body: `
<p>The <dfn data-def="Controlled-NOT: a two-qubit gate that flips the target qubit when the control qubit is 1, and does nothing when it is 0. On basis states it computes target ← target XOR control.">CNOT</dfn> gate flips B wherever A is 1. On plain bits it computes B ← A XOR B, the XOR of the <a href="../logic-gates/#half">half adder</a>, but keeps A, so it can be undone.</p>
<p>Apply H to A, then CNOT. The 10 amplitude moves to 11 and the state is</p>
<p class="formula"><strong>(|00⟩ + |11⟩)/√2</strong></p>
<p>No choice of a state for A and a state for B gives this (a product would need a(0)b(1) = 0 but a(0)b(0) and a(1)b(1) both nonzero). The qubits are <dfn data-def="Two systems whose joint state is not one state for each of them: what you find for one depends on what you find for the other.">entangled</dfn>, and neither has a state of its own: watch both Bloch arrows shrink to the centre.</p>
<p>Measure 100 fresh pairs. Each qubit alone is a fair coin, 0 or 1 at random, yet the two results <strong>always agree</strong>: only 00 and 11 ever come up.</p>`,
			notes: `<p>The shrunken arrow is computed: the page takes the partial trace of the two-qubit state over the other qubit, which gives the qubit's own density matrix, and draws its Bloch vector. Its length is 1 for a product state and 0 for this one, a <dfn data-def="One of the four maximally entangled two-qubit states (|00⟩ ± |11⟩)/√2 and (|01⟩ ± |10⟩)/√2, named after John Bell.">Bell state</dfn>. X on B gives (|01⟩ + |10⟩)/√2, which always disagrees.</p>`
		},
		{
			id: 'bell',
			chapter: 'two',
			title: 'Not answers agreed in advance',
			scene: 'pair',
			hints: { phase: 'bell' },
			duration: 26,
			controls: [bobAxis, pairRuns],
			body: `
<p>Two coins could do the last trick: seal “heads, heads” or “tails, tails” in two envelopes at random, and they always agree. Are entangled qubits just answers agreed in advance?</p>
<p>No, and you can test it. Let A be measured along z and turn the axis along which B is measured. The two results agree with probability <strong>cos²(angle/2)</strong>: always at 0°, half the time at 90°, never at 180°. Meanwhile A on its own stays 50/50 whatever B's axis is, so the correlation can't carry a message.</p>
<p>John Bell (1964) showed that answers fixed in advance, for every axis, cannot reproduce this curve. In the form of Clauser, Horne, Shimony and Holt, four correlations measured at two axes on each side add up to a number <strong>S</strong> that pre-agreed answers keep between −2 and 2. The entangled pair reaches <strong>2√2 ≈ 2.83</strong>: the panel measures it from simulated pairs.</p>`,
			notes: `<p>The four settings: A along 0° or 90°, B along 45° or −45° (Bloch angles, which are twice the polariser angles of the photon experiments). S = E(a, b) + E(a, b′) + E(a′, b) − E(a′, b′), with E the average of the product of the two ±1 results. Experiments that closed all the main loopholes, in Delft, Vienna and Boulder in 2015, found the quantum value; the 2022 Nobel Prize in Physics went to Alain Aspect, John Clauser and Anton Zeilinger for this line of work.</p>
<p>For algorithms, entanglement is what lets n qubits use all 2ⁿ amplitudes rather than 2n numbers for n separate qubits; a computation that never entangles can be simulated efficiently on an ordinary computer.</p>`
		},
		// ------------------------------------------------------------------ Grover
		{
			id: 'oracle',
			chapter: 'grover',
			title: 'Asking every question at once?',
			scene: 'grover',
			hints: { phase: 'oracle' },
			duration: 22,
			controls: [marked, groverMeasure],
			body: `
<p>A search with no structure to exploit: among N items exactly one is “marked”, and all you can do is ask a black box, the <dfn data-def="A black box that answers a yes/no question about its input: here, f(x) = 1 for the marked x and 0 for the others. In a quantum circuit it is a gate, and the number of times it is used is the cost of the search.">oracle</dfn>, “is it this one?”. Trying items one by one takes (N + 1)/2 questions on average.</p>
<p>With three qubits there are N = 8 strings. H on each makes all eight amplitudes equal, 1/√8. Now ask the oracle once, as a quantum gate: it flips the <strong>sign</strong> of the marked string's amplitude and leaves the rest alone. In a sense it has checked all eight at once.</p>
<p>But look at the probabilities: unchanged, ⅛ each, because (−a)² = a². <em>Measure</em>, and you get one string, at random: the right one 1 time in 8, no better than a guess. A quantum computer does not try every answer and read off the best one; the answer is hidden in a sign, and it takes interference to turn a sign into odds.</p>`,
			notes: `<p>The sign-flip oracle is built from an ordinary reversible circuit for f, in the way CNOT computes XOR: the gate maps |x⟩|y⟩ to |x⟩|y XOR f(x)⟩, and with the extra qubit y prepared in (|0⟩ − |1⟩)/√2 that leaves |x⟩ multiplied by (−1)<sup>f(x)</sup>. Lov Grover published the algorithm in 1996.</p>`
		},
		{
			id: 'amplify',
			chapter: 'grover',
			title: 'Flip, then reflect about the mean',
			scene: 'grover',
			hints: { phase: 'amplify' },
			duration: 26,
			controls: [ops, marked, groverMeasure],
			body: `
<p>Grover's second ingredient is the <dfn data-def="Grover's diffusion operator: H on every qubit, a sign flip of every string except 0…0, and H on every qubit again. It reflects every amplitude about the mean of all the amplitudes.">diffusion</dfn> step, itself a short circuit (H on every qubit, flip the sign of every string except 000, H again). What it does is simple: it <strong>reflects every amplitude about their mean</strong>, a → 2⟨a⟩ − a.</p>
<p>Step through the operations. After the oracle the marked amplitude is negative and pulls the mean (dashed line) a little down. The reflection then sends the seven wrong amplitudes down, from 0.35 to 0.18, and the marked one far above: from −0.35 to 0.88, a probability of 78%. The wrong answers interfere destructively, the right one constructively.</p>
<p>Repeat, oracle then diffusion: after two rounds the marked string has <strong>94.5%</strong> of the probability. Measure: now it is almost always the answer. Try a third round.</p>`,
			notes: `<p>The amplitudes stay real throughout, so the bars are the amplitudes themselves (above or below the axis); the lower row is their squares. Reflecting about the mean is 2|s⟩⟨s| − 1, with |s⟩ the uniform superposition; the H gates map |s⟩ to |000⟩, where flipping every other sign is easy. The tests check that the circuit and the formula 2⟨a⟩ − a agree.</p>`
		},
		{
			id: 'rotation',
			chapter: 'grover',
			title: 'A rotation, so stop on time',
			scene: 'grover',
			hints: { phase: 'rotation' },
			duration: 26,
			controls: [gn, iters],
			body: `
<p>Why does a third round make it worse? All the wrong strings always share one amplitude, so the state lives in a plane: one axis is “the marked string”, the other “an even mixture of the rest”. The oracle reflects the state in the second axis, the diffusion in the starting state; two reflections make a <strong>rotation</strong>, by 2θ each round, where sin θ = 1/√N.</p>
<p>The state starts at angle θ from “the rest” and climbs towards “marked”. The chance of the right answer is sin²((2k + 1)θ) after k rounds, highest after about <strong>(π/4)√N</strong> rounds. Go past it and the state rotates beyond the axis and the chance falls again; the dots, simulated, follow the curve up and down.</p>
<p>Add qubits: N doubles each time, and the number of rounds needed grows only by √2.</p>`,
			notes: `<p>θ = arcsin(1/√N), and the best k is the integer nearest to π/(4θ) − ½: 1 for N = 4 (which finds the answer with certainty), 2 for N = 8, 3 for N = 16, 25 for N = 1024. Except for special N, the best k leaves a small chance of a wrong answer; checking the result with one ordinary call of f and repeating if needed costs little.</p>`
		},
		{
			id: 'speedup',
			chapter: 'grover',
			title: 'A square root, not magic',
			scene: 'grover',
			hints: { phase: 'speedup' },
			duration: 30,
			controls: [bits],
			body: `
<p>For a million items (2²⁰), Grover needs 804 questions where trial and error needs half a million on average. That is a <strong>quadratic</strong> speed-up, √N against N, and for this kind of search it is the best possible: Bennett, Bernstein, Brassard and Vazirani proved in 1997 that no quantum algorithm can do with fewer than about √N questions.</p>
<p>Bigger gains need problems with structure that interference can exploit. Shor's algorithm (1994) factors large numbers in a time that grows only as a power of their length, far faster than the best known classical method, which would break the <a href="../cryptography/#rsa-keys">RSA keys</a> that secure much of the internet. Simulating molecules and materials is expected to gain a lot too. Most tasks gain little or nothing: sorting needs about N log N comparisons on any computer.</p>
<p><strong>A quantum computer steers amplitudes so that the wrong answers cancel and the right ones reinforce; a measurement returns one outcome, and the algorithm's job is to make it the right one. That gives a large speed-up for a few kinds of problem, and little or none for most.</strong></p>`,
			notes: `<p>Real machines add a cost the counts leave out. Every unwanted interaction with the surroundings records something about the qubits and destroys interference, as the <a href="../quantum-mechanics/#detector">which-slit detector</a> did; protecting a computation needs quantum error correction, with many physical qubits for each reliable one, and gates far slower than a classical chip's. For a quadratic speed-up those overheads can eat the gain; for Shor's they do not. Zalka (1999) showed that Grover's algorithm is exactly optimal; the Ω(N log N) bound for comparison sorting on a quantum computer is due to Høyer, Neerbek and Shi (2001). Against symmetric ciphers, Grover only halves the effective key length, which is why 256-bit keys are recommended.</p>`
		}
	]
};
