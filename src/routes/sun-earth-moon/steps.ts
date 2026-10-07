import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
/** Day of the year (0 = 1 January) as "21 Jun". */
export const dateText = (day: number) => {
	const d = ((Math.round(day) % 365) + 365) % 365;
	let m = 11;
	while (MONTH_START[m] > d) m--;
	return `${d - MONTH_START[m] + 1} ${MONTHS[m]}`;
};

const day: Control = {
	type: 'range',
	id: 'day',
	label: 'Date',
	min: 0,
	max: 364,
	step: 1,
	default: 171,
	format: dateText,
	help: 'Or drag the Earth along its orbit.'
};

/** The same date control, on steps where the Earth is not draggable. */
const date: Control = { ...day, help: undefined };

const latitude: Control = {
	type: 'range',
	id: 'latitude',
	label: 'Latitude',
	min: -90,
	max: 90,
	step: 1,
	default: 40,
	format: (v) => (v === 0 ? 'equator' : `${Math.abs(v)}° ${v > 0 ? 'N' : 'S'}`),
	help: 'Madrid, Beijing and New York are near 40° N; Sydney is near 34° S.'
};

const tilt: Control = {
	type: 'range',
	id: 'tilt',
	label: "Tilt of Earth's axis",
	min: 0,
	max: 45,
	step: 0.1,
	default: 23.4,
	unit: '°',
	help: 'The real tilt is 23.4°.'
};

const moon: Control = {
	type: 'range',
	id: 'moon',
	label: 'Days since new Moon',
	min: 0,
	max: 29.5,
	step: 0.25,
	default: 4,
	format: (v) => `${v.toFixed(1)} days`,
	help: 'Moving the slider or the Moon stops time.'
};

const spin: Control = {
	type: 'toggle',
	id: 'run',
	label: 'Let time run',
	default: true,
	help: 'Off: move things yourself.'
};

/** The same toggle where nothing can be moved by hand: off just freezes time. */
const pause: Control = { ...spin, help: undefined };

export const spec: ExplainerSpec = {
	slug: 'sun-earth-moon',
	title: 'Seasons, Moon phases, eclipses and tides',
	summary:
		'Tilt the Earth, move it round the Sun and swing the Moon around it: four everyday sky puzzles turn out to be the geometry of three bodies.',
	chapters: [
		{ id: 'seasons', title: 'Seasons' },
		{ id: 'moon', title: 'The Moon' },
		{ id: 'tides', title: 'Tides' }
	],
	steps: [
		// ------------------------------------------------------------------ seasons
		{
			id: 'orbit',
			chapter: 'seasons',
			title: 'A tilted Earth goes round the Sun',
			scene: 'seasons',
			hints: { phase: 'orbit' },
			duration: 20,
			controls: [day],
			body: `
<p>The Earth goes round the Sun once a year. Its spin axis is not upright: it is tilted by about 23.4° from upright (from the perpendicular to the plane of its orbit) — and, crucially, it keeps pointing the <em>same way in space</em> all year (towards the North Star).</p>
<p>So in June the northern half of the Earth leans towards the Sun, and in December it leans away. The moments of greatest lean, around 21 June and 21 December, are the <dfn data-def="The two moments a year, around 21 June and 21 December, when one hemisphere leans most towards the Sun: the longest day in one hemisphere and the shortest in the other.">solstices</dfn>. Halfway between, in March and September, neither half leans towards it: those are the <dfn data-def="The two moments a year, around 20 March and 22 September, when the Sun is overhead at the equator and day and night are equal everywhere.">equinoxes</dfn>.</p>
<p>Drag the Earth round its orbit and watch the lit half of the globe: in June the North Pole is in sunlight all day, in December in darkness.</p>`
		},
		{
			id: 'daylength',
			chapter: 'seasons',
			title: 'Longer days',
			scene: 'sunlight',
			hints: { phase: 'day' },
			duration: 20,
			controls: [date, latitude],
			body: `
<p>Leaning towards the Sun has two effects. The first is the length of the day: on the tilted globe, a place in the leaning-in half spends more of each turn on the sunlit side.</p>
<p>At 40° N, the day lasts about 15 hours in late June and 9 in late December. At the equator it is always about 12 hours. Beyond the <dfn data-def="The circle of latitude 66.6° N (66.6° S for the Antarctic circle): the furthest place from the pole where the Sun can stay up all day or down all day.">Arctic circle</dfn> the Sun does not set at all around the June solstice, and does not rise around the December one.</p>
<p>Pick a latitude and slide through the year. In the southern hemisphere everything is reversed: December brings the long days.</p>`,
			notes: `<p>The day lengths here are geometric: from the moment the centre of the Sun rises to the moment it sets. Real sunrise comes a few minutes earlier and sunset a few minutes later, because the atmosphere bends sunlight and the Sun is a disc, not a point.</p>`
		},
		{
			id: 'angle',
			chapter: 'seasons',
			title: 'Higher Sun, stronger sunlight',
			scene: 'sunlight',
			hints: { phase: 'angle' },
			duration: 20,
			controls: [date, latitude],
			body: `
<p>The second effect matters even more: the <strong>height of the Sun</strong>. In summer the noon Sun climbs high; in winter it stays low.</p>
<p>A beam of sunlight falling steeply lands on a small patch of ground. The same beam arriving at a low angle is spread over a much larger patch, so each square metre gets less energy — like a torch shone straight down versus at a slant. Low winter sunlight also passes through more air.</p>
<p>Longer days <em>and</em> steeper sunlight together mean that at 40° N a midsummer day brings over three times as much solar energy as a midwinter day, and the summer half of the Earth as a whole gets more than twice as much as the winter half. That is what seasons are.</p>`,
			notes: `<p>The chart shows sunshine arriving at the top of the atmosphere. Low winter sunlight also crosses more air, which absorbs and scatters some of it, so at the ground the gap between summer and winter is larger still.</p>`
		},
		{
			id: 'distance',
			chapter: 'seasons',
			title: 'It is not about distance',
			scene: 'seasons',
			hints: { phase: 'distance' },
			duration: 18,
			controls: [day],
			body: `
<p>A common idea is that summer comes when the Earth is closer to the Sun. It is not so.</p>
<p>Earth's orbit is very nearly a circle. The Earth <em>is</em> closest to the Sun in early January — during the northern winter — and furthest in early July. The difference is only about 3% in distance, about 7% in sunlight: far too small to make the seasons.</p>
<p>And if distance were the cause, both hemispheres would have summer at the same time. Instead, Australia has summer while Europe has winter — exactly what a tilted axis predicts.</p>`,
			notes: `<p>The orbit's shape is drawn to scale here and, at this scale, it looks like a circle: the Sun sits only 1.7% of the orbit's radius away from its centre.</p>`
		},
		{
			id: 'tilt',
			chapter: 'seasons',
			title: 'What if the tilt were different?',
			scene: 'sunlight',
			hints: { phase: 'tilt' },
			duration: 20,
			controls: [tilt, latitude],
			body: `
<p>The chart shows the daily sunshine at your chosen latitude over a whole year. Now change the tilt.</p>
<p>With no tilt at all there would be no seasons: every day of the year would be like an equinox, with 12 hours of daylight everywhere. A bigger tilt makes the seasons more extreme: hotter summers, colder winters and bigger polar regions with midnight Sun and polar night.</p>
<p>Uranus is tilted by about 98°: for decades at a time one of its poles faces the Sun.</p>`
		},
		// ------------------------------------------------------------------ moon
		{
			id: 'phases',
			chapter: 'moon',
			title: 'Why the Moon has phases',
			scene: 'moon',
			hints: { phase: 'phases' },
			duration: 24,
			controls: [moon, spin],
			body: `
<p>The Moon makes no light of its own; it shines by reflecting sunlight. At every moment, the half facing the Sun is lit and the other half is dark — like the Earth's day and night.</p>
<p>As the Moon goes round the Earth, about once a month, we see that lit half from different angles. Between us and the Sun (<strong>new Moon</strong>) we face its dark half. Opposite the Sun (<strong>full Moon</strong>) we see the lit half face-on. In between we see part of each: crescents, quarters and gibbous Moons (more than half lit).</p>
<p>The phases are <em>not</em> the Earth's shadow falling on the Moon: the shadow points away from the Sun, and the Moon is hardly ever in it.</p>`,
			notes: `<p>From one new Moon to the next takes 29.5 days (the synodic month). The Moon goes once round the Earth relative to the stars in 27.3 days, but the Earth has moved along its orbit meanwhile, so the Moon needs two more days to line up with the Sun again.</p>`
		},
		{
			id: 'eclipses',
			chapter: 'moon',
			title: 'Eclipses',
			scene: 'moon',
			hints: { phase: 'eclipses' },
			duration: 24,
			controls: [moon, spin],
			body: `
<p>Sometimes the Sun, Earth and Moon line up almost exactly.</p>
<ul>
<li>A <strong>solar eclipse</strong>: at new Moon, the Moon passes in front of the Sun and its shadow falls on part of the Earth.</li>
<li>A <strong>lunar eclipse</strong>: at full Moon, the Moon passes through the Earth's shadow and turns dark, often coppery red.</li>
</ul>
<p>So solar eclipses can only happen at new Moon and lunar eclipses at full Moon. But there is a new and a full Moon every month — so why are eclipses rare?</p>`
		},
		{
			id: 'tilted',
			chapter: 'moon',
			title: 'A tilted orbit: eclipse seasons',
			scene: 'moon',
			hints: { phase: 'tilted' },
			duration: 26,
			controls: [date, moon],
			body: `
<p>The Moon's orbit is tilted by about 5° to the Earth's. Seen side-on, most months the new Moon passes a little above or below the Sun, and the full Moon a little above or below the Earth's shadow: no eclipse.</p>
<p>The two orbits cross at two points called <dfn data-def="The two points where the Moon's tilted orbit crosses the plane of Earth's orbit.">nodes</dfn>. An eclipse needs a new or full Moon to fall close to a node — within about 17° of it for a solar eclipse and about 11° for a lunar one, so that the Moon is less than about 1.5° (solar) or 1° (lunar) above or below the plane of Earth's orbit.</p>
<p>The line of nodes points at the Sun twice a year. Around those two <strong>eclipse seasons</strong>, about six months apart, eclipses happen; the rest of the year they cannot. Move the date and the Moon's age to find them.</p>`,
			notes: `<p>The limits used here come from the sizes of the Sun and Moon in the sky (about half a degree each), the size of the Earth's shadow at the Moon's distance, and the Moon's parallax — it appears in slightly different places from different parts of the Earth. In reality the nodes also drift round once every 18.6 years, so the eclipse seasons come about 19 days earlier each year; this page keeps them fixed.</p>`
		},
		// ------------------------------------------------------------------ tides
		{
			id: 'tides',
			chapter: 'tides',
			title: 'The Moon pulls the oceans',
			scene: 'tides',
			hints: { phase: 'moon' },
			duration: 24,
			controls: [pause],
			body: `
<p>The Moon's gravity pulls on the whole Earth, but not equally: it pulls the near side a little more than the centre, and the centre a little more than the far side. That <em>difference</em> in pull stretches the oceans into two bulges — one facing the Moon, one on the opposite side.</p>
<p>As the Earth turns, a coast passes through both bulges and both dips each day: <strong>two high tides and two low tides</strong>, about 12 hours 25 minutes apart rather than 12 hours, because the Moon moves on a little along its orbit each day.</p>`,
			notes: `<p>This is the “equilibrium tide”, the shape the oceans would take if they could follow the pull instantly. Real tides are shaped by coastlines and ocean basins: some places get one tide a day, and the Bay of Fundy gets a range of up to about 16 m.</p>`
		},
		{
			id: 'spring',
			chapter: 'tides',
			title: 'Spring tides and neap tides',
			scene: 'tides',
			hints: { phase: 'sun' },
			duration: 26,
			controls: [moon, spin],
			body: `
<p>The Sun raises tides too — about half as strong as the Moon's, because although it is far heavier it is also far further away, and tidal stretching weakens quickly with distance.</p>
<p>At new and full Moon, Sun and Moon line up and their bulges add together: extra-high and extra-low <strong>spring tides</strong> (nothing to do with the season). At the quarter Moons they pull at right angles and partly cancel: gentle <strong>neap tides</strong>. Twice a month, the same geometry that gives the Moon its phases sets the size of the tides.</p>`
		}
	]
};
