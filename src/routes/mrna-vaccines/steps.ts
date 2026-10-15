import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** The vaccine's letter U as made by the cell, or the modified letter of the real vaccines. */
const modified: Control = {
	type: 'toggle',
	id: 'modified',
	label: 'Modified letters (N1-methylpseudouridine)',
	default: true,
	help: 'Switch off to make the message with ordinary U, as the first experimental mRNAs were.'
};

/** The two prolines that hold the spike in its "before" shape. */
const prolines: Control = {
	type: 'toggle',
	id: 'prolines',
	label: 'Two prolines at positions 986–987',
	default: true,
	help: 'Switch off for the virus’s own spike, which springs into its “after” shape easily.'
};

/** Days after the injection, on the fading step. */
const day: Control = {
	type: 'range',
	id: 'day',
	label: 'Time after the injection',
	min: 0,
	max: 14,
	step: 0.5,
	default: 1,
	format: (v) => (v === 1 ? '1 day' : `${v} days`),
	help: 'The cell keeps reading the message only while it lasts.'
};

/** One or two doses, on the doses chart. */
const doses: Control = {
	type: 'select',
	id: 'doses',
	label: 'Doses',
	default: '2',
	options: [
		{ value: '1', label: 'One dose' },
		{ value: '2', label: 'Two doses, 21 days apart' }
	]
};

/** Who meets the virus later, on the infection chart. */
const vaccine: Control = {
	type: 'select',
	id: 'vaccine',
	label: 'Before the infection',
	default: '2',
	options: [
		{ value: '0', label: 'Not vaccinated' },
		{ value: '1', label: 'One dose' },
		{ value: '2', label: 'Two doses' }
	]
};

/** Months between the last dose and the infection. */
const months: Control = {
	type: 'range',
	id: 'months',
	label: 'Infection',
	min: 1,
	max: 12,
	step: 1,
	default: 6,
	format: (v) => (v === 1 ? '1 month after the last dose' : `${v} months after the last dose`),
	help: 'The same virus, at the same dose, as on the immune-system page.'
};

export const spec: ExplainerSpec = {
	slug: 'mrna-vaccines',
	title: 'How vaccines work — and what an mRNA vaccine does inside you',
	summary:
		'Follow an mRNA vaccine from the injection: a fat bubble enters a muscle cell, its ribosomes read the message and make a virus’s spike protein, the cell shows it to the immune system and breaks the message down within days. Then compare the antibodies after one dose, two doses and a later infection.',
	chapters: [
		{ id: 'idea', title: 'A rehearsal' },
		{ id: 'journey', title: 'Inside a cell' },
		{ id: 'response', title: 'The immune system learns' }
	],
	steps: [
		// ------------------------------------------------------------------ idea
		{
			id: 'rehearsal',
			chapter: 'idea',
			title: 'A first meeting without the illness',
			scene: 'idea',
			duration: 22,
			body: `
<p>On the <a href="../immune-system/#second">immune-system page</a> the same virus infected the same body twice. The first time, the few B and T cells that fitted it needed a week to multiply, and the virus did its damage meanwhile. The second time, <dfn data-def="Long-lived B and T cells left over from an earlier response. They carry the same receptor and respond sooner and more strongly when they meet the same pathogen again.">memory cells</dfn> were waiting, and the virus was gone in days.</p>
<p>A <strong>vaccine</strong> arranges that first meeting without the danger. It shows the immune system a harmless piece of the pathogen, an <dfn data-def="Any molecule that a B-cell or T-cell receptor can recognise: here, a protein of the virus.">antigen</dfn>, so that the memory is already in place when the real one arrives.</p>
<p>For the virus that causes COVID-19 the piece chosen is its <strong>spike</strong>: the protein that sticks out of its surface and grips our cells. An mRNA vaccine does not even bring the spike. It brings the <em>instructions</em> for it, and lets our own cells make it.</p>`,
			notes: `<p>Vaccines differ in how they show the antigen. Some contain a weakened live virus (measles), a killed one (most flu shots, the injected polio vaccine), or just a protein of the pathogen (hepatitis B, HPV). Viral-vector vaccines carry the gene for a protein inside a harmless virus. mRNA vaccines carry it as mRNA in a fat bubble: the first two, from BioNTech/Pfizer (Comirnaty) and Moderna (Spikevax), were authorised in December 2020. The coronavirus’s genome is 29,903 letters of RNA (GenBank NC_045512.2) for about thirty proteins; the vaccine message is about 4,300 letters for one.</p>`
		},
		{
			id: 'message',
			chapter: 'idea',
			title: 'The message: one protein’s recipe',
			scene: 'message',
			hints: { view: 'parts' },
			duration: 22,
			body: `
<p>The vaccine’s active ingredient is <a href="../dna-to-protein/#transcribe">messenger RNA</a>, the same kind of molecule your cells copy from their genes to carry a recipe to the ribosomes. This one has the parts nearly every mRNA in your cells has: a <dfn data-def="A modified G nucleotide added to the front end of an mRNA. Ribosomes need it to start reading, and it protects the message from being chewed up from that end.">cap</dfn> at the front, a short lead-in, the <strong>coding sequence</strong> of 1,273 codons, a stretch after the code, and a long <dfn data-def="A run of about a hundred A letters at the end of an mRNA. The cell nibbles it shorter over time; when it is gone, the message is destroyed.">poly(A) tail</dfn>.</p>
<p>The coding sequence spells the spike protein of the virus, amino acid for amino acid. But not letter for letter: the genetic code has several codons for most amino acids, and the designers picked the ones human cells read most readily. The first codons on the stage are real: the virus’s, and the BioNTech/Pfizer vaccine’s, read from vials by sequencing. Same protein, different spelling, like the <a href="../dna-to-protein/#silent">silent changes</a> of a gene. Only 352 of the 1,273 codons are the same.</p>`,
			notes: `<p>The vaccine’s coding sequence is richer in G and C than the virus’s gene (57% against 37%), which makes the RNA more stable and more efficiently read. The sequence shown is BNT162b2 as sequenced by Jeong, McCoy, … Fire &amp; Shoura (Stanford, 2021) from the remnants left in used vials; it matches the sequence the manufacturer gave the World Health Organization. Sequencing cannot see modified letters, so the U shown are in fact the modified letter of the next step. The virus sequence is the spike gene of the first genome sequenced, Wuhan-Hu-1 (GenBank NC_045512.2).</p>`
		},
		{
			id: 'modified',
			chapter: 'idea',
			title: 'A letter the alarm ignores',
			scene: 'message',
			hints: { view: 'psi' },
			duration: 24,
			controls: [modified],
			body: `
<p>There was a problem with injecting mRNA. Cells have sensors that look for foreign RNA, because that is what many viruses bring: the <a href="../immune-system/#innate">innate alarm</a>. Injected mRNA set them off. The cells raised the interferon alarm, slowed their ribosomes, and made little protein.</p>
<p>Katalin Karikó and Drew Weissman found the way round it in 2005. Our own RNA carries some chemically modified letters, and when they replaced the letter U with a modified one, the sensors largely ignored the message. The vaccines use <dfn data-def="A modified form of the RNA letter U (uridine): the base is attached to the sugar by a different atom, and carries an extra methyl group. Ribosomes read it as U.">N1-methylpseudouridine</dfn> in place of every U. Ribosomes still read it as U, so the protein is the same.</p>
<p>Switch the modified letters off and compare: with ordinary U the sensors fire and the ribosomes stall.</p>`,
			notes: `<p>Karikó, Buckstein, Ni &amp; Weissman showed in 2005 (<i>Immunity</i>) that RNA with modified nucleosides such as pseudouridine hardly activates the Toll-like receptors that sense RNA, and in 2008 (<i>Molecular Therapy</i>) that pseudouridine-containing mRNA is translated more. Andries et al. (<i>Journal of Controlled Release</i>, 2015) found N1-methylpseudouridine better still. Karikó and Weissman received the 2023 Nobel Prize in Physiology or Medicine for these discoveries. The vaccines also leave out the double-stranded RNA by-products of making mRNA, which set the alarm off too. The picture shows the effect, not the chemistry in detail: some alarm is still raised by the vaccine, mostly by its fat bubble, and that is one reason for a sore arm and a day of fever.</p>`
		},
		{
			id: 'prolines',
			chapter: 'idea',
			title: 'Two prolines hold the spike in shape',
			scene: 'spike',
			duration: 24,
			controls: [prolines],
			body: `
<p>The spike has two shapes. On a fresh virus it is folded tight, its heads (<strong>S1</strong>) ready to grip a cell. When it fuses the virus with a cell, it springs open: the heads fall away and the stalk (<strong>S2</strong>) snaps into a long, thin needle. Both outlines on the stage are traced from measured structures, at the same scale.</p>
<p>Antibodies that block the virus are mostly made against the <em>before</em> shape. But a spike made on its own tends to spring early into the <em>after</em> shape, and antibodies against that one mostly fail to block the virus. So the vaccine’s recipe changes two codons, 986 and 987, to make <dfn data-def="An amino acid whose side chain loops back onto the protein’s backbone, making a rigid kink. It does not fit into the long straight helix the spike forms after fusion.">proline</dfn>. Prolines are stiff, and they jam the hinge: the spike stays in its before shape.</p>
<p>The codons are on the stage: <span class="mono">AAA GUU</span> (lysine, valine) in the virus, <span class="mono">CCU CCU</span> (proline, proline) in the vaccine. Switch the prolines off and watch the spike spring.</p>`,
			notes: `<p>The two-proline trick was found for the related MERS coronavirus by Pallesen et al. (<i>PNAS</i>, 2017), and used for SARS-CoV-2 within weeks of its genome being published: Wrapp et al. (<i>Science</i>, 2020) measured the structure of the stabilised spike (PDB 6VSB, the outline here). The after shape is PDB 6XRA (Cai et al., <i>Science</i>, 2020), made of S2 alone. Both the BioNTech/Pfizer and the Moderna vaccine encode this “S-2P” spike. The real change happens in a fraction of a second; the animation slows it right down.</p>`
		},
		// ------------------------------------------------------------------ journey
		{
			id: 'injection',
			chapter: 'journey',
			title: 'Into the arm, in a bubble of fat',
			scene: 'journey',
			hints: { view: 'muscle' },
			duration: 22,
			body: `
<p>Bare mRNA would not last a minute in the body: enzymes that destroy RNA are everywhere, and a long, negatively charged molecule cannot cross a cell’s membrane anyway. So each message travels inside a <dfn data-def="A droplet about 0.1 µm across made of four kinds of fat-like molecules, with mRNA packed inside. It protects the RNA and helps it into cells.">lipid nanoparticle</dfn>, a bubble of fat about a ten-thousandth of a millimetre across.</p>
<p>The dose is injected into the shoulder muscle. One dose of the BioNTech/Pfizer vaccine holds 30 micrograms of mRNA, about <strong>13 trillion</strong> copies of the message. The particles soak into the muscle around the needle, where muscle cells and immune cells take them in. Some drain with the lymph to the nearest <a href="../immune-system/#match">lymph node</a>, in the armpit, where the B and T cells wait.</p>`,
			notes: `<p>The particles are made of an ionisable lipid (the key ingredient, next step), a lipid with a short chain of polyethylene glycol that stops the particles clumping, cholesterol, and a phospholipid of the kind cell membranes are made of. The copy count: the message is about 4,300 letters long (the sequenced 4,175 plus a poly(A) tail of about 110), about 1.4 million daltons, so 30 µg is 30 × 10⁻⁶ g ÷ 1.4 × 10⁶ g/mol × 6.0 × 10²³ ≈ 1.3 × 10¹³ molecules. The Moderna vaccine’s first doses held 100 µg. The swollen lymph nodes in the armpit that some people notice after a dose are the immune response at work.</p>`
		},
		{
			id: 'entry',
			chapter: 'journey',
			title: 'Getting the message out of the bubble',
			scene: 'journey',
			hints: { view: 'entry' },
			duration: 24,
			body: `
<p>A cell swallows a particle the way it takes in many things from outside: its membrane folds round it and pinches off a bubble, an <dfn data-def="A membrane bubble inside the cell made when the cell membrane folds in round something outside. It turns acidic, and its contents are usually digested.">endosome</dfn>. Endosomes turn acidic, and normally their contents are digested.</p>
<p>This is where the particle’s special ingredient works. Its <dfn data-def="A fat-like molecule that is neutral at the pH of blood but picks up a positive charge in acid. Charged, it disrupts the membrane of the endosome and lets the mRNA out.">ionisable lipid</dfn> is neutral in the blood, but in the acid of the endosome it picks up a positive charge, sticks to the endosome’s membrane and breaks it open. The mRNA spills out into the <strong>cytoplasm</strong>, the fluid of the cell, where the ribosomes are.</p>
<p>It is not efficient: most of the messages stay in their endosomes and are digested. Enough get out.</p>`,
			notes: `<p>How many get out has been measured for similar particles carrying small RNAs: only about 1–2% of the RNA taken up escapes the endosomes (Gilleron et al., <i>Nature Biotechnology</i>, 2013). The ionisable lipids of the two vaccines are called ALC-0315 (BioNTech/Pfizer) and SM-102 (Moderna); they turn positive below a pH of about 6–7, and the endosome falls to about 5–6.</p>`
		},
		{
			id: 'translation',
			chapter: 'journey',
			title: 'Ribosomes read it and make spikes',
			scene: 'journey',
			hints: { view: 'ribosome' },
			duration: 26,
			body: `
<p>In the cytoplasm the message is just another mRNA. <a href="../dna-to-protein/#ribosome">Ribosomes</a> clamp on at the cap and read it codon by codon, joining the matching amino acids into a chain, exactly as they read the cell’s own messages. Several ribosomes read one message at once, one behind the other.</p>
<p>The first codons spell a <dfn data-def="A short stretch at the start of a protein (here MFVFLVLLPLVSS) that tells the ribosome to dock onto the endoplasmic reticulum, so that the protein is threaded into it and sent to the cell surface.">signal</dfn> that steers the ribosome to the endoplasmic reticulum, the cell’s workshop for proteins that are exported. There the spike is finished and folded, joined into threes like the virus’s, and shipped to the cell’s surface, where it sticks out of the membrane as it would from a virus.</p>
<p>A ribosome reads about five or six codons a second, so one spike takes about four minutes. Each message is read many times over.</p>`,
			notes: `<p>Ribosomes in mammalian cells add about 5.6 amino acids a second (Ingolia, Lareau &amp; Weissman, <i>Cell</i>, 2011, in mouse stem cells): 1,273 codons take about 230 seconds. The cell also chops some of the spikes into short fragments and shows them on its surface in MHC molecules, as an infected cell does with viral proteins: that is the signal killer T cells look for (step “Showing the spike”).</p>`
		},
		{
			id: 'nucleus',
			chapter: 'journey',
			title: 'It never goes near your DNA',
			scene: 'journey',
			hints: { view: 'nucleus' },
			duration: 22,
			body: `
<p>A common worry is that an mRNA vaccine changes your genes. It cannot, for three reasons.</p>
<ul>
<li><strong>It stays outside the nucleus.</strong> Your DNA is in the nucleus, behind a double membrane; traffic through its pores is controlled, and mRNA is sent <em>out</em> of it, not in. The vaccine’s mRNA is released in the cytoplasm, and that is where it is read and destroyed.</li>
<li><strong>It is RNA, not DNA.</strong> To become part of a chromosome it would first have to be copied back into DNA, which needs an enzyme, reverse transcriptase, that the vaccine does not bring. Your genes are written in DNA, and the vaccine brings no DNA.</li>
<li><strong>It is temporary.</strong> The cell breaks it down within days (next step).</li>
</ul>
<p>The flow of information is the one from <a href="../dna-to-protein/">DNA to protein</a>, joined in the middle: message → ribosome → protein. Nothing flows back.</p>`,
			notes: `<p>Some viruses do write themselves into our DNA: HIV, for example, brings its own reverse transcriptase and integrase. Coronaviruses do not; they copy their RNA genome as RNA, in the cytoplasm. The RNA viruses we catch all the time put far more foreign RNA into our cells than a dose of vaccine.</p>`
		},
		{
			id: 'fading',
			chapter: 'journey',
			title: 'Gone within days',
			scene: 'journey',
			hints: { view: 'fade' },
			duration: 24,
			controls: [day],
			body: `
<p>Every mRNA in a cell is temporary: the cell nibbles its tail, removes its cap, and cuts it up with enzymes, then reuses the letters. The cell’s own messages last from minutes to a day or so; the vaccine’s modified message lasts somewhat longer.</p>
<p>In mice injected in the muscle, protein production from this kind of mRNA falls by half every <strong>20.6 hours</strong>. Move the slider: after 3 days less than a tenth of the messages are still being read, after a week less than 1%. The spikes already made are cleared too. In the model, the spike the immune cells see builds up for about a day and a half after the injection, then fades a little behind the message.</p>
<p>So the vaccine leaves nothing behind but what it was meant to: the immune system’s memory of the spike.</p>`,
			notes: `<p>The half-life is that measured by Pardi et al. (<i>Journal of Controlled Release</i>, 2015) for mRNA with N1-methylpseudouridine in lipid nanoparticles injected into the muscle of mice; light from the protein it encoded could be detected for up to 8 days. In people, the S1 part of the spike made by the Moderna vaccine was found in the blood from the first day after the first dose, peaked around day 5, and was undetectable by day 14; after the second dose none was found, because antibodies now caught it (Ogata et al., <i>Clinical Infectious Diseases</i>, 2022). Traces of vaccine mRNA have been found in lymph nodes for some weeks (Röltgen et al., <i>Cell</i>, 2022), where they keep feeding the immune response; they too are broken down. In the picture the messages shrink as the share still being read.</p>`
		},
		// ------------------------------------------------------------------ response
		{
			id: 'display',
			chapter: 'response',
			title: 'Showing the spike',
			scene: 'display',
			hints: { view: 'display' },
			duration: 24,
			body: `
<p>Now the immune system can see the spike, in two ways, as with a real infection.</p>
<ul>
<li><strong>Whole spikes</strong> stick out of the cells that made them, and float free. A <a href="../immune-system/#receptors">B cell</a> whose receptor fits the shape of a spike grabs it.</li>
<li><strong>Fragments</strong>: cells chop some spikes into short pieces and hold them up on their surface on <dfn data-def="Major histocompatibility complex: molecules on the surface of cells that hold up short fragments of proteins for T cells to inspect.">MHC molecules</dfn>. <dfn data-def="Cells that pick up pieces of pathogens in the tissues, carry them to a lymph node, and show them to T cells.">Dendritic cells</dfn> that took up vaccine particles, or spikes, carry them to the lymph node and show them there. A T cell whose receptor fits one fragment is switched on.</li>
</ul>
<p>The immune system does not know this spike comes from a vaccine. It sees a foreign protein made inside the body, and responds as it would to the virus.</p>`,
			notes: `<p>Fragments of proteins made <em>inside</em> a cell are shown on MHC class I molecules, which killer (CD8⁺) T cells inspect; fragments of proteins taken up from outside are shown on MHC class II, which helper (CD4⁺) T cells inspect. Because an mRNA vaccine has the cells make the antigen themselves, it shows it both ways and calls up both kinds of T cell, as a viral infection does; a vaccine made of protein mostly reaches the helper T cells.</p>`
		},
		{
			id: 'expand',
			chapter: 'response',
			title: 'The few that fit multiply',
			scene: 'display',
			hints: { view: 'expand' },
			duration: 26,
			body: `
<p>From here on the story is the one on the <a href="../immune-system/#expand">immune-system page</a>, and so is the model: the same equations and numbers, with the vaccine’s spike in place of the virus.</p>
<p>The 100 or so killer T cells and B cells whose receptors fit the spike divide, and divide again. About nine days after one dose there are about <strong>25,000</strong> killer T cells for the spike in the model, and plasma cells release antibodies from about day 4. Then the army shrinks, and about one in twenty of the T cells stays on as memory: about <strong>1,300</strong> memory cells, thirteen times the 100 naive ones.</p>
<p>There was never any virus. Nothing was infected and the airways were never touched, but the library of receptors has changed.</p>`,
			notes: `<p><strong>The model.</strong> The response is Cao et al.’s model of the immune-system page (<i>Frontiers in Immunology</i>, 2016), unchanged. The vaccine adds an antigen that recruits the matching cells in the same way as the virus does. It is made as long as the cells translate the mRNA (which fades with a half-life of 20.6 hours, Pardi et al. 2015) and cleared with a half-life we take to be a day, so it peaks about a day and a half after the injection. Its amount per dose is the one number we fitted (see “Two doses”). The model has no helper T cells and no germinal centres, where B cells improve their fit over weeks.</p>`
		},
		{
			id: 'doses',
			chapter: 'response',
			title: 'One dose, two doses',
			scene: 'chart',
			hints: { view: 'doses' },
			duration: 30,
			controls: [doses],
			body: `
<p>The chart shows the antibodies in the model after vaccination, against the peak an infection leaves (the dashed line).</p>
<p>One dose gives a small response: at its peak about a seventh of an infection’s. The vaccine’s antigen lasts only a few days, and only the 100 naive cells meet it. But it leaves memory. The second dose, three weeks later, meets thirteen times more cells, which start sooner and multiply faster: the antibodies climb almost <strong>twenty times higher</strong>, to about two and a half times an infection’s peak.</p>
<p>This is why most vaccines are given more than once. The first dose prepares the memory; the second, the <dfn data-def="A later dose of a vaccine that re-activates the memory cells left by the earlier ones, giving a larger and faster response.">booster</dfn>, multiplies it. Then the antibodies slowly fade, while the memory cells remain.</p>`,
			notes: `<p><strong>Calibration.</strong> The amount of antigen per dose is the one number fitted, so that two doses give 2.5 times the antibody peak of the model’s infection. In the phase 1 trial of the BioNTech/Pfizer vaccine, neutralising antibodies one to two weeks after the second dose of BNT162b2 were about 1.7 to 3.8 times those of people who had recovered from COVID-19 (Walsh et al., <i>New England Journal of Medicine</i>, 2020, adults 18–55); 2.5 is the geometric middle of that range. Everything else, including the first dose’s small response and the second’s almost twentyfold boost, comes out of the model. In the large trial, two doses prevented 95% of symptomatic COVID-19 from a week after the second dose (Polack et al., <i>NEJM</i>, 2020). <strong>Simplifications:</strong> the model’s immune parameters are those of flu in mice (the immune-system page); the antibodies left by the first dose do not catch the second dose’s spike, as they do in people; and its antibodies fade with a half-life of about 46 days for as long as you look; in people long-lived plasma cells usually keep some antibody up for years.</p>`
		},
		{
			id: 'infection',
			chapter: 'response',
			title: 'When the real virus comes',
			scene: 'chart',
			hints: { view: 'infection' },
			duration: 30,
			controls: [vaccine, months],
			body: `
<p>Now the virus arrives: the model virus of the immune-system page (its numbers come from flu in mice), standing in for the coronavirus whose spike the vaccine copied. The dashed curve is a body that never met it; the bold one has been vaccinated.</p>
<p>Within about five months of two doses, the antibodies left in the blood catch the virus before it can grow at all. Later, they have faded, and the virus starts to grow, but memory cells are waiting: they switch on sooner and in far greater numbers, and the virus is gone in about <strong>five days instead of nine</strong>. Try one dose, and later infections.</p>
<p>That is the whole idea: the vaccine showed the immune system a harmless piece of the virus, so the memory was already in place when the real one arrived.</p>`,
			notes: `<p>In the model the virus never changes. The real coronavirus did: its spike gathered mutations, and antibodies made against the original spike fit later variants less well. Together with the fading of antibodies, that is why protection against <em>infection</em> faded within months, while protection against severe disease, which memory cells provide, lasted much longer, and why boosters with updated spikes are offered. The model also leaves out the antibodies of the airways (IgA), which an injected vaccine raises less than an infection does.</p>`
		},
		{
			id: 'recap',
			chapter: 'response',
			title: 'The whole journey',
			scene: 'journey',
			hints: { view: 'recap' },
			duration: 24,
			body: `
<p>An mRNA vaccine, from start to finish:</p>
<ol>
<li>a <strong>fat bubble</strong> carries the message into a cell of the arm muscle and lets it out into the cytoplasm;</li>
<li><strong>ribosomes</strong> read it and make the virus’s spike, held in its before shape by two prolines;</li>
<li>the cell <strong>shows</strong> the spike, whole and in fragments, and breaks the message down within days, without it ever entering the nucleus;</li>
<li>the B and T cells that fit the spike <strong>multiply</strong>, and some of them stay as memory, which a second dose multiplies again.</li>
</ol>
<p>Vaccinated people catch and pass on the virus less, so a vaccine also protects those around them; vaccinate enough of them and an outbreak cannot grow: <a href="../epidemics/#threshold">herd immunity</a>. And because the recipe is only a message, a vaccine for a new virus, or a new variant, can be written as soon as its spike is known.</p>`
		}
	]
};
