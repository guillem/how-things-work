import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `small` (a 16 × 16 lattice, its bonds and the Metropolis rule, one attempt at a time),
 * `lattice` (a live square lattice beside a panel: the run's trace, the measured curves of
 * ⟨|m|⟩, or of χ and c), `hysteresis` (a 32 × 32 lattice in a swept field beside its m(h) loop)
 * and `chain` (the history of a live ring of spins beside the rings' measured ⟨|m|⟩).
 *
 * Hints: `panel` (what the lattice scene's panel shows), and which controls set the temperature
 * (`tParam`), the size (`sizeParam`) and the algorithm (`algoParam`) on that step.
 */

/** k·T / J with two decimals. */
const fmtT = (v: number) => v.toFixed(2);

const temperature = (id: string, def: number, min: number, max: number): Control => ({
	type: 'range',
	id,
	label: 'Temperature kT / J',
	min,
	max,
	step: 0.01,
	default: def,
	format: fmtT
});

const size = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Lattice',
	default: def,
	options: [
		{ value: '8', label: '8 × 8' },
		{ value: '16', label: '16 × 16' },
		{ value: '32', label: '32 × 32' },
		{ value: '64', label: '64 × 64' }
	]
});

const algorithm = (id: string, def: string): Control => ({
	type: 'select',
	id,
	label: 'Update',
	default: def,
	options: [
		{ value: 'metropolis', label: 'Metropolis' },
		{ value: 'wolff', label: 'Wolff clusters' }
	]
});

const restart = (id: string): Control => ({
	type: 'action',
	id,
	label: 'Lattice',
	action: 'Start again from random spins'
});

export const spec: ExplainerSpec = {
	slug: 'ising-model',
	title: 'The Ising model & phase transitions',
	summary:
		'A square lattice of spins that only want to agree with their four neighbours, run by the Metropolis algorithm: cool it through Onsager’s critical temperature and order appears out of noise, with a magnetisation that rises continuously from zero and a susceptibility and heat capacity that spike; sweep a field to trace a hysteresis loop; and see a one-dimensional chain never order at all.',
	chapters: [
		{ id: 'model', title: 'Spins that like to agree' },
		{ id: 'transition', title: 'Order out of noise' },
		{ id: 'beyond', title: 'Fields and dimensions' }
	],
	steps: [
		// ------------------------------------------------------------------ model
		{
			id: 'spins',
			chapter: 'model',
			title: 'Up, down and their neighbours',
			scene: 'small',
			hints: { phase: 'bonds' },
			duration: 22,
			controls: [
				{
					type: 'select',
					id: 'arrangement',
					label: 'Arrangement',
					default: 'random',
					options: [
						{ value: 'random', label: 'random' },
						{ value: 'domains', label: 'two domains' },
						{ value: 'aligned', label: 'all up' }
					]
				}
			],
			body: `
<p>A magnet is made of atoms that each carry a tiny magnetic moment, a <dfn data-def="Here a variable that can only point up (s = +1) or down (s = −1): the simplest stand-in for an atom’s magnetic moment.">spin</dfn>. The <strong>Ising model</strong> keeps only what matters for ordering: spins sᵢ = ±1 on a square grid, each touching four neighbours, with energy</p>
<p class="formula">E = −J Σ sᵢ sⱼ − h Σ sᵢ</p>
<p>The first sum runs over neighbouring pairs: a pair that agrees lowers the energy by J, a pair that disagrees (a <strong>broken bond</strong>, marked here) raises it by J. h is an outside magnetic field, zero until the last chapter. The <dfn data-def="The average spin, m = (number up − number down) / N. +1 when all point up, near 0 when they are mixed.">magnetisation</dfn> m is the average spin.</p>
<p>All up has the lowest energy, but only <strong>2</strong> arrangements (all up, all down) do it. Random spins cost much more energy, yet nearly all of the 2²⁵⁶ ≈ 10⁷⁷ arrangements of this lattice look like that. As in <a href="../entropy/#entropy">entropy</a>, counting wins unless energy outweighs it.</p>`,
			notes: `<p>Temperatures and fields are in units of the coupling: kT / J and h / J, so the model has no other parameters. The lattice wraps around (its right edge touches its left, its top its bottom), so every spin has four neighbours. Ernst Ising solved the one-dimensional version in 1925 and found no ordering; Rudolf Peierls argued in 1936 that two dimensions do order, and Lars Onsager solved the square lattice exactly in 1944.</p>`
		},
		{
			id: 'metropolis',
			chapter: 'model',
			title: 'The Metropolis algorithm',
			scene: 'small',
			hints: { phase: 'metropolis', tParam: 'T_metro' },
			duration: 30,
			controls: [temperature('T_metro', 2.5, 0.5, 5)],
			body: `
<p>In equilibrium at temperature T, each arrangement turns up with probability proportional to its <dfn data-def="e^(−E/kT): how much less likely a state of energy E is than one of energy 0, at temperature T.">Boltzmann factor</dfn> e^(−E/kT). There are far too many arrangements to list, so we let the computer wander among them so that it visits each as often as that weight says.</p>
<p>The <strong>Metropolis algorithm</strong> (1953): pick a spin at random and work out what flipping it would cost, ΔE = 2J sᵢ (sum of its neighbours). If ΔE ≤ 0 flip it; otherwise flip it with probability <b>e^(−ΔE/kT)</b>, by drawing a random number u between 0 and 1. With four neighbours ΔE can only be −8, −4, 0, 4 or 8 J, so the whole rule is the small table here.</p>
<p>Lower the temperature and costly flips become rare: the spins settle with their neighbours. Raise it and nearly everything flips. N attempts, one per spin on average, make a <dfn data-def="N attempted flips, one per spin on average: the unit of Monte Carlo time.">sweep</dfn>.</p>`,
			notes: `<p>The rule satisfies <i>detailed balance</i>: the flow from any arrangement A to B equals the flow back, P(A)·rate(A→B) = P(B)·rate(B→A), because the ratio of the acceptance probabilities is exactly e^(−(E_B − E_A)/kT). A Markov chain with that property, and able to reach every arrangement, ends up visiting them with Boltzmann’s probabilities. The page checks this against an exact sum over all 65,536 arrangements of a 4 × 4 lattice.</p>`
		},
		// ------------------------------------------------------------------ transition
		{
			id: 'quench',
			chapter: 'transition',
			title: 'Domains grow out of noise',
			scene: 'lattice',
			hints: {
				panel: 'trace',
				tParam: 'T_quench',
				size: 64,
				algo: 'metropolis',
				fresh: true,
				restartParam: 'restart_quench'
			},
			duration: 30,
			controls: [temperature('T_quench', 1.5, 0.5, 5), restart('restart_quench')],
			body: `
<p>Now 4,096 spins, started at random (as if just taken from a very hot oven) and run at the temperature you set, 30 sweeps a second. At <b>kT = 1.5 J</b> they cannot stay random: neighbours agree, small patches of one colour, <dfn data-def="A region in which the spins point the same way.">domains</dfn>, appear and grow, and the energy (lower trace) falls towards −2 J per spin.</p>
<p>The domains grow because spins on a curved boundary are outvoted by the side that surrounds them, so walls straighten and small domains shrink away. Given time one colour takes over: the lattice <strong>orders</strong> and m heads to +1 or −1, chosen by chance. Above about <b>kT = 2.3 J</b> no domain lasts: the lattice stays a speckled noise and m stays near 0.</p>`,
			notes: `<p>Which colour wins is an accident of the start: the energy does not prefer either, a <i>spontaneously broken symmetry</i>. Large domains can take thousands of sweeps to merge, and a straight wall across the whole lattice can get stuck for a long time; start again to see a different history.</p>`
		},
		{
			id: 'order',
			chapter: 'transition',
			title: 'A sharp temperature',
			scene: 'lattice',
			hints: {
				panel: 'magnetisation',
				tParam: 'T_order',
				sizeParam: 'size_order',
				algo: 'metropolis'
			},
			duration: 30,
			controls: [temperature('T_order', 2, 1, 3.6), size('size_order', '64')],
			body: `
<p>Measure the average |m| at each temperature, letting the lattice settle first. The curves are the page’s own Monte Carlo runs; the dashed curve is <strong>Onsager’s exact result</strong> for an infinite lattice, M = (1 − sinh⁻⁴(2J/kT))^(1/8), which is zero above the <dfn data-def="The temperature at which a material starts to order: for the square-lattice Ising model kT_c = 2J / ln(1 + √2) ≈ 2.269 J.">critical temperature</dfn></p>
<p class="formula">kT<sub>c</sub> = 2J / ln(1 + √2) ≈ 2.269 J</p>
<p>Cooling through T<sub>c</sub>, the magnetisation does not jump: it rises <strong>continuously</strong> from zero, but steeply, as (T<sub>c</sub> − T)<sup>1/8</sup>. At kT = 2.2 J it is already 0.78; at 2.0 J, 0.91. That makes this a <dfn data-def="A transition in which the order grows continuously from zero (no latent heat), with quantities that diverge at the critical point. Also called second order.">continuous phase transition</dfn>, unlike the jump of boiling water.</p>
<p>A small lattice blurs it: 8 × 8 still shows |m| = 0.43 at kT = 3 J, because a few dozen spins agree by chance. The 64 × 64 lattice follows Onsager closely, and only an infinite one is sharp.</p>`,
			notes: `<p>A finite lattice in zero field has no lasting magnetisation: given enough time it flips between +m and −m, so the plain average of m is zero at every temperature. The page measures ⟨|m|⟩ instead, which tends to Onsager’s M as the lattice grows. Onsager announced M(T) in 1948 without publishing a derivation; C. N. Yang proved it in 1952. Each point averages 6,000 to 20,000 updates after 500 to settle.</p>`
		},
		{
			id: 'peaks',
			chapter: 'transition',
			title: 'Fluctuations spike',
			scene: 'lattice',
			hints: { panel: 'peaks', tParam: 'T_peaks', sizeParam: 'size_peaks', algo: 'metropolis' },
			duration: 30,
			controls: [temperature('T_peaks', 2.27, 1, 3.6), size('size_peaks', '64')],
			body: `
<p>Near T<sub>c</sub> the lattice cannot decide. Domains of every size, from single spins to the whole lattice, come and go, and the magnetisation and energy swing widely. Those swings are measurable quantities:</p>
<ul><li>the <dfn data-def="How strongly the magnetisation responds to a small field; from the fluctuations, χ = N(⟨m²⟩ − ⟨|m|⟩²) / kT.">susceptibility</dfn> χ, from the swings of m: how much a small field would magnetise the lattice;</li>
<li>the <dfn data-def="The energy needed to raise the temperature by one unit; from the fluctuations, c = N(⟨e²⟩ − ⟨e⟩²) / kT².">heat capacity</dfn> c, from the swings of the energy.</li></ul>
<p>Both spike near T<sub>c</sub>, and grow the lattice to see the peaks <strong>sharpen</strong>: χ peaks at 1.5 for 8 × 8 at kT = 2.66 J, and at 59 for 64 × 64 at 2.32 J, moving towards T<sub>c</sub> as it grows. In an infinite lattice χ would be infinite at T<sub>c</sub>, and c too (Onsager’s dashed curve rises without limit, slowly, like a logarithm).</p>`,
			notes: `<p>Finite-size scaling: the peak of χ grows as L^(γ/ν) = L^(7/4), and its temperature approaches T<sub>c</sub> as L^(−1/ν) = 1/L; each doubling of L here multiplies the peak by about 3.4. The heat capacity peak grows only as ln L. Measuring χ with ⟨|m|⟩ rather than ⟨m⟩ (zero in a finite lattice) puts its peak a little above T<sub>c</sub>, which is why the 64 × 64 peak sits at 2.32 J rather than 2.27 J.</p>`
		},
		{
			id: 'slowing',
			chapter: 'transition',
			title: 'Critical slowing down',
			scene: 'lattice',
			hints: { panel: 'trace', tParam: 'T_slow', algoParam: 'algo_slow', size: 64 },
			duration: 30,
			controls: [temperature('T_slow', 2.27, 1.5, 3.5), algorithm('algo_slow', 'metropolis')],
			body: `
<p>At T<sub>c</sub> the domains look the same at every scale, from single spins up to the whole lattice: islands within lakes within islands. Single flips at random are hopeless at moving such huge domains: Metropolis needs more and more sweeps to produce a new, independent picture, and the trace of m wanders slowly. This is <dfn data-def="Near a critical point, the time a local algorithm (or a real material) takes to relax grows without limit.">critical slowing down</dfn>.</p>
<p>The <strong>Wolff algorithm</strong> (1989) flips clusters instead: start from a random spin, add each like neighbour with probability 1 − e^(−2J/kT), keep growing, then flip the whole cluster at once. Near T<sub>c</sub> the clusters are as big as the domains, and each update gives a fresh picture: switch to it and the trace of m jumps from value to value.</p>`,
			notes: `<p>That probability is chosen so that the cluster flip obeys detailed balance with no rejection: the cost of the bonds broken along the cluster’s edge is paid exactly by the chance of not having added those neighbours. Wolff needs no field (a field would have to be paid for in another way), so the hysteresis step uses Metropolis. Below T<sub>c</sub> a cluster is most of the lattice and flipping it reverses nearly everything; since flipping every spin changes no energy, the page draws each Wolff update with its majority up.</p>`
		},
		// ------------------------------------------------------------------ beyond
		{
			id: 'hysteresis',
			chapter: 'beyond',
			title: 'A field and a loop',
			scene: 'hysteresis',
			hints: { tParam: 'T_hyst', sweepParam: 'sweep_hyst' },
			duration: 30,
			controls: [
				temperature('T_hyst', 1.5, 1, 3.5),
				{
					type: 'select',
					id: 'sweep_hyst',
					label: 'Field sweep',
					default: 'slow',
					options: [
						{ value: 'slow', label: 'slow (400 sweeps a loop)' },
						{ value: 'fast', label: 'fast (100)' }
					]
				}
			],
			body: `
<p>Now turn on the field h and sweep it down from +1.5 J to −1.5 J and back, slowly, with the lattice of 32 × 32 spins at kT = 1.5 J. The lattice stays up long after the field has turned against it: reversing it needs a domain of the other colour large enough to grow, and that takes a field of about <strong>−0.8 J</strong>. Then it flips, and on the way back the same thing happens the other way.</p>
<p>The magnetisation traces a <dfn data-def="A loop traced by a magnetisation that lags the field: its value depends on where the field has been, not only on where it is.">hysteresis loop</dfn>. At h = 0 the lattice remembers which way it was last pushed: that memory is a permanent magnet, and a hard disk’s bit. Above T<sub>c</sub> there is no order to remember and the loop closes to a thin lens; what width remains is lag, and a slower sweep thins it further. A faster sweep widens every loop: the width depends on how fast the field moves, not only on the material.</p>`,
			notes: `<p>A real magnet’s loop also depends on crystal defects that pin domain walls; this lattice is perfect, so it reverses only by forming a new domain from thermal fluctuations, and the reversal field depends on the sweep rate and the lattice’s size. Each value of the field gets one Metropolis sweep.</p>`
		},
		{
			id: 'chain',
			chapter: 'beyond',
			title: 'A chain never orders',
			scene: 'chain',
			hints: { tParam: 'T_chain', sizeParam: 'size_chain' },
			duration: 30,
			controls: [
				temperature('T_chain', 1, 0.2, 3.6),
				{
					type: 'select',
					id: 'size_chain',
					label: 'Chain length',
					default: '1024',
					options: [
						{ value: '16', label: '16' },
						{ value: '64', label: '64' },
						{ value: '256', label: '256' },
						{ value: '1024', label: '1,024' }
					]
				}
			],
			body: `
<p>Shrink the lattice to one dimension: a ring of spins, each with two neighbours. The picture runs down the page, one row per sweep. Domains form, but their walls wander and new walls keep appearing, and the ring never settles on one colour. Order is <strong>not automatic</strong>.</p>
<p>The reason is counting again. One wall costs only 2J, wherever it is, and a ring of N spins has N places to put it, so the walls win as soon as kT ln N outweighs 2J: at any temperature above zero, for a long enough chain. In the plot, longer chains order only at lower temperatures, and the crossover slides towards T = 0: for 1,024 spins, |m| is 0.07 at kT = 1 J. There is <strong>no phase transition</strong>, and the heat capacity is a broad bump that does not sharpen.</p>
<p>In two dimensions a wall of length ℓ costs 2Jℓ, which grows with the wall, so below T<sub>c</sub> energy beats counting. Nearest neighbours alone produce a sharp transition only from two dimensions up.</p>`,
			notes: `<p>Ising’s exact solution of the chain (1925) gives spin correlations that fall off as tanh(J/kT)<sup>r</sup> with distance r, a correlation length ξ = −1/ln tanh(J/kT) that is finite at every T &gt; 0 (27 spins at kT = 0.5 J, 3.7 at 1 J) and an energy per spin of −J tanh(J/kT); the page checks its runs against that solution. Peierls’ 1936 argument makes the two-dimensional case precise: the number of closed walls of length ℓ grows only as about 3^ℓ, so at low enough temperature large walls are too costly to appear. The same model, with spins as neurons, is the Hopfield network: its stored memories are the energy minima.</p>`
		}
	]
};
