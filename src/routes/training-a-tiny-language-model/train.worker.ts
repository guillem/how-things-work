/**
 * Trains the page's default run off the main thread: the same `Run` as the offline script, from
 * the same seeds, so its losses and samples retrace the stored run. Posts a `LiveReply` every few
 * steps; the page stops it by terminating the worker.
 */
import { Alphabet, split } from '../ngram-text-models/ngram.ts';
import { Run } from './train.ts';
import type { LiveJob, LiveReply } from './live.svelte.ts';

self.onmessage = (e: MessageEvent<LiveJob>) => {
	const { text, width, context, data } = e.data;
	const chars = new Alphabet(text).chars;
	const index = new Map(chars.map((c, i) => [c, i]));
	const enc = (s: string) => Int32Array.from(Array.from(s), (c) => index.get(c) ?? 0);
	const { train, heldOut } = split(text);
	const run = new Run(chars, enc(train), enc(heldOut), width, context, data);
	const m0 = run.measureMs; // the step-0 measurement, before any training
	let sentPoints = 0;
	let sentSamples = 0;
	let busy = 0; // milliseconds spent in `advance`, measurements included
	const post = (loss: number | null) => {
		const reply: LiveReply = {
			step: run.step,
			loss,
			msPerStep: run.step > 0 ? (busy - (run.measureMs - m0)) / run.step : 0,
			points: run.progress.points.slice(sentPoints),
			samples: run.progress.samples.slice(sentSamples),
			done: run.done
		};
		sentPoints = run.progress.points.length;
		sentSamples = run.progress.samples.length;
		self.postMessage(reply);
	};
	post(null);
	while (!run.done) {
		const t0 = performance.now();
		const loss = run.advance();
		busy += performance.now() - t0;
		if (run.step % 5 === 0 || run.done) post(loss);
	}
};
