import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Flow speed on a log scale: the control holds log₁₀(u / (mm/s)). */
const logu: Control = {
	type: 'range',
	id: 'logu',
	label: 'Flow speed',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0,
	format: (v) => `${Number((10 ** v).toPrecision(2))} mm/s`,
	help: 'How fast the liquid moves along the column.'
};

const length: Control = {
	type: 'range',
	id: 'L',
	label: 'Column length',
	min: 25,
	max: 250,
	step: 25,
	default: 50,
	format: (v) => `${v} mm`
};

const dp: Control = {
	type: 'select',
	id: 'dp',
	label: 'Particle size',
	default: '5',
	options: [
		{ value: '10', label: '10 µm' },
		{ value: '5', label: '5 µm' },
		{ value: '3', label: '3 µm' },
		{ value: '2', label: '2 µm' }
	]
};

const k2: Control = {
	type: 'range',
	id: 'k2',
	label: 'Stickiness of compound 2 (k′)',
	min: 0.5,
	max: 4,
	step: 0.1,
	default: 2,
	format: (v) => v.toFixed(1),
	help: 'Compound 1 stays at k′ = 1.8.'
};

const surface: Control = {
	type: 'select',
	id: 'surface',
	label: 'Surface',
	default: 'sticky',
	options: [
		{ value: 'even', label: 'Even, fast exchange' },
		{ value: 'sticky', label: 'A few very sticky sites' },
		{ value: 'slow', label: 'Slow exchange, few hops' }
	]
};

/**
 * Scenes: `column` (the column, the moving bands and the detector's chromatogram), `hops` (a
 * close-up of a few molecules hopping on and off the surface) and `curve` (the plate height
 * measured at many flow speeds: the van Deemter curve).
 * Column hints: `focus` 'inject' | 'retention' | 'spread' | 'length' | 'tailing'.
 * Curve hints: `focus` 'terms' | 'best'.
 * A scene reads a control only on the steps that offer it, and the defaults elsewhere.
 */
export const spec: ExplainerSpec = {
	slug: 'chromatography',
	title: 'Chromatography: separating by stickiness',
	summary:
		'Inject a mixture into a column and watch each molecule hop between the moving liquid and the packing; the bands separate and spread, a detector draws the peaks, and the measured plate height traces the van Deemter curve with its best flow speed.',
	chapters: [
		{ id: 'separate', title: 'Separating by stickiness' },
		{ id: 'spread', title: 'Why bands spread' },
		{ id: 'better', title: 'Better separations, real peaks' }
	],
	steps: [
		// ------------------------------------------------------------------ separate
		{
			id: 'inject',
			chapter: 'separate',
			title: 'A mixture goes in, peaks come out',
			scene: 'column',
			hints: { focus: 'inject' },
			duration: 24,
			body: `
<p>A <dfn data-def="A tube packed with tiny porous particles. A liquid (the mobile phase) is pumped through it; the coating inside the particles' pores is the stationary phase.">column</dfn> is a steel tube, here 50 mm long, packed with porous particles 5 µm across. A liquid, the <dfn data-def="The liquid (or gas) that flows through the column and carries the molecules along.">mobile phase</dfn>, is pumped through it at 1 mm/s. The particles' pores are lined with a coating, the <dfn data-def="The material fixed inside the column that molecules stick to for a while: here an oily coating on the particles.">stationary phase</dfn>, that molecules can stick to for a moment.</p>
<p>Inject a tiny plug of a mixture at the left: two compounds, <strong>1</strong> and <strong>2</strong>, plus a <strong>marker</strong> that never sticks. They enter together, but come out at different times. A <dfn data-def="An instrument at the column's outlet that measures how much compound is in the liquid flowing past, for example by its absorption of ultraviolet light.">detector</dfn> at the outlet draws the signal against time: a <dfn data-def="The detector's signal against time: one peak per compound.">chromatogram</dfn>, one peak per compound.</p>
<p>Compounds 1 and 2 are the same size. The packing is not a sieve: they come apart because compound 2 sticks to the coating a little more than compound 1 does.</p>`,
			notes: `<p>This is high-performance liquid chromatography (HPLC), the workhorse of drug, food and environmental analysis. Gas chromatography works the same way with a gas as the mobile phase. A flow speed of 1 mm/s is about 0.6 mL/min through a column 4.6 mm wide. The compounds are generic: their stickiness and the column's constants are typical values, not those of named substances. One kind of chromatography does sort by size, <dfn data-def="Size-exclusion (gel permeation) chromatography: small molecules wander into the pores and take longer; large ones are shut out and come out first. Used to measure the size of polymers and proteins.">size-exclusion chromatography</dfn>; this page is about the usual kind, which sorts by sticking.</p>`
		},
		{
			id: 'hops',
			chapter: 'separate',
			title: 'Each molecule hops between two phases',
			scene: 'hops',
			duration: 26,
			controls: [k2],
			body: `
<p>Zoom in on a few molecules, slowed down 1000 times. Each one is either carried along by the liquid or stuck to the coating, where it doesn't move at all. It sticks at random moments and comes unstuck at random moments: each stay lasts a random, <dfn data-def="Stays whose length has no memory: a molecule that has already been stuck a while is no more likely to come off in the next instant. Short stays are the most common; long ones are rare.">exponentially distributed</dfn> time, a few milliseconds on average.</p>
<p>Sticking and unsticking are a reversible process with a rate in each direction, like a reaction at <a href="../reaction-rates-equilibrium/#equilibrium">equilibrium</a>. Their balance sets the <dfn data-def="k′ = time a molecule spends stuck ÷ time it spends moving; also the ratio of molecules in the stationary phase to those in the mobile phase at any moment.">retention factor</dfn> <strong>k′</strong>: how much longer a molecule spends stuck than moving. Compound 1 has k′ = 1.8 and compound 2 k′ = 2.0, so each moves only 1/(1 + k′) of the time: 36 % and 33 %.</p>
<p>The bars underneath show one molecule of each kind, moving or stuck. After a few hops the molecules are still all mixed up; a difference this small only shows after thousands of hops.</p>`,
			notes: `<p>If a molecule sticks at a rate k<sub>a</sub> while moving and comes off at a rate k<sub>d</sub> while stuck, the numbers on each side settle where k<sub>a</sub>·(moving) = k<sub>d</sub>·(stuck), so k′ = k<sub>a</sub>/k<sub>d</sub>. In terms of concentrations, k′ = K·V<sub>s</sub>/V<sub>m</sub>: the <dfn data-def="The equilibrium constant of the compound between the two phases: its concentration in the stationary phase over its concentration in the mobile phase.">distribution constant</dfn> K times the volume ratio of the two phases. Modelling the stays as random, exponential and independent is the stochastic model of J. Calvin Giddings and Henry Eyring (1955).</p>`
		},
		{
			id: 'retention',
			chapter: 'separate',
			title: 'Retention time: t_R = t_M (1 + k′)',
			scene: 'column',
			hints: { focus: 'retention' },
			duration: 26,
			controls: [k2],
			body: `
<p>A molecule moves only while it is not stuck, and while it moves it goes at the speed of the liquid. So it takes the same time to cross the column as the marker, t<sub>M</sub> = 50 s, <em>plus</em> all its stays on the surface, k′ times as long:</p>
<p class="formula"><strong>t<sub>R</sub> = t<sub>M</sub> (1 + k′)</strong></p>
<p>The <dfn data-def="The time from the injection to the top of a compound's peak.">retention time</dfn> of compound 1 is 50 × 2.8 = 140 s; of compound 2, 150 s. Read the other way, the chromatogram measures stickiness: k′ = (t<sub>R</sub> − t<sub>M</sub>)/t<sub>M</sub>. Make compound 2 stickier or less sticky and watch its peak move. Below k′ = 1.8 it comes out first.</p>`
		},
		// ------------------------------------------------------------------ spread
		{
			id: 'spread',
			chapter: 'spread',
			title: 'Many random hops make a bell curve',
			scene: 'column',
			hints: { focus: 'spread' },
			duration: 26,
			body: `
<p>No two molecules of compound 2 have the same luck. Each sticks about 32 000 times on its way through, and its time on the surface is the sum of all those random stays. By the <a href="../central-limit-theorem/#clt">central limit theorem</a>, a sum of many independent random pieces is close to a bell curve. So the band, and its peak, are close to Gaussian: the dashed curves are Gaussians with the same centre and width.</p>
<p>Spreads of independent pieces add, as variances: after a distance x the band's variance is σ² = H·x. The constant H is the <dfn data-def="H = σ²/L: how much variance a band gains per unit length of column. The smaller H, the narrower the peaks. Measured from a peak as H = L·σ_t²/t_R².">plate height</dfn>, the column's measure of quality; L/H is the <dfn data-def="N = L/H = (t_R/σ_t)², a column's efficiency: a peak's width relative to its retention time is 1/√N.">plate count</dfn> N. Here H ≈ 8 µm, so N ≈ 6400, and each peak's width σ is t<sub>R</sub>/√N, about 1.9 s.</p>
<p>The width grows only as the square root of the distance, while the distance between the bands grows in proportion to it. That is why a column separates at all.</p>`,
			notes: `<p>The name comes from distillation columns, which are made of real plates, each a step of equilibration (Martin and Synge, 1941). A chromatography column has no plates; H is just the length over which a band gains one unit of σ² per unit of H. This page injects an infinitely thin plug; a real injection and the tubing to the detector add their own width.</p>`
		},
		{
			id: 'terms',
			chapter: 'spread',
			title: 'Three ways a band spreads',
			scene: 'curve',
			hints: { focus: 'terms' },
			duration: 30,
			controls: [logu],
			body: `
<p>The simulation runs compound 2 through the column at eleven flow speeds and measures H from each peak (the dots). Three independent sources of spread add up to the <dfn data-def="H = A + B/u + C·u: the plate height against the flow speed u (van Deemter, Zuiderweg and Klinkenberg, 1956).">van Deemter equation</dfn>:</p>
<p class="formula"><strong>H = A + B/u + C·u</strong></p>
<p><strong>A, uneven paths.</strong> Through the packing some paths are longer than others. The spread depends on the distance travelled, not on the time, so it is a floor that the flow speed doesn't change.</p>
<p><strong>B/u, diffusion along the column.</strong> Molecules wander forwards and backwards while they travel. The slower the flow, the longer the trip, the more they wander.</p>
<p><strong>C·u, slow exchange.</strong> A molecule that happens to stay stuck a little longer falls behind its band, while the liquid carries the others on. The faster the flow, the further they get in that time.</p>`,
			notes: `<p>In this model A = 2λd<sub>p</sub> with λ = 0.5, B = 2γD<sub>m</sub> with D<sub>m</sub> = 10⁻⁹ m²/s (a small molecule in water) and γ = 0.7, and the exchange term C = 2k′/((1 + k′)² k<sub>d</sub>), which Giddings and Eyring derived from the random stays; a stay lasts about d<sub>p</sub>²/(8D<sub>m</sub>), 3 ms for 5 µm particles. The simulation is not told the equation: it only moves molecules, and the fitted curve comes out within a few per cent of these values. Real columns add a smaller C term from slow mixing in the liquid between particles.</p>`
		},
		{
			id: 'best',
			chapter: 'spread',
			title: 'The best flow speed',
			scene: 'curve',
			hints: { focus: 'best' },
			duration: 30,
			controls: [logu, dp],
			body: `
<p>Slide the flow speed and watch the peak on the right. Too slow and diffusion blurs the band; too fast and the molecules can't keep up with the exchange. In between, at u<sub>opt</sub> = √(B/C), H is smallest: about 1 mm/s and 8 µm here, less than two particle diameters.</p>
<p>Smaller particles help twice over. The paths through the packing are shorter, which lowers A, and the pores are shallower, so a molecule gets in and out faster, which lowers C. With 2 µm particles the best plate height drops to about 3 µm, and the curve stays low to much faster flows: the same separation, in less time.</p>`,
			notes: `<p>The price of small particles is pressure: pushing liquid through the packing takes a pressure that grows as u·L/d<sub>p</sub>². Columns with particles under 2 µm need pumps rated to 1000 bar or more (ultra-high-performance liquid chromatography). In gas chromatography, diffusion in a gas is 10 000 times faster, so the B term matters far more and the best speeds are tens of centimetres per second.</p>`
		},
		// ------------------------------------------------------------------ better
		{
			id: 'length',
			chapter: 'better',
			title: 'Longer columns, finer packing',
			scene: 'column',
			hints: { focus: 'length' },
			duration: 30,
			controls: [length, dp, logu],
			body: `
<p>How well two peaks are separated is their <dfn data-def="R_s = (t_R2 − t_R1) / (2(σ1 + σ2)): the gap between the peaks over the sum of their half-widths. At 1.5 they barely touch.">resolution</dfn>, the gap between them over the sum of their half-widths. At 1.5 they are cleanly apart.</p>
<p>Make the column four times longer: the gap grows four times, the widths only twice (√4), so the resolution doubles, from about 1.4 to 2.8. The run takes four times as long, though. Finer packing raises the plate count without a longer column, and the flow speed matters as before.</p>
<p class="formula"><strong>R<sub>s</sub> = (√N / 4) · (α − 1)/α · k′/(1 + k′)</strong></p>
<p>With α = 2.0/1.8 for the two compounds, √N is the only easy knob; the other way is to change the liquid or the coating so that α, the ratio of the two stickinesses, grows.</p>`,
			notes: `<p>The formula is the Purnell equation, with k′ of the later peak. Raising the plate count N is slow: doubling the resolution takes four times the plates. Changing the chemistry, the mobile phase's composition, the coating or the temperature, so that the two compounds stick more differently, is usually far more effective.</p>`
		},
		{
			id: 'tailing',
			chapter: 'better',
			title: 'Real peaks tail',
			scene: 'column',
			hints: { focus: 'tailing' },
			duration: 30,
			controls: [surface],
			body: `
<p>The bell curve depended on two things: each molecule makes many hops, and all the hops are alike. Real columns break both.</p>
<p><strong>A few very sticky sites.</strong> Some spots on the surface hold molecules far longer, for example bare silica that grips basic compounds. Here one sticking in 10 000 lands on one, for 2 s on average. A molecule meets only a few of them, so luck doesn't average out: the unlucky ones trail behind in a long <dfn data-def="A peak whose late side falls off more slowly than its early side: asymmetric, with positive skewness.">tail</dfn>.</p>
<p><strong>Slow exchange.</strong> A large molecule that stays stuck for seconds hops only about 16 times through the column. A sum of 16 random stays is still lopsided, so the peak is broad and skewed.</p>
<p>The <dfn data-def="A measure of a distribution's asymmetry: 0 for a symmetric peak, positive when the late side is drawn out.">skewness</dfn> readout measures it; the dashed Gaussians show what the peaks would look like if they were symmetric.</p>`,
			notes: `<p>Tailing is one of the commonest faults in practice. Besides strong sites it comes from overloading the column (the coating saturates, so the stickiness falls as the concentration rises) and from dead volumes in the tubing. Column makers fight strong sites by capping the leftover silanol groups; analysts add a competing base or work at low pH. That's the whole story: a column separates molecules by how long each spends stuck, and there is a best flow speed, set by diffusion on one side and slow exchange on the other.</p>`
		}
	]
};
