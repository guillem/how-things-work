import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Releases the virus again in the tissue scene (restarts the run from day 0). */
const release: Control = {
	type: 'action',
	id: 'release',
	label: 'Release the virus',
	action: 'Release the virus',
	help: 'Replays the first infection from day 0, in a body that has never met this virus.'
};

/** Plays a second infection, six months after the first, in the tissue scene. */
const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Infect again, six months later',
	action: 'Infect again, six months later',
	help: 'The same virus and dose, in the same body: now memory cells are waiting.'
};

/** The innate response on the "stand-off" step (its own id, so it does not carry over). */
const innate1: Control = {
	type: 'toggle',
	id: 'innate1',
	label: 'Innate response (interferon, NK cells)',
	default: true
};

/** The adaptive response on the "stand-off" step: off, which is the point of the step. */
const adaptive1: Control = {
	type: 'toggle',
	id: 'adaptive1',
	label: 'Adaptive response (B and T cells)',
	default: false
};

const innate: Control = { ...innate1, id: 'innate' };
const adaptive: Control = { ...adaptive1, id: 'adaptive', default: true };

/** Day of the second infection. */
const reinfect: Control = {
	type: 'range',
	id: 'reinfect',
	label: 'Second infection',
	min: 20,
	max: 365,
	step: 5,
	default: 180,
	format: (v) => `${v} days after the first`,
	help: 'The same virus, at the same dose. Antibodies left over from the first infection slowly fade.'
};

export const spec: ExplainerSpec = {
	slug: 'immune-system',
	title: 'How the immune system fights an infection — and remembers it',
	summary:
		'Release a flu virus into the lining of the airways and watch the fast, general alarm hold it back while a few B and T cells whose receptors happen to fit it multiply. Then infect the same body again and compare.',
	chapters: [
		{ id: 'innate', title: 'The first line of defence' },
		{ id: 'adaptive', title: 'A library of receptors' },
		{ id: 'memory', title: 'Remembering' }
	],
	steps: [
		// ------------------------------------------------------------------ innate
		{
			id: 'invasion',
			chapter: 'innate',
			title: 'A virus lands in the airway',
			scene: 'tissue',
			hints: { view: 'invasion' },
			duration: 20,
			body: `
<p>Every breath brings dust, bacteria and viruses into your airways. Most never get further: the airways are lined by a sheet of cells coated in sticky <strong>mucus</strong> that traps particles, and tiny hairs, the <dfn data-def="Hair-like extensions of the cells lining the airways. They beat in waves about 10–15 times a second and carry mucus up towards the throat.">cilia</dfn>, sweep it up to the throat to be swallowed. Skin, stomach acid and tears are barriers of the same kind.</p>
<p>A flu virus that gets through the mucus sticks to a cell of the lining and gets itself taken in. It has no machinery of its own: it is a few genes in a protein coat. Inside, the cell’s own <a href="../the-cell/#ribosomes">ribosomes</a> read the viral genes and build new viral proteins, and within hours the cell releases hundreds of new viruses, each able to infect another cell.</p>
<p>So the infection grows the way an <a href="../epidemics/#exponential">epidemic grows</a>, but among cells: each infected cell infects several more. Watch the infected cells (red) multiply.</p>`,
			notes: `<p>Flu viruses bind with their spike protein, haemagglutinin, to sialic acid sugars on the surface of the cells lining the nose, throat and lungs; the cell takes the virus in, and the viral genes (eight pieces of RNA) go to the nucleus to be copied. A cell starts releasing new virus about 6 hours after infection and lives about 11 hours in all (Baccam et al., <i>Journal of Virology</i>, 2006, from volunteers infected with flu).</p>`
		},
		{
			id: 'innate',
			chapter: 'innate',
			title: 'The alarm: innate immunity',
			scene: 'tissue',
			hints: { view: 'innate' },
			duration: 22,
			body: `
<p>Infected cells notice the intruder. Sensors inside them recognise molecules that only viruses make, such as their kind of RNA, and the cell sends out an alarm: <dfn data-def="Signalling proteins released by infected cells. Neighbouring cells that receive them switch on antiviral defences; interferons also call in and activate immune cells.">interferon</dfn>.</p>
<p>The alarm does two things. Healthy neighbours that receive it switch on antiviral defences and become <strong>resistant</strong> (blue) for a while, so the virus cannot multiply in them. And it activates <dfn data-def="Immune cells that kill body cells showing signs of infection or stress, without needing to have met the pathogen before.">natural killer cells</dfn>, which kill infected cells before they release more virus. Other cells, <dfn data-def="Large white blood cells that swallow and digest pathogens and debris; they also raise the alarm with signalling proteins.">macrophages</dfn> and <dfn data-def="The most common white blood cells; they rush from the blood into infected tissue within hours and swallow pathogens.">neutrophils</dfn>, swallow virus and debris. The swelling, heat and fever of an infection are part of this response.</p>
<p>This is <dfn data-def="The defences we are born with: barriers, alarm signals and immune cells that recognise features shared by many pathogens. Fast (hours), but the same every time.">innate immunity</dfn>. It is fast, within hours, and general: it reacts to <em>any</em> virus in much the same way, because it looks for features that many viruses share.</p>`,
			notes: `<p>The sensors are pattern-recognition receptors: for example RIG-I, which detects the short double-stranded ends of viral RNA, and Toll-like receptors, which detect viral RNA and bacterial cell-wall molecules. Each kind recognises a feature shared by a whole class of pathogens. The innate response also includes the complement proteins of the blood, which punch holes in bacteria and tag them for swallowing. The model on this page includes the two effects of interferon described here (resistant cells and NK killing), with rates that Cao et al. took from Pawelek et al.’s study of flu in horses (<i>PLoS Computational Biology</i>, 2012).</p>`
		},
		{
			id: 'standoff',
			chapter: 'innate',
			title: 'A stand-off',
			scene: 'course',
			hints: { case: 'standoff' },
			duration: 26,
			controls: [innate1, adaptive1],
			body: `
<p>This is the model behind the page, followed for a month. The top chart shows the virus on a <dfn data-def="Each gridline is ten times the one below it, so that numbers from 1 to a billion fit on one chart and steady multiplication shows as a straight line.">logarithmic scale</dfn>; the gauge on the left shows the lining of the airway.</p>
<p>Here the body has only its innate response. For a day and a half the virus multiplies a thousandfold. Then the interferon alarm catches up and holds it: virus is still being made, but no faster than it is destroyed. The innate response protects most of the lining, but it <strong>cannot clear</strong> the virus: the stand-off lasts as long as you watch.</p>
<p>Switch the innate response off too: the virus climbs a hundred times higher and infects the whole lining within three days. Then switch the adaptive response on, and see how the story ends.</p>`,
			notes: `<p>Without interferon this model runs out of cells to infect: the virus stops only because it has destroyed its target, as in the simplest models of viral infection. With interferon, most cells are spared, and something else has to finish the virus off. In the model the lining cannot grow back once every cell is gone, because new cells come only from surviving ones; real airways also rebuild from stem cells underneath. People whose adaptive immune system does not work, for example after some cancer treatments or transplants, can indeed stay infected with flu for weeks or months (Memoli et al., <i>Clinical Infectious Diseases</i>, 2014).</p>`
		},
		// ------------------------------------------------------------------ adaptive
		{
			id: 'receptors',
			chapter: 'adaptive',
			title: 'Billions of different receptors, made in advance',
			scene: 'library',
			hints: { view: 'library' },
			duration: 22,
			body: `
<p>The second line of defence is built on a different idea. Its cells are <dfn data-def="White blood cells of the adaptive immune system: B cells, which make antibodies, and T cells, which kill infected cells or coordinate the response.">lymphocytes</dfn>: <strong>B cells</strong> and <strong>T cells</strong>. Each one carries on its surface many copies of a single <dfn data-def="A protein on the surface of a B or T cell that binds one particular molecular shape, its antigen. Every lymphocyte carries its own.">receptor</dfn>, and every cell’s receptor has a <em>different</em> shape.</p>
<p>The receptors are not designed for any particular enemy. While each lymphocyte matures, it builds its receptor gene by cutting and joining pieces chosen at random from a few hundred gene segments, and the joints are trimmed and padded at random too. The result is a vast library of shapes. An adult has at least <strong>100 million</strong> different T-cell receptors, and a similarly vast range of B-cell receptors.</p>
<p>Before they are released, young lymphocytes whose receptor fits the body’s own molecules are mostly eliminated, so the library is tuned to <em>not</em> recognise you. Everything else is kept, just in case.</p>`,
			notes: `<p>The joining of gene segments is called V(D)J recombination. A B-cell receptor heavy chain is built from one of about 40 working V segments, one of 23 D and one of 6 J; its light chain from about 40 V and 5 J (κ) or 30 V and 4 J (λ). That alone gives a few million combinations, and the random trimming and adding of letters at the joints multiplies it many times over. The figure of at least 100 million different T-cell receptor β chains in the naive T cells of a young adult is a lower bound from sequencing (Qi et al., <i>PNAS</i>, 2014). The removal of self-reactive T cells happens in the thymus, of B cells in the bone marrow; when it fails, the immune system can attack the body itself.</p>`
		},
		{
			id: 'match',
			chapter: 'adaptive',
			title: 'The virus picks its opponents',
			scene: 'library',
			hints: { view: 'match' },
			duration: 22,
			body: `
<p>Meanwhile, <dfn data-def="Cells that pick up pieces of pathogens in the tissues, carry them to a lymph node, and show them to T cells.">dendritic cells</dfn> in the infected tissue swallow pieces of virus and carry them to the nearest <dfn data-def="Small organs along the lymph vessels, where lymphocytes gather and meet pieces of pathogens brought from the tissues.">lymph node</dfn>, where B and T cells pass through by the million. There the viral pieces are shown to them.</p>
<p>Almost every lymphocyte ignores them: its receptor does not fit. Only the rare few whose receptor happens to bind a piece of this virus are switched on. For any one piece, roughly one naive killer T cell in a hundred thousand fits it, give or take a factor of ten either way. Nobody made those cells for this virus: the virus <strong>selected</strong> them from what was already there.</p>
<p>In the model, about 100 matching T cells and 100 matching B cells start the response, out of millions.</p>`,
			notes: `<p>Counting human naive killer (CD8⁺) T cells that bind one viral or tumour fragment gives between about 0.6 in a million and 1 in 8,000 depending on the fragment, similar from person to person (Alanio et al., <i>Blood</i>, 2010). A whole virus offers many fragments, so many such small groups respond at once. T cells see the fragments only when another cell displays them on its surface (on molecules called MHC); B cells can bind intact viral proteins directly. Most B cells also need a signal from a matching <em>helper</em> T cell before they make antibodies; the helper cells are left out of the model.</p>`
		},
		{
			id: 'expand',
			chapter: 'adaptive',
			title: 'Multiplying the few that fit',
			scene: 'library',
			hints: { view: 'expand' },
			duration: 24,
			body: `
<p>A lymphocyte that has been switched on starts dividing, and its daughters divide again: one cell becomes 2, 4, 8, 16… All of them carry the same receptor, so the response is a growing <dfn data-def="A group of cells descended from one cell, and so carrying the same receptor.">clone</dfn> of exactly the cells that fit. This is <dfn data-def="The rapid multiplication of the few lymphocytes whose receptor matches a pathogen, which turns a handful of cells into an army.">clonal expansion</dfn>.</p>
<p>It takes time. In the model each recruited T cell turns into about <strong>1,300</strong> killer T cells over 6 days of dividing, maturing and travelling to the infected tissue, so the 100 cells that fit become about <strong>60,000</strong> killers at the peak, on day 7 or 8. The B cells meanwhile mature into <dfn data-def="Mature B cells that do nothing but make antibodies, thousands of molecules a second.">plasma cells</dfn> that pour out antibodies from about day 5.</p>
<p>That week is why you feel ill for days: the targeted response needs time to grow.</p>`,
			notes: `<p>In the model of Cao et al. (<i>Frontiers in Immunology</i>, 2016), which drives the charts on this page, a recruited naive T cell yields e<sup>1.2 × 6</sup> ≈ 1,300 effector cells after 6 days, the delay measured for killer T cells to reach the infected lungs of mice (Lawrence et al., 2005). Activated T cells can divide as often as every 6–8 hours, but some of the daughters die and the first division takes a day or more, so the average rate is lower.</p>`
		},
		{
			id: 'weapons',
			chapter: 'adaptive',
			title: 'Two weapons: killer cells and antibodies',
			scene: 'antibody',
			duration: 22,
			body: `
<p>The expanded clones fight in two ways.</p>
<ul>
<li><strong>Killer T cells</strong> find infected cells, which display fragments of the viral proteins they are making on their surface, and kill them before the virus inside is finished. They act <em>inside</em> the tissue, on the virus factories.</li>
<li><strong>Antibodies</strong> are the B cells’ receptor, released in bulk: Y-shaped proteins with two identical tips that grip the virus. Antibodies stuck to a virus’s spikes stop it from attaching to a cell, and mark it to be swallowed. They act on the virus <em>outside</em> cells.</li>
</ul>
<p>The shapes on the left are traced from real structures, atom by atom, at true size: an antibody is about 17 nm across, and a flu virus about 100 nm. With its two arms, one antibody can hold two spikes at once.</p>`,
			notes: `<p>The first antibodies a plasma cell makes are <strong>IgM</strong>: five Ys joined together, good at grabbing but short-lived. Over the following weeks, B cells switch to <strong>IgG</strong> (and, in the airways, IgA), whose tips also become a better fit through rounds of mutation and selection in the lymph nodes (affinity maturation). The model has one short-lived and one long-lived antibody to stand for them. The antibody outline is PDB 1IGT (Harris et al., <i>Biochemistry</i>, 1997), a complete mouse IgG2a antibody; the spike is the flu haemagglutinin, PDB 1RU7 (Gamblin et al., <i>Science</i>, 2004).</p>`
		},
		{
			id: 'battle',
			chapter: 'adaptive',
			title: 'Watch the whole fight',
			scene: 'tissue',
			hints: { view: 'battle' },
			duration: 30,
			controls: [release, again],
			body: `
<p>Now everything together, day by day. Release the virus and watch the tissue: in the first two days infected cells multiply; the interferon alarm turns neighbours resistant and NK cells start killing; then for a few days nothing seems to change.</p>
<p>Out of sight, in the lymph node, the few matching B and T cells are multiplying. From day 5 antibodies arrive and catch free virus; from day 6 killer T cells pour in and kill infected cells. By day 9 the virus is gone.</p>
<p>Then infect the same body again, six months later, and compare: the memory cells in the lymph node switch on, and the virus is gone in about five days.</p>
<p>The counters on the left come from the model. Resistant and lost cells are drawn in proportion: each cell of the lining in the picture stands for about three million real ones. Infected cells, virus particles, killer T cells and antibodies are drawn on a logarithmic scale, because their numbers change a millionfold: a few more appear each time the real number grows tenfold. The natural killer cells follow the strength of the interferon alarm.</p>`,
			notes: `<p>The order of events matches real flu: in volunteers infected with flu the virus in nasal washes peaks on day 2–3 and is undetectable by day 7 or 8 (Baccam et al., 2006). The model's numbers come from mice, whose flu runs a similar course.</p>`
		},
		{
			id: 'course',
			chapter: 'adaptive',
			title: 'Three phases',
			scene: 'course',
			hints: { case: 'primary' },
			duration: 26,
			controls: [innate, adaptive],
			body: `
<p>The same infection as charts. The virus climbs for a day and a half; the innate response holds it on a plateau; around day 5 the adaptive response arrives and it falls, a millionfold in five days. It is gone on day 9, and at worst only about a seventh of the lining was infected or lost.</p>
<p>Look at the lower charts. Killer T cells rise from nothing to tens of thousands in two days and then, once their job is done, die off over the next two weeks. Antibodies come in two waves: a short-lived kind first, then a long-lived kind that is still high a month later.</p>
<p>Switch either response off and compare. Innate immunity buys time and protects the tissue; adaptive immunity finishes the job.</p>`,
			notes: `<p><strong>The model.</strong> The charts follow the equations and parameters of Cao, Wang, Yan, McVernon, Xu, Heffernan, Kedzierska &amp; McCaw, “On the role of CD8⁺ T cells in determining recovery time from influenza virus infection”, <i>Frontiers in Immunology</i> 7:611 (2016). It tracks the cells of the airway lining (healthy, infected, resistant), free virus, interferon, the naive T and B cells that fit the virus, killer T cells, plasma cells, and a short- and a long-lived antibody. The authors calibrated it to measurements in mice infected with an H3N2 flu virus (Miao et al., <i>Journal of Virology</i>, 2010). <strong>Simplifications:</strong> the numbers are for a mouse, not a person; cells are well mixed (no space); there are no helper T cells, no fever or symptoms; virus is in egg-infectious doses per mL, antibodies in pg/mL. The virus counts as cleared below 1 dose per mL, and once less than one infected cell is left the infection is over (otherwise a continuous model keeps a vanishing trace of virus that could regrow months later).</p>`
		},
		// ------------------------------------------------------------------ memory
		{
			id: 'memory',
			chapter: 'memory',
			title: 'Most die; some remember',
			scene: 'library',
			hints: { view: 'memory' },
			duration: 22,
			body: `
<p>When the virus is gone, the army is not needed any more. Within a week more than nine in ten of the killer T cells die, and the short-lived plasma cells with them.</p>
<p>But not all. About one in twenty of the expanded T cells stays on as a <dfn data-def="A long-lived lymphocyte left over from an earlier response. It carries the same receptor and responds faster and more strongly when it meets the same pathogen again.">memory cell</dfn>, and memory B cells and long-lived plasma cells remain too. In the model that leaves about <strong>3,000</strong> memory T cells: thirty times more than the 100 naive cells that fitted the virus at the start. And they react faster. Some long-lived plasma cells keep making antibodies, so the blood stays armed for a while.</p>
<p>The library has changed. The rare shape that fitted this virus is now common.</p>`,
			notes: `<p>That 5–10% of the expanded killer T cells survive as memory cells is a common finding (Harty &amp; Badovinac, <i>Nature Reviews Immunology</i>, 2008). Cao et al. use 5% for their memory simulations. Memory T cells start dividing sooner and produce effector cells faster than naive ones (Veiga-Fernandes et al., <i>Nature Immunology</i>, 2000). In people, long-lived plasma cells in the bone marrow can keep antibody levels up for decades: the half-lives of antibodies to mumps and measles are estimated at hundreds to thousands of years (Amanna, Carlson &amp; Slifka, <i>New England Journal of Medicine</i>, 2007).</p>`
		},
		{
			id: 'second',
			chapter: 'memory',
			title: 'The second time',
			scene: 'course',
			hints: { case: 'second' },
			duration: 30,
			controls: [reinfect],
			body: `
<p>Now the same virus infects the same body again. The charts overlay the two infections, each counted from its own day 0: faint for the first, bold for the second.</p>
<p>Six months later, the antibodies left from the first infection have faded to a tenth, too few to stop the virus, and it starts to grow. But this time memory cells meet it: thirty times more of them, starting a day sooner and multiplying faster. The virus is gone in about 5 days instead of 9, before it ever reaches the level of the first infection, and the new response is <strong>far larger</strong>: over a hundred times more killer T cells and about twenty times more antibody, sooner.</p>
<p>Move the second infection earlier. Within about three months of the first, the leftover antibodies catch the virus before it can grow at all: you would not even notice.</p>`,
			notes: `<p><strong>How memory is modelled.</strong> Cao et al. extend their model with memory killer T cells that start a day sooner (5 days instead of 6) and produce effectors 1.5 times faster, and whose number is 5% of the first infection's peak. They do not model B-cell memory; we gave B cells memory by the same rules, which is our addition. In this model antibodies fade with the half-life the authors fitted over the first weeks, about 46 days. In people, long-lived plasma cells usually keep them at a plateau for years, and most second flu infections happen because the virus has changed its coat, so that old antibodies fit it less well. Vaccines work by giving the body a first, harmless meeting: see <a href="../mrna-vaccines/">vaccines and mRNA</a>.</p>`
		},
		{
			id: 'recap',
			chapter: 'memory',
			title: 'Make many, multiply the few, remember',
			scene: 'library',
			hints: { view: 'recap' },
			duration: 22,
			body: `
<p>The whole adaptive immune system rests on three moves, side by side in the picture:</p>
<ol>
<li><strong>Make a vast range of receptors in advance</strong>, at random, without knowing what will come;</li>
<li><strong>multiply the few that fit</strong> whatever arrives, so the response is aimed exactly at it;</li>
<li><strong>keep some of them as memory</strong>, so the next time starts from a bigger, faster force.</li>
</ol>
<p>When one of these goes wrong, we get disease. If the library is not cleared of receptors that fit the body itself, the immune system attacks its own tissue: in <a href="../homeostasis/#type1">type 1 diabetes</a> it destroys the insulin-making cells. If it overreacts to something harmless, like pollen, we get allergy. And HIV destroys the helper T cells that coordinate the response, leaving the body open to infections it would normally clear.</p>
<p>Memory is also why vaccines work: they show the immune system a harmless piece of a pathogen, so that the memory is already in place when the real one arrives. Vaccinate enough people and an epidemic cannot spread: <a href="../epidemics/#threshold">herd immunity</a>.</p>`
		}
	]
};
