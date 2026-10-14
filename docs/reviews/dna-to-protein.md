<!-- batch msgbatch_01PSCmk2K7yX5fvTLPnXfMxz, claude-opus-5-5, submitted 2026-10-14T13:19:50.260Z, ~$0.71 in tokens + 15 web searches -->
# Review: dna-to-protein

## Verdict
The page is ready after the fixes below. The model is sound. I re-ran the sequences independently and confirmed every number the narrative quotes:
- 1,608 → 628 letters, with exons of 142, 223 and 263 and introns of 130 and 850;
- the coding region runs from letter 51 to letter 494 and translates to NP_000509.1 (147 amino acids), ending in TAA;
- the polyadenylation signal AATAAA sits at letter 602;
- of 1,332 possible substitutions, 325 are silent (306 of them at the third letter) and 34 create a stop;
- c.20del gives MVHLTPGRSLPLLPCGAR, and the frame-shifted codons are GGG AGA AGT CTG.

The ClinVar and dbSNP identifiers are correct. **The most important fix:** the page depends on `the-cell`, which is not built. Its opening sentence and three inline links point to a page that does not exist. After that, two factual errors need correcting:
- "all our genes together take about 3 billion" letters (that figure is the whole genome);
- "each of them destroys the protein" (not true for every early stop).

## Factual errors
- **High** — steps.ts:89: "Its instructions take 444 letters; all our genes together take about 3 billion." About 3.1 billion is the size of the whole reference genome. Protein-coding sequence is only about 1–2% of it. Fix: "Its instructions take 444 letters; one full copy of our DNA, all 46 chromosomes' worth, holds about 3 billion, of which only a small fraction (1–2%) spells out proteins." Source: https://en.wikipedia.org/wiki/Human_genome (reference genome 3.1 billion base pairs); https://www.sciencedirect.com/topics/immunology-and-microbiology/human-genome
- **Medium** — steps.ts:214: "…make a stop codon, but each of them destroys the protein." One of the 34 does not. It is c.438T>A/G, Tyr146 → stop in the model's numbering (β145 traditionally), and it removes only the last two amino acids. That variant is the real Hb McKees Rocks. It gives a working haemoglobin with very high oxygen affinity, found in families with too many red blood cells (polycythaemia). It is not thalassaemia. Fix: "Only 34 of the 1,332 possible one-letter changes in β-globin make a stop codon, and almost all of them destroy the protein. The exception proves the rule: a stop at the very end (Hb McKees Rocks) removes just the last two amino acids, and that haemoglobin still works, though abnormally." Source: https://www.semanticscholar.org/paper/Hemoglobin-McKees-Rocks-(alpha2beta2145Tyr-leads-to-Winslow-Swenberg/a342d9661d8e9584f26d0444910fe2feef736d88
- **Medium** — steps.ts:90: "the cell always reads and writes from 5′ to 3′." This contradicts step 3 (line 120), which says the polymerase reads the template 3′→5′. Fix: "and the cell always builds new DNA and RNA from the 5′ end towards the 3′ end; that is why a polymerase reads its template strand the other way, 3′ to 5′."
- **Low** — steps.ts:173: "the chain folds… for β-globin the first methionine is then trimmed off". Methionine aminopeptidase removes the methionine while the chain is still coming out of the ribosome, not after release. Fix: "…the chain folds into its working shape (for β-globin, the first methionine is trimmed off while the chain is still emerging), and four such chains…" (Textbook knowledge; confidence high.)
- **Low** — steps.ts:132: "Right after copying, the introns are cut out…" Capping starts when the RNA is only a few dozen letters long, and most splicing happens while the polymerase is still copying. Fix: "As the copy is being made and just after, the introns are cut out…"

## Model issues
- **Medium** — MutateScene.svelte:180–184 with genetics.ts:266–267: the "own" sequence can start with no AUG (`before.start < 0`).
  - If an edit then creates one, the effect is `start-changed`. Because `after.start > before.start` is always true here, the verdict says "The start codon is broken: reading begins at the next AUG", which is wrong.
  - If the edit does not create one, the verdict says "No AUG left", which implies there was one before.
  - Fix in the verdict:
    ```ts
    case 'start-changed':
      if (before.start < 0) return `A new AUG at letter ${after.start + 1}: ${int(b.length)} amino acids`;
      ...
    case 'no-start':
      return before.start < 0 ? 'Still no AUG: no protein' : 'No AUG left: no protein at all';
    ```
- **Low** — genetics.ts:208–222: `editName` is called "HGVS-style" but skips two HGVS rules:
  - an insertion that copies its neighbouring letter should be written `dup`;
  - deletions and duplications inside a run of identical letters should be named at the 3′-most position.

  In the lab, deleting the first A of "AAA" therefore gets a non-standard name. Either apply both rules, or change the comment and stage wording to "position-based name (simplified from HGVS)". The preset variants are unaffected; their names are correct.
- **Low** — genes.ts:45–55 / steps.ts:122: trpL's "transcribed" sequence is only its 45-letter coding sequence. The real trp leader transcript starts upstream of the AUG and runs on into trpE. Add to the notes: "only the 45 coding letters are shown; the real RNA starts a little earlier and continues into the next genes of the operon."
- The tests check real-world properties: table 1 vs NCBI, exons joining to the RefSeq mRNA, the RefSeq protein, and the variant effects. No issues there. **Not verified:** the trpL coordinates complement(1323038..1323082). I ran out of searches before I could confirm them on https://www.ncbi.nlm.nih.gov/gene/945856. The peptide MKAIFVLKGWWRTS is correct.

## Narrative and scene mismatches
- **Medium** — steps.ts:89 vs DnaScene.svelte:70: the text says "These are the real first letters of the human β-globin gene", but the stage shows letters 45–74. Fix: "These are real letters of the human β-globin gene, just where its instructions begin: the first three after the start are ATG."
- **Medium** — steps.ts:187/199/212/225 vs steps.ts:54–63. The preset steps count from the start codon: "letter 9", "letter 20", "letter 118", "position 20" are c. numbers. The lab's Position slider counts from the first letter of the mRNA, so its default, "letter 71", is c.21. A reader who tries "letter 20" in the lab gets 5′-UTR letter 20 and the verdict "Outside the instructions". Fix: in `at.format`, show both numbers, e.g.
  ```ts
  format: (v, params) => { const s = translate(geneOf(params, true).mrna).start; return s >= 0 && v > s ? `letter ${v} (c.${v - s})` : `letter ${v}`; }
  ```
  (or plain text if `format` gets no params). Also add to line 239: "The slider counts from the first letter of the message; β-globin's instructions start at letter 51."
- **Medium (uncertain: depends on what `duration` does in the framework)** — steps.ts:169 vs TranslateScene.svelte:57: in auto mode, HBB reaches the stop codon at t ≈ 0.8 + 148/2.8 ≈ 54 s, but the step's `duration` is 40. Similarly, transcribe (steps.ts:116) has duration 30, while copying HBB at 20 letters a second takes about 80 s. If `duration` limits or loops `t`, readers never see the release factor or "Copy finished". Fix: set `duration: 60` for `protein` and `duration: 85` for `transcribe`, or only make sure `t` keeps running past `duration`.
- **Low** — steps.ts:240: "Edits outside the instructions, before the start codon or after the stop, leave the protein alone". The model (correctly) reports "Start moved" when an edit in the leader creates a new AUG. Fix: "…leave the protein alone, unless they create a new AUG ahead of the real one."
- **Low** — TranscribeScene.svelte:84: for trpL the title says "copied at 1,200 letters a minute", which reads as the bacterial rate. E. coli RNA polymerase is several times faster. Fix: "…shown at 1,200 letters a minute" for all genes, or drop the rate when `!gene.eukaryote`.

## Catalogue requirements
- **High** — steps.ts:88, 101, 132, 158: the prerequisite `the-cell` is unticked in the checklist, so it is not built.
  - The inline links `../the-cell/#dna`, `#ribosomes` and `#nucleus` are dead.
  - The opening "In the cell we zoomed into the nucleus and found DNA" refers to something the reader has not seen.
  - This breaks done criterion 3 (the page assumes only its prerequisites), and the build order says a topic waits for its prerequisites.

  Fix: build `the-cell` first. Or, until it exists, remove the three links and replace the opening with: "Inside the nucleus of each of your cells is <strong>DNA</strong>, a twisted ladder about two metres long if stretched out."
- **Low (uncertain: depends on the shell's step controls)** — Interaction: "step through transcription". The transcribe scene runs only on time, with no codon-style step control. If the shell's scrub bar doesn't cover it, add a "Letters copied" range control the way translation has `codon`.
- Everything else in the entry is met:
  - picking or typing a gene, translation codon by codon with the table lit, and change/insert/delete with protein comparison are all built;
  - the takeaway is visible on the stage: the silent, missense, nonsense and frameshift strips with their verdicts.

## Clarity
- **Medium** — TableScene.svelte:147–149 and steps.ts:145. "Same colour box = same amino acid" and "look at the boxes of a single colour" are both misleading. Colour encodes the kind of side chain: adjacent Phe and Leu share a colour, for example. It is the merged box that means one amino acid. Fixes:
  - Stage: "One box = one amino acid; colour = kind of side chain. Within a box, often only the 3rd letter differs."
  - Body: "…they usually differ only in the third letter: look at the merged boxes, each of which is one amino acid."
- **Low** — TranslateScene.svelte:315, 462; steps.ts:159: the anticodon is written letter-under-letter (UAC for AUG) with no direction mark. By convention anticodons are written 5′→3′ (CAU). Fix: change the caption to "its tRNA's anticodon {…} (3′→5′) pairs with {…}".
- **Low** — MutateScene.svelte:220–231: for a level-1 reader, the preset titles start with "c.9T>C (p.His3=)" and "ClinVar 15333", and these are explained only in the notes. Add one sentence to the body of the `silent` step: "The label on the stage, c.9T>C, is how geneticists write it: letter 9 counting from the A of AUG, T changed to C."

## Sources consulted
- dbSNP rs713040 (T allele ≈ 0.18 in gnomAD genomes, ≈ 0.49 in 38KJPN, which confirms lines 187/189): https://www.ncbi.nlm.nih.gov/snp/rs713040
- ClinVar 15333, HbS c.20A>T: https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/
- ClinVar 15402, c.118C>T (p.Gln40Ter): https://www.ncbi.nlm.nih.gov/clinvar/RCV000254827/
- ClinVar 15418, c.20del, codon 6 (−A): https://www.ncbi.nlm.nih.gov/clinvar/RCV001008068/
- Hb McKees Rocks (β145 Tyr→stop, working high-affinity haemoglobin): https://www.semanticscholar.org/paper/Hemoglobin-McKees-Rocks-(alpha2beta2145Tyr-leads-to-Winslow-Swenberg/a342d9661d8e9584f26d0444910fe2feef736d88
- Human genome size and coding fraction: https://en.wikipedia.org/wiki/Human_genome ; https://www.sciencedirect.com/topics/immunology-and-microbiology/human-genome
- Jonkers & Lis 2015, Pol II elongation (citation confirmed; the 0.5–4 kb/min range is from my own knowledge of the review): https://www.nature.com/articles/nrm3953
- NCBI Gene trpL (b1265); coordinates not confirmed: https://www.ncbi.nlm.nih.gov/gene/945856
- Ingolia, Lareau & Weissman 2011: the citation is correct as cited elsewhere (https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002755); the 5.6 aa/s figure is from my own knowledge, not re-checked.
- Independent recomputation in Python of exon/intron lengths, CDS translation, AATAAA position, the substitution spectrum and the c.20del frameshift, from the sequences in genes-data.ts using NCBI table 1.
