import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 1 : 0)}%`;

const prevalence: Control = {
	type: 'range',
	id: 'prevalence',
	label: 'How common the disease is',
	min: 0.001,
	max: 0.5,
	step: 0.001,
	default: 0.01,
	format: (v) => `${pct(v)} (${Math.round(v * 1000)} in 1,000)`
};

const sensitivity: Control = {
	type: 'range',
	id: 'sensitivity',
	label: 'Ill people the test catches',
	min: 0.5,
	max: 1,
	step: 0.01,
	default: 0.9,
	format: pct,
	help: 'Sensitivity: the share of ill people who test positive.'
};

const specificity: Control = {
	type: 'range',
	id: 'specificity',
	label: 'Healthy people the test clears',
	min: 0.5,
	max: 1,
	step: 0.01,
	default: 0.91,
	format: pct,
	help: 'Specificity: the share of healthy people who test negative.'
};

export const spec: ExplainerSpec = {
	slug: 'bayes-theorem',
	title: 'What a positive test really means',
	summary:
		'Colour a crowd of 1,000 people by who is ill and who tests positive, and count your way to Bayes’ theorem — and to why an accurate test for a rare disease is often wrong.',
	chapters: [
		{ id: 'crowd', title: 'Counting people' },
		{ id: 'bayes', title: "Bayes' theorem" }
	],
	steps: [
		{
			id: 'crowd',
			chapter: 'crowd',
			title: 'A thousand people',
			scene: 'grid',
			hints: { phase: 'crowd' },
			duration: 18,
			body: `
<p>A disease affects 1 person in 100. A test for it catches 90% of the people who have it and correctly clears 91% of those who don't. You test positive. How likely is it that you are ill?</p>
<p>Most people — doctors included, in many studies — guess around 90%. Let's count instead. Here are 1,000 people. About 1% of them, <strong>10 people</strong>, have the disease (highlighted); the other 990 are healthy.</p>`
		},
		{
			id: 'test',
			chapter: 'crowd',
			title: 'Everyone takes the test',
			scene: 'grid',
			hints: { phase: 'test' },
			duration: 22,
			body: `
<p>Of the 10 ill people, the test catches 90%: <strong>9 true positives</strong>, and 1 false negative who is ill but tests negative.</p>
<p>Of the 990 healthy people, the test clears 91% — but that leaves 9% of them, <strong>89 people, testing positive</strong> although they are healthy: false positives. The rest, 901, are true negatives.</p>`
		},
		{
			id: 'positives',
			chapter: 'crowd',
			title: 'Look only at the positives',
			scene: 'grid',
			hints: { phase: 'positives' },
			duration: 22,
			body: `
<p>You tested positive, so you are one of the 9 + 89 = <strong>98 people</strong> who did. Of those, only 9 are actually ill.</p>
<p>So the chance that you are ill is 9 in 98 — about <strong>9%</strong>, not 90%. The test is good; the trouble is that the disease is rare. There are so many more healthy people that even a small share of them testing positive swamps the few true cases.</p>`
		},
		{
			id: 'sliders',
			chapter: 'bayes',
			title: 'The base rate decides',
			scene: 'grid',
			hints: { phase: 'sliders' },
			duration: 30,
			controls: [prevalence, sensitivity, specificity],
			body: `
<p>Now change the numbers. Make the disease common — 30 in 100 — and the same test's positives are real more than 80% of the time. Make the test much better, 99% each way, but keep the disease at 1 in 100: a positive is still only a coin toss.</p>
<p>How common something is before you look at the evidence is called the <dfn data-def="How common something is in the group being tested, before any test result is known (also called the prior probability or prevalence).">base rate</dfn>. Ignoring it — the <dfn data-def="Judging the meaning of evidence while ignoring how common the thing is to begin with.">base-rate fallacy</dfn> — is one of the most common mistakes in reasoning about evidence.</p>`
		},
		{
			id: 'formula',
			chapter: 'bayes',
			title: "Bayes' theorem",
			scene: 'grid',
			hints: { phase: 'formula' },
			duration: 26,
			controls: [prevalence, sensitivity, specificity],
			body: `
<p>The counting you just did is <dfn data-def="P(A | B) = P(B | A) × P(A) ÷ P(B): how to update the chance of A after seeing evidence B. Published after the death of Thomas Bayes, in 1763.">Bayes' theorem</dfn>, published in 1763 from the notes of the minister Thomas Bayes:</p>
<p class="formula">chance ill, given positive = (chance positive if ill × chance ill) ÷ chance of a positive</p>
<p>Each part is one of the groups in the grid: true positives on top, all positives below. Counting people — "natural frequencies" — makes it easy to see.</p>
<p>What a piece of evidence means depends on the base rate: <strong>a positive result from an accurate test for a rare condition can still be more likely false than true</strong>. That is why doctors confirm a positive screening result with a second, different test: after one positive, the base rate for a second test is no longer 1% but 9% — and a second positive from an independent test raises the chance to about 50%.</p>`,
			notes: `<p>The example is the classic one used by Gerd Gigerenzer to show how much easier these problems become with counts of people than with percentages. Real screening tests have their own numbers, and "independent" second tests are an idealisation.</p>`
		}
	]
};
