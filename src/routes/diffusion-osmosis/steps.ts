import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 0,
	max: 80,
	step: 5,
	default: 20,
	format: (v) => `${v} °C`,
	help: 'Changing it drops the dye again.'
};

const redrop: Control = { type: 'action', id: 'redrop', label: 'Dye', action: 'Drop again' };

const sugarL: Control = {
	type: 'range',
	id: 'sugarL',
	label: 'Sugar on the left',
	min: 0,
	max: 2,
	step: 0.1,
	default: 1,
	format: (v) => `${v.toFixed(1)} mmol/L`,
	help: 'Changing the sugar starts again with equal water levels.'
};

const sugarR: Control = {
	type: 'range',
	id: 'sugarR',
	label: 'Sugar on the right',
	min: 0,
	max: 2,
	step: 0.1,
	default: 0,
	format: (v) => `${v.toFixed(1)} mmol/L`
};

const press: Control = {
	type: 'range',
	id: 'press',
	label: 'Press on the left',
	min: 0,
	max: 4,
	step: 0.1,
	default: 0,
	format: (v) => `${v.toFixed(1)} kPa`,
	help: 'A piston on the sugary side; 1 kPa is the weight of a 10 cm column of water.'
};

const salt: Control = {
	type: 'range',
	id: 'salt',
	label: 'Salt in the water outside',
	min: 0,
	max: 3,
	step: 0.05,
	default: 0.9,
	format: (v) =>
		v === 0
			? '0 % (pure water)'
			: Math.abs(v - 0.9) < 1e-9
				? '0.9 % (like blood plasma)'
				: `${v.toFixed(2)} %`
};

const sucrose: Control = {
	type: 'range',
	id: 'sucrose',
	label: 'Sugar in the water outside',
	min: 0,
	max: 1,
	step: 0.05,
	default: 0,
	format: (v) => (v === 0 ? '0 mol/L (pure water)' : `${v.toFixed(2)} mol/L`)
};

const pumpOn: Control = { type: 'toggle', id: 'pump', label: 'Pump', default: true };

const restart: Control = { type: 'action', id: 'restart', label: 'Cell', action: 'Start again' };

const respire: Control = {
	type: 'toggle',
	id: 'respire',
	label: 'Respiration making ATP',
	default: true
};

/**
 * Scenes: `box` (dye spreading in a box of water; focus 'drop' with the concentration graph,
 * 'count' with a line down the middle and its two crossing counters, 'warm' with the spread
 * against time and the distance table), `tank` (two columns of water joined by a membrane;
 * focus 'levels' or 'push'), `cell` (a cell in a solution; kind 'blood' or 'potato') and `pump`
 * (a membrane with a leak channel and a pump; focus 'pump' or 'upkeep').
 */
export const spec: ExplainerSpec = {
	slug: 'diffusion-osmosis',
	title: 'Diffusion, osmosis & active transport',
	summary:
		'Drop dye into a box of water and watch random jiggling spread it, faster when warmer; put a membrane in the way that passes water but not sugar and watch the water climb on the sugary side; put a blood cell and a potato cell in pure water and salt water; then switch on a pump that carries particles uphill and watch its ATP run down.',
	chapters: [
		{ id: 'diffusion', title: 'Diffusion: spreading by chance' },
		{ id: 'osmosis', title: 'Osmosis: water through a membrane' },
		{ id: 'cells', title: 'Cells in a solution' },
		{ id: 'active', title: 'Active transport: going uphill' }
	],
	steps: [
		// ------------------------------------------------------------------ diffusion
		{
			id: 'drop',
			chapter: 'diffusion',
			title: 'A drop of dye',
			scene: 'box',
			hints: { focus: 'drop' },
			duration: 45,
			controls: [temp, redrop],
			body: `
<p>This box of water is 0.2 mm wide, far smaller than a raindrop. A drop of green dye (<dfn data-def="A dye that glows green under blue light; its molecules are about a nanometre across, a few times bigger than a water molecule.">fluorescein</dfn>) has just been put in its top-left corner. Nobody stirs it.</p>
<p>As in <a href="../states-of-matter/#liquid">any liquid</a>, the water molecules never stop moving: they jostle the dye molecules from every side, millions of times a second, so each dye molecule <strong>jiggles</strong> in a random direction, then another, then another. This is <dfn data-def="The random jiggling of small particles in a liquid or gas, caused by the molecules around them bumping into them. Named after Robert Brown, who saw tiny particles released from pollen grains move this way under a microscope in 1827.">Brownian motion</dfn>.</p>
<p>Watch the dye spread out until it fills the box evenly. The graph under the box counts how much dye is in each slice: a tall bar at the left at first, then lower and lower, until all the bars are the same height. This spreading from where particles are crowded to where they are not is <strong>diffusion</strong>.</p>`,
			notes: `<p>The box is flat (the simulation moves the molecules in two dimensions) and each dot stands for a great many dye molecules. Each dot takes a random step every tenth of a second, drawn so that it spreads exactly as fluorescein does in water: its <dfn data-def="How fast a substance spreads by diffusion: in a time t its molecules move about √(2Dt) along any one direction.">diffusion coefficient</dfn> D is 0.000425 mm² per second at 25 °C (measured by Culbertson, Jacobson and Ramsey, 2002). The movie runs in real time.</p>`
		},
		{
			id: 'counting',
			chapter: 'diffusion',
			title: 'No push, just counting',
			scene: 'box',
			hints: { focus: 'count' },
			duration: 45,
			controls: [redrop],
			body: `
<p>Nothing pushes the dye to the right. Follow the highlighted molecule: each step is as likely to go left as right, up as down, wherever it is. It has no idea where the other dye molecules are.</p>
<p>So why does the dye move right? Count the molecules that cross the dashed line in the middle. Molecules equally far from the line have the same chance of crossing it, from either side; but at first there are many more on the left, so many more cross to the right than back. The difference between the two counts is how many dye molecules have moved right overall: the <strong>net flow</strong> is just a difference of counts.</p>
<p>Once the dye is even, molecules still cross both ways, all the time, but about as many go one way as the other: both counts keep growing at the same pace, their difference stops changing, and the net flow is zero. Diffusion needs no force and no pump; random motion and unequal numbers are enough.</p>`,
			notes: `<p>The same counting is why a smell spreads through a still room and why oxygen moves from the air in your lungs into your blood, where there is less of it. The rule that the net flow is proportional to how steeply the concentration changes is <dfn data-def="Adolf Fick's law of diffusion (1855): the net flow through a surface is −D times the concentration gradient.">Fick's law</dfn>. Counting arrangements of mixed particles is the subject of <a href="../entropy/#mix">entropy</a>.</p>`
		},
		{
			id: 'warmer',
			chapter: 'diffusion',
			title: 'Faster when warmer, slower with distance',
			scene: 'box',
			hints: { focus: 'warm' },
			duration: 45,
			controls: [temp, redrop],
			body: `
<p>Warm the water and drop the dye again. The dye spreads faster: at 80 °C more than three times as fast as at 20 °C, at 0 °C half as fast. Warmer molecules move faster, and warm water is also runnier, so the dye slips through it more easily.</p>
<p>The chart shows how far the dye has spread from the corner (on average) against time; the dashed curve is 20 °C. It is not a straight line: to spread <em>twice</em> as far takes <strong>four</strong> times as long. Distance grows as the <dfn data-def="The square root of a number is the number that, multiplied by itself, gives it: √4 = 2, √100 = 10.">square root</dfn> of time.</p>
<p>That is why diffusion is fast over the width of a cell and hopeless over the length of a body. The table works it out for the dye: about a tenth of a second for 10 µm, the size of a cell; twenty minutes for a millimetre; decades for a metre. Large animals need lungs, blood and a heart to move things over long distances; diffusion only does the last few micrometres.</p>`,
			notes: `<p>The table uses the typical spread along one direction, √(2Dt), so the time to cover a distance x is x²/(2D). The chart draws the root-mean-square distance from the corner, which grows as √(4Dt) in two dimensions until the far walls stop it. The dye's diffusion coefficient follows the Stokes–Einstein relation D = kT/(6πηr): proportional to the absolute temperature T and inversely to the water's viscosity η, which falls from 1.0 mPa·s at 20 °C to 0.35 at 80 °C. Einstein explained Brownian motion this way in 1905, and Jean Perrin's measurements of it in 1908 helped convince scientists that molecules are real.</p>`
		},
		// ------------------------------------------------------------------ osmosis
		{
			id: 'membrane',
			chapter: 'osmosis',
			title: 'A membrane that holds sugar back',
			scene: 'tank',
			hints: { focus: 'levels' },
			duration: 36,
			controls: [sugarL, sugarR],
			body: `
<p>Now two columns of water, joined at the bottom by a <dfn data-def="A membrane with pores big enough for water molecules but too small for dissolved sugar, like a cell membrane with its water channels.">partially permeable membrane</dfn>: its pores let water molecules through but not sugar. The left side has sugar dissolved in it; the right side is pure water.</p>
<p>Watch the water level rise on the sugary side and fall on the other. Water flows through the membrane <strong>towards the side with more dissolved particles</strong>. This is <strong>osmosis</strong>.</p>
<p>It does not go on forever. As the left column grows taller, the weight of the extra water presses back, and the flow stops when that weight pushes as hard as the sugar does. Just 1 mmol of sugar per litre (a third of a gram of table sugar in a litre) holds up about a quarter of a metre of water. Put sugar on both sides: the water goes towards the side with more; make them equal and nothing moves.</p>`,
			notes: `<p>The push of the trapped sugar is the <dfn data-def="The pressure needed to stop water flowing through a membrane into a solution; for dilute solutions it is cRT (van 't Hoff, 1887).">osmotic pressure</dfn>, which for dilute solutions is cRT (Jacobus van 't Hoff, 1887): c is the concentration of dissolved particles, R the gas constant and T the absolute temperature. At 20 °C, 1 mmol/L gives 2.4 kPa, the weight of a 25 cm column of water. The levels here settle in seconds; how fast a real membrane lets water through depends on its area and pores, so the speed is the page's choice. A difference of 1 mmol/L that stayed the same would hold up a 25 cm difference between the levels. Here the sugar is diluted as water comes in: with 1 mmol/L on the left, the left rises about 9.5 cm and the right falls about 9.5 cm, a 19 cm difference.</p>`
		},
		{
			id: 'push',
			chapter: 'osmosis',
			title: 'Why the water moves',
			scene: 'tank',
			hints: { focus: 'push' },
			duration: 36,
			controls: [sugarL, press],
			body: `
<p>A tempting explanation is that sugar "dilutes" the water, so fewer water molecules reach the pores on the sugary side and water just diffuses across, as the dye did. That is not what happens. The flow through a membrane with pores is several times larger than water molecules diffusing one by one could carry.</p>
<p>What drives it is the sugar that cannot get through. Each sugar molecule that reaches the membrane bounces back off it; all those bounces <strong>push on the membrane</strong> and lower the pressure of the water at the pores on the sugary side. Water is then pushed through the pores from the other side as a stream, the way water runs along a hose from high pressure to low.</p>
<p>You can test it. Press on the sugary side with a piston: at a push equal to the sugar's (2.4 kPa for 1 mmol/L) the flow stops. Press harder and it <strong>reverses</strong>: water is squeezed out of the sugar water into the pure side. Desalination plants make drinking water from seawater this way, by <dfn data-def="Pressing salt water against a membrane harder than its osmotic pressure, so that pure water flows out of it.">reverse osmosis</dfn>.</p>`,
			notes: `<p>The distinction between osmotic flow and water's own diffusion is measured by comparing the "osmotic" permeability of a membrane with its "diffusional" permeability to labelled water: for membranes with pores the osmotic one is several times larger, because water moves through the pores as a bulk flow (Kramer and Myers, <i>Trends in Plant Science</i>, 2013, "Osmosis is not driven by water dilution"). In this model the water flow through the membrane is proportional to the net push: the sugar's osmotic pressure minus the weight of the extra water minus the piston. The sugar molecules are drawn bouncing in straight lines between collisions, much enlarged.</p>`
		},
		// ------------------------------------------------------------------ cells
		{
			id: 'blood-cell',
			chapter: 'cells',
			title: 'A red blood cell: swell, shrink or hold',
			scene: 'cell',
			hints: { kind: 'blood' },
			duration: 24,
			controls: [salt],
			body: `
<p>A cell is a bag of water with things dissolved in it, wrapped in a <a href="../the-cell/#membrane">membrane</a> that lets water through quickly but holds most dissolved particles back. So a cell is a little osmosis experiment.</p>
<p>A red blood cell normally floats in plasma, which has as many dissolved particles as the cell's inside: in salt water of 0.9 % (9 g per litre, "normal saline") it <strong>holds</strong> its shape, a dimpled disc. Slide the salt up and water leaves the cell: it <strong>shrinks</strong> and crinkles. Slide it down and water flows in: the cell <strong>swells</strong> into a ball.</p>
<p>An animal cell has nothing around it but its membrane, and the membrane barely stretches. Below about 0.4 % salt the cell would need more volume than a ball of its membrane can hold, and it <strong>bursts</strong>. In pure water every red blood cell bursts. That is why drips in hospitals use 0.9 % saline, never pure water.</p>`,
			notes: `<p>The cell's volume follows the Boyle–van 't Hoff law: it takes in or loses water until its inside has as many dissolved particles per litre as the outside (290 milliosmoles per kg of water for plasma). About 40 % of the cell's volume (mostly the protein haemoglobin) takes no part (LeFevre 1964). A normal cell holds 90 fL in a membrane of 140 µm²; a sphere of that area holds 156 fL, and the model bursts the cell there. Doctors measure this in the osmotic fragility test: normal cells start to burst below about 0.45 % salt, and all of them have burst by about 0.3 %. Salt counts double, because each NaCl splits into two ions in water.</p>`
		},
		{
			id: 'potato',
			chapter: 'cells',
			title: 'A potato cell: firm, not burst',
			scene: 'cell',
			hints: { kind: 'potato' },
			duration: 24,
			controls: [sucrose],
			body: `
<p>A <a href="../the-cell/#plant">plant cell</a> has a stiff <strong>cell wall</strong> around its membrane. Put a potato cell in pure water and water flows in, as before; but once the cell presses against its wall, the wall presses back. The cell stops swelling while it is only about a tenth bigger and becomes <strong>firm</strong> (<dfn data-def="Swollen and firm because the wall presses back on the water inside: the state of a crisp lettuce leaf.">turgid</dfn>). It does not burst. Crisp lettuce and upright stems are cells like this.</p>
<p>In strong sugar water the cell loses water, and the membrane and its contents pull away from the wall (<dfn data-def="The shrinking of a plant cell's contents away from its wall when it loses water to a strong solution.">plasmolysis</dfn>). A plant in that state wilts.</p>
<p>This is the classroom experiment: weigh potato pieces, leave them in sugar solutions of different strengths, and weigh them again. The chart shows how much the cells swell or shrink; the water they gain or lose changes the pieces' mass by about the same share. They gain in weak solutions, lose in strong ones, and stay the same where the solution's pull on the water just balances the cells' own (the dissolved particles inside minus the wall's push), at about 0.3 mol/L.</p>`,
			notes: `<p>The plant cell follows the same law as the blood cell, plus the wall: water flows in until the sap's osmotic pressure minus the wall's push (the <dfn data-def="The pressure of the cell's contents against its wall, here up to about 0.85 MPa: eight times the pressure of the air.">turgor pressure</dfn>) equals the outside solution's osmotic pressure. The potato cell's numbers are the page's own illustrative choice, not a measurement: sap of 1.0 MPa, turgor 0.26 MPa in the fresh cell, a wall whose push rises by 0.05 MPa for each 1 % the cell grows once it touches the wall, and 40 % of the volume taking no part. They put the zero-change point at 0.3 mol/L, in the middle of what classroom experiments usually find (about 0.2–0.4 mol/L). The chart shows where the cells would settle; in a 30-minute experiment they only get part of the way, so measured changes are smaller.</p>`
		},
		// ------------------------------------------------------------------ active transport
		{
			id: 'pump',
			chapter: 'active',
			title: 'A pump that spends ATP',
			scene: 'pump',
			hints: { focus: 'pump' },
			duration: 90,
			controls: [pumpOn, restart],
			body: `
<p>Dissolved particles diffuse from where there are more of them to where there are fewer; water follows the pushes we have just seen. But cells often need to move dissolved particles the other way, against their concentration gradient. Root hair cells take up mineral ions from soil water that has fewer of them than the cell; cells lining the gut take up the last of the sugar from digested food.</p>
<p>For that the membrane has <strong>pumps</strong>: proteins that grab a particle on one side and carry it to the other, whatever the numbers on each side. That costs energy, from <a href="../respiration-atp/#equation">ATP</a>, the cell's energy currency made in respiration: in this simplified pump, one ATP molecule for each particle carried in. This is <strong>active transport</strong>.</p>
<p>Here, particles start evenly spread on both sides. With the pump on, they pile up inside the cell, on the right, while the ATP meter drains. A leak channel lets some back out by diffusion all the while. When the ATP runs out, the pump stops, and the leak evens the two sides out again.</p>`,
			notes: `<p>The pump here carries one particle per ATP, from outside to inside only, whenever a particle wanders into it. Real pumps differ: the sodium–potassium pump of animal cells moves three sodium ions out and two potassium ions in for each ATP, and many cells use the gradient one pump makes to drag a second substance along (glucose rides in with sodium in the gut). Ions also feel the membrane's voltage, which this page leaves out.</p>`
		},
		{
			id: 'upkeep',
			chapter: 'active',
			title: 'Holding a gradient costs energy all the time',
			scene: 'pump',
			hints: { focus: 'upkeep' },
			duration: 90,
			controls: [respire, restart],
			body: `
<p>Now respiration keeps refilling the ATP store. The pump builds the gradient and then <strong>holds</strong> it: the particles inside stay several times more crowded than outside.</p>
<p>But look at the pump's counter: it never stops. Every particle that leaks out has to be pumped back in, so holding a gradient costs ATP as long as it lasts. Switch respiration off and the store drains, then the gradient leaks away.</p>
<p>The least energy needed to move a particle uphill depends only on how many times more crowded the far side is: for ten times, about 6 kJ per mole of particles at body temperature. Splitting one mole of ATP releases about 50 kJ in a cell, so one ATP is enough for each trip, with energy to spare.</p>`,
			notes: `<p>The least work to move a mole of uncharged particles from concentration c₁ to c₂ is RT·ln(c₂/c₁) (5.9 kJ/mol for a factor of ten at 37 °C). The energy released by splitting ATP depends on conditions in the cell and is usually given as 50–60 kJ/mol. Keeping their sodium and potassium gradients is one of the biggest energy costs of animal cells, nerve cells especially.</p>`
		}
	]
};
