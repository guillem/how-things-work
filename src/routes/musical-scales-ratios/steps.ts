import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { KEY_NAMES, LADDERS } from './scales';

const keyName = (k: number) => KEY_NAMES[k];

const keyA: Control = {
	type: 'range',
	id: 'keyA',
	label: 'First key',
	min: 0,
	max: 12,
	step: 1,
	default: 0,
	format: keyName,
	help: 'Or press the keys on the stage: a new key replaces the one pressed before.'
};

const keyB: Control = {
	type: 'range',
	id: 'keyB',
	label: 'Second key',
	min: 0,
	max: 12,
	step: 1,
	default: 12,
	format: keyName
};

const tuning: Control = {
	type: 'select',
	id: 'tuning',
	label: 'Tuning',
	default: 'equal',
	options: [
		{ value: 'equal', label: 'Equal-tempered (a piano)' },
		{ value: 'pure', label: 'Pure (upper note on the simple ratio)' }
	]
};

const timbre: Control = {
	type: 'select',
	id: 'timbre',
	label: 'Sound',
	default: 'sine',
	options: [
		{ value: 'sine', label: 'Pure sine tone' },
		{ value: 'rich', label: 'Rich: six harmonics' }
	]
};

const curveTimbre: Control = {
	type: 'select',
	id: 'curveTimbre',
	label: 'Sound',
	default: 'rich',
	options: [
		{ value: 'rich', label: 'Rich: six harmonics' },
		{ value: 'sine', label: 'Pure sine tone' }
	]
};

const playPair: Control = {
	type: 'action',
	id: 'playPair',
	label: 'Listen',
	action: '▶ Play the two notes together',
	help: 'About two seconds, quietly. Pressing a key on the stage plays the pair too.'
};

const interval: Control = {
	type: 'range',
	id: 'interval',
	label: 'Upper note',
	min: 0,
	max: 1250,
	step: 1,
	default: 702,
	unit: ' cents above C4',
	help: 'You can also drag the marker along the curve.'
};

const hear: Control = {
	type: 'action',
	id: 'hear',
	label: 'Listen',
	action: '▶ Play this interval'
};

const stack: Control = {
	type: 'range',
	id: 'stack',
	label: 'Pure fifths stacked',
	min: 0,
	max: 12,
	step: 1,
	default: 12
};

const divisions: Control = {
	type: 'range',
	id: 'divisions',
	label: 'Equal steps per octave',
	min: 5,
	max: 53,
	step: 1,
	default: 12,
	values: () => LADDERS,
	format: (n) => `${n} steps of ${(1200 / n).toFixed(1)} cents`
};

const playEqual: Control = {
	type: 'action',
	id: 'playEqual',
	label: 'Equal-tempered',
	action: '▶ C–E–G on a piano'
};

const playPure: Control = {
	type: 'action',
	id: 'playPure',
	label: 'Pure',
	action: '▶ C–E–G in pure 4 : 5 : 6',
	help: 'Listen to the equal-tempered chord, then the pure one: the first shimmers, the second stands still.'
};

export const spec: ExplainerSpec = {
	slug: 'musical-scales-ratios',
	title: 'Why music has twelve notes',
	summary:
		'Play two notes and watch their waves line up or clash, map which pairs sound smooth, then cut the octave into equal steps and find out why twelve is the first ladder whose fifth lands within 2 cents of the pure 3 : 2.',
	chapters: [
		{ id: 'fit', title: 'Notes that fit' },
		{ id: 'map', title: 'Smooth and rough' },
		{ id: 'ladder', title: 'Cutting the octave' },
		{ id: 'ear', title: 'By ear' }
	],
	steps: [
		// ------------------------------------------------------------------ fit
		{
			id: 'keys',
			chapter: 'fit',
			title: 'Every note is a frequency',
			scene: 'pair',
			hints: { phase: 'notes' },
			duration: 18,
			controls: [keyA, keyB, playPair],
			body: `
<p>A note is a sound wave that repeats at a steady rate: its <dfn data-def="How many times a second the wave repeats, in hertz (Hz).">frequency</dfn>. The keyboard on the stage runs from middle C, 261.6 Hz, up to the next C, 523.3 Hz. Above it, each pressed key is drawn as its wave, slowed down enormously so that you can see it.</p>
<p>Press C4 and C5. The upper C repeats exactly twice as often as the lower one: two of its cycles fit in each of the lower C's. That jump, a doubling of the frequency, is an <dfn data-def="Two notes whose frequencies are in the ratio 2 : 1. They sound so alike that they get the same letter name.">octave</dfn>, and the two notes sound so alike that they share a name.</p>
<p>A piano cuts each octave into twelve equal steps called <dfn data-def="The step between neighbouring keys of a piano (white or black): a frequency ratio of the twelfth root of 2, about 1.0595.">semitones</dfn>: each key is 1.0595 times the frequency of the one below, and twelve of those steps make exactly 2. Why twelve, and not ten or twenty, is the question of this page.</p>`,
			notes: `<p>This page models ideal equal temperament at the standard concert pitch A4 = 440 Hz, with sine tones or six exact harmonics. Real pianos differ slightly: their strings' overtones are not exact multiples, and tuners stretch the octaves a little to match. A real note from an instrument is not a single clean wave but a mix of frequencies, as you saw on the guitar string: we come back to that in step 3. Musicians measure intervals in <em>cents</em>, a hundredth of a semitone: an octave is 1,200 cents. Differences of about 5 cents are near the limit of what trained ears notice between two notes played one after the other.</p>`
		},
		{
			id: 'line-up',
			chapter: 'fit',
			title: 'Simple ratios line up',
			scene: 'pair',
			hints: { phase: 'lineup' },
			duration: 22,
			controls: [keyA, keyB, tuning, playPair],
			body: `
<p>The bottom trace adds the two waves together, which is what your ear receives. For an octave, 2 : 1, the sum repeats after every cycle of the lower note. Now press C4 and G4, a <dfn data-def="Two notes whose frequencies are in the ratio 3 : 2 (seven semitones on a piano). After the octave, the smoothest interval.">fifth</dfn>: three cycles of G fit exactly in two of C, so the sum repeats every two cycles. A major third, C–E, is 5 : 4 and repeats every four.</p>
<p>The simpler the ratio, the sooner the pattern repeats, and these are the pairs that sound smooth together. Switch the tuning to <em>Pure</em> to place the upper note exactly on its ratio.</p>
<p>In equal temperament they are not exact. Twelve equal steps put G at 1.4983 times C, not 1.5: the pattern drifts a little at every repeat. For the fifth the drift is tiny; for the major third, 1.2599 instead of 1.25, much less so.</p>`,
			notes: `<p>The pure ratios used here are those of <em>just intonation</em>: 16:15, 9:8, 6:5, 5:4, 4:3, 3:2, 8:5, 5:3, 15:8 and 2:1. For the tritone (C–F♯) this page uses 45:32; for the minor seventh it uses 9:5, though 16:9 is another common choice. Just intonation can assign different ratios according to the musical context. In pure tuning the lower key keeps its piano pitch and only the upper one moves, the way a violinist or a choir tunes a single interval.</p>`
		},
		{
			id: 'rough',
			chapter: 'fit',
			title: 'Clashing pairs beat',
			scene: 'pair',
			hints: { phase: 'rough' },
			duration: 24,
			controls: [keyA, keyB, tuning, timbre, playPair],
			body: `
<p>Choose <em>Equal-tempered</em> tuning, press two neighbouring keys, C4 and C♯4, and keep the sound a <em>Pure sine tone</em>. Their frequencies differ by 15.6 Hz, so the two waves slide in and out of step 15.6 times a second: the sum swells and fades. These are <dfn data-def="A regular swelling and fading of loudness when two tones of nearly the same frequency sound together; it happens as many times a second as the frequencies differ.">beats</dfn>, the interference you met with waves. Slow beats sound like a wobble; fast ones like these sound rough and grating.</p>
<p>In 1965 Reinier Plomp and Willem Levelt asked listeners to rate pairs of pure tones. Roughness peaked when the tones were about a quarter of a <dfn data-def="The range of frequencies the inner ear cannot fully separate: roughly 100 Hz wide at low pitches and about a sixth of the frequency higher up. Two tones closer than this interfere inside the ear.">critical band</dfn> apart (around 20 Hz near middle C) and faded once they were further apart. The meter on the stage follows their curve.</p>
<p>Switch to <em>Rich</em>. A real instrument's note also contains its <dfn data-def="Frequencies at whole-number multiples of the note's frequency, sounding together with it.">harmonics</dfn>, 2, 3, 4… times its frequency, and harmonics of the two notes can beat against each other even when the notes are far apart. The meter adds up every pair.</p>`,
			notes: `<p>The meter uses William Sethares' fit to Plomp and Levelt's data: two pure tones a frequency difference Δf apart add a roughness proportional to e<sup>−3.51·s·Δf</sup> − e<sup>−5.75·s·Δf</sup>, where s = 0.24 ÷ (0.0207·f + 18.96) shrinks as the lower frequency f grows (wider critical bands at higher pitch). Each pair of harmonics counts with the smaller of their two amplitudes, and each of the rich tone's harmonics has 0.88 times the amplitude of the one below. Roughness is not the whole story of how pleasant a pair sounds: the listeners in such experiments also respond to familiarity, context and musical training.</p>`
		},
		// ------------------------------------------------------------------ map
		{
			id: 'curve',
			chapter: 'map',
			title: 'A map of smooth and rough',
			scene: 'curve',
			hints: { phase: 'rich' },
			duration: 22,
			controls: [interval, curveTimbre, hear],
			body: `
<p>Keep the lower note on C4 and slide the upper one smoothly across the octave, not just from key to key. The curve is the roughness of the pair at every position, for notes with six harmonics.</p>
<p>It is high just above the unison, where everything beats, and it falls into sharp <strong>valleys</strong> at the simple ratios: 6 : 5, 5 : 4, 4 : 3, 3 : 2, 5 : 3 and the octave. In a valley a harmonic of one note lands exactly on a harmonic of the other, so the two cannot beat; nudge the note off the valley and they start to.</p>
<p>The ticks along the bottom are the twelve keys of a piano. Several sit almost in a valley: the fifth G misses its valley by 2 cents, the fourth F by 2 cents; the thirds and sixths miss theirs by 14 to 16 cents.</p>`,
			notes: `<p>With a seventh harmonic included, a further valley appears at 7 : 4 (969 cents), between the keys A and B♭: the "harmonic seventh", which no piano key reaches (it is 31 cents flat of B♭). The six-harmonic sound drawn here has no seventh harmonic, so its curve only flattens there.</p>`
		},
		{
			id: 'timbre',
			chapter: 'map',
			title: 'Without harmonics, no valleys',
			scene: 'curve',
			hints: { phase: 'sine' },
			duration: 20,
			controls: [interval, curveTimbre, hear],
			body: `
<p>Now switch the sound to a <em>Pure sine tone</em>. The valleys vanish. Two sine tones are rough only when they are close together; once they are a few semitones apart they no longer interact, and a fifth is no smoother than a tritone.</p>
<p>So the valleys come from the harmonics, not from the ratios themselves. Most instruments, strings, voices and winds, have harmonics at whole-number multiples, and for them simple ratios are smooth. Bells, gongs and the metal bars of a gamelan have overtones at other ratios, and the smooth intervals move with them.</p>
<p>This is one measurable part of <dfn data-def="How smooth and stable two or more notes sound together; the opposite, a clash, is dissonance.">consonance</dfn>, not a law of the ear. What sounds stable or tense also depends on habit and on the music around it.</p>`,
			notes: `<p>William Sethares turned this around: given an instrument with unusual overtones, compute its roughness curve and build a scale on its valleys. He did it for synthetic sounds and for gamelan instruments, whose scales fit their bars' overtones better than any piano tuning would.</p>`
		},
		// ------------------------------------------------------------------ ladder
		{
			id: 'fifths',
			chapter: 'ladder',
			title: 'Twelve fifths almost close the circle',
			scene: 'ladder',
			hints: { phase: 'comma' },
			duration: 22,
			controls: [stack],
			body: `
<p>Draw the octave as a clock face: going once round is a doubling, and an octave higher lands on the same spot. Start at C and stack pure fifths, 3 : 2 each, folding every result back into the octave: G, D, A, E, B, F♯…</p>
<p>Each new fifth lands near a different hour. After twelve of them you are almost back at C, but not quite: twelve pure fifths overshoot seven octaves by 23.5 cents, about a quarter of a semitone, the <dfn data-def="The gap between twelve pure fifths and seven octaves: (3/2)¹² ÷ 2⁷ = 1.0136, or 23.5 cents.">Pythagorean comma</dfn>.</p>
<p>That near miss is where the twelve notes come from. Medieval and Renaissance musicians built their scales from chains of fifths (Pythagorean tuning, later meantone), and keyboards had twelve keys to the octave centuries before equal temperament became the usual way to tune them. Stop after four fifths and the five notes make a pentatonic scale; after six, the seven notes of a major scale (start the chain on F and they are the white keys).</p>`,
			notes: `<p>Pure fifths can never close the circle exactly: (3/2)<sup>m</sup> is never a power of 2, since 3<sup>m</sup> is odd. Every tuning has to put the comma somewhere. Pythagorean tuning leaves one fifth 23.5 cents short (the "wolf"); meantone narrows the fifths to make the thirds purer; equal temperament spreads the comma evenly, 2 cents off each of the twelve fifths.</p>`
		},
		{
			id: 'divide',
			chapter: 'ladder',
			title: 'Cut the octave into equal steps',
			scene: 'ladder',
			hints: { phase: 'divide' },
			duration: 22,
			controls: [divisions],
			body: `
<p>Equal temperament cuts the octave into equal steps instead, so that every key is as good as every other and music can move to any key. The question is how many steps. Slide the divider through 5, 7, 12, 19, 31 and 53, and read how far the nearest step misses the pure fifth (3 : 2, at 702 cents) and the pure major third (5 : 4, at 386 cents).</p>
<ul>
<li><strong>5 or 7 steps:</strong> fifths 16 to 18 cents off, thirds 43 or more.</li>
<li><strong>12 steps:</strong> the fifth 2 cents flat, the third 14 cents sharp.</li>
<li><strong>19 and 31:</strong> better thirds (7 cents and under 1 cent off), worse fifths (7 and 5).</li>
<li><strong>53:</strong> both within 1.5 cents, at the price of 53 keys to the octave.</li>
</ul>`,
			notes: `<p>A step of n equal parts is 1200 ÷ n cents; the nearest step to the fifth is 702 × n ÷ 1200 rounded, here 7 of 12. Instruments and theorists have used several of these ladders: 19 and 31 equal steps were proposed in the sixteenth and seventeenth centuries as stand-ins for meantone, and the 53-step division was described in China (Jing Fang) and in the Ottoman world, and is used in Turkish music theory.</p>`
		},
		{
			id: 'twelve',
			chapter: 'ladder',
			title: 'Why twelve',
			scene: 'ladder',
			hints: { phase: 'twelve' },
			duration: 24,
			controls: [divisions],
			body: `
<p>The chart shows how far the fifth misses for every ladder from 5 to 53 steps. Most miss by several cents. <strong>Twelve is the first that lands within 2 cents</strong>, close enough that few listeners hear the difference in a fifth. Below it, nothing comes near; above it, 29, 41 and 53 do better, but with far more notes than hands, keys and ears can easily manage.</p>
<p>So twelve is a compromise, not a law of nature: almost pure fifths and fourths, thirds that are audibly off, and a number of notes that fits on a keyboard. Other traditions cut the octave differently: Javanese gamelan's <em>slendro</em> uses five roughly equal steps, and Arabic and Turkish music use intervals that fall between a piano's keys.</p>`,
			notes: `<p>Why do some ladders work so well? A ladder of n steps has a good fifth when 7/12, or k/n in general, is close to log₂(3/2) = 0.58496…, the fifth's share of the octave. The best fractions of this kind are the <em>convergents</em> of its continued fraction: 1/2, 3/5, 7/12, 24/41, 31/53, 179/306. Each one beats every fraction with a smaller denominator, which is why 5, 12, 41 and 53 keep turning up in the history of tuning.</p>`
		},
		// ------------------------------------------------------------------ ear
		{
			id: 'chord',
			chapter: 'ear',
			title: 'Hear the compromise',
			scene: 'chord',
			hints: { phase: 'chord' },
			duration: 26,
			controls: [tuning, playEqual, playPure],
			body: `
<p>A major chord, C–E–G, stacks a major third and a fifth: in pure tuning its frequencies are in the ratio 4 : 5 : 6. Each row on the stage is one note's harmonics. Where harmonics of two notes nearly coincide, they beat.</p>
<p>In equal temperament, the 5th harmonic of C and the 4th of E are 10.4 Hz apart: the chord shimmers about ten times a second. The 6th of E and the 5th of G beat 17.8 times; C's 3rd and G's 2nd drift by less than once a second. In pure tuning all those pairs land exactly on each other, and nothing beats.</p>
<p>Play both. Equal temperament became the usual tuning of Western keyboards during the nineteenth century; singers and players of instruments whose pitch they can bend often move single intervals towards the pure ratios.</p>
<p><strong>Notes sound smooth together when their frequencies are in simple ratios, and twelve equal steps is the first ladder whose fifth lands within 2 cents of the pure 3 : 2.</strong></p>`,
			notes: `<p>Pure tuning has its own price: tune C–E–G pure, then the chord on D built from the same notes comes out wrong, because pure intervals don't add up consistently around the circle of fifths (the comma again). Choirs and string quartets adjust each chord as they go; a keyboard, with one fixed pitch per key, cannot, which is why it settled on equal steps.</p>`
		}
	]
};
