import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { GTCO2_PER_GTC } from './carbon';

const gtco2 = (v: number) => Math.round(v * GTCO2_PER_GTC);

/** Fossil fuels burnt per year, from the end of 2024. */
const burning: Control = {
	type: 'range',
	id: 'burning',
	label: 'Burning fossil fuels',
	min: 0,
	max: 20,
	step: 0.2,
	default: 9.8,
	format: (v) => `${v.toFixed(1)} GtC a year (${gtco2(v)} Gt CO₂)`,
	help: '9.8 is the average for 2015–2024 (Global Carbon Budget 2025).'
};

/** Net land clearing per year. */
const clearing: Control = {
	type: 'range',
	id: 'clearing',
	label: 'Cutting down forests',
	min: 0,
	max: 2.5,
	step: 0.1,
	default: 1.4,
	format: (v) => `${v.toFixed(1)} GtC a year`,
	help: 'Net carbon released by clearing land, after regrowth. 2015–2024 average: 1.4.'
};

/** How long the emissions last before they stop. */
const years: Control = {
	type: 'range',
	id: 'years',
	label: 'For how long',
	min: 0,
	max: 150,
	step: 5,
	default: 50,
	format: (v) => (v === 0 ? 'stop now (2025)' : `${v} years, until ${2024 + v}, then stop`)
};

/** How strongly plants respond to extra CO₂. */
const plants: Control = {
	type: 'range',
	id: 'plants',
	label: 'Plants: extra growth from extra CO₂',
	min: 0,
	max: 200,
	step: 10,
	default: 100,
	unit: '%',
	help: '100%: the model’s best match to the land sink measured since 1960. 0%: plants do not respond.'
};

/** How fast the ocean carries surface water down. */
const mixing: Control = {
	type: 'range',
	id: 'mixing',
	label: 'Ocean: how fast surface water sinks',
	min: 25,
	max: 200,
	step: 5,
	default: 100,
	unit: '%',
	help: 'Mixing between the surface and the deep ocean, compared with today’s.'
};

/** One release of CO₂ for the pulse experiment. */
const pulseSize: Control = {
	type: 'range',
	id: 'pulse',
	label: 'Carbon released at once',
	min: 10,
	max: 2000,
	default: 100,
	values: () => [10, 50, 100, 250, 500, 1000, 2000],
	format: (v) => `${v} GtC (${gtco2(v).toLocaleString('en-US')} Gt CO₂)`,
	help: '10 GtC is about one year of today’s emissions; 900 GtC is all the proven fossil fuel reserves.'
};

export const spec: ExplainerSpec = {
	slug: 'carbon-cycle',
	title: 'The carbon cycle',
	summary:
		'Carbon moves between the air, living things, the ocean and rock. See the stores and flows drawn to scale, then burn fossil fuels, cut down forests and run the clock to find out where the extra carbon goes, and how long it stays in the air.',
	chapters: [
		{ id: 'stores', title: 'Where carbon is kept' },
		{ id: 'people', title: 'What people add' },
		{ id: 'clock', title: 'Run the clock' }
	],
	steps: [
		// ------------------------------------------------------------------ stores
		{
			id: 'stores',
			chapter: 'stores',
			title: 'Five stores of carbon',
			scene: 'cycle',
			hints: { view: 'stores' },
			duration: 22,
			body: `
<p>Every living thing is built on carbon, and so is a lot of the planet. The same carbon atoms move round and round between a few great stores, or <dfn data-def="A place where carbon is kept for a while: the air, the ocean, plants and soils, fossil fuels, rock.">reservoirs</dfn>: the <strong>air</strong>, as carbon dioxide (CO₂); <strong>plants and soils</strong>, as living and dead organic matter; the <strong>ocean</strong>, mostly as carbon dissolved in sea water; <strong>fossil fuels</strong> underground; and <strong>rock</strong>, such as limestone.</p>
<p>On the stage each store is drawn with its area in proportion to the carbon it holds, measured in <dfn data-def="Gigatonnes of carbon: billions of tonnes of carbon atoms, counting only the carbon (a tonne of CO₂ contains 0.27 tonnes of carbon, so 1 GtC = 3.664 billion tonnes of CO₂).">GtC</dfn>. Before industry, the air held about 590 GtC. Plants hold 450 and soils 1,700 more, plus 1,400 locked in frozen permafrost. The ocean holds about 38,000: sixty times the air. Proven reserves of coal, oil and gas hold about 900.</p>
<p>Rock dwarfs everything: about 75 million GtC. It would not fit on the stage, so it is drawn with a break, the only store not to scale.</p>`,
			notes: `<p>Stocks from the Global Carbon Project's <i>Global Carbon Budget 2025</i> (Friedlingstein et al., <i>Earth System Science Data</i> 18, 3211, 2026, Fig. 2), with the split between the surface ocean (900 GtC) and the intermediate and deep ocean (37,100 GtC) from the IPCC's Sixth Assessment Report (AR6 WG1, ch. 5, Fig. 5.12). The ocean also holds 700 GtC of dissolved organic matter, 3 GtC of living things and 1,750 GtC in the surface sediments of the sea floor. Rock: more than 60 million GtC in carbonate rocks such as limestone and 15 million in kerogen, the organic matter of shales (Falkowski et al., <i>Science</i> 290, 291, 2000). Fossil fuels: 560 GtC of coal, 230 of oil and 115 of gas are <em>reserves</em>, what could be extracted economically today; the total <em>resources</em> are about 20 times more (AR6).</p>`
		},
		{
			id: 'fast',
			chapter: 'stores',
			title: 'The fast loop: life and the sea surface',
			scene: 'cycle',
			hints: { view: 'fast' },
			duration: 24,
			body: `
<p>The air swaps carbon with plants and the ocean at an enormous rate. Every year, <a href="../photosynthesis/">photosynthesis</a> takes about <strong>113 GtC</strong> out of the air and turns it into sugar. Almost all of it comes straight back: plants, animals and microbes breathe it out as they burn that sugar for energy, and fires burn some more (<strong>111 GtC</strong>).</p>
<p>At the sea surface, CO₂ dissolves into the water (about <strong>54 GtC</strong> a year) and bubbles back out (about <strong>55 GtC</strong>).</p>
<p>Each of these flows is ten times what people emit or more, but in and out nearly cancel: each pair of arrows is almost the same width. What matters for the air is the small difference between in and out, the <dfn data-def="The difference between the flow into a store and the flow out of it. A store grows only when its net flow is positive.">net flow</dfn>.</p>
<p>The flows are so large that a CO₂ molecule spends only about <strong>four years</strong> in the air before a leaf or a wave takes it. That is how long one molecule stays, not how long extra CO₂ stays: the swaps send just as much back.</p>`,
			notes: `<p>Pre-industrial gross flows from IPCC AR6 WG1 Fig. 5.12 (2021): gross photosynthesis 113 GtC/yr, respiration and fire 111.1, ocean uptake 54.0 and outgassing 54.6. The small imbalances (1.9 into the land, 0.6 out of the ocean) are carbon that rivers carry from the land to the sea. Today the land flows have grown to about 142 and 137 and the ocean flows to about 80 and 78, because the air holds more CO₂. The four years: the air's 898 GtC divided by the roughly 220 GtC it loses each year to plants and the ocean.</p>`
		},
		{
			id: 'ocean',
			chapter: 'stores',
			title: 'Into the deep ocean',
			scene: 'cycle',
			hints: { view: 'ocean' },
			duration: 22,
			body: `
<p>Only the top hundred metres or so of the ocean, the surface layer stirred by wind and waves, is in touch with the air. It holds 900 GtC, about as much as the air. Below it lies the deep ocean, with forty times more.</p>
<p>Two things carry carbon down. Sinking water: in a few cold regions, such as the North Atlantic and around Antarctica, dense surface water sinks and spreads through the deep, taking its dissolved carbon with it. And sinking life: plankton use CO₂ to grow, and when they die some of them sink, about 11 GtC a year, the <dfn data-def="The transfer of carbon from the surface to the deep ocean by sinking dead plankton and other organic particles.">biological pump</dfn>.</p>
<p>Water that sinks today stays down for <strong>centuries</strong> before it comes back up. So the deep ocean could hold almost all the carbon we add, but it can only take it in slowly.</p>`,
			notes: `<p>CO₂ does not simply dissolve in sea water: it reacts with it, forming bicarbonate and carbonate ions. That chemistry lets sea water hold far more carbon than plain water, but it also means that each extra tonne makes the water's CO₂ pressure rise ten times faster than its carbon content (the <dfn data-def="The ratio of the relative change in sea water's CO₂ pressure to the relative change in its dissolved carbon; about 10 today, and rising as the ocean takes up CO₂.">Revelle factor</dfn>). So the surface layer fills up after taking only a small fraction of the extra carbon. The model on this page computes that chemistry from the measured equilibrium constants of sea water. Fluxes from AR6 WG1 Fig. 5.12: about 275 GtC/yr carried down out of the surface layer by sinking water, 264 brought back up, and 11 by the biological pump. How long deep water has been away from the surface is measured with radiocarbon, which decays once the water stops exchanging with the air: the deep ocean turns over on a timescale of centuries (Matsumoto, <i>Journal of Geophysical Research</i> 112, C09004, 2007).</p>`
		},
		{
			id: 'slow',
			chapter: 'stores',
			title: 'The slow loop: rock and fossil fuels',
			scene: 'cycle',
			hints: { view: 'slow' },
			duration: 24,
			body: `
<p>Rock exchanges carbon too, but a thousand times more slowly. Volcanoes breathe out about <strong>0.1 GtC</strong> a year. Rain, made slightly acidic by CO₂, dissolves rocks and takes about <strong>0.3 GtC</strong> a year out of the air; rivers carry it to the sea, where shells and sediments lock some of it back into the sea floor (about 0.2 GtC a year), and over millions of years into new rock.</p>
<p>Fossil fuels are part of this slow loop. Coal is the remains of ancient swamp forests; oil and gas mostly come from plankton. They were buried before they could rot, and squeezed and heated underground for <strong>tens to hundreds of millions of years</strong>. Only a tiny fraction of buried life ever becomes coal, oil or gas.</p>
<p>These flows are so thin that on the stage they would be narrower than a hair: they are drawn at a minimum width, and labelled.</p>`,
			notes: `<p>Volcanism 0.1, rock weathering 0.3, rivers to the ocean 0.8 and burial on the ocean floor 0.2 GtC/yr from IPCC AR6 WG1 Fig. 5.12. Rivers also carry carbon washed out of soils, which is why their flow is larger than the weathering. Much of the world's coal formed in the Carboniferous and Permian periods, between about 360 and 250 million years ago.</p>`
		},
		{
			id: 'speeds',
			chapter: 'stores',
			title: 'Different speeds',
			scene: 'speeds',
			duration: 22,
			body: `
<p>Divide what a store holds by what flows through it each year and you get how long a carbon atom typically stays there. The stores turn over at wildly different speeds:</p>
<ul>
<li>the air and the surface ocean: <strong>a few years</strong>;</li>
<li>plants: about <strong>a decade</strong>; soils: <strong>decades</strong>;</li>
<li>the deep ocean: <strong>a century or more</strong>;</li>
<li>fossil fuels and rock: <strong>hundreds of millions of years</strong>.</li>
</ul>
<p>Carbon cycles in two loops: a <strong>fast loop</strong> of air, life and ocean, which trade carbon within years to centuries, and a <strong>slow loop</strong> of rock, which trades with them over geological time. Before industry, almost nothing crossed between the two.</p>`,
			notes: `<p>The bars are the turnover time (stock ÷ flow out) of each store, from the stocks and pre-industrial flows of AR6 WG1 Fig. 5.12 and the GCB 2025: air 590 ÷ 167 GtC/yr, plants 450 ÷ 54 (net primary production, Zhao &amp; Running, <i>Science</i> 2010), soils 1,700 ÷ 54, surface ocean 900 ÷ 340, intermediate and deep ocean 37,100 ÷ 264, rock 75 million ÷ 0.2 (burial). Fossil fuels have no natural flow worth the name: they formed over tens to hundreds of millions of years. They are rough: each store mixes fast and slow parts (some soil carbon is thousands of years old). Turnover time is not the same as how long an <em>extra</em> amount lasts, which the last chapter measures.</p>`
		},
		// ------------------------------------------------------------------ people
		{
			id: 'burning',
			chapter: 'people',
			title: 'A shortcut from the slow loop to the fast',
			scene: 'cycle',
			hints: { view: 'human' },
			duration: 24,
			body: `
<p>When we burn coal, oil and gas, we take carbon out of the slow loop and put it straight into the air. In 2015–2024 that was <strong>9.8 GtC a year</strong> on average (36 billion tonnes of CO₂, the figure usually quoted in the news). That is about a hundred times what all the world's volcanoes emit.</p>
<p>Cutting down forests, mostly in the tropics, releases another <strong>1.4 GtC a year</strong> from plants and soils, after counting the forests that grow back.</p>
<p>Compare the red arrows with the natural ones. They are small next to photosynthesis and respiration, but those two nearly cancel, and the human arrows point only one way. At today's rate, the proven reserves of fossil fuels would be gone in about 90 years: carbon that took hundreds of millions of years to bury.</p>`,
			notes: `<p>Fossil emissions include cement production and the small amount of CO₂ that cement takes back up as it ages (0.2 GtC/yr). Land-use change emissions are the average of three bookkeeping models, and their uncertainty is large: ±0.7 GtC/yr. Figures: Global Carbon Budget 2025, Table 7. In 2024 fossil emissions reached 10.3 GtC (37.8 Gt CO₂), and the 2025 projection was another 1% higher.</p>`
		},
		{
			id: 'budget',
			chapter: 'people',
			title: 'Where the extra carbon goes today',
			scene: 'cycle',
			hints: { view: 'budget' },
			duration: 22,
			body: `
<p>Of the 11.2 GtC we add each year, scientists can track where it ends up:</p>
<ul>
<li>about half, <strong>5.6 GtC</strong>, stays in the <strong>air</strong>, where CO₂ is measured precisely all over the world;</li>
<li><strong>3.2 GtC</strong> dissolves into the <strong>ocean</strong>;</li>
<li><strong>2.4 GtC</strong> is taken up by <strong>plants</strong>, which grow a little faster with more CO₂.</li>
</ul>
<p>The ocean and the land are called <dfn data-def="A store that takes up more carbon than it releases.">sinks</dfn>. They exist only because there is extra CO₂ in the air: it pushes more CO₂ into the water and helps plants grow. Without these sinks, CO₂ in the air would be rising twice as fast.</p>
<p>Since 1850, people have released about 745 GtC. The air holds 290 of it, the ocean 200, and the land has taken up 175, though forest clearing has taken out more.</p>`,
			notes: `<p>Decade means 2015–2024 and totals 1850–2024 from the Global Carbon Budget 2025 (Tables 7 and 8). The budget is built from nearly independent estimates of each term, so it does not quite add up: 1850–2024 emissions exceed the measured growth plus the estimated sinks by 80 GtC (the "budget imbalance"). The land sink varies a lot from year to year: in 2024, a hot El Niño year with huge fires, it fell to 1.9 GtC and the air's CO₂ rose by a record 7.9 GtC (3.7 ppm).</p>`
		},
		{
			id: 'history',
			chapter: 'people',
			title: 'Checking the model against the past',
			scene: 'history',
			duration: 22,
			body: `
<p>The rest of this page runs a small computer model of the carbon cycle, so first it has to pass a test: does it get the past right?</p>
<p>The upper chart shows the carbon released each year since 1750 by burning fossil fuels (grey) and by clearing land (orange). The lower one shows where it went: into the air (blue), the ocean (teal) and plants (green). The thin lines are the Global Carbon Budget's estimates. The model is given the measured CO₂ in the air and works out what the ocean and plants take up: the thick lines.</p>
<p>It follows the ocean sink closely. Its plants take up a little less than the budget's estimate before about 1950, but it matches both sinks today: 3.1 GtC a year into the ocean and 2.4 into plants. The carbon dissolving in the ocean has also made its surface more acidic: its <dfn data-def="A measure of acidity: lower pH means more acidic. Each step of 1 is ten times more acidic.">pH</dfn> has fallen from about 8.18 to 8.04 in the model, which means about a third more hydrogen ions: the water is more acidic. Measurements since the 1980s show surface pH falling by about 0.02 per decade in the subtropics (IPCC AR6).</p>`,
			notes: `<p><strong>The model.</strong> Plants and soils are two pools whose growth rises with the logarithm of CO₂ (CO₂ fertilisation, strength β = 0.27). The ocean is three layers: a surface layer that exchanges CO₂ with the air and whose CO₂ pressure comes from real sea-water chemistry (dissolved carbon, alkalinity 2,300 µmol/kg, borate, 18 °C), a thermocline (a quarter of the deep water) and the deep ocean, joined by mixing. The gas exchange comes from AR6's 54 GtC/yr; the mixing rates and β are tuned so that the model matches the Global Carbon Budget's 2015–2024 sinks and the multi-model mean response of Joos et al. (<i>Atmospheric Chemistry and Physics</i> 13, 2793, 2013). Left out: warming, which weakens both sinks (by about 7% for the ocean today); changes in the ocean's circulation; permafrost thaw; and the sea floor's and rocks' slow response, which matters after thousands of years. Its land uptake before 1950 is lower than the GCB's, and so is its land total since 1850 (about 145 against 175 ± 50 GtC).</p>`
		},
		// ------------------------------------------------------------------ clock
		{
			id: 'run',
			chapter: 'clock',
			title: 'Run the clock',
			scene: 'run',
			hints: { mode: 'emit' },
			duration: 30,
			controls: [burning, clearing, years],
			body: `
<p>Now it is your turn. The clock starts at the end of 2024 and runs a thousand years. Choose how much fossil fuel the world burns, how much forest it clears, and for how long; then the emissions stop. The bars show the extra carbon in each store compared with 1750, the arrows on the right the flows in that year (their widths to scale), and the chart follows the stores through time.</p>
<p>With today's rates for 50 more years, CO₂ climbs to about <strong>535 ppm</strong> in 2074. When the emissions stop, it falls, quickly at first as the surface ocean and plants catch up, then more and more slowly as the deep ocean takes its time. A thousand years later it is still about <strong>390 ppm</strong>, far above the 278 ppm before industry.</p>
<p>Watch the arrows when the emissions stop: the ocean and plants keep taking up carbon, but less and less as the air's excess shrinks. Try stopping now: CO₂ falls to about 370 ppm within a century, and then barely moves.</p>`,
			notes: `<p><dfn data-def="Parts per million: of every million molecules of air, how many are CO₂. 1 ppm of CO₂ = 2.124 GtC.">ppm</dfn>: 1 ppm = 2.124 GtC (GCB 2025). Burning more than about 900 GtC in total uses up the proven reserves; beyond that the model assumes the world burns resources that are not economic today, which exist in much larger amounts. The model ignores warming's feedbacks on the sinks, so its CO₂ is on the low side for big emissions. Cleared land is booked as a loss, as the Global Carbon Budget does, but the model does not shrink the remaining plants' growth with it, so with heavy clearing its land sink is somewhat too strong.</p>`
		},
		{
			id: 'sinks',
			chapter: 'clock',
			title: 'If the sinks were weaker',
			scene: 'run',
			hints: { mode: 'sinks' },
			duration: 26,
			controls: [plants, mixing],
			body: `
<p>The sinks are not fixed. Here the emissions are today's for 50 years again, and you can change the two sinks: how strongly plants respond to extra CO₂, and how fast the ocean carries surface water down. The faint line is the default run.</p>
<p>Turn the plants' response to 0%: CO₂ peaks at about <strong>630 ppm</strong> instead of 535, and the land, which is still being cleared, ends up losing carbon. Slow the ocean's mixing to 25%: the surface water fills up and stops taking CO₂, and the air keeps more of it for centuries.</p>
<p>A warming world is expected to weaken both sinks. Warm water holds less CO₂, a warmer ocean mixes less, and heat and drought slow plant growth and speed up soil decay. The model leaves those feedbacks out.</p>`,
			notes: `<p>The plant slider scales the CO₂ fertilisation factor β (0.27 at 100%); the ocean slider scales both mixing rates. The Global Carbon Budget 2025 estimates that climate change already reduced the ocean sink by about 7% over 2015–2024, compared with what rising CO₂ alone would give, and attributes a smaller negative effect on the land sink to it too.</p>`
		},
		{
			id: 'pulse',
			chapter: 'clock',
			title: 'How long does it stay in the air?',
			scene: 'pulse',
			duration: 28,
			controls: [pulseSize],
			body: `
<p>Here is the cleanest experiment: release one burst of CO₂ and nothing else, and watch how much of it is still in the air. The time axis grows by a factor of ten at each mark.</p>
<p>A molecule stays in the air for only four years or so. But the extra carbon does not go away so fast, because the swaps send back as much as they take. Of a burst of 100 GtC, about <strong>60%</strong> is still in the air after 20 years, <strong>40%</strong> after a century, and about <strong>a quarter after a thousand years</strong>. The dashed line is the average of fifteen research models; the small model follows it closely.</p>
<p>Make the burst bigger: a bigger release stays longer, because it fills the surface ocean's capacity. What finally removes the last quarter is the slow loop: sea-floor sediments dissolving over thousands of years, and rock weathering over a hundred thousand years.</p>`,
			notes: `<p>The pulse is added on top of today's air, held otherwise steady, as in Joos et al. (2013), whose multi-model mean for a 100 GtC pulse is the dashed line: 0.2173 + 0.2240 e<sup>−t/394.4</sup> + 0.2824 e<sup>−t/36.54</sup> + 0.2763 e<sup>−t/4.304</sup> (t in years). The very long tail is described by Archer et al., "Atmospheric lifetime of fossil fuel carbon dioxide", <i>Annual Review of Earth and Planetary Sciences</i> 37, 117 (2009): 20–35% of the CO₂ remains once the ocean has caught up (after two to twenty centuries), dissolving sea-floor carbonate then removes more over 3,000–7,000 years, and rock weathering the rest over hundreds of thousands of years.</p>`
		},
		{
			id: 'locked',
			chapter: 'clock',
			title: 'Unlocking the slow loop',
			scene: 'cycle',
			hints: { view: 'locked' },
			duration: 22,
			body: `
<p>Put it together. The fast loop of air, life and ocean moves carbon within years to centuries. The slow loop of rock moves it over millions of years. Before industry the two barely touched.</p>
<p>Burning fossil fuels takes carbon that was locked away for millions of years and moves it into the fast loop in a few decades. Once there, it does not go back: the plants and the ocean only move it around inside the fast loop. The stage shows the carbon added to the fast loop since 1750. Only rock weathering can return it to the slow loop, and that takes tens to hundreds of thousands of years.</p>
<p>What does the extra CO₂ in the air do? It absorbs the infrared radiation the warm ground gives off and sends part of it back down, making it harder for heat to escape to space: the greenhouse effect, the subject of the next explainer.</p>`,
			notes: `<p>In the model, the fast loop holds the 500 GtC of fossil carbon burnt since 1750 and the 280 GtC released by land clearing: with the clearing it is shared between the air (+308 GtC) and the ocean (+208 GtC), and the land, where regrowth and CO₂ fertilisation (+155 GtC) have not yet made up for the clearing. GCB 2025 Table 8 gives 1750–2024 totals of 500 GtC fossil and 280 GtC land-use change.</p>`
		}
	]
};
