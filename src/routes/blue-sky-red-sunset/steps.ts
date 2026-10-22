import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const clock = (h: number) => {
	const m = Math.round(h * 60);
	return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/** Plain name of a colour of light, by wavelength (nm). */
export const colourName = (nm: number) =>
	nm < 430
		? 'violet'
		: nm < 490
			? 'blue'
			: nm < 560
				? 'green'
				: nm < 590
					? 'yellow'
					: nm < 625
						? 'orange'
						: 'red';

const time: Control = {
	type: 'range',
	id: 'time',
	label: 'Time of day',
	min: 6,
	max: 18,
	step: 0.05,
	default: 12,
	format: clock,
	help: 'Sunrise is at 6:00 and sunset at 18:00.'
};

const colour: Control = {
	type: 'range',
	id: 'nm',
	label: 'Colour of the light',
	min: 400,
	max: 700,
	step: 5,
	default: 450,
	format: colourName
};

/** Smoke or haze, as its optical depth at 550 nm (see the model). */
export const smokeName = (v: number) =>
	v === 0 ? 'clean air' : v < 0.15 ? 'light haze' : v < 0.5 ? 'thick haze' : 'heavy smoke';

const smoke: Control = {
	type: 'range',
	id: 'smoke',
	label: 'Smoke or haze in the air',
	min: 0,
	max: 1,
	step: 0.05,
	default: 0,
	format: smokeName
};

/** The amount of air, relative to the Earth's. */
export const airName = (v: number) =>
	v === 0
		? 'no air at all, as on the Moon'
		: Math.abs(v - 1) < 0.01
			? 'the Earth’s air'
			: v < 1
				? `${Math.round(v * 100)}% of the Earth’s air`
				: `${(Math.round(v * 10) / 10).toLocaleString('en-GB')} times the Earth’s air`;

const air: Control = {
	type: 'range',
	id: 'air',
	label: 'How much air',
	min: 0,
	max: 3,
	step: 0.05,
	default: 1,
	format: airName
};

const eye: Control = {
	type: 'toggle',
	id: 'eye',
	label: 'Show how bright each colour looks to the eye',
	default: false
};

const scatter =
	'<dfn data-def="When light hits the tiny bits of air and bounces off in a new direction. Air scatters blue light far more than red.">scattering</dfn>';

export const spec: ExplainerSpec = {
	slug: 'blue-sky-red-sunset',
	title: 'Why the sky is blue & sunsets red',
	summary:
		'Scrub the Sun across a day’s sky and watch the sky overhead and the Sun’s own disc take their colours, worked out colour by colour from sunlight bouncing off air. Add smoke for a deeper sunset, pump the air away for a black sky around a white Sun, and find out why the sky isn’t violet.',
	chapters: [
		{ id: 'blue', title: 'The blue sky' },
		{ id: 'red', title: 'The red sunset' },
		{ id: 'more', title: 'Why not violet?' }
	],
	steps: [
		// ------------------------------------------------------------------ blue
		{
			id: 'look',
			chapter: 'blue',
			title: 'Look up',
			scene: 'sky',
			hints: { phase: 'look' },
			duration: 14,
			body: `
<p>On a clear day, look up: the sky is <strong>blue</strong>. Watch a sunset (never look straight at the Sun) and the setting Sun is <strong>orange or red</strong>. But the Sun sends us the same light all day. So where do the blue and the red come from?</p>
<p>The picture is a clear day in March or September, seen from somewhere 40° north of the equator, such as Madrid, New York or Beijing, looking south. It is noon, and the Sun is as high as it gets that day.</p>
<p>Every colour on this page is <strong>worked out</strong>, not picked: from the light the Sun sends, and from what air does to it.</p>`
		},
		{
			id: 'colours',
			chapter: 'blue',
			title: 'Sunlight is every colour',
			scene: 'spectrum',
			hints: { phase: 'sun' },
			duration: 16,
			body: `
<p>Sunlight looks white, but it is a mix of <strong>all the colours</strong> of the rainbow: violet, blue, green, yellow, orange and red. A prism or a rainbow pulls them apart.</p>
<p>The bars show how much of each colour the Sun sends, before any of it reaches the air. There is some of everything, a little less violet and red than green. Mixed together, as they arrive, they look white.</p>`,
			notes: `<p>The Sun’s light is drawn as that of a glowing body at the temperature of the Sun’s surface, about 5,500 °C. Real sunlight follows it closely, with thin dark lines where gases in the Sun soak up particular colours, and a little less violet still.</p>`
		},
		{
			id: 'bounce',
			chapter: 'blue',
			title: 'Air bounces blue light about',
			scene: 'beam',
			hints: { phase: 'bounce' },
			duration: 20,
			controls: [colour],
			body: `
<p>Air is made of tiny bits, far too small to see, that fly about with lots of empty space between them. Now and then a bit of light hits one and bounces off in a new direction. This is called ${scatter}.</p>
<p>Here is the surprise: the tiny bits of air bounce <strong>blue light far more than red</strong>. Change the colour of the light and watch how many bounce off. A bit of air bounces blue light about six times as readily as red, and violet even more.</p>
<p>Coming straight down through all the air above us, about 20 in every 100 bits of blue light get bounced off on the way, but only about 4 in 100 of red.</p>`,
			notes: `<p>Bits of air (molecules) are more than a thousand times smaller than the waves of light. For things that small, the shorter the wave, the more it is scattered, and quite steeply: halve the wavelength and the scattering goes up sixteen times. Blue light has shorter waves than red. Lord Rayleigh worked this out in 1871, which is why it is called Rayleigh scattering.</p>`
		},
		{
			id: 'sky',
			chapter: 'blue',
			title: 'The bounced blue is the sky',
			scene: 'sky',
			hints: { phase: 'sky' },
			duration: 18,
			body: `
<p>Sunlight streams through the air all the time, and all through the air the bits of air bounce some of it off, mostly the blue. Some of that bounced light comes down to your eyes, from <strong>every direction</strong> in the sky. That is the blue sky: sunlight that air has bounced towards you.</p>
<p>The rest of the sunlight comes straight on from the Sun. It has lost a little of its blue, so the Sun looks a touch yellow-white.</p>
<p>The sky is not blue because it reflects the sea: it is just as blue over a desert. And it is not the colour of a gas in the air either; it is the colour of bounced light.</p>`,
			notes: `<p>Near the horizon you look through much more air, and light of every colour gets bounced, so the sky there is paler, almost white. This page counts each bit of light bouncing once; in real air some bounces twice or more, which makes the sky a little paler still.</p>`
		},
		// ------------------------------------------------------------------ red
		{
			id: 'sunset',
			chapter: 'red',
			title: 'Sunset: a long way through the air',
			scene: 'sky',
			hints: { phase: 'sunset' },
			duration: 22,
			controls: [time],
			body: `
<p>Move the Sun through the day. When it is low, its light comes in sideways, and crosses far <strong>more air</strong> before it reaches you: at the horizon, about 38 times as much as from straight overhead.</p>
<p>Along that long road the air bounces away nearly all the blue, and much of the green. What is left to come straight on is mostly orange and red, so the Sun looks yellow and then a <strong>deep orange</strong>. Even of the red, only about a quarter gets through.</p>
<p>The sky above you darkens too: less light reaches it, and it has lost its blue on the way.</p>`,
			notes: `<p>With the Sun on the horizon this page’s sky overhead turns a dull grey. The real one stays a deeper blue, because the thin layer of ozone high up soaks up some of the orange and yellow of that long-travelled light (worked out by Edward Hulburt in 1953). In daytime that effect is small: the blue of the daytime sky comes from the bouncing.</p>`
		},
		{
			id: 'smoke',
			chapter: 'red',
			title: 'Smoke and haze',
			scene: 'sky',
			hints: { phase: 'smoke', time: 17.75 },
			duration: 18,
			controls: [smoke],
			body: `
<p>Now it is a quarter to six in the evening, and the Sun is low, just 3° above the horizon. Add smoke or haze to the air: tiny drops and specks, much bigger than the bits of air.</p>
<p>The low Sun turns a <strong>deeper orange, then red</strong>, and dimmer, because smoke takes away even more of its light, the blue most of all. But smoke and haze bounce all colours much more evenly than air does, so the sky at noon (the third circle) turns <strong>paler</strong>, from blue to milky white.</p>
<p>That is why sunsets after a big forest fire or a volcano can be so red.</p>`
		},
		{
			id: 'air',
			chapter: 'red',
			title: 'No air, no blue sky',
			scene: 'sky',
			hints: { phase: 'air', time: 17.75 },
			duration: 18,
			controls: [air],
			body: `
<p>Change how much air there is. Thicker air bounces away more of the low Sun’s light, so the sunset is redder, and the midday sky is a paler blue, because more of every colour gets bounced.</p>
<p>Now pump the air away altogether. Nothing is left to bounce the light, so the sky turns <strong>black</strong>, even with the Sun up, and the Sun is <strong>white</strong> all day. That is just what astronauts saw on the Moon, which has no air.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'violet',
			chapter: 'more',
			title: 'Why isn’t the sky violet?',
			scene: 'spectrum',
			hints: { phase: 'sky' },
			duration: 22,
			controls: [eye],
			body: `
<p>If air bounces violet even more than blue, why isn’t the sky violet? The bars show how much of each colour comes down from the sky overhead at noon. There <em>is</em> more violet than blue! The dotted line is plain white sunlight with the same amount of red: the sky has every colour, with extra blue and violet on top.</p>
<p>Two things tip it to blue. Sunlight carries a little less violet to begin with. And our eyes are much <strong>less sensitive</strong> to violet: switch on “how bright each colour looks” and the violet bars almost vanish. What is left is white light with extra blue in it, and that is the colour we call sky blue.</p>`
		},
		{
			id: 'next',
			chapter: 'more',
			title: 'Read next',
			scene: 'sky',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Air bounces blue light far more than red. The bounced blue comes at us from all over the sky, so the sky looks blue; and when the Sun is low, its light crosses so much air that only the orange and red get through, and the Sun turns orange.</p>
<p>The page on <a href="../light-optics/">light and optics</a> splits white light into its colours with a prism and follows rays as they bend. And the page on the <a href="../greenhouse-effect/">greenhouse effect</a> shows what air does to the Sun’s light and to the warmth the Earth sends back.</p>`
		}
	]
};
