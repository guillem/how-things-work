import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Adaptation step: one more phage gets in, and a new spacer is taken from it. */
const infect: Control = {
	type: 'action',
	id: 'infect',
	label: 'Another infection',
	action: 'Another infection',
	help: 'A different phage gets in; Cas1–Cas2 take a piece of it and add it to the front of the array.'
};

/** Self step: does Cas9 insist on a PAM before it reads the letters? */
const pam: Control = {
	type: 'toggle',
	id: 'pam',
	label: 'Cas9 checks for a PAM first',
	default: true,
	help: 'Switch off to see what would happen if Cas9 cut anything that matched its crRNA.'
};

/** Escape step: one letter changed in the phage. */
const mutation: Control = {
	type: 'select',
	id: 'mutation',
	label: 'One letter of the phage changed',
	default: 'seed',
	options: [
		{ value: 'none', label: 'None' },
		{ value: 'distal', label: 'Far from the PAM' },
		{ value: 'seed', label: 'In the seed' },
		{ value: 'pam', label: 'In the PAM' }
	]
};

/** The yogurt experiment: which bacterium meets phage 858. */
const strain: Control = {
	type: 'select',
	id: 'strain',
	label: 'Bacterium on the plate',
	default: 'bim',
	options: [
		{ value: 'wt', label: 'Original' },
		{ value: 'bim', label: 'Survivor' },
		{ value: 'removed', label: 'Survivor, spacers removed' },
		{ value: 'added', label: 'Original + spacers' }
	]
};

const crispr: Control = {
	type: 'toggle',
	id: 'crispr',
	label: 'The bacteria have CRISPR',
	default: true,
	help: 'Off: the same bacteria with no CRISPR system at all.'
};

const mutate: Control = {
	type: 'toggle',
	id: 'mutate',
	label: 'Phages can change a letter',
	default: true,
	help: 'Off: every phage’s DNA is copied without errors.'
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Run again',
	action: 'Run again',
	help: 'Same rules, different luck: which cell gains which spacer, and which phage changes which letter, is random.'
};

export const spec: ExplainerSpec = {
	slug: 'crispr',
	title: 'CRISPR: how bacteria remember and fight viruses',
	summary:
		'Watch a virus hijack a bacterium, then see how bacteria fight back: they file a piece of each virus in their own DNA, copy the file into RNA, and send a protein to find and cut any DNA that matches. Then follow the arms race in a flask as phages change a letter to escape.',
	chapters: [
		{ id: 'threat', title: 'Viruses that hunt bacteria' },
		{ id: 'remember', title: 'Remembering' },
		{ id: 'fight', title: 'Fighting back' },
		{ id: 'race', title: 'An arms race' }
	],
	steps: [
		// ------------------------------------------------------------- threat
		{
			id: 'phage',
			chapter: 'threat',
			title: 'A virus that hunts bacteria',
			scene: 'infection',
			duration: 24,
			body: `
<p>Bacteria have viruses too. They are called <dfn data-def="Short for bacteriophage, ‘bacteria eater’: a virus that infects bacteria (or archaea). Most have a protein head full of DNA and a tail they use to inject it.">phages</dfn>, and they are thought to be the most numerous biological things on Earth.</p>
<p>A phage lands on a bacterium, grips its surface with its tail and injects its DNA. Inside, the phage’s genes take over: the cell’s own machinery copies the phage DNA and builds new heads and tails. Within an hour or so the cell bursts and releases dozens to hundreds of new phages, each ready to infect the next cell.</p>
<p>Many bacteria and archaea have a defence that learns. This page is about that defence, <strong>CRISPR</strong>, as it works in bacteria: how a cell remembers a virus it has met, and recognises and destroys it the next time.</p>`,
			notes: `<p>The picture is a <dfn data-def="A phage that always multiplies and bursts the cell it infects, unlike temperate phages that can hide in the host’s chromosome.">virulent</dfn> tailed phage, the kind that attacks <i>Streptococcus thermophilus</i>, the bacterium used to make yogurt and some cheeses and the hero of the later steps. The timing and the number of new phages vary with the phage and the host; the drawing does not show a particular one. A bacterium has other defences too: it can change or hide the surface molecule the phage grips, or chop up unfamiliar DNA with restriction enzymes. Those work against any phage; CRISPR is the one that remembers a particular one.</p>`
		},
		{
			id: 'record',
			chapter: 'threat',
			title: 'A record of past infections',
			scene: 'array',
			hints: { view: 'record' },
			duration: 26,
			body: `
<p>In 1987 a Japanese team sequencing a gene of <i>E. coli</i> noticed something odd beside it: the same short stretch of DNA repeated again and again, each copy separated by a different stretch of about the same length. Other bacteria and archaea turned out to have them too. In 2002 they got a name: <dfn data-def="Clustered Regularly Interspaced Short Palindromic Repeats: a run of identical repeats separated by unique spacers.">CRISPR</dfn>.</p>
<p>The identical pieces are <strong>repeats</strong> (drawn as grey diamonds). The unique pieces between them are <strong>spacers</strong>. Repeats and spacers are each a few dozen letters long. Together they form a <strong>CRISPR array</strong>, which starts at a <dfn data-def="The stretch of DNA before the first repeat. Transcription of the array starts here, and new spacers are added next to it.">leader</dfn>.</p>
<p>In 2005 Francisco Mojica, in Alicante, compared spacers with every DNA sequence then known. Some matched the DNA of phages and other invaders, and those invaders failed to infect the bacteria carrying the matching spacer. The array is a list of past invaders, each spacer a piece of one of them.</p>`,
			notes: `<p>Ishino et al. 1987 (<i>J. Bacteriol.</i> 169: 5429) found the repeats next to the <i>iap</i> gene of <i>E. coli</i>. Jansen et al. 2002 (<i>Mol. Microbiol.</i> 43: 1565) named them, and found <i>cas</i> genes (CRISPR-associated) always next to them. Mojica et al. 2005 (<i>J. Mol. Evol.</i> 60: 174) showed that spacers come from phages and plasmids, and that these fail to infect the strain carrying the spacer; Pourcel et al. and Bolotin et al. reported spacers of foreign origin independently the same year (<i>Microbiology</i> 151). In a study of 3,626 spacers of <i>S. thermophilus</i>, of those that resembled known DNA 77% matched phages, 16% plasmids and 7% the bacterium’s own chromosome (Horvath et al. 2008, <i>J. Bacteriol.</i> 190: 1401). The ‘palindromic’: each repeat reads partly the same on both strands. The letters on this page are <strong>made up</strong> for teaching, and the phage genomes are a few hundred letters instead of tens of thousands.</p>`
		},
		// ----------------------------------------------------------- remember
		{
			id: 'adapt',
			chapter: 'remember',
			title: 'Filing a piece of the invader',
			scene: 'array',
			hints: { view: 'adapt' },
			duration: 26,
			controls: [infect],
			body: `
<p>How does a spacer get into the array? Sometimes a cell survives an infection, for example because the phage was faulty. A pair of proteins, <dfn data-def="Two proteins found with nearly every CRISPR system. Together they cut a short piece out of invading DNA and insert it into the CRISPR array.">Cas1 and Cas2</dfn>, takes a short piece of the phage’s DNA and inserts it into the array. This is <strong>adaptation</strong>.</p>
<p>They don’t take any piece. They prefer one that sits right next to a short tag of letters, a <dfn data-def="Protospacer adjacent motif: a few letters next to the target in the invader’s DNA. Cas9 must find it before it reads the target. On this page it is NGG: any letter, then two Gs.">PAM</dfn> (here, NGG: any letter followed by GG). The reason comes later.</p>
<p>The new spacer always goes in at the front, next to the leader, and the first repeat is copied so that the new spacer has a repeat on each side. So the array reads like a diary: newest at the front, oldest at the back. Press <em>Another infection</em> and watch it grow.</p>`,
			notes: `<p>Nuñez et al. 2014 (<i>Nat. Struct. Mol. Biol.</i> 21: 528) showed that Cas1 and Cas2 form a complex that is essential for adding spacers; they are the only Cas proteins found in nearly all CRISPR systems. In the yogurt bacterium the spacers added after a phage attack are 29 to 31 letters long, most often 30, and they are taken next to the PAM its system recognises (Deveau et al. 2008, <i>J. Bacteriol.</i> 190: 1390). In Cas9 systems, Cas9 itself helps Cas1–Cas2 pick pieces with the right PAM. Here spacers are 20 letters, the length of the part Cas9 uses. Why a cell survives long enough to file a spacer is still studied: faulty phages, and phage DNA broken up by other defences, are both sources.</p>`
		},
		{
			id: 'inherit',
			chapter: 'remember',
			title: 'A memory children inherit',
			scene: 'inherit',
			duration: 22,
			body: `
<p>The array is part of the bacterium’s chromosome. When the cell divides, the chromosome is copied, and both daughter cells get the array, with every spacer in it. A bacterium that survived one phage has descendants that are all protected against it.</p>
<p>Compare our own <a href="../immune-system/#memory">immune memory</a>: after an infection we keep memory cells, but they are not passed to our children. Each child starts with a fresh immune system. In bacteria, the memory is written in DNA and inherited, like any gene.</p>
<p>It is still not foresight. A spacer protects only against a phage the cell’s ancestors have already met, which is why the arms race of the last chapter never ends.</p>`,
			notes: `<p>Bacteria divide by copying their chromosome and splitting in two (see the <a href="../the-cell/#bacterium">bacterial cell</a>). Arrays also lose spacers: comparisons of strains show internal deletions as well as additions at the leader end (Horvath et al. 2008). Old spacers against phages that no longer exist bring no benefit, and nothing stops them being lost.</p>`
		},
		// -------------------------------------------------------------- fight
		{
			id: 'express',
			chapter: 'fight',
			title: 'From the file to the search party',
			scene: 'express',
			duration: 24,
			body: `
<p>A record is no use while it sits in the chromosome. The cell <a href="../dna-to-protein/#transcribe">transcribes</a> the whole array, starting at the leader, into one long RNA copy. This is <strong>expression</strong>.</p>
<p>The long RNA is then cut inside every repeat. Each piece holds one spacer plus a bit of repeat on either side. These short pieces are <dfn data-def="CRISPR RNA: a short RNA cut from the transcribed array, holding one spacer. Paired with a Cas protein, it is used to find DNA with the matching letters.">crRNAs</dfn>.</p>
<p>Each crRNA is loaded into a Cas protein. In the bacteria of this page, that protein is <dfn data-def="A large CRISPR-associated protein that carries a crRNA, finds DNA matching it beside a PAM, and cuts both strands.">Cas9</dfn>. A cell has many of these complexes at a time, each carrying a different spacer, ready to recognise one past invader.</p>`,
			notes: `<p>CRISPR systems differ in which proteins do the work. In the type I systems of <i>E. coli</i>, a protein in a complex called Cascade cuts the long RNA, and Cascade with its crRNA finds the invader (Brouns et al. 2008, <i>Science</i> 321: 960). In type II systems, the ones drawn here (the yogurt bacterium and <i>Streptococcus pyogenes</i>), a second small RNA, the tracrRNA, pairs with each repeat; the cell’s own enzyme RNase III cuts at those pairs, with Cas9 holding them (Deltcheva et al. 2011, <i>Nature</i> 471: 602). The tracrRNA stays attached to the crRNA inside Cas9; the drawing leaves it out.</p>`
		},
		{
			id: 'scan',
			chapter: 'fight',
			title: 'Search and cut',
			scene: 'interfere',
			hints: { view: 'scan' },
			duration: 30,
			body: `
<p>Now the same phage injects its DNA again. A Cas9 carrying the matching crRNA runs along the phage DNA. It doesn’t read every letter: it looks for a PAM, GG. Only where it finds one does it open the double helix next to it and check whether the crRNA pairs with the DNA, letter by letter, starting next to the PAM.</p>
<p>At the first two PAMs the letters don’t match, and it lets go: at the second it gets three letters in before the fourth fails. At the third, all 20 letters pair. Cas9 cuts both strands of the phage DNA, three letters from the PAM. This is <strong>interference</strong>.</p>
<p>A cut phage genome can’t be copied: the cell’s enzymes chew up the broken ends. The infection stops and the cell lives, as long as Cas9 finds the target before the phage takes over.</p>`,
			notes: `<p>Marraffini &amp; Sontheimer 2008 (<i>Science</i> 322: 1843) showed that CRISPR targets DNA, not RNA. Garneau et al. 2010 (<i>Nature</i> 468: 67) showed that the yogurt bacterium’s CRISPR1 system cuts both strands of phage and plasmid DNA at specific sites inside the target. The letters next to the PAM are called the <dfn data-def="The letters of the target next to the PAM, which Cas9 checks first. A mismatch here stops it.">seed</dfn>. NGG is the PAM of the most studied Cas9, from <i>Streptococcus pyogenes</i>; the yogurt bacterium’s CRISPR1 system reads a longer one, NNAGAAW (Deveau et al. 2008). The 20 letters on the stage are <strong>made up</strong>, as is the phage DNA around them.</p>`
		},
		{
			id: 'self',
			chapter: 'fight',
			title: 'Why it doesn’t cut itself',
			scene: 'interfere',
			hints: { view: 'self' },
			duration: 26,
			controls: [pam],
			body: `
<p>Here is a puzzle. The spacer in the array spells exactly the same letters as the phage’s target. Why doesn’t Cas9 find the array and cut the bacterium’s own chromosome?</p>
<p>Because of the PAM. In the phage, the target is followed by a PAM; that is why Cas1–Cas2 chose that piece. In the array, the same letters are followed by a repeat, and the repeat doesn’t start with a PAM. Cas9 never opens the DNA there, so it never reads the spacer.</p>
<p>Switch the PAM check off: Cas9 now reads the letters wherever it lands, finds its own spacer in the array and cuts the chromosome. For a bacterium, that is fatal. The PAM is how the system tells <em>self</em> from <em>invader</em>.</p>`,
			notes: `<p>Other CRISPR types tell self from invader in other ways too; in type III systems, the repeat letters on the edge of the crRNA pair with the array but not with the invader, and pairing there stops the attack (Marraffini &amp; Sontheimer 2010, <i>Nature</i> 463: 568). Spacers that do match the cell’s own chromosome next to a PAM do occur, and are harmful: bacteria carrying them tend to lose the spacer or inactivate the system.</p>`
		},
		{
			id: 'escape',
			chapter: 'fight',
			title: 'One letter to escape',
			scene: 'interfere',
			hints: { view: 'escape' },
			duration: 26,
			controls: [mutation],
			body: `
<p>Phages copy their DNA with errors. Suppose one letter of the target changes. Cas9 checks the PAM first, then the seed, the letters next to it. A change in either and it lets go: the phage escapes, and the cell dies.</p>
<p>A change far from the PAM is a different story. Cas9 has already paired the seed by then, and one mismatch at the far end is often not enough to stop it: it still cuts. Choose where the change falls.</p>
<p>In the yogurt bacterium, phages that got past CRISPR had exactly such changes: a single letter in the target or its PAM, or a deleted stretch.</p>`,
			notes: `<p>Deveau et al. 2008 sequenced 20 phages that infected bacteria with a matching spacer: they had escaped through single-letter mutations or deletions in the target or its PAM. On this page Cas9 lets go at any mismatch in the 10 letters next to the PAM and tolerates one mismatch further away, but not two. Real tolerance is graded: it depends on the position, the letters involved and the amount of Cas9 in the cell.</p>`
		},
		// --------------------------------------------------------------- race
		{
			id: 'yogurt',
			chapter: 'race',
			title: 'The yogurt experiment',
			scene: 'yogurt',
			duration: 28,
			controls: [strain],
			body: `
<p>Is CRISPR really an immune system, or just a list? In 2007 Rodolphe Barrangou, Philippe Horvath and colleagues at Danisco, a maker of yogurt cultures, tested it. Phages are a costly nuisance in dairies: they can wipe out the <i>Streptococcus thermophilus</i> that turns milk into yogurt.</p>
<p>They exposed a strain to two of its phages, 858 and 2972. A few cells survived. The survivors had new spacers at the front of their array, matching DNA of the phages they had survived.</p>
<p>Then they swapped spacers. Removing the new spacers made a survivor sensitive again. Adding them to the original strain made it resistant. Pick a bacterium and spread phage 858 on it: holes in the lawn mean the phage is killing it.</p>`,
			notes: `<p>Barrangou et al. 2007, <i>Science</i> 315: 1709–1712: “after viral challenge, bacteria integrated new spacers derived from phage genomic sequences. Removal or addition of particular spacers modified the phage-resistance phenotype of the cell.” The resistance needed the <i>cas</i> genes next to the array as well as the spacers. The follow-up study (Deveau et al. 2008) found that a single new spacer is the most common outcome of a phage attack, and that adding more spacers increases resistance. Danisco went on to use the method to make starter cultures less vulnerable to phages. The plate and the spacers on the stage are schematic.</p>`
		},
		{
			id: 'flask',
			chapter: 'race',
			title: 'Bacteria and phages in a flask',
			scene: 'population',
			hints: { view: 'flask' },
			duration: 30,
			controls: [crispr, again],
			body: `
<p>A model flask holds ten million bacteria. A thousand phages are added. The chart follows both, over ten days, on a scale where each line is ten times the one below.</p>
<p>The phages multiply and the bacteria crash. Almost all infected cells die, but a very few, one in a million in this model, survive and file a spacer. Those cells are immune, and so are all their descendants. They refill the flask while the phages, finding no more cells to infect, die out.</p>
<p>Switch CRISPR off: no cell can learn, and the flask is emptied.</p>`,
			notes: `<p>This is a model, not an experiment. Bacteria grow (doubling in about an hour) toward a ceiling of ten million; phages meet bacteria at a rate proportional to both numbers; an infected cell dies and releases 30 phages; one in a million infected cells survives with a spacer from one of six target sites on the phage. The numbers are illustrative, chosen so a run lasts days. Real bacteria have other escape routes too, such as losing the surface molecule the phage grips, which the model leaves out.</p>`
		},
		{
			id: 'arms',
			chapter: 'race',
			title: 'An arms race',
			scene: 'population',
			hints: { view: 'arms' },
			duration: 32,
			controls: [mutate, again],
			body: `
<p>Now let the phages make copying errors. Among the billions of new phages, a few have a changed letter in a target. If it falls in the PAM or seed, the phage escapes the bacteria whose spacers point at that target, and a new wave of infection begins. Some of its victims survive and file a spacer against the <em>changed</em> phage, and they take over in turn.</p>
<p>Watch the panel under the chart: the arrays of the commonest bacterium grow at the front, while the commonest phage collects changed letters. Neither side wins for good. This is <a href="../evolution/">evolution by natural selection</a> on both sides at once, and it is seen in real cultures: in long experiments with the yogurt bacterium, the phage’s letters changed only in the stretches its spacers targeted.</p>`,
			notes: `<p>Paez-Espino et al. 2015 (<i>mBio</i> 6: e00262-15) followed the yogurt bacterium and phage 2972 together for hundreds of days and found that the phage’s mutations accumulated exclusively in regions targeted by CRISPR. Phages also have other answers: some carry anti-CRISPR proteins that block Cas proteins, and phages swap pieces of genome, replacing heavily targeted stretches. In this model a change at a target counts only if it falls in the PAM or the seed (others don’t stop Cas9), so every counted change is a new spelling of that target that escapes the spacers against the old one; a cell with spacers against several targets needs several changes to be infected, which is why the bacteria with longer arrays hold out longer.</p>`
		},
		{
			id: 'history',
			chapter: 'race',
			title: 'From yogurt to a Nobel Prize',
			scene: 'history',
			duration: 26,
			body: `
<p>The story took twenty years: odd repeats in 1987, a name in 2002, spacers matching phages in 2005, the yogurt experiment in 2007, and then, one by one, the crRNAs, the DNA target, the cut.</p>
<p>The takeaway in one line: <strong>a bacterium keeps a piece of each virus it survives in its own DNA, and uses RNA copies of that record to find and cut the same virus next time.</strong> The PAM keeps it from attacking itself, and the viruses fight back by changing a letter.</p>
<p>Researchers later adapted this natural system into a tool for editing genes, for which Emmanuelle Charpentier and Jennifer Doudna received the 2020 Nobel Prize in Chemistry.</p>`,
			notes: `<p>CRISPR systems come in two classes, six types and 33 subtypes (Makarova et al. 2020, <i>Nat. Rev. Microbiol.</i> 18: 67); this page has followed one, type II with Cas9. The biochemistry of how Cas9 cuts, worked out with purified proteins, is outside the scope of this page.</p>`
		}
	]
};
