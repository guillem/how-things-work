import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { AGE, GYR_S, T_MIN_S } from './cosmology';
import { gyrText, timeText, zText } from './format';

// ---- controls ------------------------------------------------------------------------

/** Whose eyes we look through, on the grid of galaxies (clicking a galaxy also picks it). */
const view: Control = {
	type: 'select',
	id: 'view',
	label: 'Look from',
	default: 'mw',
	options: [
		{ value: 'mw', label: 'Milky Way' },
		{ value: 'a', label: 'Galaxy A' },
		{ value: 'b', label: 'Galaxy B' },
		{ value: 'c', label: 'Galaxy C' }
	],
	help: 'Or click any galaxy on the map.'
};

/** Cosmic time on the grid, Gyr. */
const time: Control = {
	type: 'range',
	id: 'time',
	label: 'Time since the Big Bang',
	min: 3,
	max: 30,
	step: 0.05,
	default: AGE,
	format: (v) => (Math.abs(v - AGE) < 0.03 ? `${gyrText(v)} (today)` : gyrText(v)),
	help: 'Today is 13.8 billion years. Beyond it, the model’s prediction for the future.'
};

/** Redshift of the galaxy whose light we follow. */
const zLight: Control = {
	type: 'range',
	id: 'zLight',
	label: 'How far away the galaxy is (its redshift z)',
	min: 0.02,
	max: 1.5,
	step: 0.01,
	default: 0.4,
	format: (v) => `z = ${v.toFixed(2)}`
};

const LOG_T0 = Math.log10(T_MIN_S);
const LOG_NOW = Math.log10(AGE * GYR_S);
/** The timeline scrubber of one step: its value is log₁₀ of the time since the Big Bang in s. */
function scrub(id: string, seconds: number): Control {
	return {
		type: 'range',
		id,
		label: 'Move along the timeline',
		min: LOG_T0,
		max: LOG_NOW,
		step: 1e-6,
		default: Math.min(LOG_NOW, Math.log10(seconds)),
		values: () => Array.from({ length: 1001 }, (_, i) => LOG_T0 + ((LOG_NOW - LOG_T0) * i) / 1000),
		format: (v) => (v >= LOG_NOW - 1e-4 ? 'today, 13.8 billion years' : timeText(10 ** v)),
		help: 'The timeline is logarithmic: each tick is ten times longer than the one before.'
	};
}
const YEAR_S = GYR_S / 1e9;

/** log₁₀ of a redshift, for the distances step. */
const zFar: Control = {
	type: 'range',
	id: 'zFar',
	label: 'Redshift of the source',
	min: -2,
	max: Math.log10(1089.92),
	step: 0.001,
	default: Math.log10(14.32),
	format: (v) => `z = ${zText(10 ** v)}`,
	help: 'From a nearby cluster of galaxies (left) to the cosmic microwave background (right).'
};

export const spec: ExplainerSpec = {
	slug: 'big-bang',
	title: 'The Big Bang & expanding universe',
	summary:
		'Watch a universe of galaxies expand from any galaxy you choose, follow light stretching toward red on its way, run the film backward to a hot, dense beginning, and scrub a timeline from the first second to today.',
	chapters: [
		{ id: 'expanding', title: 'An expanding universe' },
		{ id: 'backward', title: 'Running the film backward' },
		{ id: 'timeline', title: 'From the first second to today' },
		{ id: 'far', title: 'How far is far?' }
	],
	steps: [
		// ------------------------------------------------------------------ expanding
		{
			id: 'receding',
			chapter: 'expanding',
			title: 'Every galaxy is moving away',
			scene: 'grid',
			hints: { phase: 'hubble' },
			duration: 26,
			body: `
<p>In the 1910s Vesto Slipher measured the light of faint spiral nebulae and found that almost all of them were redshifted: moving away from us. In 1927 Georges Lemaître, and in 1929 Edwin Hubble, showed that these are galaxies far beyond our own, and that the farther one is, the faster it recedes. <strong>Speed is proportional to distance.</strong> This is the <dfn data-def="v = H₀ × d: a galaxy's recession speed is proportional to its distance. H₀, the Hubble constant, is about 67–73 km/s for every megaparsec (3.26 million light years) of distance.">Hubble–Lemaître law</dfn>, v = H₀ × d.</p>
<p>The map shows a patch of the universe around the Milky Way, with one dot for every billion light years (real galaxies are thousands of times more crowded), and it runs the expansion forward and backward between 3 and 20 billion years after the Big Bang. Each arrow shows where its galaxy would be a while later at its present speed; the plot beside the map shows those speeds against distance. They fall on a straight line.</p>
<p>Today the slope is <strong>H₀ = 67.4 km/s per megaparsec</strong>: a galaxy 100 million light years away recedes at about 2,100 km/s, one ten times farther at ten times that.</p>`,
			notes: `<p>A megaparsec is 3.26 million light years. The value 67.36 ± 0.54 km/s/Mpc is the one fitted to the cosmic microwave background by the Planck satellite (Planck Collaboration 2020, VI), and it drives everything on this page. Measuring nearby galaxies directly, with Cepheid stars and supernovae, gives a higher 73.0 ± 1.0 (Riess et al. 2022): this <em>Hubble tension</em> is not yet explained. Nearby galaxies also have their own motions of a few hundred km/s (Andromeda is in fact approaching us); the law describes the overall flow, which dominates beyond a few tens of millions of light years. The map is drawn as the universe is at that moment, everywhere at once.</p>`
		},
		{
			id: 'any-galaxy',
			chapter: 'expanding',
			title: 'Seen from any galaxy, the same',
			scene: 'grid',
			hints: { phase: 'view' },
			duration: 26,
			controls: [view],
			body: `
<p>Are we at the centre, then? Move to another galaxy and look again. From Galaxy A, B or C — or any galaxy you click — the picture is the same: <strong>every other galaxy recedes, and the farther it is, the faster</strong>. The Milky Way is now one of the galaxies rushing away.</p>
<p>That is exactly what you get when all distances grow by the same factor at the same time. If every distance doubles, a galaxy 1 billion light years from you ends up 2 billion away (it moved 1), and one at 3 billion ends up at 6 (it moved 3): three times the distance, three times the speed, whichever galaxy you start from.</p>
<p>So there is <strong>no centre</strong>. Every observer sees the same expansion around them, and none of them is special.</p>`,
			notes: `<p>The colour of each galaxy shows the redshift of the light reaching the viewpoint from it at that moment: the farther, the redder. Cosmologists assume the universe looks the same, on large scales, from everywhere (the <dfn data-def="The assumption that, averaged over hundreds of millions of light years, the universe is the same everywhere and in every direction.">cosmological principle</dfn>). Maps of millions of galaxies, and the evenness of the microwave background, support it.</p>`
		},
		{
			id: 'no-centre',
			chapter: 'expanding',
			title: 'Not an explosion',
			scene: 'grid',
			hints: { phase: 'split' },
			duration: 26,
			body: `
<p>Here is the same universe, at the same moment, from two galaxies side by side. Each sees itself at rest with everything else receding, along identical arrows. Neither has a better claim to be the centre.</p>
<p>This is why the Big Bang was <strong>not an explosion into empty space</strong>. An explosion has a centre, where it happened, and an edge, where the debris has reached: the fastest fragments would be the outermost, and an observer near the edge would see the debris all on one side. Nothing like that is seen. The galaxies are not flying through space away from a point; <strong>space itself is stretching</strong>, carrying them apart, everywhere at once.</p>
<p>The map has no edge either. It is a window onto a universe that goes on beyond it, as far as anyone can tell, looking much the same.</p>`,
			notes: `<p>Whether the universe is infinite, or finite but without an edge (like the surface of a balloon, in more dimensions), is not known: the part we can see is too flat to tell. Either way, there is no edge and no centre. Galaxies, and the groups and clusters they live in, do not stretch: their own gravity holds them together. It is the distances <em>between</em> groups of galaxies that grow, which is why the dots keep their size.</p>`
		},
		{
			id: 'stretched-light',
			chapter: 'expanding',
			title: 'Light stretched on its way',
			scene: 'stretch',
			duration: 26,
			controls: [zLight],
			body: `
<p>How do we know a galaxy is receding? From its light. Hydrogen atoms absorb and emit light at sharp wavelengths, like the blue-green line at 486 nm, so a galaxy's spectrum carries a fingerprint of lines. In distant galaxies the whole fingerprint is shifted to longer, redder wavelengths. The <dfn data-def="z: how much the wavelength of light has been stretched, as a fraction. Light seen at 1 + z times the wavelength it was sent at has redshift z.">redshift</dfn> z is how much: the light arrives at (1 + z) times its original wavelength.</p>
<p>It looks like the <a href="../waves-interference/#doppler">Doppler shift</a> of a passing siren, and for nearby galaxies it gives the same answer. But the cause is different. While the light travels, the space it travels through stretches, and the waves stretch with it. Here a wave leaves a galaxy and crosses an expanding universe towards us: <strong>its wavelength grows exactly as much as the universe does</strong>, 1 + z = (size of the universe now) ÷ (size when the light set off).</p>
<p>Move the galaxy farther away: its light has been travelling longer, through more stretching, and its lines move out of the visible spectrum into the infrared.</p>`,
			notes: `<p>The wave is drawn hugely enlarged: real light waves are half a micrometre long. Spacing between the galaxy and us is drawn to scale for each setting: the galaxy's distance when the light left it, and when the light arrives. A galaxy at z = 1 sent the light we see 7.95 billion years ago, when distances in the universe were half what they are today.</p>`
		},
		// ------------------------------------------------------------------ backward
		{
			id: 'backward',
			chapter: 'backward',
			title: 'Run the film backward',
			scene: 'grid',
			hints: { phase: 'history' },
			duration: 28,
			controls: [time],
			body: `
<p>If everything is moving apart now, it was closer together before. Drag time backward. All distances shrink by the same factor: the galaxies crowd together <strong>everywhere at once</strong>, not towards any point. The <dfn data-def="a: how big distances in the universe are compared with today (a = 1 now, 0.5 when all distances were half as big).">scale factor</dfn> <i>a</i> on the plot measures it: 1 today, ½ when every distance was half as long.</p>
<p>At today's speed, the galaxies would all have been on top of each other 14.5 billion years ago (the dashed line). But the expansion has not kept a steady speed, and the real curve reaches zero <strong>13.8 billion years ago</strong>: the age of the universe. Running the film back to that moment, the density and temperature grow without limit. That hot, dense beginning, everywhere at once, is what is called the <dfn data-def="The hot, dense early state of the whole universe, about 13.8 billion years ago, from which it has been expanding and cooling ever since.">Big Bang</dfn>.</p>
<p>Push time into the future too: the model says the expansion will go on, faster and faster.</p>`,
			notes: `<p>The slider stops at 3 billion years, when the map gets too crowded to draw; the curve and the model behind them are integrated from 0.01 seconds after the start. What happened at the very beginning, at “time zero”, is not known: the theory used here (general relativity) is expected to fail when the density gets extreme enough, and other ideas (such as <em>inflation</em>, an extremely fast early expansion) are needed there.</p>`
		},
		{
			id: 'friedmann',
			chapter: 'backward',
			title: 'What sets the pace',
			scene: 'grid',
			hints: { phase: 'contents' },
			duration: 28,
			controls: [time],
			body: `
<p>How fast the universe expands depends on what is in it. In 1922 Alexander Friedmann worked out, from Einstein's general relativity, that the expansion rate H obeys</p>
<p class="formula"><strong>H² = H₀² × (Ω<sub>r</sub>/a⁴ + Ω<sub>m</sub>/a³ + Ω<sub>Λ</sub>)</strong></p>
<p>Each term is one kind of content, as a share of today's total. <strong>Radiation</strong> (Ω<sub>r</sub> = 0.009%) thins out fastest as space grows; <strong>matter</strong> (Ω<sub>m</sub> = 31.5%, mostly unseen dark matter) thins out as the volume grows; <strong>dark energy</strong> (Ω<sub>Λ</sub> = 68.5%) does not thin out at all. So radiation ruled the first 50,000 years, matter the next ten billion, and dark energy rules now.</p>
<p>Matter's gravity slows the expansion; dark energy speeds it up. The bar shows the mix at the time you choose: the expansion slowed down until <strong>7.7 billion years</strong>, when dark energy took over and it began to speed up, the discovery of the 2011 Nobel Prize.</p>`,
			notes: `<p>The numbers are the Planck 2018 fit (Planck Collaboration 2020, VI, table 2): Ω<sub>m</sub> = 0.3153, Ω<sub>Λ</sub> = 0.6847, with radiation from the measured 2.7255 K microwave background plus three kinds of neutrino. The universe is taken as exactly flat, which the data say it is to within about half a percent. Ordinary matter (atoms) is only about 5% of today's total; what dark matter and dark energy are is unknown. The 2011 Nobel Prize went to Saul Perlmutter, Brian Schmidt and Adam Riess, for finding in 1998 that distant supernovae are fainter than a slowing expansion would allow.</p>`
		},
		// ------------------------------------------------------------------ timeline
		{
			id: 'first-second',
			chapter: 'timeline',
			title: 'One second: ten billion degrees',
			scene: 'timeline',
			hints: { phase: 'second' },
			duration: 26,
			controls: [scrub('tSecond', 1)],
			body: `
<p>Squeezing a gas heats it, and the same goes for the whole universe: run the expansion backward and the temperature rises as 1/<i>a</i>. Today the universe is bathed in light at 2.7 K; when distances were a thousand times smaller it was 2,700 K; a billion times smaller, billions of degrees. The timeline runs from 0.01 s to today, each tick ten times longer than the one before.</p>
<p>At <strong>one second</strong> the universe was at about <strong>10 billion K</strong>, too hot for any atom or nucleus to hold together. It was a soup of light, protons, neutrons, electrons, their antimatter twins the positrons, and neutrinos. Collisions with electrons and neutrinos kept turning protons into neutrons and back, so there were five protons for every neutron (the neutron is slightly heavier, so it is harder to make).</p>
<p>Then the reactions stopped keeping up with the cooling, and that ratio froze. Over the next few minutes, electrons and positrons met and annihilated into light, leaving the small excess of electrons that is still here.</p>`,
			notes: `<p>The temperature is the photons' temperature, computed from the expansion: it falls as 1/<i>a</i> except while the electrons and positrons annihilate (between about 1 and 100 s), which heats the photons. The neutron-to-proton ratio follows the Boltzmann factor e<sup>−Q/kT</sup> (Q = 1.293 MeV, the neutron–proton mass difference) until kT ≈ 0.8 MeV, a textbook estimate of when the reactions stop (B. Ryden, <i>Introduction to Cosmology</i>, ch. 10). Before 0.01 s, other particles (muons and, earlier, quarks and gluons) took part; the model stops there.</p>`
		},
		{
			id: 'helium',
			chapter: 'timeline',
			title: 'The first minutes: helium',
			scene: 'timeline',
			hints: { phase: 'helium' },
			duration: 26,
			controls: [scrub('tHelium', 300)],
			body: `
<p>A free neutron is unstable: it <a href="../radioactivity/#beta">decays into a proton</a> with a mean life of 14.6 minutes. So after the freeze-out the neutrons slowly dwindled, while the universe cooled. A proton and a neutron can stick together as deuterium, but at first the light was hot enough to break every one apart.</p>
<p>At about <strong>4 minutes</strong>, below about 800 million K, deuterium survived, and within moments nearly every remaining neutron was built into <strong>helium-4</strong> nuclei (2 protons + 2 neutrons), where it no longer decays. By then there was about one neutron for every seven protons. Each helium nucleus took two of them, so helium came out at roughly <strong>a quarter of the mass</strong> of ordinary matter, with hydrogen nuclei making up the rest.</p>
<p>That is what astronomers find in the most pristine gas, which no star has processed: 24.5% helium. The Big Bang made almost nothing heavier, just traces of deuterium, helium-3 and lithium. All other elements were made later, in stars.</p>`,
			notes: `<p>The model counts neutrons from the freeze-out at kT ≈ 0.8 MeV (1.2 s) to the moment deuterium survives, taken at kT ≈ 0.07 MeV (4.4 minutes), with the neutron lifetime 878.4 s (Particle Data Group 2024), and puts every remaining neutron into helium. This simple count gives 24.5%; full calculations of all the nuclear reactions give 24.7%, and measurements give Y<sub>P</sub> = 0.245 ± 0.003 (PDG review of Big-Bang nucleosynthesis). The agreement, for a theory with almost no adjustable numbers, is one of the strongest pieces of evidence that the universe really went through this hot phase.</p>`
		},
		{
			id: 'cmb',
			chapter: 'timeline',
			title: 'The oldest light: the microwave background',
			scene: 'timeline',
			hints: { phase: 'cmb' },
			duration: 28,
			controls: [scrub('tCmb', 371_000 * YEAR_S)],
			body: `
<p>For hundreds of thousands of years the universe stayed a glowing <dfn data-def="A gas so hot that electrons are torn off their atoms, leaving charged nuclei and free electrons.">plasma</dfn>. Light could not get far before bouncing off a free electron, so the universe was opaque, like the inside of a cloud.</p>
<p>At about <strong>370,000 years</strong> (often rounded to 380,000), when the temperature dropped to about <strong>3,000 K</strong>, electrons settled onto nuclei to make neutral atoms, and the light was set free. It has travelled ever since. Since then the universe has grown <strong>1,090 times</strong> (z ≈ 1090), and the light has been stretched just as much: from a glow brightest in the near-infrared (975 nm) to <strong>microwaves</strong> peaking at about 1 mm.</p>
<p>That is the <dfn data-def="The light released when the universe became transparent, 370,000 years after the Big Bang, now stretched into microwaves at 2.7255 K and arriving from every direction.">cosmic microwave background</dfn>, found by accident in 1964 by Arno Penzias and Robert Wilson. It arrives from every direction with the spectrum of a perfect glowing body at <strong>2.7255 K</strong> (COBE, Fixsen 2009), exactly what a hot, dense past predicts.</p>`,
			notes: `<p>The timing comes from the expansion model at Planck's z* = 1089.92 (when the light last scattered). The emission was not instant: it took tens of thousands of years either side. The spectrum shown is Planck's law for the temperature at the time you choose: shrinking every wavelength by the stretch factor 1 + z turns today's 2.7255 K spectrum into the 2,970 K one, exactly. The background is the same in every direction to about 1 part in 100,000; the tiny differences, mapped by COBE, WMAP and Planck, are the seeds of all later structure.</p>`
		},
		{
			id: 'first-stars',
			chapter: 'timeline',
			title: 'Dark ages, then the first stars',
			scene: 'timeline',
			hints: { phase: 'stars' },
			duration: 26,
			controls: [scrub('tStars', 300e6 * YEAR_S)],
			body: `
<p>After the light was set free, the universe went dark: the background glow cooled into the infrared, and there were no stars yet. These <strong>dark ages</strong> lasted a hundred million years or more, while gravity slowly pulled the slightly denser regions together, mostly through the pull of dark matter.</p>
<p>The <strong>first stars</strong> are expected to have lit up between about 100 and 180 million years (redshift 30 to 20). None has been seen yet. The James Webb Space Telescope has found galaxies that were already shining at <strong>about 290 million years</strong>: JADES-GS-z14-0, at redshift 14.3, is one of the most distant confirmed.</p>
<p>The ultraviolet light of the first stars and galaxies tore the electrons off the hydrogen again. By about 670 million years (z ≈ 7.7) half of it was ionized, and by a billion years almost all: the universe has stayed that way since.</p>`,
			notes: `<p>The first stars' dates come from simulations (V. Bromm and N. Yoshida, <i>Annual Review of Astronomy and Astrophysics</i> 49, 373, 2011), not observation. JADES-GS-z14-0: S. Carniani et al., <i>Nature</i> 633, 318 (2024), z = 14.32; its age is computed here from the expansion model. The midpoint of reionization, z = 7.67 ± 0.73, is Planck's measurement from how much the freed electrons scatter the microwave background.</p>`
		},
		{
			id: 'today',
			chapter: 'timeline',
			title: '13.8 billion years later',
			scene: 'timeline',
			hints: { phase: 'today' },
			duration: 26,
			controls: [scrub('tToday', AGE * GYR_S)],
			body: `
<p>Galaxies grew by merging and pulling in gas. About <strong>7.7 billion years</strong> in, dark energy began to win and the expansion to speed up. At <strong>9.2 billion years</strong>, a cloud of gas made of the hydrogen and helium of the first minutes, enriched by earlier stars, collapsed into the Sun and the planets: the start of <a href="../deep-time/#whole">Earth's history</a>.</p>
<p>Today, <strong>13.8 billion years</strong> after the Big Bang, the universe is at 2.7 K, and still expanding. Scrub along the timeline: each epoch left a trace we can still observe, from the helium in old stars to the microwave glow on every side.</p>
<p><strong>Space itself is expanding, so every observer sees distant galaxies receding; running the film backward leads to a hot, dense beginning 13.8 billion years ago.</strong></p>`,
			notes: `<p>The age of the universe, 13.797 ± 0.023 billion years, is the Planck fit; this page's model, integrating the same equation with massless neutrinos, gets 13.795. The Sun's age is 4.567 billion years, from the oldest meteorites. It agrees with an independent check: the oldest star clusters in our Galaxy are 12 to 13 billion years old.</p>`
		},
		// ------------------------------------------------------------------ far
		{
			id: 'distances',
			chapter: 'far',
			title: 'How far away is it now?',
			scene: 'distance',
			duration: 28,
			controls: [zFar],
			body: `
<p>JADES-GS-z14-0's light set off 13.5 billion years ago. So is it 13.5 billion light years away? In an expanding universe, “how far” has three answers. When the light left it, the galaxy was only <strong>2.2 billion light years</strong> from the material that became the Milky Way. The light then travelled for <strong>13.5 billion years</strong>, while the space ahead of it kept stretching. The galaxy is now <strong>34 billion light years</strong> away: its <dfn data-def="The distance to something now, measured as if the expansion could be paused. It grows with the expansion.">comoving distance</dfn>.</p>
<p>Choose any redshift. The three bars are computed by integrating the Friedmann equation along the light's path. Nearby they agree; far away they part ways. The microwave background's light set off when its source was just 41 million light years away; that matter is now 45 billion light years away. The <strong>observable universe</strong> is a sphere 46 billion light years in radius, even though nothing has had more than 13.8 billion years to travel.</p>`,
			notes: `<p>No speed limit is broken. Beyond about 14.5 billion light years (c/H₀), distances grow faster than light travels, but nothing moves faster than light <em>through</em> space, the rule of <a href="../special-relativity/#same-light">special relativity</a>; space between the galaxies grows. Light from galaxies receding faster than light can still reach us: the redshift 14.3 galaxy was receding at about five times the speed of light when its light left (and is now receding at 2.3 times). Distances computed from the Planck 2018 parameters. Redshifts on the axis: the Coma cluster (0.023), the quasar 3C 273 (0.158), the galaxy GN-z11 (10.6).</p>`
		}
	]
};
