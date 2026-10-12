// Checks the information theory, Huffman coder and JPEG core behind the compression explainer.
// Runs in Node.
import { expect, test } from '@playwright/test';
import {
	LUMA_Q,
	ZIGZAG,
	blockAt,
	bmpDataUrl,
	category,
	codedBits,
	dct,
	decode,
	encode,
	entropy,
	fixedBits,
	huffman,
	huffmanFor,
	idct,
	jpeg,
	kraftSum,
	makeImage,
	messageEntropy,
	psnr,
	qualityTable,
	symbolStats,
	utf8Bits,
	type Grey
} from '../src/routes/compression/compression';

const DEFAULT = 'she sells sea shells by the sea shore';

test.describe('information as surprise', () => {
	test('a fair coin is 1 bit, a fair die log₂ 6, a certain outcome 0', () => {
		expect(entropy([0.5, 0.5])).toBeCloseTo(1, 12);
		expect(entropy(Array<number>(6).fill(1 / 6))).toBeCloseTo(Math.log2(6), 12);
		expect(entropy([1])).toBe(0);
	});

	test('rarer symbols carry more bits', () => {
		const stats = symbolStats(DEFAULT);
		for (let i = 1; i < stats.length; i++)
			expect(stats[i].bits).toBeGreaterThanOrEqual(stats[i - 1].bits);
		// The commonest symbol of the default message ("s", 8 of 37) and a single "b".
		expect(stats[0]).toMatchObject({ symbol: 's', count: 8 });
		expect(stats[0].bits).toBeCloseTo(Math.log2(37 / 8), 12);
		expect(stats.find((s) => s.symbol === 'b')?.bits).toBeCloseTo(Math.log2(37), 12);
	});

	test('a message of one repeated letter has no information; all-different letters the most', () => {
		expect(messageEntropy('aaaaaaaaaaaa')).toBe(0);
		expect(messageEntropy('abcdefghijklmnop')).toBeCloseTo(4, 12);
	});

	test('symbols are characters, not UTF-16 units; the text size counts UTF-8 bytes', () => {
		expect(symbolStats('😀😀').length).toBe(1);
		expect(utf8Bits('abc')).toBe(24);
		expect(utf8Bits('é')).toBe(16);
		expect(utf8Bits('😀')).toBe(32);
	});

	test('a fixed-length code needs ⌈log₂ k⌉ bits for k symbols', () => {
		expect([1, 2, 3, 4, 5, 11, 16, 17].map(fixedBits)).toEqual([1, 1, 2, 2, 3, 4, 4, 5]);
	});
});

test.describe('Huffman coding', () => {
	test('matches the textbook example (Cormen et al., Introduction to Algorithms, §16.3)', () => {
		// a:45 b:13 c:12 d:16 e:9 f:5 (thousands): the optimal code costs 224,000 bits,
		// against 300,000 for a fixed 3-bit code.
		const w = [
			{ symbol: 'a', count: 45 },
			{ symbol: 'b', count: 13 },
			{ symbol: 'c', count: 12 },
			{ symbol: 'd', count: 16 },
			{ symbol: 'e', count: 9 },
			{ symbol: 'f', count: 5 }
		];
		const h = huffman(w);
		expect(codedBits(w, h)).toBe(224);
		expect(w.map((s) => h.codes.get(s.symbol)?.length)).toEqual([1, 3, 3, 3, 4, 4]);
	});

	for (const msg of [
		DEFAULT,
		'abracadabra',
		'aaaaaaaaaaaaaaab',
		'abcdefghijklmnop',
		'naïve café ☕☕'
	]) {
		test(`"${msg}": a complete prefix code, H ≤ L < H + 1, and it decodes back`, () => {
			const h = huffmanFor(msg);
			// Kraft equality: the code leaves no unused branch.
			expect(kraftSum(h)).toBeCloseTo(1, 12);
			// No code word is the start of another.
			const codes = [...h.codes.values()];
			for (const a of codes)
				for (const b of codes) if (a !== b) expect(b.startsWith(a)).toBe(false);
			const bits = encode(msg, h);
			const n = [...msg].length;
			const L = bits.length / n;
			const H = messageEntropy(msg);
			expect(L).toBeGreaterThanOrEqual(H - 1e-12);
			expect(L).toBeLessThan(H + 1);
			expect(decode(bits, h)).toBe(msg);
		});
	}

	test('a single distinct symbol still needs one bit each; an empty message none', () => {
		// Kraft equality and L < H + 1 need two symbols at least: here H = 0 and L = 1.
		const h = huffmanFor('zzzz');
		expect(encode('zzzz', h)).toBe('0000');
		expect(decode('0000', h)).toBe('zzzz');
		expect(encode('', huffmanFor(''))).toBe('');
	});

	test('the default message: Huffman beats the fixed-length code and stays above n·H', () => {
		const h = huffmanFor(DEFAULT);
		const n = 37;
		const bits = encode(DEFAULT, h).length;
		expect(utf8Bits(DEFAULT)).toBe(296);
		expect(n * fixedBits(h.codes.size)).toBe(148);
		expect(bits).toBe(114);
		expect(n * messageEntropy(DEFAULT)).toBeLessThan(bits);
		expect(n * messageEntropy(DEFAULT)).toBeCloseTo(111.4, 1);
	});
});

const flat = (v: number): number[] => Array<number>(64).fill(v);
const rand = (seed: number) => {
	let s = seed;
	return Array.from({ length: 64 }, () => ((s = (s * 1103515245 + 12345) % 2 ** 31), s % 256));
};

test.describe('8 × 8 DCT and quantisation', () => {
	test('without quantisation the DCT is lossless', () => {
		for (const block of [rand(1), rand(2), flat(37)]) {
			const back = idct(dct(block));
			back.forEach((v, i) => expect(v).toBeCloseTo(block[i], 9));
		}
	});

	test('a flat block is all DC: (value − 128) × 8, every other coefficient 0', () => {
		const c = dct(flat(200));
		expect(c[0]).toBeCloseTo((200 - 128) * 8, 9);
		for (let i = 1; i < 64; i++) expect(Math.abs(c[i])).toBeLessThan(1e-9);
		const q = jpeg({ width: 8, height: 8, data: new Uint8Array(flat(200)) }, 10);
		expect(q.kept).toBe(1);
		expect([...q.image.data]).toEqual(flat(200).map(() => q.image.data[0]));
	});

	test('quality 50 is the Annex K table; 100 is all 1s; lower quality, coarser steps', () => {
		expect(qualityTable(50)).toEqual([...LUMA_Q]);
		expect(qualityTable(100)).toEqual(Array<number>(64).fill(1));
		// libjpeg: quality 10 → scale 500 %, so 16 → 80; entries stop at 255.
		expect(qualityTable(10)[0]).toBe(80);
		expect(Math.max(...qualityTable(1))).toBe(255);
	});

	test('zigzag order follows T.81 figure A.6', () => {
		expect(ZIGZAG.slice(0, 10)).toEqual([0, 1, 8, 16, 9, 2, 3, 10, 17, 24]);
		expect(ZIGZAG[63]).toBe(63);
		expect(new Set(ZIGZAG).size).toBe(64);
	});

	test('JPEG size categories (T.81 table F.1)', () => {
		expect([0, 1, -1, 2, 3, -3, 4, 7, 8, 255, -1023].map(category)).toEqual([
			0, 1, 1, 2, 2, 2, 3, 3, 4, 8, 10
		]);
	});

	for (const id of ['landscape', 'drawing', 'noise'] as const) {
		test(`${id}: higher quality keeps more coefficients, more bits and a closer image`, () => {
			const img = makeImage(id);
			const runs = [5, 25, 50, 75, 95].map((q) => jpeg(img, q));
			for (let i = 1; i < runs.length; i++) {
				expect(runs[i].kept).toBeGreaterThanOrEqual(runs[i - 1].kept);
				expect(runs[i].bits).toBeGreaterThan(runs[i - 1].bits);
				expect(psnr(img, runs[i].image)).toBeGreaterThan(psnr(img, runs[i - 1].image));
			}
		});
	}

	test('smooth pictures shrink far more than noise at the same quality', () => {
		const land = jpeg(makeImage('landscape'), 50).bits;
		const noise = jpeg(makeImage('noise'), 50).bits;
		expect(noise / land).toBeGreaterThan(4);
		// The narrative: at quality 50 the hills shrink about 13 times.
		expect((96 * 96 * 8) / land).toBeCloseTo(13, -0.5);
	});

	test('the BMP of an image is a valid data URL of the right size', () => {
		const img: Grey = makeImage('landscape');
		const url = bmpDataUrl(img);
		expect(url.startsWith('data:image/bmp;base64,Qk')).toBe(true);
		const bytes = Buffer.from(url.split(',')[1], 'base64');
		expect(bytes.readUInt32LE(2)).toBe(bytes.length);
		expect(bytes.readInt32LE(18)).toBe(96);
		expect(blockAt(img, 0, 0)).toHaveLength(64);
	});
});
