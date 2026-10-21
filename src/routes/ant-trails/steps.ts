import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const scent: Control = {
	type: 'toggle',
	id: 'scent',
	label: 'Ants carrying sugar leave a scent',
	default: true,
	help: 'Switch it off and on: the ants start again from the nest each time.'
};

const pebble: Control = {
	type: 'action',
	id: 'pebble',
	label: 'Pebble',
	action: 'Drop a pebble on the trail'
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Colony',
	action: 'Run it again',
	help: 'New ants, the same rules, the same empty bridges.'
};

const fade: Control = {
	type: 'toggle',
	id: 'fade',
	label: 'The scent fades',
	default: false,
	help: 'Switch it on or off: the ants start again from the nest each time.'
};

export const spec: ExplainerSpec = {
	slug: 'ant-trails',
	title: 'How ants find the shortest way',
	summary:
		'A line of ants marches between their nest and a drop of sugar. Nobody leads it. Watch ants wander, find the sugar and lay a scent on the way home, see a trail grow out of it, move the sugar and block the path, then give the colony two bridges and watch it pick the short one.',
	chapters: [
		{ id: 'trail', title: 'A trail appears' },
		{ id: 'bridges', title: 'Two bridges' }
	],
	steps: [
		// ------------------------------------------------------------------ trail
		{
			id: 'line',
			chapter: 'trail',
			title: 'A line of ants',
			scene: 'field',
			hints: { phase: 'line' },
			duration: 14,
			body: `
<p>Leave a drop of sugar on the floor and, before long, a line of ants runs between it and their nest, each ant hurrying along the same narrow path. It looks as if someone planned it.</p>
<p>Nobody did. No ant has a map, no ant is in charge, and the queen, back in the nest, only lays eggs. So how does the line know where to go?</p>`
		},
		{
			id: 'wander',
			chapter: 'trail',
			title: 'Searching at random',
			scene: 'field',
			hints: { phase: 'wander', scent: false },
			duration: 20,
			body: `
<p>Start again with no trail. The ants come out of the nest one after another and wander, turning a little this way and that, at random. Most of them never go near the sugar.</p>
<p>Now and then one bumps into it by luck, picks up a grain and carries it home. In this model a homecoming ant knows the way back. But on its own, that ant’s luck doesn’t help the others: the next ant is just as lost as the first.</p>`
		},
		{
			id: 'scent',
			chapter: 'trail',
			title: 'A scent on the way home',
			scene: 'field',
			hints: { phase: 'scent' },
			duration: 30,
			controls: [scent],
			body: `
<p>Real ants have one more trick. An ant carrying food home dabs a smell on the ground behind it, a chemical message called a <dfn data-def="A chemical an animal releases that changes how others of its kind behave. Ants make trail pheromones to mark a path.">pheromone</dfn>. Other ants smell it with their antennae, and they tend to follow it.</p>
<p>Watch what that does. An ant that crosses a dab of scent follows it, often to the sugar, and carries a grain home, adding more scent. More scent draws more ants, who add more scent. Within a minute or so, most of the colony is on one line. Switch the scent off to compare.</p>`
		},
		{
			id: 'move',
			chapter: 'trail',
			title: 'Move the sugar',
			scene: 'field',
			hints: { phase: 'move' },
			duration: 40,
			body: `
<p>Drag the sugar somewhere else. The ants at the end of the old trail find nothing there, so they carry nothing home and stop adding scent to it.</p>
<p>Real trail scent fades away, and so does it here. Without new dabs, the old trail fades, the ants spread out searching again, and before long a new trail leads to the sugar’s new place. Fading lets the colony forget a route that has stopped leading anywhere.</p>`
		},
		{
			id: 'pebble',
			chapter: 'trail',
			title: 'A pebble on the trail',
			scene: 'field',
			hints: { phase: 'pebble' },
			duration: 30,
			controls: [pebble],
			body: `
<p>Drop a pebble right on the trail. The ants that reach it lose the scent and squeeze round it on one side or the other, and the ones carrying sugar lay new scent as they go.</p>
<p>Soon the trail bends round the pebble, hugging its edge, so the detour adds only a few steps. No ant planned it: it is simply where most of the new scent ended up.</p>`
		},
		// ------------------------------------------------------------------ bridges
		{
			id: 'bridges',
			chapter: 'bridges',
			title: 'Two bridges, the same length',
			scene: 'bridges',
			hints: { phase: 'equal' },
			duration: 40,
			controls: [again],
			body: `
<p>Scientists in Belgium tested this with Argentine ants. They joined the nest to some food with two bridges and counted the ants on each. On these bridges, ants dab scent going both ways, as Argentine ants do.</p>
<p>When the two bridges are the same length, the ants soon crowd onto one of them, but which one is luck: a few more ants happen to take one bridge at the start, it smells a little stronger, and more ants follow. Run it a few times. In the real experiments, too, each bridge won about as often as the other.</p>`
		},
		{
			id: 'shortcut',
			chapter: 'bridges',
			title: 'A short bridge and a long one',
			scene: 'bridges',
			hints: { phase: 'shortcut' },
			duration: 40,
			controls: [again],
			body: `
<p>Now the bottom bridge is twice as long as the top one. At first, the ants choose at random. But the ants on the short bridge reach the sugar first and get back first, so the short bridge gets its scent sooner, and more of the next ants take it.</p>
<p>The colony usually ends up on the short bridge, though in this model not every time: run it again. No ant measured the bridges or compared them. Here the scent never fades at all, so fading is not what picks the short one: getting back sooner is.</p>`
		},
		{
			id: 'late',
			chapter: 'bridges',
			title: 'A shortcut that opens late',
			scene: 'bridges',
			hints: { phase: 'late' },
			duration: 50,
			controls: [fade],
			body: `
<p>This time only the long bridge is there at first. When the colony has made its trail, the short bridge opens. The ants hardly use it: the long bridge smells far stronger, so nearly every ant keeps taking it.</p>
<p>Will fading help? Switch it on and watch. The colony still stays, because every ant that walks the long bridge tops its scent up again, faster than it fades. Real Argentine ants did the same: given the short bridge half an hour late, they kept to the long one.</p>`,
			notes: `
<p>On a trail that is still being walked, the scent is topped up as fast as it fades, so it stays strong and keeps the ants on it. Fading only wins against a trail that nobody walks any more, like the trail to the sugar that moved. In computer programs inspired by ants, the pretend ants lay more scent on shorter routes, and then fading does let them switch to a shortcut that appears later. The ants on this page lay the same dab on every stretch they walk, whatever the length of the bridge.</p>`
		},
		{
			id: 'next',
			chapter: 'bridges',
			title: 'Real ants, and what next',
			scene: 'bridges',
			hints: { phase: 'next' },
			duration: 20,
			body: `
<p>A colony can find a short way to food with no map, and no ant that knows the way: ants on a shorter route get back sooner, so its scent builds up faster and draws more ants. A fading scent lets the colony give up a trail that leads nowhere.</p>
<p>Real ants are cleverer than these ones. Many also use their eyes and memory: some remember landmarks, and desert ants find their way home by the sun and by counting their steps. There are more than 14,000 kinds of ant, and they don’t all use trails the same way.</p>
<p>Computers find shortest routes too, but with a map, checking paths one by one: see <a href="../graph-search/">how a computer finds the shortest route</a>.</p>`
		}
	]
};
