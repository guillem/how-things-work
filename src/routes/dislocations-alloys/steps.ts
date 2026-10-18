import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Every step shows the sheared crystal (scene `crystal`). Hints: `setup` (which crystal:
 * `perfect`, `one`, `solutes`, `pileup`, or `pick` for the reader's choice), `view`
 * (`plain`, `bonds`: zoomed on the core with the bonds across the slip plane, `strain`: atoms
 * coloured by how squeezed or stretched they are).
 */

const fraction: Control = {
	type: 'range',
	id: 'fraction',
	label: 'Foreign atoms',
	min: 0,
	max: 10,
	step: 1,
	default: 5,
	unit: ' %',
	help: 'Each change starts a new crystal, sheared from the beginning.'
};

const size: Control = {
	type: 'select',
	id: 'size',
	label: 'Their size',
	default: 'large',
	options: [
		{ value: 'large', label: 'Larger: 12 % bigger than the host' },
		{ value: 'small', label: 'Smaller: 12 % smaller than the host' }
	]
};

const count: Control = {
	type: 'range',
	id: 'count',
	label: 'Dislocations',
	min: 1,
	max: 3,
	step: 1,
	default: 3,
	help: 'Each change starts a new crystal, sheared from the beginning.'
};

const pick: Control = {
	type: 'select',
	id: 'pick',
	label: 'Crystal',
	default: 'solutes',
	options: [
		{ value: 'perfect', label: 'Perfect: no dislocation' },
		{ value: 'one', label: 'Pure, one dislocation' },
		{ value: 'solutes', label: 'Alloy: one dislocation, foreign atoms' },
		{ value: 'pileup', label: 'Dislocations against a hard particle' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'dislocations-alloys',
	title: 'Dislocations: why metals bend and alloys resist',
	summary:
		'Shear a crystal of simulated atoms and watch a defect glide through it one row of bonds at a time, at a few hundredths of the stress a perfect crystal needs; then sprinkle in foreign atoms and drive dislocations into a hard particle, and watch the stress climb.',
	chapters: [
		{ id: 'puzzle', title: 'Too strong to be true' },
		{ id: 'defect', title: 'The defect that lets metals bend' },
		{ id: 'alloys', title: 'Making it harder' }
	],
	steps: [
		// ------------------------------------------------------------------ puzzle
		{
			id: 'perfect',
			chapter: 'puzzle',
			title: 'A perfect crystal is far too strong',
			scene: 'crystal',
			hints: { setup: 'perfect', view: 'plain' },
			duration: 16,
			body: `
<p>A metal is a crystal: its atoms sit in rows, each bonded to its neighbours (see <a href="../semiconductors/">Crystals &amp; semiconductors</a>). Here is a flat crystal of 576 simulated atoms, the same kind of model as the box in <a href="../states-of-matter/">States of matter</a>. The bottom two rows are held still; the top two are a grip that slides to the right at a steady rate, <dfn data-def="Deforming a solid by sliding its top past its bottom, like pushing the top of a pack of cards sideways.">shearing</dfn> the crystal. The gauge on the right shows the <strong>stress</strong>: the sideways force on the grip per length, in units of the crystal's <dfn data-def="The stiffness of a solid against shearing: stress divided by the shear strain it causes, while the deformation is small and springs back. Written G.">shear modulus</dfn> G. Its scale is logarithmic: each mark is ten times the one below.</p>
<p>At first every row tilts a little and every bond stretches a little: the stress climbs in a straight line. The atoms in the shaded column lean with the crystal. Only at about <strong>G/7</strong> do the bonds give way, and then a whole plane of atoms (near the grip) slides over the one below by one atom spacing, all of its bonds breaking at the same moment. The stress collapses, and the loading starts again.</p>
<p>This is the picture of plastic flow most people have: planes of atoms sliding over each other. It gives a crystal's <em>ideal</em> strength, and it is wrong for real metals by a factor of a thousand or more.</p>`,
			notes: `<p>In 1926 Yakov Frenkel estimated the ideal shear strength by treating the resistance of one plane sliding over the next as a sine wave of the slip, which gives about G/2π. This crystal's peak, about 0.15 G, is close to it; more careful calculations for real metals give G/10 to G/30. The simulation here shears this crystal four times faster than the others, to save waiting; the peak does not depend on the rate.</p>
<p>The model: atoms interact with the <dfn data-def="A simple formula for the energy of two neutral atoms at distance r: 4ε[(σ/r)¹² − (σ/r)⁶], a steep repulsion and a weak attraction.">Lennard-Jones</dfn> energy, cut off at 2.5 atom sizes, and move by Newton's laws with a little friction that carries away the heat of each slip. The box repeats sideways: an atom leaving on the right comes back on the left.</p>`
		},
		{
			id: 'measured',
			chapter: 'puzzle',
			title: 'Real metals yield a thousand times sooner',
			scene: 'crystal',
			hints: { setup: 'perfect', view: 'plain', real: true },
			duration: 14,
			body: `
<p>The shear modulus of metals runs from about 20,000 to 150,000 MPa (megapascals: newtons per square millimetre). Planes sliding at once would make them yield at thousands of MPa. Measured on single crystals of pure metals, they start to flow at <strong>0.5 to 10 MPa</strong>: hundreds to tens of thousands of times less. A pure copper wire bends in your fingers.</p>
<p>The band on the gauge marks that range for a metal whose shear modulus is 50,000 MPa. Crystals do not deform by whole planes sliding at once. In 1934 Egon Orowan, Michael Polanyi and G. I. Taylor each proposed the reason: real crystals contain a line defect that lets a plane slip <strong>a little at a time</strong>. Taylor named it a <dfn data-def="A line in a crystal along which the rows of atoms are out of step: an edge dislocation is the edge of an extra half-plane of atoms squeezed in.">dislocation</dfn>.</p>`,
			notes: `<p>Figures from the Wikipedia article "Dislocation" (CC BY-SA 4.0): shear moduli of metals 20,000 to 150,000 MPa, predicted shear strengths 3,000 to 24,000 MPa, measured 0.5 to 10 MPa. The band on the gauge divides 0.5 and 10 MPa by 50,000 MPa (copper's shear modulus is about 48,000 MPa). Strong alloys, such as hardened steels, reach hundreds of MPa: still far below the ideal strength.</p>`
		},
		// ------------------------------------------------------------------ defect
		{
			id: 'dislocation',
			chapter: 'defect',
			title: 'A crystal with an extra half-plane',
			scene: 'crystal',
			hints: { setup: 'one', view: 'plain' },
			duration: 18,
			body: `
<p>Now the same crystal with one flaw. The rows above the dashed <strong>slip plane</strong> hold one atom more than the rows below: an extra half-plane of atoms is wedged in from the top, and it ends at the slip plane. That end is an <dfn data-def="A dislocation whose line runs along the edge of an extra half-plane of atoms. Drawn ⊥: the vertical stroke is the half-plane, the horizontal one the slip plane.">edge dislocation</dfn>, marked ⊥. Around it the rows bend; far from it the crystal is perfect.</p>
<p>Shear it. The gauge stops at about <strong>G/1700</strong>, some 250 times below the perfect crystal's peak, and stays there while the ⊥ glides to the right. Wherever it has passed, the top half has moved one atom spacing over the bottom half: watch the shaded column break into two pieces, one atom apart. When the dislocation has crossed the whole crystal (and come back round from the left: the box repeats sideways), the top has slipped by one full spacing, exactly as if the whole plane had slid, but at a tiny fraction of the stress.</p>`,
			notes: `<p>The step a dislocation leaves behind is its <dfn data-def="The amount and direction of slip a dislocation carries: here one atom spacing, to the right. Written b.">Burgers vector</dfn> b, one atom spacing. The stress at which a dislocation glides through an otherwise perfect lattice is the <dfn data-def="The smallest stress that moves a dislocation through a perfect crystal at zero temperature, set by how the core's energy rises and falls as it passes each row.">Peierls stress</dfn>. In close-packed metals such as copper and aluminium it is tiny, about 10⁻⁵ G; in this flat crystal the run's stress, about G/1700, is mostly the friction that carries the heat away while the core moves.</p>
<p>The box is built the way Osetsky and Bacon (2003) build periodic boxes with one dislocation: the upper half has one more atom per row, and the two halves are squeezed and stretched by about 1.4 % to share the width.</p>`
		},
		{
			id: 'bonds',
			chapter: 'defect',
			title: 'One row of bonds at a time',
			scene: 'crystal',
			hints: { setup: 'one', view: 'bonds' },
			duration: 18,
			body: `
<p>Zoom in on the core, following it as it moves. The lines are the bonds that cross the slip plane: everywhere else each atom just above the plane sits in the hollow between two atoms below, bonded to both. Only around the core are a few atoms out of step, their bonds stretched (orange): there, and only there, bonds are breaking and re-forming.</p>
<p>As the core moves one spacing to the right, the out-of-step atom settles into its hollow and its neighbour is pushed out of step instead: <strong>one row of bonds changes partner at a time</strong>, while all the other bonds of the plane just hold. That is why it takes so little force, the way a ruck in a carpet moves the carpet a little at a time when pushing the whole carpet would not.</p>`,
			notes: `<p>In this model the core is a few atoms wide and glides smoothly. In metals with narrower cores (most body-centred cubic ones, such as iron) the core sits in deep valleys between rows and hops from one to the next, helped by the atoms' heat; that is part of why iron and steel get stronger, and more brittle, in the cold.</p>`
		},
		{
			id: 'field',
			chapter: 'defect',
			title: 'Squeezed above, stretched below',
			scene: 'crystal',
			hints: { setup: 'one', view: 'strain' },
			duration: 16,
			body: `
<p>The colours show how far apart each atom's neighbours are compared with the relaxed crystal. Above the slip plane, where the extra half-plane is wedged in, the crystal is <strong>squeezed</strong> (blue). Below it, where the rows have to spread round the half-plane's end, it is <strong>stretched</strong> (red). The field travels with the core.</p>
<p>That field is what an atom of a different size feels. A larger atom fits better in the stretched region below the core; a smaller one in the squeezed region above. The next step uses it.</p>`
		},
		// ------------------------------------------------------------------ alloys
		{
			id: 'solutes',
			chapter: 'alloys',
			title: 'Foreign atoms snag the dislocation',
			scene: 'crystal',
			hints: { setup: 'solutes', view: 'strain' },
			duration: 22,
			controls: [fraction, size],
			body: `
<p>An <dfn data-def="A metal with atoms of other elements mixed in. When they take the place of host atoms in the crystal, it is a solid solution: copper with zinc is brass, with tin bronze.">alloy</dfn> has foreign atoms scattered among the host's. Here 5 % of the atoms are 12 % larger than the rest (outlined). Each one strains the crystal around it, and when the dislocation's field comes by, the two interact: the core finds spots where it fits better and gets stuck there.</p>
<p>Watch the gauge: the stress must climb, far above the pure crystal's mark, until the core tears free; then it glides to the next snag and the stress drops. The curve becomes a saw. Try smaller atoms, which pin it too, and change how many there are: more foreign atoms, more snags, a higher stress. This is <strong>solid-solution strengthening</strong>: why bronze is harder than copper, and brass harder than both of its metals alone.</p>`,
			notes: `<p>The pinning rises with the size misfit and with the concentration: in Fleischer's and Labusch's theories, as the misfit to a power 3/2 to 4/3 and the concentration to a power 1/2 to 2/3. Real misfits are a few percent; this crystal exaggerates them, and in a flat crystal every foreign atom near the slip plane sits on the dislocation's path, so a few percent of them raise the stress tens of times. Each change of the controls starts a new crystal, with foreign atoms in new random places.</p>`
		},
		{
			id: 'pileup',
			chapter: 'alloys',
			title: 'Dislocations pile up',
			scene: 'crystal',
			hints: { setup: 'pileup', view: 'plain' },
			duration: 22,
			controls: [count],
			body: `
<p>Now three dislocations glide on the same plane towards a <strong>hard particle</strong> (dark): a cluster of atoms that moves as one rigid piece, so a dislocation cannot cut through it. The first one stops in front of it. The others keep coming and close up behind it, held off by the first one's field: a <strong>pile-up</strong>.</p>
<p>With the plane blocked the crystal stops slipping, and the stress climbs steeply, tens of times above the glide stress: the crystal has hardened. Each dislocation in the queue also pushes on the one ahead, so the particle feels more than the applied stress. In the end the crystal next to the particle gives way, and the more dislocations are pushing, the sooner: try one, two and three and compare where the gauge peaks.</p>`,
			notes: `<p>This is the start of <dfn data-def="The rise in the stress needed to keep deforming a metal as it is deformed: dislocations multiply, tangle and pile up against obstacles.">work hardening</dfn>: bend a copper wire back and forth and it gets stiffer, because the deformation creates more and more dislocations that block each other. In a real metal the obstacles are other dislocations, particles and grain boundaries, and in theory the head of a pile-up of n dislocations feels about n times the applied stress (Eshelby, Frank and Nabarro, 1951). Pile-ups against grain boundaries are why metals with smaller grains are stronger. In this crystal the pile-up of three gives way at about 40 % of the stress that one dislocation alone needs. A box this small holds only a short pile-up, and what happens once the crystal gives way next to the particle is not a model of a real metal.</p>`
		},
		{
			id: 'compare',
			chapter: 'alloys',
			title: 'Why metals bend and alloys resist',
			scene: 'crystal',
			hints: { setup: 'pick', view: 'plain', real: true },
			duration: 20,
			controls: [pick],
			body: `
<p>Pick a crystal and shear it. Its stress lands where the gauge's marks say: a perfect crystal near G/7, a pure crystal with a dislocation near G/1700, the alloy in between.</p>
<p>That is the whole story. A crystal with dislocations yields at a small fraction of the stress a perfect one needs, because a dislocation breaks only one row of bonds at a time. Metals are soft because they are full of dislocations: metres of dislocation line in every cubic millimetre of a soft, annealed metal, and up to thousands of kilometres in a hammered one. Metallurgists make them strong not by removing dislocations but by getting in their way: foreign atoms (alloying), particles (precipitation hardening), more dislocations (work hardening) and small grains.</p>`
		}
	]
};
