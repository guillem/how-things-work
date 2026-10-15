<script lang="ts">
	/**
	 * The standard genetic code (NCBI table 1) as the usual printed table: first letter → band
	 * of rows, second letter → column, third letter → line inside the box. Cells are tinted by
	 * the kind of amino acid; neighbouring codons of the same amino acid merge into one box.
	 * `codon` is outlined (the one being read); `pick` brightens every codon of that amino acid.
	 * With `onpick`, cells are buttons (click, Enter or Space).
	 */
	import { CODE, TABLE_ORDER, amino } from '../genetics';
	import { KIND_COLOR, rna } from './shared';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		/** Codon (DNA letters) to outline. */
		codon?: string;
		/** One-letter amino acid whose codons are brightened. */
		pick?: string;
		size?: number;
		/** Label column and header row, in px. */
		margin?: number;
		onpick?: (codon: string) => void;
		/** Dim the whole table except highlights. */
		quiet?: boolean;
	}
	let {
		x,
		y,
		w,
		h,
		codon = '',
		pick = '',
		size = 12,
		margin = 22,
		onpick,
		quiet = false
	}: Props = $props();

	const cw = $derived((w - margin) / 4);
	const lh = $derived((h - margin) / 16);

	const cells = $derived(
		TABLE_ORDER.flatMap((b1, i) =>
			TABLE_ORDER.flatMap((b2, j) =>
				TABLE_ORDER.map((b3, k) => {
					const c = b1 + b2 + b3;
					const aa = CODE.get(c) ?? '?';
					const above = k > 0 ? CODE.get(b1 + b2 + TABLE_ORDER[k - 1]) : undefined;
					const below = k < 3 ? CODE.get(b1 + b2 + TABLE_ORDER[k + 1]) : undefined;
					return {
						c,
						aa,
						a: amino(aa),
						x: x + margin + j * cw,
						y: y + margin + (i * 4 + k) * lh,
						top: above === aa ? 0 : 1.5,
						bottom: below === aa ? 0 : 1.5
					};
				})
			)
		)
	);

	function onkeydown(event: KeyboardEvent, c: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onpick?.(c);
	}
</script>

{#snippet body(cell: (typeof cells)[number], hi: boolean, on: boolean)}
	<rect
		x={cell.x + 1.5}
		y={cell.y + cell.top}
		width={cw - 3}
		height={lh - cell.top - cell.bottom}
		fill={KIND_COLOR[cell.a.kind]}
		fill-opacity={on || hi ? 0.95 : quiet ? 0.22 : 0.42}
	/>
	<text
		x={cell.x + 6}
		y={cell.y + lh / 2 + size * 0.36}
		font-size={size}
		style:font-family="var(--font-mono)"
		style:font-weight={hi ? 700 : 500}
		opacity={quiet && !on && !hi ? 0.6 : 1}>{rna(cell.c)}</text
	>
	<text
		x={cell.x + cw - 6}
		y={cell.y + lh / 2 + size * 0.36}
		text-anchor="end"
		font-size={size}
		style:font-weight={cell.a.kind === 'stop' || hi || on ? 700 : 500}
		opacity={quiet && !on && !hi ? 0.6 : 1}>{cell.a.three}</text
	>
{/snippet}

<g class="dp-table" class:clickable={!!onpick}>
	<!-- headers: second letter across the top, first letter down the side -->
	{#each TABLE_ORDER as b, j (b)}
		<text
			x={x + margin + j * cw + cw / 2}
			y={y + margin - 7}
			text-anchor="middle"
			class="muted"
			font-size={size}
			style:font-weight="700">{rna(b)}</text
		>
		<text
			x={x + margin / 2 - 2}
			y={y + margin + (j * 4 + 2) * lh + size * 0.35}
			text-anchor="middle"
			class="muted"
			font-size={size + 1}
			style:font-weight="700">{rna(b)}</text
		>
	{/each}
	{#each cells as cell (cell.c)}
		{@const hi = cell.c === codon}
		{@const on = pick !== '' && cell.aa === pick}
		{#if onpick}
			<g
				role="button"
				tabindex="0"
				aria-label="{rna(cell.c)}: {cell.a.name}"
				aria-pressed={on}
				onclick={() => onpick(cell.c)}
				onkeydown={(e) => onkeydown(e, cell.c)}
			>
				{@render body(cell, hi, on)}
			</g>
		{:else}
			{@render body(cell, hi, on)}
		{/if}
	{/each}
	{#each cells.filter((c) => c.c === codon) as cell (cell.c)}
		<rect
			x={cell.x - 1}
			y={cell.y - 1}
			width={cw + 2}
			height={lh + 2}
			rx="3"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
	{/each}
</g>

<style>
	.dp-table text {
		pointer-events: none;
	}
	.clickable g[role='button'] {
		cursor: pointer;
		outline: none;
	}
	.clickable g[role='button']:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
