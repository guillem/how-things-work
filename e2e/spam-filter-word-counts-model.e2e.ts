// The word-counting spam filter, checked against the messages themselves (plain searches)
// and on messages it has not counted. Runs in Node.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MINE } from '../src/routes/spam-filter-word-counts/mine';
import {
	accuracy,
	add,
	copy,
	count,
	judge,
	vote,
	words,
	type Message
} from '../src/routes/spam-filter-word-counts/model';

const raw = JSON.parse(
	readFileSync(
		new URL('../src/routes/spam-filter-word-counts/messages.json', import.meta.url),
		'utf8'
	)
) as [number, number, string][];
const messages: Message[] = raw.map(([id, s, text]) => ({ id, spam: s === 1, text }));
const counts = count(messages);

test('the pile: 561 hand-checked messages, about 1 in 8 of them spam, as in the full collection', () => {
	expect(messages.length).toBe(561);
	expect(counts.spam).toBe(74);
	expect(counts.ham).toBe(487);
	// The full SMS Spam Collection: 747 spam of 5,574 messages (13.4%).
	expect(counts.spam / messages.length).toBeCloseTo(747 / 5574, 2);
	// The first message of the collection, and a well-known spam.
	expect(messages[0].text).toMatch(/^Go until jurong point/);
	expect(messages.some((m) => m.spam && m.text.startsWith('Free entry in 2 a wkly comp'))).toBe(
		true
	);
});

test('a word’s two counts are the numbers of spam and ordinary messages that contain it', () => {
	const has = (m: Message, w: string) =>
		new RegExp(`(^|[^a-z0-9£'])${w}($|[^a-z0-9£])`, 'i').test(m.text);
	for (const w of ['free', 'win', 'home', 'call', 'tonight']) {
		const v = vote(counts, w);
		expect(v.spam).toBe(messages.filter((m) => m.spam && has(m, w)).length);
		expect(v.ham).toBe(messages.filter((m) => !m.spam && has(m, w)).length);
	}
	// The page quotes these.
	expect([vote(counts, 'free').spam, vote(counts, 'free').ham]).toEqual([17, 5]);
	expect([vote(counts, 'home').spam, vote(counts, 'home').ham]).toEqual([0, 16]);
});

test('spammy words vote for spam, everyday words against, unknown words not at all', () => {
	for (const w of ['prize', 'claim', 'mobile', 'win', 'free'])
		expect(vote(counts, w).times).toBeGreaterThan(2);
	for (const w of ['i', 'my', 'later', 'home']) expect(vote(counts, w).times).toBeLessThan(0.5);
	expect(vote(counts, 'fr33')).toMatchObject({ spam: 0, ham: 0, push: 0 });
	expect(words('W1N a fr33 phone!')).toEqual(['w1n', 'a', 'fr33', 'phone']);
});

test('it sorts messages it has not counted: about 98% right, each judged with itself left out', () => {
	const { right, of } = accuracy(messages);
	expect(right / of).toBeGreaterThan(0.97);
});

test('the page’s messages: caught, sneaking past, and caught again after one report', () => {
	expect(judge(counts, MINE.spammy).spam).toBe(true);
	expect(judge(counts, MINE.friend).spam).toBe(false);
	expect(judge(counts, MINE.home).spam).toBe(false);
	expect(judge(counts, MINE.sneaky).spam).toBe(false);
	const taught = add(copy(counts), MINE.sneaky, true);
	expect(judge(taught, MINE.sneaky).spam).toBe(true);
	// Teaching a copy leaves the original counts alone.
	expect(counts.spam).toBe(74);
});

test('forgetting that spam is rare sends a friend’s question to the spam folder', () => {
	expect(judge(counts, MINE.rare).spam).toBe(false);
	expect(judge(counts, MINE.rare, false).spam).toBe(true);
	// The head start: spam is rarer, so the score starts on the "not spam" side.
	expect(judge(counts, MINE.rare).start).toBeLessThan(0);
});
