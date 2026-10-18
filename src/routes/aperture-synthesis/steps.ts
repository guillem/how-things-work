import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { ITERATIONS } from './scenes/shared';
import { LAYOUT_NAMES, SKY_NAMES, type Layout, type SkyKind } from './sky';

/**
 * Scenes: `pair` (two dishes, a source drifting through their fringes, and the correlator's
 * output; `step.hints.mode` fringe or double) and `synth` (four panels: the map of dishes, the uv
 * plane, the dirty beam and the images; `step.hints.mode` picks which panels and what they show).
 * The array lives in the scene-owned param `dishes` (the two-dish steps use `pair`), set by the
 * `layout` select, by dragging dishes and by the add/remove buttons.
 */

const sky: Control = {
	type: 'select',
	id: 'sky',
	label: 'Sky',
	default: 'galaxy',
	options: (Object.keys(SKY_NAMES) as SkyKind[]).map((k) => ({ value: k, label: SKY_NAMES[k] }))
};
const hours: Control = {
	type: 'range',
	id: 'hours',
	label: 'Hours of tracking',
	min: 0,
	max: 12,
	step: 0.5,
	default: 6,
	format: (v) => (v === 0 ? 'a snapshot' : `${v} h`)
};
/** The same, greyed out while the Earth turns by itself. */
const hoursPlayed: Control = { ...hours, disabled: (p) => p.play === true };
const dec: Control = {
	type: 'range',
	id: 'dec',
	label: 'Declination of the source',
	min: -30,
	max: 90,
	step: 5,
	default: 40,
	format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`
};
const layout: Control = {
	type: 'select',
	id: 'layout',
	label: 'Start from',
	default: 'vla12',
	options: (Object.keys(LAYOUT_NAMES) as Layout[]).map((k) => ({
		value: k,
		label: LAYOUT_NAMES[k]
	}))
};
const size = (id: string, def: number): Control => ({
	type: 'range',
	id,
	label: 'Size of the array',
	min: 0.3,
	max: 1.3,
	step: 0.05,
	default: def,
	format: (v) => `× ${v.toFixed(2)}`
});

export const spec: ExplainerSpec = {
	slug: 'aperture-synthesis',
	title: 'Interferometry & aperture synthesis',
	summary:
		'An array of small radio dishes sees as sharply as one dish as wide as the array, because every pair of dishes measures one Fourier component of the sky. Place dishes on a map, let the Earth turn so each pair traces arcs in the uv plane, watch the dirty beam and the dirty image form, and clean it with Högbom’s CLEAN. Shrink the array to lose resolution; spread it to lose the extended emission.',
	chapters: [
		{ id: 'limit', title: 'The limit of one dish' },
		{ id: 'pair', title: 'Two dishes, one Fourier component' },
		{ id: 'uv', title: 'Filling the uv plane' },
		{ id: 'clean', title: 'The dirty image and CLEAN' },
		{ id: 'scales', title: 'What an array can and cannot see' }
	],
	steps: [
		// ---------------------------------------------------------------- limit
		{
			id: 'dish',
			chapter: 'limit',
			title: 'One dish: a blur λ/D wide',
			scene: 'synth',
			hints: { mode: 'dish' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'diameter',
					label: 'Diameter of the dish',
					min: 25,
					max: 1000,
					step: 25,
					default: 25,
					unit: ' m'
				},
				sky
			],
			body: `
<p>A radio dish focuses waves the way a lens focuses light (see <a href="../light-optics/#lens">Light and optics</a>), but at a wavelength a million times longer, and diffraction blurs every point of the sky into a spot about <strong>λ/D</strong> wide: the first dark ring of its <dfn data-def="The diffraction pattern of a circular aperture: a bright core ringed by faint rings. Its first dark ring lies 1.22 λ/D from the centre.">Airy pattern</dfn> lies at 1.22 λ/D.</p>
<p>Here the waves are the 21 cm line of hydrogen and the dish is one of the VLA’s, 25 m across: 1.22 × 0.21 m / 25 m = 0.010 radians, 35 arcminutes, wider than the full Moon and wider than the field drawn here. The radio galaxy in the middle is a single blob. Make the dish bigger: the blur shrinks as 1/D, and at 1 km it is under an arcminute and the galaxy’s lobes come apart.</p>
<p>Nobody can build a steerable 1 km dish. The second panel shows why one does not need to. Every pair of points on the dish’s surface is a <dfn data-def="A pair of receiving points and the vector between them. A pair separated by b, seen from a source, responds to sky structure of angular scale λ/b.">baseline</dfn>, and the dish adds up what all of them measure: the panel is the <dfn data-def="The plane of spatial frequencies (u, v) on the sky, in wavelengths: the components of a baseline, as seen from the source, divided by λ.">uv plane</dfn>, the list of baselines it contains, filled out to D/λ. The image is the sky blurred by the inverse Fourier transform of that panel.</p>`,
			notes: `<p>Strictly, the blur is the dish’s power pattern, the square of the Fourier transform of the field across its aperture; the uv panel is the autocorrelation of the aperture, the number of pairs of surface points separated by each spacing, which falls from the centre to zero at D/λ. The page works at one wavelength and treats the sky as a flat 32′ patch; the 25 m dishes’ own beam (their <dfn data-def="The single dish's sensitivity pattern on the sky, which limits the field an array can image. For a 25 m dish at 21 cm it is about 30′ wide.">primary beam</dfn>) is about as wide as that patch, and the page ignores the fall in sensitivity towards its edge.</p>`
		},
		// ---------------------------------------------------------------- pair
		{
			id: 'fringe',
			chapter: 'pair',
			title: 'Two dishes see the sky through stripes',
			scene: 'pair',
			hints: { mode: 'fringe' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'baseline',
					label: 'Distance between the dishes',
					min: 50,
					max: 600,
					step: 10,
					default: 200,
					unit: ' m'
				}
			],
			body: `
<p>Now take just two dishes, b apart, and point both at a source. Its wavefront reaches one dish a little after the other, a delay of b sin θ / c, so the two signals arrive with a phase difference of 2π b sin θ / λ. A <dfn data-def="The electronics that multiplies the signals of two dishes and averages the product. Its output is high when the signals arrive in phase and low when they arrive in antiphase.">correlator</dfn> multiplies the two signals and averages the product: it gives a positive output when they arrive in phase and a negative one in antiphase.</p>
<p>So the pair’s view of the sky is a set of <strong>stripes</strong>, <dfn data-def="The interference pattern of a two-element interferometer on the sky: alternate bands of positive and negative response, λ/b apart.">fringes</dfn> λ/b apart: 0.21 m / 200 m = 3.6′ here. As the Earth turns, the source drifts across them and the output swings up and down (bottom right), exactly as two sources make bright and dark bands in <a href="../waves-interference/#path-difference">a ripple tank</a>. Move the dishes apart and the stripes get finer.</p>
<p>A pair this far apart already tells where the source is to a fraction of 3.6′, much better than one dish’s 35′. It does not yet tell much else.</p>`,
			notes: `<p>Before the correlator the electronics adds a delay to the nearer dish to cancel the geometric delay towards the pointing centre (the <em>delay tracking</em>), and stops the fringes rotating as the source moves (<em>fringe stopping</em>). What is left is the slow change of phase across the field that the page draws. A real correlator also forms the product with one signal shifted by a quarter period, giving the sine fringes too: the pair of outputs is one complex number.</p>`
		},
		{
			id: 'double',
			chapter: 'pair',
			title: 'The fringes measure one Fourier component',
			scene: 'pair',
			hints: { mode: 'double' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'baseline',
					label: 'Distance between the dishes',
					min: 50,
					max: 600,
					step: 10,
					default: 200,
					unit: ' m'
				},
				{
					type: 'range',
					id: 'separation',
					label: 'Separation of the double',
					min: 1,
					max: 6,
					step: 0.25,
					default: 3,
					unit: '′'
				}
			],
			body: `
<p>Give the sky two equal sources, 3′ apart. Each makes its own fringes, and the output is their sum. On most baselines they add up to a swing smaller than for one source; at b = λ/(2 × 3′) = <strong>120 m</strong> one source sits on a bright stripe while the other sits on a dark one, and the swing vanishes. Set the baseline to 120 m and the output stays flat, although both sources are there.</p>
<p>The height and position of the swing make one complex number, the <dfn data-def="The complex output of a pair of dishes: the amplitude and phase of the fringes. It equals the sky's 2-D Fourier transform at the pair's (u, v).">visibility</dfn> V = Σ F e<sup>−2πi u l</sup>, with u = b/λ in wavelengths and l each source’s position. That is the sky’s <a href="../fourier-transform/#spectrum">Fourier transform</a> at the spatial frequency u. The curve on the right is |V| for every baseline: one pair of dishes reads one point of it.</p>
<p>The rest of the page follows from this. A pair of dishes does not take a picture; it measures the strength and phase of one wave pattern in the sky. To make an image, measure many.</p>`,
			notes: `<p>This is the van Cittert–Zernike theorem: for an incoherent source the correlation of the fields at two points depends only on their separation, and equals the Fourier transform of the sky’s brightness. Michelson used exactly this in 1920, with two mirrors on a beam on the Mount Wilson 100-inch telescope, to measure the diameter of Betelgeuse from the baseline at which its fringes disappeared.</p>`
		},
		// ---------------------------------------------------------------- uv
		{
			id: 'snapshot',
			chapter: 'uv',
			title: 'One pair: one point and its mirror',
			scene: 'synth',
			hints: { mode: 'pair', hours: 0 },
			duration: 25,
			controls: [sky],
			body: `
<p>In two dimensions a baseline, as seen from the source, has two components, u east and v north, in wavelengths. This pair sits 400 m apart, east–west, so it samples the sky’s Fourier transform at u = 400 / 0.21 = 1,900 wavelengths, v = 0. The sky is real, so its transform at (−u, −v) is the complex conjugate: every pair gives a point <strong>and its mirror image</strong>.</p>
<p>The third panel is the <dfn data-def="The response of the array to a single point source: the inverse Fourier transform of the uv points it has sampled. Every source in the dirty image appears convolved with it.">dirty beam</dfn>, the inverse transform of those two points: plain stripes, 1.8′ apart. The image (right) is the sky convolved with it, and two dishes see <strong>only stripes</strong>.</p>
<p>Drag either dish on the map. The uv points follow the baseline: longer means finer stripes, turning it turns them.</p>`,
			notes: `<p>The map’s north is up and east right; the sky images follow the astronomers’ convention, north up and east to the <em>left</em>, as it appears looking up. The uv plane is drawn with u to the right. The page grids each sample to the nearest cell of a 128 × 128 grid, 1/32′ apart in u and v (107 wavelengths, or 22.6 m of baseline at 21 cm), and shows an FFT of it; real imaging software grids with a smooth kernel to suppress aliasing.</p>`
		},
		{
			id: 'rotation',
			chapter: 'uv',
			title: 'The Earth turns, and each pair traces an ellipse',
			scene: 'synth',
			hints: { mode: 'pair' },
			duration: 30,
			controls: [
				hoursPlayed,
				{
					type: 'toggle',
					id: 'play',
					label: 'Turn the Earth',
					default: false,
					help: 'One hour of the Earth’s turn every second.'
				},
				dec,
				sky
			],
			body: `
<p>As the Earth turns, the source’s hour angle H changes, and the baseline seen from it turns and shortens. Each pair traces part of an <strong>ellipse</strong> in the uv plane (and its mirror). For an east–west pair, u = (b/λ) cos H and v = (b/λ) sin δ sin H: an ellipse with axes b/λ and (b/λ) sin δ, where δ is the source’s declination. At δ = +40° it is 0.64 times as tall as it is wide; at the celestial pole it is a circle, and on the celestial equator it flattens to a line.</p>
<p>Track the source for longer, or turn the Earth, and the stripes of the dirty beam start to bend into a pattern of rings. This is <dfn data-def="Using the Earth's rotation to change the baselines' orientation and length as seen from the source, so that a fixed array samples many points of the uv plane. Ryle and Hewish received the 1974 Nobel Prize for it.">Earth-rotation synthesis</dfn>, Martin Ryle’s idea: the array does not move, the sky does.</p>
<p>The VLA stands at 34° N and its dishes don’t point below 8° above the horizon, so a source at −30° is up for only about seven hours, low in the south, and its arcs are short. Drag the dishes north–south and the ellipse is no longer centred: a north–south baseline’s ellipse is shifted along v.</p>`,
			notes: `<p>The general formula (Thompson, Moran & Swenson, eq. 4.3): with the baseline in equatorial components (X, Y in the equatorial plane, Z towards the pole), u² + ((v − (Z/λ) cos δ) / sin δ)² = (X² + Y²) / λ². Every track is an ellipse with axis ratio sin δ; only its centre depends on the baseline’s north–south component. The page ignores the third component w, the baseline along the line of sight, which matters only for fields much wider than this one.</p>`
		},
		{
			id: 'array',
			chapter: 'uv',
			title: 'A dozen dishes over six hours see the source',
			scene: 'synth',
			hints: { mode: 'array' },
			duration: 30,
			controls: [layout, hours, dec, sky],
			body: `
<p>Twelve dishes make 12 × 11 / 2 = <strong>66 pairs</strong>, and every pair traces its own arcs. These twelve stand on the real pads of the VLA in New Mexico, four on each arm of its Y. In a snapshot the 132 uv points already make a dirty beam with a central peak; over six hours the arcs fill the uv plane and the dirty image shows the radio galaxy: core, jets and lobes.</p>
<p>The central peak of the dirty beam is about 37″ wide, the blur of a single dish about <strong>1 km</strong> across, the length of the longest baseline. That is the takeaway of the whole page: the array sees as sharply as a dish as wide as itself, because what it measures is the sky’s Fourier transform, out to the longest baseline, and the Earth’s rotation fills in the gaps.</p>
<p>Try the other starting points: all 27 dishes of the VLA’s compact D configuration (351 pairs), eight dishes in an east–west line like the Westerbork array, or a random scatter. You can drag any dish.</p>`,
			notes: `<p>Each sampled cell of the uv plane counts once, whatever the number of samples in it: <dfn data-def="Weighting every sampled uv cell equally, which sharpens the beam and lowers its sidelobes at some cost in noise. Natural weighting gives every sample equal weight instead.">uniform weighting</dfn>. Weighting each sample equally (natural weighting) would favour the crowded short spacings, for a fatter beam with less noise. The VLA moves its dishes on railway tracks between four configurations; D, drawn here, has a longest baseline of 1.03 km, A of 36 km. The equally spaced line gives the beam rings of sidelobes 144 m / λ apart in u: <dfn data-def="Sidelobes of a regularly spaced array, from the gaps of its uv coverage repeating at the spacing.">grating rings</dfn> 5′ from the centre.</p>`
		},
		{
			id: 'build',
			chapter: 'uv',
			title: 'Build your own array',
			scene: 'synth',
			hints: { mode: 'build' },
			duration: 40,
			controls: [
				{ type: 'action', id: 'add', label: 'Dishes', action: 'Add a dish' },
				{ type: 'action', id: 'remove', label: 'Dishes', action: 'Remove the last dish' },
				layout,
				hours,
				dec,
				sky
			],
			body: `
<p>Click on the map to put down a dish (or use the button), drag dishes about, and watch the uv coverage, the beam and the image respond. A few things to try:</p>
<ul>
<li>Put all the dishes close together: the beam fattens, the image blurs.</li>
<li>Put them all in a line: the beam is long and thin, sharp across the line, blunt along it.</li>
<li>Space them regularly: the same baselines repeat, and the gaps between them make rings of sidelobes.</li>
<li>Spread them unevenly, with short and long spacings and many directions: that is why the VLA’s arms follow a power law, each pad farther out than the last.</li>
</ul>`,
			notes: `<p>Real array design trades these off against the land, cables and roads: an ideal array has no two baselines alike (no redundancy) and covers the uv plane evenly for the sources it will observe. ALMA, in Chile, has 66 dishes that can be spread over 16 km; the SKA will spread thousands over hundreds of kilometres.</p>`
		},
		// ---------------------------------------------------------------- clean
		{
			id: 'dirty',
			chapter: 'clean',
			title: 'The dirty image is not a photograph',
			scene: 'synth',
			hints: { mode: 'dirty' },
			duration: 25,
			controls: [sky],
			body: `
<p>Compare the <dfn data-def="The inverse Fourier transform of the sampled visibilities: the true sky convolved with the dirty beam.">dirty image</dfn> with the true sky (right). The dirty image is the sky <strong>convolved with the dirty beam</strong>, so each source carries the beam’s sidelobes with it, and where the uv plane has gaps the image has ripples that are not in the sky.</p>
<p>Worse, the centre of the uv plane, the zero spacing, is never measured: two dishes cannot stand closer than their own diameter. The zero spacing is the sky’s total flux, so the dirty image adds up to <strong>exactly zero</strong>: around every bright source it digs a negative bowl that has no counterpart in the sky.</p>
<p>So the dirty image is not a picture of the sky but a picture of what was sampled. To recover the sky one must guess what lies in the gaps, and the guess needs an assumption about what skies look like.</p>`,
			notes: `<p>The missing information cannot be measured afterwards: many different skies give the same samples, because adding anything whose transform is zero on every sampled cell leaves them unchanged. Deconvolution chooses one of those skies by a prior: CLEAN assumes the sky is a few points; the maximum entropy method, the smoothest positive sky; modern methods, sparsity in some basis. A single-dish map, which does measure the short spacings, can be combined with the array’s data to restore the total flux.</p>`
		},
		{
			id: 'clean',
			chapter: 'clean',
			title: 'CLEAN: subtract the beam from the brightest point',
			scene: 'synth',
			hints: { mode: 'clean' },
			duration: 40,
			controls: [
				{
					type: 'range',
					id: 'cleanStep',
					label: 'CLEAN iterations',
					min: 0,
					max: ITERATIONS.length - 1,
					step: 1,
					default: 0,
					format: (v) => String(ITERATIONS[Math.round(v)] ?? 0),
					disabled: (p) => p.cleanPlay === true
				},
				{
					type: 'toggle',
					id: 'cleanPlay',
					label: 'Run CLEAN',
					default: false,
					help: 'Shows the iterations one by one at first, then faster.'
				},
				sky
			],
			body: `
<p>Jan Högbom’s <dfn data-def="A deconvolution algorithm (Högbom, 1974): repeatedly find the brightest pixel of the residual image, subtract a fraction of the dirty beam centred there, and record a point component.">CLEAN</dfn> (1974) assumes the sky is a collection of points. It finds the brightest pixel of the dirty image, takes a tenth of it (the <em>loop gain</em>) as a point source, subtracts the dirty beam scaled to that flux and centred there, sidelobes and all, and repeats on what is left, the <strong>residual</strong>.</p>
<p>Step through it. After a few iterations the brightest sidelobes have gone with the peaks that made them; after a few hundred the residual is a faint mottle, and the components (marked on the residual) hold the flux of the sources.</p>
<p>The final, <dfn data-def="The CLEAN components convolved with the clean beam, a Gaussian the size of the dirty beam's main lobe, with the residual added back.">restored image</dfn> lays a smooth Gaussian, the size of the dirty beam’s central peak, on every component and adds back the residual. Compare it with the truth: the sidelobes and bowls are gone, and the resolution is still the array’s.</p>`,
			notes: `<p>CLEAN is a greedy algorithm: it is the matching pursuit of signal processing, fitting one beam at a time. It works best on skies of points, and on smooth emission it needs thousands of components and can leave stripes. The clean beam is fitted to the curvature of the dirty beam’s peak; its width is the resolution quoted for the image. Real CLEANs search only a chosen window, stop at a few times the noise, and work in cycles that subtract the components from the measured visibilities, not the gridded image (Clark and Cotton–Schwab CLEAN).</p>`
		},
		// ---------------------------------------------------------------- scales
		{
			id: 'shrink',
			chapter: 'scales',
			title: 'Shrink the array, lose the resolution',
			scene: 'synth',
			hints: { mode: 'size', sky: 'double', sizeParam: 'shrink' },
			duration: 25,
			controls: [size('shrink', 0.3)],
			body: `
<p>The sky is now a close double, two equal points 1.5′ apart. Every dish’s distance from the centre of the Y is multiplied by the slider. At 0.3 the longest baseline is 310 m and the beam 1.9′ wide: the double is <strong>one blob</strong>. Spread the array and the beam narrows as 1 / B<sub>max</sub>; past about × 0.45 the two points come apart.</p>
<p>Resolution comes from the <strong>longest</strong> baselines, the outer edge of the uv coverage.</p>`,
			notes: `<p>At × 0.3 the inner pads stand 30 m apart, barely more than a dish’s 25 m: a real array cannot be more compact than its dishes, and at such spacings they also shadow each other at low elevation.</p>`
		},
		{
			id: 'spread',
			chapter: 'scales',
			title: 'Spread the array, lose the extended emission',
			scene: 'synth',
			hints: { mode: 'size', sky: 'disc', sizeParam: 'spread' },
			duration: 25,
			controls: [size('spread', 1.25)],
			body: `
<p>Now the sky is a smooth disc 6′ across, like a supernova remnant, beside a point. Spread out, the twelve dishes’ shortest spacing is 125 m, and nothing larger than about λ/b<sub>min</sub> = 5.8′ is measured. The point is sharp, but the disc is <strong>almost gone</strong>: only its edges remain, with negative bowls around them. Shrink the array and the disc returns, blurred.</p>
<p>Extended emission lives near the centre of the uv plane, so the largest structure an array can see comes from its <strong>shortest</strong> baselines. No array sees every scale: radio astronomers observe the same field with several configurations, and with a single dish for the total flux.</p>`,
			notes: `<p>The readout compares the dirty image at the disc’s centre with the true sky blurred to the same resolution. NRAO quotes the largest angular scale of the VLA’s D configuration at 21 cm as 16′; the twelve-dish Y, missing the innermost pads, keeps much less.</p>`
		},
		{
			id: 'area',
			chapter: 'scales',
			title: 'The resolution of a big dish, not its collecting area',
			scene: 'synth',
			hints: { mode: 'area' },
			duration: 25,
			controls: [layout],
			body: `
<p>An array is <strong>not</strong> a big dish. It has the resolution of a dish as wide as itself, but only the collecting area of its own dishes. The twelve VLA dishes add up to 5,900 m², 0.7% of the 1 km dish they mimic in sharpness (dashed on the map). Faint sources need collecting area: for the same signal-to-noise ratio, time grows as the inverse square of the area, so the 1 km dish would reach in one minute what the array reaches in 14 days.</p>
<p>The array also measures only its uv tracks, and the big dish fills its whole disc (outlined in the uv plane): the gaps are what CLEAN has to guess.</p>
<p>The limit is set by the Earth itself: the <a href="../black-holes/#shadow">Event Horizon Telescope</a> links dishes on several continents and observes at 1.3 mm, so its longest baselines are 10,000 km, about 8 billion wavelengths, and its beam is some 25 micro-arcseconds. That made the image of the shadow of M87’s black hole.</p>`,
			notes: `<p>For a point source, the signal-to-noise ratio of an image grows as A √(N(N−1) Δν t) / T<sub>sys</sub> for N dishes of area A: the array as a whole collects like a single dish of area N A. The EHT’s dishes are too far apart to share cables or even clocks: each records its signal with an atomic clock’s timing on disks, and the correlation is done months later. Its uv coverage is sparse, so its images rely heavily on the assumptions of the imaging, and several independent methods were compared before the M87 image was published in 2019.</p>`
		}
	]
};
