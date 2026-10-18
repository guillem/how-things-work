import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** The reader's text on the first two steps, before they type anything (Hamlet, act 3). */
export const DEFAULT_TEXT =
	"To be, or not to be, that is the question: whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles";

export const SIZE_OPTIONS = [
	{ value: '10k', label: '10,000 letters' },
	{ value: '100k', label: '100,000' },
	{ value: '1m', label: 'all 1,003,854' }
] as const;
export type SizeId = (typeof SIZE_OPTIONS)[number]['value'];

const ownWindow: Control = {
	type: 'range',
	id: 'cn',
	label: 'Window',
	min: 1,
	max: 4,
	step: 1,
	default: 2,
	format: (v) => `${Math.round(v)} letter${Math.round(v) === 1 ? '' : 's'}`
};

const window: Control = {
	type: 'range',
	id: 'n',
	label: 'Window n',
	min: 1,
	max: 10,
	step: 1,
	default: 3,
	format: (v) => `${Math.round(v)} letter${Math.round(v) === 1 ? '' : 's'}`
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Random draws',
	action: 'Write again'
};

const size: Control = {
	type: 'select',
	id: 'size',
	label: 'Training text',
	default: '1m',
	options: SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
	help: 'The model counts only the first part of the plays.'
};

const WINDOW = `<dfn data-def="The last few letters the machine looks at before choosing the next one. Spaces, line breaks and punctuation count as letters too. Also called the context.">window</dfn>`;
const HELD_OUT = `<dfn data-def="Text kept aside while the model learns, and used only to test it, so the test shows how the model does on text it has never seen. Here: the last tenth of Tiny Shakespeare.">held-out text</dfn>`;
const TINY = `<dfn data-def="1,115,394 characters of speeches from Shakespeare’s plays, put together by Andrej Karpathy in 2015 to train small text models. Shakespeare’s plays are in the public domain.">Tiny Shakespeare</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'ngram-text-models',
	title: 'Counting machines that write',
	summary:
		'Build a machine that writes by counting which letter followed the last few in a text, then feed it a million letters of Shakespeare and widen its window: its text gets more fluent, while text it has never read becomes a blank and its writing turns into recitation.',
	chapters: [
		{ id: 'count', title: 'A counting machine' },
		{ id: 'longer', title: 'Longer windows' },
		{ id: 'limits', title: 'Why counting runs out' }
	],
	steps: [
		// ------------------------------------------------------------------ count
		{
			id: 'count',
			chapter: 'count',
			title: 'Count what comes next',
			scene: 'count',
			duration: 24,
			controls: [ownWindow],
			body: `
<p>Here is a machine that learns to write by counting. Feed it a text. It slides a ${WINDOW} of a few letters along it, one letter at a time, and each time it notes the letter that comes right after the window. Spaces and punctuation count as letters too (the stage shows a space as ␣).</p>
<p>Type in the box or pick an example. The table fills up as the window moves: each row is a window, and next to it every letter that followed it, with how many times. A window that turns up often collects several different next letters; most windows of a short text turn up once, with a single letter after them.</p>
<p>That table is the whole model. There are no rules of spelling or grammar in it, only counts. This is the same idea as fitting a model to data: the counts are learned from examples, and the test is how well they predict new ones.</p>`,
			notes: `<p>A window of <em>n</em> letters together with the letter after it is a run of <em>n</em> + 1 letters, an <dfn data-def="A run of n consecutive symbols (letters or words) in a text. Bigrams are runs of two, trigrams runs of three.">n-gram</dfn>, which gives these models their name: a machine with a window of 2 counts trigrams. Claude Shannon wrote text this way by hand in 1948, without any table: he opened a book at random, read until he met the letters he had just written, and copied the letter that came after them.</p>`
		},
		{
			id: 'write',
			chapter: 'count',
			title: 'Write by drawing letters',
			scene: 'write',
			duration: 30,
			controls: [ownWindow, again],
			body: `
<p>To write, the machine looks at the last letters it wrote, finds that window in its table, and draws the next letter at random, so that each letter's chance is its share of the counts. Picture a spinner whose slices are as wide as the counts: a common next letter gets a wide slice, a rare one a thin slice.</p>
<p>The new letter joins the text, the window moves on by one, and it draws again. At the very start, before it has written enough letters, it uses the ones it has.</p>
<p>With a short text the table is thin. Many windows were followed by only one letter, so the spinner has a single slice and the machine just copies your text back. Press <strong>Write again</strong> for other random draws.</p>`,
			notes: `<p>The draws use a seeded random generator, so the same seed always gives the same text, as it would with a recorded die. Picking the most common next letter every time instead would always write the same thing, and often loop on the same few words.</p>`
		},
		// ------------------------------------------------------------------ longer
		{
			id: 'shakespeare',
			chapter: 'longer',
			title: 'A million letters of Shakespeare',
			scene: 'lab',
			hints: { phase: 'write' },
			duration: 30,
			controls: [window, again],
			body: `
<p>Now the machine counts ${TINY}: speeches from Shakespeare's plays. It learns from the first 90%, 1,003,854 characters, and writes 600 of its own. Slide the window <em>n</em> from 1 to 10.</p>
<p>With 1 or 2 letters it writes gibberish with the rhythm of English. With 4, nearly nine words in ten are real words; from 5 on almost all are, with speakers' names, line breaks and punctuation in the right places. The first meter measures this: the share of the written words that occur somewhere in the plays.</p>
<p>Longer windows write better text. So why not use a window of 20, or 100? The other two meters show what goes wrong; the next steps explain them.</p>`,
			notes: `<p>“Real words” counts the words of the sample that appear in the training text. It says nothing about grammar or meaning: “Ay, with water as he is gone” is all real words. The figures in the text are averages over three samples of 600 characters.</p>`
		},
		{
			id: 'heldout',
			chapter: 'longer',
			title: 'Text it has never read',
			scene: 'unseen',
			hints: { phase: 'heldout' },
			duration: 26,
			controls: [window],
			body: `
<p>Writing is not the real test of a model: it should also predict text it has never seen. So the last tenth of Tiny Shakespeare, 111,540 characters from <em>The Taming of the Shrew</em>, is kept apart as ${HELD_OUT}. The machine never counted it.</p>
<p>Go through it letter by letter and ask: did the <em>n</em> letters before this one ever appear in the training text? If not, the machine has no counts for that window and no idea what comes next. The stage marks those letters.</p>
<p>With a window of 3, only 1.4% of the windows are new. With 6, it is 21%; with 8, half; with 10, three in four. The longer the window, the more often the machine meets a window it has never seen.</p>`
		},
		{
			id: 'explode',
			chapter: 'longer',
			title: 'Too many possible windows',
			scene: 'explode',
			duration: 24,
			controls: [window],
			body: `
<p>The text uses 65 different characters. A window of 1 letter can be one of 65; a window of 2, one of 65 × 65 = 4,225; every extra letter multiplies the possibilities by 65 again. A window of 4 can already be one of 17,850,625, more than the 1,003,854 letters the machine learned from. A window of 10 can be one of about 1.3 billion billion.</p>
<p>Most of those windows are nonsense that no text would contain, but the sensible ones multiply too. The bars compare, on a scale where each line is ten times the one below, the windows possible with those that actually occur in the training text. At 10 letters the plays hold 780,165 different windows, almost one new window at every position, so nearly all of them were seen only once.</p>`,
			notes: `<p>Growth by the same factor at every step is called exponential. It is why the bars climb as a straight line on this scale, where equal steps up mean ten times more.</p>`
		},
		{
			id: 'moredata',
			chapter: 'longer',
			title: 'More text is not the fix',
			scene: 'unseen',
			hints: { phase: 'sizes' },
			duration: 24,
			controls: [window, size],
			body: `
<p>Would more text fix it? It helps, but only a little. The curves show the share of held-out windows never seen when the machine counts 10,000, 100,000 or all 1,003,854 letters of the plays.</p>
<p>With 100 times more text, the share for a window of 10 drops only from 99.4% to 75%. Each extra letter in the window multiplies the possible windows, while more text only adds windows in proportion to its length. To keep up, every letter added to the window would need far more text again, and soon more than has ever been written.</p>
<p>Two old repairs help with the blanks: <dfn data-def="Pretending every letter was seen at least a little after every window, so that no next letter has a chance of exactly zero.">smoothing</dfn>, and <dfn data-def="When the window was never seen, falling back to a shorter window that was, and using its counts instead.">backing off</dfn> to a shorter window. Both give an answer for a new window, but the answer comes from fewer letters back, so the machine still cannot use what came long before.</p>`
		},
		{
			id: 'recite',
			chapter: 'longer',
			title: 'Long windows only copy',
			scene: 'lab',
			hints: { phase: 'copy' },
			duration: 30,
			controls: [window, again, size],
			body: `
<p>The writing has the opposite problem. The machine only ever writes windows it has seen, and with long windows most of those were seen once, always followed by the same letter. Then there is no choice to make: the spinner has one slice.</p>
<p>The stage marks the longest stretch of the sample that appears word for word in the plays, and shows where. With a window of 1 it is about 9 characters; with 10 it is about 75, whole lines of Shakespeare, and on 84% of the letters the machine had no choice. Try the window at 10, or less training text: the machine is no longer writing, it is reciting.</p>`,
			notes: `<p>This is the same trade-off as fitting a curve to points: a model flexible enough to follow every detail of its examples, here every exact run of 10 letters, ends up repeating its examples instead of predicting new ones.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'limits',
			chapter: 'limits',
			title: 'Counting cannot reach far back',
			scene: 'summary',
			duration: 26,
			controls: [window],
			body: `
<p>Put the three meters side by side. As the window grows, the text gets more fluent, but the share of new text the machine has never seen climbs towards all of it, and its own writing turns into copying. No window is long enough to keep track of who is speaking or what a sentence is about, yet short enough to have been seen.</p>
<p>A model that looks far back must <em>generalise</em>: treat a window it has never seen like similar ones it has. That is what the neural networks behind chatbots learn to do. They do not count exact windows, and they do not look text up in a stored copy: they turn the text into numbers that put similar contexts close together, and they can look back over thousands of words.</p>
<p>They still write the way this machine does: predict the next piece of text from the ones before, draw one, add it, and repeat.</p>`,
			notes: `<p>Counting models were the standard way to predict text for decades, in speech recognition and machine translation, with word windows of 3 to 5 and clever smoothing. In 2007 Google trained one on 2 trillion words of web text (Brants and colleagues), and it still could not look back further than 4 words. Neural language models replaced counting in the 2010s.</p>
<p>The figures on this page are measured live on Tiny Shakespeare: the meters on the stage are recomputed for every sample, and the curves here average three samples of 600 characters for each window.</p>`
		}
	]
};
