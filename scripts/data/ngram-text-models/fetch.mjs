// Downloads Tiny Shakespeare (Karpathy's char-rnn, data/tinyshakespeare/input.txt; the repository
// is MIT, Shakespeare's text is public domain) into the ngram-text-models route, where the page
// fetches it lazily as a static asset and the model tests read it from disk.
// Usage: node scripts/data/ngram-text-models/fetch.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const URL =
	'https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt';
const SHA256 = '86c4e6aa9db7c042ec79f339dcb96d42b0075e16b8fc2e86bf0ca57e2dc565ed';
const OUT = new globalThis.URL(
	'../../../src/routes/ngram-text-models/tinyshakespeare.txt',
	import.meta.url
);

const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const bytes = new Uint8Array(await res.arrayBuffer());
const sum = createHash('sha256').update(bytes).digest('hex');
if (sum !== SHA256) throw new Error(`unexpected SHA-256 ${sum}`);
writeFileSync(OUT, bytes);
console.log(`wrote ${bytes.length} bytes to ${OUT.pathname}`);
