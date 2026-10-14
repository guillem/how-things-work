import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------

const msMasses = [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5, 8, 10, 15, 20, 30, 40, 60] as const;
const solarMasses = (v: number) => `${v} M☉`;

/** Mass of a newly formed star on the main sequence. */
const msMass: Control = {
	type: 'range',
	id: 'msMass',
	label: 'Mass of the star',
	min: 0.1,
	max: 60,
	step: 0.1,
	default: 1,
	values: () => msMasses,
	format: solarMasses,
	help: 'In solar masses (M☉): 1 is the mass of the Sun.'
};

/** Initial mass of the star whose life is run. */
const mass: Control = {
	type: 'range',
	id: 'mass',
	label: 'Starting mass',
	min: 0.5,
	max: 30,
	step: 0.5,
	default: 1,
	values: () => [0.5, 1, 2, 3, 5, 12, 15, 20, 30],
	format: solarMasses,
	help: 'The masses with a computed track: pick one and its life runs from the start.'
};
const run: Control = { type: 'action', id: 'run', label: 'Run', action: 'Run again' };

/** Which source of the elements to pick out on the periodic table. */
const source: Control = {
	type: 'select',
	id: 'source',
	label: 'Show',
	default: 'all',
	options: [
		{ value: 'all', label: 'Every source' },
		{ value: 'bigBang', label: 'The Big Bang' },
		{ value: 'cosmicRays', label: 'Cosmic rays' },
		{ value: 'lowMass', label: 'Dying low-mass stars' },
		{ value: 'massive', label: 'Exploding massive stars' },
		{ value: 'whiteDwarfs', label: 'Exploding white dwarfs' },
		{ value: 'mergers', label: 'Merging neutron stars' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'stars',
	title: 'The life cycle of stars',
	summary:
		'Choose a star’s mass and run its life across the Hertzsprung–Russell diagram while a cutaway shows what its core is fusing, watch it end as a white dwarf, a neutron star or a black hole, and find out where each element in the periodic table was made.',
	chapters: [
		{ id: 'balance', title: 'What a star is' },
		{ id: 'mass', title: 'Mass decides' },
		{ id: 'sun', title: 'The life of the Sun' },
		{ id: 'massive', title: 'Live fast, die young' },
		{ id: 'yours', title: 'Run a star' },
		{ id: 'elements', title: 'Where the elements come from' }
	],
	steps: [
		// ------------------------------------------------------------------ balance
		{
			id: 'balance',
			chapter: 'balance',
			title: 'A ball of gas in balance',
			scene: 'star',
			hints: { phase: 'balance' },
			duration: 24,
			body: `
<p>A star is a huge ball of gas, mostly hydrogen and helium, held together by its own gravity. Gravity pulls every part of it towards the centre. What stops it collapsing is <strong>pressure</strong>: the deeper you go, the more weight presses down, and the hotter and denser the gas has to be to push back.</p>
<p>At the centre of the Sun the gas is at about <strong>16 million kelvin</strong> and 160 times as dense as water. It is so hot that the atoms have lost their electrons: the nuclei and electrons fly about separately, a <dfn data-def="Gas so hot that its atoms have lost electrons: a mix of free nuclei and electrons.">plasma</dfn>.</p>
<p>A hot body glows, and the star is losing that heat into space all the time: the Sun radiates 3.8 × 10²⁶ watts. If nothing replaced it, the star would slowly shrink and heat up. Something in the core must be making energy as fast as the surface pours it out.</p>`,
			notes: `<p>The numbers for the Sun on this page come from a computed model of a star of one solar mass (MIST, built with the MESA stellar evolution code), at the Sun's age of 4.57 billion years. The model is about 10% brighter than the real Sun today (1.1 L☉) and 75 K hotter at the surface: good, but not a perfect match, because it was computed for a whole family of stars, not tuned to the Sun.</p>`
		},
		{
			id: 'fusion',
			chapter: 'balance',
			title: 'Fusion: four protons make one helium',
			scene: 'star',
			hints: { phase: 'fusion' },
			duration: 26,
			body: `
<p>The energy comes from <dfn data-def="Nuclear fusion: light nuclei joining to make a heavier one. When the product is more tightly bound, energy is released.">nuclear fusion</dfn>. Hydrogen nuclei are single protons. They repel each other, and at everyday temperatures they never get close. At 16 million kelvin a few collide fast enough to touch, and the strong nuclear force takes over (with help from <a href="../quantum-mechanics/#barrier">quantum tunnelling</a>).</p>
<p>In a chain of steps four protons become one helium nucleus. On the way two of the protons turn into neutrons, giving off a positron and a neutrino each: a kind of <a href="../radioactivity/#beta">beta decay</a>, driven by the <a href="../standard-model/#weak">weak force</a>. A helium-4 nucleus weighs <strong>0.7% less</strong> than the four protons it was made from. The missing mass becomes energy, E = mc².</p>
<p>To shine as it does, the Sun turns <strong>4.3 million tonnes</strong> of matter into energy every second. It has so much hydrogen that it can keep this up for about ten billion years.</p>`,
			notes: `<p>In the Sun this is the <dfn data-def="Proton–proton chain: the sequence of fusion reactions that turns four protons into helium-4 in stars like the Sun.">proton–proton chain</dfn>: p + p → deuterium + positron + neutrino; deuterium + p → helium-3; helium-3 + helium-3 → helium-4 + 2 p. The first step is extraordinarily slow — a given proton in the Sun's core waits billions of years for it — which is why the Sun burns steadily instead of exploding. In stars above about 1.5 solar masses (in the model), the hotter core runs another route, the CNO cycle, in which carbon, nitrogen and oxygen nuclei act as catalysts. The energy appears as fast particles and gamma rays, which take many thousands of years to stagger out through the dense interior before leaving the surface as sunlight.</p>`
		},
		// ------------------------------------------------------------------ mass
		{
			id: 'hr',
			chapter: 'mass',
			title: 'A map of the stars',
			scene: 'hr',
			hints: { phase: 'nearby' },
			duration: 26,
			body: `
<p>Plot stars by how hot their surface is and how much light they give off, and they are not scattered at random. This chart is the <dfn data-def="Hertzsprung–Russell diagram: stars plotted by surface temperature (hot on the left) against luminosity (bright at the top).">Hertzsprung–Russell (HR) diagram</dfn>, drawn here for real stars within 163 light years of the Sun, measured by the Gaia space telescope. By tradition hot stars are on the left; luminosity goes up, each line ten times brighter than the one below.</p>
<p>Colour follows temperature, as for any glowing body: cool stars are orange-red, the Sun is white with a hint of yellow, hot stars are blue-white. Most stars lie on one band, the <dfn data-def="The band across the HR diagram where stars spend most of their lives, fusing hydrogen into helium in their cores.">main sequence</dfn>: stars fusing hydrogen in their cores, like the Sun. A few are big and cool but bright: <strong>giants</strong>. And a separate group is hot yet very faint, so it must be tiny: <strong>white dwarfs</strong>.</p>`,
			notes: `<p>The dots are a random one-in-fifteen sample of the Gaia Catalogue of Nearby Stars (Gaia Collaboration, Smart et al. 2021): 2,500 ordinary stars and 140 white dwarfs. Gaia measured their distances and brightness; temperatures and total luminosities come from their colours through Mamajek's table of standard stars, and for white dwarfs from the fits of Gentile Fusillo et al. (2021). Near the Sun most stars are small red dwarfs, too faint to see with the naked eye: of the stars you see at night, most are rare, much brighter ones far away.</p>`
		},
		{
			id: 'main-sequence',
			chapter: 'mass',
			title: 'The main sequence is a line of masses',
			scene: 'hr',
			hints: { phase: 'zams' },
			duration: 30,
			controls: [msMass],
			body: `
<p>Why a single band? Because a star fusing hydrogen is set almost completely by one number: its <strong>mass</strong>. Choose a mass and see where a newly formed star sits. More mass means more weight to hold up, a hotter, denser core, and much faster fusion.</p>
<p>Luminosity rises steeply with mass: roughly as <strong>M<sup>3.5</sup> to M<sup>4</sup></strong>. A star of 10 solar masses (10 M☉) starts out 6,400 times as luminous as the Sun, and a star of 0.1 M☉ a thousand times fainter. The lightest stars are red dwarfs at 2,900 K; the heaviest are blue at 50,000 K.</p>
<p>A bigger star has more fuel, but it burns it far faster. Its life on the main sequence goes as fuel over burning rate, <strong>M/L</strong>: about 10 billion years for the Sun, 24 million for 10 M☉, 4 million for 60 M☉. Stars below about 0.9 M☉ live longer than the universe has existed: not one of them has ever left the main sequence.</p>`,
			notes: `<p>The line is the <dfn data-def="Zero-age main sequence: where stars of each mass sit when they first start fusing hydrogen in their cores.">zero-age main sequence</dfn> of the MIST models (Choi et al. 2016) for stars of the Sun's composition. Over their lives on the main sequence, stars slowly brighten and move up off the line: the Sun has brightened by about 40–50% since it formed. M/L is not exact: in the models, the lifetime times L/M changes by a factor of four from 0.5 to 60 M☉, while L itself changes ten-million-fold. Massive stars mix more of their hydrogen into their convective cores, so they burn a bigger share of it (a third, against a seventh for the Sun).</p>`
		},
		// ------------------------------------------------------------------ sun
		{
			id: 'sun-ms',
			chapter: 'sun',
			title: 'Ten billion years of hydrogen',
			scene: 'life',
			hints: { mass: 1, from: 'zams', to: 'tams' },
			duration: 22,
			body: `
<p>Now follow one star through its whole life: the Sun. On the left, its path across the HR diagram; on the right, a cutaway showing what is fusing where; at the bottom, the real timeline of its life.</p>
<p>For ten billion years, almost nothing happens. The core turns hydrogen into helium, the helium collects at the centre, and the hydrogen there runs down from 70% to nothing. The core shrinks and heats a little, and the Sun slowly brightens: from two-thirds of today's luminosity when it formed to over twice it at the end. Today, at 4.6 billion years, it is about halfway.</p>
<p>The timeline shows the main point: the main sequence is <strong>over 85% of the Sun's life</strong>. Everything that follows is crammed into the last 1.5 billion years.</p>`,
			notes: `<p>The animation moves through the model's stages, not at a constant pace in years: it gives the brief late stages as much time on screen as the long main sequence. The bar at the bottom is drawn to scale in years. The cutaway is a sketch: its layers are drawn so that each one's area is its share of the star's mass (a giant's dense core is in reality thousands of times smaller than its envelope), and the core burning on the main sequence is drawn at a fixed size.</p>`
		},
		{
			id: 'red-giant',
			chapter: 'sun',
			title: 'A red giant',
			scene: 'life',
			hints: { mass: 1, from: 'tams', to: 'rgbTip' },
			duration: 22,
			body: `
<p>When the hydrogen at the centre runs out, fusion there stops. With nothing to hold it up, the helium core contracts and heats, and the hydrogen just around it gets hot enough to fuse: the star now burns hydrogen in a <strong>shell</strong> round an inert helium core.</p>
<p>The shell burns fiercely and the extra energy puffs the outer layers up. The star swells and its surface cools: it becomes a <dfn data-def="A star in a late stage of its life, with a contracted core and a hugely swollen, cool outer envelope.">red giant</dfn>. Over 1.4 billion years the model Sun grows to <strong>170 times its present size</strong> and 2,400 times its present luminosity, with a surface of only 3,100 K. Mercury and Venus are swallowed.</p>
<p>Meanwhile the helium core, packed tighter and tighter, heats up towards 100 million kelvin.</p>`,
			notes: `<p>A giant loses mass from its swollen surface in a slow wind: the model Sun is down to 0.95 M☉ by the end of this stage. As the Sun loses mass, the planets' orbits widen, so whether the Earth itself is swallowed is still debated.</p>`
		},
		{
			id: 'helium',
			chapter: 'sun',
			title: 'Helium burns',
			scene: 'life',
			hints: { mass: 1, from: 'rgbTip', to: 'tachb' },
			duration: 22,
			body: `
<p>At about 100 million kelvin helium nuclei can fuse. Three helium-4 nuclei make one carbon-12 (the <dfn data-def="Triple-alpha process: three helium-4 nuclei (alpha particles) fusing into carbon-12, at around 100 million kelvin.">triple-alpha process</dfn>), and a further helium turns some of the carbon into oxygen-16. These are the carbon and oxygen of your body: made like this, in stars.</p>
<p>In a star like the Sun the core is so dense that helium ignites in a runaway, the <dfn data-def="The sudden, runaway ignition of helium in the dense core of a low-mass red giant.">helium flash</dfn>, which then settles down. The core expands, the hydrogen shell weakens, and the star shrinks to about 11 times today's Sun and 47 times its luminosity.</p>
<p>It now burns helium in its core for about 110 million years: a second, shorter quiet phase.</p>`,
			notes: `<p>The carbon-making reaction only goes fast enough because carbon-12 has an energy level that matches the energy of three helium nuclei: Fred Hoyle predicted it in 1953 from the fact that carbon exists, and it was found in the laboratory soon after. In the core the electrons are packed so tightly that they resist further squeezing by a quantum effect (electron degeneracy), not by heat: that is why heating the core does not make it expand and cool, and the ignition runs away. At the peak of the flash helium burns at up to 10¹⁰ times the Sun's present luminosity, but all that energy is absorbed inside the star: from outside, nothing is seen.</p>`
		},
		{
			id: 'white-dwarf',
			chapter: 'sun',
			title: 'A white dwarf',
			scene: 'life',
			hints: { mass: 1, from: 'tachb', to: 'end' },
			duration: 26,
			body: `
<p>When the core helium runs out, the star has a core of carbon and oxygen, a helium-burning shell and a hydrogen-burning shell. It swells again, bigger than before: an <dfn data-def="Asymptotic giant branch: the last giant stage of a low- or intermediate-mass star, with helium and hydrogen burning in shells round a carbon–oxygen core.">asymptotic giant</dfn>, more than 300 times the Sun's present size, wider than the Earth's orbit. The two shells take turns flaring, and strong winds blow the outer layers away.</p>
<p>In its last million years as a giant the whole envelope is blown away, and the hot bare core lights up the gas round it: a <dfn data-def="A glowing shell of gas thrown off by a dying low-mass star, lit up by its hot core. Nothing to do with planets: they looked like planets' discs in small telescopes.">planetary nebula</dfn>. What is left is a <strong>white dwarf</strong>: a ball of carbon and oxygen of 0.54 M☉, about the size of the Earth. A teaspoonful of it would weigh about as much as a car.</p>
<p>It makes no more energy. It simply cools, down the bottom of the HR diagram, for billions of years.</p>`,
			notes: `<p>The model's track ends while the white dwarf is still at 48,000 K; the real white dwarfs in the HR diagram show where it goes next. A white dwarf is held up by the same electron degeneracy that made the helium flash run away, and it can do so only up to about 1.4 M☉ (the Chandrasekhar limit). The gas blown off in this stage carries carbon, nitrogen and heavy elements made in the shells out into space.</p>`
		},
		// ------------------------------------------------------------------ massive
		{
			id: 'massive',
			chapter: 'massive',
			title: 'A massive star',
			scene: 'life',
			hints: { mass: 20, from: 'zams', to: 'end' },
			duration: 30,
			body: `
<p>Now a star of 20 solar masses. It starts blue-white at 36,000 K, shining 46,000 times as much as the Sun, and it burns through its core hydrogen in <strong>9 million years</strong>: a thousandth of the Sun's time.</p>
<p>The rest is the same story, sped up and taken further. The core runs out of hydrogen, the star swells into a <dfn data-def="The largest stars: tens to hundreds of thousands of times as luminous as the Sun, hundreds to more than a thousand times its size.">supergiant</dfn> a thousand times the Sun's size, and the core burns helium into carbon and oxygen for under a million years. Strong winds blow 7 M☉ of its outer layers away.</p>
<p>Then something the Sun can never do: its core is massive enough to keep contracting and heating until <strong>carbon</strong> fuses too, at 900 million kelvin, into neon and magnesium. It burns for about a thousand years — and the model stops here.</p>`,
			notes: `<p>Above about 8 M☉ the core never becomes dense enough for electron degeneracy to hold it up, so each time a fuel runs out it contracts, heats and ignites the next. Stars spin, and rotation mixes extra fuel into the core: the MIST models used here start spinning at 40% of the speed that would tear their surface apart.</p>`
		},
		{
			id: 'collapse',
			chapter: 'massive',
			title: 'An onion, a collapse, a supernova',
			scene: 'collapse',
			duration: 34,
			body: `
<p>After carbon come <strong>neon</strong>, <strong>oxygen</strong> and <strong>silicon</strong>, each hotter and far quicker than the last: for a 20 M☉ star, carbon lasts about 1,000 years, neon 7 months, oxygen 16 months and silicon <strong>11 days</strong>. Each fuel keeps burning in a shell once the centre has used it up, so the star ends up layered like an onion (the model tracks stop at the end of carbon burning: what follows is too fast for the surface to notice).</p>
<p>Silicon burning makes <strong>iron</strong>, a dead end: its nucleus is among the most tightly bound of all, so fusing it absorbs energy instead of releasing it. When the iron core reaches about 1.4 M☉ it can no longer hold itself up. In less than a second it collapses from thousands of kilometres across to a ball about 12 km in radius, and its electrons and protons are squeezed into neutrons: a <dfn data-def="The collapsed core of a massive star: about 1.4 solar masses packed into a ball some 12 km in radius, as dense as an atomic nucleus.">neutron star</dfn>.</p>
<p>The infalling layers rebound off it, heated by a flood of neutrinos, and the rest of the star is blown apart: a <dfn data-def="Core-collapse supernova: the explosion of a massive star whose iron core has collapsed. For weeks it can outshine a whole galaxy.">supernova</dfn>, for weeks as bright as a galaxy, scattering the carbon, oxygen, silicon and iron the star made. In 1987 about two dozen neutrinos from one in a neighbouring galaxy were caught on Earth. In the heaviest stars much of the core falls back, and the remnant becomes a <a href="../black-holes/#horizon">black hole</a>.</p>`,
			notes: `<p>Stage durations and central temperatures: Heger, Woosley, Fryer and Langer (2003), Table 1, for a 20 M☉ star of solar composition (hydrogen 8.1 million years at 37 million K, helium 1.2 million years at 190 million K, carbon 980 years at 870 million K, neon 0.6 years at 1.6 billion K, oxygen 1.3 years at 2.0 billion K, silicon 0.031 years at 3.3 billion K). The onion is a sketch: its layers are illustrative. Almost all of a supernova's energy — some 3 × 10⁴⁶ J, a few hundred times what the Sun will radiate in its whole life — leaves as neutrinos; the explosion takes about 1%, the light 0.01%. Which stars leave neutron stars and which black holes is not a clean cut: for single stars of solar composition, models give neutron stars up to about 20–25 M☉ and black holes, mostly by fallback, above. This page uses that simple rule.</p>`
		},
		// ------------------------------------------------------------------ yours
		{
			id: 'run',
			chapter: 'yours',
			title: 'Run a star',
			scene: 'life',
			hints: { from: 'zams', to: 'end', free: true },
			duration: 36,
			controls: [mass, run],
			body: `
<p>Choose a starting mass and run its life. Watch where it moves on the HR diagram, what its core is fusing, how long it all takes, and what it leaves behind.</p>
<p>Stars of up to about <strong>8 M☉</strong> end as white dwarfs; the heavier they start, the heavier the white dwarf. Above that, the core goes on to carbon and beyond, collapses, and leaves a <strong>neutron star</strong>; above about 20–25 M☉, most likely a <strong>black hole</strong>. A 0.5 M☉ star has not had time to do anything: it will still be on the main sequence when the universe is seven times its present age.</p>
<p>Mass decides everything: how bright the star is, how long it lives, how far its fusion goes, and how it dies.</p>`,
			notes: `<p>Tracks: MIST v1.2 (Choi et al. 2016; Dotter 2016), stars of the Sun's composition, spinning at the start. Low-mass tracks end on the white-dwarf cooling track; massive ones after carbon burning, a few thousand years before the core collapses. Real stars often live in pairs, and a companion can strip a star's envelope or feed it mass, changing its fate; this page follows single stars only.</p>`
		},
		// ------------------------------------------------------------------ elements
		{
			id: 'origins',
			chapter: 'elements',
			title: 'Where each element was made',
			scene: 'table',
			hints: { phase: 'origins' },
			duration: 30,
			controls: [source],
			body: `
<p>The Big Bang made almost nothing but hydrogen and helium (and a trace of lithium). Every heavier atom was made later. Here is the <a href="../atoms-periodic-table/#table">periodic table</a>, each square shaded by where the atoms of that element in the Solar System came from.</p>
<p><strong>Dying low-mass stars</strong> made most of the carbon and nitrogen, and heavy elements such as barium and lead. <strong>Exploding massive stars</strong> made all the oxygen and neon, most of the magnesium and silicon, and half the calcium. <strong>Exploding white dwarfs</strong> — a white dwarf in a pair that grows past 1.4 M☉ and blows up — made most of the iron. <strong>Merging neutron stars</strong> made most of the gold, platinum and uranium.</p>
<p>Apart from hydrogen and most of the helium, only beryllium, boron and part of the lithium were not made by stars, but by <strong>cosmic rays</strong> — fast nuclei in space — smashing heavier atoms apart. Pick a source to see its share.</p>`,
			notes: `<p>The shares are from Jennifer Johnson's table of the origin of the elements in the Solar System (2017; CC BY-SA 4.0), as encoded in C. M. G. Lee's redrawing of it. They were read off a picture and are approximate, to a few per cent. Grey squares are elements with no long-lived isotopes (technetium, promethium and those beyond plutonium): any made in stars have long since decayed; we know them from laboratories and reactors. Polonium to plutonium are shown as made by merging neutron stars: they come from the decay of heavier nuclei made there.</p>`
		},
		{
			id: 'heavy',
			chapter: 'elements',
			title: 'Beyond iron: catching neutrons',
			scene: 'table',
			hints: { phase: 'heavy' },
			duration: 28,
			controls: [source],
			body: `
<p>Fusion stops paying at iron, so the heavier elements are built another way: by adding <strong>neutrons</strong>. A neutron has no charge, so it is not repelled by a nucleus and simply sticks to it. When a nucleus has taken too many, one neutron turns into a proton (<a href="../radioactivity/#beta">beta decay</a>) and the nucleus becomes the next element up.</p>
<p>In giant stars like the dying Sun, a trickle of neutrons is caught one at a time, over thousands of years: the <dfn data-def="Slow neutron capture: nuclei catch neutrons one at a time, with time to beta-decay between captures. Happens in asymptotic giant stars.">s-process</dfn>. It makes barium, strontium and lead. When two neutron stars collide, a torrent of neutrons is caught in a second: the <dfn data-def="Rapid neutron capture: nuclei are flooded with neutrons faster than they can decay. Happens in neutron-star mergers, perhaps also in rare supernovae.">r-process</dfn>, which makes europium, gold, platinum and uranium.</p>
<p>In 2017 gravitational-wave detectors heard two neutron stars merge, and telescopes saw the glow of the heavy elements it had just made: the first direct sight of the r-process at work.</p>`,
			notes: `<p>The 2017 merger was GW170817, 130 million light years away; strontium was later identified in its spectrum (Watson et al. 2019). Whether rare kinds of supernovae also make r-process elements is still open; Johnson's table puts them all on mergers.</p>`
		},
		{
			id: 'stardust',
			chapter: 'elements',
			title: 'Made of stars',
			scene: 'table',
			hints: { phase: 'you' },
			duration: 26,
			body: `
<p>By mass, your body is about 61% oxygen, 23% carbon, 10% hydrogen, 2.6% nitrogen, 1.4% calcium and 1.1% phosphorus, with a little of many others. Only the hydrogen dates from the Big Bang. The oxygen came from massive stars that exploded before the Sun was born; the carbon and nitrogen largely from dying stars like the Sun; the calcium in your bones from both kinds of supernova; the iron in your blood mostly from exploding white dwarfs.</p>
<p>So about <strong>nine-tenths of your mass</strong> was made inside stars, in their lives, their explosions and their collisions, and then mixed into the cloud of gas that formed the Sun and the Earth 4.6 billion years ago.</p>
<p>A star's mass decides how it lives and dies; and almost every element heavier than helium was made in stars or in their explosions and collisions.</p>`,
			notes: `<p>The body composition is that of the ICRP "Reference Man" (ICRP Publication 23, 1975), a standard 70 kg adult. The shares of oxygen and the others apply to the Solar System as a whole: the atoms in you were mixed long before the Earth formed, so they have the same history.</p>`
		}
	]
};
