/**
 * The one point of the sweep the reader retrains in the page: the smallest model on all the
 * text, trained by training-a-tiny-language-model's Web Worker (the same `Run`, seeds and
 * schedule as the offline sweep), so its lowest held-out loss lands on the stored point. Scenes
 * call `startLive`/`stopLive` from an `$effect` on the buttons' counts and read `live` in a
 * `$derived`.
 */
import textUrl from '../ngram-text-models/tinyshakespeare.txt?url';
import type { LiveJob, LiveReply } from '../training-a-tiny-language-model/live.svelte';
import type { Point } from '../training-a-tiny-language-model/train';

/** The point retrained live: width 8, all the training text. */
export const LIVE = { width: 8, size: Infinity, context: 32 };

export type LiveStatus = 'idle' | 'loading' | 'running' | 'stopped' | 'done' | 'failed';

interface LiveState {
	status: LiveStatus;
	step: number;
	msPerStep: number;
	points: Point[];
}

export const live: LiveState = $state({ status: 'idle', step: 0, msPerStep: 0, points: [] });

let worker: Worker | null = null;
let text: Promise<string> | null = null;

function stopWorker() {
	worker?.terminate();
	worker = null;
}

/** Starts the run from scratch (a run in progress is thrown away). */
export function startLive() {
	stopWorker();
	live.status = 'loading';
	live.step = 0;
	live.msPerStep = 0;
	live.points = [];
	text ??= fetch(textUrl).then((r) => {
		if (!r.ok) throw new Error(`Tiny Shakespeare: HTTP ${r.status}`);
		return r.text();
	});
	const mine = new Worker(
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		new URL('../training-a-tiny-language-model/train.worker.ts', import.meta.url),
		{ type: 'module' }
	);
	worker = mine;
	mine.onmessage = (e: MessageEvent<LiveReply>) => {
		if (worker !== mine) return;
		const r = e.data;
		live.status = r.done ? 'done' : 'running';
		live.step = r.step;
		live.msPerStep = r.msPerStep;
		if (r.points.length) live.points.push(...r.points);
		if (r.done) stopWorker();
	};
	mine.onerror = () => {
		if (worker !== mine) return;
		live.status = 'failed';
		stopWorker();
	};
	text.then(
		(t) => {
			if (worker === mine)
				mine.postMessage({
					text: t,
					width: LIVE.width,
					context: LIVE.context,
					data: LIVE.size
				} satisfies LiveJob);
		},
		() => {
			text = null;
			if (worker === mine) live.status = 'failed';
			stopWorker();
		}
	);
}

/** Stops the run where it is; what it measured stays on the chart. */
export function stopLive() {
	if (!worker) return;
	stopWorker();
	live.status = 'stopped';
}
