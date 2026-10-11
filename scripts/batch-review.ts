// Reviews and fact-checks finished topics through the Message Batches API (half
// the price of normal requests; most batches finish within an hour, at most 24 h).
// One request per topic: the topic's code (narrative, model, scenes, model tests)
// plus the whole catalogue, with web search for sources. The catalogue and the
// instructions are a shared, cached prefix. Each review lands in
// docs/reviews/<slug>.md, for a session to apply ("apply docs/reviews/<slug>.md").
//
//   node scripts/batch-review.ts submit <slug>...   start a batch (saves its id)
//   node scripts/batch-review.ts status             list pending batches
//   node scripts/batch-review.ts fetch [--wait]     write the reviews of ended batches
//   node scripts/batch-review.ts submit --dry-run <slug>...   write the requests, send nothing
//
// Options for submit: --model <id> (default claude-opus-5-5), --effort <level>
// (default high). Needs ANTHROPIC_API_KEY (or an `ant auth login` profile).
// `make review TOPICS="a b"` and `make review-fetch` wrap the first and third.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
type Request = Anthropic.Messages.Batches.BatchCreateParams.Request;

const REVIEWS = 'docs/reviews';
const PENDING = path.join(REVIEWS, 'batches');

/** Batch prices in $ per million tokens (half the standard price). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
	'claude-opus-5-5': { input: 2, output: 10, cacheRead: 0.1 },
	'claude-sonnet-5-5': { input: 1, output: 5, cacheRead: 0.1 }
};

const INSTRUCTIONS = `You review and fact-check one explainer of "How Things Work", a site of interactive, animated explanations (SvelteKit, every graphic drawn from a real model). Below is the catalogue that defines every topic: read its preamble (it applies to every page, including the definition of done) and the entry of the topic you are given.

You will receive the topic's source: steps.ts (the narrative: chapters, steps with HTML bodies, "Go deeper" notes and the controls), the model (plain TypeScript), the scenes (Svelte components drawing SVG; their text labels and readouts are what the reader sees) and the model's tests. Lines are numbered.

Check, in this order of importance:
1. Facts. Every claim, number, date, name and formula in the narrative, notes, labels and readouts. Use web search to verify anything you are not certain of, and prefer primary or authoritative sources (textbooks, standards bodies, peer-reviewed papers, official datasets). Quote the source URL for every correction.
2. Model against reality. Does the model implement the real equations or algorithm, with correct constants and units? Would it respond correctly to inputs nobody anticipated? Are the tests checking real-world properties?
3. Narrative against model and scenes. Does the text describe what the graphic actually shows and what the model computes (numbers the text quotes, behaviour it promises when a control moves)?
4. The catalogue entry. Is the Interaction built as written, is the Takeaway visible in the graphic, is the Pitfall avoided, are the Needs met with real data?
5. Clarity for the entry's level: jargon used before it is explained, steps that skip a needed idea, ambiguous wording.

Report only real problems; do not pad. Do not restyle prose that is correct and clear. If you are unsure whether something is wrong, say how confident you are. If everything checks out in a section, say so in one line.

Write the report in Markdown, exactly with these sections:

# Review: <slug>
## Verdict
One paragraph: ready as is, ready after the fixes below, or needs rework; and the most important fix.
## Factual errors
## Model issues
## Narrative and scene mismatches
## Catalogue requirements
## Clarity
## Sources consulted

Under each section, one bullet per issue: **severity** (high: wrong or misleading; medium: imprecise or incomplete; low: polish), the location (file:line), what is wrong, the exact fix (replacement text or code), and the source URL where relevant.`;

function topicFiles(slug: string) {
	const dir = path.join('src/routes', slug);
	if (!fs.existsSync(path.join(dir, 'steps.ts'))) throw new Error(`No explainer at ${dir}`);
	const files: string[] = [];
	const walk = (d: string) => {
		for (const name of fs.readdirSync(d).sort()) {
			const p = path.join(d, name);
			if (fs.statSync(p).isDirectory()) walk(p);
			else if (/\.(ts|svelte)$/.test(name) && name !== '+page.svelte' && name !== '+page.ts')
				files.push(p);
		}
	};
	walk(dir);
	// The model tests that import this topic's code.
	for (const name of fs.readdirSync('e2e').sort()) {
		const p = path.join('e2e', name);
		if (name.endsWith('-model.e2e.ts') && fs.readFileSync(p, 'utf8').includes(`/routes/${slug}/`))
			files.push(p);
	}
	return files;
}

function numbered(file: string) {
	const lines = fs.readFileSync(file, 'utf8').split('\n');
	return lines.map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n');
}

function buildRequest(slug: string, model: string, effort: Effort): Request {
	const catalogue = fs.readFileSync('docs/TOPICS.md', 'utf8');
	const source = topicFiles(slug)
		.map((f) => `<file path="${f}">\n${numbered(f)}\n</file>`)
		.join('\n\n');
	return {
		custom_id: slug,
		params: {
			model,
			max_tokens: 32000,
			output_config: { effort },
			// Identical for every topic, so it is written to the cache once and read
			// at a tenth of the price by the other requests in the batch.
			system: [
				{ type: 'text', text: INSTRUCTIONS },
				{
					type: 'text',
					text: `<catalogue>\n${catalogue}\n</catalogue>`,
					cache_control: { type: 'ephemeral', ttl: '1h' }
				}
			],
			tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 15 }],
			messages: [
				{
					role: 'user',
					content: `Review the topic "${slug}" (its catalogue entry is under "#### ${slug}").\n\n${source}`
				}
			]
		}
	};
}

function arg(args: string[], name: string) {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	args.splice(i, 2);
	return value;
}

function pendingBatches(): { id: string; slugs: string[]; model: string; submitted: string }[] {
	if (!fs.existsSync(PENDING)) return [];
	return fs
		.readdirSync(PENDING)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(fs.readFileSync(path.join(PENDING, f), 'utf8')));
}

async function submit(args: string[]) {
	const dryRun = args.includes('--dry-run');
	args = args.filter((a) => a !== '--dry-run');
	const model = arg(args, '--model') ?? 'claude-opus-5-5';
	const effort = (arg(args, '--effort') ?? 'high') as Effort;
	if (args.length === 0) throw new Error('Name the topics to review: submit <slug>...');
	const requests = args.map((slug) => buildRequest(slug, model, effort));
	if (dryRun) {
		const out = path.join(REVIEWS, 'dry-run.json');
		fs.mkdirSync(REVIEWS, { recursive: true });
		fs.writeFileSync(out, JSON.stringify({ requests }, null, '\t'));
		for (const r of requests) {
			const chars = JSON.stringify(r.params).length;
			console.log(`${r.custom_id}: ~${Math.round(chars / 4 / 1000)}k tokens of input`);
		}
		console.log(`Wrote ${out} (not sent).`);
		return;
	}
	const client = new Anthropic();
	const batch = await client.messages.batches.create({ requests });
	fs.mkdirSync(PENDING, { recursive: true });
	fs.writeFileSync(
		path.join(PENDING, `${batch.id}.json`),
		JSON.stringify(
			{ id: batch.id, slugs: args, model, submitted: new Date().toISOString() },
			null,
			'\t'
		) + '\n'
	);
	console.log(`Submitted ${batch.id} (${args.join(', ')}). Fetch later: make review-fetch`);
}

async function status() {
	const pending = pendingBatches();
	if (pending.length === 0) return console.log('No pending review batches.');
	const client = new Anthropic();
	for (const p of pending) {
		const b = await client.messages.batches.retrieve(p.id);
		const c = b.request_counts;
		console.log(
			`${p.id} ${p.slugs.join(', ')}: ${b.processing_status} (processing ${c.processing}, succeeded ${c.succeeded}, errored ${c.errored}, expired ${c.expired})`
		);
	}
}

function costOf(model: string, usage: Anthropic.Messages.Usage) {
	const price = PRICES[model];
	if (!price) return 'cost: unknown model';
	const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * 1.25 * price.input;
	const dollars =
		(usage.input_tokens * price.input +
			cacheWrite +
			(usage.cache_read_input_tokens ?? 0) * price.cacheRead +
			usage.output_tokens * price.output) /
		1e6;
	const searches = usage.server_tool_use?.web_search_requests ?? 0;
	return `~$${dollars.toFixed(2)} in tokens + ${searches} web searches`;
}

function reportText(message: Anthropic.Messages.Message) {
	return message.content
		.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
		.map((b) => b.text)
		.join('');
}

async function fetchResults(args: string[]) {
	const wait = args.includes('--wait');
	if (pendingBatches().length === 0) return console.log('No pending review batches.');
	const client = new Anthropic();
	for (;;) {
		let open = 0;
		for (const p of pendingBatches()) {
			const b = await client.messages.batches.retrieve(p.id);
			if (b.processing_status !== 'ended') {
				open++;
				console.log(`${p.id} (${p.slugs.join(', ')}): ${b.processing_status}`);
				continue;
			}
			for await (const r of await client.messages.batches.results(p.id)) {
				const file = path.join(REVIEWS, `${r.custom_id}.md`);
				const header = `<!-- batch ${p.id}, ${p.model}, submitted ${p.submitted} -->\n`;
				if (r.result.type === 'succeeded') {
					const m = r.result.message;
					let note = '';
					if (m.stop_reason === 'refusal')
						note = `\n> Declined (${m.stop_details?.category ?? 'no category'}); resubmit or review by hand.\n`;
					else if (m.stop_reason === 'pause_turn' || m.stop_reason === 'max_tokens')
						note = `\n> Incomplete (${m.stop_reason}); resubmit this topic.\n`;
					fs.writeFileSync(file, header + note + reportText(m) + '\n');
					console.log(
						`${r.custom_id}: ${file} (${costOf(p.model, m.usage)})${note ? ' INCOMPLETE' : ''}`
					);
				} else {
					console.log(`${r.custom_id}: ${r.result.type}; resubmit it.`);
				}
			}
			fs.rmSync(path.join(PENDING, `${p.id}.json`));
		}
		if (!wait || open === 0) {
			if (open) console.log(`${open} batch(es) still running; fetch again later.`);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 60_000));
	}
}

const [command, ...rest] = process.argv.slice(2);
const commands: Record<string, (args: string[]) => Promise<void>> = {
	submit,
	status: () => status(),
	fetch: fetchResults
};
const run = commands[command ?? ''];
if (!run) {
	console.error('Usage: node scripts/batch-review.ts submit|status|fetch [...] (see the header)');
	process.exit(1);
}
await run(rest);
