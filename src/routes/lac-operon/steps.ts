import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const glc: Control = {
	type: 'toggle',
	id: 'glc',
	label: 'Glucose in the medium',
	default: false
};

const lac: Control = {
	type: 'toggle',
	id: 'lac',
	label: 'Lactose in the medium',
	default: true
};

/** TMG on a log scale: the control holds log₁₀(TMG / µM). */
const tmg: Control = {
	type: 'range',
	id: 'tmg',
	label: 'TMG outside the cell',
	min: -0.3,
	max: 2.5,
	step: 0.05,
	default: 1,
	format: (v) => `${Number((10 ** v).toPrecision(2))} µM`
};

const gluc: Control = {
	type: 'range',
	id: 'gluc',
	label: 'Glucose (cells on succinate)',
	min: 0,
	max: 1000,
	default: 0,
	values: () => [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
	format: (v) => `${v} µM`
};

const g0: Control = {
	type: 'range',
	id: 'g0',
	label: 'Glucose at the start',
	min: 0.2,
	max: 2,
	step: 0.1,
	default: 1,
	format: (v) => `${v.toFixed(1)} mM`
};

const l0: Control = {
	type: 'range',
	id: 'l0',
	label: 'Lactose at the start',
	min: 0.5,
	max: 4,
	step: 0.1,
	default: 2,
	format: (v) => `${v.toFixed(1)} mM`
};

const strain: Control = {
	type: 'select',
	id: 'strain',
	label: 'Cells',
	default: 'wild',
	options: [
		{ value: 'wild', label: 'Wild type' },
		{ value: 'uv5', label: 'lacL8UV5: no CAP needed' },
		{ value: 'lacI', label: 'lacI⁻: no repressor' },
		{ value: 'noexcl', label: 'What if: unblockable permease' }
	]
};

/**
 * Scenes: `operon` (a cell with its membrane transporters and the lac operon on its DNA; the
 * classic four media and, with focus 'loop', the feedback loop running from a few permeases to
 * full induction), `balance` (production against loss of LacY, log–log, at a TMG level), `loop`
 * (the steady states against the inducer and a slow sweep up and down: TMG, TMG with glucose,
 * lactose) and `culture` (a batch culture on glucose and lactose: density, sugars, lac output).
 * Operon hints: `focus` 'operon' | 'loop'. Loop hints: `inducer` 'tmg' | 'lactose'.
 */
export const spec: ExplainerSpec = {
	slug: 'lac-operon',
	title: 'The lac operon: a switch with a memory',
	summary:
		'Set the sugars in a bacterium’s medium and watch the repressor, CAP and the permease decide whether the lac genes are read. Sweep the inducer TMG up and down to trace the hysteresis loop Ozbudak and colleagues measured, see why lactose itself gives no loop, and grow a culture on two sugars to find the diauxic pause.',
	chapters: [
		{ id: 'switch', title: 'Two signals, one operon' },
		{ id: 'memory', title: 'A switch with a memory' },
		{ id: 'diauxie', title: 'Glucose first' }
	],
	steps: [
		// ------------------------------------------------------------------ switch
		{
			id: 'operon',
			chapter: 'switch',
			title: 'Three genes, read only when needed',
			scene: 'operon',
			hints: { focus: 'operon' },
			duration: 26,
			controls: [glc, lac],
			body: `
<p><i>E. coli</i> keeps the genes for eating lactose side by side on its DNA and reads them as one message, an <dfn data-def="A set of neighbouring genes read from one promoter into a single mRNA, so that they are switched on and off together. Jacob and Monod described the lac operon in 1961.">operon</dfn>: <strong>lacZ</strong> makes β-galactosidase, which splits lactose into glucose and galactose; <strong>lacY</strong> makes the permease LacY, which pumps lactose into the cell; <strong>lacA</strong> makes an acetyltransferase. <a href="../dna-to-protein/#transcribe">Transcription</a> starts at the promoter, where RNA polymerase binds.</p>
<p>Two proteins decide whether it does. The <strong>repressor</strong> LacI sits on the <dfn data-def="A short stretch of DNA next to the promoter. LacI bound there keeps RNA polymerase from reading the genes.">operator</dfn> and blocks the way, unless an <strong>inducer</strong> binds it and makes it let go: in nature that is allolactose, a by-product of β-galactosidase acting on lactose. The activator <strong>CAP</strong> (also called CRP), loaded with the small messenger cAMP, helps RNA polymerase onto the promoter; cells make more cAMP when glucose is scarce.</p>
<p>Switch the sugars. With lactose alone, the operon is read strongly, at about two thirds of its full rate in this model. Without lactose it is almost silent: under one percent of that. With glucose, even if lactose is there, it stays off: the cell eats the better sugar first. Why glucose wins is the subject of the last chapter.</p>`,
			notes: `<p>The output is the steady state of the page's model (see the next steps) for cells growing on these sugars, as a percentage of the fully induced level. "Silent" is never zero: a repressed operon is still read now and then, and its leak, about 1/170 of the full rate in the model, matters for what follows. The real operon has three operators; LacI, a tetramer, can hold two of them at once and loop the DNA between them, which represses more tightly. Each sugar here is at 2 mM.</p>`
		},
		{
			id: 'loop',
			chapter: 'switch',
			title: 'The product imports its own inducer',
			scene: 'operon',
			hints: { focus: 'loop' },
			duration: 28,
			controls: [glc, lac],
			body: `
<p>Lactose can hardly cross the membrane by itself: it enters through LacY, the permease the operon makes. So the operon sits in a loop. More permease lets in more lactose, which makes more allolactose, which takes more repressors off the operator, which makes more permease: <strong>positive feedback</strong>.</p>
<p>Follow the loop around the cell. It needs a seed: a cell that has never seen lactose still has a few permeases, made by the operon's leak, and without them no lactose could get in and the operon could never switch on. Add glucose and the loop is weakened at the membrane: glucose's transporter blocks some of the permeases, less inducer gets in, fewer permeases are made, and so on around the loop. A partial block ends as a near shutdown.</p>
<p>A loop like this can make a switch rather than a dimmer, if the repressor's response is steep (its activity falls steeply as inducer rises), if it represses tightly (so off and on are far apart), and if the inducer is not used up. The next chapter tests all three.</p>`,
			notes: `<p>The repressor's release by inducer is cooperative, with a Hill coefficient of about 2 (Yagil and Yagil 1971): LacI is a tetramer with four inducer sites, and more bound inducers loosen it further. Allolactose is a side product of β-galactosidase acting on lactose; the same enzyme then splits allolactose too.</p>`
		},
		// ------------------------------------------------------------------ memory
		{
			id: 'balance',
			chapter: 'memory',
			title: 'Making and losing permease',
			scene: 'balance',
			duration: 30,
			controls: [tmg],
			body: `
<p>To see the loop's consequence, take away the complication of eating: use <dfn data-def="Methyl-β-D-thiogalactoside: a lactose look-alike that binds the repressor and enters through LacY but is not broken down, so its level inside the cell depends only on the permease.">TMG</dfn>, a <strong>gratuitous</strong> inducer that the cell takes up through LacY but cannot digest.</p>
<p>Each cell makes LacY at a rate that depends on how much LacY it already has (the S-shaped curve: more permease, more TMG inside, fewer repressors), and loses it as the cell grows and divides, at a rate proportional to the amount (the straight line). A <dfn data-def="A state in which production and loss balance, so the level stays put. It is stable if a small push away from it is undone, unstable if the push grows.">steady state</dfn> is where the two meet, just as an <a href="../reaction-rates-equilibrium/#equilibrium">equilibrium</a> is where forward and reverse rates meet.</p>
<p>Slide the TMG. Below about 3 µM the curves cross once, at <em>off</em>; above about 25 µM once, at <em>on</em>. In between they cross three times: off and on are both stable, and the crossing between them is a tipping point. Which state a cell is in depends on which side of it it started.</p>`,
			notes: `<p>This is the model of Ozbudak, Thattai, Lim, Shraiman and van Oudenaarden (<i>Nature</i>, 2004), with the parameters they fitted to single-cell measurements: τ dy/dt = α(1 + (βy)²)/(ρ + (βy)²) − y, with the repression factor ρ = 167 (the ratio of full to leaky output), the maximal output α and the TMG uptake β = β<sub>T</sub>(T)·β<sub>G</sub>(G), with β<sub>T</sub> = 1.23·10⁻³·T<sup>0.6</sup> for T in µM and β<sub>G</sub> = 100 without glucose. Here y is the amount of LacY, and τ = 2 h is our choice of its time constant (LacY is stable, so it is lost by dilution as the cells grow); multiplying both rates by τ puts them in the same units as y. Both axes are logarithmic, so the loss line is a diagonal. The internal TMG is assumed to follow the permease instantly. They estimate that a repression factor below 9 would leave no bistable range at all: the switch needs tight repression as well as a steep response.</p>`
		},
		{
			id: 'hysteresis',
			chapter: 'memory',
			title: 'Up one way, down another',
			scene: 'loop',
			hints: { inducer: 'tmg' },
			duration: 30,
			body: `
<p>Now raise the TMG slowly, from 0.5 µM to 3 mM, and then lower it again, and follow one cell. The curve is every steady state of the previous step: solid where stable, dashed for the tipping points.</p>
<p>On the way up the cell stays off, on the lower branch, well past 3 µM; only where that branch ends does it jump to on, a hundredfold brighter. On the way down it stays on, past 30 µM, until the upper branch ends, and drops back. The two paths enclose a loop: <dfn data-def="A response that depends on the history of the input, not only on its present value.">hysteresis</dfn>.</p>
<p>Ozbudak and colleagues measured exactly this in single cells: TMG had to rise above about <strong>30 µM</strong> to turn uninduced cells on, and fall below about <strong>3 µM</strong> to turn induced cells off. Between the two, a cell's state is a memory of where it came from.</p>`,
			notes: `<p>Their experiment did not sweep one cell: they grew cells taken from an induced or an uninduced culture for 20 h at each TMG level, and called the thresholds where fewer than 5% of the cells remained in their starting state. The model, with their fitted parameters, puts the two ends of the bistable range at 3.4 and 24 µM. Near each end the cell responds very slowly (the push towards the other state nearly vanishes), so even a slow sweep jumps a little past it. Novick and Weiner saw the all-or-none induction and its memory in 1957, also with TMG. In a real population the state of each cell also jitters with the random timing of gene expression, so cells near a threshold flip at different moments.</p>`
		},
		{
			id: 'glucose',
			chapter: 'memory',
			title: 'Glucose moves the loop',
			scene: 'loop',
			hints: { inducer: 'tmg' },
			duration: 30,
			controls: [gluc],
			body: `
<p>Add glucose to cells that grow on succinate, as Ozbudak's did, and repeat the sweep. Glucose acts on the loop in two places. It lowers cAMP, so CAP activates the operon less: the operon's full output falls to about a fifth. And while glucose flows in, its transporter blocks some of the permeases: <dfn data-def="Glucose entering through its phosphotransferase system leaves the protein EIIA-Glc unphosphorylated; in that form it binds LacY and stops it working.">inducer exclusion</dfn>, which here cuts TMG uptake by about a third.</p>
<p>Both weaken the loop, so a cell needs more TMG to switch on and less permease keeps it on: the whole loop slides to higher TMG, about 40-fold with 1 mM glucose. It never closes. Glucose raises the price of switching on, but the switch keeps its memory.</p>`,
			notes: `<p>The two effects are separated by Ozbudak's fit: the operon's activity α (tracked by a second, CAP-dependent promoter driving a red reporter) falls to 20% of its maximum as glucose rises to 1 mM, while the fraction of active permeases falls to 65% above 10 µM glucose. The curve between 0 and 10 µM is our interpolation. In these cells, which were growing on succinate, CAP-cAMP was the larger of the two effects. In cells that live on glucose the balance is different, as the last chapter shows.</p>`
		},
		{
			id: 'lactose',
			chapter: 'memory',
			title: 'Lactose itself: no loop',
			scene: 'loop',
			hints: { inducer: 'lactose' },
			duration: 30,
			body: `
<p>Now do the same with lactose. The operon still switches on, and it still needs lactose to do it. But the loop is gone: the cell follows the same curve up and down, and at each lactose level it ends up in the same state whatever its history.</p>
<p>Lactose is eaten, and that changes the loop. The β-galactosidase that the operon makes turns lactose into allolactose, the inducer, but it also breaks allolactose down. A cell with more lac enzymes lets in more lactose and destroys more inducer, so its inducer level rises with its permease, but less and less. The positive feedback is still there; it is just too weak, in this sketch, to make two stable states.</p>
<p>Ozbudak and colleagues saw no hysteresis with lactose in over fifty combinations of lactose and glucose, and later single-cell studies of wild-type cells found a graded response too. The memory belongs to the switch fed a gratuitous inducer, not to a wild-type cell feeding on lactose.</p>`,
			notes: `<p>The lactose terms are ours, a sketch of the mechanism Ozbudak and colleagues proposed in their Supplementary Information: allolactose x = b·s·y/(1 + y/y<sub>c</sub>), where s is the permease's saturation by lactose (half at 0.5 mM) and β-galactosidase breaks allolactose down faster than dilution once y exceeds y<sub>c</sub>, 0.7% of full induction. With these constants there is no bistable range at any glucose level. Measurements agree that the feedback operates during lactose induction (Aggarwal and Narang 2022); what removes the bistability is debated (allolactose breakdown, the growth that lactose feeds, cAMP). Zander and colleagues (2017) found wild-type cells graded, and two states with lactose only in cells engineered to make more repressor; Santillán, Mackey and Zeron (2007) argued that a modified bistable range can survive under some conditions. Lactose also feeds the cell, which changes its growth and cAMP: two more reasons the TMG picture does not carry over.</p>`
		},
		// ------------------------------------------------------------------ diauxie
		{
			id: 'diauxie',
			chapter: 'diauxie',
			title: 'Two growth phases and a pause',
			scene: 'culture',
			duration: 34,
			controls: [g0, l0],
			body: `
<p>Grow a culture on glucose and lactose together, starting from cells that have lived on glucose. Jacques Monod saw what happens in the 1940s and called it <dfn data-def="Growth in two phases, on one food after the other, usually with a pause between them.">diauxie</dfn>: the cells grow on glucose alone, as if the lactose were not there; when the glucose runs out they stop; and some time later they start growing again, on lactose.</p>
<p>Watch the lac output: it stays low, near the leak, while glucose lasts, then rises once glucose is gone. The pause is the time the cells take to switch on the operon, from a handful of permeases, and to make enough lac enzymes to live on lactose.</p>
<p>Change the amounts. More glucose makes the first phase longer; more lactose, the second. The pause stays, because it comes from the switch, not from how much of either sugar there is.</p>`,
			notes: `<p>The culture is the page's own sketch, not a fit to a measured curve: growth at 0.8 per hour on glucose and up to 0.65 per hour on lactose (Monod kinetics on each sugar, half-saturation 10 µM and 0.2 mM), yields of 0.22 and 0.43 OD per mM (about half a gram of cells per gram of sugar), lac expression from the switch above (with lactose as on the previous step), stable lac proteins that are diluted only by growth, and protein synthesis that continues slowly while the cells do not grow. The length of the pause depends on these choices; in real cultures it depends on the strain and on the cells' history.</p>`
		},
		{
			id: 'mutants',
			chapter: 'diauxie',
			title: 'Why glucose wins: the blocked permease',
			scene: 'culture',
			duration: 36,
			controls: [strain],
			body: `
<p>The textbook explanation used to be cAMP: glucose lowers it, CAP lets go, the operon is not read. Experiments in the 1990s showed that this is not the main cause. Inada and colleagues found the cAMP-CAP levels in cells growing on glucose and on lactose about the same, and that deleting the repressor abolished glucose's effect. Kimata and colleagues put in a promoter that works without CAP-cAMP (lacL8UV5), and the culture still paused.</p>
<p>What keeps lactose out is <strong>inducer exclusion</strong>: while glucose streams in, its transport protein EIIA-Glc stays unphosphorylated and binds LacY. The block itself is partial: at most about sixfold. But it acts inside the loop: less lactose in, less allolactose, more repressor on the operator, fewer new permeases, and the operon runs down to near silence. When the glucose runs out, the block lifts, and the loop runs the other way.</p>
<p>Pick the cells. The promoter blind to CAP still pauses. Without the repressor the operon is on throughout, and the shift to lactose is smooth. And a permease that glucose cannot block would let the cells eat both sugars at once.</p>`,
			notes: `<p>Inada, Kimata and Aiba (<i>Genes to Cells</i>, 1996) and Kimata, Takahashi, Inada, Postma and Aiba (<i>PNAS</i>, 1997). CAP-cAMP still matters, partly indirectly: it activates <i>ptsG</i>, the gene for the glucose transporter, so without it inducer exclusion is weak. Aggarwal and Narang (<i>Biophysical Journal</i>, 2022) measured inducer exclusion directly: it lowers permease activity at most sixfold, and the several-hundredfold repression by glucose comes from the feedback loop running down. In the model, glucose blocks 83% of the permeases (that sixfold) and lowers the operon's maximal output by 30% through CAP-cAMP: both are our choices. The loop turns them into a 25-fold drop, less than real cells show. Recall that Ozbudak's cells on succinate showed the opposite balance (a fivefold CAP effect and a block of a third): how strongly each acts depends on what the cell is living on. The "what if" permease is not a real strain in this experiment; LacY overproduction, which outnumbers the blocking protein, does abolish the glucose effect (Kimata 1997).</p>`
		}
	]
};
