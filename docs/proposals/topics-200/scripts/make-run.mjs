// Writes a runnable copy of a phase script with its args inlined (the Workflow tool's args
// would otherwise have to be pasted by hand), so a stage is launched with scriptPath alone.
// Usage: node make-run.mjs <workflows/phase-x.js> '<stage fields as JSON>' <output .js>
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const [script, extra, out] = process.argv.slice(2);
const args = execFileSync('node', [path.join(here, 'stage-args.mjs'), extra || '{}'], {
	encoding: 'utf8',
	maxBuffer: 1 << 26
});
const src = fs.readFileSync(script, 'utf8');
if (!src.includes('\nconst A = args\n')) throw new Error('no "const A = args" line in ' + script);
fs.writeFileSync(out, src.replace('\nconst A = args\n', `\nconst A = ${args}\n`));
console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
