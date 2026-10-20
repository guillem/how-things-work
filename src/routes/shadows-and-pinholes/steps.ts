import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const toyAt: Control = {
	type: 'range',
	id: 'toy',
	label: 'Where the toy stands',
	min: 1.6,
	max: 3.6,
	step: 0.05,
	default: 2.2,
	format: (v) => `${v.toFixed(1)} m from the left`,
	help: 'Or drag the toy.'
};

const lampAt: Control = {
	type: 'range',
	id: 'lamp',
	label: 'Where the lamp stands',
	min: 0.2,
	max: 1.9,
	step: 0.05,
	default: 1.2,
	format: (v) => `${v.toFixed(1)} m from the left`,
	help: 'Or drag the lamp.'
};

const wallAt: Control = {
	type: 'range',
	id: 'wall',
	label: 'Where the wall is',
	min: 2.6,
	max: 5,
	step: 0.05,
	default: 4.2,
	format: (v) => `${v.toFixed(1)} m from the left`,
	help: 'Or drag the wall.'
};

const lampSize: Control = {
	type: 'range',
	id: 'size',
	label: 'Size of the glowing part',
	min: 0,
	max: 0.4,
	step: 0.01,
	default: 0.25,
	format: (v) => (v === 0 ? 'a tiny bulb' : `${Math.round(v * 100)} cm tall`)
};

const second: Control = {
	type: 'toggle',
	id: 'second',
	label: 'Second lamp',
	default: true
};

const hole: Control = {
	type: 'range',
	id: 'hole',
	label: 'Size of the pinhole',
	min: 0.5,
	max: 8,
	step: 0.5,
	default: 1,
	unit: 'mm',
	format: (v) => `${v} mm`
};

const lampOn: Control = {
	type: 'toggle',
	id: 'on',
	label: 'Lamp on',
	default: true
};

export const spec: ExplainerSpec = {
	slug: 'shadows-and-pinholes',
	title: 'Shadows & pinholes',
	summary:
		'Move a lamp, a toy and a wall about a room and watch the shadow grow and shrink, because light travels in straight lines. Make its edge soft with a wide lampshade, add a second lamp, and poke a pinhole in a box to see an upside-down picture of the lamp.',
	chapters: [
		{ id: 'shadows', title: 'Shadows' },
		{ id: 'more', title: 'Soft edges, two lamps, a pinhole' }
	],
	steps: [
		// ------------------------------------------------------------------ shadows
		{
			id: 'straight',
			chapter: 'shadows',
			title: 'Light goes in straight lines',
			scene: 'room',
			hints: { phase: 'straight' },
			duration: 18,
			controls: [toyAt],
			body: `
<p>A lamp sends light out in every direction, and each bit of light travels in a <strong>straight line</strong> until it hits something. The yellow lines show a few of those paths, from the lamp to the wall.</p>
<p>A toy stands in the way. The lines that hit the toy stop there. Behind it is a patch of wall that no line from the lamp can reach: that dark patch is the <strong>shadow</strong>. Slide the toy along and the shadow moves with it.</p>`
		},
		{
			id: 'lamp',
			chapter: 'shadows',
			title: 'Bring the lamp closer',
			scene: 'room',
			hints: { phase: 'lamp' },
			duration: 20,
			controls: [lampAt],
			body: `
<p>Move the lamp towards the toy. The lines from the lamp now spread out more steeply past the toy’s top and bottom, so the shadow on the wall gets <strong>bigger</strong>. Move the lamp away and the lines become nearly level, and the shadow shrinks back towards the toy’s own size.</p>
<p>The readout says how many times taller than the toy its shadow is. With the lamp 1 metre from the toy and the wall 2 metres behind the toy, the shadow is three times as tall.</p>`
		},
		{
			id: 'wall',
			chapter: 'shadows',
			title: 'Bring the wall closer',
			scene: 'room',
			hints: { phase: 'wall' },
			duration: 18,
			controls: [wallAt],
			body: `
<p>Now move the wall instead. The farther the wall is behind the toy, the more the lines spread before they reach it, and the bigger the shadow. Bring the wall right up behind the toy and the shadow is almost exactly the toy’s size.</p>
<p>So a shadow’s size is not fixed: it depends on where the lamp, the toy and the wall are. Follow the straight lines and you can always work it out.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'soft',
			chapter: 'more',
			title: 'Soft edges',
			scene: 'room',
			hints: { phase: 'soft' },
			duration: 20,
			controls: [lampSize],
			body: `
<p>A tiny bulb gives a shadow with a sharp edge. But most lamps are wider than that. Make the glowing part bigger, like a lampshade, and the edge of the shadow goes <strong>soft</strong>.</p>
<p>The reason is still straight lines. Near the edge, part of the lampshade is hidden behind the toy and part is not, so that bit of wall gets some light, but not all of it. Only in the middle of the shadow is the whole lampshade hidden. The bigger the lamp, the wider the soft edge.</p>`
		},
		{
			id: 'two',
			chapter: 'more',
			title: 'Two lamps, two shadows',
			scene: 'room',
			hints: { phase: 'two' },
			duration: 18,
			controls: [second],
			body: `
<p>Switch on a second lamp, a little higher than the first. Now there are <strong>two shadows</strong>, one for each lamp. Where only one lamp is hidden, the wall is half dark: it still gets light from the other lamp. Where the two shadows overlap, both lamps are hidden and the wall is darkest of all.</p>
<p>That is why a football player under stadium floodlights has several shadows at once.</p>`
		},
		{
			id: 'pinhole',
			chapter: 'more',
			title: 'A picture through a pinhole',
			scene: 'pinhole',
			hints: { phase: 'pinhole' },
			duration: 24,
			controls: [hole],
			body: `
<p>Poke a tiny hole in one end of a shoebox and look at the inside of the other end. A small picture of the lamp appears there, <strong>upside down</strong>. This is a pinhole camera.</p>
<p>Light from the top of the lamp goes through the hole in a straight line and carries on down to the bottom of the back wall. Light from the bottom of the lamp goes up to the top. So the picture is flipped.</p>
<p>Make the hole bigger: the picture gets brighter, because more light gets in, but blurrier, because each point of the lamp now makes a spot a little wider than the hole instead of a dot.</p>`
		},
		{
			id: 'nothrown',
			chapter: 'more',
			title: 'A shadow is missing light',
			scene: 'room',
			hints: { phase: 'nothrown' },
			duration: 18,
			controls: [lampOn],
			body: `
<p>It is easy to think a lamp throws a shadow onto the wall, as if the shadow were a thing. It isn’t. Switch the lamp off: the shadow vanishes, and so does all the light around it. A shadow is simply the place where the light <strong>doesn’t arrive</strong>.</p>
<p>The Moon’s phases are not a shadow either: the Moon is always half lit by the Sun, and we see different amounts of the lit half as it goes round us. Only during an eclipse does a shadow (the Earth’s, or the Moon’s) fall where you can see it.</p>`
		},
		{
			id: 'next',
			chapter: 'more',
			title: 'Read next',
			scene: 'room',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Light travels in straight lines, so a shadow is simply where the lines are blocked, and its size follows the lines back to the lamp.</p>
<p>Lines of light don’t only stop: lenses and water can bend them. The page on <a href="../light-optics/">light and optics</a> follows rays through lenses and prisms. And the page on the <a href="../sun-earth-moon/">Sun, Earth and Moon</a> shows the Moon’s phases and the shadows that make eclipses.</p>`
		}
	]
};
