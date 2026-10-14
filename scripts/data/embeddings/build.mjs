#!/usr/bin/env node
/**
 * Builds src/routes/embeddings/glove-data.ts: a subset of the GloVe word vectors (Stanford NLP,
 * "glove.6B", 100 dimensions) with two precomputed 2-D maps and a clustering.
 *
 *   node scripts/data/embeddings/build.mjs <cache dir>
 *
 * 1. Fetch. glove.6B.zip (862 MB) holds four text files, one per dimension. Only the start of
 *    glove.6B.100d.txt is needed (the file lists words from most to least frequent), so the script
 *    reads the zip's central directory (the last 64 KiB), then range-fetches the first FETCH bytes
 *    of that member's deflate stream and inflates it as far as it goes. Downloads are cached in the
 *    given directory (outside the repository).
 * 2. Vocabulary. The first N_FREQUENT words that are plain lower-case letters and not in STOP (the
 *    NLTK English stop-word list), plus the hand-picked EXTRA words (everyday words the page uses:
 *    animals, food, family, capitals…), all of which must be among the fetched rows.
 * 3. Vectors. Each vector is scaled to unit length, then quantised to int8 by its largest
 *    component (q = round(127 · u / max|u|)). The page only uses directions (cosines), so the
 *    scale is not stored; decoding re-normalises.
 * 4. Maps. PCA: the two principal components of the decoded unit vectors (power iteration).
 *    t-SNE: exact t-SNE (van der Maaten & Hinton 2008) on the decoded unit vectors, perplexity
 *    PERPLEXITY, ITERATIONS iterations, early exaggeration 12 for the first 250, learning rate
 *    N/12, momentum 0.5 then 0.8, started from the PCA map scaled to a standard deviation of 1e-4,
 *    so the run is deterministic. Both maps are stored as int16, one shared scale per map.
 * 5. Clusters. Spherical k-means (K clusters, k-means++ seeded with mulberry32(SEED), 100 rounds)
 *    in the full 100-D space, used only to colour the maps.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ZIP_URL = 'https://downloads.cs.stanford.edu/nlp/data/glove.6B.zip';
const MEMBER = 'glove.6B.100d.txt';
const FETCH = 10_000_000; // compressed bytes of the member to fetch (≈ 28 000 words)
const N_FREQUENT = 3200;
const PERPLEXITY = 30;
const ITERATIONS = 1000;
const K = 12;
const SEED = 1;
const OUT = path.resolve(import.meta.dirname, '../../../src/routes/embeddings/glove-data.ts');

// NLTK's English stop-word list (nltk.corpus.stopwords.words('english')), letters only.
const STOP = new Set(
	`i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she
her hers herself it its itself they them their theirs themselves what which who whom this that
these those am is are was were be been being have has had having do does did doing a an the and but
if or because as until while of at by for with about against between into through during before
after above below to from up down in out on off over under again further then once here there when
where why how all any both each few more most other some such no nor not only own same so than too
very s t can will just don should now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven
isn ma mightn mustn needn shan shouldn wasn weren won wouldn`.split(/\s+/)
);

// Everyday words the page shows or the reader is likely to search for.
const EXTRA = `
cat dog horse cow pig sheep goat lion tiger elephant mouse rabbit bear wolf fox bird fish snake
monkey duck chicken eagle whale shark frog insect
bread cheese apple banana orange lemon grape rice pasta pizza soup meat beef pork milk coffee tea
sugar salt chocolate egg butter wine beer cake fruit vegetable potato tomato
red blue green yellow purple pink brown black white grey gold silver
hand head eye heart leg arm foot face mouth nose ear hair blood bone skin brain
happy sad angry afraid love hate fear joy anger proud lonely
rain snow wind storm sun cloud ice fog
guitar piano violin drum jazz song music singer
car bus train bicycle plane ship truck boat
mother father sister brother aunt uncle niece nephew son daughter wife husband grandmother
grandfather girl boy woman man king queen prince princess actor actress waiter waitress
doctor nurse teacher engineer lawyer farmer scientist programmer
paris france rome italy berlin germany tokyo japan madrid spain london britain moscow russia
beijing china athens greece lisbon portugal cairo egypt ottawa canada
walk walked walking swim swam swimming run ran running go went
big bigger biggest small smaller smallest good better best bad worse worst
mat sat chased bit garden sofa kitchen happily slept quietly
`
	.split(/\s+/)
	.filter(Boolean);

// ---------------------------------------------------------------- fetch
async function get(url, start, end) {
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
		if (res.status === 206) return Buffer.from(await res.arrayBuffer());
		if (attempt >= 6) throw new Error(`${url} bytes ${start}-${end}: HTTP ${res.status}`);
		console.warn(`HTTP ${res.status}, retrying in ${attempt * 5} s`);
		await new Promise((r) => setTimeout(r, attempt * 5000));
	}
}

async function cached(dir, name, make) {
	const file = path.join(dir, name);
	if (fs.existsSync(file)) return fs.readFileSync(file);
	const buf = await make();
	fs.writeFileSync(file, buf);
	return buf;
}

async function fetchRows(dir) {
	const head = await fetch(ZIP_URL, { method: 'HEAD' });
	const size = Number(head.headers.get('content-length'));
	if (!size) throw new Error('no content-length for ' + ZIP_URL);
	const tail = await cached(dir, 'glove6B-tail.bin', () => get(ZIP_URL, size - 65536, size - 1));
	let offset = -1;
	for (let i = tail.indexOf('PK\x01\x02'); i !== -1; i = tail.indexOf('PK\x01\x02', i + 4)) {
		const nameLength = tail.readUInt16LE(i + 28);
		const name = tail.toString('latin1', i + 46, i + 46 + nameLength);
		if (name === MEMBER) offset = tail.readUInt32LE(i + 42);
	}
	if (offset < 0) throw new Error(`${MEMBER} not found in the zip's central directory`);
	const part = await cached(dir, 'glove6B-100d-start.bin', () =>
		get(ZIP_URL, offset, offset + FETCH - 1)
	);
	if (part.readUInt32LE(0) !== 0x04034b50) throw new Error('not a local file header');
	const start = 30 + part.readUInt16LE(26) + part.readUInt16LE(28);
	// The stream is cut short on purpose: inflate what is there and drop the last partial line.
	const text = zlib
		.inflateRawSync(part.subarray(start), { finishFlush: zlib.constants.Z_SYNC_FLUSH })
		.toString('utf8');
	const lines = text.slice(0, text.lastIndexOf('\n')).split('\n');
	return { lines, offset, size };
}

// ---------------------------------------------------------------- maths helpers
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
const dot = (a, b) => {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
};
const unit = (v) => {
	const n = Math.sqrt(dot(v, v));
	return v.map((x) => x / n);
};

/** The first two principal components of the rows of X (power iteration with deflation). */
function pca2(X) {
	const D = X[0].length;
	const mean = new Float64Array(D);
	for (const x of X) for (let j = 0; j < D; j++) mean[j] += x[j] / X.length;
	const C = Array.from({ length: D }, () => new Float64Array(D));
	for (const x of X)
		for (let i = 0; i < D; i++) {
			const xi = x[i] - mean[i];
			for (let j = 0; j < D; j++) C[i][j] += (xi * (x[j] - mean[j])) / X.length;
		}
	const comps = [];
	for (let c = 0; c < 2; c++) {
		let v = unit(Float64Array.from({ length: D }, (_, i) => 1 + i / D));
		for (let it = 0; it < 2000; it++) {
			const w = new Float64Array(D);
			for (let i = 0; i < D; i++) w[i] = dot(C[i], v);
			v = unit(w);
		}
		// Fix the sign so the run is reproducible: the largest component is positive.
		let big = 0;
		for (let i = 0; i < D; i++) if (Math.abs(v[i]) > Math.abs(v[big])) big = i;
		if (v[big] < 0) v = v.map((x) => -x);
		const lambda = dot(
			v,
			C.map((row) => dot(row, v))
		);
		for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) C[i][j] -= lambda * v[i] * v[j];
		comps.push(v);
	}
	return X.map((x) => comps.map((v) => dot(v, x) - dot(v, mean)));
}

/** Exact t-SNE of unit vectors X, started from Y0. */
function tsne(X, Y0) {
	const N = X.length;
	const P = new Float32Array(N * N);
	const target = Math.log(PERPLEXITY);
	const d2 = new Float64Array(N);
	for (let i = 0; i < N; i++) {
		for (let j = 0; j < N; j++) d2[j] = i === j ? 0 : Math.max(0, 2 - 2 * dot(X[i], X[j]));
		let beta = 1;
		let lo = -Infinity;
		let hi = Infinity;
		const row = new Float64Array(N);
		for (let it = 0; it < 100; it++) {
			let sum = 0;
			for (let j = 0; j < N; j++) sum += row[j] = j === i ? 0 : Math.exp(-beta * d2[j]);
			let H = 0;
			for (let j = 0; j < N; j++) H += beta * d2[j] * (row[j] / sum);
			H += Math.log(sum);
			for (let j = 0; j < N; j++) row[j] /= sum;
			if (Math.abs(H - target) < 1e-5) break;
			if (H > target) {
				lo = beta;
				beta = hi === Infinity ? beta * 2 : (beta + hi) / 2;
			} else {
				hi = beta;
				beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2;
			}
		}
		for (let j = 0; j < N; j++) P[i * N + j] = row[j];
	}
	for (let i = 0; i < N; i++)
		for (let j = i + 1; j < N; j++) {
			const p = Math.max((P[i * N + j] + P[j * N + i]) / (2 * N), 1e-12);
			P[i * N + j] = P[j * N + i] = p;
		}
	const Y = Float64Array.from(Y0.flat());
	const U = new Float64Array(2 * N);
	const gains = new Float64Array(2 * N).fill(1);
	const G = new Float64Array(2 * N);
	const Q = new Float32Array(N * N);
	const eta = Math.max(N / 12, 50);
	for (let it = 0; it < ITERATIONS; it++) {
		const exag = it < 250 ? 12 : 1;
		const mom = it < 250 ? 0.5 : 0.8;
		let Z = 0;
		for (let i = 0; i < N; i++)
			for (let j = i + 1; j < N; j++) {
				const dx = Y[2 * i] - Y[2 * j];
				const dy = Y[2 * i + 1] - Y[2 * j + 1];
				const q = 1 / (1 + dx * dx + dy * dy);
				Q[i * N + j] = q;
				Z += 2 * q;
			}
		G.fill(0);
		for (let i = 0; i < N; i++)
			for (let j = i + 1; j < N; j++) {
				const q = Q[i * N + j];
				const f = 4 * (exag * P[i * N + j] - q / Z) * q;
				const dx = Y[2 * i] - Y[2 * j];
				const dy = Y[2 * i + 1] - Y[2 * j + 1];
				G[2 * i] += f * dx;
				G[2 * i + 1] += f * dy;
				G[2 * j] -= f * dx;
				G[2 * j + 1] -= f * dy;
			}
		for (let k = 0; k < 2 * N; k++) {
			gains[k] = Math.sign(G[k]) !== Math.sign(U[k]) ? gains[k] + 0.2 : gains[k] * 0.8;
			gains[k] = Math.max(gains[k], 0.01);
			U[k] = mom * U[k] - eta * gains[k] * G[k];
			Y[k] += U[k];
		}
		if (it % 100 === 99) {
			let kl = 0;
			for (let i = 0; i < N; i++)
				for (let j = i + 1; j < N; j++) {
					const p = P[i * N + j];
					kl += 2 * p * Math.log(p / Math.max(Q[i * N + j] / Z, 1e-12));
				}
			console.log(`t-SNE iteration ${it + 1}: KL ${kl.toFixed(3)}`);
		}
	}
	return Array.from({ length: N }, (_, i) => [Y[2 * i], Y[2 * i + 1]]);
}

/** Spherical k-means of unit vectors X: a cluster index per row. */
function kmeans(X) {
	const rnd = mulberry32(SEED);
	const centres = [X[Math.floor(rnd() * X.length)]];
	const best = X.map((x) => 1 - dot(x, centres[0]));
	while (centres.length < K) {
		const total = best.reduce((s, d) => s + d * d, 0);
		let r = rnd() * total;
		let pick = 0;
		for (; pick < X.length - 1; pick++) if ((r -= best[pick] * best[pick]) <= 0) break;
		centres.push(X[pick]);
		X.forEach((x, i) => (best[i] = Math.min(best[i], 1 - dot(x, X[pick]))));
	}
	let label = new Uint8Array(X.length);
	for (let round = 0; round < 100; round++) {
		label = Uint8Array.from(X, (x) => {
			let k = 0;
			for (let c = 1; c < K; c++) if (dot(x, centres[c]) > dot(x, centres[k])) k = c;
			return k;
		});
		for (let c = 0; c < K; c++) {
			const sum = new Float64Array(X[0].length);
			X.forEach((x, i) => {
				if (label[i] === c) for (let j = 0; j < sum.length; j++) sum[j] += x[j];
			});
			centres[c] = unit(sum);
		}
	}
	return label;
}

/** Points scaled into int16 with one scale for both axes (the map keeps its shape). */
function int16Map(points) {
	const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
	const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
	const m = Math.max(...points.map((p) => Math.max(Math.abs(p[0] - cx), Math.abs(p[1] - cy))));
	return Int16Array.from(
		points.flatMap((p) => [p[0] - cx, p[1] - cy].map((v) => Math.round((v / m) * 32767)))
	);
}

// ---------------------------------------------------------------- main
const cache = process.argv[2];
if (!cache) throw new Error('usage: node scripts/data/embeddings/build.mjs <cache dir>');
fs.mkdirSync(cache, { recursive: true });
const { lines, offset, size } = await fetchRows(cache);
console.log(`${lines.length} rows fetched`);

const rank = new Map();
const rows = new Map();
lines.forEach((line, i) => {
	const sp = line.indexOf(' ');
	const w = line.slice(0, sp);
	if (!rank.has(w)) {
		rank.set(w, i);
		rows.set(w, line);
	}
});
const missing = EXTRA.filter((w) => !rows.has(w));
if (missing.length) throw new Error('hand-picked words not in the fetched rows: ' + missing);

const chosen = new Set();
for (const line of lines) {
	if (chosen.size >= N_FREQUENT) break;
	const w = line.slice(0, line.indexOf(' '));
	if (/^[a-z]+$/.test(w) && !STOP.has(w)) chosen.add(w);
}
const extraAdded = EXTRA.filter((w) => !chosen.has(w));
for (const w of EXTRA) chosen.add(w);
const words = [...chosen].sort((a, b) => rank.get(a) - rank.get(b));
const N = words.length;
console.log(`${N} words (${N_FREQUENT} frequent + ${extraAdded.length} hand-picked)`);

const D = 100;
const q8 = new Int8Array(N * D);
words.forEach((w, i) => {
	const v = unit(rows.get(w).split(' ').slice(1).map(Number));
	if (v.length !== D) throw new Error(`${w}: ${v.length} dimensions`);
	const m = Math.max(...v.map(Math.abs));
	v.forEach((x, j) => (q8[i * D + j] = Math.round((127 * x) / m)));
});
const X = words.map((_, i) => unit(Array.from(q8.subarray(i * D, (i + 1) * D))));

const pca = pca2(X);
const sd = Math.sqrt(pca.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1], 0) / (2 * N));
console.time('t-SNE');
const map = tsne(
	X,
	pca.map((p) => [(p[0] / sd) * 1e-4, (p[1] / sd) * 1e-4])
);
console.timeEnd('t-SNE');
const clusters = kmeans(X);

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const out = `/**
 * GloVe word vectors: a subset of ${N} words, with two 2-D maps and a clustering. GENERATED by
 * scripts/data/embeddings/build.mjs — do not edit by hand.
 *
 * Source: GloVe "glove.6B" (Wikipedia 2014 + Gigaword 5, 6 billion tokens, 400 000 words),
 * 100-dimensional vectors, from Stanford NLP: https://nlp.stanford.edu/projects/glove/
 * (${ZIP_URL}, ${size} bytes; member ${MEMBER} at byte ${offset}; the first ${FETCH} compressed
 * bytes were fetched, giving the ${lines.length} most frequent words).
 * Citation: Jeffrey Pennington, Richard Socher and Christopher D. Manning. 2014. GloVe: Global
 * Vectors for Word Representation. Proceedings of EMNLP 2014, 1532–1543.
 * Licence: Open Data Commons Public Domain Dedication and License (PDDL) 1.0.
 *
 * Subset: the ${N_FREQUENT} most frequent words made only of lower-case letters that are not on
 * NLTK's English stop-word list, plus ${extraAdded.length} hand-picked everyday words (listed in the
 * script), in GloVe's frequency order.
 * VECTORS: ${N} × ${D} int8, row by row, base64. Each row is the word's vector scaled to unit
 *   length, then quantised by its largest component (round(127 · u / max|u|)); only directions are
 *   kept, so re-normalise after decoding.
 * TSNE, PCA: ${N} × 2 int16 (x, y), base64, one scale per map. PCA: the first two principal
 *   components of the unit vectors. t-SNE: exact, perplexity ${PERPLEXITY}, ${ITERATIONS} iterations,
 *   started from the PCA map. Distances on these maps are distorted; use VECTORS for similarity.
 * CLUSTERS: ${N} cluster indices (0–${K - 1}) from spherical k-means in the full ${D}-D space
 *   (k-means++ seeded with mulberry32(${SEED}), 100 rounds), as a string of base-36 digits.
 */
export const DIMS = ${D};
export const WORDS =
	'${words.join(' ')}';
export const VECTORS =
	'${b64(q8)}';
export const TSNE =
	'${b64(int16Map(map))}';
export const PCA =
	'${b64(int16Map(pca))}';
export const CLUSTERS =
	'${Array.from(clusters, (c) => c.toString(36)).join('')}';
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(`wrote ${OUT} (${(out.length / 1024).toFixed(0)} KiB)`);
