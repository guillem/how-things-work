import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const spacing: Control = {
	type: 'toggle',
	id: 'spacing',
	label: 'Space',
	help: 'Turn away from neighbours that are too close.',
	default: true
};
const alignment: Control = {
	type: 'toggle',
	id: 'alignment',
	label: 'Same way',
	help: 'Turn toward the neighbours’ shared direction.',
	default: true
};
const cohesion: Control = {
	type: 'toggle',
	id: 'cohesion',
	label: 'Stay near',
	help: 'Drift toward the middle of the seven neighbours.',
	default: true
};
const missing: Control = {
	type: 'select',
	id: 'missing',
	label: 'Try leaving a rule out',
	default: 'none',
	options: [
		{ value: 'none', label: 'All three' },
		{ value: 'separation', label: 'Space off' },
		{ value: 'alignment', label: 'Same way off' },
		{ value: 'cohesion', label: 'Stay near off' }
	]
};
const hawk: Control = {
	type: 'toggle',
	id: 'hawk',
	label: 'A hawk passes through',
	default: false
};
const follow: Control = {
	type: 'action',
	id: 'follow',
	label: 'The ringed bird',
	action: 'Follow another bird'
};

export const spec: ExplainerSpec = {
	slug: 'flocking-birds',
	title: 'Flocks without a leader',
	summary:
		'A hundred birds, three small rules, and nobody in charge. Switch off a rule to see why it matters, follow one bird’s neighbours, and send a hawk through the flock. A simple model makes a moving group from local decisions.',
	chapters: [
		{ id: 'rules', title: 'Three small rules' },
		{ id: 'flock', title: 'Nobody in charge' }
	],
	steps: [
		{
			id: 'flock',
			chapter: 'rules',
			title: 'Who tells them where to turn?',
			scene: 'sky',
			duration: 22,
			body: `<p>A flock turns, stretches and gathers again. It looks as if someone must be calling the moves. But a flock can move together without a leader.</p><p>Here are 100 model birds. Every one follows the same three rules about its seven nearest neighbours. There is no destination and no bird in charge. The sky wraps round: a bird that leaves one edge reappears at the opposite edge.</p>`
		},
		{
			id: 'space',
			chapter: 'rules',
			title: 'First: leave a little space',
			scene: 'sky',
			duration: 25,
			controls: [spacing],
			body: `<p>If another bird is too close, turn away a little. The orange arrow on the ringed bird shows that push. This rule stops the birds piling up. The thin lines join the ringed bird to the seven neighbours it watches.</p><p>Switch the rule off. Each switch starts the same flock again, so you can compare fairly. Give it a few seconds: the birds squeeze into clumps. Switch it back on and they keep a little room between them. The counter below counts pairs flying very close together.</p>`
		},
		{
			id: 'direction',
			chapter: 'rules',
			title: 'Second: fly the neighbours’ way',
			scene: 'sky',
			duration: 25,
			controls: [alignment],
			body: `<p>Look at which way your neighbours are flying, and turn a little toward their shared direction. The blue arrow shows this turn. A bird follows the neighbours around it, not a captain at the front.</p><p>Switch this rule off. The birds still keep their distance and try to stay near each other, but now they mill around in different directions. Switch it on and watch agreement build up again.</p>`
		},
		{
			id: 'together',
			chapter: 'rules',
			title: 'Third: stay near the neighbours',
			scene: 'sky',
			duration: 25,
			controls: [cohesion],
			body: `<p>Drift toward the middle of your nearby group. The green arrow points that way. Each bird finds the middle of <em>its own neighbours</em>; none finds the middle of the whole flock.</p><p>Switch this rule off. The birds can still match directions and avoid collisions, but the group spreads farther apart. Switch it back on and that gentle pull keeps the neighbours nearer. The readout shows how far away the last of each bird’s seven neighbours is, compared with one bird’s length and averaged over all birds. The longer those lines stretch, the more spread out the little groups are.</p>`
		},
		{
			id: 'try',
			chapter: 'rules',
			title: 'The rules work together',
			scene: 'sky',
			duration: 24,
			controls: [missing],
			body: `<p>Try leaving out one rule at a time. Without spacing, the birds bunch up. Without matching, they do not agree which way to fly. Without gathering, they spread out.</p><p>With all three, the little turns add up to a flock. The arrows are turns the ringed bird would make right now. A short arrow means little adjustment is needed; once a bird already matches its neighbours, its blue arrow can shrink to a stub, or disappear if no turn is needed.</p>`
		},
		{
			id: 'hawk',
			chapter: 'flock',
			title: 'A hawk breaks through',
			scene: 'sky',
			duration: 28,
			controls: [hawk],
			body: `<p>Turn on the hawk. It enters after a few seconds and flies through the sky once. Each bird near it turns away hard. The flock bends and can split around the danger; after the hawk passes, neighbours draw back together.</p><p>No bird orders the split or plans the reunion. They each avoid the hawk they can see, then keep following the same three rules. This model hawk does not hunt or catch birds: it is a moving danger to steer around.</p>`
		},
		{
			id: 'follow',
			chapter: 'flock',
			title: 'Every bird has its own little group',
			scene: 'sky',
			duration: 23,
			controls: [follow],
			body: `<p>The ring marks one bird, and the thin lines point to the seven neighbours it responds to. Follow a different bird: it has its own neighbours and uses exactly the same rules.</p><p>The neighbours can change as birds pass each other. The ring is only our way of watching one bird. It gives that bird no extra powers, and the other birds do not know we picked it.</p>`
		},
		{
			id: 'real',
			chapter: 'flock',
			title: 'A model, not a bird’s instruction book',
			scene: 'sky',
			duration: 24,
			body: `<p>Craig Reynolds made a famous computer flock using these three ideas. They show that simple local reactions can be enough to make flocking. They are not three rules that scientists proved every real bird obeys.</p><p>Researchers studying real starling flocks found evidence that a bird responds to about six or seven nearest neighbours, rather than every bird within a fixed distance. We use seven here. These model birds all fly at one steady speed. Real birds speed up and slow down, fly in three dimensions, use sight, respond to many cues, and can do much more than these little computer birds.</p>`
		},
		{
			id: 'next',
			chapter: 'flock',
			title: 'A big pattern from small decisions',
			scene: 'sky',
			duration: 18,
			body: `<p>Every bird reacts only to neighbours, yet the whole group can hold together and turn. No bird needs a picture of the whole flock.</p><p>You can meet other groups without a conductor in <a href="../ant-trails/">ant trails</a> and <a href="../fireflies-in-sync/">fireflies that flash together</a>. The page on <a href="../ecosystems/">ecosystems</a> asks a different question: how groups of living things change each other’s numbers.</p>`
		}
	]
};
