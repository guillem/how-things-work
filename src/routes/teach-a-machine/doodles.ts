/**
 * The page's ready-made doodles: cats and houses drawn for this page, each put together from
 * wobbly circles and lines the way a quick pen drawing is (a head, two ears, eyes and whiskers; a
 * box, a roof, a door and windows), in many sizes, styles and places on the pad. The wobble is
 * fixed (a seeded random number per doodle), so every visitor sees the same drawings.
 */
import type { Doodle, Example, Label, Point, Stroke } from './model';

/** A small seeded random number generator (mulberry32): the same doodle every time. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Pen = {
	/** A wobbly line through the points (the hand never draws quite straight). */
	line: (...pts: Point[]) => Stroke;
	/** A wobbly ellipse, starting at angle `from` (radians) and going round `turn` of the way. */
	ring: (cx: number, cy: number, rx: number, ry: number, turn?: number, from?: number) => Stroke;
};

function pen(seed: number, wobble: number): Pen {
	const r = random(seed);
	const j = () => (r() - 0.5) * 2 * wobble;
	const clip = (v: number) => Math.min(99, Math.max(1, v));
	const at = (x: number, y: number): Point => [clip(x + j()), clip(y + j())];
	return {
		line: (...pts) => {
			const out: Point[] = [];
			pts.forEach(([x, y], i) => {
				if (i > 0) {
					// One point between each pair, nudged sideways a little.
					const [px, py] = pts[i - 1];
					out.push(at((px + x) / 2, (py + y) / 2));
				}
				out.push(at(x, y));
			});
			return out;
		},
		ring: (cx, cy, rx, ry, turn = 1, from = -Math.PI / 2) => {
			const n = Math.max(6, Math.round(18 * turn));
			const k = 1 + (r() - 0.5) * 0.08;
			return Array.from({ length: n + 1 }, (_, i) => {
				const a = from + (i / n) * turn * Math.PI * 2;
				return at(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry);
			});
		}
	};
}

interface CatStyle {
	/** Centre of the head, and its width. */
	x: number;
	y: number;
	s: number;
	whiskers?: boolean;
	/** A sitting body under the head, with a tail. */
	body?: boolean;
	/** Pointy ears (true) or round ones. */
	pointy?: boolean;
	seed: number;
}

export function cat({
	x,
	y,
	s,
	whiskers = true,
	body = false,
	pointy = true,
	seed
}: CatStyle): Doodle {
	const p = pen(seed, s * 0.03);
	const h = s / 2;
	const strokes: Stroke[] = [p.ring(x, y, h, h * 0.88)];
	for (const side of [-1, 1]) {
		const ear = pointy
			? p.line(
					[x + side * h * 0.85, y - h * 0.45],
					[x + side * h * 0.75, y - h * 1.45],
					[x + side * h * 0.2, y - h * 0.85]
				)
			: p.ring(
					x + side * h * 0.55,
					y - h * 0.85,
					h * 0.32,
					h * 0.32,
					0.6,
					side < 0 ? Math.PI : -0.4
				);
		strokes.push(ear);
		strokes.push(p.line([x + side * h * 0.38, y - h * 0.2], [x + side * h * 0.38, y - h * 0.02]));
		if (whiskers) {
			strokes.push(p.line([x + side * h * 0.35, y + h * 0.3], [x + side * h * 1.35, y + h * 0.15]));
			strokes.push(p.line([x + side * h * 0.35, y + h * 0.42], [x + side * h * 1.3, y + h * 0.6]));
		}
	}
	strokes.push(
		p.line([x - h * 0.12, y + h * 0.18], [x, y + h * 0.3], [x + h * 0.12, y + h * 0.18])
	);
	if (body) {
		strokes.push(p.ring(x, y + h * 2.1, h * 1.05, h * 1.25, 0.82, -Math.PI / 2 + 0.95));
		strokes.push(
			p.line([x + h * 1.0, y + h * 2.9], [x + h * 1.7, y + h * 2.6], [x + h * 1.8, y + h * 1.7])
		);
	}
	return strokes;
}

interface HouseStyle {
	/** Centre of the walls, their width and height. */
	x: number;
	y: number;
	w: number;
	h: number;
	/** How high the roof's tip stands above the walls. */
	roof: number;
	door?: boolean;
	windows?: 0 | 1 | 2;
	chimney?: boolean;
	seed: number;
}

export function house({
	x,
	y,
	w,
	h,
	roof,
	door = true,
	windows = 2,
	chimney = false,
	seed
}: HouseStyle): Doodle {
	const p = pen(seed, Math.max(w, h) * 0.02);
	const l = x - w / 2;
	const r = x + w / 2;
	const t = y - h / 2;
	const b = y + h / 2;
	const strokes: Stroke[] = [
		p.line([l, t], [l, b], [r, b], [r, t]),
		p.line([l - w * 0.08, t], [x, t - roof], [r + w * 0.08, t], [l - w * 0.08, t])
	];
	if (door) {
		const dw = w * 0.2;
		strokes.push(
			p.line([x - dw / 2, b], [x - dw / 2, b - h * 0.5], [x + dw / 2, b - h * 0.5], [x + dw / 2, b])
		);
	}
	const win = (cx: number) => {
		const s = Math.min(w, h) * 0.13;
		const cy = t + h * 0.32;
		strokes.push(
			p.line(
				[cx - s, cy - s],
				[cx + s, cy - s],
				[cx + s, cy + s],
				[cx - s, cy + s],
				[cx - s, cy - s]
			)
		);
	};
	if (windows === 1) win(door ? x + w * 0.3 : x);
	if (windows === 2) {
		win(x - w * 0.28);
		win(x + w * 0.28);
	}
	if (chimney) {
		const cx = x + w * 0.27;
		const base = t - roof * 0.45;
		strokes.push(
			p.line(
				[cx, base],
				[cx, base - roof * 0.45],
				[cx + w * 0.11, base - roof * 0.45],
				[cx + w * 0.11, base - roof * 0.2]
			)
		);
	}
	return strokes;
}

const ex = (label: Label, doodle: Doodle): Example => ({ label, doodle });

/**
 * The pile the machine is shown: cats and houses in different sizes and styles, mostly filling
 * the pad as people do, taking turns. The first two happen to be a sitting cat and a long, low
 * house, so with one example of each the machine has seen only one kind of each.
 */
export const PILE: Example[] = [
	ex('cat', cat({ x: 48, y: 34, s: 40, body: true, whiskers: false, seed: 3 })),
	ex('house', house({ x: 52, y: 62, w: 76, h: 40, roof: 22, chimney: true, seed: 4 })),
	ex('cat', cat({ x: 50, y: 50, s: 52, seed: 1 })),
	ex('house', house({ x: 50, y: 60, w: 60, h: 46, roof: 28, seed: 2 })),
	ex('cat', cat({ x: 54, y: 52, s: 58, pointy: false, seed: 5 })),
	ex('house', house({ x: 46, y: 60, w: 46, h: 52, roof: 30, windows: 1, seed: 6 })),
	ex('cat', cat({ x: 44, y: 54, s: 44, seed: 7 })),
	ex('house', house({ x: 54, y: 54, w: 62, h: 42, roof: 26, chimney: true, seed: 8 })),
	ex('cat', cat({ x: 56, y: 38, s: 36, body: true, seed: 9 })),
	ex('house', house({ x: 50, y: 66, w: 56, h: 36, roof: 24, windows: 0, seed: 10 })),
	ex('cat', cat({ x: 50, y: 46, s: 46, whiskers: false, seed: 11 })),
	ex('house', house({ x: 44, y: 58, w: 52, h: 44, roof: 30, seed: 12 })),
	ex('cat', cat({ x: 52, y: 56, s: 62, seed: 13 })),
	ex('house', house({ x: 50, y: 62, w: 80, h: 46, roof: 20, windows: 2, seed: 14 })),
	ex('cat', cat({ x: 46, y: 36, s: 38, body: true, pointy: false, seed: 15 })),
	ex('house', house({ x: 56, y: 56, w: 54, h: 48, roof: 28, chimney: true, windows: 1, seed: 16 }))
];

/** New drawings the machine never saw, to test it with. */
export const TESTS: Example[] = [
	ex('cat', cat({ x: 50, y: 48, s: 48, seed: 101 })),
	ex('house', house({ x: 50, y: 62, w: 64, h: 42, roof: 24, seed: 102 })),
	ex('cat', cat({ x: 52, y: 36, s: 38, body: true, seed: 103 })),
	ex('house', house({ x: 48, y: 58, w: 50, h: 48, roof: 30, chimney: true, seed: 104 })),
	ex('cat', cat({ x: 52, y: 54, s: 56, pointy: false, whiskers: false, seed: 105 })),
	ex('house', house({ x: 52, y: 60, w: 74, h: 40, roof: 24, windows: 1, seed: 106 })),
	ex('cat', cat({ x: 46, y: 50, s: 42, seed: 107 })),
	ex('house', house({ x: 50, y: 64, w: 54, h: 40, roof: 32, windows: 0, seed: 108 }))
];

/**
 * The trap: every cat drawn small in the top left corner, every house down at the bottom. The
 * labels are right, but where a drawing sits now tells cats from houses as well as its shape does.
 */
export const TRAP: Example[] = [
	ex('cat', cat({ x: 26, y: 26, s: 32, seed: 201 })),
	ex('house', house({ x: 50, y: 78, w: 50, h: 24, roof: 16, seed: 202 })),
	ex('cat', cat({ x: 30, y: 22, s: 28, body: true, whiskers: false, seed: 203 })),
	ex('house', house({ x: 66, y: 76, w: 46, h: 28, roof: 16, chimney: true, seed: 204 })),
	ex('cat', cat({ x: 24, y: 30, s: 34, pointy: false, seed: 205 })),
	ex('house', house({ x: 36, y: 78, w: 44, h: 26, roof: 14, windows: 1, seed: 206 })),
	ex('cat', cat({ x: 32, y: 28, s: 30, seed: 207 })),
	ex('house', house({ x: 56, y: 80, w: 60, h: 22, roof: 14, seed: 208 }))
];

/** More examples for the trap pile, drawn the other way round: cats low down, houses up high. */
export const MIXED: Example[] = [
	ex('cat', cat({ x: 46, y: 72, s: 34, seed: 301 })),
	ex('house', house({ x: 32, y: 32, w: 44, h: 26, roof: 16, seed: 302 })),
	ex('cat', cat({ x: 70, y: 70, s: 32, whiskers: false, seed: 303 })),
	ex('house', house({ x: 62, y: 30, w: 46, h: 28, roof: 16, chimney: true, seed: 304 })),
	ex('cat', cat({ x: 30, y: 74, s: 30, pointy: false, seed: 305 })),
	ex('house', house({ x: 44, y: 28, w: 52, h: 24, roof: 14, windows: 1, seed: 306 })),
	ex('cat', cat({ x: 58, y: 78, s: 28, seed: 307 })),
	ex('house', house({ x: 26, y: 26, w: 40, h: 24, roof: 14, chimney: true, seed: 308 }))
];

/** New drawings to try on the trap pile. */
export const TRAP_TESTS = {
	/** A cat drawn low down, where only houses were drawn. */
	catLow: cat({ x: 56, y: 74, s: 32, seed: 401 }),
	/** A house drawn up high, where only cats were drawn. */
	houseHigh: house({ x: 30, y: 30, w: 40, h: 26, roof: 16, seed: 402 }),
	/** A cat in the top corner, like every cat it was shown. */
	catHigh: cat({ x: 28, y: 26, s: 30, seed: 403 })
};

/** A fish: something it was never shown. */
export function fish(seed: number): Doodle {
	const p = pen(seed, 1);
	return [
		p.ring(46, 50, 26, 16),
		p.line([72, 50], [88, 36], [88, 64], [72, 50]),
		p.line([30, 45], [31, 47]),
		p.line([40, 56], [46, 59], [52, 56])
	];
}
