import type { ExplainerSpec } from '#lib/explainer/index.ts';

export const spec: ExplainerSpec = {
	slug: 'next-word-guessing-game',
	title: 'How a chatbot picks its next word',
	summary:
		'Play a guessing game against a tiny machine that has read a few children’s books: it guesses the next word from what usually came next, spins a spinner to pick one, and writes a whole story one word at a time.',
	chapters: [
		{ id: 'game', title: 'The guessing game' },
		{ id: 'writing', title: 'Writing a story' },
		{ id: 'more', title: 'Reading more' }
	],
	steps: [
		// ------------------------------------------------------------------ game
		{
			id: 'guess',
			chapter: 'game',
			title: 'Guess the next word',
			scene: 'game',
			hints: { phase: 'guess' },
			duration: 20,
			controls: [
				{
					type: 'action',
					id: 'another',
					label: 'Sentence',
					action: 'Another sentence',
					help: 'Another place where the story stops.'
				}
			],
			body: `
<p>Here is a story that stops in the middle of a sentence. What word comes next? Pick one of the four cards.</p>
<p>A tiny machine plays too. It has read four Beatrix Potter tales and a big book of Aesop’s fables, but never this story. Once you pick, you see its cards: every word it ever saw come next after the last word of the sentence, and how many times.</p>
<p>Try a few sentences. You will often beat it, because you understand the story. The machine only remembers what came next.</p>`
		},
		{
			id: 'cards',
			chapter: 'game',
			title: 'Where the cards come from',
			scene: 'game',
			hints: { phase: 'cards' },
			duration: 18,
			controls: [
				{
					type: 'select',
					id: 'word',
					label: 'Last word',
					default: 'little',
					options: [
						{ value: 'little', label: 'little' },
						{ value: 'the', label: 'the' },
						{ value: 'said', label: 'said' },
						{ value: 'mr', label: 'Mr.' },
						{ value: 'went', label: 'went' }
					]
				}
			],
			body: `
<p>The machine made its cards by reading. Every time it met a word, it looked at the word right after it and added one to that word’s count. That is all it did.</p>
<p>Pick a word to see its cards. After “Mr.” the books nearly always name someone, mostly Mr. McGregor or Old Mr. Brown the owl, so there are only a few cards. After “the” almost anything can come, so there are a thousand small cards.</p>`,
			notes: `<p>The machine here counts words that follow one word (or, later, two). Counting pairs of words like this is called a <em>bigram</em> model, and the oldest ideas behind it go back more than a hundred years. The commas and quotation marks are left out to keep it simple; full stops are kept, so it knows where sentences end.</p>`
		},
		// ------------------------------------------------------------------ writing
		{
			id: 'spinner',
			chapter: 'writing',
			title: 'A spinner, not a list',
			scene: 'game',
			hints: { phase: 'spinner' },
			duration: 18,
			controls: [
				{
					type: 'action',
					id: 'spin',
					label: 'Spinner',
					action: 'Spin',
					help: 'Spin the spinner once.'
				}
			],
			body: `
<p>To write, the machine has to choose one card. It does not always take the biggest. It spins a spinner whose slices are as big as the counts: a word that came next ten times gets a slice ten times bigger than a word seen once.</p>
<p>Spin a few times. The big slices win most often, but now and then an unusual word turns up. That is why a machine like this does not write the same story every time.</p>`
		},
		{
			id: 'write',
			chapter: 'writing',
			title: 'One word at a time',
			scene: 'game',
			hints: { phase: 'write' },
			duration: 22,
			controls: [
				{
					type: 'action',
					id: 'next',
					label: 'Write',
					action: 'Add a word',
					help: 'Spin for one more word.'
				}
			],
			body: `
<p>Now let it write. It starts at the beginning of a sentence, looks at its cards for what comes first, and spins. The word it picked goes onto the end of the story, and that word is now the last word: it looks at <em>its</em> cards and spins again.</p>
<p>Press the button again and again. Each pair of words next to each other is one the machine has seen in a book, but the whole story wanders, because it only ever looks at the last word.</p>`
		},
		{
			id: 'two-words',
			chapter: 'writing',
			title: 'Looking back two words',
			scene: 'game',
			hints: { phase: 'two' },
			duration: 18,
			controls: [
				{
					type: 'toggle',
					id: 'two',
					label: 'Look back two words',
					default: false
				}
			],
			body: `
<p>Give the machine a slightly better memory: switch on “look back two words”. Now it keeps cards for every <em>pair</em> of words, so after “she went” it only uses what came after “she went”, not after any “went”.</p>
<p>The story makes more sense, because each three words in a row come from a book. But it still forgets everything before the last two words.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'more-books',
			chapter: 'more',
			title: 'Read more books',
			scene: 'game',
			hints: { phase: 'more' },
			duration: 20,
			controls: [
				{
					type: 'action',
					id: 'more',
					label: 'Books',
					action: 'Read more books',
					help: 'Add the next book on the shelf to what it has read.'
				}
			],
			body: `
<p>So far the machine has read seven books. Here it starts again with just one, <em>The Tale of Peter Rabbit</em>: a thousand words. Press “read more books” to add the next one.</p>
<p>Watch the cards after “the” fill up, and watch how often its first guess is right in Jemima Puddle-Duck’s story, which it never reads. With one book it is right about once in thirty words; with all seven, about once in ten. More reading, better guesses.</p>`
		},
		{
			id: 'likely',
			chapter: 'more',
			title: 'Likely, not true',
			scene: 'game',
			hints: { phase: 'likely' },
			duration: 18,
			controls: [
				{
					type: 'action',
					id: 'again',
					label: 'Write',
					action: 'Write another sentence',
					help: 'A new sentence, spun word by word.'
				}
			],
			body: `
<p>Press the button for a sentence. The machine checks nothing: it doesn’t know what a fox or a basket is, and it does not look anything up in the books. It keeps only its cards, not the books themselves.</p>
<p>Most of its sentences are in no book at all: it has stitched them together from pieces. Some sound fine, some are nonsense, and some say things that are simply not true. It picks <strong>likely</strong> words, not true ones.</p>`
		},
		{
			id: 'real',
			chapter: 'more',
			title: 'Real chatbots',
			scene: 'game',
			hints: { phase: 'real' },
			duration: 16,
			body: `
<p>A real chatbot plays the same game: it writes one word (or piece of a word) at a time, adds it to the text, and guesses again. But it is far better at guessing than this toy.</p>
<p>This toy looks back one or two words and keeps simple counts. A real chatbot uses a <dfn data-def="A computer program made of many simple connected parts whose strengths are tuned by training on examples.">neural network</dfn> that looks back over thousands of words at once, trained on a huge amount of text. It still picks likely words, so it can still say things that are not true.</p>
<p>Next: <a href="../ngram-text-models/">n-gram text models</a> takes this counting game further, and <a href="../language-models/">language models</a> shows how a real one guesses.</p>`
		}
	]
};
