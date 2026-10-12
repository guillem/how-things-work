// Checks the 2 × 2 matrix model behind the linear-transformations explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	add,
	angleOf,
	apply,
	compose,
	det,
	eigen,
	fromColumns,
	iterate,
	mat,
	rank,
	rotation,
	scale,
	shear,
	signedArea,
	vec,
	type Mat,
	type Vec
} from '../src/routes/linear-transformations/matrix';

const close = (v: Vec, w: Vec, digits = 10) => {
	expect(v.x).toBeCloseTo(w.x, digits);
	expect(v.y).toBeCloseTo(w.y, digits);
};
const square = [vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)];
// An F, corners listed anticlockwise: it has no mirror symmetry, so a flip shows.
const F = [
	vec(0, 0),
	vec(0.4, 0),
	vec(0.4, 0.7),
	vec(0.9, 0.7),
	vec(0.9, 1.0),
	vec(0.4, 1.0),
	vec(0.4, 1.3),
	vec(1.1, 1.3),
	vec(1.1, 1.6),
	vec(0, 1.6)
];
const some: Mat[] = [
	mat(1.5, -0.5, 0.5, 1),
	mat(2, 1, 0.5, 1.5),
	mat(0.5, 1.5, 1.5, 0.5),
	mat(-1.2, 0.3, 2.7, -0.4),
	shear(1),
	rotation(30)
];

test('the columns of the matrix are where î and ĵ land', () => {
	for (const m of some) {
		close(apply(m, vec(1, 0)), vec(m.a, m.c));
		close(apply(m, vec(0, 1)), vec(m.b, m.d));
	}
});

test('every vector x·î + y·ĵ lands on x·(where î lands) + y·(where ĵ lands)', () => {
	for (const m of some) {
		const i = apply(m, vec(1, 0));
		const j = apply(m, vec(0, 1));
		for (const [x, y] of [
			[2, 1],
			[-1.5, 0.5],
			[0.3, -2.2]
		]) {
			close(apply(m, vec(x, y)), add(scale(i, x), scale(j, y)));
		}
		// So the two columns pin the matrix down completely.
		expect(fromColumns(i, j)).toEqual(m);
	}
});

test('linear: lines through the origin stay straight and evenly spaced', () => {
	const m = mat(-1.2, 0.3, 2.7, -0.4);
	const v = vec(0.7, -1.1);
	const w = vec(-2, 0.4);
	close(apply(m, add(v, w)), add(apply(m, v), apply(m, w)));
	close(apply(m, scale(v, 3)), scale(apply(m, v), 3));
	close(apply(m, vec(0, 0)), vec(0, 0));
});

test('composing: (A·B)v = A(Bv), and the order matters', () => {
	const A = rotation(90);
	const B = shear(1);
	const v = vec(1.3, -0.7);
	close(apply(compose(A, B), v), apply(A, apply(B, v)));
	close(apply(compose(B, A), v), apply(B, apply(A, v)));
	// Rotate then shear is not shear then rotate.
	const rs = compose(B, A);
	const sr = compose(A, B);
	expect(Math.abs(rs.a - sr.a) + Math.abs(rs.d - sr.d)).toBeGreaterThan(1.9);
	// The products quoted in the narrative.
	close(apply(rs, vec(1, 0)), vec(1, 1));
	close(apply(rs, vec(0, 1)), vec(-1, 0));
	close(apply(sr, vec(1, 0)), vec(0, 1));
	close(apply(sr, vec(0, 1)), vec(-1, 1));
	// Areas multiply.
	for (const m of some)
		for (const n of some) expect(det(compose(m, n))).toBeCloseTo(det(m) * det(n), 10);
});

test('the determinant is the factor by which every area is multiplied', () => {
	for (const m of some) {
		const image = (pts: Vec[]) => pts.map((p) => apply(m, p));
		expect(Math.abs(signedArea(image(square)))).toBeCloseTo(Math.abs(det(m)), 10);
		expect(Math.abs(signedArea(image(F)))).toBeCloseTo(
			Math.abs(det(m)) * Math.abs(signedArea(F)),
			10
		);
	}
	expect(signedArea(square)).toBe(1);
	expect(det(mat(1.5, -0.5, 0.5, 1))).toBeCloseTo(1.75, 12);
});

test('a negative determinant flips the plane over', () => {
	const m = mat(0.5, 1.5, 1.5, 0.5);
	expect(det(m)).toBeCloseTo(-2, 12);
	expect(signedArea(F)).toBeGreaterThan(0);
	expect(signedArea(F.map((p) => apply(m, p)))).toBeLessThan(0);
	// A mirror has determinant −1: it flips without changing areas.
	expect(det(mat(-1, 0, 0, 1))).toBe(-1);
	// î′ now lies anticlockwise of ĵ′ (normally ĵ is a quarter turn anticlockwise of î).
	const turn = angleOf(vec(m.b, m.d)) - angleOf(vec(m.a, m.c));
	expect(turn).toBeLessThan(0);
});

test('a zero determinant squashes the plane onto a line (or a point) and loses information', () => {
	const flat = fromColumns(vec(1, 0.5), vec(2, 1));
	expect(det(flat)).toBe(0);
	expect(rank(flat)).toBe(1);
	// A non-zero vector is sent to the origin…
	close(apply(flat, vec(2, -1)), vec(0, 0));
	// …and two different vectors land on the same point: no way back.
	close(apply(flat, vec(1, 1)), apply(flat, vec(3, 0)));
	// Every image is on the line y = x / 2.
	for (const v of [vec(1, 2), vec(-3, 0.7)]) {
		const w = apply(flat, v);
		expect(w.y).toBeCloseTo(w.x / 2, 12);
	}
	expect(rank(mat(0, 0, 0, 0))).toBe(0);
	expect(rank(mat(1.5, -0.5, 0.5, 1))).toBe(2);
});

test('a rotation keeps areas (det 1) and has no real eigenvector', () => {
	for (const deg of [30, 90, 135]) {
		const r = rotation(deg);
		expect(det(r)).toBeCloseTo(1, 12);
		const e = eigen(r);
		expect(e.kind).toBe('none');
		// Every arrow is turned by the angle: none stays on its own line.
		for (const v of [vec(1, 0), vec(0.3, 2), vec(-1, -1)]) {
			const w = apply(r, v);
			const turn = (((angleOf(w) - angleOf(v)) % 360) + 360) % 360;
			expect(turn).toBeCloseTo(deg, 8);
		}
	}
	// A half turn is the exception: every arrow is reversed, λ = −1 in every direction.
	expect(eigen(mat(-1, 0, 0, -1))).toEqual({ kind: 'all', value: -1 });
});

test('a shear has only one eigen-direction; a uniform scale has every direction', () => {
	const e = eigen(shear(1));
	expect(e.kind).toBe('one');
	if (e.kind !== 'one') return;
	expect(e.pairs[0].value).toBeCloseTo(1, 12);
	close(e.pairs[0].vector, vec(1, 0));
	// ĵ is knocked off its line.
	const j = apply(shear(1), vec(0, 1));
	expect(j.x).toBeCloseTo(1, 12);

	const s = eigen(mat(1.5, 0, 0, 1.5));
	expect(s).toEqual({ kind: 'all', value: 1.5 });
	close(apply(mat(1.5, 0, 0, 1.5), vec(-0.4, 2)), vec(-0.6, 3));
});

test('eigenvectors only stretch: Mv = λv', () => {
	for (const m of [...some, mat(2, 0, 0, 0.5), fromColumns(vec(1, 0.5), vec(2, 1))]) {
		const e = eigen(m);
		if (e.kind === 'two' || e.kind === 'one') {
			for (const p of e.pairs) close(apply(m, p.vector), scale(p.vector, p.value), 9);
		}
	}
	// The example in the narrative: λ = 2.5 along (2, 1) and λ = 1 along (1, −1).
	const e = eigen(mat(2, 1, 0.5, 1.5));
	expect(e.kind).toBe('two');
	if (e.kind !== 'two') return;
	expect(e.pairs[0].value).toBeCloseTo(2.5, 12);
	expect(e.pairs[1].value).toBeCloseTo(1, 12);
	expect(e.pairs[0].vector.y / e.pairs[0].vector.x).toBeCloseTo(0.5, 12);
	expect(e.pairs[1].vector.y / e.pairs[1].vector.x).toBeCloseTo(-1, 12);
	// A flattening matrix: λ = 0 along the direction it squashes to the origin.
	const f = eigen(fromColumns(vec(1, 0.5), vec(2, 1)));
	expect(f.kind).toBe('two');
	if (f.kind !== 'two') return;
	expect(f.pairs[1].value).toBeCloseTo(0, 12);
	expect(f.pairs[1].vector.y / f.pairs[1].vector.x).toBeCloseTo(-0.5, 12);
});

test('applying a matrix again and again turns a vector towards the biggest eigenvalue', () => {
	const m = mat(2, 1, 0.5, 1.5);
	const path = iterate(m, vec(-1, 1.5), 20);
	const last = path[path.length - 1];
	// Lined up with (2, 1)…
	expect(angleOf(last)).toBeCloseTo(angleOf(vec(2, 1)), 3);
	// …and growing by λ = 2.5 each time.
	const prev = path[path.length - 2];
	expect(Math.hypot(last.x, last.y) / Math.hypot(prev.x, prev.y)).toBeCloseTo(2.5, 3);
	// A rotation never settles: the direction keeps turning.
	const r = iterate(rotation(30), vec(1, 0), 3);
	expect(angleOf(r[3])).toBeCloseTo(90, 9);
});
