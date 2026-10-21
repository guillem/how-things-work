import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const trees = (v: number) => `${Math.round(v * 100)} trees in every 100 squares`;

const density: Control = {
	type: 'range',
	id: 'density',
	label: 'How thickly the trees are planted',
	min: 0.3,
	max: 0.8,
	step: 0.01,
	default: 0.5,
	format: trees
};

const tally: Control = {
	type: 'range',
	id: 'tally',
	label: 'How thickly all 30 forests are planted',
	min: 0.3,
	max: 0.8,
	step: 0.01,
	default: 0.59,
	format: trees
};

const size: Control = {
	type: 'select',
	id: 'size',
	label: 'Size of the forests (in squares)',
	default: '50',
	options: [
		{ value: '10', label: '10 by 10' },
		{ value: '20', label: '20 by 20' },
		{ value: '50', label: '50 by 50' },
		{ value: '100', label: '100 by 100' },
		{ value: '200', label: '200 by 200' }
	]
};

const firebreak: Control = {
	type: 'range',
	id: 'firebreak',
	label: 'Width of the firebreak',
	min: 0,
	max: 4,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'no firebreak' : v === 1 ? '1 square' : `${v} squares`)
};

const wind: Control = {
	type: 'toggle',
	id: 'wind',
	label: 'Wind from the left',
	default: false
};

const corners: Control = {
	type: 'toggle',
	id: 'corners',
	label: 'Fire also reaches trees touching a corner',
	default: false
};

const relight: Control = {
	type: 'action',
	id: 'relight',
	label: 'Fire',
	action: 'Light it again'
};

export const spec: ExplainerSpec = {
	slug: 'forest-fire-spread',
	title: 'How a wildfire crosses a forest, or stops',
	summary:
		'Light one edge of a forest and watch the fire pass from tree to tree. Plant the trees a little more thinly and the fire that crossed the whole forest dies after a few rows: the change from almost never to almost always is sudden. Then cut a firebreak, add wind, and change the rule.',
	chapters: [
		{ id: 'fire', title: 'Fire on a grid' },
		{ id: 'thick', title: 'Thick or thin' },
		{ id: 'stop', title: 'Stopping a fire' },
		{ id: 'rule', title: 'The rule, not the forest' }
	],
	steps: [
		// ------------------------------------------------------------------ fire
		{
			id: 'forest',
			chapter: 'fire',
			title: 'A forest catches fire',
			scene: 'forest',
			hints: { view: 'forest', density: 0.62 },
			duration: 16,
			body: `
<p>Some wildfires race right across a forest. Others burn a strip at the edge and go out. What makes the difference?</p>
<p>Here is a toy forest, seen from above: a big square cut into 50 by 50 little squares. Each little square either has a tree on it or is bare ground. The fire starts all along the left edge. Watch it spread from tree to tree, leaving ash behind, until it reaches the far side or runs out of trees it can reach.</p>`
		},
		{
			id: 'rule',
			chapter: 'fire',
			title: 'From tree to tree',
			scene: 'forest',
			hints: { view: 'close' },
			duration: 24,
			controls: [relight],
			body: `
<p>Up close, the rule is simple. At every tick of the clock, each burning tree sets fire to the trees touching its sides: above, below, left and right. Then it burns out and turns to ash. The arrows show which trees catch fire next.</p>
<p>Two things stop the fire. Bare ground: fire can’t jump over an empty square. And corners: a tree that touches the fire only at a corner stays green. So a tree can be safe even with fire all around it.</p>`,
			notes: `
<p>This is the rule of the “Fire” model in the NetLogo models library (Uri Wilensky, 1997), which many classrooms use: trees on a square grid, the fire lit along the left edge, spreading north, south, east and west only, with no wind.</p>`
		},
		// ------------------------------------------------------------------ thick
		{
			id: 'density',
			chapter: 'thick',
			title: 'Plant fewer trees',
			scene: 'forest',
			hints: { view: 'forest' },
			duration: 22,
			controls: [density],
			body: `
<p>Now you decide how thickly the forest is planted. For each square, the computer rolls a dice to decide whether it gets a tree, so the slider sets how many squares in every 100 get one, on average.</p>
<p>With 50 trees in every 100 squares, half the squares, the fire gets only a few squares in and goes out: every path is blocked by a gap somewhere. Slide up to 65 and the fire crosses the whole forest. Somewhere in between, things change fast. Moving the slider only adds or removes trees: the rest of the forest stays where it was.</p>`
		},
		{
			id: 'many',
			chapter: 'thick',
			title: 'A coin toss at six in ten',
			scene: 'forest',
			hints: { view: 'tally' },
			duration: 24,
			controls: [tally],
			body: `
<p>One forest is not enough to tell, because each forest is planted by chance. So here are 30 different forests, all planted equally thickly, and each set alight from the left. Each bar shows how far the fire got in one of them. The forest on the left is the first bar.</p>
<p>At 50 trees in every 100 squares, the fire dies near the edge in every one. At 67, it crosses nearly all of them. But at about 59 or 60, it is a coin toss: in roughly half the forests the fire gets right across, and in the other half it doesn’t, even though they are planted equally thickly.</p>`
		},
		{
			id: 'flip',
			chapter: 'thick',
			title: 'From almost never to almost always',
			scene: 'chance',
			hints: { view: 'chance' },
			duration: 26,
			controls: [size],
			body: `
<p>Now do that for many forests at every thickness, and count how often the fire gets across. The line shows the result. It doesn’t climb slowly: it jumps from “almost never” to “almost always”. For forests of 50 by 50 squares, the jump happens between about 56 and 63 trees in every 100 squares.</p>
<p>Change the size of the forests. In small forests the line climbs gently, because luck matters a lot. The bigger the forest, the steeper the jump, and it always happens near 59. For a huge forest it is almost a cliff: a few trees more or fewer in every 100 squares decide whether the fire gets through.</p>`,
			notes: `
<p>Scientists call this <dfn data-def="Something spreading through a grid or network from neighbour to neighbour, and the sudden change at the density where it first gets all the way across.">percolation</dfn>, like water finding a way through ground coffee. For trees on a square grid with this four-neighbour rule, the tipping point of an endlessly big forest is 59.27 trees in every 100 squares. Nobody has found a formula for it; it is known from very big computer experiments like this one (Newman and Ziff, 2000). In such a forest the line would be a perfect step.</p>`
		},
		// ------------------------------------------------------------------ stop
		{
			id: 'firebreak',
			chapter: 'stop',
			title: 'Cut a firebreak',
			scene: 'forest',
			hints: { view: 'forest', density: 0.7 },
			duration: 20,
			controls: [firebreak],
			body: `
<p>This forest is thick, 70 trees in every 100 squares, and the fire crosses it every time. Firefighters can stop a fire by clearing a strip of land in its way, a <dfn data-def="A strip of land cleared of trees and anything else that can burn, so that a fire running into it has nothing to burn.">firebreak</dfn>. Cut one in the middle of the forest and find how wide it has to be.</p>
<p>One square is enough! In this toy, fire only passes between trees that touch, so even the narrowest strip of bare ground stops it.</p>`
		},
		{
			id: 'wind',
			chapter: 'stop',
			title: 'Add wind',
			scene: 'forest',
			hints: { view: 'forest', density: 0.7, firebreak: 1 },
			duration: 22,
			controls: [wind],
			body: `
<p>Wind changes that. In a real fire, wind carries burning bits of wood, called <dfn data-def="Small burning pieces of wood or bark that the wind lifts and carries ahead of a fire, where they can start new fires.">embers</dfn>, ahead of the flames, where they can start new fires. Here the wind blows from the left, and a burning tree can also set fire to the tree one square past its right-hand neighbour.</p>
<p>Turn the wind on, and the fire jumps the firebreak. Against this wind, the firebreak would have to be two squares wide. In real fires, strong winds can carry embers a long way, which is one reason a road or a river doesn’t always stop a wildfire.</p>`
		},
		// ------------------------------------------------------------------ rule
		{
			id: 'corners',
			chapter: 'rule',
			title: 'Change the rule, change the number',
			scene: 'forest',
			hints: { view: 'forest', density: 0.5 },
			duration: 24,
			controls: [corners],
			body: `
<p>Is 59 in every 100 a magic number for forests? No: it belongs to this grid and this rule. Let the fire also reach the trees touching a burning tree at its corners, so that each tree has eight neighbours instead of four. This half-planted forest, where the fire died near the edge, now burns right across. With corners, the coin toss moves down to about 41 trees in every 100 squares.</p>
<p>Real forests aren’t grids, and real fires depend on wind, slopes, how dry the plants are and how much there is to burn, which this toy leaves out. What carries over is the idea: when something can only spread from neighbour to neighbour, there is a tipping point, and close to it, small changes decide whether it gets through.</p>`,
			notes: `
<p>With eight neighbours the tipping point of an endlessly big forest is about 40.7 trees in every 100 squares (Malarz and Galam, 2005). Other grids and other rules each have their own number: trees placed at the corners of a grid of triangles, each linked to its six nearest neighbours, tip at exactly half.</p>`
		},
		{
			id: 'next',
			chapter: 'rule',
			title: 'Read next',
			scene: 'forest',
			hints: { view: 'forest', density: 0.62 },
			duration: 14,
			body: `
<p>A fire that can only pass from tree to tree crosses a big forest almost never or almost always, and the change between the two happens over a narrow band of how thickly the trees are planted.</p>
<p>An illness spreads from person to person in a similar way. The page on <a href="../epidemics/">epidemics</a> shows how an outbreak dies out once enough people are immune, like a fire in a forest with too many gaps. And <a href="../ecosystems/">ecosystems</a> follows animals and plants whose numbers rise and fall together.</p>`
		}
	]
};
