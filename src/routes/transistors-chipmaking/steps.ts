import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { TOOLS, VDD } from './model';

const volts = (v: number) => `${v.toFixed(2)} V`;

const gate = (id: string, label: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0,
	max: VDD,
	step: 0.01,
	default: def,
	format: volts,
	help
});

export const spec: ExplainerSpec = {
	slug: 'transistors-chipmaking',
	title: 'Transistors and how chips are made',
	summary:
		'Raise the voltage on a transistor’s gate and watch a channel of electrons appear, pair two transistors into an inverter, then follow a chip through the factory: films, light through a mask, etching and doping, repeated layer after layer, until billions of switches are printed at once.',
	chapters: [
		{ id: 'switch', title: 'A switch made of silicon' },
		{ id: 'logic', title: 'Switches into logic' },
		{ id: 'fab', title: 'Printing with light' },
		{ id: 'smaller', title: 'Smaller and smaller' }
	],
	steps: [
		// ------------------------------------------------------------------ switch
		{
			id: 'mosfet',
			chapter: 'switch',
			title: 'A transistor in cross-section',
			scene: 'mosfet',
			hints: { phase: 'gate' },
			duration: 26,
			controls: [gate('vg', 'Gate voltage', 0, 'The drain is held at 1.8 V above the source.')],
			body: `
<p>Nearly every transistor on a chip is a <dfn data-def="Metal–oxide–semiconductor field-effect transistor: a switch in which the voltage on an insulated gate creates or removes a conducting channel between two doped regions, the source and the drain.">MOSFET</dfn>. Seen in cross-section, it is a slab of <a href="../semiconductors/#acceptor">p-type silicon</a> with two small <a href="../semiconductors/#donor">n-type</a> islands, the <dfn data-def="The terminal the channel's carriers come from: in an n-channel transistor, the n-type region connected to the lower voltage.">source</dfn> and the <dfn data-def="The terminal the channel's carriers flow to: in an n-channel transistor, the n-type region at the higher voltage.">drain</dfn>. Between them, on top, lies the <dfn data-def="The electrode that controls a MOSFET. It sits on a thin insulating layer and never touches the silicon underneath.">gate</dfn>: a conductor separated from the silicon by a layer of glass (silicon dioxide) only about 4 nm thick.</p>
<p>With the gate at 0 V, the path from source to drain is n, then p, then n: two <a href="../semiconductors/#pn">p–n junctions</a> back to back, one of which is always reverse-biased. No current flows. The transistor is <strong>off</strong>.</p>
<p><strong>Raise the gate voltage</strong>. Its positive charge pushes the holes away from the surface and pulls in electrons, which come from the source and drain. Past about <strong>0.5 V</strong> there are more electrons than holes in a thin skin under the oxide: a <dfn data-def="A thin layer at the surface of p-type silicon where the gate's voltage has gathered so many electrons that it behaves like n-type silicon. It connects source and drain.">channel</dfn> of n-type silicon joins source and drain, and current flows. The transistor is <strong>on</strong>. No current flows into the gate itself: the glass stops it.</p>`,
			notes: `<p>The gate, the oxide and the silicon form a capacitor. Above the threshold every extra volt on the gate adds C<sub>ox</sub> × 1 V of charge to the channel: with this oxide (C<sub>ox</sub> = 8.6 fF/µm²) that is about 54,000 electrons in every square micrometre. The device drawn is the textbook 0.18 µm transistor of Sedra &amp; Smith's <i>Microelectronic Circuits</i> (threshold 0.5 V, supply 1.8 V, channel 0.18 µm long), the technology of chips around the year 2000. Today's transistors are much smaller, run on under 1 V, and wrap the gate around fins or stacked sheets of silicon instead of lying flat (FinFETs since 2011, gate-all-around since 2022), but they switch the same way. The drawing is not to scale: the channel is only a few nanometres deep.</p>`
		},
		{
			id: 'threshold',
			chapter: 'switch',
			title: 'Off, then on: the threshold',
			scene: 'mosfet',
			hints: { phase: 'curve' },
			duration: 26,
			controls: [
				gate('vg', 'Gate voltage', 0),
				{
					type: 'toggle',
					id: 'logScale',
					label: 'Logarithmic current scale',
					default: false,
					help: 'Each gridline is ten times the one below.'
				}
			],
			body: `
<p>The curve shows the drain current against the gate voltage. <strong>Drag the dot</strong> along it (or use the slider).</p>
<p>Below the <dfn data-def="The gate voltage at which a channel forms and the transistor starts to conduct strongly. Written V_t; 0.5 V for this transistor.">threshold voltage</dfn> the current is tiny; above it the current grows with the <em>square</em> of how far the gate is past threshold: twice the overdrive, four times the current. At the full 1.8 V this small transistor passes about <strong>0.65 mA</strong>.</p>
<p>Switch to the logarithmic scale to see what “off” really means. Below threshold the current does not stop dead; it falls ten times for every <strong>89 mV</strong> the gate drops, because fewer and fewer electrons have the energy to climb over the barrier at the source. At 0 V a few picoamps leak: on and off differ by a factor of about a hundred million. That is a switch.</p>`,
			notes: `<p>Above threshold the model is the “square law” of Sedra &amp; Smith: I<sub>D</sub> = ½ µ<sub>n</sub>C<sub>ox</sub> (W/L)(V<sub>GS</sub> − V<sub>t</sub>)² once the drain voltage exceeds V<sub>GS</sub> − V<sub>t</sub>, with µ<sub>n</sub>C<sub>ox</sub> = 387 µA/V² and W/L = 0.36 µm / 0.18 µm. Below threshold it is joined smoothly to the exponential current by the interpolation of the EKV model (Enz, Krummenacher &amp; Vittoz, 1995), with a slope factor n = 1.5: the current falls tenfold per n·(kT/q)·ln 10 = 89 mV. No transistor at room temperature can do better than 60 mV per tenfold, the limit set by the same Boltzmann factor as in a <a href="../semiconductors/#curve">diode</a>. Short transistors also suffer effects this model leaves out (the carriers' speed saturates, and the drain lowers the barrier a little), which is part of why shrinking them is hard.</p>`
		},
		{
			id: 'pmos',
			chapter: 'switch',
			title: 'The mirror-image transistor',
			scene: 'mosfet',
			hints: { phase: 'pmos' },
			duration: 24,
			controls: [
				gate('vgp', 'Gate voltage', 1.8, 'The source is at the supply, 1.8 V; the drain at 0 V.')
			],
			body: `
<p>Swap every doping and you get the other kind: a <dfn data-def="A MOSFET with p-type source and drain in n-type silicon. Its channel is made of holes and it conducts when the gate is low.">p-channel MOSFET</dfn> (pMOS), with p-type source and drain in n-type silicon. Its source is connected to the supply, here <strong>1.8 V</strong>.</p>
<p>Everything works in reverse. With the gate also at 1.8 V there is no voltage between gate and source, and the transistor is off. <strong>Lower the gate</strong>: once it is 0.5 V below the source, it pulls holes to the surface and a channel of holes conducts.</p>
<p>So the two kinds respond oppositely to the same signal: a <strong>high</strong> gate turns the nMOS <strong>on</strong> and the pMOS <strong>off</strong>; a <strong>low</strong> gate does the reverse.</p>`,
			notes: `<p>Holes move about 4.5 times more slowly than electrons in these channels (µ<sub>p</sub>C<sub>ox</sub> = 86 µA/V² against 387), so to carry the same current the pMOS is made 4.5 times wider. On a real chip both kinds sit side by side in the same wafer: the pMOS in a pocket of n-type silicon called a <dfn data-def="A region of a wafer doped to the opposite type, so that transistors of the other kind can be built in it.">well</dfn>.</p>`
		},
		// ------------------------------------------------------------------ logic
		{
			id: 'inverter',
			chapter: 'logic',
			title: 'Two transistors make a NOT gate',
			scene: 'inverter',
			hints: { phase: 'inverter' },
			duration: 28,
			controls: [gate('vin', 'Input voltage', 0)],
			body: `
<p>Put a pMOS above an nMOS, join their gates as the input and their drains as the output. This is the <dfn data-def="Complementary MOS: logic built from pairs of nMOS and pMOS transistors, one network pulling the output up to the supply and the other pulling it down to ground.">CMOS</dfn> inverter, the <a href="../logic-gates/#gates">NOT gate</a>.</p>
<p><strong>Slide the input</strong>. At 0 V (a 0) the pMOS is on and the nMOS is off: the output is connected to the supply and reads 1.8 V (a 1). At 1.8 V the roles swap and the output is pulled to ground. In between, the curve on the right drops steeply around <strong>0.9 V</strong>: a small change of the input there swings the output all the way, so slightly wrong voltages get cleaned up gate after gate.</p>
<p>Watch the current meter. In either steady state one of the two transistors is off, so practically nothing flows from supply to ground. Current flows only for the instant of switching. That is why a chip with billions of transistors does not melt.</p>`,
			notes: `<p>The output voltage is found by asking where the nMOS (pulling down) and the pMOS (pulling up) carry exactly the same current, with the transistor model of the previous steps. Because the pMOS is made 4.5 times wider, the two are equally strong and the switching point is exactly half the supply. CMOS was invented by Frank Wanlass at Fairchild in 1963. A chip's power still goes mostly into switching: every switch charges or empties the tiny capacitance of the wires and gates it drives. In today's tiny transistors the leakage when “off” has also become a large share.</p>`
		},
		{
			id: 'nand',
			chapter: 'logic',
			title: 'Four transistors make a NAND',
			scene: 'inverter',
			hints: { phase: 'nand' },
			duration: 26,
			controls: [
				{ type: 'toggle', id: 'a', label: 'Input A', default: true },
				{ type: 'toggle', id: 'b', label: 'Input B', default: false }
			],
			body: `
<p>Add a second input. Two pMOS go side by side (in <dfn data-def="Connected so that current can take either path: the combination conducts if either one does.">parallel</dfn>) from the supply, and two nMOS one above the other (in <dfn data-def="Connected one after the other: current must pass through both, so the combination conducts only if both do.">series</dfn>) to ground.</p>
<p><strong>Flip the inputs</strong>. The output is pulled down only if <em>both</em> nMOS are on, that is, if A <em>and</em> B are 1. In every other case at least one pMOS is on and the output is high. The gate computes NOT (A AND B): a <dfn data-def="Not-AND: a gate whose output is 0 only when all its inputs are 1.">NAND</dfn>.</p>
<p>Again exactly one of the two networks conducts in each case, never both. Every gate of the <a href="../logic-gates/">adders</a> can be built this way, and in fact NAND alone is enough to build all of them.</p>`,
			notes: `<p>NAND is the cheapest CMOS gate after NOT: an AND gate is a NAND followed by an inverter, six transistors in all. A full adder takes about 28 transistors in standard CMOS, and a register file, a cache or a multiplier is many thousands of these cells side by side.</p>`
		},
		// ------------------------------------------------------------------ fab
		{
			id: 'wafer',
			chapter: 'fab',
			title: 'From wafer to transistor',
			scene: 'wafer',
			duration: 28,
			controls: [
				{
					type: 'range',
					id: 'zoom',
					label: 'Zoom',
					min: 0,
					max: 4,
					step: 0.01,
					default: 0,
					format: (v) =>
						['wafer', 'chip', 'block', 'cells', 'transistor'][Math.min(4, Math.round(v))],
					help: 'From 300 mm across down to a few hundred nanometres.'
				}
			],
			body: `
<p>Chips are made on <dfn data-def="A thin disc sawn from a single crystal of very pure silicon; chips are built on its polished surface.">wafers</dfn>: discs of single-crystal silicon <strong>300 mm</strong> across and under a millimetre thick. Each wafer carries hundreds of identical chips side by side, built all at once and sawn apart only at the end.</p>
<p><strong>Zoom in</strong>. A chip the size of Apple's M1 (about 119 mm²) fits about 500 times on one wafer. Inside it are blocks (processor cores, memory, graphics), made of rows of standard <dfn data-def="A small pre-designed group of transistors, such as a NAND gate or a memory bit, laid out to a fixed height so that thousands can be placed in rows.">cells</dfn>, made of transistors. The M1 has <strong>16 billion</strong> of them: one wafer holds some 8 trillion.</p>
<p>Nobody places them one at a time. Every layer of every transistor on a wafer is printed in under a minute, the way a photograph is printed: with light, through a stencil.</p>`,
			notes: `<p>The wafer drawn holds 509 whole chips of 10.9 × 10.9 mm that keep 3 mm clear of the edge; the usual estimate πr²/S − πd/√(2S) for chips of area S on a wafer of diameter d gives 532. Defects then spoil a fraction of them. The M1's 16 billion transistors are Apple's figure; its area of about 119 mm² was measured by TechInsights, as Apple does not publish it. The rows of cells (210 nm tall) and the spacing of the gates (51 nm) are those Angstronomics measured on TSMC's 5 nm process, the one the M1 is made on; the layouts themselves are schematic, not the M1's real ones.</p>`
		},
		{
			id: 'films',
			chapter: 'fab',
			title: 'Grow and deposit thin films',
			scene: 'process',
			hints: { phase: 'films' },
			duration: 20,
			body: `
<p>Follow one transistor through the factory. It starts as bare p-type silicon, polished flat to within a few atoms.</p>
<p>First the wafer is heated to around 1000 °C in pure oxygen. The surface silicon combines with it into a perfect layer of silicon dioxide, glass: this <dfn data-def="Growing silicon dioxide on silicon by heating it in oxygen or steam. The glass grows from the silicon itself, so the interface is almost perfect.">thermal oxidation</dfn> makes the gate's insulator, here 4 nm thick.</p>
<p>Then a film of <dfn data-def="Silicon made of many tiny crystals instead of one; heavily doped, it conducts well and was the classic gate material.">polysilicon</dfn>, which will become the gate, is <dfn data-def="Building up a film on the wafer from a gas (chemical vapour deposition), a vapour or a liquid, a few atoms at a time.">deposited</dfn> over everything from a gas of silane (SiH<sub>4</sub>) that decomposes on the hot surface. Both films cover the whole wafer: the pattern comes next.</p>`,
			notes: `<p>This is the classic “self-aligned polysilicon gate” process of the 1970s to 2000s, simplified. Since about 2007 the gate oxide has been replaced by “high-k” insulators such as hafnium oxide and the polysilicon by metals, because a 1 nm glass layer leaks too much, but the sequence of film, pattern, etch and dope is the same.</p>`
		},
		{
			id: 'litho',
			chapter: 'fab',
			title: 'Coat, expose through a mask, develop',
			scene: 'process',
			hints: { phase: 'litho' },
			duration: 24,
			body: `
<p>Now the pattern. The wafer is spun while a drop of <dfn data-def="A light-sensitive polymer. In a positive resist the exposed areas become soluble in the developer; in a negative resist they become insoluble.">photoresist</dfn> is spread into an even film. In the scanner, ultraviolet light shines through a <dfn data-def="A glass plate carrying the pattern of one layer in an opaque film (chrome). It is drawn four times larger than the pattern it prints.">mask</dfn>: wherever the mask is clear, the light reaches the resist and changes its chemistry; where the mask is opaque, it doesn't.</p>
<p>A lens shrinks the mask's image four times. Each flash exposes a field up to <strong>26 × 33 mm</strong> at once (six chips the size of the M1: about a hundred billion transistors), then the wafer steps to the next field.</p>
<p>The wafer is then washed in a <dfn data-def="The solution that dissolves the exposed (positive resist) or unexposed (negative resist) parts of the photoresist.">developer</dfn>. With a positive resist, the exposed parts dissolve. What is left is a stencil of resist on top of the films, shaped exactly like the opaque parts of the mask: here, one strip over the future gate.</p>`,
			notes: `<p>This is <dfn data-def="Printing a pattern by exposing a light-sensitive film through a mask; from the Greek for writing on stone.">photolithography</dfn>. The resist is baked before and after the exposure, and the scanner aligns each new mask to the layers already on the wafer to within a few nanometres. A modern chip needs dozens of masks, each a different layer.</p>`
		},
		{
			id: 'etch',
			chapter: 'fab',
			title: 'Etch away what the resist does not cover',
			scene: 'process',
			hints: { phase: 'etch' },
			duration: 20,
			body: `
<p>Next the wafer goes into a <dfn data-def="Removing material by chemical attack, with a liquid (wet etching) or with reactive ions from a plasma (dry etching).">plasma etcher</dfn>. Ions from a glowing gas, accelerated straight down onto the wafer, eat away the polysilicon and the oxide wherever the resist does not protect them. Because they come straight down, the walls they leave are vertical.</p>
<p>Then the resist has done its job and is stripped off. What remains is the pattern of the mask, now carved in the films themselves: a gate stack of polysilicon on its thin oxide, and bare silicon on either side.</p>`,
			notes: `<p>Etching must be <em>selective</em>: the chemistry is chosen to attack polysilicon far faster than the resist above it and the oxide below, so that it stops on the right layer. Etching that goes straight down (anisotropic) rather than in all directions is what lets features be narrower than the films are thick.</p>`
		},
		{
			id: 'dope',
			chapter: 'fab',
			title: 'Dope the source and drain',
			scene: 'process',
			hints: { phase: 'dope' },
			duration: 22,
			body: `
<p>Now the source and drain. An <dfn data-def="A machine that ionises atoms of a dopant, accelerates them through tens of thousands of volts and fires them into the wafer, where they come to rest just below the surface.">ion implanter</dfn> fires arsenic or phosphorus ions into the wafer. Where they hit bare silicon they bury themselves just below the surface and make it n-type. Where they hit the gate, they stop in it.</p>
<p>So the gate itself is the stencil: source and drain end up exactly at its two edges, with no second alignment needed. This <dfn data-def="A process in which an already-made structure (here the gate) serves as the mask for the next step, so the two line up automatically.">self-aligned</dfn> gate is a trick from the late 1960s that chips still use.</p>
<p>A quick heating to about 1000 °C then repairs the crystal damaged by the impacts and lets the dopant atoms take their places in the lattice, where they <a href="../semiconductors/#donor">release their electrons</a>. The transistor is complete.</p>`,
			notes: `<p>Implantation is precise: the dose is counted as the electric charge the ion beam delivers, and the depth is set by the ions' energy. The pMOS transistors are doped with boron in a separate step, with another mask covering the nMOS ones.</p>`
		},
		{
			id: 'wiring',
			chapter: 'fab',
			title: 'Repeat: contacts and layers of wiring',
			scene: 'process',
			hints: { phase: 'wiring' },
			duration: 24,
			body: `
<p>Billions of transistors are useless until they are connected. So the cycle repeats, layer after layer: <strong>deposit</strong> an insulating film, <strong>coat</strong> it with resist, <strong>expose</strong> it through the next mask, <strong>etch</strong> holes and trenches, fill them with metal (tungsten for the contacts, copper for the wires) and polish the surface flat again.</p>
<p>The lowest wires are as fine as the transistors; each layer above is coarser, ending in thick power lines and the pads that connect the chip to its package. A modern processor has more than ten layers of wiring and needs dozens of masks and hundreds of process steps, which take a wafer two to three months.</p>`,
			notes: `<p>Copper replaced aluminium for wiring in 1997 (IBM): copper conducts better but would diffuse into silicon and spoil it, so each copper wire sits in a thin barrier lining. Copper cannot easily be etched, so its wires are made in reverse: trenches are etched in the insulator, filled with copper, and the excess is polished off (the “damascene” process, named after inlaid metalwork). Chemical–mechanical polishing keeps each layer flat enough for the next exposure to be in focus.</p>`
		},
		// ------------------------------------------------------------------ smaller
		{
			id: 'resolution',
			chapter: 'smaller',
			title: 'How small can light print?',
			scene: 'litho',
			duration: 30,
			controls: [
				{
					type: 'select',
					id: 'tool',
					label: 'Scanner',
					default: 'arfi',
					options: TOOLS.map((t) => ({ value: t.id, label: `${t.light}, NA ${t.na}` }))
				},
				{
					type: 'range',
					id: 'k1',
					label: 'Line width, as k₁ = half-pitch × NA / λ',
					min: 0.2,
					max: 0.6,
					step: 0.005,
					default: 0.4,
					format: (v) => v.toFixed(3),
					help: 'The half-pitch is the width of one line (or one gap) in a pattern of equal lines and gaps.'
				}
			],
			body: `
<p>Light is a wave, and a wave cannot be focused to a point. Light passing through a mask of fine lines spreads out into a set of beams at angles that grow as the lines get finer. The lens can only rebuild the pattern if it catches at least two of those beams, and it catches angles only up to its <dfn data-def="NA: how wide a cone of light a lens collects, n·sin θ. Air limits it to below 1; water between lens and wafer lets it reach 1.35.">numerical aperture</dfn>, NA. That is the <dfn data-def="The smallest printable half-pitch is k₁·λ/NA, where λ is the wavelength, NA the numerical aperture and k₁ a factor set by the process, never below 0.25 for a single exposure.">Rayleigh criterion</dfn>:</p>
<p class="formula">half-pitch = k<sub>1</sub> · λ / NA</p>
<p><strong>Narrow the lines</strong> with the slider and watch the image of the mask on the wafer lose contrast and vanish as k<sub>1</sub> falls towards <strong>0.25</strong>, whichever scanner you pick. Below that no image forms at all. The only ways down are a shorter wavelength λ or a wider NA: <strong>change the scanner</strong>. Water under the lens took 193 nm light to NA 1.35 and lines of 38 nm; extreme ultraviolet light, 13.5 nm, prints 13 nm, and High-NA EUV 8 nm.</p>`,
			notes: `<p>The image is computed from the waves (Abbe's method): a mask of equal lines and gaps sends light into diffraction orders at sin θ = mλ/p for a pitch p, and the image is the interference of the orders that get through the lens, summed over the points of the light source. Light here comes from two spots tilted to either side (“dipole” illumination at 0.65–0.95 of the NA), which lets the lens catch two orders down to k<sub>1</sub> = 0.256. It is an ideal, perfectly focused lens; real resists and imperfect optics need some margin, which is why the scanners' quoted resolutions correspond to k<sub>1</sub> of 0.27–0.36. Chipmakers go below one exposure's limit by splitting a layer over two to four masks (multi-patterning). EUV light is absorbed by everything, air included, so EUV scanners use mirrors in a vacuum instead of lenses; the light comes from droplets of tin vaporised by a laser 50,000 times a second. The “3 nm” or “5 nm” in the name of a manufacturing process is a label, not the size of any feature on the chip.</p>`
		},
		{
			id: 'moore',
			chapter: 'smaller',
			title: 'Twice as many every two years',
			scene: 'moore',
			duration: 26,
			controls: [
				{
					type: 'range',
					id: 'year',
					label: 'Year',
					min: 1972,
					max: 2022,
					step: 1,
					default: 2022,
					help: 'Chips released after this year are dimmed.'
				}
			],
			body: `
<p>Each new generation of lithography let the same area of silicon hold about twice as many transistors. The chart plots the number of transistors on microprocessors from Intel's first, the <strong>4004</strong> of 1971 with 2,300, to chips of over <strong>50 billion</strong> fifty years later. Each gridline is ten times the one below.</p>
<p>On this scale steady doubling is a straight line. Fitted to these chips, the count doubles every <strong>2.0 years</strong>: <dfn data-def="Gordon Moore's observation (1965, revised in 1975) that the number of transistors on a chip doubles about every two years.">Moore's law</dfn>, which held for half a century. Move the year to compare any chip with the 4004.</p>
<p>So the two halves of the story meet: a transistor is a switch controlled by a voltage, and chips are made by printing billions of those switches at once, with light.</p>`,
			notes: `<p>Data: Karl Rupp, <i>Microprocessor Trend Data</i> (CC BY 4.0), with data up to 2010 collected by M. Horowitz, F. Labonte, O. Shacham, K. Olukotun, L. Hammond and C. Batten. The line is a least-squares fit of the logarithm of the count to the year over all 99 chips. The three named chips are identified by their year and count (Intel's 4004; Apple's M1 and M1 Max, whose counts are Apple's). Moore first predicted a doubling every year (1965) and revised it to every two years in 1975. Counts kept rising after 2005, but clock speeds stopped, because shrinking transistors no longer cut their power as before; the extra transistors went into more processor cores instead.</p>`
		}
	]
};
