import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const addProton: Control = {
	type: 'action',
	id: 'addProton',
	label: '+ proton',
	action: '+ proton'
};
const removeProton: Control = {
	type: 'action',
	id: 'removeProton',
	label: '− proton',
	action: '− proton'
};
const addNeutron: Control = {
	type: 'action',
	id: 'addNeutron',
	label: '+ neutron',
	action: '+ neutron'
};
const removeNeutron: Control = {
	type: 'action',
	id: 'removeNeutron',
	label: '− neutron',
	action: '− neutron'
};
const addElectron: Control = {
	type: 'action',
	id: 'addElectron',
	label: '+ electron',
	action: '+ electron'
};
const removeElectron: Control = {
	type: 'action',
	id: 'removeElectron',
	label: '− electron',
	action: '− electron'
};

const fillTo: Control = {
	type: 'range',
	id: 'fillTo',
	label: 'Number of electrons',
	min: 1,
	max: 36,
	step: 1,
	default: 11
};

const orbital: Control = {
	type: 'select',
	id: 'orbital',
	label: 'Orbital',
	default: '1s',
	options: [
		{ value: '1s', label: '1s' },
		{ value: '2s', label: '2s' },
		{ value: '2p', label: '2p' },
		{ value: '3p', label: '3p' },
		{ value: '3d', label: '3d' }
	]
};

const colourBy: Control = {
	type: 'select',
	id: 'colourBy',
	label: 'Colour the table by',
	default: 'radius',
	options: [
		{ value: 'radius', label: 'Atomic radius' },
		{ value: 'ionization', label: 'Ionization energy' },
		{ value: 'electronegativity', label: 'Electronegativity' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'atoms-periodic-table',
	title: 'Atoms and the periodic table',
	summary:
		'Build an atom from protons, neutrons and electrons, watch the electrons fill their shells, and see why the periodic table has the shape it has.',
	chapters: [
		{ id: 'atom', title: 'Building an atom' },
		{ id: 'electrons', title: 'Where the electrons go' },
		{ id: 'table', title: 'The periodic table' }
	],
	steps: [
		{
			id: 'build',
			chapter: 'atom',
			title: 'Protons, neutrons, electrons',
			scene: 'atom',
			hints: { phase: 'build' },
			duration: 30,
			controls: [addProton, removeProton, addNeutron, removeNeutron, addElectron, removeElectron],
			body: `
<p>Every atom has a tiny, heavy <dfn data-def="The centre of an atom, made of protons and neutrons, about 100,000 times smaller than the atom itself.">nucleus</dfn> of <strong>protons</strong> (positive) and <strong>neutrons</strong> (no charge), surrounded by much lighter <strong>electrons</strong> (negative).</p>
<p>Add protons and watch the element change: the number of protons — the <dfn data-def="The number of protons in an atom's nucleus. It decides which element the atom is.">atomic number</dfn> — is what makes an atom carbon or iron or gold. Neutrons change only the mass (different <dfn data-def="Atoms of the same element with different numbers of neutrons.">isotopes</dfn>, some stable and some radioactive). Electrons balance the charge: one more or fewer than the protons and the atom becomes an <strong>ion</strong>.</p>`,
			notes: `<p>The drawing can't be to scale: if the nucleus were the size of a pea, the atom would be the size of a football stadium. Element data on this page comes from the open mendeleev database: ionization energies from NIST, covalent radii from Cordero et al. (2008), standard atomic weights from IUPAC, electronegativities on the Pauling scale (from the CRC Handbook of Chemistry and Physics).</p>`
		},
		{
			id: 'shells',
			chapter: 'electrons',
			title: 'Electrons fill shells in order',
			scene: 'atom',
			hints: { phase: 'shells' },
			duration: 30,
			controls: [fillTo],
			body: `
<p>Electrons are arranged in <strong>shells</strong> around the nucleus, and each shell is made of <dfn data-def="Groups of orbitals within a shell, labelled s, p, d and f, holding up to 2, 6, 10 and 14 electrons.">subshells</dfn> called s, p, d and f, holding 2, 6, 10 and 14 electrons. The first shell has only an s subshell (2 electrons); the second has s and p (2 + 6 = 8); the third s, p and d.</p>
<p>Electrons fill the lowest-energy places first, in a set order: 1s, 2s, 2p, 3s, 3p, then <strong>4s before 3d</strong>, and so on. Slide the number of electrons up and watch each element's place in the table light up as its last electron goes in.</p>`,
			notes: `<p>The order follows the "n + ℓ" (Madelung) rule. A score or so of elements break it slightly — chromium and copper, for example, move one electron from 4s to 3d, because half-filled and filled d subshells are especially stable. The page always shows each element's measured configuration (predicted, for a few of the heaviest) and marks these exceptions.</p>`
		},
		{
			id: 'orbitals',
			chapter: 'electrons',
			title: 'Clouds, not orbits',
			scene: 'orbital',
			hints: { phase: 'orbitals' },
			duration: 30,
			controls: [orbital],
			body: `
<p>Drawings often show electrons circling the nucleus like planets. That picture is wrong. An electron doesn't follow a path at all; quantum mechanics only tells us how <em>likely</em> it is to be found at each place. An <dfn data-def="A region around the nucleus where an electron is likely to be found, described by a wave function; not a path or an orbit.">orbital</dfn> is that cloud of likelihood.</p>
<p>The dots here are where the electron might be found if you looked many times: dense where it is likely, sparse where it isn't. An s orbital is a fuzzy sphere; a p orbital has two lobes on either side of the nucleus; d orbitals have four lobes, or two and a ring. Drag to turn them round.</p>`,
			notes: `<p>These are the exact shapes for hydrogen's single electron, computed from the Schrödinger equation; in other atoms the orbitals have similar shapes. The two colours show the sign of the wave function, which matters when atoms bond — not a positive and negative charge.</p>`
		},
		{
			id: 'table',
			chapter: 'table',
			title: 'Why the table has this shape',
			scene: 'table',
			hints: { phase: 'blocks' },
			duration: 26,
			body: `
<p>Now look at the whole periodic table, coloured by which subshell each element's last electron goes into. The pattern is the filling order: two columns of s on the left, six of p on the right, ten of d in the middle — and the fourteen f columns usually printed below so that the table fits on a page.</p>
<p>Each <strong>row</strong> (period) starts a new shell. Each <strong>column</strong> (group) collects elements with the same arrangement of outer electrons. The table's shape isn't a convention; it is <strong>how electrons fill shells</strong>.</p>`,
			notes: `<p>Dmitri Mendeleev published his table in 1869 by ordering the elements by mass and grouping similar ones, leaving gaps for elements not yet discovered — and predicting their properties. Why it worked was only understood once electron shells were, in the 1920s.</p>`
		},
		{
			id: 'trends',
			chapter: 'table',
			title: 'Trends across the table',
			scene: 'table',
			hints: { phase: 'trends' },
			duration: 30,
			controls: [colourBy],
			body: `
<p>Colour the table by a property and patterns appear. <strong>Atoms get smaller</strong> from left to right across a row — more protons pull the same shell in tighter — and bigger down a column, as new shells are added.</p>
<p>The energy needed to pull off an outer electron, the <dfn data-def="The energy needed to remove one electron from an atom; the first ionization energy removes the most loosely held one.">ionization energy</dfn>, does the opposite: lowest at the bottom left, highest at the top right. So does <dfn data-def="How strongly an atom in a molecule pulls shared electrons towards itself (Pauling scale; fluorine is the highest at 3.98).">electronegativity</dfn>, how strongly an atom pulls on shared electrons. Grey squares are elements with no value in the data.</p>`
		},
		{
			id: 'chemistry',
			chapter: 'table',
			title: 'The outer electrons decide',
			scene: 'table',
			hints: { phase: 'chemistry' },
			duration: 30,
			body: `
<p>Chemistry happens at the edges of atoms, so it is the <strong>outer electrons</strong> that matter. The alkali metals (lithium, sodium, potassium…) each have one outer electron, easy to lose: they all react vigorously with water, more violently further down. The halogens (fluorine, chlorine…) are one electron short of a full shell and grab one eagerly. The noble gases (helium, neon, argon…) already have full shells and hardly react at all.</p>
<p>That is the lesson of the table: <strong>its layout follows from how electrons fill shells, and an element's chemistry is set by its outermost electrons</strong>.</p>`
		}
	]
};
