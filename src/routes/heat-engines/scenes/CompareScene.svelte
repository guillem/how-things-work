<script lang="ts">
	/**
	 * Step 9: the Otto cycle of `otto(params.ratio, params.tCold, params.tHot)`
	 * on a temperature–entropy chart, inside the Carnot rectangle between the
	 * same coldest and hottest temperatures and over the same range of entropy
	 * (`carnotAround`), with the two efficiencies as bars. A dot goes round the
	 * Otto loop.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, cycle, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { along, carnotAround, carnotLimit, loop, otto } from '../engine';
	import { fmt, niceUp, pct } from './colors';

	let { t, params, reduced }: StageProps = $props();
	const tm = $derived(reduced ? 3.5 : t);

	const r = $derived(Number(params.ratio ?? 10));
	const tHot = $derived(Number(params.tHot ?? 2500));
	const tCold = $derived(Number(params.tCold ?? 300));
	const c = $derived(otto(r, tCold, tHot));
	const k = $derived(carnotAround(c));
	const limit = $derived(carnotLimit(tHot, tCold));
	const [, s2, s3] = $derived(c.states);

	const ax = new Tween({ S: 0.8, T: 3000 }, { duration: 700, easing: cubicInOut });
	const target = $derived({ S: niceUp(s3.S * 1.12), T: Math.ceil((tHot * 1.12) / 500) * 500 });
	$effect(() => {
		const v = target;
		untrack(() => ax.set(v, { duration: reduced ? 0 : 700 }));
	});
	const sx = $derived(scale([-ax.current.S * 0.06, ax.current.S], [90, 590]));
	const sy = $derived(scale([0, ax.current.T], [470, 80]));

	const pts = $derived(loop(c, 60));
	const ottoPath = $derived(
		pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.S).toFixed(1)} ${sy(p.T).toFixed(1)}`).join(' ') + 'Z'
	);
	const rect = $derived(
		k.states
			.map((p, i) => `${i ? 'L' : 'M'}${sx(p.S).toFixed(1)} ${sy(p.T).toFixed(1)}`)
			.join(' ') + 'Z'
	);

	// The dot: 2.5 s per leg.
	const u = $derived(cycle(tm, 10));
	const g = $derived(along(c, Math.min(3, Math.floor(u * 4)), (u * 4) % 1));

	// Bars.
	const by = scale([0, 1], [470, 110]);
	const BARS = $derived([
		{ id: 'otto', x: 720, v: c.efficiency, label: 'Otto cycle', color: 'var(--he-loop)' },
		{ id: 'carnot', x: 840, v: limit, label: 'Carnot limit', color: 'var(--he-carnot)' }
	]);
</script>

<g>
	<Axes
		{sx}
		{sy}
		xLabel="entropy of the gas (J/K)"
		yLabel="temperature (K)"
		xTicks={[0, ax.current.S / 2, ax.current.S]}
		xFormat={(v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3 })}
	/>
	<path
		d={rect}
		fill="var(--he-carnot-fill)"
		stroke="var(--he-carnot)"
		stroke-width="2"
		stroke-dasharray="6 4"
	/>
	<path
		d={ottoPath}
		fill="var(--he-loop-fill)"
		stroke="var(--he-loop)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	<line
		x1={sx(0)}
		x2={sx(s3.S)}
		y1={sy(s2.T)}
		y2={sy(s2.T)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 4"
	/>

	{#each c.states as s, i (i)}
		<circle cx={sx(s.S)} cy={sy(s.T)} r="4" fill="var(--he-loop)" />
		<Readout id="cs{i}">
			<Label
				x={sx(s.S) + (i < 2 || i === 2 ? -12 : 12)}
				y={sy(s.T) + (i === 0 ? 14 : i === 2 ? -6 : 4)}
				text={String(i + 1)}
				weight={700}
				color="var(--he-loop)"
			/>
		</Readout>
	{/each}
	<Readout
		id="t-labels"
		order={1}
		label="Temperatures"
		value="{fmt(tCold)} K in, {fmt(s2.T)} K squeezed, {fmt(tHot)} K burnt"
	>
		<Label
			x={sx(s3.S) + 10}
			y={sy(tHot) + 4}
			text="Th = {fmt(tHot)} K"
			anchor="start"
			size={12}
			color="var(--he-hot)"
		/>
		<Label
			x={sx(s3.S) + 10}
			y={sy(tCold) + 4}
			text="Tc = {fmt(tCold)} K"
			anchor="start"
			size={12}
			color="var(--he-cold)"
		/>
		<Label
			x={sx(s3.S) + 10}
			y={sy(s2.T) + 4}
			text="T₂ = {fmt(s2.T)} K"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="corners">
		<Label
			x={sx(s3.S * 0.22)}
			y={sy(tHot) + 22}
			text="heat could go in hotter"
			size={11}
			muted
			anchor="start"
		/>
		<Label
			x={sx(s3.S * 0.97)}
			y={sy(tCold) - 10}
			text="heat leaves hotter than Tc"
			size={11}
			muted
			anchor="end"
		/>
	</Readout>
	<circle
		cx={sx(g.S)}
		cy={sy(g.T)}
		r="6"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	<!-- efficiency bars -->
	<Readout id="bars-title">
		<text x={680} y={92} font-size="12" class="muted">efficiency</text>
	</Readout>
	{#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
		<line x1={680} x2={900} y1={by(v)} y2={by(v)} stroke="var(--stage-grid)" />
		<text x={672} y={by(v) + 4} font-size="11" text-anchor="end" class="muted">{pct(v)}</text>
	{/each}
	{#each BARS as b (b.id)}
		<rect
			x={b.x - 40}
			y={by(b.v)}
			width="80"
			height={by(0) - by(b.v)}
			rx="3"
			fill={b.color}
			opacity="0.8"
		/>
		<Readout
			id="bar-{b.id}"
			order={b.id === 'otto' ? 2 : 3}
			label={b.label}
			value={pct(b.v, 1)}
			color={b.color}
		>
			<Label x={b.x} y={by(b.v) - 10} text={pct(b.v, 1)} size={15} weight={700} color={b.color} />
			<Label x={b.x} y={by(0) + 20} text={b.label} size={12} />
		</Readout>
	{/each}
	<Readout id="eq" order={4} label="Otto = 1 − T₁/T₂" value={pct(1 - tCold / s2.T, 1)}>
		<Label x={780} y={by(0) + 44} text="Otto = 1 − Tc/T₂: only the ratio matters" size={11} muted />
	</Readout>
</g>
