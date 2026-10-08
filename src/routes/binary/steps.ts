import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const width: Control = {
	type: 'select',
	id: 'width',
	label: 'Word size',
	default: '8',
	options: [
		{ value: '8', label: '8 bits (1 byte)' },
		{ value: '16', label: '16 bits' },
		{ value: '32', label: '32 bits' }
	]
};

const fwidth: Control = {
	type: 'select',
	id: 'fwidth',
	label: 'Precision',
	default: '32',
	options: [
		{ value: '16', label: 'Half (16 bits)' },
		{ value: '32', label: 'Single (32 bits)' }
	]
};

const plus1: Control = {
	type: 'action',
	id: 'plus1',
	label: 'Add 1',
	action: 'Add 1',
	help: 'Count up by one, as a computer does.'
};

const clear: Control = {
	type: 'action',
	id: 'clear',
	label: 'All zeros',
	action: 'All zeros'
};

const a: Control = {
	type: 'range',
	id: 'a',
	label: 'First number',
	min: 0,
	max: 255,
	step: 1,
	default: 45
};
const b: Control = {
	type: 'range',
	id: 'b',
	label: 'Second number',
	min: 0,
	max: 255,
	step: 1,
	default: 27
};
// Separate ids: control values persist across steps, and this step starts from its own sum.
const a2: Control = {
	type: 'range',
	id: 'oa',
	label: 'First number',
	min: 0,
	max: 255,
	step: 1,
	default: 200
};
const b2: Control = {
	type: 'range',
	id: 'ob',
	label: 'Second number',
	min: 0,
	max: 255,
	step: 1,
	default: 100
};

const view: Control = {
	type: 'select',
	id: 'view',
	label: 'Read the bytes as',
	default: 'unsigned',
	options: [
		{ value: 'unsigned', label: 'Unsigned (0 to 255)' },
		{ value: 'signed', label: 'Signed (−128 to 127)' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'binary',
	title: 'Bits: how computers store everything',
	summary:
		'Flip the bits of a byte and read the same pattern as a number, a negative number, a letter, a colour and a fraction — then add two numbers and watch the carries spill over.',
	chapters: [
		{ id: 'bits', title: 'Bits and numbers' },
		{ id: 'meanings', title: 'One pattern, many meanings' },
		{ id: 'arith', title: 'Adding in binary' }
	],
	steps: [
		// ------------------------------------------------------------------ bits
		{
			id: 'bits',
			chapter: 'bits',
			title: 'Ones and zeros',
			scene: 'byte',
			hints: { phase: 'bits', bits: '00000101' },
			duration: 18,
			controls: [plus1, clear],
			body: `
<p>A computer's memory is made of billions of tiny cells, each holding one of two states — on or off. One such on/off value is a <dfn data-def="A binary digit: the smallest unit of information, with exactly two possible values, written 0 and 1.">bit</dfn>, written 1 or 0. Click the bits to flip them.</p>
<p>One bit has two possible values. Two bits have four patterns (00, 01, 10, 11); every extra bit doubles the count. A group of eight bits — a <dfn data-def="Eight bits. The basic unit in which computer memory is organised and counted.">byte</dfn> — has 2 × 2 × 2 × 2 × 2 × 2 × 2 × 2 = 256 different patterns.</p>
<p>Everything a computer stores — numbers, text, pictures, music, this page — is patterns of bits. The patterns themselves mean nothing; meaning comes from how they are read.</p>`
		},
		{
			id: 'place',
			chapter: 'bits',
			title: 'Counting in twos',
			scene: 'byte',
			hints: { phase: 'unsigned', bits: '01000001' },
			duration: 22,
			controls: [plus1, clear],
			body: `
<p>The most common way to read a byte is as a whole number. It works like our everyday decimal numbers, where each digit is worth ten times the one to its right (ones, tens, hundreds…). In <dfn data-def="Base-2 numbers: each digit is 0 or 1 and is worth twice the digit to its right.">binary</dfn> each bit is worth <strong>twice</strong> the one to its right: 1, 2, 4, 8, 16, 32, 64, 128.</p>
<p>To read the number, add up the place values of the bits that are on: 0100 0001 is 64 + 1 = <strong>65</strong>. All eight off is 0; all on is 255. Press <em>Add 1</em> and watch how counting works: the rightmost 1s turn to 0s and the next 0 turns to 1, just as 0999 + 1 = 1000.</p>`,
			notes: `<p>Long rows of 0s and 1s are hard for people to read, so programmers often write each group of four bits as one <dfn data-def="Base 16: digits 0–9 then A–F for ten to fifteen. One hexadecimal digit stands for exactly four bits.">hexadecimal</dfn> digit (0–9, then A–F): 0100 0001 is 41 in hex.</p>`
		},
		{
			id: 'signed',
			chapter: 'bits',
			title: 'Negative numbers',
			scene: 'byte',
			hints: { phase: 'signed', bits: '11001000' },
			duration: 22,
			controls: [plus1, clear],
			body: `
<p>There is no minus sign in a byte — only bits. The usual trick, called <dfn data-def="The standard way computers store negative whole numbers: the leftmost bit is worth minus its usual value, so 1000 0000 is −128 and 1111 1111 is −1.">two's complement</dfn>, is to make the leftmost bit worth <strong>−128</strong> instead of +128. Everything else stays the same.</p>
<p>So 1100 1000 is −128 + 64 + 8 = <strong>−56</strong>. Read as an unsigned number, the very same bits are 128 + 64 + 8 = 200. A byte read this way holds −128 to 127 instead of 0 to 255. Turn on only the leftmost bit for the most negative number; turn them all on for −1.</p>
<p>Why this odd rule? Because adding then works exactly the same for negative numbers as for positive ones — the last chapter shows it.</p>`
		},
		// ------------------------------------------------------------------ meanings
		{
			id: 'text',
			chapter: 'meanings',
			title: 'Text',
			scene: 'byte',
			hints: { phase: 'text', bits: '01000001' },
			duration: 22,
			controls: [width, clear],
			body: `
<p>To store text, every character is given a number by an agreed table. The classic one is <dfn data-def="American Standard Code for Information Interchange (first published 1963; small letters added in 1967): a table giving the numbers 0–127 to English letters, digits, punctuation and control codes.">ASCII</dfn>: 65 is "A", 66 is "B", 97 is "a", 48 is the digit "0", 32 is a space. Some numbers are not visible characters at all but instructions, such as 10, "new line".</p>
<p>So the byte that meant 65 a moment ago now means "A". Flip the bit worth 32 and "A" becomes "a": capital and small letters differ by exactly one bit. Choose a longer word to read 2 or 4 characters at once.</p>`,
			notes: `<p>ASCII only covers English. Today's text uses <dfn data-def="The international standard that gives a number (a code point) to over 150,000 characters from the world's writing systems, plus emoji.">Unicode</dfn>, usually stored as UTF-8: the ASCII characters keep their single byte, and other characters take two to four bytes. On this page the codes from 128 to 255 are read with the older Latin-1 table (é is 233).</p>`
		},
		{
			id: 'colour',
			chapter: 'meanings',
			title: 'Colour',
			scene: 'byte',
			hints: { phase: 'colour', bits: '11110100' },
			duration: 22,
			controls: [width, clear],
			body: `
<p>A screen makes every colour by mixing red, green and blue light. To store a colour, split the bits into three groups that say how bright each of the three is.</p>
<p>With one byte, some computers (such as the MSX2) used 3 bits for red, 3 for green and 2 for blue (the eye is least sensitive to blue): only 256 colours. With 16 bits, the split is 5–6–5. Choose 32 bits for today's usual format: a whole byte each for red, green and blue — over 16 million colours — and usually a fourth byte for how opaque the colour is.</p>`
		},
		{
			id: 'float',
			chapter: 'meanings',
			title: 'Fractions and huge numbers',
			scene: 'byte',
			hints: { phase: 'float', bits: '00111110001000000000000000000000' },
			duration: 26,
			controls: [fwidth, clear],
			body: `
<p>Whole numbers can't hold 0.15625 or the mass of the Sun. For those, computers use <dfn data-def="A way of storing numbers as a sign, a significand and a power of two, like scientific notation, so that both tiny and enormous numbers fit in the same number of bits. Standardised as IEEE 754.">floating point</dfn>: scientific notation in binary. In 32 bits, 1 bit is the <strong>sign</strong>, 8 bits an <strong>exponent</strong> (which power of two) and 23 bits the <strong>fraction</strong> (the digits). The pattern shown is 1.25 × 2⁻³ = 0.15625.</p>
<p>The exponent lets the same 32 bits hold numbers from about 10⁻³⁸ to 10³⁸ — but only about 7 decimal digits of each. Most fractions can't be stored exactly: 0.1 in binary goes on for ever, like 1/3 in decimal, so the computer keeps the nearest pattern, 0.100000001490116…</p>`,
			notes: `<p>The exponent is stored with 127 added to it (so 0111 1100 = 124 means 2⁻³), and the leading "1." of the significand is not stored at all, since in binary it is always 1. All-zero and all-one exponents are reserved for zero, very tiny numbers, infinity and "not a number". The IEEE standard has no 8-bit format (the 8-bit floats now used in AI chips come from newer industry specifications): try 16 bits (half precision: 5 exponent and 10 fraction bits), used in graphics and machine learning.</p>`
		},
		{
			id: 'same',
			chapter: 'meanings',
			title: 'Same bits, different meanings',
			scene: 'byte',
			hints: { phase: 'all', bits: '01000001' },
			duration: 26,
			controls: [width, plus1, clear],
			body: `
<p>Here are all the readings at once. Flip any bit and every one of them changes — but in completely different ways: a small change in the number can be a different letter, a very different colour and a wildly different fraction.</p>
<p>Nothing in the bits says which reading is right. A file, a program or a network message has to know — or be told — what its bits are meant to be. When that goes wrong you see it: garbled characters on a web page, or a picture opened as text.</p>`
		},
		// ------------------------------------------------------------------ arith
		{
			id: 'add',
			chapter: 'arith',
			title: 'Adding with carries',
			scene: 'adder',
			hints: { phase: 'add' },
			duration: 26,
			controls: [a, b],
			body: `
<p>Computers add binary numbers the way you learned to add on paper, column by column from the right. In each column the two bits plus any carry add up to 0, 1, 2 or 3, so there are only four cases: 0 = 0; 1 = 1; 2 = 10 in binary — write 0 and <strong>carry</strong> 1 to the next column; and 3 = 11 — write 1, carry 1.</p>
<p>Watch the carries ripple from right to left. The simplest circuit for this is a chain of tiny full adders, one per column; real processors use faster designs, but the result is the same — billions of times a second.</p>`
		},
		{
			id: 'overflow',
			chapter: 'arith',
			title: 'When the answer does not fit',
			scene: 'adder',
			hints: { phase: 'overflow' },
			duration: 26,
			controls: [a2, b2, view],
			body: `
<p>200 + 100 = 300, but a byte only goes up to 255. The carry out of the leftmost column has nowhere to go and is lost, leaving 300 − 256 = <strong>44</strong>. Like a car's odometer rolling over from 999999 to 000000, the count has wrapped round: an <dfn data-def="When the result of a calculation is too large (or too small) for the number of bits used to store it, so a wrong, wrapped-round value is kept.">overflow</dfn>.</p>
<p>Read the same bytes as signed numbers and other sums overflow: 100 + 100 gives the bits of 200, which as a signed byte is <strong>−56</strong>. Two positive numbers made a negative one. And −1 + 1 shows why two's complement is used: the bits of 255 and 1 add to 0 with a lost carry — exactly the right signed answer, with no special rules for negatives.</p>
<p>Real programs use 32 or 64 bits, but overflow still happens: in 2014 YouTube switched its view counter to 64 bits as "Gangnam Style" neared 2,147,483,647 views — the largest number a signed 32-bit word can hold.</p>`
		}
	]
};
