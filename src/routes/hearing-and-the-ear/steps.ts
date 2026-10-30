import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { LOUDNESS, pitchHz, shakes } from './model';

/** The note's pitch, as octaves above 31.25 Hz (so that each slider step is a musical step). */
const pitch: Control = {
	type: 'range',
	id: 'pitch',
	label: 'Pitch of the note',
	min: 0,
	max: 9,
	step: 1 / 12,
	default: 5,
	format: (v) => shakes(pitchHz(v))
};

const second: Control = {
	type: 'range',
	id: 'second',
	label: 'Pitch of the second note',
	min: 0,
	max: 9,
	step: 1 / 12,
	default: 8,
	format: (v) => shakes(pitchHz(v))
};

const middle: Control = {
	type: 'select',
	id: 'middle',
	label: 'What pushes on the window',
	default: 'ear',
	options: [
		{ value: 'ear', label: 'The big eardrum and the bones' },
		{ value: 'small', label: 'An eardrum as small as the window' },
		{ value: 'none', label: 'Nothing: the air touches the window' }
	]
};

const loud: Control = {
	type: 'range',
	id: 'loud',
	label: 'Loudness of the note',
	min: LOUDNESS[0].level,
	max: LOUDNESS[LOUDNESS.length - 1].level,
	step: 10,
	default: 40,
	format: (v) => `as loud as ${LOUDNESS.find((l) => l.level === v)?.name ?? ''}`
};

const eardrum =
	'<dfn data-def="A thin skin stretched across the end of the ear canal, about a centimetre across. Sound makes it shake.">eardrum</dfn>';
const cochlea =
	'<dfn data-def="The snail-shaped, fluid-filled part of the inner ear, about the size of a pea. Inside it, shaking is turned into signals for the brain.">cochlea</dfn>';
const window_ =
	'<dfn data-def="A tiny opening into the cochlea, covered by a thin skin, where the last of the three bones pushes in and out. Its proper name is the oval window.">window</dfn>';
const ribbon =
	'<dfn data-def="A long, springy strip that runs along the inside of the cochlea, stiff and narrow at the entrance and floppier and wider at the far end. Its proper name is the basilar membrane.">ribbon</dfn>';
const hairCells =
	'<dfn data-def="Sensor cells that sit in a row along the ribbon, each topped with a tuft of tiny hairs. When the ribbon under them shakes, the hairs bend and the cell sends a signal along a nerve to the brain.">hair cells</dfn>';

/**
 * Scenes: `ear` (the ear cut open, from the ear flap to the cochlea; focus 'ear' (a note goes in)
 * or 'window' (zoomed on the middle ear: what pushes on the oval window)) and `ribbon` (the
 * cochlea unrolled: its ribbon's travelling wave from the cochlea-hearing model; focus 'unroll',
 * 'pitch', 'sensors', 'two', 'loud' or 'next').
 */
export const spec: ExplainerSpec = {
	slug: 'hearing-and-the-ear',
	title: 'How your ear hears',
	summary:
		'Send a note into an ear and follow the shake from the eardrum through three tiny bones into the snail-shaped cochlea. Slide the pitch and watch a ripple peak at a different spot along the cochlea for every note, play two notes and see two bumps, and turn the loudness up to make the bump grow.',
	chapters: [
		{ id: 'in', title: 'Into the ear' },
		{ id: 'snail', title: 'Inside the snail' },
		{ id: 'more', title: 'Two notes, loud and soft' }
	],
	steps: [
		// ------------------------------------------------------------------ in
		{
			id: 'ear',
			chapter: 'in',
			title: 'A note goes into your ear',
			scene: 'ear',
			hints: { focus: 'ear' },
			duration: 20,
			controls: [pitch],
			body: `
<p>The part of your ear you can see is only the start. Here the ear is cut open, as if you were looking at someone from behind. The ear flap catches a sound and funnels it down the ear canal, a tube about 2.5 centimetres long, to the ${eardrum}.</p>
<p>A sound is a shake passed along through the air. It makes the eardrum shake too: in and out, as many times a second as the sound’s own shake. <strong>Slide the pitch</strong> from low to high and watch the eardrum shake faster. (The drawing is slowed right down: a real eardrum can shake thousands of times a second.)</p>
<p>Behind the eardrum, three tiny bones pass the shake on to the ${cochlea}, a coiled tube of fluid shaped like a snail shell. That is where the hearing really happens.</p>`
		},
		{
			id: 'window',
			chapter: 'in',
			title: 'A big drum on a small window',
			scene: 'ear',
			hints: { focus: 'window' },
			duration: 22,
			controls: [middle],
			body: `
<p>The cochlea is full of fluid, and fluid is much harder to shake than air. Sound in air that meets water head on mostly bounces off: about 999 parts in every 1,000 never get in. That is why voices from the poolside are hard to hear under water.</p>
<p>The middle ear gets round this by concentrating the push. The eardrum is big, and the last bone, the stirrup, presses on a ${window_} into the cochlea that is about <strong>17 times smaller</strong>. All the push gathered by the big drum lands on the small window, so each bit of the window is pushed about 22 times harder than the air pushes on each bit of the eardrum.</p>
<p><strong>Change what pushes on the window.</strong> The bones work like a little lever, but they only add about a third: shrink the eardrum to the size of the window and most of the boost is gone. Without the middle ear at all, a person talking would push on the window no harder than a whisper does.</p>`,
			notes: `<p>The numbers are the textbook ideal: an eardrum area of about 55 square millimetres that moves, a stirrup footplate of about 3.2, and a lever of about 1.3. A real eardrum does not move as one stiff piece, so at many pitches the real boost is smaller than this ideal. The middle ear also helps by pushing on one window of the cochlea and not the other, so the fluid can move: a second window, the round window, bulges out as the stirrup pushes in.</p>`
		},
		// ------------------------------------------------------------------ snail
		{
			id: 'unroll',
			chapter: 'snail',
			title: 'Unroll the snail',
			scene: 'ribbon',
			hints: { focus: 'unroll' },
			duration: 22,
			body: `
<p>The cochlea is about the size of a pea, coiled two and a half times. Unrolled, it would be a tube about <strong>3.5 centimetres</strong> long, here drawn hugely enlarged. Along its middle runs a springy ${ribbon}, with fluid above and below it.</p>
<p>Each push of the stirrup on the window sends a ripple running along the ribbon, away from the entrance. Watch it: the ripple grows taller as it goes, peaks at one spot, and then dies away quickly. Beyond that spot the ribbon hardly moves.</p>
<p>The ribbon changes along its length: narrow and stiff at the entrance, wider and floppy at the far end. Every spot along it shakes most easily at its own pitch.</p>`,
			notes: `<p>The ripple is computed, not drawn by hand: the page uses the same model as the <a href="../cochlea-hearing/">cochlea page</a>, a ribbon of thousands of little springy sections in fluid, each tuned to the pitch measured at that spot in human ears. The bumps’ heights are drawn on a squeezed scale, so that soft and loud notes both fit on the screen.</p>`
		},
		{
			id: 'pitch',
			chapter: 'snail',
			title: 'Every pitch has its own spot',
			scene: 'ribbon',
			hints: { focus: 'pitch' },
			duration: 24,
			controls: [pitch],
			body: `
<p><strong>Slide the pitch</strong> and watch where the ripple peaks. A high note peaks <strong>near the entrance</strong>, a low note runs almost to the <strong>far end</strong>. A note in the middle of the ear’s range, shaking 1,000 times a second, peaks about 2 centimetres in.</p>
<p>Each time the pitch doubles (going up an octave, from one C to the next on a piano), the peak moves about the same distance closer to the entrance, roughly half a centimetre in the middle of the range. So the whole range of notes a person can hear, from about 20 to 20,000 times a second, is laid out along the ribbon like the keys of a piano.</p>
<p>The ear has sorted the sound by pitch. Which spot is shaking tells you which note it is.</p>`
		},
		{
			id: 'sensors',
			chapter: 'snail',
			title: 'Thousands of tiny sensors',
			scene: 'ribbon',
			hints: { focus: 'sensors' },
			duration: 24,
			controls: [pitch],
			body: `
<p>How does the brain find out where the ribbon shakes? A row of about 3,500 sensor cells sits along it, called ${hairCells}. Each one has its own nerve fibres to the brain, and the shaking of the ribbon right under it changes the signals it sends along them. Here each dot stands for 50 of them, and it lights where the ribbon shakes hard enough for a sound to be heard.</p>
<p><strong>Slide the pitch</strong> and watch which sensors light up: the brightest sit right under the bump. The brain doesn’t get one wobbly signal, like a microphone’s: it gets thousands of separate ones, each from its own spot, and so each about its own pitch. That is how it can tell notes apart.</p>`,
			notes: `<p>There are also about 12,000 <em>outer</em> hair cells in three more rows. They don’t mainly send signals: they push on the ribbon in step with its shake, making soft sounds’ bumps taller and sharper. Very loud noise can damage them, and then soft sounds are missed. The <a href="../cochlea-hearing/">cochlea page</a> switches them on and off.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'two',
			chapter: 'more',
			title: 'Two notes, two bumps',
			scene: 'ribbon',
			hints: { focus: 'two' },
			duration: 24,
			controls: [second],
			body: `
<p>Now two notes play at once: the note from before, and a second one. <strong>Slide the second note.</strong> Each makes its own bump at its own spot, so two groups of sensors signal and the brain hears two notes.</p>
<p>Slide the second note right next to the first and the two bumps blur into one. Close notes shake overlapping groups of sensors: they can sound rough together, or seem to throb slowly when their pitches are almost the same. At exactly the same pitch, shaking in step, they are simply one note pushing twice as hard.</p>
<p>Music and voices are mixtures of many pitches at once. The cochlea spreads every mixture out along the ribbon, so the brain can pick the parts out.</p>`,
			notes: `<p>For this drawing, each note’s ripple is worked out on its own and their strengths are then added together. In a real ear, two notes also weaken each other’s ripples a little and make faint extra shakes at other pitches; the <a href="../cochlea-hearing/">cochlea page</a> leaves these out too.</p>`
		},
		{
			id: 'loud',
			chapter: 'more',
			title: 'Louder is a bigger bump',
			scene: 'ribbon',
			hints: { focus: 'loud' },
			duration: 24,
			controls: [loud],
			body: `
<p>Loud and high are not the same thing. <strong>Turn the loudness up</strong>, from rustling leaves to a lawnmower: the bump <strong>grows</strong> and spreads, and more sensors light up. But it stays at about the same spot, creeping only a little towards the entrance. Changing the pitch moves the bump; changing the loudness mostly makes it bigger.</p>
<p>The ear squeezes loud sounds. From rustling leaves to a lawnmower, the push of the sound grows about 3,000 times, yet the ribbon’s shake grows far less: in a real ear only a few dozen times for high notes and a few hundred for low ones. That squeeze helps one ear hear both a whisper and a shout.</p>`,
			notes: `<p>The drawing squeezes loud sounds less than a real ear does: its bump grows a few hundred times at every pitch. A loud sound’s bump spreads mostly towards the entrance, so loud low notes also shake the spots of higher notes. That is one reason a loud noise can hide a softer, higher sound. Years of loud noise usually damage the sensors for fairly high notes first, around 4,000 shakes a second, while growing older usually takes away the very highest notes first.</p>`
		},
		{
			id: 'next',
			chapter: 'more',
			title: 'Read next',
			scene: 'ribbon',
			hints: { focus: 'next' },
			duration: 14,
			body: `
<p>Your ear sorts sounds by pitch before the brain hears them: the eardrum and the bones push the shake into the cochlea, and each note makes a different place along its ribbon shake. High notes shake near the entrance, low notes at the far end, and louder notes make bigger bumps.</p>
<p>What a sound is, and why a faster shake is a higher note, is on the <a href="../vibrations-and-sound/">vibrations and sound</a> page; for waves in general, see <a href="../waves-interference/">waves and interference</a>. Why each spot of the ribbon shakes most at one pitch is resonance, the same thing that makes a swing go highest when you push it at the right moment: see <a href="../oscillations-resonance/">oscillations and resonance</a>. For the full mechanics of the cochlea, its amplifier and how a cochlear implant works, read <a href="../cochlea-hearing/">hearing and the cochlea</a>.</p>`
		}
	]
};
