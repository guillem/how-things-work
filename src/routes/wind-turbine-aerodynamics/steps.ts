import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const wind: Control = {
	type: 'range',
	id: 'v',
	label: 'Wind speed',
	min: 0,
	max: 30,
	step: 0.1,
	default: 10,
	format: (v) => `${v.toFixed(1)} m/s`
};

const induction: Control = {
	type: 'range',
	id: 'a',
	label: 'Axial induction a (how much the disc slows the air)',
	min: 0,
	max: 0.5,
	step: 0.005,
	default: 0.15,
	format: (v) => v.toFixed(3)
};

const tsr: Control = {
	type: 'range',
	id: 'lambda',
	label: 'Tip-speed ratio λ',
	min: 1,
	max: 14,
	step: 0.05,
	default: 7.5,
	format: (v) => v.toFixed(2)
};

const pitch: Control = {
	type: 'range',
	id: 'pitch',
	label: 'Blade pitch',
	min: -5,
	max: 30,
	step: 0.5,
	default: 0,
	format: (v) => `${v.toFixed(1)}°`
};

const radius: Control = {
	type: 'range',
	id: 'r',
	label: 'Section at radius',
	min: 12,
	max: 62,
	step: 0.5,
	default: 45,
	format: (v) => `${v.toFixed(1)} m`
};

const tipLoss: Control = {
	type: 'toggle',
	id: 'tipLoss',
	label: 'Prandtl tip loss',
	default: true
};

const A = `<dfn data-def="The axial induction factor a: the fraction by which the rotor slows the wind where the air passes it. The air reaches the rotor at (1 − a)V and, in momentum theory, leaves far downstream at (1 − 2a)V.">axial induction factor</dfn>`;
const CP = `<dfn data-def="The power coefficient CP: the power the rotor takes, divided by the power the wind would carry through the rotor's swept area if the rotor weren't there, ½ρAV³.">power coefficient</dfn>`;
const CT = `<dfn data-def="The thrust coefficient CT: the rotor's thrust (the push of the wind on it, along the wind) divided by ½ρAV².">thrust coefficient</dfn>`;
const TSR = `<dfn data-def="The tip-speed ratio λ = ΩR/V: how many times faster than the wind the blade tips move. Ω is the rotor's angular speed in radians per second, R its radius.">tip-speed ratio</dfn>`;
const PITCH = `<dfn data-def="Turning each whole blade about its own long axis. Positive pitch here turns the leading edge into the wind (toward 'feather'), which lowers the angle of attack all along the blade.">pitch</dfn>`;
const NREL = `<dfn data-def="A wind turbine designed on paper by the US National Renewable Energy Laboratory (Jonkman, Butterfield, Musial and Scott 2009) from the published data of real multi-megawatt machines, so that researchers share one fully specified rotor: 126 m across, 3 blades, 5 MW, with its blade shape and airfoil data published.">NREL 5-MW reference turbine</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'wind-turbine-aerodynamics',
	title: 'Wind turbines & the Betz limit',
	summary:
		'Slow the air through an actuator disc and find the 16/27 that no rotor can beat; then put real blades on it, the NREL 5-MW reference rotor with its published airfoil data, and a blade-element-momentum model shows why it gets close only near one tip-speed ratio, and how pitch holds its power at 5 MW in a gale.',
	chapters: [
		{ id: 'disc', title: 'Momentum theory' },
		{ id: 'blades', title: 'Real blades' },
		{ id: 'turbine', title: 'A turbine in the wind' }
	],
	steps: [
		// ------------------------------------------------------------------ disc
		{
			id: 'wind',
			chapter: 'disc',
			title: 'The power in the wind',
			scene: 'disc',
			hints: { mode: 'wind' },
			duration: 24,
			controls: [wind],
			body: `
<p>Wind is air with kinetic energy. Through an area <em>A</em> facing a wind of speed <em>V</em>, a mass ρAV of air passes each second (ρ, the air's density, is 1.225 kg/m³ at sea level), each kilogram carrying ½V² of kinetic energy. So the wind carries a power</p>
<p class="formula">P<sub>wind</sub> = ½ ρ A V³</p>
<p>through that area: 612 W through each square metre at 10 m/s. The <em>cube</em> is the first fact of wind energy. Twice the wind speed brings twice the air, each kilogram with four times the energy: eight times the power. Move the slider.</p>
<p>The circle is the rotor of the ${NREL}, 126 m across: at 10 m/s, 7.6 MW of wind passes through it. The question of this page is how much of that a rotor can take.</p>`,
			notes: `<p>Density falls with altitude and rises with cold: the same wind carries about 10% less power at 1,000 m, and a few per cent more in winter. Real wind speed also changes with height, which is one reason rotors are put on tall towers.</p>`
		},
		{
			id: 'disc',
			chapter: 'disc',
			title: 'An actuator disc slows the air',
			scene: 'disc',
			hints: { mode: 'disc' },
			duration: 30,
			controls: [induction],
			body: `
<p>Forget the blades for now. Rankine and Froude replaced a rotor by an <em>actuator disc</em>: a thin, porous disc that takes energy from the air passing through it, by slowing it. Its effect is one number, the ${A} <em>a</em>: the air reaches the disc at (1 − a)V. Drag the handle on the disc, or the slider.</p>
<p>Follow one tube of air that passes through the disc (the stream tube). The air in it slows as it approaches, so the same mass flow ρAu needs a wider tube; behind the disc it keeps slowing until its pressure is back to the surroundings', far downstream at (1 − 2a)V. Across the disc itself the speed is continuous but the pressure drops: that pressure step, over the disc's area, is the thrust. Momentum and energy, applied to the tube, give</p>
<p class="formula">C<sub>T</sub> = 4a(1 − a),&nbsp;&nbsp; C<sub>P</sub> = 4a(1 − a)²</p>
<p>the ${CT} and the ${CP}, as fractions of the wind's ½ρAV² and ½ρAV³.</p>`,
			notes: `<p>The derivation: the thrust is the momentum the air loses, ṁ(V − u<sub>w</sub>), and also the pressure step times the area; Bernoulli's equation holds on each side of the disc, but not across it, where the energy is taken. The two expressions for thrust agree only if the speed at the disc is the average of the upstream and wake speeds, (V + u<sub>w</sub>)/2, which is why the wake slows by 2a when the disc slows the air by a. The power is the thrust times the speed at the disc. Assumptions: steady, incompressible flow with no friction and no swirl, and a uniform disc (Burton et al., <em>Wind Energy Handbook</em>, §3.2; Hansen, <em>Aerodynamics of Wind Turbines</em>, ch. 4).</p>`
		},
		{
			id: 'betz',
			chapter: 'disc',
			title: 'The Betz limit: 16/27',
			scene: 'disc',
			hints: { mode: 'betz' },
			duration: 30,
			controls: [induction],
			body: `
<p>Now find the best <em>a</em>. Slow the air too little and you take little energy from each kilogram. Slow it a lot and each kilogram gives up most of its energy, but the air piles up in front of the disc and more of the wind goes <em>around</em> it: the stream tube that passes through shrinks upstream, and the mass flow drops. Between the two, C<sub>P</sub> = 4a(1 − a)² peaks at a = 1/3, where the air passes the disc at two-thirds of the wind speed and leaves at one third:</p>
<p class="formula">C<sub>P,max</sub> = 16/27 ≈ 0.593</p>
<p>This is the <strong>Betz limit</strong> (Lanchester 1915, Betz 1920, Joukowsky 1920). At its extreme, a disc that stopped the air completely would let nothing through and take no power at all: the air must keep moving to get out of the way. The limit is not a shortcoming of today's machines, nor a generator's efficiency: it holds for any device that takes energy from an open stream, before any machinery is involved.</p>`,
			notes: `<p>Past a = 1/2 the formula would need a wake flowing backwards, so the theory says nothing there; the chart draws it dashed only to show where it would lead (to zero at a = 1). A turbine in a duct or a channel is not in an open stream, and its limit is set differently; the comparison there is with the flow the duct itself lets through.</p>`
		},
		{
			id: 'thrust',
			chapter: 'disc',
			title: 'Pushing harder: the turbulent wake',
			scene: 'disc',
			hints: { mode: 'thrust' },
			duration: 30,
			controls: [induction],
			body: `
<p>The thrust grows with <em>a</em> all the way: at the Betz optimum C<sub>T</sub> = 8/9, and the wind pushes on the rotor with 89% of the dynamic pressure ½ρV² over its whole area. A disc the size of the NREL rotor, at the optimum in an 11 m/s wind, would be pushed with about 820 kN, the weight of 84 tonnes, at the top of its tower.</p>
<p>Momentum theory predicts that above a = 1/2 the thrust would fall. Real rotors do the opposite. Beyond about a = 0.4 the slow wake is unstable: it breaks into eddies that mix in fast air from outside (the <em>turbulent wake state</em>), and the measured thrust keeps rising toward that of a solid plate. Glauert (1926) fitted this from rotor tests; the purple line is Buhl's (2005) empirical form of his correction, not measurements themselves, which joins momentum theory smoothly at a = 0.4. The blade model in the next chapter switches to this empirical fit wherever a blade element is loaded that heavily.</p>`,
			notes: `<p>The correction is empirical: the measurements (Lock et al. 1926, on propellers run as windmills) scatter a lot, and different fits are in use. For a turbine at its design point it matters little, since most of the blade runs near a = 1/3; it matters at high tip-speed ratios and near the blade tips, where the local loading is high.</p>`
		},
		// ------------------------------------------------------------------ blades
		{
			id: 'section',
			chapter: 'blades',
			title: 'A blade is a rotating wing',
			scene: 'section',
			duration: 30,
			controls: [tsr, pitch, radius],
			body: `
<p>A real rotor takes its energy with blades: wings, as on <a href="../flight/">the flight page</a>, that turn the air passing them and feel lift. Cut a blade at radius <em>r</em> and look along it. The section meets two motions at once: the wind, slowed to (1 − a)V, and its own motion through the air, Ωr, plus a little swirl a′ the rotor puts into its wake. Together they make the relative wind W, coming at the <em>inflow angle</em> φ to the rotor plane.</p>
<p>The angle of attack is φ minus the angle at which the section is set: its built-in twist plus the ${PITCH} of the whole blade. Lift is perpendicular to W and drag along it. Resolved along the axis they give thrust; across it, the force that turns the rotor. Because φ is small near the tip, there most of the lift points along the axis, and only a sliver turns the rotor: a good lift-to-drag ratio is everything.</p>
<p>The rotor's speed enters through the ${TSR} λ = ΩR/V. Change λ: the inflow angle, and with it the angle of attack, changes all along the blade. The blade is twisted, steep at the root and flat at the tip, so that the angle of attack stays near the best lift-to-drag for its design λ.</p>`,
			notes: `<p>The sections are those of the NREL 5-MW blade (Jonkman et al. 2009): cylinders at the root, then Delft University's DU airfoils, 40% to 21% thick, and a NACA 64-618 over the outer third. Their lift and drag are wind-tunnel measurements, corrected by the report's authors for the delay of stall on a rotating blade and extended to all angles. The airfoil outline is schematic and has a fixed display size; the velocity triangle shows the modelled component ratios.</p>`
		},
		{
			id: 'span',
			chapter: 'blades',
			title: 'Blade-element momentum',
			scene: 'span',
			duration: 30,
			controls: [tsr, pitch, tipLoss],
			body: `
<p>The blade's forces depend on the induction (through the inflow angle), and the induction depends on the forces (through momentum). <em>Blade-element momentum</em> theory (Glauert 1935) solves both together, ring by ring: each annulus of the rotor obeys momentum theory, with the thrust and torque the blade sections in it produce. For each of the NREL blade's 17 elements the model finds the inflow angle at which the two agree.</p>
<p>At λ = 7.5 most of the blade runs at an angle of attack between 3° and 9°, and slows the air by between a quarter and a third, close to Betz's a = 1/3. The root, built for strength (thick cylinders), takes almost nothing. Toward the tip, the air leaks around the end of the blade from the high-pressure side to the low one, and lift falls to zero at the tip: <em>Prandtl's tip-loss factor</em> F models it, for a rotor with a finite number of blades. Turn it off to see what three blades lose against an infinitely many-bladed disc.</p>
<p>Now move λ. Slow down (low λ) and the inflow angle grows: the angle of attack rises past stall all along the blade. Speed up and it falls toward zero: the sections make little lift, while the outer blade, moving fast through the air, slows it more than a third and enters the turbulent-wake state.</p>`,
			notes: `<p>The solver follows Ning (2014), which writes the two conditions as one equation in φ that always has a root in a known interval, and uses Buhl's (2005) high-induction correction, as NREL's AeroDyn does. Not modelled: the delay of the wake's response when the wind or pitch changes, yawed flow, tower shadow, the blade bending, and the flow along the span; in a steady wind aligned with the rotor, BEM agrees well with measurements near the design point, and less well in stall.</p>`
		},
		{
			id: 'cp-lambda',
			chapter: 'blades',
			title: 'One best tip-speed ratio',
			scene: 'cp',
			duration: 30,
			controls: [tsr, pitch],
			body: `
<p>Add up the torque along the blade and multiply by Ω to get the rotor's power; divided by ½ρAV³, that is C<sub>P</sub> at that λ. Swept over λ it makes the rotor's C<sub>P</sub>–λ curve: a single hump. This model of the NREL rotor peaks at C<sub>P</sub> = 0.49 at λ ≈ 7.7, close to the reference design's own 0.48 at λ = 7.55. Drag the point along it; pitch the blades and the hump moves and shrinks.</p>
<p>Real rotors reach 0.45–0.50, about four-fifths of the Betz limit, and the bars show where the rest goes. Even a blade with no drag and no tip loss falls short, because a rotor that pushes its blades round leaves a swirling wake, whose energy no longer turns anything; and the root, built for strength, takes nothing. Then the tips leak, then drag takes a share of the lift's work. A rotor near 0.5 is close to perfect.</p>
<p>Holding the hump's peak is the controller's job: below rated wind it adjusts the generator's torque so that the rotor speeds up and slows down with the wind, keeping λ near its optimum.</p>`,
			notes: `<p>The report obtained 0.482 at λ = 7.55 with NREL's FAST and AeroDyn codes. This simplified implementation gives about 0.49; the precise cause of the difference has not been isolated, though BEM results are known to shift by a hundredth or so with choices such as the loss models and the number of elements. The losses in the bars depend on the order in which they are added; the bars switch on tip loss before drag. Glauert's optimum rotor, with wake swirl but no drag and infinitely many blades, reaches 0.58 at λ = 7.5 and approaches 16/27 only as λ grows (Burton et al., §3.7).</p>`
		},
		// ------------------------------------------------------------------ turbine
		{
			id: 'power-curve',
			chapter: 'turbine',
			title: 'The power curve',
			scene: 'curve',
			hints: { mode: 'power' },
			duration: 32,
			controls: [wind],
			body: `
<p>Now the whole turbine in a steady wind. Below 3 m/s (<em>cut-in</em>) it stays parked: there is too little to be worth it. From cut-in to about 6.0 m/s this model holds the rotor at its minimum speed, 6.9 rpm. From about 6.0 to 10.6 m/s the controller holds λ = 7.55, the rotor's speed rising in step with the wind, so C<sub>P</sub> stays near its peak and the power follows the cube law. At 12.1 rpm the rotor reaches its top speed (the tip moves at 80 m/s, limited by noise and erosion) and holds that speed until, soon after, the generator reaches its rated 5 MW. In this model that happens at 11.2 m/s; the reference design gives 11.4.</p>
<p>Above rated the wind carries far more power than the generator can take: the blades <em>pitch</em> toward feather, lowering the angle of attack until the rotor takes about 5.30 MW, delivering 5 MW electrically. At 25 m/s (<em>cut-out</em>), with the blades turned 23° and the rotor taking under 5% of the wind's power, the turbine shuts down to protect itself. Drag the wind speed.</p>`,
			notes: `<p>The controller here is simplified from Jonkman et al.'s: the minimum rotor speed (6.9 rpm) is simply held at low wind, and the step from optimal λ to rated speed is abrupt rather than a ramp of generator torque. Real power curves are measured over 10-minute averages of turbulent wind, which rounds the knee at rated.</p>`
		},
		{
			id: 'budget',
			chapter: 'turbine',
			title: 'Where the wind’s power goes',
			scene: 'curve',
			hints: { mode: 'budget' },
			duration: 30,
			controls: [wind],
			body: `
<p>The same turbine as a fraction of the wind's power, ½ρAV³. The Betz limit is a ceiling on the rotor alone. The rotor's C<sub>P</sub> sits below it, flattest near 0.49 where the controller holds λ at its optimum. The drivetrain and generator then lose another 5.6% of what the rotor delivers (Jonkman et al. take 94.4% efficiency): a separate loss, after the aerodynamics, with nothing to do with Betz.</p>
<p>Above rated the fraction falls as V⁻³, on purpose: the turbine sheds the excess so that its parts survive, and because a bigger generator would sit idle most of the time. The cube law is also why wind power varies so much: a gust from 8 to 10 m/s nearly doubles the output. On <a href="../power-grid/">the power grid</a> that output must be balanced, moment by moment, against demand.</p>`,
			notes: `<p>Taken over a year, the average output of a turbine divided by its rated power (the <em>capacity factor</em>) is typically 25–45% on land and 40–55% offshore, set by how often the wind blows near or above rated. The rated power is a design choice against the local wind: a bigger rotor on the same generator reaches rated sooner and makes more energy in light winds.</p>`
		}
	]
};
