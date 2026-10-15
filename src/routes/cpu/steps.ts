import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { MAX_INSTRUCTIONS } from './cpu';

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Run by itself',
	default: true,
	help: 'Off: one tick at a time. Press Step, or focus the marker on the timeline and use the arrow keys.'
};

const pace: Control = {
	type: 'range',
	id: 'pace',
	label: 'Clock speed',
	min: 1,
	max: 60,
	step: 1,
	default: 2,
	unit: ' ticks/s',
	help: 'Each tick of this machine’s clock does one phase: a fetch, a decode or an execute.'
};

const tick: Control = {
	type: 'action',
	id: 'tick',
	label: 'Step',
	action: 'Step one tick',
	help: 'Pauses the program and does the next phase.'
};

const rewind: Control = {
	type: 'action',
	id: 'rewind',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to the start: the PC is 0 and memory holds the program as loaded.'
};

const a: Control = {
	type: 'range',
	id: 'a',
	label: 'a',
	min: 0,
	max: 255,
	step: 1,
	default: 23
};
const b: Control = {
	type: 'range',
	id: 'b',
	label: 'b',
	min: 0,
	max: 255,
	step: 1,
	default: 42
};

const example: Control = {
	type: 'select',
	id: 'example',
	label: 'Load an example',
	default: 'sum',
	options: [
		{ value: 'sum', label: '1 + … + 10' },
		{ value: 'countdown', label: 'Countdown' },
		{ value: 'multiply', label: '6 × 7' },
		{ value: 'first', label: '7 + 5' }
	],
	help: 'Loading an example replaces the text in the editor.'
};

const reload: Control = {
	type: 'action',
	id: 'reload',
	label: 'Reset',
	action: 'Reset to example',
	help: 'Puts the chosen example back in the editor, undoing your edits.'
};

const stepper = [play, pace, tick, rewind];

export const spec: ExplainerSpec = {
	slug: 'cpu',
	title: 'How a processor runs a program',
	summary:
		'Step a tiny 8-bit processor through its programs one tick at a time: fetch an instruction, decode it, execute it, and watch loops, decisions and your own code reduce to that one cycle.',
	chapters: [
		{ id: 'cycle', title: 'One small cycle' },
		{ id: 'loops', title: 'Loops and decisions' },
		{ id: 'yours', title: 'Your turn' }
	],
	steps: [
		// ------------------------------------------------------------------- cycle
		{
			id: 'parts',
			chapter: 'cycle',
			title: 'A processor and its memory',
			scene: 'machine',
			hints: { program: 'first', tour: true },
			duration: 24,
			body: `
<p>This is a whole computer, cut down to the bone: a <dfn data-def="The central processing unit: the part of a computer that carries out a program's instructions one after another.">processor</dfn> (CPU) in the middle and a <strong>memory</strong> of 32 bytes on the right. It is a teaching machine, but every part has a counterpart in the chip in your phone.</p>
<ul>
<li><strong>Memory</strong> is a row of numbered boxes, each holding one byte (0–255). The number of a box is its <dfn data-def="The number that identifies a box of memory, so the processor can ask for exactly that byte.">address</dfn>. The <em>program itself</em> is stored here, as bytes, next to the data it works on.</li>
<li>The <strong>program counter</strong> (PC) holds the address of the next instruction.</li>
<li>The <strong>instruction register</strong> (IR) holds the instruction being carried out, and the <strong>control unit</strong> works out what it means.</li>
<li>Four <dfn data-def="A few bytes of very fast storage inside the processor, where it keeps the numbers it is working on.">registers</dfn>, R0 to R3, hold the numbers being worked on.</li>
<li>The <dfn data-def="Arithmetic logic unit: the circuit that does arithmetic (add, subtract) and logic operations (AND, OR, NOT) on bytes, and compares them. It is built from gates, like the adders made of logic gates.">ALU</dfn> (arithmetic logic unit) does the sums. It is the <a href="../logic-gates/#four">adder you can build from logic gates</a>, plus a little more. This one only adds and subtracts.</li>
</ul>
<p>On the left is the program, written as <dfn data-def="A way of writing a processor's instructions as short words (ADD, JMP…) instead of numbers. An assembler translates it into the bytes the processor runs.">assembly language</dfn>: one line per instruction. It adds 7 and 5.</p>`,
			notes: `<p>The design follows the classic teaching computers, such as the SAP-1 (“Simple As Possible”) of A. P. Malvino’s <em>Digital Computer Electronics</em> and the Little Man Computer. Keeping program and data in one memory is called the <em>von Neumann</em> design, after John von Neumann’s 1945 report on the EDVAC; most general-purpose computers since work this way.</p>`
		},
		{
			id: 'fetch',
			chapter: 'cycle',
			title: '1. Fetch',
			scene: 'machine',
			hints: { program: 'first', focus: 'fetch' },
			duration: 18,
			body: `
<p>The processor has already loaded 7 into R0 and 5 into R1. Now it needs its next instruction, and it only knows one place to look: the address in the program counter, 4.</p>
<p>The PC sends that address to memory along the <dfn data-def="The wires that carry an address from the processor to memory.">address bus</dfn>. Memory answers with the two bytes stored there, 65 and 0, which travel back on the <dfn data-def="The wires that carry bytes between the processor and memory, in either direction.">data bus</dfn> into the instruction register. (To keep things simple, this machine fetches both bytes in one tick; a processor that reads memory one byte at a time would need two trips. Being an 8-bit processor doesn't settle that: many 8-bit microcontrollers fetch 16-bit instruction words in one go.)</p>
<p>Then the PC moves on by 2, to 6, so it already points at the instruction after this one. The processor has not yet looked at what the bytes mean.</p>`
		},
		{
			id: 'decode',
			chapter: 'cycle',
			title: '2. Decode',
			scene: 'machine',
			hints: { program: 'first', focus: 'decode' },
			duration: 18,
			body: `
<p>To the processor, an instruction is just bits. The first byte, 65, is <strong>0100 00 01</strong> in binary. The control unit splits it into fields:</p>
<ul>
<li>the top four bits, <strong>0100</strong>, are the <dfn data-def="Operation code: the part of an instruction that says which operation to do.">opcode</dfn>: 4 means ADD;</li>
<li>the next two bits, <strong>00</strong>, name the first register, R0;</li>
<li>the last two, <strong>01</strong>, name the second register, R1.</li>
</ul>
<p>The second byte holds a number or an address for instructions that need one; ADD doesn’t. In hardware, decoding is a network of logic gates that turns those bits into control signals: open R0 and R1 onto the ALU’s inputs, set the ALU to add, and send its result back into R0.</p>`
		},
		{
			id: 'execute',
			chapter: 'cycle',
			title: '3. Execute',
			scene: 'machine',
			hints: { program: 'first', focus: 'execute' },
			duration: 18,
			body: `
<p>Now the instruction happens. R0 (7) and R1 (5) flow into the ALU, which adds them: 12 goes back into R0.</p>
<p>The ALU also sets two <dfn data-def="Single bits the ALU sets after each calculation, which later instructions can test.">flags</dfn>: <strong>Z</strong> (zero) is on when the result is 0, and <strong>C</strong> (carry) is on when an addition overflowed past 255 or a subtraction had to borrow. Both are off here. They look minor, but they are how a program makes decisions.</p>
<p>Other instructions execute differently: LOAD and STORE copy a byte between a register and memory, and a jump writes a new address into the PC.</p>`
		},
		{
			id: 'cycle',
			chapter: 'cycle',
			title: 'Fetch, decode, execute, repeat',
			scene: 'machine',
			hints: { program: 'first' },
			duration: 30,
			controls: stepper,
			body: `
<p>That is the whole job: <strong>fetch</strong> the instruction the PC points at, <strong>decode</strong> it, <strong>execute</strong> it, and start again with the next one. Each phase here takes one tick of the processor’s <dfn data-def="A signal that switches on and off at a steady rate. Each tick moves the processor on by one step.">clock</dfn>.</p>
<p>Watch the five instructions run, or switch off <em>Run by itself</em> and press <em>Step</em> to go one tick at a time. LDI loads a number, ADD adds, STORE writes R0 into memory box 10, and HALT stops the clock. Check box 10 at the end: 12.</p>`
		},
		// ------------------------------------------------------------------- loops
		{
			id: 'countdown',
			chapter: 'loops',
			title: 'Jumps: going round again',
			scene: 'machine',
			hints: { program: 'countdown' },
			duration: 40,
			controls: stepper,
			body: `
<p>So far the PC has only moved forward. A <dfn data-def="An instruction that writes a new address into the program counter, so the next fetch comes from somewhere else.">jump</dfn> changes that: <strong>JMP loop</strong> writes the address of <code>loop</code> into the PC, and the next fetch comes from there. The program goes round again.</p>
<p>Going round forever is no use, so the loop needs a way out. <strong>JZ</strong> (“jump if zero”) jumps only if the Z flag is on, that is, if the last ADD or SUB gave 0. This countdown stores the count, subtracts 1, and leaves the loop when the count reaches 0.</p>
<p>Watch the PC: fetching the JMP moves it on to 12, then the JMP sets it back to 4, and round it goes until the count is 0 and JZ jumps to 12 instead. Memory box 16 shows 5, 4, 3, 2, 1 and finally 0.</p>`
		},
		{
			id: 'sum',
			chapter: 'loops',
			title: 'Adding 1 to 10',
			scene: 'machine',
			hints: { program: 'sum' },
			duration: 40,
			controls: stepper,
			body: `
<p>In a programming language you might write:</p>
<p><code>total = 0<br>for n from 10 down to 1: total = total + n</code></p>
<p>The processor has no “for”. A <dfn data-def="A program that translates a programming language into a processor's instructions.">compiler</dfn> turns that line into a loop of the instructions on the left: add n to the total, subtract 1 from n, leave if n is 0, otherwise jump back.</p>
<p>It takes 44 instructions, 132 ticks of this clock. Turn up the clock speed to run it at speed, and watch box 18 receive the answer: <strong>55</strong>. Every program you have ever used, from a browser to a game, is the same few kinds of instruction in the same cycle, just many more of them.</p>`
		},
		{
			id: 'branch',
			chapter: 'loops',
			title: 'Making a decision',
			scene: 'machine',
			hints: { program: 'max' },
			duration: 34,
			controls: [a, b, play, pace, tick, rewind],
			body: `
<p>“If” in a program is also a conditional jump. This program keeps the larger of two numbers, <i>a</i> and <i>b</i>, stored in memory boxes 16 and 17.</p>
<p>It guesses that <i>b</i> is larger and stores it. Then it works out <i>b</i> − <i>a</i>. If <i>a</i> is bigger, the subtraction has to borrow (a byte can’t go below 0: the result wraps round to the top of the range, and the C flag comes on), and <strong>JC</strong> (“jump if carry”) jumps to code that stores <i>a</i> instead. If not, the jump is skipped and the program stops.</p>
<p>Change <i>a</i> and <i>b</i> and watch which path the PC takes.</p>`,
			notes: `<p>Wrapping round is the same <a href="../binary/#overflow">overflow</a> as in 8-bit binary addition: with <i>a</i> = 42 and <i>b</i> = 23, <i>b</i> − <i>a</i> = 23 − 42 leaves 237 in the register, which is 23 − 42 + 256. Real processors have more flags (negative; overflow, which flags wrap-round for <em>signed</em> numbers the way C does for unsigned ones…) and many conditional jumps, but each one is the same idea: test a flag, and either write a new address into the PC or don’t.</p>`
		},
		// ------------------------------------------------------------------- yours
		{
			id: 'editor',
			chapter: 'yours',
			title: 'Write your own program',
			scene: 'machine',
			hints: { edit: true },
			duration: 60,
			controls: [example, reload, play, pace, tick, rewind],
			body: `
<p>Now edit the program on the left. It is assembled into memory as you type, and the processor starts again from address 0. Mistakes are reported with their line number.</p>
<p>The instructions (R and S are registers R0–R3, n is a number 0–255, a is an address 0–31 or a label):</p>
<ul>
<li><code>LDI R, n</code>: put n in R</li>
<li><code>LOAD R, [a]</code> and <code>STORE R, [a]</code>: copy a byte from memory to R, or from R to memory</li>
<li><code>ADD R, S</code> and <code>SUB R, S</code>: R = R + S or R − S, setting the Z and C flags</li>
<li><code>JMP a</code>, <code>JZ a</code>, <code>JC a</code>: jump always, if zero, if carry (the flags are set only by ADD and SUB)</li>
<li><code>HALT</code>: stop; <code>DATA n</code>: one byte of data</li>
</ul>
<p>Write <code>name:</code> before a line to label it, and <code>;</code> for a comment. Try changing the 10 in the sum to 22 (the total, 253, still fits in a byte) or to 23 (276 doesn’t, and wraps round to 20).</p>`,
			notes: `<p>The machine stops after ${MAX_INSTRUCTIONS.toLocaleString('en')} instructions, so a program that loops forever can’t hang the page. Real processors have no such limit: an endless loop just keeps the processor busy until something interrupts it.</p>`
		},
		// Clock rates: Intel, "Intel Core i9-14900K Processor (36M Cache, up to 6.00 GHz)",
		// specifications: Performance-core Base Frequency 3.2 GHz, Max Turbo Frequency 6 GHz,
		// Total Cores 24, Launch Date Q4'23. https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html
		{
			id: 'speed',
			chapter: 'yours',
			title: 'Billions of times a second',
			scene: 'pipeline',
			duration: 30,
			body: `
<p>This page’s processor runs at 1 to 60 ticks a second, so you can follow it. A real one is the same cycle, very fast: the Intel Core i9-14900K, a desktop processor from 2023, runs its fastest cores at up to <strong>6 GHz</strong>, six billion clock ticks every second.</p>
<p>And it doesn’t wait for one instruction to finish before fetching the next. Like an assembly line, it fetches one instruction while it decodes the one before and executes the one before that: a <dfn data-def="Overlapping the phases of consecutive instructions, so that each part of the processor is busy on every tick.">pipeline</dfn>. With three phases, a pipeline finishes up to one instruction per tick instead of one every three.</p>
<p>Real cores go further, with longer pipelines, several instructions side by side and several cores on one chip. But underneath, each is still fetching an instruction, decoding it and executing it, billions of times a second. <strong>Every program reduces to that one small cycle.</strong></p>`,
			notes: `<p>Clock rates from Intel’s specification page for the Core i9-14900K (performance-core base frequency 3.2 GHz, maximum turbo frequency 6 GHz, 24 cores). Ticks and instructions are not the same thing: a long pipeline adds ticks between fetching an instruction and finishing it, and jumps or waits for memory can stall it, while executing several instructions at once lets a core finish more than one per tick.</p>`
		}
	]
};
