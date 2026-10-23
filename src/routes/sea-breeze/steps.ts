import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { LAND, LAND_DEPTH, SEA, SEA_DEPTH, airDensity, at, kmh } from './model';

/** A clock time for the reader: "6 am", "3:30 pm", "midnight", "noon". */
export function clock(hour: number): string {
	const h = ((hour % 24) + 24) % 24;
	const whole = Math.floor(h + 1e-9);
	const min = Math.round((h - whole) * 60);
	if (min === 0 && whole === 0) return 'midnight';
	if (min === 0 && whole === 12) return 'noon';
	const h12 = whole % 12 === 0 ? 12 : whole % 12;
	const mm = min === 0 ? '' : `:${String(min).padStart(2, '0')}`;
	return `${h12}${mm} ${whole < 12 ? 'am' : 'pm'}`;
}

const time = (id: string, def: number, help = 'Or drag the Sun across the sky.'): Control => ({
	type: 'range',
	id,
	label: 'Time of day',
	min: 0,
	max: 24,
	step: 0.25,
	default: def,
	format: clock,
	help
});

const afternoon = at(15);
const night = at(3);
const round = Math.round;
/** Grams a cubic metre of air over the land is lighter than over the sea, at 3 pm. */
const lighter = round(((airDensity(afternoon.sea) - airDensity(afternoon.land)) * 1000) / 5) * 5;

const breeze =
	'<dfn data-def="A gentle wind that blows from the sea onto the land on sunny afternoons, and often turns round to blow from the land out to sea at night (then it is called a land breeze).">sea breeze</dfn>';

export const spec: ExplainerSpec = {
	slug: 'sea-breeze',
	title: 'Where wind comes from: the sea breeze',
	summary:
		'Drag the Sun across the sky over a beach: the land warms far faster than the sea, the warm air over it is pushed up, and cooler air from over the sea slides in underneath as a breeze. At night the land cools below the sea and the breeze turns round. Uneven heating is enough to make a wind.',
	chapters: [
		{ id: 'warming', title: 'Land and sea warm up' },
		{ id: 'wind', title: 'The breeze' },
		{ id: 'day', title: 'Day and night' }
	],
	steps: [
		// ------------------------------------------------------------------ warming
		{
			id: 'beach',
			chapter: 'warming',
			title: 'A breeze off the sea',
			scene: 'coast',
			hints: { phase: 'beach' },
			duration: 14,
			body: `
<p>On a hot, sunny afternoon at the beach, a cool wind often blows in from the sea. The flag on the lifeguard’s tower stands out stiff, pointing inland. Around sunrise the same flag pointed the other way, out to sea, and it went slack late in the morning as the wind turned.</p>
<p>Nobody switched that wind on. So where does it come from, and why does it come in the afternoon? Here is a beach from the side, with land on the left, sea on the right, and the air above drawn as drifting specks.</p>`
		},
		{
			id: 'sun',
			chapter: 'warming',
			title: 'The Sun warms the land much faster than the sea',
			scene: 'coast',
			hints: { phase: 'sun' },
			duration: 22,
			controls: [time('morning', 6)],
			body: `
<p>The same sunshine falls on the land and on the sea. <strong>Drag the Sun across the sky</strong> and watch the two thermometers: one for the air over the land, one for the air over the sea.</p>
<p>From a cool ${round(at(6).land)} °C at 6 am, the air over the land climbs to about <strong>${round(afternoon.land)} °C by 3 in the afternoon</strong>. The air over the sea hardly moves: it stays near <strong>${round(afternoon.sea)} °C</strong> all day, and the water itself warms by less than half a degree.</p>
<p>So by mid-afternoon the land side is about <strong>${round(afternoon.land - afternoon.sea)} degrees warmer</strong> than the sea side. That difference is what makes the wind.</p>`
		},
		{
			id: 'why-sea',
			chapter: 'warming',
			title: 'Why the sea stays cool',
			scene: 'layers',
			hints: { phase: 'layers' },
			duration: 20,
			body: `
<p>The sea actually soaks up <em>more</em> of the sunshine than the land does: dark water reflects less of it than sand or fields. So why doesn’t it warm up?</p>
<p>On land, the warmth stays in a <strong>thin top layer</strong>: the day’s warming reaches only about ${round(LAND_DEPTH * 100)} centimetres into the ground (think of hot sand on your feet, and cool sand when you dig a hand’s depth down). In the sea, the sunlight shines metres into the water and the waves stir it, so that warmth, and a bit more, is shared through the <strong>top ${SEA_DEPTH} metres</strong> of water, ${round(SEA_DEPTH / LAND_DEPTH)} times deeper.</p>
<p>And litre for litre, water needs more warmth to heat up than soil does. Spread out that thin, the day’s sunshine barely warms the sea at all.</p>`,
			notes: `<p>The page’s land keeps its warmth in about its top ${round(LAND_DEPTH * 100)} cm of moist soil, and the sea in a stirred top layer ${SEA_DEPTH} m deep. Warming the sea’s layer by a degree takes about ${round(SEA.capacity / LAND.capacity / 10) * 10} times as much heat as warming the land’s. Over a whole summer the sea stores heat through a much deeper layer than this day’s top ${SEA_DEPTH} m, which is why it is warmest in late summer and coolest in late winter, weeks after the land.</p>`
		},
		// ------------------------------------------------------------------ wind
		{
			id: 'rise',
			chapter: 'wind',
			title: 'The warm air over the land is pushed up',
			scene: 'coast',
			hints: { phase: 'rise' },
			duration: 22,
			controls: [time('hour', 15)],
			body: `
<p>Air that warms up spreads out, so a cubic metre of it gets a little lighter. A cubic metre of air weighs about 1.2 kilograms; at 3 pm the air over the hot land weighs about <strong>${lighter} grams less</strong> than the same box of air over the sea.</p>
<p>Warm air doesn’t rise because “heat goes up”. It rises because the heavier, cooler air around it <strong>pushes underneath it and shoves it up</strong>, the way water pushes a beach ball up when you let it go under the surface.</p>
<p><strong>Drag the Sun</strong> to the morning and to the afternoon: the warmer the land is compared with the sea, the faster its air is pushed up.</p>`
		},
		{
			id: 'breeze',
			chapter: 'wind',
			title: 'Air from the sea slides in underneath',
			scene: 'coast',
			hints: { phase: 'breeze' },
			duration: 24,
			controls: [time('hour', 15)],
			body: `
<p>The rising air has to be replaced. Cooler, heavier air from over the sea slides in along the ground to take its place: that is the ${breeze}, and the flag on the beach shows it. High up, the warm air spreads back out over the sea, cools and sinks, closing the loop.</p>
<p>At 3 pm the breeze blows at about <strong>${kmh(afternoon.breeze)} km/h</strong>, as fast as a bicycle. <strong>Drag the Sun back</strong> to the morning: while the land is still cooler than the sea there is no sea breeze; it starts shortly after 9 am, once the land has warmed past the sea, and grows as the difference grows.</p>`,
			notes: `<p>The breeze is held back by rubbing on the ground, the trees and the waves, so it settles to a speed that follows the temperature difference. The push behind it is the one a meteorologist works out for a loop of air 20 km wide and 1 km high (half over the sea, half over the land), and the page sets the rubbing so an afternoon with the land 9 degrees warmer gives a typical sea breeze.</p><p>A real sea breeze pushes inland as a sharp edge, the sea-breeze front, often 20 to 50 km by evening; puffy clouds can line up along it, where the air is pushed up.</p>`
		},
		// ------------------------------------------------------------------ day
		{
			id: 'night',
			chapter: 'day',
			title: 'At night the breeze turns round',
			scene: 'coast',
			hints: { phase: 'night' },
			duration: 22,
			controls: [time('night', 3, 'Or drag the Moon across the sky.')],
			body: `
<p>After sunset the land loses its warmth as fast as it gained it, while the sea hardly cools at all. By 3 am the air over the land is down to about <strong>${round(night.land)} °C</strong>, and the sea is still about <strong>${round(night.sea)} °C</strong>.</p>
<p>Now the land side is the cooler, heavier one. The warmer air over the sea is pushed up, and air from the land slides out to sea along the ground: a <strong>land breeze</strong> of about ${kmh(night.breeze)} km/h. The flag points out to sea.</p>
<p>It is gentler than the afternoon’s sea breeze: the gap is only about ${round(night.sea - night.land)} degrees, against ${round(afternoon.land - afternoon.sea)} in the afternoon, and the cool ground at night keeps the loop of air shallower and weaker.</p>`
		},
		{
			id: 'whole-day',
			chapter: 'day',
			title: 'A whole day at the beach',
			scene: 'chart',
			hints: { phase: 'chart' },
			duration: 24,
			controls: [time('hour', 15, 'Or drag the marker along the day.')],
			body: `
<p>Here is the whole day at once. The two lines are the air over the land and the air over the sea; the bars underneath are the breeze, up for a sea breeze and down for a land breeze. <strong>Move through the day</strong>.</p>
<p>The breeze follows the gap between the two lines: when the land line climbs above the sea line, the breeze blows in from the sea, and the bigger the gap, the stronger it blows. In the evening the land line drops below the sea line and the breeze turns round.</p>`,
			notes: `<p>Times are Sun time, for a clear summer day 40 degrees north of the equator (about the latitude of Madrid or New York), with no other wind blowing. With daylight saving time, clocks read about an hour later. A strong wind from the weather can swamp a sea breeze, and clouds that block the Sun weaken it.</p>`
		},
		{
			id: 'next',
			chapter: 'day',
			title: 'Read next',
			scene: 'coast',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Uneven heating is enough to make a wind. By day air slides in from over the cooler sea to replace the warm air pushed up over the land; at night the land cools below the sea and the breeze turns round.</p>
<p>Not every wind is a sea breeze, though. The big winds that bring storms and change the weather cover whole countries, and over such distances Earth’s spin bends them, which this page leaves out. The page on <a href="../atmosphere-weather/">the atmosphere and weather</a> heats the whole spinning planet and gets its great winds. The page on <a href="../cloud-base/">why clouds form</a> follows one bubble of rising air up until it turns into a cloud, and <a href="../states-of-matter/">states of matter</a> shows what the molecules of a gas do when it warms and spreads out.</p>`
		}
	]
};
