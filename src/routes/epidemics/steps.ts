import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** How many people each case infects in a fully susceptible crowd. */
const r0: Control = {
	type: 'range',
	id: 'r0',
	label: 'Each case infects (R₀)',
	min: 0.5,
	max: 8,
	step: 0.1,
	default: 3,
	format: (v) => `${v.toFixed(1)} people`,
	help: 'The average number of people one case infects when nobody is immune yet.'
};

/** Mean infectious period. */
const days: Control = {
	type: 'range',
	id: 'days',
	label: 'Infectious for',
	min: 2,
	max: 14,
	step: 1,
	default: 7,
	unit: ' days',
	help: 'How long, on average, a case can pass the disease on before recovering.'
};

/** Share of people immune from the start. */
const vaccinated: Control = {
	type: 'range',
	id: 'vaccinated',
	label: 'Vaccinated',
	min: 0,
	max: 95,
	step: 5,
	default: 0,
	unit: '%',
	help: 'In this model, vaccinated people (hollow rings) cannot catch or pass on the disease.'
};

/** Restarts the crowd with a different random seed. */
const rerun: Control = {
	type: 'action',
	id: 'rerun',
	label: 'Run again',
	action: 'Run again',
	help: 'Same settings, different luck: who meets whom is random.'
};

export const spec: ExplainerSpec = {
	slug: 'epidemics',
	title: 'How epidemics spread — and how they stop',
	summary:
		'Release a few cases into a crowd and watch an outbreak grow, peak and fade. Then find out how many people need to be immune to stop it before it starts.',
	chapters: [
		{ id: 'spread', title: 'How an outbreak grows' },
		{ id: 'sir', title: 'The shape of an epidemic' },
		{ id: 'herd', title: 'Herd immunity' }
	],
	steps: [
		// ------------------------------------------------------------------ spread
		{
			id: 'outbreak',
			chapter: 'spread',
			title: 'A few cases in a crowd',
			scene: 'crowd',
			hints: { view: 'full', initial: 3, seed: 4 },
			duration: 22,
			controls: [rerun],
			body: `
<p>Here are 300 people going about their lives. Three of them have just caught a contagious disease. Every person is in one of three states:</p>
<ul>
<li><strong class="tag s">Susceptible</strong> — never had it, so they can catch it;</li>
<li><strong class="tag i">Infectious</strong> — ill, and able to pass it on;</li>
<li><strong class="tag r">Recovered</strong> — had it, and are now immune.</li>
</ul>
<p>The chart counts how many people are in each state, day by day. Watch: the red curve creeps along for a while, then shoots up, peaks, and falls back to zero — while some people never catch it at all.</p>
<p>Nobody in this crowd decides anything. The rise and the fall both come from a couple of simple rules, and this page builds them up one at a time.</p>`,
			notes: `<p>This is a <dfn data-def="A model that simulates individual people (agents) and the random events between them, rather than only counting totals.">stochastic, agent-based</dfn> version of the classic <strong>SIR model</strong>, which grew out of work by William Kermack and Anderson McKendrick in 1927. (In the original model, R stands for “removed”: recovered and immune, or dead.) "Stochastic" means chance is built in: press <em>Run again</em> and the same rules give a slightly different outbreak.</p>`
		},
		{
			id: 'contacts',
			chapter: 'spread',
			title: 'Meeting people, passing it on',
			scene: 'crowd',
			hints: { view: 'case', initial: 1, seed: 150, pace: 1 },
			duration: 24,
			controls: [rerun],
			body: `
<p>Follow the first case, circled. While infectious it keeps meeting people — four a day in this model. Each line is a meeting. Most meetings pass nothing on; now and then one does, and a blue dot turns red.</p>
<p>Three things decide how many people one case infects:</p>
<ul>
<li>how many people they meet each day;</li>
<li>how likely each meeting is to pass the disease on — that depends on the disease, and on things like distance, masks and fresh air;</li>
<li>how many days they stay infectious. Recovery here is random: some cases are infectious for a day, some for a couple of weeks.</li>
</ul>
<p>Multiply the three together — meetings per day × chance per meeting × days infectious — and you get the average number of people one case infects. Press <em>Run again</em> to follow a different first case: some infect nobody, some infect many.</p>`,
			notes: `<p>To keep the model simple, anyone can meet anyone: a person's next contact is picked at random from the whole crowd, wherever they are standing. Epidemiologists call this a <dfn data-def="A population in which every individual is equally likely to contact every other. It is the assumption behind the classic SIR equations.">well-mixed</dfn> population. Real contacts cluster in households, classrooms and workplaces, which slows spread down because people keep meeting the same, already-exposed people. The dots wander only so you can tell them apart.</p>
<p>In this model the chance that one meeting passes the disease on is worked out from the number on the next step, R<sub>0</sub>: chance = R<sub>0</sub> / (4 meetings a day × D days infectious), so that on average each case infects exactly R<sub>0</sub> people in a crowd where everyone is susceptible.</p>`
		},
		{
			id: 'r0',
			chapter: 'spread',
			title: 'R₀: the number that decides',
			scene: 'tree',
			hints: { phase: 'tree' },
			duration: 18,
			controls: [r0],
			body: `
<p>Boil it down to one number: the average count of people a single case infects in a population where nobody is immune yet. This is the <dfn data-def="Basic reproduction number, read “R-nought”: the average number of secondary cases caused by one case in a fully susceptible population.">basic reproduction number</dfn>, <strong>R<sub>0</sub></strong>.</p>
<p>The tree shows what it means, generation by generation. With R<sub>0</sub> = 3, one case leads to 3, then 9, then 27, then 81. Each generation is R<sub>0</sub> times the one before.</p>
<p>Now drag R<sub>0</sub> below 1. Each generation is <em>smaller</em> than the last, and the chain of infections fizzles out on its own. Whether an outbreak can take off hinges on whether this number is above or below one.</p>`,
			notes: `<p>R<sub>0</sub> is not a fixed property of a germ: it also depends on how people live — how many people they meet and how closely. Published estimates for real diseases vary between places and studies. Seasonal flu spreads with a reproduction number of about 1.3 (median of 47 estimates reviewed by Biggerstaff et al., <i>BMC Infectious Diseases</i>, 2014); many people already have some immunity to flu, so this is lower than a true R<sub>0</sub> would be. Measles, among the most contagious diseases known, is often quoted at 12–18, although estimates range much more widely (Guerra et al., <i>The Lancet Infectious Diseases</i>, 2017).</p>
<p>The tree draws averages: each case has either the whole number just below R<sub>0</sub> or the one just above, mixed so that the average is R<sub>0</sub>. Real numbers of secondary cases vary far more — many cases infect nobody and a few infect many.</p>`
		},
		{
			id: 'exponential',
			chapter: 'spread',
			title: 'Exponential growth',
			scene: 'tree',
			hints: { phase: 'growth' },
			duration: 18,
			controls: [r0, days],
			body: `
<p>Multiplying by the same factor again and again is <dfn data-def="Growth in which a quantity is multiplied by the same factor in each equal interval of time, so it doubles at regular intervals.">exponential growth</dfn>. The first few generations look harmless — 1, 3, 9 — which is why early outbreaks are easy to underestimate. Ten generations after the first case, at R<sub>0</sub> = 3, it would be 59,049 new cases.</p>
<p>How fast the generations come depends on the infectious period. The chart turns generations into days: while almost everyone is still susceptible, the number of cases doubles every so many days, a fixed <strong>doubling time</strong>, whatever the size of the outbreak.</p>
<p>A larger R<sub>0</sub> makes the doublings come faster; so does a shorter infectious period with R<sub>0</sub> held fixed, because the same number of infections is packed into fewer days. Below R<sub>0</sub> = 1 there is a halving time instead.</p>`,
			notes: `<p>In the SIR model, while almost everyone is susceptible, the number infectious grows as <i>e</i><sup><i>rt</i></sup> with growth rate <i>r</i> = (R<sub>0</sub> − 1) / D per day, where D is the mean infectious period. The doubling time is ln 2 / <i>r</i> ≈ 0.69 D / (R<sub>0</sub> − 1). With R<sub>0</sub> = 3 and D = 7 days, that is about 2.4 days.</p>`
		},
		// ------------------------------------------------------------------ sir
		{
			id: 'compartments',
			chapter: 'sir',
			title: 'Three boxes and two arrows',
			scene: 'sir',
			hints: { phase: 'boxes' },
			duration: 20,
			controls: [r0, days],
			body: `
<p>Forget the individual dots for a moment and count people instead. Everyone is in one of three boxes, and there are only two ways to move:</p>
<ul>
<li><strong>S → I</strong>, infection. Its speed depends on how often infectious and susceptible people meet: it is fastest when there are many of both.</li>
<li><strong>I → R</strong>, recovery. Each day, about one in D of the infectious recovers.</li>
</ul>
<p>That is the whole <strong>SIR model</strong>. Watch the boxes fill and empty: early on, infections far outpace recoveries; later, they cannot keep up, because there are hardly any susceptible people left to infect.</p>`,
			notes: `<p>As equations, with N people, β = R<sub>0</sub>/D and γ = 1/D:</p>
<p class="formula">dS/dt = −β S I / N &nbsp;&nbsp; dI/dt = β S I / N − γ I &nbsp;&nbsp; dR/dt = γ I</p>
<p>The boxes here are this deterministic version, solved numerically. The crowd on the other steps is its random, person-by-person counterpart: in a large crowd the two agree closely.</p>`
		},
		{
			id: 'curves',
			chapter: 'sir',
			title: 'Rise, peak and fall',
			scene: 'crowd',
			hints: { view: 'full', initial: 3, seed: 21 },
			duration: 24,
			controls: [r0, days, rerun],
			body: `
<p>Back to the crowd, now with full control. The three curves always tell the same story: susceptible people (blue) are used up; the infectious (red) rise to a peak and fall; the recovered (grey) pile up.</p>
<p>Try a few settings:</p>
<ul>
<li>raise R<sub>0</sub>: the peak comes sooner, is higher, and fewer people escape;</li>
<li>lower it towards 1: a long, low wave — or none at all;</li>
<li>change only the infectious period, keeping R<sub>0</sub> the same (the page lowers the chance per meeting to make up for it): the epidemic plays out faster or slower, but about the same number of people catch it in the end.</li>
</ul>`
		},
		{
			id: 'peak',
			chapter: 'sir',
			title: 'Why the outbreak turns around',
			scene: 'sir',
			hints: { phase: 'peak' },
			duration: 20,
			controls: [r0, days],
			body: `
<p>Left to itself, an outbreak does not turn around because the germ weakens. It turns around because it runs short of people who can still catch it.</p>
<p>R<sub>0</sub> counts infections in a crowd where everyone is susceptible. Later, only some of the people a case meets can still catch it, so each case causes fewer new ones: the <dfn data-def="The average number of people each case infects at a given time, once some of the population is immune.">effective reproduction number</dfn>, R, drops. In this model <strong>R = R<sub>0</sub> × (share still susceptible)</strong>.</p>
<p>The lower chart tracks it. While R is above 1, cases increase. The moment the susceptible share falls to 1/R<sub>0</sub>, R crosses 1 — and that is exactly the peak. From then on each case is replaced by less than one, and the outbreak shrinks.</p>`
		},
		{
			id: 'overshoot',
			chapter: 'sir',
			title: 'It overshoots',
			scene: 'sir',
			hints: { phase: 'final' },
			duration: 20,
			controls: [r0],
			body: `
<p>At the peak, plenty of people are still infectious, and each of them still infects someone. So the epidemic keeps going downhill for a long time, pushing the susceptible share well below 1/R<sub>0</sub>.</p>
<p>The shaded part is that <strong>overshoot</strong>: people infected after the outbreak had already started to shrink. With R<sub>0</sub> = 3, the peak comes when a third of people are still susceptible, yet in the end only about 6% escape.</p>
<p>For a given R<sub>0</sub>, the final count does not depend on how long cases stay infectious.</p>`,
			notes: `<p>In the SIR model the share who escape infection, s<sub>∞</sub>, solves the <dfn data-def="The equation relating the total size of an SIR epidemic to R₀; it has no simple closed-form solution and is solved numerically.">final-size equation</dfn> s<sub>∞</sub> = e<sup>−R<sub>0</sub>(1 − s<sub>∞</sub>)</sup>. For R<sub>0</sub> = 2 about 80% are eventually infected; for R<sub>0</sub> = 3, about 94%.</p>`
		},
		{
			id: 'chance',
			chapter: 'sir',
			title: 'Small beginnings are fragile',
			scene: 'runs',
			duration: 22,
			controls: [r0, rerun],
			body: `
<p>Here is the same crowd run 40 times, each starting from a single case, each with different luck. Every line is one run's infectious count (on a log scale, so that a single case is visible).</p>
<p>Many runs never take off. If the first case recovers before passing it on — or infects one person who does the same — the chain breaks while it is tiny. In this model a single case fizzles out with a chance of about 1 in R<sub>0</sub>: half the time when R<sub>0</sub> = 2.</p>
<p>But a run that survives its first few generations behaves predictably: it grows into a full outbreak of almost the same size — at least once R<sub>0</sub> is well above 1. Chance matters most at the very beginning, when cases are few.</p>`,
			notes: `<p>This follows from treating the early outbreak as a branching process. With an exponentially distributed infectious period (most cases recover early, a few stay infectious much longer), the number of people a case infects follows a geometric distribution with mean R<sub>0</sub> (zero is the most likely count, and large counts are rare but possible), and the probability that the chain of infections dies out is 1/R<sub>0</sub>. With other distributions the number differs — if every case were infectious for exactly the same time, it would be lower — but the lesson holds: early extinction is common, and it gets less likely with each extra initial case.</p>`
		},
		// ------------------------------------------------------------------ herd
		{
			id: 'vaccination',
			chapter: 'herd',
			title: 'Vaccinating part of the crowd',
			scene: 'crowd',
			hints: { view: 'full', initial: 3, seed: 31 },
			duration: 24,
			controls: [vaccinated, r0, rerun],
			body: `
<p>In this model the vaccine works perfectly: a vaccinated person (a hollow ring) cannot catch the disease, so they cannot pass it on. A meeting with them is a dead end for the infection.</p>
<p>Slide the vaccinated share up, a step at a time. At first the outbreak just gets smaller and slower. Then, from about 70% for R<sub>0</sub> = 3, something changes: the chains of infection die out after a handful of cases — sometimes a few dozen — and the outbreak never takes off.</p>
<p>Notice who is protected: not only the vaccinated, but most of the <em>unvaccinated</em> too. That is <dfn data-def="Indirect protection of people who are not immune, because the people around them are.">herd immunity</dfn>.</p>`
		},
		{
			id: 'threshold',
			chapter: 'herd',
			title: 'The herd-immunity threshold',
			scene: 'threshold',
			duration: 20,
			controls: [r0, vaccinated],
			body: `
<p>Vaccination lowers the starting point: if a share <i>v</i> of people are immune, each case infects R<sub>0</sub> × (1 − <i>v</i>) people instead of R<sub>0</sub>. An outbreak cannot grow once that is below 1, which happens when</p>
<p class="formula"><strong>immune share above 1 − 1/R<sub>0</sub></strong></p>
<p>That is the <strong>herd-immunity threshold</strong>, the curve on the chart: 50% for R<sub>0</sub> = 2, 67% for 3, 90% for 10. The more contagious the disease, the closer to everyone you need.</p>
<p>Move the point around. Below the curve an outbreak can still take off (the readout shows how many would be infected); above it, chains of infection die out.</p>`,
			notes: `<p>Vaccines are not perfect, so the share that must be <em>vaccinated</em> is higher than the share that must be <em>immune</em>: divide the threshold by the vaccine's effectiveness. For measles, with R<sub>0</sub> often put at 12–18, the threshold is above 90%, which is why the World Health Organization aims for 95% coverage with two doses.</p>
<p>The threshold also assumes immunity is spread evenly: the coverage has to hold in every community, because pockets of unvaccinated people can still sustain an outbreak. And it is about stopping <em>growth</em>. Below it, vaccination still helps a great deal: every immune person makes the outbreak smaller. See Fine, Eames &amp; Heymann, “Herd immunity: a rough guide”, <i>Clinical Infectious Diseases</i>, 2011.</p>`
		},
		{
			id: 'realworld',
			chapter: 'herd',
			title: 'Real outbreaks are messier',
			scene: 'crowd',
			hints: { view: 'full', initial: 3, seed: 41 },
			duration: 30,
			controls: [r0, days, vaccinated, rerun],
			body: `
<p>Everything is yours to set now. The model captures the core of many epidemics: exponential growth while each case infects more than one person, and a turn once enough people are immune.</p>
<p>Real outbreaks add complications the model leaves out:</p>
<ul>
<li>people change their behaviour as cases rise, which lowers R before immunity does;</li>
<li>contacts cluster, and a few people spread far more than others;</li>
<li>immunity can fade, and germs can change, so some diseases come back in waves;</li>
<li>people are born, die and travel.</li>
</ul>
<p>Epidemiologists add those to the same three boxes. The two lessons stay: keep R below 1, and the more contagious a disease, the more immunity it takes to hold it there.</p>`
		}
	]
};
