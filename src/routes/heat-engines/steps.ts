import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------

const kelvin = (v: number) => `${Math.round(v)} K (${Math.round(v - 273.15)} °C)`;

const heatQ: Control = {
	type: 'range',
	id: 'heatQ',
	label: 'Heat put into the gas',
	min: 0,
	max: 200,
	step: 5,
	default: 100,
	unit: ' J'
};

const back: Control = {
	type: 'select',
	id: 'back',
	label: 'How the gas gets back to the start',
	default: 'cold',
	options: [
		{ value: 'cold', label: 'Cool it first, then push the piston back' },
		{ value: 'same', label: 'Push it back the way it came' }
	]
};

const ledgerHot: Control = {
	type: 'range',
	id: 'ledgerHot',
	label: 'Hot side',
	min: 410,
	max: 3000,
	step: 10,
	default: 600,
	format: kelvin
};
const ledgerCold: Control = {
	type: 'range',
	id: 'ledgerCold',
	label: 'Cold side',
	min: 250,
	max: 400,
	step: 5,
	default: 300,
	format: kelvin
};
const share: Control = {
	type: 'range',
	id: 'share',
	label: 'Share of the heat turned into work',
	min: 0,
	max: 100,
	step: 1,
	default: 30,
	unit: '%'
};

const run: Control = {
	type: 'toggle',
	id: 'run',
	label: 'Run the engine',
	default: true
};
const crank: Control = {
	type: 'range',
	id: 'crank',
	label: 'Turn the crank by hand',
	min: 0,
	max: 720,
	step: 1,
	default: 0,
	unit: '°',
	help: 'Used while the engine is stopped. Two turns (720°) make one cycle.'
};

const ratio: Control = {
	type: 'range',
	id: 'ratio',
	label: 'Compression ratio',
	min: 6,
	max: 14,
	step: 0.5,
	default: 10,
	format: (v) => `${v} : 1`,
	help: 'How many times the gas is squeezed: the largest volume over the smallest.'
};
const dieselRatio: Control = {
	...ratio,
	id: 'dieselRatio',
	min: 12,
	max: 24,
	default: 18
};
const tHot: Control = {
	type: 'range',
	id: 'tHot',
	label: 'Hottest gas, after burning',
	min: 1500,
	max: 3000,
	step: 50,
	default: 2500,
	format: kelvin
};
const tCold: Control = {
	type: 'range',
	id: 'tCold',
	label: 'Air coming in',
	min: 250,
	max: 400,
	step: 5,
	default: 300,
	format: kelvin
};
const carnotHot: Control = {
	...tHot,
	id: 'carnotHot',
	label: 'Hot side',
	min: 400,
	default: 600,
	step: 10
};
const carnotCold: Control = { ...tCold, id: 'carnotCold', label: 'Cold side' };

const steamT: Control = {
	type: 'range',
	id: 'steamT',
	label: 'Steam temperature',
	min: 345,
	max: 650,
	step: 5,
	default: 600,
	unit: ' °C',
	help: 'At 150 bar, where water boils at 342 °C.'
};
const condT: Control = {
	type: 'range',
	id: 'condT',
	label: 'Condenser temperature',
	min: 15,
	max: 100,
	step: 1,
	default: 46,
	unit: ' °C',
	help: 'Set by the river, sea or cooling tower that takes the waste heat.'
};
const gasTurbine: Control = {
	type: 'range',
	id: 'gasTurbine',
	label: 'Gas turbine on its own',
	min: 30,
	max: 45,
	step: 0.5,
	default: 41,
	unit: '%'
};
const steamShare: Control = {
	type: 'range',
	id: 'steamShare',
	label: 'Steam cycle: share of the exhaust heat turned into work',
	min: 20,
	max: 40,
	step: 0.5,
	default: 36,
	unit: '%'
};

const airStandard = `The engine here is the textbook "air-standard" ideal: the gas is air with fixed heat capacities (γ = c<sub>p</sub>/c<sub>v</sub> = 1.4), burning is heat added from outside, the exhaust is replaced by cooling the gas back to the intake state, and nothing leaks, rubs or takes time.`;

export const spec: ExplainerSpec = {
	slug: 'heat-engines',
	title: 'Heat engines',
	summary:
		'Heat a gas and let it push a piston, run a four-stroke engine round its loop on a pressure–volume chart, then find the ceiling that the hot and cold temperatures put on every engine, from a car to a power station.',
	chapters: [
		{ id: 'work', title: 'Heat into work' },
		{ id: 'engine', title: 'The four-stroke engine' },
		{ id: 'limit', title: 'The ceiling' },
		{ id: 'real', title: 'Real engines' }
	],
	steps: [
		{
			id: 'push',
			chapter: 'work',
			title: 'Hot gas pushes',
			scene: 'box',
			hints: { phase: 'push' },
			duration: 18,
			controls: [heatQ],
			body: `
<p>Seal half a litre of air in a cylinder under a free piston and heat it. Its molecules speed up and hit the piston harder, so the gas expands and lifts the piston against the air outside: heat has become <dfn data-def="Energy transferred by a force moving something: force × distance. For a gas pushing a piston, pressure × change of volume.">work</dfn>.</p>
<p>The chart plots the gas's <strong>pressure</strong> against its <strong>volume</strong>. Here the pressure stays at 1 atmosphere while the volume grows, and the work done is pressure × change of volume: the <strong>area under the line</strong>. Of 100 J of heat only about 29 J become work. The other 71 J stay in the gas, which is now hotter. That is the <dfn data-def="Energy is conserved: the heat put into a gas equals the rise of its internal energy plus the work it does.">first law of thermodynamics</dfn>: heat in = rise in the gas's energy + work out.</p>`,
			notes: `<p>Pressure is force per area, and a piston of area A moving a distance d sweeps a volume A·d, so force × distance = pressure × volume change. When the pressure changes as the gas expands, the work is the area under the curve, ∫ P dV. For air at constant pressure the share that becomes work is R/c<sub>p</sub> = 2/7 ≈ 29%, whatever the amount of heat.</p>`
		},
		{
			id: 'loop',
			chapter: 'work',
			title: 'An engine must go round',
			scene: 'box',
			hints: { phase: 'loop' },
			duration: 24,
			controls: [back],
			body: `
<p>One push is not an engine: the piston soon reaches the end of the cylinder. To keep going, the gas must be brought back to where it started and pushed out again, cycle after cycle. Pushing it back costs work.</p>
<p>Push it back the way it came, at the same high pressure, and it takes back <strong>all</strong> the work it gave: the path on the chart retraces itself and encloses no area. Instead, <strong>cool it first</strong>. Cooler gas has a lower pressure, so pushing it back costs less than it gave. The path becomes a <strong>loop</strong>, and the net work of each cycle is the <strong>area inside the loop</strong>: here about 101 J out and 51 J back, so about 51 J gained (half of what it gave). The price is that heat has to leave the gas into something colder. Of the 481 J of heat put in, 431 J are thrown away.</p>`,
			notes: `<p>The loop is a simple rectangle: heat at constant volume until the pressure doubles, heat at constant pressure until the volume doubles, then cool at constant volume and at constant pressure back to the start. Its efficiency, the work over the heat put in, is only 10.5%. Pushed back "the way it came" the gas still has to give its heat back out (at the same high temperatures it took it in), so nothing is gained.</p>`
		},
		{
			id: 'ceiling',
			chapter: 'work',
			title: 'Why some heat must be thrown away',
			scene: 'ledger',
			duration: 26,
			controls: [ledgerHot, ledgerCold, share],
			body: `
<p>Is the waste heat just bad design? The <a href="../entropy/#entropy">second law</a> says no. When heat Q leaves something at temperature T, that body's <dfn data-def="S = k_B ln Ω: Boltzmann's constant times the logarithm of the number of microstates. When heat Q flows into a body at temperature T, its entropy rises by Q/T.">entropy</dfn> falls by Q/T. The engine itself comes back to the same state every cycle, so all the change is in the hot and cold sides.</p>
<p>An engine that turned all its heat into work would only lower the hot side's entropy: forbidden. So it must give some heat Q<sub>c</sub> to the cold side, raising its entropy by Q<sub>c</sub>/T<sub>c</sub>, at least as much as the hot side lost. Because T<sub>c</sub> is smaller, a little heat there buys a lot of entropy. Drag the share turned into work: the total entropy goes negative beyond <strong>1 − T<sub>c</sub>/T<sub>h</sub></strong>, the <dfn data-def="The highest efficiency any heat engine can have between a hot side at T_h and a cold side at T_c (in kelvin): 1 − T_c/T_h.">Carnot limit</dfn>. Between 600 K and 300 K, no engine can turn more than 50% of its heat into work.</p>`,
			notes: `<p>Temperatures here must be absolute, in kelvin. The argument does not mention pistons, gases or fuel: it applies to every possible heat engine. It was first worked out by Sadi Carnot in 1824, before entropy had a name, and turned into the second law by Rudolf Clausius and Lord Kelvin around 1850.</p>`
		},
		{
			id: 'strokes',
			chapter: 'engine',
			title: 'Four strokes',
			scene: 'engine',
			hints: { phase: 'strokes', cycle: 'otto' },
			duration: 30,
			controls: [run, crank],
			body: `
<p>A car's petrol engine runs this loop many times a second, in four strokes of the piston (two turns of the crank):</p>
<p><strong>1 Intake:</strong> the piston moves down and draws in air mixed with fuel. <strong>2 Compression:</strong> both valves shut and the piston squeezes the mixture, which heats it. <strong>3 Combustion and power:</strong> a spark ignites it; the burning heats the gas to around 2,500 K and its pressure jumps, and it drives the piston down. <strong>4 Exhaust:</strong> the exhaust valve opens and the piston pushes the burnt gas out, carrying the waste heat with it.</p>
<p>Watch the dot on the chart: compression climbs the lower curve towards small volume, burning jumps it straight up, the power stroke slides down the upper curve to the right, and intake and exhaust run back and forth along the bottom at about 1 atmosphere, where they enclose no area.</p>`,
			notes: `<p>The crank is drawn pausing at the top while the fuel burns and at the bottom while the exhaust valve opens. In the ideal cycle both happen instantly; in a real engine the spark fires a little before the top and the burn takes a few tens of degrees of crank angle. The piston follows the real geometry of a crank and connecting rod (here 3.5 times the crank radius), which is why it moves faster near the top than near the bottom.</p>`
		},
		{
			id: 'otto',
			chapter: 'engine',
			title: 'The ideal cycle',
			scene: 'engine',
			hints: { phase: 'otto', cycle: 'otto' },
			duration: 28,
			controls: [ratio, tHot],
			body: `
<p>Strip the engine to its thermodynamics and you get the <dfn data-def="The ideal cycle of a petrol engine: adiabatic compression, heat in at constant volume, adiabatic expansion, heat out at constant volume. Named after Nicolaus Otto, who built the first practical four-stroke engine in 1876.">Otto cycle</dfn>. <strong>1 → 2:</strong> compression so fast that no heat escapes (<dfn data-def="Without any heat flowing in or out.">adiabatic</dfn>); the air heats from 300 K to 754 K. <strong>2 → 3:</strong> heat in, at the top, from burning fuel. <strong>3 → 4:</strong> adiabatic expansion, the power stroke. <strong>4 → 1:</strong> heat out, as the hot exhaust is swapped for fresh air.</p>
<p>For one 0.5-litre cylinder squeezed 10 times, with the gas burnt to 2,500 K, that is 819 J of heat in and 493 J of work out: the shaded area. The other 326 J leave with the exhaust. Make the flame hotter: the loop grows taller and does more work, and so does the heat, in proportion.</p>`,
			notes: `<p>${airStandard} Real exhaust leaves the cylinder rather than cooling inside it, but the energy it carries away is the same heat-out. At 3,000 revolutions a minute each cylinder fires 25 times a second, so four cylinders doing 493 J each would give about 49 kW of ideal power.</p>`
		},
		{
			id: 'ratio',
			chapter: 'engine',
			title: 'Squeeze harder',
			scene: 'engine',
			hints: { phase: 'ratio', cycle: 'otto' },
			duration: 26,
			controls: [ratio, tHot],
			body: `
<p>The Otto cycle's efficiency, work out over heat in, turns out to depend on one thing only: the <dfn data-def="The largest volume of the cylinder divided by the smallest: how many times the gas is squeezed.">compression ratio</dfn> r. It is 1 − 1/r<sup>0.4</sup>: <strong>57% at r = 8, 60% at r = 10, 64% at r = 13</strong>. Change the flame's temperature and the loop changes size, but the efficiency stays the same.</p>
<p>Why not squeeze much harder? In a petrol engine the fuel is already mixed into the air, and compressing it too much heats it so that, after the spark, the last part of the mixture explodes on its own before the flame reaches it, a destructive <dfn data-def="The last part of the fuel–air mixture exploding on its own before the spark's flame reaches it, instead of burning smoothly: it hammers the piston.">knock</dfn>. That keeps car petrol engines to about 10 : 1 to 14 : 1; a few recent hybrid engines reach 16 : 1.</p>`,
			notes: `<p>Compression ratios of production petrol engines: Toyota's 2016 2.5-litre Dynamic Force engine runs at 13 : 1 (up from 10.4 : 1 in the engine it replaced). Higher-octane fuel resists knock better, which is why high-compression engines ask for it.</p>`
		},
		{
			id: 'diesel',
			chapter: 'engine',
			title: 'Diesel: compress air alone',
			scene: 'engine',
			hints: { phase: 'diesel', cycle: 'diesel' },
			duration: 26,
			controls: [dieselRatio, tHot],
			body: `
<p>Rudolf Diesel's idea (patented 1892), which also sidesteps knock: compress <strong>air alone</strong>, so nothing can ignite early, and squeeze it so hard that it becomes hot enough to light fuel sprayed into it. At 18 : 1 the air reaches 953 K, well above the fuel's ignition point, with no spark at all.</p>
<p>The fuel burns while the piston is already moving down, so the heat goes in at roughly <strong>constant pressure</strong>: the top of the loop is flat. At the same compression ratio that is less efficient than the Otto cycle, because some heat goes in after expansion has begun, and the longer the burn (the hotter the flame) the more it loses. But diesels can be built for much higher compression, typically 12 : 1 to 24 : 1. At 22 : 1, burnt to 2,500 K, the ideal Diesel cycle reaches <strong>64%</strong>, beyond the 60% of a petrol engine at 10 : 1.</p>`,
			notes: `<p>The ideal Diesel cycle's efficiency is 1 − (1/r<sup>0.4</sup>) × (ρ<sup>1.4</sup> − 1)/(1.4 (ρ − 1)), where ρ is the ratio of the volumes at the end and the start of burning. As ρ → 1 it becomes the Otto cycle. The range of diesel compression ratios is from Çengel and Boles, <em>Thermodynamics: An Engineering Approach</em>. ${airStandard}</p>`
		},
		{
			id: 'carnot',
			chapter: 'limit',
			title: 'The perfect engine',
			scene: 'carnot',
			duration: 28,
			controls: [carnotHot, carnotCold],
			body: `
<p>Which engine reaches the Carnot limit? One that never lets heat flow across a temperature difference, since that flow raises entropy and wastes the chance of work. The <dfn data-def="An ideal reversible cycle: isothermal expansion at the hot temperature, adiabatic expansion, isothermal compression at the cold temperature, adiabatic compression.">Carnot cycle</dfn> takes in heat only while the gas is at the hot temperature, expanding slowly in contact with the hot side (<dfn data-def="At constant temperature.">isothermal</dfn>), and gives out heat only at the cold temperature. Adiabatic legs carry it between the two.</p>
<p>The right-hand chart shows why it is perfect. It plots temperature against the gas's entropy, and heat in or out is the area under a path (Q = T × ΔS). The Carnot cycle is a <strong>rectangle</strong>: heat in at T<sub>h</sub>, heat out at T<sub>c</sub>, the same entropy both ways. Its efficiency is exactly 1 − T<sub>c</sub>/T<sub>h</sub>. Now raise the hot side: the P–V loop turns into a needle. Reaching 2,500 K by squeezing alone takes a 200-fold compression and pressures of about 1,700 bar, for little work per stroke, and the heat has to soak in slowly. No practical engine runs a Carnot cycle.</p>`,
			notes: `<p>On a temperature–entropy chart, as on a pressure–volume chart, the area inside a loop is the net work (heat in minus heat out). The Carnot cycle here holds 0.59 g of air (half a litre at 1 atmosphere and 300 K, as in the first steps), starts each cycle at 1 atmosphere, and doubles its volume while it takes in heat.</p>`
		},
		{
			id: 'compare',
			chapter: 'limit',
			title: 'Against the ceiling',
			scene: 'compare',
			duration: 30,
			controls: [ratio, tHot, tCold],
			body: `
<p>Put the Otto cycle on the temperature–entropy chart, next to a Carnot cycle between the same coldest and hottest temperatures. The Otto loop fits inside the rectangle and leaves its top-left and bottom-right corners empty: it takes in heat while the gas is still warming up from T<sub>2</sub>, well below the hottest temperature, and gives it out while the exhaust is still far hotter than the air outside.</p>
<p>Change the compression ratio and the temperatures and watch the two efficiencies. Higher compression pushes the Otto loop up into the rectangle. A hotter flame or colder air raises the ceiling. But the Otto bar can never reach the Carnot bar: <strong>the two temperatures set a ceiling on efficiency that no design can beat</strong>. In fact the Otto cycle is exactly as efficient as a Carnot engine running between the intake air and the end of compression, 1 − T<sub>1</sub>/T<sub>2</sub>.</p>`,
			notes: `<p>The Carnot cycle drawn here takes in heat over the same range of entropy as the Otto cycle, so it takes in more heat (all of it at the hottest temperature) and does more work. The efficiencies would be the same whatever amount of gas is used.</p>`
		},
		{
			id: 'real',
			chapter: 'real',
			title: 'Real engines',
			scene: 'real',
			duration: 26,
			body: `
<p>Real engines fall well short of their ideal cycles. Heat leaks through the cylinder walls, burning takes time, parts rub, and pumping air in and out costs work. Good modern petrol engines reach about <strong>40%</strong> at their best speed and load (Toyota, 2016), against 64% for the ideal cycle at their 13 : 1 compression; engines built only for hybrids now claim up to 46% (BYD, 2024). A whole car does worse: only about 12–30% of the fuel's energy ends up moving it, because the engine spends most of its time far from its best operating point, and the drivetrain, accessories and idling take their share (US Department of Energy).</p>
<p>Power stations are heat engines too. In tests, America's coal and nuclear plants turn on average about a third of their heat into electricity, and gas plants that combine two cycles about 45% (EIA, 2024). A combined-cycle plant in Bouchain, France, set a Guinness world record of <strong>62.2%</strong> in 2016.</p>`,
			notes: `<p>Sources: Toyota Motor Corporation, "New TNGA powertrain" (6 December 2016): 40% thermal efficiency in conventional cars, 41% in hybrids. US DOE, fueleconomy.gov, "Where the energy goes": 12–30% of fuel energy to the wheels. US EIA, Electric Power Annual, Table 8.2 (2024 average tested heat rates): steam turbines burning coal 10,018 Btu/kWh, nuclear 10,443, natural-gas gas turbines 10,999, natural-gas combined cycle 7,548; efficiency = 3,412 Btu/kWh ÷ heat rate. EIA's heat rates count the fuel's higher heating value (including the heat of condensing the water in the exhaust); the Bouchain record (GE and EDF, certified by Guinness World Records) uses the lower heating value, which reads about 10% higher for natural gas. Guinness later recognised Chubu Electric's Nishi-Nagoya plant in Japan at 63.08% (gross, 2018), and GE quotes about 64% for its newest turbines.</p>`
		},
		{
			id: 'steam',
			chapter: 'real',
			title: 'Steam turbines',
			scene: 'plant',
			hints: { phase: 'steam' },
			duration: 30,
			controls: [steamT, condT],
			body: `
<p>Most of the world's electricity comes from steam. A boiler heated by coal, gas or a nuclear reactor makes steam at high pressure, the steam spins a <strong>turbine</strong>, a <strong>condenser</strong> cooled by a river, the sea or a cooling tower turns it back into water, and a pump returns the water to the boiler. This is the <dfn data-def="The cycle of a steam power plant: pump, boil, expand through a turbine, condense. Named after William Rankine.">Rankine cycle</dfn>, and its numbers come from measured properties of real water and steam.</p>
<p>With steam at 150 bar and 600 °C and a condenser at 46 °C, the ideal cycle turns <strong>43%</strong> of the heat into work, against a Carnot limit of 63%. The gap has the same cause as for the car engine: much of the heat goes in while the water is still warming up from 46 °C, it <a href="../states-of-matter/#heat">boils</a> at only 342 °C, and only the last part comes near 600 °C, so on average the heat goes in at about 290 °C. Hotter steam and a colder condenser both raise the efficiency, and neither can beat 1 − T<sub>c</sub>/T<sub>h</sub>.</p>`,
			notes: `<p>Water and steam properties: NIST Chemistry WebBook (IAPWS-95 formulation). The turbine is ideal: the steam expands without friction or heat loss, at constant entropy. Its exhaust comes out about 80% vapour and 20% droplets, which would erode real turbine blades; real plants reheat the steam partway through the turbine, which also raises the efficiency. Pressurised-water nuclear reactors make steam at under 300 °C, which is one reason they convert only about a third of their heat.</p>`
		},
		{
			id: 'combined',
			chapter: 'real',
			title: 'Hotter, then colder: the combined cycle',
			scene: 'plant',
			hints: { phase: 'combined' },
			duration: 30,
			controls: [gasTurbine, steamShare],
			body: `
<p>To raise the ceiling, raise T<sub>h</sub>. A <strong>gas turbine</strong>, a jet engine bolted to the ground, burns gas in compressed air at over 1,400 °C, far hotter than any boiler tube could take. The largest modern gas turbines turn about 40% of their heat into work on their own (the US fleet average, full of smaller peaking units, is 31%), but its exhaust still leaves at several hundred degrees.</p>
<p>So pass that exhaust through a boiler and run a steam cycle on the heat the gas turbine throws away. Each cycle takes its share of what the one before it left: a 41% gas turbine plus a steam cycle that turns 36% of the exhaust heat into work gives 41% + 59% × 36% = <strong>62%</strong>, about what the record-setting plants reach. It is still far below the Carnot limit of around 85% between the flame and the cooling water, but every step up comes from <strong>letting heat flow from hotter to colder</strong>, and taking work from it on the way.</p>`,
			notes: `<p>Firing temperatures of today's largest ("H-class") gas turbines are about 1,430–1,600 °C (Modern Power Systems, 2014). GE quoted its 9HA.02 turbine at more than 41% on its own and more than 61% in a combined cycle when it was launched in 2014. The Carnot figure uses 1,600 °C and 15 °C: 1 − 288/1,873 ≈ 85%. The two sliders are for exploring; the default values are chosen to reproduce the record.</p>`
		}
	]
};
