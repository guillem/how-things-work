// Prints the compact args for a staged workflow run: workflow-args.json plus poolDir, the
// category and batch sizes (in place of the 22 KB of rows), and the stage fields given as JSON.
// Usage: node stage-args.mjs '{"stage":"judge","batchList":[1,2,3]}' > <file>, or @<file with the fields>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(here, '../data');
const base = JSON.parse(fs.readFileSync(path.join(DATA, 'workflow-args.json'), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.join(DATA, 'phase-b-args.json'), 'utf8'));
const catCounts = {};
const batchSizes = {};
for (const r of b.rows) {
	catCounts[r[2]] = (catCounts[r[2]] || 0) + 1;
	batchSizes[r[5]] = (batchSizes[r[5]] || 0) + 1;
}
const arg = process.argv[2] || '{}';
// '@file.json' reads the stage fields from a file (rows to verify, gap entries)
const extra = JSON.parse(arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg);
process.stdout.write(
	JSON.stringify({
		...base,
		poolDir: path.join(DATA, 'pool'),
		batches: b.batches,
		catCounts,
		batchSizes,
		...extra
	})
);
