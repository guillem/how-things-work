/**
 * Registry of the explainers that are built.
 *
 * Which topics exist, and their category, level, prerequisites and related
 * topics, come from the catalogue (`docs/TOPICS.md`, parsed in `catalog.ts`).
 * This file only adds what the catalogue does not know: the explainer's own
 * title and summary, its accent colour and its length.
 *
 * To add a new explainer:
 *   1. create `src/routes/<slug>/` (see `photosynthesis` for a template); the
 *      slug must be the catalogue slug
 *   2. add an entry here
 *   3. optionally add a small illustration in `components/TopicArt.svelte`
 */
import { catalog, category, entry, type CatalogCategory, type CatalogEntry } from './catalog';

export interface Explainer {
	/** Catalogue slug; also the route. */
	slug: string;
	/** The explainer's own title (the catalogue title is `entry.title`). */
	title: string;
	summary: string;
	/** Accent colour used for the card and the explainer's controls. */
	accent: string;
	/** Number of steps in the explainer (shown on the card). */
	steps: number;
	/** Rough reading time in minutes. */
	minutes: number;
}

export interface Topic extends Explainer {
	entry: CatalogEntry;
	category: CatalogCategory;
}

const explainers: Explainer[] = [
	{
		slug: 'photosynthesis',
		title: 'How photosynthesis works',
		summary:
			'Follow a photon from sunlight into a leaf and watch it split water, power an electron transport chain and build sugar out of thin air.',
		accent: '#2f9e5d',
		steps: 17,
		minutes: 22
	},
	{
		slug: 'epidemics',
		title: 'How epidemics spread\u00a0— and how they stop',
		summary:
			'Release a few cases into a crowd and watch an outbreak grow, peak and fade. Then find out how many people need to be immune to stop it before it starts.',
		accent: '#d0454c',
		steps: 12,
		minutes: 15
	},
	{
		slug: 'unit-circle',
		title: 'Sine, cosine and the unit circle',
		summary:
			'Drag a point around a circle and watch its height and its sideways position trace out the sine and cosine waves.',
		accent: '#7048e8',
		steps: 9,
		minutes: 12
	},
	{
		slug: 'sorting',
		title: 'How computers sort',
		summary:
			'Watch four sorting methods put the same bars in order, count every comparison they make, and see why the way the cost grows matters more than the speed of the computer.',
		accent: '#0b7285',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'newtons-laws',
		title: "Newton's laws: forces, motion and energy",
		summary:
			'Push carts, launch projectiles and send a car along a track you shape yourself, and see why forces change motion instead of keeping it going — and why momentum and energy never get lost.',
		accent: '#1971c2',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'sun-earth-moon',
		title: 'Seasons, Moon phases, eclipses and tides',
		summary:
			'Tilt the Earth, move it round the Sun and swing the Moon around it: four everyday sky puzzles turn out to be the geometry of three bodies.',
		accent: '#e67700',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'learning-from-data',
		title: 'How machines learn from examples',
		summary:
			'Fit curves to points you can drag, then hold some points back and discover why a model that fits its examples very closely can predict new ones worse.',
		accent: '#ae3ec9',
		steps: 8,
		minutes: 12
	},
	{
		slug: 'pagerank',
		title: 'How search engines rank pages',
		summary:
			'Build a small web, release a random surfer on it and watch its visits settle into each page’s rank — the idea behind Google’s PageRank.',
		accent: '#4263eb',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'electric-circuits',
		title: 'How electric circuits work',
		summary:
			'Wire up batteries, bulbs and switches, watch the charges move and read the meters — and find out why current is never used up.',
		accent: '#f08c00',
		steps: 9,
		minutes: 14
	},
	{
		slug: 'bridges-structures',
		title: 'How bridges stand up',
		summary:
			'Drive a truck over beams, trusses, arches and suspension bridges and watch every member pull or push — then build your own bridge from a fixed amount of steel.',
		accent: '#c2410c',
		steps: 8,
		minutes: 14
	},
	{
		slug: 'binary',
		title: 'Bits: how computers store everything',
		summary:
			'Flip the bits of a byte and read the same pattern as a number, a negative number, a letter, a colour and a fraction — then add two numbers and watch the carries spill over.',
		accent: '#1971c2',
		steps: 9,
		minutes: 13
	},
	{
		slug: 'atmosphere-weather',
		title: 'Why the wind blows',
		summary:
			'Heat a planet unevenly and spin it: watch convection cells, trade winds and westerlies appear, steer air round highs and lows, and warm the sea to grow a hurricane.',
		accent: '#0c8599',
		steps: 9,
		minutes: 16
	},
	{
		slug: 'graph-search',
		title: 'How a computer finds the shortest route',
		summary:
			'Draw walls and mud on a map and watch three search methods spread out from the start — then see how a good guess lets a route planner skip most of the map.',
		accent: '#d6336c',
		steps: 8,
		minutes: 13
	},
	{
		slug: 'chaos-fractals',
		title: 'Chaos and fractals',
		summary:
			'Release two pendulums a thousandth of a degree apart and watch them part ways, push a population model into chaos, and zoom forever into the Mandelbrot set.',
		accent: '#7048e8',
		steps: 6,
		minutes: 12
	},
	{
		slug: 'orbits-kepler',
		title: "Orbits and Kepler's laws",
		summary:
			'Fire a cannonball fast enough to miss the ground, launch planets round a star, and watch one law of gravity produce circles, ellipses, escapes and all three of Kepler’s laws.',
		accent: '#f59f00',
		steps: 6,
		minutes: 12
	},
	{
		slug: 'ecosystems',
		title: 'How populations rise and fall',
		summary:
			'Release rabbits and foxes into a field and watch their numbers chase each other round, then pull one species out of a food web and follow the ripples.',
		accent: '#2f9e44',
		steps: 5,
		minutes: 10
	},
	{
		slug: 'bayes-theorem',
		title: 'What a positive test really means',
		summary:
			'Colour a crowd of 1,000 people by who is ill and who tests positive, and count your way to Bayes’ theorem — and to why an accurate test for a rare disease is often wrong.',
		accent: '#c92a2a',
		steps: 5,
		minutes: 8
	},
	{
		slug: 'oscillations-resonance',
		title: 'Why things wobble, and how to make them wobble more',
		summary:
			'Bounce a mass on a spring, swing a pendulum, then push them in time and watch a small push build a huge swing — resonance.',
		accent: '#1971c2',
		steps: 5,
		minutes: 9
	},
	{
		slug: 'logic-gates',
		title: 'How computers add: logic gates',
		summary:
			'Flip switches into AND, OR, NOT and XOR gates, wire them into a circuit with a live truth table, and build the adders at the heart of every processor.',
		accent: '#f08c00',
		steps: 6,
		minutes: 14
	},
	{
		slug: 'central-limit-theorem',
		title: 'Why the bell curve is everywhere',
		summary:
			'Drop balls through a Galton board, then average samples from any distribution you like and watch the averages pile up into the same bell curve.',
		accent: '#c2255c',
		steps: 4,
		minutes: 9
	},
	{
		slug: 'atoms-periodic-table',
		title: 'Atoms and the periodic table',
		summary:
			'Build an atom from protons, neutrons and electrons, watch the electrons fill their shells, and see why the periodic table has the shape it has.',
		accent: '#e03131',
		steps: 6,
		minutes: 12
	},
	{
		slug: 'chemical-bonds',
		title: 'Chemical bonds and the shapes of molecules',
		summary:
			'Snap atoms together into molecules, watch electron pairs push each other into 3D shapes, and switch on a charge map to see which molecules are polar.',
		accent: '#1c7ed6',
		steps: 11,
		minutes: 15
	},
	{
		slug: 'error-correction',
		title: 'How error-correcting codes repair data',
		summary:
			'Flip bits in a coded message and watch three overlapping parity checks point straight at the damaged bit and repair it, then push a whole message through a noisy channel with and without the code.',
		accent: '#0ca678',
		steps: 8,
		minutes: 12
	},
	{
		slug: 'entropy',
		title: 'Heat, entropy and the arrow of time',
		summary:
			'Let fast and slow particles meet, count the ways they can be arranged, and run the film backward to find out why heat only flows one way.',
		accent: '#e8590c',
		steps: 7,
		minutes: 14
	},
	{
		slug: 'internet',
		title: 'How the Internet moves your data',
		summary:
			'Send a message across a map of routers and watch it split into packets, find its own way hop by hop, survive cut links, lost packets and traffic jams, and arrive in one piece.',
		accent: '#1098ad',
		steps: 7,
		minutes: 14
	},
	{
		slug: 'primes-modular-arithmetic',
		title: 'Prime numbers and clock arithmetic',
		summary:
			'Sieve out the primes from a grid of numbers, then add, multiply and raise to powers on a clock, and see why powers on a prime clock are easy to compute and hard to undo — the idea behind public-key cryptography.',
		accent: '#9c36b5',
		steps: 8,
		minutes: 14
	},
	{
		slug: 'complex-numbers',
		title: "Complex numbers and Euler's formula",
		summary:
			'Drag two points on the complex plane and watch their product turn and stretch, then follow eⁱᶿ round the unit circle.',
		accent: '#087f5b',
		steps: 8,
		minutes: 12
	},
	{
		slug: 'electromagnetism',
		title: 'Electricity, magnetism and light',
		summary:
			'Place charges and see the field they spread around them, turn a current into a magnet, push a magnet through a coil to make a current — and find out why light is electricity and magnetism keeping each other going.',
		accent: '#6741d9',
		steps: 7,
		minutes: 14
	},
	{
		slug: 'heart-circulation',
		title: 'How the heart pumps blood',
		summary:
			'Watch a beating heart open and shut its valves in time with its electrical signal, then speed it up, narrow the arteries or make a valve leak.',
		accent: '#c92a2a',
		steps: 9,
		minutes: 14
	},
	{
		slug: 'reinforcement-learning',
		title: 'How a machine learns by trial and error',
		summary:
			'Release an agent into a grid world of rewards, pits and walls, and watch it learn — from rewards alone — which move is worth making in every square.',
		accent: '#0c8599',
		steps: 6,
		minutes: 12
	},
	{
		slug: 'ocean-currents',
		title: 'How the ocean moves heat',
		summary:
			'Blow wind over an ocean and watch gyres and the Gulf Stream form, chill and freshen the North Atlantic to speed up or stall the deep overturning, and weaken the Pacific trade winds to set off an El Niño.',
		accent: '#1c7ed6',
		steps: 8,
		minutes: 16
	},
	{
		slug: 'waves-interference',
		title: 'Waves, sound and interference',
		summary:
			'Send waves through each other, find the bands where two ripples cancel, pluck a string to hear the only notes it can play, and listen to the pitch drop as a sound races past.',
		accent: '#3b5bdb',
		steps: 10,
		minutes: 16
	},
	{
		slug: 'radioactivity',
		title: 'Radioactivity and half-life',
		summary:
			'Watch 1,000 unstable nuclei decay at random while their count follows a perfect curve, meet alpha, beta and gamma radiation, and date a sample from its carbon-14.',
		accent: '#e8590c',
		steps: 11,
		minutes: 15
	},
	{
		slug: 'linear-transformations',
		title: 'Vectors, matrices and linear transformations',
		summary:
			'Drag two arrows and watch the whole plane follow: a matrix is a transformation of space, fully determined by where it sends the basis vectors.',
		accent: '#3b5bdb',
		steps: 13,
		minutes: 16
	},
	{
		slug: 'fourier-transform',
		title: 'The Fourier transform',
		summary:
			'Build a square wave out of sine waves, see the bar chart of frequencies that makes up any signal, reshape a signal by editing its bars, and draw a curve with a chain of spinning circles.',
		accent: '#e8590c',
		steps: 10,
		minutes: 16
	},
	{
		slug: 'cpu',
		title: 'How a processor runs a program',
		summary:
			'Step a tiny 8-bit processor through its programs one tick at a time: fetch an instruction, decode it, execute it, and watch loops, decisions and your own code reduce to that one cycle.',
		accent: '#0b7285',
		steps: 10,
		minutes: 16
	},
	{
		slug: 'cryptography',
		title: 'How cryptography keeps secrets in the open',
		summary:
			'Agree on a secret with a stranger while an eavesdropper hears every word, fingerprint any text with a hash, and sign a message so nobody can forge it — all on one idea: some things are easy to do and practically impossible to undo.',
		accent: '#5f3dc4',
		steps: 14,
		minutes: 20
	},
	{
		slug: 'special-relativity',
		title: 'Special relativity: why moving clocks run slow',
		summary:
			'Speed a train with a light clock towards the speed of light and compare what the passengers and the platform measure: clocks that tick slower, a train that gets shorter, and two lightning strikes that happen at once for one observer and one after the other for the other.',
		accent: '#c2255c',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'semiconductors',
		title: 'Crystals, semiconductors and the p–n junction',
		summary:
			'See why metals conduct and diamond does not, add a few phosphorus or boron atoms to silicon to make it conduct over a million times better, then join two kinds of silicon into a diode that lets current through one way only.',
		accent: '#1971c2',
		steps: 11,
		minutes: 16
	},
	{
		slug: 'motors-generators',
		title: 'Electric motors and generators',
		summary:
			'Send a current through a coil between two magnets and watch the forces turn it, then crank the same coil by hand and watch it make alternating or direct current.',
		accent: '#b5651d',
		steps: 9,
		minutes: 15
	},
	{
		slug: 'light-optics',
		title: 'Light and optics',
		summary:
			'Bounce light off mirrors, bend it into glass, trap it inside a fibre, focus it with a lens and split it into a rainbow, all on an optical bench you can rearrange.',
		accent: '#1098ad',
		steps: 10,
		minutes: 18
	},
	{
		slug: 'compression',
		title: 'Information and compression',
		summary:
			'Type a message and see how many bits each letter deserves, build its Huffman code, then squeeze an image the JPEG way and turn the quality down until the damage shows.',
		accent: '#3b5bdb',
		steps: 11,
		minutes: 18
	},
	{
		slug: 'calculus',
		title: 'Calculus: slopes, areas and how they undo each other',
		summary:
			'Slide a point along a curve you shape yourself to see its slope, pile up rectangles to measure the area beneath it, and watch the two ideas turn out to be each other in reverse.',
		accent: '#7950f2',
		steps: 12,
		minutes: 16
	},
	{
		slug: 'states-of-matter',
		title: 'States of matter and phase changes',
		summary:
			'Heat, cool and squeeze a box of molecules and watch it freeze, melt, boil and condense while a phase diagram tracks its state. Then switch to water and find out why ice floats.',
		accent: '#4c6ef5',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'black-holes',
		title: 'Black holes and curved spacetime',
		summary:
			'Fire light rays and probes past a black hole and watch them bend, loop or fall in, lower a clock towards the horizon and see it slow down, and drag a black hole across the stars to watch it bend them into rings.',
		accent: '#364fc7',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'homeostasis',
		title: 'How the body keeps its blood sugar steady',
		summary:
			'Feed a virtual person or send them for a run and watch insulin and glucagon hold their blood glucose in a narrow range. Then break the loop the two ways diabetes does, and try dosing insulin by hand.',
		accent: '#d9480f',
		steps: 8,
		minutes: 15
	},
	{
		slug: 'quantum-mechanics',
		title: 'Quantum mechanics',
		summary:
			'Fire electrons one at a time at two slits and watch single dots build up an interference pattern, then record which slit each one took and watch the pattern vanish. Solve the Schrödinger equation and send a wave packet at a barrier it cannot climb: part of it tunnels through.',
		accent: '#7048e8',
		steps: 11,
		minutes: 22
	},
	{
		slug: 'acids-bases',
		title: 'Acids, bases and pH',
		summary:
			'Zoom into water to count its hydrogen ions, place everyday liquids on the pH scale, then add a base to an acid drop by drop and watch the pH leap at the very drop that matches the acid.',
		accent: '#c2255c',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'gradient-descent',
		title: 'Gradient descent: how a model learns by going downhill',
		summary:
			'Drop a ball on an error landscape and watch it step downhill. Change the step size until it crawls, converges or flies off, add momentum and noise, and get it through ravines, plateaus and false valleys.',
		accent: '#862e9c',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'embeddings',
		title: 'Embeddings: meaning as position',
		summary:
			'Explore a map of 3,292 real word vectors where related words cluster, search for any of them to see its nearest neighbours, work out king − man + woman, and compare sentences by the angle between them.',
		accent: '#862e9c',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'carbon-cycle',
		title: 'The carbon cycle',
		summary:
			'See the carbon in the air, plants, ocean, fossil fuels and rock drawn to scale, then burn fossil fuels, cut down forests and run the clock to find out where the extra carbon goes and how long it stays in the air.',
		accent: '#0c8599',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'rockets',
		title: 'Rockets and orbital manoeuvres',
		summary:
			'Design a rocket and fly it through the real atmosphere to see whether it makes orbit, then plan the burns that raise an orbit, catch Mars in its launch window and borrow speed from Jupiter.',
		accent: '#e8590c',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'plate-tectonics',
		title: 'Plate tectonics and volcanoes',
		summary:
			'See where ten years of earthquakes and every active volcano lie on a world map, then push two plates together, pull them apart or slide them past each other and watch trenches, mountains, rift valleys and volcanoes form.',
		accent: '#c2410c',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'the-cell',
		title: 'Inside a cell',
		summary:
			'Zoom from a slice of liver into one cell, its nucleus, its power stations and its protein factories, down to single molecules, with a scale bar that tells the truth at every step. Then compare a plant cell and a bacterium.',
		accent: '#c2570c',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'neural-networks',
		title: 'Neural networks and backpropagation',
		summary:
			'Build a network out of simple neurons, train it live and watch it bend a straight line into circles and spirals. Then follow one example forward through the network and its error backward, adjusting every weight.',
		accent: '#1971c2',
		steps: 11,
		minutes: 22
	},
	{
		slug: 'quantum-computing',
		title: 'Quantum computing',
		summary:
			"Turn a qubit round the Bloch sphere with gates and measure it again and again, entangle two qubits and compare what they say, then step through Grover's search and watch interference pile the probability onto the right answer.",
		accent: '#0c8599',
		steps: 11,
		minutes: 24
	},
	{
		slug: 'reaction-rates-equilibrium',
		title: 'Reaction rates, catalysts and equilibrium',
		summary:
			'Watch hydrogen and iodine collide, react and react back. Heat them, add a catalyst that lowers the energy barrier, or add more hydrogen, and see the rates and the final mixture respond.',
		accent: '#7048e8',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'exoplanets',
		title: 'How we find planets round other stars',
		summary:
			'Set a planet’s size, mass, orbit and tilt and watch its star dim as it passes in front and wobble as it is tugged, then read the planet back from the two curves and see whether it lies in the habitable zone.',
		accent: '#0b7285',
		steps: 11,
		minutes: 18
	},
	{
		slug: 'greenhouse-effect',
		title: 'The greenhouse effect & climate change',
		summary:
			'Follow sunlight in and infrared out and find the temperature where they balance. Add CO₂ and watch the planet warm until they balance again, switch the water-vapour and ice feedbacks on and off, then run the IPCC’s emission scenarios to 2100.',
		accent: '#e8590c',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'vision-color',
		title: 'How we see, and where colour comes from',
		summary:
			'Focus an eye on near and far things by changing the shape of its lens and fit glasses to a blurry eye. Then mix red, green and blue light to match a colour while three kinds of cone report what they see, and let some classic illusions fool you.',
		accent: '#1c7ed6',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'earthquakes',
		title: 'Earthquakes and the Earth’s interior',
		summary:
			'Trigger an earthquake and follow its P and S waves through a cross-section of the real Earth, bending as they go and casting shadows behind the core, then find the epicentre of the 2015 Nepal earthquake from three real seismograms and compare magnitudes.',
		accent: '#c2410c',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'dna-to-protein',
		title: 'DNA to protein',
		summary:
			'Follow a real human gene from DNA to protein: copied into RNA, edited, read three letters at a time by a ribosome with the genetic code. Then change, insert or delete one letter and see the protein survive, change or fall apart.',
		accent: '#a61e4d',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'meiosis-inheritance',
		title: 'Meiosis and inheritance',
		summary:
			'Step through the cell division that makes eggs and pollen, choosing where the chromosomes cross over and how they line up. Then cross pea plants as Mendel did, breed thousands of offspring and watch his 3 : 1 and 9 : 3 : 3 : 1 appear, and see why brothers and sisters differ.',
		accent: '#c0396b',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'convolution-vision',
		title: 'Convolution and computer vision',
		summary:
			'Slide a small filter across a picture and watch it blur, sharpen or find edges. Then open up a network trained on handwritten digits: the same small detectors used everywhere, stacked layer on layer, read the digit you draw.',
		accent: '#0c8599',
		steps: 10,
		minutes: 20
	},
	{
		slug: 'transformers',
		title: 'Attention and transformers',
		summary:
			'Look inside GPT-2: see which earlier words each word attends to, layer by layer and head by head, then work through one attention operation with the model’s real numbers, from queries and keys to the weighted mix of values.',
		accent: '#6741d9',
		steps: 12,
		minutes: 24
	},
	{
		slug: 'respiration-atp',
		title: 'Respiration: how cells make ATP',
		summary:
			'Follow one glucose molecule through glycolysis, the citric acid cycle and the electron transport chain, watch the electrons pump protons and the protons spin ATP synthase, then take the oxygen away and see the chain back up.',
		accent: '#d9480f',
		steps: 14,
		minutes: 22
	},
	{
		slug: 'standard-model',
		title: 'Particle physics & the Standard Model',
		summary:
			'Open up an atom down to its quarks, build protons, pions and stranger particles under the real charge and colour rules, step through beta decay as the exchange of a W boson, and test which decays nature allows.',
		accent: '#5f3dc4',
		steps: 14,
		minutes: 24
	},
	{
		slug: 'deep-time',
		title: 'Deep time',
		summary:
			'Scrub through 4.57 billion years while a globe shows the continents drifting and tracks show the temperature, the oxygen in the air and the major groups of life, zoom from eons down to the last few thousand years, then squeeze it all into one calendar year.',
		accent: '#a61e4d',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'redox-batteries',
		title: 'Redox and batteries',
		summary:
			'Watch zinc hand electrons to copper, then split the reaction in two so the electrons must take a wire. Read voltages off the ladder of potentials, charge and discharge a lithium-ion cell in cross-section, and swap its electrodes to change its voltage and capacity.',
		accent: '#2b8a3e',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'neurons',
		title: 'How neurons fire and talk to each other',
		summary:
			'Inject current into a squid axon and watch sodium and potassium channels open, the voltage spike and the pulse race down the axon, far faster when wrapped in myelin. Then release neurotransmitter at a synapse and add up excitatory and inhibitory inputs on the next cell.',
		accent: '#a61e4d',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'immune-system',
		title: 'How the immune system fights an infection — and remembers it',
		summary:
			'Release a flu virus into the lining of the airways and watch the fast, general alarm hold it back while a few B and T cells whose receptors happen to fit it multiply. Then infect the same body again and compare.',
		accent: '#c2255c',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'evolution',
		title: 'Evolution by natural selection',
		summary:
			'Run a population of moths whose wing shade is inherited, set the mutation rate, the population size and the birds that hunt them, and watch it change over generations. Then see the part chance plays, and evolution measured in peppered moths, bacteria on an antibiotic and a 50,000-generation experiment.',
		accent: '#4d7c32',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'language-models',
		title: 'How language models write',
		summary:
			'Type a sentence and watch it split into GPT-2’s tokens, see the model’s real probabilities for the next token, then turn them into text one token at a time: greedy, with temperature, top-k and top-p, or by picking each token yourself.',
		accent: '#c2255c',
		steps: 13,
		minutes: 26
	},
	{
		slug: 'protein-folding',
		title: 'Protein folding',
		summary:
			'Fold a chain of water-loving and water-repelling beads by hand against an energy score, then let it fold itself. See why trying every shape would take longer than the age of the universe, and compare real proteins with the shapes AlphaFold predicts for them.',
		accent: '#5f3dc4',
		steps: 13,
		minutes: 22
	},
	{
		slug: 'carbon-polymers',
		title: 'Carbon chemistry and polymers',
		summary:
			'Build carbon chains, rings and functional groups and watch the name and boiling point follow, turn a molecule against its mirror image, and tie chains into a rubber whose stiffness depends on chain length and cross-links.',
		accent: '#d9480f',
		steps: 13,
		minutes: 20
	},
	{
		slug: 'tensors',
		title: 'Tensors: numbers with axes',
		summary:
			'Grow a number into a vector, a matrix and a block, slice and reshape a real photograph as a 48 × 36 × 3 block of numbers, multiply along matching axes, then turn the coordinate axes and see what a physicist means by a tensor.',
		accent: '#0c8599',
		steps: 14,
		minutes: 20
	},
	{
		slug: 'ice-ages',
		title: 'Ice ages and orbital cycles',
		summary:
			'Tilt the Earth, turn its wobble and stretch its orbit to change the summer sunshine in the far north, then play the three cycles forward against 800,000 years of ice-core temperature and CO₂, and see how ice and carbon turn a small push into an ice age.',
		accent: '#3b6fb6',
		steps: 13,
		minutes: 22
	},
	{
		slug: 'big-bang',
		title: 'The Big Bang & expanding universe',
		summary:
			'Watch a universe of galaxies expand from any galaxy you choose, follow light stretching toward red on its way, run the film backward to a hot, dense beginning, and scrub a timeline from the first second to today.',
		accent: '#e8590c',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'transistors-chipmaking',
		title: 'Transistors and how chips are made',
		summary:
			'Raise the voltage on a transistor’s gate and watch a channel of electrons appear, pair two transistors into an inverter, then follow a chip through the factory: films, light through a mask, etching and doping, repeated layer after layer.',
		accent: '#5c7cfa',
		steps: 13,
		minutes: 22
	},
	{
		slug: 'diffusion-models',
		title: 'Diffusion models',
		summary:
			'Dissolve a cloud of points, then a handwritten digit, into pure static one small step of noise at a time. Then run two small trained networks backwards, from noise to data, steered by a prompt and a guidance scale.',
		accent: '#ae3ec9',
		steps: 13,
		minutes: 26
	},
	{
		slug: 'mrna-vaccines',
		title: 'How vaccines work — and what an mRNA vaccine does inside you',
		summary:
			'Follow an mRNA vaccine from the injection: a fat bubble enters a muscle cell, its ribosomes read the message and make a virus’s spike protein, the cell shows it to the immune system and breaks the message down within days. Then compare the antibodies after one dose, two doses and a later infection.',
		accent: '#0c8599',
		steps: 14,
		minutes: 22
	},
	{
		slug: 'stars',
		title: 'The life cycle of stars',
		summary:
			'Choose a star’s mass and run its life across the Hertzsprung–Russell diagram while a cutaway shows what its core is fusing, watch it end as a white dwarf, a neutron star or a black hole, and find out where each element was made.',
		accent: '#e8590c',
		steps: 14,
		minutes: 25
	},
	{
		slug: 'dark-matter',
		title: 'Galaxies and dark matter',
		summary:
			'Spin a real galaxy with only its visible stars and gas and watch its outer stars lag far behind the measured speeds. Add an invisible halo until the rotation curve fits, weigh a colliding cluster by how it bends light, and find about five times more matter than we can see.',
		accent: '#6741d9',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'gpu',
		title: 'GPUs and parallel computing',
		summary:
			'Race one fast processor core against thousands of slow lanes on every pixel of an image and on a matrix multiplication. See what a branch costs a warp of 32, why memory sets the pace on a real GPU and CPU, and why the part of a job that must run in order caps the speed-up.',
		accent: '#5c940d',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'medical-imaging',
		title: 'Medical imaging',
		summary:
			'Turn an X-ray tube round a body and record its shadow from every side, then watch a CT scanner compute the slice that explains them all, sharpened by a filter and read in Hounsfield units. Compare it with a plain X-ray, then image the same body with echoes of sound and with protons in a magnet.',
		accent: '#1971c2',
		steps: 14,
		minutes: 24
	},
	{
		slug: 'gravitational-waves',
		title: 'Gravitational waves',
		summary:
			'Set the masses of two black holes and let them spiral together: ripples spread out, the signal climbs into a chirp you can hear, and a laser interferometer’s arms change by far less than a proton. Then read the masses off the real signal of GW150914.',
		accent: '#5c7cfa',
		steps: 12,
		minutes: 24
	},
	{
		slug: 'graphics-3d',
		title: '3D graphics',
		summary:
			'Move a camera and a lamp round a small scene and watch it become a picture two ways: projecting its triangles through 4 × 4 matrices and filling them pixel by pixel, or shooting a ray through every pixel and following it to the lamp, off a mirror and through glass.',
		accent: '#3b5bdb',
		steps: 13,
		minutes: 22
	},
	{
		slug: 'cancer',
		title: 'Cancer',
		summary:
			'Let the cells of a tissue divide and occasionally mutate. A cell whose growth controls break outdivides its neighbours, its descendants pick up more changes, and a tumour grows. Then treat it and watch which cells survive.',
		accent: '#d0343a',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'turing-machines',
		title: 'Turing machines and the limits of computation',
		summary:
			'Program a tape-and-head machine with a small rule table, see why one such machine can run every other, then meet the limits: a question no program can answer, the busy beavers, and a puzzle whose search explodes.',
		accent: '#5c940d',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'wireless-signals',
		title: 'Wireless signals',
		summary:
			'Put bits on a radio wave by changing its amplitude, frequency or phase, watch noise blur the constellation until bits are misread, push the receiver away and add a neighbouring network, then pack more bits into each symbol and meet the limit Shannon proved.',
		accent: '#1c7ed6',
		steps: 14,
		minutes: 24
	},
	{
		slug: 'gps',
		title: 'How GPS finds you',
		summary:
			'Drag a receiver and the satellites around a map and watch circles of distance meet at your position, give its clock an error and fix it with one more satellite, then use the real GPS constellation and see why the satellite clocks must allow for relativity.',
		accent: '#0c8599',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'heat-engines',
		title: 'Heat engines',
		summary:
			'Heat a gas and let it push a piston, run a four-stroke engine round its loop on a pressure–volume chart, then find the ceiling that the hot and cold temperatures put on every engine, from a car to a power station.',
		accent: '#d4380d',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'solar-cells',
		title: 'Solar cells',
		summary:
			'Shine light of any colour on a silicon junction and watch each photon free an electron that the junction’s field drives round a circuit. Then find the best voltage to run the cell at, and change the band gap to see how sunlight’s energy divides between what passes through, what turns into heat, what the voltage cannot keep, and the one-third that becomes electricity.',
		accent: '#e67700',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'consensus-blockchains',
		title: 'How machines agree: consensus and blockchains',
		summary:
			'Five servers elect a leader and keep one log through crashes and a cut network; then blocks are chained by hash, mined by brute force, and raced by an attacker — how independent machines, and then strangers, agree on one history.',
		accent: '#0b7285',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'feedback-control',
		title: 'Feedback control: how machines stay on target',
		summary:
			'Tune the three gains of a PID controller as it holds a car at 90 km/h over hills, a drone at a set height in the wind and a pole upright on a cart, then let two motors steer a robot arm to a point you choose.',
		accent: '#0c8599',
		steps: 13,
		minutes: 24
	},
	{
		slug: 'power-grid',
		title: 'The power grid',
		summary:
			'Watch a real day of electricity demand and generation, then take the controls: keep the frequency at 50 Hz while demand rises and falls, trip a power station, send a cloud over the solar farms, and see why power travels at 400,000 volts.',
		accent: '#f59f00',
		steps: 13,
		minutes: 22
	},
	{
		slug: 'flight',
		title: 'Flight',
		summary:
			'Tilt a wing in a stream of air and watch the air turn downwards, the pressure drop above it and lift grow until the wing stalls. Then balance lift, weight, thrust and drag to fly a real Cessna 172 at any speed and height.',
		accent: '#1c7ed6',
		steps: 13,
		minutes: 24
	},
	{
		slug: 'nuclear-fusion',
		title: 'Nuclear fusion',
		summary:
			'Heat a plasma of hydrogen isotopes until its nuclei tunnel through their repulsion and fuse, then set its temperature, density and confinement time and see whether it ignites.',
		accent: '#e64980',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'nuclear-fission',
		title: 'Nuclear fission',
		summary:
			'Fire a neutron at a uranium-235 nucleus and watch it split, read where the energy comes from on the curve of binding energy, then run a reactor core: set the fuel, the water and the control rods to hold the chain reaction at exactly one new fission per fission.',
		accent: '#1864ab',
		steps: 12,
		minutes: 22
	},
	{
		slug: 'crispr',
		title: 'CRISPR: how bacteria remember and fight viruses',
		summary:
			'Watch a virus hijack a bacterium, then see how bacteria fight back: they file a piece of each virus in their own DNA, copy the file into RNA, and send a protein to find and cut any DNA that matches. Then follow the arms race in a flask as phages change a letter to escape.',
		accent: '#5c940d',
		steps: 12,
		minutes: 20
	},
	{
		slug: 'ngram-text-models',
		title: 'Counting machines that write',
		summary:
			'Build a machine that writes by counting which letter followed the last few in a text, then feed it a million letters of Shakespeare and widen its window: its text gets more fluent, while text it has never read becomes a blank and its writing turns into recitation.',
		accent: '#0b7285',
		steps: 8,
		minutes: 16
	},
	{
		slug: 'tokenization',
		title: 'Tokenization & byte-pair encoding',
		summary:
			'Learn a tokenizer merge by merge from a text you type, then run GPT-2’s real one: why common words are one token, rare words several, numbers split oddly, other scripts cost more, and the letters inside a token are out of the model’s sight.',
		accent: '#6741d9',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'positional-encoding',
		title: 'Position in a transformer: sinusoids & RoPE',
		summary:
			'Shuffle a sentence and watch attention fail to notice, then give each position a set of clock hands turning at different speeds: added to the embedding as sinusoids, or turning the queries and keys themselves, as in RoPE, so that an attention score depends only on how far apart two tokens are.',
		accent: '#d9480f',
		steps: 7,
		minutes: 15
	},
	{
		slug: 'residual-stream-logit-lens',
		title: 'Inside a transformer block: the residual stream',
		summary:
			'Follow one word’s vector down GPT-2 small’s twelve blocks: each attention and each MLP adds a correction to one running vector. Read that vector after every block with the logit lens and watch the next word appear and sharpen; switch off any block’s attention or MLP and see which guesses change.',
		accent: '#7048e8',
		steps: 7,
		minutes: 16
	},
	{
		slug: 'training-a-tiny-language-model',
		title: 'Training a tiny language model',
		summary:
			'Train a two-layer character-level transformer on Shakespeare, in the page or from stored runs made by the same code: watch the average surprise at the next character fall below the bigram and trigram lines, the samples turn from random letters into words and speeches, and, with too little text, the model start to memorise.',
		accent: '#e8590c',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'scaling-laws',
		title: 'Scaling laws',
		summary:
			'Scrub a sweep of 35 tiny transformers trained on Shakespeare and watch the loss fall along a straight line on log-log axes until the text or the model runs out; retrain one point in the page; then drag a compute budget through the Chinchilla law and see the best split between model size and training tokens, with the fit as printed, unrounded and refitted.',
		accent: '#1864ab',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'rlhf-alignment',
		title: 'RLHF: learning from human preferences',
		summary:
			'Compare pairs of answers GPT-2 wrote and watch a Bradley–Terry reward model learn from the choices; then pull the base model towards that reward on a KL leash, exactly and by policy gradient, and loosen the leash until the policy games the reward model’s mistakes.',
		accent: '#7048e8',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'taylor-series',
		title: 'Taylor series & where they stop working',
		summary:
			'Add terms to a Taylor polynomial and watch it hug eˣ and sin x ever further out but give up at |x| = 1 on the harmless-looking 1/(1 + x²); then find the reason in the complex plane, where the disk of convergence stops at the nearest singularity, and fit the whole interval anyway with Chebyshev interpolation.',
		accent: '#d9480f',
		steps: 7,
		minutes: 16
	},
	{
		slug: 'kv-cache-inference',
		title: 'Serving a language model: the KV cache',
		summary:
			'Generate text with a tiny transformer, first recomputing every earlier character and then keeping each layer’s keys and values, and count the arithmetic and the bytes; then put Llama 2 7B and Mistral 7B on an H100’s roofline to see why a long prompt is compute-bound, each new token memory-bound, and batching what makes serving cheap.',
		accent: '#e8590c',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'chromatography',
		title: 'Chromatography: separating by stickiness',
		summary:
			'Inject a mixture into a column and watch each molecule hop between the moving liquid and the packing: the bands separate and spread, the detector draws the peaks, and the measured plate height traces the van Deemter curve with its best flow speed.',
		accent: '#e8590c',
		steps: 8,
		minutes: 16
	},
	{
		slug: 'speculative-decoding',
		title: 'Speculative decoding',
		summary:
			'A small model guesses the next few characters and the tiny GPT checks them all in one pass, keeping each guess with probability min(1, p/q) and redrawing the first one it turns down from the leftover; ten thousand samples show the output is exactly the big model’s, and the counted passes and bytes show when the guessing pays.',
		accent: '#1c7ed6',
		steps: 10,
		minutes: 20
	},
	{
		slug: 'chain-of-thought-scratchpad',
		title: 'Why thinking out loud helps a model',
		summary:
			'Two tiny transformers of the same size, trained by the page on addition and run in it: one writes the answer straight away, the other writes each column’s digit and carry first. Step through both, token by token, and see where the direct one goes wrong and why writing the working gives the same model more computation.',
		accent: '#0b7285',
		steps: 8,
		minutes: 16
	}
];

export const topics: Topic[] = explainers.map((e) => {
	const meta = entry(e.slug);
	return { ...e, entry: meta, category: category(meta.category) };
});

export const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

/** Catalogue categories that have at least one built topic, in catalogue order. */
export const sections = catalog.categories
	.map((c) => ({
		category: c,
		topics: c.slugs.flatMap((slug) => topicBySlug.get(slug) ?? [])
	}))
	.filter((s) => s.topics.length > 0);
