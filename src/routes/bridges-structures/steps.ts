import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const load: Control = {
	type: 'range',
	id: 'load',
	label: 'Load',
	min: 0,
	max: 100,
	step: 1,
	default: 40,
	unit: ' kN',
	help: '10 kN is roughly the weight of one tonne.'
};

const length: Control = {
	type: 'range',
	id: 'length',
	label: 'Length of the post',
	min: 1,
	max: 6,
	step: 0.1,
	default: 2,
	unit: ' m',
	help: 'The same steel bar: only its length changes.'
};

const drive: Control = {
	type: 'action',
	id: 'drive',
	label: 'Drive the truck across',
	action: 'Drive the truck across',
	help: 'A 30-tonne truck crosses from left to right.'
};

const design: Control = {
	type: 'select',
	id: 'design',
	label: 'Design',
	default: 'beam',
	options: [
		{ value: 'beam', label: 'Beam' },
		{ value: 'truss', label: 'Truss' },
		{ value: 'arch', label: 'Arch' },
		{ value: 'suspension', label: 'Suspension' }
	]
};

const tool: Control = {
	type: 'select',
	id: 'tool',
	label: 'Tool',
	default: 'beam',
	options: [
		{ value: 'beam', label: 'Beam: drag from point to point' },
		{ value: 'cable', label: 'Cable: drag from point to point' },
		{ value: 'erase', label: 'Eraser: click a member' }
	]
};

const resetBridge: Control = {
	type: 'action',
	id: 'resetBridge',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to the bare road.'
};

export const spec: ExplainerSpec = {
	slug: 'bridges-structures',
	title: 'How bridges stand up',
	summary:
		'Drive a truck over beams, trusses, arches and suspension bridges and watch every member pull or push — then build your own bridge from a fixed amount of steel.',
	chapters: [
		{ id: 'forces', title: 'Pulling and pushing' },
		{ id: 'shapes', title: 'Four ways to cross a gap' },
		{ id: 'build', title: 'Build your own' }
	],
	steps: [
		// ------------------------------------------------------------------ forces
		{
			id: 'pullpush',
			chapter: 'forces',
			title: 'Pulled or pushed',
			scene: 'basics',
			hints: { phase: 'axial' },
			duration: 20,
			controls: [load],
			body: `
<p>A bridge has one job: to carry its own weight and the traffic on it across a gap, and pass all of that down into the ground. Every part of it does this in one of two ways.</p>
<p>A rope holding up a weight is <strong>pulled</strong>: it is in <dfn data-def="Being pulled from both ends, so that it is slightly stretched.">tension</dfn>. A post holding up the same weight is <strong>pushed</strong>: it is in <dfn data-def="Being pushed from both ends, so that it is slightly squashed.">compression</dfn>. On this page, tension is drawn blue and compression red; the stronger the colour, the closer the part is to its limit.</p>
<p>By Newton's third law the ground pushes back up as hard as the weight pushes down, so the forces balance and nothing moves.</p>`
		},
		{
			id: 'buckling',
			chapter: 'forces',
			title: 'Pushing has an extra danger',
			scene: 'basics',
			hints: { phase: 'buckle' },
			duration: 22,
			controls: [load, length],
			body: `
<p>Steel is about as strong pulled as pushed. Yet a long, thin bar that is pushed end-on does not wait to be crushed: at a much smaller load it suddenly bows out sideways and folds. This is <dfn data-def="The sudden sideways bending and collapse of a slender member under compression, at a load far below what would crush the material.">buckling</dfn>.</p>
<p>Make the post longer and watch the load it can take fall fast: twice as long, a quarter of the load. A rope or cable can be thin, because pulling only ever straightens it; a part that is pushed has to be thick or short, or braced.</p>`,
			notes: `<p>For a slender bar with pinned ends, the buckling load is π²EI ÷ L² (Euler, 1744): E is the stiffness of the material, I measures how far the material sits from the bar's centre line, and L is its length. That is why columns and struts are made as tubes or I-shapes, with the material spread out.</p>`
		},
		// ------------------------------------------------------------------ shapes
		{
			id: 'beam',
			chapter: 'shapes',
			title: 'A beam bends',
			scene: 'bridge',
			hints: { design: 'beam', phase: 'beam' },
			duration: 24,
			controls: [drive],
			body: `
<p>The simplest bridge is a single <dfn data-def="A straight member that carries loads across its length by bending.">beam</dfn> laid across the gap. Under a load it <strong>bends</strong>: its top is squashed (red) and its bottom stretched (blue), while the material in the middle of its depth does very little.</p>
<p>All the bridges on this page use the same 25 tonnes of steel across the same 40-metre gap, shared out sensibly among their parts. As a beam, it is not enough: as soon as the 30-tonne truck is on it, the steel under the truck is pushed past its limit — about 1.3 times what it can take — and the parts that would fail are marked.</p>`,
			notes: `<p>The drawing exaggerates how far the structures bend, so you can see it. A beam's bending stress grows with the square of the span, which is why plain beams are used for short crossings only.</p>`
		},
		{
			id: 'truss',
			chapter: 'shapes',
			title: 'A truss: triangles',
			scene: 'bridge',
			hints: { design: 'truss', phase: 'truss' },
			duration: 24,
			controls: [drive],
			body: `
<p>Take the same steel and arrange it in <strong>triangles</strong>. A triangle cannot change shape without one of its sides changing length, so instead of bending, each member of a <dfn data-def="A framework of straight members joined in triangles, so that each member is mainly pulled or pushed.">truss</dfn> is mainly pulled or pushed along its length — the way steel works best.</p>
<p>Drive the truck across. The top chord is pushed (red), the bottom chord is pulled (blue), and the diagonals take turns as the truck passes. The busiest member now uses only about a quarter of its strength: the same steel, five times better used.</p>`
		},
		{
			id: 'arch',
			chapter: 'shapes',
			title: 'An arch pushes outwards',
			scene: 'bridge',
			hints: { design: 'arch', phase: 'arch' },
			duration: 24,
			controls: [drive],
			body: `
<p>An <dfn data-def="A curved structure that carries loads mainly by compression, pushing down and outward on its supports.">arch</dfn> turns the weight on it into a push along its curve. Its rib is in compression all along (red), and at its ends it pushes down <em>and outwards</em> on the rock of the gap's walls — which must be strong enough to push back.</p>
<p>That is why the Romans could build arches of stone, a material that is strong when squeezed but cracks when pulled. Here the road is held up on posts standing on the rib. A truck on one side bends the rib a little; the arch works best when the load is spread evenly.</p>`
		},
		{
			id: 'suspension',
			chapter: 'shapes',
			title: 'A suspension bridge hangs',
			scene: 'bridge',
			hints: { design: 'suspension', phase: 'suspension' },
			duration: 24,
			controls: [drive],
			body: `
<p>Turn the arch upside down and you get a hanging cable: everything in it is <strong>pulled</strong>. In a <dfn data-def="A bridge whose road hangs from vertical cables (hangers) attached to main cables that run over towers to anchors in the ground.">suspension bridge</dfn> the road hangs from thin hangers on a main cable, which runs over two towers and down to anchors buried in the banks.</p>
<p>Steel cable is several times stronger than ordinary steel, and pulling never makes it buckle, so the cables can be thin. The towers are pushed down hard (red), and the anchors are pulled. For very long spans — the longest in the world are about 2 kilometres — nothing else comes close.</p>`
		},
		{
			id: 'compare',
			chapter: 'shapes',
			title: 'Shape beats material',
			scene: 'bridge',
			hints: { phase: 'compare' },
			duration: 26,
			controls: [design, drive],
			body: `
<p>Four bridges, one gap, the same 25 tonnes of steel each. The bars show how close each design's busiest member comes to failing as the truck crosses.</p>
<p>The beam fails; the truss, the arch and the suspension bridge all carry the truck with steel to spare. What made the difference was not the amount of material but its <strong>shape</strong>: a good structure carries its loads to the ground mostly by pulling and pushing, not by bending.</p>`,
			notes: `<p>Real bridges are also designed for wind, many vehicles at once, the shaking of moving traffic, fatigue and corrosion, with safety factors on top; none of that is included here. Over a 40 m gap the truss is the most economical of the four — suspension bridges only pay off over much longer spans.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'build',
			chapter: 'build',
			title: 'Build your own bridge',
			scene: 'bridge',
			hints: { phase: 'build', edit: true },
			duration: 40,
			controls: [tool, drive, resetBridge],
			body: `
<p>Your turn: the road alone sags under the truck. Drag between grid points to add beams or cables; anything that touches the ground — the banks, the walls of the gap or its floor — is fixed there. Then drive the truck across.</p>
<p>You always have the same 25 tonnes of steel. Every member you add makes the others thinner, so a member that does nothing is a waste. Try a single pier in the middle; a few triangles; or a cable from a tall post. Can you get every member out of the danger zone?</p>`
		}
	]
};
