import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `sequence` (the pulse sequence: a slice, phase encoding, the readout; `step.hints.mode`),
 * `echo` (a few spins fanning out and refocusing) and `kspace` (k-space beside the image computed
 * from it; `step.hints.mode` picks what is done to it). Every control id belongs to one step.
 */

const radius = (id: string, def: number, label: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0.02,
	max: 0.6,
	step: 0.01,
	default: def,
	format: (v) => `${Math.round(v * 100)}% of the way to the edge`
});

export const spec: ExplainerSpec = {
	slug: 'mri-k-space',
	title: 'MRI: an image from spinning protons',
	summary:
		'An MRI scanner never measures a picture. Gradients give every position in the slice its own precession frequency and phase, so each echo is one line of the image’s 2-D Fourier transform. Watch k-space fill line by line beside the image it gives, see spins refocus into an echo, then edit k-space: blur, outlines, ghosts and a head that wraps round.',
	chapters: [
		{ id: 'encode', title: 'Position into frequency and phase' },
		{ id: 'echo', title: 'The echo' },
		{ id: 'fill', title: 'Filling k-space' },
		{ id: 'edit', title: 'Editing k-space' }
	],
	steps: [
		// ---------------------------------------------------------------- encode
		{
			id: 'measure',
			chapter: 'encode',
			title: 'The scanner measures the right-hand picture',
			scene: 'kspace',
			hints: { mode: 'intro' },
			duration: 20,
			body: `
<p>On <a href="../medical-imaging/#gradient">Medical imaging</a> one gradient turned position into frequency, and the Fourier transform of the coil’s signal gave a one-dimensional profile of the water. A modern scanner does not stop at profiles. It records the slice’s <strong>two-dimensional Fourier transform</strong>, called <dfn data-def="The space of spatial frequencies (kx, ky), in cycles per centimetre. Each point holds how much of one wave pattern of that frequency and direction the slice contains.">k-space</dfn> (left), and the image (right) is computed from it with one inverse transform.</p>
<p>The object here is the <dfn data-def="A standard mathematical head: a few ellipses, published by Shepp and Logan in 1974 and given MRI tissue values by Gach, Tanase and Boada in 2008.">Shepp–Logan head</dfn>, 19 cm long, with grey and white matter, fluid-filled ventricles and three small lesions at the bottom. Each sample of its k-space is computed exactly, as a perfect scanner would record it, on a 128 × 128 grid covering 24 cm.</p>
<p>Two things the picture is not. It is not made with X-rays: MRI uses a magnet and radio waves, and no ionising radiation. And it is not a map of water alone: how bright each tissue is depends on its relaxation times and the scan’s timing. This scan is <strong>T2-weighted</strong>, so fluid is bright.</p>`,
			notes: `<p>k-space is drawn on a logarithmic grey scale: its centre is thousands of times stronger than its edges. The image’s brightness is the spin-echo signal M₀ (1 − e<sup>−TR/T1</sup>) e<sup>−TE/T2</sup> of each tissue at 1.5 T, with TR = 4000 ms and TE = 100 ms; the tissue values are Gach’s. A scanner shows the magnitude of the complex image it computes; so does this page.</p>`
		},
		{
			id: 'slice',
			chapter: 'encode',
			title: 'A pulse in a gradient picks one slice',
			scene: 'sequence',
			hints: { mode: 'slice' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'gz',
					label: 'Slice gradient',
					min: 5,
					max: 40,
					step: 1,
					default: 10,
					unit: ' mT/m'
				},
				{
					type: 'range',
					id: 'offset',
					label: 'Pulse frequency',
					min: -4,
					max: 4,
					step: 0.5,
					default: 0,
					format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} kHz`
				}
			],
			body: `
<p>A scan starts by choosing a slice. A gradient <b>G<sub>z</sub></b> is switched on along the body, so the Larmor frequency now changes with height: at 10 mT/m, by 42.58 MHz/T × 0.01 T/m = 426 kHz per metre, or 0.43 kHz per millimetre.</p>
<p>Then a radio pulse is sent, shaped so that it holds only a narrow band of frequencies: 4 ms long, it covers 1 kHz. Only the protons whose frequency falls inside that band are tipped over; above and below, the pulse is off-resonance and leaves them standing. The curve is computed from the <dfn data-def="The equations of motion of magnetisation: it precesses about the total field and relaxes back with T1 and T2.">Bloch equations</dfn>, step by step through the pulse.</p>
<p>So the slice is <strong>bandwidth ÷ (γ G)</strong> thick: 1 kHz ÷ 426 kHz/m = 2.3 mm. A steeper gradient makes it thinner; changing the pulse’s frequency moves it, without moving the patient.</p>`,
			notes: `<p>The pulse is a sinc with four lobes’ worth of bandwidth (time–bandwidth product 4), smoothed by a Hamming window, scaled to tip the centre of the slice by 90°. For small tips the slice profile is the Fourier transform of the pulse’s shape; at 90° that is still nearly true, which is why the profile comes out close to a rectangle. After the pulse, a short negative gradient lobe (drawn after the pulse on G<sub>z</sub>) undoes the twist the slice gathered across its thickness, so all its spins start in phase. Scanners select a slice this way in 2-D imaging; 3-D scans excite a thick slab and encode the third direction with phase too.</p>`
		},
		{
			id: 'phase',
			chapter: 'encode',
			title: 'Phase encoding: each row its own twist',
			scene: 'sequence',
			hints: { mode: 'phase' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'line3',
					label: 'Phase-encoding step',
					min: -8,
					max: 8,
					step: 1,
					default: 3,
					format: (v) => `${v} turns across the field of view`
				}
			],
			body: `
<p>Inside the slice every spin now precesses at the same frequency. A short pulse of a second gradient, <b>G<sub>y</sub></b>, makes the spins lower down precess slightly faster for a millisecond. When it stops, they are all back at the same frequency, but each row has been left <strong>twisted by its own angle</strong>, proportional to its height.</p>
<p>The arrows on the right of the head show the twist row by row; the stripes over the head show the same thing as a wave. With this step’s gradient, the twist turns 3 times over the 24 cm field of view. The coil adds up all the spins: it measures how much the slice resembles that wave, which is one value of its Fourier transform at k<sub>y</sub> = 3 / 24 cm.</p>
<p>Each repetition of the sequence uses a different step of G<sub>y</sub>: 128 of them, from −64 to +63 turns, about 0.1 mT/m·ms of gradient area apart. Beyond ±8 turns the twist is too fine to draw as arrows, but the scanner records it all the same.</p>`,
			notes: `<p>The number of turns per centimetre is k<sub>y</sub> = γ ∫ G<sub>y</sub> dt. Steps of Δk = 1/FOV make the outermost row of the field of view turn once more than the row at the opposite edge with each step, and the image is sampled every FOV/128 = 1.9 mm. Phase is measured only modulo a whole turn: that is why, later, a field of view smaller than the head wraps round along this direction.</p>`
		},
		{
			id: 'readout',
			chapter: 'encode',
			title: 'The readout records one line of k-space',
			scene: 'sequence',
			hints: { mode: 'readout' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'line4',
					label: 'Phase-encoding step',
					min: -8,
					max: 8,
					step: 1,
					default: 0,
					format: (v) => `${v} turns`
				}
			],
			body: `
<p>Now the third gradient, <b>G<sub>x</sub></b>, the <dfn data-def="The gradient switched on while the coil's signal is recorded; it makes frequency vary across the slice, left to right here.">readout gradient</dfn>. First a negative lobe winds the spins 64 turns one way across the slice. Then the gradient reverses and stays on while the signal is sampled 128 times: the twist unwinds, passes through zero, where every spin is in phase and the signal peaks, and winds up 63 turns the other way.</p>
<p>At each sample the spins form a wave across the slice, now tilted, and the coil records how much the slice holds of it. So the 128 samples of one echo are <strong>one horizontal line of k-space</strong>, at the k<sub>y</sub> the phase step chose. The dot on the small k-space map sweeps along that line.</p>
<p>The peak in the middle of the signal is an echo made by the gradients: a <dfn data-def="An echo formed by reversing a gradient: the dephasing it caused is undone, so the spins come back into phase at the centre of the readout.">gradient echo</dfn>. Change the phase step and the echo shrinks: the waves away from k<sub>y</sub> = 0 match less of the head.</p>`,
			notes: `<p>The signal is complex: the coil measures two components, 90° apart (in-phase and quadrature), drawn here as two curves. With 128 samples over a 24 cm field of view, each sample is 1/24 cm⁻¹ further along k<sub>x</sub>. With a receiver bandwidth of ±12.5 kHz (one sample every 40 µs) that takes a readout gradient of 1 / (γ × 40 µs × 0.24 m) ≈ 2.4 mT/m, and the line takes 5.1 ms to record.</p>`
		},
		// ---------------------------------------------------------------- echo
		{
			id: 'echo',
			chapter: 'echo',
			title: 'Spins fan out, and a 180° pulse brings them back',
			scene: 'echo',
			duration: 25,
			controls: [{ type: 'toggle', id: 'refocus', label: 'Send the 180° pulse', default: true }],
			body: `
<p>Seen from above, in a frame turning at the scanner’s frequency, here are twelve spins of one tiny piece of tissue just after the slice pulse tipped them. They should all point the same way. But the field is never perfectly even, even inside a millimetre: some spins precess a few hertz fast, some slow, so they <strong>fan out</strong>, and the coil’s signal (the length of their average, on the right) collapses within milliseconds. That fast decay is called T2*.</p>
<p>At 25 ms a <strong>180° pulse</strong> flips the whole fan over. The spins that were ahead are now behind, by exactly as much, and they keep their speeds, so at 50 ms they all meet again: an <dfn data-def="A signal that reappears after it has decayed, because the dephasing that destroyed it is reversed. Erwin Hahn found the spin echo in 1950.">echo</dfn>. Switch the pulse off and the signal never comes back.</p>
<p>Only the true T2 loss, from protons disturbing each other at random, cannot be undone: the echo is e<sup>−TE/T2</sup> high, 0.61 for grey matter’s 100 ms at TE = 50 ms. Measuring at the echo is what makes a T2-weighted image.</p>`,
			notes: `<p>The spins’ offsets follow a Lorentzian spread of half-width 20 Hz, which makes the signal without the 180° pulse decay as e<sup>−t/T2*</sup> with 1/T2* = 1/T2 + 2π × 20 Hz, so T2* = 7.4 ms. Their motion is the exact solution of the Bloch equations between pulses (precession plus T1 and T2 relaxation), and the pulses are treated as instantaneous rotations. The 180° pulse turns them about the y axis, so the echo forms where the spins started (the Carr–Purcell–Meiboom–Gill choice). Within one voxel the field varies because of the magnet and the tissue’s own magnetism, strongest where air meets tissue, as near the sinuses.</p>`
		},
		// ---------------------------------------------------------------- fill
		{
			id: 'fill',
			chapter: 'fill',
			title: 'k-space fills line by line',
			scene: 'kspace',
			hints: { mode: 'fill' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'lines',
					label: 'Lines recorded',
					min: 0,
					max: 128,
					step: 1,
					default: 40,
					disabled: (p) => p.fillPlay === true
				},
				{
					type: 'toggle',
					id: 'fillPlay',
					label: 'Play the scan',
					default: false,
					help: 'Records 8 lines a second, 32 times faster than the real T2-weighted scan, which records one every 4 s.'
				},
				{
					type: 'select',
					id: 'order',
					label: 'Order of the lines',
					default: 'linear',
					options: [
						{ value: 'linear', label: 'Top to bottom' },
						{ value: 'centre', label: 'Centre first' }
					]
				}
			],
			body: `
<p>Each repetition of the sequence records one line; the image on the right is the inverse transform of what has been recorded so far, with zeros for the rest.</p>
<p>Top to bottom, the first lines hold the fine detail of the up-and-down direction, and the picture is a faint ghost of edges. It only appears when the scan reaches the <strong>middle lines</strong>, and the remaining lines then sharpen it. Choose <em>centre first</em> and a blurred head appears almost at once.</p>
<p>The lines are slow to collect. The T2-weighted scan waits TR = 4 s between repetitions for the tissues to recover, so 128 lines take 128 × 4 s = 8.5 minutes. Most of the time of an MRI scan is spent waiting for protons.</p>`,
			notes: `<p>Real T2-weighted scans are faster because they record several lines per repetition: a turbo (fast) spin-echo sequence refocuses the spins again and again after one slice pulse, with a different phase step before each echo, so an echo train of 16 cuts the scan to about half a minute. The echoes come at different times and so have different T2 weighting: the image takes the contrast of the echoes placed at the centre of k-space (the “effective TE”), which the last chapter shows why.</p>`
		},
		{
			id: 'point',
			chapter: 'fill',
			title: 'One point of k-space is a wave over the whole image',
			scene: 'kspace',
			hints: { mode: 'point' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'kx',
					label: 'Point: turns left to right',
					min: -24,
					max: 24,
					step: 1,
					default: 6,
					format: (v) => `${v} turns`
				},
				{
					type: 'range',
					id: 'ky',
					label: 'Point: turns top to bottom',
					min: -24,
					max: 24,
					step: 1,
					default: 3,
					format: (v) => `${v} turns`
				},
				{
					type: 'toggle',
					id: 'spike',
					label: 'Add it to the scan as a glitch',
					default: false
				}
			],
			body: `
<p>It is tempting to think of k-space as a scrambled picture, one point per pixel. It is not. Keep a <strong>single sample</strong> and transform it back: the result is a striped wave that covers the whole field of view, with every pixel equally bright in magnitude. Drag the point: further from the centre, the stripes are finer; its direction turns them.</p>
<p>The image is the sum of 16,384 such waves, each weighted by its sample. That is why changing one sample never makes a hole in the image: it changes the whole image a little.</p>
<p>Switch on the glitch: one sample recorded far too strong, as happens when a spark of static reaches the receiver. The whole image gets covered in stripes, a well-known <dfn data-def="Stripes across the whole image from one or a few corrupted k-space samples, often caused by electrostatic discharges in the scanner room. Also called a herringbone or corduroy artefact.">spike artefact</dfn>, and the stripes say where in k-space the bad sample sits.</p>`,
			notes: `<p>With one sample of value 1 at (k<sub>x</sub>, k<sub>y</sub>), the reconstruction is e<sup>2πi(k<sub>x</sub>x + k<sub>y</sub>y)</sup> / (FOV<sub>x</sub> FOV<sub>y</sub>): the stripes drawn are its real part. The glitch sets that sample as strong as the centre sample, far stronger than any real sample away from the centre.</p>`
		},
		// ---------------------------------------------------------------- edit
		{
			id: 'centre',
			chapter: 'edit',
			title: 'Only the centre: the contrast, blurred',
			scene: 'kspace',
			hints: { mode: 'centre' },
			duration: 20,
			controls: [radius('rc', 0.1, 'Keep the centre out to')],
			body: `
<p>Throw away everything outside a small disc around the centre of k-space. Those samples were the long waves, the slow changes across the slice. What is left is a <strong>blurred image with the right brightness</strong>: fluid still bright, white matter still darker than grey.</p>
<p>The centre holds most of the signal: the sample at the very centre is the sum of the whole slice. Keep 10% of the way out (under 1% of the samples) and the large regions keep their brightness; the ripples near the edges are <a href="../fourier-transform/#gibbs">Gibbs ringing</a>, the price of a sharp cut-off.</p>`,
			notes: `<p>Scanners make use of it. In dynamic scans, such as following a contrast injection, “keyhole” imaging records only the centre of k-space again and again and borrows the edges from one full scan, because the changes that matter are changes in brightness. Real reconstructions often taper the edges of k-space with a smooth window to trade a little sharpness for less ringing.</p>`
		},
		{
			id: 'edges',
			chapter: 'edit',
			title: 'Only the edges: the outlines',
			scene: 'kspace',
			hints: { mode: 'edges' },
			duration: 20,
			controls: [radius('re', 0.1, 'Remove the centre out to')],
			body: `
<p>Now do the opposite: remove the centre and keep the rest. The large uniform regions go dark, because their brightness lived in the centre, and what remains are the <strong>edges</strong>: the outline of the skull, the ventricles, the lesions. The fine waves of the outer k-space are what make sharp boundaries.</p>
<p>The image is brightened to be seen at all: the edges of k-space carry only a small share of the signal.</p>`,
			notes: `<p>Removing the centre is a high-pass filter, akin to the edge-detecting filters of image processing. The outer edge of the sampled k-space sets the resolution: samples up to ±64/24 cm⁻¹ give pixels of 1.9 mm, and a scan of 256 lines over the same field of view would need twice the time for pixels of 0.94 mm.</p>`
		},
		{
			id: 'contrast',
			chapter: 'edit',
			title: 'The centre sets the contrast',
			scene: 'kspace',
			hints: { mode: 'contrast' },
			duration: 25,
			controls: [
				{
					type: 'select',
					id: 'centreFrom',
					label: 'Centre of k-space from',
					default: 't2',
					options: [
						{ value: 't2', label: 'the T2-weighted scan' },
						{ value: 't1', label: 'the T1-weighted scan' }
					]
				},
				radius('rx', 0.1, 'Centre out to')
			],
			body: `
<p>Here are two scans of the same head: a <strong>T1-weighted</strong> one (TR = 500 ms, TE = 15 ms), where fluid is dark and the scalp’s fat bright, and the <strong>T2-weighted</strong> one, where fluid is bright. Take the centre of k-space from one and the edges from the other.</p>
<p>The image has the contrast of whichever scan gave the centre, and the edges hardly matter: with the centre from the T2 scan the ventricles are bright, with the centre from the T1 scan they are dark. The readouts below give the fluid’s brightness in each.</p>
<p>This is why the lines recorded near the centre of k-space decide what an image shows. A turbo spin-echo scan that records the centre lines at its 100 ms echo looks T2-weighted, whatever the echo times of the other lines.</p>`,
			notes: `<p>The two weightings come from the spin-echo signal M₀ (1 − e<sup>−TR/T1</sup>) e<sup>−TE/T2</sup> with each tissue’s T1, T2 and M₀ from Gach, Tanase and Boada’s MRI version of the Shepp–Logan head at 1.5 T. The page <a href="../medical-imaging/#relaxation">Medical imaging</a> shows how TR and TE trade T1 against T2. Where the two scans’ edges disagree (the scalp is bright in one and dim in the other), mixing them leaves a little ringing at the boundaries.</p>`
		},
		{
			id: 'skip',
			chapter: 'edit',
			title: 'Skip lines, and the image folds',
			scene: 'kspace',
			hints: { mode: 'skip' },
			duration: 25,
			controls: [
				{
					type: 'select',
					id: 'every',
					label: 'Record',
					default: '2',
					options: [
						{ value: '1', label: 'every line' },
						{ value: '2', label: 'every 2nd line' },
						{ value: '3', label: 'every 3rd line' },
						{ value: '4', label: 'every 4th line' }
					]
				}
			],
			body: `
<p>To scan twice as fast, record every other line. The k-space still spans the same range, so the image stays as sharp; but its lines are now twice as far apart, Δk = 2 / 24 cm, and an inverse transform of lines that far apart repeats every 12 cm.</p>
<p>So the head <strong>folds onto itself</strong>: two copies, shifted by half the field of view, laid over each other, each half as bright. Skip more and there are more copies. No sample was lost from any one place: every pixel is changed, as the pitfall of thinking of k-space as pixels would never predict.</p>`,
			notes: `<p>Modern scanners do skip lines on purpose. With several receiving coils, each sees the folded copies with its own sensitivity, and “parallel imaging” (SENSE, GRAPPA) uses those differences to unfold them, cutting scan time by 2 to 4 at some cost in noise. Compressed sensing skips lines at random instead, so the fold becomes a noise-like haze that a reconstruction can remove.</p>`
		},
		{
			id: 'fov',
			chapter: 'edit',
			title: 'A field of view too small: the head wraps round',
			scene: 'kspace',
			hints: { mode: 'fov' },
			duration: 25,
			controls: [
				{
					type: 'range',
					id: 'fovY',
					label: 'Field of view, up–down',
					min: 12,
					max: 24,
					step: 1,
					default: 16,
					unit: ' cm'
				}
			],
			body: `
<p>Fewer lines also means a faster scan when the pixels stay the same size and the field of view shrinks: 16 cm needs 85 lines instead of 128. That works for anything that fits. But this head is 19 cm long.</p>
<p>What sticks out of the field of view does not disappear: the protons there are still tipped and still sing. Their phase twist is only known modulo a whole turn, so the scanner cannot tell a point 2 cm beyond the bottom edge from one 2 cm inside the top edge, and the overhanging scalp <strong>wraps round</strong> onto the opposite side. Shrink the field of view and more of the head wraps in.</p>
<p>This is the Nyquist limit of the <a href="../fourier-transform/">Fourier transform</a>, in space: samples Δk apart can only tell apart positions within 1/Δk.</p>`,
			notes: `<p>Wrap-around happens along the phase-encoding direction (up–down here). Along the readout direction scanners sample the signal twice as often as needed and filter it, which costs no extra time, so nothing wraps from left to right. Radiographers set the phase-encoding direction along the shorter side of the body part, or add “no phase wrap” oversampling, to avoid it.</p>`
		}
	]
};
