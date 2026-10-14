<script lang="ts">
	/** A matrix or column vector of numbers in square brackets, with an optional caption above. */
	import T from './T.svelte';

	interface Props {
		x: number;
		y: number;
		/** Rows of numbers. */
		rows: number[][];
		caption?: string;
		colW?: number;
		rowH?: number;
		digits?: number;
		color?: string;
		/** Index of a row to emphasise (e.g. w). */
		mark?: number;
	}
	let {
		x,
		y,
		rows,
		caption = '',
		colW = 52,
		rowH = 22,
		digits = 2,
		color,
		mark = -1
	}: Props = $props();

	const cols = $derived(rows[0]?.length ?? 0);
	const w = $derived(cols * colW + 12);
	const h = $derived(rows.length * rowH + 6);
	const f = (v: number) => {
		const s = (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
		return s.replace('-', '−');
	};
</script>

<g>
	{#if caption}
		<T x={x + w / 2} y={y - 8} text={caption} size={12} anchor="middle" muted />
	{/if}
	<path
		d="M{x + 6} {y} H{x} V{y + h} H{x + 6} M{x + w - 6} {y} H{x + w} V{y + h} H{x + w - 6}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-opacity="0.7"
	/>
	{#each rows as row, r (r)}
		{#each row as v, c (c)}
			<T
				x={x + 6 + (c + 1) * colW - 6}
				y={y + 3 + (r + 0.72) * rowH}
				text={f(v)}
				size={13}
				anchor="end"
				weight={r === mark ? 700 : 500}
				{color}
			/>
		{/each}
	{/each}
</g>
