import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { CORE_MAX, CORE_MIN, GALAXIES, ML_MAX, ML_MIN, RATIO_MAX } from './galaxies';

// ---- controls ------------------------------------------------------------------------

const ml: Control = {
	type: 'range',
	id: 'ml',
	label: 'Mass of the stars per unit of light (Υ)',
	min: ML_MIN,
	max: ML_MAX,
	step: 0.05,
	default: 0.5,
	format: (v) => `${v.toFixed(2)} Suns of mass per Sun of light`,
	help: 'Measured in infrared light (3.6 µm). 0.5 is what models of stellar populations suggest; 1.2 is far more than any real population of stars.'
};

const ratio: Control = {
	type: 'range',
	id: 'ratio',
	label: 'Mass of the dark halo',
	min: 0,
	max: RATIO_MAX / 2,
	step: 0.1,
	default: 0,
	format: (v) => (v === 0 ? 'no halo' : `${v.toFixed(1)} × the visible mass`),
	help: 'The halo’s mass inside the last measured point, compared with all the galaxy’s stars and gas.'
};

const core: Control = {
	type: 'range',
	id: 'core',
	label: 'Size of the halo’s core',
	min: CORE_MIN,
	max: CORE_MAX,
	step: 0.1,
	default: 4,
	format: (v) => `${v.toFixed(1)} kpc`,
	help: 'Inside its core the halo’s density is nearly constant; outside it falls off as 1/r².'
};

const fitHalo: Control = {
	type: 'action',
	id: 'fitHalo',
	label: 'Best fit',
	action: 'Find the best halo',
	help: 'Searches for the halo mass and core size with the smallest χ², for the stars’ Υ you have chosen.'
};

const galaxyPick: Control = {
	type: 'select',
	id: 'galaxy',
	label: 'Galaxy',
	default: 'NGC3198',
	options: GALAXIES.map((g) => ({ value: g.id, label: `${g.name}: ${g.kind}` }))
};

const dark: Control = {
	type: 'range',
	id: 'dark',
	label: 'Dark matter added to the cluster',
	min: 0,
	max: 120,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'none: visible matter only' : `${v} × 10¹³ Suns`),
	help: 'Placed round the two groups of galaxies, inside the 1.3 × 0.8 million-light-year field of the Hubble images.'
};

const trueShapes: Control = {
	type: 'toggle',
	id: 'trueShapes',
	label: 'Show the background galaxies without the cluster',
	default: false
};

// ---- narrative -------------------------------------------------------------------------

export const spec: ExplainerSpec = {
	slug: 'dark-matter',
	title: 'Galaxies and dark matter',
	summary:
		'Spin a real galaxy with only its visible stars and gas and watch the outer stars lag far behind the measured speeds. Add an invisible halo until the rotation curve fits, weigh a colliding cluster of galaxies by how it bends light, and find about five times more matter than we can see.',
	chapters: [
		{ id: 'spin', title: 'A galaxy in orbit' },
		{ id: 'fit', title: 'Weighing a galaxy' },
		{ id: 'lens', title: 'Weighing with light' },
		{ id: 'what', title: 'The missing matter' }
	],
	steps: [
		// ------------------------------------------------------------------ spin
		{
			id: 'galaxy',
			chapter: 'spin',
			title: 'A city of stars, all in orbit',
			scene: 'galaxy',
			hints: { phase: 'spin' },
			duration: 22,
			body: `
<p>A spiral galaxy is a flat, slowly turning disc of stars and gas. <strong>NGC 3198</strong>, 45 million light years away, holds about 19 billion Suns’ worth of stars and 14 billion of hydrogen and helium gas, the gas reaching far beyond the stars. Every star and every cloud is in orbit round the centre, held there by the gravity of everything inside its orbit.</p>
<p>That is exactly the free fall of a planet round the Sun (see <a href="../orbits-kepler/">Orbits and Kepler’s laws</a>), and it obeys the same law: a body in a circular orbit of radius <i>r</i> at speed <i>v</i> needs a mass</p>
<p class="formula">M(&lt;r) = v² r / G</p>
<p>inside its orbit. So <strong>measure how fast the stars go and you have weighed the galaxy</strong> — everything in it, whether it shines or not.</p>`,
			notes: `<p>The galaxy is slow: an outer star of NGC 3198 takes about 1.8 billion years to go round once, so the animation runs at about 40 million years per second. The drawing is schematic (no galaxy has such tidy arms); the speeds of its stars are the measured ones. M = v²r/G is exact for a round (spherical) distribution of mass; for a flat disc it is off by a few tens of percent, which the fits later on take into account.</p>`
		},
		{
			id: 'expect',
			chapter: 'spin',
			title: 'What the visible matter predicts',
			scene: 'galaxy',
			hints: { phase: 'expect' },
			duration: 26,
			body: `
<p>We can also work out how fast the stars <em>should</em> go. Astronomers measure where the starlight and the gas are, convert light into mass, and add up the pull of all of it at each radius. On the left the stars move at those speeds; on the right, at the speeds actually measured.</p>
<p>Near the middle the two agree. Further out they part company: the visible matter predicts speeds that peak at about 100 km/s at 7 kpc and then sag, so the outer stars should fall far behind. Instead the real galaxy turns almost as one wheel, its outer stars at about <strong>150 km/s</strong> — half again as fast as the visible matter could hold. At that speed they should fly off into space. They don’t.</p>`,
			notes: `<p>A <dfn data-def="Kiloparsec: 3,260 light years, about 31 million billion km. The Sun is about 8 kpc from the centre of the Milky Way.">kpc</dfn> (kiloparsec) is 3,260 light years. Both discs start each star at the same place; watch how many turns each makes. The predicted speeds come from SPARC’s mass models (Lelli, McGaugh &amp; Schombert 2016), with the stars’ mass set at 0.5 Suns per Sun of infrared light.</p>`
		},
		{
			id: 'measure',
			chapter: 'spin',
			title: 'Measuring the speeds',
			scene: 'doppler',
			hints: { phase: 'measure' },
			duration: 26,
			body: `
<p>How do we clock a star 45 million light years away? With the <dfn data-def="The change in the wavelength of a wave when its source moves towards you (shorter, bluer) or away from you (longer, redder). The shift is proportional to the speed along the line of sight.">Doppler shift</dfn>. Cold hydrogen gas gives off radio waves of exactly 21.1 cm. As the galaxy turns, one side comes towards us and its 21-cm line arrives slightly shorter (bluer); the other side moves away and its line arrives longer (redder). Radio telescopes map that shift across the disc, and since hydrogen extends far beyond the stars, it traces the orbits much further out than starlight can.</p>
<p>We see NGC 3198 tilted at 73°, so we see only part of each orbit’s speed along our line of sight (<i>v</i> × sin 73°); the tilt is measured from the shape of the disc and corrected for, and the galaxy’s overall motion away from us is subtracted.</p>
<p>The pattern was first seen in starlight by Vera Rubin and Kent Ford in the Andromeda galaxy (1970), then in radio by Albert Bosma (1978). In 1985 van Albada and colleagues used NGC 3198’s flat curve to argue that an unseen halo must surround it.</p>`,
			notes: `<p>The plot on the right is a <em>rotation curve</em> seen from both sides of the galaxy, made from the measured speeds (Begeman 1987, Begeman et al. 1991 and Daigle et al. 2006, compiled in SPARC). At 150 km/s the 21-cm line shifts by only about 0.1 mm (v/c ≈ 0.05%), but radio receivers resolve that easily. Our own galaxy’s curve is flat too: the Sun circles the Milky Way at 229 km/s, and the speed declines by only about 1.7 km/s per kpc out to 25 kpc (Eilers et al. 2019, from 23,000 red giant stars).</p>`
		},
		// ------------------------------------------------------------------ fit
		{
			id: 'curve',
			chapter: 'fit',
			title: 'The rotation curve',
			scene: 'curve',
			hints: { phase: 'curve' },
			duration: 22,
			body: `
<p>Here are the measured speeds of NGC 3198 against distance from the centre: a <dfn data-def="A graph of the orbital speed of stars and gas in a galaxy against their distance from its centre.">rotation curve</dfn>. Each dot is a ring of the disc; its bar is the uncertainty. The speed climbs quickly and then stays flat at about 150 km/s out to 44 kpc, the edge of the detectable gas.</p>
<p>The dashed curve is what <a href="../orbits-kepler/">Kepler</a> would expect beyond most of the light: put all the visible mass at the centre, and the speed falls as 1/√r, like the planets from Mercury to Neptune. At 44 kpc that gives 57 km/s. The measured speed is 149 km/s — so the mass inside that orbit must be (149/57)² ≈ <strong>7 times</strong> the visible mass.</p>`,
			notes: `<p>“All the mass at the centre” is the most generous picture for the outer orbits: any visible mass outside 44 kpc would add nothing there. Real galaxies spread their mass out, and that is what the next step adds.</p>`
		},
		{
			id: 'visible',
			chapter: 'fit',
			title: 'Stars and gas: the visible matter',
			scene: 'curve',
			hints: { phase: 'visible' },
			duration: 26,
			controls: [ml],
			body: `
<p>Now the real visible matter, spread out as it is measured: the <span class="dm-key dm-gas">gas</span> from its 21-cm emission, the <span class="dm-key dm-stars">stars</span> from their infrared light. Each curve is the speed that component alone would give; they combine as <i>v</i>² = <i>v</i>²<sub>gas</sub> + <i>v</i>²<sub>stars</sub> into the <span class="dm-key dm-visible">visible matter</span> curve.</p>
<p>The one thing not measured directly is how much mass each unit of starlight stands for (Υ). Turn it up: more stars fit the inner curve better, but beyond about 15 kpc the visible curve still falls while the data stay flat; at the highest values the inner part overshoots. <dfn data-def="Chi-squared: the sum, over all measured points, of (measured − model)² ÷ (error bar)². Divided by the number of points (less the number of adjusted values) it should be about 1 for a model that fits within the errors.">χ²</dfn> scores the fit: per point it should be near 1. The visible matter alone never gets below about 245.</p>`,
			notes: `<p>“Visible” here includes matter we see in any light, not just to the eye: the stars in infrared, the gas through radio. The gas speed includes a factor 1.33 for helium, which emits no 21-cm line. SPARC gives a component’s speed a negative sign where it pulls outwards, as mass in a ring outside an orbit can in a flat disc; for these galaxies that happens only to the gas near the centre, by a km/s or two, and the chart draws it as zero.</p>`
		},
		{
			id: 'halo',
			chapter: 'fit',
			title: 'Add an invisible halo',
			scene: 'curve',
			hints: { phase: 'halo', halo: true },
			duration: 30,
			controls: [ratio, core, ml, fitHalo],
			body: `
<p>Now add mass we can’t see: a round <span class="dm-key dm-halo">dark halo</span> enveloping the disc, with a nearly constant density in its core and a density falling as 1/r² further out. A halo like that gives a speed that rises and then stays flat — exactly the shape the data need.</p>
<p>Turn up its mass until the <span class="dm-key dm-model">total</span> runs through the dots, then adjust its core (or let the button find the best fit). With Υ = 0.5, NGC 3198 fits within its error bars with a halo of about <strong>5½ times the visible mass</strong> inside the last measured point. The stacked bar under the chart shows the result: most of the galaxy is matter that gives off no light at all.</p>`,
			notes: `<p>The halo is a <em>pseudo-isothermal sphere</em>, density ρ₀ / (1 + (r/r<sub>c</sub>)²). Simulations of cold dark matter predict a somewhat different shape (the NFW profile) with a density spike, a “cusp”, at the centre; many dwarf galaxies fit a flat-cored halo better. Whether that is a problem for the theory or the result of gas blown about by exploding stars is an open question. A χ² per point of about 1–2 is as good as it gets: SPARC’s error bars include only random errors, not the uncertainty in the galaxy’s distance or tilt.</p>`
		},
		{
			id: 'others',
			chapter: 'fit',
			title: 'Other galaxies, the same story',
			scene: 'curve',
			hints: { phase: 'others', halo: true },
			duration: 30,
			controls: [galaxyPick, ratio, core, ml, fitHalo],
			body: `
<p>Try other galaxies from the same catalogue. <strong>NGC 2403</strong> is a smaller spiral, with about a quarter of NGC 3198’s stars. <strong>DDO 154</strong> is a dwarf with hardly any stars: its visible matter is almost all gas, and its curve is far above what that gas can hold. <strong>NGC 2841</strong> is a giant with a bright central bulge; its stars almost explain the inside, but not the flat outskirts at nearly 300 km/s.</p>
<p>Every one needs a halo several times heavier than its stars and gas. This is not a quirk of one galaxy: the SPARC catalogue holds 175 disc galaxies with careful rotation curves, and flat outer curves are the rule.</p>`,
			notes: `<p>The four galaxies and their rotation-curve sources: NGC 3198 (Begeman 1987; Begeman et al. 1991; Daigle et al. 2006), NGC 2403 (Fraternali et al. 2002; Daigle et al. 2006), DDO 154 (Carignan &amp; Beaulieu 1989; Begeman et al. 1991), NGC 2841 (Begeman et al. 1991; Dicaire et al. 2008). For the Milky Way, Eilers et al. (2019) estimate a dark halo of about 7 × 10¹¹ Suns in all.</p>`
		},
		{
			id: 'hidden',
			chapter: 'fit',
			title: 'How much is hidden?',
			scene: 'curve',
			hints: { phase: 'hidden', halo: true, mass: true },
			duration: 26,
			controls: [galaxyPick, ratio, core, ml, fitHalo],
			body: `
<p>Turn the speeds back into mass with M = v²r/G and the picture is starker. This chart shows how much mass lies inside each radius: the <span class="dm-key dm-visible">visible matter</span> levels off as the stars and gas run out, while the <span class="dm-key dm-halo">dark halo</span> keeps growing, in step with the radius, as far as we can measure.</p>
<p>So the dark share grows the further out you look, and the totals are lower limits: where the gas ends, our measurements end, but the halo almost certainly goes on. Rotation curves alone cannot say how far — and they cannot say what the halo is made of. For that we need other ways to weigh things.</p>`,
			notes: `<p>The masses here use the spherical formula for every component, a good approximation for the halo and the total, less so for the flat disc of stars at small radii.</p>`
		},
		// ------------------------------------------------------------------ lens
		{
			id: 'lensing',
			chapter: 'lens',
			title: 'Weighing a cluster with light',
			scene: 'lens',
			hints: { phase: 'lensing' },
			duration: 28,
			controls: [dark, trueShapes],
			body: `
<p>Galaxies gather in clusters of hundreds, and clusters can be weighed in a completely different way: by <dfn data-def="The bending of light by mass. A massive object between us and a distant source distorts and magnifies the source's image, as a lens would.">gravitational lensing</dfn>. Mass bends the path of light (see <a href="../black-holes/">Black holes</a>), so a cluster distorts the images of the faint galaxies far behind it, stretching each a little along a circle round the mass. The stretch depends only on how much mass there is and where, not on whether it shines.</p>
<p>This is a map of the Bullet Cluster, whose light set out 3.4 billion years ago: the <span class="dm-key dm-galaxies">galaxies</span> and the <span class="dm-key dm-xgas">hot gas</span> seen in X-rays, which holds most of the ordinary matter. Lensing by the visible matter alone barely distorts the background. The measured distortions call for <strong>91 × 10¹³ Suns</strong> in this field, against 14 × 10¹³ of gas and stars. Add dark matter until your model weighs the same.</p>`,
			notes: `<p>The masses come from Bradač et al. (2006), who combined the distortions of thousands of faint galaxies with multiple images of a few: 13 ± 1 × 10¹³ Suns of gas and 91 ± 10 × 10¹³ in total in the field of the Hubble images. Stars are about 1–2% of a cluster’s mass (Clowe et al. 2006). The background galaxies are drawn at random, not the real ones, but their stretching is not exaggerated: it is computed from the model for galaxies at a redshift of 1. Each mass component is drawn as a smooth round blob, sized to hold the published mass within the published radius — a schematic of the real, lumpier cluster.</p>`
		},
		{
			id: 'bullet',
			chapter: 'lens',
			title: 'The Bullet Cluster: mass without the gas',
			scene: 'lens',
			hints: { phase: 'bullet' },
			duration: 28,
			controls: [dark],
			body: `
<p>The Bullet Cluster is two clusters that passed through each other only 100–200 million years ago. The galaxies, tiny and far apart, sailed through. The two clouds of gas collided, were slowed down and were left behind in the middle — the smaller one in the shape of a bullet, with a shock wave in front.</p>
<p>If the visible matter were all there is, the lensing would peak on the gas, where most of the visible mass is. Clowe and colleagues (2006) found the opposite: <strong>the mass peaks on the galaxies</strong>, about 200 kpc from the gas. Most of the mass behaved like the galaxies — something that passes through other matter almost without colliding. Move the slider: only when you add the dark matter does the mass map’s peak jump from the gas to the galaxies.</p>`,
			notes: `<p>This is hard to explain by changing the law of gravity instead of adding matter: a modified law would still make the lensing follow the visible matter, mostly the gas. The offset of the lensing peaks from the gas is about 8 standard deviations (Clowe et al. 2006). The time since the collision comes from the speed of the shock front ahead of the bullet, 3,000–4,000 km/s (Markevitch et al. 2002).</p>`
		},
		// ------------------------------------------------------------------ what
		{
			id: 'budget',
			chapter: 'what',
			title: 'Five times as much',
			scene: 'budget',
			hints: { phase: 'budget' },
			duration: 26,
			body: `
<p>Three very different measurements, one answer. Galaxy rotation: the halos of our four galaxies weigh about 5½–8 times their stars and gas inside the last measured point. The Bullet Cluster’s lensing: about 5 times its gas and stars. And the whole universe: the pattern of hot and cold spots in the <dfn data-def="Cosmic microwave background: the faint glow left over from the hot early universe, released when it was 380,000 years old. Its pattern of tiny temperature differences records how matter was distributed then.">cosmic microwave background</dfn>, measured by the Planck satellite, says ordinary matter is 4.9% of the universe’s content and dark matter 26.4%: <strong>5.4 times as much</strong>.</p>
<p>The rest, 68.5%, is <em>dark energy</em>, something else entirely: it makes the expansion of the universe speed up, while dark matter pulls things together like any other matter.</p>`,
			notes: `<p>The cosmic numbers are from Planck 2018 (Planck Collaboration 2020, A&amp;A 641, A6): Ω<sub>b</sub>h² = 0.0224 and Ω<sub>c</sub>h² = 0.120. The cosmic microwave background doesn’t care how matter is spread across galaxies; it weighs ordinary and dark matter separately because only ordinary matter was pushed about by light in the early universe, and that left its mark on the pattern of spots. That two such different methods agree on the ratio is one of the strongest reasons to take dark matter seriously.</p>`
		},
		{
			id: 'candidates',
			chapter: 'what',
			title: 'What could it be?',
			scene: 'budget',
			hints: { phase: 'what' },
			duration: 26,
			body: `
<p>Not ordinary matter in hiding. Dim stars, planets, cold gas and black holes are all made of ordinary matter, and the universe’s total of that is fixed at 4.9% by the microwave background and by how much helium and deuterium the Big Bang made. Surveys that watched millions of stars for the tell-tale brightening caused by a passing dark object (<em>microlensing</em>) found far too few to make up the Milky Way’s halo.</p>
<p>The leading idea is a new kind of particle that feels gravity but not light, and barely touches ordinary matter: candidates include <dfn data-def="Weakly interacting massive particles: hypothetical particles tens to thousands of times heavier than a proton that would interact only through gravity and the weak force.">WIMPs</dfn> and <dfn data-def="Hypothetical, extremely light particles first proposed to solve a puzzle in the theory of the strong force.">axions</dfn>. Detectors deep underground and in particle colliders have searched for decades, so far without a detection. A minority of physicists instead modify the law of gravity at low accelerations (MOND); it fits galaxy rotation curves remarkably well, but struggles with clusters like the Bullet and with the microwave background.</p>
<p>What we know for sure is what the graphs show: <strong>galaxies and clusters move as if they held about five times more matter than we can see</strong>.</p>`,
			notes: `<p>Microlensing: watching 7 million stars in the Magellanic Clouds for 6.7 years, the EROS-2 survey found one candidate where about 39 were expected if the halo were made of half-Sun objects; objects between 0.6 × 10⁻⁷ and 15 Suns cannot be its main ingredient (Tisserand et al. 2007). The most sensitive direct search so far, the LZ tank of liquid xenon deep underground in South Dakota, found no signal in 280 days of data and set the tightest limits yet on WIMPs (LZ Collaboration 2025, arXiv:2410.17036). MOND was proposed by Mordehai Milgrom in 1983.</p>`
		}
	]
};
