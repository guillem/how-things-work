import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const add: Control = {
	type: 'action',
	id: 'add',
	label: 'Add to both glasses',
	action: 'Tip in another spoonful',
	disabled: (p) => Number(p.add ?? 0) >= 20,
	help: 'Each spoonful is weighed to 20 grams. Up to 20 spoonfuls per glass.'
};
const spoons: Control = {
	type: 'range',
	id: 'spoons',
	label: 'Spoonfuls in each glass',
	min: 0,
	max: 20,
	step: 1,
	default: 16
};
const warm: Control = {
	type: 'range',
	id: 'warm',
	label: 'Water temperature',
	min: 0,
	max: 80,
	step: 1,
	default: 20,
	unit: '°C'
};
const cool: Control = { ...warm, id: 'cool', default: 80 };
const dry: Control = {
	type: 'range',
	id: 'dry',
	label: 'Water dried away',
	min: 0,
	max: 100,
	step: 1,
	default: 0,
	unit: '%'
};

export const spec: ExplainerSpec = {
	slug: 'dissolving-sugar-and-salt',
	title: 'Dissolving: where does the sugar go?',
	summary:
		'Tip sugar and salt into water and follow their tiny particles. Find how much each glass takes, warm the water to dissolve far more sugar, then dry the water away and recover what went in.',
	chapters: [
		{ id: 'disappear', title: 'Where did it go?' },
		{ id: 'enough', title: 'Only so much' },
		{ id: 'recover', title: 'Getting it back' }
	],
	steps: [
		{
			id: 'spoon',
			chapter: 'disappear',
			title: 'Tip in a spoonful',
			scene: 'glasses',
			duration: 22,
			controls: [add],
			body: `<p>Put the same amount of water in two big glasses: 100 millilitres in each, at room temperature. Tip a spoonful of sugar into one and a spoonful of salt into the other.</p><p>The grains seem to disappear. Keep adding spoonfuls with the button: eventually some grains stay on the bottom, especially in the salt glass. Where did the rest go?</p><p>Our spoonfuls are weighed to 20 grams each, for a fair comparison. A real spoon holding 20 grams of sugar takes up a different space from one holding 20 grams of salt. The drawings are magnified windows into tiny samples, not life-size glasses or particles. In a real glass, the liquid level rises as solid dissolves; we keep the drawing size fixed so you can follow the particles.</p>`
		},
		{
			id: 'particles',
			chapter: 'disappear',
			title: 'Smaller than a grain',
			scene: 'glasses',
			duration: 20,
			body: `<p>Each grain of sugar is made of a huge crowd of tiny sugar particles, called <dfn data-def="A tiny group of atoms held together. A sugar molecule stays joined when sugar dissolves in water.">molecules</dfn>. The blue dots stand for water. Watch a small sample: sugar particles leave the grain and spread among the water particles.</p><p>The sugar particles are still sugar. They have not melted, turned into water or vanished. A sugar molecule stays joined together: each little orange shape keeps its whole outline as it moves.</p><p>This is <dfn data-def="A substance spreading into particles among another substance, making a mixture that looks the same throughout.">dissolving</dfn>. The water is still liquid and the sugar has mixed through it on a scale far too small to see. Everything in the glass weighs 20 grams more than before we added the sugar: 120 grams instead of the water's 100.</p>`
		},
		{
			id: 'salt',
			chapter: 'disappear',
			title: 'Salt comes apart differently',
			scene: 'glasses',
			duration: 22,
			body: `<p>A grain of table salt is a stack of two kinds of tiny charged particle. These are called <dfn data-def="A tiny particle with an electric charge. Dissolved table salt separates into positively charged sodium ions and negatively charged chloride ions.">ions</dfn>: sodium (purple, plus) and chloride (green, minus), as the key shows.</p><p>Water pulls the two kinds out of the stack and surrounds them. In the salt glass they travel separately; in the sugar glass each sugar molecule stays joined. The drawings are symbols, not the real shapes or sizes of the particles.</p><p>Here two spoonfuls have gone into each glass. The sugar all dissolves. Almost all the salt does, but a little stays on the bottom. In water, salt’s sodium and chloride particles move about separately, while each sugar molecule stays in one piece.</p>`,
			notes: `<p>Water's uneven sharing of electric charge lets it attract the charged ions in salt and parts of a sugar molecule. The atoms within each sugar molecule stay bonded; bonds between neighbouring sugar molecules are replaced by attractions involving water. See ACS Middle School Chemistry, lessons 5.3 and 5.4.</p>`
		},
		{
			id: 'full',
			chapter: 'enough',
			title: 'The water takes only so much',
			scene: 'glasses',
			duration: 24,
			controls: [spoons],
			body: `<p>Add more with the slider. At room temperature this much water can dissolve about 204 grams of sugar, a little over ten of our spoonfuls. It can dissolve only about 36 grams of salt: 1.8 spoonfuls, less than two.</p><p>In a real glass, the liquid level rises as sugar dissolves: dissolved particles take up space too. Our picture keeps the level fixed to show the particles clearly, so it cannot tell you how full a real glass would be.</p><p>After that, extra grains stay on the bottom. A mixture at its limit is <dfn data-def="Holding as much dissolved substance as it can at this temperature, in balance with any solid left over.">saturated</dfn>.</p><p>It has not run out of empty gaps. Particles still leave a grain, and dissolved particles still join grains. At saturation the two balance. The pair of arrows shows that exchange: things keep moving even when the total dissolved amount stays the same.</p>`
		},
		{
			id: 'warm',
			chapter: 'enough',
			title: 'Warm the water',
			scene: 'glasses',
			duration: 24,
			controls: [warm],
			body: `<p>Now each glass has sixteen spoonfuls in it, 320 grams. Keep that amount fixed and warm both glasses with the thermometer slider. We let them settle at each temperature, with no water escaping.</p><p>At 20 °C a pile of sugar remains. At 80 °C it all dissolves: the warmer water could take about eighteen spoonfuls altogether. The salt changes very little: warming from 20 to 80 °C lets this glass dissolve only about two extra grams. The limit written above each glass keeps rising even after the last sugar grain has dissolved.</p><p>Warming can change how much dissolves, not just how quickly. Different substances respond differently. These amounts come from measurements of sugar and salt, not a rule that every solid dissolves much better in hot water.</p>`,
			notes: `<p>The model joins the measured values in the ACS table with straight segments between the temperatures tested. It calculates the settled amount, not a clock for dissolving or crystal growth. Stirring and breaking grains up often make settling faster; they do not change the final limit at the same temperature and amount of water. The picture enlarges a sample and does not predict the liquid's volume.</p>`
		},
		{
			id: 'cool',
			chapter: 'recover',
			title: 'Cool it back down',
			scene: 'glasses',
			duration: 22,
			controls: [cool],
			body: `<p>Start with the same sixteen spoonfuls at 80 °C, then slide the thermometer down. The water's limit falls. Some dissolved sugar gathers back into grains; at 0 °C about seven spoonfuls are solid again.</p><p>The water has not made new sugar. Count everything together: dissolved sugar plus the pile still make sixteen spoonfuls. Salt's limit changes much less, so its pile changes very little.</p><p>We show the result once the mixture has settled, with a grain available for particles to join. In a real glass, crystals can take time to start growing; sometimes more sugar stays dissolved for a while than this settled limit allows.</p>`
		},
		{
			id: 'dry',
			chapter: 'recover',
			title: 'Let the water dry away',
			scene: 'glasses',
			duration: 24,
			controls: [dry],
			body: `<p>Here we start again with ten spoonfuls of each solid in room-temperature water. Let the water dry away with the slider. The blue dots leave. The sugar and salt particles stay.</p><p>Less water can hold less dissolved solid, so more particles join the grains at the bottom. When all the water is gone, each glass holds 200 grams of solid: exactly the ten spoonfuls we put in.</p><p>Drying the water away slowly recovers the sugar or salt. Strong heating would be a different experiment: sugar can change chemically, so this picture is gentle evaporation, not cooking it over a flame.</p>`
		},
		{
			id: 'next',
			chapter: 'recover',
			title: 'Not gone, just spread out',
			scene: 'glasses',
			duration: 18,
			body: `<p>Both glasses are dry. The sugar and salt that seemed to disappear are here again. Dissolving spread their particles among the water particles; taking the water away let them gather back together.</p><p>Each amount of water has a limit at a given temperature. Warming raises that limit a great deal for sugar, and only a little for table salt. When a mixture sits at its limit, particles still leave and join the grains in balance.</p><p>Next, <a href="../states-of-matter/">states of matter</a> shows how a solid melts: its particles move out of their fixed places as it warms. <a href="../chemical-bonds/">Chemical bonds</a> looks closer at what holds particles together, and <a href="../salt-and-ice/">salt and ice</a> shows how dissolved salt changes freezing.</p><p class="source">Measured amounts: <a href="https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson6.html" target="_blank" rel="noreferrer">ACS Middle School Chemistry, lesson 5.6</a>; particle explanations: <a href="https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson3.html" target="_blank" rel="noreferrer">lesson 5.3</a> and <a href="https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson4.html" target="_blank" rel="noreferrer">lesson 5.4</a>. The numbers are published facts; the model and drawings are our own.</p>`
		}
	]
};
