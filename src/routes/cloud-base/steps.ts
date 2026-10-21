import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { DAY } from './model';

const metres = (z: number) => (z === 0 ? 'on the ground' : `${z.toLocaleString('en-GB')} m up`);

const height: Control = {
	type: 'range',
	id: 'height',
	label: 'Height of the bubble',
	min: 0,
	max: DAY.thermalTop,
	step: 50,
	default: 0,
	format: metres,
	help: 'Or drag the bubble up and down.'
};

const humid: Control = {
	type: 'range',
	id: 'humid',
	label: 'How damp the air is',
	min: 30,
	max: 90,
	step: 5,
	default: Math.round(DAY.rh * 100),
	format: (v) => `${v} %`,
	help: 'Weather forecasts call this the humidity.'
};

const along: Control = {
	type: 'range',
	id: 'along',
	label: 'Blow the bubble over the mountain',
	min: 0,
	max: 100,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'start' : v === 100 ? 'the far side' : `${v} %`),
	help: 'Or drag the bubble.'
};

const vapour =
	'<dfn data-def="Water spread out in the air as single molecules, far too small to see. Air always carries some.">water vapour</dfn>';
const humidity =
	'<dfn data-def="How damp the air is: how much water vapour it carries, compared with the most it could carry at its temperature. At 100 % the vapour starts turning into droplets.">humidity</dfn>';
const base =
	'<dfn data-def="The height where the bottom of a cloud sits: where rising air has cooled enough for its water vapour to turn into droplets.">cloud base</dfn>';

export const spec: ExplainerSpec = {
	slug: 'cloud-base',
	title: 'Why clouds form, and why their bottoms are flat',
	summary:
		'Drag a bubble of warm air up from the ground: it swells, cools about a degree for every hundred metres, and turns white where its invisible water becomes droplets. Every bubble does so at the same height, so clouds have flat bottoms; damper air brings them lower. Then blow the bubble over a mountain: rain on one side, warm dry wind on the other.',
	chapters: [
		{ id: 'bubble', title: 'One bubble of air' },
		{ id: 'clouds', title: 'Flat-bottomed clouds' },
		{ id: 'mountain', title: 'Over a mountain' }
	],
	steps: [
		// ------------------------------------------------------------------ bubble
		{
			id: 'puzzle',
			chapter: 'bubble',
			title: 'Clouds with flat bottoms',
			scene: 'sky',
			hints: { phase: 'puzzle' },
			duration: 14,
			body: `
<p>Look up on a sunny summer afternoon and you often see small puffy white clouds, lumpy on top. Look at their <strong>bottoms</strong>: they are flat, and every cloud’s flat bottom is at the <strong>same height</strong>, as if the clouds were sitting on an invisible glass floor.</p>
<p>Today that floor is about <strong>1,200 metres</strong> up. Why do the clouds start there, and not lower or higher? And what is a cloud made of? To find out, follow one bubble of air from the ground.</p>`
		},
		{
			id: 'rise',
			chapter: 'bubble',
			title: 'A bubble of warm air rises and cools',
			scene: 'sky',
			hints: { phase: 'rise' },
			duration: 22,
			controls: [height],
			body: `
<p>The Sun warms the ground, and the ground warms the air touching it. A <strong>bubble</strong> of that warm air is lighter than the cooler air around it, so the cooler air pushes it up, like a beach ball let go under water. Today the air near the ground is ${DAY.groundC} °C.</p>
<p><strong>Drag the bubble up</strong> and watch its thermometer. It drops about <strong>one degree for every hundred metres</strong>: 500 metres up, the bubble is already 5 degrees colder. And the bubble <strong>swells</strong>: the dotted circle shows how big it was on the ground. (Here you choose how high the bubble goes; the page works out how much it cools and swells.)</p>
<p>Higher up there is less air above pressing down, so the bubble spreads out. Air that spreads out cools down: it uses up some of its warmth pushing the air around it aside. You can feel it in the cold puff of air from a bicycle tyre’s valve, or a spray can that gets cold in your hand.</p>`,
			notes: `<p>It is not colder up high because you are farther from the Sun. The Sun is 150 million kilometres away; climbing 2 kilometres brings you closer by one part in 75 million, which changes nothing. The air up a mountain is cold because air that rises swells and cools, and it is the ground, not the sunshine on the air, that warms the air from below.</p><p>The air around a mountain is not quite as cold as a bubble that rose there: on average it gets about 6 or 7 degrees colder for each kilometre, a little less than a rising bubble’s 10.</p>`
		},
		{
			id: 'cloud',
			chapter: 'bubble',
			title: 'The bubble turns into cloud',
			scene: 'sky',
			hints: { phase: 'cloud' },
			duration: 22,
			controls: [height],
			body: `
<p>The bubble carries water, but you can’t see it: it is ${vapour}, single molecules of water mixed in with the air. Warm air can carry a lot of vapour. The colder the air gets, the less vapour it can carry.</p>
<p><strong>Keep dragging the bubble up.</strong> At about <strong>1,200 metres</strong> it has cooled to 13 °C, and that is too cold to carry all its water as vapour. The extra water turns into <strong>tiny droplets</strong>, and the bubble <strong>turns white</strong>: it has become a cloud. The magnifying glass shows what is inside.</p>
<p>A cloud is not vapour: it is billions of droplets, each about a fiftieth of a millimetre across. Each droplet is heavier than air, but so small that it falls only about a centimetre a second, while the warm air in the bubble rises a couple of metres every second, carrying the droplets up with it.</p>`,
			notes: `<p>Turning vapour into droplets gives off a little warmth, so above the cloud’s bottom the bubble cools more slowly: about half a degree for every hundred metres instead of one. Drag it from 1,500 to 2,000 metres and watch.</p><p>A cloud where the air stops rising doesn’t fall down either: its droplets drift down so slowly that they reach the drier air underneath and evaporate before they get far.</p>`
		},
		// ------------------------------------------------------------------ clouds
		{
			id: 'flat',
			chapter: 'clouds',
			title: 'Every bubble turns white at the same height',
			scene: 'sky',
			hints: { phase: 'flat' },
			duration: 20,
			body: `
<p>Now let bubble after bubble rise from the same warm ground. They all start with the same warmth and the same water, so they all cool the same way, and every one of them <strong>turns white at the same height</strong>.</p>
<p>That is the flat floor under the clouds: the ${base}. Below it, the rising air is still clear; above it, it is cloud. On this day the page lets the bubbles rise to 2,000 metres, so the clouds are lumpy heaps from 1,200 metres to the top.</p>`,
			notes: `<p>Real bubbles keep rising while they are lighter than the air around them, and how high that is depends on the day and on how much the bubbles mix with the air around them; on a sunny summer afternoon it is often 1 to 2 kilometres up. The page doesn’t work that height out: it simply chooses 2,000 metres. On some days bubbles keep going much higher, and the clouds tower into thunderstorms.</p>`
		},
		{
			id: 'humid',
			chapter: 'clouds',
			title: 'Damp days, low clouds',
			scene: 'sky',
			hints: { phase: 'humid' },
			duration: 22,
			controls: [humid],
			body: `
<p>How high the cloud base sits depends on how much water the air carries. <strong>Change how damp the air is</strong>, its ${humidity}.</p>
<p>Damp air doesn’t have to cool much before its water turns into droplets, so the bubbles turn white low down: at 70 % the clouds start about 750 metres up, at 90 % barely 200 metres up. Dry air has to rise and cool a long way first: at 40 % the clouds start about 1,850 metres up. Drier still, the bubbles stop rising before they get cold enough, and the sky stays <strong>clear blue</strong>, even though the warm air is still rising.</p>`,
			notes: `<p>A rule of thumb pilots use: the cloud base is about 125 metres up for every degree between the air’s temperature and its <dfn data-def="The temperature the air would have to cool to for its water vapour to start turning into droplets: dew forms on things that cold.">dew point</dfn>. The page’s numbers come from following the bubble’s temperature and water step by step, and they agree with that rule.</p>`
		},
		// ------------------------------------------------------------------ mountain
		{
			id: 'mountain',
			chapter: 'mountain',
			title: 'Pushed up a mountain',
			scene: 'mountain',
			hints: { phase: 'mountain' },
			duration: 24,
			controls: [along],
			body: `
<p>Air rises in another way too: wind can push it up a mountainside. Here the wind blows from the left towards a mountain 2,000 metres high, on a day of 20 °C with damp air (70 %).</p>
<p><strong>Blow the bubble over the mountain.</strong> On the way up the slope it cools about a degree every hundred metres, and at about 700 metres it turns white: a cloud forms on the side facing the wind. Higher still, its droplets grow and bump together into drops big enough to fall, and it <strong>rains on the slope</strong>.</p>
<p>The rain takes water away for good. The page keeps it simple: all the water that turns into droplets falls out as rain at once (real clouds keep some of their droplets, and it takes time for them to grow into raindrops). With that, by the top the bubble has lost about a quarter of the water it started with.</p>`,
			notes: `<p>Inside the cloud, the bubble cools only about half a degree for every hundred metres, because turning vapour into droplets gives off a little warmth. That is what makes the far side warm: watch it in the next step.</p>`
		},
		{
			id: 'far-side',
			chapter: 'mountain',
			title: 'Down the far side, warm and dry',
			scene: 'mountain',
			hints: { phase: 'far' },
			duration: 22,
			body: `
<p>Over the top, the wind pushes the bubble <strong>down</strong> the far side. Going down, it is squeezed by the air above it, and air that is squeezed warms up: about a degree for every hundred metres, all the way down. Its droplets have already fallen as rain, so as it sinks and warms it stays clear: there is no cloud on this side.</p>
<p>It arrives on the far plain at about <strong>26 °C</strong>, six degrees warmer than it started, and much drier: its humidity has dropped from 70 % to 36 %. It cooled slowly going up inside the cloud but warms quickly all the way down, and the rain it left behind can’t come back.</p>
<p>That is why the far side of a mountain range is often dry, with a warm, dry wind blowing down from the peaks. In the Alps it is called the föhn; in the Rocky Mountains, the chinook.</p>`
		},
		{
			id: 'next',
			chapter: 'mountain',
			title: 'Read next',
			scene: 'sky',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Rising air swells and cools, and a cloud appears at exactly the height where it gets cold enough for its water to turn into droplets. Every bubble from the same ground reaches that height at the same point, so the clouds have flat bottoms.</p>
<p>Water turning from vapour into liquid, and back, is a change of state, like ice melting. The page on <a href="../states-of-matter/">states of matter</a> shows what the molecules are doing when that happens. And the page on <a href="../atmosphere-weather/">the atmosphere and weather</a> zooms out from one bubble to the winds and weather of the whole planet.</p>`
		}
	]
};
