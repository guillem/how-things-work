/**
 * Samples, with the page's own sampler (`sample` in src/routes/diffusion-models/ddpm.ts), the
 * MNIST denoising sequences the diffusion-models page shows, and writes
 * src/routes/diffusion-models/mnist-sequences.ts. Run by train.mjs after training, or alone:
 *
 *   node scripts/data/diffusion-models/train.mjs sequences <cache dir>
 *
 * It needs the trained EMA weights in <cache dir>/mnist-ema.f32 (written by `train.mjs mnist`).
 *
 * What is stored (all images 28 × 28, 4 bits per pixel, two pixels per byte, high nibble
 * first; value v ↦ pixel (v / 15) · 2 − 1, so 0 = black paper, 15 = white ink; x_t is clipped to
 * [−1, 1] before quantising):
 * - SEQUENCES: denoising runs. Each keeps up to 8 frames (the steps nearest t = 700, 500, 400,
 *   300, 200, 100, 50, 0): the noisy image x_t, and for the main runs (guidance 3, 1000 steps)
 *   the network's prediction x̂₀ of the clean image at that step ('' otherwise). Runs: every digit × seeds
 *   1–3 with guidance 3 and 1000 steps; guidance 0, 1, 3, 7 for the digits 4 and 7 (seed 1);
 *   1, 5, 20, 100 and 1000 steps for the digit 2 (seed 1, guidance 3).
 * - DIGITS: three real MNIST test digits (the first 2, 7 and 5 of the test set) for the noising.
 * - CHECK: how often the digit-reading network of the convolution-vision explainer (its shipped
 *   weights and forward pass) reads a generated digit as the digit asked for, over 200 samples
 *   (20 per digit, seeds 1000 + k) for each guidance scale, at 100 steps.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
	T,
	paramCount,
	sample,
	schedule,
	unflatten
} from '../../../src/routes/diffusion-models/ddpm.ts';
import {
	decodeWeights,
	forward as cnnForward
} from '../../../src/routes/convolution-vision/cnn.ts';
import { WEIGHTS as CNN_WEIGHTS } from '../../../src/routes/convolution-vision/mnist-cnn.ts';
import { loadMnist } from './mnist.mjs';

const MNIST = { D: 784, H: 512, E: 32, blocks: 3, classes: 10 };
const OUT = path.resolve(
	import.meta.dirname,
	'../../../src/routes/diffusion-models/mnist-sequences.ts'
);
const FRAME_TS = [1000, 700, 500, 400, 300, 200, 100, 50, 0];

const pack = (img) => {
	const out = new Uint8Array(img.length / 2);
	for (let i = 0; i < img.length; i += 2) {
		const q = (v) => Math.round(((Math.max(-1, Math.min(1, v)) + 1) / 2) * 15);
		out[i / 2] = (q(img[i]) << 4) | q(img[i + 1]);
	}
	return Buffer.from(out).toString('base64');
};

export async function sequences(cache) {
	const buf = fs.readFileSync(path.join(cache, 'mnist-ema.f32'));
	if (buf.length !== paramCount(MNIST) * 4) throw new Error('weights of the wrong size');
	const wt = unflatten(
		MNIST,
		new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length))
	);
	const info = JSON.parse(fs.readFileSync(path.join(cache, 'mnist-info.json'), 'utf8'));
	const cnn = decodeWeights(CNN_WEIGHTS);
	const reads = (img) =>
		cnnForward(
			cnn,
			Float32Array.from(img, (v) => (v + 1) / 2)
		).digit;

	const runs = [];
	for (let d = 0; d < 10; d++)
		for (const seed of [1, 2, 3]) runs.push({ digit: d, seed, guidance: 3, steps: T });
	for (const d of [4, 7])
		for (const g of [0, 1, 7]) runs.push({ digit: d, seed: 1, guidance: g, steps: T });
	for (const s of [1, 5, 20, 100]) runs.push({ digit: 2, seed: 1, guidance: 3, steps: s });

	const started = Date.now();
	const SEQUENCES = runs.map((r) => {
		// the guess x̂₀ is shown for the main runs only (guidance 3, 1000 steps)
		const main = r.guidance === 3 && r.steps === T;
		const ts = schedule(r.steps);
		// which steps to keep: all of them for short runs, else those nearest FRAME_TS
		const keep = new Set();
		if (ts.length < FRAME_TS.length) ts.forEach((_, k) => keep.add(k));
		else {
			const after = ts.map((_, k) => ts[k + 1] ?? 0);
			for (const ft of FRAME_TS.slice(1)) {
				let best = 0;
				after.forEach((t, k) => {
					if (Math.abs(t - ft) < Math.abs(after[best] - ft)) best = k;
				});
				keep.add(best);
			}
		}
		const frames = [];
		let first = null;
		sample(wt, {
			steps: r.steps,
			seed: r.seed,
			label: r.digit,
			guidance: r.guidance,
			clip: true,
			count: 1,
			onStart: (x) => (first = pack(x)),
			onStep: (k, t, x, x0) => {
				if (keep.has(k)) frames.push({ k: k + 1, t, x: pack(x), x0: main ? pack(x0) : '' });
			}
		});
		const last = frames[frames.length - 1];
		return { ...r, start: first, frames, reads: last ? readsPacked(last.x, reads) : -1 };
	});
	console.log(`sampled ${runs.length} sequences in ${Math.round((Date.now() - started) / 1000)} s`);

	// how often the convolution-vision network reads the digit asked for, by guidance scale
	const CHECK = [];
	for (const g of [0, 1, 3, 7]) {
		let right = 0;
		for (let d = 0; d < 10; d++) {
			const xs = sample(wt, {
				steps: 100,
				seed: 1000 + d,
				label: d,
				guidance: g,
				clip: true,
				count: 20
			});
			for (let k = 0; k < 20; k++) if (reads(xs.subarray(k * 784, (k + 1) * 784)) === d) right++;
		}
		CHECK.push({ guidance: g, right, of: 200 });
		console.log(`guidance ${g}: ${right} of 200 read as the digit asked for`);
	}

	const test = await loadMnist(cache, 'test');
	const DIGITS = [2, 7, 5].map((d) => {
		let i = 0;
		while (test.labels[i] !== d) i++;
		return {
			index: i,
			label: d,
			pixels: Buffer.from(test.pixels.subarray(i * 784, (i + 1) * 784)).toString('base64')
		};
	});

	const out = `/**
 * GENERATED by scripts/data/diffusion-models/sequences.mjs — do not edit by hand.
 *
 * Denoising sequences of a small DDPM (./ddpm.ts, ${paramCount(MNIST).toLocaleString('en-US')} parameters) trained by
 * scripts/data/diffusion-models/train.mjs on the 60,000 training digits of MNIST (Yann LeCun,
 * Corinna Cortes and Christopher J. C. Burges, http://yann.lecun.com/exdb/mnist/; LeCun et al.,
 * Proc. IEEE 86, 2278–2324, 1998), fetched from https://ossci-datasets.s3.amazonaws.com/mnist/.
 * The original MNIST page states no licence; Hugging Face's "ylecun/mnist" card gives MIT (others
 * cite CC BY-SA 3.0). DIGITS are three test digits and keep its terms and attribution.
 *
 * Training: ${info.epochs} epochs, mini-batches of ${info.BATCH}, Adam, peak learning rate ${info.LR}, EMA ${info.EMA},
 * seed ${info.SEED}; ${info.seconds} s ${info.cpu ? 'of CPU time' : 'wall clock'} on ${info.workers} threads; final training loss ${info.loss.toFixed(4)}.
 *
 * Images: 28 × 28, 4 bits per pixel, two per byte (high nibble first), base64; value v ↦
 * (v / 15) · 2 − 1 (−1 = black paper, 1 = white ink), x_t clipped to [−1, 1] first.
 * SEQUENCES: start = x_T (pure noise); frames = the noisy image x_t after chosen steps and the
 * network's prediction x̂₀ of the clean digit at that step; reads = what the convolution-vision
 * network reads in the final image. CHECK: of 200 digits sampled at each guidance scale (20 per
 * digit, 100 steps), how many that network reads as the digit asked for.
 */

export interface Frame {
	/** denoising steps done (1 … steps) */
	k: number;
	/** the timestep reached after them (0 = finished): x is x_t */
	t: number;
	x: string;
	x0: string;
}
export interface Sequence {
	digit: number;
	seed: number;
	guidance: number;
	steps: number;
	start: string;
	frames: Frame[];
	reads: number;
}

export const TRAIN = ${JSON.stringify({ epochs: info.epochs, seconds: info.seconds, loss: Number(info.loss.toFixed(4)), params: paramCount(MNIST) })};
export const CHECK = ${JSON.stringify(CHECK)};
export const DIGITS = ${JSON.stringify(DIGITS)};
export const SEQUENCES: Sequence[] = ${JSON.stringify(SEQUENCES)};
`;
	fs.writeFileSync(OUT, out);
	console.log(`wrote ${OUT} (${Math.round(out.length / 1024)} KB)`);
}

function readsPacked(b64, reads) {
	const bytes = Buffer.from(b64, 'base64');
	const img = new Float32Array(784);
	for (let i = 0; i < bytes.length; i++) {
		img[2 * i] = ((bytes[i] >> 4) / 15) * 2 - 1;
		img[2 * i + 1] = ((bytes[i] & 15) / 15) * 2 - 1;
	}
	return reads(img);
}
