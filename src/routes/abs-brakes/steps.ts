import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const slip: Control = {
	type: 'range',
	id: 'slip',
	label: 'Slip',
	min: 0,
	max: 1,
	step: 0.01,
	default: 0.1,
	format: (v) =>
		v === 0 ? '0%: rolling freely' : v === 1 ? '100%: locked' : `${Math.round(v * 100)}%`,
	help: 'How much slower the tyre’s rim moves than the road under it.'
};

const surface: Control = {
	type: 'select',
	id: 'surface',
	label: 'Road',
	default: 'dry',
	options: [
		{ value: 'dry', label: 'Dry asphalt' },
		{ value: 'wet', label: 'Wet asphalt' },
		{ value: 'snow', label: 'Snow' }
	]
};

const pedal: Control = {
	type: 'range',
	id: 'pedal',
	label: 'Brake pedal',
	min: 0.05,
	max: 1,
	step: 0.01,
	default: 0.3,
	format: (v) => `${Math.round(v * 100)}% of a full press`,
	help: 'The brake torque the driver asks for, held from the moment the foot lands.'
};

const abs: Control = {
	type: 'toggle',
	id: 'abs',
	label: 'ABS',
	default: true,
	help: 'Anti-lock braking: release and reapply the brake whenever the wheel starts to lock.'
};

const replay: Control = {
	type: 'action',
	id: 'replay',
	label: 'Stop',
	action: 'Brake again',
	help: 'Replay the stop from 100 km/h.'
};

export const spec: ExplainerSpec = {
	slug: 'abs-brakes',
	title: 'ABS & the tire’s grip',
	summary:
		'Brake a car from 100 km/h on dry asphalt, wet asphalt and snow with a measured tyre friction curve: find the slip where the tyre grips best, lock the wheel and slide, then let ABS cycle the brake to hold the wheel near the peak and keep the steering.',
	chapters: [
		{ id: 'grip', title: 'The tyre’s grip' },
		{ id: 'brake', title: 'Braking without ABS' },
		{ id: 'abs', title: 'Anti-lock braking' }
	],
	steps: [
		// ------------------------------------------------------------------ grip
		{
			id: 'slip',
			chapter: 'grip',
			title: 'A braking tyre slips',
			scene: 'curve',
			hints: { phase: 'slip' },
			duration: 18,
			controls: [slip],
			body: `
<p>A tyre pushes on the road only through a patch of rubber about the size of your hand. To brake, the road has to pull that patch backwards, and the rubber can only be pulled if it is stretched: the wheel must turn a little <em>slower</em> than the road passes underneath it.</p>
<p>How much slower is the <dfn data-def="Braking slip s = (v − ωR) / v: the car's speed v minus the rim speed ωR of the wheel (angular speed ω, radius R), as a fraction of v. 0 for a freely rolling wheel, 1 (100%) for a locked one.">slip</dfn>: s = (v − ωR) / v, where v is the car’s speed and ωR the speed of the tyre’s rim. A freely rolling wheel has s = 0. A wheel that has stopped turning while the car still moves, a <strong>locked</strong> wheel, has s = 1.</p>
<p>Slide the slip and compare the two speeds. The friction coefficient μ is the braking force divided by the weight on the wheel.</p>`
		},
		{
			id: 'curve',
			chapter: 'grip',
			title: 'The friction curve has a peak',
			scene: 'curve',
			hints: { phase: 'curve' },
			duration: 22,
			controls: [slip, surface],
			body: `
<p>Measured on real tyres, the friction rises steeply with the first few percent of slip, peaks, then <strong>falls</strong> as the wheel heads for locking. On dry asphalt the peak is μ ≈ 1.17 at about 17% slip, and a locked wheel gets only 0.76. Wet asphalt peaks at 0.80 near 13%, and snow at only 0.19 near 6%, with a peak so flat it barely matters where you sit on it.</p>
<p>These curves are the Burckhardt model, μ(s) = c₁(1 − e^(−c₂s)) − c₃s, with the coefficient sets for three surfaces that are standard in the ABS literature. Past the peak, the rubber in the contact patch is sliding rather than gripping, and sliding rubber grips less.</p>
<p>So the best braking is not a locked wheel. It is a wheel still turning, slipping just enough to sit near the peak.</p>`,
			notes: `<p>The coefficients are Burckhardt’s (1993), as given by Kiencke and Nielsen, <i>Automotive Control Systems</i>, and reproduced in many papers (for example arXiv:2211.10336). The peak is where dμ/ds = 0: s* = ln(c₁c₂/c₃)/c₂. Real tyres differ with rubber, tread, temperature and load, and the industry’s standard description is Pacejka’s “magic formula” fitted to each tyre. The shape (a steep rise, a peak, a fall towards locking) is the same.</p>`
		},
		// ------------------------------------------------------------------ brake
		{
			id: 'gentle',
			chapter: 'brake',
			title: 'Two equations: the car and the wheel',
			scene: 'brake',
			hints: { phase: 'gentle', abs: false },
			duration: 20,
			controls: [pedal, surface, replay],
			body: `
<p>Model one wheel carrying a quarter of a 1,500 kg car, from 100 km/h. Two equations of motion run side by side. The car slows from the road’s force on the tyre, m dv/dt = −μN, with N the weight on the wheel. The wheel spins from two torques that oppose each other: the road’s force tries to keep it turning (μN times the radius R), and the brake tries to stop it (torque T): J dω/dt = μNR − T.</p>
<p>Press gently and the two settle into balance: the wheel slows a little more than the car, the slip finds the value where the road’s torque matches the brake’s, and the car stops. The plots show the car’s speed and the rim’s speed, and the gap between them is the slip.</p>`,
			notes: `<p>The equations are integrated in 0.1 ms steps. Below 1 m/s the slip is ill-defined (a ratio of two small numbers) and the last few centimetres are added at the last friction. Real ABS units switch off at a few km/h for the same reason.</p>`
		},
		{
			id: 'lock',
			chapter: 'brake',
			title: 'Press hard: the wheel locks',
			scene: 'brake',
			hints: { phase: 'lock', abs: false, pedal: 1 },
			duration: 20,
			controls: [surface, replay],
			body: `
<p>Now stamp on the pedal. The brake torque grows past anything the road can return, even at the peak, so the wheel decelerates far faster than the car. The slip runs past the peak and the friction drops, which makes the road’s torque smaller still. Nothing stops the slide down the far side of the curve. In about 0.3 s the wheel stops turning.</p>
<p>From then on the car slides on the locked friction: 0.76 on dry asphalt instead of 1.17. The stop from 100 km/h takes about 52 m instead of the 34 m the peak would allow, and on snow about 300 m instead of 210 m.</p>`
		},
		{
			id: 'threshold',
			chapter: 'brake',
			title: 'The perfect foot',
			scene: 'brake',
			hints: { phase: 'threshold', abs: false },
			duration: 22,
			controls: [pedal, surface, replay],
			body: `
<p>A skilled driver can do better than lock up: press just hard enough to stay below locking, and no harder. Find that pedal position here. On dry asphalt it is just over half a full press, and the stop comes within a few metres of the best possible.</p>
<p>Now switch to snow without moving the pedal. The pressure that was right on dry asphalt is far too much for snow’s grip, and the wheel locks at once. The right pressure depends on a road the driver can’t measure, and it changes from one patch to the next. That is the job ABS takes over.</p>`
		},
		// ------------------------------------------------------------------ abs
		{
			id: 'abs',
			chapter: 'abs',
			title: 'ABS: release, reapply, repeat',
			scene: 'brake',
			hints: { phase: 'abs', abs: true, pedal: 1 },
			duration: 22,
			controls: [surface, replay],
			body: `
<p>The anti-lock system watches each wheel. When the slip runs past a threshold (here 20%), a valve lets the brake pressure drop until the wheel spins back up. When the slip falls under a lower threshold (10%), the pressure builds again. The driver keeps the pedal fully down the whole time.</p>
<p>The result is a sawtooth: the torque rises and drops about seven times a second, and the slip swings around the peak instead of running away to locking. You can feel this through the pedal of an ABS car as a rapid pulsing.</p>
<p>A fixed slip band works on every road here. Snow’s peak sits at a smaller slip than the band, but its curve is so flat there that it hardly matters.</p>`,
			notes: `<p>This is the simplest version of the idea. Production systems (Bosch put the first one into series production in 1978) cannot measure the car’s speed directly: they estimate it from the four wheel speeds, so they work mainly from each wheel’s deceleration and use slip as a check, with extra phases that hold the pressure. They control each wheel or axle separately and share their valves with stability control.</p>`
		},
		{
			id: 'compare',
			chapter: 'abs',
			title: 'How much shorter?',
			scene: 'compare',
			hints: { phase: 'compare' },
			duration: 22,
			controls: [surface],
			body: `
<p>Line up the stops from 100 km/h on each surface: a locked wheel, a perfect foot holding the best constant pressure, ABS, and the floor that no braking can beat, the peak friction held for the whole stop.</p>
<p>In this model ABS stops far shorter than a locked wheel, but it does not beat a perfect foot on dry asphalt: cycling around the peak loses a little compared with sitting on it. Its real gain is over a driver who panics and locks the wheels, which is what many drivers do in an emergency.</p>
<p>And on some surfaces the comparison flips. On loose gravel or deep fresh snow, a locked tyre ploughs up a wedge of material in front of it that helps it stop, and ABS, by keeping the wheel turning, gives that up. These curves describe packed surfaces and cannot show it.</p>`
		},
		{
			id: 'steer',
			chapter: 'abs',
			title: 'A locked wheel cannot steer',
			scene: 'steer',
			hints: { phase: 'steer', pedal: 1 },
			duration: 22,
			controls: [abs, surface, replay],
			body: `
<p>The bigger reason for ABS is steering. A tyre turns the car by slipping sideways a little as well (its <dfn data-def="The angle between the direction a wheel points and the direction it actually travels.">slip angle</dfn>), and the friction it has is shared between braking and turning. A wheel that is still rolling can do both.</p>
<p>A locked wheel slides. Its rubber has no rolling direction any more, so its whole friction points against the direction of travel, whichever way the wheel is turned. The driver turns the steering wheel and the car goes straight on.</p>
<p>Here the driver stamps on the brake and, half a second later, steers into the next lane to miss a stopped car about 30 m ahead. Turn ABS off: the wheels lock within a third of a second and the car slides straight into it. Turn ABS on: the car brakes nearly as hard <em>and</em> swerves around it.</p>`,
			notes: `<p>The model uses Burckhardt’s combined slip: a sideways slip (1 − s) tan α joins the braking slip s, the friction of their combined size is shared in proportion to the two, and the car is treated as a point that turns under the sideways force. A locked wheel has s = 1, so its sideways slip and sideways force are zero. In a real car, locked rear wheels also make the car spin, which is why every car apportions more braking to the front.</p>`
		}
	]
};
