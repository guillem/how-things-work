<script lang="ts">
	/**
	 * The trace–determinant chart: τ across, Δ up, the parabola τ² = 4Δ that
	 * separates nodes from spirals, the line Δ = 0 under which every system is a
	 * saddle, and the half-line τ = 0, Δ > 0 of centres; a marker at (τ, Δ).
	 * A marker beyond the chart is drawn hollow on its edge.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { fixed, type Rect } from './frame';

	interface Props {
		rect: Rect;
		tau: number;
		delta: number;
		color: string;
		/** Show the names of the regions (room permitting). */
		names?: boolean;
	}
	let { rect, tau, delta, color, names = true }: Props = $props();

	const T: [number, number] = [-4, 4];
	const D: [number, number] = [-2, 5];
	const sx = $derived(scale(T, [rect.left, rect.right]));
	const sy = $derived(scale(D, [rect.bottom, rect.top]));
	const parabola = $derived(
		Array.from({ length: 81 }, (_, i) => {
			const tt = T[0] + ((T[1] - T[0]) * i) / 80;
			return `${i ? 'L' : 'M'}${sx(tt).toFixed(1)} ${sy(Math.min((tt * tt) / 4, D[1] + 1)).toFixed(1)}`;
		}).join('')
	);
	const inside = $derived(tau >= T[0] && tau <= T[1] && delta >= D[0] && delta <= D[1]);
	const mx = $derived(sx(Math.min(Math.max(tau, T[0]), T[1])));
	const my = $derived(sy(Math.min(Math.max(delta, D[0]), D[1])));
	const small = $derived(rect.bottom - rect.top < 200);
</script>

<g>
	<defs>
		<clipPath id="pp-td-clip">
			<rect
				x={rect.left}
				y={rect.top}
				width={rect.right - rect.left}
				height={rect.bottom - rect.top}
			/>
		</clipPath>
	</defs>
	<Axes
		{sx}
		{sy}
		xLabel="trace τ"
		yLabel="det Δ"
		xTicks={[-4, -2, 0, 2, 4]}
		yTicks={small ? [-2, 0, 2, 4] : [-2, 0, 1, 2, 3, 4, 5]}
		yFormat={(v: number) => fixed(v, 0)}
		xFormat={(v: number) => fixed(v, 0)}
		grid={false}
	/>
	<g clip-path="url(#pp-td-clip)">
		<rect
			x={rect.left}
			y={sy(0)}
			width={rect.right - rect.left}
			height={rect.bottom - sy(0)}
			fill="var(--pp-saddle)"
			opacity="0.12"
		/>
		<line
			x1={rect.left}
			x2={rect.right}
			y1={sy(0)}
			y2={sy(0)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
		/>
		<path d={parabola} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
		<line
			x1={sx(0)}
			x2={sx(0)}
			y1={sy(0)}
			y2={rect.top}
			stroke="var(--pp-centre)"
			stroke-width="2.4"
		/>
	</g>
	{#if names}
		<Readout id="td-names">
			<g opacity="0.85">
				<Label
					x={(rect.left + rect.right) / 2}
					y={sy(-1) + 4}
					text="saddles"
					size={11}
					muted
					anchor="middle"
				/>
				<Label x={sx(-2.9)} y={sy(small ? 4 : 4.3)} text="stable spirals" size={11} muted />
				<Label x={sx(2.9)} y={sy(small ? 4 : 4.3)} text="unstable spirals" size={11} muted />
				<Label x={sx(-3.5)} y={sy(small ? 1.6 : 1.3)} text="stable nodes" size={11} muted />
				<Label x={sx(3.5)} y={sy(small ? 1.6 : 1.3)} text="unstable nodes" size={11} muted />
				{#if !small}
					<Label
						x={sx(0) + 6}
						y={rect.top + 14}
						text="centres"
						size={11}
						color="var(--pp-centre)"
						anchor="start"
					/>
				{/if}
			</g>
		</Readout>
	{/if}
	<circle
		cx={mx}
		cy={my}
		r="7"
		fill={inside ? color : 'var(--stage-bg)'}
		stroke={color}
		stroke-width="2.5"
	/>
</g>
