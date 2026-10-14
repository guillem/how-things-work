import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { DRY_SHARE, PAYLOAD, massRatio, singleStageLimit } from './rockets';
import { hohmann, marsHohmann, MU_EARTH, R_GEO, R_LEO, daysFromDate, J2000 } from './space';

const geo = hohmann(MU_EARTH, R_LEO, R_GEO);
const mars = marsHohmann();
const kms = (v: number, d = 1) => (v / 1000).toFixed(d);

/** Days after J2000 at which the departure-date slider starts (1 January 2026). */
export const WINDOW_START = daysFromDate(2026, 1, 1);
export const WINDOW_DAYS = 2000;
export const dateOf = (days: number) => new Date(J2000 + days * 86400e3);
const fmtDate = (days: number) =>
	dateOf(days).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});

const exhaust: Control = {
	type: 'range',
	id: 've',
	label: 'Exhaust speed',
	min: 1,
	max: 4.5,
	step: 0.1,
	default: 3,
	unit: ' km/s',
	help: 'Kerosene and oxygen: about 3 km/s. Hydrogen and oxygen: about 4.4 km/s.'
};

const exhaustDesign: Control = { ...exhaust, id: 'veDesign', min: 2 };

const fuelShare: Control = {
	type: 'range',
	id: 'share',
	label: 'Propellant',
	min: 0,
	max: 95,
	step: 1,
	default: 80,
	format: (v) => `${v}% of the starting mass`
};

const target: Control = {
	type: 'range',
	id: 'target',
	label: 'Speed to gain (Δv)',
	min: 1,
	max: 15,
	step: 0.1,
	default: 9.4,
	unit: ' km/s',
	help: 'About 9.4 km/s takes a rocket from the ground to a low orbit.'
};

const stages: Control = {
	type: 'range',
	id: 'stages',
	label: 'Number of stages',
	min: 1,
	max: 3,
	step: 1,
	default: 1
};

const fuel: Control = {
	type: 'range',
	id: 'fuel',
	label: 'Propellant on the pad',
	min: 50,
	max: 1000,
	step: 25,
	default: 500,
	unit: ' t',
	help: `Shared between the stages. Payload: ${PAYLOAD / 1000} t.`
};

const burn1: Control = {
	type: 'range',
	id: 'burn1',
	label: 'First burn',
	min: 0,
	max: 3,
	step: 0.01,
	default: 1.2,
	unit: ' km/s',
	help: 'Fired forwards, along the direction of travel.'
};

const burn2: Control = {
	type: 'range',
	id: 'burn2',
	label: 'Second burn, half an orbit later',
	min: 0,
	max: 2,
	step: 0.01,
	default: 0,
	unit: ' km/s'
};

const lead: Control = {
	type: 'range',
	id: 'lead',
	label: 'Where Mars is when you leave',
	min: -60,
	max: 120,
	step: 1,
	default: 15,
	format: (v) => (v >= 0 ? `${v}° ahead of the Earth` : `${-v}° behind the Earth`)
};

const depart: Control = {
	type: 'range',
	id: 'depart',
	label: 'Departure date',
	min: 0,
	max: WINDOW_DAYS,
	step: 5,
	default: 120,
	format: (v) => fmtDate(WINDOW_START + v)
};

const flight: Control = {
	type: 'range',
	id: 'flight',
	label: 'Flight time',
	min: 120,
	max: 400,
	step: 5,
	default: 260,
	unit: ' days'
};

const closest: Control = {
	type: 'range',
	id: 'closest',
	label: 'Closest approach to Jupiter',
	min: 1.1,
	max: 40,
	step: 0.1,
	default: 8,
	format: (v) =>
		`${v.toFixed(1)} Jupiter radii (${Math.round(v * 71.492).toLocaleString('en-US')} thousand km)`
};

const mission: Control = {
	type: 'select',
	id: 'mission',
	label: 'Mission',
	default: 'mars',
	options: [
		{ value: 'leo', label: 'Low orbit' },
		{ value: 'geo', label: 'Geostationary' },
		{ value: 'escape', label: 'Fly past Mars' },
		{ value: 'mars', label: 'Orbit Mars' }
	]
};

const budgetExhaust: Control = { ...exhaust, id: 'veBudget', default: 4.4 };

export const spec: ExplainerSpec = {
	slug: 'rockets',
	title: 'Rockets and orbital manoeuvres',
	summary:
		'Design a rocket and fly it through the real atmosphere to see whether it makes orbit, then plan the burns that raise an orbit, catch Mars in its launch window and borrow speed from Jupiter.',
	chapters: [
		{ id: 'push', title: 'Pushing on nothing' },
		{ id: 'orbit', title: 'Reaching orbit' },
		{ id: 'move', title: 'Moving between orbits' },
		{ id: 'mars', title: 'Between the planets' },
		{ id: 'budget', title: 'The budget' }
	],
	steps: [
		// ------------------------------------------------------------------ push
		{
			id: 'recoil',
			chapter: 'push',
			title: 'Throwing mass backwards',
			scene: 'rocket',
			hints: { phase: 'recoil' },
			duration: 22,
			controls: [exhaust],
			body: `
<p>A rocket moves forwards by throwing mass backwards. Its engines burn propellant into hot gas and blast it out of the nozzle at a high <dfn data-def="How fast the gas leaves the nozzle, relative to the rocket. It is set by the propellants and the engine design: about 3 km/s for kerosene and oxygen, 4.4 km/s for hydrogen and oxygen.">exhaust speed</dfn>. Every puff of gas carries momentum one way, so the rocket gains exactly the same momentum the other way — Newton's third law, or the conservation of momentum.</p>
<p>So a rocket does <strong>not</strong> push against the air or the ground. It works best in empty space, where no air gets in the way of its exhaust. The push it feels, its <dfn data-def="The force of the engines: the mass of gas thrown out each second times its exhaust speed.">thrust</dfn>, is the mass of gas thrown out each second times the exhaust speed: double the exhaust speed and each kilogram of propellant gives twice the push.</p>`,
			notes: `<p>The drawing is in space, far from any planet, with the rocket starting at rest. The two bars are the momentum of all the gas thrown so far and the momentum of the rocket: always equal and opposite, so the total stays zero.</p>`
		},
		{
			id: 'equation',
			chapter: 'push',
			title: 'The rocket equation',
			scene: 'rocket',
			hints: { phase: 'equation' },
			duration: 24,
			controls: [fuelShare, exhaust],
			body: `
<p>How much speed can a rocket gain? Not simply "exhaust speed × propellant": early on, each kilogram of gas has to push the whole full rocket, so it gives little speed; the last kilograms push an almost empty one. Adding it all up gives the <strong>rocket equation</strong>, derived by Konstantin Tsiolkovsky in 1897 and published in 1903:</p>
<p class="formula">Δv = v<sub>e</sub> × ln(m<sub>start</sub> / m<sub>end</sub>)</p>
<p>Δv ("delta-v") is the speed gained, v<sub>e</sub> the exhaust speed, and m<sub>start</sub> / m<sub>end</sub> the <dfn data-def="The rocket's mass full divided by its mass when the propellant is used up.">mass ratio</dfn>. "ln" is the natural logarithm, which grows ever more slowly: make the rocket 80% propellant (a mass ratio of 5) and it gains 1.6 exhaust speeds; 90% (ratio 10) gives 2.3; 95% (ratio 20) only 3.0.</p>`,
			notes: `<p>This ignores gravity and air: it is the speed gained in empty space. Rocket engineers quote exhaust speed as <em>specific impulse</em>, in seconds: the exhaust speed divided by 9.81 m/s². 300 s means about 2.9 km/s.</p>`
		},
		{
			id: 'tyranny',
			chapter: 'push',
			title: 'Fuel must lift fuel',
			scene: 'rocket',
			hints: { phase: 'tyranny' },
			duration: 24,
			controls: [target, exhaust],
			body: `
<p>Turn the equation round: to gain Δv, the rocket must start e<sup>Δv / v<sub>e</sub></sup> times heavier than it ends. Each extra exhaust speed's worth of Δv <strong>multiplies</strong> the starting mass by e ≈ 2.7, because the extra propellant has to be carried — and speeded up — by yet more propellant.</p>
<p>Getting from the ground into orbit takes about 9.4 km/s. With a 3 km/s exhaust the rocket must start ${massRatio(9400, 3000).toFixed(0)} times heavier than it ends: 96% propellant, with everything else — engines, tanks, crew, cargo — squeezed into the last 4%. Every bit of speed costs exponentially more than the last. This is the "tyranny of the rocket equation".</p>`,
			notes: `<p>The squares are drawn to scale by area, round 1 tonne arriving at the end. Faster exhaust (hydrogen rather than kerosene) is the only way to soften the exponential: the same Δv needs a smaller multiple of exhaust speeds.</p>`
		},
		// ------------------------------------------------------------------ orbit
		{
			id: 'losses',
			chapter: 'orbit',
			title: 'Why orbit costs 9.4 km/s, not 7.8',
			scene: 'ascent',
			hints: { phase: 'saturn' },
			duration: 30,
			body: `
<p>From <em>Orbits and Kepler's laws</em>: a low orbit is falling round the Earth, at about <strong>7.8 km/s</strong> sideways, 200 km up. Getting there costs more than that. Here is Apollo 11's Saturn V, flown with its real stage masses and engines through the real atmosphere.</p>
<p>The engines push it straight up at first, and that slow, steep climb wastes effort. The spinning Earth is already carrying the rocket east at 0.4 km/s, so a push straight up is at first across its direction of travel: the tally books it as <dfn data-def="Speed lost because the engines push partly across the direction of travel rather than along it.">steering loss</dfn>. Once it is climbing, gravity pulling back along the path takes more: the <dfn data-def="Speed the engines give that gravity takes back while the rocket is still climbing.">gravity loss</dfn>. So the rocket tilts over as soon as it can, in a <dfn data-def="A climb in which the engines push along the direction of travel and gravity slowly bends the path over towards horizontal.">gravity turn</dfn>. Air drag takes a little more, and the upper stages' steering, pushing partly upwards to level off at the right height, some more. The Earth's spin gives back 0.4 km/s for free when the rocket heads east.</p>
<p>The bars tally the budget. The engines give over 9 km/s; about 7.4 of it survives the losses, and the Earth's spin adds 0.4 to make the 7.8 of orbit. In the real flight Apollo 11 entered its parking orbit (a temporary low orbit before heading for the Moon) at 7,793 m/s, 191 km up, 11 minutes 49 seconds after liftoff.</p>`,
			notes: `<p>The model: a point mass in one plane over a round, spinning Earth; Newton's gravity; drag ½ρv²C<sub>d</sub>A with the density of the U.S. Standard Atmosphere 1976 and a constant C<sub>d</sub> = 0.5; stage masses, flow rates and exhaust speeds from NASA's AS-506 flight evaluation report. The steering loss starts large because the rocket rises straight up while the spinning Earth is already carrying it east at 0.4 km/s, so its push is at first across its direction of travel. The first stage's exhaust is slower at sea level, where the air pushes back on it, than in the near-vacuum higher up. Simplifications: the flight heads due east (Apollo 11 flew a 72° heading), the first stage's centre engine isn't shut down early, and the tilt is chosen by the model, so the simulated flight reaches orbit about forty seconds early (T+11:09 against T+11:49). The real orbit, 183 × 186 km over a round Earth, is what the model aims for; the 191 km quoted above is measured from the slightly flattened Earth's surface. The S-IVB kept the rest of its propellant for its second burn, towards the Moon: that is the Δv left in the tanks.</p>`
		},
		{
			id: 'staging',
			chapter: 'orbit',
			title: 'Dropping empty tanks',
			scene: 'ascent',
			hints: { phase: 'design' },
			duration: 30,
			controls: [stages],
			body: `
<p>A rocket's tanks, engines and structure weigh something too — here ${DRY_SHARE * 100}% of the propellant they hold, close to the Saturn V's stages. So even a rocket that is nothing but propellant and tanks can't make its mass ratio bigger than ${(1 + DRY_SHARE) / DRY_SHARE}: with a 3 km/s exhaust, it can never gain more than ${kms(singleStageLimit(3000))} km/s. A single stage of kerosene rocket <strong>can't reach orbit at all</strong>, however much it carries.</p>
<p>The way out is <dfn data-def="Building a rocket as a stack of smaller rockets. Each burns until it is empty and is then dropped, so the stages above don't have to carry its empty tanks.">staging</dfn>: stack rockets on rockets and drop each one when it is empty. The upper stages then speed up only themselves, and their Δvs add up. Same rocket, same 500 t of propellant: try two stages.</p>`
		},
		{
			id: 'design',
			chapter: 'orbit',
			title: 'Design a rocket',
			scene: 'ascent',
			hints: { phase: 'design' },
			duration: 36,
			controls: [fuel, exhaustDesign, stages],
			body: `
<p>Now design your own: choose how much propellant it carries, how fast its engines throw it out and how many stages share it. It carries a ${PAYLOAD / 1000} t payload, and its first stage lifts off with 1.3 times its weight in thrust. Each design is flown from the pad, as the Saturn V was, and either reaches orbit or falls back.</p>
<p>Notice how the budget behaves. Doubling the propellant adds far less than double the Δv. A faster exhaust helps every stage at once. And a third stage helps less than the second did. A rocket that reaches orbit with Δv to spare could carry a heavier payload — or the same one higher.</p>`,
			notes: `<p>The propellant is shared so that every stage has the same mass ratio, which is the best split for stages that are alike. Your rocket's exhaust speed is the same at every height (real engines lose some of it at sea level), and its upper stages light with 0.8 times their weight in thrust. The tilt at the start of the turn is chosen for each design, as mission planners shape the climb for each rocket.</p>`
		},
		// ------------------------------------------------------------------ move
		{
			id: 'raise',
			chapter: 'move',
			title: 'Raising an orbit: speed up to slow down',
			scene: 'transfer',
			duration: 30,
			controls: [burn1, burn2],
			body: `
<p>Once in orbit, a spacecraft moves by changing its speed. Fire the engine to push forwards, along the direction of travel, and the far side of the orbit rises: the circle becomes an ellipse. Half an orbit later the craft reaches its new high point, slower than ever — and if it does nothing, it falls back to where it fired.</p>
<p>To stay up, it must fire forwards again at the high point to round off the new orbit. This two-burn route, the <dfn data-def="The cheapest two-burn way between two circular orbits: an ellipse that just touches both. Described by Walter Hohmann in 1925.">Hohmann transfer</dfn>, takes a satellite from a 200 km orbit to the <dfn data-def="The orbit 35,786 km above the equator whose period is one day, so a satellite there stays above the same spot on the ground.">geostationary</dfn> orbit with ${kms(geo.dv1, 2)} + ${kms(geo.dv2, 2)} = ${kms(geo.total, 2)} km/s, in ${(geo.time / 3600).toFixed(1)} hours. Try it.</p>
<p>The surprise: after two burns forwards, the satellite is <strong>slower</strong> than when it started (3.1 km/s against 7.8). Higher orbits are slower; the burns pay for climbing out of the Earth's gravity.</p>`,
			notes: `<p>Burns are drawn as instant kicks; real ones last minutes. The Δv tally is what the engines must deliver, the number that sets the propellant through the rocket equation. Real launches to geostationary orbit also have to tilt the orbit into the equator's plane, which costs more.</p>`
		},
		// ------------------------------------------------------------------ mars
		{
			id: 'hohmann',
			chapter: 'mars',
			title: 'The cheapest path to Mars',
			scene: 'mars',
			hints: { phase: 'hohmann' },
			duration: 30,
			controls: [lead],
			body: `
<p>The same trick reaches Mars, with the Sun in the middle. Leave the Earth a little faster than the Earth itself goes round the Sun, and the spacecraft coasts outwards on a Hohmann ellipse that touches Mars's orbit on the far side of the Sun, ${(mars.time / 86400).toFixed(0)} days later.</p>
<p>But Mars has to <strong>be there</strong> when the spacecraft arrives. In those 259 days Mars moves 136° round its orbit, so at departure it must already be ${((mars.lead * 180) / Math.PI).toFixed(0)}° ahead of the Earth. Move Mars and watch the craft arrive at an empty spot.</p>
<p>The Earth laps Mars once every ${(mars.synodic / 86400).toFixed(0)} days (about 26 months), so that line-up — the <dfn data-def="The span of dates when the planets are placed so that a spacecraft can reach its target for an affordable Δv.">launch window</dfn> — comes round only once every 26 months.</p>`,
			notes: `<p>This step uses circular orbits at the planets' mean distances. From a 200 km Earth orbit the departure burn is ${kms(mars.burnDepart, 1)} km/s; slowing into a 200 km orbit round Mars takes another ${kms(mars.burnArrive, 1)} km/s (or less, by skimming its atmosphere).</p>`
		},
		{
			id: 'window',
			chapter: 'mars',
			title: 'Catching the launch window',
			scene: 'mars',
			hints: { phase: 'window' },
			duration: 34,
			controls: [depart, flight],
			body: `
<p>Now with the real orbits — Mars's is noticeably oval — and the planets where they really are. Choose a departure date and a flight time: the model finds the orbit that meets Mars on the arrival day (solving <dfn data-def="Finding the orbit that goes from one point to another in a given time. Johann Lambert studied it in the 1760s.">Lambert's problem</dfn>) and adds up the burns from a low Earth orbit into a low Mars orbit.</p>
<p>The curve shows the cost for every departure date. It dips into a narrow valley every 26 months — the windows of late 2026, late 2028 and the turn of 2031 — and between them the price soars. Space agencies plan their Mars missions years ahead around these dates: NASA's Perseverance rover left in the July 2020 window.</p>`,
			notes: `<p>The planet positions come from JPL's approximate orbital elements (Standish), flattened into one plane: Mars's orbit is tilted 1.85°, which makes real transfers near exactly half an orbit costlier than shown here. Each trip is coasting between two burns; the costs are from and into 200 km circular orbits.</p>`
		},
		{
			id: 'flyby',
			chapter: 'mars',
			title: 'Free speed from a flyby',
			scene: 'flyby',
			duration: 32,
			controls: [closest],
			body: `
<p>A planet can change a spacecraft's speed without any propellant. Send a craft to Jupiter on a Hohmann ellipse: it arrives at 7.4 km/s, while Jupiter goes round the Sun at 13.1 km/s and catches it up.</p>
<p>Seen from Jupiter, the craft falls in and swings round on a curve, and leaves at <strong>the same speed it came</strong> — gravity only turns it. But Jupiter is moving: in the Sun's view, the turned velocity plus Jupiter's own velocity adds up to a faster craft. Pass closer and the turn is sharper, the gain bigger. This <dfn data-def="Using a planet's gravity to change a spacecraft's speed and direction relative to the Sun, without propellant. Also called a gravity assist or slingshot.">gravity assist</dfn> nearly carries the craft clear of the Solar System; the energy comes from Jupiter, which slows by an unmeasurably tiny amount.</p>`,
			notes: `<p>The two views are "patched": near Jupiter only its gravity counts, far away only the Sun's. Pioneer 11, the Voyagers, Galileo and Cassini used flybys to reach targets their rockets could not have reached directly, and New Horizons used Jupiter to cut years off its trip to Pluto.</p>`
		},
		// ------------------------------------------------------------------ budget
		{
			id: 'budget',
			chapter: 'budget',
			title: 'Spaceflight is a Δv budget',
			scene: 'rocket',
			hints: { phase: 'budget' },
			duration: 30,
			controls: [mission, budgetExhaust],
			body: `
<p>Every trip in this explainer is a list of speed changes: about 9.4 km/s to reach a low orbit, ${kms(geo.total)} more for geostationary orbit, ${kms(mars.burnDepart)} to leave for Mars, ${kms(mars.burnArrive)} to slow into orbit round it. Mission planners add these up into a <dfn data-def="The total of all the speed changes a mission needs, from which the rocket equation gives the propellant.">Δv budget</dfn>, and the rocket equation turns the budget into propellant.</p>
<p>Because fuel must lift fuel, the cost grows <strong>exponentially</strong> with the budget: pick a mission and see how many tonnes must stand on the pad for each tonne that arrives. That is why every gram of a spacecraft is fought over, why rockets are staged, why engineers prize faster exhaust, and why a free flyby or a well-timed launch window is worth so much.</p>`,
			notes: `<p>The masses assume ideal, weightless tanks and one exhaust speed for the whole trip, so they are the least it could possibly take; real rockets need several times more.</p>`
		}
	]
};
