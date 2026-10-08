import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Surfer speed',
	min: 1,
	max: 200,
	step: 1,
	default: 4,
	unit: ' hops/s'
};

const speedFast: Control = { ...speed, id: 'speedFast', default: 60 } as Control;

const damping: Control = {
	type: 'range',
	id: 'damping',
	label: 'Chance of following a link',
	min: 0.5,
	max: 1,
	step: 0.01,
	default: 0.85,
	format: (v) => `${Math.round(v * 100)}% (jumps ${Math.round((1 - v) * 100)}%)`,
	help: 'The rest of the time the surfer jumps to any page at random.'
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Restart the surfer',
	action: 'Restart the surfer',
	help: 'Clear the visit counts and send out a new surfer.'
};

const tool: Control = {
	type: 'select',
	id: 'tool',
	label: 'Tool',
	default: 'link',
	options: [
		{ value: 'link', label: 'Link: drag from one page to another' },
		{ value: 'move', label: 'Move pages' },
		{ value: 'erase', label: 'Erase: click a page or a link' }
	]
};

const addPage: Control = {
	type: 'action',
	id: 'addPage',
	label: 'Add a page',
	action: 'Add a page',
	help: 'Up to ten pages.'
};

const resetWeb: Control = {
	type: 'action',
	id: 'resetWeb',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to the five-page web this chapter starts with.'
};

export const spec: ExplainerSpec = {
	slug: 'pagerank',
	title: 'How search engines rank pages',
	summary:
		'Build a small web, release a random surfer on it and watch its visits settle into each page’s rank — the idea behind Google’s PageRank.',
	chapters: [
		{ id: 'votes', title: 'Links as votes' },
		{ id: 'surfer', title: 'The random surfer' },
		{ id: 'build', title: 'Build your own web' },
		{ id: 'compute', title: 'Computing it' }
	],
	steps: [
		// ------------------------------------------------------------------ votes
		{
			id: 'problem',
			chapter: 'votes',
			title: 'Which page first?',
			scene: 'votes',
			hints: { phase: 'web' },
			duration: 16,
			body: `
<p>Type a few words into a search engine and millions of pages may contain them. The engine has to decide which handful to show first. Matching the words is the easy part; the hard part is deciding which matching pages are <strong>worth reading</strong>.</p>
<p>In the late 1990s two Stanford PhD students, Larry Page and Sergey Brin, noticed that the web already holds millions of human judgements (they published the idea in 1998): the <dfn data-def="A clickable reference from one web page to another. Each arrow here is one link, pointing from the page that contains it to the page it leads to.">links</dfn>. Someone who links to a page is, in a way, recommending it.</p>
<p>Here is a tiny web of six pages. Each arrow is a link.</p>`
		},
		{
			id: 'count',
			chapter: 'votes',
			title: 'Counting votes',
			scene: 'votes',
			hints: { phase: 'count' },
			duration: 16,
			body: `
<p>The simplest idea: treat each incoming link as a vote and rank pages by how many they get. B and C have four votes each, A has just one.</p>
<p>But not all votes should count the same. Anyone can make a hundred pages that link to their own; and a recommendation from a page everybody trusts should weigh more than one from a page nobody reads.</p>`
		},
		{
			id: 'weighted',
			chapter: 'votes',
			title: 'Votes from important pages count more',
			scene: 'votes',
			hints: { phase: 'weighted' },
			duration: 20,
			body: `
<p>PageRank's answer: <strong>a page is important if important pages link to it</strong>. Each page shares its own importance out among the pages it links to, in equal parts.</p>
<p>That sounds circular — to know a page's importance you need the importance of the pages that link to it, which depends on theirs… The next chapter shows a simple way out. For now, look at the result: A, with a single vote, ranks far above B, with four. A's one vote comes from C, the most important page, and C links to A alone, so A gets all of C's share; three of B's four votes come from pages that matter little, and every page that votes for B — even A — splits its vote among two or three links.</p>`,
			notes: `<p>The size of each page is drawn from its PageRank, computed as the next chapters explain. Ties in vote count can hide large differences in rank, and the reverse.</p>`
		},
		// ------------------------------------------------------------------ surfer
		{
			id: 'surfer',
			chapter: 'surfer',
			title: 'A random surfer',
			scene: 'surfer',
			hints: { web: 'example', phase: 'walk' },
			duration: 20,
			controls: [speed, restart],
			body: `
<p>Imagine someone who surfs the web without thinking: on every page they click one of its links at random. Most of the time — say 85% — that is what they do; the other 15% they get bored and type in the address of <em>any</em> page at random. Call it the <dfn data-def="An imaginary web user who moves from page to page by following random links, with an occasional jump to a random page. The share of time they spend on each page is its PageRank.">random surfer</dfn>.</p>
<p>Watch the surfer hop. A solid trail is a followed link; a dashed one is a random jump. The bars count how often the surfer has been on each page.</p>`
		},
		{
			id: 'converge',
			chapter: 'surfer',
			title: 'The visits settle down',
			scene: 'surfer',
			hints: { web: 'example', phase: 'converge' },
			duration: 24,
			controls: [speedFast, restart],
			body: `
<p>Now the surfer hops much faster. At first the counts are ragged — they depend on where it happened to wander. After thousands of hops, the <em>share</em> of time spent on each page stops changing, and restarting with a new surfer gives the same shares.</p>
<p>Those shares are the <strong>PageRank</strong>: the marks on the bars are the exact values. Pages that many links lead to get visited often, but so do pages that a frequently visited page links to — exactly the "important pages make you important" rule, with no circle in sight.</p>`,
			notes: `<p>The shares settle because the surfer is a <dfn data-def="A random process where the next state depends only on the current one — here, the next page depends only on the page the surfer is on.">Markov chain</dfn>; the random jumps guarantee it has a single long-run distribution, which it approaches whatever page it starts on.</p>`
		},
		{
			id: 'traps',
			chapter: 'surfer',
			title: 'Dead ends and traps',
			scene: 'surfer',
			hints: { web: 'traps', phase: 'traps' },
			duration: 24,
			controls: [damping, speedFast, restart],
			body: `
<p>Why the random jumps? Real webs have awkward corners. Page F here is a <strong>dead end</strong>: it links nowhere, so a surfer on it has no choice but to jump. D and E form a <strong>trap</strong>: they link only to each other.</p>
<p>Slide the chance of following a link to 100% — no boredom, no jumps except out of dead ends. Restart, and watch the surfer wander into D and E and never leave: from then on every visit goes to those two, and the other pages' shares shrink towards zero. Two pages that link only to each other can swallow the whole ranking, once any link leads in.</p>`
		},
		{
			id: 'damping',
			chapter: 'surfer',
			title: 'The jump keeps it fair',
			scene: 'surfer',
			hints: { web: 'traps', phase: 'damping' },
			duration: 22,
			controls: [damping, speedFast, restart],
			body: `
<p>Bring the chance back down and the occasional jump rescues the surfer from every trap, and gives every page at least a small share of visits. The trap pair still ranks high — a link leads in and none lead out — but it can no longer swallow everything.</p>
<p>Page and Brin used 85%, so the surfer follows about six links in a row on average before jumping. Lower it and the ranks become more equal, because random jumps treat all pages alike; raise it and the link structure dominates, but traps grow stronger and the shares take longer to settle.</p>`,
			notes: `<p>The 85% is called the <dfn data-def="The probability d that the random surfer follows a link rather than jumping; 0.85 in the original PageRank paper.">damping factor</dfn>. Every page receives at least (1 − 0.85) ÷ number of pages from the jumps: 2.5% each here.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'build',
			chapter: 'build',
			title: 'Build a web',
			scene: 'surfer',
			hints: { web: 'starter', phase: 'build', edit: true },
			duration: 30,
			controls: [tool, addPage, resetWeb, speedFast, restart],
			body: `
<p>Now it is your web. Drag from one page to another to add a link; with the erase tool, click a link or a page to remove it; add pages with the button. The ranks — the marks on the bars, and the size of each page — are recomputed instantly, and the surfer starts again on the new web.</p>
<p>Try a few experiments. Make a ring where each page links to the next: every page gets the same rank. Make one page link to all the others and nobody link back: it sinks to the bottom. Make a dead end and a trap, and see that the jumps still keep everyone above zero.</p>`
		},
		{
			id: 'boost',
			chapter: 'build',
			title: 'Can you game it?',
			scene: 'surfer',
			hints: { web: 'starter', phase: 'boost', edit: true, target: 4 },
			duration: 30,
			controls: [tool, addPage, resetWeb, speedFast, restart],
			body: `
<p>Page E is new: it links to A, but nobody links to E, so it gets only its share of random jumps. Your job: <strong>raise E's rank</strong>.</p>
<p>First add links <em>from</em> E to other pages. Nothing happens to E: its links give its vote away, but no surfer arrives at E by a link, so its own rank cannot change. Now add pages that link to E — a little "link farm". It helps, but each new page has hardly any rank to give. Finally, get A, the top page, to link to E: one vote from a page that matters beats a whole farm.</p>
<p>(Once some page does link to E, E's own links start to matter a little: rank sent to a page that links back to E comes back round. Search engines learned to discount such link swaps and farms long ago.)</p>`,
			notes: `<p>This is the real lesson of PageRank: the only reliable way to rank highly is to be linked to by pages that are themselves well linked — by earning recommendations. Modern search engines combine PageRank-like link scores with hundreds of other signals, partly because people did try to game it.</p>`
		},
		// ------------------------------------------------------------------ compute
		{
			id: 'compute',
			chapter: 'compute',
			title: 'Computing ranks without a surfer',
			scene: 'iterate',
			hints: { web: 'example', phase: 'iterate' },
			duration: 26,
			controls: [damping],
			body: `
<p>Simulating a surfer for billions of hops would be slow. Instead, follow <em>all</em> possible surfers at once. Start every page with an equal share of rank. Then, in each round, every page passes 85% of its rank along its links, split equally, and the remaining 15% is spread evenly over all pages (a dead end spreads all of its rank). The slider changes the 85%. Each page's new rank is what it receives.</p>
<p>Watch the shares flow round the web. After a handful of rounds they barely change; a few dozen rounds give the ranks to many decimal places — the same values the surfer was slowly approaching.</p>
<p>That is all PageRank is: <strong>the importance of a page, worked out from the link structure alone</strong>, by letting rank flow along the links until it settles.</p>`,
			notes: `<p>Written out, page <i>p</i>'s new rank is (1 − d)/N + d × the sum, over pages <i>q</i> linking to <i>p</i>, of rank(<i>q</i>) ÷ (number of links on <i>q</i>) — plus, for every dead end, d × its rank ÷ N. The ranks that stay unchanged by this update form an <dfn data-def="A vector that a linear transformation only stretches, without changing its direction. PageRank is the eigenvector, with eigenvalue 1, of the web's 'Google matrix'.">eigenvector</dfn>, with eigenvalue 1, of the web's "Google matrix" — the link matrix with the random jumps and the dead-end rule built in — and repeating the update is the "power method" for finding it. Page, Brin and colleagues reported that about 52 rounds were enough for their 322-million-link web.</p><p>The 1998 paper writes (1 − d) without dividing by N, which gives the same ranks multiplied by N. It also set dead ends aside during the calculation; sharing their rank out evenly, as here, is the usual modern convention.</p>`
		}
	]
};
