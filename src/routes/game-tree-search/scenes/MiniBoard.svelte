<script lang="ts">
	/**
	 * A small noughts-and-crosses board: one grid path, one path for the crosses and one for the
	 * noughts (so a tree of 60 of them stays within the drawing budget). `mark` picks a square
	 * to draw in bold (the move just played).
	 */
	interface Props {
		x: number;
		y: number;
		size: number;
		board: string;
		mark?: number;
		opacity?: number;
		/** Draw a card behind it (for boards over lines). */
		card?: boolean;
		outline?: string;
	}
	let { x, y, size, board, mark = -1, opacity = 1, card = true, outline }: Props = $props();

	const c = $derived(size / 3);
	const grid = $derived(
		`M${x + c} ${y + 2}V${y + size - 2}M${x + 2 * c} ${y + 2}V${y + size - 2}` +
			`M${x + 2} ${y + c}H${x + size - 2}M${x + 2} ${y + 2 * c}H${x + size - 2}`
	);
	const paths = $derived.by(() => {
		let xs = '';
		let os = '';
		let xb = '';
		let ob = '';
		const r = c * 0.3;
		for (let i = 0; i < 9; i++) {
			const ch = board[i];
			if (ch === '.') continue;
			const cx = x + (i % 3) * c + c / 2;
			const cy = y + Math.floor(i / 3) * c + c / 2;
			if (ch === 'X') {
				const d = `M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`;
				if (i === mark) xb += d;
				else xs += d;
			} else {
				const d = `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
				if (i === mark) ob += d;
				else os += d;
			}
		}
		return { xs, os, xb, ob };
	});
	const w = $derived(Math.max(1, size / 30));
</script>

<g {opacity} style:pointer-events="none">
	{#if card}
		<rect
			{x}
			{y}
			width={size}
			height={size}
			rx={Math.min(6, size / 8)}
			fill="var(--surface)"
			stroke={outline ?? 'var(--border)'}
			stroke-width={outline ? 2 : 1}
		/>
	{/if}
	<path d={grid} stroke="var(--stage-line)" stroke-width={Math.max(0.8, w * 0.6)} fill="none" />
	<path
		d={paths.xs}
		stroke="var(--gt-x)"
		stroke-width={w * 1.2}
		fill="none"
		stroke-linecap="round"
	/>
	<path d={paths.os} stroke="var(--gt-o)" stroke-width={w * 1.2} fill="none" />
	{#if mark >= 0}
		<path
			d={paths.xb}
			stroke="var(--gt-x)"
			stroke-width={w * 2.2}
			fill="none"
			stroke-linecap="round"
		/>
		<path d={paths.ob} stroke="var(--gt-o)" stroke-width={w * 2.2} fill="none" />
	{/if}
</g>
