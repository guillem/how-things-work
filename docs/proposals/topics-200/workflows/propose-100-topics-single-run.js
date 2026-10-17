export const meta = {
  name: 'propose-100-topics',
  description: 'Research and propose 100 new catalogue topics (level 0 and level 3 heavy) for How Things Work',
  phases: [
    { title: 'Generate', detail: '19 lenses, ~28 grounded candidates each' },
    { title: 'Merge', detail: 'near-duplicate clustering per category' },
    { title: 'Judge', detail: 'fit, buildability, level/distinctness per batch of 20' },
    { title: 'Select', detail: 'quota selection in code, then a curator pass' },
    { title: 'Verify', detail: 'two adversarial refuters per topic, with replacement' },
    { title: 'Gaps', detail: 'completeness critics, verified, swapped in' },
    { title: 'Write', detail: 'per-category JSON files in the scratchpad' },
  ],
}

const A = args
const CATS = A.categories
const CAT_IDS = CATS.map(c => c.id)
const CAT_NAME = Object.fromEntries(CATS.map(c => [c.id, c.name]))
const EXISTING = A.existing.map(r => ({ slug: r[0], category: r[1], level: r[2], kind: r[3], title: r[4], prerequisites: r[5] ? r[5].split(',') : [], related: r[6] ? r[6].split(',') : [] }))
const EX = Object.fromEntries(EXISTING.map(e => [e.slug, e]))
const QUOTA = { 0: 45, 1: 10, 2: 3, 3: 42 }
const L3_TARGET = { math: 5, physics: 2, chemistry: 5, biology: 5, medicine: 4, earth: 4, space: 2, computing: 2, networks: 5, ai: 3, energy: 5 }
const L0_TARGET = { math: 4, physics: 6, chemistry: 4, biology: 4, medicine: 5, earth: 4, space: 3, computing: 4, networks: 3, ai: 2, energy: 6 }
const CAT_MAX = 12
const KINDS = ['manipulate', 'simulate', 'step', 'build', 'explore']

// ---------- schemas ----------
const ENTRY_PROPS = {
  slug: { type: 'string', description: 'lowercase words joined by hyphens; unique; not an existing slug' },
  title: { type: 'string' },
  level: { type: 'integer', minimum: 0, maximum: 3 },
  kind: { type: 'string', enum: KINDS },
  category: { type: 'string', enum: CAT_IDS },
  interaction: { type: 'string', description: 'what the reader does and what responds; the core of the page' },
  takeaway: { type: 'string', description: 'one sentence; must be observable in the graphic alone' },
  prerequisites: { type: 'array', items: { type: 'string' }, description: 'existing or proposed slugs; never above own level; empty if none' },
  related: { type: 'array', items: { type: 'string' }, description: 'existing or proposed slugs; empty if none' },
  needs: { type: 'string', description: 'external data, models or artwork the page depends on, with source and licence; empty string if none' },
  pitfall: { type: 'string', description: 'a misconception the page must not repeat; empty string if none' },
  why: { type: 'string', description: 'one curriculum or demand signal with a URL' },
  overlapWith: { type: 'string', description: 'nearest existing slug and one sentence on how this differs' },
  needsSource: { type: 'string', description: 'none, or the dataset/model and its licence status' },
  leadsTo: { type: 'array', items: { type: 'string' }, description: 'level 0 only: existing level-1 slugs it prepares for' },
  everyday: { type: 'boolean', description: 'true if the topic is an everyday object or household mechanism' },
}
const ENTRY_REQ = Object.keys(ENTRY_PROPS)
const ENTRY_SCHEMA = { type: 'object', properties: ENTRY_PROPS, required: ENTRY_REQ }
const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: { type: 'array', items: ENTRY_SCHEMA },
    reserveDisposition: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, decision: { type: 'string', enum: ['promote', 'drop', 'merge'] }, slug: { type: 'string' }, reason: { type: 'string' } }, required: ['item', 'decision', 'slug', 'reason'] } },
  },
  required: ['candidates'],
}
const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    groups: { type: 'array', items: { type: 'object', properties: { keep: { type: 'string' }, drop: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } }, required: ['keep', 'drop', 'reason'] } },
    duplicatesOfExisting: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, existing: { type: 'string' }, reason: { type: 'string' } }, required: ['slug', 'existing', 'reason'] } },
  },
  required: ['groups', 'duplicatesOfExisting'],
}
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, score: { type: 'integer', minimum: 1, maximum: 5 }, reject: { type: 'boolean' }, reason: { type: 'string' }, suggestedLevel: { type: 'integer', minimum: 0, maximum: 3 } }, required: ['slug', 'score', 'reject', 'reason', 'suggestedLevel'] } },
  },
  required: ['verdicts'],
}
const CURATOR_SCHEMA = {
  type: 'object',
  properties: {
    swaps: { type: 'array', items: { type: 'object', properties: { out: { type: 'string' }, in: { type: 'string' }, reason: { type: 'string' } }, required: ['out', 'in', 'reason'] } },
    overlaps: { type: 'array', items: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' }, reason: { type: 'string' } }, required: ['a', 'b', 'reason'] } },
    notes: { type: 'string' },
  },
  required: ['swaps', 'overlaps', 'notes'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    hasFix: { type: 'boolean' },
    fixed: { type: 'object', properties: ENTRY_PROPS, description: 'only the fields that change; empty object when hasFix is false' },
  },
  required: ['refuted', 'reason', 'hasFix', 'fixed'],
}
const SCRIBE_SCHEMA = { type: 'object', properties: { path: { type: 'string' }, count: { type: 'integer' } }, required: ['path', 'count'] }

// ---------- shared text ----------
const SITE = `How Things Work (https://guillem.github.io/how-things-work/) is a static site of interactive, animated explainers: one page per topic, built around one interactive graphic driven by a real model (the real equations, algorithm or data), drawn as SVG in the browser as a pure function of time, with no backend. Its catalogue, docs/TOPICS.md in the working directory, defines the 100 topics that exist today in 11 categories (ids: ${CAT_IDS.join(', ')}). The project is now choosing the next 100 topics.`

const LEVELS = `Reader levels. The catalogue has three: 1 = high school; 2 = final year of high school or first year of university; 3 = university student in the field (the model is the real one, and the page may assume the level-1 and level-2 topics it lists as prerequisites). A new level 0 is being added: a curious beginner, primary or middle school (about ages 9 to 13: NGSS grades 3 to 8, England KS2 and KS3) or an adult with no science background. A level-0 page uses no formulas and treats numbers only as counts and comparisons, offers one control at a time, is shorter (6 to 9 steps), starts from an object or an experience the reader already knows, and its toy is the takeaway. A level-0 topic may have only level-0 prerequisites (usually none) and instead names, in leadsTo, the existing level-1 topics it prepares the reader for. Today's split is 38 topics at level 1, 56 at level 2 and 6 at level 3 (level 3 exists only in physics, space, computing and ai), so the new 100 are to be mostly level 0 and level 3, with about ten at level 1 and almost none at level 2.`

const RULES = `Rules for a candidate:
- One interactive graphic that can be built as a real model that runs in the browser at interactive rates: a small ODE or PDE on a grid, an agent or particle simulation, an algorithm, a geometric construction, a small shipped dataset, or a tiny trained model (the existing pages do this: black-holes integrates geodesics, states-of-matter runs a 2D molecular-dynamics box, diffusion-models ships a tiny MNIST model, deep-time scrubs a real dataset). Not a picture to tap, not a browse-a-diagram, not a topic whose honest model is a cluster job.
- Never invent data: if the page needs real data (spectra, element data, a trained model, structures, historical records), name the source and whether it is openly licensed (CC BY, CC0, public domain, MIT, government open data). A candidate whose data is not openly available is weak; say so.
- The takeaway must be observable in the graphic without reading the text.
- No duplicate of an existing topic: read the catalogue entries of the categories you work in and the checklist of all 100 slugs, and for every candidate fill overlapWith with the nearest existing slug and one sentence on how the new page differs. A topic that an existing page already shows (seasons, phases, eclipses and tides are in sun-earth-moon; rainbows and lenses in light-optics; herd immunity in epidemics; the water cycle is NOT covered) must be narrowed to something new or dropped.
- Prerequisites may be existing slugs or slugs you propose in this batch, never above the candidate's own level. Related links will be made mutual later; list the ones you see.
- Ground each candidate in one signal with a URL: a curriculum standard (NGSS, KS2/KS3, GCSE, A-level, IB, AP, a university course syllabus, MIT OCW) or demand (the PhET simulation list, Bartosz Ciechanowski's explainers, 3Blue1Brown, Kurzgesagt, Veritasium, Explain Like I'm Five, Wikipedia page views, Google 'how does X work' questions). Use web search for this: load it with ToolSearch (query "select:WebSearch") and run at least five searches before you answer.
- Write in the catalogue's voice (study the existing entries): Interaction says what the reader does and what responds, in two or three sentences; Takeaway is one sentence; Pitfall is a misconception the page must not repeat; Needs names data with its source and licence.
- Slugs: lowercase words joined by hyphens, specific, not already in the catalogue.`

function genPrompt(lens) {
  return `${SITE}

${LEVELS}

${RULES}

Your lens: ${lens.brief}

Read docs/TOPICS.md first: everything above the "Checklist" heading, the checklist itself, the entries of the categories ${lens.cats.map(c => CAT_NAME[c] + ' (' + c + ')').join(', ')}, and the "Reserve" section at the end. Then research with web search, then propose ${lens.count} candidates that fit this lens, all honest at the level or levels stated (${lens.levels}). Vary the kinds (manipulate, simulate, step, build, explore) and cover the breadth of the lens; the seeds listed are starting points, not a limit, and some of them may turn out to overlap existing pages: narrow or drop those. Return the candidates as structured output only.`
}

const LENSES = [
  { key: 'home-mechanisms', cats: ['energy', 'physics'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, household and everyday mechanisms, categories energy (Energy & Machines) and physics. Seeds: toilet flush and siphons, refrigerator and freezer, zipper, lock and key, bicycle gears and balance, scissors and levers, pulleys and cranes, screws and ramps, springs, thermostat, kettle, toaster, microwave oven, vacuum cleaner, washing machine, ballpoint pen, hook-and-loop fastener, door closer, elevator, escalator, car brakes, seatbelt and airbag, umbrella, clock escapement, wind-up toys, water taps and pipes, hair dryer, pressure cooker, can opener. Each page is a real mechanism the reader can operate (drag the handle, turn the gear, open the valve) and a model that responds (torque, flow, pressure, heat).' },
  { key: 'everyday-technology', cats: ['computing', 'networks', 'ai', 'physics'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, everyday technology, categories computing, networks (Information & Networks), ai and physics. Seeds: screens and pixels, touchscreens, digital cameras, QR codes and barcodes, headphones and loudspeakers, microphones, remote controls, how a text message or phone call travels (the existing internet topic is level 1: stay at the everyday layer or narrow), keyboards, LEDs and light bulbs, e-readers, voice assistants, autocomplete and spell-check, spam filters, recommendations, face unlock, passwords, emoji and text (binary exists at level 1), noise cancelling, fingerprint sensors, contactless cards, smoke detectors, metal detectors, traffic lights, elevators that choose a floor, calculators, digital clocks, radio.' },
  { key: 'basic-physical-science', cats: ['physics', 'chemistry'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, basic physical science from everyday experience, categories physics and chemistry. Seeds: magnets, static electricity, floating and sinking, air pressure and straws, shadows and light, why the sky is blue and sunsets red, sound and vibration (waves-interference is level 1), echoes, heat and insulation, friction, gravity and falling, balance and centre of mass, mirrors, colour mixing (vision-color is level 1), temperature and thermometers, pressure in liquids and hydraulics, inertia, energy in a bouncing ball, why hot things glow, evaporation and drying, why ice is slippery, how a straw and a syringe work, why boats float, why a spinning top stays up, pendulums and swings (oscillations-resonance is level 1: narrow).' },
  { key: 'living-things-and-body', cats: ['biology', 'medicine'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, living things and the body, categories biology and medicine (Body & Medicine). Seeds: digestion, breathing and lungs, bones, muscles and joints, teeth, skin and healing, hearing and the ear, smell and taste, sleep, seeds and germination, how plants drink, how birds fly, how fish breathe, eggs and chicks, food chains (ecosystems is level 1), germs and hand washing, fever, blood and bruises, hunger and fullness, allergies, why shots protect you (mrna-vaccines is level 2), growing, heartbeat and pulse (heart-circulation is level 1: narrow), reflexes, why we shiver and sweat, how a caterpillar becomes a butterfly, why leaves change colour, how trees grow rings, why we yawn, how cuts stop bleeding, how a bone heals.' },
  { key: 'earth-sky-weather', cats: ['earth', 'space'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, earth, sky and weather, categories earth (Earth & Climate) and space. Seeds: rain, clouds and the water cycle, wind, thunder and lightning, snow and hail, rivers and erosion, soil, why the sea is salty, rocks and fossils, why stars twinkle, the scale of the solar system, comet tails, why it is colder on mountains, caves, glaciers, deserts, the Sun as a star, how far away things in space are, why the sky is dark at night, what the Moon is made of, meteors and shooting stars, auroras, why Earth is round, day and night and time zones, the compass and the magnetic poles, fog and dew, where sand comes from, waves at the beach, how a volcano erupts (plate-tectonics is level 1: narrow), tornadoes. Avoid seasons, phases, eclipses and tides (sun-earth-moon has them) unless narrowed to something new.' },
  { key: 'chemistry-and-cooking', cats: ['chemistry', 'biology'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, chemistry in the kitchen and at home, categories chemistry (Chemistry & Materials) and biology. Seeds: dissolving, mixtures and separating, baking and leavening, rust, fire and what it needs, soap and washing, crystals, fizz and carbonation, cooking an egg, bread and yeast, why onions make you cry, density (states-of-matter is level 1), candles, glue, paints and dyes, salt on icy roads, browning (Maillard), caramel, popcorn, vinegar and baking soda, why metal feels cold, lemon batteries (redox-batteries is level 2), why apples brown, chewing gum, ice cream, why oil and water do not mix, how a sponge holds water, bubbles and foam, why bread goes stale, how a fridge keeps food fresh (spoilage).' },
  { key: 'numbers-shapes-computers', cats: ['math', 'computing'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, numbers, shapes and how computers think, categories math and computing. Seeds: symmetry and tessellations, probability with dice and coins, big numbers and scale (powers of ten), fractions, ratios and scaling a recipe, angles, triangles and why they are stiff (bridges-structures is level 1), maps, coordinates and scale, averages and graphs, estimation, patterns and sequences, pixels and images, how a computer follows instructions (an algorithm as a recipe), solving a maze (graph-search is level 1), secret codes (cryptography is level 2), randomness and fairness, infinity, how a calculator adds (logic-gates is level 1), negative numbers, percentages, speed as distance over time, number bases (binary is level 1), the golden ratio and spirals, how a computer stores a picture, loops and repetition, sorting a bookshelf (sorting is level 1: narrow), how a search finds a word, circles and pi, area and volume, why there are 360 degrees.' },
  { key: 'vehicles-and-big-machines', cats: ['energy', 'physics', 'space', 'earth'], levels: 'level 0', count: '26 to 30', brief: 'LEVEL 0, vehicles, big machines and where energy comes from, categories energy, physics, space and earth. Seeds: cars (engine, brakes, steering, tyres), trains and rails, ships and buoyancy, submarines, hot-air balloons, parachutes, kites, sails and sailing upwind, roller coasters, wind turbines, dams and water wheels, solar panels at the everyday layer (solar-cells is level 2), where the electricity at the socket comes from (power-grid is level 2), light bulbs, batteries at the everyday layer, fireworks, how a plane stays up at the everyday layer (flight is level 2: narrow), how a rocket goes up at the everyday layer (rockets is level 2: narrow), helicopters, cranes and counterweights, bulldozers and hydraulics, bicycles, skateboards, ice skates, playground swings and seesaws, tunnels, skyscrapers, lighthouses, satellites.' },
  { key: 'math-l3', cats: ['math'], levels: 'level 3, with up to three at level 1 or 2 only where honest', count: '26 to 30', brief: 'LEVEL 3 mathematics, category math, which has no level-3 topic today. Seeds: differential equations and phase portraits, group theory and symmetry, topology, Markov chains, optimization and convexity, information theory, game theory, the heat and wave equations, random walks and Brownian motion, graph theory and networks, numerical methods and stability, SVD and eigendecompositions, sampling and the Nyquist theorem, hypothesis testing and regression, Monte Carlo methods, knot theory, number theory beyond primes, calculus of variations, Taylor series and approximation, vector calculus (div, grad, curl), generating functions, elliptic curves, measure and probability spaces, Galois theory, the Riemann zeta function and prime counting, fixed points and iteration, linear programming, conic sections and projective geometry, exponentials and logarithms (a Reserve item; honest level 1), cellular automata (a Reserve item). Dispose of the Reserve items that are mathematics (Exponentials & logarithms, Differential equations, Game theory, Cellular automata) explicitly in reserveDisposition.' },
  { key: 'physics-l3', cats: ['physics'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 physics, category physics (which has one level-3 topic, quantum-mechanics). Seeds: Lagrangian and Hamiltonian mechanics, Maxwell\'s equations, statistical mechanics and the partition function, the Ising model and phase transitions, general relativity, quantum field theory and Feynman diagrams, superconductivity, lasers (a Reserve item: Lasers & LEDs), fluid dynamics, Navier-Stokes and turbulence (a Reserve item), plasma physics, quantum statistics and Bose-Einstein condensates, Noether\'s theorem, entanglement and Bell\'s theorem, spin and the Stern-Gerlach experiment, the Schrödinger equation and the hydrogen atom, scattering, solitons, nonlinear dynamics and bifurcations, diffraction and crystallography, Brownian motion, acoustics and room modes, the photoelectric effect and blackbody radiation, the Dirac equation, renormalization, the Casimir effect, magnetohydrodynamics, the quantum harmonic oscillator, perturbation theory. Dispose of the Reserve items Fluid dynamics and Lasers & LEDs explicitly in reserveDisposition.' },
  { key: 'chemistry-l3', cats: ['chemistry'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 chemistry and materials, category chemistry, which has no level-3 topic today. Seeds: molecular orbital theory, spectroscopy (IR, UV-vis, NMR), Gibbs free energy and spontaneity, electrochemistry and the Nernst equation, crystallography and X-ray diffraction, transition state theory, enzyme and surface catalysis, polymer physics and rubber elasticity, liquid crystals, glasses and the glass transition, superconductors, nanomaterials and quantum dots, chromatography, mass spectrometry, alloys, dislocations and metallurgy, corrosion, quantum chemistry (Hartree-Fock), intermolecular forces, colloids and surfactants, reaction mechanisms (SN1/SN2), photochemistry, phase diagrams of mixtures, ceramics and composites, fracture mechanics, diffusion in solids, osmosis and membranes, supercritical fluids, isotope effects, Raman scattering.' },
  { key: 'biology-l3', cats: ['biology'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 biology, category biology, which has no level-3 topic today. Seeds: gene regulation and the lac operon, population genetics (Hardy-Weinberg, drift, selection coefficients), phylogenetics and tree building, morphogen gradients and Turing patterns (a Reserve item: Embryo development & pattern formation), circadian clocks, Michaelis-Menten enzyme kinetics, metabolic networks and flux, epigenetics, origin of life and the RNA world, synaptic plasticity and Hebbian learning, cell signalling cascades, DNA sequencing and PCR (a Reserve item), the microbiome, cell cycle control, apoptosis, membrane transport and the Nernst potential, viral replication, evolutionary game theory, speciation, central pattern generators, bacterial chemotaxis, quorum sensing, kin selection, coalescent theory, molecular motors (kinesin), the genetic code\'s error tolerance, ageing and telomeres, C4 and CAM photosynthesis, nitrogen fixation. Dispose of the Reserve items Embryo development & pattern formation and DNA sequencing explicitly in reserveDisposition.' },
  { key: 'medicine-l3', cats: ['medicine'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 body and medicine, category medicine (Body & Medicine), which has no level-3 topic today. Seeds: pharmacokinetics and dosing, anaesthesia, the kidney, the nephron and dialysis, ECG interpretation and arrhythmia, clinical trials and their statistics, GWAS and the genetics of disease, antibiotics and resistance evolution, pain and its pathways, hearing and the cochlea (a Reserve item), the lungs and gas exchange, blood clotting cascade, autoimmunity, allergy and IgE, the placebo effect, cancer immunotherapy, closed-loop insulin pumps, the placenta, bone remodelling, the liver and drug metabolism, wound healing, memory and the hippocampus, ageing, blood pressure regulation (baroreflex), the eye\'s optics and refractive surgery, sepsis, oxygen transport and haemoglobin\'s binding curve, acid-base balance of blood, the menstrual cycle\'s hormone loops, anaphylaxis, the cerebellum and motor learning. Dispose of the Reserve item Hearing & the cochlea explicitly in reserveDisposition.' },
  { key: 'earth-space-l3', cats: ['earth', 'space'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 earth, climate and space, categories earth (no level-3 topic today) and space (one: gravitational-waves). Seeds: the geodynamo and Earth\'s magnetic field, mantle convection, radiative transfer and climate models, isotope geochemistry and dating, hurricanes and tropical cyclones, glacier flow, seismic tomography, tides in depth, stellar nucleosynthesis, the cosmic microwave background power spectrum and inflation, supernovae, neutron stars and pulsars, galaxy formation and dynamics, the cosmic distance ladder, telescopes and interferometry (a Reserve item), gravity assists and Lagrange points, dark energy, the three-body problem, tidal locking and orbital resonances, planetary atmospheres and escape, the carbon-silicate cycle, sea-level rise, river meanders, groundwater and aquifers, monsoons, jet streams and Rossby waves, ocean acidification, radiocarbon calibration, stellar spectra and classification, the Drake equation and habitability, cosmic rays. Dispose of the Reserve item Telescopes explicitly in reserveDisposition.' },
  { key: 'computing-networks-l3', cats: ['computing', 'networks'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 computing and information, categories computing (two level-3 topics today: turing-machines, quantum-computing) and networks (none). Seeds: compilers (a Reserve item), operating systems and scheduling (a Reserve item), caches and the memory hierarchy, virtual memory, databases (B-trees, transactions), hash tables and Bloom filters, concurrency, locks and deadlock, P vs NP and SAT solving, automata and regular expressions, floating point, garbage collection, lambda calculus and type systems, pseudo-random numbers, TCP congestion control, DNS, TLS handshakes, zero-knowledge proofs, elliptic-curve cryptography, radar and sonar, fibre optics, MIMO and 5G, antennas, the Kalman filter, channel capacity and Shannon\'s theorem, onion routing, CDNs and caching, email and spam, video codecs, audio codecs, version control and Merkle trees, distributed hash tables, cellular automata (a Reserve item; honest level?), the Fast Fourier Transform as an algorithm, dynamic programming, public-key infrastructure, the sampling theorem. Dispose of the Reserve items Operating systems, Compilers and Cellular automata explicitly in reserveDisposition.' },
  { key: 'ai-l3', cats: ['ai'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 artificial intelligence, category ai (two level-3 topics today: transformers, diffusion-models). Seeds: GANs, variational autoencoders, RLHF and alignment, mixture of experts, tokenization, retrieval-augmented generation, decision trees and gradient boosting, SVMs and kernels, clustering and dimensionality reduction (a Reserve item), Bayesian inference and MCMC, Gaussian processes, graph neural networks, speech recognition, recommender systems and collaborative filtering, evolutionary algorithms, overfitting, regularization and double descent, scaling laws, interpretability and probing, normalizing flows, optimizers (momentum, Adam), batch norm and dropout, autoencoders, model-based RL and world models, Monte Carlo tree search and AlphaGo, recurrent networks and LSTMs, contrastive and self-supervised learning, adversarial examples, federated learning and differential privacy, neural ODEs, the bias-variance trade-off, active learning, uncertainty calibration, the perceptron and linear separability. Dispose of the Reserve item Clustering & dimensionality reduction explicitly in reserveDisposition.' },
  { key: 'energy-machines-l3', cats: ['energy'], levels: 'level 3', count: '26 to 30', brief: 'LEVEL 3 energy and machines, category energy (Energy & Machines), which has no level-3 topic today. Seeds: steam and gas turbines, jet engines, wind turbines and the Betz limit, hydroelectric power, heat pumps and refrigeration (a Reserve item), internal combustion engines, electric vehicle drivetrains and charging, electrical transformers and HVDC, hydrogen and fuel cells, grid-scale storage, geothermal power, desalination, 3D printing, robot kinematics, gears and mechanical advantage, hydraulics, superconducting magnets, nuclear waste and decay heat, carbon capture, elevators and counterweights, ship stability, submarines and buoyancy control, ABS brakes, maglev trains, bicycle stability, mechanical clocks, locks, cooling of chips, tribology and lubrication, the Carnot limit of real plants, combined-cycle plants, district heating, thermoelectrics, flywheels, supercapacitors, pumped hydro, batteries\' degradation. Dispose of the Reserve item Heat pumps explicitly in reserveDisposition.' },
  { key: 'demand', cats: CAT_IDS, levels: 'the honest level of each (any of 0 to 3), favouring 0 and 3', count: '26 to 30', brief: 'DEMAND. Find the most-asked "how does X work" questions and the most popular explainer subjects that the catalogue does not cover, at any level. Search: the PhET simulation list, Bartosz Ciechanowski\'s explainers, 3Blue1Brown and Veritasium video lists, Kurzgesagt topics, the most popular Explain Like I\'m Five posts, Wikipedia\'s most-viewed science and technology articles, Google autocomplete for "how does ... work" and "why does ...", popular science books\' tables of contents, the Reserve section of the catalogue. Propose the strongest uncovered subjects at their honest level, across all categories.' },
  { key: 'holes-l1-l2', cats: CAT_IDS, levels: 'level 1 or 2 (ten slots at level 1 and three at level 2 are available; propose level-1 ones first)', count: '26 to 30', brief: 'HOLES at levels 1 and 2. Given the 100 existing topics, which conspicuous high-school and first-year subjects are missing? Check against GCSE, A-level, IB and AP syllabi and against a first-year university core. Seeds: fluid pressure and buoyancy, magnetism as its own page, momentum and collisions (check newtons-laws), gas laws, thermodynamics of heat transfer (conduction, convection, radiation), electricity at home (AC, transformers, safety), sound and hearing, exponentials and logarithms (Reserve), vectors and projectiles (check newtons-laws), telescopes (Reserve), differential equations (Reserve; honest level?), game theory (Reserve), cellular automata (Reserve), DNA sequencing (Reserve), embryo development (Reserve), heat pumps (Reserve), lasers and LEDs (Reserve), clustering (Reserve), the nervous system and senses, the digestive system, plant transport and transpiration, the nitrogen cycle, soil and agriculture, the rock cycle, the water cycle, weather fronts (check atmosphere-weather), electrolysis, moles and stoichiometry, the mole and gases, enzymes, osmosis and diffusion, the kidney, the lungs, muscles, the skeleton, hormones (check homeostasis), the Doppler effect (check waves-interference), nuclear binding energy (check nuclear-fission), the photoelectric effect, probability trees and combinatorics, statistics (mean, spread, correlation), sequences and series, similar triangles and scale, the Pythagorean theorem, coordinate geometry, functions and graphs, inequalities and linear programming, recursion, databases, the file system, networks basics (check internet), HTML and how a web page renders, how a spreadsheet works, how a simulation works. Also go through all 14 Reserve items and decide each one in reserveDisposition (promote at which level and as which slug, or drop with a reason); propose full entries for the ones you promote.' },
]

// ---------- helpers ----------
function compact(e) { return `${e.slug} | L${e.level} | ${e.category} | ${e.kind} | ${e.title} | ${e.takeaway}` }
function compactShort(e) { return `${e.slug} (L${e.level}, ${e.category}): ${e.title}` }
function entryText(e) {
  return `slug: ${e.slug}
title: ${e.title}
level: ${e.level}
kind: ${e.kind}
category: ${e.category}
interaction: ${e.interaction}
takeaway: ${e.takeaway}
prerequisites: ${(e.prerequisites || []).join(', ') || 'none'}
related: ${(e.related || []).join(', ') || 'none'}
needs: ${e.needs || 'none'}
pitfall: ${e.pitfall || 'none'}
why: ${e.why}
overlapWith: ${e.overlapWith}
needsSource: ${e.needsSource}
leadsTo: ${(e.leadsTo || []).join(', ') || 'none'}
everyday: ${e.everyday}`
}
function normSlug(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function cleanEntry(e, origin) {
  const c = { ...e }
  c.slug = normSlug(c.slug)
  c.level = Math.max(0, Math.min(3, Math.round(Number(c.level))))
  if (!KINDS.includes(c.kind)) c.kind = 'manipulate'
  if (!CAT_IDS.includes(c.category)) c.category = CAT_IDS[0]
  c.prerequisites = (c.prerequisites || []).map(normSlug).filter(Boolean)
  c.related = (c.related || []).map(normSlug).filter(Boolean)
  c.leadsTo = (c.leadsTo || []).map(normSlug).filter(Boolean)
  c.needs = c.needs || ''
  c.pitfall = c.pitfall || ''
  c.origin = origin
  return c
}
function applyFix(entry, fixed) {
  const out = { ...entry }
  for (const k of Object.keys(fixed || {})) {
    const v = fixed[k]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '' && !['needs', 'pitfall'].includes(k)) continue
    out[k] = v
  }
  const c = cleanEntry(out, entry.origin)
  if (c.slug !== entry.slug && (EX[c.slug])) c.slug = entry.slug
  c.score = entry.score
  c.scores = entry.scores
  c.fixLog = [...(entry.fixLog || []), ...(Object.keys(fixed || {}).length ? [Object.keys(fixed).join(',')] : [])]
  return c
}

// ======================================================================
phase('Generate')
log(`Generating candidates through ${LENSES.length} lenses`)
const genResults = await parallel(LENSES.map(l => () =>
  agent(genPrompt(l), { label: `gen:${l.key}`, phase: 'Generate', schema: CANDIDATES_SCHEMA })
    .then(r => ({ lens: l.key, result: r }))))

let pool = []
const reserveDispositions = []
const seenSlugs = new Set()
let dupSlugDropped = 0
for (const g of genResults.filter(Boolean)) {
  if (!g.result) { log(`lens ${g.lens} returned nothing`); continue }
  for (const d of g.result.reserveDisposition || []) reserveDispositions.push({ ...d, lens: g.lens })
  for (const raw of g.result.candidates || []) {
    const e = cleanEntry(raw, g.lens)
    if (!e.slug || EX[e.slug]) { dupSlugDropped++; continue }
    if (seenSlugs.has(e.slug)) { dupSlugDropped++; continue }
    seenSlugs.add(e.slug)
    pool.push(e)
  }
}
log(`${pool.length} candidates after exact-slug dedupe (${dupSlugDropped} dropped as exact duplicates of existing or earlier slugs)`)

// ======================================================================
phase('Merge')
const byCat = {}
for (const e of pool) (byCat[e.category] = byCat[e.category] || []).push(e)
const mergeResults = await parallel(CAT_IDS.filter(c => (byCat[c] || []).length > 1).map(cat => () =>
  agent(`${SITE}

You are deduplicating candidate topics for the category ${CAT_NAME[cat]} (${cat}). Below are ${byCat[cat].length} candidates (slug | level | category | kind | title | takeaway), gathered by several independent researchers, so some are the same subject under different names, and some may duplicate an existing catalogue topic.

Read docs/TOPICS.md: the entries of this category and the checklist of all 100 slugs. Then:
1. groups: cluster candidates that are substantially the same page (same mechanism, same takeaway) or that would overlap so much that only one should be built. For each group name the one to keep (the better scoped and better levelled one) and the ones to drop. Two candidates at different levels on the same subject (a level-0 and a level-3 page) are NOT duplicates; keep both. Different mechanisms that share a word are not duplicates.
2. duplicatesOfExisting: candidates that an existing catalogue page already covers (same mechanism and takeaway), with the existing slug. Be strict about mechanisms, not words: an existing level-1 page and a new level-0 page on a neighbouring everyday experience can coexist if the new page shows something the existing one does not.

Candidates:
${byCat[cat].map(compact).join('\n')}`, { label: `merge:${cat}`, phase: 'Merge', schema: MERGE_SCHEMA })))

const dropped = new Map()
for (const m of mergeResults.filter(Boolean)) {
  for (const g of m.groups || []) for (const d of g.drop || []) if (normSlug(d) !== normSlug(g.keep)) dropped.set(normSlug(d), `merged into ${g.keep}: ${g.reason}`)
  for (const d of m.duplicatesOfExisting || []) dropped.set(normSlug(d.slug), `duplicate of existing ${d.existing}: ${d.reason}`)
}
const mergedOut = pool.filter(e => dropped.has(e.slug)).map(e => ({ slug: e.slug, why: dropped.get(e.slug) }))
pool = pool.filter(e => !dropped.has(e.slug))
log(`${pool.length} candidates after merge (${mergedOut.length} dropped as near-duplicates)`)

// ======================================================================
phase('Judge')
const BATCH = 20
const batches = []
const shuffled = [...pool].sort((a, b) => (a.slug < b.slug ? -1 : 1))
for (let i = 0; i < shuffled.length; i += BATCH) batches.push(shuffled.slice(i, i + BATCH))
log(`Judging ${pool.length} candidates in ${batches.length} batches of up to ${BATCH}, three lenses each`)

const JUDGES = [
  { key: 'fit', prompt: (list) => `${SITE}

${LEVELS}

Judge lens: FIT AND DEMAND. For each candidate below, would a visitor of this site want this page, and is it a genuine "how it works" subject with a mechanism the graphic can show (not a survey, a definition, or a list of facts)? Is the takeaway concrete and the interaction specific? Does the why field cite a real curriculum or demand signal (you may check one or two with web search: load WebSearch with ToolSearch "select:WebSearch")? Score 1 (weak) to 5 (must-have). reject=true only for a subject without a mechanism, a vague survey, or one that misreads the site. Set suggestedLevel to the candidate's own level unless you are sure it is wrong.

Candidates:
${list}` },
  { key: 'build', prompt: (list) => `${SITE}

${RULES}

Judge lens: BUILDABILITY AND DATA. For each candidate below, can the interaction be built as a real client-side model in SVG as a pure function of time, running at interactive rates (a small ODE or PDE, an agent or particle simulation, an algorithm, a geometric construction, a small dataset or a tiny model)? Is the proposed model the honest one for the stated level, or a picture dressed as a model? If it needs data or a trained model, is that openly licensed and available (check with web search when the entry names a source: load WebSearch with ToolSearch "select:WebSearch")? Score 1 (not buildable as described) to 5 (clear, small, honest model). reject=true if the honest model cannot run interactively in a browser, if the page would be a browse-a-diagram or a picture to tap, or if the needed data is unavailable or not openly licensed. Set suggestedLevel to the candidate's own level unless the model you would have to build is clearly a different level.

Candidates:
${list}` },
  { key: 'level', prompt: (list) => `${SITE}

${LEVELS}

Judge lens: LEVEL AND DISTINCTNESS. Read docs/TOPICS.md: the levels table, the checklist, and the entries of the categories of the candidates below and of each candidate's overlapWith slug. For each candidate: is the level honest (a level-0 page needs no formulas and works for a 10-year-old; a level-3 page is what a university student in the field would learn, with the real model)? Does it overlap substantially with an existing topic (the existing page already shows this mechanism and takeaway) or with another candidate in this batch? Score 1 (duplicate or mis-levelled) to 5 (clearly new and honestly levelled). reject=true for a substantial duplicate of an existing page. Set suggestedLevel to the level you judge honest (it may equal the candidate's).

Candidates:
${list}` },
]

const judgeRuns = await pipeline(batches,
  (batch, _item, i) => {
    const list = batch.map(entryText).join('\n\n---\n\n')
    return parallel(JUDGES.map(j => () =>
      agent(j.prompt(list), { label: `judge:${j.key}:b${i + 1}`, phase: 'Judge', schema: JUDGE_SCHEMA })
        .then(r => ({ lens: j.key, verdicts: r ? r.verdicts : null }))))
  })

const verdictsBySlug = {}
for (const run of judgeRuns.filter(Boolean)) {
  for (const r of run.filter(Boolean)) {
    if (!r.verdicts) { log(`judge ${r.lens} returned nothing for a batch`); continue }
    for (const v of r.verdicts) {
      const s = normSlug(v.slug)
      ;(verdictsBySlug[s] = verdictsBySlug[s] || []).push({ ...v, lens: r.lens })
    }
  }
}
let unjudged = 0
for (const e of pool) {
  const vs = verdictsBySlug[e.slug] || []
  if (vs.length === 0) unjudged++
  e.scores = {}
  for (const v of vs) e.scores[v.lens] = v.score
  const got = Object.keys(e.scores).length
  const sum = Object.values(e.scores).reduce((a, b) => a + b, 0)
  e.score = got ? (sum / got) * 3 : 0
  e.rejected = vs.some(v => v.reject)
  e.rejectReasons = vs.filter(v => v.reject).map(v => `${v.lens}: ${v.reason}`)
  e.judgeNotes = vs.map(v => `${v.lens} ${v.score}: ${v.reason}`)
  const lv = vs.find(v => v.lens === 'level')
  if (lv && lv.suggestedLevel !== e.level && !lv.reject) { e.originalLevel = e.level; e.level = lv.suggestedLevel }
}
if (unjudged) log(`${unjudged} candidates received no verdict (scored 0)`)
const rejectedCount = pool.filter(e => e.rejected).length
log(`${rejectedCount} candidates rejected by at least one judge; ${pool.length - rejectedCount} remain eligible`)
const relevelled = pool.filter(e => e.originalLevel !== undefined).length
if (relevelled) log(`${relevelled} candidates re-levelled on the level judge's advice`)

// ======================================================================
phase('Select')
const eligible = pool.filter(e => !e.rejected && e.score > 0)
const byScore = [...eligible].sort((a, b) => b.score - a.score)
const levelCounts = (list) => list.reduce((a, e) => { a[e.level] = (a[e.level] || 0) + 1; return a }, {})
log(`Eligible by level: ${JSON.stringify(levelCounts(eligible))}`)

function selectByQuota() {
  const chosen = []
  const chosenSlugs = new Set()
  const catCount = {}
  const levelCount = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const take = (c) => { chosen.push(c); chosenSlugs.add(c.slug); catCount[c.category] = (catCount[c.category] || 0) + 1; levelCount[c.level]++ }
  for (const [level, targets] of [[3, L3_TARGET], [0, L0_TARGET]]) {
    for (const cat of CAT_IDS) {
      const want = targets[cat] || 0
      const cell = byScore.filter(c => c.level === level && c.category === cat && !chosenSlugs.has(c.slug))
      if (cell.length < want) log(`cell L${level}/${cat}: only ${cell.length} eligible candidates for a target of ${want}`)
      cell.slice(0, want).forEach(take)
    }
  }
  for (const level of [0, 3, 1, 2]) {
    for (const c of byScore) {
      if (levelCount[level] >= QUOTA[level]) break
      if (c.level !== level || chosenSlugs.has(c.slug)) continue
      if ((catCount[c.category] || 0) >= CAT_MAX) continue
      take(c)
    }
    if (levelCount[level] < QUOTA[level]) log(`level ${level}: ${levelCount[level]} of ${QUOTA[level]} slots filled`)
  }
  return chosen
}
let selected = selectByQuota()
let selectedSet = new Set(selected.map(e => e.slug))
let runnersUp = byScore.filter(e => !selectedSet.has(e.slug))
log(`Selected ${selected.length} by quota; ${runnersUp.length} runners-up`)

const curator = await agent(`${SITE}

${LEVELS}

You are the curator. A quota selection picked the 100 new topics below from a scored pool (targets: 45 at level 0, 10 at level 1, 3 at level 2, 42 at level 3; level 3 spread to the categories that have none today; at most ${CAT_MAX} new topics per category). Review the selection as a whole against the existing catalogue (read docs/TOPICS.md's checklist and skim its entries) and against the runners-up, and propose up to 12 swaps, each replacing a selected topic with a runner-up AT THE SAME LEVEL, to fix: two selected topics that overlap in spirit; a famous subject left out while a weaker cousin is in; a category whose selection is lopsided (all one kind, or all one sub-area); a prerequisite chain that would be broken (a selected topic whose proposed prerequisite is not selected and not existing); a level-0 selection that drifts away from everyday experience; a level-3 selection that is not what a student in the field actually studies. Also list pairs within the selection that overlap (overlaps) even if you have no swap for them. Prefer the runners-up with higher scores; do not swap just to swap. Explain each swap in one sentence.

SELECTED (slug | level | category | kind | title | takeaway):
${selected.map(compact).join('\n')}

RUNNERS-UP (same format; the first ${Math.min(90, runnersUp.length)} by score):
${runnersUp.slice(0, 90).map(compact).join('\n')}

EXISTING CATALOGUE (slug (level, category): title):
${EXISTING.map(compactShort).join('\n')}`, { label: 'curator', phase: 'Select', schema: CURATOR_SCHEMA })

const curatorSwaps = []
if (curator) {
  for (const s of curator.swaps || []) {
    const out = selected.find(e => e.slug === normSlug(s.out))
    const inn = runnersUp.find(e => e.slug === normSlug(s.in))
    if (!out || !inn) { log(`curator swap ignored (unknown slug): ${s.out} -> ${s.in}`); continue }
    if (out.level !== inn.level) { log(`curator swap ignored (level differs): ${s.out} (L${out.level}) -> ${s.in} (L${inn.level})`); continue }
    selected = selected.filter(e => e.slug !== out.slug)
    selected.push(inn)
    runnersUp = runnersUp.filter(e => e.slug !== inn.slug)
    runnersUp.push(out)
    curatorSwaps.push({ out: out.slug, in: inn.slug, reason: s.reason })
  }
  log(`Curator: ${curatorSwaps.length} swaps applied; ${(curator.overlaps || []).length} overlaps flagged`)
}
selectedSet = new Set(selected.map(e => e.slug))

// ======================================================================
phase('Verify')
function r1Prompt(e) {
  return `${SITE}

${LEVELS}

You are a sceptical reviewer. Try to REFUTE this proposed topic on two grounds: (1) it substantially duplicates an existing catalogue page (the existing page already shows this mechanism and this takeaway), or (2) its level is dishonest (a level-0 page that needs formulas or abstractions a 10-year-old lacks; a level-3 page that is really high-school material or that no university course in the field covers; a level-1 page that is really level 2 or 3). Read docs/TOPICS.md: the levels table, the checklist, the entries of the category ${CAT_NAME[e.category]} and the entry of the overlapWith slug (${e.overlapWith.split(/[\s:,]/)[0]}), and any entries the candidate names as prerequisites or related.

Decide:
- refuted=true, hasFix=false: the problem is real and no small change fixes it (the mechanism is already on the site, or the subject has no honest home at any level the site needs).
- refuted=true, hasFix=true: the problem is real but a small change fixes it: re-level it, narrow the interaction to what the existing page does not show, or fix the prerequisites (a prerequisite above the topic's own level is not allowed; a level-0 topic may only have level-0 prerequisites). Put only the changed fields in fixed.
- refuted=false: it is distinct and honestly levelled (you may still put small improvements in fixed with hasFix=true).
Default to refuted=true when in doubt about duplication.

The candidate:
${entryText(e)}`
}
function r2Prompt(e) {
  return `${SITE}

${RULES}

You are a sceptical engineer and fact-checker. Try to REFUTE this proposed topic on three grounds: (1) the interaction cannot be a real client-side model (SVG, a pure function of time, interactive rates): the honest model would be a cluster job, or the page would be a browse-a-diagram or a picture to tap, or the interaction as written cannot be driven by real equations, an algorithm or data; (2) the data or model it needs is not openly available: when the entry names a source, check its licence with web search (load WebSearch with ToolSearch "select:WebSearch"); when it needs data but names none, find an open source or refute; (3) the takeaway or pitfall is factually wrong or a known misconception, or the prerequisites are wrong for what the page must assume.

Decide:
- refuted=true, hasFix=false: the problem is real and no rewrite of the interaction, needs or takeaway fixes it.
- refuted=true, hasFix=true: fixable: rewrite the interaction to an honest buildable model, name the open data source and its licence in needs and needsSource, correct the takeaway or the prerequisites. Put only the changed fields in fixed.
- refuted=false: buildable and sound (small improvements welcome in fixed with hasFix=true).
Default to refuted=true if the honest model is out of reach for a browser page or the data question cannot be settled.

The candidate:
${entryText(e)}`
}
async function verify(e) {
  const r1 = await agent(r1Prompt(e), { label: `verify:overlap:${e.slug}`, phase: 'Verify', schema: VERDICT_SCHEMA })
  if (!r1) return { entry: e, ok: true, unverified: 'overlap check skipped' }
  if (r1.refuted && !r1.hasFix) return { entry: e, ok: false, reason: `overlap/level: ${r1.reason}` }
  let cur = r1.hasFix ? applyFix(e, r1.fixed) : e
  const r2 = await agent(r2Prompt(cur), { label: `verify:build:${cur.slug}`, phase: 'Verify', schema: VERDICT_SCHEMA })
  if (!r2) return { entry: cur, ok: true, unverified: 'build check skipped', notes: [r1.reason] }
  if (r2.refuted && !r2.hasFix) return { entry: cur, ok: false, reason: `buildability/data: ${r2.reason}` }
  cur = r2.hasFix ? applyFix(cur, r2.fixed) : cur
  cur.verifyNotes = [`overlap: ${r1.reason}`, `build: ${r2.reason}`]
  return { entry: cur, ok: true }
}
const tried = new Set(selected.map(e => e.slug))
const final = []
const rejectedInVerify = []
const unverified = []
function catCountsOf(list) { return list.reduce((a, e) => { a[e.category] = (a[e.category] || 0) + 1; return a }, {}) }
function pickReplacement(e, current) {
  const cc = catCountsOf(current)
  const cands = runnersUp.filter(c => !tried.has(c.slug) && c.level === e.level)
  return cands.find(c => c.category === e.category) || cands.find(c => (cc[c.category] || 0) < CAT_MAX) || null
}
let pending = [...selected]
let round = 0
while (pending.length) {
  round++
  log(`Verify round ${round}: ${pending.length} topics`)
  const results = await pipeline(pending, (e) => verify(e))
  const next = []
  for (let i = 0; i < pending.length; i++) {
    const r = results[i]
    if (!r) { final.push(pending[i]); unverified.push(pending[i].slug); continue }
    if (r.unverified) unverified.push(`${r.entry.slug}: ${r.unverified}`)
    if (r.ok) { final.push(r.entry); continue }
    rejectedInVerify.push({ slug: pending[i].slug, level: pending[i].level, category: pending[i].category, reason: r.reason })
    const rep = pickReplacement(pending[i], [...final, ...next])
    if (rep) { tried.add(rep.slug); next.push(rep); log(`replaced ${pending[i].slug} with ${rep.slug} (L${rep.level}/${rep.category})`) }
    else log(`no runner-up left for L${pending[i].level}/${pending[i].category}; one slot stays open`)
  }
  pending = next
  if (round > 6) { log('verify loop stopped after 6 rounds'); break }
}
log(`Verified ${final.length} topics; ${rejectedInVerify.length} rejected in verification; ${unverified.length} unverified notes`)

// ======================================================================
phase('Gaps')
const GAP_SCHEMA = { type: 'object', properties: { candidates: { type: 'array', items: ENTRY_SCHEMA }, missing: { type: 'string' } }, required: ['candidates', 'missing'] }
const CRITICS = [
  { key: 'l0', brief: 'You are a primary-school science teacher and a parent. Looking at the existing 100 and the proposed 100, which must-have level-0 subjects (the questions a 10-year-old actually asks, the NGSS 3-8 and KS2-3 core) are still missing?' },
  { key: 'l3', brief: 'You are a university lecturer who has taught across the sciences and engineering. Looking at the existing 100 and the proposed 100, which must-have level-3 subjects (the core of a degree in each field: the models every student in that field builds) are still missing, especially in the categories math, chemistry, biology, medicine, earth, networks and energy?' },
  { key: 'demand', brief: 'You are an editor who tracks what curious adults search for ("how does X work"). Looking at the existing 100 and the proposed 100, which famous, often-asked subjects are still missing at any level? Check with web search (load WebSearch with ToolSearch "select:WebSearch"): Google autocomplete for "how does", popular explainer channels and sites, the PhET list.' },
]
const gapRuns = await parallel(CRITICS.map(c => () =>
  agent(`${SITE}

${LEVELS}

${RULES}

${c.brief} Propose up to 6 new candidates as full entries (same fields as the catalogue plus why, overlapWith, needsSource, leadsTo, everyday), each distinct from everything listed below, and summarise in missing what you looked for and did not find. Do not re-propose anything in either list under another name.

EXISTING CATALOGUE:
${EXISTING.map(compactShort).join('\n')}

PROPOSED NEW TOPICS:
${final.map(compactShort).join('\n')}`, { label: `critic:${c.key}`, phase: 'Gaps', schema: GAP_SCHEMA })))

const finalSet = new Set(final.map(e => e.slug))
let gapCands = []
const criticNotes = []
for (const g of gapRuns.filter(Boolean)) {
  criticNotes.push(g.missing)
  for (const raw of g.candidates || []) {
    const e = cleanEntry(raw, 'gap')
    if (!e.slug || EX[e.slug] || finalSet.has(e.slug) || gapCands.some(x => x.slug === e.slug)) continue
    e.score = 15
    e.scores = { gap: 5 }
    gapCands.push(e)
  }
}
log(`Critics proposed ${gapCands.length} gap candidates`)
const gapVerified = await pipeline(gapCands, (e) => verify(e))
const gapSwaps = []
let swapsLeft = 10
for (let i = 0; i < gapCands.length; i++) {
  const r = gapVerified[i]
  if (!r || !r.ok) { if (r) log(`gap candidate ${gapCands[i].slug} refuted: ${r.reason}`); continue }
  if (swapsLeft <= 0) { log(`gap candidate ${r.entry.slug} verified but the swap budget is used up; kept as a runner-up`); runnersUp.unshift(r.entry); continue }
  const g = r.entry
  const victims = final.filter(e => e.level === g.level && e.origin !== 'gap').sort((a, b) => a.score - b.score)
  if (!victims.length) { log(`no swap slot at level ${g.level} for gap candidate ${g.slug}`); runnersUp.unshift(g); continue }
  const v = victims[0]
  final.splice(final.indexOf(v), 1)
  final.push(g)
  runnersUp.unshift(v)
  gapSwaps.push({ out: v.slug, in: g.slug, level: g.level })
  swapsLeft--
}
log(`Gap pass: ${gapSwaps.length} swaps`)

// ======================================================================
// invariants and back-links, in code
const levelOf = (s) => (EX[s] ? EX[s].level : (final.find(e => e.slug === s) || {}).level)
const issues = []
const backlinks = []
const finalSlugs = new Set(final.map(e => e.slug))
for (const e of final) {
  e.prerequisites = e.prerequisites.filter(p => {
    if (!EX[p] && !finalSlugs.has(p)) { issues.push(`${e.slug}: prerequisite ${p} is neither existing nor proposed; dropped`); return false }
    if (levelOf(p) > e.level) { issues.push(`${e.slug} (L${e.level}): prerequisite ${p} is level ${levelOf(p)}; dropped`); return false }
    return true
  })
  e.related = e.related.filter(r => {
    if (r === e.slug) return false
    if (!EX[r] && !finalSlugs.has(r)) { issues.push(`${e.slug}: related ${r} is neither existing nor proposed; dropped`); return false }
    if (e.prerequisites.includes(r)) return false
    return true
  })
  e.leadsTo = (e.leadsTo || []).filter(s => EX[s])
}
// mutual related within the proposal; back-links for existing targets
for (const e of final) {
  for (const r of e.related) {
    if (finalSlugs.has(r)) {
      const other = final.find(x => x.slug === r)
      if (!other.related.includes(e.slug) && !other.prerequisites.includes(e.slug)) other.related.push(e.slug)
    } else if (EX[r]) {
      backlinks.push({ existing: r, add: e.slug })
    }
  }
}
// cycles
const graph = {}
for (const x of EXISTING) graph[x.slug] = x.prerequisites
for (const e of final) graph[e.slug] = e.prerequisites
const state = {}
function dfs(n, stack) {
  if (state[n] === 2) return
  if (state[n] === 1) { issues.push(`prerequisite cycle through ${[...stack, n].join(' -> ')}`); return }
  state[n] = 1
  for (const p of graph[n] || []) dfs(p, [...stack, n])
  state[n] = 2
}
for (const n of Object.keys(graph)) dfs(n, [])

final.sort((a, b) => (CAT_IDS.indexOf(a.category) - CAT_IDS.indexOf(b.category)) || (a.level - b.level) || (a.slug < b.slug ? -1 : 1))
const counts = {
  byLevel: levelCounts(final),
  byCategory: catCountsOf(final),
  byKind: final.reduce((a, e) => { a[e.kind] = (a[e.kind] || 0) + 1; return a }, {}),
  byCategoryLevel: final.reduce((a, e) => { const k = `${e.category}/L${e.level}`; a[k] = (a[k] || 0) + 1; return a }, {}),
  everyday: final.filter(e => e.everyday).length,
}
log(`Final: ${final.length} topics; levels ${JSON.stringify(counts.byLevel)}; ${issues.length} invariant fixes`)

// ======================================================================
phase('Write')
const outFinal = {}
for (const e of final) (outFinal[e.category] = outFinal[e.category] || []).push(e)
const writes = await parallel(CAT_IDS.filter(c => outFinal[c]).map(cat => () =>
  agent(`Write the following JSON exactly as given (no changes, no reformatting of content; pretty-printing is fine) to the file ${A.scratch}/entries/${cat}.json, creating it with the Write tool. Then return the path and the number of entries in the array.

${JSON.stringify(outFinal[cat], null, 1)}`, { label: `write:${cat}`, phase: 'Write', schema: SCRIBE_SCHEMA, effort: 'low' })))
const written = writes.filter(Boolean)
log(`Wrote ${written.length} category files`)

return {
  counts,
  poolSize: pool.length,
  mergedOut,
  rejectedByJudges: pool.filter(e => e.rejected).map(e => ({ slug: e.slug, level: e.level, category: e.category, reasons: e.rejectReasons })),
  curatorSwaps,
  curatorOverlaps: curator ? curator.overlaps : [],
  curatorNotes: curator ? curator.notes : '',
  rejectedInVerify,
  unverified,
  gapSwaps,
  criticNotes,
  reserveDispositions,
  issues,
  backlinks,
  runnersUp: runnersUp.slice(0, 60).map(e => ({ slug: e.slug, level: e.level, category: e.category, kind: e.kind, title: e.title, score: Math.round(e.score * 10) / 10, takeaway: e.takeaway })),
  final,
}