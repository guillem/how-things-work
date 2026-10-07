<script lang="ts">
	/**
	 * One sorting algorithm on a row of bars, replayed operation by operation.
	 *
	 * The run is recorded once (`recording`) whenever the algorithm or the
	 * input changes; a frame shows the array after the first ⌊k⌋ operations and
	 * animates operation ⌊k⌋ itself (a swap slides two bars past each other, a
	 * merge move slides a bar to the front of the merged part while the bars in
	 * between step aside). `k` comes from `createPlayback`.
	 *
	 * The timeline at the bottom has a draggable marker (a Handle): dragging it
	 * or using its keys pauses playback and moves one operation at a time.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '../playback';
	import { NAMES, makeInput, recording, type Algorithm, type Op, type Order } from '../sorts';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const algorithm = $derived(String(step.hints?.algorithm ?? 'bubble') as Algorithm);
	const intro = $derived(Boolean(step.hints?.intro));
	const n = $derived(offered.has('size') ? Number(params.size) : 10);
	const order = $derived((offered.has('order') ? String(params.order) : 'shuffled') as Order);
	const seed = $derived(1 + 101 * (offered.has('shuffle') ? Number(params.shuffle ?? 0) : 0));
	const pace = $derived(intro ? 2.5 : offered.has('pace') ? Number(params.pace) : 6);
	const playing = $derived(!offered.has('play') || params.play !== false);

	const input = $derived(makeInput(n, order, seed));
	const rec = $derived(recording(algorithm, input));
	const total = $derived(rec.ops.length);
	const runKey = $derived(`${algorithm}|${n}|${order}|${seed}`);

	// ---- playback ------------------------------------------------------------
	const position = createPlayback();
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	// The last position shown, kept for the freeze below (set here rather than
	// in an effect: effects must not read anything that changes every frame).
	let lastK = 0;
	const k = $derived.by(() => {
		const v = reduced ? total : position(t, { key: runKey, playing, pace, manual, total });
		lastK = v;
		return v;
	});

	// Turning "Run by itself" off freezes the replay where it is (unless the
	// scrubber just set the position itself).
	let scrubbed = false;
	$effect(() => {
		if (playing) return;
		untrack(() => {
			if (!scrubbed) setPosition(Math.round(lastK));
			scrubbed = false;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', runKey);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		scrubbed = true;
		if (playing) setParam('play', false);
		setPosition(v);
	}

	// ---- the frame -------------------------------------------------------------
	const index = $derived(Math.min(total, Math.floor(k)));
	const frac = $derived(index >= total ? 0 : k - index);
	const values = $derived(rec.at(index));
	const op = $derived<Op | undefined>(rec.ops[index]);
	const counts = $derived(rec.countAt(index + (op && frac > 0.5 ? 1 : 0)));

	// Positions known to be in their final place, and the latest focus range.
	const state = $derived.by(() => {
		const done = new Uint8Array(n);
		let focus: { lo: number; hi: number; pivot?: number } | null = null;
		for (let s = 0; s < index; s++) {
			const o = rec.ops[s];
			if (o.kind === 'done') for (let p = o.from; p <= o.to; p++) done[p] = 1;
			else if (o.kind === 'focus') focus = o;
		}
		if (index >= total) done.fill(1);
		return { done, focus: index >= total ? null : focus };
	});

	// ---- geometry ----------------------------------------------------------------
	const X0 = 48;
	const X1 = 912;
	const BASE = 420;
	const HMAX = 270;
	const slot = $derived((X1 - X0) / n);
	const barW = $derived(Math.max(4, slot * 0.78));
	const xOf = (p: number) => X0 + slot * (p + 0.5);
	const hOf = (v: number) => 14 + (HMAX - 14) * ((v - 1) / Math.max(1, n - 1));
	const ease = (u: number) => u * u * (3 - 2 * u);

	const bars = $derived(
		values.map((v, p) => {
			let x = xOf(p);
			let h = hOf(v);
			let color = state.done[p] ? 'var(--sort-done)' : 'var(--sort-bar)';
			let lift = 0;
			if (op && index < total) {
				if (op.kind === 'compare' && (op.i === p || op.j === p)) color = 'var(--sort-compare)';
				if (op.kind === 'swap' && (op.i === p || op.j === p)) {
					const other = op.i === p ? op.j : op.i;
					x = xOf(p) + (xOf(other) - xOf(p)) * ease(frac);
					lift = Math.sin(Math.PI * frac) * 14;
					color = 'var(--sort-move)';
				}
				if (op.kind === 'move') {
					if (p === op.from) {
						x = xOf(p) + (xOf(op.to) - xOf(p)) * ease(frac);
						lift = Math.sin(Math.PI * frac) * 18;
						color = 'var(--sort-move)';
					} else if (p >= op.to && p < op.from) {
						x = xOf(p) + slot * ease(frac);
					}
				}
			}
			return { p, v, x, h, color, lift };
		})
	);

	const pivot = $derived(state.focus?.pivot);

	// ---- words for the current operation ------------------------------------------
	const words = $derived.by(() => {
		if (index >= total) return 'Sorted!';
		if (!op) return '';
		const v = values;
		switch (op.kind) {
			case 'compare': {
				const a = v[op.i];
				const b = v[op.j];
				if (algorithm === 'quick')
					return `Compare ${a} with the pivot ${b}: ${a < b ? 'shorter, so it goes to the left part' : 'not shorter, so it stays right'}`;
				if (algorithm === 'merge')
					return `Compare the first bars of the two halves, ${b} and ${a}: the smaller, ${Math.min(a, b)}, goes next`;
				if (algorithm === 'insertion')
					return `Compare ${a} with its left neighbour ${b}: ${a < b ? 'shorter, so it slides left' : 'not shorter, so it has found its place'}`;
				const left = Math.min(op.i, op.j);
				return `Compare neighbours ${v[left]} and ${v[left + 1]}: ${v[left] > v[left + 1] ? 'wrong order, swap' : 'in order, leave them'}`;
			}
			case 'swap':
				return `Swap ${v[op.i]} and ${v[op.j]}`;
			case 'move':
				return `${v[op.from]} moves to the front of the rest`;
			case 'done':
				return op.from === op.to
					? `${v[op.from]} is in its final place`
					: 'These bars are in their final places';
			case 'focus':
				return algorithm === 'merge'
					? `Merge the two sorted halves of positions ${op.lo + 1}–${op.hi + 1}`
					: algorithm === 'quick'
						? `Split positions ${op.lo + 1}–${op.hi + 1} around the pivot ${v[op.pivot ?? op.hi]}`
						: `Take the next bar, ${v[op.hi]}, and slide it into the sorted part`;
		}
	});

	// ---- timeline ----------------------------------------------------------------------
	const TL0 = 96;
	const TL1 = 864;
	const TLY = 532;
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? Math.min(k, total) / total : 0));
	function onmove(p: Point) {
		scrubTo(((p.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(s: number | 'start' | 'end') {
		const base = playing ? Math.round(lastK) : Math.round(manual);
		scrubTo(s === 'start' ? 0 : s === 'end' ? total : base + s);
	}

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g opacity={fadeIn}>
	<!-- header -->
	{@render txt(X0, 48, NAMES[algorithm], 18, { weight: 600 })}
	{@render txt(X0, 74, words, 14, { color: index >= total ? 'var(--sort-done)' : undefined })}
	{@render txt(X1, 48, `${counts.comparisons} comparisons`, 16, {
		anchor: 'end',
		weight: 600,
		color: 'var(--sort-compare)'
	})}
	{@render txt(X1, 72, `${counts.moves} moves`, 13, { anchor: 'end', muted: true })}

	<!-- focus range (merge: the halves being merged; quick: the section being split;
	     insertion: the sorted part) -->
	{#if state.focus}
		{@const f = state.focus}
		<rect
			x={xOf(f.lo) - slot / 2 + 2}
			y={BASE - HMAX - 22}
			width={slot * (f.hi - f.lo + 1) - 4}
			height={HMAX + 22}
			rx="8"
			fill="var(--explainer-accent)"
			opacity="0.07"
		/>
		<path
			d="M{xOf(f.lo) - slot / 2 + 3} {BASE + 30} v6 H{xOf(f.hi) + slot / 2 - 3} v-6"
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="1.5"
		/>
		{@render txt(
			(xOf(f.lo) + xOf(f.hi)) / 2,
			BASE + 54,
			algorithm === 'insertion'
				? 'sorted so far'
				: algorithm === 'merge'
					? 'merging'
					: 'splitting around the pivot',
			12,
			{ anchor: 'middle', color: 'var(--explainer-accent)' }
		)}
	{/if}

	<!-- bars -->
	<line x1={X0 - 8} x2={X1 + 8} y1={BASE} y2={BASE} stroke="var(--stage-line)" />
	{#each bars as b (b.p)}
		<rect
			x={b.x - barW / 2}
			y={BASE - b.h - b.lift}
			width={barW}
			height={b.h}
			rx={Math.min(4, barW / 3)}
			fill={b.color}
		/>
		{#if pivot === b.p}
			<rect
				x={b.x - barW / 2 - 3}
				y={BASE - b.h - 3}
				width={barW + 6}
				height={b.h + 6}
				rx="5"
				fill="none"
				stroke="var(--sort-pivot)"
				stroke-width="2"
			/>
		{/if}
		{#if n <= 24}
			{@render txt(b.x, BASE + 18, String(b.v), n <= 16 ? 12 : 10, {
				anchor: 'middle',
				muted: true
			})}
		{/if}
	{/each}
	{#if pivot !== undefined}
		{@render txt(xOf(pivot), BASE - hOf(values[pivot]) - 12, 'pivot', 12, {
			anchor: 'middle',
			color: 'var(--sort-pivot)',
			weight: 600
		})}
	{/if}

	<!-- legend -->
	{#each [{ c: 'var(--sort-compare)', l: 'compared' }, { c: 'var(--sort-move)', l: 'moved' }, { c: 'var(--sort-done)', l: 'in final place' }] as item, i (item.l)}
		<rect x={X0 + i * 130} y={92} width="12" height="12" rx="3" fill={item.c} />
		{@render txt(X0 + 18 + i * 130, 103, item.l, 12, { muted: true })}
	{/each}

	<!-- timeline -->
	<line
		x1={TL0}
		x2={TL1}
		y1={TLY}
		y2={TLY}
		stroke="var(--stage-grid)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<line
		x1={TL0}
		x2={tlx}
		y1={TLY}
		y2={TLY}
		stroke="var(--explainer-accent)"
		stroke-width="6"
		stroke-linecap="round"
		opacity="0.6"
	/>
	{@render txt(TL0 - 14, TLY + 4, 'start', 11, { anchor: 'end', muted: true })}
	{@render txt(TL1 + 14, TLY + 4, 'end', 11, { muted: true })}
	{@render txt(
		(TL0 + TL1) / 2,
		TLY + 30,
		`operation ${Math.min(total, index + (frac > 0 ? 1 : 0))} of ${total}${playing ? '' : ' · paused: drag or use ← →'}`,
		12,
		{ anchor: 'middle', muted: true }
	)}
	<Handle
		x={tlx}
		y={TLY}
		r={8}
		label="Replay position"
		value={index}
		min={0}
		max={total}
		valuetext="operation {index} of {total}"
		{onmove}
		{onkey}
	/>
</g>
