import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `moves` (a 12 × 12 surface and the three moves of the model, one trial at a time) and
 * `lattice` (a live 64 × 64 surface beside a panel: the run's CO₂ rate and coverages over time,
 * or the measured steady states against the CO fraction with the mean field).
 *
 * Hints: `panel` (`trace` or `curves`), which controls set the CO fraction (`yParam`) and the
 * desorption probability (`kParam`) or their fixed values (`y`, `k`), `start` (`empty` or `co`,
 * a surface covered with CO), `restartParam` (an action that starts the run again) and
 * `reducedUpdates` (the MCS the reduced-motion frame shows, enough for the step's point).
 */

const fraction = (id: string, def: number, min = 0, max = 1): Control => ({
	type: 'range',
	id,
	label: 'CO fraction of the gas, y',
	min,
	max,
	step: 0.005,
	default: def,
	format: (v) => v.toFixed(3)
});

const desorption = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'CO desorption, k (a hotter surface)',
	default: def,
	options: [
		{ value: '0', label: 'none (k = 0)' },
		{ value: '0.02', label: 'k = 0.02' },
		{ value: '0.05', label: 'k = 0.05' },
		{ value: '0.1', label: 'k = 0.1' },
		{ value: '0.2', label: 'k = 0.2' }
	]
});

const restart = (id: string, action = 'Start again'): Control => ({
	type: 'action',
	id,
	label: 'Surface',
	action
});

export const spec: ExplainerSpec = {
	slug: 'surface-catalysis',
	title: 'Catalysis on a surface',
	summary:
		'CO oxidation on a lattice of catalyst sites (the Ziff–Gulari–Barshad model): CO and oxygen land, meet as neighbours and leave as CO₂. Slide the CO fraction of the gas and the surface dies of oxygen on one side and chokes on CO on the other, with a narrow working window between that the mean-field rate equations get wrong; let CO desorb, as on a hotter surface, and the poisoned catalyst recovers.',
	chapters: [
		{ id: 'surface', title: 'A surface that works' },
		{ id: 'dead', title: 'Two dead ends' },
		{ id: 'hot', title: 'A hotter surface' }
	],
	steps: [
		// ------------------------------------------------------------------ surface
		{
			id: 'moves',
			chapter: 'surface',
			title: 'Three moves on a grid of sites',
			scene: 'moves',
			hints: { yParam: 'y_moves' },
			duration: 30,
			controls: [fraction('y_moves', 0.5)],
			body: `
<p>A platinum surface turns carbon monoxide and oxygen into carbon dioxide, 2CO + O₂ → 2CO₂, in every car’s catalytic converter. In the gas the two hardly react. On the metal both stick to <dfn data-def="A place on the surface where one molecule or atom can bind: here, one square of the grid.">sites</dfn>, and they react as neighbours: the <dfn data-def="A surface reaction between two species that are both adsorbed, held on neighbouring sites. Named after Irving Langmuir and Cyril Hinshelwood.">Langmuir–Hinshelwood mechanism</dfn>.</p>
<p>The <strong>Ziff–Gulari–Barshad model</strong> (1986) keeps only that. Molecules hit the surface at random, a fraction <b>y</b> of them CO and the rest O₂:</p>
<ul><li><b>CO</b> lands on one empty site, or bounces off a full one;</li>
<li><b>O₂</b> splits into two O atoms and needs <b>two</b> neighbouring empty sites;</li>
<li>a CO next to an O reacts at once into <b>CO₂</b>, which leaves and frees both sites.</li></ul>
<p>Here one molecule arrives every third of a second. A <dfn data-def="Monte Carlo step: as many arrivals as there are sites, so each site is hit about once. The model’s unit of time.">Monte Carlo step</dfn> (MCS) is one arrival per site.</p>`,
			notes: `<p>The model leaves out almost everything about real platinum: no energies, no diffusion of the adsorbed atoms, an instantaneous reaction, CO that never leaves (until the last chapter). Its point is what those few rules do on their own. Gerhard Ertl’s experiments on how CO and oxygen behave on platinum won the 2007 Nobel Prize in Chemistry. No measured data are used on this page: every number is the model’s own, from the page’s simulations.</p>`
		},
		{
			id: 'turnover',
			chapter: 'surface',
			title: 'Used again and again',
			scene: 'lattice',
			hints: {
				panel: 'trace',
				yParam: 'y_turn',
				k: 0,
				restartParam: 'restart_turn',
				reducedUpdates: 120
			},
			duration: 30,
			controls: [fraction('y_turn', 0.47), restart('restart_turn')],
			body: `
<p>Now 4,096 sites, starting clean, 20 MCS a second. At <b>y = 0.47</b> the surface fills to a steady state within a few dozen MCS: mostly oxygen (red), a little CO (grey), and empty sites (pale) that open and close as CO₂ forms. The rate settles at about <strong>0.15 CO₂ per site per MCS</strong>.</p>
<p>Watch the count of CO₂ made per site above the surface: it passes 1 in the first second and is near 90 after 30 seconds. Each site has turned over many times and is still there, unchanged. That is what makes it a <strong>catalyst</strong>: it is not consumed.</p>
<p>But it is not inert either. The rate depends on what covers the surface, and the coverage depends on the gas.</p>`,
			notes: `<p>Rates in surface chemistry are often quoted as a <i>turnover frequency</i>: molecules made per site per second. Here time is counted in arrivals, so the rate is CO₂ per site per MCS. The trace averages it over the last 10 MCS.</p>`
		},
		// ------------------------------------------------------------------ dead
		{
			id: 'oxygen',
			chapter: 'dead',
			title: 'Too little CO: an oxygen desert',
			scene: 'lattice',
			hints: {
				panel: 'trace',
				yParam: 'y_ox',
				k: 0,
				restartParam: 'restart_ox',
				reducedUpdates: 700
			},
			duration: 30,
			controls: [fraction('y_ox', 0.33), restart('restart_ox')],
			body: `
<p>Lower the CO fraction to <b>y = 0.33</b>. CO arrives too rarely to clear the oxygen, red patches spread, and after a few hundred MCS every site holds an O atom. Then nothing can happen: CO needs an empty site, O₂ needs two, and there are none. The rate is zero, for good. The surface is <dfn data-def="Covered by something that blocks the reaction, so the catalyst stops working.">poisoned</dfn>, by one of its own reactants.</p>
<p>This dead end starts below <strong>y₁ ≈ 0.387</strong>. Approaching it from above, the rate falls smoothly to zero (a continuous transition), and close to y₁ the surface takes longer and longer to die: at 0.37 it can survive the whole step. A dead surface stays dead: raise y and nothing changes, so start again.</p>`,
			notes: `<p>A surface full of one species, which no move can leave, is an <i>absorbing state</i>. The transition into it at y₁ belongs to the same family (directed percolation) as an epidemic dying out. The published value y₁ = 0.3874 is from Voigt and Ziff (1997).</p>`
		},
		{
			id: 'collapse',
			chapter: 'dead',
			title: 'Too much CO: a sudden collapse',
			scene: 'lattice',
			hints: {
				panel: 'trace',
				yParam: 'y_co',
				k: 0,
				restartParam: 'restart_co',
				reducedUpdates: 500
			},
			duration: 30,
			controls: [fraction('y_co', 0.54), restart('restart_co')],
			body: `
<p>Now raise it to <b>y = 0.54</b>. For a few seconds the surface works hard, then grey islands of CO appear and grow, and within a couple of hundred MCS CO covers every site. O₂ needs two empty neighbours, but a hole inside a CO island is a single site, and the next CO fills it. Only the islands’ edges react, and the islands grow faster than their edges eat them.</p>
<p>This collapse is <strong>abrupt</strong>. Just below <strong>y₂ ≈ 0.526</strong> the surface makes CO₂ at its fastest, about 0.26 per site per MCS; just above it, nothing. The best working point sits at the edge of a cliff (a <dfn data-def="A transition in which the state jumps: here the rate drops from its maximum to zero with no values in between.">first-order transition</dfn>).</p>`,
			notes: `<p>Close to y₂ the working surface can survive a long time before one island happens to grow large enough to take over (at y = 0.53 about 900 MCS on this lattice, at 0.55 about 100): a metastable state, like water cooled below its freezing point. The published value y₂ = 0.5256 is from Ziff and Brosilow (1992).</p>`
		},
		{
			id: 'window',
			chapter: 'dead',
			title: 'A narrow window, and what mean field misses',
			scene: 'lattice',
			hints: { panel: 'curves', yParam: 'y_win', k: 0, reducedUpdates: 300 },
			duration: 30,
			controls: [fraction('y_win', 0.45, 0.2, 0.8)],
			body: `
<p>Measure the steady state at each CO fraction (solid curves, each from runs of 3,000 MCS on this lattice): the surface works only between <b>0.387</b> and <b>0.526</b>, and its rate climbs across that window to the cliff.</p>
<p>The dashed curves are the <dfn data-def="Rate equations for the coverages θ that assume every site’s neighbours are a random sample of the surface, so a molecule meets a reactant with probability set by the average coverage.">mean-field</dfn> rate equations of the same moves: they treat the adsorbed CO and O as perfectly mixed. They get it wrong twice:</p>
<ul><li>they see <strong>no oxygen dead end</strong>: at y = 0.3 they still make 0.06 CO₂ per site per MCS, where the lattice is dead;</li>
<li>they put the CO collapse <strong>too late</strong>, near y = 0.56.</li></ul>
<p>On the lattice the reactants are not mixed. They sort into patches of CO and of O, which meet only along their edges, so the reaction is slower than the average coverages suggest, and whichever patch grows can take over.</p>`,
			notes: `<p>The mean field here is Dickman’s site approximation (1986): CO landing on an empty site reacts if one of its four neighbours holds O, with probability 1 − (1 − θ_O)⁴, and each new O atom checks its three other neighbours for CO. The classic textbook Langmuir–Hinshelwood rate law goes further still: it assumes the adsorbates are in equilibrium with the gas and gives a smooth hill that never reaches zero. The ZGB surface is never in equilibrium (nothing ever comes off except CO₂), and that is exactly where it dies. Near y₂ the measured curves depend a little on how long each run lasts: a longer run would poison slightly earlier.</p>`
		},
		// ------------------------------------------------------------------ hot
		{
			id: 'desorption',
			chapter: 'hot',
			title: 'Let CO leave',
			scene: 'lattice',
			hints: {
				panel: 'curves',
				yParam: 'y_hot',
				kParam: 'k_hot',
				restartParam: 'restart_hot',
				reducedUpdates: 300
			},
			duration: 30,
			controls: [
				fraction('y_hot', 0.56, 0.2, 0.8),
				desorption('k_hot', '0.05'),
				restart('restart_hot')
			],
			body: `
<p>On a real surface an adsorbed CO can also <strong>desorb</strong>, leave without reacting, and the hotter the surface the more often it does (desorption is thermally activated, like the reactions in <a href="../reaction-rates-equilibrium/">reaction rates</a>). Add it: a fraction <b>k</b> of the trials picks a random site and lets the CO on it, if any, go.</p>
<p>With <b>k = 0.05</b> the collapse moves up to about y = 0.55 and is no longer total: past it the surface stays mostly CO but keeps a trickle of reaction (0.03 at y = 0.56, against zero without desorption). At <b>k = 0.2</b> the cliff has become a smooth hill: the rate peaks at y ≈ 0.585 and falls gradually, still 0.13 at y = 0.645. Oxygen never desorbs, so the oxygen dead end stays where it was.</p>`,
			notes: `<p>Without desorption the jump at y₂ is a true first-order transition. Desorption shortens it, and at a critical value of k, about 0.04 (Tomé and Dickman 1993; later studies give 0.037 to 0.065), it ends at a critical point, like the end of the boiling line of water. A 64 × 64 lattice still shows a steep drop at k = 0.05, so the exact end point cannot be read from these curves.</p>`
		},
		{
			id: 'recover',
			chapter: 'hot',
			title: 'A poisoned catalyst recovers',
			scene: 'lattice',
			hints: {
				panel: 'trace',
				y: 0.5,
				kParam: 'k_rec',
				start: 'co',
				restartParam: 'restart_rec',
				reducedUpdates: 300
			},
			duration: 30,
			controls: [desorption('k_rec', '0.05'), restart('restart_rec', 'Cover it with CO again')],
			body: `
<p>Start from a surface entirely covered with CO, in a gas with <b>y = 0.5</b>, a mixture the clean surface handles well. With no desorption nothing ever happens: the catalyst is all there, not consumed, and completely useless. With <b>k = 0.05</b> a few CO molecules leave, O₂ finds pairs of empty sites, the oxygen eats into the CO, and within about 50 MCS the surface is working again.</p>
<p>A catalyst is not consumed, but it is not inert: what it does depends on what covers it, and a <strong>poisoned surface is a catalyst that has stopped working</strong>. A car’s converter is CO-covered and nearly idle when cold, and starts working only once it is hot enough for CO to come off (its light-off). The platinum of a hydrogen fuel cell is poisoned by traces of CO in the fuel for the same reason.</p>`,
			notes: `<p>Recovery time depends on k and y: at y = 0.5 about 170 MCS with k = 0.02 and 20 with k = 0.1. Poisons that bind more strongly than CO, such as sulphur or lead (which is why leaded petrol was dropped when converters arrived), do not leave at any operating temperature.</p>`
		}
	]
};
