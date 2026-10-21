import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const lower: Control = {
	type: 'range',
	id: 'lower',
	label: 'Lower the stone',
	min: 0,
	max: 8,
	step: 0.1,
	default: 0,
	unit: 'cm',
	help: 'How far the spring balance has been let down.'
};

const thing: Control = {
	type: 'select',
	id: 'thing',
	label: 'Hang on the balance',
	default: 'stone',
	options: [
		{ value: 'stone', label: 'a stone' },
		{ value: 'apple', label: 'an apple' },
		{ value: 'wood', label: 'a wooden block' },
		{ value: 'steel', label: 'a steel ball' },
		{ value: 'clay', label: 'a ball of clay' }
	]
};

const bowl: Control = {
	type: 'toggle',
	id: 'bowl',
	label: 'Press the clay into a bowl',
	default: false
};

const marbles: Control = {
	type: 'range',
	id: 'marbles',
	label: 'Marbles in the bowl',
	min: 0,
	max: 20,
	step: 1,
	default: 0
};

const liquid: Control = {
	type: 'select',
	id: 'liquid',
	label: 'Fill the tank with',
	default: 'water',
	options: [
		{ value: 'water', label: 'water' },
		{ value: 'saltyWater', label: 'very salty water' },
		{ value: 'oil', label: 'cooking oil' }
	]
};

const heat: Control = {
	type: 'range',
	id: 'heat',
	label: 'Air inside the balloon',
	min: 15,
	max: 120,
	step: 1,
	default: 15,
	unit: '°C',
	help: 'The burner warms the air inside; the air outside stays at 15 °C.'
};

export const spec: ExplainerSpec = {
	slug: 'floating-sinking-and-boats',
	title: 'Floating, sinking & boats',
	summary:
		'Lower a stone, an apple and a steel ball into a brim-full tank and catch the water they push aside. Squash a ball of clay into a bowl and it floats; fill it with marbles until it sinks; then warm the air in a balloon until it lifts off.',
	chapters: [
		{ id: 'tank', title: 'In the tank' },
		{ id: 'shape', title: 'Shape matters' },
		{ id: 'air', title: 'Floating in air' }
	],
	steps: [
		// ------------------------------------------------------------------ tank
		{
			id: 'lower',
			chapter: 'tank',
			title: 'Lowering a stone',
			scene: 'tank',
			hints: { phase: 'lower' },
			duration: 18,
			controls: [lower],
			body: `
<p>A stone hangs from a spring balance over a tank filled right to the brim. In the air the balance reads 324 grams: that is how heavy the stone is.</p>
<p>Lower it into the water with the slider. As the stone goes in, it pushes water aside, and that water spills over the edge into the cup on the kitchen scale. At the same time the balance reads less and less: the water is pushing the stone up. (Pull the stone back up and the water in the tank drops below the brim: what spilled stays in the cup.)</p>
<p>Once the stone is all the way under, 120 grams of water have spilled, and the balance reads 204 grams: 324 take away 120. The stone feels lighter by exactly the weight of the water it pushed aside.</p>`
		},
		{
			id: 'objects',
			chapter: 'tank',
			title: 'Sink or float?',
			scene: 'tank',
			hints: { phase: 'objects' },
			duration: 22,
			controls: [thing],
			body: `
<p>Try other things on the balance. Each one is let down into the tank, and the water it pushes aside spills into the cup.</p>
<p>The apple and the wooden block stop going down before they are all the way under: the string goes slack and the balance reads nothing. They are <dfn data-def="Resting at the surface, held up by the water pushed aside, with part of the object still above the water.">floating</dfn>. Look at the cup: the water an apple spills weighs exactly as much as the apple, 184 grams. A floating thing sinks in just far enough to push aside its own weight of water, and then stops.</p>
<p>The steel ball and the ball of clay go all the way under and still haven’t spilled their own weight of water: the steel ball weighs 111 grams but spills only 14. Under the water there is nothing more to push aside, so they sink.</p>`
		},
		{
			id: 'heavy',
			chapter: 'tank',
			title: 'Heavy things can float',
			scene: 'tank',
			hints: { phase: 'heavy' },
			duration: 16,
			body: `
<p>Here are two things made of the same steel: a pan of about 600 grams and a little ball of 33 grams. The pan is eighteen times heavier, yet it floats, and the little ball sinks.</p>
<p>So heavy things don’t simply sink and light things float. What counts is whether a thing can push aside its own weight of water before it is all the way under. The pan is mostly air inside, so it pushes aside a lot of water while it is still only a little way in. A grain of sand is tiny and light, but it sinks for the same reason the steel ball does.</p>`
		},
		// ------------------------------------------------------------------ shape
		{
			id: 'bowl',
			chapter: 'shape',
			title: 'A ball and a bowl',
			scene: 'tank',
			hints: { phase: 'bowl' },
			duration: 18,
			controls: [bowl],
			body: `
<p>A ball of modelling clay weighs 98 grams and sinks. Now press the very same clay into a thin bowl and put it back in the water.</p>
<p>It floats. Nothing was added or taken away: it is the same clay and the same weight. But as a bowl it pushes aside water with its whole outside shape, air and all, so it has spilled 98 grams of water when it is only a little way in. As a ball, all of it under water pushes aside just 65 grams.</p>
<p>That is how a ship made of steel floats: its hull is a huge bowl.</p>`
		},
		{
			id: 'marbles',
			chapter: 'shape',
			title: 'Loading the boat',
			scene: 'tank',
			hints: { phase: 'marbles' },
			duration: 20,
			controls: [marbles],
			body: `
<p>Put marbles into the clay bowl, one at a time. Each one makes the bowl heavier, so it sinks a little deeper until it has pushed aside the extra weight of water too.</p>
<p>Fully down to its rim, the bowl would push aside 192 grams of water. That is the most it can hold up: the clay and 17 marbles weigh just under that, and it still floats, very low. The eighteenth marble is too many: water pours in over the rim and the bowl sinks.</p>
<p>Real ships have a line painted on their side, so that the crew can see how deep a heavy load has pushed the ship and stop loading long before the water reaches the top.</p>`,
			notes: `<p>That painted line is the Plimsoll line, named after the British politician who campaigned for it in the 1870s, when overloaded ships were sinking with their crews. It has marks for different waters, because a ship floats a little higher in salty sea water than in a river.</p>`
		},
		{
			id: 'liquids',
			chapter: 'shape',
			title: 'Other liquids',
			scene: 'tank',
			hints: { phase: 'liquids' },
			duration: 20,
			controls: [liquid],
			body: `
<p>An egg, an apple and a wooden block go into the tank. In water, the egg sinks. Now change what is in the tank.</p>
<p>In very salty water the egg floats. A cupful of salty water weighs more than a cupful of plain water, so the egg doesn’t have to sink as far to push aside its own weight of it. The apple and the wood ride higher too.</p>
<p>In cooking oil, which is lighter than water, everything sits lower: the egg sinks, and the apple and the block float deeper than they did in water. It is the same rule each time: a thing floats if it can push aside its own weight of whatever it is in.</p>`
		},
		// ------------------------------------------------------------------ air
		{
			id: 'balloon',
			chapter: 'air',
			title: 'A hot-air balloon',
			scene: 'balloon',
			hints: { phase: 'balloon' },
			duration: 22,
			controls: [heat],
			body: `
<p>Air weighs something too: the air filling a big balloon weighs about three tonnes. And air pushes up on things in it just as water does, with the weight of the air they push aside.</p>
<p>This balloon pushes aside 3,063 kilograms of air. With the air inside as cold as the air outside, the balloon, basket and people (600 kilograms) plus the air inside weigh more than that, so it stays on the ground. Warm the air inside with the slider. Warm air spreads out, so less of it fits in the balloon and it weighs less.</p>
<p>At about 85 °C everything together weighs less than the air it pushes aside, and the balloon lifts off: it floats in the air like a wooden block in water.</p>`,
			notes: `<p>The sums assume dry air at sea-level pressure, outside air at 15 °C, and the same temperature all through the balloon. The picture only shows that the balloon lifts off: how high it goes and how fast are not worked out. (A real balloon stops rising where the thinner air higher up weighs only as much as the balloon.)</p>`
		},
		{
			id: 'next',
			chapter: 'air',
			title: 'Read next',
			scene: 'tank',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A thing floats if it can push aside its own weight of water, or of air, before it is all the way under. That is why the same lump of clay sinks as a ball and floats as a bowl.</p>
<p>The page on <a href="../states-of-matter/">states of matter</a> looks inside water itself, and shows why ice floats on it. The page on <a href="../newtons-laws/">Newton’s laws</a> shows how pushes, like the water’s push up, change the way things move.</p>`
		}
	]
};
