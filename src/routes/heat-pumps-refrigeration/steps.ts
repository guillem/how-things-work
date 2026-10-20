import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const tEvap: Control = {
	type: 'range',
	id: 'tevap',
	label: 'Evaporating temperature',
	min: -30,
	max: 15,
	step: 1,
	default: 0,
	unit: '°C',
	format: (v) => `${v} °C`,
	help: 'Where the refrigerant boils, taking heat from the cold side (the outdoor air, or the inside of a fridge).'
};

const tCond: Control = {
	type: 'range',
	id: 'tcond',
	label: 'Condensing temperature',
	min: 25,
	max: 70,
	step: 1,
	default: 40,
	unit: '°C',
	format: (v) => `${v} °C`,
	help: 'Where it condenses, giving heat to the warm side (the radiators, or the kitchen).'
};

const eta: Control = {
	type: 'range',
	id: 'eta',
	label: 'Compressor isentropic efficiency',
	min: 0.5,
	max: 1,
	step: 0.01,
	default: 0.75,
	format: (v) => `${Math.round(v * 100)}%`
};

const superheat: Control = {
	type: 'range',
	id: 'superheat',
	label: 'Superheat',
	min: 0,
	max: 15,
	step: 1,
	default: 5,
	unit: 'K',
	format: (v) => `${v} K`,
	help: 'How far the vapour is warmed above its boiling point before the compressor (so no liquid reaches it).'
};

const subcool: Control = {
	type: 'range',
	id: 'subcool',
	label: 'Subcooling',
	min: 0,
	max: 15,
	step: 1,
	default: 5,
	unit: 'K',
	format: (v) => `${v} K`,
	help: 'How far the liquid is cooled below its condensing point before the valve.'
};

const fluid: Control = {
	type: 'select',
	id: 'fluid',
	label: 'Refrigerant',
	default: 'r134a',
	options: [
		{ value: 'r134a', label: 'R-134a' },
		{ value: 'propane', label: 'Propane (R-290)' }
	]
};

const pGas: Control = {
	type: 'range',
	id: 'pgc',
	label: 'Gas cooler pressure',
	min: 7.5,
	max: 12,
	step: 0.1,
	default: 9,
	unit: 'MPa',
	format: (v) => `${v.toFixed(1)} MPa (${Math.round(v * 10)} bar)`
};

const tOut: Control = {
	type: 'range',
	id: 'tout',
	label: 'Gas cooler outlet temperature',
	min: 20,
	max: 45,
	step: 1,
	default: 35,
	unit: '°C',
	format: (v) => `${v} °C`
};

const leg: Control = {
	type: 'select',
	id: 'leg',
	label: 'Leg',
	default: 'compress',
	options: [
		{ value: 'compress', label: '1 → 2 compress' },
		{ value: 'condense', label: '2 → 3 condense' },
		{ value: 'expand', label: '3 → 4 expand' },
		{ value: 'evaporate', label: '4 → 1 evaporate' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'heat-pumps-refrigeration',
	title: 'Heat pumps & refrigeration',
	summary:
		'Run a real refrigerant around a vapour-compression cycle on its pressure-enthalpy diagram: boil it cold, compress it, condense it hot, drop its pressure. See why a heat pump delivers several units of heat for each unit of work, how that falls as the temperature lift grows, and what happens with propane and with CO2 above its critical point.',
	chapters: [
		{ id: 'cycle', title: 'The cycle' },
		{ id: 'real', title: 'A real machine' },
		{ id: 'fluids', title: 'Refrigerants' }
	],
	steps: [
		// ------------------------------------------------------------------ cycle
		{
			id: 'idea',
			chapter: 'cycle',
			title: 'Moving heat uphill',
			scene: 'ph',
			hints: { phase: 'idea' },
			duration: 20,
			controls: [tEvap, tCond],
			body: `
<p>Heat flows by itself only from hot to cold. A refrigerator and a heat pump push it the other way: out of a cold fridge into a warm kitchen, or out of winter air into a warm house. They do it with a fluid that boils at a low temperature, and a trick: a liquid’s boiling point rises with pressure.</p>
<p>At the starting settings, at low pressure the refrigerant boils at 0 °C, colder than the outside air, so it soaks up heat from the air as it boils. Compressed to a higher pressure, the same fluid condenses at 40 °C, hotter than the house, so it gives the heat away as it condenses. Then a valve drops it back to low pressure, and around it goes.</p>
<p>The diagram plots pressure (on a logarithmic scale) against the fluid’s <dfn data-def="The energy content of a kilogram of the fluid, including the work needed to push it along at its pressure; heat added at constant pressure raises it one for one.">enthalpy</dfn>. Inside the dome the fluid is a boiling mixture of liquid and vapour, left of it liquid, right of it vapour. The real properties of R-134a, a common refrigerant, draw both. Drag the two horizontal lines of the cycle, or use the sliders, to change the boiling and condensing temperatures.</p>`
		},
		{
			id: 'legs',
			chapter: 'cycle',
			title: 'Four legs',
			scene: 'ph',
			hints: { phase: 'legs' },
			duration: 24,
			controls: [leg],
			body: `
<p>Follow one kilogram around, in the reference case boiling at 0 °C and condensing at 40 °C (the readouts follow your own settings). <strong>1 → 2, compression:</strong> the compressor squeezes the cold vapour from 0.29 to 1.02 MPa; its enthalpy rises by the work put in, and it comes out hot. <strong>2 → 3, condensation:</strong> in the condenser it cools, condenses at 40 °C and leaves as liquid, giving heat to the house. This is the useful heat of a heat pump.</p>
<p><strong>3 → 4, expansion:</strong> the expansion valve drops the pressure with no heat and no work, so the enthalpy stays the same: a vertical line. About a quarter of the liquid flashes to vapour, which chills the rest to 0 °C. <strong>4 → 1, evaporation:</strong> in the evaporator the rest boils, taking heat from outside. This is the useful heat of a refrigerator.</p>
<p>On a p-h diagram every heat and work is a horizontal distance: the condenser’s heat is the width of the top line, the compressor’s work the width of leg 1 → 2.</p>`
		},
		{
			id: 'cop',
			chapter: 'cycle',
			title: 'More heat than work',
			scene: 'ph',
			hints: { phase: 'cop' },
			duration: 22,
			controls: [tEvap, tCond],
			body: `
<p>The heat delivered is the compressor’s work plus the heat taken from outside. Their ratio is the <dfn data-def="Coefficient of performance: heat delivered (for a heat pump) or heat removed (for a refrigerator) per unit of work put in.">coefficient of performance</dfn>: COP = Q<sub>hot</sub> / W. With an ideal compressor, boiling at 0 °C and condensing at 40 °C, R-134a gives a heating COP of 6.5: 6.5 units of heat for each unit of work. As a refrigerator, the same cycle removes 5.5 units per unit of work.</p>
<p>The second law sets a ceiling: no machine taking heat in at 0 °C and giving it out at 40 °C can beat the Carnot COP, T<sub>hot</sub> / (T<sub>hot</sub> − T<sub>cold</sub>) in kelvin, here 7.8 (the page shows it as the Carnot reference for the two temperatures you set). The real cycle falls short because the vapour leaves the compressor hotter than 40 °C and the valve throws away the chance of getting work back from the expansion.</p>`
		},
		// ------------------------------------------------------------------ real
		{
			id: 'lift',
			chapter: 'real',
			title: 'The temperature lift',
			scene: 'lift',
			hints: { phase: 'lift' },
			duration: 22,
			controls: [tEvap, tCond],
			body: `
<p>The bigger the gap between the two temperatures, the more the compressor must squeeze, and the lower the COP. With the evaporator at 0 °C, the ideal R-134a cycle gives about 8.8 when condensing at 30 °C and only 4.1 at 60 °C, and the Carnot ceiling falls in step.</p>
<p>That is why a heat pump does best with underfloor heating or large radiators, which are warm enough at 35 °C, and worst on the coldest days, when it must lift heat from freezing air. It is also why a fridge hates a hot kitchen.</p>`
		},
		{
			id: 'losses',
			chapter: 'real',
			title: 'A real compressor, superheat and subcooling',
			scene: 'ph',
			hints: { phase: 'losses' },
			duration: 24,
			controls: [eta, superheat, subcool],
			body: `
<p>A real compressor wastes work as friction and heat: its <dfn data-def="The work an ideal (reversible, adiabatic) compressor would need, divided by the work the real one takes.">isentropic efficiency</dfn> is typically 60 to 80%. At 75%, the otherwise unchanged 0 °C to 40 °C cycle’s heating COP drops from 6.5 to about 5.1, and the vapour leaves the compressor hotter still; with the default 5 K of superheat and 5 K of subcooling it is about 5.3.</p>
<p>Two small adjustments help in practice. A few kelvin of <strong>superheat</strong> at the evaporator outlet make sure no liquid droplets reach the compressor, which they would damage. A few kelvin of <strong>subcooling</strong> at the condenser outlet means less liquid flashes in the valve, so each kilogram picks up more heat in the evaporator.</p>`,
			notes: `<p>The model treats the compressor as adiabatic (all its work goes into the refrigerant), ignores pressure drops in the pipes and leaves out the motor, fan and pump losses, so its COPs are those of the refrigerant cycle; a whole machine’s are lower. Subcooled liquid is given the enthalpy of saturated liquid at the same temperature. Settings that would cool the liquid below the evaporating temperature, or put the valve’s outlet outside the dome, are flagged rather than drawn.</p>`
		},
		// ------------------------------------------------------------------ fluids
		{
			id: 'propane',
			chapter: 'fluids',
			title: 'Propane instead of R-134a',
			scene: 'ph',
			hints: { phase: 'fluids' },
			duration: 22,
			controls: [fluid, tEvap, tCond],
			body: `
<p>R-134a does not harm the ozone layer, but a kilogram leaked into the air warms the climate about 1,400 times as much as a kilogram of CO2 over a century. European rules are phasing such fluids out in favour of natural refrigerants such as propane.</p>
<p>Switch to propane. Its dome is a different shape and its pressures are higher (1.37 MPa at 40 °C against 1.02), but the cycle and the COP come out almost the same. The temperature lift sets the Carnot reference; the refrigerant’s properties decide how close this cycle comes to it. Propane is flammable, so the systems hold small charges and are built to keep it sealed.</p>`,
			notes: `<p>The EU F-gas rules use a 100-year global warming potential of 1,430 for R-134a; the European Commission’s current value for propane is 0.02. Each fluid’s enthalpy is measured from its own reference state, so the numbers on the horizontal axis are not comparable between fluids; differences along one cycle are.</p>`
		},
		{
			id: 'co2',
			chapter: 'fluids',
			title: 'CO₂ goes transcritical',
			scene: 'ph',
			hints: { phase: 'co2' },
			duration: 24,
			controls: [pGas, tOut, tEvap],
			body: `
<p>CO₂ (R-744) is a refrigerant too, with no ozone harm and a warming potential of 1 by definition. But its critical point is only 31 °C: above that temperature, no pressure can condense CO₂, and above its critical pressure, cooling proceeds smoothly with no change from vapour to liquid. To deliver heat at a radiator’s temperatures, a CO₂ heat pump compresses to 8 to 12 MPa, above the critical pressure of 7.4 MPa, and cools the fluid in a <strong>gas cooler</strong> instead of condensing it. The cycle runs around the top of the dome rather than across it: <dfn data-def="A cycle whose high side is above the fluid's critical pressure and low side below it.">transcritical</dfn>.</p>
<p>Without a condensing temperature, the high pressure becomes a free choice, and it has a best value: drag it and watch the COP peak near 9 MPa for a 35 °C gas cooler outlet. Too low, and the fluid leaves the gas cooler with too much enthalpy; too high, and the compressor works for nothing. The gas cooler’s gliding temperature suits heating water from cold to 60 °C or more, which is where CO₂ heat pumps are most used.</p>`
		},
		{
			id: 'efficiency',
			chapter: 'fluids',
			title: 'Is it 500% efficient?',
			scene: 'bars',
			hints: { phase: 'bars' },
			duration: 18,
			controls: [tEvap, tCond],
			body: `
<p>A COP of 5 is sometimes advertised as “500% efficient”. It breaks no law. The electricity is not turned into five times its energy as heat: one unit of work moves four units of heat that were already outside and delivers all five indoors. The bars show the split.</p>
<p>The second law still sets the limit, the Carnot COP for the lift between the heat source and the heat sink. A heat pump is efficient because it moves heat instead of making it, and it moves heat more cheaply the smaller the temperature gap it has to climb.</p>`
		}
	]
};
