import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const spoons: Control = {
	type: 'range',
	id: 'spoons',
	label: 'Spoonfuls of salt',
	min: 0,
	max: 4,
	step: 1,
	default: 0,
	help: 'Tablespoons of salt (18 g each) sprinkled on the patch of ice.'
};

const water: Control = {
	type: 'range',
	id: 'water',
	label: 'Temperature',
	min: -5,
	max: 5,
	step: 1,
	default: 0,
	unit: '°C',
	help: 'How warm the ice and the water on it are.'
};

const salted: Control = {
	type: 'toggle',
	id: 'salted',
	label: 'Sprinkle salt',
	default: false
};

const weather: Control = {
	type: 'range',
	id: 'weather',
	label: 'How cold it is',
	min: -25,
	max: -1,
	step: 1,
	default: -5,
	unit: '°C',
	help: 'The temperature of the path and the air. Two spoonfuls of salt are on the ice.'
};

const saltiness: Control = {
	type: 'range',
	id: 'saltiness',
	label: 'Salt in 100 g of salty water',
	min: 0,
	max: 26,
	step: 1,
	default: 0,
	unit: 'g'
};

const bowlSalt: Control = {
	type: 'range',
	id: 'bowlSalt',
	label: 'Spoonfuls of salt in the bowl',
	min: 0,
	max: 8,
	step: 1,
	default: 0,
	help: 'Tablespoons of salt (18 g each) stirred into 500 g of ice. Eight spoonfuls is half a cup.'
};

const bag: Control = {
	type: 'select',
	id: 'bag',
	label: 'Round the cream',
	default: 'cup',
	options: [
		{ value: 'plain', label: 'plain ice' },
		{ value: 'spoon', label: 'ice and 1 spoonful of salt' },
		{ value: 'cup', label: 'ice and half a cup of salt' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'salt-and-ice',
	title: 'Salt on ice: roads and ice cream',
	summary:
		'Sprinkle salt on an icy path and the ice melts although the thermometer stays below freezing. Zoom in to see the salt getting in the way of the ice re-forming, find the cold at which salt stops working, then pack salt and ice round a bag of cream and freeze it into ice cream.',
	chapters: [
		{ id: 'road', title: 'The icy path' },
		{ id: 'inside', title: 'Inside the ice' },
		{ id: 'cold', title: 'How cold salt works' },
		{ id: 'cream', title: 'Ice cream' }
	],
	steps: [
		// ------------------------------------------------------------------ road
		{
			id: 'road',
			chapter: 'road',
			title: 'Salt on an icy path',
			scene: 'road',
			hints: { phase: 'road' },
			duration: 16,
			controls: [spoons],
			body: `
<p>On a cold winter morning, a patch of ice covers the garden path: about half a kilogram of it. The thermometer reads −5 °C, five degrees below freezing, so the ice stays hard.</p>
<p>Sprinkle salt on it with the slider. The ice turns to slush and water, and the thermometer still reads −5 °C. One spoonful of salt melts about 210 grams of ice; three spoonfuls melt the whole patch.</p>
<p>The salt is not warm, and it does not heat the ice or burn through it: nothing on the path gets any warmer. So how can ice melt below freezing?</p>`
		},
		// ------------------------------------------------------------------ inside
		{
			id: 'stack',
			chapter: 'inside',
			title: 'Ice is a neat stack',
			scene: 'particles',
			hints: { phase: 'stack' },
			duration: 18,
			controls: [water],
			body: `
<p>Zoom right in. Ice is made of tiny particles of water, far too small to see, packed in a neat stack. On top of the ice there is a thin layer of water, where the particles tumble about freely.</p>
<p>At the edge between them two things happen all the time: particles break off the stack into the water, and particles from the water join the stack. At 0 °C the two happen just as often, so the ice neither grows nor shrinks.</p>
<p>Make it colder with the slider: joining wins, and the water freezes onto the stack. Make it warmer: breaking off wins, and the ice melts. That balance point, 0 °C for plain water, is its <dfn data-def="The temperature at which a liquid turns solid: below it, particles join the solid faster than they break off.">freezing point</dfn>.</p>`
		},
		{
			id: 'salt',
			chapter: 'inside',
			title: 'Salt gets in the way',
			scene: 'particles',
			hints: { phase: 'salt' },
			duration: 20,
			controls: [salted],
			body: `
<p>Back to −5 °C. Plain water freezes here, so the stack is all ice: a particle that breaks off joins straight back on. Now sprinkle salt. The salt dissolves into the first loose water it meets: it breaks up into its own tiny particles, which mix in among the water particles.</p>
<p>Particles still break off the stack as often as before. But fewer water particles reach the stack to join it, because salt particles are in the way, and salt cannot join a stack of ice. So breaking off wins, and the ice melts, although it is still −5 °C.</p>
<p>Each particle that breaks off adds more water to the layer, so the salt gets spread more thinly. Melting slows down, and stops when there are about 8 grams of salt in every 100 grams of salty water: water that salty freezes at exactly −5 °C, and the two sides balance again.</p>`
		},
		{
			id: 'curve',
			chapter: 'cold',
			title: 'How salty, how cold',
			scene: 'curve',
			hints: { phase: 'curve' },
			duration: 18,
			controls: [saltiness],
			body: `
<p>The saltier the water, the colder it has to get before it freezes. This line was measured in laboratories: put more salt in 100 grams of salty water with the slider, and follow the dot down.</p>
<p>Sea water has about 3½ grams of salt in every 100, and freezes at about −2 °C. With 10 grams it freezes at about −7 °C.</p>
<p>The line stops falling at 23 grams of salt, at −21 °C. Add more salt than that and the water gets no harder to freeze: in that cold the extra salt comes back out as grains, and the rest of the water still freezes at −21 °C. That is the coldest that salty water can ever be and stay liquid.</p>`
		},
		{
			id: 'weather',
			chapter: 'cold',
			title: 'Too cold for salt',
			scene: 'road',
			hints: { phase: 'weather' },
			duration: 16,
			controls: [weather],
			body: `
<p>Back on the path, two spoonfuls of salt lie on the ice. Make the day colder with the slider.</p>
<p>The colder it is, the saltier the water must be to stay liquid, so the same salt melts less ice. At −5 °C two spoonfuls melt about 420 grams; at −15 °C, only about 150. Below about −21 °C they melt nothing at all: no salty water stays liquid that cold, so the salt just sits on the ice.</p>
<p>Long before that the salt becomes slow and weak, which is why road crews switch to sand, or to other salts that work in deeper cold, when the road gets colder than about −10 °C.</p>`,
			notes: `<p>What counts is the temperature of the road surface, not of the air: a sunny road can be warmer than the air, and a bridge colder. Road salt also needs a little water to start dissolving, which is why crews often spray it as salty water (brine) before the snow comes.</p>`
		},
		// ------------------------------------------------------------------ cream
		{
			id: 'bowl',
			chapter: 'cream',
			title: 'A bowl of ice gets colder',
			scene: 'bowl',
			hints: { phase: 'bowl' },
			duration: 18,
			controls: [bowlSalt],
			body: `
<p>Here is a bowl of ice at 0 °C, about four cups, well wrapped and stirred. Without salt it stays at 0 °C, however long you wait. Stir in salt with the slider.</p>
<p>The ice starts to melt, as on the path. But melting takes heat: every bit of ice that melts pulls heat out of whatever is around it. Here nothing warm is nearby, so the heat comes out of the bowl itself, and the thermometer drops. With one spoonful of salt the bowl falls to about −18 °C, and about 66 grams of ice melt to pay for it.</p>
<p>A second spoonful takes it to −21 °C, and then extra salt no longer helps: −21 °C is as cold as salty water can be, so the bowl can get no colder.</p>`,
			notes: `<p>The page's bowl is perfectly stirred and wrapped, and its ice starts at exactly 0 °C. In a real bowl the salt takes a while to dissolve and heat creeps in from the kitchen, so it reads a few degrees warmer. Salt also takes a little heat as it dissolves, about a twentieth of what the melting takes; the page leaves it out.</p>`
		},
		{
			id: 'cream',
			chapter: 'cream',
			title: 'Freezing ice cream',
			scene: 'bowl',
			hints: { phase: 'cream' },
			duration: 22,
			controls: [bag],
			body: `
<p>To make ice cream in a bag: put half a cup of cream (half milk, half cream) and a spoonful of sugar in a small bag, and shake it inside a big bag holding four cups of ice and half a cup of salt. The clock on the stage runs ten minutes.</p>
<p>The cold ice keeps melting, and the heat for it now comes out of the cream. The cream cools down, past 0 °C, and its water starts to turn to ice crystals at about −2 °C. After about five minutes half its water is ice, and it is soft ice cream.</p>
<p>Pick plain ice instead. The cream cools to 0 °C and stops there, because plain ice is never colder than 0 °C: it stays runny. With a single spoonful of salt it works, but takes about twice as long, and the bowl warms up as its ice melts.</p>`,
			notes: `<p>How fast heat leaks in from the kitchen and passes from the cream into the ice depends on the bag and the shaking. The page picks values that freeze the recipe’s cream in about five minutes, as the recipe says; everything else follows from the freezing line of salty water and the heat that melting takes.</p>`
		},
		{
			id: 'next',
			chapter: 'cream',
			title: 'Read next',
			scene: 'road',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Salt gets in the way of water joining the ice, so salty ice melts below 0 °C. On a path the ground and air give the melting its heat; in a bowl the heat comes out of the bowl and whatever is in it, which is how salt and ice freeze cream. Below about −21 °C, no amount of salt melts ice.</p>
<p>The page on <a href="../states-of-matter/">states of matter</a> looks closer at how particles hold together in solids, liquids and gases, and at the heat it takes to pull them apart.</p>`
		}
	]
};
