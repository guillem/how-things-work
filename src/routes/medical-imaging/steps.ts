import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------
// Built state that is not a slider lives in params too, written by the scenes:
//   probe — "x,y" (cm) of the CT-number probe on the Hounsfield step

/** What the beam crosses on the first step. */
const material: Control = {
	type: 'select',
	id: 'material',
	label: 'Material',
	default: 'soft',
	options: [
		{ value: 'soft', label: 'Soft tissue' },
		{ value: 'fat', label: 'Fat' },
		{ value: 'bone', label: 'Bone' },
		{ value: 'lung', label: 'Lung (full of air)' },
		{ value: 'water', label: 'Water' }
	]
};

const thickness: Control = {
	type: 'range',
	id: 'thickness',
	label: 'Thickness',
	min: 0,
	max: 20,
	step: 0.5,
	default: 6,
	unit: ' cm'
};

const energy: Control = {
	type: 'range',
	id: 'energy',
	label: 'Photon energy',
	min: 20,
	max: 150,
	step: 5,
	default: 60,
	unit: ' keV',
	help: 'A chest X-ray tube produces photons of up to about 120 keV; CT works on average near 60 keV.'
};

/** The slice the CT scanner looks at. */
const phantom: Control = {
	type: 'select',
	id: 'phantom',
	label: 'Object in the scanner',
	default: 'chest',
	options: [
		{ value: 'chest', label: 'Chest' },
		{ value: 'head', label: 'Shepp–Logan head' },
		{ value: 'point', label: 'A single dot' }
	]
};

/** Direction of the X-ray beam, degrees. */
const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Beam direction',
	min: 0,
	max: 359,
	step: 1,
	default: 30,
	unit: '°',
	help: 'Or drag the X-ray tube round the body (or focus it and use the arrow keys).'
};

/** How many directions the scanner records over half a turn. */
const angles: Control = {
	type: 'range',
	id: 'angles',
	label: 'Directions recorded',
	min: 1,
	max: 180,
	step: 1,
	default: 6,
	values: () => [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 90, 120, 180],
	help: 'Spread evenly over half a turn: the other half sees the same shadows mirrored.'
};

const filter: Control = {
	type: 'toggle',
	id: 'filter',
	label: 'Sharpen each shadow first (ramp filter)',
	default: true
};

/** Photons per detector reading, relative to the page's standard scan. */
const dose: Control = {
	type: 'range',
	id: 'dose',
	label: 'Dose (photons sent)',
	min: 0.01,
	max: 4,
	step: 0.01,
	default: 1,
	values: () => [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 4],
	format: (v) => `${v < 1 ? v.toFixed(2).replace(/0$/, '') : v.toFixed(0)} × standard`
};

/** Height of the CT slice in the body, cm from the middle (negative: towards the head). */
const slice: Control = {
	type: 'range',
	id: 'slice',
	label: 'Height of the slice',
	min: -18,
	max: 18,
	step: 0.5,
	default: 0,
	format: (v) =>
		v === 0 ? 'middle of the chest' : `${Math.abs(v)} cm ${v < 0 ? 'higher' : 'lower'}`,
	help: 'Or drag the line on the X-ray up and down.'
};

const frequency: Control = {
	type: 'range',
	id: 'frequency',
	label: 'Sound frequency',
	min: 2,
	max: 12,
	step: 0.5,
	default: 3.5,
	unit: ' MHz'
};

const gel: Control = {
	type: 'toggle',
	id: 'gel',
	label: 'Gel between probe and skin',
	default: true
};

const field: Control = {
	type: 'range',
	id: 'field',
	label: 'Magnetic field',
	min: 0.2,
	max: 7,
	step: 0.1,
	default: 1.5,
	unit: ' T',
	help: 'Hospital scanners: 1.5 T and 3 T; research scanners 7 T. The Earth’s field is about 0.00005 T.'
};

const gradient: Control = {
	type: 'range',
	id: 'gradient',
	label: 'Gradient',
	min: 0,
	max: 40,
	step: 1,
	default: 10,
	unit: ' mT/m',
	help: 'How much the field grows per metre from left to right. Clinical scanners reach about 40 mT/m.'
};

const tr: Control = {
	type: 'range',
	id: 'tr',
	label: 'Repetition time TR',
	min: 100,
	max: 5000,
	step: 50,
	default: 500,
	unit: ' ms'
};

const te: Control = {
	type: 'range',
	id: 'te',
	label: 'Echo time TE',
	min: 5,
	max: 200,
	step: 5,
	default: 15,
	unit: ' ms',
	help: 'Short TR and TE: T1-weighted. Long TR (≈ 4000 ms) and TE (≈ 100 ms): T2-weighted.'
};

// ---- the narrative --------------------------------------------------------------------

export const spec: ExplainerSpec = {
	slug: 'medical-imaging',
	title: 'Medical imaging',
	summary:
		'Send X-rays through tissue and bone, turn an X-ray tube round a body to record its shadow from every side, and watch a CT scanner compute the slice that explains all those shadows. Then see the same body with echoes of sound and with spinning protons in a magnet.',
	chapters: [
		{ id: 'shadows', title: 'X-rays make shadows' },
		{ id: 'ct', title: 'Computed tomography: many shadows, one slice' },
		{ id: 'compare', title: 'A plain X-ray against a CT slice' },
		{ id: 'other', title: 'Without X-rays: sound and magnets' }
	],
	steps: [
		// ------------------------------------------------------------------ shadows
		{
			id: 'attenuation',
			chapter: 'shadows',
			title: 'X-rays fade as they cross the body',
			scene: 'beam',
			duration: 18,
			controls: [material, thickness, energy],
			body: `
<p>X-rays are light whose photons carry tens of thousands of times more energy than visible light: tens of <dfn data-def="Kilo-electronvolt: a unit of energy for single particles. A photon of visible light carries about 2 eV; a 60 keV X-ray photon carries 60,000 eV.">keV</dfn>. Most of them pass straight through the body. A few hit an electron and are absorbed or knocked aside, and are gone from the beam.</p>
<p>Each photon's chance of being removed is the same in every millimetre, so the beam fades like a radioactive sample decays (see <em>Radioactivity and half-life</em>): every <dfn data-def="The thickness of a material that lets half of the photons through.">half-value layer</dfn> lets half through. This is the <dfn data-def="The law of attenuation: the intensity falls exponentially with the thickness crossed, I = I₀·e^(−μx).">Beer–Lambert law</dfn>:</p>
<p class="formula"><strong>I = I₀ · e<sup>−μx</sup></strong></p>
<p>where <i>x</i> is the thickness and <i>μ</i>, the <dfn data-def="The fraction of the photons removed per centimetre (strictly, the rate of the exponential fall), written μ, in 1/cm.">attenuation coefficient</dfn>, says how strongly the material stops X-rays. Change the material, the thickness and the photon energy. Bone stops far more than soft tissue, because it is denser and has calcium, whose larger atoms absorb low-energy X-rays strongly. Air-filled lung stops very little.</p>`,
			notes: `<p>The values of μ come from the NIST tables of X-ray mass attenuation coefficients (Hubbell and Seltzer) for the ICRU-44 tissue compositions, multiplied by each tissue's density. Below about 30 keV the photoelectric effect dominates and grows roughly with the cube of the atomic number, which is why bone stands out so much at low energies; at higher energies Compton scattering takes over, which depends mostly on density.</p><p>Real X-ray tubes produce a spread of energies. This page uses one energy at a time, which leaves out <dfn data-def="The low-energy photons of a beam are absorbed first, so the beam that is left is 'harder' (more penetrating) than the one that went in.">beam hardening</dfn>.</p>`
		},
		{
			id: 'plain',
			chapter: 'shadows',
			title: 'A plain X-ray is a shadow',
			scene: 'radiograph',
			hints: { phase: 'plain' },
			duration: 16,
			body: `
<p>An X-ray picture puts a detector behind the body. Where the rays crossed a lot of bone or tissue few photons arrive, and the picture is bright; where they crossed air-filled lung many arrive, and it is dark. (By tradition, X-rays are shown this way round, like the old films.)</p>
<p>Each point of the picture records the total of <i>μ</i> × length along its ray: <strong>everything the ray crossed, added up</strong>. The spine, the heart, both lungs and the muscle in front and behind are piled on top of each other. A plain X-ray cannot tell how deep anything is, and two tissues whose μ differ by a few percent look the same.</p>
<p>This chest is a simple model: a fat layer, muscle, two lungs, a heart, the spine and the breastbone, and lower down a liver. It hides two things: a small lump in one lung, and a pocket of fluid in the liver. Can you see them?</p>`,
			notes: `<p>The picture is the real line integral through the model body: each part is an ellipsoid or an elliptic cylinder of one material, with μ at 60 keV. A real chest X-ray costs about <strong>0.1 mSv</strong> of radiation dose, as much as 10 days of natural background radiation (RadiologyInfo.org).</p>`
		},
		// ------------------------------------------------------------------ CT
		{
			id: 'rotate',
			chapter: 'ct',
			title: 'Turn the X-ray tube round the body',
			scene: 'ct',
			hints: { phase: 'rotate' },
			duration: 18,
			controls: [angle, phantom],
			body: `
<p>A CT (<dfn data-def="Computed tomography: from Greek tomos, a slice. A scanner that computes cross-sections of the body from many X-ray shadows.">computed tomography</dfn>) scanner looks at one thin slice of the body at a time. Its X-ray tube shines a beam across the slice, and a row of detectors on the other side records the shadow: a single line of numbers, one per ray.</p>
<p><strong>Drag the X-ray tube round the body.</strong> From each direction the shadow is different: from the front, the spine and breastbone line up and make one tall peak; from the side the two lungs overlap and the dip is deep. The height of the shadow at each detector is the total μ × length along that ray, worked out from the photons that arrive: <i>p</i> = ln(<i>I</i>₀/<i>I</i>).</p>
<p>No single shadow says where anything is along its rays. But each one is a different clue.</p>`,
			notes: `<p>This scanner sends parallel rays and turns step by step, like the first CT scanners. Modern scanners send a fan of rays from a tube that spins round the body two or three times a second, with hundreds of rows of detectors, but the mathematics is the same.</p>`
		},
		{
			id: 'sinogram',
			chapter: 'ct',
			title: 'Record a shadow at every angle',
			scene: 'ct',
			hints: { phase: 'sinogram' },
			duration: 20,
			controls: [phantom],
			body: `
<p>Now the scanner turns by itself and records a shadow every degree. Each shadow becomes one row of a picture, the <dfn data-def="All the shadows of a slice stacked as rows, one per angle. A single point traces a sine wave across it, hence the name.">sinogram</dfn>, with brightness for height.</p>
<p>Half a turn is enough: from the opposite side a ray crosses exactly the same tissue, so its shadow is the same, mirrored.</p>
<p>Pick <em>A single dot</em>: as the scanner turns, the dot's shadow slides back and forth across the detector, and in the sinogram it draws a <strong>sine wave</strong>. Every point of the slice draws its own sine wave, with a size set by how far it is from the centre and a timing set by its direction. The sinogram is everything the scanner measures. Nowhere in it is there a picture of the slice.</p>`
		},
		{
			id: 'smear',
			chapter: 'ct',
			title: 'Back-projection: smear each shadow back',
			scene: 'ct',
			hints: { phase: 'smear' },
			duration: 22,
			controls: [phantom],
			body: `
<p>How do we get a slice back from its shadows? The simplest guess: since a ray doesn't say where along it the tissue was, spread its value evenly back along the whole ray. Do it for every ray of a shadow and the shadow is smeared back across the image, in the direction it came from. This is <dfn data-def="Spreading each measured shadow back across the image along the rays it was measured on, and adding the results.">back-projection</dfn>.</p>
<p>Watch the image build up as the shadows are added one by one. Where the smears of many directions cross, they pile up, and the lungs, the heart and the spine appear.</p>
<p>But the result is <strong>blurry</strong>. Pick <em>A single dot</em>: every smear crosses the dot, but each one also leaves a streak across the whole image. Together they make a halo that fades only slowly with distance (as 1/<i>r</i>). Every point of the slice gets the same halo, so all edges are washed out.</p>`
		},
		{
			id: 'filter',
			chapter: 'ct',
			title: 'The filter that makes it sharp',
			scene: 'ct',
			hints: { phase: 'filter' },
			duration: 22,
			controls: [filter, phantom],
			body: `
<p>The fix is to change each shadow <em>before</em> smearing it back. The <dfn data-def="A filter that multiplies each frequency of a signal by the frequency itself: it removes the average and boosts fine detail.">ramp filter</dfn> sharpens it: it boosts the fine detail and adds a small dip on each side of every peak. Look at the filtered shadow on the stage: it goes <strong>negative</strong> next to every edge.</p>
<p>Those negative dips are exactly what is needed. When the filtered shadows are smeared back, the dips of one direction cancel the halo the others leave, and only the point itself remains. This is <dfn data-def="The standard CT reconstruction: filter every shadow with the ramp filter, then back-project.">filtered back-projection</dfn>, the method CT scanners used for decades.</p>
<p>Toggle the filter and compare the reading under the image: how far the computed slice is from the true one.</p>`,
			notes: `<p>In terms of <em>The Fourier transform</em>: take the spectrum of each shadow, multiply the bar at frequency <i>k</i> by |<i>k</i>|, and transform back. A low-pass filter (the <em>edit</em> step there) turns high frequencies down and smooths; the ramp does the opposite, because back-projection itself over-weights low frequencies by exactly 1/|<i>k</i>|. This page does it as a convolution with the Ram–Lak kernel (Kak and Slaney, ch. 3).</p><p>Why it works: the <dfn data-def="The 1-D Fourier transform of a shadow at angle θ equals the 2-D Fourier transform of the slice along a line through the centre at the same angle.">Fourier slice theorem</dfn>. Each shadow gives one line through the centre of the slice's 2-D spectrum; many angles fill the spectrum like spokes of a wheel. Spokes crowd together near the centre, and the ramp evens out that crowding.</p>`
		},
		{
			id: 'angles',
			chapter: 'ct',
			title: 'How many shadows are enough?',
			scene: 'ct',
			hints: { phase: 'angles' },
			duration: 20,
			controls: [angles, filter, phantom],
			body: `
<p>Change the number of directions. With one shadow there is only one smear. With a few the slice is a pattern of <strong>streaks</strong> that reach right across the image. As more directions are added the streaks get finer and cancel, and the slice comes into focus.</p>
<p>The image here is 128 × 128 pixels across 36 cm, about 3 mm each. Roughly speaking it needs about as many directions as pixels across, a little over a hundred, before the streaks stop being visible; real scanners record about a thousand per turn for their finer pixels.</p>
<p>Try the <em>Shepp–Logan head</em>: the test slice everyone uses, from 1974. Its small ellipses differ from the brain around them by only 1–2%, but with enough angles and the filter they all appear.</p>`,
			notes: `<p>L. A. Shepp and B. F. Logan, “The Fourier reconstruction of a head section”, <i>IEEE Transactions on Nuclear Science</i> 21 (1974). Its ten ellipses have exact shadows, so a computer can measure them perfectly and any blur in the result comes from the reconstruction. This page uses the original values, not the high-contrast “modified” version many programs default to; the grey scale is narrowed to show the 1% differences, so the skull (2.0) is clipped to white.</p>`
		},
		{
			id: 'hounsfield',
			chapter: 'ct',
			title: 'Every pixel is a number',
			scene: 'ct',
			hints: { phase: 'hounsfield' },
			duration: 18,
			body: `
<p>A CT slice is not just a picture: every pixel is a measurement of μ in that small piece of tissue. Scanners report it as a <dfn data-def="The CT number: 1000 × (μ − μ_water) / μ_water. Water is 0 HU and air about −1000 HU.">Hounsfield unit</dfn> (HU), measured from water:</p>
<p class="formula"><strong>HU = 1000 × (μ − μ<sub>water</sub>) / μ<sub>water</sub></strong></p>
<p>Water is 0 and air −1000. <strong>Drag the probe</strong> over the slice. It reads the reconstructed value, not the model's: muscle and the heart about +50, fat about −90, the inflated lung about −600 in this model, bone well over +1000. The lump in the left lung, under 2 cm across, stands out clearly as tissue where there should be air.</p>
<p>Soft tissues differ by only tens of HU, a few percent in μ: invisible in a plain X-ray, where they pile up with everything else, but measurable here, because each pixel is separated from what lies in front and behind.</p>`,
			notes: `<p>Named after Godfrey Hounsfield, who built the first clinical CT scanner at the EMI laboratories in England; its first patient was scanned in London in 1971. He shared the 1979 Nobel Prize in Physiology or Medicine with Allan Cormack, who had worked out the mathematics independently.</p><p>The CT numbers here are computed from the NIST coefficients at one energy (60 keV). The model's lung uses an average density of inflated lung (0.39 g/cm³, IT'IS database), higher than healthy lung at full breath, which real scanners read nearer −850 HU. Real scanners also calibrate for their spread of energies, so their numbers for bone in particular differ.</p>`
		},
		{
			id: 'dose',
			chapter: 'ct',
			title: 'Fewer photons, more noise',
			scene: 'ct',
			hints: { phase: 'dose' },
			duration: 18,
			controls: [dose],
			body: `
<p>Every reading is a count of photons, and counts of random events are never exact: if 10,000 photons are expected, about 100 more or fewer arrive (the square root, as in <em>Radioactivity and half-life</em>). The scanner turns each count into a shadow height, so every shadow is slightly noisy, and the noise is smeared into the slice.</p>
<p>Lower the dose: fewer photons, grainier slices. Quarter the dose and the noise doubles: <strong>noise grows as 1/√dose</strong>. Raise it and the slice gets cleaner, at the price of more radiation.</p>
<p>Typical effective doses (RadiologyInfo.org, for an average adult): a chest X-ray <strong>0.1 mSv</strong>, a CT of the head <strong>1.6 mSv</strong>, a low-dose lung-screening CT <strong>1.5 mSv</strong>, a chest CT <strong>6.1 mSv</strong>, a CT of the abdomen and pelvis <strong>7.7 mSv</strong>. For comparison, natural background radiation gives about <strong>3 mSv a year</strong>. A chest CT equals about two years of it, and 60 chest X-rays.</p>`,
			notes: `<p>The <dfn data-def="The millisievert: a unit of effective dose, which weights the energy absorbed by each organ by how sensitive it is to radiation.">millisievert</dfn> (mSv) estimates the risk to the whole body from a dose, so that a CT of one part of the body can be compared with background radiation. RadiologyInfo stresses these are rough typical values: the real dose depends on the patient's size and the scanner settings. Scanners choose the dose that makes the image just good enough for the question asked, and lung-cancer screening uses a quarter of a standard chest CT's dose for that reason.</p><p>On this page “standard” means about 100,000 photons per reading; the scanner's real numbers differ, but the 1/√dose rule is the same.</p>`
		},
		// ------------------------------------------------------------------ compare
		{
			id: 'compare',
			chapter: 'compare',
			title: 'The same body, X-ray and CT',
			scene: 'radiograph',
			hints: { phase: 'compare' },
			duration: 20,
			controls: [slice],
			body: `
<p>Here is the plain X-ray of the body again, with the CT slice at the height of the line. <strong>Drag the line</strong> up and down the body: the scanner computes the slice at each height from its own 180 shadows.</p>
<p>The lump in the left lung, faint in the X-ray, is a bright spot in its slice: the slice shows exactly where it is, front to back. Go lower, to the liver: the pocket of fluid is completely invisible in the X-ray, because it changes the ray's total by less than 1%, yet in the CT slice it is a clear dark patch, about 55 HU below the liver around it.</p>
<p>The CT scanner never saw either of them directly. It measured shadows, the same kind of shadow as the X-ray, from many directions, and <strong>computed the slice that explains them all</strong>.</p>`,
			notes: `<p>A CT exam stacks hundreds of slices, so it can also be shown from the side or in 3-D. The price is dose: dozens of times a plain X-ray. Doctors often start with an X-ray and go to CT when the X-ray cannot answer the question.</p>`
		},
		// ------------------------------------------------------------------ other
		{
			id: 'ultrasound',
			chapter: 'other',
			title: 'Ultrasound: timing echoes',
			scene: 'ultrasound',
			duration: 20,
			controls: [frequency, gel],
			body: `
<p>Ultrasound uses sound far too high to hear, millions of vibrations per second (see <em>Waves, sound and interference</em>). The probe sends a short pulse into the body and listens. Wherever two tissues meet, a little of the sound bounces back: an echo.</p>
<p>The scanner turns the <strong>time</strong> of each echo into a depth. It assumes sound travels at <strong>1540 m/s</strong> in the body, so an echo that returns after 13 μs came from 1 cm deep (there and back). How much bounces back depends on the tissues' <dfn data-def="Density × speed of sound. Where it changes, part of the sound is reflected: the bigger the jump, the stronger the echo.">acoustic impedance</dfn>, density × speed of sound: under 2% at fat and muscle, a third at bone, and almost all of it at air. That's why the probe needs <strong>gel</strong>: switch it off and the sound never gets in.</p>
<p>Raise the frequency: the pulse gets shorter, so close echoes are told apart, but the body absorbs high-pitched sound faster and the deep echoes fade. No ionising radiation is involved.</p>`,
			notes: `<p>Densities, speeds of sound and attenuation per MHz come from the IT'IS tissue database. Fat carries sound at about 1440–1480 m/s and muscle at 1590 m/s, so the scanner's assumed 1540 m/s puts echoes a few percent too deep or shallow: the depths on the trace are the scanner's. An ultrasound picture sweeps the beam across hundreds of lines like this one and draws the echoes as brightness; the scanner also boosts later echoes to make up for the fading with depth.</p>`
		},
		{
			id: 'larmor',
			chapter: 'other',
			title: 'MRI: protons spinning in a magnet',
			scene: 'mri',
			hints: { phase: 'larmor' },
			duration: 18,
			controls: [field],
			body: `
<p>Most of the body is water, and every water molecule has two hydrogen nuclei: protons. A proton is a tiny magnet. In the strong field of an MRI scanner its axis <dfn data-def="Turns round the direction of the field like a tilted spinning top round the vertical.">precesses</dfn> round the field at a rate fixed by physics, the <dfn data-def="The rate at which a nucleus precesses in a magnetic field: for hydrogen, 42.58 MHz per tesla.">Larmor frequency</dfn>:</p>
<p class="formula"><strong>f = 42.58 MHz per tesla × B</strong></p>
<p>Change the field. At 1.5 T the protons turn about 64 million times a second; at 3 T, 128 million: radio frequencies, like FM radio. A radio pulse at exactly that frequency tips the protons over, and as they precess they broadcast a faint radio signal back, which coils pick up. A pulse at any other frequency does nothing: it is <strong>resonance</strong>, the R of magnetic resonance imaging.</p>`,
			notes: `<p>The value is the CODATA proton gyromagnetic ratio, 42.577 MHz/T. The animation is slowed down more than a million times, and the arrows stand for the average of trillions of protons: individually, protons are quantum objects, and only about 5 in a million more of them line up with a 1.5 T field than against it.</p>`
		},
		{
			id: 'gradient',
			chapter: 'other',
			title: 'Where is the signal from? Ask the Fourier transform',
			scene: 'mri',
			hints: { phase: 'gradient' },
			duration: 20,
			controls: [gradient],
			body: `
<p>The signal from the whole body arrives at once. To tell where it came from, the scanner adds a <dfn data-def="A small extra field that grows steadily across the scanner, so the total field, and the Larmor frequency, depend on position.">gradient</dfn>: a field that grows from left to right. Now protons on the right precess slightly faster than those on the left: every position has its own frequency.</p>
<p>The coil receives the sum of all those frequencies, which beat against each other. Its <strong>Fourier transform</strong> (see <em>The Fourier transform</em>) takes the sum apart: the strength at each frequency is the amount of water at each position. The spectrum on the stage is the profile of the three tubes of water.</p>
<p>That profile is a shadow, just like a CT shadow, but of water instead of X-ray absorption. Turn the gradient in many directions and the slice can be computed from these profiles, exactly as in CT. The first MRI images were made this way, in 1973.</p>`,
			notes: `<p>At 10 mT/m the frequency changes by 42.58 MHz/T × 0.01 T/m = 426 Hz per millimetre. A stronger gradient spreads the same body over more frequencies, so the signal has to be sampled faster. Today's scanners skip the shadows: with gradients in two directions they fill the 2-D spectrum of the slice row by row (“k-space”) and take one 2-D inverse Fourier transform.</p><p>Paul Lauterbur's first image (<i>Nature</i>, 1973) showed two thin tubes of ordinary water inside heavy water (which gives no signal at that frequency), computed from four such profiles 45° apart; he and Peter Mansfield shared the 2003 Nobel Prize in Physiology or Medicine.</p>`
		},
		{
			id: 'relaxation',
			chapter: 'other',
			title: 'T1 and T2: why tissues look different',
			scene: 'mri',
			hints: { phase: 'relax' },
			duration: 20,
			controls: [tr, te],
			body: `
<p>After the radio pulse the protons relax in two ways. Their signal fades as they get out of step with each other, with a time constant <dfn data-def="Transverse relaxation time: how fast the signal fades as the protons get out of step.">T2</dfn>. And they slowly realign with the field, ready for the next pulse, with a time constant <dfn data-def="Longitudinal relaxation time: how fast the protons realign with the field after a pulse.">T1</dfn>. Both depend on the tissue.</p>
<p>The scanner chooses when to repeat the pulse (<strong>TR</strong>) and when to listen (<strong>TE</strong>). With short TR and TE, tissues that realign fast (short T1, like fat) are brightest: a <strong>T1-weighted</strong> image. With long TR and TE, tissues whose signal lasts (long T2, like fluids and blood that is standing still) are brightest: <strong>T2-weighted</strong>. The same body, a different picture, and no ionising radiation at all.</p>`,
			notes: `<p>The brightness is the spin-echo signal (1 − e<sup>−TR/T1</sup>) · e<sup>−TE/T2</sup>, with T1 and T2 at 1.5 T from the IT'IS tissue database (averages of published measurements). The page treats every tissue as having the same density of protons, which real tissues don't quite have; a third kind of image, “proton-density weighted” (long TR, short TE), shows that difference. Blood is treated here as standing still: flowing blood often looks dark on spin-echo images (a “flow void”), because it has left the slice before the echo is read.</p>`
		}
	]
};
