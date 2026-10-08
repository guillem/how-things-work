import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Noise: chance each bit flips',
	min: 0,
	max: 25,
	step: 0.5,
	default: 5,
	unit: ' %'
};

const resend: Control = {
	type: 'action',
	id: 'resend',
	label: 'Send again',
	action: 'Send again',
	help: 'Same noise level, new random flips.'
};

const flipRandom: Control = {
	type: 'action',
	id: 'flipRandom',
	label: 'Noise',
	action: 'Flip a random bit',
	help: 'Or click any received bit to flip it yourself.'
};

const clearFlips: Control = {
	type: 'action',
	id: 'clearFlips',
	label: 'Clear',
	action: 'Undo all flips'
};

const bitControls = [flipRandom, clearFlips];

export const spec: ExplainerSpec = {
	slug: 'error-correction',
	title: 'How error-correcting codes repair data',
	summary:
		'Flip bits in a coded message and watch three overlapping parity checks point straight at the damaged bit and repair it, then push a whole message through a noisy channel with and without the code.',
	chapters: [
		{ id: 'problem', title: 'The problem' },
		{ id: 'checks', title: 'Parity checks' },
		{ id: 'hamming', title: 'The Hamming code' },
		{ id: 'channel', title: 'On a noisy channel' }
	],
	steps: [
		{
			id: 'noise',
			chapter: 'problem',
			title: 'Noise flips bits',
			scene: 'channel',
			hints: { phase: 'intro' },
			duration: 24,
			controls: [noise, resend],
			body: `
<p>Every message a computer sends or stores is a string of bits. On the way, some of them get <em>flipped</em>: a 1 arrives as a 0 or the other way round. Electrical interference on a wire, a weak radio signal, a scratch on a disc or a cosmic ray hitting a memory chip are all <dfn data-def="Anything that changes a signal at random on its way from sender to receiver.">noise</dfn>.</p>
<p>Here a probe sends a short text, 8 bits per letter, through a <dfn data-def="The path a message takes from sender to receiver: a wire, a radio link, a disc, a memory chip.">channel</dfn> that flips each bit with a small chance. One flipped bit turns a letter into a different character, and the receiver has no way to tell which ones are wrong. Raise the noise and watch the text fall apart.</p>`,
			notes: `<p>Asking for the data again is fine on the internet, but not always possible: a probe in deep space is hours of light-travel away, and a scratched DVD can't be re-sent at all. The fix has to travel <em>with</em> the data.</p>`
		},
		{
			id: 'parity',
			chapter: 'checks',
			title: 'One check bit',
			scene: 'code',
			hints: { phase: 'parity', flips: '00100' },
			duration: 26,
			controls: bitControls,
			body: `
<p>The simplest idea: after four data bits, send one extra <dfn data-def="An extra bit chosen so that the number of 1s in a group of bits is even. If one bit of the group flips, the count becomes odd.">parity bit</dfn>, chosen so that the number of 1s in the group is <strong>even</strong>. The receiver counts the 1s. Odd? Something flipped.</p>
<p>One bit has been flipped here and the circle turns red: the error is <em>detected</em>. But the count says nothing about <em>which</em> bit it was, so the receiver can only ask for the data again. Click a second bit: the count is even again and the damage slips through unnoticed.</p>`,
			notes: `<p>You could instead send every bit three times and take a majority vote: that repairs any single flip in a triple, but it sends three bits for every one. The trick on the next pages repairs any single flip in a block of 7 bits while sending fewer than twice as many bits.</p>`
		},
		{
			id: 'hamming',
			chapter: 'hamming',
			title: 'Three overlapping checks',
			scene: 'code',
			hints: { phase: 'hamming', flips: '0000000' },
			duration: 26,
			body: `
<p>In 1950 Richard Hamming, at Bell Labs, used <em>several</em> parity checks that overlap. Put the four data bits where three circles cross and give each circle its own check bit, numbered 1, 2 and 4. Each check bit is chosen so that <strong>its circle</strong> holds an even number of 1s.</p>
<p>That makes 7 bits in all, a <dfn data-def="A code that sends blocks of 7 bits, 4 of them data and 3 of them check bits, and can repair any single flipped bit in a block.">Hamming (7, 4) code</dfn>. Click the message bits at the top right and watch the three check bits follow, so that every circle stays even.</p>`,
			notes: `<p>Hamming was running long jobs on Bell Labs' relay computers, unattended over nights and weekends. The machines could detect an error but not fix it, so they simply stopped. He set out to make a code that would repair the fault and carry on.</p>`
		},
		{
			id: 'repair',
			chapter: 'hamming',
			title: 'Find the flip, fix the flip',
			scene: 'code',
			hints: { phase: 'repair', flips: '0000100' },
			duration: 28,
			controls: bitControls,
			body: `
<p>Noise flipped one bit on the way. The receiver checks each circle: two are now odd, one is still even. The damaged bit must be inside <strong>both odd circles</strong> and <strong>outside the even one</strong>, and exactly one spot in the diagram fits. The receiver flips it back. No resending needed.</p>
<p>Click any other single bit, data or check, to move the error. Every one of the 7 positions has its own pattern of odd and even circles, so any single flip can be found and repaired.</p>`
		},
		{
			id: 'address',
			chapter: 'hamming',
			title: 'The checks spell the position',
			scene: 'code',
			hints: { phase: 'address', flips: '0000100' },
			duration: 26,
			controls: bitControls,
			body: `
<p>Hamming's numbering makes the search automatic. Number the 7 bits 1 to 7 and write each number in binary. Check 1 covers every position whose binary has a 1 in the "1s" column (1, 3, 5, 7), check 2 the "2s" column (2, 3, 6, 7) and check 4 the "4s" column (4, 5, 6, 7).</p>
<p>So write a 1 for each failing check and a 0 for each passing one: check 4, check 2, check 1. Read as a binary number, it is the <strong>position of the flipped bit</strong>. All 0s means no error. The receiver doesn't search; it reads off an address. This number is called the <dfn data-def="The pattern of failing checks. For a Hamming code it is the position of a single flipped bit, written in binary.">syndrome</dfn>.</p>`,
			notes: `<p>The same recipe works for longer blocks: with 4 check bits at positions 1, 2, 4, 8 you protect 15 bits (11 of data); with 5, 31 bits (26 of data). The check bits get relatively cheaper, but each block can still repair only one flip.</p>`
		},
		{
			id: 'two',
			chapter: 'hamming',
			title: 'Two flips fool it',
			scene: 'code',
			hints: { phase: 'two', flips: '0010100' },
			duration: 26,
			controls: bitControls,
			body: `
<p>Now two bits have flipped. The checks fail in a pattern that matches neither of them: it points to a third, <em>correct</em> bit. The decoder can't tell one error from two, so it confidently "repairs" that bit. Here the message comes out with three bits wrong instead of two.</p>
<p>A Hamming code is built for at most one flip per block. Try other pairs: every pair of flips is mistaken for a single flip somewhere else.</p>`,
			notes: `<p>One more parity bit over the whole block (the <em>extended</em> Hamming code) tells the two cases apart: one flip makes it odd, two flips leave it even. It still can't repair a double error, but it can raise the alarm instead of making things worse. Computer memory with ECC does exactly this, storing 8 check bits with every 64 data bits.</p>`
		},
		{
			id: 'compare',
			chapter: 'channel',
			title: 'With and without the code',
			scene: 'channel',
			hints: { phase: 'compare' },
			duration: 30,
			controls: [noise, resend],
			body: `
<p>Back to the noisy channel, now with two copies of the same message: one sent as it is, one with every 4 bits sent as a 7-bit Hamming block. Each bit faces the same chance of flipping. The marks on each strip are the flipped bits. On the coded side, amber marks are flips in a block hit only once, which the receiver repairs; red marks are in blocks hit twice or more, which come out wrong.</p>
<p>At 5% noise about two letters in three survive without coding, and about 91% with it. At 1% it is 92% against 99.6%. Drag the noise and compare with the curves.</p>`,
			notes: `<p>A letter is 8 bits, so it survives uncoded with chance (1 − p)⁸. Coded, it is two 7-bit blocks, and a block decodes correctly if it has at most one flip: (1 − p)⁷ + 7p(1 − p)⁶. The dots are what this particular message actually got; "Send again" rolls new noise.</p>
<p>Two simplifications: here every bit flips independently, while real noise often comes in bursts (real systems shuffle the bits of several blocks together so that a burst is spread thinly over many blocks). And both messages face the same flip chance per bit, although the coded one sends 7/4 as many bits; with a fixed power budget each coded bit would be a little noisier, so the real gain is somewhat smaller.</p>`
		},
		{
			id: 'cost',
			chapter: 'channel',
			title: 'The price of redundancy',
			scene: 'channel',
			hints: { phase: 'cost' },
			duration: 30,
			controls: [noise, resend],
			body: `
<p>Nothing is free: the coded message sends 7 bits for every 4, 75% more. And when the noise gets heavy, blocks start taking two hits and even the code can't keep up. Real systems choose a code to match their channel: computer memory, where flips are rare, uses a Hamming code much like this one, while CDs, QR codes, phones and space probes use stronger codes that repair many errors per block.</p>
<p><strong>Carefully structured redundancy lets a receiver detect and repair errors without asking for the data again.</strong> A few extra bits, each checking a different overlapping group, turn "something is wrong" into "bit 5 is wrong".</p>`,
			notes: `<p>CDs, DVDs and QR codes use Reed–Solomon codes, which repair whole bytes; mobile phones and deep-space links use codes that get remarkably close to the theoretical limit on how much a noisy channel can carry, worked out by Claude Shannon in 1948.</p>`
		}
	]
};
