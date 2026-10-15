import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { TODAY, perihelionDay } from './milankovitch';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
/** Day of the year (0 = 1 January) as "3 Jan". */
export const dateText = (day: number) => {
	const d = ((Math.round(day) % 365) + 365) % 365;
	let m = 11;
	while (MONTH_START[m] > d) m--;
	return `${d - MONTH_START[m] + 1} ${MONTHS[m]}`;
};
/** "today", "21,000 years ago". */
export const agoText = (ka: number) =>
	Math.round(ka) === 0 ? 'today' : `${Math.round(ka).toLocaleString('en-US')},000 years ago`;

export const TODAY_DAY = Math.round(perihelionDay(TODAY));

const tilt: Control = {
	type: 'range',
	id: 'tilt',
	label: "Tilt of Earth's axis",
	min: 21.5,
	max: 25,
	step: 0.05,
	default: Number(TODAY.tilt.toFixed(2)),
	format: (v) => `${v.toFixed(2)}°`,
	help: 'Today 23.44°. Over the last 800,000 years it stayed between 22.1° and 24.5°. Or drag the axis.'
};

const ecc: Control = {
	type: 'range',
	id: 'ecc',
	label: 'Stretch of the orbit (eccentricity)',
	min: 0,
	max: 0.06,
	step: 0.001,
	default: Number(TODAY.e.toFixed(3)),
	format: (v) => (v === 0 ? '0 (a circle)' : v.toFixed(3)),
	help: 'Today 0.017. Over the last 800,000 years, from 0.004 to 0.050.'
};

const closest: Control = {
	type: 'range',
	id: 'closest',
	label: 'Closest to the Sun on',
	min: 0,
	max: 364,
	step: 1,
	default: TODAY_DAY,
	format: dateText,
	help: 'Today about 3 January. The wobble moves it right round the calendar. Or drag the closest point.'
};

const ka: Control = {
	type: 'range',
	id: 'ka',
	label: 'Time',
	min: 0,
	max: 800,
	step: 1,
	default: 0,
	format: agoText,
	help: 'Moving it stops the playback.'
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Play the cycles forward',
	default: true,
	help: 'From 800,000 years ago to today, 20,000 years a second.'
};

const look: Control = {
	type: 'range',
	id: 'look',
	label: 'Look at',
	min: 0,
	max: 800,
	step: 1,
	default: 21,
	format: agoText,
	help: 'Or move along the record with the pointer.'
};

const series: Control = {
	type: 'select',
	id: 'series',
	label: 'Rhythms of',
	default: 'temp',
	options: [
		{ value: 'temp', label: 'Antarctic temperature' },
		{ value: 'co2', label: 'CO₂ in the air' },
		{ value: 'summer', label: 'Summer sunshine at 65° N' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'ice-ages',
	title: 'Ice ages and the orbital cycles that pace them',
	summary:
		'Tilt the Earth, turn its wobble and stretch its orbit to change how much summer sunshine reaches the far north. Then play the three cycles forward against 800,000 years of ice-core temperature and CO₂, and see how ice and carbon turn a small push into an ice age.',
	chapters: [
		{ id: 'record', title: 'The record in the ice' },
		{ id: 'orbit', title: 'Three slow cycles' },
		{ id: 'pacing', title: 'The pacemaker' },
		{ id: 'feedbacks', title: 'Amplifiers' }
	],
	steps: [
		// ------------------------------------------------------------------ record
		{
			id: 'record',
			chapter: 'record',
			title: '800,000 years in a column of ice',
			scene: 'record',
			hints: { phase: 'record' },
			duration: 22,
			controls: [look],
			body: `
<p>Snow that falls on the middle of Antarctica never melts. Year after year it piles up and is pressed into ice, and each layer keeps a sample of the weather and the air of its time. At <strong>Dome C</strong> the European EPICA project drilled almost 3.3 km down, to ice that fell about 800,000 years ago.</p>
<p>The temperature comes from the water itself. Water molecules carrying the heavier hydrogen isotope, <dfn data-def="Hydrogen with a neutron in its nucleus as well as a proton: about 1 atom in 6,400 in seawater. Water containing it is slightly heavier and condenses more readily.">deuterium</dfn>, condense out of the air a little more easily, so the colder the air, the less of it is left in the snow. Measured every 55 cm down the core, it gives the curve on the stage: the temperature of Antarctica compared with the last 1,000 years.</p>
<p>Most of the time it was much colder than now: these are the <strong>glacial periods</strong>, the ice ages. Look at 21,000 years ago, the depth of the last one: Antarctica was about 9 °C colder. The short warm spells, like the one we live in, are the <dfn data-def="A warm period between glacials, with ice sheets about as small as today's. The present one, the Holocene, began about 11,700 years ago.">interglacials</dfn>.</p>`,
			notes: `<p>Data: EPICA Dome C deuterium and temperature, Jouzel et al. (2007), <i>Science</i> 317, 793, on the EDC3 timescale, from the NOAA NCEI paleoclimate archive; averaged here in 500-year bins (1,478 points). The temperature conversion corrects for the changing isotopes of the ocean and the height of the ice sheet. This is a <em>local</em> temperature: the poles swing about one and a half to two times as much as the planet as a whole. The world as a whole was 5 to 7 °C colder at the last glacial maximum (IPCC AR6 WG1 §7.5.3.1), and the sea was 125–134 m lower, its water locked in ice sheets up to 3 km thick over North America and Scandinavia (AR6 WG1 §2.3.3.3).</p>`
		},
		{
			id: 'rhythm',
			chapter: 'record',
			title: 'A slow beat, and a sawtooth',
			scene: 'record',
			hints: { phase: 'rhythm' },
			duration: 22,

			body: `
<p>The record is not random. Over the last 450,000 years the warm peaks come about 129,000, 242,000, 333,000 and 407,000 years ago, and today. The gaps are irregular, from 74,000 to 126,000 years, but average about <strong>100,000 years</strong>, with smaller wiggles on top.</p>
<p>The shape is lopsided, like a saw blade. Each glacial creeps in over tens of thousands of years, cooling in fits and starts as the ice sheets grow; then, in less than about 10,000 years, the cold collapses into an interglacial. These sudden endings are called <dfn data-def="The rapid end of a glacial period, when the great ice sheets melt and the climate jumps to an interglacial within a few thousand years.">terminations</dfn>.</p>
<p>Before about 430,000 years ago the interglacials were cooler than today's. What could set such a slow, steady rhythm? Something that keeps time over hundreds of thousands of years: the shape of Earth's orbit.</p>`,
			notes: `<p>The peaks are the warmest 500-year bins of each warm stretch in the Dome C record. Ice-core ages this old come from a model of how the ice flowed, pinned by a few markers of known age; EDC3 is uncertain by up to about 6,000 years in the oldest part.</p>`
		},
		// ------------------------------------------------------------------ orbit
		{
			id: 'tilt',
			chapter: 'orbit',
			title: 'Cycle 1: the tilt nods',
			scene: 'orbit',
			hints: { focus: 'tilt' },
			duration: 22,
			controls: [tilt],
			body: `
<p>The <a href="../sun-earth-moon/#tilt">tilt of Earth's axis</a> makes the seasons. It is 23.44° today, but it is not fixed: the pull of the Moon, the Sun and the other planets makes it nod slowly between about <strong>22.1° and 24.5°</strong> and back, once every <strong>41,000 years</strong>.</p>
<p>A bigger tilt leans the summer hemisphere further towards the Sun, so summers get more sunshine and winters less. The number on the stage is the classic modern measure, following Milankovitch's focus on northern summers: the sunshine reaching the top of the atmosphere at <strong>65° N</strong> on the day of the June solstice, averaged over 24 hours, in W/m² (watts per square metre). (Milankovitch himself used the total over the half-year of summer, which leans more on the tilt.)</p>
<p>Drag the axis or the slider. Across its whole real range, the tilt alone changes that summer sunshine by about 40 W/m², roughly 9%.</p>`,
			notes: `<p>The orbit and axis come from the La2004 solution (Laskar et al. 2004, <i>Astronomy &amp; Astrophysics</i> 428, 261), a numerical integration of the solar system computed at the IMCCE in Paris. The sunshine is the standard daily-mean formula (Berger 1978) with a total solar irradiance of 1,361 W/m²; it agrees within 1.5% with the classic tables of Berger &amp; Loutre (1991) at dates sampled across the last 800,000 years.</p>`
		},
		{
			id: 'stretch',
			chapter: 'orbit',
			title: 'Cycle 2: the orbit stretches',
			scene: 'orbit',
			hints: { focus: 'ecc' },
			duration: 22,
			controls: [ecc],
			body: `
<p>Earth's orbit is an <a href="../orbits-kepler/#first">ellipse</a>, with the Sun a little off centre. How stretched it is, its <dfn data-def="How far an ellipse is from a circle: 0 for a circle, close to 1 for a long thin orbit. It is the distance from the centre to the Sun divided by the semi-major axis.">eccentricity</dfn>, changes too, as the other planets tug on it: from nearly a circle to about 0.05, with beats of about <strong>100,000</strong> and <strong>405,000 years</strong>.</p>
<p>Today it is 0.017: the Earth is about 3% closer to the Sun in early January than in early July, and gets about 7% more sunlight then. At 0.05 the difference would be about 22%.</p>
<p>But look at the bottom number. Averaged over the whole globe and the whole year, the stretch hardly changes the sunlight at all: by about 0.1% at most. It only matters by deciding <em>which season</em> gets the close pass, and that is the third cycle.</p>`,
			notes: `<p>The yearly total of sunlight grows as 1/√(1 − e²): 340.3 W/m² averaged over the globe today, and at most 0.4 W/m² more over the last 800,000 years. The orbit on the stage is drawn to scale: at e = 0.05 it is still 99.9% as wide as it is long, but the Sun sits 5% of the way from the centre to the edge.</p>`
		},
		{
			id: 'wobble',
			chapter: 'orbit',
			title: 'Cycle 3: the axis wobbles',
			scene: 'orbit',
			hints: { focus: 'peri' },
			duration: 24,
			controls: [closest, ecc],
			body: `
<p>Like a spinning top, the Earth's axis slowly swings round in a circle, once every 26,000 years or so: <dfn data-def="The slow turning of the direction of Earth's axis, and of the orbit, which changes the time of year when the Earth passes closest to the Sun.">precession</dfn>. Meanwhile the ellipse itself slowly turns. Together they move the seasons round the orbit, so the date of the closest pass drifts through the whole calendar, every <strong>19,000 to 23,000 years</strong>.</p>
<p>Today the close pass falls in the northern winter, so northern summers happen far from the Sun. About 11,000 years ago it fell in late June: northern summers were close to the Sun. At today's stretch, moving the close pass from January to the June solstice alone adds about 33 W/m² to the summer sunshine.</p>
<p>Now set the stretch to zero: on a circular orbit there is no close pass, and the wobble does nothing. The more stretched the orbit, the stronger the effect of the wobble.</p>`,
			notes: `<p>What matters for the seasons is the climatic precession, e sin ϖ, where ϖ is the angle from the March equinox to the closest point (perihelion) seen from the Sun. Its strongest periods are 23,700, 22,400 and 19,000 years. The dates on this page use a calendar pinned to the March equinox on 20 March.</p>`
		},
		{
			id: 'summer',
			chapter: 'orbit',
			title: 'Summer sunshine in the far north',
			scene: 'orbit',
			hints: { focus: 'all' },
			duration: 26,
			controls: [tilt, ecc, closest],
			body: `
<p>Milankovitch's idea was that ice ages begin and end in the northern summer. Most of the world's land is in the north, and that is where the great ice sheets grew, over Canada and Scandinavia. Snow falls there every winter anyway; what matters is whether the summer is warm enough to melt it. If it is not, snow piles up year after year and becomes an ice sheet.</p>
<p>All three cycles act on that summer sunshine. With all three at their real settings, it was <strong>439 W/m²</strong> 116,000 years ago, when the last glacial began; it is <strong>478 W/m²</strong> today, and was <strong>549 W/m²</strong> during the last interglacial, 127,000 years ago. Try to make the coolest and the warmest summer you can.</p>
<p>In the <a href="../sun-earth-moon/#distance">seasons explainer</a> the distance to the Sun was too small to cause the seasons. That is still true: here it is not making the seasons, but nudging how much the northern summer melts.</p>`,
			notes: `<p>Kepler's second law hides a twist: when the summer falls close to the Sun, the Earth moves faster and the summer is shorter. The total sunshine of a whole summer depends mostly on the tilt, while the peak sunshine depends strongly on the wobble (Huybers 2006, <i>Science</i> 313, 508). Which one the ice sheets respond to is still debated; the 65° N mid-June value is the classic choice in modern work, and the one used to date many marine records.</p>`
		},
		// ------------------------------------------------------------------ pacing
		{
			id: 'cycles',
			chapter: 'pacing',
			title: 'Play the cycles forward',
			scene: 'timeline',
			hints: { phase: 'play' },
			duration: 46,
			controls: [play, ka],
			body: `
<p>Here are the three cycles over the last 800,000 years, computed from the orbit, with the summer sunshine at 65° N they add up to, and below them the temperature record from Dome C. Play them forward and watch them line up.</p>
<p>The tilt nods at a steady 41,000-year pace. The wobble's effect swells and fades with the stretch: strong when the orbit is stretched, almost nothing when it is nearly round, as around 400,000 years ago. The sunshine curve mixes the two.</p>
<p>The temperature does not copy the sunshine wiggle for wiggle, but the big moves fall into step with it: the last ice age ended as northern summer sunshine climbed towards its peak 11,000 years ago, and the one before ended during the climb towards the even stronger peak of 127,000 years ago.</p>`
		},
		{
			id: 'beats',
			chapter: 'pacing',
			title: 'Pick out the beats',
			scene: 'spectrum',
			duration: 24,
			controls: [series],
			body: `
<p>A <a href="../fourier-transform/">Fourier transform</a> splits a wiggly curve into steady rhythms and measures how strong each one is. Applied to the Dome C temperature it finds a strong beat at about <strong>100,000 years</strong>, a clear one at <strong>41,000</strong> and a weaker one at <strong>23,000</strong>: the periods of the stretch, the tilt and the wobble.</p>
<p>This is the fingerprint that convinced scientists. In 1976 Hays, Imbrie and Shackleton found the same three beats in sediments from the floor of the Southern Ocean, and called Earth's orbit the "pacemaker of the ice ages".</p>
<p>Switch to the summer sunshine: its beats are the tilt and the wobble, with almost nothing at 100,000 years. The strongest beat of the ice ages is the weakest in the push. Something inside the climate must make it.</p>`,
			notes: `<p>The spectrum is computed on the page: the record resampled every 1,000 years over 0–800,000 years ago, its mean and trend removed, a Hann window applied, and the amplitude of each sine wave fitted at periods from 10,000 to 160,000 years. An 800,000-year record cannot separate 95,000 from 125,000 years, so the eccentricity beats blur into one peak near 95,000. Hays, Imbrie &amp; Shackleton (1976), <i>Science</i> 194, 1121.</p>`
		},
		{
			id: 'puzzle',
			chapter: 'pacing',
			title: 'The 100,000-year puzzle',
			scene: 'timeline',
			hints: { phase: 'puzzle' },
			duration: 24,
			controls: [ka],
			body: `
<p>The stretch of the orbit is the one cycle with a 100,000-year beat, and it barely changes the sunlight. So the orbit cannot simply be forcing the ice ages: it <em>paces</em> them, and the climate does the rest.</p>
<p>The best explanation today is that big ice sheets become fragile. A young ice sheet survives a good summer or two. But after tens of thousands of years of growth it is huge, its base is warm and the land under it has sunk, and then one strong rise in summer sunshine sets off a collapse. Of the nine terminations shaded here, eight began while summer sunshine was rising. But most rises in sunshine come and go while the ice keeps growing: 37 of them in 800,000 years, for nine terminations.</p>
<p>The rhythm has not always been 100,000 years. In sea-floor records older than about a million years, the ice ages came every 41,000 years, in step with the tilt alone. Why the beat changed is still an open question.</p>`,
			notes: `<p>Abe-Ouchi et al. (2013), <i>Nature</i> 500, 190, reproduce the 100,000-year cycles with an ice-sheet model driven by the orbit and CO₂: the North American ice sheet only retreats completely once it has grown large. The switch from a 41,000-year to a 100,000-year rhythm, the Mid-Pleistocene Transition, happened between about 1.2 million and 700,000 years ago (Lisiecki &amp; Raymo 2005, <i>Paleoceanography</i> 20, PA1003).</p>`
		},
		// ------------------------------------------------------------------ feedbacks
		{
			id: 'small',
			chapter: 'feedbacks',
			title: 'A small push, a big swing',
			scene: 'push',
			hints: { phase: 'small' },
			duration: 22,
			body: `
<p>The <a href="../greenhouse-effect/">greenhouse-effect explainer</a> showed that a planet's temperature is set by a balance: sunlight absorbed against infrared escaping. The orbit barely touches the global side of that balance. Over the whole Earth and the whole year, the sunlight 21,000 years ago, at the coldest of the last ice age, was within 0.02 W/m² of today's.</p>
<p>Yet the world was 5 to 7 °C colder. The orbit moves sunshine between seasons and latitudes; it is the climate's response to that shuffle, in the north in summer, that grows into an ice age. Two changes did most of the growing: ice, and greenhouse gases (with dust and vegetation adding a less certain share).</p>`,
			notes: `<p>IPCC AR6 WG1 §7.5.3.1: "orbital forcing relative to pre-industrial was negligible" at the last glacial maximum, which was 5 to 7 °C colder (very likely). The bars are the changes in the energy balance at the last glacial maximum assessed by IPCC AR4 WG1 §6.4.1.2: −2.8 W/m² from the lower greenhouse gases (CO₂, methane, nitrous oxide) and about −3.2 W/m² from the ice sheets and the lower sea level. AR4 adds roughly −1 W/m² each from dust and vegetation changes, about −8 W/m² in all, with large uncertainties (§9.2.1.3).</p>`
		},
		{
			id: 'ice',
			chapter: 'feedbacks',
			title: 'Amplifier 1: ice reflects sunlight',
			scene: 'push',
			hints: { phase: 'ice' },
			duration: 22,
			body: `
<p>Snow and ice reflect most of the sunlight that falls on them. Once a cool summer lets snow survive, the brighter ground reflects more sunshine, which keeps the next summer cooler still, and the snow spreads. At the last glacial maximum, ice sheets up to 3 km thick covered most of Canada and northern Europe.</p>
<p>That loop works on the absorbed-sunlight side of the balance: about −3.2 W/m² at the glacial maximum, a little more than the −2.8 W/m² of all the greenhouse gases put together. It runs the other way too: as summers warm, the ice darkens with meltwater and dust, shrinks and lets the bare ground absorb more sunlight.</p>`,
			notes: `<p>The same ice-albedo feedback appears in the <a href="../greenhouse-effect/#ice">greenhouse-effect explainer</a> for today's sea ice and snow; the great ice sheets add a much bigger, slower version. The ice sheets also locked up so much water that the sea was 125–134 m lower (AR6 WG1 §2.3.3.3), exposing land that is now sea floor.</p>`
		},
		{
			id: 'co2',
			chapter: 'feedbacks',
			title: 'Amplifier 2: CO₂ follows the ice ages',
			scene: 'co2',
			duration: 26,
			body: `
<p>Bubbles in the ice are tiny samples of old air. Their CO₂ rose and fell with the Antarctic temperature through all eight cycles: about <strong>180–190 ppm</strong> (parts per million) at the depths of the glacial periods and <strong>240–300 ppm</strong> in the interglacials. The two curves match with a correlation of 0.9.</p>
<p>A cold ocean dissolves more CO₂, and in glacial times the deep ocean stored more carbon; as the climate warmed, it gave it back. That is the <a href="../carbon-cycle/#ocean">ocean side of the carbon cycle</a> at work. And CO₂ is a greenhouse gas, so the release warmed the planet further: the drop from 278 to 190 ppm alone is worth about −2.2 W/m². CO₂ was both a result of the warming and a cause of more of it.</p>`,
			notes: `<p>CO₂: the Antarctic composite of Bereiter et al. (2015), <i>Geophysical Research Letters</i> 42, 542 (AICC2012 gas ages), averaged in 500-year bins, before 1850 only. The forcing uses the logarithmic rule of AR6 WG1 (3.93 W/m² per doubling). The temperature is on the EDC3 timescale and CO₂ on AICC2012, which differ by up to a few thousand years, so this page does not try to read leads or lags. How the ocean held the extra carbon (colder water, sea ice, a more sluggish deep circulation, more dust fertilising plankton) is still being worked out.</p>`
		},
		{
			id: 'next',
			chapter: 'feedbacks',
			title: 'The next ice age, and today',
			scene: 'future',
			duration: 26,
			body: `
<p>The orbit can be computed far into the future. Over the next 100,000 years it grows almost circular, to an eccentricity of 0.002 about 26,000 years from now, so the wobble almost stops mattering and northern summer sunshine swings only about two-thirds as much as over the last 100,000 years. Its next deep low comes in about 54,000 years.</p>
<p>With CO₂ at its pre-industrial level, models find that the next glacial would probably begin only about 50,000 years from now. But CO₂ is now <strong>426 ppm</strong>, far above anything in the 800,000-year record, and it stays in the air for many thousands of years. The same models find that a total of 1,000–1,500 billion tonnes of carbon, not far beyond what people have emitted so far, would postpone the next ice age by at least 100,000 years.</p>
<p>The orbit sets the beat; ice and CO₂ turn it into ice ages. Today the CO₂ is set by us.</p>`,
			notes: `<p>Ganopolski, Winkelmann &amp; Schellnhuber (2016), <i>Nature</i> 529, 200: with no human emissions the current interglacial would probably last about 50,000 more years; 1,000–1,500 billion tonnes of carbon (cumulative emissions) would postpone the next glacial inception by at least 100,000 years. Today's CO₂: NOAA Global Monitoring Laboratory, global annual mean for 2025.</p>`
		}
	]
};
