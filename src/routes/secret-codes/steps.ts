import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const turn: Control = {
	type: 'range',
	id: 'turn',
	label: 'Turn the inner ring',
	min: 1,
	max: 25,
	step: 1,
	default: 3,
	format: (v) => `${v} ${v === 1 ? 'place' : 'places'}`
};

const back: Control = {
	type: 'range',
	id: 'back',
	label: 'Your friend’s ring',
	min: 0,
	max: 25,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'not turned' : `turned ${v} ${v === 1 ? 'place' : 'places'}`)
};

const newTurn: Control = {
	type: 'action',
	id: 'newturn',
	label: 'Secret turn',
	action: 'Pick a new secret turn',
	help: 'The spy doesn’t know it. Watch which line the spy finds.'
};

const again: Control = {
	type: 'action',
	id: 'scramble',
	label: 'Scramble',
	action: 'Scramble again',
	help: 'A new order for the letters under the alphabet.'
};

const lineUp: Control = {
	type: 'toggle',
	id: 'lineup',
	label: 'Line the bars up by height',
	default: false
};

const which: Control = {
	type: 'select',
	id: 'which',
	label: 'Count the letters of',
	default: 'note',
	options: [
		{ value: 'note', label: 'the one-line note' },
		{ value: 'letter', label: 'the long letter' }
	]
};

const fix: Control = {
	type: 'action',
	id: 'hint',
	label: 'Stuck?',
	action: 'Fix one letter for me',
	help: 'Puts in the right letter for the commonest secret letter still wrong.'
};

export const spec: ExplainerSpec = {
	slug: 'secret-codes',
	title: 'Secret codes & code-breaking',
	summary:
		'Turn a code wheel to write a secret message, then play the spy: try all 25 turns and watch the one that makes words jump out. Scramble the alphabet instead, and break it by counting letters, because disguising a letter doesn’t change how often it comes: in a long message, E is usually still the commonest.',
	chapters: [
		{ id: 'wheel', title: 'The code wheel' },
		{ id: 'scramble', title: 'The scrambled alphabet' }
	],
	steps: [
		// ------------------------------------------------------------------ wheel
		{
			id: 'wheel',
			chapter: 'wheel',
			title: 'A code wheel',
			scene: 'wheel',
			hints: { phase: 'wheel' },
			duration: 20,
			controls: [turn],
			body: `
<p>Want to pass a note that only your friend can read? Make a <strong>code wheel</strong>: two rings of letters, one inside the other. The outer ring is the ordinary alphabet. The inner ring has the same letters, and it turns.</p>
<p>Turn the inner ring. Each letter of your message is swapped for the letter beside it on the inner ring. With a turn of 3, A becomes D, B becomes E and M becomes P: every letter steps <strong>the same number of places</strong> along the alphabet. After Z it goes round to A again, so X becomes A.</p>`,
			notes: `
<p>This is one of the oldest secret codes we know of. The Roman writer Suetonius says that Julius Caesar wrote private letters by putting D for A, E for B and so on: a turn of 3. That is why code-breakers call it the <em>Caesar cipher</em>.</p>`
		},
		{
			id: 'message',
			chapter: 'wheel',
			title: 'Write a secret message',
			scene: 'wheel',
			hints: { phase: 'message' },
			duration: 20,
			body: `
<p>Type your own message in the box. The wheel swaps its letters one by one, every letter with the same turn. Spaces stay where they are.</p>
<p>What comes out looks like nonsense. The turn you used is the <dfn data-def="The secret that locks and unlocks a code. For the code wheel, it is how far the ring is turned.">key</dfn>: anyone who knows it can read your message, and nobody else can, or so you hope.</p>`
		},
		{
			id: 'friend',
			chapter: 'wheel',
			title: 'Your friend turns it back',
			scene: 'wheel',
			hints: { phase: 'friend' },
			duration: 22,
			controls: [back],
			body: `
<p>Your friend has a wheel just like yours, and you told them the key earlier, in secret. To read your message they set their ring to the same turn, find each secret letter on the inner ring and read the letter beside it on the outer ring. Every letter steps <strong>back</strong> by the same amount.</p>
<p>Turn your friend’s ring. At every other turn the message stays nonsense; at the right one, it suddenly reads.</p>`
		},
		{
			id: 'spy',
			chapter: 'wheel',
			title: 'A spy tries every turn',
			scene: 'spy',
			hints: { phase: 'spy' },
			duration: 22,
			controls: [newTurn],
			body: `
<p>Now a spy grabs the note. The spy has a code wheel too, but doesn’t know the key. That hardly matters: there are only 25 turns to try. The spy writes out all 25, one after another, and looks for the line that makes words.</p>
<p>Here only one line does, and it jumps out. Pick a new secret turn: whatever it is, the spy finds it in a few minutes with a pencil. A code wheel keeps a note safe from a little brother, not from a spy.</p>
<p>(A very short note can fool the spy: HI turned 3 places is KL, and KL turned back 23 places reads NO, which is a word too. The highlight here looks for the 200 commonest words of <em>Alice in Wonderland</em>, so it can miss a word like HELLO: the spy reads every line.)</p>`
		},
		// ------------------------------------------------------------------ scramble
		{
			id: 'scramble',
			chapter: 'scramble',
			title: 'Scramble the alphabet',
			scene: 'scramble',
			hints: { phase: 'scramble' },
			duration: 22,
			controls: [again],
			body: `
<p>To beat the spy, don’t turn the alphabet: <strong>scramble</strong> it. Under each letter of the alphabet write its partner, using every letter once, in any order you like, and give your friend a copy of the list (that list is now the key). There is no single turn any more, so trying all 25 turns finds nothing.</p>
<p>And there are a lot of ways to scramble 26 letters: the number at the bottom. A computer trying a billion of them every second would need about 13 billion years to try them all, nearly as long as the universe has existed.</p>`
		},
		{
			id: 'count',
			chapter: 'scramble',
			title: 'Count the letters',
			scene: 'bars',
			hints: { phase: 'count' },
			duration: 24,
			controls: [lineUp],
			body: `
<p>The spy can’t try every scramble, but has another trick: <strong>counting</strong>. Some letters are much more common in English than others. Out of every 100 letters in <em>Alice in Wonderland</em>, about 13 are E, 10 are T and 8 are A, and hardly any are Z or Q.</p>
<p>Scrambling changes what the letters look like, not how often they come. The spy has caught a long letter of about 300 letters, written with your scramble. Its letters are counted in the top bars; ordinary English is underneath. Line both up by height: in a long message, the tallest secret letter is usually E. In this one, the next two stand for T and A. Code-breakers call this <dfn data-def="Breaking a code by counting how often each secret letter comes, and matching the counts with how often letters come in ordinary language.">frequency analysis</dfn>.</p>`,
			notes: `
<p>The oldest description of breaking codes by counting letters that we know of was written in Arabic by the scholar al-Kindi in Baghdad, in the 800s.</p>
<p>The bars of ordinary English were counted by a small program from the whole of <em>Alice’s Adventures in Wonderland</em> by Lewis Carroll (1865), from Project Gutenberg’s free copy: 107,667 letters. Another book gives slightly different bars, but E is the commonest letter in almost any long English text.</p>`
		},
		{
			id: 'short',
			chapter: 'scramble',
			title: 'Too short to count',
			scene: 'bars',
			hints: { phase: 'short' },
			duration: 24,
			controls: [which],
			body: `
<p>Counting only works when there are enough letters. The note from before, MEET AT THE OLD OAK AT NOON, has just 21. Its tallest bars are simply the letters that happened to come up three or four times, and here the tallest is not E at all. The spy’s first guesses are wrong, so counting alone doesn’t break this note (though word patterns and clues might still help).</p>
<p>We cut <em>Alice in Wonderland</em> into pieces and counted each one. In pieces of 25 letters, E was the tallest bar only about 1 time in 4. In pieces of 300 letters, like the long letter, about 4 times in 5, and in pieces of 1,000 letters, more than 9 times in 10. The longer the message, the better counting works.</p>`
		},
		{
			id: 'solve',
			chapter: 'scramble',
			title: 'Fill in the rest',
			scene: 'solve',
			hints: { phase: 'solve' },
			duration: 30,
			controls: [fix],
			body: `
<p>The three tallest bars gave E, T and A. Past those, the bars of English are almost the same height (O, I, H, N and S are all close), so the bars stop helping. Now the spy looks at the words instead: half-words appear, like T_E. It could be TIE, but THE is far more common: try H in the gap, and check that it makes other words work too.</p>
<p>Your turn. Click a secret letter in the row of guesses, then the letter you think it stands for (or type it). Words that read turn green. Keep guessing and swapping until the whole letter reads.</p>`,
			notes: `
<p>Counting letters has decided real history. In 1586, Mary, Queen of Scots, wrote to a group of plotters in a code that swapped letters for symbols. Her letters were intercepted, and Thomas Phelippes, a code-breaker working for Queen Elizabeth I, broke the code, partly by counting which symbols were commonest. The letters he read were used at her trial.</p>`
		},
		{
			id: 'next',
			chapter: 'scramble',
			title: 'Read next',
			scene: 'wheel',
			hints: { phase: 'next' },
			duration: 18,
			body: `
<p>A code that turns every letter by the same amount falls to trying all 25 turns. A code that scrambles the alphabet falls to counting letters, because disguising a letter doesn’t change how often it comes: in a long message, E is usually still the commonest.</p>
<p>The code wheel is really a clock with 26 hours: after Z comes A again, just as after 12 o’clock comes 1. The page on <a href="../primes-modular-arithmetic/">prime numbers and clock arithmetic</a> shows how such clocks work, and the page on <a href="../cryptography/">cryptography</a> shows how computers keep secrets today, even from a spy who sees every message.</p>`
		}
	]
};
