/**
 * Runs the 2-D model's reverse process off the page's main thread (a thousand denoising steps
 * for 400 points take a second or two). Receives a `Job`, posts progress, then every x_t of the
 * run: frame k (0 … steps) holds the points after k steps, frame 0 being the starting noise.
 */
import { decodeWeights, sample } from './ddpm';
import { MOONS, WEIGHTS } from './moons-model';
import type { Job, JobReply } from './sampler.svelte';

const wt = decodeWeights(MOONS, WEIGHTS);

self.onmessage = (e: MessageEvent<Job>) => {
	const job = e.data;
	const n = job.count * 2;
	const frames = new Float32Array((job.steps + 1) * n);
	let k = 0;
	sample(wt, {
		steps: job.steps,
		seed: job.seed,
		label: job.label,
		guidance: job.guidance,
		count: job.count,
		onStart: (x) => frames.set(x, 0),
		onStep: (i, _t, x) => {
			frames.set(x, (i + 1) * n);
			k = i + 1;
			if (k % 50 === 0 && k < job.steps)
				self.postMessage({ key: job.key, done: k } satisfies JobReply);
		}
	});
	self.postMessage({ key: job.key, done: k, frames } satisfies JobReply, {
		transfer: [frames.buffer]
	});
};
