import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { EARTH_AGE, ZOOMS, ageText, zoomSpan } from './deeptime';

/**
 * The timeline scrubber of one step. Its value is the time since the Earth formed, in Myr, so
 * that the slider runs from old (left) to today (right); `zoom` names the step's zoom control,
 * or fixes the window when it is not a control id.
 */
function scrub(id: string, def: number, zoom: string, label = 'Move through time'): Control {
	const span = (p: Params) => zoomSpan(String(p[zoom] ?? zoom));
	return {
		type: 'range',
		id,
		label,
		min: 0,
		max: EARTH_AGE,
		step: 1e-6,
		default: EARTH_AGE - def,
		bounds: (p) => [EARTH_AGE - span(p), EARTH_AGE],
		// 1,000 steps across the window, for the keyboard
		values: (p) => {
			const s = span(p);
			return Array.from({ length: 1001 }, (_, i) => EARTH_AGE - s + (s * i) / 1000);
		},
		format: (v) => {
			const age = Math.max(0, EARTH_AGE - v);
			return age < 1e-7 ? 'today' : ageText(age);
		},
		help: 'Or drag the line on the timeline.'
	};
}

const zoom = (id: string, def: string, only?: string[]): Control => ({
	type: 'select',
	id,
	label: 'Zoom the timeline to',
	default: def,
	options: ZOOMS.filter((z) => !only || only.includes(z.id)).map((z) => ({
		value: z.id,
		label: z.label
	}))
});

const play: Control = {
	type: 'toggle',
	id: 'driftPlay',
	label: 'Play a billion years of drift',
	default: false,
	help: 'Runs the globe from 1,000 million years ago to today, over about 50 seconds. The slider takes over again when you switch it off.'
};

const calendarEvent: Control = {
	type: 'select',
	id: 'calEvent',
	label: 'Look up',
	default: 'animals',
	options: [
		{ value: 'zircon', label: 'Oldest mineral' },
		{ value: 'life', label: 'First life' },
		{ value: 'oxygen', label: 'Oxygen' },
		{ value: 'eukaryotes', label: 'Complex cells' },
		{ value: 'animals', label: 'Animals' },
		{ value: 'kpg', label: 'End of the dinosaurs' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'deep-time',
	title: 'Deep time',
	summary:
		'Scrub through 4.57 billion years while a globe shows the continents drifting and tracks show the temperature, the oxygen in the air and the major groups of life; zoom from eons down to the last few thousand years, then squeeze it all into one calendar year.',
	chapters: [
		{ id: 'scale', title: 'Four and a half billion years' },
		{ id: 'planet', title: 'A changing planet' },
		{ id: 'life', title: 'Life' },
		{ id: 'zoom', title: 'Zooming in' },
		{ id: 'year', title: 'One year' }
	],
	steps: [
		// ------------------------------------------------------------------ scale
		{
			id: 'whole',
			chapter: 'scale',
			title: 'The whole of Earth’s history',
			scene: 'time',
			hints: { phase: 'whole', time: 'tWhole', zoom: 'all' },
			duration: 24,
			controls: [scrub('tWhole', 3000, 'all')],
			body: `
<p>The bar on the right is the whole history of the Earth, from its birth <strong>4,567 million years ago</strong> on the left to today on the right. Drag the line along it (or use the slider) and watch the planet change.</p>
<p>Geologists split this history into four <dfn data-def="The longest divisions of geological time, hundreds of millions to billions of years long.">eons</dfn>: the <strong>Hadean</strong>, when the young Earth was battered by asteroids; the <strong>Archean</strong>, when life began; the <strong>Proterozoic</strong>, when oxygen first appeared in the air; and the <strong>Phanerozoic</strong>, the eon of visible animals and plants, which began 539 million years ago. Everything before it is often lumped together as the <dfn data-def="All of Earth's history before the Phanerozoic eon, from 4,567 to 539 million years ago: 88% of the total.">Precambrian</dfn>.</p>
<p>Look at the widths. The Precambrian takes up <strong>88%</strong> of the bar. All the dinosaurs, all the forests, all the fish fit into the last eighth — and we will see that humans fit into a sliver too thin to draw.</p>`,
			notes: `<p>The boundaries are those of the International Chronostratigraphic Chart of the International Commission on Stratigraphy (version 2024/12). The start, 4,567 million years ago, is the age of the oldest solid grains in meteorites, the first material of the Solar System (Connelly et al. 2012); the Earth itself was built up from such material over the next few tens of millions of years.</p>`
		},
		{
			id: 'dating',
			chapter: 'scale',
			title: 'Clocks in the rocks',
			scene: 'time',
			hints: { phase: 'dating', time: 'tDating', zoom: 'all' },
			duration: 24,
			controls: [scrub('tDating', 4404, 'all', 'When the crystal formed')],
			body: `
<p>How can anyone know that a rock is 4.4 billion years old? With the clock you met in <a href="../radioactivity/">radioactivity</a>. A tiny crystal of <dfn data-def="Zirconium silicate, ZrSiO₄: a tough mineral that takes in uranium when it crystallises but almost no lead, and survives erosion and heat for billions of years.">zircon</dfn> takes in uranium atoms when it forms, but almost no lead. From then on, uranium-238 decays — through a quick chain of other nuclei — into lead-206, with a <strong>half-life of 4,468 million years</strong>.</p>
<p>So the crystal keeps count. Move the line to when the crystal formed and watch its atoms: the older it is, the more of its uranium has become lead. Measure the ratio of lead to uranium and you can read the age back. The oldest known grain, a zircon from the Jack Hills of Australia, has almost one lead atom for every uranium atom: <strong>4,404 million years</strong>.</p>`,
			notes: `<p>Uranium-238 is a good clock for old rocks because its half-life is about as long as the Earth's history: even the oldest crystals still hold half their uranium, and even young ones (a few million years) have made enough lead to measure. Geologists check each date with a second clock in the same crystal, uranium-235 decaying into lead-207 (half-life 704 million years): if the two agree, no lead has leaked out. The grain shows 100 atoms; a real zircon holds billions of billions. Half-life from the NNDC; the zircon from Wilde et al. (2001).</p>`
		},
		// ------------------------------------------------------------------ planet
		{
			id: 'drift',
			chapter: 'planet',
			title: 'Continents on the move',
			scene: 'time',
			hints: { phase: 'drift', time: 'tDrift', zoom: 'billion' },
			duration: 30,
			controls: [scrub('tDrift', 250, 'billion'), play],
			body: `
<p>In <a href="../plate-tectonics/">plate tectonics</a> you saw that the plates move a few centimetres a year. Over hundreds of millions of years that rebuilds the map. The globe shows a reconstruction of the continents over the last billion years: drag the line back and watch them travel.</p>
<p>About 250 million years ago almost all the land was joined in one supercontinent, <strong>Pangaea</strong>, with Paris in the tropics. It then broke apart: the Atlantic opened, India raced north, and Australia left Antarctica. Go back further and the pieces assemble and break up again: before about 750 million years ago most of them were gathered in an older supercontinent, <strong>Rodinia</strong>.</p>
<p>The long curved line is the equator of the time: the latitudes come from the magnetism frozen into old rocks, which records how far from the poles they formed.</p>`,
			notes: `<p>The reconstruction is the plate model of Merdith et al. (2021, CC BY 4.0), computed here from its rotation file the way the GPlates software does (and checked against its web service). The shapes are today's coastlines carried back in time; the real shorelines of the past were different, because sea level rose and fell and the edges of continents have been stretched, squeezed and added to. The globe turns to keep most of the land in view.</p>`
		},
		{
			id: 'before',
			chapter: 'planet',
			title: 'Where the map runs out',
			scene: 'time',
			hints: { phase: 'before', time: 'tBefore', zoom: 'all' },
			duration: 26,
			controls: [scrub('tBefore', 1500, 'all')],
			body: `
<p>The further back, the less we know. For the last 180 million years or so the map is solid: almost all of that ocean floor still exists, and its magnetic stripes, which you saw form at the mid-ocean ridges, record how the plates moved apart. Almost all older ocean floor has gone back into the mantle at subduction zones.</p>
<p>Before that, geologists work from the continents alone: the magnetism of their rocks gives their latitudes, matching rocks and mountain belts tell which ones touched. But a rock's magnetism says nothing about its <strong>longitude</strong>, so east–west positions are educated guesses. The coloured strip under the eras shows how good the map is: green where the ocean floor records it, orange where only latitudes are known, grey where there is no map.</p>
<p>The plate model used here stops a billion years ago; older reconstructions exist, but they disagree so much that we do not draw them. Move the line there: the globe goes blank. There was probably an even older supercontinent, Nuna (or Columbia), well over a billion years ago, but its shape is debated, and geologists still argue about when plate tectonics itself began.</p>`,
			notes: `<p>Almost all ocean floor today is younger than about 180–200 million years; the oldest that is well dated, in the western Pacific, is about 180 million years old. Small older remnants may survive: magnetic stripes suggest the floor of the eastern Mediterranean’s Herodotus Basin could be about 340 million years old (Granot, <i>Nature Geoscience</i>, 2016), though its age and even whether it is ocean crust are debated. In the model of Merdith et al. (2021) the absolute longitudes of the continents are not constrained at all: the whole map could be turned east or west. Their positions relative to each other are better known, from shared geology and from the shapes of the magnetic paths ("polar wander paths") their rocks record.</p>`
		},
		{
			id: 'temperature',
			chapter: 'planet',
			title: 'Hothouse and icehouse',
			scene: 'time',
			hints: { phase: 'temperature', time: 'tTemp', zoom: 'tempZoom' },
			duration: 28,
			controls: [
				zoom('tempZoom', 'phanerozoic', ['all', 'phanerozoic', 'cenozoic', 'quaternary']),
				scrub('tTemp', 92, 'tempZoom')
			],
			body: `
<p>The red track is the average temperature at the Earth's surface over the last 487 million years, reconstructed from the chemistry of fossil shells and teeth together with climate models. Today's (before our own warming) is about <strong>14 °C</strong>. For most of the time the Earth was far hotter: a <dfn data-def="A climate with no ice sheets at the poles, warm even at high latitudes.">hothouse</dfn> with no ice at the poles, peaking at about <strong>36 °C</strong> some 92 million years ago, when dinosaurs roamed forests near the South Pole.</p>
<p>The cold spells — <dfn data-def="A climate with ice sheets at one or both poles, like today's.">icehouses</dfn> — are the exception: a short one about 445 million years ago, a long one from about 340 to 290 million years ago, and the one we live in, which started about 34 million years ago when Antarctica froze. The coldest <dfn data-def="The smallest named division of geological time, usually a few million years long (the most recent ones are much shorter).">stage</dfn> of all is the one just before ours, from 129,000 to 12,000 years ago: its ice-age swings average about 11 °C.</p>
<p>Before the record starts there is no temperature curve, only the marks of ice: rocks left by glaciers near the equator show that the whole planet froze over at least twice between 717 and 635 million years ago (the "Snowball Earth"), and that there were great ice ages earlier too, while oxygen was building up. The Sun, meanwhile, has been brightening: it started about 70% as bright as today.</p>`,
			notes: `<p>The curve is PhanDA (Judd et al. 2024): one value for each geological stage, with the shaded bands showing the range that contains the true value with 68% and 90% probability. Most stages last a few million years, so the swings of the ice ages within the last 2.6 million years show up only as a few stage averages. The biggest driver of these changes is the amount of carbon dioxide in the air, set by the slow <a href="../carbon-cycle/">carbon cycle</a> — volcanoes adding it, weathering rocks removing it — and its <a href="../greenhouse-effect/">greenhouse effect</a>. The Sun's brightening follows Gough's (1981) formula for a star like the Sun.</p>`
		},
		{
			id: 'oxygen',
			chapter: 'planet',
			title: 'Air you could breathe',
			scene: 'time',
			hints: { phase: 'oxygen', time: 'tO2', zoom: 'all' },
			duration: 28,
			controls: [scrub('tO2', 2430, 'all')],
			body: `
<p>For the first half of its history the Earth's air had almost <strong>no oxygen</strong>: less than a hundred-thousandth of today's. Then microbes that make oxygen by <a href="../photosynthesis/">photosynthesis</a> began to win against everything that used it up, and about <strong>2,430 million years ago</strong> it started to build up: the <dfn data-def="The first lasting rise of oxygen in the atmosphere, between about 2,430 and 2,220 million years ago.">Great Oxidation Event</dfn>. It took some 200 million years of ups and downs to stay for good.</p>
<p>Even then, for over a billion years oxygen stayed low. Exactly how low is disputed: estimates for 1,800 to 800 million years ago run from under 0.1% to over 4% of today's level, which is why the track shows a wide box rather than a line, with the two estimates marked inside it. Only in the last 540 million years can it be followed in detail: it rose in steps to about today's 21% of the air, and even higher, perhaps 30% or more, around 300 to 260 million years ago, when giant dragonflies flew.</p>
<p>The scale is stretched: each line up the track, faint or dashed, is ten times more oxygen than the one below.</p>`,
			notes: `<p>The early bounds come from sulfur in old sediments: its isotopes were sorted by sunlight in a way that only works in air with less than 10⁻⁵ of today's oxygen (Pavlov &amp; Kasting 2002), and the signal stops for good about 2,220 million years ago (Poulton et al. 2021). The mid-Proterozoic estimates are from chromium isotopes (Planavsky et al. 2014) and from trace metals in 1,400-million-year-old rocks (Zhang et al. 2016); the box is drawn around both, and each is marked inside it. The curve of the last 540 million years is the consensus of Mills et al. (2023), with its band of uncertainty. The early bounds are drawn as boxes on purpose: they are limits, not measurements.</p>`
		},
		// ------------------------------------------------------------------ life
		{
			id: 'life',
			chapter: 'life',
			title: 'Life’s long wait',
			scene: 'time',
			hints: { phase: 'life', time: 'tLife', zoom: 'lifeZoom' },
			duration: 30,
			controls: [
				zoom('lifeZoom', 'all', ['all', 'phanerozoic', 'cenozoic']),
				scrub('tLife', 3480, 'lifeZoom')
			],
			body: `
<p>Each bar is a major group of living things, starting at its oldest widely accepted fossils. Life itself is old: mats of microbes grew in hot springs in Australia <strong>3,480 million years ago</strong>, only a billion years after the Earth formed.</p>
<p>And then, for almost three billion years, life stayed small. Single cells ruled. Complex cells, like the ones in your body, appear by 1,635 million years ago; the first large animals only 571 million years ago. Then things move fast: fish, plants on land, animals with four legs, forests, dinosaurs, mammals, flowers — all crowded into the last eighth of the bar.</p>
<p>Look at the bottom row. Our own species, <i>Homo sapiens</i>, has existed for about 315,000 years. On this bar that is <strong>0.007%</strong>: a line much thinner than a pixel. Zoom in to see the crowd at the end.</p>`,
			notes: `<p>Dates are the oldest fossils most specialists accept, each with its source: microbes from the Dresser Formation (Djokic et al. 2017; older claims, back to 3,700 million years in Greenland, are disputed), many-celled complex cells from China (Miao et al. 2024), Ediacaran animals from Newfoundland (Pu et al. 2016), fish from Chengjiang (Shu et al. 1999), land-plant spores (Rubinstein et al. 2010), footprints of four-legged animals (Niedźwiedzki et al. 2010), early dinosaurs (Martinez et al. 2011), early mammal relatives (Sulej et al. 2020), flowering-plant pollen (Coiro et al. 2019), the oldest member of the human family (Lebatard et al. 2008) and of our own species (Richter et al. 2017). Each group surely started earlier than its oldest fossil.</p>`
		},
		{
			id: 'extinctions',
			chapter: 'life',
			title: 'Five mass extinctions',
			scene: 'time',
			hints: { phase: 'extinctions', time: 'tExt', zoom: 'phanerozoic' },
			duration: 28,
			controls: [scrub('tExt', 251.9, 'phanerozoic')],
			body: `
<p>Zoomed in on the last 540 million years, the story of life has five big breaks: <dfn data-def="A time when a large share of all species die out within a geologically short time.">mass extinctions</dfn>, when a large share of all species vanished within a geologically short time.</p>
<p>The worst was the <strong>Great Dying</strong>, 252 million years ago, at the end of the Permian: huge volcanic eruptions in Siberia poured out carbon dioxide, the temperature track jumps by about 10 °C, and about four in five of the groups (genera) of sea animals died out. The most famous is the last, <strong>66 million years ago</strong>, when an asteroid hit Mexico and ended the dinosaurs — except their descendants, the birds — and made room for mammals.</p>
<p>Notice how four of the five sit on the boundaries between periods: geologists drew their lines where the fossils change. The fifth, in the Late Devonian, marks a boundary between two stages inside the Devonian.</p>`,
			notes: `<p>The "big five" were picked out by Raup and Sepkoski (1982) from counts of fossil marine families; the dates are the boundaries of the ICS chart. The end-Permian extinction happened within about 60,000 years, 251.9 million years ago (Burgess et al. 2014), and removed about 79% of the genera of marine invertebrates (Payne &amp; Clapham 2012). The end-Cretaceous impact, at Chicxulub, is dated to 66.0 million years ago (Renne et al. 2013).</p>`
		},
		// ------------------------------------------------------------------ zoom
		{
			id: 'zoom',
			chapter: 'zoom',
			title: 'From eons to millennia',
			scene: 'time',
			hints: { phase: 'zoom', time: 'tZoom', zoom: 'zoom' },
			duration: 30,
			controls: [zoom('zoom', 'quaternary'), scrub('tZoom', 0.315, 'zoom')],
			body: `
<p>Now zoom in step by step, from the whole history down to the time since farming began. Each window is a smaller and smaller sliver of the one before; the card under the globe says how much of the Earth's history it covers.</p>
<p>The ice ages, the last 2.6 million years, are 0.06% of the total. Our species is 0.007%. Farming, towns and writing, the last 12,000 years, are 0.0003%. At this zoom the continents no longer move at all on the globe, and the temperature and oxygen records turn into flat steps: they are averages over whole geological stages, from thousands to millions of years long, too coarse to show the ups and downs of the ice ages or of human history.</p>`,
			notes: `<p>Each zoom divides the window by between 2 and 33. To see the last 12,000 years as wide as the whole 4,567 million you would need a bar about 380,000 times longer: if the last 12,000 years filled a 56 cm screen, the whole history at that scale would stretch for over 200 km.</p>`
		},
		// ------------------------------------------------------------------ year
		{
			id: 'year',
			chapter: 'year',
			title: 'Earth’s history as one year',
			scene: 'calendar',
			hints: { phase: 'year' },
			duration: 30,
			controls: [calendarEvent],
			body: `
<p>Numbers like "4,567 million" are hard to feel. So squeeze the whole history into one calendar year: the Earth forms at midnight on <strong>1 January</strong>, and today is the stroke of midnight at the end of <strong>31 December</strong>. Each day is then 12.5 million years; each second, 145 years.</p>
<p>The oldest mineral grain dates from 14 January. Life is there by 28 March. Oxygen starts to fill the air around 20 June. Complex cells appear in late August. And the first large animals have to wait until <strong>16 November</strong>; the Cambrian starts on 18 November.</p>
<p>The dinosaurs arrive on 13 December and die out on <strong>26 December</strong>, in the late afternoon. Pick an event to read its date.</p>`
		},
		{
			id: 'midnight',
			chapter: 'year',
			title: 'The last day of the year',
			scene: 'calendar',
			hints: { phase: 'midnight' },
			duration: 30,
			body: `
<p>Zoom into 31 December. The oldest known member of the human family, living soon after our ancestors split from the chimpanzees', appears around half past ten in the morning. Our species, <i>Homo sapiens</i>, appears at <strong>23:23</strong> — 36 minutes before midnight.</p>
<p>Everything we call history happens in the last minute and a half. Farming begins at 23:58:40. Writing at 23:59:24. The Industrial Revolution, with its steam engines and burning of coal, 1.8 seconds before midnight. A whole human life, 80 years, lasts about half a second.</p>
<p>That is the deepest lesson of deep time: the planet is so old that large, many-celled life arrives only in its last weeks, and humans in its last minutes. Yet in those 1.8 seconds we have raised the carbon dioxide in the air by half, a change that took thousands of years at the end of each ice age — the subject of <a href="../greenhouse-effect/">the greenhouse effect</a>.</p>`,
			notes: `<p>The times come straight from the ages: a moment <i>t</i> million years ago falls <i>t</i> × 10⁶ / 144.8 seconds before midnight. The date of farming is for the first domesticated plants of the Near East, about 11,500 years ago (Zeder 2011); writing appears in Mesopotamia about 5,200 years ago (Woods 2010), and the Industrial Revolution is dated from the 1760s in Britain (Ashton 1948).</p>`
		},
		{
			id: 'sliver',
			chapter: 'year',
			title: 'The last sliver',
			scene: 'time',
			hints: { phase: 'sliver', time: 'tSliver', zoom: 'all' },
			duration: 26,
			controls: [scrub('tSliver', 0, 'all')],
			body: `
<p>Back to the full timeline, with everything on it: the continents gathering and splitting, the planet freezing and baking, the air filling with oxygen, and life staying small for most of the story.</p>
<p>Earth's history is so long that large, many-celled life, and humans most of all, occupy only its last sliver. If the whole 4,567 million years were the length of a football pitch, our species would take up the last 7 millimetres, and everything since farming began would be about three sheets of paper thick, at the very end.</p>`,
			notes: `<p>A football pitch of 105 m: 12,000 / 4,567,000,000 × 105 m ≈ 0.28 mm, about three sheets of office paper; 315,000 years of <i>Homo sapiens</i> take 7.2 mm.</p>`
		}
	]
};
