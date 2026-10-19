import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const buckets: Control = {
	type: 'range',
	id: 'm',
	label: 'Buckets m',
	min: 5,
	max: 20,
	step: 1,
	default: 12,
	help: 'The bucket is the hash mod m: the remainder after dividing by m.'
};

const chainKeys: Control = {
	type: 'range',
	id: 'chainKeys',
	label: 'Words in the table',
	min: 0,
	max: 128,
	step: 1,
	default: 48,
	format: (v) => `${v} (α = ${(v / 64).toFixed(2)})`,
	help: '64 slots; the load factor α is words per slot, and with chaining it can pass 1.'
};

const probeKeys: Control = {
	type: 'range',
	id: 'probeKeys',
	label: 'Words in the table',
	min: 0,
	max: 63,
	step: 1,
	default: 40,
	format: (v) => `${v} (α = ${(v / 64).toFixed(2)})`,
	help: '64 slots, one word each: α can only approach 1.'
};

const reseed: Control = {
	type: 'action',
	id: 'reseed',
	label: 'Hash seed',
	action: 'Another hash seed',
	help: 'The same words with a differently seeded hash: another sample of the same table.'
};

const growScheme: Control = {
	type: 'select',
	id: 'growScheme',
	label: 'Collisions handled by',
	default: 'linear',
	options: [
		{ value: 'linear', label: 'Linear probing' },
		{ value: 'chaining', label: 'Chaining' }
	]
};

const maxLoad: Control = {
	type: 'range',
	id: 'maxLoad',
	label: 'Double the table past α =',
	min: 0.5,
	max: 0.95,
	step: 0.05,
	default: 0.75,
	format: (v) => v.toFixed(2)
};

const bloomK: Control = {
	type: 'range',
	id: 'bloomK',
	label: 'Hash functions k',
	min: 1,
	max: 5,
	step: 1,
	default: 3
};

const bitsPerKey: Control = {
	type: 'range',
	id: 'bitsPerKey',
	label: 'Bits per word m/n',
	min: 1,
	max: 20,
	step: 1,
	default: 8,
	format: (v) => `${v} (m = ${(v * 1000).toLocaleString('en-US')} bits)`,
	help: '1,000 words in the filter.'
};

const fpK: Control = {
	type: 'range',
	id: 'fpK',
	label: 'Hash functions k',
	min: 1,
	max: 12,
	step: 1,
	default: 3
};

const tinyK: Control = {
	type: 'range',
	id: 'tinyK',
	label: 'Hash functions k',
	min: 1,
	max: 10,
	step: 1,
	default: 6,
	help: 'Every filter has 8 bits per word.'
};

const letters: Control = {
	type: 'range',
	id: 'letters',
	label: 'Letters the hash reads',
	min: 1,
	max: 6,
	step: 1,
	default: 6,
	format: (v) => (v >= 6 ? 'all' : `the first ${v}`),
	help: 'The same MurmurHash3, fed only the start of each word.'
};

/**
 * Scenes: `hash` (a word, its 32-bit hash and its bucket), `table` (a 64-slot table; hint
 * `scheme`: 'chaining' | 'linear'), `grow` (a table that doubles and rehashes as words arrive),
 * `bloom` (a 32-bit Bloom filter, words added and queried), `fp` (1,000 words in a large filter:
 * the false-positive rate against k), `tiny` (the rate in tiny filters), `clash` (a hash that
 * reads only the first letters, in a table and in a filter).
 */
export const spec: ExplainerSpec = {
	slug: 'hash-tables-bloom-filters',
	title: 'Hash tables & Bloom filters',
	summary:
		'A hash turns a word into a slot number, so a lookup goes straight to it: chaining and linear probing measured against Knuth’s expected probes as the table fills, doubling and rehashing, then a Bloom filter that answers “definitely absent” or “maybe present” from a few bits per word, its false-positive rate against the formula in large and tiny filters, and a bad hash that clusters both.',
	chapters: [
		{ id: 'tables', title: 'Hash tables' },
		{ id: 'bloom', title: 'Bloom filters' },
		{ id: 'bad', title: 'A bad hash' }
	],
	steps: [
		// ------------------------------------------------------------------ tables
		{
			id: 'buckets',
			chapter: 'tables',
			title: 'A number from a word',
			scene: 'hash',
			duration: 22,
			controls: [buckets],
			body: `
<p>To find a word among thousands, sorting them and searching by halves takes about log₂ n comparisons. A <dfn data-def="A table of m slots in which each key is stored at, or near, the slot its hash points to.">hash table</dfn> aims for one or two, whatever n is. A <dfn data-def="A function that turns a key of any length into a fixed-size number, the same number every time for the same key.">hash function</dfn> turns the word’s letters into a 32-bit number, and the remainder after dividing it by the number of buckets m picks the bucket. To look a word up, hash it again and go straight to that bucket.</p>
<p>The words here are real, from Shakespeare’s plays, and the hash is <dfn data-def="A fast non-cryptographic hash by Austin Appleby (2011), used in many hash tables and Bloom filters.">MurmurHash3</dfn>. It mixes the bits so thoroughly that changing one letter flips about half of them, so similar words land in unrelated buckets. That is not the cryptographic hash of the cryptography page: Murmur is built to be fast, and anyone can find two words with the same Murmur hash. A hash table needs speed and an even spread, not secrecy. Since there are more words than buckets, some must share: a <dfn data-def="Two different keys whose hashes give the same slot.">collision</dfn>.</p>`,
			notes: `<p>MurmurHash3 x86_32 reads four letters at a time as one 32-bit word, multiplies, rotates and XORs them into the state, then a final “avalanche” of shifts and multiplications spreads every input bit over the output. The page’s version is checked against the function’s published test values. Taking the hash mod m uses all its bits; when m is a power of two the remainder is just the last log₂ m bits, which is why a hash with weak low bits ruins such tables.</p>`
		},
		{
			id: 'chaining',
			chapter: 'tables',
			title: 'Chaining: a list in every slot',
			scene: 'table',
			hints: { scheme: 'chaining' },
			duration: 26,
			controls: [chainKeys, reseed],
			body: `
<p>The simplest way to handle collisions is <dfn data-def="Each slot holds a list (a chain) of all the keys that hash to it.">separate chaining</dfn>: each of the table’s 64 slots holds a list, and a word joins the end of its slot’s list. A lookup hashes the word and compares it with the list’s entries in turn; each comparison is a <dfn data-def="One look at a stored key (chaining) or at a slot (open addressing) during a search.">probe</dfn>. The words being looked up are traced on the table.</p>
<p>With n words in m slots the <dfn data-def="α = n/m: the average number of keys per slot.">load factor</dfn> is α = n/m, the average list length. A word in the table is found after about <strong>1 + α/2</strong> probes, since on average it sits halfway down a list. A word that is not there costs α probes, the whole list. Raise the number of words and watch the measured averages follow the curves. Because the work depends on α and not on n, a table kept at a fixed load answers in a constant time on average however many words it holds.</p>`,
			notes: `<p>With a random hash the number of words in a slot follows a binomial distribution, close to a Poisson distribution with mean α: at α = 1, 37% of the slots stay empty and 37% hold one word. The exact expectations are 1 + (n − 1)/2m for a found word and n/m for a missing one (Knuth, <em>The Art of Computer Programming</em>, vol. 3, §6.4). The longest list grows, too, but only slowly: about ln n / ln ln n for α = 1. Here “constant time” is an average over the words and over the choice of hash, not a promise for every lookup.</p>`
		},
		{
			id: 'probing',
			chapter: 'tables',
			title: 'Linear probing: try the next slot',
			scene: 'table',
			hints: { scheme: 'linear' },
			duration: 28,
			controls: [probeKeys, reseed],
			body: `
<p><dfn data-def="Storing every key in the table's own slots: a key whose slot is taken is placed in another slot by a fixed rule.">Open addressing</dfn> keeps the words in the slots themselves, one per slot. With <dfn data-def="Open addressing that tries slot h, then h + 1, h + 2, … (wrapping round the end) until it finds the key or an empty slot.">linear probing</dfn>, a word whose slot is taken goes into the next free one, wrapping round the end; a lookup walks the same way until it finds the word or reaches an empty slot, which proves the word is absent.</p>
<p>That is fast in practice, as the slots sit next to each other in memory, but the words form runs, and a run grows faster the longer it is, since any word that hashes into it lands at its end: <dfn data-def="The tendency of linear probing to build long runs of occupied slots that keep growing.">primary clustering</dfn>. Knuth worked out the cost in 1963: for a large table, ½(1 + 1/(1 − α)) probes for a word that is there and <strong>½(1 + 1/(1 − α)²)</strong> for one that is not. Half full, that is 1.5 and 2.5; 90% full, 5.5 and 50.5. Push the slider to the right: the misses climb off the chart. One table is one sample and wanders round the expected curve; draw others with another hash seed.</p>`,
			notes: `<p>The thin solid curves are Knuth’s exact expectations for 64 slots (his Theorem 6.4K; a small, nearly full table does a little better than the large-table formulas, dashed). Averaged over many seeds, the measured lines settle on them; in any one table a single unlucky word can take ten probes or more. Python’s dictionaries and many others use open addressing with a scrambled probe sequence to break up the runs; deleting a key needs care (a marker called a tombstone), since emptying its slot would cut the runs that pass through it.</p>`
		},
		{
			id: 'resize',
			chapter: 'tables',
			title: 'Grow and rehash',
			scene: 'grow',
			duration: 30,
			controls: [growScheme, maxLoad],
			body: `
<p>A table that keeps its speed must not fill up. Real tables set a maximum load factor (Java’s <code>HashMap</code> uses 0.75) and, when the next word would pass it, allocate a table twice as large and <dfn data-def="Re-insert every key into the new table: each key's slot is its hash mod the new size, so all of them move.">rehash</dfn> every word into it, since each word’s slot depends on m.</p>
<p>Watch 200 words arrive in a table that starts with 8 slots. The load factor saws up and down, and the mean probes saw with it, always low. A rehash is slow, every word moves, but it happens after each doubling, so the total work of all the moves stays below two moves per word inserted: an <dfn data-def="The cost per operation averaged over a whole sequence of operations, which can be constant even when a few of them are slow.">amortised</dfn> constant. Raise the maximum load to save memory and the probes climb, steeply for linear probing.</p>`,
			notes: `<p>Doubling is what makes the average constant: growing by a fixed number of slots instead would move every key again and again, Θ(n) per insertion. Systems that cannot afford a pause (a database, a game loop) rehash incrementally, moving a few keys on each operation while both tables are live.</p>`
		},
		// ------------------------------------------------------------------ bloom
		{
			id: 'bloom',
			chapter: 'bloom',
			title: 'A Bloom filter: bits, not words',
			scene: 'bloom',
			duration: 30,
			controls: [bloomK],
			body: `
<p>Sometimes the question is only “have I seen this word?”, and storing the words costs too much. Burton Bloom’s answer (1970) is an array of m bits, all 0, and k hash functions. To add a word, set the k bits its hashes point to. To ask about a word, look at its k bits.</p>
<p>If any of them is 0, the word was <strong>definitely never added</strong>: adding it would have set that bit. If all k are 1, the word is <strong>maybe present</strong>: those bits may have been set by other words. That is a <dfn data-def="A wrong “maybe present” for a key that was never added.">false positive</dfn>, and a Bloom filter has them but never a false negative. It can only ever be sure of absence. Here four words go into 32 bits, and other words are queried; one of them was never added yet finds all its bits set.</p>`,
			notes: `<p>The k hashes here are MurmurHash3 with k different seeds. Plain Bloom filters cannot delete a word, since clearing its bits could erase other words’ too; counting filters keep a small counter per bit instead. Browsers have used Bloom filters to check URLs against a list of malicious sites before asking a server, and databases such as Cassandra and LevelDB keep one per file on disk, to skip files that cannot hold a key.</p>`
		},
		{
			id: 'false-positives',
			chapter: 'bloom',
			title: 'A false-positive rate you can tune',
			scene: 'fp',
			duration: 30,
			controls: [bitsPerKey, fpK],
			body: `
<p>Put n = 1,000 words in a filter of m bits and query 2,000 others that were never added. After kn bits have been set at random, a given bit is still 0 with probability about e<sup>−kn/m</sup>, and a missing word is a false positive when all its k bits are 1:</p>
<p class="formula"><strong>false positives ≈ (1 − e<sup>−kn/m</sup>)<sup>k</sup></strong></p>
<p>More hash functions check more bits but also fill the array faster; the rate is lowest at <strong>k = (m/n) ln 2</strong>, when about half the bits are set. Move k and the bits per word and watch the measured rate (dots) follow the curve. At 9.6 bits per word and k = 7, one query in a hundred is a false positive, whatever the words are: the words themselves average 6.4 letters, 59 bits even packed into bytes with a separator, before the table’s own overhead.</p>`,
			notes: `<p>At the optimum k the rate is (½)<sup>k</sup> ≈ 0.6185<sup>m/n</sup>, so each extra 4.8 bits per word divides it by ten. The derivation treats the bits as independent, which they are not quite: see the next step. A filter is also only as good as its size estimate: put in more words than it was built for and the rate climbs fast, so it is sized for the largest n expected.</p>`
		},
		{
			id: 'tiny',
			chapter: 'bloom',
			title: 'Tiny filters do worse than the formula',
			scene: 'tiny',
			duration: 26,
			controls: [tinyK],
			body: `
<p>The formula is an approximation, and Bose and colleagues showed in 2008 that it always errs low. Keep 8 bits per word but make the filter small, 16 bits for two words, and build 400 of them with different seeds: the measured rate comes out well above the formula. For filters of thousands of bits the gap closes.</p>
<p>Two things push the real rate up. The number of bits set varies from filter to filter, and the rate grows as the k-th power of the share of bits set, so the unlucky, fuller filters add more than the lucky ones take away. And in a small array, more of a word’s k bits fall on bits that are already set. The exact rate, from the distribution of the number of bits set (the line), matches the measurements.</p>`,
			notes: `<p>The exact value assumes that each of the kn bit positions is independent and uniform, as with k independent seeds: Σ<sub>j</sub> P(j bits set) (j/m)<sup>k</sup>, the probabilities computed exactly by adding one bit position at a time (Bose et al. 2008; Christensen, Roginsky and Jimeno 2010). Implementations that derive the k positions from two hashes (h₁ + i·h₂, Kirsch and Mitzenmacher 2006) behave the same in large filters but can do slightly worse in small ones.</p>`
		},
		// ------------------------------------------------------------------ bad hash
		{
			id: 'bad-hash',
			chapter: 'bad',
			title: 'A bad hash clusters both',
			scene: 'clash',
			duration: 28,
			controls: [letters],
			body: `
<p>Everything so far assumed a hash that spreads the words evenly. Make it read only the first few letters of each word, and words that start alike collide. (Java’s first <code>String.hashCode</code> made a similar economy, reading at most 16 evenly spaced characters of a long string, until Java 1.2 in 1998.) On the left 1,024 words go into a table of 1,024 slots with chaining; on the right 1,000 words into a Bloom filter of 8,000 bits with 6 hashes.</p>
<p>At three letters the table’s chains grow long and the filter’s false positives jump; at one letter, every word starting with “s” shares one chain, and the filter says “maybe” to almost everything. The filter even sets <em>fewer</em> bits, since words with the same start set the same ones, yet a missing word that shares the start of any added word now finds all its bits set. A hash table’s constant time is an average under a good hash, not a guarantee.</p>`,
			notes: `<p>Bad luck is not the only risk. An attacker who knows the hash can choose keys that all collide and turn every lookup into a walk down one list: in 2011 Klink and Wälde showed that a single web request with crafted form fields could keep a server’s processor busy for a long time this way. The fix is a hash with a secret, random seed chosen when the program starts, such as SipHash (Aumasson and Bernstein, 2012), now the default in Python, Rust and others. The Java story is from Bloch’s <em>Effective Java</em>: the old function sampled at most 16 characters, evenly spaced, so long strings such as URLs that differed only between those characters collided.</p>`
		}
	]
};
