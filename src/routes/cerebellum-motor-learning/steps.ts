import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { ONE_RATE } from './model';

const clear: Control = {
	type: 'action',
	id: 'clear',
	label: 'Your reaches so far',
	action: 'Clear my reaches'
};

const retention: Control = {
	type: 'range',
	id: 'A',
	label: 'Retention A',
	min: 0.9,
	max: 1,
	step: 0.001,
	default: ONE_RATE.A,
	format: (v) => v.toFixed(3)
};

const sensitivity: Control = {
	type: 'range',
	id: 'B',
	label: 'Error sensitivity B',
	min: 0,
	max: 0.2,
	step: 0.001,
	default: ONE_RATE.B,
	format: (v) => v.toFixed(3)
};

const oneRate: Control = {
	type: 'toggle',
	id: 'oneRate',
	label: 'Show a single rate for comparison',
	default: true
};

const damage: Control = {
	type: 'range',
	id: 'damage',
	label: 'Patient’s error sensitivity (share of healthy B)',
	min: 0,
	max: 1,
	step: 0.01,
	default: 0.33,
	format: (v) => `${Math.round(v * 100)}%`
};

const ROT = `<dfn data-def="Visuomotor rotation: the cursor on the screen moves in the direction of the hand turned by a fixed angle, here 30° counter-clockwise. In the lab the hand is hidden under a mirror or a screen; here the pointer is hidden over the workspace.">rotated</dfn>`;
const CORR = `<dfn data-def="How far a reach turned against the rotation, in degrees: 0 for a reach straight at the target, 30° for one that cancels the rotation exactly.">correction</dfn>`;
const AFTER = `<dfn data-def="The opposite error that appears when a perturbation people have adapted to is removed: the adapted movement is still being made, now in a world that no longer needs it.">aftereffect</dfn>`;
const CLAMP = `<dfn data-def="Error-clamp trials: the movement is made but the error shown is held at zero (in Smith et al.'s experiment, a force channel guided the hand straight to the target). The learner gets no error to learn from, so only its forgetting shows. Here the cursor is simply hidden, which also removes the error.">error clamp</dfn>`;
const PF = `<dfn data-def="The axons of granule cells, the most numerous neurons of the brain. They run along the folds of the cerebellar cortex and each passes through the fan-shaped dendrites of hundreds of Purkinje cells, carrying a description of the context: where the target is, the arm's state, a copy of the command sent.">parallel fibres</dfn>`;
const CF = `<dfn data-def="An axon from the inferior olive in the brainstem. Each Purkinje cell gets exactly one, wound around its dendrite with hundreds of synapses; one spike of it makes the Purkinje cell fire a burst called a complex spike. Climbing fibres fire only about once a second, and more often after an unexpected error.">climbing fibre</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'cerebellum-motor-learning',
	title: 'The cerebellum & motor learning',
	summary:
		'Reach for targets while the cursor is secretly turned by 30°, and watch your errors shrink and an aftereffect remain; a two-rate error-driven model (Smith, Ghazizadeh & Shadmehr 2006) does the same reaches beside you, and predicts the spontaneous recovery you can then test on your own hand.',
	chapters: [
		{ id: 'hand', title: 'Your own hand' },
		{ id: 'model', title: 'An error-driven learner' },
		{ id: 'brain', title: 'Where the learning happens' }
	],
	steps: [
		// ------------------------------------------------------------------ hand
		{
			id: 'reach',
			chapter: 'hand',
			title: 'Reach for the target',
			scene: 'reach',
			duration: 30,
			controls: [clear],
			body: `
<p>Every reach is a prediction. The brain sends a command to the arm and expects the hand to land on the target; when it doesn't, the miss is an error, and as on <a href="../feedback-control/">the feedback-control page</a> an error can be used to correct. That page corrected within a movement. This one is about correcting the <em>next</em> movement: learning from each miss.</p>
<p>Try it. Press anywhere in the workspace and sweep the pointer, or a finger, outward toward the target: the cursor leaves the start in the direction you move and the reach ends when it crosses the ring. (With a keyboard: focus the workspace, turn your aim with the arrow keys and press Enter.) Make a few quick reaches without slowing down to steer. The chart records how far each one turned away from the target: about zero, with a few degrees of scatter.</p>`,
			notes: `<p>In the laboratory the arm is hidden under a mirror or a screen and the person sees only a cursor; here the mouse pointer is hidden over the workspace, and the cursor copies your movement from wherever you press. The task is fast, “shooting” reaches: the error that teaches is the one at the end of the movement, not one you steer out along the way.</p>`
		},
		{
			id: 'rotate',
			chapter: 'hand',
			title: 'The cursor turns thirty degrees',
			scene: 'reach',
			duration: 40,
			controls: [clear],
			body: `
<p>Now the cursor is ${ROT}: it moves 30° counter-clockwise of your hand. The first reach misses by 30°. Keep reaching, twenty or thirty times. Within a few reaches you hit the target again: your hand turns clockwise to compensate, and the dots of your ${CORR} climb toward the dashed rotation line.</p>
<p>The coloured line is a learner that changes its next reach by a fraction of each error, with the rates fitted to people by Smith, Ghazizadeh and Shadmehr (2006), doing exactly your sequence of reaches. It probably lags behind you at first. Much of your quick early improvement is not that kind of learning: you saw the miss and decided to aim to the side. That deliberate re-aiming is fast and flexible; under it, a slower, implicit learner is adjusting your reaches whether you mean it or not (Taylor, Krakauer and Ivry 2014). The next step separates the two.</p>`,
			notes: `<p>Taylor, Krakauer and Ivry asked people to say where they were aiming before each reach. Under a 45° rotation the reported aim jumped early and then slowly gave way, while the implicit part (hand direction minus reported aim) grew steadily and stayed. The model's rates were fitted to force-field adaptation, a task with little room for re-aiming, so treat the line as the shape of error-driven learning, not as a fit to your hand.</p>`
		},
		{
			id: 'aftereffect',
			chapter: 'hand',
			title: 'Rotation off: aim straight',
			scene: 'reach',
			duration: 40,
			controls: [clear],
			body: `
<p>The rotation is now gone, and the cursor hidden so that you can't correct against it. Aim straight at the target, as you did at the start: drop any trick you were using. Make a dozen reaches.</p>
<p>Your hand probably still turns clockwise: an ${AFTER}, a correction of the same sign as before, which would now put the cursor off on the <em>other</em> side of the target, the opposite of the first error. You know the world is back to normal, and you are trying to aim straight: what remains is not reasoned. It is the implicit, error-driven part, learned, and largely cerebellar. It fades only slowly without feedback; with the cursor visible it would wash out within a few reaches, as the errors teach it back.</p>`,
			notes: `<p>The size of the aftereffect varies from person to person and with the number of reaches before it. Implicit adaptation to a rotation tends to level off at 15–20° or so however large the rotation is (Bond and Taylor 2015; Morehead et al. 2017), and in laboratory tasks it is measured exactly like this: told to stop re-aiming, without visual feedback.</p>`
		},
		// ------------------------------------------------------------------ model
		{
			id: 'error-rule',
			chapter: 'model',
			title: 'Learn a fraction of each error',
			scene: 'model',
			hints: { mode: 'single' },
			duration: 32,
			controls: [retention, sensitivity],
			body: `
<p>The simplest learner that does this keeps one number, its correction <em>x</em>, and updates it after every reach <em>n</em>:</p>
<p class="formula">x(n+1) = A·x(n) + B·e(n),&nbsp;&nbsp; e(n) = f(n) − x(n)</p>
<p>where <em>f</em> is the rotation and <em>e</em> the error the cursor showed. B, the <em>error sensitivity</em>, is the share of each error learned; A, the <em>retention</em>, the share of the correction kept from one reach to the next. This trial-by-trial <em>state-space</em> model is how Thoroughman and Shadmehr (2000) described people adapting their reaches. Under a constant rotation the error shrinks by a factor A − B per reach, so the correction rises exponentially with a time constant of −1/ln(A − B) reaches, and levels off at B·f / (1 − A + B), short of the full rotation, where forgetting balances learning.</p>
<p>With A = 0.99 and B = 0.013 (the single-rate values Smith et al. used for comparison) that is 43 reaches and 17° of 30°. Drag B up and the learner is faster; drag A to 1 and it never forgets, and closes the whole gap.</p>`,
			notes: `<p>It is the delta rule of <a href="../gradient-descent/">gradient descent</a>: B·e is a step down the slope of the squared error ½e², with B as the learning rate and A as weight decay. Unlike <a href="../reinforcement-learning/">reinforcement learning</a>, which only learns whether a move was good, the error here says by how much, and which way, to change. Real error sensitivity is not a constant: it is larger for small errors than for large ones and grows when the errors are consistent (Herzfeld et al. 2014).</p>`
		},
		{
			id: 'two-rates',
			chapter: 'model',
			title: 'A fast learner and a slow one',
			scene: 'model',
			hints: { mode: 'two' },
			duration: 32,
			body: `
<p>Smith, Ghazizadeh and Shadmehr (2006) proposed that two such learners work side by side, both driven by the same error, their corrections added. Fitted to people adapting their reaches to a force field, one is <strong>fast</strong> (B<sub>f</sub> = 0.21: it learns a fifth of every error, but A<sub>f</sub> = 0.59: it forgets 41% of what it knows each reach) and one is <strong>slow</strong> (B<sub>s</sub> = 0.02, A<sub>s</sub> = 0.992).</p>
<p>After ten reaches the fast learner has done most of the work: 13° of correction, 9 of them fast. After 150 the total is 22°, and 18 of those are slow: the slow learner has quietly taken over while the fast one, with less error left to feed on, shrinks. Then the cursor is hidden: the fast part fades within a few reaches, the slow part holds. The aftereffect is mostly the slow learner.</p>`,
			notes: `<p>For rotations, McDougle, Bond and Taylor (2015) found that the fast process tracks the explicit re-aiming people report, and the slow process the implicit part: so the fast learner is not necessarily a cerebellar process, and the slow one is what an aftereffect measures. The fitted values are per trial in a force field; the same equations fitted to rotation, saccade or walking adaptation give other numbers but the same shape.</p>`
		},
		{
			id: 'recovery',
			chapter: 'model',
			title: 'Spontaneous recovery: undone, then back',
			scene: 'model',
			hints: { mode: 'recovery' },
			duration: 36,
			controls: [oneRate],
			body: `
<p>The two rates make a prediction a single learner cannot. Adapt for 150 reaches, then reverse the rotation, −30°, just until the correction is back to zero: 4 reaches. Behaviour is back at baseline, but not the learners: the fast one is at −15°, the slow one still at +14°.</p>
<p>Now hide the errors, an ${CLAMP}. With no error to learn from, each learner simply forgets at its own rate: the fast one within a few reaches, the slow one hardly at all. So the correction comes back by itself, to 13° eight reaches later, the first adaptation reappearing with no rotation to drive it. Smith et al. tested it: their participants' corrections rebounded over the first 10 to 20 clamp trials, as the model predicted. A single learner, back at zero, has nothing left to recover.</p>`,
			notes: `<p>The same split explains <em>savings</em>: relearning after the reversal is faster than the first learning, because the slow learner never let go. The model tests check both. Spontaneous recovery and savings are also why a skill you have unlearned seems to come back by itself, and why a reversal training session is not a clean slate.</p>`
		},
		{
			id: 'recover',
			chapter: 'model',
			title: 'Try it on your own hand',
			scene: 'reach',
			duration: 60,
			controls: [clear],
			body: `
<p>The same protocol, on you. Thirty reaches with the cursor rotated 30° again (notice whether you relearn faster than the first time: <em>savings</em>), then the rotation reverses until your hand is back to straight, then the cursor disappears. Keep reaching with no cursor and aim at the target each time.</p>
<p>The model, doing your exact sequence, predicts a rebound in the hidden block. Whether your hand shows it is a single-person experiment with a few degrees of scatter per reach and a strategy of your own in the mix, so it may or may not: in Smith et al.'s experiment the rebound was clear in the average of 14 people.</p>`
		},
		// ------------------------------------------------------------------ brain
		{
			id: 'circuit',
			chapter: 'brain',
			title: 'The circuit the error rule stands for',
			scene: 'circuit',
			duration: 36,
			body: `
<p>The cerebellum, the folded structure at the back of the brain, holds more than half of the brain's <a href="../neurons/">neurons</a>, wired in a strikingly regular circuit. Its output cells, the Purkinje cells, each receive some 100,000 to 200,000 synapses from ${PF}, carrying the context of the movement, and exactly one ${CF} from the inferior olive. Marr (1969) and Albus (1971) proposed that the climbing fibre is a teacher: when it fires, the parallel-fibre synapses that were just active should change, so the same context produces a different output next time.</p>
<p>Ito and colleagues found the change: parallel-fibre synapses active together with the climbing fibre weaken, long-term depression (Ito and Kano 1982). Climbing fibres fire more after unexpected errors, so the picture maps onto the equation: a climbing-fibre spike is the error e, the weight change it causes is B·e, and the slow drift of the weights back is A. The Purkinje cell then inhibits the deep cerebellar nuclei less, which changes the command sent on.</p>`,
			notes: `<p>What is established: the circuit, the climbing fibres' link to errors, and long-term depression at these synapses. What is not: that this depression is <em>the</em> memory. Mice in which it was blocked still learned some cerebellar tasks (Schonewille et al. 2011), and plasticity is also found at other synapses of the cerebellar cortex and in the deep nuclei, which may hold the slower, lasting part. And the climbing fibres carry more than motor errors. The equation is a summary of behaviour; the circuit is how the cerebellum may implement it, not a proven one-to-one map.</p>`
		},
		{
			id: 'patients',
			chapter: 'brain',
			title: 'When the cerebellum is damaged',
			scene: 'model',
			hints: { mode: 'patients' },
			duration: 32,
			controls: [damage],
			body: `
<p>People with cerebellar damage can reach, and can see their errors, but adapt poorly. Throwing darts through prism glasses that shift the view, patients with cerebellar lesions adapted little or not at all, and had little aftereffect when the prisms came off (Martin et al. 1996). In reaching through a force field, the trial-to-trial changes of patients with cerebellar degeneration hardly followed the error of the previous reach, while patients with Huntington's disease, whose basal ganglia are damaged, adapted from error normally (Smith and Shadmehr 2005).</p>
<p>In the model that is a smaller error sensitivity B. Scaling both of the learners' B to a third, the patient reaches 6° after ten reaches instead of 13, and 14° instead of 22 by the end, with a smaller aftereffect when the cursor is hidden. Move the slider.</p>`,
			notes: `<p>The scaling is illustrative: no study has measured a single factor like this, and cerebellar damage also makes reaches more variable, which this model leaves out. Two different kinds of damage, two different impairments: that dissociation, more than any single result, is the evidence that error-driven adaptation depends on the cerebellum.</p>`
		},
		{
			id: 'strategy',
			chapter: 'brain',
			title: 'Knowing better doesn’t stop it',
			scene: 'model',
			hints: { mode: 'strategy' },
			duration: 36,
			body: `
<p>The implicit learner is not the only one, and it does not take orders. Mazzoni and Krakauer (2006) told people about a 45° rotation and gave them a strategy: aim at the neighbouring target, 45° away. The first reaches hit. Then, over dozens of reaches, the cursor drifted past the target, further and further, though the people were still aiming where they had been told.</p>
<p>The model explains why. The implicit learner does not learn from the gap between cursor and target, which the strategy has closed, but from the gap between where it <em>aimed</em> and where the cursor went: still the full rotation. So it keeps correcting, and its correction adds to the strategy's. Here with a 30° rotation, the target error grows from zero to 22° the other way: as large as the correction the learner reaches without any strategy.</p>`,
			notes: `<p>Patients with cerebellar degeneration, given the same strategy, drifted much less (Taylor, Klemfuss and Ivry 2010): their implicit learner was too weak to undo it. And the cerebellum is not the only site of motor learning: deliberate strategies draw on prefrontal and parietal cortex, learning from reward and success goes through the basal ganglia, and motor cortex stores skills over days. Real people also notice the drift after a while and change their aim; the model's strategy never adjusts.</p>`
		}
	]
};
