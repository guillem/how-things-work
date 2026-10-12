import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { formatCelsius, formatPressureSlider } from './format';

/**
 * Every step shows the box of molecules (scene `box`). Its hints say which
 * substance is in the box (`sub`), the temperature in °C (`T`) and the pressure
 * as log₁₀ of atmospheres (`P`) when no control sets them, which controls set
 * them (`tParam`, `pParam`, `subParam`), and what the side panel shows
 * (`panel`: `states`, `energy`, `diagram`, `ring`).
 */

type RangeControl = Extract<Control, { type: 'range' }>;

const temperature = (
	id: string,
	def: number,
	min: number,
	max: number,
	label = 'Temperature'
): RangeControl => ({
	type: 'range',
	id,
	label,
	min,
	max,
	step: 1,
	default: def,
	format: formatCelsius
});

const pressure = (id: string, def: number, min = -3, max = 3): RangeControl => ({
	type: 'range',
	id,
	label: 'Pressure',
	min,
	max,
	step: 0.05,
	default: def,
	format: formatPressureSlider,
	help: 'The scale is logarithmic: each step to the right multiplies the pressure.'
});

const substance: Control = {
	type: 'select',
	id: 'exploreSub',
	label: 'Substance',
	default: 'co2',
	options: [
		{ value: 'co2', label: 'Carbon dioxide' },
		{ value: 'water', label: 'Water' }
	]
};

/** log₁₀ of 50 atm. */
const ATM50 = Math.log10(50);

export const spec: ExplainerSpec = {
	slug: 'states-of-matter',
	title: 'States of matter and phase changes',
	summary:
		'Heat, cool and squeeze a box of molecules and watch it freeze, melt, boil and condense while a phase diagram tracks its state. Then switch to water and find out why ice floats.',
	chapters: [
		{ id: 'states', title: 'Three states, one kind of molecule' },
		{ id: 'changes', title: 'Changing state' },
		{ id: 'water', title: 'Water is different' }
	],
	steps: [
		// ------------------------------------------------------------------ states
		{
			id: 'solid',
			chapter: 'states',
			title: 'A solid: molecules locked in place',
			scene: 'box',
			hints: { sub: 'co2', T: -100, P: 0, panel: 'states' },
			duration: 18,
			body: `
<p>This box holds 80 molecules of carbon dioxide, at −100 °C and normal air pressure, <dfn data-def="The pressure of the air at sea level on an average day: 101,325 pascals (101 kPa). Pressure is force per area.">1 atmosphere</dfn>. A heavy lid, the <strong>piston</strong>, presses down on them with that pressure. At this temperature carbon dioxide is a solid: dry ice.</p>
<p>The molecules sit in neat rows, a <dfn data-def="A regular, repeating arrangement of particles in a solid.">crystal</dfn>. They are not still: each one <strong>vibrates</strong> about its place. Follow the highlighted molecule; its trail shows where it was in the last six seconds. It shakes, but its neighbours hold it where it is.</p>
<p>That is why a solid keeps its shape: every molecule stays next to the same neighbours.</p>`,
			notes: `<p>The box is a <dfn data-def="A computer simulation that moves every molecule with Newton's laws, step by tiny step, using the forces the molecules exert on each other.">molecular dynamics</dfn> simulation, simplified on purpose: it is flat (2D), it holds 80 molecules instead of the about 10²³ in a lump of dry ice, and each carbon dioxide molecule (really a straight O=C=O) is drawn as a round particle. A weak gravity pulls the molecules to the bottom of the box, as in a real container.</p>`
		},
		{
			id: 'liquid',
			chapter: 'states',
			title: 'A liquid: touching, but sliding past each other',
			scene: 'box',
			hints: { sub: 'co2', T: -20, P: ATM50, panel: 'states' },
			duration: 20,
			body: `
<p>Now the same molecules at −20 °C, squeezed at 50 atmospheres: carbon dioxide is a <strong>liquid</strong>, as it is inside a fire extinguisher.</p>
<p>The molecules are still packed against each other, almost as closely as in the solid, but the rows are gone. They jostle and <strong>slide past each other</strong>: the trail of the highlighted molecule (the last six seconds) shows it slowly working its way through the crowd, squeezing between neighbours, something the molecules of a solid hardly ever do.</p>
<p>That is why a liquid flows and takes the shape of its container, but keeps its <strong>volume</strong>: the molecules still touch, so you can hardly squeeze it.</p>`
		},
		{
			id: 'gas',
			chapter: 'states',
			title: 'A gas: flying free',
			scene: 'box',
			hints: { sub: 'co2', T: 20, P: 0, panel: 'states' },
			duration: 20,
			body: `
<p>At room temperature, 20 °C, and 1 atmosphere, carbon dioxide is a <strong>gas</strong>, the one we breathe out.</p>
<p>The molecules have broken away from each other. Each one flies in a straight line until it hits another molecule or a wall, then flies off in a new direction: the trail of the highlighted molecule is a zigzag across the whole box. The gas has pushed the piston all the way up to its stop.</p>
<p>A gas fills whatever container it is in. Its molecules are far apart, so it is easy to squeeze, and their constant hits on the walls and the piston are its <dfn data-def="The force of the molecules' hits on a surface, per area of the surface.">pressure</dfn>.</p>`,
			notes: `<p>A real gas is far emptier than this box. In air at room temperature the molecules are about ten times their own size apart, and each flies about 70 nanometres, a few hundred times its size, between collisions. The box would have to be enormous to show that with 80 molecules.</p>`
		},
		{
			id: 'balance',
			chapter: 'states',
			title: 'Attraction against motion',
			scene: 'box',
			hints: { sub: 'co2', P: ATM50, tParam: 'balanceT', panel: 'energy' },
			duration: 26,
			controls: [temperature('balanceT', -90, -100, 100)],
			body: `
<p>Why three states? Two things compete. Molecules <strong>attract</strong> each other weakly when they are close, a little like the attraction between the slightly charged ends of polar molecules in <a href="../chemical-bonds/">Chemical bonds</a>, but weaker. Pushed too close, they <strong>repel</strong> strongly. The chart shows the energy of a pair of molecules against their distance: the dip is where they would like to sit, and its depth is how much energy it takes to pull them apart.</p>
<p>Against this works their <strong>motion</strong>. <dfn data-def="A measure of how fast the molecules of a substance jiggle: proportional to their average kinetic energy.">Temperature</dfn> measures the average energy of that motion (see <a href="../entropy/">Heat and entropy</a>). Slide the temperature up: while the motion's energy is small compared with the depth of the dip, the molecules stay trapped in place: a solid. Somewhat more, and they can roll from one neighbour to the next: a liquid. When the motion's energy is about as big as the dip, nothing holds them: a gas.</p>`,
			notes: `<p>The curve is the <dfn data-def="A simple formula for the energy of two neutral molecules at distance r: 4ε[(σ/r)¹² − (σ/r)⁶], with a steep repulsion and a weak attraction.">Lennard-Jones</dfn> energy used in the simulation. The energies are in units of the depth of the dip, ε. The line marks the average kinetic energy per molecule in the box, k<sub>B</sub>T in a flat world. The box's temperature in these units is not the real one: in 2D the liquid range is much narrower than in 3D, so the box is set to the state that the real temperature and pressure give (more on this in the next chapter).</p>`
		},
		// ------------------------------------------------------------------ changes
		{
			id: 'heat',
			chapter: 'changes',
			title: 'Melting and boiling',
			scene: 'box',
			hints: { sub: 'co2', P: ATM50, tParam: 'heatT', panel: 'diagram' },
			duration: 30,
			controls: [temperature('heatT', -90, -100, 60)],
			body: `
<p>Keep the pressure at 50 atmospheres and warm the box from −90 °C. At −55.6 °C the crystal falls apart: it <strong>melts</strong>. Warm on: at 14.8 °C the liquid <strong>boils</strong>, the molecules fly apart and push the piston up. Cool it down again and the gas <strong>condenses</strong> back into a liquid, which then <strong>freezes</strong>.</p>
<p>The chart on the right is the <dfn data-def="A map of temperature and pressure showing which state, solid, liquid or gas, a substance is in at each combination.">phase diagram</dfn> of carbon dioxide, from measurements. The dot is the box's temperature and pressure; moving the slider moves it sideways. Each time it crosses a line, the substance changes state.</p>`,
			notes: `<p>Changes of state take a moment in the box: it takes a few seconds to melt the crystal or boil the liquid away. A real pot of water takes far longer, because every molecule that breaks free needs energy: while ice melts or water boils, the heat from the stove goes into pulling molecules apart, not into warming them, and the temperature stays at 0 °C or 100 °C until the change is complete. That energy is the <dfn data-def="The energy needed to change the state of a substance without changing its temperature (to melt or to boil it).">latent heat</dfn>. In this simulation a thermostat sets the temperature directly, so it does not show that pause.</p><p>Phase boundaries of carbon dioxide: R. Span and W. Wagner, J. Phys. Chem. Ref. Data 25, 1509 (1996).</p>`
		},
		{
			id: 'squeeze',
			chapter: 'changes',
			title: 'Squeezing a gas into a liquid',
			scene: 'box',
			hints: { sub: 'co2', T: 0, pParam: 'squeezeP', panel: 'diagram' },
			duration: 26,
			controls: [pressure('squeezeP', 1, 0, 2)],
			body: `
<p>Temperature isn't the only way across a line. Hold carbon dioxide at 0 °C and push the piston harder. The gas is squeezed into less room, the molecules come closer together, and above <strong>34.4 atmospheres</strong> the attraction wins: the gas <strong>condenses</strong> into a liquid. Let the pressure off and the liquid <strong>boils</strong> again, without any heating.</p>
<p>The boiling point depends on the pressure. That's how carbon dioxide is kept liquid in a fire extinguisher or a soda-maker's cylinder at room temperature: at 20 °C it is under about 56 atmospheres.</p>`,
			notes: `<p>The pressure at which a liquid boils at a given temperature is its <dfn data-def="The pressure of a gas in balance with its liquid (or solid) at a given temperature; the liquid boils when the pressure on it falls below it.">vapour pressure</dfn>: for carbon dioxide 34.4 atm at 0 °C and 56.5 atm at 20 °C (Span and Wagner 1996). On the diagram, the line between liquid and gas is the vapour pressure at every temperature.</p>`
		},
		{
			id: 'diagram',
			chapter: 'changes',
			title: 'The phase diagram',
			scene: 'box',
			hints: { sub: 'co2', tParam: 'diagT', pParam: 'diagP', panel: 'diagram' },
			duration: 30,
			controls: [temperature('diagT', -20, -100, 400), pressure('diagP', ATM50)],
			body: `
<p>Now move both. Each region of the diagram is a state; each line is where two states can exist side by side (an ice cube floating in water at 0 °C sits right on a line). Crossing the <strong>melting line</strong> melts or freezes, crossing the <strong>boiling line</strong> boils or condenses.</p>
<p>Two points stand out. At the <dfn data-def="The one temperature and pressure at which solid, liquid and gas can all exist together.">triple point</dfn> all three states meet: for carbon dioxide at −56.6 °C and 5.1 atm. The boiling line stops at the <dfn data-def="The end of the boiling line. Beyond it liquid and gas can no longer be told apart.">critical point</dfn>, 31.0 °C and 72.8 atm. Go round it, above and to the right, and you can turn a gas into a liquid without ever seeing it boil or condense: beyond the critical point the substance is a single <dfn data-def="A substance above its critical temperature and pressure: dense like a liquid, but filling its container like a gas.">supercritical fluid</dfn>.</p>`,
			notes: `<p>Supercritical carbon dioxide is used to take the caffeine out of coffee beans: it seeps into the beans like a gas and dissolves caffeine like a liquid. In the box the change at the critical point looks sharper than it really is: 80 molecules are too few to show the gradual change.</p>`
		},
		{
			id: 'dryice',
			chapter: 'changes',
			title: 'Dry ice skips the liquid',
			scene: 'box',
			hints: { sub: 'co2', P: 0, tParam: 'dryT', panel: 'diagram' },
			duration: 26,
			controls: [temperature('dryT', -100, -100, 20)],
			body: `
<p>Normal air pressure, 1 atm, is <strong>below</strong> carbon dioxide's triple point of 5.1 atm. Along the 1 atm line there is no liquid region at all. Warm dry ice from −100 °C: at <strong>−78.5 °C</strong> the crystal turns straight into gas. That is <dfn data-def="Changing directly from a solid to a gas, without melting first.">sublimation</dfn>, which is why dry ice leaves no puddle, only a cold fog (water vapour from the air, condensed by the cold).</p>
<p>The opposite, gas straight to solid, is <dfn data-def="Changing directly from a gas to a solid.">deposition</dfn>: frost on a cold window is water vapour turned straight into ice.</p>`
		},
		// ------------------------------------------------------------------ water
		{
			id: 'ice',
			chapter: 'water',
			title: 'The open lattice of ice',
			scene: 'box',
			hints: { sub: 'water', T: -10, P: 0, panel: 'ring' },
			duration: 22,
			body: `
<p>Switch the substance to <strong>water</strong>, at −10 °C and 1 atm: ice. Its molecules don't just stick to whoever is near. Each one forms <dfn data-def="An especially strong attraction between a hydrogen bonded to N, O or F on one molecule (strongly δ+) and a lone pair on an N, O or F atom of another.">hydrogen bonds</dfn> in a few fixed directions (see <a href="../chemical-bonds/">Chemical bonds</a>). In this flat model each molecule has three arms, the directions in which it can bond, and a bond (the dashed lines) forms only when an arm points straight at a neighbour.</p>
<p>To bond every arm, the molecules have to stand apart at fixed angles, around <strong>open hexagons</strong>. The crystal is full of holes. Real ice does the same in 3D: each molecule bonds to four neighbours, and the crystal is a stack of hexagonal rings with open channels through it. That is also where snowflakes get their six-fold shape.</p>`,
			notes: `<p>The water in the box is the <dfn data-def="A simple 2D model of water: discs with three hydrogen-bonding arms 120° apart, proposed by Ben-Naim in 1971 and named after the car maker's logo.">Mercedes-Benz model</dfn> (A. Ben-Naim, J. Chem. Phys. 54, 3682, 1971; K. A. T. Silverstein, A. D. J. Haymet and K. A. Dill, J. Am. Chem. Soc. 120, 3166, 1998), the standard flat model for water's odd behaviour. A bond has energy −1 when the two molecules are 1 unit apart and an arm of each points at the other, and weakens fast as they move or turn away; a weaker attraction acts between all molecules.</p>`
		},
		{
			id: 'melt',
			chapter: 'water',
			title: 'Why ice floats',
			scene: 'box',
			hints: { sub: 'water', P: 0, tParam: 'meltT', panel: 'diagram' },
			duration: 30,
			controls: [temperature('meltT', -10, -30, 60)],
			body: `
<p>Warm the ice past 0 °C. The hydrogen bonds keep breaking and re-forming, the hexagons collapse, and the molecules crowd into the holes: the <strong>liquid takes less room than the ice</strong>, and the piston sinks below the dashed line where it rested on the ice.</p>
<p>Real ice has a density of <strong>0.9167 g/cm³</strong>, water at 0 °C <strong>0.9998 g/cm³</strong>: the same mass of ice takes about 9% more room. Almost every other substance is denser as a solid, and its solid sinks in its own liquid. Ice floats, with about 92% of it under the surface, so lakes freeze from the top down, and the ice on top shelters the water and the fish below. And water expanding as it freezes is what bursts frozen pipes.</p>
<p>Cool it below 0 °C again: the liquid freezes back into the open lattice, and the piston rises.</p>`,
			notes: `<p>Freezing is slow to start, in a computer as in a glass of water: the molecules must happen to line up into a small crystal before the rest can join it. In a real glass that usually starts on a speck of dust or a scratch. A box this small would have to be simulated for far too long, so when the water should freeze but is still disordered, the simulation takes a shortcut: over two seconds the molecules glide to the nearest places in the ice lattice, then carry on moving by themselves. Melting needs no shortcut.</p><p>Densities: ice Ih at 0 °C and 1 atm, 916.72 kg/m³ (IAPWS R10-06, 2009); liquid water at 0 °C, 999.84 kg/m³ (IAPWS-95).</p>`
		},
		{
			id: 'water-diagram',
			chapter: 'water',
			title: "Water's phase diagram",
			scene: 'box',
			hints: { sub: 'water', tParam: 'waterT', pParam: 'waterP', panel: 'diagram' },
			duration: 30,
			controls: [temperature('waterT', 25, -100, 400), pressure('waterP', 0)],
			body: `
<p>At 1 atm water is ice at −10 °C, liquid at 25 °C and steam at 110 °C. Lower the pressure and it boils at a lower temperature: at the top of Mount Everest, about a third of an atmosphere, water boils at about <strong>72 °C</strong>, which is why it's hard to cook there. A pressure cooker does the opposite: at 2 atm water boils at 121 °C.</p>
<p>Look at the melting line: it leans <strong>backwards</strong>. Squeeze ice and it melts at a lower temperature, about −9 °C under 1,000 atmospheres. That is the floating ice again: pressure favours the state that takes less room, and for water that is the liquid. For carbon dioxide, like most substances, the line leans forwards.</p>
<p>Water's triple point is at 0.01 °C and only 0.006 atm; its critical point at 374 °C and 218 atm.</p>`,
			notes: `<p>Phase boundaries of water from the International Association for the Properties of Water and Steam: the vapour pressure from the IAPWS-95 formulation (W. Wagner and A. Pruß, 1993), the melting and sublimation lines from IAPWS R14-08 (2011). The melting line shown is that of ordinary ice (ice Ih); above about 2,000 atm other, denser kinds of ice take over. Pressure on the summit of Everest, 33.7 kPa: J. B. West and others, J. Appl. Physiol. 54, 1188 (1983). The pressure of a skate's blade lowers the melting point by much less than a degree, so it does not explain why ice is slippery.</p>`
		},
		{
			id: 'explore',
			chapter: 'water',
			title: 'Explore',
			scene: 'box',
			hints: { subParam: 'exploreSub', tParam: 'exploreT', pParam: 'exploreP', panel: 'diagram' },
			duration: 40,
			controls: [substance, temperature('exploreT', 20, -100, 400), pressure('exploreP', 0)],
			body: `
<p>Now try anything: pick a substance, then heat, cool, squeeze and release it. Find the conditions where carbon dioxide can be a liquid, or make water boil at room temperature by lowering the pressure.</p>
<p>Whatever you do, it's always the same molecules. <strong>Solid, liquid and gas are the same molecules balancing attraction against thermal motion</strong>, and pressure tips the balance by pushing them together. <strong>Water is unusual because its solid is less dense than its liquid</strong>: its hydrogen bonds hold the ice crystal open.</p>`
		}
	]
};
