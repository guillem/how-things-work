import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const k: Control = {
	type: 'range',
	id: 'k',
	label: 'Number of centres (k)',
	min: 2,
	max: 6,
	step: 1,
	default: 3,
	help: 'How many groups k-means is told to find.'
};

/** The same choice on the "different starts" step, which starts at four (three always agree). */
const kStarts: Control = { ...k, id: 'kstarts', default: 4 };

const start: Control = {
	type: 'action',
	id: 'start',
	label: 'Starting centres',
	action: 'New starting centres',
	help: 'Drop the centres on other penguins, chosen at random, and run again.'
};

const ringStart: Control = {
	...start,
	id: 'ringstart',
	help: 'Drop the two centres on other points, chosen at random, and run again.'
};

const reveal: Control = {
	type: 'toggle',
	id: 'species',
	label: 'Show the species',
	default: false,
	help: 'Each penguin’s species as its shape: the answer k-means was never given.'
};

const ownK: Control = { ...k, id: 'ownk', default: 2 };

const clear: Control = {
	type: 'action',
	id: 'clear',
	label: 'Your points',
	action: 'Clear the points',
	help: 'Remove every point, then click or tap the plot to place your own.'
};

const ownStart: Control = {
	...start,
	id: 'ownstart',
	help: 'Drop the centres on other points, chosen at random, and run again.'
};

export const spec: ExplainerSpec = {
	slug: 'k-means-clustering',
	title: 'Finding groups: k-means',
	summary:
		'Hide the species of 342 real penguins and let a computer sort them into groups by itself: drop centres, colour by the nearest, move each centre to the middle, repeat. Then see why it needs to be told how many groups, and where it goes wrong.',
	chapters: [
		{ id: 'idea', title: 'Groups with no labels' },
		{ id: 'found', title: 'What it found' },
		{ id: 'limits', title: 'Where it goes wrong' }
	],
	steps: [
		// ------------------------------------------------------------------ idea
		{
			id: 'penguins',
			chapter: 'idea',
			title: 'Penguins with no names',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'raw' },
			duration: 16,
			body: `
<p>Between 2007 and 2009, the biologist Kristen Gorman and the Palmer Station team in Antarctica measured hundreds of penguins of three species: Adélie, Chinstrap and Gentoo. Each dot is one of 342 of them, placed by the length of its bill (across) and of its flipper (up).</p>
<p>Here the species are hidden. A machine that learns from labelled examples (as on the page about learning from data) would need them. Can a computer find groups in the dots with <strong>no labels at all</strong>? That is called <dfn data-def="Learning from data that comes without the answers: finding groups or patterns rather than predicting a known label.">unsupervised learning</dfn>, and the classic way to do it is <strong>k-means</strong>.</p>
<p>Your eye already sees clumps. The question is how to turn “clumps” into steps a computer can follow.</p>`,
			notes: `<p>A millimetre of bill and a millimetre of flipper are not equally telling: flippers vary about two and a half times as much (a standard deviation of 14 mm against 5.5 mm). So the page measures each length in its own spread, how many standard deviations it is from the average, and draws both axes to that scale. Otherwise the flipper would decide almost everything. This rescaling (standardising) is the usual first step before k-means.</p>
<p>Data: palmerpenguins by Allison Horst, Alison Hill and Kristen Gorman (2020), released into the public domain (CC0), from Palmer Station Antarctica LTER. Two of the 344 birds have no measurements and are left out.</p>`
		},
		{
			id: 'centres',
			chapter: 'idea',
			title: 'Drop k centres',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'start' },
			duration: 14,
			controls: [start],
			body: `
<p>First decide how many groups to look for: that number is the <em>k</em> in k-means. Here k = 3.</p>
<p>Then put down k <dfn data-def="A point that stands for a group; in k-means, the average position of the group's members.">centres</dfn>, the crosses. The simplest way is to pick k penguins at random and start the centres on them. They are almost certainly in the wrong places. That's fine: the next two moves fix them.</p>`
		},
		{
			id: 'assign',
			chapter: 'idea',
			title: 'Colour each point by its nearest centre',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'assign' },
			duration: 16,
			controls: [start],
			body: `
<p><strong>Move one: assign.</strong> Each penguin takes the colour of the centre it is nearest to, measured as a straight line on the plot.</p>
<p>The tinted areas show where each centre is the nearest one. Their borders are straight lines exactly halfway between two centres. Every point on one side is closer to one centre, every point on the other side is closer to the other.</p>`
		},
		{
			id: 'move',
			chapter: 'idea',
			title: 'Move each centre to the middle of its colour',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'move' },
			duration: 16,
			controls: [start],
			body: `
<p><strong>Move two: update.</strong> Each centre jumps to the middle of the points of its colour: their average bill length and average flipper length. That is the “means” in k-means.</p>
<p>Now some penguins are nearer to a different centre than the one whose colour they wear. So the colours are out of date, and it is time to assign again.</p>`
		},
		{
			id: 'repeat',
			chapter: 'idea',
			title: 'Repeat until nothing moves',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'run' },
			duration: 22,
			controls: [k, start],
			body: `
<p>Assign, move, assign, move. As the rounds go on, fewer and fewer points change colour, until a round in which <strong>none</strong> do. Then the centres would not move either, and the algorithm stops. It usually takes a handful of rounds.</p>
<p>It always stops. Each move can only make the points closer to their centres on the whole (the total of their squared distances goes down or stays the same), and there are only finitely many ways to colour the points, so it cannot go on forever.</p>
<p>Try another k, or new starting centres, and watch it settle again.</p>`,
			notes: `<p>This back-and-forth is Lloyd’s algorithm, worked out by Stuart Lloyd at Bell Labs in 1957 (published in 1982); James MacQueen named it k-means in 1967. It finds a grouping that no single move can improve, but not necessarily the best grouping of all: finding that is a much harder problem, and no fast method is known for it.</p>`
		},
		// ------------------------------------------------------------------ found
		{
			id: 'species',
			chapter: 'found',
			title: 'Reveal the species',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'species' },
			duration: 20,
			controls: [reveal, k, start],
			body: `
<p>Turn on the species. Each penguin keeps the colour of its group but now shows its species as its shape.</p>
<p>With three centres, the three groups line up closely with the three species: if each group is named after its most common species, about 96 penguins in 100 are named right. Nobody told the algorithm there were species. The birds simply differ in body shape: Gentoos have long flippers, and Chinstraps have longer bills than Adélies.</p>
<p>But the match is not perfect, and it does not have to be. k-means finds groups of <em>points that are close together</em>. Whether those groups mean anything is for a person to check.</p>`
		},
		{
			id: 'starts',
			chapter: 'found',
			title: 'Different starts, different answers',
			scene: 'starts',
			hints: { data: 'penguins' },
			duration: 20,
			controls: [kStarts],
			body: `
<p>Here are the same penguins run six times with four centres, each time from different random starting centres. They don’t all end up the same: depending on where the centres started, the extra group carves off a different piece.</p>
<p>Each panel shows the total squared distance from the points to their centres where its run stopped: smaller means tighter groups. Practitioners run k-means many times from different starts and keep the run with the smallest total (the panel marked “best”).</p>
<p>Set k to 3 and all six agree: on these penguins, three groups are clear enough that every start finds them.</p>`,
			notes: `<p>A better way to start, k-means++ (David Arthur and Sergei Vassilvitskii, 2007), drops the first centre on a random point and each next one on a point chosen with a probability that grows with its distance from the centres already placed. It spreads the centres out and makes bad endings rarer, but not impossible, so libraries still run it several times.</p>`
		},
		{
			id: 'how-many',
			chapter: 'found',
			title: 'How many groups?',
			scene: 'cluster',
			hints: { data: 'penguins', phase: 'k' },
			duration: 20,
			controls: [k, reveal],
			body: `
<p>k-means always finds exactly as many groups as it is told. Ask for two and it finds two. The Chinstraps get split, with some going to the Adélies and most to the Gentoos. Ask for six and it cuts the species into pieces.</p>
<p>It cannot tell you the right k by itself. More centres always fit tighter, so the total squared distance keeps falling all the way to one centre per penguin. Choosing k takes something else: knowing the subject, checking whether the groups are useful, or a rule of thumb.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'rings',
			chapter: 'limits',
			title: 'Two rings, cut in half',
			scene: 'cluster',
			hints: { data: 'rings', phase: 'rings' },
			duration: 20,
			controls: [ringStart],
			body: `
<p>Now some made-up points: a small ring inside a bigger one. To your eye there are obviously two groups, the inner ring and the outer ring.</p>
<p>k-means with two centres doesn’t find them. It cuts the picture in half with a straight border, and each half gets part of both rings. It only knows “nearest centre”, so its groups are always blobs on either side of straight borders. A ring around another ring has its middle in the same place as the ring inside it, so no centre can claim the outer ring alone.</p>
<p>Try other starts: the border turns, but it always cuts both rings in two.</p>`,
			notes: `<p>Methods that follow chains of nearby points (density-based clustering such as DBSCAN) or that first unroll the data (spectral clustering) separate the two rings. They pay for it with other choices to make, such as how near counts as “nearby”.</p>`
		},
		{
			id: 'yours',
			chapter: 'limits',
			title: 'Try your own points',
			scene: 'cluster',
			hints: { data: 'own', phase: 'own' },
			duration: 24,
			controls: [ownK, ownStart, clear],
			body: `
<p>Click or tap the plot to add points, and k-means runs again on every change. It starts with a big, loose cloud next to a small, tight one. With two centres, the border falls nearer the middle of the two than you might expect, and the edge of the big cloud is given to the small one, because every point simply goes to the nearer centre.</p>
<p>k-means works best on groups that are compact, roughly round and of similar size, and only when it is told how many to find. Within those limits it is fast and simple, and it is still one of the most used tools for finding groups in data: sorting customers or the colours of an image into a few kinds, or making a first map of a new dataset.</p>`
		}
	]
};
