import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const imbalance: Control = {
	type: 'range',
	id: 'imbalance',
	label: 'Generation minus demand',
	min: -3000,
	max: 3000,
	step: 250,
	default: -3000,
	format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-GB')} MW`,
	help: 'Negative: a power station has stopped, so demand is larger than generation.'
};

const hour: Control = {
	type: 'range',
	id: 'hour',
	label: 'Time of day',
	min: 0,
	max: 23.5,
	step: 0.5,
	default: 21,
	format: (v) => `${String(Math.floor(v)).padStart(2, '0')}:${v % 1 ? '30' : '00'}`
};

const share: Control = {
	type: 'range',
	id: 'share',
	label: 'Power from solar and wind',
	min: 0,
	max: 80,
	step: 10,
	default: 30,
	unit: '%',
	help: 'The rest comes from spinning generators: nuclear, gas, coal and hydro.'
};

const lost: Control = {
	type: 'range',
	id: 'lost',
	label: 'Power station lost',
	min: 500,
	max: 4500,
	step: 500,
	default: 3000,
	format: (v) => `${v.toLocaleString('en-GB')} MW`
};

const fcr: Control = {
	type: 'toggle',
	id: 'fcr',
	label: 'Primary control (governors)',
	default: true
};

const afrr: Control = {
	type: 'toggle',
	id: 'afrr',
	label: 'Secondary control',
	default: true
};

const bigLost: Control = {
	type: 'range',
	id: 'bigLost',
	label: 'Generation lost at once',
	min: 5000,
	max: 30000,
	step: 2500,
	default: 20000,
	format: (v) => `${v.toLocaleString('en-GB')} MW`
};

const ufls: Control = {
	type: 'toggle',
	id: 'ufls',
	label: 'Automatic load shedding',
	default: true
};

const pilot: Control = {
	type: 'select',
	id: 'pilot',
	label: 'Who dispatches the plants',
	default: 'you',
	options: [
		{ value: 'you', label: 'You' },
		{ value: 'auto', label: 'Autopilot' }
	],
	help: 'The autopilot follows what the real plants did that day.'
};

const gw = (v: number) => `${(v / 1000).toFixed(1)} GW`;

const gas: Control = {
	type: 'range',
	id: 'gas',
	label: 'Gas power stations',
	min: 0,
	max: 12000,
	step: 100,
	default: 3600,
	format: gw
};

const hydro: Control = {
	type: 'range',
	id: 'hydro',
	label: 'Hydroelectric dams',
	min: 0,
	max: 14000,
	step: 100,
	default: 9100,
	format: gw
};

const storage: Control = {
	type: 'range',
	id: 'storage',
	label: 'Pumped storage and batteries',
	min: -4000,
	max: 4000,
	step: 100,
	default: -500,
	format: (v) => (v < 0 ? `charging ${gw(-v)}` : v > 0 ? `delivering ${gw(v)}` : 'idle'),
	help: 'Negative: pumping water uphill (or charging batteries) with spare power.'
};

const nuclear: Control = {
	type: 'range',
	id: 'nuclear',
	label: 'Nuclear reactors',
	min: 0,
	max: 7100,
	step: 100,
	default: 6100,
	format: gw,
	help: 'Real reactors change their output over hours, not seconds.'
};

const curtail: Control = {
	type: 'range',
	id: 'curtail',
	label: 'Curtail solar and wind',
	min: 0,
	max: 100,
	step: 5,
	default: 0,
	unit: '%',
	help: 'Switch off part of what the solar farms and wind turbines could make.'
};

const startAt = (id: string, value: number): Control => ({
	type: 'range',
	id,
	label: 'Start the day at',
	min: 0,
	max: 23,
	step: 1,
	default: value,
	format: (v) => `${String(v).padStart(2, '0')}:00`,
	help: 'Moving it starts the day again from that hour, with the plants as they really were.'
});
const start = startAt('start', 3);
const startTrip = startAt('startTrip', 10);
const startCloud = startAt('startCloud', 11);

const tripPlant: Control = {
	type: 'action',
	id: 'tripPlant',
	label: 'A nuclear reactor shuts down',
	action: 'Trip 1,000 MW'
};

const cloud: Control = {
	type: 'action',
	id: 'cloud',
	label: 'A band of cloud',
	action: 'Send a cloud',
	help: 'Shades a quarter of the solar farms for about an hour.'
};

const kv: Control = {
	type: 'select',
	id: 'kv',
	label: 'Line voltage',
	default: '400',
	options: [
		{ value: '20', label: '20 kV' },
		{ value: '66', label: '66 kV' },
		{ value: '132', label: '132 kV' },
		{ value: '220', label: '220 kV' },
		{ value: '400', label: '400 kV' }
	]
};

const mw: Control = {
	type: 'range',
	id: 'mw',
	label: 'Power sent',
	min: 100,
	max: 2000,
	step: 100,
	default: 1000,
	format: (v) => `${v.toLocaleString('en-GB')} MW`
};

const km: Control = {
	type: 'range',
	id: 'km',
	label: 'Length of the line',
	min: 20,
	max: 500,
	step: 10,
	default: 200,
	unit: ' km'
};

const CE = `The frequency steps model the synchronous area of Continental Europe at a moment when it draws 300,000 MW, with the rules its operators follow (ENTSO-E, from the EU's System Operation Guideline of 2017). Spinning generators are given an inertia constant of 5 seconds; the primary reserve of 3,000 MW responds with a lag of 6 seconds; and demand falls 1% for each hertz the frequency falls, as motors slow down. One number stands for the whole continent: in reality the frequency swings a little differently from place to place in the first seconds.`;

const ISLAND = `In the game the Spanish mainland is treated as an island: its links to France, Portugal and Morocco carry exactly the flows scheduled that day and no more, so any imbalance stays at home and shows in its own frequency. In reality Spain is part of the European grid, and a mismatch in Spain is shared by the whole continent. The island holds 1,000 MW of primary reserve, the size of its largest plant; one simulated hour passes in 6 seconds, so the governors settle almost at once. Plants are allowed to change output instantly; real ones take minutes (gas) to hours (nuclear) to ramp, and their reservoirs and fuel are not tracked.`;

export const spec: ExplainerSpec = {
	slug: 'power-grid',
	title: 'The power grid',
	summary:
		'Watch a real day of electricity demand and generation, then take the controls: keep the frequency at 50 Hz while demand rises and falls, trip a power station, send a cloud over the solar farms, and see why power travels at 400,000 volts.',
	chapters: [
		{ id: 'balance', title: 'Supply meets demand' },
		{ id: 'frequency', title: 'Holding 50 Hz' },
		{ id: 'dispatch', title: 'Run the grid for a day' },
		{ id: 'transmission', title: 'Getting it there' }
	],
	steps: [
		// ---------------------------------------------------------------- balance
		{
			id: 'balance',
			chapter: 'balance',
			title: 'Supply must match demand, every instant',
			scene: 'frequency',
			hints: { mode: 'free' },
			duration: 30,
			controls: [imbalance],
			body: `
<p>A power grid stores almost no electricity. Every watt used in every home and factory is being generated somewhere, right now. So, every second, the power stations must make exactly as much as everyone together is using.</p>
<p>What happens when they don't? The big generators on a grid are all <dfn data-def="Turning in step with the grid's alternating current. A two-pole generator on a 50 Hz grid turns exactly 3,000 times a minute.">synchronous</dfn>: each one is the spinning coil and magnet of a <a href="../motors-generators/">generator</a>, and they all turn in step with each other — 3,000 times a minute for the 50 cycles a second of Europe's grid. If demand is larger than generation, the missing energy is taken from their spin: they all slow down together, and the <dfn data-def="How many cycles a second the grid's alternating voltage goes through, in hertz (Hz). 50 Hz in Europe, 60 Hz in North America.">frequency</dfn> falls. If generation is larger, they speed up.</p>
<p>So the frequency is the grid's balance gauge. Here nothing controls it at all: move the slider and watch. The fall slows only because motors in factories and homes slow down with the grid and draw a little less: 3,000 MW too little leaves it a whole hertz low.</p>`,
			notes: `<p>${CE}</p><p>The fall levels off where the drop in demand (1% per hertz of 300,000 MW, 3,000 MW per hertz) makes up for the missing power. It gets there with a time constant of about 14 seconds: the kinetic energy of the spinning machines, 1,050,000 MW·s, divided by 50 Hz × 3,000 MW/Hz, times 2.</p>`
		},
		{
			id: 'demand',
			chapter: 'balance',
			title: 'A real day of demand',
			scene: 'day',
			hints: { mode: 'demand' },
			duration: 24,
			controls: [hour],
			body: `
<p>This is the demand on the Spanish mainland grid on Wednesday 9 April 2025, hour by hour, as measured by its operator, <dfn data-def="Red Eléctrica (REE), the company that runs Spain's high-voltage grid and balances it in real time.">Red Eléctrica</dfn>.</p>
<p>It is lowest in the small hours, about <strong>21,300 MW at 4 a.m.</strong>, climbs steeply as the country wakes up, sags a little through the afternoon, and peaks at about <strong>31,300 MW at 9 p.m.</strong>, when Spain cooks, eats and switches on its lights. Over the whole day the mainland used 620 gigawatt-hours.</p>
<p>Nobody plans this curve. It is the sum of millions of people switching things on and off, and it changes every second. The grid has to follow it.</p>`,
			notes: `<p>Each point is the mean power over one hour (so it is also that hour's energy, in MWh), averaged from REE's five-minute real-time data; times are local (CEST). The source is REE's "Seguimiento de la demanda de energía eléctrica" (demanda.ree.es), downloaded in October 2026 (the feed gives no update date; REE's national real-time series for the day was last updated on 9 April 2025 at 23:58). Real-time data are provisional: REE's final figure for that day's mainland demand is 626 GWh, 1% more.</p>`
		},
		{
			id: 'mix',
			chapter: 'balance',
			title: 'Who supplies it',
			scene: 'day',
			hints: { mode: 'mix' },
			duration: 30,
			controls: [hour],
			body: `
<p>Now the same day split by source. <strong>Nuclear</strong> runs flat out all day, about 6,100 MW. <strong>Solar</strong> farms rise with the sun to 15,800 MW at noon and fall to nothing by 9 p.m.; <strong>wind</strong> blows when it blows. None of these follows the demand.</p>
<p>The plants that do are <strong>hydroelectric dams</strong> and <strong>gas</strong> power stations, which can open a valve and change their output within minutes. At midday there is more solar power than Spain needs: the surplus is <strong>exported</strong> to France, Portugal and Morocco (up to 6,000 MW) or used to <dfn data-def="A pair of reservoirs at different heights: spare power pumps water up, and later the water runs back down through turbines. The largest kind of electricity storage in the world.">pump water uphill</dfn> (up to 3,100 MW) — drawn below the zero line. In the evening, as the sun sets just before the demand peaks, hydro, gas, storage and imports have to take over more than 12,000 MW in two hours.</p>`,
			notes: `<p>"Other" is cogeneration (factories that make their own heat and power), waste and biomass. Coal is the thin band of about 350 MW. Batteries delivered or stored less than 10 MW all day. The stacked sources add up to the demand line to within 1.5%: the rest is generation REE's real-time feed does not list. The fast evening climb of what is left for the controllable plants once solar is subtracted is sometimes called the "duck curve", after its shape in California.</p>`
		},
		// ---------------------------------------------------------------- frequency
		{
			id: 'inertia',
			chapter: 'frequency',
			title: 'Spinning mass buys a few seconds',
			scene: 'frequency',
			hints: { mode: 'inertia' },
			duration: 26,
			controls: [share],
			body: `
<p>Now a power station trips: 3,000 MW, the largest sudden loss the European grid is designed for (its <dfn data-def="The biggest loss of generation the grid must survive without cutting anyone off: 3,000 MW in Continental Europe, about two of its largest reactors at once.">reference incident</dfn>). Nothing can replace that power in the first instant. It comes, automatically, from the kinetic energy of every spinning machine on the continent.</p>
<p>The more spinning mass, the more slowly the frequency falls. This <dfn data-def="The energy stored in the grid's spinning machines, which resists any change in their speed and so in the frequency.">inertia</dfn> is measured by the energy stored in the spin: rate of fall = 50 Hz × lost power ÷ (2 × stored energy). With 30% of the power from solar and wind, the frequency starts falling at 0.07 Hz a second.</p>
<p>Solar panels and most wind turbines connect through electronic <dfn data-def="Electronics that turn the direct current of a solar panel or battery (or a wind turbine's variable-frequency current) into alternating current in step with the grid.">inverters</dfn>, with nothing spinning in step with the grid. Raise their share and watch the first seconds get steeper: at 80% the fall is 3.5 times as fast.</p>`,
			notes: `<p>The swing equation: (2E/f₀) df/dt = P<sub>generated</sub> − P<sub>demanded</sub>, where E is the kinetic energy of everything spinning in step (each machine's inertia constant H, here 5 s, times its power). At 30% solar and wind, E = 5 s × 210,000 MW = 1,050,000 MW·s, so 3,000 MW lost gives 50 × 3,000 / 2,100,000 ≈ 0.071 Hz/s. Newer inverters can be "grid-forming" and inject power the instant the frequency moves, imitating inertia; grid operators increasingly ask for them. ${CE}</p>`
		},
		{
			id: 'primary',
			chapter: 'frequency',
			title: 'Governors push back',
			scene: 'frequency',
			hints: { mode: 'primary' },
			duration: 30,
			controls: [fcr, lost],
			body: `
<p>Inertia only slows the fall. To stop it, many power stations across Europe have a <dfn data-def="The control on a turbine that opens its steam, gas or water valve wider when the speed (the grid frequency) drops, and closes it when it rises.">governor</dfn> that watches the frequency and opens its valves as it drops: the <dfn data-def="Frequency Containment Reserve (FCR): power held back on many plants and batteries, released in proportion to the frequency deviation. Fully used at 200 mHz in Continental Europe.">primary reserve</dfn>. The rules hold 3,000 MW of it in reserve across the continent, released in proportion to the fall — all of it at 200 mHz, half within 15 seconds and all within 30.</p>
<p>The fall stops at a lowest point, the <dfn data-def="The lowest frequency reached after a sudden loss of generation, before the controls turn the fall around.">nadir</dfn>, here 49.71 Hz, and the frequency recovers to about <strong>49.83 Hz</strong>. Not 50: the governors only push while the frequency is low, so it settles where their push makes up for the loss. Switch them off to compare, or lose more than 3,000 MW: the reserve runs out and the frequency keeps falling.</p>`,
			notes: `<p>Each governor follows a "droop": its output rises in a straight line as the frequency falls, so all of them share the load in proportion to their reserve without talking to each other. Settled deviation = lost power ÷ (3,000 MW per 0.2 Hz + 3,000 MW/Hz of the load's self-regulation) = 3,000 / 18,000 ≈ 0.167 Hz. ${CE}</p>`
		},
		{
			id: 'secondary',
			chapter: 'frequency',
			title: 'Back to 50 hertz',
			scene: 'frequency',
			hints: { mode: 'secondary' },
			duration: 30,
			controls: [afrr],
			body: `
<p>The primary reserve has stopped the fall but is now used up, and the next trip would find none. So a second, slower control takes over. A computer at the grid operator in the country that lost the plant sees the frequency, and the flows on its borders, off target and orders other plants up: the <dfn data-def="Automatic Frequency Restoration Reserve (aFRR): plants that a central controller raises or lowers within minutes to bring the frequency, and the flows between countries, back to schedule.">secondary reserve</dfn>.</p>
<p>Watch fifteen minutes now. As the secondary reserve replaces the lost 3,000 MW, the frequency climbs back to 50 Hz within about five minutes, the governors close their valves again, and the primary reserve is ready for the next trip. The rules give fifteen minutes to get there.</p>`,
			notes: `<p>Here the secondary controller adds power in proportion to the accumulated frequency error, with an integral time of 90 seconds. In reality each country's controller works on its own "area control error", which mixes its frequency error with its unscheduled cross-border flows, so only the country that caused the imbalance corrects it. A third layer (tertiary, or manual reserve) then frees the secondary reserve within the hour. ${CE}</p>`
		},
		{
			id: 'shedding',
			chapter: 'frequency',
			title: 'When it isn’t enough: load shedding',
			scene: 'frequency',
			hints: { mode: 'ufls' },
			duration: 30,
			controls: [bigLost, ufls],
			body: `
<p>Sometimes much more is lost at once — when a fault splits the grid in two and one part is cut off from the power it was importing. Then the reserves can't keep up, and the frequency falls fast.</p>
<p>At <strong>49.0 Hz</strong> the last line of defence acts: <dfn data-def="Under-frequency load shedding (UFLS): relays in substations that disconnect whole areas of demand when the frequency falls below set points, 49.0 Hz to 48.0 Hz in Continental Europe.">automatic load shedding</dfn>. Relays in substations disconnect whole neighbourhoods, in steps (here 7.5% of demand each), up to 45% of all demand by 48.0 Hz. Cutting customers off sounds drastic, but it saves the grid: demand drops below generation and the frequency recovers, overshooting a little until generators turn down above 50.2 Hz.</p>
<p>Switch the shedding off. The frequency falls past <strong>47.5 Hz</strong>, where power stations disconnect themselves to protect their machinery — and with them goes everyone's supply: a blackout.</p>`,
			notes: `<p>The settings come from the EU's Emergency and Restoration network code (2017): shedding starts at 49.0 Hz and must have removed 45% of demand by 48.0 Hz, in at least six steps. Generators may disconnect below 47.5 Hz (Requirements for Generators code, 2016). On 4 November 2006 a line switched off in northern Germany split the European grid in three. The western part was left short of power, its frequency fell to about 49 Hz, and automatic load shedding cut off some 15 million households — but the grid did not collapse, and supply was back within about two hours. ${CE}</p>`
		},
		// ---------------------------------------------------------------- dispatch
		{
			id: 'dispatch',
			chapter: 'dispatch',
			title: 'Your turn: run the grid for a day',
			scene: 'game',
			hints: { events: false },
			duration: 120,
			controls: [pilot, gas, hydro, storage, nuclear, curtail, start],
			body: `
<p>Now you are the grid operator of the Spanish mainland, on the real day of 9 April 2025. The sun shines and the wind blows as they did that day; you dispatch the gas stations, the dams, the storage and the nuclear reactors, and you can <dfn data-def="Switching off part of the output that solar farms and wind turbines could make, when there is nobody to use it.">curtail</dfn> solar and wind. One hour passes every 6 seconds.</p>
<p>Keep the frequency between <strong>49.8 and 50.2 Hz</strong>. Here the governors hold only 1,000 MW of primary reserve, so a mismatch much larger than that pushes the frequency out of the band — and below 49.0 Hz customers are cut off. In this game you are the secondary control: nothing brings the frequency back to 50 Hz but you.</p>
<p>Watch the morning rush and, above all, the evening, when the sun sets just as demand peaks. Pause whenever you like, or switch to the autopilot to see what the real plants did.</p>`,
			notes: `<p>${ISLAND}</p>`
		},
		{
			id: 'trip',
			chapter: 'dispatch',
			title: 'Trip a power station',
			scene: 'game',
			hints: { events: true },
			duration: 60,
			controls: [tripPlant, pilot, gas, hydro, storage, nuclear, curtail, startTrip],
			body: `
<p>A nuclear reactor shuts down automatically when anything looks wrong — and at 1,000 MW it is the biggest plant on this grid. Press the button and watch.</p>
<p>The frequency drops to about <strong>49.81 Hz</strong>: the governors have used almost all of their 1,000 MW of reserve to hold it there (the rest of the gap is made up by motors slowing down). The grid survives, but it is now one problem away from load shedding. Within minutes the operator has to start other plants to replace the reactor and free the reserve again. Do it yourself, with the gas or the dams — or switch to the autopilot, which calls up gas over about five minutes.</p>`,
			notes: `<p>This is why every grid holds a primary reserve at least as large as its largest single plant, and why it plans, every hour, for the loss of any one of them (the "N−1" rule). ${ISLAND}</p>`
		},
		{
			id: 'cloud',
			chapter: 'dispatch',
			title: 'Send a cloud over the solar farms',
			scene: 'game',
			hints: { events: true },
			duration: 60,
			controls: [cloud, pilot, gas, hydro, storage, nuclear, curtail, startCloud],
			body: `
<p>Solar power can change much faster than a reactor trips back on. Around midday, send a band of cloud over a quarter of the country's solar farms. It cuts their output by about 70% for an hour, so at noon some 2,800 MW of solar power fades away in a quarter of an hour.</p>
<p>That is more than the primary reserve. If nobody answers, the frequency falls below 49.0 Hz and load shedding cuts off about 2,000 MW of customers until the cloud passes. Answer it yourself by raising gas, hydro or storage as it comes — or let the autopilot do it.</p>
<p><strong>A grid has no buffer: at every moment, someone has to make exactly as much power as everyone is using.</strong></p>`,
			notes: `<p>The cloud is a made-up event of a plausible size, not something that happened that day. Real operators forecast solar and wind output hours and days ahead, from weather models, and schedule reserves to match; batteries, which can respond in a fraction of a second, are taking over more and more of this work. ${ISLAND}</p>`
		},
		// ---------------------------------------------------------------- transmission
		{
			id: 'transformer',
			chapter: 'transmission',
			title: 'Transformers trade current for voltage',
			scene: 'line',
			hints: { mode: 'transformer' },
			duration: 26,
			controls: [kv],
			body: `
<p>A power station's generator makes alternating current at about 20,000 volts (20 kV). Right next to it, a <dfn data-def="Two coils wound on one iron core: an alternating current in one makes a changing magnetic field that induces a voltage in the other. The voltage is stepped up or down by the ratio of their turns.">transformer</dfn> steps that voltage up — to 400 kV on Europe's main lines — using the induction between two coils you met in <a href="../electromagnetism/#neighbour">electricity and magnetism</a>.</p>
<p>The voltage goes up by the ratio of the turns on the two coils, and the <strong>current goes down</strong> by the same ratio, so that the power, voltage × current, stays the same. To send 1,000 MW, the line needs a current of 28,900 A at 20 kV, but only 1,440 A at 400 kV. A transformer only works with a <em>changing</em> current: that is the main reason grids carry alternating current.</p>
<p>Power is sent along three wires, each carrying an alternating current one-third of a cycle behind the last: <dfn data-def="Three alternating currents of the same size, a third of a cycle (120°) apart. Together they deliver a steady flow of power, and need no return wire.">three-phase</dfn> power, made by generators with three sets of coils.</p>`,
			notes: `<p>For three-phase power, P = √3 × V × I, where V is the voltage between two of the lines: 1,000 MW at 400 kV is 1,000,000,000 / (1.732 × 400,000) ≈ 1,443 A in each wire. Large power transformers waste less than 1% of the power they carry. Direct current can be sent too, and is, over very long distances and under the sea, but changing its voltage needs large power-electronic converter stations.</p>`
		},
		{
			id: 'losses',
			chapter: 'transmission',
			title: 'Why high voltage',
			scene: 'line',
			hints: { mode: 'losses' },
			duration: 30,
			controls: [kv, mw, km],
			body: `
<p>Every wire has some <a href="../electric-circuits/#ohm">resistance</a>, and a current through it heats it: the power lost is <dfn data-def="The heating of a wire of resistance R by a current I: power lost = I² × R, in watts.">I²R</dfn>, current squared times resistance. Halve the current and the loss falls to a quarter.</p>
<p>So the voltage matters enormously. Send 1,000 MW over 200 km of a typical line: at 400 kV only <strong>2.4%</strong> turns into heat; at 220 kV, 7.8%; at 132 kV, 22% — and the wires would overheat. At 20 kV the current would be so large that the line could never deliver it. Three times the voltage means one-ninth of the loss.</p>
<p>That is why power stations can sit hundreds of kilometres from the cities they supply, near rivers, coalfields, sunny plains or windy hills: <strong>high voltage is what makes sending power far away affordable.</strong></p>`,
			notes: `<p>The line: three conductors of 500 mm² of aluminium per phase, 0.019 Ω per km per phase (aluminium's resistivity at 20 °C; hot wires are a little worse). Only resistive heating is counted; the line's inductance and capacitance, which matter on long AC lines, are left out, and above about 3,000 A these conductors would sag and overheat. Higher voltages need taller towers and wider gaps between the wires, so most of Europe's main lines run at 400 kV, and North America's highest at 765 kV; China runs lines at 1,000 kV AC and 1,100 kV DC.</p>`
		},
		{
			id: 'chain',
			chapter: 'transmission',
			title: 'From power station to socket',
			scene: 'line',
			hints: { mode: 'chain' },
			duration: 26,
			body: `
<p>Then the voltage comes back down in stages: at substations to 132 kV or 66 kV for a region, to 20 kV in the streets of a town, and in the small transformer of each neighbourhood to the 230 V (400 V between phases) of a home's sockets. Each step trades voltage back for current, closer to where it is used.</p>
<p>And all along that chain, from the turbine to the kettle, the balance holds: the power flowing out of every socket is being generated at that same moment, at the far end of the wires.</p>
<p><strong>Supply must match demand on a grid at every instant, so running one is a continuous balancing act; and high voltage is what makes it affordable to send power long distances.</strong></p>`,
			notes: `<p>The voltages are Spain's; other countries use similar steps (in the US, homes get 120 V and 240 V at 60 Hz). More of a grid's losses happen in its low-voltage local networks, where the currents are large, than on the long high-voltage lines.</p>`
		}
	]
};
