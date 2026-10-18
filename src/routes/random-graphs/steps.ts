import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const degree: Control = {
	type: 'range',
	id: 'c',
	label: 'Average degree c',
	min: 0,
	max: 4,
	step: 0.05,
	default: 0.5,
	format: (v) => v.toFixed(2)
};

/** The same slider for the branching steps, starting above the threshold. */
const branching: Control = { ...degree, id: 'cb', default: 1.5 };

const nodes: Control = {
	type: 'select',
	id: 'nodes',
	label: 'Nodes drawn',
	default: '200',
	options: [
		{ value: '50', label: '50' },
		{ value: '200', label: '200' },
		{ value: '500', label: '500' }
	]
};

const newGraph: Control = { type: 'action', id: 'reroll', label: 'Links', action: 'New graph' };

const newStart: Control = {
	type: 'action',
	id: 'start',
	label: 'Explore',
	action: 'From another node'
};

/** The sizes the sweep compares. */
export const SIZES = [50, 200, 1000, 5000, 20000];

const size: Control = {
	type: 'select',
	id: 'n',
	label: 'Nodes n',
	default: '50',
	options: SIZES.map((n) => ({ value: String(n), label: n.toLocaleString('en-US') }))
};

const spreadSize: Control = {
	type: 'select',
	id: 'spreadN',
	label: 'Nodes n',
	default: '200',
	options: [200, 1000, 5000].map((n) => ({ value: String(n), label: n.toLocaleString('en-US') }))
};

const bond: Control = {
	type: 'range',
	id: 'p',
	label: 'Bonds open, p',
	min: 0,
	max: 1,
	step: 0.01,
	default: 0.45,
	format: (v) => `${Math.round(v * 100)} %`
};

const side: Control = {
	type: 'select',
	id: 'L',
	label: 'Grid',
	default: '20',
	options: [
		{ value: '10', label: '10 × 10' },
		{ value: '20', label: '20 × 20' },
		{ value: '40', label: '40 × 40' }
	]
};

const newGrid: Control = { type: 'action', id: 'regrid', label: 'Bonds', action: 'New grid' };

/**
 * Scenes: `graph` (a drawn G(n, p) coloured by piece; `focus` 'pieces' | 'degree' | 'merge'),
 * `explore` (breadth-first search from one node, level by level), `equation` (S = 1 − e^(−cS)
 * solved graphically), `sweep` (the largest share against c for several n; `focus` 'full' |
 * 'knee' | 'epidemic'), `window` (the largest piece against n, log–log), `spread` (the giant's
 * share over many graphs) and `lattice` (bond percolation on a square grid; `focus` 'grid' |
 * 'dual').
 */
export const spec: ExplainerSpec = {
	slug: 'random-graphs',
	title: 'Random graphs & the giant component',
	summary:
		'Link nodes at random and watch the pieces merge: a giant component appears once each node has about one link, ever more sharply as the graph grows. Then open bonds on a grid until it spans.',
	chapters: [
		{ id: 'graph', title: 'A random graph' },
		{ id: 'why', title: 'Why one link each' },
		{ id: 'size', title: 'Big and small graphs' },
		{ id: 'grid', title: 'On a grid' },
		{ id: 'same', title: 'The same mathematics' }
	],
	steps: [
		// ---------------------------------------------------------------- graph
		{
			id: 'gnp',
			chapter: 'graph',
			title: 'Links by coin toss',
			scene: 'graph',
			hints: { focus: 'pieces' },
			duration: 24,
			controls: [degree, nodes, newGraph],
			body: `
<p>Take <i>n</i> nodes and, for every one of the <i>n</i>(<i>n</i> − 1)/2 pairs, toss a biased coin: with probability <i>p</i> the pair gets a link. This is the <dfn data-def="The random graph G(n, p): n nodes, each pair linked independently with probability p. Named after Paul Erdős and Alfréd Rényi, who studied how it changes as links are added (1959–1960).">Erdős–Rényi random graph</dfn> G(<i>n</i>, <i>p</i>). Each node has <i>n</i> − 1 possible partners, so on average it gets <strong><i>c</i> = <i>p</i>(<i>n</i> − 1)</strong> links: the <dfn data-def="The number of links a node has.">degree</dfn>. The page sets <i>c</i> and works out <i>p</i>.</p>
<p>A <dfn data-def="A largest set of nodes in which every node can reach every other by following links.">connected component</dfn> is a piece of the graph you can walk around without lifting your pen: what a <a href="../graph-search/#bfs">breadth-first search</a> from one node reaches. The colours follow the pieces' sizes; the bars on the right rank the biggest.</p>
<p>At <i>c</i> = 0.5 the graph is dust: single nodes, pairs, short chains, the largest piece a handful of nodes. Raise <i>c</i> slowly.</p>`,
			notes: `<p>Every possible link is given one random number, once, and is present when that number is below <i>p</i>. Raising <i>c</i> therefore only adds links and never reshuffles the others, so the slider shows one graph growing. At every position it is still an honest G(<i>n</i>, <i>p</i>). Erdős and Rényi's own papers added a fixed number <i>m</i> of links chosen at random, G(<i>n</i>, <i>m</i>); Edgar Gilbert introduced the coin-toss version in 1959. For large <i>n</i> the two behave the same, with <i>m</i> ≈ <i>cn</i>/2. The node positions only serve the drawing: each node sits near the nodes it is linked to in the graph with <i>c</i> = 3, and position means nothing in the model.</p>`
		},
		{
			id: 'degree',
			chapter: 'graph',
			title: 'How many links each node has',
			scene: 'graph',
			hints: { focus: 'degree' },
			duration: 24,
			controls: [degree, nodes, newGraph],
			body: `
<p>A node's degree is a count of successes in <i>n</i> − 1 coin tosses: a <dfn data-def="The number of successes in a fixed number of independent tries with the same chance of success.">binomial</dfn> random number. The <a href="../central-limit-theorem/#clt">central limit theorem</a> would turn it into a bell curve if the chance <i>p</i> stayed fixed while <i>n</i> grew. Here it doesn't: <i>p</i> = <i>c</i>/(<i>n</i> − 1) shrinks so that the average stays at <i>c</i>. Many tries, each very unlikely, give the <dfn data-def="The distribution of the number of rare events: the chance of exactly k is e^(−c) c^k / k!, for mean c.">Poisson distribution</dfn> instead: the chance of exactly <i>k</i> links is e<sup>−<i>c</i></sup><i>c</i><sup><i>k</i></sup>/<i>k</i>!.</p>
<p>The bars count the drawn graph's nodes by degree; the dots are Poisson's prediction. At <i>c</i> = 1 more than a third of the nodes (e<sup>−1</sup> ≈ 37 %) have no link at all, and almost nobody has more than four. No node is special: nothing in the degrees warns of what is about to happen.</p>`
		},
		{
			id: 'merge',
			chapter: 'graph',
			title: 'The pieces merge',
			scene: 'graph',
			hints: { focus: 'merge' },
			duration: 30,
			controls: [degree, nodes, newGraph],
			body: `
<p>Now slide <i>c</i> from 0 to 4 and watch the largest piece (coloured as in the key) and its share of all the nodes, plotted on the right as you go.</p>
<p>Up to <i>c</i> ≈ 1 the share stays small: links mostly join small pieces to other small pieces. Around <i>c</i> = 1 the largest pieces start swallowing each other, and soon after one piece holds a large fraction of all the nodes, the <dfn data-def="A connected component containing a fixed fraction of all n nodes, however large n is.">giant component</dfn>. By <i>c</i> = 2 it holds about four nodes in five; the rest is small pieces and isolated nodes, which it absorbs one by one as <i>c</i> keeps rising.</p>
<p>Try 50 nodes and then 500: with few nodes the change is gradual; the next chapters show how it sharpens as the graph grows.</p>`
		},
		// ------------------------------------------------------------------ why
		{
			id: 'explore',
			chapter: 'why',
			title: 'Explore from one node',
			scene: 'explore',
			duration: 24,
			controls: [branching, newStart],
			body: `
<p>Why 1? Run a breadth-first search from one node of a graph with 5,000 nodes. Level 1 is its neighbours: on average <i>c</i> of them. Each of those has on average <i>c</i> <em>new</em> neighbours too (early on, the graph is so big that the search almost never runs into a node it has already seen), so level <i>k</i> holds about <i>c</i><sup><i>k</i></sup> nodes.</p>
<p>That is a <dfn data-def="A population in which every member independently has a random number of children; studied by Francis Galton and Henry Watson in the 1870s to explain why family names die out.">branching process</dfn>, the same as an outbreak's chain of cases. If <i>c</i> &lt; 1, the levels shrink and the search stops after a few: every piece is small. If <i>c</i> &gt; 1, the levels can grow until they fill a share of the whole graph. Can, not must: a search may still die out early by bad luck, from a node that sits in one of the small pieces.</p>
<p>Press the button to start from other nodes. At <i>c</i> = 2 about four starts in five run into the giant; the rest stop within a few levels.</p>`
		},
		{
			id: 'equation',
			chapter: 'why',
			title: "The giant's share",
			scene: 'equation',
			duration: 24,
			controls: [branching],
			body: `
<p>A node lies outside the giant only if none of its links leads into it. Call S the giant's share of the nodes. Each of the other <i>n</i> − 1 nodes is a linked neighbour inside the giant with probability <i>p</i>S, so a node misses all of them with probability (1 − <i>p</i>S)<sup><i>n</i>−1</sup> → e<sup>−<i>c</i>S</sup> for large <i>n</i>. That gives</p>
<p style="text-align:center"><strong>S = 1 − e<sup>−<i>c</i>S</sup></strong></p>
<p>Solve it by drawing both sides against S: the straight line S and the curve 1 − e<sup>−<i>c</i>S</sup>. They always cross at S = 0. The curve leaves 0 with slope <i>c</i>, so when <i>c</i> &gt; 1 it starts above the line and must cross it a second time: that crossing is the giant's share. When <i>c</i> ≤ 1 the curve stays below the line and the only solution is S = 0: no giant.</p>
<p>So the share is 0 up to <i>c</i> = 1 and grows after it: 58 % at <i>c</i> = 1.5, 80 % at 2, 94 % at 3. Just above 1 it rises like 2(<i>c</i> − 1): a corner in the curve, not a jump.</p>`,
			notes: `<p>The same S is the chance that the branching process of the previous step never dies out. Erdős and Rényi proved in 1960 that, as <i>n</i> → ∞, the largest component of G(<i>n</i>, <i>c</i>/<i>n</i>) holds a share of the nodes that tends to S (and the second largest stays of order log <i>n</i>). Physicists call a change like this, where an order parameter (S) leaves zero continuously at a critical point (<i>c</i> = 1), a continuous or second-order <dfn data-def="A sudden change in the large-scale behaviour of a system when a parameter passes a critical value, like water boiling.">phase transition</dfn>.</p>`
		},
		// ----------------------------------------------------------------- size
		{
			id: 'sweep',
			chapter: 'size',
			title: 'Small graphs round the corner',
			scene: 'sweep',
			hints: { focus: 'full' },
			duration: 24,
			controls: [size],
			body: `
<p>The equation is a statement about <em>infinitely large</em> graphs. Real graphs are finite. The page sweeps <i>c</i> from 0 to 4 on graphs of a chosen size, averaging the largest piece's share over many graphs, and draws it against the exact large-<i>n</i> answer (dashed).</p>
<p>With 50 nodes there is no corner at all: the largest piece is already 10 % of a 50-node graph at <i>c</i> = 0.5 (five nodes), and the curve climbs smoothly through <i>c</i> = 1, crossing the dashed line near <i>c</i> = 1.3. A small graph has no sharp threshold. Choose bigger graphs: the curves close in on the dashed one, from above on its left and from below just after the corner.</p>`
		},
		{
			id: 'knee',
			chapter: 'size',
			title: 'The knee sharpens',
			scene: 'sweep',
			hints: { focus: 'knee' },
			duration: 24,
			controls: [size],
			body: `
<p>Zoom in on the corner. Exactly at <i>c</i> = 1 the largest piece is still not a fixed share: its share falls as the graph grows, from 26 % of 50 nodes to 3 or 4 % of 20,000. The knee sharpens toward a corner, but slowly.</p>
<p>The width of the rounded region shrinks like <i>n</i><sup>−1/3</sup>: to halve it you need eight times as many nodes. Inside this <dfn data-def="The range of average degrees c = 1 ± a few × n^(−1/3) in which a random graph's largest pieces are neither small nor giant.">critical window</dfn> the graph is neither dust nor giant, and the largest pieces are comparable in size. The sharp threshold of the previous step is the limit of this sharpening, never reached by any real graph.</p>`,
			notes: `<p>The critical window was found by Béla Bollobás (1984) and Tomasz Łuczak (1990): for <i>c</i> = 1 + λ<i>n</i><sup>−1/3</sup> with λ fixed, the largest components have sizes of order <i>n</i><sup>2/3</sup>, with a random factor that does not settle down as <i>n</i> grows. David Aldous (1997) described their joint limit with a Brownian motion.</p>`
		},
		{
			id: 'window',
			chapter: 'size',
			title: 'Three ways to grow',
			scene: 'window',
			duration: 24,
			body: `
<p>Another view of the same thing: fix <i>c</i> and grow <i>n</i>. Both axes are logarithmic, so a power law <i>n</i><sup><i>a</i></sup> is a straight line of slope <i>a</i>.</p>
<p>At <i>c</i> = 2 the largest piece is proportional to <i>n</i> (slope 1): 80 % of the nodes, whatever their number. At <i>c</i> = 0.5 it barely grows: about (ln <i>n</i> − 2.5 ln ln <i>n</i>)/α, with α = <i>c</i> − 1 − ln <i>c</i>, so about 16 nodes in 4,000 and 26 in 64,000. Exactly at <i>c</i> = 1 it is in between: it grows like <i>n</i><sup>2/3</sup>, a vanishing share of a big graph that is still far larger than any piece below the threshold.</p>`,
			notes: `<p>Each point is the mean over 12 graphs. The logarithm law below the threshold and the <i>n</i><sup>2/3</sup> law at it are Erdős and Rényi's (1960), sharpened by Bollobás; the fitted slopes here come out within a few hundredths of 2/3 and 1.</p>`
		},
		{
			id: 'spread',
			chapter: 'size',
			title: "The giant's size is a bell curve",
			scene: 'spread',
			duration: 24,
			controls: [spreadSize],
			body: `
<p>Above the threshold, how much does the giant's share vary from one graph to the next? Build hundreds of graphs at <i>c</i> = 2 and count the share each time. The histogram is a bell curve centred on S = 0.797, and the bigger the graph, the narrower it is: its standard deviation is about 0.68/√<i>n</i>, so 4.8 % at 200 nodes and under 1 % at 5,000.</p>
<p>This is the same 1/√<i>n</i> as in the <a href="../central-limit-theorem/#clt">central limit theorem</a>, and for a related reason: whether each node lands in the giant is decided by its own neighbourhood, and nodes far apart in the graph decide almost independently. In a large graph the giant's share is predictable to within a fraction of a percent.</p>`,
			notes: `<p>Boris Pittel (1990) proved that the giant's size is asymptotically normal with variance <i>n</i>S(1 − S)/(1 − <i>c</i>(1 − S))². The variance blows up as <i>c</i> → 1, where the critical window takes over and the bell is replaced by a skewed distribution.</p>`
		},
		// ----------------------------------------------------------------- grid
		{
			id: 'lattice',
			chapter: 'grid',
			title: 'Opening bonds on a grid',
			scene: 'lattice',
			hints: { focus: 'grid' },
			duration: 24,
			controls: [bond, side, newGrid],
			body: `
<p>Now the nodes are the points of a square grid, and only neighbours can be linked: each of the bonds between them is open with probability <i>p</i>. This is <dfn data-def="A model of random connections on a lattice: each bond (or site) is open with probability p, and one asks whether open paths cross the whole lattice.">bond percolation</dfn>, a model of water seeping through porous rock or a current finding its way through a mixture of conducting and insulating grains.</p>
<p>The question is whether open bonds join the top row to the bottom row: a <strong>spanning cluster</strong>. Below about 45 % open bonds the clusters are small; above about 55 % one spans. The chart on the right shows how often a grid spans, from 300 random grids of each size, against <i>p</i>: every size crosses 50 % near <i>p</i> = 1/2, and the bigger the grid, the steeper the switch.</p>`,
			notes: `<p>Percolation theory was founded by Simon Broadbent and John Hammersley (1957), thinking about gas masks whose pores might or might not let gas through. Unlike in the random graph, here every node has at most four links and distances on the grid matter, so the details differ: at the threshold, the spanning cluster is a fractal and holds a vanishing share of the grid. The threshold itself, an average of 2 open bonds per node, differs from the random graph's 1 link per node because the grid's short loops waste links on nodes already connected.</p>`
		},
		{
			id: 'dual',
			chapter: 'grid',
			title: 'Why exactly one half',
			scene: 'lattice',
			hints: { focus: 'dual' },
			duration: 24,
			controls: [bond, side, newGrid],
			body: `
<p>On the square grid the threshold is known exactly: <i>p</i><sub>c</sub> = 1/2 (Harry Kesten, 1980). The reason is a drawing. Put a point in the middle of each square of the grid and cross every <em>closed</em> bond with a dual bond: these form a second grid, the <dfn data-def="The grid whose sites are the faces of the original grid; each of its bonds crosses one bond of the original, and is open when that bond is closed.">dual grid</dfn>, drawn in the second colour.</p>
<p>An open path from top to bottom and a dual path from left to right would have to cross, and they can't: one passes only through open bonds and the other only through closed ones. One of the two always exists and never both. Each dual bond is open with probability 1 − <i>p</i>, so at <i>p</i> = 1/2 the grid and its dual look alike statistically, and neither can be favoured: the switch must sit at one half.</p>`,
			notes: `<p>The symmetry argument makes 1/2 plausible; turning it into a proof took twenty years, from Harris (1960), who showed there is no infinite cluster at <i>p</i> = 1/2, to Kesten (1980), who showed there is one for every <i>p</i> &gt; 1/2. Other lattices have thresholds known only from simulations (site percolation on the square grid: about 0.5927).</p>`
		},
		// ----------------------------------------------------------------- same
		{
			id: 'epidemic',
			chapter: 'same',
			title: 'The same curve, an epidemic',
			scene: 'sweep',
			hints: { focus: 'epidemic' },
			duration: 24,
			body: `
<p>An epidemic in a crowd that mixes at random is the same exploration. Link each case to the people it would infect: the chain of infection is a branching process with mean <a href="../epidemics/#r0">R<sub>0</sub></a>, and a large outbreak is possible only if R<sub>0</sub> &gt; 1. When every case is infectious for the same time, the number it infects is Poisson like the degrees here, and the outbreak's final size, the share of the crowd ever infected, solves z = 1 − e<sup>−R<sub>0</sub>z</sup>: the giant component's equation. R<sub>0</sub> = 2 ends with 80 % infected; R<sub>0</sub> = 1.5 with 58 %.</p>
<p>The same threshold reappears wherever random connections spread something: a <a href="../internet/#nocenter">network</a> that stays connected as routers fail at random, the <a href="../pagerank/#build">web</a>'s large linked core, a gel forming as molecules cross-link. Like a <a href="../states-of-matter/#diagram">change of state</a>, the change is sharp only for very large systems; a small one rounds it off.</p>`,
			notes: `<p>The final-size equation is Kermack and McKendrick's (1927); it holds for any distribution of infectious periods, while the chance that one case starts a large outbreak depends on it: with Poisson numbers of infections it equals z itself, and with the epidemics page's varied infectious periods it is 1 − 1/R<sub>0</sub>. The link between epidemics and percolation is due to Mollison (1977) and Grassberger (1983). Real networks are not Erdős–Rényi graphs: the Internet and the web have hubs with huge degrees, which can push the threshold toward zero (Cohen, Erez, ben-Avraham and Havlin, 2000; Pastor-Satorras and Vespignani, 2001).</p>`
		}
	]
};
