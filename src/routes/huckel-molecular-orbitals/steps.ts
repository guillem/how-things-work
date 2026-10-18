import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

const chainN: Control = {
	type: 'range',
	id: 'chainN',
	label: 'Carbons in the chain',
	min: 2,
	max: 16,
	step: 2,
	default: 6,
	format: (v) => `${v} (${v / 2} C=C)`
};

const dyeC: Control = {
	type: 'range',
	id: 'dyeC',
	label: 'Carbons between the nitrogens',
	min: 1,
	max: 13,
	step: 2,
	default: 5,
	format: (v) => `${v}`
};

const ringN: Control = {
	type: 'range',
	id: 'ringN',
	label: 'Atoms in the ring',
	min: 3,
	max: 10,
	step: 1,
	default: 5,
	format: (v) => `${v}`
};

const ringCharge: Control = {
	type: 'range',
	id: 'ringCharge',
	label: 'Charge (electrons removed or added)',
	min: -2,
	max: 2,
	step: 1,
	default: -1,
	format: signed
};

const atoms: Control = {
	type: 'range',
	id: 'atoms',
	label: 'Carbon atoms',
	min: 2,
	max: 12,
	step: 1,
	default: 6,
	format: (v) => `${v}`
};

const closed: Control = {
	type: 'toggle',
	id: 'closed',
	label: 'Close the chain into a ring',
	default: true
};

const charge: Control = { ...ringCharge, id: 'charge', default: 0 };

export const spec: ExplainerSpec = {
	slug: 'huckel-molecular-orbitals',
	title: 'Molecular orbitals & conjugation',
	summary:
		'Build π systems from carbon atoms and let the Hückel matrix give their molecular orbitals: a ladder of levels that narrows as chains grow, so longer cyanine dyes absorb redder light, and rings that are stabilised only when their π electrons fill a closed shell (2, 6, 10) and left with two lone electrons in a degenerate pair when they hold 4 or 8.',
	chapters: [
		{ id: 'model', title: 'One p orbital per atom' },
		{ id: 'colour', title: 'Longer chains, redder dyes' },
		{ id: 'rings', title: "Rings and Hückel's rule" }
	],
	steps: [
		// ------------------------------------------------------------------ model
		{
			id: 'ethene',
			chapter: 'model',
			title: 'Two p orbitals make a π bond',
			scene: 'orbitals',
			hints: { mol: 'ethene', matrix: true },
			body: `
<p>In ethene, C₂H₄, each carbon uses three of its four valence electrons in <a href="../chemical-bonds/">σ bonds</a> that lie in the molecule's plane. The fourth sits in a 2p orbital standing perpendicular to the plane, and the two p orbitals side by side make the <dfn data-def="A bond made by p orbitals overlapping side by side, above and below the plane of the atoms; its electrons are the ones that conjugation spreads out.">π bond</dfn>.</p>
<p>Erich Hückel (1931) kept only these p orbitals. A π electron on one atom has energy α (the <dfn data-def="The energy of an electron in a carbon 2p orbital, before it feels the neighbours. It sets the zero of the ladder.">Coulomb integral</dfn>); on two bonded atoms it can hop between them, which is worth β (the <dfn data-def="The energy of the coupling between p orbitals on two bonded atoms. It is negative: sharing lowers the energy. Atoms that are not bonded get zero.">resonance integral</dfn>, negative). That is the 2 × 2 matrix on the left. Its two <a href="../linear-transformations/#eigenvectors">eigenvectors</a> are the molecular orbitals, and its eigenvalues their energies, α + β and α − β.</p>
<p>The lower orbital has the same sign on both atoms (the electron builds up between them): it is <strong>bonding</strong>. The upper one changes sign across a <dfn data-def="A plane where the orbital's sign flips and its value is zero; more nodes means higher energy.">node</dfn>: <strong>antibonding</strong>. The two π electrons pair up in the bonding one, for 2α + 2β: 2|β| below two separate p electrons. Click a level on the ladder to see its orbital.</p>`,
			notes: `<p>The lobes are the orbital seen from above: each circle's radius follows the size of the atom's coefficient (so its area follows the coefficient squared, the electron's share of time on that atom), and its colour the sign of the p orbital's upper lobe. The real model also has an overlap integral between the p orbitals, which simple Hückel sets to zero, and the electrons don't repel one another: each one moves in the same fixed matrix. Those are the approximations that make the page a matter of diagonalising a matrix.</p>`
		},
		{
			id: 'butadiene',
			chapter: 'model',
			title: 'Butadiene: four orbitals spread over four atoms',
			scene: 'orbitals',
			hints: { mol: 'butadiene', matrix: true, orders: true },
			body: `
<p>Join two ethenes into butadiene, CH₂=CH–CH=CH₂, and the four p orbitals line up. The matrix grows to 4 × 4: α on the diagonal, β between bonded neighbours, zero for atoms that aren't bonded. It is α times the identity plus β times the skeleton's <dfn data-def="A table with a 1 where two atoms are bonded and 0 elsewhere; it is the whole input of the Hückel model.">adjacency matrix</dfn>, so the shape of the molecule alone decides its orbitals.</p>
<p>The four eigenvectors are spread over all four atoms: the electrons are <dfn data-def="Belonging to the whole π system rather than to one bond between two atoms.">delocalised</dfn>. Going up the ladder, each orbital has one node more (0, 1, 2, 3), at α + 1.618β, α + 0.618β, α − 0.618β and α − 1.618β. Four electrons fill the lower two, for 4α + 4.472β, which is 0.472|β| lower than two separate ethenes: the <strong>delocalisation energy</strong>.</p>
<p>The numbers on the bonds are π <dfn data-def="Coulson's π bond order: the sum, over the electrons, of the products of the two atoms' coefficients. 1 for ethene's double bond, 0 for no π bonding.">bond orders</dfn>: 0.894 at the ends and 0.447 in the middle. Butadiene still has its double bonds at the ends, partly shared with the middle one.</p>`,
			notes: `<p>The delocalisation energy here compares the π energy with the same electrons in as many isolated ethene double bonds (2α + 2β each) as the electrons and atoms allow, and any other electrons alone or in pairs on the remaining atoms, at α. Other references exist (Dewar's compares with long chains), and they give different numbers; this one is the textbook convention for simple Hückel.</p>`
		},
		{
			id: 'chains',
			chapter: 'model',
			title: 'Longer chains: a band, and a shrinking gap',
			scene: 'orbitals',
			hints: { source: 'chain', orders: true },
			controls: [chainN],
			body: `
<p>Lengthen the chain. A chain of <i>N</i> atoms has <i>N</i> orbitals, and they all fit between α + 2β and α − 2β: the more atoms, the more crowded the ladder. Half are bonding and filled; half are antibonding and empty.</p>
<p>The gap between the highest occupied orbital (<dfn data-def="Highest occupied molecular orbital.">HOMO</dfn>) and the lowest empty one (<dfn data-def="Lowest unoccupied molecular orbital.">LUMO</dfn>) shrinks as the chain grows: 2|β| for ethene, 1.24|β| for butadiene, 0.42|β| at 14 carbons. Light whose photons carry that energy lifts an electron from HOMO to LUMO, so longer conjugated chains absorb at longer wavelengths.</p>
<p>The model also says where it fails. With every β equal, the gap of a polyene (alternating single and double bonds) closes towards zero, and a long one would absorb in the infrared. Real polyenes don't: their bonds really alternate, and the gap levels off. β-carotene, with eleven conjugated double bonds, absorbs blue light and looks orange. The next chapter uses molecules whose bonds really are all alike.</p>`,
			notes: `<p>The chain's levels are α + 2β cos(<i>k</i>π/(<i>N</i> + 1)) for <i>k</i> = 1 … <i>N</i>, the same standing waves as a <a href="../quantum-mechanics/#box">particle in a box</a>, sampled at the atoms. An infinite chain with equal bonds would be a metal; alternating bonds (two β's) open a gap that stays finite however long the chain is, an instance of the Peierls instability, and the reason polyacetylene is a semiconductor until it is doped.</p>`
		},
		// ------------------------------------------------------------------ colour
		{
			id: 'cyanine',
			chapter: 'colour',
			title: 'A cyanine dye: a chain with every bond alike',
			scene: 'dye',
			hints: { focus: 'gap' },
			controls: [dyeC],
			body: `
<p>A <dfn data-def="A dye made of two nitrogen atoms joined by an odd number of CH groups, carrying a positive charge shared by both ends.">cyanine</dfn> is a chain of CH groups between two nitrogens, (CH₃)₂N–(CH)<sub>k</sub>=N⁺(CH₃)₂. Its two ends are equivalent, so its positive charge is shared along the whole conjugated chain rather than parked on one nitrogen, and its bonds have very little alternation. The page approximates every bond by the one β of the Hückel model, and treats the two nitrogens like carbon sites.</p>
<p>The page counts the two nitrogens as two more sites of the chain, <i>k</i> + 2 in all, holding <i>k</i> + 3 π electrons (each carbon gives one, the amine nitrogen two, the iminium nitrogen one). That odd chain puts its HOMO exactly at α, and the LUMO one step up.</p>
<p>The HOMO-LUMO gap, times |β|, is the energy of the photon the dye absorbs. |β| is the one number the model can't give; the page sets it from the 3-carbon dye, which absorbs at 309 nm: |β| = 4.01 eV. Add carbons two at a time and watch the gap narrow and the absorbed wavelength climb from the ultraviolet into the visible.</p>`,
			notes: `<p>The HOMO and LUMO are drawn on the chain: the LUMO has one more node. The nitrogens really pull electrons harder than carbons (a different α), which shifts both levels; giving both ends the same carbon α is the simplest version of the model and, by the symmetry of the two ends, it keeps the HOMO at the middle of the ladder. The measured values are for the streptocyanines with methyl groups on the nitrogens, measured by W. T. Simpson (1948).</p>`
		},
		{
			id: 'series',
			chapter: 'colour',
			title: 'One β predicts the series',
			scene: 'dye',
			hints: { focus: 'chart' },
			controls: [dyeC],
			body: `
<p>With |β| fixed by one dye, the model predicts the others. The 5-carbon dye: 404 nm against 409 nm measured. The 7-carbon dye: 500 nm against 512 nm. The chart sets the model's line beside the three measured maxima.</p>
<p>Each pair of carbons added moves the absorption about 100 nm to the red, in the model and in the dyes. Past 7 carbons the line is a prediction only (the page has no measured value for those), and it walks out of the visible range into the near infrared at about 13 carbons. Cyanines of this kind are used as dyes that absorb at a chosen colour, from photographic sensitisers to the infrared labels of fluorescence imaging.</p>
<p>The swatch is the colour of the light the dye absorbs; the dye itself looks the complementary colour. Simple Hückel gets the trend, not exact colours: it ignores the electrons' repulsion and the solvent, and its β is fitted. That it gets the trend this well is because cyanines have no bond alternation.</p>`,
			notes: `<p>For long chains the gap 2|β| sin(π/(<i>k</i> + 3)) falls as 1/(<i>k</i> + 3), so the wavelength grows in a straight line with the length: the same result as Kuhn's free-electron model (1948), which puts the π electrons in a box as long as the chain. The measured 309, 409 and 512 nm are from W. T. Simpson, <i>J. Chem. Phys.</i> 16, 1124 (1948), as quoted by Chemistry LibreTexts.</p>`
		},
		// ------------------------------------------------------------------ rings
		{
			id: 'benzene',
			chapter: 'rings',
			title: 'Benzene: a closed shell, and no alternating bonds',
			scene: 'orbitals',
			hints: { mol: 'benzene', orders: true, kekule: true },
			body: `
<p>Close hexatriene into a ring and you get benzene. The matrix gains a β between atoms 6 and 1, and the levels become α + 2β, α + β (twice), α − β (twice) and α − 2β. A ring gives <strong>degenerate pairs</strong>: two orbitals at the same energy, one with a node through an atom and one between atoms. The picture beside the ladder (Frost's circle) gives them for any ring: a polygon standing on a vertex, inside a circle of radius 2|β|, puts a level at every corner.</p>
<p>Six electrons exactly fill the lowest level and the pair: a <dfn data-def="Every level either full or empty, with all electrons paired.">closed shell</dfn>. The π energy is 6α + 8β, 2|β| lower than three separate double bonds, and about 1.01|β| lower than the open hexatriene chain.</p>
<p>The bond orders are all 0.667. Benzene does not have three single and three double bonds, and it does not flip between the two <dfn data-def="Drawings of benzene with alternating single and double bonds, after August Kekulé (1865).">Kekulé drawings</dfn> shown below: they are two ways of writing a structure that neither drawing captures. Its six C–C bonds are measured equal, 139 pm, between a single and a double bond.</p>`,
			notes: `<p>The orbitals of a ring are standing waves running around it: the coefficients are cos(2π<i>jk</i>/<i>N</i>) and sin(2π<i>jk</i>/<i>N</i>) at atom <i>j</i>, with energy α + 2β cos(2π<i>k</i>/<i>N</i>). The cos and sin waves of the same <i>k</i> have the same energy; any mixture of them is an equally good orbital, and the page draws the pair turned so that one has its node through atom 1.</p>`
		},
		{
			id: 'cyclobutadiene',
			chapter: 'rings',
			title: 'Cyclobutadiene: two electrons alone',
			scene: 'orbitals',
			hints: { mol: 'cyclobutadiene', orders: true, closure: true },
			body: `
<p>Close butadiene into a square instead. Frost's square stands on a corner: one level at α + 2β, a degenerate pair at α itself (nonbonding), one at α − 2β. Two electrons fill the bottom; the other two go into the pair, and the page puts one in each orbital.</p>
<p>So square cyclobutadiene is a <dfn data-def="A molecule with two electrons in two different orbitals of nearly the same energy, rather than paired in one.">diradical</dfn>: two electrons alone in a half-filled degenerate pair. It gains nothing from delocalisation (4α + 4β, the same as two ethenes), and closing the ring costs 0.472|β| compared with open butadiene, whose second pair of electrons sat in a bonding orbital.</p>
<p>The real molecule escapes by distorting into a rectangle with two short and two long bonds, which splits the pair. The free molecule is still extremely reactive: it has been studied trapped in frozen noble gases at a few kelvin and fleetingly in the gas phase, and it can be tamed by binding it to a metal.</p>`,
			notes: `<p>Simple Hückel has no interaction between the electrons, so it can't say how the two spins in the pair are coupled; the arrows drawn up are only a way of showing one electron in each orbital. Hund's rule would make the spins parallel, but correlated calculations give square cyclobutadiene an open-shell singlet ground state, with the spins opposed. "Destabilised" here is measured against the open chain: the half-filled pair adds two electrons at α, with no bonding energy at all. Against isolated double bonds simple Hückel gives zero. More refined calculations, with the electrons' repulsion, make the square more unstable still, and the rectangle the ground state: cyclobutadiene is called <dfn data-def="A ring made less stable by the cyclic delocalisation of 4n π electrons, rather than more.">antiaromatic</dfn>.</p>`
		},
		{
			id: 'rule',
			chapter: 'rings',
			title: "Hückel's rule: count the electrons, not the atoms",
			scene: 'orbitals',
			hints: { source: 'ring', chips: 'rings', orders: true },
			controls: [ringN, ringCharge],
			body: `
<p>Every ring has one level at the bottom and then degenerate pairs (plus a single top level when the ring is even). Two electrons fill the bottom, and each pair takes four more. So a ring's π shell is closed at <strong>2, 6, 10, 14 … electrons: 4<i>n</i> + 2</strong>, and those rings are <dfn data-def="Unusually stable because of a closed shell of 4n + 2 π electrons delocalised around a planar ring.">aromatic</dfn>. At 4<i>n</i> electrons the last pair is half full.</p>
<p>It's the electron count, not the ring size, that decides. Take five carbons: the cyclopentadienyl anion, C₅H₅⁻, has 6 π electrons and a closed shell (a delocalisation of 2.47|β|); remove two electrons and the cation, C₅H₅⁺, has 4 and is left with two alone. Cyclopentadiene gives up a proton about as easily as an alcohol, extraordinary for a hydrocarbon, because the anion is aromatic. Seven carbons: the tropylium cation C₇H₇⁺ has 6 and is stable enough to make salts.</p>
<p>Eight carbons with 8 electrons, cyclooctatetraene, would half-fill a pair if it were flat. It isn't: the real molecule is tub-shaped, with alternating bonds, and its p orbitals don't conjugate around the ring. Add two electrons and the dianion C₈H₈²⁻, with 10, is flat and aromatic. Try the counts with the sliders or the chips.</p>`,
			notes: `<p>The rule needs a planar ring of atoms that each bring a p orbital into the π system, and it is a statement about simple Hückel orbitals; very large rings (beyond about 22 atoms) follow it less and less, as their levels crowd together. Hückel's calculations of the 1930s contain the result; the compact 4<i>n</i> + 2 form was written down by later chemists.</p>`
		},
		{
			id: 'build',
			chapter: 'rings',
			title: 'Build your own π system',
			scene: 'orbitals',
			hints: { source: 'build', chips: 'all', orders: true },
			controls: [atoms, closed, charge],
			body: `
<p>Build any chain or ring of up to twelve carbons and give it any charge from −2 to +2: click the <strong>+</strong> at the end of a chain to snap on a carbon, an end atom to take it off, the dashed link to close the chain into a ring and a ring's bond to open it (or use the sliders and chips). The page writes the Hückel matrix, diagonalises it, fills the ladder and draws the orbital you click.</p>
<p>Things to try: an odd chain (the allyl group, three carbons) has an orbital at α with a node through every other atom, the same as the cyanines' HOMO. Compare a chain and a ring of the same atoms: rings with 4<i>n</i> + 2 electrons gain energy by closing; rings with 4<i>n</i> lose it, at least the small ones. Watch the bond orders: rings with a closed shell have all their bonds equal.</p>
<p>The one lesson: π electrons spread over the whole conjugated system and fill a ladder of orbitals set by its shape. The ladder narrows its gap as the system grows, so longer dyes absorb redder light; and a ring is stabilised when its electrons exactly fill a closed shell, and left with two lone electrons when they half-fill a degenerate pair.</p>`,
			notes: `<p>Simple Hückel with one α and one β is a model of hydrocarbons with every bond the same. Heteroatoms (N, O) get their own α and β by fitted rules. Extended Hückel includes all the valence orbitals and keeps their overlap, but still leaves out the electrons' interactions with one another; self-consistent methods treat those. The degenerate pairs come from the ring's symmetry, so a ladder here need not survive a change of atoms or shape; the counting of nodes, the 4<i>n</i> + 2 rule for symmetric rings and the narrowing gap are the robust lessons.</p>`
		}
	]
};
