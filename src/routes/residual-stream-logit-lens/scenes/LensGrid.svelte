<script lang="ts">
	/**
	 * The logit-lens grid: one row per depth (row 0 the embedding, row L after block L), one column
	 * per word of the prompt; each cell the lens's top guess for the next token, its fill the
	 * guess's probability. A guess equal to the column's final answer is written bold in the answer
	 * colour. `changed` outlines cells (an ablation), `rowOpacity` dims rows, a click on a cell calls
	 * `onpick` (the sliders do the same from the keyboard).
	 */
	import { Label, toSvg } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { ROWS, type Guess } from '../lens';
	import { short } from './shared';

	interface Props {
		words: string[];
		cells: Guess[][];
		/** The final answer of each column (clean run), for the bold cells. */
		answers: string[];
		x?: number;
		y?: number;
		w?: number;
		rowH?: number;
		selected?: { row: number; col: number } | null;
		changed?: boolean[][] | null;
		rowOpacity?: (row: number) => number;
		/** Columns drawn at full strength; the others are dimmed (all when absent). */
		focusCol?: number | null;
		onpick?: (row: number, col: number) => void;
	}
	let {
		words,
		cells,
		answers,
		x = 112,
		y = 76,
		w = 832,
		rowH = 28,
		selected = null,
		changed = null,
		rowOpacity = () => 1,
		focusCol = null,
		onpick
	}: Props = $props();

	const n = $derived(words.length);
	const cw = $derived(w / n);
	const chars = $derived(Math.max(4, Math.floor((cw - 6) / 6.3)));
	const cx = (i: number) => x + i * cw;
	const cy = (r: number) => y + r * rowH;
	const colOpacity = (i: number) => (focusCol === null || focusCol === i ? 1 : 0.45);

	function click(e: MouseEvent) {
		if (!onpick) return;
		const p = toSvg(e, e.currentTarget as Element);
		const col = Math.floor((p.x - x) / cw);
		const row = Math.floor((p.y - y) / rowH);
		if (col >= 0 && col < n && row >= 0 && row < ROWS) onpick(row, col);
	}
</script>

<g>
	<!-- the words, above their columns -->
	{#each words as word, i (i)}
		<Label
			x={cx(i) + cw / 2}
			y={y - 10}
			size={12}
			weight={600}
			opacity={colOpacity(i)}
			text={short(word, chars)}
		/>
	{/each}
	<Readout id="grid-words">
		<Label x={x - 12} y={y - 10} anchor="end" size={11} muted text="after the word" />
	</Readout>

	{#each cells as row, r (r)}
		{@const o = rowOpacity(r)}
		<Label
			x={x - 12}
			y={cy(r) + rowH / 2 + 4}
			anchor="end"
			size={11.5}
			muted={r > 0 && r < 12}
			weight={r === 12 ? 650 : 400}
			opacity={Math.max(0.5, o)}
			text={r === 0 ? 'embedding' : r === 12 ? 'block 12 (output)' : `block ${r}`}
		/>
		<g opacity={o}>
			{#each row as c, i (i)}
				{@const hit = c.token === answers[i]}
				<rect
					x={cx(i) + 1.5}
					y={cy(r) + 1.5}
					width={cw - 3}
					height={rowH - 3}
					rx="4"
					fill="var(--rs-cell)"
					fill-opacity={(0.08 + 0.7 * c.p) * colOpacity(i)}
					stroke={changed?.[r]?.[i] ? 'var(--rs-changed)' : 'none'}
					stroke-width="2"
				/>
				<text
					x={cx(i) + cw / 2}
					y={cy(r) + rowH / 2 + 4}
					text-anchor="middle"
					font-size="11.5"
					font-weight={hit ? 700 : 400}
					fill={hit ? 'var(--rs-answer)' : 'var(--stage-ink)'}
					opacity={colOpacity(i)}>{short(c.token, chars)}</text
				>
			{/each}
		</g>
	{/each}

	{#if selected}
		<rect
			x={cx(selected.col)}
			y={cy(selected.row)}
			width={cw}
			height={rowH}
			rx="5"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
	{/if}

	{#if onpick}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<rect
			{x}
			{y}
			width={w}
			height={rowH * ROWS}
			fill="transparent"
			style:cursor="pointer"
			onclick={click}
		>
			<title>Click a cell to read its guesses (or use the sliders)</title>
		</rect>
	{/if}
</g>
