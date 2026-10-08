import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const charge: Control = {
	type: 'range',
	id: 'charge',
	label: 'The big charge',
	min: -30,
	max: 30,
	step: 5,
	default: 10,
	unit: ' nC',
	help: 'Drag the small test charge to feel the force at different distances.'
};

const addPlus: Control = {
	type: 'action',
	id: 'addPlus',
	label: 'Add a positive charge',
	action: 'Add +'
};

const addMinus: Control = {
	type: 'action',
	id: 'addMinus',
	label: 'Add a negative charge',
	action: 'Add −'
};

const resetCharges: Control = {
	type: 'action',
	id: 'resetCharges',
	label: 'Start again',
	action: 'Start again',
	help: 'Drag charges to move them; click one (or press Enter) to flip its sign, Delete to remove it.'
};

const wireCurrent: Control = {
	type: 'range',
	id: 'wireCurrent',
	label: 'Current in the wire',
	min: -10,
	max: 10,
	step: 0.5,
	default: 5,
	unit: ' A',
	help: 'Positive: flowing up out of the page. Negative: down into it.'
};

const coilCurrent: Control = {
	type: 'range',
	id: 'coilCurrent',
	label: 'Current in the coil',
	min: -3,
	max: 3,
	step: 0.1,
	default: 1,
	unit: ' A'
};

const source: Control = {
	type: 'select',
	id: 'source',
	label: 'Show',
	default: 'coil',
	options: [
		{ value: 'coil', label: 'Coil' },
		{ value: 'magnet', label: 'Bar magnet' }
	]
};

const motion: Control = {
	type: 'select',
	id: 'motion',
	label: 'The magnet',
	default: 'swing',
	options: [
		{ value: 'swing', label: 'Swings through' },
		{ value: 'hand', label: 'You move it' }
	],
	help: 'Or grab the magnet and move it yourself.'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Top speed',
	min: 0.1,
	max: 1,
	step: 0.05,
	default: 0.3,
	unit: ' m/s'
};

const turns: Control = {
	type: 'range',
	id: 'turns',
	label: 'Turns of wire',
	min: 50,
	max: 400,
	step: 50,
	default: 200
};

const acFreq: Control = {
	type: 'range',
	id: 'acFreq',
	label: 'How fast coil A’s current alternates',
	min: 0,
	max: 2,
	step: 0.05,
	default: 1,
	unit: ' Hz',
	help: '0 Hz is a steady current.'
};

const drive: Control = {
	type: 'select',
	id: 'drive',
	label: 'Coil A’s current',
	default: 'ac',
	options: [
		{ value: 'ac', label: 'Alternating' },
		{ value: 'hand', label: 'You set it' }
	]
};

const currentA: Control = {
	type: 'range',
	id: 'currentA',
	label: 'Current in coil A (when you set it)',
	min: -2,
	max: 2,
	step: 0.1,
	default: 0,
	unit: ' A',
	help: 'Slide it and watch B’s meter; hold it still and B’s meter falls back to zero.'
};

const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Distance between the coils',
	min: 3,
	max: 10,
	step: 0.5,
	default: 4,
	unit: ' cm'
};

const shake: Control = {
	type: 'toggle',
	id: 'shake',
	label: 'Keep shaking the charge',
	default: true,
	help: 'Stop it and watch the wave already sent travel on by itself.'
};

const band: Control = {
	type: 'select',
	id: 'band',
	label: 'Kind of wave',
	default: 'fm',
	options: [
		{ value: 'fm', label: 'FM radio' },
		{ value: 'micro', label: 'Microwave oven' },
		{ value: 'green', label: 'Green light' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'electromagnetism',
	title: 'Electricity, magnetism and light',
	summary:
		'Place charges and see the field they spread around them, turn a current into a magnet, push a magnet through a coil to make a current — and find out why light is electricity and magnetism keeping each other going.',
	chapters: [
		{ id: 'electric', title: 'Electric fields' },
		{ id: 'magnetic', title: 'Magnetic fields' },
		{ id: 'induction', title: 'Induction' },
		{ id: 'light', title: 'Light' }
	],
	steps: [
		{
			id: 'force',
			chapter: 'electric',
			title: 'Charges push and pull',
			scene: 'charges',
			hints: { phase: 'force', layout: 'single' },
			duration: 22,
			controls: [charge],
			body: `
<p>Electric <dfn data-def="The property of particles such as protons (+) and electrons (−) that makes them push and pull on each other, measured in coulombs (C). 1 nC (a nanocoulomb) is a billionth of a coulomb.">charge</dfn> comes in two kinds, positive and negative. Like charges repel, unlike charges attract — without touching, across empty space.</p>
<p>Drag the small <strong>test charge</strong> (+1 nC) around the big one. The arrow is the force on it. It points straight away from a positive charge and straight towards a negative one, and it weakens fast with distance: at 10 cm from 10 nC the push is 8.99 µN (about 9 µN); twice as far it is a <em>quarter</em> of that, 2.25 µN. This is <dfn data-def="The force between two charges is proportional to each charge and inversely proportional to the square of the distance between them: F = k q₁ q₂ / r².">Coulomb's law</dfn>.</p>`,
			notes: `<p>F = k q₁ q₂ ÷ r², with k ≈ 8.99 × 10⁹ N·m²/C². Double either charge and the force doubles; double the distance and it falls to a quarter (the "inverse square"). The same law, with gravity's much weaker constant, holds between masses.</p>`
		},
		{
			id: 'field',
			chapter: 'electric',
			title: 'The electric field',
			scene: 'charges',
			hints: { phase: 'field', layout: 'dipole' },
			duration: 30,
			controls: [addPlus, addMinus, resetCharges],
			body: `
<p>Instead of asking what pushes on what, picture each charge changing the space around it. The <dfn data-def="The force a +1 coulomb charge would feel at each point, in newtons per coulomb (N/C). It exists whether or not a charge is there to feel it.">electric field</dfn> is the force a test charge <em>would</em> feel at each point, per coulomb. Charges create fields; fields push on charges.</p>
<p><dfn data-def="Curves that follow the direction of the field everywhere. They start on positive charges, end on negative ones, never cross, and crowd together where the field is strong.">Field lines</dfn> draw it: they leave positive charges, end on negative ones, and crowd together where the field is strong. The test charge's arrow always lies along them. Add charges, drag them and flip their signs, and watch the whole pattern rearrange.</p>`,
			notes: `<p>A field line shows the direction of the force, not a path: a released charge speeds up along the force and, carrying its momentum, drifts off the curved lines. The lines here are drawn in the flat plane of the charges; in three dimensions it is the number of lines per area that measures the strength, so their spacing on a flat slice is only a guide.</p>`
		},
		{
			id: 'wire',
			chapter: 'magnetic',
			title: 'Moving charges make a magnetic field',
			scene: 'magnetic',
			hints: { phase: 'wire' },
			duration: 24,
			controls: [wireCurrent],
			body: `
<p>A current is charge on the move (that's what flows round a circuit). In 1820 Hans Christian Ørsted noticed that a wire carrying a current turns a nearby compass needle: <strong>moving charges create a <dfn data-def="The field that pushes on moving charges and on magnets, measured in teslas (T); a microtesla (µT) is a millionth of a tesla.">magnetic field</dfn></strong>.</p>
<p>Seen from above, the wire's field runs in circles around it. Each compass lines up with the sum of the wire's field and the Earth's, which pulls it north with about 20 µT here. At 5 A the wire's field is 50 µT at 2 cm: close compasses swing round, far ones barely notice. Reverse the current and they all swing the other way; switch it off and they all point north again.</p>`,
			notes: `<p>B = μ₀ I ÷ (2π r): the field grows with the current and falls off as 1 ÷ distance, with μ₀ = 4π × 10⁻⁷ T·m/A. Curl the fingers of your right hand with your thumb along the current, and your fingers show which way the field circles. The 20 µT is the horizontal part of the Earth's field, the part a compass feels, over much of Europe.</p>`
		},
		{
			id: 'coil',
			chapter: 'magnetic',
			title: 'A coil is a magnet',
			scene: 'magnetic',
			hints: { phase: 'coil' },
			duration: 26,
			controls: [coilCurrent, source],
			body: `
<p>Wind the wire into a coil and the circles of field from each turn add up: strong and straight through the middle, looping round outside from one end to the other. One end acts as a north pole, the other as a south pole — an <dfn data-def="A coil of wire that becomes a magnet when a current flows through it, often wound round iron to make it stronger.">electromagnet</dfn>. Reverse the current and the poles swap.</p>
<p>Now switch to a <strong>bar magnet</strong>. Outside, its field is the same shape. That is no coincidence: in a magnet, the electrons in iron atoms each act like a tiny circulating current, and in a magnet they are lined up. Every magnetic field comes from moving charge, and its lines never end: they close on themselves.</p>`,
			notes: `<p>Inside a long coil the field is B = μ₀ n I, where n is the number of turns per metre. The bar magnet here is modelled as exactly that: a uniformly magnetised cylinder (1.2 T, like a neodymium magnet) has the same field as a sheet of current wrapped round its surface. Electrons' "tiny currents" are mostly their spin, a quantum property, but they produce fields exactly as little current loops would.</p>`
		},
		{
			id: 'magnet',
			chapter: 'induction',
			title: 'A moving magnet makes a current',
			scene: 'induction',
			hints: { phase: 'magnet' },
			duration: 30,
			controls: [motion, speed, turns],
			body: `
<p>If currents make magnetic fields, can magnets make currents? In 1831 Michael Faraday found the answer: yes, but only when something <em>changes</em>. Push a magnet into a coil and the meter kicks; hold it still inside and the meter reads zero; pull it out and the meter kicks the other way.</p>
<p>What matters is the <dfn data-def="How much magnetic field passes through a loop: the field times the area it crosses, in webers (Wb).">magnetic flux</dfn> through the coil and how fast it changes. A <strong>changing magnetic field creates an electric field</strong> that circles round it, and that electric field pushes the charges in the wire: this is <dfn data-def="Making a voltage (and so a current) with a changing magnetic field: the voltage equals the rate of change of the flux through the circuit.">electromagnetic induction</dfn>. Move the magnet faster, or wind more turns, and the voltage grows. Grab the magnet yourself: stop moving it and the current stops.</p>`,
			notes: `<p>Faraday's law: voltage = − (number of turns) × (rate of change of flux). The minus sign is <dfn data-def="The induced current always flows so as to oppose the change that caused it.">Lenz's law</dfn>: the induced current makes the coil's near end the same pole as the approaching magnet, so it pushes back, and pulling the magnet away is resisted too. That is why it takes work to make a current, and why it isn't free energy. Here: a 4 cm, 1.2 T magnet through a 200-turn coil 4 cm across, 10 Ω in all; the coil's own inductance is neglected.</p>`
		},
		{
			id: 'neighbour',
			chapter: 'induction',
			title: 'A changing current next door',
			scene: 'induction',
			hints: { phase: 'coils' },
			duration: 30,
			controls: [drive, acFreq, currentA, gap],
			body: `
<p>A magnet isn't needed: a coil with a current is a magnet too. Put coil A next to coil B and set A's current yourself: while you change it, B's meter kicks; hold it steady, however large, and B's meter reads zero. Switch to an alternating current and B's meter swings back and forth with it.</p>
<p>Look closely at the two traces: B's current peaks when A's current is crossing zero, because that is when A's current — and its field — is <em>changing</em> fastest. Alternate faster and the induced voltage grows; move the coils apart and less of A's field passes through B. This is how a <dfn data-def="Two coils sharing a changing magnetic field (usually through an iron core): an alternating voltage in one induces a voltage in the other, stepped up or down by the ratio of their turns.">transformer</dfn> works, and why mains electricity alternates.</p>`,
			notes: `<p>The voltage in B is − M × (rate of change of A's current), where M, the mutual inductance, measures how much of A's field passes through B. Here coil A has 500 turns and carries 2 A, coil B has 200, both 4 cm across; at 1 Hz and 4 cm apart the induced voltage is under 4 millivolts. Mains current alternates 50 or 60 times a second, and transformers wind both coils on one iron core so that nearly all the flux is shared. Faraday's first discovery, in August 1831, was this very effect: switching a current on in one coil wound round an iron ring made a meter on a second coil kick.</p>`
		},
		{
			id: 'light',
			chapter: 'light',
			title: 'Light: two fields that keep each other going',
			scene: 'wave',
			hints: { phase: 'light' },
			duration: 30,
			controls: [band, shake],
			body: `
<p>A changing magnetic field creates an electric field. James Clerk Maxwell realised in the 1860s that the reverse is also true: a changing electric field creates a magnetic field. So shake a charge up and down: its changing electric field makes a changing magnetic field, which makes a changing electric field further out, and so on. The pair travels off on its own as a <dfn data-def="Electric and magnetic fields oscillating together, at right angles to each other and to the direction of travel, moving at the speed of light.">electromagnetic wave</dfn>.</p>
<p>Maxwell calculated its speed from two numbers measured with charges and magnets in the lab, and got about 300,000 km/s: the speed of light. <strong>Light is an electromagnetic wave</strong>. So are radio and microwaves; only the wavelength differs: 3 m for FM radio at 100 MHz, 12 cm for a microwave oven, 555 nm for green light.</p>
<p><strong>Charges create electric fields, moving charges create magnetic fields, and a changing magnetic field creates an electric one. Light is the two fields sustaining each other as a wave.</strong></p>`,
			notes: `<p>c = 1 ÷ √(μ₀ ε₀) = 299,792,458 m/s, and wavelength = c ÷ frequency. In the wave the electric and magnetic fields rise and fall together, in step, at right angles to each other and to the direction of travel; B = E ÷ c. Heinrich Hertz made and detected radio waves in 1887–88, confirming Maxwell's prediction. Visible light spans roughly 400 to 700 nm.</p>`
		}
	]
};
