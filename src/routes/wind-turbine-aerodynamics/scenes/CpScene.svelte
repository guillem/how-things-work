<script lang="ts">
	/**
	 * The NREL 5-MW rotor's power coefficient against tip-speed ratio, from the BEM model, at the
	 * chosen pitch (and at 0° for comparison), with the Betz limit and a handle on the curve that
	 * sets λ. Right: where the gap between the Betz limit and the real rotor's best goes, each
	 * bar the best CP over λ at 0° pitch as the losses are switched on in turn: an ideal blade
	 * (no drag, no tip loss: what is left is wake swirl, the root and the blade's shape), plus
	 * Prandtl tip loss, plus drag.
	 *
	 * Motion: none needed; the curve follows the pitch control.
	 */
	import { Axes, Handle, Label, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bem, bestLambda, BETZ, cpCurve } from '../model';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { num } from './fmt';

	let { params, setParam }: StageProps = $props();

	const lambda = $derived(Number(params.lambda ?? 7.5));
	const pitch = $derived(Number(params.pitch ?? 0));

	const sx = scale([0, 14], [90, 620]);
	const sy = scale([-0.15, 0.65], [520, 84]);
	const FLOOR = -0.15;

	const base = cpCurve(0, 1, 14, 79);
	const curve = $derived(pitch === 0 ? base : cpCurve(pitch, 1, 14, 79));
	/** The curve, broken where CP drops off the chart (a rotor that would have to be driven). */
	const path = (pts: { lambda: number; cp: number }[]) => {
		let d = '';
		let pen = false;
		for (const p of pts) {
			if (p.cp < FLOOR) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${sx(p.lambda).toFixed(1)} ${sy(p.cp).toFixed(1)} `;
			pen = true;
		}
		return d;
	};
	const best = $derived(bestLambda(pitch));
	const here = $derived(bem(lambda, pitch).cp);

	const ideal = bestLambda(0, { drag: false, tipLoss: false }).cp;
	const withTip = bestLambda(0, { drag: false }).cp;
	const real = bestLambda(0).cp;
	const bars = [
		{ id: 'betz', label: 'Betz', sub: 'limit', v: BETZ, color: 'var(--wt-betz)' },
		{ id: 'ideal', label: 'ideal', sub: 'blade', v: ideal, color: 'var(--wt-blade)' },
		{ id: 'tip', label: '+ tip', sub: 'loss', v: withTip, color: 'var(--wt-blade)' },
		{ id: 'drag', label: '+ drag', sub: '(real)', v: real, color: 'var(--wt-power)' }
	];
	const by = scale([0, 0.65], [520, 84]);
	const BX = 690;
	const BW = 50;
	const BG = 14;

	const snap = (v: number) => Math.round(Math.min(14, Math.max(1, v)) / 0.05) * 0.05;
	const onmove = (p: Point) => setParam('lambda', snap(sx.invert(p.x)));
	const onkey = (s: number | 'start' | 'end') =>
		setParam('lambda', s === 'start' ? 1 : s === 'end' ? 14 : snap(lambda + s * 0.05));
</script>

<g>
	<Readout id="title" order={0} label="Chart" value="Power coefficient against tip-speed ratio">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={15}
			weight={700}
			text="CP against tip-speed ratio: NREL 5-MW rotor, BEM model"
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xLabel="tip-speed ratio λ"
		yLabel="CP"
		yTicks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
		yFormat={(v: number) => num(v, 1)}
	/>
	<line
		x1={sx(0)}
		x2={sx(14)}
		y1={sy(BETZ)}
		y2={sy(BETZ)}
		stroke="var(--wt-betz)"
		stroke-width="1.5"
		stroke-dasharray="6 4"
	/>
	<Readout
		id="betz-key"
		order={5}
		label="Green line"
		value="Betz limit 16/27 = 0.593"
		color="var(--wt-betz)"
	>
		<Label
			x={sx(14) - 4}
			y={sy(BETZ) - 8}
			anchor="end"
			text="Betz limit 16/27"
			size={12}
			color="var(--wt-betz)"
		/>
	</Readout>
	{#if pitch !== 0}
		<path
			d={path(base)}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
		/>
		<Readout id="zero-key">
			<Label x={sx(11.2)} y={sy(0.4) - 10} anchor="start" text="pitch 0°" size={11} muted />
		</Readout>
	{/if}
	<path d={path(curve)} fill="none" stroke="var(--wt-power)" stroke-width="2.8" />
	{#if best.cp > 0.02}
		<line
			x1={sx(best.lambda)}
			x2={sx(best.lambda)}
			y1={sy(best.cp)}
			y2={sy(0)}
			stroke="var(--wt-power)"
			stroke-dasharray="2 4"
			opacity="0.6"
		/>
		<Readout
			id="peak"
			order={2}
			label="Peak"
			value="CP {best.cp.toFixed(3)} at λ {best.lambda.toFixed(1)}"
			color="var(--wt-power)"
		>
			<Label
				x={sx(best.lambda) + 8}
				y={sy(best.cp) - 12}
				anchor="start"
				text="peak {best.cp.toFixed(3)} at λ = {best.lambda.toFixed(1)}"
				size={12}
				weight={600}
				color="var(--wt-power)"
			/>
		</Readout>
	{/if}
	<Readout id="low">
		<Label x={sx(2.4)} y={sy(0.03) - 6} anchor="start" text="← stalled" size={11} muted />
	</Readout>
	<Readout id="high">
		<Label
			x={sx(14)}
			y={sy(0.03) - 6}
			anchor="end"
			text="blocking, little lift →"
			size={11}
			muted
		/>
	</Readout>
	<Handle
		x={sx(lambda)}
		y={sy(Math.max(FLOOR, here))}
		label="Tip-speed ratio"
		value={lambda}
		min={1}
		max={14}
		valuetext="λ = {lambda.toFixed(2)}, CP = {here.toFixed(3)}"
		color="var(--wt-power)"
		{onmove}
		{onkey}
	/>

	<line x1={sx(0)} x2={sx(14)} y1={sy(0)} y2={sy(0)} stroke="var(--stage-ink-muted)" />
	<Card x={100} y={126} w={200} h={64} />
	<Row
		id="here"
		order={1}
		x={114}
		y={152}
		w={172}
		label="CP at λ = {lambda.toFixed(2)}"
		value={here.toFixed(3)}
		color="var(--wt-power)"
	/>
	<Row
		id="share"
		order={3}
		x={114}
		y={176}
		w={172}
		label="Share of Betz"
		value="{Math.round((Math.max(0, here) / BETZ) * 100)}%"
		minor
	/>

	<!-- where the gap goes -->
	<Readout id="bars-title">
		<Label
			x={BX - 6}
			y={70}
			anchor="start"
			text="Best CP at 0° pitch, losses added in turn"
			size={12}
			weight={600}
		/>
	</Readout>
	{#each bars as b, i (b.id)}
		{@const x = BX + i * (BW + BG)}
		<rect
			{x}
			y={by(b.v)}
			width={BW}
			height={by(0) - by(b.v)}
			rx="3"
			fill={b.color}
			opacity={i === 3 ? 1 : 0.75}
		/>
		<Readout
			id="bar-{b.id}"
			order={6 + i}
			label="{b.label} {b.sub}"
			value={b.v.toFixed(3)}
			color={b.color}
		>
			<Label x={x + BW / 2} y={by(b.v) - 8} text={b.v.toFixed(3)} size={12} weight={600} tabular />
			<Label x={x + BW / 2} y={by(0) + 18} text={b.label} size={11} muted />
			<Label x={x + BW / 2} y={by(0) + 32} text={b.sub} size={11} muted />
		</Readout>
	{/each}
	<line
		x1={BX - 6}
		x2={BX + 4 * (BW + BG) - BG + 6}
		y1={by(0)}
		y2={by(0)}
		stroke="var(--stage-line)"
	/>
</g>
