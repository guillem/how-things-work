<script lang="ts">
	/**
	 * Many senders on the page's bottleneck, each with a receiver window of 16 packets
	 * (../model.ts `crowd`). Left: goodput against the number of senders, without congestion
	 * control (TCP before 1988) and with it (Reno), the curve of the `backoff` setting in front;
	 * the points appear one by one. Right: what the busy link carries at the `senders` setting:
	 * new data and copies of packets the receiver already had.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LINK_RATE, SENDERS, crowd, mbps } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const n = $derived(Number(params.senders ?? 32));
	const on = $derived(params.backoff === true);
	const curves = $derived({
		off: SENDERS.map((k) => crowd(k, false)),
		on: SENDERS.map((k) => crowd(k, true))
	});
	const ix = $derived(Math.max(0, SENDERS.indexOf(n)));
	const cur = $derived(on ? curves.on[ix] : curves.off[ix]);
	/** Points revealed so far (one every 0.5 s). */
	const reveal = $derived(
		reduced ? SENDERS.length : Math.min(SENDERS.length, 1 + Math.floor(t / 0.5))
	);

	const sx = scale([0, SENDERS.length - 1], [100, 600]);
	const sy = scale([0, 12], [520, 130]);
	const path = (c: { goodput: number }[]) =>
		linePath(
			c.slice(0, reveal),
			(d) => c.indexOf(d),
			(d) => mbps(d.goodput),
			sx,
			sy
		);
	const offPath = $derived(path(curves.off));
	const onPath = $derived(path(curves.on));

	// ---- the link's contents --------------------------------------------------------------------
	const BX = 720;
	const BW = 70;
	const by = scale([0, 1], [520, 130]);
	/** Shares of the link's capacity: new data, and new data plus copies. */
	const useful = $derived(cur.goodput / LINK_RATE);
	const busy = $derived(cur.throughput / LINK_RATE);
	const pct = (v: number) => `${Math.round(v * 100)} %`;
	const fmt = (v: number) => v.toFixed(1);
</script>

<g>
	<Readout id="title" order={1} label="Senders" value="{n}, each with a 16-packet window">
		<Label
			x={24}
			y={30}
			text="{n} sender{n > 1
				? 's'
				: ''} through the 12 Mbit/s bottleneck, each with a 16-packet receiver window · offered load {fmt(
				cur.offered
			)}× the link"
			size={14}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={SENDERS.map((_, i) => i)}
		xFormat={(i: number) => `${SENDERS[i]}`}
		xLabel="senders"
		yTicks={[0, 3, 6, 9, 12]}
	/>
	<Label
		x={100}
		y={118}
		text="goodput: new data delivered, Mbit/s"
		size={11}
		anchor="start"
		muted
	/>
	<path
		d={offPath}
		fill="none"
		stroke="var(--tcp-drop)"
		stroke-width={on ? 1.5 : 3}
		opacity={on ? 0.45 : 1}
	/>
	<path
		d={onPath}
		fill="none"
		stroke="var(--tcp-ack)"
		stroke-width={on ? 3 : 1.5}
		opacity={on ? 1 : 0.45}
	/>
	{#each SENDERS.slice(0, reveal) as k, i (k)}
		<circle
			cx={sx(i)}
			cy={sy(mbps(curves.off[i].goodput))}
			r={!on && i === ix ? 6.5 : 3.5}
			fill="var(--tcp-drop)"
			opacity={on ? 0.45 : 1}
		/>
		<circle
			cx={sx(i)}
			cy={sy(mbps(curves.on[i].goodput))}
			r={on && i === ix ? 6.5 : 3.5}
			fill="var(--tcp-ack)"
			opacity={on ? 1 : 0.45}
		/>
	{/each}
	{#if reveal === SENDERS.length}
		<Readout id="k-on">
			<Label
				x={sx(SENDERS.length - 1)}
				y={sy(mbps(curves.on.at(-1)?.goodput ?? 0)) - 14}
				text="with congestion control"
				size={12}
				anchor="end"
				color="var(--tcp-ack)"
				weight={on ? 600 : 400}
			/>
		</Readout>
		<Readout id="k-off">
			<Label
				x={sx(SENDERS.length - 1)}
				y={sy(mbps(curves.off.at(-1)?.goodput ?? 0)) + 24}
				text="without (TCP before 1988)"
				size={12}
				anchor="end"
				color="var(--tcp-drop)"
				weight={on ? 400 : 600}
			/>
		</Readout>
	{/if}

	<!-- what the link carries -->
	<Label x={BX + BW / 2} y={118} text="the link carries" size={11} muted />
	<rect
		x={BX}
		y={by(1)}
		width={BW}
		height={by(0) - by(1)}
		rx="4"
		fill="none"
		stroke="var(--border)"
	/>
	<rect
		x={BX}
		y={by(busy)}
		width={BW}
		height={by(0) - by(busy)}
		rx="4"
		fill="var(--tcp-drop)"
		opacity="0.55"
	/>
	<rect
		x={BX}
		y={by(useful)}
		width={BW}
		height={by(0) - by(useful)}
		rx="4"
		fill="var(--tcp-ack)"
		opacity="0.85"
	/>
	<Readout
		id="new"
		order={2}
		label="New data"
		value="{pct(useful)} of the link ({fmt(mbps(cur.goodput))} Mbit/s)"
		color="var(--tcp-ack)"
	>
		<Label
			x={BX + BW + 10}
			y={by(useful / 2) + 4}
			text="new data {pct(useful)}"
			size={12}
			weight={600}
			anchor="start"
			color="var(--tcp-ack)"
			tabular
		/>
	</Readout>
	{#if busy - useful > 0.03}
		<Readout
			id="dup"
			order={3}
			label="Copies"
			value="{pct(busy - useful)} of the link"
			color="var(--tcp-drop)"
		>
			<Label
				x={BX + BW + 10}
				y={by((busy + useful) / 2) + 4}
				text="copies {pct(busy - useful)}"
				size={12}
				weight={600}
				anchor="start"
				color="var(--tcp-drop)"
				tabular
			/>
		</Readout>
	{/if}
	{#if busy < 0.97}
		<Readout id="idle" order={4} label="Idle" value="{pct(1 - busy)} of the link">
			<Label
				x={BX + BW + 10}
				y={by((1 + busy) / 2) + 4}
				text="idle {pct(1 - busy)}"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{/if}
	<Readout id="mode" order={5} label="Congestion control" value={on ? 'on' : 'off'}>
		<Label
			x={BX + BW / 2}
			y={548}
			text="congestion control {on ? 'on' : 'off'}"
			size={12}
			weight={600}
		/>
	</Readout>
</g>
