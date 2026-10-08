# Topic catalog

Source of truth for the content of an interactive web learning tool that shows how things work. It defines 100 topics in 11 categories, each built around one interactive graphic. Readers range from high-school students to university majors.

This file covers content only. It does not choose the stack, the visual design or the project layout; take those from the repository's own instructions.

## How to use this file

- **Read everything above "Checklist" before working on any topic.** Those sections are short and apply to every page.
- **Work on one topic at a time.** Find its entry under the heading `#### <slug>` and read that entry and the entries of its prerequisites. There is no need to read all 100 for one topic.
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
| Level | 1, 2 or 3 (see below). Sets the depth of the explanation. |
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
| 1 | High school |
| 2 | Final year of high school or first year of university |
| 3 | University student in the field |

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
| Mathematics | `math` | 10 |
| Physics | `physics` | 10 |
| Chemistry & Materials | `chemistry` | 9 |
| Biology | `biology` | 9 |
| Body & Medicine | `medicine` | 9 |
| Earth & Climate | `earth` | 8 |
| Space | `space` | 9 |
| Computing | `computing` | 10 |
| Information & Networks | `networks` | 8 |
| Artificial Intelligence | `ai` | 9 |
| Energy & Machines | `energy` | 9 |

## Checklist

**Mathematics**
- [x] unit-circle
- [ ] calculus
- [ ] linear-transformations
- [ ] tensors
- [ ] complex-numbers
- [ ] fourier-transform
- [x] bayes-theorem
- [x] central-limit-theorem
- [ ] primes-modular-arithmetic
- [x] chaos-fractals

**Physics**
- [x] newtons-laws
- [x] oscillations-resonance
- [ ] waves-interference
- [x] electric-circuits
- [ ] electromagnetism
- [ ] light-optics
- [ ] entropy
- [ ] special-relativity
- [ ] quantum-mechanics
- [ ] standard-model

**Chemistry & Materials**
- [x] atoms-periodic-table
- [ ] radioactivity
- [ ] chemical-bonds
- [ ] states-of-matter
- [ ] reaction-rates-equilibrium
- [ ] acids-bases
- [ ] redox-batteries
- [ ] carbon-polymers
- [ ] semiconductors

**Biology**
- [ ] the-cell
- [ ] dna-to-protein
- [ ] protein-folding
- [ ] photosynthesis
- [ ] respiration-atp
- [ ] meiosis-inheritance
- [ ] evolution
- [x] ecosystems
- [ ] crispr

**Body & Medicine**
- [ ] heart-circulation
- [ ] homeostasis
- [ ] neurons
- [ ] vision-color
- [ ] immune-system
- [x] epidemics
- [ ] mrna-vaccines
- [ ] cancer
- [ ] medical-imaging

**Earth & Climate**
- [ ] plate-tectonics
- [ ] earthquakes
- [ ] deep-time
- [x] atmosphere-weather
- [ ] ocean-currents
- [ ] ice-ages
- [ ] carbon-cycle
- [ ] greenhouse-effect

**Space**
- [x] sun-earth-moon
- [x] orbits-kepler
- [ ] rockets
- [ ] stars
- [ ] black-holes
- [ ] gravitational-waves
- [ ] dark-matter
- [ ] big-bang
- [ ] exoplanets

**Computing**
- [x] binary
- [x] logic-gates
- [ ] transistors-chipmaking
- [ ] cpu
- [ ] gpu
- [ ] graphics-3d
- [x] sorting
- [x] graph-search
- [ ] turing-machines
- [ ] quantum-computing

**Information & Networks**
- [ ] compression
- [x] error-correction
- [ ] cryptography
- [ ] wireless-signals
- [ ] internet
- [ ] gps
- [x] pagerank
- [ ] consensus-blockchains

**Artificial Intelligence**
- [x] learning-from-data
- [ ] gradient-descent
- [ ] neural-networks
- [ ] convolution-vision
- [ ] embeddings
- [ ] transformers
- [ ] language-models
- [ ] diffusion-models
- [ ] reinforcement-learning

**Energy & Machines**
- [ ] heat-engines
- [ ] motors-generators
- [ ] power-grid
- [ ] solar-cells
- [ ] nuclear-fission
- [ ] nuclear-fusion
- [ ] flight
- [x] bridges-structures
- [ ] feedback-control

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

#### bayes-theorem
- **Title:** Probability & Bayes' theorem
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Sliders set how common a disease is and how often the test is right for sick and for healthy people. A grid of 1,000 people is colored into true and false positives and negatives, and the chance that a positive result is real is read off by counting.
- **Takeaway:** What a piece of evidence means depends on the base rate: a positive result from an accurate test for a rare condition can still be more likely false than true.
- **Prerequisites:** none
- **Related:** central-limit-theorem, learning-from-data

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
- **Related:** complex-numbers, ecosystems, atmosphere-weather

### Physics

#### newtons-laws
- **Title:** Newton's laws, motion & energy
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Launch a projectile with adjustable speed, angle and air resistance; push and collide carts of different mass; send a cart along an editable track while bars show kinetic, potential and dissipated energy.
- **Takeaway:** Forces change motion rather than sustain it, and energy and momentum are conserved as they change form or pass between objects.
- **Prerequisites:** none
- **Related:** calculus

#### oscillations-resonance
- **Title:** Oscillations & resonance
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set the mass, stiffness and damping of a spring, or the length of a pendulum, and watch it oscillate. Add a periodic push with adjustable frequency and plot the resulting amplitude against that frequency.
- **Takeaway:** Every oscillator has a natural frequency, and pushing it at that frequency makes the motion build up.
- **Prerequisites:** newtons-laws

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
- **Related:** light-optics, wireless-signals

#### light-optics
- **Title:** Light & optics
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Drag light sources, mirrors, lenses and prisms on an optical bench and trace the rays. Change the refractive index and the color of the light to see bending, focusing, total internal reflection and dispersion into a spectrum.
- **Takeaway:** Light changes direction when its speed changes between materials, and that one rule accounts for lenses, rainbows and optical fiber.
- **Prerequisites:** waves-interference
- **Related:** electromagnetism

#### entropy
- **Title:** Heat, entropy & the arrow of time
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Fill the two halves of a box with fast and slow particles and remove the wall. Watch the temperatures equalize, count the arrangements consistent with each state, and try to run the film backward.
- **Takeaway:** Heat flows and things mix because mixed states vastly outnumber ordered ones, and that imbalance is what gives time its direction.
- **Prerequisites:** newtons-laws
- **Related:** states-of-matter, compression
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
- **Related:** central-limit-theorem, standard-model
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
- **Related:** entropy

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
- **Related:** reaction-rates-equilibrium
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
- **Related:** protein-folding

#### semiconductors
- **Title:** Crystals & semiconductors
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** View metal, insulator and semiconductor lattices beside their energy bands. Add dopant atoms to silicon to create free electrons or holes, join an n-type and a p-type region, and apply a voltage across the junction in each direction.
- **Takeaway:** A semiconductor's conductivity can be set by its impurities and changed by a voltage, which makes it a material that can be switched.
- **Prerequisites:** chemical-bonds, electric-circuits
- **Related:** quantum-mechanics

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
- **Related:** redox-batteries, photosynthesis

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
- **Related:** deep-time
- **Pitfall:** Individuals do not adapt, and mutations do not arise because they are needed; selection acts on variation that already exists.

#### ecosystems
- **Title:** Ecosystems & population dynamics
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Set birth, death and predation rates for a predator and its prey and watch the populations cycle, both as animals on a field and as curves. In a small food web, remove or add a species and follow the knock-on effects.
- **Takeaway:** Populations are tied together by feedback, so a change to one species ripples through the others in ways that are hard to guess.
- **Prerequisites:** none
- **Related:** chaos-fractals, epidemics

#### crispr
- **Title:** CRISPR & gene editing
- **Level:** 2
- **Kind:** step
- **Interaction:** Choose a target in a gene and design a 20-letter guide RNA; watch Cas9 scan the DNA, find the match beside its PAM site and cut. Choose how the cell repairs the break (disabling the gene or inserting a supplied template) and check the genome for off-target matches.
- **Takeaway:** CRISPR is a programmable cutter: a short RNA sequence tells the enzyme where to cut, and the cell's own repair machinery makes the edit.
- **Prerequisites:** dna-to-protein

### Body & Medicine

#### heart-circulation
- **Title:** Heart & circulation
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Watch a beating heart in cross-section with its valves, blood flow and oxygen levels, synchronized with an ECG trace and a pressure curve. Change the heart rate, narrow a vessel or make a valve leak.
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
- **Related:** heart-circulation, feedback-control

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
- **Related:** convolution-vision
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
- **Related:** ecosystems, mrna-vaccines

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

#### medical-imaging
- **Title:** Medical imaging
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Rotate an X-ray source around a simple body and record its shadow at each angle, then watch the cross-section emerge as the projections are combined. Change the number of angles, toggle the filtering step that sharpens the result, and compare with a plain X-ray of the same body.
- **Takeaway:** A CT scanner never sees a slice directly; it measures many shadows and computes the image that explains them all.
- **Prerequisites:** fourier-transform

### Earth & Climate

#### plate-tectonics
- **Title:** Plate tectonics & volcanoes
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Drag two plates together, apart or sideways, choosing oceanic or continental crust for each. A cross-section builds mountains, trenches, rift valleys and volcanoes; a world map overlays plate boundaries with recorded earthquakes and volcanoes.
- **Takeaway:** Earth's surface is a set of moving plates, and most mountains, volcanoes and earthquakes occur where plates meet.
- **Prerequisites:** none
- **Needs:** Plate boundaries and catalogs of earthquakes and volcanoes.

#### earthquakes
- **Title:** Earthquakes & Earth's interior
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Trigger an earthquake and watch P and S waves spread through a cross-section of the Earth, bending with depth, with S waves stopping at the liquid outer core. Read arrival times at three stations to locate the epicenter, and compare magnitudes on a logarithmic scale.
- **Takeaway:** Seismic waves cross the whole planet, so the recordings that locate an earthquake also reveal the layers inside the Earth.
- **Prerequisites:** plate-tectonics, waves-interference
- **Needs:** A reference model of seismic wave speeds inside the Earth.

#### deep-time
- **Title:** Deep time
- **Level:** 1
- **Kind:** explore
- **Interaction:** Scrub a timeline of 4.5 billion years while a globe shows the drifting continents and tracks show temperature, oxygen and the major groups of life. Zoom from eons down to the last few thousand years, and map the whole history onto a single calendar year.
- **Takeaway:** Earth's history is so long that complex life, and humans most of all, occupy only its last sliver.
- **Prerequisites:** plate-tectonics, radioactivity
- **Related:** evolution
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

### Space

#### sun-earth-moon
- **Title:** Sun, Earth & Moon
- **Level:** 1
- **Kind:** manipulate
- **Interaction:** Move the Earth around the Sun with an adjustable axial tilt and see day length and the angle of sunlight at any latitude. Move the Moon around the Earth, on an orbit tilted about 5 degrees to Earth's, to produce its phases; an eclipse happens only when a new or full Moon falls close to the plane of Earth's orbit. Watch the tides follow the Moon, stronger when it lines up with the Sun.
- **Takeaway:** Seasons, phases, eclipses and tides all come from the geometry of three bodies, one tilted axis and one tilted orbit.
- **Prerequisites:** none
- **Related:** orbits-kepler
- **Pitfall:** Seasons are caused by the tilt of Earth's axis, not by its distance from the Sun. Phases are not Earth's shadow on the Moon. Eclipses do not happen every month, because the Moon's orbit is tilted.

#### orbits-kepler
- **Title:** Orbits & Kepler's laws
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Launch a body around a star with a chosen speed and direction and get a circle, an ellipse or an escape path. Overlays show equal areas swept in equal times and a plot of period against orbit size; add a second planet to see the two disturb each other.
- **Takeaway:** An orbit is continuous free fall, and a single law of gravity produces all three of Kepler's laws.
- **Prerequisites:** newtons-laws
- **Related:** sun-earth-moon, gps

#### rockets
- **Title:** Rockets & orbital maneuvers
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Design a rocket by choosing fuel mass, exhaust speed and number of stages and see whether it reaches orbit. Then plan burns to raise an orbit, transfer to Mars within a launch window, and gain speed from a planetary flyby.
- **Takeaway:** Spaceflight is a budget of velocity changes, and because fuel must lift more fuel, each extra bit of speed costs exponentially more.
- **Prerequisites:** orbits-kepler

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
- **Related:** stars, dark-matter, gps
- **Pitfall:** A black hole does not suck things in; from far away, objects orbit it as they would any body of the same mass.

#### gravitational-waves
- **Title:** Gravitational waves
- **Level:** 3
- **Kind:** simulate
- **Interaction:** Set the masses of two black holes and let them spiral together; ripples spread outward while the signal's frequency and amplitude climb into a chirp that can be played as sound. A laser interferometer's arms stretch and squeeze as the wave passes, with the true size of the change shown to scale.
- **Takeaway:** Accelerating masses send out ripples in spacetime, and detecting them means measuring a change in length far smaller than a proton.
- **Prerequisites:** black-holes, waves-interference

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
- **Related:** tensors, graphics-3d, neural-networks

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

#### graph-search
- **Title:** Graph search & shortest paths
- **Level:** 1
- **Kind:** build
- **Interaction:** Draw walls and slow terrain on a grid, set a start and a goal, and watch breadth-first search, Dijkstra's algorithm and A* expand their frontiers. Compare cells visited and the cost of the path found: breadth-first search ignores terrain and returns the route with the fewest steps, which is not always the cheapest. Then switch to a road-style graph of nodes and weighted edges.
- **Takeaway:** Finding a route is a systematic exploration of a graph, and a good estimate of the remaining distance lets the search skip most of it.
- **Prerequisites:** none
- **Related:** internet, pagerank
- **Pitfall:** A* is guaranteed to find the cheapest path only if its estimate never overestimates the remaining cost; with slow terrain, base the estimate on the cheapest terrain.

#### turing-machines
- **Title:** Turing machines & the limits of computation
- **Level:** 3
- **Kind:** step
- **Interaction:** Program a tape-and-head machine with a small rule table and step it through tasks such as adding one or checking a palindrome. Then explore two limits: a walk-through of why no single program can tell, for every program and input, whether it will halt, and a travelling-salesman puzzle whose search space explodes as cities are added.
- **Takeaway:** A very simple machine can compute anything that is computable, yet some problems cannot be solved by any program and others cannot be solved quickly by any known method.
- **Prerequisites:** sorting
- **Related:** cpu

#### quantum-computing
- **Title:** Quantum computing
- **Level:** 3
- **Kind:** manipulate
- **Interaction:** Rotate a single qubit on the Bloch sphere with gates and measure it repeatedly to see the statistics. Entangle two qubits and compare their results, then step through Grover's search on a few qubits and watch the amplitude of the right answer grow.
- **Takeaway:** A quantum computer steers amplitudes so that wrong answers cancel and right ones reinforce, which gives a large speed-up for a few kinds of problem and little or none for most.
- **Prerequisites:** quantum-mechanics, logic-gates
- **Related:** cryptography
- **Pitfall:** It does not try every answer at once and read off the best one; a measurement returns a single outcome, and the algorithm's job is to make that outcome likely to be right.

### Information & Networks

#### compression
- **Title:** Information & compression
- **Level:** 2
- **Kind:** step
- **Interaction:** Type a message and see how many bits each symbol deserves given its frequency, then build the Huffman tree and compare the encoded size. Load an image, split it into 8×8 blocks and discard high-frequency detail with a quality slider until the damage shows.
- **Takeaway:** Information is measured by surprise, so predictable data fits in fewer bits, and lossy formats go further by dropping what the senses will not miss.
- **Prerequisites:** binary, fourier-transform
- **Related:** entropy

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
- **Related:** quantum-computing

#### wireless-signals
- **Title:** Wireless signals
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Encode a bit stream onto a carrier wave by changing its amplitude, frequency or phase, shown as a waveform, a spectrum and a constellation of points. Add noise, distance and a second transmitter until bits are misread, then pack more bits into each symbol and see the trade-off.
- **Takeaway:** Data rides on radio waves as controlled changes to a carrier, and noise and bandwidth together set a hard limit on how fast it can be sent.
- **Prerequisites:** waves-interference, fourier-transform, binary
- **Related:** electromagnetism, error-correction, internet

#### internet
- **Title:** The Internet
- **Level:** 1
- **Kind:** simulate
- **Interaction:** Send a message across a map of routers and watch it split into packets that travel hop by hop, possibly by different routes, and reassemble at the destination. Cut a link, congest a router or drop packets and watch the network reroute and the sender resend; trace a web request from name lookup to response.
- **Takeaway:** The Internet has no central controller: data is cut into packets that are routed independently, and reliability is added by the two ends of the connection.
- **Prerequisites:** binary
- **Related:** graph-search, wireless-signals

#### gps
- **Title:** GPS
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Drag a receiver across a flat map while satellites broadcast their positions and clock times; a circle of distance around each satellite passes through the receiver. Give the receiver's clock an error and every circle grows or shrinks together, so they stop meeting at a point; solving for that error as well takes one extra satellite (four in all, in three dimensions). Then switch off the relativity correction: the satellite clocks gain about 38 microseconds a day on clocks on the ground, worth about 11 km of range. Compare a receiver that trusts its own clock with one that solves for it.
- **Takeaway:** A receiver finds its position by timing signals from satellites whose positions are known, which only works because the clocks are kept correct to billionths of a second.
- **Prerequisites:** special-relativity
- **Related:** orbits-kepler, black-holes
- **Pitfall:** The method is trilateration (distances), not triangulation (angles). The relativity correction has two parts with opposite signs: orbital speed slows the satellite clocks by about 7 microseconds a day and weaker gravity speeds them up by about 45, a net gain of about 38. The popular claim that positions would drift about 10 km a day without it describes the range error, not the position: an offset shared by all the satellites is absorbed when the receiver solves for its own clock, so its position barely moves and its time is wrong.

#### pagerank
- **Title:** Search engines & PageRank
- **Level:** 2
- **Kind:** build
- **Interaction:** Build a small web by adding pages and links. Release a random surfer who follows links and occasionally jumps to any page, and watch the visit counts converge to each page's rank; add links to try to boost one page.
- **Takeaway:** A page's importance can be computed from the link structure alone: a page matters if pages that matter link to it.
- **Prerequisites:** none
- **Related:** linear-transformations, graph-search

#### consensus-blockchains
- **Title:** Blockchains & distributed consensus
- **Level:** 2
- **Kind:** simulate
- **Interaction:** A cluster of nodes elects a leader and replicates a log; crash nodes or cut the network and watch the cluster keep agreeing or stall. Then chain blocks by hash, tamper with an old block to invalidate every later one, and mine a block by searching for a nonce at adjustable difficulty.
- **Takeaway:** Getting independent machines to agree on one history is hard; voting among a known set of machines handles failures, and proof-of-work extends agreement to strangers who may cheat.
- **Prerequisites:** cryptography, internet

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

#### neural-networks
- **Title:** Neural networks & backpropagation
- **Level:** 2
- **Kind:** build
- **Interaction:** Pick a 2D classification dataset and build a network by adding layers and neurons; train it live and watch the decision boundary and each neuron's output evolve. Pause to step through one example: values flow forward, then error signals flow backward and adjust each weight.
- **Takeaway:** A neural network is layers of simple units whose weights are tuned by passing the error backward, and stacking layers lets it bend a simple boundary into almost any shape.
- **Prerequisites:** gradient-descent, linear-transformations
- **Related:** tensors, protein-folding, neurons, gpu

#### convolution-vision
- **Title:** Convolution & computer vision
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Slide a small editable filter across an image and see the output build up; try blur, sharpen and edge filters. Then inspect a trained network layer by layer: early filters respond to edges, later ones to textures and object parts, ending in a labeled prediction for a drawn or uploaded image.
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
- **Related:** tensors
- **Needs:** Pretrained word vectors (a subset of a few thousand words) and a 2D projection of them.
- **Pitfall:** The 2D map is a projection that distorts distances; compute neighbors and analogies in the full space. The vector nearest to king − man + woman is usually king itself, and queen comes first only when the three input words are excluded; exclude them and say so on the page.

#### transformers
- **Title:** Attention & transformers
- **Level:** 3
- **Kind:** step
- **Interaction:** Type a sentence and hover over any token to see, layer by layer and head by head, which other tokens it attends to. Step through one attention operation: queries are matched against keys, the scores become weights, and values are mixed into a new vector for each token.
- **Takeaway:** Attention lets every token gather information from every other token in one step, with learned weights deciding what is relevant, and a transformer is that operation stacked many times.
- **Prerequisites:** embeddings, neural-networks
- **Related:** language-models
- **Needs:** Attention weights from a real small transformer, computed in the browser or precomputed.

#### language-models
- **Title:** Large language models
- **Level:** 2
- **Kind:** step
- **Interaction:** Type a prompt and see it split into tokens, then view the model's probability for each candidate next token as a bar chart. Generate one token at a time while adjusting temperature and top-p, and compare several continuations of the same prompt.
- **Takeaway:** A language model does one thing, predict the next token, and fluent text, answers and code emerge from doing that repeatedly with a very large network trained on a very large amount of text.
- **Prerequisites:** embeddings, neural-networks
- **Related:** transformers
- **Needs:** A small language model that runs in the browser, or precomputed next-token probabilities.

#### diffusion-models
- **Title:** Diffusion models
- **Level:** 3
- **Kind:** step
- **Interaction:** Add noise to an image step by step until only static remains, then run the learned reverse process and scrub through the denoising steps. Change the number of steps, the random seed and the strength of the text guidance; begin with a 2D cloud of points, where the whole process can be seen at once.
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
- **Related:** feedback-control

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
- **Related:** redox-batteries, heat-engines, solar-cells

#### solar-cells
- **Title:** Solar cells
- **Level:** 2
- **Kind:** manipulate
- **Interaction:** Shine light of adjustable color and intensity on a p-n junction and watch photons free electrons that the junction's field sweeps into a circuit. Change the material's band gap and see how the energy of sunlight divides: photons with too little energy are not absorbed, the excess energy of the others is lost as heat, part of what remains is lost because the cell delivers less voltage than its band gap, and the rest is electrical output.
- **Takeaway:** A solar cell is a junction that turns absorbed photons directly into moving charge, and its band gap forces a trade-off between absorbing more photons and keeping more of each one's energy; with unavoidable voltage losses, that caps a single-junction cell at roughly one-third efficiency in ordinary sunlight.
- **Prerequisites:** semiconductors, light-optics
- **Related:** photosynthesis, power-grid
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
- **Pitfall:** Do not use the "equal transit time" explanation, in which air over the top must catch up with air below; it is false.

#### bridges-structures
- **Title:** Bridges & structures
- **Level:** 1
- **Kind:** build
- **Interaction:** Build a bridge from beams, cables and supports across a gap, then drive a load over it. Each member is colored by tension or compression and by how close it is to failure; compare beam, truss, arch and suspension designs for the same span and material budget.
- **Takeaway:** A structure stands by carrying loads to the ground through tension and compression, and its shape matters more than the amount of material.
- **Prerequisites:** newtons-laws

#### feedback-control
- **Title:** Feedback control & robots
- **Level:** 2
- **Kind:** simulate
- **Interaction:** Tune the three gains of a PID controller to balance an inverted pendulum, hold a drone at a set height or keep a car at a set speed over hills, with the response plotted against the target. Add delay, sensor noise and gusts, then chain joints into a robot arm that reaches for a point.
- **Takeaway:** A machine stays on target by measuring its error and correcting in proportion to it; too little correction is sluggish and too much makes it oscillate.
- **Prerequisites:** oscillations-resonance
- **Related:** homeostasis, reinforcement-learning

## Reserve

Strong candidates that are not in the catalog. Do not build them unless the user promotes one to replace a topic above.

- Exponentials & logarithms
- Differential equations
- Game theory
- Fluid dynamics
- Embryo development & pattern formation
- DNA sequencing
- Hearing & the cochlea
- Telescopes
- Operating systems
- Compilers
- Cellular automata
- Lasers & LEDs
- Heat pumps
- Clustering & dimensionality reduction
