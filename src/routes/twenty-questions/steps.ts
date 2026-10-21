import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const again: Control = {
	type: 'action',
	id: 'restart',
	label: 'Another number',
	action: 'Start again',
	help: 'Think of a new number, then answer the questions on the stage.'
};

const many: Control = {
	type: 'select',
	id: 'many',
	label: 'How many numbers',
	default: '100',
	options: [
		{ value: '100', label: '100' },
		{ value: '200', label: '200' },
		{ value: '1000', label: '1,000' },
		{ value: '1000000', label: 'a million' }
	]
};

const word: Control = {
	type: 'select',
	id: 'word',
	label: 'Look up',
	default: 'kitten',
	options: ['apple', 'dragon', 'kitten', 'pizza', 'rainbow', 'zebra'].map((w) => ({
		value: w,
		label: w
	}))
};

const shuffle: Control = {
	type: 'toggle',
	id: 'shuffle',
	label: 'Shuffle the pages',
	default: false
};

const animal: Control = {
	type: 'action',
	id: 'animal',
	label: 'A new game',
	action: 'New secret animal',
	help: 'The page picks another animal and shows the whole board again.'
};

const which: Control = {
	type: 'select',
	id: 'q',
	label: 'First question',
	default: 'penguin',
	options: [
		{ value: 'penguin', label: 'Is it a penguin?' },
		{ value: 'flies', label: 'Can it fly?' },
		{ value: 'eggs', label: 'Does it lay eggs?' },
		{ value: 'hunts', label: 'Does it hunt other animals?' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'twenty-questions',
	title: 'Twenty questions: halving the haystack',
	summary:
		'Think of a number from 1 to 100 and watch the page find it in seven questions. Find a word in a thousand-page dictionary by opening it in the middle, see the trick fail on a shuffled pile, then play twenty questions with 99 real animals.',
	chapters: [
		{ id: 'numbers', title: 'Guess my number' },
		{ id: 'book', title: 'The dictionary' },
		{ id: 'animals', title: 'Animal twenty questions' }
	],
	steps: [
		// ------------------------------------------------------------------ numbers
		{
			id: 'number',
			chapter: 'numbers',
			title: 'Think of a number',
			scene: 'number',
			hints: { phase: 'game' },
			duration: 30,
			controls: [again],
			body: `
<p>Think of a whole number from 1 to 100, and keep it secret. The page will find it, only by asking questions you answer yes or no.</p>
<p>Answer each question with the buttons on the stage. The bar holds every number that could still be yours. Each question is about the middle of what is left, so whatever you answer, <strong>half the bar goes dark</strong>. Watch the counter: it never needs more than <strong>seven</strong> questions.</p>`,
			notes: `
<p>Why seven? Halve 100 and keep the bigger half each time: 100, 50, 25, 13, 7, 4, 2, 1. That is seven halvings. Some numbers are found after six, but none needs an eighth question.</p>`
		},
		{
			id: 'doubling',
			chapter: 'numbers',
			title: 'Twice as many, one more question',
			scene: 'number',
			hints: { phase: 'ladder' },
			duration: 24,
			controls: [many],
			body: `
<p>Asking “Is it 1? Is it 2? Is it 3?…” also finds the number, but if you picked 100 it takes a hundred questions. Halving takes seven.</p>
<p>Now pick more numbers. Each row of the ladder is one question, and the bars show the most numbers that can still be left after it. Double the numbers to 200 and you need just <strong>one more</strong> question, because the first answer halves them back to 100. A thousand numbers take ten questions. A <strong>million</strong> take twenty: that is the whole game of twenty questions.</p>`
		},
		// ------------------------------------------------------------------ dictionary
		{
			id: 'dictionary',
			chapter: 'book',
			title: 'Open the dictionary in the middle',
			scene: 'book',
			hints: { phase: 'halve' },
			duration: 24,
			controls: [word],
			body: `
<p>Here is a dictionary of a thousand pages, with more than 200,000 words in alphabetical order. Pick a word to look up.</p>
<p>Open the book in the middle and read the words on that page. Your word comes before them or after them, so one whole half of the book can be <strong>forgotten</strong>. Open the half that is left in its middle, and again. Every open throws away half of the pages still left, and after ten opens at most you are on the right page. Computer people call this <dfn data-def="Looking for something in a list that is in order by checking its middle and keeping only the half it must be in, again and again.">binary search</dfn>.</p>`,
			notes: `
<p>The dictionary is the word list of Webster’s Second International Dictionary (1934), which comes with many computers. Its 210,773 words in small letters are cut into 1,000 pages of about 211 words each; the page shows the first and last word of each page it opens.</p>
<p>People with a real dictionary do even better than the middle: looking for “zebra”, you open near the back straight away. Halving is the trick that works even when you know nothing about where the word might be.</p>`
		},
		{
			id: 'flipping',
			chapter: 'book',
			title: 'Page by page',
			scene: 'book',
			hints: { phase: 'race' },
			duration: 26,
			controls: [word],
			body: `
<p>Now compare halving with someone who starts at page 1 and looks at <strong>every page</strong> in turn. Pick a word and watch both counters. (The page-turner is sped up a lot, or you would be waiting for minutes: compare the counts, not who finishes first.)</p>
<p>The halving reader needs ten opens or fewer. The page-turner needs 428 looks to reach “kitten”, and 997 for “zebra”. Checking things one at a time takes hundreds of looks; halving takes a handful.</p>`
		},
		{
			id: 'shuffled',
			chapter: 'book',
			title: 'The trick needs order',
			scene: 'book',
			hints: { phase: 'shuffled' },
			duration: 26,
			controls: [shuffle],
			body: `
<p>Halving has one rule: the pages must be <strong>in order</strong>. Pull the book apart, shuffle the pages into a pile, and try the same trick.</p>
<p>The middle of the pile is now just some page: here, a page of words starting with “cr”. “Kitten” comes after those words, but its page could be anywhere in the pile, above or below, so throwing half the pile away is a gamble. After a few throws the page you want is almost always gone, and the search runs out of pages without finding the word. With a shuffled pile, the only sure way is to look at every page.</p>`
		},
		// ------------------------------------------------------------------ animals
		{
			id: 'animals',
			chapter: 'animals',
			title: 'Twenty questions with animals',
			scene: 'board',
			hints: { phase: 'game' },
			duration: 40,
			controls: [animal],
			body: `
<p>Now the page has a secret: one of the 99 animals on the board. Click a question to ask it. The page answers yes or no, and every animal that would answer the other way is <strong>hidden</strong>.</p>
<p>Try to find the animal in as few questions as you can. A question that hides about half the animals left is a good one. When only a few are left, click an animal to ask “Is it a…?”. Some animals answer every question on the list the same way (a lion and a wolf, for one), and then only guessing by name tells them apart.</p>`,
			notes: `
<p>The animals and their answers come from the Zoo dataset that Richard Forsyth put together in 1990, kept by the UCI Machine Learning Repository (CC BY 4.0). It records 15 yes-or-no facts about each animal and its number of legs. We left out its one human (a girl) and a second copy of the frog.</p>
<p>The dataset has a few plain mistakes, which we corrected: it gives a crab four legs (a crab has ten, counting its two claws), a squirrel two, and says a sea snake doesn’t breathe air (it does: it comes up to the surface to breathe). Some other answers are judgement calls, such as which animals “hunt other animals” or are “bigger than a cat”: the page keeps the dataset’s choices.</p>`
		},
		{
			id: 'penguin',
			chapter: 'animals',
			title: 'Is it a penguin?',
			scene: 'board',
			hints: { phase: 'split' },
			duration: 26,
			controls: [which],
			body: `
<p>Not every yes-or-no question halves the pile. Pick a first question and see how it splits the board: one colour for the animals that would answer yes, another for no.</p>
<p>“Is it a penguin?” is a yes-or-no question too, but unless you are very lucky the answer is no, and it hides <strong>one</strong> animal out of 99. “Can it fly?” is better, but most animals can’t, so a no still leaves 75. “Does it hunt other animals?” splits the board into 54 and 45: whichever way the answer goes, about half are gone. A good question is one where you <strong>really don’t know</strong> which answer is coming.</p>`
		},
		{
			id: 'next',
			chapter: 'animals',
			title: 'Read next',
			scene: 'number',
			hints: { phase: 'next' },
			duration: 18,
			body: `
<p>A question that splits what is left in half finds the answer in a handful of steps: seven for a hundred numbers, ten for a thousand pages, twenty for a million. Checking one at a time takes hundreds of steps, or a million. But halving only works when the things are in order, or when the question really splits them.</p>
<p>Putting things in order so that you can search them fast is a big part of what computers do: the page on <a href="../sorting/">sorting</a> races different ways of doing it. Each yes-or-no answer is one <a href="../binary/">binary</a> digit, a bit. And the page on <a href="../secret-codes/">secret codes</a> shows a spy who, like a page-turner, just tries every key.</p>`
		}
	]
};
