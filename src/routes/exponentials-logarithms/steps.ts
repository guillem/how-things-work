import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { fmt, times } from './format';

/** How many times the sheet is folded; the scene counts up to it. */
const folds: Control = {
	type: 'range',
	id: 'folds',
	label: 'Folds',
	min: 0,
	max: 42,
	step: 1,
	default: 42,
	help: 'The counter runs up to this many folds, one doubling each.'
};

/** The fixed amount added each step in the race. */
const add: Control = {
	type: 'range',
	id: 'add',
	label: 'Add each step',
	min: 0,
	max: 50,
	step: 1,
	default: 10,
	format: (v) => `+${v}`
};

/** The fixed factor in the race and on the log axis. */
const factor: Control = {
	type: 'range',
	id: 'factor',
	label: 'Multiply each step by',
	min: 1,
	max: 1.3,
	step: 0.01,
	default: 1.05,
	format: (v) => `${times(v)} (+${Math.round((v - 1) * 100)} %)`
};

const logAxis: Control = {
	type: 'toggle',
	id: 'log',
	label: 'Log scale on the vertical axis',
	default: true,
	help: 'Each gridline up is ten times the one below.'
};

/** Growth per step as a percentage, for the doubling count. */
const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Growth each step',
	min: 1,
	max: 100,
	step: 1,
	default: 10,
	format: (v) => `+${v} % (${times(1 + v / 100)})`
};

/** The age of the sample on the carbon-14 step, in years. */
const age: Control = {
	type: 'range',
	id: 'age',
	label: 'Age of the sample',
	min: 0,
	max: 60000,
	step: 100,
	default: 11400,
	format: (v) => `${fmt(v)} years`
};

const logDecay: Control = { ...logAxis, id: 'logDecay', default: false };

/** The number whose logarithm is counted, as its power of ten (so the slider is a log scale too). */
const number: Control = {
	type: 'range',
	id: 'number',
	label: 'Number',
	min: 0,
	max: 6,
	step: 0.01,
	default: 3,
	format: (v) => fmt(Number((10 ** v).toPrecision(3))),
	help: 'Or drag the marker along the line. The slider moves on a log scale too: each sixth of it is ×10.'
};

const factorA: Control = {
	type: 'range',
	id: 'a',
	label: 'First number a',
	min: 1,
	max: 10,
	step: 0.01,
	default: 2,
	format: (v) => v.toFixed(2),
	help: 'Or drag the slide.'
};

const factorB: Control = {
	type: 'range',
	id: 'b',
	label: 'Second number b',
	min: 1,
	max: 10,
	step: 0.01,
	default: 3,
	format: (v) => v.toFixed(2),
	help: 'Or drag the cursor.'
};

export const spec: ExplainerSpec = {
	slug: 'exponentials-logarithms',
	title: 'Exponentials & logarithms',
	summary:
		'Fold paper to the Moon, race adding against multiplying, straighten the curve on a log scale, count doublings with a logarithm and multiply on a working slide rule.',
	chapters: [
		{ id: 'grow', title: 'Adding and multiplying' },
		{ id: 'log', title: 'The log scale' },
		{ id: 'count', title: 'Logarithms count steps' },
		{ id: 'rule', title: 'The slide rule' }
	],
	steps: [
		// ------------------------------------------------------------------ grow
		{
			id: 'fold',
			chapter: 'grow',
			title: 'Fold a sheet of paper',
			scene: 'growth',
			hints: { phase: 'fold' },
			duration: 16,
			controls: [folds],
			body: `
<p>A sheet of printer paper is about <strong>0.1 mm</strong> thick. Fold it in half and the stack is two sheets thick; fold again, four; again, eight. Every fold <strong>doubles</strong> the thickness.</p>
<p>Seven folds make 128 layers, about 13 mm: the thickness of a notebook. Keep going, on paper at least: 14 folds pass a person's height, 27 pass Mount Everest, and <strong>42 folds</strong> would reach past the Moon, 384,400 km away.</p>
<p>Watch the chart as the counter runs. Each new fold adds as much as all the folds before it put together, so the newest point always dwarfs the rest, and the earlier ones are squashed flat against the bottom.</p>`,
			notes: `<p>Real paper gives up long before the Moon: each fold needs a longer sheet and more force. The record is 12 folds, by Britney Gallivan in 2002, with a strip of thin paper more than a kilometre long. The numbers here are the arithmetic of doubling, a thought experiment rather than a recipe.</p>`
		},
		{
			id: 'race',
			chapter: 'grow',
			title: 'Add the same, or multiply by the same',
			scene: 'growth',
			hints: { phase: 'race' },
			duration: 14,
			controls: [add, factor],
			body: `
<p>Two ways to grow from 100. The <strong class="tag add">first</strong> adds the same amount every step: 100, 110, 120, 130… That is <dfn data-def="Growth by the same amount in every step: the points lie on a straight line.">linear growth</dfn>. The <strong class="tag mul">second</strong> multiplies by the same factor every step: ×1.05 is 100, 105, 110.25, 115.76… That is <dfn data-def="Growth by the same factor in every step: the amount added grows with the amount already there.">exponential growth</dfn>, the way money grows at 5 % compound interest.</p>
<p>At first the adder wins easily: 10 a step against 5. But the multiplier's steps grow with it. With these settings it catches up at <strong>step 27</strong> and by step 60 it is more than twice as big, and the gap keeps widening.</p>
<p>Make the factor just above 1, say ×1.01: the multiplier crawls, and trails for hundreds of steps. <strong>Exponential does not mean fast.</strong> It means the steps keep growing, so with any factor above 1 it overtakes any fixed amount in the end.</p>`,
			notes: `<p>The ×1.05 curve is <i>100 × 1.05ⁿ</i> after <i>n</i> steps: the step number is the <dfn data-def="The small raised number in 2³, telling how many times to multiply by the base: 2³ = 2 × 2 × 2.">exponent</dfn>, which is where the word exponential comes from. Bank interest compounded once a year works exactly like this; “simple” interest, paid on the starting sum only, is the adder.</p>`
		},
		{
			id: 'doubling',
			chapter: 'grow',
			title: 'Doubling, again and again',
			scene: 'growth',
			hints: { phase: 'doubling' },
			duration: 16,
			controls: [rate],
			body: `
<p>Any growth by a fixed factor doubles in a fixed number of steps, whatever the size it starts from. Set the growth per step and count: the dashed lines mark 2, 4, 8, 16… and the doublings are <strong>evenly spaced</strong> along the steps.</p>
<p>A bacterium such as <i>E. coli</i>, well fed and warm, splits in two about every 20 minutes: a factor of 2 per step (+100 %). In a day that is 72 doublings, 2<sup>72</sup> ≈ 4.7 × 10²¹ cells. That would weigh thousands of tonnes; in real life the food runs out at a few billion cells per millilitre, and the growth stops.</p>
<p>A rule of thumb gives the doubling time: <strong>72 ÷ the percentage</strong>. At 10 % a step, 72 ÷ 10 = 7.2 steps; the exact count is 7.27. Money at 5 % a year doubles in about 14 years.</p>`,
			notes: `<p>How good is the rule of 72? From 1 % to 14 % it is within 3.5 % of the exact doubling time, and spot on near 8 %. The rule of 70 is closer for small rates (within 3 % up to 8 %). Neither works for big factors: at +100 % a step the value doubles in exactly 1 step, and 72 ÷ 100 = 0.72 is 28 % short. The exact doubling time is log 2 ÷ log(1 + rate), in any base: the next chapters show what that log means.</p>`
		},
		// ------------------------------------------------------------------ log
		{
			id: 'logaxis',
			chapter: 'log',
			title: 'A log scale makes it straight',
			scene: 'growth',
			hints: { phase: 'log' },
			duration: 14,
			controls: [add, factor, logAxis],
			body: `
<p>The same race, with the vertical axis changed. On a <dfn data-def="An axis on which each equal step up multiplies the value by the same factor, usually 10, instead of adding the same amount.">log scale</dfn> the gridlines are 10, 100, 1,000, 10,000: each one is <em>ten times</em> the one below, at the same spacing.</p>
<p>Now the <strong class="tag mul">multiplier</strong> is a <strong>straight line</strong>. Every step multiplies by the same factor, and on this axis multiplying by the same factor always means going up by the same height. The slope tells you the factor: steeper is a bigger factor. The triangle shows how many steps one ×10 takes.</p>
<p>The <strong class="tag add">adder</strong>, which looked straight before, now bends over: each +10 is a smaller and smaller <em>fraction</em> of what is already there. Switch the scale off and on to see both at once change shape.</p>`,
			notes: `<p>The height of one step on the log axis is the logarithm of the factor: log₁₀ 1.05 ≈ 0.021 of a ×10 gridline. So ×10 takes 1 ÷ 0.021 ≈ 47 steps. That is what “the slope is the logarithm of the factor” means; the growth factor and the slope go together.</p>`
		},
		{
			id: 'steady',
			chapter: 'log',
			title: 'Straight is not slowing down',
			scene: 'growth',
			hints: { phase: 'steady' },
			duration: 14,
			controls: [factor],
			body: `
<p>A trap: on a log scale, explosive growth looks calm. The <strong class="tag mul">same growth</strong> is drawn twice here, on an ordinary axis on the left and a log axis on the right. On the right it is a tame straight line; on the left it is shooting up. Both are true pictures. A straight line on a log scale means the growth rate <strong>stays the same</strong>: it is not slowing down.</p>
<p>What slowing down looks like is the <strong class="tag slow">other curve</strong>: a population that starts with the same factor but runs out of food. On the log axis it <em>bends over</em> and flattens. When an epidemic chart on a log scale stays straight, the outbreak is still growing by the same factor every day; only a bend means it is easing.</p>`,
			notes: `<p>The slowing curve is the textbook “logistic” growth: each step adds the factor's share times the room left, so the growth fades as the population nears what the food can feed (here a million times the start).</p>`
		},
		{
			id: 'decay',
			chapter: 'log',
			title: 'Shrinking by a factor: decay',
			scene: 'growth',
			hints: { phase: 'decay' },
			duration: 14,
			controls: [age, logDecay],
			body: `
<p>A factor below 1 shrinks. <a href="../radioactivity/#halflife">Carbon-14</a> in a dead tree or bone halves every <strong>5,700 years</strong>, its <dfn data-def="The time in which half of a radioactive substance decays. After two half-lives a quarter is left, not none.">half-life</dfn>: a factor of ½ per step of 5,700 years. After two half-lives a quarter is left, after three an eighth.</p>
<p>Drag the age and read how much is left. The number of half-lives is again a count of steps: from the share left, count how many halvings it took.</p>
<p>Switch on the log scale: decay too becomes a straight line, sloping down. After ten half-lives, 57,000 years, only 1/1,024 is left, about 0.1 %, too little to measure well; that is why radiocarbon dating stops at around 50,000 years.</p>`
		},
		// ------------------------------------------------------------------ count
		{
			id: 'count',
			chapter: 'count',
			title: 'A logarithm counts doublings',
			scene: 'count',
			hints: { phase: 'two' },
			duration: 12,
			controls: [number],
			body: `
<p>Turn the question round. Not “what is 2 doubled ten times?” but “<strong>how many doublings</strong> take 1 to 1,000?” That count is the <dfn data-def="How many times you must multiply by the base to get a number. log₂ 8 = 3 because 2 × 2 × 2 = 8.">logarithm</dfn> base 2, written log₂.</p>
<p>The line is a log scale laid on its side: every hop is one doubling, all the same length. Nine doublings reach 512; a tenth would overshoot to 1,024. So log₂ 1,000 is just under 10, about <strong>9.97</strong>: the fractional part says how much of the last hop is used.</p>
<p>Drag the marker. log₂ 16 = 4, the four halvings that split 16 cards in <a href="../sorting/#merge">merge sort</a>; log₂ of a million is about 20. A logarithm grows very slowly, because it counts the steps, not the size.</p>`
		},
		{
			id: 'zeros',
			chapter: 'count',
			title: 'Base 10 counts zeros',
			scene: 'count',
			hints: { phase: 'ten' },
			duration: 12,
			controls: [number],
			body: `
<p>Count in steps of ×10 instead and the logarithm is base 10: log₁₀ 1,000,000 = <strong>6</strong>, the number of zeros. For a number between, it is the zeros plus a fraction: log₁₀ 500 ≈ 2.7.</p>
<p>Scientists use this count when quantities span many powers of ten. The <a href="../acids-bases/#ph">pH scale</a> counts powers of ten of hydrogen ions: one step of pH is ten times more or fewer. <a href="../earthquakes/#magnitude">Earthquake magnitude</a> uses steps of about ×32 in energy: the bottom row counts those. Japan's magnitude 9.1 earthquake in 2011 was 1.3 steps above Nepal's 7.8 in 2015: 32<sup>1.3</sup> ≈ 90 times the energy.</p>
<p>The three rows count the same number in hops of different sizes, so their counts keep the same proportions: a doubling is always 0.30 of a ×10.</p>`,
			notes: `<p>Changing the base just rescales the count: log₂ <i>x</i> = log₁₀ <i>x</i> ÷ log₁₀ 2 ≈ 3.32 × log₁₀ <i>x</i>. Each magnitude step is 10<sup>1.5</sup> ≈ 31.6 times the energy, which the page rounds to 32.</p>`
		},
		// ------------------------------------------------------------------ rule
		{
			id: 'slide',
			chapter: 'rule',
			title: 'A slide rule multiplies by adding lengths',
			scene: 'rule',
			hints: { phase: 'slide' },
			duration: 12,
			controls: [factorA, factorB],
			body: `
<p>On a log scale, multiplying is moving along by a fixed length. So two log scales sliding against each other can multiply. That is a <dfn data-def="A calculating ruler with logarithmic scales: sliding one scale along the other adds lengths, which multiplies numbers.">slide rule</dfn>.</p>
<p>Each scale runs from 1 to 10, with every number placed at a distance proportional to its logarithm. Put the slide's 1 over <strong class="tag a">a</strong> on the lower scale, find <strong class="tag b">b</strong> on the slide, and read the lower scale under it: the lengths add, so the answer is <strong>a × b</strong>. Below the rule the two lengths are laid end to end.</p>
<p>Try 2 × 3: the cursor lands on 6. Then try a product bigger than 10, such as 4 × 5, and watch it run off the end.</p>`,
			notes: `<p>John Napier published logarithms in 1614 to turn long multiplications into additions; Edmund Gunter drew them on a ruler, and William Oughtred slid two such rulers against each other around 1622.</p>`
		},
		{
			id: 'offscale',
			chapter: 'rule',
			title: 'Off the end, and three figures',
			scene: 'rule',
			hints: { phase: 'wrap' },
			duration: 12,
			controls: [
				{ ...factorA, id: 'a2', default: 4 },
				{ ...factorB, id: 'b2', default: 5 }
			],
			body: `
<p>When a × b passes 10 the cursor runs off the rule. The fix: put the slide's <em>other</em> end, its 10, over a. That takes one whole scale length off, which divides by 10, so read the answer and add a zero: 4 × 5 reads 2, which is <strong>20</strong>. The user keeps track of the zeros, as with a logarithm's whole part.</p>
<p>How exact is it? The marks on a 25 cm rule are 0.01 apart near 1 and 0.05 apart near 10, and a careful eye reads to about half a mark: <strong>three figures</strong>. 3.71 × 2.43 = 9.0153 reads as 9.025, 0.1 % off; the readout shows the reading next to the exact product. Engineers designed bridges, aircraft and the Apollo spacecraft with slide rules, until pocket calculators took over in the 1970s.</p>`
		}
	]
};
