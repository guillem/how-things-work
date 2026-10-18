/**
 * The run the reader trains in the page: the default configuration, trained by `Run` in a Web
 * Worker (./train.worker.ts) from the same seeds as the stored run. Its progress is kept here,
 * reactively; scenes call `startLive`/`stopLive` from an `$effect` on the Train button's count and
 * read `live` in a `$derived`.
 */
import textUrl from '../ngram-text-models/tinyshakespeare.txt?url';
import type { Point } from './train';
import { DEFAULT } from './train';

export interface LiveJob {
	text: string;
	width: number;
	context: number;
	data: number;
}
export interface LiveReply {
	step: number;
	/** Loss of the last batch trained on (null before the first step). */
	loss: number | null;
	/** Milliseconds per gradient step so far, measurements left out. */
	msPerStep: number;
	/** Measurements and samples new since the last reply. */
	points: Point[];
	samples: { step: number; text: string }[];
	done: boolean;
}

export type LiveStatus = 'idle' | 'loading' | 'running' | 'stopped' | 'done' | 'failed';

interface LiveState {
	status: LiveStatus;
	step: number;
	msPerStep: number;
	/** Batch losses, every fifth step: [step, loss]. */
	losses: [number, number][];
	points: Point[];
	samples: { step: number; text: string }[];
}

export const live: LiveState = $state({
	status: 'idle',
	step: 0,
	msPerStep: 0,
	losses: [],
	points: [],
	samples: []
});

let worker: Worker | null = null;
let text: Promise<string> | null = null;

function stopWorker() {
	worker?.terminate();
	worker = null;
}

/** Starts training from scratch (a run in progress is thrown away). */
export function startLive() {
	stopWorker();
	live.status = 'loading';
	live.step = 0;
	live.msPerStep = 0;
	live.losses = [];
	live.points = [];
	live.samples = [];
	text ??= fetch(textUrl).then((r) => {
		if (!r.ok) throw new Error(`Tiny Shakespeare: HTTP ${r.status}`);
		return r.text();
	});
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const mine = new Worker(new URL('./train.worker.ts', import.meta.url), { type: 'module' });
	worker = mine;
	mine.onmessage = (e: MessageEvent<LiveReply>) => {
		if (worker !== mine) return;
		const r = e.data;
		live.status = r.done ? 'done' : 'running';
		live.step = r.step;
		live.msPerStep = r.msPerStep;
		if (r.loss !== null) live.losses.push([r.step, r.loss]);
		live.points.push(...r.points);
		live.samples.push(...r.samples);
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
					width: DEFAULT.width,
					context: DEFAULT.context,
					data: DEFAULT.data
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
