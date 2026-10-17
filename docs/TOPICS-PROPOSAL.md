# Proposal: a level 0 and 100 new topics

Written 2026-10-17 and 2026-10-18, after v1.0.0. This is a proposal for the user to review; nothing
in it is built, and [`TOPICS.md`](TOPICS.md) is unchanged until the user promotes entries from here.
The entries below use the catalogue's own format, so promoting one is a copy into `TOPICS.md` (plus
the checklist line, the category count and the links listed under "Links to add to existing
entries"). The indented `>` lines under each entry are proposal notes, not catalogue fields; drop
them when promoting.

## Summary

A hundred new topics, chosen from 573 researched candidates, would take the catalogue to 200:

- **A new level 0** for curious beginners (about ages 9 to 13, or adults with no science
  background): 39 topics that start from something the reader knows (a toilet flush, a magnet, a
  sea breeze, a chatbot guessing the next word) and keep the bar of a real model behind the
  graphic.
- **Level 3 in every category**: 48 university-level topics, at least four in each of the seven
  categories that have none today, and nine in AI.
- **An AI tilt, at the user's request**: AI gains 14 topics (the most of any category), among them
  a ladder for understanding large language models in detail, from a level-0 door through
  tokenization, position, the residual stream, training, scaling, RLHF and reasoning to serving
  with a KV cache and speculative decoding. The ladder's second wave is listed with the
  runners-up.
- **Ten at level 1 and three at level 2**, mostly conspicuous holes (exponentials and
  logarithms, cellular automata, game theory, PCR, tsunamis, differential equations).
- **The Reserve list settled**: ten of its fourteen items are promoted (three of them in part),
  four are dropped with the reason and the score that decided it.

The levels would stand at 39 / 48 / 59 / 54 (levels 0 to 3), against 0 / 38 / 56 / 6 today.
That is not even: level 2 already holds 56, and the user chose to take AI's extra slots from
level 0 (the first plan was 45 / 10 / 3 / 42). Every entry passed a sceptical review (one was
refuted and replaced, 86 were corrected) and the catalogue's invariants hold over all 200. Six
decisions are open for the user; they are listed under "Open questions" at the end.

## Level 0

The catalogue's Levels table gets a new first row:

| Level | Reader                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 0     | Curious beginner: primary or middle school (about ages 9 to 13), or an adult with no science background |
| 1     | High school                                                                                             |
| 2     | Final year of high school or first year of university                                                   |
| 3     | University student in the field                                                                         |

What a level-0 page is, beyond the reader it is written for:

- It starts from an object or an experience the reader already knows (a toilet, a magnet, a shadow,
  a sleepy afternoon), not from a concept, and the question on the page is the one a ten-year-old
  asks.
- No formulas. Numbers appear as counts and comparisons ("twice as far", "a thousand times
  smaller"), with everyday units only (metres, degrees, seconds, litres).
- One control at a time, and the toy is the takeaway: the reader should see the point by playing,
  before reading. Six to nine steps, under ten minutes.
- The bar does not drop: the graphic is driven by a real model, fact-checked like every other page
  (the toilet's siphon is a real siphon; the drone tilts by real rotor thrusts). What changes is
  what is shown and said, not what is computed.
- Prerequisites may only be other level-0 topics, and usually there are none: level-0 pages are
  roots. Each entry carries a "Leads to" note naming the existing topics (usually level 1) it
  prepares the reader for. That note is not a catalogue field; it becomes a link when the user wants
  it (see "Links to add to existing entries").
- Every level-0 page ends with a step that names the level-1 page to read next.

There are 39 level-0 topics, at least three in every category, all with no prerequisites. 22 of
them are flagged as everyday objects or experiences (see "Categories"). Their `Leads to` notes
point at 25 different existing pages, so the level-0 shelf feeds most of the level-1 catalogue,
not one corner of it.

## Where the catalogue stands, and where it would land

| Level     | Today   | New     | After   |
| --------- | ------- | ------- | ------- |
| 0         | 0       | 39      | 39      |
| 1         | 38      | 10      | 48      |
| 2         | 56      | 3       | 59      |
| 3         | 6       | 48      | 54      |
| **Total** | **100** | **100** | **200** |

| Category                | Today   | New     | After   | L0           | L1           | L2          | L3           |
| ----------------------- | ------- | ------- | ------- | ------------ | ------------ | ----------- | ------------ |
| Mathematics             | 10      | 12      | 22      | 3 (+3)       | 6 (+3)       | 8 (+1)      | 5 (+5)       |
| Physics                 | 10      | 8       | 18      | 5 (+5)       | 6 (+1)       | 4 (+0)      | 3 (+2)       |
| Chemistry & Materials   | 9       | 8       | 17      | 3 (+3)       | 5 (+0)       | 4 (+0)      | 5 (+5)       |
| Biology                 | 9       | 11      | 20      | 4 (+4)       | 8 (+2)       | 3 (+0)      | 5 (+5)       |
| Body & Medicine         | 9       | 9       | 18      | 4 (+4)       | 4 (+0)       | 6 (+1)      | 4 (+4)       |
| Earth & Climate         | 8       | 8       | 16      | 3 (+3)       | 6 (+1)       | 3 (+0)      | 4 (+4)       |
| Space                   | 9       | 5       | 14      | 3 (+3)       | 3 (+0)       | 5 (+0)      | 3 (+2)       |
| Computing               | 10      | 6       | 16      | 3 (+3)       | 5 (+1)       | 4 (+0)      | 4 (+2)       |
| Information & Networks  | 8       | 9       | 17      | 3 (+3)       | 1 (+0)       | 8 (+1)      | 5 (+5)       |
| Artificial Intelligence | 9       | 14      | 23      | 3 (+3)       | 3 (+2)       | 6 (+0)      | 11 (+9)      |
| Energy & Machines       | 9       | 10      | 19      | 5 (+5)       | 1 (+0)       | 8 (+0)      | 5 (+5)       |
| **Total**               | **100** | **100** | **200** | **39** (+39) | **48** (+10) | **59** (+3) | **54** (+48) |

Perfectly even is out of reach with a hundred additions: level 2 already holds 56 topics, more
than a quarter of the 200. The proposal therefore adds almost nothing at level 2 and puts the
weight on level 0 and level 3, which is where the catalogue is thinnest today. Level 3 was also
uneven by category: it existed only in Physics, Space, Computing and AI, so the seven categories
with none (Mathematics, Chemistry, Biology, Body & Medicine, Earth & Climate, Information &
Networks, Energy & Machines) each get four or five new level-3 pages.

The split was first set at 45 / 10 / 3 / 42 (levels 0 / 1 / 2 / 3). On review the user asked
that, where the split has to be uneven, it lean towards AI, ideally with a complete set of
explainers for understanding large language models, and chose to take those slots from level 0.
The proposal is therefore 39 / 10 / 3 / 48, and the 200 would stand at 39 / 48 / 59 / 54. Seven
level-0 slots came from the largest level-0 cells (Physics and Energy & Machines from six to five;
Body & Medicine from five to four; Mathematics, Chemistry, Computing and Earth & Climate from four
to three). One of them went to AI's level-0 target (two to three, for the ladder's door) and six
to AI's level-3 target (three to nine). Every other category kept its level-3 target.

If the user wants level 2 lower still, the honest move is to re-level a few existing level-2
entries whose models are already university material, rather than to add fewer topics there:
black-holes integrates Schwarzschild geodesics, big-bang computes recombination with Peebles'
three-level atom, medical-imaging reconstructs from projections, gps carries the relativistic
corrections, standard-model enforces colour and charge rules. This proposal re-levels nothing;
that list is a footnote for the user to act on or ignore.

## Categories

Every topic below is filed under one of the existing eleven categories, so the index, the
category table and the checklist keep their shape. The level-0 pages spread across all eleven:
a ten-year-old's questions about a toilet, a magnet, a sleepy afternoon and a sea breeze belong to
Energy & Machines, Physics, Body & Medicine and Earth & Climate respectively, and the Level filter
(`?level=0`) already collects them into one beginner's shelf.

An alternative worth a look is a twelfth category, **Everyday things** (`everyday`), holding the
22 level-0 topics flagged as household objects and everyday experiences (listed
below, each with the category it is filed under by default). For it: an obvious front door for
beginners, and a toilet stops sharing a shelf with heat engines. Against it: a twelfth Area chip
on an index that already needs five rows of chips on a phone, and a category defined by audience
rather than by subject, unlike the other eleven. The recommendation is to keep eleven categories
and add a "Start here" link on the index that opens the level-0 filter; the flagged list makes
the other arrangement a mechanical change later.

| Everyday topic                                                  | Filed under by default  |
| --------------------------------------------------------------- | ----------------------- |
| shapes-that-tile: Shapes that tile a floor                      | Mathematics             |
| why-triangles-are-stiff: Why triangles are stiff                | Mathematics             |
| floating-sinking-and-boats: Floating, sinking & boats           | Physics                 |
| magnets-and-poles: Magnets & poles                              | Physics                 |
| shadows-and-pinholes: Shadows & pinholes                        | Physics                 |
| vibrations-and-sound: Vibrations & sound                        | Physics                 |
| dissolving-sugar-and-salt: Dissolving: where does the sugar go? | Chemistry & Materials   |
| salt-and-ice: Salt on ice: roads and ice cream                  | Chemistry & Materials   |
| why-metal-feels-cold: Why metal feels cold                      | Chemistry & Materials   |
| why-spinning-makes-you-dizzy: Why spinning makes you dizzy      | Body & Medicine         |
| leap-years: Leap years: why February gets an extra day          | Space                   |
| twenty-questions: Twenty questions: halving the haystack        | Computing               |
| barcode-stripes: Barcodes at the checkout                       | Information & Networks  |
| qr-codes: QR codes                                              | Information & Networks  |
| wifi-and-walls: Wi-Fi around the house                          | Information & Networks  |
| next-word-guessing-game: How a chatbot picks its next word      | Artificial Intelligence |
| spam-filter-word-counts: How a spam filter decides              | Artificial Intelligence |
| teach-a-machine: Teach a machine to tell things apart           | Artificial Intelligence |
| clock-escapement: Pendulum clocks & the escapement              | Energy & Machines       |
| drone-four-rotors: How a drone steers with four rotors          | Energy & Machines       |
| light-bulb-hot-wire: Why a light bulb glows (and gets hot)      | Energy & Machines       |
| toilet-flush: Toilet flush & siphons                            | Energy & Machines       |

## The AI tilt: a ladder for understanding language models

The user asked that, where the split has to be uneven, it lean towards AI, ideally with a
complete set of explainers for understanding large language models in detail. With the existing
pages (marked _existing_) the ladder reads, bottom to top:

| Stage                   | Page                                                                     | Level |
| ----------------------- | ------------------------------------------------------------------------ | ----- |
| Door                    | next-word-guessing-game: a chatbot writes by guessing one word at a time | 0     |
| Counting models         | ngram-text-models: why counting what came next cannot reach far back     | 1     |
| Learning                | learning-from-data, gradient-descent, neural-networks (_existing_)       | 1–2   |
| Tokens                  | tokenization: byte-pair encoding                                         | 3     |
| Meaning as position     | embeddings (_existing_)                                                  | 2     |
| The next token          | language-models (_existing_): probabilities, temperature, top-p          | 2     |
| Attention               | transformers (_existing_)                                                | 3     |
| Order                   | positional-encoding: sinusoids and RoPE                                  | 3     |
| Inside a block          | residual-stream-logit-lens: the residual stream and the logit lens       | 3     |
| Training                | training-a-tiny-language-model: a transformer trained live in the page   | 3     |
| Scale                   | scaling-laws: loss against model size, data and compute                  | 3     |
| From model to assistant | rlhf-alignment: a reward model and the KL leash                          | 3     |
| Reasoning               | chain-of-thought-scratchpad: why writing the steps out helps             | 3     |
| Serving                 | kv-cache-inference: why generation is memory-bound                       | 3     |
| Faster serving          | speculative-decoding: a small model guesses, the big one checks          | 3     |

The selection filled AI's nine level-3 slots with one page per stage first (the best-scored
candidate of each stage; `kv-cache-inference` was proposed under Computing and is filed under AI
with the rest of the ladder). The rungs left out are not rejected (several scored as well as the stage winners) and are listed as the ladder's second wave under "Candidates that did not make the
hundred" (mixture of experts, quantization, LoRA, instruction tuning, reasoning trained with
verifiable rewards, long context, induction heads, superposition, retrieval-augmented generation,
where facts live, distillation, adaptive optimizers). Promoting them needs more AI slots than
this hundred has; that is one of the open questions.

## The Reserve list

The catalogue's Reserve section lists fourteen candidates "to replace a topic above". With 100
additions there is nothing to replace; each one is either promoted into this proposal or dropped:

| Reserve item                           | Decision            | Where it lands                                                                                                                                                                                                             |
| -------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exponentials & logarithms              | Promote             | exponentials-logarithms (level 1, Mathematics). Its doubling half also opens growing-patterns, a level-0 runner-up.                                                                                                        |
| Differential equations                 | Promote             | differential-equations (level 2: slope fields need only calculus) and phase-portraits (level 3: stability and bifurcations).                                                                                               |
| Game theory                            | Promote             | game-theory-cooperation (level 1: the repeated prisoner's dilemma, tournaments and a spatial grid). The replicator-dynamics page evolutionary-game-theory (level 3) is a runner-up.                                        |
| Cellular automata                      | Promote             | cellular-automata (level 1: the 256 elementary rules) and life-on-a-grid (level 0, Computing: Conway's Life).                                                                                                              |
| Lasers & LEDs                          | Promote, split      | lasers (level 3, Physics: the rate equations, threshold and Q-switching). The LED half is the comparison step of light-bulb-hot-wire (level 0) and a sentence in semiconductors, not a page of its own.                    |
| Heat pumps                             | Promote             | heat-pumps-refrigeration (level 3, Energy & Machines: a real refrigerant on a p-h diagram). The householder's level-1 heat-pumps and the level-0 refrigerator are runners-up.                                              |
| Telescopes                             | Promote, narrowed   | aperture-synthesis (level 3, Space: interferometry). Lenses, mirrors and the diffraction limit already belong to light-optics; a generic level-2 telescopes page scored 10.5 and is dropped.                               |
| Hearing & the cochlea                  | Promote             | cochlea-hearing (level 3, Body & Medicine: a transmission-line cochlea and the implant) and hearing-and-the-ear (level 0).                                                                                                 |
| Embryo development & pattern formation | Promote             | morphogen-gradients and turing-patterns (both level 3, Biology).                                                                                                                                                           |
| Clustering & dimensionality reduction  | Promote in part     | k-means-clustering (level 1, AI). dimensionality-reduction (level 3, PCA and t-SNE, 13.5) is a runner-up: AI's level-3 slots went to the LLM ladder.                                                                       |
| Fluid dynamics                         | Drop from this list | navier-stokes (level 3, a lattice-Boltzmann flow; scored 13.5, fit 5, build 4) lost Physics' two level-3 slots to ising-model and lasers (15 each). It is the strongest physics runner-up; flight already covers the wing. |
| Operating systems                      | Drop from this list | os-scheduling (level 3, 13.5) lost Computing's two level-3 slots to cache-memory-hierarchy and hash-tables-bloom-filters (15 each). Runner-up.                                                                             |
| Compilers                              | Drop from this list | compilers (level 3, a toy language compiled for the cpu page's processor; 12) scored below the Computing level-3 picks. Runner-up.                                                                                         |
| DNA sequencing                         | Drop from this list | dna-sequencing (level 3, Sanger plus shotgun assembly on phiX174; 12) scored below Biology's five level-3 picks. pcr-copying-dna (level 1) covers amplification. Runner-up.                                                |

## The 100 topics

### Mathematics

#### monty-hall

- **Title:** The three doors
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Pick one of three doors; the host, who knows where the prize is, opens another to show a goat, and you stay or switch. Play by hand, then let the page play a hundred games with 'always stay' and a hundred with 'always switch', the wins piling into two columns at about two to one. Flip the board to see the three places the prize could be and which choice wins in each, then try ten doors where the host opens eight.
- **Takeaway:** Switching wins twice as often as staying, because the first pick is right only one time in three and the host's open door points to the prize the rest of the time.
- **Prerequisites:** none
- **Related:** bayes-theorem
- **Pitfall:** The host must know where the prize is and always open a goat door; if the host opens a door at random and happens to show a goat, the two remaining doors really are equal, and the page should show that case too.
  > Leads to: bayes-theorem
  > Nearest existing: bayes-theorem: counting a grid of 1,000 people to update on a test result; this page updates on what a host does, with doors and tallies instead of rates and formulas.
  > Why: The Monty Hall problem is among the most-read probability articles on Wikipedia and a staple of popular maths: https://en.wikipedia.org/wiki/Monty_Hall_problem

#### shapes-that-tile

- **Title:** Shapes that tile a floor
- **Level:** 0
- **Kind:** build
- **Interaction:** Pick a shape from the tray (triangle, square, pentagon, hexagon, octagon) and tap a corner: the page fits copies of the shape around that corner one at a time until it closes the turn, leaves a gap or overlaps. A shape that closes the turn exactly floods the floor with copies; one that does not leaves holes. Then take a square tile and bend one edge: the opposite edge bends to match and the floor still fills, Escher-style.
- **Takeaway:** A regular shape (all sides and corners equal) tiles a floor on its own only when copies of its corner fit together into exactly one full turn, which equilateral triangles, squares and regular hexagons do and regular pentagons and octagons do not.
- **Prerequisites:** none
- **Related:** why-triangles-are-stiff
- **Pitfall:** Regular pentagons do not tile, but some irregular pentagons do (fifteen families of convex pentagons are known, and a 2017 proof says there are no more), and every triangle and every four-sided shape tiles. So the page must say 'this regular pentagon', never 'pentagons'.
  > Leads to: unit-circle
  > Nearest existing: chaos-fractals (level 2) is the nearest page about repeating structure; it repeats across scales, while this page repeats one shape across a flat floor and asks only whether its corners close a full turn.
  > Why: England KS2 maths, Year 5: 'angles at a point and 1 whole turn (total 360°)' is the fact the page rests on; Wikipedia's Tessellation article (regular tilings: only the triangle, square and hexagon, because 3π/5 is not a divisor of 2π) is the demand side. https://en.wikipedia.org/wiki/Tessellation

#### why-triangles-are-stiff

- **Title:** Why triangles are stiff
- **Level:** 0
- **Kind:** build
- **Interaction:** Snap sticks together at their ends with pins to make a square, then push on a corner: it leans over into a diamond. Make a triangle and push: nothing moves. Add one diagonal stick to the square and push again; then build a tall tower and a garden gate and find the fewest sticks that stop them wobbling.
- **Takeaway:** A triangle is the one shape whose sides fix its corners, so a floppy frame goes stiff the moment a diagonal cuts it into triangles.
- **Prerequisites:** none
- **Related:** shapes-that-tile
- **Pitfall:** Stiff is not strong: the page is about shapes holding their angles, not about how much load a stick can carry; do not colour sticks by force or claim triangles 'spread the load'.
  > Leads to: bridges-structures
  > Nearest existing: bridges-structures (level 1) loads a bridge and colours members by tension and compression; this page has no loads or forces, only a pin-jointed frame that either keeps its shape or folds.
  > Why: England KS2 design and technology: 'apply their understanding of how to strengthen, stiffen and reinforce more complex structures' (KS1: 'build structures, exploring how they can be made stronger, stiffer and more stable'). https://www.gov.uk/government/publications/national-curriculum-in-england-design-and-technology-programmes-of-study/national-curriculum-in-england-design-and-technology-programmes-of-study

#### cellular-automata

- **Title:** Cellular automata
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set the eight bits of a one-dimensional rule by clicking its lookup table, and run it from a single live cell or a random row, each generation drawn as a new line below the last. Rule 90 draws a Sierpinski triangle, rule 30 looks random, rule 110 carries colliding structures, and rule 184 moves cars along a road that jams once more than half the cells are full. Step through all 256 rules and sort them into Wolfram's four classes (die out, repeat, look random, build structures), with a count of live cells over time to compare rules.
- **Takeaway:** A rule that only looks at a cell and its two neighbours, applied everywhere at once, can die out, repeat, look random or build moving structures, and changing one bit of the rule can switch between them.
- **Prerequisites:** life-on-a-grid
- **Related:** chaos-fractals, turing-machines, logic-gates
- **Pitfall:** Rule 30 looks random but is completely determined: the same starting row always gives the same pattern. And most rules do not make complexity; they die out or repeat, and only a few, like rule 110, build lasting structures.
  > Nearest existing: life-on-a-grid (proposed, level 0): that page plays Conway's two-dimensional Game of Life; this page opens the rule itself as an 8-bit table in one dimension, surveys all 256 rules and their classes, and shows a CA as a traffic model and as a universal computer. chaos-fractals shows complexity in continuous systems; turing-machines uses a tape and head, not a grid of cells updating at once.
  > Why: Wikipedia, Elementary cellular automaton and Rule 184 (traffic model): https://en.wikipedia.org/wiki/Rule_184 ; 'Cellular automata' is listed in the catalogue's Reserve.

#### exponentials-logarithms

- **Title:** Exponentials & logarithms
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Fold a strip of paper, breed bacteria or compound interest: a slider sets the growth factor, a counter of doublings runs and the curve shoots off the chart; switch the vertical axis to a log scale and the curve becomes a straight line whose slope is the growth rate. Compare 'add the same amount each step' with 'multiply by the same factor each step' on one chart, read a logarithm as the number of doublings needed, and build a slide rule that multiplies by adding lengths.
- **Takeaway:** Growing by a fixed factor each step outruns growing by a fixed amount, and a logarithm just counts how many of those steps it took.
- **Prerequisites:** none
- **Related:** radioactivity, epidemics, acids-bases, earthquakes, sorting
- **Pitfall:** Exponential does not mean fast: with a factor just above 1 it starts slowly. And a log-scale line that looks tame is not growth slowing down; say that the rate stays the same.
  > Nearest existing: radioactivity: that page shows exponential decay through half-lives and epidemics shows cases doubling; this page isolates the rule itself, puts growth and decay on one log axis, and defines the logarithm as a count of steps.
  > Why: Common Core HSF-LE, Linear, Quadratic and Exponential Models: https://www.thecorestandards.org/Math/Content/HSF/LE/

#### game-theory-cooperation

- **Title:** Game theory: why cooperate?
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Play the prisoner's dilemma against the page with a payoff table whose four numbers can be edited, and find that cheating pays once but not when the same two players meet again. Enter strategies (always cheat, always cooperate, tit for tat, grudger, random) into a round-robin tournament of repeated games and watch the scores; let the population evolve, with well-scoring strategies copied more often, and add a little noise to the signals to see which strategies survive it. Finish on a grid where each cell plays its neighbours, so that clusters of cooperators grow or are eaten.
- **Takeaway:** When the same players meet again and again, strategies that start nice, hit back and forgive can outscore pure selfishness, so cooperation can take hold among players who each look after only themselves, unless the games are too short or too few others cooperate.
- **Prerequisites:** none
- **Related:** evolution, ecosystems, reinforcement-learning
- **Pitfall:** Tit for tat never beat an opponent in a single game; it won the tournaments by scoring well with everyone. There is no best strategy independent of the population it plays in, and the result changes with the payoff numbers and with noise.
  > Nearest existing: evolution runs selection on a heritable trait and ecosystems couples populations; here the agents choose, with payoffs. The pool's evolutionary-game-theory (level 3) is the replicator ODE on the simplex; this is the level-1 tournament-and-grid version with no equation.
  > Why: Nicky Case's 'The Evolution of Trust', an interactive built on Axelrod's tournaments https://ncase.me/trust/ (coverage: https://boingboing.net/2017/07/26/fun-interactive-game-theory-si.html )

#### differential-equations

- **Title:** Differential equations
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Choose a rule for the slope at every point (growth in proportion to the amount, cooling toward room temperature, logistic growth with a ceiling, a fish stock under steady harvesting) and the plane of time against amount fills with small slope arrows; click anywhere to drop a starting value and watch a solution curve thread through the arrows. Drop several starts and see that curves never cross, that some settle on a level line and others run away from it, and raise the harvest until the level line vanishes and every curve crashes; where an exact formula exists, overlay it on the traced curve.
- **Takeaway:** A differential equation says how fast something changes given where it is, and that rule plus a starting point fixes one curve through the field of arrows, which can be followed even when no formula exists.
- **Prerequisites:** calculus
- **Related:** epidemics, ecosystems, feedback-control
- **Pitfall:** Not every differential equation can be solved with a formula: most cannot, and the slope field still fixes each solution. Solution curves of one equation never cross, so two different futures cannot start from the same state.
  > Nearest existing: calculus finds the slope and area of a given curve; this page starts from the slope rule and finds the curve. phase-portraits (proposed, level 3) owns two-variable systems such as springs and predator–prey; this page is the one-variable slope field, equilibria and their stability.
  > Why: 3Blue1Brown, 'Differential equations, a tourist's guide' (over 4 million views) https://www.classcentral.com/classroom/youtube-differential-equations-a-tourist-s-guide-133384 ; AP Calculus BC Unit 7 (slope fields, Euler's method) https://fiveable.me/ap-calc/unit-7.md

#### calculus-of-variations

- **Title:** The brachistochrone & calculus of variations
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the control points of a ramp between two fixed points and a bead slides down it under gravity, its descent time computed by integrating along the curve; race the straight line, a circular arc and your curve. Press optimize and the curve relaxes step by step toward the cycloid as the page descends the gradient of the time functional, while a panel shows the Euler–Lagrange residual along the curve going to zero; a second example finds the hanging-chain shape.
- **Takeaway:** The fastest slide between two points is a curve, the cycloid, not the straight line, and at the optimum the Euler–Lagrange residual is zero all along the curve, so no small change to its shape makes the slide faster.
- **Prerequisites:** calculus, newtons-laws
- **Related:** light-optics, gradient-descent, orbits-kepler
- **Pitfall:** The best curve can dip below the end point and still win (it does whenever the horizontal distance is more than about π/2 times the drop), and the straight line is not 'almost as good': show it losing to the cycloid by a measured margin. A curve that satisfies the Euler–Lagrange equation is stationary, not automatically the minimum.
  > Nearest existing: newtons-laws: that page sends a cart along an editable track with energy bars; this page asks which track is best and finds it by varying the whole curve.
  > Why: Fowler, Graduate Classical Mechanics, ch. 2 'The Calculus of Variations' (brachistochrone): https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Graduate_Classical_Mechanics_(Fowler)/02%3A_The_Calculus_of_Variations/2.05%3A_Fastest_Curve_for_Given_Horizontal_Distance ; demand: myPhysicsLab brachistochrone simulation https://www.myphysicslab.com/roller/brachistochrone-en.html

#### phase-portraits

- **Title:** Phase portraits & stability
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the four entries of a 2×2 linear system, or move its two eigenvalues on the complex plane, and the phase plane redraws as a node, saddle, spiral or center while a trace–determinant chart marks where you are. Switch to a nonlinear system (damped pendulum, predator–prey, van der Pol) and hover a critical point to see its linearization laid over the real flow; drag a parameter through a Hopf bifurcation and watch a limit cycle be born.
- **Takeaway:** Near a fixed point whose eigenvalues have nonzero real parts, the real flow looks like its linearization, so a few fixed points and their eigenvalues sketch the whole portrait; when the eigenvalues reach the imaginary axis, as at a Hopf bifurcation, the nonlinear terms take over and a limit cycle can appear that no fixed point predicts.
- **Prerequisites:** linear-transformations, calculus, differential-equations
- **Related:** oscillations-resonance, ecosystems, feedback-control, chaos-fractals
- **Pitfall:** A center predicted by the linearization is not conclusive: the nonlinear terms decide (Hartman–Grobman covers only hyperbolic points). Show the frictionless pendulum beside the damped one rather than claiming linearization settles every case.
  > Nearest existing: chaos-fractals shows sensitivity to initial conditions and the logistic map's cascade, and the pool's hamiltonian-phase-space is about area preservation and Poincaré sections; this page classifies flows in the plane by their fixed points and eigenvalues and shows where linearization stops working (ecosystems shows one predator–prey cycle at level 1 as curves, not as a portrait).
  > Why: MIT OCW 18.03SC, Unit IV, Linearization near critical points (including its structural-stability note on borderline centers): https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/pages/unit-iv-first-order-systems/linearization-near-critical-points

#### random-graphs

- **Title:** Random graphs & the giant component
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Slide the average degree of a random graph and watch components merge, coloured by size: the largest component's share of the nodes stays near zero until the average degree passes 1, then climbs, plotted live against degree. Raise the number of nodes from 50 to a few thousand and rerun the sweep: the curve's knee at degree 1 sharpens toward a corner. A second view opens bonds on a square grid at random and shows a spanning cluster appearing at its own threshold, near half the bonds open.
- **Takeaway:** In a large random network, adding links does not connect it gradually: a giant connected piece appears abruptly once each node has about one link on average, and the bigger the network, the sharper that switch.
- **Prerequisites:** graph-search, central-limit-theorem
- **Related:** epidemics, internet, pagerank, states-of-matter
- **Pitfall:** The sharp threshold is a large-graph limit; with a few hundred nodes the curve is rounded. Show the knee sharpening as n grows instead of drawing a step.
  > Nearest existing: internet: that page routes packets across a given network and epidemics spreads infection through a crowd; this page is about the structure of random networks and the threshold at which they connect at all.
  > Why: MIT 6.207/14.15 Networks, Lecture 4: Erdős–Rényi graphs and phase transitions: https://economics.mit.edu/sites/default/files/inline-files/Lecture%204%20-%20Erdos-Renyi%20Graphs%20and%20Phase%20Transitions.pdf

#### resampling-inference

- **Title:** The bootstrap & permutation tests
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Compare flipper length between two species of real penguins: shuffle the group labels thousands of times to build the histogram of differences that chance alone produces, and read the p-value as where the observed difference falls in it. Resample each group with replacement to build a bootstrap distribution and a confidence interval for the difference and for a regression slope. Then switch to a known simulated population, repeat the whole procedure hundreds of times, and count how often the interval catches the true value: drag the sample size down, skew the population or ask for the maximum instead of the mean, and watch the coverage fall below 95%.
- **Takeaway:** Resampling rebuilds the chance distribution from the data itself, and it works only as well as the sample stands in for the population: with small or skewed samples the intervals miss the truth more often than they claim.
- **Prerequisites:** central-limit-theorem, bayes-theorem, learning-from-data
- **Needs:** The Palmer penguins dataset (344 penguins, bill and flipper measurements by species; palmerpenguins, CC0).
- **Pitfall:** A p-value is not the probability that the null hypothesis is true, and a bootstrap interval is not guaranteed to have its stated coverage: the bootstrap does not cure a small sample. The coverage counter must show the shortfall, not a reassuring 95%.
  > Nearest existing: learning-from-data: that page fits a curve and shows overfitting with a held-out set; this page asks whether a difference or slope is real by rebuilding the chance distribution from the data, and how often the resulting intervals actually catch the truth.
  > Why: Hesterberg, What Teachers Should Know about the Bootstrap: Resampling in the Undergraduate Statistics Curriculum: https://arxiv.org/abs/1411.5279
  > Data: Palmer penguins (Gorman, Williams & Fraser 2014; palmerpenguins package): CC0

#### taylor-series

- **Title:** Taylor series & where they stop working
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Pick a function and add Taylor terms one at a time with a slider: the polynomial hugs e^x and sin x ever further from the center, but for 1/(1 + x²) it closes in only for |x| < 1 and swings ever wilder beyond, however many terms are added. A linked complex plane shows the disk of convergence and the function's singularities at ±i: the disk stops exactly where it touches the nearest one; drag the center along the real line and the disk, and the stretch of the real line the polynomials fit, resize to match. A last toggle overlays Chebyshev interpolation, which fits the whole interval anyway.
- **Takeaway:** The Taylor series of a function converges exactly out to its nearest singularity in the complex plane, even when nothing goes wrong on the real line.
- **Prerequisites:** calculus, complex-numbers
- **Related:** fourier-transform
- **Pitfall:** More terms do not always mean a better fit: outside the radius each new term makes the polynomial worse, and a function can be smooth everywhere on the real line and still have a finite radius. Do not claim convergence on the boundary circle: for 1/(1 + x²) the series diverges at x = ±1.
  > Nearest existing: calculus: that page shows the tangent line (the first Taylor term) and the integral; this page stacks the higher terms and explains the radius of convergence through the complex plane.
  > Why: 3Blue1Brown, Essence of calculus: Taylor series: https://www.3blue1brown.com/lessons/taylor-series

### Physics

#### blue-sky-red-sunset

- **Title:** Why the sky is blue & sunsets red
- **Level:** 0
- **Kind:** explore
- **Interaction:** Scrub the Sun across a day's sky: a patch of sky overhead and the Sun's own disc take the colours that come out when sunlight scatters off air along its path, worked out colour by colour from the real sunlight spectrum and shown as screen colours. Thicken the air or add smoke and the sunset deepens to orange and the daytime sky goes paler. Pump the air away altogether and the sky turns black around a white Sun, as on the Moon.
- **Takeaway:** Air scatters blue light out of sunlight far more than red, so the sky overhead is blue and the Sun turns red when its light has crossed a lot of air near the horizon.
- **Prerequisites:** none
- **Related:** light-optics
- **Needs:** None that needs a licence: sunlight above the air as a Planck spectrum at the Sun's effective temperature (5772 K, the IAU nominal value), and the CIE 1931 colour-matching functions from the analytic fit of Wyman, Sloan & Shirley (JCGT 2013), a formula. Optional, once its licence is confirmed: the ASTM G173-03 AM0 'Etr' column from NLR/NREL as a cited cross-check.
- **Pitfall:** The sky is not blue because it reflects the sea, nor because of ozone; and the sky is not violet, although violet scatters even more, because sunlight carries less violet and the eye is less sensitive to it.
  > Leads to: light-optics, greenhouse-effect
  > Nearest existing: light-optics: that page splits white light with a prism and bends rays; this one scatters it off air, following the Sun through a day, and never bends a ray.
  > Why: 'Why is the sky blue?' is the most-googled science question in Glimpse's ranking https://meetglimpse.com/insights/most-searched-questions/ ; Royal Observatory Greenwich explainer on Rayleigh scattering https://www.rmg.co.uk/stories/space-astronomy/why-sky-blue
  > Data: Two spectra from one model: the Sun's disc is the Planck spectrum attenuated by Rayleigh scattering (fourth power of wavelength) along the air path for the Sun's height; the sky patch is the light scattered into the line of sight along that path and attenuated on its way to the eye (single scattering), with optional haze of weak colour dependence; both are turned into screen colour with the analytic CIE 1931 fit. No data files: the Planck law and the fit are formulas. The ASTM G173 file (licence unconfirmed; the standard itself is ASTM copyright) and the CVRL tables (no licence stated) are avoided.

#### floating-sinking-and-boats

- **Title:** Floating, sinking & boats
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Lower objects into a brim-full tank (a stone, an apple, a wooden block, a steel ball, a ball of modelling clay): the water each one pushes aside spills into a cup on a scale, and a spring balance holding the object shows it getting lighter as it goes in. Each one sinks, or settles where the spilled water weighs as much as it does. Reshape the clay from a ball into a bowl and the same lump floats; load it with marbles until it goes under. Change the water to salt water or to oil and see who floats now; finally warm the air inside a balloon and watch it rise through the surrounding air the same way.
- **Takeaway:** A thing floats if it can push aside its own weight of water (or air) before it is completely under, which is why the same lump of clay sinks as a ball and floats as a bowl.
- **Prerequisites:** none
- **Related:** states-of-matter
- **Needs:** A handful of handbook densities (water, sea water, oil, ice, wood, steel, air).
- **Pitfall:** Heavy things do not simply sink and light things float: a steel ship floats and a grain of sand sinks; what matters is the weight compared with the weight of the water pushed aside.
  > Leads to: states-of-matter, newtons-laws
  > Nearest existing: states-of-matter: that page shows ice being less dense than water inside a molecular box; this one is about whole objects in a tank, the water they push aside and why a bowl of clay floats when a ball of it sinks.
  > Why: Bartosz Ciechanowski, 'Naval Architecture' (interactive explainer on why ships float) https://ciechanow.ski/naval-architecture/ ; KS3 physics 'Pressure in fluids' (upthrust effects, floating and sinking) https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study ; PhET 'Density' listed in the PhET middle-school guide https://phet.colorado.edu/files/guides/MiddleSchool_en.pdf and 'Buoyancy: Basics' on PhET's fluids search page https://phet.colorado.edu/en/search?q=fluids
  > Data: Archimedes' principle with the submerged area of a draggable hull computed from the water line; densities from a handbook table (Wikipedia's density tables, CC BY-SA 4.0, or a physics textbook; the few values are not copyrightable facts).

#### magnets-and-poles

- **Title:** Magnets & poles
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag two bar magnets about on a board: arrows show the pull or push between them, computed from their poles, and a compass needle and a sprinkle of iron filings line up along the field. Flip one magnet end for end and the pull turns into a push. Slide a steel paper clip toward a magnet to see it become a magnet of its own and pick up a chain of clips, then cut a magnet in half and find that each half still has two ends.
- **Takeaway:** A magnet always has two ends; like ends push apart and unlike ends pull together, and the pull fades quickly with distance.
- **Prerequisites:** none
- **Related:** electromagnetism
- **Pitfall:** A magnet does not attract all metals, nor even all steel: it pulls iron, nickel, cobalt and most steels, but not aluminium, copper, gold or many stainless-steel spoons and sinks. And cutting a magnet never separates its poles: each piece has two.
  > Leads to: electromagnetism
  > Nearest existing: electromagnetism: that page (level 2) places charges, draws field lines and induces currents with coils; this one has no electricity at all, only permanent magnets, their two poles, what they attract and how a clip becomes a temporary magnet.
  > Why: NGSS 3-PS2-3 (electric or magnetic interactions between objects not in contact; the clarification names paper clips and magnets) https://www2.cde.ca.gov/cacs/id/web/29018 ; KS2 Year 3 'Forces and magnets' (magnets have two poles; predict whether two magnets attract or repel) https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study

#### shadows-and-pinholes

- **Title:** Shadows & pinholes
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a lamp, a toy and a wall about a room: straight rays from the lamp are blocked by the toy, and the shadow on the wall grows as the lamp comes closer and shrinks as the wall comes closer. Swap the small bulb for a wide lampshade and the shadow's edge goes soft; switch on a second lamp and a second shadow appears. Poke a pinhole in a shoebox and the picture of the lamp forms upside down on its back wall.
- **Takeaway:** Light travels in straight lines, so a shadow is simply where the lines are blocked, and its size follows the lines back to the lamp.
- **Prerequisites:** none
- **Related:** sun-earth-moon
- **Pitfall:** A shadow is not something a lamp throws onto a wall; it is where no light arrives. And the Moon's phases are not Earth's shadow (the page should point to sun-earth-moon for eclipses, which are).
  > Leads to: light-optics, sun-earth-moon
  > Nearest existing: light-optics: that page bends rays through lenses and prisms on an optical bench; this one never bends a ray, only blocks it, and is about shadow size, soft edges and the pinhole picture.
  > Why: Bartosz Ciechanowski, 'Lights and Shadows' https://ciechanow.ski/lights-and-shadows/ ; KS2 Year 3 'Light' (find patterns in the way the size of shadows change) and Year 6 'Light' (light appears to travel in straight lines; shadows have the shape of the objects that cast them) https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study

#### vibrations-and-sound

- **Title:** Vibrations & sound
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Twang a ruler held over the edge of a table: the strip wobbles, and a row of air particles passes the push along to an ear, each one jiggling in place while the squeeze travels down the row; the speakers play the note. Slide the ruler in to shorten it and the wobble quickens and the note rises; twang it harder and the wobble widens and the note gets louder. Move the ear away and the sound fades, then pump the air out of a jar around a ringing bell and nothing arrives at all.
- **Takeaway:** A sound is a wobble passed along through the air: a faster wobble is a higher note, a bigger wobble a louder one, and with nothing in between to pass it on, nothing reaches the ear.
- **Prerequisites:** none
- **Related:** waves-interference, hearing-and-the-ear
- **Pitfall:** Sound does not travel as air flying from the source to the ear; each bit of air jiggles in place and passes the push on. Louder is not higher: loudness and pitch are two different things. Sound needs some material to carry it, not air in particular: it travels through water, wood and metal too, and only empty space stops it.
  > Leads to: waves-interference, oscillations-resonance
  > Nearest existing: waves-interference: that page puts two sources in a ripple tank and finds a string's harmonics; this one has a single vibrating ruler and a single row of air particles, no interference, no harmonics, just pitch, loudness, distance and the need for air.
  > Why: KS2 Year 4 'Sound' (sounds are made by something vibrating; vibrations travel through a medium to the ear; sounds get fainter with distance) https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study ; Bartosz Ciechanowski, 'Sound' https://ciechanow.ski/sound/

#### musical-scales-ratios

- **Title:** Why music has twelve notes
- **Level:** 1
- **Kind:** explore
- **Interaction:** A keyboard whose keys play, each note drawn as its wave; press two keys and the page plays them together and draws how the waves line up: an octave (double the frequency) repeats every cycle, a fifth (3:2) every two, while clashing pairs beat and a roughness meter (the Plomp-Levelt curve) rises. Slide a divider to cut the octave into 5, 7, 12, 19, 31 or 53 equal steps and read off how many cents each ladder misses the pure fifth and major third by; twelve is the first small ladder whose fifth lands within 2 cents. Compare an equal-tempered chord with a pure one by ear.
- **Takeaway:** Notes sound smooth together when their frequencies are in simple ratios, and twelve equal steps per octave is the smallest small ladder whose fifth lands almost exactly on the pure 3:2.
- **Prerequisites:** waves-interference
- **Related:** fourier-transform, shazam-audio-fingerprint
- **Pitfall:** Twelve is a good compromise, not a law of nature or of the ear: other traditions divide the octave differently, and equal temperament makes every fifth slightly flat. Consonance also depends on timbre; the roughness model (Plomp-Levelt 1965) is one measurable part of it.
  > Nearest existing: waves-interference: beats and a string's harmonics; this page is which pairs of notes fit together and why the octave is cut into twelve.
  > Why: 'Why 12 notes to the octave?' (University of Waterloo) is a widely read answer to a perennial question: https://www.math.uwaterloo.ca/~mrubinst/tuning/12.html

#### ising-model

- **Title:** The Ising model & phase transitions
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a square lattice of spins with the Metropolis algorithm (or the Wolff cluster update, which stays fast near the critical point) and slide the temperature through Tc: domains grow out of noise, the magnetization rises steeply but continuously from zero as the lattice cools below Tc, and the susceptibility and heat capacity spike. Below Tc, apply a field and sweep it back and forth to trace a hysteresis loop; grow the lattice to see the peaks sharpen, and shrink it to a one-dimensional chain to see the transition vanish.
- **Takeaway:** In two dimensions, nearest-neighbour alignment alone produces a phase transition at a definite temperature, sharp only in the limit of a large system, while a one-dimensional chain never orders.
- **Prerequisites:** entropy
- **Related:** states-of-matter, neural-networks
- **Pitfall:** A one-dimensional chain has no phase transition at any temperature above zero; show that case so the reader does not believe order is automatic.
  > Nearest existing: states-of-matter: freezes and boils a box of molecules; this page strips a transition down to the simplest possible model and shows the critical point's divergences.
  > Why: MIT OCW RES.8-010 Introduction to Statistical Physics, lecture 8 on the Ising model via its partition function: https://www.ocw.mit.edu/courses/res-8-010-introduction-to-statistical-physics-summer-2018/mitres_8_010su18_lec8.pdf

#### lasers

- **Title:** Lasers
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Pump a four-level gain medium between two mirrors and watch the populations and the photon number evolve under the rate equations: below threshold the cavity holds a few spontaneous photons, and at threshold the inversion clamps while the output climbs linearly with pump power. Lower the mirror reflectivity, switch to a three-level or a two-level medium, or open and close a shutter to see relaxation oscillations and a Q-switched pulse.
- **Takeaway:** A laser is a cavity in which stimulated emission out-competes loss, and above that threshold the inversion stops growing and nearly every extra pumped atom adds a photon to the same mode.
- **Prerequisites:** quantum-mechanics, oscillations-resonance
- **Related:** semiconductors, solar-cells
- **Pitfall:** Population inversion is impossible by pumping a two-level system at any power; the page must show the two-level case saturating at equal populations.
  > Nearest existing: solar-cells: a junction turns photons into current; this is the inverse, a medium amplifying light, and the LED half of the Reserve item is a sentence in semiconductors, not a page.
  > Why: PhET 'Lasers' is in its quantum collection, and MIT OCW 6.977 builds threshold and inversion from the rate equations: https://ocw.mit.edu/courses/6-977-semiconductor-optoelectronics-theory-and-design-fall-2002/

### Chemistry & Materials

#### dissolving-sugar-and-salt

- **Title:** Dissolving: where does the sugar go?
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Two glasses of water drawn as particles, one for sugar and one for salt, and a spoonful counter under each. One control at a time: tip in another spoonful, then slide the thermometer to warm both glasses. Each grain breaks into particles that wander off among the water particles until the water will take no more, and the rest sits on the bottom. Warming lets the sugar glass take spoonful after spoonful more, while the salt glass hardly takes any extra. At the end, let the water dry away and watch the same particles gather back into grains.
- **Takeaway:** Dissolved sugar and salt have not vanished: their particles are spread among the water's, each glass of water takes only so much, and warming lets it take far more sugar but hardly any more salt.
- **Prerequisites:** none
- **Related:** states-of-matter, salt-and-ice
- **Needs:** Solubility of sucrose and of sodium chloride in water from 0 to 100 °C (about a dozen values) from the IUPAC-NIST Solubility Data Series, freely readable at NIST, or the ACS Middle School Chemistry tables; published facts, no dataset licence to clear.
- **Pitfall:** Dissolving is not melting, and the sugar does not disappear or turn into water: every particle is still there, which is why the water tastes sweet and weighs more. A full glass is not 'out of room' between water particles: it stops because dissolving and grains re-forming have come into balance.
  > Leads to: states-of-matter, chemical-bonds
  > Nearest existing: states-of-matter: that page changes the phase of one substance; this page mixes two solids into water and shows that temperature raises how much sugar water will take but barely changes salt. (The pool's dissolving-sugar was merged into this entry.)
  > Why: England KS2 Year 5 'Properties and changes of materials' (dissolving; recovering a dissolved solid by evaporation): https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study; also NGSS 5-PS1-3 (solubility as an identifying property): https://www.nextgenscience.org/dci-arrangement/5-ps1-matter-and-its-interactions
  > Data: About a dozen tabulated solubility values (IUPAC-NIST Solubility Data Series via NIST; ACS Middle School Chemistry, chapter 5 lesson 6); facts, no licence needed.

#### salt-and-ice

- **Title:** Salt on ice: roads and ice cream
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A block of ice drawn as a neat stack of water particles, with a thermometer. One control at a time: sprinkle salt, and salt particles get between the water particles at the surface so the stack cannot re-form, and the ice melts although the thermometer reads below freezing. Set the weather colder and the salt stops working; pour on more salt and see the point where extra salt no longer helps. Then put a bag of cream into the salted ice: the melting pulls heat out of the cream, the bath's thermometer drops below what plain ice could reach, and the cream freezes. Behind the picture runs the measured freezing-point curve of salt water and a running count of the heat that melting takes from the bath and the cream.
- **Takeaway:** Salt gets in the way of water re-freezing, so salted ice melts below freezing, and that melting draws so much heat out of its surroundings that a salt-and-ice bath gets colder than ice, cold enough to freeze cream.
- **Prerequisites:** none
- **Related:** dissolving-sugar-and-salt, why-metal-feels-cold
- **Needs:** Freezing point of salt water against salt content (NaCl brine table and its lowest point, about minus 21 °C), from the US FHWA 'Manual of Practice for an Effective Anti-icing Program' (US government work, public domain).
- **Pitfall:** Salt does not heat the ice or 'burn' through it, and it does not work at any cold: below about minus twenty, no amount of salt will melt ice.
  > Leads to: states-of-matter
  > Nearest existing: states-of-matter: that page melts a pure substance by raising its temperature; here the ice melts because of what is added to it, at a temperature where pure ice would stay solid.
  > Why: Scientific American / Science Buddies 'Making Ice Cream in a Bag' (freezing-point depression for children): https://scientificamerican.com/article/scrumptious-science-making-ice-cream-in-a-bag/
  > Data: US FHWA brine freezing-point table, public domain US government work: https://www.fhwa.dot.gov/publications/research/safety/95202/005.cfm

#### why-metal-feels-cold

- **Title:** Why metal feels cold
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** A table with a metal spoon, a wooden spoon, a plastic cup and a woollen glove, all at room temperature, with a thermometer that reads the same on each. Drag a finger onto any one: a strip of heat colour flows out of the fingertip into the object, fast into the metal and barely at all into the wool, and a 'feels like' dial follows the temperature where skin meets object. One control: the room temperature. Warm the room past the temperature of your hand and the order flips, so the same metal now feels hottest. The flow is a heat-conduction model in which each material uses its real conductivity, density and heat capacity.
- **Takeaway:** Everything on the table is the same temperature; the metal feels cold because it draws heat out of your finger fastest, and when the room is warmer than your hand the same metal feels hottest.
- **Prerequisites:** none
- **Related:** salt-and-ice
- **Needs:** Thermal conductivity, density and specific heat of skin, a metal (steel or aluminium), wood, plastic and wool: under twenty published constants from textbook tables or Wikipedia's material-property tables (CC BY-SA). The model combines them, because contact temperature depends on all three.
- **Pitfall:** Metal is not colder than wood, and cold does not flow into your hand: heat flows out of it, and a thermometer shows the two objects equal. The page also should not say conductivity alone decides it: how much heat the material soaks up per degree matters too.
  > Leads to: states-of-matter
  > Nearest existing: entropy: that page shows heat flowing between fast and slow particles at level 2; here it is one finger on one object, and the only question is how fast heat leaves the skin.
  > Why: Veritasium, 'Why Does Metal Feel Colder Than Wood If They're the Same Temperature?' (a classic misconception video): https://www.youtube.com/watch?v=vqDbMEdLiCs; England KS2 Year 5 lists thermal conductivity among material properties.
  > Data: Under twenty published material constants (textbook tables; Wikipedia CC BY-SA); facts, no dataset

#### chromatography

- **Title:** Chromatography: separating by stickiness
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Inject a mixture at the top of a column and watch each molecule hop at random between the moving phase and the stationary phase. The time each one spends stuck is set by its partition coefficient, so the bands separate and broaden, and a detector at the end draws the chromatogram. Slide the flow rate and the measured plate height traces the van Deemter curve: diffusion along the column dominates at slow flow, slow exchange at fast flow, and the uneven paths through the packing add a floor that the flow does not change. Lengthen the column or use finer packing to see the resolution improve.
- **Takeaway:** A column separates molecules by how much of the time each spends stuck rather than moving, and there is a best flow speed: slower and diffusion blurs the bands, faster and the molecules cannot keep up with the exchange.
- **Prerequisites:** central-limit-theorem, reaction-rates-equilibrium
- **Pitfall:** Most chromatography is not a sieve by size: two molecules of the same size separate because they stick differently. The bands are close to Gaussian only because each molecule makes many random hops that add up; with few exchanges or uneven sticky sites, real peaks tail.
  > Nearest existing: central-limit-theorem: that page shows why sums of random steps are Gaussian; this one uses that fact to separate molecules and to find the flow rate that separates them best.
  > Why: Undergraduate analytical chemistry teaches band broadening through the van Deemter equation (Bates College chromatography learning objectives): https://www.bates.edu/chemistry-biochemistry/files/2012/01/wenzel-chrom-learning-objectives.pdf

#### dislocations-alloys

- **Title:** Dislocations: why metals bend and alloys resist
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Shear a two-dimensional crystal of simulated atoms that contains an edge dislocation, and watch the defect glide one row of bonds at a time while a gauge shows the stress it took. Remove the dislocation, and the perfect crystal holds to a far higher stress before a whole plane slips at once. Sprinkle in larger or smaller foreign atoms and the dislocation snags on them, so the gauge must climb higher before it moves. Add a second and third dislocation and drive them against a row of obstacles, where they pile up and resist further slip.
- **Takeaway:** A crystal with a dislocation yields at a small fraction of the stress a perfect crystal needs, because the defect breaks one row of bonds at a time, and foreign atoms raise that stress by pinning it.
- **Prerequisites:** semiconductors, states-of-matter
- **Related:** bridges-structures
- **Pitfall:** Crystals do not deform by whole planes sliding at once; the theoretical strength computed that way is a thousand times higher than what any real metal shows.
  > Nearest existing: bridges-structures: that page colors members by stress; this one goes inside the metal to the defect that lets it yield and the atoms that stop it.
  > Why: MITx 3.012S.3x Structure of Materials covers dislocation descriptors and motion: https://openlearninglibrary.mit.edu/courses/course-v1:MITx+3.012S.3x+1T2019/about

#### huckel-molecular-orbitals

- **Title:** Molecular orbitals & conjugation
- **Level:** 3
- **Kind:** build
- **Interaction:** Snap carbon atoms into chains and rings to build a π system (ethene, butadiene, benzene, cyclobutadiene, the cyclopentadienyl anion, a cyanine dye); the page diagonalizes the Hückel matrix and draws the molecular orbitals as signed lobes on the atoms beside an energy ladder filled with the π electrons. Lengthen a cyanine chain and watch the HOMO-LUMO gap shrink beside the dye series' measured absorption maxima and a swatch of the colour it absorbs; close a chain into a ring and add or remove electrons to see which counts fill a closed shell and which leave two electrons alone in a degenerate pair.
- **Takeaway:** Electrons delocalized over a π system fill a ladder of orbitals whose gap narrows as the system grows, which is why longer dyes absorb redder light, and a ring is stabilized only when its π electrons exactly fill a closed shell (2, 6, 10: benzene) and destabilized when they half-fill a degenerate pair (4, 8: cyclobutadiene).
- **Prerequisites:** chemical-bonds, linear-transformations, quantum-mechanics
- **Related:** carbon-polymers, semiconductors
- **Needs:** Measured absorption maxima of a cyanine dye series for the color panel, to set beside the computed gap.
- **Pitfall:** Benzene's bonds do not alternate between single and double; the orbitals spread over the whole ring, and the two Kekulé drawings are a convention, not structures it flips between.
  > Nearest existing: chemical-bonds: that page builds molecules from localized electron pairs and VSEPR shapes; this one computes delocalized orbital energies and shapes from the Hückel Hamiltonian.
  > Why: MIT OCW 5.61 Physical Chemistry devotes Lecture 26 to qualitative MO theory (Hückel): https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/resources/qualitative-mo-theory-huckel/
  > Data: Published λmax values of the classic cyanine dye series (literature numbers, not a licensed dataset); the Hückel model itself needs no data.

#### surface-catalysis

- **Title:** Catalysis on a surface
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run CO oxidation on a lattice of catalyst sites: CO lands on one empty site, O2 splits onto two neighbouring empty sites, and adjacent CO and O react into CO2 and leave (the Ziff-Gulari-Barshad model). Slide the CO fraction in the gas: with too little CO the surface fills with oxygen and goes dead, across a narrow window the CO2 rate climbs, and just past its peak it collapses abruptly as CO covers every site, with the lattice's rate and coverages plotted beside the smooth mean-field Langmuir-Hinshelwood prediction that misses both dead ends. Add a CO desorption rate (a hotter surface) and watch the abrupt collapse soften and the poisoned surface recover.
- **Takeaway:** A catalyst works by holding the reactants next to each other on its surface, and too much of one reactant can cover every site and stop the reaction entirely.
- **Prerequisites:** reaction-rates-equilibrium
- **Related:** transition-state-theory
- **Pitfall:** A catalyst is not consumed, but it is not inert either: its activity depends on what covers it, and a poisoned surface is a catalyst that has stopped working.
  > Nearest existing: reaction-rates-equilibrium: that page's catalyst only lowers a barrier; this one models the surface sites, their coverage and the poisoning that follows.
  > Why: MIT OCW 10.37 Chemical and Biological Reaction Engineering covers heterogeneous catalysis and Langmuir-Hinshelwood kinetics: https://ocw.mit.edu/courses/10-37-chemical-and-biological-reaction-engineering-spring-2007/pages/lecture-notes

#### transition-state-theory

- **Title:** Reaction trajectories & the transition state
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Fire a quasiclassical trajectory of A + BC → AB + C across a potential-energy surface (LEPS model of H + H2 and F + H2) drawn as a contour map, choosing how much energy goes into translation and how much into vibration (never less than the zero-point vibration), and see whether it crosses the saddle or turns back. Compare the early barrier of F + H2 with the late barrier of its reverse, H + HF, to see that translation carries molecules over an early pass and vibration over a late one; sweep the temperature to watch the Eyring rate climb, and swap H for D to watch the zero-point energies, the effective barrier and the rate change.
- **Takeaway:** A reaction is a journey over a mountain pass on an energy landscape; the pass's height sets how often molecules make it and its position sets which kind of energy gets them over.
- **Prerequisites:** reaction-rates-equilibrium, newtons-laws
- **Related:** surface-catalysis
- **Needs:** LEPS (Sato) parameters for the H3 and FH2 surfaces.
- **Pitfall:** The transition state is not an intermediate that can be isolated; it is the top of the pass, crossed in a single vibration, and a catalyst lowers the pass rather than pushing molecules over it.
  > Nearest existing: reaction-rates-equilibrium: that page draws a 1D energy profile beside colliding balls; this one computes the 2D surface and real trajectories over it, with the isotope effect as a bonus.
  > Why: MIT OCW 5.60 covers rates of chemical reactions and transition-state theory (Lectures 33-35): https://ocw.mit.edu/courses/5-60-thermodynamics-kinetics-spring-2008/resources/lec33_th
  > Data: Published LEPS/Sato parameters for H + H2 and F + H2 (journal numbers; no licensed dataset).

### Biology

#### ant-trails

- **Title:** How ants find the shortest way
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Ants wander out of a nest at random; one that finds the sugar walks home laying a scent, and the others tend to follow scent, so a trail forms and thickens. Drag the sugar farther away or drop a pebble on the trail and watch the colony reroute. Then offer a long bridge and a short one together and count the ants on each: ants on the short one get back first, so its scent builds up sooner and the short one wins. Open the short bridge only after a trail has formed on the long one, and the colony stays on the long one until the scent's fading is switched on.
- **Takeaway:** A colony finds the shorter path with no map and no ant that knows it: ants on the short route return sooner, so its scent builds up faster and draws more ants, and a fading scent lets the colony give up an old route.
- **Prerequisites:** none
- **Related:** flocking-birds, graph-search, be-the-bird-camouflage
- **Pitfall:** No ant knows where the food is or compares the routes, and the queen gives no orders. Fading is not what makes the short bridge win when both are offered at once; it is what lets a colony switch to a shortcut that appears later, and real Argentine ants often do not. Real ants also use sight and memory, which the page leaves out and says so.
  > Leads to: graph-search, ecosystems
  > Nearest existing: graph-search: an algorithm explores a map systematically to find the shortest route; this page finds one with many simple agents and a fading scent, with no map at all.
  > Why: The NetLogo Ants model, a standard classroom agent model of pheromone trails (Deneubourg's double-bridge experiment): https://ccl.northwestern.edu/netlogo/models/Ants

#### be-the-bird-camouflage

- **Title:** Camouflage: you are the hungry bird
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Moths of many shades rest on a tree trunk and the reader is the bird: tap every moth you spot before the timer runs out. The survivors lay eggs that look like their parents, give or take a little, and the next generation appears; after a few rounds the reader flips the bark from pale to sooty and keeps hunting.
- **Takeaway:** The moths you fail to see are the ones that have babies, so after a few generations the moths match the bark, and when the bark changes, so do the moths.
- **Prerequisites:** none
- **Related:** evolution, flocking-birds, ant-trails
- **Needs:** Bark textures, either procedurally generated or public-domain or CC0 photographs from Wikimedia Commons; the moth population model needs no data.
- **Pitfall:** A moth does not change colour to hide, and no moth chooses its colour; the population changes because the visible ones are eaten before they breed.
  > Leads to: evolution, meiosis-inheritance
  > Nearest existing: evolution: that page runs a population with sliders for mutation, population size and environment; here the reader is the predator, and the selection is their own clicking, which is the level-0 doorway into that page.
  > Why: England national curriculum, KS2 Year 6 'Evolution and inheritance': identify how animals and plants are adapted to suit their environment and that adaptation may lead to evolution (https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study); NGSS MS-LS4-4 (https://www.nextgenscience.org/pe/ms-ls4-4-biological-evolution-unity-and-diversity).

#### fireflies-in-sync

- **Title:** Fireflies that flash together
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A meadow of fireflies, each with its own inner clock that flashes when it strikes twelve and starts again. One control: how much a neighbour's flash nudges a firefly's clock forward. At zero the meadow twinkles at random; turn it up and patches start flashing together, then waves, then the whole field as one; drag a finger through the swarm to scramble it and watch it fall back into step.
- **Takeaway:** Thousands of fireflies flash together with no conductor, because each one nudges its own clock a little toward every flash it sees.
- **Prerequisites:** none
- **Related:** flocking-birds
- **Pitfall:** There is no lead firefly and no outside signal; synchrony appears only from each insect reacting to its neighbours. Only some firefly species do this.
  > Leads to: oscillations-resonance
  > Nearest existing: oscillations-resonance: one oscillator pushed at a frequency; this page is many self-timed flashers nudging each other into step, which is not resonance. The runner-up kuramoto-synchronization (level 3) is the grown-up phase-coupled model.
  > Why: Nicky Case's 'Fireflies' explorable (public domain), the interactive credited in Veritasium's synchronization video: https://ncase.me/fireflies/

#### flocking-birds

- **Title:** Flocks without a leader
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A hundred birds fly across the stage following three rules, each drawn as a short arrow on one highlighted bird: keep a little distance from your neighbours, fly the way they fly, drift toward the middle of them. Switch one rule off at a time: without the first the birds pile into clumps, without the second the flock never agrees on a direction, without the third it scatters. Add a hawk and watch the flock split around it and close again with no bird in charge.
- **Takeaway:** A flock can hold together and turn as one with no leader: in the model, three simple rules about each bird's nearest neighbours are enough to make one.
- **Prerequisites:** none
- **Related:** ant-trails, fireflies-in-sync, ecosystems, be-the-bird-camouflage
- **Pitfall:** No bird leads or sees the whole flock, and the three rules are a model that reproduces flocking, not a list real birds were found to obey. Real starlings each keep track of about six or seven nearest neighbours, however far apart they are (Ballerini et al. 2008), and nobody plans the shapes of a murmuration.
  > Leads to: ecosystems
  > Nearest existing: ecosystems: populations tied together by birth and predation rates; this page is the movement of one group where each animal follows a rule about its neighbours, with no population counts at all.
  > Why: NGSS 3-LS2-1 (some animals form groups that help members survive); Reynolds's boids is the classic classroom model of it (MIT StarLogo activity): https://www.nextgenscience.org/pe/3-ls2-1-ecosystems-interactions-energy-and-dynamics

#### diffusion-osmosis

- **Title:** Diffusion, osmosis & active transport
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Drop dye into one corner of a box of jiggling particles and watch it spread, faster when warmer, while a concentration graph flattens. Put a membrane down the middle with pores that pass water but not sugar, set the sugar concentration on each side and watch the water level rise on the sugary side; then make the box a cell, place it in pure water, salt water and something in between, and see it swell, shrink or hold, as a potato slice does in the classroom experiment. Finally switch on a pump that carries particles against the gradient and watch its ATP meter drain.
- **Takeaway:** Particles spread from where they are crowded to where they are not by random motion alone; a membrane that holds dissolved particles back makes water flow toward the side with more of them; and moving anything the other way costs energy.
- **Prerequisites:** the-cell, states-of-matter
- **Related:** entropy, respiration-atp
- **Pitfall:** Osmosis moves water toward the side with more dissolved particles, but not because those particles 'dilute' the water so that fewer water molecules reach the pore: the flow is far larger than water's own diffusion would give, and it comes from the trapped particles pushing on the membrane. Diffusion needs no force or pump; particles have no direction of their own, and the net flow is a counting effect. A plant cell in pure water becomes firm rather than bursting, because of its wall.
  > Nearest existing: entropy (level 2) shows two gases mixing as a count of microstates and the-cell shows the membrane as a structure; neither has a membrane that passes water and holds solute, a cell that swells or shrinks, or a pump that spends ATP. The pool's smells-and-diffusion (level 0) spreads a smell without the membrane.
  > Why: AQA GCSE Biology 8461 topic 4.1.3 'Transport in cells' (diffusion, osmosis, active transport) with Required practical 3, osmosis in plant tissue https://www.edplace.com/gcse-revision/biology/aqa

#### pcr-copying-dna

- **Title:** PCR: copying DNA until there is enough to see
- **Level:** 1
- **Kind:** step
- **Interaction:** A tube with a few strands of DNA and a thermometer: step through one cycle (heat to split the strands, cool so short primers stick at the ends of the target, warm for the enzyme to extend them) and two strands become four; press play and the count doubles every cycle while the plot shoots up and the primers and building blocks run down. Set the starting number of copies and see when the glowing signal crosses the detection line: one copy takes about ten cycles longer than a thousand, which is how a PCR test reads how much virus was in the swab. Change the primers and a non-matching DNA stays uncopied.
- **Takeaway:** PCR copies a chosen stretch of DNA by doubling it every heating-and-cooling cycle, so thirty cycles turn a few molecules into a billion, and the cycle at which the signal appears says how many there were to start with.
- **Prerequisites:** dna-to-protein
- **Related:** epidemics
- **Pitfall:** Doubling is not forever: primers and nucleotides run out and the curve flattens, so the plateau says nothing about the starting amount; only the threshold cycle does. A Ct value is not a measure of how ill someone is. Nor is every copy the target from the first cycle: the short piece bounded by both primers only appears from the third cycle, after which it dominates.
  > Nearest existing: dna-to-protein: how DNA is read into protein; this page is how a chosen piece of DNA is copied in a tube and counted. dna-sequencing (pool, level 3) reads the letters; PCR only multiplies a chosen piece.
  > Why: 'How does a PCR test work' became a mass question in 2020; public-health explainer of cycles and Ct values: https://www.publichealthontario.ca/en/About/News/2021/Explained-COVID19-PCR-Testing-and-Cycle-Thresholds

#### bacterial-chemotaxis

- **Title:** Bacterial chemotaxis
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Release a few hundred E. coli into a dish with a drop of attractant and watch each one run straight, tumble, and run again; inside each cell a Barkai-Leibler receptor model sets the tumble rate, and the swarm drifts up the gradient. Move the drop, flood the dish with a uniform dose and watch the tumble rate dip then recover exactly (perfect adaptation), and change the adaptation time or the swim speed to see the biased random walk fail.
- **Takeaway:** A bacterium is too small to sense a gradient across its body, so it compares now with a moment ago and tumbles less when things are getting better; that biased random walk is enough to climb a gradient.
- **Prerequisites:** the-cell
- **Related:** feedback-control, homeostasis
- **Pitfall:** The cell does not steer toward the attractant: it cannot tell direction, it only changes how often it tumbles, and the page must not draw it turning toward the source.
  > Nearest existing: ecosystems: that page moves animals on a field by population rates; here each cell's movement follows an internal signalling model and the collective drift emerges from it.
  > Why: CourseSource lesson on building and simulating a chemotaxis model in Cell Collective (QUBES): https://qubeshub.org/publications/5179/

#### lac-operon

- **Title:** Gene regulation & the lac operon
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Set the glucose and lactose in a bacterium's medium and watch an ODE model of the lac operon respond: the repressor leaves the operator when an inducer is present, the permease the operon makes imports more inducer, and while glucose is flowing in the glucose transporter blocks that permease (inducer exclusion), with CAP-cAMP giving a smaller extra boost when glucose is scarce. Sweep the gratuitous inducer TMG up and then down to trace the hysteresis loop, and grow a culture on both sugars to see the diauxic pause when the glucose runs out.
- **Takeaway:** A bacterium switches a set of genes on only when their product is useful and nothing better is around, and positive feedback through its own transporter turns that switch into a memory: the same inducer level can leave the operon on or off depending on where it came from.
- **Prerequisites:** dna-to-protein, reaction-rates-equilibrium
- **Related:** crispr
- **Pitfall:** Bistability and hysteresis were measured with the gratuitous inducer TMG; with plain lactose the loop is weak or absent because lactose is also consumed, so the page must not present lactose itself as a memory switch. Nor should it pin the diauxic pause on cAMP and CAP alone: in E. coli it comes mainly from inducer exclusion, where glucose uptake blocks the lactose permease.
  > Nearest existing: dna-to-protein: that page reads one gene into a protein; this one is about when the gene is read at all, as a dynamical switch with feedback (model of Ozbudak et al. 2004). genetic-circuits (pool) builds synthetic switches from parts; this is the natural operon, with two sugar signals and diauxic growth.
  > Why: MIT OCW 7.01SC Fundamentals of Biology, module 'Gene Regulation and the Lac Operon': https://ocw.mit.edu/courses/7-01sc-fundamentals-of-biology-fall-2011/resources/molecbio_sess5

#### morphogen-gradients

- **Title:** Morphogen gradients & positional information
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the production rate, diffusion constant and lifetime of a morphogen made at one end of a row of cells and watch its concentration profile settle into an exponential whose length scale, the square root of diffusion over decay, the page reports. Set two or three thresholds and the cells paint themselves in bands, Wolpert's French flag. Double the tissue's length and the bands fail to scale; switch on Ben-Zvi and Barkai's expansion-repression circuit (a second diffusing 'expander' that widens the gradient and is shut off by the morphogen) and the bands stay in proportion. Add noise to the concentration and see that boundaries where the gradient is steep stay sharp while those in its flat tail blur.
- **Takeaway:** A cell can learn where it is from how much of one substance reaches it, and the shape of that gradient, set by diffusion and decay, decides where the boundaries fall.
- **Prerequisites:** the-cell, dna-to-protein
- **Needs:** No data needed: a 1D synthesis-diffusion-degradation PDE plus the expansion-repression model (Ben-Zvi & Barkai 2010, PNAS), both run live. Optional comparison: published Bicoid length scales (about 20% of egg length, Gregor et al. 2007), quoted as numbers with citation.
- **Pitfall:** The synthesis-diffusion-degradation model is a working hypothesis and the Bicoid gradient's formation is still debated; the page must present the exponential as what the model predicts and say where it is tested.
  > Nearest existing: the-cell: that page zooms into one cell; this one shows how thousands of cells in a row find out which part of the body they are making.
  > Why: Stanford course on morphogenesis listing morphogen gradients and Turing patterns: https://bulletin.stanford.edu/courses/2126934

#### population-genetics

- **Title:** Population genetics: drift & selection
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a hundred Wright-Fisher populations at once as allele-frequency traces: with no selection they wander and fix at random, faster in small populations; with a selection coefficient s they bend toward fixation, and a counter shows the share of new beneficial mutations that fix, approaching Haldane's 2s however large the population, so most are lost anyway. Set dominance to see recessive alleles hide from selection, and compare the Hardy-Weinberg genotype frequencies with the simulated ones each generation.
- **Takeaway:** Allele frequencies change by chance as well as by selection: in a small population chance can fix a harmful allele or lose a good one, and even in a large population most new beneficial mutations vanish while they are still rare.
- **Prerequisites:** meiosis-inheritance, evolution, central-limit-theorem
- **Related:** cancer
- **Pitfall:** Hardy-Weinberg is not 'evolution stops': it is the one-generation baseline that shows which forces are absent, and drift is not selection by another name; the page must keep them separate.
  > Nearest existing: evolution: that page shifts a trait distribution with predators and food; this one tracks a single allele's frequency and separates chance from selection with explicit N and s.
  > Why: Cal State LA BIOL 415 Population Genetics syllabus (Hardy-Weinberg, drift, effective size, selection, coalescent): https://www.calstatela.edu/sites/default/files/syllabibiol415.pdf

#### turing-patterns

- **Title:** Turing patterns
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run an activator-inhibitor reaction-diffusion system on a grid from near-uniform noise and watch spots or stripes crystallise. Change the ratio of the two diffusion rates and the pattern appears only once the inhibitor spreads much faster than the activator; change the reaction rates to move from spots to stripes to labyrinths; grow the domain and extra stripes insert themselves, and taper the grid into a tail to see spots become bands as it narrows.
- **Takeaway:** Two chemicals, one that makes more of itself and a faster-spreading one that suppresses it, can turn a uniform field into regular spots or stripes with no blueprint, at a spacing set by their reaction and diffusion rates.
- **Prerequisites:** morphogen-gradients, reaction-rates-equilibrium
- **Related:** chaos-fractals
- **Pitfall:** Not every stripe in nature is a Turing pattern. The page should name where a Turing-type mechanism is well supported (digit spacing, hair and feather follicles) and where the evidence is mixed (fish skin, where pigment cells also move). It must not claim the mechanism for zebra stripes or fingerprints without saying that is contested.
  > Nearest existing: chaos-fractals: that page grows patterns by iterating a map; here they grow from a PDE with a definite wavelength, and the control is the diffusion ratio.
  > Why: University of Manchester undergraduate brochure feature on the Turing pattern: https://www.scieng.manchester.ac.uk/undergraduate-brochures/2024/the-turing-pattern/

### Body & Medicine

#### hearing-and-the-ear

- **Title:** How your ear hears
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Slide a tone from low to high and watch it shake the big eardrum, which passes the shake through three tiny bones onto a much smaller window into the fluid of the snail-shaped cochlea, concentrating the push; a ripple then runs along the cochlea's ribbon until it peaks at one spot. Each pitch peaks somewhere else, high notes near the entrance and low notes at the far end. Play two notes at once and see two bumps; turn the loudness up and the bumps grow.
- **Takeaway:** The ear sorts sounds by pitch before the brain hears them: each note makes a different place along the spiral wiggle.
- **Prerequisites:** none
- **Related:** vibrations-and-sound, cochlea-hearing, vision-color, why-spinning-makes-you-dizzy
- **Pitfall:** The cochlea is not a microphone with one signal: it is thousands of sensors each listening at its own spot. Loud is not the same as high: loudness mainly grows the bump, pitch moves it. And the little bones are not the main amplifier: most of the boost comes from a big eardrum pushing on a tiny window.
  > Leads to: waves-interference, oscillations-resonance
  > Nearest existing: waves-interference: that page is the wave in the air; this one is the receiver, from eardrum to the place-by-pitch map. The reserve item Hearing and the cochlea merges here at level 0; the cochlea's own mechanics (travelling wave, active amplifier) stay open for a level-3 page.
  > Why: NGSS MS-LS1-8: sensory receptors respond to stimuli, with ear receptors reacting to vibrations. https://nyssls.info/index.php/MS-LS1-8

#### muscles-pull-in-pairs

- **Title:** Muscles pull in pairs
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag the hand of a cutaway arm: bending the elbow, the biceps shortens and bulges; straightening it against a push, such as pressing down on a table or pushing up from a chair, the triceps shortens instead, and tugging either muscle alone shows it can only pull, never push. Hang a bag of shopping from the hand and watch the biceps pull many times the bag's weight, because it grips the forearm so close to the elbow; lower the bag slowly and the biceps is still the one pulling, getting longer as it lets the bag down.
- **Takeaway:** A muscle can only pull, so every joint needs a pair that take turns, and the one that grips near the elbow must pull far harder than the weight in your hand.
- **Prerequisites:** none
- **Related:** bridges-structures
- **Pitfall:** Muscles never push; the opposite movement is another muscle pulling, or gravity. Lowering a bag slowly is the biceps braking while it lengthens, not the triceps pushing it down. And a bigger muscle does not change the lever: it still pulls from the same place.
  > Leads to: newtons-laws, bridges-structures
  > Nearest existing: bridges-structures: that page colours beams by tension and compression under a load; this one is a living lever with two pullers, and the load is a shopping bag.
  > Why: England KS3 programme of study: the function of muscles and examples of antagonistic muscles. https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study

#### why-spinning-makes-you-dizzy

- **Title:** Why spinning makes you dizzy
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Spin a head on a chair with a slider and watch the fluid in the ear's three rings lag behind, bending the little flap that tells the brain turning; keep spinning at a steady speed and the fluid catches up, so the feeling fades. Stop suddenly and the fluid keeps going, the flap bends the other way, and the brain reports turning in the opposite direction while the room stands still: that is dizzy.
- **Takeaway:** Your ears sense turning with a ring of fluid, and when you stop spinning the fluid keeps going, so you feel you are turning the other way.
- **Prerequisites:** none
- **Related:** hearing-and-the-ear, oscillations-resonance, newtons-laws
- **Pitfall:** Dizziness after spinning is not blood sloshing or the brain being overwhelmed by speed: the sensor is faithfully reporting a real movement of fluid that is no longer the head's movement.
  > Leads to: oscillations-resonance, newtons-laws
  > Nearest existing: oscillations-resonance: that page drives a spring; this one is a sensor's lag, with the same inner ear as hearing-and-the-ear but a different organ in it.
  > Why: Demand: a standing Life's Little Mysteries question. https://www.livescience.com/33828-spinning-dizzy.html

#### why-you-get-sleepy

- **Title:** Why you get sleepy
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Set a bedtime and a wake-up time and run three days: a sleep-pressure tank fills while you are awake and drains while you sleep, and a body clock sets the hours when sleep comes easily; sleepiness is the gap between them. Skip a night and watch the tank overflow; nap in the afternoon and see tonight's sleep come later. A strip under the plot sketches the night's usual rounds of light and deep sleep, about ninety minutes each.
- **Takeaway:** Sleepiness is a pressure that builds all day and drains at night, gated by a clock that opens a window for it; when the two disagree you lie awake tired or nod off at noon.
- **Prerequisites:** none
- **Related:** homeostasis
- **Pitfall:** The page explains when you get sleepy, not why animals sleep at all, which is still an open question. And the body clock is not fixed: late mornings and evening screen light push it later, which is why a weekend of lie-ins makes Monday feel like jet lag (the toy keeps the clock fixed, and says so).
  > Leads to: homeostasis
  > Nearest existing: homeostasis: that page is a feedback loop around blood sugar over hours; this one is a pressure and a clock over days, with no hormones shown.
  > Why: England statutory RSHE and health education guidance, primary health education: the importance of sufficient good quality sleep for health, the amount of sleep recommended for their age, and practical steps for improving sleep. https://www.gov.uk/government/publications/relationships-education-relationships-and-sex-education-rse-and-health-education

#### pharmacokinetics-dosing

- **Title:** Pharmacokinetics & dosing
- **Level:** 2
- **Kind:** build
- **Interaction:** Place doses on a timeline from a palette (an injection, a tablet, a steady drip, a loading dose) and run them through a one-compartment model whose clearance, volume of distribution and absorption rate are sliders; the blood level is plotted against the drug's therapeutic window. Change the interval, miss a dose or halve the clearance to model a failing kidney, and watch the level, the time to steady state and the peaks and troughs respond; a last switch makes elimination saturable and shows the rules break.
- **Takeaway:** Repeated doses pile up until elimination balances intake, and for most drugs that steady state arrives after about four or five half-lives whatever the dose, so the dose sets the level and the half-life sets how long it takes to get there.
- **Prerequisites:** calculus, radioactivity
- **Related:** homeostasis
- **Needs:** Clearance, volume of distribution and half-life for four or five example drugs, taken from their US prescribing information.
- **Pitfall:** Doubling the dose of a normally eliminated drug doubles the steady-state level but does not reach it any sooner; only a loading dose shortens the wait. For drugs with saturable elimination (phenytoin, alcohol) neither rule holds.
  > Nearest existing: homeostasis: that page doses insulin by hand against a glucose loop; this page models what happens to any drug's concentration after a dose, with no body response in the loop.
  > Why: MIT OCW HST.151 Principles of Pharmacology lists pharmacokinetics, dose–response and drug delivery as core topics: https://ocw.mit.edu/courses/hst-151-principles-of-pharmacology-spring-2005/
  > Data: openFDA drug label API (FDA, CC0 1.0): https://open.fda.gov/apis/drug/label/ ; the same labels are viewable on DailyMed (https://dailymed.nlm.nih.gov/). The few numeric parameters are facts, not copyrightable.

#### cerebellum-motor-learning

- **Title:** The cerebellum & motor learning
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Move the mouse or a finger to targets while the cursor is secretly rotated by thirty degrees, and watch yourself miss, correct and adapt over a few dozen reaches; beside the hand, a two-rate error-driven model (a fast and a slow learner) updates its prediction trial by trial and its curve sits over the reader's own. Remove the rotation and say 'aim straight': the aftereffect that remains is the implicit, cerebellar part. Reverse the rotation briefly, then hide the errors, and both the model and the hand drift back toward the first adaptation as the fast learner fades and the slow one remains.
- **Takeaway:** An implicit learner nudges its prediction a little after every miss, and the aftereffect that survives being told the world is back to normal shows a correction that was learned, not reasoned.
- **Prerequisites:** neurons, feedback-control
- **Related:** gradient-descent, reinforcement-learning
- **Pitfall:** Not all of the reader's correction comes from the cerebellum: much of the quick early improvement under a large rotation is deliberate re-aiming, and only the slow, implicit part persists as an aftereffect when the reader is told the rotation is gone.
  > Nearest existing: reinforcement-learning: that agent learns from reward alone; here the error itself is the teaching signal and the learner is the reader's own hand.
  > Why: Motor adaptation and the cerebellum are standard neuroscience-course content and a high-traffic reference topic: https://en.wikipedia.org/wiki/Motor_learning

#### cochlea-hearing

- **Title:** Hearing & the cochlea
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Play a tone, a chord or a spoken word into a cochlea modelled as a chain of coupled resonators whose stiffness falls along the basilar membrane, and watch the travelling wave peak at a place that depends on frequency. Drag the frequency and the peak moves; switch on the outer hair cells' amplification and the peak sharpens; kill the outer hair cells at the place tuned near 4 kHz, as loud noise does, and the audiogram develops the classic notch. Then replace the cochlea with a cochlear implant: split the sound into a few bands, drive one electrode per band, and hear the result.
- **Takeaway:** The cochlea sorts sound by frequency along its length, so pitch is a place, and a cochlear implant works by stimulating those places with a handful of electrodes.
- **Prerequisites:** waves-interference, fourier-transform, neurons
- **Related:** vision-color, compression, hearing-and-the-ear
- **Needs:** A short openly licensed speech clip for the implant demonstration (a LibriSpeech utterance, CC BY 4.0, or synthesized speech); the cochlear model itself is a standard one-dimensional transmission-line model with published parameters.
- **Pitfall:** Noise damage does not simply turn the volume down: the lost hair cells remove the amplification, so soft sounds vanish while loud ones still hurt.
  > Nearest existing: vision-color: that page builds an image and colour from three kinds of sensor; this page builds pitch from thousands of sensors in a row, each tuned by its position.
  > Why: MIT OCW HST.720 Physiology of the Ear covers cochlear mechanics and cochlear amplification as core sessions: https://ocw.mit.edu/courses/hst-720-physiology-of-the-ear-fall-2004/
  > Data: LibriSpeech, CC BY 4.0 (https://www.openslr.org/12), or speech synthesized in the browser; no other data

#### ecg-arrhythmias

- **Title:** The ECG & arrhythmias
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a sheet of heart muscle as an excitable medium (the Aliev–Panfilov equations on a grid) with a pacemaker, a fast conduction path and a slow atrioventricular node, and read a pseudo-ECG off it: the tissue's net electrical vector projected onto the three limb leads of Einthoven's triangle. Then break it: slow conduction in a patch, add a scar, fire an early beat into tissue that has only partly recovered and watch a spiral wave take over the trace as tachycardia and then break up into fibrillation; deliver a shock that excites every cell at once and lets the pacemaker take back control. Real annotated recordings from the MIT-BIH database sit beside the simulated traces for comparison.
- **Takeaway:** An ECG is the shadow of a wave of excitation crossing the heart, and the most dangerous fast rhythms are usually not a faster pacemaker but a wave that finds a loop and chases its own tail.
- **Prerequisites:** heart-circulation, neurons
- **Needs:** Annotated ECG records from the MIT-BIH Arrhythmia Database on PhysioNet (Open Data Commons Attribution License v1.0).
- **Pitfall:** A defibrillator does not restart a stopped heart: it stops a chaotic rhythm so the natural pacemaker can take over, and a flat line is not a shockable rhythm. And not every arrhythmia is re-entry: a heart can also beat too slowly when conduction is blocked.
  > Nearest existing: heart-circulation: that page shows a healthy ECG synchronized with the beating pump; this page computes the ECG from a model of the tissue and lets the reader break the rhythm.
  > Why: Rhythm interpretation and the conduction system are Cardiovascular-system content in the USMLE Step 1 content outline: https://www.usmle.org/pdfs/step-1/content_step1.pdf
  > Data: PhysioNet MIT-BIH Arrhythmia Database, ODC-By 1.0: https://physionet.org/content/mitdb/1.0.0/

#### mri-k-space

- **Title:** MRI: an image from spinning protons
- **Level:** 3
- **Kind:** step
- **Interaction:** Start where Medical imaging stops: one gradient turns position into frequency. Step through a real 2D pulse sequence on a phantom: a slice-selective pulse tips the protons, a phase-encoding gradient gives each row its own twist, and a readout gradient records one line of the slice's 2D Fourier transform. Watch k-space fill line by line beside the image that its inverse transform gives so far. A Bloch-equation view of a few spins shows them fan out and refocus into an echo. Then edit k-space: keep only the centre for a blurred image, only the edges for outlines, skip every other line to fold the image onto itself, or shrink the field of view until the head wraps around.
- **Takeaway:** An MRI scanner never measures a picture: gradients give each position its own precession frequency and phase, so every echo is one line of the image's 2D Fourier transform, and the centre of k-space carries the contrast while its edges carry the detail.
- **Prerequisites:** medical-imaging, fourier-transform, electromagnetism
- **Needs:** The Shepp-Logan phantom (a mathematical object, no data); optionally one real T1-weighted brain slice.
- **Pitfall:** MRI uses no ionizing radiation, and the image is not proton density alone. A point in k-space is not a pixel: every sample holds information about the whole image, which is why dropping lines blurs or ghosts the whole picture instead of leaving holes.
  > Nearest existing: medical-imaging: that page already shows Larmor precession, a single gradient whose Fourier transform gives a 1D water profile, and T1/T2 contrast from TR and TE; this page adds 2D phase-plus-frequency encoding, the echo, filling k-space line by line, and the artefacts of editing it. nmr-spectroscopy (pool, chemistry, level 3) has the same spins and pulses but no gradients and no image.
  > Why: 'How does an MRI work' is among the most-asked medical-technology questions, and k-space MRI theory is a standard biomedical-engineering course (Purdue BME 55500): https://engineering.purdue.edu/online/courses/tagged_items/magnetic-resonance-imaging-mri-theory
  > Data: Shepp-Logan: none. Real slice, if used: an OpenNeuro dataset (CC0), named on the page.

### Earth & Climate

#### cloud-base

- **Title:** Why clouds form, and why their bottoms are flat
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a bubble of air up from the warm ground: it swells and its thermometer drops about one degree for every hundred metres, until the invisible water it carries turns to droplets and the bubble turns white. Every bubble released from the same ground turns white at the same height, so the clouds have flat bottoms; make the day more humid and the cloud base drops, dry the air and clouds form higher or not at all. A last step blows the bubble over a mountain: it cools as it is pushed up the slope, rains on the side facing the wind, and comes down the far side drier and warmer than it started.
- **Takeaway:** Rising air swells and cools, and a cloud appears at exactly the height where the air gets cold enough for its water to turn into droplets, which is why the bottoms of clouds are flat.
- **Prerequisites:** none
- **Related:** sea-breeze
- **Pitfall:** It is not colder up a mountain because it is farther from the Sun: a few kilometres make no difference to sunlight; the air up there is cold because air that rises expands and cools. Clouds are not made of vapour: they are tiny droplets, each heavier than air, that stay up because they fall more slowly than the rising air beneath them.
  > Leads to: states-of-matter
  > Nearest existing: atmosphere-weather (level 2) shows global convection, pressure systems and fronts; this page follows one bubble of air and one cloud, with no Coriolis and no map.
  > Why: UCAR Center for Science Education, 'Clouds and How They Form' (https://scied.ucar.edu/learning-zone/clouds/how-clouds-form); NGSS MS-ESS2-4 on the changes of state in the water cycle.

#### forest-fire-spread

- **Title:** How a wildfire crosses a forest, or stops
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A square forest of trees on a grid; light the left edge and watch the fire pass from each burning tree to its neighbours, leaving ash. One control: how densely the trees are planted. At half density the fire burns a few trees and dies, at two-thirds it nearly always crosses the forest, and around six in ten it is a coin toss, with a tally of how far the fire got over many runs; then cut a firebreak and find the width that stops it, or add wind so the fire jumps one extra tree downwind.
- **Takeaway:** In a big forest, a fire's chance of crossing does not grow gradually with how many trees there are: it flips from almost never to almost always over a narrow band of density, so removing a few trees or cutting a gap can stop a fire that would otherwise get through.
- **Prerequisites:** none
- **Related:** epidemics
- **Pitfall:** The tipping density (about 59% for four neighbours on a square grid) belongs to the grid and the rule, not to forests; real fires also depend on wind, slope, moisture and fuel, which the page says it leaves out.
  > Leads to: epidemics, ecosystems
  > Nearest existing: epidemics: spread through a moving crowd with a threshold set by immunity; this page is spread on a fixed grid where the threshold is set by how many cells there are (percolation). Pool neighbours life-on-a-grid and cellular-automata are rule-based grids with no randomness or threshold; fire-triangle is what a fire needs chemically.
  > Why: The NetLogo Fire model, one of the most used models in the NetLogo library, documents the sharp transition near 59% density: https://ccl.northwestern.edu/netlogo/models/Fire

#### sea-breeze

- **Title:** Where wind comes from: the sea breeze
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A coast in cross-section, land on one side and sea on the other, filled with air drawn as drifting particles. Drag the Sun across the sky: by afternoon the land is warmer than the sea, the air over it rises, and air from the sea slides in underneath as a breeze that a flag on the beach shows. At night the land cools faster than the water and the breeze turns around and blows out to sea.
- **Takeaway:** Uneven heating is enough to make a wind: by day air slides in from over the cooler sea to replace the warm air rising over the land, and at night the land cools below the sea and the breeze turns around.
- **Prerequisites:** none
- **Related:** cloud-base
- **Pitfall:** Warm air does not rise because heat goes up: it rises because it is lighter than the cooler air around it, which pushes it up. And not every wind is a sea breeze: big weather systems are steered by Earth's spin, which this page leaves out.
  > Leads to: states-of-matter
  > Nearest existing: atmosphere-weather (level 2) heats a whole spinning globe into convection cells and winds with Coriolis; this page heats one beach and gets one wind, no rotation.
  > Why: NOAA JetStream, 'The Sea Breeze' (https://www.noaa.gov/jetstream/ocean/sea-breeze); NGSS MS-ESS2-5 on air masses moving from high to low pressure.

#### tsunamis

- **Title:** Tsunamis: a wave as long as the ocean is deep
- **Level:** 1
- **Kind:** simulate
- **Interaction:** A slice of the Pacific from Japan to California with the real sea floor under it. Jolt the floor up near the trench and watch the hump race across the deep ocean at airliner speed while a clock counts the hours and markers show arrival times; a speed gauge follows the depth, fast over the abyss and slowing over the shelf, where the wave bunches up and grows from under a metre to many metres. Drag the floor to change a shelf's slope or add an island, and compare with a wind wave of the same height, which barely notices the depth.
- **Takeaway:** A tsunami is a shallow-water wave even over the deepest ocean, so its speed is set by the depth alone: it crosses an ocean in hours, is barely visible at sea, and rears up only when it reaches the shallows.
- **Prerequisites:** waves-interference, earthquakes
- **Related:** plate-tectonics
- **Needs:** An ocean depth transect from NOAA's ETOPO 2022 relief model; the one-dimensional shallow-water equations run on that profile (a single transect ignores spreading across the ocean, so the far-shore height is an upper bound: state it on the page).
- **Pitfall:** A tsunami is not a towering surf wave: at the coast it arrives as a fast-rising flood lasting minutes, often after the sea draws back; and it is not a tidal wave, tides have nothing to do with it.
  > Nearest existing: beach-waves (pool, level 0): wind waves slowing and breaking on a beach; this page is a wave longer than the ocean is deep, with its speed set by depth all the way across and real travel times. earthquakes: the seismic waves inside the Earth; this page is the water wave an undersea quake launches.
  > Why: NOAA's tsunami facts (speed is the square root of gravity times depth, about 765 km/h over 4,600 m of water) answer the common 'how do tsunamis work': https://noaa.gov/node/10981
  > Data: ETOPO 2022 (NOAA NCEI, US government work, public domain).

#### carbonate-silicate-thermostat

- **Title:** The carbonate-silicate thermostat
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A box model in which volcanoes outgas CO2, silicate weathering removes it at a rate that rises with temperature and rainfall (the Walker, Hays and Kasting feedback), and a one-layer energy balance sets the temperature. Dim the young Sun to seventy percent and run a million years: CO2 piles up until weathering catches up and the planet stays unfrozen. Freeze the planet to stop weathering and watch CO2 climb for millions of years until the ice gives way; move the planet outward or switch off the volcanoes to find where the thermostat fails.
- **Takeaway:** Over millions of years rock weathering acts as a thermostat, because a warmer, wetter planet draws down CO2 faster, which is why Earth stayed habitable under a brightening Sun and how a Snowball Earth ends.
- **Prerequisites:** carbon-cycle, greenhouse-effect
- **Related:** ocean-acidification, radiative-convective-column, deep-time
- **Pitfall:** This thermostat works over hundreds of thousands to millions of years and does nothing about fossil-fuel CO2 on human timescales; the fast carbon cycle and the slow one are different pages. It is the leading explanation of the faint young Sun paradox, not a settled one: the page should not present a single CO2 history as known.
  > Nearest existing: carbon-cycle: that page runs the fast cycle over decades with human emissions; this page runs the slow rock cycle over millions of years and shows the feedback that makes it a thermostat.
  > Why: MIT OCW 12.842 Climate Physics and Chemistry, Lecture 4 'The Faint Young Sun Paradox, the geochemical C cycle and climate on geologic time scales': https://ocw.mit.edu/courses/12-842-climate-physics-and-chemistry-fall-2008/resources/part1_lec4

#### ensemble-weather-forecasting

- **Title:** Weather forecasts: why they come as odds
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A ring of forty weather cells round a latitude circle (the Lorenz-96 model) runs as a strip of colour, the true weather on top and the reader's forecast started from a measurement of it with adjustable error. Launch one forecast and watch it track the truth for a few days and then diverge; launch fifty from slightly different starts and watch the fan open, narrow on some days and wide on others, with the spread plotted against the actual error. Shrink the measurement error tenfold and the useful range grows only a few days; make the model slightly wrong and the fan goes confident and wrong; then run the forecast-observe-correct cycle and watch the analysis stay close.
- **Takeaway:** Because small errors in today's weather keep doubling every few days, a single forecast loses its skill after a week or two; forecasters run many from slightly different starts, and where the runs agree the forecast is sure and where they fan out it is not.
- **Prerequisites:** chaos-fractals, atmosphere-weather
- **Related:** bayes-theorem
- **Pitfall:** Chaos does not make forecasting useless: the useful range differs from day to day, and the ensemble shows which days are which. But an ensemble's spread is not automatically a trustworthy probability: a slightly wrong model gives a narrow, confident fan that misses, which is why forecasters check spread against error and calibrate. A '70% chance of rain' means a 70% chance at any one spot, not rain over 70% of the area or 70% of the day.
  > Nearest existing: chaos-fractals: two double pendulums diverge; this page is what forecasters do about that: many starts, spread as a forecast of uncertainty, and the correction cycle. atmosphere-weather is the physics of circulation, with no forecasting.
  > Why: ECMWF's training course teaches ensemble prediction with the Lorenz-96 model, and 'why are weather forecasts wrong' is a perennial public question: https://events.ecmwf.int/event/405/contributions/4491/attachments/2523/4335/lorenz-part1.pdf

#### ocean-acidification

- **Title:** Ocean acidification & carbonate chemistry
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Slide atmospheric CO2 from the pre-industrial 280 ppm past 1,000 ppm while the page solves the seawater carbonate system (the dissociation constants of carbonic acid in seawater, with alkalinity held fixed): pH falls, dissolved CO2 and bicarbonate rise, carbonate ion falls, and the aragonite saturation state drops below one first in cold water. A Bjerrum plot shows the species shifting with pH, a temperature slider shows why polar seas get there first, and the Revelle factor shows why the ocean's uptake slows as it fills.
- **Takeaway:** Adding CO2 to seawater does not just lower its pH, it consumes carbonate ions, the building block of shells, and cold water runs short of them first.
- **Prerequisites:** acids-bases, carbon-cycle, reaction-rates-equilibrium
- **Related:** carbonate-silicate-thermostat, ocean-currents
- **Needs:** Published empirical fits for seawater equilibrium constants as functions of temperature and salinity, the same ones CO2SYS uses: K0 (Weiss 1974), K1 and K2 of carbonic acid (Lueker et al. 2000), borate KB (Dickson 1990) and total boron (Uppström 1974) for the alkalinity, and aragonite and calcite solubility (Mucci 1983). These are published coefficients, retyped and cited. Cross-check the solver against PyCO2SYS (open source, GPL-3) in a model test.
- **Pitfall:** The ocean is not becoming acid (its pH stays above 7); acidification means moving toward acid, and the harm is the loss of carbonate ion, not corrosive water.
  > Nearest existing: acids-bases: that page titrates a single acid and counts hydrogen ions; this page solves the coupled carbonate equilibria of seawater and reads off the carbonate ion and saturation state that acids-bases never reaches.
  > Why: University of Texas MNS 193 Ocean and Estuarine Acidification, a course built around CO2SYS carbonate-chemistry calculations: https://hulab.utmsi.utexas.edu/OA_class/index.htm

#### radiative-convective-column

- **Title:** Radiative transfer & the climate column
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A column of air from the surface to the stratosphere, solved with the two-stream radiative transfer equations for a grey gas plus an infrared window, with convection adjusting any layer steeper than the chosen lapse rate. Slide the infrared optical depth (the CO2 amount) and the lapse rate and watch the temperature profile, the tropopause and the emission height move, while a side panel shows which layer the escaping infrared leaves from. Close the window to make the gas fully grey and watch the stratosphere stop cooling as CO2 rises; switch convection off to see pure radiative equilibrium and its unstable lower layers.
- **Takeaway:** Adding greenhouse gas raises the height from which the planet radiates to space, and because air is colder higher up the whole column below must warm to restore the balance, while the stratosphere above it cools.
- **Prerequisites:** greenhouse-effect, atmosphere-weather
- **Related:** carbonate-silicate-thermostat
- **Pitfall:** Greenhouse gases do not trap heat like a lid or reflect infrared; the column warms because the effective emission level rises into colder air. A band that is saturated at the surface still warms the planet, because emission from higher, thinner layers is what matters. Stratospheric cooling is not automatic for any absorber: in a perfectly grey atmosphere the stratosphere's temperature does not change, and it cools here because part of the infrared escapes through the window.
  > Nearest existing: greenhouse-effect: that page balances sunlight in against infrared out with adjustable CO2 in a zero-dimensional budget; this page adds the vertical structure, which is where the emission height, the lapse rate and stratospheric cooling live.
  > Why: Pierrehumbert's Principles of Planetary Climate courseware, chapter 4 grey radiative-convective equilibrium notebook: https://users.physics.ox.ac.uk/~pierrehumbert/PrinciplesPlanetaryClimate/Courseware/PlanetaryClimateCourseware2/ChapterScripts/Chapter4/Chapter4.html

### Space

#### comet-tails

- **Title:** Comets and their tails
- **Level:** 0
- **Kind:** explore
- **Interaction:** Scrub a comet along its real stretched orbit, far out and frozen, then swinging in close to the Sun. As it warms, gas and dust stream off it, and the tail always points away from the Sun, whichever way the comet is going, so on the way out the comet flies tail-first. Two tails appear: a straight blue gas tail pushed by the solar wind and a curved dust tail of grains that lag along the orbit; zoom in to see the grains leave.
- **Takeaway:** A comet's tails are pushed out by the Sun, not left behind by its motion, so the gas tail always points straight away from the Sun and the comet leaves tail-first, while the dust tail bends back along the path it has travelled.
- **Prerequisites:** none
- **Needs:** Orbital elements of comet 1P/Halley (perihelion distance, eccentricity, period) from the JPL Small-Body Database: a few published numbers, typed into the model and free to reuse with the credit 'Courtesy NASA/JPL-Caltech' under JPL's open data policy.
- **Pitfall:** The tail does not trail behind like exhaust, and a comet is not a burning rock: it is ice and dust turning to gas in sunlight.
  > Leads to: orbits-kepler, states-of-matter
  > Nearest existing: orbits-kepler (level 1) launches bodies into ellipses; this page uses one real ellipse and asks only which way the tail points.
  > Why: NASA Space Place, 'What Is a Comet?' (https://spaceplace.nasa.gov/comets/en/); England KS2 Year 5, the movement of bodies relative to the Sun.
  > Data: JPL Small-Body Database, Halley's orbital elements (NASA/JPL measured facts, free to reuse with credit)

#### earth-is-a-ball

- **Title:** Earth is a ball
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a ship out to sea and watch it from the shore. On a flat world it only shrinks, and binoculars bring all of it back. On the round world its hull sinks out of sight before its sails as the sea bulges up between you and it (the curve drawn exaggerated, the distances real). Binoculars cannot bring the hull back, but climbing a cliff can. Then walk a little figure around the globe: wherever it stands its feet point to the middle, and a dropped ball falls toward the middle too, so nobody on the far side falls off.
- **Takeaway:** The world is a ball, so the sea itself hides the bottom of a distant ship, and 'down' means toward the middle wherever you stand.
- **Prerequisites:** none
- **Pitfall:** People on the far side are not upside down and do not have to hold on: the page draws no fixed up arrow anywhere. The ship does not vanish because it got too small, and magnifying it does not bring the hull back. The bulge is drawn much bigger than it really is, and air bends light a little so you see slightly farther than the plain geometry says; the page does not claim exact distances.
  > Leads to: sun-earth-moon, newtons-laws, orbits-kepler
  > Nearest existing: sun-earth-moon (level 1) tilts and orbits the Earth; this page never moves it, only shows that it is round and which way down is.
  > Why: NGSS 5-PS2-1: 'Support an argument that the gravitational force exerted by Earth on objects is directed down', with 'down' pointing toward the center of the spherical Earth (https://www.nextgenscience.org/pe/5-ps2-1-motion-and-stability-forces-and-interactions); England KS2 Year 5: 'describe the sun, Earth and moon as approximately spherical bodies'.

#### leap-years

- **Title:** Leap years: why February gets an extra day
- **Level:** 0
- **Kind:** explore
- **Interaction:** A calendar wheel turns inside Earth's orbit: one lap of the Sun takes 365 days and about a quarter more, so each New Year falls a quarter-day short. Scrub forward with no leap days and watch the first day of summer slide through the calendar, a month after a century and into winter after seven or eight centuries; switch on 'one extra day every four years' and the slide almost stops; zoom out over a thousand years to see the small drift that is left and the 'skip every hundred, keep every four hundred' rule that fixes it.
- **Takeaway:** A year is not a whole number of days, so a calendar without leap days drifts out of step with the seasons; an extra day every four years, with a few skipped, keeps them matched.
- **Prerequisites:** none
- **Related:** orbits-kepler
- **Pitfall:** A leap day fixes the calendar, not the orbit; nothing about the seasons changes. The rule is not simply every four years: 1900 was not a leap year and 2000 was.
  > Leads to: sun-earth-moon
  > Nearest existing: sun-earth-moon: why there are seasons; this page is why the calendar needs correcting to stay lined up with them.
  > Why: NASA/JPL Education, 'Doing the math on why we have leap day' (interest spikes every leap year): https://www.jpl.nasa.gov/edu/news/doing-the-math-on-why-we-have-leap-day/

#### aperture-synthesis

- **Title:** Interferometry & aperture synthesis
- **Level:** 3
- **Kind:** build
- **Interaction:** Place radio dishes on a map and pick a model sky; every pair of dishes samples the sky's Fourier transform at one point and its mirror image, and as the Earth turns each pair traces a pair of arcs in the uv plane. Watch the dirty beam and the dirty image form from whatever the array has sampled: two dishes see only stripes, a dozen over six hours see the source. Run CLEAN step by step, subtracting the beam from the brightest point until the image emerges, and compare it with the truth; shrink the array to lose resolution, spread it to lose the extended emission.
- **Takeaway:** An array of small telescopes can see as sharply as one dish as wide as the array, because what it measures is the sky's Fourier transform, and the Earth's rotation fills in the gaps.
- **Prerequisites:** fourier-transform, waves-interference, light-optics
- **Related:** medical-imaging, black-holes, gravitational-waves
- **Needs:** No external data required: model skies (point sources, a disc, a jet) are generated in code and the model is a 2D FFT plus Hogbom CLEAN. Optional real array layouts (VLA Y with 120-degree arms; ALMA configurations from the CASA simulator's antenna-configuration files, CASA being open source under the GPL), or the coordinates published in open-access papers.
- **Pitfall:** An interferometer does not gain the collecting area of a filled dish, only its resolution, and the dirty image is not a photograph of the sky but of what was sampled.
  > Nearest existing: light-optics: that page forms images with lenses and never treats resolution as a Fourier limit; medical-imaging also computes an image from indirect measurements, but from projections combined by filtered back-projection, whereas this page fills the Fourier plane with correlations between pairs of separated telescopes and deconvolves with CLEAN.
  > Why: NRAO Synthesis Imaging Workshop, the graduate course on aperture synthesis theory and technique: https://aas.org/events/2022-02/18th-synthesis-imaging-workshop

#### lagrange-points-three-body

- **Title:** The three-body problem & Lagrange points
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** The circular restricted three-body problem, drawn in the frame that rotates with the two large bodies. Set the mass ratio (Sun-Jupiter, Sun-Earth, Earth-Moon, or a slider) and the five Lagrange points appear. Set the probe's energy (the Jacobi constant) and the forbidden regions shade in, opening gates at L1 and L2 as the energy rises. Drop a probe at L1 or L2 and it drifts away within months. Drop one near L4 and it wanders in a tadpole around the point for as long as the reader waits, as Jupiter's Trojans do. Push the mass ratio past about 1 in 26 and the same probe escapes. Nudge a starting position by a hair to run two probes side by side and watch their paths split.
- **Takeaway:** Three bodies have no general closed-form solution and nearby paths split apart, but there are five points where a small body can keep pace with the other two: three balanced on a knife edge, and two that are stable while the smaller mass is light enough.
- **Prerequisites:** orbits-kepler
- **Related:** rockets, chaos-fractals
- **Pitfall:** L1 and L2 are not places where gravity cancels. A spacecraft there circles the Sun in exactly one Earth year because the combined pull (Earth's pull partly offsets the Sun's at L1 and adds to it at L2) is exactly what that orbit needs, and it still needs station-keeping. The general three-body problem is not 'unsolvable': Sundman found a convergent series, but no closed formula and no long-term predictability.
  > Nearest existing: orbits-kepler: that page adds a second planet to see two bodies disturb each other; this page moves to the rotating frame, where the forbidden regions and the stability of the five points become visible.
  > Why: MIT OCW 16.346 Astrodynamics, lecture 25 on the restricted problem of three bodies (Jacobi integral, surfaces of zero relative velocity): https://ocw.mit.edu/courses/16-346-astrodynamics-fall-2008/resources/lec_25

### Computing

#### life-on-a-grid

- **Title:** Life on a grid
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Paint a few squares on a grid and press step: every square counts its live neighbours at once, and the three rules (lonely dies, crowded dies, exactly three neighbours gives birth) show as the counts on each square. Press play and find the shapes that blink, the ones that sit still and the glider that walks across the board. Change one number in a rule and watch the same seed grow, freeze or die.
- **Takeaway:** A rule about counting neighbours, applied to every square at once, makes things that blink, walk and grow that nobody drew.
- **Prerequisites:** none
- **Pitfall:** All squares update together from the previous picture, not one after another; a page that updates in place gets wrong patterns. And do not call Life 'random': the same seed gives the same future every time.
  > Leads to: ecosystems
  > Nearest existing: chaos-fractals (level 2) shows simple rules making unpredictable paths; this page's rule is three neighbour counts on a grid the reader paints, and the reader can edit the rule.
  > Why: Numberphile, 'Inventing Game of Life (John Conway)' (title confirmed; YouTube does not render view counts in fetch); promotes the Reserve item 'Cellular automata' at level 0. https://www.youtube.com/watch?v=R9Plq-D1gEk

#### secret-codes

- **Title:** Secret codes & code-breaking
- **Level:** 0
- **Kind:** step
- **Interaction:** Turn the inner ring of a code wheel and type a message: each letter steps along the alphabet by the same amount, and your friend turns the ring back to read it. A spy who does not know the turn tries all 25 turns at once and the one that reads as words jumps out. Scramble the alphabet instead; now the spy counts the letters in the secret message and lines its bars up with the bars of ordinary English: the tallest few give E, T and A, half-words like TH_ appear, and the reader swaps the remaining letters until the message reads.
- **Takeaway:** A code that shifts every letter the same way falls to trying all 25 shifts, and a code that scrambles the alphabet falls to counting letters, because in a long message E stays the most common letter however it is disguised.
- **Prerequisites:** none
- **Related:** twenty-questions
- **Needs:** English letter frequencies counted at build time by a script from a public-domain text, e.g. Project Gutenberg's Alice's Adventures in Wonderland (public domain), not typed in from memory.
- **Pitfall:** A short message has too few letters for counting to work: show the counting fail on a one-line note and succeed on a paragraph, rather than pretending frequency analysis always works.
  > Leads to: primes-modular-arithmetic
  > Nearest existing: cryptography (level 2) covers key exchange, hashing and signatures with modular arithmetic; this page is pen-and-paper ciphers and the two ways they break, with no keys shared over a channel.
  > Why: The National Cipher Challenge, the University of Southampton's codebreaking competition for school teams, starts every year with ciphers of this kind. https://www.cipherchallenge.org/
  > Data: A Project Gutenberg public-domain English text for the letter counts.

#### twenty-questions

- **Title:** Twenty questions: halving the haystack
- **Level:** 0
- **Kind:** step
- **Interaction:** Think of a number from 1 to 100 and answer the page's 'higher or lower' questions: a bar of candidates shrinks by half each answer and the counter stops at seven. Now find a word in a thousand-page dictionary by opening it in the middle, then in the middle of the right half, counting the opens, against a search that flips through every page. Then play animal twenty questions: each yes/no question hides half of the hundred animals on the board until one is left.
- **Takeaway:** A question that splits what is left in half finds the answer in a handful of steps, where checking one at a time takes hundreds.
- **Prerequisites:** none
- **Related:** secret-codes
- **Needs:** The animal board: the UCI Zoo dataset (101 animals, 16 yes/no and count features), CC BY 4.0.
- **Pitfall:** Halving needs either a list in order (the dictionary trick fails on a shuffled pile of pages) or a question that really splits what is left: show 'is it a penguin?' barely shrinking the board, and do not claim every yes/no question halves the pile.
  > Leads to: sorting, learning-from-data
  > Nearest existing: sorting (level 1) shows how the cost of sorting grows with input size; nothing in the catalogue shows searching. This page shows halving against one-by-one on counts alone, without growth curves.
  > Why: England KS3 computing: 'several key algorithms that reflect computational thinking [for example, ones for sorting and searching]'; CS Unplugged Searching Algorithms ('How many guesses?', 'Divide and conquer', ages 5 to 10). https://www.csunplugged.org/en/topics/searching-algorithms/
  > Data: UCI Machine Learning Repository, Zoo dataset (Forsyth 1990, DOI 10.24432/C5R59V), CC BY 4.0.

#### game-tree-search

- **Title:** How a computer plays a game: the search tree
- **Level:** 1
- **Kind:** build
- **Interaction:** Play noughts and crosses against the page and open its mind: a tree of the moves it is weighing, the leaves scored win, draw or loss and the scores passed up, the computer taking the best of its moves and assuming you take the worst for it. Switch to Connect Four, where the whole tree is too big, and set how many moves ahead it looks: at two it blunders, at six it is hard to beat, and with pruning off the count of positions examined rises about sevenfold per extra move; turn on pruning and watch whole branches greyed out, the count falling steeply with the chosen move unchanged. Build the scoring rule yourself from a palette of features (centre column, three in a row) and test it.
- **Takeaway:** A game-playing program looks ahead down a tree of moves, assumes the opponent plays its best, and picks the line with the best guaranteed outcome; how deep it can afford to look is set by how fast the tree grows.
- **Prerequisites:** graph-search
- **Related:** sorting, reinforcement-learning
- **Pitfall:** The program does not plan like a person; it counts. And it does not look at every possible game: depth is limited and the leaves are scored by a rule of thumb, which is why a better scoring rule can beat a deeper search.
  > Nearest existing: graph-search: searching a map for a route; this page searches a tree of moves against an opponent, where a value flows up instead of a path being found. monte-carlo-tree-search (pool, level 3) uses random playouts and AlphaGo; this page is the full deterministic search at level 1.
  > Why: 'How does a chess computer work' tutorials (freeCodeCamp's step-by-step chess AI) are among the most-read introductions to minimax: https://www.freecodecamp.org/news/simple-chess-ai-step-by-step-1d55a9266977

#### cache-memory-hierarchy

- **Title:** Caches & the memory hierarchy
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Choose a program's access pattern (sum an array row by row or column by column, walk a linked list, multiply matrices with and without blocking) and run it through a cache with adjustable size, line length, associativity and replacement policy; each access lights a line as a hit or a miss, and the miss count and the average memory access time plot live. Add a second level of cache and watch where the knee of the curve moves.
- **Takeaway:** The same program, doing the same arithmetic, takes many times more cycles waiting for memory or many times fewer, depending only on whether it touches memory in an order the cache can exploit.
- **Prerequisites:** cpu
- **Related:** gpu
- **Pitfall:** A bigger cache is not always better: a direct-mapped cache thrashes on a stride equal to its size however large it is, and the unit moved is a whole line, never a byte, so a miss costs the same for one byte as for sixty-four.
  > Nearest existing: cpu: that page single-steps instructions against a flat memory that answers instantly; this page makes memory itself the model and shows why one access costs one cycle and the next two hundred.
  > Why: MIT 6.004 Computation Structures, Unit 14 'Multilevel memories: locality, performance, caches' https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/pages/calendar

#### hash-tables-bloom-filters

- **Title:** Hash tables & Bloom filters
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Insert keys into a table with chaining or open addressing and raise the load factor; every probe is drawn, and the measured mean probe length is plotted against the expected curve until the table resizes and rehashes. Then feed the same keys to a Bloom filter with an adjustable bit array and number of hash functions, query keys that were never inserted and watch the measured false-positive rate track the standard approximation (closely for large arrays, drifting above it for tiny ones); degrade the hash function with a slider and see both structures cluster.
- **Takeaway:** A good hash spreads keys evenly, so lookups stay constant-time until the table fills, and a Bloom filter trades a known, tunable false-positive rate for a fraction of the memory.
- **Prerequisites:** sorting, binary
- **Related:** cryptography
- **Pitfall:** A hash table's constant time is an average under a good hash, not a guarantee; the cryptographic hash of the cryptography page is a different tool; and a Bloom filter can only ever say 'definitely absent', never 'definitely present'.
  > Nearest existing: cryptography: that page shows a hash as a one-way fingerprint; here the hash is a fast bucket index, and the model is the statistics of collisions as the table fills.
  > Why: MIT 6.006 Introduction to Algorithms, Lecture 4 'Hashing' https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes (Bloom filters appear in CMU 15-445's index lectures)

### Information & Networks

#### barcode-stripes

- **Title:** Barcodes at the checkout
- **Level:** 0
- **Kind:** step
- **Interaction:** Drag a scanner's red line across a barcode (a UPC-A, the 12-digit form found on many products) and watch what it sees, a trace of dark and light over time, then step through it: a start mark, six groups of stripes, a middle mark, six more and an end mark, each group of two bars and two gaps one digit. Scan slowly, fast or at a slant and the widths all stretch together, so the digits come out the same; scan it upside down and the scanner tells, from the left groups looking different from the right ones, which way to read. Smudge one stripe and the last digit, a check digit, turns the light red: the number is wrong, scan again.
- **Takeaway:** A barcode is a number written as stripe widths, read as proportions so that speed and angle do not matter, with a last digit that catches a misread; the price is looked up afterwards.
- **Prerequisites:** none
- **Related:** qr-codes
- **Pitfall:** The barcode does not contain the price or the product name; it is a number the till looks up. The scanner reads ratios of widths, not absolute sizes, which is why the code can be printed at any size.
  > Leads to: binary
  > Nearest existing: qr-codes in this batch: the two-dimensional cousin with error correction; this page is one row of widths, a check digit and no repair. binary reads bits; here a digit is a pattern of four widths.
  > Why: 'Barcode' averaged about 29,200 views a month on English Wikipedia in 2025 (https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Barcode/monthly/2025010100/2025123100).

#### qr-codes

- **Title:** QR codes
- **Level:** 0
- **Kind:** build
- **Interaction:** Type a short message and watch it become a square of black and white cells, built the real way: the three big corner squares that tell a camera where the code is and which way up, then the message as cells, then spare cells computed from the message. Point a drawn camera at it from any angle and it reads. Now paint over cells with a brush: the message still comes out, and a counter shows how many cells are damaged; keep painting and find the moment it fails, then paint over a corner square instead, which fails at once.
- **Takeaway:** A QR code carries its message plus spare cells computed from it, so a scratched or half-covered code still reads, until too much of the message is spoiled or a corner finder is hidden.
- **Prerequisites:** none
- **Related:** barcode-stripes
- **Needs:** None to ship; the page runs a real encoder and decoder (open-source implementations of the QR standard exist under MIT and Apache 2.0, e.g. qrcode-generator and jsQR).
- **Pitfall:** The three corner squares hold no message; they are for finding and orienting. The code is not read in a spiral or line by line, and the spare cells are not a copy of the message, so do not say the data is duplicated. The survivable damage (about 7 to 30 percent depending on the level chosen) is counted in damaged bytes, not cells or area: a scatter of specks can break a code that a single blot of the same size does not, so the cell counter is a guide, not a fixed limit.
  > Leads to: binary
  > Nearest existing: error-correction (level 2): that page shows a Hamming code's parity checks on bits; this one is the object, with damage painted on and a count of cells survivable, and no arithmetic shown. barcode-stripes in this batch is the one-dimensional cousin with only a check digit.
  > Why: NGSS 4-PS4-3: 'using a grid of 1's and 0's representing black and white to send information about a picture' (https://www.nextgenscience.org/pe/4-ps4-3-waves-and-their-applications-technologies-information-transfer); 'QR code' averaged about 388,000 views a month on English Wikipedia in 2025.

#### wifi-and-walls

- **Title:** Wi-Fi around the house
- **Level:** 0
- **Kind:** build
- **Interaction:** Place a router on a floor plan and the rooms fill with a signal map; drag the laptop around and its speed gauge follows the colour. Add walls, a brick one, a fridge, a fish tank, and watch each cut a shadow in the map and the gauge drop, as the link slows down to be heard through the loss. Switch the router to the faster, shorter-reach band and compare; then add a neighbour's router on the same channel and watch the two take turns.
- **Takeaway:** Wi-Fi is radio: walls and water eat it, the link slows down rather than breaking as the signal fades, and two networks on one channel must take turns.
- **Prerequisites:** none
- **Needs:** Attenuation per wall material at 2.4 and 5 GHz: NIST IR 6055, 'Electromagnetic Signal Attenuation in Construction Materials' (W. C. Stone, NIST, 1997; brick, concrete, drywall, glass, plywood, wet wood), for a multi-wall path-loss model; water (fish tank, people) from the same report's wet-material results or textbook absorption values.
- **Pitfall:** Wi-Fi is not the internet; a full signal to the router says nothing about the line out of the house. The signal does not stop at an edge: it fades gradually, and the devices then choose a slower, sturdier way of sending so that it can still be read, which is why the gauge drops step by step instead of cutting out. Walls are not perfect shadows either; reflections leak signal around them, which this simple wall-counting model leaves out.
  > Leads to: internet, waves-interference
  > Nearest existing: wireless-signals (level 2): that page packs bits onto a carrier against noise; this one is where to put the router, computed from a wall-by-wall loss model, with speed shown as a gauge and no waveform.
  > Why: NGSS MS-PS4-2: 'waves are reflected, absorbed, or transmitted through various materials' (https://www.nextgenscience.org/pe/ms-ps4-2-waves-and-their-applications-technologies-information-transfer); 'Wi-Fi' averaged about 73,900 views a month on English Wikipedia in 2025 (https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Wi-Fi/monthly/2025010100/2025123100).
  > Data: NIST IR 6055 (US federal government work, public domain; https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6055.pdf).

#### shazam-audio-fingerprint

- **Title:** How Shazam recognises a song
- **Level:** 2
- **Kind:** step
- **Interaction:** Play one of a few short clips synthesized in the page and watch its spectrogram scroll by; the page keeps only the brightest peaks, a constellation of dots, and turns pairs of nearby peaks into fingerprints (two pitches and the gap between them), building a tiny database of a dozen clips the same way. Record a few seconds of one clip with noise, a cough and a different start time added, and watch its fingerprints looked up: hits on the wrong clips scatter, hits on the right one line up at a single time offset, and the spike in the histogram names the song. Slide the noise up until the spike disappears.
- **Takeaway:** A song is recognised not by comparing sound but by matching a sparse set of peak pairs whose time gaps line up, which is why a few noisy seconds from the middle of a track are enough.
- **Prerequisites:** fourier-transform, binary
- **Related:** compression, musical-scales-ratios
- **Pitfall:** It does not match the melody or the lyrics and cannot find a cover version or a hummed tune: a different performance has different peaks. The time alignment, not the number of matching hashes alone, is what makes a match reliable.
  > Nearest existing: compression: dropping high-frequency detail from image blocks; this page keeps only spectrogram peaks and matches them, discarding the sound altogether. voice-assistant-wake-word (pool) classifies speech with a trained model; this page is deterministic hashing.
  > Why: Avery Wang's Shazam paper (2003) is a standard course reading and 'how does Shazam work' a classic question: https://www.princeton.edu/~cuff/ele201/files/Wang03-shazam.pdf

#### distributed-hash-tables

- **Title:** Distributed hash tables & consistent hashing
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Hash keys and servers onto a ring and watch a lookup walk around it; add or remove a server and count how many keys move, with consistent hashing against the naive modulo rule. Then give each node a finger table and watch lookups finish in a number of hops that grows only logarithmically as the network grows to thousands of nodes; churn nodes in and out and see the ring heal or lose keys depending on how many replicas each key has.
- **Takeaway:** Thousands of machines can find any key among them in a dozen hops with no directory, and adding one machine moves only its own share of the keys.
- **Prerequisites:** hash-tables-bloom-filters, internet
- **Related:** consensus-blockchains, pagerank, graph-search
- **Pitfall:** Consistent hashing is not fair by default: with one point per server the loads vary widely, which is what virtual nodes fix. A DHT finds where a key lives; it does not make the data durable, replication does.
  > Nearest existing: consensus-blockchains: that page makes nodes agree on one log; this one spreads keys across nodes with no agreement at all, which is how a CDN or BitTorrent finds things.
  > Why: MIT 6.824 Distributed Systems, lecture 20 'DHTs / Chord' https://pdos.csail.mit.edu/archive/6.824-2011/notes/l20.txt

#### elliptic-curve-cryptography

- **Title:** Elliptic-curve cryptography
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag two points on an elliptic curve over the real numbers and watch the chord-and-tangent rule produce their sum; switch the same curve to a finite field and the smooth curve becomes a scatter of points on which the same rule still works. Multiply a point by k with double-and-add, step by step, and see that landing on a target point gives no clue what k was; then run Diffie-Hellman on the curve and compare the key sizes with the modular version.
- **Takeaway:** Multiplying a point on a curve by a secret number is quick, but over a finite field nobody knows a practical way to recover the number from the result, so a 256-bit curve key does the job of a 3,000-bit modular one.
- **Prerequisites:** cryptography
- **Related:** consensus-blockchains, quantum-computing
- **Needs:** Curve parameters from the openly published standards SEC 2 (secp256k1) and RFC 7748 (Curve25519).
- **Pitfall:** The picture over the real numbers is for intuition only: the cryptography lives on the finite-field points, where there is no curve to see, and the hardness is the discrete logarithm, not the shape. 'Elliptic' has nothing to do with ellipses.
  > Nearest existing: cryptography: that page does Diffie-Hellman with modular exponentiation on a clock face; this page swaps the group for curve points and shows why that buys so much for so few bits.
  > Why: Cloudflare, 'A (relatively easy to understand) primer on elliptic curve cryptography' https://blog.cloudflare.com/a-relatively-easy-to-understand-primer-on-elliptic-curve-cryptography/
  > Data: published curve parameters (public standards); nothing else

#### kalman-filter

- **Title:** The Kalman filter
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Track a moving object from a noisy sensor: at each step the filter predicts where the object will be, then blends in the new measurement, with the estimate's uncertainty drawn as an ellipse that grows on prediction and shrinks on measurement. Turn the measurement noise up and watch the filter lean on its model; add a second sensor (an accelerometer to the GPS fix) and see the fused estimate beat either alone; make the object swerve and watch a filter with the wrong motion model lag behind, confidently.
- **Takeaway:** The best estimate of where something is comes from weighing a prediction against a measurement in proportion to how much each can be trusted, and the filter keeps that weighting up to date.
- **Prerequisites:** bayes-theorem, central-limit-theorem, linear-transformations, feedback-control
- **Related:** gps, radar-sonar
- **Pitfall:** It does not average measurements: with a good model it can be more certain than any single measurement. It is optimal only for linear systems with Gaussian noise, and when the model is wrong the failure mode is confident and wrong.
  > Nearest existing: feedback-control: that page corrects an actuator from an error signal; this page estimates the state the controller needs from noisy measurements, and the two are usually paired in a real robot.
  > Why: MIT OCW 16.322 Stochastic Estimation and Control (discrete- and continuous-time Kalman filtering) https://ocw.mit.edu/courses/16-322-stochastic-estimation-and-control-fall-2004/pages/syllabus

#### radar-sonar

- **Title:** Radar & sonar
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Fire a pulse at targets you place and drag, and watch the echoes return on a range display; shorten the pulse for resolution and lose energy, then replace it with a chirp and a matched filter and get both at once. Set a target moving and read its speed from the Doppler shift, build a range-Doppler map, raise the noise until targets vanish into clutter, and switch the medium to water to see why sonar runs slow and low-frequency.
- **Takeaway:** Radar and sonar measure distance by timing an echo and speed by its pitch, and the shape of the pulse decides how finely each can be told apart.
- **Prerequisites:** waves-interference, fourier-transform, wireless-signals
- **Related:** gps, medical-imaging, kalman-filter
- **Pitfall:** Range comes from timing, not triangulation; stealth is mostly about where the echo goes, not about absorbing it; and the Doppler shift measures only the speed toward or away from the antenna.
  > Nearest existing: medical-imaging: that page reconstructs an image from projections and mentions ultrasound in passing; this page is the echo itself: pulse shape, matched filtering and Doppler.
  > Why: MIT OCW RES.LL-003, 'Build a Small Radar System Capable of Sensing Range, Doppler, and Synthetic Aperture Radar Imaging' https://ocw.mit.edu/courses/res-ll-003-build-a-small-radar-system-capable-of-sensing-range-doppler-and-synthetic-aperture-radar-imaging-january-iap-2011/

#### tcp-congestion-control

- **Title:** TCP congestion control
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Send a file across a link with a bottleneck and a queue of adjustable size, and watch the sender's window grow in slow start, collapse on a loss and resume with additive increase, tracing the sawtooth of throughput against time. Add a second flow and see the two converge to a fair share; oversize the buffer and watch delay balloon while throughput does not improve; compare Reno, CUBIC and a delay-based sender on the same link.
- **Takeaway:** The Internet has no traffic police: each classic TCP sender probes for its share of the bottleneck by speeding up until the queue overflows and packets drop, then backs off, and that simple rule is what keeps the network from collapsing.
- **Prerequisites:** internet, feedback-control
- **Related:** wireless-signals
- **Pitfall:** Congestion control is not flow control: the receiver's window protects the receiver, and the congestion window protects the network. A loss on a wireless link is often noise rather than congestion, and classic TCP misreads it as a signal to slow down. AIMD's 'fair share' is fair only between flows with similar round-trip times; a flow with a short round-trip time grabs more.
  > Nearest existing: internet: that page shows a lost packet being resent; this page is the rate-control loop that decides how fast to send in the first place, and what happens when every sender runs it at once.
  > Why: Stanford CS144 Introduction to Computer Networking, transport unit: 'reliable delivery over an unreliable network, flow control, and congestion control' (AIMD, Tahoe, Reno) https://bulletin.stanford.edu/courses/2075241

### Artificial Intelligence

#### next-word-guessing-game

- **Title:** How a chatbot picks its next word
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Play a guessing game against a tiny machine that has read a few children's books: a story stops mid-sentence, you guess the next word, and the machine shows its own guess as a row of word cards, each with a count of how often that word came next in everything it read. Then let it write on its own: each word is drawn by chance like a spinner whose slices are as big as the counts, so it usually picks a common word but sometimes an odd one, and the word it picked becomes the start of the next guess. Press the one button, 'read more books', and watch the cards fill up and its stories get better.
- **Takeaway:** A chatbot writes by guessing one word at a time from what usually came next in the text it learned from, adding each guess to the story before making the next, so it picks likely words, not true ones.
- **Prerequisites:** none
- **Related:** ngram-text-models, language-models
- **Needs:** A few public-domain children's books (Beatrix Potter, Aesop's fables) from Project Gutenberg, counted in the page.
- **Pitfall:** Do not say real chatbots only count word pairs: say this toy looks back one or two words, while a real chatbot uses a neural network that looks back over thousands. And it does not look answers up in a stored copy of the books.
  > Leads to: learning-from-data
  > Nearest existing: language-models shows the same loop with a real network for a level-2 reader; this page has a counting machine write whole stories by drawing words at random in proportion to the counts and feeding each one back in, the loop a chatbot runs. The runner-up autocomplete-spellcheck suggests only the single most common next word while you type.
  > Why: Code.org How AI Works, lesson 'Chatbots and Large Language Models' (grades 6-12): https://code.org/ai/how-ai-works
  > Data: Project Gutenberg texts of books in the US public domain (public domain).

#### spam-filter-word-counts

- **Title:** How a spam filter decides
- **Level:** 0
- **Kind:** build
- **Interaction:** A pile of real text messages arrives, each already marked spam or not; pick any word, 'free', 'win', 'tonight', 'mum', and see two counts, how many spam messages contain it and how many ordinary ones. Build the filter by letting it count every word, then write a message of your own and watch the words vote: each nudges the score toward spam or not according to its two counts. Try to sneak past with 'fr33' and watch the vote change; mark your message and see the counts update.
- **Takeaway:** This kind of spam filter has no idea what a message means: it counts which words turned up more in past spam than in ordinary messages, which is why spammers misspell and why your 'report spam' clicks teach it.
- **Prerequisites:** none
- **Related:** teach-a-machine
- **Needs:** The SMS Spam Collection (Almeida, Gómez Hidalgo and Silva, UCI Machine Learning Repository, 5,574 messages), reduced to a hand-checked subset of a few hundred messages with adult or crude spam removed, since the audience is children.
- **Pitfall:** No word is bad: 'free' is only commoner in spam. The filter can be fooled both ways, and how much spam exists overall matters, so a rare kind of message needs stronger evidence; keep that as counts, not Bayes' formula. Do not say this is how every modern mail filter works: real ones also look at the sender, the links and use neural networks.
  > Leads to: bayes-theorem, learning-from-data
  > Nearest existing: bayes-theorem (level 1) counts true and false positives in a grid of 1,000 people and learning-from-data fits a curve; this page builds the simplest real classifier on a real corpus, with word counts the reader can check.
  > Why: AI4K12 Big Idea 3, Learning, in the AAAI/CSTA K-12 AI guidelines (https://ai4k12.org/).
  > Data: UCI SMS Spam Collection (https://archive.ics.uci.edu/dataset/228/sms+spam+collection), listed by UCI as CC BY 4.0; confirm the licence line on the dataset page, and ship only a curated child-safe subset.

#### teach-a-machine

- **Title:** Teach a machine to tell things apart
- **Level:** 0
- **Kind:** build
- **Interaction:** Draw a few cats and a few houses (or pull examples from a pile of other people's doodles), label them, and draw a new one: the machine shrinks every drawing to a small grid of squares, finds the stored drawings most like the new one square by square, and the labels of those neighbours vote. Watch it get the first guesses wrong, add more examples and watch the votes firm up. Then teach it a trap: every cat drawn in the top corner, every house at the bottom, and see it decide by position instead of shape.
- **Takeaway:** A machine learns to sort things by comparing new examples with the ones it was shown, so more and more varied examples make it better, and a lazy pattern in the examples teaches it the wrong thing.
- **Prerequisites:** none
- **Related:** spam-filter-word-counts
- **Needs:** Optional: a hand-checked subset of doodles (a few hundred per class) from the Quick, Draw! dataset (Google, CC BY 4.0) as a ready pile of examples; the reader's own drawings need nothing.
- **Pitfall:** The machine does not know what a cat is; it compares squares. Do not call the neighbour vote a neural network; neural-networks comes later. If the wolves-in-snow story is told, tell it accurately: researchers (Ribeiro et al., 2016) built that trap on purpose, picking photos where every wolf had snow behind it, to show how a model can learn the background; it was not an accident discovered in a real product.
  > Leads to: learning-from-data
  > Nearest existing: learning-from-data (level 1): that page fits a curve to points and shows overfitting with a test set; this one classifies drawings by nearest neighbours with no curve and no error plot, and leads into it.
  > Why: AI4K12 Big Idea 3, Learning, in the AAAI/CSTA K-12 AI guidelines (https://ai4k12.org/).
  > Data: Quick, Draw! dataset, CC BY 4.0 (https://github.com/googlecreativelab/quickdraw-dataset), optional; its README warns that moderated drawings may still be inappropriate, so ship a hand-checked subset.

#### k-means-clustering

- **Title:** Finding groups: k-means
- **Level:** 1
- **Kind:** step
- **Interaction:** Scatter points by hand or load real penguins measured by bill length and flipper length, with their species hidden, then step k-means: drop k centres, colour every point by its nearest centre, move each centre to the middle of its colour, and repeat until nothing moves. Change k and the starting positions and watch the groups change, reveal the species to compare, and draw two rings, one inside the other, to see k-means cut them in half because it only knows 'nearest centre'.
- **Takeaway:** A computer can find groups in data with no labels at all, by alternately assigning points to the nearest centre and moving the centres, but which groups it finds depends on how many it is told to look for and where it starts.
- **Prerequisites:** learning-from-data
- **Related:** embeddings
- **Needs:** The Palmer penguins measurements (344 penguins, three species).
- **Pitfall:** k-means does not discover the number of groups and finds only compact, roughly round blobs of similar size; different starts give different answers, so run it several times. The groups it finds need not match the species.
  > Nearest existing: learning-from-data fits labelled points and embeddings shows a map of words that cluster; neither runs an algorithm that finds groups without labels. The runner-up clustering-gaussian-mixtures (level 3) would start where this page ends: soft Gaussian clusters with EM and density-based methods.
  > Why: Google's 'Introduction to Clustering' course (choose a similarity measure, cluster with k-means, evaluate the result) https://developers.google.com/machine-learning/clustering
  > Data: palmerpenguins (Horst, Hill and Gorman), CC0, from Palmer Station LTER (https://allisonhorst.github.io/palmerpenguins/).

#### ngram-text-models

- **Title:** N-gram text models & their limits
- **Level:** 1
- **Kind:** build
- **Interaction:** Feed a text into a counting machine that records which letter (or word) follows each run of the previous n, then let it write by sampling from those counts. Slide n from 1 to 10 and watch the samples go from gibberish to word-like to Shakespeare-like, while two meters track what goes wrong: the share of contexts in held-out text that were never seen climbs toward all of them, and the longest stretch copied verbatim from the source grows until the model only recites.
- **Takeaway:** Counting what followed the last few symbols gives more fluent text as the window grows, but the number of possible contexts explodes so fast that long windows are almost never seen, and the model can only copy; a model that reaches far back has to generalise instead of count.
- **Prerequisites:** learning-from-data
- **Related:** next-word-guessing-game, language-models, compression, tokenization
- **Needs:** About 1 MB of Shakespeare's plays (the 'Tiny Shakespeare' extract popularised by Karpathy's char-rnn, or the same plays taken from Project Gutenberg) and the reader's own text.
- **Pitfall:** Unseen contexts are not a problem solved by more data alone: the count of possible contexts grows exponentially with n. Smoothing and back-off fix the zero counts but not the lack of long-range structure.
  > Nearest existing: language-models shows a trained network's predictions; this page builds the counting model that came before it and measures why counting cannot reach far back. The level-0 next-word-guessing-game uses one- or two-word counts with no window slider and no held-out measurement.
  > Why: Karpathy, Neural Networks: Zero to Hero, 'building makemore' (bigram character model): https://karpathy.ai/zero-to-hero.html
  > Data: Shakespeare's plays are public domain (Project Gutenberg, https://www.gutenberg.org/ebooks/100); the Tiny Shakespeare file is an extract of them, so its repository's licence does not matter.

#### chain-of-thought-scratchpad

- **Title:** Why thinking out loud helps a model
- **Level:** 3
- **Kind:** step
- **Interaction:** Two tiny transformers of the same size were trained by the project on 1- to 8-digit addition with the answer written most-significant digit first: one writes the answer straight away, the other first writes its working (each column's digit sum and carry). Pose sums and step through each model token by token, with the carry chain highlighted: the direct model must settle every carry before its first output digit and errs on long carry chains, while the scratchpad model reads the carry it just wrote back in. An accuracy chart by number of digits and by longest carry chain compares the two, with 9 and 10 digits shown as beyond training, where both fall off but the scratchpad model falls more slowly.
- **Takeaway:** A transformer does a fixed amount of computation per token, so writing intermediate steps gives the same model more computation and a place to keep partial results, and it then solves carry-heavy sums the direct model gets wrong.
- **Prerequisites:** training-a-tiny-language-model, transformers
- **Related:** turing-machines
- **Needs:** Two tiny transformers trained offline by the project on generated addition problems (with and without a scratchpad), shipped and run in the page; the weights are the project's own, under the site's MIT licence.
- **Pitfall:** The written steps help because they are computation the model conditions on, not because the model narrates a hidden thought, and in large models the written reasoning is not guaranteed to be a faithful account of how the answer was reached. Do not say transformers cannot add directly (they learn it well when the answer is written least-significant digit first), and do not say a scratchpad solves length generalisation: beyond the trained lengths, both models degrade.
  > Nearest existing: training-a-tiny-language-model: that page trains on prose; this one compares two trained models on a checkable task to show what generated intermediate tokens add.
  > Why: Nye et al., Show Your Work: Scratchpads for Intermediate Computation with Language Models: https://arxiv.org/abs/2112.00114

#### kv-cache-inference

- **Title:** Serving a language model: the KV cache
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Generate text with a small transformer running in the page, first recomputing every earlier token at each step and then with a cache that keeps each layer's keys and values; counters show the arithmetic and the bytes read per new token, growing with the context without the cache and staying flat with it. Then scale up to a published model configuration on a published GPU: drag the batch size and the context length and watch the gpu page's roofline place prefill (the whole prompt at once) on the compute ceiling and each decode step far below it, on the memory-bandwidth slope, until a large batch lifts it, while a bar shows the cache overtaking the weights in memory at long contexts.
- **Takeaway:** After the prompt, generating each token reads every weight and the whole cache from memory for very little arithmetic, so serving speed is set by memory bandwidth, and batching many requests together is what makes it cheap.
- **Prerequisites:** transformers, gpu
- **Needs:** A small transformer run in the page (the project's own or GPT-2 small); published model configurations (layers, widths, heads) and GPU datasheet figures for memory bandwidth and peak throughput.
- **Pitfall:** The cache does not make decoding compute-bound or free: its size grows with context and batch, and at long contexts reading the cache, not the weights, dominates. Prefill and decode are different regimes; one tokens-per-second figure hides both.
  > Nearest existing: gpu: that page introduces the roofline and memory bandwidth with a matrix multiply; this one places LLM prefill and decode on it and shows how the KV cache and batching move decode along the bandwidth slope.
  > Why: Stanford CS336 Language Modeling from Scratch, lecture 10 (Inference: arithmetic intensity, memory-bound decoding, KV cache): https://cs336.stanford.edu/lectures/?trace=lecture_10
  > Data: GPU figures from vendor datasheets (published specifications; the gpu page already ships RTX 4090 figures); layer, width and head counts from public model config files (e.g. Llama or Qwen config.json on Hugging Face); GPT-2 small, MIT on Hugging Face (modified MIT in the OpenAI repository), if used.

#### positional-encoding

- **Title:** Position in a transformer: sinusoids & RoPE
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag a position slider and watch the sinusoidal encoding's dimension pairs turn like clock hands at geometrically spaced speeds, fast pairs telling neighbours apart and slow pairs telling far positions apart. Switch to RoPE, where the query and key themselves are rotated, and drag two tokens along the sentence: their attention score stays fixed while their distance does and changes when it does, whereas with an added sinusoid the score also drifts with absolute position. Extend the sentence past a marked training length and see the slowest pairs reach angles that never occurred in training.
- **Takeaway:** Rotating each query and key by angles proportional to its position makes their attention score depend only on how far apart the two tokens are, not on where they stand.
- **Prerequisites:** transformers, unit-circle
- **Related:** fourier-transform
- **Pitfall:** RoPE does not add a position vector to the embeddings and is not applied to the values. 'Depends only on relative position' holds for the score of one query-key pair, not for the whole network's behaviour beyond the trained length. Attention with a causal mask is not fully blind to order, since each token sees a different number of predecessors; it is order-blind only without the mask.
  > Nearest existing: transformers: that page shows GPT-2's learned position embeddings and states that position must be added; this one shows the sinusoidal and rotary schemes and why rotation makes attention depend on relative distance.
  > Why: Su et al., RoFormer: Enhanced Transformer with Rotary Position Embedding: https://arxiv.org/abs/2104.09864 (and the EleutherAI explainer https://blog.eleuther.ai/rotary-embeddings/)

#### residual-stream-logit-lens

- **Title:** Inside a transformer block: the residual stream
- **Level:** 3
- **Kind:** explore
- **Interaction:** Pick a prompt and follow one token's vector down GPT-2 small's twelve blocks: in each, layer norm rescales a copy, attention adds what it gathered from other tokens, and the MLP adds its own output, drawn as arrows summing onto a running vector. A logit lens decodes that running vector after every block into the model's best guess for the next token, so a grid of layers by positions shows the answer appearing and sharpening; switch off any block's attention or MLP and see which guesses change.
- **Takeaway:** A transformer does not pass a message from layer to layer; every block adds a correction to one shared running vector, and the prediction is refined gradually as those corrections pile up.
- **Prerequisites:** transformers, language-models
- **Needs:** Residual-stream activations, block outputs and ablated runs of GPT-2 small for a set of prompts, precomputed (or GPT-2 small run in the browser through ONNX).
- **Pitfall:** The logit lens reads early layers with the final layer norm and unembedding, which they were never trained for; it works roughly on GPT-2 and fails on some other models (the tuned lens fixes this). Apply the final layer norm before unembedding, as the lens is defined, and do not present early-layer guesses as what the model 'thinks'.
  > Nearest existing: transformers: that page shows attention weights and says in text that each block adds to the token's vector; this one draws the residual sum of attention and MLP outputs, reads the prediction out at every depth, and lets the reader ablate components.
  > Why: Belrose et al., Eliciting Latent Predictions from Transformers with the Tuned Lens (logit lens on GPT-2 as baseline): https://arxiv.org/abs/2303.08112
  > Data: GPT-2 small (OpenAI): weights released under a modified MIT licence (repository licence).

#### rlhf-alignment

- **Title:** RLHF: learning from human preferences
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Read pairs of continuations that a real small language model wrote for a prompt and click the better one; a reward model (a linear layer on each continuation's sentence embedding, fit by the Bradley-Terry rule) updates after every click and scores all the candidates. Slide the KL penalty: the policy, computed exactly as the base model's distribution tilted by exp(reward/beta), drifts from the base model toward the reward model's favourites, and with a small penalty it collapses onto whichever odd continuation the reward model over-rates, reward hacking visible in the ranked list.
- **Takeaway:** Comparisons train a reward model, and the policy is the base model's distribution pulled toward that reward and held back by a KL leash; loosen the leash and the policy exploits the reward model's mistakes instead of the preferences behind them.
- **Prerequisites:** language-models, reinforcement-learning, bayes-theorem
- **Related:** transformers
- **Needs:** For a handful of prompts, about 64 sampled continuations each with reference log-probabilities from GPT-2 small (OpenAI, modified MIT licence) and one sentence embedding per continuation from an open embedding model (all-MiniLM-L6-v2, Apache 2.0), all precomputed.
- **Pitfall:** On this page the policy can only reweight continuations the base model already gives probability to, because the KL-regularised optimum keeps the base model's support; do not generalise that into a claim that RLHF can never change what a model knows. On a finite candidate set that optimum is closed-form, so the page must not pretend PPO is running; say that DPO is derived from the same closed form. Reward hacking here means over-optimising a learned proxy, not the model 'wanting' to cheat.
  > Nearest existing: reinforcement-learning: that page learns values from rewards painted on a grid; here the reward itself is learned from comparisons and the environment is a language model's own output distribution.
  > Why: Hugging Face, Illustrating RLHF (reward model, KL penalty): https://huggingface.co/blog/rlhf ; Stanford CS224N has an RLHF lecture (slide archive https://web.stanford.edu/class/archive/cs/cs224n/cs224n.1246/slides/).
  > Data: GPT-2 small weights: MIT on Hugging Face (openai-community/gpt2), modified MIT in the OpenAI repository (confirmed). all-MiniLM-L6-v2: Apache 2.0 in the Hugging Face model card metadata (confirmed); the repository has no LICENSE file, and a community thread questions some training-data licences (MS MARCO, GooAQ), which does not affect shipping a few hundred precomputed embeddings. The continuations and labels are generated by the project.

#### scaling-laws

- **Title:** Scaling laws
- **Level:** 3
- **Kind:** explore
- **Interaction:** Scrub a precomputed sweep of small networks trained with growing width and data on one task and watch the loss fall as a straight line on log-log axes until the data or the model runs out, then retrain one point of the sweep live and see it land on the line. Switch to the Chinchilla parametric law and drag a compute budget: the page solves for the model size and token count that minimize the fitted loss, drawing the iso-compute curves and the optimal frontier.
- **Takeaway:** Loss falls as a power law in model size and in data, each saturating when the other is the bottleneck, so a given compute budget has an optimal split between the two.
- **Prerequisites:** neural-networks, gradient-descent, learning-from-data
- **Related:** language-models, training-a-tiny-language-model
- **Needs:** The project's own precomputed sweep of small character-level transformers (the training-a-tiny-language-model architecture) trained on Tiny Shakespeare at several widths and data sizes; the Chinchilla parametric fit L = E + A/N^a + B/D^b with Hoffmann et al. 2022's published constants and Epoch AI's corrected constants (Besiroglu et al. 2024), shown side by side.
- **Pitfall:** Scaling laws are empirical fits with disputed constants (Epoch AI's replication found Hoffmann's parametric fit inconsistent with the paper's own other methods); do not present them as physics, and say the loss never reaches zero but approaches an irreducible floor E. Compute-optimal minimizes training cost only; models meant for heavy use are deliberately trained on far more tokens than the optimum. The live retrain must be tiny and labelled as such, not a per-slider sweep.
  > Nearest existing: language-models: that page shows what a trained model does; this one shows how its loss depends on size and data and why models are the sizes they are.
  > Why: Stanford CS324 Large Language Models, lecture on scaling laws: https://stanford-cs324.github.io/winter2022/lectures/scaling-laws/ ; also Wikipedia, Neural scaling law: https://en.wikipedia.org/wiki/Neural_scaling_law
  > Data: Own sweep (Tiny Shakespeare: public-domain text, char-rnn repository MIT). Fitted constants are published numerical facts from arXiv papers and are used as numbers, not as copied data. Epoch AI's reconstructed data points are not used: no licence could be found.

#### speculative-decoding

- **Title:** Speculative decoding
- **Level:** 3
- **Kind:** step
- **Interaction:** A cheap draft model guesses the next few tokens and the large target model checks them all in one pass: step through each guess, accepted with probability min(1, p/q) or rejected and replaced by a sample from the leftover distribution max(0, p - q), with p and q drawn as overlapping bar charts. When every guess is accepted, the target's own pass adds one more token for free. Change the number of guesses and swap in a better or worse draft to see the tokens gained per target pass, then run ten thousand samples and watch their histogram converge on the target model's distribution.
- **Takeaway:** A small model can do the guessing and the big one only the checking, which yields several tokens per expensive pass with output distributed exactly as if the big model had written it alone.
- **Prerequisites:** kv-cache-inference, language-models
- **Needs:** Two char-level models sharing one vocabulary, both run in the page: as target, the tiny transformer whose weights are shipped precomputed from training-a-tiny-language-model; as draft, a bigram table counted from the same Tiny Shakespeare text (or a smaller transformer).
- **Pitfall:** It is not an approximation: with the rejection rule the output distribution equals the target's (a finite sample histogram matches only up to sampling noise). Accepting only exact matches with the target's top choice is valid only for greedy decoding. The speed-up pays off because a decode pass at small batch is memory-bound, so checking several tokens costs about as much as one; the tiny models on the page are not memory-bound, so the page counts target passes, not seconds.
  > Nearest existing: kv-cache-inference: that page shows why one decode step is memory-bound; this one exploits that slack to verify several drafted tokens per step without changing the output.
  > Why: Wikipedia, Speculative decoding (Leviathan et al. 2023; Chen et al. 2023): https://en.wikipedia.org/wiki/Speculative_decoding

#### tokenization

- **Title:** Tokenization & byte-pair encoding
- **Level:** 3
- **Kind:** step
- **Interaction:** Type a small corpus and run byte-pair encoding one merge at a time: the most frequent adjacent pair fuses, the vocabulary grows by one and the token count of a sample sentence falls, plotted as a curve. Then type any text and watch GPT-2's real byte-level tokenizer apply its merges in rank order after the regex pre-split: common English words become one token, a rare word breaks into several pieces, numbers split oddly, and the same sentence in another language or script costs far more tokens.
- **Takeaway:** Tokens are built by greedily merging the most frequent pairs in the training text, so a model sees whole words where text is common and fragments where it is rare, and cannot see the letters inside a token.
- **Prerequisites:** language-models, compression
- **Related:** transformers, embeddings, ngram-text-models
- **Needs:** GPT-2's merge list and vocabulary (OpenAI; shipped by tiktoken under MIT, the GPT-2 release under a modified MIT licence).
- **Pitfall:** Merges apply in rank order, not by longest match, so the split is deterministic given the merge list; byte-level BPE never needs an unknown token. Do not say models never see letters (single characters are tokens too), nor that they count letters: inside a merged token the spelling is invisible to them.
  > Nearest existing: language-models: that page splits typed text into tokens as given; this one builds the tokenizer merge by merge and shows why the split falls where it does.
  > Why: Hugging Face NLP course, chapter 6, byte-pair encoding tokenization: https://huggingface.co/learn/nlp-course/chapter6/5
  > Data: tiktoken, MIT (confirmed). GPT-2's merge list and vocabulary: OpenAI's gpt-2 repository (modified MIT) and the Hugging Face openai-community/gpt2 repository, tagged MIT, which ships vocab.json and merges.txt (456 kB).

#### training-a-tiny-language-model

- **Title:** Training a tiny language model
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Press train and a small character-level transformer (two layers, a few tens of thousands of weights) learns Tiny Shakespeare live in the page, with a fixed seed: the training and validation cross-entropy fall on a loss curve with smoothed bigram and trigram models' validation scores drawn as horizontal lines, perplexity is read off beside it, and a sample is written every few hundred steps. Change the model width, the context length and the amount of data to load precomputed runs of the same model (trained offline with the same code) and compare them: bigger models and longer contexts end lower, and with too little data the two curves split as it starts memorising.
- **Takeaway:** Training a language model is gradient descent on one number, the average surprise at the next character, and as that number falls the samples go from random letters to plausible spelling to words and line structure.
- **Prerequisites:** language-models, gradient-descent, ngram-text-models
- **Related:** scaling-laws, compression
- **Needs:** Tiny Shakespeare; a tiny char-level transformer trained by the page itself for the default configuration (nanoGPT's character-level configuration is the reference), plus the project's own precomputed loss curves and samples for the other settings, trained offline with the same code; smoothed n-gram baselines counted from the same train/validation split.
- **Pitfall:** Perplexity is the exponential of the average cross-entropy per token and is comparable only between models with the same tokenizer and the same validation text; a training loss near zero is memorisation, not success. The order in which samples improve is a typical pattern, not a guaranteed sequence.
  > Nearest existing: language-models: that page uses a finished model's precomputed probabilities; this one trains a model from random weights in front of the reader and measures it.
  > Why: Karpathy, Neural Networks: Zero to Hero, 'Let's build GPT: from scratch, in code, spelled out': https://karpathy.ai/zero-to-hero.html
  > Data: Tiny Shakespeare (public-domain text; char-rnn repository MIT); nanoGPT is MIT; the weights are the page's own.

### Energy & Machines

#### clock-escapement

- **Title:** Pendulum clocks & the escapement
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Hang a weight on a cord that turns a toothed wheel and watch the wheel spin away in a blur; add the anchor that rocks with a pendulum, and the wheel can now advance only one tooth per swing, with a tick each time a tooth is caught and a tiny push back to the pendulum to keep it going. Lengthen or shorten the pendulum, or hang a heavier weight, and count ticks against a reference second hand to see which change alters the rate.
- **Takeaway:** The weight drives the clock and the pendulum only meters it out, one tooth per swing, so the length of the pendulum sets the time and a heavier weight hardly changes the rate.
- **Prerequisites:** none
- **Pitfall:** The pendulum does not power the clock, and a bigger swing does not tick faster: for small swings the length alone sets the period.
  > Leads to: oscillations-resonance
  > Nearest existing: oscillations-resonance: that page sets a pendulum's length and plots its period; here the period is a given and the page is the catch-and-release that turns swings into ticks, and why the drive weight does not change the rate.
  > Why: Bartosz Ciechanowski's 'Mechanical Watch', the most-shared interactive explainer of a mainspring and escapement (https://pxlnv.com/linklog/mechanical-watch-movement/); KS3 physics collections pair pendulums with moments and pressure (https://www.stem.org.uk/node/15878).

#### drone-four-rotors

- **Title:** How a drone steers with four rotors
- **Level:** 0
- **Kind:** build
- **Interaction:** Each step gives one control, and the drone shows its four rotors with a push arrow and a speed bar on each. Raise the throttle and all four speed up together so the drone rises; push the forward control and watch the back pair speed up, the drone tip and slide forward; push the sideways control and the left pair speeds up so it tips and slides right. Then the turn control speeds up the two rotors that spin clockwise and slows the other two: the lift stays the same but the drone turns on the spot, and if all four spin the same way the body spins helplessly the opposite way. A last step hands over the four rotor speeds directly.
- **Takeaway:** A drone has no flaps or rudder: it climbs, tilts and turns only by spinning its four rotors at slightly different speeds, two one way and two the other.
- **Prerequisites:** none
- **Related:** flight, feedback-control
- **Pitfall:** The rotors do not all spin the same way: the pairs spin opposite ways so their twists cancel, and turning on the spot uses that twist. It is the tilt that moves the drone sideways, not a sideways push from a rotor.
  > Leads to: newtons-laws
  > Nearest existing: helicopter-rotor (pool, level 0): one rotor whose disc tilts, plus a tail rotor; this page has four fixed rotors and steers only by speed differences, with the twist cancelled by counter-rotating pairs. feedback-control (level 2) holds a drone at a height; this page is how the rotor speeds move it at all.
  > Why: 'How do drones fly' is a standard beginner question; explainer of quadcopter lift, pitch, roll and yaw: https://rchelicopterfun.com/quadrocopter.html

#### hydraulics-digger-arm

- **Title:** Diggers and hydraulics: a small push becomes a huge one
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Push a small piston and watch oil shove a much bigger piston at the digger's arm: the big one moves with many times the force but only a fraction of the distance, and a counter shows the two trade places exactly. Change the piston sizes and lift a car, then a boulder; let an air bubble into the pipe and the arm goes spongy. Drive the three cylinders of a digger's boom, arm and bucket to scoop and dump.
- **Takeaway:** A trapped liquid passes on the same push on every bit of surface it touches, so a piston with ten times the area gets ten times the push, paid for by moving only a tenth as far.
- **Prerequisites:** none
- **Pitfall:** Hydraulics make no energy: the work in equals the work out, and the small piston simply travels much farther. The liquid does not pass on the same total force; it passes on the same push per bit of area, which is why the bigger piston gets more. A liquid barely squashes, which is the whole point; a spongy brake pedal is air in the line.
  > Leads to: newtons-laws, bridges-structures
  > Nearest existing: bridges-structures: that page carries loads through members in tension and compression; this page is the fluid push inside a digger's cylinders and the force-for-distance trade.
  > Why: England KS3 science, forces: pressure in fluids and hydraulics, https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study (PhET 'Under Pressure' covers the same ground for middle school)

#### light-bulb-hot-wire

- **Title:** Why a light bulb glows (and gets hot)
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Slide a dimmer and watch the thin wire inside an old-style bulb go from dark to dull red to orange to white as it heats, while a bar splits what the bulb takes into light you can see and heat. At full brightness the heat bar is dozens of times the light bar, and most of that heat leaves as invisible infrared you feel on your hand. Swap in an LED bulb giving the same light: the electricity it needs, and so its heat bar, shrinks to about a tenth, though the LED still makes more heat than light and warms its base instead of glowing in infrared.
- **Takeaway:** An old bulb makes light by heating a wire until it glows white and wastes nearly all its electricity as heat, while an LED makes the same light from about a tenth of the electricity, so far less heat.
- **Prerequisites:** none
- **Needs:** The CIE 1931 colour-matching functions and the photopic V(lambda) curve, to turn the filament's temperature into an on-screen colour and a light-versus-heat split (CIE open-access datasets, CC BY-SA 4.0, cie.co.at/data-tables; also at cvrl.org). Tungsten's resistivity and emissivity against temperature from Jones & Langmuir (1927, General Electric Review), quoted as numbers, or a grey-body emissivity of about 0.4 documented as an approximation. The LED's efficiency is a documented typical value (white LED bulbs at about 90 to 100 lm/W, against about 15 lm/W for incandescent).
- **Pitfall:** The wire does not burn: there is no oxygen inside the bulb, which is why a tungsten filament lasts about a thousand hours. Brightness does not rise in step with the dimmer: a little more current makes the wire much hotter, much brighter and whiter. And an LED is not cold: it still turns over half its electricity into heat, only much less electricity overall.
  > Leads to: electric-circuits, light-optics
  > Nearest existing: electric-circuits: that page lights bulbs as circuit elements with current and voltage meters; this page is what happens inside the bulb's wire and where the energy ends up, with the LED as the comparison.
  > Why: England KS2 science, Year 6 electricity: associate the brightness of a lamp with the cells in the circuit, https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study ('how does a light bulb work' is a perennial search question)
  > Data: CIE 1931 CMFs and V(lambda): CIE open-access datasets, CC BY-SA 4.0 (cie.co.at); tungsten property values are published physical constants, cited.

#### toilet-flush

- **Title:** Toilet flush & siphons
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Press the lever: the flapper lifts, the tank pours into the bowl and the bowl's water climbs toward the top of the bend behind it. The moment it spills over fast enough, the whole bend fills and the bowl drains itself, fast, until air gets in and it gurgles to a stop. Then pour a bucket in slowly or quickly to find what starts the siphon, swap in a wide-bend washdown bowl that never siphons and only pushes the extra water over the top, and watch the float rise with the refilling tank and shut its own valve.
- **Takeaway:** In a siphonic toilet the tank only has to fill the bend behind the bowl; once it is full, the water running down the long side drains the bowl by itself until air gets in and breaks the siphon.
- **Prerequisites:** none
- **Related:** feedback-control
- **Pitfall:** The flush is not suction, and not every toilet siphons. In a siphonic toilet, gravity pulls the water down the long side of the bend while the air pressing on the bowl pushes more water in behind it. A slow pour never fills the bend and just trickles over the top, so the bowl stays full. Washdown toilets, the usual kind in much of Europe, never siphon: the tank's rush pushes the water over the weir.
  > Leads to: newtons-laws
  > Nearest existing: feedback-control: that page tunes PID gains on a pendulum, a drone and a car at level 2; here the float valve is only the last step, an on/off switch, and the page is the siphon, which no existing page shows.
  > Why: A university general-education course on everyday physics opens with a lecture chapter titled 'Toilet Science' (HKU PHYS0607, https://www.physics.hku.hk/~phys0607/lectures/chap02.html); Google's 2017 how-to data puts toilet repair at the top of North American searches (https://www.engadget.com/2017-09-04-google-interactive-map-how-to-searches.html).

#### abs-brakes

- **Title:** ABS & the tire's grip
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Brake a car from highway speed on dry asphalt, wet asphalt or snow: each wheel's spin follows its own equation of motion, and the tire's braking force follows a measured friction-against-slip curve whose peak sits near ten to twenty percent slip on dry asphalt and at smaller slip on snow, falling away as the wheel locks; the stopping distance is marked on the road. Brake too hard with ABS off and the wheel locks, the car slides further and no longer answers the steering; switch ABS on and watch the controller cycle the brake pressure to keep each wheel near the peak.
- **Takeaway:** A tire grips best while still turning slightly slower than the road passes under it, a locked wheel brakes less and cannot steer, and ABS holds each wheel in that narrow band by releasing and reapplying the brake many times a second.
- **Prerequisites:** newtons-laws, feedback-control
- **Related:** bicycle-stability
- **Needs:** Tire friction-slip curves from the Burckhardt model, mu = c1(1 - e^(-c2 s)) - c3 s, with its published coefficient sets for dry asphalt, wet asphalt and snow (reproduced openly, e.g. arXiv:2211.10336); an icy surface only if a cited coefficient set is found.
- **Pitfall:** ABS does not usually shorten the stop on dry road by much; its main job is to keep steering, and on loose gravel or snow a locked wheel can even stop shorter by building a wedge.
  > Nearest existing: feedback-control: that page tunes a PID on generic plants; this one is the specific nonlinear plant whose slip curve is the whole point, and the controller is a bang-bang cycler, not a PID.
  > Why: Pacejka, Tire and Vehicle Dynamics (the standard reference for the slip curve and ABS target slip): https://shop.elsevier.com/books/tire-and-vehicle-dynamics/pacejka/978-0-08-097016-5 (from search results); the same search found ABS design papers using the magic formula to set the slip target.
  > Data: Burckhardt friction-slip coefficients, published in the open literature (arXiv:2211.10336 among others); coefficients are facts, freely reusable.

#### bicycle-stability

- **Title:** Why a bicycle balances itself
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Push a riderless bicycle at a chosen speed and let its linearized equations of motion run: below a certain speed it slowly falls, in a middle band it wobbles and recovers on its own, and above it it slowly leans away. Drag the speed and watch the eigenvalues of lean and steer cross the stability boundary; change the trail, the head angle and the front-wheel mass, cancel the gyroscopic effect of the wheels and the trail in turn and see the ordinary bicycle lose its self-stable band, then load the two-mass-skate design that balances with neither; finally steer left and watch the bike first lean right.
- **Takeaway:** A riderless bicycle balances itself in a band of speeds because a lean makes its front wheel steer into the fall, and that self-steering comes from the geometry and mass of the whole front assembly, not from any single effect such as the wheels' gyroscopic spin.
- **Prerequisites:** newtons-laws, oscillations-resonance, linear-transformations
- **Related:** feedback-control, abs-brakes
- **Needs:** The benchmark bicycle parameters and linearized equations of Meijaard, Papadopoulos, Ruina and Schwab (2007, Proc. R. Soc. A, doi:10.1098/rspa.2007.1857), reproduced openly at http://ruina.tam.cornell.edu/research/topics/bicycle_mechanics/, and the two-mass-skate parameters of Kooijman et al. (2011, Science 332:339, doi:10.1126/science.1201959).
- **Pitfall:** Neither 'the gyroscope keeps it up' nor 'the gyroscope plays no part' is right. On the standard benchmark bicycle, cancelling the wheels' gyroscopic effect removes its self-stable speed band. Yet Kooijman et al. (2011) built a bicycle that balances with neither a gyroscopic effect nor trail. Self-stability comes from several effects working together.
  > Nearest existing: feedback-control balances an inverted pendulum with a controller; this page balances with no controller at all, from the geometry's own eigenvalues.
  > Why: Bartosz Ciechanowski, Bicycle (interactive explainer; demand signal): https://ciechanow.ski/bicycle/ (from search results; page reachable).
  > Data: Meijaard et al. 2007 benchmark and Kooijman et al. 2011 parameters (published numerical values, which are facts; the benchmark is openly reproduced on the Cornell page).

#### gas-turbines-combined-cycle

- **Title:** Combined-cycle power plants
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Set a gas turbine's pressure ratio and turbine inlet temperature and watch its exhaust leave at several hundred degrees; then route that exhaust through a heat-recovery steam generator drawn as a temperature-heat diagram, the cooling gas line above the heating water-and-steam line. Drag the steam pressure and the pinch-point gap, add a second and third pressure level, and see the two lines hug more closely, the stack temperature fall and the plant's combined efficiency climb past 60 percent.
- **Takeaway:** A combined-cycle plant reaches about 60 percent efficiency because a steam cycle turns the gas turbine's hot exhaust into extra work, and it recovers more the more closely the steam's heating line can follow the cooling exhaust.
- **Prerequisites:** heat-engines, entropy
- **Related:** power-grid, heat-pumps-refrigeration
- **Needs:** Specific heats of air and combustion products as functions of temperature (NASA Glenn thermodynamic polynomial coefficients, US government, public domain); water and steam properties from IAPWS-IF97 (freely published), as in steam-power-cycles.
- **Pitfall:** The best gas turbine for a combined cycle is not the most efficient stand-alone one. A lower pressure ratio leaves a hotter exhaust for the steam cycle, so the plant's optimum pressure ratio is below the gas turbine's own. And the steam cycle burns no extra fuel: it only uses heat that would otherwise go up the stack.
  > Nearest existing: jet-engines and steam-power-cycles each show one of the two cycles on a T-s diagram; this page shows only what neither does: the heat-recovery boiler's temperature-heat matching and pinch point that couple them into one plant.
  > Why: University energy-systems syllabus (Bologna, Energy Systems T): Brayton cycle plant, work and efficiency vs. compression ratio, polytropic efficiency and turbine inlet temperature, gas-steam combined cycles: https://www.unibo.it/en/teaching/course-unit-catalogue/course-unit/2022/432100 (from search results).
  > Data: NASA Glenn thermodynamic polynomials (public domain); IAPWS-IF97 (freely published).

#### heat-pumps-refrigeration

- **Title:** Heat pumps & refrigeration
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the evaporator and condenser temperatures of a vapor-compression cycle on a pressure-enthalpy diagram drawn from real refrigerant properties and watch the four legs, compression, condensation, expansion and evaporation, move with them; the coefficient of performance, the compressor work and the heat delivered update live and are compared with the Carnot value for the same temperature lift. Set the compressor's isentropic efficiency, add subcooling and superheat, and switch the refrigerant between R-134a, propane and CO2, where the cycle goes transcritical.
- **Takeaway:** A heat pump delivers several units of heat per unit of work by boiling and condensing a fluid at two pressures, and that ratio falls as the gap between the two temperatures widens.
- **Prerequisites:** heat-engines, entropy, states-of-matter
- **Related:** gas-turbines-combined-cycle
- **Needs:** Saturation and superheated-vapor properties of R-134a, R-290 and R-744 from CoolProp (MIT licence), tabulated or fitted for the browser.
- **Pitfall:** A COP of 4 is not '400 percent efficiency' and breaks no law: most of the heat delivered is moved from outside, not made from the electricity, and the second law still caps the COP at the Carnot value for the lift.
  > Nearest existing: heat-engines never runs a cycle backward and has no phase change; this page runs a real refrigerant around a p-h diagram, with compressor losses, subcooling and superheat, the Carnot comparison and the transcritical CO2 cycle. The runner-up heat-pumps (level 1) is the householder's version with bars for heat delivered against work.
  > Why: Purdue ME 200 Thermodynamics I homework: a four-component R-134a vapor-compression cycle with evaporator and condenser temperatures, compressor efficiency and COP: https://engineering.purdue.edu/ME200/files/homework/HW36/ME200-Spring2020-HW36-web.html (from search results); demand: IEA, The Future of Heat Pumps, https://www.iea.org/reports/the-future-of-heat-pumps.
  > Data: CoolProp refrigerant property library (MIT licence).

#### wind-turbine-aerodynamics

- **Title:** Wind turbines & the Betz limit
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Start with an actuator disc: drag how much the air slows through the rotor and watch the stream tube widen, the thrust and power change, and the power coefficient peak at 16/27 when the air leaving is slowed to a third. Then replace the disc with real blades: set the tip-speed ratio and the blade pitch, and a blade-element-momentum model (with tip-loss and the high-induction correction) using measured airfoil polars computes the angle of attack along the blade, the power coefficient against tip-speed ratio, and the power curve against wind speed with pitch control holding power at rated above rated wind.
- **Takeaway:** No rotor can take more than 59 percent of the wind's power because the air must keep moving to get out of the way, and real blades approach that only near one tip-speed ratio.
- **Prerequisites:** flight
- **Related:** power-grid
- **Needs:** Lift and drag polars of wind-turbine airfoils: the NREL 5-MW reference turbine's AeroData tables (DU and NACA64 sections) as distributed in the OpenFAST r-test repository (github.com/OpenFAST/r-test, Apache-2.0), with blade chord and twist from the same reference turbine; NACA airfoil data (public domain) as a fallback.
- **Pitfall:** The Betz limit is not a design shortcoming of today's turbines; it applies to any device that takes energy from a free stream, so a rotor near 50 percent is close to perfect.
  > Nearest existing: flight: it reuses the airfoil polar, but the graphic is the whole rotor and the momentum balance of the stream through it; solar-cells is the only other page with a hard physical ceiling on efficiency.
  > Why: Penn State AERSP 583 Wind Turbine Aerodynamics (actuator disc, Betz limit, blade element momentum theory): https://www.e-education.psu.edu/aersp583/ (from search results); also the OpenMDAO Betz-limit worked example https://openmdao.org/docs/latest/examples/betz_limit.html.
  > Data: OpenFAST r-test repository, 5MW_Baseline/AeroData (Apache-2.0; check the repository LICENSE when shipping); NACA reports (public domain).

## Checklist lines to add

**Mathematics**

- [ ] monty-hall
- [ ] shapes-that-tile
- [ ] why-triangles-are-stiff
- [ ] cellular-automata
- [ ] exponentials-logarithms
- [ ] game-theory-cooperation
- [ ] differential-equations
- [ ] calculus-of-variations
- [ ] phase-portraits
- [ ] random-graphs
- [ ] resampling-inference
- [ ] taylor-series

**Physics**

- [ ] blue-sky-red-sunset
- [ ] floating-sinking-and-boats
- [ ] magnets-and-poles
- [ ] shadows-and-pinholes
- [ ] vibrations-and-sound
- [ ] musical-scales-ratios
- [ ] ising-model
- [ ] lasers

**Chemistry & Materials**

- [ ] dissolving-sugar-and-salt
- [ ] salt-and-ice
- [ ] why-metal-feels-cold
- [ ] chromatography
- [ ] dislocations-alloys
- [ ] huckel-molecular-orbitals
- [ ] surface-catalysis
- [ ] transition-state-theory

**Biology**

- [ ] ant-trails
- [ ] be-the-bird-camouflage
- [ ] fireflies-in-sync
- [ ] flocking-birds
- [ ] diffusion-osmosis
- [ ] pcr-copying-dna
- [ ] bacterial-chemotaxis
- [ ] lac-operon
- [ ] morphogen-gradients
- [ ] population-genetics
- [ ] turing-patterns

**Body & Medicine**

- [ ] hearing-and-the-ear
- [ ] muscles-pull-in-pairs
- [ ] why-spinning-makes-you-dizzy
- [ ] why-you-get-sleepy
- [ ] pharmacokinetics-dosing
- [ ] cerebellum-motor-learning
- [ ] cochlea-hearing
- [ ] ecg-arrhythmias
- [ ] mri-k-space

**Earth & Climate**

- [ ] cloud-base
- [ ] forest-fire-spread
- [ ] sea-breeze
- [ ] tsunamis
- [ ] carbonate-silicate-thermostat
- [ ] ensemble-weather-forecasting
- [ ] ocean-acidification
- [ ] radiative-convective-column

**Space**

- [ ] comet-tails
- [ ] earth-is-a-ball
- [ ] leap-years
- [ ] aperture-synthesis
- [ ] lagrange-points-three-body

**Computing**

- [ ] life-on-a-grid
- [ ] secret-codes
- [ ] twenty-questions
- [ ] game-tree-search
- [ ] cache-memory-hierarchy
- [ ] hash-tables-bloom-filters

**Information & Networks**

- [ ] barcode-stripes
- [ ] qr-codes
- [ ] wifi-and-walls
- [ ] shazam-audio-fingerprint
- [ ] distributed-hash-tables
- [ ] elliptic-curve-cryptography
- [ ] kalman-filter
- [ ] radar-sonar
- [ ] tcp-congestion-control

**Artificial Intelligence**

- [ ] next-word-guessing-game
- [ ] spam-filter-word-counts
- [ ] teach-a-machine
- [ ] k-means-clustering
- [ ] ngram-text-models
- [ ] chain-of-thought-scratchpad
- [ ] kv-cache-inference
- [ ] positional-encoding
- [ ] residual-stream-logit-lens
- [ ] rlhf-alignment
- [ ] scaling-laws
- [ ] speculative-decoding
- [ ] tokenization
- [ ] training-a-tiny-language-model

**Energy & Machines**

- [ ] clock-escapement
- [ ] drone-four-rotors
- [ ] hydraulics-digger-arm
- [ ] light-bulb-hot-wire
- [ ] toilet-flush
- [ ] abs-brakes
- [ ] bicycle-stability
- [ ] gas-turbines-combined-cycle
- [ ] heat-pumps-refrigeration
- [ ] wind-turbine-aerodynamics

## Links to add to existing entries

Each new entry that lists an existing topic under Related needs the reverse link in that
existing entry (the catalogue's Related links are mutual). The third column is for information:
the new pages that would list the existing one as a prerequisite.

| Existing topic             | Add to its Related                                                                                                | New pages that build on it                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| unit-circle                |                                                                                                                   | positional-encoding                                                                                            |
| calculus                   |                                                                                                                   | calculus-of-variations, differential-equations, pharmacokinetics-dosing, phase-portraits, taylor-series        |
| linear-transformations     |                                                                                                                   | bicycle-stability, huckel-molecular-orbitals, kalman-filter, phase-portraits                                   |
| complex-numbers            |                                                                                                                   | taylor-series                                                                                                  |
| fourier-transform          | musical-scales-ratios, positional-encoding, taylor-series                                                         | aperture-synthesis, cochlea-hearing, mri-k-space, radar-sonar, shazam-audio-fingerprint                        |
| bayes-theorem              | ensemble-weather-forecasting, monty-hall                                                                          | kalman-filter, resampling-inference, rlhf-alignment                                                            |
| central-limit-theorem      |                                                                                                                   | chromatography, kalman-filter, population-genetics, random-graphs, resampling-inference                        |
| chaos-fractals             | cellular-automata, lagrange-points-three-body, phase-portraits, turing-patterns                                   | ensemble-weather-forecasting                                                                                   |
| newtons-laws               | why-spinning-makes-you-dizzy                                                                                      | abs-brakes, bicycle-stability, calculus-of-variations, transition-state-theory                                 |
| oscillations-resonance     | phase-portraits, why-spinning-makes-you-dizzy                                                                     | bicycle-stability, lasers                                                                                      |
| waves-interference         | vibrations-and-sound                                                                                              | aperture-synthesis, cochlea-hearing, musical-scales-ratios, radar-sonar, tsunamis                              |
| electromagnetism           | magnets-and-poles                                                                                                 | mri-k-space                                                                                                    |
| light-optics               | blue-sky-red-sunset, calculus-of-variations                                                                       | aperture-synthesis                                                                                             |
| entropy                    | diffusion-osmosis                                                                                                 | gas-turbines-combined-cycle, heat-pumps-refrigeration, ising-model                                             |
| quantum-mechanics          |                                                                                                                   | huckel-molecular-orbitals, lasers                                                                              |
| radioactivity              | exponentials-logarithms                                                                                           | pharmacokinetics-dosing                                                                                        |
| chemical-bonds             |                                                                                                                   | huckel-molecular-orbitals                                                                                      |
| states-of-matter           | dissolving-sugar-and-salt, floating-sinking-and-boats, ising-model, random-graphs                                 | diffusion-osmosis, dislocations-alloys, heat-pumps-refrigeration                                               |
| reaction-rates-equilibrium |                                                                                                                   | chromatography, lac-operon, ocean-acidification, surface-catalysis, transition-state-theory, turing-patterns   |
| acids-bases                | exponentials-logarithms                                                                                           | ocean-acidification                                                                                            |
| carbon-polymers            | huckel-molecular-orbitals                                                                                         |                                                                                                                |
| semiconductors             | huckel-molecular-orbitals, lasers                                                                                 | dislocations-alloys                                                                                            |
| the-cell                   |                                                                                                                   | bacterial-chemotaxis, diffusion-osmosis, morphogen-gradients                                                   |
| dna-to-protein             |                                                                                                                   | lac-operon, morphogen-gradients, pcr-copying-dna                                                               |
| respiration-atp            | diffusion-osmosis                                                                                                 |                                                                                                                |
| meiosis-inheritance        |                                                                                                                   | population-genetics                                                                                            |
| evolution                  | be-the-bird-camouflage, game-theory-cooperation                                                                   | population-genetics                                                                                            |
| ecosystems                 | differential-equations, flocking-birds, game-theory-cooperation, phase-portraits                                  |                                                                                                                |
| crispr                     | lac-operon                                                                                                        |                                                                                                                |
| heart-circulation          |                                                                                                                   | ecg-arrhythmias                                                                                                |
| homeostasis                | bacterial-chemotaxis, pharmacokinetics-dosing, why-you-get-sleepy                                                 |                                                                                                                |
| neurons                    |                                                                                                                   | cerebellum-motor-learning, cochlea-hearing, ecg-arrhythmias                                                    |
| vision-color               | cochlea-hearing, hearing-and-the-ear                                                                              |                                                                                                                |
| epidemics                  | differential-equations, exponentials-logarithms, forest-fire-spread, pcr-copying-dna, random-graphs               |                                                                                                                |
| cancer                     | population-genetics                                                                                               |                                                                                                                |
| medical-imaging            | aperture-synthesis, radar-sonar                                                                                   | mri-k-space                                                                                                    |
| plate-tectonics            | tsunamis                                                                                                          |                                                                                                                |
| earthquakes                | exponentials-logarithms                                                                                           | tsunamis                                                                                                       |
| deep-time                  | carbonate-silicate-thermostat                                                                                     |                                                                                                                |
| atmosphere-weather         |                                                                                                                   | ensemble-weather-forecasting, radiative-convective-column                                                      |
| ocean-currents             | ocean-acidification                                                                                               |                                                                                                                |
| carbon-cycle               |                                                                                                                   | carbonate-silicate-thermostat, ocean-acidification                                                             |
| greenhouse-effect          |                                                                                                                   | carbonate-silicate-thermostat, radiative-convective-column                                                     |
| sun-earth-moon             | shadows-and-pinholes                                                                                              |                                                                                                                |
| orbits-kepler              | calculus-of-variations, leap-years                                                                                | lagrange-points-three-body                                                                                     |
| rockets                    | lagrange-points-three-body                                                                                        |                                                                                                                |
| black-holes                | aperture-synthesis                                                                                                |                                                                                                                |
| gravitational-waves        | aperture-synthesis                                                                                                |                                                                                                                |
| binary                     |                                                                                                                   | hash-tables-bloom-filters, shazam-audio-fingerprint                                                            |
| logic-gates                | cellular-automata                                                                                                 |                                                                                                                |
| cpu                        |                                                                                                                   | cache-memory-hierarchy                                                                                         |
| gpu                        | cache-memory-hierarchy                                                                                            | kv-cache-inference                                                                                             |
| sorting                    | exponentials-logarithms, game-tree-search                                                                         | hash-tables-bloom-filters                                                                                      |
| graph-search               | ant-trails, distributed-hash-tables                                                                               | game-tree-search, random-graphs                                                                                |
| turing-machines            | cellular-automata, chain-of-thought-scratchpad                                                                    |                                                                                                                |
| quantum-computing          | elliptic-curve-cryptography                                                                                       |                                                                                                                |
| compression                | cochlea-hearing, ngram-text-models, shazam-audio-fingerprint, training-a-tiny-language-model                      | tokenization                                                                                                   |
| cryptography               | hash-tables-bloom-filters                                                                                         | elliptic-curve-cryptography                                                                                    |
| wireless-signals           | tcp-congestion-control                                                                                            | radar-sonar                                                                                                    |
| internet                   | random-graphs                                                                                                     | distributed-hash-tables, tcp-congestion-control                                                                |
| gps                        | kalman-filter, radar-sonar                                                                                        |                                                                                                                |
| pagerank                   | distributed-hash-tables, random-graphs                                                                            |                                                                                                                |
| consensus-blockchains      | distributed-hash-tables, elliptic-curve-cryptography                                                              |                                                                                                                |
| learning-from-data         |                                                                                                                   | k-means-clustering, ngram-text-models, resampling-inference, scaling-laws                                      |
| gradient-descent           | calculus-of-variations, cerebellum-motor-learning                                                                 | scaling-laws, training-a-tiny-language-model                                                                   |
| neural-networks            | ising-model                                                                                                       | scaling-laws                                                                                                   |
| embeddings                 | k-means-clustering, tokenization                                                                                  |                                                                                                                |
| transformers               | rlhf-alignment, tokenization                                                                                      | chain-of-thought-scratchpad, kv-cache-inference, positional-encoding, residual-stream-logit-lens               |
| language-models            | next-word-guessing-game, ngram-text-models, scaling-laws                                                          | residual-stream-logit-lens, rlhf-alignment, speculative-decoding, tokenization, training-a-tiny-language-model |
| reinforcement-learning     | cerebellum-motor-learning, game-theory-cooperation, game-tree-search                                              | rlhf-alignment                                                                                                 |
| heat-engines               |                                                                                                                   | gas-turbines-combined-cycle, heat-pumps-refrigeration                                                          |
| power-grid                 | gas-turbines-combined-cycle, wind-turbine-aerodynamics                                                            |                                                                                                                |
| solar-cells                | lasers                                                                                                            |                                                                                                                |
| flight                     | drone-four-rotors                                                                                                 | wind-turbine-aerodynamics                                                                                      |
| bridges-structures         | dislocations-alloys, muscles-pull-in-pairs                                                                        |                                                                                                                |
| feedback-control           | bacterial-chemotaxis, bicycle-stability, differential-equations, drone-four-rotors, phase-portraits, toilet-flush | abs-brakes, cerebellum-motor-learning, kalman-filter, tcp-congestion-control                                   |

## Suggested first waves

The rules in `BACKLOG.md` still apply: a topic is ready once its prerequisites are built, and
the first topic of a new kind of page builds the shared pieces that the rest reuse. Three things
are new.

- **A level-0 wave first.** Five level-0 topics, one per interaction kind, with no prerequisites
  and no `Needs`, build the conventions of a level-0 page (one control per step, no formula
  labels, readouts as comparisons, the closing "read next" step) before the other thirty-four
  follow. Suggested: shadows-and-pinholes (manipulate), fireflies-in-sync (simulate),
  barcode-stripes (step), why-triangles-are-stiff (build) and leap-years (explore).
- **A level-3 wave per category.** One level-3 topic in each of the seven categories that have
  none today, each with only existing prerequisites, so each category gets its first university
  page early and the gaps close evenly. Suggested: taylor-series (Mathematics),
  chromatography (Chemistry & Materials), bacterial-chemotaxis (Biology),
  cerebellum-motor-learning (Body & Medicine), ensemble-weather-forecasting (Earth & Climate),
  tcp-congestion-control (Information & Networks) and wind-turbine-aerodynamics (Energy &
  Machines).
- **The LLM ladder in order.** positional-encoding and tokenization need only existing pages and
  no data, so they can start at once; training-a-tiny-language-model follows its level-1
  prerequisite ngram-text-models, and it builds the in-browser training loop that
  chain-of-thought-scratchpad and the second-wave rungs reuse.
- After those, build whatever is ready, favouring topics that unlock others (the level-0 roots
  unlock nothing in the catalogue sense, so order them by demand: the questions people ask most
  first).

## Framework implications (not implemented here)

Nothing below is done in this proposal; it is what adopting it would touch, so the first level-0
and level-3 builds can be planned.

- **Catalogue (`docs/TOPICS.md`).** The Levels table gets the level-0 row; the category table's
  counts change; each promoted entry is copied in under its category, its slug added to the
  checklist, and the links under "Links to add to existing entries" applied. The invariants test
  (`e2e/catalog.e2e.ts`) then checks the result, once the parser accepts level 0.
- **Parser (`src/lib/catalog-parse.ts`).** `Level` becomes `0 | 1 | 2 | 3`, `levelNames` gets
  the level-0 reader, and the parser's level check accepts 0. BACKLOG already notes this as the
  one change a new level needs; the index's Level filter and the cards pick it up from there
  (the filter sorts levels numerically, so 0 lands first).
- **Index.** With 200 topics the Area chips take five rows on a phone (BACKLOG); a menu there may
  be worth it. A "Start here" entry point for level 0 on the index is a small addition: the Level
  filter already does it with `?level=0`.
- **Explainer shell and scene guide.** A level-0 page is the same `ExplainerSpec`, shorter and
  with one control per step; `docs/scene-guide.md` gets a short "level-0 pages" section (no
  formula labels on stage, a single large control, readouts as comparisons). No framework change
  is needed to build the first one; build it and extract what repeats.
- **Level 3 pages.** Several entries ship a small dataset or a tiny trained model (the way
  diffusion-models ships MNIST). Each `Needs` names its source and licence; when built, the
  source goes into `docs/DATA-SOURCES.md`, as today. Entries whose data is not openly licensed
  were rejected during review, so none below should need an unanswered permission.
- **Docs.** README, STATUS and the dashboard say "100 explainers"; they change when the first new
  topic lands, not now.

## Candidates that did not make the hundred

Every candidate that did not make the hundred is kept, with its scores and the judges' and
reviewers' notes, in `docs/proposals/topics-200/data/` (`selection.json`, `verified.json`). The
strongest of them are the natural new Reserve. Score is the mean of the two judges' marks
(1 to 5) times three, so 15 is the top.

**The LLM ladder's second wave.** Rungs left out of the ladder, several scoring as well as the pages selected; the
two level-0 entries are further doors into the same subject.

| Slug                            | Level | Category                | Title                                                 | Score (marks)         |
| ------------------------------- | ----- | ----------------------- | ----------------------------------------------------- | --------------------- |
| adaptive-optimizers             | 3     | Artificial Intelligence | Momentum, Adam & learning-rate schedules              | 13.5 (fit 4, build 5) |
| weight-quantization             | 3     | Artificial Intelligence | Quantization: shrinking a model's numbers             | 13.5 (fit 4, build 5) |
| mixture-of-experts              | 3     | Artificial Intelligence | Mixture of experts                                    | 13.5 (fit 4, build 5) |
| lora-fine-tuning                | 3     | Artificial Intelligence | Fine-tuning & LoRA                                    | 12 (fit 4, build 4)   |
| instruction-tuning              | 3     | Artificial Intelligence | From base model to assistant                          | 10.5 (fit 4, build 3) |
| reasoning-rl-verifiable-rewards | 3     | Artificial Intelligence | Training reasoning with checkable rewards             | 10.5 (fit 4, build 3) |
| long-context-attention-cost     | 3     | Artificial Intelligence | Long context & the cost of attention                  | 12 (fit 4, build 4)   |
| induction-heads                 | 3     | Artificial Intelligence | Induction heads: how a model copies from its prompt   | 13.5 (fit 5, build 4) |
| superposition-toy-models        | 3     | Artificial Intelligence | Superposition: more features than neurons             | 13.5 (fit 4, build 5) |
| retrieval-augmented-generation  | 3     | Artificial Intelligence | Retrieval: how a chatbot looks things up              | 12 (fit 4, build 4)   |
| where-facts-live                | 3     | Artificial Intelligence | Where a language model keeps its facts                | 10.5 (fit 4, build 3) |
| knowledge-distillation          | 3     | Artificial Intelligence | Distillation: a small model learning from a large one | 10.5 (fit 3, build 4) |
| words-keep-company              | 0     | Artificial Intelligence | Words that keep the same company                      | 12 (fit 4, build 4)   |
| learning-by-reward              | 0     | Artificial Intelligence | Learning by treats: how a robot learns by trying      | 13.5 (fit 4, build 5) |

**The completeness critics' finds.** Verified and judged like the rest, but each would have had
to displace a higher-scored topic or break a category target to get in.

| Slug                        | Level | Category               | Title                                                   | Score (marks)         |
| --------------------------- | ----- | ---------------------- | ------------------------------------------------------- | --------------------- |
| sequence-alignment          | 3     | Biology                | Sequence alignment: lining up genes across species      | 13.5 (fit 4, build 5) |
| queueing-theory             | 3     | Information & Networks | Queues: why a nearly busy server is so slow             | 13.5 (fit 4, build 5) |
| switching-power-converters  | 3     | Energy & Machines      | Switching power supplies: how a charger changes voltage | 13.5 (fit 4, build 5) |
| why-the-moon-doesnt-fall    | 0     | Space                  | Why the Moon doesn't fall down                          | 13.5 (fit 4, build 5) |
| friction-slide-or-stick     | 0     | Physics                | Friction: why things slide or stick                     | 13.5 (fit 4, build 5) |
| receptor-pharmacology       | 3     | Body & Medicine        | Drug receptors: dose-response, agonists & antagonists   | 12 (fit 4, build 4)   |
| microwave-oven-hot-spots    | 1     | Physics                | Microwave ovens & their hot spots                       | 12 (fit 4, build 4)   |
| static-electricity-balloons | 0     | Physics                | Static electricity: why a balloon sticks to the wall    | 12 (fit 4, build 4)   |
| landscape-evolution         | 3     | Earth & Climate        | How rivers carve mountains: landscape evolution         | 12 (fit 3, build 5)   |
| cyclic-voltammetry          | 3     | Chemistry & Materials  | Cyclic voltammetry: reading a reaction from a current   | 12 (fit 3, build 5)   |
| water-cycle                 | 0     | Earth & Climate        | Where rain comes from: the water cycle                  | 10.5 (fit 4, build 3) |
| rivers-carve-valleys        | 0     | Earth & Climate        | How rivers carve valleys                                | 10.5 (fit 3, build 4) |
| lightning-strikes           | 1     | Earth & Climate        | Lightning: how a bolt finds the ground                  | 10.5 (fit 3, build 4) |

**The strongest other runners-up**, by score, then fit:

| Slug                     | Level | Category                | Title                                                       | Score (marks)         |
| ------------------------ | ----- | ----------------------- | ----------------------------------------------------------- | --------------------- |
| monte-carlo-tree-search  | 3     | Artificial Intelligence | Monte Carlo tree search & AlphaGo                           | 15 (fit 5, build 5)   |
| tennis-racket-theorem    | 3     | Physics                 | The tennis racket theorem: why a spinning handle flips      | 15 (fit 5, build 5)   |
| hydrogen-atom            | 3     | Physics                 | The Schrödinger equation & the hydrogen atom                | 15 (fit 5, build 5)   |
| sink-or-float            | 0     | Chemistry & Materials   | Sink or float                                               | 15 (fit 5, build 5)   |
| bell-inequality          | 3     | Physics                 | Entanglement & Bell's theorem                               | 15 (fit 5, build 5)   |
| blackbody-cavity-modes   | 3     | Physics                 | Blackbody radiation from counting modes                     | 15 (fit 5, build 5)   |
| navier-stokes            | 3     | Physics                 | Fluid flow & the Navier-Stokes equations                    | 13.5 (fit 5, build 4) |
| least-action             | 3     | Physics                 | The principle of least action                               | 13.5 (fit 5, build 4) |
| beach-waves              | 0     | Earth & Climate         | Waves at the beach                                          | 13.5 (fit 5, build 4) |
| kidney-nephron           | 3     | Body & Medicine         | The nephron: filter, then reclaim                           | 13.5 (fit 5, build 4) |
| dimensionality-reduction | 3     | Artificial Intelligence | Dimensionality reduction: PCA & t-SNE                       | 13.5 (fit 4, build 5) |
| support-vector-machines  | 3     | Artificial Intelligence | Support vector machines & kernels                           | 13.5 (fit 4, build 5) |
| evolutionary-algorithms  | 3     | Artificial Intelligence | Evolutionary algorithms                                     | 13.5 (fit 4, build 5) |
| graph-neural-networks    | 3     | Artificial Intelligence | Graph neural networks                                       | 13.5 (fit 4, build 5) |
| tree-ensembles           | 3     | Artificial Intelligence | Decision trees, random forests & gradient boosting          | 13.5 (fit 4, build 5) |
| gaussian-processes       | 3     | Artificial Intelligence | Gaussian processes                                          | 13.5 (fit 4, build 5) |
| double-descent           | 3     | Artificial Intelligence | Bias, variance & double descent                             | 13.5 (fit 4, build 5) |
| os-scheduling            | 3     | Computing               | Operating systems: processes & scheduling                   | 13.5 (fit 4, build 5) |
| 3d-printer-layers        | 0     | Computing               | How a 3D printer builds a shape                             | 13.5 (fit 4, build 5) |
| kuramoto-synchronization | 3     | Physics                 | Synchronization: metronomes, bridges and the Kuramoto model | 13.5 (fit 4, build 5) |
| bezier-curves            | 1     | Mathematics             | Bézier curves: how fonts and vector drawings bend           | 13.5 (fit 4, build 5) |
| falling-and-parachutes   | 0     | Physics                 | Falling & parachutes                                        | 13.5 (fit 4, build 5) |
| digital-camera-sensor    | 0     | Physics                 | What a camera's sensor counts                               | 13.5 (fit 4, build 5) |
| bifurcations             | 3     | Physics                 | Bifurcations & nonlinear dynamics                           | 13.5 (fit 4, build 5) |
| galaxy-collisions        | 3     | Space                   | Colliding galaxies                                          | 13.5 (fit 4, build 5) |
| haemoglobin-oxygen       | 3     | Body & Medicine         | Oxygen & haemoglobin                                        | 13.5 (fit 4, build 5) |
| luria-delbruck           | 3     | Biology                 | Luria-Delbruck: mutations before selection                  | 13.5 (fit 4, build 5) |
| cpu-pipelines            | 3     | Computing               | Pipelines & branch prediction                               | 13.5 (fit 4, build 5) |
| membrane-potential       | 3     | Biology                 | Membrane transport & the resting potential                  | 13.5 (fit 4, build 5) |
| cell-cycle-switch        | 3     | Biology                 | Cell cycle control                                          | 13.5 (fit 4, build 5) |

**Refuted in review:** x-ray-diffraction (level 3, Chemistry & Materials): it repeats crystal-diffraction, a physics candidate with the same mechanism and takeaway (a runner-up at 12); one page on diffraction from crystals could return later under either name.

## How this list was made

The list was produced by a pipeline of small orchestrated research runs on 2026-10-17 and
2026-10-18, with plain scripts between them, and then checked by hand. The scripts, every
agent's output and the scores are in `docs/proposals/topics-200/` (its README explains the
files).

1. **Generation.** Nineteen independent researchers, each with its own lens (eight level-0
   lenses: home mechanisms, everyday technology, basic physical science, living things and the
   body, earth and sky, kitchen chemistry, numbers and computers, vehicles and big machines;
   nine level-3 lenses, one per category or pair of categories; one demand lens over the most
   asked "how does X work" questions; one lens for level-1 and level-2 holes and the Reserve
   list), each reading the catalogue and searching curricula and demand signals, proposed about
   thirty candidates in the catalogue's entry format with a source for each. After the user asked
   for the AI tilt, a twentieth lens proposed the missing rungs of an LLM ladder (16 candidates).
   573 candidates in all, after exact duplicates were removed.
2. **Merge.** One pass per category clustered near-duplicates and dropped candidates an
   existing page already covers (16 dropped). Where a judge later rejected the
   candidate a merge had kept (twice, each time as a duplicate of the one it absorbed), the
   absorbed candidates came back.
3. **Judging.** Every candidate was scored 1 to 5 by two judges, in batches of 25: one for fit,
   honest level and distinctness from the existing pages, one for buildability as a real
   client-side model with openly licensed data. A rejection by either judge removed the
   candidate (10 rejected), and the level judge could re-level it
   (6 re-levelled). The score is the mean of the two marks.
4. **Selection.** In code, by quota: 39 at level 0, 10 at level 1, 3 at level 2, 48 at level 3,
   with per-category targets for the level-0 and level-3 slots and at most twelve new topics per
   category (eighteen for AI). AI's level-3 slots were filled first with one page per stage of
   the LLM ladder (the best-scored candidate of each stage). Ties, common with two 1-to-5 marks,
   went to the higher fit mark, then to AI, then to candidates named as the promotion of a
   Reserve item, then to the demand lens, then to a fixed hash of the slug. A curator then
   reviewed the whole selection against the runners-up and proposed five swaps; one went through
   in effect (lasers in, tennis-racket-theorem out), four that would have moved level-3 slots
   from Space or Energy & Machines into AI were refused because they broke the targets the user
   had chosen to keep, and one duplicate it flagged (sink-or-float beside
   floating-sinking-and-boats) was resolved by hand with the alternative it named.
5. **Verification.** Each selected topic faced a sceptical reviewer (one per batch of five) who
   tried to show it duplicates an existing page, is dishonestly levelled, cannot be a real
   browser model, lacks open data or states something false, and either refuted it (its slot
   went to the best untried runner-up at the same level, same category first) or fixed it
   (re-levelled it, narrowed the interaction, named the data source, corrected a takeaway or a
   pitfall). One topic was refuted and replaced; 86 were fixed.
6. **Completeness.** Three critics (a primary-school teacher, a university lecturer, an editor
   who tracks search demand) looked for must-haves still missing from the existing and proposed
   lists and proposed 18 candidates. All were verified like the rest, then judged by the same two
   judges, and each could replace the lowest-scored topic at its level only if it outscored it
   and kept the category targets and the ladder intact (one swap; the other seventeen are listed with the runners-up).
7. **Invariants.** The final set was checked in code against the catalogue's rules together
   with the existing 100: unique slugs (also against `src/routes`), prerequisites that exist and
   never sit above the topic's level, no cycles, mutual Related links, every `Needs` naming a
   licence, and the counts in the tables above. Links to candidates that did not make the
   hundred were dropped mechanically, and Related links among the hundred made mutual.

## Open questions

Nothing here changes the catalogue until the user promotes entries. The decisions that are the
user's to make:

1. **The level-0 definition** (see "Level 0"): ages 9 to 13 or adults with no science
   background, no formulas, one control at a time, 6 to 9 steps, level-0 prerequisites only.
2. **The split, 39 / 10 / 3 / 48.** It follows the user's choice to take AI's slots from level 0.
   The LLM ladder's second wave (twelve further rungs, several scoring as well as the ones selected) would
   need about ten more AI slots: from level 0 again, from other categories' level-3 targets, or
   as a follow-on batch beyond these hundred.
3. **The optional Everyday things category**, or the recommended "Start here" link to the
   level-0 filter with the eleven categories unchanged.
4. **The re-levelling footnote**: whether to move black-holes, big-bang, medical-imaging, gps or
   standard-model from level 2 to level 3.
5. **The Reserve dispositions**: ten promotions, and four drops (fluid dynamics, operating
   systems, compilers, DNA sequencing) that lost on score to the level-3 picks of their
   categories.
6. **The water cycle.** The catalogue notes it is not covered, and the primary-school critic
   re-proposed it as a must-have, but its build mark (3: the risk of a scripted loop rather than a
   model) kept it below Earth & Climate's level-0 picks. Swap it in for one of them (cloud-base,
   forest-fire-spread or sea-breeze), or leave it as the first level-0 runner-up.
