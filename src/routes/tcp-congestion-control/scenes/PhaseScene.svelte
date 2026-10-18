<script lang="ts">
	/**
	 * Two flows on the page's bottleneck, the second joining at 5 s (../model.ts `sharing`), with
	 * the increase rule from the `rule` control (Reno's AIMD or MIMD). Left: Chiu & Jain's phase
	 * plane, one window against the other, with the line where they fill path and queue
	 * (w₁ + w₂ = 121) and the fairness diagonal. Right: both rates against time, averaged over a
	 * second, and their shares over the last 5 s. Drawn SPEED times faster than real time.
	 */
	import { Axes, Label, linePath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { mbps, meanRate, sharing } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const rule = $derived(params.rule === 'mimd' ? 'mimd' : 'reno');
	const JOIN = 5;
	const T = 80;
	const SPEED = 3;
	const run = $derived(sharing({ algo: rule, join: JOIN, until: T }));
	const now = $derived(reduced ? T : Math.min(T, t * SPEED));

	// ---- phase plane -------------------------------------------------------------------------
	const W = 140;
	const px = scale([0, W], [100, 440]);
	const py = scale([0, W], [520, 180]);
	const FULL = 121;
	const pts = $derived(
		thin(
			run.samples.filter((s) => s.t >= JOIN && s.t <= now),
			500
		)
	);
	const trail = $derived(
		linePath(
			pts,
			(d) => Math.min(W, d.cwnd[0]),
			(d) => Math.min(W, d.cwnd[1]),
			px,
			py
		)
	);
	const cur = $derived(run.samples[Math.min(run.samples.length - 1, Math.round(now / 0.05))]);
	const start = $derived(run.samples[Math.round(JOIN / 0.05) + 1]);

	// ---- rates --------------------------------------------------------------------------------
	const sx = scale([0, T], [540, 900]);
	const sy = scale([0, 12], [330, 180]);
	const smooth = $derived(
		run.samples.map((d, i, a) => {
			const w = a.slice(Math.max(0, i - 19), i + 1);
			return {
				t: d.t,
				a: w.reduce((x, y) => x + y.rate[0], 0) / w.length,
				b: w.reduce((x, y) => x + y.rate[1], 0) / w.length
			};
		})
	);
	const shownR = $derived(thin(smooth.filter((d) => d.t <= now)));
	const aPath = $derived(
		linePath(
			shownR,
			(d) => d.t,
			(d) => mbps(d.a),
			sx,
			sy
		)
	);
	const bPath = $derived(
		linePath(
			shownR,
			(d) => d.t,
			(d) => mbps(d.b),
			sx,
			sy
		)
	);
	const recent = $derived(
		now < JOIN + 1 ? [1, 0] : meanRate(run, Math.max(JOIN, now - 5), Math.max(JOIN + 1, now))
	);
	const share = $derived(recent[0] / Math.max(1e-9, recent[0] + recent[1]));
	const BX0 = 540;
	const BX1 = 900;
	const pct = (v: number) => `${Math.round(v * 100)} %`;
</script>

<g>
	<Readout id="title" order={1} label="Two flows" value="t = {now.toFixed(0)} s">
		<Label
			x={24}
			y={30}
			text="two flows, the second joining at {JOIN} s · {rule === 'reno'
				? 'AIMD'
				: 'MIMD'} · t = {now.toFixed(0)} s (drawn {SPEED}× faster)"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- phase plane -->
	<Axes sx={px} sy={py} xLabel="flow 1's window" yTicks={[0, 60, 120]} xTicks={[0, 60, 120]} />
	<Label x={100} y={168} text="flow 2's window" size={11} anchor="start" muted />
	<line
		x1={px(0)}
		y1={py(0)}
		x2={px(W)}
		y2={py(W)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout id="k-fair">
		<Label x={px(128)} y={py(128) - 10} text="fair: equal" size={11} anchor="end" muted />
	</Readout>
	<line
		x1={px(FULL)}
		y1={py(0)}
		x2={px(0)}
		y2={py(FULL)}
		stroke="var(--tcp-queue)"
		stroke-dasharray="4 4"
	/>
	<Readout id="k-full">
		<Label
			x={px(24) + 8}
			y={py(FULL - 24) - 8}
			text="path + queue full: w₁ + w₂ = 121"
			size={11}
			anchor="start"
			color="var(--tcp-queue)"
		/>
	</Readout>
	<path d={trail} fill="none" stroke="var(--stage-ink)" stroke-width="1.3" opacity="0.75" />
	{#if now >= JOIN}
		<circle
			cx={px(Math.min(W, start.cwnd[0]))}
			cy={py(start.cwnd[1])}
			r="4"
			fill="none"
			stroke="var(--stage-ink)"
		/>
		<Readout id="k-join">
			<Label
				x={px(Math.min(W, start.cwnd[0])) - 8}
				y={py(start.cwnd[1]) + 16}
				text="flow 2 joins"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
		<circle
			cx={px(Math.min(W, cur.cwnd[0]))}
			cy={py(Math.min(W, cur.cwnd[1]))}
			r="6"
			fill="var(--tcp-flow2)"
			stroke="var(--tcp-flow1)"
			stroke-width="2.5"
		/>
	{/if}

	<!-- rates -->
	<Axes {sx} {sy} xLabel="seconds" yTicks={[0, 6, 12]} />
	<Label x={540} y={168} text="rates, Mbit/s (averaged over 1 s)" size={11} anchor="start" muted />
	<path d={aPath} fill="none" stroke="var(--tcp-flow1)" stroke-width="2" />
	<path d={bPath} fill="none" stroke="var(--tcp-flow2)" stroke-width="2" />

	<!-- shares over the last 5 s -->
	<Label x={BX0} y={410} text="shares over the last 5 s" size={11} anchor="start" muted />
	<rect x={BX0} y={420} width={(BX1 - BX0) * share} height={26} rx="4" fill="var(--tcp-flow1)" />
	<rect
		x={BX0 + (BX1 - BX0) * share}
		y={420}
		width={(BX1 - BX0) * (1 - share)}
		height={26}
		rx="4"
		fill="var(--tcp-flow2)"
	/>
	<line
		x1={(BX0 + BX1) / 2}
		x2={(BX0 + BX1) / 2}
		y1={414}
		y2={452}
		stroke="var(--stage-ink)"
		stroke-dasharray="2 3"
	/>
	<Readout
		id="f1"
		order={2}
		label="Flow 1"
		value="{pct(share)} of the link"
		color="var(--tcp-flow1)"
	>
		<Label
			x={BX0}
			y={474}
			text="flow 1: {pct(share)}"
			size={13}
			weight={600}
			anchor="start"
			color="var(--tcp-flow1)"
			tabular
		/>
	</Readout>
	<Readout
		id="f2"
		order={3}
		label="Flow 2"
		value="{pct(1 - share)} of the link"
		color="var(--tcp-flow2)"
	>
		<Label
			x={BX1}
			y={474}
			text="flow 2: {pct(1 - share)}"
			size={13}
			weight={600}
			anchor="end"
			color="var(--tcp-flow2)"
			tabular
		/>
	</Readout>
</g>
