import type { ExplainerSpec } from '#lib/explainer/index.ts';

export const spec: ExplainerSpec = {
	slug: 'qr-codes',
	title: 'QR codes',
	summary:
		'Type a message and watch it become a square of black and white cells: three corner squares for the camera to find, the message as cells, then spare cells computed from it. Turn the phone any way and it still reads. Paint over cells and it still reads, until too many pieces are spoiled or a corner square is hidden.',
	chapters: [
		{ id: 'build', title: 'Building the square' },
		{ id: 'damage', title: 'Paint over it' }
	],
	steps: [
		// ------------------------------------------------------------------ build
		{
			id: 'square',
			chapter: 'build',
			title: 'A message in a square',
			scene: 'qr',
			hints: { phase: 'square' },
			duration: 16,
			body: `
<p>You see them on posters, menus and tickets: a square of tiny black and white cells. Point a phone’s camera at one and a message pops up, often a web address.</p>
<p>The square <em>is</em> the message, written in cells. Type your own message in the box: the square changes, and the phone reads back exactly what you typed. Make the message longer and the square needs more cells.</p>`,
			notes: `<p>QR stands for “Quick Response”. The code was invented in 1994 at Denso Wave, a Japanese company, to keep track of car parts in factories; its layout is now an international standard (ISO/IEC 18004). This page builds real QR codes for messages of up to 32 letters (the four smallest sizes, 21 to 33 cells across); a phone can read them off the screen.</p>`
		},
		{
			id: 'corners',
			chapter: 'build',
			title: 'Three corner squares',
			scene: 'qr',
			hints: { phase: 'corners' },
			duration: 18,
			controls: [
				{
					type: 'range',
					id: 'turn',
					label: 'Turn the phone',
					min: 0,
					max: 359,
					step: 1,
					default: 0,
					unit: '°',
					format: (v) => (v === 0 ? 'straight' : `turned ${v}°`)
				}
			],
			body: `
<p>Three corners of every QR code have the same big square: a dark ring, a light ring, and a dark middle. These <dfn data-def="The three big squares in the corners of a QR code. They carry no part of the message: they show the camera where the code is, how big it is and which way up it is.">corner squares</dfn> carry no part of the message. They are there for the camera.</p>
<p>A camera picture is full of other things. The phone hunts for the corner squares’ stripes, dark, light, a three-times-wider dark, light, dark, which look the same whichever way a line crosses them. Where it finds three, it knows where the code is and how big its cells are. The fourth corner has no square, so it also knows which way up the code is. Turn the phone: the corner squares are found (green), and the message still reads.</p>`,
			notes: `<p>The proper name is “finder patterns”. The camera here takes a flat picture; a real phone also corrects for a code seen at a slant (a squashed square), using a smaller fourth square that bigger codes have near the bottom-right corner. The dotted lines of cells joining the corner squares (the “timing patterns”) help a camera count the cells of big codes.</p>`
		},
		{
			id: 'message',
			chapter: 'build',
			title: 'The message as cells',
			scene: 'qr',
			hints: { phase: 'message' },
			duration: 20,
			body: `
<p>Computers store each letter as a row of 8 ones and zeros. In the code, a one is a dark cell and a zero is a light cell, so every letter takes 8 cells. Watch the message being laid down (in blue): it starts with a few cells that say “this is text, so many letters long”, then the letters one after another, then filler if there is room left.</p>
<p>The cells are grouped in <dfn data-def="A group of 8 cells holding one byte: 8 ones and zeros. The proper name is a codeword.">pieces</dfn> of 8, laid in a fixed order: two-cell-wide columns, snaking up and down from the bottom-right corner, stepping around the corner squares.</p>`,
			notes: `<p>Before the code is printed, a fixed pattern (one of 8, like a checkerboard) flips some of the message cells, so that the square never has big all-dark or all-light patches that would confuse the camera. Which pattern was used is written in small strips of cells beside the corner squares, twice, so that the reader can flip the cells back. That is why the blue cells don’t look like the letters’ ones and zeros.</p>`
		},
		{
			id: 'spare',
			chapter: 'build',
			title: 'Spare cells, worked out from the message',
			scene: 'qr',
			hints: { phase: 'spare' },
			duration: 20,
			controls: [
				{
					type: 'toggle',
					id: 'swap',
					label: 'Change the first letter’s case',
					default: false
				}
			],
			body: `
<p>The rest of the square (orange) is <dfn data-def="Extra pieces worked out from the whole message, which let a reader repair spoiled pieces. The proper name is error correction.">spare pieces</dfn>. They are not a copy of the message. Each one is worked out from <em>all</em> the message’s pieces at once, by a fixed recipe of arithmetic.</p>
<p>Switch on the change: the first letter goes from capital to small, just one of its 8 cells changes, and <em>every</em> spare piece changes (outlined). That is what makes them useful: together, the spare pieces can tell which pieces have been spoiled and what they should have been. This code has 16 spare pieces, enough to repair any 8 spoiled pieces.</p>`,
			notes: `<p>The recipe is called Reed-Solomon coding, also used on CDs, DVDs and by space probes. It treats the message’s pieces as the numbers of a long sum; the spare pieces are chosen so that certain checks come out to zero. A spoiled piece makes the checks come out wrong in a way that points to which piece it is and how to fix it. It needs two spare pieces for every piece it repairs: one to find where the damage is, one to work out the right value.</p>`
		},
		// ------------------------------------------------------------------ damage
		{
			id: 'paint',
			chapter: 'damage',
			title: 'Paint over it',
			scene: 'qr',
			hints: { phase: 'paint' },
			duration: 20,
			controls: [
				{
					type: 'action',
					id: 'wipe',
					label: 'Paint',
					action: 'Wipe the paint off',
					help: 'Remove all the paint from the code.'
				}
			],
			body: `
<p>Now spoil the code: drag across it to paint over cells with dark ink. The phone sees painted cells as dark, so a light cell under the paint now reads wrong, and its piece is spoiled.</p>
<p>Paint a little: the phone repairs the spoiled pieces from the spare ones and still reads the message. Keep painting, and watch the counters. Somewhere past 8 spoiled pieces it gives up: “can’t read it”.</p>`,
			notes: `<p>On a keyboard, focus the code (Tab), move the brush with the arrow keys and paint with Enter or Space. Painting over cells that are already dark changes nothing: the cell counter counts every cell under the paint, the spoiled-piece counter only the pieces that now read wrong.</p>`
		},
		{
			id: 'specks',
			chapter: 'damage',
			title: 'One blot, or specks?',
			scene: 'qr',
			hints: { phase: 'specks' },
			duration: 18,
			controls: [
				{
					type: 'select',
					id: 'spread',
					label: 'Paint',
					default: 'blot',
					options: [
						{ value: 'blot', label: 'One blot' },
						{ value: 'specks', label: 'Scattered specks' }
					]
				}
			],
			body: `
<p>So is there a number of cells you are allowed to spoil? Not quite. Here are two ways to paint over the same number of cells: one blot, or specks scattered across the code.</p>
<p>The blot falls on just a few pieces, which the spare ones repair. The specks land one in each of 9 different pieces: more than this code can repair, so it fails. What counts is how many <em>pieces</em> are spoiled, not how many cells. So the cell counter is a rough guide, not a fixed limit.</p>`
		},
		{
			id: 'corner',
			chapter: 'damage',
			title: 'Cover a corner square',
			scene: 'qr',
			hints: { phase: 'corner' },
			duration: 18,
			controls: [
				{
					type: 'toggle',
					id: 'cover',
					label: 'Cover the top-left corner square',
					default: false
				}
			],
			body: `
<p>A corner square holds no message, so painting over one spoils no piece at all. Try it.</p>
<p>The phone fails at once. Without three corner squares it can’t find the code in the picture, so it never gets as far as the message. That is why codes printed with a logo in the middle still work, but one with a sticker on a corner does not.</p>`,
			notes: `<p>Two other small areas matter more than ordinary cells: the strips next to the corner squares that say which level and which flipping pattern were used (written twice, so one copy can be spoiled), and, on bigger codes, the dotted timing lines and the alignment squares that help the camera keep its place.</p>`
		},
		{
			id: 'levels',
			chapter: 'damage',
			title: 'More spare pieces, a bigger square',
			scene: 'qr',
			hints: { phase: 'levels' },
			duration: 20,
			controls: [
				{
					type: 'select',
					id: 'level',
					label: 'Level: how much it can repair',
					default: 'M',
					options: [
						{ value: 'L', label: 'L · 7%' },
						{ value: 'M', label: 'M · 15%' },
						{ value: 'Q', label: 'Q · 25%' },
						{ value: 'H', label: 'H · 30%' }
					]
				}
			],
			body: `
<p>Whoever makes the code chooses how many spare pieces to add, from four levels. Level L can repair about 7 pieces in a hundred; level H about 30. More spare pieces means more cells, so the same message makes a bigger square.</p>
<p>Pick a level and paint over the code again. Codes printed where they get scuffed, like on boxes in a warehouse, use a high level; a code on a clean screen can use a low one and stay small.</p>`,
			notes: `<p>A bigger code splits its pieces into groups, each with its own spare pieces; a group whose damage is beyond its own spare pieces makes the whole code fail. The percentages are the standard’s round figures: the exact share depends on the code’s size.</p>`
		},
		{
			id: 'snapshot',
			chapter: 'damage',
			title: 'One picture, every cell',
			scene: 'qr',
			hints: { phase: 'snapshot' },
			duration: 16,
			body: `
<p>A QR code is a message written in dark and light cells, plus spare cells worked out from it, around three corner squares that the camera looks for. The phone doesn’t read it line by line like a supermarket barcode scanner: it takes one picture of the whole square, finds the corner squares, looks at every cell, and repairs what it can.</p>
<p>That is why a scratched or half-covered code still works, until too many pieces are spoiled, or a corner square is hidden.</p>
<p>Next: <a href="../barcode-stripes/">barcodes at the checkout</a> are the one-line cousin, with a single check digit instead of spare pieces. <a href="../binary/">Binary</a> shows how letters become ones and zeros, and <a href="../error-correction/">error-correcting codes</a> show how spare bits can find and fix a mistake.</p>`
		}
	]
};
