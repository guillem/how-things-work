import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const days: Control = {
	type: 'range',
	id: 'days',
	label: 'Days since New Year',
	min: 0,
	max: 366,
	step: 1,
	default: 365,
	format: (v) => `${v} days`
};

const years4: Control = {
	type: 'range',
	id: 'years4',
	label: 'New Years gone by',
	min: 0,
	max: 8,
	step: 1,
	default: 4,
	format: (v) => (v === 1 ? '1 year' : `${v} years`)
};

const centuries: Control = {
	type: 'range',
	id: 'centuries',
	label: 'Years after 2001, with no leap days',
	min: 0,
	max: 800,
	step: 10,
	default: 100,
	format: (v) => `${v} years`
};

const julian: Control = {
	type: 'toggle',
	id: 'julian',
	label: 'One extra day every four years',
	default: false
};

const millennia: Control = {
	type: 'range',
	id: 'millennia',
	label: 'Years after 2001, with a leap day every four years',
	min: 0,
	max: 2000,
	step: 10,
	default: 1000,
	format: (v) => `${v.toLocaleString('en-US')} years`
};

const gregorian: Control = {
	type: 'toggle',
	id: 'gregorian',
	label: 'Skip the leap day in hundreds years, except every 400th',
	default: false
};

const year: Control = {
	type: 'range',
	id: 'year',
	label: 'Year',
	min: 1890,
	max: 2110,
	step: 1,
	default: 2024,
	format: (v) => String(v)
};

export const spec: ExplainerSpec = {
	slug: 'leap-years',
	title: 'Leap years: why February gets an extra day',
	summary:
		'Earth takes 365 days and almost six hours to go once round the Sun. Watch what those six hours do to a calendar with no leap days, how one extra day every four years almost fixes it, and why 1900 had no 29 February but 2000 did.',
	chapters: [
		{ id: 'lap', title: 'A lap of the Sun' },
		{ id: 'fix', title: 'Fixing the calendar' }
	],
	steps: [
		// ------------------------------------------------------------------ lap
		{
			id: 'lap',
			chapter: 'lap',
			title: 'A year is one round of the seasons',
			scene: 'calendar',
			hints: { phase: 'lap' },
			duration: 18,
			controls: [days],
			body: `
<p>Why does February sometimes have 29 days? Because of how long it takes Earth to go once round the Sun.</p>
<p>As Earth goes round the Sun, the seasons come and go: summer, autumn, winter, spring, and summer again. The calendar’s year is meant to be one round of the seasons, and that takes 365 days and almost six hours. The circle here stands for that round.</p><p>Slide the days forward from New Year. After 365 days the calendar says the year is over, but Earth isn’t quite back at the same point of its seasons. It still has almost six hours to go: more than half a million kilometres, about fifty times Earth’s own width.</p>`
		},
		{
			id: 'short',
			chapter: 'lap',
			title: 'A quarter of a day short',
			scene: 'calendar',
			hints: { phase: 'short' },
			duration: 18,
			controls: [years4],
			body: `
<p>Six hours is about a quarter of a day. So each New Year comes a quarter of a day before the seasons have come round to where they started.</p>
<p>That doesn’t sound like much. But it adds up: count four New Years and the calendar is a whole day ahead of the Sun. Count eight and it is two days ahead.</p>`
		},
		{
			id: 'slide',
			chapter: 'lap',
			title: 'Summer slides away',
			scene: 'calendar',
			hints: { phase: 'slide' },
			duration: 22,
			controls: [centuries],
			body: `
<p>The ring inside the orbit is the calendar, its months coloured by the season they are meant to be. The star marks the <dfn data-def="The day with the most hours of daylight in the northern half of the world, and the start of summer by astronomers’ reckoning; south of the equator it is the shortest day.">longest day</dfn> of the year in the northern half of the world: astronomers call it the first day of summer. Today it falls on June 20 or 21.</p>
<p>The dates on this page are worked out from the average length of the seasons’ year, counting from 2001, so they are close but not exact: real longest days wander a little from that average.</p>
<p>Suppose we never had leap days. Each year the longest day would come a quarter of a day later on the calendar. Move the years forward: after a hundred years it is in the middle of July; after seven or eight hundred years the longest day lands in December, in the middle of the calendar’s winter.</p>
<p>The Sun and the seasons didn’t move. The calendar slid round underneath them.</p>`
		},
		// ------------------------------------------------------------------ fix
		{
			id: 'leap',
			chapter: 'fix',
			title: 'One extra day every four years',
			scene: 'calendar',
			hints: { phase: 'leap' },
			duration: 20,
			controls: [julian],
			body: `
<p>The fix is to give the calendar back the day it lost. Every four years, the quarter days have added up to about one whole day, so that year gets an extra day, 29 February. A year with 366 days is a <dfn data-def="A year with 366 days instead of 365: it has a 29 February.">leap year</dfn>.</p>
<p>Switch the extra day on. Over eight hundred years the longest day hardly moves: it creeps a little later for three years, then jumps back on the leap day. This is the calendar Julius Caesar brought in for Rome, more than two thousand years ago.</p>`
		},
		{
			id: 'thousand',
			chapter: 'fix',
			title: 'Still a little off',
			scene: 'calendar',
			hints: { phase: 'thousand' },
			duration: 20,
			controls: [millennia],
			body: `
<p>Look closely, over a longer time. A round of the seasons is not quite 365 and a quarter days: it is about eleven minutes shorter. So a leap day every four years gives back slightly too much, and now the calendar falls behind instead, very slowly: about one day every 128 years.</p>
<p>Move the years forward: after a thousand years the longest day comes about a week earlier than in 2001. People noticed. By the year 1582 the first day of spring was coming about ten days earlier on the calendar than it had 1,250 years before, so Pope Gregory XIII had ten days cut from the calendar that year: in Italy and Spain, 4 October was followed by 15 October.</p>`
		},
		{
			id: 'skip',
			chapter: 'fix',
			title: 'Skip a few',
			scene: 'calendar',
			hints: { phase: 'skip' },
			duration: 20,
			controls: [gregorian],
			body: `
<p>Gregory’s calendar also fixed the rule. Years ending in 00, the hundreds years, are not leap years, except when they can be shared exactly into four-hundreds. That drops three leap days every four hundred years, which is just about the eleven minutes a year that were too many.</p>
<p>Switch the new rule on: over two thousand years the longest day stays within a day or so of June 21. Our calendar now drifts by only about one day in three thousand years. It is the calendar most of the world uses today.</p>`
		},
		{
			id: 'which',
			chapter: 'fix',
			title: 'Is it a leap year?',
			scene: 'calendar',
			hints: { phase: 'which' },
			duration: 20,
			controls: [year],
			body: `
<p>So the rule is not simply “every four years”. Pick a year and follow the checks: can it be shared out into fours? If it is a hundreds year, can it also be shared into four-hundreds?</p>
<p>Try 1900: it shares into fours, but it is a hundreds year that doesn’t share into four-hundreds, so February 1900 had only 28 days. Try 2000: it shares into four-hundreds, so it was a leap year. The next hundreds year, 2100, won’t be.</p>`
		},
		{
			id: 'same',
			chapter: 'fix',
			title: 'The seasons never changed',
			scene: 'calendar',
			hints: { phase: 'same' },
			duration: 18,
			body: `
<p>A leap day fixes the calendar, not the Earth. Earth goes round the Sun at the same pace whatever we write on the calendar; adding a 29 February doesn’t make the trip round the Sun longer or shorter, and it doesn’t change the seasons. It just keeps the names of the months lined up with them.</p>
<p>The seasons themselves come from Earth’s tilt as it goes round the Sun. To see why the longest day is long and why it is summer then, read <a href="../sun-earth-moon/">Sun, Earth & Moon</a>.</p>`,
			notes: `<p>The page uses the average length of the year measured season to season, 365 days, 5 hours, 48 minutes and 45 seconds. The real time from one longest day to the next varies by some minutes from year to year, because Earth’s orbit is an oval rather than a circle and the Moon and planets tug on it. The drawing shows the orbit as a circle travelled at an even pace, and puts the longest day at a fixed point of it. A year measured against the distant stars is about 20 minutes longer, because the direction of Earth’s tilt slowly swings round; the seasons, and the calendar, follow the tilt.</p>`
		}
	]
};
