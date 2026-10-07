<script lang="ts" module>
	/**
	 * Measured data, shared by every mount of the scene (computed lazily, once).
	 *
	 * Every count is what the algorithms in `sorts.ts` actually do on real rows
	 * (`comparisonsFor`). Two documented exceptions, both in the `machine` chart,
	 * where n reaches 100,000:
	 * - merge sort above 1,000 items is counted with `mergeComparisons` below: the
	 *   same top-down merge sort, merging through a buffer instead of shifting the
	 *   array (the recorded version in `sorts.ts` shifts, which is O(n²) in time and
	 *   takes ~40 s at 100,000 items). Its comparisons are exactly those of
	 *   `run('merge', …)` on the same rows — checked equal for n = 2…10,007 on
	 *   several seeds;
	 * - bubble sort above 2,000 items (5·10⁹ comparisons at 100,000: too slow to
	 *   run in a page) is drawn dashed from n(n − 1)/2. On shuffled rows the
	 *   measured counts are within 0.5 % of it from n = 500 to 4,000 (0.9963 at
	 *   500, 0.9996 at 2,000, 0.9994 at 4,000), and the gap shrinks as n grows.
	 */
	import {
		ALGORITHMS,
		comparisonsFor,
		growth,
		makeInput,
		type Algorithm,
		type Order
	} from '../sorts';

	/** Row sizes of the linear charts (includes the doublings 125 → 1,000 for `bigo`). */
	export const NS = [
		10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000
	];
	const trialsFor = (n: number) => (n <= 100 ? 10 : 3);

	export type Series = Record<Algorithm, number[]>;
	// A plain cache, not reactive state: the counts never change once measured.
	const byOrder: Partial<Record<Order, Series>> = {};
	/** Comparisons of each algorithm at each size of NS (averaged over shuffles). */
	export function countsFor(order: Order): Series {
		let s = byOrder[order];
		if (!s) {
			s = Object.fromEntries(
				ALGORITHMS.map((a) => [a, NS.map((n) => comparisonsFor(a, n, order, trialsFor(n)))])
			) as Series;
			byOrder[order] = s;
		}
		return s;
	}

	/** Top-down merge sort through a buffer: same comparisons as `run('merge', …)`. */
	function mergeComparisons(input: readonly number[]) {
		const a = input.slice();
		const tmp = new Array<number>(a.length);
		let c = 0;
		const sort = (lo: number, hi: number) => {
			if (hi - lo < 1) return;
			const mid = (lo + hi) >> 1;
			sort(lo, mid);
			sort(mid + 1, hi);
			let i = lo;
			let j = mid + 1;
			let k = lo;
			while (i <= mid && j <= hi) {
				c++;
				tmp[k++] = a[j] < a[i] ? a[j++] : a[i++];
			}
			while (i <= mid) tmp[k++] = a[i++];
			while (j <= hi) tmp[k++] = a[j++];
			for (let q = lo; q <= hi; q++) a[q] = tmp[q];
		};
		sort(0, a.length - 1);
		return c;
	}

	export const BUBBLE_EXACT_MAX = 2000;
	export const MACHINE_MAX = 100000;
	export interface Machine {
		n: number[];
		bubble: number[];
		merge: number[];
		/** Index of the last bubble count that was measured (the rest is n(n − 1)/2). */
		lastExact: number;
	}
	let machineData: Machine | null = null;
	/** Shuffled rows from 2 to 100,000 items, 8 sizes per tenfold. */
	export function machine(): Machine {
		if (machineData) return machineData;
		const n: number[] = [];
		const lo = Math.log10(2);
		const hi = Math.log10(MACHINE_MAX);
		for (let k = 0; k <= Math.round((hi - lo) * 8); k++) {
			const v = Math.round(10 ** (lo + ((hi - lo) * k) / Math.round((hi - lo) * 8)));
			if (!n.includes(v)) n.push(v);
		}
		const trials = (v: number) => (v < 100 ? 40 : v <= 500 ? 4 : v <= BUBBLE_EXACT_MAX ? 2 : 1);
		const bubble = n.map((v) =>
			v <= BUBBLE_EXACT_MAX
				? comparisonsFor('bubble', v, 'shuffled', trials(v))
				: growth.quadratic(v)
		);
		const merge = n.map((v) => {
			if (v <= 1000) return comparisonsFor('merge', v, 'shuffled', trials(v));
			// Same rows as comparisonsFor would use (seed s · 7919 + n).
			let total = 0;
			for (let s = 1; s <= trials(v); s++)
				total += mergeComparisons(makeInput(v, 'shuffled', s * 7919 + v));
			return total / trials(v);
		});
		const lastExact = n.filter((v) => v <= BUBBLE_EXACT_MAX).length - 1;
		machineData = { n, bubble, merge, lastExact };
		return machineData;
	}
</script>

<script lang="ts">
	/**
	 * How the number of comparisons grows with the number of items, measured by
	 * running the four algorithms of `sorts.ts`. One scene, four phases:
	 * - `growth`: comparisons against n (10…1,000) for the chosen starting order;
	 * - `bigo`: the doubling experiment (125 → 250 → 500 → 1,000), bubble vs merge;
	 * - `inputs`: small multiples for sorted, shuffled and reversed rows;
	 * - `machine`: running time on a log–log chart, bubble sort on a computer
	 *   `speedup`× faster vs merge sort, and where the two cross.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, niceMax, scale, smoothstep, type Scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const COLOR: Record<Algorithm, string> = {
		bubble: 'var(--sort-bubble)',
		insertion: 'var(--sort-insertion)',
		merge: 'var(--sort-merge)',
		quick: 'var(--sort-quick)'
	};
	const SHORT: Record<Algorithm, string> = {
		bubble: 'Bubble',
		insertion: 'insertion',
		merge: 'merge',
		quick: 'quick'
	};
	const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
	/** Two significant figures, for readouts that are approximate by nature. */
	const sig2 = (v: number) => Number(v.toPrecision(2));
	const about = (v: number) => (v < 10 ? Math.round(v) : sig2(v));
	const last = NS.length - 1;

	type Phase = 'growth' | 'bigo' | 'inputs' | 'machine';
	const phases: Phase[] = ['growth', 'bigo', 'inputs', 'machine'];
	const phase = $derived(String(step.hints?.phase ?? 'growth') as Phase);
	const ORDERS: Order[] = ['shuffled', 'nearly', 'sorted', 'reversed'];
	const order = $derived.by(() => {
		const o = String(params.order ?? 'shuffled') as Order;
		return ORDERS.includes(o) ? o : 'shuffled';
	});
	const speed = $derived(Math.max(1, Number(params.speedup ?? 100) || 100));

	// ---- phase cross-fades ---------------------------------------------------------
	const initial = untrack(() => phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(p === initial ? 1 : 0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived({
		growth: weights.growth.current,
		bigo: weights.bigo.current,
		inputs: weights.inputs.current,
		machine: weights.machine.current
	});

	// ---- helpers ---------------------------------------------------------------------
	/** Spreads label positions (sorted by wanted y) at least `gap` apart inside [lo, hi]. */
	function dodge<T extends { y: number }>(items: T[], gap: number, lo: number, hi: number): T[] {
		const out = items.map((d) => ({ ...d })).sort((a, b) => a.y - b.y);
		for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
		if (out.length && out[out.length - 1].y > hi) {
			out[out.length - 1].y = hi;
			for (let i = out.length - 2; i >= 0; i--) out[i].y = Math.min(out[i].y, out[i + 1].y - gap);
		}
		if (out.length && out[0].y < lo) {
			out[0].y = lo;
			for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
		}
		return out;
	}

	/** Algorithms whose whole series coincide, grouped (so their lines can share the stroke). */
	function groups(s: Series): Algorithm[][] {
		const out: Algorithm[][] = [];
		for (const a of ALGORITHMS) {
			const g = out.find((grp) => s[grp[0]].every((v, i) => v === s[a][i]));
			if (g) g.push(a);
			else out.push([a]);
		}
		return out;
	}
	/** Dash pattern that interleaves the colours of coincident lines. */
	function dash(group: Algorithm[], a: Algorithm, len = 7) {
		const k = group.length;
		if (k < 2) return { array: undefined, offset: 0 };
		return { array: `${len} ${len * (k - 1)}`, offset: -group.indexOf(a) * len };
	}
	function groupName(group: Algorithm[]) {
		if (group.length === 1) return group[0] === 'bubble' ? 'Bubble sort' : `${cap(group[0])} sort`;
		return group.map((a, i) => (i === 0 ? cap(SHORT[a]) : SHORT[a])).join(' = ');
	}
	const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

	function path(xs: number[], ys: number[], sx: Scale, sy: Scale) {
		let d = '';
		for (let i = 0; i < xs.length; i++)
			d += `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
		return d;
	}
	/** Linear interpolation of a series at x (between grid points). */
	function at(xs: number[], ys: number[], x: number) {
		if (x <= xs[0]) return ys[0];
		for (let i = 1; i < xs.length; i++)
			if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
		return ys[ys.length - 1];
	}

	// =================================================================== growth
	const GX0 = 112;
	const GX1 = 728;
	const GY0 = 96;
	const GY1 = 516;
	const target = $derived(countsFor(order));
	const flat = (s: Series) => ALGORITHMS.flatMap((a) => s[a]);
	// The growth counts are only measured when the growth phase is shown (a deep link
	// to another phase must not pay for them).
	const onGrowth = $derived(phase === 'growth');
	const shown = new Tween<number[]>(
		untrack(() => (initial === 'growth' ? flat(countsFor(order)) : [])),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		if (!onGrowth) return;
		const v = flat(target);
		untrack(() =>
			shown.set(v, { duration: reduced || shown.current.length !== v.length ? 0 : 800 })
		);
	});
	const live = $derived.by(() => {
		const v = shown.current.length === ALGORITHMS.length * NS.length ? shown.current : flat(target);
		return Object.fromEntries(
			ALGORITHMS.map((a, k) => [a, v.slice(k * NS.length, (k + 1) * NS.length)])
		) as Series;
	});
	const gMax = $derived(niceMax(Math.max(...flat(target))));
	const gsx = scale([0, 1000], [GX0, GX1]);
	const gsy = $derived(scale([0, gMax], [GY1, GY0]));
	const gGroups = $derived(groups(target));
	// Lines share a dashed stroke only once they really coincide (not while morphing).
	const gLineGroups = $derived(groups(live));
	const gReveal = $derived(reduced ? 1 : smoothstep(0.4, 3.8, t));
	const gTipN = $derived(lerp(NS[0], 1000, gReveal));
	const gDone = $derived(reduced ? 1 : smoothstep(3.6, 4.2, t));
	const gLabels = $derived(
		dodge(
			gGroups.map((g) => ({
				key: g.join('-'),
				group: g,
				y: gsy(at(NS, live[g[0]], gTipN)),
				tipY: gsy(at(NS, live[g[0]], gTipN)),
				value: target[g[0]][last]
			})),
			32,
			GY0 + 4,
			GY1 - 12
		)
	);
	// The gap at 1,000 items between the slow pair and the fast pair (true only when
	// the slow pair is the slow one, i.e. shuffled rows).
	const gap = $derived.by(() => {
		const slow = [target.bubble[last], target.insertion[last]];
		const fast = [target.merge[last], target.quick[last]];
		return {
			lo: Math.min(...slow) / Math.max(...fast),
			hi: Math.max(...slow) / Math.min(...fast),
			fastTop: Math.max(...fast),
			slowBottom: Math.min(...slow)
		};
	});
	const gapOn = $derived(order === 'shuffled' && gap.lo > 2);
	const gapW = new Tween(
		untrack(() => (initial === 'growth' && gapOn ? 1 : 0)),
		{ duration: 500, easing: cubicInOut }
	);
	$effect(() => {
		if (!onGrowth) return;
		const v = gapOn ? 1 : 0;
		untrack(() => gapW.set(v, { duration: reduced ? 0 : 500 }));
	});
	const orderNote = $derived.by((): [string, string, string] => {
		const s = target;
		if (order === 'sorted')
			return [
				'Sorted start, at 1,000 items:',
				`bubble and insertion sort need only ${fmt(s.bubble[last])};`,
				`quick sort hits its worst case, ${fmt(s.quick[last])}.`
			];
		if (order === 'reversed')
			return [
				'Reversed start, at 1,000 items:',
				`bubble, insertion and quick sort compare`,
				`every pair (${fmt(s.bubble[last])}); merge sort needs ${fmt(s.merge[last])}.`
			];
		if (order === 'nearly')
			return [
				'Nearly sorted start, at 1,000 items:',
				`insertion sort needs only ${fmt(s.insertion[last])}; quick sort`,
				`is close to its worst case (${fmt(s.quick[last])}).`
			];
		return [
			'At 1,000 items the slow pair needs',
			`×${Math.round(gap.lo)} to ×${Math.round(gap.hi)} as many comparisons`,
			'as the fast pair.'
		];
	});
	const orderLabel: Record<Order, string> = {
		shuffled: 'shuffled rows (averaged over 3 shuffles, 10 for small rows)',
		nearly: 'nearly sorted rows (averaged over 3 rows, 10 for small rows)',
		sorted: 'rows already sorted',
		reversed: 'rows in reverse order'
	};

	// =================================================================== bigo
	const DOUBLINGS = [125, 250, 500, 1000];
	const dIdx = DOUBLINGS.map((n) => NS.indexOf(n));
	const BY = 430;
	const BH = 250;
	const BW = 46;
	const panels = [
		{ a: 'bubble' as Algorithm, x0: 72, title: 'Bubble sort', big: 'O(n²)', shape: 'n²' },
		{ a: 'merge' as Algorithm, x0: 512, title: 'Merge sort', big: 'O(n log n)', shape: 'n log₂ n' }
	];
	const PW = 376;
	const barX = (x0: number, k: number) => x0 + 48 + (k * (PW - 96)) / 3;
	const refShape = (a: Algorithm, n: number) => (a === 'bubble' ? n * n : n * Math.log2(n));
	const bigo = $derived.by(() => {
		if (w.bigo < 0.001) return [];
		const s = countsFor('shuffled');
		return panels.map((p) => {
			const vals = dIdx.map((i) => s[p.a][i]);
			const max = vals[vals.length - 1];
			const h = (v: number) => (BH * v) / max;
			// Reference shape, matched to the measured count at 125 items.
			const c = vals[0] / refShape(p.a, DOUBLINGS[0]);
			let ref = '';
			for (let u = 0; u <= 3.0001; u += 0.1) {
				const n = DOUBLINGS[0] * 2 ** u;
				const x = barX(p.x0, 0) + (u / 3) * (barX(p.x0, 3) - barX(p.x0, 0));
				ref += `${u ? 'L' : 'M'}${x.toFixed(1)} ${(BY - h(c * refShape(p.a, n))).toFixed(1)}`;
			}
			const ratios = vals.slice(1).map((v, k) => v / vals[k]);
			const refRatios = DOUBLINGS.slice(1).map(
				(n, k) => refShape(p.a, n) / refShape(p.a, DOUBLINGS[k])
			);
			return { ...p, vals, h, ref, ratios, refRatios };
		});
	});
	// Bars grow one doubling at a time; the ratio appears once the next bar is up.
	const barGrow = (k: number) => (reduced ? 1 : smoothstep(0.3 + 0.6 * k, 0.75 + 0.6 * k, t));
	const ratioShow = (k: number) =>
		reduced ? 1 : smoothstep(0.75 + 0.6 * (k + 1), 1.0 + 0.6 * (k + 1), t);
	const refShow = $derived(reduced ? 1 : smoothstep(2.7, 3.3, t));

	// =================================================================== inputs
	const IX = [112, 392, 672];
	const IW = 236;
	const IY0 = 112;
	const IY1 = 350;
	const IORDERS: { o: Order; title: string }[] = [
		{ o: 'sorted', title: 'Already sorted' },
		{ o: 'shuffled', title: 'Shuffled' },
		{ o: 'reversed', title: 'Reversed' }
	];
	const isy = scale([0, 500000], [IY1, IY0]);
	const inputs = $derived.by(() => {
		if (w.inputs < 0.001) return [];
		return IORDERS.map((p, k) => {
			const s = countsFor(p.o);
			const sx = scale([0, 1000], [IX[k], IX[k] + IW]);
			const gs = groups(s);
			const lines = ALGORITHMS.map((a) => {
				const g = gs.find((grp) => grp.includes(a)) ?? [a];
				return { a, d: path(NS, s[a], sx, isy), ...dash(g, a, 6) };
			});
			const rows = ALGORITHMS.map((a) => {
				const v = s[a][last];
				const all = v === growth.quadratic(1000);
				const note = v === 999 ? 'n − 1' : all ? (a === 'quick' ? 'worst case' : 'every pair') : '';
				return { a, v, note };
			});
			return { ...p, k, sx, lines, rows };
		});
	});
	const iReveal = $derived(reduced ? 1 : smoothstep(0.3, 3.0, t));

	// =================================================================== machine
	const MX0 = 112;
	const MX1 = 724;
	const MY0 = 92;
	const MY1 = 470;
	const LN0 = Math.log10(2);
	const LN1 = Math.log10(MACHINE_MAX);
	const LT0 = -3; // 1 ns, in µs
	const LT1 = 10; // 10,000 s, in µs
	const msx = (n: number) => MX0 + ((Math.log10(n) - LN0) / (LN1 - LN0)) * (MX1 - MX0);
	const msy = (us: number) => MY1 - ((Math.log10(us) - LT0) / (LT1 - LT0)) * (MY1 - MY0);
	// The bubble-sort line slides down (and the crossing right) when the speed-up changes.
	const logS = new Tween(
		untrack(() => Math.log10(speed)),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const v = Math.log10(speed);
		untrack(() => logS.set(v, { duration: reduced ? 0 : 800 }));
	});
	const mData = $derived(w.machine < 0.001 ? null : machine());
	const mReveal = $derived(reduced ? 1 : smoothstep(0.3, 2.6, t));
	const mDone = $derived(reduced ? 1 : smoothstep(2.6, 3.2, t));
	/** Time in µs: the slow computer makes one comparison per µs. */
	const mPaths = $derived.by(() => {
		if (!mData) return null;
		const { n, bubble, merge, lastExact } = mData;
		const s = 10 ** logS.current;
		const line = (ys: number[], from: number, to: number) => {
			let d = '';
			for (let i = from; i <= to; i++)
				d += `${i === from ? 'M' : 'L'}${msx(n[i]).toFixed(1)} ${msy(ys[i]).toFixed(1)}`;
			return d;
		};
		const fast = bubble.map((v) => v / s);
		return {
			merge: line(merge, 0, n.length - 1),
			fastExact: line(fast, 0, lastExact),
			fastEst: line(fast, lastExact, n.length - 1),
			slowExact: line(bubble, 0, lastExact),
			slowEst: line(bubble, lastExact, n.length - 1),
			fast,
			s
		};
	});
	/** Where bubble sort (fast computer) and merge sort (slow) take the same time. */
	const crossing = $derived.by(() => {
		if (!mData || !mPaths) return null;
		const { n, merge } = mData;
		const f = mPaths.fast.map((v, i) => Math.log10(v) - Math.log10(merge[i]));
		// The last sign change: small-n averages are noisy and could cross twice.
		let i = n.length - 1;
		while (i >= 0 && f[i] > 0) i--;
		if (i < 0) return { n: n[0], left: true };
		if (i === n.length - 1) return null;
		const u = f[i] === f[i + 1] ? 0 : -f[i] / (f[i + 1] - f[i]);
		const ln = lerp(Math.log10(n[i]), Math.log10(n[i + 1]), clamp(u));
		const lt = lerp(Math.log10(merge[i]), Math.log10(merge[i + 1]), clamp(u));
		return { n: 10 ** ln, us: 10 ** lt, left: false };
	});
	const fmtTime = (us: number) => {
		if (us < 1) return `${sig2(us * 1000)} ns`;
		if (us < 1e3) return `${sig2(us)} µs`;
		if (us < 1e6) return `${sig2(us / 1e3)} ms`;
		if (us < 60e6) return `${sig2(us / 1e6)} s`;
		if (us < 3600e6) return `${sig2(us / 60e6)} min`;
		return `${sig2(us / 3600e6)} h`;
	};
	const mLabels = $derived.by(() => {
		if (!mData || !mPaths) return [];
		const L = mData.n.length - 1;
		const ghost = clamp(logS.current / 0.5);
		const items = [
			{
				key: 'merge',
				y: msy(mData.merge[L]),
				name: 'Merge sort',
				sub: `×1 computer · ${fmtTime(mData.merge[L])}`,
				color: COLOR.merge,
				opacity: 1
			},
			{
				key: 'fast',
				y: msy(mPaths.fast[L]),
				name: 'Bubble sort',
				sub: `×${speed} computer · ${fmtTime(mData.bubble[L] / speed)}`,
				color: COLOR.bubble,
				opacity: 1
			}
		];
		if (ghost > 0.01)
			items.push({
				key: 'slow',
				y: msy(mData.bubble[L]),
				name: 'Bubble sort',
				sub: `×1 computer · ${fmtTime(mData.bubble[L])}`,
				color: COLOR.bubble,
				opacity: 0.55 * ghost
			});
		return dodge(items, 36, MY0 + 6, MY1 - 22);
	});
	const timeTicks = [
		{ us: 1e-3, l: '1 ns' },
		{ us: 1, l: '1 µs' },
		{ us: 1e3, l: '1 ms' },
		{ us: 1e6, l: '1 s' },
		{ us: 60e6, l: '1 min' },
		{ us: 3600e6, l: '1 h' }
	];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; halo?: boolean } = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo ?? true}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet header(title: string, sub: string)}
	{@render txt(48, 40, title, 16, { weight: 600 })}
	{@render txt(48, 62, sub, 13, { muted: true })}
{/snippet}

{#snippet arrowV(x: number, y0: number, y1: number, color: string)}
	<line x1={x} x2={x} y1={y0 - 4} y2={y1 + 4} stroke={color} stroke-width="1.5" />
	<path
		d="M{x - 4} {y0 - 6} L{x} {y0} L{x + 4} {y0 - 6}"
		fill="none"
		stroke={color}
		stroke-width="1.5"
	/>
	<path
		d="M{x - 4} {y1 + 6} L{x} {y1} L{x + 4} {y1 + 6}"
		fill="none"
		stroke={color}
		stroke-width="1.5"
	/>
{/snippet}

<g>
	<defs>
		<clipPath id="growth-reveal-main">
			<rect x={GX0 - 4} y={GY0 - 20} width={(GX1 - GX0) * gReveal + 8} height={GY1 - GY0 + 28} />
		</clipPath>
		<clipPath id="growth-reveal-inputs">
			{#each IX as x (x)}
				<rect x={x - 4} y={IY0 - 10} width={IW * iReveal + 8} height={IY1 - IY0 + 16} />
			{/each}
		</clipPath>
		<clipPath id="growth-reveal-machine">
			<rect x={MX0 - 4} y={MY0 - 10} width={(MX1 - MX0) * mReveal + 8} height={MY1 - MY0 + 16} />
		</clipPath>
	</defs>

	<!-- ============================================================ growth -->
	{#if w.growth > 0.001}
		<g opacity={w.growth}>
			{@render header('Comparisons needed to sort n items', `Measured on ${orderLabel[order]}`)}
			<!-- axes -->
			{#each [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => f * gMax) as v (v)}
				<line x1={GX0} x2={GX1} y1={gsy(v)} y2={gsy(v)} stroke="var(--stage-grid)" />
				{@render txt(GX0 - 8, gsy(v) + 4, fmt(v), 12, { anchor: 'end', muted: true })}
			{/each}
			{#each [0, 200, 400, 600, 800, 1000] as v (v)}
				<line x1={gsx(v)} x2={gsx(v)} y1={GY1} y2={GY1 + 5} stroke="var(--stage-line)" />
				{@render txt(gsx(v), GY1 + 20, fmt(v), 12, { anchor: 'middle', muted: true })}
			{/each}
			<line x1={GX0} x2={GX1} y1={GY1} y2={GY1} stroke="var(--stage-line)" />
			<line x1={GX0} x2={GX0} y1={GY0} y2={GY1} stroke="var(--stage-line)" />
			{@render txt(GX0 - 8, GY0 - 14, 'comparisons', 12, { anchor: 'end', muted: true })}
			{@render txt(GX1, GY1 + 40, 'number of items, n →', 12, { anchor: 'end', muted: true })}

			<!-- lines -->
			<g clip-path="url(#growth-reveal-main)">
				{#each ALGORITHMS as a (a)}
					{@const g = gLineGroups.find((grp) => grp.includes(a)) ?? [a]}
					{@const ds = dash(g, a)}
					<path
						d={path(NS, live[a], gsx, gsy)}
						fill="none"
						stroke={COLOR[a]}
						stroke-width="2.5"
						stroke-linejoin="round"
						stroke-linecap={ds.array ? 'butt' : 'round'}
						stroke-dasharray={ds.array}
						stroke-dashoffset={ds.offset}
					/>
				{/each}
			</g>
			<!-- end labels, following the tips while the lines draw -->
			{#each gLabels as l (l.key)}
				{@const x = gsx(gTipN)}
				{#if Math.abs(l.y - l.tipY) > 3}
					<path
						d="M{x + 3} {l.tipY} L{x + 8} {l.y - 4}"
						fill="none"
						stroke="var(--stage-line)"
						stroke-width="1"
					/>
				{/if}
				<text x={x + 10} y={l.y} class="halo" font-weight="600" style:font-size="13px">
					{#each l.group as a, i (a)}<tspan style:fill={COLOR[a]}
							>{i === 0
								? l.group.length === 1
									? groupName([a])
									: cap(SHORT[a])
								: ` = ${SHORT[a]}`}</tspan
						>{/each}
				</text>
				<g opacity={gDone}>
					{@render txt(
						x + 10,
						l.y + 16,
						`${fmt(l.value)}${l.group.length > 1 ? ' each' : ''}`,
						12,
						{ muted: true }
					)}
				</g>
			{/each}

			<!-- the gap at 1,000 items -->
			<g opacity={gDone * gapW.current}>
				{#if gapOn}
					{@render arrowV(
						GX1 - 16,
						gsy(gap.slowBottom) + 6,
						gsy(gap.fastTop) - 6,
						'var(--stage-ink)'
					)}
					{@render txt(
						GX1 - 26,
						(gsy(gap.slowBottom) + gsy(gap.fastTop)) / 2 + 5,
						`×${Math.round(gap.lo)}–×${Math.round(gap.hi)}`,
						15,
						{ anchor: 'end', weight: 600 }
					)}
				{/if}
			</g>
			<!-- what the chart says at 1,000 items -->
			<g opacity={gDone}>
				<rect
					x={GX0 + 20}
					y={GY0 + 8}
					width="318"
					height="70"
					rx="10"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				{@render txt(GX0 + 36, GY0 + 30, orderNote[0], 13, { weight: 600, halo: false })}
				{@render txt(GX0 + 36, GY0 + 49, orderNote[1], 13, { halo: false })}
				{@render txt(GX0 + 36, GY0 + 67, orderNote[2], 13, { halo: false })}
			</g>
		</g>
	{/if}

	<!-- ============================================================ bigo -->
	{#if w.bigo > 0.001}
		<g opacity={w.bigo}>
			{@render header(
				'Double the input, and compare the work',
				'Comparisons on shuffled rows of 125, 250, 500 and 1,000 items (average of 3 shuffles)'
			)}
			{#each bigo as p (p.a)}
				{@render txt(p.x0, 108, p.title, 15, { weight: 600, color: COLOR[p.a] })}
				{@render txt(p.x0 + (p.a === 'bubble' ? 96 : 88), 108, p.big, 15, { weight: 600 })}
				<line x1={p.x0} x2={p.x0 + PW} y1={BY} y2={BY} stroke="var(--stage-line)" />
				{#each p.vals as v, k (k)}
					{@const g = barGrow(k)}
					{@const x = barX(p.x0, k)}
					<rect
						x={x - BW / 2}
						y={BY - p.h(v) * g}
						width={BW}
						height={p.h(v) * g}
						rx="4"
						fill={COLOR[p.a]}
						opacity="0.85"
					/>
					<g opacity={smoothstep(0.6, 1, g)}>
						{@render txt(x, BY - p.h(v) - 8, fmt(v), 12, { anchor: 'middle', weight: 600 })}
					</g>
					{@render txt(x, BY + 20, fmt(DOUBLINGS[k]), 12, { anchor: 'middle', muted: true })}
				{/each}
				{@render txt(p.x0 + PW / 2, BY + 48, 'items (doubling each time)', 12, {
					anchor: 'middle',
					muted: true
				})}
				<!-- ratio for each doubling, between the item counts -->
				{#each p.ratios as r, k (k)}
					{@const xm = (barX(p.x0, k) + barX(p.x0, k + 1)) / 2}
					<g opacity={ratioShow(k)}>
						<rect
							x={xm - 27}
							y={BY + 5}
							width="54"
							height="22"
							rx="11"
							fill="var(--surface)"
							stroke={COLOR[p.a]}
						/>
						{@render txt(xm, BY + 21, `×${r.toFixed(1)}`, 13, {
							anchor: 'middle',
							weight: 700,
							halo: false
						})}
					</g>
				{/each}
				<!-- reference shape, dashed -->
				<g opacity={refShow}>
					<path
						d={p.ref}
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="1.5"
						stroke-dasharray="5 5"
						opacity="0.6"
					/>
					<line
						x1={p.x0}
						x2={p.x0 + 22}
						y1={BY + 76}
						y2={BY + 76}
						stroke="var(--stage-ink)"
						stroke-width="1.5"
						stroke-dasharray="5 5"
						opacity="0.6"
					/>
					{@render txt(
						p.x0 + 30,
						BY + 80,
						`dashed: the shape ${p.shape}, matched at 125 items (×${p.refRatios
							.map((x) => x.toFixed(1))
							.join(', ×')})`,
						12,
						{ muted: true }
					)}
				</g>
			{/each}
			<g opacity={reduced ? 1 : smoothstep(2.4, 3.0, t)}>
				{@render txt(
					480,
					560,
					'Double the items: bubble sort does ×4 the work, merge sort a bit more than ×2.',
					15,
					{ anchor: 'middle', weight: 600 }
				)}
				{@render txt(480, 582, 'Each chart has its own vertical scale.', 12, {
					anchor: 'middle',
					muted: true
				})}
			</g>
		</g>
	{/if}

	<!-- ============================================================ inputs -->
	{#if w.inputs > 0.001}
		<g opacity={w.inputs}>
			{@render header(
				'Comparisons on three kinds of row',
				'Same axes in all three: 10 to 1,000 items, 0 to 500,000 comparisons'
			)}
			{#each inputs as p (p.o)}
				{@const x0 = IX[p.k]}
				{@render txt(x0, IY0 - 14, p.title, 14, { weight: 600 })}
				{#each [0, 250000, 500000] as v (v)}
					<line x1={x0} x2={x0 + IW} y1={isy(v)} y2={isy(v)} stroke="var(--stage-grid)" />
					{#if p.k === 0}
						{@render txt(x0 - 8, isy(v) + 4, fmt(v), 12, { anchor: 'end', muted: true })}
					{/if}
				{/each}
				<line x1={x0} x2={x0 + IW} y1={IY1} y2={IY1} stroke="var(--stage-line)" />
				<line x1={x0} x2={x0} y1={IY0} y2={IY1} stroke="var(--stage-line)" />
				{#each [0, 500, 1000] as v (v)}
					<line x1={p.sx(v)} x2={p.sx(v)} y1={IY1} y2={IY1 + 4} stroke="var(--stage-line)" />
					{@render txt(p.sx(v), IY1 + 18, fmt(v), 12, {
						anchor: v === 1000 ? 'end' : v === 0 ? 'start' : 'middle',
						muted: true
					})}
				{/each}
				<g clip-path="url(#growth-reveal-inputs)">
					{#each p.lines as l (l.a)}
						<path
							d={l.d}
							fill="none"
							stroke={COLOR[l.a]}
							stroke-width="2.5"
							stroke-linejoin="round"
							stroke-dasharray={l.array}
							stroke-dashoffset={l.offset}
						/>
					{/each}
				</g>
				<!-- counts at 1,000 items -->
				<g opacity={reduced ? 1 : smoothstep(2.6, 3.2, t)}>
					{@render txt(x0, IY1 + 50, 'At 1,000 items:', 12, { muted: true })}
					{#each p.rows as r, i (r.a)}
						{@const y = IY1 + 72 + i * 22}
						<line
							x1={x0}
							x2={x0 + 14}
							y1={y - 4}
							y2={y - 4}
							stroke={COLOR[r.a]}
							stroke-width="3"
							stroke-linecap="round"
						/>
						{@render txt(x0 + 22, y, groupName([r.a]), 13)}
						{@render txt(x0 + 172, y, fmt(r.v), 13, { anchor: 'end', weight: 600 })}
						{#if r.note}
							{@render txt(x0 + 180, y, r.note, 12, { muted: true })}
						{/if}
					{/each}
				</g>
			{/each}
			{@render txt(
				480,
				572,
				'every pair = n(n − 1)/2 comparisons, 499,500 for 1,000 items — also quick sort’s worst case',
				12,
				{
					anchor: 'middle',
					muted: true
				}
			)}
		</g>
	{/if}

	<!-- ============================================================ machine -->
	{#if w.machine > 0.001 && mData && mPaths}
		<g opacity={w.machine}>
			{@render header(
				speed === 1
					? 'Running time: bubble sort and merge sort on the same ×1 computer'
					: `Running time: bubble sort on a ×${speed} computer, merge sort on a ×1 one`,
				'Shuffled rows. Both axes use a log scale: each step is ×10.'
			)}
			{#each timeTicks as tk (tk.l)}
				<line x1={MX0} x2={MX1} y1={msy(tk.us)} y2={msy(tk.us)} stroke="var(--stage-grid)" />
				{@render txt(MX0 - 8, msy(tk.us) + 4, tk.l, 12, { anchor: 'end', muted: true })}
			{/each}
			{#each [10, 100, 1000, 10000, 100000] as v (v)}
				<line x1={msx(v)} x2={msx(v)} y1={MY0} y2={MY1} stroke="var(--stage-grid)" />
				<line x1={msx(v)} x2={msx(v)} y1={MY1} y2={MY1 + 5} stroke="var(--stage-line)" />
				{@render txt(msx(v), MY1 + 20, fmt(v), 12, { anchor: 'middle', muted: true })}
			{/each}
			<line x1={MX0} x2={MX1} y1={MY1} y2={MY1} stroke="var(--stage-line)" />
			<line x1={MX0} x2={MX0} y1={MY0} y2={MY1} stroke="var(--stage-line)" />
			{@render txt(MX0 - 60, MY0 - 16, 'time (log scale)', 12, { muted: true })}
			{@render txt(MX1, MY1 + 40, 'number of items, n (log scale) →', 12, {
				anchor: 'end',
				muted: true
			})}

			<g clip-path="url(#growth-reveal-machine)">
				<!-- bubble sort on the ×1 computer, for reference -->
				<g opacity={0.4 * clamp(logS.current / 0.5)}>
					<path d={mPaths.slowExact} fill="none" stroke={COLOR.bubble} stroke-width="1.5" />
					<path
						d={mPaths.slowEst}
						fill="none"
						stroke={COLOR.bubble}
						stroke-width="1.5"
						stroke-dasharray="2 5"
					/>
				</g>
				<path
					d={mPaths.merge}
					fill="none"
					stroke={COLOR.merge}
					stroke-width="2.75"
					stroke-linejoin="round"
				/>
				<path
					d={mPaths.fastExact}
					fill="none"
					stroke={COLOR.bubble}
					stroke-width="2.75"
					stroke-linejoin="round"
				/>
				<path
					d={mPaths.fastEst}
					fill="none"
					stroke={COLOR.bubble}
					stroke-width="2.75"
					stroke-dasharray="3 6"
					stroke-linecap="round"
				/>
			</g>

			<!-- end labels -->
			<g opacity={mDone}>
				{#each mLabels as l (l.key)}
					<g opacity={l.opacity}>
						{@render txt(MX1 + 12, l.y, l.name, 13, { weight: 600, color: l.color })}
						{@render txt(MX1 + 12, l.y + 16, l.sub, 12, { muted: true })}
					</g>
				{/each}
			</g>

			<!-- the crossing -->
			{#if crossing}
				{@const cx = msx(crossing.n)}
				{@const cy = crossing.left ? MY1 : msy(crossing.us ?? 1)}
				<!-- The card sits where no main line runs: below-right of a crossing on the
				     left half (the lines rise to the right), above-left of one on the right
				     half (merge sort falls away to the left). It slides between the two. -->
				{@const k = smoothstep(0.42, 0.62, (cx - MX0) / (MX1 - MX0))}
				{@const card = {
					x: clamp(lerp(cx + 14, cx - 14 - 236, k), MX0 + 6, MX1 - 236),
					y: clamp(lerp(cy + 22, cy - 22 - 48, k), MY0, MY1 - 56)
				}}
				<g opacity={mDone}>
					{#if !crossing.left}
						<line
							x1={cx}
							x2={cx}
							y1={cy + 7}
							y2={MY1}
							stroke="var(--stage-ink)"
							stroke-width="1.25"
							stroke-dasharray="3 4"
						/>
						<circle
							{cx}
							{cy}
							r="6"
							fill="var(--stage-bg)"
							stroke="var(--stage-ink)"
							stroke-width="2"
						/>
					{/if}
					<rect
						x={card.x}
						y={card.y}
						width="236"
						height="48"
						rx="10"
						fill="var(--surface)"
						stroke="var(--border)"
					/>
					{@render txt(card.x + 14, card.y + 20, 'Merge sort wins beyond', 13, { halo: false })}
					{@render txt(card.x + 14, card.y + 39, `about ${fmt(about(crossing.n))} items`, 15, {
						weight: 700,
						halo: false
					})}
				</g>
			{/if}
			<g opacity={mDone}>
				{@render txt(
					48,
					544,
					'Time if the ×1 computer makes a million comparisons per second; dashed: bubble sort beyond 2,000 items',
					12,
					{ muted: true }
				)}
				{@render txt(
					48,
					562,
					'is too slow to run here, so it is drawn from n(n − 1)/2, which the runs from 500 to 2,000 items match within 0.5 %.',
					12,
					{ muted: true }
				)}
			</g>
		</g>
	{/if}
</g>
