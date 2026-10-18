import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// The numbers quoted here come from the model (`model.ts`) run on the ETOPO 2022 transect and
// from the 2011 records in `data.ts`; `e2e/tsunamis-model.e2e.ts` checks them.

const uplift: Control = {
	type: 'range',
	id: 'uplift',
	label: 'How far the sea floor jumps',
	min: 1,
	max: 10,
	step: 0.5,
	default: 5,
	format: (v) => `${v.toLocaleString('en-GB')} m`
};

const quake: Control = {
	type: 'action',
	id: 'quake',
	label: 'Earthquake',
	action: 'Jolt the sea floor again',
	help: 'Starts the tsunami again from the moment the floor moves.'
};

const wave: Control = {
	type: 'select',
	id: 'wave',
	label: 'Which wave',
	default: 'tsunami',
	options: [
		{ value: 'tsunami', label: 'A tsunami, 200 km long' },
		{ value: 'wind', label: 'A wind wave, 150 m long' }
	]
};

const reshape: Control = {
	type: 'toggle',
	id: 'reshape',
	label: 'Replace the real shelf with a straight slope',
	default: false,
	help: 'Or drag the foot of the slope on the drawing.'
};

const ramp: Control = {
	type: 'range',
	id: 'ramp',
	label: 'Length of the slope up to the coast',
	min: 10,
	max: 300,
	step: 5,
	default: 120,
	format: (v) => `${v} km`,
	disabled: (p) => p.reshape !== true
};

const ridgeKm: Control = {
	type: 'range',
	id: 'ridgeKm',
	label: 'Where the ridge stands',
	min: 1000,
	max: 6500,
	step: 50,
	default: 3000,
	format: (v) => `${v.toLocaleString('en-GB')} km from the epicentre`,
	help: 'Or drag its top on the drawing.'
};

const ridgeTop: Control = {
	type: 'range',
	id: 'ridgeTop',
	label: 'How far below the surface its top is',
	min: 0,
	max: 4000,
	step: 50,
	default: 1500,
	format: (v) => (v === 0 ? 'an island' : `${v.toLocaleString('en-GB')} m`)
};

export const spec: ExplainerSpec = {
	slug: 'tsunamis',
	title: 'Tsunamis: a wave as long as the ocean is deep',
	summary:
		'Jolt the sea floor off Japan and follow the tsunami of 2011 across a slice of the real Pacific to California: a wave hundreds of kilometres long that runs as fast as an airliner over the deep ocean, slows and grows over the shelf, and arrives as a flood lasting minutes, at the times the real buoys and tide gauge recorded.',
	chapters: [
		{ id: 'start', title: 'The jolt' },
		{ id: 'ocean', title: 'Across the ocean' },
		{ id: 'coast', title: 'At the coast' },
		{ id: 'real', title: 'The real 2011 tsunami' }
	],
	steps: [
		// ------------------------------------------------------------------ start
		{
			id: 'jolt',
			chapter: 'start',
			title: 'The sea floor jumps',
			scene: 'ocean',
			hints: { view: 'source' },
			duration: 30,
			controls: [uplift, quake],
			body: `
<p>On 11 March 2011 the fault under the sea off northern Japan slipped by up to 50 m, in a magnitude 9.1 <a href="../earthquakes/">earthquake</a>. Where one plate dives under the other, at the <dfn data-def="The long, deep trough in the sea floor where one tectonic plate sinks under another. The Japan Trench is over 7 km deep.">trench</dfn>, the sea floor was shoved up by several metres over a strip about 100 km wide, while nearer the coast it sank.</p>
<p>The sea above has no time to flow away: in the two or three minutes the rupture takes, the whole column of water, kilometres deep, is lifted with the floor. So the sea surface gets the same shape — a hump a few metres high, but about as wide as the strip. Gravity pulls the hump back down, and it spreads out as two waves running in opposite directions, each half as high: one towards Japan, one out across the Pacific. That is a <dfn data-def="A series of sea waves set off by a sudden shift of a large volume of water, most often by an earthquake under the sea floor; also by landslides, volcanic eruptions or meteorite impacts. Japanese for 'harbour wave'.">tsunami</dfn>.</p>`,
			notes: `<p>The drawing is a slice through the ocean along the line from the epicentre to Crescent City, California, with the real sea floor under it (more on that in the next chapter). The shape of the jump is simplified from what was measured in 2011: the largest uplift, about 5 m, was between the epicentre and the trench, and the coast sank by up to about a metre. The heights are drawn hundreds of times taller than they are against the width. Earthquakes are not the only cause: underwater landslides and volcanic eruptions also push water aside suddenly, but large earthquakes under the sea cause most tsunamis.</p>`
		},
		{
			id: 'long',
			chapter: 'start',
			title: 'A wave longer than the ocean is deep',
			scene: 'column',
			hints: { mode: 'column' },
			duration: 26,
			controls: [wave],
			body: `
<p>The waves on the <a href="../waves-interference/">waves page</a> had a <dfn data-def="The distance from one crest of a wave to the next.">wavelength</dfn> and a speed. A tsunami's wavelength is the width of the hump: about 200 km. The ocean is about 4 km deep. Drawn to scale, as at the top here, the tsunami is a wave 50 times longer than the water is deep — a wave in a puddle.</p>
<p>That changes how the water moves. Under a wind wave, the water goes round in circles that shrink with depth: half a wavelength down, 75 m for this one, it hardly moves at all, so the wave can't feel the floor. Under the tsunami, the whole column of water, from the surface to the sea floor, slides back and forth together. Such a wave is called a <dfn data-def="A water wave whose wavelength is much longer than the depth of the water (more than about 20 times). Its speed depends only on the depth.">shallow-water wave</dfn> — even over the deepest ocean.</p>`,
			notes: `<p>The water's paths are drawn from the theory of small water waves (Airy's): circles that shrink as e<sup>−2πz/λ</sup> under a short wave, and flat ellipses that keep almost the same width all the way down under a long one. The tsunami's back-and-forth motion is tiny: with a height of 1 m over 4,000 m of water, the current is about 5 cm a second, and each bit of water moves about ten metres each way as the wave passes.</p>`
		},
		// ------------------------------------------------------------------ ocean
		{
			id: 'cross',
			chapter: 'ocean',
			title: 'Across the Pacific in ten hours',
			scene: 'ocean',
			hints: { view: 'ocean', panel: 'arrivals' },
			duration: 46,
			controls: [quake],
			body: `
<p>This is the whole slice: 7,700 km from the coast of Fukushima, through the epicentre, across the North Pacific to Crescent City in California, with the sea floor from <dfn data-def="A map of the height of the land and the depth of the sea floor over the whole Earth, made by the US National Oceanic and Atmospheric Administration (NOAA).">NOAA's ETOPO 2022</dfn> under it. The clock shows the hours since the earthquake.</p>
<p>The wave heading for Japan reaches its coast within the hour. The other one crosses the ocean: it passes the warning buoys off the Kuril Islands after an hour to an hour and a half, the one south of the Aleutians after five hours, and reaches California after ten. The markers show when the model's wave arrives at each, and when the real 2011 tsunami did: within a few minutes of each other.</p>
<p>Keep an eye on the wave far from the source: out at sea it is still only a couple of metres high, and in the real ocean it is lower still (see Go deeper).</p>`,
			notes: `<p>The model is the "shallow-water equations": the water's current speeds up wherever the sea surface slopes, and the surface rises wherever the current brings more water in than it takes out. A computer steps both forward six seconds at a time in 3,840 cells of 2 km.</p><p>A slice has one big flaw: in the real ocean the wave spreads sideways over an ever wider front, so its height falls with distance, while in a slice it can't. The heights here far from the source are an upper bound, several times too big; the real buoys recorded about 60 cm off the Kurils and 14 cm south of the Aleutians. The times don't suffer, because the speed depends only on the depth on the way.</p>`
		},
		{
			id: 'speed',
			chapter: 'ocean',
			title: 'The depth sets the speed',
			scene: 'ocean',
			hints: { view: 'ocean', panel: 'speed' },
			duration: 46,
			controls: [quake],
			body: `
<p>A shallow-water wave has a simple rule for its speed: it depends only on the depth. Take gravity (9.8 m/s²) times the depth in metres and the <dfn data-def="The number that, multiplied by itself, gives the number you started with: √16 = 4.">square root</dfn> of that is the speed in metres a second:</p>
<p class="formula">speed = √(gravity × depth)</p>
<p>Over 4,600 m of water that is 212 m a second, or 765 km/h — as fast as an airliner. The gauge follows the front of the wave: fast over the deep abyss, slower over the shallower rises, and slowest at the end, over the shelf, where the depth runs out. The chart below draws the rule all along the slice.</p>
<p>The dashed line is a wind wave, the kind that breaks on a beach, with crests 10 seconds apart: 56 km/h, whatever the depth, until the last few tens of metres. It would take nearly six days to cross the same ocean.</p>`,
			notes: `<p>Every water wave obeys one rule linking its wavelength, the depth and its speed (the "dispersion relation" ω² = g k tanh(k h)). For waves much longer than the depth it gives √(g h); for waves much shorter, a speed that depends only on the wavelength. The wind wave's line is drawn from that full rule. A group of wind waves (a swell) travels at half the speed of its crests, so a swell from Japan would take about twelve days to reach California.</p>`
		},
		{
			id: 'unseen',
			chapter: 'ocean',
			title: 'Barely visible at sea',
			scene: 'column',
			hints: { mode: 'ship' },
			duration: 26,
			body: `
<p>A ship out in the deep ocean feels nothing. The model's wave passes under it as a gentle rise of a couple of metres (in the real ocean, less than a metre), spread over a hundred kilometres. Drawn to scale, at the top, the wave is invisible. The sea simply rises for a few minutes, then falls again, under a ship that has no way to tell.</p>
<p>That is why tsunamis are watched from the sea floor. A <dfn data-def="Deep-ocean Assessment and Reporting of Tsunamis: a pressure sensor on the sea floor that weighs the water above it and reports through a buoy and a satellite.">DART</dfn> station weighs the water above it with a pressure sensor on the floor, and can notice the sea rising by a centimetre. The three on our slice recorded the 2011 tsunami; their records are in the last chapter.</p>`,
			notes: `<p>The scene takes the crest of the model's wave after three hours, mid-ocean. A rise of 2 m over 50 km is a slope of 1 in 25,000. The wave lifts the ship as it passes: the water's current under a tsunami of this height is only about 10 cm a second. Ships in deep water are safe; in port, the same wave is a danger, and harbours are evacuated by sending ships out to sea.</p>`
		},
		// ------------------------------------------------------------------ coast
		{
			id: 'shelf',
			chapter: 'coast',
			title: 'Slowing down, bunching up',
			scene: 'ocean',
			hints: { view: 'shelf' },
			duration: 40,
			controls: [reshape, ramp],
			body: `
<p>Here the last 300 km before California, nine hours after the earthquake. As the wave climbs the slope onto the <dfn data-def="The shallow edge of a continent under the sea, usually less than 200 m deep, ending at a steep slope down to the deep ocean.">continental shelf</dfn> its front slows down first, and the rest catches up: the wave gets shorter, and since its water has to go somewhere, it gets taller. Over the last few hundred metres of depth it grows a few times higher, and at the coast, where it runs into the shore and piles up, higher still.</p>
<p>Now replace the real shelf with a straight slope and drag its foot. A long, gentle slope lets almost all of the wave climb onto the shelf, and it grows most. A short, steep one, a cliff under the sea, sends part of it back out to sea, and the coast gets less.</p>`,
			notes: `<p>Over a gentle slope the energy the wave carries is kept, while its speed and length shrink, so its height grows as one over the fourth root of the depth (Green's law): sixteen times shallower, twice as high. The model's coast is a wall 10 m deep: the wave stops and reflects there instead of running up onto the land, so the height at the coast stands for how high the water climbs, not for what happens on land. The real wave would also break and lose energy to friction on the shelf. The heights still carry the slice's upper bound: the real wave at Crescent City was 2.4 m above the tide at its highest, about a fifth of what the slice gives.</p>`
		},
		{
			id: 'ridge',
			chapter: 'coast',
			title: 'A ridge in the way',
			scene: 'ocean',
			hints: { view: 'ocean', panel: 'ridge' },
			duration: 46,
			controls: [ridgeKm, ridgeTop],
			body: `
<p>The real floor of our slice has no great ridge, but the Pacific has many: lines of underwater volcanoes, some of them topped with islands. Raise one in the middle of the ocean by dragging its top. While it stays a few thousand metres down, the wave hardly notices; it runs slower over the top, then speeds up again. As the top comes up near the surface, more and more of the wave bounces back towards Japan, and less of it carries on.</p>
<p>Bring the top all the way up and the ridge becomes an island. In a slice, an island is a wall: nothing gets past. A real island is only a few tens of kilometres across, so the wave bends round it and closes in behind; islands give little shelter from a tsunami.</p>`,
			notes: `<p>The reflection comes from the sudden change of depth: a wave meeting a sudden change of speed sends part of itself back, as a wave on a rope does at a knot. Over real ridges, the slower speed over the shallow top also bends the wave fronts towards the ridge, so ridges can steer a tsunami's energy, like a lens. Maps of tsunami energy across the Pacific show beams following such ridges; a slice can't show that.</p>`
		},
		{
			id: 'flood',
			chapter: 'coast',
			title: 'A flood, not a breaker',
			scene: 'gauge',
			duration: 34,
			body: `
<p>People picture a tsunami as a giant surf wave curling over. Usually it is not. A surf wave rises and falls in a few seconds. A tsunami's crests come minutes to an hour apart, so at the coast the sea keeps rising for several minutes, like a tide coming in at fantastic speed, and floods inland as a fast current full of debris. Then it pulls back out just as hard, and comes in again. The biggest wave is often not the first, and the danger lasts for hours.</p>
<p>Often the sea draws back first, emptying the beach: in the model, the Japanese coast, on the side where the floor sank, sees exactly that. A beach that empties suddenly is a warning to run to high ground.</p>
<p>And a tsunami is not a "tidal wave": the tide, the slow curve on the real record of Crescent City, comes from the pull of the Moon and the Sun and rises and falls twice a day. The tsunami rides on top of it.</p>`,
			notes: `<p>Which comes first, the crest or the trough, depends on where you are. In 2004, after the Sumatra earthquake, the sea drew back first in Thailand, east of the fault, on the side where the floor sank, and rose first in Sri Lanka and India, to the west. The tsunami's period, the time between crests, comes from the size of the uplifted strip and how a coast's bays and harbours slosh: Crescent City's harbour is known for amplifying tsunamis. The gauge has no readings for some of the lowest troughs.</p>`
		},
		// ------------------------------------------------------------------ real
		{
			id: 'records',
			chapter: 'real',
			title: 'Checked against 2011',
			scene: 'records',
			duration: 30,
			body: `
<p>These are the real 2011 tsunami as three DART stations on the sea floor and the tide gauge in Crescent City recorded it, beside the model's wave at the same places. The first crest arrives within a few minutes of the model's time everywhere, after travelling for up to ten hours. A rule as simple as √(gravity × depth), used on the real sea floor, gets the timing of a wave across an ocean right.</p>
<p>The heights are another story: the model's are several times too big, more so the further the wave has gone, because a slice can't let the wave spread sideways. Warning centres do the same calculation on the whole ocean, in two dimensions, with the spreading. Within minutes of a big earthquake under the sea they compute when the wave will reach each coast, and correct their estimates of its height as the DART stations report. The arrival times are certain; the heights take the whole ocean.</p>`,
			notes: `<p>The DART records are from NOAA's National Data Buoy Center (stations 21401, 21419 and 46402, within about 70 km of the slice), with the tide removed; the Crescent City record is NOAA's tide gauge 9419750 minus the predicted tide. The first arrival is where each record first rises clearly above its noise, and the crest is the highest point soon after. The model's source is simplified, and its slice follows the shortest route over the globe, while the real wave's fastest route bends a little towards deeper water. The sea floor is from ETOPO 2022 (NOAA National Centers for Environmental Information, public domain). The <a href="../plate-tectonics/">plate tectonics</a> page shows where the trenches that make such earthquakes are.</p>`
		}
	]
};
