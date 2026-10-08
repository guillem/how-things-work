import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const gateKind: Control = {
	type: 'select',
	id: 'gateKind',
	label: 'Gate',
	default: 'AND',
	options: [
		{ value: 'AND', label: 'AND' },
		{ value: 'OR', label: 'OR' },
		{ value: 'NOT', label: 'NOT' },
		{ value: 'XOR', label: 'XOR' }
	]
};

const tool: Control = {
	type: 'select',
	id: 'tool',
	label: 'Add',
	default: 'AND',
	options: [
		{ value: 'AND', label: 'AND gate' },
		{ value: 'OR', label: 'OR gate' },
		{ value: 'NOT', label: 'NOT gate' },
		{ value: 'XOR', label: 'XOR gate' },
		{ value: 'erase', label: 'Eraser' }
	],
	help: 'Click empty space to add the gate; drag from an output to an input to wire; click a switch to flip it.'
};

const challenge: Control = {
	type: 'select',
	id: 'challenge',
	label: 'Challenge',
	default: 'free',
	options: [
		{ value: 'free', label: 'Free play' },
		{ value: 'half', label: 'Build a half adder' }
	]
};

const resetCanvas: Control = {
	type: 'action',
	id: 'resetCanvas',
	label: 'Start again',
	action: 'Start again'
};

const a4: Control = {
	type: 'range',
	id: 'a4',
	label: 'First number',
	min: 0,
	max: 15,
	step: 1,
	default: 11
};
const b4: Control = {
	type: 'range',
	id: 'b4',
	label: 'Second number',
	min: 0,
	max: 15,
	step: 1,
	default: 6
};

export const spec: ExplainerSpec = {
	slug: 'logic-gates',
	title: 'How computers add: logic gates',
	summary:
		'Flip switches into AND, OR, NOT and XOR gates, wire them into a circuit with a live truth table, and build the adders at the heart of every processor.',
	chapters: [
		{ id: 'gates', title: 'Gates' },
		{ id: 'adders', title: 'Adders' },
		{ id: 'build', title: 'Build your own' }
	],
	steps: [
		{
			id: 'gates',
			chapter: 'gates',
			title: 'Four simple gates',
			scene: 'canvas',
			hints: { phase: 'gates' },
			duration: 26,
			controls: [gateKind],
			body: `
<p>Inside a chip, a bit is a wire that is either on (1) or off (0). A <dfn data-def="A tiny circuit, made of a few transistors, whose output is on or off depending on its inputs according to a fixed rule.">logic gate</dfn> takes one or two such wires in and produces one out:</p>
<ul><li><strong>AND</strong> is on only if both inputs are on;</li><li><strong>OR</strong> is on if either (or both) is on;</li><li><strong>NOT</strong> flips its single input;</li><li><strong>XOR</strong> ("exclusive or") is on if exactly one input is on.</li></ul>
<p>Click the switches and watch the lamp. The <dfn data-def="A list of every combination of inputs with the output for each.">truth table</dfn> beside it lists every possible combination; the row you are on lights up.</p>`,
			notes: `<p>Each gate is built from a handful of transistors acting as switches. In modern chips there are billions of them, switching billions of times a second.</p>`
		},
		{
			id: 'half',
			chapter: 'adders',
			title: 'A half adder',
			scene: 'canvas',
			hints: { phase: 'half', circuit: 'half' },
			duration: 26,
			body: `
<p>How do you add two bits? 0 + 0 = 0, 0 + 1 = 1, 1 + 0 = 1, and 1 + 1 = 10 in binary: write 0, carry 1. Look at the two columns of that answer.</p>
<p>The right-hand digit, the <strong>sum</strong>, is 1 when exactly one input is 1 — that's XOR. The left digit, the <strong>carry</strong>, is 1 only when both are — that's AND. Two gates side by side make a <dfn data-def="A circuit that adds two bits, giving a sum bit and a carry bit: Sum = A XOR B, Carry = A AND B.">half adder</dfn>. Flip the switches and watch the signals travel through the gates.</p>`
		},
		{
			id: 'full',
			chapter: 'adders',
			title: 'A full adder',
			scene: 'canvas',
			hints: { phase: 'full', circuit: 'full' },
			duration: 28,
			body: `
<p>A half adder can't take a carry coming in from the column to its right. A <dfn data-def="A circuit that adds three bits — two digits and a carry in — giving a sum bit and a carry out.">full adder</dfn> can: it is two half adders and an OR gate. The first adds A and B; the second adds the carry in; if either produced a carry, the OR passes it on.</p>
<p>Five gates, and it adds three bits. Try all eight combinations of the switches and check the table.</p>`
		},
		{
			id: 'four',
			chapter: 'adders',
			title: 'A 4-bit adder',
			scene: 'ripple',
			hints: { phase: 'four' },
			duration: 30,
			controls: [a4, b4],
			body: `
<p>Chain four full adders, each passing its carry out to the next one's carry in, and you can add two 4-bit numbers — 0 to 15 each. This is a <dfn data-def="An adder made of a chain of full adders, in which each carry passes ('ripples') to the next column.">ripple-carry adder</dfn>: the carries ripple from right to left, exactly as when you add on paper.</p>
<p>Set two numbers and watch the carries ripple along. A processor adds 64-bit numbers the same way (with tricks to stop waiting for the ripple), and from adding it builds subtraction, multiplication and everything else.</p>`
		},
		{
			id: 'build',
			chapter: 'build',
			title: 'Build your own',
			scene: 'canvas',
			hints: { phase: 'build', edit: true },
			duration: 40,
			controls: [tool, challenge, resetCanvas],
			body: `
<p>Your turn: add gates, wire outputs to inputs, flip the switches, and the truth table updates as you build. Pick the challenge to rebuild a half adder from scratch: the table turns green when your circuit is right.</p>
<p><strong>A few kinds of simple gate, combined, can compute any logical or arithmetic function.</strong> In fact one kind is enough: every gate here can be made from NAND gates alone ("not AND").</p>`,
			notes: `<p>Circuits like these, with no loops, compute a fixed function of their inputs. Feeding outputs back into inputs makes circuits that can <em>remember</em> — the flip-flops that store bits in a processor — which this page doesn't allow.</p>`
		}
	]
};
