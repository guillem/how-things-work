import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const comparison: Control = {
	type: 'select',
	id: 'comparison',
	label: 'Compare flipper length of',
	default: 'species',
	options: [
		{ value: 'species', label: 'Adelie vs Chinstrap' },
		{ value: 'torgersen', label: 'Adelie: Biscoe vs Torgersen' },
		{ value: 'dream', label: 'Adelie: Biscoe vs Dream' }
	]
};

const perGroup: Control = {
	type: 'select',
	id: 'perGroup',
	label: 'Penguins per group',
	default: 'all',
	options: [
		{ value: '5', label: '5' },
		{ value: '10', label: '10' },
		{ value: '20', label: '20' },
		{ value: '40', label: '40' },
		{ value: 'all', label: 'all' }
	],
	help: 'A smaller sample of the same penguins, drawn at random.'
};

const redraw: Control = {
	type: 'action',
	id: 'redraw',
	label: 'Randomness',
	action: 'New random draw'
};

const species: Control = {
	type: 'select',
	id: 'species',
	label: 'Species',
	default: 'Adelie',
	options: [
		{ value: 'Adelie', label: 'Adelie (151)' },
		{ value: 'Chinstrap', label: 'Chinstrap (68)' },
		{ value: 'Gentoo', label: 'Gentoo (123)' }
	]
};

// No 5 here: with so few penguins a resample often repeats one flipper length, and has no slope.
const perSpecies: Control = {
	...perGroup,
	id: 'perSpecies',
	label: 'Penguins',
	options: perGroup.options.filter((o) => o.value !== '5')
};

/** The coverage controls; the later steps get their own copies with other starting values. */
const sampleSize = (id: string, value: number): Control => ({
	type: 'range',
	id,
	label: 'Sample size n',
	min: 5,
	max: 200,
	step: 5,
	default: value
});
const skew = (id: string, value: number): Control => ({
	type: 'range',
	id,
	label: 'Skew of the population',
	min: 0,
	max: 1,
	step: 0.1,
	default: value,
	format: (v) => (v === 0 ? 'none (normal)' : v.toFixed(1))
});
const statistic = (id: string, value: string): Control => ({
	type: 'select',
	id,
	label: 'Interval for the population’s',
	default: value,
	options: [
		{ value: 'mean', label: 'mean' },
		{ value: 'max', label: 'maximum' }
	]
});
const rerun: Control = { type: 'action', id: 'rerun', label: 'Experiment', action: 'Run again' };

export const spec: ExplainerSpec = {
	slug: 'resampling-inference',
	title: 'The bootstrap & permutation tests',
	summary:
		'Shuffle the labels of real penguins to see what chance alone produces and read a p-value off it; resample them with replacement to put an interval on a difference and on a slope; then check that interval against a population whose truth is known, and watch its 95% fall short.',
	chapters: [
		{ id: 'test', title: 'Is the difference real?' },
		{ id: 'bootstrap', title: 'How big is it?' },
		{ id: 'coverage', title: 'Does the 95% hold?' }
	],
	steps: [
		// ------------------------------------------------------------------ test
		{
			id: 'difference',
			chapter: 'test',
			title: 'Two species, two averages',
			scene: 'shuffle',
			hints: { phase: 'data' },
			duration: 20,
			controls: [comparison, perGroup, redraw],
			body: `
<p>Between 2007 and 2009 researchers of the Palmer Station programme in Antarctica measured 342 penguins of three species. Each dot is one penguin's flipper. The 68 <b>Chinstrap</b> penguins' flippers are on average <strong>5.9 mm longer</strong> than the 151 <b>Adelie</b> penguins'.</p>
<p>But the groups overlap a lot, and these are only the penguins that happened to be caught. Could a gap of 5.9 mm come from the luck of which birds were measured, with no real difference between the species? A textbook answers with a formula and its assumptions (a t-test). <dfn data-def="Methods that answer questions about uncertainty by drawing new samples from the data itself, many times over, instead of from a formula.">Resampling</dfn> answers by rebuilding chance from the data itself.</p>`,
			notes: `<p>The data are the Palmer penguins (Gorman, Williams &amp; Fraser 2014), collected by Kristen Gorman with the Palmer Station Long Term Ecological Research Program and published by Horst, Hill &amp; Gorman as the <i>palmerpenguins</i> package (CC0). The two penguins without measurements are left out. The page treats the penguins as independent, representative draws from each group; the study actually sampled the pairs at selected nests on each island, over three seasons, and these calculations ignore that structure, so their uncertainty need not carry over to the wider populations. The other comparisons pit Adelie penguins from different islands against each other.</p>`
		},
		{
			id: 'shuffle',
			chapter: 'test',
			title: 'Shuffle the labels',
			scene: 'shuffle',
			hints: { phase: 'shuffle' },
			duration: 24,
			controls: [comparison, perGroup, redraw],
			body: `
<p>Suppose the species made no difference to flipper length: the <dfn data-def="The hypothesis that nothing is going on: here, that both groups' flipper lengths come from the same distribution.">null hypothesis</dfn>. Then the labels “Adelie” and “Chinstrap” are arbitrary tags on 219 flipper lengths, and any other way of handing out 151 and 68 tags would have been just as likely.</p>
<p>So shuffle them. Pool the measurements, deal the labels out again at random, keeping the group sizes, and compute the difference of the two averages. Do it <strong>9,999 times</strong>. The histogram below is what <em>chance alone</em> produces when the labels mean nothing: the <dfn data-def="The distribution of the statistic over all the relabellings of the data; under the null hypothesis, every relabelling is equally likely.">permutation distribution</dfn>, centred on zero, with 95% of the shuffles within about ±2 mm for these group sizes. Fewer penguins per group make it wider.</p>`
		},
		{
			id: 'p-value',
			chapter: 'test',
			title: 'Where the observed gap falls',
			scene: 'shuffle',
			hints: { phase: 'p' },
			duration: 30,
			controls: [comparison, perGroup, redraw],
			body: `
<p>The <dfn data-def="The chance, if the null hypothesis were true, of a result at least as extreme as the one observed.">p-value</dfn> is the share of shuffles at least as far from zero as the real gap (either way, so the test is two-sided). Count them, add one, and divide by the number of shuffles plus one: <b>p = (count + 1) / (9,999 + 1)</b>. The +1 counts the real labelling, which is itself one of the possible shuffles, so the estimate is never an impossible 0. With all the penguins, <strong>not one</strong> of 9,999 shuffles reaches 5.9 mm: p = 1/10,000, the smallest that this many shuffles can report.</p>
<p>A p-value is <strong>not the chance that the null hypothesis is true</strong>. It is the chance, <em>if</em> the null were true, of a gap at least as far from zero as the one observed; as <a href="../bayes-theorem/#positives">Bayes' theorem</a> shows, turning that around into the chance that the null is true needs a prior. Set <b>5 per group</b>: the species really do differ, yet p comes out at 0.053, and most other draws of five penguins (New random draw) give far larger values, some above 0.5. A large p means the data can't tell, not that there is no difference. Adelie penguins from Biscoe and from Torgersen give p ≈ 0.07.</p>`,
			notes: `<p>With 4 penguins per group there are only 70 ways to hand out the labels, and the exact p-value counts them all; the shuffles approximate it. For large groups the permutation distribution is close to a normal curve (the <a href="../central-limit-theorem/#clt">central limit theorem</a>), and the p-value agrees with the normal approximation: 0.072 against 0.073 for Biscoe and Torgersen (Welch's t-test, which allows for the small samples, gives 0.076). The +1 rule is the one recommended by Phipson &amp; Smyth (2010). Strictly, the test asks whether the two groups could share one distribution, not only one mean.</p>`
		},
		// ------------------------------------------------------------------ bootstrap
		{
			id: 'bootstrap',
			chapter: 'bootstrap',
			title: 'Resample with replacement',
			scene: 'boot',
			duration: 28,
			controls: [comparison, perGroup, redraw],
			body: `
<p>The difference is probably real, but how big is it? If we could catch new penguins we would see how much the gap moves from sample to sample. We can't, so the <dfn data-def="Efron's method (1979): estimate the variability of a statistic by recomputing it on many samples drawn with replacement from the data.">bootstrap</dfn> uses the sample as a stand-in for the population: draw 151 Adelie flippers <em>with replacement</em> from the 151 we have (some twice or more; about a third, 1/e, not at all), and 68 Chinstrap from the 68, and recompute the gap.</p>
<p>Repeat 2,000 times. The spread of these gaps estimates the <dfn data-def="The standard deviation of a statistic over repeated samples: how much it would vary if the study were done again.">standard error</dfn>: 1.0 mm, as the formula √(s₁²/n₁ + s₂²/n₂) says. The middle 95% of them, from the 2.5th to the 97.5th percentile, is the <strong>percentile interval</strong>: about 3.8 to 7.8 mm.</p>`,
			notes: `<p>The interval is a procedure that, applied again and again, is meant to catch the true difference 95% of the time; it is not a 95% chance for this one interval (that would need a prior again). Whether the procedure keeps its promise is the question of the last chapter.</p>`
		},
		{
			id: 'slope',
			chapter: 'bootstrap',
			title: 'An interval for a slope',
			scene: 'slope',
			duration: 28,
			controls: [species, perSpecies, redraw],
			body: `
<p>Penguins with longer flippers are heavier. The least-squares line through body mass against flipper length (as in <a href="../learning-from-data/#line">learning from data</a>) rises about <strong>33 g per mm</strong> for Adelie penguins. How sure is that slope?</p>
<p>Resample the penguins, each one's flipper and mass together, fit a new line to each resample, and collect the slopes. The faint lines are the latest of 1,000 resamples; their slopes' middle 95% is about 24 to 43 g per mm. Nothing here assumes the scatter around the line is the same everywhere, which the textbook formula for the slope's error does. Cut the sample to 10 penguins and the fan of lines opens wide.</p>`,
			notes: `<p>Resampling whole penguins (the “case” or “pairs” bootstrap) keeps whatever link there is between flipper length and the scatter of mass. Its standard error for Adelie, 4.7 g/mm, is close to the textbook 5.1; for Gentoo it is 4.3 against 5.0. A different scheme resamples the residuals around the fitted line instead, which assumes they are interchangeable.</p>`
		},
		// ------------------------------------------------------------------ coverage
		{
			id: 'coverage',
			chapter: 'coverage',
			title: 'Catch the truth',
			scene: 'coverage',
			hints: { phase: 'coverage' },
			duration: 26,
			controls: [sampleSize('n', 50), skew('skew', 0), statistic('stat', 'mean'), rerun],
			body: `
<p>With real penguins nobody knows the true difference, so no one can check whether an interval caught it. With a population we invent, we can. Here are <strong>5,000 simulated values</strong> with a known mean (the line through the top chart).</p>
<p>Draw a sample of <i>n</i>, bootstrap it 500 times, take the percentile interval, and see whether it contains the true mean. Then do the whole thing again: <strong>300 times</strong>. Each line below is one interval; the misses are marked. The counter is the interval's real <dfn data-def="The share of repeated experiments in which the interval contains the true value. A 95% interval should have 95% coverage.">coverage</dfn>, with its own margin, since 300 repeats are a sample too. For 50 values from a normal population it comes close to the 95% it claims.</p>`
		},
		{
			id: 'shortfall',
			chapter: 'coverage',
			title: 'Small and skewed samples',
			scene: 'coverage',
			hints: { phase: 'shortfall' },
			duration: 26,
			controls: [
				sampleSize('n:shortfall', 10),
				skew('skew:shortfall', 1),
				statistic('stat:shortfall', 'mean'),
				rerun
			],
			body: `
<p>Now a sample of 10 from a population with a long right tail. The interval still says 95%, but it catches the true mean only about <strong>5 times in 6</strong>, and nearly all its misses fall short: a small sample usually lacks the rare large values that pull the mean up, and resampling it can't invent them. Even from a normal population, 10 values give only about 90% in the long run (press Run again a few times): the bootstrap's spread is a little too narrow for small samples.</p>
<p>Slide <i>n</i> up and the coverage climbs back towards 95%. <strong>The bootstrap does not cure a small sample.</strong> It can only be as good as the sample is as a picture of the population.</p>`,
			notes: `<p>Better-behaved intervals exist: the bootstrap-t and the bias-corrected and accelerated (BCa) interval of Efron (1987) correct for skewness and come closer to 95% for moderate samples, but no method recovers what a sample of 10 does not contain. Hesterberg (2015) recommends checking coverage like this before trusting the percentile interval for small samples.</p>`
		},
		{
			id: 'maximum',
			chapter: 'coverage',
			title: 'Where the bootstrap fails',
			scene: 'coverage',
			hints: { phase: 'maximum' },
			duration: 26,
			controls: [
				sampleSize('n:maximum', 50),
				skew('skew:maximum', 0),
				statistic('stat:maximum', 'max'),
				rerun
			],
			body: `
<p>Ask for an interval for the population's <strong>largest</strong> value instead. No resample can contain a value bigger than the sample's own largest, so every interval stops at or below it, short of the truth unless the sample happened to include the single largest of the 5,000 (a chance of about <i>n</i> in 5,000). The coverage collapses to <strong>near zero</strong> at every sample size offered here, 5 to 200.</p>
<p>The bootstrap works for statistics that depend smoothly on the whole sample, like the mean, a difference of means or a slope. The maximum hangs on one extreme value the sample rarely contains. Resampling rebuilds the chance distribution from the data, and it is only as good as the data are as a stand-in for the population.</p>`,
			notes: `<p>The failure for the maximum is a classical example (Bickel &amp; Freedman 1981): about 63% (1 − 1/e) of resamples contain the sample's largest value, so the bootstrap distribution of the maximum piles up on a single point instead of mimicking the real sampling distribution.</p>`
		}
	]
};
