/** Euclidean regular polygons and translation tilings. All geometry is computed, not a picture fixture. */
export interface Point {
	x: number;
	y: number;
}
export const shapeNames: Record<number, string> = {
	3: 'equal-sided triangle',
	4: 'square',
	5: 'regular pentagon',
	6: 'regular hexagon',
	8: 'regular octagon'
};
export function cornerAngle(sides: number): number {
	if (!Number.isInteger(sides) || sides < 3)
		throw new RangeError('A polygon needs at least three sides');
	return (180 * (sides - 2)) / sides;
}
export function cornerFit(sides: number) {
	const angle = cornerAngle(sides);
	const copies = Math.floor((360 + 1e-9) / angle);
	const gap = Math.max(0, 360 - copies * angle);
	return { copies, gap, tiles: gap < 1e-8, overlap: gap < 1e-8 ? 0 : (copies + 1) * angle - 360 };
}
/** A polygon rooted at its first corner, first edge pointing right, then rotated. */
export function polygon(sides: number, side: number, rotation = 0): Point[] {
	cornerAngle(sides);
	let x = 0,
		y = 0;
	const out: Point[] = [];
	for (let k = 0; k < sides; k++) {
		out.push({ x, y });
		const a = rotation + (k * 2 * Math.PI) / sides;
		x += side * Math.cos(a);
		y += side * Math.sin(a);
	}
	return out;
}
export const points = (p: Point[]) => p.map(({ x, y }) => `${x},${y}`).join(' ');
/** A square translated on a square lattice; opposite boundaries are identical translated curves. */
export function bentTile(side: number, bend: number): Point[] {
	const out: Point[] = [{ x: 0, y: 0 }];
	for (let k = 0; k <= 24; k++) {
		const u = k / 24;
		out.push({ x: side + bend * Math.sin(2 * Math.PI * u), y: side * u });
	}
	for (let k = 24; k >= 0; k--) {
		const u = k / 24;
		out.push({ x: bend * Math.sin(2 * Math.PI * u), y: side * u });
	}
	return out;
}
/** Edge-to-edge patches of the three regular tilings; rejected shapes stay separate. */
export function floorTiles(sides: number, size = 58): Point[][] {
	const out: Point[][] = [];
	if (sides === 4) {
		for (let r = 0; r < 5; r++)
			for (let c = 0; c < 8; c++)
				out.push([
					{ x: c * size, y: r * size },
					{ x: (c + 1) * size, y: r * size },
					{ x: (c + 1) * size, y: (r + 1) * size },
					{ x: c * size, y: (r + 1) * size }
				]);
	} else if (sides === 3) {
		const h = (size * Math.sqrt(3)) / 2;
		for (let r = 0; r < 6; r++)
			for (let c = 0; c < 8; c++) {
				const x = c * size + ((r % 2) * size) / 2,
					y = r * h,
					shift = -size / 2;
				out.push([
					{ x, y },
					{ x: x + size, y },
					{ x: x + size / 2, y: y + h }
				]);
				out.push([
					{ x, y },
					{ x: x + shift, y: y + h },
					{ x: x + shift + size, y: y + h }
				]);
			}
	} else if (sides === 6) {
		for (let c = 0; c < 6; c++)
			for (let r = 0; r < 4; r++) {
				const cx = size + c * 1.5 * size,
					cy = size + r * Math.sqrt(3) * size + ((c % 2) * Math.sqrt(3) * size) / 2;
				out.push(
					Array.from({ length: 6 }, (_, k) => ({
						x: cx + size * Math.cos((k * Math.PI) / 3),
						y: cy + size * Math.sin((k * Math.PI) / 3)
					}))
				);
			}
	}
	return out;
}

/** An irregular four-sided tile: no two sides or corners alike. */
export const QUAD: Point[] = [
	{ x: 0, y: 0 },
	{ x: 92, y: 18 },
	{ x: 104, y: 96 },
	{ x: -20, y: 70 }
];
/**
 * Any four-sided tile covers a floor: turn a copy half round about the middle of an edge, and
 * the two fit along that edge. Two such half turns make a slide by a diagonal, so the tile and
 * its turned copy repeat on the lattice of the two diagonals. Each corner point gets one of each
 * of the four different corners, which together make a full turn. Returns the tiles, each with
 * whether it is a turned copy, that lie at least partly inside a width × height window.
 */
export function quadTiles(quad: Point[], width: number, height: number) {
	const [p0, p1, p2, p3] = quad;
	const d1 = { x: p2.x - p0.x, y: p2.y - p0.y };
	const d2 = { x: p3.x - p1.x, y: p3.y - p1.y };
	const turned = quad.map((p) => ({ x: p1.x + p2.x - p.x, y: p1.y + p2.y - p.y }));
	const out: { tile: Point[]; turned: boolean }[] = [];
	for (let i = -12; i <= 12; i++)
		for (let j = -12; j <= 12; j++)
			for (const [shape, isTurned] of [
				[quad, false],
				[turned, true]
			] as const) {
				const tile = shape.map((p) => ({
					x: p.x + i * d1.x + j * d2.x,
					y: p.y + i * d1.y + j * d2.y
				}));
				const xs = tile.map((p) => p.x);
				const ys = tile.map((p) => p.y);
				if (
					Math.max(...xs) > 0 &&
					Math.min(...xs) < width &&
					Math.max(...ys) > 0 &&
					Math.min(...ys) < height
				)
					out.push({ tile, turned: isTurned });
			}
	return out;
}
/** The actual uncovered sector after the largest non-overlapping fan; no arbitrary floor spacing. */
export function cornerGap(sides: number, radius: number): Point[] {
	const fit = cornerFit(sides);
	if (fit.tiles) return [];
	const start = (fit.copies * cornerAngle(sides) * Math.PI) / 180;
	return [
		{ x: 0, y: 0 },
		...Array.from({ length: 17 }, (_, k) => {
			const a = start + ((2 * Math.PI - start) * k) / 16;
			return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
		})
	];
}
