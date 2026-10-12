import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------
// One speed slider shared by every step, so the train keeps its speed across them.

/** The train's speed as a fraction of the speed of light. */
const beta: Control = {
	type: 'range',
	id: 'beta',
	label: 'Speed of the train',
	min: 0,
	max: 0.99,
	step: 0.01,
	default: 0.6,
	format: (v) => `${v.toFixed(2)} c`,
	help: 'As a fraction of c, the speed of light.'
};

/** The draggable event on the spacetime diagram (the handle writes these back). */
const eventTime: Control = {
	type: 'range',
	id: 'ect',
	label: 'Event: time on the platform, c·t',
	min: -250,
	max: 250,
	step: 10,
	default: 200,
	unit: ' m'
};
const eventPlace: Control = {
	type: 'range',
	id: 'ex',
	label: 'Event: place on the platform, x',
	min: -250,
	max: 250,
	step: 10,
	default: 100,
	unit: ' m'
};

export const spec: ExplainerSpec = {
	slug: 'special-relativity',
	title: 'Special relativity: why moving clocks run slow',
	summary:
		'Speed a train with a light clock towards the speed of light and compare what the passengers and the platform measure: clocks that tick slower, a train that gets shorter, and two lightning strikes that happen at once for one observer and one after the other for the other.',
	chapters: [
		{ id: 'light', title: 'The speed everyone agrees on' },
		{ id: 'time', title: 'Moving clocks run slow' },
		{ id: 'length', title: 'Moving things are shorter' },
		{ id: 'now', title: 'Whose “now”?' },
		{ id: 'spacetime', title: 'Spacetime' }
	],
	steps: [
		// ------------------------------------------------------------------ light
		{
			id: 'same-light',
			chapter: 'light',
			title: 'Light ignores the train’s speed',
			scene: 'clock',
			hints: { phase: 'light' },
			duration: 20,
			controls: [beta],
			body: `
<p>On a smooth train moving at a steady speed, a ball you drop falls straight down and a ball you throw flies as it would at home. Newton's laws work the same way in every frame of reference that moves steadily, without speeding up or turning (an <dfn data-def="A frame of reference that is not accelerating: an object with no force on it keeps moving at constant velocity, as Newton's first law says.">inertial frame</dfn>). No experiment inside the train can tell whether the train is moving. Galileo saw this in 1632. Only motion <em>relative</em> to something else means anything.</p>
<p>Speeds add up as you would expect: throw a ball forwards at 20 m/s on a train going at 30 m/s, and someone on the platform clocks it at 50 m/s.</p>
<p>Light breaks the rule. A lamp in the middle of the carriage flashes, and both the passengers and the people on the platform measure the flash moving at the same speed, <strong>c ≈ 300 000 km/s</strong>, forwards and backwards. The train's speed is not added. This is Einstein's second <dfn data-def="Einstein's 1905 starting points: (1) the laws of physics are the same in every inertial frame; (2) light in a vacuum moves at the same speed c in every inertial frame, whatever the motion of its source.">postulate</dfn> (1905). Experiments have confirmed it again and again.</p>
<p>The ball now follows the rule that keeps everything below c. Thrown at 0.5 c on a train going at 0.6 c, it moves at 0.85 c relative to the platform, not 1.1 c. Move the slider and watch both rows.</p>
<p>Notice also where the flash lands. In the bottom row it reaches both ends of the carriage together. In the top row the back of the carriage runs into the flash while the front runs away from it, so the back is lit first. Remember this for chapter 4.</p>`,
			notes: `<p>The relativistic rule for adding a velocity <i>u</i> (measured in the train) to the train's speed <i>v</i> is <i>w</i> = (<i>u</i> + <i>v</i>) / (1 + <i>uv</i>/<i>c</i>²). At everyday speeds <i>uv</i>/<i>c</i>² is tiny and it gives <i>u</i> + <i>v</i>. With <i>u</i> = <i>c</i> it gives exactly <i>c</i>, whatever <i>v</i> is. Since 1983 the metre has been defined from c: light covers exactly 299 792 458 metres in one second. The animation is slowed down enormously. In real time the flash would cross a 25 m carriage in less than a ten-millionth of a second. The moving carriage is drawn shorter than the one at rest: chapter 3 explains why.</p>`
		},
		// ------------------------------------------------------------------ time
		{
			id: 'light-clock',
			chapter: 'time',
			title: 'A clock made of light',
			scene: 'clock',
			hints: { phase: 'clock', rest: true },
			duration: 16,
			body: `
<p>Since everyone agrees on the speed of light, build a clock out of it. A <dfn data-def="A thought-experiment clock: a pulse of light bouncing between two parallel mirrors. Each round trip is one tick.">light clock</dfn> is a pulse of light bouncing between two mirrors. Every round trip, up and back down, is one tick.</p>
<p>Here the mirrors are 1.5 m apart, so the light travels 3 m per tick, and one tick lasts 3 m ÷ c ≈ <strong>10 nanoseconds</strong>. The animation is slowed down about 100 million times.</p>
<p>There is one clock on the train and an identical one on the platform. For now the train is standing still, so the two rows (the platform's view and the passenger's view) look the same, and the two clocks tick in step.</p>`,
			notes: `<p>Any good clock would do: a quartz watch, a caesium atomic clock, your heartbeat. If moving light clocks ran slow but moving atomic clocks did not, a passenger could compare the two and find out that she was moving. That would break the first postulate. So whatever happens to the light clock happens to every clock, and to time itself.</p>`
		},
		{
			id: 'time-dilation',
			chapter: 'time',
			title: 'The moving clock ticks slower',
			scene: 'clock',
			hints: { phase: 'dilation' },
			duration: 24,
			controls: [beta],
			body: `
<p>Now set the train moving. For the passenger nothing changes: her clock's light still goes straight up and down, one tick every 10 ns.</p>
<p>Seen from the platform, the mirrors move sideways while the light is in flight, so the light follows a longer, zig-zag path. It still moves at c (the postulate), so a longer path takes longer. <strong>The platform times each tick of the train's clock as longer than its own.</strong> The moving clock runs slow: this is <dfn data-def="The slowing of a moving clock, as timed from a frame in which it moves: one of its ticks lasts γ times longer.">time dilation</dfn>.</p>
<p>Look at the bottom row too. For the passenger, the platform is the thing that moves, and the platform's clock is the one with the zig-zag light. Each observer finds the <em>other's</em> clock slow. Neither is wrong: there is no favoured frame that is really at rest.</p>
<p>At 0.6 c each tick of the moving clock lasts 1.25 times longer: four of its ticks for every five of the clock at rest.</p>`,
			notes: `<p>Pythagoras gives the factor. During half a tick, lasting <i>T</i>/2 on the platform, the light runs along the slanted side, <i>c</i><i>T</i>/2. The mirrors move <i>v</i><i>T</i>/2 sideways and the gap between them is <i>d</i>. So (<i>cT</i>/2)² = <i>d</i>² + (<i>vT</i>/2)², and <i>T</i> = (2<i>d</i>/<i>c</i>) / √(1 − <i>v</i>²/<i>c</i>²), the tick at rest stretched by the factor γ of the next step. The mirror gap is across the motion, which is why both frames agree on it.</p>`
		},
		{
			id: 'gamma',
			chapter: 'time',
			title: 'The Lorentz factor',
			scene: 'gamma',
			hints: { phase: 'gamma' },
			duration: 18,
			controls: [beta],
			body: `
<p>The stretch factor has a name, the <dfn data-def="γ = 1 / √(1 − v²/c²), the factor by which moving clocks run slow and moving lengths shrink. It is 1 at rest and grows without limit as v approaches c.">Lorentz factor</dfn>, γ (gamma):</p>
<p class="formula"><strong>γ = 1 / √(1 − v²/c²)</strong></p>
<p>At everyday speeds γ is 1 to many decimal places. For a jet airliner at 250 m/s it is 1.00000000000035. That is why nobody noticed for so long. It reaches 1.25 at 0.6 c, 5/3 ≈ 1.67 at 0.8 c and 7.09 at 0.99 c. At the speed of light it would be infinite, which is one way to see that nothing with mass can get there.</p>
<p>Push the slider towards the right-hand end and watch the curve rise steeply.</p>`,
			notes: `<p>Satellite navigation has to allow for this. A GPS satellite moves at about 3.9 km/s, so its atomic clock falls behind clocks on the ground by about 7 microseconds a day. Gravity has the opposite and larger effect, from general relativity. Left uncorrected, the total error would build up to kilometres of position error within a day (N. Ashby, “Relativity in the Global Positioning System”, <i>Living Reviews in Relativity</i> 6, 2003).</p>`
		},
		{
			id: 'muons',
			chapter: 'time',
			title: 'Muons that live too long',
			scene: 'gamma',
			hints: { phase: 'muon' },
			duration: 18,
			controls: [beta],
			body: `
<p>Nature runs this experiment every second. Cosmic rays hitting the top of the atmosphere make <dfn data-def="An unstable elementary particle, a heavier cousin of the electron. At rest it lives on average 2.2 microseconds before decaying into an electron and two neutrinos.">muons</dfn>, which rush down at close to the speed of light.</p>
<p>A muon at rest lives on average only <strong>2.2 microseconds</strong>. Even at almost c, that gives it time to cover only about 650 m, far too little to reach the ground from high in the atmosphere. Yet plenty of them arrive at sea level.</p>
<p>Time dilation explains it. The muon's own clock still gives it 2.2 µs, but on our clocks its life lasts γ times longer. At 0.99 c that is 15.6 µs, and the muon travels about 4.6 km on average. Move the slider and compare the two tracks.</p>`,
			notes: `<p>The mean lifetime of the muon at rest is 2.1969811 µs (Particle Data Group, <i>Review of Particle Physics</i>). Muons decay at random, so these are average distances: some go much further. The effect has been measured directly with muons in particle accelerators. In 1977 the muon storage ring at CERN found muons circling at γ ≈ 29 living 29 times longer than muons at rest, as predicted (J. Bailey et al., <i>Nature</i> 268, 1977).</p>`
		},
		// ------------------------------------------------------------------ length
		{
			id: 'length',
			chapter: 'length',
			title: 'The moving train is shorter',
			scene: 'length',
			hints: { phase: 'length' },
			duration: 20,
			controls: [beta],
			body: `
<p>The train and the platform are each 200 m long when measured at rest. How long is the moving train, measured from the platform?</p>
<p>To measure something moving you must mark where its front and its back are <strong>at the same moment</strong>. Otherwise it moves between your two marks. In the top row the platform makes both marks at once and finds the gap between them <strong>shorter than 200 m</strong>: 160 m at 0.6 c, shorter by the same factor γ. This is <dfn data-def="A moving object measures shorter along its direction of motion, by the factor γ, than it does at rest. Sizes across the motion are unchanged.">length contraction</dfn>. Only the length along the motion shrinks. Heights stay the same, and so does the gap between the light clock's mirrors.</p>
<p>The bottom row is the same story the other way round. On the train, the platform is the moving thing, and it measures 160 m.</p>
<p>Length contraction is what a muon would find too: in its own frame it stays put for 2.2 µs while the atmosphere rushes past, contracted by γ.</p>`,
			notes: `<p>Length contraction is about measurement, not appearance. A photograph of a fast object is affected also by the different times the light from its different parts takes to reach the camera, which can make it look rotated rather than squashed (Terrell and Penrose, 1959). Nothing squeezes the train: it is not under stress, and to the passengers it is 200 m long as always.</p>`
		},
		// ------------------------------------------------------------------ now
		{
			id: 'lightning',
			chapter: 'now',
			title: 'Two strikes at once — for the platform',
			scene: 'lightning',
			hints: { focus: 'platform' },
			duration: 20,
			controls: [beta],
			body: `
<p>Einstein's own example. Lightning strikes both ends of the train, leaving scorch marks on the train and on the platform. On the platform, an observer stands exactly halfway between the two marks. The flashes reach her together.</p>
<p>The light from each mark covered the same distance at the same speed, c, so she concludes that the two strikes <strong>happened at the same moment</strong>. She is not just reporting what she saw: she has allowed for the travel time.</p>
<p>A passenger sits in the middle of the train. On the platform's account she is moving towards the front flash and away from the back one. The front flash reaches her first, while the back flash is still chasing her. Watch the top row.</p>`
		},
		{
			id: 'train-view',
			chapter: 'now',
			title: '— and one after the other for the train',
			scene: 'lightning',
			hints: { focus: 'train' },
			duration: 20,
			controls: [beta],
			body: `
<p>Now take the passenger's side, in the bottom row. She is sitting still in the middle of her train, with scorch marks at its two ends. Light from each end travelled half the train, 100 m, at c (in her frame too). Yet the front flash reached her first.</p>
<p>So, allowing for the travel time just as carefully, she concludes that <strong>the front was struck first</strong>. For a 200 m train at 0.6 c, it was struck 400 nanoseconds earlier than the back.</p>
<p>Both are right. Whether two separate events happen “at the same time” depends on the frame: this is the <dfn data-def="Two events at different places that are simultaneous in one inertial frame are not simultaneous in another frame moving along the line joining them.">relativity of simultaneity</dfn>. What every frame agrees on is what happens at a single place and time: the two flashes meet at the platform observer, and they reach the passenger front first.</p>`,
			notes: `<p>For events a distance <i>L</i> apart (measured in the train), simultaneous on the platform, the train frame puts them <i>vL</i>/<i>c</i>² apart in time, with the front one first. That is β·L/c = 0.6 × 200 m ÷ c ≈ 400 ns here. This is the key to the other two effects. To time the moving clock, the platform compares it with two of its own clocks at two places, which the train thinks are out of sync. To measure the moving train, the platform marks both ends “at the same time”, which the train thinks were done at different times.</p>`
		},
		// ------------------------------------------------------------------ spacetime
		{
			id: 'spacetime',
			chapter: 'spacetime',
			title: 'A map of space and time',
			scene: 'spacetime',
			hints: { phase: 'axes' },
			duration: 18,
			controls: [beta],
			body: `
<p>A <dfn data-def="A graph with position along the track across and time upwards. Every event is a point; the history of an object is a line, its worldline.">spacetime diagram</dfn> puts all of this on one map: position along the track across, time upwards. Time is measured as <strong>c·t</strong>, the distance light travels in that time, so that light rays run at 45°. One metre of c·t is about 3.3 ns.</p>
<p>A point on the map is an <dfn data-def="Something that happens at one place at one moment, such as a lightning strike or a tick of a clock.">event</dfn>. The platform observer stays at x = 0, so her <dfn data-def="The line an object traces on a spacetime diagram: its position at every moment.">worldline</dfn> goes straight up. The train's ends and its passenger move, so their worldlines lean over: the faster the train, the more they lean, but never past the 45° light lines.</p>
<p>The train has its own axes. Its time axis, c·t′, is the passenger's worldline. Its space axis, x′, joins events that are simultaneous for the train, and it tilts up by the same angle. Move the slider: the train's axes close in on the light line like scissors, and the light line stays put.</p>`,
			notes: `<p>The two coordinate systems are related by the <dfn data-def="The formulas that convert an event's coordinates from one inertial frame to another: c·t′ = γ(c·t − βx), x′ = γ(x − β·c·t).">Lorentz transformation</dfn>: c·t′ = γ(c·t − βx) and x′ = γ(x − β·c·t), with β = v/c. The x′ axis is where t′ = 0, the line c·t = βx. The c·t′ axis is where x′ = 0, the line x = β·c·t. The train's units are stretched along its slanted axes. Its tick marks sit where the curves (c·t)² − x² = ±(100 m)², ±(200 m)², … cross them.</p>`
		},
		{
			id: 'tilted-now',
			chapter: 'spacetime',
			title: 'Every frame slices its own “now”',
			scene: 'spacetime',
			hints: { phase: 'now' },
			duration: 18,
			controls: [beta],
			body: `
<p>Put the lightning on the map. The two strikes are the dots at c·t = 0, on the platform's x axis: simultaneous for the platform. Their flashes run along 45° lines and meet on the platform observer's worldline.</p>
<p>The train's “now” is not horizontal. Its lines of simultaneity run parallel to its x′ axis. Draw one through each strike: the line through the front strike lies <strong>below</strong> the one through the back strike, so in train time the front strike came first.</p>
<p>Speed the train up: the train's slices tilt more and the gap grows. At 0 c the slices are horizontal and the strikes are simultaneous for both.</p>`
		},
		{
			id: 'interval',
			chapter: 'spacetime',
			title: 'What every observer agrees on',
			scene: 'spacetime',
			hints: { phase: 'interval' },
			duration: 22,
			controls: [beta, eventTime, eventPlace],
			body: `
<p>If observers disagree about times and lengths, is anything absolute? Yes. For two events, take the time between them (as c·t) and the distance between them, and form</p>
<p class="formula"><strong>s² = (c·Δt)² − (Δx)²</strong></p>
<p>This <dfn data-def="s² = (cΔt)² − Δx², the same for two given events in every inertial frame.">spacetime interval</dfn> comes out the same in every frame. Here the two events are the origin (the moment the passenger passes the platform observer, when both their clocks read zero) and the event you can drag. Drag it (or use the sliders) and change the train's speed. Its coordinates in the train frame change, but s² does not. All the frames' answers lie on the same curve, a <dfn data-def="The curve (c·t)² − x² = constant. In spacetime it plays the part a circle plays in ordinary geometry: every frame's view of the same interval lands on it.">hyperbola</dfn>.</p>
<p>If s² is positive (<em>timelike</em>), a signal slower than light could link the two events, and every frame agrees which came first. If it is negative (<em>spacelike</em>), nothing can travel from one to the other, and the order can differ between frames, as with the two strikes. Zero means a light ray joins them.</p>`,
			notes: `<p>Compare ordinary geometry: turn a map and the north–south and east–west distances between two towns change, but the straight-line distance √(Δx² + Δy²) does not. A change of frame is a kind of rotation in spacetime, with a minus sign in the “distance”. For timelike events, s is the time a clock travelling from one event to the other at constant speed would show (as c·t): its <dfn data-def="The time shown by a clock carried along a worldline.">proper time</dfn>.</p>`
		},
		{
			id: 'takeaway',
			chapter: 'spacetime',
			title: 'One cause, three effects',
			scene: 'spacetime',
			hints: { phase: 'all' },
			duration: 24,
			controls: [beta],
			body: `
<p>All three effects appear on one map:</p>
<ul>
<li><strong>Time:</strong> the dots on the passenger's worldline are her clock's ticks, every 100 m of c·t′. Read them on the platform's time axis and they are spaced γ times wider.</li>
<li><strong>Length:</strong> the platform measures the train along its own “now”, the x axis, and gets 200 m ÷ γ. The train measures along its x′ axis and gets the full 200 m.</li>
<li><strong>Simultaneity:</strong> the two strikes lie on the platform's “now” but not on the train's.</li>
</ul>
<p>All three come from one fact: <strong>every observer measures the same speed of light</strong>. To keep c the same for everyone, observers in relative motion have to disagree about durations, lengths and which distant events happen at the same time. What they share is spacetime itself, and the interval measured across it.</p>`,
			notes: `<p>These effects are everyday engineering in particle physics: accelerators keep unstable particles alive γ times longer, and their beams are designed with relativistic formulas. Special relativity assumes no gravity and no acceleration. Gravity needs Einstein's general relativity (1915), in which spacetime itself curves.</p>`
		}
	]
};
