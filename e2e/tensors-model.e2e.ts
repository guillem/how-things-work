// Checks the model behind the tensors explainer: array operations on a real photograph, and the
// transformation rules of arrows and of the stress tensor under a change of axes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	LUMA_601,
	contractLast,
	det,
	get,
	macaw,
	matVec,
	meanOver,
	offset,
	principal,
	reshape,
	shapeText,
	slice,
	stress,
	tensor,
	tensorInAxes,
	trace,
	traction,
	transpose,
	unit,
	vectorInAxes,
	type Mat2,
	type Vec2
} from '../src/routes/tensors/tensor';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const closeVec = (a: Vec2, b: Vec2) => {
	close(a[0], b[0]);
	close(a[1], b[1]);
};
const closeMat = (a: Mat2, b: Mat2) => {
	closeVec(a[0], b[0]);
	closeVec(a[1], b[1]);
};

// The page's example: σxx = 80, σyy = 20, τxy = 30 MPa.
const S = stress(80, 20, 30);

test.describe('arrays', () => {
	test('the photograph is a 48 × 36 × 3 block of 8-bit values, with the parrot red', () => {
		const img = macaw();
		expect(shapeText(img.shape)).toBe('(48, 36, 3)');
		expect(img.data.length).toBe(5184);
		expect(Math.min(...img.data)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...img.data)).toBeLessThanOrEqual(255);
		// Top-left corner: dark foliage. The middle of the body: red well above green and blue.
		const corner = [0, 1, 2].map((c) => get(img, [0, 0, c]));
		expect(Math.max(...corner)).toBeLessThan(60);
		const [r, g, b] = [0, 1, 2].map((c) => get(img, [24, 22, c]));
		expect(r).toBeGreaterThan(150);
		expect(r).toBeGreaterThan(2 * g);
		expect(r).toBeGreaterThan(2 * b);
		// The pixel the physics chapter shows as “just an array”.
		expect([r, g, b]).toEqual([212, 23, 22]);
	});

	test('in the green channel the yellow feathers outshine the leaves', () => {
		// The narrative: with weights 0, 1, 0 the yellow feathers stay bright, the leaves mid-grey.
		const img = macaw();
		const px = Array.from({ length: 48 * 36 }, (_, p) => [0, 1, 2].map((c) => img.data[p * 3 + c]));
		const meanGreen = (a: number[][]) => a.reduce((s, v) => s + v[1], 0) / a.length;
		const leaf = px.filter(([r, g, b]) => g > r && g > b && g > 40);
		const yellow = px.filter(([r, g, b]) => r > 200 && g > 150 && b < 150);
		expect(leaf.length).toBeGreaterThan(100);
		expect(yellow.length).toBeGreaterThan(50);
		expect(meanGreen(yellow)).toBeGreaterThan(meanGreen(leaf) + 50);
		expect(meanGreen(leaf)).toBeLessThan(128);
	});

	test('a slice fixes one index and drops that axis', () => {
		const img = macaw();
		const red = slice(img, 2, 0);
		expect(red.shape).toEqual([48, 36]);
		expect(get(red, [10, 5])).toBe(get(img, [10, 5, 0]));
		const row = slice(img, 0, 30);
		expect(row.shape).toEqual([36, 3]);
		expect(get(row, [7, 2])).toBe(get(img, [30, 7, 2]));
		const col = slice(img, 1, 12);
		expect(col.shape).toEqual([48, 3]);
		// Slice every axis in turn: one number is left, a tensor with no axes.
		const pixel = slice(slice(slice(img, 0, 3), 0, 4), 0, 1);
		expect(pixel.shape).toEqual([]);
		expect(pixel.data[0]).toBe(get(img, [3, 4, 1]));
	});

	test('reshape keeps every number in place in the stored list (row-major)', () => {
		const img = macaw();
		const pixels = reshape(img, [1728, 3]);
		const flat = reshape(img, [5184]);
		for (const [i, j, k] of [
			[0, 0, 0],
			[5, 17, 2],
			[47, 35, 1]
		]) {
			const v = get(img, [i, j, k]);
			expect(get(pixels, [i * 36 + j, k])).toBe(v);
			expect(get(flat, [i * 36 * 3 + j * 3 + k])).toBe(v);
		}
		expect(offset([48, 36, 3], [1, 0, 0])).toBe(108);
		expect(() => reshape(img, [50, 36, 3])).toThrow();
	});

	test('transposing to channels-first is not the same as reshaping to (3, 48, 36)', () => {
		const img = macaw();
		const moved = transpose(img, [2, 0, 1]);
		const reread = reshape(img, [3, 48, 36]);
		expect(moved.shape).toEqual(reread.shape);
		// The transpose's first layer is the red channel...
		expect(Array.from(moved.data.subarray(0, 1728))).toEqual(Array.from(slice(img, 2, 0).data));
		// ...the reshape's first layer mixes red, green and blue of the top 16 rows.
		let differ = 0;
		for (let o = 0; o < moved.data.length; o++) if (moved.data[o] !== reread.data[o]) differ++;
		expect(differ).toBeGreaterThan(moved.data.length / 2);
		expect(get(reread, [0, 0, 1])).toBe(get(img, [0, 0, 1]));
	});

	test('matrix times vector: the shared axis must match and is summed away', () => {
		const m = tensor(
			[3, 4],
			[
				[1, 2, 0, -1],
				[0, 1, 3, 2],
				[2, -1, 1, 0]
			].flat()
		);
		const v = [2, 1, -1, 3];
		const out = matVec(m, v);
		expect(out.shape).toEqual([3]);
		expect(Array.from(out.data)).toEqual([1, 4, 2]);
		expect(() => matVec(m, [1, 2, 3])).toThrow(/don't match/);
	});

	test('grey = the channel axis combined with the luma weights; white stays white', () => {
		expect(LUMA_601.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
		const white = contractLast(tensor([1, 1, 3], [255, 255, 255]), [...LUMA_601]);
		close(white.data[0], 255);
		const grey = contractLast(macaw(), [...LUMA_601]);
		expect(grey.shape).toEqual([48, 36]);
		const img = macaw();
		close(
			get(grey, [24, 22]),
			0.299 * get(img, [24, 22, 0]) + 0.587 * get(img, [24, 22, 1]) + 0.114 * get(img, [24, 22, 2])
		);
	});

	test('averaging over height and width leaves one colour; the parrot photo is reddish', () => {
		const avg = meanOver(macaw(), [0, 1]);
		expect(avg.shape).toEqual([3]);
		const [r, g, b] = avg.data;
		expect(r).toBeGreaterThan(g);
		expect(r).toBeGreaterThan(b);
		const all = meanOver(macaw(), [0, 1, 2]);
		expect(all.shape).toEqual([]);
		close(all.data[0], (r + g + b) / 3, 1e-9);
	});
});

test.describe('physics: changing the axes', () => {
	test('an arrow keeps its length while its components change; 90° swaps them', () => {
		const v: Vec2 = [3, 4];
		for (const deg of [10, 37, 90, 200]) {
			const w = vectorInAxes(v, deg);
			close(Math.hypot(...w), 5);
		}
		// Axes turned a quarter turn anticlockwise: x′ points up, y′ points left.
		closeVec(vectorInAxes(v, 90), [4, -3]);
	});

	test('σ′ = Rᵀ σ R agrees with the Mohr’s-circle formulas of plane stress', () => {
		const [sxx, syy, txy] = [S[0][0], S[1][1], S[0][1]];
		for (const deg of [0, 15, 22.5, 40, 90, 135, -60]) {
			const th = (2 * deg * Math.PI) / 180;
			const m = tensorInAxes(S, deg);
			close(m[0][0], (sxx + syy) / 2 + ((sxx - syy) / 2) * Math.cos(th) + txy * Math.sin(th));
			close(m[1][1], (sxx + syy) / 2 - ((sxx - syy) / 2) * Math.cos(th) - txy * Math.sin(th));
			close(m[0][1], -((sxx - syy) / 2) * Math.sin(th) + txy * Math.cos(th));
			close(m[1][0], m[0][1]);
		}
	});

	test('trace, determinant and principal stresses are the same in every axes', () => {
		for (const deg of [0, 12, 33.3, 77, 150]) {
			const m = tensorInAxes(S, deg);
			close(trace(m), 100);
			close(det(m), 80 * 20 - 30 * 30);
			const p = principal(m);
			close(p.s1, 50 + Math.hypot(30, 30));
			close(p.s2, 50 - Math.hypot(30, 30));
		}
	});

	test('the page’s numbers: principal stresses 92.4 and 7.6 MPa, at 22.5°, where the shear vanishes', () => {
		const p = principal(S);
		expect(p.s1.toFixed(1)).toBe('92.4');
		expect(p.s2.toFixed(1)).toBe('7.6');
		close(p.deg, 22.5);
		const m = tensorInAxes(S, p.deg);
		close(m[0][1], 0);
		close(m[0][0], p.s1);
		close(m[1][1], p.s2);
	});

	test('the traction t = σn is the same arrow in every axes: its new components are σ′n′', () => {
		for (const cut of [0, 30, 110]) {
			const n = unit(cut);
			const t = traction(S, n);
			for (const deg of [20, 45, 160]) {
				closeVec(vectorInAxes(t, deg), traction(tensorInAxes(S, deg), vectorInAxes(n, deg)));
			}
		}
		// A cut facing +x: the traction is the first column of σ, (80, 30) MPa.
		closeVec(traction(S, [1, 0]), [80, 30]);
	});

	test('turning the axes half way round flips an arrow’s components but not the stress’s', () => {
		closeVec(vectorInAxes([3, 4], 180), [-3, -4]);
		closeMat(tensorInAxes(S, 180), S);
	});
});
