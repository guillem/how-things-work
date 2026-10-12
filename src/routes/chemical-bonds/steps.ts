import type { ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * The molecule builder (scene `molecule`) keeps the reader's molecule per step in the
 * param `mol:<step id>` ("C:H,H" = carbon with two hydrogens); `hints.start` is the
 * molecule a step starts from.
 */
export const spec: ExplainerSpec = {
	slug: 'chemical-bonds',
	title: 'Chemical bonds and the shapes of molecules',
	summary:
		'Snap atoms together into molecules, watch electron pairs push each other into 3D shapes, and switch on a charge map to see which molecules are polar.',
	chapters: [
		{ id: 'why', title: 'Why atoms bond' },
		{ id: 'build', title: 'Building molecules' },
		{ id: 'shape', title: 'Shape' },
		{ id: 'properties', title: 'Shape decides properties' }
	],
	steps: [
		// ------------------------------------------------------------------ why
		{
			id: 'outer',
			chapter: 'why',
			title: 'Atoms want a full outer shell',
			scene: 'dots',
			duration: 22,
			body: `
<p>Chemistry happens at the edge of an atom, among its outer electrons, the <dfn data-def="The electrons in an atom's outermost shell. They are the ones that take part in bonds.">valence electrons</dfn>. Here they are drawn as dots around each element's symbol, a <dfn data-def="A drawing of an atom or molecule that shows only the outer electrons, as dots (and shared pairs as lines). Invented by Gilbert N. Lewis in 1916.">Lewis diagram</dfn>.</p>
<p>The noble gases, like neon, have a full outer shell of <strong>eight</strong> (helium: two) and hardly react. Other atoms get there by <strong>sharing</strong> or <strong>handing over</strong> electrons. The number of bonds an atom forms is the number of electrons it is short of a full shell: hydrogen <strong>1</strong>, carbon <strong>4</strong>, nitrogen <strong>3</strong>, oxygen <strong>2</strong>, fluorine and chlorine <strong>1</strong>.</p>
<p>Look at the dots: single dots are <strong>unpaired electrons</strong>, ready to pair up in a bond; pairs that never bond are called <dfn data-def="A pair of outer electrons that belongs to one atom and is not shared in a bond.">lone pairs</dfn>.</p>`,
			notes: `<p>"Eight" is the <dfn data-def="The tendency of atoms to gain, lose or share electrons until they have eight in their outer shell.">octet rule</dfn>: an s subshell (2) plus a p subshell (6). It works very well for carbon, nitrogen, oxygen and fluorine. Atoms from the third row down, like phosphorus and sulfur, can hold more than eight around them (sulfur has twelve in SF₆), and a few, like boron, are stable with fewer. Carbon is drawn with four single dots because it makes four bonds. In the lone atom two of them are paired (2s²); when carbon bonds, its four outer electrons rearrange so that all four can pair up with partners (in later courses: hybridisation). The valence electrons and electronegativities on this page come from the same element data as <a href="../atoms-periodic-table/">Atoms and the periodic table</a>.</p>`
		},
		{
			id: 'share',
			chapter: 'why',
			title: 'Sharing a pair: the covalent bond',
			scene: 'pair',
			hints: { phase: 'share' },
			duration: 18,
			body: `
<p>Two hydrogen atoms each have one electron. When they come close, their electron clouds overlap and both electrons settle <strong>between the two nuclei</strong>, attracted by both at once. That shared pair is a <dfn data-def="A bond made by two atoms sharing a pair of electrons (or two or three pairs, in double and triple bonds).">covalent bond</dfn>, drawn as a line: H–H.</p>
<p>Each hydrogen now counts both shared electrons as its own, so each has a full shell of two, like helium. The bonded pair has less energy than two separate atoms, which is why the molecule holds together: pulling it apart takes energy.</p>`,
			notes: `<p>The bond is a balance. Closer than the bond length, the two positive nuclei repel each other strongly; further apart, the shared electrons hold them less. In H₂ the balance puts the two nuclei much closer together than the size of two separate hydrogen atoms: their clouds overlap.</p>`
		},
		{
			id: 'tug',
			chapter: 'why',
			title: 'A tug of war over electrons',
			scene: 'pair',
			hints: { phase: 'tug' },
			duration: 26,
			controls: [
				{
					type: 'select',
					id: 'pair',
					label: 'Pair of atoms',
					default: 'HCl',
					options: [
						{ value: 'HH', label: 'H–H' },
						{ value: 'ClCl', label: 'Cl–Cl' },
						{ value: 'CH', label: 'C–H' },
						{ value: 'HCl', label: 'H–Cl' },
						{ value: 'HF', label: 'H–F' },
						{ value: 'NaCl', label: 'Na–Cl' }
					]
				}
			],
			body: `
<p>Sharing is only equal between identical atoms. Each element pulls on shared electrons with its own strength, its <dfn data-def="How strongly an atom in a bond pulls shared electrons towards itself, on the Pauling scale (fluorine is the highest at 3.98).">electronegativity</dfn>. In hydrogen chloride, chlorine (3.16) pulls harder than hydrogen (2.20): the shared pair sits closer to chlorine, which gets a slight negative charge (δ−) while hydrogen is left slightly positive (δ+). That is a <dfn data-def="A covalent bond in which the electrons are shared unequally, so that one end is slightly negative and the other slightly positive.">polar bond</dfn>.</p>
<p>The bigger the difference in electronegativity, the more lopsided the sharing. Try the pairs: below a difference of about <strong>0.4</strong> the sharing is practically equal; up to about <strong>1.8</strong> the bond is polar; beyond that, one atom simply takes the electron.</p>`,
			notes: `<p>These cut-offs are a rough guide (OpenStax <i>Chemistry 2e</i>, §7.2), with many exceptions: bonds change gradually from equal sharing to complete transfer. Hydrogen fluoride, with a difference of 1.78, is right at the border, and is a polar covalent molecule. The δ symbols are partial charges, fractions of an electron's charge.</p>`
		},
		{
			id: 'ionic',
			chapter: 'why',
			title: 'Handing an electron over: the ionic bond',
			scene: 'pair',
			hints: { phase: 'ionic' },
			duration: 22,
			body: `
<p>Sodium has a single outer electron and holds it loosely (electronegativity 0.93); chlorine is one electron short of eight (3.16). Instead of sharing, the electron moves across: sodium becomes a positive <dfn data-def="An atom that has lost or gained electrons, so it carries an electric charge.">ion</dfn>, Na⁺, with a full shell underneath, and chlorine becomes Cl⁻, with a full shell of eight.</p>
<p>Opposite charges attract. Moving the electron on its own actually costs energy; it is the strong attraction between the ions, packed into a crystal, that more than repays it. That attraction is the <dfn data-def="The electrical attraction between positive and negative ions.">ionic bond</dfn>. It pulls in every direction, so the ions don't form separate molecules but stack into a crystal, each Na⁺ surrounded by Cl⁻ and each Cl⁻ by Na⁺: table salt.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'build',
			chapter: 'build',
			title: 'Snap atoms together',
			scene: 'molecule',
			hints: { mode: 'build', start: 'C:H,H' },
			duration: 30,
			body: `
<p>Now build molecules yourself. A carbon atom sits in the middle with two hydrogens already attached; its two remaining dots are unpaired electrons. <strong>Drag an atom from the left onto the carbon</strong> (or click it) and it snaps onto an unpaired electron, making a bond.</p>
<p>Add two more hydrogens and every atom has a full shell: carbon has eight electrons around it (four shared pairs), each hydrogen two. That is <strong>methane</strong>, CH₄, the main ingredient of natural gas. The builder refuses atoms that don't fit, so you can only make molecules in which every atom's shell ends up full.</p>
<p>Change the centre atom with the row of symbols at the top, click an outer atom to take it off, and drag the empty space to turn the molecule round.</p>`,
			notes: `<p>The builder makes molecules with one central atom, which covers most small molecules. Larger ones, like ethanol or DNA, are chains and rings of the same kind of bonds; each carbon in them still makes four bonds and each oxygen two.</p>`
		},
		{
			id: 'multiple',
			chapter: 'build',
			title: 'Double and triple bonds',
			scene: 'molecule',
			hints: { mode: 'build', start: 'C:O,O' },
			duration: 26,
			body: `
<p>Oxygen needs two more electrons, not one. When it bonds to carbon it shares <strong>two pairs</strong>: a <dfn data-def="Two pairs of electrons shared between the same two atoms, drawn as two lines.">double bond</dfn>, O=C=O. Here is carbon dioxide: carbon shares two pairs with each oxygen, so it again has eight electrons around it, and each oxygen has eight too (two shared pairs and two lone pairs of its own; the builder draws lone pairs only on the centre atom).</p>
<p>Nitrogen, three electrons short, can share three pairs: a <dfn data-def="Three pairs of electrons shared between the same two atoms, drawn as three lines.">triple bond</dfn>. Try a nitrogen centre with another nitrogen (N≡N, the nitrogen that makes up most of the air), or a carbon with one hydrogen and one nitrogen: H–C≡N, hydrogen cyanide.</p>`,
			notes: `<p>Multiple bonds are shorter and stronger than single bonds between the same atoms. The N≡N triple bond is one of the strongest there is, which is why the nitrogen in the air is so unreactive and why making fertiliser from it takes so much energy.</p>`
		},
		// ------------------------------------------------------------------ shape
		{
			id: 'repel',
			chapter: 'shape',
			title: 'Electron pairs push each other apart',
			scene: 'repel',
			duration: 22,
			controls: [
				{
					type: 'range',
					id: 'pairs',
					label: 'Electron domains around the atom',
					min: 2,
					max: 6,
					step: 1,
					default: 4
				}
			],
			body: `
<p>Why does a molecule have a shape at all? Each bond, and each lone pair, is a region of negative charge around the central atom, an <dfn data-def="A region around the central atom where electrons are concentrated: a bond (single, double or triple) or a lone pair. Each counts as one domain.">electron domain</dfn>. Like charges repel, so the domains push each other as far apart as they can.</p>
<p>Watch them spread out from a bunch and settle. <strong>Two</strong> end up on opposite sides (180°, a line). <strong>Three</strong> make a flat triangle (120°). <strong>Four</strong> don't stay flat: they point to the corners of a <dfn data-def="A pyramid with four identical triangular faces. Lines from its centre to its corners are 109.5° apart.">tetrahedron</dfn>, 109.5° apart, further apart than the 90° of a flat cross. Drag to turn them round.</p>
<p>This idea, <dfn data-def="Valence Shell Electron Pair Repulsion: the shape of a molecule is the one that keeps its electron domains as far apart as possible.">VSEPR</dfn> theory, predicts the shape of most small molecules.</p>`,
			notes: `<p>The animation is a real calculation: charges confined to a sphere, pushing each other with the inverse-square law until they settle. It finds the same arrangements VSEPR uses, including the ones for five (a triangle with one pair above and one below, as in PCl₅) and six (an octahedron, as in SF₆), which only atoms from the third row down can hold.</p>`
		},
		{
			id: 'lonepairs',
			chapter: 'shape',
			title: 'Lone pairs count too',
			scene: 'molecule',
			hints: { mode: 'compare' },
			duration: 26,
			controls: [
				{
					type: 'select',
					id: 'lpMol',
					label: 'Molecule',
					default: 'H2O',
					options: [
						{ value: 'CH4', label: 'CH₄ methane' },
						{ value: 'NH3', label: 'NH₃ ammonia' },
						{ value: 'H2O', label: 'H₂O water' }
					]
				}
			],
			body: `
<p>Methane, ammonia and water all have <strong>four</strong> electron domains around the central atom, so all three are built on a tetrahedron. The difference is how many of the four are lone pairs: none in CH₄, one in NH₃, two in H₂O.</p>
<p>The shape is named after where the <em>atoms</em> are: methane is <strong>tetrahedral</strong>, ammonia a <strong>trigonal pyramid</strong> (the lone pair sits on top), and water is <strong>bent</strong>. Lone pairs are held by one nucleus only, so they spread wider and push harder than bonding pairs: the angle between bonds closes from 109.5° in methane to <strong>106.7°</strong> in ammonia and <strong>104.5°</strong> in water.</p>`,
			notes: `<p>The angles are measured values for the free molecules, from NIST's Computational Chemistry Comparison and Benchmark Database (CCCBDB). VSEPR predicts the order (fewer degrees with more lone pairs) but not the exact numbers.</p>`
		},
		{
			id: 'shapes',
			chapter: 'shape',
			title: 'A family of shapes',
			scene: 'molecule',
			hints: { mode: 'shapes', start: 'N:H,H,H' },
			duration: 30,
			body: `
<p>Count the electron domains around the centre (a double or triple bond counts as one) and the lone pairs among them, and the shape follows. With two or three atoms around the centre and no lone pairs: <strong>linear</strong> (CO₂) or <strong>trigonal planar</strong> (formaldehyde, CH₂O). With four domains: <strong>tetrahedral</strong>, <strong>trigonal pyramidal</strong> or <strong>bent</strong>, depending on how many are lone pairs.</p>
<p>Build different molecules and watch the shape name and the angle follow. Where the angle has been measured, it is shown; otherwise the page shows the ideal angle VSEPR predicts. Not everything follows the rule: in Cl₂O the large chlorine atoms crowd each other and push the angle up to 110.9°, wider than a tetrahedron, despite oxygen's two lone pairs.</p>`
		},
		// ------------------------------------------------------------------ properties
		{
			id: 'polar',
			chapter: 'properties',
			title: 'Which molecules are polar?',
			scene: 'molecule',
			hints: { mode: 'polar', start: 'O:H,H' },
			duration: 30,
			controls: [
				{
					type: 'toggle',
					id: 'charges',
					label: 'Charge map',
					default: true,
					help: 'Red: electrons pulled towards this end (δ−). Blue: pulled away (δ+).'
				}
			],
			body: `
<p>The charge map colours each part of the molecule by its share of the electrons: <strong>red</strong> where the electrons are pulled to (δ−), <strong>blue</strong> where they are pulled away from (δ+). Water's oxygen pulls on both bonds, and because the molecule is <em>bent</em>, both pulls point the same way: one end is negative, the other positive. Water is a <dfn data-def="A molecule with a positive end and a negative end, because its polar bonds don't cancel out.">polar molecule</dfn>; the arrow points to its negative end.</p>
<p>Now build CO₂ (or tap it below). Its bonds are polar too, but the molecule is a straight line: the two pulls are equal and opposite and <strong>cancel</strong>. Carbon dioxide is not polar. The same goes for CCl₄, a perfect tetrahedron; swap one chlorine for a hydrogen and the balance is gone. Polarity depends on the bonds <em>and</em> the shape.</p>`,
			notes: `<p>The colours here are a guide worked out from electronegativity differences, not a computed charge distribution; real charge maps come from quantum-chemistry calculations of the electron density, and look similar for these small molecules. The measure of how polar a molecule is, its <dfn data-def="The product of the separated charge and the distance between the charges, measured in debye (D).">dipole moment</dfn>, is exactly zero for CO₂, CH₄ and CCl₄.</p>`
		},
		{
			id: 'properties',
			chapter: 'properties',
			title: 'Shape decides properties',
			scene: 'properties',
			duration: 26,
			body: `
<p>Polar molecules stick to each other, positive end to negative end, and the stickier the molecules, the more heat it takes to pull them apart into a gas. Four molecules of almost the same mass show how much this matters: non-polar methane boils at −162 °C, ammonia at −33 °C, hydrogen fluoride at 20 °C, and water at <strong>100 °C</strong>.</p>
<p>Water's bent shape, with two δ+ hydrogens on one side and two lone pairs on the other, lets each molecule cling to up to four neighbours (through <dfn data-def="An especially strong attraction between a hydrogen bonded to N, O or F on one molecule (strongly δ+) and a lone pair on an N, O or F atom of another.">hydrogen bonds</dfn>). A straight water molecule would not be polar at all, like CO₂, and its molecules would cling to each other far less.</p>
<p>That is the whole story: <strong>atoms bond by sharing or transferring outer electrons, and the repulsion between electron pairs gives each molecule the shape that decides its properties</strong>.</p>`,
			notes: `<p>Boiling points at normal atmospheric pressure from the NIST Chemistry WebBook (for ammonia, which the WebBook doesn't list, the standard value of 239.8 K). Polarity also decides what dissolves in what: polar water dissolves salt and sugar, but not oil, whose molecules are long non-polar chains of carbon and hydrogen ("like dissolves like").</p>`
		}
	]
};
