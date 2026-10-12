import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Half-life of the imaginary isotope in the grid, in seconds of animation. */
const halflife: Control = {
	type: 'range',
	id: 'halflife',
	label: 'Half-life',
	min: 2,
	max: 30,
	step: 1,
	default: 8,
	unit: ' s',
	help: 'An imaginary isotope, so that its decay plays out in seconds. The same nuclei decay in the same order; only the pace changes.'
};

/** Replays the sample with a new random seed. */
const rerun: Control = {
	type: 'action',
	id: 'rerun',
	label: 'Run again',
	action: 'Run again',
	help: 'A fresh sample: the same rule, different luck.'
};

/** How many nuclei the sample starts with. */
const count: Control = {
	type: 'select',
	id: 'count',
	label: 'Nuclei in the sample',
	default: '1000',
	options: [
		{ value: '10', label: '10' },
		{ value: '100', label: '100' },
		{ value: '1000', label: '1,000' }
	],
	help: 'Fewer nuclei, more luck: the count wanders further from the curve.'
};

/** Kind of decay shown in the comparison step. */
const mode: Control = {
	type: 'select',
	id: 'mode',
	label: 'Kind of decay',
	default: 'alpha',
	options: [
		{ value: 'alpha', label: 'Alpha' },
		{ value: 'beta', label: 'Beta' },
		{ value: 'gamma', label: 'Gamma' }
	],
	help: 'Alpha: americium-241. Beta: carbon-14. Gamma: technetium-99m.'
};

/** Share of a sample's original carbon-14 that is left. */
const fraction: Control = {
	type: 'range',
	id: 'fraction',
	label: 'Carbon-14 left',
	min: 1,
	max: 100,
	step: 1,
	default: 25,
	unit: '%',
	help: 'Compared with the share of carbon-14 in living things.'
};

export const spec: ExplainerSpec = {
	slug: 'radioactivity',
	title: 'Radioactivity and half-life',
	summary:
		'Watch 1,000 unstable nuclei decay at random while their count follows a perfect curve, meet alpha, beta and gamma radiation, and date a sample from its carbon-14.',
	chapters: [
		{ id: 'unstable', title: 'Unstable nuclei' },
		{ id: 'halflife', title: 'Random one by one, precise together' },
		{ id: 'kinds', title: 'Alpha, beta and gamma' },
		{ id: 'dating', title: 'Carbon-14 dating' }
	],
	steps: [
		// ------------------------------------------------------------------ unstable
		{
			id: 'nucleus',
			chapter: 'unstable',
			title: 'Not every nucleus holds together',
			scene: 'nucleus',
			hints: { view: 'intro' },
			duration: 16,
			body: `
<p>Every atom has a tiny <dfn data-def="The dense centre of an atom, made of protons and neutrons, about 100,000 times smaller than the atom itself.">nucleus</dfn> of protons and neutrons. The number of protons decides the element: six makes carbon. The number of neutrons can vary, giving different <dfn data-def="Atoms of the same element (same number of protons) with different numbers of neutrons. They are named by their mass number, the total of protons and neutrons: carbon-12, carbon-14.">isotopes</dfn> of the same element.</p>
<p>On the left is <strong>carbon-12</strong>: 6 protons and 6 neutrons. It lasts for ever. On the right is <strong>carbon-14</strong>: 6 protons and 8 neutrons. It has too many neutrons for its protons, and sooner or later one of those neutrons turns into a proton, firing an electron out of the nucleus. The atom has become nitrogen-14.</p>
<p>A nucleus that changes like this is <dfn data-def="Having a nucleus that can spontaneously change into another, giving off radiation as it does.">radioactive</dfn>, and the change is called <strong>radioactive decay</strong>. Of carbon's isotopes, only carbon-12 and carbon-13 are stable; every other combination falls apart.</p>`,
			notes: `<p>Most combinations of protons and neutrons are unstable: only a few hundred are stable, while thousands of radioactive ones have been made or observed. The stable isotopes of each element shown on this page come from the same data as the atoms explainer (the mendeleev database).</p>`
		},
		// ------------------------------------------------------------------ halflife
		{
			id: 'random',
			chapter: 'halflife',
			title: 'Nobody knows when',
			scene: 'grid',
			hints: { view: 'random', seed: 3 },
			duration: 24,
			controls: [rerun],
			body: `
<p>Here are 1,000 nuclei of the same radioactive isotope. Each square is one nucleus: <strong class="tag rad-parent">intact</strong> or <strong class="tag rad-daughter">decayed</strong>. A ring flashes wherever one decays.</p>
<p>Watch the circled one. Will it decay in the next second? Nobody can say — not now, and not with any instrument or theory we have. Decay is genuinely random: all we can know is the <em>chance</em> that it happens in a given time.</p>
<p>And that chance never changes. A nucleus has no clock inside and does not wear out: one that has survived a long time is exactly as likely to decay in the next second as one that was just made. Press <em>Run again</em>: a new sample, and the circled nucleus lasts a different time.</p>`,
			notes: `<p>Nothing that happens to the atom outside the nucleus — heat, pressure, chemistry — changes the chance in any measurable way (with tiny exceptions for a few nuclei whose decay involves their own electrons). That is what makes radioactive decay such a dependable clock.</p>`
		},
		{
			id: 'halflife',
			chapter: 'halflife',
			title: 'Half of them, every half-life',
			scene: 'grid',
			hints: { view: 'halflife', seed: 3 },
			duration: 30,
			controls: [halflife, rerun],
			body: `
<p>One nucleus is unpredictable, but 1,000 of them are not. Every nucleus has the same chance of decaying in each second, so the more there are, the more decay each second: the count falls fast at first and ever more slowly as fewer remain.</p>
<p>The time it takes for half of them to decay is the <dfn data-def="The time in which, on average, half of the nuclei of a radioactive isotope decay. It is fixed for each isotope.">half-life</dfn>. After one half-life about 500 are left, after another about 250, then about 125: half of whatever is left, every half-life. The dashed line is that rule, N = 1,000 × ½<sup>t / T½</sup>; the solid line is the count of this sample.</p>
<p>Change the half-life. A longer one stretches the schedule, a shorter one squeezes it, but the shape of the curve stays the same.</p>`,
			notes: `<p>Real half-lives span an enormous range. Technetium-99m, used in hospital scans, has a half-life of 6.0 hours; americium-241, in smoke detectors, 432.6 years; carbon-14, 5,700 years; uranium-238, 4.468 billion years, about the age of the Earth (values from the NNDC's evaluated nuclear data). The isotope in this grid is imaginary, so that you can watch its decay in seconds.</p>
<p>The curve is an <dfn data-def="A curve that falls by the same fraction in every equal step of time.">exponential decay</dfn>, the mirror image of the exponential growth of an epidemic or of compound interest: instead of doubling every doubling time, it halves every half-life.</p>`
		},
		{
			id: 'quarter',
			chapter: 'halflife',
			title: 'Two half-lives: a quarter left, not none',
			scene: 'grid',
			hints: { view: 'quarter', seed: 3, stopAt: 2 },
			duration: 22,
			controls: [halflife, rerun],
			body: `
<p>A common mistake: “if half is gone after one half-life, the rest must be gone after two.” That would be true if the nuclei decayed at a steady rate, like sand through an hourglass — the straight dotted line. They don't.</p>
<p>In the second half-life, half of the <em>remaining</em> 500 decay, not another 500. So after two half-lives about <strong>250 are left: a quarter, not zero</strong>. After three, an eighth; after ten, about one in a thousand. The sample stops here, at two half-lives, so you can count.</p>
<p>Each survivor is no closer to decaying than it was at the start: in the next half-life, it again has an even chance. That is why the count never runs out on a fixed date; the last few nuclei can linger for many half-lives.</p>`
		},
		{
			id: 'many',
			chapter: 'halflife',
			title: 'Why large numbers keep the schedule',
			scene: 'grid',
			hints: { view: 'many', seed: 3 },
			duration: 26,
			controls: [count, halflife, rerun],
			body: `
<p>Try a sample of just 10 nuclei and press <em>Run again</em> a few times. Sometimes half are gone well before one half-life, sometimes it takes twice as long. With so few nuclei, luck dominates.</p>
<p>With 100, the count stays closer to the dashed curve; with 1,000, it hugs it. The shaded band is two <dfn data-def="A measure of how far a random result typically lands from its average.">standard deviations</dfn> either side of the curve: the count stays inside it most of the time. As a share of the sample, the band narrows like 1 / √N: a hundred times more nuclei, ten times less wobble.</p>
<p>A speck of carbon holds billions of billions of atoms. With numbers like that the wobble is far too small to see, which is why radioactive samples halve on a schedule you can set a clock by — even though no single nucleus has a schedule at all.</p>`,
			notes: `<p>Each nucleus either survives to time t or not, with probability p = ½<sup>t / T½</sup>, so the count of survivors follows a <dfn data-def="The distribution of the number of successes in N independent tries that each succeed with the same probability.">binomial distribution</dfn> with mean N p and standard deviation √(N p (1 − p)). For large N it becomes a bell curve around the mean, as the central limit theorem predicts.</p>`
		},
		// ------------------------------------------------------------------ kinds
		{
			id: 'alpha',
			chapter: 'kinds',
			title: 'Alpha decay: a helium nucleus flies out',
			scene: 'nucleus',
			hints: { view: 'mode', mode: 'alpha' },
			duration: 18,
			body: `
<p>A heavy nucleus can shed a tight bundle of 2 protons and 2 neutrons: an <dfn data-def="A helium-4 nucleus (2 protons, 2 neutrons) emitted by a decaying nucleus.">alpha particle</dfn>. With 2 fewer protons it is a different element, two places back in the periodic table, and its mass number drops by 4.</p>
<p><strong>Americium-241</strong>, the source inside many smoke detectors, decays this way into <strong>neptunium-237</strong>: Z goes from 95 to 93, A from 241 to 237. The small chart on the right places nuclei by their protons and neutrons; an alpha decay moves two steps down and two to the left.</p>
<p>Alpha particles are heavy and slow and bump into everything: a sheet of paper or a few centimetres of air stops them. Outside the body they are harmless, but an alpha emitter swallowed or breathed in does its damage right next to living cells.</p>`,
			notes: `<p>Americium-241 has a half-life of 432.6 ± 0.6 years and emits alpha particles of 5.49 MeV (data: NNDC NuDat 3). Uranium-238 also decays by alpha emission, into thorium-234, with a half-life of 4.468 billion years.</p>`
		},
		{
			id: 'beta',
			chapter: 'kinds',
			title: 'Beta decay: a neutron becomes a proton',
			scene: 'nucleus',
			hints: { view: 'mode', mode: 'beta' },
			duration: 18,
			body: `
<p>In a nucleus with too many neutrons, one neutron can turn into a proton. To balance the charge, an electron is created and shot out, together with an almost undetectable <dfn data-def="A nearly massless, neutral particle that barely interacts with matter; it carries off part of the energy of the decay.">antineutrino</dfn>. The electron is called a <dfn data-def="An electron (β⁻) emitted by a decaying nucleus.">beta particle</dfn>.</p>
<p>The nucleus keeps the same number of particles, so A stays the same, but it has one more proton: Z goes up by 1 and the element moves one place forward in the periodic table. <strong>Carbon-14</strong> becomes <strong>nitrogen-14</strong>.</p>
<p>Beta particles are light and fast: they go through paper, but a few millimetres of aluminium stop them.</p>`,
			notes: `<p>This is beta-minus decay. Nuclei with too few neutrons can do the opposite (beta-plus decay): a proton turns into a neutron and emits a positron, the electron's antiparticle. The beta particles of carbon-14 are gentle, with at most 156 keV of energy (NNDC NuDat 3).</p>`
		},
		{
			id: 'gamma',
			chapter: 'kinds',
			title: 'Gamma decay: just energy',
			scene: 'nucleus',
			hints: { view: 'mode', mode: 'gamma' },
			duration: 18,
			body: `
<p>A nucleus can be left in an excited state with energy to spare, like an atom whose electron has jumped to a higher level. It lets the energy go as a <dfn data-def="A photon of very high energy, emitted by a nucleus. Like light and X-rays it is electromagnetic radiation, only far more energetic.">gamma ray</dfn>: a photon, with no charge and no mass.</p>
<p>Nothing leaves the nucleus but energy, so neither Z nor A changes: the element and the isotope stay the same. <strong>Technetium-99m</strong> (the “m” is for <dfn data-def="A metastable state: an excited nucleus that lasts long enough to be handled as an isotope of its own.">metastable</dfn>) becomes ordinary <strong>technetium-99</strong>, emitting a 140 keV gamma ray. Hospitals inject it in tiny amounts and track those gamma rays with a camera to image organs.</p>
<p>Gamma rays are the most penetrating: they pass through paper and aluminium, and it takes thick lead or concrete to absorb most of them.</p>`,
			notes: `<p>Technetium-99m has a half-life of 6.0072 hours and its gamma ray carries 140.511 keV (NNDC NuDat 3). Short enough to fade quickly from the body, long enough to deliver from a lab to a hospital. Gamma rays more often follow an alpha or beta decay that leaves the new nucleus excited, as in cobalt-60.</p>`
		},
		{
			id: 'compare',
			chapter: 'kinds',
			title: 'Alpha, beta or gamma?',
			scene: 'nucleus',
			hints: { view: 'mode', mode: 'param' },
			duration: 18,
			controls: [mode],
			body: `
<p>Switch between the three. Each kind of decay changes the nucleus in its own way:</p>
<ul>
<li><strong>Alpha</strong>: Z − 2, A − 4. A new element, two places back.</li>
<li><strong>Beta</strong>: Z + 1, A unchanged. A new element, one place forward.</li>
<li><strong>Gamma</strong>: no change in Z or A; only energy leaves.</li>
</ul>
<p>And each is stopped by different things: paper stops alpha, aluminium stops beta, and gamma is only weakened by lead. Whatever the kind, the timing works the same way: every nucleus decays at random, and a large sample halves once per half-life.</p>`
		},
		// ------------------------------------------------------------------ dating
		{
			id: 'carbon14',
			chapter: 'dating',
			title: 'A clock in every living thing',
			scene: 'dating',
			hints: { view: 'life' },
			duration: 22,
			body: `
<p>Carbon-14 is made all the time high in the atmosphere, where <dfn data-def="Fast particles from space, mostly protons, that smash into the upper atmosphere and knock neutrons out of nuclei.">cosmic rays</dfn> produce neutrons that hit nitrogen-14 and turn it into carbon-14. It mixes into the air's carbon dioxide; plants take it in as they grow, and animals eat the plants.</p>
<p>So while an organism is alive, its carbon has the same tiny share of carbon-14 as the air, about one atom in a trillion: what decays is replaced by what it takes in. When it dies, the intake stops. From then on, its carbon-14 only decays, and the share halves every 5,700 years.</p>
<p>Watch the level: flat during life, then falling on the familiar curve after death. Measuring how much carbon-14 is left tells how long ago that was.</p>`,
			notes: `<p>The carbon-14 half-life used on this page is 5,700 ± 30 years, the current evaluated value (NNDC NuDat 3, ENSDF). The reaction that makes it is n + <sup>14</sup>N → <sup>14</sup>C + p. Willard Libby developed radiocarbon dating in the late 1940s and received the 1960 Nobel Prize in Chemistry for it.</p>`
		},
		{
			id: 'dating',
			chapter: 'dating',
			title: 'Dating a sample',
			scene: 'dating',
			hints: { view: 'date' },
			duration: 22,
			controls: [fraction],
			body: `
<p>Suppose a piece of charcoal has 25% of the carbon-14 that living wood has. A quarter means two halvings, and each takes one half-life, so it is about 2 × 5,700 = <strong>11,400 years old</strong>. Not the 1.5 half-lives a steady rate would suggest (three quarters of the way to empty): two half-lives, each removing half of what was left.</p>
<p>In general the age is the half-life times the number of halvings: age = 5,700 years × log<sub>2</sub>(1 / fraction left). Slide the amount left and read the age off the curve. The ± is just the ± 30 years in the half-life itself, scaled up; real measurements add their own error.</p>
<p>The method has limits. After about 50,000 years only about 0.2% is left, too little to measure reliably, so older things are dated with longer-lived isotopes, such as uranium-238 for rocks.</p>`,
			notes: `<p>This is a simplification. The share of carbon-14 in the air has not been perfectly constant: it varied with the Sun's activity and the Earth's magnetic field, was diluted by fossil-fuel burning and nearly doubled by nuclear bomb tests in the 1950s and 60s. Laboratories therefore report a conventional “radiocarbon age”, which by agreement still uses Libby's older half-life of 5,568 years, and convert it to a calendar age with a calibration curve (currently IntCal20) built from tree rings, corals and cave deposits of known age. This page uses the true half-life and assumes a constant level.</p>`
		}
	]
};
