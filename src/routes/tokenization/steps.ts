import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { MAX_MERGES, trained } from './bpe-train';

/** The text the first chapter learns from, before the reader types anything (Hamlet, act 3). */
export const DEFAULT_CORPUS =
	"To be, or not to be, that is the question: whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them. To die, to sleep, no more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to: 'tis a consummation devoutly to be wish'd. To die, to sleep;";

/** A sentence that is not in the text learned from: the next line of the speech. */
export const SAMPLE = "To sleep, perchance to dream: ay, there's the rub";

/** The text GPT-2's tokenizer cuts on the second chapter, before the reader types anything. */
export const DEFAULT_MESSAGE = 'Doth the unbelievable strawberry cost 2026 tokens?';

/** The longest texts the boxes accept. */
export const MAX_CORPUS = 1000;
export const MAX_MESSAGE = 120;

export const corpusOf = (p: Params) => (typeof p.corpus === 'string' ? p.corpus : DEFAULT_CORPUS);
export const messageOf = (p: Params) => (typeof p.msg === 'string' ? p.msg : DEFAULT_MESSAGE);

const merges: Control = {
	type: 'range',
	id: 'k',
	label: 'Merges',
	min: 0,
	max: MAX_MERGES,
	bounds: (p) => [0, trained(corpusOf(p)).merges.length],
	step: 1,
	default: 1,
	format: (v) => `${Math.round(v)} · vocabulary ${256 + Math.round(v)}`,
	disabled: (p) => p.play === true
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Play the merges',
	default: false,
	help: 'Learns one merge after another, from the bytes to the last pair that occurs twice. The slider follows, and takes over again when you switch it off.'
};

const number: Control = {
	type: 'range',
	id: 'num',
	label: 'Number',
	min: 0,
	max: 999,
	step: 1,
	default: 778,
	format: (v) => `␣${Math.round(v)}`
};

const BYTE = `<dfn data-def="Eight bits, a number from 0 to 255. Text is stored as bytes with the UTF-8 code: one byte for each plain English letter, digit or space, two for an accented letter, three for most Chinese and Japanese characters, four for most emoji.">byte</dfn>`;
const PIECES = `<dfn data-def="GPT-2 first cuts text with a fixed pattern: a word with the space in front of it, a run of digits, a run of punctuation, a run of spaces, or one of the endings 's 't 're 've 'm 'll 'd. Pairs are counted, and merged, only inside a piece.">pieces</dfn>`;
const RANK = `<dfn data-def="A merge's place in the list of merges, counting from 0: the order in which they were learned. A merge learned early joined a pair that was very frequent in the training text.">rank</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'tokenization',
	title: 'Tokenization & byte-pair encoding',
	summary:
		'Learn a tokenizer merge by merge from a text you type, then run GPT-2’s real one: why common words are one token, rare words several, numbers split oddly, other scripts cost more, and the letters inside a token are out of the model’s sight.',
	chapters: [
		{ id: 'learn', title: 'Learning the merges' },
		{ id: 'gpt2', title: 'GPT-2’s tokenizer' },
		{ id: 'cost', title: 'What the split costs' }
	],
	steps: [
		// ------------------------------------------------------------------ learn
		{
			id: 'bytes',
			chapter: 'learn',
			title: 'Start from bytes, count the pairs',
			scene: 'train',
			hints: { phase: 'pairs' },
			duration: 26,
			body: `
<p>A language model reads a list of numbers, one per token, from a fixed vocabulary. What should a token be? Whole words would need a vocabulary of millions and still meet words it has never seen. Single ${BYTE}s cover any text with only 256 tokens, but make every text long, and a transformer's work grows with the length of its input, faster than in proportion.</p>
<p><dfn data-def="BPE: start from single symbols, find the neighbouring pair that is most frequent in a training text, make it a new symbol, replace it everywhere, and repeat a fixed number of times. Philip Gage used it in 1994 to compress data; Sennrich, Haddow and Birch adapted it to cutting words in 2016.">Byte-pair encoding</dfn> learns something in between from a text. Type one in the box, or keep Hamlet. It is first cut into ${PIECES}, as GPT-2 does: a word keeps the space in front of it (shown ␣). Each piece starts as its bytes, one token each.</p>
<p>Then every pair of neighbouring tokens inside a piece is counted, each piece weighted by how often it occurs. In Hamlet, ␣ followed by <em>t</em> comes first, 19 times: ␣to, ␣the, ␣that, ␣take… That pair will be the first merge.</p>`,
			notes: `<p>Plain English letters are one byte each, so for this text bytes and characters are the same: 384 of each. Type an accented letter or an emoji and it starts as two to four byte tokens, shown in hexadecimal, ⟨C3⟩ ⟨A9⟩ for é, until a merge joins them.</p>`
		},
		{
			id: 'merge',
			chapter: 'learn',
			title: 'Merge the top pair, and repeat',
			scene: 'train',
			hints: { phase: 'merge' },
			duration: 30,
			controls: [merges, play],
			body: `
<p>The most frequent pair becomes a new token, number 256, and replaces the pair everywhere in the text. Then the pairs are counted again, now including pairs with the new token, and the next winner becomes token 257. Each merge adds one token to the vocabulary.</p>
<p>Move the slider, or press play. Hamlet's first merges are ␣t, then <em>he</em>, ␣a, then ␣t + <em>o</em> = ␣to; by the eighth, ␣t + <em>he</em> = ␣the. Pieces that occur often are soon a single token; rare ones stay in fragments.</p>
<p>When two pairs are equally frequent, this page takes the one that occurs first in the text, so the same text always gives the same merges. Training stops when no pair occurs twice: a pair seen once would only memorise the text. Here that is after 49 merges.</p>`,
			notes: `<p>A real tokenizer is trained on gigabytes of text and stops at a chosen vocabulary size rather than when pairs run out. Implementations differ in how they break ties; any fixed rule makes training repeatable. Counting overlapping pairs (<em>aaa</em> holds <em>aa</em> twice) and replacing left to right is the usual convention.</p>`
		},
		{
			id: 'shorter',
			chapter: 'learn',
			title: 'Fewer tokens, on new text too',
			scene: 'curve',
			duration: 28,
			controls: [merges, play],
			body: `
<p>Every merge shortens the text it was learned from. The curve shows the number of tokens as a share of the bytes, merge after merge: Hamlet's 384 bytes become 196 tokens after 49 merges, a little over half.</p>
<p>The second curve is a sentence the tokenizer never saw, the next line of the speech. To cut it, its bytes are merged with the merges already learned, always the earliest-learned merge first. It shrinks less, from 49 tokens to 33: merges help new text only where it repeats the training text's pairs, here ␣sleep, ␣to and ␣the. <em>perchance</em> and <em>dream</em> stay in single letters.</p>
<p>That is the trade-off of a vocabulary: more merges, shorter texts, but a larger table for the model to learn, and merges that fit the training text best.</p>`,
			notes: `<p>BPE is compression: like Gage's scheme, it replaces frequent pairs by new symbols. Gage's own example, <em>aaabdaaabac</em>, is the third example in the box: three merges turn its 11 bytes into 5 tokens. Unlike a compressor, a tokenizer keeps its merge list fixed after training and applies it to any new text.</p>`
		},
		// ------------------------------------------------------------------ gpt2
		{
			id: 'presplit',
			chapter: 'gpt2',
			title: 'GPT-2: the pre-split',
			scene: 'gpt2',
			hints: { phase: 'split' },
			duration: 26,
			body: `
<p>GPT-2's tokenizer is the same algorithm at scale: its merges were learned on the text of millions of web pages, and it stops after 50,000 merges. Its vocabulary is 256 bytes + 50,000 merges + one special token marking the end of a document, 50,257 tokens.</p>
<p>The stage runs GPT-2's real tokenizer on your text. First, the pattern at the bottom cuts it into ${PIECES}: a run of letters with at most one space in front, a run of digits, a run of other symbols, runs of spaces, and the endings <em>'s 't 're 've 'm 'll 'd</em> (with a straight apostrophe). Merges never cross a boundary between pieces, so <em>dog.</em> and <em>dog!</em> share the token ␣dog instead of each needing its own.</p>
<p>Then each piece is cut into tokens, below it. Because everything starts from bytes, any text can be encoded: there is no “unknown word” token.</p>`,
			notes: `<p>Radford and colleagues (2019) added the split because plain BPE on web text wasted merges on variants such as <em>dog.</em>, <em>dog!</em> and <em>dog?</em>; they prevented merges across character categories, with an exception for the space before a word. The pattern used here is the one in GPT-2's published code.</p>`
		},
		{
			id: 'ranks',
			chapter: 'gpt2',
			title: 'Merges in the order they were learned',
			scene: 'gpt2',
			hints: { phase: 'ranks' },
			duration: 30,
			body: `
<p>To cut a piece, GPT-2 starts from its bytes and looks at every neighbouring pair that is in its merge list. It joins the pair whose merge was learned earliest, the lowest ${RANK}, and looks again, until no pair has a merge. The ladder replays that for one piece of your text.</p>
<p>This is not the same as taking the longest token that fits. ␣doth is cut ␣d + <em>oth</em>, although ␣dot is a token: ␣ + <em>d</em> is merge no. 33, <em>o + t</em> no. 58 and <em>ot + h</em> no. 594, while ␣d + <em>ot</em>, which makes ␣dot, is no. 16,350; by then there is no <em>ot</em> left to join. Longest-first would give ␣dot + <em>h</em>; <em>Doth</em>, at the start of the example, is cut <em>D</em> + <em>oth</em> where longest-first takes <em>Do</em> + <em>th</em>. The two rows compare the rules on your text; where they differ, it is marked.</p>
<p>Applying the merges in rank order repeats how the training text itself was cut, so a word is split the same way the model saw it during training. The split depends only on the merge list: the same text always gives the same tokens.</p>`,
			notes: `<p>Some tokenizers do cut by longest match: BERT's WordPiece takes the longest vocabulary entry at each position. On ordinary English the two rules mostly agree; they differ on rarer words, like the names and archaic forms of Shakespeare's plays.</p>`
		},
		{
			id: 'common',
			chapter: 'gpt2',
			title: 'Common words whole, rare words in pieces',
			scene: 'gpt2',
			hints: { phase: 'common' },
			duration: 26,
			body: `
<p>Here each token is coloured by its rank, when its merge was learned. The first merges joined the most frequent pairs of the training text: ␣the is merge no. 7. Frequent words become one token early, often with their space: ␣unbelievable is a single token.</p>
<p>A rarer word is left in pieces that are frequent on their own: ␣tokenization is ␣token + <em>ization</em>, and ␣antidisestablishmentarianism takes five tokens. Capitals and spaces matter too: <em>Doth</em> at the start of a text is <em>D</em> + <em>oth</em>, ␣Doth is ␣D + <em>oth</em>, ␣doth is ␣d + <em>oth</em>, three different first tokens.</p>
<p>So the model meets whole words where text is common and fragments where it is rare. The fragments still carry meaning it can learn (<em>ization</em> ends many nouns), but rare words take more tokens and give it less to go on per token.</p>`
		},
		// ------------------------------------------------------------------ cost
		{
			id: 'numbers',
			chapter: 'cost',
			title: 'Numbers split oddly',
			scene: 'numbers',
			duration: 26,
			controls: [number],
			body: `
<p>Numbers get no special treatment: they are merged by frequency like everything else. Each square of the grid is one number from ␣0 to ␣999, with a space in front, as in running text. Every number from ␣0 to ␣361 is a single token. Above that, fewer and fewer are: about half of the 400s, and only 6 to 18 in each later hundred, depending on how often each number appeared in the training text. The others take two tokens; in all, 505 of the thousand are single tokens.</p>
<p>Pick a number with the slider: ␣777 is one token, ␣778 is ␣7 + <em>78</em>. ␣2025 is one, ␣2026 is ␣20 + <em>26</em>. Long numbers are cut into irregular chunks: ␣1234567 is ␣123 + <em>45</em> + <em>67</em>.</p>
<p>The model has to learn arithmetic on these chunks: the digit in the hundreds place lands in a different token from one number to the next. Later tokenizers fix this by rule, splitting digits one by one or in groups of three.</p>`,
			notes: `<p>LLaMA (2023) splits every number into single digits; the tokenizer of GPT-3.5 and GPT-4 splits digits into groups of at most three before merging, by adding that to its pre-split pattern.</p>`
		},
		{
			id: 'languages',
			chapter: 'cost',
			title: 'Other scripts cost more',
			scene: 'languages',
			duration: 26,
			body: `
<p>GPT-2's merges were learned from web pages that were mostly in English, so English words got merges and other scripts mostly did not. The same request costs 10 tokens in English, 13 in Spanish, 21 in French, and 40 in Russian, 44 in Greek, 47 in Hindi.</p>
<p>Part of this is bytes: a Cyrillic or Greek letter takes two bytes in UTF-8, a Devanagari, Chinese or Japanese character three. But the bigger part is merges. With few merges for its script, a Russian or Hindi word stays in single letters, or even in single bytes that are only part of a letter (shown in hexadecimal on the stage).</p>
<p>A model's input and output are counted in tokens, so this is a real cost: the same text in Hindi fills nearly five times as much of the model's context, takes nearly five times as many steps to write, and costs more where use is billed per token.</p>`,
			notes: `<p>Tokenizers trained on more languages, with larger vocabularies (about 100,000 tokens for GPT-4's, about 200,000 for GPT-4o's), narrow the gap but do not close it. The sentences on the stage are simple translations of one request; counts vary with wording.</p>`
		},
		{
			id: 'letters',
			chapter: 'cost',
			title: 'What the model cannot see',
			scene: 'letters',
			duration: 26,
			body: `
<p>The model receives the numbers in the bottom row, not the letters. ␣strawberry is one token in GPT-2: a single number. The letters inside it are not part of the input; whatever the model knows about its spelling, it must have picked up from text where the word was spelled out, rhymed or discussed.</p>
<p>The same word is a different input in other places: at the start of a text, without its space, it is <em>st</em> + <em>raw</em> + <em>berry</em>, three numbers that share nothing with the first. Spelled with spaces, it becomes ten tokens, one per letter: single letters are tokens too, and then the model does see each one.</p>
<p>This is why questions about letters (how many r's in strawberry, what is this word backwards) are hard for language models that answer instantly, while the same models handle meaning well: inside a merged token the spelling is invisible to them.</p>`,
			notes: `<p>Models can work around it: writing the word out letter by letter first, as in the last row, turns a spelling question into one about separate tokens. That is one reason why letting a model write out intermediate steps helps.</p>`
		}
	]
};
