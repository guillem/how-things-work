import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import {
	DOUBLING_YEARS,
	SNOWBALL_SUN,
	P0,
	VOLCANIC_PGC,
	co2Text,
	eFoldingYears,
	firstSwitch,
	history,
	openEquilibrium,
	outerEdge,
	run,
	sunlightAgo,
	toC,
	weathering,
	yearsText
} from './model';

// ------------------------------------------------------------------ numbers the text quotes

const round = (v: number, to = 1) => Math.round(v / to) * to;
const c0 = (k: number) => {
	const v = Math.round(toC(k));
	return v < 0 ? `−${-v}` : `${v}`;
};
const PULSE = run({ ppm: 2 * P0, years: 3e6, samples: 300 });
const PULSE_EFOLD = eFoldingYears(PULSE, P0)!;
const DIM = run({ sun: 0.9, years: 8e6, samples: 200 });
const DIM_EQ = openEquilibrium(0.9, 1)!;
const EARLY = history(3, 4.5, 45);
const SNOW = run({ sun: SNOWBALL_SUN, frozen: true, years: 20e6, samples: 400 });
const THAW = firstSwitch(SNOW)!;
const DRAIN = firstSwitch(run({ volcanoes: 0, years: 3e6, samples: 300 }))!;
const W10 = weathering(298, P0);

// ------------------------------------------------------------------ controls

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature, compared with today',
	min: -20,
	max: 20,
	step: 1,
	default: 10,
	format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} °C`,
	help: 'CO₂ held at 280 ppm.'
};

/** CO₂ as doublings of 280 ppm, so the slider moves evenly on a log scale. */
const co2: Control = {
	type: 'range',
	id: 'co2',
	label: 'CO₂ in the air',
	min: -2,
	max: 3,
	step: 0.05,
	default: 1,
	format: (v) => co2Text(P0 * 2 ** v),
	help: 'The temperature follows at once; the drawing shows where the CO₂ would go next.'
};

const start: Control = {
	type: 'range',
	id: 'start',
	label: 'Start the CO₂ at',
	min: -1,
	max: 2,
	step: 0.05,
	default: 1,
	format: (v) => co2Text(P0 * 2 ** v),
	help: 'Then let it go: 280 ppm is today’s balance.'
};

const sun: Control = {
	type: 'range',
	id: 'sun',
	label: 'Sunlight, from the start',
	min: 85,
	max: 100,
	step: 1,
	default: 90,
	unit: '%',
	help: 'Dimmed at once, from today’s balance at 100 %.'
};

const early: Control = {
	type: 'range',
	id: 'early',
	label: 'Volcanoes 4.5 billion years ago',
	min: 1,
	max: 4,
	step: 0.1,
	default: 3,
	format: (v) => `${v.toFixed(1)} × today’s, declining to today’s`,
	help: 'A hotter young Earth probably released more CO₂; nobody knows how much more.'
};

const snowVolc: Control = {
	type: 'range',
	id: 'snowVolc',
	label: 'Volcanoes',
	min: 0.5,
	max: 2,
	step: 0.1,
	default: 1,
	format: (v) => `${v.toFixed(1)} × today’s`
};

const au: Control = {
	type: 'range',
	id: 'au',
	label: 'Distance from the Sun',
	min: 0.95,
	max: 1.3,
	step: 0.01,
	default: 1.1,
	format: (v) => `${v.toFixed(2)} × Earth’s`,
	help: 'Or drag the planet.'
};

const zoneVolc: Control = {
	type: 'range',
	id: 'zoneVolc',
	label: 'Volcanoes',
	min: 0,
	max: 3,
	step: 0.1,
	default: 1,
	format: (v) => (v === 0 ? 'off' : `${v.toFixed(1)} × today’s`)
};

const volc: Control = {
	type: 'range',
	id: 'volc',
	label: 'Volcanoes, from the start',
	min: 0,
	max: 2,
	step: 0.1,
	default: 0,
	format: (v) => (v === 0 ? 'switched off' : `${v.toFixed(1)} × today’s`),
	help: 'From today’s balance at 1 ×.'
};

export const spec: ExplainerSpec = {
	slug: 'carbonate-silicate-thermostat',
	title: 'The carbonate-silicate thermostat',
	summary:
		'Volcanoes breathe out CO₂ and rain dissolves it into rock, faster when the planet is warm. Run the slow carbon cycle for millions of years: knock it off balance, dim the Sun, freeze the planet into a snowball, and find where the thermostat that kept Earth habitable gives out.',
	chapters: [
		{ id: 'loop', title: 'The slow carbon cycle' },
		{ id: 'run', title: 'Running the thermostat' },
		{ id: 'limits', title: 'Snowballs and limits' },
		{ id: 'clocks', title: 'Two clocks' }
	],
	steps: [
		// ------------------------------------------------------------------ loop
		{
			id: 'slow-cycle',
			chapter: 'loop',
			title: 'Carbon’s slow loop through rock',
			scene: 'cycle',
			duration: 22,
			body: `
<p>The <a href="../carbon-cycle/">carbon cycle</a> you may know runs on years and centuries: plants take CO₂ in and give it back, the sea breathes it in and out. Underneath it turns a much slower loop, through rock, over millions of years.</p>
<p>Volcanoes and hot rock deep in the crust release CO₂. Rain dissolves a little of it into a weak acid, and that acid slowly eats <dfn data-def="Rocks built of silicon and oxygen with metals such as calcium and magnesium: granite, basalt and most of the Earth's crust.">silicate rock</dfn>. Rivers carry the calcium and the carbon, as bicarbonate, to the sea, where shells and reefs lock them up as limestone. Plates carry the limestone down into the mantle, and volcanoes return the carbon to the air.</p>
<p>Net, each CO₂ that weathering takes out of the air ends up in rock: <span class="formula">CaSiO₃ + CO₂ → CaCO₃ + SiO₂</span>.</p>`,
			notes: `<p>Step by step: <span class="formula">CaSiO₃ + 2 CO₂ + H₂O → Ca²⁺ + 2 HCO₃⁻ + SiO₂</span> on land; <span class="formula">Ca²⁺ + 2 HCO₃⁻ → CaCO₃ + CO₂ + H₂O</span> in the sea. Weathering takes two CO₂, the shell gives one back: one stays in the limestone. Weathering of limestone itself on land takes one CO₂ and gives it back when new limestone forms, so it cancels out over the long run. Only silicates pull CO₂ out for good. Burying the remains of living things (organic carbon) is the other way out of the loop, left out here.</p>`
		},
		{
			id: 'weathering',
			chapter: 'loop',
			title: 'Warm and wet rock weathers faster',
			scene: 'rate',
			duration: 18,
			controls: [temp],
			body: `
<p>In 1981 James Walker, Paul Hays and James Kasting put numbers on the loop. From laboratory experiments on feldspar, the most common silicate mineral, and from the silica carried by the world's rivers, they found that weathering speeds up with temperature for two reasons.</p>
<p>Warmer water dissolves the rock faster: about 1.8 times as fast for 10 °C. And a warmer planet evaporates more water, so more rain falls and more water runs off over the rock: about 1.2 times as much for 10 °C. Together, 10 °C warmer weathers about <strong>${W10.toFixed(1)} times</strong> as fast. Move the slider.</p>
<p>More CO₂ helps the acid too, but only a little: the rate rises as CO₂ to the power 0.3.</p>`,
			notes: `<p>The law of Walker, Hays &amp; Kasting (1981, <i>JGR</i> 86, 9776, eq. 1): W/W₀ = (P/P₀)<sup>0.3</sup> exp(ΔT/13.7 K), where ΔT is the change of the global mean temperature. The 13.7 K combines dissolution, exp(ΔT/17.7 K) near 285 K from Lagache's experiments, with global runoff, exp(ΔT/60 K) from climate models of the time; the CO₂ power 0.3 also comes from Lagache's experiments, at high pressure, and they called it an assumption. Later work has tested and questioned all three numbers; land plants, which pump CO₂ into soils, changed the CO₂ part about 400 million years ago.</p>`
		},
		{
			id: 'balance',
			chapter: 'loop',
			title: 'In and out',
			scene: 'balance',
			duration: 20,
			controls: [co2],
			body: `
<p>Now close the loop. More CO₂ in the air warms the planet (the <a href="../greenhouse-effect/">greenhouse effect</a>: here 3 °C for each doubling), and a warmer planet weathers faster. Volcanoes, meanwhile, release CO₂ at the same steady rate whatever the climate, about ${VOLCANIC_PGC.toFixed(2)} billion tonnes of carbon a year.</p>
<p>So there is one level of CO₂ at which weathering takes out exactly what volcanoes put in: today, 280 ppm, the level before industry. Above it, the warm planet weathers more than the volcanoes give and CO₂ falls; below it, the cold planet weathers less and CO₂ climbs. Slide the CO₂ and watch which way the arrow points.</p>
<p>That is a <dfn data-def="A loop in which a change sets off a response that opposes it, pulling the system back toward its set point.">negative feedback</dfn>: a thermostat made of rain and rock.</p>`,
			notes: `<p>The box: CO₂ in air and ocean together, exchanging freely, so that the air's CO₂ is proportional to the carbon in both (Walker, Hays &amp; Kasting's assumption). Today's volcanic and metamorphic release, 3.3 × 10¹⁴ g of CO₂ a year (Holland 1978, the figure WHK used; modern estimates are similar), would double that carbon in ${yearsText(DOUBLING_YEARS)}. The temperature: a planet's bare temperature from its absorbed sunlight (255 K today), plus the greenhouse of water vapour, which WHK made grow by 0.5 K for each 1 K of warming, plus that of CO₂: 8 K today and 1.5 K more per doubling, which the water vapour turns into 3 °C, the IPCC's best estimate of the climate's sensitivity. WHK's own CO₂ term gave only 1.3 °C per doubling, which they called an underestimate.</p>`
		},
		// ------------------------------------------------------------------ run
		{
			id: 'pulse',
			chapter: 'run',
			title: 'Knock it and let go',
			scene: 'run',
			hints: { exp: 'pulse' },
			duration: 22,
			controls: [start],
			body: `
<p>Start the air with twice the CO₂ and run the box for three million years. The planet is 3 °C warmer, weathering runs about half as fast again as the volcanoes, and the extra CO₂ drains away, quickly at first and then more slowly as the gap closes.</p>
<p>It takes about <strong>${yearsText(round(PULSE_EFOLD, 10000))}</strong> to remove all but a third of the excess. Start it below 280 ppm and the cold planet lets the volcanoes refill the air just as slowly. Either way it comes back to 280 ppm and 15 °C.</p>`,
			notes: `<p>This box's time scale comes from its two sizes: the carbon in air and ocean (about 40,000 billion tonnes) against the volcanoes' 0.09 billion tonnes a year. Detailed models of the ocean's chemistry, in which the excess left after the ocean and the sea-floor limestone have taken their share is what weathering must remove, give e-folding times of about 200,000 to 400,000 years; this simple box is slower. Either way it is hundreds of thousands of years.</p>`
		},
		{
			id: 'dimmer',
			chapter: 'run',
			title: 'Dim the Sun',
			scene: 'run',
			hints: { exp: 'dim' },
			duration: 22,
			controls: [sun],
			body: `
<p>Now turn the Sun down by a tenth at once. In a few years the planet cools by ${Math.round(15 - toC(DIM[0].k))} °C, to ${c0(DIM[0].k)} °C. The volcanoes don't notice; weathering, in the cold, slows to a crawl. CO₂ piles up, and over a few million years it climbs to about ${co2Text(round(DIM_EQ.ppm, 100))}, which wins back about half of the cooling: the planet settles at ${c0(DIM_EQ.k)} °C.</p>
<p>Only half, because a thermostat made of weathering needs the planet to stay a little cold to keep its weathering at the volcanoes' rate with all that extra CO₂ helping the acid. Dim it by more than about a tenth at once and the ice spreads, reflects more sunlight and wins before the CO₂ can build: the planet freezes in a few years and stays frozen.</p>`,
			notes: `<p>The ice: the planet's reflectivity (albedo) rises from 0.3 to 0.6 as its mean temperature falls from 0 °C to −28 °C. Between the two, more ice means more cooling means more ice, faster than the extra cooling can be radiated away, so the planet does not stop there: it is either open or a <dfn data-def="Earth frozen over from the poles to the equator.">snowball</dfn>. This is the ice-albedo feedback of the energy-balance models of Budyko and Sellers (1969), squeezed into one number.</p>`
		},
		{
			id: 'young-sun',
			chapter: 'run',
			title: 'The faint young Sun',
			scene: 'sun',
			duration: 24,
			controls: [early],
			body: `
<p>The Sun really has brightened: stars like it burn hotter as they age, and 4.5 billion years ago it gave about ${Math.round(100 * sunlightAgo(4.5))} % of today's light. With today's air the young Earth would have been a snowball for its first three billion years (the dashed line), yet rocks show liquid water and life almost from the start. This is the <dfn data-def="The puzzle, posed by Carl Sagan and George Mullen in 1972, of how the early Earth had liquid water under a Sun about 25–30 % dimmer.">faint young Sun paradox</dfn>.</p>
<p>The Sun brightened over billions of years, far slower than the thermostat works, so the planet could follow its balance all the way: lots of CO₂ under the faint Sun, less and less as it brightened. With the young Earth's volcanoes three times as busy as today's, the box stays unfrozen throughout, at ${co2Text(round(EARLY[0].ppm!, 1000))} of CO₂ 4.5 billion years ago. With only today's volcanoes it does not, before ${history(
				1,
				4.5,
				45
			)
				.find((h) => h.k !== null)!
				.ga.toFixed(1)} billion years ago.</p>
<p>This is <em>one model's</em> history, not a measured one. Ancient soils and rocks give estimates of the early CO₂ that scatter by a factor of a hundred, and methane, less land and fewer clouds may all have helped. The thermostat is the leading explanation, not a settled one.</p>`,
			notes: `<p>Sunlight: Gough (1981, <i>Solar Physics</i> 74, 21), S = S₀/(1 + 0.4 (1 − t/4.57 Gyr)). Walker, Hays and Kasting warned that their result “should not be construed as a proposed history” of CO₂, since outgassing, land area, plants and the planet's reflectivity all changed too. With their own, weaker CO₂ greenhouse, the thermostat alone left the planet near −8 °C under a Sun 25 % fainter; the busier early volcanoes and smaller continents they suggested both raise the CO₂. Kasting's later radiative models put the CO₂ needed at tenths of a bar or more early on.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'snowball',
			chapter: 'limits',
			title: 'How a Snowball Earth ends',
			scene: 'run',
			hints: { exp: 'snowball' },
			duration: 26,
			controls: [snowVolc],
			body: `
<p>Twice between about 720 and 635 million years ago the Earth froze over, perhaps from pole to equator: glacial rocks of that age formed near the equator. Start the box frozen, under the Sun of that time (${Math.round(SNOWBALL_SUN * 100)} % of today's), at ${c0(SNOW[0].k)} °C.</p>
<p>With no liquid water to rain, weathering stops; with the sea sealed under ice, the volcanoes' CO₂ stays in the air, a bar every 20 million years. After about <strong>${yearsText(round(THAW.year, 100000))}</strong>, at ${co2Text(THAW.ppm)} of CO₂, a thousand times today's, the greenhouse beats the ice. The thaw is sudden, and the dark planet overshoots into a <dfn data-def="A very hot climate with no polar ice.">hothouse</dfn> of ${c0(THAW.k)} °C, where weathering runs flat out and slowly draws the CO₂ back down.</p>
<p>The thermostat could not prevent the snowball, but it guaranteed its end. Thick layers of limestone, the <dfn data-def="Carbonate rock laid down directly on top of the glacial deposits of the snowball glaciations.">cap carbonates</dfn>, sit right on top of the glacial deposits, as this story expects.</p>`,
			notes: `<p>How much CO₂ a real snowball needs to thaw is uncertain: about a tenth of a bar in early estimates, and more in some climate models; dust darkening the ice would lower it. The Sturtian glaciation lasted more than 50 million years and the Marinoan several million. In this box, when the ice goes, the air keeps all the CO₂ it built up; the real thawed ocean would take some of it, and intense weathering of the ground-up rock would draw it down faster.</p>`
		},
		{
			id: 'outward',
			chapter: 'limits',
			title: 'Move the planet outward',
			scene: 'zone',
			duration: 22,
			controls: [au, zoneVolc],
			body: `
<p>Move the planet away from the Sun and ask where the thermostat can still find a balance. A little farther out, the planet runs a little colder with a lot more CO₂. Beyond about ${outerEdge(1)!.toFixed(2)} times Earth's distance there is no balance left: enough CO₂ to keep that planet above freezing would make it weather faster than its volcanoes can resupply, so the CO₂ falls, the ice spreads and the planet freezes.</p>
<p>Busier volcanoes push the edge outward; switch them off and there is no balance anywhere. The zone where a planet with oceans, land and volcanoes can keep itself unfrozen this way is its <dfn data-def="The range of distances from a star where a planet like Earth could keep liquid water on its surface.">habitable zone</dfn>.</p>`,
			notes: `<p>This box sets the outer edge too close. Its greenhouse grows only as the logarithm of CO₂, while real thick CO₂ atmospheres warm more than that; detailed models (Kasting et al. 1993; Kopparapu et al. 2013) put the outer edge for a Sun like ours near 1.7 times Earth's distance, where CO₂ itself starts to scatter sunlight and to condense into clouds. The inner edge, where the oceans boil off, is beyond what this box can do.</p>`
		},
		{
			id: 'no-volcanoes',
			chapter: 'limits',
			title: 'Switch off the volcanoes',
			scene: 'run',
			hints: { exp: 'volcanoes' },
			duration: 22,
			controls: [volc],
			body: `
<p>The thermostat has a heater: the volcanoes. Switch them off and weathering keeps going on its own, drawing down the CO₂ with nothing to replace it. The planet cools, weathering slows, but it never stops while there is rain, and after about <strong>${yearsText(round(DRAIN.year, 10000))}</strong> the ice wins at ${co2Text(DRAIN.ppm)}. Frozen, the planet stops weathering, but with no volcanoes nothing refills the air: it stays a snowball for good.</p>
<p>Mars may have gone this way. It is small, so it lost its inner heat and its volcanoes fell quiet early; whatever its thicker early air held was locked away in rock or lost to space.</p>`,
			notes: `<p>Halve the volcanoes instead and the planet finds a colder balance; double them and a warmer one. A planet's thermostat setting depends on its outgassing, which depends on its inner heat and its plate tectonics. Whether plates move on other planets, and how they did on the young Earth, is not known.</p>`
		},
		// ------------------------------------------------------------------ clocks
		{
			id: 'timescales',
			chapter: 'clocks',
			title: 'A thermostat that does not hurry',
			scene: 'clocks',
			duration: 22,
			body: `
<p>Could the thermostat clean up the CO₂ we add? It does, eventually. Burning fossil fuels releases about 10 billion tonnes of carbon a year, about a hundred times what volcanoes do. Weathering can't respond to that on any time that matters to us.</p>
<p>The fast cycle of the <a href="../carbon-cycle/">carbon-cycle page</a> deals with it first: in centuries the ocean takes up most of it, and over several thousand years the sea floor's limestone dissolves to take up more. What is left, perhaps a tenth of it, waits for the silicate thermostat, which works in hundreds of thousands of years.</p>
<p>The slow cycle is why Earth has kept liquid water for four billion years. It does nothing about this century.</p>`,
			notes: `<p>The stages and their times are from Archer et al. (2009, <i>Annual Review of Earth and Planetary Sciences</i> 37, 117), “Atmospheric lifetime of fossil fuel carbon dioxide”. Emissions: about 10 billion tonnes of carbon a year from fossil fuels (Global Carbon Budget). Volcanoes: about 0.1 billion tonnes, with estimates differing by about a factor of two.</p>`
		}
	]
};
