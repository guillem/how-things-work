#!/usr/bin/env node
/**
 * Trains the small convolutional network of the convolution-vision explainer on MNIST and writes
 * src/routes/convolution-vision/mnist-cnn.ts: its weights, its accuracy on the 10 000 test digits,
 * a few real test digits for the page, and what the second layer's filters respond to.
 *
 *   node scripts/data/convolution-vision/train.mjs <cache dir> [--quick] [--gradcheck]
 *
 * Plain Node (≥ 23, which runs TypeScript by stripping its types), single-threaded, no
 * dependency: the forward pass is the page's own (src/routes/convolution-vision/cnn.ts), the
 * backward pass (backpropagation through the dense layer, the max pools, the ReLUs and both
 * convolutions) is written out below and checked against finite differences by --gradcheck.
 * The full run takes about 10 minutes on one core of a 2024 laptop.
 *
 * Data: the MNIST database of handwritten digits (Yann LeCun, Corinna Cortes and Christopher
 * J. C. Burges, http://yann.lecun.com/exdb/mnist/; described in LeCun, Bottou, Bengio & Haffner,
 * "Gradient-based learning applied to document recognition", Proc. IEEE 86, 2278–2324, 1998):
 * 60 000 training and 10 000 test digits, 28 × 28 grey pixels. The four files are fetched from
 * the mirror torchvision uses (https://ossci-datasets.s3.amazonaws.com/mnist/) into the cache dir
 * (outside the repository) and checked against the SHA-256 sums below. Licence: MNIST is
 * distributed under the Creative Commons Attribution-Share Alike 3.0 licence (as stated by
 * TensorFlow Datasets' catalogue entry for "mnist"); the few test digits written to the output
 * file are shared under the same licence.
 *
 * Training: the 60 000 training digits only (the test digits are never seen until the
 * evaluation). Weights start He-normal (seeded mulberry32), biases at 0. Mini-batches of 32,
 * shuffled each epoch, each digit shifted by a random whole number of pixels from −2 to 2 in x
 * and y (so drawn digits that are not perfectly centred still work). Softmax cross-entropy loss,
 * Adam (β₁ 0.9, β₂ 0.999, ε 1e-8), learning rate LR[epoch].
 *
 * Evaluation: the trained weights are stored as float32, decoded again with the page's
 * `decodeWeights`, and run with the page's `forward` on all 10 000 test digits: that is the
 * accuracy quoted on the page.
 *
 * Output subsets: SAMPLES are the first two test digits of each class plus the first four the
 * network gets wrong, with the probabilities it gives them. PARTS: for each second-layer filter,
 * the six test digits whose patch excites it most (at most one patch per digit), as the 14 × 14
 * pixel window that one second-layer unit sees (its receptive field), with the activation (after
 * the ReLU, before pooling).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
	C1,
	C2,
	CLASSES,
	FLAT,
	K,
	P1,
	PARAMS,
	SHAPES,
	SIDE,
	decodeWeights,
	forward
} from '../../../src/routes/convolution-vision/cnn.ts';

const MIRROR = 'https://ossci-datasets.s3.amazonaws.com/mnist/';
const FILES = {
	trainImages: [
		'train-images-idx3-ubyte.gz',
		'440fcabf73cc546fa21475e81ea370265605f56be210a4024d2ca8f203523609'
	],
	trainLabels: [
		'train-labels-idx1-ubyte.gz',
		'3552534a0a558bbed6aed32b30c495cca23d567ec52cac8be1a0730e8010255c'
	],
	testImages: [
		't10k-images-idx3-ubyte.gz',
		'8d422c7b0a1c1c79245a5bcf07fe86e33eeafee792b84584aec276f5a2dbc4e6'
	],
	testLabels: [
		't10k-labels-idx1-ubyte.gz',
		'f7ae60f92e00ec6debd23a6088c31dbd2371eca3ffa0defaefb259924204aec6'
	]
};
const SEED = 7;
const BATCH = 32;
const LR = [2e-3, 1e-3, 5e-4, 2.5e-4];
const SHIFT = 2;
const OUT = path.resolve(
	import.meta.dirname,
	'../../../src/routes/convolution-vision/mnist-cnn.ts'
);

const args = process.argv.slice(2);
const cache = args.find((a) => !a.startsWith('--'));
const QUICK = args.includes('--quick');
const GRADCHECK = args.includes('--gradcheck');
if (!cache) {
	console.error('usage: node scripts/data/convolution-vision/train.mjs <cache dir> [--quick]');
	process.exit(1);
}

// ------------------------------------------------------------------------------- data
async function fetchFile([name, sha]) {
	const file = path.join(cache, name);
	if (!fs.existsSync(file)) {
		fs.mkdirSync(cache, { recursive: true });
		const res = await fetch(MIRROR + name);
		if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
		fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
	}
	const buf = fs.readFileSync(file);
	const got = crypto.createHash('sha256').update(buf).digest('hex');
	if (got !== sha) throw new Error(`${name}: SHA-256 ${got}, expected ${sha}`);
	return zlib.gunzipSync(buf);
}

function idx(buf, kind) {
	const magic = buf.readUInt32BE(0);
	const n = buf.readUInt32BE(4);
	if (kind === 'images') {
		if (magic !== 2051 || buf.readUInt32BE(8) !== SIDE || buf.readUInt32BE(12) !== SIDE)
			throw new Error('not an MNIST image file');
		return { n, data: buf.subarray(16) };
	}
	if (magic !== 2049) throw new Error('not an MNIST label file');
	return { n, data: buf.subarray(8) };
}

const train = idx(await fetchFile(FILES.trainImages), 'images');
const trainY = idx(await fetchFile(FILES.trainLabels), 'labels');
const test = idx(await fetchFile(FILES.testImages), 'images');
const testY = idx(await fetchFile(FILES.testLabels), 'labels');
console.log(`MNIST: ${train.n} training and ${test.n} test digits`);

const N = SIDE * SIDE;
const image = (set, i) => {
	const a = new Float32Array(N);
	for (let p = 0; p < N; p++) a[p] = set.data[i * N + p] / 255;
	return a;
};

// --------------------------------------------------------------------------- weights
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rand = mulberry32(SEED);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

const FAN_IN = { c1w: K * K, c2w: C1 * K * K, dw: FLAT };
const wt = {};
for (const [name, size] of SHAPES) {
	const a = new Float32Array(size);
	if (FAN_IN[name]) {
		const sd = Math.sqrt(2 / FAN_IN[name]);
		for (let i = 0; i < size; i++) a[i] = gauss() * sd;
	}
	wt[name] = a;
}
const zeros = () => Object.fromEntries(SHAPES.map(([n, s]) => [n, new Float64Array(s)]));

// ----------------------------------------------------------------------- backward pass
/**
 * Adds the gradient of the cross-entropy loss of one example to `g`; returns the loss and
 * whether the example was classified right.
 */
function backprop(input, label, g) {
	const a = forward(wt, input);
	const loss = -Math.log(Math.max(a.probs[label], 1e-12));
	// dense
	const dPool2 = new Float32Array(FLAT);
	for (let j = 0; j < CLASSES; j++) {
		const d = a.probs[j] - (j === label ? 1 : 0);
		g.db[j] += d;
		const o = j * FLAT;
		for (let i = 0; i < FLAT; i++) {
			g.dw[o + i] += d * a.pool2[i];
			dPool2[i] += d * wt.dw[o + i];
		}
	}
	// pool 2 and ReLU 2 → gradient on the second convolution's output (the window's max only)
	const dConv2 = unpool(dPool2, a.relu2, a.conv2, C2, P1);
	// conv 2: kernel gradient and gradient on its input (the first pooled maps)
	const dPool1 = new Float32Array(C1 * P1 * P1);
	convBack(dConv2, a.pool1, C1, C2, P1, wt.c2w, g.c2w, g.c2b, dPool1);
	const dConv1 = unpool(dPool1, a.relu1, a.conv1, C1, SIDE);
	convBack(dConv1, input, 1, C1, SIDE, wt.c1w, g.c1w, g.c1b, null);
	return { loss, right: a.digit === label };
}

/** Routes the gradient of each pooled value to the first maximum of its 2 × 2 window, if > 0. */
function unpool(dPooled, act, pre, c, h) {
	const h2 = h >> 1;
	const d = new Float32Array(c * h * h);
	for (let ch = 0; ch < c; ch++)
		for (let y = 0; y < h2; y++)
			for (let x = 0; x < h2; x++) {
				const gv = dPooled[ch * h2 * h2 + y * h2 + x];
				if (gv === 0) continue;
				const i = ch * h * h + 2 * y * h + 2 * x;
				let best = i;
				for (const j of [i + 1, i + h, i + h + 1]) if (act[j] > act[best]) best = j;
				if (pre[best] > 0) d[best] = gv;
			}
	return d;
}

/** Backward pass of a "same" convolution of `cin` → `cout` maps of h × h. */
function convBack(dOut, input, cin, cout, h, kernel, gK, gB, dIn) {
	const p = (K - 1) >> 1;
	for (let co = 0; co < cout; co++)
		for (let y = 0; y < h; y++)
			for (let x = 0; x < h; x++) {
				const d = dOut[co * h * h + y * h + x];
				if (d === 0) continue;
				gB[co] += d;
				for (let ci = 0; ci < cin; ci++) {
					const kb = (co * cin + ci) * K * K;
					const ib = ci * h * h;
					for (let dy = 0; dy < K; dy++) {
						const yy = y + dy - p;
						if (yy < 0 || yy >= h) continue;
						for (let dx = 0; dx < K; dx++) {
							const xx = x + dx - p;
							if (xx < 0 || xx >= h) continue;
							gK[kb + dy * K + dx] += d * input[ib + yy * h + xx];
							if (dIn) dIn[ib + yy * h + xx] += d * kernel[kb + dy * K + dx];
						}
					}
				}
			}
}

// -------------------------------------------------------------------------- grad check
if (GRADCHECK) {
	// Non-zero biases: with all biases at 0 the empty background sits exactly on the ReLU's kink,
	// where the one-sided slopes differ and a central difference cannot match either.
	for (const name of ['c1b', 'c2b', 'db'])
		wt[name].forEach((_, i) => (wt[name][i] = 0.2 * (rand() - 0.5)));
	// A noise image, not a digit: in a digit's flat background many values tie, and the loss is
	// full of kinks where finite differences cannot match.
	const x = Float32Array.from({ length: N }, () => rand());
	const y = trainY.data[0];
	const g = zeros();
	backprop(x, y, g);
	const lossAt = () => -Math.log(forward(wt, x).probs[y]);
	let worst = 0;
	for (const [name, size] of SHAPES) {
		for (let k = 0; k < 6; k++) {
			const i = Math.floor(rand() * size);
			const v = wt[name][i];
			const h = 1e-3;
			wt[name][i] = v + h;
			const lp = lossAt();
			wt[name][i] = v - h;
			const lm = lossAt();
			wt[name][i] = v;
			const num = (lp - lm) / (2 * h);
			// Where tied values meet a ReLU or a max (the flat background), the loss has a kink:
			// backpropagation then gives one of the one-sided slopes.
			const l0 = lossAt();
			const rel = (n) =>
				Math.abs(n - g[name][i]) / Math.max(1e-3, Math.abs(n) + Math.abs(g[name][i]));
			const err = Math.min(rel(num), rel((lp - l0) / h), rel((l0 - lm) / h));
			worst = Math.max(worst, err);
			console.log(
				`${name}[${i}] backprop ${g[name][i].toExponential(4)} numeric ${num.toExponential(4)}`
			);
		}
	}
	console.log(`worst relative error ${worst.toExponential(2)}`);
	process.exit(worst < 0.02 ? 0 : 1);
}

// ---------------------------------------------------------------------------- training
function shifted(set, i, sx, sy) {
	const a = new Float32Array(N);
	for (let y = 0; y < SIDE; y++) {
		const yy = y - sy;
		if (yy < 0 || yy >= SIDE) continue;
		for (let x = 0; x < SIDE; x++) {
			const xx = x - sx;
			if (xx < 0 || xx >= SIDE) continue;
			a[y * SIDE + x] = set.data[i * N + yy * SIDE + xx] / 255;
		}
	}
	return a;
}

const nTrain = QUICK ? 5000 : train.n;
const epochs = QUICK ? 1 : LR.length;
const m = zeros();
const v = zeros();
let tStep = 0;
const started = Date.now();
let trainAccuracy = 0;
for (let e = 0; e < epochs; e++) {
	const order = Array.from({ length: nTrain }, (_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	let lossSum = 0;
	let right = 0;
	for (let b = 0; b < nTrain; b += BATCH) {
		const g = zeros();
		const batch = order.slice(b, b + BATCH);
		for (const i of batch) {
			const sx = Math.floor(rand() * (2 * SHIFT + 1)) - SHIFT;
			const sy = Math.floor(rand() * (2 * SHIFT + 1)) - SHIFT;
			const r = backprop(shifted(train, i, sx, sy), trainY.data[i], g);
			lossSum += r.loss;
			if (r.right) right++;
		}
		tStep++;
		const lr = LR[e];
		const c1 = 1 - 0.9 ** tStep;
		const c2 = 1 - 0.999 ** tStep;
		for (const [name, size] of SHAPES) {
			const w = wt[name];
			const gg = g[name];
			const mm = m[name];
			const vv = v[name];
			for (let k = 0; k < size; k++) {
				const gk = gg[k] / batch.length;
				mm[k] = 0.9 * mm[k] + 0.1 * gk;
				vv[k] = 0.999 * vv[k] + 0.001 * gk * gk;
				w[k] -= (lr * (mm[k] / c1)) / (Math.sqrt(vv[k] / c2) + 1e-8);
			}
		}
		if ((b / BATCH) % 200 === 0)
			process.stdout.write(
				`\repoch ${e + 1}/${epochs} ${b}/${nTrain} loss ${(lossSum / (b + batch.length)).toFixed(4)}  `
			);
	}
	trainAccuracy = right / nTrain;
	console.log(
		`\repoch ${e + 1}/${epochs}: loss ${(lossSum / nTrain).toFixed(4)}, accuracy on the (shifted) training digits ${(100 * trainAccuracy).toFixed(2)}%, ${Math.round((Date.now() - started) / 1000)} s`
	);
}
const seconds = Math.round((Date.now() - started) / 1000);

// -------------------------------------------------------------------------- evaluation
const bytes = new Uint8Array(PARAMS * 4);
const view = new DataView(bytes.buffer);
let o = 0;
for (const [name, size] of SHAPES)
	for (let i = 0; i < size; i++, o += 4) view.setFloat32(o, wt[name][i], true);
const WEIGHTS = Buffer.from(bytes).toString('base64');
const shipped = decodeWeights(WEIGHTS);

const nTest = QUICK ? 1000 : test.n;
const confusion = Array.from({ length: CLASSES }, () => new Array(CLASSES).fill(0));
const wrong = [];
const results = [];
// top activations of each second-layer filter: [{ value, index, y, x }]
const tops = Array.from({ length: C2 }, () => []);
const TOP = 6;
for (let i = 0; i < nTest; i++) {
	const a = forward(shipped, image(test, i));
	const label = testY.data[i];
	confusion[label][a.digit]++;
	if (a.digit !== label) wrong.push(i);
	results.push({ digit: a.digit, probs: a.probs });
	for (let c = 0; c < C2; c++) {
		let best = -1;
		let at = 0;
		for (let p = 0; p < P1 * P1; p++) {
			const val = a.relu2[c * P1 * P1 + p];
			if (val > best) [best, at] = [val, p];
		}
		const list = tops[c];
		if (list.length < TOP || best > list[list.length - 1].value) {
			list.push({ value: best, index: i, y: Math.floor(at / P1), x: at % P1 });
			list.sort((p, q) => q.value - p.value);
			if (list.length > TOP) list.pop();
		}
	}
}
const errors = wrong.length;
const accuracy = (nTest - errors) / nTest;
console.log(
	`test accuracy (shipped weights, the page's forward pass): ${(100 * accuracy).toFixed(2)}% (${errors} of ${nTest} wrong)`
);

// ------------------------------------------------------------------------------ output
const b64 = (u8) => Buffer.from(u8).toString('base64');
const pixels = (i) => b64(test.data.subarray(i * N, (i + 1) * N));
const sampleIdx = [];
for (let d = 0; d < CLASSES; d++) {
	let n = 0;
	for (let i = 0; i < nTest && n < 2; i++) if (testY.data[i] === d) (sampleIdx.push(i), n++);
}
sampleIdx.sort((a, b) => a - b);
const samples = [...sampleIdx, ...wrong.slice(0, 4)].map((i) => ({
	index: i,
	label: testY.data[i],
	predicted: results[i].digit,
	probs: results[i].probs.map((p) => Number(p.toFixed(5))),
	pixels: pixels(i)
}));

// the 14 × 14 input window seen by a second-layer unit at (y, x) of its 14 × 14 map
const RF = 14;
function patch(i, y, x) {
	const out = new Uint8Array(RF * RF);
	for (let r = 0; r < RF; r++)
		for (let c = 0; c < RF; c++) {
			const yy = 2 * y - 6 + r;
			const xx = 2 * x - 6 + c;
			if (yy >= 0 && yy < SIDE && xx >= 0 && xx < SIDE)
				out[r * RF + c] = test.data[i * N + yy * SIDE + xx];
		}
	return b64(out);
}
const parts = tops.map((list) =>
	list.map((t) => ({
		index: t.index,
		y: t.y,
		x: t.x,
		value: Number(t.value.toFixed(3)),
		pixels: patch(t.index, t.y, t.x)
	}))
);

const header = `/**
 * GENERATED by scripts/data/convolution-vision/train.mjs — do not edit by hand.
 *
 * A small convolutional network (architecture in ./cnn.ts, ${PARAMS.toLocaleString('en-US')} parameters) trained on
 * the MNIST database of handwritten digits (Yann LeCun, Corinna Cortes and Christopher J. C.
 * Burges, http://yann.lecun.com/exdb/mnist/; LeCun et al., Proc. IEEE 86, 2278–2324, 1998),
 * fetched from https://ossci-datasets.s3.amazonaws.com/mnist/. MNIST is distributed under the
 * Creative Commons Attribution-Share Alike 3.0 licence; the test digits below (SAMPLES, PARTS)
 * are a subset of it, shared under the same licence.
 *
 * Training: the ${nTrain.toLocaleString('en-US')} training digits, ${epochs} epoch${epochs > 1 ? 's' : ''}, mini-batches of ${BATCH}, random shifts of up
 * to ±${SHIFT} px, Adam with learning rates ${LR.slice(0, epochs).join(', ')}, seed ${SEED}; ${seconds} s on one core.
 * Accuracy on the ${nTest.toLocaleString('en-US')} test digits (never used in training), computed with the
 * page's own forward pass on these stored weights: ${(100 * accuracy).toFixed(2)}%.
 *
 * WEIGHTS: little-endian float32, the tensors in the order of SHAPES in ./cnn.ts, base64.
 * SAMPLES: the first two test digits of each class and the first four the network gets wrong
 * (28 × 28 bytes, ink = 255), with the probabilities it gives them.
 * PARTS: for each second-layer filter, the six test digits it responds to most strongly (one
 * patch per digit): the 14 × 14 window one unit of that filter sees, centred on the unit, and
 * the unit's output (after the ReLU).
 */
${QUICK ? '// QUICK RUN: not for shipping\n' : ''}`;

const body = `
export const WEIGHTS = '${WEIGHTS}';

export const TEST_COUNT = ${nTest};
export const TEST_ERRORS = ${errors};
export const TEST_ACCURACY = ${accuracy};
export const TRAIN_COUNT = ${nTrain};
export const EPOCHS = ${epochs};

/** confusion[true digit][predicted digit] over the test digits */
export const CONFUSION: number[][] = ${JSON.stringify(confusion)};

export interface Sample {
	/** position in the MNIST test set */
	index: number;
	label: number;
	predicted: number;
	probs: number[];
	pixels: string;
}
export const SAMPLES: Sample[] = ${JSON.stringify(samples, null, '\t')};

export interface Part {
	index: number;
	/** the unit's position in its 14 × 14 map */
	y: number;
	x: number;
	value: number;
	pixels: string;
}
export const PARTS: Part[][] = ${JSON.stringify(parts)};
`;
fs.writeFileSync(OUT, header + body);
console.log(`wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
