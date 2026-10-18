<script lang="ts">
	/**
	 * The uncoiled cochlea: the two fluid channels, the stapes in the oval window, the round
	 * window, the helicotrema at the far end and the "tuned to" row of Greenwood's map under it.
	 * The membrane itself is drawn by the scene (it moves), between `top` and `bottom`.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { placeOf } from '../model.ts';
	import { MAP_TICKS, X0, X1, xAt } from './geometry';

	interface Props {
		top: number;
		bottom: number;
		/** Stapes displacement, px (positive: pushed in). */
		push?: number;
		/** Draw the "tuned to" row. */
		ticks?: boolean;
		/** Name the two channels. */
		names?: boolean;
		opacity?: number;
	}
	let { top, bottom, push = 0, ticks = true, names = true, opacity = 1 }: Props = $props();

	const mid = $derived((top + bottom) / 2);
	const END = X1 + 22;
	const duct = $derived(
		`M${X0} ${top} L${END - 14} ${top} Q${END} ${top} ${END} ${top + 14} L${END} ${bottom - 14} Q${END} ${bottom} ${END - 14} ${bottom} L${X0} ${bottom}`
	);
</script>

<g {opacity}>
	<path d="{duct} Z" fill="var(--co-fluid)" stroke="none" />
	<path d={duct} fill="none" stroke="var(--co-duct)" stroke-width="1.5" />
	<!-- the base wall with its two windows -->
	<line x1={X0} x2={X0} y1={top} y2={top + 12} stroke="var(--co-duct)" stroke-width="1.5" />
	<line x1={X0} x2={X0} y1={mid - 8} y2={mid + 8} stroke="var(--co-duct)" stroke-width="1.5" />
	<line x1={X0} x2={X0} y1={bottom - 12} y2={bottom} stroke="var(--co-duct)" stroke-width="1.5" />
	<!-- oval window and stapes -->
	<path
		d="M{X0} {top + 12} Q{X0 + push * 1.2} {(top + mid - 8) / 2} {X0} {mid - 8}"
		fill="none"
		stroke="var(--co-duct)"
		stroke-width="1.2"
	/>
	<g transform="translate({push} 0)">
		<rect
			x={X0 - 14}
			y={top + 16}
			width="10"
			height={mid - top - 28}
			rx="2"
			fill="var(--co-bone)"
			stroke="var(--co-duct)"
		/>
		<path
			d="M{X0 - 14} {(top + mid) / 2 - 6} L{X0 - 52} {top + 2} M{X0 - 14} {(top + mid) / 2 +
				6} L{X0 - 52} {top + 30}"
			stroke="var(--co-bone-edge)"
			stroke-width="5"
			stroke-linecap="round"
			fill="none"
		/>
	</g>
	<!-- round window bulges the other way -->
	<path
		d="M{X0} {mid + 8} Q{X0 - push * 1.2} {(mid + bottom) / 2 + 6} {X0} {bottom - 12}"
		fill="none"
		stroke="var(--co-duct)"
		stroke-width="1.2"
	/>
	<Readout id="duct-labels" label="Stapes on the left (base); apex on the right">
		<Label anchor="end" x={X0 - 22} y={top - 8} text="stapes" size={12} muted />
		<Label anchor="end" x={X0 - 8} y={bottom + 16} text="round window" size={11} muted />
		{#if names}
			<Label anchor="start" x={X0 + 10} y={top + 16} text="scala vestibuli" size={11} muted />
			<Label anchor="start" x={X0 + 10} y={bottom - 8} text="scala tympani" size={11} muted />
		{/if}
		<Label anchor="end" x={END - 4} y={top - 8} text="apex · helicotrema" size={11} muted />
		<Label anchor="start" x={X0} y={top - 8} text="base" size={11} muted />
	</Readout>
	{#if ticks}
		<line x1={X0} x2={X1} y1={bottom + 26} y2={bottom + 26} stroke="var(--stage-line)" />
		{#each MAP_TICKS as [f, label] (f)}
			<line
				x1={xAt(placeOf(f))}
				x2={xAt(placeOf(f))}
				y1={bottom + 22}
				y2={bottom + 30}
				stroke="var(--stage-ink-muted)"
			/>
			<Label x={xAt(placeOf(f))} y={bottom + 44} text={label} size={11} muted halo={false} />
		{/each}
		<Readout id="tuned-to">
			<Label anchor="end" x={X0 - 8} y={bottom + 44} text="tuned to" size={11} muted />
		</Readout>
	{/if}
</g>
