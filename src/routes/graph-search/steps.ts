import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const pace: Control = {
	type: 'range',
	id: 'pace',
	label: 'Search speed',
	min: 2,
	max: 120,
	step: 1,
	default: 24,
	unit: ' cells/s'
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Run by itself',
	default: true,
	help: 'Turn off, then use the replay bar (or its arrow keys) to step one cell at a time.'
};

const brush: Control = {
	type: 'select',
	id: 'brush',
	label: 'Paint',
	default: 'wall',
	options: [
		{ value: 'wall', label: 'Walls' },
		{ value: 'mud', label: 'Mud (slow: costs 5)' },
		{ value: 'ground', label: 'Clear ground' }
	],
	help: 'Click or drag on the map to paint; drag the start (S) and the goal (G) to move them.'
};

const resetMap: Control = {
	type: 'action',
	id: 'resetMap',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to this step’s map.'
};

const estimate: Control = {
	type: 'range',
	id: 'estimate',
	label: 'Trust in the estimate',
	min: 1,
	max: 5,
	step: 0.5,
	default: 1,
	format: (v) => (v === 1 ? '× 1: never too high' : `× ${v}: can be too high`),
	help: 'How much A* multiplies its straight-line guess of the cost still to go.'
};

const roadAlgo: Control = {
	type: 'select',
	id: 'roadAlgo',
	label: 'Method',
	default: 'dijkstra',
	options: [
		{ value: 'dijkstra', label: 'Dijkstra' },
		{ value: 'astar', label: 'A* (straight-line estimate)' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'graph-search',
	title: 'How a computer finds the shortest route',
	summary:
		'Draw walls and mud on a map and watch three search methods spread out from the start — then see how a good guess lets a route planner skip most of the map.',
	chapters: [
		{ id: 'explore', title: 'Exploring a map' },
		{ id: 'cost', title: 'When steps cost different amounts' },
		{ id: 'guess', title: 'A good guess' },
		{ id: 'roads', title: 'Roads' }
	],
	steps: [
		// ------------------------------------------------------------------ explore
		{
			id: 'map',
			chapter: 'explore',
			title: 'A map as a graph',
			scene: 'grid',
			hints: { map: 'open', algo: 'none', phase: 'map' },
			duration: 16,
			controls: [brush, resetMap],
			body: `
<p>How does a sat-nav, a delivery robot or a character in a video game find its way? To a computer, a map is a <dfn data-def="A set of points (nodes) joined by connections (edges). A grid map is a graph whose nodes are the cells and whose edges join neighbouring cells.">graph</dfn>: a set of places, and connections between neighbouring places.</p>
<p>Here the places are the squares of a grid. From any square you can step up, down, left or right — unless there is a wall. The computer can't see the whole map at a glance as you do; it can only look at one square and ask: where can I go from here?</p>
<p>Paint some walls and move the start (S) and the goal (G). In the next steps, three different methods will search this map.</p>`
		},
		{
			id: 'bfs',
			chapter: 'explore',
			title: 'Breadth-first search',
			scene: 'grid',
			hints: { map: 'open', algo: 'bfs', phase: 'bfs' },
			duration: 22,
			controls: [pace, play, brush, resetMap],
			body: `
<p>The simplest systematic method: first look at every square one step from the start, then every square two steps away, then three, and so on — spreading out in rings, like a ripple. This is <dfn data-def="A search that explores all places one step away, then all places two steps away, and so on. It finds the route with the fewest steps.">breadth-first search</dfn>.</p>
<p>The search keeps a list of squares it has found but not yet looked at — the <strong>frontier</strong>, drawn as the bright edge of the ripple. Each square remembers which square it was reached from, so when the goal is reached, the route can be traced back.</p>
<p>Because it explores in order of distance, the first route it finds has the <strong>fewest possible steps</strong>. But look how much of the map it searched to get there.</p>`
		},
		// ------------------------------------------------------------------ cost
		{
			id: 'mud',
			chapter: 'cost',
			title: 'Fewest steps is not always quickest',
			scene: 'grid',
			hints: { map: 'marsh', algo: 'bfs', phase: 'mud' },
			duration: 22,
			controls: [pace, play, brush, resetMap],
			body: `
<p>Now there is a marsh in the way. Walking through mud is slow: each muddy square <strong>costs 5</strong> instead of 1 — think of minutes of travel time.</p>
<p>Breadth-first search counts steps, not costs, so it marches straight through the mud: 15 steps, but a cost of 39. Going round the marsh takes 21 steps and costs only 21. To find the <em>cheapest</em> route, the search has to pay attention to cost.</p>`
		},
		{
			id: 'dijkstra',
			chapter: 'cost',
			title: "Dijkstra's algorithm",
			scene: 'grid',
			hints: { map: 'marsh', algo: 'dijkstra', phase: 'dijkstra' },
			duration: 24,
			controls: [pace, play, brush, resetMap],
			body: `
<p>In 1956 Edsger Dijkstra worked out a fix in about twenty minutes, sitting at a café in Amsterdam: always expand the frontier square with the <strong>lowest cost so far</strong>. The ripple now spreads in rings of equal <em>cost</em> rather than equal steps — fast across open ground, slowly into the mud.</p>
<p>When the goal is taken off the frontier, no cheaper route to it can exist, because every square still waiting already costs at least as much. <dfn data-def="Finds the cheapest route in a graph whose connections have costs (none negative), by always expanding the place with the lowest cost so far.">Dijkstra's algorithm</dfn> finds the route round the marsh, cost 21.</p>
<p>The shading shows the cost to reach each square. Paint more mud and watch the ripple bend round it.</p>`
		},
		// ------------------------------------------------------------------ guess
		{
			id: 'astar',
			chapter: 'guess',
			title: 'A*: aim for the goal',
			scene: 'grid',
			hints: { map: 'marsh', algo: 'astar', phase: 'astar' },
			duration: 24,
			controls: [pace, play, brush, resetMap],
			body: `
<p>Dijkstra's ripple spreads in every direction, even directly away from the goal. A person would aim for the goal. <dfn data-def="A search that expands the place with the lowest (cost so far + estimated cost still to go). With an estimate that never overestimates, it finds the cheapest route, usually after exploring far less.">A*</dfn> (say "A-star", 1968) does that: it expands the square with the lowest <strong>cost so far + an estimate of the cost still to go</strong>.</p>
<p>The estimate here is the number of steps to the goal if there were no walls and no mud. The search now stretches towards the goal and only spreads sideways when something blocks it. It finds the same cheapest route as Dijkstra — after looking at about a quarter as many squares.</p>`
		},
		{
			id: 'estimate',
			chapter: 'guess',
			title: 'An estimate must never be too high',
			scene: 'grid',
			hints: { map: 'marsh', algo: 'astar', phase: 'estimate' },
			duration: 24,
			controls: [estimate, pace, play, resetMap],
			body: `
<p>The guarantee comes from the estimate never being <em>too high</em>. Each step costs at least 1, so "steps to the goal, ignoring walls and mud" can only be equal to or less than the true cost. Such an estimate is called <dfn data-def="An estimate of the remaining cost that is never higher than the true cost. With it, A* is guaranteed to find the cheapest route.">admissible</dfn>.</p>
<p>Trust the estimate more — multiply it by 3 or 5 — and A* rushes even more directly at the goal, looking at fewer squares still. But now the estimate can overestimate: going round the marsh <em>looks</em> too expensive, and A* ends up wading through the mud, on a route costing 39 instead of 21. Faster to find, worse to drive.</p>`,
			notes: `<p>With slow terrain, the estimate must be based on the <em>cheapest</em> terrain: counting each remaining step as a muddy one would often be too high. Games and robots sometimes accept the trade on purpose: a slightly worse route found much faster.</p>`
		},
		{
			id: 'compare',
			chapter: 'guess',
			title: 'Three methods, one map',
			scene: 'race',
			hints: { map: 'mixed', phase: 'race' },
			duration: 26,
			controls: [pace, brush, resetMap],
			body: `
<p>The same map searched three ways, side by side. Breadth-first search finds the route with the fewest steps, whatever it costs. Dijkstra's algorithm finds the cheapest route but explores in every direction. A* finds the cheapest route too, while skipping much of the map.</p>
<p>Paint walls and mud on any of the three maps — they share one map — and compare the squares visited and the cost of each route.</p>`
		},
		// ------------------------------------------------------------------ roads
		{
			id: 'roads',
			chapter: 'roads',
			title: 'From grids to roads',
			scene: 'roads',
			hints: { phase: 'roads' },
			duration: 26,
			controls: [roadAlgo],
			body: `
<p>A road map is a graph too: towns are the places, roads the connections, each with its own length. The same methods work unchanged. Dijkstra's algorithm grows outwards from Ashford in order of distance; A* uses the straight-line distance to Juniper as its estimate — no road can be shorter than a straight line, so the estimate is never too high.</p>
<p>Both find the same shortest route, 473 km; A* gets there after looking at fewer towns. Route planners do this on maps with millions of junctions, with extra tricks such as pre-computed shortcuts along motorways.</p>
<p>Finding a route is a <strong>systematic exploration of a graph</strong>, and a good estimate of the distance still to go lets the search skip most of it.</p>`
		}
	]
};
