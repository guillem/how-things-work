import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
const tray = (id: string, value: string): Control => ({
	type: 'select',
	id,
	label: 'Tile tray',
	default: value,
	options: [
		{ value: '3', label: 'Equal-sided triangle' },
		{ value: '4', label: 'Square' },
		{ value: '5', label: 'Regular pentagon' },
		{ value: '6', label: 'Regular hexagon' },
		{ value: '8', label: 'Regular octagon' }
	]
});
export const spec: ExplainerSpec = {
	slug: 'shapes-that-tile',
	title: 'Shapes that tile a floor',
	summary:
		'Fit tiles around a corner, find which shapes leave a hole, and bend a square into a tile whose matching edges still fill the floor.',
	chapters: [
		{ id: 'corners', title: 'Around a corner' },
		{ id: 'floor', title: 'Across a floor' }
	],
	steps: [
		{
			id: 'square',
			chapter: 'corners',
			title: 'Start with a floor tile',
			scene: 'tiles',
			hints: { sides: 4 },
			controls: [tray('square', '4')],
			duration: 20,
			body: `<p>A square bathroom tile has four equal sides and four matching corners. Can you cover a whole floor with copies, without gaps or overlaps?</p><p>Tap the orange + at the shared corner to put down another tile. Or focus it and press Enter. Four square corners fit around it, closing one full turn. Once they fit, the floor on the right fills too.</p>`
		},
		{
			id: 'triangle',
			chapter: 'corners',
			title: 'Six little corners',
			scene: 'tiles',
			hints: { sides: 3 },
			controls: [tray('triangle', '3')],
			duration: 20,
			body: `<p>This triangle has three equal sides. Each of its corners is much narrower than a square’s. Tap the corner to add copies, one at a time.</p><p>Six triangles meet with no gap. They fill a full turn, and the same meeting can repeat all across the floor. A covering with no gaps or overlaps is called a <dfn data-def="A covering with shapes that fit together without gaps or overlaps.">tiling</dfn>.</p>`
		},
		{
			id: 'pentagon',
			chapter: 'corners',
			title: 'A gap you cannot fill',
			scene: 'tiles',
			hints: { sides: 5 },
			controls: [tray('pentagon', '5')],
			duration: 22,
			body: `<p>Try this <strong>regular pentagon</strong>: five equal sides, five equal corners. Three copies leave a small gap at the middle. Add a fourth and it overlaps the first.</p><p>However you slide or turn the tiles, that gap never closes. This regular pentagon cannot cover a floor on its own. The right-hand picture keeps that exact gap in view, shaded red. Another pentagon cannot fit into it.</p>`
		},
		{
			id: 'hexagon',
			chapter: 'corners',
			title: 'Three corners close the turn',
			scene: 'tiles',
			hints: { sides: 6 },
			controls: [tray('hexagon', '6')],
			duration: 18,
			body: `<p>A regular hexagon has six matching sides and corners. Its corner is wider again. This time three copies fit exactly.</p><p>Keep repeating that meeting and the floor fills with a honeycomb pattern. The tiles have more sides, but you need fewer of them around a corner.</p>`
		},
		{
			id: 'octagon',
			chapter: 'corners',
			title: 'Nearly is not enough',
			scene: 'tiles',
			hints: { sides: 8 },
			controls: [tray('octagon', '8')],
			duration: 20,
			body: `<p>With regular octagons, two corners leave a hole and a third overlaps. Try the whole tray: only the equal-sided triangle, square and regular hexagon close the turn exactly. Regular shapes with more than six sides have corners too wide for three copies and too narrow for two.</p><p>You might have seen a floor of octagons with <em>small squares between them</em>. That uses two shapes. Here the challenge is to use copies of just one regular shape.</p>`
		},
		{
			id: 'bend',
			chapter: 'floor',
			title: 'Bend an edge, keep the fit',
			scene: 'tiles',
			controls: [
				{
					type: 'range',
					id: 'bend',
					label: 'Bend the edge',
					min: -25,
					max: 25,
					default: 12,
					step: 1,
					format: (v) => (v === 0 ? 'Straight' : v < 0 ? 'S-bend, flipped' : 'S-bend')
				}
			],
			duration: 24,
			body: `<p>Now start with squares again, and bend the right edge of the orange tile; every copy follows. Drag the orange dot or move the slider. Both edges make an S shape, with an outward bend in one half and an inward bend in the other. The left edge bends <em>the same way</em> as the right, so every bulge fits the next tile’s hollow.</p><p>Every copy gets those same two edges. Slide copies alongside each other and there are still no gaps, whatever bend you choose. This is one way artists make surprising repeating tiles: change an edge and copy that change to the opposite edge.</p>`
		},
		{
			id: 'not-all',
			chapter: 'floor',
			title: 'Regular is the important word',
			scene: 'tiles',
			hints: { sides: 5, complete: true },
			duration: 20,
			body: `<p>A <dfn data-def="A polygon whose sides are all equal and whose corners are all equal.">regular</dfn> shape has equal sides <em>and</em> equal corners. Our pentagon was regular. Some pentagons with unequal corners can tile perfectly; so can every triangle and every simple four-sided shape, even when their corners differ. The floor on the right is made of one four-sided tile with four different corners: at every point where tiles meet, one of each corner fits, and together they make a full turn.</p><p>The corner experiment rules out our regular pentagon, not every five-sided tile. For irregular tiles, different corners of the same shape can meet.</p>`
		},
		{
			id: 'next',
			chapter: 'floor',
			title: 'A rule you can see',
			scene: 'tiles',
			hints: { sides: 6, complete: true },
			duration: 18,
			body: `<p>For a floor of matching regular polygons, look at one meeting point: the corners must fill exactly one turn, with no space left and no overlap. Triangles, squares and hexagons do that, and can repeat the fit everywhere.</p><p>Keep exploring shapes in <a href="../why-triangles-are-stiff/">why triangles are stiff</a>, or find out how a full turn measures angles in <a href="../unit-circle/">the unit circle</a>.</p>`
		}
	]
};
