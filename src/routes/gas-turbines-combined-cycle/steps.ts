import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const ratio: Control = {
	type: 'range',
	id: 'ratio',
	label: 'Pressure ratio',
	min: 4,
	max: 40,
	step: 1,
	default: 18,
	format: (v) => `${v} : 1`,
	help: 'How many times the compressor raises the air’s pressure.'
};

const tit: Control = {
	type: 'range',
	id: 'tit',
	label: 'Turbine inlet temperature',
	min: 1200,
	max: 1800,
	step: 10,
	default: 1650,
	format: (v) => `${v} K (${Math.round(v - 273.15)} °C)`
};

const pHigh: Control = {
	type: 'range',
	id: 'phigh',
	label: 'Steam pressure',
	min: 2,
	max: 16,
	step: 0.5,
	default: 12,
	unit: 'MPa',
	format: (v) => `${v} MPa (${Math.round(v * 10)} bar)`
};

const pinch: Control = {
	type: 'range',
	id: 'pinch',
	label: 'Pinch-point difference',
	min: 5,
	max: 40,
	step: 1,
	default: 10,
	unit: 'K',
	format: (v) => `${v} K`,
	help: 'How close the gas may come to the boiling water at the cold end of each evaporator.'
};

const levels: Control = {
	type: 'select',
	id: 'levels',
	label: 'Pressure levels',
	default: '1',
	options: [
		{ value: '1', label: 'One' },
		{ value: '2', label: 'Two' },
		{ value: '3', label: 'Three' }
	]
};

const levelsAll: Control = { ...levels, id: 'levelsall', default: '3' };

export const spec: ExplainerSpec = {
	slug: 'gas-turbines-combined-cycle',
	title: 'Combined-cycle power plants',
	summary:
		'Set a gas turbine’s pressure ratio and firing temperature and watch most of the fuel’s heat leave as hot exhaust. Then boil water with that exhaust in a heat-recovery steam generator, match its heating line to the cooling gas on a temperature-heat diagram, and take the plant past 60 percent.',
	chapters: [
		{ id: 'gt', title: 'The gas turbine' },
		{ id: 'hrsg', title: 'The heat-recovery boiler' },
		{ id: 'plant', title: 'The whole plant' }
	],
	steps: [
		// ------------------------------------------------------------------ gt
		{
			id: 'brayton',
			chapter: 'gt',
			title: 'A gas turbine, and where its heat goes',
			scene: 'plant',
			hints: { phase: 'gt' },
			duration: 22,
			controls: [ratio, tit],
			body: `
<p>A gas turbine is a jet engine bolted to the ground. Its compressor squeezes air (here 18 times), natural gas burns in it at constant pressure, and the hot gas expands through a turbine that drives both the compressor and a generator. This is the Brayton cycle of the page on heat engines, with real air and real combustion products whose heat capacity changes with temperature.</p>
<p>With a 1,650 K (1,377 °C) turbine inlet, it turns about 41% of the fuel’s heat into work, and the compressor takes back 45% of what the turbine makes. The rest of the fuel’s heat, nearly 60%, leaves the exhaust at about 650 °C: hot enough to run a whole second power plant.</p>
<p>Raise the pressure ratio: the gas turbine gets more efficient and its exhaust cooler. Raise the firing temperature: both go up.</p>`,
			notes: `<p>The model burns methane in dry air at 15 °C, with a compressor of isentropic efficiency 0.88, a turbine of 0.90 and a 3% pressure loss in the combustor. Gas properties come from NASA polynomials, which carry each gas’s heat of formation, so methane’s heating value (50.0 MJ/kg) falls out of the energy balance. The turbine is uncooled. Real machines bleed a fifth or more of the compressor air to cool their blades, so they need firing temperatures around 1,600 °C to reach what this model gets at 1,377 °C.</p>`
		},
		{
			id: 'exhaust',
			chapter: 'gt',
			title: 'The heat that goes up the stack',
			scene: 'plant',
			hints: { phase: 'exhaust' },
			duration: 18,
			controls: [ratio, tit],
			body: `
<p>A stand-alone gas turbine (an open-cycle or “peaker” plant) sends its exhaust straight up a chimney. It starts in minutes and is cheap to build, but it throws away more than half the fuel’s heat.</p>
<p>That exhaust is not low-grade heat. At 600 to 650 °C it is about as hot as the steam in the best coal plants. A steam power plant needs a fire, and the exhaust is one, already paid for.</p>`
		},
		// ------------------------------------------------------------------ hrsg
		{
			id: 'tq',
			chapter: 'hrsg',
			title: 'Boiling water with exhaust',
			scene: 'tq',
			hints: { phase: 'tq' },
			duration: 24,
			controls: [pHigh],
			body: `
<p>A heat-recovery steam generator (HRSG) is a tall duct full of tube bundles. The exhaust flows up through it and the water flows down in the tubes the other way. Plot both against the heat passed from one to the other and you get a temperature-heat (T–Q) diagram: the gas line falls from the exhaust temperature to the stack, and the water line rises beneath it.</p>
<p>The water line has three parts. In the <strong>economizer</strong> the water warms to its boiling point. In the <strong>evaporator</strong> it boils at constant temperature: a flat line, 325 °C at 12 MPa. In the <strong>superheater</strong> the steam heats on, here to 600 °C. The steam then drives a steam turbine, the Rankine cycle of the heat-engines page.</p>
<p>Heat flows only from hotter to colder, so the water line must stay below the gas line everywhere.</p>`
		},
		{
			id: 'pinch',
			chapter: 'hrsg',
			title: 'The pinch point',
			scene: 'tq',
			hints: { phase: 'pinch' },
			duration: 22,
			controls: [pinch, pHigh],
			body: `
<p>The flat boiling line is the problem. Where the evaporator starts, the gas must still be warmer than the boiling water. The narrowest gap between the two lines, the <dfn data-def="The smallest temperature difference between the gas and the water in a heat-recovery boiler, at the cold end of the evaporator; typically 5 to 15 K.">pinch point</dfn>, sets how much steam the boiler can make: the gas above the pinch is all the heat available for boiling and superheating.</p>
<p>Shrink the pinch and the boiler makes more steam and sends cooler gas up the stack. But a small temperature difference moves heat slowly, so the tube bundles have to be far larger: real plants settle around 5 to 15 K.</p>
<p>Now raise the steam pressure. Each kilogram of steam then does more work in the turbine, but it boils hotter, so the flat line climbs towards the gas line and less steam is made.</p>`
		},
		{
			id: 'levels',
			chapter: 'hrsg',
			title: 'Two and three pressure levels',
			scene: 'tq',
			hints: { phase: 'levels' },
			duration: 24,
			controls: [levels, pinch],
			body: `
<p>One flat boiling line can’t follow a sloping gas line. A second evaporator at a lower pressure (here 2.5 MPa, boiling at 224 °C) and a third (0.4 MPa, 144 °C) put more flat steps under the gas line, each with its own pinch, so the water line hugs the gas line more closely.</p>
<p>Add the levels and watch the stack temperature fall: from about 115 °C with one level to about 70 °C with three, and the plant gains another point of efficiency. Modern large plants use three levels and reheat the high-pressure steam between turbine stages.</p>`,
			notes: `<p>The model’s boiler is simplified: each level’s superheater, evaporator and economizer follow one another along the gas path, and each economizer heats the water for its own level and every level above it. Real boilers interleave the sections to follow the gas line even more closely, reheat the steam, deaerate the feedwater and keep the stack warm enough to avoid acid condensation. The lower levels here make little steam because the high-pressure economizer comes first.</p>`
		},
		// ------------------------------------------------------------------ plant
		{
			id: 'plant',
			chapter: 'plant',
			title: 'Past 60 percent',
			scene: 'plant',
			hints: { phase: 'plant' },
			duration: 22,
			controls: [ratio, tit, levelsAll],
			body: `
<p>Put the two together. Of the fuel’s heat, the gas turbine turns about 41% into work. The steam cycle turns another 20% into work from the exhaust, while only about 5% leaves the stack. The rest goes to the steam cycle’s condenser, as in any steam plant. In total, about 62%.</p>
<p>The steam turbine burns no fuel of its own. Every bit of its work comes from heat the gas turbine would otherwise have thrown away, which is why a combined-cycle plant beats any single engine: the gas turbine takes heat in very hot, the steam cycle rejects it almost cold.</p>`,
			notes: `<p>The model leaves out generator and gearbox losses, auxiliary power, the boiler’s back pressure on the gas turbine and turbine cooling, and it assumes ideal combustion. Together these take a few points off. The best plants in service, with turbine inlet temperatures above 1,600 °C and reheat, are rated at around 63 to 64% on the lower heating value.</p>`
		},
		{
			id: 'optimum',
			chapter: 'plant',
			title: 'The best gas turbine for the job',
			scene: 'ratio',
			hints: { phase: 'ratio' },
			duration: 22,
			controls: [tit],
			body: `
<p>Here is a twist. Plot efficiency against pressure ratio for the gas turbine alone and for the whole plant. The gas turbine alone keeps improving to very high ratios. The combined plant peaks much earlier: a higher ratio cools the exhaust, which starves the steam cycle.</p>
<p>So the best gas turbine for a combined cycle is not the most efficient one on its own. It runs at a lower pressure ratio and leaves a hotter exhaust, giving up a little of its own efficiency for a lot more steam. Manufacturers design their big machines around this.</p>`,
			notes: `<p>Because this model’s turbine is uncooled and its component efficiencies don’t change with size, its gas turbine peaks at unrealistically high pressure ratios (above 60 at 1,650 K). Real optima are lower for both, but the order is the same: the combined plant prefers a lower ratio than the gas turbine alone.</p>`
		}
	]
};
