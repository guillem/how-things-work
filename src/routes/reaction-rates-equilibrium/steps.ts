import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const kelvin = (v: number) => `${Math.round(v)} K (${Math.round(v - 273.15)} °C)`;

/** Temperature of the collision-energy chart. */
const tShare: Control = {
	type: 'range',
	id: 'tShare',
	label: 'Temperature',
	min: 560,
	max: 780,
	step: 10,
	default: 700,
	format: kelvin,
	help: 'Bodenstein measured the reaction between 556 and 781 K.'
};

const h2Start: Control = {
	type: 'select',
	id: 'h2Start',
	label: 'Hydrogen at the start',
	default: '30',
	options: [
		{ value: '15', label: 'Half as much (15 molecules)' },
		{ value: '30', label: 'As much as iodine (30)' },
		{ value: '60', label: 'Twice as much (60)' }
	],
	help: 'The iodine stays at 30 molecules.'
};

const tRate: Control = {
	type: 'range',
	id: 'tRate',
	label: 'Temperature',
	min: 650,
	max: 750,
	step: 5,
	default: 700,
	format: kelvin,
	help: 'Each change starts the flask again from hydrogen and iodine.'
};

const lowering: Control = {
	type: 'range',
	id: 'lowering',
	label: 'Catalyst: barrier lowered by',
	min: 0,
	max: 80,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'no catalyst' : `${Math.round(v)} kJ/mol`),
	help: 'A gold surface lowers it by about 78 kJ/mol.'
};

const from: Control = {
	type: 'select',
	id: 'from',
	label: 'Start from',
	default: 'reactants',
	options: [
		{ value: 'reactants', label: 'Hydrogen and iodine' },
		{ value: 'hi', label: 'Pure hydrogen iodide' }
	]
};

const gold: Control = {
	type: 'toggle',
	id: 'gold',
	label: 'Gold catalyst',
	default: false,
	help: 'Lowers both barriers by 78 kJ/mol.'
};

const addH2: Control = { type: 'action', id: 'addH2', label: 'Hydrogen', action: 'Add 10 H₂' };
const removeH2: Control = {
	type: 'action',
	id: 'removeH2',
	label: 'Hydrogen',
	action: 'Take out 5 H₂'
};

const tHeat: Control = {
	type: 'range',
	id: 'tHeat',
	label: 'Temperature',
	min: 600,
	max: 780,
	step: 10,
	default: 700,
	format: kelvin,
	help: 'Changes take effect at once, without restarting.'
};
const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Flask',
	action: 'Start again'
};

/**
 * Scenes: `collide` (two molecules meeting, beside the energy profile), `energy`
 * (the share of collisions above the barrier) and `flask` (the box of molecules,
 * the energy profile and a plot, all driven by ./model.ts).
 * Flask hints: `plot` 'conc' | 'rates' | 'log'; `lapse` model seconds per second of
 * animation, or 'auto'; `start` 'reactants' | 'equilibrium'; `focus` names what the
 * step is about (for callouts).
 */
export const spec: ExplainerSpec = {
	slug: 'reaction-rates-equilibrium',
	title: 'Reaction rates, catalysts and equilibrium',
	summary:
		'Watch hydrogen and iodine collide, react and react back. Heat them, add a catalyst that lowers the energy barrier, or add more hydrogen, and see the rates and the final mixture respond.',
	chapters: [
		{ id: 'collisions', title: 'Collisions and barriers' },
		{ id: 'rates', title: 'How fast' },
		{ id: 'equilibrium', title: 'Both ways at once' },
		{ id: 'push', title: 'Pushing an equilibrium' }
	],
	steps: [
		// ------------------------------------------------------------------ collisions
		{
			id: 'collide',
			chapter: 'collisions',
			title: 'To react, molecules must collide',
			scene: 'collide',
			hints: { phase: 'bounce' },
			duration: 22,
			body: `
<p>Heat hydrogen and iodine vapour together in a sealed flask and they slowly turn into hydrogen iodide:</p>
<p class="formula"><strong>H₂ + I₂ → 2 HI</strong></p>
<p>For that, an H–H bond and an I–I bond have to break and two H–I bonds have to form (the bonds of <a href="../chemical-bonds/#share">Chemical bonds</a>). Nothing happens unless the molecules meet. At 700 K the molecules fly about fast, H₂ at some 2.7 km/s and the heavier I₂ at 240 m/s, and each one collides billions of times a second.</p>
<p>Yet almost every collision is a bounce: the two molecules hit, push each other apart and fly off unchanged. The meter shows the energy each collision brings, against what it would need.</p>`,
			notes: `<p>This is the reaction Max Bodenstein measured in the 1890s, in sealed glass bulbs between 283 and 508 °C, and every number on this page comes from his data. It became the textbook example of a reaction in which two molecules simply collide. In 1967 J. H. Sullivan showed that it really goes through iodine atoms: some I₂ splits into 2 I, and the atoms react with H₂. The rate is still proportional to [H₂][I₂], because the iodine atoms stay in balance with the I₂, so the simple picture predicts the right rates. The page keeps it, as Bodenstein did.</p>`
		},
		{
			id: 'barrier',
			chapter: 'collisions',
			title: 'The energy barrier',
			scene: 'collide',
			hints: { phase: 'react' },
			duration: 24,
			body: `
<p>Old bonds must stretch and start to break before new ones can form, and that costs energy before any is given back. Plotted along the course of the reaction, the energy rises to a peak and falls again: an <dfn data-def="A plot of the energy of the reacting molecules along the course of the reaction, from reactants over the barrier to products.">energy profile</dfn>.</p>
<p>The height of the peak above the reactants is the <dfn data-def="The least energy a collision must bring for the reaction to happen: the height of the barrier, Ea, in kJ per mole of collisions.">activation energy</dfn>, E<sub>a</sub>. For H₂ + I₂ it is <strong>171 kJ/mol</strong>. A typical collision at 700 K brings only about 6 kJ/mol. Only the rare collision with enough energy gets over the top; then the atoms swap partners and two HI molecules fly apart.</p>
<p>The products end up <strong>12 kJ/mol</strong> lower than the reactants: the reaction gives off a little heat (it is <dfn data-def="Giving off heat: the products have less energy than the reactants.">exothermic</dfn>).</p>`,
			notes: `<p>The activation energy is the slope of Bodenstein's rate constants plotted as ln k against 1/T (an <dfn data-def="A plot of ln k against 1/T. For a reaction that follows the Arrhenius equation it is a straight line with slope −Ea/R.">Arrhenius plot</dfn>), fitted on this page to all of his 19 measurements: 171 kJ/mol. The 12 kJ/mol comes from how his equilibrium mixtures change with temperature (the van 't Hoff equation). "Typical" is RT, 5.8 kJ/mol at 700 K, the average energy of collisions along the line between the molecules' centres. The drawn molecules show the old picture of a direct collision (see the previous step's notes).</p>`
		},
		{
			id: 'share',
			chapter: 'collisions',
			title: 'One collision in trillions',
			scene: 'energy',
			duration: 26,
			controls: [tShare],
			body: `
<p>Collision energies are spread out: most collisions are gentle, a few are violent. The share with at least an energy E falls off as e<sup>−E/RT</sup>, where R is the gas constant and T the temperature in kelvin. Above 171 kJ/mol, at 700 K, that is <strong>1 collision in 6 × 10¹²</strong> (6 trillion).</p>
<p>The left chart shows where the collisions really are, crowded near zero; the barrier is far off to the right. The right chart counts the tail in powers of ten. Raise the temperature: the tail grows quickly. Just 10 K more, and the share over the barrier is <strong>1.5 times</strong> larger.</p>
<p>So the rate constant follows the <dfn data-def="k = A·e^(−Ea/RT): the rate constant k grows exponentially with temperature; A depends on how often molecules collide and in which orientation.">Arrhenius equation</dfn>, <strong>k = A e<sup>−E<sub>a</sub>/RT</sup></strong>, where A stands for how often the molecules collide, and how many collisions have a usable orientation.</p>`,
			notes: `<p>e<sup>−E/RT</sup> is the share of collisions whose energy along the line between the molecules' centres is at least E, from the Boltzmann distribution of molecular speeds. With E<sub>a</sub> = 171 kJ/mol and A = 3.7 × 10¹¹ L mol⁻¹ s⁻¹ (both fitted to Bodenstein's data), k = 0.063 L mol⁻¹ s⁻¹ at 700 K. Svante Arrhenius proposed the equation in 1889, on the evidence of how sugar breaks down in acid.</p>`
		},
		// ------------------------------------------------------------------ rates
		{
			id: 'rate',
			chapter: 'rates',
			title: 'Watching the reaction run',
			scene: 'flask',
			hints: { plot: 'conc', lapse: 600, start: 'reactants', focus: 'rate' },
			duration: 28,
			body: `
<p>Here is the flask at 700 K (427 °C), filled at 1 atmosphere with equal amounts of hydrogen and iodine: 0.0087 mol/L of each. The box holds 30 molecules of each; a litre of the real gas holds 5 × 10²¹. Each flash is a collision that got over the barrier. Iodine vapour is violet, so the gas grows paler as the I₂ is used up.</p>
<p>The <dfn data-def="How much reactant is used up (or product made) per litre per second, in mol L⁻¹ s⁻¹.">rate</dfn> is how fast that happens. Bodenstein found it proportional to how much of each reactant there is, the <dfn data-def="How the rate of a reaction depends on the concentrations, e.g. rate = k[H₂][I₂].">rate law</dfn>:</p>
<p class="formula"><strong>rate = k [H₂] [I₂]</strong></p>
<p>Square brackets mean a concentration in mol/L, and the <dfn data-def="The constant k in a rate law. It depends on the temperature and the barrier, not on the amounts.">rate constant</dfn> k is 0.063 L mol⁻¹ s⁻¹ here. As the reactants are used up there are fewer of them to meet, and the reaction slows down: half of the hydrogen is gone after <strong>31 minutes</strong>.</p>`,
			notes: `<p>The box is a time-lapse: one second here is ten minutes in the flask. Its molecules fly in straight lines and pass through each other, and the model decides how many of their meetings react, so that the counts follow the calculated amounts. The rate law is the law of <dfn data-def="The rule that a reaction's rate is proportional to the concentration of each reacting molecule (raised to the number of them that meet). Guldberg and Waage, 1864.">mass action</dfn>: the chance that an H₂ and an I₂ meet is proportional to the number of each.</p>`
		},
		{
			id: 'concentration',
			chapter: 'rates',
			title: 'More molecules, more meetings',
			scene: 'flask',
			hints: { plot: 'rates', lapse: 600, start: 'reactants', focus: 'concentration' },
			duration: 26,
			controls: [h2Start],
			body: `
<p>Change how much hydrogen goes in. With twice as much, each I₂ molecule meets an H₂ twice as often, and the starting rate is <strong>twice</strong> as fast; with half as much, half as fast. That is what the rate law says: rate = k [H₂] [I₂].</p>
<p>The plot now shows the rate itself, the number of reactions per litre per second. It is highest at the very start and falls as the reactants run down.</p>`,
			notes: `<p>Rate laws are measured, not read off the equation. For H₂ + I₂ the rate happens to follow the equation's coefficients; for many reactions it doesn't, because they go through several steps. The powers in a rate law are its <dfn data-def="The power to which a concentration is raised in a rate law. H₂ + I₂ is first order in each, second order overall.">orders</dfn>.</p>`
		},
		{
			id: 'temperature',
			chapter: 'rates',
			title: 'Heat speeds it up, a lot',
			scene: 'flask',
			hints: { plot: 'conc', lapse: 300, start: 'reactants', focus: 'temperature' },
			duration: 28,
			controls: [tRate],
			body: `
<p>Now change the temperature. Faster molecules collide a little more often, but that's not what matters: what matters is the share of collisions that get over the barrier, which grows exponentially.</p>
<p>From 700 to 710 K the rate constant grows by 1.5 times; from 650 to 750 K, by about <strong>70 times</strong>. At 750 K half of the hydrogen is gone in 4½ minutes; at 650 K it takes five hours. The time-lapse here is one second for five minutes.</p>`,
			notes: `<p>The collisions themselves only become √T more frequent: from 650 to 750 K, 7 % more. Everything else is the Boltzmann factor e<sup>−E<sub>a</sub>/RT</sup>. A rough rule of thumb says a reaction doubles its speed every 10 K; that is true for barriers of about 50 kJ/mol near room temperature. With a barrier of 171 kJ/mol at 700 K, doubling takes about 17 K.</p>`
		},
		{
			id: 'catalyst',
			chapter: 'rates',
			title: 'A catalyst lowers the barrier',
			scene: 'flask',
			hints: { plot: 'log', lapse: 'auto', start: 'reactants', focus: 'catalyst' },
			duration: 28,
			controls: [lowering],
			body: `
<p>A <dfn data-def="A substance that speeds up a reaction by giving it a path with a lower barrier, and is not used up.">catalyst</dfn> offers the molecules another way to react, with a lower barrier. On a gold surface, for example, HI molecules stick to the metal, their bonds are loosened, and the barrier drops by about <strong>78 kJ/mol</strong>. The gold itself comes out unchanged.</p>
<p>Lower the barrier. Because the share of collisions that get over it depends exponentially on its height, the effect is enormous: 20 kJ/mol less makes the reaction 30 times faster; the full 78 kJ/mol, <strong>700 000 times</strong>. Half of the hydrogen is then gone in less than 3 milliseconds instead of half an hour.</p>
<p>The plot has a time axis in powers of ten, so that both runs fit. The faint curve is the reaction without a catalyst.</p>`,
			notes: `<p>The decomposition of HI on gold has a barrier of about 105 kJ/mol instead of 183 (the value textbooks quote from Hinshelwood and Prichard, 1925). On the metal the rate law itself changes, because the molecules first have to land on the surface; the page keeps the same rate law and only lowers the barrier, by the same amount in both directions. The time-lapse of the box is adjusted to each run; the clock shows the flask's real time. Most of the catalysts in industry, and every enzyme in your body, work this way.</p>`
		},
		// ------------------------------------------------------------------ equilibrium
		{
			id: 'reverse',
			chapter: 'equilibrium',
			title: 'The reverse reaction',
			scene: 'flask',
			hints: { plot: 'rates', lapse: 600, start: 'reactants', focus: 'reverse' },
			duration: 30,
			body: `
<p>The reaction never runs to the end. Two HI molecules can also collide hard enough to swap partners back:</p>
<p class="formula"><strong>2 HI → H₂ + I₂</strong>, &nbsp; rate = k<sub>r</sub> [HI]²</p>
<p>It goes over the same barrier from the other side, which is higher from there: 171 + 12 = <strong>183 kJ/mol</strong>. Its rate constant k<sub>r</sub> is 52 times smaller than the forward one, but it grows as HI builds up.</p>
<p>Watch the two rates on the plot: the forward rate falls as H₂ and I₂ are used up, the reverse rate rises as HI piles up. The pink flashes in the box are reverse reactions. Sooner or later the two rates must meet.</p>`,
			notes: `<p>Bodenstein measured this reaction too, starting from pure HI. Its own fit gives about 186 kJ/mol; this page derives k<sub>r</sub> from k<sub>f</sub> and the measured equilibrium (next step), which keeps the two directions consistent, within the scatter of his data. The reverse reaction is written with [HI]² because two HI molecules have to meet.</p>`
		},
		{
			id: 'equilibrium',
			chapter: 'equilibrium',
			title: 'Equilibrium: both rates equal',
			scene: 'flask',
			hints: { plot: 'rates', lapse: 600, start: 'reactants', focus: 'equilibrium' },
			duration: 34,
			controls: [restart],
			body: `
<p>After a few hours the amounts stop changing: about <strong>78 %</strong> of the iodine is in HI, and the rest stays as H₂ and I₂. Nothing seems to happen, but the box keeps flashing both ways. HI is still being made and still falling apart, at exactly the same rate. That is <dfn data-def="The state in which the forward and reverse reactions run at the same rate, so the amounts no longer change.">chemical equilibrium</dfn>: not a stop, but a balance, as in the weak acids of <a href="../acids-bases/#weak">Acids, bases and pH</a>.</p>
<p>Equal rates mean k<sub>f</sub>[H₂][I₂] = k<sub>r</sub>[HI]², so the ratio</p>
<p class="formula"><strong>K = [HI]² / ([H₂] [I₂]) = k<sub>f</sub> / k<sub>r</sub></strong></p>
<p>is fixed. This <dfn data-def="K: the ratio of product to reactant concentrations (each raised to its coefficient) once a reaction is at equilibrium. It depends only on the temperature.">equilibrium constant</dfn> is <strong>52</strong> at 700 K. The readout compares it with the same ratio for the mixture right now, Q.</p>`,
			notes: `<p>This is the law of mass action as Guldberg and Waage stated it in 1864: at equilibrium the forward and reverse rates are equal. Bodenstein's equilibrium mixtures give K = 52 at 700 K; Taylor and Crist (1941) found 22.3 % of HI split at 730.8 K, K = 48.6, against 47.7 from his data. In the box, with 60 molecules, the counts jiggle by one or two around the balance; in a real flask, with 10²¹ molecules, the jiggles are far too small to measure.</p>`
		},
		{
			id: 'fromhi',
			chapter: 'equilibrium',
			title: 'The same balance from either side',
			scene: 'flask',
			hints: { plot: 'conc', lapse: 600, start: 'reactants', focus: 'fromhi' },
			duration: 30,
			controls: [from],
			body: `
<p>Start instead from pure hydrogen iodide, with the same atoms. At first only the reverse reaction runs: HI falls apart, H₂ and I₂ appear, and the violet colour grows. Then the forward reaction picks up, and the mixture settles at <strong>the same</strong> amounts as before, from the other side.</p>
<p>The equilibrium doesn't remember where it started. It depends only on the amounts of each kind of atom and on the temperature, through K.</p>`
		},
		{
			id: 'catalysteq',
			chapter: 'equilibrium',
			title: 'A catalyst doesn’t move the equilibrium',
			scene: 'flask',
			hints: { plot: 'log', lapse: 'auto', start: 'reactants', focus: 'catalysteq' },
			duration: 30,
			controls: [gold],
			body: `
<p>A catalyst lowers the barrier, and it is the same barrier whichever way the molecules cross it. So it speeds up the forward and the reverse reactions by <strong>exactly the same factor</strong>. Their ratio, K = k<sub>f</sub>/k<sub>r</sub>, stays the same, and so does the final mixture.</p>
<p>Switch the gold on and compare the curves: with the catalyst, the mixture reaches equilibrium about 700 000 times sooner, but it ends up at the same 78 % HI. A catalyst gets a reaction to its equilibrium faster; it cannot make more product than the equilibrium allows.</p>`,
			notes: `<p>If a catalyst could shift an equilibrium, you could build a perpetual-motion machine: let a gas mixture shift one way with the catalyst in, the other way with it out, and draw work from each swing. The catalyst lowers both barriers by the same amount because the two directions are the same path, crossed forwards or backwards.</p>`
		},
		// ------------------------------------------------------------------ push
		{
			id: 'add',
			chapter: 'push',
			title: 'Add hydrogen: the balance shifts',
			scene: 'flask',
			hints: { plot: 'conc', lapse: 600, start: 'equilibrium', focus: 'add' },
			duration: 32,
			controls: [addH2, removeH2, restart],
			body: `
<p>The flask starts at equilibrium. Now inject more hydrogen. More H₂ means more H₂–I₂ meetings, so the forward rate jumps while the reverse rate hasn't changed: Q drops below K. The reaction runs forward, using up some of the new H₂ and part of the remaining I₂, until the rates are equal again and Q = K.</p>
<p>Take hydrogen out and the opposite happens: HI falls apart to replace some of it. Either way the mixture moves to counter the change, without fully undoing it. That is <dfn data-def="Disturb a system at equilibrium and it shifts in the direction that partly counters the disturbance. Henry Le Chatelier, 1884.">Le Chatelier's principle</dfn>, and here it is not a separate rule: it follows from the two rates.</p>`,
			notes: `<p>Industry uses this to get more product: remove it as it forms, or add an excess of the cheaper reactant. In this reaction the number of gas molecules is the same on both sides (two before, two after), so squeezing the flask changes nothing: both rates rise by the same factor. For reactions that change the number of gas molecules, such as making ammonia, pressure does shift the equilibrium.</p>`
		},
		{
			id: 'heat',
			chapter: 'push',
			title: 'Heat it: faster, and slightly less HI',
			scene: 'flask',
			hints: { plot: 'conc', lapse: 600, start: 'equilibrium', focus: 'heat' },
			duration: 34,
			controls: [tHeat, gold, addH2, restart],
			body: `
<p>Finally, change the temperature of the flask at equilibrium. Both rates jump, but not equally: the reverse reaction has the higher barrier (183 against 171 kJ/mol), so heating helps it a little more. K falls from 61 at 650 K to 42 at 780 K, and the mixture shifts towards H₂ and I₂, as Le Chatelier predicts for a reaction that gives off heat.</p>
<p>But see how little: from 650 to 780 K the share of iodine in HI only drops from 80 % to 76 %, while the rates grow 200 times. For this reaction, temperature mostly decides <strong>how fast</strong> the balance is reached, and only slightly <strong>where</strong> it lies.</p>
<p>The catalyst and the hydrogen are here too: try them together, and see which ones move the balance and which only change how fast it is reached.</p>
<p>That is the whole story: reactions happen when collisions carry enough energy over a barrier, and equilibrium is where the forward and reverse reactions run at the same rate.</p>`,
			notes: `<p>The size of the shift is set by the reaction's heat: K changes as e<sup>−ΔH/RT</sup>, and −12 kJ/mol is small. For making ammonia, with ΔH = −92 kJ/mol, heating shifts the equilibrium strongly against the product, which is why the Haber–Bosch process needs a catalyst to run fast enough at a moderate temperature.</p>`
		}
	]
};
