import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const birth: Control = {
	type: 'range',
	id: 'birth',
	label: 'Rabbit birth rate',
	min: 0.3,
	max: 2,
	step: 0.05,
	default: 1,
	format: (v) => `${v.toFixed(2)} per year`
};

const room: Control = {
	type: 'range',
	id: 'room',
	label: 'Room in the field (carrying capacity)',
	min: 200,
	max: 1000,
	step: 50,
	default: 600,
	unit: ' rabbits'
};

const predation: Control = {
	type: 'range',
	id: 'predation',
	label: 'How well foxes hunt',
	min: 0.01,
	max: 0.04,
	step: 0.001,
	default: 0.02,
	format: (v) => v.toFixed(3)
};

const death: Control = {
	type: 'range',
	id: 'death',
	label: 'Fox death rate',
	min: 0.2,
	max: 1.2,
	step: 0.05,
	default: 0.6,
	format: (v) => `${v.toFixed(2)} per year`
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Start again',
	action: 'Start again'
};

const wolves: Control = { type: 'toggle', id: 'wolves', label: 'Wolves', default: true };
const deer: Control = { type: 'toggle', id: 'deer', label: 'Deer (newcomers)', default: false };
const elk: Control = { type: 'toggle', id: 'elk', label: 'Elk', default: true };
const beavers: Control = { type: 'toggle', id: 'beavers', label: 'Beavers', default: true };

export const spec: ExplainerSpec = {
	slug: 'ecosystems',
	title: 'How populations rise and fall',
	summary:
		'Release rabbits and foxes into a field and watch their numbers chase each other round, then pull one species out of a food web and follow the ripples.',
	chapters: [
		{ id: 'one', title: 'One species' },
		{ id: 'two', title: 'Predator and prey' },
		{ id: 'web', title: 'A food web' }
	],
	steps: [
		// ------------------------------------------------------------------ one
		{
			id: 'growth',
			chapter: 'one',
			title: 'Growth, then a limit',
			scene: 'field',
			hints: { phase: 'growth' },
			duration: 22,
			controls: [birth, room, restart],
			body: `
<p>Put a few rabbits in an empty field. With plenty of grass, each year's rabbits have young, the young have young, and the population <strong>grows faster and faster</strong>: the more rabbits, the more births.</p>
<p>But the field is not endless. As it fills up, food runs short and crowding sets in, so fewer young survive. Growth slows and the population levels off at the most the field can feed — its <dfn data-def="The largest population an environment can support for a long time, given its food, water and space.">carrying capacity</dfn>. Each dot stands for a few rabbits; the curve below counts them all.</p>`,
			notes: `<p>This S-shaped curve is <dfn data-def="Growth in proportion to the population, slowed as it approaches the carrying capacity K: dN/dt = a·N·(1 − N/K).">logistic growth</dfn>, first described by Pierre-François Verhulst in 1838.</p>`
		},
		// ------------------------------------------------------------------ two
		{
			id: 'cycles',
			chapter: 'two',
			title: 'Foxes and rabbits',
			scene: 'field',
			hints: { phase: 'cycles' },
			duration: 30,
			controls: [birth, predation, death, restart],
			body: `
<p>Now add foxes, which eat rabbits. When rabbits are plentiful the foxes feast and raise many cubs, so the fox population climbs. But more foxes eat more rabbits, and the rabbits crash. With little to eat the foxes starve and dwindle, the surviving rabbits breed in peace, and the whole thing starts again.</p>
<p>The two populations <strong>chase each other in cycles</strong>, the foxes' peaks always coming a little after the rabbits'. Nobody planned this: each species just responds to the other. That is <dfn data-def="When a change comes back round to affect its own cause: more rabbits → more foxes → fewer rabbits.">feedback</dfn>.</p>`,
			notes: `<p>These are the Lotka–Volterra equations (1925–26): rabbits are born at a steady rate and eaten in proportion to how often rabbits and foxes meet; foxes grow from what they eat and die at a steady rate. To keep the cycle clean, crowding among rabbits is left out here. Records of hare and lynx pelts bought by the Hudson's Bay Company in Canada show similar ten-year swings.</p>`
		},
		{
			id: 'loop',
			chapter: 'two',
			title: 'Going round in circles',
			scene: 'field',
			hints: { phase: 'loop' },
			duration: 26,
			controls: [birth, predation, death, restart],
			body: `
<p>Plot foxes against rabbits instead of against time and the cycle becomes a <strong>loop</strong>: rabbits rise first (moving right), then foxes rise (moving up), then rabbits fall, then foxes fall — round and round, back to where it started.</p>
<p>In the middle sits a <strong>balance point</strong> where births and deaths exactly cancel for both species. Start there and nothing changes; start anywhere else and the populations circle round it. Change the rates and the balance point moves — and some changes are surprising: make the foxes better hunters and the balance point has <em>fewer</em> rabbits — and fewer foxes too; make the rabbits breed faster and it is the foxes that end up more numerous, not the rabbits.</p>`,
			notes: `<p>At the balance point, rabbits = fox death rate ÷ (efficiency × hunting rate), and foxes = rabbit birth rate ÷ hunting rate. Better hunting lowers both; a higher rabbit birth rate raises the number of foxes, not of rabbits.</p>`
		},
		// ------------------------------------------------------------------ web
		{
			id: 'web',
			chapter: 'web',
			title: 'A food web',
			scene: 'web',
			hints: { phase: 'web' },
			duration: 24,
			controls: [wolves, elk, beavers],
			body: `
<p>Real ecosystems have many species, linked by who eats whom: a <dfn data-def="The network of feeding relationships in an ecosystem; arrows show which way food energy flows.">food web</dfn>. Here is a small one, loosely inspired by Yellowstone National Park: willows by the rivers; elk and beavers that feed on them; wolves that hunt elk.</p>
<p>Switch the <strong>wolves</strong> off. The elk, no longer hunted, multiply — and browse the willows down. With fewer willows, the beavers decline too, although wolves never touched a beaver. Switch the wolves back on and the web slowly recovers. A change at the top <strong>cascades</strong> down the web.</p>`,
			notes: `<p>The species and links are real, but the numbers in this model are made up to show the kind of effect, not measured. In Yellowstone, wolves were reintroduced in 1995 after 70 years' absence; how much of the later recovery of willows and beavers is due to them is still debated by ecologists — the real web has many more players, from bison to drought.</p>`
		},
		{
			id: 'newcomer',
			chapter: 'web',
			title: 'A newcomer',
			scene: 'web',
			hints: { phase: 'newcomer' },
			duration: 50,
			controls: [deer, wolves, elk, beavers],
			body: `
<p>Now let a new species in: deer, which eat willow like the elk, are hunted by wolves like the elk, and breed a little faster. Switch them on and watch for decades.</p>
<p>The deer settle in. More prey means more wolves — and more wolves hunt the elk harder, while the deer also eat the elk's food. The elk slowly vanish, <strong>although no deer ever harmed an elk</strong>. Feedback through the web links species that never meet.</p>
<p>That is the lesson: <strong>populations are tied together by feedback</strong>, so a change to one species ripples through the others in ways that are hard to guess.</p>`,
			notes: `<p>Ecologists call the two effects at work <em>competition</em> (for the same food) and <em>apparent competition</em> (through a shared predator). Introduced species have reshaped many real ecosystems this way.</p>`
		}
	]
};
