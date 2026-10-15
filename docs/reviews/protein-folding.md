# Review: protein-folding

## Verdict
Ready after the fixes below. The facts are carefully sourced: every count I re-ran (110,188 shapes, the energy histograms, 3¹⁰⁰ ≈ 5.2 × 10⁴⁷, 1.6 × 10²⁷ years, the RMSDs, the pLDDT means) matches the model, and the PDB and UniProt counts match the live services. The most important fix is a model bug: the crankshaft move ("a hairpin swings over") could never run, because a U-shaped bead always took the corner-flip branch and was rejected there. Next come two framing problems on the AlphaFold steps. The three structures compared were in AlphaFold's training data, and the prediction does not come "from the sequence alone". The self-fold text also says the chain spends "most of its time" in its best fold, while at the default temperature it spends about half.

## Factual errors
- **medium**, steps.ts:91. "Four such folded chains make one haemoglobin": haemoglobin is two β-globin and two α-globin chains. Fix: "Two of these and two of the similar α-globin chains make one haemoglobin." https://www.ncbi.nlm.nih.gov/books/NBK544263/
- **medium**, steps.ts:225 (confidence). "Only its middle … has been crystallised" is wrong: the tetramerisation domain (e.g. PDB 1C26) and the N-terminal peptide bound to MDM2 (1YCR) have been crystallised too. Full-length p53 has not. Fix: "p53 has never been crystallised whole; the piece on the left is its middle…". Also change "which is also why they never crystallise" to "…why they do not crystallise on their own". https://www.rcsb.org/structure/1YCR, https://www.rcsb.org/structure/1C26
- **medium**, steps.ts:150 and :152 (levinthal notes and dfn). Levinthal's estimate is in the 1969 Allerton House talk ("How to fold graciously"). Zwanzig et al. (footnote †) point out that the often-cited J. Chim. Phys. 65, 44 (1968) does not contain it. Fix: cite 1969 as the source and say that the 1968 paper is often cited but lacks it. Also: Zwanzig counts 3 states per *bond*, so 3¹⁰⁰ is a chain of 101 amino acids; reword to "each link". https://www.physik.uni-bielefeld.de/~reimann/THBIO/Ref1.pdf (Zwanzig, Szabo & Bagchi, PNAS 89, 20, 1992)
- **low**, steps.ts:242 (confidence notes). The tetramerisation helix is at about 335–354 (domain 325–356), not "near amino acid 330". Fix: "The short helix at about amino acids 335–355".
- **low**, steps.ts:79/93 (chain). The 2DN2 HELIX records include short 3₁₀ segments (class 5: 36–46, 76–79, 120–122), and the page draws them all as α-helix. The note should say that a few short tighter (3₁₀) turns are drawn as helix too.

## Model issues
- **high**, hp.ts:333–380 (`localMove`). The crankshaft branch is unreachable. In a U (i−1, i, i+1, i+2), bead i is at a corner, so the corner-flip branch runs. Its target is the grid point of bead i+2, which is occupied, so the code returns. When the crankshaft code is reached, i−1, i and i+1 are collinear, and the U test always fails. The simulation was still correct in equilibrium (pivots keep it ergodic, and chain A at T = 0.3 matched the exact Boltzmann share of 0.49), but the "hairpin swings over" move the page describes never happened, and jammed compact shapes could only escape by pivots. Fix: when the corner's flip point holds bead i ± 2, attempt the crankshaft of that U. Proposing it from either bead of the U keeps the proposal symmetric. Add a behaviour test: a 12-bead shape (turns LSSRRLRRLL) that no end or corner move can change must still change under local moves alone.

## Narrative and scene mismatches
- **medium**, steps.ts:166 (self-fold). "…spends most of its time there": at the default temperature 0.3 the exact Boltzmann share of the best fold is 0.49 (chain A) and 0.44 (chain B), and the stage readout shows about that ("in its best fold 4x% of the time"). Fix: "spends about half its time there at this temperature, and more when it is cooler". Add a model test that the Monte Carlo share matches the exact Boltzmann share from the full enumeration.
- **low**, steps.ts:131 (landscape). "once its chain finds its best fold, every change makes things worse, so it stays" overstates this in the same way. Fix: "…so it keeps coming back to it".
- **medium**, steps.ts:232 (compare) and CompareScene.svelte:220. AlphaFold 2 was trained on PDB structures released before 30 April 2018, and 2DN2 (2006), 2VB1 and 2OCJ (2007) were among them, so the close match is not a blind prediction. The readout "from the sequence alone" is also inaccurate: AlphaFold uses the sequences of related proteins (the page's own `problem` note says so). Fix: add a clause that these structures were in its training data and that CASP is the blind test. Change "from the sequence alone" to "from the sequence and its relatives'". Jumper et al., Nature 596, 583 (2021), Methods. https://www.nature.com/articles/s41586-021-03819-2
- **medium**, steps.ts:150 (landscape notes). "Real chains also gain freedom (entropy) when they unfold, which the HP energy leaves out" is misleading. The model does count conformational entropy: the bars *are* that entropy, and it is why the chain melts at T ≈ 0.4–0.6. Fix: say that the bars are that entropy and that its pull against the one best fold is why the folded protein is only marginally stable.
- **low**, GapScene.svelte:40. "Each dot stands for about 260,896 proteins": the dots are UniProt sequences, and "about" sits oddly with an exact figure. Fix: "Each dot stands for 260,896 sequences".
- **low**, steps.ts:93 (inside-out). "β6 (amino acid 7 here)": nothing on the stage numbers the amino acids. Fix: "β6 (the 7th amino acid of the chain made in DNA to protein, counting its first methionine), ringed here".

## Catalogue requirements
All met: the reader folds an HP chain by hand against an energy score, watches it fold itself, and compares real PDB structures with AlphaFold DB predictions coloured by pLDDT. The Takeaway is stated and shown. The Needs are met with real PDB and AFDB data under their licences.

## Clarity
- **low**, steps.ts:225 (confidence). "The ends, in orange": the linker between the core and the tetramerisation helix (about 292–325) is also very low confidence. Fix: "The ends and the linker, in orange…".
- **low**, steps.ts:110/118 (inside-out notes). The surface calculation includes the haem (see `proteins-data.ts`), but the note says only "every atom of the measured structure". Add "and its haem".
- **low**, steps.ts:233 (compare). "about half an ångström": lysozyme's value is 0.67 Å. Fix: "half to two-thirds of an ångström".

## Sources consulted
- Zwanzig, Szabo & Bagchi, PNAS 89, 20 (1992), full text: https://www.physik.uni-bielefeld.de/~reimann/THBIO/Ref1.pdf
- RCSB search API (260,896 experimental entries, 15 Oct 2026), UniProt REST (release 2026_03, 150,006,383): https://search.rcsb.org, https://rest.uniprot.org
- 2DN2 HELIX records: https://files.rcsb.org/header/2DN2.pdb
- Jumper et al., Nature 596, 583 (2021): https://www.nature.com/articles/s41586-021-03819-2
- OEIS A001411 (self-avoiding walks): https://oeis.org/A001411
- PDB 1YCR, 1C26 (p53 fragments): https://www.rcsb.org
