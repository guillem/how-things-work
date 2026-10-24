import type { ExplainerSpec } from '#lib/explainer/index.ts';
export const spec: ExplainerSpec = {
	slug: 'vibrations-and-sound',
	title: 'Vibrations & sound',
	summary:
		'Twang a ruler and follow the pushes through the air. Shorten it for a higher note, pull harder for a louder one, then take the air away from a ringing bell.',
	chapters: [
		{ id: 'wobble', title: 'A wobble travels' },
		{ id: 'sound', title: 'Changing the sound' }
	],
	steps: [
		{
			id: 'twang',
			chapter: 'wobble',
			title: 'A ruler over a table',
			scene: 'sound',
			duration: 22,
			body: `<p>Hold a ruler firmly against a table, with one end sticking out. Pull that end aside and let go: it wobbles back and forth. Something that moves back and forth like this is <strong>vibrating</strong>.</p><p>Press <strong>Twang and hear</strong> in the picture. The ruler’s bending pushes on the air and makes a low note. The motion is shown much more slowly than it really happens, so you can follow it. It repeats for you to watch; the button plays one short note through your speakers.</p>`,
			notes: `<p>This is an ideal steel ruler held perfectly still at the table’s edge. We compute its simplest bending motion. A real ruler also makes higher notes and taps against the table; the speaker plays just the lowest note, not a recording of those extra sounds. The bending and the air’s movement are enlarged as well as slowed. The bending model follows <a href="https://lampz.tugraz.at/~hadley/memm/mechanics/cbeam.php">TU Graz’s cantilever derivation</a>; the travelling sound follows <a href="https://openstax.org/books/university-physics-volume-1/pages/17-1-sound-waves">OpenStax’s sound waves</a>.</p>`
		},
		{
			id: 'air',
			chapter: 'wobble',
			title: 'Passing the push along',
			scene: 'sound',
			duration: 24,
			body: `<p>Look closer at the air between the ruler and the ear. When the ruler moves, it pushes nearby air. That air pushes the next bit, which pushes the next. A squeeze travels along the row, followed by a stretch.</p><p>Watch the orange bit of air and its faint resting mark. It only jiggles near its own place. It does <em>not</em> fly all the way to the ear. The travelling push is the sound.</p>`,
			notes: `<p>The dots stand for small parcels of air, not individual molecules. Molecules have fast random motion too. The ruler moves across the table edge; this row below it is a separate, enlarged view of a sound wave travelling away from the ruler. The drawing greatly enlarges the air’s tiny back-and-forth motion.</p>`
		},
		{
			id: 'pitch',
			chapter: 'sound',
			title: 'A shorter ruler, a higher note',
			scene: 'sound',
			controls: [
				{
					type: 'range',
					id: 'length',
					label: 'Ruler sticking out',
					min: 5,
					max: 15,
					step: 1,
					default: 10,
					unit: 'cm'
				}
			],
			duration: 24,
			body: `<p>Slide the ruler farther onto the table, leaving a shorter piece sticking out. A shorter piece is harder to bend and springs back faster. Its wobbles come closer together, and you hear a <strong>higher</strong> note.</p><p>Try the slider, then press <strong>Twang and hear</strong> to compare. Here, making the sticking-out piece half as long makes it wobble four times as fast. <dfn data-def="How high or low a note sounds; faster repeated vibrations usually sound higher.">Pitch</dfn> is how high or low a note sounds.</p>`
		},
		{
			id: 'louder',
			chapter: 'sound',
			title: 'A bigger wobble, a louder note',
			scene: 'sound',
			controls: [
				{
					type: 'range',
					id: 'strength',
					label: 'How hard you twang',
					min: 1,
					max: 4,
					step: 1,
					default: 2,
					format: (v) => ['', 'Gentle', 'Medium', 'Strong', 'Strongest'][v]
				}
			],
			duration: 24,
			body: `<p>Back with ten centimetres of ruler sticking out, pull its end farther before letting go. The wobble is bigger, and the pushes on the air are stronger. The note gets <strong>louder</strong>.</p><p>But count the wobbles: they are not faster. A stronger twang changes the loudness without changing the pitch in this small-bend model. Try a gentle twang and a strong one, listening each time.</p>`
		},
		{
			id: 'distance',
			chapter: 'sound',
			title: 'Farther away, fainter sound',
			scene: 'sound',
			controls: [
				{
					type: 'range',
					id: 'distance',
					label: 'Ear from the ruler',
					min: 1,
					max: 8,
					step: 1,
					default: 2,
					unit: 'm'
				}
			],
			duration: 24,
			body: `<p>Use the ten-centimetre ruler and the same medium twang each time, then move the ear away. The sound spreads out in all directions. The same sound energy has to cover more space, so less reaches a little patch at the ear.</p><p>Twice as far away, that patch gets a quarter of the sound energy in the same time. The note is fainter, but it has the same pitch. The bar shows the energy arriving each moment, compared with one metre away; it is not a measure of how loud your ear thinks it is.</p>`,
			notes: `<p>This is open space, without walls or echoes. Sound energy spreads over growing spheres. Real rooms reflect sound, and air gradually absorbs it too. See <a href="https://openstax.org/books/university-physics-volume-1/pages/17-3-sound-intensity">OpenStax’s sound intensity</a>. The picture keeps the wave row the same width and changes its distance scale as you move the ear.</p>`
		},
		{
			id: 'jar',
			chapter: 'sound',
			title: 'A bell in a jar',
			scene: 'sound',
			controls: [
				{
					type: 'range',
					id: 'air',
					label: 'Air left in the jar',
					min: 0,
					max: 100,
					step: 10,
					default: 100,
					unit: '%'
				}
			],
			duration: 26,
			body: `<p>The bell inside this jar is still ringing. Pump the air out: fewer bits of air remain inside to pass its vibration on. The sound reaching the outside fades. With no air left inside, no sound crosses that empty space, even though the bell keeps moving.</p><p>Try <strong>Ring and hear</strong> before and after pumping. The picture models only the sound carried by air: a real bell might still send a faint vibration through the stand and glass.</p>`,
			notes: `<p>We hold the bell’s vibration fixed while reducing the air’s density. In this ideal model the airborne sound energy falls in proportion to the air left. A real pump, jar and bell have extra effects; the bar is an illustration of this model, not a calibrated vacuum gauge.</p>`
		},
		{
			id: 'materials',
			chapter: 'sound',
			title: 'Air is not the only messenger',
			scene: 'sound',
			duration: 20,
			body: `<p>Sound needs something to pass the push along, but it does not have to be air. You can hear underwater; a knock travels through a wooden table; a metal rail carries vibrations too.</p><p>Empty space is different. With nothing between the source and receiver to pass on the vibration, sound cannot cross. Light can cross empty space, which is why we can see the Sun but cannot hear it through space.</p>`
		},
		{
			id: 'next',
			chapter: 'sound',
			title: 'Two different ways to change a sound',
			scene: 'sound',
			duration: 20,
			body: `<p>A faster wobble makes a higher note. A bigger wobble makes a louder one. Moving away makes it fainter, and taking the material away stops the sound crossing the gap altogether.</p><p>Follow a sound inside your head in <a href="../hearing-and-the-ear/">hearing and the ear</a>. Or make waves meet and add together in <a href="../waves-interference/">waves and interference</a>.</p>`
		}
	]
};
