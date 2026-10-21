// Builds src/routes/spam-filter-word-counts/messages.json: a subset of the SMS Spam Collection
// v.1 (T. A. Almeida, J. M. Gómez Hidalgo, 2011; UCI Machine Learning Repository,
// doi:10.24432/C5CC84, CC BY 4.0) for a children's page: messages with adult, crude, dating or
// drinking words are dropped (the word list below), then every k-th of the rest is kept so that
// spam stays about as rare as in the full collection (13%). The kept messages were then read by
// hand, and the ids in DROP removed.
// Usage: download https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip, unzip
// it, then: node scripts/data/spam-filter-word-counts/build.mjs <path to SMSSpamCollection>
import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: build.mjs <SMSSpamCollection>');
const rows = fs
	.readFileSync(file, 'utf8')
	.split('\n')
	.filter((l) => l.trim())
	.map((l, i) => {
		const tab = l.indexOf('\t');
		return { id: i + 1, spam: l.slice(0, tab) === 'spam', text: l.slice(tab + 1).trim() };
	});

const CRUDE =
	/\b(sex\w*|xxx|adult|babe\w*|naked|nude|horny|dat(e|ing)|flirt\w*|kiss\w*|hot|porn\w*|f+u+c*k\w*|shit\w*|bitch\w*|ass|arse|dick\w*|cock\w*|damn|hell|wet|bed|lick\w*|gay|lesbian|slut\w*|dirty|naught\w*|puss\w*|tits?|boob\w*|pics?|18|over18'?s?|drunk|weed|smok\w*|stoned|beer|wine|vodka|booze|pub|sexy|girls?|lady|ladies|singles?|meet|chat\w*|love\w*|luv|darling|sweetheart|honey|lov|dead|die|kill\w*|gun|bloody|crap|piss\w*|wank\w*|bra|panties|bitch|hoe|hooker|strip\w*|virgin\w*|condom\w*|pregnant|period|xy|xx+|mobile\s+chat|text\s+chat|operator\s+chat)\b/i;

const clean = rows.filter((r) => !CRUDE.test(r.text) && r.text.length <= 220);
/** Read by hand and dropped (unsuitable, or meaningless out of context). */
const DROP = new Set([
	// spam: adult, contact from strangers, or cut off
	1941, 2768, 4105, 4273, 4986, 5042, 2431, 2559, 5123,
	// ordinary messages: drugs, drink, violence jokes, innuendo
	654, 891, 2830, 1405, 1976, 2069, 2675, 3036, 3079, 3199, 3614, 4258, 4449, 4584, 4640, 4978,
	2446, 1600, 2968, 2841
]);
const kept = (spam, every) =>
	clean.filter((r) => r.spam === spam).filter((_, i) => i % every === 0 && !DROP.has(_.id));
const spam = kept(true, 7);
const ham = kept(false, 8);
const out = [...spam, ...ham].sort((a, b) => a.id - b.id);
fs.writeFileSync(
	'src/routes/spam-filter-word-counts/messages.json',
	JSON.stringify(out.map((r) => [r.id, r.spam ? 1 : 0, r.text])) + '\n'
);
console.log(
	`all ${rows.length} (spam ${rows.filter((r) => r.spam).length}); clean ${clean.length}; kept ${out.length}: spam ${spam.length}, ham ${ham.length}`
);
