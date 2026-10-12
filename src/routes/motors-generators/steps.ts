import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const current: Control = {
	type: 'range',
	id: 'current',
	label: 'Current in the coil',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0.75,
	unit: ' A',
	help: 'Positive: into the page in side a, out of it in side b.'
};

const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Angle of the coil',
	min: 0,
	max: 360,
	step: 5,
	default: 60,
	unit: '°',
	help: 'Or drag the coil round by its handle. 0° and 180°: the coil stands across the field.'
};

const voltage: Control = {
	type: 'range',
	id: 'voltage',
	label: 'Battery',
	min: 0,
	max: 6,
	step: 0.5,
	default: 3,
	unit: ' V'
};

const connection: Control = {
	type: 'select',
	id: 'connection',
	label: 'Connected through',
	default: 'commutator',
	options: [
		{ value: 'commutator', label: 'Commutator' },
		{ value: 'slip', label: 'Slip rings' }
	]
};

const start: Control = {
	type: 'select',
	id: 'start',
	label: 'Start the coil',
	default: 'flat',
	options: [
		{ value: 'flat', label: 'Along the field' },
		{ value: 'upright', label: 'Across it (dead point)' }
	]
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Stop the coil and let it go again',
	action: 'Start again'
};

const load: Control = {
	type: 'range',
	id: 'load',
	label: 'Load on the shaft (a brake)',
	min: 0,
	max: 0.08,
	step: 0.01,
	default: 0,
	format: (v) => (v === 0 ? 'none' : `${v.toFixed(2)} N·m·s`)
};

const turning: Control = {
	type: 'select',
	id: 'turning',
	label: 'The coil',
	default: 'steady',
	options: [
		{ value: 'steady', label: 'Turns steadily' },
		{ value: 'hand', label: 'You turn it' }
	],
	help: 'Or grab the crank and turn it yourself.'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Turns per second',
	min: 0,
	max: 3,
	step: 0.1,
	default: 1,
	format: (v) => `${v.toFixed(1)} /s`
};

const role: Control = {
	type: 'select',
	id: 'role',
	label: 'Use the machine as',
	default: 'motor',
	options: [
		{ value: 'motor', label: 'Motor' },
		{ value: 'generator', label: 'Generator' }
	]
};

const MODEL = `The machine in these pictures: a coil of 200 turns, 10 cm by 10 cm, in a uniform 0.25 T field, 4 Ω of resistance in the coil and battery, and a flywheel on the shaft so that it turns slowly enough to watch. The coil's inductance is ignored, so the current switches instantly at the commutator (in real motors this causes sparking at the brushes).`;

export const spec: ExplainerSpec = {
	slug: 'motors-generators',
	title: 'Electric motors and generators',
	summary:
		'Send a current through a coil between two magnets and watch the forces turn it, flip the current every half-turn with a commutator, then crank the same coil by hand and watch it make alternating or direct current.',
	chapters: [
		{ id: 'machine', title: 'The machine' },
		{ id: 'motor', title: 'The motor' },
		{ id: 'generator', title: 'The generator' },
		{ id: 'both', title: 'One machine' }
	],
	steps: [
		{
			id: 'parts',
			chapter: 'machine',
			title: 'A coil between two magnets',
			scene: 'parts',
			duration: 20,
			body: `
<p>Inside almost every electric motor and generator is the same idea: coils of wire and a magnetic field moving relative to each other. The simplest version, the one on this page, is a <dfn data-def="Wire wound round many times in the same direction. Each turn adds to the effect, so a coil of 200 turns feels 200 times the force of one.">coil</dfn> of wire that turns on a <dfn data-def="The rod the coil is fixed to; it turns with the coil and carries the turning out of the machine.">shaft</dfn> between the poles of a magnet.</p>
<p>The coil's two ends have to stay connected to the outside while it spins. They are joined to rings on the shaft, and two springy contacts called <dfn data-def="Blocks of carbon (or copper strips) pressed against the rings on the shaft, so that current can flow into a part that turns.">brushes</dfn> press against the rings. How those rings are made — a <strong>split ring</strong> or two <strong>slip rings</strong> — turns out to matter a great deal.</p>
<p>From the next step on we look straight along the shaft, so the coil's two long sides, <strong>a</strong> and <strong>b</strong>, are seen end-on, as two dots.</p>`,
			notes: `<p>${MODEL} Real machines wind many coils on an iron core and shape the poles to curve round it, which makes the turning far smoother and stronger; one flat coil in a uniform field is the simplest version that shows how they work.</p>`
		},
		{
			id: 'force',
			chapter: 'motor',
			title: 'A current in a magnetic field feels a force',
			scene: 'machine',
			hints: { phase: 'hold' },
			duration: 26,
			controls: [current, angle],
			body: `
<p>A current is moving charge, and a magnetic field pushes on moving charge. A wire carrying a current across a magnetic field feels a <strong>force at right angles both to the wire and to the field</strong>. It grows with the field, the current and the length of wire in the field: <dfn data-def="Force on a straight wire across a magnetic field: field (teslas) × current (amperes) × length (metres), in newtons. For a coil, multiply by the number of turns.">F = B I L</dfn>. With 200 turns and 0.75 A, each side of this coil feels 3.75 N.</p>
<p>The current goes out of the page in one side and into it in the other, so the two forces point in <em>opposite</em> directions: one side is pushed up, the other down. Together they <strong>turn</strong> the coil. Drag the coil round: the forces stay the same size and always point straight up and down, but their turning effect, the <dfn data-def="The turning effect of a force about an axis: the force times its distance from the axis, measured at right angles to the force, in newton-metres (N·m).">torque</dfn>, changes. It is largest when the coil lies along the field, and <strong>zero when the coil stands across it</strong> (0° and 180°): there the forces point straight along the coil, towards or away from the shaft, and cannot turn it. Those are the <dfn data-def="The two positions where the coil stands across the field: the forces on its sides point along the coil, through the shaft, and cannot turn it.">dead points</dfn>.</p>`,
			notes: `<p>Torque = N B I A sin θ, where A is the coil's area and θ the angle between the field and the line at right angles to the coil. With 200 turns, 0.25 T, 0.75 A and a 10 cm × 10 cm coil, the most it can be is 0.375 N·m. Look past 180°: the side that was pushed up is now on the other side of the shaft, so the same forces turn the coil <em>backwards</em>. That is the problem the next steps solve.</p>`
		},
		{
			id: 'stuck',
			chapter: 'motor',
			title: 'Half a turn forward, half a turn back',
			scene: 'machine',
			hints: { phase: 'stuck', connection: 'slip' },
			duration: 22,
			controls: [voltage, restart],
			body: `
<p>Connect a battery through two plain <dfn data-def="Two separate rings on the shaft, each joined to one end of the coil, each with its own brush. Each end of the coil stays connected to the same side of the outside circuit.">slip rings</dfn> and let the coil go. The forces swing it round towards the dead point, it overshoots, and on the far side the same forces pull it back. It rocks to and fro and stops <strong>standing across the field</strong>.</p>
<p>The trouble is that each side of the coil keeps the same current while it changes sides of the shaft. For half a turn the forces push the coil forward; for the next half they push it back. Over a whole turn they cancel out, and the coil settles where they can't turn it at all — while the battery keeps pushing current through it (0.75 A at 3 V) and turns it all into heat.</p>`,
			notes: `<p>The rocking dies away because of friction in the bearings and brushes, and because the moving coil's own induced voltage (see the next steps) drives currents that turn some of the motion into heat. 3 V across the 4 Ω of the coil and battery drives 0.75 A whenever the coil is still.</p>`
		},
		{
			id: 'commutator',
			chapter: 'motor',
			title: 'The commutator: reverse the current every half-turn',
			scene: 'machine',
			hints: { phase: 'spin' },
			duration: 30,
			controls: [connection, voltage, start, restart],
			body: `
<p>The fix is a <dfn data-def="A ring on the shaft split into two halves, one joined to each end of the coil. As the coil turns, each brush slides from one half onto the other, which reverses the current in the coil.">split-ring commutator</dfn>: one ring cut into two halves, each joined to one end of the coil. Every half-turn, just as the coil passes a dead point, the brushes slide across the gaps onto the other halves — and the <strong>current in the coil reverses</strong>.</p>
<p>Now whichever side is on the left always carries current into the page, and whichever is on the right carries it out. The push is always the same way round, and the coil keeps turning. Watch the trace: with a steady battery the torque rises and falls twice a turn but never goes below zero. Switch to slip rings to compare.</p>
<p>Start the coil standing across the field, though, and it never moves: at a dead point there is no torque to start it. Real motors have three or more coils at different angles, so one of them is always ready to push.</p>`,
			notes: `<p>Averaged over a turn, the torque with the commutator is 2/π, about 64%, of its peak; with slip rings it averages exactly zero. The word commutator comes from the Latin <em>commutare</em>, to exchange. Many motors no longer have one: in a "brushless" motor, electronics switch the current in fixed coils around a spinning magnet instead.</p>`
		},
		{
			id: 'backemf',
			chapter: 'motor',
			title: 'Why it stops speeding up',
			scene: 'machine',
			hints: { phase: 'backemf' },
			duration: 30,
			controls: [voltage, load, restart],
			body: `
<p>If the push never reverses, why doesn't the coil spin faster and faster? Because a coil turning in a magnetic field is cutting through the field, and that, as Faraday found, <strong>induces a voltage</strong>. It pushes against the battery, so it is called the <dfn data-def="The voltage a motor's own turning coil induces. It opposes the battery's voltage and grows with the speed.">back emf</dfn>.</p>
<p>The faster the coil turns, the larger the back emf and the smaller the current the battery can drive. It speeds up until the current left over just overcomes friction: at 3 V, about 0.84 turns a second, drawing about 0.32 A on average instead of the 0.75 A it draws standing still. Put a load on the shaft and it slows down, the back emf falls and the current rises to keep it turning. Double the battery and it runs about twice as fast.</p>`,
			notes: `<p>"emf" stands for electromotive force, an old name for a voltage made by a battery or by induction. The back emf is why a motor that is jammed, or just starting, draws a much larger current than when it runs freely, and why a stalled motor can overheat. ${MODEL}</p>`
		},
		{
			id: 'crank',
			chapter: 'generator',
			title: 'Turn the coil and a voltage appears',
			scene: 'machine',
			hints: { phase: 'crank', connection: 'slip' },
			duration: 26,
			controls: [turning, speed],
			body: `
<p>Now take the battery away, connect a voltmeter to the brushes, and turn the coil yourself. Grab the crank and turn it: <strong>while the coil turns, a voltage appears</strong>. Stop, and it is zero. Turn faster, and it is bigger.</p>
<p>This is <dfn data-def="Making a voltage with a changing magnetic field: the voltage equals the rate of change of the flux through the circuit.">electromagnetic induction</dfn>, the effect that made the meter kick when a magnet moved through a coil. As the coil turns, the <dfn data-def="How much magnetic field passes through a loop: the field times the area it crosses, in webers (Wb).">magnetic flux</dfn> through it keeps changing, from the most when it stands across the field to none when it lies along it, and back. A changing flux induces a voltage.</p>`,
			notes: `<p>You can see it as a force on the charges too: as side a moves through the field, the field pushes the electrons in it along the wire, the same force that turns a motor, now acting on charges that are carried along with the wire.</p>`
		},
		{
			id: 'ac',
			chapter: 'generator',
			title: 'Slip rings give alternating current',
			scene: 'machine',
			hints: { phase: 'ac', connection: 'slip' },
			duration: 26,
			controls: [speed, turning],
			body: `
<p>With slip rings, each end of the coil stays wired to the same terminal. The voltage is largest when the coil lies <em>along</em> the field, where its sides cut across the field fastest and the flux is changing fastest; it is <strong>zero at the dead points</strong>, where the sides slide along the field. When side a goes from moving down to moving up, the voltage reverses.</p>
<p>The result is a smooth wave: an <dfn data-def="A current (or voltage) that reverses direction over and over, usually smoothly, as a sine wave.">alternating current</dfn>, one full cycle per turn. Its peak is N B A ω: the turns, the field, the coil's area and how fast it turns, ω (2π for one turn a second). At one turn a second this coil makes 3.14 V; turn twice as fast and the voltage is twice as high <em>and</em> alternates twice as often.</p>
<p>Power-station generators work the same way. Mains electricity goes through 50 full cycles a second in Europe and most of the world, and 60 in North America.</p>`,
			notes: `<p>Voltage = N B A ω sin(ωt), where ω is the angle turned per second, in radians (2π for one turn a second): 200 × 0.25 T × 0.01 m² × 2π/s = 3.14 V. A generator with one pair of poles must turn 3,000 times a minute to make 50 Hz (3,600 for 60 Hz); big generators have a spinning electromagnet inside fixed coils, and slower ones, like those in hydroelectric dams, use many pairs of poles.</p>`
		},
		{
			id: 'dc',
			chapter: 'generator',
			title: 'A commutator gives direct current',
			scene: 'machine',
			hints: { phase: 'dc' },
			duration: 26,
			controls: [connection, speed, turning],
			body: `
<p>Now connect the same coil through the commutator. Every half-turn, just as the coil's voltage passes through zero and is about to reverse, the brushes swap to the other halves of the ring. The coil's own voltage still alternates, but the voltage at the brushes <strong>never changes sign</strong>: it is a <dfn data-def="A current that always flows the same way round a circuit. From a battery it is steady; from a commutator it pulses.">direct current</dfn>.</p>
<p>It isn't steady, though: it pulses from zero to the peak and back twice every turn. A generator built like this is a <dfn data-def="A generator with a commutator, giving direct current.">dynamo</dfn>; many of the first power stations, such as Edison's Pearl Street Station in New York (1882), used dynamos. Machines with many coils and a commutator with many segments smooth the bumps out.</p>`,
			notes: `<p>This is exactly the commutator of the motor, working the other way round: there it flipped the battery's current to keep the push going one way; here it flips the coil's connections to keep the voltage going one way. Switch back to slip rings to see the wave it is folding up.</p>`
		},
		{
			id: 'same',
			chapter: 'both',
			title: 'The same machine, run both ways',
			scene: 'machine',
			hints: { phase: 'same' },
			duration: 30,
			controls: [role],
			body: `
<p>Put the two halves of this story side by side. As a <strong>motor</strong>, a battery drives a current through the coil, the field pushes on it, and the coil turns: electrical energy becomes motion. As a <strong>generator</strong>, you turn the coil, the field pushes the charges in it, and a current flows through the lamp: motion becomes electrical energy.</p>
<p>Look at the forces on the coil's sides when the generator lights the lamp: they point <em>against</em> the turning. The lamp's current makes the coil a motor trying to turn backwards, so it takes work to keep it going — which is why the energy isn't free (<dfn data-def="The induced current always flows so as to oppose the change that caused it.">Lenz's law</dfn>). And the motor's back emf is the generator inside every motor.</p>
<p><strong>A motor and a generator are the same machine run in opposite directions: current in a magnetic field produces motion, and motion in a magnetic field produces current.</strong></p>`,
			notes: `<p>Electric and hybrid cars use this every day: braking, they run their drive motors as generators, which slows the car and charges the battery ("regenerative braking"). Without friction the work you do turning the generator equals the electrical energy delivered to the circuit (the lamp, plus a little that heats the coil's own wire), turn for turn.</p>`
		}
	]
};
