<script lang="ts">
	/**
	 * The road to gain: milestones on one logarithmic scale of gain Q (fusion energy out over
	 * heating energy in). JET 1997, NIF 2022 and 2025, ITER's design goal, NIF counted against
	 * the grid, and the reader's own plasma (its steady-state Q from the controls). Breakeven
	 * (Q = 1) and ignition (Q → ∞) are marked.
	 */
	import { Label, clamp, scale, smoothstep, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { powers } from '../model';
	import { plasmaOf, qText } from './settings';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 110;
	const X1 = 820;
	const AY = 300;
	const lx = scale([-2, 2], [X0, X1]);
	const sx = (q: number) => lx(Math.log10(clamp(q, 0.01, 100)));
	const time = $derived(reduced ? 10 : t);
	const show = (k: number) => smoothstep(0.3 + 0.35 * k, 0.6 + 0.35 * k, time);

	// Sources: EUROfusion / ISTP-CNR JET background (JET 1997: 16 MW from 24 MW of heating,
	// Q = 0.67); LLNL (NIF 2022: 3.15 MJ from 2.05 MJ; 2025: 8.6 MJ from 2.08 MJ); E. I. Moses,
	// NIF status report (2001): over 300 MJ of electricity to the flashlamps per shot; ITER
	// Organization (Q = 10 design goal).
	const marks: {
		id: string;
		q: number;
		title: string;
		sub: string;
		dy: number;
		anchor: 'start' | 'middle' | 'end';
		color: string;
		hollow: boolean;
	}[] = [
		{
			id: 'grid',
			q: 3.15 / 300,
			title: 'NIF 2022, against the grid',
			sub: '3.15 MJ from ≈ 300 MJ of electricity',
			dy: 70,
			anchor: 'start',
			color: 'var(--stage-ink-muted)',
			hollow: false
		},
		{
			id: 'jet',
			q: 16 / 24,
			title: 'JET 1997',
			sub: '16 MW from 24 MW of heating',
			dy: -70,
			anchor: 'end',
			color: 'var(--nf-coil)',
			hollow: false
		},
		{
			id: 'nif22',
			q: 3.15 / 2.05,
			title: 'NIF 2022',
			sub: '3.15 MJ from 2.05 MJ',
			dy: 70,
			anchor: 'start',
			color: 'var(--nf-laser)',
			hollow: false
		},
		{
			id: 'nif25',
			q: 8.6 / 2.08,
			title: 'NIF 2025',
			sub: '8.6 MJ from 2.08 MJ',
			dy: -140,
			anchor: 'start',
			color: 'var(--nf-laser)',
			hollow: false
		},
		{
			id: 'iter',
			q: 10,
			title: 'ITER, design goal',
			sub: '500 MW from 50 MW, for minutes',
			dy: 140,
			anchor: 'start',
			color: 'var(--nf-alpha)',
			hollow: true
		}
	];
	const lab = (x: number, anchor: 'start' | 'middle' | 'end') =>
		anchor === 'start' ? x - 10 : anchor === 'end' ? x + 10 : x;
	const ticks = [0.01, 0.1, 1, 10, 100];

	const yourQ = $derived(powers(plasmaOf(params)).q);
	const ignited = $derived(!Number.isFinite(yourQ));
	const yourX = $derived(ignited ? X1 + 70 : sx(yourQ));
	const bob = $derived(reduced ? 0 : 3 * wave(t, 2));
	const yours = $derived(show(5.5));
</script>

<g>
	<!-- regions -->
	<rect
		x={sx(1)}
		y={AY - 190}
		width={X1 - sx(1)}
		height="380"
		fill="var(--nf-ignite)"
		opacity="0.6"
	/>
	<Readout id="more">
		<Label
			x={(sx(1) + X1) / 2}
			y={AY - 200}
			text="more fusion energy out than heating in"
			size={12}
			muted
		/>
	</Readout>

	<!-- the axis -->
	<line x1={X0} x2={X1} y1={AY} y2={AY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line
		x1={X1}
		x2={X1 + 90}
		y1={AY}
		y2={AY}
		stroke="var(--stage-line)"
		stroke-width="1.5"
		stroke-dasharray="4 4"
		marker-end="url(#arrowhead)"
	/>
	{#each ticks as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={AY - 5} y2={AY + 5} stroke="var(--stage-line)" />
		{#if !marks.some((m) => Math.abs(sx(m.q) - sx(v)) < 14)}
			<text x={sx(v)} y={AY + 20} text-anchor="middle" font-size="11" class="muted">{v}</text>
		{/if}
	{/each}
	<Label
		x={X0}
		y={AY - 200}
		text="gain Q = fusion energy ÷ heating energy"
		anchor="start"
		size={13}
		weight={600}
	/>
	<line
		x1={sx(1)}
		x2={sx(1)}
		y1={AY - 190}
		y2={AY + 190}
		stroke="var(--nf-fusion)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	<Readout id="breakeven">
		<Label
			x={sx(1)}
			y={AY + 208}
			text="breakeven, Q = 1"
			size={12}
			color="var(--nf-fusion)"
			weight={600}
		/>
	</Readout>
	<Readout id="ignition">
		<Label
			x={X1 + 90}
			y={AY + 46}
			text="ignition: Q → ∞"
			anchor="end"
			size={12}
			color="var(--nf-fusion)"
			weight={600}
		/>
	</Readout>

	{#each marks as m, k (m.id)}
		{@const x = sx(m.q)}
		{@const y = AY + m.dy}
		{@const up = m.dy < 0}
		<g opacity={show(k)}>
			<line x1={x} x2={x} y1={AY} y2={y + (up ? 14 : -14)} stroke={m.color} stroke-width="1.5" />
			<circle
				cx={x}
				cy={AY}
				r="7"
				fill={m.hollow ? 'var(--stage-bg)' : m.color}
				stroke={m.color}
				stroke-width="2.5"
			/>
			<Readout
				id={m.id}
				order={k + 1}
				label={m.title}
				value="Q ≈ {qText(m.q)} ({m.sub})"
				color={m.color}
				opacity={show(k)}
			>
				<Label
					x={lab(x, m.anchor)}
					y={up ? y - 18 : y + 4}
					text="{m.title}: Q ≈ {qText(m.q)}"
					anchor={m.anchor}
					size={13}
					weight={700}
					color={m.color}
				/>
				<Label
					x={lab(x, m.anchor)}
					y={up ? y + 2 : y + 24}
					text={m.sub}
					anchor={m.anchor}
					size={11}
					muted
				/>
			</Readout>
		</g>
	{/each}

	<!-- the reader's plasma -->
	<g opacity={yours}>
		<path d="M{yourX} {AY - 12 + bob} l-9 -16 h18 Z" fill="var(--nf-fusion)" />
		<Readout
			id="yours"
			order={0}
			label="Your plasma (from the controls)"
			value={ignited ? 'ignited, Q → ∞' : `Q ≈ ${qText(yourQ)}`}
			color="var(--nf-fusion)"
			opacity={yours}
		>
			<Label
				x={ignited ? X1 + 90 : yourX}
				y={AY - 40 + bob}
				text={ignited ? 'your plasma: ignited' : `your plasma: Q ≈ ${qText(yourQ)}`}
				anchor={ignited ? 'end' : 'middle'}
				size={13}
				weight={700}
				color="var(--nf-fusion)"
			/>
		</Readout>
	</g>
</g>
