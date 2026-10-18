import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `curve` (one drug's blood level against time, the body drawn as a tank beside it;
 * `step.hints.mode` picks the regimen, see `CurveScene`) and `build` (the palette: place doses
 * on the timeline yourself). Every control id belongs to one step.
 */

const pctOfNormal = (v: number) => `${Math.round(v * 100)}% of normal`;

const multiplier = (id: string, label: string, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0.5,
	max: 2,
	default: 1,
	values: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
	format: (v) => `× ${v.toLocaleString('en-US')}`,
	help
});

const NOT_ADVICE =
	'This page is an educational model for one average 70 kg adult. It is not dosing advice: real doses are set by a prescriber for one patient, and checked with blood tests.';

export const spec: ExplainerSpec = {
	slug: 'pharmacokinetics-dosing',
	title: 'Pharmacokinetics: how doses add up',
	summary:
		'Give a drug as an injection, a tablet or a drip and watch its level in the blood rise and fall against the range where it works. Repeated doses pile up until the body removes as much as each dose adds; for most drugs that takes four to five half-lives, whatever the dose. An educational model built from five drugs’ US labels, not dosing advice.',
	chapters: [
		{ id: 'one', title: 'One dose' },
		{ id: 'many', title: 'Dose after dose' },
		{ id: 'yours', title: 'Your own regimen' },
		{ id: 'break', title: 'When the rules break' }
	],
	steps: [
		// ---------------------------------------------------------------- one dose
		{
			id: 'one-dose',
			chapter: 'one',
			title: 'An injection, and a half-life',
			scene: 'curve',
			hints: { mode: 'single', drug: 'theophylline' },
			duration: 25,
			controls: [
				multiplier(
					'cl1',
					'Clearance',
					'How many litres of blood the body cleans of drug per hour.'
				),
				multiplier('v1', 'Volume of distribution', 'How far the drug spreads out in the body.')
			],
			body: `
<p><strong>${NOT_ADVICE}</strong></p>
<p>Inject 320 mg of <b>theophylline</b>, an asthma drug, into a vein. In minutes it spreads through the blood and the body’s water, as if it were dissolved in one tank. The size of that tank is the drug’s <dfn data-def="The volume the drug would need to be dissolved in to reach the measured blood level: amount in the body ÷ blood level. For theophylline about 0.45 L per kg of body weight; for digoxin, which crowds into muscle, about 500 L, far more than a person.">volume of distribution</dfn> V: here 32 L, so the level starts at 320 ÷ 32 ≈ 10 mg/L (10 mcg/mL).</p>
<p>The liver and kidneys then remove the drug. For most drugs they clean a fixed volume of blood per hour, the <dfn data-def="The volume of blood cleared of the drug per unit time, in L/h. The rate of removal is clearance × level.">clearance</dfn> CL, so the drug leaves at a rate <strong>CL × level</strong>: fast when the level is high, slowly when it is low. That makes the level fall exponentially, like radioactive nuclei: it halves every <strong>half-life</strong>, t½ = 0.693 × V / CL, 8 hours here.</p>
<p>Change the clearance and the volume. A larger tank holds the same dose at a lower level and drains more slowly; a better clearance drains it faster. The half-life follows both.</p>`,
			notes: `<p>In equations: d(amount)/dt = −CL × C, with C = amount / V, so C(t) = (dose / V) e<sup>−kt</sup> with k = CL / V and t½ = ln 2 / k. Theophylline’s numbers come from its US label: clearance 0.65 mL per kg per minute and a volume of 0.45 L/kg in healthy non-smoking adults, for 70 kg about 2.7 L/h and 32 L. The page treats the body as a single, well-mixed compartment. Real drugs first spread from the blood into the tissues over minutes to hours (the <em>distribution phase</em>), so the early fall is steeper than a single exponential; two-compartment models describe that, and the page leaves it out. It also treats theophylline’s removal as linear at every level; its label warns that in some patients its metabolism starts to saturate above 10 mcg/mL, so a higher dose can raise the level more than this model predicts.</p>`
		},
		{
			id: 'tablet',
			chapter: 'one',
			title: 'A tablet: absorbed, then removed',
			scene: 'curve',
			hints: { mode: 'tablet', drug: 'theophylline' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'ka2',
					label: 'Absorption rate',
					min: 0.25,
					max: 4,
					default: 2,
					values: () => [0.25, 0.5, 1, 2, 4],
					format: (v) => `${v.toLocaleString('en-US')} per hour`,
					help: 'Absorption rate ÷ amount left in the gut. Slow-release tablets are slow.'
				}
			],
			body: `
<p>Swallow the same drug as a 300 mg tablet and it first has to cross the gut wall. It is absorbed at a rate <dfn data-def="The absorption rate constant, per hour: the rate of absorption divided by the amount still in the gut. Over one hour a share 1 − e^(−kₐ) of it is absorbed: 86% at 2 per hour.">kₐ</dfn> × (what is still in the gut): at kₐ = 2 per hour, 86% of it within the first hour. Meanwhile the blood keeps clearing what has arrived.</p>
<p>So the level rises, peaks where absorption has slowed down to the rate of removal, and then falls with the same half-life as before. The faint curve is the injection, for comparison. For theophylline the label says the peak comes 1 to 2 hours after a fast tablet.</p>
<p>Slow the absorption: the peak comes later and lower, and the curve is flatter. That is what slow-release tablets do. But the <strong>area under the curve</strong>, the total exposure, stays the same: everything that is absorbed is eventually cleared, and that area is (absorbed dose) ÷ CL.</p>`,
			notes: `<p>Not all of a tablet need reach the blood: the share that does is the <dfn data-def="The fraction of a dose that reaches the circulation unchanged. 100% for an injection into a vein.">bioavailability</dfn> F. Theophylline’s is close to 100%, digoxin tablets’ 60–80%. The curve is the Bateman function, C(t) = F·dose·kₐ / (V (kₐ − k)) × (e<sup>−kt</sup> − e<sup>−kₐt</sup>). When absorption is slower than elimination (kₐ &lt; k) the roles swap: the tail falls at the absorption rate, which is called flip-flop kinetics.</p>`
		},
		// ---------------------------------------------------------------- many doses
		{
			id: 'repeat',
			chapter: 'many',
			title: 'Dose after dose, the level piles up',
			scene: 'curve',
			hints: { mode: 'repeat', drug: 'theophylline' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'tau3',
					label: 'A 300 mg tablet every',
					min: 4,
					max: 24,
					default: 8,
					values: () => [4, 6, 8, 12, 24],
					format: (v) => `${v} hours`
				},
				{
					type: 'toggle',
					id: 'miss3',
					label: 'Miss a dose',
					default: false,
					help: 'The first one due after hour 30.'
				}
			],
			body: `
<p>A drug is rarely taken once. Take a 300 mg tablet every 8 hours. When the second arrives, part of the first is still there, so the level climbs higher; and again with the third. It does not climb for ever: the more drug there is, the faster it is removed, until <strong>what leaves between two doses equals one dose</strong>. That balance is the <dfn data-def="The repeating pattern reached when, over each dosing interval, the body removes as much drug as one dose adds.">steady state</dfn>.</p>
<p>How fast does it get there? Exactly as fast as one dose would decay: half-way after one half-life, 75% after two, then 87.5%, <strong>94% after four</strong> and 97% after five. The ticks under the axis mark them. For theophylline, about 32 hours.</p>
<p>The green band is the label’s target range, 10 to 20 mcg/mL. Lengthen the interval while keeping each tablet at 300 mg: less drug arrives per day, so both <strong>peaks and troughs</strong> fall, and the drop between doses grows; every 24 hours even the peaks stay below the range. Shorten it to 4 hours and the level climbs past the toxic line. Miss a dose and the level sags, then climbs back over the next few half-lives.</p>`,
			notes: `<p>The average level at steady state is F × dose ÷ (CL × interval): the rate of intake divided by the clearance. For a dose every τ hours, each one decays by a factor e<sup>−kτ</sup> before the next, and the troughs build up as 1 + e<sup>−kτ</sup> + e<sup>−2kτ</sup> + …, a geometric series that tends to 1 / (1 − e<sup>−kτ</sup>). The theophylline label puts it in numbers: with a dose every 6 hours and an 8-hour half-life, the trough is about 60% of the peak.</p>`
		},
		{
			id: 'drip',
			chapter: 'many',
			title: 'A steady drip',
			scene: 'curve',
			hints: { mode: 'drip', drug: 'theophylline' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'rate4',
					label: 'Drip rate',
					min: 14,
					max: 56,
					step: 7,
					default: 28,
					format: (v) => `${v} mg per hour`
				},
				{ type: 'toggle', id: 'load4', label: 'Start with a loading dose', default: false }
			],
			body: `
<p>A drip into a vein removes the peaks and troughs: the drug arrives at a constant rate R, and the level rises smoothly until removal, CL × level, matches it. The plateau is <strong>R ÷ CL</strong>. The theophylline label’s drip, 0.4 mg per kg per hour (28 mg/h at 70 kg), settles near 10 mcg/mL.</p>
<p>Double the rate: the plateau doubles. But look at the ticks: the climb still reaches 50% after one half-life and 94% after four, whatever the rate. The rate sets the <em>level</em>; the half-life sets the <em>time</em>.</p>
<p>A patient short of breath cannot wait 32 hours. So the label starts with a <strong>loading dose</strong>, 4.6 mg/kg injected over 30 minutes, which fills the tank to about 10 mcg/mL at once; the drip then only has to replace what is removed. Switch it on.</p>`,
			notes: `<p>During the drip, C(t) = (R / CL)(1 − e<sup>−kt</sup>): the same exponential as a decay, turned upside down. The loading dose is target × V: it depends on the volume, not on the clearance, while the maintenance rate is target × CL. A patient whose clearance is unusually low or high still gets the right start, but drifts away from the target over the next few half-lives, which is why the label asks for a blood test after one half-life.</p>`
		},
		{
			id: 'double',
			chapter: 'many',
			title: 'A bigger dose is not a faster one',
			scene: 'curve',
			hints: { mode: 'double', drug: 'digoxin' },
			duration: 30,
			controls: [{ type: 'toggle', id: 'dbl5', label: 'Double the daily dose', default: false }],
			body: `
<p><b>Digoxin</b>, a heart drug, has a half-life of 1.5 to 2 days (the page uses 1.75). Taken once a day, 250 micrograms, it needs about <strong>a week</strong> to reach its steady state: the Lanoxin label lists 7 days for a patient with normal kidneys.</p>
<p>It is tempting to think that a bigger dose would get there sooner. Double it: the plateau doubles, from about 0.9 to 1.8 ng/mL, near the top of the range. But the marker for 90% of each curve’s own plateau does not move. The <strong>shape</strong> of the climb is set by the half-life alone; the dose only stretches it upwards.</p>
<p>This holds for every drug that is removed in proportion to its level, which is most of them. The next step shows how to really shorten the wait.</p>`,
			notes: `<p>Both curves are the same function, (dose) × f(t), with f set by V, CL and the interval, so they reach any given share of their plateaus at the same moment. Digoxin’s numbers: volume about 475–500 L (it concentrates in muscle), half-life 1.5–2 days, tablets 60–80% absorbed; levels below 0.5 ng/mL work less well, and above 2 ng/mL toxicity becomes more likely. The model also ignores digoxin’s slow distribution into tissues, which is why its label asks for blood samples at least 6 hours after a dose.</p>`
		},
		{
			id: 'loading',
			chapter: 'many',
			title: 'A loading dose shortens the wait',
			scene: 'curve',
			hints: { mode: 'loading', drug: 'digoxin' },
			duration: 30,
			controls: [
				{
					type: 'toggle',
					id: 'load6',
					label: 'Start with a loading dose (750 mcg)',
					default: false
				}
			],
			body: `
<p>To reach the plateau at once, give at the start the amount the body will hold at steady state: <strong>target level × V</strong>, divided by the share a tablet delivers. For digoxin the label gives 10 to 15 micrograms per kg, half at first and two quarters 6 to 8 hours apart. The page gives 750 micrograms that way on day one (375, then 187.5 twice, six hours apart), about 11 per kg, then the usual 250 a day.</p>
<p>With the loading dose the level is near its plateau from the first day, instead of after a week. The maintenance doses then only replace what is removed, so the level stays where it is.</p>
<p>The price is the size of that first dose: if the volume or the target was misjudged, the level overshoots at once, with nothing to slow it. That is why digoxin’s loading dose is given in parts, with the patient checked before each one.</p>`,
			notes: `<p>The loading dose depends on the volume of distribution; the maintenance dose depends on the clearance. If only the clearance changes while V stays fixed, the loading dose stays the same and the daily dose falls; with the usual dose, the level settles higher and more slowly. In real patients, severe kidney failure can also shrink digoxin’s volume of distribution, so the loading dose may need adjusting too.</p>`
		},
		{
			id: 'kidney',
			chapter: 'many',
			title: 'A failing kidney: higher, and slower to settle',
			scene: 'curve',
			hints: { mode: 'kidney', drug: 'lithium' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'kid7',
					label: 'Kidney function',
					min: 0.25,
					max: 1,
					default: 1,
					values: () => [0.25, 0.5, 0.75, 1],
					format: pctOfNormal
				}
			],
			body: `
<p><b>Lithium</b>, a mood stabiliser, leaves the body almost only through the kidneys. Its label gives a half-life of 18 to 36 hours (the page uses 30) and a target of 0.8 to 1.2 mEq/L for an acute episode, measured in a blood sample taken <strong>12 hours after a dose</strong>, with toxicity likely from <strong>1.5 mEq/L</strong>. In this model 600 mg twice a day averages about 1.0 mEq/L, and about 0.92 at the 12-hour sample.</p>
<p>Now let the kidneys clear half as well, as in dehydration or kidney disease. Clearance halves, so the plateau <strong>doubles</strong>, to about 2.1 mEq/L, above the toxic line. And the half-life doubles too, so the level climbs for twice as long before it settles: the danger builds up slowly over days, behind the steady dose.</p>
<p>This is why lithium is checked with blood tests, and why kidney function changes the dose of many drugs.</p>`,
			notes: `<p>The faint curve is the same dose with normal kidneys. The kidney filters lithium freely and reabsorbs about 80% of it; sodium loss, dehydration and some common drugs make it reabsorb more, which lowers the clearance in the same way. Lithium’s label: completely absorbed, peak 0.25 to 3 hours after a dose, volume 0.7 to 1 L/kg; 300 mg of lithium carbonate holds 8.12 mEq of lithium.</p>`
		},
		// ---------------------------------------------------------------- your own
		{
			id: 'build',
			chapter: 'yours',
			title: 'Build a regimen',
			scene: 'build',
			duration: 60,
			controls: [
				{
					type: 'select',
					id: 'drug8',
					label: 'Drug',
					default: 'theophylline',
					options: [
						{ value: 'theophylline', label: 'Theophylline' },
						{ value: 'digoxin', label: 'Digoxin' },
						{ value: 'lithium', label: 'Lithium' },
						{ value: 'vancomycin', label: 'Vancomycin' },
						{ value: 'phenytoin', label: 'Phenytoin' }
					]
				},
				multiplier('cl8', 'Clearance'),
				multiplier('v8', 'Volume of distribution'),
				{
					type: 'range',
					id: 'ka8',
					label: 'Absorption rate',
					min: 0.25,
					max: 4,
					default: 1,
					values: () => [0.25, 0.5, 1, 2, 4],
					format: (v) => `× ${v.toLocaleString('en-US')}`,
					help: 'Of the drug’s own rate: tablets only.'
				}
			],
			body: `
<p>Now place the doses yourself. Move the <strong>cursor</strong> along the time axis (drag it, or focus it and use the arrow keys), then pick from the <strong>palette</strong> above the chart: an injection, a tablet, a 24-hour drip or a loading dose lands at the cursor. Click a placed dose to remove it, as if it were missed.</p>
<p>Each drug starts with a usual regimen from its label. Try theophylline with the doses bunched in the day and none at night; digoxin with and without a loading dose; vancomycin, given into a vein for infections of the body because it is barely absorbed from the gut (by mouth it treats some infections of the gut itself, which this page does not model). Halve the clearance to model failing kidneys or liver.</p>
<p>Watch the readout: the highest level, the lowest level of the last day, and how much of the time after the first dose the level spends in the target range.</p>`,
			notes: `<p>The sliders change one average patient. Real patients differ several-fold: the theophylline label notes that the dose needed to reach 10 to 20 mcg/mL varies fourfold between otherwise similar adults, and smoking, fever, heart failure and other drugs move it further. Vancomycin’s label gives no target range; doses are guided by blood levels and the bacteria’s sensitivity, so the chart shows no band for it. The five drugs’ numbers come from their US prescribing information (theophylline and aminophylline, Lanoxin, lithium carbonate, vancomycin and Dilantin labels, read through the FDA’s openFDA service); phenytoin’s enzyme constants and volume, which no label gives, from Salehifar et al. (2009) and Noval et al. (2020).</p>`
		},
		// ---------------------------------------------------------------- break
		{
			id: 'saturable',
			chapter: 'break',
			title: 'Saturable elimination: both rules break',
			scene: 'curve',
			hints: { mode: 'saturable', drug: 'phenytoin' },
			duration: 40,
			controls: [
				{
					type: 'range',
					id: 'dose9',
					label: 'Daily dose',
					min: 200,
					max: 500,
					step: 50,
					default: 300,
					format: (v) => `${v} mg a day`
				},
				{
					type: 'toggle',
					id: 'sat9',
					label: 'Saturable elimination (the real drug)',
					default: true
				}
			],
			body: `
<p>Everything so far assumed that the body removes drug in proportion to its level. <b>Phenytoin</b>, an epilepsy drug, is broken down by liver enzymes that run near their top speed at the levels it is used at. Removal then follows <dfn data-def="Rate = Vmax × C / (Km + C): proportional to the level C while C is well below Km, levelling off at the enzymes’ top speed Vmax above it. The same law describes an enzyme’s rate against its substrate.">Michaelis–Menten</dfn> kinetics: proportional to the level at low levels, but levelling off at a top speed, Vmax.</p>
<p>Raise the daily dose step by step. From 300 to 400 mg, a third more drug, the plateau more than doubles, from about 5 to 12 mcg/mL, into the label’s 10–20 range (the page splits each day’s dose into three, one every 8 hours). At 500 mg it is far above it: the intake is close to the enzymes’ top speed, and the level has to climb high before removal catches up. The left-hand chart shows the plateau against the daily dose, for an intake spread evenly over the day; switch saturation off for the straight line of a linear drug that matches it at 300 mg.</p>
<p>The time rule breaks too: the higher the level, the longer the half-life (the label gives 7 to 42 hours), so a bigger dose takes <strong>longer</strong> to settle: at 500 mg the level is still climbing after four weeks and takes about five months to come within 10% of its plateau. Small dose changes, slow surprises: phenytoin is dosed in small steps with blood tests. Alcohol is removed in the same saturated way, at a roughly constant rate per hour.</p>`,
			notes: `<p>At steady state, intake R equals removal: R = Vmax·C / (Km + C), so C = Km·R / (Vmax − R), which runs to infinity as R approaches Vmax. That holds for an intake spread evenly; with three doses a day the average differs by well under 1%, and the read-outs come from running the doses until they settle. The page uses the textbook averages Vmax = 7 mg per kg per day and Km = 4 mg/L quoted by Salehifar et al. (2009), whose own patients averaged 6.1 and 5.9; individual values vary several-fold. Volume 0.7 L/kg (Noval et al., 2020). Dilantin capsules hold phenytoin sodium, about 92% phenytoin, and are taken as fully absorbed here. Once intake stops, the time to fall from C to C/2 is V × (Km ln 2 + C/2) ÷ Vmax: about 19 hours from 10 mcg/mL, 31 from 20.</p>`
		}
	]
};
