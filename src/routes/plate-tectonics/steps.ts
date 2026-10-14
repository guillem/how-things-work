import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const lon: Control = {
	type: 'range',
	id: 'lon',
	label: 'Centre the map on',
	min: -180,
	max: 180,
	step: 5,
	default: 150,
	format: (v) =>
		v === 0 ? '0°' : Math.abs(v) === 180 ? '180°' : `${Math.abs(v)}° ${v < 0 ? 'W' : 'E'}`,
	help: 'Or drag the map sideways.'
};

const boundaries: Control = {
	type: 'toggle',
	id: 'boundaries',
	label: 'Show the plate boundaries',
	default: true
};

const km = (v: number) => `${Math.round(Math.abs(v))} km`;

/** How far the plates have moved, for one step (each step keeps its own setting). */
const moved = (id: string, min: number, max: number, def: number, label: string): Control => ({
	type: 'range',
	id,
	label,
	min,
	max,
	step: 10,
	default: def,
	format: km,
	help: 'Or drag the round handle on the plate.'
});

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Speed of the plates',
	min: 1,
	max: 15,
	step: 0.5,
	default: 5,
	format: (v) => `${v} cm a year`
};

const crust: Control = {
	type: 'range',
	id: 'crust',
	label: 'Thickness of the continent’s crust',
	min: 20,
	max: 70,
	step: 1,
	default: 35,
	unit: ' km'
};

const crustType = (id: string, label: string, def: 'ocean' | 'continent'): Control => ({
	type: 'select',
	id,
	label,
	default: def,
	options: [
		{ value: 'ocean', label: 'Ocean floor' },
		{ value: 'continent', label: 'Continent' }
	]
});

const sbNormal: Control = {
	type: 'range',
	id: 'sbNormal',
	label: 'Apart (+) or together (−)',
	min: -1200,
	max: 1500,
	step: 10,
	default: 0,
	format: (v) => (v === 0 ? '0 km' : `${v > 0 ? 'apart' : 'together'} ${km(v)}`),
	help: 'Or drag the round handle on the plate, in any direction.'
};
const sbSlide: Control = {
	type: 'range',
	id: 'sbSlide',
	label: 'Sideways',
	min: -300,
	max: 300,
	step: 10,
	default: 0,
	format: km
};

export const spec: ExplainerSpec = {
	slug: 'plate-tectonics',
	title: 'Plate tectonics and volcanoes',
	summary:
		'See where ten years of earthquakes and every active volcano lie on a world map, then push two plates together, pull them apart or slide them past each other and watch trenches, mountains, rift valleys and volcanoes form.',
	chapters: [
		{ id: 'map', title: 'Where the Earth shakes' },
		{ id: 'plates', title: 'What a plate is' },
		{ id: 'apart', title: 'Pulling apart' },
		{ id: 'together', title: 'Pushing together' },
		{ id: 'sideways', title: 'Sliding past' },
		{ id: 'whole', title: 'The whole picture' }
	],
	steps: [
		// ------------------------------------------------------------------ map
		{
			id: 'pattern',
			chapter: 'map',
			title: 'Ten years of earthquakes',
			scene: 'map',
			hints: { phase: 'pattern' },
			duration: 24,
			controls: [lon],
			body: `
<p>Each dot on this map is a strong earthquake — magnitude 5.5 or more — recorded somewhere on Earth between 2015 and 2024: 4,516 of them. Watch them flash up as the years go by. Each orange triangle is a volcano that has erupted in the last 12,000 years or so.</p>
<p>They are not scattered at random. They crowd into long, narrow belts: all the way round the Pacific Ocean (the "Ring of Fire"), down the middle of the Atlantic, and across from the Mediterranean to the Himalayas. Huge areas — most of Africa, Australia, Brazil, the middle of the oceans — barely shake at all. Drag the map round and look for the pattern.</p>`,
			notes: `<p>The earthquakes are from the <dfn data-def="The US Geological Survey's catalogue of earthquakes worldwide, built from thousands of seismometers.">USGS earthquake catalogue</dfn>, the volcanoes from the Smithsonian's Global Volcanism Program list of the 1,214 volcanoes active since the last ice age (the Holocene). The map stretches the polar regions sideways, as every flat map of the whole globe has to distort something.</p>`
		},
		{
			id: 'plates',
			chapter: 'map',
			title: 'A cracked shell',
			scene: 'map',
			hints: { phase: 'plates' },
			duration: 26,
			controls: [lon, boundaries],
			body: `
<p>The belts trace the edges of <dfn data-def="Large, rigid slabs of rock about 100 km thick that together make up the Earth's outer shell. They move slowly relative to each other.">tectonic plates</dfn>. The Earth's outer shell is not one piece: it is broken into plates that fit together like a cracked eggshell and move, very slowly, relative to each other. Seven big ones cover most of the planet; this map, from the geophysicist Peter Bird, has 52 in all.</p>
<p>The colours tell how neighbouring plates move: <strong class="pt-apart">apart</strong>, <strong class="pt-together">together</strong>, or <strong class="pt-sideways">sliding past each other</strong>. Most of the action happens there: <strong>86%</strong> of the earthquakes on the map struck within 200 km of a plate boundary — a band that covers only 17% of the Earth's surface.</p>
<p>The plates move a few centimetres a year. The two sides of the Atlantic drift apart by about 2.5 cm a year — about as fast as your fingernails grow; parts of the Pacific floor spread at 10 cm a year or more. Over millions of years, that adds up to oceans.</p>`,
			notes: `<p>The boundaries are model PB2002 (Bird, 2003). Its speeds come from measured plate motions: the patterns of the sea floor's magnetism and, today, GPS stations that track the ground to the millimetre. The "86%" counts the distance from each epicentre (the point on the surface above the earthquake) to the nearest boundary line.</p>`
		},
		// ------------------------------------------------------------------ plates
		{
			id: 'layers',
			chapter: 'plates',
			title: 'Floating rock',
			scene: 'section',
			hints: { phase: 'layers' },
			duration: 22,
			controls: [crust],
			body: `
<p>Cut through the edge of a continent and look from the side. A plate is the <dfn data-def="The rigid outer layer of the Earth: the crust plus the cold top of the mantle beneath it, about 100 km thick under the oceans and more under the continents.">lithosphere</dfn>: the <dfn data-def="The thin outermost layer of rock: about 7 km thick under the oceans, 35 km on average under the continents.">crust</dfn> plus the cold, stiff top of the <dfn data-def="The thick layer of hot rock between the crust and the Earth's iron core, 2,900 km deep.">mantle</dfn> beneath it. Under it lies the <dfn data-def="The layer of the mantle under the plates, from about 100 to 300 km deep. It is hot, solid rock that can flow very slowly, like a glacier.">asthenosphere</dfn>, hot rock that is solid but soft enough to creep slowly. The plates are not floating on a sea of molten lava.</p>
<p>There are two kinds of crust. <strong>Ocean floor</strong> is thin (about 7 km) and made of dense dark basalt. <strong>Continents</strong> are thick (about 35 km) and made of lighter rocks such as granite. The plates float on the mantle like ice on water: lighter, thicker crust floats higher, which is why continents stand above the sea and ocean floors lie 3–6 km below it. Thicken the continent's crust and watch it rise — over a root that goes down more than five times as far as the land goes up.</p>`,
			notes: `<p>This balance is called <dfn data-def="The balance of the Earth's crust floating on the denser mantle, like ice on water: each column of rock sinks until it displaces its own weight.">isostasy</dfn>. With crust of density 2.8 g/cm³ on mantle of 3.3 g/cm³, every extra kilometre of crust lifts the surface by 1 − 2.8/3.3 ≈ 0.15 km, and the other 0.85 km goes into the root. The vertical scale of this cross-section is stretched in its top 30 km (see the depths on the left), or the crust would be too thin to see.</p>`
		},
		// ------------------------------------------------------------------ apart
		{
			id: 'ridge',
			chapter: 'apart',
			title: 'A mid-ocean ridge',
			scene: 'section',
			hints: { phase: 'ridge', left: 'ocean', right: 'ocean', mode: 'apart' },
			duration: 24,
			controls: [moved('ridgeOpen', 0, 1500, 600, 'How far the plates have moved apart'), speed],
			body: `
<p>Where two ocean plates pull apart, the mantle rock underneath rises to fill the gap. As it rises, the pressure on it drops and part of it melts — not because it gets hotter, but because rock melts more easily at low pressure. The <dfn data-def="Molten rock underground. Once it erupts at the surface it is called lava.">magma</dfn> erupts along the crack and freezes into new ocean floor. Drag the plates apart (or use the slider): the bands of colour are the ages of the sea floor, new and hot at the centre, older and colder outwards.</p>
<p>As the new floor ages it cools, contracts and sinks: 2.6 km below the sea at the crest, 5 km after 50 million years. That is why there is a long underwater mountain range — a <dfn data-def="An underwater mountain range where two plates spread apart and new ocean floor is made, such as the Mid-Atlantic Ridge.">mid-ocean ridge</dfn> — down the middle of the Atlantic, 16,000 km long. Speed up the plates: a fast ridge spreads the young, shallow floor out into a broad rise; a slow one keeps a narrow ridge with a valley along its crest.</p>`,
			notes: `<p>The depth follows the measured depth of the oceans against the age of the sea floor (Stein and Stein, 1992). The sea floor also records the Earth's magnetic field, which flips every few hundred thousand years: the new rock locks in the field of the moment, so the floor carries stripes of alternating magnetism, mirrored on each side of the ridge. Finding those stripes in the 1960s convinced geologists that the sea floor really does spread. Iceland is a piece of the Mid-Atlantic Ridge standing above the sea, where extra magma has built it up.</p>`
		},
		{
			id: 'rift',
			chapter: 'apart',
			title: 'A continent splits',
			scene: 'section',
			hints: { phase: 'rift', left: 'continent', right: 'continent', mode: 'apart' },
			duration: 26,
			controls: [moved('riftOpen', 0, 1200, 100, 'How far the plates have moved apart')],
			body: `
<p>A continent can be pulled apart too. Its crust stretches and thins like toffee, and the middle drops down between faults into a long <dfn data-def="A long valley that forms where the crust is being stretched and the middle drops down between faults.">rift valley</dfn>, with earthquakes and volcanoes: East Africa is splitting this way today, with volcanoes such as Ol Doinyo Lengai along its rift.</p>
<p>Keep pulling. The valley floor sinks below sea level and the sea floods in, as in the Red Sea. Once the crust has been stretched to about a quarter of its thickness it breaks, and a new mid-ocean ridge starts making ocean floor between the two halves. The Atlantic was born like this: South America and Africa began to split apart about 130 million years ago — which is why their coasts fit together like jigsaw pieces.</p>`,
			notes: `<p>The sinking of the stretched crust follows McKenzie's model of rifting (1978): crust and mantle are thinned by the same factor, and the floor subsides as the light crust is replaced by heavier mantle. The model leaves out the extra heat under many young rifts, which holds them up: East Africa sits on a broad dome 1–2 km high, raised by hot mantle rising beneath it. When the crust breaks is set here at a stretch of four times, a typical value for the edges of the Atlantic.</p>`
		},
		// ------------------------------------------------------------------ together
		{
			id: 'subduction',
			chapter: 'together',
			title: 'Ocean meets continent',
			scene: 'section',
			hints: { phase: 'subduction', left: 'ocean', right: 'continent', mode: 'together' },
			duration: 26,
			controls: [moved('subClose', 0, 1200, 700, 'How far the plates have moved together')],
			body: `
<p>If ocean floor is made at the ridges and the Earth is not growing, it must be destroyed somewhere. Push an ocean plate against a continent: the heavier ocean plate bends down and sinks beneath the continent back into the mantle. This is <dfn data-def="The sinking of one plate beneath another into the mantle, at a deep ocean trench.">subduction</dfn>. Where it goes down, the sea floor plunges into a deep <dfn data-def="A long, narrow, very deep valley in the sea floor where one plate sinks beneath another.">trench</dfn>, 8 km or more deep.</p>
<p>Watch where the volcanoes appear: not at the trench, but 150–300 km inland, where the sinking plate has reached a depth of about 100 km. There the warmth squeezes water out of the old, wet sea-floor rocks; the water rises into the hot mantle above and lowers its melting point, so it melts. The magma rises to build a line of volcanoes, an <dfn data-def="A chain of volcanoes above a subduction zone, parallel to the trench.">arc</dfn>: the Andes, the Cascades with Mount St. Helens. Push slowly from the start: the volcanoes wait for the plate to get deep enough.</p>
<p>The sinking plate grinds and cracks as it goes, so the earthquakes follow it down, deeper and deeper under the continent. Here the Nazca plate sinks under South America at about 7 cm a year; the biggest earthquakes on Earth happen on such boundaries.</p>`,
			notes: `<p>The magma does not come from friction, and the sinking plate does not melt itself: it is the mantle above it, its melting point lowered by water, that melts. Volcanoes sit on average where the top of the sinking plate is about 105 km deep (Syracuse and Abers, 2006). The bend of the plate into the trench is computed as the bending of an elastic plate, which also raises a low bulge, a few hundred metres high, on the ocean side of the trench. The volcano heights and the slab's shape are drawn to a typical pattern; the depth scale is stretched near the surface.</p>`
		},
		{
			id: 'island-arc',
			chapter: 'together',
			title: 'Ocean meets ocean',
			scene: 'section',
			hints: { phase: 'island-arc', left: 'ocean', right: 'ocean', mode: 'together' },
			duration: 24,
			controls: [moved('arcClose', 0, 1200, 700, 'How far the plates have moved together')],
			body: `
<p>When two ocean plates meet, one of them has to go down: the older one, because ocean floor gets colder and heavier as it ages. Here the left plate is 60 million years old and the right one 30, so the left one sinks.</p>
<p>The same thing happens as under a continent: a trench, earthquakes going down with the sinking plate, and volcanoes where it reaches about 100 km depth. But now the volcanoes start on the sea floor. Keep pushing and watch them grow until they break the surface as a curved chain of volcanic islands, an <strong>island arc</strong>: the Aleutians, the Mariana Islands, Tonga. Next to the Marianas lies the deepest place in the oceans, the Challenger Deep, almost 11 km down.</p>`
		},
		{
			id: 'collision',
			chapter: 'together',
			title: 'Continent meets continent',
			scene: 'section',
			hints: { phase: 'collision', left: 'continent', right: 'continent', mode: 'together' },
			duration: 26,
			controls: [moved('colClose', 0, 1200, 600, 'How far the plates have moved together')],
			body: `
<p>Continents are too light to sink. When two of them collide, neither goes down: the crust crumples, stacks up and thickens, and the thick crust floats high, like the thickened continent of the "Floating rock" step. That is how the highest mountains on Earth are made.</p>
<p>India rammed into Asia about 50 million years ago and is still pushing north by a few centimetres a year. The crust there is about 70 km thick, twice the normal, and holds up the Himalayas and the Tibetan Plateau, 5 km high on average. Push harder: once the crust is twice as thick it cannot pile any higher without spreading out under its own weight, so the mountains grow wider instead, into a plateau.</p>
<p>Earthquakes are spread across the whole crumpling region — the Nepal earthquake of 2015, magnitude 7.8, is on the map — but there is <strong>no line of volcanoes</strong>: no plate sinks deep into the mantle, so nothing releases the water that would make the mantle melt.</p>`,
			notes: `<p>The model keeps the amount of crust: every kilometre the plates converge adds 35 km² of crust (per kilometre along the belt) to the mountain range. Before the collision, India was carried north by the sinking of the ocean floor in front of it, under Asia — the ocean–continent boundary of two steps ago — until all that ocean had gone down.</p>`
		},
		// ------------------------------------------------------------------ sideways
		{
			id: 'transform',
			chapter: 'sideways',
			title: 'Sliding past each other',
			scene: 'section',
			hints: { phase: 'transform', left: 'ocean', right: 'continent', mode: 'sideways' },
			duration: 22,
			controls: [moved('slide', -300, 300, 150, 'How far the plates have slid past each other')],
			body: `
<p>Plates can also grind past each other sideways along a <dfn data-def="A plate boundary where two plates slide past each other horizontally, so plate is neither made nor destroyed.">transform fault</dfn>. Drag the plate up or down in the view from above: the road across the boundary is torn and shifted.</p>
<p>Nothing is made and nothing is destroyed, so there are no volcanoes and the cross-section does not change. But the plates don't slide smoothly: they stick, the strain builds up for years, then they slip suddenly in an earthquake. California's San Andreas Fault is one: the Pacific plate slides north-west past North America at about 4.5 cm a year, carrying Los Angeles towards San Francisco. Transform faults also chop the mid-ocean ridges into the zigzags you can see on the map.</p>`,
			notes: `<p>The earthquakes at transform faults are shallow, mostly in the top 20 km, where rock is cold and brittle enough to break. The total shift along the San Andreas is more than 300 km over the last 20 million years or so: rocks on the two sides that were once together are now that far apart.</p>`
		},
		// ------------------------------------------------------------------ whole
		{
			id: 'sandbox',
			chapter: 'whole',
			title: 'Make your own boundary',
			scene: 'section',
			hints: { phase: 'sandbox', mode: 'free' },
			duration: 30,
			controls: [
				crustType('sbLeft', 'Left plate', 'continent'),
				crustType('sbRight', 'Right plate', 'ocean'),
				sbNormal,
				sbSlide,
				speed
			],
			body: `
<p>Now choose what each plate carries and drag them any way you like — apart, together, sideways, or at a slant, which does both at once. The same few rules make every feature:</p>
<ul>
<li>Pulling apart thins and splits continents, and makes new ocean floor at a ridge.</li>
<li>Pushing together sends ocean floor back into the mantle at a trench, with volcanoes above the sinking plate; continents, too light to sink, crumple into mountains.</li>
<li>Sliding past makes earthquakes, but neither makes nor destroys plate.</li>
</ul>
<p>The clock in the corner shows how long it all takes at the speed you set: a few hundred kilometres means millions of years.</p>`
		},
		{
			id: 'depth',
			chapter: 'whole',
			title: 'Sinking plates, seen in earthquakes',
			scene: 'map',
			hints: { phase: 'depth' },
			duration: 24,
			controls: [lon],
			body: `
<p>Back to the real Earth. Now the earthquakes are coloured by how deep they started. Almost everywhere they are <strong class="pt-shallow">shallow</strong>, less than 70 km down: in the brittle top of the plates. <strong class="pt-intermediate">Deeper</strong> ones, and the <strong class="pt-deep">deepest</strong> of all, down to 700 km, only happen near subduction zones — mostly round the Pacific — on the side away from the trench, deeper and deeper the further from it.</p>
<p>They are the sinking plates of the "Ocean meets continent" step, seen in their earthquakes. Look at South America: shallow near the coast, deeper under the Andes, deepest under the Amazon. In 2018 a magnitude 8.2 earthquake struck 600 km beneath Fiji, inside the Pacific plate sinking there.</p>`,
			notes: `<p>These sloping zones of earthquakes are called Wadati–Benioff zones, after the two seismologists who found them in the 1920s–50s. Below about 700 km there are no earthquakes at all: there the rock is too hot and soft to break, even inside the sinking plates.</p>`
		},
		{
			id: 'hotspots',
			chapter: 'whole',
			title: 'Hotspots, and the whole picture',
			scene: 'map',
			hints: { phase: 'hotspots' },
			duration: 26,
			controls: [lon, boundaries],
			body: `
<p>Here the volcanoes are coloured by their setting in the Smithsonian's list: <strong>69%</strong> stand above <strong class="pt-together">subduction zones</strong>, <strong>18%</strong> on <strong class="pt-apart">rifts and ridges</strong> — and <strong>12%</strong> in the middle of a plate, far from any boundary.</p>
<p>Those are the exceptions. Hawaii's volcanoes, among the most active on Earth, are more than 3,000 km from the nearest plate edge. They sit over a <dfn data-def="A place where unusually hot mantle rises from deep down and melts under a plate, far from any plate boundary, such as under Hawaii.">hotspot</dfn>, where unusually hot mantle rises from deep below. The Pacific plate slides over it, so each volcano is carried away from the hotspot and dies, and a new one grows: Hawaii is the young end of a chain of islands and seamounts thousands of kilometres long.</p>
<p>But the rule holds: the Earth's surface is a set of moving plates, and most of its earthquakes, volcanoes and mountain ranges are where the plates meet.</p>`,
			notes: `<p>Settings are those given by the Global Volcanism Program; 79% of all the volcanoes are within 300 km of a boundary line on this map (arc volcanoes stand 150–300 km behind their trench). The ages of the Hawaiian–Emperor chain grow steadily away from Hawaii, up to about 80 million years at its far end near Kamchatka: a record of the Pacific plate's motion over the hotspot.</p>`
		}
	]
};
