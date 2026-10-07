import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const friction: Control = {
	type: 'toggle',
	id: 'friction',
	label: 'Friction',
	default: false,
	help: 'Rolling friction on the cart: a small force that always opposes its motion.'
};

const force: Control = {
	type: 'range',
	id: 'force',
	label: 'Push force',
	min: 0,
	max: 20,
	step: 1,
	default: 6,
	unit: ' N',
	help: 'Applied for one second, then the hand lets go.'
};

const mass: Control = {
	type: 'range',
	id: 'mass',
	label: 'Mass of the cart',
	min: 0.5,
	max: 5,
	step: 0.5,
	default: 2,
	unit: ' kg'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Launch speed',
	min: 5,
	max: 30,
	step: 1,
	default: 18,
	unit: ' m/s'
};

const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Launch angle',
	min: 5,
	max: 85,
	step: 1,
	default: 45,
	unit: '°'
};

const air: Control = {
	type: 'range',
	id: 'air',
	label: 'Air resistance',
	min: 0,
	max: 0.05,
	step: 0.005,
	default: 0.02,
	format: (v) => (v === 0 ? 'none (vacuum)' : `${v.toFixed(3)} per metre`),
	help: 'How strongly the air pushes back; it grows with the square of the speed.'
};

const m1: Control = {
	type: 'range',
	id: 'm1',
	label: 'Left cart mass',
	min: 0.5,
	max: 5,
	step: 0.5,
	default: 1,
	unit: ' kg'
};
const m2: Control = {
	type: 'range',
	id: 'm2',
	label: 'Right cart mass',
	min: 0.5,
	max: 5,
	step: 0.5,
	default: 1,
	unit: ' kg'
};
const u1: Control = {
	type: 'range',
	id: 'u1',
	label: 'Left cart speed',
	min: 0,
	max: 4,
	step: 0.5,
	default: 2,
	unit: ' m/s'
};
const u2: Control = {
	type: 'range',
	id: 'u2',
	label: 'Right cart speed',
	min: -4,
	max: 4,
	step: 0.5,
	default: 0,
	unit: ' m/s',
	help: 'Negative means moving left, towards the other cart.'
};
const bounce: Control = {
	type: 'range',
	id: 'bounce',
	label: 'Bounciness',
	min: 0,
	max: 1,
	step: 0.1,
	default: 1,
	format: (v) => (v === 1 ? '1 (perfectly elastic)' : v === 0 ? '0 (they stick)' : v.toFixed(1)),
	help: 'How much of their approach speed the carts get back as they separate.'
};

const trackFriction: Control = {
	type: 'range',
	id: 'mu',
	label: 'Friction on the track',
	min: 0,
	max: 0.15,
	step: 0.01,
	default: 0.04,
	format: (v) => (v === 0 ? 'none' : v.toFixed(2))
};

export const spec: ExplainerSpec = {
	slug: 'newtons-laws',
	title: "Newton's laws: forces, motion and energy",
	summary:
		'Push carts, launch projectiles and send a car along a track you shape yourself, and see why forces change motion instead of keeping it going — and why momentum and energy never get lost.',
	chapters: [
		{ id: 'laws', title: 'Forces change motion' },
		{ id: 'flight', title: 'Things that fly' },
		{ id: 'momentum', title: 'Collisions and momentum' },
		{ id: 'energy', title: 'Energy changes form' }
	],
	steps: [
		// ------------------------------------------------------------------ laws
		{
			id: 'inertia',
			chapter: 'laws',
			title: 'Things keep moving',
			scene: 'carts',
			hints: { phase: 'inertia' },
			duration: 18,
			controls: [friction],
			body: `
<p>Push a cart along a smooth track and let go. What keeps it moving?</p>
<p>For two thousand years the answer seemed obvious: nothing — moving things naturally slow down and stop, so something must keep pushing them. Galileo and then Isaac Newton saw it the other way round. <strong>An object keeps moving at the same speed in a straight line unless a force acts on it.</strong> This is Newton's <dfn data-def="Newton's first law, or the law of inertia: without a net force, an object at rest stays at rest and a moving object keeps moving at constant velocity.">first law</dfn>.</p>
<p>Real carts do slow down — because of <strong>friction</strong>, a force. Switch it off and the cart rolls on for ever; switch it on and the same push dies away. The force is what changes the motion, not what keeps it going.</p>`,
			notes: `<p>The tendency to keep moving is called <dfn data-def="The resistance of an object to changes in its motion; it is measured by its mass.">inertia</dfn>. Spacecraft show it best: once a probe has been launched it coasts for years between planets without any engine running.</p>`
		},
		{
			id: 'force',
			chapter: 'laws',
			title: 'Force = mass × acceleration',
			scene: 'carts',
			hints: { phase: 'push' },
			duration: 18,
			controls: [force, mass, friction],
			body: `
<p>So what does a force do? It changes the velocity: it <dfn data-def="The rate at which velocity changes, in metres per second per second (m/s²).">accelerates</dfn> the object. How much depends on the object's mass:</p>
<p class="formula"><strong>F = m × a</strong></p>
<p>Newton's <strong>second law</strong>. A force of 6 newtons on a 2 kg cart gives it an acceleration of 3 m/s²: every second the push lasts, the cart goes 3 m/s faster. Double the mass and the same push gives half the acceleration.</p>
<p>The graph shows the speed. It climbs while the hand pushes and stays level once it lets go — with no friction there is no force, so no change in speed. Switch friction on and it slopes back down to zero: friction is now the only force.</p>`,
			notes: `<p>The newton (N) is defined by this law: 1 N is the force that gives 1 kg an acceleration of 1 m/s². Lifting a small apple takes about 1 N. Strictly, F is the <em>net</em> force — all the forces added together, with directions. With friction on, the cart only accelerates by (push − friction) ÷ mass.</p>`
		},
		{
			id: 'pair',
			chapter: 'laws',
			title: 'Every push pushes back',
			scene: 'carts',
			hints: { phase: 'pair' },
			duration: 16,
			controls: [m1, m2],
			body: `
<p>Two carts are held together with a squashed spring between them. Release it, and both move off — in opposite directions.</p>
<p>The spring pushes the left cart left exactly as hard as it pushes the right cart right. Forces always come in such pairs: when one object pushes on another, the other pushes back equally hard in the opposite direction. That is Newton's <strong>third law</strong>.</p>
<p>Equal forces for the same time, but not equal speeds: the heavier cart picks up less speed (F = m × a again). Make one cart three times heavier and it moves off at a third of the speed. Mass × speed comes out the same for both carts, in opposite directions — a quantity we will meet again as momentum.</p>`,
			notes: `<p>This is how rockets work: the engine pushes exhaust gas backwards and the gas pushes the rocket forwards, with nothing to push against. It is also why a gun recoils.</p>`
		},
		// ------------------------------------------------------------------ flight
		{
			id: 'projectile',
			chapter: 'flight',
			title: 'Launching a ball',
			scene: 'projectile',
			hints: { phase: 'basic' },
			duration: 16,
			controls: [speed, angle],
			body: `
<p>Throw a ball and only one force acts on it once it leaves your hand (ignoring the air): its weight, pulling straight down.</p>
<p>So split its velocity into two parts. <strong>Sideways</strong>, no force acts: the ball keeps the same horizontal speed all the way, as the first law says. <strong>Upwards</strong>, gravity takes away 9.8 m/s of speed every second, until the ball stops rising and falls back, gaining speed at the same rate.</p>
<p>Together they make the curve every thrown thing follows: a <dfn data-def="The curve traced by a projectile without air resistance; its height is a quadratic function of the horizontal distance.">parabola</dfn>. The arrows show the two parts of the velocity: one constant, one changing.</p>`
		},
		{
			id: 'range',
			chapter: 'flight',
			title: 'The best angle',
			scene: 'projectile',
			hints: { phase: 'range' },
			duration: 18,
			controls: [speed, angle],
			body: `
<p>At the same launch speed, which angle throws furthest? Launching steeply keeps the ball up longer but moves it sideways slowly; launching low moves it fast but brings it down quickly.</p>
<p>Without air the best compromise is exactly <strong>45°</strong>. The faint paths show other angles: angles the same distance either side of 45° — say 30° and 60° — land at the same spot, one in a low fast arc, the other in a high slow one.</p>
<p>Speed matters even more than angle: the range grows with the <em>square</em> of the launch speed, so throwing twice as fast goes four times as far.</p>`,
			notes: `<p>Without air resistance the range is <i>v</i>² sin(2θ) / <i>g</i>, largest when 2θ = 90°. The flight time is 2<i>v</i> sin θ / <i>g</i> and the peak height <i>v</i>² sin²θ / (2<i>g</i>).</p>`
		},
		{
			id: 'drag',
			chapter: 'flight',
			title: 'Air resistance',
			scene: 'projectile',
			hints: { phase: 'drag' },
			duration: 18,
			controls: [speed, angle, air],
			body: `
<p>Now add the air. It pushes against the ball's motion, harder the faster the ball goes — roughly with the square of its speed.</p>
<p>The flight is shorter and no longer symmetric: the ball rises along a longer, flatter path and comes down more steeply, as anyone who has hit a ball high has seen. The dashed path is the same throw in a vacuum.</p>
<p>And the best angle drops below 45° — only a little for a slow, light throw, down to the mid-30s for a fast one in thick air: when the air steals speed, it pays to launch lower and spend less time in the air.</p>`,
			notes: `<p>This page models the air as quadratic drag, a force of size <i>k</i>·<i>m</i>·<i>v</i>² opposite to the velocity, which is a good description for balls at everyday speeds. The motion has no simple formula any more, so it is computed step by step from F = m × a — the way engineers and game physics engines do it.</p>`
		},
		// ------------------------------------------------------------------ momentum
		{
			id: 'momentum',
			chapter: 'momentum',
			title: 'Momentum is passed on, never lost',
			scene: 'carts',
			hints: { phase: 'collide' },
			duration: 16,
			controls: [m1, u1, m2, u2, bounce],
			body: `
<p>Send one cart into another. During the crash they push on each other with equal and opposite forces for the same short time (third law), so whatever motion one loses, the other gains.</p>
<p>The quantity that is passed across is <dfn data-def="Mass times velocity, p = m × v. It has a direction: motion to the left counts as negative.">momentum</dfn>, mass × velocity. Add up the momentum of both carts before the collision and after it: the totals are always equal, whatever the masses, speeds or bounciness. Momentum is <strong>conserved</strong>.</p>
<p>Try equal masses with full bounciness: the moving cart stops dead and the other leaves with its speed. Try a light cart into a heavy one: it bounces back.</p>`
		},
		{
			id: 'bounce',
			chapter: 'momentum',
			title: 'Bouncy and sticky crashes',
			scene: 'carts',
			hints: { phase: 'energy' },
			duration: 16,
			controls: [m1, u1, m2, u2, bounce],
			body: `
<p>Momentum is always conserved, but the energy of motion — <dfn data-def="The energy an object has because it moves: ½ × mass × speed².">kinetic energy</dfn>, ½ × mass × speed² — is not, unless the collision is perfectly bouncy (<dfn data-def="A collision in which no kinetic energy is lost.">elastic</dfn>).</p>
<p>Turn the bounciness down. The momentum bars still balance, but the kinetic-energy bars after the crash come up short. In a sticky crash, where the carts lock together, the loss is largest.</p>
<p>That energy has not vanished: it went into denting, heating and the sound of the crash. Energy, too, is conserved — it just changed form.</p>`
		},
		// ------------------------------------------------------------------ energy
		{
			id: 'track',
			chapter: 'energy',
			title: 'Height and speed trade places',
			scene: 'track',
			hints: { phase: 'free' },
			duration: 22,
			body: `
<p>Release a car from the top of a track. As it runs down it speeds up; as it climbs it slows. Its energy keeps changing form between two kinds:</p>
<ul>
<li><dfn data-def="Energy stored by height in a gravitational field: mass × g × height.">potential energy</dfn>, from its height: <i>m</i> × <i>g</i> × <i>h</i>;</li>
<li>kinetic energy, from its speed: ½ × <i>m</i> × <i>v</i>².</li>
</ul>
<p>The bars show both, and their total never changes. So without friction the car can always climb back to the height it started from — never higher — whatever the shape of the hills in between.</p>
<p>Drag the round handles to reshape the track and try it.</p>`
		},
		{
			id: 'heat',
			chapter: 'energy',
			title: 'Where the energy goes',
			scene: 'track',
			hints: { phase: 'friction' },
			duration: 24,
			controls: [trackFriction],
			body: `
<p>Real tracks have friction, and now the car never quite gets back up: each hill it climbs is a little lower than the last, until it settles in a valley.</p>
<p>The energy it loses appears in a third bar: <strong>heat</strong>, warming the wheels, the rails and the air. Add the three bars together and the total is still exactly what the car started with.</p>
<p>This is the <dfn data-def="Energy cannot be created or destroyed, only converted from one form into another.">conservation of energy</dfn>, one of the deepest rules in physics: energy changes form, but the total stays the same. Together with the conservation of momentum, it is why Newton's laws can predict a motion before it happens.</p>`
		}
	]
};
