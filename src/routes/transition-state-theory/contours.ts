/**
 * Contour lines of a surface by marching squares, as one SVG path per level (in drawing
 * units). Computed once per surface and map.
 */
import { energy, type Surface } from './leps';

export interface MapBox {
	/** Bond-length ranges shown (Å): r₁ across, r₂ up. */
	r1: [number, number];
	r2: [number, number];
	/** Drawing rectangle. */
	x: number;
	y: number;
	w: number;
	h: number;
}

export const toX = (b: MapBox, r1: number) => b.x + ((r1 - b.r1[0]) / (b.r1[1] - b.r1[0])) * b.w;
export const toY = (b: MapBox, r2: number) =>
	b.y + b.h - ((r2 - b.r2[0]) / (b.r2[1] - b.r2[0])) * b.h;

/**
 * Paths of the levels (eV above `zero`), on an n × n grid. Each cell adds its segments; a
 * segment is "M x y L x y".
 */
export function contours(
	s: Surface,
	box: MapBox,
	levels: number[],
	zero: number,
	n = 120
): { level: number; d: string }[] {
	const vals = new Float64Array((n + 1) * (n + 1));
	const gx = (i: number) => box.r1[0] + ((box.r1[1] - box.r1[0]) * i) / n;
	const gy = (j: number) => box.r2[0] + ((box.r2[1] - box.r2[0]) * j) / n;
	for (let j = 0; j <= n; j++)
		for (let i = 0; i <= n; i++) vals[j * (n + 1) + i] = energy(s, gx(i), gy(j)) - zero;
	const px = (i: number) => box.x + (box.w * i) / n;
	const py = (j: number) => box.y + box.h - (box.h * j) / n;
	const f = (v: number) => v.toFixed(1);
	return levels.map((level) => {
		let d = '';
		for (let j = 0; j < n; j++)
			for (let i = 0; i < n; i++) {
				const a = vals[j * (n + 1) + i],
					b = vals[j * (n + 1) + i + 1],
					c = vals[(j + 1) * (n + 1) + i + 1],
					e = vals[(j + 1) * (n + 1) + i];
				// crossing points on the four edges (bottom, right, top, left)
				const pts: [number, number][] = [];
				const edge = (va: number, vb: number, ax: number, ay: number, bx: number, by: number) => {
					if (va < level !== vb < level) {
						const u = (level - va) / (vb - va);
						pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
					}
				};
				edge(a, b, px(i), py(j), px(i + 1), py(j));
				edge(b, c, px(i + 1), py(j), px(i + 1), py(j + 1));
				edge(c, e, px(i + 1), py(j + 1), px(i), py(j + 1));
				edge(e, a, px(i), py(j + 1), px(i), py(j));
				for (let k = 0; k + 1 < pts.length; k += 2)
					d += `M${f(pts[k][0])} ${f(pts[k][1])}L${f(pts[k + 1][0])} ${f(pts[k + 1][1])}`;
			}
		return { level, d };
	});
}
