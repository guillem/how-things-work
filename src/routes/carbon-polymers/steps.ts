import type { ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * The molecule builder (scene `builder`) keeps the reader's molecule per step in the param
 * `mol:<step id>` (`serialize()` in molecule.ts: "6r" = cyclohexane, "4|OH@2" = butan-2-ol);
 * `hints.start` is the molecule a step starts from. The mirror scene keeps the reader's
 * turn of the right-hand copy in the scene itself.
 */
export const spec: ExplainerSpec = {
	slug: 'carbon-polymers',
	title: 'Carbon chemistry and polymers',
	summary:
		'Build carbon chains, rings and functional groups and watch the name and boiling point follow, turn a molecule against its mirror image, and tie chains into a rubber whose stiffness depends on chain length and cross-links.',
	chapters: [
		{ id: 'carbon', title: 'Carbon’s four bonds' },
		{ id: 'build', title: 'Chains, rings and groups' },
		{ id: 'mirror', title: 'Left- and right-handed molecules' },
		{ id: 'polymers', title: 'From chains to plastics' }
	],
	steps: [
		// ------------------------------------------------------------------ carbon
		{
			id: 'four',
			chapter: 'carbon',
			title: 'Four bonds, pointing to a tetrahedron',
			scene: 'chain3d',
			hints: { n: 1 },
			duration: 20,
			body: `
<p>Carbon has four outer electrons and is four short of a full shell, so it makes <strong>four bonds</strong>. In <a href="../chemical-bonds/">Chemical bonds</a> you saw what those four electron pairs do: they push each other as far apart as they can and point to the corners of a <dfn data-def="A pyramid with four identical triangular faces. Lines from its centre to its corners are 109.5° apart.">tetrahedron</dfn>, 109.5° apart.</p>
<p>Here is methane, CH₄, drawn from its measured geometry: each C–H bond is <strong>109 pm</strong> long (a picometre is a millionth of a millionth of a metre). Drag to turn it round.</p>
<p>What makes carbon special is not the four bonds on their own (silicon has four too) but that carbon bonds to <em>itself</em> strongly enough to build chains as long as you like, and still has bonds left over for other atoms.</p>`,
			notes: `<p>Bond lengths and angles on this page are measured values for the gas-phase molecules, from NIST's Computational Chemistry Comparison and Benchmark Database (CCCBDB), which cites the original spectroscopy and electron-diffraction measurements. Silicon–silicon bonds are weaker than carbon–carbon bonds and silicon–oxygen bonds much stronger, so in the presence of oxygen silicon ends up in rock (silicates), not in long Si–Si chains.</p>`
		},
		{
			id: 'chain',
			chapter: 'carbon',
			title: 'Carbon bonds to carbon',
			scene: 'chain3d',
			duration: 24,
			controls: [
				{
					type: 'range',
					id: 'carbons',
					label: 'Carbon atoms in the chain',
					min: 1,
					max: 8,
					step: 1,
					default: 4
				}
			],
			body: `
<p>Swap one hydrogen of methane for another carbon, and that carbon has three bonds left for hydrogens: ethane, C₂H₆. Keep going and you get a chain. Each carbon in the middle holds two hydrogens; the two at the ends hold three. A chain of <em>n</em> carbons is CₙH₂ₙ₊₂, an <dfn data-def="A molecule of carbon and hydrogen only, with single bonds only. Its name ends in -ane.">alkane</dfn>.</p>
<p>The chain is not straight. Every carbon still points its bonds to the corners of a tetrahedron, so the chain <strong>zigzags</strong>: the C–C bonds are <strong>153 pm</strong> long and meet at <strong>112°</strong> (a little wider than 109.5°, because the carbon neighbours are bulkier than hydrogen). Add carbons with the slider and turn the chain round to see the zigzag in 3D.</p>`,
			notes: `<p>Single bonds can twist, so a real chain wiggles into many shapes; this is its most stretched-out one (all the carbons in one plane), the shape long alkane chains take in a crystal of wax. The geometry here is propane's, measured (C–C 1.526 Å, C–C–C 112.4°), used for every length; butane's measured angle is 113.8°.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'names',
			chapter: 'build',
			title: 'Build a chain and name it',
			scene: 'builder',
			hints: { start: '4' },
			duration: 30,
			body: `
<p>Now build molecules yourself. Chemists draw them flat, with the zigzag kept: <strong>add or remove carbons</strong> with the buttons at the top and watch the name, the formula and the boiling point follow.</p>
<p>The name says how many carbons the chain has: <strong>meth</strong>- 1, <strong>eth</strong>- 2, <strong>prop</strong>- 3, <strong>but</strong>- 4, then the Greek numbers <strong>pent</strong>- 5, <strong>hex</strong>- 6, <strong>hept</strong>- 7, <strong>oct</strong>- 8. The ending <strong>-ane</strong> says every bond is single.</p>
<p>Each extra carbon raises the boiling point. Methane boils at −162 °C, butane at 0 °C (the gas in a lighter), pentane at 36 °C and octane, in petrol, at 126 °C. Longer molecules touch their neighbours over a bigger surface, so the weak attractions between them add up.</p>`,
			notes: `<p>Boiling and melting points on this page are measured values at normal atmospheric pressure from the NIST Chemistry WebBook (its critically evaluated averages). Where NIST has no reliable value, the page says so instead of estimating one. The attraction between non-polar molecules is the London dispersion force: momentary, flickering charges in one molecule's electron cloud attract those in the next.</p>`
		},
		{
			id: 'multiple',
			chapter: 'build',
			title: 'Double and triple bonds',
			scene: 'builder',
			hints: { start: '4|double@1' },
			duration: 30,
			body: `
<p>Two neighbouring carbons can share two pairs of electrons instead of one, a <strong>C=C double bond</strong> (each carbon then holds one hydrogen fewer). The ending becomes <strong>-ene</strong>, and a number says where the double bond starts, counting from the nearer end: this is but-1-ene. <strong>Click another bond</strong> of the chain to move the double bond there (move it to the middle and the name gains (E)-: the chain continues on opposite sides of the double bond, which can't twist), or drag a <strong>triple bond</strong> (ending <strong>-yne</strong>) from the palette onto a bond.</p>
<p>Multiple bonds change the shape: around a double bond the atoms lie flat at about 120°, and a triple bond is perfectly straight, so the chain runs straight through it. They are also shorter: C–C 154 pm (in ethane), C=C 134 pm, C≡C 120 pm.</p>
<p>The simplest, ethene (C₂H₄, called ethylene), is made at well over a hundred million tonnes a year. Its double bond is what lets it link up into polyethylene; you'll do that in the last chapter.</p>`,
			notes: `<p>A double bond doesn't twist, so but-2-ene comes in two forms: with the two end carbons on opposite sides of the double bond (<i>trans</i>, or (E)-) or on the same side (<i>cis</i>, (Z)-). The zigzag drawing is the trans form, which is why its name starts with (E)-. Bond lengths: ethane, ethene and ethyne, measured (CCCBDB).</p>`
		},
		{
			id: 'rings',
			chapter: 'build',
			title: 'Rings, and benzene',
			scene: 'builder',
			hints: { start: '6r' },
			duration: 30,
			controls: [
				{
					type: 'toggle',
					id: 'skeletal',
					label: 'Line drawing',
					default: false,
					help: 'How chemists draw it: every corner is a carbon, and the hydrogens on carbon are left out.'
				}
			],
			body: `
<p>Join the two ends of a chain and it becomes a <strong>ring</strong>: the prefix <strong>cyclo-</strong>, and two fewer hydrogens. Cyclohexane, C₆H₁₂, is a ring of six; it really is puckered into a "chair" in 3D, with its angles close to 109.5°. Rings of three and four carbons are forced into 60° and 90° angles, which strains them: they are much more reactive.</p>
<p>A ring of six can also be <strong>benzene</strong>, C₆H₆. Its six extra electrons are not in three fixed double bonds but shared evenly all round the ring, which is drawn as a circle inside the hexagon; all six bonds are the same length, 140 pm, between single and double. That shared ring makes benzene unusually stable, and it sits inside thousands of drugs, dyes and plastics.</p>
<p>Switch on the <strong>line drawing</strong> to see how chemists draw rings and chains: each corner and line end is a carbon, and the hydrogens on carbon are left for you to count.</p>`,
			notes: `<p>The builder draws every ring flat. Only benzene really is flat; the others pucker to bring their angles closer to 109.5° (cyclopentane slightly, cyclohexane into a chair, in which all its angles are 111°). Benzene's bond length is the measured 1.397 Å (CCCBDB).</p>`
		},
		{
			id: 'groups',
			chapter: 'build',
			title: 'Functional groups change everything',
			scene: 'builder',
			hints: { start: '2|OH@1' },
			duration: 34,
			controls: [
				{
					type: 'toggle',
					id: 'skeletal',
					label: 'Line drawing',
					default: false,
					help: 'How chemists draw it: every corner is a carbon, and the hydrogens on carbon are left out.'
				}
			],
			body: `
<p>A carbon skeleton on its own is oily and unreactive. Swap a hydrogen for a small cluster of other atoms, a <dfn data-def="A small group of atoms within a molecule, such as –OH or –COOH, that gives the molecule its characteristic chemistry, whatever skeleton it is attached to.">functional group</dfn>, and the molecule takes on that group's chemistry. <strong>Drag a group onto a carbon</strong>:</p>
<p><strong>–OH</strong> makes an alcohol (ending <strong>-ol</strong>): this is ethanol. <strong>=O</strong> at the end of a chain makes an aldehyde (<strong>-al</strong>), elsewhere a ketone (<strong>-one</strong>, like acetone). <strong>–COOH</strong> at the end makes a carboxylic acid (<strong>-oic acid</strong>; acetic acid is vinegar). <strong>–NH₂</strong> makes an amine, <strong>–Cl</strong> a chloroalkane.</p>
<p>Watch the boiling point. Ethane boils at −89 °C, but ethanol, with one oxygen more, at <strong>78 °C</strong>: its –OH makes hydrogen bonds with its neighbours, as water does (<a href="../chemical-bonds/">Chemical bonds</a>). Acetic acid, with two oxygens, boils at 118 °C.</p>`,
			notes: `<p>Only one feature at a time here, to keep every molecule correctly named and backed by measured data; real molecules carry many groups and branches. The names follow the IUPAC rules (as written by PubChem): the chain is numbered from the end nearer the group. Some molecules keep traditional names that IUPAC accepts too: formaldehyde, acetaldehyde, acetone, formic and acetic acid.</p>`
		},
		{
			id: 'isomers',
			chapter: 'build',
			title: 'Same atoms, different molecules',
			scene: 'lineup',
			hints: { mode: 'isomers' },
			duration: 26,
			controls: [
				{
					type: 'select',
					id: 'pair',
					label: 'Pair',
					default: 'ether',
					options: [
						{ value: 'ether', label: 'C₂H₆O' },
						{ value: 'butane', label: 'C₄H₁₀' },
						{ value: 'propanol', label: 'C₃H₈O' },
						{ value: 'carbonyl', label: 'C₃H₆O' }
					]
				}
			],
			body: `
<p>A formula only counts atoms. Ethanol and dimethyl ether are both <strong>C₂H₆O</strong>: two carbons, six hydrogens and an oxygen. In ethanol the oxygen sits at the end with a hydrogen on it (–OH); in dimethyl ether it sits between the two carbons and has no hydrogen at all.</p>
<p>That one difference decides everything: ethanol's –OH groups hold its molecules together by hydrogen bonds, so it is a liquid that boils at <strong>78 °C</strong>; dimethyl ether can't make them and boils at <strong>−25 °C</strong>, a gas. Molecules with the same formula but different arrangements are <dfn data-def="Molecules with the same molecular formula but their atoms joined in a different arrangement.">isomers</dfn>. Try the other pairs.</p>`,
			notes: `<p>The number of possible isomers grows explosively with size: C₄H₁₀ has two, C₁₀H₂₂ has 75, and C₂₀H₄₂ has 366,319. With branches, rings, multiple bonds and groups, carbon's possibilities are effectively endless.</p>`
		},
		// ------------------------------------------------------------------ mirror
		{
			id: 'mirror',
			chapter: 'mirror',
			title: 'A molecule and its mirror image',
			scene: 'mirror',
			hints: { centre: 'CHFClBr' },
			duration: 30,
			controls: [{ type: 'action', id: 'lineup', label: 'Try it', action: 'Line up H and F' }],
			body: `
<p>Here is a carbon with <strong>four different</strong> atoms on it: H, F, Cl and Br (bromochlorofluoromethane, drawn from its measured geometry). On the right is its mirror image. <strong>Drag the right-hand one to turn it</strong>, and try to make it sit exactly on the left one.</p>
<p>You can't. Line up any two atoms (the button lines up H and F) and the other two land in each other's places. The two molecules are like a left and a right hand: mirror images that no turning can superimpose. A molecule like this is <dfn data-def="Not superimposable on its mirror image, like a hand. From the Greek kheir, hand.">chiral</dfn>, and the carbon with four different groups is its <dfn data-def="An atom (usually carbon) with four different groups attached, which makes the molecule chiral.">stereocentre</dfn>.</p>`,
			notes: `<p>The page checks this with a calculation, not just a picture: it finds the turn (a rotation, never a reflection) that brings the copy as close as possible to the original (Horn's method). For this molecule even the best fit leaves the atoms 1.4 Å (0.14 nm) from their places on average, nearly the length of a bond. The two mirror forms are named R and S by a priority rule (Cahn–Ingold–Prelog). Butan-2-ol, which you could build earlier, is chiral too: its carbon 2 holds H, OH, CH₃ and CH₂CH₃.</p>`
		},
		{
			id: 'handed',
			chapter: 'mirror',
			title: 'Handedness in drugs and in life',
			scene: 'mirror',
			duration: 30,
			controls: [
				{
					type: 'select',
					id: 'centre',
					label: 'Molecule',
					default: 'alanine',
					options: [
						{ value: 'alanine', label: 'alanine' },
						{ value: 'CH2FCl', label: 'CH₂FCl' },
						{ value: 'CHFClBr', label: 'CHFClBr' }
					]
				},
				{ type: 'action', id: 'lineup', label: 'Try it', action: 'Line up two groups' }
			],
			body: `
<p>Most of the molecules of life are chiral. <strong>Alanine</strong>, an amino acid, has H, CH₃, NH₂ and COOH on its central carbon. The proteins of every living thing are built from just one of its two mirror forms, called L (the left one here).</p>
<p>Because the body's own molecules are handed, the two mirror forms of a drug can act differently, the way a left hand fits a left glove: in ibuprofen, it is one form that relieves pain. Switch to <strong>CH₂FCl</strong>: with two identical hydrogens the carbon has only three different groups, and the copy turns straight onto the original. No four different groups, no handedness.</p>`,
			notes: `<p>Alanine is drawn with each group as a single ball, at ideal tetrahedral angles and typical bond lengths (C–C 153 pm, C–N 147 pm, C–H 109 pm). The body converts some of ibuprofen's inactive form into the active one. Thalidomide, the drug whose mirror forms are often blamed for its birth defects, converts between its two forms in the body, so even a single form would not have been safe.</p>`
		},
		// ------------------------------------------------------------------ polymers
		{
			id: 'series',
			chapter: 'polymers',
			title: 'From gas to wax to plastic',
			scene: 'series',
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'chainLog',
					label: 'Carbons in the chain',
					min: 0,
					max: 5,
					step: 0.02,
					default: 0.9,
					format: (v) => `${Math.round(10 ** v).toLocaleString('en-GB')}`
				}
			],
			body: `
<p>Keep lengthening an alkane chain and watch it change at room temperature (25 °C). Up to four carbons it is a <strong>gas</strong> (natural gas, bottled gas). From five to seventeen, a <strong>liquid</strong>: petrol, kerosene, diesel. From eighteen on, a soft <strong>solid</strong>, paraffin wax.</p>
<p>The melting point keeps climbing as the chains grow, but more and more slowly, towards a limit near <strong>141 °C</strong>. A chain of many thousands of carbons is no longer a "molecule" you'd ever weigh out on its own: it is <strong>polyethylene</strong>, the plastic of bags and bottles, made of exactly the same CH₂ links as wax.</p>`,
			notes: `<p>Points are the NIST melting and boiling points of the n-alkanes up to C₄₄ (NIST gives few reliable boiling points beyond C₁₆ (here only C₁₉); very long chains break down before they boil). Where NIST lists no value for a chain, the state strip infers it from the trend: both points rise with chain length. Above C₄₄ the curve is Broadhurst's fit for long paraffins, T = 414.3 K × (n − 1.5)/(n + 5.0) (J. Res. NBS, 1962), whose limit 414.3 K = 141 °C is the melting point of an endless chain. Real polyethylene melts lower, around 130–139 °C, because its chains fold and branch and never crystallise completely.</p>`
		},
		{
			id: 'link',
			chapter: 'polymers',
			title: 'Linking monomers into a polymer',
			scene: 'polymer',
			hints: { phase: 'link' },
			duration: 26,
			controls: [
				{
					type: 'action',
					id: 'addMono',
					label: 'Add a monomer',
					action: 'Add a monomer',
					help: 'Link one more ethylene onto the reactive end.'
				}
			],
			body: `
<p>Nobody makes polyethylene by adding carbons one at a time. It is made from ethylene, whose C=C double bond can <strong>open up</strong>: its second shared pair comes apart: one electron bonds to the chain's reactive end, and the other becomes the new reactive end. Each ethylene joins the growing end of the chain and leaves a new reactive end behind (<strong>add a monomer</strong> yourself with the button), so the chain grows two carbons at a time, thousands of times over.</p>
<p>The small molecule is a <dfn data-def="A small molecule that can link up with others of its kind into a long chain.">monomer</dfn>; the long chain is a <dfn data-def="A very long molecule made of many repeated units (from the Greek: many parts).">polymer</dfn>. Swap ethylene for propylene and you get polypropylene; for vinyl chloride (CH₂=CHCl), PVC; for styrene, polystyrene. A different kind of linking, in which each new bond also releases a small molecule such as water (<dfn data-def="Linking monomers so that each new bond also gives off a small molecule, such as water.">condensation</dfn>), gives nylon, polyester and, in living things, proteins and DNA.</p>`,
			notes: `<p>A catalyst (or a reactive "radical" with an unpaired electron) starts the chain and keeps an open, reactive end on it. Each ethylene adds 28 g/mol, so a polyethylene chain of 100,000 g/mol is about 3,600 ethylene units, more than 7,000 carbons long. Nylon, polyester, proteins and DNA are made by condensation: each new bond also releases a small molecule (water, or in DNA's case a diphosphate).</p>`
		},
		{
			id: 'stretch',
			chapter: 'polymers',
			title: 'Chains, cross-links and stiffness',
			scene: 'polymer',
			hints: { phase: 'stretch' },
			duration: 40,
			controls: [
				{
					type: 'range',
					id: 'units',
					label: 'Chain length (monomer units)',
					min: 1.5,
					max: 4.5,
					step: 0.02,
					default: 3.45,
					format: (v) => `${Math.round(10 ** v).toLocaleString('en-GB')}`
				},
				{
					type: 'range',
					id: 'xlinks',
					label: 'Cross-links per 100 units',
					min: 0,
					max: 2,
					step: 0.05,
					default: 0.5
				},
				{
					type: 'range',
					id: 'stretch',
					label: 'Stretch',
					min: 1,
					max: 3,
					step: 0.05,
					default: 1,
					format: (v) => `${v.toFixed(2)}×`
				}
			],
			body: `
<p>Natural rubber is made of long chains of isoprene (C₅H₈) units. On its own it is a soft gum: its tangled chains spring back a little at first, but under a steady pull they slowly slide past one another and it creeps and stays deformed. Heat it with sulfur, as Charles Goodyear found in 1839, and sulfur bridges <strong>cross-link</strong> neighbouring chains into one network.</p>
<p><strong>Stretch the sample</strong> (drag its right edge, or use the slider). With no cross-links the chains just slide: no network, no stiffness (in this model, which leaves out tangles between chains). Add cross-links and the network springs back. More cross-links make shorter springs between them, so it gets <strong>stiffer</strong>. Chain length matters too: every chain has two loose ends that carry no load, and with short chains too few strands are tied in at both ends, so the network is weak, or never forms at all.</p>`,
			notes: `<p>The stiffness is the statistical theory of rubber elasticity for an ideal network: shear modulus G = ρRT/M<sub>c</sub> × (1 − 2M<sub>c</sub>/M<sub>n</sub>), where M<sub>c</sub> is the molar mass between cross-links and M<sub>n</sub> that of a chain; the bracket (Flory's) removes the loose ends. Young's modulus is 3G, and the stress–stretch curve is G(λ − 1/λ²). Natural rubber's density (0.903 g/cm³) and typical chain mass (193,000 g/mol, about 2,800 units) are L. A. Wood's (J. Res. NBS, 1976). Each stretched strand pulls back not because its bonds are strained but because a straightened chain has far fewer shapes than a crumpled one: rubber's spring is entropy. The ideal theory ignores entanglements and holds up to about a threefold stretch; heavily cross-linked rubber (ebonite) turns hard and glassy.</p>`
		},
		{
			id: 'everything',
			chapter: 'polymers',
			title: 'A few elements, endless molecules',
			scene: 'lineup',
			hints: { mode: 'gallery' },
			duration: 26,
			body: `
<p>Here are five molecules made from the same few elements: carbon, hydrogen, oxygen and nitrogen. <strong>Octane</strong> is a fuel. <strong>Polyethylene</strong> is a plastic. <strong>Ibuprofen</strong> is a drug, with one stereocentre. <strong>Glucose</strong>, the sugar your cells burn (five stereocentres in its ring), and <strong>alanine</strong>, a building block of proteins, are molecules of life.</p>
<p>What separates them is only how the atoms are joined. That is the whole story: <strong>carbon's four bonds allow endless chains and rings, so the same few elements, arranged differently, give fuels, plastics, drugs and the molecules of life</strong>.</p>`,
			notes: `<p>Formulas are counted from the drawings (and checked against PubChem). Glucose is drawn as its ring form, flat, without showing on which side each –OH sits; those sides are what make it glucose rather than one of its isomers, such as galactose.</p>`
		}
	]
};
