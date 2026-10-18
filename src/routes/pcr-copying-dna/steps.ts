import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Scenes: `tube` (the tube and what goes in it), `cycle` (one cycle as four panels under the
 * temperature profile), `strands` (every strand after each of the first cycles), `curve` (the
 * copies against the cycle number; hints below) and `primers` (the two real targets and which one
 * a pair of primers copies).
 *
 * `curve` hints: `mode` = `doubling` (one run played cycle by cycle, with the primers and
 * building blocks left), `plateau` (three starting amounts on a linear scale), `threshold` (a
 * chosen starting amount against the detection line, with its threshold cycle) or `standard`
 * (a tenfold dilution series and its threshold cycles against the starting amount).
 */

const STAGES = ['Start', 'Heat: split', 'Cool: primers stick', 'Warm: copy'];

const yesNo = (id: string, label: string, def: boolean, help?: string): Control => ({
	type: 'toggle',
	id,
	label,
	default: def,
	help
});

const POWERS = ['1', '10', '100', '1,000', '10,000', '100,000', '1,000,000'];

export const spec: ExplainerSpec = {
	slug: 'pcr-copying-dna',
	title: 'PCR: copying DNA until there is enough to see',
	summary:
		'Follow a stretch of DNA through the heating and cooling cycles of the polymerase chain reaction: two strands become four, then eight, until thirty cycles have made a billion copies. Then read a PCR test the way the machine does: the fewer copies in the swab, the later the glow crosses the detection line, about ten cycles later for one copy than for a thousand.',
	chapters: [
		{ id: 'cycle', title: 'One cycle' },
		{ id: 'doubling', title: 'Doubling, until it stops' },
		{ id: 'test', title: 'Reading a test' }
	],
	steps: [
		// ------------------------------------------------------------------ cycle
		{
			id: 'tube',
			chapter: 'cycle',
			title: 'Too little DNA to see',
			scene: 'tube',
			duration: 20,
			body: `
<p>A throat swab may carry only a few hundred copies of a virus’s genes, among millions of letters of the person’s own DNA. No instrument can see a few hundred molecules. The <strong>polymerase chain reaction</strong> (PCR) does not try: it copies one chosen stretch of DNA, again and again, until there are billions of copies, enough to see.</p>
<p>Everything happens in one small tube, with:</p>
<ul><li>the sample’s DNA, the <b>template</b>;</li>
<li>two <dfn data-def="Short single strands of DNA, about 20 letters long, made to match the two ends of the stretch to be copied. Copying starts only where a primer has paired.">primers</dfn>, short pieces that match the two ends of the chosen stretch;</li>
<li>loose <b>building blocks</b>, the four nucleotides A, C, G and T;</li>
<li>a <dfn data-def="The enzyme that builds a new DNA strand along an old one, letter by letter, pairing A with T and C with G. It can only extend a strand that is already started, such as a primer.">DNA polymerase</dfn>, the enzyme that copies a strand, as it does in a dividing cell.</li></ul>
<p>The tube sits in a machine that heats and cools it, about forty times.</p>`,
			notes: `<p>Kary Mullis devised PCR in 1983 and shared the 1993 Nobel Prize in Chemistry for it. It became practical with a polymerase from <i>Thermus aquaticus</i>, a bacterium of hot springs, which survives the near-boiling step of every cycle: earlier enzymes were destroyed by it and had to be added again each cycle.</p>`
		},
		{
			id: 'cycle',
			chapter: 'cycle',
			title: 'Heat, cool, warm: two strands become four',
			scene: 'cycle',
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'stage',
					label: 'Stage of the cycle',
					min: 0,
					max: 3,
					step: 1,
					default: 3,
					format: (v) => STAGES[Math.round(v)] ?? '',
					disabled: (p) => p.auto === true
				},
				yesNo('auto', 'Go round by itself', true, 'Off: step through the cycle with the slider.')
			],
			body: `
<p>One cycle has three temperatures (typical values):</p>
<ul><li><strong>Heat to about 95 °C.</strong> The two strands of each DNA molecule come apart: the heat breaks the weak bonds between the paired letters, not the strands themselves.</li>
<li><strong>Cool to about 55 °C.</strong> The primers find their matching letters and pair with them, one primer on each strand, at the two ends of the chosen stretch. There are far more primers than template strands, so the primers pair before the long strands can find each other again.</li>
<li><strong>Warm to about 72 °C.</strong> The polymerase extends each primer along its strand, adding the matching building block letter by letter.</li></ul>
<p>Two strands went in; four come out, as two double strands, each with one old and one new strand. Each new strand starts at a primer, but nothing stops it at the far end of the chosen stretch: in this first cycle the copies run on past it.</p>`,
			notes: `<p>The temperatures depend on the primers and the polymerase: the cooling step is set a few degrees below the temperature at which the primers would come off their match. Many diagnostic tests merge the last two steps into one, letting the polymerase work at the primers’ temperature, and a cycle then takes well under a minute.</p>`
		},
		{
			id: 'strands',
			chapter: 'cycle',
			title: 'The exact piece appears in cycle 3',
			scene: 'strands',
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'cycles_s',
					label: 'Cycles',
					min: 0,
					max: 4,
					step: 1,
					default: 3,
					help: 'Arrow keys on the slider step one cycle at a time.'
				}
			],
			body: `
<p>Follow every strand. The original two strands (grey) are long, and each cycle they serve as templates again, making two <b>overlong</b> copies (amber) that start at a primer but run to the end of the template.</p>
<p>In cycle 2 an overlong copy is copied in turn. Its copy starts at the other primer and must stop where the overlong strand ends, at the first primer: a strand exactly the chosen stretch, but still paired with a longer one. Only in <strong>cycle 3</strong> do two double strands appear that are <strong>exactly the target</strong> (violet) on both strands.</p>
<p>From then on they take over: the target copies double every cycle, while the overlong ones only grow by two a cycle. After 10 cycles 98% of the double strands are exactly the target; after 30, all but one in about 18 million.</p>`,
			notes: `<p>In a real sample the template is a long genome, and the overlong strands end wherever the polymerase happens to stop. Their number still grows by only two per original strand per cycle, so they never matter. The page’s template is drawn short so that every strand fits.</p>`
		},
		// ------------------------------------------------------------------ doubling
		{
			id: 'doubling',
			chapter: 'doubling',
			title: 'Thirty cycles, a billion copies',
			scene: 'curve',
			hints: { mode: 'doubling', start: 1, play: 'play_d', cycle: 'cycle_d' },
			duration: 40,
			controls: [
				{
					type: 'range',
					id: 'cycle_d',
					label: 'Cycle',
					min: 0,
					max: 45,
					step: 1,
					default: 30,
					disabled: (p) => p.play_d === true
				},
				yesNo(
					'play_d',
					'Play the cycles',
					true,
					'Runs the 45 cycles of a test, about one every half second. The slider follows it, and takes over when you switch it off.'
				)
			],
			body: `
<p>Start from one double strand of the target and let the cycles run. Each one doubles it: 2, 4, 8, 16… After 10 cycles there are 1,024 copies, after 20 about a million, after <strong>30 about a billion</strong> (2³⁰ = 1,073,741,824).</p>
<p>On the plot each line up is <b>ten times</b> more copies, so steady doubling is a straight climb. Every new copy uses up one primer of each kind and the building blocks of its new letters: watch the two gauges under the tube.</p>
<p>A test usually runs 40 to 45 cycles. Keep watching after cycle 35.</p>`,
			notes: `<p>Here every cycle copies every strand. Real reactions copy 90 to 100% of the strands each cycle (their <dfn data-def="The fraction of the template strands that get copied in one cycle; 100% means exact doubling.">efficiency</dfn>), which the last step of the page lets you change. The tube is a typical 20 µL test with each primer at 500 nM (the concentration of the US CDC’s COVID-19 test), so it holds about 6 × 10¹² primers of each kind, and each building block at 0.2 mM.</p>`
		},
		{
			id: 'plateau',
			chapter: 'doubling',
			title: 'The primers run out, and the curve flattens',
			scene: 'curve',
			hints: { mode: 'plateau', linear: 'linear_p' },
			duration: 30,
			controls: [
				yesNo(
					'linear_p',
					'Plain scale (not ×10 per line)',
					true,
					'Off: each line up is ten times more copies.'
				)
			],
			body: `
<p>Doubling cannot go on for ever. Near six million million copies (6 × 10¹²) there are as many copies as there were primers, and a strand can only be copied if a primer pairs with it. As the primers run low, fewer strands are copied each cycle, and the curve <strong>flattens</strong> into a <dfn data-def="The flat end of the curve, where the reaction has used up what it needs and adds almost nothing per cycle.">plateau</dfn>. The building blocks barely dent: the copied piece is short (72 letters here), and the primers run out first.</p>
<p>Three tubes start with 10, 1,000 and 100,000 copies, a 10,000-fold difference. They <strong>all end at the same height</strong>. The plateau is set by what was in the tube, not by what was in the sample: it says nothing about the starting amount.</p>
<p>What differs is <em>when</em> each curve rises. On a plain scale the rise looks sudden, but the curves were climbing all along, too low to see.</p>`,
			notes: `<p>The page’s tube flattens when its primers are used up, the simplest reason. Real reactions often flatten earlier: as copies pile up, they pair with each other faster than with the primers, and there are too few polymerase molecules for all the templates. Either way the plateau depends on the tube, not on the start.</p>`
		},
		// ------------------------------------------------------------------ test
		{
			id: 'threshold',
			chapter: 'test',
			title: 'The cycle that crosses the line',
			scene: 'curve',
			hints: { mode: 'threshold', start: 'start_t', linear: 'linear_t' },
			duration: 40,
			controls: [
				{
					type: 'range',
					id: 'start_t',
					label: 'Copies at the start',
					min: 0,
					max: 6,
					step: 1,
					default: 3,
					format: (v) => POWERS[Math.round(v)] ?? ''
				},
				yesNo('linear_t', 'Plain scale (not ×10 per line)', false)
			],
			body: `
<p>A PCR test reads the copies while they are made. The tube also holds a <dfn data-def="A short DNA strand that pairs inside the copied stretch and carries a glowing dye held dark by a quencher. The polymerase breaks it as it copies past, freeing the dye to glow.">probe</dfn> that glows once a copy has been made over it, so the glow grows with the number of copies. The machine shines light on the tube every cycle and measures it.</p>
<p>The glow becomes measurable at a fixed level, the <strong>detection line</strong> (here 10 billion copies). The cycle at which a curve crosses it is the <strong>threshold cycle</strong>, <b>Ct</b>. Change the starting copies: <strong>one copy crosses about 10 cycles later than 1,000</strong>, because 1,000 is about 2¹⁰, and every tenfold more copies at the start crosses about 3.3 cycles sooner.</p>
<p>So a <strong>low Ct means many copies</strong> in the sample, a high Ct few. A test calls the sample positive if the curve crosses before a cut-off, often 35 to 40 cycles.</p>`,
			notes: `<p>The detection line depends on the dye and the instrument; 10 billion copies is a round number for the page. The CDC’s COVID-19 test runs 45 cycles. SARS-CoV-2 is an RNA virus, so a test first copies its RNA into DNA with another enzyme, reverse transcriptase (RT-PCR), and then runs the cycles on that DNA.</p>`
		},
		{
			id: 'standard',
			chapter: 'test',
			title: 'What a Ct says, and what it does not',
			scene: 'curve',
			hints: { mode: 'standard', efficiency: 'eff_s' },
			duration: 30,
			controls: [
				{
					type: 'select',
					id: 'eff_s',
					label: 'Strands copied each cycle',
					default: '1',
					options: [
						{ value: '1', label: '100% (exact doubling)' },
						{ value: '0.9', label: '90%' },
						{ value: '0.8', label: '80%' }
					]
				}
			],
			body: `
<p>A lab can measure how many copies a Ct means. It runs tubes with known amounts, ten times apart, and plots their Ct against the amount: a straight line, here <strong>3.3 cycles per tenfold</strong>. Copy less than every strand each cycle and the steps widen, so the same Ct means a different amount.</p>
<p>A Ct tells how many copies of the target were <em>in the tube</em>. That depends on the person, but also on how deep the swab went, how long after infection it was taken, and on the lab’s chemistry, instrument and line. So <strong>a Ct is not a measure of how ill someone is</strong>: a high Ct can be an infection just starting, or one ending with leftover fragments, and the same sample can give different Ct values in different labs.</p>`,
			notes: `<p>Labs check a test’s efficiency from the slope of this line: 3.32 cycles per tenfold is 100%, and slopes from about 3.1 to 3.6 (90 to 110%) are usually accepted. At very low amounts the copies are a matter of chance: a tube expected to hold one copy may hold none or two, so Ct values near the limit vary from tube to tube.</p>`
		},
		{
			id: 'primers',
			chapter: 'test',
			title: 'The primers choose what is copied',
			scene: 'primers',
			hints: { primers: 'primers', virus: 'virus' },
			duration: 30,
			controls: [
				{
					type: 'select',
					id: 'primers',
					label: 'Primers',
					default: 'n1',
					options: [
						{ value: 'n1', label: 'Virus (CDC N1)' },
						{ value: 'rp', label: 'Human control (CDC RNase P)' }
					]
				},
				yesNo('virus', 'The swab carries the virus', true)
			],
			body: `
<p>The tube holds two real stretches of DNA: a piece of the coronavirus’s N gene and a piece of a human gene, <i>RPP30</i>, that every cell of the swab carries. A primer pairs only where the letters match its own, so <strong>the primers choose what is copied</strong>. The US CDC’s COVID-19 test used these primers.</p>
<p>With the <b>N1</b> primers both pair on the virus’s strands, 72 letters apart, and that piece is copied. On the human strand they find no match, and it stays uncopied, however much of it there is. Switch to the <b>RNase P</b> primers and it is the other way round.</p>
<p>Take the virus out of the swab: the N1 tube stays dark, while the RNase P tube still glows. That second tube is the test’s <strong>control</strong>: it shows that the swab collected human cells and the reaction worked, so a dark N1 tube means “no virus found”, not “nothing in the tube”.</p>`,
			notes: `<p>The page’s rule is strict: a primer pairs only where all its letters match. Real primers can tolerate a mismatch or two, especially away from their 3′ end (where the polymerase starts), which is why primers are chosen so that no other DNA in the sample comes close. The virus’s piece is from the reference genome (NCBI NC_045512.2, positions 28,287 to 28,358); the human piece from chromosome 10 (NC_000010.11); the primers from the CDC’s published panel.</p>`
		}
	]
};
