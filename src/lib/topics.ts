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
	},
	{
		slug: 'bacterial-chemotaxis',
		title: 'Bacterial chemotaxis: climbing a gradient by memory',
		summary:
			'Release a few hundred E. coli by a drop of attractant: each runs, tumbles at random and runs again, and a receptor cluster with a slow methylation memory makes it tumble less while things improve. The swarm gathers at the drop without any cell knowing where it is.',
		accent: '#66a80f',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'diffusion-osmosis',
		title: 'Diffusion, osmosis & active transport',
		summary:
			'Drop dye into a box of water and watch random jiggling spread it, faster when warmer; put a membrane in the way that passes water but not sugar and watch the water climb on the sugary side; put a blood cell and a potato cell in pure water and salt water; then switch on a pump that carries particles uphill and watch its ATP run down.',
		accent: '#16869c',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'cerebellum-motor-learning',
		title: 'The cerebellum & motor learning',
		summary:
			'Reach for targets while the cursor is secretly turned by 30°, and watch your errors shrink and an aftereffect remain; a two-rate error-driven model (Smith, Ghazizadeh & Shadmehr 2006) does the same reaches beside you, and predicts the spontaneous recovery you can then test on your own hand.',
		accent: '#8f3f71',
		steps: 10,
		minutes: 20
	},
	{
		slug: 'ensemble-weather-forecasting',
		title: 'Weather forecasts: why they come as odds',
		summary:
			'Forecast a ring of forty chaotic weather cells (Lorenz 96) from a slightly wrong measurement and watch the error double every two days; launch fifty-one forecasts and read the odds off the fan, check them against what happened, see a wrong model go confident and wrong, and keep the forecast on track by observing and correcting.',
		accent: '#22729b',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'tcp-congestion-control',
		title: 'TCP congestion control: probing for a share',
		summary:
			'Send a file through a bottleneck router and watch the sender feel for the link: slow start, a lost packet, the AIMD sawtooth. Add flows, enlarge the queue, lose packets to noise, remove the backoff, and compare Reno, CUBIC and Vegas.',
		accent: '#8a6d00',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'wind-turbine-aerodynamics',
		title: 'Wind turbines & the Betz limit',
		summary:
			'Slow the air through an actuator disc and find the 16/27 that no rotor can beat; then put real blades on it, the NREL 5-MW reference rotor with its published airfoil data, and a blade-element-momentum model shows why it gets close only near one tip-speed ratio, and how pitch holds its power at 5 MW in a gale.',
		accent: '#3d8a9e',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'exponentials-logarithms',
		title: 'Exponentials & logarithms',
		summary:
			'Fold a sheet of paper past the Moon in 42 doublings, race adding against multiplying, straighten the curve on a log scale, count doublings and zeros with a logarithm, and multiply on a working slide rule by adding lengths.',
		accent: '#099268',
		steps: 10,
		minutes: 16
	},
	{
		slug: 'game-theory-cooperation',
		title: 'Game theory: why cooperate?',
		summary:
			"Play the prisoner's dilemma against the page, run Axelrod's tournament of strategies, let them evolve, add mistakes, and watch cooperators and cheats battle on a grid.",
		accent: '#0f766e',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'differential-equations',
		title: 'Differential equations',
		summary:
			'Give a rule for how fast something changes and the plane fills with slope dashes; drop starting points to trace the one curve through each, for a growing colony, a cooling coffee, a population with a ceiling and a fish stock whose level line vanishes when the catch passes rK/4, and see that curves never cross even where no formula exists.',
		accent: '#9a3b8f',
		steps: 9,
		minutes: 16
	},
	{
		slug: 'calculus-of-variations',
		title: 'The brachistochrone & calculus of variations',
		summary:
			'Race beads down a straight line, a circular arc and a ramp you shape yourself, then let gradient descent bend the ramp into the fastest curve of all, a cycloid, while the Euler–Lagrange residual falls to zero along it; then hang a chain whose length a Lagrange multiplier holds fixed, and turn it into an arch that is stationary but not the best.',
		accent: '#b04a8a',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'random-graphs',
		title: 'Random graphs & the giant component',
		summary:
			'Link nodes at random and watch the pieces merge: a giant component appears once each node has about one link, ever more sharply as the graph grows. Then open bonds on a grid until it spans.',
		accent: '#b8336a',
		steps: 12,
		minutes: 18
	},
	{
		slug: 'phase-portraits',
		title: 'Phase portraits & stability',
		summary:
			'Drag the entries or the eigenvalues of a 2×2 system and its phase portrait turns node, saddle, spiral or centre on the trace–determinant chart; linearise a pendulum and predators and prey at their fixed points and watch the flow match its linearisation close up, except at a centre, where the nonlinear terms decide; then push μ through a Hopf bifurcation and a limit cycle is born.',
		accent: '#5a4fcf',
		steps: 10,
		minutes: 18
	},
	{
		slug: 'resampling-inference',
		title: 'The bootstrap & permutation tests',
		summary:
			'Shuffle the species labels of real penguins thousands of times to see what chance alone produces and read a p-value off it; resample them with replacement to put intervals on a difference and on a slope; then test those intervals on a population whose truth is known, and watch their 95% fall short for small, skewed samples and collapse for the maximum.',
		accent: '#8a6d1d',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'musical-scales-ratios',
		title: 'Why music has twelve notes',
		summary:
			'Press two keys and watch their waves line up or beat, map which pairs sound smooth and why that depends on harmonics, then cut the octave into equal steps and see why twelve is the first small ladder whose fifth lands within 2 cents of the pure 3 : 2.',
		accent: '#b5487a',
		steps: 9,
		minutes: 16
	},
	{
		slug: 'lasers',
		title: 'Lasers',
		summary:
			'Pump a gain medium between two mirrors and follow its populations and photons under the rate equations: two levels never invert, four levels do at any pump, the inversion clamps at threshold while the output climbs in a straight line, and a shutter turns the same laser into nanosecond pulses of kilowatts.',
		accent: '#c8102e',
		steps: 10,
		minutes: 18
	},
	{
		slug: 'ising-model',
		title: 'The Ising model & phase transitions',
		summary:
			'Spins on a lattice that only want to agree with their neighbours, run by the Metropolis and Wolff algorithms: cool them through Onsager’s critical temperature and domains grow out of noise, the magnetisation rises continuously from zero and the susceptibility and heat capacity spike, sharper as the lattice grows; sweep a field for a hysteresis loop, and watch a one-dimensional chain never order.',
		accent: '#b5179e',
		steps: 8,
		minutes: 20
	},
	{
		slug: 'dislocations-alloys',
		title: 'Dislocations: why metals bend and alloys resist',
		summary:
			'Shear a crystal of simulated atoms and watch a defect glide through it one row of bonds at a time, at a few thousandths of the stress a perfect crystal needs; then sprinkle in foreign atoms and drive dislocations into a hard particle, and watch the stress climb.',
		accent: '#8a5a2b',
		steps: 8,
		minutes: 16
	},
	{
		slug: 'huckel-molecular-orbitals',
		title: 'Molecular orbitals & conjugation',
		summary:
			'Build chains and rings of carbon atoms and diagonalise their Hückel matrix: the π orbitals as signed lobes beside a ladder filled with electrons, a gap that narrows as a cyanine dye grows (so it absorbs redder light, beside the measured series), and rings that close their shell at 2, 6 or 10 electrons but leave two alone at 4 or 8.',
		accent: '#4a3aa8',
		steps: 9,
		minutes: 16
	},
	{
		slug: 'surface-catalysis',
		title: 'Catalysis on a surface',
		summary:
			'CO oxidation on a lattice of catalyst sites (the Ziff–Gulari–Barshad model): slide the CO fraction of the gas and the surface dies of oxygen on one side and chokes on CO on the other, with a narrow working window between that ends at a cliff and that the mean-field rate equations get wrong; let CO desorb, as on a hotter surface, and the poisoned catalyst recovers.',
		accent: '#6a7f10',
		steps: 7,
		minutes: 16
	},
	{
		slug: 'transition-state-theory',
		title: 'Reaction trajectories & the transition state',
		summary:
			'Fire three atoms at each other across a computed energy landscape and watch them cross a mountain pass or turn back; see why translation carries molecules over an early pass and vibration over a late one, then sweep the temperature through Eyring’s rate and swap hydrogen for deuterium.',
		accent: '#2a6f97',
		steps: 7,
		minutes: 18
	},
	{
		slug: 'pcr-copying-dna',
		title: 'PCR: copying DNA until there is enough to see',
		summary:
			'Heat, cool, warm: follow a stretch of DNA through the cycles of the polymerase chain reaction as two strands become four and thirty cycles make a billion copies, until the primers run out. Then read a COVID-19 test the way the machine does: the fewer copies in the swab, the later the glow crosses the line.',
		accent: '#b8327a',
		steps: 8,
		minutes: 14
	},
	{
		slug: 'morphogen-gradients',
		title: 'Morphogen gradients & positional information',
		summary:
			'A substance made at one end of a row of cells spreads and decays into an exponential gradient: set its diffusion and lifetime and watch the length scale √(D·τ), paint a French flag with two thresholds, test the model against the fly’s Bicoid gradient, watch the flag fail to stretch in a longer tissue until an expansion–repression circuit makes it scale, and see why boundaries are sharp where the gradient is steep.',
		accent: '#7a3e9d',
		steps: 7,
		minutes: 18
	},
	{
		slug: 'lac-operon',
		title: 'The lac operon: a switch with a memory',
		summary:
			'Set the sugars in a bacterium’s medium and watch the repressor, CAP and the permease decide whether the lac genes are read. Sweep the inducer TMG up and down to trace the hysteresis loop Ozbudak and colleagues measured, see why lactose itself gives no loop, and grow a culture on two sugars to find the diauxic pause.',
		accent: '#a8519b',
		steps: 8,
		minutes: 18
	},
	{
		slug: 'population-genetics',
		title: 'Population genetics: drift and selection',
		summary:
			'Run a hundred populations at once and watch an allele’s share wander by chance until it is fixed or lost, faster in small populations; give it an advantage and the traces bend upwards, yet most new beneficial mutations still vanish while rare. Hardy–Weinberg, recessive alleles hiding, and when chance beats selection.',
		accent: '#3f7d5a',
		steps: 8,
		minutes: 16
	},
	{
		slug: 'turing-patterns',
		title: 'Turing patterns',
		summary:
			'Two chemicals, an activator that makes more of itself and a faster-spreading inhibitor, turn a uniform field into spots or stripes. Raise the inhibitor’s diffusion past the critical ratio and watch noise crystallise at the wavelength linear stability predicts, saturate the activator to turn spots into stripes, grow the domain to insert new stripes, taper it into a tail to get bands, and see where nature is known to use the mechanism.',
		accent: '#a0522d',
		steps: 7,
		minutes: 20
	},
	{
		slug: 'pharmacokinetics-dosing',
		title: 'Pharmacokinetics: how doses add up',
		summary:
			'Give a drug as an injection, a tablet or a drip and watch its blood level rise and fall against the range where it works. Doses pile up until removal balances intake, after four or five half-lives whatever the dose; place your own doses, halve the clearance, and watch phenytoin break the rules. Built from five drugs’ US labels; not dosing advice.',
		accent: '#8f3985',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'cochlea-hearing',
		title: 'Hearing & the cochlea',
		summary:
			'Play a tone, a chord or a vowel into a model cochlea and watch a travelling wave peak at the place tuned to each frequency. Switch the outer hair cells’ amplifier off, turn the sound up until it saturates, kill the amplifier near the 5 kHz place to notch the audiogram, and hear a vowel through a cochlear implant.',
		accent: '#9d4b73',
		steps: 8,
		minutes: 22
	},
	{
		slug: 'mri-k-space',
		title: 'MRI: an image from spinning protons',
		summary:
			'An MRI scanner never measures a picture: gradients give every position its own frequency and phase, so each echo is one line of the slice’s 2-D Fourier transform. Watch k-space fill line by line beside the image, spins refocus into an echo, and edit k-space for blur, outlines, folds and a head that wraps round.',
		accent: '#36618e',
		steps: 12,
		minutes: 24
	},
	{
		slug: 'ecg-arrhythmias',
		title: 'The ECG and arrhythmias',
		summary:
			'A sheet of heart muscle as an excitable medium, with a hand-built conduction system, and the ECG read off it on Einthoven’s three leads. Slow the AV node until beats drop, fire an early beat into slowed, scarred tissue and watch a wave chase its own tail as tachycardia, let it break up into fibrillation, then shock it so the sinus node can take over. Real recordings from the MIT-BIH database alongside; a teaching model, not a diagnostic tool.',
		accent: '#9e2f50',
		steps: 9,
		minutes: 22
	},
	{
		slug: 'ocean-acidification',
		title: 'Ocean acidification and carbonate chemistry',
		summary:
			'Turn up the CO₂ in the air and solve seawater’s carbonate chemistry as you go, with the constants CO2SYS uses: the pH slips a little, dissolved CO₂ and bicarbonate climb, and the carbonate ion that shells are built from runs short, first in cold polar water. A Bjerrum plot, the saturation of aragonite and calcite, and the Revelle factor that slows the ocean’s uptake.',
		accent: '#1c7c99',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'tsunamis',
		title: 'Tsunamis: a wave as long as the ocean is deep',
		summary:
			'A slice of the North Pacific from Japan to California with the real sea floor under it. Jolt the floor off Japan and watch the 2011 tsunami run as fast as an airliner over the abyss, slow and grow over the shelf, and reach the real buoys and the Crescent City tide gauge when they recorded it; compare a wind wave, reshape the shelf, raise a ridge.',
		accent: '#0b5d8c',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'carbonate-silicate-thermostat',
		title: 'The carbonate-silicate thermostat',
		summary:
			'Volcanoes breathe out CO₂ and rain dissolves it into rock, faster on a warm planet: the Walker, Hays and Kasting feedback, run as a box model for millions of years. Knock it off balance, dim the Sun, follow the faint young Sun’s brightening, freeze the planet into a snowball and watch the CO₂ thaw it, and find where the thermostat gives out.',
		accent: '#3f7d6e',
		steps: 10,
		minutes: 20
	},
	{
		slug: 'radiative-convective-column',
		title: 'Radiative transfer and the climate column',
		summary:
			'A column of air from the ground to the stratosphere, solved with the two-stream equations for a grey gas with an infrared window and with convection to a chosen lapse rate. Add absorber and the level the planet radiates from climbs into colder air, the column below warms until the balance is back, and the stratosphere cools, but only because part of the infrared escapes through the window.',
		accent: '#c2410c',
		steps: 9,
		minutes: 22
	},
	{
		slug: 'game-tree-search',
		title: 'How a computer plays a game: the search tree',
		summary:
			'Play noughts and crosses and Connect Four against the page and open its mind: the tree of moves it looks through, the scores passed up from the ends of the lines, how fast the tree grows with every move ahead, the branches pruning skips, and a rule of thumb you build yourself.',
		accent: '#3b5bdb',
		steps: 11,
		minutes: 20
	},
	{
		slug: 'lagrange-points-three-body',
		title: 'The three-body problem and the Lagrange points',
		summary:
			'Two large bodies and a probe too light to pull on them, seen from the frame that turns with the two: the five points where the probe keeps pace, the forbidden regions its energy sets and the gates that open at L1 and L2, a knife edge at L1, tadpoles round L4 like Jupiter’s Trojans until the mass ratio passes Routh’s 1 in 26, and two probes a metre apart whose paths split.',
		accent: '#4c6ef5',
		steps: 9,
		minutes: 22
	},
	{
		slug: 'aperture-synthesis',
		title: 'Interferometry & aperture synthesis',
		summary:
			'An array of small radio dishes sees as sharply as one dish as wide as the array, because each pair measures one Fourier component of the sky. Place dishes on a map, let the Earth turn them through the uv plane, watch the dirty beam and image form, clean it with CLEAN, and see what shrinking and spreading the array costs.',
		accent: '#5f3dc4',
		steps: 12,
		minutes: 26
	},
	{
		slug: 'cache-memory-hierarchy',
		title: 'Caches and the memory hierarchy',
		summary:
			'Run programs through a cache one load at a time: lines arrive, hit and get thrown out. Sum a matrix by rows and by columns, make a direct-mapped cache thrash, loop one line too far, chase a scattered list, tile a matrix product, and watch the latency curve break where each cache runs out.',
		accent: '#0c8599',
		steps: 11,
		minutes: 22
	},
	{
		slug: 'hash-tables-bloom-filters',
		title: 'Hash tables & Bloom filters',
		summary:
			'A hash turns a word into a slot number, so a lookup goes straight to it: chaining and linear probing measured against Knuth’s expected probes as the table fills and doubles, then a Bloom filter that says “definitely absent” or “maybe present” from a few bits per word, its false-positive rate against the formula, and a bad hash that clusters both.',
		accent: '#2b8a3e',
		steps: 8,
		minutes: 20
	},
	{
		slug: 'shazam-audio-fingerprint',
		title: 'How Shazam recognises a song',
		summary:
			'Turn a dozen tunes the page composes into constellations of spectrogram peaks and pairs of peaks into 22-bit fingerprints, then record one through hiss and a cough from a random start and watch the matching fingerprints line up at a single time offset, while a transposed copy, a cover and an unknown tune find nothing.',
		accent: '#1c7ed6',
		steps: 11,
		minutes: 18
	},
	{
		slug: 'distributed-hash-tables',
		title: 'Distributed hash tables & consistent hashing',
		summary:
			'Hash servers and keys onto one ring and add a server: only its own share of the keys moves, where hash mod N moves almost all. Even the load with virtual nodes, look keys up with Chord finger tables in about ½ log₂ N hops among thousands of nodes, and churn the ring to see successor lists heal it and replicas keep the data.',
		accent: '#3b5bdb',
		steps: 9,
		minutes: 18
	},
	{
		slug: 'elliptic-curve-cryptography',
		title: 'Elliptic-curve cryptography',
		summary:
			'Drag two points on y² = x³ + 7 and add them with a chord, then watch the same equation over a finite field become a scatter on which the same rule still works. Multiply a point by a secret with double-and-add, see that the result gives no clue to the secret, run Diffie–Hellman on the curve, check secp256k1 and X25519 against their standards in your browser, and see why 256 bits do the work of 3,072.',
		accent: '#0b7285',
		steps: 12,
		minutes: 24
	},
	{
		slug: 'kalman-filter',
		title: 'The Kalman filter',
		summary:
			'Blend a prediction with a noisy measurement in proportion to how much each can be trusted, and repeat: watch the uncertainty ellipse grow on every prediction and shrink on every fix, the filter become surer than its sensor, an accelerometer and a GPS beat either alone, and a filter with the wrong model lag round a corner, confidently.',
		accent: '#1971c2',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'radar-sonar',
		title: 'Radar & sonar',
		summary:
			'Fire a pulse at two targets and time the echoes; watch them fade as 1/R⁴, merge when the pulse is too long and drown when it is too short, until a chirp and a matched filter give both reach and sharpness. Then read a speed from the Doppler shift, pull a small boat out of the clutter on a range-Doppler map, and take the whole thing under water.',
		accent: '#0c8599',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'k-means-clustering',
		title: 'Finding groups: k-means',
		summary:
			'Hide the species of 342 real penguins and let a computer sort them into groups by itself: drop centres, colour by the nearest, move each centre to the middle, repeat. Then see why it needs to be told how many groups, and where it goes wrong.',
		accent: '#1c7ed6',
		steps: 10,
		minutes: 15
	},
	{
		slug: 'abs-brakes',
		title: 'ABS & the tire’s grip',
		summary:
			'Brake a car from 100 km/h on dry asphalt, wet asphalt and snow with a measured tyre friction curve: find the slip where the tyre grips best, lock the wheel and slide, then let ABS cycle the brake to hold the wheel near the peak and keep the steering.',
		accent: '#e8590c',
		steps: 8,
		minutes: 20
	},
	{
		slug: 'bicycle-stability',
		title: 'Why a bicycle balances itself',
		summary:
			'Push a riderless bicycle and watch it fall, recover or slowly topple depending on its speed. Then find the self-stable band in the eigenvalues of its equations of motion, and see which parts of the design make it: trail, head angle, the wheels’ spin, and a bicycle with none of the usual ones.',
		accent: '#1971c2',
		steps: 9,
		minutes: 20
	},
	{
		slug: 'gas-turbines-combined-cycle',
		title: 'Combined-cycle power plants',
		summary:
			'Set a gas turbine’s pressure ratio and firing temperature and watch most of the fuel’s heat leave as hot exhaust. Then boil water with that exhaust in a heat-recovery steam generator, match its heating line to the cooling gas on a temperature-heat diagram, and take the plant past 60 percent.',
		accent: '#e8590c',
		steps: 7,
		minutes: 20
	},
	{
		slug: 'heat-pumps-refrigeration',
		title: 'Heat pumps & refrigeration',
		summary:
			'Run a real refrigerant around a vapour-compression cycle on its pressure-enthalpy diagram: boil it cold, compress it, condense it hot, drop its pressure. See why a heat pump delivers several units of heat for each unit of work, how that falls as the temperature lift grows, and what happens with propane and with CO2 above its critical point.',
		accent: '#e03131',
		steps: 8,
		minutes: 20
	},
	{
		slug: 'cellular-automata',
		title: 'Cellular automata',
		summary:
			'Write a rule as an eight-bit table, apply it to a row of cells all at once, and stack the generations: a Sierpinski triangle, a pattern that looks random but isn’t, and structures that collide. Then survey all 256 rules, and watch one of them run a traffic jam.',
		accent: '#e8590c',
		steps: 7,
		minutes: 15
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
