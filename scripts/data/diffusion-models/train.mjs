#!/usr/bin/env node
/**
 * Trains the two denoising networks of the diffusion-models explainer and writes what the page
 * ships. Plain Node (≥ 23, which runs TypeScript by stripping its types), no dependency: the
 * network, the noise schedule and the sampler are the page's own
 * (src/routes/diffusion-models/ddpm.ts); the backward pass is in ./net.mjs.
 *
 *   node scripts/data/diffusion-models/train.mjs moons <cache dir>
 *   node scripts/data/diffusion-models/train.mjs mnist <cache dir> [--workers 2] [--epochs 40]
 *   node scripts/data/diffusion-models/train.mjs sequences <cache dir>
 *   node scripts/data/diffusion-models/train.mjs gradcheck <cache dir>
 *
 * Training (both models) follows Ho, Jain & Abbeel, "Denoising Diffusion Probabilistic Models"
 * (NeurIPS 2020), Algorithm 1: take a clean example x₀, a step t uniform in 1 … T = 1000 and
 * noise ε ~ N(0, I); form x_t = √ᾱ_t x₀ + √(1 − ᾱ_t) ε; take a gradient step on the loss. The
 * network outputs its guess x̂₀ of the clean data (see ddpm.ts), and the loss is
 * min(SNR_t, 5) · ‖x̂₀ − x₀‖² (Hang et al., ICCV 2023), which is the same as the noise loss
 * ‖ε − ε̂‖² of Ho et al. weighted by min(1, 5 / SNR_t).
 * For classifier-free guidance (Ho & Salimans, arXiv:2207.12598) the label is replaced by
 * "no label" with probability P_UNCOND. Adam (β₁ 0.9, β₂ 0.999), gradient norm clipped at 1,
 * learning rate warmed up over the first 500 steps then decayed with a cosine; the shipped
 * weights are an exponential moving average of the trained ones (decay EMA), as in Ho et al.
 *
 * moons: the "two moons" (two interleaved half circles, as scikit-learn's make_moons, with
 *   Gaussian jitter of sd 0.05), shifted and scaled so they sit around the origin; label 0 =
 *   upper moon, 1 = lower moon. Points are made up by the computer: fresh ones every batch,
 *   from a seeded generator. Writes src/routes/diffusion-models/moons-model.ts.
 *
 * mnist: the 60 000 training digits of MNIST (Yann LeCun, Corinna Cortes and Christopher J. C.
 *   Burges, http://yann.lecun.com/exdb/mnist/; LeCun, Bottou, Bengio & Haffner, Proc. IEEE 86,
 *   2278–2324, 1998), fetched from the mirror torchvision uses
 *   (https://ossci-datasets.s3.amazonaws.com/mnist/) into the cache dir and checked against the
 *   SHA-256 sums below. Pixels are scaled to [−1, 1]. Licence: the original MNIST page states
 *   none; Hugging Face's "ylecun/mnist" card gives MIT (others cite CC BY-SA 3.0). Training
 *   runs on `--workers` threads (each computes the gradient of part of every batch). The trained
 *   EMA weights are saved in the cache dir (mnist-ema.f32, ~7 MB, not shipped), then
 *   `sequences` runs.
 *
 * sequences: loads the saved MNIST weights and samples, with the page's `sample`, the
 *   denoising sequences the page shows, plus three real test digits for the noising steps.
 *   Writes src/routes/diffusion-models/mnist-sequences.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import {
	T,
	alphaBar,
	gaussian,
	mulberry32,
	paramCount,
	unflatten
} from '../../../src/routes/diffusion-models/ddpm.ts';
import { moon } from '../../../src/routes/diffusion-models/moons.ts';
import { loadMnist } from './mnist.mjs';
import { backprop, initWeights } from './net.mjs';

export const MOONS = { D: 2, H: 32, E: 16, blocks: 2, classes: 2 };
export const MNIST = { D: 784, H: 512, E: 32, blocks: 3, classes: 10 };
const P_UNCOND = 0.15;
const SNR_CAP = 5;
const ROUTES = path.resolve(import.meta.dirname, '../../../src/routes/diffusion-models');

// ------------------------------------------------------------------------------- data

// ------------------------------------------------------------------------------ worker
if (!isMainThread) {
	const { cfg, wBuf, gBuf, pixels, labels } = workerData;
	const wt = unflatten(cfg, new Float32Array(wBuf));
	const g = new Float32Array(gBuf);
	parentPort.on('message', ({ items, seed }) => {
		g.fill(0);
		const loss = gradOf(cfg, wt, g, items, seed, (i, out, o) => {
			for (let p = 0; p < cfg.D; p++) out[o + p] = pixels[i * cfg.D + p] / 127.5 - 1;
			return labels[i];
		});
		parentPort.postMessage(loss);
	});
}

/**
 * Gradient of one (part of a) batch. `items` are example indices; `fill(i, x, offset)` writes
 * example i into x and returns its label. Steps, noise and label dropping come from `seed`.
 */
function gradOf(cfg, wt, g, items, seed, fill) {
	const B = items.length;
	const rand = mulberry32(seed);
	const gauss = gaussian(seed ^ 0x9e3779b9);
	const x0 = new Float32Array(B * cfg.D);
	const ts = new Array(B);
	const labels = new Array(B);
	for (let n = 0; n < B; n++) {
		const label = fill(items[n], x0, n * cfg.D);
		labels[n] = rand() < P_UNCOND ? cfg.classes : label;
		ts[n] = 1 + Math.floor(rand() * T);
	}
	const eps = Float32Array.from({ length: B * cfg.D }, () => gauss());
	const x = new Float32Array(B * cfg.D);
	for (let n = 0; n < B; n++) {
		const ab = alphaBar(ts[n]);
		const a = Math.sqrt(ab);
		const b = Math.sqrt(1 - ab);
		for (let p = 0; p < cfg.D; p++) {
			const i = n * cfg.D + p;
			x[i] = a * x0[i] + b * eps[i];
		}
	}
	const w = ts.map((t) => Math.min(alphaBar(t) / (1 - alphaBar(t)), SNR_CAP));
	return backprop(wt, g, x, ts, labels, x0, w);
}

// ------------------------------------------------------------------------------ training

class Adam {
	constructor(n) {
		this.m = new Float32Array(n);
		this.v = new Float32Array(n);
		this.t = 0;
	}
	step(w, g, lr) {
		this.t++;
		let norm = 0;
		for (let i = 0; i < g.length; i++) norm += g[i] * g[i];
		norm = Math.sqrt(norm);
		const clip = norm > 1 ? 1 / norm : 1;
		const c1 = 1 - 0.9 ** this.t;
		const c2 = 1 - 0.999 ** this.t;
		const { m, v } = this;
		for (let i = 0; i < g.length; i++) {
			const gi = g[i] * clip;
			m[i] = 0.9 * m[i] + 0.1 * gi;
			v[i] = 0.999 * v[i] + 0.001 * gi * gi;
			w[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8);
		}
		return norm;
	}
}

const lrAt = (step, total, peak) =>
	step < 500
		? (peak * (step + 1)) / 500
		: peak * (0.05 + 0.95 * 0.5 * (1 + Math.cos((Math.PI * step) / total)));

function emaUpdate(ema, w, decay) {
	for (let i = 0; i < w.length; i++) ema[i] = decay * ema[i] + (1 - decay) * w[i];
}

/** CPU time used so far by the whole process (all threads), in seconds. */
const cpuSeconds = () => {
	const u = process.cpuUsage();
	return Math.round((u.user + u.system) / 1e6);
};

const b64 = (f32) => Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength).toString('base64');

async function trainMoons() {
	const cfg = MOONS;
	const SEED = 11;
	const STEPS = 30000;
	const BATCH = 256;
	const LR = 2e-3;
	const EMA = 0.999;
	const flat = initWeights(cfg, gaussian(SEED));
	const wt = unflatten(cfg, flat);
	const ema = new Float32Array(flat);
	const g = new Float32Array(flat.length);
	const opt = new Adam(flat.length);
	const rand = mulberry32(SEED + 1);
	const gauss = gaussian(SEED + 2);
	const started = Date.now();
	let avg = 0;
	for (let s = 0; s < STEPS; s++) {
		g.fill(0);
		const items = new Array(BATCH).fill(0);
		const loss = gradOf(cfg, wt, g, items, 1000 + s, (_, x, o) => {
			const label = rand() < 0.5 ? 0 : 1;
			const [px, py] = moon(rand, gauss, label);
			x[o] = px;
			x[o + 1] = py;
			return label;
		});
		opt.step(flat, g, lrAt(s, STEPS, LR));
		emaUpdate(ema, flat, s < 1000 ? 0.99 : EMA);
		avg = s ? 0.99 * avg + 0.01 * loss : loss;
		if (s % 2000 === 0) console.log(`step ${s}: loss ${avg.toFixed(4)}`);
	}
	const seconds = cpuSeconds();
	console.log(
		`trained in ${seconds} s of CPU time (${Math.round((Date.now() - started) / 1000)} s wall clock), final loss ${avg.toFixed(4)}`
	);
	const out = `/**
 * GENERATED by scripts/data/diffusion-models/train.mjs moons — do not edit by hand.
 *
 * The denoising network (./ddpm.ts) of the 2-D model, trained on the "two moons": points made
 * up by the computer (two interleaved half circles, as scikit-learn's make_moons, jitter sd 0.05,
 * moved to sit around the origin), label 0 = upper moon, 1 = lower moon, dropped to "no label"
 * with probability ${P_UNCOND} for classifier-free guidance. ${STEPS} Adam steps of ${BATCH} fresh points, peak
 * learning rate ${LR}, seed ${SEED}; ${seconds} s of CPU time on one core; final training loss ${avg.toFixed(4)}.
 * WEIGHTS: the exponential moving average (decay ${EMA}) of the trained weights, little-endian
 * float32 in the order of \`shapes(MOONS)\`, base64.
 */
import type { NetConfig } from './ddpm';

export const MOONS: NetConfig = ${JSON.stringify(cfg)};
export const TRAIN_LOSS = ${avg.toFixed(4)};
export const WEIGHTS =
	'${b64(ema)}';
`;
	fs.writeFileSync(path.join(ROUTES, 'moons-model.ts'), out);
	console.log(`wrote moons-model.ts (${paramCount(cfg)} parameters)`);
}

async function trainMnist(cache, workers, epochs) {
	const cfg = MNIST;
	const SEED = 5;
	const BATCH = 128;
	const LR = 1e-3;
	const EMA = 0.9995;
	const train = await loadMnist(cache, 'train');
	console.log(`MNIST: ${train.n} training digits; ${paramCount(cfg)} parameters`);
	const wBuf = new SharedArrayBuffer(paramCount(cfg) * 4);
	const flat = new Float32Array(wBuf);
	flat.set(initWeights(cfg, gaussian(SEED)));
	const ema = new Float32Array(flat);
	const pool = [];
	for (let k = 0; k < workers; k++) {
		const gBuf = new SharedArrayBuffer(flat.length * 4);
		const pixels = new Uint8Array(new SharedArrayBuffer(train.pixels.length));
		pixels.set(train.pixels);
		const labels = new Uint8Array(train.labels);
		const w = new Worker(new URL(import.meta.url), {
			workerData: { cfg, wBuf, gBuf, pixels, labels }
		});
		pool.push({ w, g: new Float32Array(gBuf) });
	}
	const run = (p, items, seed) =>
		new Promise((resolve) => {
			p.w.once('message', resolve);
			p.w.postMessage({ items, seed });
		});
	const g = new Float32Array(flat.length);
	const opt = new Adam(flat.length);
	const rand = mulberry32(SEED + 1);
	const perEpoch = Math.floor(train.n / BATCH);
	const total = perEpoch * epochs;
	const started = Date.now();
	let step = 0;
	let avg = 0;
	const ckpt = path.join(cache, 'mnist-ema.f32');
	for (let e = 0; e < epochs; e++) {
		const order = Array.from({ length: train.n }, (_, i) => i);
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		for (let b = 0; b < perEpoch; b++, step++) {
			const items = order.slice(b * BATCH, (b + 1) * BATCH);
			const per = Math.ceil(BATCH / workers);
			const losses = await Promise.all(
				pool.map((p, k) => run(p, items.slice(k * per, (k + 1) * per), step * 16 + k))
			);
			// each worker's loss and gradient are means over its share: weight them by its size
			g.fill(0);
			let loss = 0;
			pool.forEach((p, k) => {
				const share = Math.min(per, BATCH - k * per) / BATCH;
				loss += losses[k] * share;
				for (let i = 0; i < g.length; i++) g[i] += p.g[i] * share;
			});
			opt.step(flat, g, lrAt(step, total, LR));
			emaUpdate(ema, flat, step < 2000 ? 0.995 : EMA);
			avg = step ? 0.99 * avg + 0.01 * loss : loss;
			if (step % 50 === 0)
				process.stdout.write(
					`\repoch ${e + 1}/${epochs} batch ${b}/${perEpoch} loss ${avg.toFixed(4)} ${Math.round((Date.now() - started) / 1000)} s  `
				);
		}
		console.log(
			`\repoch ${e + 1}/${epochs}: loss ${avg.toFixed(4)}, ${Math.round((Date.now() - started) / 1000)} s`
		);
		fs.writeFileSync(ckpt, Buffer.from(ema.buffer));
		fs.writeFileSync(
			path.join(cache, 'mnist-info.json'),
			JSON.stringify({
				epochs: e + 1,
				loss: avg,
				seconds: cpuSeconds(),
				cpu: true,
				workers,
				BATCH,
				LR,
				EMA,
				SEED
			})
		);
	}
	for (const p of pool) await p.w.terminate();
}

// ---------------------------------------------------------------------------- grad check
function gradcheck() {
	const cfg = { D: 5, H: 7, E: 4, blocks: 2, classes: 3 };
	const gauss = gaussian(3);
	const flat = initWeights(cfg, gauss);
	for (let i = 0; i < flat.length; i++) flat[i] += 0.1 * gauss();
	const wt = unflatten(cfg, flat);
	const B = 4;
	const x = Float32Array.from({ length: B * cfg.D }, gauss);
	const x0 = Float32Array.from({ length: B * cfg.D }, gauss);
	const ts = [3, 250, 600, 999];
	const labels = [0, 3, 2, 1];
	const w = [5, 2, 0.3, 0.01];
	const g = new Float32Array(flat.length);
	backprop(wt, g, x, ts, labels, x0, w);
	const lossAt = () => backprop(wt, new Float32Array(flat.length), x, ts, labels, x0, w);
	let worst = 0;
	const rand = mulberry32(9);
	for (let k = 0; k < 60; k++) {
		const i = Math.floor(rand() * flat.length);
		const v = flat[i];
		const h = 1e-2;
		flat[i] = v + h;
		const lp = lossAt();
		flat[i] = v - h;
		const lm = lossAt();
		flat[i] = v;
		const num = (lp - lm) / (2 * h);
		const err = Math.abs(num - g[i]) / Math.max(1e-4, Math.abs(num) + Math.abs(g[i]));
		worst = Math.max(worst, err);
	}
	console.log(`gradient check: worst relative error ${worst.toExponential(2)} over 60 weights`);
	process.exit(worst < 0.01 ? 0 : 1);
}

// ------------------------------------------------------------------------------ main
if (isMainThread) {
	const args = process.argv.slice(2);
	const [mode, cache] = args;
	const opt = (name, def) => {
		const i = args.indexOf(`--${name}`);
		return i >= 0 ? Number(args[i + 1]) : def;
	};
	if (mode === 'gradcheck') gradcheck();
	else if (mode === 'moons') await trainMoons();
	else if (mode === 'mnist' && cache) {
		await trainMnist(cache, opt('workers', 2), opt('epochs', 40));
		const { sequences } = await import('./sequences.mjs');
		await sequences(cache);
	} else if (mode === 'sequences' && cache) {
		const { sequences } = await import('./sequences.mjs');
		await sequences(cache);
	} else {
		console.error('usage: train.mjs moons | mnist <cache> | sequences <cache> | gradcheck');
		process.exit(1);
	}
}
