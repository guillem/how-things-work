/**
 * The MNIST database of handwritten digits (Yann LeCun, Corinna Cortes and Christopher J. C.
 * Burges, http://yann.lecun.com/exdb/mnist/), fetched from the mirror torchvision uses into a
 * cache dir outside the repository and checked against SHA-256 sums (the same files as
 * scripts/data/convolution-vision/train.mjs).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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

async function fetchFile(cache, [name, sha]) {
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

export async function loadMnist(cache, which) {
	const img = await fetchFile(cache, FILES[`${which}Images`]);
	const lab = await fetchFile(cache, FILES[`${which}Labels`]);
	if (img.readUInt32BE(0) !== 2051 || lab.readUInt32BE(0) !== 2049) throw new Error('not MNIST');
	return { n: img.readUInt32BE(4), pixels: img.subarray(16), labels: lab.subarray(8) };
}
