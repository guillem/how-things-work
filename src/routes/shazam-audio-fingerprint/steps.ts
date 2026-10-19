import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { CLIPS, DB_SIZE } from './model';

const tuneOptions = CLIPS.slice(0, DB_SIZE).map((c) => ({
	value: String(c.id),
	label: c.name
}));

const tune: Control = {
	type: 'select',
	id: 'tune',
	label: 'Tune',
	default: '4',
	options: tuneOptions,
	help: 'Twelve tunes composed and played by this page’s code.'
};

const play: Control = {
	type: 'action',
	id: 'play',
	label: 'Listen',
	action: 'Play the tune',
	help: 'Plays the 12-second tune through your speakers.'
};

const recTune: Control = {
	type: 'select',
	id: 'recTune',
	label: 'Tune playing in the room',
	default: '4',
	options: tuneOptions
};

const start: Control = {
	type: 'range',
	id: 'start',
	label: 'Recording starts at',
	min: 0,
	max: 7,
	step: 0.1,
	default: 4.3,
	format: (v) => `${v.toFixed(1)} s into the tune`
};

const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Signal-to-noise ratio',
	min: -15,
	max: 20,
	step: 1,
	default: 5,
	format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`,
	help: 'How much louder the music is than the hiss added to it. 0 dB: equally loud; below 0, the noise is louder.'
};

const cough: Control = {
	type: 'toggle',
	id: 'cough',
	label: 'Someone coughs',
	default: true
};

const seconds: Control = {
	type: 'range',
	id: 'seconds',
	label: 'Length of the recording',
	min: 1,
	max: 8,
	step: 0.5,
	default: 5,
	format: (v) => `${v.toFixed(1)} s`
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Noise',
	action: 'New recording',
	help: 'The same settings with a different hiss and the cough somewhere else.'
};

const playRec: Control = {
	type: 'action',
	id: 'playRec',
	label: 'Listen',
	action: 'Play the recording'
};

const version: Control = {
	type: 'select',
	id: 'version',
	label: 'What the phone hears',
	default: 'original',
	options: [
		{ value: 'original', label: 'The recording in the database' },
		{ value: 'higher1', label: 'The same, a semitone higher' },
		{ value: 'higher2', label: 'The same, a tone higher' },
		{ value: 'cover', label: 'Another band playing the tune' },
		{ value: 'unknown', label: 'A tune not in the database' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'shazam-audio-fingerprint',
	title: 'How Shazam recognises a song',
	summary:
		'Turn a dozen tunes into constellations of spectrogram peaks and pairs of peaks into fingerprints, then record one through noise and a cough from a random start and watch the matching fingerprints line up at a single time offset.',
	chapters: [
		{ id: 'sound', title: 'From sound to a map of peaks' },
		{ id: 'prints', title: 'Fingerprints' },
		{ id: 'search', title: 'Naming the tune' },
		{ id: 'limits', title: 'What it cannot do' }
	],
	steps: [
		// ------------------------------------------------------------------ sound
		{
			id: 'tunes',
			chapter: 'sound',
			title: 'A dozen tunes',
			scene: 'clip',
			hints: { phase: 'wave' },
			duration: 16,
			controls: [tune, play],
			body: `
<p>You hold up your phone in a noisy café and, a few seconds later, it names the song. It has not understood the music: it does not know the melody or the words. It has matched a handful of numbers.</p>
<p>To see how, this page builds a tiny version of the method Avery Wang described in 2003 for Shazam. First it needs a library of music. Rather than ship recordings, the page <strong>composes and plays twelve short tunes</strong> itself: each has its own tempo, key and instrument, a melody, a bass line and a picked accompaniment. Pick one and press <em>Play the tune</em> to hear it.</p>
<p>The stage shows the sound as a computer stores it: the air pressure measured 8,000 times a second, a <dfn data-def="The list of numbers that records how the air pressure (the microphone's membrane) moves over time.">waveform</dfn>. Wang's tests used the same rate. Two different tunes look much the same as waveforms: a fuzzy band that swells with each note.</p>`,
			notes: `<p>8,000 samples a second can only describe frequencies below 4,000 Hz (half the rate), which is about the range a phone call carries. That is plenty to recognise music: Wang 2003 reports its tests "using 8KHz, mono, 16-bit samples". The tunes here keep every partial below 3.8 kHz.</p>`
		},
		{
			id: 'spectrogram',
			chapter: 'sound',
			title: 'The spectrogram',
			scene: 'clip',
			hints: { phase: 'spec' },
			duration: 22,
			controls: [tune, play],
			body: `
<p>A waveform hides which notes are playing. The <em>Fourier transform</em> reveals them: it splits a stretch of sound into the sine waves it is made of. Do it over and over on short overlapping slices and you get a <dfn data-def="A picture of sound: time runs left to right, frequency (pitch) bottom to top, and the brightness of each point is how loud that frequency is at that moment.">spectrogram</dfn>.</p>
<p>Here each slice is 64 milliseconds long (512 samples), and a new one starts every 32 ms. Each slice gives the loudness of 256 frequencies from 0 to 4,000 Hz, 15.6 Hz apart. Time runs to the right, pitch upward, and the louder a frequency, the darker (or, in dark mode, the brighter) its point.</p>
<p>Every note is a short horizontal stroke: its pitch at the bottom and, stacked above it, its <dfn data-def="The other sine waves in a note, at whole-number multiples of its lowest frequency. Their mix gives an instrument its sound.">harmonics</dfn> at two, three, four times that frequency. Each stroke fades as the note dies away.</p>`
		},
		{
			id: 'peaks',
			chapter: 'sound',
			title: 'Keep only the peaks',
			scene: 'clip',
			hints: { phase: 'peaks' },
			duration: 22,
			controls: [tune, play],
			body: `
<p>Now throw almost all of it away. Keep a point only if it is <strong>louder than every neighbour</strong> in a box around it (here ± 94 Hz and ± 128 ms), and only if it is among the ten loudest such points within a quarter of a second either side, so that loud passages don't take all of them and quiet ones still get some.</p>
<p>What remains is a scatter of dots, which Wang called a <dfn data-def="The sparse set of (time, frequency) points kept from a spectrogram: each one a local peak of loudness.">constellation map</dfn> because it looks like a star chart. The stage counts them: about a dozen dots a second, out of the 8,000 points (256 frequencies × 31¼ slices) the spectrogram has each second. Their loudness is forgotten too; only their positions are kept.</p>
<p>Why peaks? Because they survive. Noise in a café adds sound everywhere, but a peak that stood well above its surroundings usually still does. A cheap loudspeaker or a phone's microphone changes how loud each frequency is, but a peak stays a peak at the same place.</p>`,
			notes: `<p>Wang 2003 (§2.1): a point is a candidate peak "if it has a higher energy content than all its neighbors in a region centered around the point", and candidates are then chosen by a density criterion so the map has "reasonably uniform coverage", the loudest first. The box sizes, the ten per half-second and a rule that drops a peak more than 25 dB quieter than a louder one nearby (faint peaks are the first to drown) are this page’s choices, fitted to these tunes.</p>`
		},
		// ------------------------------------------------------------------ prints
		{
			id: 'pairs',
			chapter: 'prints',
			title: 'Pairs of peaks',
			scene: 'pairs',
			hints: { phase: 'pairs' },
			duration: 24,
			controls: [tune],
			body: `
<p>A single peak says little: one of 256 frequencies at some moment. Thousands of songs have a peak at 440 Hz. So the method combines them. Each peak in turn becomes an <dfn data-def="The peak a fingerprint starts from. Its time is stored with the fingerprint.">anchor</dfn>, and is paired with peaks in a <dfn data-def="The region just after an anchor, here from 64 ms to 1.28 s later and within 750 Hz of its pitch, where its partners are taken from.">target zone</dfn> a little later: here up to ten of them, the nearest in time.</p>
<p>Each pair becomes one <strong>fingerprint</strong>: the anchor's frequency, the partner's frequency, and the time between them. The stage walks an anchor along the map, draws its target zone and its pairs, and spells out one fingerprint.</p>
<p>Notice what is <em>not</em> in it: the time at which the pair occurs in the song. The fingerprint is the same wherever in the song, and wherever in a recording, the two notes are heard.</p>`
		},
		{
			id: 'bits',
			chapter: 'prints',
			title: 'A fingerprint is a number',
			scene: 'pairs',
			hints: { phase: 'bits' },
			duration: 22,
			controls: [tune],
			body: `
<p>A fingerprint is packed into one whole number, in <em>binary</em>. The first frequency is one of 256 bins, which takes 8 bits; the second another 8; the gap, at most 40 slices of 32 ms, fits in 6 bits (up to 63). Side by side they make a <strong>22-bit number</strong>.</p>
<p>That is what makes pairs powerful. A single peak can only be one of 2⁸ = 256 values, so any of them turns up all over a library. A pair can be any of 2²² ≈ 4.2 million values, so a given fingerprint is rare, and looking it up points straight at a few places in a few songs.</p>
<p>Wang's numbers: with 1,024 frequency bins (10 bits) and a 10-bit gap, a pair carries 30 bits against 10 for a single point, so it is about a million times more specific. Making ten pairs per peak costs about ten times the storage, and Wang estimated the search becomes about 10,000 times faster.</p>`,
			notes: `<p>From Wang 2003 (§2.2): "each hash can be packed into a 32-bit unsigned integer", stored with the time offset of its anchor from the start of the file and the track's identity, "yielding an aggregate 64-bit struct". The speed-up of about 1,000,000/F² ≈ 10,000 for a fan-out F = 10 is his estimate. The price is robustness: a pair survives only if <em>both</em> its peaks do, roughly p² for a peak survival p, which the many pairs per anchor make up for.</p>`
		},
		{
			id: 'database',
			chapter: 'prints',
			title: 'The database',
			scene: 'database',
			hints: { phase: 'database' },
			duration: 22,
			body: `
<p>Do the same to every tune in the library. For each fingerprint, store where it came from: <strong>which tune</strong>, and <strong>at what time</strong> its anchor occurs. Then file everything by fingerprint, like the index at the back of a book: look up a number and you get the list of (tune, time) places where it occurs.</p>
<p>The stage shows the twelve constellations and the size of the index. Most fingerprint numbers occur in one tune only; some, made of two common notes at a common gap, turn up in several tunes. That is fine: a lone match proves nothing, as the next chapter shows.</p>
<p>A lookup in such an index takes the same time whether it holds twelve tunes or millions. Wang's service held about 1.8 million tracks in 2003, and he reports search times of 5 to 500 milliseconds on a database of about 20,000 tracks on a single PC.</p>`,
			notes: `<p>The index here is a hash map from fingerprint to a list of entries. Wang sorts the 64-bit records by fingerprint value, which gives the same lookup by binary search over a file that can be far larger than memory.</p>`
		},
		// ------------------------------------------------------------------ search
		{
			id: 'record',
			chapter: 'search',
			title: 'Recording in a noisy room',
			scene: 'match',
			hints: { phase: 'record' },
			duration: 22,
			controls: [recTune, start, noise, cough, again, playRec],
			body: `
<p>Now play a tune "in a café" and record a few seconds of it. The page makes the recording itself (it never uses your microphone): it cuts five seconds starting wherever you choose, adds hiss at the <dfn data-def="Signal-to-noise ratio: how much more powerful the music is than the noise, in decibels. +10 dB: ten times the power; 0 dB: equal; −10 dB: the noise has ten times the power.">signal-to-noise ratio</dfn> you set, and someone coughs.</p>
<p>The recording goes through the same steps as the library: spectrogram, peaks, fingerprints. Its dots are drawn over its spectrogram; the cough shows as a smear that hides some peaks and adds others of its own.</p>
<p>The recording's times start at <strong>0</strong> when the phone starts listening, not at the tune's start: the phone has no idea where in the song it is. Compare its constellation with the same stretch of the original, drawn faintly below: many dots are where they should be, some are missing, some are new.</p>`
		},
		{
			id: 'lookup',
			chapter: 'search',
			title: 'Looking up the fingerprints',
			scene: 'match',
			hints: { phase: 'scatter' },
			duration: 24,
			controls: [recTune, start, noise, cough, again],
			body: `
<p>Each fingerprint of the recording is looked up in the index. Every hit gives a pair of times: when the fingerprint occurs in the <strong>recording</strong>, and when it occurs in that <strong>tune</strong>. The stage plots each hit as a dot, one small chart per tune: recording time across, tune time up.</p>
<p>Watch them arrive. On the wrong tunes, hits are chance coincidences, two common notes at a common gap, and they land anywhere. On the right tune, the hits come from the same music, so their times move together: when the recording is 1 s further on, so is the tune. They fall on a <strong>diagonal line</strong>, at the height where the recording started.</p>`,
			notes: `<p>Wang 2003 (§2.3): matching "reduces to detecting a significant cluster of points forming a diagonal line within the scatterplot". The line has slope 1 because the recording plays at the same speed as the original.</p>`
		},
		{
			id: 'histogram',
			chapter: 'search',
			title: 'The spike names the tune',
			scene: 'match',
			hints: { phase: 'hist' },
			duration: 24,
			controls: [recTune, start, noise, cough, again],
			body: `
<p>A diagonal line is easy to find with arithmetic. For every hit, subtract: <strong>time in the tune − time in the recording</strong>. On the line, that difference is the same for every dot: it is where in the tune the recording started. So count the hits for each difference, a <dfn data-def="A bar chart of how many values fall in each range. Here: how many hits have each time difference.">histogram</dfn>, one per tune.</p>
<p>The right tune shows a tall, narrow <strong>spike</strong>, at the start time you chose. The wrong tunes' hits spread out into a low, flat scatter. The score of a tune is the height of its spike, and the page names the winner when its spike is at least 13 tall and three times taller than any other tune's.</p>
<p>Look at the hit counts too: a wrong tune can share quite a few fingerprints with the recording. What makes a match reliable is not how many fingerprints agree but that they agree <strong>about the time</strong>.</p>`,
			notes: `<p>The spike here counts the hits within one 32-ms slice either side of its tallest bar, because a recording that starts between two slices moves some peaks by one slice. Hits from the harmonics of the same two notes, with the same times and gap, count once. The threshold of 13 is this page's choice, set above the spikes its wrong tunes reach. Wang picks a threshold from the distribution of scores of wrong tracks, for a chosen false-positive rate such as 0.1% or 0.01% (§2.3.1).</p>`
		},
		{
			id: 'noise',
			chapter: 'search',
			title: 'Turn up the noise',
			scene: 'match',
			hints: { phase: 'noise' },
			duration: 24,
			controls: [noise, seconds, recTune, start, again],
			body: `
<p>Slide the noise up (the ratio down) and watch the spike. Peaks drown one by one and the noise adds peaks of its own, so fewer fingerprints survive. But the survivors still line up, and a few aligned hits stand out against a scatter of chance ones. Even with the hiss as loud as the music (0 dB), the spike is usually still there. Somewhere below that it sinks into the scatter, and the page says it can't tell.</p>
<p>Now shorten the recording. Four or five seconds are usually enough; one second never is, because it holds too few pairs for the spike to stand out. Wang reports that in his tests, from a heavily corrupted 15-second sample, a match could be found with only about 1 to 2% of the fingerprints surviving and lining up.</p>`,
			notes: `<p>Wang's tests (§3.1, Figure 4) took 250 excerpts from a database of 10,000 popular tracks, mixed with noise recorded in a pub: half were recognised at about −9, −6 and −3 dB for 15, 10 and 5 seconds. After GSM phone compression as well, the same rates came at about −3, 0 and +4 dB. This page's synthesized tunes, white hiss and twelve-tune library are much simpler, so its numbers are only a demonstration, not a reproduction of his.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'limits',
			chapter: 'limits',
			title: 'Not the melody: this very recording',
			scene: 'match',
			hints: { phase: 'limits' },
			duration: 26,
			controls: [version, recTune, noise],
			body: `
<p>Choose what the phone hears. Play the tune <strong>a semitone higher</strong>, same timing, same instrument: every frequency moves by 6%, almost every fingerprint changes, and the spike is gone. <strong>Another band</strong> playing the same tune, with another instrument, 8% slower and with human timing, has different peaks and different gaps: no match either. And a tune that is <strong>not in the database</strong> gets hits, a few chance coincidences, but no spike, so the page reports nothing rather than a wrong answer.</p>
<p>So Shazam does not recognise a melody, a singer or the words. It cannot find a cover version or a tune you hum: a different performance has different peaks. What it finds is <strong>this particular recording</strong>, with its exact frequencies and timing, even through noise, a cough and a cheap microphone.</p>
<p>That is the whole trick: a song is recognised not by comparing sound but by matching a sparse set of peak pairs whose time gaps line up, which is why a few noisy seconds from the middle of a track are enough.</p>`,
			notes: `<p>Wang (§3.3): the algorithm "is not expected to generalize to live recordings", and it is "very sensitive to which particular version of a track has been sampled", picking the right performance among several that sound alike. Finding hummed tunes or covers needs other methods that compare melodies or musical features, and they are slower and less certain.</p>`
		}
	]
};
