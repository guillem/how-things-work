# Topic catalog

Source of truth for the content of an interactive web learning tool that shows how things work. It defines 194 topics in 11 categories, each built around one interactive graphic. Readers range from high-school students to university majors.

This file covers content only. It does not choose the stack, the visual design or the project layout; take those from the repository's own instructions.

## How to use this file

- **Read everything above "Checklist" before working on any topic.** Those sections are short and apply to every page.
- **Work on one topic at a time.** Find its entry under the heading `#### <slug>` and read that entry and the entries of its prerequisites. There is no need to read them all for one topic.
- **Treat slugs as stable identifiers.** Use them for routes, directory names and cross-links. If a slug has to change, update every reference to it in this file in the same change.
- **Derive, don't duplicate.** If the site needs this metadata as data (routes, navigation, the prerequisite graph), generate it from this file with a script, so that the two cannot drift apart.
- **Keep the catalog fixed.** Add, remove, merge or rename topics only when the user asks. Topics under "Reserve" are out of scope until the user promotes one.
- **Build the model, not a picture of it.** Drive every graphic from the real equations, algorithm or data, so that it responds correctly to inputs nobody anticipated. Where a simplification is needed, state it on the page.
- **Never invent data.** Where an entry has a `Needs` field, use the real dataset or model, or a documented subset of it. If it is not available, stop and ask.
- **Question an entry that seems wrong.** If an interaction cannot be built as written, or a claim looks incorrect, say so and propose a change. Do not quietly build something else.
- **Track progress in the checklist.** Tick a topic only when it meets the definition of done.

## Entry format

Each topic is a level-4 heading containing its slug, followed by one `- **Field:** value` line per field.

| Field | Meaning |
|---|---|
| Title | Display name of the topic. |
| Level | 0, 1, 2 or 3 (see below). Sets the depth of the explanation. |
| Kind | The primary interaction pattern (see below). |
| Interaction | What the reader does and what responds. This is the core of the page. |
| Takeaway | The one idea the reader should leave with. The graphic should make it visible on its own. |
| Prerequisites | Slugs the reader should know first, or `none`. Link to them as "read first". |
| Related | Optional. Slugs worth linking where neither topic is a prerequisite of the other. Related links are mutual: each pair is listed on both entries. |
| Needs | Optional. External data, trained models or artwork the page depends on. |
| Pitfall | Optional. A common misconception or error the page must not repeat. |

### Levels

| Level | Reader |
|---|---|
| 0 | Curious beginner: primary or middle school (about ages 9 to 13), or an adult with no science background |
| 1 | High school |
| 2 | Final year of high school or first year of university |
| 3 | University student in the field |

A level-0 page starts from an object or experience the reader already knows, has no formulas
(numbers as counts and comparisons, everyday units), one control at a time and six to nine steps.
Its graphic is driven by a real, fact-checked model like any other page. Its prerequisites may only
be other level-0 topics (usually none), and its entry names the topics it leads to. The index's
"Start here" link opens `?level=0`. The full definition is in `TOPICS-PROPOSAL.md` ("Level 0").

### Kinds

Topics of the same kind should share components. Most pages mix patterns; the kind names the dominant one.

| Kind | The reader... | Typical controls |
|---|---|---|
| `manipulate` | drags or adjusts an object and sees an immediate response | draggable handles, sliders |
| `simulate` | sets parameters and runs a model through time | sliders, play/pause, reset, live plot |
| `step` | moves through a staged process | next/back, scrub bar |
| `build` | assembles parts and tests the result | palette, connect, run |
| `explore` | zooms, pans or scrubs through a space or a timeline | pan/zoom, timeline, hover details |

### Invariants

Keep these true whenever this file changes. A test that checks them is worth having.

- Every slug is unique, and the checklist lists exactly the slugs that have an entry, in the same order.
- Every slug named in a `Prerequisites` or `Related` field has an entry.
- Prerequisites contain no cycles, and no topic has a prerequisite above its own level.
- Related links are mutual and never repeat a prerequisite link.
- The topic counts in the category table match the entries.

## Definition of done

A topic is done when:

1. The interaction works as its entry describes.
2. The takeaway can be observed in the graphic itself, without reading the text.
3. The explanation is pitched at the entry's level and assumes only its prerequisites.
4. The page links to its prerequisites, its related topics and the topics that list it as a prerequisite.
5. The model behind the graphic has been checked against a reference (formulas, units, constants, limiting cases), and any pitfall in the entry is avoided.
6. It is ticked in the checklist.

## Suggested build order

1. Start with one topic of each kind, so the shared components exist early. These five have no prerequisites and need no external data: `unit-circle` (manipulate), `epidemics` (simulate), `sorting` (step), `graph-search` (build), `chaos-fractals` (explore).
2. After that, a topic is ready to build once all its prerequisites are done.

## Categories

| Category | Id | Topics |
|---|---|---|
| Mathematics | `math` | 21 |
| Physics | `physics` | 17 |
| Chemistry & Materials | `chemistry` | 15 |
| Biology | `biology` | 18 |
| Body & Medicine | `medicine` | 18 |
| Earth & Climate | `earth` | 16 |
| Space | `space` | 14 |
| Computing | `computing` | 16 |
| Information & Networks | `networks` | 17 |
| Artificial Intelligence | `ai` | 23 |
| Energy & Machines | `energy` | 19 |

## Checklist

**Mathematics**
- [x] unit-circle
- [x] calculus
- [x] linear-transformations
- [x] tensors
- [x] complex-numbers
- [x] fourier-transform
- [x] bayes-theorem
- [x] central-limit-theorem
- [x] primes-modular-arithmetic
- [x] chaos-fractals
- [x] taylor-series
- [x] exponentials-logarithms
- [x] game-theory-cooperation
- [x] differential-equations
- [x] calculus-of-variations
- [x] random-graphs
- [x] phase-portraits
- [x] resampling-inference
- [x] cellular-automata
- [x] why-triangles-are-stiff
- [x] monty-hall

**Physics**
- [x] newtons-laws
- [x] oscillations-resonance
- [x] waves-interference
- [x] electric-circuits
- [x] electromagnetism
- [x] light-optics
- [x] entropy
- [x] special-relativity
- [x] quantum-mechanics
- [x] standard-model
- [x] musical-scales-ratios
- [x] lasers
- [x] ising-model
- [x] shadows-and-pinholes
- [x] floating-sinking-and-boats
- [x] magnets-and-poles
- [x] blue-sky-red-sunset

**Chemistry & Materials**
- [x] atoms-periodic-table
- [x] radioactivity
- [x] chemical-bonds
- [x] states-of-matter
- [x] reaction-rates-equilibrium
- [x] acids-bases
- [x] redox-batteries
- [x] carbon-polymers
- [x] semiconductors
- [x] chromatography
- [x] dislocations-alloys
- [x] huckel-molecular-orbitals
- [x] surface-catalysis
- [x] transition-state-theory
- [x] salt-and-ice

**Biology**
- [x] the-cell
- [x] dna-to-protein
- [x] protein-folding
- [x] photosynthesis
- [x] respiration-atp
- [x] meiosis-inheritance
- [x] evolution
- [x] ecosystems
- [x] crispr
- [x] bacterial-chemotaxis
- [x] diffusion-osmosis
- [x] pcr-copying-dna
- [x] morphogen-gradients
- [x] lac-operon
- [x] population-genetics
- [x] turing-patterns
- [x] fireflies-in-sync
- [x] ant-trails

**Body & Medicine**
- [x] heart-circulation
- [x] homeostasis
- [x] neurons
- [x] vision-color
- [x] immune-system
- [x] epidemics
- [x] mrna-vaccines
- [x] cancer
- [x] medical-imaging
- [x] cerebellum-motor-learning
- [x] pharmacokinetics-dosing
- [x] cochlea-hearing
- [x] mri-k-space
- [x] ecg-arrhythmias
- [x] hearing-and-the-ear
- [ ] muscles-pull-in-pairs
- [ ] why-spinning-makes-you-dizzy
- [ ] why-you-get-sleepy

**Earth & Climate**
- [x] plate-tectonics
- [x] earthquakes
- [x] deep-time
- [x] atmosphere-weather
- [x] ocean-currents
- [x] ice-ages
- [x] carbon-cycle
- [x] greenhouse-effect
- [x] ensemble-weather-forecasting
- [x] ocean-acidification
- [x] tsunamis
- [x] carbonate-silicate-thermostat
- [x] radiative-convective-column
- [x] cloud-base
- [x] forest-fire-spread
- [x] sea-breeze

**Space**
- [x] sun-earth-moon
- [x] orbits-kepler
- [x] rockets
- [x] stars
- [x] black-holes
- [x] gravitational-waves
- [x] dark-matter
- [x] big-bang
- [x] exoplanets
- [x] lagrange-points-three-body
- [x] aperture-synthesis
- [ ] comet-tails
- [ ] earth-is-a-ball
- [x] leap-years

**Computing**
- [x] binary
- [x] logic-gates
- [x] transistors-chipmaking
- [x] cpu
- [x] gpu
- [x] graphics-3d
- [x] sorting
- [x] graph-search
- [x] turing-machines
- [x] quantum-computing
- [x] game-tree-search
- [x] cache-memory-hierarchy
- [x] hash-tables-bloom-filters
- [x] life-on-a-grid
- [x] secret-codes
- [x] twenty-questions

**Information & Networks**
- [x] compression
- [x] error-correction
- [x] cryptography
- [x] wireless-signals
- [x] internet
- [x] gps
- [x] pagerank
- [x] consensus-blockchains
- [x] tcp-congestion-control
- [x] shazam-audio-fingerprint
- [x] distributed-hash-tables
- [x] elliptic-curve-cryptography
- [x] kalman-filter
- [x] radar-sonar
- [x] barcode-stripes
- [x] qr-codes
- [ ] wifi-and-walls

**Artificial Intelligence**
- [x] learning-from-data
- [x] gradient-descent
- [x] neural-networks
- [x] convolution-vision
- [x] embeddings
- [x] transformers
- [x] language-models
- [x] diffusion-models
- [x] reinforcement-learning
- [x] ngram-text-models
- [x] tokenization
- [x] positional-encoding
- [x] residual-stream-logit-lens
- [x] training-a-tiny-language-model
- [x] scaling-laws
- [x] rlhf-alignment
- [x] kv-cache-inference
- [x] speculative-decoding
- [x] chain-of-thought-scratchpad
- [x] k-means-clustering
- [x] next-word-guessing-game
- [x] spam-filter-word-counts
- [ ] teach-a-machine

**Energy & Machines**
- [x] heat-engines
- [x] motors-generators
- [x] power-grid
- [x] solar-cells
- [x] nuclear-fission
- [x] nuclear-fusion
- [x] flight
- [x] bridges-structures
- [x] feedback-control
- [x] wind-turbine-aerodynamics
- [x] abs-brakes
- [x] bicycle-stability
- [x] gas-turbines-combined-cycle
- [x] heat-pumps-refrigeration
- [ ] clock-escapement
- [ ] drone-four-rotors
- [ ] hydraulics-digger-arm
- [ ] light-bulb-hot-wire
- [ ] toilet-flush

## Topics

### Mathematics

#### unit-circle
- **Title:** Trigonometry & the unit circle
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Drag a point around a unit circle. Its height and horizontal position are plotted against the angle on a linked graph, tracing the sine and cosine curves; the angle is shown in degrees and radians.
- **Takeaway:** Sine and cosine are the coordinates of a point moving around a circle, which is why they repeat as waves.
- **Prerequisites:** none

#### calculus
- **Title:** Calculus
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Slide a point along an editable curve to see the tangent line, with its slope plotted as a second curve. Set the number of rectangles under the curve and watch their total converge; plot the running area and show that its slope is the original curve.
- **Takeaway:** A derivative is a slope at a point, an integral is an accumulated area, and each undoes the other.
- **Prerequisites:** none
- **Related:** newtons-laws

#### linear-transformations
- **Title:** Vectors, matrices & linear transformations
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Drag the two basis vectors of a 2D grid; the grid, a sample shape and the 2×2 matrix update together. Toggles show the eigenvectors (directions that only stretch) and the determinant as the factor by which areas scale.
- **Takeaway:** A matrix is a transformation of space, fully determined by where it sends the basis vectors.
- **Prerequisites:** none
- **Related:** pagerank

#### tensors
- **Title:** Tensors
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Grow a single number into a vector, a matrix and a 3D block, then load a color image as a height × width × channel block. Slice along any axis, reshape, and multiply a matrix by a vector with the matching axes highlighted.
- **Takeaway:** Scalars, vectors and matrices are tensors with zero, one and two axes, and most tensor operations are choices about which axes to keep and which to combine.
- **Prerequisites:** linear-transformations
- **Related:** gpu, neural-networks, embeddings
- **Pitfall:** Build the page on the array view used in computing, but say that in physics a tensor also carries a rule for how its components change with the coordinate system.

#### complex-numbers
- **Title:** Complex numbers & Euler's formula
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Drag two points on the complex plane and see their product: the angles add and the lengths multiply. A slider for θ moves e^(iθ) around the unit circle, with its real and imaginary parts shown as cosine and sine.
- **Takeaway:** Multiplying by a complex number rotates and scales, and e^(iθ) is the point at angle θ on the unit circle.
- **Prerequisites:** unit-circle
- **Related:** chaos-fractals

#### fourier-transform
- **Title:** Fourier transform
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Draw a closed curve or a waveform, then rebuild it from rotating circles or sine waves, adding one frequency at a time with a slider. A bar chart shows the strength of each frequency and can be edited to reshape the signal.
- **Takeaway:** Any signal can be written as a sum of sine waves, and the transform says how much of each frequency it contains.
- **Prerequisites:** unit-circle, complex-numbers
- **Related:** positional-encoding, taylor-series, musical-scales-ratios

#### bayes-theorem
- **Title:** Probability & Bayes' theorem
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Sliders set how common a disease is and how often the test is right for sick and for healthy people. A grid of 1,000 people is colored into true and false positives and negatives, and the chance that a positive result is real is read off by counting.
- **Takeaway:** What a piece of evidence means depends on the base rate: a positive result from an accurate test for a rare condition can still be more likely false than true.
- **Prerequisites:** none
- **Related:** central-limit-theorem, learning-from-data, ensemble-weather-forecasting, monty-hall

#### central-limit-theorem
- **Title:** Distributions & the central limit theorem
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Drop balls through a Galton board and watch the bins fill. Then draw any starting distribution, choose a sample size, and build up the histogram of sample means one sample at a time.
- **Takeaway:** Averages of many independent random values pile up in a bell curve, almost regardless of the distribution they came from.
- **Prerequisites:** none
- **Related:** bayes-theorem, radioactivity

#### primes-modular-arithmetic
- **Title:** Prime numbers & modular arithmetic
- **Level:** 1
- **Kind:** step
- **Interaction:** Step through the sieve of Eratosthenes on a number grid. Then add, multiply and raise to powers on a clock face with an adjustable number of hours, and compare prime and non-prime moduli.
- **Takeaway:** Primes are what remains when every multiple is struck out, and in clock arithmetic on a prime modulus, powers are easy to compute and hard to reverse, which public-key cryptography relies on.
- **Prerequisites:** none

#### chaos-fractals
- **Title:** Chaos & fractals
- **Level:** 2
- **Kind:** explore
- **Interaction:** Start two double pendulums with almost identical angles and watch their paths separate. Slide the growth rate of the logistic map through its period-doubling cascade, and zoom deep into the Mandelbrot set.
- **Takeaway:** Simple deterministic rules can produce behavior that is unpredictable in the long run and structure that repeats at every scale.
- **Prerequisites:** none
- **Related:** complex-numbers, ecosystems, atmosphere-weather, phase-portraits, turing-patterns, lagrange-points-three-body, cellular-automata

#### taylor-series
- **Title:** Taylor series & where they stop working
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Pick a function and add Taylor terms one at a time with a slider: the polynomial hugs e^x and sin x ever further from the center, but for 1/(1 + x²) it closes in only for |x| < 1 and swings ever wilder beyond, however many terms are added. A linked complex plane shows the disk of convergence and the function's singularities at ±i: the disk stops exactly where it touches the nearest one; drag the center along the real line and the disk, and the stretch of the real line the polynomials fit, resize to match. A last toggle overlays Chebyshev interpolation, which fits the whole interval anyway.
- **Takeaway:** The Taylor series of a function converges exactly out to its nearest singularity in the complex plane, even when nothing goes wrong on the real line.
- **Prerequisites:** calculus, complex-numbers
- **Related:** fourier-transform
- **Pitfall:** More terms do not always mean a better fit: outside the radius the partial sums do not converge (individual added terms can improve or worsen the approximation; for 1/(1 + x²) about 0, each additional nonzero term increases the error when |x| > 1), and a function can be smooth everywhere on the real line and still have a finite radius. Do not claim convergence on the boundary circle: for 1/(1 + x²) the series diverges at x = ±1.

#### exponentials-logarithms
- **Title:** Exponentials & logarithms
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Fold a strip of paper, breed bacteria or compound interest: a slider sets the growth factor, a counter of doublings runs and the curve shoots off the chart; switch the vertical axis to a log scale and the curve becomes a straight line whose slope is the logarithm of the growth factor per step. Compare 'add the same amount each step' with 'multiply by the same factor each step' on one chart, read a logarithm as the number of doublings needed, and build a slide rule that multiplies by adding lengths.
- **Takeaway:** Growing by a fixed factor each step outruns growing by a fixed amount, and a logarithm just counts how many of those steps it took.
- **Prerequisites:** none
- **Related:** radioactivity, epidemics, acids-bases, earthquakes, sorting
- **Pitfall:** Exponential does not mean fast: with a factor just above 1 it starts slowly. And a log-scale line that looks tame is not growth slowing down; say that the rate stays the same.

#### game-theory-cooperation
- **Title:** Game theory: why cooperate?
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Play the prisoner's dilemma against the page with a payoff table whose four numbers can be edited, and find that cheating pays once but not when the same two players meet again. Enter strategies (always cheat, always cooperate, tit for tat, grudger, random) into a round-robin tournament of repeated games and watch the scores; let the population evolve, with well-scoring strategies copied more often, and add a little noise to the signals to see which strategies survive it. Finish on a grid where each cell plays its neighbours, so that clusters of cooperators grow or are eaten.
- **Takeaway:** When the same players meet again and again, strategies that start nice, hit back and forgive can outscore pure selfishness, so cooperation can take hold among players who each look after only themselves, unless the games are too short or too few others cooperate.
- **Prerequisites:** none
- **Related:** evolution, ecosystems, reinforcement-learning
- **Pitfall:** Tit for tat never beat an opponent in a single game; it won the tournaments by scoring well with everyone. There is no best strategy independent of the population it plays in, and the result changes with the payoff numbers and with noise.

#### differential-equations
- **Title:** Differential equations
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Choose a rule for the slope at every point (growth in proportion to the amount, cooling toward room temperature, logistic growth with a ceiling, a fish stock under steady harvesting) and the plane of time against amount fills with small slope arrows; click anywhere to drop a starting value and watch a solution curve thread through the arrows. Drop several starts and see that curves never cross, that some settle on a level line and others run away from it, and raise the harvest until the level line vanishes and every curve crashes; where an exact formula exists, overlay it on the traced curve.
- **Takeaway:** A differential equation says how fast something changes given where it is, and that rule plus a starting point fixes one curve through the field of arrows, which can be followed even when no formula exists.
- **Prerequisites:** calculus
- **Related:** epidemics, ecosystems, feedback-control
- **Pitfall:** Not every differential equation can be solved with a formula: most cannot, and the slope field still fixes each solution. For a smooth enough rule (the usual case), solution curves of one equation never cross, so two different futures cannot start from the same state.

#### calculus-of-variations
- **Title:** The brachistochrone & calculus of variations
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the control points of a ramp between two fixed points and a bead slides down it under gravity, its descent time computed by integrating along the curve; race the straight line, a circular arc and your curve. Press optimize and the curve relaxes step by step toward the cycloid as the page descends the gradient of the time functional, while a panel shows the Euler–Lagrange residual along the curve going to zero; a second example finds the hanging-chain shape.
- **Takeaway:** The fastest slide between two points is a curve, the cycloid, not the straight line, and at the optimum the Euler–Lagrange residual is zero all along the curve, so no small change to its shape makes the slide faster.
- **Prerequisites:** calculus, newtons-laws
- **Related:** light-optics, gradient-descent, orbits-kepler
- **Pitfall:** The best curve can dip below the end point and still win (it does whenever the horizontal distance is more than about π/2 times the drop), and the straight line is not 'almost as good': show it losing to the cycloid by a measured margin. A curve that satisfies the Euler–Lagrange equation is stationary, not automatically the minimum.

#### random-graphs
- **Title:** Random graphs & the giant component
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Slide the average degree of a random graph and watch components merge, coloured by size: the largest component's share of the nodes stays near zero until the average degree passes 1, then climbs, plotted live against degree. Raise the number of nodes from 50 to a few thousand and rerun the sweep: the curve's knee at degree 1 sharpens toward a corner. A second view opens bonds on a square grid at random and shows a spanning cluster appearing at its own threshold, near half the bonds open.
- **Takeaway:** In a large random network, adding links does not connect it gradually: a giant connected piece appears abruptly once each node has about one link on average, and the bigger the network, the sharper that switch.
- **Prerequisites:** graph-search, central-limit-theorem
- **Related:** epidemics, internet, pagerank, states-of-matter
- **Pitfall:** The sharp threshold is a large-graph limit; with a few hundred nodes the curve is rounded. Show the knee sharpening as n grows instead of drawing a step.

#### phase-portraits
- **Title:** Phase portraits & stability
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the four entries of a 2×2 linear system, or move its two eigenvalues on the complex plane, and the phase plane redraws as a node, saddle, spiral or center while a trace–determinant chart marks where you are. Switch to a nonlinear system (damped pendulum, predator–prey, van der Pol) and hover a critical point to see its linearization laid over the real flow; drag a parameter through a Hopf bifurcation and watch a limit cycle be born.
- **Takeaway:** Near a fixed point whose eigenvalues have nonzero real parts, the real flow looks like its linearization, so a few fixed points and their eigenvalues sketch the whole portrait; when the eigenvalues reach the imaginary axis, as at a Hopf bifurcation, the nonlinear terms take over and a limit cycle can appear that no fixed point predicts.
- **Prerequisites:** linear-transformations, calculus, differential-equations
- **Related:** oscillations-resonance, ecosystems, feedback-control, chaos-fractals
- **Pitfall:** A center predicted by the linearization is not conclusive: the nonlinear terms decide (Hartman–Grobman covers only hyperbolic points). Show the frictionless pendulum beside the damped one rather than claiming linearization settles every case.

#### resampling-inference
- **Title:** The bootstrap & permutation tests
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Compare flipper length between two species of real penguins: shuffle the group labels thousands of times to build the histogram of differences that chance alone produces, and read the p-value as where the observed difference falls in it. Resample each group with replacement to build a bootstrap distribution and a confidence interval for the difference and for a regression slope. Then switch to a known simulated population, repeat the whole procedure hundreds of times, and count how often the interval catches the true value: drag the sample size down, skew the population or ask for the maximum instead of the mean, and watch the coverage fall below 95%.
- **Takeaway:** Resampling rebuilds the chance distribution from the data itself, and it works only as well as the sample stands in for the population: with small or skewed samples the intervals miss the truth more often than they claim.
- **Prerequisites:** central-limit-theorem, bayes-theorem, learning-from-data
- **Needs:** The Palmer penguins dataset (344 penguins, bill and flipper measurements by species; palmerpenguins, CC0).
- **Pitfall:** A p-value is not the probability that the null hypothesis is true, and a bootstrap interval is not guaranteed to have its stated coverage: the bootstrap does not cure a small sample. The coverage counter must show the shortfall, not a reassuring 95%.

#### cellular-automata
- **Title:** Cellular automata
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set the eight bits of a one-dimensional rule by clicking its lookup table, and run it from a single live cell or a random row, each generation drawn as a new line below the last. Rule 90 draws a Sierpinski triangle, rule 30 looks random, rule 110 carries colliding structures, and rule 184 moves cars along a road that jams once more than half the cells are full. Step through all 256 rules, sorted by what each does to the same random ring (dies out, repeats, keeps changing) and set against Wolfram's four classes (die out, repeat, look random, build structures), with a count of live cells over time to compare rules.
- **Takeaway:** A rule that only looks at a cell and its two neighbours, applied everywhere at once, can die out, repeat, look random or build moving structures, and changing one bit of the rule can switch between them.
- **Prerequisites:** life-on-a-grid
- **Related:** chaos-fractals, turing-machines, logic-gates
- **Pitfall:** Rule 30 looks random but is completely determined: the same starting row always gives the same pattern. And most rules do not make complexity; they die out or repeat, and only a few, like rule 110, build lasting structures.

#### why-triangles-are-stiff
- **Title:** Why triangles are stiff
- **Level:** 0
- **Kind:** build
- **Interaction:** Snap sticks together at their ends with pins to make a square, then push on a corner: it leans over into a diamond. Make a triangle and push: nothing moves. Add one diagonal stick to the square and push again; then build a tall tower and a garden gate and find the fewest sticks that stop them wobbling.
- **Takeaway:** A triangle is the one shape whose sides fix its corners, so a floppy frame goes stiff the moment a diagonal cuts it into triangles.
- **Prerequisites:** none
- **Pitfall:** Stiff is not strong: the page is about shapes holding their angles, not about how much load a stick can carry; do not colour sticks by force or claim triangles 'spread the load'.

#### monty-hall
- **Title:** The three doors
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Pick one of three doors; the host, who knows where the prize is, opens another to show a goat, and you stay or switch. Play by hand, then let the page play a hundred games with 'always stay' and a hundred with 'always switch', the wins piling into two columns at about two to one. Flip the board to see the three places the prize could be and which choice wins in each, then try ten doors where the host opens eight.
- **Takeaway:** Switching wins twice as often as staying, because the first pick is right only one time in three and the host's open door points to the prize the rest of the time.
- **Prerequisites:** none
- **Related:** bayes-theorem
- **Pitfall:** The host must know where the prize is and always open a goat door; if the host opens a door at random and happens to show a goat, the two remaining doors really are equal, and the page should show that case too.

### Physics

#### newtons-laws
- **Title:** Newton's laws, motion & energy
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Launch a projectile with adjustable speed, angle and air resistance; push and collide carts of different mass; send a cart along an editable track while bars show kinetic, potential and dissipated energy.
- **Takeaway:** Forces change motion rather than sustain it, and energy and momentum are conserved as they change form or pass between objects.
- **Prerequisites:** none
- **Related:** calculus, why-spinning-makes-you-dizzy

#### oscillations-resonance
- **Title:** Oscillations & resonance
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set the mass, stiffness and damping of a spring, or the length of a pendulum, and watch it oscillate. Add a periodic push with adjustable frequency and plot the resulting amplitude against that frequency.
- **Takeaway:** Every oscillator has a natural frequency, and pushing it at that frequency makes the motion build up.
- **Prerequisites:** newtons-laws
- **Related:** phase-portraits, why-spinning-makes-you-dizzy

#### waves-interference
- **Title:** Waves, sound & interference
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Place two sources in a ripple tank and adjust wavelength and spacing to move the bands of reinforcement and cancellation. Pluck a string to find its standing-wave harmonics and hear them; move a source to see and hear the Doppler shift.
- **Takeaway:** Waves pass through each other and add, so they can reinforce or cancel, and a confined wave can only vibrate at certain frequencies.
- **Prerequisites:** oscillations-resonance, unit-circle
- **Related:** exoplanets

#### electric-circuits
- **Title:** Electric circuits
- **Level:** 1
- **Kind:** build
- **Interaction:** Wire batteries, bulbs, resistors and switches on a board, in series and in parallel. Meters and animated charge show the current through, and the voltage across, every component.
- **Takeaway:** Current is the same all the way around a single loop, voltage is shared out among the components, and resistance sets how much current a voltage drives.
- **Prerequisites:** none
- **Pitfall:** Current is not used up by a bulb; what the bulb takes is energy. Charges drift slowly even though the lamp lights at once.

#### electromagnetism
- **Title:** Electromagnetism
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Place positive and negative charges and see the field lines and the force on a test charge. Move a magnet through a coil, or change the current in a neighboring coil, and watch a current be induced.
- **Takeaway:** Charges create electric fields, moving charges create magnetic fields, and a changing magnetic field creates an electric one; light is the two fields sustaining each other as a wave.
- **Prerequisites:** electric-circuits
- **Related:** light-optics, wireless-signals, magnets-and-poles

#### light-optics
- **Title:** Light & optics
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Drag light sources, mirrors, lenses and prisms on an optical bench and trace the rays. Change the refractive index and the color of the light to see bending, focusing, total internal reflection and dispersion into a spectrum.
- **Takeaway:** Light changes direction when its speed changes between materials, and that one rule accounts for lenses, rainbows and optical fiber.
- **Prerequisites:** waves-interference
- **Related:** electromagnetism, calculus-of-variations, blue-sky-red-sunset

#### entropy
- **Title:** Heat, entropy & the arrow of time
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Fill the two halves of a box with fast and slow particles and remove the wall. Watch the temperatures equalize, count the arrangements consistent with each state, and try to run the film backward.
- **Takeaway:** Heat flows and things mix because mixed states vastly outnumber ordered ones, and that imbalance is what gives time its direction.
- **Prerequisites:** newtons-laws
- **Related:** states-of-matter, compression, diffusion-osmosis
- **Pitfall:** "Disorder" is only a metaphor; define entropy by counting microstates.

#### special-relativity
- **Title:** Special relativity
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** A slider takes a train carrying a light clock from rest toward the speed of light. Compare the clock's ticking, the train's length and the timing of two lightning strikes as seen from the train and from the platform, with a linked spacetime diagram.
- **Takeaway:** Because every observer measures the same speed of light, observers in relative motion disagree about durations, lengths and whether two events happened at the same time.
- **Prerequisites:** newtons-laws

#### quantum-mechanics
- **Title:** Quantum mechanics
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Fire particles one at a time at a double slit and watch single dots build up an interference pattern; switch on a which-slit detector and the pattern disappears. Send a wave packet at a barrier and vary its height and width to see part of the packet tunnel through.
- **Takeaway:** A quantum object is described by a wave of probability amplitudes that interferes with itself, and a measurement gives one random outcome weighted by that wave.
- **Prerequisites:** waves-interference, complex-numbers
- **Related:** standard-model, atoms-periodic-table, semiconductors
- **Pitfall:** The pattern vanishes because the detector records which slit was used, not because a person is watching.

#### standard-model
- **Title:** Particle physics & the Standard Model
- **Level:** 2
- **Kind:** build
- **Interaction:** Combine quarks to build protons, neutrons and other particles, with the charge and color rules enforced. Pick a process such as beta decay and step through it as an exchange of force carriers; browse the table of 17 particles.
- **Takeaway:** All ordinary matter is made of a few kinds of particle, and three of the four known forces arise from exchanging other particles.
- **Prerequisites:** atoms-periodic-table
- **Related:** quantum-mechanics, radioactivity

#### musical-scales-ratios
- **Title:** Why music has twelve notes
- **Level:** 1
- **Kind:** explore
- **Interaction:** A keyboard whose keys play, each note drawn as its wave; press two keys and the page plays them together and draws how the waves line up: an octave (double the frequency) repeats every cycle, a fifth (3:2) every two, while clashing pairs beat and a roughness meter (the Plomp-Levelt curve) rises. Slide a divider to cut the octave into 5, 7, 12, 19, 31 or 53 equal steps and read off how many cents each ladder misses the pure fifth and major third by; twelve is the first small ladder whose fifth lands within 2 cents. Compare an equal-tempered chord with a pure one by ear.
- **Takeaway:** Notes sound smooth together when their frequencies are in simple ratios, and twelve equal steps per octave is the smallest small ladder whose fifth lands almost exactly on the pure 3:2.
- **Prerequisites:** waves-interference
- **Related:** fourier-transform, shazam-audio-fingerprint
- **Pitfall:** Twelve is a good compromise, not a law of nature or of the ear: other traditions divide the octave differently, and equal temperament makes every fifth slightly flat. Consonance also depends on timbre; the roughness model (Plomp-Levelt 1965) is one measurable part of it.

#### lasers
- **Title:** Lasers
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Pump a four-level gain medium between two mirrors and watch the populations and the photon number evolve under the rate equations: below threshold the cavity holds a few spontaneous photons, and at threshold the inversion clamps while the output climbs linearly with pump power. Lower the mirror reflectivity, switch to a three-level or a two-level medium, or open and close a shutter to see relaxation oscillations and a Q-switched pulse.
- **Takeaway:** A laser is a cavity in which stimulated emission out-competes loss, and above that threshold the inversion stops growing and nearly every extra pumped atom adds a photon to the same mode.
- **Prerequisites:** quantum-mechanics, oscillations-resonance
- **Related:** semiconductors, solar-cells
- **Pitfall:** Population inversion is impossible by pumping a two-level system at any power; the page must show the two-level case saturating at equal populations.

#### ising-model
- **Title:** The Ising model & phase transitions
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a square lattice of spins with the Metropolis algorithm (or the Wolff cluster update, which stays fast near the critical point) and slide the temperature through Tc: domains grow out of noise, the magnetization rises steeply but continuously from zero as the lattice cools below Tc, and the susceptibility and heat capacity spike. Below Tc, apply a field and sweep it back and forth to trace a hysteresis loop; grow the lattice to see the peaks sharpen, and shrink it to a one-dimensional chain to see the transition vanish.
- **Takeaway:** In two dimensions, nearest-neighbour alignment alone produces a phase transition at a definite temperature, sharp only in the limit of a large system, while a one-dimensional chain never orders.
- **Prerequisites:** entropy
- **Related:** states-of-matter, neural-networks
- **Pitfall:** A one-dimensional chain has no phase transition at any temperature above zero; show that case so the reader does not believe order is automatic.

#### shadows-and-pinholes
- **Title:** Shadows & pinholes
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a lamp, a toy and a wall about a room: straight rays from the lamp are blocked by the toy, and the shadow on the wall grows as the lamp comes closer and shrinks as the wall comes closer. Swap the small bulb for a wide lampshade and the shadow's edge goes soft; switch on a second lamp and a second shadow appears. Poke a pinhole in a shoebox and the picture of the lamp forms upside down on its back wall.
- **Takeaway:** Light travels in straight lines, so a shadow is simply where the lines are blocked, and its size follows the lines back to the lamp.
- **Prerequisites:** none
- **Related:** sun-earth-moon
- **Pitfall:** A shadow is not something a lamp throws onto a wall; it is where no light arrives. And the Moon's phases are not Earth's shadow (the page should point to sun-earth-moon for eclipses, which are).

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

#### magnets-and-poles
- **Title:** Magnets & poles
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag two bar magnets about on a board: arrows show the pull or push between them, computed from their poles, and a compass needle and a sprinkle of iron filings line up along the field. Flip one magnet end for end and the pull turns into a push. Lower a magnet towards a heap of steel paper clips: one jumps up to it, becomes a magnet of its own and holds a chain of clips, then cut a magnet in half and find that each half still has two ends.
- **Takeaway:** A magnet always has two ends; like ends push apart and unlike ends pull together, and the pull fades quickly with distance.
- **Prerequisites:** none
- **Related:** electromagnetism
- **Pitfall:** A magnet does not attract all metals, nor even all steel: it pulls iron, nickel, cobalt and most steels, but not aluminium, copper, gold or many stainless-steel spoons and sinks. And cutting a magnet never separates its poles: each piece has two.

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

### Chemistry & Materials

#### atoms-periodic-table
- **Title:** Atoms, orbitals & the periodic table
- **Level:** 1
- **Kind:** build
- **Interaction:** Build an atom by adding protons, neutrons and electrons; electrons fill orbitals in order and the element lights up in the periodic table. Recolor the table by atomic radius, ionization energy or electronegativity, and view orbital shapes in 3D.
- **Takeaway:** The layout of the periodic table follows from how electrons fill shells, and an element's chemistry is set by its outermost electrons.
- **Prerequisites:** none
- **Related:** quantum-mechanics
- **Needs:** Element data (electron configurations, atomic radius, ionization energy, electronegativity).
- **Pitfall:** Electrons do not circle the nucleus like planets; an orbital is a region where the electron is likely to be found.

#### radioactivity
- **Title:** Radioactivity & half-life
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Watch a grid of 1,000 unstable nuclei decay at random while a plot of the survivors follows an exponential curve. Change the half-life, switch between alpha, beta and gamma decay, and date a sample from its remaining carbon-14.
- **Takeaway:** Nobody can say when a given nucleus will decay, yet a large number of them halve on a precise schedule.
- **Prerequisites:** atoms-periodic-table
- **Related:** central-limit-theorem, standard-model, exponentials-logarithms
- **Pitfall:** After two half-lives a quarter of the nuclei remain, not none.

#### chemical-bonds
- **Title:** Chemical bonds & molecular shapes
- **Level:** 1
- **Kind:** build
- **Interaction:** Snap atoms together to form molecules; shared and lone electron pairs repel each other and set the 3D shape, which can be rotated. Toggle a charge map to see which molecules are polar.
- **Takeaway:** Atoms bond by sharing or transferring outer electrons, and repulsion between electron pairs gives each molecule the shape that decides its properties.
- **Prerequisites:** atoms-periodic-table

#### states-of-matter
- **Title:** States of matter & phase changes
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Control the temperature and pressure of a box of simulated molecules and watch it freeze, melt, boil and condense, with the current state tracked on a phase diagram. Switch the substance to water to see the open lattice of ice.
- **Takeaway:** Solid, liquid and gas are the same molecules balancing attraction against thermal motion, and water is unusual because its solid is less dense than its liquid.
- **Prerequisites:** chemical-bonds
- **Related:** entropy, random-graphs, ising-model, floating-sinking-and-boats

#### reaction-rates-equilibrium
- **Title:** Reaction rates, catalysts & equilibrium
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Run a reversible reaction as colliding particles beside an energy-profile diagram. Raise the temperature, add a catalyst that lowers the barrier, or add and remove a reactant, and watch the rates and the final mixture respond.
- **Takeaway:** Reactions happen when collisions carry enough energy to cross a barrier, and equilibrium is the point where the forward and reverse reactions run at the same rate.
- **Prerequisites:** chemical-bonds
- **Related:** acids-bases
- **Pitfall:** A catalyst speeds up both directions equally and does not move the equilibrium.

#### acids-bases
- **Title:** Acids, bases & pH
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Add a strong base to an acid drop by drop while a pH curve is plotted and an indicator changes color; compare strong and weak acids. A zoomed view counts the hydrogen ions, and a scale places everyday liquids from pH 0 to 14.
- **Takeaway:** pH counts hydrogen ions on a logarithmic scale, so each step is a tenfold change, and in a titration it jumps abruptly at the point where the base added exactly matches the acid.
- **Prerequisites:** chemical-bonds
- **Related:** reaction-rates-equilibrium, exponentials-logarithms
- **Pitfall:** That matching point is at pH 7 only for a strong acid with a strong base; for a weak acid it lies above 7.

#### redox-batteries
- **Title:** Redox & batteries
- **Level:** 2
- **Kind:** step
- **Interaction:** Charge and discharge a lithium-ion cell shown in cross-section: lithium ions cross the electrolyte while electrons take the external wire through a load. Swap electrode materials to change the voltage and capacity.
- **Takeaway:** A battery splits a reaction into two halves so that the electrons must travel through a circuit to complete it.
- **Prerequisites:** chemical-bonds, electric-circuits
- **Related:** respiration-atp, power-grid

#### carbon-polymers
- **Title:** Carbon chemistry & polymers
- **Level:** 2
- **Kind:** build
- **Interaction:** Build carbon chains, rings and functional groups and watch the molecule's name and properties update. Rotate two mirror-image molecules to see that they cannot be superimposed, and link monomers into a polymer whose stiffness depends on chain length and cross-links.
- **Takeaway:** Carbon's four bonds allow endless chains and rings, so the same few elements arranged differently give fuels, plastics, drugs and the molecules of life.
- **Prerequisites:** chemical-bonds
- **Related:** protein-folding, huckel-molecular-orbitals

#### semiconductors
- **Title:** Crystals & semiconductors
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** View metal, insulator and semiconductor lattices beside their energy bands. Add dopant atoms to silicon to create free electrons or holes, join an n-type and a p-type region, and apply a voltage across the junction in each direction.
- **Takeaway:** A semiconductor's conductivity can be set by its impurities and changed by a voltage, which makes it a material that can be switched.
- **Prerequisites:** chemical-bonds, electric-circuits
- **Related:** quantum-mechanics, lasers, huckel-molecular-orbitals

#### chromatography
- **Title:** Chromatography: separating by stickiness
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Inject a mixture at the top of a column and watch each molecule hop at random between the moving phase and the stationary phase. The time each one spends stuck is set by its partition coefficient, so the bands separate and broaden, and a detector at the end draws the chromatogram. Slide the flow rate and the measured plate height traces the van Deemter curve: diffusion along the column dominates at slow flow, slow exchange at fast flow, and the uneven paths through the packing add a floor that the flow does not change. Lengthen the column or use finer packing to see the resolution improve.
- **Takeaway:** A column separates molecules by how much of the time each spends stuck rather than moving, and there is a best flow speed: slower and diffusion blurs the bands, faster and the molecules cannot keep up with the exchange.
- **Prerequisites:** central-limit-theorem, reaction-rates-equilibrium
- **Pitfall:** Most chromatography is not a sieve by size: two molecules of the same size separate because they stick differently. The bands are close to Gaussian only because each molecule makes many random hops that add up; with few exchanges or uneven sticky sites, real peaks tail.

#### dislocations-alloys
- **Title:** Dislocations: why metals bend and alloys resist
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Shear a two-dimensional crystal of simulated atoms that contains an edge dislocation, and watch the defect glide one row of bonds at a time while a gauge shows the stress it took. Remove the dislocation, and the perfect crystal holds to a far higher stress before a whole plane slips at once. Sprinkle in larger or smaller foreign atoms and the dislocation snags on them, so the gauge must climb higher before it moves. Add a second and third dislocation and drive them against a row of obstacles, where they pile up and resist further slip.
- **Takeaway:** A crystal with a dislocation yields at a small fraction of the stress a perfect crystal needs, because the defect breaks one row of bonds at a time, and foreign atoms raise that stress by pinning it.
- **Prerequisites:** semiconductors, states-of-matter
- **Related:** bridges-structures
- **Pitfall:** Crystals do not deform by whole planes sliding at once; the theoretical strength computed that way is often a thousand times higher than what ordinary, soft metal crystals show (only tiny, nearly defect-free crystals come close to it).

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

#### surface-catalysis
- **Title:** Catalysis on a surface
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run CO oxidation on a lattice of catalyst sites: CO lands on one empty site, O2 splits onto two neighbouring empty sites, and adjacent CO and O react into CO2 and leave (the Ziff-Gulari-Barshad model). Slide the CO fraction in the gas: with too little CO the surface fills with oxygen and goes dead, across a narrow window the CO2 rate climbs, and just past its peak it collapses abruptly as CO covers every site, with the lattice's rate and coverages plotted beside the mean-field rate equations of the same moves (the reactants taken as randomly mixed), which miss the oxygen dead end entirely and put the CO collapse too late. Add a CO desorption rate (a hotter surface) and watch the abrupt collapse soften and the poisoned surface recover.
- **Takeaway:** A catalyst works by holding the reactants next to each other on its surface, and too much of one reactant can cover every site and stop the reaction entirely.
- **Prerequisites:** reaction-rates-equilibrium
- **Related:** transition-state-theory
- **Pitfall:** A catalyst is not consumed, but it is not inert either: its activity depends on what covers it, and a poisoned surface is a catalyst that has stopped working.

#### transition-state-theory
- **Title:** Reaction trajectories & the transition state
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Fire a quasiclassical trajectory of A + BC → AB + C across a potential-energy surface (LEPS model of H + H2 and F + H2) drawn as a contour map, choosing how much energy goes into translation and how much into vibration (never less than the zero-point vibration), and see whether it crosses the saddle or turns back. Compare the early barrier of F + H2 with the late barrier of its reverse, H + HF, to see that translation carries molecules over an early pass and vibration over a late one; sweep the temperature to watch the Eyring rate climb, and swap H for D to watch the zero-point energies, the effective barrier and the rate change.
- **Takeaway:** A reaction is a journey over a mountain pass on an energy landscape; the pass's height sets how often molecules make it and its position sets which kind of energy gets them over.
- **Prerequisites:** reaction-rates-equilibrium, newtons-laws
- **Related:** surface-catalysis
- **Needs:** LEPS (Sato) parameters for the H3 and FH2 surfaces.
- **Pitfall:** The transition state is not an intermediate that can be isolated; it is the top of the pass, usually crossed within about one vibration (trajectories can recross), and a catalyst lowers the pass rather than pushing molecules over it.

#### salt-and-ice
- **Title:** Salt on ice: roads and ice cream
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A block of ice drawn as a neat stack of water particles, with a thermometer. One control at a time: sprinkle salt, and salt particles get between the water particles at the surface so the stack cannot re-form, and the ice melts although the thermometer reads below freezing. Set the weather colder and the salt stops working; pour on more salt and see the point where extra salt no longer helps. Then put a bag of cream into the salted ice: the melting pulls heat out of the cream, the bath's thermometer drops below what plain ice could reach, and the cream freezes. Behind the picture runs the measured freezing-point curve of salt water and a running count of the heat that melting takes from the bath and the cream.
- **Takeaway:** Salt gets in the way of water re-freezing, so salted ice melts below freezing, and that melting draws so much heat out of its surroundings that a salt-and-ice bath gets colder than ice, cold enough to freeze cream.
- **Prerequisites:** none
- **Needs:** Freezing point of salt water against salt content (NaCl brine table and its lowest point, about minus 21 °C), from the US FHWA 'Manual of Practice for an Effective Anti-icing Program' (US government work, public domain).
- **Pitfall:** Salt does not heat the ice or 'burn' through it, and it does not work at any cold: below about minus twenty, no amount of salt will melt ice.

### Biology

#### the-cell
- **Title:** The cell
- **Level:** 1
- **Kind:** explore
- **Interaction:** Zoom continuously from a tissue to a single cell, its organelles and the molecules inside them, with a scale bar that updates. Select any structure to see what it does; switch between animal, plant and bacterial cells.
- **Takeaway:** A cell is a crowded, organized factory whose parts span several orders of magnitude in size.
- **Prerequisites:** none
- **Needs:** Accurate illustrations or 3D models of cells, organelles and molecules at each scale.

#### dna-to-protein
- **Title:** DNA to protein
- **Level:** 1
- **Kind:** step
- **Interaction:** Type or pick a short gene and step through transcription into mRNA and translation at the ribosome, codon by codon, with the genetic-code table highlighted. Change, insert or delete one base and compare the resulting protein.
- **Takeaway:** DNA stores instructions in a four-letter code read three letters at a time, so a one-letter change can do nothing, alter one amino acid, or scramble everything after it.
- **Prerequisites:** the-cell

#### protein-folding
- **Title:** Protein folding
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Fold a short chain of water-attracting and water-repelling amino acids by hand against an energy score, then let it fold itself. Open a real protein in 3D beside its predicted structure, colored by the confidence of the prediction.
- **Takeaway:** A protein's sequence determines its shape and its shape determines what it does; predicting shape from sequence resisted solution for decades until machine learning largely cracked it.
- **Prerequisites:** dna-to-protein, chemical-bonds
- **Related:** carbon-polymers, neural-networks
- **Needs:** Real protein structures and predicted structures with confidence scores (Protein Data Bank, AlphaFold Protein Structure Database).

#### photosynthesis
- **Title:** Photosynthesis
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set light intensity, light color, CO2 level and temperature and watch the rate of sugar and oxygen production. Zoom into a chloroplast to follow photons exciting electrons, water being split, protons driving ATP synthase and the Calvin cycle fixing carbon.
- **Takeaway:** Plants use light to split water and to power the conversion of CO2 from the air into sugar.
- **Prerequisites:** the-cell
- **Related:** respiration-atp, solar-cells
- **Pitfall:** A plant's dry mass comes mostly from CO2 in the air, not from the soil, and the oxygen it releases comes from water.

#### respiration-atp
- **Title:** Respiration & ATP
- **Level:** 2
- **Kind:** step
- **Interaction:** Follow one glucose molecule through glycolysis, the citric acid cycle and the electron transport chain. Electrons pump protons across the mitochondrial membrane; let the protons flow back through ATP synthase and watch its rotor turn and make ATP. Remove oxygen to see the chain back up.
- **Takeaway:** Cells release the energy in food in small steps and store it as a proton gradient, which a rotating enzyme converts into ATP.
- **Prerequisites:** the-cell
- **Related:** redox-batteries, photosynthesis, diffusion-osmosis

#### meiosis-inheritance
- **Title:** Meiosis & inheritance
- **Level:** 1
- **Kind:** step
- **Interaction:** Step through meiosis with colored chromosome pairs, choosing where they cross over and how they line up. Cross two parents, see the Punnett square, then breed hundreds of offspring and watch the ratios approach Mendel's.
- **Takeaway:** Each parent passes on a random, reshuffled half of their genes, which is why traits can skip generations and siblings differ.
- **Prerequisites:** the-cell

#### evolution
- **Title:** Evolution by natural selection
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Run a population whose members vary in a heritable trait. Set the mutation rate, the population size and the environment (predators, food supply or an antibiotic dose) and watch the distribution of the trait shift over generations.
- **Takeaway:** Variation, inheritance and unequal survival are enough to make a population adapt, with no foresight involved.
- **Prerequisites:** meiosis-inheritance
- **Related:** deep-time, game-theory-cooperation
- **Pitfall:** Individuals do not adapt, and mutations do not arise because they are needed; selection acts on variation that already exists.

#### ecosystems
- **Title:** Ecosystems & population dynamics
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set birth, death and predation rates for a predator and its prey and watch the populations cycle, both as animals on a field and as curves. In a small food web, remove or add a species and follow the knock-on effects.
- **Takeaway:** Populations are tied together by feedback, so a change to one species ripples through the others in ways that are hard to guess.
- **Prerequisites:** none
- **Related:** chaos-fractals, epidemics, game-theory-cooperation, differential-equations, phase-portraits

#### crispr
- **Title:** CRISPR: how bacteria remember viruses
- **Level:** 2
- **Kind:** step
- **Interaction:** Infect a bacterium with phages and watch it store a piece of a survived virus as a new spacer in its CRISPR array; follow the array being read into guide RNAs, and watch a Cas protein scan an invader's DNA, check the PAM beside the match and cut. Toggle the PAM to see why the cell spares its own array, mutate the phage to see it escape, and run a population of bacteria and phages through an arms race. Gene editing is mentioned only as the later use of this system.
- **Takeaway:** A bacterium keeps a piece of each virus it survives in its own DNA, and uses RNA copies of that record to find and cut the same virus next time.
- **Prerequisites:** dna-to-protein
- **Related:** lac-operon

#### bacterial-chemotaxis
- **Title:** Bacterial chemotaxis
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Release a few hundred E. coli into a dish with a drop of attractant and watch each one run straight, tumble, and run again; inside each cell a receptor cluster (the MWC model of Tu, Shimizu & Berg) with Barkai–Leibler-style methylation feedback sets the tumble rate, and the swarm drifts up the gradient. Move the drop, flood the dish with a uniform dose and watch the tumble rate dip then recover exactly (perfect adaptation), and change the adaptation time or the swim speed to see the biased random walk fail.
- **Takeaway:** A bacterium is too small to read a shallow gradient across its body against the noise of counting molecules, so it compares now with a moment ago and tumbles less when things are getting better; that biased random walk is enough to climb a gradient.
- **Prerequisites:** the-cell
- **Related:** feedback-control, homeostasis
- **Pitfall:** The cell does not steer toward the attractant: it cannot tell direction, it only changes how often it tumbles, and the page must not draw it turning toward the source.

#### diffusion-osmosis
- **Title:** Diffusion, osmosis & active transport
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Drop dye into one corner of a box of jiggling particles and watch it spread, faster when warmer, while a concentration graph flattens. Put a membrane down the middle with pores that pass water but not sugar, set the sugar concentration on each side and watch the water level rise on the sugary side; then make the box a cell, place it in pure water, salt water and something in between, and see it swell, shrink or hold, as a potato slice does in the classroom experiment. Finally switch on a pump that carries particles against the gradient and watch its ATP meter drain.
- **Takeaway:** Particles spread from where they are crowded to where they are not by random motion alone; a membrane that holds dissolved particles back makes water flow toward the side with more of them; and moving anything the other way costs energy.
- **Prerequisites:** the-cell, states-of-matter
- **Related:** entropy, respiration-atp
- **Pitfall:** Osmosis moves water toward the side with more dissolved particles, but not because those particles 'dilute' the water so that fewer water molecules reach the pore: the flow is far larger than water's own diffusion would give, and it comes from the trapped particles pushing on the membrane. Diffusion needs no force or pump; particles have no direction of their own, and the net flow is a counting effect. A plant cell in pure water becomes firm rather than bursting, because of its wall.

#### pcr-copying-dna
- **Title:** PCR: copying DNA until there is enough to see
- **Level:** 1
- **Kind:** step
- **Interaction:** A tube with a few strands of DNA and a thermometer: step through one cycle (heat to split the strands, cool so short primers stick at the ends of the target, warm for the enzyme to extend them) and two strands become four; press play and the count doubles every cycle while the plot shoots up and the primers and building blocks run down. Set the starting number of copies and see when the glowing signal crosses the detection line: one copy takes about ten cycles longer than a thousand, which is how a PCR test reads how much virus was in the swab. Change the primers and a non-matching DNA stays uncopied.
- **Takeaway:** PCR copies a chosen stretch of DNA by doubling it every heating-and-cooling cycle, so thirty cycles turn a few molecules into a billion, and the cycle at which the signal appears says how many there were to start with.
- **Prerequisites:** dna-to-protein
- **Related:** epidemics
- **Pitfall:** Doubling is not forever: primers and nucleotides run out and the curve flattens, so the plateau says nothing about the starting amount; only the threshold cycle does. A Ct value is not a measure of how ill someone is. Nor is every copy the target from the first cycle: the short piece bounded by both primers only appears from the third cycle, after which it dominates.

#### morphogen-gradients
- **Title:** Morphogen gradients & positional information
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the production rate, diffusion constant and lifetime of a morphogen made at one end of a row of cells and watch its concentration profile settle into an exponential whose length scale, the square root of diffusion over decay, the page reports. Set two or three thresholds and the cells paint themselves in bands, Wolpert's French flag. Double the tissue's length and the bands fail to scale; switch on Ben-Zvi and Barkai's expansion-repression circuit (a second diffusing 'expander' that widens the gradient and is shut off by the morphogen) and the bands stay in proportion. Add noise to the concentration and see that boundaries where the gradient is steep stay sharp while those in its flat tail blur.
- **Takeaway:** A cell can learn where it is from how much of one substance reaches it, and the shape of that gradient, set by diffusion and decay, decides where the boundaries fall.
- **Prerequisites:** the-cell, dna-to-protein
- **Needs:** No data needed: a 1D synthesis-diffusion-degradation PDE plus the expansion-repression model (Ben-Zvi & Barkai 2010, PNAS), both run live. Optional comparison: published Bicoid length scales (about 20% of egg length, Gregor et al. 2007), quoted as numbers with citation.
- **Pitfall:** The synthesis-diffusion-degradation model is a working hypothesis and the Bicoid gradient's formation is still debated; the page must present the exponential as what the model predicts and say where it is tested.

#### lac-operon
- **Title:** Gene regulation & the lac operon
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Set the glucose and lactose in a bacterium's medium and watch an ODE model of the lac operon respond: the repressor leaves the operator when an inducer is present, the permease the operon makes imports more inducer, and while glucose is flowing in the glucose transporter blocks that permease (inducer exclusion), while CAP-cAMP raises the operon's output when glucose is scarce (by about fivefold in cells on succinate, Ozbudak et al. 2004, far less in cells growing on glucose). Sweep the gratuitous inducer TMG up and then down to trace the hysteresis loop, and grow a culture on both sugars to see the diauxic pause when the glucose runs out.
- **Takeaway:** A bacterium switches a set of genes on only when their product is useful and nothing better is around, and positive feedback through its own transporter turns that switch into a memory: the same inducer level can leave the operon on or off depending on where it came from.
- **Prerequisites:** dna-to-protein, reaction-rates-equilibrium
- **Related:** crispr
- **Pitfall:** Bistability and hysteresis were measured with the gratuitous inducer TMG; with plain lactose the loop is weak or absent because lactose is also consumed, so the page must not present lactose itself as a memory switch. Nor should it pin the diauxic pause on cAMP and CAP alone: in E. coli it comes mainly from inducer exclusion, where glucose uptake blocks the lactose permease.

#### population-genetics
- **Title:** Population genetics: drift & selection
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a hundred Wright-Fisher populations at once as allele-frequency traces: with no selection they wander and fix at random, faster in small populations; with a selection coefficient s they bend toward fixation, and a counter shows the share of new beneficial mutations that fix, approaching Haldane's 2s however large the population, so most are lost anyway. Set dominance to see recessive alleles hide from selection, and compare the Hardy-Weinberg genotype frequencies with the simulated ones each generation.
- **Takeaway:** Allele frequencies change by chance as well as by selection: in a small population chance can fix a harmful allele or lose a good one, and even in a large population most new beneficial mutations vanish while they are still rare.
- **Prerequisites:** meiosis-inheritance, evolution, central-limit-theorem
- **Related:** cancer
- **Pitfall:** Hardy-Weinberg is not 'evolution stops': it is the one-generation baseline that shows which forces are absent, and drift is not selection by another name; the page must keep them separate.

#### turing-patterns
- **Title:** Turing patterns
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run an activator-inhibitor reaction-diffusion system on a grid from near-uniform noise and watch spots or stripes crystallise. Change the ratio of the two diffusion rates and the pattern appears only once the inhibitor spreads much faster than the activator; change the reaction rates to move from spots to stripes to labyrinths; grow the domain and extra stripes insert themselves, and taper the grid into a tail to see spots become bands as it narrows.
- **Takeaway:** Two chemicals, one that makes more of itself and a faster-spreading one that suppresses it, can turn a uniform field into regular spots or stripes with no blueprint, at a spacing set by their reaction and diffusion rates.
- **Prerequisites:** morphogen-gradients, reaction-rates-equilibrium
- **Related:** chaos-fractals
- **Pitfall:** Not every stripe in nature is a Turing pattern. The page should name where a Turing-type mechanism is well supported (digit spacing, hair and feather follicles) and where the evidence is mixed (fish skin, where pigment cells also move). It must not claim the mechanism for zebra stripes or fingerprints without saying that is contested.

#### fireflies-in-sync
- **Title:** Fireflies that flash together
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A meadow of fireflies, each with its own inner clock that flashes when it strikes twelve and starts again. One control: how much a neighbour's flash nudges a firefly's clock forward. At zero the meadow twinkles at random; turn it up and patches start flashing together, then waves, then the whole field as one; drag a finger through the swarm to scramble it and watch it fall back into step.
- **Takeaway:** Thousands of fireflies flash together with no conductor, because each one nudges its own clock a little toward every flash it sees.
- **Prerequisites:** none
- **Pitfall:** There is no lead firefly and no outside signal; synchrony appears only from each insect reacting to its neighbours. Only some firefly species do this.

#### ant-trails
- **Title:** How ants find the shortest way
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Ants wander out of a nest at random; one that finds the sugar walks home laying a scent, and the others tend to follow scent, so a trail forms and thickens. Drag the sugar farther away or drop a pebble on the trail and watch the colony reroute. Then offer a long bridge and a short one together and count the ants on each: ants on the short one get back first, so its scent builds up sooner and the short one wins. Open the short bridge only after a trail has formed on the long one, and the colony stays on the long one, with the scent's fading switched on or off: every ant on the long bridge tops its scent up faster than it fades.
- **Takeaway:** A colony finds the shorter path with no map and no ant that knows it: ants on the short route return sooner, so its scent builds up faster and draws more ants, and a fading scent lets the colony give up a route that no longer leads to food.
- **Prerequisites:** none
- **Related:** graph-search
- **Pitfall:** No ant knows where the food is or compares the routes, and the queen gives no orders. Fading is not what makes the short bridge win when both are offered at once, and it does not let a colony switch to a shortcut that appears later while the old trail is still walked (models of real trails predict this, and real Argentine ants stayed on the long bridge); ant-inspired computer programs switch only because their ants lay more scent on shorter routes. Fading lets the colony forget a trail nobody walks any more. Real ants also use sight and memory, which the page leaves out and says so.

### Body & Medicine

#### heart-circulation
- **Title:** Heart & circulation
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Watch a beating heart in cross-section with its valves, blood flow and oxygen levels, synchronized with an ECG trace and a pressure curve. Change the heart rate, narrow the body's small arteries or make a valve leak.
- **Takeaway:** The heart is two pumps in series, one for the lungs and one for the rest of the body, kept in step by an electrical signal.
- **Prerequisites:** none
- **Related:** homeostasis, neurons

#### homeostasis
- **Title:** Hormones & homeostasis
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Give a virtual person a meal or send them for a run and plot blood glucose, insulin and glucagon over the following hours. Reduce insulin production or the body's sensitivity to it to model the two main types of diabetes, then try dosing insulin by hand.
- **Takeaway:** The body holds its internal conditions steady with negative feedback loops, and many diseases are a broken loop.
- **Prerequisites:** none
- **Related:** heart-circulation, feedback-control, bacterial-chemotaxis, pharmacokinetics-dosing, why-you-get-sleepy

#### neurons
- **Title:** Neurons & the brain
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Inject current into a neuron and watch sodium and potassium channels open, the membrane voltage spike and the signal travel down the axon, faster with myelin. At the synapse, release neurotransmitter and add up excitatory and inhibitory inputs on the next cell.
- **Takeaway:** A neuron adds up its inputs and fires an all-or-nothing electrical pulse, and the brain computes with the pattern and strength of the connections between neurons.
- **Prerequisites:** the-cell, electric-circuits
- **Related:** heart-circulation, neural-networks

#### vision-color
- **Title:** Vision & color
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Change the shape of the eye's lens to focus near and far objects on the retina, and add glasses to correct a blurred eye. Mix red, green and blue light to match a target color while the responses of the three cone types are shown; try classic illusions.
- **Takeaway:** The eye forms an image like a camera, but color is constructed by the brain from the signals of just three kinds of sensor.
- **Prerequisites:** light-optics
- **Related:** convolution-vision, cochlea-hearing, hearing-and-the-ear
- **Needs:** Measured sensitivity curves for the three cone types.

#### immune-system
- **Title:** The immune system
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Release a pathogen into tissue and watch the fast general response, followed by the slower selection and multiplication of the B and T cells whose receptors happen to fit it. Infect again and compare the speed of the second response.
- **Takeaway:** The body makes a vast range of receptors in advance, multiplies the few that match an invader, and keeps some of them as memory.
- **Prerequisites:** the-cell

#### epidemics
- **Title:** Epidemics & herd immunity
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set how many people each case infects, how long a case stays infectious and what share of people are vaccinated. Watch the infection spread through a moving crowd and plot the susceptible, infected and recovered counts over time.
- **Takeaway:** An outbreak grows exponentially while each case infects more than one other person, and it dies out once enough people are immune.
- **Prerequisites:** none
- **Related:** ecosystems, mrna-vaccines, exponentials-logarithms, differential-equations, random-graphs, pcr-copying-dna, forest-fire-spread

#### mrna-vaccines
- **Title:** Vaccines & mRNA
- **Level:** 2
- **Kind:** step
- **Interaction:** Follow an mRNA vaccine from injection: a lipid particle enters a cell, ribosomes read the mRNA and make a viral protein, the protein is displayed, and matching immune cells multiply. Compare antibody levels after one dose, two doses and a later infection.
- **Takeaway:** A vaccine shows the immune system a harmless piece of a pathogen so that the memory is already in place when the real one arrives.
- **Prerequisites:** immune-system, dna-to-protein
- **Related:** epidemics
- **Pitfall:** The mRNA stays outside the nucleus, does not alter DNA and is temporary: cells break most of it down within days.

#### cancer
- **Title:** Cancer
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Let the cells of a tissue divide and occasionally mutate; mutations in growth-control genes let a clone divide faster and spread, and mutations in repair genes raise the mutation rate, so that further changes arrive sooner. Apply a treatment and watch the tumor shrink, then regrow from the cells that resist it.
- **Takeaway:** Cancer is evolution inside the body: cells that acquire mutations letting them divide unchecked outgrow their neighbors.
- **Prerequisites:** evolution, dna-to-protein
- **Related:** population-genetics

#### medical-imaging
- **Title:** Medical imaging
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Rotate an X-ray source around a simple body and record its shadow at each angle, then watch the cross-section emerge as the projections are combined. Change the number of angles, toggle the filtering step that sharpens the result, and compare with a plain X-ray of the same body. Close with how ultrasound and MRI build images by other means.
- **Takeaway:** A CT scanner never sees a slice directly; it measures many shadows and computes the image that explains them all.
- **Prerequisites:** fourier-transform
- **Related:** aperture-synthesis, radar-sonar

#### cerebellum-motor-learning
- **Title:** The cerebellum & motor learning
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Move the mouse or a finger to targets while the cursor is secretly rotated by thirty degrees, and watch yourself miss, correct and adapt over a few dozen reaches; beside the hand, a two-rate error-driven model (a fast and a slow learner) updates its prediction trial by trial and its curve sits over the reader's own. Remove the rotation and say 'aim straight': the aftereffect that remains is the implicit, cerebellar part. Reverse the rotation briefly, then hide the errors, and both the model and the hand drift back toward the first adaptation as the fast learner fades and the slow one remains.
- **Takeaway:** An implicit learner nudges its prediction a little after every miss, and the aftereffect that survives being told the world is back to normal shows a correction that was learned, not reasoned.
- **Prerequisites:** neurons, feedback-control
- **Related:** gradient-descent, reinforcement-learning
- **Pitfall:** Not all of the reader's correction comes from the cerebellum: much of the quick early improvement under a large rotation is deliberate re-aiming, and only the slow, implicit part persists as an aftereffect when the reader is told the rotation is gone.

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

#### cochlea-hearing
- **Title:** Hearing & the cochlea
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Play a tone, a chord or a synthesized vowel into a cochlea modelled as a chain of coupled resonators whose stiffness falls along the basilar membrane, and watch the travelling wave peak at a place that depends on frequency. Drag the frequency and the peak moves; switch on the outer hair cells' amplification and the peak sharpens; kill the outer hair cells at the place tuned near 4 kHz, as loud noise does, and the audiogram develops the classic notch. Then replace the cochlea with a cochlear implant: split the sound into a few bands, drive one electrode per band, and hear the result.
- **Takeaway:** The cochlea sorts sound by frequency along its length, so pitch is a place, and a cochlear implant works by stimulating those places with a handful of electrodes.
- **Prerequisites:** waves-interference, fourier-transform, neurons
- **Related:** vision-color, compression, hearing-and-the-ear
- **Needs:** Speech for the implant demonstration: synthesized vowels (source–filter synthesis on published formant frequencies); the cochlear model itself is a standard one-dimensional transmission-line model, with its damping, amplifier saturation and input calibration fitted to published measurements.
- **Pitfall:** Noise damage does not simply turn the volume down: the lost hair cells remove the amplification, so soft sounds vanish while loud ones still hurt.

#### mri-k-space
- **Title:** MRI: an image from spinning protons
- **Level:** 3
- **Kind:** step
- **Interaction:** Start where Medical imaging stops: one gradient turns position into frequency. Step through a real 2D pulse sequence on a phantom: a slice-selective pulse tips the protons, a phase-encoding gradient gives each row its own twist, and a readout gradient records one line of the slice's 2D Fourier transform. Watch k-space fill line by line beside the image that its inverse transform gives so far. A Bloch-equation view of a few spins shows them fan out and refocus into an echo. Then edit k-space: keep only the centre for a blurred image, only the edges for outlines, skip every other line to fold the image onto itself, or shrink the field of view until the head wraps around.
- **Takeaway:** An MRI scanner never measures a picture: gradients give each position its own precession frequency and phase, so every echo is one line of the image's 2D Fourier transform, and the centre of k-space carries the contrast while its edges carry the detail.
- **Prerequisites:** medical-imaging, fourier-transform, electromagnetism
- **Needs:** The Shepp-Logan phantom (a mathematical object), with the MRI tissue values (proton density, T1, T2) of Gach, Tanase and Boada (2008) for its regions; optionally one real T1-weighted brain slice.
- **Pitfall:** MRI uses no ionizing radiation, and the image is not proton density alone. A point in k-space is not a pixel: every sample holds information about the whole image, which is why dropping lines blurs or ghosts the whole picture instead of leaving holes.

#### ecg-arrhythmias
- **Title:** The ECG & arrhythmias
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Run a sheet of heart muscle as an excitable medium (the Aliev–Panfilov equations on a grid) with a pacemaker, a fast conduction path and a slow atrioventricular node, and read a pseudo-ECG off it: the tissue's net electrical vector projected onto the three limb leads of Einthoven's triangle. Then break it: slow AV conduction until beats drop; slow conduction across the ventricles (in a sheet much smaller than its healthy wave, only widespread slowing makes room for a loop), add a scar, fire an early beat into tissue that has only partly recovered and watch a spiral wave take over the trace as tachycardia and then, where recovery is patchy, break up into fibrillation; deliver a shock that excites every cell at once and lets the pacemaker take back control. Real annotated recordings from the MIT-BIH database sit beside the simulated traces for comparison.
- **Takeaway:** An ECG is the shadow of a wave of excitation crossing the heart, and the most dangerous fast rhythms are usually not a faster pacemaker but a wave that finds a loop and chases its own tail.
- **Prerequisites:** heart-circulation, neurons
- **Needs:** Annotated ECG records from the MIT-BIH Arrhythmia Database on PhysioNet (Open Data Commons Attribution License v1.0).
- **Pitfall:** A defibrillator does not restart a stopped heart: it stops a chaotic rhythm so the natural pacemaker can take over, and a flat line is not a shockable rhythm. And not every arrhythmia is re-entry: a heart can also beat too slowly when conduction is blocked.

#### hearing-and-the-ear
- **Title:** How your ear hears
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Slide a tone from low to high and watch it shake the big eardrum, which passes the shake through three tiny bones onto a much smaller window into the fluid of the snail-shaped cochlea, concentrating the push; a ripple then runs along the cochlea's ribbon until it peaks at one spot. Each pitch peaks somewhere else, high notes near the entrance and low notes at the far end. Play two notes at once and see two bumps; turn the loudness up and the bumps grow.
- **Takeaway:** The ear sorts sounds by pitch before the brain hears them: each note makes a different place along the spiral wiggle.
- **Prerequisites:** none
- **Related:** cochlea-hearing, vision-color, why-spinning-makes-you-dizzy
- **Pitfall:** The cochlea is not a microphone with one signal: it is thousands of sensors each listening at its own spot. Loud is not the same as high: loudness mainly grows the bump, pitch moves it. And the little bones are not the main amplifier: most of the boost comes from a big eardrum pushing on a tiny window.

#### muscles-pull-in-pairs
- **Title:** Muscles pull in pairs
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag the hand of a cutaway arm: bending the elbow, the biceps shortens and bulges; straightening it against a push, such as pressing down on a table or pushing up from a chair, the triceps shortens instead, and tugging either muscle alone shows it can only pull, never push. Hang a bag of shopping from the hand and watch the biceps pull many times the bag's weight, because it grips the forearm so close to the elbow; lower the bag slowly and the biceps is still the one pulling, getting longer as it lets the bag down.
- **Takeaway:** A muscle can only pull, so every joint needs a pair that take turns, and the one that grips near the elbow must pull far harder than the weight in your hand.
- **Prerequisites:** none
- **Related:** bridges-structures
- **Pitfall:** Muscles never push; the opposite movement is another muscle pulling, or gravity. Lowering a bag slowly is the biceps braking while it lengthens, not the triceps pushing it down. And a bigger muscle does not change the lever: it still pulls from the same place.

#### why-spinning-makes-you-dizzy
- **Title:** Why spinning makes you dizzy
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Spin a head on a chair with a slider and watch the fluid in the ear's three rings lag behind, bending the little flap that tells the brain turning; keep spinning at a steady speed and the fluid catches up, so the feeling fades. Stop suddenly and the fluid keeps going, the flap bends the other way, and the brain reports turning in the opposite direction while the room stands still: that is dizzy.
- **Takeaway:** Your ears sense turning with a ring of fluid, and when you stop spinning the fluid keeps going, so you feel you are turning the other way.
- **Prerequisites:** none
- **Related:** hearing-and-the-ear, oscillations-resonance, newtons-laws
- **Pitfall:** Dizziness after spinning is not blood sloshing or the brain being overwhelmed by speed: the sensor is faithfully reporting a real movement of fluid that is no longer the head's movement.

#### why-you-get-sleepy
- **Title:** Why you get sleepy
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Set a bedtime and a wake-up time and run three days: a sleep-pressure tank fills while you are awake and drains while you sleep, and a body clock sets the hours when sleep comes easily; sleepiness is the gap between them. Skip a night and watch the tank overflow; nap in the afternoon and see tonight's sleep come later. A strip under the plot sketches the night's usual rounds of light and deep sleep, about ninety minutes each.
- **Takeaway:** Sleepiness is a pressure that builds all day and drains at night, gated by a clock that opens a window for it; when the two disagree you lie awake tired or nod off at noon.
- **Prerequisites:** none
- **Related:** homeostasis
- **Pitfall:** The page explains when you get sleepy, not why animals sleep at all, which is still an open question. And the body clock is not fixed: late mornings and evening screen light push it later, which is why a weekend of lie-ins makes Monday feel like jet lag (the toy keeps the clock fixed, and says so).

### Earth & Climate

#### plate-tectonics
- **Title:** Plate tectonics & volcanoes
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Drag two plates together, apart or sideways, choosing oceanic or continental crust for each. A cross-section builds mountains, trenches, rift valleys and volcanoes; a world map overlays plate boundaries with recorded earthquakes and volcanoes.
- **Takeaway:** Earth's surface is a set of moving plates, and most mountains, volcanoes and earthquakes occur where plates meet.
- **Prerequisites:** none
- **Related:** tsunamis
- **Needs:** Plate boundaries and catalogs of earthquakes and volcanoes.

#### earthquakes
- **Title:** Earthquakes & Earth's interior
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Trigger an earthquake and watch P and S waves spread through a cross-section of the Earth, bending with depth, with S waves stopping at the liquid outer core. Read arrival times at three stations to locate the epicenter, and compare magnitudes on a logarithmic scale.
- **Takeaway:** Seismic waves cross the whole planet, so the recordings that locate an earthquake also reveal the layers inside the Earth.
- **Prerequisites:** plate-tectonics, waves-interference
- **Related:** exponentials-logarithms
- **Needs:** A reference model of seismic wave speeds inside the Earth.

#### deep-time
- **Title:** Deep time
- **Level:** 1
- **Kind:** explore
- **Interaction:** Scrub a timeline of 4.5 billion years while a globe shows the drifting continents and tracks show temperature, oxygen and the major groups of life. Zoom from eons down to the last few thousand years, and map the whole history onto a single calendar year.
- **Takeaway:** Earth's history is so long that complex life, and humans most of all, occupy only its last sliver.
- **Prerequisites:** plate-tectonics, radioactivity
- **Related:** evolution, carbonate-silicate-thermostat
- **Needs:** Reconstructions of past continents, long-term temperature and oxygen records, and a dated timeline of life.
- **Pitfall:** Continent positions are poorly known for the early Earth; show that uncertainty instead of inventing detail.

#### atmosphere-weather
- **Title:** Atmosphere & weather
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Heat a globe unevenly and set its spin: convection cells and prevailing winds appear, deflected by the Coriolis effect. Zoom in to place high- and low-pressure systems and fronts, and warm the sea surface to grow a hurricane.
- **Takeaway:** Weather is the atmosphere moving heat from the equator toward the poles on a rotating planet.
- **Prerequisites:** none
- **Related:** chaos-fractals
- **Pitfall:** The Coriolis effect steers large-scale winds and storms; it does not decide which way a sink drains.

#### ocean-currents
- **Title:** Ocean currents & El Niño
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Change the winds over an ocean basin and watch the surface gyres form. Change temperature and salinity at high latitudes to speed up or stall the deep overturning circulation, and weaken the Pacific trade winds to set off an El Niño.
- **Takeaway:** The ocean moves heat around the planet through wind-driven surface currents and a slow, density-driven deep circulation, and a shift in either changes weather far away.
- **Prerequisites:** atmosphere-weather
- **Related:** ocean-acidification

#### ice-ages
- **Title:** Ice ages & orbital cycles
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Adjust the tilt of Earth's axis, the direction of its wobble and the stretch of its orbit, and see how much summer sunlight reaches the far north. Play the three cycles forward against the ice-core temperature record of the last 800,000 years.
- **Takeaway:** Small, regular changes in Earth's orbit pace the ice ages, and feedbacks from ice cover and CO2 amplify them into large swings.
- **Prerequisites:** sun-earth-moon
- **Related:** greenhouse-effect
- **Needs:** Computed orbital cycles and an ice-core temperature record.

#### carbon-cycle
- **Title:** The carbon cycle
- **Level:** 1
- **Kind:** simulate
- **Interaction:** A diagram of reservoirs (air, ocean, plants and soil, rock, fossil fuels) joined by flows drawn to scale. Change the rates of burning, deforestation and uptake, then run the clock to see where added carbon goes and how long it stays in the air.
- **Takeaway:** Carbon moves between air, life, ocean and rock at very different speeds, and burning fossil fuels takes carbon that was locked away for millions of years and puts it into the fast-moving part of the cycle.
- **Prerequisites:** photosynthesis
- **Needs:** Reservoir sizes and annual flows from a published global carbon budget.

#### greenhouse-effect
- **Title:** The greenhouse effect & climate change
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Follow sunlight in and infrared out through an atmosphere with adjustable CO2; the planet's temperature settles where the two flows balance. Switch the water-vapor and ice-reflectivity feedbacks on and off, and run emission scenarios to 2100.
- **Takeaway:** A planet's temperature is set by a balance between absorbed sunlight and emitted infrared, and greenhouse gases shift that balance by making it harder for infrared to escape to space.
- **Prerequisites:** carbon-cycle
- **Related:** ice-ages
- **Needs:** Published emission scenarios and the warming they project.
- **Pitfall:** Greenhouse gases absorb and re-emit infrared; they do not reflect it, and the mechanism is not the one that warms a glass greenhouse.

#### ensemble-weather-forecasting
- **Title:** Weather forecasts: why they come as odds
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A ring of forty weather cells round a latitude circle (the Lorenz-96 model) runs as a strip of colour, the true weather on top and the reader's forecast started from a measurement of it with adjustable error. Launch one forecast and watch it track the truth for a few days and then diverge; launch fifty from slightly different starts and watch the fan open, narrow on some days and wide on others, with the spread plotted against the actual error. Shrink the measurement error tenfold and the useful range grows only by about a week (three more doublings), not tenfold; make the model slightly wrong and the fan goes confident and wrong; then run the forecast-observe-correct cycle and watch the analysis stay close.
- **Takeaway:** Because small errors in today's weather keep doubling every few days, a single forecast loses its skill after a week or two; forecasters run many from slightly different starts, and where the runs agree the forecast is sure and where they fan out it is not.
- **Prerequisites:** chaos-fractals, atmosphere-weather
- **Related:** bayes-theorem
- **Pitfall:** Chaos does not make forecasting useless: the useful range differs from day to day, and the ensemble shows which days are which. But an ensemble's spread is not automatically a trustworthy probability: a slightly wrong model gives a narrow, confident fan that misses, which is why forecasters check spread against error and calibrate. A '70% chance of rain' means a 70% chance at any one spot, not rain over 70% of the area or 70% of the day.

#### ocean-acidification
- **Title:** Ocean acidification & carbonate chemistry
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Slide atmospheric CO2 from the pre-industrial 280 ppm past 1,000 ppm while the page solves the seawater carbonate system (the dissociation constants of carbonic acid in seawater, with alkalinity held fixed): pH falls, dissolved CO2 and bicarbonate rise, carbonate ion falls, and the aragonite saturation state drops below one first in cold water. A Bjerrum plot shows the species shifting with pH, a temperature slider shows why polar seas get there first, and the Revelle factor shows why the ocean's uptake slows as it fills.
- **Takeaway:** Adding CO2 to seawater does not just lower its pH, it consumes carbonate ions, the building block of shells, and cold water runs short of them first.
- **Prerequisites:** acids-bases, carbon-cycle, reaction-rates-equilibrium
- **Related:** ocean-currents, carbonate-silicate-thermostat
- **Needs:** Published empirical fits for seawater equilibrium constants as functions of temperature and salinity, the same ones CO2SYS uses: K0 (Weiss 1974), K1 and K2 of carbonic acid (Lueker et al. 2000), borate KB (Dickson 1990) and total boron (Uppström 1974) for the alkalinity, and aragonite and calcite solubility (Mucci 1983). These are published coefficients, retyped and cited. Cross-check the solver in a model test against the published intercomparison of carbonate packages (Orr, Epitalon & Gattuso 2015: check values of every constant, a standard water's dissolved carbon and its sensitivities, computed with CO2SYS, seacarb and mocsy).
- **Pitfall:** The ocean is not becoming acid (its pH stays above 7); acidification means moving toward acid, and the harm is the loss of carbonate ion, not corrosive water.

#### tsunamis
- **Title:** Tsunamis: a wave as long as the ocean is deep
- **Level:** 1
- **Kind:** simulate
- **Interaction:** A slice of the Pacific from Japan to California with the real sea floor under it. Jolt the floor up near the trench and watch the hump race across the deep ocean at airliner speed while a clock counts the hours and markers show arrival times; a speed gauge follows the depth, fast over the abyss and slowing over the shelf, where the wave bunches up and grows from under a metre to many metres. Drag the floor to change a shelf's slope or add an island, and compare with a wind wave of the same height, which barely notices the depth.
- **Takeaway:** A tsunami is a shallow-water wave even over the deepest ocean, so its speed is set by the depth alone: it crosses an ocean in hours, is barely visible at sea, and rears up only when it reaches the shallows.
- **Prerequisites:** waves-interference, earthquakes
- **Related:** plate-tectonics
- **Needs:** An ocean depth transect from NOAA's ETOPO 2022 relief model; the one-dimensional shallow-water equations run on that profile. State on the page that a single transect omits sideways spreading and focusing, so its heights far from the source come out too large (not a guaranteed upper bound) and are illustrative rather than coastal predictions.
- **Pitfall:** A tsunami is not a towering surf wave: at the coast it arrives as a fast-rising flood lasting minutes, often after the sea draws back; and it is not a tidal wave, tides have nothing to do with it.

#### carbonate-silicate-thermostat
- **Title:** The carbonate-silicate thermostat
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A box model in which volcanoes outgas CO2, silicate weathering removes it at a rate that rises with temperature and rainfall (the Walker, Hays and Kasting feedback), and a simple energy balance with water vapour and ice sets the temperature. Knock the CO2 off balance and watch it return over hundreds of thousands of years. Dim the Sun by a tenth and run a few million years: CO2 piles up until weathering catches up and the planet wins back about half of the cooling; dim it by more at once and the ice wins first. Follow the thermostat's balance as the Sun brightens from seventy-two percent 4.5 billion years ago (the carbon settles far faster than the Sun changes): CO2 falls as the Sun brightens and the planet stays unfrozen if the young Earth's volcanoes were livelier than today's, while with CO2 held at today's level it freezes and stays frozen. Freeze the planet to stop weathering and watch CO2 climb for millions of years until the ice gives way; move the planet outward or switch off the volcanoes to find where the thermostat fails.
- **Takeaway:** Over millions of years rock weathering acts as a thermostat, because a warmer, wetter planet draws down CO2 faster, which is why Earth stayed habitable under a brightening Sun and how a Snowball Earth ends.
- **Prerequisites:** carbon-cycle, greenhouse-effect
- **Related:** ocean-acidification, deep-time, radiative-convective-column
- **Pitfall:** This thermostat works over hundreds of thousands to millions of years and does nothing about fossil-fuel CO2 on human timescales; the fast carbon cycle and the slow one are different pages. It is the leading explanation of the faint young Sun paradox, not a settled one: the page should not present a single CO2 history as known.

#### radiative-convective-column
- **Title:** Radiative transfer & the climate column
- **Level:** 3
- **Kind:** simulate
- **Interaction:** A column of air from the surface to the stratosphere, solved with the two-stream radiative transfer equations for a grey gas plus an infrared window, with convection adjusting any layer steeper than the chosen lapse rate. Slide the infrared optical depth (the CO2 amount) and the lapse rate and watch the temperature profile, the tropopause and the emission height move, while a side panel shows which layer the escaping infrared leaves from. Close the window to make the gas fully grey and watch the stratosphere stop cooling as CO2 rises; switch convection off to see pure radiative equilibrium and its unstable lower layers.
- **Takeaway:** Adding greenhouse gas raises the height from which the planet radiates to space, and because air is colder higher up the whole column below must warm to restore the balance, while the stratosphere above it cools.
- **Prerequisites:** greenhouse-effect, atmosphere-weather
- **Related:** carbonate-silicate-thermostat
- **Pitfall:** Greenhouse gases do not trap heat like a lid or reflect infrared; the column warms because the effective emission level rises into colder air. A band that is saturated at the surface still warms the planet, because emission from higher, thinner layers is what matters. Stratospheric cooling is not automatic for any absorber: in a perfectly grey atmosphere with no solar heating aloft the stratosphere does not cool (its top stays at the skin temperature, its lower layers warm slightly), and it cools here because part of the infrared escapes through the window.

#### cloud-base
- **Title:** Why clouds form, and why their bottoms are flat
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a bubble of air up from the warm ground: it swells and its thermometer drops about one degree for every hundred metres, until the invisible water it carries turns to droplets and the bubble turns white. Every bubble released from the same ground turns white at the same height, so the clouds have flat bottoms; make the day more humid and the cloud base drops, dry the air and clouds form higher or not at all. A last step blows the bubble over a mountain: it cools as it is pushed up the slope, rains on the side facing the wind, and comes down the far side drier and warmer than it started.
- **Takeaway:** Rising air swells and cools, and a cloud appears at exactly the height where the air gets cold enough for its water to turn into droplets, which is why the bottoms of clouds are flat.
- **Prerequisites:** none
- **Related:** sea-breeze
- **Pitfall:** It is not colder up a mountain because it is farther from the Sun: a few kilometres make no difference to sunlight; the air up there is cold because air that rises expands and cools. Clouds are not made of vapour: they are tiny droplets, each heavier than air, that stay up because they fall more slowly than the rising air beneath them.

#### forest-fire-spread
- **Title:** How a wildfire crosses a forest, or stops
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A square forest of trees on a grid; light the left edge and watch the fire pass from each burning tree to its neighbours, leaving ash. One control: how densely the trees are planted. At half density the fire burns a few trees and dies, at two-thirds it nearly always crosses the forest, and around six in ten it is a coin toss, with a tally of how far the fire got over many runs; then cut a firebreak and find the width that stops it, or add wind so the fire jumps one extra tree downwind.
- **Takeaway:** In a big forest, a fire's chance of crossing does not grow gradually with how many trees there are: it flips from almost never to almost always over a narrow band of density, so removing a few trees or cutting a gap can stop a fire that would otherwise get through.
- **Prerequisites:** none
- **Related:** epidemics
- **Pitfall:** The tipping density (about 59% for four neighbours on a square grid) belongs to the grid and the rule, not to forests; real fires also depend on wind, slope, moisture and fuel, which the page says it leaves out.

#### sea-breeze
- **Title:** Where wind comes from: the sea breeze
- **Level:** 0
- **Kind:** simulate
- **Interaction:** A coast in cross-section, land on one side and sea on the other, filled with air drawn as drifting particles. Drag the Sun across the sky: by afternoon the land is warmer than the sea, the air over it rises, and air from the sea slides in underneath as a breeze that a flag on the beach shows. At night the land cools faster than the water and the breeze turns around and blows out to sea.
- **Takeaway:** Uneven heating is enough to make a wind: by day air slides in from over the cooler sea to replace the warm air rising over the land, and at night the land cools below the sea and the breeze turns around.
- **Prerequisites:** none
- **Related:** cloud-base
- **Pitfall:** Warm air does not rise because heat goes up: it rises because it is lighter than the cooler air around it, which pushes it up. And not every wind is a sea breeze: big weather systems are steered by Earth's spin, which this page leaves out.

### Space

#### sun-earth-moon
- **Title:** Sun, Earth & Moon
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Move the Earth around the Sun with an adjustable axial tilt and see day length and the angle of sunlight at any latitude. Move the Moon around the Earth, on an orbit tilted about 5 degrees to Earth's, to produce its phases; an eclipse happens only when a new or full Moon falls close to the plane of Earth's orbit. Watch the tides follow the Moon, stronger when it lines up with the Sun.
- **Takeaway:** Seasons, phases, eclipses and tides all come from the geometry of three bodies, one tilted axis and one tilted orbit.
- **Prerequisites:** none
- **Related:** orbits-kepler, shadows-and-pinholes
- **Pitfall:** Seasons are caused by the tilt of Earth's axis, not by its distance from the Sun. Phases are not Earth's shadow on the Moon. Eclipses do not happen every month, because the Moon's orbit is tilted.

#### orbits-kepler
- **Title:** Orbits & Kepler's laws
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Launch a body around a star with a chosen speed and direction and get a circle, an ellipse or an escape path. Overlays show equal areas swept in equal times and a plot of period against orbit size; add a second planet to see the two disturb each other.
- **Takeaway:** An orbit is continuous free fall, and a single law of gravity produces all three of Kepler's laws.
- **Prerequisites:** newtons-laws
- **Related:** sun-earth-moon, gps, calculus-of-variations, leap-years

#### rockets
- **Title:** Rockets & orbital maneuvers
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Design a rocket by choosing fuel mass, exhaust speed and number of stages and see whether it reaches orbit. Then plan burns to raise an orbit, transfer to Mars within a launch window, and gain speed from a planetary flyby.
- **Takeaway:** Spaceflight is a budget of velocity changes, and because fuel must lift more fuel, each extra bit of speed costs exponentially more.
- **Prerequisites:** orbits-kepler
- **Related:** lagrange-points-three-body

#### stars
- **Title:** Life cycle of stars
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Choose a star's starting mass and run its life: it moves across the Hertzsprung-Russell diagram while a cutaway shows which elements its core is fusing. It ends as a white dwarf, a neutron star or a black hole, and a periodic table shows where each element was made.
- **Takeaway:** A star's mass decides how it lives and dies, and almost every element heavier than helium was made in stars or in their explosions and collisions.
- **Prerequisites:** atoms-periodic-table
- **Related:** black-holes, big-bang, nuclear-fusion
- **Needs:** Stellar evolution tracks for a range of masses, or a simplified model documented as such.

#### black-holes
- **Title:** Black holes & curved spacetime
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Fire light rays and probes past a black hole and watch their paths bend, loop or cross the horizon. Lower a clock toward the horizon and compare its ticking with a distant one; place a star field behind the hole to see gravitational lensing.
- **Takeaway:** Gravity is the curvature of spacetime, and a black hole is a region where that curvature turns every path, even light's, inward.
- **Prerequisites:** special-relativity, orbits-kepler
- **Related:** stars, dark-matter, gps, aperture-synthesis
- **Pitfall:** A black hole does not suck things in; from far away, objects orbit it as they would any body of the same mass.

#### gravitational-waves
- **Title:** Gravitational waves
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Set the masses of two black holes and let them spiral together; ripples spread outward while the signal's frequency and amplitude climb into a chirp that can be played as sound. A laser interferometer's arms stretch and squeeze as the wave passes, with the true size of the change shown to scale.
- **Takeaway:** Accelerating masses send out ripples in spacetime, and detecting them means measuring a change in length far smaller than a proton.
- **Prerequisites:** black-holes, waves-interference
- **Related:** aperture-synthesis

#### dark-matter
- **Title:** Galaxies & dark matter
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Spin a model galaxy using only its visible stars and gas and compare the predicted orbital speeds with measured ones. Add an invisible halo and adjust its mass until the rotation curve fits, then see the same excess mass revealed by gravitational lensing in a galaxy cluster.
- **Takeaway:** Galaxies rotate too fast to be held together by the matter we can see, which points to about five times as much matter that we cannot.
- **Prerequisites:** orbits-kepler
- **Related:** black-holes, big-bang
- **Needs:** Measured rotation curves for at least one galaxy.

#### big-bang
- **Title:** The Big Bang & expanding universe
- **Level:** 2
- **Kind:** explore
- **Interaction:** Run the expansion of space forward and backward on a grid of galaxies and pick any galaxy as the viewpoint: all the others recede, faster with distance, and their light is stretched toward red. Scrub a timeline from the first seconds through the cosmic microwave background and the first stars to today.
- **Takeaway:** Space itself is expanding, so every observer sees distant galaxies receding, and running the film backward leads to a hot, dense beginning 13.8 billion years ago.
- **Prerequisites:** waves-interference
- **Related:** stars, dark-matter
- **Pitfall:** The Big Bang was not an explosion into empty space and has no center; show the expansion from more than one viewpoint.

#### exoplanets
- **Title:** Exoplanets
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Set a planet's size, mass, orbit and tilt and watch the star's brightness dip as the planet transits and the star's spectral lines shift as it wobbles. Read the planet's size and mass back from the two curves, and see whether it falls in the star's habitable zone.
- **Takeaway:** Most planets around other stars are found without being seen, through the small effects they have on the light of their star.
- **Prerequisites:** orbits-kepler
- **Related:** waves-interference

#### lagrange-points-three-body
- **Title:** The three-body problem & Lagrange points
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** The circular restricted three-body problem, drawn in the frame that rotates with the two large bodies. Set the mass ratio (Sun-Jupiter, Sun-Earth, Earth-Moon, or a slider) and the five Lagrange points appear. Set the probe's energy (the Jacobi constant) and the forbidden regions shade in, opening gates at L1 and L2 as the energy rises. Drop a probe at L1 or L2 and it drifts away within months. Drop one near L4 and it wanders in a tadpole around the point for as long as the reader waits, as Jupiter's Trojans do. Push the mass ratio past about 1 in 26 and the same probe escapes. Nudge a starting position by a hair to run two probes side by side and watch their paths split.
- **Takeaway:** Three bodies have no general closed-form solution and nearby paths split apart, but there are five points where a small body can keep pace with the other two: three balanced on a knife edge, and two that are stable while the smaller mass is light enough.
- **Prerequisites:** orbits-kepler
- **Related:** rockets, chaos-fractals
- **Pitfall:** L1 and L2 are not places where gravity cancels. A spacecraft there circles the Sun in exactly one Earth year because the combined pull (Earth's pull partly offsets the Sun's at L1 and adds to it at L2) is exactly what that orbit needs, and it still needs station-keeping. The general three-body problem is not 'unsolvable': Sundman found a convergent series, but no closed formula and no long-term predictability.

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

#### comet-tails
- **Title:** Comets and their tails
- **Level:** 0
- **Kind:** explore
- **Interaction:** Scrub a comet along its real stretched orbit, far out and frozen, then swinging in close to the Sun. As it warms, gas and dust stream off it, and the tail always points away from the Sun, whichever way the comet is going, so on the way out the comet flies tail-first. Two tails appear: a straight blue gas tail pushed by the solar wind and a curved dust tail of grains that lag along the orbit; zoom in to see the grains leave.
- **Takeaway:** A comet's tails are pushed out by the Sun, not left behind by its motion, so the gas tail always points straight away from the Sun and the comet leaves tail-first, while the dust tail bends back along the path it has travelled.
- **Prerequisites:** none
- **Needs:** Orbital elements of comet 1P/Halley (perihelion distance, eccentricity, period) from the JPL Small-Body Database: a few published numbers, typed into the model and free to reuse with the credit 'Courtesy NASA/JPL-Caltech' under JPL's open data policy.
- **Pitfall:** The tail does not trail behind like exhaust, and a comet is not a burning rock: it is ice and dust turning to gas in sunlight.

#### earth-is-a-ball
- **Title:** Earth is a ball
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Drag a ship out to sea and watch it from the shore. On a flat world it only shrinks, and binoculars bring all of it back. On the round world its hull sinks out of sight before its sails as the sea bulges up between you and it (the curve drawn exaggerated, the distances real). Binoculars cannot bring the hull back, but climbing a cliff can. Then walk a little figure around the globe: wherever it stands its feet point to the middle, and a dropped ball falls toward the middle too, so nobody on the far side falls off.
- **Takeaway:** The world is a ball, so the sea itself hides the bottom of a distant ship, and 'down' means toward the middle wherever you stand.
- **Prerequisites:** none
- **Pitfall:** People on the far side are not upside down and do not have to hold on: the page draws no fixed up arrow anywhere. The ship does not vanish because it got too small, and magnifying it does not bring the hull back. The bulge is drawn much bigger than it really is, and air bends light a little so you see slightly farther than the plain geometry says; the page does not claim exact distances.

#### leap-years
- **Title:** Leap years: why February gets an extra day
- **Level:** 0
- **Kind:** explore
- **Interaction:** A calendar wheel turns inside Earth's orbit: one lap of the Sun takes 365 days and about a quarter more, so each New Year falls a quarter-day short. Scrub forward with no leap days and watch the first day of summer slide through the calendar, a month after a century and into winter after seven or eight centuries; switch on 'one extra day every four years' and the slide almost stops; zoom out over a thousand years to see the small drift that is left and the 'skip every hundred, keep every four hundred' rule that fixes it.
- **Takeaway:** A year is not a whole number of days, so a calendar without leap days drifts out of step with the seasons; an extra day every four years, with a few skipped, keeps them matched.
- **Prerequisites:** none
- **Related:** orbits-kepler
- **Pitfall:** A leap day fixes the calendar, not the orbit; nothing about the seasons changes. The rule is not simply every four years: 1900 was not a leap year and 2000 was.

### Computing

#### binary
- **Title:** Binary & data representation
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Toggle the bits of a byte, or of longer words, and read the same pattern as an unsigned number, a signed number, a text character, a color and a floating-point value. Add two numbers and watch the carries, including an overflow.
- **Takeaway:** A computer stores only bits; what they mean depends entirely on the convention used to read them.
- **Prerequisites:** none

#### logic-gates
- **Title:** Logic gates & adders
- **Level:** 1
- **Kind:** build
- **Interaction:** Wire AND, OR, NOT and XOR gates on a canvas, flip the inputs and watch signals propagate, with a truth table generated live. Guided challenges build a half adder, a full adder and a 4-bit adder.
- **Takeaway:** A few kinds of simple gate, combined, can compute any logical or arithmetic function.
- **Prerequisites:** binary
- **Related:** cellular-automata

#### transistors-chipmaking
- **Title:** Transistors & chipmaking
- **Level:** 2
- **Kind:** step
- **Interaction:** Raise the gate voltage on a transistor shown in cross-section and watch a conducting channel form; pair two transistors into an inverter. Then step through fabrication (deposit, coat, expose through a mask, etch, dope, repeat) with a zoom from wafer to single transistor.
- **Takeaway:** A transistor is a switch controlled by a voltage, and chips are made by printing billions of them at once with light.
- **Prerequisites:** semiconductors, logic-gates

#### cpu
- **Title:** The CPU
- **Level:** 2
- **Kind:** step
- **Interaction:** Write or load a short assembly program for a minimal processor and single-step it: each instruction is fetched, decoded and executed while the program counter, registers, arithmetic unit and memory are highlighted. Then run it at speed, including a loop and a conditional jump.
- **Takeaway:** A processor repeats one small cycle (fetch an instruction, decode it, execute it) billions of times a second, and every program reduces to that.
- **Prerequisites:** logic-gates
- **Related:** turing-machines

#### gpu
- **Title:** GPUs & parallel computing
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Give the same job (shading every pixel of an image, then multiplying two large matrices) to one fast worker and to thousands of slow ones, and race them. Change the share of the job that must run in sequence and watch the speed-up hit a ceiling.
- **Takeaway:** A GPU trades a few fast, flexible cores for thousands of simple ones, which wins whenever a job splits into many identical, independent pieces.
- **Prerequisites:** cpu, linear-transformations
- **Related:** tensors, graphics-3d, neural-networks, cache-memory-hierarchy

#### graphics-3d
- **Title:** 3D graphics
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Move a camera and lights around a small scene. One view projects triangles onto the screen and fills them pixel by pixel; the other shoots a ray through each pixel and follows its bounces, with an adjustable bounce limit for shadows and reflections.
- **Takeaway:** A 3D image is made either by projecting geometry onto the screen or by tracing light backward from the eye; the first is fast and the second is more faithful.
- **Prerequisites:** linear-transformations, light-optics
- **Related:** gpu

#### sorting
- **Title:** Sorting & Big-O
- **Level:** 1
- **Kind:** step
- **Interaction:** Run bubble, insertion, merge and quick sort side by side on the same shuffled bars, stepping or playing at speed, with comparisons counted. Grow the input and plot operations against size on a shared chart; try already-sorted and reversed inputs.
- **Takeaway:** Algorithms that solve the same problem can differ enormously in how their cost grows with input size, and that growth rate matters more than the speed of the machine.
- **Prerequisites:** none
- **Related:** exponentials-logarithms, game-tree-search

#### graph-search
- **Title:** Graph search & shortest paths
- **Level:** 1
- **Kind:** build
- **Interaction:** Draw walls and slow terrain on a grid, set a start and a goal, and watch breadth-first search, Dijkstra's algorithm and A* expand their frontiers. Compare cells visited and the cost of the path found: breadth-first search ignores terrain and returns the route with the fewest steps, which is not always the cheapest. Then switch to a road-style graph of nodes and weighted edges.
- **Takeaway:** Finding a route is a systematic exploration of a graph, and a good estimate of the remaining distance lets the search skip most of it.
- **Prerequisites:** none
- **Related:** internet, pagerank, distributed-hash-tables, ant-trails
- **Pitfall:** A* is guaranteed to find the cheapest path only if its estimate never overestimates the remaining cost; with slow terrain, base the estimate on the cheapest terrain.

#### turing-machines
- **Title:** Turing machines & the limits of computation
- **Level:** 3
- **Kind:** step
- **Interaction:** Program a tape-and-head machine with a small rule table and step it through tasks such as adding one or checking a palindrome. Then explore two limits: a walk-through of why no single program can tell, for every program and input, whether it will halt, and a travelling-salesman puzzle whose search space explodes as cities are added.
- **Takeaway:** A very simple machine can compute anything that is computable, yet some problems cannot be solved by any program and others cannot be solved quickly by any known method.
- **Prerequisites:** sorting
- **Related:** cpu, chain-of-thought-scratchpad, cellular-automata

#### quantum-computing
- **Title:** Quantum computing
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Rotate a single qubit on the Bloch sphere with gates and measure it repeatedly to see the statistics. Entangle two qubits and compare their results, then step through Grover's search on a few qubits and watch the amplitude of the right answer grow.
- **Takeaway:** A quantum computer steers amplitudes so that wrong answers cancel and right ones reinforce, which gives a large speed-up for a few kinds of problem and little or none for most.
- **Prerequisites:** quantum-mechanics, logic-gates
- **Related:** cryptography, elliptic-curve-cryptography
- **Pitfall:** It does not try every answer at once and read off the best one; a measurement returns a single outcome, and the algorithm's job is to make that outcome likely to be right.

#### game-tree-search
- **Title:** How a computer plays a game: the search tree
- **Level:** 1
- **Kind:** build
- **Interaction:** Play noughts and crosses against the page and open its mind: a tree of the moves it is weighing, the leaves scored win, draw or loss and the scores passed up, the computer taking the best of its moves and assuming you take the worst for it. Switch to Connect Four, where the whole tree is too big, and set how many moves ahead it looks: at two it blunders, at six it is hard to beat, and with pruning off the count of positions examined rises about sevenfold per extra move; turn on pruning and watch whole branches greyed out, the count falling steeply with the chosen move unchanged. Build the scoring rule yourself from a palette of features (centre column, three in a row) and test it.
- **Takeaway:** A game-playing program looks ahead down a tree of moves, assumes the opponent plays its best, and picks the line with the best guaranteed outcome; how deep it can afford to look is set by how fast the tree grows.
- **Prerequisites:** graph-search
- **Related:** sorting, reinforcement-learning
- **Pitfall:** The program does not plan like a person; it counts. And it does not look at every possible game: depth is limited and the leaves are scored by a rule of thumb, which is why a better scoring rule can beat a deeper search.

#### cache-memory-hierarchy
- **Title:** Caches & the memory hierarchy
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Choose a program's access pattern (sum an array row by row or column by column, walk a linked list, multiply matrices with and without blocking) and run it through a cache with adjustable size, line length, associativity and replacement policy; each access lights a line as a hit or a miss, and the miss count and the average memory access time plot live. Add a second level of cache and watch where the knee of the curve moves.
- **Takeaway:** The same program, doing the same arithmetic, takes many times more cycles waiting for memory or many times fewer, depending only on whether it touches memory in an order the cache can exploit.
- **Prerequisites:** cpu
- **Related:** gpu
- **Pitfall:** A bigger cache is not always better: a direct-mapped cache thrashes on a stride equal to its size however large it is, and the unit moved is a whole line, never a byte, so a miss costs the same for one byte as for sixty-four.

#### hash-tables-bloom-filters
- **Title:** Hash tables & Bloom filters
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Insert keys into a table with chaining or open addressing and raise the load factor; every probe is drawn, and the measured mean probe length is plotted against the expected curve until the table resizes and rehashes. Then feed the same keys to a Bloom filter with an adjustable bit array and number of hash functions, query keys that were never inserted and watch the measured false-positive rate track the standard approximation (closely for large arrays, drifting above it for tiny ones); degrade the hash function with a slider and see both structures cluster.
- **Takeaway:** A good hash spreads keys evenly, so lookups stay constant-time until the table fills, and a Bloom filter trades a known, tunable false-positive rate for a fraction of the memory.
- **Prerequisites:** sorting, binary
- **Related:** cryptography
- **Pitfall:** A hash table's constant time is an average under a good hash, not a guarantee; the cryptographic hash of the cryptography page is a different tool; and a Bloom filter can only ever say 'definitely absent', never 'definitely present'.

#### life-on-a-grid
- **Title:** Life on a grid
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Paint a few squares on a grid and press step: every square counts its live neighbours at once, and the three rules (lonely dies, crowded dies, exactly three neighbours gives birth) show as the counts on each square. Press play and find the shapes that blink, the ones that sit still and the glider that walks across the board. Change one number in a rule and watch the same seed grow, freeze or die.
- **Takeaway:** A rule about counting neighbours, applied to every square at once, makes things that blink, walk and grow that nobody drew.
- **Prerequisites:** none
- **Pitfall:** All squares update together from the previous picture, not one after another; a page that updates in place gets wrong patterns. And do not call Life 'random': the same seed gives the same future every time.

#### secret-codes
- **Title:** Secret codes & code-breaking
- **Level:** 0
- **Kind:** step
- **Interaction:** Turn the inner ring of a code wheel and type a message: each letter steps along the alphabet by the same amount, and your friend turns the ring back to read it. A spy who does not know the turn tries all 25 turns at once and the one that reads as words jumps out. Scramble the alphabet instead; now the spy counts the letters in the secret message and lines its bars up with the bars of ordinary English: the tallest few give E, T and A, half-words like TH_ appear, and the reader swaps the remaining letters until the message reads.
- **Takeaway:** A code that shifts every letter the same way falls to trying all 25 shifts, and a code that scrambles the alphabet falls to counting letters, because disguising a letter does not change how often it comes, and in a long message E is usually still the most common.
- **Prerequisites:** none
- **Related:** twenty-questions
- **Needs:** English letter frequencies counted at build time by a script from a public-domain text, e.g. Project Gutenberg's Alice's Adventures in Wonderland (public domain), not typed in from memory.
- **Pitfall:** A short message has too few letters for counting to work: show the counting fail on a one-line note and succeed on a paragraph, rather than pretending frequency analysis always works.

#### twenty-questions
- **Title:** Twenty questions: halving the haystack
- **Level:** 0
- **Kind:** step
- **Interaction:** Think of a number from 1 to 100 and answer the page's 'higher or lower' questions: a bar of candidates shrinks by half each answer and the counter stops at seven. Now find a word in a thousand-page dictionary by opening it in the middle, then in the middle of the right half, counting the opens, against a search that flips through every page. Then play animal twenty questions on 99 animals of a real dataset: each yes/no question hides the animals that would answer the other way, a good question hides about half, and when no question on the list tells the last few apart, guess by name.
- **Takeaway:** A question that splits what is left in half finds the answer in a handful of steps, where checking one at a time takes hundreds.
- **Prerequisites:** none
- **Related:** secret-codes
- **Needs:** The animal board: the UCI Zoo dataset (101 animals, 16 yes/no and count features), CC BY 4.0.
- **Pitfall:** Halving needs either a list in order (the dictionary trick fails on a shuffled pile of pages) or a question that really splits what is left: show 'is it a penguin?' barely shrinking the board, and do not claim every yes/no question halves the pile.

### Information & Networks

#### compression
- **Title:** Information & compression
- **Level:** 2
- **Kind:** step
- **Interaction:** Type a message and see how many bits each symbol deserves given its frequency, then build the Huffman tree and compare the encoded size. Load an image, split it into 8×8 blocks and discard high-frequency detail with a quality slider until the damage shows.
- **Takeaway:** Information is measured by surprise, so predictable data fits in fewer bits, and lossy formats go further by dropping what the senses will not miss.
- **Prerequisites:** binary, fourier-transform
- **Related:** entropy, ngram-text-models, training-a-tiny-language-model, cochlea-hearing, shazam-audio-fingerprint

#### error-correction
- **Title:** Error-correcting codes
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Encode a short message with a Hamming code, then flip any single bit and watch the parity checks pinpoint and repair it; flip two and see the code fail. Raise the noise on a channel and compare how much of the message survives with and without coding.
- **Takeaway:** Carefully structured redundancy lets a receiver detect and repair errors without asking for the data again.
- **Prerequisites:** binary
- **Related:** wireless-signals

#### cryptography
- **Title:** Cryptography
- **Level:** 2
- **Kind:** step
- **Interaction:** Two parties agree on a secret over a public channel, first by mixing paint colors and then with the real modular arithmetic on small numbers, while an eavesdropper sees every message. Edit one character of a text and watch its hash change completely; sign a message and verify the signature.
- **Takeaway:** Some operations are easy to do and practically impossible to undo, and that asymmetry lets strangers share secrets and prove identity over an open network.
- **Prerequisites:** primes-modular-arithmetic, binary
- **Related:** quantum-computing, hash-tables-bloom-filters

#### wireless-signals
- **Title:** Wireless signals
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Encode a bit stream onto a carrier wave by changing its amplitude, frequency or phase, shown as a waveform, a spectrum and a constellation of points. Add noise, distance and a second transmitter until bits are misread, then pack more bits into each symbol and see the trade-off.
- **Takeaway:** Data rides on radio waves as controlled changes to a carrier, and noise and bandwidth together set a hard limit on how fast it can be sent.
- **Prerequisites:** waves-interference, fourier-transform, binary
- **Related:** electromagnetism, error-correction, internet, tcp-congestion-control

#### internet
- **Title:** The Internet
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Send a message across a map of routers and watch it split into packets that travel hop by hop, possibly by different routes, and reassemble at the destination. Cut a link, congest a router or drop packets and watch the network reroute and the sender resend; trace a web request from name lookup to response.
- **Takeaway:** The Internet has no central controller: data is cut into packets that are routed independently, and reliability is added by the two ends of the connection.
- **Prerequisites:** binary
- **Related:** graph-search, wireless-signals, random-graphs

#### gps
- **Title:** GPS
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Drag a receiver across a flat map while satellites broadcast their positions and clock times; a circle of distance around each satellite passes through the receiver. Give the receiver's clock an error and every circle grows or shrinks together, so they stop meeting at a point; solving for that error as well takes one extra satellite (four in all, in three dimensions). Then switch off the relativity correction: the satellite clocks gain about 38 microseconds a day on clocks on the ground, worth about 11 km of range. Compare a receiver that trusts its own clock with one that solves for it.
- **Takeaway:** A receiver finds its position by timing signals from satellites whose positions are known, which only works because the clocks are kept correct to billionths of a second.
- **Prerequisites:** special-relativity
- **Related:** orbits-kepler, black-holes, kalman-filter, radar-sonar
- **Pitfall:** The method is trilateration (distances), not triangulation (angles). The relativity correction has two parts with opposite signs: orbital speed slows the satellite clocks by about 7 microseconds a day and weaker gravity speeds them up by about 45, a net gain of about 38. The popular claim that positions would drift about 10 km a day without it describes the range error, not the position: an offset shared by all the satellites is absorbed when the receiver solves for its own clock, so its position barely moves and its time is wrong.

#### pagerank
- **Title:** Search engines & PageRank
- **Level:** 2
- **Kind:** build
- **Interaction:** Build a small web by adding pages and links. Release a random surfer who follows links and occasionally jumps to any page, and watch the visit counts converge to each page's rank; add links to try to boost one page.
- **Takeaway:** A page's importance can be computed from the link structure alone: a page matters if pages that matter link to it.
- **Prerequisites:** none
- **Related:** linear-transformations, graph-search, random-graphs, distributed-hash-tables

#### consensus-blockchains
- **Title:** Blockchains & distributed consensus
- **Level:** 2
- **Kind:** simulate
- **Interaction:** A cluster of nodes elects a leader and replicates a log; crash nodes or cut the network and watch the cluster keep agreeing or stall. Then chain blocks by hash, tamper with an old block to invalidate every later one, and mine a block by searching for a nonce at adjustable difficulty.
- **Takeaway:** Getting independent machines to agree on one history is hard; voting among a known set of machines handles failures, and proof-of-work extends agreement to strangers who may cheat.
- **Prerequisites:** cryptography, internet
- **Related:** distributed-hash-tables, elliptic-curve-cryptography

#### tcp-congestion-control
- **Title:** TCP congestion control
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Send a file across a link with a bottleneck and a queue of adjustable size, and watch the sender's window grow in slow start, collapse on a loss and resume with additive increase, tracing the sawtooth of throughput against time. Add a second flow and see the two converge to a fair share; oversize the buffer and watch delay balloon while throughput does not improve; compare Reno, CUBIC and a delay-based sender on the same link.
- **Takeaway:** The Internet has no traffic police: each classic TCP sender probes for its share of the bottleneck by speeding up until the queue overflows and packets drop, then backs off, and that simple rule is what keeps the network from collapsing.
- **Prerequisites:** internet, feedback-control
- **Related:** wireless-signals
- **Pitfall:** Congestion control is not flow control: the receiver's window protects the receiver, and the congestion window protects the network. A loss on a wireless link is often noise rather than congestion, and classic TCP misreads it as a signal to slow down. AIMD's 'fair share' is fair only between flows with similar round-trip times; a flow with a short round-trip time grabs more.

#### shazam-audio-fingerprint
- **Title:** How Shazam recognises a song
- **Level:** 2
- **Kind:** step
- **Interaction:** Play one of a few short clips synthesized in the page and watch its spectrogram scroll by; the page keeps only the brightest peaks, a constellation of dots, and turns pairs of nearby peaks into fingerprints (two pitches and the gap between them), building a tiny database of a dozen clips the same way. Record a few seconds of one clip with noise, a cough and a different start time added, and watch its fingerprints looked up: hits on the wrong clips scatter, hits on the right one line up at a single time offset, and the spike in the histogram names the song. Slide the noise up until the spike disappears.
- **Takeaway:** A song is recognised not by comparing sound but by matching a sparse set of peak pairs whose time gaps line up, which is why a few noisy seconds from the middle of a track are enough.
- **Prerequisites:** fourier-transform, binary
- **Related:** compression, musical-scales-ratios
- **Pitfall:** It does not match the melody or the lyrics and cannot find a cover version or a hummed tune: a different performance has different peaks. The time alignment, not the number of matching hashes alone, is what makes a match reliable.

#### distributed-hash-tables
- **Title:** Distributed hash tables & consistent hashing
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Hash keys and servers onto a ring and watch a lookup walk around it; add or remove a server and count how many keys move, with consistent hashing against the naive modulo rule. Then give each node a finger table and watch lookups finish in a number of hops that grows only logarithmically as the network grows to thousands of nodes; churn nodes in and out and see the ring heal or lose keys depending on how many replicas each key has.
- **Takeaway:** Thousands of machines can find any key among them in a dozen hops with no directory, and adding one machine moves only its own share of the keys.
- **Prerequisites:** hash-tables-bloom-filters, internet
- **Related:** consensus-blockchains, pagerank, graph-search
- **Pitfall:** Consistent hashing is not fair by default: with one point per server the loads vary widely, which is what virtual nodes fix. A DHT finds where a key lives; it does not make the data durable, replication does.

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

#### kalman-filter
- **Title:** The Kalman filter
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Track a moving object from a noisy sensor: at each step the filter predicts where the object will be, then blends in the new measurement, with the estimate's uncertainty drawn as an ellipse that grows on prediction and shrinks on measurement. Turn the measurement noise up and watch the filter lean on its model; add a second sensor (an accelerometer to the GPS fix) and see the fused estimate beat either alone; make the object swerve and watch a filter with the wrong motion model lag behind, confidently.
- **Takeaway:** The best estimate of where something is comes from weighing a prediction against a measurement in proportion to how much each can be trusted, and the filter keeps that weighting up to date.
- **Prerequisites:** bayes-theorem, central-limit-theorem, linear-transformations, feedback-control
- **Related:** gps, radar-sonar
- **Pitfall:** It is not a plain average of the measurements: it weighs a prediction against each new one, and with a good model it can be more certain than any single measurement. It is optimal only for linear systems with Gaussian noise, and when the model is wrong the failure mode is confident and wrong.

#### radar-sonar
- **Title:** Radar & sonar
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Fire a pulse at targets you place and drag, and watch the echoes return on a range display; shorten the pulse for resolution and lose energy, then replace it with a chirp and a matched filter and get both at once. Set a target moving and read its speed from the Doppler shift, build a range-Doppler map, raise the noise until targets vanish into clutter, and switch the medium to water to see why sonar runs slow and low-frequency.
- **Takeaway:** Radar and sonar measure distance by timing an echo and speed by its pitch, and the shape of the pulse decides how finely each can be told apart.
- **Prerequisites:** waves-interference, fourier-transform, wireless-signals
- **Related:** gps, medical-imaging, kalman-filter
- **Pitfall:** Range comes from timing, not triangulation; stealth is mostly about where the echo goes, not about absorbing it; and the Doppler shift measures only the speed toward or away from the antenna.

#### barcode-stripes
- **Title:** Barcodes at the checkout
- **Level:** 0
- **Kind:** step
- **Interaction:** Drag a scanner's red line across a barcode (a UPC-A, the 12-digit form found on many products) and watch what it sees, a trace of dark and light over time, then step through it: a start mark, six groups of stripes, a middle mark, six more and an end mark, each group of two bars and two gaps one digit. Scan slowly, fast or at a slant and the widths all stretch together, so the digits come out the same; scan it upside down and the scanner tells, from the left groups looking different from the right ones, which way to read. Smudge one stripe and the group matches no digit at all; print one bar a column out of place and the group reads as another digit, which the last digit, a check digit, catches: the light turns red, scan again.
- **Takeaway:** A barcode is a number written as stripe widths, read as proportions so that a steady scan at different speeds and slants gives the same number, with a last digit that catches a misread; the price is looked up afterwards.
- **Prerequisites:** none
- **Related:** qr-codes
- **Pitfall:** For ordinary packaged products the barcode does not contain the price or the product name; it is a number the till looks up (some in-store labels, such as those on weighed food, do carry a price). The scanner reads ratios of widths, not absolute sizes, which is why the code can be printed at different permitted sizes.

#### qr-codes
- **Title:** QR codes
- **Level:** 0
- **Kind:** build
- **Interaction:** Type a short message and watch it become a square of black and white cells, built the real way: the three big corner squares that tell a camera where the code is and which way up, then the message as cells, then spare cells computed from the message. Point a drawn camera at it from any angle and it reads. Now paint over cells with a brush: the message still comes out, and a counter shows how many cells are damaged; keep painting and find the moment it fails, then paint over a corner square instead, which fails at once.
- **Takeaway:** A QR code carries its message plus spare cells computed from it, so a scratched or partly covered code still reads, until too much of the message is spoiled or a corner finder is hidden.
- **Prerequisites:** none
- **Related:** barcode-stripes
- **Needs:** None to ship; the page runs a real encoder and decoder (open-source implementations of the QR standard exist under MIT and Apache 2.0, e.g. qrcode-generator and jsQR).
- **Pitfall:** The three corner squares hold no message; they are for finding and orienting. The code is not read in a spiral or line by line, and the spare cells are not a copy of the message, so do not say the data is duplicated. The survivable damage (about 7 to 30 percent depending on the level chosen) is counted in damaged bytes, not cells or area: a scatter of specks can break a code that a single blot of the same size does not, so the cell counter is a guide, not a fixed limit.

#### wifi-and-walls
- **Title:** Wi-Fi around the house
- **Level:** 0
- **Kind:** build
- **Interaction:** Place a router on a floor plan and the rooms fill with a signal map; drag the laptop around and its speed gauge follows the colour. Add walls, a brick one, a fridge, a fish tank, and watch each cut a shadow in the map and the gauge drop, as the link slows down to be heard through the loss. Switch the router to the faster, shorter-reach band and compare; then add a neighbour's router on the same channel and watch the two take turns.
- **Takeaway:** Wi-Fi is radio: walls and water eat it, the link slows down rather than breaking as the signal fades, and two networks on one channel must take turns.
- **Prerequisites:** none
- **Needs:** Attenuation per wall material at 2.4 and 5 GHz: NIST IR 6055, 'Electromagnetic Signal Attenuation in Construction Materials' (W. C. Stone, NIST, 1997; brick, concrete, drywall, glass, plywood, wet wood), for a multi-wall path-loss model; water (fish tank, people) from the same report's wet-material results or textbook absorption values.
- **Pitfall:** Wi-Fi is not the internet; a full signal to the router says nothing about the line out of the house. The signal does not stop at an edge: it fades gradually, and the devices then choose a slower, sturdier way of sending so that it can still be read, which is why the gauge drops step by step instead of cutting out. Walls are not perfect shadows either; reflections leak signal around them, which this simple wall-counting model leaves out.

### Artificial Intelligence

#### learning-from-data
- **Title:** Learning from data
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Place and drag points on a plane and fit a model whose flexibility is set by a slider, from a straight line to a high-degree curve. Hold some points back as a test set and watch the training error keep falling while the test error turns upward.
- **Takeaway:** Learning means fitting a model to examples so that it predicts new ones, and a model that is too flexible for its data can fit the noise in the examples and predict new ones worse.
- **Prerequisites:** none
- **Related:** bayes-theorem

#### gradient-descent
- **Title:** Gradient descent
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Drop a ball on a loss landscape shown as a surface and as a contour map; it steps downhill along the negative gradient. Change the learning rate, add momentum or noise, and try landscapes with ravines, plateaus and several minima.
- **Takeaway:** A model is trained by repeatedly nudging its parameters in the direction that reduces the error fastest, and the step size decides whether that crawls, converges or diverges.
- **Prerequisites:** calculus, learning-from-data
- **Related:** cerebellum-motor-learning, calculus-of-variations

#### neural-networks
- **Title:** Neural networks & backpropagation
- **Level:** 2
- **Kind:** build
- **Interaction:** Pick a 2D classification dataset and build a network by adding layers and neurons; train it live and watch the decision boundary and each neuron's output evolve. Then step through one example on a small 2-2-1 network: values flow forward, then error signals flow backward and adjust each weight.
- **Takeaway:** A neural network is layers of simple units whose weights are tuned by passing the error backward, and stacking layers lets it bend a simple boundary into almost any shape.
- **Prerequisites:** gradient-descent, linear-transformations
- **Related:** tensors, protein-folding, neurons, gpu, ising-model

#### convolution-vision
- **Title:** Convolution & computer vision
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Slide a small editable filter across an image and see the output build up; try blur, sharpen and edge filters. Then inspect a trained network layer by layer: early filters respond to edges, later ones to parts of the shapes it was trained on (in larger networks, textures and object parts), ending in a labeled prediction for a drawn digit.
- **Takeaway:** A convolutional network reuses the same small detectors across the whole image and stacks them, so simple features combine into complex ones.
- **Prerequisites:** neural-networks
- **Related:** vision-color
- **Needs:** A small pretrained image classifier that runs in the browser.

#### embeddings
- **Title:** Embeddings
- **Level:** 2
- **Kind:** explore
- **Interaction:** Pan and zoom a 2D map of thousands of words in which related words cluster; search for a word to see its nearest neighbors. Add and subtract word vectors (king − man + woman) to see which other word lands closest, and compare two sentences by the angle between their vectors.
- **Takeaway:** Meaning can be represented as position in a high-dimensional space, where distance stands for similarity and directions stand for relationships.
- **Prerequisites:** linear-transformations
- **Related:** tensors, tokenization, k-means-clustering
- **Needs:** Pretrained word vectors (a subset of a few thousand words) and a 2D projection of them.
- **Pitfall:** The 2D map is a projection that distorts distances; compute neighbors and analogies in the full space. The vector nearest to king − man + woman is usually king itself, and queen comes first only when the three input words are excluded; exclude them and say so on the page.

#### transformers
- **Title:** Attention & transformers
- **Level:** 3
- **Kind:** step
- **Interaction:** Pick one of several example sentences and hover over any token to see, layer by layer and head by head, which other tokens a real small transformer attends to (weights precomputed from the model). Step through one attention operation: queries are matched against keys, the scores become weights, and values are mixed into a new vector for each token.
- **Takeaway:** Attention lets every token gather information from every other token in one step, with learned weights deciding what is relevant, and a transformer is that operation stacked many times.
- **Prerequisites:** embeddings, neural-networks
- **Related:** language-models, tokenization, rlhf-alignment
- **Needs:** Attention weights from a real small transformer, computed in the browser or precomputed.

#### language-models
- **Title:** Large language models
- **Level:** 2
- **Kind:** step
- **Interaction:** Type any text to see it split into tokens; for a set of example prompts, view a real small model's probability for each candidate next token as a bar chart (precomputed). Pick tokens one at a time while adjusting temperature and top-p, and compare several sampled continuations of the same prompt.
- **Takeaway:** A language model does one thing, predict the next token, and fluent text, answers and code emerge from doing that repeatedly with a very large network trained on a very large amount of text.
- **Prerequisites:** embeddings, neural-networks
- **Related:** transformers, ngram-text-models, scaling-laws, next-word-guessing-game
- **Needs:** A small language model that runs in the browser, or precomputed next-token probabilities.

#### diffusion-models
- **Title:** Diffusion models
- **Level:** 3
- **Kind:** step
- **Interaction:** Add noise to an image step by step until only static remains, then run the learned reverse process and scrub through the denoising steps. Change the number of steps, the random seed and the strength of the guidance toward a prompt (a class label here; how text prompts work is sketched), live in a 2D cloud of points, where the whole process can be seen at once, and as precomputed comparisons for images.
- **Takeaway:** A diffusion model learns to remove a little noise at a time, so generating an image means starting from pure noise and denoising it repeatedly toward something that matches the prompt.
- **Prerequisites:** neural-networks, embeddings
- **Needs:** A small diffusion model for the 2D case, and precomputed denoising sequences for images.

#### reinforcement-learning
- **Title:** Reinforcement learning
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Paint rewards, penalties and walls onto a grid world and release an agent. Watch its value estimate for each cell and action update as it explores; adjust the exploration rate, the discount factor and the learning rate, and compare early episodes with late ones.
- **Takeaway:** An agent can learn a skill from rewards alone by trying actions and gradually crediting the ones that led to good outcomes, balancing exploration against using what it already knows.
- **Prerequisites:** learning-from-data
- **Related:** feedback-control, cerebellum-motor-learning, game-theory-cooperation, game-tree-search

#### ngram-text-models
- **Title:** N-gram text models & their limits
- **Level:** 1
- **Kind:** build
- **Interaction:** Feed a text into a counting machine that records which letter (or word) follows each run of the previous n, then let it write by sampling from those counts. Slide n from 1 to 10 and watch the samples go from gibberish to word-like to Shakespeare-like, while two meters track what goes wrong: the share of contexts in held-out text that were never seen climbs toward all of them, and the longest stretch copied verbatim from the source grows until the model only recites.
- **Takeaway:** Counting what followed the last few symbols gives more fluent text as the window grows, but the number of possible contexts explodes so fast that long windows are almost never seen, and the model can only copy; a model that reaches far back has to generalise instead of count.
- **Prerequisites:** learning-from-data
- **Related:** language-models, compression, tokenization, next-word-guessing-game
- **Needs:** About 1 MB of Shakespeare's plays (the 'Tiny Shakespeare' extract popularised by Karpathy's char-rnn, or the same plays taken from Project Gutenberg) and the reader's own text.
- **Pitfall:** Unseen contexts are not a problem solved by more data alone: the count of possible contexts grows exponentially with n. Smoothing and back-off fix the zero counts but not the lack of long-range structure.

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

#### positional-encoding
- **Title:** Position in a transformer: sinusoids & RoPE
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag a position slider and watch the sinusoidal encoding's dimension pairs turn like clock hands at geometrically spaced speeds, fast pairs telling neighbours apart and slow pairs telling far positions apart. Switch to RoPE, where the query and key themselves are rotated, and drag two tokens along the sentence: their attention score stays fixed while their distance does and changes when it does, whereas with an added sinusoid the score also drifts with absolute position. Extend the sentence past a marked training length and see the slowest pairs reach angles that never occurred in training.
- **Takeaway:** Rotating each query and key by angles proportional to its position makes their attention score depend only on how far apart the two tokens are, not on where they stand.
- **Prerequisites:** transformers, unit-circle
- **Related:** fourier-transform
- **Pitfall:** RoPE does not add a position vector to the embeddings and is not applied to the values. 'Depends only on relative position' holds for the score of one query-key pair, not for the whole network's behaviour beyond the trained length. Attention with a causal mask is not fully blind to order, since each token sees a different number of predecessors; it is order-blind only without the mask.

#### residual-stream-logit-lens
- **Title:** Inside a transformer block: the residual stream
- **Level:** 3
- **Kind:** explore
- **Interaction:** Pick a prompt and follow one token's vector down GPT-2 small's twelve blocks: in each, layer norm rescales a copy, attention adds what it gathered from other tokens, and the MLP adds its own output, drawn as arrows summing onto a running vector. A logit lens decodes that running vector after every block into the model's best guess for the next token, so a grid of layers by positions shows the answer appearing and sharpening; switch off any block's attention or MLP and see which guesses change.
- **Takeaway:** A transformer does not pass a message from layer to layer; every block adds a correction to one shared running vector, and the prediction is refined gradually as those corrections pile up.
- **Prerequisites:** transformers, language-models
- **Needs:** Residual-stream activations, block outputs and ablated runs of GPT-2 small for a set of prompts, precomputed (or GPT-2 small run in the browser through ONNX).
- **Pitfall:** The logit lens reads early layers with the final layer norm and unembedding, which they were never trained for; it works roughly on GPT-2 and fails on some other models (the tuned lens fixes this). Apply the final layer norm before unembedding, as the lens is defined, and do not present early-layer guesses as what the model 'thinks'.

#### training-a-tiny-language-model
- **Title:** Training a tiny language model
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Press train and a small character-level transformer (two layers, a few tens of thousands of weights) learns Tiny Shakespeare live in the page, with a fixed seed: the training and validation cross-entropy fall on a loss curve with smoothed bigram and trigram models' validation scores drawn as horizontal lines, perplexity is read off beside it, and a sample is written every few hundred steps. Change the model width, the context length and the amount of data to load precomputed runs of the same model (trained offline with the same code) and compare them: bigger models end lower, a longer context helps up to a point (8 to 32 characters, not 32 to 64 at this size), and with too little data the two curves split as it starts memorising.
- **Takeaway:** Training a language model is gradient descent on one number, the average surprise at the next character, and as that number falls the samples go from random letters to plausible spelling to words and line structure.
- **Prerequisites:** language-models, gradient-descent, ngram-text-models
- **Related:** compression, scaling-laws
- **Needs:** Tiny Shakespeare; a tiny char-level transformer trained by the page itself for the default configuration (nanoGPT's character-level configuration is the reference), plus the project's own precomputed loss curves and samples for the other settings, trained offline with the same code; smoothed n-gram baselines counted from the same train/validation split.
- **Pitfall:** Perplexity is the exponential of the average cross-entropy per token and is comparable only between models with the same tokenizer and the same validation text; a training loss near zero is memorisation, not success. The order in which samples improve is a typical pattern, not a guaranteed sequence.

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

#### rlhf-alignment
- **Title:** RLHF: learning from human preferences
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Read pairs of continuations that a real small language model wrote for a prompt and click the better one (or let a stated stand-in rater, a scoring rule, answer a hundred pairs at a time); a reward model (a linear layer on 48 principal components of GPT-2's own hidden states for each continuation, fit by the Bradley-Terry rule) updates after every click and scores all the candidates. Slide the KL penalty: the policy, computed exactly as the base model's distribution tilted by exp(reward/beta), drifts from the base model toward the reward model's favourites, and with a small penalty it collapses onto whichever odd continuation the reward model over-rates, reward hacking visible in the ranked list.
- **Takeaway:** Comparisons train a reward model, and the policy is the base model's distribution pulled toward that reward and held back by a KL leash; loosen the leash and the policy exploits the reward model's mistakes instead of the preferences behind them.
- **Prerequisites:** language-models, reinforcement-learning, bayes-theorem
- **Related:** transformers
- **Needs:** For three prompts, 64 sampled continuations each from GPT-2 small (OpenAI, MIT licence), with GPT-2's mean final hidden state over each continuation reduced to 48 principal components, all precomputed (a reward model is usually a head on the language model's own states, so no separate embedding model is used). The sample is the base model's distribution on the page: π_ref is 1/64 per continuation.
- **Pitfall:** On this page the policy can only reweight continuations the base model already gives probability to, because the KL-regularised optimum keeps the base model's support; do not generalise that into a claim that RLHF can never change what a model knows. On a finite candidate set that optimum is closed-form, so the page must not pretend PPO is running (a policy-gradient run, labelled as such, may show that it converges to the same optimum); say that DPO is derived from the same closed form. Reward hacking here means over-optimising a learned proxy, not the model 'wanting' to cheat.

#### kv-cache-inference
- **Title:** Serving a language model: the KV cache
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Generate text with a small transformer running in the page, first recomputing every earlier token at each step and then with a cache that keeps each layer's keys and values; counters show the arithmetic and the bytes read per new token: without the cache the arithmetic grows with the context, with it only attention's small share does, while the bytes read are about the weights either way, plus the cache, which grows. Then scale up to a published model configuration on a published GPU: drag the batch size and the context length and watch the gpu page's roofline place prefill (the whole prompt at once) on the compute ceiling and each decode step far below it, on the memory-bandwidth slope, until a large batch lifts it, while a bar shows the cache overtaking the weights in memory at long contexts.
- **Takeaway:** After the prompt, generating each token reads every weight and the whole cache from memory for very little arithmetic, so serving speed is set by memory bandwidth, and batching many requests together is what makes it cheap.
- **Prerequisites:** transformers, gpu
- **Needs:** A small transformer run in the page (the project's own or GPT-2 small); published model configurations (layers, widths, heads) and GPU datasheet figures for memory bandwidth and peak throughput.
- **Pitfall:** The cache does not make decoding compute-bound or free: its size grows with context and batch, and at long contexts reading the cache, not the weights, dominates. Prefill and decode are different regimes; one tokens-per-second figure hides both.

#### speculative-decoding
- **Title:** Speculative decoding
- **Level:** 3
- **Kind:** step
- **Interaction:** A cheap draft model guesses the next few tokens and the large target model checks them all in one pass: step through each guess, accepted with probability min(1, p/q) or rejected and replaced by a sample from the leftover distribution max(0, p - q), with p and q drawn as overlapping bar charts. When every guess is accepted, the target's own pass adds one more token for free. Change the number of guesses and swap in a better or worse draft to see the tokens gained per target pass, then run ten thousand samples and watch their histogram converge on the target model's distribution.
- **Takeaway:** A small model can do the guessing and the big one only the checking, which yields several tokens per expensive pass with output distributed exactly as if the big model had written it alone.
- **Prerequisites:** kv-cache-inference, language-models
- **Needs:** Two char-level models sharing one vocabulary, both run in the page: as target, the tiny transformer whose weights are shipped precomputed from training-a-tiny-language-model; as draft, a bigram table counted from the same Tiny Shakespeare text (or a smaller transformer).
- **Pitfall:** It is not an approximation: with the rejection rule the output distribution equals the target's (a finite sample histogram matches only up to sampling noise). Accepting only exact matches with the target's top choice is valid only for greedy decoding. The speed-up pays off because a decode pass at small batch is memory-bound, so checking several tokens costs about as much as one; the tiny models on the page are not memory-bound, so the page counts target passes, not seconds.

#### chain-of-thought-scratchpad
- **Title:** Why thinking out loud helps a model
- **Level:** 3
- **Kind:** step
- **Interaction:** Two tiny transformers of the same size were trained by the project on 1- to 8-digit addition with the answer written most-significant digit first: one writes the answer straight away, the other first writes its working (each column's digit sum and carry). Pose sums and step through each model token by token, with the runs of columns adding up to 9 highlighted (such a column passes on whatever carry it gets, so the digit above it depends on columns further down): the direct model must settle that inside the one pass that writes the digit and errs there, while the scratchpad model reads the carry it just wrote back in. An accuracy chart by number of digits and by longest run of nines (with and without a carry coming in) compares the two, with 9 and 10 digits shown as beyond training, where both fail.
- **Takeaway:** A transformer runs the same fixed stack of layers for every token, so writing intermediate steps gives the same model more computation and a place to keep partial results, and it then solves carry-heavy sums the direct model gets wrong.
- **Prerequisites:** training-a-tiny-language-model, transformers
- **Related:** turing-machines
- **Needs:** Two tiny transformers trained offline by the project on generated addition problems (with and without a scratchpad), shipped and run in the page; the weights are the project's own, under the site's MIT licence.
- **Pitfall:** The written steps help because they are computation the model conditions on, not because the model narrates a hidden thought, and in large models the written reasoning is not guaranteed to be a faithful account of how the answer was reached. Do not say transformers cannot add directly (they learn it well when the answer is written least-significant digit first), and do not say a scratchpad solves length generalisation: beyond the trained lengths, both models degrade.

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

#### spam-filter-word-counts
- **Title:** How a spam filter decides
- **Level:** 0
- **Kind:** build
- **Interaction:** A pile of real text messages arrives, each already marked spam or not; pick any word, 'free', 'win', 'tonight', 'mum', and see two counts, how many spam messages contain it and how many ordinary ones. Build the filter by letting it count every word, then write a message of your own and watch the words vote: each nudges the score toward spam or not according to its two counts. Try to sneak past with 'fr33' and watch the vote change; mark your message and see the counts update.
- **Takeaway:** This kind of spam filter has no idea what a message means: it counts which words turned up more in past spam than in ordinary messages, which is why spammers misspell and why your 'report spam' clicks teach it.
- **Prerequisites:** none
- **Related:** teach-a-machine
- **Needs:** The SMS Spam Collection (Almeida and Gómez Hidalgo, UCI Machine Learning Repository, 5,574 messages), reduced to a hand-checked subset of a few hundred messages with adult or crude spam removed, since the audience is children.
- **Pitfall:** No word is bad: 'free' is only commoner in spam. The filter can be fooled both ways, and how much spam exists overall matters, so a rare kind of message needs stronger evidence; keep that as counts, not Bayes' formula. Do not say this is how every modern mail filter works: real ones also look at the sender, the links and use neural networks.

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

### Energy & Machines

#### heat-engines
- **Title:** Heat engines
- **Level:** 2
- **Kind:** step
- **Interaction:** Step or play a four-stroke engine through intake, compression, combustion and exhaust, with the gas traced as a loop on a pressure-volume chart whose area is the work done. Change the compression ratio and the hot and cold temperatures and compare the efficiency with the theoretical maximum.
- **Takeaway:** An engine turns heat into work only by letting it flow from hot to cold, and the two temperatures set a ceiling on efficiency that no design can beat.
- **Prerequisites:** entropy
- **Related:** power-grid

#### motors-generators
- **Title:** Electric motors & generators
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Send current through a coil between two magnets and watch the forces turn it, with a commutator reversing the current every half-turn. Then turn the coil by hand and watch a voltage appear, as direct or alternating current depending on how it is connected.
- **Takeaway:** A motor and a generator are the same machine run in opposite directions: current in a magnetic field produces motion, and motion in a magnetic field produces current.
- **Prerequisites:** electromagnetism

#### power-grid
- **Title:** The power grid
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Run a small grid through a day: demand rises and falls while the reader dispatches gas, nuclear, hydro, solar, wind and batteries to keep the frequency on target. Step the voltage up and down with transformers to see transmission losses, then trip a plant or send a cloud over the solar farm.
- **Takeaway:** Supply must match demand on a grid at every instant, so running one is a continuous balancing act, and high voltage is what makes it affordable to send power long distances.
- **Prerequisites:** motors-generators
- **Related:** redox-batteries, heat-engines, solar-cells, wind-turbine-aerodynamics, gas-turbines-combined-cycle

#### solar-cells
- **Title:** Solar cells
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Shine light of adjustable color and intensity on a p-n junction and watch photons free electrons that the junction's field sweeps into a circuit. Change the material's band gap and see how the energy of sunlight divides: photons with too little energy are not absorbed, the excess energy of the others is lost as heat, part of what remains is lost because the cell delivers less voltage than its band gap, and the rest is electrical output.
- **Takeaway:** A solar cell is a junction that turns absorbed photons directly into moving charge, and its band gap forces a trade-off between absorbing more photons and keeping more of each one's energy; with unavoidable voltage losses, that caps a single-junction cell at roughly one-third efficiency in ordinary sunlight.
- **Prerequisites:** semiconductors, light-optics
- **Related:** photosynthesis, power-grid, lasers
- **Needs:** A reference solar spectrum.
- **Pitfall:** The two spectrum losses alone leave a ceiling above 40%. The one-third limit (Shockley-Queisser) also counts the voltage lost to the light the cell must re-emit and to drawing power at its best operating point; leave that out and the graphic contradicts the takeaway.

#### nuclear-fission
- **Title:** Nuclear fission
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Fire a neutron at a uranium-235 nucleus and watch it split, releasing energy and more neutrons. In a reactor core, adjust the fuel, the moderator and the control rods to hold the chain reaction steady, and see what happens just above and just below that point.
- **Takeaway:** Splitting a heavy nucleus releases neutrons that can split more, and a reactor is that chain reaction held at exactly one new fission per fission.
- **Prerequisites:** radioactivity
- **Related:** nuclear-fusion

#### nuclear-fusion
- **Title:** Nuclear fusion
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Heat and compress a plasma of hydrogen isotopes until nuclei move fast enough to overcome their repulsion and fuse. Confine the plasma in a magnetic field and adjust temperature, density and confinement time until the fusion power exceeds the heating power.
- **Takeaway:** Fusing light nuclei releases more energy per kilogram of fuel than fission, but on Earth it needs temperatures above a hundred million degrees, and the difficulty is holding the fuel together long enough.
- **Prerequisites:** radioactivity
- **Related:** stars, nuclear-fission

#### flight
- **Title:** Flight
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Place a wing section in a stream of air and change its angle, its shape and the airspeed. Streamlines, a pressure map and force arrows show lift and drag growing with the angle until the flow separates and the wing stalls; then balance lift, weight, thrust and drag to hold level flight.
- **Takeaway:** A wing generates lift by turning the passing air downward, which appears as lower pressure above the wing than below it.
- **Prerequisites:** newtons-laws
- **Related:** drone-four-rotors
- **Pitfall:** Do not use the "equal transit time" explanation, in which air over the top must catch up with air below; it is false.

#### bridges-structures
- **Title:** Bridges & structures
- **Level:** 1
- **Kind:** build
- **Interaction:** Build a bridge from beams, cables and supports across a gap, then drive a load over it. Each member is colored by tension or compression and by how close it is to failure; compare beam, truss, arch and suspension designs for the same span and material budget.
- **Takeaway:** A structure stands by carrying loads to the ground through tension and compression, and its shape matters more than the amount of material.
- **Prerequisites:** newtons-laws
- **Related:** dislocations-alloys, muscles-pull-in-pairs

#### feedback-control
- **Title:** Feedback control & robots
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Tune the three gains of a PID controller to balance an inverted pendulum, hold a drone at a set height or keep a car at a set speed over hills, with the response plotted against the target. Add delay, sensor noise and gusts, then chain joints into a robot arm that reaches for a point.
- **Takeaway:** A machine stays on target by measuring its error and correcting in proportion to it; too little correction is sluggish and too much makes it oscillate.
- **Prerequisites:** oscillations-resonance
- **Related:** homeostasis, reinforcement-learning, bacterial-chemotaxis, differential-equations, phase-portraits, bicycle-stability, drone-four-rotors, toilet-flush

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

#### abs-brakes
- **Title:** ABS & the tire's grip
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Brake a car from highway speed on dry asphalt, wet asphalt or snow: one wheel carrying a quarter of the car follows its own equation of motion alongside the car's, and the tire's braking force follows a measured friction-against-slip curve whose peak sits near ten to twenty percent slip on dry asphalt and at smaller slip on snow, falling away as the wheel locks; the stopping distance is marked on the road. Brake too hard with ABS off and the wheel locks, the car slides further and no longer answers the steering; switch ABS on and watch the controller cycle the brake pressure to keep each wheel near the peak.
- **Takeaway:** A tire grips best while still turning slightly slower than the road passes under it, a locked wheel brakes less and cannot steer, and ABS holds each wheel in that narrow band by releasing and reapplying the brake many times a second.
- **Prerequisites:** newtons-laws, feedback-control
- **Related:** bicycle-stability
- **Needs:** Tire friction-slip curves from the Burckhardt model, mu = c1(1 - e^(-c2 s)) - c3 s, with its published coefficient sets for dry asphalt, wet asphalt and snow (reproduced openly, e.g. arXiv:2211.10336); an icy surface only if a cited coefficient set is found.
- **Pitfall:** ABS does not usually shorten the stop on dry road by much; its main job is to keep steering, and on loose gravel or snow a locked wheel can even stop shorter by building a wedge.

#### bicycle-stability
- **Title:** Why a bicycle balances itself
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Push a riderless bicycle at a chosen speed and let its linearized equations of motion run: below a certain speed it slowly falls, in a middle band it wobbles and recovers on its own, and above it it slowly leans away. Drag the speed and watch the eigenvalues of lean and steer cross the stability boundary; change the trail, the head angle and the front-wheel mass, cancel the gyroscopic effect of the wheels to see the ordinary bicycle lose its self-stable band, and set the trail to zero to shrink it to a sliver (a slightly negative trail removes it), then load the two-mass-skate design that balances with neither; finally steer left and watch the bike first lean right.
- **Takeaway:** A riderless bicycle balances itself in a band of speeds because a lean makes its front wheel steer into the fall, and that self-steering comes from the geometry and mass of the whole front assembly, not from any single effect such as the wheels' gyroscopic spin.
- **Prerequisites:** newtons-laws, oscillations-resonance, linear-transformations
- **Related:** feedback-control, abs-brakes
- **Needs:** The benchmark bicycle parameters and linearized equations of Meijaard, Papadopoulos, Ruina and Schwab (2007, Proc. R. Soc. A, doi:10.1098/rspa.2007.1857), reproduced openly at http://ruina.tam.cornell.edu/research/topics/bicycle_mechanics/, and the two-mass-skate parameters of Kooijman et al. (2011, Science 332:339, doi:10.1126/science.1201959).
- **Pitfall:** Neither 'the gyroscope keeps it up' nor 'the gyroscope plays no part' is right. On the standard benchmark bicycle, cancelling the wheels' gyroscopic effect removes its self-stable speed band. Yet Kooijman et al. (2011) built a bicycle that balances with neither a gyroscopic effect nor trail. Self-stability comes from several effects working together.

#### gas-turbines-combined-cycle
- **Title:** Combined-cycle power plants
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Set a gas turbine's pressure ratio and turbine inlet temperature and watch its exhaust leave at several hundred degrees; then route that exhaust through a heat-recovery steam generator drawn as a temperature-heat diagram, the cooling gas line above the heating water-and-steam line. Drag the steam pressure and the pinch-point gap, add a second and third pressure level, and see the two lines hug more closely, the stack temperature fall and the plant's combined efficiency climb past 60 percent.
- **Takeaway:** A combined-cycle plant reaches about 60 percent efficiency because a steam cycle turns the gas turbine's hot exhaust into extra work, and it recovers more the more closely the steam's heating line can follow the cooling exhaust.
- **Prerequisites:** heat-engines, entropy
- **Related:** power-grid, heat-pumps-refrigeration
- **Needs:** Specific heats of air and combustion products as functions of temperature (NASA Glenn thermodynamic polynomial coefficients, US government, public domain); water and steam properties from the IAPWS-95 formulation as tabulated by NIST, as in heat-engines (IAPWS-IF97, its industrial fit, would serve equally).
- **Pitfall:** The best gas turbine for a combined cycle is not the most efficient stand-alone one. A lower pressure ratio leaves a hotter exhaust for the steam cycle, so the plant's optimum pressure ratio is below the gas turbine's own. And the steam cycle burns no extra fuel: it only uses heat that would otherwise go up the stack.

#### heat-pumps-refrigeration
- **Title:** Heat pumps & refrigeration
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Drag the evaporator and condenser temperatures of a vapor-compression cycle on a pressure-enthalpy diagram drawn from real refrigerant properties and watch the four legs, compression, condensation, expansion and evaporation, move with them; the coefficient of performance, the compressor work and the heat delivered update live and are compared with the Carnot value for the same temperature lift. Set the compressor's isentropic efficiency, add subcooling and superheat, and switch the refrigerant between R-134a, propane and CO2, where the cycle goes transcritical.
- **Takeaway:** A heat pump delivers several units of heat per unit of work by boiling and condensing a fluid at two pressures, and that ratio falls as the gap between the two temperatures widens.
- **Prerequisites:** heat-engines, entropy, states-of-matter
- **Related:** gas-turbines-combined-cycle
- **Needs:** Saturation and superheated-vapor properties of R-134a, R-290 and R-744, tabulated for the browser: from the NIST Chemistry WebBook (as for heat-engines; CoolProp, MIT licence, would serve equally).
- **Pitfall:** A COP of 4 is not '400 percent efficiency' and breaks no law: most of the heat delivered is moved from outside, not made from the electricity, and the second law still caps the COP at the Carnot value for the lift.

#### clock-escapement
- **Title:** Pendulum clocks & the escapement
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Hang a weight on a cord that turns a toothed wheel and watch the wheel spin away in a blur; add the anchor that rocks with a pendulum, and the wheel can now advance only one tooth per swing, with a tick each time a tooth is caught and a tiny push back to the pendulum to keep it going. Lengthen or shorten the pendulum, or hang a heavier weight, and count ticks against a reference second hand to see which change alters the rate.
- **Takeaway:** The weight drives the clock and the pendulum only meters it out, one tooth per swing, so the length of the pendulum sets the time and a heavier weight hardly changes the rate.
- **Prerequisites:** none
- **Pitfall:** The pendulum does not power the clock, and a bigger swing does not tick faster: for small swings the length alone sets the period.

#### drone-four-rotors
- **Title:** How a drone steers with four rotors
- **Level:** 0
- **Kind:** build
- **Interaction:** Each step gives one control, and the drone shows its four rotors with a push arrow and a speed bar on each. Raise the throttle and all four speed up together so the drone rises; push the forward control and watch the back pair speed up, the drone tip and slide forward; push the sideways control and the left pair speeds up so it tips and slides right. Then the turn control speeds up the two rotors that spin clockwise and slows the other two: the lift stays the same but the drone turns on the spot, and if all four spin the same way the body spins helplessly the opposite way. A last step hands over the four rotor speeds directly.
- **Takeaway:** A drone has no flaps or rudder: it climbs, tilts and turns only by spinning its four rotors at slightly different speeds, two one way and two the other.
- **Prerequisites:** none
- **Related:** flight, feedback-control
- **Pitfall:** The rotors do not all spin the same way: the pairs spin opposite ways so their twists cancel, and turning on the spot uses that twist. It is the tilt that moves the drone sideways, not a sideways push from a rotor.

#### hydraulics-digger-arm
- **Title:** Diggers and hydraulics: a small push becomes a huge one
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Push a small piston and watch oil shove a much bigger piston at the digger's arm: the big one moves with many times the force but only a fraction of the distance, and a counter shows the two trade places exactly. Change the piston sizes and lift a car, then a boulder; let an air bubble into the pipe and the arm goes spongy. Drive the three cylinders of a digger's boom, arm and bucket to scoop and dump.
- **Takeaway:** A trapped liquid passes on the same push on every bit of surface it touches, so a piston with ten times the area gets ten times the push, paid for by moving only a tenth as far.
- **Prerequisites:** none
- **Pitfall:** Hydraulics make no energy: the work in equals the work out, and the small piston simply travels much farther. The liquid does not pass on the same total force; it passes on the same push per bit of area, which is why the bigger piston gets more. A liquid barely squashes, which is the whole point; a spongy brake pedal is air in the line.

#### light-bulb-hot-wire
- **Title:** Why a light bulb glows (and gets hot)
- **Level:** 0
- **Kind:** manipulate
- **Interaction:** Slide a dimmer and watch the thin wire inside an old-style bulb go from dark to dull red to orange to white as it heats, while a bar splits what the bulb takes into light you can see and heat. At full brightness the heat bar is dozens of times the light bar, and most of that heat leaves as invisible infrared you feel on your hand. Swap in an LED bulb giving the same light: the electricity it needs, and so its heat bar, shrinks to about a tenth, though the LED still makes more heat than light and warms its base instead of glowing in infrared.
- **Takeaway:** An old bulb makes light by heating a wire until it glows white and wastes nearly all its electricity as heat, while an LED makes the same light from about a tenth of the electricity, so far less heat.
- **Prerequisites:** none
- **Needs:** The CIE 1931 colour-matching functions and the photopic V(lambda) curve, to turn the filament's temperature into an on-screen colour and a light-versus-heat split (CIE open-access datasets, CC BY-SA 4.0, cie.co.at/data-tables; also at cvrl.org). Tungsten's resistivity and emissivity against temperature from Jones & Langmuir (1927, General Electric Review), quoted as numbers, or a grey-body emissivity of about 0.4 documented as an approximation. The LED's efficiency is a documented typical value (white LED bulbs at about 90 to 100 lm/W, against about 15 lm/W for incandescent).
- **Pitfall:** The wire does not burn: there is no oxygen inside the bulb, which is why a tungsten filament lasts about a thousand hours. Brightness does not rise in step with the dimmer: a little more current makes the wire much hotter, much brighter and whiter. And an LED is not cold: it still turns over half its electricity into heat, only much less electricity overall.

#### toilet-flush
- **Title:** Toilet flush & siphons
- **Level:** 0
- **Kind:** simulate
- **Interaction:** Press the lever: the flapper lifts, the tank pours into the bowl and the bowl's water climbs toward the top of the bend behind it. The moment it spills over fast enough, the whole bend fills and the bowl drains itself, fast, until air gets in and it gurgles to a stop. Then pour a bucket in slowly or quickly to find what starts the siphon, swap in a wide-bend washdown bowl that never siphons and only pushes the extra water over the top, and watch the float rise with the refilling tank and shut its own valve.
- **Takeaway:** In a siphonic toilet the tank only has to fill the bend behind the bowl; once it is full, the water running down the long side drains the bowl by itself until air gets in and breaks the siphon.
- **Prerequisites:** none
- **Related:** feedback-control
- **Pitfall:** The flush is not suction, and not every toilet siphons. In a siphonic toilet, gravity pulls the water down the long side of the bend while the air pressing on the bowl pushes more water in behind it. A slow pour never fills the bend and just trickles over the top, so the bowl stays full. Washdown toilets, the usual kind in much of Europe, never siphon: the tank's rush pushes the water over the weir.

## Reserve

Strong candidates that are not in the catalog. Do not build them unless the user promotes one to replace a topic above.

- Fluid dynamics
- DNA sequencing
- Operating systems
- Compilers
- Dimensionality reduction
