import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { SCENARIOS } from './climate';

/** How much sunlight the bare planet reflects. */
const albedo: Control = {
	type: 'range',
	id: 'albedo',
	label: 'Sunlight reflected',
	min: 0,
	max: 90,
	step: 0.1,
	default: 29.4,
	values: () => [0, 6, 10, 20, 29.4, 40, 50, 60, 70, 80, 90],
	unit: '%',
	help: 'Earth today: 29.4%, 100 of 340 W/m² (clouds, ice, snow, deserts). Fresh snow reflects about 80%, the open ocean about 6%.'
};

/** The layer model's absorption. */
const absorb: Control = {
	type: 'range',
	id: 'absorb',
	label: 'Infrared absorbed by the air',
	min: 0,
	max: 100,
	step: 1,
	default: 77,
	unit: '%',
	help: '0%: no greenhouse gases. 77% gives Earth’s 15 °C.'
};

/** CO₂ in the air. */
const co2: Control = {
	type: 'range',
	id: 'co2',
	label: 'CO₂ in the air',
	min: 180,
	max: 1120,
	step: 10,
	default: 560,
	format: (v) =>
		`${v} ppm${
			v === 180
				? ' (ice age)'
				: v === 280
					? ' (before industry)'
					: v === 420
						? ' (today)'
						: v === 560
							? ' (double)'
							: v === 1120
								? ' (four times)'
								: ''
		}`,
	values: () => [180, 280, 350, 420, 490, 560, 700, 840, 980, 1120],
	help: 'Before industry: 280 ppm. 2024: 423. Ice ages: about 180.'
};

const water: Control = {
	type: 'toggle',
	id: 'water',
	label: 'Water-vapour feedback',
	default: true,
	help: 'Warmer air holds more water vapour, itself a greenhouse gas.'
};
const ice: Control = {
	type: 'toggle',
	id: 'ice',
	label: 'Ice-reflectivity feedback',
	default: true,
	help: 'Less snow and ice: a darker planet that absorbs more sunlight.'
};
const clouds: Control = {
	type: 'toggle',
	id: 'clouds',
	label: 'Cloud feedback',
	default: true,
	help: 'The least certain: AR6 finds clouds most likely amplify warming a little.'
};

const scenario: Control = {
	type: 'select',
	id: 'scenario',
	label: 'Emissions scenario',
	default: 'ssp245',
	options: SCENARIOS.map((s) => ({ value: s.id, label: `${s.name} (${s.label})` }))
};

export const spec: ExplainerSpec = {
	slug: 'greenhouse-effect',
	title: 'The greenhouse effect & climate change',
	summary:
		'Follow sunlight in and infrared out, and find the temperature where they balance. Add CO₂ and watch the planet warm until the flows balance again, switch the feedbacks on and off, then run the IPCC’s emission scenarios to 2100.',
	chapters: [
		{ id: 'balance', title: 'Energy in, energy out' },
		{ id: 'blanket', title: 'The infrared blanket' },
		{ id: 'co2', title: 'Adding CO₂' },
		{ id: 'century', title: 'This century' }
	],
	steps: [
		// ------------------------------------------------------------------ balance
		{
			id: 'sunlight',
			chapter: 'balance',
			title: 'Sunlight in',
			scene: 'planet',
			hints: { view: 'sun' },
			duration: 20,
			body: `
<p>Almost all the energy that warms the Earth comes from the Sun. Above the air, a square metre facing the Sun receives <strong>1,361 watts</strong>, about the power of a small kettle.</p>
<p>The Earth catches sunlight on its disc, but it shares it out over its whole surface, day and night side: a sphere has four times the area of its disc. Averaged over the globe, each square metre gets <strong>340 W</strong>.</p>
<p>Not all of it is used. Clouds, ice, snow and bright deserts reflect about <strong>100 W/m²</strong> straight back to space, 29% of it: the planet's <dfn data-def="The fraction of sunlight a surface or planet reflects. 0 is perfectly black, 1 a perfect mirror. Earth's is about 0.29.">albedo</dfn>. The other <strong>240 W/m²</strong> is absorbed, by the air (80) and above all by the ground and the ocean (160), and warms them.</p>`,
			notes: `<p>The 1,361 W/m² is the total solar irradiance (Kopp &amp; Lean, <i>Geophysical Research Letters</i> 38, L01706, 2011; IPCC AR6 WG1 §7.2.2). It varies by about 0.1% over the Sun's 11-year cycle. The flows are the global, yearly means of the IPCC's Sixth Assessment Report (AR6 WG1, Fig. 7.2, after Wild et al. 2015 and 2019), measured by satellites at the top of the atmosphere and by surface stations: 340 in, 100 reflected (75 by clouds and air, 25 by the surface), 80 absorbed in the air, 160 at the surface.</p>`
		},
		{
			id: 'glow',
			chapter: 'balance',
			title: 'Everything warm glows',
			scene: 'planet',
			hints: { view: 'bare' },
			duration: 26,
			controls: [albedo],
			body: `
<p>Anything warm gives off light. A hot stove glows red; something at room temperature glows too, but in <dfn data-def="Light with wavelengths longer than red, from about 0.7 to 1,000 micrometres, invisible to our eyes. Warm objects on Earth give off most of their light at around 10 micrometres.">infrared</dfn> our eyes cannot see. The warmer it is, the more it gives off, and steeply so: the <dfn data-def="The power radiated by a perfect emitter: σT⁴, where T is the absolute temperature in kelvin and σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴.">Stefan–Boltzmann law</dfn> says that doubling the absolute temperature multiplies it by 16.</p>
<p>So a planet regulates itself. Imagine an Earth whose air lets all infrared through, but which still reflects the same 29% of sunlight. If it is too cold, it gives off less infrared than the 240 W/m² of sunlight it absorbs, and it warms. If it is too hot, it loses more than it gains, and it cools. It settles where the two flows are equal: at <strong>255 K</strong> (kelvin, counted from absolute zero, −273 °C), which is <strong>−18 °C</strong>.</p>
<p>Change how much sunlight it reflects and watch the planet find its new balance: a white, icy planet settles far colder, a black one warmer.</p>`,
			notes: `<p>Balance: absorbed sunlight = σT⁴, so T = (240 / 5.67 × 10⁻⁸)<sup>¼</sup> = 255 K. Temperatures in kelvin start from absolute zero: 0 °C = 273.15 K. The animation runs a simple model, a surface with the heat capacity of the top 60 metres of ocean, so that the planet takes a few years to settle; a real airless planet like the Moon has no ocean, and its days are far hotter and its nights far colder than this average. Most of the Earth's 29% is reflected by clouds and air. A truly airless Earth would be darker, reflecting about 12% like the Moon, and would settle near 270 K (−4 °C). The usual comparison, 255 K, keeps today's reflectivity and removes only the absorption of infrared.</p>`
		},
		{
			id: 'real',
			chapter: 'balance',
			title: 'But the Earth is 33 °C warmer',
			scene: 'planet',
			hints: { view: 'real' },
			duration: 22,
			body: `
<p>The real Earth's surface averages about <strong>15 °C</strong> (288 K), not −18 °C. Something keeps it 33 degrees warmer than the bare planet.</p>
<p>Satellites and surface stations show where the difference is. The warm surface gives off <strong>398 W/m²</strong> of infrared, much more than the 240 of sunlight the planet absorbs. Yet only <strong>239 W/m²</strong> of infrared leaves the top of the atmosphere, just enough to balance the sunlight.</p>
<p>And the surface receives <strong>342 W/m²</strong> of infrared coming <em>down</em> from the sky, more than twice the sunlight it absorbs. The air between the ground and space catches most of the surface's infrared and sends much of it back. That is the <dfn data-def="The warming of a planet's surface by gases in its atmosphere that absorb and emit infrared radiation.">greenhouse effect</dfn>.</p>`,
			notes: `<p>AR6 WG1 Fig. 7.2 (Wild et al. 2015, 2019): surface emission 398 [395 to 400] W/m², downward infrared at the surface 342 [339 to 347], outgoing infrared 239 [237 to 242], all for the early 21st century. The surface also loses heat by evaporating water (82 W/m²) and warming the air in contact with it (21). Today the planet takes in slightly more than it gives off: about 0.7 W/m², which is why it is warming (AR6 Fig. 7.2; 0.79 W/m² for 2006–2018, §7.2.2).</p>`
		},
		// ------------------------------------------------------------------ blanket
		{
			id: 'gases',
			chapter: 'blanket',
			title: 'Which gases catch infrared',
			scene: 'molecules',
			duration: 24,
			body: `
<p>Nitrogen and oxygen, 99% of the air, let infrared straight through. Their molecules are two identical atoms, and infrared cannot set them vibrating.</p>
<p>Molecules made of different atoms, especially those with three or more, can bend and stretch in ways that infrared can shake. <strong>Water vapour</strong> (H₂O), <strong>carbon dioxide</strong> (CO₂) and <strong>methane</strong> (CH₄) each absorb infrared at certain wavelengths. CO₂'s most important band for the climate is at about 15 micrometres, close to where the Earth glows most brightly.</p>
<p>Watch what happens to the infrared. A molecule <strong>absorbs</strong> it and, a moment later, gives off infrared again, in a <strong>random direction</strong>: up, down or sideways. It is not reflected like light off a mirror. Each absorption and re-emission sends some of the energy back towards the ground.</p>`,
			notes: `<p>Dry air is 78% nitrogen, 21% oxygen and 0.9% argon. CO₂ is only 0.04% (423 parts per million in 2024), water vapour about 0.4% on average, but they do almost all the absorbing. In the lower atmosphere an excited molecule usually passes its energy to its neighbours in collisions before it can re-emit, so the gas warms; the air then emits infrared according to its temperature. The net effect is the same: the energy is absorbed and given off again in all directions.</p>`
		},
		{
			id: 'layer',
			chapter: 'blanket',
			title: 'A blanket of air',
			scene: 'layer',
			duration: 26,
			controls: [absorb],
			body: `
<p>Here is the simplest model of the greenhouse effect: one layer of air above the ground. It lets sunlight through, absorbs a share of the surface's infrared, and gives off as much as it absorbs, <strong>half up to space and half back down</strong>.</p>
<p>The ground now gets two kinds of energy: sunlight, plus the infrared coming down from the air. It warms until it gives off enough to balance both. At the top, only the infrared that slips through and the layer's upward half escape, and together they still balance the 240 W/m² of sunlight.</p>
<p>With no absorbing gases the surface is the bare planet's −18 °C. A layer that absorbs <strong>77%</strong> of the infrared gives the real Earth's <strong>15 °C</strong>. Even a layer that absorbs everything only reaches 30 °C: one layer can send back at most half.</p>`,
			notes: `<p>The layer is in balance when it emits what it absorbs: εσT<sub>s</sub>⁴ = 2εσT<sub>a</sub>⁴. The top of the atmosphere balances when the sunlight absorbed equals (1 − ε/2)σT<sub>s</sub>⁴, so T<sub>s</sub> = 255 K / (1 − ε/2)<sup>¼</sup>. The real atmosphere is not one layer: it absorbs some sunlight, it is heated from below by evaporation and rising warm air, and it gets colder with height. The model leaves these out, but it shows the essential: the surface is warmed by infrared sent back from the air, and the planet still gives off to space exactly what it absorbs. The model's 390 W/m² from the surface is σ(288 K)⁴; the measured 398 is a little higher because the surface temperature varies from place to place and season to season, and the average of T⁴ is larger than (average T)⁴.</p>`
		},
		{
			id: 'glass',
			chapter: 'blanket',
			title: 'Not like a glass greenhouse',
			scene: 'glass',
			duration: 22,
			body: `
<p>The name is misleading. A glass greenhouse warms mainly because the glass <strong>stops the warm air from rising</strong> and blowing away: sunlight heats the ground and the air inside, and the air is trapped. Open a window and it cools, even though the sunlight still comes in.</p>
<p>The atmosphere has no lid; warm air rises freely. It warms the surface in a different way: with gases that <strong>absorb infrared and give it off again</strong>, partly back down. Nothing is reflected, and nothing is trapped forever: every bit of energy the Earth absorbs from the Sun eventually leaves as infrared. The gases only make the surface warmer before it can.</p>`,
			notes: `<p>In 1909 the physicist Robert W. Wood built two small boxes, one covered with glass and one with rock salt, which lets infrared through. Both warmed about equally, showing that a greenhouse works mostly by stopping convection (R. W. Wood, "Note on the theory of the greenhouse", <i>Philosophical Magazine</i> 17, 319, 1909). Glass does absorb infrared, and later experiments find that this adds a little warmth, but the main effect is the lid.</p>`
		},
		// ------------------------------------------------------------------ co2
		{
			id: 'co2',
			chapter: 'co2',
			title: 'Add CO₂: out of balance',
			scene: 'climate',
			hints: { mode: 'co2' },
			duration: 30,
			controls: [co2],
			body: `
<p>Now add CO₂. More of it catches more of the infrared, so less escapes to space: the planet still absorbs 240 W/m² of sunlight but gives off less. That gap is the <dfn data-def="A change in the Earth's energy balance imposed from outside the climate system, such as more CO₂, in watts per square metre. Positive forcing warms.">radiative forcing</dfn>. Doubling CO₂ cuts the infrared escaping by <strong>3.9 W/m²</strong>, about 1.6% of the flow.</p>
<p>The planet now takes in more than it gives off, and it warms. A warmer surface glows more strongly, so the infrared escaping grows back, until it balances the sunlight again. Watch the imbalance shrink to zero and the temperature settle.</p>
<p>Here nothing else changes: no extra water vapour, no melting ice. Then doubling CO₂ warms the planet by only about <strong>1.2 °C</strong>. Each doubling adds the same, because CO₂'s effect grows with the <em>logarithm</em> of its amount: from 280 to 560 parts per million (ppm) does as much as from 560 to 1,120.</p>`,
			notes: `<p>The forcing of doubled CO₂ is 3.93 ± 0.47 W/m² (AR6 WG1 §7.3.2.1); the stage uses 3.93 × log₂(C / 280 ppm), with the round pre-industrial value 280 (AR6: 278.3 ppm in 1750). The older formula of Myhre et al. (<i>Geophysical Research Letters</i> 25, 2715, 1998), 5.35 ln(C/C₀), gives 3.71 for a doubling; AR6's "effective" forcing adds the fast adjustments of the atmosphere. Why does more CO₂ still matter when the middle of its band already absorbs everything? The infrared that escapes to space comes from the air high enough for little CO₂ to lie above it. Adding CO₂ raises that level to colder air, which glows less, and the edges of the band absorb more. Without feedbacks the planet warms by 3.93 ÷ 3.38 ≈ 1.2 °C per doubling: the Planck response, 3.22 W/m² more escaping per degree (AR6 Table 7.10), plus a small remainder. The planet here is the ocean's mixed layer alone, which settles within a few years; the deep ocean, which makes the full response take centuries, comes in the last chapter.</p>`
		},
		{
			id: 'water',
			chapter: 'co2',
			title: 'Feedback: water vapour',
			scene: 'climate',
			hints: { mode: 'water' },
			duration: 28,
			controls: [co2, water],
			body: `
<p>Warming changes the planet, and some of those changes add to the warming: <dfn data-def="A change caused by warming that in turn changes the warming: amplifying (positive) or damping (negative).">feedbacks</dfn>.</p>
<p>The strongest is water vapour. Warm air can hold more water: about <strong>7% more for each degree</strong>. More water evaporates from the oceans, and water vapour is itself a greenhouse gas, so it catches yet more infrared. Unlike CO₂, it does not build up on its own: it rains out within about ten days. It only follows the temperature, so it amplifies whatever warming CO₂ starts.</p>
<p>With it on, doubled CO₂ warms the planet by about <strong>1.9 °C</strong> instead of 1.2. Switch it off to compare, and watch how the planet takes longer to settle with it on.</p>`,
			notes: `<p>The 7% per °C comes from the Clausius–Clapeyron relation, the physics of evaporation: the maximum water vapour that air can hold rises by about 7% for each degree of warming, and the relative humidity of the air changes little (AR6 WG1 §8.2.1). AR6 assesses the water-vapour feedback together with the <dfn data-def="The change in how quickly the air cools with height. A warmer, moister atmosphere warms more aloft, which helps it lose heat to space and partly offsets the water-vapour feedback.">lapse-rate</dfn> feedback, which partly offsets it: +1.30 W/m² per °C [1.1 to 1.5] (Table 7.10).</p>`
		},
		{
			id: 'ice',
			chapter: 'co2',
			title: 'Feedback: melting ice',
			scene: 'climate',
			hints: { mode: 'ice' },
			duration: 28,
			controls: [co2, water, ice],
			body: `
<p>Snow and ice reflect most of the sunlight that falls on them; open ocean and bare ground absorb most of it. As the planet warms, sea ice and snow retreat, the Earth becomes a little darker, and it absorbs more sunlight. That warms it further.</p>
<p>This one works on the sunlight side of the balance: watch the ice shrink, and the sunlight absorbed creep up (by less than 1 W/m², so read the number). With both feedbacks on, doubling CO₂ warms the planet by about <strong>2.3 °C</strong>.</p>
<p>Feedbacks amplify the warming, but they do not make it run away. The Stefan–Boltzmann law always wins: a warmer planet glows more strongly, by more than the feedbacks add, so it settles at a new, warmer balance.</p>`,
			notes: `<p>AR6 WG1 Table 7.10: surface-albedo feedback +0.35 W/m² per °C [0.10 to 0.60], mostly from Arctic sea ice and spring snow. The great ice sheets of Greenland and Antarctica respond over centuries to millennia, and are not in this number. On the stage the extra sunlight is +0.35 W/m² for each degree of warming, and the ice drawn shrinks with the warming.</p>`
		},
		{
			id: 'sensitivity',
			chapter: 'co2',
			title: 'How much warming per doubling?',
			scene: 'climate',
			hints: { mode: 'all' },
			duration: 28,
			controls: [co2, water, ice, clouds],
			body: `
<p>The warming for doubled CO₂, once the planet has settled, is called the <dfn data-def="The global warming, once the climate has fully adjusted, caused by a doubling of CO₂ in the air.">equilibrium climate sensitivity</dfn>. It is the key number of climate science.</p>
<p>Clouds are the hardest part: low clouds cool by reflecting sunlight, high clouds warm by catching infrared, and both change as the climate warms. AR6 finds that, overall, clouds most likely amplify the warming a little.</p>
<p>With all the feedbacks on, doubled CO₂ warms the planet by <strong>3 °C</strong>: the IPCC's best estimate, from physics, observations of today's warming and the climates of the past. It is <em>likely</em> (two chances in three) between 2.5 and 4 °C, and <em>very likely</em> (nine in ten) between 2 and 5. Switch the feedbacks off one by one to see where the warming comes from.</p>`,
			notes: `<p>IPCC AR6 WG1 Summary for Policymakers, A.4.4. Feedbacks, W/m² per °C (Table 7.10): Planck −3.22, water vapour and lapse rate +1.30, surface albedo +0.35, clouds +0.42 [−0.10 to 0.94]. Added up they give −1.15 (−1.16 in the table, which also counts small biogeophysical and non-CO₂ biogeochemical feedbacks), a sensitivity of 3.4 °C. AR6's 3 °C combines that with the warming observed since 1850 and with past climates, which corresponds to a net feedback of −3.93 ÷ 3 = −1.31; this page keeps the difference with the Planck response, so each feedback switched off removes exactly its value from the table. On the stage the cloud feedback is drawn on the infrared side; in reality much of it acts on reflected sunlight, as fewer low clouds reflect less of it.</p>`
		},
		// ------------------------------------------------------------------ century
		{
			id: 'past',
			chapter: 'century',
			title: 'Checking against the past',
			scene: 'past',
			duration: 26,
			body: `
<p>Since 1850, CO₂ has risen from 285 to over 410 ppm, methane has more than doubled, and smoke and sulphur from burning have filled the air with <dfn data-def="Tiny particles and droplets in the air. Most reflect sunlight and brighten clouds, cooling the planet.">aerosols</dfn>, which reflect sunlight and cool. The upper chart shows the forcing: CO₂ alone (blue) and everything together (grey).</p>
<p>The lower chart feeds that forcing to the model, now with a deep ocean that takes up heat for centuries, and compares it with the measured temperature. The model warms <strong>1.09 °C</strong> from 1850–1900 to 2011–2020; the measurements show <strong>1.09 °C</strong>.</p>
<p>The dips are volcanoes: eruptions such as Krakatoa in 1883 and Pinatubo in 1991 put a veil of sulphur high in the sky that cooled the Earth for a year or two.</p>`,
			notes: `<p>Forcing of every agent from AR6 WG1 Chapter 7 (Forster et al. 2021; data C. Smith, doi:10.5281/zenodo.5211357). Measured temperature: AR6's mean of four datasets (HadCRUT5, NOAAGlobalTemp, Berkeley Earth, Kadow et al.), relative to 1850–1900; 2011–2020: 1.09 [0.95 to 1.20] °C (SPM A.1.2). The model is AR6's two-layer energy-balance model, with the medians of the 2,237 versions that Chapter 7 calibrated to its assessment: a mixed layer of 8.3 W yr m⁻² K⁻¹ (about 60 m of water) and a deep ocean of 122. After 2014 it follows the SSP2-4.5 scenario's concentrations and forcing, close to what happened to 2020. It does not make its own year-to-year wiggles: those are El Niño and other natural variations, which the measurements show and the model cannot.</p>`
		},
		{
			id: 'scenarios',
			chapter: 'century',
			title: 'Five futures to 2100',
			scene: 'futures',
			duration: 30,
			controls: [scenario, water, ice, clouds],
			body: `
<p>How warm it gets depends on what we emit. The IPCC's Sixth Assessment Report follows five illustrative <dfn data-def="Shared Socioeconomic Pathways: storylines of how population, economies and energy use could develop, each with its own emissions of greenhouse gases and aerosols to 2100.">scenarios</dfn>, from CO₂ emissions cut to net zero around 2050 (SSP1-1.9) to emissions tripling by 2080 (SSP5-8.5). The upper chart shows each one's CO₂ emissions.</p>
<p>Pick one and run it to 2100. The bars on the right are the IPCC's assessed warming for 2081–2100, with its very likely range; the dot is this model's. In the intermediate scenario the warming reaches <strong>2.7 °C</strong>; with very high emissions, <strong>4.4 °C</strong>. Only the lowest scenario keeps it near 1.5 °C.</p>
<p>Switch a feedback off and the same rise in CO₂ gives less warming: the feedbacks are part of why the warming is as large as it is.</p>`,
			notes: `<p>CO₂ emissions of the SSP marker scenarios as harmonised for CMIP6 (Gidden et al., <i>Geoscientific Model Development</i> 12, 1443, 2019), concentrations from Meinshausen et al. (<i>GMD</i> 13, 3571, 2020), via the RCMIP protocol v5.1.0 (Nicholls et al., <i>GMD</i> 13, 5175, 2020). The model is driven by AR6's forcing for each scenario, which includes methane, aerosols and the other agents. Warming bars: IPCC AR6 WG1 SPM Table SPM.1 (2081–2100 relative to 1850–1900: SSP1-1.9 1.4 [1.0 to 1.8], SSP1-2.6 1.8 [1.3 to 2.4], SSP2-4.5 2.7 [2.1 to 3.5], SSP3-7.0 3.6 [2.8 to 4.6], SSP5-8.5 4.4 [3.3 to 5.7] °C). The model uses the scenarios' published CO₂ concentrations: the carbon-cycle model of the <a href="../carbon-cycle/">previous explainer</a>, fed the same emissions, gives 537 ppm in 2100 for SSP2-4.5 instead of 603, because it leaves out how warming weakens the ocean and land sinks.</p>`
		},
		{
			id: 'budget',
			chapter: 'century',
			title: 'Every tonne counts',
			scene: 'budget',
			duration: 28,
			controls: [scenario],
			body: `
<p>Plot the warming against the total CO₂ emitted since 1850, and all five scenarios fall close to one straight line, a little above the IPCC's central line because the other gases add some warming. Warming follows the <strong>cumulative</strong> emissions: about <strong>0.45 °C for every 1,000 billion tonnes</strong> of CO₂ (likely 0.27 to 0.63). By 2020 the world had emitted about 2,400 billion tonnes (a little less in the data drawn here).</p>
<p>That has a stark consequence. To stop the warming, it is not enough to slow emissions: CO₂ emissions have to reach <strong>net zero</strong>. Then the warming roughly stops, but it does not go back: as the <a href="../carbon-cycle/#pulse">carbon cycle</a> showed, the CO₂ stays in the air for centuries.</p>
<p>So the warming we end up with is set by how much CO₂ we emit in total. In 2021 the IPCC estimated that, for an even chance of keeping it to 1.5 °C, the world could emit only about 500 more billion tonnes from the start of 2020. About 205 of those were emitted by the end of 2024, and the latest update puts what is left at only about <strong>130 billion tonnes</strong> from the start of 2025: some three years of today's emissions.</p>`,
			notes: `<p>The ratio is the transient climate response to cumulative CO₂ emissions (TCRE), IPCC AR6 WG1 SPM D.1.1: 0.45 °C [0.27 to 0.63] per 1,000 GtCO₂. Emitted 1850–2019: 2,390 ± 240 GtCO₂ (Table SPM.2); the emissions data used here give 2,290. Remaining carbon budgets from the beginning of 2020 (Table SPM.2): for 1.5 °C, 500 GtCO₂ for a 50% chance, 400 for 67%; for 2 °C, 1,350 and 1,150. The line works because two slow processes nearly cancel: after emissions stop, CO₂ in the air slowly falls, while the deep ocean slowly stops taking up heat. The lines here are total warming, including the other gases and aerosols. Emitted 2020–2024: 205 GtCO₂ from fossil fuels and land-use change (Global Carbon Budget 2025, as on the carbon-cycle page). Updated budget: Forster et al., Indicators of Global Climate Change 2024, <i>Earth System Science Data</i> (2025): 130 GtCO₂ from the start of 2025 for a 50% chance of 1.5 °C; it is smaller than 500 − 205 partly because the estimates of the warming so far and of the other gases' contribution have been revised.</p>`
		}
	]
};
