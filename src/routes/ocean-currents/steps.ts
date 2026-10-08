import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const trades: Control = {
	type: 'range',
	id: 'trades',
	label: 'Trade winds (from the east)',
	min: 0,
	max: 12,
	step: 0.5,
	default: 7,
	unit: ' m/s'
};

const westerlies: Control = {
	type: 'range',
	id: 'westerlies',
	label: 'Westerlies (from the west)',
	min: 0,
	max: 14,
	step: 0.5,
	default: 9,
	unit: ' m/s'
};

const spin: Control = {
	type: 'select',
	id: 'spin',
	label: 'The Coriolis effect…',
	default: 'earth',
	options: [
		{ value: 'earth', label: 'grows towards the pole' },
		{ value: 'uniform', label: 'is the same everywhere' }
	]
};

const tpole: Control = {
	type: 'range',
	id: 'tpole',
	label: 'Sea temperature in the far north',
	min: -2,
	max: 12,
	step: 0.5,
	default: 5,
	unit: ' °C'
};

const fresh: Control = {
	type: 'range',
	id: 'fresh',
	label: 'Fresh water into the far north (rain, rivers, melting ice)',
	min: 0,
	max: 2.5,
	step: 0.05,
	default: 1,
	format: (v) => (v === 1 ? "today's" : `${v.toFixed(2)} × today's`)
};

const resetOcean: Control = {
	type: 'action',
	id: 'resetOcean',
	label: "Back to today's ocean",
	action: "Back to today's ocean",
	help: 'Restarts from today’s strong overturning, keeping the settings above.'
};

const pacTrades: Control = {
	type: 'range',
	id: 'pacTrades',
	label: 'Pacific trade winds',
	min: 0,
	max: 1.5,
	step: 0.05,
	default: 1,
	format: (v) => (v === 1 ? 'normal' : v === 0 ? 'none' : `${Math.round(v * 100)}% of normal`)
};

const weaken: Control = {
	type: 'range',
	id: 'weaken',
	label: 'How much the trades weaken, for six months',
	min: 0,
	max: 0.45,
	step: 0.05,
	default: 0.3,
	format: (v) => `${Math.round(v * 100)}%`
};

const feedback: Control = {
	type: 'range',
	id: 'feedback',
	label: 'How strongly the winds answer the sea (Bjerknes feedback)',
	min: 0,
	max: 1.1,
	step: 0.05,
	default: 1,
	format: (v) => (v === 0 ? 'not at all' : v === 1 ? 'as on Earth' : `${v.toFixed(2)} × Earth's`)
};

const burst: Control = {
	type: 'action',
	id: 'burst',
	label: 'Weaken the trade winds',
	action: 'Weaken the trade winds',
	help: 'Starts the clock again with a fresh six-month lull in the trades.'
};

export const spec: ExplainerSpec = {
	slug: 'ocean-currents',
	title: 'How the ocean moves heat',
	summary:
		'Blow wind over an ocean and watch great gyres and the Gulf Stream form, chill and freshen the North Atlantic to speed up or stall the deep overturning, and weaken the Pacific trade winds to set off an El Niño.',
	chapters: [
		{ id: 'wind', title: 'Driven by the wind' },
		{ id: 'deep', title: 'The deep, slow circulation' },
		{ id: 'enso', title: 'El Niño' }
	],
	steps: [
		// ------------------------------------------------------------------ wind
		{
			id: 'ekman',
			chapter: 'wind',
			title: 'The wind drags the sea — sideways',
			scene: 'gyre',
			hints: { phase: 'ekman' },
			duration: 24,
			controls: [trades, westerlies],
			body: `
<p>The atmosphere is not alone in carrying heat from the equator towards the poles: the ocean does a large share of the job, especially in the tropics. Water holds a lot of heat — the top few metres of the sea store as much as the whole atmosphere above it.</p>
<p>The ocean is set moving, first of all, by the wind. Here is an ocean basin like the North Atlantic, with the <strong>trade winds</strong> blowing from the east in the south and the <strong>westerlies</strong> from the west further north. The wind drags the surface water along, but the moving water is turned by the Coriolis effect, like the wind itself. Added up over the top hundred metres or so, the water ends up moving at <em>right angles</em> to the wind — to the right in the northern hemisphere. This is <dfn data-def="The net drift of the wind-stirred surface layer of the ocean, at right angles to the wind: to its right in the northern hemisphere, to its left in the southern.">Ekman transport</dfn>.</p>
<p>So the trades push water north, the westerlies push it south, and in between, around 30°N, the water piles up into a broad, low hill.</p>`,
			notes: `<p>On his ship <i>Fram</i>, frozen into the Arctic ice in 1893–96, Fridtjof Nansen noticed that the ice drifted 20–40° to the right of the wind. Vagn Walfrid Ekman worked out why in 1905. The transport per metre is the wind's push on the sea (its stress τ) divided by the water's density and the Coriolis parameter f = 2Ω sin(latitude). The hill in the middle of a real subtropical gyre stands about a metre above the ocean's edges.</p>`
		},
		{
			id: 'gyres',
			chapter: 'wind',
			title: 'Gyres: great wheels of water',
			scene: 'gyre',
			hints: { phase: 'gyres' },
			duration: 26,
			controls: [trades, westerlies],
			body: `
<p>Water tries to run downhill off the hill, but the Coriolis effect turns it to the right again, until it flows <em>around</em> the hill instead of down it — just as the wind blows around a high on a weather map. The result is a huge, slowly turning wheel of water, clockwise in the northern hemisphere: a <dfn data-def="A large loop of ocean currents filling an ocean basin, driven by the winds above it.">gyre</dfn>. North of it, under the far side of the westerlies, a second gyre turns the other way.</p>
<p>Ocean currents are measured in <dfn data-def="Sverdrup: a flow of one million cubic metres of water per second. All the world's rivers together carry about 1.2 sverdrups into the sea.">sverdrups</dfn>, millions of cubic metres per second. With these winds the model's warm gyre carries about 20 of them round — more than fifteen times all the world's rivers together. Change the winds: what drives a gyre is how the wind <em>changes</em> from one latitude to the next, so the border between the two gyres lies under the strongest westerlies.</p>
<p>Every ocean has gyres like these: five great warm ones, clockwise in the northern hemisphere and anticlockwise in the southern.</p>`,
			notes: `<p>The flow drawn is Henry Stommel's 1948 model: a flat-bottomed, rectangular ocean 6,000 km wide from 15°N to 65°N, driven by the winds on the left, with gentle friction at the sea floor. The particles move at the speed of the flow; the lines are lines of equal flow, the gyre's streamlines. Real gyres are shaped by coastlines, sea-floor mountains and eddies, and are strongest near the surface.</p>`
		},
		{
			id: 'gulf-stream',
			chapter: 'wind',
			title: 'Why the Gulf Stream hugs the west',
			scene: 'gyre',
			hints: { phase: 'western' },
			duration: 26,
			controls: [spin, trades, westerlies],
			body: `
<p>Look at where the water goes. Across most of the ocean the gyre drifts slowly south; then it all comes back north in one narrow, fast current squeezed against the <strong>western</strong> coast — in the model, more than forty times faster than the drift in the open ocean. In the Atlantic that current is the <dfn data-def="The fast, warm current that flows north along the east coast of North America and then across the Atlantic towards Europe; the western boundary current of the North Atlantic gyre.">Gulf Stream</dfn>; in the Pacific, the Kuroshio off Japan. They carry warm tropical water far towards the poles.</p>
<p>Why the west? Henry Stommel found the answer in 1948: because the Coriolis effect grows stronger towards the poles. Make it the same at every latitude and the gyre becomes symmetric, with gentle currents on both sides. Put the change back and the return flow piles up against the west.</p>
<p>The real Gulf Stream is stronger than the model's: about 30 sverdrups pass Florida, and several times that further downstream. Part of it is the deep circulation of the next chapter, and part comes from eddies that this simple, smooth model leaves out.</p>`,
			notes: `<p>The reason is the bookkeeping of spin. The Earth's spin about the local vertical, which water shares, grows towards the pole. In the open ocean the twist that the wind gives the water is balanced by a slow drift towards the equator, where that spin is weaker. Coming back north, the water must get rid of the extra spin it would gain, and only friction against the coast in a narrow, fast current can do that — and only on the western side does that friction twist in the right direction. Without that change, only friction is left to hold back the wind's push, and in this model the symmetric gyre then turns faster overall. Real western boundary currents are about 100 km wide and run at up to 2 m/s.</p>
<p>The model's 20 sverdrups are the wind-driven part only. The real Gulf Stream carries about 31 sverdrups through the Straits of Florida (measured by a telephone cable across the strait since 1982), and roughly 13 of them are the warm upper branch of the overturning circulation, not the wind gyre. After it leaves the coast at Cape Hatteras its transport grows several-fold — estimates range from about 70 to 150 sverdrups, depending on where and how it is measured — because the current's own momentum and its eddies spin up tight recirculating loops beside it. Stommel's model is linear and dominated by friction, so it has neither the overturning nor those loops.</p>`
		},
		// ------------------------------------------------------------------ deep
		{
			id: 'sinking',
			chapter: 'deep',
			title: 'Cold, salty water sinks',
			scene: 'overturn',
			hints: { phase: 'density' },
			duration: 24,
			controls: [tpole, fresh],
			body: `
<p>The winds stir only the top few hundred metres. Below, most of the ocean is dark and cold — mostly below 4 °C — and it is filled from the top, at a few places near the poles.</p>
<p>How dense sea water is depends on its temperature and on its <dfn data-def="How much salt is dissolved in the water, in grams per kilogram (practical salinity units, psu). The open ocean averages about 35.">salinity</dfn>: <strong>colder water is denser, and so is saltier water</strong>. The Gulf Stream carries warm, salty water north. In the winter seas around Greenland it cools until it is denser than the water beneath it, and it sinks, thousands of metres down. (The same happens near Antarctica.)</p>
<p>The picture is a slice through the Atlantic, warm tropics on the left, far north on the right. Warm the northern sea or freshen it, and see what happens to its density — and to the sinking.</p>`,
			notes: `<p>The model is Henry Stommel's of 1961: two boxes of water, tropical and polar, joined at the top and the bottom. The flow between them is proportional to how much denser the polar water is, with density changing by 0.17 kg/m³ per °C and 0.78 kg/m³ per unit of salinity (a straight-line fit around 10 °C). The tropical box stays at 25 °C; the temperature of the polar box is the slider.</p>`
		},
		{
			id: 'conveyor',
			chapter: 'deep',
			title: 'A slow conveyor of heat',
			scene: 'overturn',
			hints: { phase: 'conveyor' },
			duration: 26,
			controls: [tpole, fresh],
			body: `
<p>Water that sinks in the north must be replaced, so warm surface water is drawn north after it, while the deep water creeps south and eventually rises again far away. This loop is the <dfn data-def="The ocean circulation driven by differences in density (from temperature and salinity): sinking near the poles, a slow deep return flow, and rising elsewhere. Also called the thermohaline circulation.">overturning circulation</dfn>. Its Atlantic branch has been measured continuously across 26.5°N since 2004 (the RAPID array): about 17 sverdrups, carrying about 1.2 petawatts of heat north.</p>
<p>The model is set to the same 17 sverdrups; moving water 20 °C warmer north than it returns, it carries about 1.4 petawatts. A cold far north drives it harder; a warmer or fresher one slows it down — and with it the heat it brings north.</p>
<p>It is slow: water that sinks off Greenland may not see the surface again for many centuries, about a thousand years for the full circuit round the world's oceans.</p>`,
			notes: `<p>The sinking is only half the story: in reality the deep water is brought back up mostly by the strong westerly winds around Antarctica and by mixing. The model leaves that out and keeps only the density difference, the part the reader can change here.</p>`
		},
		{
			id: 'tipping',
			chapter: 'deep',
			title: 'Can it stall?',
			scene: 'overturn',
			hints: { phase: 'tipping' },
			duration: 30,
			controls: [fresh, tpole, resetOcean],
			body: `
<p>Fresh water — rain, rivers, melting ice — makes the northern water lighter, so it sinks less readily. Then less salty water is brought north, so the far north freshens further, and the overturning weakens again: a self-reinforcing loop.</p>
<p>Push the fresh water up. Past a <dfn data-def="A threshold past which a system switches to a different state, and does not switch back simply by undoing the change that pushed it over.">tipping point</dfn> — in this model about 1.6 times today's — the strong overturning can no longer exist: over the next few centuries it winds down into a weak flow the wrong way round. Now bring the fresh water back to today's: it stays collapsed. It restarts only once the fresh water drops below about 0.85 times today's. The chart on the right shows why: in between, the ocean has two possible states.</p>
<p>Climate models agree that the Atlantic overturning is very likely to weaken this century as the far north warms and Greenland melts; whether and when it could collapse is uncertain. Such switches are thought to lie behind sudden cold spells in the past, such as the Younger Dryas 12,900 years ago.</p>`,
			notes: `<p>The thresholds in this two-box model are not predictions: it leaves out the winds, the Southern Ocean, the atmosphere and the real geography. What it shows correctly is the mechanism — the salt-advection feedback — and that it can give two stable states and a sudden switch between them. The IPCC (2021) has medium confidence that there will be no abrupt collapse before 2100.</p>`
		},
		// ------------------------------------------------------------------ enso
		{
			id: 'pacific',
			chapter: 'enso',
			title: 'The Pacific seesaw',
			scene: 'pacific',
			hints: { phase: 'normal' },
			duration: 26,
			controls: [pacTrades],
			body: `
<p>Now a slice along the equator across the Pacific, from Indonesia to South America. The trade winds blow from east to west and push the warm surface water west, where it piles up into the warmest large stretch of sea on Earth, the warm pool, above 28 °C. The sea surface there stands about half a metre higher than off South America.</p>
<p>Below the warm layer lies the <dfn data-def="The thin layer where the warm surface water gives way sharply to the cold deep water.">thermocline</dfn>, the boundary with the cold deep water: about 200 metres down in the west but only about 50 in the east, where cold water <dfn data-def="Rising of cold, deep water to the surface, here where winds push the surface water away.">wells up</dfn> and cools the surface. Over the warm west, moist air rises into towering rain clouds; over the cool east it sinks, and the coast of Peru is a desert.</p>
<p>Weaken the trades and the warm water sloshes back east: the thermocline flattens and the east warms. Strengthen them and the east grows colder still.</p>`,
			notes: `<p>The slope of the thermocline is set by a balance: the wind's push on the warm layer is matched by the push of the heavier, deeper cold water on the side where the warm layer is thinner. For trade winds pushing with 0.045 N/m² over 16,000 km, a 120 m warm layer and a density step of 0.4% at the thermocline, it rises 146 m from west to east — and the sea surface falls 0.6 m. The east's surface temperature then follows the recharge-oscillator model of the next step with the winds held fixed.</p>`
		},
		{
			id: 'el-nino',
			chapter: 'enso',
			title: 'El Niño',
			scene: 'pacific',
			hints: { phase: 'enso' },
			duration: 36,
			controls: [weaken, feedback, burst],
			body: `
<p>Every few years the trade winds slacken. Warm water flows east and the eastern Pacific warms. But the trades are driven by the temperature difference across the Pacific, so a warmer east means even weaker trades, which let more warm water flow east: a loop that feeds itself, the <dfn data-def="The loop in which a warmer eastern Pacific weakens the trade winds, which warms the east further (Jacob Bjerknes, 1969).">Bjerknes feedback</dfn>. This is an <dfn data-def="A warming of the central and eastern tropical Pacific by more than about half a degree for several months, with the changes in winds and rain that come with it. Its cold opposite is La Niña.">El Niño</dfn>. Turn the feedback off and the same lull in the winds only warms the sea a little, briefly.</p>
<p>The rain follows the warm water east: Peru and Ecuador get floods, Indonesia and Australia drought and bushfires, and weather patterns shift as far away as North America and Africa. Meanwhile the warm water drains out of the equatorial band; the El Niño fades and swings into its cold opposite, <strong>La Niña</strong>. In the model a full cycle takes about three years; real ones come every two to seven.</p>
<p><strong>The ocean moves heat around the planet — fast and shallow in the wind-driven gyres, slow and deep in the density-driven overturning — and a shift in either one changes the weather far away.</strong></p>`,
			notes: `<p>The model is Fei-Fei Jin's recharge oscillator (1997), with his standard settings except for the strength of the feedback, set a little below the value at which the oscillation would grow on its own, so that each El Niño dies away unless the winds kick it again: the eastern sea temperature warms when the thermocline there deepens and cools on its own; the winds follow the eastern temperature; and the heat stored along the equator drains away when the trades weaken and fills up when they strengthen. The name comes from Peruvian fishermen, who called the warm current that appeared around Christmas <i>El Niño</i>, the (Christ) child.</p>`
		}
	]
};
