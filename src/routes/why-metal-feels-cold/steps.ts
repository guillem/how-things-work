import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const room: Control = {
	type: 'range',
	id: 'room',
	label: 'Room temperature',
	min: 5,
	max: 45,
	step: 1,
	default: 20,
	unit: '°C'
};

export const spec: ExplainerSpec = {
	slug: 'why-metal-feels-cold',
	title: 'Why metal feels cold',
	summary:
		'A metal spoon feels colder than a wooden one on the same table. Check their thermometers, move a finger from one object to another, then warm the room and watch the familiar order reverse.',
	chapters: [
		{ id: 'touch', title: 'One table, four objects' },
		{ id: 'heat', title: 'Follow the heat' },
		{ id: 'reverse', title: 'Turn it round' }
	],
	steps: [
		{
			id: 'table',
			chapter: 'touch',
			title: 'Which one is colder?',
			scene: 'table',
			duration: 16,
			body: `<p>A metal spoon, a wooden spoon, a plastic cup and a woollen glove have been sitting on the kitchen table all night. Touch them in your imagination. Which feels coldest?</p><p>Now look at the thermometers. Every object is at 20 °C: the temperature of the room. The spoon has not found a special store of cold. After enough time in the same room, these objects settle to the same temperature.</p><p>Your hand is warmer. The skin of the finger in our picture starts at 33 °C. What happens when the two meet?</p>`
		},
		{
			id: 'finger',
			chapter: 'touch',
			title: 'Try a finger on each one',
			scene: 'table',
			duration: 22,
			body: `<p>Drag the orange dot above the objects to move the finger, or focus it and use the arrow keys. The dial shows the temperature right where skin and object first meet in our ideal model: we pretend that the surfaces touch perfectly, with no tiny gaps.</p><p>In that model, the tiny skin patch drops to about 21 °C on the metal, stays near 28 °C on the wood and hardly changes on loose wool. Real surfaces resist the heat passing between them, so a real finger cools less, especially on metal; these numbers describe the ideal model. The objects began equally warm, but the skin does not stay equally warm.</p><p>Each move tries a fresh, warm finger on an untouched patch. This is the first touch, not what happens after holding the spoon for a long time.</p>`
		},
		{
			id: 'flow',
			chapter: 'heat',
			title: 'Heat leaves your hand',
			scene: 'table',
			duration: 20,
			body: `<p>The strip below opens up a tiny patch where skin meets metal. Orange-red means warmer and blue means cooler. The strip uses the two starting temperatures as its colour range, so even a small change can be seen; the thermometers keep the same colour key across rooms. The coloured dots follow the direction of heat: out of the warmer finger and into the cooler spoon.</p><p><dfn data-def="Energy passing from something warmer to something cooler because their temperatures differ.">Heat</dfn> is moving. Cold is not a substance flowing the other way. The touch cools the skin, which is part of why metal feels cold.</p><p>The strip greatly enlarges the surface. Heat spreads into the object as well as out of the skin; it does not instantly cool your whole finger.</p>`
		},
		{
			id: 'compare',
			chapter: 'heat',
			title: 'Fast into metal, slowly into wool',
			scene: 'table',
			duration: 22,
			body: `<p>Move the finger again. Metal carries heat away from the contact patch quickly, so more warmth can leave your skin. Wood and plastic carry it away much less quickly. The air caught among the wool fibres makes a particularly slow path.</p><p>The little bars compare how much heat leaves the same small patch of skin in the same first instant. Metal takes most; loose wool takes very little. On the strip, the skin side shows how much the finger has cooled. On the metal side, warmth spreads far but barely raises the temperature.</p><p>How quickly the patch warms also depends on how much material is there and how much heat each bit needs to warm by one degree. The model uses both heat carrying and heat storage, rather than conductivity alone.</p>`,
			notes: `<p>The model uses each material's measured conductivity, density and heat capacity together. It treats skin and object as thick, flat pieces in perfect contact, for their first tenth of a second together. A real cup or spoon is thin and curved. Tiny gaps between skin and object resist heat flow and keep the skin warmer than our ideal cold-room figures, especially on metal; contact pressure, moisture and surface roughness matter. Our spoon uses aluminium properties; a steel spoon still feels cold, but gives a different number. The cup uses PVC properties as a representative plastic; other cup plastics change the numbers too. Loose wool here uses insulation-grade wool-and-air properties, not a measured glove. The dial is a contact temperature, not a numerical prediction of how cold you will say it feels.</p>`
		},
		{
			id: 'room',
			chapter: 'reverse',
			title: 'Make the room warmer',
			scene: 'table',
			duration: 24,
			controls: [room],
			body: `<p>Here the finger stays on the metal spoon, while the four numbers compare the same ideal first touch on every object. We keep the finger starting at 33 °C; a real hand would cool in a cold room and warm in a hot one. Use the slider to warm the whole room; every object has time to reach the new room temperature before we try touching it.</p><p>As the room approaches the finger's starting temperature, the flow shrinks. At 33 °C, neither side is warmer, so no heat passes between them.</p><p>Go above 33 °C. Now the objects start warmer than your hand. The dots reverse: heat enters the finger. The metal gives it up fastest and now feels hottest. The same property that made metal feel cold has changed sides.</p>`
		},
		{
			id: 'equal',
			chapter: 'reverse',
			title: 'Your skin is not a thermometer',
			scene: 'table',
			duration: 18,
			body: `<p>Here all four objects start at 40 °C. Compare the model’s skin temperatures after an ideal first touch: the metal brings that little patch of skin closest to 40 °C; the wool changes it least.</p><p>The thermometers still agree about the objects. The finger tells a different story because it responds to what is happening to the skin. Touch depends on the starting temperature of your hand as well as on the thing you touch.</p><p>A metal spoon can feel cold or hot. Neither feeling tells you its temperature on its own.</p>`
		},
		{
			id: 'glove',
			chapter: 'reverse',
			title: 'A glove does not make heat',
			scene: 'table',
			duration: 18,
			body: `<p>Back in the cool kitchen, the finger touches the wool. Only a little warmth passes into it. The glove does not add warmth; it slows the loss of warmth that is already in your hand.</p><p>That is why trapping air is useful in gloves, blankets and coats. Squashing the wool, getting it wet or touching it differently changes how well it slows the heat.</p><p>Our table compares the first touch of the materials. A whole glove keeping a hand warm for an hour is a bigger problem, involving air, wind and the heat your body keeps making.</p>`
		},
		{
			id: 'next',
			chapter: 'reverse',
			title: 'Same temperature, different touch',
			scene: 'table',
			duration: 18,
			body: `<p>Four objects can be at the same temperature and feel very different. Metal changes your skin's temperature quickly because it carries heat away so fast that the patch you touch hardly warms up. Fluffy wool and its trapped air carry heat away slowly, and there is little material near the surface to warm: it soon warms towards your skin's temperature and takes little more heat.</p><p>Heat goes from warmer to cooler. Warm the objects above your hand's temperature and the order flips: metal feels hottest.</p><p>Next, <a href="../states-of-matter/">states of matter</a> looks inside the materials at their moving particles. Or try <a href="../salt-and-ice/">salt and ice</a>, where melting takes heat out of a bowl and makes it colder.</p><p class="source">Model: early-time heat conduction with material properties from <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6422506/" target="_blank" rel="noreferrer">Rykaczewski (2019)</a>, <a href="https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=101567" target="_blank" rel="noreferrer">NIST's material-property report</a> and <a href="https://www.intpetro.com/wp-content/uploads/2015/08/NatuWool_Technical_Sheet.pdf" target="_blank" rel="noreferrer">Black Mountain's sheep’s-wool insulation data</a>. Published numerical facts; drawings are our own.</p>`
		}
	]
};
