<script lang="ts">
	/**
	 * One Reno flow on the page's bottleneck for 40 s (../model.ts `oneFlow`), with the queue
	 * size from the `buffer` control: the congestion window, the queueing delay and the delivered
	 * rate against time, drawn SPEED times faster than real time (reduced motion: the whole run).
	 *
	 * Focus (`step.hints.focus`): 'saw' (the three traces) or 'bloat' (window and delay, and
	 * below them the sweep over queue sizes: utilisation and mean round trip, the current size
	 * highlighted).
	 */
	import { Axes, Label, areaPath, linePath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BASE_RTT, BUFFERS, LINK_RATE, bufferSweep, mbps, meanRate, oneFlow } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(step.hints?.focus === 'bloat' ? 'bloat' : 'saw');
	const buffer = $derived(Number(params.buffer ?? 60));
	const run = $derived(oneFlow(buffer));
	const SPEED = 2;
	const T = 40;
	const now = $derived(reduced ? T : Math.min(T, t * SPEED));
	const shown = $derived(thin(run.samples.filter((s) => s.t <= now)));
	const last = $derived(run.samples[Math.min(run.samples.length - 1, Math.round(now / 0.05))]);
	const losses = $derived(run.losses.filter((l) => l.t <= now));
	const sweep = $derived(focus === 'bloat' ? bufferSweep() : []);
	const meanMbps = $derived(mbps(meanRate(run, 10, T)[0]));

	// ---- layout -------------------------------------------------------------------------------
	const X0 = 90;
	const X1 = 820;
	const VX = X1 + 12;
	const sx = scale([0, T], [X0, X1]);
	const wTop = $derived(Math.max(150, BASE_RTT * LINK_RATE + buffer + 30));
	const syW = $derived(focus === 'saw' ? scale([0, wTop], [210, 84]) : scale([0, wTop], [176, 84]));
	const dTop = $derived(Math.max(100, Math.ceil((buffer + 1) / 100) * 100));
	const syD = $derived(
		focus === 'saw' ? scale([0, dTop], [372, 268]) : scale([0, dTop], [300, 218])
	);
	const syR = scale([0, 15], [540, 432]);

	const wPath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => Math.min(wTop, d.cwnd[0]),
			sx,
			syW
		)
	);
	const dPath = $derived(
		areaPath(
			shown,
			(d) => d.t,
			() => 0,
			(d) => (d.queue / LINK_RATE) * 1000,
			sx,
			syD
		)
	);
	/** Delivered rate averaged over the last second, for legibility. */
	const smoothRate = $derived(
		run.samples.map((d, i, a) => {
			const w = a.slice(Math.max(0, i - 19), i + 1);
			return { t: d.t, r: w.reduce((x, y) => x + y.rate[0], 0) / w.length };
		})
	);
	const rPath = $derived(
		linePath(
			thin(smoothRate.filter((d) => d.t <= now)),
			(d) => d.t,
			(d) => mbps(d.r),
			sx,
			syR
		)
	);
	const full = $derived(BASE_RTT * LINK_RATE + buffer + 1);

	// ---- sweep chart (bloat) --------------------------------------------------------------------
	const BX0 = 120;
	const BX1 = 800;
	const bx = scale([0, BUFFERS.length - 1], [BX0, BX1]);
	const syU = scale([0, 100], [540, 380]);
	const syT = scale([0, 400], [540, 380]);
	const ix = $derived(BUFFERS.indexOf(buffer));
	const uPath = $derived(
		linePath(
			sweep,
			(d) => BUFFERS.indexOf(d.buffer),
			(d) => d.utilisation * 100,
			bx,
			syU
		)
	);
	const tPath = $derived(
		linePath(
			sweep,
			(d) => BUFFERS.indexOf(d.buffer),
			(d) => d.rtt * 1000,
			bx,
			syT
		)
	);
	const indexOf = (d: { buffer: number }) => BUFFERS.indexOf(d.buffer);
	const fmt = (v: number, n = 0) => v.toFixed(n);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="One Reno flow"
		value="queue {buffer} packets, t = {fmt(now)} s"
	>
		<Label
			x={24}
			y={30}
			text="one Reno flow · queue of {buffer} packets · t = {fmt(now)} s (drawn {SPEED}× faster)"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- window -->
	<Axes {sx} sy={syW} xTicks={[]} yTicks={[0, 60, full].filter((v, i, a) => a.indexOf(v) === i)} />
	<line
		x1={X0}
		x2={X1}
		y1={syW(full)}
		y2={syW(full)}
		stroke="var(--tcp-queue)"
		stroke-dasharray="3 4"
		opacity="0.7"
	/>
	<line
		x1={X0}
		x2={X1}
		y1={syW(60)}
		y2={syW(60)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
		opacity="0.6"
	/>
	<path d={wPath} fill="none" stroke="var(--tcp-flow1)" stroke-width="2.2" />
	{#each losses as l (l.t)}
		<path d="M{sx(l.t)} {syW(wTop) + 2} l-5 -8 h10 z" fill="var(--tcp-drop)" />
	{/each}
	<Label
		x={X0}
		y={syW(wTop) - 12}
		text="congestion window, packets (▼ a loss)"
		size={11}
		anchor="start"
		muted
	/>
	<Readout
		id="w"
		order={2}
		label="Window"
		value="{fmt(last.cwnd[0])} packets"
		color="var(--tcp-flow1)"
	>
		<Label
			x={VX}
			y={syW(Math.min(wTop, last.cwnd[0])) + 4}
			text="cwnd {fmt(last.cwnd[0])}"
			size={12}
			anchor="start"
			weight={600}
			color="var(--tcp-flow1)"
			tabular
		/>
	</Readout>

	<!-- queueing delay -->
	<Axes
		{sx}
		sy={syD}
		xTicks={focus === 'bloat' ? undefined : []}
		xLabel={focus === 'bloat' ? 'seconds' : undefined}
		yTicks={[0, dTop]}
	/>
	<path d={dPath} fill="var(--tcp-queue)" opacity="0.35" />
	<Label
		x={X0}
		y={syD(dTop) - 8}
		text="queueing delay, ms (the round trip is 60 ms more)"
		size={11}
		anchor="start"
		muted
	/>
	<Readout
		id="d"
		order={3}
		label="Round trip"
		value="{fmt(BASE_RTT * 1000 + last.queue)} ms"
		color="var(--tcp-queue)"
	>
		<Label
			x={VX}
			y={syD(last.queue) + 4}
			text="RTT {fmt(BASE_RTT * 1000 + last.queue)} ms"
			size={12}
			anchor="start"
			weight={600}
			color="var(--tcp-queue)"
			tabular
		/>
	</Readout>

	{#if focus === 'saw'}
		<!-- delivered rate -->
		<Axes {sx} sy={syR} xLabel="seconds" yTicks={[0, 6, 12]} />
		<line
			x1={X0}
			x2={X1}
			y1={syR(12)}
			y2={syR(12)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>
		<path d={rPath} fill="none" stroke="var(--tcp-ack)" stroke-width="1.8" />
		<Label
			x={X0}
			y={syR(15) - 8}
			text="delivered, Mbit/s (link: 12), averaged over 1 s"
			size={11}
			anchor="start"
			muted
		/>
		<Readout
			id="r"
			order={4}
			label="Mean rate after 10 s"
			value="{fmt(meanMbps, 1)} Mbit/s"
			color="var(--tcp-ack)"
		>
			<Label
				x={VX}
				y={syR(12) + 4}
				text="mean {fmt(meanMbps, 1)}"
				size={12}
				anchor="start"
				weight={600}
				color="var(--tcp-ack)"
				tabular
			/>
		</Readout>
	{:else}
		<!-- the sweep over queue sizes -->
		<Axes
			sx={bx}
			sy={syU}
			xTicks={BUFFERS.map((_, i) => i)}
			xFormat={(i: number) => `${BUFFERS[i]}`}
			xLabel="queue, packets"
			yTicks={[0, 50, 100]}
		/>
		<Axes sx={bx} sy={syT} xTicks={[]} yTicks={[0, 200, 400]} yRight grid={false} />
		<rect
			x={bx(ix) - 16}
			y={378}
			width={32}
			height={164}
			rx="6"
			fill="var(--tcp-flow1)"
			opacity="0.1"
		/>
		<path d={uPath} fill="none" stroke="var(--tcp-ack)" stroke-width="2.2" />
		<path d={tPath} fill="none" stroke="var(--tcp-queue)" stroke-width="2.2" />
		{#each sweep as d (d.buffer)}
			<circle
				cx={bx(indexOf(d))}
				cy={syU(d.utilisation * 100)}
				r={d.buffer === buffer ? 5.5 : 3.5}
				fill="var(--tcp-ack)"
			/>
			<circle
				cx={bx(indexOf(d))}
				cy={syT(d.rtt * 1000)}
				r={d.buffer === buffer ? 5.5 : 3.5}
				fill="var(--tcp-queue)"
			/>
		{/each}
		<Readout id="u-key">
			<Label
				x={BX0 + 8}
				y={372}
				text="link busy, % (left)"
				size={11}
				anchor="start"
				color="var(--tcp-ack)"
			/>
			<Label
				x={BX1 - 8}
				y={372}
				text="mean round trip, ms (right)"
				size={11}
				anchor="end"
				color="var(--tcp-queue)"
			/>
		</Readout>
		{#if ix >= 0}
			<Readout
				id="u"
				order={4}
				label="Link busy, mean round trip"
				value="{fmt(sweep[ix].utilisation * 100)} %, {fmt(sweep[ix].rtt * 1000)} ms"
			>
				<Label
					x={bx(ix) + (ix > 5 ? -12 : 12)}
					y={syU(sweep[ix].utilisation * 100) + (sweep[ix].utilisation > 0.95 ? 18 : -10)}
					text="{fmt(sweep[ix].utilisation * 100)} % busy, {fmt(sweep[ix].rtt * 1000)} ms"
					size={12}
					weight={600}
					anchor={ix > 5 ? 'end' : 'start'}
					tabular
				/>
			</Readout>
		{/if}
	{/if}
</g>
