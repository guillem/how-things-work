import type { ExplainerSpec } from '#lib/explainer/index.ts';
import { MINE } from './mine';

export const spec: ExplainerSpec = {
	slug: 'spam-filter-word-counts',
	title: 'How a spam filter decides',
	summary:
		'A pile of real text messages, each marked spam or not. Count which words turn up in which pile, then let the words of a new message vote, try to sneak past with “fr33”, and teach the filter with a “report spam” click.',
	chapters: [
		{ id: 'counting', title: 'Counting words' },
		{ id: 'voting', title: 'The words vote' },
		{ id: 'tricks', title: 'Tricks and lessons' }
	],
	steps: [
		// ------------------------------------------------------------------ counting
		{
			id: 'pile',
			chapter: 'counting',
			title: 'A pile of marked messages',
			scene: 'filter',
			hints: { phase: 'pile' },
			duration: 16,
			controls: [
				{
					type: 'action',
					id: 'next',
					label: 'Pile',
					action: 'Show another message',
					help: 'Take the next message off the pile.'
				}
			],
			body: `
<p>Here is a pile of 561 real text messages from the 2000s, collected by researchers for testing spam filters (most of the spam was sent in Britain; many of the ordinary messages are from students in Singapore). Somebody has read every one and marked it: <strong>spam</strong> (an unwanted advert or trick) or an ordinary message from a friend or family.</p>
<p>Look through a few. Only about 1 message in 8 is spam. (We left out the rude ones.)</p>`,
			notes: `<p>The messages come from the SMS Spam Collection, gathered by Tiago Almeida and José María Gómez Hidalgo (UCI Machine Learning Repository, CC BY 4.0): 5,574 messages, 747 of them spam. This page uses 561 of them, picked evenly through the collection after dropping anything rude, so spam is about as rare here as in the whole collection.</p>`
		},
		{
			id: 'word',
			chapter: 'counting',
			title: 'Two counts for every word',
			scene: 'filter',
			hints: { phase: 'word' },
			duration: 18,
			controls: [
				{
					type: 'select',
					id: 'word',
					label: 'Word',
					default: 'free',
					options: [
						{ value: 'free', label: 'free' },
						{ value: 'win', label: 'win' },
						{ value: 'call', label: 'call' },
						{ value: 'tonight', label: 'tonight' },
						{ value: 'home', label: 'home' }
					]
				}
			],
			body: `
<p>Pick a word. The filter keeps two counts for it: how many spam messages contain it, and how many ordinary messages do.</p>
<p>“free” is in 17 spam messages and 5 ordinary ones. That doesn’t make “free” a bad word: friends say it too (“are you free tonight?”). It is just much <em>commoner</em> in spam: there are far fewer spam messages, so 17 of them is about 1 spam message in 4, while 5 is only about 1 ordinary message in 100. “home” is the other way round: in no spam at all, but in 16 ordinary messages.</p>`
		},
		{
			id: 'count',
			chapter: 'counting',
			title: 'Count every word',
			scene: 'filter',
			hints: { phase: 'count' },
			duration: 18,
			controls: [
				{
					type: 'action',
					id: 'count',
					label: 'Filter',
					action: 'Count every word',
					help: 'Let the filter count every word of every message.'
				}
			],
			body: `
<p>Building the filter means just this: count every word of every message, in both piles. Press the button.</p>
<p>That is all it learns. On one side, words like “prize”, “claim” and “won” that turn up mostly in spam; on the other, words like “I”, “my” and “that” that turn up mostly in ordinary messages. Nobody told it what any of them mean.</p>`
		},
		// ------------------------------------------------------------------ voting
		{
			id: 'vote',
			chapter: 'voting',
			title: 'The words vote',
			scene: 'filter',
			hints: { phase: 'vote' },
			duration: 22,
			controls: [
				{
					type: 'select',
					id: 'message',
					label: 'Your message',
					default: 'spammy',
					options: [
						{ value: 'spammy', label: MINE.spammy },
						{ value: 'friend', label: MINE.friend },
						{ value: 'home', label: MINE.home }
					]
				}
			],
			body: `
<p>Now a new message arrives. Each of its words votes. A word that is commoner in spam pulls toward spam, and the more times commoner, the harder it pulls; a word commoner in ordinary messages pulls the other way. A word the filter has never seen doesn’t vote.</p>
<p>Pick a message and watch the tug of war. Where the marker ends up decides: past the middle on the red side, it goes to the spam folder.</p>`,
			notes: `<p>The size of each pull compares how common the word is among all the words of the spam pile with how common it is among all the words of the ordinary pile. Adding up the pulls like this treats every word as if it had nothing to do with the others, which is not true, but works surprisingly well. This kind of filter is called a <em>naive Bayes</em> filter; the page on <a href="../bayes-theorem/">Bayes’ theorem</a> explains the idea behind it.</p>`
		},
		{
			id: 'rare',
			chapter: 'voting',
			title: 'Spam is rare',
			scene: 'filter',
			hints: { phase: 'rare' },
			duration: 18,
			controls: [
				{
					type: 'toggle',
					id: 'rarity',
					label: 'Remember that spam is rare',
					default: true
				}
			],
			body: `
<p>One more thing matters: only about 1 message in 8 is spam. So the marker doesn’t start in the middle. It starts on the “not spam” side, and a message needs strong spam votes to get past the middle.</p>
<p>Take “${MINE.rare}”. “free” pulls hard toward spam, “your” and “phone” a little, and “is” a little the other way. Together they are not quite enough to beat the head start. Switch off “remember that spam is rare” and the marker starts in the middle: now the same pulls are enough, and a friend’s question goes to the spam folder.</p>`
		},
		// ------------------------------------------------------------------ tricks
		{
			id: 'sneak',
			chapter: 'tricks',
			title: 'Sneaking past',
			scene: 'filter',
			hints: { phase: 'sneak' },
			duration: 18,
			controls: [
				{
					type: 'toggle',
					id: 'misspell',
					label: 'Spell it W1N and fr33',
					default: false
				}
			],
			body: `
<p>“${MINE.spammy}” is caught easily: “win” and “free” are strong spam votes. Now play the spammer and switch on the misspelling.</p>
<p>The filter has never seen “W1N” or “fr33”, so they don’t vote at all, and the message slips through to the inbox. A reader still sees “win a free phone”, but the filter only compares words. That is why spam is so often misspelled.</p>`
		},
		{
			id: 'report',
			chapter: 'tricks',
			title: 'Report spam',
			scene: 'filter',
			hints: { phase: 'report' },
			duration: 18,
			controls: [
				{
					type: 'action',
					id: 'report',
					label: 'Inbox',
					action: 'Report spam',
					help: 'Mark the message as spam: it goes on the spam pile and is counted.'
				}
			],
			body: `
<p>The sneaky message is in your inbox. Press “report spam”. The message goes on the spam pile, and its words are counted: now “W1N” and “fr33” have been seen once, in spam.</p>
<p>Next time the same trick arrives, they vote for spam, and it is caught. Every “report spam” (and every “not spam”) click gives the filter more to count. That is how it keeps up with new tricks.</p>`
		},
		{
			id: 'real',
			chapter: 'tricks',
			title: 'Counting, not understanding',
			scene: 'filter',
			hints: { phase: 'real' },
			duration: 16,
			body: `
<p>This filter has no idea what a message means. It counts which words turned up more in past spam than in ordinary messages, and lets them vote. It can be fooled both ways: a misspelled advert gets through, and a friend’s good news, “${MINE.cup}”, lands in the spam folder.</p>
<p>Early email spam filters worked much like this. Today’s filters still learn from “report spam” clicks, but they also check who sent the message, where its links go and how many people got the same message, and many use neural networks trained on huge numbers of examples.</p>
<p>Next: <a href="../bayes-theorem/">Bayes’ theorem</a> is the maths behind the votes.</p>`
		}
	]
};
