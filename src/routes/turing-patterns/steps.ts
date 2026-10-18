import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const ratio: Control = {
	type: 'range',
	id: 'ratio',
	label: 'Inhibitor’s diffusion ÷ activator’s, Dₕ/Dₐ',
	min: 1,
	max: 100,
	step: 1,
	default: 40,
	format: (v) => `${v}×`,
	help: 'The pattern carries on from where it is; a dish that has gone flat starts again from new noise.'
};

const spread: Control = {
	type: 'range',
	id: 'Da',
	label: 'Activator’s diffusion Dₐ (the inhibitor’s follows)',
	min: 0.25,
	max: 2.5,
	step: 0.25,
	default: 1,
	format: (v) => `${v.toFixed(2)} cells²/lifetime`
};

const kappa: Control = {
	type: 'range',
	id: 'kappa',
	label: 'Saturation of the activator’s self-making, κ',
	min: 0,
	max: 0.15,
	step: 0.01,
	default: 0.02,
	format: (v) => v.toFixed(2),
	help: 'Changing it starts the dish again.'
};

const restart: Control = { type: 'action', id: 'restart', label: 'Dish', action: 'New noise' };

const grow: Control = { type: 'action', id: 'regrow', label: 'Strip', action: 'Grow again' };

const tip: Control = {
	type: 'range',
	id: 'tip',
	label: 'Width of the tail',
	min: 2,
	max: 24,
	step: 2,
	default: 4,
	format: (v) => `${v} cells`,
	help: 'Changing it starts the animal again.'
};

/**
 * Scenes: `dish` (a 128 × 128 grid of cells from near-uniform noise, with a side panel; focus
 * 'loop' (the activator–inhibitor loop, equal diffusion, the ripple fading), 'onset' (the growth
 * rate of each wavelength against the diffusion ratio, the ripple growing or fading), 'spacing'
 * (predicted against measured spacing) or 'shapes' (saturation κ at a fixed ratio: spots to
 * stripes)), `evidence` (where a Turing-type mechanism is supported, mixed or contested),
 * `growth` (a strip that grows fivefold: the current strip and its history, peaks inserted) and
 * `tail` (a body that tapers into a tail of chosen width: spots in the body, bands in the tail).
 */
export const spec: ExplainerSpec = {
	slug: 'turing-patterns',
	title: 'Turing patterns',
	summary:
		'Two chemicals, an activator that makes more of itself and an inhibitor that spreads faster and suppresses it, turn a uniform field into spots or stripes. Raise the inhibitor’s diffusion past the critical ratio and watch noise crystallise at the wavelength linear stability predicts, saturate the activator to turn spots into stripes, grow the domain to insert new stripes, taper it into a tail to get bands, and see where nature is known to use the mechanism.',
	chapters: [
		{ id: 'idea', title: 'Diffusion that makes patterns' },
		{ id: 'shapes', title: 'Spots, stripes and nature' },
		{ id: 'geometry', title: 'Growing and narrowing' }
	],
	steps: [
		// ------------------------------------------------------------------ idea
		{
			id: 'loop',
			chapter: 'idea',
			title: 'An activator and its inhibitor',
			scene: 'dish',
			hints: { focus: 'loop', ratio: 1 },
			duration: 25,
			controls: [restart],
			body: `
<p>On a <a href="../morphogen-gradients/">morphogen gradient</a>, cells learn their position from a substance made at one end: the pattern is in the source. In 1952 Alan Turing asked whether a pattern could arise with no source at all, from tissue that starts out the same everywhere. His answer was two chemicals that react and diffuse.</p>
<p>Here they are, in the form Gierer and Meinhardt gave them in 1972. The <dfn data-def="A substance that speeds up its own production: the more there is, the faster more is made.">activator</dfn> makes more of itself, and it also makes the <dfn data-def="A substance, made by the activator, that slows the activator's production.">inhibitor</dfn>, which holds the activator back. Both are broken down all the time. Like a <a href="../reaction-rates-equilibrium/#equilibrium">reaction at equilibrium</a>, the pair settles at a steady level where making balances breakdown, and that level is stable: a little extra activator makes extra inhibitor, which brings it back.</p>
<p>The dish is 128 × 128 cells, started at that level with ±5 % random noise in the activator. Here both chemicals spread equally fast, and the noise fades: diffusion smooths it, and the reactions damp it.</p>`,
			notes: `<p>The equations, in units of the activator's lifetime and of one grid cell: ∂a/∂t = Dₐ∇²a + ρa²/(h(1 + κa²)) − μa + s and ∂h/∂t = Dₕ∇²h + ρa² − νh, with μ = 1, ν = 2 (the inhibitor is broken down twice as fast), ρ = 1, a small basal production s = 0.1 and a mild saturation κ = 0.02 (step 4). Without diffusion, the steady state is stable because the trace of the reactions' Jacobian is negative and its determinant positive: the inhibitor's quick breakdown outweighs the activator's self-making. The walls of the dish let nothing through. Numerics: reactions explicitly, diffusion implicitly along rows and then columns, with a time step of 0.1 lifetimes.</p>`
		},
		{
			id: 'onset',
			chapter: 'idea',
			title: 'Faster inhibitor, and the noise grows',
			scene: 'dish',
			hints: { focus: 'onset' },
			duration: 35,
			controls: [ratio, restart],
			body: `
<p>Turing's surprise was that <a href="../diffusion-osmosis/#counting">diffusion</a>, which evens things out, can make the even state unstable. Let the inhibitor spread faster than the activator. Where the noise left a little extra activator, it makes more of itself on the spot; the inhibitor it makes leaks away to the surroundings and holds the activator down there. <strong>Local activation, long-range inhibition</strong>: the bump grows, and the dip around it deepens.</p>
<p>The chart is the result of the <dfn data-def="Asking whether a small disturbance of a steady state grows or shrinks, by treating the equations as linear for small disturbances. Each ripple of one wavelength grows or decays at its own exponential rate.">linear stability</dfn> analysis: how fast a small ripple of each wavelength grows (above zero) or fades (below). For these reaction rates no ripple grows until the inhibitor diffuses about <strong>21 times</strong> faster than the activator, the critical ratio. Above it, a band of wavelengths grows, and the noise crystallises into spots.</p>
<p>Below the critical ratio, small ripples of the even state fade; just above, they grow slowly; far above, in a few lifetimes. The variation across the dish, plotted below the chart on a logarithmic scale, turns into a straight line up or down: exponential growth or decay, as the analysis says. The threshold is about small ripples only: a pattern that has already formed can survive when the ratio is lowered below it, so press <em>New noise</em> to test the onset from a nearly even dish.</p>`,
			notes: `<p>A ripple of wavenumber k (wavelength 2π/k) grows at the larger eigenvalue of J − k²·diag(Dₐ, Dₕ), where J is the reactions' Jacobian at the steady state (fₐ, fₕ; gₐ, gₕ). It can only become positive through the determinant, which requires d·fₐ + gₕ > 2√(d·det J), with d = Dₕ/Dₐ. The critical ratio d_c is where equality holds; it depends only on the reaction rates, not on Dₐ itself. For the plain Gierer–Meinhardt model (s = 0, κ = 0) it is (3 + 2√2)·ν/μ ≈ 5.8·ν/μ, about 11.7 here; the basal production and the saturation used on this page raise it to about 21. Real activator–inhibitor pairs reach a high effective ratio in other ways too: the inhibitor may be a small, freely diffusing molecule while the activator binds the matrix, or a cell may relay the signal. The page's numbers come from Murray, <i>Mathematical Biology II</i> (3rd edition, 2003), chapter 2, applied to these equations.</p>`
		},
		{
			id: 'spacing',
			chapter: 'idea',
			title: 'The spacing comes from the rates',
			scene: 'dish',
			hints: { focus: 'spacing' },
			duration: 35,
			controls: [ratio, spread, restart],
			body: `
<p>The spots are not placed at random distances: they settle at a spacing set by the chemistry. The fastest-growing ripple on the chart wins the race, and its wavelength is the pattern's period. With the inhibitor 40 times faster, it is about <strong>12.5 cells</strong>; the dish measures its own spacing from the pattern (the strongest wavelength in its spectrum) and comes within a few percent.</p>
<p>Make both chemicals spread faster, at the same ratio, and the whole pattern scales up: the spacing grows as √Dₐ, so four times the diffusion doubles it. The reaction rates set it too: faster reactions shorten it, because a molecule travels less far in its lifetime, the same √(D·τ) length as in a <a href="../morphogen-gradients/#shape">morphogen gradient</a>. Raising the ratio stretches it a little, as the inhibitor reaches further.</p>
<p>So a Turing pattern carries its own ruler, but no map: it fixes how far apart the spots are, not where any particular spot goes. Start again with new noise and the spots move; their spacing does not.</p>`,
			notes: `<p>Away from the threshold, the settled pattern's period need not equal the fastest-growing wavelength exactly: nonlinear effects let neighbouring wavelengths win, and a pattern can lock into one of several stable spacings. Here they agree within a few percent at the defaults. Spots are drawn in brown where the activator is high; the inhibitor (not drawn) is highest at the spots too and spreads in a broad halo around each, which is what keeps the next spot at a distance. The spacing is measured from the peak of the radially averaged power spectrum of the activator.</p>`
		},
		// ------------------------------------------------------------------ shapes
		{
			id: 'shapes',
			chapter: 'shapes',
			title: 'Spots, stripes, labyrinths',
			scene: 'dish',
			hints: { focus: 'shapes' },
			duration: 35,
			controls: [kappa],
			body: `
<p>The same pair of chemicals can make spots or stripes; which one depends on the reactions, not on any template. Meinhardt's version lets the activator's self-making <strong>saturate</strong>: past some level, more activator no longer speeds up its own production, so a peak cannot grow tall and narrow. It spreads sideways instead, along a ridge.</p>
<p>Slide κ, the saturation. With little or none, the activator gathers into isolated spots. Around κ = 0.06 spots start to join into short bars; by 0.1 and above, the high regions are long stripes that wind across the dish in a <strong>labyrinth</strong>, because each patch of the noise picks its own direction and the stripes meet where they can. The inhibitor is set 120 times faster here, so that every κ on the slider is above its critical ratio (which rises from 14 to 98 as κ goes up).</p>
<p>Turing patterns have been seen in a gel of reacting chemicals, not just in a computer: the chlorite–iodide–malonic acid reaction, with starch slowing the activator, made the first stationary ones (Castets and colleagues, 1990; Ouyang and Swinney, 1991), spots and stripes as here.</p>`,
			notes: `<p>Whether spots or stripes win is a nonlinear question: the linear analysis gives the same band of wavelengths for both. Near threshold, the quadratic terms of the reactions favour hexagonal spots, which saturation weakens until stripes are stable (Ermentrout, 1991). Straight, parallel stripes need an orienting cue, such as a growing edge or a gradient; from noise they form labyrinths. The dish counts a high patch as a stripe once it is longer than 1.2 wavelengths in some direction.</p>`
		},
		{
			id: 'nature',
			chapter: 'shapes',
			title: 'Where nature uses it, and where it may not',
			scene: 'evidence',
			duration: 40,
			body: `
<p>A pattern that looks like a Turing pattern is not evidence of one: spots and stripes also come from cells that move and sort, from mechanical buckling, or from a prepattern laid down earlier. The test is to find the two signals, show that one activates and the other inhibits at longer range, and change the spacing by changing them.</p>
<p><strong>Well supported:</strong> the spacing of the <strong>digits</strong> in a mouse paw, set by a BMP–SOX9–WNT network whose wavelength Hox genes tune (Sheth and colleagues, 2012; Raspopovic and colleagues, 2014), with gradients from the limb's edges orienting it; the spacing of <strong>hair follicles</strong>, by WNT and its inhibitor DKK (Sick and colleagues, 2006); the ridges of the mouse palate (Economou and colleagues, 2012); and <strong>feather buds</strong>, though there cell mechanics also helps to start them (Shyer and colleagues, 2017).</p>
<p><strong>Mixed:</strong> <strong>fish skin</strong>. Zebrafish stripes behave like a Turing pattern, but they come from pigment cells that touch, chase and kill each other, not from diffusing chemicals (Nakamasu and colleagues, 2009). <strong>Contested:</strong> <strong>zebra stripes</strong> and <strong>fingerprints</strong>. Turing-type models exist for zebras, but the signals have not been pinned down. For fingerprints, Glover and colleagues (2023) combined developmental observations, signalling experiments and modelling to support an EDAR–WNT–BMP Turing mechanism; mechanical buckling of the skin is an older rival hypothesis, and the case is recent and not yet settled.</p>`,
			notes: `<p>Sources: Turing, <i>Phil. Trans. R. Soc. B</i> 237:37 (1952); Gierer and Meinhardt, <i>Kybernetik</i> 12:30 (1972); Sheth et al., <i>Science</i> 338:1476 (2012); Raspopovic et al., <i>Science</i> 345:566 (2014); Sick et al., <i>Science</i> 314:1447 (2006); Economou et al., <i>Nature Genetics</i> 44:348 (2012); Shyer et al., <i>Science</i> 357:811 (2017); Nakamasu et al., <i>PNAS</i> 106:8429 (2009); Glover et al., <i>Cell</i> 186:940 (2023); Kücken and Newell, <i>J. Theor. Biol.</i> 235:71 (2005), for buckling; Kondo and Miura, <i>Science</i> 329:1616 (2010), for a review. "Turing-type" is used broadly: the digit network has three components, and in zebrafish the "diffusion" is replaced by cells' short- and long-range contacts. The digit pattern also shows how Turing patterns and <a href="../morphogen-gradients/">morphogen gradients</a> work together: the gradient tunes and orients what the Turing network lays down.</p>`
		},
		// ------------------------------------------------------------------ geometry
		{
			id: 'growth',
			chapter: 'geometry',
			title: 'A growing skin inserts new stripes',
			scene: 'growth',
			duration: 40,
			controls: [grow],
			body: `
<p>Because a Turing pattern keeps its own spacing, a tissue that grows must add to it. Here is a strip of skin that settles into stripes and then grows to five times its length. Top: the strip now, its stripes as bars; below it, its history, time running down, each row drawn at the strip's length then.</p>
<p>At first the stripes simply move apart as the skin stretches. When the gaps have stretched to about <strong>twice</strong> the natural spacing, the activator gets a foothold in the middle of each gap, where the inhibitor is lowest, and a new stripe appears there: in one gap after another over a short interval, so the count roughly doubles. The old stripes stay roughly where they were on the stretching skin.</p>
<p>Kondo and Asai (1995) saw this in the angelfish <i>Pomacanthus</i>: as the juvenile grows, new stripes appear between the old ones, keeping the spacing roughly constant, as a Turing model predicts. A fixed prepattern would just stretch. Whether the fish's mechanism is truly reaction–diffusion is still debated: growth plus cell movement can do the same (Painter, Maini and Othmer, 1999).</p>`,
			notes: `<p>The strip uses the same equations with no saturation (κ = 0) and Dₕ/Dₐ = 20, where the fastest-growing wavelength is about 11 cells; it grows exponentially from 40 to 200 cells over 600 activator lifetimes, after 60 lifetimes at its starting length. Uniform growth stretches the space between the grid points (so diffusion between neighbours weakens) and dilutes both chemicals (a −(L′/L)·c term). Insertion in the gaps is typical of activator–inhibitor models; in substrate-depletion models (and at stronger saturation) peaks tend to split instead.</p>`
		},
		{
			id: 'tail',
			chapter: 'geometry',
			title: 'A narrow tail turns spots into bands',
			scene: 'tail',
			duration: 40,
			controls: [tip],
			body: `
<p>The shape of the tissue also matters. Here the same chemicals run on a body that tapers into a tail. In the body there is room for ripples in every direction, and spots form. In a narrow tail, a ripple <em>across</em> it would need a wavelength shorter than the band that can grow: the longest uneven ripple that fits across a tail of width W has a wavelength of 2W, and the analysis says none grows once the tail is narrower than about <strong>4 cells</strong> here. Only ripples along the tail remain, so the spots become <strong>bands</strong> that ring it.</p>
<p>Widen the tail and the spots come back, first in a zigzag of half-spots along its edges, then fully. James Murray drew the conclusion in 1981: on such a model, a spotted animal can have a striped tail, but a striped animal cannot have a spotted one. Cheetahs and jaguars do have rings near the tips of their spotted tails.</p>
<p>That is a prediction of the model, not proof that the cheetah's or jaguar's tail markings are Turing patterns. In domestic cats, WNT signalling and its inhibitor DKK4 have been implicated in laying down the coat pattern in the embryo, before any pigment appears (Kaelin and colleagues, 2021), but the full mechanism remains unresolved.</p>`,
			notes: `<p>The domain is 240 × 64 cells: 64 columns of body, a smooth taper over the next 72, then a tail of constant width. Its walls let nothing through, so a ripple across a tail of width W must have a whole number of half-wavelengths in W: the first is cos(πy/W), with k = π/W. With Dₕ/Dₐ = 60, the band of growing ripples ends at k₂ ≈ 0.82 per cell, so none fits across a tail narrower than π/k₂ ≈ 3.8 cells. The fastest-growing wavelength here is about 13.6 cells. Murray's paper: <i>J. Theor. Biol.</i> 88:161 (1981); his summary for a general audience is "How the leopard gets its spots", <i>Scientific American</i> 258(3):80 (1988). Domestic cats: Kaelin et al., <i>Nature Communications</i> 12:5127 (2021). The tail's width moves in steps of two cells so that the drawn outline and the simulated rows match.</p>`
		}
	]
};
