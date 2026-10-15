import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Nernst step: which ion's channels are open. */
const ion: Control = {
	type: 'select',
	id: 'ion',
	label: 'Channels open for',
	default: 'K',
	options: [
		{ value: 'K', label: 'Potassium (K⁺)' },
		{ value: 'Na', label: 'Sodium (Na⁺)' },
		{ value: 'Cl', label: 'Chloride (Cl⁻)' }
	]
};

/** Nernst step: the ion's concentration outside, as a factor of sea water's (log scale). */
const outside: Control = {
	type: 'range',
	id: 'outside',
	label: 'Concentration outside',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0,
	format: (v) => {
		const f = 10 ** v;
		return f === 1 ? 'as in sea water' : `× ${f < 1 ? f.toFixed(2) : f.toFixed(1)} sea water`;
	},
	help: 'Slide to change how much of that ion the sea water around the axon holds.'
};

/** GHK step: sodium permeability relative to potassium (log scale). */
const pna: Control = {
	type: 'range',
	id: 'pna',
	label: 'Sodium permeability (relative to potassium)',
	min: -2,
	max: 1.5,
	step: 0.05,
	default: Math.log10(0.04),
	format: (v) => {
		const p = 10 ** v;
		return p < 0.1 ? p.toFixed(3) : p < 10 ? p.toFixed(2) : p.toFixed(0);
	},
	help: 'At rest about 0.04; at the peak of a nerve impulse about 20 (Hodgkin & Katz 1949).'
};

/** Capacitor step: a small brief pulse. */
const small: Control = {
	type: 'range',
	id: 'small',
	label: 'Current pulse (0.5 ms)',
	min: 0,
	max: 12,
	step: 0.5,
	default: 8,
	unit: ' µA/cm²',
	help: 'Current pushed into the axon for half a millisecond.'
};

/** Threshold step: the brief pulse, up to well above threshold. */
const amp: Control = {
	type: 'range',
	id: 'amp',
	label: 'Current pulse (0.5 ms)',
	min: 0,
	max: 60,
	step: 0.5,
	default: 12,
	unit: ' µA/cm²'
};

const ttx: Control = {
	type: 'toggle',
	id: 'ttx',
	label: 'Block the sodium channels (tetrodotoxin)',
	default: false,
	help: 'The pufferfish poison. It plugs the sodium channel’s pore.'
};
const tea: Control = {
	type: 'toggle',
	id: 'tea',
	label: 'Block most potassium channels (TEA)',
	default: false,
	help: 'Tetraethylammonium, a lab chemical that plugs potassium channels from inside. Here it blocks 90% of the channels that open with voltage.'
};

/** Refractory step: the time between two identical pulses. */
const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Time between two pulses',
	min: 2,
	max: 30,
	step: 0.5,
	default: 8,
	unit: ' ms',
	help: 'Both pulses are twice as strong as the threshold.'
};

/** Rate step: a steady current. */
const steady: Control = {
	type: 'range',
	id: 'steady',
	label: 'Steady current',
	min: 0,
	max: 30,
	step: 0.5,
	default: 10,
	unit: ' µA/cm²',
	help: 'Switched on at 5 ms and held.'
};

/** Cable step: the axon's diameter. */
const diameter: Control = {
	type: 'select',
	id: 'diameter',
	label: 'Axon diameter',
	default: '476',
	options: [
		{ value: '476', label: '476 µm (Hodgkin & Huxley’s squid axon)' },
		{ value: '240', label: '240 µm' },
		{ value: '120', label: '120 µm' },
		{ value: '60', label: '60 µm' }
	]
};

const temperature: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 6.3,
	max: 25,
	step: 0.1,
	default: 18.5,
	unit: ' °C',
	// Half-degree steps (plus HH's 6.3 °C): each value re-solves the whole cable.
	values: () => [6.3, ...Array.from({ length: 38 }, (_, i) => 6.5 + i * 0.5)],
	help: 'The squid lives in cool sea water; channels open and close faster when warm.'
};

/** Myelin step. */
const myelin: Control = {
	type: 'toggle',
	id: 'myelin',
	label: 'Wrap the axon in myelin',
	default: true
};
const fibre: Control = {
	type: 'range',
	id: 'fibre',
	label: 'Fibre diameter',
	min: 2,
	max: 20,
	step: 0.5,
	default: 10,
	unit: ' µm',
	help: 'A human nerve fibre; the thickest ones carry touch and the commands to muscles.'
};

/** Synapse step. */
const fire: Control = {
	type: 'action',
	id: 'fire',
	label: 'Fire',
	action: 'Send a spike to the synapse'
};

/** Summation step. */
const exc: Control = {
	type: 'range',
	id: 'exc',
	label: 'Excitatory synapses active',
	min: 0,
	max: 8,
	step: 1,
	default: 2
};
const inh: Control = {
	type: 'range',
	id: 'inh',
	label: 'Inhibitory synapses active',
	min: 0,
	max: 4,
	step: 1,
	default: 0
};
const spread: Control = {
	type: 'range',
	id: 'spread',
	label: 'Spread in time of the excitatory inputs',
	min: 0,
	max: 10,
	step: 0.5,
	default: 0,
	unit: ' ms',
	help: '0: they all arrive at once.'
};

/** Circuit step. */
const in1: Control = { type: 'toggle', id: 'in1', label: 'Input neuron 1 fires', default: true };
const in2: Control = { type: 'toggle', id: 'in2', label: 'Input neuron 2 fires', default: true };
const in3: Control = { type: 'toggle', id: 'in3', label: 'Input neuron 3 fires', default: false };
const strength: Control = {
	type: 'range',
	id: 'w3a',
	label: 'Strength of the connection 3 → A',
	min: 0,
	max: 4,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'none' : `${v} synapse${v === 1 ? '' : 's'}`),
	help: 'Learning strengthens connections that are used: more synapses, or bigger ones.'
};

export const spec: ExplainerSpec = {
	slug: 'neurons',
	title: 'How neurons fire and talk to each other',
	summary:
		'Inject current into a squid axon and watch sodium and potassium channels open, the voltage spike and the pulse race down the axon, far faster when wrapped in myelin. Then release neurotransmitter at a synapse and add up excitatory and inhibitory inputs on the next cell.',
	chapters: [
		{ id: 'battery', title: 'A cell that is a battery' },
		{ id: 'spike', title: 'The spike' },
		{ id: 'axon', title: 'Down the axon' },
		{ id: 'synapse', title: 'Passing it on' }
	],
	steps: [
		// ------------------------------------------------------------------ battery
		{
			id: 'neuron',
			chapter: 'battery',
			title: 'A cell built to signal',
			scene: 'neuron',
			duration: 16,
			body: `
<p>Your brain has about <strong>86 billion</strong> <dfn data-def="A nerve cell: a cell specialised to receive signals from other cells, combine them, and send a signal of its own, sometimes over a metre away.">neurons</dfn>. Each is a <a href="../the-cell/">cell</a> like any other, with a nucleus, mitochondria and a membrane full of pumps and channels, but with a shape built for one job: collecting signals and passing one on.</p>
<ul>
<li>Branching <dfn data-def="The tree of short branches on which a neuron receives most of its inputs.">dendrites</dfn> receive signals from other neurons.</li>
<li>The <dfn data-def="The cell body: the part with the nucleus, where the inputs from the dendrites come together.">cell body</dfn> adds them up.</li>
<li>If the sum is big enough, the cell fires a pulse, an <dfn data-def="The nerve impulse or spike: a brief reversal of the voltage across the membrane, about a tenth of a volt, that travels along the axon without fading.">action potential</dfn>, that runs down a long thin cable, the <dfn data-def="The neuron's output cable. It can be under a millimetre or over a metre long, from the spinal cord to the toes.">axon</dfn>.</li>
<li>At its end, at the <dfn data-def="The junction where the axon of one neuron passes its signal to another cell, usually with a chemical messenger.">synapses</dfn>, the pulse makes the axon release a chemical that the next cells detect.</li>
</ul>
<p>This page follows that signal all the way: what the pulse is, how it travels, and how the next cell decides whether to fire.</p>`,
			notes: `<p>86 billion: 86.1 ± 8.1 billion neurons in the adult male human brain, counted by dissolving brains and counting nuclei (Azevedo et al., <i>Journal of Comparative Neurology</i> 513:532, 2009). Neurons come in hundreds of shapes; the one drawn here is a schematic of a typical cortical neuron, not to scale: real dendrites span a few tenths of a millimetre, and the axon can be thousands of times longer than the cell body is wide.</p>`
		},
		{
			id: 'battery',
			chapter: 'battery',
			title: 'Ions, channels and a voltage',
			scene: 'ions',
			hints: { mode: 'nernst' },
			duration: 22,
			controls: [ion, outside],
			body: `
<p>The membrane separates two salty solutions with very different mixes of <dfn data-def="Atoms with an electric charge: K⁺, Na⁺ and Ca²⁺ have lost electrons and are positive; Cl⁻ has gained one and is negative.">ions</dfn>. Here are the measured numbers for the giant axon of a squid, the neuron in which all this was first worked out: inside, a lot of potassium (K⁺) and little sodium (Na⁺); outside, in the sea water, the opposite. The <strong>sodium–potassium pump</strong> you met in <a href="../the-cell/#membrane">the cell</a> built these differences and keeps them.</p>
<p>Now open channels that let only potassium through. K⁺ is crowded inside, so it drifts out. But each K⁺ that leaves carries a positive charge, so the inside becomes negative, and that negative inside pulls the K⁺ back. Very soon the two pushes balance: potassium is at <dfn data-def="The voltage at which an ion's electrical pull exactly balances its drift down its concentration difference, so no more of it crosses: its Nernst potential.">equilibrium</dfn>. For a tenfold concentration difference that takes 58 mV; for squid potassium (35-fold) it is about <strong>−90 mV</strong>, inside negative.</p>
<p>Switch to sodium: it is crowded outside, so it flows in until the inside is <em>positive</em>, about +47 mV. Change the concentration outside and watch the balance move.</p>`,
			notes: `<p>The balance point is given by the <dfn data-def="E = (RT / zF) ln(c_out / c_in), where R is the gas constant, T the absolute temperature, z the ion's charge and F the Faraday constant.">Nernst equation</dfn>, E = (RT/zF) ln(c<sub>out</sub>/c<sub>in</sub>): 25.3 mV × ln(ratio) at 20 °C, or 58 mV for each factor of ten. Concentrations: inside K⁺ 345, Na⁺ 72, Cl⁻ 61 mM; sea water K⁺ 10, Na⁺ 455, Cl⁻ 540 mM, as adopted by Hodgkin &amp; Katz (<i>Journal of Physiology</i> 108:37, 1949) from Steinbach’s measurements of axoplasm. Like any battery, the voltage here comes from charges kept apart: the ions themselves do not need to move far, as the next steps show.</p>`
		},
		{
			id: 'mix',
			chapter: 'battery',
			title: 'The resting potential: a tug of war',
			scene: 'ions',
			hints: { mode: 'ghk' },
			duration: 22,
			controls: [pna],
			body: `
<p>A real membrane lets several ions through at once, each pulling the voltage towards its own balance point: potassium towards −90 mV, sodium towards +47 mV. The voltage settles where the flows cancel, closer to whichever ion the membrane lets through more easily. Building on Goldman's 1943 theory, Hodgkin and Katz worked out the formula in 1949, the <dfn data-def="The Goldman–Hodgkin–Katz equation: the voltage at which the currents of several kinds of ion across a membrane add up to zero, given their concentrations and how easily each passes.">Goldman–Hodgkin–Katz equation</dfn>.</p>
<p>At rest, a squid axon lets sodium through about 25 times less easily than potassium (a <dfn data-def="How easily an ion crosses the membrane: roughly, how many channels for it are open.">permeability</dfn> of 0.04). Potassium wins the tug of war and the inside sits at about <strong>−60 mV</strong>: the <dfn data-def="The steady voltage across the membrane of a neuron that is not signalling: about −60 to −70 mV, inside negative.">resting potential</dfn>.</p>
<p>Now raise the sodium permeability. When sodium becomes 20 times more permeable than potassium, the voltage flips to about <strong>+38 mV</strong>. That flip, from potassium winning to sodium winning and back, is the nerve impulse.</p>`,
			notes: `<p>The ratios 1 : 0.04 : 0.45 for K⁺ : Na⁺ : Cl⁻ at rest and 1 : 20 : 0.45 at the peak of the impulse are the values Hodgkin &amp; Katz found to fit their measurements; they predicted −59 mV at rest and an action potential 97 mV high, close to the 88 mV they measured. Chloride is drawn but held fixed here; its balance point (−55 mV) is near the rest, so it steadies the voltage rather than setting it. The pump also contributes a few millivolts directly, because it moves 3 Na⁺ out for every 2 K⁺ in; that is left out.</p>`
		},
		{
			id: 'capacitor',
			chapter: 'battery',
			title: 'The membrane is a capacitor',
			scene: 'spike',
			hints: { mode: 'charge' },
			duration: 18,
			controls: [small],
			body: `
<p>Push a little current into the axon through an electrode for half a millisecond. The voltage jumps up at once, then slowly leaks back to rest.</p>
<p>The membrane behaves like a <dfn data-def="Two conductors separated by a thin insulator. Charge piled on one side attracts the opposite charge on the other; the voltage across it is the charge divided by the capacitance, V = Q / C.">capacitor</dfn>: a thin insulating film, 4 nm of fat, between two conducting salt solutions. Charge pushed in piles up on its inner face, and the voltage rises by the charge divided by the <dfn data-def="How much charge a capacitor stores per volt, measured in farads. Cell membranes have about 1 microfarad per square centimetre.">capacitance</dfn>, 1 µF for each cm² of membrane. The charge then leaks out through the open channels, which act as <a href="../electric-circuits/#ohm">resistors</a> in parallel with the capacitor.</p>
<p>How many ions does that take? To change the voltage by 100 mV, about one picomole of ions per cm² must cross: for the squid axon, about <strong>one in four million</strong> of the potassium ions inside. Nerve signals do not use up the ion differences; the pump only has to top them up slowly.</p>`,
			notes: `<p>Hodgkin and Huxley drew the membrane as this electric circuit: the capacitor C in parallel with three branches, one for each kind of ion, each a battery at that ion's balance point in series with a variable resistor (its channels). With 1 µF/cm², ΔQ = C ΔV = 10⁻⁷ C/cm² for 100 mV, or 1.04 × 10⁻¹² mol of single-charged ions. The axon is 0.476 mm across, so under each cm² of membrane there is a column of axoplasm 0.119 mm deep holding 4.1 × 10⁻⁶ mol of K⁺. The voltage does not fall back exactly like a capacitor discharging through a fixed resistor: even this small change starts to move the channels' gates, which the next steps are about.</p>`
		},
		// ------------------------------------------------------------------ spike
		{
			id: 'threshold',
			chapter: 'spike',
			title: 'Threshold: all or nothing',
			scene: 'spike',
			hints: { mode: 'pulse' },
			duration: 20,
			controls: [amp],
			body: `
<p>Now make the pulse stronger. Up to about 13 µA/cm² nothing new happens: the voltage rises a little and sinks back. Just past it the membrane takes over: the voltage shoots up past zero to about <strong>+45 mV</strong> and comes back down to rest within about three milliseconds. That is an <strong>action potential</strong>, or <dfn data-def="Neuroscientists' word for an action potential, from the shape of the trace.">spike</dfn>.</p>
<p>Push harder still and the spike comes sooner, but it is no bigger. A neuron's output is <strong>all or nothing</strong>: either the voltage crosses the <dfn data-def="The voltage, about 7 mV above rest for a short pulse here, beyond which the membrane's own sodium current takes over and a full spike follows.">threshold</dfn> and a full spike follows, or nothing does.</p>
<p>The membrane patch on the left shows why. Each <dfn data-def="A rise of the inside voltage towards zero or above, making it less negative.">depolarisation</dfn> opens a few <strong class="tag na">sodium channels</strong>; sodium rushes in, raising the voltage, which opens more of them. Past the threshold this feedback runs away on its own.</p>`,
			notes: `<p>This is the model Alan Hodgkin and Andrew Huxley built from their voltage-clamp measurements on the squid giant axon (<i>Journal of Physiology</i> 117:500, 1952; Nobel Prize 1963), run exactly as published at the temperature of their experiments, 6.3 °C. Voltages are measured from the resting potential, which we place at −60 mV. Near threshold the model is not perfectly all or nothing: a pulse exactly at threshold gives a delayed, slightly smaller spike, because the threshold is a balance between currents rather than a fixed switch. Above it, a pulse twice or five times as strong gives spikes within 2 mV of each other.</p>`
		},
		{
			id: 'channels',
			chapter: 'spike',
			title: 'Sodium in, then potassium out',
			scene: 'spike',
			hints: { mode: 'channels' },
			duration: 22,
			controls: [ttx, tea],
			body: `
<p>The lower chart shows how many channels are open, as the membrane's <dfn data-def="The inverse of resistance: how easily current flows. Measured in siemens; here in millisiemens per cm² of membrane.">conductance</dfn> to each ion. The spike is two kinds of channel opening one after the other:</p>
<ul>
<li><strong class="tag na">Sodium channels</strong> open fast. Sodium rushes in and the voltage heads for sodium's balance point: the rising phase. Within a millisecond each channel shuts itself with a second gate (it <dfn data-def="A sodium channel that has opened soon blocks itself with an inactivation gate, and cannot open again until the voltage has been back near rest for a few milliseconds.">inactivates</dfn>).</li>
<li><strong class="tag k">Potassium channels</strong> open more slowly. Potassium flows out and drags the voltage back down, even a little below rest, before they close.</li>
</ul>
<p>Block the sodium channels with tetrodotoxin, the poison of the pufferfish, and the same pulse gives no spike at all; neither would a far stronger one. Block most of the potassium channels instead and the spike still fires but ends much more slowly: in this model it lasts about twice as long.</p>`,
			notes: `<p>Hodgkin and Huxley described each channel type with imaginary gates. A sodium channel conducts when three fast <i>m</i> gates are open and one slow <i>h</i> gate is not shut: conductance = 120 m³h mS/cm². A potassium channel needs four <i>n</i> gates open: 36 n⁴ mS/cm². Each gate flips with voltage-dependent rates they measured. Decades later the channels were found to be real proteins; the potassium channel’s four identical subunits match the four <i>n</i> gates, and the sodium channel’s inactivation gate is a loop of the protein that swings into the pore. The channels in the patch are drawn as symbols; their numbers follow the model's conductances.</p>
<p>The dashed lines are the balance points Hodgkin and Huxley measured on their axons: +55 mV for sodium and −72 mV for potassium. They differ from the +47 and −89 mV worked out from concentrations in the first chapter: the internal concentrations are uncertain (Hodgkin and Katz called them “subject to considerable error”), and potassium that leaks out piles up in the thin space just outside the membrane (Frankenhaeuser &amp; Hodgkin, <i>Journal of Physiology</i> 131:341, 1956).</p>
<p>The blockers here are a simplification. Each removes the voltage-gated part of its conductance (all of it for tetrodotoxin, 90% for TEA) but keeps the small conductance already open at rest as a fixed leak: 0.37 mS/cm² for potassium, out of the 36. Scaling the whole 36 mS/cm² by 0.1 would leave too little potassium conductance at rest, and the model cell would fire again and again on its own. Real axons behave like the simplified version: injected TEA leaves the resting potential unchanged (Tasaki &amp; Hagiwara, <i>Journal of General Physiology</i> 40:859, 1957). It prolongs the squid spike far more than twice, though, sometimes a hundredfold, into a long plateau; the doubling is this model's, not a measurement.</p>`
		},
		{
			id: 'refractory',
			chapter: 'spike',
			title: 'A pause after each spike',
			scene: 'spike',
			hints: { mode: 'pair' },
			duration: 20,
			controls: [gap],
			body: `
<p>Fire two identical pulses, each twice the threshold. With a long gap, each gives a full spike. Bring them closer: below about 13 ms here, the second pulse gets no spike at all.</p>
<p>Right after a spike the sodium channels are still inactivated and the potassium channels still open, so the membrane cannot fire again: it is <dfn data-def="Unable to fire again for a while after a spike, because the sodium channels are inactivated and the potassium channels are still open.">refractory</dfn>. The sodium channels have to recover first, and they do so only once the voltage is back near rest.</p>
<p>That pause sets a speed limit on how often a neuron can fire, and in the next chapter it makes sure a pulse travelling along the axon can only go forwards.</p>`,
			notes: `<p>At 6.3 °C, the cold sea water the model was fitted at, everything is slow. The squid’s channels work about three times faster for every 10 °C warmer (Hodgkin &amp; Huxley’s temperature coefficient), and mammalian neurons at 37 °C have refractory periods of a millisecond or two and spikes under a millisecond long. In the first few milliseconds no pulse, however strong, can fire a second spike (the absolute refractory period); later a strong enough pulse can (the relative refractory period).</p>`
		},
		{
			id: 'rate',
			chapter: 'spike',
			title: 'Stronger means more often, not bigger',
			scene: 'spike',
			hints: { mode: 'steady' },
			duration: 20,
			controls: [steady],
			body: `
<p>Hold a steady current on instead of a short pulse. A weak current gives one or a few spikes and then nothing. Above about 6.3 µA/cm² the membrane fires again and again, about 50 times a second, and the stronger the current, the faster it fires: about 100 a second at 30 µA/cm².</p>
<p>Since spikes do not grow with the current, a neuron cannot say "more" by firing bigger spikes. It says it by firing <strong>more often</strong>. A gentle touch on your skin makes the nerve fibres from it fire slowly; a firm press makes them fire many times faster.</p>`,
			notes: `<p>In the Hodgkin–Huxley membrane steady firing starts abruptly at about 50 spikes per second rather than from zero, a property of the squid axon's particular channels. Many neurons in the brain have extra kinds of potassium channel that let them start firing slowly, so that their rate grows smoothly from zero. The spikes here shrink a little as the rate climbs, because each starts before the sodium channels have fully recovered; at much stronger currents (above about 75 µA/cm² here) the model stops firing altogether: the voltage stays raised and the sodium channels stay inactivated.</p>`
		},
		// ------------------------------------------------------------------ axon
		{
			id: 'travel',
			chapter: 'axon',
			title: 'A pulse that renews itself',
			scene: 'cable',
			duration: 22,
			controls: [diameter, temperature],
			body: `
<p>A spike at one end of the axon has to reach the other end, centimetres or a metre away. An axon is a poor wire: its salty interior conducts tens of millions of times worse than copper, and its membrane leaks. A voltage passed along it like a current in a wire would fade to a third within about 7 mm in this axon, and within a fraction of a millimetre in a thin one.</p>
<p>Instead, the spike rebuilds itself as it goes. Current from the spiking patch flows along the inside to the next patch, nudges it past threshold, and that patch fires its own full spike. The patch behind is refractory, so the pulse can only move forward. This is Hodgkin and Huxley's model of the whole axon, solved along 8 cm of it.</p>
<p>The model's pulse travels at about <strong>18.5 m/s</strong>, as fast as Hodgkin and Huxley calculated in 1952 (18.8 m/s), against the 21.2 m/s they measured on the same axon. A thinner axon is slower: the speed goes only as the square root of the diameter. Warmer channels are faster.</p>`,
			notes: `<p>The model is HH's cable equation, C ∂V/∂t = (a/2Rᵢ) ∂²V/∂x² − I<sub>ion</sub>, with their axon's radius a = 238 µm and axoplasm resistivity Rᵢ = 35.4 Ω·cm, at 18.5 °C, solved on compartments 0.5 mm long (on a grid twice as fine the speed changes by under 2%). Hodgkin and Huxley had no computer for this: Huxley solved the equations with a hand-cranked calculating machine, guessing the speed until the solution stayed finite, over about three weeks. The chart's peak is lower than in the patch steps because at 18.5 °C the potassium channels open faster and cut the spike short. Axoplasm resistivity 35 Ω·cm against copper's 1.7 × 10⁻⁶ Ω·cm: a factor of 2 × 10⁷, and the 0.5 mm axon is far thinner than most wires.</p>`
		},
		{
			id: 'myelin',
			chapter: 'axon',
			title: 'Myelin: jumping from gap to gap',
			scene: 'myelin',
			duration: 22,
			controls: [myelin, fibre],
			body: `
<p>The squid gets speed by making its axon half a millimetre thick. Your nerves hold millions of fibres; they cannot all be that big. Vertebrates found another way: <dfn data-def="A fatty insulating sheath made by glial cells, which wrap many layers of their own membrane around the axon.">myelin</dfn>.</p>
<p>Glial cells wrap the axon in dozens of layers of membrane, leaving bare gaps every millimetre or so, the <dfn data-def="Short gaps, about 1 µm long, between the segments of myelin, where the axon's sodium channels are packed.">nodes of Ranvier</dfn>. The thick wrapping barely leaks and needs little charge, so the current from one node reaches the next almost undiminished, and only the nodes need to fire. The impulse jumps from node to node.</p>
<p>Switch the myelin off and on. A 10 µm myelinated fibre conducts at about <strong>60 m/s</strong>; the same fibre bare would manage about 3. To match it without myelin, an axon would have to be nearly 4 mm thick. Diseases that strip myelin, like multiple sclerosis, slow or block the signals.</p>`,
			notes: `<p>Speeds from measurements. Myelinated: about 6 m/s per µm of fibre diameter (Hursh, <i>American Journal of Physiology</i> 127:131, 1939, cat nerves). Unmyelinated: cable theory makes speed grow as the square root of diameter (the previous step); scaled from the squid axon’s 21.2 m/s at 476 µm it gives about 1 m/s at 1 µm, the speed measured in the thin unmyelinated C fibres of human nerves (0.5–2 m/s), which carry slow, burning pain. This mixes a squid membrane at 18.5 °C with mammalian fibres at 37 °C, so take the bare-fibre speeds as estimates. Hursh’s diameter is the outer one, myelin included; the bare fibre is given the same full outer diameter, which slightly flatters it. Internodes are about 100 fibre diameters long (Rushton, <i>Journal of Physiology</i> 115:101, 1951). The pulse is drawn moving at the true speed slowed down: the spike lasts about half a millisecond, so at 60 m/s it stretches over 30 mm of axon, some 30 nodes at once.</p>`
		},
		// ------------------------------------------------------------------ synapse
		{
			id: 'synapse',
			chapter: 'synapse',
			title: 'The synapse: electricity to chemistry and back',
			scene: 'synapse',
			duration: 18,
			controls: [fire],
			body: `
<p>At the end of the axon the electrical signal stops. A gap about 20 nm wide, the <dfn data-def="The narrow gap, about 20 nm, between the axon terminal and the next cell at a chemical synapse.">synaptic cleft</dfn>, separates it from the next cell, and the spike cannot jump it. It is carried across by a chemical. Send a spike and follow it:</p>
<ol>
<li>The spike opens <strong>calcium channels</strong> in the terminal; Ca²⁺ flows in.</li>
<li>Calcium makes small bubbles, <dfn data-def="Membrane bubbles about 40 nm across, each filled with thousands of molecules of neurotransmitter.">synaptic vesicles</dfn>, fuse with the membrane and spill their <dfn data-def="A chemical messenger released at a synapse: glutamate, GABA, acetylcholine, dopamine and others.">neurotransmitter</dfn>, here glutamate, into the cleft.</li>
<li>It diffuses across in microseconds and binds <strong>receptor channels</strong> on the next cell, which open and let Na⁺ in.</li>
<li>The next cell's voltage rises a little: an <dfn data-def="Excitatory postsynaptic potential: a small, brief rise of a neuron's voltage caused by a synapse.">excitatory postsynaptic potential</dfn>, or EPSP.</li>
</ol>
<p>The whole relay takes about half a millisecond. In this model one synapse moves the next cell's voltage by about 2 mV; in real brain neurons it is usually well under 1 mV. Either way it is far below threshold.</p>`,
			notes: `<p>The cleft is about 20 nm wide in electron micrographs; the delay from the spike arriving to the next cell responding is about 0.5 ms, most of it the release step (Katz &amp; Miledi measured it at the frog nerve–muscle junction in the 1960s). The transmitter is then cleared away by pumps or enzymes, so each spike gives a brief, separate signal. Some synapses are electrical instead, with channels joining the two cells directly; they are faster but cannot amplify or invert the signal. The drawing is schematic and the timing slowed down; the receiving cell's response uses the illustrative synapse of the next step.</p>`
		},
		{
			id: 'adding',
			chapter: 'synapse',
			title: 'Adding up the inputs',
			scene: 'summation',
			duration: 22,
			controls: [exc, inh, spread],
			body: `
<p>A neuron in the brain receives thousands of synapses. Some are <strong class="tag exc">excitatory</strong>: they push its voltage up towards threshold. Others are <strong class="tag inh">inhibitory</strong>: their transmitter (GABA) opens chloride channels that hold the voltage down.</p>
<p>The cell body simply adds them up, and fires only if the sum crosses the threshold. Here one excitatory input lifts the voltage by about 2 mV. Turn on two, then three arriving together: the third tips it over and the cell fires a full spike. Add two inhibitory inputs and three are no longer enough; it now takes five.</p>
<p>Timing counts too. Spread the same three inputs out over a few milliseconds and each little rise has faded before the next arrives: no spike. A neuron weighs <em>what</em> arrives and <em>when</em>.</p>`,
			notes: `<p>The receiving cell here has Hodgkin and Huxley's squid membrane. The synapses are conductances that open for a millisecond or so, reversing at 0 mV for the excitatory, glutamate-type channel and at −75 mV for the inhibitory, GABA-type chloride channel (a typical value in mature brain neurons); their sizes are <strong>illustrative</strong>, chosen so that three coincident inputs are needed. In real cortical neurons a single synapse gives well under 1 mV and the membrane forgets more slowly (10–20 ms), so dozens of inputs must arrive within a few tens of milliseconds. Inputs also add up differently depending on where on the dendrites they land.</p>`
		},
		{
			id: 'circuit',
			chapter: 'synapse',
			title: 'Computing with connections',
			scene: 'circuit',
			duration: 24,
			controls: [in1, in2, in3, strength],
			body: `
<p>Wire three neurons to two others. Cell <strong>A</strong> gets two synapses from input 1 and two from input 2; cell <strong>B</strong> two from input 2 and two from input 3, and two <em>inhibitory</em> ones from input 1. Now each receiving cell detects a pattern: A fires when 1 and 2 fire together; B when 2 and 3 fire, but not if 1 does too.</p>
<p>Nothing about the neurons changed between A and B, only their connections. That is how the brain computes: 86 billion all-or-nothing cells, each adding up thousands of inputs, and the strength and pattern of the connections between them decide what the network does.</p>
<p>Connections change with use. Give the connection from 3 to A even one synapse and A starts to answer 1 + 3 (and 2 + 3) as well: it has <strong>learned</strong>. Give it three or more and input 3 alone fires A: strengthen too much and the cell stops detecting a pattern at all. Changes like this, synapses growing stronger or weaker with use, are thought to be what memory is made of. The <a href="../neural-networks/">artificial neural networks</a> of machine learning borrow exactly this idea: weighted sums, a threshold, and learning by adjusting the weights.</p>`,
			notes: `<p>Each receiving cell is the same model cell as in the previous step; each synapse has the same illustrative size, and a stronger connection is drawn as more synapses. Real synapses also change their size: the long-lasting strengthening of a synapse that is used while the receiving cell fires, long-term potentiation, was discovered in the rabbit hippocampus by Bliss and Lømo (1973). Heart muscle cells fire action potentials too, with the same sodium and potassium channels plus calcium channels that make each one last a quarter of a second: see <a href="../heart-circulation/">the heart</a>.</p>`
		}
	]
};
