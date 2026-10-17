/**
 * SVG paths of the leaf and its cells, shared by the leaf view and the cell view
 * (so the two agree where they cross-fade). Micrometres, leaf coordinates.
 * The arrangement is schematic, the sizes measured (see plant.ts).
 */
import {
	grana,
	leaf,
	palisadeCell,
	LEAF,
	THYLAKOID,
	type BoxCell,
	type Chloroplast
} from './plant';
import { rng } from './random';

const L = leaf();
const C = palisadeCell();
const r = rng(4);
export const rect = (b: BoxCell) => {
	const x = b.x - b.w / 2;
	const y = b.y - b.h / 2;
	const k = Math.min(b.r, b.w / 2, b.h / 2);
	return `M${x + k} ${y}H${x + b.w - k}A${k} ${k} 0 0 1 ${x + b.w} ${y + k}V${y + b.h - k}A${k} ${k} 0 0 1 ${x + b.w - k} ${y + b.h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + b.h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
};
export const lens = (x: number, y: number, a: number, b: number, angle: number) => {
	const ca = Math.cos(angle);
	const sa = Math.sin(angle);
	return `M${x - a * ca} ${y - a * sa}A${a} ${b} ${(angle * 180) / Math.PI} 1 0 ${x + a * ca} ${y + a * sa}A${a} ${b} ${(angle * 180) / Math.PI} 1 0 ${x - a * ca} ${y - a * sa}Z`;
};
const others = L.palisade.filter((b) => Math.abs(b.x) > 1);
export const palisadePath = others.map(rect).join('');
export const epidermis = [...L.upper, ...L.lower].map(rect).join('');
export const spongy = L.spongy
	.map(
		(d) =>
			`M${d.x - d.r} ${d.y}a${d.r} ${d.r} 0 1 0 ${2 * d.r} 0a${d.r} ${d.r} 0 1 0 ${-2 * d.r} 0Z`
	)
	.join('');
// chloroplasts: along the long walls of each palisade cell, around each spongy cell
let chlAll = '';
for (const b of others) {
	for (let y = b.y - b.h / 2 + 5; y < b.y + b.h / 2 - 4; y += 5.25)
		for (const s of [-1, 1])
			chlAll += lens(b.x + s * (b.w / 2 - 1.6), y + r.range(-0.4, 0.4), 2.4, 1.2, Math.PI / 2);
	chlAll += lens(b.x, b.y - b.h / 2 + 1.6, 2.4, 1.2, 0);
}
for (const d of L.spongy) {
	const n = Math.floor((2 * Math.PI * (d.r - 1.6)) / 6);
	const a0 = r.range(0, 6.28);
	for (let k = 0; k < n; k++) {
		const a = a0 + (k / n) * Math.PI * 2;
		chlAll += lens(
			d.x + (d.r - 1.6) * Math.cos(a),
			d.y + (d.r - 1.6) * Math.sin(a),
			2.4,
			1.2,
			a + Math.PI / 2
		);
	}
}
// the target cell exactly as its own view draws it
export const target = rect(C.box);
export const targetChl = C.chloroplasts.map((c) => lens(c.x, c.y, c.a, c.b, c.angle)).join('');
export const nuclei = L.palisade
	.filter((b) => Math.abs(b.x) > 1)
	.map((b, i) =>
		i % 2 ? `M${b.x + b.w / 2 - 6.3} ${b.y + 4}a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0Z` : ''
	)
	.join('');
export const top = -LEAF.thickness / 2;
export const guard = L.stomata
	.map((x) => {
		const y = -top - LEAF.epidermis / 2;
		return `M${x - 9} ${y}a4.5 3 0 1 0 9 0a4.5 3 0 1 0 -9 0ZM${x} ${y}a4.5 3 0 1 0 9 0a4.5 3 0 1 0 -9 0Z`;
	})
	.join('');

export const chl = chlAll;
export const L0 = L;
export const C0 = C;

// ---- inside a chloroplast ---------------------------------------------------------------------

interface ChloroplastPaths {
	/** Grana as solid blocks (for distant views). */
	blocks: string;
	/** Each thylakoid as a rounded bar (lumen + membranes), for close views. */
	thylakoids: string;
	/** Stroma lamellae: single thylakoids joining the grana. */
	lamellae: string;
	starch: string;
	globules: string;
}

const cache = new Map<number, ChloroplastPaths>();

/**
 * The inside of chloroplast `i` of the target cell, in leaf micrometres. Grana
 * are stacks of thylakoids repeating every 22.4 nm (4.9 nm membrane, 9 nm lumen,
 * 3.6 nm gap); the middle thylakoid of the centre granum of the target
 * chloroplast leaves its stack as a straight lamella to the right, where the
 * thylakoid view looks.
 */
export function chloroplastPaths(i: number): ChloroplastPaths {
	const hit = cache.get(i);
	if (hit) return hit;
	const c: Chloroplast = C.chloroplasts[i];
	const gs = grana(i === 0 ? 11 : 200 + i, c);
	const ca = Math.cos(c.angle);
	const sa = Math.sin(c.angle);
	const at = (u: number, v: number) =>
		`${(c.x + u * ca - v * sa).toFixed(4)} ${(c.y + u * sa + v * ca).toFixed(4)}`;
	const R = THYLAKOID.repeat;
	const half = (THYLAKOID.lumen + THYLAKOID.membrane) / 2;
	const bar = (u0: number, u1: number, v: number) =>
		`M${at(u0 + half, v - half)}L${at(u1 - half, v - half)}A${half} ${half} 0 0 1 ${at(u1 - half, v + half)}L${at(u0 + half, v + half)}A${half} ${half} 0 0 1 ${at(u0 + half, v - half)}Z`;
	let blocks = '';
	let thylakoids = '';
	let lamellae = '';
	const rows = [-1, 0, 1].map((row) =>
		gs
			.map((g, k) => ({ ...g, k }))
			.filter((g) => g.row === row)
			.sort((a, b) => a.u - b.u)
	);
	for (const g of gs) {
		const h = g.n * R;
		blocks += `M${at(g.u - g.w / 2, g.v - h / 2)}L${at(g.u + g.w / 2, g.v - h / 2)}L${at(g.u + g.w / 2, g.v + h / 2)}L${at(g.u - g.w / 2, g.v + h / 2)}Z`;
		for (let k = 0; k < g.n; k++)
			thylakoids += bar(g.u - g.w / 2, g.u + g.w / 2, g.v + (k - (g.n - 1) / 2) * R);
	}
	for (const sorted of rows)
		for (let j = 0; j + 1 < sorted.length; j++) {
			const a = sorted[j];
			const b = sorted[j + 1];
			const va = a.k === 0 ? a.v + 0.5 * R : a.v + (((a.n / 2) | 0) - (a.n - 1) / 2) * R;
			const vb = b.v + (((b.n / 2) | 0) - (b.n - 1) / 2) * R;
			const u0 = a.u + a.w / 2;
			const u1 = b.u - b.w / 2;
			lamellae += `M${at(u0, va)}L${at(u0 + Math.min(0.16, (u1 - u0) / 2), va)}L${at(u1, vb)}`;
			// a second lamella between neighbours, lower in the stacks
			if (a.n > 6 && b.n > 6) lamellae += `M${at(u0, a.v - 2 * R)}L${at(u1, b.v - 2.5 * R)}`;
		}
	const su = -c.a * 0.3;
	const sv = c.b * 0.31;
	const deg = (c.angle * 180) / Math.PI;
	const starch = `M${at(su - 0.45, sv)}A0.45 0.19 ${deg} 1 0 ${at(su + 0.45, sv)}A0.45 0.19 ${deg} 1 0 ${at(su - 0.45, sv)}Z`;
	const globules = [
		[c.a * 0.55, -c.b * 0.45],
		[c.a * 0.62, c.b * 0.35],
		[-c.a * 0.2, -c.b * 0.6]
	]
		.map(([u, v]) => `M${at(u - 0.04, v)}a0.04 0.04 0 1 0 0.08 0a0.04 0.04 0 1 0 -0.08 0Z`)
		.join('');
	const out = { blocks, thylakoids, lamellae, starch, globules };
	cache.set(i, out);
	return out;
}
