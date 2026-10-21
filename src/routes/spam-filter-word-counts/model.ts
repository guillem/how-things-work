/**
 * The word-counting spam filter behind "How a spam filter decides": for every word, how many
 * spam messages and how many ordinary ones contain it, and a vote from each word of a new message
 * according to those two counts. Underneath it is a naive Bayes classifier (each word counted once per
 * message, the "binarized multinomial" kind; each word's vote is how many times more common it is
 * among the spam pile's words than among the ordinary pile's, with add-one smoothing; a word
 * never seen doesn't vote), but the page only ever shows the counts and the votes.
 */

/** A message of the collection: its id there, whether it was marked spam, and its text. */
export interface Message {
	id: number;
	spam: boolean;
	text: string;
}

/**
 * The words of a message, lower case, each once (the filter asks "does it contain it?"). An
 * ending "'s" is dropped, so "mum's" counts as "mum" (and "it's" as "it").
 */
export function words(text: string): string[] {
	const found = text
		.toLowerCase()
		.replace(/&amp;/g, '&')
		.replace(/&lt;#&gt;/g, ' ')
		.match(/[a-z0-9£]+(?:'(?!s\b)[a-z]+)?/g);
	return [...new Set(found ?? [])];
}

export interface Counts {
	/** Messages marked spam, and ordinary ones. */
	spam: number;
	ham: number;
	/** For each word: in how many spam messages, and how many ordinary ones, it turns up. */
	word: Map<string, { spam: number; ham: number }>;
	/** All those counts added up: the words of the spam pile, and of the ordinary pile. */
	spamWords: number;
	hamWords: number;
}

/** Lets the filter count every word of every message. */
export function count(messages: Message[]): Counts {
	const c: Counts = { spam: 0, ham: 0, word: new Map(), spamWords: 0, hamWords: 0 };
	for (const m of messages) add(c, m.text, m.spam);
	return c;
}

/** Adds one more marked message to the counts (a "report spam" click, or "not spam"). */
export function add(c: Counts, text: string, spam: boolean, by = 1): Counts {
	if (spam) c.spam += by;
	else c.ham += by;
	for (const w of words(text)) {
		const e = c.word.get(w) ?? { spam: 0, ham: 0 };
		if (spam) {
			e.spam += by;
			c.spamWords += by;
		} else {
			e.ham += by;
			c.hamWords += by;
		}
		if (e.spam + e.ham > 0) c.word.set(w, e);
		else c.word.delete(w);
	}
	return c;
}

/** A copy of the counts, so that adding to it leaves the original alone. */
export function copy(c: Counts): Counts {
	return {
		...c,
		word: new Map([...c.word].map(([w, e]) => [w, { ...e }]))
	};
}

export interface Vote {
	word: string;
	/** In how many spam and ordinary messages it turned up. */
	spam: number;
	ham: number;
	/**
	 * How many times more common the word is in spam than in ordinary messages (above 1: a vote
	 * for spam; below 1: a vote for "not spam"), comparing its share of all the words in each pile;
	 * 1 (no vote) for a word never seen.
	 */
	times: number;
	/** The strength of the vote: the number of doublings in `times` (positive: toward spam). */
	push: number;
}

/** One word's vote. */
export function vote(c: Counts, w: string): Vote {
	const e = c.word.get(w) ?? { spam: 0, ham: 0 };
	if (e.spam + e.ham === 0) return { word: w, spam: 0, ham: 0, times: 1, push: 0 };
	// The word's share of all the words in each pile, with one more of every word it knows added
	// to each pile so that no share is zero.
	const known = c.word.size;
	const inSpam = (e.spam + 1) / (c.spamWords + known);
	const inHam = (e.ham + 1) / (c.hamWords + known);
	const times = inSpam / inHam;
	return { word: w, spam: e.spam, ham: e.ham, times, push: Math.log2(times) };
}

export interface Verdict {
	/** Each word's vote, in the order the words appear. */
	votes: Vote[];
	/**
	 * The head start: spam is rarer than ordinary messages, so the score starts that many
	 * doublings on the "not spam" side (negative), or at 0 when rarity is ignored.
	 */
	start: number;
	/** Where the votes leave the score: positive means spam. */
	score: number;
	spam: boolean;
}

/** Lets the words of a message vote. `rarity`: start from how rare spam is (true for a real filter). */
export function judge(c: Counts, text: string, rarity = true): Verdict {
	const votes = words(text).map((w) => vote(c, w));
	const start = rarity ? Math.log2((c.spam + 1) / (c.ham + 1)) : 0;
	const score = start + votes.reduce((s, v) => s + v.push, 0);
	return { votes, start, score, spam: score > 0 };
}

/** The share of messages the filter gets right, each judged by counts that leave it out. */
export function accuracy(messages: Message[], rarity = true): { right: number; of: number } {
	const all = count(messages);
	let right = 0;
	for (const m of messages) {
		// Take the message out of the counts before judging it, so it can't vote for itself.
		const c = add(copy(all), m.text, m.spam, -1);
		if (judge(c, m.text, rarity).spam === m.spam) right++;
	}
	return { right, of: messages.length };
}
