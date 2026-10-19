/** What the scenes share: colours, number formats, and caches of the model's runs. */
import type { Params } from '#lib/explainer/index.ts';

/** Theme colours (app.css, `--hb-*`). */
export const C = {
	slot: 'var(--hb-slot)',
	slotEdge: 'var(--hb-slot-edge)',
	key: 'var(--hb-key)',
	keySoft: 'var(--hb-key-soft)',
	moved: 'var(--hb-moved)',
	probe: 'var(--hb-probe)',
	probeText: 'var(--hb-probe-text)',
	hit: 'var(--hb-hit)',
	hitText: 'var(--hb-hit-text)',
	miss: 'var(--hb-miss)',
	missText: 'var(--hb-miss-text)',
	bit: 'var(--hb-bit)',
	fp: 'var(--hb-fp)',
	fpText: 'var(--hb-fp-text)',
	absent: 'var(--hb-absent)',
	absentText: 'var(--hb-absent-text)'
};

/** A finite number from a param, clamped to [lo, hi] and rounded. */
export function int(p: Params, id: string, fallback: number, lo: number, hi: number): number {
	const x = Number(p[id]);
	return Math.round(Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : fallback)));
}

export const group = (n: number) => Math.round(n).toLocaleString('en-US');

/** A share as a percentage: "2.2%", "0.35%", "41%". */
export function pct(x: number): string {
	const p = 100 * x;
	if (p === 0) return '0%';
	if (p >= 10) return `${p.toFixed(0)}%`;
	if (p >= 1) return `${p.toFixed(1)}%`;
	return `${p.toFixed(2)}%`;
}

/** A 32-bit hash in hex, "0x1a2b3c4d". */
export const hex = (h: number) => `0x${(h >>> 0).toString(16).padStart(8, '0')}`;

/** Memoises a function of a string key. */
export function memo<T>(f: (key: string) => T, size = 40): (key: string) => T {
	const cache = new Map<string, T>();
	return (key) => {
		let hit = cache.get(key);
		if (hit === undefined) {
			hit = f(key);
			if (cache.size >= size) cache.clear();
			cache.set(key, hit);
		}
		return hit;
	};
}

/** "1 probe", "3 probes". */
export const probes = (n: number) => `${n} probe${n === 1 ? '' : 's'}`;
