<script lang="ts">
	/**
	 * The frame of the level chart: the label's target range as a band, the toxic line, the axes
	 * (level in the label's unit against hours or days).
	 */
	import { Axes, Label, ticks, type Scale } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Drug } from '../drugs';
	import { C, L, level, timeAxis } from './shared';

	interface Props {
		sx: Scale;
		sy: Scale;
		drug: Drug;
		span: number;
		/** Name of the dashed comparison curve, for the legend. */
		ghost?: string | null;
	}
	let { sx, sy, drug, span, ghost = null }: Props = $props();

	const axis = $derived(timeAxis(span));
	const yTicks = $derived(ticks(0, sy.domain[1], 5));
	const yFormat = (v: number) =>
		v === 0 ? '0' : v < 1 ? v.toFixed(v < 0.1 ? 2 : 1) : v.toLocaleString('en-US');
	const win = $derived(drug.window);
	const toxicY = $derived(drug.toxic !== null ? sy(drug.toxic) : null);

	/** The legend under the chart: swatch and text, laid out left to right. */
	const LY = 536;
	const CH = 4.9;
	const items = $derived.by(() => {
		const out: { id: string; kind: 'band' | 'toxic' | 'ghost'; text: string; x: number }[] = [];
		let x = L.PX0;
		const push = (id: string, kind: 'band' | 'toxic' | 'ghost', text: string) => {
			out.push({ id, kind, text, x });
			x += 30 + text.length * CH + 28;
		};
		if (win)
			push(
				'window',
				'band',
				`target ${drug.windowSample ? `${drug.windowSample} ` : ''}(label): ${level(win[0], drug, false)}–${level(win[1], drug)}`
			);
		else push('window', 'band', 'the label gives no target range');
		if (drug.toxic !== null) push('toxic', 'toxic', `toxic above ${level(drug.toxic, drug)}`);
		if (ghost) push('ghost', 'ghost', ghost);
		return out;
	});
</script>

<g>
	{#if win}
		<rect
			x={L.PX0}
			y={sy(Math.min(win[1], sy.domain[1]))}
			width={L.PX1 - L.PX0}
			height={sy(win[0]) - sy(Math.min(win[1], sy.domain[1]))}
			fill={C.band}
		/>
	{/if}
	<Axes
		{sx}
		{sy}
		xTicks={axis.ticks}
		{yTicks}
		xFormat={axis.format}
		{yFormat}
		xLabel={axis.label}
	/>
	<Readout id="yunit">
		<Label
			x={L.PX0 + 8}
			y={L.PY1 + 14}
			anchor="start"
			text="level in the blood ({drug.concUnit})"
			size={11}
			muted
		/>
	</Readout>
	{#if toxicY !== null && drug.toxic !== null && drug.toxic <= sy.domain[1]}
		<line
			x1={L.PX0}
			x2={L.PX1}
			y1={toxicY}
			y2={toxicY}
			stroke={C.toxic}
			stroke-width="1.4"
			stroke-dasharray="6 4"
		/>
	{/if}

	{#each items as it (it.id)}
		<Readout
			id="key-{it.id}"
			order={10}
			label={it.kind === 'band' ? 'Green band' : it.kind === 'toxic' ? 'Red dashes' : 'Grey dashes'}
			value={it.text}
			color={it.kind === 'band' ? C.bandText : it.kind === 'toxic' ? C.toxic : undefined}
		>
			{#if it.kind === 'band'}
				<rect
					x={it.x}
					y={LY - 8}
					width="24"
					height="10"
					fill={win ? C.band : 'none'}
					stroke={win ? 'none' : 'var(--border)'}
				/>
			{:else}
				<line
					x1={it.x}
					x2={it.x + 24}
					y1={LY - 3}
					y2={LY - 3}
					stroke={it.kind === 'toxic' ? C.toxic : C.ghost}
					stroke-width="2"
					stroke-dasharray={it.kind === 'toxic' ? '6 4' : '5 4'}
				/>
			{/if}
			<Label x={it.x + 30} y={LY + 1} anchor="start" text={it.text} size={11} muted />
		</Readout>
	{/each}
</g>
