<script lang="ts">
	/**
	 * A 3 × 3 filter: each cell coloured by its weight (blue positive, orange negative) with the
	 * number on it. When `edit` is given, each cell is a slider: click its upper half (▲) to add
	 * 1, its lower half (▼) to take 1 away, or focus it and use the arrow keys.
	 */
	import { KMAX, KMIN } from '../filters';
	import { fmt } from './shared';

	interface Props {
		x: number;
		y: number;
		cell: number;
		k: readonly number[];
		edit?: (i: number, value: number) => void;
		/** decimals of the numbers on the cells */
		digits?: number;
		size?: number;
	}
	let { x, y, cell, k, edit, digits = 0, size = 16 }: Props = $props();

	const max = $derived(Math.max(1, ...k.map(Math.abs)));
	const clamp = (v: number) => Math.max(KMIN, Math.min(KMAX, Math.round(v)));
	const ROW = ['top', 'middle', 'bottom'];
	const COL = ['left', 'centre', 'right'];

	function click(event: MouseEvent, i: number) {
		if (!edit) return;
		const el = event.currentTarget as SVGGraphicsElement;
		const box = el.getBoundingClientRect();
		const up = event.clientY < box.top + box.height / 2;
		edit(i, clamp(k[i] + (up ? 1 : -1)));
	}
	function key(event: KeyboardEvent, i: number) {
		if (!edit) return;
		const step: Record<string, number> = {
			ArrowUp: 1,
			ArrowRight: 1,
			ArrowDown: -1,
			ArrowLeft: -1
		};
		if (event.key in step) edit(i, clamp(k[i] + step[event.key]));
		else if (event.key === 'Home') edit(i, KMIN);
		else if (event.key === 'End') edit(i, KMAX);
		else if (event.key === '0') edit(i, 0);
		else return;
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<g>
	{#each k as v, i (i)}
		{@const cx = x + (i % 3) * cell}
		{@const cy = y + Math.floor(i / 3) * cell}
		<rect
			x={cx}
			y={cy}
			width={cell}
			height={cell}
			fill={v >= 0 ? 'var(--cv-pos)' : 'var(--cv-neg)'}
			fill-opacity={v === 0 ? 0 : 0.15 + (0.7 * Math.abs(v)) / max}
			stroke="var(--stage-line)"
		/>
		<text
			x={cx + cell / 2}
			y={cy + cell / 2 + size * 0.36}
			text-anchor="middle"
			font-weight="600"
			class="cv-num"
			style:font-size="{size}px">{fmt(v, digits)}</text
		>
		{#if edit}
			<text
				x={cx + cell / 2}
				y={cy + 11}
				text-anchor="middle"
				class="muted"
				style:font-size="9px"
				style:pointer-events="none">▲</text
			>
			<text
				x={cx + cell / 2}
				y={cy + cell - 4}
				text-anchor="middle"
				class="muted"
				style:font-size="9px"
				style:pointer-events="none">▼</text
			>
			<rect
				x={cx}
				y={cy}
				width={cell}
				height={cell}
				fill="transparent"
				class="cv-cell"
				role="slider"
				tabindex="0"
				aria-label="Weight, {ROW[Math.floor(i / 3)]} {COL[i % 3]}"
				aria-valuemin={KMIN}
				aria-valuemax={KMAX}
				aria-valuenow={v}
				data-cell={i}
				onclick={(e) => click(e, i)}
				onkeydown={(e) => key(e, i)}
			/>
		{/if}
	{/each}
	<rect
		{x}
		{y}
		width={cell * 3}
		height={cell * 3}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		rx="2"
	/>
</g>

<style>
	.cv-num {
		fill: var(--stage-ink);
		pointer-events: none;
	}
	.cv-cell {
		cursor: pointer;
		outline: none;
	}
	.cv-cell:focus-visible {
		stroke: var(--cv-window);
		stroke-width: 3;
	}
</style>
