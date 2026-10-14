import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { distanceText } from './format';

// ---- controls ------------------------------------------------------------------------

const keyMode: Control = {
	type: 'select',
	id: 'keyMode',
	label: 'What the bits change',
	default: 'psk',
	options: [
		{ value: 'ask', label: 'Amplitude (ASK)' },
		{ value: 'fsk', label: 'Frequency (FSK)' },
		{ value: 'psk', label: 'Phase (PSK)' }
	]
};

const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Symbols per second',
	min: 0.5,
	max: 2,
	step: 0.25,
	default: 1,
	format: (v) => `${v.toFixed(2)} million`
};

const smooth: Control = {
	type: 'toggle',
	id: 'smooth',
	label: 'Smooth the switches',
	default: false,
	help: 'Shape each symbol as a gentle pulse instead of an instant jump.'
};

const snr: Control = {
	type: 'range',
	id: 'snr',
	label: 'Signal-to-noise ratio',
	min: -5,
	max: 35,
	step: 0.5,
	default: 10,
	unit: ' dB',
	help: 'Signal power over noise power, in decibels: +10 dB is 10 times, +20 dB 100 times.'
};

const resend: Control = {
	type: 'action',
	id: 'resend',
	label: 'Noise',
	action: 'New noise',
	help: 'Same settings, new random noise.'
};

const logd: Control = {
	type: 'range',
	id: 'logd',
	label: 'Distance to the receiver',
	min: 0,
	max: 4.5,
	step: 0.05,
	default: 3,
	format: distanceText,
	help: 'In open space, with no walls in the way.'
};

const band: Control = {
	type: 'select',
	id: 'band',
	label: 'Wi-Fi band',
	default: '2.4',
	options: [
		{ value: '2.4', label: '2.4 GHz (channel 6)' },
		{ value: '5', label: '5 GHz (channel 36)' }
	]
};

const nbCh: Control = {
	type: 'select',
	id: 'nbCh',
	label: 'Neighbour’s channel (yours is 6)',
	default: '8',
	options: Array.from({ length: 13 }, (_, i) => ({
		value: String(i + 1),
		label: `Channel ${i + 1}${i + 1 === 6 ? ' (same as yours)' : ''}`
	}))
};

const nbDb: Control = {
	type: 'range',
	id: 'nbDb',
	label: 'Neighbour’s signal, compared with yours',
	min: -30,
	max: 0,
	step: 1,
	default: -6,
	unit: ' dB',
	help: 'How strong the neighbouring network is at your receiver.'
};

const scheme: Control = {
	type: 'select',
	id: 'scheme',
	label: 'Bits per symbol',
	default: 'qam16',
	options: [
		{ value: 'bpsk', label: '1 bit: BPSK (2 points)' },
		{ value: 'qpsk', label: '2 bits: QPSK (4 points)' },
		{ value: 'qam16', label: '4 bits: 16-QAM' },
		{ value: 'qam64', label: '6 bits: 64-QAM' },
		{ value: 'qam256', label: '8 bits: 256-QAM' }
	]
};

const width: Control = {
	type: 'select',
	id: 'width',
	label: 'Channel width',
	default: '20',
	options: [
		{ value: '20', label: '20 MHz' },
		{ value: '40', label: '40 MHz' },
		{ value: '80', label: '80 MHz' },
		{ value: '160', label: '160 MHz' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'wireless-signals',
	title: 'How wireless signals carry data',
	summary:
		'Put bits on a radio wave by changing its amplitude, frequency or phase, watch the spectrum spread and the constellation points blur in noise, push the receiver away and add a neighbouring network until bits are misread, then pack more bits into each symbol and meet the limit Shannon proved.',
	chapters: [
		{ id: 'carrier', title: 'Riding a carrier' },
		{ id: 'noise', title: 'Noise' },
		{ id: 'link', title: 'Distance and neighbours' },
		{ id: 'more', title: 'More bits per symbol' },
		{ id: 'limit', title: 'The limit' }
	],
	steps: [
		{
			id: 'carrier',
			chapter: 'carrier',
			title: 'A carrier wave',
			scene: 'keying',
			hints: { mode: 'carrier' },
			duration: 22,
			body: `
<p>A radio transmitter drives a current back and forth in an antenna, millions or billions of times a second, and the antenna sends out an electromagnetic wave at that frequency (see <em>Electricity, magnetism and light</em>). Wi-Fi uses about 2.4 or 5 billion cycles per second: 2.4 or 5 <dfn data-def="Gigahertz: a billion cycles per second.">GHz</dfn>.</p>
<p>A steady wave like this one is called a <dfn data-def="A steady radio wave at a fixed frequency. On its own it carries no information; data is sent by changing it.">carrier</dfn>. On its own it tells the receiver nothing: every cycle is the same as the last. Its <strong>spectrum</strong> (bottom left, as in <em>The Fourier transform</em>) is one single line, at the carrier's frequency.</p>
<p>The circle on the right is the carrier's <em>pointer</em>: its length is the amplitude and its angle the phase, measured against a steady reference clock. For a plain carrier it just sits still.</p>`,
			notes: `<p>The drawing slows everything down: its carrier makes 5 million cycles per second (5 MHz) so that you can see each cycle. A real 2.4 GHz Wi-Fi carrier makes about 10,000 cycles during one of its 4-microsecond symbols. The shapes of the spectra are the same; only the scale changes.</p>`
		},
		{
			id: 'am',
			chapter: 'carrier',
			title: 'Changing the amplitude: AM',
			scene: 'keying',
			hints: { mode: 'am' },
			duration: 24,
			body: `
<p>To send a sound, make the carrier's strength follow it: louder where the sound pushes up, weaker where it pulls down. This is <dfn data-def="Amplitude modulation: the strength of the carrier follows the signal being sent.">amplitude modulation</dfn>, the AM of AM radio. Here the "sound" is a pure tone; the dashed outline is its shape, and the pointer on the right grows and shrinks with it.</p>
<p>Look at the spectrum. The carrier's line now has two neighbours, one on each side, exactly one tone-frequency away: the <dfn data-def="The extra frequencies that appear on each side of a carrier when it is modulated. They carry the information.">sidebands</dfn>. The signal now takes up a band of frequencies twice the tone's frequency wide. That width is its <dfn data-def="The range of frequencies a signal takes up. Here: the width that holds 99% of its power.">bandwidth</dfn>.</p>`,
			notes: `<p>Why sidebands? Multiplying two waves makes their sum and difference frequencies: cos A · cos B = ½ cos(A − B) + ½ cos(A + B). A real voice has many frequencies up to a few kilohertz, so AM radio stations are spaced 9 or 10 kHz apart.</p>`
		},
		{
			id: 'fm',
			chapter: 'carrier',
			title: 'Changing the frequency: FM',
			scene: 'keying',
			hints: { mode: 'fm' },
			duration: 24,
			body: `
<p>Or keep the strength fixed and let the sound nudge the carrier's <em>frequency</em>: the cycles bunch up when the tone is high and spread out when it is low. This is <dfn data-def="Frequency modulation: the frequency of the carrier follows the signal being sent; its strength stays the same.">frequency modulation</dfn>, the FM of FM radio. The pointer now swings back and forth: running ahead of the reference clock is a higher frequency, falling behind a lower one.</p>
<p>The spectrum fills with a whole comb of sidebands. Here the frequency swings 1.5 MHz each way with a 0.5 MHz tone, and 99% of the power falls within about 4 MHz, as Carson's rule of thumb predicts: twice the swing plus the tone. FM takes more room than AM, but noise that changes the wave's strength doesn't change its frequency, so FM sounds cleaner.</p>`,
			notes: `<p><strong>Carson's rule:</strong> bandwidth ≈ 2 × (frequency swing + highest frequency sent). FM broadcasting swings ±75 kHz with audio up to 15 kHz, so a station needs about 180 kHz; stations are spaced 200 kHz apart.</p>`
		},
		{
			id: 'keying',
			chapter: 'carrier',
			title: 'Bits: amplitude, frequency or phase',
			scene: 'keying',
			hints: { mode: 'digital' },
			duration: 26,
			controls: [keyMode],
			body: `
<p>Data is sent the same way, except that the carrier jumps between a few fixed states instead of following a smooth sound. Here it sends the letter “H”, 01001000 in binary (see <em>Bits</em>), one bit per <dfn data-def="One fixed stretch of time during which the carrier holds one state. Each symbol stands for one or more bits.">symbol</dfn>, a million symbols per second.</p>
<ul>
<li><strong>Amplitude:</strong> strong for 1, weak for 0 (amplitude-shift keying).</li>
<li><strong>Frequency:</strong> a little faster for 1, a little slower for 0 (frequency-shift keying, used by Bluetooth).</li>
<li><strong>Phase:</strong> the same wave, but flipped upside down for 0: its phase jumps by half a turn (phase-shift keying).</li>
</ul>
<p>The receiver reads the bits back by watching the pointer: its length, its spin or its angle.</p>`
		},
		{
			id: 'bandwidth',
			chapter: 'carrier',
			title: 'Faster symbols need a wider band',
			scene: 'keying',
			hints: { mode: 'digital', focus: 'spectrum' },
			duration: 28,
			controls: [rate, smooth, keyMode],
			body: `
<p>Send symbols faster and the spectrum spreads out: it takes twice the bandwidth to send twice as many symbols per second. That is the price of speed. Radio frequencies are shared, so every transmitter is given a band and must stay inside it.</p>
<p>Instant jumps make it much worse. As in <em>The Fourier transform</em>, sharp corners need high frequencies, and an abrupt phase flip splashes power far outside the band: at a million symbols per second, 99% of it is spread over about 18 MHz. Turn on <strong>Smooth the switches</strong>: each symbol becomes a gentle pulse, and the same million symbols fit in about 1.1 MHz.</p>`,
			notes: `<p>The smooth pulses are <dfn data-def="A pulse shape whose spectrum ends sharply at (1 + α)/2 times the symbol rate on each side, and which passes through zero at every other symbol's sampling instant, so neighbouring symbols don't disturb each other.">raised-cosine pulses</dfn> with a roll-off of 0.5: the spectrum is never wider than 1.5 times the symbol rate. The pulses overlap in time, but each one passes through zero at the centres of all the others, so the receiver can still read every symbol cleanly at its centre. Smoothing frequency keying helps less, since its two tones stay apart however the switch is made; Bluetooth smooths its frequency changes with a Gaussian filter.</p>
<p>The bandwidth here is the occupied bandwidth used by regulators (ITU-R Recommendation SM.328): the width that holds 99% of the power. The spectra are measured from a long random bit stream, with a fast Fourier transform.</p>`
		},
		{
			id: 'constellation',
			chapter: 'carrier',
			title: 'Two bits at once: the constellation',
			scene: 'keying',
			hints: { mode: 'qpsk', focus: 'pointer' },
			duration: 26,
			controls: [smooth],
			body: `
<p>Phase keying used two angles: half a turn apart. Use four angles, a quarter turn apart, and each symbol can stand for <strong>two bits</strong>: twice the data in the same bandwidth. The same 8 symbols now carry 16 bits: “Hi”. This is <dfn data-def="Quadrature phase-shift keying: four phases a quarter turn apart, each standing for two bits.">QPSK</dfn>.</p>
<p>The four allowed pointer positions form the <dfn data-def="The set of allowed points for the carrier's pointer (amplitude and phase), each standing for a group of bits.">constellation</dfn>. Their two coordinates have names: <dfn data-def="In-phase: the part of the signal that follows the reference carrier (the horizontal coordinate of the pointer).">I</dfn> across and <dfn data-def="Quadrature: the part of the signal a quarter of a cycle behind the reference carrier (the vertical coordinate of the pointer).">Q</dfn> up. A transmitter really builds its signal this way: two carriers a quarter cycle apart, one set by I and one by Q, added together.</p>
<p>Neighbouring points differ in only one bit (01 sits next to 00 and 11), so a small slip costs one bit, not two.</p>`,
			notes: `<p>That labelling is a <dfn data-def="An ordering of binary numbers in which neighbours differ in exactly one bit: 00, 01, 11, 10.">Gray code</dfn>. Every constellation on this page uses one.</p>`
		},
		{
			id: 'noise',
			chapter: 'noise',
			title: 'Noise blurs the points',
			scene: 'channel',
			hints: { phase: 'noise', scheme: 'qpsk' },
			duration: 26,
			controls: [snr, resend],
			body: `
<p>On the way, the signal picks up <dfn data-def="Random fluctuations added to a signal. The main kind in a receiver is thermal noise, from the jiggling of electrons in every warm conductor.">noise</dfn>: the electrons in the receiver's own circuits jiggle with heat, and so do the sky and the ground. Each received symbol lands a random distance from where it was sent, so each constellation point becomes a cloud.</p>
<p>The receiver picks the nearest point. If noise pushes a symbol across the line into a neighbour's square, the receiver reads the wrong bits (shown in red). How often that happens depends on the <dfn data-def="Signal-to-noise ratio: the power of the signal divided by the power of the noise, usually given in decibels (dB). 0 dB is equal power; every 10 dB is ten times more.">signal-to-noise ratio</dfn> (SNR). Lower it until the clouds merge.</p>`,
			notes: `<p>The noise is <em>additive white Gaussian noise</em>: added to the signal, equally strong at every frequency ("white"), with a bell-curve (Gaussian) spread in each direction. It is the standard model of thermal noise. Here every point you see is simulated: a random symbol plus random noise of the right size, decided by the nearest-point rule.</p>`
		},
		{
			id: 'ber',
			chapter: 'noise',
			title: 'Counting the wrong bits',
			scene: 'channel',
			hints: { phase: 'ber', scheme: 'qpsk' },
			duration: 28,
			controls: [snr, resend],
			body: `
<p>The fraction of bits that come out wrong is the <dfn data-def="Bit-error rate: the fraction of bits a receiver gets wrong.">bit-error rate</dfn> (BER). The simulation sends 200,000 bits at each setting and counts the mistakes; the dots are those counts, and the curve is what probability theory predicts.</p>
<p>They agree. And the curve falls off a cliff: at 4 dB about 1 bit in 18 is wrong, at 10 dB 1 in 1,300, at 14 dB fewer than 1 in a million. A few decibels of extra signal turn a useless link into a nearly perfect one.</p>`,
			notes: `<p>For QPSK, BER = Q(√(2E<sub>b</sub>/N<sub>0</sub>)), where E<sub>b</sub>/N<sub>0</sub> is the energy per bit over the noise density and Q(x) is the chance that a bell-curve variable lands more than x standard deviations above its mean. QPSK carries 2 bits per symbol, so E<sub>b</sub>/N<sub>0</sub> is half the SNR per symbol, and BER = Q(√SNR). This is the same Eb-versus-symbol-energy trade-off that, in <em>Error-correcting codes</em>, leaves each coded bit with only 4/7 of the energy.</p>
<p>Below about 10⁻⁵ the simulation would need millions of bits to see any errors at all, so it reports the count honestly ("0 errors in 200,000 bits") instead of plotting a dot.</p>`
		},
		{
			id: 'distance',
			chapter: 'link',
			title: 'Further away, weaker signal',
			scene: 'link',
			hints: { phase: 'distance' },
			duration: 28,
			controls: [logd, band],
			body: `
<p>A transmitter's power spreads out over an ever larger sphere, so the power a receiving antenna catches falls with the square of the distance: twice as far, a quarter of the power (−6 dB); ten times as far, a hundredth (−20 dB). This is <dfn data-def="The fraction of power lost between two antennas in open space, from the Friis equation: 20·log₁₀(4π·distance·frequency / speed of light) decibels.">free-space path loss</dfn>.</p>
<p>Here a Wi-Fi transmitter sends the European maximum for 2.4 GHz, 100 milliwatts (20 dBm), as QPSK over a 20 MHz channel. The receiver's noise doesn't change, so the SNR falls 20 dB for every tenfold step in distance. Drag the receiver away and watch the clouds grow until the bits go wrong.</p>
<p>Switch to 5 GHz: the same antenna design is smaller at the higher frequency, catches less power, and loses 6.5 dB at every distance.</p>`,
			notes: `<p><strong>Friis:</strong> received power = transmitted power − 20·log₁₀(4π<i>d</i><i>f</i>/<i>c</i>) dB, for antennas that send equally in every direction. At 2.4 GHz that is 40 dB at 1 metre and 100 dB at 1 km. The noise is <i>kTB</i>, the thermal noise of a warm resistor: −174 dBm per hertz, −101 dBm in 20 MHz.</p>
<p><strong>Simplifications:</strong> open space with no walls or reflections, an ideal receiver that adds no noise of its own, and antennas with no gain. Indoors, each wall and floor takes many decibels more, which is why a router covers a flat, not the kilometres this drawing suggests. The transmit limit is from ETSI EN 300 328 (V2.2.2, §4.3.2.2.3), the European standard for the 2.4 GHz band.</p>`
		},
		{
			id: 'neighbour',
			chapter: 'link',
			title: 'A neighbour on the same band',
			scene: 'link',
			hints: { phase: 'neighbour' },
			duration: 30,
			controls: [nbCh, nbDb, logd],
			body: `
<p>Your neighbour's router uses the same band. In the 2.4 GHz band, Wi-Fi channels are numbered every 5 MHz (channel 1 at 2412 MHz, channel 6 at 2437 MHz…), but each signal is 20 MHz wide, so a neighbour a channel or two away overlaps yours.</p>
<p>The part of their signal that falls inside your channel adds to the noise. It isn't random hiss: it is another carrier, at a random angle to yours, so each cloud becomes a <strong>ring</strong> around its point. Move the neighbour to the same channel, then to channel 1 or 11: four channel numbers away there is no overlap at all. That is why routers are usually set to channels 1, 6 or 11.</p>`,
			notes: `<p>What counts is the <em>signal-to-interference-plus-noise ratio</em> (SINR): your power over the noise plus the overlapping part of the neighbour's power. Real Wi-Fi radios also take turns: each listens before it talks and waits if the channel is busy, which avoids most collisions on the same channel but halves each network's share of airtime.</p>
<p><strong>Simplification:</strong> the spectra are taken as flat 20 MHz blocks; real ones have sloping skirts and leak a little further. Channels 1, 6 and 11 date from the original 22 MHz-wide Wi-Fi signals; where channel 13 is allowed (most of the world outside North America), 1, 5, 9 and 13 also fit side by side.</p>`
		},
		{
			id: 'qam',
			chapter: 'more',
			title: 'More points, more bits',
			scene: 'channel',
			hints: { phase: 'qam' },
			duration: 30,
			controls: [scheme, snr, resend],
			body: `
<p>Why stop at four points? Use both amplitude and phase and lay the points out in a square grid: 16 points carry 4 bits per symbol, 64 points 6 bits, 256 points 8 bits. This is <dfn data-def="Quadrature amplitude modulation: constellation points on a square grid, set by both the amplitude and the phase of the carrier.">QAM</dfn>. Each symbol takes the same time and the same bandwidth, so 256-QAM sends 4 times as many bits as QPSK.</p>
<p>But the transmitter's power is the same, so the points must crowd closer together, and the same noise now pushes symbols across the much closer lines. At 20 dB, QPSK is error-free, 16-QAM makes about 3 errors per million bits and 64-QAM nearly 1 in 100. Pick a scheme and find the SNR where its clouds stop touching.</p>`,
			notes: `<p>Each doubling of the grid's side (4 → 16 → 64 → 256 points, 2 more bits per symbol) needs about 6 dB more SNR, four times the power, for the same error rate.</p>`
		},
		{
			id: 'tradeoff',
			chapter: 'more',
			title: 'Faster, or more reliable',
			scene: 'channel',
			hints: { phase: 'tradeoff' },
			duration: 30,
			controls: [scheme, snr, resend],
			body: `
<p>Every scheme has its own cliff, and each extra 2 bits per symbol moves it about 6 dB to the right. For 1 wrong bit in 1,000, BPSK needs 6.8 dB, QPSK 9.8 dB, 16-QAM 16.5 dB, 64-QAM 22.5 dB and 256-QAM 28.4 dB.</p>
<p>So a radio chooses as it goes. Close to the router, with a strong signal, Wi-Fi uses 256-QAM or more; as you walk away and the SNR falls, it steps down to 64-QAM, 16-QAM, QPSK. That is why the speed your laptop shows drops with distance before the connection drops at all.</p>`,
			notes: `<p>This is called <em>rate adaptation</em>. Wi-Fi picks one of about a dozen <em>modulation and coding schemes</em>, each a constellation plus an error-correcting code (see <em>Error-correcting codes</em>), from what it measures about the link.</p>`
		},
		{
			id: 'width',
			chapter: 'limit',
			title: 'A wider channel',
			scene: 'limit',
			hints: { phase: 'width' },
			duration: 28,
			controls: [width, logd],
			body: `
<p>The other way to go faster is more bandwidth: twice as wide, twice as many symbols per second. Wi-Fi at 5 GHz can join 20 MHz channels into 40, 80 or 160 MHz ones.</p>
<p>But a wider receiver also lets in twice as much noise, so the SNR drops by 3 dB with every doubling. Shannon's formula (next step) gives the best possible rate. At 1 km in open space, at 5 GHz, it rises from 96 Mbit/s in 20 MHz to 337 Mbit/s in 160 MHz: eight times the width buys three and a half times the rate. When the signal is weak, extra width helps less and less.</p>`,
			notes: `<p>With unlimited width the capacity doesn't grow without limit: it approaches 1.44 × (received power ÷ noise per hertz). At 1 km at 5 GHz that is about 760 Mbit/s, however wide the channel.</p>`
		},
		{
			id: 'shannon',
			chapter: 'limit',
			title: 'The limit nobody can beat',
			scene: 'limit',
			hints: { phase: 'shannon' },
			duration: 32,
			controls: [snr],
			body: `
<p>In 1948 Claude Shannon proved that a channel <i>B</i> hertz wide, with signal-to-noise ratio SNR, can carry at most</p>
<p class="formula">C = B · log₂(1 + SNR) bits per second</p>
<p>without errors, and no cleverer scheme can do better. The curve is that <dfn data-def="The highest rate at which data can be sent through a channel with as few errors as you like: C = B · log₂(1 + SNR) for white Gaussian noise.">capacity</dfn> per hertz of bandwidth. Every scheme on this page sits to its right: plain 64-QAM needs 26.6 dB for 1 error in a million bits, where Shannon allows 6 bits per hertz from 18 dB.</p>
<p><strong>Data rides on radio waves as controlled changes to a carrier, and noise and bandwidth together set a hard limit on how fast it can go.</strong> Error-correcting codes close most of the gap: Wi-Fi 5's fastest single-stream mode sends 390 Mbit/s in 80 MHz, 4.9 bits per hertz, which Shannon allows from 14.5 dB.</p>`,
			notes: `<p>The limit says what is possible, not how to reach it; it took until the 1990s (turbo codes) and the rediscovery of 1960s LDPC codes to get within a fraction of a decibel of it. Wi-Fi, 4G and 5G all use such codes. The Wi-Fi rate is from the IEEE 802.11ac tables: 234 data subcarriers × 8 bits (256-QAM) × 5/6 (the code rate) every 4 µs.</p>`
		}
	]
};
