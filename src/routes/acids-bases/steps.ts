import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** The pH of the solution in the zoomed cube. */
const ph: Control = {
	type: 'range',
	id: 'ph',
	label: 'pH',
	min: 0,
	max: 14,
	step: 0.1,
	default: 5,
	format: (v) => v.toFixed(1),
	help: 'Drag down for more acidic, up for more basic.'
};
/** The same slider on the bases step, starting on the basic side. */
const phBase: Control = { ...ph, id: 'phBase', default: 10 };

const acidD: Control = {
	type: 'select',
	id: 'acidD',
	label: 'Acid',
	default: 'acetic',
	options: [
		{ value: 'hcl', label: 'Hydrochloric acid, HCl (strong)' },
		{ value: 'acetic', label: 'Acetic acid, CH₃COOH (weak)' }
	]
};
const conc: Control = {
	type: 'select',
	id: 'conc',
	label: 'Concentration',
	default: '0.1',
	options: [
		{ value: '1', label: '1 mol/L' },
		{ value: '0.1', label: '0.1 mol/L' },
		{ value: '0.01', label: '0.01 mol/L' },
		{ value: '0.001', label: '0.001 mol/L' }
	],
	help: 'Moles of acid per litre of solution (one mole is 6.02 × 10²³ molecules).'
};

const liquid: Control = {
	type: 'select',
	id: 'liquid',
	label: 'Compare',
	default: 'lemon',
	options: [
		{ value: 'hcl', label: 'Hydrochloric acid (0.1 mol/L)' },
		{ value: 'lemon', label: 'Lemon juice' },
		{ value: 'vinegar', label: 'Vinegar' },
		{ value: 'orange', label: 'Orange juice' },
		{ value: 'tomato', label: 'Tomatoes' },
		{ value: 'rain', label: 'Clean rain' },
		{ value: 'milk', label: 'Milk' },
		{ value: 'water', label: 'Pure water' },
		{ value: 'blood', label: 'Blood' },
		{ value: 'sea', label: 'Seawater' },
		{ value: 'soda', label: 'Baking soda in water' },
		{ value: 'ammonia', label: 'Ammonia solution (0.1 mol/L)' },
		{ value: 'naoh', label: 'Sodium hydroxide (0.1 mol/L)' }
	]
};

const indicatorOptions = [
	{ value: 'methylOrange', label: 'Methyl orange (red → yellow, pH 3.2–4.4)' },
	{ value: 'bromothymol', label: 'Bromothymol blue (yellow → blue, pH 6.0–7.6)' },
	{ value: 'phenolphthalein', label: 'Phenolphthalein (colourless → pink, pH 8.2–10)' }
];
const indicator: Control = {
	type: 'select',
	id: 'indicator',
	label: 'Indicator in the flask',
	default: 'bromothymol',
	options: indicatorOptions
};
const indicatorC: Control = { ...indicator, id: 'indicatorC', default: 'methylOrange' };

const acidOptions = [
	{ value: 'hcl', label: 'Hydrochloric acid (strong)' },
	{ value: 'acetic', label: 'Acetic acid (weak, pKa 4.76)' },
	{ value: 'hocl', label: 'Hypochlorous acid (weaker, pKa 7.40)' }
];
const acidEq: Control = {
	type: 'select',
	id: 'acidEq',
	label: 'Acid in the flask',
	default: 'acetic',
	options: acidOptions
};
const acidC: Control = { ...acidEq, id: 'acidC' };

const fmtMl = (v: number) => `${v.toFixed(2)} mL`;
const added = (id: string, def: number, min = 0, max = 50): Control => ({
	type: 'range',
	id,
	label: 'Sodium hydroxide added',
	min,
	max,
	step: 0.05,
	default: def,
	format: fmtMl,
	help: 'One step of the slider is one drop, 0.05 mL.'
});
const drop: Control = { type: 'action', id: 'drop', label: 'One drop', action: 'Add a drop' };
const ml: Control = { type: 'action', id: 'ml', label: 'One millilitre', action: 'Add 1 mL' };
const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Start again',
	action: 'Empty the flask'
};

/**
 * Scenes: `dissociate` (acid molecules giving away H⁺), `ions` (the 1 µm cube),
 * `scale` (everyday liquids) and `titration` (burette, flask and pH curve).
 * Titration hints: `mode` 'auto' (the base runs in by itself, a function of t) or
 * 'manual' (the volume is the control named by `vol`); `acid`/`acidParam` and
 * `indicator`/`indicatorParam` choose the acid and the dye; `focus` picks what the
 * step is about ('curve', 'jump', 'indicator', 'buffer', 'equivalence', 'choose').
 */
export const spec: ExplainerSpec = {
	slug: 'acids-bases',
	title: 'Acids, bases and pH',
	summary:
		'Zoom into water to count its hydrogen ions, place everyday liquids on the pH scale, then add a base to an acid drop by drop and watch the pH leap at the very drop that matches the acid.',
	chapters: [
		{ id: 'ions', title: 'Hydrogen ions' },
		{ id: 'ph', title: 'The pH scale' },
		{ id: 'titration', title: 'Neutralising an acid' },
		{ id: 'weak', title: 'Weak acids' }
	],
	steps: [
		// ------------------------------------------------------------------ ions
		{
			id: 'acid',
			chapter: 'ions',
			title: 'An acid gives away hydrogen ions',
			scene: 'dissociate',
			hints: { acid: 'hcl' },
			duration: 22,
			body: `
<p>In <a href="../chemical-bonds/#tug">chemical bonds</a> you saw that chlorine pulls the shared pair of H–Cl towards itself, leaving the hydrogen slightly positive. Put hydrogen chloride in water and the polar water molecules finish the job: the hydrogen leaves <strong>without its electron</strong>, as a bare <dfn data-def="A hydrogen atom that has lost its electron: just a proton, with charge +1.">hydrogen ion</dfn>, H⁺. The chlorine keeps the pair and becomes a chloride ion, Cl⁻.</p>
<p class="formula"><strong>HCl → H⁺ + Cl⁻</strong></p>
<p>That is what an <dfn data-def="A substance that gives away hydrogen ions (H⁺) in water.">acid</dfn> is: something that gives away H⁺ ions. Hydrogen chloride dissolved in water is <strong>hydrochloric acid</strong>, the acid in your stomach. Every one of its molecules splits, so it is called a <dfn data-def="An acid whose molecules all give away their hydrogen ion in water.">strong acid</dfn>.</p>`,
			notes: `<p>A bare proton never floats free in water: it sticks at once to a water molecule's lone pair, making a <dfn data-def="H₃O⁺: a water molecule carrying an extra proton. It is what 'H⁺' in water really is.">hydronium ion</dfn>, H₃O⁺. Chemists write H⁺ for short, and so does this page; the drawing shows the H⁺ on its water molecule.</p>`
		},
		{
			id: 'water',
			chapter: 'ions',
			title: 'Even pure water has a few',
			scene: 'ions',
			hints: { fixed: 7 },
			duration: 20,
			body: `
<p>Zoom into pure water, into a cube one micrometre (a thousandth of a millimetre) on each side, about the size of a bacterium. It holds some <strong>33 billion</strong> water molecules, and it is not quite only water. Now and then one water molecule hands a proton to another:</p>
<p class="formula"><strong>H₂O + H₂O ⇌ H₃O⁺ + OH⁻</strong></p>
<p>At any moment the cube holds, on average, about <strong>60</strong> hydrogen ions and <strong>60</strong> <dfn data-def="OH⁻: a water molecule that has lost a proton. It takes up H⁺ ions.">hydroxide ions</dfn>, OH⁻: one water molecule in every 550 million is split. Pairs keep forming and recombining, but the numbers stay the same. Equal numbers of H⁺ and OH⁻ is what <dfn data-def="Having equal amounts of H⁺ and OH⁻ ions: neither acidic nor basic.">neutral</dfn> means.</p>`,
			notes: `<p>The product of the two concentrations is a constant, the <dfn data-def="Kw = [H⁺] × [OH⁻], 1.0 × 10⁻¹⁴ at 25 °C.">ion product of water</dfn>: [H⁺] × [OH⁻] = 1.0 × 10⁻¹⁴ (mol/L)² at 25 °C (measured: 1.01 × 10⁻¹⁴, Bandura and Lvov, 2006). Each is then 1.0 × 10⁻⁷ mol/L; with 6.02 × 10²³ ions in a mole and 10⁻¹⁵ L in the cube, that is 60 ions. Warmer water splits more: at 37 °C neutral water has a pH of about 6.8, and is still neutral. The page works at 25 °C throughout.</p>`
		},
		{
			id: 'ph',
			chapter: 'ions',
			title: 'pH counts hydrogen ions, ten times per step',
			scene: 'ions',
			duration: 26,
			controls: [ph],
			body: `
<p>Add acid and the number of H⁺ ions in the cube climbs, fast. Drag the pH slider and count: at pH 7 there are 60, at pH 6 there are <strong>600</strong>, at pH 5 <strong>6 000</strong>. Every step down the scale means <strong>ten times</strong> more hydrogen ions.</p>
<p>That is how the <dfn data-def="A number for how acidic a solution is: minus the power of ten of its H⁺ concentration in mol/L. pH 3 means 10⁻³ mol/L of H⁺.">pH</dfn> is defined: it is the power of ten of the H⁺ concentration, with the minus sign dropped. pH 3 means 10⁻³ moles of H⁺ per litre; pH 4 means 10⁻⁴, ten times less. Lower pH, more H⁺, more acidic. A logarithmic scale like this squeezes a range of a hundred trillion into the numbers 0 to 14.</p>
<p>Watch the OH⁻ ions at the same time: as the H⁺ go up, the OH⁻ go down by the same factor.</p>`,
			notes: `<p>In symbols, pH = −log₁₀[H⁺], with [H⁺] in mol/L. Strictly the formula uses the <em>activity</em> of H⁺, its effective concentration, which in concentrated solutions differs from the real one; the page uses plain concentrations, which is accurate for dilute solutions. Real pH meters measure activity, which is why a strong acid can read slightly below 0 or a strong base above 14.</p>`
		},
		{
			id: 'bases',
			chapter: 'ions',
			title: 'Bases take hydrogen ions away',
			scene: 'ions',
			duration: 22,
			controls: [phBase],
			body: `
<p>A <dfn data-def="A substance that takes up H⁺ ions in water, or releases OH⁻ ions that do.">base</dfn> is the opposite of an acid: it removes H⁺ ions. Sodium hydroxide, NaOH, does it by releasing OH⁻ ions, which grab H⁺ and turn back into water. Ammonia, NH₃, catches H⁺ directly, using its lone pair, and becomes NH₄⁺.</p>
<p>Above pH 7 the cube holds more OH⁻ than H⁺: the solution is <dfn data-def="Having more OH⁻ than H⁺ ions: pH above 7 (at 25 °C). Also called alkaline.">basic</dfn>, or alkaline. The H⁺ never vanish completely: at pH 10 the cube holds 60 000 OH⁻ and, on average, 0.06 H⁺. Most of the time there is none at all, but a whole litre still holds 60 trillion of them.</p>`,
			notes: `<p>Because [H⁺] × [OH⁻] is fixed, the pH and the "pOH" always add up to 14 (at 25 °C), and one number is enough to describe both ions. This definition of acids and bases, as proton givers and takers, is the Brønsted–Lowry one (1923).</p>`
		},
		// ------------------------------------------------------------------ scale
		{
			id: 'scale',
			chapter: 'ph',
			title: 'Everyday liquids on the scale',
			scene: 'scale',
			duration: 24,
			controls: [liquid],
			body: `
<p>Here is the scale with liquids you know. Lemon juice sits at about pH 2.3, which means about <strong>50 000 times</strong> as many hydrogen ions as pure water. Milk is barely acidic, blood and seawater are slightly basic.</p>
<p>Pick a liquid to compare it with pure water. Notice how the factors grow: one step is ×10, two steps ×100, five steps ×100 000. Even rain is acidic: carbon dioxide from the air dissolves in it and makes a little carbonic acid, bringing it to pH 5.6.</p>`,
			notes: `<p>Foods are measured ranges from the US Food and Drug Administration's table <i>Approximate pH of Foods and Food Products</i> (2007); blood from the MSD Manual (normal 7.35–7.45); seawater from Jiang et al., <i>Scientific Reports</i> (2019), a global average of 8.07 for the year 2000, about 0.1 lower than before the industrial revolution: the ocean is absorbing CO₂ too. The solutions marked "computed" are worked out on this page from the amounts named, with the same equilibrium model as the rest of the page.</p>`
		},
		{
			id: 'weak',
			chapter: 'ph',
			title: 'Strong and weak acids',
			scene: 'dissociate',
			duration: 26,
			controls: [acidD, conc],
			body: `
<p>Vinegar is acidic because of <strong>acetic acid</strong>, CH₃COOH. Its O–H bond is polar too, but less easily broken, and the acetate ion it leaves behind, CH₃COO⁻, readily takes a proton back. So most of its molecules stay whole: it is a <dfn data-def="An acid that gives away only a small share of its hydrogen ions: most of its molecules stay whole.">weak acid</dfn>.</p>
<p>Compare the two at the same concentration. At 0.1 mol/L every HCl splits and the pH is <strong>1.00</strong>; only about <strong>1 in 75</strong> acetic acid molecules does, and the pH is <strong>2.88</strong>. "Weak" doesn't mean dilute: it means few molecules let go. Molecules keep splitting and re-forming, but the share stays the same, an <dfn data-def="A state in which a reaction runs both ways at the same rate, so the amounts stop changing.">equilibrium</dfn>. Dilute the acetic acid and a larger share splits.</p>`,
			notes: `<p>How willing an acid is to let go is measured by its <dfn data-def="pKa: the pH at which half of an acid's molecules have given away their proton. The lower it is, the stronger the acid.">pKa</dfn>: 4.76 for acetic acid (CRC Handbook of Chemistry and Physics). At a pH equal to its pKa, half of the acid is split. HCl's pKa is far below 0. Every pH on this page is calculated from the balance of all the charges in the solution, with these constants, without the usual shortcut formulas.</p>`
		},
		// ------------------------------------------------------------------ titration
		{
			id: 'neutralise',
			chapter: 'titration',
			title: 'Neutralising an acid, drop by drop',
			scene: 'titration',
			hints: { mode: 'auto', acid: 'hcl', indicator: 'phenolphthalein', focus: 'curve' },
			duration: 24,
			body: `
<p>Mix an acid with a base and they cancel out: each OH⁻ meets an H⁺ and the two make water.</p>
<p class="formula"><strong>H⁺ + OH⁻ → H₂O</strong></p>
<p>This is <dfn data-def="The reaction of an acid with a base, in which H⁺ and OH⁻ combine to make water.">neutralisation</dfn>, and chemists use it to find out how much acid a sample holds, in a <dfn data-def="Adding a solution of known concentration, drop by drop, until it has exactly reacted with the sample.">titration</dfn>. The flask holds 25 mL of 0.1 mol/L hydrochloric acid and a few drops of an <dfn data-def="A dye that has one colour in acid and another in base.">indicator</dfn>; the tube above, a <dfn data-def="A long glass tube with a scale and a tap, for adding a liquid in measured amounts.">burette</dfn>, holds 0.1 mol/L sodium hydroxide.</p>
<p>Watch the pH as the base runs in. For a long time it hardly moves: there is so much acid that taking away half of it only lifts the pH from 1.0 to 1.5. Then, near 25 mL, it shoots up.</p>`
		},
		{
			id: 'jump',
			chapter: 'titration',
			title: 'The jump: one drop changes everything',
			scene: 'titration',
			hints: {
				mode: 'manual',
				vol: 'addedJump',
				acid: 'hcl',
				indicator: 'phenolphthalein',
				focus: 'jump'
			},
			duration: 30,
			controls: [added('addedJump', 24.8, 20, 30), drop],
			body: `
<p>You are at 24.80 mL. Add the base yourself, <strong>one drop at a time</strong> (a drop from a burette is about 0.05 mL), and watch the panel of the last drops.</p>
<p>Why the leap? The pH counts H⁺ by powers of ten. At 24.95 mL only one part in a thousand of the acid is left and the pH is 4.0. The next drop, at <strong>25.00 mL</strong>, matches the acid exactly: the moles of OH⁻ added equal the moles of H⁺ there were, the <dfn data-def="The point of a titration at which the base added exactly matches the acid in the flask, mole for mole.">equivalence point</dfn>. Only water's own ions remain: pH 7.0. One more drop leaves OH⁻ in excess, and the pH is 10.0. Two drops, six pH steps: <strong>a millionfold</strong> change in H⁺.</p>
<p>That is why a titration is so precise: the equivalence point is marked by a cliff, not a gentle slope.</p>`,
			notes: `<p>At equivalence the flask holds 50 mL of sodium chloride solution, salt water. The moles of acid are 0.025 L × 0.1 mol/L = 2.5 millimoles, so it takes 2.5 millimoles of NaOH: 25.00 mL. Knowing the base's concentration and reading the volume at the jump gives the amount of acid, which is how the acidity of wine, vinegar or a water sample is measured.</p>`
		},
		{
			id: 'indicator',
			chapter: 'titration',
			title: 'Your turn: watch the indicator',
			scene: 'titration',
			hints: {
				mode: 'manual',
				vol: 'added',
				acid: 'hcl',
				indicatorParam: 'indicator',
				focus: 'indicator'
			},
			duration: 30,
			controls: [added('added', 0), drop, ml, restart, indicator],
			body: `
<p>A chemist can't watch a pH curve: they watch a colour. An indicator is itself a weak acid whose two forms have different colours. Bromothymol blue is yellow while it holds its proton and blue once it has lost it; it changes over pH 6.0–7.6, the band shaded on the plot.</p>
<p>Titrate the acid yourself: add a millilitre at a time, then go drop by drop near 25 mL. The colour changes inside a single drop. Then empty the flask and try the other two indicators. With a strong acid all three work: the jump is so tall, from pH 4 to 10, that each band sits inside it. Phenolphthalein, colourless until about pH 8.2, is the usual choice.</p>`,
			notes: `<p>Only a few drops of indicator go in, far too little to change the pH. The colour drawn here is the mix of the two forms in the proportions the indicator's own pKa sets (pKIn 3.7, 7.0 and 9.4; values from Imperial College's <i>Acid–Base Indicators and Titrations</i> by W. Locke). The eye sees a change once about a tenth of the dye has switched, which is why each range spans about two pH units.</p>`
		},
		// ------------------------------------------------------------------ weak
		{
			id: 'weakcurve',
			chapter: 'weak',
			title: 'A weak acid: a gentler climb',
			scene: 'titration',
			hints: { mode: 'auto', acid: 'acetic', indicator: 'phenolphthalein', focus: 'buffer' },
			duration: 26,
			body: `
<p>Now titrate 25 mL of 0.1 mol/L <strong>acetic acid</strong> with the same base. The hydrochloric acid curve stays faintly in the background.</p>
<p>The weak acid starts higher, at pH 2.88, because so few of its molecules are split. Then the curve climbs quickly and flattens into a long, gentle slope: each OH⁻ added takes a proton from a whole acetic acid molecule, and the CH₃COO⁻ left behind can take H⁺ back if the pH falls. A mixture of a weak acid and its partner like this resists changes in pH, a <dfn data-def="A mixture of a weak acid and the base it turns into, which keeps the pH steady when a little acid or base is added.">buffer</dfn>.</p>
<p>Halfway, at 12.5 mL, half the acid has been turned into acetate, and the pH equals the acid's pKa: <strong>4.76</strong>.</p>`,
			notes: `<p>Your blood is buffered the same way, by carbonic acid and hydrogencarbonate (HCO₃⁻), which is how it stays between pH 7.35 and 7.45 while your cells keep making acid. Leaves use the pH difference across a membrane in the opposite way, to store energy: see <a href="../photosynthesis/">photosynthesis</a>.</p>`
		},
		{
			id: 'equivalence',
			chapter: 'weak',
			title: 'Matching is not the same as neutral',
			scene: 'titration',
			hints: {
				mode: 'full',
				acidParam: 'acidEq',
				indicator: 'phenolphthalein',
				focus: 'equivalence'
			},
			duration: 26,
			controls: [acidEq],
			body: `
<p>Look where the acetic acid's equivalence point sits: still at 25.00 mL, because the base matches the acid mole for mole whatever the acid. But the pH there is <strong>8.73</strong>, not 7.</p>
<p>At that point the flask holds sodium acetate. Acetate ions are a weak base: a few of them take H⁺ from water, CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻, and leave OH⁻ behind. So the solution is basic even though not a single OH⁻ from the burette is left over.</p>
<p>The rule "equivalence is at pH 7" holds only for a strong acid with a strong base. Try the even weaker hypochlorous acid, the active part of bleach: equivalence at pH 10.05, and almost no jump left.</p>`,
			notes: `<p>The weaker the acid, the stronger the base it leaves behind, so the higher the equivalence pH. The opposite holds too: a weak base, such as ammonia, titrated with a strong acid has its equivalence point below 7.</p>`
		},
		{
			id: 'choose',
			chapter: 'weak',
			title: 'Choosing the right indicator',
			scene: 'titration',
			hints: {
				mode: 'manual',
				vol: 'addedC',
				acidParam: 'acidC',
				indicatorParam: 'indicatorC',
				focus: 'choose'
			},
			duration: 30,
			controls: [added('addedC', 0), drop, ml, restart, acidC, indicatorC],
			body: `
<p>Titrate the acetic acid with <strong>methyl orange</strong>. It turns from red to yellow by about 8 mL, long before the acid is used up: its band lies in the buffer region, not the jump. A chemist trusting it would think the vinegar held a third of the acid it really does.</p>
<p>Switch to <strong>phenolphthalein</strong>: its band, 8.2–10, sits right in the weak acid's jump, and it turns pink at the drop that reaches 25 mL. The rule is to pick an indicator that changes colour <strong>at the equivalence pH</strong>, which depends on the acid.</p>
<p>The takeaway, in one picture: pH counts hydrogen ions in powers of ten, so it leaps at the drop where the base matches the acid; and that leap is centred on pH 7 only when both are strong.</p>`
		}
	]
};
