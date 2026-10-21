// Builds src/routes/next-word-guessing-game/books.json: the story text of five Beatrix Potter
// tales and Townsend's "Three hundred Aesop's fables" (1867, in three parts), all public domain,
// from Project Gutenberg's plain-text files. Gutenberg's header and footer, the title pages and
// the [Illustration] marks, headings and footnote marks are removed; nothing else is changed.
// Usage: download https://www.gutenberg.org/cache/epub/<id>/pg<id>.txt for the ids below into a
// directory as <id>.txt, then: node scripts/data/next-word-guessing-game/build.mjs <directory>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: build.mjs <directory with <id>.txt files>');

const read = (id) => fs.readFileSync(path.join(dir, `${id}.txt`), 'utf8').replace(/\r\n/g, '\n');
/** The text from the first `from` (after `after`, if given) up to `to` (exclusive), cleaned. */
function cut(id, from, to, after = '*** START') {
	const all = read(id);
	const body = all.slice(0, all.indexOf('*** END OF'));
	const a = body.indexOf(from, body.indexOf(after));
	if (a < 0) throw new Error(`${id}: start "${from}" not found`);
	const b = to ? body.indexOf(to, a) : body.length;
	if (b < 0) throw new Error(`${id}: end "${to}" not found`);
	return (
		body
			.slice(a, b)
			.split(/\n\s*\n/)
			// Drop headings (a fable's title, a chapter mark): short paragraphs with no full stop.
			.filter((par) => /[.!?]/.test(par) || par.trim().length > 60)
			.join(' ')
			.replace(/\[\d+\]/g, '')
			.replace(/\[Illustration[^\]]*\]/g, ' ')
			.replace(/_/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

const aesop = cut(21, 'The Lion And The Mouse', '\nFOOTNOTES', 'unworthy of the slightest credit');
// Three parts of about the same length, each cut at the start of a sentence.
const at = (frac) => aesop.indexOf('. ', Math.floor(aesop.length * frac)) + 1;
const s1 = at(1 / 3);
const s2 = at(2 / 3);

const books = [
	{ title: 'The Tale of Peter Rabbit', text: cut(14838, 'Once upon a time', 'THE END') },
	{
		title: 'The Tale of Benjamin Bunny',
		text: cut(14407, 'One morning a little rabbit', 'THE END')
	},
	{
		title: 'The Tale of Squirrel Nutkin',
		text: cut(14872, 'This is a Tale about a tail', 'THE END')
	},
	{
		title: 'The Tale of Timmy Tiptoes',
		text: cut(14797, 'Once upon a time there was a little fat', 'THE END')
	},
	{ title: 'Aesop’s Fables, part 1', text: aesop.slice(0, s1).trim() },
	{ title: 'Aesop’s Fables, part 2', text: aesop.slice(s1, s2).trim() },
	{ title: 'Aesop’s Fables, part 3', text: aesop.slice(s2).trim() },
	// Last: the story of the guessing game, which the machine never reads.
	{ title: 'The Tale of Jemima Puddle-Duck', text: cut(14814, 'What a funny sight', null) }
];
const out = 'src/routes/next-word-guessing-game/books.json';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(books, null, '\t') + '\n');
for (const b of books)
	console.log(b.title, b.text.length, '|', b.text.slice(0, 50), '…', b.text.slice(-50));
