import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Concentration for the Berg–Purcell step, on a log scale: the control holds log₁₀(c / µM). */
const conc: Control = {
	type: 'range',
	id: 'logc',
	label: 'Attractant concentration',
	min: -1,
	max: 2,
	step: 0.1,
	default: 0,
	format: (v) => `${Number((10 ** v).toPrecision(2))} µM`
};

const glen: Control = {
	type: 'range',
	id: 'glen',
	label: 'Gradient length',
	min: 0.2,
	max: 5,
	step: 0.1,
	default: 1,
	format: (v) => `${v.toFixed(1)} mm`,
	help: 'The distance over which the concentration changes by a factor e (about 2.7).'
};

const dose: Control = {
	type: 'range',
	id: 'dose',
	label: 'Flood the dish to',
	min: 25,
	max: 400,
	step: 5,
	default: 40,
	format: (v) => `${v} µM`,
	help: 'Starting from 20 µM of attractant everywhere.'
};

const tau: Control = {
	type: 'range',
	id: 'tau',
	label: 'Adaptation time',
	min: 1,
	max: 40,
	step: 1,
	default: 10,
	format: (v) => `${v} s`
};

const adapt: Control = {
	type: 'toggle',
	id: 'adapt',
	label: 'Methylation (adaptation)',
	default: true
};

const ramp: Control = {
	type: 'range',
	id: 'ramp',
	label: 'Concentration rising by',
	min: 0,
	max: 2,
	step: 0.1,
	default: 0.5,
	format: (v) => `${v.toFixed(1)} % per second`
};

const dropX: Control = {
	type: 'range',
	id: 'dropX',
	label: 'Drop: left–right',
	min: 200,
	max: 1600,
	step: 50,
	default: 1300,
	format: (v) => `${(v / 1000).toFixed(2)} mm`
};

const dropY: Control = {
	type: 'range',
	id: 'dropY',
	label: 'Drop: top–bottom',
	min: 150,
	max: 730,
	step: 10,
	default: 440,
	format: (v) => `${(v / 1000).toFixed(2)} mm`
};

const release: Control = {
	type: 'action',
	id: 'release',
	label: 'Cells',
	action: 'Release again'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Swimming speed',
	min: 5,
	max: 40,
	step: 1,
	default: 20,
	format: (v) => `${v} µm/s`
};

/**
 * Scenes: `swim` (a close-up of a few cells running and tumbling in a uniform liquid), `sense`
 * (the Berg–Purcell comparison: across the body or along a run), `trace` (a whole dish flooded
 * with attractant: the concentration, the receptors' activity and methylation, and the tumbles
 * counted over 1000 cells) and `dish` (300 cells released in a chamber with a drop of
 * attractant).
 * Trace hints: `focus` 'flood' | 'stairs' | 'ramp'. Dish hints: `focus` 'gather' | 'runs' |
 * 'tune' | 'off'.
 * A scene reads a control only on the steps that offer it, and the defaults elsewhere (the
 * drop's position, which the reader drags, holds on every dish step).
 */
export const spec: ExplainerSpec = {
	slug: 'bacterial-chemotaxis',
	title: 'Bacterial chemotaxis: climbing a gradient by memory',
	summary:
		'Release a few hundred E. coli by a drop of attractant: each runs, tumbles at random and runs again, and a receptor cluster with a slow methylation memory makes it tumble less while things improve. The swarm gathers at the drop without any cell knowing where it is.',
	chapters: [
		{ id: 'swim', title: 'Swimming without a sense of direction' },
		{ id: 'memory', title: 'A memory of a few seconds' },
		{ id: 'climb', title: 'Climbing the gradient' }
	],
	steps: [
		// ------------------------------------------------------------------ swim
		{
			id: 'run-tumble',
			chapter: 'swim',
			title: 'Run, tumble, run',
			scene: 'swim',
			duration: 24,
			body: `
<p>The gut bacterium <a href="../the-cell/#bacterium"><i>E. coli</i></a> swims with half a dozen <dfn data-def="Helical filaments about 20 nm thick and several µm long, each turned at its base by a rotary motor in the cell envelope, powered by protons flowing into the cell.">flagella</dfn>. When their motors all turn counter-clockwise (seen from behind), the filaments wrap into one bundle that pushes the cell along a nearly straight <strong>run</strong>, at about 20 µm/s: ten body lengths a second.</p>
<p>Every second or so, one or more motors reverse. The bundle flies apart and the cell <strong>tumbles</strong> in place for about a tenth of a second, then sets off on a new run in a new direction. The turn is random: 68° on average, a little more often forwards than backwards.</p>
<p>Even a run is not quite straight: water molecules jostle the cell, so it drifts off its heading by about 20° per second and loses it entirely in about 10 s. Run, tumble, run: a <dfn data-def="A path made of random steps. Over long times a random walker spreads like a diffusing molecule: its distance from the start grows only as the square root of the time.">random walk</dfn>.</p>`,
			notes: `<p>The numbers are those Howard Berg and Douglas Brown measured in 1972 by tracking single cells in three dimensions: runs of 0.86 s on average, tumbles of 0.14 s, a mean turn of 68° (mean cosine 0.33). The simulation draws each turn from p(cos θ) = (1 + cos θ)/2, which has that mean cosine and a mean angle of 67.5°. Run and tumble lengths are random and memoryless (exponentially distributed). Rotational diffusion D<sub>r</sub> = 0.062 rad²/s (Berg, <i>Random Walks in Biology</i>). Berg and Brown measured 14 µm/s; other strains and media give up to about 30 µm/s. Cells are drawn three times larger than life, and swim in three dimensions: the picture shows them from above.</p>`
		},
		{
			id: 'too-small',
			chapter: 'swim',
			title: 'Too small to compare front and back',
			scene: 'sense',
			duration: 28,
			controls: [conc, glen],
			body: `
<p>Why not just sense which side of the cell has more food and swim that way? Howard Berg and Edward Purcell worked out the answer in 1977: across a body this small, a shallow gradient makes a difference too small to tell from the noise of counting molecules.</p>
<p>A sensor counts molecules that happen to diffuse onto it, and counts are noisy. A sensor of radius a counting for a time T measures a concentration c (in molecules per volume) only to within a fraction of about 1/√(D·a·c·T), where D is the molecules' diffusion coefficient. With a = 1 µm, D = 1000 µm²/s and T = 1 s, that is ±0.13 % at 1 µM.</p>
<p>Across a 2 µm body, a gradient that changes by a factor e over 1 mm makes a difference of only 0.2 %: smaller than the noise of comparing two halves of the cell. But in one second of swimming the cell moves 20 µm, ten times its length, so comparing <em>now</em> with <em>a moment ago</em> sees a ten times bigger change, 2 %. Slide the concentration and the gradient: in steep gradients and at high concentrations the front-to-back comparison can work too, but the comparison along a run always wins by the run's length over the body's.</p>`,
			notes: `<p>Berg and Purcell, "Physics of chemoreception" (<i>Biophysical Journal</i>, 1977). The formula holds up to a factor of order one; the bars use D = 1000 µm²/s (a small molecule such as an amino acid in water), a = 1 µm, T = 1 s, and, for the spatial comparison, half the cell counting at each end. The cell can't help itself by counting for longer: within about 10 s rotational diffusion has turned it, and the two ends it was comparing point somewhere else. Larger cells, such as the amoeba <i>Dictyostelium</i> (10–20 µm) and our own white blood cells, do compare across their bodies.</p>`
		},
		// ------------------------------------------------------------------ memory
		{
			id: 'flood',
			chapter: 'memory',
			title: 'Receptors set the tumble rate',
			scene: 'trace',
			hints: { focus: 'flood' },
			duration: 30,
			controls: [dose],
			body: `
<p>At one end of the cell, thousands of <dfn data-def="Proteins that span the inner membrane: the outside part binds an attractant such as aspartate (the receptor Tar) or serine (Tsr); the inside part controls the kinase CheA.">receptors</dfn> sit in a tight cluster, coupled so that groups of them switch together. A group is either active or inactive. Active receptors switch on a kinase, CheA, which loads phosphate onto a small messenger, <strong>CheY</strong>; CheY-P diffuses to the flagellar motors and makes them reverse. So the receptors' <strong>activity</strong>, the fraction of them that is active, sets how often the cell tumbles. At rest it is about a third.</p>
<p>An attractant bound to a receptor tips it towards inactive. Flood the whole dish at once, from 20 µM of the attractant <dfn data-def="α-Methyl-DL-aspartate: an analogue of aspartate that the receptor Tar detects but the cell cannot eat, so its concentration stays put.">MeAsp</dfn> to more: the activity drops, CheY-P falls, and 1000 cells almost stop tumbling. Every cell does it at once, whichever way it faces: it has sensed that things got better, not where.</p>
<p>Then, with the attractant still there, the tumbling comes back. Within a minute or two it is back at one a second.</p>`,
			notes: `<p>The receptor model is the MWC model of Tu, Shimizu and Berg (2008), with their constants for MeAsp on Tar (K<sub>I</sub> from the 2008 paper, the ratio K<sub>I</sub>/K<sub>A</sub> = 0.0062, N and α as measured by Shimizu, Tu and Berg in 2010): groups of N = 6 receptors, free energy F = N[α(m₀ − m) + ln((1 + c/K<sub>I</sub>)/(1 + c/K<sub>A</sub>))] with α = 2 kT, m₀ = 1 (Tu and colleagues' value; the 2010 fit uses 0.5, which only shifts the methylation scale), K<sub>I</sub> = 18 µM and K<sub>A</sub> = 2.9 mM, and activity a = 1/(1 + e<sup>F</sup>). The motors' response to CheY-P is very steep (a Hill coefficient of about 10, Cluzel, Surette and Leibler 2000), so here the run-to-tumble rate is (1/0.86 s)·(a/a₀)<sup>10</sup>, capped at 10 per second, with a₀ = 1/3. The tumbles are counted in 2 s windows; the line is the rate the model expects. The plot runs eight times faster than real time.</p>`
		},
		{
			id: 'adapt',
			chapter: 'memory',
			title: 'Methylation: precise adaptation',
			scene: 'trace',
			hints: { focus: 'stairs' },
			duration: 36,
			controls: [tau, adapt],
			body: `
<p>What brings the tumbling back is a second, slower chemistry. An enzyme, <strong>CheR</strong>, adds methyl groups to the receptors, which makes them more active; another, <strong>CheB</strong>, removes them. CheR works on inactive receptors and CheB on active ones, so the methylation <em>m</em> keeps changing until the activity is back at its resting value of a third, and only then stops.</p>
<p>Here the dish is flooded in stages, 20 → 40 → 80 µM, and then washed back to 20. Each rise makes the tumbling stop for a while; the wash makes the cells tumble wildly, as if things had got much worse. Each time the methylation climbs or falls to a new level, and the activity returns <em>exactly</em> to where it was: <dfn data-def="The activity, and with it the tumble rate, returns to the same value whatever the steady concentration of attractant.">precise adaptation</dfn>.</p>
<p>That is <a href="../feedback-control/#integral">integral feedback</a>: the methylation adds up the activity's error until the error is zero. It is <a href="../homeostasis/#loop">homeostasis</a> inside a single cell. Switch the methylation off and the tumble rate stays wherever the attractant pushed it.</p>`,
			notes: `<p>Linearised around a₀, the methylation obeys dm/dt = k(a₀ − a), with k chosen so that a small disturbance of the activity relaxes in the adaptation time τ. FRET measurements give τ ≈ 11 s at 32 °C and about 29 s at 22 °C (Shimizu, Tu and Berg 2010). Because the rate depends only on a, the only steady state is a = a₀: the robustness that Barkai and Leibler (1997) predicted and Alon and colleagues (1999) measured. A big step takes longer than τ, because the enzymes work at a limited speed: the full recovery from 20 to 400 µM takes minutes, as in real cells. At high MeAsp, near K<sub>A</sub>, the receptors saturate and respond less to further changes; real cells also lose precise adaptation there as their methylation sites fill up, which this simplified model does not reproduce.</p>`
		},
		{
			id: 'ramp',
			chapter: 'memory',
			title: 'A memory of the last few seconds',
			scene: 'trace',
			hints: { focus: 'ramp' },
			duration: 32,
			controls: [ramp],
			body: `
<p>A cell swimming up a gradient doesn't feel a step; it feels a concentration that keeps rising. Here the attractant rises from 100 µM by a fixed percentage every second for two minutes, then stops.</p>
<p>The methylation chases the rising concentration but lags behind it, so the activity stays <em>below</em> a third for as long as the rise lasts, at a nearly constant level, the lower the faster the rise, and the cell keeps tumbling less. When the rise stops, everything returns to rest.</p>
<p>So the activity reports how fast the concentration is changing: in effect, the cell compares the last second with the last ten. Well between the receptors' two binding constants it responds to <em>relative</em> changes (a rise from 100 to 110 µM counts about as much as one from 300 to 330), so it works much the same over a wide range of concentrations; near either end, the response depends on the concentration too.</p>`,
			notes: `<p>In an exponential ramp c = c₀e<sup>rt</sup> with K<sub>I</sub> ≪ c ≪ K<sub>A</sub>, the activity settles where the methylation keeps pace, dm/dt = r/α, so a = a₀ − r/(αk); outside that range the pace needed, (r/α)(c/(K<sub>I</sub> + c) − c/(K<sub>A</sub> + c)), changes as c rises, and so does the activity. Shimizu, Tu and Berg (2010) measured this shift directly: Δa/Δr ≈ −30 s at 22 °C; the model, with τ = 29 s, gives −39 s. The response to a brief pulse of attractant measured on single motors (Segall, Block and Berg 1986) is a short positive lobe followed by a long negative one about 4 s long: the weighting of "now" against "a moment ago". The ratio sensing holds well inside K<sub>I</sub> to K<sub>A</sub>, 18 µM to 3 mM of MeAsp.</p>`
		},
		// ------------------------------------------------------------------ climb
		{
			id: 'drop',
			chapter: 'climb',
			title: 'A swarm finds the drop',
			scene: 'dish',
			hints: { focus: 'gather' },
			duration: 40,
			controls: [dropX, dropY, release],
			body: `
<p>Now 300 cells, each with its own receptors, methylation and motor, are spread over a chamber 1.8 mm across with a drop of MeAsp in it: 1 mM at the centre, falling off over about half a millimetre. Each cell starts adapted to wherever it is.</p>
<p>Watch the swarm gather. No cell knows where the drop is, and none ever turns towards it. They all run and tumble as before; they just tumble a little less while things are improving. Within six minutes most of them are within 0.3 mm of the drop.</p>
<p>Drag the drop somewhere else: the attractant moves with it, and the swarm, where it was, finds it again.</p>`,
			notes: `<p>The drop is held fixed: MeAsp is not eaten, and the picture assumes the drop has spread into a broad, steady hill (a Gaussian 0.5 mm wide). The cells bounce off the chamber's walls and swim in a layer deep enough that only their position across the chamber matters. The movie runs six times faster than real time. This is how Pfeffer first saw chemotaxis in the 1880s, with a capillary of attractant dipped into a drop of bacteria; Julius Adler made the capillary assay quantitative in the 1960s and 70s.</p>`
		},
		{
			id: 'runs',
			chapter: 'climb',
			title: 'The bias is in the run length',
			scene: 'dish',
			hints: { focus: 'runs' },
			duration: 36,
			controls: [release],
			body: `
<p>Now the cells heading towards the drop are coloured, and the others are grey. Count the runs: those that start towards the drop last about twice as long as those that start away from it, because along them the activity sits below a third and the motors rarely reverse.</p>
<p>Everything else is unbiased. A tumble throws the cell in a random new direction, 68° on average, with no preference for the drop; a cell heading the wrong way is not turned around, it just gets to its next tumble sooner. The cell cannot steer. Longer runs uphill and shorter ones downhill are enough: a <dfn data-def="A random walk whose steps are slightly more likely, or longer, in one direction, so that on average it drifts that way.">biased random walk</dfn>.</p>
<p>The drift is slow next to the swimming: in a gradient that rises by a factor e every millimetre the swarm moves up it at about 4 µm/s, a fifth of the swimming speed.</p>`,
			notes: `<p>The 4 µm/s is measured in the same simulation, in an exponential gradient (100 µM at the start, an adaptation time of 10 s), between the first and the fifth minute. Measurements in controlled microfluidic gradients give drift speeds of a few µm/s that, like here, depend on the relative gradient, not on the concentration (Kalinin and colleagues, 2009). A run towards the drop is counted by the cell's heading when it starts.</p>`
		},
		{
			id: 'tune',
			chapter: 'climb',
			title: 'Speed and memory',
			scene: 'dish',
			hints: { focus: 'tune' },
			duration: 40,
			controls: [speed, tau, release],
			body: `
<p>The chart shows the share of cells near the drop over time; the dashed curve is the standard cell, swimming at 20 µm/s and adapting in 10 s.</p>
<p><strong>Swimming speed.</strong> A faster cell covers more of the gradient between tumbles, so it sees a bigger change and gathers sooner. A slower one sees smaller changes on each run and gathers more slowly.</p>
<p><strong>Adaptation time.</strong> The memory has to be longer than a run: at 1 s the cell forgets the start of a run before it ends, so the comparison is weak and the swarm gathers slowly. But a memory far longer than a run is slow in another way: a cell that has just climbed the gradient keeps tumbling little for a while after it turns downhill, so it is late to notice that things are getting worse, and the swarm stays loose. In between, ten seconds or so, it works best.</p>`,
			notes: `<p>The "best" memory depends on the gradient and the cell's rotational diffusion, which scrambles its heading in about 10 s: comparing with a time longer than that means comparing with a run in some other direction. Real E. coli adapt in about 10 s at 32 °C, as here. The swimmers here read the concentration exactly; the counting noise of the second step is left out of the simulation.</p>`
		},
		{
			id: 'no-adapt',
			chapter: 'climb',
			title: 'Without adaptation, no gathering',
			scene: 'dish',
			hints: { focus: 'off' },
			duration: 40,
			controls: [adapt, release],
			body: `
<p>Switch the methylation off. Every cell's receptors now keep the methylation of a cell adapted to 300 µM, as in a mutant that lacks both CheR and CheB. The cells still react to the attractant: near the drop they hardly tumble at all, far from it they tumble a lot.</p>
<p>But the swarm no longer gathers. A cell's tumble rate now depends on <em>where</em> it is, not on whether things are getting better, so runs into and out of any spot are treated alike. Cells shoot straight through the drop and out the other side, and the swarm stays spread over the chamber.</p>
<p>That is the whole trick: E. coli cannot see a gradient, but by comparing now with a few seconds ago, and tumbling less while things improve, a swarm of them climbs it.</p>`,
			notes: `<p>That a tumble rate set only by position gives no accumulation is a theorem for run-and-tumble swimmers with a constant speed and unbiased turns (Schnitzer 1993): the density stays even, up to a slight excess where cells tumble more, because tumbling cells stand still. Mutants lacking CheR and CheB still respond to changes of attractant, but fail to adapt quickly and precisely, and don't gather in gradients. The same machinery, with other receptors, steers the cell from repellents, towards the right temperature, oxygen level and pH.</p>`
		}
	]
};
