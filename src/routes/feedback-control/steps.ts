import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- the car (gains as a share of full throttle per km/h of error)
const carKp: Control = {
	type: 'range',
	id: 'carKp',
	label: 'Proportional gain Kp',
	min: 2,
	max: 150,
	step: 1,
	default: 10,
	unit: '% per km/h',
	help: 'Throttle added for each km/h below the target.'
};
const carKi: Control = {
	type: 'range',
	id: 'carKi',
	label: 'Integral gain Ki',
	min: 0,
	max: 10,
	step: 0.1,
	default: 2,
	format: (v) => `${v.toFixed(1)}% per km/h per s`,
	help: 'Throttle added each second for each km/h of error.'
};
const antiWindup: Control = {
	type: 'toggle',
	id: 'antiWindup',
	label: 'Anti-windup: stop integrating at full throttle',
	default: false
};
const znKp: Control = {
	type: 'range',
	id: 'znKp',
	label: 'Test gain Kp (P only)',
	min: 20,
	max: 200,
	step: 1,
	default: 60,
	unit: '% per km/h'
};
const useZn: Control = {
	type: 'toggle',
	id: 'useZn',
	label: 'Switch to the Ziegler–Nichols PID',
	default: false
};

// ---- the drone
const droneKp: Control = {
	type: 'range',
	id: 'droneKp',
	label: 'Proportional gain Kp',
	min: 1,
	max: 16,
	step: 0.5,
	default: 4,
	unit: ' N per m',
	help: 'Extra thrust for each metre below the target.'
};
const droneKd: Control = {
	type: 'range',
	id: 'droneKd',
	label: 'Derivative gain Kd',
	min: 0,
	max: 10,
	step: 0.1,
	default: 2,
	unit: ' N per m/s',
	help: 'Thrust taken off for each m/s the drone is climbing.'
};
const droneKi: Control = {
	type: 'range',
	id: 'droneKi',
	label: 'Integral gain Ki',
	min: 0,
	max: 5,
	step: 0.1,
	default: 1,
	unit: ' N per m·s'
};
const parcel: Control = {
	type: 'toggle',
	id: 'parcel',
	label: 'Carry a 300 g parcel',
	default: true
};
const gusts: Control = { type: 'toggle', id: 'gusts', label: 'Gusts of wind', default: true };
const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Sensor noise',
	min: 0,
	max: 5,
	step: 0.5,
	default: 1,
	unit: ' cm'
};
const delay: Control = {
	type: 'range',
	id: 'delay',
	label: 'Delay of the height reading',
	min: 0,
	max: 500,
	step: 10,
	default: 100,
	unit: ' ms'
};

// ---- the pole and the arm
const poleKp: Control = {
	type: 'range',
	id: 'poleKp',
	label: 'Proportional gain Kp',
	min: 0,
	max: 40,
	step: 0.5,
	default: 15,
	unit: ' m/s² per rad',
	help: 'How hard the cart accelerates for each radian of tilt.'
};
const poleKd: Control = {
	type: 'range',
	id: 'poleKd',
	label: 'Derivative gain Kd',
	min: 0,
	max: 8,
	step: 0.1,
	default: 3,
	unit: ' m/s² per rad/s'
};
const nudge: Control = { type: 'action', id: 'nudge', label: 'Tip it again', action: 'Tip it' };
const armKp: Control = {
	type: 'range',
	id: 'armKp',
	label: 'Proportional gain Kp',
	min: 10,
	max: 300,
	step: 5,
	default: 100,
	unit: ' N·m per rad'
};
const armKd: Control = {
	type: 'range',
	id: 'armKd',
	label: 'Derivative gain Kd',
	min: 0,
	max: 30,
	step: 0.5,
	default: 10,
	unit: ' N·m per rad/s'
};
const armKi: Control = {
	type: 'range',
	id: 'armKi',
	label: 'Integral gain Ki',
	min: 0,
	max: 200,
	step: 5,
	default: 60,
	unit: ' N·m per rad·s'
};
const armX: Control = {
	type: 'range',
	id: 'armX',
	label: 'Target: across',
	min: 0.1,
	max: 0.85,
	step: 0.01,
	default: 0.55,
	unit: ' m'
};
const armY: Control = {
	type: 'range',
	id: 'armY',
	label: 'Target: up',
	min: -0.6,
	max: 0.75,
	step: 0.01,
	default: 0.35,
	unit: ' m'
};

export const spec: ExplainerSpec = {
	slug: 'feedback-control',
	title: 'Feedback control: how machines stay on target',
	summary:
		'Tune the three gains of a PID controller as it holds a car at 90 km/h over hills, a drone at a set height in the wind and a pole upright on a cart, then let two motors steer a robot arm to a point you choose.',
	chapters: [
		{ id: 'car', title: 'Cruise control' },
		{ id: 'drone', title: 'Swinging and steadying' },
		{ id: 'tuning', title: 'Tuning, balancing, reaching' }
	],
	steps: [
		{
			id: 'cruise',
			chapter: 'car',
			title: 'Holding a speed',
			scene: 'car',
			hints: { mode: 'compare', road: 'hills', v0: 90 },
			duration: 30,
			body: `
<p>Set a car's cruise control to 90 km/h. The simplest thing it could do is find the throttle that holds 90 km/h on a flat road — about a quarter of full throttle for this car — and keep it there. On the first hill the car slows to 81 km/h; on the way down it speeds up again.</p>
<p>A real cruise control <strong>measures</strong> the speed many times a second, compares it with the target, and adjusts the throttle by an amount that depends on the difference, the <dfn data-def="The target minus what was measured: how far the machine is from where it should be, and in which direction.">error</dfn>. That is <dfn data-def="Using a measurement of the result to adjust the action that produces it, so that the result is pushed back towards a target.">feedback</dfn>: a loop from the speed, through the sensor and the controller, back into the engine. The faint car keeps the fixed throttle; the solid one closes the loop and stays within about 1.5 km/h of 90.</p>`,
			notes: `<p>The car is the cruise-control example of Åström and Murray's <em>Feedback Systems</em> (2nd ed., 2021, §4.1): a 1,600 kg car in top gear, an engine giving at most 190 N·m, rolling resistance and air drag. We add two things every real car has: the engine takes about half a second to respond to the throttle, and the speed reading is 0.2 s old. It never brakes: this model, like a basic cruise control, works the throttle alone (adaptive cruise control, which keeps a distance from the car ahead, can also apply the brakes). Your body does the same with its blood sugar: the <a href="../homeostasis/#loop">insulin and glucagon loop</a> is negative feedback too.</p>`
		},
		{
			id: 'proportional',
			chapter: 'car',
			title: 'Push in proportion to the error',
			scene: 'car',
			hints: { mode: 'p', road: 'hills', v0: 80 },
			duration: 40,
			controls: [carKp],
			body: `
<p>Driving at 80 km/h you set the cruise control to 90. The simplest useful rule: open the throttle in proportion to the error, <strong>throttle = Kp × error</strong>. 10 km/h short, with Kp = 10% per km/h, means full throttle; 1 km/h short means 10%. This is <dfn data-def="A controller whose correction is the error multiplied by a fixed number, its gain Kp: twice the error, twice the correction.">proportional control</dfn>.</p>
<p>A small gain is <strong>sluggish</strong>: it barely reacts, and the hills drag the car well off its target. A bigger gain reacts harder and holds the speed more tightly. Turn it right up, past about 130% per km/h, and the throttle starts to chatter, slamming shut and opening again: by the time the engine has answered and the slightly old speed reading has caught up, the correction is already too big, so it swings back too far the other way. Too much correction makes the loop oscillate.</p>`
		},
		{
			id: 'offset',
			chapter: 'car',
			title: 'The error that never goes away',
			scene: 'car',
			hints: { mode: 'p', road: 'flat', v0: 80, focus: 'offset' },
			duration: 30,
			controls: [carKp],
			body: `
<p>Look at where the speed settles: not at 90. With Kp = 10% per km/h this car stops at about 87.4 km/h, 2.6 km/h short, and stays there.</p>
<p>It has to. Holding 87 km/h against the air and the road takes about a quarter of full throttle, and a proportional controller only opens the throttle when there is an error. So it settles where the error is just big enough to give the throttle it needs: <strong>error = throttle needed ÷ Kp</strong>. Double the gain and the error halves, but it never reaches zero. This is the <dfn data-def="The error that remains once everything has settled. A proportional controller on its own always leaves one whenever holding the target takes a steady effort.">steady-state error</dfn> of proportional control.</p>`,
			notes: `<p>For a system that is linear (twice the input, twice the output), call its steady output per unit of input G(0). A proportional controller of gain K then settles with error = target ÷ (1 + K·G(0)): the bigger the loop gain K·G(0), the smaller the error, but it is never zero. A car isn't quite linear (air drag grows with the square of the speed), but near a cruising speed it nearly is, and its small speed changes follow this formula.</p>`
		},
		{
			id: 'integral',
			chapter: 'car',
			title: 'Integral: add up the error',
			scene: 'car',
			hints: { mode: 'pi', road: 'hills', v0: 80 },
			duration: 40,
			controls: [carKi, carKp],
			body: `
<p>The fix is a second term that keeps adding the error up over time: <strong>throttle = Kp × error + Ki × (sum of the error so far)</strong>. That sum is the area under the error curve, the <a href="../calculus/#integral">integral</a> of the error, so this is <dfn data-def="A correction that grows with the accumulated error (its integral): as long as any error remains, the correction keeps growing, so the error is driven to zero.">integral action</dfn>.</p>
<p>As long as the car is even slightly slow, the sum keeps growing and the throttle keeps opening. It only stops growing when the error is zero, so the speed now settles on 90 exactly, and the integral holds the quarter-throttle the car needs. A controller with both terms is a <strong>PI</strong> controller.</p>
<p>The integral remembers, though. A strong one keeps pushing after the error is gone: the car overshoots, then the sum unwinds and it dips back. Raise Ki to 10 and watch it overshoot 90 by well over 10 km/h.</p>`
		},
		{
			id: 'windup',
			chapter: 'car',
			title: 'Integral windup',
			scene: 'car',
			hints: { mode: 'pi', road: 'climb', v0: 90, focus: 'windup' },
			duration: 45,
			controls: [antiWindup, carKi, carKp],
			body: `
<p>Now a 1 km climb at 8.4%: too steep for this engine in top gear. The controller opens the throttle fully, yet the car slows to about 85 km/h, all the engine can manage on this slope, and for the 40 seconds of the climb the error sits there, piling up in the integral. That is <dfn data-def="The build-up of a controller's integral while its output is stuck at a limit: the stored-up correction makes it overshoot once the limit no longer holds it back.">integral windup</dfn>.</p>
<p>At the top the road levels and the car no longer needs full throttle, but the huge sum keeps the throttle wide open until the car has gone fast enough for long enough to cancel it: with the starting gains it overshoots to about 113 km/h.</p>
<p>The cure is <strong>anti-windup</strong>: stop adding to the sum while the throttle is already at its limit. Switch it on and the car comes over the top at about 93 km/h and settles.</p>`
		},
		{
			id: 'spring',
			chapter: 'drone',
			title: 'A drone on an invisible spring',
			scene: 'drone',
			hints: { terms: 'p' },
			duration: 30,
			controls: [droneKp],
			body: `
<p>A drone hovers at 1 m and is told to climb to 3 m. Its controller adds the thrust that holds it up against gravity, plus a proportional correction: <strong>extra thrust = Kp × (3 m − height)</strong>.</p>
<p>A car is held back by drag; a drone in still air hardly is (this one not at all), so it reaches 3 m still climbing, overshoots, and the controller pulls it back down: it bounces for ever. A force proportional to the distance from a point is exactly what a spring gives, so the drone is a <a href="../oscillations-resonance/#spring">mass on a spring</a> of stiffness Kp. Its swing takes 2π√(m / Kp): 3.1 s for this 1 kg drone at Kp = 4 N per m. A stiffer “spring” swings faster, but no less.</p>`
		},
		{
			id: 'derivative',
			chapter: 'drone',
			title: 'Derivative: look at how fast it is moving',
			scene: 'drone',
			hints: { terms: 'pd' },
			duration: 30,
			controls: [droneKd, droneKp],
			body: `
<p>The controller needs to ease off before it reaches the target, not after. A third term does that by looking at how fast the drone is climbing, the <a href="../calculus/#tangent">slope</a> of the height curve, its derivative: <strong>thrust −= Kd × climb rate</strong>. This is <dfn data-def="A correction proportional to how fast the measurement is changing: it opposes motion, acting like friction, and so damps oscillations.">derivative action</dfn>.</p>
<p>A force against the speed is friction, so Kd is the spring's <a href="../oscillations-resonance/#damping">damping</a>, with the same damping ratio ζ = Kd ÷ (2√(m·Kp)). Below ζ = 1 the drone still overshoots, by 16% at ζ = 0.5; at ζ = 1 (Kd = 4 with Kp = 4) it rises as fast as it can without overshooting; above that it creeps up.</p>`,
			notes: `<p>The overshoot of such a damped spring is e^(−πζ/√(1−ζ²)). This controller takes the derivative of the measured height rather than of the error, as most real ones do: when the target jumps, the error jumps too, and its derivative would be an enormous, useless kick.</p>`
		},
		{
			id: 'pid',
			chapter: 'drone',
			title: 'All three: PID',
			scene: 'drone',
			hints: { terms: 'pid', parcel: 1 },
			duration: 30,
			controls: [parcel, droneKi, droneKd, droneKp],
			body: `
<p>Hang a 300 g parcel under the drone. The controller still adds the hover thrust for 1 kg, so with only P and D the drone settles below its target, where the spring's extra pull holds the parcel up: 0.3 kg × 9.81 m/s² ÷ Kp = 0.74 m low at Kp = 4. The same steady-state error the car had.</p>
<p>Add the integral and it climbs back to exactly 3 m. Together the three terms are a <dfn data-def="Proportional–integral–derivative controller: its correction is Kp × error + Ki × the accumulated error + Kd × the rate of change, the most common controller in industry.">PID controller</dfn>: P for the present error, I for its past, D for where it is heading. Each gain is a dial, and most of the control loops in factories, and many in cars and aircraft, are this one with its three dials set for its machine.</p>`
		},
		{
			id: 'disturbances',
			chapter: 'drone',
			title: 'Gusts and a noisy sensor',
			scene: 'drone',
			hints: { terms: 'pid', parcel: 0, gusts: 1, noise: 1 },
			duration: 30,
			controls: [gusts, noise, droneKd],
			body: `
<p>Outdoors, gusts push the drone up and down. Feedback doesn't need to know where they come from: it sees the height change and pushes back, so the drone stays within a metre of 3 m.</p>
<p>Its height sensor isn't perfect, though. Each reading jitters by a centimetre or so, and the derivative term turns a reading that jumps a little in a millisecond into a large rate of change: the thrust starts to shake. More noise or more Kd, more shaking. The drone itself hardly notices, because its mass can't follow such fast jitter, but motors that shake waste energy and wear out. Real controllers smooth the derivative, as this one does over 20 ms, and turn Kd down when the sensor is noisy.</p>`
		},
		{
			id: 'delay',
			chapter: 'drone',
			title: 'Delay makes it oscillate',
			scene: 'drone',
			hints: { terms: 'pid', parcel: 0, delay: 1 },
			duration: 30,
			controls: [delay, droneKd, droneKp],
			body: `
<p>Now let the height reading arrive late, as when it comes over a radio link or from a slow camera. The controller is always correcting where the drone <em>was</em>.</p>
<p>A little delay costs damping: at 100 ms the drone overshoots further than without. At about a third of a second, with the starting gains (Kp 4, Ki 1, Kd 2), the swings no longer die away, and beyond that each one is bigger than the last: the correction arrives so late that it pushes the drone the way it is already going. Every loop has such a limit. Lower Kp to lengthen the swing and it tolerates more delay; raise it and it tolerates less.</p>`,
			notes: `<p>The limit is the loop's <em>phase margin</em> divided by the frequency at which a swing, sent once round the loop, comes back the same size (the loop gain is 1): how much extra lag the swing at that frequency can take before the correction is half a swing late. With delay, a high gain is always eventually unstable, which is why engineers fight delay so hard.</p>`
		},
		{
			id: 'ziegler-nichols',
			chapter: 'tuning',
			title: 'Tuning by the book: Ziegler–Nichols',
			scene: 'car',
			hints: { mode: 'zn', road: 'flat', v0: 90 },
			duration: 40,
			controls: [znKp, useZn],
			body: `
<p>How do you pick three gains for a machine you can't write equations for? In 1942 John Ziegler and Nathaniel Nichols, at the Taylor Instrument Companies, published a recipe. Use only P and raise Kp until the loop keeps oscillating on its own, neither growing nor dying. Note that <dfn data-def="The proportional gain at which a loop under P control just keeps oscillating at constant size; Ziegler and Nichols' starting point.">ultimate gain</dfn> Ku and the period of the swing Tu. Then set Kp = 0.6 Ku, Ki = 1.2 Ku ÷ Tu, Kd = 0.075 Ku Tu.</p>
<p>Try it on the car: raise the test gain until the speed's small swing neither grows nor shrinks (here about 133% per km/h, with a 2.1 s period). Then switch to the rule's PID: 80% per km/h, 76 per km/h per s, 21 per km/h/s. The target goes up by half a km/h: it overshoots by about three quarters, and each swing is about a quarter of the one before. That fast, lively response was what Ziegler and Nichols aimed for; most engineers start there and then soften the gains.</p>`,
			notes: `<p>J. G. Ziegler and N. B. Nichols, “Optimum settings for automatic controllers”, <em>Transactions of the ASME</em> 64: 759–768 (1942). Their rules for P only (Kp = 0.5 Ku) and PI (Kp = 0.45 Ku, Ki = Kp × 1.2 ÷ Tu) are in the same paper. The car's real limit cycle is a little messier than a textbook one: once the swings get big, the throttle hits fully open and shut and caps them.</p>`
		},
		{
			id: 'balance',
			chapter: 'tuning',
			title: 'Balancing a pole',
			scene: 'pole',
			duration: 30,
			controls: [nudge, poleKp, poleKd],
			body: `
<p>A car or a drone left alone just drifts. A pole standing on a cart is worse: left alone, it falls, faster and faster. Balancing it is how a Segway, a self-balancing robot or you with a broom on your palm stay up: move the base under the weight.</p>
<p>The controller accelerates the cart towards the side the pole leans, by Kp per radian of tilt. Gravity tips the 1 m pole over by g = 9.81 m/s² per radian, so <strong>Kp must beat g</strong>: below 9.81 the cart can't get under it in time and it falls. Above, without D, the pole wobbles like an upside-down spring; with D it settles upright. The controller only watches the tilt, so the cart wanders off at a steady speed once the pole is up: a real balancer has a second loop that watches the cart.</p>`,
			notes: `<p>The pole here is a weight on a light rod, and the cart's motor gives whatever acceleration is asked for, up to 30 m/s². Tilted by θ, the weight falls according to θ″ = (g sin θ − a cos θ) ÷ L, where a is the cart's acceleration; near upright that is θ″ ≈ (g − Kp) θ ÷ L − Kd θ′ ÷ L, a spring when Kp > g and an explosion when Kp < g.</p>`
		},
		{
			id: 'arm',
			chapter: 'tuning',
			title: 'A robot arm',
			scene: 'arm',
			duration: 40,
			controls: [armX, armY, armKp, armKd, armKi],
			body: `
<p>A robot arm is a chain of joints, each turned by its own <a href="../motors-generators/">electric motor</a> with its own PID loop. Drag the target: geometry works out the two joint angles that put the hand there, and each joint's controller drives its motor to its angle.</p>
<p>Each joint feels gravity pulling the arm down and the other joint's movement tugging at it, and handles both as disturbances. Turn Ki to zero and the arm sags below the target, the steady-state error again, because holding the arm out takes a steady torque; Kd low and it wobbles; Kp low and it is slow. <strong>A machine stays on target by measuring its error and correcting in proportion to it: too little correction is sluggish, and too much makes it oscillate.</strong></p>`,
			notes: `<p>The arm moves in a vertical plane: a 0.5 m upper arm with a 2 kg elbow motor at its end and a 0.4 m forearm carrying 1 kg at the hand, with the full equations of motion of a two-link arm (each joint's motion swings the other). The elbow's controller uses half the shoulder's gains, as it carries less. Motors are limited to 60 and 30 N·m. Industrial arms add feed-forward, computing the torque gravity will need in advance, so the PID only has to correct what the model missed.</p>`
		}
	]
};
