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
		steps: 5,
		minutes: 10
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
		slug: 'neural-networks',
		title: 'Neural networks and backpropagation',
		summary:
			'Build a network out of simple neurons, train it live and watch it bend a straight line into circles and spirals. Then follow one example forward through the network and its error backward, adjusting every weight.',
		accent: '#1971c2',
		steps: 11,
		minutes: 22
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
