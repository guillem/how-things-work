<script lang="ts">
	/**
	 * A block of readouts on a surface card: one row per item, label on the
	 * left, value on the right. Each row is a `<Readout>`, so on phones the
	 * rows are listed under the stage instead.
	 */
	import { Readout } from '#lib/explainer/index.ts';

	export interface Row {
		id: string;
		label: string;
		value: string;
		color?: string;
		strong?: boolean;
		note?: string;
	}
	interface Props {
		x: number;
		y: number;
		w: number;
		rows: Row[];
		title?: string;
		order?: number;
		opacity?: number;
	}
	let { x, y, w, rows, title, order = 1, opacity = 1 }: Props = $props();
	const LINE = 22;
	const top = $derived(title ? 30 : 10);
	const h = $derived(top + rows.length * LINE + 6);
</script>

<g {opacity}>
	<Readout id="card-{rows[0]?.id ?? 'x'}-box">
		<rect {x} {y} width={w} height={h} rx="10" fill="var(--surface)" stroke="var(--border)" />
		{#if title}
			<text x={x + 14} y={y + 20} font-size="12" font-weight="600" class="muted">{title}</text>
		{/if}
	</Readout>
	{#each rows as row, i (row.id)}
		<Readout
			id={row.id}
			order={order + i}
			label={row.label}
			value={row.value}
			note={row.note}
			color={row.color}
			{opacity}
		>
			<text x={x + 14} y={y + top + 15 + i * LINE} font-size="13">{row.label}</text>
			<text
				x={x + w - 14}
				y={y + top + 15 + i * LINE}
				font-size="13"
				text-anchor="end"
				font-weight={row.strong ? 700 : 600}
				style:fill={row.color}>{row.value}</text
			>
		</Readout>
	{/each}
</g>
