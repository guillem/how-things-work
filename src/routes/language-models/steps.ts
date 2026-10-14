import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** The prompts on the page (ids match `gpt2-lm-data.ts`; a model test checks). */
export const PROMPTS = {
	capital: 'Paris is the capital of France, and Rome is the capital of',
	story: 'Once upon a time, there was a',
	eiffel: 'The Eiffel Tower is in the city of',
	qa: 'Q: What is the boiling point of water?\nA:',
	question: 'What is the boiling point of water?'
} as const;
export type PromptId = keyof typeof PROMPTS;

/** The message typed on the tokenizer steps, before the reader types anything. */
export const DEFAULT_MESSAGE = 'The Eiffel Tower is unbelievably tall!';

/** Temperatures and runs stored for the sampling steps (see the build script). */
export const RUN_TEMPS = ['0', '0.3', '0.7', '1', '1.5'] as const;

const prompt: Control = {
	type: 'select',
	id: 'pr',
	label: 'Prompt',
	default: 'capital',
	options: [
		{ value: 'capital', label: 'capital of' },
		{ value: 'story', label: 'Once upon a time' },
		{ value: 'eiffel', label: 'Eiffel Tower' },
		{ value: 'qa', label: 'Q: … A:' }
	],
	help: 'Four fixed prompts, run through GPT-2 small when the page was made.'
};

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 0,
	max: 2,
	step: 0.1,
	default: 1,
	format: (v) => (v < 0.05 ? '0 (greedy)' : v.toFixed(1))
};

const topK: Control = {
	type: 'range',
	id: 'topk',
	label: 'Top-k',
	min: 1,
	max: 10,
	step: 1,
	default: 3,
	format: (v) => `keep ${Math.round(v)}`
};

const topP: Control = {
	type: 'range',
	id: 'topp',
	label: 'Top-p',
	min: 0.05,
	max: 1,
	step: 0.05,
	default: 0.9,
	format: (v) => (v > 0.999 ? '1 (off)' : v.toFixed(2))
};

const runPrompt: Control = {
	type: 'select',
	id: 'rp',
	label: 'Prompt',
	default: 'story',
	options: [
		{ value: 'story', label: 'Once upon a time' },
		{ value: 'eiffel', label: 'Eiffel Tower' },
		{ value: 'qa', label: 'Q: … A:' }
	]
};

const runTemp: Control = {
	type: 'select',
	id: 'rt',
	label: 'Temperature',
	default: '0.7',
	options: RUN_TEMPS.map((v) => ({ value: v, label: v === '0' ? '0 (greedy)' : v }))
};

const runTopP: Control = {
	type: 'toggle',
	id: 'rtp',
	label: 'Top-p 0.9',
	default: false,
	help: 'Sample only from the most likely tokens that together make up 90% of the probability.'
};

const seed: Control = {
	type: 'range',
	id: 'seed',
	label: 'Run',
	min: 1,
	max: 3,
	step: 1,
	default: 1,
	format: (v) => `no. ${Math.round(v)} of 3`,
	help: 'Three runs with different random numbers, drawn when the page was made.'
};

const treePrompt: Control = {
	type: 'select',
	id: 'tp',
	label: 'Prompt',
	default: 'story',
	options: [
		{ value: 'story', label: 'Once upon a time' },
		{ value: 'eiffel', label: 'Eiffel Tower' }
	]
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Your text',
	action: 'Start again'
};

const framing: Control = {
	type: 'select',
	id: 'frame',
	label: 'Prompt',
	default: 'question',
	options: [
		{ value: 'question', label: 'Bare question' },
		{ value: 'qa', label: 'Framed as Q: … A:' }
	]
};

const MODEL = `<dfn data-def="A language model published by OpenAI in 2019: a transformer with 12 layers and 124 million learned numbers, trained on 40 GB of web text. Its weights are public under the MIT licence.">GPT-2 small</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'language-models',
	title: 'How language models write',
	summary:
		'Type a sentence and watch it split into GPT-2’s tokens, see the model’s real probabilities for the next token, then turn them into text one token at a time: greedy, with temperature, top-k and top-p, or by picking each token yourself.',
	chapters: [
		{ id: 'tokens', title: 'Text becomes tokens' },
		{ id: 'predict', title: 'One prediction' },
		{ id: 'generate', title: 'Writing, one token at a time' },
		{ id: 'chat', title: 'Base models and chatbots' }
	],
	steps: [
		// ------------------------------------------------------------------ tokens
		{
			id: 'tokens',
			chapter: 'tokens',
			title: 'Text is cut into tokens',
			scene: 'tokens',
			hints: { phase: 'tokens' },
			duration: 24,
			body: `
<p>A <dfn data-def="A program that gives a probability to every possible next piece of text, given the text so far. Large language models are neural networks with billions of learned numbers.">language model</dfn> does not read letters or words. It reads <dfn data-def="A piece of text from a fixed list, the vocabulary: a common word with its leading space, part of a rarer word, a digit, a punctuation mark or a single byte.">tokens</dfn>, pieces of text from a fixed list of 50,257, and each token is just a number, its position in that list.</p>
<p>Type in the box. The stage shows how ${MODEL} cuts your text, with the number of each token. Common words, with the space before them, are one token: <em>␣Tower</em> is token 8765. Rarer words are cut into pieces: <em>␣Eiffel</em> becomes <em>␣E</em>, <em>iff</em> and <em>el</em>. Try a long word, a number, accents or an emoji.</p>
<p>The tokenizer is GPT-2's own, running in your browser. Try <strong>Paris paris</strong>: <em>Paris</em> (40313) and <em>␣Paris</em> (6342) are different tokens, and <em>␣paris</em> is two, <em>␣par</em> + <em>is</em>. To the model these are unrelated symbols; it learns that they mean the same city only from how they are used.</p>`,
			notes: `<p>GPT-2's tokenizer first splits the text at spaces and punctuation (a word keeps the space in front of it, and endings such as <em>’s</em> and <em>’t</em> are split off), then turns each piece into its <dfn data-def="The standard way of storing text as bytes: one byte for plain English letters, two for accented letters, three for most Chinese characters, four for most emoji.">UTF-8</dfn> bytes. Because any text is made of bytes, nothing can ever be “unknown”: an emoji the vocabulary lacks is cut into tokens that are pieces of its bytes: 🙂 becomes ⟨F0 9F⟩ and ⟨99 82⟩, shown here in hexadecimal.</p>
<p>English text averages about four characters per token for GPT-2; other languages, numbers and code usually need more tokens for the same text, which makes them slower and costlier to process.</p>`
		},
		{
			id: 'merges',
			chapter: 'tokens',
			title: 'Where the tokens come from',
			scene: 'tokens',
			hints: { phase: 'merges' },
			duration: 26,
			body: `
<p>Nobody wrote GPT-2's list of tokens. It was learned from text by <dfn data-def="Byte-pair encoding: start from the 256 possible bytes, find the pair of neighbouring tokens that is most frequent in a large body of text, make it a new token, and repeat, here 50,000 times.">byte-pair encoding</dfn>: start from the 256 possible bytes, find the pair of neighbours that occurs most often in a large body of text, glue it into a new token, and repeat. GPT-2 did this 50,000 times: 256 bytes + 50,000 merges + one special token = 50,257.</p>
<p>The stage replays it on your text: every piece starts as single bytes, and at each tick the merge learned earliest among its neighbours is applied. The number on each merge is its rank. <em>␣t</em> + <em>he</em>, making <em>␣the</em>, is merge no. 7, among the very first; the pieces of a rare word join late, or never.</p>
<p>The result is a compromise. Frequent words are one token, so text stays short; rare words still fit, as several pieces.</p>`,
			notes: `<p>BPE was invented for data compression (Philip Gage, 1994) and adapted to language models by Sennrich, Haddow and Birch (2016). GPT-2's version, from Radford and colleagues (2019), works on bytes and never merges across the split between a word and the space or punctuation around it.</p>`
		},
		// ------------------------------------------------------------------ predict
		{
			id: 'next',
			chapter: 'predict',
			title: 'A probability for every token',
			scene: 'predict',
			hints: { phase: 'next' },
			duration: 26,
			controls: [prompt],
			body: `
<p>Give the model some tokens and it does exactly one thing: for <em>each</em> of the 50,257 tokens it says how likely that token is to come next. The stage shows GPT-2 small's real answer for the ten most likely, and one bar for all the others together.</p>
<p>After “… Rome is the capital of” it gives <em>␣Italy</em> 35%, <em>␣Rome</em> 27% and <em>␣the</em> 21%. After “Once upon a time, there was a” no token stands out: <em>␣time</em> gets 8% and almost three quarters of the probability is spread over tokens outside the top ten.</p>
<p>The probabilities say what tends to follow such text, not what is true. After “The Eiffel Tower is in the city of”, GPT-2 small puts <em>␣London</em> (8.1%) ahead of <em>␣Paris</em> (6.9%).</p>`,
			notes: `<p>These are the numbers GPT-2 small computed when this page was made: the prompts are fixed. Getting probabilities for a prompt you type would mean running the model in your browser, after downloading its 550 MB of weights. (The tokenizer above needs only its 200 KB list of merges.) Every prompt starts with GPT-2's special token <code>&lt;|endoftext|&gt;</code>, which separated documents in its training text.</p>`
		},
		{
			id: 'scores',
			chapter: 'predict',
			title: 'From scores to probabilities',
			scene: 'predict',
			hints: { phase: 'scores' },
			duration: 26,
			controls: [prompt],
			body: `
<p>Inside, the probabilities start as <dfn data-def="The raw scores a network gives each possible answer before a softmax turns them into probabilities. Only differences between logits matter.">logits</dfn>, one score per token. As on the <a href="../transformers/#stack">transformers</a> page, the network turns the prompt into one vector of 768 numbers at the last position, and compares it with the <a href="../embeddings/">embedding</a> of every token by a dot product: tokens whose embeddings point the way the network “wants” score high.</p>
<p>A softmax turns the scores into probabilities: raise e to the power of each score and divide by the total over all 50,257 tokens. The stage writes each score relative to the best one. <em>␣Rome</em> scores 0.28 below <em>␣Italy</em>, so it gets e<sup>−0.28</sup> ≈ 0.75 times its probability. A token 5 below gets e<sup>−5</sup> ≈ 1/150 of it.</p>
<p>The network that computes the scores is a <a href="../neural-networks/">neural network</a> of 124 million learned numbers. Bigger language models do the same with more: GPT-3 has 175 billion.</p>`,
			notes: `<p>Adding the same number to every score changes no probability, since it multiplies every e<sup>score</sup> by the same factor. That is why only the differences are shown.</p>`
		},
		{
			id: 'learned',
			chapter: 'predict',
			title: 'Trained to guess the next token',
			scene: 'training',
			hints: { phase: 'learned' },
			duration: 28,
			controls: [
				{
					type: 'range',
					id: 'pos',
					label: 'Position',
					min: 1,
					max: 20,
					step: 1,
					default: 14,
					help: 'Or point at a token on the stage.'
				}
			],
			body: `
<p>Where do the probabilities come from? GPT-2 was trained on about 40 GB of text from 8 million web pages (<dfn data-def="The training text of GPT-2: web pages linked from Reddit posts with at least 3 karma, about 8 million documents and 40 GB of text, collected by OpenAI in 2017.">WebText</dfn>) with one task: at every position, predict the next token. Nobody labelled anything: the text itself supplies the right answers.</p>
<p>The stage feeds GPT-2 a sentence and shows, under each token, the probability the model had given it before seeing it. <em>␣Tower</em> after “The Eiffel” was easy (98%); <em>␣Paris</em> after “is in” got only 0.9%, <em>␣1889</em> after “built in” 1.1%, and <em>␣330</em> 0.002%. The loss used in training is the <a href="../neural-networks/#train-neuron">cross-entropy</a>: the average of −ln p over the tokens. Training nudges all 124 million numbers, by <a href="../gradient-descent/">gradient descent</a>, to make that average smaller across billions of tokens.</p>
<p>To predict web text well, a model has to pick up grammar, facts, styles and some reasoning, because they all help guess what comes next. That is all it learned, and all it was asked to do.</p>`,
			notes: `<p>The WebText figures come from the GPT-2 paper (Radford and colleagues, “Language Models are Unsupervised Multitask Learners”, 2019). Every position of every training text is one guess, all made in parallel: GPT-2's mask (see the transformers page) stops each position from looking at the token it has to predict.</p>`
		},
		// ------------------------------------------------------------------ generate
		{
			id: 'greedy',
			chapter: 'generate',
			title: 'Writing: predict, pick, append, repeat',
			scene: 'generate',
			hints: { phase: 'greedy' },
			duration: 30,
			controls: [runPrompt],
			body: `
<p>A model that predicts one token can write a whole text: pick a token from the prediction, add it to the end of the text, and predict again from the longer text. Every token of every answer a language model gives is made this way, one at a time.</p>
<p>The simplest way to pick is to always take the most likely token: <dfn data-def="Generating text by always choosing the single most likely next token.">greedy decoding</dfn>. The stage runs it for 32 tokens, with GPT-2's prediction at each step. Watch what happens: the text is fluent at first, then GPT-2 goes round in circles (“… a place of chaos and chaos. The world is a place of chaos”), or starts the prompt over (“The Eiffel Tower is a …”). The most likely token at each step does not make the most likely, or the most interesting, text.</p>`,
			notes: `<p>Repetition is a well-known failure of greedy decoding (Holtzman and colleagues, “The curious case of neural text degeneration”, 2020): once a phrase has appeared, repeating it becomes likely, which makes it likelier still.</p>`
		},
		{
			id: 'temperature',
			chapter: 'generate',
			title: 'Temperature',
			scene: 'predict',
			hints: { phase: 'temperature' },
			duration: 26,
			controls: [prompt, temp],
			body: `
<p>Instead of always taking the top token, we can draw one at random, each with its probability. A setting called <dfn data-def="A number T that divides every logit before the softmax: below 1 it sharpens the distribution, above 1 it flattens it; T → 0 is greedy decoding.">temperature</dfn> T reshapes the distribution first: every score is divided by T before the softmax.</p>
<p>Move the slider. Below 1, differences grow and the top token takes over; at 0 it gets everything (greedy). Above 1, differences shrink and the rarer tokens catch up: at T = 2 the ten most likely tokens of the story prompt keep less than 2% between them, and the rest goes to tokens that make little sense.</p>
<p>Temperature changes no ranking: the order of the bars never changes, only their heights.</p>`,
			notes: `<p>The probabilities at every temperature are computed here, in your browser, from GPT-2's logits for the ten tokens shown and its normaliser Σ e<sup>score / T</sup> over all 50,257 tokens, stored when the page was made for T = 0.1, 0.2, … 2.0.</p>`
		},
		{
			id: 'cutoffs',
			chapter: 'generate',
			title: 'Cutting off the tail: top-k and top-p',
			scene: 'predict',
			hints: { phase: 'cutoffs' },
			duration: 28,
			controls: [prompt, temp, topK, topP],
			body: `
<p>Thousands of unlikely tokens, each with a tiny probability, add up to a lot: draw at random and sooner or later one of them is picked, and the text goes off the rails. Two common cures remove the tail before drawing:</p>
<ul>
<li><dfn data-def="Sampling only from the k most likely tokens, after renormalising their probabilities to add up to 1.">Top-k</dfn>: keep only the k most likely tokens.</li>
<li><dfn data-def="Nucleus sampling: keep the fewest most likely tokens whose probabilities add up to at least p, renormalise, and draw from them.">Top-p</dfn> (nucleus sampling): keep the fewest most likely tokens whose probabilities add up to at least p.</li>
</ul>
<p>The kept tokens' probabilities are scaled up to add up to 1 again. The stage applies both: a token is kept only if both keep it. Top-p adapts to the prompt: with p = 0.9 and T = 1 it keeps 14 tokens after “… capital of”, but 3,167 after “Once upon a time, there was a”, where many continuations are reasonable.</p>`
		},
		{
			id: 'sample',
			chapter: 'generate',
			title: 'Rolling the dice',
			scene: 'generate',
			hints: { phase: 'sample' },
			duration: 34,
			controls: [runPrompt, runTemp, runTopP, seed],
			body: `
<p>Here is real sampling. At each step the kept tokens are laid end to end on a strip, each as long as its probability. A random number between 0 and 1 is drawn, and the token whose stretch it lands on is the one written.</p>
<p>Change the temperature and the run. At 0.3 the runs are almost the same as greedy text. At 0.7 they differ but stay sensible. At 1.5 the dice often land on rare tokens and the text turns to nonsense within a few words; top-p 0.9 keeps it together for longer.</p>
<p>These runs were drawn when the page was made, three for each setting, so a run's settings cannot change halfway. In “Choose the next token yourself”, below, you do the picking and can change the settings at every token.</p>`,
			notes: `<p>Each run draws its random numbers from numpy's generator with a fixed seed. Every stored text was read before publishing; one high-temperature run was replaced by the next seed's (the build script says which). The rule used, laying the probabilities end to end and seeing where a uniform random number falls, is called inverse transform sampling. Chat assistants typically sample at temperatures between 0.5 and 1 with top-p near 0.9, but every product picks its own settings.</p>`
		},
		{
			id: 'compare',
			chapter: 'generate',
			title: 'One prompt, many texts',
			scene: 'compare',
			hints: { phase: 'compare' },
			duration: 30,
			controls: [runPrompt, runTemp, runTopP],
			body: `
<p>The same prompt and the same model give a different text every time, because the dice differ. The stage shows the three runs for the setting chosen, next to the greedy text, which is always the same.</p>
<p>One different token sends a run somewhere else: at T = 0.7, run 1 of the story starts “a woman. She'd been in her late thirties”, run 3 “a time when an elf was the only person that could walk”. Every token is predicted from all the tokens before it, so one different choice changes everything that follows.</p>
<p>That is why asking a chat assistant the same question twice can give two different answers, and why a single unlucky token can steer an answer wrong.</p>`
		},
		{
			id: 'choose',
			chapter: 'generate',
			title: 'Choose the next token yourself',
			scene: 'choose',
			hints: { phase: 'choose' },
			duration: 40,
			controls: [treePrompt, temp, topP, restart],
			body: `
<p>Now you are the dice. Click one of GPT-2's candidate tokens to add it to the text; the model then predicts from the new text. Change the temperature and top-p at any point, and see which tokens they would allow.</p>
<p>The grey line is what GPT-2 would write from there if it always took the top token: pick a different token and the whole continuation changes.</p>
<p>Three tokens deep, for two prompts, GPT-2's predictions for its four most likely tokens at each step were stored when the page was made: 85 contexts per prompt, each a full run of the model.</p>`
		},
		// ------------------------------------------------------------------ chat
		{
			id: 'base',
			chapter: 'chat',
			title: 'A base model is not an assistant',
			scene: 'chat',
			hints: { phase: 'base' },
			duration: 34,
			controls: [framing],
			body: `
<p>GPT-2 is a <dfn data-def="A language model trained only to predict the next token of a large body of text, with no further training to follow instructions or hold a conversation.">base model</dfn>: it continues text the way web pages continue. Ask it “What is the boiling point of water?” and the most likely next token is a line break (53%): on the web, a question is often followed by more text, or more questions. Framed as “Q: … A:”, it writes an answer, because that is what follows such a pattern. Its greedy answer, “about 1.5 degrees Fahrenheit”, is fluent and wrong, and it then writes the next question itself: “Q: What is the temperature of water in a glass of water?”</p>
<p>Chat assistants such as ChatGPT, Claude or Gemini start as base models like this one, only far larger and trained on far more text. They are then trained further: on many example conversations written by people (<dfn data-def="Further training of a base model on examples of instructions and good responses, so that it learns to answer rather than merely continue.">instruction tuning</dfn>), and with people's judgements of which answers are better (<dfn data-def="Reinforcement learning from human feedback: people compare the model's answers, a second model learns to predict their preferences, and the language model is trained to produce answers that score well.">RLHF</dfn>).</p>
<p>That further training changes which continuations are likely, not how text is made. A chat is written out as one text, with special tokens marking who speaks, and the assistant's reply is generated one token at a time, exactly as on this page.</p>`,
			notes: `<p>The recipe was laid out for InstructGPT (Ouyang and colleagues, “Training language models to follow instructions with human feedback”, 2022): a 1.3-billion-parameter model trained this way was preferred by people to the 175-billion-parameter GPT-3 base model. GPT-2 had none of this training. Larger base models also get facts right far more often than GPT-2 small, but a confident, fluent, wrong answer remains possible for any language model.</p>`
		},
		{
			id: 'summary',
			chapter: 'chat',
			title: 'One token at a time',
			scene: 'loop',
			hints: { phase: 'summary' },
			duration: 26,
			body: `
<p>A language model does one thing: given the tokens so far, it gives every possible next token a probability. Everything else is that, repeated.</p>
<ul>
<li>text is cut into tokens from a learned vocabulary (50,257 for GPT-2);</li>
<li>a large neural network, a transformer, turns the tokens into a score for every possible next token, and a softmax turns the scores into probabilities;</li>
<li>it learned those scores by predicting the next token of a very large amount of text;</li>
<li>to write, pick a token (greedy, or at random after temperature, top-k and top-p), append it, and predict again;</li>
<li>chat assistants are the same machine after further training to answer.</li>
</ul>
<p>Fluent stories, answers and code all come out of this loop, run over and over by a very large network trained on a very large amount of text.</p>`
		}
	]
};
