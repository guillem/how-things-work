import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const jug: Control = { type: 'action', id: 'jug', label: 'A jug of water', action: 'Pour it in' };

const lever: Control = {
	type: 'action',
	id: 'lever',
	label: 'The flush lever',
	action: 'Press the lever'
};

const pour: Control = {
	type: 'range',
	id: 'pour',
	label: 'Time to pour the bucket in',
	min: 1,
	max: 15,
	step: 1,
	default: 2,
	format: (v) => `${v} second${v === 1 ? '' : 's'}`
};

const washdown: Control = {
	type: 'toggle',
	id: 'washdown',
	label: 'Swap in a washdown bowl (a wide bend)',
	default: false
};

const hold: Control = {
	type: 'toggle',
	id: 'hold',
	label: 'Hold the float down',
	default: false
};

const seal =
	'<dfn data-def="The water left standing in the bowl and the bend behind it. It plugs the way to the drain, so that smells from the sewer can’t come up into the room.">water seal</dfn>';
const siphon =
	'<dfn data-def="A bent pipe, full of water, that goes up over a hump and down the other side, further down than it started. Once it is full, water keeps running through it on its own, up and over the hump, until air gets in.">siphon</dfn>';
const washdownDfn =
	'<dfn data-def="A toilet whose bend behind the bowl is wide and short. It never siphons: the rush of water from the tank just pushes what is in the bowl over the top of the bend. The usual kind in much of Europe.">washdown</dfn>';
const flapper =
	'<dfn data-def="The rubber plug at the bottom of the tank. Pressing the lever lifts it by a chain, and it stays up, floating, until the tank is nearly empty; then it drops back onto its hole.">flapper</dfn>';

export const spec: ExplainerSpec = {
	slug: 'toilet-flush',
	title: 'Toilet flush & siphons',
	summary:
		'Cut a toilet open and press the lever: the tank pours into the bowl, the water fills the bend behind it, and the bowl drains itself until air gets in and it gurgles. Pour a bucket in fast or slow to find what starts the siphon, swap in a washdown bowl that never siphons, and watch the float shut its own valve.',
	chapters: [
		{ id: 'flush', title: 'The flush' },
		{ id: 'tests', title: 'What starts it' },
		{ id: 'refill', title: 'Filling up again' },
		{ id: 'next', title: 'Read next' }
	],
	steps: [
		// ---------------------------------------------------------------- flush
		{
			id: 'toilet',
			chapter: 'flush',
			title: 'Why is there always water in the bowl?',
			scene: 'toilet',
			hints: { phase: 'toilet' },
			duration: 14,
			controls: [jug],
			body: `
<p>Here is a toilet cut in half, seen from the side. At the back is the <strong>tank</strong>, full of clean water. In front is the <strong>bowl</strong>. Hidden in the china behind the bowl is a pipe you never see: <strong>the bend</strong>. It climbs up from the bottom of the bowl, goes over a hump, and drops down to the drain in the floor.</p>
<p>The bowl’s water stands exactly as high as the top of that hump. It can’t stay any higher: anything more spills over the hump and down to the drain. <strong>Pour in a jug of water</strong> and watch. The water rises a little, trickles over the top, and settles back to the same level.</p>
<p>The water left in the bowl and the bottom of the bend is the ${seal}: it plugs the pipe, so the smells of the sewer can’t come up into the room.</p>`
		},
		{
			id: 'flush',
			chapter: 'flush',
			title: 'Press the lever',
			scene: 'toilet',
			hints: { phase: 'flush' },
			duration: 20,
			controls: [lever],
			body: `
<p><strong>Press the lever.</strong> A chain lifts the ${flapper} at the bottom of the tank, and the tank’s 6 litres rush down into the bowl through holes under its rim. The tank is empty in about 3 seconds.</p>
<p>The water in the bowl climbs, and spills over the hump of the bend faster and faster. Then, about 2 seconds after you pressed, something changes: the bend fills right up with water, and the bowl starts to <strong>empty itself</strong>, faster than the tank is still pouring in, about 2 litres a second. It keeps going until the bowl’s water is down at the bend’s opening. Then air gets into the bend, and the flush stops with a <strong>gurgle</strong>.</p>`
		},
		{
			id: 'siphon',
			chapter: 'flush',
			title: 'What empties the bowl?',
			scene: 'toilet',
			hints: { phase: 'siphon' },
			duration: 24,
			controls: [lever],
			body: `
<p>Here is the same flush, four times slower. Nothing in a toilet sucks. Once the bend is full of water from end to end, it is a ${siphon}, and two ordinary things do the work.</p>
<p><strong>Gravity</strong> pulls the water in the long side of the bend down towards the drain. The bend is full, so no air can get in behind that water to take its place: the only thing that can follow it is more water, from the bowl. And the <strong>air</strong> presses down on the bowl’s water, all the time, hard enough to hold up a column of water 10 metres tall. That push drives the bowl’s water up over the hump, after the water falling down the other side.</p>
<p>So the tank doesn’t have to push the whole bowl out. It only has to fill the bend; the siphon does the rest. And when the bowl is nearly empty, air slips in at the bend’s opening, the water in the bend falls away, and the siphon is broken: that is the gurgle.</p>`,
			notes: `<p>Some books say the long side of the bend is heavier and pulls the short side up, like a chain over a pulley. Water isn’t a chain. What the water running down the long side does is leave the water at the top of the hump pressing less hard than the air outside; the air pressing on the bowl then pushes water up the short side. With ordinary tap water, bubbles break the column once the hump is more than about 10 metres above the bowl, which is as high as the outside air can hold the water up. Water with the air boiled out of it can be pulled higher; a toilet’s never is.</p>
<p>Many siphonic toilets in North America also have a small hole at the bottom of the bowl, the siphon jet, that squirts tank water straight into the bend to fill it sooner. The page leaves it out.</p>`
		},
		// ---------------------------------------------------------------- tests
		{
			id: 'bucket',
			chapter: 'tests',
			title: 'Flush with a bucket',
			scene: 'toilet',
			hints: { phase: 'bucket' },
			duration: 20,
			controls: [pour],
			body: `
<p>You don’t need the tank at all. When the water is off, people flush a toilet with a bucket: here, 6 litres, as much as the tank holds. <strong>Choose how long you take to pour it in.</strong></p>
<p>Pour it in 3 seconds or less, and the bowl flushes just as it does with the tank: the bend fills, the siphon starts, the bowl drains with a gurgle. At 4 seconds the bend almost fills, then the extra runs away and the siphon never starts. Take 15 seconds, and the water only trickles over the hump, the bend stays almost empty, and when you have finished the bowl is just as full as before. Exactly the same water, poured slowly, doesn’t flush.</p>
<p>What matters isn’t how much water there is, but how fast it comes: fast enough to fill the bend before it can run away. And look at the bowl after a bucket flush: there’s no tank refilling it, so it stays nearly empty.</p>`,
			notes: `<p>The bend on this page fills, and the siphon starts, only when water keeps spilling over its hump faster than about a litre a second long enough to fill it; a 4-second pour comes just over that for a moment and still doesn’t quite start it. A real bowl’s limit depends on the exact shape of its bend, and the page leaves that out. Pouring from higher up doesn’t help much: what fills the bend is how fast the water comes, not how hard it lands.</p>`
		},
		{
			id: 'washdown',
			chapter: 'tests',
			title: 'Not every toilet siphons',
			scene: 'toilet',
			hints: { phase: 'washdown' },
			duration: 20,
			controls: [washdown],
			body: `
<p>The toilet so far is a <strong>siphonic</strong> toilet, the usual kind in North America, with a narrow bend about 5 centimetres wide. <strong>Swap in a ${washdownDfn} bowl</strong>, with a wide bend, and flush it.</p>
<p>The same 6 litres rush in, and the bowl’s water climbs just as before. But the wide bend never fills: the water slides down it with air still getting past. There is no siphon and no gurgle. The tank’s rush simply <strong>pushes</strong> the bowl’s water, and whatever is in it, over the hump, and the bowl is just as full afterwards as before.</p>
<p>Washdown toilets are the usual kind in much of Europe. Both kinds work; they just get the water out in different ways.</p>`,
			notes: `<p>A washdown bowl needs its push to come all at once, so its tank empties fast, often through a wide valve. Its wide bend is also harder to block. A siphonic bowl empties more completely and quietly, but its narrow bend can clog. Many washdown toilets have two buttons, a full flush of about 6 litres and a half flush of 3 or 4.</p>`
		},
		// ---------------------------------------------------------------- refill
		{
			id: 'refill',
			chapter: 'refill',
			title: 'The float shuts its own tap',
			scene: 'toilet',
			hints: { phase: 'refill' },
			duration: 40,
			controls: [hold],
			body: `
<p>After the flush, a valve inside the tank opens and lets water in from the pipes. Most of it fills the tank; a quarter runs down a thin tube into the bowl, to bring its water back up to the hump and make the seal again.</p>
<p>On the valve rides the <strong>float</strong>. As the tank fills, the water lifts the float, and the float slowly closes the valve. When the water reaches its line, the valve shuts, all by itself, about half a minute after the flush. Nobody has to watch it: the rising water switches off its own supply.</p>
<p><strong>Hold the float down</strong> and the valve can never close. The water rises to the top of the overflow pipe and pours down it into the bowl, about 18 litres a minute, for as long as you hold it: a running toilet. It never flushes, though. That water comes far too slowly to fill the bend.</p>`,
			notes: `<p>The water line, and so how much water each flush uses, is set by where the float stops the valve: lower it and the tank holds less. Older toilets have a ball float on a long arm instead of a float on the valve; it works the same way. The overflow pipe is there so that a valve that won’t shut fills the bowl and not the bathroom floor.</p>`
		},
		// ---------------------------------------------------------------- next
		{
			id: 'next',
			chapter: 'next',
			title: 'Read next',
			scene: 'toilet',
			hints: { phase: 'next' },
			duration: 16,
			controls: [lever],
			body: `
<p>A siphonic toilet doesn’t push all its water out with the tank. The tank only fills the bend behind the bowl, quickly; then gravity pulls the water down the long side, the air pushes the bowl’s water in behind it, and the bowl drains itself until air gets in. A slow pour never fills the bend, and a washdown bowl’s wide bend never siphons at all. Then the float lets the tank fill and shuts its own valve.</p>
<p>The page on <a href="../newtons-laws/">Newton’s laws</a> is about pushes and pulls like these, and the motion they make. The float switching its own valve off is the simplest kind of feedback; <a href="../feedback-control/">feedback control</a> shows how machines steer themselves with it.</p>`
		}
	]
};
