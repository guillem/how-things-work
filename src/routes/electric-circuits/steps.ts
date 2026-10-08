import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const closed: Control = {
	type: 'toggle',
	id: 'closed',
	label: 'Switch closed',
	default: true,
	help: 'Or click the switch on the board.'
};

const charges: Control = {
	type: 'select',
	id: 'charges',
	label: 'Show the moving charges as',
	default: 'conventional',
	options: [
		{ value: 'conventional', label: 'Conventional current (+ to −)' },
		{ value: 'electrons', label: 'Electrons (− to +)' }
	]
};

const emf: Control = {
	type: 'range',
	id: 'emf',
	label: 'Battery voltage',
	min: 1.5,
	max: 12,
	step: 1.5,
	default: 6,
	unit: ' V'
};

const ohms: Control = {
	type: 'range',
	id: 'ohms',
	label: 'Resistance',
	min: 3,
	max: 48,
	step: 3,
	default: 12,
	unit: ' Ω'
};

const amps: Control = {
	type: 'range',
	id: 'amps',
	label: 'Current in the wire',
	min: 0,
	max: 3,
	step: 0.1,
	default: 0.5,
	unit: ' A'
};

const s1: Control = { type: 'toggle', id: 's1', label: 'Left switch closed', default: true };
const s2: Control = { type: 'toggle', id: 's2', label: 'Right switch closed', default: true };

const part: Control = {
	type: 'select',
	id: 'part',
	label: 'Part to place',
	default: 'bulb',
	options: [
		{ value: 'wire', label: 'Wire' },
		{ value: 'battery', label: 'Battery' },
		{ value: 'bulb', label: 'Bulb' },
		{ value: 'resistor', label: 'Resistor' },
		{ value: 'switch', label: 'Switch' },
		{ value: 'ammeter', label: 'Ammeter' },
		{ value: 'voltmeter', label: 'Voltmeter' },
		{ value: 'erase', label: 'Eraser' }
	],
	help: 'Click the gap between two pegs to place it there. Click a switch to flip it, a battery to turn it round.'
};

const resetBoard: Control = {
	type: 'action',
	id: 'resetBoard',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to one battery and one bulb.'
};

export const spec: ExplainerSpec = {
	slug: 'electric-circuits',
	title: 'How electric circuits work',
	summary:
		'Wire up batteries, bulbs and switches, watch the charges move and read the meters — and find out why current is never used up.',
	chapters: [
		{ id: 'loop', title: 'A complete loop' },
		{ id: 'energy', title: 'Voltage and resistance' },
		{ id: 'combine', title: 'Series and parallel' },
		{ id: 'build', title: 'Build your own' }
	],
	steps: [
		// ------------------------------------------------------------------ loop
		{
			id: 'loop',
			chapter: 'loop',
			title: 'A complete loop',
			scene: 'board',
			hints: { board: 'simple', phase: 'loop' },
			duration: 18,
			controls: [closed],
			body: `
<p>A battery, a bulb, a switch and some wire. When the switch is closed the bulb lights; open it and the bulb goes out — at once, even though the switch is nowhere near the bulb.</p>
<p>The bulb lights only when there is a <strong>complete loop</strong> from one end of the battery, through the bulb and back to the other end: a <dfn data-def="A closed path that electric charge can flow around.">circuit</dfn>. Opening the switch makes a gap in the loop, and everything stops everywhere.</p>
<p>The dots are moving electric <dfn data-def="Electric charge: the property of particles such as electrons and protons that makes them push and pull on each other. In metal wires, the charges that move are electrons.">charge</dfn>. The flow of charge is the <dfn data-def="The amount of electric charge passing a point each second, measured in amperes (A).">current</dfn>.</p>`
		},
		{
			id: 'current',
			chapter: 'loop',
			title: 'Current is not used up',
			scene: 'board',
			hints: { board: 'ammeters', phase: 'current' },
			duration: 20,
			controls: [closed],
			body: `
<p>An <dfn data-def="A meter that measures the current through it. It is put into the loop, so that the current has to pass through it.">ammeter</dfn> counts how much charge passes it each second, in <strong>amperes</strong> (A). Here there are three: before the bulb, after it, and on the way back to the battery.</p>
<p>They all read the same, 0.50 A. The bulb does <em>not</em> use up current: every bit of charge that goes into it comes out the other side, and the same amount flows past every point of the loop. Charge is never created or destroyed; it just goes round.</p>
<p>What the bulb does take is <strong>energy</strong>, which the charges carry from the battery — the next chapter is about that.</p>`
		},
		{
			id: 'drift',
			chapter: 'loop',
			title: 'Slow charges, instant light',
			scene: 'wire',
			hints: { phase: 'drift' },
			duration: 24,
			controls: [amps, charges],
			body: `
<p>Zoom into the copper wire. It is packed with free <dfn data-def="Tiny, negatively charged particles. In a metal, some of each atom's electrons are free to wander through the whole piece of metal.">electrons</dfn>, jiggling about in all directions at high speed. When a current flows, the whole crowd also <em>drifts</em> slowly along the wire.</p>
<p>How slowly? At 0.5 A in an ordinary 1 mm² wire, the drift is about <strong>0.04 mm per second</strong> — slower than a snail. A single electron would take hours to get from the switch to the bulb.</p>
<p>The bulb still lights at once because the wire is <em>already full</em> of charges. Closing the switch starts all of them moving at practically the same moment, like the links of a bicycle chain: turn the pedals and the back wheel turns at once, even though each link moves slowly.</p>`,
			notes: `<p>Electrons are negative, so they drift from the battery's − end towards its + end. Long before electrons were discovered, the direction of current was defined the other way, from + to −, as if positive charge were moving: the <dfn data-def="The direction positive charge would move: out of the + terminal of a battery, round the circuit and into the − terminal. Electrons in a wire move the opposite way.">conventional current</dfn>. Both describe the same flow; circuit diagrams use the conventional direction. Switch the view to compare. The drift speed is v = I ÷ (n e A): current divided by the number of free electrons per cubic metre (8.5 × 10²⁸ in copper), the charge of each and the wire's cross-section.</p>`
		},
		// ------------------------------------------------------------------ energy
		{
			id: 'voltage',
			chapter: 'energy',
			title: 'Voltage: energy for each charge',
			scene: 'board',
			hints: { board: 'voltmeters', phase: 'voltage' },
			duration: 22,
			controls: [closed],
			body: `
<p>The battery gives energy to the charge passing through it; the bulb turns that energy into light and heat. <dfn data-def="The energy given to (or taken from) each coulomb of charge, measured in volts: 1 volt = 1 joule per coulomb.">Voltage</dfn> measures how much energy each unit of charge gains or loses: a 6-volt battery gives every <dfn data-def="The unit of electric charge: the charge of about 6.2 × 10¹⁸ electrons. One ampere is one coulomb per second.">coulomb</dfn> of charge 6 joules.</p>
<p>The colours show the <em>electric potential</em> along the loop: the wire leaving the battery's + end is "high" (6 V), the wire back to its − end is "low" (0 V). A <dfn data-def="A meter connected across a part, alongside it, that measures the voltage between its two ends. It takes almost no current.">voltmeter</dfn>, connected across a part, reads the difference: 6 V across the battery, 6 V across the bulb, and practically nothing across a piece of wire.</p>
<p>Open the switch: no charge flows, the bulb has no voltage across it, and the whole 6 V now appears across the gap in the switch.</p>`
		},
		{
			id: 'ohm',
			chapter: 'energy',
			title: 'Resistance sets the current',
			scene: 'board',
			hints: { board: 'ohm', phase: 'ohm' },
			duration: 24,
			controls: [emf, ohms],
			body: `
<p>A <dfn data-def="A part that makes it harder for current to flow; its resistance is measured in ohms (Ω).">resistor</dfn> makes it harder for current to flow. How much current a voltage drives through it depends on its <strong>resistance</strong>, measured in ohms (Ω):</p>
<p class="formula">current = voltage ÷ resistance &nbsp;&nbsp; (I = V ÷ R)</p>
<p>This is <dfn data-def="For many materials at constant temperature, the current through them is proportional to the voltage across them: I = V/R.">Ohm's law</dfn>. Double the battery voltage and the current doubles; double the resistance and it halves. 6 V across 12 Ω drives 0.5 A.</p>`
		},
		// ------------------------------------------------------------------ combine
		{
			id: 'series',
			chapter: 'combine',
			title: 'In series: sharing the voltage',
			scene: 'board',
			hints: { board: 'series', phase: 'series' },
			duration: 22,
			body: `
<p>Put two bulbs one after the other in the same loop — <dfn data-def="Parts connected one after another, so that the same current flows through all of them.">in series</dfn>. There is still only one path, so the same current flows through both. But now the charge must get through two resistances, so there is less of it: 0.25 A instead of 0.5 A.</p>
<p>The battery's 6 V is <strong>shared</strong>: each bulb gets 3 V. With half the voltage and half the current, each bulb gets a quarter of the power, and both glow dimly.</p>`,
			notes: `<p>Here the bulbs are treated as fixed 12 Ω resistances. A real filament's resistance falls as it cools, so two real bulbs in series glow a little brighter than this — but still much dimmer than one bulb alone.</p>`
		},
		{
			id: 'parallel',
			chapter: 'combine',
			title: 'In parallel: each gets the full voltage',
			scene: 'board',
			hints: { board: 'parallel', phase: 'parallel' },
			duration: 22,
			body: `
<p>Now give each bulb its own branch — <dfn data-def="Parts connected side by side across the same two points, so that each gets the same voltage and the current divides between them.">in parallel</dfn>. Each branch connects straight across the battery, so each bulb gets the full 6 V and glows as brightly as a bulb on its own, with 0.5 A each.</p>
<p>At the junctions the current splits and joins again: the ammeter by the battery reads 1 A, the sum of the two branches. Nothing is lost at the junctions — but the battery now delivers twice the current and twice the energy each second, so it runs down twice as fast.</p>`
		},
		{
			id: 'switches',
			chapter: 'combine',
			title: 'Wiring a house',
			scene: 'board',
			hints: { board: 'switches', phase: 'switches' },
			duration: 20,
			controls: [s1, s2],
			body: `
<p>The lights in a house are wired in parallel, each with its own switch on its own branch. Turn one off and the others stay on, at full brightness: each branch is its own complete loop through the supply.</p>
<p>In a series string, one gap — a switch, or a broken filament — would put out every bulb in the string.</p>`,
			notes: `<p>Mains electricity is alternating current at 230 V or 120 V, and lethal; the ideas of loops, branches, voltage and current are the same. Never experiment with it.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'build',
			chapter: 'build',
			title: 'Build your own',
			scene: 'board',
			hints: { board: 'starter', phase: 'build', edit: true },
			duration: 40,
			controls: [part, resetBoard, charges],
			body: `
<p>Your turn. Pick a part, then click the gap between two pegs to place it; place a part over another to replace it, or use the eraser. Click a switch to flip it, and a battery to turn it round. Hover over or focus any part to read the current through it and the voltage across it.</p>
<p>Some things to try: two bulbs in series, then in parallel. Two batteries one after the other — and then with one turned round. An ammeter in every branch of a parallel circuit, and check that the currents add up at each junction.</p>
<p>And one thing not to do with a real battery: connect a plain wire straight from one end to the other. With almost no resistance in the way, a huge current flows — a <dfn data-def="A path with almost no resistance between the two ends of a supply, so a dangerously large current flows. Real wires and batteries heat up fast and can catch fire.">short circuit</dfn> — the battery heats up, and the bulbs, bypassed, go out.</p>`
		}
	]
};
