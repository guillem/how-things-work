<script lang="ts">
	/**
	 * The 21 examples and the line y = a·x + b for the current point of the
	 * line-fit landscape, with the gap to each example (its error). Optionally
	 * the least-squares line, dashed, for comparison.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import { examples, leastSquares } from '../descent';
	import { LEFT } from './shared';
	import Txt from './Txt.svelte';

	interface Props {
		a: number;
		b: number;
		showBest: boolean;
	}
	let { a, b, showBest }: Props = $props();

	const X0 = LEFT.x + 44;
	const X1 = LEFT.x + LEFT.w - 12;
	const Y0 = LEFT.y + 26;
	const Y1 = LEFT.y + LEFT.h - 28;
	const XR = [-1, 1];
	const YR = [-1.2, 1.2];
	const px = (x: number) => X0 + ((x - XR[0]) / (XR[1] - XR[0])) * (X1 - X0);
	const py = (y: number) => Y1 - ((y - YR[0]) / (YR[1] - YR[0])) * (Y1 - Y0);
	const lineD = (k: number, c: number) =>
		`M${px(XR[0])} ${py(k * XR[0] + c).toFixed(1)}L${px(XR[1])} ${py(k * XR[1] + c).toFixed(1)}`;
	const best = leastSquares(examples);
	const gaps = $derived(
		examples
			.map((p) => `M${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}V${py(a * p.x + b).toFixed(1)}`)
			.join('')
	);
	const ticks = [-1, -0.5, 0, 0.5, 1];
	const eq = $derived(
		`y = ${a.toFixed(2).replace('-', '−')} · x ${b < 0 ? '−' : '+'} ${Math.abs(b).toFixed(2)}`
	);
</script>

<g style:pointer-events="none">
	<defs>
		<clipPath id="gd-data-clip">
			<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
		</clipPath>
	</defs>
	<rect
		x={X0}
		y={Y0}
		width={X1 - X0}
		height={Y1 - Y0}
		fill="none"
		stroke="var(--stage-line)"
		rx="3"
	/>
	{#each ticks as v (v)}
		<line x1={px(v)} x2={px(v)} y1={Y0} y2={Y1} stroke="var(--stage-grid)" />
		<line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke="var(--stage-grid)" />
	{/each}
	<Readout id="data-axes">
		{#each ticks as v (v)}
			<Txt
				x={px(v)}
				y={Y1 + 15}
				text={String(v).replace('-', '−')}
				anchor="middle"
				size={11}
				muted
			/>
			<Txt
				x={X0 - 6}
				y={py(v) + 4}
				text={String(v).replace('-', '−')}
				anchor="end"
				size={11}
				muted
			/>
		{/each}
		<Txt x={X1} y={Y1 + 30} text="input x →" anchor="end" size={12} muted />
		<Txt x={X0 + 4} y={Y0 - 8} text="↑ output y" size={12} muted />
	</Readout>

	<g clip-path="url(#gd-data-clip)">
		<path d={gaps} stroke="var(--gd-line)" stroke-width="1.4" opacity="0.55" />
		{#if showBest}
			<path
				d={lineD(best.a, best.b)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
				stroke-dasharray="6 5"
			/>
		{/if}
		<path d={lineD(a, b)} stroke="var(--gd-line)" stroke-width="3" stroke-linecap="round" />
		{#each examples as p, i (i)}
			<circle
				cx={px(p.x)}
				cy={py(p.y)}
				r="5"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
	</g>
	<Readout id="data-line" order={1} label="Line" value={eq} color="var(--gd-line)">
		<Txt x={X0 + 10} y={Y0 + 20} text={eq} size={14} weight={600} color="var(--gd-line)" />
	</Readout>
	{#if showBest}
		<Readout id="data-best" order={2} label="Dashed" value="the least-squares line">
			<Txt x={X0 + 10} y={Y0 + 40} text="dashed: the least-squares line" size={12} muted />
		</Readout>
	{/if}
</g>
