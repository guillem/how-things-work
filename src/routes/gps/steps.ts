import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { ALMANAC_DATE } from './almanac';
import { constellation, visible } from './model';
import { PLACES, placeById } from './places';

// ---- controls ------------------------------------------------------------------------

const nsat: Control = {
	type: 'range',
	id: 'nsat',
	label: 'Satellites heard',
	min: 1,
	max: 3,
	step: 1,
	default: 2,
	format: (v) => `${v}`
};

/** The receiver's clock error on the flat map, in milliseconds. */
const clockErr: Control = {
	type: 'range',
	id: 'clockErr',
	label: 'Error of the receiver’s clock',
	min: -10,
	max: 10,
	step: 0.1,
	default: 6,
	format: (v) =>
		v === 0
			? 'exact'
			: `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} ms (${v > 0 ? 'fast' : 'slow'})`,
	help: 'A millisecond of clock error is 300 km of distance at the speed of light.'
};

const solveClock: Control = {
	type: 'toggle',
	id: 'solveClock',
	label: 'Solve for the clock error too',
	default: false
};

const place: Control = {
	type: 'select',
	id: 'place',
	label: 'Receiver',
	default: 'london',
	options: PLACES.map((p) => ({ value: p.id, label: p.name }))
};

const epoch = Date.parse(ALMANAC_DATE);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A time `h` hours after the almanac's epoch, as "Fri 16 Oct, 19:56". */
export function clockTime(h: number): string {
	const d = new Date(epoch + h * 3600e3);
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

const hour: Control = {
	type: 'range',
	id: 'hour',
	label: 'Time (GPS time)',
	min: 0,
	max: 24,
	step: 0.25,
	default: 0,
	format: clockTime,
	help: 'The constellation of the almanac published for this week; the satellites move on.'
};

/** How many of the satellites in view the receiver uses. */
const used: Control = {
	type: 'range',
	id: 'used',
	label: 'Satellites used',
	min: 3,
	max: 14,
	bounds: (p) => {
		const where = placeById(p.place);
		const n = visible(constellation(Number(p.hour ?? 0) * 3600), where.lat, where.lon).length;
		return [3, Math.max(4, n)];
	},
	step: 1,
	default: 4,
	format: (v) => `${v}`
};

const sigma: Control = {
	type: 'range',
	id: 'sigma',
	label: 'Error in each measured range',
	min: 0.5,
	max: 10,
	step: 0.5,
	default: 2,
	format: (v) => `${v.toFixed(1)} m (typical size)`,
	help: 'Delays in the atmosphere, small errors in the broadcast orbits and clocks, reflections: each range gets its own random error of about this size.'
};

const alt: Control = {
	type: 'range',
	id: 'alt',
	label: 'Height of a circular orbit',
	min: 300,
	max: 40000,
	step: 10,
	default: 20190,
	format: (v) => `${Math.round(v).toLocaleString('en-US')} km`
};

const corrected: Control = {
	type: 'toggle',
	id: 'corrected',
	label: 'Relativity correction in the satellite clocks',
	default: false
};
const days: Control = {
	type: 'range',
	id: 'days',
	label: 'Days since the clocks were set',
	min: 0,
	max: 7,
	step: 0.25,
	default: 1,
	format: (v) => `${v} ${v === 1 ? 'day' : 'days'}`
};
const ecc: Control = {
	type: 'toggle',
	id: 'ecc',
	label: 'Also skip the eccentricity correction',
	default: false,
	help: 'A small relativistic wobble of each satellite’s clock, different for each satellite.'
};

export const spec: ExplainerSpec = {
	slug: 'gps',
	title: 'How GPS finds you',
	summary:
		'Drag a receiver and the satellites around a map and watch circles of distance meet at your position, give its clock an error and fix it with one more satellite, then use the real GPS constellation and see why the satellite clocks must allow for relativity.',
	chapters: [
		{ id: 'ranges', title: 'Distances from timing' },
		{ id: 'sky', title: 'The real constellation' },
		{ id: 'clocks', title: 'Clocks and relativity' }
	],
	steps: [
		// ------------------------------------------------------------------ ranges
		{
			id: 'timing',
			chapter: 'ranges',
			title: 'A signal that says when and where it left',
			scene: 'plane',
			hints: { phase: 'one' },
			duration: 22,
			body: `
<p>A GPS satellite does one simple thing, over and over: it broadcasts a radio signal that says <strong>where the satellite is</strong> and <strong>what time it is</strong> on its clock, at the moment of sending.</p>
<p>Radio waves travel at the speed of light, about 300 000 km every second. A receiver that hears the signal compares the time in it with its own clock. If the signal took 0.02 seconds to arrive, it came from 0.02 × 300 000 = 6 000 km away. The receiver is somewhere on a <strong>circle</strong> of that radius around the satellite.</p>
<p>Drag the receiver around. The circle always passes through it, but one distance cannot tell you <em>where</em> on the circle you are. Drag the satellite too: it is the satellite's known position that anchors the circle.</p>`,
			notes: `<p>This first chapter is a flat map, 12 000 km across, with the satellites in the same plane as the receiver, so that distances are circles. The real problem is in three dimensions (spheres instead of circles) and comes in the next chapter. The pulses are slowed down enormously: real radio waves would cross this map in 0.04 seconds.</p>`
		},
		{
			id: 'trilateration',
			chapter: 'ranges',
			title: 'Where the circles meet',
			scene: 'plane',
			hints: { phase: 'tri' },
			duration: 24,
			controls: [nsat],
			body: `
<p>Listen to a second satellite. Its circle crosses the first in <strong>two points</strong>: you are at one of them. A third satellite settles it: its circle passes through only one of the two. On a flat map, three distances fix your position.</p>
<p>This is <dfn data-def="Finding a position from measured distances to known points (circles or spheres that meet), as GPS does. Triangulation instead uses measured angles.">trilateration</dfn>: positions from <strong>distances</strong>. It is often called triangulation, but that is a different method, which measures <em>angles</em> (surveyors did it with theodolites). A GPS receiver measures no angles at all: it has no idea in which direction the satellites are.</p>
<p>Drag any satellite or the receiver: the circles follow, and always meet at the receiver.</p>`
		},
		{
			id: 'clock-error',
			chapter: 'ranges',
			title: 'The trouble with the receiver’s clock',
			scene: 'plane',
			hints: { phase: 'clock' },
			duration: 26,
			controls: [clockErr],
			body: `
<p>There is a catch. To time a signal, the receiver needs a clock that agrees with the satellites' clocks. The satellites carry <dfn data-def="Clocks that count the oscillations of atoms (rubidium or caesium on GPS satellites): stable to about a billionth of a second over a day.">atomic clocks</dfn>; a phone has a cheap quartz crystal, like a watch's, that can drift by a millionth of a second every second.</p>
<p>And timing is distance: a clock <strong>1 millisecond</strong> fast makes every signal seem to have travelled 1 ms longer, which is <strong>300 km</strong> further. Give the receiver's clock an error. Every circle grows (clock fast) or shrinks (clock slow) by the <em>same</em> amount, and they no longer meet at one point.</p>
<p>The distances measured this way are called <dfn data-def="A distance to a satellite worked out from the travel time of its signal using the receiver's own clock: the true distance plus the speed of light times the receiver's clock error.">pseudoranges</dfn>. The cross shows the receiver's best guess if it trusts its clock: the point that comes closest to all three circles. It is far out: hundreds of kilometres for a few milliseconds of error.</p>`
		},
		{
			id: 'solve',
			chapter: 'ranges',
			title: 'Solve for the clock as well',
			scene: 'plane',
			hints: { phase: 'solve' },
			duration: 28,
			controls: [clockErr, solveClock],
			body: `
<p>The way out is a clever one. Since the error is the same for every satellite, treat it as one more unknown. On the flat map that makes three unknowns: east, north and the clock error. Three unknowns need three measurements, so <strong>three satellites</strong> are enough.</p>
<p>Switch on <em>Solve for the clock error too</em>. The receiver tries clock errors until all three circles, shrunk or grown by the same amount, meet at one point. That point is your position, and the amount is the clock's error: the receiver now knows the time as well as the satellites do.</p>
<p>Make the error as large as you like: the solved position stays on the receiver. A receiver that trusts its clock stays wrong.</p>`,
			notes: `<p>The receiver solves the equations by <dfn data-def="Choosing the unknowns that make the sum of the squared mismatches between measured and predicted distances as small as possible.">least squares</dfn>, with Gauss–Newton steps: guess, compare the predicted distances with the measured ones, correct the guess, and repeat; it settles in a few rounds. With exactly as many satellites as unknowns there can occasionally be two answers that fit perfectly (drag the receiver close to a satellite, outside the triangle, to find one); a satellite more tells them apart. Real receivers use every satellite in view, which also averages out the small errors of each.</p>`
		},
		// ------------------------------------------------------------------ sky
		{
			id: 'constellation',
			chapter: 'sky',
			title: 'Thirty-two satellites in six rings',
			scene: 'globe',
			hints: { phase: 'orbits' },
			duration: 30,
			controls: [place, hour],
			body: `
<p>These are the real GPS satellites, placed from the <dfn data-def="A summary of the orbits of all the satellites, broadcast by each of them and published by the US Coast Guard Navigation Center; this page uses the one for the week of 11 October 2026.">almanac</dfn> they broadcast for this week: 32 healthy satellites, about <strong>20 200 km</strong> up, on orbits tilted <strong>55°</strong> to the equator in six planes. Each goes round twice a day (every 11 hours 58 minutes), at 3.9 km/s, as <a href="../orbits-kepler/#third">Kepler's third law</a> requires at that height.</p>
<p>The lines join the receiver to the satellites above its horizon. From anywhere on Earth, at any time, <strong>usually 8 to 12</strong> are in view (never fewer than 7 in this almanac's day). Change the place and the time and count them.</p>
<p>Their signals take 67 to 86 thousandths of a second to come down, depending on how high in the sky the satellite is.</p>`,
			notes: `<p>The positions come from the YUMA almanac of the U.S. Coast Guard Navigation Center for GPS week 2440, and the orbit formulas of the GPS interface specification (IS-GPS-200): Kepler's equation for each orbit, then a rotation for the turning Earth. The almanac is coarse (kilometres); for the fix itself each satellite also broadcasts a precise <dfn data-def="A satellite's own detailed orbit, worked out and uploaded by the ground stations and broadcast in its signal, good to about a metre.">ephemeris</dfn> of its own orbit. Satellites are counted from 10° above the horizon, a usual cut-off. The globe is to scale; the satellites and the receiver are not.</p>`
		},
		{
			id: 'four',
			chapter: 'sky',
			title: 'Four satellites in three dimensions',
			scene: 'globe',
			hints: { phase: 'fix' },
			duration: 30,
			controls: [used, clockErr],
			body: `
<p>In three dimensions each distance puts you on a <strong>sphere</strong> round a satellite instead of a circle. The unknowns are now four: three coordinates and the clock error. So a receiver needs <strong>four satellites</strong>.</p>
<p>Watch it work it out. It starts with no idea where it is, at the centre of the Earth, and improves its guess with the least-squares step you saw on the map: the guess jumps thousands of kilometres to the surface, then closes in, and within a few rounds it is right to the millimetre, clock error included.</p>
<p>Drop to three satellites: three spheres and an unknown clock leave too many possibilities, and there is no fix.</p>`,
			notes: `<p>Here the ranges are exact, so the fix is exact. Real ranges carry errors of a few metres (next step), and a receiver that uses all the satellites in view averages them down. The calculation leaves out effects a real receiver must include: the signal's travel time (the satellite moves 300 m while its signal comes down), the Earth's turning during that time (the Sagnac correction, tens of metres), and the slowing of the signal in the ionosphere and the lower atmosphere.</p>`
		},
		{
			id: 'geometry',
			chapter: 'sky',
			title: 'Spread-out satellites give a better fix',
			scene: 'sky',
			hints: { phase: 'drag' },
			duration: 30,
			controls: [sigma],
			body: `
<p>Real ranges are never perfect. The signal slows a little in the atmosphere, bounces off buildings, and the broadcast orbits and clocks are slightly off. Each range is wrong by a few metres, and the fix is wrong too. By how much depends on <strong>where the satellites are in the sky</strong>.</p>
<p>This is a <dfn data-def="A map of the sky: the centre is straight overhead, the edge is the horizon, north is at the top.">sky plot</dfn>: overhead in the middle, the horizon at the edge. Each dot on the right is one fix made with fresh random range errors. Drag the four satellites. Spread out, the spheres cross at steep angles and the fixes stay close. Bunched together, the spheres cross at shallow angles and small range errors move the crossing a long way.</p>
<p>The factor is the <dfn data-def="Dilution of precision: how much the satellites' geometry multiplies range errors into position and clock errors. GDOP (geometric) covers all four unknowns.">GDOP</dfn>: the spread of the fixes is roughly the range error times this number.</p>`,
			notes: `<p>GDOP is √trace((HᵀH)⁻¹), where each row of H holds the direction to one satellite and a 1 for the clock. HDOP and VDOP are its horizontal and vertical parts. The best four satellites are one overhead and three spread round the horizon. The fixes shown are the least-squares solutions for the ranges with their random errors, computed for each dot.</p>`
		},
		{
			id: 'real-sky',
			chapter: 'sky',
			title: 'Height is the weak direction',
			scene: 'sky',
			hints: { phase: 'real' },
			duration: 28,
			controls: [place, hour, sigma],
			body: `
<p>Here is the real sky at the place and time you choose, with every satellite above 10°. With 8 or more in view, the GDOP is usually about 2: a range error of a couple of metres gives a fix a few metres off.</p>
<p>Look at the spread of the fixes: it is wider in <strong>height</strong> than across the map. All the satellites are above you, none below (the Earth is in the way), so up and down are pinned less well than north, south, east and west. Your phone's height is the least accurate thing it knows.</p>
<p>The sky is not evenly filled, either: the orbits are tilted 55°, so no satellite ever passes overhead near the poles. The grey lines are the satellites' paths across this sky over a whole day. From London they leave a gap in the northern sky; from Antarctica the gap sits right overhead.</p>`
		},
		// ------------------------------------------------------------------ clocks
		{
			id: 'relativity',
			chapter: 'clocks',
			title: 'Two relativity effects, pulling opposite ways',
			scene: 'clocks',
			hints: { phase: 'rates' },
			duration: 30,
			controls: [alt],
			body: `
<p>Positioning needs the satellite clocks right to a few billionths of a second: a nanosecond is 30 cm of range. At that level, Einstein matters, twice over.</p>
<p>The satellites move at 3.9 km/s, and <a href="../special-relativity/#time-dilation">special relativity</a> says a moving clock ticks slower: that costs them <strong>7.2 microseconds a day</strong>. But they are also 20 200 km up, where gravity is weaker, and general relativity says a clock higher in a gravitational field runs <strong>faster</strong>: that gains <strong>45.8 µs a day</strong>. The net: GPS clocks gain <strong>38.6 µs a day</strong> on clocks on the ground.</p>
<p>Change the height of the orbit. Low orbits are faster and nearer, so the slowing wins; high ones, gravity wins. The two cancel for an orbit about 3 200 km up. The correction is built in before launch: each satellite's clock is set to tick at 10.229 999 995 43 MHz, so that it runs at exactly 10.23 MHz as seen from the ground.</p>`,
			notes: `<p>The rates are those of a clock in a circular orbit compared with a clock on the turning Earth's sea-level surface, whose own rate is set by gravity there, the Earth's flattening and its rotation: −6.969 × 10⁻¹⁰ (N. Ashby, <i>Relativity in the Global Positioning System</i>, Living Reviews in Relativity 6, 1, 2003). The speed effect is −v²/2c², the gravity effect the difference in gravitational potential divided by c²; at GPS's 26 562 km from the centre the net is 4.465 × 10⁻¹⁰. The gravity effect is the same <a href="../black-holes/#clocks">gravitational time dilation</a> that becomes extreme near a black hole. The test satellite NTS-2 (1977) was launched with the offset switched off, so that the uncorrected rate could be measured; it matched the prediction, and the offset was then switched on.</p>`
		},
		{
			id: 'uncorrected',
			chapter: 'clocks',
			title: 'Switch the correction off',
			scene: 'drift',
			hints: { phase: 'drift' },
			duration: 32,
			controls: [corrected, days, ecc, place],
			body: `
<p>Leave the correction out, and every satellite clock runs <strong>38.6 µs a day fast</strong>. That is <strong>11.6 km of range a day</strong>. It is often said that GPS positions would drift by about 10 km a day. That is the range error, not the position error. Here are two receivers, both with perfect clocks of their own.</p>
<p>The first <strong>trusts its own clock</strong>. Every range comes out short by the same 11.6 km a day, and its fix is thrown off by <strong>16 to 20 km after one day</strong>, mostly upwards (it thinks it is nearer to all the satellites), and more every day.</p>
<p>The second <strong>solves for its clock</strong>, as real receivers do. To it, satellite clocks that are all fast together look exactly like its own clock being slow. It absorbs the whole error into the clock and its position <strong>stays put</strong>. Its time is wrong instead: it runs with the satellites, 38.6 µs a day ahead. What remains is the small wobble of each satellite's eccentric orbit, different for each one: skip that correction too and the fix moves by metres.</p>`,
			notes: `<p>The drift is the same for every satellite only because all GPS orbits have the same height. The eccentricity term is relativistic too: on a slightly elliptical orbit a satellite speeds up and sinks near its closest point, and its clock wobbles by up to 48 ns (14 m of range) for the most eccentric satellite in this almanac (eccentricity 0.021); receivers correct it from the broadcast orbit. In practice, the ground stations that steer the satellite clocks would also notice a steady drift and broadcast corrections for it; the offset is built in so those corrections stay small, and so that GPS time keeps step with time on the ground, which is what timing users (power grids, phone networks, banks) take from it.</p>`
		},
		{
			id: 'summary',
			chapter: 'clocks',
			title: 'Timing the sky',
			scene: 'globe',
			hints: { phase: 'summary' },
			duration: 26,
			controls: [place, hour],
			body: `
<p>Put it together. Satellites whose positions are known to a metre broadcast the time on their atomic clocks. A receiver times their signals, turns each delay into a distance, and solves for <strong>four unknowns</strong>: three for its position and one for its own clock. The geometry of the satellites sets how much the small errors spread.</p>
<p>All of it rests on time: a billionth of a second is 30 cm. That is why the satellite clocks are atomic, steered from the ground, and set before launch to allow for both of Einstein's theories.</p>
<p>And because a receiver solves for its own clock, it is also a superb clock: GPS is how much of the world tells the time.</p>`
		}
	]
};
