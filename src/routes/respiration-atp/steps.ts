import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Oxygen supply to the chain (complex IV's electron acceptor). */
const oxygen: Control = {
	type: 'toggle',
	id: 'oxygen',
	label: 'Oxygen',
	default: true,
	help: 'Take the oxygen away and watch the electrons back up along the chain.'
};

/** ATP synthase open, or blocked as by the antibiotic oligomycin. */
const synthase: Control = {
	type: 'toggle',
	id: 'synthase',
	label: 'Let protons flow back through ATP synthase',
	default: true,
	help: 'Switched off, the synthase is blocked (as by the drug oligomycin): protons have no way back.'
};

const uncoupler: Control = {
	type: 'toggle',
	id: 'uncoupler',
	label: 'Add an uncoupler (a leak in the membrane)',
	default: false,
	help: 'Like the old diet drug DNP, or the UCP1 channel of brown fat: protons leak back without making ATP.'
};

export const spec: ExplainerSpec = {
	slug: 'respiration-atp',
	title: 'How cells turn food into ATP',
	summary:
		'Follow one glucose molecule through glycolysis, the citric acid cycle and the electron transport chain, watch the electrons pump protons and the protons spin ATP synthase, then take the oxygen away and see the chain back up.',
	chapters: [
		{ id: 'overview', title: 'The big picture' },
		{ id: 'sugar', title: 'Taking glucose apart' },
		{ id: 'chain', title: 'The electron transport chain' },
		{ id: 'turbine', title: 'The proton turbine' },
		{ id: 'wrap', title: 'Putting it together' }
	],
	steps: [
		// ------------------------------------------------------------------ overview
		{
			id: 'equation',
			chapter: 'overview',
			title: 'Burning sugar, one small step at a time',
			scene: 'map',
			hints: { phase: 'overview' },
			duration: 18,
			body: `
<p>Every cell in your body runs on the same reaction, the reverse of photosynthesis:</p>
<p class="formula"><strong>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6 O<sub>2</sub> → 6 CO<sub>2</sub> + 6 H<sub>2</sub>O</strong></p>
<p>It is the same chemistry as burning sugar in a flame, and it releases the same energy: 2,840 kJ per mole of glucose (180 g). A flame lets it all go at once, as heat. A cell takes the glucose apart in some thirty small, enzyme-controlled steps and stores a large part of the energy in a molecule it can spend anywhere: <dfn data-def="Adenosine triphosphate. Splitting off its last phosphate (ATP → ADP + phosphate) releases about 50 kJ/mol in a living cell, enough to drive a muscle protein's stroke, a pump or a chemical synthesis.">ATP</dfn>.</p>
<p>The work is shared out between two places you met in the cell: the <strong>cytosol</strong>, where glucose is split in half, and the <strong>mitochondria</strong>, where the halves are burned to CO<sub>2</sub> and the energy is turned into ATP. Follow the glucose on the left.</p>`,
			notes: `<p>2,840 kJ/mol is the standard free-energy change of the complete oxidation (Lehninger, <i>Principles of Biochemistry</i>). A resting adult turns over roughly their own body weight of ATP every day, yet holds only a tiny fraction of that at any moment: each ATP molecule is recharged from ADP over and over.</p><p>A mirror image: photosynthesis splits water and releases its oxygen; respiration takes oxygen and makes water again. The oxygen you breathe ends up in water, not in the CO<sub>2</sub> you breathe out — the carbon dioxide's oxygen comes from the glucose and from water.</p>`
		},
		// ------------------------------------------------------------------ sugar
		{
			id: 'invest',
			chapter: 'sugar',
			title: 'Glycolysis: spend two ATP',
			scene: 'glycolysis',
			hints: { phase: 'invest' },
			duration: 16,
			body: `
<p><dfn data-def="‘Sugar splitting’: ten enzymes in the cytosol that turn one glucose (6 carbons) into two pyruvate (3 carbons each). It needs no oxygen.">Glycolysis</dfn> happens in the cytosol, in ten steps, each run by its own enzyme. Each bead on the left is one carbon atom.</p>
<p>The first steps cost energy. Two ATP each give up a phosphate group to the sugar: one when it enters (<strong>hexokinase</strong>), one two steps later (<strong>phosphofructokinase</strong>). The doubly charged sugar can no longer leave the cell, and it is now unstable enough to break.</p>
<p>The enzyme <strong>aldolase</strong> cuts the six-carbon chain into two three-carbon halves, each carrying one phosphate. From here on everything happens twice.</p>`,
			notes: `<p>Phosphofructokinase is the main control valve of glycolysis: it is slowed by plenty of ATP and citrate (the cell has enough energy) and sped up by AMP (it is running low). Aldolase gives two different halves, dihydroxyacetone phosphate and glyceraldehyde 3-phosphate; a fifth enzyme, triose phosphate isomerase, turns the first into the second, so both go on the same way.</p>`
		},
		{
			id: 'payoff',
			chapter: 'sugar',
			title: '…and get four back',
			scene: 'glycolysis',
			hints: { phase: 'payoff' },
			duration: 16,
			body: `
<p>Now the payback. Each three-carbon half is <dfn data-def="Losing electrons (here, a hydride: two electrons and a proton). The opposite, gaining electrons, is reduction.">oxidised</dfn>: an enzyme strips two electrons and a proton from it and hands them to a carrier, <dfn data-def="Nicotinamide adenine dinucleotide: a carrier of electrons. NAD⁺ picks up two electrons and a proton to become NADH, and gives them up again at the electron transport chain.">NAD⁺</dfn>, which becomes <strong>NADH</strong>. The energy released is used to attach a second phosphate, which the half then hands to ADP: one ATP. One more ATP comes at the last step, when the half becomes <strong>pyruvate</strong>.</p>
<p>Two halves × two ATP = <strong>4 ATP made</strong>, minus the 2 invested: a net gain of <strong>2 ATP and 2 NADH</strong> per glucose, and two pyruvates.</p>
<p>Making ATP this way, by handing a phosphate directly from a molecule to ADP, is called <dfn data-def="ATP made by an enzyme passing a phosphate group from a high-energy molecule to ADP, without any membrane or gradient.">substrate-level phosphorylation</dfn>. It is quick, but it has captured only a few percent of the glucose's energy. Most of it is still in the pyruvate and the NADH.</p>`
		},
		{
			id: 'link',
			chapter: 'sugar',
			title: 'Into the mitochondrion',
			scene: 'cycle',
			hints: { phase: 'link' },
			duration: 14,
			body: `
<p>With oxygen around, the pyruvate is carried across the two mitochondrial membranes into the <dfn data-def="The space inside the inner membrane of a mitochondrion, a protein-packed gel where the citric acid cycle runs.">matrix</dfn>.</p>
<p>There a giant enzyme complex, <strong>pyruvate dehydrogenase</strong>, cuts off one carbon as <strong>CO<sub>2</sub></strong>: this is where the carbon dioxide you breathe out begins. It strips two more electrons onto NAD<sup>+</sup> (another <strong>NADH</strong>), and hooks the remaining two-carbon <strong>acetyl</strong> group onto a carrier, coenzyme A.</p>
<p>The <strong>acetyl-CoA</strong> that comes out is the common fuel of the mitochondrion: fats and many amino acids are broken down to it too.</p>`
		},
		{
			id: 'krebs',
			chapter: 'sugar',
			title: 'The citric acid cycle',
			scene: 'cycle',
			hints: { phase: 'cycle' },
			duration: 22,
			body: `
<p>The acetyl group (2 carbons) is joined to a four-carbon molecule, <strong>oxaloacetate</strong>, to make <strong>citrate</strong> (6 carbons). Seven more enzymes then take citrate back down to oxaloacetate, ready for the next acetyl. In one turn of this <dfn data-def="Also called the Krebs cycle or tricarboxylic acid (TCA) cycle, after Hans Krebs, who worked it out in 1937.">citric acid cycle</dfn>:</p>
<ul>
<li>two carbons leave as <strong>2 CO<sub>2</sub></strong>;</li>
<li>four pairs of electrons are stripped off: <strong>3 NADH</strong> and <strong>1 FADH<sub>2</sub></strong>, a second carrier;</li>
<li>one ATP's worth is made directly, as <strong>GTP</strong>.</li>
</ul>
<p>It turns twice per glucose. Count up: by now the glucose is gone, all six carbons breathed out as CO<sub>2</sub>, and the cell has made just <strong>4 ATP</strong>. The rest of the energy rides on <strong>10 NADH and 2 FADH<sub>2</sub></strong>, whose electrons go next to the inner membrane.</p>`,
			notes: `<p>The two CO<sub>2</sub> released in a turn are not the two carbons the acetyl group just brought in: those stay on the oxaloacetate and leave in later turns. The cycle's own molecules are only borrowed; it is the acetyl's carbon atoms, on average, that leave.</p><p>FADH<sub>2</sub> is made by succinate dehydrogenase, an enzyme sitting in the inner membrane, where it is also <em>complex II</em> of the chain. Its FAD stays bound to the enzyme and hands the electrons straight on. GTP is converted to ATP by a phosphate swap (nucleoside diphosphate kinase); in some tissues the enzyme makes ATP directly.</p>`
		},
		// ------------------------------------------------------------------ chain
		{
			id: 'complex1',
			chapter: 'chain',
			title: 'Complex I: the first proton pump',
			scene: 'chain',
			hints: { focus: 'I' },
			body: `
<p>The inner membrane of the mitochondrion — folded into the cristae — carries four large protein complexes, numbered I to IV, plus ATP synthase. They form the <dfn data-def="A series of protein complexes and small carriers that pass electrons from NADH and FADH₂ to oxygen, using the energy released to pump protons across the membrane.">electron transport chain</dfn>. Here the membrane is seen edge-on: the matrix above, the narrow <dfn data-def="The thin space between the inner and outer membranes of a mitochondrion. Protons pumped out of the matrix collect here (and in the cristae).">intermembrane space</dfn> below.</p>
<p>NADH hands its two electrons to <strong>complex I</strong>, a huge L-shaped enzyme. The electrons drop to a small, oily carrier dissolved in the membrane, <dfn data-def="Coenzyme Q, a small fat-soluble molecule that carries two electrons (as QH₂, ubiquinol) through the inner membrane from complexes I and II to complex III.">ubiquinone</dfn> (Q). That drop in energy drives <strong>4 protons</strong> (H⁺) out of the matrix into the intermembrane space.</p>
<p>NAD<sup>+</sup> goes back to the citric acid cycle to pick up more electrons.</p>`,
			notes: `<p>Complex I is about 45 protein chains and 1 megadalton in mammals. The electrons run along its arm in the matrix through a flavin and seven iron–sulfur clusters; the energy is passed mechanically to four proton channels in the membrane arm. Its structure, with that of complexes III and IV, has been solved by cryo-electron microscopy.</p>`
		},
		{
			id: 'complex3',
			chapter: 'chain',
			title: 'Ubiquinone, complex III and cytochrome c',
			scene: 'chain',
			hints: { focus: 'III' },
			body: `
<p>Reduced ubiquinone (QH<sub>2</sub>) drifts through the membrane to <strong>complex III</strong>. It gives up its two electrons and releases its two protons into the intermembrane space; complex III, by a trick called the <dfn data-def="A loop inside complex III in which one of each pair of electrons is recycled to a second ubiquinone. It doubles the protons released per electron.">Q-cycle</dfn>, makes this <strong>4 protons</strong> per pair of electrons.</p>
<p>The electrons go on, one at a time, to <strong>cytochrome c</strong>, a small protein that carries them along the outer face of the membrane to complex IV.</p>
<p>FADH<sub>2</sub>'s electrons join the chain lower down. Its enzyme, <strong>complex II</strong>, passes them straight to ubiquinone and pumps no protons at all. So each FADH<sub>2</sub> drives 6 protons out, each NADH 10.</p>`,
			notes: `<p>Cytochromes are proteins that carry a heme, an iron atom held in a ring like the one in haemoglobin; the iron switches between Fe<sup>3+</sup> and Fe<sup>2+</sup> as it takes and gives an electron. Antimycin A, a fungal poison, blocks complex III; rotenone, a plant insecticide, blocks complex I.</p>`
		},
		{
			id: 'oxygen',
			chapter: 'chain',
			title: 'Oxygen, the last electron acceptor',
			scene: 'chain',
			hints: { focus: 'IV' },
			controls: [oxygen],
			duration: 20,
			body: `
<p><strong>Complex IV</strong> (cytochrome c oxidase) collects four electrons from cytochrome c and hands them to one molecule of <strong>oxygen</strong>, with four protons taken from the matrix:</p>
<p class="formula"><strong>O<sub>2</sub> + 4 H<sup>+</sup> + 4 e<sup>−</sup> → 2 H<sub>2</sub>O</strong></p>
<p>This is why you breathe. On the way it pumps <strong>2 more protons</strong> per pair of electrons. Oxygen pulls electrons harder than any carrier before it, so the whole chain runs downhill towards it.</p>
<p>Now switch the oxygen off. Complex IV has nowhere to put its electrons, so cytochrome c stays loaded; then ubiquinone; then complex I and the NADH. Every carrier fills up, the pumps stop and the gradient runs down. With no NAD<sup>+</sup> left, the citric acid cycle stops too.</p>`,
			notes: `<p>Cyanide and carbon monoxide kill by binding to complex IV's iron–copper centre, which has the same effect as taking the oxygen away. The bars show the share of each carrier that is holding electrons; when oxygen returns the chain restarts within seconds.</p><p>The model behind the bars and readouts: three carrier pools and the voltage across the membrane, each complex running forward and backward with the ratio set by its drop in redox potential minus the work of pumping. The rate constants are illustrative; the order in which the carriers fill up follows from their potentials.</p>`
		},
		{
			id: 'staircase',
			chapter: 'chain',
			title: 'An energy staircase',
			scene: 'staircase',
			duration: 18,
			controls: [
				{
					type: 'select',
					id: 'source',
					label: 'Electrons from',
					default: 'nadh',
					options: [
						{ value: 'nadh', label: 'NADH' },
						{ value: 'fadh2', label: 'FADH₂ (succinate)' }
					]
				}
			],
			body: `
<p>Here is the same journey as an energy diagram, the mirror image of photosynthesis's Z-scheme. Up is high energy: the vertical axis is the <dfn data-def="How readily a carrier gives up electrons, in volts. The more negative, the more energetic its electrons.">redox potential</dfn>. In photosynthesis light lifts the electrons twice; here they only run downhill, from NADH at −0.32 V to oxygen at +0.82 V.</p>
<p>That drop releases about <strong>220 kJ per mole</strong> of electron pairs, more than four times what an ATP stores. Released in one go it could make at most one ATP and would waste the rest as heat. Instead it comes in three big steps, at complexes I, III and IV, and each one pays for pumping protons.</p>
<p>Switch to FADH<sub>2</sub>: its electrons start lower, skip complex I, and pay for 6 protons instead of 10.</p>`,
			notes: `<p>Energy released by two electrons falling through a potential difference Δ<i>E</i>: Δ<i>G</i> = −2<i>F</i>Δ<i>E</i>, with <i>F</i> = 96,485 C/mol. From NADH to O<sub>2</sub>, Δ<i>E</i> = 1.14 V, so 219 kJ/mol. Each proton pushed across a membrane holding about 180 mV stores <i>F</i> × 0.18 V ≈ 17 kJ/mol, so the 10 protons keep some 170 kJ of the 219. Potentials are the standard midpoint values at pH 7 (Lehninger, Table 19-2); in the cell they shift with how reduced each pool is.</p>`
		},
		// ------------------------------------------------------------------ turbine
		{
			id: 'gradient',
			chapter: 'turbine',
			title: 'A charged membrane',
			scene: 'chain',
			hints: { focus: 'atp' },
			controls: [synthase],
			duration: 20,
			body: `
<p>Pumping protons out of the matrix charges the inner membrane like a battery: the intermembrane side becomes positive and slightly more acidic. Together the voltage and the acidity difference make the <dfn data-def="The energy, per unit charge, that pushes protons back into the matrix: the membrane voltage (≈ 150–180 mV) plus the pH difference (≈ 0.5–0.9 units, ≈ 30–50 mV).">proton-motive force</dfn>, about <strong>180 mV</strong> across a membrane only 5 nm thick: an electric field of some 35 million volts per metre.</p>
<p>Unlike in a chloroplast, most of it is voltage, not acidity. The protons' only easy way back is through <strong>ATP synthase</strong>, and it lets them through only while making ATP.</p>
<p>Block the synthase (as the antibiotic <strong>oligomycin</strong> does). The gradient rises until pumping against it gets too hard, and the whole chain slows almost to a stop, even with plenty of NADH and oxygen. Respiration and ATP making are <em>coupled</em>: the cell burns its food only as fast as it spends ATP.</p>`,
			notes: `<p>This is Peter Mitchell's chemiosmotic theory (1961, Nobel Prize 1978), which was fiercely resisted for a decade because no one could find a high-energy chemical intermediate linking the chain to ATP: there isn't one; the link is the gradient. Matrix pH is about 7.8 and the intermembrane space about 6.9–7.2 (Porcelli et al., <i>BBRC</i> 2005).</p><p>Simplification: in the model the blocked synthase simply stops. A real one, with too little gradient, runs backwards, burning ATP to pump protons, until a small inhibitor protein (IF1) stops it.</p>`
		},
		{
			id: 'rotor',
			chapter: 'turbine',
			title: 'ATP synthase, a rotary motor',
			scene: 'synthase',
			duration: 22,
			controls: [
				{
					type: 'select',
					id: 'ring',
					label: 'Whose ATP synthase',
					default: 'cow',
					options: [
						{ value: 'cow', label: 'Cow, human (8 c-subunits)' },
						{ value: 'yeast', label: 'Yeast, E. coli (10)' },
						{ value: 'spinach', label: 'Spinach chloroplast (14)' },
						{ value: 'spirulina', label: 'Spirulina (15)' }
					],
					help: 'Rotor rings come in different sizes: the more subunits, the more protons per turn.'
				}
			],
			body: `
<p>This outline is traced from the real structure of a cow's ATP synthase. A proton enters from the intermembrane space through a half-channel in the stator, lands on one of the <strong>c-subunits</strong> of a ring in the membrane, rides almost a full turn, and leaves into the matrix through a second half-channel. Each proton nudges the ring one subunit round.</p>
<p>The ring turns a crooked shaft (γ) inside the head, which is held still by a side stalk. The head has three catalytic sites; each third of a turn the shaft squeezes one of them shut on an ADP and a phosphate, making <strong>ATP</strong>, while another opens to let a finished ATP go. One full turn: <strong>3 ATP</strong>.</p>
<p>Our c-ring has 8 subunits, so 8 protons make 3 ATP: <strong>2.7 protons per ATP</strong>, plus about one more to bring the phosphate in and send the ATP out. Try other rings: a spinach chloroplast's has 14 and pays 4.7.</p>`,
			notes: `<p>The bovine ring's 8 subunits were found by Watt et al. (<i>PNAS</i> 2010); the structure drawn is PDB 6ZPO (Spikes et al. 2020), which has 8 c chains. Rings of 10 to 15 subunits are known in yeast, bacteria and chloroplasts. Paul Boyer proposed the rotating ‘binding change’ mechanism and John Walker solved the head's structure (Nobel Prize 1997); in 1997 Noji and colleagues fixed the head to glass, attached a fluorescent actin filament to the shaft and watched it turn. The real motor turns about 100 times a second; it is drawn much slower.</p>`
		},
		{
			id: 'yield',
			chapter: 'turbine',
			title: 'How much ATP from one glucose?',
			scene: 'ledger',
			duration: 20,
			controls: [
				{
					type: 'select',
					id: 'count',
					label: 'Count with',
					default: 'measured',
					options: [
						{ value: 'measured', label: 'Measured P/O: 2.5 and 1.5' },
						{ value: 'ring', label: 'The c₈ ring’s maximum: 2.7 and 1.6' },
						{ value: 'classic', label: 'Old textbooks: 3 and 2' }
					]
				},
				{
					type: 'select',
					id: 'shuttle',
					label: 'How the cytosol’s NADH gets in',
					default: 'malate',
					options: [
						{ value: 'malate', label: 'Malate–aspartate shuttle (liver, heart)' },
						{ value: 'glycerol', label: 'Glycerol-phosphate shuttle (muscle, brain)' }
					]
				}
			],
			body: `
<p>Add it up. Each NADH sends 10 protons out, each FADH<sub>2</sub> 6, and about 3.7–4 protons buy one ATP. The number of ATP per pair of electrons reaching oxygen is the <dfn data-def="ATP made per oxygen atom (per pair of electrons) consumed. Measured in isolated mitochondria by giving them a substrate, a known amount of ADP and recording the oxygen used.">P/O ratio</dfn>: measured, about <strong>2.5 for NADH and 1.5 for FADH<sub>2</sub></strong>.</p>
<p>That gives <strong>30–32 ATP per glucose</strong>. The NADH made in the cytosol can't cross the inner membrane; a shuttle passes its electrons in, either to NAD<sup>+</sup> (worth 2.5) or straight to ubiquinone (worth 1.5).</p>
<p>The c<sub>8</sub> ring would allow up to about 34–35, if no proton ever leaked back; real membranes leak a little. Old textbooks quoted 36–38, from whole-number P/O ratios of 3 and 2 measured before anyone could count the protons.</p>`,
			notes: `<p>P/O ratios: Hinkle, <i>BBA</i> 1706:1 (2005), who reviews the measurements since 1937 and finds about 2.5 for NADH-linked substrates and 1.5 for succinate, consistent with 10 and 6 protons per pair of electrons and 4 per ATP (3 at the synthase plus 1 for transport). The bovine c<sub>8</sub> ring (Watt et al., <i>PNAS</i> 2010) lowers the synthase's share to 8/3 ≈ 2.7, so the mechanistic maximum is 10/3.7 ≈ 2.7 and 6/3.7 ≈ 1.6; proton leak across the membrane, which accounts for about a fifth of a resting rat's oxygen use (Rolfe &amp; Brown, <i>Physiol. Rev.</i> 1997), is the usual explanation for the difference.</p><p>At the standard −30.5 kJ/mol per ATP, 32 ATP keep 34% of glucose's 2,840 kJ; in a living cell, where an ATP is worth about 50 kJ/mol, it is over half — a better efficiency than most engines.</p>`
		},
		// ------------------------------------------------------------------ wrap
		{
			id: 'fermentation',
			chapter: 'wrap',
			title: 'Without oxygen: fermentation',
			scene: 'glycolysis',
			hints: { phase: 'ferment' },
			duration: 16,
			body: `
<p>When a sprinting muscle runs short of oxygen, the chain backs up as you saw, NADH piles up and the cell runs out of NAD<sup>+</sup>. Glycolysis needs NAD<sup>+</sup> at its sixth step, so it would stop too.</p>
<p>The way out: an enzyme, <strong>lactate dehydrogenase</strong>, hands NADH's electrons back to pyruvate, making <strong>lactate</strong> and freeing NAD<sup>+</sup> to keep glycolysis running. Yeast does the same thing differently, making ethanol and CO<sub>2</sub>.</p>
<p>This <dfn data-def="Making ATP by glycolysis alone, regenerating NAD⁺ by passing NADH's electrons onto an organic molecule (lactate, ethanol) instead of to oxygen.">fermentation</dfn> yields only the <strong>2 ATP</strong> of glycolysis per glucose, sixteen times less than respiration. To keep up, a cell must burn glucose much faster.</p>`,
			notes: `<p>The lactate is not a waste product that causes muscle soreness: it is carried in the blood to the heart, which burns it, and to the liver, which builds it back into glucose (the Cori cycle). Louis Pasteur noticed in 1861 that yeast consumes far more sugar without air than with it: the Pasteur effect.</p>`
		},
		{
			id: 'summary',
			chapter: 'wrap',
			title: 'The whole system',
			scene: 'map',
			hints: { phase: 'summary' },
			controls: [
				{
					...oxygen,
					id: 'oxygen-cell',
					help: 'Without oxygen only glycolysis runs, ending in lactate.'
				}
			],
			duration: 20,
			body: `
<p>One glucose, start to finish. Glycolysis in the cytosol splits it and makes 2 ATP; the citric acid cycle in the matrix burns the pieces to CO<sub>2</sub>, loading 10 NADH and 2 FADH<sub>2</sub>; the chain in the inner membrane passes their electrons to oxygen, pumping protons; and ATP synthase turns the proton gradient into some 26–28 more ATP.</p>
<p>The energy of food is released in small steps, stored for a moment as a gradient of protons across a membrane, and turned into ATP by a rotating enzyme. The same design, a chain, a gradient and a turbine, makes ATP in chloroplasts and in bacteria: it is one of the oldest machines of life.</p>
<p>Turn the oxygen off: only glycolysis is left, and the cell's ATP per glucose drops from about 32 to 2.</p>`
		}
	]
};
