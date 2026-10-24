import { expect, test } from '@playwright/test';
import {
	bentTile,
	cornerAngle,
	cornerFit,
	floorTiles,
	polygon
} from '../src/routes/shapes-that-tile/model';
test('only triangles, squares and hexagons make a full turn from regular polygon corners', () => {
	const winners = Array.from({ length: 30 }, (_, k) => k + 3).filter((n) => cornerFit(n).tiles);
	expect(winners).toEqual([3, 4, 6]);
	expect([3, 4, 6].map((n) => cornerFit(n).copies)).toEqual([6, 4, 3]);
	expect(cornerFit(5).gap).toBeCloseTo(36);
	expect(cornerFit(8).gap).toBeCloseTo(90);
	expect(cornerFit(5).overlap).toBeCloseTo(72);
});
test('all edges of a rotated regular polygon stay equal', () => {
	for (const n of [3, 4, 5, 6, 8]) {
		const p = polygon(n, 40, 0.7);
		for (let i = 0; i < n; i++)
			expect(Math.hypot(p[i].x - p[(i + 1) % n].x, p[i].y - p[(i + 1) % n].y)).toBeCloseTo(40, 8);
	}
});
test('bending opposite edges preserves area and makes neighbouring boundaries coincide', () => {
	for (const bend of [-25, 0, 25]) {
		const p = bentTile(96, bend);
		let area = 0;
		for (let i = 0; i < p.length; i++) {
			const a = p[i],
				b = p[(i + 1) % p.length];
			area += a.x * b.y - b.x * a.y;
		}
		expect(Math.abs(area) / 2).toBeCloseTo(96 * 96, 7);
		for (let k = 0; k <= 24; k++) {
			const right = p[1 + k],
				left = p[p.length - 1 - k];
			expect(right.x - left.x).toBeCloseTo(96);
			expect(right.y).toBeCloseTo(left.y);
		}
	}
});
test('regular tiling patches cover the area of their triangles and hexagons without changing tile size', () => {
	for (const n of [3, 4, 6]) {
		const patches = floorTiles(n, 58);
		expect(patches.length).toBeGreaterThan(20);
		for (const p of patches) {
			for (let i = 0; i < n; i++)
				expect(Math.hypot(p[i].x - p[(i + 1) % n].x, p[i].y - p[(i + 1) % n].y)).toBeCloseTo(58, 6);
		}
	}
});

test('all three regular floors cover an interior rectangle exactly once', () => {
	function inside(p: { x: number; y: number }, tile: { x: number; y: number }[]) {
		const signs = tile.map((a, i) => {
			const b = tile[(i + 1) % tile.length];
			return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
		});
		return signs.every((v) => v > 1e-8) || signs.every((v) => v < -1e-8);
	}
	for (const n of [3, 4, 6]) {
		const patch = floorTiles(n, 58);
		for (let x = 100.173; x < 340; x += 11.37)
			for (let y = 100.731; y < 240; y += 9.83)
				expect(patch.filter((tile) => inside({ x, y }, tile)).length).toBe(1);
	}
});
test('adjacent fan copies meet along the same edge, without inventing a gap', () => {
	for (const n of [3, 4, 5, 6, 8])
		for (let k = 0; k < cornerFit(n).copies - 1; k++) {
			const before = polygon(n, 40, (k * cornerAngle(n) * Math.PI) / 180),
				after = polygon(n, 40, ((k + 1) * cornerAngle(n) * Math.PI) / 180);
			expect(before[n - 1].x).toBeCloseTo(after[1].x, 8);
			expect(before[n - 1].y).toBeCloseTo(after[1].y, 8);
		}
});
