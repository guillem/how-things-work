<script lang="ts">
	/**
	 * The reader's message, measured three ways (`step.hints.phase`):
	 *   fixed    — each character with its UTF-8 bits; the size in UTF-8 and with the shortest
	 *              fixed-length code for the symbols used. A read pointer sweeps the tiles.
	 *   surprise — a column per distinct symbol (most common first): its count above, its
	 *              surprise log₂(1/p) below. A callout walks through the symbols.
	 *   entropy  — the same columns, now as wide as their probability, so the area of the
	 *              surprise bars is the average surprise; a level at H rises to show it.
	 * The box writes `params.msg` (see `MessageInput`). The column layout is tweened between
	 * phases; everything else is a function of `t`.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, easeOut } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { fixedBits, messageEntropy, symbolStats, symbolsOf, utf8Bits } from '../compression';
	import MessageInput from './MessageInput.svelte';
	import { fmt, messageOf, show } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'fixed'));
	const tv = $derived(reduced ? 1e6 : t);

	const msg = $derived(messageOf(params));
	const syms = $derived(symbolsOf(msg));
	const n = $derived(syms.length);
	const stats = $derived(symbolStats(msg));
	const k = $derived(stats.length);
	const H = $derived(messageEntropy(msg));
	const utf8 = $derived(utf8Bits(msg));
	const fixed = $derived(fixedBits(k));
	const enc = new TextEncoder();

	// ---- fixed: tiles -----------------------------------------------------------------------
	const PER_ROW = 20;
	const tiles = $derived(
		syms.map((s, i) => {
			const bytes = [...enc.encode(s)];
			const bits = bytes.map((b) => b.toString(2).padStart(8, '0')).join('');
			const lines = (bits.match(/.{4}/g) ?? []).slice(0, 4);
			return {
				i,
				s,
				x: 40 + (i % PER_ROW) * 44,
				y: 134 + Math.floor(i / PER_ROW) * 128,
				lines,
				more: bits.length > 16 ? bits.length - 16 : 0
			};
		})
	);
	const pointer = $derived(reduced || n === 0 ? -1 : Math.floor(tv * 3) % (n + 6));
	const codeRow = $derived(stats.slice(0, PER_ROW));

	// ---- surprise / entropy: columns --------------------------------------------------------
	const X0 = 90;
	const W = 750;
	const BASE = 290; // bottom of the count bars
	const LAB = 312; // symbol labels
	const TOP = 330; // top of the surprise bars
	const maxCount = $derived(Math.max(1, ...stats.map((s) => s.count)));
	const maxBits = $derived(Math.max(1, ...stats.map((s) => s.bits)));
	const countScale = $derived(140 / maxCount);
	const bitScale = $derived(Math.min(34, 140 / maxBits));

	const mosaic = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const target = phase === 'entropy' ? 1 : 0;
		untrack(() => mosaic.set(target, { duration: reduced ? 0 : 800 }));
	});

	const columns = $derived.by(() => {
		const cw = Math.min(70, W / Math.max(1, k));
		let acc = 0;
		return stats.map((s, i) => {
			const uniform = { x: X0 + i * cw + 3, w: cw - 6 };
			const wide = { x: X0 + acc * W + 1, w: Math.max(1, s.p * W - 2) };
			acc += s.p;
			const m = mosaic.current;
			return {
				...s,
				i,
				x: uniform.x + (wide.x - uniform.x) * m,
				w: uniform.w + (wide.w - uniform.w) * m
			};
		});
	});
	const hi = $derived(k === 0 ? -1 : reduced ? 0 : Math.floor(tv / 1.8) % k);
	const grow = $derived(easeOut(clamp(tv / 1.2)));
	const level = $derived(phase === 'entropy' ? easeOut(clamp((tv - 1) / 1.6)) : 0);
	const showNums = $derived(W / Math.max(1, k) >= 30);
	const hiCol = $derived(hi >= 0 ? columns[hi] : undefined);
</script>

<g>
	<Txt x={40} y={14} text="Your message" size={12} weight={700} />
	<MessageInput x={40} y={22} w={600} value={msg} {setParam} presets={phase !== 'fixed'} />

	{#if phase === 'fixed'}
		{#each tiles as tile (tile.i)}
			{@const on = tile.i === pointer}
			<g>
				<rect
					x={tile.x}
					y={tile.y}
					width="40"
					height="116"
					rx="6"
					fill="var(--surface)"
					stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
					stroke-width={on ? 2.5 : 1}
				/>
				<text
					x={tile.x + 20}
					y={tile.y + 30}
					text-anchor="middle"
					style:font-size="22px"
					style:font-weight="600"
					style:font-family="var(--font-mono)">{show(tile.s)}</text
				>
				{#each tile.lines as line, li (li)}
					<text
						x={tile.x + 20}
						y={tile.y + 56 + li * 15}
						text-anchor="middle"
						class="muted"
						style:font-size="11.5px"
						style:font-family="var(--font-mono)">{line}</text
					>
				{/each}
				{#if tile.more}
					<text
						x={tile.x + 20}
						y={tile.y + 112}
						text-anchor="middle"
						class="muted"
						style:font-size="9.5px">+{tile.more}</text
					>
				{/if}
			</g>
		{/each}
		{#if n === 0}
			<Txt x={480} y={240} text="Type something in the box" size={15} anchor="middle" muted />
		{/if}

		{@const rowY = n > PER_ROW ? 410 : 282}
		{#if k > 0}
			<Txt
				x={40}
				y={rowY}
				text="Only {k} different symbol{k === 1 ? '' : 's'}: a fixed {fixed}-bit code is enough"
				size={13}
				weight={700}
			/>
			{#each codeRow as s, i (s.symbol)}
				<g>
					<text
						x={58 + i * 44}
						y={rowY + 26}
						text-anchor="middle"
						style:font-size="15px"
						style:font-weight="600"
						style:font-family="var(--font-mono)">{show(s.symbol)}</text
					>
					<text
						x={58 + i * 44}
						y={rowY + 44}
						text-anchor="middle"
						style:font-size="11.5px"
						style:fill="var(--cmp-count)"
						style:font-family="var(--font-mono)">{i.toString(2).padStart(fixed, '0')}</text
					>
				</g>
			{/each}
			{#if k > PER_ROW}
				<Txt x={40 + PER_ROW * 44} y={rowY + 26} text="…" size={15} muted />
			{/if}
		{/if}

		{#if n > 0}
			<Txt
				x={40}
				y={538}
				text="UTF-8: {n} character{n === 1 ? '' : 's'}{utf8 !== n * 8
					? ` in ${utf8 / 8} bytes`
					: ''} × 8 bits = {utf8} bits"
				size={15}
				weight={600}
			/>
			<Txt
				x={40}
				y={566}
				text="Fixed {fixed}-bit code: {n} × {fixed} = {n * fixed} bits (2{[
					'⁰',
					'¹',
					'²',
					'³',
					'⁴',
					'⁵',
					'⁶'
				][fixed]} = {2 ** fixed} patterns ≥ {k} symbols)"
				size={15}
				weight={600}
				color="var(--cmp-count)"
			/>
		{/if}
	{:else}
		<!-- count bars -->
		<Txt x={40} y={142} text="How often" size={12} weight={700} color="var(--cmp-count)" />
		<!-- surprise gridlines, in bits -->
		{#each Array.from({ length: Math.floor(maxBits) }, (_, b) => b + 1) as b (b)}
			<line
				x1={X0 - 6}
				x2={X0 + W}
				y1={TOP + b * bitScale}
				y2={TOP + b * bitScale}
				stroke="var(--stage-grid)"
			/>
			<Txt x={X0 - 10} y={TOP + b * bitScale + 4} text={String(b)} size={11} anchor="end" muted />
		{/each}
		<Txt x={40} y={TOP + 14} text="bits" size={11} muted />
		{#each columns as c (c.symbol)}
			{@const on = c.i === hi}
			{@const h1 = c.count * countScale * grow}
			{@const h2 = c.bits * bitScale * grow}
			<g opacity={hi < 0 || on ? 1 : 0.6}>
				<rect x={c.x} y={BASE - h1} width={c.w} height={h1} rx="2" fill="var(--cmp-count)" />
				<rect x={c.x} y={TOP} width={c.w} height={h2} rx="2" fill="var(--cmp-bits)" />
				{#if c.w >= 9 || on}
					<text
						x={c.x + c.w / 2}
						y={LAB}
						text-anchor="middle"
						style:font-size="{c.w >= 14 ? 15 : 11}px"
						style:font-weight="600"
						style:font-family="var(--font-mono)">{show(c.symbol)}</text
					>
				{/if}
				{#if showNums && c.w >= 22}
					<Txt
						x={c.x + c.w / 2}
						y={BASE - h1 - 6}
						text={String(c.count)}
						size={11.5}
						anchor="middle"
						color="var(--cmp-count)"
					/>
				{/if}
				{#if showNums && c.w >= 22 && phase === 'surprise'}
					<Txt
						x={c.x + c.w / 2}
						y={TOP + h2 + 14}
						text={fmt(c.bits, 1)}
						size={11.5}
						anchor="middle"
						color="var(--cmp-bits)"
					/>
				{/if}
			</g>
		{/each}

		{#if phase === 'entropy' && level > 0 && n > 0}
			{@const ly = TOP + H * bitScale * level}
			<line
				x1={X0}
				x2={X0 + W + 8}
				y1={ly}
				y2={ly}
				stroke="var(--cmp-h)"
				stroke-width="3"
				stroke-dasharray="8 5"
			/>
			<Txt x={X0 + W + 14} y={ly - 4} text="average" size={12} weight={600} color="var(--cmp-h)" />
			<Txt
				x={X0 + W + 14}
				y={ly + 13}
				text="H = {fmt(H)}"
				size={13}
				weight={700}
				color="var(--cmp-h)"
			/>
		{/if}

		{#if hiCol}
			<Txt
				x={920}
				y={142}
				text="“{show(hiCol.symbol)}”: {hiCol.count} of {n} → p = {fmt(
					hiCol.p,
					3
				)} → log₂(1/p) = {fmt(hiCol.bits)} bits"
				size={13}
				weight={600}
				anchor="end"
			/>
		{/if}

		{#if n === 0}
			<!-- nothing to measure -->
		{:else if phase === 'surprise'}
			<Txt
				x={40}
				y={540}
				text="Surprise = log₂(1/p): the rarer the symbol, the more bits it is worth"
				size={15}
				weight={600}
				color="var(--cmp-bits)"
			/>
			<Txt
				x={40}
				y={566}
				text="Common symbols: few bits. Rare symbols: many bits."
				size={13}
				muted
			/>
		{:else}
			<Txt
				x={40}
				y={540}
				text="Width = how often, height = surprise: spread the orange evenly and it fills up to H = {fmt(
					H
				)} bits"
				size={14}
				weight={600}
			/>
			<Txt
				x={40}
				y={566}
				text="{n} symbols × {fmt(H)} bits = {fmt(
					n * H,
					1
				)} bits: the least any code of single symbols can use"
				size={14}
				weight={600}
				color="var(--cmp-h)"
			/>
		{/if}
		{#if n === 0}
			<Txt x={480} y={240} text="Type something in the box" size={15} anchor="middle" muted />
		{/if}
	{/if}
</g>
