<script lang="ts">
	/**
	 * One Reno flow over a fast link (120 Mbit/s, 100 ms) that loses packets at random
	 * (../model.ts `lossyFlow`). Left: throughput against the loss rate on log–log axes, the
	 * Mathis formula 1.22 / (RTT √p) as a line and the simulation as dots, the current rate (the
	 * `loss` control) highlighted. Right: that flow's congestion window over 60 s, drawn SPEED
	 * times faster than real time, with each loss detection marked.
	 */
	import { Axes, Label, linePath, niceMax, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LOSSY_RTT, LOSS_RATES, lossyFlow, lossyRate, mathis, mbps } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const p = $derived(Number(params.loss ?? 0.002));
	const run = $derived(lossyFlow(p));
	const points = $derived(LOSS_RATES.map((q) => ({ p: q, rate: lossyRate(q) })));
	/** The highlighted point is at the left edge: label it on its right. */
	const left = $derived(p < 0.0015);
	const here = $derived(points.find((d) => Math.abs(d.p - p) < 1e-9) ?? points[0]);

	// ---- log–log chart --------------------------------------------------------------------------
	const lx = scale([Math.log10(3e-4), Math.log10(3e-2)], [100, 470]);
	const ly = scale([Math.log10(0.5), Math.log10(12)], [520, 120]);
	const PT = [3e-4, 1e-3, 3e-3, 1e-2, 3e-2];
	const RT = [0.5, 1, 2, 5, 10];
	const formula = $derived(
		linePath(
			Array.from({ length: 41 }, (_, i) => 3e-4 * 100 ** (i / 40)),
			(q) => Math.log10(q),
			(q) => Math.log10(mbps(mathis(LOSSY_RTT, q))),
			lx,
			ly
		)
	);

	// ---- window trace ---------------------------------------------------------------------------
	const T = 60;
	const SPEED = 3;
	const now = $derived(reduced ? T : Math.min(T, t * SPEED));
	const sx = scale([0, T], [560, 900]);
	const wTop = $derived(
		niceMax(Math.max(...run.samples.filter((s) => s.t <= T).map((s) => s.cwnd[0])))
	);
	const sy = $derived(scale([0, wTop], [400, 160]));
	const shown = $derived(
		thin(
			run.samples.filter((s) => s.t <= now),
			500
		)
	);
	const wPath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => Math.min(wTop, d.cwnd[0]),
			sx,
			sy
		)
	);
	const marks = $derived(run.losses.filter((l) => l.t <= now && l.t <= T));
	const pctText = (q: number) => `${Number((q * 100).toPrecision(2))} %`;
	const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
</script>

<g>
	<Readout id="title" order={1} label="Random loss" value="{pctText(p)} of packets">
		<Label
			x={24}
			y={30}
			text="one Reno flow on a 120 Mbit/s link, 100 ms round trip, losing {pctText(
				p
			)} of packets at random"
			size={14}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- throughput against loss -->
	<Axes
		sx={lx}
		sy={ly}
		xTicks={PT.map(Math.log10)}
		yTicks={RT.map(Math.log10)}
		xFormat={(v) => `${Number((10 ** v * 100).toPrecision(1))} %`}
		yFormat={(v) => `${Number((10 ** v).toPrecision(2))}`}
		xLabel="loss rate p"
	/>
	<Label x={100} y={108} text="throughput, Mbit/s (log scales)" size={11} anchor="start" muted />
	<path
		d={formula}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
		stroke-dasharray="6 4"
	/>
	<Readout id="k-f">
		<Label
			x={lx(Math.log10(4e-4)) + 4}
			y={ly(Math.log10(mbps(mathis(LOSSY_RTT, 4e-4)))) - 14}
			text="Mathis: 1.22 · MSS / (RTT √p)"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
	{#each points as d (d.p)}
		<circle
			cx={lx(Math.log10(d.p))}
			cy={ly(Math.log10(mbps(d.rate)))}
			r={d.p === here.p ? 7 : 4.5}
			fill="var(--tcp-flow1)"
			stroke={d.p === here.p ? 'var(--stage-ink)' : 'none'}
			stroke-width="1.5"
		/>
	{/each}
	<Readout
		id="sim"
		order={2}
		label="Simulated"
		value="{fmt(mbps(here.rate))} Mbit/s"
		color="var(--tcp-flow1)"
	>
		<Label
			x={lx(Math.log10(here.p)) + (left ? 14 : -12)}
			y={ly(Math.log10(mbps(here.rate))) + 26}
			text="simulated {fmt(mbps(here.rate))} Mbit/s"
			size={12}
			weight={600}
			anchor={left ? 'start' : 'end'}
			color="var(--tcp-flow1)"
			tabular
		/>
	</Readout>
	<Readout
		id="formula"
		order={3}
		label="Mathis formula"
		value="{fmt(mbps(mathis(LOSSY_RTT, here.p)))} Mbit/s"
	>
		<Label
			x={lx(Math.log10(here.p)) + (left ? 14 : -12)}
			y={ly(Math.log10(mbps(here.rate))) + 42}
			text="formula {fmt(mbps(mathis(LOSSY_RTT, here.p)))} Mbit/s"
			size={12}
			anchor={left ? 'start' : 'end'}
			muted
			tabular
		/>
	</Readout>

	<!-- the window -->
	<Axes {sx} {sy} xLabel="seconds" yTicks={[0, wTop / 2, wTop]} />
	<Label
		x={560}
		y={148}
		text="its congestion window, packets (▼ a loss)"
		size={11}
		anchor="start"
		muted
	/>
	<path d={wPath} fill="none" stroke="var(--tcp-flow1)" stroke-width="1.8" />
	{#each marks as l (l.t)}
		<path
			d="M{sx(l.t)} {sy(wTop) - 2} l-4 -7 h8 z"
			fill={l.timeout ? 'var(--stage-ink-muted)' : 'var(--tcp-drop)'}
		/>
	{/each}
	<Readout id="k-link">
		<Label
			x={560}
			y={452}
			text="the link could carry 1,000 packets per round trip"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
