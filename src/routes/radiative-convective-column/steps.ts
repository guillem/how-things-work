import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Optical depth of the column in the absorbing band. One id, so the value follows the reader. */
const tau: Control = {
	type: 'range',
	id: 'tau',
	label: 'Infrared optical depth τ∞',
	min: 0.5,
	max: 12,
	step: 0.1,
	default: 3.5,
	format: (v) => v.toFixed(1),
	help: 'How opaque the whole column is in the absorbing band: more CO₂ and other greenhouse gases, larger τ∞. At 3.5 the surface comes out near today’s 288 K.'
};

const lapse: Control = {
	type: 'range',
	id: 'lapse',
	label: 'Lapse rate convection keeps',
	min: 4,
	max: 9.8,
	step: 0.1,
	default: 6.5,
	format: (v) => `${v.toFixed(1)} K/km`,
	help: 'Dry air: 9.8 K/km. Moist air cools more slowly as it rises, because its vapour condenses and releases heat: about 6.5 K/km on average, 4–5 in the humid tropics.'
};

const convection: Control = {
	type: 'toggle',
	id: 'convection',
	label: 'Convection',
	default: true,
	help: 'Off: pure radiative equilibrium, every layer balanced by radiation alone.'
};

const window: Control = {
	type: 'toggle',
	id: 'window',
	label: 'Infrared window open',
	default: true,
	help: 'Open: a tenth of the infrared lies in a window the gas does not absorb. Closed: a fully grey gas.'
};

/**
 * Scenes: `streams` (the upward and downward infrared streams of the band, with the sunlight and
 * the window), `column` (the temperature profile against altitude with a reference column for
 * τ∞ = 3.5, the tropopause and the emission level, and where the escaping infrared leaves from;
 * hint `focus`: 'radiative' | 'unstable' | 'convection' | 'emission' | 'saturated' | 'strat', and
 * `radiative: true` to hold convection off), `run` (the column given twice the absorber, in real
 * time; hint `phase`: 'instant' | 'run').
 */
export const spec: ExplainerSpec = {
	slug: 'radiative-convective-column',
	title: 'Radiative transfer and the climate column',
	summary:
		'A column of air from the ground to the stratosphere, solved with the two-stream equations for a grey gas with an infrared window and with convection: add greenhouse gas and the level the planet radiates from climbs into colder air, the whole column below warms, and the stratosphere cools.',
	chapters: [
		{ id: 'radiation', title: 'Radiation alone' },
		{ id: 'convection', title: 'Convection' },
		{ id: 'emission', title: 'Where the planet radiates from' },
		{ id: 'stratosphere', title: 'The stratosphere' }
	],
	steps: [
		// ------------------------------------------------------------------ radiation
		{
			id: 'streams',
			chapter: 'radiation',
			title: 'Two streams of infrared',
			scene: 'streams',
			duration: 24,
			controls: [tau, window],
			body: `
<p>Earth absorbs about 238 W of sunlight per square metre, averaged over the globe and the day: a quarter of the 1,361 W/m² falling on a surface facing the Sun (a sphere has four times the area of its shadow), less the 30% reflected: (1 − 0.30) × 1,361 / 4 ≈ 238. In a steady state it must send the same 238 W/m² back out as infrared, which a blackbody does at the <dfn data-def="The temperature at which a blackbody would emit the planet's outgoing infrared flux: T = (OLR/σ)^¼.">emission temperature</dfn> <span class="formula">(238/σ)^¼ ≈ 255 K</span>.</p>
<p>Here the air lets all the sunlight through to the ground. In the infrared it absorbs: a tenth of the emission lies in a <dfn data-def="A range of infrared wavelengths (about 8–12 µm on Earth) where the clear air absorbs little, so the ground radiates straight to space.">window</dfn> it does not absorb at all, the rest in a <dfn data-def="A band in which the gas absorbs equally at every wavelength, described by one optical depth.">grey band</dfn> with optical depth τ∞ from the top of the air to the ground. Through every level two streams cross: <strong>U</strong>, the infrared going up, and <strong>D</strong>, going down. Counting τ downward from the top, each stream loses what the layer absorbs and gains what it emits:</p>
<p class="formula"><strong>dU/dτ = U − B, dD/dτ = B − D, B = (1 − window) σT⁴</strong></p>`,
			notes: `<p>These are the two-stream (Schwarzschild) equations in the hemi-isotropic form Pierrehumbert uses in <i>Principles of Planetary Climate</i>, chapter 4, with the diffusivity factor for slanting paths folded into τ (2 for this hemi-isotropic form; detailed models use about 1.66). The column is cut into 131 layers, each isothermal, and each passes e<sup>−Δτ</sup> of what enters it. The absorber is well mixed and its lines are pressure-broadened, so τ grows as the square of pressure: τ = τ∞ (p/1000 hPa)². The real atmosphere has no single τ: CO₂, water vapour and ozone absorb in bands of very different strength. A grey band keeps the physics of emission and absorption and drops the spectrum, which is why τ∞ here is not a CO₂ concentration. The window fraction stays a tenth at every temperature, a simplification.</p>`
		},
		{
			id: 'radiative',
			chapter: 'radiation',
			title: 'Radiative equilibrium',
			scene: 'column',
			hints: { focus: 'radiative', radiative: true },
			duration: 26,
			controls: [tau, window],
			body: `
<p>Let every layer settle until it absorbs exactly as much as it emits. For a grey gas (close the window) the two-stream equations then have an exact solution:</p>
<p class="formula"><strong>σT⁴(τ) = (OLR/2)(1 + τ)</strong></p>
<p>Temperature rises with depth into the absorber. At the very top, where τ → 0, the air settles at the <dfn data-def="The temperature of the thin top of a grey atmosphere: it absorbs from the upward stream and emits both up and down, so σT⁴ = OLR/2.">skin temperature</dfn>, 2<sup>−¼</sup> × 255 ≈ 214 K, whatever τ∞ is. The ground, which also takes the sunlight, is warmer still: <span class="formula">σTₛ⁴ = (OLR/2)(2 + τ∞)</span>, 328 K at τ∞ = 3.5 with the window closed, and 17 K warmer than the air touching it.</p>
<p>Slide τ∞: the whole lower column heats up, the top hardly changes.</p>`,
			notes: `<p>Check the solution: in radiative equilibrium the net upward flux U − D is the same at every level, the OLR. Subtract the two equations: d(U − D)/dτ = U + D − 2B = 0, so B = (U + D)/2; add them: d(U + D)/dτ = U − D = OLR, so U + D grows linearly with τ from its top value OLR (nothing comes down from space). Hence B = (OLR/2)(1 + τ). The model's layers reproduce σT⁴ to within 0.5% over the slider's range. With the window open, the band carries only part of the OLR and the skin is set by that part: (1 − w)σT⁴ = (OLR − window flux)/2.</p>`
		},
		{
			id: 'unstable',
			chapter: 'radiation',
			title: 'Too steep to stand still',
			scene: 'column',
			hints: { focus: 'unstable', radiative: true },
			duration: 24,
			controls: [tau, lapse, window],
			body: `
<p>Radiative equilibrium puts a hot ground under air that cools very fast with height: at τ∞ = 3.5 (window open) the lowest kilometre cools by about 13 K per km, more than the 9.8 K/km of the <dfn data-def="How fast a rising parcel of dry air cools by expanding: g/cₚ = 9.8 K per km.">dry adiabat</dfn>.</p>
<p>Air that cools faster with height than a rising parcel would is <strong>unstable</strong>: a parcel nudged upward stays warmer than its surroundings and keeps rising, as in the <a href="../atmosphere-weather/#convection">convection</a> that drives the weather. The red stretch of the profile marks the layers steeper than the lapse rate on the slider. A real atmosphere could not stay like this for an hour: it would overturn.</p>`,
			notes: `<p>The lapse rate is the fall of temperature with height, −dT/dz. A parcel of dry air cools at g/cₚ as it rises and expands; a saturated parcel more slowly, since condensing vapour releases latent heat. Any layer whose surroundings cool faster than the parcel is unstable to convection. Radiative equilibrium is steepest near the ground because the absorber is densest there, and it has the jump at the ground on top of that.</p>`
		},
		// ------------------------------------------------------------------ convection
		{
			id: 'convection',
			chapter: 'convection',
			title: 'Convection takes the lower column',
			scene: 'column',
			hints: { focus: 'convection' },
			duration: 26,
			controls: [convection, lapse, tau, window],
			body: `
<p>Now let convection act. Wherever the profile is steeper than the chosen <dfn data-def="The fall of temperature with height, in K per km. Convection keeps the lower atmosphere close to the lapse rate of rising moist air.">lapse rate</dfn> Γ, the air mixes it back to exactly Γ, keeping its heat: the ground, which was too hot, gives heat to the air above. Radiation keeps working on every layer, and the column settles again.</p>
<p>The result has two parts. Below, a <strong>troposphere</strong> on the lapse rate, the ground no warmer than the air touching it; above, a <strong>stratosphere</strong> in radiative equilibrium. The <dfn data-def="The top of the convecting region, where the temperature profile stops following the lapse rate.">tropopause</dfn> between them lies where the radiative profile becomes stable on its own: about 10.7 km at τ∞ = 3.5 and 6.5 K/km, with a surface of 288.7 K, 26 K cooler than without convection.</p>
<p>Switch convection off and on to compare; slide the lapse rate to see the tropopause move.</p>`,
			notes: `<p>This is the convective adjustment of Manabe and Strickler (1964) and Manabe and Wetherald (1967): after every radiative time step, any unstable stretch of the column (the ground included) is reset to the lapse rate, conserving its enthalpy ∫ cₚ T dp/g. In equilibrium every radiative layer has zero net heating, and the convecting region, ground included, has zero net heating in total: radiation cools the troposphere and convection carries up the heat the ground receives. Real convection does not act instantly, and the real tropopause also depends on ozone heating and on the large-scale circulation.</p>`
		},
		// ------------------------------------------------------------------ emission
		{
			id: 'emission',
			chapter: 'emission',
			title: 'The level the planet radiates from',
			scene: 'column',
			hints: { focus: 'emission' },
			duration: 26,
			controls: [tau, window],
			body: `
<p>Infrared emitted deep in the column is absorbed again before it gets out. What reaches space leaves from layers with little absorber above them, and most of it from around the level where the optical depth from the top is 1: the <dfn data-def="The level from which the planet's escaping infrared mostly leaves; for a grey band, about where the optical depth from the top is 1.">emission level</dfn>. The bars on the right show how much of the outgoing 238 W/m² leaves from each kilometre of height.</p>
<p>In the reference column the emission level is about 5 km up, where the air is at 256 K, close to the planet's emission temperature of 255 K. The planet radiates at roughly the temperature of its emission level, not of its ground; since the escaping infrared comes from a range of heights (and partly from the ground), the two need not match exactly. The ground's own infrared reaches space only through the window (about 39 W/m², the bar at the bottom) and as the few per cent of the band that gets through.</p>`,
			notes: `<p>A layer's share of the outgoing infrared is its emission times the fraction that reaches the top, e<sup>−τ</sup>. For τ growing as p² that product peaks near τ = 1. In pure grey radiative equilibrium the temperature at τ = 1 is exactly the emission temperature: (OLR/2)(1 + 1) = OLR. Measured, about 40 W/m² of Earth's outgoing infrared leaves through the window (Trenberth, Fasullo and Kiehl 2009); the window here was set to match.</p>`
		},
		{
			id: 'forcing',
			chapter: 'emission',
			title: 'Add absorber: the planet radiates from higher up',
			scene: 'run',
			hints: { phase: 'instant', convective: true },
			duration: 24,
			controls: [tau, window, lapse],
			body: `
<p>Double τ∞ and, for a moment, hold every temperature where it was. The emission level climbs: at τ∞ = 7 it sits where the old optical depth was ½, about 3 km higher. The air there is colder, it emits less, and the planet now sends out only about 198 W/m² while still absorbing 238: an imbalance, or <dfn data-def="The change in the planet's energy balance (W/m²) caused by a change such as more greenhouse gas, before the temperatures respond.">radiative forcing</dfn>, of 40 W/m².</p>
<p>This is the greenhouse effect, seen from the column. The gas does not reflect infrared or put a lid on the heat: every layer still emits. The planet loses less because its escaping infrared now comes from higher, colder air.</p>`,
			notes: `<p>Doubling τ∞ in a grey model is like doubling every infrared absorber at once, water vapour included, so the forcing is about ten times the 3.7 W/m² of doubling CO₂ alone. Real CO₂ absorbs strongly at the centre of its 15 µm band and weakly in its wings, so each doubling adds roughly the same forcing: the logarithmic dependence that a single grey τ cannot show.</p>`
		},
		{
			id: 'response',
			chapter: 'emission',
			title: 'The column warms until the balance is back',
			scene: 'run',
			hints: { phase: 'run', convective: true },
			duration: 30,
			controls: [tau, window, lapse],
			body: `
<p>Now let time run. The column, given twice the absorber, starts out short of 40 W/m² and warms. The troposphere is tied to the ground by convection, and the ground here is 50 m of ocean, so it warms over years. Once the new, higher emission level has warmed to within a few kelvin of what the old one was, the planet sends out 238 W/m² again (a little more now leaves through the window from the warmer ground). The lapse rate has not changed, so the whole troposphere and the ground below have warmed together: by about 15.6 K at the ground here.</p>
<p>The stratosphere answers first: within months it has cooled by several kelvin, because it now holds more absorber and gets less infrared from the colder emission level below. As the troposphere warms, part of that cooling goes again; what is left over depends on the window, the subject of the last chapter.</p>`,
			notes: `<p>Heat capacities are real here: cₚΔp/g for every layer of air, and 50 m of seawater for the surface, a typical depth of the ocean's mixed layer. The deep ocean, which in reality slows the warming for centuries, is left out, and so are every feedback (water vapour, ice, clouds): the warming is that of a column holding its lapse rate and its absorber fixed. The time axis is logarithmic, from a day to 30 years.</p>`
		},
		{
			id: 'saturated',
			chapter: 'emission',
			title: 'A saturated band still warms',
			scene: 'column',
			hints: { focus: 'saturated' },
			duration: 24,
			controls: [tau],
			body: `
<p>Slide τ∞ to 8. The band now lets only e<sup>−8</sup>, 0.03%, of the ground's infrared through to space: it is <strong>saturated</strong> at the surface, and adding more absorber cannot block what is already blocked.</p>
<p>Yet go on to 12 and the ground warms by another 9 K. What matters is not what the ground sees but where the escaping infrared leaves from, and that level keeps climbing (8.5 km at τ∞ = 8, 10.3 km at 12) into colder air. The same is true of real CO₂: its band is saturated near the ground, and adding more still warms the planet by lifting the level its band radiates from.</p>`,
			notes: `<p>The argument that a saturated band cannot warm counts only absorption between the ground and space. Emission is the other half: in a saturated band the gas itself is what radiates to space, from the level where it thins out, and more gas pushes that level higher and colder. For real CO₂ the wings of the band also widen as the centre saturates. Both keep its effect growing, roughly with the logarithm of the concentration.</p>`
		},
		// ------------------------------------------------------------------ stratosphere
		{
			id: 'stratosphere',
			chapter: 'stratosphere',
			title: 'Why the stratosphere cools, and when it does not',
			scene: 'column',
			hints: { focus: 'strat' },
			duration: 30,
			controls: [tau, window, lapse],
			body: `
<p>Above the tropopause the air is in radiative balance with the infrared coming up through the band, roughly <span class="formula">(1 − window) σT⁴ = U<sub>band, top</sub>/2</span>. Close the window and all 238 W/m² must leave through the band: the top of the stratosphere stays at the skin temperature, 214 K, whatever τ∞, and adding absorber does <strong>not</strong> cool the stratosphere (its lower layers even warm by a fraction of a kelvin).</p>
<p>Open the window and the warming ground sends more of its infrared straight out through it, so less needs to leave through the band: the band's upward flux falls, and so does the stratosphere's temperature. From τ∞ = 3.5 to 7 it cools by about 2.5 K while the ground warms by 15.6 K. Stratospheric cooling is not automatic for any absorber; here it comes from the part of the spectrum the gas leaves open.</p>`,
			notes: `<p>This is the window-grey model of Goessling and Bathiany (2016). Satellites have measured the stratosphere cooling as CO₂ has risen, while the troposphere warmed: a fingerprint of greenhouse warming, since a brighter Sun would warm both. Real CO₂-induced cooling has more than one cause: the blocking of upward infrared in CO₂'s band, a spectral effect a grey gas cannot show, and an indirect solar effect, in which extra CO₂ lets air heated by ozone's absorption of sunlight shed that heat faster (this one works even for a grey absorber). How much a gas cools the stratosphere depends on where in the spectrum it absorbs. The real stratosphere warms with height, because ozone absorbs the Sun's ultraviolet; this column has no ozone, so its stratosphere is nearly isothermal.</p>`
		}
	]
};
