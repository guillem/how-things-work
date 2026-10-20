import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { pitchHz } from './sounds.ts';

const hz = (f: number) =>
	f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz` : `${Math.round(f)} Hz`;

/** The tone's frequency, as octaves above 125 Hz (so that the slider is logarithmic). */
const pitch: Control = {
	type: 'range',
	id: 'pitch',
	label: 'Frequency of the tone',
	min: 0,
	max: 7,
	step: 1 / 12,
	default: 3,
	format: (v) => hz(pitchHz(v))
};

const play: Control = {
	type: 'action',
	id: 'play',
	label: 'Sound',
	action: 'Play',
	help: 'About a second, quietly: the speaker never plays the level the model uses.'
};

const sound: Control = {
	type: 'select',
	id: 'sound',
	label: 'Sound (one tone: the slider’s)',
	default: 'chord',
	options: [
		{ value: 'tone', label: 'One tone' },
		{ value: 'pair', label: '500 Hz + 3 kHz' },
		{ value: 'close', label: '1 + 1.05 kHz' },
		{ value: 'chord', label: 'Chord C–E–G' },
		{ value: 'ah', label: 'Vowel “ah”' },
		{ value: 'ee', label: 'Vowel “ee”' }
	]
};

const ohc: Control = {
	type: 'toggle',
	id: 'ohc',
	label: 'Outer hair cells working',
	default: true
};

const level: Control = {
	type: 'range',
	id: 'level',
	label: 'Level of the tone in the model',
	min: 0,
	max: 110,
	step: 5,
	default: 40,
	format: (v) => `${v} dB SPL`,
	help: 'A model input. The speaker plays every level at the same quiet volume.'
};

const loss: Control = {
	type: 'range',
	id: 'loss',
	label: 'Outer hair cells lost around the 5 kHz place',
	min: 0,
	max: 100,
	step: 10,
	default: 100,
	format: (v) => `${v} %`
};

const vowel: Control = {
	type: 'select',
	id: 'vowel',
	label: 'Vowel',
	default: 'ah',
	options: [
		{ value: 'ah', label: '“ah”' },
		{ value: 'ee', label: '“ee”' },
		{ value: 'oo', label: '“oo”' }
	]
};

const channels: Control = {
	type: 'range',
	id: 'channels',
	label: 'Channels (electrodes in use)',
	min: 1,
	max: 22,
	step: 1,
	default: 8
};

const playVowel: Control = {
	type: 'action',
	id: 'playVowel',
	label: 'Listen',
	action: 'The vowel',
	help: 'Each sound lasts about a second and plays quietly.'
};

const playImplant: Control = {
	type: 'action',
	id: 'playImplant',
	label: 'Listen',
	action: 'Through the implant'
};

/**
 * Scenes: `cochlea` (the uncoiled cochlea with the basilar membrane, its travelling wave and a
 * chart along the same place axis; focus 'map' (Greenwood's map as the chart, the tone's place
 * marked), 'wave' (one tone's wave and its excitation pattern), 'mix' (several tones or a
 * vowel), 'amp' (live against passive), 'level' (the tone's level, with an input–output inset)),
 * `damage` (hair-cell rows with a lost stretch; the audiogram and the input–output curves at
 * 4 kHz; focus 'notch' or 'loud') and `implant` (a vowel's spectrum along the place axis, the
 * implant's bands and the electrode array in the cochlea).
 */
export const spec: ExplainerSpec = {
	slug: 'cochlea-hearing',
	title: 'Hearing & the cochlea',
	summary:
		'Play a tone, a chord or a vowel into a model cochlea and watch a travelling wave peak at the place tuned to each frequency. Switch the outer hair cells’ amplifier off and on, turn the sound up until it saturates, kill the amplifier near the 5 kHz place to notch the audiogram, and hear a vowel through a cochlear implant with a handful of channels.',
	chapters: [
		{ id: 'place', title: 'Pitch is a place' },
		{ id: 'amplifier', title: 'The cochlear amplifier' },
		{ id: 'damage', title: 'Noise damage' },
		{ id: 'implant', title: 'The cochlear implant' }
	],
	steps: [
		// ------------------------------------------------------------------ place
		{
			id: 'map',
			chapter: 'place',
			title: 'A membrane tuned along its length',
			scene: 'cochlea',
			hints: { focus: 'map' },
			duration: 30,
			controls: [pitch, play],
			body: `
<p>Sound reaches the inner ear as the in-and-out motion of the <dfn data-def="The last and smallest of the middle ear's three bones; its footplate sits in the oval window of the cochlea.">stapes</dfn> in the oval window of the <dfn data-def="The snail-shaped, fluid-filled part of the inner ear that turns sound into nerve signals.">cochlea</dfn>. The cochlea is a fluid-filled tube about 35 mm long, coiled two and a half turns in a human and drawn here uncoiled, with the stapes on the left. It has three fluid-filled channels; the <dfn data-def="An elastic strip running the length of the cochlea, carrying the sensory cells on its upper side.">basilar membrane</dfn> forms the floor of the middle one. The drawing simplifies the partition into one membrane between two channels, the scala vestibuli above and the scala tympani below, joined at the far end (it leaves out the thin Reissner's membrane and the middle channel, the scala media). The fluid cannot be compressed, so each push of the stapes bulges the round window, the cochlea's second opening, outwards, and the pressure difference across the membrane makes it move.</p>
<p>The membrane is narrow and stiff at the <strong>base</strong>, near the stapes, and wider and floppier at the <strong>apex</strong>. Each short section of it is a <a href="../oscillations-resonance/">mass on a spring</a> with its own resonant frequency, from about 20 kHz at the base down to about 20 Hz at the apex. Donald Greenwood fitted the map from frequency to place in the human cochlea:</p>
<p class="formula">F(x) = 165.4 · (10<sup>2.1 x</sup> − 0.88) Hz,</p>
<p>with x the fraction of the length from the apex. The chart plots it. Over most of the length, each <strong>octave</strong> (a doubling of frequency) takes about 5 mm. Slide the frequency and its place moves along the membrane.</p>`,
			notes: `<p>Greenwood's function (Greenwood 1990, <i>J. Acoust. Soc. Am.</i> 87:2592) came from psychoacoustic critical bands and from von Békésy's measurements on cadavers; it fits later anatomical maps well. Human cochleas are about 30 to 37 mm long (a mean of 33 mm in one anatomical study); the page uses Greenwood's 35 mm. In the model the membrane's stiffness falls so that each section's natural frequency, √(k/m)/(2π) Hz, follows the map exactly; in a real cochlea the stiffness gradient, the changing width and the mass of the structures on the membrane share that job. The middle ear's three bones match the air to the fluid: the eardrum's area is about 17 times the stapes footplate's, so the pressure in the fluid is many times the sound pressure on the eardrum.</p>`
		},
		{
			id: 'wave',
			chapter: 'place',
			title: 'A wave that slows down and stops',
			scene: 'cochlea',
			hints: { focus: 'wave' },
			duration: 35,
			controls: [pitch, play],
			body: `
<p>A tone does not just shake its own place. The stapes pushes the fluid, the fluid pushes the membrane, the membrane's springiness pushes back, and the result is a <a href="../waves-interference/#wave">wave</a> that travels along the membrane from the base, as von Békésy saw in the 1940s. Its speed depends on the stiffness of the membrane it runs on, and the stiffness keeps falling.</p>
<p>So the wave <strong>slows down</strong> as it travels, its crests bunch together, and its energy piles up: it grows. Near the place whose resonance matches the tone, the membrane moves most. Just beyond, the sections are too floppy to keep up with the tone, the wave can no longer travel, and it dies within a millimetre or two. The dashed line is the envelope, the largest swing at each place.</p>
<p>The chart below is the <strong>excitation pattern</strong>: how fast each place moves, in decibels above the speed the sensory cells need to signal. Slide the frequency: high tones peak near the base, low tones travel all the way towards the apex. The peak sits on Greenwood's place. <strong>Pitch is a place</strong>: which nerve fibres fire tells the brain the frequency.</p>`,
			notes: `<p>The model is the classic one-dimensional "transmission line" (Zweig, Lipes and Pierce 1976; Neely 1981): 4,800 sections of membrane (doubling them changes nothing visible), each a mass, a spring and a damper, coupled by the fluid, which carries the pressure difference P along the cochlea: d²P/dx² = (2iωρ/H)·P/Z(x), with Z the impedance of the section and H the height of each channel. It is solved for a steady tone; the stage draws the membrane's displacement in that steady state, slowed down enormously (for the vowels, whose harmonics span many octaves, each harmonic is turned at its own slowed rate, so their drawn timing is schematic). One dimension is a simplification: near the peak the wave is short and the fluid moves in all three dimensions. The wave carries energy from the stapes to its place; it is not the fluid flowing along the tube. At low frequencies the brain also uses the timing of the nerve spikes, which lock to the wave's phase, so place is not the only code for pitch.</p>`
		},
		{
			id: 'mix',
			chapter: 'place',
			title: 'Several tones, several places',
			scene: 'cochlea',
			hints: { focus: 'mix' },
			duration: 35,
			controls: [sound, pitch, play],
			body: `
<p>Play two tones at once and two waves travel together, each peaking at its own place: the membrane splits the sound into its frequencies, a rough <a href="../fourier-transform/#spectrum">Fourier analysis</a> done by mechanics. A chord makes one bump per note. Each tone is solved here as if it were alone and the patterns added.</p>
<p>The analysis has a limited resolution. Two tones 5 % apart, 1 kHz and 1.05 kHz, peak less than half a millimetre apart, and their bumps merge into one: the ear hears them as one rough, beating sound rather than two notes. The width of a single bump is the ear's <dfn data-def="The range of frequencies around a tone whose excitation patterns overlap enough to interact; about a sixth to a third of an octave in the middle of the hearing range.">critical band</dfn>.</p>
<p>A vowel is many tones: the harmonics of the voice, here every 120 Hz, made louder or softer by the shape of the mouth and throat. The lowest few harmonics each get their own bump; higher up they merge, and what remains are the broad humps of the <dfn data-def="Resonances of the vocal tract that make some harmonics of a vowel louder; their frequencies tell vowels apart.">formants</dfn>. “Ah” has its first two formants close together, near 730 and 1,090 Hz; “ee” has them far apart, near 270 and 2,290 Hz. That is how the cochlea tells vowels apart.</p>`,
			notes: `<p>The vowels are synthesized: a voice at 120 Hz whose harmonics fall by 6 dB per octave, passed through three resonances at Peterson and Barney's (1952) average formant frequencies for men. The real cochlea is nonlinear, so tones do interact: a loud tone suppresses the response to a nearby one, and two tones create distortion products at new frequencies (the reason the ear emits faint sounds, otoacoustic emissions, which hearing screens of newborns measure). The page leaves those out.</p>`
		},
		// ------------------------------------------------------------------ amplifier
		{
			id: 'amplifier',
			chapter: 'amplifier',
			title: 'The outer hair cells push',
			scene: 'cochlea',
			hints: { focus: 'amp' },
			duration: 35,
			controls: [ohc, pitch, play],
			body: `
<p>On top of the membrane sits the <dfn data-def="The sensory structure on the basilar membrane, carrying the inner and outer hair cells.">organ of Corti</dfn>, with two kinds of hair cell. One row of about 3,500 <strong>inner hair cells</strong> are the sensors: when the membrane moves, their hair bundles bend, ion channels open, and they release transmitter onto the <a href="../neurons/#synapse">synapses</a> of the auditory nerve fibres, which then fire. Three rows of about 12,000 <strong>outer hair cells</strong> do something else: they change length in step with the motion, using the motor protein <em>prestin</em>, and push on the membrane.</p>
<p>Their push is timed to add energy as the wave goes by, cancelling most of the membrane's friction. That is the <strong>cochlear amplifier</strong>. Switch it off and play a soft tone (20 dB SPL, as in all the steps so far): in this model the peak drops by about <strong>20 dB</strong> or more (ten times less motion), broadens, and slides a few millimetres towards the base. In measurements on living and dead cochleas, death cut the response to a soft tone at a place's characteristic frequency by as much as <strong>65 to 80 dB</strong> (Robles and Ruggero 2001). The amount depends on the frequency; the readout gives this model’s values. The dashed curve keeps the other state for comparison.</p>
<p>With the amplifier the excitation pattern is sharp: at 1 kHz the stretch within 10 dB of the peak is about a millimetre and a half long, about a third of an octave on the map. Without it, it spans about two octaves.</p>`,
			notes: `<p>In the model the outer hair cells are a <em>phenomenological negative damping</em>: a force proportional to the membrane's velocity that cancels all but 4 % of the passive damping at the base, and 15 % at the apex. The damping, the amplifier's saturation and the input calibration are illustrative values fitted to the measurements quoted on this page, not a published parameter set. Real outer hair cells act through the micromechanics of the organ of Corti, which a one-dimensional model cannot hold, and they amplify more: measured at one place, the living cochlea's response to a soft tone at that place's frequency is up to 65 to 80 dB larger than the same place's response after death (Robles and Ruggero 2001). The cochlea is active enough that some ears emit faint tones of their own.</p>`
		},
		{
			id: 'level',
			chapter: 'amplifier',
			title: 'Soft sounds get the most boost',
			scene: 'cochlea',
			hints: { focus: 'level' },
			duration: 35,
			controls: [level, ohc, pitch, play],
			body: `
<p>The outer hair cells' push has a limit: their channels open fully, and a louder sound gets no extra push. So the amplifier gives soft sounds its full gain and loud sounds hardly any. Raise the level: below about 30 dB SPL the peak grows decibel for decibel; above it the live cochlea's peak grows only about <strong>half a decibel per decibel</strong> (inset), while the passive one keeps growing one for one. By 110 dB SPL the amplifier has nothing left to add, and the two are the same.</p>
<p>This <strong>compression</strong> squeezes the range of sounds we hear, a millionfold in pressure (120 dB), into a range the hair cells and nerve fibres can signal. It also changes the shape: at high levels the peak broadens and moves towards the base, so a place responds best to a tone about half an octave lower than when the tone is soft.</p>`,
			notes: `<p>The amplifier's push saturates with the local velocity v as γ₀/(1 + (v/v_sat)²), solved by iterating to a steady state for each tone. Measured basilar membranes at a fixed place compress even more, 0.2 to 0.5 dB per dB between about 40 and 90 dB SPL, and their tuning broadens from a Q₁₀ (frequency over the width 10 dB below the peak) of about 5 at 10 dB SPL to 1.4 at 90 dB SPL (Robles and Ruggero 2001, chinchilla). The model's place tuned to 4 kHz has a Q₁₀ of about 6 for soft tones and about 1 for loud ones; human tuning is thought to be sharper than that of the animals measured. Decibels SPL are 20·log₁₀ of the sound pressure over 20 µPa, the threshold of hearing at 1 to 4 kHz.</p>`
		},
		// ------------------------------------------------------------------ damage
		{
			id: 'notch',
			chapter: 'damage',
			title: 'Loud noise takes out the amplifier',
			scene: 'damage',
			hints: { focus: 'notch' },
			duration: 35,
			controls: [loss],
			body: `
<p>Loud noise can damage the outer hair cells and remove their amplification. It can also damage the synapses between the inner hair cells and the auditory nerve, even when the hair cells survive and the thresholds recover (Kujawa and Liberman 2009); this step isolates the loss of outer hair cells. Noise damage gathers around the places tuned to 3 to 6 kHz: everyday noise is strongest there once the ear canal's resonance has boosted it, and the damage from a loud sound lies about half an octave above its frequency. Here the outer hair cells are lost along 4 mm around the 5 kHz place; the inner hair cells, the sensors, are left intact.</p>
<p>An <strong>audiogram</strong> measures the softest tone a person hears at each standard frequency, in decibels relative to normal hearing (<strong>dB HL</strong>), drawn downwards: lower is worse. With the amplifier gone in that stretch, tones there must be up to about <strong>20 dB</strong> louder to be heard in this model; real ears can lose up to <strong>50 to 60 dB</strong> from outer hair cells alone. The thresholds change much less at 2 kHz and below, and at 8 kHz, whose tones peak elsewhere. That dip with recovery at 8 kHz is the classic <strong>noise notch</strong>, a characteristic audiometric pattern of noise-induced hearing loss.</p>`,
			notes: `<p>The model's threshold for a tone is the level at which some place on the membrane moves at 100 µm/s, about the membrane's speed at the threshold of the nerve fibres tuned there (Robles and Ruggero 2001). With every outer hair cell lost everywhere, the model's thresholds rise by about 20 to 25 dB, its amplifier's whole gain; real ears lose up to 50 to 60 dB from outer hair cells alone, and noise also damages inner hair cells and the synapses between them and the nerve. A notch is often defined as a dip at 3, 4 or 6 kHz with thresholds at least 10 dB better at 2 and 8 kHz; notches are common even without noise exposure, so they are a hint, not a diagnosis (Lie et al. 2017).</p>`
		},
		{
			id: 'loud',
			chapter: 'damage',
			title: 'Soft sounds vanish, loud ones still hurt',
			scene: 'damage',
			hints: { focus: 'loud' },
			duration: 35,
			controls: [level, loss],
			body: `
<p>Noise damage does <strong>not</strong> just turn the volume down. Follow the largest motion anywhere on the membrane for a 4 kHz tone, in the healthy ear and in the damaged one (the place of that maximum moves towards the base as the level rises). A soft tone, 15 dB SPL, is heard by the healthy ear and lost in the damaged one: the boost the amplifier used to add is missing. Now raise the level. The healthy ear's amplifier saturates and its curve flattens; the damaged ear never had that boost, so its curve keeps climbing, and by about 100 dB SPL the two are the same.</p>
<p>So the damaged ear's range is squeezed from below: sounds go from inaudible to fully loud over a few tens of decibels. This is <dfn data-def="The abnormally fast growth of loudness with level in an ear that has lost its outer hair cells.">loudness recruitment</dfn>. Turning everything up does not fix it, because loud sounds become too loud. Hearing aids instead <strong>compress</strong>: they amplify soft sounds a lot and loud ones little, doing the job of the lost outer hair cells.</p>`,
			notes: `<p>The curves plot the fastest motion anywhere on the membrane for a 4 kHz tone, in dB above the threshold speed; loudness grows roughly with the total excitation of the nerve fibres, so this is a rough guide. A hearing aid cannot restore the lost sharpness of tuning: the broad passive peak still smears nearby frequencies together, which is why people with hearing loss struggle most with speech in a noisy room.</p>`
		},
		// ------------------------------------------------------------------ implant
		{
			id: 'implant',
			chapter: 'implant',
			title: 'A cochlear implant: a few places instead of thousands',
			scene: 'implant',
			duration: 45,
			controls: [vowel, channels, playVowel, playImplant],
			body: `
<p>When the hair cells are lost almost completely, a hearing aid has nothing to drive. A <strong>cochlear implant</strong> skips them: a thin array of electrodes is slid into the lower channel of the cochlea from the base, and electric pulses excite the auditory nerve fibres near each electrode directly, as an <a href="../neurons/#threshold">above-threshold stimulus</a> would. Because pitch is a place, each electrode stands in for a stretch of the membrane.</p>
<p>A processor splits the microphone's sound into one frequency band per channel, here spaced evenly along the cochlea from 200 Hz to 7 kHz, measures how loud each band is moment by moment (its envelope), and drives the matching electrode with that envelope: low bands on the deep electrodes, high bands near the base. Everything inside a band, the harmonics and the exact frequency, is thrown away. Listen to the vowel and then to the same vowel through the implant: the simulation replaces each band with noise of the same loudness, as is standard in implant research.</p>
<p>With one or two channels the formants are lost. With about eight they show again as louder bands, and in quiet that is enough to understand speech (Shannon and colleagues, 1995). Real implants have 12 to 22 electrodes, but the current spreads through the fluid, which limits how independent the channels are. Older studies often found speech recognition levelling off at around four to eight channels; some modern arrays and listeners benefit from more.</p>`,
			notes: `<p>The drawn array reaches 24 mm from the base, a typical depth, so its deepest electrode sits at the place tuned to about 600 Hz while it carries the 200 Hz band: implants shift sounds upwards, and users adapt over weeks to months. The simulation is a noise vocoder: fourth-order Butterworth band filters on each side, the envelope taken by rectifying and smoothing below 160 Hz, noise filtered into the same band modulated by it. It lets a hearing listener sense what a coarse place code sounds like; it is not what an implant user hears. Research: Shannon et al., <i>Science</i> 270:303 (1995); Friesen et al., <i>J. Acoust. Soc. Am.</i> 110:1150 (2001); Berg et al., <i>Ear and Hearing</i> (2021), on channel independence with modern arrays. The bars and the electrodes' brightness are the levels the simulation's own band filters measure.</p>`
		}
	]
};
