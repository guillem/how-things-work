import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import {
	HALLEY,
	darkTemperature,
	dateOf,
	daysAtDistance,
	daysOfYear,
	daysWithin,
	iceRate,
	speed,
	stateAt,
	sunlight,
	tailBend,
	yearOf
} from './model';

const round = Math.round;
const YEAR = 365.25;

/** A distance from the Sun for the reader: "35 times as far as Earth", "0.6 of Earth’s distance". */
export function far(r: number): string {
	if (r < 0.95) return `${r.toFixed(1)} of Earth’s distance`;
	if (r < 1.05) return 'the same distance as Earth';
	const n = r < 5 ? r.toFixed(1).replace(/\.0$/, '') : String(round(r));
	return `${n} times as far as Earth`;
}

/** How long before (or after) the 1986 closest approach: "34 years before", "3 weeks after". */
export function when(days: number): string {
	const a = Math.abs(days);
	const side = days < 0 ? 'before' : 'after';
	if (a < 1) return 'closest to the Sun';
	if (a < 14) return `${round(a)} day${round(a) === 1 ? '' : 's'} ${side}`;
	if (a < 60) return `${round(a / 7)} weeks ${side}`;
	if (a < 2 * YEAR) return `${round(a / 30.44)} months ${side}`;
	return `${round(a / YEAR)} years ${side}`;
}

/** Stops of the "how far" control in the close-up: far out, coming in, closest. */
export const STOPS = [HALLEY.Q, 20, 10, 5, 3, 2, 1.5, 1, HALLEY.q] as const;

/** "Feb 1986" for a calendar year with fraction. */
export const monthOf = (year: number) => dateOf(daysOfYear(year)).replace(/^\d+ /, '');

const year: Control = {
	type: 'range',
	id: 'year',
	label: 'Year',
	min: round(yearOf(-HALLEY.period / 2) * 10) / 10,
	max: round(yearOf(HALLEY.period / 2) * 10) / 10,
	step: 0.05,
	default: 1960,
	format: monthOf,
	help: 'Or drag the comet along its path.'
};

const reach: Control = {
	type: 'range',
	id: 'reach',
	label: 'Coming in',
	min: 0,
	max: STOPS.length - 1,
	step: 1,
	default: 0,
	format: (i) => far(STOPS[Math.round(i)]),
	help: 'Bring the comet in towards the Sun.'
};

const day = (id: string, def: number): Control => ({
	type: 'range',
	id,
	label: 'Date',
	min: -120,
	max: 120,
	step: 1,
	default: def,
	format: dateOf,
	help: 'Or drag the comet along its path.'
});

const zoom: Control = {
	type: 'range',
	id: 'zoom',
	label: 'Zoom',
	min: 1,
	max: 12,
	step: 0.5,
	default: 6,
	format: (z) => `${z} times`,
	help: 'Zoom in on the comet’s head.'
};

const peri = stateAt(0);
const aph = stateAt(HALLEY.period / 2);
const beyondNeptune = (HALLEY.period - daysWithin(30.07)) / YEAR;
/** Days of the Giotto flyby, 14 March 1986. */
export const GIOTTO = 32.6;

const nucleus =
	'<dfn data-def="The solid part of a comet: a lump of ice mixed with dust and rock, a few kilometres across. Halley’s is about 15 km long.">nucleus</dfn>';
const coma =
	'<dfn data-def="The fuzzy cloud of gas and dust round a comet’s nucleus: the comet’s head. It can be wider than Earth.">coma</dfn>';
const wind =
	'<dfn data-def="A thin stream of tiny electrically charged bits that the Sun blows out in every direction, at about 400 km a second.">solar wind</dfn>';

export const spec: ExplainerSpec = {
	slug: 'comet-tails',
	title: 'Comets and their tails',
	summary:
		'Drag Halley’s comet along its real 76-year path: frozen for decades far beyond Neptune, then swinging close to the Sun, where its ice turns to gas and two tails stream out. The tails point away from the Sun, whichever way the comet is going, so it leaves tail-first.',
	chapters: [
		{ id: 'comet', title: 'A visitor from far away' },
		{ id: 'ice', title: 'Ice in sunlight' },
		{ id: 'tails', title: 'The tails' }
	],
	steps: [
		// ------------------------------------------------------------------ comet
		{
			id: 'comet',
			chapter: 'comet',
			title: 'A fuzzy star with a tail',
			scene: 'close',
			hints: { phase: 'comet', day: GIOTTO },
			duration: 14,
			body: `
<p>In early 1986, people all over the world went out on dark nights to look for a faint, fuzzy smudge with a tail: <strong>Halley’s comet</strong>. It comes back about every 76 years, so most people see it once in their lives at most. It will be back in 2061.</p>
<p>What is a comet, and why does it have a tail? Here it is as it was on ${dateOf(GIOTTO)}, near the Sun, seen from far above (the comet is drawn much bigger than life). It has a bright head and <strong>two tails</strong>, and they point the same way: away from the Sun.</p>`
		},
		{
			id: 'orbit',
			chapter: 'comet',
			title: 'A long, stretched path',
			scene: 'orbit',
			hints: { phase: 'orbit' },
			duration: 24,
			controls: [year],
			body: `
<p>Halley’s comet goes round the Sun like the planets do, but on a long, stretched path. <strong>Drag the comet along it</strong>, or move through the years.</p>
<p>At its farthest it is out beyond Neptune, <strong>${round(aph.r)} times as far from the Sun as Earth</strong>, and it crawls along at less than 1 km a second. It spends ${round(beyondNeptune)} of its ${round(HALLEY.period / YEAR)} years out there, beyond Neptune.</p>
<p>Then it falls back in, faster and faster, and swings round the Sun closer than Venus at <strong>${round(speed(peri))} km a second</strong>, about ${round(speed(peri) / speed(aph) / 10) * 10} times faster than it crawls far out. It spends only about a year closer than 3 times Earth’s distance, and that is the only time it has a tail.</p>`,
			notes: `<p>The path is the one worked out by NASA’s Jet Propulsion Laboratory from 8,518 sightings of Halley between 1835 and 1994 (orbital elements courtesy NASA/JPL-Caltech). The page draws it flat; really it is tilted by 18 degrees to the planets’ paths, and Halley goes round the opposite way to the planets. The planets’ pulls change each trip a little, so the returns are 74 to 79 years apart, and it was really farthest out on 9 December 2023, about two months before this single path says.</p>`
		},
		// ------------------------------------------------------------------ ice
		{
			id: 'frozen',
			chapter: 'ice',
			title: 'Far out, a frozen lump',
			scene: 'nucleus',
			hints: { phase: 'frozen', reach: 0 },
			duration: 18,
			body: `
<p>Here is the comet itself, close up: the ${nucleus}, a lump of <strong>ice mixed with dust and rock</strong>, about 15 km long and 8 km wide, the size of a big city. Its crust is <strong>darker than coal</strong>.</p>
<p>Far out beyond Neptune, the sunlight is <strong>${round(1 / sunlight(aph.r) / 50) * 50} times weaker</strong> than here on Earth. A dark lump out there stays at about −${-round(darkTemperature(aph.r) / 5) * 5} °C. Nothing happens to it: no fuzz, no tail, just a dark lump far too small and dim to see without a giant telescope.</p>`
		},
		{
			id: 'warming',
			chapter: 'ice',
			title: 'Sunlight turns the ice to gas',
			scene: 'nucleus',
			hints: { phase: 'warming' },
			duration: 26,
			controls: [reach],
			body: `
<p><strong>Bring the comet in</strong> towards the Sun. The closer it gets, the stronger the sunlight, and once it is closer than about 3 times Earth’s distance, its ice starts turning <strong>straight into gas</strong>, without melting first, the way frost can vanish on a cold, sunny morning. Out in space there is no air to keep the water in liquid form.</p>
<p>The gas bursts out on the sunny side and carries dust with it, and they make a huge fuzzy cloud round the nucleus: the comet’s head, or ${coma}. At its closest the ice turns to gas about ${round(iceRate(HALLEY.q) / iceRate(3) / 100) * 100} times faster than at 3 times Earth’s distance.</p>
<p>The warmth goes into turning the ice into gas, so the ice itself stays well below freezing. So a comet is <strong>not a burning rock</strong>. Nothing burns: it is ice turning to gas in sunlight.</p>`,
			notes: `<p>How fast the ice turns to gas follows the curve astronomers use for water ice (Marsden, Sekanina and Yeomans, 1973). Halley’s ice is mostly water, with some carbon dioxide and carbon monoxide ice that can turn to gas farther out. When the spacecraft Giotto flew through Halley’s head on 14 March 1986, the comet was giving off about 16 tonnes of water vapour every second.</p>`
		},
		// ------------------------------------------------------------------ tails
		{
			id: 'away',
			chapter: 'tails',
			title: 'The tail points away from the Sun',
			scene: 'close',
			hints: { phase: 'away' },
			duration: 24,
			controls: [day('dayIn', -70)],
			body: `
<p>Now the comet is near the Sun, still outside Earth’s path. <strong>Drag the comet</strong> round its closest point, in past Earth’s path, and watch its tail.</p>
<p>The tail swings round as the comet goes, and it always points <strong>away from the Sun</strong>. The Sun pushes it out: sunlight presses on the dust, and the ${wind}, a thin stream the Sun blows out in every direction at about 400 km a second, sweeps the gas away.</p>`
		},
		{
			id: 'tail-first',
			chapter: 'tails',
			title: 'On the way out, it goes tail-first',
			scene: 'close',
			hints: { phase: 'tail-first' },
			duration: 22,
			controls: [day('dayOut', 60)],
			body: `
<p>The arrow shows which way the comet is going. Coming in, the tail streams out behind it. But <strong>on the way out, the comet flies tail-first</strong>: the tail still points away from the Sun, so now it is in front.</p>
<p>So a comet’s tail is not smoke or exhaust left behind like a train’s or a rocket’s. It points wherever the Sun pushes it, whichever way the comet is going.</p>`
		},
		{
			id: 'two-tails',
			chapter: 'tails',
			title: 'Two tails: gas and dust',
			scene: 'close',
			hints: { phase: 'two-tails' },
			duration: 24,
			controls: [day('day', 30)],
			body: `
<p>A comet has two tails. The <strong>gas tail</strong> is straight and blue: the solar wind grabs the gas and blows it straight out, and the gas glows blue in sunlight. It is bent back only a little, at most ${round(tailBend(peri))} degrees, because the wind is so much faster than the comet.</p>
<p>The <strong>dust tail</strong> is curved and pale yellow-white: it is sunlight bouncing off the dust. Sunlight pushes on the grains only gently, so each grain keeps going round the Sun almost the way the comet does, and falls behind it. The dust tail starts out pointing away from the Sun and <strong>bends back along the path</strong> the comet has come along.</p>`
		},
		{
			id: 'grains',
			chapter: 'tails',
			title: 'Zoom in: the grains leave',
			scene: 'close',
			hints: { phase: 'grains', day: GIOTTO },
			duration: 24,
			controls: [zoom],
			body: `
<p><strong>Zoom in</strong> on the comet’s head, on ${dateOf(GIOTTO)}. Each dot is a dust grain that has left the nucleus; they come out straight away from the Sun, then drift apart.</p>
<p>The smallest grains are pushed hardest by sunlight and stream out fastest. The big ones are pushed so gently that they stay near the comet’s path, falling slowly behind it. Grains of every size spreading out at different speeds make the wide, curved fan of the dust tail.</p>`,
			notes: `<p>Each grain leaves with the comet’s speed and then moves under the Sun’s pull, weakened by the push of sunlight: for the finest grains the page draws, the push cancels the pull and they go straight on; for the largest it takes off a tenth. Real grains also leave a few hundred metres a second faster than the nucleus, which spreads the tail out a little more. A grain’s age is ${when(-60).replace(' before', '')} at most on the page; older ones are too spread out to see.</p>`
		},
		{
			id: 'next',
			chapter: 'tails',
			title: 'Read next',
			scene: 'close',
			hints: { phase: 'next', day: GIOTTO },
			duration: 14,
			body: `
<p>A comet is a lump of ice and dust on a long, stretched path. Near the Sun its ice turns to gas, and the Sun pushes the gas and dust out into tails that point away from it, so the comet leaves tail-first. Each trip it loses a little ice; after enough trips it will be a dead, dark lump of dust and rock.</p>
<p>The page on <a href="../orbits-kepler/">orbits</a> shows why a path round the Sun is a stretched loop, and why a comet races near the Sun and crawls far out. The page on <a href="../states-of-matter/">states of matter</a> shows what the molecules do when ice turns to gas.</p>`
		}
	]
};

/** Days before the 1986 closest approach at each stop of the close-up. */
export const stopDays = STOPS.map((r) => (r <= HALLEY.q ? 0 : daysAtDistance(r, -1)));
