import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Words offered for the two-word comparisons (all in the shipped subset). */
const WORDS = [
	'king',
	'queen',
	'man',
	'woman',
	'cat',
	'dog',
	'banana',
	'car',
	'paris',
	'france',
	'guitar',
	'piano',
	'happy',
	'sad',
	'good',
	'bad'
];
const wordOptions = WORDS.map((w) => ({ value: w, label: w }));

const wordA: Control = {
	type: 'select',
	id: 'a',
	label: 'First word',
	default: 'king',
	options: wordOptions
};
const wordB: Control = {
	type: 'select',
	id: 'b',
	label: 'Second word',
	default: 'queen',
	options: wordOptions,
	help: 'Try king with queen, then king with banana.'
};

const projection: Control = {
	type: 'select',
	id: 'proj',
	label: 'Map',
	default: 'tsne',
	options: [
		{ value: 'tsne', label: 't-SNE: keeps neighbours together' },
		{ value: 'pca', label: 'PCA: the two directions of greatest spread' }
	],
	help: 'The same 3,292 words, the same 100-number vectors: only the flattening changes.'
};

const relation: Control = {
	type: 'select',
	id: 'rel',
	label: 'Relationship',
	default: 'gender',
	options: [
		{ value: 'gender', label: 'man → woman' },
		{ value: 'capital', label: 'country → capital' },
		{ value: 'tense', label: 'verb → past tense' },
		{ value: 'compare', label: 'adjective → comparative' }
	]
};

const exclude: Control = {
	type: 'toggle',
	id: 'exclude',
	label: 'Leave out the three input words',
	default: true,
	help: 'Turn it off to see which word is really closest to the result.'
};

const failCase: Control = {
	type: 'select',
	id: 'fail',
	label: 'Analogy',
	default: 'brother',
	options: [
		{ value: 'brother', label: 'brother − man + woman' },
		{ value: 'bigger', label: 'bigger − big + small' },
		{ value: 'doctor', label: 'doctor − man + woman' },
		{ value: 'nurse', label: 'nurse − woman + man' }
	]
};

const orderCase: Control = {
	type: 'select',
	id: 'order',
	label: 'Pair of sentences',
	default: 'bite',
	options: [
		{ value: 'bite', label: 'Who bit whom?' },
		{ value: 'film', label: 'Good or bad?' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'embeddings',
	title: 'Embeddings: meaning as position',
	summary:
		'Explore a map of 3,292 real word vectors where related words cluster, search for any of them to see its nearest neighbours, work out king − man + woman, and compare sentences by the angle between them.',
	chapters: [
		{ id: 'vectors', title: 'Words as vectors' },
		{ id: 'map', title: 'A map of meaning' },
		{ id: 'directions', title: 'Directions are relationships' },
		{ id: 'sentences', title: 'Sentences' }
	],
	steps: [
		// ------------------------------------------------------------------ vectors
		{
			id: 'numbers',
			chapter: 'vectors',
			title: 'A word is a list of 100 numbers',
			scene: 'vectors',
			hints: { phase: 'numbers' },
			duration: 22,
			controls: [wordA, wordB],
			body: `
<p>A computer cannot do arithmetic with the word “king”. It can do arithmetic with numbers, so language programs turn every word into a list of numbers: a <dfn data-def="A list of numbers that stands for something (here a word), chosen so that similar things get similar lists. Also called a word vector.">word embedding</dfn>. On the stage are the real embeddings of two words, 100 numbers each, drawn as a strip of 100 bars: up for a positive number, down for a negative one.</p>
<p>A list of 100 numbers is a <a href="../linear-transformations/">vector</a>, just like the arrows (2, 1) on a flat grid, only with 100 numbers instead of 2: an arrow in a space with 100 <dfn data-def="One of the independent directions of a space. A flat grid has two (across and up); a vector of 100 numbers lives in a space with 100.">dimensions</dfn>. Nobody can picture 100 dimensions, but the arithmetic is the same as in two.</p>
<p>No single number means anything on its own: there is no “royalty” bar. But compare <strong>king</strong> and <strong>queen</strong>: many bars go up and down together. Now pick <strong>banana</strong> as the second word: the two strips have little in common.</p>`,
			notes: `<p><strong>Where the numbers come from.</strong> These are <dfn data-def="Global Vectors for word representation: word embeddings from Stanford, learned from how often words appear near each other.">GloVe</dfn> vectors (Pennington, Socher &amp; Manning, Stanford, 2014). A program read 6 billion words of Wikipedia and news text and counted, for 400,000 words, how often each one appears within a few words of each other one. It then adjusted 100 numbers per word until the dot product of two words' vectors (next step) matched the logarithm of how often they appear together. Nobody chose what any number means: they are whatever made the counts come out right.</p>
<p>The idea behind it is old: “you shall know a word by the company it keeps” (the linguist J. R. Firth, 1957). Words used in similar sentences (<em>cat</em> and <em>dog</em> both get fed, stroked and taken to the vet) end up with similar vectors.</p>
<p><strong>Our subset.</strong> This page carries 3,292 of the 400,000 words: the 3,200 most frequent ones, leaving out short “stop words” such as <em>the</em>, <em>of</em> and <em>she</em>, plus 92 everyday words (animals, food, family, capitals) so there are things to search for. The vectors are stored with 8 bits per number, which changes similarities by less than 0.01. The source data is public domain (PDDL).</p>`
		},
		{
			id: 'angle',
			chapter: 'vectors',
			title: 'Similar words point the same way',
			scene: 'vectors',
			hints: { phase: 'angle' },
			duration: 24,
			controls: [wordA, wordB],
			body: `
<p>To compare two vectors, multiply their numbers pair by pair and add everything up. That is the <dfn data-def="For two vectors of the same length: multiply them number by number and add up the products. For (1, 2) and (3, 4) it is 1·3 + 2·4 = 11.">dot product</dfn>. When the two lists go up and down together, most products are positive and the sum is large; when they are unrelated, positive and negative products cancel out.</p>
<p>Divide by the two lengths and you get the <dfn data-def="The dot product divided by the two vectors' lengths: the cosine of the angle between them. 1 means the same direction, 0 a right angle, −1 opposite directions.">cosine similarity</dfn>, the cosine of the angle between the two arrows: cos θ = a·b ⁄ (|a| |b|). It is 1 for arrows pointing the same way, 0 for a right angle and −1 for opposite directions. Any two arrows lie in one flat plane, even in 100 dimensions, so the stage can draw that plane and the true angle between them.</p>
<p><strong>king</strong> and <strong>queen</strong>: cos θ = 0.75, an angle of 41°. <strong>king</strong> and <strong>banana</strong>: 0.16, nearly a right angle. <strong>cat</strong> and <strong>dog</strong>: 0.88. Similar meaning, similar direction: on this page, “close” always means a small angle.</p>`,
			notes: `<p>Only the direction of a word vector is used here, so all of them are scaled to length 1 and the cosine is simply the dot product. In 100 dimensions two random directions are almost always close to a right angle (cos θ near 0), which is why 0.75 is a strong signal.</p>
<p>Opposites are often close: <em>good</em> and <em>bad</em> have cos θ = 0.77, <em>happy</em> and <em>sad</em> 0.68. They appear in the same kinds of sentences (“the food was good”, “the food was bad”), and the vectors only know about company, not truth.</p>`
		},
		// ------------------------------------------------------------------ map
		{
			id: 'map',
			chapter: 'map',
			title: 'A map of 3,292 words',
			scene: 'map',
			hints: { phase: 'map' },
			duration: 26,
			body: `
<p>Here are all 3,292 words, one dot each. To fit 100 dimensions onto a flat screen they have been squashed down to two by <dfn data-def="t-distributed stochastic neighbour embedding (van der Maaten &amp; Hinton, 2008): a method that places points on a flat map so that points that are close in the full space stay close on the map. Distances between far-apart groups mean little.">t-SNE</dfn>, a method that tries to keep each word next to the words it is close to in the full space.</p>
<p>Related words gather in clumps: numbers, months and days, countries, cities, sports, family, food, money. The colours were not painted on the map: a computer sorted the 100-number vectors into 12 groups (<dfn data-def="A method that sorts points into k groups by repeatedly assigning each point to the nearest group centre and moving each centre to the middle of its group.">k-means</dfn>) in the full space, and the groups come out together on the map.</p>
<p>Drag to move around, scroll or use the + and − buttons to zoom, and point at a dot to read its word. Zoom in on a clump to see more of its words.</p>`,
			notes: `<p>The map was computed once, when the page was made: exact t-SNE with a perplexity of 30 (roughly, each word pays attention to its 30 nearest neighbours) and 1,000 rounds of adjustment, started from the PCA map you will meet in two steps. The script is in the site's repository (<code>scripts/data/embeddings/</code>). The clumps are labelled with the words closest to the centre of each k-means group.</p>`
		},
		{
			id: 'search',
			chapter: 'map',
			title: 'Search a word, find its neighbours',
			scene: 'map',
			hints: { phase: 'search' },
			duration: 26,
			body: `
<p>Type a word into the box (or click a dot). The panel lists its <dfn data-def="The words whose vectors make the smallest angle with this word's vector (the highest cosine similarity).">nearest neighbours</dfn>: the ten words, out of our 3,292, whose vectors make the smallest angle with it, with their cosine similarity. The lines on the map join the word to them.</p>
<p>The neighbours are worked out in the full 100 dimensions, not on the map. Most of them sit in the same clump, but follow the lines: some lead far away. Search <strong>king</strong>, <strong>cat</strong>, <strong>red</strong> or <strong>paris</strong>. Then try <strong>apple</strong>: in news text it is mostly a company, so its neighbours are <em>microsoft</em> and <em>software</em>, not fruit.</p>`,
			notes: `<p>The search looks through all 3,292 words for each query, 329,200 multiplications. Real search engines that find documents by meaning (“semantic search”) do the same thing with millions of vectors, using clever indexes to avoid checking every one.</p>`
		},
		{
			id: 'distort',
			chapter: 'map',
			title: 'The map is a flattening, and flattening distorts',
			scene: 'map',
			hints: { phase: 'distort' },
			duration: 26,
			controls: [projection],
			body: `
<p>No flat map can keep all the distances of a 100-dimensional space, just as no flat map of the Earth keeps all the distances on a globe. Switch the map to <dfn data-def="Principal component analysis: a linear projection onto the two directions along which the points are most spread out.">PCA</dfn> and watch the same dots move.</p>
<p>PCA is a <a href="../linear-transformations/">linear transformation</a>: a 2 × 100 matrix that keeps only the two directions in which the words are most spread out, and throws away the other 98. It is honest about directions but blurs neighbourhoods: here, fewer than 3 in 100 of a word's ten true neighbours land among its ten closest dots. On the t-SNE map it is about 4 in 10. t-SNE keeps neighbourhoods better, but stretches and squeezes everything else: the gaps between clumps mean little.</p>
<p>So the map is good for exploring, and bad for measuring. Every similarity on this page is computed with the full vectors; the panel shows how many of the searched word's true neighbours each map keeps nearby.</p>`
		},
		// ------------------------------------------------------------------ directions
		{
			id: 'directions',
			chapter: 'directions',
			title: 'From man to woman is a direction',
			scene: 'directions',
			hints: { phase: 'pairs' },
			duration: 24,
			controls: [relation],
			body: `
<p>Subtracting two vectors gives the arrow that leads from one to the other: woman − man is the step from <strong>man</strong> to <strong>woman</strong>. The surprise is that this step is nearly the same for many pairs: man → woman, king → queen, uncle → aunt, actor → actress.</p>
<p>The stage is a flat view chosen for these pairs, and it is a linear map (2 × 100 numbers), so arrows stay arrows. Across is the average direction of the pair arrows; up is the direction in which the pairs differ most from each other. The arrows all point roughly the same way. The panel gives each arrow's cosine with the average direction, measured in the full space. For comparison, the step between two random pairs of words has a cosine of about 0.0 with another.</p>
<p>Choose another relationship: country → capital, present → past tense, big → bigger. Each has its own direction. The vectors were never told about gender, capitals or grammar; these directions come out of how the words are used.</p>`,
			notes: `<p>The average direction is built from the pairs on the stage, which flatters them a little. Measured directly against man → woman, king → queen has a cosine of 0.44 and brother → sister 0.59: weaker, but still far from the near 0 of unrelated steps.</p>`
		},
		{
			id: 'analogy',
			chapter: 'directions',
			title: 'king − man + woman = ?',
			scene: 'directions',
			hints: { phase: 'analogy' },
			duration: 26,
			controls: [exclude],
			body: `
<p>If man → woman is a direction, we can take that step from somewhere else. Start at <strong>king</strong>, subtract <strong>man</strong> and add <strong>woman</strong>, then look for the word whose vector is closest to where you land. The flat view is the plane through the three words, so the sum is drawn exactly: a parallelogram.</p>
<p>The landing point is not a word. The panel lists the five words closest to it, by cosine in the full space. With the three input words left out, the winner is <strong>queen</strong> (0.77). Now turn “leave out the three input words” off: the closest word is <strong>king</strong> itself (0.84). The arrow from man to woman is short compared with the distance between words, so you land near where you started. Every famous analogy result leaves the input words out, and so does this page.</p>
<p>Type your own words, or try the examples: paris − france + italy gives <strong>rome</strong>, walked − walk + swim gives <strong>swam</strong>.</p>`,
			notes: `<p>This recipe (add and subtract the unit vectors, then take the nearest word) is the one used by Mikolov and colleagues in 2013, who made word analogies famous with the word2vec embeddings. Searching only our 3,292 words instead of all 400,000 changes some answers: with more words there are more rivals near the landing point.</p>
<p>Words on the stage are placed by projecting them onto the plane of the three input words. Words that are off that plane (all of them, a little) are drawn where their shadow falls, so the closest word on the stage is not always the closest in the full space: trust the panel.</p>`
		},
		{
			id: 'failures',
			chapter: 'directions',
			title: 'When analogies go wrong',
			scene: 'directions',
			hints: { phase: 'failures' },
			duration: 24,
			controls: [failCase],
			body: `
<p>Word arithmetic is impressive but not reliable. <strong>brother − man + woman</strong> should be sister, but lands closest to <strong>daughter</strong>, then wife and mother: family words are packed so tightly that the step from man to woman overshoots. <strong>bigger − big + small</strong> gives <strong>larger</strong> before smaller, because <em>bigger</em> and <em>larger</em> mean the same.</p>
<p>The vectors also learn the prejudices of the text they were trained on. In this data <strong>doctor − man + woman</strong> gives <strong>nurse</strong>, and <strong>nurse − woman + man</strong> gives <strong>doctor</strong>. The arithmetic is right; the 2014 news and encyclopaedia text it learned from wrote about men doctors and women nurses more often. Systems built on embeddings can carry such patterns into decisions about real people, so researchers measure and try to remove them.</p>`,
			notes: `<p>Bolukbasi and colleagues (2016) showed such patterns in word2vec embeddings and proposed ways to remove a chosen direction from the vectors; Caliskan and colleagues (2017) found that word vectors reproduce many associations measured in people by psychology's implicit association tests. The examples on this page are computed from the GloVe vectors shown here.</p>`
		},
		// ------------------------------------------------------------------ sentences
		{
			id: 'sentences',
			chapter: 'sentences',
			title: 'Comparing two sentences',
			scene: 'sentences',
			hints: { phase: 'compare' },
			duration: 26,
			body: `
<p>A simple way to give a whole sentence a vector: average the vectors of its words. Small words that are not in our list (<em>the</em>, <em>a</em>, <em>on</em>…) are skipped and shown crossed out. Two sentences can then be compared like two words, by the angle between their average vectors.</p>
<p>“Shares fell sharply on Wall Street” and “the stock market dropped” share no word at all, yet their cosine is 0.89: the words point the same way. “The team won the match” and “the bank raised interest rates” score 0.41. Edit either sentence and watch the angle change.</p>`,
			notes: `<p>Averaging word vectors is the simplest sentence embedding, and a surprisingly good one for finding sentences about the same topic. Modern systems compute sentence embeddings with large neural networks trained for the task, but compare them in exactly the same way, by cosine.</p>`
		},
		{
			id: 'order',
			chapter: 'sentences',
			title: 'What an average forgets',
			scene: 'sentences',
			hints: { phase: 'order' },
			duration: 22,
			controls: [orderCase],
			body: `
<p>An average does not care about order. “The dog bit the man” and “the man bit the dog” contain the same words, so their averages are identical: cosine 1.00, an angle of 0°, although the news is very different. “The film was not good, it was bad” and “the film was not bad, it was good” say opposite things, and also score 1.00.</p>
<p>To understand a sentence, a program has to know which word does what to which. That is the job of the <dfn data-def="A neural network that updates each word's vector using the other words of the sentence, so that the vector of “bit” can depend on who bit whom.">transformer</dfn> networks behind modern language models: they start from word embeddings like these, and then let every word's vector take in information from the words around it.</p>`
		},
		{
			id: 'summary',
			chapter: 'sentences',
			title: 'Meaning as position',
			scene: 'map',
			hints: { phase: 'summary' },
			duration: 22,
			body: `
<p>An embedding turns each word into a point in a space with many dimensions, learned only from which words keep company. In that space:</p>
<ul>
<li><strong>distance stands for similarity</strong>: the smaller the angle, the closer the meaning;</li>
<li><strong>directions stand for relationships</strong>: man → woman, country → capital, present → past;</li>
<li>a flat map is only a picture of it, so measure in the full space.</li>
</ul>
<p>The same idea, with bigger vectors learned by bigger networks, is how search engines find documents by meaning, how recommendation systems find similar songs, and the first step of every large language model.</p>`
		}
	]
};
