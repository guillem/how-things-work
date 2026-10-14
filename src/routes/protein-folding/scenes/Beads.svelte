<script lang="ts">
	/**
	 * An HP chain drawn on the lattice: bonds, H–H contacts (dotted), and the beads (H orange,
	 * P blue, lettered). Beads that share a grid point are ringed red. With `onbead`, inner
	 * beads are buttons (click, or Enter / Space when focused).
	 */
	interface Props {
		seq: string;
		pts: readonly { x: number; y: number }[];
		r?: number;
		contacts?: readonly (readonly [number, number])[];
		clash?: ReadonlySet<number>;
		onbead?: (i: number) => void;
		describe?: (i: number) => string;
		opacity?: number;
		letters?: boolean;
	}
	let {
		seq,
		pts,
		r = 14,
		contacts = [],
		clash = new Set(),
		onbead,
		describe,
		opacity = 1,
		letters = true
	}: Props = $props();

	const d = $derived(
		pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
	);

	function key(e: KeyboardEvent, i: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		onbead?.(i);
	}
</script>

<g {opacity}>
	{#each contacts as [i, j] (`${i}-${j}`)}
		<line
			x1={pts[i].x}
			y1={pts[i].y}
			x2={pts[j].x}
			y2={pts[j].y}
			stroke="var(--pf-contact)"
			stroke-width="3"
			stroke-dasharray="2 5"
			stroke-linecap="round"
		/>
	{/each}
	<path
		{d}
		fill="none"
		stroke="var(--pf-bond)"
		stroke-width={r * 0.42}
		stroke-linecap="round"
		stroke-linejoin="round"
		opacity="0.8"
	/>
	{#each pts as p, i (i)}
		{@const h = seq[i] === 'H'}
		{@const active = onbead && i > 0 && i < pts.length - 1}
		{#if active}
			<g
				class="bead"
				role="button"
				tabindex="0"
				aria-label={describe?.(i) ?? `Bead ${i + 1}`}
				onclick={() => onbead?.(i)}
				onkeydown={(e) => key(e, i)}
			>
				<circle cx={p.x} cy={p.y} r={r + 7} fill="transparent" />
				<circle
					cx={p.x}
					cy={p.y}
					{r}
					fill={h ? 'var(--pf-h)' : 'var(--pf-p)'}
					stroke={clash.has(i) ? 'var(--pf-clash)' : h ? 'var(--pf-h-edge)' : 'var(--pf-p-edge)'}
					stroke-width={clash.has(i) ? 3.5 : 1.5}
				/>
				{#if letters}
					<text
						x={p.x}
						y={p.y + r * 0.36}
						text-anchor="middle"
						style:font-size="{r}px"
						font-weight="700"
						style:fill="#fff"
					>
						{seq[i]}
					</text>
				{/if}
			</g>
		{:else}
			<circle
				cx={p.x}
				cy={p.y}
				{r}
				fill={h ? 'var(--pf-h)' : 'var(--pf-p)'}
				stroke={clash.has(i) ? 'var(--pf-clash)' : h ? 'var(--pf-h-edge)' : 'var(--pf-p-edge)'}
				stroke-width={clash.has(i) ? 3.5 : 1.5}
			/>
			{#if letters}
				<text
					x={p.x}
					y={p.y + r * 0.36}
					text-anchor="middle"
					style:font-size="{r}px"
					font-weight="700"
					style:fill="#fff"
					style:pointer-events="none"
				>
					{seq[i]}
				</text>
			{/if}
		{/if}
	{/each}
</g>

<style>
	.bead {
		cursor: pointer;
		outline: none;
	}
	.bead:hover circle:nth-child(2),
	.bead:focus-visible circle:nth-child(2) {
		stroke: var(--stage-ink);
		stroke-width: 3;
	}
	.bead text {
		pointer-events: none;
	}
</style>
