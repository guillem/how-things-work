<script lang="ts">
	/**
	 * The doses above the chart: a pill for a tablet, a drop for an injection, a bar for a drip
	 * (as long as it runs), larger for a loading dose; a missed dose is a dashed outline. With
	 * `onremove`, each dose is a button that removes it (click, Enter or Delete).
	 */
	import type { Scale } from '#lib/draw/index.ts';
	import type { Drug } from '../drugs';
	import type { Dose } from '../model';
	import { amountText } from '../regimens';
	import { C, L } from './shared';

	interface Props {
		sx: Scale;
		drug: Drug;
		doses: readonly Dose[];
		missed?: readonly number[];
		span: number;
		onremove?: (i: number) => void;
	}
	let { sx, drug, doses, missed = [], span, onremove }: Props = $props();

	const y = L.STRIP;
	const big = (d: Dose) => d.form !== 'drip' && d.amount > drug.dose * 1.2 && drug.dose > 0;
	const what = (d: Dose) =>
		d.form === 'drip'
			? `drip of ${amountText(drug, d.amount)} per hour for ${d.duration ?? 0} hours`
			: `${d.form} of ${amountText(drug, d.amount)}`;
	const when = (h: number) => (span > 96 ? `day ${(h / 24).toFixed(1)}` : `hour ${h.toFixed(0)}`);
</script>

{#snippet icon(d: Dose)}
	{@const k = big(d) ? 1.45 : 1}
	{#if d.form === 'tablet'}
		<rect
			x={sx(d.t) - 7 * k}
			y={y - 4 * k}
			width={14 * k}
			height={8 * k}
			rx={4 * k}
			fill={C.tablet}
		/>
	{:else if d.form === 'injection'}
		<path
			d="M{sx(d.t)} {y + 7 * k} L{sx(d.t) - 5 * k} {y - 2 * k} A{5.6 * k} {5.6 * k} 0 1 1 {sx(d.t) +
				5 * k} {y - 2 * k} Z"
			fill={C.inject}
		/>
	{:else}
		<rect
			x={sx(d.t)}
			y={y - 3}
			width={Math.max(4, sx(Math.min(span, d.t + (d.duration ?? 0))) - sx(d.t))}
			height="6"
			rx="3"
			fill={C.drip}
		/>
	{/if}
{/snippet}

<g>
	{#each missed as m (m)}
		<rect
			x={sx(m) - 7}
			y={y - 4}
			width="14"
			height="8"
			rx="4"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 2"
		/>
		<path
			d="M{sx(m) - 4} {y - 11} l8 -8 M{sx(m) + 4} {y - 11} l-8 -8"
			stroke={C.toxic}
			stroke-width="1.6"
		/>
	{/each}
	{#each doses as d, i (`${i}-${d.t}-${d.form}`)}
		{#if onremove}
			<g
				class="dose"
				role="button"
				tabindex="0"
				aria-label="Remove the {what(d)} at {when(d.t)}"
				style:cursor="pointer"
				onclick={() => onremove(i)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace') {
						e.preventDefault();
						onremove(i);
					}
				}}
			>
				<rect x={sx(d.t) - 9} y={y - 12} width="18" height="24" fill="transparent" />
				{@render icon(d)}
			</g>
		{:else}
			{@render icon(d)}
		{/if}
	{/each}
</g>
