import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `hw` (Hardy–Weinberg: the parents' genotypes, the gene pool, the offspring's
 * genotypes and the square they come from), `traces` (Wright–Fisher populations as
 * allele-share traces; `step.hints.mode` picks what is shown, see `TracesScene`) and `balance`
 * (the chance that a new mutation fixes, against N × s).
 *
 * Every control id belongs to one step, except the population size and "Run again" of the two
 * drift steps, which share them.
 */

const count = (v: number) => v.toLocaleString('en-US');
const pct = (v: number) => {
	const x = Math.round(v * 1000) / 10;
	return `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x)}%`;
};

const size = (id: string, values: number[], def: number): Control => ({
	type: 'range',
	id,
	label: 'Population size N',
	min: values[0],
	max: values[values.length - 1],
	default: def,
	values: () => values,
	format: (v) => `${count(v)} individuals`
});

const again = (id: string, help: string): Control => ({
	type: 'action',
	id,
	label: 'New populations',
	action: 'Run again',
	help
});

const advantage = (id: string, values: number[], def: number, help?: string): Control => ({
	type: 'range',
	id,
	label: 'Advantage per copy of A, s',
	min: values[0],
	max: values[values.length - 1],
	default: def,
	values: () => values,
	format: (v) => (v === 0 ? 'none (neutral)' : `${pct(v)} offspring`),
	help
});

export const spec: ExplainerSpec = {
	slug: 'population-genetics',
	title: 'Population genetics: drift and selection',
	summary:
		'Follow one gene with two versions through a hundred populations at once. Without selection the versions’ shares wander and one takes over by chance, faster in small populations; with an advantage the traces bend upwards, yet most new beneficial mutations are still lost while rare. Hardy–Weinberg is the baseline that shows which forces are at work.',
	chapters: [
		{ id: 'baseline', title: 'The baseline' },
		{ id: 'drift', title: 'Chance: genetic drift' },
		{ id: 'selection', title: 'Selection' },
		{ id: 'balance', title: 'Chance against selection' }
	],
	steps: [
		// ---------------------------------------------------------------- baseline
		{
			id: 'hardy-weinberg',
			chapter: 'baseline',
			title: 'Genotypes from allele shares: Hardy–Weinberg',
			scene: 'hw',
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'p_hw',
					label: 'Share of allele A, p',
					min: 0.05,
					max: 0.95,
					step: 0.05,
					default: 0.3,
					format: (v) => `${Math.round(v * 100)}%`
				},
				{
					type: 'select',
					id: 'parents',
					label: 'The parents',
					default: 'homo',
					options: [
						{ value: 'homo', label: 'No heterozygotes' },
						{ value: 'het', label: 'As many heterozygotes as possible' },
						{ value: 'hw', label: 'Already at p², 2pq, q²' }
					]
				}
			],
			body: `
<p>Take one gene with two versions, two <dfn data-def="Versions of the same gene, which differ in a few letters of DNA.">alleles</dfn>, A and a. Each person carries two copies, so there are three <dfn data-def="The pair of alleles an individual carries at one gene: AA, Aa or aa.">genotypes</dfn>: AA, Aa and aa. A population of N people holds 2N copies of the gene, its <b>gene pool</b>, and a share <b>p</b> of them are A (q = 1 − p are a).</p>
<p>If parents pair at random, each child’s two copies are two random draws from the pool: AA with chance <strong>p²</strong>, aa with chance <strong>q²</strong>, and Aa with chance <strong>2pq</strong> (A then a, or a then A). This is the <dfn data-def="Under random mating, with no selection, mutation, migration or drift, genotype shares are p², 2pq and q² after one generation, and the allele share p stays the same. Found independently by G. H. Hardy and Wilhelm Weinberg in 1908.">Hardy–Weinberg principle</dfn>.</p>
<p>Change the parents: whatever their genotypes, the children are at p², 2pq, q² after <strong>one generation</strong>, and p itself does not change. Which genotypes the parents had is forgotten; only the share of A in the pool is passed on.</p>`,
			notes: `<p>“Random mating” only has to hold for this gene: people choose partners for many reasons, but rarely by their blood group. Hardy–Weinberg also assumes no mutation and no migration, which change p from outside, and no selection or chance, the two forces this page is about.</p>`
		},
		{
			id: 'one-population',
			chapter: 'baseline',
			title: 'A baseline, not a standstill',
			scene: 'traces',
			hints: { mode: 'one', N: 'N_one', s: 's_one', again: 'again_one' },
			duration: 30,
			controls: [
				size('N_one', [20, 50, 100, 200, 500, 1000], 200),
				advantage('s_one', [0, 0.01, 0.02, 0.05], 0, 'With an advantage, A tends to spread.'),
				again('again_one', 'Same settings, different luck.')
			],
			body: `
<p>A real population is finite and may be under selection, so p changes from one generation to the next. Here is one population of N individuals, followed for 200 generations. Each generation, the bars show the newborns’ <strong>counted</strong> genotypes, and the ticks the Hardy–Weinberg shares p², 2pq, q² for <em>that</em> generation’s p.</p>
<p>The bars sit on the ticks, up to a little scatter, in <strong>every</strong> generation, while p itself wanders, or climbs with an advantage. So Hardy–Weinberg proportions do not mean that a population is not evolving. The principle predicts the genotypes <em>from</em> the allele shares, for one generation. It is a <strong>baseline</strong>: it says what would happen with no forces at all, so that a change in p between generations, or genotypes that miss the ticks, point to a force at work.</p>
<p>The next steps take the two forces that change p apart: chance, and selection.</p>`,
			notes: `<p>A lasting departure from Hardy–Weinberg is a clue in its own right: too few heterozygotes can mean inbreeding, or a sample that mixes two populations with different p (the Wahlund effect). Selection that kills some genotypes before adulthood also shifts the adults away from the newborns’ proportions; the page counts newborns, before selection acts.</p>`
		},
		// ---------------------------------------------------------------- drift
		{
			id: 'drift',
			chapter: 'drift',
			title: 'Chance alone: a hundred populations drift',
			scene: 'traces',
			hints: { mode: 'drift', N: 'N_d', p0: 'p0_d', again: 'again_d' },
			duration: 30,
			controls: [
				size('N_d', [10, 30, 100, 300, 1000], 30),
				{
					type: 'range',
					id: 'p0_d',
					label: 'Share of A at the start',
					min: 0.1,
					max: 0.9,
					step: 0.1,
					default: 0.5,
					format: (v) => `${Math.round(v * 100)}%`
				},
				again('again_d', 'A hundred new populations.')
			],
			body: `
<p>Now there is no selection: A and a do equally well. Each generation, the 2N gene copies of the newborns are still a <strong>random sample</strong> of the parents’ copies, and a sample rarely matches its source exactly. This change by chance is <dfn data-def="Random change in allele shares from one generation to the next, because which gene copies get passed on is a matter of chance.">genetic drift</dfn>.</p>
<p>The number of A copies in the sample is binomial, so p moves each generation by about <strong>√(pq / 2N)</strong>, the spread of a sample share. A hundred populations start at the same p and wander apart. Once a line hits 0% the allele is <strong>lost</strong>; at 100% it is <strong>fixed</strong>. There it stays: there is nothing left to sample from.</p>
<p>Make N smaller and the lines wander faster and settle sooner; make it larger and they barely move. Change the start: in the long run the share of populations in which A is fixed is its <strong>starting share</strong>. With no advantage, each of the 2N copies is equally likely to be the one that all later copies descend from.</p>`,
			notes: `<p>This is the Wright–Fisher model (Sewall Wright, Ronald Fisher, around 1930): fixed N, generations that don’t overlap, and the next generation’s copies drawn with replacement from this one’s. From p = ½ a neutral allele is lost or fixed after about 2.8N generations on average (4N ln 2, Kimura and Ohta 1969). Real populations are not ideal: unequal family sizes, an uneven sex ratio and past bottlenecks make them drift like a smaller one, of <dfn data-def="The size of an ideal Wright–Fisher population that would drift as fast as the real one. It is usually well below the census size.">effective size</dfn> Nₑ. For humans, the long-term Nₑ is often put at about 10,000, against 8 billion people today.</p>`
		},
		{
			id: 'heterozygosity',
			chapter: 'drift',
			title: 'Drift uses up variation',
			scene: 'traces',
			hints: { mode: 'hetero', N: 'N_d', p0: 0.5, again: 'again_d' },
			duration: 30,
			controls: [
				size('N_d', [10, 30, 100, 300, 1000], 30),
				again('again_d', 'A hundred new populations.')
			],
			body: `
<p>A population’s variation at a gene can be measured by its <dfn data-def="The chance that two gene copies drawn at random from the population are different alleles: 2pq for two alleles. It is also the share of heterozygotes under Hardy–Weinberg.">heterozygosity</dfn>, 2pq: the chance that two copies picked at random differ. It is largest, ½, at p = ½, and zero once an allele is lost or fixed.</p>
<p>Each faint line is one population’s 2pq. Single lines jump about, but their average (thick) falls smoothly, by <strong>1/2N each generation</strong>, the dashed curve. The reason: two copies in the next generation are copies of the <em>same</em> parent copy with chance 1/2N, and then they are identical.</p>
<p>So drift steadily removes variation, at a rate set by N alone: half of it is gone after about <strong>1.4 N generations</strong>, 42 generations for N = 30, about 1,400 for N = 1,000. Only new mutations, and migrants, bring it back.</p>`,
			notes: `<p>After t generations the expected heterozygosity is H₀ (1 − 1/2N)ᵗ, about H₀ e<sup>−t/2N</sup>. The same 1/2N is the chance that two copies find their common ancestor in the previous generation: tracing copies backwards until they meet is the <dfn data-def="The theory of how sampled gene copies trace back to common ancestors; under drift alone, two copies meet on average 2N generations back.">coalescent</dfn>, which geneticists use to read past population sizes out of today’s variation.</p>`
		},
		// ---------------------------------------------------------------- selection
		{
			id: 'selection',
			chapter: 'selection',
			title: 'Selection bends the traces',
			scene: 'traces',
			hints: { mode: 'selection', N: 'N_s', s: 's_s', p0: 0.2, again: 'again_s' },
			duration: 30,
			controls: [
				advantage('s_s', [-0.02, -0.01, -0.001, 0, 0.001, 0.01, 0.02, 0.05], 0.02),
				size('N_s', [10, 30, 100, 300, 1000], 100),
				again('again_s', 'A hundred new populations.')
			],
			body: `
<p>Now give A an advantage. On this page <strong>s is the advantage of one copy</strong>: an Aa carrier leaves on average 1 + s offspring for every 1 of an aa, and an AA 1 + 2s, when the effects of the two copies add up (the next steps change that). Before the newborns are sampled, the carriers’ extra offspring tilt the pool towards A, by about <strong>s·pq</strong> per generation.</p>
<p>A hundred populations start at 20% A. The dashed line is a population too large for chance to matter: selection alone. With s = +2% and N = 100 most traces follow it up, but not all: drift still loses A in some. Set s below zero and A is harmful: in a large population it is lost, but at <strong>N = 10</strong> it can still be fixed. Set s to ±0.1% at N = 100 and the traces look like pure drift.</p>
<p>Selection and drift are different forces. Selection pushes every population the same way; drift pushes each a different, random way, by about √(pq/2N). Which one wins depends on <strong>N × s</strong>.</p>`,
			notes: `<p>The fixation counter compares the simulation with Motoo Kimura’s 1962 diffusion formula: an allele at share p is fixed with chance (1 − e<sup>−4Nsp</sup>) / (1 − e<sup>−4Ns</sup>), which tends to p as s → 0. Many textbooks write fitnesses as 1, 1 + hs, 1 + s instead: their s is the advantage of the AA homozygote, twice this page’s.</p>`
		},
		{
			id: 'new-mutations',
			chapter: 'selection',
			title: 'Most new beneficial mutations are lost',
			scene: 'traces',
			hints: { mode: 'new', N: 'N_n', s: 's_n', again: 'again_n' },
			duration: 30,
			controls: [
				advantage('s_n', [0, 0.01, 0.02, 0.05, 0.1], 0.05),
				size('N_n', [100, 1000, 10000], 1000),
				again('again_n', '2,000 new mutations.')
			],
			body: `
<p>A new mutation starts as <strong>one copy</strong>, in one heterozygote. Even with an advantage, that carrier may have few children, or pass on its other copy: at one copy, chance dominates however large the population. Here 2,000 new mutations each start as one copy; the lines follow the first 100, with the copies on a scale where each line up is ten times more.</p>
<p>Nearly all of them die out within a few generations. A beneficial one fixes with a chance of about <strong>2s</strong> (J. B. S. Haldane, 1927): with s = 5%, about <strong>1 in 10</strong>. Change N from 100 to 10,000: the chance stays near 2s. A larger population is no safer for a new mutation; it just produces more of them.</p>
<p>The few that survive the first generations escape once they number about <strong>1/s copies</strong> (the dotted line): from there selection carries them up, and they are rarely lost. With no advantage, the chance is the neutral <strong>1/2N</strong>.</p>`,
			notes: `<p>Haldane’s 2s comes from treating the rare copies as a branching process: each copy leaves a random number of copies, on average 1 + s, so a line of descent dies out with chance about 1 − 2s. It needs N × s well above 1 and a small s; Kimura’s formula, which the counter shows, holds for any N. With 1/s copies, the chance that every one of them dies out is about (1 − 2s)<sup>1/s</sup> ≈ e<sup>−2</sup>, 14%.</p>`
		},
		{
			id: 'dominance',
			chapter: 'selection',
			title: 'Recessive alleles hide from selection',
			scene: 'traces',
			hints: { mode: 'dominance', h: 'h_d', s: 0.05, N: 1000, p0: 0.02, again: 'again_dom' },
			duration: 30,
			controls: [
				{
					type: 'select',
					id: 'h_d',
					label: 'A’s advantage shows in',
					default: '0',
					options: [
						{ value: '0', label: 'AA only (recessive)' },
						{ value: '0.5', label: 'Half in Aa (additive)' },
						{ value: '1', label: 'Aa as much as AA (dominant)' }
					]
				},
				again('again_dom', 'A hundred new populations.')
			],
			body: `
<p>So far a copy’s effect did not depend on the other copy. Often it does. If A is <dfn data-def="An allele whose effect shows only when an individual carries two copies of it.">recessive</dfn>, Aa looks like aa, and only AA has the advantage (here AA leaves 10% more offspring). If A is <dfn data-def="An allele whose full effect shows with a single copy.">dominant</dfn>, Aa has the full advantage already.</p>
<p>While A is rare, nearly every copy sits in a heterozygote: at 2%, <strong>98% of the copies of A</strong> are in Aa, where a recessive A has no effect. Selection cannot see it, and it drifts: the dashed curve (a very large population) barely leaves the floor for hundreds of generations, and many populations lose A by chance. A dominant A takes off at once, but stalls near the top: the last copies of a now hide in heterozygotes.</p>
<p>The same hiding keeps <strong>harmful</strong> recessive alleles in populations: carried in heterozygotes, they are rarely exposed to selection.</p>`,
			notes: `<p>A new recessive mutation fixes with a chance of about √(2S/πN), with S the advantage of AA (Kimura 1957): 0.8% here for N = 1,000, against 9.5% if it were additive. The faint dashed curves are the two other dominances, for comparison. Cystic fibrosis is a harmful recessive example: about 1 in 25 people of northern European descent carries one copy of a disease-causing allele, without symptoms.</p>`
		},
		// ---------------------------------------------------------------- balance
		{
			id: 'n-times-s',
			chapter: 'balance',
			title: 'When chance beats selection',
			scene: 'balance',
			hints: { N: 'N_b', s: 's_b' },
			duration: 30,
			controls: [
				size('N_b', [10, 100, 1000, 10000], 100),
				{
					type: 'range',
					id: 's_b',
					label: 'Advantage per copy of A, s',
					min: -0.02,
					max: 0.02,
					step: 0.001,
					default: -0.005,
					format: (v) => (Math.abs(v) < 1e-9 ? 'none (neutral)' : `${pct(v)} offspring`)
				}
			],
			body: `
<p>One curve sums it up: the chance that a new mutation is fixed, compared with a neutral one’s 1/2N, against <strong>N × s</strong>. For small s, it depends on N and s only through their product.</p>
<p>Where N × |s| is below about ¼ (the shaded band), drift rules: harmful and beneficial mutations fix within a factor of two of a neutral one’s chance. Well above 1, selection rules: a harmful mutation essentially never fixes, and a beneficial one fixes about 4N·s times as often as a neutral one, which is the 2s of the previous step.</p>
<p>So the same allele can be at the mercy of chance in a small population and firmly selected in a large one. With N = 10 and each copy 1% worse, a new mutation still fixes <strong>4% of the time</strong>, against 5% for a neutral one; with N = 1,000 it practically never does. The dot also shows the share fixed in 4,000 simulated runs.</p>`,
			notes: `<p>This is why small populations, such as endangered species or island founders, can accumulate slightly harmful mutations, and why many changes in DNA that matter little are best understood as drifting: Kimura’s neutral theory (1968) and Tomoko Ohta’s nearly neutral theory (1973). N here is the effective size Nₑ, and the band’s edges are rules of thumb, not sharp limits.</p>`
		}
	]
};
