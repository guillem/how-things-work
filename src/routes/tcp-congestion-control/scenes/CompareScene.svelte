<script lang="ts">
	/**
	 * Reno, CUBIC and Vegas, each alone on a 24 Mbit/s, 100 ms path with a 100-packet queue
	 * (../model.ts `versus`), or joined at 30 s by a Reno flow (the `rival` control). One row per
	 * sender: its congestion window (line), the router's queue (shaded, same packet scale) and,
	 * with a rival, the rival's window (orange). Drawn SPEED times faster than real time.
	 */
	import { Axes, Label, areaPath, linePath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FAST, RIVAL_JOIN, mbps, meanRate, versus, type Algo } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const rival = $derived(params.rival === true);
	const T = 90;
	const SPEED = 4.5;
	const now = $derived(reduced ? T : Math.min(T, t * SPEED));
	const ROWS: { algo: Algo; name: string; color: string }[] = [
		{ algo: 'reno', name: 'Reno', color: 'var(--tcp-flow1)' },
		{ algo: 'cubic', name: 'CUBIC', color: 'var(--tcp-cubic)' },
		{ algo: 'vegas', name: 'Vegas', color: 'var(--tcp-vegas)' }
	];
	const runs = $derived(ROWS.map((r) => versus(r.algo, rival)));
	const sx = scale([0, T], [100, 800]);
	const TOP = 320;
	const rowY = [70, 245, 420];
	const H = 130;
	const sys = rowY.map((y) => scale([0, TOP], [y + H, y]));

	const paths = $derived(
		runs.map((r, k) => {
			const xs = thin(
				r.samples.filter((s) => s.t <= now),
				450
			);
			const sy = sys[k];
			return {
				w: linePath(
					xs,
					(d) => d.t,
					(d) => Math.min(TOP, d.cwnd[0]),
					sx,
					sy
				),
				q: areaPath(
					xs,
					(d) => d.t,
					() => 0,
					(d) => d.queue,
					sx,
					sy
				),
				r: rival
					? linePath(
							xs.filter((d) => d.t >= RIVAL_JOIN),
							(d) => d.t,
							(d) => Math.min(TOP, d.cwnd[1]),
							sx,
							sy
						)
					: ''
			};
		})
	);
	/** Mean rates over the last 20 s shown (after the rival joins, when there is one). */
	const rates = $derived(
		runs.map((r) => {
			const from = rival ? Math.max(RIVAL_JOIN + 5, now - 20) : Math.max(5, now - 20);
			return now > from + 1 ? meanRate(r, from, now) : null;
		})
	);
	const fmt = (v: number) => v.toFixed(1);
	const bdp = FAST.rate * FAST.rtt;
</script>

<g>
	<Readout id="title" order={1} label="Path" value="24 Mbit/s, 100 ms, queue 100 packets">
		<Label
			x={24}
			y={30}
			text="24 Mbit/s, 100 ms round trip, queue of 100 packets{rival
				? ' · a Reno flow joins at 30 s'
				: ''} · t = {now.toFixed(0)} s"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	{#each ROWS as row, k (row.algo)}
		<Axes
			{sx}
			sy={sys[k]}
			xTicks={k === 2 ? undefined : []}
			xLabel={k === 2 ? 'seconds' : undefined}
			yTicks={[0, bdp, bdp + FAST.buffer]}
		/>
		<path d={paths[k].q} fill="var(--tcp-queue)" opacity="0.3" />
		{#if rival}
			<path d={paths[k].r} fill="none" stroke="var(--tcp-flow2)" stroke-width="1.6" />
		{/if}
		<path d={paths[k].w} fill="none" stroke={row.color} stroke-width="2.2" />
		<Label
			x={108}
			y={rowY[k] + 4}
			text={row.name}
			size={13}
			weight={700}
			anchor="start"
			color={row.color}
		/>
		{#if rates[k]}
			{@const r = rates[k] ?? [0]}
			<Readout
				id="r-{row.algo}"
				order={2 + k}
				label={row.name}
				value={rival
					? `${fmt(mbps(r[0]))} vs Reno ${fmt(mbps(r[1]))} Mbit/s`
					: `${fmt(mbps(r[0]))} Mbit/s`}
				color={row.color}
			>
				<Label
					x={812}
					y={rowY[k] + 50}
					text="{fmt(mbps(r[0]))} Mbit/s"
					size={12}
					weight={600}
					anchor="start"
					color={row.color}
					tabular
				/>
				{#if rival}
					<Label
						x={812}
						y={rowY[k] + 68}
						text="Reno {fmt(mbps(r[1]))}"
						size={12}
						anchor="start"
						color="var(--tcp-flow2)"
						tabular
					/>
				{/if}
			</Readout>
		{/if}
	{/each}
	<Readout id="key">
		<Label x={812} y={rowY[0] + 4} text="window, packets" size={11} anchor="start" muted />
		<Label
			x={812}
			y={rowY[0] + 20}
			text="queue (shaded)"
			size={11}
			anchor="start"
			color="var(--tcp-queue)"
		/>
	</Readout>
</g>
