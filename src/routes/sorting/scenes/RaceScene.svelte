<script lang="ts">
	/**
	 * The race: the four algorithms sort the same input side by side, one row
	 * each, all advancing one operation per tick from the same start.
	 *
	 * What a tick is. Only real work counts: a comparison, a swap or a merge
	 * move. The recordings also hold bookkeeping entries (`focus`, `done`) that
	 * mark ranges and finished bars; they cost no tick — they are applied the
	 * moment the next real operation comes up. (Counting them would charge
	 * insertion sort one tick per bar for nothing and make bubble sort beat it
	 * on a nearly sorted row.) So the finishing order is the order of total
	 * operations (comparisons + moves); ties finish on the same tick and share
	 * a place. The counters and the chart on the right show comparisons only,
	 * as the step text says; the footnote on the stage states both rules,
	 * because the two orders can differ (shuffled, 10 bars: quick sort finishes
	 * first with more comparisons than insertion sort).
	 *
	 * Speed. The slider sets ticks per second. A reversed row of 40 bars needs
	 * 1,560 operations from bubble sort — over four minutes at 6/s — so the
	 * race runs ×round((n/16)²) faster for more than ~22 bars, which keeps
	 * the slow (n²) runs at about the same length at every size. The factor is
	 * printed on the stage whenever it is not ×1.
	 *
	 * The clock is a small accumulator (the documented exception in
	 * docs/scene-guide.md: an integral of a rate the reader can change), so that
	 * moving the speed slider mid-race changes the speed without jumping. It
	 * ignores dt ≤ 0 (pause), restarts when the input changes or `t` goes back
	 * (step restart), and is bypassed under reduced motion, where the finished
	 * race is shown.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		ALGORITHMS,
		NAMES,
		makeInput,
		recording,
		type Algorithm,
		type Op,
		type Order
	} from '../sorts';

	let { t, params, reduced }: StageProps = $props();

	const n = $derived(Number(params.size ?? 16));
	const order = $derived(String(params.order ?? 'shuffled') as Order);
	const seed = $derived(1 + 101 * Number(params.shuffle ?? 0));
	const pace = $derived(Number(params.pace ?? 6));
	const factor = $derived(Math.max(1, Math.round((n / 16) ** 2)));
	const rate = $derived(pace * factor);

	const input = $derived(makeInput(n, order, seed));
	const runKey = $derived(`${n}|${order}|${seed}`);

	const COLOR: Record<Algorithm, string> = {
		bubble: 'var(--sort-bubble)',
		insertion: 'var(--sort-insertion)',
		merge: 'var(--sort-merge)',
		quick: 'var(--sort-quick)'
	};

	/** Each recording, with the raw index of every real operation and running comparison counts. */
	const runs = $derived(
		ALGORITHMS.map((algorithm) => {
			const rec = recording(algorithm, input);
			const real: number[] = [];
			const cmp: number[] = [0];
			rec.ops.forEach((o, s) => {
				if (o.kind === 'compare' || o.kind === 'swap' || o.kind === 'move') {
					real.push(s);
					cmp.push(cmp[cmp.length - 1] + (o.kind === 'compare' ? 1 : 0));
				}
			});
			return { algorithm, rec, real, cmp, ticks: real.length };
		})
	);
	const longest = $derived(Math.max(...runs.map((r) => r.ticks)));
	const maxCmp = $derived(Math.max(1, ...runs.map((r) => r.rec.counts.comparisons)));
	const places = $derived(runs.map((r) => 1 + runs.filter((o) => o.ticks < r.ticks).length));

	// ---- the race clock (ticks), see the comment at the top -----------------------
	const LEAD = 0.6;
	let acc = 0;
	let lastT = 0;
	let startT = 0;
	let clockKey = '';
	const k = $derived.by(() => {
		if (reduced) return longest;
		if (runKey !== clockKey || t < lastT) {
			clockKey = runKey;
			acc = 0;
			startT = t;
		} else if (t > lastT) {
			const from = Math.max(lastT, startT + LEAD);
			if (t > from) acc += (t - from) * rate;
		}
		lastT = t;
		acc = Math.min(acc, longest);
		return acc;
	});

	// ---- geometry -------------------------------------------------------------------
	const ROW0 = 78;
	const ROWH = 112;
	const GAP = 8;
	const NAME_X = 40;
	const MEDAL_X = 244;
	const B0 = 284;
	const B1 = 604;
	const C0 = 640;
	const C1 = 872;
	const HMAX = 76;
	const slot = $derived((B1 - B0) / n);
	const barW = $derived(Math.max(3, slot * 0.74));
	const xOf = (p: number) => B0 + slot * (p + 0.5);
	const hOf = (v: number) => 8 + (HMAX - 8) * ((v - 1) / Math.max(1, n - 1));
	const ease = (u: number) => u * u * (3 - 2 * u);
	// Above ~20 operations a second the slides would be a blur: show whole steps.
	const animate = $derived(rate <= 20);

	const plural = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'}`;
	const ordinal = (p: number) => `${p}${p === 1 ? 'st' : p === 2 ? 'nd' : p === 3 ? 'rd' : 'th'}`;

	const rows = $derived(
		runs.map((r, ri) => {
			const y0 = ROW0 + ri * (ROWH + GAP);
			const base = y0 + ROWH - 14;
			const kk = Math.min(k, r.ticks);
			const j = Math.floor(kk);
			const finished = j >= r.ticks;
			const raw = finished ? r.rec.ops.length : r.real[j];
			const frac = finished || !animate ? 0 : kk - j;
			const op: Op | undefined = finished ? undefined : r.rec.ops[raw];
			const values = r.rec.at(raw);
			const done = new Uint8Array(n);
			let pivot: number | undefined;
			for (let s = 0; s < raw; s++) {
				const o = r.rec.ops[s];
				if (o.kind === 'done') for (let p = o.from; p <= o.to; p++) done[p] = 1;
				else if (o.kind === 'focus') pivot = o.pivot;
			}
			if (finished) {
				done.fill(1);
				pivot = undefined;
			}
			if (pivot !== undefined && done[pivot]) pivot = undefined;
			const bars = values.map((v, p) => {
				let x = xOf(p);
				let lift = 0;
				let color = done[p] ? 'var(--sort-done)' : 'var(--sort-bar)';
				if (op?.kind === 'compare' && (op.i === p || op.j === p)) color = 'var(--sort-compare)';
				if (op?.kind === 'swap' && (op.i === p || op.j === p)) {
					const other = op.i === p ? op.j : op.i;
					x += (xOf(other) - xOf(p)) * ease(frac);
					lift = Math.sin(Math.PI * frac) * 8;
					color = 'var(--sort-move)';
				}
				if (op?.kind === 'move') {
					if (p === op.from) {
						x += (xOf(op.to) - xOf(p)) * ease(frac);
						lift = Math.sin(Math.PI * frac) * 10;
						color = 'var(--sort-move)';
					} else if (p >= op.to && p < op.from) x += slot * ease(frac);
				}
				return { p, x, h: hOf(v), color, lift };
			});
			// The operation under way counts once it is half done (at once when not animated).
			const current = op && (kk - j > 0.5 || !animate) ? 1 : 0;
			const comparisons = r.cmp[j] + (op?.kind === 'compare' ? current : 0);
			return {
				...r,
				y0,
				base,
				bars,
				pivot,
				finished,
				comparisons: finished ? r.rec.counts.comparisons : Math.min(comparisons, r.cmp[r.ticks]),
				operations: finished ? r.ticks : Math.min(r.ticks, j + current),
				place: places[ri],
				color: COLOR[r.algorithm]
			};
		})
	);

	const allDone = $derived(k >= longest);
	const tick = $derived(Math.max(...rows.map((r) => r.operations)));
	const speedText = $derived(
		reduced
			? 'Reduced motion: the race is shown finished'
			: factor > 1
				? `${rate} ticks per second: speed ${pace} × ${factor}, sped up so that ${n} bars do not take minutes`
				: `${rate} tick${rate === 1 ? '' : 's'} per second`
	);
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
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

<g opacity={fadeIn}>
	<!-- header -->
	{@render txt(24, 36, `The same ${n} bars for all four · one operation each per tick`, 15, {
		weight: 600
	})}
	{@render txt(24, 58, speedText, 12, { muted: true })}
	{@render txt(936, 36, allDone ? `all finished after ${longest} ticks` : `tick ${tick}`, 14, {
		anchor: 'end',
		weight: 600
	})}
	{@render txt(C0, 70, 'comparisons so far (same scale)', 11, { muted: true })}

	{#each rows as r (r.algorithm)}
		<!-- one lane per algorithm -->
		<rect
			x="20"
			y={r.y0}
			width="920"
			height={ROWH}
			rx="10"
			fill="var(--surface)"
			stroke={r.finished ? r.color : 'var(--border)'}
			stroke-opacity={r.finished ? 0.55 : 1}
		/>
		{@render txt(NAME_X, r.y0 + 30, NAMES[r.algorithm], 16, { color: r.color, weight: 650 })}
		{#if r.finished}
			{@const label = `finished: ${plural(r.comparisons, 'comparison')}`}
			<rect
				x={NAME_X - 6}
				y={r.y0 + 42}
				width={label.length * 6.3 + 12}
				height="22"
				rx="11"
				fill={r.color}
				fill-opacity="0.14"
				stroke={r.color}
			/>
			{@render txt(NAME_X, r.y0 + 57, label, 12, { weight: 600, halo: false })}
			<circle cx={MEDAL_X} cy={r.y0 + ROWH / 2} r="19" fill={r.color} />
			{@render txt(MEDAL_X, r.y0 + ROWH / 2 + 5, ordinal(r.place), 13, {
				anchor: 'middle',
				weight: 700,
				color: 'var(--stage-bg)',
				halo: false
			})}
		{:else}
			{@render txt(NAME_X, r.y0 + 57, plural(r.comparisons, 'comparison'), 14, { weight: 600 })}
		{/if}
		{@render txt(NAME_X, r.y0 + 84, plural(r.operations, 'operation'), 11, { muted: true })}

		<!-- the bars, values hidden -->
		<line x1={B0 - 6} x2={B1 + 6} y1={r.base} y2={r.base} stroke="var(--stage-line)" />
		{#each r.bars as b (b.p)}
			<rect
				x={b.x - barW / 2}
				y={r.base - b.h - b.lift}
				width={barW}
				height={b.h}
				rx={Math.min(3, barW / 3)}
				fill={b.color}
			/>
		{/each}
		{#if r.pivot !== undefined}
			{@const pb = r.bars[r.pivot]}
			<rect
				x={pb.x - barW / 2 - 2}
				y={r.base - pb.h - pb.lift - 2}
				width={barW + 4}
				height={pb.h + 4}
				rx="3"
				fill="none"
				stroke="var(--sort-pivot)"
				stroke-width="1.5"
			/>
		{/if}

		<!-- comparisons so far, on the scale of the largest final count -->
		{@const cy = r.y0 + ROWH / 2}
		{@const w = ((C1 - C0) * r.comparisons) / maxCmp}
		<rect x={C0} y={cy - 9} width={C1 - C0} height="18" rx="4" fill="var(--stage-grid)" />
		<rect x={C0} y={cy - 9} width={Math.max(0, w)} height="18" rx="4" fill={r.color} />
		{@render txt(C0 + w + 8, cy + 5, String(r.comparisons), 13, { weight: 600 })}
	{/each}

	<!-- the rules of the race -->
	{@render txt(
		480,
		580,
		'Place = order of finishing: every comparison or move takes one tick. The counters and the chart count comparisons only.',
		12,
		{ anchor: 'middle', muted: true }
	)}
</g>
